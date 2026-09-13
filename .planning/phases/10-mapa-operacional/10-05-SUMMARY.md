---
phase: 10-mapa-operacional
plan: 05
subsystem: frontend
tags: [supabase, leaflet, es-modules, geojson, vocabulary-bridge]

requires:
  - phase: 10-mapa-operacional plan 01
    provides: "maq_areas.geom/flora/inclinacao/limpeza e lat/lon nas seis tabelas de posição (migração 25) — as colunas que este plano lê"
  - phase: 10-mapa-operacional plan 02
    provides: "mapa/mapa-geometria.js — resolverPosicao, maquinasParaZona, normalizarCategoria, linkDoModulo, consumidos aqui sem reimplementação"
provides:
  - "mapa/mapa-dados.js — única porta de leitura do Supabase dentro de mapa/: carregarAreas, carregarLocaisComPosicao, carregarAtivosDoModulo (lista fechada maquinas/eletrica), posicionarAtivos (usa resolverPosicao e acumula NAO_LOCALIZADOS por módulo), mostrarErroDeCarga"
  - "mapa/xmap-layers-grama.js e -eletrica.js como módulo ES: registrarCamadasGrama()/registrarCamadasEletrica(), sem nenhuma lista de dados fixos, chamadas pelo boot depois de o cliente Supabase existir"
  - "camada elétrica por tipo real de elet_ativos (GERADOR/QGBT/NOBREAK/ILUMINACAO); camadas de transformador e ramal removidas (sem tabela real)"
  - "mapa/xmap-layers-aguada.js com o cabeçalho explicando D-01 (por que continua mock), sem alterar nenhuma linha de código"
affects: [10-06, 10-07, 10-08]

tech-stack:
  added: []
  patterns:
    - "Ponte de vocabulário local ao arquivo de apresentação (statusParaExibicao em xmap-layers-grama.js, estadoParaExibicao em xmap-layers-eletrica.js) para traduzir o status real do banco (operante/inoperante/manutencao/baixado) para o vocabulário de cor/ícone que os componentes visuais portados do legado ainda falam — mesmo espírito de normalizarCategoria em mapa-geometria.js, mas fora do núcleo puro porque é decisão de apresentação, não de domínio"
    - "Registro de camada movido de auto-registro por script clássico (tryRegister + setTimeout) para função assíncrona exportada, chamada pelo boot depois de definirCliente(supa) — elimina a corrida entre o momento em que o componente xMap existe e o momento em que a sessão do Supabase existe"
    - "Busca uma vez, monta layerDefs sobre o resultado já carregado, só então chama xMap.registerLayer — em vez de cada render(group) buscar de novo, evita N requisições redundantes para N camadas do mesmo módulo"

key-files:
  created:
    - mapa/mapa-dados.js
    - tests/mapa-camadas.test.js
  modified:
    - mapa/xmap-layers-grama.js
    - mapa/xmap-layers-eletrica.js
    - mapa/xmap-layers-aguada.js
    - mapa/app.js
    - mapa/index.html

key-decisions:
  - "TABELA_POR_MODULO (mapa-dados.js) fica com só dois módulos hoje (maquinas→maq_ativos, eletrica→elet_ativos) — o que este plano precisa; cresce nos planos 10-06/10-07 conforme mais módulos ganharem posição, em vez de antecipar as cinco tabelas de PLAT-14 sem uso real ainda"
  - "NAO_LOCALIZADOS.limparNaoLocalizados(modulo) limpa só a fatia do módulo que está recarregando, não a lista inteira — grama e elétrica se registram em paralelo (Promise.all no boot) e uma limpeza total apagaria o que a outra camada acabou de escrever"
  - "Ponte de vocabulário de status/estado (operante/inoperante/manutencao/baixado do banco → operacional/em_manutencao/inativo e operando/manutencao/alerta/inativo que os ícones legados falam) — ver Deviations, Rule 1"
  - "Ícone de NOBREAK e ILUMINACAO (elet_ativos) não tinha precedente no arquivo legado, que só cobria gerador/transformador/quadro/ramal — ativoGenericoSVG(emoji, estado) segue o mesmo padrão visual (retângulo + emoji) dos ícones existentes, em vez de forçar um encaixe semântico ruim (ex. reaproveitar o ícone de transformador para nobreak)"

