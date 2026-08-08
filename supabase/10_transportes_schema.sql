-- ═══════════════════════════════════════════════════════════════════
-- 10 — PMOC Transportes — schema inicial
-- Viaturas e embarcações com programação de viagens e manutenção.
-- Executar no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists transp_ativos (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('viatura', 'embarcacao')),
  subtipo text,
  identificacao text,
  tipo_modelo text,
  ano integer check (ano is null or ano between 1900 and 2100),
  capacidade_pessoas integer check (capacidade_pessoas is null or capacidade_pessoas >= 0),
  capacidade_carga_kg numeric(10,2) check (capacidade_carga_kg is null or capacidade_carga_kg >= 0),
  uso_atual numeric(12,1) not null default 0 check (uso_atual >= 0),
  unidade_uso text not null default 'km' check (unidade_uso in ('km', 'h')),
  status text not null default 'disponivel'
    check (status in ('disponivel', 'em_uso', 'manutencao', 'sobreaviso', 'indisponivel')),
  local text,
  responsavel_nome text,
  prox_manutencao date,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists transp_viagens (
  id uuid primary key default gen_random_uuid(),
  chave_importacao text unique,
  ativo_id bigint references transp_ativos(id) on delete set null,
  classificacao text not null default 'programada'
    check (classificacao in ('rotina', 'programada', 'sobreaviso', 'apoio', 'patrulha')),
  tipo_uso text not null default 'servico'
    check (tipo_uso in ('servico', 'pessoal', 'material', 'armamento', 'rotina', 'sobreaviso', 'manutencao', 'carga', 'apoio')),
  origem text not null default 'CMASM',
  destino text not null,
  missao text not null,
  data_saida date not null default current_date,
  hora_saida_prevista time,
  hora_chegada_prevista time,
  hora_saida_real time,
  hora_chegada_real time,
  uso_saida numeric(12,1) check (uso_saida is null or uso_saida >= 0),
  uso_chegada numeric(12,1) check (uso_chegada is null or (uso_saida is not null and uso_chegada >= uso_saida)),
  motorista_nome text,
  patrao_nome text,
  mo_nome text,
  responsavel_nome text,
  passageiros integer not null default 0 check (passageiros >= 0),
  carga_kg numeric(10,2) not null default 0 check (carga_kg >= 0),
  carga_descricao text,
  combustivel text,
  status text not null default 'agendada'
    check (status in ('agendada', 'em_andamento', 'concluida', 'cancelada')),
  observacoes text,
  importado_de text,
  criado_em timestamptz not null default now()
);

create table if not exists transp_manutencoes (
  id uuid primary key default gen_random_uuid(),
  ativo_id bigint not null references transp_ativos(id) on delete cascade,
  tipo text not null check (tipo in ('preventiva', 'corretiva', 'inspecao')),
  data_manutencao date not null default current_date,
  descricao text not null,
  uso_referencia numeric(12,1) check (uso_referencia is null or uso_referencia >= 0),
  executado_por text,
  fornecedor text,
  prox_manutencao date,
  novo_status text
    check (novo_status is null or novo_status in ('disponivel', 'em_uso', 'manutencao', 'sobreaviso', 'indisponivel')),
  observacoes text,
  criado_em timestamptz not null default now()
);

create index if not exists transp_viagens_ativo_id_idx on transp_viagens (ativo_id);
create index if not exists transp_viagens_data_saida_idx on transp_viagens (data_saida desc);
create index if not exists transp_manutencoes_ativo_id_idx on transp_manutencoes (ativo_id);
create index if not exists transp_ativos_status_idx on transp_ativos (status);
create index if not exists transp_ativos_prox_manutencao_idx on transp_ativos (prox_manutencao) where prox_manutencao is not null;

grant usage on schema public to anon, authenticated;
grant select on transp_ativos, transp_viagens, transp_manutencoes to anon, authenticated;
grant insert, update, delete on transp_ativos, transp_viagens, transp_manutencoes to authenticated;
grant usage, select on sequence transp_ativos_id_seq to anon, authenticated;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['transp_ativos', 'transp_viagens', 'transp_manutencoes']
  loop
    execute format('alter table %I enable row level security', tabela);
    execute format('drop policy if exists %I on %I', 'sel_anon_' || tabela, tabela);
    execute format('drop policy if exists %I on %I', 'sel_auth_' || tabela, tabela);
    execute format('drop policy if exists %I on %I', 'ins_' || tabela, tabela);
    execute format('drop policy if exists %I on %I', 'upd_' || tabela, tabela);
    execute format('drop policy if exists %I on %I', 'del_' || tabela, tabela);

    execute format('create policy %I on %I for select to anon using (true)', 'sel_anon_' || tabela, tabela);
    execute format('create policy %I on %I for select to authenticated using (true)', 'sel_auth_' || tabela, tabela);
    execute format('create policy %I on %I for insert to authenticated with check (true)', 'ins_' || tabela, tabela);
    execute format('create policy %I on %I for update to authenticated using (true) with check (true)', 'upd_' || tabela, tabela);
    execute format('create policy %I on %I for delete to authenticated using (true)', 'del_' || tabela, tabela);
  end loop;
end $$;
