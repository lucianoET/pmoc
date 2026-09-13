---
phase: 06-tema-claro-escuro
plan: 03
subsystem: ui
tags: [anti-fouc, data-theme, localstorage, shared/tema.js, portal, color-mix]

requires:
  - phase: 06-tema-claro-escuro
    provides: "06-01: bloco [data-theme=\"claro\"] em shared/pmoc.css com os 12 tokens de tema claro; 06-02: shared/tema.js (núcleo puro + aplicadores) e botão #btn-tema injetado em montarShell()"
provides:
  - "Script clássico de pré-desenho, byte-idêntico nas 7 superfícies (6 módulos + portal), aplicando data-theme antes do primeiro paint — elimina a piscada de tema escuro→claro em todo recarregamento"
  - "Portal (/index.html) com bloco de tema claro embutido próprio (D-02: não carrega shared/pmoc.css), botão #btn-tema e consumo de shared/tema.js via iniciarTema() — sem lógica de alternância duplicada"
  - "Dois últimos hardcodes de cor dependente de fundo escuro corrigidos: realce de linha de tabela em maquinas/index.html e selo de demonstração em mapa/index.html, ambos via color-mix sobre token"
  - "tests/tema-superficies.test.js — gate automatizado permanente das 7 superfícies e dos 2 arquivos fora do escopo (D-01 mapa/xmap.css, D-04 refrigeracao/)"
affects: [06-04-tema-claro-escuro]

tech-stack:
  added: []
  patterns:
    - "Script clássico inline (sem type=module, sem src externo), replicado byte-idêntico em 7 <head>, imediatamente após a meta tag de cor de barra — único mecanismo capaz de aplicar data-theme antes do primeiro paint, porque módulo ES é adiado por padrão"
    - "Portal duplica tokens de cor (não lógica) da folha comum: bloco [data-theme=\"claro\"] embutido com os mesmos 11 valores de shared/pmoc.css, mas reusa shared/tema.js para toda a lógica de detecção/aplicação/alternância"
    - "Teste de superfícies por leitura de arquivo (node:fs), sem DOM simulado: extrai a linha do script de cada superfície e compara o conjunto — divergência entre cópias vira falha de suíte, não descoberta em produção"

key-files:
  created:
    - tests/tema-superficies.test.js
  modified:
    - maquinas/index.html
    - transportes/index.html
    - eletrica/index.html
    - fonoclama/index.html
    - predial/index.html
    - mapa/index.html
    - index.html

key-decisions:
  - "PLAT-04/PLAT-05/PLAT-16 não foram marcados [x] em REQUIREMENTS.md: seguindo o mesmo precedente de 06-01/06-02, o fechamento formal com evidência fica reservado ao plano 06-04 (auditoria de fechamento), mesmo padrão que a Fase 5 usou com 05-07"
  - "Script anti-FOUC inserido imediatamente após a meta tag de cor de barra e antes de <title>, em todas as 7 superfícies — posição byte-idêntica, não apenas comportamento idêntico, para que o teste de superfícies compare a mesma linha em todas"
  - "Portal recebeu contêiner .hd-right (flex) para acomodar hd-sub + botão de tema lado a lado sem quebrar o alinhamento de dois extremos que .hd (justify-content:space-between) já tinha entre .brand e o lado direito"
  - "Botão de tema do portal usa var(--green) no hover em vez de var(--accent-texto): o portal não declara --accent (não é um módulo com identidade própria), e --green já é a cor de destaque que a marca do portal usa no ponto do logo"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "Script clássico de pré-desenho, byte-idêntico nas 7 superfícies, no cabeçalho do documento, validando contra a lista fechada claro/escuro, consultando prefers-color-scheme e tolerando armazenamento bloqueado"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "bash gate embutido no plano (Task 1 + Task 2) — extração da linha de script nas 7 superfícies, comparação de conjunto distinto = 1, ausência de type=module/src, presença de claro/escuro/prefers-color-scheme/catch"
        status: pass
      - kind: unit
        ref: "tests/tema-superficies.test.js — 5 casos cobrindo presença, identidade entre cópias, ausência de módulo/origem externa, validação por lista fechada e posição no <head>"
        status: pass
    human_judgment: true
    rationale: "A ausência de flash visual (FOUC) é um comportamento de runtime em navegador real; o gate automatizado prova a presença/identidade/posição do script por leitura de arquivo, não a ausência de piscada observada visualmente — fica para o roteiro manual do plano 06-04"
  - id: D2
    description: "Nenhum dos 6 módulos ganhou token de cor além de --accent nem bloco de tema próprio; os dois últimos hardcodes de cor dependente de fundo escuro (maquinas, mapa) passam a derivar de token via color-mix"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "bash gate embutido no plano (Task 1) — grep de ausência de token próprio e de bloco [data-theme=\"claro\"] nos 6 módulos; grep de ausência dos dois rgba hardcoded"
        status: pass
      - kind: unit
        ref: "tests/tema-superficies.test.js — caso dedicado cobrindo os 6 módulos"
        status: pass
    human_judgment: false
  - id: D3
    description: "Portal ganha bloco de tema claro embutido (D-02, não herda de shared/pmoc.css), botão #btn-tema com mesmo id/classe dos módulos, e consome shared/tema.js via iniciarTema() em vez de reimplementar a alternância"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "bash gate embutido no plano (Task 2) — presença dos 11 tokens claros, preservação dos 11 tokens escuros originais, ausência de rgba hardcoded remanescente nos selos, presença de btn-tema/alternarTema()/shared/tema.js/iniciarTema, ausência de function alternarTema própria, preservação das 7 rotas de cartão"
        status: pass
    human_judgment: false
  - id: D4
    description: "Na primeira visita, sem preferência salva, a preferência do sistema operacional decide o tema nas 7 superfícies, porque compartilham a mesma origem e a mesma chave de localStorage"
    requirement: "PLAT-05"
    verification: []
    human_judgment: true
    rationale: "Comportamento de runtime em navegador real (matchMedia, localStorage compartilhado entre paths) — marcado como backstop no plano; sem navegador nem Playwright disponíveis neste executor autônomo, fica para o roteiro manual do plano 06-04"
  - id: D5
    description: "D-01 (mapa/xmap.css dark-only) e D-04 (refrigeracao/ intocada) deixam de ser disciplina humana e viram gate automatizado permanente"
    requirement: "PLAT-15"
    verification:
      - kind: unit
        ref: "tests/tema-superficies.test.js — 2 casos negativos dedicados; git diff --name-only 351b13c..HEAD -- refrigeracao/ e -- mapa/xmap.css, ambos vazios"
        status: pass
    human_judgment: false
  - id: D6
    description: "node --test na raiz permanece verde e cresce de 34 (baseline pós-06-02) para 43 testes, sem nenhum teste removido, renomeado ou enfraquecido"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "node --test (43 testes, fail 0)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-11
