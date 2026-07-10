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
import { getLeadValor } from '@/lib/utils';
export { getLeadValor } from '@/lib/utils';

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
  pctLeads: number;
  pctConversao: number;
  forecastPonderado: number;
  tempoMedioHoras: number | null;
  diasMedioNaEtapa: number | null; // média de dias que leads ativos estão nesta etapa
}

export interface MesMetric {
  mes: string;
  leads: number;
  fechados: number;
  receita: number;
  conversao: number;
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

export interface MotivoLead {
  id: string;
  nome: string;
  tel: string | null;
  orig: string | null;
  seg: string | null;
  valor: number;
  dataPerdido: string; // data em que foi marcado como perdido
}

export interface GestorMetrics {
  leadsNoMes: number;
  fechadosNoMes: number;
  receitaNoMes: number;
  taxaConversao: number;
  ticketMedio: number;
  trendLeads: number;
  trendFechados: number;
  trendReceita: number;
  forecast: number;
  forecastComFechados: number;
  metaMensal: number;
  probBaterMeta: number;
  tempoMedioHoras: number | null;
  etapas: EtapaMetric[];
  historicMensal: MesMetric[];
  motivosPerdas: { motivo: string; count: number; pct: number }[];
  origROI: OrigemMetric[];
  qualidade: QualidadeMetric[];
  alertasParados: AlertaLead[];
  alertasFollowup: AlertaFollowup[];
  alertasSemMotivo: number;
  leadsByMotivo: Record<string, MotivoLead[]>;
  totalLeads: number;
  loading: boolean;
  error: string | null;
}

const EMPTY: GestorMetrics = {
  leadsNoMes: 0, fechadosNoMes: 0, receitaNoMes: 0,
  taxaConversao: 0, ticketMedio: 0,
  trendLeads: 0, trendFechados: 0, trendReceita: 0,
  forecast: 0, forecastComFechados: 0, metaMensal: 0, probBaterMeta: 0,
  tempoMedioHoras: null,
  etapas: [], historicMensal: [], motivosPerdas: [],
  origROI: [], qualidade: [],
  alertasParados: [], alertasFollowup: [], alertasSemMotivo: 0,
  leadsByMotivo: {},
  totalLeads: 0, loading: true, error: null,
};

// ── Hook principal ─────────────────────────────────────────────────────────────
export function useGestorMetrics(): GestorMetrics {
  const { state } = useCRM();
  const [metrics, setMetrics] = useState<GestorMetrics>(EMPTY);

  useEffect(() => {
    // Dupla verificação: role admin obrigatório (defesa em profundidade além do redirect na página)
    if (!state.currentUser?.cliente_id) return;
    if (state.currentUser.role !== 'admin') return;
    compute(state.currentUser.cliente_id, state.metaMensal);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentUser?.cliente_id, state.currentUser?.role, state.metaMensal]);

  async function compute(clienteId: string, metaMensal: number) {
    setMetrics(m => ({ ...m, loading: true, error: null }));
    try {
      // 1. Todos os leads do cliente
      const { data: leads, error: leadsErr } = await supabase
        .from('leads')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      if (leadsErr) throw leadsErr;
      const all = (leads ?? []) as Lead[];
      const allIds = all.map(l => l.id);

      // 2. Última atividade por lead (para alertas de leads parados)
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

        (histData ?? []).forEach((h: { lead_id: string; created_at: string }) => {
          if (!ultimaAtividade[h.lead_id]) ultimaAtividade[h.lead_id] = h.created_at;
        });
      }

      // 3. Status changes estruturados (tipo='status_change') — para tempo por etapa e datas reais de fechamento
      let statusChanges: { lead_id: string; meta_json: unknown; created_at: string }[] = [];
      if (allIds.length > 0) {
        const { data: sc } = await supabase
          .from('leads_historico')
          .select('lead_id, meta_json, created_at')
          .eq('tipo', 'status_change')
          .in('lead_id', allIds)
          .order('created_at', { ascending: true });
        statusChanges = sc ?? [];
      }

      // 4. Motivos de perda do histórico (texto) — captura histórico anterior à migration
      const perdidosIds = all.filter(l => l.status === 'perdido').map(l => l.id);
      let motivosHistorico: { lead_id: string; descricao: string }[] = [];
      if (perdidosIds.length > 0) {
        const { data: mh } = await supabase
          .from('leads_historico')
          .select('lead_id, descricao')
          .in('lead_id', perdidosIds)
          .like('descricao', '%Motivo de perda:%');
        motivosHistorico = mh ?? [];
      }

      setMetrics(buildMetrics(all, metaMensal, ultimaAtividade, statusChanges, motivosHistorico));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar métricas';
      setMetrics(m => ({ ...m, loading: false, error: msg }));
    }
  }

