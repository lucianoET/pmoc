-- ⚠️ FIXTURE DE TESTE — NÃO EXECUTAR NO SUPABASE DE PRODUÇÃO.
-- Recria, num Postgres descartável, o mínimo do schema `auth` do Supabase para
-- permitir o replay da cadeia Máquinas (01 → 02 → 09 → 26 → 27), que depende de
-- auth.users e auth.uid(). Complementa tests/fixtures/banco-teste.sql, que stuba
-- a cadeia de locais (equipamentos, cmasm_*) e não serve para esta cadeia.
-- Uso: ver "Validação local das migrações" no TESTES.md.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Sem GoTrue não existe JWT. auth.uid() lê um GUC que o teste define com
-- set_config('request.jwt.claim.sub', '<uuid>', true) para simular o usuário
-- logado — mesmo mecanismo que o PostgREST usa em produção.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Os papéis do Supabase. Guardados por exists porque este fixture pode rodar
-- depois de banco-teste.sql, que os cria sem guarda.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;