status: complete
---

# Phase 06 Plan 03: Script anti-FOUC nas 7 superfícies e tema no portal Summary

**As 7 superfícies do projeto (6 módulos + portal) ganham um script clássico de pré-desenho byte-idêntico que aplica `data-theme` antes do primeiro paint; o portal ganha bloco de tema claro embutido e consome `shared/tema.js` em vez de duplicar lógica; `node --test` cresce de 34 para 43 testes com um gate novo que trava D-01 e D-04 em código.**

## Performance

- **Duration:** 3min
- **Started:** 2026-08-11T10:10:58Z
- **Completed:** 2026-08-11T10:13:15Z
- **Tasks:** 3 completed
- **Files modified:** 8 (1 criado, 7 editados)

## Accomplishments
- Script clássico de pré-desenho — `<script>` sem `type="module"` e sem `src` externo, uma única linha, lendo `localStorage['pmoc-tema']`, validando contra a lista fechada `claro`/`escuro`, caindo para `prefers-color-scheme` quando não há preferência salva ou quando `matchMedia` não existe, e caindo para `escuro` no bloco `catch` — inserido imediatamente após a meta tag de cor de barra em `maquinas`, `transportes`, `eletrica`, `fonoclama`, `predial`, `mapa` e no portal `/index.html`. As 7 cópias são byte-idênticas, confirmado por extração de linha e comparação de conjunto (tamanho 1).
- `maquinas/index.html`: realce de linha de tabela sob o ponteiro trocado de `rgba(255,255,255,.02)` fixo para `color-mix(in srgb,var(--text) 4%,transparent)` — visível no tema claro, discreto e byte-equivalente na tonalidade sobre o tema escuro.
- `mapa/index.html`: selo de demonstração `.mod-badge-demo` trocado de `rgba(201,168,76,.15)` fixo para `color-mix(in srgb,var(--yellow) 15%,transparent)`, seguindo o mesmo formato já usado pelos selos da folha comum. `mapa/xmap.css` não foi aberto para edição (D-01).
- Portal `/index.html` (que não carrega `shared/pmoc.css`, D-02): bloco `[data-theme="claro"]` embutido com os 11 tokens (7 neutros + 4 semânticos que o portal usa) cópia deliberada dos mesmos valores de `shared/pmoc.css`; as 3 classes de selo (`.t-ok`, `.t-wip`, `.t-plan`) convertidas de `rgba` hardcoded para `color-mix` sobre token; botão `#btn-tema` no cabeçalho visual (novo contêiner `.hd-right` acomodando legenda + botão sem quebrar o alinhamento de dois extremos); `<script type="module">` no fim do corpo chamando `iniciarTema()` de `shared/tema.js` — o portal não reimplementa nenhuma lógica de alternância.
- `tests/tema-superficies.test.js` criado com 9 casos: presença da chave nas 7 superfícies, identidade byte a byte entre as 7 cópias do script, ausência de tipo de módulo/origem externa, presença dos textos da lista fechada e da consulta de preferência, presença do bloco de captura de exceção, posição do script antes do fechamento do `<head>`, ausência de token/bloco de tema próprio nos 6 módulos, e os dois gates negativos (`refrigeracao/index.html`, `mapa/xmap.css`).
- `node --test` cresce de 34 (baseline pós-06-02) para 43 testes, sempre verde.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replicar o script de pré-desenho nos 6 cabeçalhos de módulo e derivar de token os dois últimos hardcodes** - `8f49b28` (feat)
2. **Task 2: Levar o tema ao portal, que não carrega a folha comum (D-02)** - `9fa7faa` (feat)
3. **Task 3: Criar tests/tema-superficies.test.js — gate automatizado das 7 superfícies e dos 2 arquivos fora do escopo** - `b91be42` (test)

