---
phase: 10-mapa-operacional
plan: 06
subsystem: frontend
tags: [leaflet-draw, supabase, rbac-vocabulary, pure-core-reuse, cargo-scoping]

requires:
  - phase: 10-mapa-operacional plan 01
    provides: "maq_areas.geom/flora/inclinacao/limpeza (migração 25) — as colunas onde este plano grava"
  - phase: 10-mapa-operacional plan 02
    provides: "mapa/mapa-geometria.js — calcAreaM2, calcCompatCliente, maquinasParaZona, normalizarFlora/Inclinacao/Limpeza, consumidos aqui sem reimplementação"
  - phase: 10-mapa-operacional plan 05
    provides: "mapa/mapa-dados.js — a porta única de leitura do Supabase em mapa/, onde este plano acrescenta as duas primeiras escritas do módulo"
provides:
  - "mapa/mapa-editor.js — modo de edição de zona dentro do /mapa: botão de alternância, ferramenta de desenho restrita a polígono (leaflet-draw), painel de atributos (nome, tipo, flora, inclinação, limpeza), recálculo de compatibilidade a cada escolha, edição de vértice de zona existente, escopado a admin/gestor"
  - "mapa/mapa-dados.js ganha salvarZona/atualizarZona — as primeiras escritas do módulo, só em maq_areas (D-03), com validação client-side pela lista fechada do núcleo puro e área recalculada na mesma chamada da geometria"
  - "mapa/index.html carrega leaflet-draw@1.0.4 (versão exata fixada) e o contêiner #editor-painel, com estilos só de tokens da folha comum"
  - "tests/mapa-editor.test.js — gate estrutural comparando a lista de cargos do editor com a política real de escrita de maq_areas (migração 12)"
affects: [10-07, 10-08]

tech-stack:
  added:
    - "leaflet-draw@1.0.4 (CDN unpkg, versão exata fixada) — auditada como legítima em 10-RESEARCH.md, sucessor mantido (@geoman-io/leaflet-geoman-free) nomeado em comentário como caminho de saída"
  patterns:
    - "Editor como modo dentro do próprio /mapa (botão + painel lateral), não um segundo deploy — desenha sobre xMap.getLeafletMap(), nunca cria L.map() próprio"
    - "Validação client-side pela mesma lista fechada do núcleo puro antes de qualquer escrita — barreira antecipada; o check da migração 25 continua sendo a barreira real"
    - "Camada clicável própria do editor (FeatureGroup separado) para selecionar zona existente, sem tocar xmap-layers-grama.js (fora dos arquivos deste plano)"

key-files:
  created:
    - mapa/mapa-editor.js
    - tests/mapa-editor.test.js
  modified:
    - mapa/index.html
    - mapa/mapa-dados.js
    - mapa/app.js

key-decisions:
  - "CARGOS_ZONA = ['admin', 'gestor'] espelha exatamente a política de inserção/atualização de maq_areas (migração 12) — a divergência com a política que o plano 10-07 vai espelhar (tabelas de ativo) é esperada e documentada nos dois planos"
  - "Botão de alternância implementado como L.control do Leaflet reusando as classes .btn/.btn-s da folha comum, em vez de marcação/estilo próprios — nenhuma família de botão nova"
  - "Edição de zona existente usa uma camada FeatureGroup própria do editor (contorno tracejado, clicável), não a camada de exibição de xmap-layers-grama.js — esse arquivo não está nos files_modified deste plano; a camada do editor fica visível só enquanto o modo de edição está ligado"
  - "area_m2 nunca é aceita pronta da tela — salvarZona/atualizarZona recalculam via calcAreaM2 a partir da mesma lista de vértices, na mesma chamada que grava geom (T-10-30)"
  - "validarAtributosZona (mapa-dados.js) recusa flora/inclinação/limpeza fora da lista fechada antes de gastar uma viagem de rede — a barreira real continua sendo o check da migração 25; isto é só a recusa antecipada (T-10-29)"

patterns-established:
  - "Núcleo puro consumido, nunca duplicado: 6371000 (raio da Terra) continua aparecendo em um único arquivo de todo o projeto depois deste plano"

requirements-completed: [PLAT-18, PLAT-16]

