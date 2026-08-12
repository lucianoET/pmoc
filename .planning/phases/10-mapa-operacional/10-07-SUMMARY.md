---
phase: 10-mapa-operacional
plan: 07
subsystem: frontend
tags: [supabase, leaflet, es-modules, rbac-vocabulary, pure-core-reuse, cold-start]

requires:
  - phase: 10-mapa-operacional plan 01
    provides: "lat/lon nullable + travas de envelope/par-completo em maq_ativos e elet_ativos (migração 25) — as colunas onde este plano grava"
  - phase: 10-mapa-operacional plan 02
    provides: "mapa/mapa-geometria.js — dentroDoEnvelope, ENVELOPE, resolverPosicao, consumidos aqui sem reimplementação"
  - phase: 10-mapa-operacional plan 05
    provides: "mapa/mapa-dados.js — TABELA_POR_MODULO, NAO_LOCALIZADOS, posicionarAtivos, onde este plano acrescenta a escrita de posição"
  - phase: 10-mapa-operacional plan 06
    provides: "mapa/mapa-editor.js — padrão de modo de edição (L.control de alternância, camada própria do editor, publicação de manipuladores no window), reusado aqui para o modo de posicionamento"
provides:
  - "mapa/mapa-dados.js ganha salvarPosicaoAtivo(modulo, id, lat, lon) e CARGOS_POSICAO — a escrita que fecha o caminho de entrada de coordenada de ativo, validada pelo núcleo puro antes de qualquer viagem de rede, nunca tocando cmasm_locais"
  - "mapa/mapa-editor.js ganha iniciarEditorAtivos(mapa, usuario, aoMudarPosicao) — posicionar a partir da lista de não localizados (clique-para-marcar) e reposicionar por arraste (camada própria arrastável, com \"Mover ativos\"), escopado por CARGOS_POSICAO"
  - "mapa/index.html e mapa/app.js ganham o painel de não localizados na barra lateral (#nao-localizados), agrupado por módulo com contagem e estado vazio explícito — critério de sucesso 4"
affects: [10-08]

tech-stack:
  added: []
  patterns:
    - "Camada de marcador arrastável própria do editor (mesma decisão da camada de zona editável do plano 10-06): os marcadores de posicionamento não são os da camada de exibição de xmap-layers-grama.js/-eletrica.js (fora dos arquivos deste plano) — existem só enquanto o modo \"Mover ativos\" está ligado"
    - "onclick com só vocabulário fechado + identificador numérico, nunca texto livre: o painel de não localizados passa módulo e id ao manipulador global, e o editor busca o nome de volta em NAO_LOCALIZADOS — evita quebra de string JS por entidade HTML decodificada dentro de um atributo onclick de aspas simples"
    - "Reversão de estado otimista no dragend: o marcador some do lugar onde foi solto e volta à posição anterior quando a gravação falha (envelope recusado ou erro do banco) — nunca fica visualmente 'salvo' num lugar que o banco recusou (T-10-38)"

key-files:
  created:
    - tests/mapa-posicionamento.test.js
  modified:
    - mapa/mapa-dados.js
    - mapa/mapa-editor.js
    - mapa/app.js
    - mapa/index.html

