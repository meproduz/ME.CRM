// ─── Utilitários do Mp. CRM ───────────────────────────────────────────────────

import type { Lead } from '@/types';
import { VAL } from '@/types';

export function fmtR(v: number | null | undefined): string {
  if (v == null) return '—';
  // Converte para centavos (inteiro) para evitar problemas de ponto flutuante
  const rounded = Math.round(Number(v) * 100);
  const cents = rounded % 100;
  const intPart = Math.floor(rounded / 100);
  const intFormatted = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'R$ ' + intFormatted + ',' + Math.abs(cents).toString().padStart(2, '0');
}

export function hoje(): string {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function agora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Converte YYYY-MM-DD → DD/MM */
export function fmtData(s: string | null): string {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
}

/** Quantos dias atrás foi DD/MM */
export function diasAtras(data: string): number {
  if (!data) return 0;
  try {
    const [d, m] = data.split('/').map(Number);
    const now = new Date();
    let dt = new Date(now.getFullYear(), m - 1, d);
    if (dt > now) dt = new Date(now.getFullYear() - 1, m - 1, d);
    return Math.max(0, Math.floor((now.getTime() - dt.getTime()) / 86400000));
  } catch { return 0; }
}

/** Último contato registrado no histórico.
 *  Se hist ainda não foi carregado (vazio), usa lastContact (pré-carregado no load inicial). */
export function ultimoContato(hist: string[], dataEntrada: string, lastContact?: string): string {
  if (hist && hist.length > 0) {
    for (let i = hist.length - 1; i >= 0; i--) {
      const m = hist[i].match(/(\d{2}\/\d{2})/);
      if (m) return m[1];
    }
  }
  // Usa último entry pré-carregado quando hist ainda não foi populado
  if (lastContact) {
    const m = lastContact.match(/(\d{2}\/\d{2})/);
    if (m) return m[1];
  }
  return dataEntrada;
}

/** Dias sem contato tolerados por etapa */
const STALE_THRESHOLD: Record<string, number> = {
  novo:       1,   // novo lead deve ser contactado em 1 dia
  contato:    3,   // em contato: 3 dias
  proposta:   5,   // proposta enviada pode aguardar 5 dias
  negociacao: 7,   // negociação pode levar mais tempo
};

/** Lead parado sem contato?
 *  Usa lastContact (pré-carregado no load inicial) para precisão sem precisar
 *  abrir o lead. statusChangedAt é fallback quando não há nenhum histórico. */
export function isStale(
  hist: string[],
  dataEntrada: string,
  status: string,
  statusChangedAt?: string | null,
  lastContact?: string,
): boolean {
  if (status === 'fechado' || status === 'perdido') return false;
  const threshold = STALE_THRESHOLD[status] ?? 3;

  // Quando não há histórico nem lastContact, usa status_changed_at como proxy
  if (hist.length === 0 && !lastContact && statusChangedAt) {
    const daysSince = Math.floor(
      (Date.now() - new Date(statusChangedAt).getTime()) / 86400000
    );
    if (daysSince <= threshold) return false;
  }

  return diasAtras(ultimoContato(hist, dataEntrada, lastContact)) > threshold;
}

/** Score de qualificação 0-5 */
export function qualScore(l: Partial<Lead>): number {
  let s = 0;
  if (l.nome && l.nome.length > 2) s++;
  if (l.tel && l.tel.length > 8) s++;
  if (l.seg && l.seg !== '') s++;
  if (l.int && l.int !== '') s++;
  if (l.obs && l.obs.length > 10) s++;
  return s;
}

/** Valor do lead (explícito ou pelo interesse)
 *  Corrige valores salvos com ponto como separador de milhar (ex: 1.799 → 1799)
 *  Produtos da Me Produz. custam R$700+, então v < 100 indica erro de input pt-BR */
export function getLeadValor(l: Partial<Lead>, val: Record<string, number> = VAL): number {
  if (l.valor != null) {
    const v = Number(l.valor);
    if (!isNaN(v) && v > 0) {
      return v < 100 ? Math.round(v * 1000) : v;
    }
  }
  if (l.int) {
    const key = Object.keys(val).find((k) => l.int?.toLowerCase().includes(k.toLowerCase()));
    if (key) return val[key];
  }
  return 0;
}

/** Status do follow-up (vencido / hoje / em X dias) */
export function fuStatus(followup: string | null): { text: string; color: string } | null {
  if (!followup) return null;
  const fd = new Date(followup + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((fd.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `⚠️ Vencido há ${-diff} dia${-diff > 1 ? 's' : ''}`, color: 'var(--red)' };
  if (diff === 0) return { text: '📅 Hoje!', color: 'var(--accent)' };
  return { text: `✓ Em ${diff} dia${diff > 1 ? 's' : ''}`, color: 'var(--green)' };
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Retorna a data de entrada do lead em formato DD/MM.
 *  Usa o campo `data` do banco se existir; caso contrário deriva de `created_at`. */
export function leadData(l: { data?: string; created_at?: string }): string {
  if (l.data) return l.data;
  if (!l.created_at) return '—';
  return new Date(l.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Retorna a hora de entrada do lead em formato HH:MM.
 *  Usa o campo `hora` do banco se existir; caso contrário deriva de `created_at`. */
export function leadHora(l: { hora?: string; created_at?: string }): string {
  if (l.hora) return l.hora;
  if (!l.created_at) return '';
  return new Date(l.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
