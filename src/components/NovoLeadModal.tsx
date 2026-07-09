'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCRM } from '@/store/crm-store';
import { useLeads } from '@/hooks/useLeads';
import { hoje, agora } from '@/lib/utils';
import { SEGMENTOS, ORIGENS } from '@/types';

const INTERESSES = [
  'Alicerce - R$ 1.599', 'Tracao - R$ 1.799', 'Expansao - R$ 3.159', 'So trafego - R$ 700',
];

export default function NovoLeadModal({ onClose }: { onClose: () => void }) {
  const { state } = useCRM();
  const { createLead } = useLeads();
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', tel: '', seg: '', orig: 'Instagram', int: '', valor: '', obs: '' });

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    if (!state.currentUser?.cliente_id) {
      setErro('Sessão inválida. Recarregue a página.');
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      await createLead({
        cliente_id: state.currentUser.cliente_id,
        nome: form.nome.trim(),
        tel: form.tel.trim() || null,
        email: null,
        seg: form.seg || null,
        orig: form.orig || null,
        int: form.int || null,
        valor: form.valor ? Number(form.valor) : null,
        obs: form.obs.trim() || null,
        status: 'novo',
        data: hoje(),
        hora: agora(),
        followup: null,
        score: null,
        motivo_perda: null,
      });
      onClose();
    } catch (err: unknown) {
      console.error('[NovoLead] erro ao salvar:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setErro(msg || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div className="modal-overlay" style={{ display: 'flex' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="modal" style={{ width: 420 }}
        initial={{ scale: 0.92, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
        onClick={(e) => e.stopPropagation()}>
        <h3>Novo lead</h3>
        <form onSubmit={handleSubmit}>
          <div className="mf"><label>Nome *</label>
            <input placeholder="Nome completo" value={form.nome} onChange={(e) => set('nome', e.target.value)} autoFocus required />
          </div>
          <div className="mf"><label>Telefone</label>
            <input type="tel" placeholder="(11) 99999-9999" value={form.tel} onChange={(e) => set('tel', e.target.value)} />
          </div>
          <div className="mf"><label>Segmento</label>
            <select value={form.seg} onChange={(e) => set('seg', e.target.value)}>
              <option value="">Selecione</option>
              {SEGMENTOS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="mf"><label>Origem</label>
            <select value={form.orig} onChange={(e) => set('orig', e.target.value)}>
              {ORIGENS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="mf"><label>Interesse</label>
            <select value={form.int} onChange={(e) => set('int', e.target.value)}>
              <option value="">Não definido</option>
              {INTERESSES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div className="mf"><label>Valor do orçamento (R$)</label>
            <input type="number" placeholder="Ex: 370.00" value={form.valor} onChange={(e) => set('valor', e.target.value)} />
          </div>
          <div className="mf"><label>Observação</label>
            <textarea placeholder="Alguma info relevante..." value={form.obs} onChange={(e) => set('obs', e.target.value)} />
          </div>

          {/* Mensagem de erro visível */}
          {erro && (
            <div style={{
              background: 'rgba(226,75,74,0.1)',
              border: '1px solid rgba(226,75,74,0.35)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#E24B4A',
              marginBottom: 14,
            }}>
              ⚠️ {erro}
            </div>
          )}

          <div className="mfooter">
            <button type="button" className="mcbtn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="msbtn" disabled={saving || !form.nome.trim()}>
              {saving ? 'Salvando...' : 'Salvar lead'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