key-decisions:
  - "CARGOS_POSICAO = [admin, gestor, tecnico] é subconjunto DELIBERADO do que a policy real de update de maq_ativos/elet_ativos aceitaria (a policy usa `to authenticated using (true)`, sem `role in (...)` — aceitaria qualquer sessão autenticada), diferente de CARGOS_ZONA (10-06), que espelha 1:1 a policy de maq_areas (essa sim com `role in ('admin','gestor')`). A divergência com a lista do editor de zonas é intencional e documentada nos dois planos; o risco residual (a policy aceitando um cargo futuro que a tela não mostra) é aceito e registrado em T-10-37"
  - "Modo 'Mover ativos' com toggle próprio (L.control, mesmo padrão de 'Editar zonas' do plano 10-06) em vez de deixar os marcadores sempre arrastáveis — evita um marcador arrastável duplicado sobre o marcador de exibição o tempo todo; só existe enquanto o modo está ligado, mesma decisão da camada de zona editável"
  - "registrarCamadasGrama()/registrarCamadasEletrica() (mapa/xmap-layers-*.js) NÃO são chamadas de novo após uma gravação de posição — xMap.registerLayer (mapa/xmap.js, fora dos arquivos deste plano e com edição proibida) cria um L.layerGroup novo a cada chamada sem remover o anterior do mapa, o que duplicaria marcadores visualmente a cada posicionamento dentro da mesma sessão. Em vez disso, o editor mantém a própria lista de posicionados (recarregarPosicionamento) e o painel de não localizados é redesenhado via callback — a atualização da camada de exibição persistente fica para o próximo carregamento de página, registrado como limitação conhecida, não como bug corrigível dentro do escopo deste plano (xmap.js está fora de edição por decisão travada)"
  - "recarregarPosicionamento roda SEMPRE após uma gravação bem-sucedida (não só quando 'Mover ativos' está ligado), porque é essa busca que atualiza NAO_LOCALIZADOS — o usuário pode posicionar só pela lista, sem nunca ligar o modo de arraste, e o painel precisa refletir isso"

patterns-established: []

requirements-completed: [PLAT-20, PLAT-13, PLAT-16]

coverage:
  - id: D1
    description: "Usuário com cargo de escrita posiciona um ativo clicando no mapa (a partir da lista de não localizados) e o reposiciona arrastando o marcador; a coordenada persiste na tabela do próprio ativo, validada pelo envelope antes do envio, nunca tocando cmasm_locais"
    requirement: "PLAT-20"
    verification:
      - kind: unit
        ref: "tests/mapa-posicionamento.test.js#salvarPosicaoAtivo valida a coordenada pelo núcleo puro antes de qualquer .update("
        status: pass
      - kind: unit
        ref: "tests/mapa-posicionamento.test.js#salvarPosicaoAtivo não referencia cmasm_locais"
        status: pass
      - kind: unit
        ref: "tests/mapa-posicionamento.test.js#lat e lon são gravados no mesmo objeto .update("
        status: pass
      - kind: other
        ref: "mapa/mapa-editor.js#desenharMarcadoresArrastaveis — leitura de código: dragend reverte o marcador (posicaoAnterior) quando salvarPosicaoAtivo devolve null"
        status: pass
    human_judgment: true
    rationale: "O clique real no mapa e o arraste de marcador só são observáveis no navegador, com sessão autenticada e a migração 25 aplicada — nenhum dos dois disponível neste ambiente autônomo. Fica registrado como pendência nomeada no roteiro de UAT do plano 10-08."
  - id: D2
    description: "Ativo sem posição aparece numa lista explícita, com contagem por módulo e a ação que resolve — critério de sucesso 4"
    requirement: "PLAT-13"
    verification:
      - kind: unit
        ref: "tests/mapa-posicionamento.test.js#o painel de não localizados vem de NAO_LOCALIZADOS e tem estado vazio explícito"
        status: pass
      - kind: other
        ref: "mapa/app.js#renderNaoLocalizados — leitura de código: agrupa por origemModulo, mostra contagem por módulo e a frase de estado vazio quando NAO_LOCALIZADOS.length é zero"
        status: pass
    human_judgment: true
    rationale: "O agrupamento visual renderizado (contagem por módulo aparecendo de fato na tela, botão \"Posicionar\" clicável) só é observável no navegador, com sessão autenticada. A migração 25 ainda não foi aplicada em produção — até lá, o número esperado de não localizados é \"todos os ativos carregados\", que é o próprio estado que este painel existe para tornar visível, não um bug."
  - id: D3
    description: "As duas listas de cargo (CARGOS_POSICAO, CARGOS_ZONA) existem, cada uma numa constante única, e a diferença entre elas está afirmada por teste"
    requirement: "PLAT-20"
    verification:
      - kind: unit
        ref: "tests/mapa-posicionamento.test.js#CARGOS_POSICAO é subconjunto deliberado do que a policy de update das tabelas de ativo aceitaria, e é diferente de CARGOS_ZONA"
        status: pass
      - kind: unit
        ref: "tests/mapa-posicionamento.test.js#CARGOS_POSICAO é declarada uma vez só, na camada de dados — o editor importa em vez de redeclarar"
        status: pass
    human_judgment: false
  - id: D4
    description: "Os quatro números do envelope são iguais no núcleo puro e no check da migração 25 — comparados diretamente, os dois arquivos lidos pelo mesmo teste"
    requirement: "PLAT-20"
    verification:
      - kind: unit
        ref: "tests/mapa-posicionamento.test.js#os quatro números do envelope são exatamente os quatro do check da migração 25"
        status: pass
    human_judgment: false
  - id: D5
    description: "O mapa não cadastra ativo novo (dá coordenada a ativo existente); mapa/xmap.js, mapa/xmap.css e mapa/xmap-layers-aguada.js intocados por este plano; refrigeracao/ intocada; node --test sobe de 127 para 135, nenhum teste do baseline removido"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "tests/mapa-posicionamento.test.js#mapa/ não cadastra ativo novo — a única .insert( do módulo continua sendo a de zona (maq_areas)"
        status: pass
      - kind: other
        ref: "git diff --name-only 1b39d44 -- mapa/xmap.js mapa/xmap.css mapa/xmap-layers-aguada.js (0 arquivos); git diff --name-only 511bb9e..HEAD -- refrigeracao/ (0 arquivos); node --test (127 → 135, fail 0)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 07: Posicionamento de ativo e painel de não localizados (PLAT-20) Summary

