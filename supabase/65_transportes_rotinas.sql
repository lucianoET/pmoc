-- ═══════════════════════════════════════════════════════════════════
-- 65 — PMOC Transportes — rotinas por calendário com checklist e medições
-- Migração aditiva. Executar no SQL Editor do Supabase DEPOIS do deploy do frontend.
--
-- transp_planos (migração 22) vence por km/h e não guarda itens. Uma rotina
-- por calendário (diária, semanal, mensal...) com checklist e valores medidos
-- (tensão de bateria, densidade, pressão de pneu) é outra coisa, e por isso
-- tem tabelas próprias em vez de entortar transp_planos.
--
--   transp_rotinas          cabeçalho: modelo, periodicidade em dias, executor
--   transp_rotina_itens     itens: check (conforme/NC) ou medida (valor + faixa)
--   transp_execucoes        uma passagem da rotina por um ativo
--   transp_execucao_valores uma linha por item × ponto de registro
--
-- `conforme` é gravado na execução, não derivado depois: a faixa de um item
-- pode mudar e o histórico não pode mudar junto (mesma razão de preco_unit
-- congelado em maq_os_materiais). Execuções e valores são só-inserção — sem
-- policy de update/delete; correção é nova execução.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists transp_rotinas (
  id bigint generated always as identity primary key,
  tipo_modelo text not null,
  codigo text not null,
  nome text not null,
  intervalo_dias integer not null check (intervalo_dias > 0),
  responsavel text not null default 'TEC' check (responsavel in ('OP', 'TEC')),
  tipo_os text not null default 'preventiva' check (tipo_os in ('preventiva', 'inspecao')),
  ordem integer not null default 0,
  ativo boolean not null default true,
  unique (tipo_modelo, codigo)
);

create table if not exists transp_rotina_itens (
  id bigint generated always as identity primary key,
  rotina_id bigint not null references transp_rotinas(id) on delete cascade,
  ordem integer not null,
  descricao text not null,
  tipo text not null check (tipo in ('check', 'medida')),
  unidade text,
  minimo numeric,
  maximo numeric,
  dif_max numeric check (dif_max is null or dif_max > 0),
  criterio text,
  acao_se_nc text,
  sistema text,
  registro_por text check (registro_por is null or registro_por in ('banco', 'bateria', 'elemento', 'pneu')),
  ativo boolean not null default true,
  unique (rotina_id, ordem),
  check (minimo is null or maximo is null or minimo <= maximo),
  check ((tipo = 'medida' and unidade is not null and registro_por is not null)
      or (tipo = 'check' and registro_por is null and minimo is null and maximo is null and dif_max is null))
);

create table if not exists transp_execucoes (
  id uuid primary key default gen_random_uuid(),
  ativo_id bigint not null references transp_ativos(id) on delete cascade,
  rotina_id bigint not null references transp_rotinas(id),
  manutencao_id uuid references transp_manutencoes(id) on delete set null,
  data_execucao date not null default current_date,
  uso_referencia numeric(12,1) check (uso_referencia is null or uso_referencia >= 0),
  executado_por text,
  observacoes text,
  criado_em timestamptz not null default now()
);

create table if not exists transp_execucao_valores (
  id bigint generated always as identity primary key,
  execucao_id uuid not null references transp_execucoes(id) on delete cascade,
  item_id bigint not null references transp_rotina_itens(id),
  ponto text not null default '',
  valor numeric,
  conforme boolean,
  observacao text,
  unique (execucao_id, item_id, ponto),
  check (valor is not null or conforme is not null)
);

create index if not exists transp_execucoes_ativo_idx on transp_execucoes (ativo_id, data_execucao desc);
create index if not exists transp_execucoes_rotina_idx on transp_execucoes (rotina_id);
create index if not exists transp_execucao_valores_exec_idx on transp_execucao_valores (execucao_id);
create index if not exists transp_execucao_valores_item_idx on transp_execucao_valores (item_id);

-- ── grants ──
grant select on transp_rotinas, transp_rotina_itens, transp_execucoes, transp_execucao_valores to anon, authenticated;
grant insert, update on transp_rotinas, transp_rotina_itens to authenticated;
grant insert on transp_execucoes, transp_execucao_valores to authenticated;
grant usage, select on sequence transp_rotinas_id_seq, transp_rotina_itens_id_seq, transp_execucao_valores_id_seq to authenticated;

-- ── RLS: leitura pública, escrita por transp_pode_escrever() (migração 22) ──
do $$
declare
  tabela text;
begin
  foreach tabela in array array['transp_rotinas', 'transp_rotina_itens', 'transp_execucoes', 'transp_execucao_valores']
  loop
    execute format('alter table %I enable row level security', tabela);
    execute format('drop policy if exists %I on %I', 'sel_' || tabela, tabela);
    execute format('drop policy if exists %I on %I', 'ins_' || tabela, tabela);
    execute format('create policy %I on %I for select using (true)', 'sel_' || tabela, tabela);
    execute format('create policy %I on %I for insert to authenticated with check ((select transp_pode_escrever()))', 'ins_' || tabela, tabela);
  end loop;

  foreach tabela in array array['transp_rotinas', 'transp_rotina_itens']
  loop
    execute format('drop policy if exists %I on %I', 'upd_' || tabela, tabela);
    execute format('create policy %I on %I for update to authenticated using ((select transp_pode_escrever())) with check ((select transp_pode_escrever()))', 'upd_' || tabela, tabela);
  end loop;
end $$;
