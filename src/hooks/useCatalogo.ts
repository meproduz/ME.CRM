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

export function useCatalogo() {
  const { state, dispatch } = useCRM();
  const clienteId = state.currentUser?.cliente_id;

  // ── Produtos ────────────────────────────────────────────────────────────

  const addProduto = useCallback(async () => {
    if (!clienteId) return;
    const { data, error } = await dbQuery(
      { operation: 'insert', table: 'produtos', userId: state.currentUser?.id, clienteId },
      () => supabase.from('produtos')
        .insert({ cliente_id: clienteId, nome: '', valor: 0, ordem: state.produtos.length })
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

  // ── Segmentos ───────────────────────────────────────────────────────────

  const addSegmento = useCallback(async () => {
    if (!clienteId) return;
    const { data, error } = await dbQuery(
      { operation: 'insert', table: 'segmentos', userId: state.currentUser?.id, clienteId },
      () => supabase.from('segmentos')
        .insert({ cliente_id: clienteId, nome: '', ordem: state.segmentos.length })
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

  return { addProduto, updateProduto, removeProduto, addSegmento, updateSegmento, removeSegmento };
}
