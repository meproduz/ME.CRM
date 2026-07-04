'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useCRM } from '@/store/crm-store';
import { fmtR, diasAtras } from '@/lib/utils';
import { VAL } from '@/types';

function getLeadValor(l: any) {
  if (l.valor) return Number(l.valor);
  if (l.int) {
    const key = Object.keys(VAL).find((k) => l.int?.toLowerCase().includes(k.toLowerCase()));
    if (key) return VAL[key];
  }
  return 0;
}

export default function ClientesPage() {
  const { state, dispatch } = useCRM();
  const router = useRouter();

  const clientes = useMemo(() => state.leads.filter((l) => l.status === 'fechado'), [state.leads]);
  const totalVal = clientes.reduce((a, l) => a + getLeadValor(l), 0);

  function openLead(id: string) {
    dispatch({ type: 'SET_ACTIVE_LEAD', payload: id });
    router.push('/pipeline');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-sub">leads que fecharam negócio</div>
        </div>
        <div id="clientes-summary" style={{ fontSize: 12, color: 'var(--text3)' }}>
          {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} · {fmtR(totalVal)} em contratos
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {clientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 12, fontStyle: 'italic', color: 'var(--text3)' }}>
            Nenhum cliente fechado ainda.
          </div>
        ) : (
          <div className="clientes-grid">
            {clientes.map((l) => {
              const val = getLeadValor(l);
              const dias = diasAtras(l.data);
              const waMsg = encodeURIComponent(
                ((state.waTemplates as any)[l.status] || state.waTemplate).replace('{nome}', l.nome)
              );
              return (
                <div key={l.id} className="cliente-card" onClick={() => openLead(l.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div className="cliente-nome">{l.nome}</div>
                    <span style={{ fontSize: 9, fontWeight: 600, background: 'rgba(34,197,94,0.1)', color: 'var(--green)', padding: '2px 7px', borderRadius: 4 }}>ATIVO</span>
                  </div>
                  <div className="cliente-srv">{l.int ? l.int.split(' - ')[0] : l.seg || 'Serviço não definido'}</div>
                  <div className="cliente-meta">
                    <div className="cliente-val">{val ? fmtR(val) : 'Valor não definido'}</div>
                    <div className="cliente-dias">{dias} dias como cliente</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>
                    {l.seg || 'Segmento não definido'} · {l.orig || '—'}
                  </div>
                  {l.tel && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2h3l1.5 3.5-1.5 1c.9 1.8 2.2 3.1 4 4l1-1.5L13.5 10.5v3C6.5 14.5.5 8.5 2 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {l.tel}
                    </div>
                  )}
                  <div className="cliente-footer">
                    {l.tel && (
                      <button className="cliente-wbtn"
                        onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${l.tel!.replace(/\D/g, '')}?text=${waMsg}`, '_blank'); }}>
                        💬 WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
