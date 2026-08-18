-- ═══════════════════════════════════════════════════════════════════
-- 28 — Alinha as tabelas rep_* já existentes no banco ao schema da migração 26
--
-- Contexto: uma execução anterior e parcial deixou as cinco tabelas rep_*
-- criadas (e vazias) numa variante do schema 26 — sem rep_modelos.codigo,
-- rep_reparos.codigo, procedimento, obs, criado_em e rep_servicos.origem, e
-- com sistema/gravidade e as FKs de vínculo nullable. Como `create table if
-- not exists` não altera tabela existente, reexecutar a 26 não corrige nada:
-- é este arquivo que fecha a diferença.
--
-- Migração aditiva: só ADD COLUMN / ADD CONSTRAINT / SET NOT NULL.
-- Nenhum DROP. Reexecutável (guardas if not exists / pg_constraint).
-- Os SET NOT NULL só passam porque as cinco tabelas estavam vazias.
-- ═══════════════════════════════════════════════════════════════════

-- ── Colunas que faltavam ──
alter table rep_modelos  add column if not exists codigo text;
alter table rep_modelos  add column if not exists obs text;
alter table rep_modelos  add column if not exists criado_em timestamptz not null default now();

alter table rep_servicos add column if not exists origem text not null default 'local';
alter table rep_servicos add column if not exists criado_em timestamptz not null default now();

alter table rep_reparos  add column if not exists codigo text;
alter table rep_reparos  add column if not exists procedimento text;
alter table rep_reparos  add column if not exists criado_em timestamptz not null default now();

-- ── Nullability divergente ──
alter table rep_reparos  alter column sistema   set not null;
alter table rep_reparos  alter column gravidade set not null;
alter table rep_reparos  alter column gravidade set default 'media';

alter table rep_reparo_servicos  alter column reparo_id  set not null;
alter table rep_reparo_servicos  alter column servico_id set not null;
alter table rep_reparo_materiais alter column reparo_id   set not null;
alter table rep_reparo_materiais alter column material_id set not null;

-- ── Constraints que faltavam (Postgres não tem ADD CONSTRAINT IF NOT EXISTS) ──
-- codigo unique nas duas tabelas é o que torna o seed 27 idempotente.
do $do$
declare
  c record;
begin
  for c in select * from (values
    ('rep_modelos',  'rep_modelos_codigo_key',        'unique (codigo)'),
    ('rep_modelos',  'rep_modelos_ano_inicio_check',  'check (ano_inicio is null or ano_inicio between 1950 and 2100)'),
    ('rep_modelos',  'rep_modelos_ano_fim_check',     'check (ano_fim is null or ano_fim between 1950 and 2100)'),
    ('rep_servicos', 'rep_servicos_origem_check',     $c$check (origem in ('local','catalogo'))$c$),
    ('rep_servicos', 'rep_servicos_especialidade_check',
       $c$check (especialidade is null or especialidade in ('mecanica','eletrica','solda','usinagem','pintura','hidraulica'))$c$),
    ('rep_reparos',  'rep_reparos_codigo_key',        'unique (codigo)'),
    ('rep_reparos',  'rep_reparos_frequencia_check',  'check (frequencia >= 0)')
  ) as v(tabela, nome, def)
  loop
    if not exists (select 1 from pg_constraint
                    where conname = c.nome
                      and conrelid = format('public.%I', c.tabela)::regclass) then
      execute format('alter table %I add constraint %I %s', c.tabela, c.nome, c.def);
    end if;
  end loop;
end $do$;
