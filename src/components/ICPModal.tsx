'use client';

/**
 * ICPModal — Diagnóstico de Ideal Customer Profile
 * Porta do diagnostico-icp.html adaptado ao visual dark do CRM.
 * Pesos e gates configurados alinhados ao processo comercial da Me Produz.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

// ─── Dimensões ────────────────────────────────────────────────────────────────

const DIMS = [
  {
    key: 'consciencia',
    label: 'Consciência',
    weight: 2,
    gate: 0,
    color: '#3B82F6',
    question: 'O cliente já pesquisou outras agências ou soluções antes de falar com vocês?',
    options: [
      { text: 'Pesquisou bastante, comparou várias opções e entende bem o problema', value: 9 },
      { text: 'Começou a pesquisar recentemente, ainda entendendo o problema', value: 5 },
      { text: 'Ficou curioso ao ver a agência, não tinha buscado nada antes', value: 2 },
    ],
  },
  {
    key: 'poder',
    label: 'Poder de compra',
    weight: 3,
    gate: 5,
    color: '#1D9E75',
    question: 'Qual a situação de orçamento do cliente para contratar a agência?',
    options: [
      { text: 'Orçamento aprovado e disponível agora', value: 10 },
      { text: 'Orçamento em discussão ou aprovação interna', value: 6 },
      { text: 'Sem orçamento definido, "precisa ver se cabe"', value: 2 },
    ],
  },
  {
    key: 'comprometimento',
    label: 'Comprometimento',
    weight: 2,
    gate: 0,
    color: '#F97316',
    question: 'Como está o engajamento do cliente e qual foi a experiência dele com agências anteriores?',
    options: [
      { text: 'Já teve agência, sabe o que quer, responde rápido e prioriza', value: 9 },
      { text: 'Nunca teve agência mas está engajado, pergunta e responde bem', value: 6 },
      { text: 'Pouco interesse, demora para responder, sem urgência', value: 2 },
    ],
  },
  {
    key: 'fase',
    label: 'Fase no negócio',
    weight: 3,
    gate: 5,
    color: '#8B5CF6',
    question: 'Em que fase está o negócio do cliente hoje?',
    options: [
      { text: 'Empresa estruturada, já fatura e tem caixa para investir', value: 10 },
      { text: 'Empresa em crescimento, fatura mas orçamento apertado', value: 6 },
      { text: 'Empresa começando agora, ainda sem caixa consistente', value: 2 },
    ],
  },
] as const;

type DimKey = 'consciencia' | 'poder' | 'comprometimento' | 'fase';
type Answers = Partial<Record<DimKey, number>>;

// ─── Lógica de score ──────────────────────────────────────────────────────────

interface ICPResult {
  score: number;
  label: string;
  gateFailed: boolean;
  failedGates: string[];
  rec: string;
}

function calcResult(answers: Required<Answers>): ICPResult {
  let weighted = 0, weightSum = 0;
  const failedGates: string[] = [];

  for (const d of DIMS) {
    const val = answers[d.key];
    weighted  += val * d.weight;
    weightSum += 10  * d.weight;
    if (d.gate > 0 && val < d.gate) failedGates.push(d.label);
  }

  const score      = Math.round((weighted / weightSum) * 100);
  const gateFailed = failedGates.length > 0;

  let label: string;
  if (gateFailed)   label = 'Fora do ICP';
  else if (score >= 71) label = 'ICP ideal';
  else if (score >= 41) label = 'ICP morno';
  else              label = 'ICP frio';

  let rec: string;
  if (gateFailed) {
    rec = 'Não avance para proposta agora. Reavalie em um novo contato quando o orçamento ou a fase do negócio mudarem.';
  } else if (label === 'ICP ideal') {
    rec = 'Perfil forte em todas as frentes. Priorize esse lead: abordagem consultiva direta e proposta comercial.';
  } else if (label === 'ICP morno') {
    rec = 'Base sólida em poder de compra e fase do negócio. Trabalhe consciência com conteúdo educativo e comprometimento com um plano de próximos passos claro.';
  } else {
    rec = 'Perfil ainda distante do ideal. Invista em nutrição antes de gastar tempo comercial direto.';
  }

  return { score, label, gateFailed, failedGates, rec };
}

// ─── Cores por classificação ──────────────────────────────────────────────────

const ICP_STYLE: Record<string, { bg: string; color: string }> = {
  'ICP ideal':   { bg: 'rgba(34,197,94,0.15)',   color: '#22C55E' },
  'ICP morno':   { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B' },
  'ICP frio':    { bg: 'rgba(226,75,74,0.12)',   color: '#E24B4A' },
  'Fora do ICP': { bg: 'rgba(107,114,128,0.15)', color: '#6B7280' },
};

// ─── Radar chart (SVG puro) ───────────────────────────────────────────────────

function RadarChart({ answers }: { answers: Required<Answers> }) {
  const cx = 110, cy = 110, r = 78;
  const n = DIMS.length;

  function getPoints(vs: number[], radius: number): [number, number][] {
    return vs.map((v, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const rad   = (v / 10) * radius;
      return [cx + rad * Math.cos(angle), cy + rad * Math.sin(angle)];
    });
  }

  const ringFracs  = [0.25, 0.5, 0.75, 1];
  const outerPts   = getPoints([10, 10, 10, 10], r);
  const dataPts    = getPoints(DIMS.map(d => answers[d.key]), r);
  const labelPts   = getPoints([10, 10, 10, 10], r + 22);

  return (
    <svg viewBox="0 0 220 220" style={{ width: '100%', maxWidth: 200 }}>
      {/* Rings */}
      {ringFracs.map((f, ri) => {
        const rPts = getPoints([10, 10, 10, 10], r * f);
        return (
          <polygon key={ri}
            points={rPts.map(p => p.join(',')).join(' ')}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        );
      })}
      {/* Axes */}
      {outerPts.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {/* Data polygon */}
      <polygon
        points={dataPts.map(p => p.join(',')).join(' ')}
        fill="rgba(201,162,39,0.18)" stroke="#C9A227" strokeWidth="1.5" />
      {/* Dots */}
      {dataPts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={DIMS[i].color} />
      ))}
      {/* Labels */}
      {DIMS.map((d, i) => (
        <text key={i} x={labelPts[i][0]} y={labelPts[i][1]}
          textAnchor="middle" dominantBaseline="middle"
          fill="#888896" style={{ fontSize: 9, fontFamily: 'Inter, sans-serif' }}>
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  leadNome: string;
  existingScore?: number | null;
  existingLabel?: string | null;
  onConfirm: (score: number, label: string) => void;
  onClose: () => void;
}

export default function ICPModal({ leadNome, existingScore, existingLabel, onConfirm, onClose }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult]   = useState<ICPResult | null>(null);

  const allAnswered = DIMS.every(d => answers[d.key] !== undefined);

  function generate() {
    if (!allAnswered) return;
    setResult(calcResult(answers as Required<Answers>));
  }

  function redo() {
    setResult(null);
    setAnswers({});
  }

  const icpStyle = result ? (ICP_STYLE[result.label] ?? ICP_STYLE['ICP frio']) : null;

  return (
    <motion.div
      className="modal-overlay"
      style={{ display: 'flex', zIndex: 500, alignItems: 'flex-start', overflowY: 'auto', padding: '20px 0' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        style={{ width: 520, maxWidth: '95vw', margin: 'auto' }}
        initial={{ scale: 0.92, y: -16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              🎯 Diagnóstico de ICP
            </h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{leadNome}</div>
          {existingScore != null && !result && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 8,
              background: ICP_STYLE[existingLabel ?? '']?.bg ?? 'rgba(100,100,100,0.1)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 11, color: ICP_STYLE[existingLabel ?? '']?.color ?? '#888', fontWeight: 600 }}>
                Qualificação atual: {existingLabel} · {existingScore}/100
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>— responda novamente para atualizar</span>
            </div>
          )}
        </div>

        {/* ── Perguntas ── */}
        {!result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {DIMS.map((d) => (
              <div key={d.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: d.color }}>
                    {d.label}{d.gate > 0 ? ' · eliminatório' : ''}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10, lineHeight: 1.45 }}>
                  {d.question}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {d.options.map((o, i) => {
                    const selected = answers[d.key] === o.value;
                    return (
                      <label
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 12px',
                          background: selected ? 'rgba(201,162,39,0.07)' : 'rgba(255,255,255,0.025)',
                          border: `1px solid ${selected ? 'rgba(201,162,39,0.45)' : 'rgba(255,255,255,0.07)'}`,
                          borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onClick={() => setAnswers(a => ({ ...a, [d.key]: o.value }))}
                      >
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                          background: selected ? '#C9A227' : 'transparent',
                          border: `2px solid ${selected ? '#C9A227' : 'rgba(255,255,255,0.2)'}`,
                          transition: 'all 0.15s',
                        }} />
                        <span style={{ fontSize: 12.5, color: selected ? 'var(--text)' : 'var(--text2)', lineHeight: 1.45 }}>
                          {o.text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="mfooter" style={{ marginTop: 4 }}>
              <button className="mcbtn" onClick={onClose}>Cancelar</button>
              <button
                className="msbtn"
                style={{ flex: 2, opacity: allAnswered ? 1 : 0.4, cursor: allAnswered ? 'pointer' : 'not-allowed' }}
                onClick={generate}
                disabled={!allAnswered}
              >
                Gerar diagnóstico
              </button>
            </div>
          </div>
        )}

        {/* ── Resultado ── */}
        {result && icpStyle && (
          <div>
            {/* Radar + Score */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16, alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <RadarChart answers={answers as Required<Answers>} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  display: 'inline-block', padding: '6px 16px', borderRadius: 100,
                  background: icpStyle.bg, color: icpStyle.color,
                  fontSize: 12, fontWeight: 700, marginBottom: 14,
                }}>
                  {result.label}
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: 48, fontWeight: 700,
                  color: icpStyle.color, lineHeight: 1,
                }}>
                  {result.score}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>pontuação de 0 a 100</div>
              </div>
            </div>

            {/* Gate warning */}
            {result.gateFailed && (
              <div style={{
                background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.2)',
                borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#E24B4A',
                marginBottom: 12, lineHeight: 1.55,
              }}>
                ⚠️ Critério eliminatório não atendido: <strong>{result.failedGates.join(' e ')}</strong>.
                Mesmo com boa pontuação geral, este lead está fora do ICP hoje.
              </div>
            )}

            {/* Recomendação */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, padding: '12px 14px', fontSize: 12.5, color: 'var(--text2)',
              lineHeight: 1.6, marginBottom: 16,
            }}>
              {result.rec}
            </div>

            {/* Breakdown por dimensão */}
            <div style={{ marginBottom: 20 }}>
              {DIMS.map(d => (
                <div key={d.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 12, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <span style={{ color: 'var(--text2)' }}>
                    {d.label}{d.gate > 0 ? ' (eliminatório)' : ''}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: d.color, fontWeight: 700 }}>
                    {answers[d.key]}/10
                  </span>
                </div>
              ))}
            </div>

            {/* Ações */}
            <div className="mfooter">
              <button className="mcbtn" onClick={redo}>Refazer</button>
              <button
                className="msbtn"
                style={{ flex: 2 }}
                onClick={() => onConfirm(result.score, result.label)}
              >
                Salvar qualificação
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
