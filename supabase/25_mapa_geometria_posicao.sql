-- ═══════════════════════════════════════════════════════════════════
-- 25 — Mapa operacional: geometria de zona e posição geográfica de ativo
--
-- Migração ADITIVA. Nenhuma tabela é recriada, nenhuma coluna é removida,
-- nenhuma linha é apagada. Rodar inteira no SQL Editor do Supabase.
--
-- Por que esta migração existe: nenhuma tabela do projeto tinha coordenada
-- geográfica. O vínculo `local_id` (migração 19) posiciona um ativo na
-- árvore organizacional de `cmasm_locais` — prédio, sala — mas essa árvore
-- em si não tem `lat`/`lon`. É um vínculo lógico, não geográfico. Sem esta
-- migração, "plotar ativo no mapa" produz um mapa vazio, sem erro nenhum,
-- porque o código de camada já descarta em silêncio quem não tem
-- lat/lon (`mapa/xmap-layers-grama.js:154`).
--
-- Geometria de zona (`maq_areas.geom`) é `jsonb`, não PostGIS: nenhuma
-- consulta espacial acontece no servidor nesta fase — a lista de vértices
-- `[[lat,lon], ...]` é gravada e lida como o Leaflet já a produz e consome,
-- sem `parse`/`stringify` redundante e sem extensão nova para gerenciar.
--
-- Nenhuma policy nova é criada. As seis tabelas alteradas aqui já escopam
-- `insert`/`update` a `authenticated` (ver `12_maquinas_areas_operacoes.sql`,
-- `17_predial_schema.sql`, `14_eletrica_fonoclama_schema.sql`,
-- `10_transportes_schema.sql`, `04_refrigeracao_schema.sql`); as colunas
-- novas herdam essa restrição por serem parte da mesma linha/tabela. Essa é
-- a barreira real que impede o observador de gravar: o acesso "Livre" do
-- observador nunca chama `supa.auth.signInWithPassword()`
-- (`shared/auth.js:210-217`), então ele opera sempre como o papel Postgres
-- `anon`, jamais `authenticated`.
-- ═══════════════════════════════════════════════════════════════════

-- ── Parte 1 — zona de serviço em maq_areas (D-03) ──
-- Geometria e os três atributos de terreno que o editor de zona (plano
-- 10-06) grava. `maq_areas` já existe desde a migração 12; esta migração só
-- acrescenta colunas.
--
-- `geom` é a evolução do `coords_json` do legado (texto contendo JSON) para
-- o tipo nativo `jsonb`: `[[lat,lon],[lat,lon],...]`, exatamente como o
-- Leaflet devolve e consome.
--
-- Os três `check ... in (...)` abaixo são a tradução para o banco do mesmo
-- princípio de lista fechada que `normalizarTema` já aplica no cliente
-- desde a Fase 6: a validação da tela é conveniência, a do banco é a
-- barreira (ASVS V5).
--
-- Não criamos coluna `maquinas_compativeis`: a compatibilidade é derivada
-- dos três atributos por função pura no cliente (plano 10-02,
-- `calcCompatCliente`) e guardá-la no banco seria uma segunda fonte de
-- verdade que envelhece sozinha assim que um dos três atributos mudar sem
-- recalcular a coluna.
--
-- Não tocamos no `check` de `tipo` de `maq_areas` (D-03): o vocabulário do
-- editor legado (`jardim|bosque|canteiro|area_recreativa|horta`) não bate
-- com o já travado no banco (`corte|poda|limpeza|mista|outro`), mas
-- alterá-lo exigiria remover e recriar a restrição, fora do escopo aditivo
-- deste plano — o editor do plano 10-06 usa o vocabulário que já está aqui.
alter table maq_areas add column if not exists geom jsonb;
alter table maq_areas add column if not exists flora text
  check (flora is null or flora in ('gramado','capim_colonial','mata_fechada'));
alter table maq_areas add column if not exists inclinacao text
  check (inclinacao is null or inclinacao in ('plano','moderado','acentuado'));