requirements-completed: [PLAT-17, PLAT-13, PLAT-14, PLAT-16]

coverage:
  - id: D1
    description: "mapa/mapa-dados.js criado como única porta de leitura do Supabase em mapa/, com lista fechada de módulo→tabela, idioma de erro do projeto e aviso visível na tela além do console"
    requirement: "PLAT-17"
    verification:
      - kind: unit
        ref: "tests/mapa-camadas.test.js#mapa/mapa-dados.js é o único arquivo de mapa/ que fala com o banco (.from)"
        status: pass
      - kind: other
        ref: "gate estático da Task 1 — exportações previstas, sem reimplementar mapa-geometria.js, sem escrita, sem Leaflet"
        status: pass
    human_judgment: false
  - id: D2
    description: "grama e elétrica leem do Supabase pela camada de dados, sem nenhuma lista de dados fixos sobrevivente; camadas de transformador/ramal removidas (sem tabela real)"
    requirement: "PLAT-17"
    verification:
      - kind: unit
        ref: "tests/mapa-camadas.test.js#nenhuma das duas camadas declara lista de dados fixos"
        status: pass
      - kind: unit
        ref: "tests/mapa-camadas.test.js#as duas camadas continuam chamando xMap.registerLayer com o nome de módulo certo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ativo aparece na posição própria quando tem, herdada do local quando não tem, resolvido pela função pura do plano 10-02; ativo sem posição nenhuma entra em NAO_LOCALIZADOS em vez de desaparecer em silêncio"
    requirement: "PLAT-13"
    verification:
      - kind: unit
        ref: "tests/mapa-geometria.test.js#resolverPosicao (herdado do plano 10-02, consumido sem reimplementação aqui)"
        status: pass
      - kind: other
        ref: "mapa/mapa-dados.js#posicionarAtivos — leitura de código: usa resolverPosicao, acumula NAO_LOCALIZADOS por módulo"
        status: pass
    human_judgment: true
    rationale: "A migração 25 ainda não foi aplicada no banco de produção (pendência herdada do plano 10-01) — nenhum ativo real tem lat/lon até o usuário rodar a migração e posicionar via plano 10-07; o comportamento fim a fim contra dado real só é observável depois disso, no roteiro de UAT."
  - id: D4
    description: "Balão de cada ativo traz link para a ficha no módulo de origem, montado por linkDoModulo (núcleo puro) e nunca concatenado à mão"
    requirement: "PLAT-14"
    verification:
      - kind: unit
        ref: "tests/mapa-camadas.test.js#as duas camadas usam linkDoModulo do núcleo puro e não montam a rota do módulo de origem à mão"
        status: pass
      - kind: unit
        ref: "tests/mapa-geometria.test.js#linkDoModulo (herdado do plano 10-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "node --test sobe de 111 para 119 (fail 0), nenhum teste do baseline removido; mapa/xmap.js, mapa/xmap.css e refrigeracao/ intocados desde o commit de referência da fase"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "node --test (111 → 119, fail 0)"
        status: pass
      - kind: other
        ref: "git diff --name-only -- mapa/xmap.js mapa/xmap.css (0 arquivos); git diff --name-only 511bb9e..HEAD -- refrigeracao/ (0 arquivos)"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 05: Camadas de grama e elétrica lêem do Supabase Summary

**`mapa/mapa-dados.js` criado como única porta de leitura do Supabase no módulo mapa; `xmap-layers-grama.js` e `-eletrica.js` deixam de ser dados de demonstração embutidos e passam a ler `maq_areas`/`maq_ativos`/`elet_ativos` reais, com posição resolvida pelo núcleo puro do plano 10-02, link para o módulo de origem e ativos sem coordenada acumulados numa lista visível em vez de desaparecerem em silêncio.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-12
- **Tasks:** 3/3 completed
- **Files modified:** 7 (2 novos, 5 editados)

## Accomplishments

