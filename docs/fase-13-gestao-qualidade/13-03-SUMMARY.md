---
phase: 13-gest-o-e-qualidade
plan: 03
subsystem: ui
tags: [kanban, calendario, node-test, esm, require-esm]

# Dependency graph
requires:
  - phase: 13-gest-o-e-qualidade (plano 01)
    provides: "shared/componentes.js#esc()/vazio() como precedente de núcleo puro"
  - phase: 13-gest-o-e-qualidade (plano 02)
    provides: "precedente de extração+reexport (predial/dominio.js sobre shared/gut.js)"
provides:
  - "shared/kanban.js — núcleo puro (agruparKanban/htmlKanban), genérico por definição de colunas [{id, rotulo}]"
  - "shared/calendario.js — núcleo puro (DIAS_SEMANA/MESES/gradeMes/agruparPorData/eventosDoMes/htmlCalendario)"
  - "maquinas/operacoes.js como módulo ES puro (sem UMD), fachada sobre shared/kanban.js e shared/calendario.js"
  - "Precedente confirmado: módulo ES puro (import/export, sem top-level await) continua carregável por require() no Node 24.18 sem package.json"
  - "Gate tests/kanban-calendario-compartilhados.test.js (28 casos: 22 de núcleo + 6 estruturais da fachada)"