coverage:
  - id: D1
    description: "O editor de zona aparece como modo dentro do /mapa só para admin e gestor — a lista de cargos é comparada por teste com a política de escrita real de maq_areas (migração 12), não apenas lida (T-10-28)"
    requirement: "PLAT-18"
    verification:
      - kind: unit
        ref: "tests/mapa-editor.test.js#a lista de cargos do editor de zona é exatamente a da política de escrita real de maq_areas (migração 12)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Desenho restrito a polígono sobre a instância de mapa existente (sem segunda instância de Leaflet); área e compatibilidade de máquina vêm do núcleo puro do plano 10-02, não recalculadas no editor"
    requirement: "PLAT-18"
    verification:
      - kind: unit
        ref: "tests/mapa-editor.test.js#o editor obtém a instância de mapa existente e não cria uma segunda instância de Leaflet"
        status: pass
      - kind: unit
        ref: "tests/mapa-editor.test.js#o editor importa o núcleo puro de mapa-geometria.js e não reimplementa o cálculo de área"
        status: pass
      - kind: unit
        ref: "tests/mapa-editor.test.js#o editor restringe a ferramenta de desenho a polígono — as demais formas do leaflet-draw ficam desligadas"
        status: pass
    human_judgment: false
  - id: D3
    description: "As máquinas fora da regra de compatibilidade aparecem contadas e nomeadas no painel (maquinasParaZona), em vez de a lista de compatíveis parecer vazia/quebrada sem explicação"
    requirement: "PLAT-18"
    verification:
      - kind: other
        ref: "mapa/mapa-editor.js#compatHTML — leitura de código: usa maquinasParaZona e sempre inclui a linha de semMapeamento quando não vazia, mesmo padrão de mapa/xmap-layers-grama.js (plano 10-05)"
        status: pass
    human_judgment: true
    rationale: "O comportamento visual (a linha aparecendo de fato no painel renderizado) só é observável no navegador, com sessão autenticada e máquinas reais carregadas — não disponível neste ambiente autônomo."
  - id: D4
    description: "As escritas de zona (salvarZona/atualizarZona) ficam confinadas a mapa-dados.js, só em maq_areas (D-03), com validação pela lista fechada e área recalculada na mesma chamada da geometria; a camada de rede do editor legado (endereço de serviço local, requisição própria) não foi portada"
    requirement: "PLAT-18"
    verification:
      - kind: unit
        ref: "tests/mapa-editor.test.js#as escritas em maq_areas moram em mapa-dados.js — mapa-editor.js chama salvarZona/atualizarZona, nunca .insert/.update diretamente"
        status: pass
      - kind: unit
        ref: "tests/mapa-editor.test.js#mapa-dados.js só fala com as tabelas previstas (maq_areas, maq_ativos, elet_ativos, cmasm_locais)"
        status: pass
      - kind: unit
        ref: "tests/mapa-editor.test.js#a camada de rede do editor legado (endereço de serviço local, chamada de requisição) não foi portada para o código de mapa-editor.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "leaflet-draw@1.0.4 entra em versão exata fixada, com origem cruzada, comentário de legitimidade/sucessor; o painel usa só tokens da folha comum, sem cor escrita à mão; mapa/xmap.js e mapa/xmap.css intocados"
    requirement: "PLAT-18"
    verification:
      - kind: unit
        ref: "tests/mapa-editor.test.js#mapa/index.html continua sem declarar token de cor além de --accent, mesmo depois do painel do editor entrar na marcação (D-01 da Fase 6, reafirmado)"
        status: pass
      - kind: other
        ref: "gate estático da Task 1 — leaflet-draw@1.0.4 sem faixa de versão, duas etiquetas com crossorigin, git diff --name-only -- mapa/xmap.css vazio"
        status: pass
    human_judgment: false
  - id: D6
    description: "node --test sobe de 119 para 127 (fail 0), nenhum teste do baseline removido; refrigeracao/ e mapa/xmap.js/xmap.css intocados desde o commit de referência da fase"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "node --test (119 → 127, fail 0)"
        status: pass
      - kind: other
        ref: "git diff --name-only -- mapa/xmap.js mapa/xmap.css (0 arquivos); git diff --name-only 511bb9e..HEAD -- refrigeracao/ (0 arquivos)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Fim a fim: usuário com cargo de escrita desenha uma zona real, vê área/compatíveis calculados, salva, e a zona persiste e reabre igual em maq_areas"
    verification: []
    human_judgment: true
    rationale: "A migração 25 ainda não foi aplicada no banco de produção (pendência herdada do plano 10-01) e este ambiente não tem credenciais do Supabase nem navegador controlável. Todo gate deste plano é estrutural (leitura de código/config); a prova de ponta a ponta fica para o roteiro manual do plano 10-08, registrada lá como pendência nomeada."

