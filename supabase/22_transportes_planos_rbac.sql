-- ═══════════════════════════════════════════════════════════════════
-- 22 — PMOC Transportes — planos de manutenção por tipo_modelo + RBAC
-- Migração aditiva. Executar no SQL Editor do Supabase.
-- Cria transp_planos e a função transp_pode_escrever() (SECURITY DEFINER),
-- usada nas policies de escrita das tabelas novas do módulo Transportes.
-- Não remove nem altera nenhum objeto de Refrigeração ou Máquinas.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists transp_planos (
  id bigint generated always as identity primary key,
  tipo_modelo text not null,
  nome text not null,
  intervalo numeric not null check (intervalo > 0),
  unidade text not null check (unidade in ('km', 'h')),
  descricao text,
  ordem integer default 0,
  ativo boolean not null default true,
  unique (tipo_modelo, nome)
);

create index if not exists transp_planos_tipo_modelo_idx on transp_planos (tipo_modelo);

-- ── RBAC mínimo (Pattern 3 — 01-RESEARCH.md) ──
-- Substitui as policies "using (true)"/"with check (true)" herdadas de
-- 10_transportes_schema.sql para as tabelas novas: escrita passa a exigir
-- cargo admin/gestor/tecnico, leitura permanece pública (observador/painel).
create or replace function transp_pode_escrever()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from usuarios u
    where u.auth_id = (select auth.uid())
      and u.ativo = true
      and u.role in ('admin', 'gestor', 'tecnico')
  )
$$;

revoke execute on function transp_pode_escrever() from public, anon;
grant execute on function transp_pode_escrever() to authenticated;

-- ── Grants de tabela e de sequence (Pitfall 4 — id bigint generated always as identity) ──
grant select on transp_planos to anon, authenticated;
grant insert, update, delete on transp_planos to authenticated;
grant usage, select on sequence transp_planos_id_seq to anon, authenticated;

-- ── RLS ──
alter table transp_planos enable row level security;

drop policy if exists sel_transp_planos on transp_planos;
drop policy if exists ins_transp_planos on transp_planos;
drop policy if exists upd_transp_planos on transp_planos;
drop policy if exists del_transp_planos on transp_planos;

create policy sel_transp_planos on transp_planos
  for select
  using (true);

create policy ins_transp_planos on transp_planos
  for insert to authenticated
  with check ((select transp_pode_escrever()));

create policy upd_transp_planos on transp_planos
  for update to authenticated
  using ((select transp_pode_escrever()));

create policy del_transp_planos on transp_planos
  for delete to authenticated
  using ((select transp_pode_escrever()));