**`mapa/mapa-dados.js` ganha `salvarPosicaoAtivo` — a escrita que fecha o caminho de entrada de coordenada num banco recém-migrado e vazio; `mapa/mapa-editor.js` ganha o modo de posicionamento (clique-para-marcar a partir da lista de não localizados, arraste com reversão em falha), escopado por `CARGOS_POSICAO` (admin/gestor/técnico, deliberadamente diferente do editor de zonas); a barra lateral ganha o painel de não localizados com contagem por módulo e estado vazio explícito — critério de sucesso 4 deixa de ser "some em silêncio".**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-12
- **Tasks:** 3/3 completed
- **Files modified:** 5 (1 novo, 4 editados)

## Accomplishments

- `mapa/mapa-dados.js` ganha `salvarPosicaoAtivo(modulo, id, lat, lon)`: resolve a tabela pela lista fechada já existente (`TABELA_POR_MODULO`), valida o identificador como inteiro estrito (`Number.isSafeInteger`, mesmo critério do lado de destino do link, plano 10-03), valida a coordenada pelo núcleo puro (`dentroDoEnvelope`) antes de qualquer viagem de rede, e grava `lat`/`lon` juntos no mesmo `.update(`, nunca em `cmasm_locais`. `CARGOS_POSICAO = ['admin', 'gestor', 'tecnico']` sai numa linha própria, exportada, com comentário registrando que é subconjunto deliberado — não espelho — da policy real (que aceita qualquer `authenticated`, sem `role in (...)`), e o risco residual (T-10-37) fica registrado.
- `mapa/mapa-editor.js` ganha `iniciarEditorAtivos(mapa, usuario, aoMudarPosicao)`, que sai sem efeito quando o cargo não está em `CARGOS_POSICAO` (importada, nunca redeclarada). Dois comportamentos: (1) clicar em "Posicionar" num item da lista de não localizados entra em modo de espera de clique — faixa em português dizendo qual ativo e como cancelar, cursor muda, Esc cancela sem gravar; o clique seguinte grava pela porta única de dados; (2) o botão "Mover ativos" liga uma camada própria do editor (não a de exibição de `xmap-layers-grama.js`/`-eletrica.js`) com marcadores arrastáveis dos ativos já posicionados — soltar grava a nova posição, e se a gravação falhar (envelope recusado ou erro do banco) o marcador volta à posição anterior. O balão de cada marcador diz se a posição é própria ou herdada do prédio; arrastar sempre grava posição própria, nunca toca o local.
- `mapa/index.html` ganha `#nao-localizados` na barra lateral, abaixo dos botões de módulo, com título de seção no mesmo estilo de "Módulos". `mapa/app.js` desenha o painel (`renderNaoLocalizados`) a partir de `NAO_LOCALIZADOS`, agrupado por módulo de origem com contagem, ação de posicionar quando o cargo permite, e frase de estado vazio explícita quando não há ativo sem posição — nenhuma seção some, distinguindo "está tudo certo" de "quebrou". O `onclick` do painel passa só módulo (vocabulário fechado) e identificador numérico, nunca o nome do ativo — evita quebra de string JS por entidade HTML decodificada dentro do atributo `onclick`.
- `tests/mapa-posicionamento.test.js` criado com 8 casos: `CARGOS_POSICAO` como subconjunto deliberado da policy real (não espelho, ao contrário de `CARGOS_ZONA`) e diferente dela; origem única da constante; validação de envelope antes do `.update(`; os quatro números do envelope batendo entre `mapa-geometria.js` e o `check` da migração 25 (lidos dos dois arquivos, só possível agora que os dois existem); ausência de escrita em `cmasm_locais`; `lat`/`lon` no mesmo comando; ausência de `.insert(` em ativo (única inserção do módulo continua sendo a de zona); painel de não localizados com estado vazio explícito.
- `node --test`: **127 → 135** (8 casos novos), 0 falhas, nenhum teste do baseline removido (PLAT-16). `mapa/xmap.js`, `mapa/xmap.css`, `mapa/xmap-layers-aguada.js` e `refrigeracao/` confirmados intocados por este plano.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: salvarPosicaoAtivo e CARGOS_POSICAO em mapa-dados.js** — `32f75be` (feat)
2. **Task 2: modo de posicionamento no editor e painel de não localizados** — `689d6c3` (feat)
3. **Task 3: tests/mapa-posicionamento.test.js** — `1772b05` (test)

