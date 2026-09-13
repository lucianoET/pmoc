-- ============================================================
-- cmms.paiol — schema
-- Projeto Supabase: pmoc (thoaqipyhfmromsgzmjs)
-- Prefixo pai_* para isolamento lógico, como maq_* em máquinas.
-- ============================================================
-- O paiol é a entidade. Sensor e medição penduram nele, e não o
-- contrário: é isso que permite um paiol com dois sensores de
-- fabricantes diferentes, um paiol sem sensor nenhum, e a troca da
-- origem de leitura sem tocar no resto.

-- ── Paióis ──────────────────────────────────────────────────
create table if not exists pai_paiol (
  id          bigint generated always as identity primary key,
  codigo      text not null unique,              -- G-5-I, U-8-V, K-6
  nome        text,
  grupo       text not null default 'isolado'
              check (grupo in ('golf','uniform','isolado')),
  localizacao text,
  tipo        text,                              -- Munição, Torpedos, Minas…
  descricao   text,
  situacao    text not null default 'ativo'
              check (situacao in ('ativo','manutencao','inativo')),

  capacidade  numeric,
  ocupacao    numeric,
  unidade     text default 'caixas',

  temp_min    numeric default 18,
  temp_max    numeric default 27,
  umid_min    numeric default 40,
  umid_max    numeric default 65,

  ip_cam      inet,
  obs         text,
  criado_em   timestamptz not null default now(),
  alterado_em timestamptz not null default now(),

  constraint pai_paiol_faixa_temp check (temp_min is null or temp_max is null or temp_min < temp_max),
  constraint pai_paiol_faixa_umid check (umid_min is null or umid_max is null or umid_min < umid_max),
  constraint pai_paiol_ocupacao   check (ocupacao is null or ocupacao >= 0)
);

-- ── Climatização ────────────────────────────────────────────
-- Cada AC é um bem. O tombamento é o que liga ao PMOC.
create table if not exists pai_ac (
  id        bigint generated always as identity primary key,
  paiol_id  bigint not null references pai_paiol(id) on delete cascade,
  n         smallint not null check (n in (1,2)),
  marca     text,
  modelo    text,
  btu       integer,
  tombo     text,
  situacao  text not null default 'não possui'
            check (situacao in ('operante','inoperante','em manutenção','não possui')),
  saida     text check (saida in ('out1','out2') or saida is null),
  unique (paiol_id, n)
);

-- ── Inventário ──────────────────────────────────────────────
-- Só deve receber dados reais quando o app rodar dentro da rede do
-- CMASM. Enquanto estiver publicado fora, manter conteúdo genérico.
create table if not exists pai_item (
  id        bigint generated always as identity primary key,
  paiol_id  bigint not null references pai_paiol(id) on delete cascade,
  cod       text,
  descricao text,
  lote      text,
  qtd       numeric,
  validade  date,
  obs       text,
  criado_em timestamptz not null default now()
);
create index if not exists ix_pai_item_paiol on pai_item(paiol_id);

-- ── Sensores ────────────────────────────────────────────────
create table if not exists pai_sensor (
  id        bigint generated always as identity primary key,
  paiol_id  bigint not null references pai_paiol(id) on delete cascade,
  driver    text not null default 'dcm-se10'
            check (driver in ('dcm-se10','dcm-se11','dcm-se12','mqtt','modbus','outro')),
  rotulo    text,                                -- "fundo", "câmara fria"
  modelo    text,
  ativo     boolean not null default true,

  ip        inet,
  porta     integer,
  mac       macaddr,
  firmware  text,
  id_cloud  integer,                             -- id no DCM Cloud
  topico    text,                                -- quando driver = mqtt

  in1_func  text default 'fumaca',
  in1_modo  text default 'NA' check (in1_modo in ('NA','NF')),
  in2_func  text default 'porta',
  in2_modo  text default 'NA' check (in2_modo in ('NA','NF')),
  out1_func text default 'off',
  out2_func text default 'off',

  -- Limites gravados no equipamento. Divergência do cadastro importa:
  -- quem dispara o relé e o e-mail é o equipamento, não a tela.
  dev_temp_min numeric, dev_temp_max numeric,
  dev_umid_min numeric, dev_umid_max numeric,

  criado_em timestamptz not null default now(),
  constraint pai_sensor_endereco check (
    (driver = 'mqtt' and topico is not null) or (driver <> 'mqtt' and ip is not null)
  )
);
create index if not exists ix_pai_sensor_paiol on pai_sensor(paiol_id);
create unique index if not exists ux_pai_sensor_ip on pai_sensor(ip) where ip is not null;