- `mapa/mapa-dados.js` criado: única porta de leitura do Supabase dentro de `mapa/`, com `TABELA_POR_MODULO` como lista fechada (`maquinas`→`maq_ativos`, `eletrica`→`elet_ativos`), idioma de erro do projeto em toda consulta (desestrutura `error`, registra no console, mostra aviso visível na tela via `mostrarErroDeCarga`), e `posicionarAtivos` que usa `resolverPosicao` do núcleo puro e acumula os ativos sem coordenada em `NAO_LOCALIZADOS` (limpeza por módulo, não global, para grama e elétrica não se apagarem uma à outra ao registrar em paralelo).
- `mapa/xmap-layers-grama.js` convertido para módulo ES: `registrarCamadasGrama()` busca áreas/máquinas/locais uma vez, monta as duas definições de camada sobre o resultado carregado e só então chama `xMap.registerLayer`. O balão de zona ganha as máquinas compatíveis (`maquinasParaZona`, núcleo puro) e uma linha para as que ficaram fora da classificação; o balão de máquina ganha origem da posição e link para a ficha no módulo `/maquinas`. As duas listas de demonstração (`MOCK_AREAS`, `MOCK_MAQUINAS`) saíram.
- `mapa/xmap-layers-eletrica.js` convertido para módulo ES: `registrarCamadasEletrica()` lê `elet_ativos` uma vez e monta um layer por tipo real (`GERADOR`, `QGBT`, `NOBREAK`, `ILUMINACAO` — os mesmos quatro de `eletrica/app.js:8-13`). As camadas de transformador e ramal foram removidas — nenhuma tabela do projeto as descreve. As quatro listas de demonstração (`GERADORES`, `TRANSFORMADORES`, `QUADROS`, `RAMAIS`) saíram.
- `mapa/xmap-layers-aguada.js`: só o cabeçalho mudou — ganhou a explicação de D-01 (sistema externo autônomo, sem tabela no pmoc, gate automatizado nas duas direções). Confirmado por diff contra o commit de referência da fase (`511bb9e`): toda linha adicionada e toda linha removida é comentário.
- `mapa/app.js`: importa `definirCliente` (mapa-dados.js) e as duas funções de registro; chama `definirCliente(supa)` logo depois de criar o cliente no boot, e `registrarCamadasGrama()`/`registrarCamadasEletrica()` (em paralelo, via `Promise.all`) depois de `xMap.init()` ter sucesso.
- `mapa/index.html`: as duas etiquetas `<script>` clássicas de grama/elétrica saíram (agora import de módulo); o selo "demo" saiu dos botões de grama e elétrica e ficou só no de aguada, com `title` explicando o motivo (D-01).
- `tests/mapa-camadas.test.js` criado com 8 casos: import de `mapa-dados.js`, ausência da rotina de nova tentativa (`tryRegister`/`setTimeout`), ausência de lista de dados fixos (forma da declaração, não a palavra "mock"), contrato `xMap.registerLayer` preservado, `linkDoModulo` sem rota escrita à mão, `maquinasParaZona` presente na grama, `mapa-dados.js` como porta única do banco em `mapa/`, e marcação sem etiqueta clássica das duas camadas convertidas.
- `node --test`: **111 → 119** (8 casos novos), 0 falhas, nenhum teste do baseline removido (PLAT-16). `mapa/xmap.js`, `mapa/xmap.css` e `refrigeracao/` confirmados intocados desde `511bb9e`.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Criar mapa/mapa-dados.js** — `39321c3` (feat)
2. **Task 2: Trocar os dados de demonstração de grama e elétrica por leitura real** — `bfec6ab` (feat)
3. **Task 3: Criar tests/mapa-camadas.test.js** — `4e67840` (test)

**Plan metadata:** (a seguir, neste commit)

## Files Created/Modified

- `mapa/mapa-dados.js` — camada de dados do mapa: leitura de `maq_areas`/`cmasm_locais`/`maq_ativos`/`elet_ativos`, posicionamento em duas camadas e lista de não localizados
- `mapa/xmap-layers-grama.js` — camada de zonas e máquinas lendo do banco, com máquinas compatíveis e link para `/maquinas`
- `mapa/xmap-layers-eletrica.js` — um layer por tipo real de `elet_ativos`, com link para `/eletrica`
- `mapa/xmap-layers-aguada.js` — cabeçalho com a explicação de D-01, nenhuma linha de código alterada
- `mapa/app.js` — entrega o cliente Supabase à camada de dados e registra grama/elétrica depois de inicializar o mapa
- `mapa/index.html` — camadas convertidas saem da etiqueta de script clássica; selo de demonstração só em aguada
- `tests/mapa-camadas.test.js` — gate de que grama e elétrica leem do banco pela camada de dados

