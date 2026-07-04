-- ─── Migração: renomear colunas v1 → v2 ──────────────────────────────────────
-- Executa no SQL Editor do Supabase: rylexblaolbiovfmrwvi

-- Renomear colunas com nomes antigos para os nomes que o v2 espera
ALTER TABLE leads RENAME COLUMN telefone   TO tel;
ALTER TABLE leads RENAME COLUMN segmento   TO seg;
ALTER TABLE leads RENAME COLUMN origem     TO orig;
ALTER TABLE leads RENAME COLUMN interesse  TO "int";
ALTER TABLE leads RENAME COLUMN observacao TO obs;

-- Adicionar colunas que o v2 usa mas o v1 não tinha (nullable, sem perda de dados)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email        text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score        integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_perda text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup     text;

-- Confirmar resultado
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'leads'
ORDER BY ordinal_position;