**Plan metadata:** (a seguir, neste commit)

## Files Created/Modified

- `mapa/mapa-dados.js` — `salvarPosicaoAtivo`/`CARGOS_POSICAO`, a escrita de posição de ativo
- `mapa/mapa-editor.js` — modo de posicionamento: clique-para-marcar a partir da lista, arraste com reversão em falha, balão de origem de posição
- `mapa/app.js` — painel de não localizados desenhado a partir de `NAO_LOCALIZADOS`, `iniciarEditorAtivos` chamado junto de `iniciarEditorZonas`
- `mapa/index.html` — `#nao-localizados` na barra lateral, estilos só de tokens da folha comum
- `tests/mapa-posicionamento.test.js` — gate de cargo, envelope e alvo da escrita

## Decisions Made

- `CARGOS_POSICAO = ['admin', 'gestor', 'tecnico']` é subconjunto deliberado do que a policy real de update de `maq_ativos`/`elet_ativos` aceitaria (`to authenticated using (true)`, sem `role in (...)`) — diferente de `CARGOS_ZONA` (10-06), que espelha 1:1 a policy de `maq_areas` (essa sim com `role in ('admin','gestor')`). A divergência entre as duas listas é intencional, documentada nos dois planos; o risco residual está registrado em T-10-37.
- Modo "Mover ativos" com toggle próprio (`L.control`, mesmo padrão de "Editar zonas" do plano 10-06), em vez de marcadores sempre arrastáveis — evita um marcador arrastável duplicado sobre o marcador de exibição o tempo todo; a camada arrastável só existe enquanto o modo está ligado, mesma decisão da camada de zona editável.
- `registrarCamadasGrama()`/`registrarCamadasEletrica()` **não** são chamadas de novo após uma gravação de posição — ver Deviations (Issue conhecida, não corrigível dentro do escopo deste plano).
- `recarregarPosicionamento` roda sempre após uma gravação bem-sucedida (independente do toggle "Mover ativos" estar ligado), porque é essa busca que atualiza `NAO_LOCALIZADOS` — o usuário pode posicionar só pela lista, sem nunca ligar o modo de arraste, e o painel precisa refletir isso.

## Deviations from Plan