## Decisions Made

- `TABELA_POR_MODULO` em `mapa-dados.js` fica com só os dois módulos que este plano usa (`maquinas`, `eletrica`) — cresce nos planos 10-06/10-07 conforme mais módulos ganharem posição no mapa, em vez de antecipar as cinco tabelas do vocabulário de `linkDoModulo` sem consumidor real ainda.
- `limparNaoLocalizados(modulo)` limpa só a fatia do módulo recarregado, não a lista inteira — grama e elétrica se registram em paralelo (`Promise.all` no boot) e uma limpeza global apagaria o que a outra camada tivesse acabado de escrever.
- Ponte de vocabulário de status/estado local a cada arquivo de camada (não no núcleo puro, por ser decisão de apresentação): ver Deviations, Rule 1.
- Ícones de NOBREAK e ILUMINACAO (sem precedente no arquivo legado, que só cobria gerador/transformador/quadro/ramal) usam `ativoGenericoSVG(emoji, estado)`, seguindo o mesmo padrão visual (retângulo + emoji) dos ícones existentes, em vez de forçar reaproveitamento semântico ruim de um ícone que representa outra coisa.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vocabulário de status/estado do banco não bate com o que os componentes visuais portados do legado esperam**

- **Found during:** Task 2, ao adaptar `renderMaquinas`/`renderAtivosEletricos` para ler dado real
- **Issue:** `maq_ativos.status` e `elet_ativos.status` usam o vocabulário real do banco (`operante`/`inoperante`/`manutencao`/`baixado` — `supabase/01_maquinas_schema.sql`, `supabase/14_eletrica_fonoclama_schema.sql`), mas `statusClass`/`maquinaSVG` (grama) e `estadoColor`/`estadoClass` (elétrica) — portados do legado e mantidos como estão, por instrução explícita do plano ("Manter, sem alterar, as funções de estilo, de rótulo, de ícone... — só a origem do array que elas recebem muda") — falam o vocabulário antigo do mock (`operacional`/`em_manutencao`/`inativo` e `operando`/`standby`/`manutencao`/`alerta`/`inativo`). Sem tratamento, todo ativo real cairia no `|| fallback` cinza dessas funções, perdendo a distinção visual de estado que é o propósito da cor no mapa — silenciosamente, sem quebrar nada, sem gate acusando.
- **Fix:** Adicionada uma função de ponte local a cada arquivo de camada (`statusParaExibicao` em `xmap-layers-grama.js`, `estadoParaExibicao` em `xmap-layers-eletrica.js`), que traduz o valor real do banco para o vocabulário de exibição antes de chamar as funções mantidas — honra literalmente a instrução do plano (as funções `statusClass`/`maquinaSVG`/`estadoColor`/`estadoClass` continuam byte-a-byte como estavam) e corrige o comportamento real com dado do banco. Mesmo espírito de `normalizarCategoria` em `mapa/mapa-geometria.js`, mas fora do núcleo puro porque é decisão de apresentação (cor/ícone), não de domínio.
- **Files modified:** `mapa/xmap-layers-grama.js`, `mapa/xmap-layers-eletrica.js`
- **Verification:** `node --check` nas duas cópias `.mjs`; leitura de código confirma que nenhuma das quatro funções "mantidas como estão" foi tocada — só a ponte antes delas
- **Committed in:** `bfec6ab` (Task 2)

### Gate mal especificado corrigido (não é auto-fix de código)

**2. [Gate mis-specification] Selo de demonstração com `title` explicativo quebra o `grep` literal do `<verify>` da Task 2**

