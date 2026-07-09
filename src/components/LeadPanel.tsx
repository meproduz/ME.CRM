'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCRM } from '@/store/crm-store';
import { useLeads } from '@/hooks/useLeads';
import { fmtR, isStale, diasAtras, ultimoContato, qualScore, fuStatus, fmtData, leadData, leadHora } from '@/lib/utils';
import { KANBAN_COLS, SEGMENTOS, ORIGENS, VAL, type Lead, type LeadStatus } from '@/types';

function getLeadValor(l: any) {
  if (l.valor) return Number(l.valor);
  if (l.int) {
    const key = Object.keys(VAL).find((k) => l.int?.toLowerCase().includes(k.toLowerCase()));
    if (key) return VAL[key];
  }
  return 0;
}

const INTERESSES = ['Alicerce - R$ 1.599', 'Tracao - R$ 1.799', 'Expansao - R$ 3.159', 'So trafego - R$ 700'];

export default function LeadPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { state } = useCRM();
  const { loadHist, addNota, moveLead, updateField, deleteLead, setFollowup } = useLeads();

  const [nota, setNota] = useState('');
  const [fuDate, setFuDate] = useState(lead.followup ?? '');
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [perdaMotivo, setPerdaMotivo] = useState('');
  const [perdaObs, setPerdaObs] = useState('');

  const ld = leadData(lead);
  const stale = isStale(lead.hist, ld, lead.status, lead.status_changed_at);
  const valor = getLeadValor(lead);
  const score = qualScore(lead);
  const fuSt = fuStatus(lead.followup);

  // WA template por etapa
  const tpl = (state.waTemplates as any)[lead.status] || state.waTemplate;
  const waMsg = lead.tel ? encodeURIComponent(tpl.replace('{nome}', lead.nome)) : null;

  useEffect(() => { loadHist(lead.id); }, [lead.id]);
  useEffect(() => { setFuDate(lead.followup ?? ''); }, [lead.followup]);

  async function handleSaveNota() {
    if (!nota.trim()) return;
    await addNota(lead.id, nota.trim());
    setNota('');
  }

  async function handleMove(status: string) {
    if (status === 'perdido') { setPerdaOpen(true); return; }
    await moveLead(lead.id, status);
  }

  async function handleConfirmarPerda() {
    const motivo = perdaMotivo || 'Não informado';
    const nota2 = perdaObs ? `${motivo} — ${perdaObs}` : motivo;
    await moveLead(lead.id, 'perdido', nota2);
    setPerdaOpen(false);
  }

  async function handleDelete() {
    if (!confirm(`Remover o lead "${lead.nome}" permanentemente?`)) return;
    await deleteLead(lead.id);
    onClose();
  }

  return (
    <>
      <motion.div className="lead-panel open" style={{ transform: 'none' }}
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        {/* Header */}
        <div className="panel-header">
          <div>
            <div className="panel-name">{lead.nome}</div>
            <div className="panel-seg">{lead.seg || 'Não definido'} · {lead.orig || '—'}</div>
            <div className="panel-arrival">Chegou em {ld} às {leadHora(lead)}</div>
            {stale && (
              <div className="panel-stale" style={{ display: 'inline-flex' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span>{diasAtras(ultimoContato(lead.hist, ld))} dias sem contato</span>
              </div>
            )}
          </div>
          <button className="xbtn" onClick={onClose}>✕</button>
        </div>

        <div className="panel-body">
          {/* Valor badge */}
          {valor > 0 && (
            <div className="pval-badge" style={{ display: 'block' }}>
              {fmtR(valor)}{lead.int ? ` · ${lead.int.split(' - ')[0]}` : ''}
            </div>
          )}

          {/* Campos editáveis */}
          <div className="pgrid">
            <div className="pf">
              <div className="pf-label">Nome</div>
              <input defaultValue={lead.nome} onBlur={(e) => updateField(lead.id, 'nome', e.target.value)} />
            </div>
            <div className="pf">
              <div className="pf-label">Telefone</div>
              <input defaultValue={lead.tel ?? ''} onBlur={(e) => updateField(lead.id, 'tel', e.target.value)} />
            </div>
            <div className="pf">
              <div className="pf-label">Segmento</div>
              <select defaultValue={lead.seg ?? ''} onChange={(e) => updateField(lead.id, 'seg', e.target.value)}>
                <option value="">Não definido</option>
                {SEGMENTOS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="pf">
              <div className="pf-label">Interesse</div>
              <select defaultValue={lead.int ?? ''} onChange={(e) => updateField(lead.id, 'int', e.target.value)}>
                <option value="">Não definido</option>
                {INTERESSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="pgrid">
            <div className="pf">
              <div className="pf-label">Origem</div>
              <select defaultValue={lead.orig ?? ''} onChange={(e) => updateField(lead.id, 'orig', e.target.value)}>
                <option value="">Selecione</option>
                {ORIGENS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="pf">
              <div className="pf-label">Valor do orçamento (R$)</div>
              <input type="number" defaultValue={lead.valor ?? ''} onBlur={(e) => updateField(lead.id, 'valor', Number(e.target.value) || null)} />
            </div>
          </div>

          {/* Qualificação */}
          <div className="qual-wrap">
            <div className="ql">Qualificação (<span>{score}</span>/5)</div>
            <div className="qt"><div className="qf" style={{ width: `${(score / 5) * 100}%` }} /></div>
          </div>

          {/* Mover para etapa */}
          <div className="plabel">Mover para etapa</div>
          <select className="pmove" value={lead.status} onChange={(e) => handleMove(e.target.value)}>
            {KANBAN_COLS.map((col) => <option key={col.id} value={col.id}>{col.label}</option>)}
          </select>

          {/* Follow-up */}
          <div className="p-fu-wrap">
            <div className="plabel">Próximo follow-up</div>
            <div className="p-fu-row">
              <input type="date" className="p-fu-input" value={fuDate}
                onChange={(e) => setFuDate(e.target.value)}
                onBlur={(e) => setFollowup(lead.id, e.target.value || null)} />
              <button className="p-fu-clear" onClick={() => { setFuDate(''); setFollowup(lead.id, null); }}>✕ Limpar</button>
            </div>
            {fuSt && <div style={{ fontSize: 10, marginTop: 4, color: fuSt.color }}>{fuSt.text}</div>}
          </div>

          {/* Nova nota */}
          <div className="plabel">Nova nota</div>
          <textarea className="pobs" placeholder="Escreva uma observação sobre este lead..."
            value={nota} onChange={(e) => setNota(e.target.value)} />
          <button className="nota-btn" onClick={handleSaveNota}>💾 Salvar nota</button>

          {/* Histórico */}
          <div className="hist-wrap">
            <div className="hist-title">Linha do tempo</div>
            <div id="p-hist">
              {lead.obs && (
                <div className="hist-item hist-nota">
                  <div className="hist-nota-header">📋 Observação inicial</div>
                  <div className="hist-nota-body">{lead.obs}</div>
                </div>
              )}
              {lead.hist.length === 0 && !lead.obs && (
                <div className="hist-item" style={{ fontStyle: 'italic', color: 'var(--text3)' }}>Sem histórico ainda.</div>
              )}
              {[...lead.hist].reverse().map((entry, i) => {
                if (entry.includes('📝')) {
                  const pts = entry.split('—');
                  return (
                    <div key={i} className="hist-item hist-nota">
                      <div className="hist-nota-header">{pts[0].trim()}</div>
                      <div className="hist-nota-body">{pts.slice(1).join('—').trim()}</div>
                    </div>
                  );
                }
                return <div key={i} className="hist-item">{entry}</div>;
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="panel-footer">
          {lead.tel && waMsg && (
            <button className="p-wbtn" onClick={() => window.open(`https://wa.me/55${lead.tel!.replace(/\D/g, '')}?text=${waMsg}`, '_blank')}>
              WhatsApp
            </button>
          )}
          <button className="p-sbtn" onClick={onClose}>Fechar</button>
          <button className="p-dbtn" onClick={handleDelete}>Remover</button>
        </div>
      </motion.div>

      {/* Modal perda */}
      <AnimatePresence>
        {perdaOpen && (
          <motion.div className="modal-overlay" style={{ display: 'flex', zIndex: 400 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPerdaOpen(false)}>
            <motion.div className="modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}>
              <h3>Motivo de perda</h3>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 18, fontWeight: 300 }}>
                Registre o motivo para melhorar o processo de vendas.
              </p>
              <div className="mf">
                <label>Motivo</label>
                <select value={perdaMotivo} onChange={(e) => setPerdaMotivo(e.target.value)}>
                  <option value="">Selecione o motivo</option>
                  <option>Sem orçamento</option>
                  <option>Escolheu concorrente</option>
                  <option>Não respondeu</option>
                  <option>Proposta rejeitada</option>
                  <option>Timing ruim</option>
                  <option>Problema interno</option>
                  <option>Outro</option>
                </select>
              </div>
              <div className="mf">
                <label>Observação (opcional)</label>
                <textarea placeholder="Detalhes do motivo..." value={perdaObs} onChange={(e) => setPerdaObs(e.target.value)} />
              </div>
              <div className="mfooter">
                <button className="mcbtn" onClick={() => setPerdaOpen(false)}>Cancelar</button>
                <button className="msbtn" style={{ background: 'var(--red)', color: '#fff' }} onClick={handleConfirmarPerda}>Registrar perda</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
