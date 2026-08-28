'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useCRM } from '@/store/crm-store';
import type { Lead, LeadStatus, Oportunidade } from '@/types';
import { hoje, agora } from '@/lib/utils';
import { dbQuery } from '@/lib/db';
import { monitor } from '@/lib/monitor';
import { logger } from '@/lib/logger';

// ── Segurança: whitelist de campos editáveis — Rule #3 ───────────────────────
// Qualquer campo fora desta lista é rejeitado ANTES de chegar ao banco.
const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'nome', 'tel', 'email', 'seg', 'orig', 'int',
  'valor', 'obs', 'status', 'followup', 'score', 'motivo_perda',
]);

// ── Validação de input ────────────────────────────────────────────────────────
const MAX_LENGTHS: Record<string, number> = {
  nome:  120,
  tel:    30,
  email: 180,
  seg:   100,
  orig:  100,
  int:   200,
  obs:  2000,
  motivo_perda: 500,
};

function validateField(field: string, value: unknown): string | null {
  if (!ALLOWED_FIELDS.has(field)) return `Campo '${field}' não permitido`;
  const max = MAX_LENGTHS[field];
  if (max && typeof value === 'string' && value.length > max) {
    return `'${field}' excede ${max} caracteres`;
  }
  return null; // ok
}

const PAGE_SIZE = 50;

