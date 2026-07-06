'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCRM } from '@/store/crm-store';
import { useGestorMetrics, LABEL_ETAPA, COR_ETAPA, getLeadValor } from '@/hooks/useGestorMetrics';

// ── Helpers de formatação ─────────────────────────────────────────────────────
function fmtR(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toLocaleString('pt-BR')}`;
}

function TrendBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span style={{ fontSize: 10, color: 'var(--text3)' }}>= mês ant.</span>;
  const up = pct > 0;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: up ? '#22C55E' : '#EF4444',
      background: up ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${up ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
      padding: '2px 7px', borderRadius: 20,
    }}>
      {up ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

// ── Barra de progresso ────────────────────────────────────────────────────────
function ProgressBar({ pct, cor = 'var(--gold)', height = 6 }: { pct: number; cor?: string; height?: number }) {
  return (
    <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, pct)}%`,
        background: cor, borderRadius: 99, transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

// ── Card base ─────────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '20px 22px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '1.2px',
      textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function GestorPage() {
  const router = useRouter();
  const { state } = useCRM();
  const m = useGestorMetrics();

  // Proteger rota — só admin acessa
  useEffect(() => {
    if (state.currentUser && state.currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [state.currentUser, router]);

  if (!state.currentUser) return null;
  if (state.currentUser.role !== 'admin') return null;

  if (m.loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(201,162,39,0.2)', borderTop: '2px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--text3)', fontSize: 13 }}>Calculando métricas…</span>
    </div>
  );

  if (m.error) return (
    <div style={{ padding: 32, color: '#EF4444', fontSize: 13 }}>Erro: {m.error}</div>
  );

  const ETAPAS_FUNIL = m.etapas.filter(e => e.status !== 'perdido');
  const maxFunil = Math.max(...ETAPAS_FUNIL.map(e => e.count), 1);

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Painel do Gestor</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            {m.totalLeads} leads totais · {state.cliente?.nome ?? ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px' }}>
            📅 Este mês
          </div>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {[
          { label: 'Leads no mês', val: m.leadsNoMes, fmt: String, trend: m.trendLeads, sub: 'novos leads captados' },
          { label: 'Fechados', val: m.fechadosNoMes, fmt: String, trend: m.trendFechados, sub: 'contratos fechados' },
          { label: 'Receita', val: m.receitaNoMes, fmt: fmtR, trend: m.trendReceita, sub: `ticket médio ${fmtR(m.ticketMedio)}` },
          { label: 'Taxa de conversão', val: m.taxaConversao, fmt: (v: number) => `${v}%`, trend: 0, sub: 'leads → fechados' },
        ].map(k => (
          <Card key={k.label}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{k.fmt(k.val)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <TrendBadge pct={k.trend} />
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{k.sub}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Forecast + Meta ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        {/* Forecast */}
        <Card>
          <SectionTitle>🎯 Forecast — Projeção do Mês</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Pipeline ponderado</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)' }}>{fmtR(m.forecastTotal)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Com fechados do mês</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fmtR(m.forecastComFechados)}</div>
              </div>
            </div>
            <ProgressBar pct={m.probBaterMeta} cor={m.probBaterMeta >= 80 ? '#22C55E' : m.probBaterMeta >= 50 ? '#C9A227' : '#EF4444'} height={8} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Meta: {fmtR(m.metaMensal)}</span>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: m.probBaterMeta >= 80 ? '#22C55E' : m.probBaterMeta >= 50 ? '#C9A227' : '#EF4444',
              }}>
                {m.probBaterMeta}% de probabilidade
              </span>
            </div>
            <div style={{
              background: m.probBaterMeta >= 80 ? 'rgba(34,197,94,0.06)' : m.probBaterMeta >= 50 ? 'rgba(201,162,39,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${m.probBaterMeta >= 80 ? 'rgba(34,197,94,0.15)' : m.probBaterMeta >= 50 ? 'rgba(201,162,39,0.15)' : 'rgba(239,68,68,0.15)'}`,
              borderRadius: 10, padding: '10px 14px', fontSize: 12,
              color: m.probBaterMeta >= 80 ? '#22C55E' : m.probBaterMeta >= 50 ? '#C9A227' : '#EF4444',
            }}>
              {m.probBaterMeta >= 80
                ? `✅ No caminho certo — faltam ${fmtR(Math.max(0, m.metaMensal - m.forecastComFechados))} para a meta`
                : m.probBaterMeta >= 50
                  ? `⚠️ Atenção — necessário acelerar o pipeline`
                  : `🚨 Risco alto — pipeline insuficiente para bater a meta`}
            </div>
          </div>
        </Card>

        {/* Meta progress detalhado */}
        <Card>
          <SectionTitle>📊 Detalhes do Pipeline</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {m.etapas.filter(e => e.status !== 'perdido').map(e => (
              <div key={e.status}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.cor }} />
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{e.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg4)', padding: '1px 7px', borderRadius: 10 }}>{e.count}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtR(e.valor)}</span>
                    <span style={{ fontSize: 11, color: e.cor, fontWeight: 700 }}>{fmtR(e.forecastPonderado)}</span>
                  </div>
                </div>
                <ProgressBar pct={e.count > 0 ? (e.count / Math.max(...m.etapas.map(x => x.count), 1)) * 100 : 0} cor={e.cor} height={4} />
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Forecast ponderado total</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{fmtR(m.forecastTotal)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Funil de Conversão ─────────────────────────────────────── */}
      <Card style={{ marginBottom: 18 }}>
        <SectionTitle>🔽 Funil de Conversão</SectionTitle>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
          {ETAPAS_FUNIL.map((etapa, idx) => {
            const pct = (etapa.count / maxFunil) * 100;
            const convPrev = idx > 0
              ? ETAPAS_FUNIL[idx - 1].count > 0
                ? Math.round((etapa.count / ETAPAS_FUNIL[idx - 1].count) * 100)
                : 0
              : 100;
            return (
              <div key={etapa.status} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {/* Seta de conversão */}
                {idx > 0 && (
                  <div style={{ fontSize: 9, color: convPrev >= 50 ? '#22C55E' : '#EF4444', fontWeight: 700, marginBottom: 2 }}>
                    {convPrev}% →
                  </div>
                )}
                {/* Barra */}
                <div style={{
                  width: '100%', borderRadius: '6px 6px 0 0', minHeight: 8,
                  height: `${Math.max(8, pct * 1.4)}px`,
                  background: etapa.cor, opacity: 0.85,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'height 0.6s ease',
                }}>
                  {etapa.count > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{etapa.count}</span>
                  )}
                </div>
                {/* Label */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: etapa.cor }}>{etapa.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{fmtR(etapa.valor)}</div>
                  {etapa.tempoMedioHoras !== null && (
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      ~{etapa.tempoMedioHoras >= 24
                        ? `${Math.round(etapa.tempoMedioHoras / 24)}d`
                        : `${etapa.tempoMedioHoras}h`} médio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Perdidos */}
        {(() => {
          const perd = m.etapas.find(e => e.status === 'perdido');
          return perd ? (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Perdidos: <strong style={{ color: '#EF4444' }}>{perd.count}</strong> leads</span>
              {m.alertasSemMotivo > 0 && (
                <span style={{ fontSize: 11, color: '#EF4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '2px 10px', borderRadius: 8 }}>
                  ⚠️ {m.alertasSemMotivo} sem motivo registrado
                </span>
              )}
            </div>
          ) : null;
        })()}
      </Card>

      {/* ── Histórico mensal + Motivos de perda ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>

        {/* Histórico mensal */}
        <Card>
          <SectionTitle>📅 Histórico Mensal</SectionTitle>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Mês', 'Leads', 'Fechados', 'Receita', 'Conv.'].map(h => (
                    <th key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textAlign: h === 'Mês' ? 'left' : 'right', padding: '0 8px 10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.historicMensal.map((mes, i) => {
                  const isAtual = i === m.historicMensal.length - 1;
                  return (
                    <tr key={mes.label} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 8px', fontSize: 12, color: isAtual ? 'var(--gold)' : 'var(--text2)', fontWeight: isAtual ? 700 : 400 }}>
                        {mes.label} {isAtual && <span style={{ fontSize: 9, background: 'rgba(201,162,39,0.15)', color: 'var(--gold)', padding: '1px 6px', borderRadius: 10, marginLeft: 4 }}>atual</span>}
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>{mes.leads}</td>
                      <td style={{ padding: '10px 8px', fontSize: 12, color: '#22C55E', textAlign: 'right', fontWeight: 600 }}>{mes.fechados}</td>
                      <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>{fmtR(mes.receita)}</td>
                      <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: mes.conversao >= 20 ? '#22C55E' : mes.conversao >= 10 ? '#C9A227' : 'var(--text3)' }}>
                        {mes.conversao}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Motivos de perda */}
        <Card>
          <SectionTitle>📉 Motivos de Perda</SectionTitle>
          {m.motivosPerdas.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>Sem dados de motivo de perda registrados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {m.motivosPerdas.map(mp => (
                <div key={mp.motivo}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{mp.motivo}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{mp.count}×</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', width: 32, textAlign: 'right' }}>{mp.pct}%</span>
                    </div>
                  </div>
                  <ProgressBar pct={mp.pct} cor="#EF4444" height={4} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── ROI por Origem + Qualidade de Dados ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>

        {/* ROI por origem */}
        <Card>
          <SectionTitle>📣 ROI por Canal de Origem</SectionTitle>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Canal', 'Leads', 'Conv.', 'Ticket', 'Receita'].map(h => (
                    <th key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textAlign: h === 'Canal' ? 'left' : 'right', padding: '0 6px 10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.origROI.map(o => (
                  <tr key={o.orig} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 6px', fontSize: 11, color: 'var(--text2)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.orig}</td>
                    <td style={{ padding: '9px 6px', fontSize: 11, color: 'var(--text)', textAlign: 'right' }}>{o.leads}</td>
                    <td style={{ padding: '9px 6px', fontSize: 11, textAlign: 'right', fontWeight: 700, color: o.conversao >= 30 ? '#22C55E' : o.conversao >= 15 ? '#C9A227' : 'var(--text3)' }}>{o.conversao}%</td>
                    <td style={{ padding: '9px 6px', fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{fmtR(o.ticketMedio)}</td>
                    <td style={{ padding: '9px 6px', fontSize: 11, color: 'var(--gold)', fontWeight: 700, textAlign: 'right' }}>{fmtR(o.receita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Qualidade de dados */}
        <Card>
          <SectionTitle>✅ Qualidade de Preenchimento</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {m.qualidade.map(q => (
              <div key={q.campo}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{q.label}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{q.preenchidos}/{m.totalLeads}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, width: 36, textAlign: 'right',
                      color: q.pct >= 80 ? '#22C55E' : q.pct >= 50 ? '#C9A227' : '#EF4444' }}>
                      {q.pct}%
                    </span>
                  </div>
                </div>
                <ProgressBar
                  pct={q.pct}
                  cor={q.pct >= 80 ? '#22C55E' : q.pct >= 50 ? '#C9A227' : '#EF4444'}
                  height={4}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Alertas ────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>⚠️ Alertas e Ações Necessárias</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>

          {/* Leads parados */}
          <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🕐</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F97316' }}>{m.alertasParados.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Leads parados +7 dias</div>
              </div>
            </div>
            {m.alertasParados.slice(0, 4).map(a => (
              <div key={a.id} style={{ fontSize: 11, color: 'var(--text2)', padding: '5px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{a.nome}</span>
                <span style={{ color: '#F97316', fontWeight: 700, flexShrink: 0 }}>{a.diasParado}d</span>
              </div>
            ))}
            {m.alertasParados.length === 0 && (
              <div style={{ fontSize: 11, color: '#22C55E', textAlign: 'center', padding: '8px 0' }}>✅ Nenhum lead parado</div>
            )}
          </div>

          {/* Follow-ups vencidos */}
          <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📅</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>{m.alertasFollowup.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Follow-ups vencidos</div>
              </div>
            </div>
            {m.alertasFollowup.slice(0, 4).map(a => (
              <div key={a.id} style={{ fontSize: 11, color: 'var(--text2)', padding: '5px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{a.nome}</span>
                <span style={{ color: '#EF4444', fontWeight: 700, flexShrink: 0 }}>+{a.diasAtraso}d</span>
              </div>
            ))}
            {m.alertasFollowup.length === 0 && (
              <div style={{ fontSize: 11, color: '#22C55E', textAlign: 'center', padding: '8px 0' }}>✅ Nenhum follow-up vencido</div>
            )}
          </div>

          {/* Perdidos sem motivo */}
          <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>❓</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.alertasSemMotivo > 0 ? '#EF4444' : '#22C55E' }}>{m.alertasSemMotivo}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Perdidos sem motivo</div>
              </div>
            </div>
            {m.alertasSemMotivo > 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                Registre o motivo de perda nos leads perdidos para melhorar as métricas de análise.
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#22C55E', textAlign: 'center', padding: '8px 0' }}>✅ Todos com motivo registrado</div>
            )}
          </div>
        </div>
      </Card>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
