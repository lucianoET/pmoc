-- ═══════════════════════════════════════════════════════════
-- PMOC Refrigeração v2.8 — schema
-- Reconstruído a partir das queries do app (banco original excluído)
-- ═══════════════════════════════════════════════════════════

create table if not exists equipamentos (
  id serial primary key,
  area text, predio text, local text, tipo text, fabricante text,
  btu integer, funciona text, estado text, obs text,
  refrig_permanente boolean, horas_dia integer, dias_semana integer,
  criticidade text, tensao integer, corrente_nominal numeric,
  patrimonio text, data_instalacao date, ultima_manutencao date,
  refrigerante text,
  area_m2 numeric, pe_direito numeric, n_pessoas integer,
  dissipacao_w numeric, fator_insolacao numeric default 1.0
);

create table if not exists plano_tarefas (
  id serial primary key,
  aplica_a text not null default 'TODOS',
  periodicidade text not null check (periodicidade in ('MENSAL','TRIMESTRAL','SEMESTRAL','ANUAL')),
  descricao text not null, norma_ref text,
  ordem integer not null default 0, ativo boolean not null default true
);

create table if not exists campanhas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, data_prevista date, filtro jsonb,
  status text not null default 'PLANEJADA' check (status in ('PLANEJADA','EM_EXECUCAO','CONCLUIDA')),
  responsavel text, criado_em timestamptz not null default now()
);

create table if not exists campanha_equip (
  campanha_id uuid references campanhas(id) on delete cascade,
  equip_id integer references equipamentos(id) on delete cascade,
  status_item text not null default 'PENDENTE' check (status_item in ('PENDENTE','CONCLUIDO')),
  primary key (campanha_id, equip_id)
);

create table if not exists logs_manutencao (
  id uuid primary key default gen_random_uuid(),
  equip_id integer references equipamentos(id) on delete cascade,
  data_os date, tipo text, status text, tecnico text, descricao text,
  checklist jsonb,
  temp_insuflamento numeric, temp_retorno numeric, delta_t numeric,
  corrente_medida numeric, pressao_succao numeric,
  campanha_id uuid references campanhas(id) on delete set null
);

-- ── Contratação / ARP (v2.8) ──
create table if not exists arp_itens (
  id serial primary key,
  numero_ata text, item text, descricao text,
  unidade text, valor_unitario numeric,
  quantidade_registrada numeric, quantidade_consumida numeric default 0,
  ativo boolean default true
);

create table if not exists os_contratacao (
  id uuid primary key default gen_random_uuid(),
  numero text unique, equip_id integer references equipamentos(id),
  descricao text, solicitante text, empresa text, fiscal text,
  status text default 'ABERTA',
  ne text,                                  -- nota de empenho
  data_abertura date default current_date,
  data_aprovacao date, data_execucao date, data_certificacao date,
  criado_em timestamptz default now()
);

create table if not exists os_orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references os_contratacao(id) on delete cascade,
  arp_item_id integer references arp_itens(id),
  descricao text, unidade text,
  quantidade numeric, valor_unitario numeric,
  total numeric generated always as (quantidade * coalesce(valor_unitario,0)) stored
);

create table if not exists os_execucao (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references os_contratacao(id) on delete cascade,
  data date default current_date, descricao text, executor text,
  foto text, criado_em timestamptz default now()
);

create table if not exists os_composicao (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references os_contratacao(id) on delete cascade,
  arp_item_id integer references arp_itens(id),
  descricao text, quantidade numeric, valor_unitario numeric,
  total numeric generated always as (quantidade * coalesce(valor_unitario,0)) stored
);

create table if not exists os_eventos (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references os_contratacao(id) on delete cascade,
  evento text not null, detalhe text, usuario text,
  criado_em timestamptz default now()
);

-- ── RLS ──
do $$ declare t text; begin
  foreach t in array array['equipamentos','plano_tarefas','campanhas','campanha_equip',
    'logs_manutencao','arp_itens','os_contratacao','os_orcamento_itens',
    'os_execucao','os_composicao','os_eventos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (true)', 'r_sel_'||t, t);
    execute format('create policy %I on %I for insert to authenticated with check (true)', 'r_ins_'||t, t);
    execute format('create policy %I on %I for update to authenticated using (true)', 'r_upd_'||t, t);
    execute format('create policy %I on %I for delete to authenticated using (true)', 'r_del_'||t, t);
  end loop;
end $$;

-- ── Seed: tarefas-padrão NBR 17037 ──
insert into plano_tarefas (aplica_a,periodicidade,descricao,norma_ref,ordem) values
 ('TODOS','MENSAL','Limpeza dos filtros de ar','NBR 17037',10),
 ('TODOS','MENSAL','Verificação de ruídos e vibração','NBR 17037',20),
 ('TODOS','TRIMESTRAL','Limpeza da bandeja e verificação do dreno','NBR 17037',30),
 ('TODOS','TRIMESTRAL','Medição de corrente elétrica','NR-10 / NBR 17037',40),
 ('TODOS','SEMESTRAL','Higienização de serpentinas (evaporadora/condensadora)','NBR 17037',50),
 ('TODOS','SEMESTRAL','Medição ΔT insuflamento/retorno','NBR 16401',60),
 ('TODOS','SEMESTRAL','Verificação de carga de gás / pressões','NBR 17037',70),
 ('TODOS','SEMESTRAL','Análise da qualidade do ar (QAI)','RE 09/2003 ANVISA',80),
 ('TODOS','ANUAL','Inspeção geral e laudo de conformidade','Lei 13.589/2018',90);
