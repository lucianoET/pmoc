---
phase: 10-mapa-operacional
plan: 04
subsystem: frontend
tags: [leaflet, geojson, osm, offline, tiles, pwa-adjacent]

requires:
  - phase: 10-mapa-operacional plan 02
    provides: "mapa/mapa-geometria.js — núcleo puro do mapa e o padrão núcleo/aplicador que este plano segue implicitamente (gerar-planta.mjs é núcleo, sem document/window/L.)"
provides:
  - "mapa/gerar-planta.mjs — conversor de linha de comando, sem dependência e sem rede, de extrato .osm para GeoJSON"
  - "mapa/planta-cmasm.geojson — a área do CMASM como geometria vetorial estática (117 feições, 171 KB), base do mapa que desenha sem rede"
  - "mapa/xmap.js — TileLocalComFallback (tile local com queda para o provedor online), instanciada só no basemap map; desenho da planta vetorial num painel próprio"
  - "mapa/tiles/GERAR-TILES.md — procedimento de geração de tiles raster, com a proibição de bulk download e as alternativas legítimas"
  - "tests/mapa-base-offline.test.js — gate de PLAT-19 e D-02, 10 casos"
affects: [10-08]

tech-stack:
  added: []
  patterns:
    - "Conversor de dado bruto ODbL em GeoJSON estático, sem dependência, como caminho legítimo alternativo a um serviço de tiles restrito por política de uso — mapa/gerar-planta.mjs pode servir de referência para qualquer futuro extrato OSM adicional"
    - "createTile customizado (L.TileLayer.extend) reaproveitando a API pública getTileUrl() do Leaflet para montar duas URLs (local/online) em vez de reimplementar a montagem de subdomínio/retina/zoom — mais seguro que replicar métodos internos (_getTileData não existe na API real do Leaflet 1.9.4, só no esboço do RESEARCH; ver Deviations)"
    - "Decisão de exclusão de escopo (D-02) vira gate escopado à região do arquivo, não ao arquivo inteiro — mesmo padrão de tests/mapa-decisoes.test.js (D-01/D-04), necessário aqui porque a mesma classe aparece legitimamente na construção do outro basemap"

key-files:
  created:
    - mapa/gerar-planta.mjs
    - mapa/planta-cmasm.geojson
    - mapa/tiles/GERAR-TILES.md
    - mapa/tiles/.gitkeep
    - tests/mapa-base-offline.test.js
  modified:
    - mapa/xmap.js

key-decisions:
  - "createTile usa this.getTileUrl(coords) (API pública documentada do L.TileLayer) com troca síncrona de this._url, em vez do this._getTileData(coords) do esboço do RESEARCH/PATTERNS — esse método não existe na API real do Leaflet 1.9.4 (confirmado contra o código-fonte via Context7); getTileUrl() já cobre retina/subdomínio/zoomOffset/TMS corretamente, sem reimplementar essa lógica à mão"
  - "Polígono vs. linha decidido por chave principal, não por 'tem etiqueta de área' genérico: building/landuse/natural/man_made viram polígono quando o caminho é fechado; highway/waterway/barrier/place continuam linha mesmo fechados — evita que uma via em rotatória ou um curso de água feche acidentalmente como área preenchida"
  - "Pane customizado xmap-planta-pane com zIndex 350, entre o tilePane (200) e o overlayPane (400) do Leaflet — a planta nunca cobre marcador/polígono de módulo, e fica sempre acima do tile de qualquer basemap"
  - "Feature.id (nível GeoJSON, fora de properties) guarda o identificador de origem OSM, usado só para a ordenação determinística do conversor — não conta como quarta propriedade além de chave/valor/nome, que continuam as únicas em properties"

requirements-completed: [PLAT-19, PLAT-16]