duration: ~40min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 06: Editor de zona operacional (PLAT-18) Summary

**`mapa/mapa-editor.js` criado como modo de edição dentro do próprio `/mapa` — porta o editor legado (`DEV_ERP/cmms-mapa/admin.html`) com `leaflet-draw@1.0.4`, monta o painel de atributos de terreno recalculando compatibilidade de máquina pelo núcleo puro a cada escolha, e grava em `maq_areas` via `mapa/mapa-dados.js` (`salvarZona`/`atualizarZona`), escopado a `admin`/`gestor` por comparação direta com a política real de escrita do banco.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-12
- **Tasks:** 3/3 completed
- **Files modified:** 5 (2 novos, 3 editados)

## Accomplishments

- `mapa/index.html` carrega `leaflet-draw@1.0.4` em versão exata fixada, mesmo estilo de etiqueta (folha antes de script, `crossorigin`) das etiquetas do Leaflet já presentes, com comentário registrando a legitimidade auditada na pesquisa da Fase 10 e o sucessor mantido (`@geoman-io/leaflet-geoman-free`) como caminho de saída. `#editor-painel` (contêiner oculto do painel do editor) entra na marcação, com estilos apoiados só em tokens da folha comum — nenhuma cor escrita à mão, `mapa/xmap.css` intocado (D-01 da Fase 6).
- `mapa/mapa-editor.js` criado: exporta `iniciarEditorZonas(mapa, usuario)`, que sai sem efeito quando o cargo não está em `CARGOS_ZONA` (`admin`, `gestor` — espelha exatamente `supabase/12_maquinas_areas_operacoes.sql:51-59`). Monta um botão de alternância (reusando `.btn`/`.btn-s` da folha comum, sem família de botão nova) que liga/desliga a ferramenta de desenho restrita a polígono sobre `xMap.getLeafletMap()` (nenhuma segunda instância de Leaflet). Ao concluir um polígono, abre o painel com nome/tipo/flora/inclinação/limpeza; a cada atributo escolhido, recalcula a caixa de compatíveis via `maquinasParaZona` (núcleo puro) e mostra as máquinas fora da classificação em vez de escondê-las. Zonas existentes ficam clicáveis (camada própria do editor) para reabrir o painel em modo de edição, com opção de habilitar arraste de vértice.
- `mapa/mapa-dados.js` ganha `salvarZona`/`atualizarZona` — as primeiras duas escritas do módulo `mapa/`. As duas validam os três atributos de terreno pela lista fechada do núcleo puro antes de qualquer viagem de rede, recalculam `area_m2` via `calcAreaM2` na mesma chamada que grava `geom` (nunca aceitam área pronta da tela), gravam só em `maq_areas` (D-03), e seguem o idioma de erro do projeto — não o padrão de requisição a serviço local + aviso flutuante do editor legado, que não foi portado.
- `mapa/app.js` chama `iniciarEditorZonas(xMap.getLeafletMap(), USUARIO)` depois de o mapa existir e as camadas de grama/elétrica estarem registradas.
- `tests/mapa-editor.test.js` criado com 8 casos: comparação direta da lista de cargos do editor com a política de escrita real de `maq_areas` (o caso mais valioso — impede tela e banco de divergirem em qualquer direção), reuso da instância de mapa existente, reuso do núcleo puro sem reimplementação, restrição do desenho a polígono, ausência da camada de rede do legado, confinamento das escritas a `mapa-dados.js`, tabelas graváveis limitadas às previstas, e ausência de cor escrita à mão na marcação do painel.
- `node --test`: **119 → 127** (8 casos novos), 0 falhas, nenhum teste do baseline removido (PLAT-16). `mapa/xmap.js`, `mapa/xmap.css` e `refrigeracao/` confirmados intocados desde `511bb9e`.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Carregar leaflet-draw e preparar o painel do editor** — `65ac9b1` (feat)
2. **Task 2: Criar mapa/mapa-editor.js e as escritas em mapa/mapa-dados.js** — `a48fd7b` (feat)
3. **Task 3: Criar tests/mapa-editor.test.js** — `07274bd` (test)

