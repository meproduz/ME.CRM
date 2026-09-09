-- ══════════════════════════════════════════════════════════════════════
-- Mp. CRM — Catálogo (Segmentos e Produtos/Serviços configuráveis)
-- Execute este arquivo no Supabase Dashboard → SQL Editor
--
-- Problema que resolve: "Segmento" e o dropdown de "Interesse" (pacote) do
-- lead eram listas fixas no código — a tela de Configurações → Produtos/
-- Serviços salvava só no localStorage do navegador de quem editou, sem
-- nenhuma ligação com o resto do app. Isso passa as duas listas pro banco,
-- por cliente_id (mesmo padrão de `leads`), pra Configurações controlar de
-- verdade o que aparece nos dropdowns e no cálculo de valor do lead.
--
-- Aditivo e seguro de re-executar (idempotente).
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Tabelas ───────────────────────────────────────────────────────────

create table if not exists public.produtos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  nome        text not null default '',
  valor       numeric not null default 0,
  ordem       int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.segmentos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  nome        text not null default '',
  ordem       int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_produtos_cliente on public.produtos (cliente_id, ordem);
create index if not exists idx_segmentos_cliente on public.segmentos (cliente_id, ordem);

-- ── 2. Backfill — só pra clientes que ainda não têm nenhuma linha ────────
-- Preserva exatamente os valores fixos que estavam no código, pra ninguém
-- perder o que já usava. Roda por cliente, não duplica em re-execução.

insert into public.produtos (cliente_id, nome, valor, ordem)
select c.id, v.nome, v.valor, v.ordem
from public.clientes c
cross join (values
  ('Alicerce',   1599, 1),
  ('Tração',     1799, 2),
  ('Expansão',   3159, 3),
  ('Só tráfego', 700,  4)
) as v(nome, valor, ordem)
where not exists (select 1 from public.produtos p where p.cliente_id = c.id);

insert into public.segmentos (cliente_id, nome, ordem)
select c.id, v.nome, v.ordem
from public.clientes c
cross join (values
  ('Odontologia',1), ('Industria',2),     ('Logistica',3),   ('Barbearia',4),
  ('Comercio local',5), ('Servicos',6),   ('Clinica',7),     ('Academia',8),
  ('Arquitetura',9), ('E-commerce',10),   ('Educacao',11),   ('Outro',12)
) as v(nome, ordem)
where not exists (select 1 from public.segmentos s where s.cliente_id = c.id);

-- ── 3. RLS ────────────────────────────────────────────────────────────────
-- Mesmo padrão direto por cliente_id usado em `leads`/`oportunidades`
-- (ver supabase-rls.sql pras policies das outras tabelas).

alter table public.produtos  enable row level security;
alter table public.segmentos enable row level security;

drop policy if exists "produtos_select" on public.produtos;
create policy "produtos_select" on public.produtos
  for select using (
    cliente_id = (select cliente_id from public.usuarios where id = auth.uid() limit 1)
  );

drop policy if exists "produtos_insert" on public.produtos;
create policy "produtos_insert" on public.produtos
  for insert with check (
    cliente_id = (select cliente_id from public.usuarios where id = auth.uid() limit 1)
  );

drop policy if exists "produtos_update" on public.produtos;
create policy "produtos_update" on public.produtos
  for update using (
    cliente_id = (select cliente_id from public.usuarios where id = auth.uid() limit 1)
  );

drop policy if exists "produtos_delete" on public.produtos;
create policy "produtos_delete" on public.produtos
  for delete using (
    cliente_id = (select cliente_id from public.usuarios where id = auth.uid() limit 1)
  );

drop policy if exists "segmentos_select" on public.segmentos;
create policy "segmentos_select" on public.segmentos
  for select using (
    cliente_id = (select cliente_id from public.usuarios where id = auth.uid() limit 1)
  );

drop policy if exists "segmentos_insert" on public.segmentos;
create policy "segmentos_insert" on public.segmentos
  for insert with check (
    cliente_id = (select cliente_id from public.usuarios where id = auth.uid() limit 1)
  );

drop policy if exists "segmentos_update" on public.segmentos;
create policy "segmentos_update" on public.segmentos
  for update using (
    cliente_id = (select cliente_id from public.usuarios where id = auth.uid() limit 1)
  );

drop policy if exists "segmentos_delete" on public.segmentos;
create policy "segmentos_delete" on public.segmentos
  for delete using (
    cliente_id = (select cliente_id from public.usuarios where id = auth.uid() limit 1)
  );

-- ── 4. Verificação ────────────────────────────────────────────────────────

select
  (select count(*) from public.produtos)  as produtos_total,
  (select count(*) from public.segmentos) as segmentos_total;
