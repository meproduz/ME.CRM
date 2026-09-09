'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useCRM } from '@/store/crm-store';
import type { Produto, Segmento } from '@/types';
import { setValMap } from '@/types';
import { dbQuery } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Catálogo — Produtos/Serviços e Segmentos configuráveis por cliente ──────
// Fonte real dos dois dropdowns (Interesse/pacote e Segmento) usados ao
// criar/editar um lead, e do valor usado em getLeadValor (via setValMap).
// Antes disso, "Produtos/Serviços" em Configurações só escrevia no
// localStorage — sem nenhum consumidor real no resto do app.

function nextOrdem(items: { ordem?: number }[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((i) => i.ordem ?? 0)) + 1;
}

// Depois de arrastar (framer-motion Reorder já entrega o array na nova
// ordem), reatribui `ordem` = posição no array e devolve só os itens cuja
// ordem de fato mudou — pra não escrever no banco o que ficou igual.
function reorderWithOrdem<T extends { id?: string; ordem?: number }>(
  newOrder: T[]
): { next: T[]; changed: T[] } {
  const changed: T[] = [];
  const next = newOrder.map((item, i) => {
    if (item.ordem === i) return item;
    const updated = { ...item, ordem: i };
    changed.push(updated);
    return updated;
  });
  return { next, changed };
}

export function useCatalogo() {
  const { state, dispatch } = useCRM();
  const clienteId = state.currentUser?.cliente_id;

  // ── Produtos ────────────────────────────────────────────────────────────

  const addProduto = useCallback(async () => {
    if (!clienteId) return;
    const { data, error } = await dbQuery(
      { operation: 'insert', table: 'produtos', userId: state.currentUser?.id, clienteId },
      () => supabase.from('produtos')
        .insert({ cliente_id: clienteId, nome: '', valor: 0, ordem: nextOrdem(state.produtos) })
        .select().single()
    ) as { data: Produto | null; error: unknown };
    if (error || !data) { logger.exception('produtos.add_error', error); return; }
    dispatch({ type: 'SET_PRODUTOS', payload: [...state.produtos, data] });
  }, [clienteId, state.currentUser?.id, state.produtos, dispatch]);

  const updateProduto = useCallback(async (id: string, patch: Partial<Produto>) => {
    const next = state.produtos.map((p) => p.id === id ? { ...p, ...patch } : p);
    dispatch({ type: 'SET_PRODUTOS', payload: next });
    setValMap(next);
    const { error } = await dbQuery(
      { operation: 'update', table: 'produtos', userId: state.currentUser?.id, clienteId },
      () => supabase.from('produtos').update(patch).eq('id', id)
    ) as { error: unknown };
    if (error) logger.exception('produtos.update_error', error, { metadata: { id } });
  }, [state.produtos, state.currentUser?.id, clienteId, dispatch]);

  const removeProduto = useCallback(async (id: string) => {
    const next = state.produtos.filter((p) => p.id !== id);
    dispatch({ type: 'SET_PRODUTOS', payload: next });
    setValMap(next);
    const { error } = await dbQuery(
      { operation: 'delete', table: 'produtos', userId: state.currentUser?.id, clienteId },
      () => supabase.from('produtos').delete().eq('id', id)
    ) as { error: unknown };
    if (error) logger.exception('produtos.remove_error', error, { metadata: { id } });
  }, [state.produtos, state.currentUser?.id, clienteId, dispatch]);

  const reorderProdutos = useCallback(async (newOrder: Produto[]) => {
    const { next, changed } = reorderWithOrdem(newOrder);
    dispatch({ type: 'SET_PRODUTOS', payload: next });
    setValMap(next);
    const results = await Promise.all(
      changed.map((p) => supabase.from('produtos').update({ ordem: p.ordem }).eq('id', p.id))
    );
    const err = results.find((r) => r.error)?.error;
    if (err) logger.exception('produtos.reorder_error', err);
  }, [dispatch]);

  // ── Segmentos ───────────────────────────────────────────────────────────

  const addSegmento = useCallback(async () => {
    if (!clienteId) return;
    const { data, error } = await dbQuery(
      { operation: 'insert', table: 'segmentos', userId: state.currentUser?.id, clienteId },
      () => supabase.from('segmentos')
        .insert({ cliente_id: clienteId, nome: '', ordem: nextOrdem(state.segmentos) })
        .select().single()
    ) as { data: Segmento | null; error: unknown };
    if (error || !data) { logger.exception('segmentos.add_error', error); return; }
    dispatch({ type: 'SET_SEGMENTOS', payload: [...state.segmentos, data] });
  }, [clienteId, state.currentUser?.id, state.segmentos, dispatch]);

  const updateSegmento = useCallback(async (id: string, nome: string) => {
    const next = state.segmentos.map((s) => s.id === id ? { ...s, nome } : s);
    dispatch({ type: 'SET_SEGMENTOS', payload: next });
    const { error } = await dbQuery(
      { operation: 'update', table: 'segmentos', userId: state.currentUser?.id, clienteId },
      () => supabase.from('segmentos').update({ nome }).eq('id', id)
    ) as { error: unknown };
    if (error) logger.exception('segmentos.update_error', error, { metadata: { id } });
  }, [state.segmentos, state.currentUser?.id, clienteId, dispatch]);

  const removeSegmento = useCallback(async (id: string) => {
    const next = state.segmentos.filter((s) => s.id !== id);
    dispatch({ type: 'SET_SEGMENTOS', payload: next });
    const { error } = await dbQuery(
      { operation: 'delete', table: 'segmentos', userId: state.currentUser?.id, clienteId },
      () => supabase.from('segmentos').delete().eq('id', id)
    ) as { error: unknown };
    if (error) logger.exception('segmentos.remove_error', error, { metadata: { id } });
  }, [state.segmentos, state.currentUser?.id, clienteId, dispatch]);

  const reorderSegmentos = useCallback(async (newOrder: Segmento[]) => {
    const { next, changed } = reorderWithOrdem(newOrder);
    dispatch({ type: 'SET_SEGMENTOS', payload: next });
    const results = await Promise.all(
      changed.map((s) => supabase.from('segmentos').update({ ordem: s.ordem }).eq('id', s.id))
    );
    const err = results.find((r) => r.error)?.error;
    if (err) logger.exception('segmentos.reorder_error', err);
  }, [dispatch]);

  return {
    addProduto, updateProduto, removeProduto, reorderProdutos,
    addSegmento, updateSegmento, removeSegmento, reorderSegmentos,
  };
}
