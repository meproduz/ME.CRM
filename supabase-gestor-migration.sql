-- ─── Migração: rastreamento estruturado de eventos no histórico ───────────────
-- Rodar no SQL Editor do Supabase: rylexblaolbiovfmrwvi

-- 1. Adicionar colunas de tipo e dados estruturados
ALTER TABLE public.leads_historico
  ADD COLUMN IF NOT EXISTS tipo      text    DEFAULT 'anotacao',
  ADD COLUMN IF NOT EXISTS meta_json jsonb;

-- 2. Índice para queries do painel do gestor (tempo por etapa, etc.)
CREATE INDEX IF NOT EXISTS idx_hist_tipo
  ON public.leads_historico (lead_id, tipo, created_at DESC);

-- 3. Confirmar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads_historico'
ORDER BY ordinal_position;
