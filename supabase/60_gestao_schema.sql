-- ══════════════════════════════════════════════════════════════════
-- 60 — Gestão e Qualidade (Onda B da Fase 13)
--
-- Por que existe:
-- Até a Onda A, o PMOC possuía módulos de execução e apontamento
-- (refrigeração, máquinas, transportes, elétrica, fonoclama, predial,
-- calibração, equipes, mapa) e os núcleos puros de qualidade em shared/
-- (gráfico, indicadores, gantt, abc, gut, kanban, calendário). Faltavam as
-- tabelas de persistência para planos de ação 5W2H priorizados por GUT,
-- séries históricas de indicadores (NBR 5674 item 7.5), causas de Ishikawa
-- e procedimentos operacionais padrão (POP).
--
-- Convenção de nomes:
-- Todas as cinco tabelas usam prefixo ges_, mantendo o padrão da plataforma
-- já visto em maq_, transp_, elet_, fono_, pred_, rep_ e cal_.
--
-- ADITIVA, SEM DROP:
-- O projeto arquiva, nunca apaga. Ações e POPs inativos usam ativo = false.
-- Nenhuma tabela ou coluna existente de outro módulo é alterada.
--
-- ORDEM DE PUBLICAÇÃO:
-- O frontend vai para produção ANTES deste SQL. A sonda GES_OK (leitura
-- rápida e segura sobre ges_acoes) mantém o módulo /gestao inerte e honesto
-- enquanto este script não for aplicado no Supabase.
--
-- LIÇÃO DA MIGRAÇÃO 28:
-- `create table if not exists` não altera tabelas já criadas. Se alguma tabela
-- ges_* já existir com outra estrutura no banco de destino, esta migração não
-- acusará erro, mas a forma das colunas pode diferir. Após aplicar, confira
-- colunas, checks e policies com as consultas no rodapé.
-- ══════════════════════════════════════════════════════════════════

-- 1) ges_acoes — Plano de ação 5W2H priorizado por GUT
create table if not exists ges_acoes (
  id bigserial primary key,
  o_que text not null,
  por_que text,
  onde text,
  quando date,
  quem text,
  como text,
  quanto numeric check (quanto is null or quanto >= 0),
  g integer check (g is null or g in (0, 1, 3, 6, 8, 10)),
  u integer check (u is null or u in (0, 1, 3, 6, 8, 10)),
  t integer check (t is null or t in (0, 1, 3, 6, 8, 10)),
  gut_total integer generated always as (g * u * t) stored,
  status text not null default 'planejada' check (status in ('planejada', 'em_execucao', 'verificacao', 'concluida', 'cancelada')),
  modulo text,
  ativo_ref text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por text,
  atualizado_em timestamptz not null default now()
);

-- 2) ges_indicadores — Definição dos indicadores de gestão
create table if not exists ges_indicadores (
  id bigserial primary key,
  codigo text not null unique,
  rotulo text not null,
  unidade text,
  meta numeric,
  sentido text not null default 'maior' check (sentido in ('maior', 'menor')),
  faixa_atencao numeric,
  modulo text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- 3) ges_indicador_valores — Série histórica de valores dos indicadores
create table if not exists ges_indicador_valores (
  id bigserial primary key,
  indicador_id bigint not null references ges_indicadores(id) on delete cascade,
  periodo date not null,
  valor numeric not null,
  criado_em timestamptz not null default now(),
  constraint uq_ges_indicador_valores_periodo unique (indicador_id, periodo)
);

-- 4) ges_pop — Procedimentos Operacionais Padrão
create table if not exists ges_pop (
  id bigserial primary key,
  titulo text not null,
  texto text,
  modulo text,
  ativo_ref text,
  plano_ref text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por text
);

-- 5) ges_causas — Espinha de peixe (Diagrama de Ishikawa 6M)
create table if not exists ges_causas (
  id bigserial primary key,
  acao_id bigint not null references ges_acoes(id) on delete cascade,
  categoria text not null check (categoria in ('metodo', 'maquina', 'mao_de_obra', 'material', 'medicao', 'meio_ambiente')),
  causa text not null,
  criado_em timestamptz not null default now()
);

-- ── Índices ──
create index if not exists idx_ges_acoes_status on ges_acoes (status);
create index if not exists idx_ges_acoes_modulo on ges_acoes (modulo);
create index if not exists idx_ges_indicador_valores_indicador on ges_indicador_valores (indicador_id);
create index if not exists idx_ges_indicador_valores_periodo on ges_indicador_valores (indicador_id, periodo);
create index if not exists idx_ges_causas_acao on ges_causas (acao_id);
create index if not exists idx_ges_pop_modulo on ges_pop (modulo);

