// ─── Utilitários do Mp. CRM ───────────────────────────────────────────────────

import type { Lead } from '@/types';

export function fmtR(v: number | null | undefined): string {
  if (v == null) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0 });
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

/** Último contato registrado no histórico */
export function ultimoContato(hist: string[], dataEntrada: string): string {
  if (hist && hist.length > 0) {
    for (let i = hist.length - 1; i >= 0; i--) {
      const m = hist[i].match(/(\d{2}\/\d{2})/);
      if (m) return m[1];
    }
  }
  return dataEntrada;
}

/** Lead parado sem contato? */
export function isStale(hist: string[], dataEntrada: string, status: string): boolean {
  if (status === 'fechado' || status === 'perdido') return false;
  return diasAtras(ultimoContato(hist, dataEntrada)) > 3;
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

/** Valor do lead (explícito ou pelo interesse) */
export function getLeadValor(l: Partial<Lead>, val: Record<string, number> = {}): number {
  if (l.valor) return l.valor;
  if (l.int) {
    // tenta pelo nome do produto
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
