'use client';

import { useState, useRef, useEffect } from 'react';
import { useCRM } from '@/store/crm-store';
import { useLeads } from '@/hooks/useLeads';
import { supabase } from '@/lib/supabase';
import { KANBAN_COLS, type WaTemplates } from '@/types';

export default function ConfiguracoesPage() {
  const { state, dispatch } = useCRM();
  const { exportCSV, importLeads } = useLeads();
  const fileRef = useRef<HTMLInputElement>(null);

  const [metaInput, setMetaInput] = useState(String(state.metaMensal));
  // Sync input when DB value loads (SET_CLIENTE fires after async fetch)
  useEffect(() => { setMetaInput(String(state.metaMensal)); }, [state.metaMensal]);
  const [metaStatus, setMetaStatus] = useState('');
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvDragging, setCsvDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [waTemplates, setWaTemplates] = useState<WaTemplates>({ ...state.waTemplates });

  // ─── Salvar meta ────────────────────────────────────────────────────────────

  async function saveMeta() {
    const val = parseInt(metaInput);
    if (!val || val <= 0) { alert('Informe um valor válido'); return; }
    setMetaStatus('Salvando...');
    const { error } = await supabase.from('clientes')
      .update({ meta_mensal: val }).eq('id', state.currentUser!.cliente_id);
    if (error) {
      await supabase.from('clientes').upsert({ id: state.currentUser!.cliente_id, meta_mensal: val });
    }
    dispatch({ type: 'SET_META', payload: val });
    setMetaStatus('Salvo! ✓');
    setTimeout(() => setMetaStatus(''), 2000);
  }

  // ─── Produtos ───────────────────────────────────────────────────────────────

  function updateProduto(i: number, field: 'nome' | 'valor', val: string) {
    const next = state.produtos.map((p, idx) =>
      idx === i ? { ...p, [field]: field === 'valor' ? Number(val) || 0 : val } : p
    );
    dispatch({ type: 'SET_PRODUTOS', payload: next });
    localStorage.setItem('mp_produtos', JSON.stringify(next));
  }

  function removeProduto(i: number) {
    const next = state.produtos.filter((_, idx) => idx !== i);
    dispatch({ type: 'SET_PRODUTOS', payload: next });
    localStorage.setItem('mp_produtos', JSON.stringify(next));
  }

  function addProduto() {
    const next = [...state.produtos, { nome: '', valor: 0 }];
    dispatch({ type: 'SET_PRODUTOS', payload: next });
  }

  // ─── Templates WA ─────────────────────────────────────────────────────────

  function saveWaTemplates() {
    dispatch({ type: 'SET_WA_TEMPLATES', payload: waTemplates });
    localStorage.setItem('mp_wa_templates', JSON.stringify(waTemplates));
    alert('Templates salvos!');
  }

  // ─── CSV ────────────────────────────────────────────────────────────────────

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
    });
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target?.result as string);
      setCsvData(rows);
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function handleImport() {
    if (!csvData.length) return;
    setImporting(true);
    const count = await importLeads(csvData);
    setImporting(false);
    setCsvData([]);
    alert(`${count} leads importados com sucesso!`);
  }

  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const webhookUrl = `${supabaseBase}/functions/v1/webhook-lead?cliente_id=${state.currentUser?.cliente_id ?? '...'}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div className="page-title">Configurações</div>
          <div className="page-sub">Preferências do sistema</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div className="config-wrap">

          {/* Meta mensal */}
          <div className="config-section">
            <div className="config-title">Meta mensal</div>
            <div className="config-row">
              <div>
                <div className="config-label">Meta de receita</div>
                <div className="config-sub">Valor alvo de fechamento no mês</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="config-input" type="number" value={metaInput}
                  onChange={(e) => setMetaInput(e.target.value)} placeholder="Ex: 60000" />
                <button className="config-btn" onClick={saveMeta}
                  style={metaStatus.includes('✓') ? { background: 'var(--green)', color: '#fff' } : {}}>
                  {metaStatus || 'Salvar'}
                </button>
              </div>
            </div>
          </div>

          {/* WA template padrão */}
          <div className="config-section">
            <div className="config-title">Mensagem WhatsApp</div>
            <div className="config-row">
              <div>
                <div className="config-label">Template de mensagem</div>
                <div className="config-sub">Use &#123;nome&#125; para inserir o nome do lead</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="config-input" type="text" style={{ width: 300 }}
                  defaultValue={state.waTemplate}
                  onBlur={(e) => {
                    dispatch({ type: 'SET_WA_TEMPLATE', payload: e.target.value });
                    localStorage.setItem('mp_wa_template', JSON.stringify(e.target.value));
                  }}
                  placeholder="Olá {nome}..." />
              </div>
            </div>
          </div>

          {/* Produtos */}
          <div className="config-section">
            <div className="config-title">Produtos / Serviços</div>
            <div id="produtos-list">
              {state.produtos.map((p, i) => (
                <div key={i} className="prod-item">
                  <input className="prod-nome" placeholder="Nome do produto" value={p.nome}
                    onChange={(e) => updateProduto(i, 'nome', e.target.value)} />
                  <input className="prod-val" placeholder="Valor" type="number" value={p.valor}
                    onChange={(e) => updateProduto(i, 'valor', e.target.value)} />
                  <button className="prod-del" onClick={() => removeProduto(i)}>✕</button>
                </div>
              ))}
            </div>
            <button className="config-btn" style={{ marginTop: 10, width: '100%' }} onClick={addProduto}>
              + Adicionar produto
            </button>
          </div>

          {/* Templates WA por etapa */}
          <div className="config-section">
            <div className="config-title">Templates WhatsApp por etapa</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {KANBAN_COLS.map((col) => (
                <div key={col.id}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: col.color, marginBottom: 4 }}>
                    {col.label}
                  </div>
                  <textarea
                    style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 12, resize: 'none', height: 60, fontFamily: 'Poppins' }}
                    value={(waTemplates as any)[col.id] ?? ''}
                    onChange={(e) => setWaTemplates((t) => ({ ...t, [col.id]: e.target.value }))}
                    placeholder={`Mensagem para leads em "${col.label}"...`}
                  />
                </div>
              ))}
            </div>
            <button className="config-btn" style={{ marginTop: 12 }} onClick={saveWaTemplates}>
              Salvar templates
            </button>
          </div>

          {/* Importar CSV */}
          <div className="config-section">
            <div className="config-title">Importar Leads (CSV)</div>
            <div
              className={`csv-drop${csvDragging ? ' drag' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setCsvDragging(true); }}
              onDragLeave={() => setCsvDragging(false)}
              onDrop={(e) => { e.preventDefault(); setCsvDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <div className="csv-drop-icon">📂</div>
              <div className="csv-drop-text">Clique para selecionar arquivo .csv</div>
              <div className="csv-drop-sub">Colunas: Nome, Telefone, Segmento, Origem, Interesse, Valor, Observacao</div>
            </div>
            <input type="file" ref={fileRef} accept=".csv" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {csvData.length > 0 && (
              <div>
                <div className="csv-preview">
                  {csvData.slice(0, 5).map((row, i) => (
                    <div key={i} className="csv-preview-row">
                      {Object.values(row).join(' · ')}
                    </div>
                  ))}
                  {csvData.length > 5 && (
                    <div className="csv-preview-row" style={{ color: 'var(--text3)' }}>
                      + {csvData.length - 5} mais...
                    </div>
                  )}
                </div>
                <button className="config-btn" style={{ width: '100%' }} onClick={handleImport} disabled={importing}>
                  {importing ? 'Importando...' : `Importar ${csvData.length} leads`}
                </button>
              </div>
            )}
          </div>

          {/* Webhook */}
          <div className="config-section">
            <div className="config-title">Webhook — entrada automática de leads</div>
            <div className="config-row">
              <div>
                <div className="config-label">URL para Meta Ads / Landing Page</div>
                <div className="config-sub">Use esta URL como webhook POST para cadastrar leads automaticamente</div>
              </div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: 'var(--text3)', wordBreak: 'break-all', marginTop: 8 }}>
              {webhookUrl}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8, fontStyle: 'italic' }}>
              Envie JSON com campos: nome, telefone, segmento, origem, interesse, observacao, valor
            </div>
          </div>

          {/* Exportar */}
          <div className="config-section">
            <div className="config-title">Exportar dados</div>
            <div className="config-row">
              <div>
                <div className="config-label">Exportar leads</div>
                <div className="config-sub">CSV para lookalike no Meta Ads</div>
              </div>
              <button className="config-btn" onClick={exportCSV}>Exportar CSV</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
