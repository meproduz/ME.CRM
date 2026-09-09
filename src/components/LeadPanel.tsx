'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCRM } from '@/store/crm-store';
import { useLeads } from '@/hooks/useLeads';
import { useOportunidades } from '@/hooks/useOportunidades';
import { fmtR, isStale, diasAtras, ultimoContato, qualScore, fuStatus, leadData, leadHora, getLeadValor, diasParaResolucao } from '@/lib/utils';
import { KANBAN_COLS, SEGMENTOS, ORIGENS_GROUPS, ICP_BADGE, MOTIVOS_PERDA, type Lead, type LeadStatus } from '@/types';

const OPORT_STATUS_LABEL: Record<string, string> = {
  aberta: 'Em aberto', fechada: 'Fechada ✅', perdida: 'Perdida ❌',
};

function miniBtnStyle(color: string): CSSProperties {
  return {
    padding: '4px 9px', background: `${color}18`, border: `1px solid ${color}40`,
    borderRadius: 6, color, fontSize: 10.5, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
  };
}
import { exportLeadPDF, exportLeadCSV } from '@/lib/exportLead';
import ICPModal from '@/components/ICPModal';

const INTERESSES = ['Alicerce - R$ 1.599', 'Tracao - R$ 1.799', 'Expansao - R$ 3.159', 'So trafego - R$ 700'];

