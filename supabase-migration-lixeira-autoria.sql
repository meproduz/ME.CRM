-- Necessária para: soft-delete de leads (Lixeira), autoria de cadastro,
-- e registro estruturado de histórico usado pelo painel de Gestor.
-- Rodar no SQL Editor do Supabase do projeto ANTES de usar essas telas
-- (sem isso, a listagem de leads quebra por causa do filtro `deletado_em is null`
-- em loadLeads, e a criação de lead falha por causa de `criado_por`).

alter table public.leads add column if not exists criado_por uuid references auth.users(id);
alter table public.leads add column if not exists criado_por_nome text;

alter table public.leads add column if not exists deletado_em timestamptz;
alter table public.leads add column if not exists deletado_por_nome text;

alter table public.leads_historico add column if not exists tipo text;
alter table public.leads_historico add column if not exists meta_json jsonb;
