'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCRM } from '@/store/crm-store';
import { useGestorMetrics, LABEL_ETAPA, COR_ETAPA } from '@/hooks/useGestorMetrics';

// ── Formatação ────────────────────────────────────────────────────────────────
function fmtR(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toLocaleString('pt-BR')}`;
}

function TrendBadge({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 9, fontWeight: 700, marginTop: 7,
      color: up ? '#22C55E' : '#F04747',
      background: up ? 'rgba(34,197,94,0.1)' : 'rgba(240,71,71,0.1)',
      border: `1px solid ${up ? 'rgba(34,197,94,0.2)' : 'rgba(240,71,71,0.2)'}`,
      padding: '2px 8px', borderRadius: 20, width: 'fit-content',
    }}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% vs mês ant.
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function GestorPage() {
  const router = useRouter();
  const { state } = useCRM();
  const m = useGestorMetrics();

  useEffect(() => {
    if (state.currentUser && state.currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [state.currentUser, router]);

  if (!state.currentUser) return null;
  if (state.currentUser.role !== 'admin') return null;

  if (m.loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(201,162,39,0.2)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--text3)', fontSize: 13 }}>Calculando métricas…</span>
      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  if (m.error) return (
    <div style={{ padding: 32, color: '#EF4444', fontSize: 13 }}>Erro: {m.error}</div>
  );

  const ETAPAS_FUNIL = m.etapas.filter(e => e.status !== 'perdido');
  const maxFunil = Math.max(...ETAPAS_FUNIL.map(e => e.count), 1);
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div className="topbar">
        <div>
          <div className="page-title">Painel Gestor</div>
          <div className="page-sub">{m.totalLeads} leads · {state.cliente?.nome ?? ''}</div>
        </div>
        <div className="topbar-right">
          <div style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px' }}>
            📅 {mes}
          </div>
        </div>
      </div>

      {/* ── Scroll container ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ══ KPI CARDS ══ */}
        <div className="kpi-v2-grid">
          {([
            {
              label: 'Leads no mês', value: String(m.leadsNoMes), sub: 'novos leads captados',
              trend: m.trendLeads,
              accent: '#C9A227', bg: 'linear-gradient(145deg,rgba(201,162,39,0.15) 0%,rgba(201,162,39,0.04) 100%)', border: 'rgba(201,162,39,0.22)',
              icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 5h14M2 9h9M2 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>),
            },
            {
              label: 'Fechados no mês', value: String(m.fechadosNoMes), sub: `ticket médio ${fmtR(m.ticketMedio)}`,
              trend: m.trendFechados,
              accent: '#22C55E', bg: 'linear-gradient(145deg,rgba(34,197,94,0.15) 0%,rgba(34,197,94,0.04) 100%)', border: 'rgba(34,197,94,0.22)',
              icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>),
            },
            {
              label: 'Receita no mês', value: fmtR(m.receitaNoMes), sub: 'contratos fechados',
              trend: m.trendReceita,
              accent: '#3B82F6', bg: 'linear-gradient(145deg,rgba(59,130,246,0.15) 0%,rgba(59,130,246,0.04) 100%)', border: 'rgba(59,130,246,0.22)',
              icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M9 4.5V6M9 12v1.5M6.5 7.5H10a1 1 0 0 1 0 3H8a1 1 0 0 0 0 2h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>),
            },
            {
              label: 'Taxa de conversão', value: `${m.taxaConversao}%`, sub: 'leads → fechados',
              trend: 0,
              accent: '#8B5CF6', bg: 'linear-gradient(145deg,rgba(139,92,246,0.15) 0%,rgba(139,92,246,0.04) 100%)', border: 'rgba(139,92,246,0.22)',
              icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6" cy="6" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M5 13L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
            },
          ] as const).map((k, i) => (
            <div key={i} className="kpi-v2-card" style={{ background: k.bg, borderColor: k.border }}>
              <div className="kpi-v2-icon" style={{ color: k.accent, background: `${k.accent}25`, borderColor: `${k.accent}35` }}>
                {k.icon}
              </div>
              <div className="kpi-v2-label">{k.label}</div>
              <div className="kpi-v2-value" style={{ color: k.accent }}>{k.value}</div>
              <div className="kpi-v2-sub">{k.sub}</div>
              <TrendBadge pct={k.trend} />
            </div>
          ))}
        </div>

        {/* ══ FORECAST + FUNIL ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Forecast */}
          <div className="dash-meta">
            <div className="dash-section-title">Forecast do Mês</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1 }}>
                  {fmtR(m.forecast)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>receita projetada</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {m.etapas.filter(e => e.count > 0 && e.status !== 'perdido').map(e => (
                <div key={e.status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 70, fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{LABEL_ETAPA[e.status]}</div>
                  <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(e.count / maxFunil) * 100}%`, background: COR_ETAPA[e.status] ?? 'var(--gold)', borderRadius: 99, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', width: 20, textAlign: 'right', flexShrink: 0 }}>{e.count}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', width: 60, textAlign: 'right', flexShrink: 0 }}>{fmtR(e.valor)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Funil de conversão */}
          <div className="dash-meta">
            <div className="dash-section-title">Funil de Conversão</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ETAPAS_FUNIL.map(e => {
                const pct = Math.round((e.count / maxFunil) * 100);
                const cor = COR_ETAPA[e.status] ?? 'var(--gold)';
                return (
                  <div key={e.status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>{LABEL_ETAPA[e.status]}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {e.diasMedioNaEtapa !== null && e.count > 0 && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: e.diasMedioNaEtapa >= 14 ? '#EF4444' : e.diasMedioNaEtapa >= 7 ? '#F97316' : 'var(--text3)',
                            background: e.diasMedioNaEtapa >= 14 ? 'rgba(239,68,68,0.1)' : e.diasMedioNaEtapa >= 7 ? 'rgba(249,115,22,0.1)' : 'var(--bg3)',
                            padding: '1px 6px', borderRadius: 20,
                          }}>
                            ⏱ {e.diasMedioNaEtapa}d
                          </span>
                        )}
                        <span style={{ fontSize: 11, fontWeight: 700, color: cor }}>{e.count}</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {m.tempoMedioHoras !== null && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Tempo médio de avanço entre etapas</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>
                  {m.tempoMedioHoras < 24 ? `${m.tempoMedioHoras}h` : `${Math.round(m.tempoMedioHoras / 24)}d`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ══ HISTÓRICO + MOTIVOS ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Histórico mensal */}
          <div className="dash-meta">
            <div className="dash-section-title">Histórico dos Últimos 5 Meses</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                {['Mês', 'Leads', 'Fechados', 'Receita'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</div>
                ))}
              </div>
              {m.historicMensal.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{row.mes}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{row.leads}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#22C55E' }}>{row.fechados}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)' }}>{fmtR(row.receita)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Motivos de perda */}
          <div className="dash-meta">
            <div className="dash-section-title">Motivos de Perda</div>
            {m.motivosPerdas.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, padding: '24px 0', color: 'var(--text3)', fontSize: 12 }}>
                <div style={{ fontSize: 28 }}>✅</div>
                Nenhum motivo registrado ainda
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {m.motivosPerdas.slice(0, 6).map((mp, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{mp.motivo}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>{mp.count}×</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(mp.count / (m.motivosPerdas[0]?.count || 1)) * 100}%`, background: 'linear-gradient(90deg,#EF4444,#F97316)', borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ ROI POR ORIGEM + QUALIDADE ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* ROI por origem */}
          <div className="dash-meta">
            <div className="dash-section-title">ROI por Origem</div>
            {m.origROI.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>Nenhum dado de origem registrado</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 60px', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  {['Origem', 'Leads', 'Fech.', 'Receita'].map(h => (
                    <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</div>
                  ))}
                </div>
                {m.origROI.slice(0, 6).map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 60px', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.orig}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{r.leads}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#22C55E' }}>{r.fechados}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)' }}>{fmtR(r.receita)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Qualidade de preenchimento */}
          <div className="dash-meta">
            <div className="dash-section-title">Qualidade dos Campos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {m.qualidade.map(q => {
                const cor = q.pct >= 80 ? '#22C55E' : q.pct >= 50 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={q.campo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>{q.campo}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cor }}>{q.pct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${q.pct}%`, background: cor, borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ ALERTAS ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>

          {/* Leads parados na etapa */}
          <div className="dash-meta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🕐</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#F97316', lineHeight: 1 }}>{m.alertasParados.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Parados na etapa +7 dias</div>
              </div>
            </div>
            {m.alertasParados.length === 0 ? (
              <div style={{ fontSize: 11, color: '#22C55E', textAlign: 'center', padding: '8px 0' }}>✅ Nenhum lead parado</div>
            ) : (
              m.alertasParados.slice(0, 5).map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text2)', padding: '5px 0', borderTop: '1px solid var(--border)', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{a.nome}</span>
                  <span style={{ fontSize: 9, color: 'var(--text3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{LABEL_ETAPA[a.status] ?? a.status}</span>
                  <span style={{ color: a.diasParado >= 14 ? '#EF4444' : '#F97316', fontWeight: 700, flexShrink: 0 }}>{a.diasParado}d</span>
                </div>
              ))
            )}
          </div>

          {/* Follow-ups vencidos */}
          <div className="dash-meta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📅</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#EF4444', lineHeight: 1 }}>{m.alertasFollowup.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Follow-ups vencidos</div>
              </div>
            </div>
            {m.alertasFollowup.length === 0 ? (
              <div style={{ fontSize: 11, color: '#22C55E', textAlign: 'center', padding: '8px 0' }}>✅ Todos em dia</div>
            ) : (
              m.alertasFollowup.slice(0, 5).map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{a.nome}</span>
                  <span style={{ color: '#EF4444', fontWeight: 700, flexShrink: 0 }}>{a.followup}</span>
                </div>
              ))
            )}
          </div>

          {/* Perdidos sem motivo */}
          <div className="dash-meta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚠️</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#8B5CF6', lineHeight: 1 }}>{m.alertasSemMotivo}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Perdidos sem motivo</div>
              </div>
            </div>
            {m.alertasSemMotivo === 0 ? (
              <div style={{ fontSize: 11, color: '#22C55E', textAlign: 'center', padding: '8px 0' }}>✅ Todos com motivo</div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
                Registre o motivo de perda nos {m.alertasSemMotivo} lead{m.alertasSemMotivo > 1 ? 's' : ''} perdido{m.alertasSemMotivo > 1 ? 's' : ''} para melhorar as métricas.
              </div>
            )}
          </div>

        </div>

      </div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