  return metrics;
}

// ── buildMetrics ───────────────────────────────────────────────────────────────
function buildMetrics(
  all: Lead[],
  metaMensal: number,
  ultimaAtividade: Record<string, string>,
  statusChanges: { lead_id: string; meta_json: unknown; created_at: string }[],
  motivosHistorico: { lead_id: string; descricao: string }[],
): GestorMetrics {
  const agora = new Date();
  const inicioMesAtual = startOfMonth(agora);
  const inicioMesAnterior = startOfMonth(new Date(agora.getFullYear(), agora.getMonth() - 1, 1));

  // ── Mapa de datas reais de fechamento ─────────────────────────────────────────
  // Prioridade: 1) status_change historico com to='fechado', 2) status_changed_at, 3) created_at
  const closeDateMap: Record<string, Date> = {};
  statusChanges.forEach(sc => {
    const meta = sc.meta_json as { to?: string; at?: string } | null;
    if (meta?.to === 'fechado' && meta?.at) {
      const d = new Date(meta.at);
      if (!closeDateMap[sc.lead_id] || d > closeDateMap[sc.lead_id]) {
        closeDateMap[sc.lead_id] = d;
      }
    }
  });
  all.filter(l => l.status === 'fechado').forEach(l => {
    if (!closeDateMap[l.id]) {
      if (l.status_changed_at) closeDateMap[l.id] = new Date(l.status_changed_at);
      else closeDateMap[l.id] = new Date(l.created_at); // fallback
    }
  });

  function inRange(d: Date, from: Date, to: Date) { return d >= from && d < to; }

  // ── KPIs mês atual — usa data REAL de fechamento ──────────────────────────────
  const leadsAtual   = all.filter(l => inRange(new Date(l.created_at), inicioMesAtual, agora));
  const leadsAnterior = all.filter(l => inRange(new Date(l.created_at), inicioMesAnterior, inicioMesAtual));

  const fechAtual = all.filter(l => {
    if (l.status !== 'fechado') return false;
    const cd = closeDateMap[l.id];
    return cd && inRange(cd, inicioMesAtual, agora);
  });
  const fechAnterior = all.filter(l => {
    if (l.status !== 'fechado') return false;
    const cd = closeDateMap[l.id];
    return cd && inRange(cd, inicioMesAnterior, inicioMesAtual);
  });

  const recAtual   = fechAtual.reduce((s, l) => s + getLeadValor(l), 0);
  const recAnterior = fechAnterior.reduce((s, l) => s + getLeadValor(l), 0);

  function trend(a: number, b: number) {
    if (b === 0) return a > 0 ? 100 : 0;
    return Math.round(((a - b) / b) * 100);
  }

  const taxaConversao = leadsAtual.length > 0
    ? Math.round((fechAtual.length / leadsAtual.length) * 100) : 0;
  const ticketMedio = fechAtual.length > 0 ? Math.round(recAtual / fechAtual.length) : 0;

  // ── Forecast ──────────────────────────────────────────────────────────────────
  const forecast = all
    .filter(l => l.status !== 'perdido' && l.status !== 'fechado')
    .reduce((s, l) => s + getLeadValor(l) * (PROB_ETAPA[l.status] ?? 0), 0);
  const forecastComFechados = recAtual + forecast;
  const probBaterMeta = metaMensal > 0
    ? Math.min(100, Math.round((forecastComFechados / metaMensal) * 100)) : 0;

  // ── Funil por etapa ───────────────────────────────────────────────────────────
  const ORDEM = ['novo', 'contato', 'proposta', 'negociacao', 'fechado', 'perdido'];
  const totalFunil = all.filter(l => l.status !== 'perdido').length || 1;

  // Tempo médio por etapa via status_changes
  const temposPorEtapa: Record<string, number[]> = {};
  const changesByLead: Record<string, { to: string; at: Date }[]> = {};
  statusChanges.forEach(sc => {
    const meta = sc.meta_json as { to?: string; at?: string } | null;
    if (meta?.to && meta?.at) {
      if (!changesByLead[sc.lead_id]) changesByLead[sc.lead_id] = [];
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
    const prevCount = idx > 0 ? all.filter(l => l.status === ORDEM[idx - 1]).length : totalFunil;
    const pctConversao = prevCount > 0 ? Math.round((count / (count + prevCount || 1)) * 100) : 0;
    const tempos = temposPorEtapa[status] ?? [];
    const tempoMedio = tempos.length >= 1
      ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : null;

    // Média de dias que os leads ATIVOS estão nesta etapa agora (usa status_changed_at)
    let diasMedioNaEtapa: number | null = null;
    if (status !== 'fechado' && status !== 'perdido' && leadsNaEtapa.length > 0) {
      const diasArr = leadsNaEtapa.map(l => {
        const ref = l.status_changed_at ?? l.created_at;
        return Math.floor((agora.getTime() - new Date(ref).getTime()) / 86_400_000);
      });
      diasMedioNaEtapa = Math.round(diasArr.reduce((s, d) => s + d, 0) / diasArr.length);
    }

    return {
      status, label: LABEL_ETAPA[status], cor: COR_ETAPA[status],
      count, valor,
      pctLeads: Math.round((count / totalFunil) * 100),
      pctConversao,
      forecastPonderado: count * (PROB_ETAPA[status] ?? 0) * (valor / (count || 1)),
      tempoMedioHoras: tempoMedio,
      diasMedioNaEtapa,
    };
  });

  // Tempo médio global (todas as etapas com dados)
  const todosTempos = Object.values(temposPorEtapa).flat();
  const tempoMedioHoras = todosTempos.length >= 1
    ? Math.round(todosTempos.reduce((s, t) => s + t, 0) / todosTempos.length) : null;

  // ── Histórico mensal (5 meses) — usa data REAL de fechamento ─────────────────
  const historicMensal: MesMetric[] = [];
  for (let i = 4; i >= 0; i--) {
    const mesDate = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const fimMes  = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 1);

    const mLeads = all.filter(l => {
      const d = new Date(l.created_at);
      return d >= mesDate && d < fimMes;
    });
    const mFech = all.filter(l => {
      if (l.status !== 'fechado') return false;
      const cd = closeDateMap[l.id];
      return cd && cd >= mesDate && cd < fimMes;
    });
    const mRec = mFech.reduce((s, l) => s + getLeadValor(l), 0);

    historicMensal.push({
      mes: mesAno(mesDate),
      leads: mLeads.length,
      fechados: mFech.length,
      receita: mRec,
      conversao: mLeads.length > 0 ? Math.round((mFech.length / mLeads.length) * 100) : 0,
    });
  }

  // ── Motivos de perda ──────────────────────────────────────────────────────────
  // Mapa motivo → contagem E mapa motivo → leads (para drill-down)
  const motivoMap: Record<string, number> = {};
  const leadsByMotivo: Record<string, MotivoLead[]> = {};

  function addLeadToMotivo(motivo: string, lead: Lead) {
    const m = motivo.trim();
    motivoMap[m] = (motivoMap[m] ?? 0) + 1;
    if (!leadsByMotivo[m]) leadsByMotivo[m] = [];
    // Evita duplicatas
    if (!leadsByMotivo[m].some(x => x.id === lead.id)) {
      leadsByMotivo[m].push({
        id: lead.id,
        nome: lead.nome,
        tel: lead.tel,
        orig: lead.orig,
        seg: lead.seg,
        valor: getLeadValor(lead),
        dataPerdido: lead.status_changed_at
          ? new Date(lead.status_changed_at).toLocaleDateString('pt-BR')
          : lead.data ?? '',
      });
    }
  }

  // 1. Motivos salvos diretamente na coluna (via fix do moveLead)
  all.filter(l => l.status === 'perdido' && l.motivo_perda).forEach(l => {
    addLeadToMotivo(l.motivo_perda!, l);
  });

  // 2. Motivos históricos (leads perdidos SEM motivo_perda na coluna)
  const leadsSemMotivo = new Set(
    all.filter(l => l.status === 'perdido' && !l.motivo_perda).map(l => l.id)
  );
  const leadById = Object.fromEntries(all.map(l => [l.id, l]));
  motivosHistorico
    .filter(h => leadsSemMotivo.has(h.lead_id))
    .forEach(h => {
      const match = h.descricao.match(/Motivo de perda:\s*(.+)/i);
      if (match?.[1] && leadById[h.lead_id]) {
        addLeadToMotivo(match[1], leadById[h.lead_id]);
      }
    });

  const totalMotivos = Object.values(motivoMap).reduce((s, v) => s + v, 0) || 1;
  const motivosPerdas = Object.entries(motivoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([motivo, count]) => ({ motivo, count, pct: Math.round((count / totalMotivos) * 100) }));

  // ── ROI por origem ────────────────────────────────────────────────────────────
  const origMap: Record<string, Lead[]> = {};
  all.forEach(l => {
    const o = (l.orig ?? 'Não definido').trim() || 'Não definido';
    if (!origMap[o]) origMap[o] = [];
    origMap[o].push(l);
  });
  const origROI: OrigemMetric[] = Object.entries(origMap)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8)
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
    { campo: 'nome',  label: 'Nome' },
    { campo: 'tel',   label: 'Telefone' },
    { campo: 'email', label: 'E-mail' },
    { campo: 'seg',   label: 'Segmento' },
    { campo: 'orig',  label: 'Origem' },
    { campo: 'valor', label: 'Valor' },
    { campo: 'obs',   label: 'Observação' },
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

  // Alertas: tempo na etapa atual — usa status_changed_at (não atividade/nota)
  const alertasParados: AlertaLead[] = all
    .filter(l => l.status !== 'fechado' && l.status !== 'perdido')
    .map(l => {
      const ref = l.status_changed_at ?? l.created_at;
      const dias = Math.floor((hoje.getTime() - new Date(ref).getTime()) / 86_400_000);
      return { id: l.id, nome: l.nome, status: l.status, diasParado: dias };
    })
    .filter(a => a.diasParado >= 7)
    .sort((a, b) => b.diasParado - a.diasParado)
    .slice(0, 10);

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

  const alertasSemMotivo = all.filter(l =>
    l.status === 'perdido' && !l.motivo_perda &&
    !motivosHistorico.some(h => h.lead_id === l.id)
  ).length;

  return {
    leadsNoMes: leadsAtual.length,
    fechadosNoMes: fechAtual.length,
    receitaNoMes: recAtual,
    taxaConversao,
    ticketMedio,
    trendLeads: trend(leadsAtual.length, leadsAnterior.length),
    trendFechados: trend(fechAtual.length, fechAnterior.length),
    trendReceita: trend(recAtual, recAnterior),
    forecast,
    forecastComFechados,
    metaMensal,
    probBaterMeta,
    tempoMedioHoras,
    etapas,
    historicMensal,
    motivosPerdas,
    origROI,
    qualidade,
    alertasParados,
    alertasFollowup,
    alertasSemMotivo,
    leadsByMotivo,
    totalLeads: all.length,
    loading: false,
    error: null,
  };
}