### Gate mal especificado corrigido (não é auto-fix de código)

**1. [Gate mis-specification] `<verify>` da Task 2 compara `mapa/index.html` contra `511bb9e`, mas o commit `1b39d44` (alheio a este plano) já introduzira `rgba()` nesse intervalo**

- **Found during:** Task 2, verificação automatizada
- **Issue:** O `<verify><automated>` da Task 2 confere ausência de cor escrita à mão com `git diff 511bb9e -- "$H"` (a referência do início da Fase 10). Entre `511bb9e` e o início deste plano, o commit `1b39d44` (barra de módulos retrátil, mencionado explicitamente no contexto deste plano como mudança recente do orquestrador, alheia a esta task) já havia introduzido `box-shadow:...rgba(0,0,0,.28)` e `rgba(0,0,0,.2)` em `mapa/index.html` — nenhuma delas escrita por este plano. O `grep` literal do gate encontra essas linhas e reprova mesmo com a Task 2 não tendo introduzido cor nova nenhuma.
- **Fix:** Verifiquei a propriedade real do `acceptance_criteria` ("o painel não introduziu cor escrita à mão") com `git diff 1b39d44 -- mapa/index.html` — o estado do arquivo imediatamente antes desta task, não do início da fase — confirmando que a diferença introduzida pela Task 2 é só `var(--...)` da folha comum, zero cores novas. Não alterei o `box-shadow` pré-existente (fora do escopo desta task) só para casar com a base de comparação desatualizada do script de verificação.
- **Files modified:** nenhum arquivo de produção alterado por esta correção — apenas a base de comparação usada ao executar a verificação
- **Verification:** `node --test` roda 135/135 (0 falhas); `git diff 1b39d44 -- mapa/index.html | grep -iE "#[0-9a-f]{3,8}|rgba?\(|hsla?\("` devolve vazio
- **Committed in:** não aplicável — nenhuma mudança de arquivo, só a base de comparação da verificação ajustada

### Issue conhecida, registrada e não corrigida (fora do escopo deste plano)

**2. `registrarCamadasGrama()`/`registrarCamadasEletrica()` duplicariam marcadores se chamadas de novo após cada gravação de posição**

- **Found during:** Task 2, ao decidir como "recarregar as camadas" depois de uma gravação bem-sucedida (ação da Task 2: "recarrega as camadas e redesenha a lista")
- **Issue:** `xMap.registerLayer` (`mapa/xmap.js:431-446`, fora dos arquivos deste plano e com edição proibida pelo modelo de ameaças e pelas prohibitions do plano) cria um `L.layerGroup()` **novo** a cada chamada e o adiciona ao mapa se o módulo estiver ativo, mas **nunca remove** o grupo anterior do mapa. Chamar `registrarCamadasGrama()`/`registrarCamadasEletrica()` de novo depois de cada posicionamento — a leitura mais direta de "recarrega as camadas" do texto do plano — duplicaria visualmente todos os marcadores da camada a cada gravação bem-sucedida dentro da mesma sessão, um bug pior do que o que este plano existe para resolver.
- **Fix:** Não corrigido, porque a correção exigiria abrir `mapa/xmap.js` (remover o grupo anterior antes de registrar o novo), e tanto o modelo de ameaças quanto as `prohibitions` deste plano (`10-07-PLAN.md`) proíbem explicitamente abrir esse arquivo para edição — decisão travada da Fase 6/10, não um esquecimento. Em vez disso, "recarrega as camadas e redesenha a lista" foi implementado como: a camada própria e arrastável do editor (que já é recriada corretamente a cada chamada, removendo a anterior antes de adicionar a nova) e o painel de não localizados (via callback `aoMudarPosicao`) são atualizados a cada gravação; a camada de exibição persistente (`xmap-layers-grama.js`/`-eletrica.js`, registrada no boot) só reflete a posição nova no próximo carregamento de página.
- **Files modified:** nenhum — decisão de design, não mudança de código revertida
- **Verification:** leitura de código de `mapa/xmap.js:431-446` confirma a ausência de remoção do grupo anterior; `mapa/mapa-editor.js` não importa nem chama `registrarCamadasGrama`/`registrarCamadasEletrica`, confirmado por `grep`
- **Impact:** Dentro de uma mesma sessão, depois de posicionar um ativo, ele deixa de aparecer na lista de não localizados e passa a aparecer na camada arrastável do editor (com "Mover ativos" ligado) imediatamente; a camada de exibição normal (grama/elétrica, sem o modo de edição ligado) só mostra a posição nova depois de recarregar a página. Registrado aqui como limitação conhecida para o roteiro de UAT do plano 10-08 confirmar visualmente e decidir se vale abrir uma correção futura em `xmap.js` (fora do escopo desta fase, por decisão travada).