-- ── Row Level Security (RLS) ──
-- Padrão da plataforma: leitura aberta para public, escrita para authenticated.
-- O bloco é reexecutável: remove a policy anterior antes de recriar.

alter table ges_acoes enable row level security;
drop policy if exists r_sel_ges_acoes on ges_acoes;
create policy r_sel_ges_acoes on ges_acoes for select using (true);
drop policy if exists r_ins_ges_acoes on ges_acoes;
create policy r_ins_ges_acoes on ges_acoes for insert to authenticated with check (true);
drop policy if exists r_upd_ges_acoes on ges_acoes;
create policy r_upd_ges_acoes on ges_acoes for update to authenticated using (true);
drop policy if exists r_del_ges_acoes on ges_acoes;
create policy r_del_ges_acoes on ges_acoes for delete to authenticated using (true);

alter table ges_indicadores enable row level security;
drop policy if exists r_sel_ges_indicadores on ges_indicadores;
create policy r_sel_ges_indicadores on ges_indicadores for select using (true);
drop policy if exists r_ins_ges_indicadores on ges_indicadores;
create policy r_ins_ges_indicadores on ges_indicadores for insert to authenticated with check (true);
drop policy if exists r_upd_ges_indicadores on ges_indicadores;
create policy r_upd_ges_indicadores on ges_indicadores for update to authenticated using (true);
drop policy if exists r_del_ges_indicadores on ges_indicadores;
create policy r_del_ges_indicadores on ges_indicadores for delete to authenticated using (true);

alter table ges_indicador_valores enable row level security;
drop policy if exists r_sel_ges_indicador_valores on ges_indicador_valores;
create policy r_sel_ges_indicador_valores on ges_indicador_valores for select using (true);
drop policy if exists r_ins_ges_indicador_valores on ges_indicador_valores;
create policy r_ins_ges_indicador_valores on ges_indicador_valores for insert to authenticated with check (true);
drop policy if exists r_upd_ges_indicador_valores on ges_indicador_valores;
create policy r_upd_ges_indicador_valores on ges_indicador_valores for update to authenticated using (true);
drop policy if exists r_del_ges_indicador_valores on ges_indicador_valores;
create policy r_del_ges_indicador_valores on ges_indicador_valores for delete to authenticated using (true);

alter table ges_pop enable row level security;
drop policy if exists r_sel_ges_pop on ges_pop;
create policy r_sel_ges_pop on ges_pop for select using (true);
drop policy if exists r_ins_ges_pop on ges_pop;
create policy r_ins_ges_pop on ges_pop for insert to authenticated with check (true);
drop policy if exists r_upd_ges_pop on ges_pop;
create policy r_upd_ges_pop on ges_pop for update to authenticated using (true);
drop policy if exists r_del_ges_pop on ges_pop;
create policy r_del_ges_pop on ges_pop for delete to authenticated using (true);

alter table ges_causas enable row level security;
drop policy if exists r_sel_ges_causas on ges_causas;
create policy r_sel_ges_causas on ges_causas for select using (true);
drop policy if exists r_ins_ges_causas on ges_causas;
create policy r_ins_ges_causas on ges_causas for insert to authenticated with check (true);
drop policy if exists r_upd_ges_causas on ges_causas;
create policy r_upd_ges_causas on ges_causas for update to authenticated using (true);
drop policy if exists r_del_ges_causas on ges_causas;
create policy r_del_ges_causas on ges_causas for delete to authenticated using (true);

-- ── Comentários de documentação ──
comment on table ges_acoes is 'Plano de ação 5W2H priorizado por GUT do módulo Gestão';
comment on table ges_indicadores is 'Definições dos indicadores e KPIs de manutenção (NBR 5674)';
comment on table ges_indicador_valores is 'Série histórica mensal/periódica de valores dos indicadores';
comment on table ges_pop is 'Catálogo de Procedimentos Operacionais Padrão (POPs)';
comment on table ges_causas is 'Causas mapeadas na espinha de peixe (Diagrama de Ishikawa 6M)';

-- ── Consultas de conferência pós-aplicação ──
-- select table_name, count(*) as colunas from information_schema.columns where table_name like 'ges_%' group by table_name order by table_name;
-- -- esperado: ges_acoes (18), ges_causas (5), ges_indicador_valores (5), ges_indicadores (10), ges_pop (9)
--
-- select tablename, policyname, permissive, roles, cmd from pg_policies where tablename like 'ges_%' order by tablename, policyname;
-- -- esperado: 20 policies (4 por tabela, com insert/update/delete para authenticated e select para public)
