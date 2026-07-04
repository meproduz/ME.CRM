-- ══════════════════════════════════════════════════════════════════════
-- Mp. CRM — Row Level Security (RLS)
-- Execute este arquivo no Supabase Dashboard → SQL Editor
--
-- O que isso faz:
-- - Habilita RLS em todas as tabelas (dados bloqueados por padrão)
-- - Cada usuário SÓ vê/edita dados do seu próprio cliente (tenant)
-- - Mesmo com a anon key exposta no browser, nada vaza entre clientes
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Habilitar RLS ─────────────────────────────────────────────────
alter table if exists public.leads            enable row level security;
alter table if exists public.leads_historico  enable row level security;
alter table if exists public.usuarios         enable row level security;
alter table if exists public.clientes         enable row level security;

-- ══════════════════════════════════════════════════════════════════════
-- TABELA: leads
-- Regra: cliente_id do lead deve bater com o cliente_id do usuário logado
-- ══════════════════════════════════════════════════════════════════════

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads
  for select
  using (
    cliente_id = (
      select cliente_id from public.usuarios
      where id = auth.uid()
      limit 1
    )
  );

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads
  for insert
  with check (
    cliente_id = (
      select cliente_id from public.usuarios
      where id = auth.uid()
      limit 1
    )
  );

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads
  for update
  using (
    cliente_id = (
      select cliente_id from public.usuarios
      where id = auth.uid()
      limit 1
    )
  );

drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads
  for delete
  using (
    cliente_id = (
      select cliente_id from public.usuarios
      where id = auth.uid()
      limit 1
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- TABELA: leads_historico
-- Regra: acesso apenas a históricos de leads do próprio cliente
-- ══════════════════════════════════════════════════════════════════════

drop policy if exists "hist_select" on public.leads_historico;
create policy "hist_select" on public.leads_historico
  for select
  using (
    lead_id in (
      select id from public.leads
      where cliente_id = (
        select cliente_id from public.usuarios
        where id = auth.uid()
        limit 1
      )
    )
  );

drop policy if exists "hist_insert" on public.leads_historico;
create policy "hist_insert" on public.leads_historico
  for insert
  with check (
    lead_id in (
      select id from public.leads
      where cliente_id = (
        select cliente_id from public.usuarios
        where id = auth.uid()
        limit 1
      )
    )
  );

drop policy if exists "hist_delete" on public.leads_historico;
create policy "hist_delete" on public.leads_historico
  for delete
  using (
    lead_id in (
      select id from public.leads
      where cliente_id = (
        select cliente_id from public.usuarios
        where id = auth.uid()
        limit 1
      )
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- TABELA: usuarios
-- Regra: cada usuário acessa APENAS o próprio registro
-- ══════════════════════════════════════════════════════════════════════

drop policy if exists "usuarios_select" on public.usuarios;
create policy "usuarios_select" on public.usuarios
  for select
  using (id = auth.uid());

drop policy if exists "usuarios_update" on public.usuarios;
create policy "usuarios_update" on public.usuarios
  for update
  using (id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════
-- TABELA: clientes
-- Regra: usuário acessa apenas o cliente ao qual está vinculado
-- ══════════════════════════════════════════════════════════════════════

drop policy if exists "clientes_select" on public.clientes;
create policy "clientes_select" on public.clientes
  for select
  using (
    id = (
      select cliente_id from public.usuarios
      where id = auth.uid()
      limit 1
    )
  );

drop policy if exists "clientes_update" on public.clientes;
create policy "clientes_update" on public.clientes
  for update
  using (
    id = (
      select cliente_id from public.usuarios
      where id = auth.uid()
      limit 1
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- Verificação final — rode para confirmar que as políticas foram criadas
-- ══════════════════════════════════════════════════════════════════════
select
  tablename,
  policyname,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