alter table maq_areas add column if not exists limpeza text
  check (limpeza is null or limpeza in ('limpa','media','densa'));

-- ── Parte 2 — posição geográfica, em duas camadas, nas seis tabelas ──
-- `cmasm_locais.lat/lon` é a posição herdada do prédio ou da sala — todo
-- ativo cujo `local_id` aponta para um local com coordenada aparece lá por
-- padrão, sem exigir digitar uma coordenada por ativo.
--
-- A posição na própria tabela do ativo é o override individual: é o que
-- PLAT-20 grava quando alguém arrasta um ativo no mapa. Sem essa segunda
-- camada, mover um ativo moveria todos os ativos do mesmo prédio, porque
-- `cmasm_locais` é compartilhada por todos eles.
--
-- Doze linhas explícitas, uma por linha, mesma forma que a migração 19 usou
-- para `local_id` nestas mesmas tabelas. Sem laço `do $$ foreach`: a lista é
-- fixa, curta, e o arquivo é lido por humano antes de rodar num banco de
-- produção compartilhado com dois módulos em produção.
alter table cmasm_locais   add column if not exists lat double precision;
alter table cmasm_locais   add column if not exists lon double precision;
alter table maq_ativos     add column if not exists lat double precision;
alter table maq_ativos     add column if not exists lon double precision;
alter table transp_ativos  add column if not exists lat double precision;
alter table transp_ativos  add column if not exists lon double precision;
alter table elet_ativos    add column if not exists lat double precision;
alter table elet_ativos    add column if not exists lon double precision;
alter table fono_ativos    add column if not exists lat double precision;
alter table fono_ativos    add column if not exists lon double precision;
alter table equipamentos   add column if not exists lat double precision;
alter table equipamentos   add column if not exists lon double precision;