export function useLeads() {
  const { state, dispatch } = useCRM();

  // ─── Carregar leads (paginado) ────────────────────────────────────────────

  const loadLeads = useCallback(async (reset = false) => {
    if (!state.currentUser?.cliente_id) return;
    const page = reset ? 0 : state.page;
    if (!reset && !state.hasMore) return;

    // Cache Hit/Miss — Rule #6
    if (!reset && state.leads.length > 0) {
      monitor.cacheHit('leads');
      return;
    }
    monitor.cacheMiss('leads');

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const cid = state.currentUser.cliente_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error, count } = await dbQuery(
        { operation: 'select', table: 'leads', userId: state.currentUser.id, clienteId: cid },
        () => supabase
          .from('leads')
          .select('*', { count: 'exact' })
          .eq('cliente_id', cid)
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      ) as { data: Record<string, unknown>[] | null; error: unknown; count: number | null };
      if (error) throw error;
      let leads: Lead[] = (data ?? []).map((l) => ({
        ...(l as unknown as Lead), hist: [], followup: (l.followup as string | null) ?? null
      }));

      // Pré-carrega o último histórico de cada lead para stale detection precisa
      // sem precisar abrir cada lead individualmente
      if (leads.length > 0) {
        const ids = leads.map((l) => l.id);
        const { data: histData } = await dbQuery(
          { operation: 'select', table: 'leads_historico', userId: state.currentUser.id, clienteId: cid },
          () => supabase
            .from('leads_historico')
            .select('lead_id, descricao')
            .in('lead_id', ids)
            .order('created_at', { ascending: false })
        ) as { data: { lead_id: string; descricao: string }[] | null };
        if (histData) {
          const latestPerLead: Record<string, string> = {};
          for (const h of histData) {
            if (!latestPerLead[h.lead_id]) latestPerLead[h.lead_id] = h.descricao;
          }
          leads = leads.map((l) => ({ ...l, lastContact: latestPerLead[l.id] }));
        }

        // Pré-carrega oportunidades de todos os leads — dashboard/Kanban/gestor
        // precisam somar por oportunidade de TODOS os leads, não só do que
        // estiver aberto no painel, então não dá pra carregar sob demanda.
        const { data: oportData } = await dbQuery(
          { operation: 'select', table: 'oportunidades', userId: state.currentUser.id, clienteId: cid },
          () => supabase
            .from('oportunidades')
            .select('*')
            .in('lead_id', ids)
        ) as { data: Oportunidade[] | null };
        if (oportData) {
          const byLead: Record<string, Oportunidade[]> = {};
          for (const o of oportData) {
            (byLead[o.lead_id] ??= []).push(o);
          }
          leads = leads.map((l) => ({ ...l, oportunidades: byLead[l.id] ?? [] }));
        }
      }

      if (reset) dispatch({ type: 'SET_LEADS', payload: leads });
      else dispatch({ type: 'APPEND_LEADS', payload: leads });
      dispatch({ type: 'SET_PAGINATION', payload: { page: page + 1, hasMore: (data?.length ?? 0) === PAGE_SIZE, totalCount: count ?? 0 } });
    } catch (err) {
      logger.exception('leads.load_error', err, { userId: state.currentUser?.id });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentUser, state.page, state.hasMore, state.leads.length, dispatch]);

  // ─── Carregar histórico lazy ──────────────────────────────────────────────

  const loadHist = useCallback(async (leadId: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead || lead.hist.length > 0) {
      monitor.cacheHit(`hist:${leadId}`);
      return;
    }
    monitor.cacheMiss(`hist:${leadId}`);
    const { data } = await dbQuery(
      { operation: 'select', table: 'leads_historico', userId: state.currentUser?.id, clienteId: lead.cliente_id },
      () => supabase
        .from('leads_historico')
        .select('descricao')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })
    ) as { data: { descricao: string }[] | null };
    const hist = (data ?? []).map((h) => h.descricao);
    // Extrai followup do histórico
    const fus = hist.filter((h) => h.startsWith('📅 Followup:'));
    const lastFu = fus[fus.length - 1];
    const followup = lastFu && !lastFu.includes('cancelado')
      ? lastFu.replace('📅 Followup:', '').trim() : null;
    dispatch({ type: 'UPDATE_LEAD', payload: { ...lead, hist, followup } });
  }, [state.leads, dispatch]);

  // ─── Adicionar nota ────────────────────────────────────────────────────────

  const addNota = useCallback(async (leadId: string, texto: string) => {
    const entry = `📝 ${hoje()} ${agora()} — ${texto}`;
    const now = new Date().toISOString();
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    // Persiste status_changed_at no banco para que isStale funcione corretamente após refresh
    await supabase.from('leads').update({ status_changed_at: now }).eq('id', leadId);
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry, statusChangedAt: now } });
  }, [dispatch]);

  // ─── Mover lead ───────────────────────────────────────────────────────────

  const moveLead = useCallback(async (leadId: string, novoStatus: string, motivo?: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return;
    const now = new Date().toISOString();
    // Salva status + status_changed_at + motivo_perda (se houver) em uma única chamada
    const updatePayload: Record<string, unknown> = { status: novoStatus, status_changed_at: now };
    if (motivo && novoStatus === 'perdido') updatePayload.motivo_perda = motivo;
    await supabase.from('leads').update(updatePayload).eq('id', leadId);

    // Mantém a oportunidade em sincronia com o status do lead — caso comum
    // (0 ou 1 oportunidade aberta) fecha/perde junto, sem precisar abrir o
    // painel. Lead com 2+ abertas não deveria chegar aqui: os call sites
    // (drag do Kanban e StageStepper do painel) bloqueiam antes de chamar
    // moveLead nesse caso, então não mexemos nas oportunidades ali.
    if (novoStatus === 'fechado' || novoStatus === 'perdido') {
      const oportStatus = novoStatus === 'fechado' ? 'fechada' : 'perdida';
      const todasOport = lead.oportunidades ?? [];
      const abertas = todasOport.filter((o) => o.status === 'aberta');
      if (abertas.length === 1) {
        const o = abertas[0];
        const patch: Record<string, unknown> = { status: oportStatus, status_changed_at: now };
        if (motivo && novoStatus === 'perdido') patch.motivo_perda = motivo;
        await supabase.from('oportunidades').update(patch).eq('id', o.id);
        dispatch({ type: 'UPDATE_OPORTUNIDADE', payload: { leadId, oportunidadeId: o.id, patch } });
      } else if (abertas.length === 0 && todasOport.length === 1 && todasOport[0].status !== oportStatus) {
        // Lead com uma única oportunidade já resolvida (ex: 'fechada') sendo
        // reclassificado pro outro desfecho (ex: card movido de Fechado pra
        // Perdido) — resincroniza ela também, senão fica presa no status antigo.
        const o = todasOport[0];
        const patch: Record<string, unknown> = { status: oportStatus, status_changed_at: now };
        if (motivo && novoStatus === 'perdido') patch.motivo_perda = motivo;
        await supabase.from('oportunidades').update(patch).eq('id', o.id);
        dispatch({ type: 'UPDATE_OPORTUNIDADE', payload: { leadId, oportunidadeId: o.id, patch } });
      } else if (abertas.length === 0 && todasOport.length === 0) {
        // Defensivo: lead criado antes do backfill rodar — cria a oportunidade
        // única já no status final, espelhando o valor legado do lead.
        const { data: novaOport } = await supabase.from('oportunidades').insert({
          lead_id: leadId,
          cliente_id: lead.cliente_id,
          valor: lead.valor,
          status: oportStatus,
          motivo_perda: motivo && novoStatus === 'perdido' ? motivo : null,
          criado_por: state.currentUser?.id ?? null,
          status_changed_at: now,
        }).select().single() as { data: Oportunidade | null };
        if (novaOport) dispatch({ type: 'ADD_OPORTUNIDADE', payload: { leadId, oportunidade: novaOport } });
      }
    }

    const LABELS: Record<string, string> = {
      novo: 'Novo', contato: 'Em contato', proposta: 'Proposta',
      negociacao: 'Negociação', fechado: 'Fechado ✅', perdido: 'Perdido',
    };
    const entry = `${hoje()} ${agora()} — Movido para ${LABELS[novoStatus] ?? novoStatus}`;
    // Registro estruturado para métricas do gestor (tipo + meta_json)
    await supabase.from('leads_historico').insert({
      lead_id: leadId,
      descricao: entry,
      tipo: 'status_change',
      meta_json: { from: lead.status, to: novoStatus, at: now },
    });
    if (motivo) {
      const motivoEntry = `📝 ${hoje()} ${agora()} — Motivo de perda: ${motivo}`;
      await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: motivoEntry, tipo: 'anotacao' });
      dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry: motivoEntry } });
    }
    dispatch({ type: 'UPDATE_LEAD', payload: {
      ...lead,
      status: novoStatus as LeadStatus,
      status_changed_at: now,
      ...(motivo && novoStatus === 'perdido' ? { motivo_perda: motivo } : {}),
    }});
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry } });
  }, [state.leads, state.currentUser, dispatch]);

  // ─── Salvar campo do lead — com whitelist de segurança ───────────────────

  const updateField = useCallback(async (leadId: string, field: string, value: unknown) => {
    // Segurança: rejeita campos não autorizados ANTES de qualquer I/O
    const validationError = validateField(field, value);
    if (validationError) {
      logger.warn('leads.update_field.blocked', {
        metadata: { leadId, field, reason: validationError },
        userId: state.currentUser?.id,
      });
      return;
    }

    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return;

    await dbQuery(
      { operation: 'update', table: 'leads', userId: state.currentUser?.id, clienteId: lead.cliente_id },
      () => supabase.from('leads').update({ [field]: value }).eq('id', leadId)
    );
    dispatch({ type: 'UPDATE_LEAD', payload: { ...lead, [field]: value } });

    // Caso comum (1 oportunidade só): editar o valor do lead mantém a
    // oportunidade sincronizada, pra não ter dois lugares divergentes.
    // Lead com 0 ou 2+ oportunidades não mexe aqui — 0 cai no fallback legado
    // (getLeadValor* já leem `lead.valor` direto nesse caso) e 2+ precisa ser
    // editado oportunidade por oportunidade dentro do painel.
    if (field === 'valor') {
      const todasOport = lead.oportunidades ?? [];
      if (todasOport.length === 1) {
        const o = todasOport[0];
        await supabase.from('oportunidades').update({ valor: value }).eq('id', o.id);
        dispatch({ type: 'UPDATE_OPORTUNIDADE', payload: { leadId, oportunidadeId: o.id, patch: { valor: value as number | null } } });
      }
    }
  }, [state.leads, state.currentUser?.id, dispatch]);

  // ─── Criar lead — com validação de todos os campos ───────────────────────

  const createLead = useCallback(async (fields: Omit<Lead, 'id' | 'hist' | 'created_at' | 'data' | 'hora'>) => {
    // Valida todos os campos antes de inserir
    for (const [field, value] of Object.entries(fields)) {
      if (field === 'cliente_id' || field === 'data' || field === 'hora') continue; // campos internos, não valida
      const err = validateField(field, value);
      if (err) {
        logger.warn('leads.create.validation_failed', {
          metadata: { field, reason: err },
          userId: state.currentUser?.id,
        });
        throw new Error(err);
      }
    }

    const { data, error } = await dbQuery(
      { operation: 'insert', table: 'leads', userId: state.currentUser?.id, clienteId: fields.cliente_id },
      () => supabase.from('leads').insert(fields).select().single()
    ) as { data: Lead | null; error: unknown };
    if (error || !data) throw error;

    // Cria a oportunidade única do lead desde já — mantém o caso comum
    // (1 oportunidade) consistente com o backfill dos leads antigos, sem
    // depender do fallback defensivo em moveLead.
    const { data: novaOport, error: oportError } = await supabase.from('oportunidades').insert({
      lead_id: data.id,
      cliente_id: fields.cliente_id,
      valor: fields.valor,
      status: 'aberta',
      criado_por: state.currentUser?.id ?? null,
    }).select().single() as { data: Oportunidade | null; error: unknown };
    if (oportError) {
      logger.exception('oportunidades.create_lead_error', oportError, {
        userId: state.currentUser?.id, metadata: { leadId: data.id },
      });
    }

    const newLead: Lead = { ...data, hist: [], oportunidades: novaOport ? [novaOport] : [] };
    dispatch({ type: 'ADD_LEAD', payload: newLead });
    const entry = `${hoje()} ${agora()} — Lead cadastrado`;
    await supabase.from('leads_historico').insert({ lead_id: data.id, descricao: entry });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId: data.id, entry } });
    return newLead;
  }, [state.currentUser?.id, dispatch]);

  // ─── Deletar lead ─────────────────────────────────────────────────────────

  const deleteLead = useCallback(async (leadId: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    await dbQuery(
      { operation: 'delete', table: 'leads_historico', userId: state.currentUser?.id, clienteId: lead?.cliente_id },
      () => supabase.from('leads_historico').delete().eq('lead_id', leadId)
    );
    await dbQuery(
      { operation: 'delete', table: 'leads', userId: state.currentUser?.id, clienteId: lead?.cliente_id },
      () => supabase.from('leads').delete().eq('id', leadId)
    );
    dispatch({ type: 'REMOVE_LEAD', payload: leadId });
  }, [state.leads, state.currentUser?.id, dispatch]);

  // ─── Follow-up ────────────────────────────────────────────────────────────

  const setFollowup = useCallback(async (leadId: string, data: string | null) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return;
    const entry = data ? `📅 Followup: ${data}` : `📅 Followup: cancelado`;
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry } });
    dispatch({ type: 'UPDATE_LEAD', payload: { ...lead, followup: data } });
  }, [state.leads, dispatch]);

  // ─── Salvar qualificação ICP ─────────────────────────────────────────────

  const saveICP = useCallback(async (leadId: string, score: number, label: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return;
    await supabase.from('leads').update({ icp_score: score, icp_label: label }).eq('id', leadId);
    const entry = `🎯 ${hoje()} ${agora()} — ICP: ${label} (${score}/100)`;
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    dispatch({ type: 'SET_ICP', payload: { leadId, icp_score: score, icp_label: label } });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry } });
  }, [state.leads, dispatch]);

  // ─── Exportar CSV ─────────────────────────────────────────────────────────

  const exportCSV = useCallback(() => {
    const header = 'Nome,Telefone,Segmento,Origem,Interesse,Valor,Status,Entrada\n';
    const rows = state.leads.map((l) =>
      [l.nome, l.tel ?? '', l.seg ?? '', l.orig ?? '', l.int ?? '',
       l.valor ?? '', l.status, `${l.data} ${l.hora}`].map((v) => `"${v}"`).join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads-${hoje().replace('/', '-')}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [state.leads]);

  // ─── Importar CSV ─────────────────────────────────────────────────────────

  const importLeads = useCallback(async (rows: Record<string, string>[]) => {
    if (!state.currentUser?.cliente_id) return 0;
    let count = 0;
    for (const row of rows) {
      try {
        const fields: Omit<Lead, 'id' | 'hist' | 'created_at' | 'data' | 'hora'> = {
          cliente_id: state.currentUser.cliente_id,
          nome: row['Nome'] || row['nome'] || '',
          tel: row['Telefone'] || row['telefone'] || null,
          email: null,
          seg: row['Segmento'] || row['segmento'] || null,
          orig: row['Origem'] || row['origem'] || null,
          int: row['Interesse'] || row['interesse'] || null,
          valor: Number(row['Valor'] || row['valor']) || null,
          obs: row['Observacao'] || row['observacao'] || null,
          status: 'novo',
          followup: null,
          score: null,
          motivo_perda: null,
        };
        if (!fields.nome) continue;
        await createLead(fields);
        count++;
      } catch { /* skip invalid rows */ }
    }
    return count;
  }, [state.currentUser, createLead]);

  return {
    leads: state.leads,
    isLoading: state.isLoading,
    hasMore: state.hasMore,
    totalCount: state.totalCount,
    loadLeads,
    loadHist,
    addNota,
    moveLead,
    updateField,
    createLead,
    deleteLead,
    setFollowup,
    exportCSV,
    importLeads,
    saveICP,
  };
}
