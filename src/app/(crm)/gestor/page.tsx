'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCRM } from '@/store/crm-store';
import { useGestorMetrics, LABEL_ETAPA, COR_ETAPA, type MotivoLead } from '@/hooks/useGestorMetrics';

// ── Ações de resgate por motivo ───────────────────────────────────────────────
interface AcaoResgate {
  icon: string;
  label: string;
  desc: string;
  template: string;
  cor: string;
}

function getAcoesResgate(motivo: string): AcaoResgate[] {
  const m = motivo.toLowerCase();

  // Preço / Valor / Custo
  if (/preço|preco|caro|valor|custo|orçamento|orcamento|barato|invest/.test(m)) return [
    {
      icon: '💰', label: 'Condição especial', cor: '#C9A227',
      desc: 'Ofereça um desconto ou bônus pontual com urgência',
      template: 'Olá {nome}! Tenho uma condição especial disponível essa semana que acho que vai fazer mais sentido pra você. Posso te apresentar rapidinho?',
    },
    {
      icon: '📦', label: 'Plano de entrada', cor: '#3B82F6',
      desc: 'Sugira começar com um pacote menor e crescer junto',
      template: 'Olá {nome}! Pensando melhor, temos uma forma de começar menor e ir escalando conforme você vê resultado. Quer entender como funciona?',
    },
    {
      icon: '💳', label: 'Parcelamento', cor: '#22C55E',
      desc: 'Apresente opção parcelada que caiba no orçamento',
      template: 'Olá {nome}! Consegui uma forma de parcelar o investimento que fica bem acessível por mês. Vale a pena a gente conversar?',
    },
  ];

  // Timing / Momento / Prazo
  if (/timing|momento|hora|agora|depois|futuro|prazo|mês|mes|trimestre|ano/.test(m)) return [
    {
      icon: '📅', label: 'Retomar em 30 dias', cor: '#F97316',
      desc: 'Agende um contato para quando o momento melhorar',
      template: 'Olá {nome}! Sei que o momento não era ideal. Passando pra perguntar se as coisas ficaram mais tranquilas e se faz sentido a gente conversar de novo?',
    },
    {
      icon: '📱', label: 'Nutrição de valor', cor: '#8B5CF6',
      desc: 'Envie conteúdo útil sem pressão de venda',
      template: 'Olá {nome}! Pensei em você ao ver isso e queria compartilhar — pode ser relevante pro seu momento atual. Abraço!',
    },
    {
      icon: '🎯', label: 'Nova proposta em 60d', cor: '#C9A227',
      desc: 'Reaborde com ângulo diferente após 60 dias',
      template: 'Olá {nome}! Faz um tempo desde nosso último papo. Temos novidades que podem se encaixar melhor na sua realidade agora. Posso apresentar?',
    },
  ];

  // Concorrência / Já tem / Outro fornecedor
  if (/concorrên|concorren|outro|fornecedor|já tem|ja tem|contrat|parceiro/.test(m)) return [
    {
      icon: '🏆', label: 'Apresentar diferencial', cor: '#C9A227',
      desc: 'Destaque o que a MP faz que o concorrente não faz',
      template: 'Olá {nome}! Entendo que você escolheu outro caminho. Temos clientes que também vieram de outras agências e adoram comparar os resultados. Posso te mostrar a diferença?',
    },
    {
      icon: '📊', label: 'Case de resultado', cor: '#22C55E',
      desc: 'Compartilhe resultado concreto de cliente similar',
      template: 'Olá {nome}! Acabamos de fechar um case incrível com um cliente do mesmo segmento que o seu. Posso te mostrar o que alcançamos em 90 dias?',
    },
    {
      icon: '🤝', label: 'Parceria futura', cor: '#3B82F6',
      desc: 'Mantenha a porta aberta para quando mudar de ideia',
      template: 'Olá {nome}! Sem pressão, só queria manter o contato. Se em algum momento precisar de uma segunda opinião ou quiser comparar, estou aqui!',
    },
  ];

  // Sem interesse / Não precisa
  if (/interesse|precisa|não quer|nao quer|irrelevante|não vejo|nao vejo/.test(m)) return [
    {
      icon: '🎯', label: 'Nova dor identificada', cor: '#EF4444',
      desc: 'Aborde com ângulo diferente focado em outra dor',
      template: 'Olá {nome}! Estou com uma pergunta rápida — percebi uma oportunidade no seu negócio que talvez não tenhamos falado antes. Topa 5 minutos?',
    },
    {
      icon: '📚', label: 'Conteúdo educativo', cor: '#8B5CF6',
      desc: 'Envie conteúdo que gere consciência do problema',
      template: 'Olá {nome}! Sem compromisso, queria compartilhar algo que tem ajudado muito negócios parecidos com o seu. Espero que seja útil!',
    },
    {
      icon: '⏸️', label: 'Retorno em 90 dias', cor: '#6E6E80',
      desc: 'Dê espaço e retome quando o cenário mudar',
      template: 'Olá {nome}! Passando só pra dizer oi e ver como as coisas estão. Se em algum momento fizer sentido conversar sobre crescimento, estarei aqui!',
    },
  ];

  // Não respondeu / Sumiu / Ghosting
  if (/respond|sumiu|contato|retorn|visu|ghost|desaparec/.test(m)) return [
    {
      icon: '💬', label: 'Mensagem break-up', cor: '#EF4444',
      desc: 'Última tentativa direta e honesta — alta taxa de resposta',
      template: 'Olá {nome}! Últimas tentativas de contato sem retorno, então vou entender que não é o momento certo. Se mudar de ideia, a porta fica aberta. Abraço!',
    },
    {
      icon: '😊', label: 'Check-in informal', cor: '#F97316',
      desc: 'Mensagem curta e leve, sem falar de venda',
      template: 'Olá {nome}! Tudo bem por aí? Passando rapidinho só pra dar um oi! 😊',
    },
    {
      icon: '🎁', label: 'Oferta surpresa', cor: '#C9A227',
      desc: 'Ofereça algo grátis (diagnóstico, consultoria) como gancho',
      template: 'Olá {nome}! Estou oferecendo um diagnóstico gratuito do marketing digital essa semana pra alguns contatos selecionados. Topa?',
    },
  ];

  // Padrão genérico
  return [
    {
      icon: '📱', label: 'Recontato suave', cor: '#AEAEC0',
      desc: 'Mensagem leve e sem pressão para reabrir o canal',
      template: 'Olá {nome}! Passando pra dar um oi e ver se surgiu alguma novidade por aí. Se precisar de algo, estou à disposição!',
    },
    {
      icon: '🎯', label: 'Nova proposta', cor: '#C9A227',
      desc: 'Reaborde com proposta atualizada e diferente',
      template: 'Olá {nome}! Temos algumas novidades desde nosso último papo. Vale 10 minutos pra eu te mostrar?',
    },
    {
      icon: '📅', label: 'Agendar conversa', cor: '#3B82F6',
      desc: 'Proponha uma reunião rápida sem compromisso',
      template: 'Olá {nome}! Queria bater um papo de 15 minutos, sem compromisso. Quando você teria um momento essa semana?',
    },
  ];
}

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
  const { state, dispatch } = useCRM();
  const m = useGestorMetrics();

  useEffect(() => {
    if (state.currentUser && state.currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [state.currentUser, router]);

  const [motivoSel, setMotivoSel] = useState<string | null>(null);
  const [selectedAcao, setSelectedAcao] = useState(0);
  useEffect(() => { setSelectedAcao(0); }, [motivoSel]);
  const motivoLeads: MotivoLead[] = motivoSel ? (m.leadsByMotivo[motivoSel] ?? []) : [];

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

        {/* ══ META DO MÊS ══ */}
        {m.metaMensal > 0 && (() => {
          const pctMeta = Math.min(Math.round((m.receitaNoMes / m.metaMensal) * 100), 100);
          const pctForecast = Math.min(Math.round((m.forecastComFechados / m.metaMensal) * 100), 100);
          const falta = Math.max(0, m.metaMensal - m.receitaNoMes);
          const R = 52, cx = 68, cy = 68, sw = 10;
          const circ = 2 * Math.PI * R;
          const dash = (pctMeta / 100) * circ;
          const corProb = m.probBaterMeta >= 80 ? '#22C55E' : m.probBaterMeta >= 50 ? '#F97316' : '#EF4444';
          return (
            <div className="dash-meta" style={{ background: 'linear-gradient(145deg,rgba(201,162,39,0.07) 0%,rgba(201,162,39,0.02) 100%)', border: '1px solid rgba(201,162,39,0.15)' }}>
              <div className="dash-section-title">Meta do Mês
                <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10 }}>&nbsp;· {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 14 }}>
                {/* Arc */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg width="136" height="136" viewBox="0 0 136 136">
                    <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw}/>
                    {pctMeta > 0 && (
                      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#C9A227" strokeWidth={sw}
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                        transform={`rotate(-90 ${cx} ${cy})`}
                        style={{ transition: 'stroke-dasharray 0.8s ease', filter: 'drop-shadow(0 0 6px rgba(201,162,39,0.4))' }}
                      />
                    )}
                    <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="20" fontWeight="800" fill="#fff">{pctMeta}%</text>
                    <text x={cx} y={cy + 13} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="9" fill="#555">atingido</text>
                  </svg>
                </div>
                {/* Barras */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Receita fechada',    val: fmtR(m.receitaNoMes),       pct: pctMeta,                           color: '#C9A227' },
                    { label: 'Forecast total',      val: fmtR(m.forecastComFechados), pct: pctForecast,                       color: '#3B82F6' },
                    { label: 'Faltam para a meta', val: fmtR(falta),                pct: Math.min(Math.round((falta / m.metaMensal) * 100), 100), color: '#EF4444' },
                  ].map((b) => (
                    <div key={b.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: 'var(--text2)' }}>{b.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: b.color }}>{b.val}</span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: 2, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>Prob. de bater a meta</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>Meta: {fmtR(m.metaMensal)}</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: corProb }}>{m.probBaterMeta}%</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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

          {/* Motivos de perda — clicáveis */}
          <div className="dash-meta">
            <div className="dash-section-title">Motivos de Perda
              <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>clique para ver os leads</span>
            </div>
            {m.motivosPerdas.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, padding: '24px 0', color: 'var(--text3)', fontSize: 12 }}>
                <div style={{ fontSize: 28 }}>✅</div>
                Nenhum motivo registrado ainda
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {m.motivosPerdas.slice(0, 6).map((mp, i) => (
                  <div key={i}
                    onClick={() => setMotivoSel(motivoSel === mp.motivo ? null : mp.motivo)}
                    style={{
                      cursor: 'pointer', padding: '8px 10px', borderRadius: 8,
                      background: motivoSel === mp.motivo ? 'rgba(239,68,68,0.1)' : 'transparent',
                      border: `1px solid ${motivoSel === mp.motivo ? 'rgba(239,68,68,0.3)' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (motivoSel !== mp.motivo) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (motivoSel !== mp.motivo) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: motivoSel === mp.motivo ? '#EF4444' : 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8, fontWeight: motivoSel === mp.motivo ? 700 : 400 }}>
                        {mp.motivo}
                      </span>
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

      {/* ── Painel lateral: leads perdidos por motivo ── */}
      {motivoSel && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 200,
          width: 360, background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          animation: 'slideInRight 0.22s ease',
        }}>
          {/* Header */}
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Motivo de perda</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', lineHeight: 1.3 }}>{motivoSel}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                  {motivoLeads.length} lead{motivoLeads.length !== 1 ? 's' : ''} · clique para abrir no pipeline
                </div>
              </div>
              <button onClick={() => setMotivoSel(null)} style={{
                background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)',
                borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>×</button>
            </div>
            {/* Ações de resgate dinâmicas */}
            {(() => {
              const acoes = getAcoesResgate(motivoSel);
              const acao = acoes[Math.min(selectedAcao, acoes.length - 1)];
              return (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                    Ações de resgate
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                    {acoes.map((a, i) => (
                      <button key={i}
                        onClick={e => { e.stopPropagation(); setSelectedAcao(i); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                          border: `1px solid ${selectedAcao === i ? a.cor : 'var(--border)'}`,
                          background: selectedAcao === i ? `${a.cor}22` : 'var(--bg3)',
                          color: selectedAcao === i ? a.cor : 'var(--text3)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {a.icon} {a.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ padding: '8px 12px', background: `${acao.cor}14`, border: `1px solid ${acao.cor}35`, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: acao.cor, fontWeight: 700, marginBottom: 2 }}>{acao.icon} {acao.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>{acao.desc}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Lista de leads */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {motivoLeads.map((lead) => (
              <div key={lead.id}
                onClick={() => { dispatch({ type: 'SET_ACTIVE_LEAD', payload: lead.id }); router.push('/pipeline'); }}
                style={{
                  padding: '12px 14px', background: 'var(--bg3)', borderRadius: 10,
                  border: '1px solid var(--border)', cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(239,68,68,0.3)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(239,68,68,0.12)', color: '#EF4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800,
                  }}>
                    {lead.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.nome}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      {[lead.seg, lead.orig].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      {lead.valor > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)' }}>
                          R$ {lead.valor.toLocaleString('pt-BR')}
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: 'var(--text3)' }}>perdido em {lead.dataPerdido}</span>
                    </div>
                  </div>
                  {/* WhatsApp */}
                  {lead.tel && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const acoes = getAcoesResgate(motivoSel!);
                        const acao = acoes[Math.min(selectedAcao, acoes.length - 1)];
                        const texto = acao.template.replace('{nome}', lead.nome.split(' ')[0]);
                        window.open(`https://wa.me/55${lead.tel!.replace(/\D/g,'')}?text=${encodeURIComponent(texto)}`, '_blank');
                      }}
                      title={`Enviar via WhatsApp — "${getAcoesResgate(motivoSel!)[Math.min(selectedAcao, getAcoesResgate(motivoSel!).length-1)].label}"`}
                      style={{
                        flexShrink: 0, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.2)',
                        color: '#25D366', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                      }}
                    >WA</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer com total de valor perdido */}
          {motivoLeads.some(l => l.valor > 0) && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Receita potencial perdida</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#EF4444' }}>
                  R$ {motivoLeads.reduce((s, l) => s + l.valor, 0).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Overlay escuro quando painel aberto */}
      {motivoSel && (
        <div onClick={() => setMotivoSel(null)} style={{
          position: 'fixed', inset: 0, zIndex: 199,
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
        }} />
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        @keyframes slideInRight { from{transform:translateX(100%)} to{transform:translateX(0)} }
      `}</style>
    </div>
  );
}