affects: [13-04, gestao-onda-b, painéis-máquinas-transportes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Kanban genérico por definição de colunas [{id, rotulo}], status desconhecido cai sempre na primeira coluna, preservando ordem de entrada"
    - "Calendário: núcleo separa gradeMes (grade pura)/agruparPorData (agrupamento por data ISO)/eventosDoMes (filtro+ordenação)/htmlCalendario (marcação), mesmo corte núcleo-puro/aplicador-de-DOM de shared/tema.js"
    - "maquinas/operacoes.js: UMD → módulo ES puro sem quebrar require() CommonJS existente (require(esm) nativo do Node >= 22.12), mesmo precedente de shared/tabela.js"

key-files:
  created:
    - shared/kanban.js
    - shared/calendario.js
    - tests/kanban-calendario-compartilhados.test.js
  modified:
    - maquinas/operacoes.js
    - maquinas/index.html
    - maquinas/app.js

key-decisions:
  - "D-13-03-A confirmada: maquinas/operacoes.js vira módulo ES puro (import/export, sem invólucro UMD, sem module.exports) — o require() de tests/operacoes-maquinas.test.js continua funcionando pelo suporte nativo do Node >= 22.12 a require(esm), sem nenhuma alteração no arquivo de teste"
  - "htmlKanban recebe opcoes.cartao (função fornecida pelo chamador) e opcoes.vazio (texto por coluna vazia, padrão 'Nenhum item'); Máquinas passa renderCartaoOperacao e 'Nenhuma operação', preservando a marcação e o texto que a tela já mostrava"
  - "htmlCalendario recebe opcoes.rotuloEvento/opcoes.classeEvento como funções (padrão: evento.origem) — o prefixo 'Operação'/'OS' e a classe op/os continuam sendo decisão de Máquinas, não do núcleo genérico, preparando o calendário consolidado de /gestao (Onda B) para módulos de origem diferentes"
  - "gradeMes/eventosDoMes recusam ano/mês fora de faixa (não-inteiro ou mês fora de 0..11) devolvendo grade/lista vazia em vez de tentar montar algo sem sentido — mitigação do T-13-12 do threat model"
  - "As 20 regras-base de CSS de kanban/calendário saíram de maquinas/index.html (ficam para o plano 13-04, D-10) — a @media(max-width:600px) própria de Máquinas e as classes .ops-actions/.section-spaced permaneceram, exigido por tests/mobile-375.test.js"

patterns-established:
  - "Terceiro precedente de extração para shared/ com fachada no consumidor original, desta vez cruzando a fronteira UMD → módulo ES sem quebrar um gate que usa require() CommonJS"

requirements-completed: [GEQ-04, PLAT-08, PLAT-09]

coverage:
  - id: D1
    description: "shared/kanban.js: agruparKanban/htmlKanban genéricos por definição de colunas — status desconhecido cai na primeira coluna, lista de colunas vazia não lança, contagem zero sempre visível, cartão sem metadado não injeta 'undefined'"
    requirement: GEQ-04
    verification:
      - kind: unit
        ref: "tests/kanban-calendario-compartilhados.test.js (9 casos de shared/kanban.js)"
        status: pass
    human_judgment: false
  - id: D2
    description: "shared/calendario.js: gradeMes/agruparPorData/eventosDoMes/htmlCalendario — fevereiro bissexto e não bissexto, mês começando no domingo, data inválida descartada sem lançar, evento sem título cai para o rótulo da origem, marca 'hoje', ano/mês fora de faixa devolve grade vazia"
    requirement: GEQ-04
    verification:
      - kind: unit
        ref: "tests/kanban-calendario-compartilhados.test.js (13 casos de shared/calendario.js)"
        status: pass
    human_judgment: false
  - id: D3
    description: "maquinas/operacoes.js vira fachada ES pura sobre shared/kanban.js e shared/calendario.js, sem cópia local da lógica genérica, publicando globalThis.OperacoesMaq; maquinas/app.js#renderOperacoes/renderAgenda viram aplicadores de DOM"
    requirement: PLAT-08
    verification:
      - kind: unit
        ref: "tests/operacoes-maquinas.test.js (8 casos, sem uma linha mudada — git diff --quiet confirmado)"
        status: pass
      - kind: unit
        ref: "tests/integracao-operacoes-maquinas.test.js (3 casos, sem uma linha mudada — git diff --quiet confirmado)"
        status: pass
      - kind: unit
        ref: "tests/kanban-calendario-compartilhados.test.js (6 casos estruturais da fachada)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Calendário consolidado extraído para shared/ sem perder o caso 'combina operações e OS no calendário mensal' (mesma ordem, mesma forma de evento {id, data, origem, titulo})"
    requirement: PLAT-09
    verification:
      - kind: unit
        ref: "tests/operacoes-maquinas.test.js#combina operações e OS no calendário mensal"
        status: pass
    human_judgment: false
  - id: D5
    description: "Não regressão: node --test inteiro verde acima do baseline, refrigeracao/ e mapa/xmap.js intocados, tests/mobile-375.test.js e tests/chrome-icones.test.js sem uma linha mudada"
    requirement: PLAT-16
    verification:
      - kind: unit
        ref: "node --test (1192/1192, baseline 1164)"
        status: pass
      - kind: other
        ref: "git diff --stat tests/operacoes-maquinas.test.js tests/integracao-operacoes-maquinas.test.js tests/mobile-375.test.js tests/chrome-icones.test.js (vazio) + git diff --name-only -- refrigeracao/ mapa/xmap.js (vazio)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Casos backstop do UI-SPEC (375px: uma coluna do kanban + rolagem só dentro de .kanban; título de cartão longo sem truncar; grade do calendário rolando dentro do cartão; evento longo estourando 86px) — conferência visual, não aplicável nesta onda"
    verification: []
    human_judgment: true
    rationale: "Este plano é extração pura (os núcleos já existiam em maquinas/, só mudaram de lugar) — a tela de Máquinas continua exatamente a mesma que já estava em produção antes deste plano, e o CSS que dá cor/layout aos componentes só entra em shared/pmoc.css no plano 13-04. A conferência visual desses casos-limite pertence à mesma janela de UAT que já existia para Máquinas, não é um risco novo introduzido aqui."

# Metrics
duration: 25min
completed: 2026-09-04
status: complete
---

# Phase 13 Plan 03: Kanban e calendário extraídos para shared/ Summary

**`shared/kanban.js` e `shared/calendario.js` — dois núcleos puros genéricos extraídos de `maquinas/`, com `maquinas/operacoes.js` virando módulo ES puro (fachada, sem UMD) e `tests/operacoes-maquinas.test.js`/`tests/integracao-operacoes-maquinas.test.js` passando sem uma linha mudada.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-04T19:40:00Z (aprox., logo após 13-02)
- **Completed:** 2026-09-04T20:05:00Z (aprox., último commit de gate)
- **Tasks:** 3
- **Files modified:** 6 (3 criados, 3 editados)

## Accomplishments

- `shared/kanban.js`: `agruparKanban(itens, colunas, opcoes)` genérico por definição de colunas `[{id, rotulo}]` — item com status fora da lista cai sempre na primeira coluna, preservando ordem de entrada (regra herdada de `agruparOperacoes`); lista de colunas vazia devolve objeto vazio, sem lançar. `htmlKanban(grupos, colunas, opcoes)` devolve a marcação `.kanban-col`/`.kanban-title`/`.kanban-count`/`.empty` idêntica à que `renderOperacoes` já produzia, com `opcoes.cartao` (função do chamador) e `opcoes.vazio` (texto da coluna vazia).
- `shared/calendario.js`: `DIAS_SEMANA`/`MESES` (as duas listas que estavam inline em `renderAgenda`), `gradeMes(ano, mes)` (grade pura, ano/mês fora de faixa devolve grade vazia — mitigação T-13-12), `agruparPorData(eventos)` (descarta data inválida sem lançar), `eventosDoMes(eventos, ano, mes)` (filtro por prefixo de mês + ordenação, extraído de `criarEventosCalendario`), `htmlCalendario(ano, mes, eventos, opcoes)` (marcação `.calendar-*` idêntica, mais a classe nova `hoje` pedida pelo UI-SPEC para o calendário consolidado).
- `maquinas/operacoes.js`: de UMD com lógica própria para módulo ES puro — importa `agruparKanban`/`eventosDoMes` de `shared/`, mantém `STATUS_KANBAN`/`COLUNAS_KANBAN` (definição concreta de Máquinas) e publica `globalThis.OperacoesMaq` para compatibilidade com `maquinas/app.js`. Confirmado que `require('./maquinas/operacoes.js')` continua devolvendo as quatro funções no Node 24.18, sem `package.json` no repositório.
- `maquinas/index.html`: a tag de `/maquinas/operacoes.js` ganhou `type="module"` (mantida antes de `/maquinas/app.js`); as 20 regras-base de CSS de kanban/calendário saíram do `<style>` do módulo (ficam para o plano 13-04, `shared/pmoc.css`, D-10) — a `@media(max-width:600px)` própria de Máquinas e `.ops-actions`/`.section-spaced` permaneceram intocadas.
- `maquinas/app.js`: `renderOperacoes()` e `renderAgenda()` viram aplicadores de DOM puros sobre `htmlKanban`/`htmlCalendario`; o título do mês passa a usar `MESES` importado de `shared/calendario.js`.
- Gate `tests/kanban-calendario-compartilhados.test.js`: 28 casos — 22 de comportamento dos dois núcleos (Tarefa 1) mais 6 de proteção estrutural da fachada (Tarefa 3: imports, ausência de lógica duplicada, `globalThis.OperacoesMaq`, ordem dos `<script>`, `@media` própria, ausência de `overflow:hidden` sobre os contêineres — lição D-8yc-01).
- `tests/operacoes-maquinas.test.js` e `tests/integracao-operacoes-maquinas.test.js` ficam sem uma linha mudada (`git diff --quiet` confirmado) — a prova de que a extração é refatoração, não mudança de comportamento (D-08).
- Suíte completa: 1192/1192, 0 falhas (baseline era 1164 — cresceu em 28). `refrigeracao/` e `mapa/xmap.js` intocados; `shared/pmoc.css` intocado por este plano.

## Task Commits

1. **Tarefa 1 — RED:** `3d687ff` (test) — testes falhos de `shared/kanban.js` e `shared/calendario.js`
2. **Tarefa 1 — GREEN:** `286f2c3` (feat) — `shared/kanban.js` e `shared/calendario.js`
3. **Tarefa 2:** `e60cfde` (feat) — `maquinas/operacoes.js` vira fachada ES, `maquinas/index.html`/`maquinas/app.js` consomem `shared/`
4. **Tarefa 3:** `ca22fb8` (test) — completa o gate com os 6 casos estruturais da fachada

**Plan metadata:** commit desta etapa, a seguir.

_Nota: TDD na Tarefa 1 — o teste foi commitado primeiro (RED, confirmado falho por módulo inexistente), depois a implementação (GREEN, confirmado verde). A Tarefa 2 não é TDD (facade + aplicadores de DOM, protegida pelos gates já existentes)._

## Files Created/Modified

- `shared/kanban.js` — núcleo puro de kanban genérico por definição de colunas
- `shared/calendario.js` — núcleo puro de grade de calendário mensal
- `tests/kanban-calendario-compartilhados.test.js` — gate comportamental + estrutural (28 casos)
- `maquinas/operacoes.js` — UMD → módulo ES puro, fachada sobre `shared/`
- `maquinas/index.html` — tag de `operacoes.js` vira `type="module"`; CSS-base de kanban/calendário removido (migra no 13-04)
- `maquinas/app.js` — `renderOperacoes`/`renderAgenda` viram aplicadores de DOM; dois imports novos

## Decisions Made

- **D-13-03-A confirmada na prática:** o caminho (b) do PATTERNS.md (módulo ES + `type="module"`) foi escolhido, como já decidido no PLAN.md — a alternativa (a) (manter UMD sem importar de `shared/`) deixaria a lógica duplicada, violando GEQ-04 diretamente. A condição de validade (nunca ganhar top-level `await`) foi respeitada e é conferida por grep no próprio critério de aceite da tarefa.
- **`htmlKanban`/`htmlCalendario` recebem funções do chamador (`cartao`, `rotuloEvento`, `classeEvento`) em vez de vocabulário fixo** — é o que permite ao módulo `/gestao` (Onda B) reaproveitar os mesmos núcleos com um vocabulário de origem diferente (estados de `shared/fluxo.js` em vez de `STATUS_KANBAN`; prefixo "Máquinas"/"Refrigeração" em vez de "Operação"/"OS") sem tocar em `shared/kanban.js`/`shared/calendario.js` outra vez.
- **`gradeMes`/`eventosDoMes` recusam ano/mês fora de faixa devolvendo estrutura vazia** — mitigação explícita do T-13-09/T-13-12 do threat model do plano (DoS por entrada fora de faixa), coberta por caso de gate.

## Deviations from Plan

None - plan executado exatamente como escrito. As três tarefas seguiram a ordem e o escopo do PLAN.md; a Tarefa 1 seguiu o ciclo TDD RED→GREEN pedido pelo `tdd="true"` da tarefa, e a Tarefa 3 acrescentou exatamente os casos estruturais que o plano descreveu (imports, ausência de lógica duplicada, publicação global, ordem dos scripts, `@media` própria, lição D-8yc-01 sobre `overflow:hidden`).

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `shared/kanban.js` e `shared/calendario.js` estão prontos para consumo no calendário consolidado e no kanban de ações do `/gestao` (Onda B) — a classe `.hoje` já existe no núcleo, aguardando o CSS do plano 13-04.
- As 20 regras-base de CSS removidas de `maquinas/index.html` (`.kanban`, `.op-*`, `.calendar-*`) precisam entrar em `shared/pmoc.css` no plano 13-04 (D-10) — até lá, a tela de Máquinas desenha kanban e calendário sem estilo próprio (comportamento esperado, não um bug; documentado no comentário deixado no `<style>` do módulo).
- `node --test`: 1192/1192, 0 falhas. `refrigeracao/`, `mapa/xmap.js` e `shared/pmoc.css` intocados desde o início da Fase 13.
- Pronto para `13-04-PLAN.md` (CSS de `.gantt*`/`.kanban*`/`.calendar*`/`.indicador*`/`.grafico*` em `shared/pmoc.css`, a outra metade de D-10).

---
*Phase: 13-gest-o-e-qualidade*
*Completed: 2026-09-04*

## Self-Check: PASSED

- Arquivos criados confirmados em disco: `shared/kanban.js`, `shared/calendario.js`, `tests/kanban-calendario-compartilhados.test.js`, este SUMMARY.
- Commits confirmados em `git log`: `3d687ff`, `286f2c3`, `e60cfde`, `ca22fb8`.
- `node --test`: 1192/1192, 0 falhas (baseline 1164).
- `git diff --quiet HEAD -- tests/operacoes-maquinas.test.js tests/integracao-operacoes-maquinas.test.js`: exit 0 (D-08).
- `git diff --name-only -- refrigeracao/ mapa/xmap.js`: vazio.
