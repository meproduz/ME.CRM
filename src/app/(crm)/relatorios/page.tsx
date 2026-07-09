'use client';

import { useMemo } from 'react';
import { useCRM } from '@/store/crm-store';
import { fmtR, diasAtras, leadData } from '@/lib/utils';
import { KANBAN_COLS, ORIGENS, ORIG_COLORS, VAL } from '@/types';

function getLeadValor(l: any) {
  if (l.valor) return Number(l.valor);
  if (l.int) {
    const key = Object.keys(VAL).find((k) => l.int?.toLowerCase().includes(k.toLowerCase()));
    if (key) return VAL[key];
  }
  return 0;
}

type Periodo = 'semana' | 'mes' | 'trim' | 'total';

const PERIODO_LABELS: Record<Periodo, string> = {
  semana: 'Esta semana', mes: 'Este mês', trim: 'Trimestre', total: 'Total',
};

export default function RelatoriosPage() {
  const { state, dispatch } = useCRM();
  const periodo = state.periodoAtivo;

  const fl = useMemo(() => {
    const now = new Date();
    return state.leads.filter((l) => {
      if (periodo === 'total') return true;
      const ld = leadData(l);
      const parts = ld.split('/');
      if (parts.length < 2) return false;
      const d = new Date(now.getFullYear(), Number(parts[1]) - 1, Number(parts[0]));
      if (d > now) d.setFullYear(now.getFullYear() - 1);
      const diff = (now.getTime() - d.getTime()) / 86400000;
      if (periodo === 'semana') return diff <= 7;
      if (periodo === 'mes') return diff <= 30;
      if (periodo === 'trim') return diff <= 90;
      return true;
    });
  }, [state.leads, periodo]);

  const stats = useMemo(() => {
    const fechados = fl.filter((l) => l.status === 'fechado');
    const perdidos = fl.filter((l) => l.status === 'perdido');
    const mrr = fechados.reduce((a, l) => a + getLeadValor(l), 0);
    const conv = fl.length ? Math.round((fechados.length / fl.length) * 100) : 0;
    const tmMed = fl.length > 0 ? Math.round(fl.reduce((a, l) => a + diasAtras(leadData(l)), 0) / fl.length) : 0;
    return { fechados, perdidos, mrr, conv, tmMed };
  }, [fl]);

  const kpis = [
    { label: 'Leads no período', val: String(fl.length), sub: `${stats.fechados.length} fechados · ${stats.perdidos.length} perdidos`, color: 'var(--purple)' },
    { label: 'Receita fechada', val: fmtR(stats.mrr), sub: `${stats.fechados.length} contratos`, color: 'var(--accent)' },
    { label: 'Taxa conversão', val: `${stats.conv}%`, sub: `de ${fl.length} leads`, color: 'var(--green)' },
    { label: 'Tempo médio', val: `${stats.tmMed}d`, sub: 'dias no funil', color: 'var(--blue)' },
  ];

  const maxFunnel = Math.max(...KANBAN_COLS.map((c) => fl.filter((l) => l.status === c.id).length), 1);
  const funnelColors = ['#C9A227', '#3B82F6', '#8B5CF6', '#F97316', '#22C55E', '#E24B4A'];
  const totalOr = fl.length || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div className="page-title">Relatórios</div>
          <div className="page-sub">Análise de performance</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {/* Período */}
        <div className="periodo-row">
          {(Object.keys(PERIODO_LABELS) as Periodo[]).map((p) => (
            <button key={p} className={`periodo-btn${periodo === p ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_PERIODO', payload: p })}>
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>

        {/* KPIs */}
        <div className="rel-grid">
          {kpis.map((k) => (
            <div key={k.label} className="rel-kpi" style={{ borderLeft: `3px solid ${k.color}` }}>
              <div className="rel-kpi-label">{k.label}</div>
              <div className="rel-kpi-val" style={{ color: k.color }}>{k.val}</div>
              <div className="rel-kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="rel-charts">
          {/* Funil */}
          <div className="chart-card">
            <div className="chart-title">Funil do período</div>
            <div className="chart-sub">{PERIODO_LABELS[periodo].toLowerCase()}</div>
            <div className="funnel-rows">
              {KANBAN_COLS.map((col, i) => {
                const n = fl.filter((l) => l.status === col.id).length;
                const pct = Math.max((n / maxFunnel) * 100, n > 0 ? 8 : 0);
                return (
                  <div key={col.id} className="f-row">
                    <div className="f-lbl">{col.label}</div>
                    <div className="f-track">
                      <div className="f-fill" style={{ width: `${pct}%`, background: funnelColors[i] }}>
                        {n > 0 && <span className="f-n">{n}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Origens */}
          <div className="chart-card">
            <div className="chart-title">Origens do período</div>
            <div className="chart-sub">canal de entrada</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ORIGENS.map((o, i) => {
                const n = fl.filter((l) => l.orig === o).length;
                if (!n) return null;
                const pct = Math.round((n / totalOr) * 100);
                const color = Object.values(ORIG_COLORS)[i];
                return (
                  <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div style={{ fontSize: 11, color: 'var(--text2)', flex: 1 }}>{o}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, width: 24, textAlign: 'right' }}>{n}</div>
                    <div style={{ flex: 2, background: 'var(--bg3)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: 4, background: color, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', width: 28, textAlign: 'right' }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