**Plan metadata:** (a seguir, neste commit)

## Files Created/Modified

- `mapa/index.html` — biblioteca de desenho em versão exata, contêiner oculto do painel do editor, estilos só de tokens da folha comum
- `mapa/mapa-editor.js` — modo de edição de zona: botão de alternância, ferramenta de desenho, painel de atributos, seleção de zona existente
- `mapa/mapa-dados.js` — `salvarZona`/`atualizarZona`, as primeiras escritas do módulo, confinadas a `maq_areas`
- `mapa/app.js` — chama `iniciarEditorZonas` depois de mapa e camadas prontos
- `tests/mapa-editor.test.js` — gate de cargo, reuso de núcleo puro e não-porte da camada de rede do legado

## Decisions Made

- `CARGOS_ZONA = ['admin', 'gestor']` espelha exatamente a política de escrita real de `maq_areas` (migração 12) — a divergência esperada com a lista de cargos que o plano 10-07 vai usar (tabelas de ativo, política diferente) é intencional e documentada nos dois planos.
- Botão de alternância implementado como `L.control` do Leaflet, reusando `.btn`/`.btn-s` da folha comum — nenhuma marcação/estilo de botão próprio precisou entrar em `mapa/index.html`.
- Seleção de zona existente usa uma camada `FeatureGroup` própria do editor (contorno tracejado, clicável, visível só com o modo de edição ligado), em vez de estender a camada de exibição de `mapa/xmap-layers-grama.js` — esse arquivo não está nos `files_modified` deste plano; tocá-lo teria ampliado o escopo além do que a Task 2 declarou.
- `area_m2` nunca é aceita pronta da tela: `salvarZona`/`atualizarZona` recalculam via `calcAreaM2` a partir da mesma lista de vértices, na mesma chamada que grava `geom`, para os dois valores nunca ficarem fora de sincronia (T-10-30).
- `validarAtributosZona` (interna a `mapa-dados.js`) recusa flora/inclinação/limpeza fora da lista fechada do núcleo puro antes de qualquer viagem de rede — resposta antecipada a T-10-29; o `check` da migração 25 continua sendo a barreira real.
- `.map-area{position:relative}` acrescentado em `mapa/index.html` (Rule 2 — funcionalidade crítica ausente): sem isso, o painel `position:absolute` do editor ancoraria contra o ancestral posicionado mais próximo (provavelmente `body`), em vez de encostar na borda da área do mapa como o plano pede. Não altera nenhuma cor, não afeta o gate de cor escrita à mão.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `position:relative` em `.map-area` para ancorar o painel do editor**

- **Found during:** Task 1, ao acrescentar `#editor-painel` com `position:absolute`
- **Issue:** O plano descreve o painel como "encostado na borda" da área de mapa, mas `.map-area` não tinha `position` declarada — um filho `position:absolute` ancoraria contra o ancestral posicionado mais próximo (tipicamente `body` ou nenhum, dependendo da árvore), não contra a área do mapa, quebrando o encostamento pedido.
- **Fix:** Acrescentada `position:relative` à regra `.map-area` já existente.
- **Files modified:** `mapa/index.html`
- **Verification:** Gate de cor escrita à mão da Task 1 continua verde (mudança não introduz cor); `node --test` continua 119/119 depois da Task 1.
- **Committed in:** `65ac9b1` (Task 1)

### Gate mal especificado corrigido (não é auto-fix de código)

**2. [Gate mis-specification] `mod-badge-demo">` do `<verify>` da Task 1 não casa com o `title` do selo da aguada**