coverage:
  - id: D1
    description: "A área do CMASM desenha com a rede desligada, a partir de mapa/planta-cmasm.geojson (117 feições: 39 polígonos incl. 22 edificações, 66 linhas, 12 pontos nomeados), 171 KB, bem abaixo do teto de 500 KB, com atribuição ODbL nos metadados e saída reproduzível byte a byte"
    requirement: "PLAT-19"
    verification:
      - kind: unit
        ref: "tests/mapa-base-offline.test.js#mapa/planta-cmasm.geojson existe, é JSON válido, é FeatureCollection e tem pelo menos 100 feições"
        status: pass
      - kind: unit
        ref: "tests/mapa-base-offline.test.js#mapa/planta-cmasm.geojson traz a atribuição ODbL nos metadados"
        status: pass
      - kind: unit
        ref: "tests/mapa-base-offline.test.js#mapa/planta-cmasm.geojson cabe no orçamento de 500 KB"
        status: pass
      - kind: other
        ref: "gate estático da Task 1 do plano — determinismo (cmp byte a byte entre duas execuções do conversor) e ausência de import/chamada de rede"
        status: pass
    human_judgment: false
  - id: D2
    description: "TileLocalComFallback (tile local com queda para o provedor online) instanciada uma única vez, só no basemap map, funcionando hoje com zero tiles em mapa/tiles/ (toda tentativa local falha, o online assume — comportamento idêntico ao de antes deste plano)"
    requirement: "PLAT-19"
    verification:
      - kind: unit
        ref: "tests/mapa-base-offline.test.js#TileLocalComFallback é instanciada exatamente uma vez em mapa/xmap.js"
        status: pass
      - kind: unit
        ref: "tests/mapa-base-offline.test.js#o modelo de tile local e a planta usam caminho absoluto de raiz em mapa/xmap.js"
        status: pass
    human_judgment: true
    rationale: "O comportamento de queda (tile local ausente → onerror → provedor online) só é observável de fato no navegador, carregando o mapa com e sem os tiles locais presentes — o gate automatizado confirma a estrutura do código (classe, instanciação única, caminho absoluto), não o comportamento runtime de rede. Verificação visual fica para o roteiro de UAT do plano 10-08."
  - id: D3
    description: "O basemap satellite não ganha camada local nem fallback (D-02): construído pelo construtor padrão do Leaflet, sem TileLocalComFallback e sem referência a /mapa/tiles/, travado por gate escopado à região do arquivo"
    requirement: "PLAT-19"
    verification:
      - kind: unit
        ref: "tests/mapa-base-offline.test.js#D-02 — a construção do basemap de satélite em mapa/xmap.js não referencia tile local nem TileLocalComFallback"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhum script do projeto é capaz de baixar tile: mapa/gerar-planta.mjs não importa módulo de rede, e mapa/xmap.js é o único arquivo JS de código (fora de tests/) que menciona tile.openstreetmap.org — como endereço de queda, não como alvo de download em massa (T-10-17)"
    requirement: "PLAT-19"
    verification:
      - kind: unit
        ref: "tests/mapa-base-offline.test.js#nenhum script do projeto baixa tile — só mapa/xmap.js menciona o serviço público de tiles, como endereço de queda"
        status: pass
      - kind: unit
        ref: "tests/mapa-base-offline.test.js#mapa/gerar-planta.mjs não importa nenhum módulo de rede"
        status: pass
    human_judgment: false
  - id: D5
    description: "mapa/tiles/GERAR-TILES.md documenta o procedimento de geração de tiles raster: o que o diretório é, a proibição de bulk download com o motivo (padrão de acesso, não volume), a cadeia de ferramentas com limites geográficos e faixa de zoom literais, avaliação honesta de esforço, duas alternativas legítimas nomeadas e a limitação física de testar offline contra produção (sem service worker)"
    requirement: "PLAT-19"
    verification:
      - kind: unit
        ref: "tests/mapa-base-offline.test.js#mapa/tiles/GERAR-TILES.md existe e cobre a proibição, a fonte ODbL, as alternativas e a limitação do teste contra produção"
        status: pass
    human_judgment: false
  - id: D6
    description: "node --test sobe de 101 para 111 (fail 0), nenhum teste do baseline removido; mapa/xmap.css e refrigeracao/ continuam intocados"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "node --test (101 → 111, fail 0)"
        status: pass
      - kind: other
        ref: "git diff --name-only -- mapa/xmap.css (0 arquivos); git diff --name-only 511bb9e..HEAD -- refrigeracao/ (0 arquivos)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 04: Base offline do mapa — planta vetorial e tile local com fallback Summary

