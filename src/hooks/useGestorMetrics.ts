'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCRM } from '@/store/crm-store';
import type { Lead } from '@/types';
import { VAL } from '@/types';

// ── Probabilidade de fechamento por etapa ─────────────────────────────────────
export const PROB_ETAPA: Record<string, number> = {
  novo: 0.05, contato: 0.15, proposta: 0.35,
  negociacao: 0.65, fechado: 1.0, perdido: 0,
};

export const LABEL_ETAPA: Record<string, string> = {
  novo: 'Novo', contato: 'Em contato', proposta: 'Proposta',
  negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
};

export const COR_ETAPA: Record<string, string> = {
  novo: '#C9A227', contato: '#3B82F6', proposta: '#8B5CF6',
  negociacao: '#F97316', fechado: '#22C55E', perdido: '#EF4444',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
export function getLeadValor(l: Lead): number {
  if (l.valor && Number(l.valor) > 0) return Number(l.valor);
  if (l.int) {
    const key = Object.keys(VAL).find(k => l.int?.toLowerCase().includes(k.toLowerCase()));
    if (key) return VAL[key];
  }
  return 0;
}

function mesAno(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// ── Tipos ──────────────────────────────────────────────────────────────────────
export interface EtapaMetric {
  status: string;
  label: string;
  cor: string;
  count: number;
  valor: number;
  pctLeads: number;     // % do total de leads ativos
  pctConversao: number; // % que chegou aqui vindo da etapa anterior
  forecastPonderado: number;
  tempoMedioHoras: number | null; // null = sem dados suficientes
}

export interface MesMetric {
  label: string;       // "Jun 2026"
  leads: number;
  fechados: number;
  receita: number;
  conversao: number;   // 0-100
}

export interface OrigemMetric {
  orig: string;
  leads: number;
  fechados: number;
  conversao: number;
  ticketMedio: number;
  receita: number;
}

export interface QualidadeMetric {
  campo: string;
  label: string;
  preenchidos: number;
  pct: number;
}

export interface AlertaLead { id: string; nome: string; status: string; diasParado: number; }
export interface AlertaFollowup { id: string; nome: string; followup: string; diasAtraso: number; }

export interface GestorMetrics {
  // KPIs mês atual
  leadsNoMes: number;
  fechadosNoMes: number;
  receitaNoMes: number;
  taxaConversao: number;     // % leads fechados / total criados no mês
  ticketMedio: number;
  // Comparação vs mês anterior
  trendLeads: number;        // % diferença
  trendFechados: number;
  trendReceita: number;
  // Forecast
  forecastTotal: number;     // pipeline ponderado (excluindo fechado/perdido)
  forecastComFechados: number; // fechados + ponderado
  metaMensal: number;
  probBaterMeta: number;     // 0-100
  // Etapas (funil)
  etapas: EtapaMetric[];
  // Histórico mensal (4 meses atrás + atual)
  historicMensal: MesMetric[];
  // Motivos de perda
  motivosPerdas: { motivo: string; count: number; pct: number }[];
  // ROI por origem
  origROI: OrigemMetric[];
  // Qualidade de dados
  qualidade: QualidadeMetric[];
  // Alertas
  alertasParados: AlertaLead[];
  alertasFollowup: AlertaFollowup[];
  alertasSemMotivo: number;
  // Total geral
  totalLeads: number;
  loading: boolean;
  error: string | null;
}

const EMPTY: GestorMetrics = {
  leadsNoMes: 0, fechadosNoMes: 0, receitaNoMes: 0,
  taxaConversao: 0, ticketMedio: 0,
  trendLeads: 0, trendFechados: 0, trendReceita: 0,
  forecastTotal: 0, forecastComFechados: 0, metaMensal: 0, probBaterMeta: 0,
  etapas: [], historicMensal: [], motivosPerdas: [],
  origROI: [], qualidade: [],
  alertasParados: [], alertasFollowup: [], alertasSemMotivo: 0,
  totalLeads: 0, loading: true, error: null,
};

// ── Hook principal ─────────────────────────────────────────────────────────────
export function useGestorMetrics(): GestorMetrics {
  const { state } = useCRM();
  const [metrics, setMetrics] = useState<GestorMetrics>(EMPTY);

  useEffect(() => {
    if (!state.currentUser?.cliente_id) return;
    compute(state.currentUser.cliente_id, state.metaMensal);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentUser?.cliente_id, state.metaMensal]);

  async function compute(clienteId: string, metaMensal: number) {
    setMetrics(m => ({ ...m, loading: true, error: null }));
    try {
      // 1. Buscar TODOS os leads do cliente (sem paginação)
      const { data: leads, error: leadsErr } = await supabase
        .from('leads')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      if (leadsErr) throw leadsErr;
      const all = (leads ?? []) as Lead[];

      // 2. Buscar última atividade por lead (para detectar leads parados)
      const activeIds = all
        .filter(l => l.status !== 'fechado' && l.status !== 'perdido')
        .map(l => l.id);

      let ultimaAtividade: Record<string, string> = {};
      if (activeIds.length > 0) {
        const { data: histData } = await supabase
          .from('leads_historico')
          .select('lead_id, created_at')
          .in('lead_id', activeIds)
          .order('created_at', { ascending: false });

        // Mapa lead_id → ultima data de atividade
        (histData ?? []).forEach((h: { lead_id: string; created_at: string }) => {
          if (!ultimaAtividade[h.lead_id]) ultimaAtividade[h.lead_id] = h.created_at;
        });
      }

      // 3. Buscar entradas tipo='status_change' para tempo por etapa
      const { data: statusChanges } = await supabase
        .from('leads_historico')
        .select('lead_id, meta_json, created_at')
        .eq('tipo', 'status_change')
        .in('lead_id', all.map(l => l.id));

      setMetrics(buildMetrics(all, metaMensal, ultimaAtividade, statusChanges ?? []));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar métricas';
      setMetrics(m => ({ ...m, loading: false, error: msg }));
    }
  }

  return metrics;
}

// ── Cálculo de todas as métricas ──────────────────────────────────────────────
function buildMetrics(
  all: Lead[],
  metaMensal: number,
  ultimaAtividade: Record<string, string>,
  statusChanges: { lead_id: string; meta_json: unknown; created_at: string }[],
): GestorMetrics {
  const agora = new Date();
  const inicioMesAtual = startOfMonth(agora);
  const inicioMesAnterior = startOfMonth(new Date(agora.getFullYear(), agora.getMonth() - 1, 1));

  // ── KPIs mês atual e anterior ────────────────────────────────────────────────
  function inRange(lead: Lead, from: Date, to: Date): boolean {
    const d = new Date(lead.created_at);
    return d >= from && d < to;
  }

  const leadsAtual = all.filter(l => inRange(l, inicioMesAtual, agora));
  const leadsAnterior = all.filter(l => inRange(l, inicioMesAnterior, inicioMesAtual));

  const fechAtual = leadsAtual.filter(l => l.status === 'fechado');
  const fechAnterior = leadsAnterior.filter(l => l.status === 'fechado');

  const recAtual = fechAtual.reduce((s, l) => s + getLeadValor(l), 0);
  const recAnterior = fechAnterior.reduce((s, l) => s + getLeadValor(l), 0);

  function trend(a: number, b: number) {
    if (b === 0) return a > 0 ? 100 : 0;
    return Math.round(((a - b) / b) * 100);
  }

  const taxaConversao = leadsAtual.length > 0
    ? Math.round((fechAtual.length / leadsAtual.length) * 100) : 0;
  const ticketMedio = fechAtual.length > 0 ? Math.round(recAtual / fechAtual.length) : 0;

  // ── Forecast ─────────────────────────────────────────────────────────────────
  const ativos = all.filter(l => l.status !== 'perdido');
  const forecastTotal = ativos
    .filter(l => l.status !== 'fechado')
    .reduce((s, l) => s + getLeadValor(l) * (PROB_ETAPA[l.status] ?? 0), 0);
  const fechadosMesValor = all
    .filter(l => l.status === 'fechado' && inRange(l, inicioMesAtual, agora))
    .reduce((s, l) => s + getLeadValor(l), 0);
  const forecastComFechados = fechadosMesValor + forecastTotal;
  const probBaterMeta = metaMensal > 0
    ? Math.min(100, Math.round((forecastComFechados / metaMensal) * 100)) : 0;

  // ── Funil por etapa ───────────────────────────────────────────────────────────
  const ORDEM = ['novo', 'contato', 'proposta', 'negociacao', 'fechado', 'perdido'];
  const ativosParaFunil = all.filter(l => l.status !== 'perdido');
  const totalFunil = ativosParaFunil.length || 1;

  // Tempo médio por etapa via status_changes
  const temposPorEtapa: Record<string, number[]> = {};
  const changesByLead: Record<string, { to: string; at: Date }[]> = {};
  statusChanges.forEach(sc => {
    if (!changesByLead[sc.lead_id]) changesByLead[sc.lead_id] = [];
    const meta = sc.meta_json as { to?: string; at?: string } | null;
    if (meta?.to && meta?.at) {
      changesByLead[sc.lead_id].push({ to: meta.to, at: new Date(meta.at) });
    }
  });

  Object.values(changesByLead).forEach(changes => {
    changes.sort((a, b) => a.at.getTime() - b.at.getTime());
    for (let i = 1; i < changes.length; i++) {
      const etapa = changes[i - 1].to;
      const horas = (changes[i].at.getTime() - changes[i - 1].at.getTime()) / 3_600_000;
      if (!temposPorEtapa[etapa]) temposPorEtapa[etapa] = [];
      temposPorEtapa[etapa].push(horas);
    }
  });

  const etapas: EtapaMetric[] = ORDEM.map((status, idx) => {
    const leadsNaEtapa = all.filter(l => l.status === status);
    const count = leadsNaEtapa.length;
    const valor = leadsNaEtapa.reduce((s, l) => s + getLeadValor(l), 0);
    const prevStatus = idx > 0 ? ORDEM[idx - 1] : null;
    const prevCount = prevStatus ? all.filter(l => l.status === prevStatus).length : totalFunil;
    const pctConversao = prevCount > 0 ? Math.round((count / (count + prevCount || 1)) * 100) : 0;
    const tempos = temposPorEtapa[status] ?? [];
    const tempoMedio = tempos.length >= 2
      ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : null;

    return {
      status, label: LABEL_ETAPA[status], cor: COR_ETAPA[status],
      count, valor,
      pctLeads: Math.round((count / totalFunil) * 100),
      pctConversao,
      forecastPonderado: count * (PROB_ETAPA[status] ?? 0) * (valor / (count || 1)),
      tempoMedioHoras: tempoMedio,
    };
  });

  // ── Histórico mensal (5 meses) ────────────────────────────────────────────────
  const historicMensal: MesMetric[] = [];
  for (let i = 4; i >= 0; i--) {
    const mesDate = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 1);
    const mLeads = all.filter(l => {
      const d = new Date(l.created_at);
      return d >= mesDate && d < fimMes;
    });
    const mFech = mLeads.filter(l => l.status === 'fechado');
    const mRec = mFech.reduce((s, l) => s + getLeadValor(l), 0);
    historicMensal.push({
      label: mesAno(mesDate),
      leads: mLeads.length,
      fechados: mFech.length,
      receita: mRec,
      conversao: mLeads.length > 0 ? Math.round((mFech.length / mLeads.length) * 100) : 0,
    });
  }

  // ── Motivos de perda ──────────────────────────────────────────────────────────
  const perdidos = all.filter(l => l.status === 'perdido' && l.motivo_perda);
  const motivoMap: Record<string, number> = {};
  perdidos.forEach(l => {
    const m = (l.motivo_perda ?? 'Não informado').trim();
    motivoMap[m] = (motivoMap[m] ?? 0) + 1;
  });
  const totalPerdidos = Object.values(motivoMap).reduce((s, v) => s + v, 0) || 1;
  const motivosPerdas = Object.entries(motivoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([motivo, count]) => ({ motivo, count, pct: Math.round((count / totalPerdidos) * 100) }));

  // ── ROI por origem ────────────────────────────────────────────────────────────
  const origMap: Record<string, Lead[]> = {};
  all.forEach(l => {
    const o = l.orig ?? 'Não definido';
    if (!origMap[o]) origMap[o] = [];
    origMap[o].push(l);
  });
  const origROI: OrigemMetric[] = Object.entries(origMap)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([orig, ls]) => {
      const fechs = ls.filter(l => l.status === 'fechado');
      const receita = fechs.reduce((s, l) => s + getLeadValor(l), 0);
      return {
        orig,
        leads: ls.length,
        fechados: fechs.length,
        conversao: Math.round((fechs.length / (ls.length || 1)) * 100),
        ticketMedio: fechs.length > 0 ? Math.round(receita / fechs.length) : 0,
        receita,
      };
    });

  // ── Qualidade de dados ────────────────────────────────────────────────────────
  const campos: { campo: keyof Lead; label: string }[] = [
    { campo: 'nome', label: 'Nome' },
    { campo: 'tel', label: 'Telefone' },
    { campo: 'email', label: 'E-mail' },
    { campo: 'seg', label: 'Segmento' },
    { campo: 'orig', label: 'Origem' },
    { campo: 'obs', label: 'Observação' },
    { campo: 'valor', label: 'Valor' },
  ];
  const total = all.length || 1;
  const qualidade: QualidadeMetric[] = campos.map(({ campo, label }) => {
    const preenchidos = all.filter(l => {
      const v = l[campo];
      return v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== '0';
    }).length;
    return { campo: String(campo), label, preenchidos, pct: Math.round((preenchidos / total) * 100) };
  });

  // ── Alertas ───────────────────────────────────────────────────────────────────
  const hoje = new Date();

  // Leads parados > 7 dias (sem atividade recente)
  const alertasParados: AlertaLead[] = all
    .filter(l => l.status !== 'fechado' && l.status !== 'perdido')
    .map(l => {
      const ultimaAtvStr = ultimaAtividade[l.id] ?? l.created_at;
      const ultima = new Date(ultimaAtvStr);
      const dias = Math.floor((hoje.getTime() - ultima.getTime()) / 86_400_000);
      return { id: l.id, nome: l.nome, status: l.status, diasParado: dias };
    })
    .filter(a => a.diasParado >= 7)
    .sort((a, b) => b.diasParado - a.diasParado)
    .slice(0, 10);

  // Follow-ups vencidos
  const alertasFollowup: AlertaFollowup[] = all
    .filter(l => l.followup && l.status !== 'fechado' && l.status !== 'perdido')
    .map(l => {
      const parts = (l.followup ?? '').split('/').map(Number);
      const fuDate = parts.length >= 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : null;
      const diasAtraso = fuDate ? Math.floor((hoje.getTime() - fuDate.getTime()) / 86_400_000) : 0;
      return { id: l.id, nome: l.nome, followup: l.followup ?? '', diasAtraso };
    })
    .filter(a => a.diasAtraso > 0)
    .sort((a, b) => b.diasAtraso - a.diasAtraso)
    .slice(0, 10);

  // Perdidos sem motivo
  const alertasSemMotivo = all.filter(l => l.status === 'perdido' && !l.motivo_perda).length;

  return {
    leadsNoMes: leadsAtual.length,
    fechadosNoMes: fechAtual.length,
    receitaNoMes: recAtual,
    taxaConversao,
    ticketMedio,
    trendLeads: trend(leadsAtual.length, leadsAnterior.length),
    trendFechados: trend(fechAtual.length, fechAnterior.length),
    trendReceita: trend(recAtual, recAnterior),
    forecastTotal,
    forecastComFechados,
    metaMensal,
    probBaterMeta,
    etapas,
    historicMensal,
    motivosPerdas,
    origROI,
    qualidade,
    alertasParados,
    alertasFollowup,
    alertasSemMotivo,
    totalLeads: all.length,
    loading: false,
    error: null,
  };
}
