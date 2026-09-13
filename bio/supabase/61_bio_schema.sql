-- ═══════════════════════════════════════════════════════════════════
-- 61 — CMASM Bio: fichas de espécies, árvores, presenças e serviços
-- ═══════════════════════════════════════════════════════════════════
-- Módulo /bio — gestão biológica do terreno: guia de campo (fichas),
-- inventário de árvores etiquetadas, onde animais e pragas ocorrem, e os
-- serviços de controle e poda com periodicidade.
--
-- Decisões de forma (spec de 13/09/2026):
--
-- (1) Quatro tabelas, prefixo `bio_`. Árvore é ATIVO (cadastro, etiqueta,
--     posição), não evento: existe, é conhecida, é podada. Animal e praga
--     não têm cadastro individual — o que existe é a FICHA da espécie e a
--     PRESENÇA (onde ocorre), que é estado do terreno e não histórico.
--
-- (2) Local vem de `cmasm_locais` (migração 19), nunca texto livre: é a
--     árvore unificada que Predial, Máquinas e o Mapa já leem, e uma
--     árvore sem coordenada própria herda a posição do local pela mesma
--     regra de `resolverPosicao` (mapa-geometria.js).
--
-- (3) Posição no PAR `lat`/`lon` com as duas travas da migração 25
--     (envelope do CMASM e "nunca pela metade"), coluna a coluna como lá.
--     Polígono de praga em `geom jsonb` no formato `[[lat,lon], …]` — o
--     MESMO de `maq_areas.geom` e `cmasm_locais.geom` — e não GeoJSON,
--     porque é o formato que `mapa-editor.js` grava e `xmap` desenha; um
--     segundo formato obrigaria a converter na fronteira e inverteria
--     lat/lon no primeiro descuido (a lição de `mapa-exportar.js`).
--
-- (4) Serviço aponta para UMA árvore OU UMA presença — `check` de
--     exclusividade, mesmo idioma de `maq_contratacoes` (migração 38).
--     `periodicidade_meses` nulo é avulso; preenchido, o app gera o
--     próximo ao marcar realizado (regra no cliente, como o PMOC).
--
-- (5) Sem policy de DELETE, de propósito: o projeto arquiva
--     (`ativo = false`), nunca apaga — e uma policy que ninguém usa é
--     superfície de escrita sobrando. Se um dia o módulo precisar apagar,
--     a policy nasce junto com o caminho de tela, não antes.
--
-- (6) RBAC pelo padrão de `transp_pode_escrever()` (migração 22): função
--     `security definer` que resolve o papel por `usuarios.auth_id`.
--     Duas funções, dois níveis — presença e serviço são registro de
--     campo (técnico+); ficha e árvore são cadastro (gestor+).
--
-- Aditiva e reexecutável: `if not exists`, `drop policy if exists` antes
-- de cada `create policy`, e as constraints nomeadas guardadas por
-- `pg_constraint`. Nunca `drop table`.
-- ═══════════════════════════════════════════════════════════════════

-- ── funções de papel ──────────────────────────────────────────────────

create or replace function bio_pode_escrever()
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

create or replace function bio_pode_gerir()
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
      and u.role in ('admin', 'gestor')
  )
$$;

revoke execute on function bio_pode_escrever() from public, anon;
revoke execute on function bio_pode_gerir() from public, anon;
grant execute on function bio_pode_escrever() to authenticated;
grant execute on function bio_pode_gerir() to authenticated;

-- ── bio_fichas — guia de campo ────────────────────────────────────────

create table if not exists bio_fichas (
  id                 bigint generated always as identity primary key,
  nome_comum         text not null check (length(trim(nome_comum)) > 0),
  nome_cientifico    text,
  categoria          text not null check (categoria in ('animal', 'praga', 'arvore')),
  grupo              text not null check (grupo in (
                       'mamifero', 'ave', 'peixe', 'reptil', 'anfibio', 'inseto',
                       'aracnideo', 'molusco', 'roedor', 'arvore', 'outro')),
  foto_url           text,
  descricao          text,
  risco              text not null default 'baixo' check (risco in ('baixo', 'medio', 'alto')),
  peconhenta         boolean not null default false,
  o_que_fazer        text,
  controle           text,
  presente_no_cmasm  boolean not null default true,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now()
);

