'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCRM } from '@/store/crm-store';
import { fmtR, diasAtras, isStale, fmtData, ultimoContato, leadData } from '@/lib/utils';
import { KANBAN_COLS, ORIGENS, ORIG_COLORS, VAL } from '@/types';

function getLeadValor(l: any) {
  if (l.valor) return Number(l.valor);
  if (l.int) {
    const key = Object.keys(VAL).find((k) => l.int?.toLowerCase().includes(k.toLowerCase()));
    if (key) return VAL[key];
  }
  return 0;
}

function parseLeadDate(data: string): Date | null {
  if (!data) return null;
  const parts = data.split('/');
  if (parts.length < 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function trendPct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
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

function Clock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR'));
      setDate(now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1, color: 'var(--text)' }}>{time}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, textTransform: 'capitalize' }}>{date}</div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo', contato: 'Em contato', proposta: 'Proposta',
  negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
};

export default function DashboardPage() {
  const { state, dispatch } = useCRM();
  const router = useRouter();
  const { leads, metaMensal, currentUser, waTemplate } = state;

  // ── Stats com trend mês a mês ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    const cm = now.getMonth(), cy = now.getFullYear();
    const pm = cm === 0 ? 11 : cm - 1;
    const py = cm === 0 ? cy - 1 : cy;

    const fechados = leads.filter((l) => l.status === 'fechado');
    const abertos  = leads.filter((l) => l.status !== 'fechado' && l.status !== 'perdido');
    const mrr      = fechados.reduce((a, l) => a + getLeadValor(l), 0);
    const pipe     = abertos.reduce((a, l) => a + getLeadValor(l), 0);
    const conv     = leads.length ? Math.round((fechados.length / leads.length) * 100) : 0;
    const pct      = metaMensal > 0 ? Math.min(Math.round((mrr / metaMensal) * 100), 100) : 0;
    const falta    = Math.max(0, metaMensal - mrr);
    const pipePct  = metaMensal > 0 ? Math.min(Math.round((pipe / metaMensal) * 100), 100) : 0;

    // Leads deste mês vs mês passado
    const tm = leads.filter(l => { const d = parseLeadDate(leadData(l)); return d ? d.getMonth() === cm && d.getFullYear() === cy : false; });
    const prevM = leads.filter(l => { const d = parseLeadDate(leadData(l)); return d ? d.getMonth() === pm && d.getFullYear() === py : false; });
    const tmF = tm.filter(l => l.status === 'fechado');
    const pmF = prevM.filter(l => l.status === 'fechado');
    const tmMrr = tmF.reduce((a, l) => a + getLeadValor(l), 0);
    const pmMrr = pmF.reduce((a, l) => a + getLeadValor(l), 0);
    const tmConv = tm.length > 0 ? Math.round((tmF.length / tm.length) * 100) : 0;
    const pmConv = prevM.length > 0 ? Math.round((pmF.length / prevM.length) * 100) : 0;
    const prevAbertos = prevM.filter(l => l.status !== 'fechado' && l.status !== 'perdido').length;

    return {
      fechados, abertos, mrr, pipe, conv, pct, falta, pipePct,
      trends: {
        mrr:   trendPct(tmMrr, pmMrr),
        leads: trendPct(tm.length, prevM.length),
        conv:  trendPct(tmConv, pmConv),
        pipe:  trendPct(abertos.length, prevAbertos),
      },
    };
  }, [leads, metaMensal]);

  // ── Urgentes ──────────────────────────────────────────────────────────────
  const { novos, parados, fuVenc } = useMemo(() => {
    const novos   = leads.filter((l) => l.status === 'novo');
    const parados = leads
      .filter((l) => isStale(l.hist, leadData(l), l.status) && l.status !== 'novo')
      .sort((a, b) => diasAtras(ultimoContato(b.hist, leadData(b))) - diasAtras(ultimoContato(a.hist, leadData(a))));
    const fuVenc = leads.filter((l) => {
      if (!l.followup || l.status === 'fechado' || l.status === 'perdido') return false;
      return new Date(l.followup + 'T00:00:00') <= new Date();
    }).filter((l) => !novos.includes(l) && !parados.includes(l));
    return { novos, parados, fuVenc };
  }, [leads]);

  // ── Próximos follow-ups (estado vazio dos urgentes) ───────────────────────
  const proximosFu = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return leads
      .filter(l => l.followup && l.status !== 'fechado' && l.status !== 'perdido')
      .filter(l => new Date(l.followup! + 'T00:00:00') > today)
      .sort((a, b) => new Date(a.followup! + 'T00:00:00').getTime() - new Date(b.followup! + 'T00:00:00').getTime())
      .slice(0, 5);
  }, [leads]);

  // ── Atividade recente — últimos leads por created_at ──────────────────────
  const recentLeads = useMemo(() =>
    [...leads]
      .filter(l => l.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6),
  [leads]);

  const totalUrg = novos.length + parados.length + fuVenc.length;
  const urgAll   = [...novos, ...parados, ...fuVenc].slice(0, 7);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = currentUser?.nome?.split(' ')[0] ?? '';

  function openLead(id: string) {
    dispatch({ type: 'SET_ACTIVE_LEAD', payload: id });
    router.push('/pipeline');
  }

  // Funil
  const funnelColors = ['#C9A227', '#3B82F6', '#8B5CF6', '#F97316', '#22C55E', '#E24B4A'];
  const maxFunnel = Math.max(...KANBAN_COLS.map((c) => leads.filter((l) => l.status === c.id).length), 1);
  const hasAnyFunnelData = KANBAN_COLS.some(c => leads.filter(l => l.status === c.id).length > 0);

  // Meta arc
  const R = 54, arcCx = 70, arcCy = 70, sw = 10;
  const arcCirc = 2 * Math.PI * R;
  const arcDash = (stats.pct / 100) * arcCirc;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div className="topbar">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Visão geral</div>
        </div>
        <div className="topbar-right">
          <div className="search-box">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="#444" strokeWidth="1.4"/><path d="M10 10l3 3" stroke="#444" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <input type="text" placeholder="Buscar lead..." onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })} />
          </div>
          <button className="add-btn" onClick={() => router.push('/pipeline?novo=1')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <span className="btn-text">Novo Lead</span>
          </button>
        </div>
      </div>

      {/* Container de scroll: separa overflow do layout flex */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ══ HERO ══ */}
        <div className="dash-hero">
          <div className="dash-hero-glow-bl" aria-hidden="true" />
          <div className="dash-hero-left">
            <div className="dash-greeting">{saudacao},&nbsp;<em>{primeiroNome}!</em></div>
            <div className="dash-greeting-sub">
              {totalUrg > 0
                ? <><span className="dash-alert-dot" />{totalUrg} lead{totalUrg > 1 ? 's urgentes' : ' urgente'}</>
                : 'Tudo em dia · Nenhum lead urgente'}
            </div>
          </div>
          <Clock />
        </div>

        {/* ══ KPI CARDS com trend ══ */}
        <div className="kpi-v2-grid">
          {([
            {
              label: 'Receita do mês', value: fmtR(stats.mrr), sub: `${stats.fechados.length} fechados`,
              trend: stats.trends.mrr,
              accent: '#C9A227', bg: 'linear-gradient(145deg,rgba(201,162,39,0.15) 0%,rgba(201,162,39,0.04) 100%)', border: 'rgba(201,162,39,0.22)',
              icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M9 4.5V6M9 12v1.5M6.5 7.5H10a1 1 0 0 1 0 3H8a1 1 0 0 0 0 2h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>),
            },
            {
              label: 'Em negociação', value: fmtR(stats.pipe), sub: `${stats.abertos.length} oportunidades`,
              trend: stats.trends.pipe,
              accent: '#3B82F6', bg: 'linear-gradient(145deg,rgba(59,130,246,0.15) 0%,rgba(59,130,246,0.04) 100%)', border: 'rgba(59,130,246,0.22)',
              icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2.5 12.5l4-4 3 3 5.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 6h2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
            },
            {
              label: 'Total de leads', value: String(leads.length), sub: 'cadastrados',
              trend: stats.trends.leads,
              accent: '#8B5CF6', bg: 'linear-gradient(145deg,rgba(139,92,246,0.15) 0%,rgba(139,92,246,0.04) 100%)', border: 'rgba(139,92,246,0.22)',
              icon: (<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 15c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="13.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 15c0-2-1.2-3.6-2.5-4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
            },
            {
              label: 'Taxa de conversão', value: `${stats.conv}%`, sub: `${stats.fechados.length} de ${leads.length} leads`,
              trend: stats.trends.conv,
              accent: '#22C55E', bg: 'linear-gradient(145deg,rgba(34,197,94,0.15) 0%,rgba(34,197,94,0.04) 100%)', border: 'rgba(34,197,94,0.22)',
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

        {/* ══ MIDDLE ROW — Meta + Urgentes / Follow-ups ══ */}
        <div className="dash-mid">

          {/* Meta do mês */}
          <div className="dash-meta">
            <div className="dash-section-title">
              Meta do mês
              <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10 }}>
                &nbsp;· {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            {metaMensal === 0 ? (
              <div className="meta-zero-state">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="14" stroke="rgba(201,162,39,0.3)" strokeWidth="1.5" strokeDasharray="5 3"/>
                  <path d="M18 11v8M18 22v3" stroke="rgba(201,162,39,0.7)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p className="meta-zero-title">Meta não configurada</p>
                <p className="meta-zero-sub">Defina uma meta mensal para acompanhar o desempenho da equipe</p>
                <button className="meta-zero-btn" onClick={() => router.push('/configuracoes')}>
                  Configurar meta
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 16 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    {/* Trilha de fundo — mais visível */}
                    <circle cx={arcCx} cy={arcCy} r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={sw}/>
                    {stats.pct > 0 && (
                      <circle cx={arcCx} cy={arcCy} r={R} fill="none" stroke="#C9A227" strokeWidth={sw}
                        strokeDasharray={`${arcDash} ${arcCirc}`} strokeLinecap="round"
                        transform={`rotate(-90 ${arcCx} ${arcCy})`}
                        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)', filter: 'drop-shadow(0 0 6px rgba(201,162,39,0.4))' }}
                      />
                    )}
                    <text x={arcCx} y={arcCy - 4} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="22" fontWeight="800" fill="#fff">{stats.pct}%</text>
                    <text x={arcCx} y={arcCy + 14} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="9" fill="#555" fontWeight="400">atingido</text>
                  </svg>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Receita fechada',  val: fmtR(stats.mrr),   pct: Math.min(stats.pct, 100),   color: '#C9A227' },
                    { label: 'Em negociação',    val: fmtR(stats.pipe),  pct: stats.pipePct,               color: '#3B82F6' },
                    { label: 'Faltam para meta', val: fmtR(stats.falta), pct: Math.min(Math.round((stats.falta / metaMensal) * 100), 100), color: '#F04747' },
                  ].map((b) => (
                    <div key={b.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: 'var(--text2)' }}>{b.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: b.color }}>{b.val}</span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: 2, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Meta mensal</span>
                    <span style={{ color: '#C9A227', fontWeight: 700 }}>{fmtR(metaMensal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Urgentes / Próximos FU */}
          <div className="dash-urgentes">
            <div className="dash-section-title">
              {totalUrg > 0 ? 'Atenção imediata' : 'Próximos follow-ups'}
              {totalUrg > 0 && <span className="dash-urg-badge">{totalUrg}</span>}
            </div>

            {totalUrg === 0 ? (
              proximosFu.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12, flex: 1, overflowY: 'auto' }}>
                  {proximosFu.map((l) => {
                    const valor = getLeadValor(l);
                    const waMsg = encodeURIComponent(waTemplate.replace('{nome}', l.nome));
                    return (
                      <div key={l.id} className="urg-row" onClick={() => openLead(l.id)}
                        style={{ borderLeft: '2px solid #22C55E' }}>
                        <div className="urg-av" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>
                          {l.nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="urg-name">{l.nome}</div>
                          <div className="urg-info">📅 FU em {fmtData(l.followup)}{valor ? ` · ${fmtR(valor)}` : ''}</div>
                        </div>
                        {l.tel && (
                          <button className="urg-wa" onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://wa.me/55${l.tel!.replace(/\D/g, '')}?text=${waMsg}`, '_blank');
                          }}>WA</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="urgentes-empty">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="11" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5"/>
                    <path d="M10 16l5 5 7-8" stroke="rgba(34,197,94,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Tudo em dia!</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>Nenhum urgente nem follow-up pendente</span>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12, flex: 1, overflowY: 'auto' }}>
                {urgAll.map((l) => {
                  const isRed = parados.includes(l), isFu = fuVenc.includes(l);
                  const color = isFu ? '#F97316' : isRed ? '#F04747' : '#C9A227';
                  const valor = getLeadValor(l);
                  const dias  = diasAtras(ultimoContato(l.hist, leadData(l)));
                  const waMsg = encodeURIComponent(waTemplate.replace('{nome}', l.nome));
                  return (
                    <div key={l.id} className="urg-row" onClick={() => openLead(l.id)}
                      style={{ borderLeft: `2px solid ${color}` }}>
                      <div className="urg-av" style={{ background: `${color}18`, color }}>
                        {l.nome.substring(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="urg-name">{l.nome}</div>
                        <div className="urg-info">
                          {isFu ? `FU vencido · ${fmtData(l.followup)}` : isRed ? `${dias}d sem contato` : 'Novo lead'}
                          {valor ? ` · ${fmtR(valor)}` : ''}
                        </div>
                      </div>
                      {l.tel && (
                        <button className="urg-wa" onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://wa.me/55${l.tel!.replace(/\D/g, '')}?text=${waMsg}`, '_blank');
                        }}>WA</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ ATIVIDADE RECENTE ══ */}
        {recentLeads.length > 0 && (
          <div className="dash-atividade">
            <div className="dash-section-title" style={{ marginBottom: 12 }}>
              Atividade recente
              <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10, marginLeft: 2 }}>· últimos leads</span>
            </div>
            <div className="atv-list">
              {recentLeads.map((l) => {
                const valor = getLeadValor(l);
                const col = KANBAN_COLS.find(c => c.id === l.status);
                return (
                  <div key={l.id} className="atv-item" onClick={() => openLead(l.id)}>
                    <div className="atv-av" style={{ background: `${col?.color ?? '#555'}18`, color: col?.color ?? '#555' }}>
                      {l.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="atv-nome">{l.nome}</div>
                      <div className="atv-desc">{l.seg ?? l.orig ?? '—'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      {valor > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold2)' }}>{fmtR(valor)}</span>}
                      <span className={`sp sp-${l.status}`}>{STATUS_LABEL[l.status]}</span>
                    </div>
                    <div className="atv-data">{leadData(l)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ CHARTS ══ */}
        <div className="dash-charts">

          {/* Funil */}
          <div className="dash-chart-card">
            <div className="dash-section-title">Funil de conversão</div>
            {!hasAnyFunnelData ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 0', color: 'var(--text3)', fontSize: 12, fontStyle: 'italic' }}>
                Nenhum dado disponível ainda
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
                {KANBAN_COLS.map((col, i) => {
                  const n = leads.filter((l) => l.status === col.id).length;
                  const pct = Math.max((n / maxFunnel) * 100, n > 0 ? 5 : 0);
                  const pctTotal = leads.length > 0 ? Math.round((n / leads.length) * 100) : 0;
                  return (
                    <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 80, fontSize: 10, color: col.color, fontWeight: 600, flexShrink: 0, textAlign: 'right' }}>{col.label}</div>
                      <div style={{ flex: 1, height: 22, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: funnelColors[i], borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, transition: 'width 0.7s ease' }}>
                          {n > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{n}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', width: 30, textAlign: 'right', flexShrink: 0 }}>{pctTotal}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Origens */}
          <div className="dash-chart-card">
            <div className="dash-section-title">Leads por origem</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ORIGENS.map((o, i) => {
                const n   = leads.filter((l) => l.orig === o).length;
                const pct = leads.length ? Math.round((n / leads.length) * 100) : 0;
                const color = Object.values(ORIG_COLORS)[i] as string;
                return (
                  <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: n > 0 ? `0 0 5px ${color}88` : 'none' }} />
                    <div style={{ flex: 1, fontSize: 10, color: n > 0 ? 'var(--text2)' : 'var(--text3)' }}>{o}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, width: 22, textAlign: 'right', color: n > 0 ? 'var(--text)' : 'var(--text3)' }}>{n}</div>
                    <div style={{ width: 70, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', width: 28, textAlign: 'right' }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>{/* fim flex column */}
      </div>{/* fim scroll container */}
    </div>
  );
}