**Plan metadata:** pending (docs: complete plan) — commit hash recorded after this SUMMARY

## Files Created/Modified
- `maquinas/index.html` - Script anti-FOUC no cabeçalho; realce de linha de tabela via `color-mix`
- `transportes/index.html` - Script anti-FOUC no cabeçalho
- `eletrica/index.html` - Script anti-FOUC no cabeçalho
- `fonoclama/index.html` - Script anti-FOUC no cabeçalho
- `predial/index.html` - Script anti-FOUC no cabeçalho
- `mapa/index.html` - Script anti-FOUC no cabeçalho; selo de demonstração via `color-mix` (`mapa/xmap.css` não tocado)
- `index.html` (portal) - Script anti-FOUC, bloco `[data-theme="claro"]` embutido, selos via `color-mix`, botão `#btn-tema`, módulo ES consumindo `iniciarTema()`
- `tests/tema-superficies.test.js` - Novo: 9 casos de conformidade das 7 superfícies e dos 2 gates negativos

## Decisions Made
- PLAT-04/PLAT-05/PLAT-16 não foram marcados `[x]` em REQUIREMENTS.md: segue o precedente já estabelecido em 06-01/06-02 — o fechamento formal com evidência de conferência humana (visual, pós-login) fica reservado ao plano 06-04, mesmo padrão que a Fase 5 usou em 05-07.
- O script anti-FOUC foi posicionado imediatamente após a meta tag de cor de barra e antes de `<title>` nas 7 superfícies — não apenas "em algum ponto do `<head>` antes do CSS", mas na mesma posição relativa em todas, para que a linha extraída pelo teste de superfícies seja comparável sem ambiguidade de contexto.
- O portal ganhou um contêiner `.hd-right` (flex, `gap:12px`) novo para acomodar a legenda institucional e o botão de tema lado a lado, preservando o alinhamento de dois extremos que `.hd{justify-content:space-between}` já garantia entre `.brand` e o lado direito.
- O botão de tema do portal usa `var(--green)` no estado `:hover` em vez de `var(--accent-texto)` (usado pelos 6 módulos): o portal não declara `--accent` — não é um módulo com identidade própria — e `--green` já é a cor de destaque usada no ponto da marca (`.dot`).

## Deviations from Plan

None - plan executado exatamente como escrito. Os dois gates automatizados do plano (Task 1 e Task 2) passaram sem necessidade de ajuste; nenhuma Regra 1-4 foi acionada.

## Issues Encountered
- Durante a execução, um commit concorrente de outra sessão (`d3f140b`, tarefa `quick-260811-9sb`) alterou `index.html` (portal) para ativar o card "Calibração" e o roteamento `/calibracao`, entre a leitura inicial deste plano e a primeira edição do portal na Task 2. O `Edit` foi aplicado com sucesso sobre o conteúdo atualizado (a ferramenta avisou sobre a divergência de estado); o arquivo foi relido por completo antes de prosseguir, e o `git diff --cached` do commit da Task 2 confirmou que apenas as mudanças desta Task (script anti-FOUC, bloco de tema, selos, botão) foram staged — a mudança concorrente já estava em `HEAD` antes desta sessão tocar o arquivo, então não apareceu no diff da Task 2 nem foi reintroduzida/revertida por engano.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
As 7 superfícies (6 módulos + portal) agora aplicam o tema salvo antes do primeiro desenho, e o gate automatizado de `tests/tema-superficies.test.js` trava por código as decisões D-01 (`mapa/xmap.css` dark-only) e D-04 (`refrigeracao/` intocada). `node --test` está em 43/43. Falta para o plano 06-04 (auditoria de fechamento): a conferência visual real em navegador — troca de tema sem piscada, contraste legível nos dois temas em cada módulo, primeira visita seguindo `prefers-color-scheme`, persistência entre módulos/abas — e o fechamento formal de PLAT-04/PLAT-05/PLAT-16 em `REQUIREMENTS.md` com evidência específica desta fase, como os próprios planos 06-01/06-02/06-03 já reservaram.

---
*Phase: 06-tema-claro-escuro*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: maquinas/index.html
- FOUND: transportes/index.html
- FOUND: eletrica/index.html
- FOUND: fonoclama/index.html
- FOUND: predial/index.html
- FOUND: mapa/index.html
- FOUND: index.html
- FOUND: tests/tema-superficies.test.js
- FOUND: .planning/phases/06-tema-claro-escuro/06-03-SUMMARY.md
- FOUND: 8f49b28 (Task 1 commit)
- FOUND: 9fa7faa (Task 2 commit)
- FOUND: b91be42 (Task 3 commit)
