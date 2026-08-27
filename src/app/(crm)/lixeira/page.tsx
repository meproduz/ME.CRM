'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCRM } from '@/store/crm-store';
import { useLeads } from '@/hooks/useLeads';
import { supabase } from '@/lib/supabase';
import { fmtR, getLeadValor } from '@/lib/utils';
import type { Lead } from '@/types';

export default function LixeiraPage() {
  const router = useRouter();
  const { state } = useCRM();
  const { restoreLead } = useLeads();
  const [removidos, setRemovidos] = useState<Lead[] | null>(null);
  const [restaurando, setRestaurando] = useState<string | null>(null);

  useEffect(() => {
    if (state.currentUser && state.currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [state.currentUser, router]);

  useEffect(() => {
    if (!state.currentUser?.cliente_id || state.currentUser.role !== 'admin') return;
    supabase.from('leads')
      .select('*')
      .eq('cliente_id', state.currentUser.cliente_id)
      .not('deletado_em', 'is', null)
      .order('deletado_em', { ascending: false })
      .then(({ data }) => setRemovidos((data as Lead[]) ?? []));
  }, [state.currentUser]);

  async function handleRestaurar(lead: Lead) {
    setRestaurando(lead.id);
    const ok = await restoreLead(lead);
    setRestaurando(null);
    if (ok) setRemovidos((prev) => (prev ?? []).filter((l) => l.id !== lead.id));
  }

  if (!state.currentUser || state.currentUser.role !== 'admin') return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div className="page-title">Lixeira</div>
          <div className="page-sub">contatos removidos — recuperáveis a qualquer momento</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {removidos === null ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Carregando…</div>
        ) : removidos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🗑️</div>
            Nenhum contato removido.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {removidos.map((l) => {
              const valor = getLeadValor(l);
              const dataRemocao = l.deletado_em
                ? new Date(l.deletado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—';
              return (
                <div key={l.id} className="urg-row" style={{ cursor: 'default' }}>
                  <div className="urg-av" style={{ background: 'rgba(240,71,71,0.12)', color: 'var(--red)' }}>
                    {l.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="urg-name">{l.nome}</div>
                    <div className="urg-info">
                      Removido em {dataRemocao} por {l.deletado_por_nome ?? 'desconhecido'}
                      {l.seg ? ` · ${l.seg}` : ''}{valor ? ` · ${fmtR(valor)}` : ''}
                    </div>
                  </div>
                  <button className="config-btn" disabled={restaurando === l.id} onClick={() => handleRestaurar(l)}>
                    {restaurando === l.id ? 'Restaurando…' : '↩ Restaurar'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
