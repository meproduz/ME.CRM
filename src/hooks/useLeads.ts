'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useCRM } from '@/store/crm-store';
import type { Lead, LeadStatus } from '@/types';
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
          .is('deletado_em', null)
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
    // followup vem direto da coluna `leads.followup` (carregada no loadLeads e
    // mantida via setFollowup) — não precisa (e não deve) ser reconstruído a
    // partir do texto do histórico, que é só o registro/auditoria da mudança.
    dispatch({ type: 'UPDATE_LEAD', payload: { ...lead, hist } });
  }, [state.leads, dispatch]);

  // ─── Adicionar nota ────────────────────────────────────────────────────────

  const addNota = useCallback(async (leadId: string, texto: string) => {
    const entry = `📝 ${hoje()} ${agora()} — ${texto}`;
    const now = new Date().toISOString();
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    // Persiste status_changed_at no banco para que isStale funcione corretamente após refresh
    const { error } = await supabase.from('leads').update({ status_changed_at: now }).eq('id', leadId);
    if (error) logger.exception('leads.status_changed_at_error', error, { metadata: { leadId } });
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
    const { error: moveError } = await supabase.from('leads').update(updatePayload).eq('id', leadId);
    if (moveError) {
      logger.exception('leads.move_error', moveError, { userId: state.currentUser?.id, metadata: { leadId, novoStatus } });
      alert(`Não foi possível mover o lead: ${moveError.message}`);
      return; // não atualiza o estado local — evita mostrar como "salvo" algo que o banco recusou
    }
    const LABELS: Record<string, string> = {
      novo: 'Novo', contato: 'Em contato', proposta: 'Proposta',
      negociacao: 'Negociação', fechado: 'Fechado ✅', perdido: 'Perdido',
    };
    const entry = `${hoje()} ${agora()} — Movido para ${LABELS[novoStatus] ?? novoStatus}`;
    // Registro estruturado para métricas do gestor (tipo + meta_json) — não bloqueia
    // a movimentação principal se falhar, mas registra pra não sumir em silêncio.
    // Requer migration: leads_historico.tipo / leads_historico.meta_json (ver
    // supabase-migration-lixeira-autoria.sql).
    const { error: histError } = await supabase.from('leads_historico').insert({
      lead_id: leadId,
      descricao: entry,
      tipo: 'status_change',
      meta_json: { from: lead.status, to: novoStatus, at: now },
    });
    if (histError) logger.exception('leads.status_history_error', histError, { metadata: { leadId, novoStatus } });
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
  }, [state.leads, dispatch]);

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

    // criado_por/criado_por_nome não passam pelo whitelist acima de propósito —
    // são sempre definidos aqui a partir da sessão autenticada, nunca a partir
    // de input arbitrário do formulário (evita spoofing de autoria).
    // Requer migration: leads.criado_por / leads.criado_por_nome (ver
    // supabase-migration-lixeira-autoria.sql).
    const payload = {
      ...fields,
      criado_por: state.currentUser?.id ?? null,
      criado_por_nome: state.currentUser?.nome ?? null,
    };

    const { data, error } = await dbQuery(
      { operation: 'insert', table: 'leads', userId: state.currentUser?.id, clienteId: fields.cliente_id },
      () => supabase.from('leads').insert(payload).select().single()
    ) as { data: Lead | null; error: unknown };
    if (error || !data) throw error;
    const newLead: Lead = { ...data, hist: [] };
    dispatch({ type: 'ADD_LEAD', payload: newLead });
    const entry = `${hoje()} ${agora()} — Lead cadastrado`;
    await supabase.from('leads_historico').insert({ lead_id: data.id, descricao: entry });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId: data.id, entry } });
    return newLead;
  }, [state.currentUser?.id, state.currentUser?.nome, dispatch]);

  // ─── Deletar lead (soft delete — vai pra Lixeira, não apaga de verdade) ────
  // Requer migration: leads.deletado_em / leads.deletado_por_nome (ver
  // supabase-migration-lixeira-autoria.sql).

  const deleteLead = useCallback(async (leadId: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    const { error } = await dbQuery(
      { operation: 'update', table: 'leads', userId: state.currentUser?.id, clienteId: lead?.cliente_id },
      () => supabase.from('leads').update({
        deletado_em: new Date().toISOString(),
        deletado_por_nome: state.currentUser?.nome ?? null,
      }).eq('id', leadId)
    ) as { error: unknown };
    if (error) {
      logger.exception('leads.delete_error', error, { userId: state.currentUser?.id, metadata: { leadId } });
      alert('Não foi possível remover o lead. Tente novamente.');
      return;
    }
    dispatch({ type: 'REMOVE_LEAD', payload: leadId });
  }, [state.leads, state.currentUser?.id, state.currentUser?.nome, dispatch]);

  // ─── Restaurar lead da lixeira ──────────────────────────────────────────────

  const restoreLead = useCallback(async (lead: Lead): Promise<boolean> => {
    const { data, error } = await supabase.from('leads')
      .update({ deletado_em: null, deletado_por_nome: null })
      .eq('id', lead.id)
      .select()
      .single();
    if (error || !data) {
      logger.exception('leads.restore_error', error, { userId: state.currentUser?.id, metadata: { leadId: lead.id } });
      alert('Não foi possível restaurar o lead.');
      return false;
    }
    dispatch({ type: 'ADD_LEAD', payload: { ...(data as Lead), hist: [] } });
    return true;
  }, [state.currentUser?.id, dispatch]);

  // ─── Follow-up ────────────────────────────────────────────────────────────

  const setFollowup = useCallback(async (leadId: string, data: string | null) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return;
    // Persiste na coluna de verdade — é a fonte oficial do dado, lida direto
    // por loadLeads. O log abaixo é só o registro histórico da mudança.
    const { error } = await supabase.from('leads').update({ followup: data }).eq('id', leadId);
    if (error) {
      logger.exception('leads.followup_error', error, { userId: state.currentUser?.id, metadata: { leadId } });
      alert(`Não foi possível salvar o follow-up: ${error.message}`);
      return;
    }
    const entry = data ? `📅 Followup: ${data}` : `📅 Followup: cancelado`;
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry } });
    dispatch({ type: 'UPDATE_LEAD', payload: { ...lead, followup: data } });
  }, [state.leads, state.currentUser?.id, dispatch]);

  // ─── Salvar qualificação ICP ─────────────────────────────────────────────

  const saveICP = useCallback(async (leadId: string, score: number, label: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return;
    const { error } = await supabase.from('leads').update({ icp_score: score, icp_label: label }).eq('id', leadId);
    if (error) {
      logger.exception('leads.icp_error', error, { userId: state.currentUser?.id, metadata: { leadId } });
      alert(`Não foi possível salvar a qualificação: ${error.message}`);
      return;
    }
    const entry = `🎯 ${hoje()} ${agora()} — ICP: ${label} (${score}/100)`;
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    dispatch({ type: 'SET_ICP', payload: { leadId, icp_score: score, icp_label: label } });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry } });
  }, [state.leads, state.currentUser?.id, dispatch]);

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
    restoreLead,
    setFollowup,
    exportCSV,
    importLeads,
    saveICP,
  };
}