-- ── Parte 3 — travas de integridade, uma dupla por tabela ──
-- Restrição nomeada não aceita a cláusula `if not exists` no Postgres,
-- então cada uma é guardada por uma checagem em `pg_constraint` antes de
-- criar — o mesmo idioma que a migração 12 usa com `pg_policies` — para que
-- o arquivo possa ser reexecutado sem erro.
--
-- Doze restrições escritas uma a uma, com o nome da tabela literal em cada
-- comando de alteração. Nada de laço `foreach` com `execute format`: o
-- arquivo é lido por humano antes de ser colado num banco de produção, e um
-- laço esconde exatamente o que está sendo alterado.
--
-- `_posicao_envelope_chk` — recusa coordenada fora da região do CMASM, numa
-- única restrição por tabela combinando lat e lon. O alvo real é o **par
-- trocado**: uma latitude do CMASM (-22,8) gravada por engano na coluna de
-- longitude cai fora da faixa de longitude (-43.5 a -42.7) e é rejeitada na
-- hora, em vez de virar um marcador no meio do oceano Índico. O zero
-- acidental (0,0) também cai fora das duas faixas. Os quatro números são um
-- envelope de segurança grosseiro em torno do CMASM (-22,8396 / -43,1094),
-- com folga de dezenas de quilômetros — não é uma cerca geográfica precisa
-- do terreno.
--
-- `_posicao_par_chk` — recusa posição pela metade (`num_nulls(lat, lon) <>
-- 1`). Sem ela, gravar só `lat` produz um ativo que o mapa descarta em
-- silêncio e que nenhuma consulta acusa — a "quebra silenciosa" que a
-- pesquisa desta fase identificou.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cmasm_locais_posicao_envelope_chk') then
    alter table cmasm_locais add constraint cmasm_locais_posicao_envelope_chk
      check (
        (lat is null or lat between -23.2 and -22.5)
        and (lon is null or lon between -43.5 and -42.7)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cmasm_locais_posicao_par_chk') then
    alter table cmasm_locais add constraint cmasm_locais_posicao_par_chk
      check (num_nulls(lat, lon) <> 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'maq_ativos_posicao_envelope_chk') then
    alter table maq_ativos add constraint maq_ativos_posicao_envelope_chk
      check (
        (lat is null or lat between -23.2 and -22.5)
        and (lon is null or lon between -43.5 and -42.7)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_ativos_posicao_par_chk') then
    alter table maq_ativos add constraint maq_ativos_posicao_par_chk
      check (num_nulls(lat, lon) <> 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transp_ativos_posicao_envelope_chk') then
    alter table transp_ativos add constraint transp_ativos_posicao_envelope_chk
      check (
        (lat is null or lat between -23.2 and -22.5)
        and (lon is null or lon between -43.5 and -42.7)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transp_ativos_posicao_par_chk') then
    alter table transp_ativos add constraint transp_ativos_posicao_par_chk
      check (num_nulls(lat, lon) <> 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'elet_ativos_posicao_envelope_chk') then
    alter table elet_ativos add constraint elet_ativos_posicao_envelope_chk
      check (
        (lat is null or lat between -23.2 and -22.5)
        and (lon is null or lon between -43.5 and -42.7)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'elet_ativos_posicao_par_chk') then
    alter table elet_ativos add constraint elet_ativos_posicao_par_chk
      check (num_nulls(lat, lon) <> 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fono_ativos_posicao_envelope_chk') then
    alter table fono_ativos add constraint fono_ativos_posicao_envelope_chk
      check (
        (lat is null or lat between -23.2 and -22.5)
        and (lon is null or lon between -43.5 and -42.7)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fono_ativos_posicao_par_chk') then
    alter table fono_ativos add constraint fono_ativos_posicao_par_chk
      check (num_nulls(lat, lon) <> 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'equipamentos_posicao_envelope_chk') then
    alter table equipamentos add constraint equipamentos_posicao_envelope_chk
      check (
        (lat is null or lat between -23.2 and -22.5)
        and (lon is null or lon between -43.5 and -42.7)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipamentos_posicao_par_chk') then
    alter table equipamentos add constraint equipamentos_posicao_par_chk
      check (num_nulls(lat, lon) <> 1);
  end if;
end $$;

-- ── Parte 4 — índices parciais ──
-- A consulta do mapa é sempre "só os ativos que têm posição"
-- (`where lat is not null`); o índice parcial cobre exatamente esse caso e
-- não cresce com as linhas sem coordenada.
create index if not exists cmasm_locais_posicao_idx   on cmasm_locais   (lat, lon) where lat is not null;
create index if not exists maq_ativos_posicao_idx     on maq_ativos     (lat, lon) where lat is not null;
create index if not exists transp_ativos_posicao_idx  on transp_ativos  (lat, lon) where lat is not null;
create index if not exists elet_ativos_posicao_idx    on elet_ativos    (lat, lon) where lat is not null;
create index if not exists fono_ativos_posicao_idx    on fono_ativos    (lat, lon) where lat is not null;
create index if not exists equipamentos_posicao_idx   on equipamentos   (lat, lon) where lat is not null;

-- ── Conferência (rodar depois de aplicar) ──
--   -- colunas novas de maq_areas:
--   select column_name from information_schema.columns
--    where table_name = 'maq_areas' and column_name in ('geom','flora','inclinacao','limpeza');
--   -- 4 linhas esperadas
--
--   -- ativos com posição própria, por tabela (esperado 0 logo após aplicar,
--   -- antes de qualquer ativo ser posicionado pela tela):
--   select count(*) from maq_ativos    where lat is not null;
--   select count(*) from transp_ativos where lat is not null;
--   select count(*) from elet_ativos   where lat is not null;
--   select count(*) from fono_ativos   where lat is not null;
--   select count(*) from equipamentos  where lat is not null;
--   select count(*) from cmasm_locais  where lat is not null;
--
--   -- policies de escrita das seis tabelas, todas escopadas a authenticated:
--   select tablename, policyname, roles from pg_policies
--    where schemaname = 'public'
--      and tablename in ('cmasm_locais','maq_ativos','transp_ativos','elet_ativos','fono_ativos','equipamentos')
--      and cmd in ('INSERT','UPDATE')
--    order by tablename, policyname;