// Atalho rápido de classificação ICP — mesmos campos do diagnóstico completo
// (icp_score/icp_label), sem precisar responder as 4 perguntas quando o
// vendedor já sabe de cabeça o perfil do lead.
const TEMPERATURAS = [
  { label: 'ICP frio',  icon: '🧊', score: 20, color: '#E24B4A', bg: 'rgba(226,75,74,0.12)' },
  { label: 'ICP morno', icon: '🌡️', score: 55, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  { label: 'ICP ideal', icon: '🔥', score: 85, color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
] as const;

export default function LeadPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { state } = useCRM();
  const { loadHist, addNota, moveLead, updateField, deleteLead, setFollowup, saveICP } = useLeads();
  const { addOportunidade, closeOportunidade, loseOportunidade, reabrirOportunidade, updateOportunidade } = useOportunidades();

  const [nota, setNota] = useState('');
  const [fuDate, setFuDate] = useState(lead.followup ?? '');
  const [fuDatePart, fuTimePart] = fuDate ? (fuDate.includes('T') ? fuDate.split('T') : [fuDate, '']) : ['', ''];
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [perdaMotivo, setPerdaMotivo] = useState('');
  const [perdaObs, setPerdaObs] = useState('');
  const [novaOportOpen, setNovaOportOpen] = useState(false);
  const [novaOportNome, setNovaOportNome] = useState('');
  const [novaOportValor, setNovaOportValor] = useState('');
  const [perdaOportId, setPerdaOportId] = useState<string | null>(null);
  const [perdaOportMotivo, setPerdaOportMotivo] = useState('');
  const [perdaOportObs, setPerdaOportObs] = useState('');
  const [editOportId, setEditOportId] = useState<string | null>(null);
  const [editOportNome, setEditOportNome] = useState('');
  const [editOportValor, setEditOportValor] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [showICP, setShowICP]         = useState(false);
  const [gateOpen, setGateOpen]       = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const ld = leadData(lead);
  const stale = isStale(lead.hist, ld, lead.status, lead.status_changed_at, lead.lastContact);
  const valor = getLeadValor(lead);
  const diasResolucao = diasParaResolucao(lead);
  const oportunidades = lead.oportunidades ?? [];
  const score = qualScore(lead);
  const fuSt = fuStatus(lead.followup);

  // WA template por etapa
  const tpl = (state.waTemplates as any)[lead.status] || state.waTemplate;
  const waMsg = lead.tel ? encodeURIComponent(tpl.replace('{nome}', lead.nome)) : null;

  useEffect(() => { loadHist(lead.id); }, [lead.id]);
  useEffect(() => { setFuDate(lead.followup ?? ''); }, [lead.followup]);

  // Fecha dropdown de exportação ao clicar fora
  useEffect(() => {
    if (!exportOpen) return;
    function close(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [exportOpen]);

  async function handleSaveNota() {
    if (!nota.trim()) return;
    await addNota(lead.id, nota.trim());
    setNota('');
  }

  async function handleMove(status: string) {
    // Lead com 2+ oportunidades abertas: fechar/perder o card inteiro fica
    // ambíguo (qual delas?) — resolve oportunidade por oportunidade abaixo.
    if (status === 'fechado' || status === 'perdido') {
      const abertas = oportunidades.filter((o) => o.status === 'aberta');
      if (abertas.length >= 2) {
        alert('Esse lead tem mais de uma oportunidade em aberto. Feche ou marque cada uma como perdida na seção "Oportunidades" antes de mover o card.');
        return;
      }
    }
    if (status === 'perdido') { setPerdaOpen(true); return; }
    // Gate ICP: exige qualificação antes de avançar para proposta ou negociação
    if ((status === 'proposta' || status === 'negociacao') && !lead.icp_score) {
      setPendingStatus(status);
      setGateOpen(true);
      return;
    }
    await moveLead(lead.id, status);
  }

  async function handleAddOportunidade() {
    const trimmed = novaOportValor.trim();
    let valor: number | null = null;
    if (trimmed !== '') {
      const n = Number(trimmed.replace(/\./g, '').replace(',', '.'));
      valor = isNaN(n) ? null : n; // preserva 0 explícito em vez de virar null
    }
    await addOportunidade(lead.id, { nome: novaOportNome.trim() || null, valor });
    setNovaOportNome(''); setNovaOportValor(''); setNovaOportOpen(false);
  }

  function startEditOport(o: { id: string; nome: string | null; valor: number | null }) {
    setEditOportId(o.id);
    setEditOportNome(o.nome ?? '');
    setEditOportValor(o.valor != null ? String(o.valor) : '');
  }

  async function handleSaveEditOport() {
    if (!editOportId) return;
    const trimmed = editOportValor.trim();
    let valorOport: number | null = null;
    if (trimmed !== '') {
      const n = Number(trimmed.replace(/\./g, '').replace(',', '.'));
      valorOport = isNaN(n) ? null : n;
    }
    await updateOportunidade(lead.id, editOportId, { nome: editOportNome.trim() || null, valor: valorOport });
    setEditOportId(null);
  }

  async function handleConfirmarPerdaOport() {
    if (!perdaOportId) return;
    const motivo = perdaOportMotivo || 'Não informado';
    const nota2 = perdaOportObs ? `${motivo} — ${perdaOportObs}` : motivo;
    await loseOportunidade(lead.id, perdaOportId, nota2);
    setPerdaOportId(null); setPerdaOportMotivo(''); setPerdaOportObs('');
  }

  async function handleConfirmICP(score: number, label: string) {
    await saveICP(lead.id, score, label);
    setShowICP(false);
    // Se veio de um gate, avança para a etapa após qualificar
    if (pendingStatus) {
      const s = pendingStatus;
      setPendingStatus(null);
      await moveLead(lead.id, s);
    }
  }

  async function handleConfirmarPerda() {
    const motivo = perdaMotivo || 'Não informado';
    const nota2 = perdaObs ? `${motivo} — ${perdaObs}` : motivo;
    await moveLead(lead.id, 'perdido', nota2);
    setPerdaOpen(false);
  }

  async function handleDelete() {
    if (!confirm(`Remover "${lead.nome}"? Ele vai pra Lixeira e pode ser restaurado depois.`)) return;
    await deleteLead(lead.id);
    onClose();
  }

  return (
    <>
      <motion.div className="lead-panel-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
      <motion.div className="lead-panel"
        initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="panel-header">
          <div>
            <div className="panel-name">{lead.nome}</div>
            <div className="panel-seg">{lead.seg || 'Não definido'} · {lead.orig || '—'}</div>
            <div className="panel-arrival">Chegou em {ld} às {leadHora(lead)}</div>
            {lead.criado_por_nome && (
              <div className="panel-arrival" style={{ color: 'var(--text3)' }}>Cadastrado por {lead.criado_por_nome}</div>
            )}
            {diasResolucao != null && (
              <div className="panel-arrival" style={{ color: lead.status === 'fechado' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                {lead.status === 'fechado' ? '✅ Fechado' : '❌ Perdido'} em {diasResolucao} dia{diasResolucao !== 1 ? 's' : ''} de jornada
              </div>
            )}
            {stale && (
              <div className="panel-stale" style={{ display: 'inline-flex' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span>{diasAtras(ultimoContato(lead.hist, ld, lead.lastContact))} dias sem contato</span>
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
                {ORIGENS_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((o) => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="pf">
              <div className="pf-label">Valor do orçamento (R$)</div>
              <input type="number" defaultValue={lead.valor != null && Number(lead.valor) < 100 ? Math.round(Number(lead.valor) * 1000) : (lead.valor ?? '')} onBlur={(e) => {
                // Remove pontos usados como separador de milhar antes de salvar
                const raw = e.target.value.replace(/\./g, '').replace(',', '.');
                updateField(lead.id, 'valor', Number(raw) || null);
              }} />
            </div>
          </div>

          {/* Qualificação automática */}
          <div className="qual-wrap">
            <div className="ql">Qualificação (<span>{score}</span>/5)</div>
            <div className="qt"><div className="qf" style={{ width: `${(score / 5) * 100}%` }} /></div>
          </div>

          {/* Temperatura rápida */}
          <div style={{ marginBottom: 14 }}>
            <div className="plabel" style={{ marginBottom: 8 }}>Temperatura</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {TEMPERATURAS.map((t) => {
                const active = lead.icp_label === t.label;
                return (
                  <button
                    key={t.label}
                    onClick={() => saveICP(lead.id, t.score, t.label)}
                    style={{
                      flex: 1, padding: '8px 6px', borderRadius: 8,
                      background: active ? t.bg : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? t.color : 'rgba(255,255,255,0.08)'}`,
                      color: active ? t.color : 'var(--text3)',
                      fontSize: 11.5, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      transition: 'all 0.15s',
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ICP */}
          <div style={{ marginBottom: 14 }}>
            <div className="plabel" style={{ marginBottom: 8 }}>ICP — Diagnóstico</div>
            {lead.icp_score != null && lead.icp_label ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 100,
                  background: ICP_BADGE[lead.icp_label]?.bg ?? 'rgba(100,100,100,0.1)',
                  color: ICP_BADGE[lead.icp_label]?.color ?? '#888',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {ICP_BADGE[lead.icp_label]?.icon} {lead.icp_label} · {lead.icp_score}/100
                </div>
                <button
                  onClick={() => setShowICP(true)}
                  style={{
                    padding: '5px 10px', background: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 7, color: 'var(--text3)', fontSize: 11,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Re-qualificar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowICP(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  width: '100%', padding: '10px 14px',
                  background: 'rgba(var(--gold-rgb),0.06)',
                  border: '1px solid rgba(var(--gold-rgb),0.25)',
                  borderRadius: 8, color: 'var(--gold)',
                  fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  justifyContent: 'center',
                }}
              >
                🎯 Qualificar lead (ICP)
              </button>
            )}
          </div>

          {/* Etapa — stepper visual */}
          <div className="plabel" style={{ marginBottom: 10 }}>Etapa</div>
          <StageStepper current={lead.status} onSelect={handleMove} />
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>
            Etapa atual: <strong style={{ color: 'var(--text)' }}>{KANBAN_COLS.find((c) => c.id === lead.status)?.label ?? lead.status}</strong>
          </div>
          <button
            onClick={() => setPerdaOpen(true)}
            style={{
              background: 'none', border: 'none', color: 'var(--text3)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              padding: '4px 0 12px', textDecoration: 'underline',
            }}
          >
            Marcar como perdido
          </button>

          {/* Oportunidades — lista só aparece quando há mais de uma; caso comum
              (0 ou 1) fica exatamente como antes, sem UI nova visível. */}
          <div style={{ marginTop: 14, marginBottom: 4 }}>
            {oportunidades.length > 1 && (
              <>
                <div className="plabel" style={{ marginBottom: 8 }}>Oportunidades</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {oportunidades.map((o) => (
                    editOportId === o.id ? (
                      <div key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <input placeholder="Nome" value={editOportNome} onChange={(e) => setEditOportNome(e.target.value)} />
                        <input type="number" placeholder="Valor (R$)" value={editOportValor} onChange={(e) => setEditOportValor(e.target.value)} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="msbtn" style={{ flex: 1 }} onClick={handleSaveEditOport}>Salvar</button>
                          <button className="mcbtn" style={{ flex: 1 }} onClick={() => setEditOportId(null)}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div key={o.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
                      }}>
                        <button
                          onClick={() => startEditOport(o)}
                          title="Editar nome/valor"
                          style={{ minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.nome || 'Oportunidade'} <span style={{ opacity: 0.5, fontWeight: 400 }}>✎</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {fmtR(o.valor)} · {OPORT_STATUS_LABEL[o.status]}
                          </div>
                        </button>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {o.status === 'aberta' ? (
                            <>
                              <button onClick={() => closeOportunidade(lead.id, o.id)} style={miniBtnStyle('#22C55E')}>Fechar</button>
                              <button onClick={() => { setPerdaOportId(o.id); setPerdaOportMotivo(''); setPerdaOportObs(''); }} style={miniBtnStyle('#E24B4A')}>Perder</button>
                            </>
                          ) : (
                            <button onClick={() => reabrirOportunidade(lead.id, o.id)} style={miniBtnStyle('#F59E0B')}>Reabrir</button>
                          )}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </>
            )}

            {novaOportOpen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <input placeholder="Nome (opcional)" value={novaOportNome} onChange={(e) => setNovaOportNome(e.target.value)} />
                <input type="number" placeholder="Valor (R$)" value={novaOportValor} onChange={(e) => setNovaOportValor(e.target.value)} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="msbtn" style={{ flex: 1 }} onClick={handleAddOportunidade}>Adicionar</button>
                  <button className="mcbtn" style={{ flex: 1 }} onClick={() => setNovaOportOpen(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setNovaOportOpen(true)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--text3)', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', textDecoration: 'underline',
                }}
              >
                + Adicionar oportunidade
              </button>
            )}
          </div>

          {/* Follow-up */}
          <div className="p-fu-wrap">
            <div className="plabel">Próximo follow-up</div>
            <div className="p-fu-row">
              <input type="date" className="p-fu-input" value={fuDatePart}
                onChange={(e) => {
                  const combined = e.target.value ? (fuTimePart ? `${e.target.value}T${fuTimePart}` : e.target.value) : '';
                  setFuDate(combined);
                  setFollowup(lead.id, combined || null);
                }} />
              <input type="time" className="p-fu-input" value={fuTimePart} disabled={!fuDatePart}
                onChange={(e) => {
                  if (!fuDatePart) return;
                  const combined = e.target.value ? `${fuDatePart}T${e.target.value}` : fuDatePart;
                  setFuDate(combined);
                  setFollowup(lead.id, combined || null);
                }} />
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

          {/* Exportar — dropdown PDF / CSV */}
          <div ref={exportRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setExportOpen((o) => !o)}
              style={{
                padding: '8px 13px',
                background: exportOpen ? 'rgba(var(--gold-rgb),0.15)' : 'rgba(var(--gold-rgb),0.08)',
                border: '1px solid rgba(var(--gold-rgb),0.3)',
                borderRadius: 8,
                color: 'var(--gold)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'background 0.15s',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v6.5M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 9.5v.5a1 1 0 001 1h8a1 1 0 001-1v-.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Exportar
            </button>

            {exportOpen && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: 0,
                background: '#16161f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: 5,
                minWidth: 150,
                boxShadow: '0 -8px 32px rgba(0,0,0,0.55)',
                zIndex: 60,
              }}>
                {/* PDF */}
                <button
                  onClick={() => { exportLeadPDF(lead); setExportOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '9px 12px',
                    background: 'none', border: 'none', borderRadius: 7,
                    color: '#EFEFEF', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="var(--gold2)" strokeWidth="1.2"/>
                    <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke="var(--gold2)" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                  <span>PDF visual</span>
                </button>
                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 8px' }} />
                {/* CSV */}
                <button
                  onClick={() => { exportLeadCSV(lead); setExportOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '9px 12px',
                    background: 'none', border: 'none', borderRadius: 7,
                    color: '#EFEFEF', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="#22C55E" strokeWidth="1.2"/>
                    <path d="M4 4h6M4 6.5h6M4 9h6M4 11.5h4" stroke="#22C55E" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  <span>CSV / planilha</span>
                </button>
              </div>
            )}
          </div>

          <button className="p-sbtn" onClick={onClose}>Fechar</button>
          <button className="p-dbtn" onClick={handleDelete}>Remover</button>
        </div>
      </motion.div>
      </motion.div>

      {/* Modal ICP */}
      <AnimatePresence>
        {showICP && (
          <ICPModal
            leadNome={lead.nome}
            existingScore={lead.icp_score}
            existingLabel={lead.icp_label}
            onConfirm={handleConfirmICP}
            onClose={() => { setShowICP(false); setPendingStatus(null); }}
          />
        )}
      </AnimatePresence>

      {/* Gate: qualificação obrigatória antes de proposta/negociação */}
      <AnimatePresence>
        {gateOpen && (
          <motion.div className="modal-overlay" style={{ display: 'flex', zIndex: 450 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" style={{ maxWidth: 380 }}
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
                <h3 style={{ margin: 0, fontSize: 15 }}>Lead não qualificado</h3>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
                Qualifique este lead antes de avançar para{' '}
                <strong>{KANBAN_COLS.find((c) => c.id === pendingStatus)?.label ?? pendingStatus}</strong>.
                Isso garante que o seu tempo comercial vai para quem tem real potencial.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="msbtn" style={{ width: '100%' }}
                  onClick={() => { setGateOpen(false); setShowICP(true); }}>
                  🎯 Qualificar agora
                </button>
                <button
                  style={{
                    width: '100%', padding: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, color: 'var(--text3)', fontSize: 12,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                  onClick={() => { setGateOpen(false); moveLead(lead.id, pendingStatus!); setPendingStatus(null); }}
                >
                  Avançar mesmo assim
                </button>
                <button className="mcbtn" onClick={() => { setGateOpen(false); setPendingStatus(null); }}>
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal perda — de uma oportunidade específica (lead com 2+) */}
      <AnimatePresence>
        {perdaOportId && (
          <motion.div className="modal-overlay" style={{ display: 'flex', zIndex: 400 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPerdaOportId(null)}>
            <motion.div className="modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}>
              <h3>Motivo de perda da oportunidade</h3>
              <div className="mf">
                <label>Motivo</label>
                <select value={perdaOportMotivo} onChange={(e) => setPerdaOportMotivo(e.target.value)}>
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
                <textarea placeholder="Detalhes do motivo..." value={perdaOportObs} onChange={(e) => setPerdaOportObs(e.target.value)} />
              </div>
              <div className="mfooter">
                <button className="mcbtn" onClick={() => setPerdaOportId(null)}>Cancelar</button>
                <button className="msbtn" style={{ background: 'var(--red)', color: '#fff' }} onClick={handleConfirmarPerdaOport}>Registrar perda</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  {MOTIVOS_PERDA.map((m) => <option key={m}>{m}</option>)}
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

// ─── Stepper visual de etapas ─────────────────────────────────────────────────
// "Perdido" fica fora do stepper (não é um avanço linear) — vira o link
// "Marcar como perdido" logo abaixo.
function StageStepper({ current, onSelect }: { current: LeadStatus; onSelect: (status: string) => void }) {
  const stages = KANBAN_COLS.filter((c) => c.id !== 'perdido');
  const currentIdx = stages.findIndex((s) => s.id === current);

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
      {stages.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < stages.length - 1 ? 1 : undefined, minWidth: 0 }}>
            <button
              onClick={() => onSelect(s.id)}
              title={s.label}
              style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done || active ? s.color : 'rgba(255,255,255,0.06)',
                border: active ? '2px solid #fff' : 'none',
                boxShadow: active ? `0 0 0 3px ${s.color}55` : 'none',
                color: done || active ? '#07050a' : 'var(--text3)',
                fontSize: 11, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              }}
            >
              {done ? '✓' : i + 1}
            </button>
            {i < stages.length - 1 && (
              <div style={{ flex: 1, height: 2, minWidth: 8, background: done ? s.color : 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
