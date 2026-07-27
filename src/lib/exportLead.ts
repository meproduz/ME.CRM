/**
 * exportLead.ts
 * Exportação de lead individual em PDF (visual) e CSV (dados brutos).
 * Chamado pelo botão "Exportar" no LeadPanel.
 */

import type { Lead } from '@/types';
import { fmtR, qualScore, leadData, leadHora, getLeadValor } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function htmlEsc(v: string | null | undefined): string {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvEsc(v: string | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo', contato: 'Em Contato', proposta: 'Proposta',
  negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
};

const STATUS_COLOR: Record<string, string> = {
  novo: '#C9A227', contato: '#3B82F6', proposta: '#8B5CF6',
  negociacao: '#F97316', fechado: '#22C55E', perdido: '#E24B4A',
};

// ─── CSV ─────────────────────────────────────────────────────────────────────

export function exportLeadCSV(lead: Lead): void {
  const ld    = leadData(lead);
  const score = qualScore(lead);
  const valor = getLeadValor(lead);

  const rows: string[] = [
    'DADOS DO LEAD',
    'Campo,Valor',
    `Nome,${csvEsc(lead.nome)}`,
    `Telefone,${csvEsc(lead.tel)}`,
    `E-mail,${csvEsc(lead.email)}`,
    `Segmento,${csvEsc(lead.seg)}`,
    `Origem,${csvEsc(lead.orig)}`,
    `Etapa,${csvEsc(STATUS_LABEL[lead.status] ?? lead.status)}`,
    `Interesse,${csvEsc(lead.int)}`,
    `Valor (R$),${valor > 0 ? String(valor) : ''}`,
    `Score de qualificação,${score}/5`,
    `Follow-up agendado,${csvEsc(lead.followup)}`,
    `Data de entrada,${csvEsc(ld)}`,
    `Hora de entrada,${csvEsc(leadHora(lead))}`,
    `Observação inicial,${csvEsc(lead.obs)}`,
    `Motivo de perda,${csvEsc(lead.motivo_perda)}`,
    `Lead ID,${csvEsc(lead.id)}`,
    `Cliente ID,${csvEsc(lead.cliente_id)}`,
    '',
    'HISTÓRICO DE MOVIMENTAÇÕES',
    'Entrada',
    ...(lead.obs ? [csvEsc(`📋 Observação inicial — ${lead.obs}`)] : []),
    ...(lead.hist.length === 0
      ? ['(Sem histórico registrado nesta sessão)']
      : lead.hist.map((e) => csvEsc(e))),
  ];

  const content = '﻿' + rows.join('\r\n'); // BOM para Excel UTF-8
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;

  const safeName = (lead.nome || 'lead')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  a.download = `lead_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function exportLeadPDF(lead: Lead): void {
  const ld          = leadData(lead);
  const hora        = leadHora(lead);
  const score       = qualScore(lead);
  const valor       = getLeadValor(lead);
  const statusLabel = STATUS_LABEL[lead.status] ?? lead.status;
  const statusColor = STATUS_COLOR[lead.status] ?? '#888';
  const scorePct    = Math.round((score / 5) * 100);
  const now         = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Build timeline ────────────────────────────────────────────────────────
  let tlHTML = '';

  if (lead.obs) {
    tlHTML += `
      <div class="tl-item">
        <div class="tl-dot tl-obs"></div>
        <div class="tl-content">
          <div class="tl-obs-box">
            <div class="tl-obs-label">📋 Observação inicial</div>
            <div class="tl-obs-body">${htmlEsc(lead.obs)}</div>
          </div>
        </div>
      </div>`;
  }

  if (lead.hist.length === 0 && !lead.obs) {
    tlHTML = '<div class="tl-empty">Sem histórico registrado nesta sessão.</div>';
  } else {
    for (const entry of lead.hist) {
      if (entry.includes('📝')) {
        const dashIdx = entry.indexOf('—');
        const header  = dashIdx >= 0 ? entry.slice(0, dashIdx).trim() : entry;
        const body    = dashIdx >= 0 ? entry.slice(dashIdx + 1).trim() : '';
        tlHTML += `
          <div class="tl-item">
            <div class="tl-dot tl-note"></div>
            <div class="tl-content">
              <div class="tl-note-header">${htmlEsc(header)}</div>
              ${body ? `<div class="tl-note-body">${htmlEsc(body)}</div>` : ''}
            </div>
          </div>`;
      } else {
        tlHTML += `
          <div class="tl-item">
            <div class="tl-dot tl-move"></div>
            <div class="tl-content">
              <div class="tl-move-text">${htmlEsc(entry)}</div>
            </div>
          </div>`;
      }
    }
  }

  // ── HTML document ─────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lead — ${htmlEsc(lead.nome)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Comfortaa:wght@300;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#fff;color:#1a1a2e;max-width:780px;margin:0 auto}

/* Print bar */
.print-bar{position:sticky;top:0;background:#fafafa;border-bottom:1px solid #eeeef4;padding:10px 32px;display:flex;justify-content:flex-end;z-index:99}
.print-btn{padding:9px 22px;background:#C9A227;border:none;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:13px;font-weight:700;color:#07050a;cursor:pointer;display:flex;align-items:center;gap:6px}
.print-btn:hover{background:#dbb82f}
@media print{.print-bar{display:none}}

/* Gold top line */
.gold-line{height:3px;background:linear-gradient(90deg,#B8901F,#DDB035 40%,#E8BB3A 65%,#C9A227)}

/* Header */
.doc-header{padding:20px 32px 16px;border-bottom:1px solid #f0f0f4;display:flex;align-items:center;justify-content:space-between}
.brand-row{display:flex;align-items:center;gap:10px}
.brand-icon{width:34px;height:34px;border-radius:9px;background:#C9A227;display:flex;align-items:center;justify-content:center;font-family:'Comfortaa',sans-serif;font-size:12px;font-weight:700;color:#07050a;flex-shrink:0}
.brand-name{font-family:'Comfortaa',sans-serif;font-size:14px;font-weight:700;color:#0a0a1a}
.brand-name span{color:#C9A227}
.doc-sub{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c0c0cc;margin-top:1px}
.doc-date{font-size:10px;color:#c0c0cc;text-align:right}

/* Lead Hero */
.lead-hero{padding:24px 32px;background:linear-gradient(135deg,#fafafa 0%,#f3f3f8 100%);border-bottom:1px solid #ececf4}
.hero-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:12px}
.lead-nome{font-size:26px;font-weight:700;color:#0a0a1a;line-height:1.15}
.lead-meta{font-size:11px;color:#aaa;margin-top:5px}
.status-pill{padding:5px 14px;border-radius:100px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#fff;flex-shrink:0;margin-top:6px;white-space:nowrap}

.lead-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.lf{display:flex;flex-direction:column}
.lf-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#c0c0cc;margin-bottom:3px}
.lf-value{font-size:13px;color:#2a2a3a;font-weight:500}
.lf-empty{color:#d0d0d8;font-style:italic;font-weight:300}

.score-row{display:flex;align-items:center;gap:8px;margin-top:2px}
.score-track{width:72px;height:4px;background:#e4e4ef;border-radius:2px;overflow:hidden}
.score-fill{height:4px;background:#C9A227;border-radius:2px}
.score-num{font-size:11px;font-weight:700;color:#888}

.perda-tag{display:inline-block;padding:4px 10px;background:rgba(226,75,74,0.08);border:1px solid rgba(226,75,74,0.2);border-radius:6px;font-size:11px;color:#E24B4A;margin-top:2px}

/* Timeline section */
.tl-section{padding:24px 32px 40px}
.tl-heading{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#c0c0cc;margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #f0f0f4}
.tl-list{position:relative}
.tl-spine{position:absolute;left:3px;top:8px;bottom:0;width:1px;background:#eeeeee}
.tl-item{display:flex;gap:16px;margin-bottom:18px;position:relative}
.tl-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;position:relative;z-index:1}
.tl-note{background:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,0.14)}
.tl-move{background:#22C55E}
.tl-obs{background:#C9A227;box-shadow:0 0 0 3px rgba(201,162,39,0.14)}
.tl-content{flex:1}
.tl-note-header{font-size:10px;font-weight:600;color:#999;margin-bottom:5px}
.tl-note-body{font-size:12.5px;color:#333;line-height:1.65;background:#f5f8ff;border:1px solid #e4ecff;padding:10px 13px;border-radius:0 8px 8px 8px}
.tl-move-text{font-size:12px;color:#666;line-height:1.5;padding-top:3px}
.tl-obs-box{background:#fffcf0;border:1px solid #f0e8cc;padding:10px 13px;border-radius:0 8px 8px 8px}
.tl-obs-label{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#C9A227;margin-bottom:5px}
.tl-obs-body{font-size:12.5px;color:#555;line-height:1.65}
.tl-empty{font-size:12px;color:#bbb;font-style:italic}

/* Footer */
.doc-footer{padding:14px 32px;border-top:1px solid #f0f0f4;display:flex;justify-content:space-between;align-items:center}
.doc-footer span{font-size:9px;color:#d0d0d8}

@media print{
  body{max-width:100%}
  .lead-hero,.tl-note-body,.tl-obs-box{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>
</head>
<body>

<div class="gold-line"></div>

<div class="print-bar">
  <button class="print-btn" onclick="window.print()">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="4" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
      <path d="M4 4V2.5A.5.5 0 014.5 2h5a.5.5 0 01.5.5V4" stroke="currentColor" stroke-width="1.3"/>
      <rect x="3.5" y="7.5" width="7" height="5" rx=".5" fill="currentColor" opacity=".18"/>
      <path d="M4 8h6M4 10h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
    </svg>
    Imprimir / Salvar PDF
  </button>
</div>

<div class="doc-header">
  <div class="brand-row">
    <div class="brand-icon">Mp.</div>
    <div>
      <div class="brand-name">Mp. <span>CRM</span></div>
      <div class="doc-sub">Relatório de Lead</div>
    </div>
  </div>
  <div class="doc-date">Gerado em ${now}</div>
</div>

<div class="lead-hero">
  <div class="hero-top">
    <div>
      <div class="lead-nome">${htmlEsc(lead.nome)}</div>
      <div class="lead-meta">Entrada: ${ld} às ${hora}</div>
    </div>
    <div class="status-pill" style="background:${statusColor}">${statusLabel}</div>
  </div>

  <div class="lead-grid">
    <div class="lf">
      <div class="lf-label">Telefone</div>
      <div class="lf-value ${!lead.tel ? 'lf-empty' : ''}">${htmlEsc(lead.tel) || 'Não informado'}</div>
    </div>
    <div class="lf">
      <div class="lf-label">E-mail</div>
      <div class="lf-value ${!lead.email ? 'lf-empty' : ''}">${htmlEsc(lead.email) || 'Não informado'}</div>
    </div>
    <div class="lf">
      <div class="lf-label">Segmento</div>
      <div class="lf-value ${!lead.seg ? 'lf-empty' : ''}">${htmlEsc(lead.seg) || 'Não definido'}</div>
    </div>
    <div class="lf">
      <div class="lf-label">Origem</div>
      <div class="lf-value ${!lead.orig ? 'lf-empty' : ''}">${htmlEsc(lead.orig) || 'Não informado'}</div>
    </div>
    <div class="lf">
      <div class="lf-label">Interesse</div>
      <div class="lf-value ${!lead.int ? 'lf-empty' : ''}">${lead.int ? htmlEsc(lead.int.split(' - ')[0]) : 'Não definido'}</div>
    </div>
    <div class="lf">
      <div class="lf-label">Valor do orçamento</div>
      <div class="lf-value">${valor > 0 ? htmlEsc(fmtR(valor)) : '<span class="lf-empty">Não informado</span>'}</div>
    </div>
    <div class="lf">
      <div class="lf-label">Qualificação</div>
      <div class="score-row">
        <div class="score-track"><div class="score-fill" style="width:${scorePct}%"></div></div>
        <div class="score-num">${score}/5</div>
      </div>
    </div>
    <div class="lf">
      <div class="lf-label">Follow-up</div>
      <div class="lf-value ${!lead.followup ? 'lf-empty' : ''}">${htmlEsc(lead.followup) || 'Não agendado'}</div>
    </div>
    ${lead.motivo_perda ? `
    <div class="lf" style="grid-column:1/-1">
      <div class="lf-label">Motivo de perda</div>
      <div class="perda-tag">${htmlEsc(lead.motivo_perda)}</div>
    </div>` : ''}
  </div>
</div>

<div class="tl-section">
  <div class="tl-heading">Linha do Tempo</div>
  <div class="tl-list">
    <div class="tl-spine"></div>
    ${tlHTML}
  </div>
</div>

<div class="doc-footer">
  <span>Me Produz. © ${new Date().getFullYear()}</span>
  <span>Lead ID: ${htmlEsc(lead.id)}</span>
</div>

</body>
</html>`;

  const popup = window.open('', '_blank', 'width=840,height=900,toolbar=0,menubar=0,scrollbars=1,resizable=1');
  if (popup) {
    popup.document.write(html);
    popup.document.close();
    popup.focus();
  } else {
    alert('Popup bloqueado. Permita popups para este site e tente novamente.');
  }
}