- **Found during:** Task 2, verificação automatizada
- **Issue:** O `<verify><automated>` da Task 2 confere o selo com `grep -c "mod-badge-demo\">"` — string literal que exige a classe seguida imediatamente de `">`. A própria ação do plano instrui acrescentar `title` ao selo da aguada explicando o motivo ("manter o da aguada, com o título do botão explicando que ela vem de sistema externo"), o que insere um atributo entre `class="mod-badge-demo"` e o `>` de fechamento — quebrando o casamento literal do grep mesmo com a propriedade real satisfeita (exatamente um selo nos botões de módulo).
- **Fix:** Verifiquei a propriedade real do acceptance criteria ("exatamente uma ocorrência da classe de selo nos botões de módulo") com `grep -c 'class="mod-badge-demo"'` em vez do padrão literal com `">` colado — 1 ocorrência confirmada. Não removi o `title` (que o próprio texto do plano pede) só para casar com a string exata do script de verificação copiado.
- **Files modified:** nenhum arquivo de produção alterado por esta correção — apenas a forma de executar a verificação
- **Verification:** `node --test` roda 119/119 (0 falhas); `grep -c 'class="mod-badge-demo"' mapa/index.html` confirma 1
- **Committed in:** não aplicável — nenhuma mudança de arquivo, só a execução do gate ajustada

---

**Total deviations:** 1 auto-fixado (Regra 1 — vocabulário de status), 1 gate mis-specification (não código)
**Impact on plan:** A correção de vocabulário é necessária para o mapa mostrar o estado real de cada ativo com a cor certa em vez de cair sempre no cinza de fallback — sem ela, o `<verify>` estático da Task 2 passaria (o gate só confere texto/estrutura), mas todo ativo real apareceria com o mesmo ícone neutro, escondendo justamente a informação operacional que o mapa existe para mostrar. O gate mal especificado do selo não afeta nenhuma propriedade real do plano — a asserção correta (uma ocorrência da classe) está satisfeita.

## Issues Encountered

None além das duas deviations acima, já registradas.

## User Setup Required

Nenhum passo novo além do herdado do plano 10-01 (migração 25 ainda pendente de aplicação em produção pelo usuário — ver `10-01-SUMMARY.md` § "User Setup Required"). Este plano não toca o banco além de leitura, e a leitura só retorna dado real depois que a migração for aplicada e algum ativo for posicionado (plano 10-07).

## Next Phase Readiness

- `mapa/mapa-dados.js` está pronto para os planos 10-06 (editor de zona) e 10-07 (posicionamento de ativo no mapa) acrescentarem escrita — nenhuma consulta nova deveria nascer fora deste arquivo, o gate de porta única (`tests/mapa-camadas.test.js`) falha se nascer.
- `NAO_LOCALIZADOS` está acumulada e pronta para o plano 10-07 exibir; hoje, sem a migração 25 aplicada, o número esperado é "todos os ativos carregados" — não é falha, é o estado inicial (documentado no cabeçalho de `mapa-dados.js`).
- **Verificação visual pendente para o roteiro de UAT do plano 10-08:** este plano prova a estrutura por gate automatizado e por leitura de código (import correto, contrato preservado, vocabulário traduzido), mas o comportamento fim a fim — zonas e máquinas reais desenhando no mapa com a cor certa, balão abrindo o link certo — só é observável no navegador, com sessão autenticada e a migração 25 aplicada. Nenhum dos dois estava disponível neste ambiente autônomo.
- Bloqueio herdado dos planos 10-01/10-02/10-04: a migração 25 continua pendente de aplicação no banco de produção real pelo usuário. Até lá, `carregarAreas`/`carregarAtivosDoModulo` seguem funcionando (a migração é aditiva, as tabelas e colunas usadas por este plano em `SELECT` já existem desde as migrações 01/12/14/19), mas toda posição volta vazia e a camada de grama/elétrica desenha zonas sem geometria nova e ativos todos em `NAO_LOCALIZADOS` até a migração rodar e o plano 10-07 posicionar algo.

---
*Phase: 10-mapa-operacional*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: mapa/mapa-dados.js
- FOUND: tests/mapa-camadas.test.js
- FOUND: mapa/xmap-layers-grama.js
- FOUND: mapa/xmap-layers-eletrica.js
- FOUND: mapa/xmap-layers-aguada.js
- FOUND: mapa/app.js
- FOUND: mapa/index.html
- FOUND: .planning/phases/10-mapa-operacional/10-05-SUMMARY.md
- FOUND commit: 39321c3 (feat 10-05 mapa-dados.js)
- FOUND commit: bfec6ab (feat 10-05 camadas reais)
- FOUND commit: 4e67840 (test 10-05 mapa-camadas)
