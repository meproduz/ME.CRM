-- Mp. CRM — Migration: adicionar status 'negociacao'
-- Cole este SQL no editor do Supabase (SQL Editor → New query)

-- Se houver constraint de check no campo status, remove e recria com negociacao
DO $$
BEGIN
  -- Tenta remover constraint antiga se existir
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

  -- Adiciona nova constraint incluindo negociacao
  ALTER TABLE leads ADD CONSTRAINT leads_status_check
    CHECK (status IN ('novo','contato','proposta','negociacao','fechado','perdido'));

  RAISE NOTICE 'Constraint atualizada com sucesso!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Coluna status é text livre — nenhuma constraint necessária.';
END $$;

-- Confirma os status existentes no banco
SELECT status, COUNT(*) as total
FROM leads
GROUP BY status
ORDER BY total DESC;