**O mapa desenha a área do CMASM com a rede desligada a partir de uma planta vetorial de 171 KB convertida do extrato OSM local (117 feições, sem dependência, sem rede), e ganha um mecanismo de tile local com queda para o provedor online — funcionando hoje com zero tiles no disco — enquanto o satélite permanece travado como apenas online por gate automatizado (D-02).**

## Performance

- **Duration:** ~35min
- **Completed:** 2026-08-12
- **Tasks:** 3/3 completed
- **Files modified:** 6 (5 novos, 1 editado)

## Accomplishments

- `mapa/gerar-planta.mjs` criado: conversor de linha de comando, módulo ES sem dependência externa (só `node:fs`, `node:url`, `node:path`) e sem nenhum caminho de acesso a rede — conferido por gate estático (nenhum `import` fora de `node:`, nenhuma chamada `fetch`/`XMLHttpRequest`/`https.request` fora de comentário).
- `mapa/planta-cmasm.geojson` gerado a partir de `map_cmasm_2026abr.osm` (908 KB, somente leitura, `DEV_reference_readonly`): **117 feições reais** — 39 polígonos (incluindo 22 edificações), 66 linhas (vias, cursos de água, elementos naturais/construídos, barreiras) e 12 pontos nomeados — em **171 146 bytes**, bem abaixo do teto de 500 KB. Atribuição ODbL nos metadados. Saída reproduzível byte a byte (`cmp` entre duas execuções do conversor sobre o mesmo extrato).
- `mapa/xmap.js`: `TileLocalComFallback` (`L.TileLayer.extend`, `createTile` customizado) instanciada uma única vez, só no basemap `map`, com `/mapa/tiles/{z}/{x}/{y}.png` (caminho absoluto de raiz) e queda para `TILES.map.url` no primeiro erro — funciona hoje com zero tiles em `mapa/tiles/` (toda tentativa local falha, o online assume, comportamento idêntico ao de antes deste plano). O basemap `satellite` continua construído pelo caminho padrão do Leaflet, sem a classe nova e sem referência a tile local (D-02).
- `mapa/xmap.js`: planta vetorial buscada por `/mapa/planta-cmasm.geojson` (caminho absoluto de raiz) e desenhada num painel próprio (`xmap-planta-pane`, `zIndex 350`) — entre o tile (200) e as camadas de módulo (`overlayPane`, 400) — com estilo por `chave` em opção de JavaScript (`mapa/xmap.css` continua intocado, D-01 da Fase 6) e falha de busca tratada com `.catch()` que não derruba o mapa.
- `mapa/tiles/GERAR-TILES.md` escrito: o que o diretório é (não é pré-requisito, a planta já resolve o offline), a proibição de bulk download da Tile Usage Policy do OSM com o motivo (padrão de acesso, não volume), a cadeia de ferramentas confirmada (Mapnik/`generate_tiles.py`, `osmium`, TileMill) com os limites geográficos literais do extrato e a faixa de zoom, avaliação honesta de esforço, duas alternativas legítimas nomeadas (provedor com cache local sob assinatura; navegação manual como leitura permissiva da política) e a limitação física de testar offline contra produção (projeto sem service worker).
- `mapa/tiles/.gitkeep` criado — o caminho de tile local existe no repositório mesmo com zero tile.
- `tests/mapa-base-offline.test.js` criado com **10 casos**: validade/atribuição/orçamento da planta, D-02 por gate escopado à região do satélite, instanciação única da classe customizada, contagem de arquivos JS de código que mencionam o serviço público de tiles (só `mapa/xmap.js`, como endereço de queda), ausência de import de rede no gerador, caminhos absolutos de raiz, e cobertura do procedimento escrito.
- `node --test`: **101 → 111** (10 casos novos), 0 falhas, nenhum teste do baseline removido (PLAT-16). `mapa/xmap.css` e `refrigeracao/` confirmados intocados.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Converter o extrato OSM local em planta vetorial estática** — `08a7b62` (feat)
2. **Task 2: Dar ao basemap de mapa a planta vetorial offline e o tile local com queda para o online — e só a ele (D-02)** — `5a4cb1f` (feat)
3. **Task 3: Escrever o procedimento de geração de tiles e travar por gate a proibição de baixá-los** — `701eafd` (test)

