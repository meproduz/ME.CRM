'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCRM } from '@/store/crm-store';
import { fmtR } from '@/lib/utils';
import { KANBAN_COLS, VAL } from '@/types';

function getLeadValor(l: any) {
  if (l.valor) return Number(l.valor);
  if (l.int) {
    const key = Object.keys(VAL).find((k) => l.int?.toLowerCase().includes(k.toLowerCase()));
    if (key) return VAL[key];
  }
  return 0;
}

const STATUS_CLASS: Record<string, string> = {
  novo: 'sp-novo', contato: 'sp-contato', proposta: 'sp-proposta',
  negociacao: 'sp-proposta', fechado: 'sp-fechado', perdido: 'sp-perdido',
};

export default function LeadsPage() {
  const { state, dispatch } = useCRM();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = state.leads.filter((l) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      l.nome.toLowerCase().includes(q) ||
      (l.seg ?? '').toLowerCase().includes(q) ||
      (l.orig ?? '').toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q)
    );
  });

  function openLead(id: string) {
    dispatch({ type: 'SET_ACTIVE_LEAD', payload: id });
    router.push('/pipeline');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div className="page-title">Leads</div>
          <div className="page-sub">{state.leads.length} cadastrados</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {/* Busca */}
        <div className="leads-search">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="#444" strokeWidth="1.4"/>
            <path d="M10 10l3 3" stroke="#444" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="Buscar por nome, segmento, origem ou status..."
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {/* Tabela */}
        <table className="leads-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Segmento</th>
              <th>Origem</th>
              <th>Interesse</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Entrada</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const col = KANBAN_COLS.find((c) => c.id === l.status);
              const valor = getLeadValor(l);
              return (
                <tr key={l.id} onClick={() => openLead(l.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{l.nome}</td>
                  <td>{l.seg || '—'}</td>
                  <td>{l.orig || '—'}</td>
                  <td>{l.int?.split(' - ')[0] || '—'}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 600 }}>
                    {valor ? fmtR(valor) : '—'}
                  </td>
                  <td>
                    <span className={`sp ${STATUS_CLASS[l.status] ?? 'sp-novo'}`}>
                      {col?.label ?? l.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {l.data} {l.hora}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text3)', padding: 32 }}>
                Nenhum lead encontrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
