-- ══════════════════════════════════════════════════════════════════════
-- Mp. CRM — Oportunidades (múltiplas oportunidades por lead)
-- Execute este arquivo no Supabase Dashboard → SQL Editor
--
-- O que isso faz:
-- - Cria a tabela `oportunidades`: um lead pode ter 1+ oportunidades,
--   cada uma com seu próprio valor e status (aberta/fechada/perdida).
-- - O `status`/`valor` do lead continuam existindo e funcionando como
--   antes (nada é removido) — servem de fallback enquanto a UI nova não
--   é usada, e o card do Kanban continua dirigido pelo status do lead.
-- - Faz backfill: cria 1 oportunidade pra cada lead já existente,
--   espelhando o valor/status atual dele, pra nada quebrar no dia da
--   migration (idempotente — pode rodar de novo sem duplicar).
-- - Aditivo e seguro de re-executar (IF NOT EXISTS em tudo).
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Tabela ────────────────────────────────────────────────────────

create table if not exists public.oportunidades (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid not null references public.leads(id) on delete cascade,
  cliente_id         uuid not null references public.clientes(id),
  nome               text,
  valor              numeric,
  status             text not null default 'aberta',
  motivo_perda       text,
  criado_por         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  status_changed_at  timestamptz
);

do $$
begin
  alter table public.oportunidades
    add constraint oportunidades_status_check
    check (status in ('aberta','fechada','perdida'));
exception when duplicate_object then
  raise notice 'Constraint oportunidades_status_check já existe — ok.';
end $$;

create index if not exists idx_oportunidades_lead
  on public.oportunidades (lead_id, status);
create index if not exists idx_oportunidades_cliente
  on public.oportunidades (cliente_id, status, created_at desc);

-- ── 2. Backfill — 1 oportunidade por lead existente ────────────────────
-- Mapeia: fechado→fechada, perdido→perdida, qualquer outro→aberta.
-- O `where not exists` garante que rodar este arquivo de novo não duplica.

insert into public.oportunidades
  (lead_id, cliente_id, valor, status, motivo_perda, created_at, status_changed_at)
select
  l.id,
  l.cliente_id,
  l.valor,
  case l.status
    when 'fechado' then 'fechada'
    when 'perdido' then 'perdida'
    else 'aberta'
  end,
  l.motivo_perda,
  l.created_at,
  l.status_changed_at
from public.leads l
where l.cliente_id is not null
  and not exists (
  select 1 from public.oportunidades o where o.lead_id = l.id
);

-- ── 3. RLS ───────────────────────────────────────────────────────────
-- Ver supabase-rls.sql — as policies de `oportunidades` foram
-- adicionadas lá junto com as demais (mesmo padrão direto por
-- cliente_id usado em `leads`). Rode supabase-rls.sql depois deste
-- arquivo se ainda não rodou.

-- ── 4. Verificação ───────────────────────────────────────────────────

select
  (select count(*) from public.leads)         as leads_total,
  (select count(*) from public.oportunidades) as oportunidades_total;

select status, count(*) from public.oportunidades group by status order by status;
