-- ═══════════════════════════════════════════════════════════════════
-- 23 — PMOC Transportes — estoque de peças, vínculo plano-material e colunas de OS
-- Migração aditiva. Executar no SQL Editor do Supabase.
-- Cria transp_materiais, transp_plano_materiais e transp_estoque_movimentos;
-- acrescenta plano_id/status/custo_pecas a transp_manutencoes (ADD COLUMN IF NOT EXISTS).
-- Reutiliza transp_pode_escrever() (SECURITY DEFINER), já criada na migração 22 — não redefine.
-- Não remove nem altera nenhum objeto de Refrigeração ou Máquinas.
-- ═══════════════════════════════════════════════════════════════════

-- ── Estoque de peças/consumíveis próprio do módulo (D-06 — não compartilha com maq_materiais) ──
create table if not exists transp_materiais (
  id bigint generated always as identity primary key,
  codigo text unique,
  nome text not null,
  tipo text not null default 'consumivel' check (tipo in ('consumivel', 'peca')),
  unidade text not null default 'un',
  preco numeric check (preco is null or preco >= 0),
  estoque_atual numeric not null default 0 check (estoque_atual >= 0),
  estoque_minimo numeric not null default 0 check (estoque_minimo >= 0),
  obs text,
  ativo boolean not null default true
);

-- ── Vínculo plano de manutenção × peça consumida (usado pela baixa automática do Plano 01-03) ──
create table if not exists transp_plano_materiais (
  id bigint generated always as identity primary key,
  plano_id bigint references transp_planos(id) on delete cascade,
  material_id bigint references transp_materiais(id) on delete cascade,
  quantidade numeric not null default 1 check (quantidade > 0),
  unique (plano_id, material_id)
);

-- ── Histórico de movimentos de estoque (entrada/saída) ──
create table if not exists transp_estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  material_id bigint references transp_materiais(id),
  manutencao_id uuid references transp_manutencoes(id),
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade numeric not null check (quantidade > 0),
  motivo text,
  registrado_em timestamptz default now()
);

-- ── Colunas de OS em transp_manutencoes (Pitfall 3 — sempre ADD COLUMN IF NOT EXISTS,
--    migração precisa ser reexecutável sem perder as linhas já gravadas) ──
alter table transp_manutencoes add column if not exists plano_id bigint references transp_planos(id);
alter table transp_manutencoes add column if not exists status text not null default 'concluida'
  check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada'));
alter table transp_manutencoes add column if not exists custo_pecas numeric default 0;

-- ── Índices de chave estrangeira (regra do skill supabase-postgres-best-practices) ──
create index if not exists transp_plano_materiais_plano_id_idx on transp_plano_materiais (plano_id);
create index if not exists transp_plano_materiais_material_id_idx on transp_plano_materiais (material_id);
create index if not exists transp_estoque_movimentos_material_id_idx on transp_estoque_movimentos (material_id);
create index if not exists transp_estoque_movimentos_manutencao_id_idx on transp_estoque_movimentos (manutencao_id);
create index if not exists transp_manutencoes_plano_id_idx on transp_manutencoes (plano_id);

-- ── Grants de tabela e de sequence (Pitfall 4 — id bigint generated always as identity) ──
grant select on transp_materiais, transp_plano_materiais, transp_estoque_movimentos to anon, authenticated;
grant insert, update, delete on transp_materiais, transp_plano_materiais, transp_estoque_movimentos to authenticated;
grant usage, select on sequence transp_materiais_id_seq to anon, authenticated;
grant usage, select on sequence transp_plano_materiais_id_seq to anon, authenticated;
-- transp_estoque_movimentos usa id uuid — não precisa de grant de sequence.

-- ── RLS — reutiliza transp_pode_escrever() da migração 22, não a redefine (Pitfall 1/6) ──
alter table transp_materiais enable row level security;
alter table transp_plano_materiais enable row level security;
alter table transp_estoque_movimentos enable row level security;

drop policy if exists sel_transp_materiais on transp_materiais;
drop policy if exists ins_transp_materiais on transp_materiais;
drop policy if exists upd_transp_materiais on transp_materiais;
drop policy if exists del_transp_materiais on transp_materiais;

create policy sel_transp_materiais on transp_materiais
  for select
  using (true);

create policy ins_transp_materiais on transp_materiais
  for insert to authenticated
  with check ((select transp_pode_escrever()));

create policy upd_transp_materiais on transp_materiais
  for update to authenticated
  using ((select transp_pode_escrever()));

create policy del_transp_materiais on transp_materiais
  for delete to authenticated
  using ((select transp_pode_escrever()));

drop policy if exists sel_transp_plano_materiais on transp_plano_materiais;
drop policy if exists ins_transp_plano_materiais on transp_plano_materiais;
drop policy if exists upd_transp_plano_materiais on transp_plano_materiais;
drop policy if exists del_transp_plano_materiais on transp_plano_materiais;

create policy sel_transp_plano_materiais on transp_plano_materiais
  for select
  using (true);

create policy ins_transp_plano_materiais on transp_plano_materiais
  for insert to authenticated
  with check ((select transp_pode_escrever()));

create policy upd_transp_plano_materiais on transp_plano_materiais
  for update to authenticated
  using ((select transp_pode_escrever()));

create policy del_transp_plano_materiais on transp_plano_materiais
  for delete to authenticated
  using ((select transp_pode_escrever()));

drop policy if exists sel_transp_estoque_movimentos on transp_estoque_movimentos;
drop policy if exists ins_transp_estoque_movimentos on transp_estoque_movimentos;
drop policy if exists upd_transp_estoque_movimentos on transp_estoque_movimentos;
drop policy if exists del_transp_estoque_movimentos on transp_estoque_movimentos;

create policy sel_transp_estoque_movimentos on transp_estoque_movimentos
  for select
  using (true);

create policy ins_transp_estoque_movimentos on transp_estoque_movimentos
  for insert to authenticated
  with check ((select transp_pode_escrever()));

create policy upd_transp_estoque_movimentos on transp_estoque_movimentos
  for update to authenticated
  using ((select transp_pode_escrever()));

create policy del_transp_estoque_movimentos on transp_estoque_movimentos
  for delete to authenticated
  using ((select transp_pode_escrever()));
