'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useCRM } from '@/store/crm-store';
import type { Oportunidade } from '@/types';
import { hoje, agora, fmtR } from '@/lib/utils';
import { dbQuery } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Oportunidades — gerencia o(s) item(ns) de venda dentro de um lead ────────
// Mesma forma de hook que useLeads.ts: cada função dona da chamada ao banco
// + do dispatch, usando dbQuery pra logging/timing consistente.

export function useOportunidades() {
  const { state, dispatch } = useCRM();

  // Depois de fechar/perder uma oportunidade, confere se não sobrou nenhuma
  // 'aberta' no lead — se não sobrou, o card não pode continuar preso na
  // etapa antiga (ex: "Negociação") sem valor aberto nenhum. Vira "Fechado"
  // se pelo menos uma oportunidade foi ganha, senão "Perdido".
  const syncLeadStatusSeResolvido = useCallback(async (
    leadId: string, resolvedOportId: string, resolvedStatus: 'fechada' | 'perdida'
  ) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead || lead.status === 'fechado' || lead.status === 'perdido') return;

    const todas = (lead.oportunidades ?? []).map((o) =>
      o.id === resolvedOportId ? { ...o, status: resolvedStatus } : o
    );
    if (todas.some((o) => o.status === 'aberta')) return; // ainda tem oportunidade aberta

    const novoStatus = todas.some((o) => o.status === 'fechada') ? 'fechado' : 'perdido';
    const now = new Date().toISOString();
    const autor = state.currentUser?.nome ?? 'Desconhecido';
    await supabase.from('leads').update({ status: novoStatus, status_changed_at: now }).eq('id', leadId);
    await supabase.from('leads_historico').insert({
      lead_id: leadId,
      descricao: `${hoje()} ${agora()} · ${autor} — Movido para ${novoStatus === 'fechado' ? 'Fechado ✅' : 'Perdido'} (última oportunidade resolvida)`,
      tipo: 'status_change',
      meta_json: { from: lead.status, to: novoStatus, at: now, by: state.currentUser?.id ?? null, by_nome: autor },
    });
    dispatch({ type: 'UPDATE_LEAD', payload: { ...lead, status: novoStatus, status_changed_at: now, oportunidades: todas } });
  }, [state.leads, state.currentUser, dispatch]);

  const addOportunidade = useCallback(async (leadId: string, fields: { nome: string | null; valor: number | null }) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return null;

    const { data, error } = await dbQuery(
      { operation: 'insert', table: 'oportunidades', userId: state.currentUser?.id, clienteId: lead.cliente_id },
      () => supabase.from('oportunidades').insert({
        lead_id: leadId,
        cliente_id: lead.cliente_id,
        nome: fields.nome,
        valor: fields.valor,
        status: 'aberta',
        criado_por: state.currentUser?.id ?? null,
      }).select().single()
    ) as { data: Oportunidade | null; error: unknown };

    if (error || !data) {
      logger.exception('oportunidades.add_error', error, { userId: state.currentUser?.id, metadata: { leadId } });
      alert('Não foi possível adicionar a oportunidade.');
      return null;
    }

    dispatch({ type: 'ADD_OPORTUNIDADE', payload: { leadId, oportunidade: data } });
    const entry = `💼 ${hoje()} ${agora()} · ${state.currentUser?.nome ?? 'Desconhecido'} — Oportunidade adicionada${fields.nome ? `: ${fields.nome}` : ''}${fields.valor ? ` (${fmtR(fields.valor)})` : ''}`;
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry } });
    return data;
  }, [state.leads, state.currentUser, dispatch]);

  const closeOportunidade = useCallback(async (leadId: string, oportunidadeId: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    const oport = lead?.oportunidades?.find((o) => o.id === oportunidadeId);
    const now = new Date().toISOString();
    const patch = { status: 'fechada' as const, status_changed_at: now };

    const { error } = await dbQuery(
      { operation: 'update', table: 'oportunidades', userId: state.currentUser?.id, clienteId: lead?.cliente_id },
      () => supabase.from('oportunidades').update(patch).eq('id', oportunidadeId)
    ) as { error: unknown };

    if (error) {
      logger.exception('oportunidades.close_error', error, { userId: state.currentUser?.id, metadata: { leadId, oportunidadeId } });
      alert('Não foi possível fechar a oportunidade.');
      return;
    }

    dispatch({ type: 'UPDATE_OPORTUNIDADE', payload: { leadId, oportunidadeId, patch } });
    const entry = `✅ ${hoje()} ${agora()} · ${state.currentUser?.nome ?? 'Desconhecido'} — Oportunidade fechada${oport?.nome ? `: ${oport.nome}` : ''}${oport?.valor ? ` (${fmtR(oport.valor)})` : ''}`;
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry } });
    await syncLeadStatusSeResolvido(leadId, oportunidadeId, 'fechada');
  }, [state.leads, state.currentUser, dispatch, syncLeadStatusSeResolvido]);

  const loseOportunidade = useCallback(async (leadId: string, oportunidadeId: string, motivo: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    const oport = lead?.oportunidades?.find((o) => o.id === oportunidadeId);
    const now = new Date().toISOString();
    const patch = { status: 'perdida' as const, status_changed_at: now, motivo_perda: motivo };

    const { error } = await dbQuery(
      { operation: 'update', table: 'oportunidades', userId: state.currentUser?.id, clienteId: lead?.cliente_id },
      () => supabase.from('oportunidades').update(patch).eq('id', oportunidadeId)
    ) as { error: unknown };

    if (error) {
      logger.exception('oportunidades.lose_error', error, { userId: state.currentUser?.id, metadata: { leadId, oportunidadeId } });
      alert('Não foi possível marcar a oportunidade como perdida.');
      return;
    }

    dispatch({ type: 'UPDATE_OPORTUNIDADE', payload: { leadId, oportunidadeId, patch } });
    const entry = `❌ ${hoje()} ${agora()} · ${state.currentUser?.nome ?? 'Desconhecido'} — Oportunidade perdida${oport?.nome ? `: ${oport.nome}` : ''} — Motivo: ${motivo}`;
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry } });
    await syncLeadStatusSeResolvido(leadId, oportunidadeId, 'perdida');
  }, [state.leads, state.currentUser, dispatch, syncLeadStatusSeResolvido]);

  // Reabre uma oportunidade fechada/perdida — cliente voltou atrás, ou clicou
  // no botão errado. Se o lead já tinha virado Fechado/Perdido por causa dela
  // ser a última pendente, volta pra Negociação — não faz sentido continuar
  // "resolvido" com uma oportunidade de novo em aberto.
  const reabrirOportunidade = useCallback(async (leadId: string, oportunidadeId: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    const oport = lead?.oportunidades?.find((o) => o.id === oportunidadeId);
    const now = new Date().toISOString();
    const patch = { status: 'aberta' as const, status_changed_at: now, motivo_perda: null };

    const { error } = await dbQuery(
      { operation: 'update', table: 'oportunidades', userId: state.currentUser?.id, clienteId: lead?.cliente_id },
      () => supabase.from('oportunidades').update(patch).eq('id', oportunidadeId)
    ) as { error: unknown };

    if (error) {
      logger.exception('oportunidades.reopen_error', error, { userId: state.currentUser?.id, metadata: { leadId, oportunidadeId } });
      alert('Não foi possível reabrir a oportunidade.');
      return;
    }

    const autor = state.currentUser?.nome ?? 'Desconhecido';
    dispatch({ type: 'UPDATE_OPORTUNIDADE', payload: { leadId, oportunidadeId, patch } });
    const entry = `↩️ ${hoje()} ${agora()} · ${autor} — Oportunidade reaberta${oport?.nome ? `: ${oport.nome}` : ''}`;
    await supabase.from('leads_historico').insert({ lead_id: leadId, descricao: entry });
    dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry } });

    if (lead && (lead.status === 'fechado' || lead.status === 'perdido')) {
      const leadNow = new Date().toISOString();
      await supabase.from('leads').update({ status: 'negociacao', status_changed_at: leadNow }).eq('id', leadId);
      const leadEntry = `${hoje()} ${agora()} · ${autor} — Movido para Negociação (oportunidade reaberta)`;
      await supabase.from('leads_historico').insert({
        lead_id: leadId, descricao: leadEntry, tipo: 'status_change',
        meta_json: { from: lead.status, to: 'negociacao', at: leadNow, by: state.currentUser?.id ?? null, by_nome: autor },
      });
      // Usa a oportunidade já reaberta (não o `lead` capturado no início da
      // função, que ainda está com o status antigo dela) — senão esse dispatch
      // sobrescreve e desfaz o UPDATE_OPORTUNIDADE de cima.
      const oportunidadesAtualizadas = (lead.oportunidades ?? []).map((o) =>
        o.id === oportunidadeId ? { ...o, ...patch } : o
      );
      dispatch({ type: 'UPDATE_LEAD', payload: { ...lead, status: 'negociacao', status_changed_at: leadNow, oportunidades: oportunidadesAtualizadas } });
      dispatch({ type: 'ADD_HIST_ENTRY', payload: { leadId, entry: leadEntry } });
    }
  }, [state.leads, state.currentUser, dispatch]);

  // Corrige nome/valor digitados errado — não mexe em status, então não
  // registra na timeline (é uma correção, não um evento de negócio).
  const updateOportunidade = useCallback(async (
    leadId: string, oportunidadeId: string, fields: { nome?: string | null; valor?: number | null }
  ) => {
    const lead = state.leads.find((l) => l.id === leadId);

    const { error } = await dbQuery(
      { operation: 'update', table: 'oportunidades', userId: state.currentUser?.id, clienteId: lead?.cliente_id },
      () => supabase.from('oportunidades').update(fields).eq('id', oportunidadeId)
    ) as { error: unknown };

    if (error) {
      logger.exception('oportunidades.update_error', error, { userId: state.currentUser?.id, metadata: { leadId, oportunidadeId } });
      alert('Não foi possível salvar a oportunidade.');
      return;
    }

    dispatch({ type: 'UPDATE_OPORTUNIDADE', payload: { leadId, oportunidadeId, patch: fields } });
  }, [state.leads, state.currentUser?.id, dispatch]);

  const deleteOportunidade = useCallback(async (leadId: string, oportunidadeId: string) => {
    const lead = state.leads.find((l) => l.id === leadId);

    const { error } = await dbQuery(
      { operation: 'delete', table: 'oportunidades', userId: state.currentUser?.id, clienteId: lead?.cliente_id },
      () => supabase.from('oportunidades').delete().eq('id', oportunidadeId)
    ) as { error: unknown };

    if (error) {
      logger.exception('oportunidades.delete_error', error, { userId: state.currentUser?.id, metadata: { leadId, oportunidadeId } });
      alert('Não foi possível remover a oportunidade.');
      return;
    }

    const oportunidades = (lead?.oportunidades ?? []).filter((o) => o.id !== oportunidadeId);
    dispatch({ type: 'SET_OPORTUNIDADES', payload: { leadId, oportunidades } });
  }, [state.leads, state.currentUser?.id, dispatch]);

  return { addOportunidade, closeOportunidade, loseOportunidade, reabrirOportunidade, updateOportunidade, deleteOportunidade };
}