comment on table bio_fichas is
  'Guia de campo: uma ficha por espécie (animal, praga ou árvore). `presente_no_cmasm` filtra o catálogo genérico para a OM sem apagar o resto.';

-- ── bio_arvores — ativos ──────────────────────────────────────────────

create table if not exists bio_arvores (
  id            bigint generated always as identity primary key,
  codigo        text not null unique check (codigo ~ '^ARV-[0-9]{4}$'),
  ficha_id      bigint not null references bio_fichas(id),
  apelido       text,
  local_id      integer references cmasm_locais(id),
  lat           double precision,
  lon           double precision,
  data_plantio  date,
  data_remocao  date,
  obs           text,
  ativo         boolean not null default true,
  criado_por    text,
  criado_em     timestamptz not null default now()
);

comment on table bio_arvores is
  'Uma linha por árvore etiquetada (código ARV-0000 + QR). Removida = ativo false + data_remocao; nunca apagada.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bio_arvores_posicao_envelope_chk') then
    alter table bio_arvores add constraint bio_arvores_posicao_envelope_chk
      check (
        (lat is null or lat between -23.2 and -22.5)
        and (lon is null or lon between -43.5 and -42.7)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bio_arvores_posicao_par_chk') then
    alter table bio_arvores add constraint bio_arvores_posicao_par_chk
      check (num_nulls(lat, lon) <> 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bio_arvores_remocao_chk') then
    -- Data de remoção só existe em árvore removida; o inverso não é
    -- exigido (remoção antiga sem data conhecida é um fato honesto).
    alter table bio_arvores add constraint bio_arvores_remocao_chk
      check (data_remocao is null or ativo = false);
  end if;
end $$;

create index if not exists bio_arvores_ficha_idx  on bio_arvores (ficha_id);
create index if not exists bio_arvores_local_idx  on bio_arvores (local_id);
create index if not exists bio_arvores_ativas_idx on bio_arvores (codigo) where ativo;

-- ── bio_presencas — onde animais e pragas ocorrem ─────────────────────

create table if not exists bio_presencas (
  id                   bigint generated always as identity primary key,
  ficha_id             bigint not null references bio_fichas(id),
  local_id             integer references cmasm_locais(id),
  lat                  double precision,
  lon                  double precision,
  geom                 jsonb,
  data_registro        date not null default current_date,
  quantidade_estimada  integer check (quantidade_estimada is null or quantidade_estimada >= 0),
  obs                  text,
  ativo                boolean not null default true,
  registrado_por       text,
  criado_em            timestamptz not null default now()
);

comment on table bio_presencas is
  'Estado do terreno: a espécie X ocorre no ponto (lat/lon) ou na área (geom [[lat,lon],…]). Editar ou desativar, não acumular — histórico é v2.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bio_presencas_posicao_envelope_chk') then
    alter table bio_presencas add constraint bio_presencas_posicao_envelope_chk
      check (
        (lat is null or lat between -23.2 and -22.5)
        and (lon is null or lon between -43.5 and -42.7)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bio_presencas_posicao_par_chk') then
    alter table bio_presencas add constraint bio_presencas_posicao_par_chk
      check (num_nulls(lat, lon) <> 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bio_presencas_geom_forma_chk') then
    -- Mesma trava de `cmasm_locais.geom` (migração 37): lista com pelo
    -- menos 3 vértices, ou nulo. A forma de cada vértice fica de fora —
    -- é o Leaflet que a valida ao desenhar.
    alter table bio_presencas add constraint bio_presencas_geom_forma_chk
      check (geom is null or (jsonb_typeof(geom) = 'array' and jsonb_array_length(geom) >= 3));
  end if;
end $$;

create index if not exists bio_presencas_ficha_idx  on bio_presencas (ficha_id) where ativo;
create index if not exists bio_presencas_local_idx  on bio_presencas (local_id);

-- ── bio_servicos — poda e controle ────────────────────────────────────

create table if not exists bio_servicos (
  id                   bigint generated always as identity primary key,
  tipo                 text not null check (tipo in (
                         'poda', 'supressao', 'dedetizacao', 'desratizacao',
                         'armadilha', 'isca', 'monitoramento', 'outro')),
  arvore_id            bigint references bio_arvores(id),
  presenca_id          bigint references bio_presencas(id),
  status               text not null default 'programado'
                         check (status in ('programado', 'realizado', 'cancelado')),
  data_programada      date not null,
  data_realizada       date,
  executor             text,
  materiais            text,
  periodicidade_meses  integer check (periodicidade_meses is null or periodicidade_meses between 1 and 120),
  obs                  text,
  foto_url             text,
  criado_por           text,
  criado_em            timestamptz not null default now()
);

comment on table bio_servicos is
  'Serviço de poda (árvore) ou controle (presença). Realizado com periodicidade gera o próximo programado — regra no cliente.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bio_servicos_alvo_chk') then
    -- Exatamente um alvo: árvore OU presença. Nem os dois, nem nenhum.
    alter table bio_servicos add constraint bio_servicos_alvo_chk
      check ((arvore_id is null) <> (presenca_id is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bio_servicos_realizado_chk') then
    -- Realizado exige a data em que foi feito; os outros estados não a têm.
    alter table bio_servicos add constraint bio_servicos_realizado_chk
      check ((status = 'realizado') = (data_realizada is not null));
  end if;
end $$;

create index if not exists bio_servicos_agenda_idx   on bio_servicos (status, data_programada);
create index if not exists bio_servicos_arvore_idx   on bio_servicos (arvore_id);
create index if not exists bio_servicos_presenca_idx on bio_servicos (presenca_id);

-- ── grants ────────────────────────────────────────────────────────────
-- Leitura pública (cargo Livre é `anon`), escrita autenticada — quem
-- decide o papel é a policy, não o grant.

grant select on bio_fichas, bio_arvores, bio_presencas, bio_servicos to anon, authenticated;
grant insert, update on bio_fichas, bio_arvores, bio_presencas, bio_servicos to authenticated;
grant usage, select on sequence bio_fichas_id_seq, bio_arvores_id_seq,
  bio_presencas_id_seq, bio_servicos_id_seq to anon, authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────

alter table bio_fichas    enable row level security;
alter table bio_arvores   enable row level security;
alter table bio_presencas enable row level security;
alter table bio_servicos  enable row level security;

-- fichas e árvores: cadastro → gestor+
drop policy if exists sel_bio_fichas on bio_fichas;
drop policy if exists ins_bio_fichas on bio_fichas;
drop policy if exists upd_bio_fichas on bio_fichas;
create policy sel_bio_fichas on bio_fichas for select using (true);
create policy ins_bio_fichas on bio_fichas for insert to authenticated with check ((select bio_pode_gerir()));
create policy upd_bio_fichas on bio_fichas for update to authenticated using ((select bio_pode_gerir()));

drop policy if exists sel_bio_arvores on bio_arvores;
drop policy if exists ins_bio_arvores on bio_arvores;
drop policy if exists upd_bio_arvores on bio_arvores;
create policy sel_bio_arvores on bio_arvores for select using (true);
create policy ins_bio_arvores on bio_arvores for insert to authenticated with check ((select bio_pode_gerir()));
create policy upd_bio_arvores on bio_arvores for update to authenticated using ((select bio_pode_gerir()));

-- presenças e serviços: registro de campo → técnico+
drop policy if exists sel_bio_presencas on bio_presencas;
drop policy if exists ins_bio_presencas on bio_presencas;
drop policy if exists upd_bio_presencas on bio_presencas;
create policy sel_bio_presencas on bio_presencas for select using (true);
create policy ins_bio_presencas on bio_presencas for insert to authenticated with check ((select bio_pode_escrever()));
create policy upd_bio_presencas on bio_presencas for update to authenticated using ((select bio_pode_escrever()));

drop policy if exists sel_bio_servicos on bio_servicos;
drop policy if exists ins_bio_servicos on bio_servicos;
drop policy if exists upd_bio_servicos on bio_servicos;
create policy sel_bio_servicos on bio_servicos for select using (true);
create policy ins_bio_servicos on bio_servicos for insert to authenticated with check ((select bio_pode_escrever()));
create policy upd_bio_servicos on bio_servicos for update to authenticated using ((select bio_pode_escrever()));

-- ── verificação (rodar depois, à mão) ─────────────────────────────────
--   select tablename, policyname, cmd from pg_policies
--    where tablename like 'bio_%' order by 1, 3;             -- 3 por tabela
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid::regclass::text like 'bio_%';            -- as travas
--   Pela porta da frente (anon key): select 200, POST 401, PATCH [].