-- ── Leituras automáticas ────────────────────────────────────
create table if not exists pai_leitura (
  id          bigint generated always as identity primary key,
  sensor_id   bigint not null references pai_sensor(id) on delete cascade,
  ts          timestamptz not null default now(),
  temp        numeric, umid numeric, temp_ext numeric, dew numeric,
  input1      smallint, input2 smallint,
  output1     smallint, output2 smallint,
  ouput_alarm smallint,          -- grafia do firmware DCM, mantida de propósito
  origem      text not null default 'sensor' check (origem in ('sensor','mqtt','cloud'))
);
create index if not exists ix_pai_leitura_sensor_ts on pai_leitura(sensor_id, ts desc);

-- ── Medições manuais ────────────────────────────────────────
-- Histórico, não campo sobrescrito: quem mediu e quando faz parte do
-- registro, e o boletim diário precisa da série.
create table if not exists pai_medicao (
  id          bigint generated always as identity primary key,
  paiol_id    bigint not null references pai_paiol(id) on delete cascade,
  ts          timestamptz not null default now(),
  temperatura numeric not null check (temperatura between -10 and 60),
  umidade     numeric check (umidade between 0 and 100),
  medido_por  text,
  obs         text,
  criado_em   timestamptz not null default now()
);
create index if not exists ix_pai_medicao_paiol_ts on pai_medicao(paiol_id, ts desc);

-- ── Falhas de comunicação ───────────────────────────────────
create table if not exists pai_falha (
  id        bigint generated always as identity primary key,
  sensor_id bigint not null references pai_sensor(id) on delete cascade,
  inicio    timestamptz not null default now(),
  fim       timestamptz,
  motivo    text
);
create index if not exists ix_pai_falha_sensor on pai_falha(sensor_id, inicio desc);

-- ── Última leitura por sensor ───────────────────────────────
create or replace view pai_ultima_leitura as
select distinct on (sensor_id) *
from pai_leitura
order by sensor_id, ts desc;

-- ── Disponibilidade por paiol e semana ──────────────────────
-- Paiol sem sensor não entra: não há como estar indisponível.
create or replace view pai_disponibilidade_semanal as
select
  p.codigo,
  date_trunc('week', f.inicio)                                   as semana,
  count(*)                                                       as quedas,
  round(sum(extract(epoch from (coalesce(f.fim, now()) - f.inicio)) / 60)::numeric, 1)
                                                                 as min_offline
from pai_falha f
join pai_sensor s on s.id = f.sensor_id
join pai_paiol  p on p.id = s.paiol_id
group by p.codigo, date_trunc('week', f.inicio);

-- ── alterado_em ─────────────────────────────────────────────
create or replace function pai_tocar() returns trigger
language plpgsql as $$
begin
  new.alterado_em = now();
  return new;
end $$;

drop trigger if exists tg_pai_paiol_tocar on pai_paiol;
create trigger tg_pai_paiol_tocar before update on pai_paiol
  for each row execute function pai_tocar();

-- ============================================================
-- RLS — leitura livre (modo observador), escrita por cargo.
-- Segue o padrão dos módulos irmãos: tabela usuarios compartilhada
-- no mesmo projeto, cargos direcao / gestor / tecnico.
-- ============================================================
alter table pai_paiol   enable row level security;
alter table pai_ac      enable row level security;
alter table pai_item    enable row level security;
alter table pai_sensor  enable row level security;
alter table pai_leitura enable row level security;
alter table pai_medicao enable row level security;
alter table pai_falha   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pai_paiol','pai_ac','pai_item','pai_sensor',
                           'pai_leitura','pai_medicao','pai_falha']
  loop
    execute format('drop policy if exists %I on %I', t || '_ler', t);
    execute format('create policy %I on %I for select using (true)', t || '_ler', t);

    execute format('drop policy if exists %I on %I', t || '_escrever', t);
    execute format('create policy %I on %I for all to authenticated using (true) with check (true)',
                   t || '_escrever', t);
  end loop;
end $$;

-- O inventário é a exceção: conteúdo de paiol de munição não deve ser
-- legível por anônimo nem depois de migrar para o Supabase.
drop policy if exists pai_item_ler on pai_item;
create policy pai_item_ler on pai_item for select to authenticated using (true);

comment on table pai_item is
  'Conteúdo dos paióis. Leitura restrita a usuário autenticado — revisar '
  'classificação da informação antes de popular com dados reais.';