**Plan metadata:** (a seguir, neste commit)

## Files Created/Modified

- `mapa/gerar-planta.mjs` — conversor de extrato OSM em GeoJSON, sem dependência e sem rede, três passagens (pontos → caminhos → pontos nomeados), filtro de etiquetas por lista fechada, saída determinística
- `mapa/planta-cmasm.geojson` — a área do CMASM como geometria vetorial estática (117 feições, 171 KB), commitado como resultado da conversão
- `mapa/xmap.js` — `TileLocalComFallback` (tile local com fallback online, só no basemap `map`) e desenho da planta vetorial num painel próprio, abaixo das camadas de módulo
- `mapa/tiles/GERAR-TILES.md` — procedimento de geração de tiles raster com proibição de bulk download, cadeia de ferramentas, alternativas e limitação de teste contra produção
- `mapa/tiles/.gitkeep` — marca de presença do diretório de tiles
- `tests/mapa-base-offline.test.js` — 10 casos travando PLAT-19 e D-02

## Decisions Made

- `createTile` reaproveita `this.getTileUrl(coords)` — a API pública documentada do `L.TileLayer` — com troca síncrona de `this._url` para montar a URL online, em vez do `this._getTileData(coords)` do esboço em `10-PATTERNS.md`/`10-RESEARCH.md`. Conferido contra o código-fonte real do Leaflet (via Context7): esse método não existe na API pública nem privada do `L.TileLayer` 1.9.4 — `getTileUrl()` já monta corretamente `{r}` (retina), `{s}` (subdomínio) e `{z}` (`_getZoomForUrl()`, considerando `zoomOffset`), sem reimplementar essa lógica à mão. Ver Deviations.
- Polígono vs. linha na conversão decidido pela chave principal do elemento (`building`/`landuse`/`natural`/`man_made` viram polígono quando o caminho é fechado), não por qualquer caminho fechado ser tratado como área — `highway`, `waterway`, `barrier` e `place` continuam linha mesmo fechados, evitando que uma rotatória ou um curso de água em anel virem acidentalmente um polígono preenchido.
- `TileLocalComFallback` usa `maxNativeZoom: 17` (não 18/19), replicando o precedente do módulo `aguada` — acima desse nível o Leaflet reamostra o tile 17 em vez de pedir um tile que não existirá.
- O `Feature.id` do GeoJSON (campo de nível GeoJSON, fora de `properties`) guarda o identificador de origem OSM — usado só para a ordenação determinística do conversor, não conta como uma quarta propriedade além das três exigidas pelo plano (`chave`, `valor`, `nome`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `createTile` não usa `this._getTileData(coords)` — método inexistente na API real do Leaflet**
- **Found during:** Task 2, ao escrever `TileLocalComFallback`
- **Issue:** O esboço em `10-PATTERNS.md`/`10-RESEARCH.md` (Pattern 6) usa `this._getTileData(coords)` para montar os dados de template da URL. Conferido contra o código-fonte real do `L.TileLayer` (Leaflet 1.9.4, via Context7): esse método não existe — o Leaflet monta a URL inteiramente dentro de `getTileUrl(coords)`, sem expor um passo intermediário de "dados de template" como método próprio. Copiar o esboço ao pé da letra teria produzido um `TypeError: this._getTileData is not a function` em tempo de execução no primeiro tile — um bug que só apareceria no navegador, não no `node --check` estático.
- **Fix:** `createTile` chama `this.getTileUrl(coords)` (API pública documentada) para a URL local, e para a URL online troca temporariamente `this._url` pelo template de `this.options.urlOnline`, chama `this.getTileUrl(coords)` de novo e restaura `this._url` — tudo de forma síncrona, sem janela de corrida com outros tiles em construção. Resultado: mesma URL que o Leaflet geraria nativamente para os dois templates, com retina/subdomínio/zoom corretos, sem reimplementar essa lógica.
- **Files modified:** `mapa/xmap.js`
- **Verification:** `node --check` na cópia do arquivo, mais os 10 casos de `tests/mapa-base-offline.test.js` (a classe continua nomeável, instanciada uma vez, com `createTile` presente) — a correção de comportamento runtime em si só é observável no navegador (ver coverage D2, `human_judgment: true`)
- **Committed in:** `5a4cb1f` (Task 2)

---

**Total deviations:** 1 auto-fixado (Regra 1 — bug de API inexistente no esboço do plano)
**Impact on plan:** Correção necessária para que o mecanismo de fallback funcione de fato no navegador; sem ela, o `<verify>` estático da Task 2 passaria (o gate só confere texto/estrutura), mas o primeiro tile carregado quebraria em runtime. Nenhum scope creep — a assinatura pública do componente e o restante do arquivo não mudaram além do que a Task 2 já previa.

## Issues Encountered

None além da deviation acima, já registrada.

## User Setup Required

**Geração de tiles raster locais (opcional, melhora a fidelidade do mapa base offline).** O mapa já desenha a área do CMASM sem rede desde este plano, pela planta vetorial — os tiles raster são fidelidade cartográfica adicional, não pré-requisito. Procedimento completo em [`mapa/tiles/GERAR-TILES.md`](../../../mapa/tiles/GERAR-TILES.md):

1. Seguir o procedimento para renderizar os tiles a partir do extrato `.osm` local (cadeia Mapnik/`osmium`, fora do zero-build, roda uma vez na máquina do usuário) e colocá-los em `mapa/tiles/{z}/{x}/{y}.png`.
2. Contar os arquivos gerados e medir o tamanho total (`du -sh mapa/tiles/`) antes de decidir entre repositório e alternativa — a estimativa de ~12 MB é estimativa, não medição.

Não é passo de deploy — não bloqueia o restante da Fase 10.

## Next Phase Readiness

- `mapa/gerar-planta.mjs` e `mapa/planta-cmasm.geojson` estão prontos; nenhum plano seguinte precisa deles diretamente, mas o padrão (dado ODbL bruto convertido localmente, sem rede) fica disponível se surgir necessidade de mais camadas de dado geográfico estático.
- `mapa/xmap.js` continua publicando o mesmo contrato (`registerLayer`, `setModules`, `toggleBasemap`, `getLeafletMap`, `init`, `updateElement`) — os planos 10-05/10-06/10-07, que editam `xmap-layers-*.js` e criam `mapa-editor.js`, não são afetados pela mudança deste plano.
- **Verificação visual pendente para o roteiro de UAT do plano 10-08:** este plano prova a estrutura por gate automatizado (classe existe, instanciada uma vez, caminhos corretos, D-02 travada), mas o comportamento de queda tile-local→online e o desenho real da planta só são observáveis abrindo `/mapa` no navegador — com e sem rede, com e sem tiles locais presentes. O `honest_scope_note` do plano já registrava que isso não é testável contra produção (sem service worker); fica explícito aqui como item do roteiro de UAT, não como lacuna deste plano.
- Tiles raster locais continuam em zero (`mapa/tiles/` só tem `.gitkeep`) — é decisão consciente do plano, não pendência: o mecanismo de fallback já funciona sem eles, e a geração é `user_setup`, fora do escopo de execução autônoma.

---
*Phase: 10-mapa-operacional*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: mapa/gerar-planta.mjs
- FOUND: mapa/planta-cmasm.geojson
- FOUND: mapa/xmap.js
- FOUND: mapa/tiles/GERAR-TILES.md
- FOUND: mapa/tiles/.gitkeep
- FOUND: tests/mapa-base-offline.test.js
- FOUND: .planning/phases/10-mapa-operacional/10-04-SUMMARY.md
- FOUND commit: 08a7b62 (feat 10-04 conversor de planta)
- FOUND commit: 5a4cb1f (feat 10-04 tile local + planta no xmap.js)
- FOUND commit: 701eafd (test 10-04 procedimento de tiles + gate)