---

**Total deviations:** 1 gate mis-specification (não código), 1 issue conhecida registrada e não corrigida (fora do escopo, arquivo com edição proibida)
**Impact on plan:** O gate mal especificado não afeta nenhuma propriedade real do plano — a asserção correta (nenhuma cor nova introduzida por esta task) está satisfeita. A issue da camada de exibição não sendo recarregada em tempo real é uma limitação real, mas está contida (não há duplicação de marcador, só desatualização visual até o próximo carregamento de página) e é a alternativa mais segura possível sem violar a proibição explícita de editar `mapa/xmap.js`.

## Issues Encountered

Nenhum além das duas deviations acima, já registradas.

## User Setup Required

Nenhum passo novo além do herdado dos planos 10-01/10-05/10-06 (migração 25 ainda pendente de aplicação em produção pelo usuário — ver `10-01-SUMMARY.md` § "User Setup Required"). Este plano acrescenta a primeira escrita real em `maq_ativos`/`elet_ativos` do módulo `mapa/`, mas nenhuma gravação pôde ser exercitada contra o Supabase real neste ambiente autônomo (sem credenciais, sem navegador, sem sessão autenticada).

## Next Phase Readiness

- O caminho de entrada de coordenada está completo: migração (10-01) → resolução de posição (10-02) → leitura e lista de não localizados (10-05) → escrita e painel (10-07, este plano). Depois que o usuário aplicar a migração 25 e posicionar os primeiros ativos pela lista de não localizados, o `/mapa` deixa de abrir vazio.
- **Verificação de ponta a ponta pendente para o roteiro de UAT do plano 10-08:** este plano prova a estrutura por gate automatizado e por leitura de código (validação antes do envio, alvo da escrita, origem única do cargo, envelope batendo nos dois lados). O comportamento fim a fim — clicar num item da lista e depois no mapa, ver o ativo sair da lista e a coordenada persistir; arrastar um marcador e ver a posição nova sobreviver a um recarregamento — só é observável no navegador, com sessão autenticada e a migração 25 aplicada. Nenhum dos dois estava disponível neste ambiente autônomo.
- Limitação conhecida (Deviation 2) para o roteiro de UAT confirmar visualmente: dentro de uma sessão, a camada de exibição normal (grama/elétrica) só reflete uma posição recém-gravada depois de recarregar a página — a lista de não localizados e a camada arrastável do próprio editor atualizam na hora.
- Bloqueio herdado: a migração 25 continua pendente de aplicação no banco de produção real. Até lá, `salvarPosicaoAtivo` está pronta e correta estruturalmente, mas nenhuma gravação real em `maq_ativos.lat`/`lon` ou `elet_ativos.lat`/`lon` pode ser considerada testada ponta a ponta.

---
*Phase: 10-mapa-operacional*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: mapa/mapa-dados.js
- FOUND: mapa/mapa-editor.js
- FOUND: mapa/app.js
- FOUND: mapa/index.html
- FOUND: tests/mapa-posicionamento.test.js
- FOUND: .planning/phases/10-mapa-operacional/10-07-SUMMARY.md
- FOUND commit: 32f75be (feat 10-07 salvarPosicaoAtivo + CARGOS_POSICAO)
- FOUND commit: 689d6c3 (feat 10-07 modo de posicionamento + painel)
- FOUND commit: 1772b05 (test 10-07 gate mapa-posicionamento)
