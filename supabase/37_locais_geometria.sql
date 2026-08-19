-- ═══════════════════════════════════════════════════════════════════
-- 37 — Mapa: contorno do prédio (cmasm_locais.geom)
--
-- Migração ADITIVA. Nenhuma tabela é recriada, nenhuma coluna é removida,
-- nenhuma linha é apagada. Rodar inteira no SQL Editor do Supabase.
--
-- Por que esta migração existe: depois da migração 25 um prédio tinha
-- `lat`/`lon` — um PONTO. Um prédio não é um ponto, e a tela provava isso:
-- em 19/08/2026 duas das sete zonas desenhadas em `maq_areas` eram na
-- verdade edifícios ("Predio Comando", "Museu"), desenhados com a
-- ferramenta de zona de serviço porque era a única ferramenta de desenho
-- que existia. Contorno de prédio em `maq_areas` contraria D-03 — zona é
-- auxiliar e temporária, prédio é local permanente da árvore de locais —
-- e, pior, colocaria o edifício na conta de área de corte de grama.
--
-- `geom` é `jsonb` pela mesma razão registrada na migração 25 para
-- `maq_areas.geom`: a lista de vértices `[[lat,lon], ...]` é gravada e
-- lida exatamente como o Leaflet a produz e consome, sem PostGIS, sem
-- consulta espacial no servidor, sem extensão nova para gerenciar.
--
-- `lat`/`lon` continuam existindo e continuam obrigatórios na prática: o
-- app grava o CENTROIDE do contorno no mesmo `update` que grava `geom`
-- (mapa/mapa-dados.js#salvarGeomLocal). A resolução de posição em duas
-- camadas (mapa/mapa-geometria.js#resolverPosicao) não é tocada — ela
-- continua lendo o ponto do prédio para o ativo herdar, e um prédio com
-- contorno e sem ponto deixaria de acender os ativos dele.
--
-- Nenhuma policy nova: `cmasm_locais` já escopa escrita a `authenticated`
-- (migração 19), e a coluna nova herda isso por ser parte da mesma linha.
-- ═══════════════════════════════════════════════════════════════════

alter table cmasm_locais add column if not exists geom jsonb;

comment on column cmasm_locais.geom is
  'Contorno do prédio como lista de vértices [[lat,lon], ...] no mesmo formato de maq_areas.geom. lat/lon guardam o centroide deste contorno.';

-- Diferente de `maq_areas.geom`, que nasceu sem esta guarda: a coluna é
-- nova, então travar a forma aqui não invalida nenhuma linha existente. Um
-- objeto ou um número em `geom` seria aceito em silêncio e só apareceria
-- como prédio que não desenha, sem erro nenhum.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cmasm_locais_geom_array_chk') then
    alter table cmasm_locais add constraint cmasm_locais_geom_array_chk
      check (geom is null or jsonb_typeof(geom) = 'array');
  end if;
end $$;