- **Found during:** Task 1, verificação automatizada
- **Issue:** O `<verify><automated>` da Task 1 confere o selo com `grep -c "mod-badge-demo\">"` — string literal que exige a classe seguida imediatamente de `">`. O `title` explicativo que o selo da aguada já ganhou no plano 10-05 (`class="mod-badge-demo" title="...">`) insere um atributo entre o fechamento de `class` e o `>`, quebrando o casamento literal — o mesmo problema que `10-05-SUMMARY.md` já documentou como Deviation 2 daquele plano, agora reaparecendo porque a Task 1 deste plano copiou o mesmo trecho de verificação.
- **Fix:** Verifiquei a propriedade real do `acceptance_criteria` ("as três entradas de módulo... continuam presentes e o selo de demonstração continua só na aguada") com `grep -c 'class="mod-badge-demo"'` em vez do padrão literal com `">` colado — 1 ocorrência confirmada, igual ao valor esperado. Não alterei o `title` do selo (que pertence ao plano 10-05, fora do escopo deste plano) só para casar com a string exata do script de verificação copiado.
- **Files modified:** nenhum arquivo de produção alterado por esta correção — apenas a forma de executar a verificação.
- **Verification:** `node --test` roda 119/119 (0 falhas) depois da Task 1; `grep -c 'class="mod-badge-demo"' mapa/index.html` confirma 1.
- **Committed in:** não aplicável — nenhuma mudança de arquivo, só a execução do gate ajustada.

---

**Total deviations:** 1 auto-fixado (Regra 2 — funcionalidade crítica ausente), 1 gate mis-specification (não código)
**Impact on plan:** O `position:relative` é necessário para o painel se ancorar onde o plano descreve (borda da área de mapa); sem ele o layout do painel ficaria incorreto assim que renderizado no navegador, mesmo com todo o resto correto. O gate mal especificado do selo não afeta nenhuma propriedade real do plano — a asserção correta (uma ocorrência da classe) está satisfeita, e é o mesmo problema de copy-paste já registrado no plano 10-05.

## Issues Encountered

None além das duas deviations acima, já registradas.

## User Setup Required

Nenhum passo novo além do herdado dos planos 10-01/10-05 (migração 25 ainda pendente de aplicação em produção pelo usuário — ver `10-01-SUMMARY.md` § "User Setup Required"). Este plano acrescenta as duas primeiras escritas do módulo `mapa/`, mas nenhuma delas pôde ser exercitada contra o Supabase real neste ambiente autônomo (sem credenciais, sem navegador, sem sessão autenticada).

## Next Phase Readiness

- `mapa/mapa-dados.js` está pronto para o plano 10-07 (posicionamento de ativo) acrescentar as próprias escritas ao lado de `salvarZona`/`atualizarZona`, seguindo o mesmo idioma de validação/erro — nenhuma escrita nova deveria nascer fora deste arquivo; o gate de porta única (`tests/mapa-camadas.test.js`, caso 7) continua cobrindo isso.
- O plano 10-07 vai precisar da própria lista de cargos, espelhando a política de escrita das tabelas de ativo (diferente de `maq_areas`) — a divergência entre as duas listas de cargo já está documentada aqui e no `10-06-PLAN.md`, para não ser lida como inconsistência acidental.
- **Verificação de ponta a ponta pendente para o roteiro de UAT do plano 10-08:** este plano prova a estrutura por gate automatizado e por leitura de código (cargo comparado com a política real, núcleo puro reusado, sem segunda instância de mapa, sem camada de rede do legado, escritas confinadas). O comportamento fim a fim — desenhar um polígono real, ver a área e as máquinas compatíveis aparecerem, salvar e reabrir a mesma zona — só é observável no navegador, com sessão autenticada e a migração 25 aplicada. Nenhum dos três estava disponível neste ambiente autônomo.
- Bloqueio herdado dos planos 10-01/10-02/10-05: a migração 25 continua pendente de aplicação no banco de produção real pelo usuário. Até lá, `salvarZona`/`atualizarZona` estão prontas e corretas estruturalmente, mas nenhuma gravação real em `maq_areas.geom`/`flora`/`inclinacao`/`limpeza` pode ser considerada testada ponta a ponta.

---
*Phase: 10-mapa-operacional*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: mapa/mapa-editor.js
- FOUND: tests/mapa-editor.test.js
- FOUND: mapa/index.html
- FOUND: mapa/mapa-dados.js
- FOUND: mapa/app.js
- FOUND: .planning/phases/10-mapa-operacional/10-06-SUMMARY.md
- FOUND commit: 65ac9b1 (feat 10-06 leaflet-draw + painel)
- FOUND commit: a48fd7b (feat 10-06 editor de zonas)
- FOUND commit: 07274bd (test 10-06 gate mapa-editor)
