'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCRM } from '@/store/crm-store';
import { useLeads } from '@/hooks/useLeads';
import { fmtR, isStale, diasAtras, ultimoContato, fmtData, leadData, leadHora, getLeadValor } from '@/lib/utils';
import { KANBAN_COLS, VAL, ORIG_COLORS, type Lead, type LeadStatus } from '@/types';
import LeadPanel from '@/components/LeadPanel';
import NovoLeadModal from '@/components/NovoLeadModal';

export default function PipelinePage() {
  const { state, dispatch, getFilteredLeads } = useCRM();
  const { loadLeads, moveLead, hasMore, isLoading } = useLeads();
  const [showNovo, setShowNovo] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showPerda, setShowPerda] = useState(false);
  const [perdaData, setPerdaData] = useState<{ id: string } | null>(null);
  const [perdaMotivo, setPerdaMotivo] = useState('');
  const [perdaObs, setPerdaObs] = useState('');

  useEffect(() => {
    if (state.leads.length === 0 && !isLoading) loadLeads(true);
  }, []);

  const fl = getFilteredLeads();
  const segs = ['Todos', ...Array.from(new Set(state.leads.map((l) => l.seg).filter(Boolean) as string[]))];
  const activeLead = state.leads.find((l) => l.id === state.activeLeadId) ?? null;

  // Leads parados ordenados do mais crítico para o menos crítico
  const staleLeads = state.leads
    .filter((l) => isStale(l.hist, leadData(l), l.status, l.status_changed_at, l.lastContact))
    .map((l) => ({ lead: l, dias: diasAtras(ultimoContato(l.hist, leadData(l), l.lastContact)) }))
    .sort((a, b) => b.dias - a.dias);

  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  async function handleDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    if (!dragId) return;
    const lead = state.leads.find((l) => l.id === dragId);
    if (!lead || lead.status === status) { setDragId(null); setDragOver(null); return; }
    if (status === 'perdido') {
      setPerdaData({ id: dragId });
      setShowPerda(true);
    } else {
      await moveLead(dragId, status);
    }
    setDragId(null); setDragOver(null);
  }

  async function confirmarPerda() {
    if (!perdaData) return;
    const motivo = perdaMotivo || 'Não informado';
    await moveLead(perdaData.id, 'perdido', perdaObs ? `${motivo} — ${perdaObs}` : motivo);
    setShowPerda(false); setPerdaData(null); setPerdaMotivo(''); setPerdaObs('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="page-title">Pipeline <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>{fl.length} leads</span></div>
          <div className="page-sub">Kanban · Pipeline</div>
        </div>
        <div className="topbar-right">
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="#444" strokeWidth="1.4"/><path d="M10 10l3 3" stroke="#444" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <input type="text" placeholder="Buscar lead..." value={state.searchQuery}
              onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })} />
          </div>
          <button className="add-btn" onClick={() => setShowNovo(true)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <span className="btn-text">Novo Lead</span>
          </button>
        </div>
      </div>

      {/* Segment pills */}
      <div className="filters-bar" style={{ padding: '8px 28px', background: 'var(--bg1)', borderBottom: '1px solid var(--border)' }}>
        <div className="filters">
          {segs.map((s) => (
            <button key={s} className={`f-pill${state.activeSeg === s ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_SEG', payload: s })}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Alerta: leads parados */}
      {staleLeads.length > 0 && (
        <div style={{
          padding: '7px 28px',
          background: 'rgba(240,71,71,0.05)',
          borderBottom: '1px solid rgba(240,71,71,0.14)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          {/* Ícone + contagem */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--red)',
              display: 'inline-block', animation: 'blink 1.2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: '-0.1px' }}>
              {staleLeads.length} lead{staleLeads.length > 1 ? 's' : ''} parado{staleLeads.length > 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 2 }}>— adicione uma nota para resolver</span>
          </div>
          {/* Chips clicáveis por lead */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {staleLeads.map(({ lead: l, dias }) => (
              <button key={l.id}
                onClick={() => dispatch({ type: 'SET_ACTIVE_LEAD', payload: l.id })}
                style={{
                  fontSize: 10, fontWeight: 600,
                  color: dias >= 5 ? '#ff3b3b' : 'var(--red)',
                  background: dias >= 5 ? 'rgba(240,71,71,0.14)' : 'rgba(240,71,71,0.07)',
                  border: '1px solid rgba(240,71,71,0.22)',
                  borderRadius: 5, padding: '2px 9px',
                  cursor: 'pointer', transition: 'background 0.15s',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                {l.nome}
                <span style={{ opacity: 0.65, fontWeight: 500 }}>{dias}d</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Board */}
      <div className="board-outer" style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '16px 28px' }}>
        <div className="board" style={{ gridTemplateColumns: `repeat(${KANBAN_COLS.length}, minmax(0,1fr))`, minWidth: 900 }}>
          {KANBAN_COLS.map((col) => {
            const colLeads = fl.filter((l) => l.status === col.id);
            const money = colLeads.reduce((a, l) => a + getLeadValor(l), 0);
            const isOver = dragOver === col.id;

            return (
              <div key={col.id} className={`col${isOver ? ' drag-over-col' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => handleDrop(e, col.id as LeadStatus)}>

                <div className="col-head">
                  <div className="col-name" style={{ color: col.color }}>{col.label}</div>
                  <div className="col-count">{colLeads.length}</div>
                </div>

                {money > 0 && (
                  <div className={`col-money${col.id === 'fechado' ? ' g' : ''}`}>
                    {col.id === 'fechado' ? 'MRR ' : ''}{fmtR(money)}
                  </div>
                )}

                <div className="col-cards">
                  <AnimatePresence>
                    {colLeads.map((lead) => (
                      <KanbanCard key={lead.id} lead={lead} isDragging={dragId === lead.id}
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => dispatch({ type: 'SET_ACTIVE_LEAD', payload: lead.id })} />
                    ))}
                  </AnimatePresence>

                  {colLeads.length === 0 && (
                    <div className="empty-col" style={isOver ? { color: col.color } : {}}>
                      {isOver ? 'Soltar aqui' : 'nenhum lead'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <button className="add-btn" style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border2)' }}
              onClick={() => loadLeads(false)} disabled={isLoading}>
              {isLoading ? 'Carregando...' : `Carregar mais (${state.totalCount - state.leads.length} restantes)`}
            </button>
          </div>
        )}
      </div>

      {/* Painel */}
      <AnimatePresence>
        {activeLead && (
          <LeadPanel lead={activeLead} onClose={() => dispatch({ type: 'SET_ACTIVE_LEAD', payload: null })} />
        )}
      </AnimatePresence>

      {/* Modal novo lead */}
      <AnimatePresence>{showNovo && <NovoLeadModal onClose={() => setShowNovo(false)} />}</AnimatePresence>

      {/* Modal perda */}
      <AnimatePresence>
        {showPerda && (
          <motion.div className="modal-overlay" style={{ display: 'flex' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowPerda(false)}>
            <motion.div className="modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}>
              <h3>Motivo de perda</h3>
              <div className="mf"><label>Motivo</label>
                <select value={perdaMotivo} onChange={(e) => setPerdaMotivo(e.target.value)}>
                  <option value="">Selecione</option>
                  <option>Sem orçamento</option><option>Escolheu concorrente</option>
                  <option>Não respondeu</option><option>Proposta rejeitada</option>
                  <option>Timing ruim</option><option>Problema interno</option><option>Outro</option>
                </select>
              </div>
              <div className="mf"><label>Observação (opcional)</label>
                <textarea value={perdaObs} onChange={(e) => setPerdaObs(e.target.value)} placeholder="Detalhes..." />
              </div>
              <div className="mfooter">
                <button className="mcbtn" onClick={() => setShowPerda(false)}>Cancelar</button>
                <button className="msbtn" style={{ background: 'var(--red)', color: '#fff' }} onClick={confirmarPerda}>Registrar perda</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCard({ lead, isDragging, onDragStart, onClick }: {
  lead: Lead; isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void; onClick: () => void;
}) {
  const ld = leadData(lead);
  const stale = isStale(lead.hist, ld, lead.status, lead.status_changed_at, lead.lastContact);
  const valor = getLeadValor(lead);
  const origColor = ORIG_COLORS[lead.orig ?? ''] ?? '#555';
  const isClosed = lead.status === 'fechado';
  const fuNow = lead.followup && new Date(lead.followup + 'T00:00:00') <= new Date();
  const fuOk = lead.followup && !fuNow;
  const diasP = stale ? diasAtras(ultimoContato(lead.hist, ld, lead.lastContact)) : 0;

  return (
    <motion.div
      layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: isDragging ? 0.3 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
      className={`card${stale ? ' stale' : ''}${isClosed ? ' closed' : ''}`}
      draggable="true"
      onDragStart={onDragStart as any}
      onClick={onClick}
    >
      <div className="card-name">{lead.nome}</div>
      <div className="card-seg">{lead.seg || 'Não definido'}</div>
      <div className="card-time">{ld}<span> {leadHora(lead)}</span></div>

      {stale && (
        <div className="stale-badge">
          <span className="stale-dot" />{diasP} dias parado
        </div>
      )}

      {fuNow && <div className="fu-badge fu-late">📅 FU vencido</div>}
      {fuOk && <div className="fu-badge fu-ok">📅 {fmtData(lead.followup)}</div>}

      {valor > 0 && <div className="card-valor">{fmtR(valor)}</div>}

      <div className="card-foot">
        <span className="tag" style={{ background: `${origColor}22`, color: origColor }}>
          {lead.orig || '—'}
        </span>
        <span className="card-int">{lead.int?.split(' - ')[0] ?? '—'}</span>
      </div>
    </motion.div>
  );
}
