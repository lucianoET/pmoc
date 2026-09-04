---
phase: 13-gest-o-e-qualidade
plan: 04
subsystem: ui
tags: [css, design-system, gestao-a-vista, gantt, kanban, calendario, svg]

# Dependency graph
requires:
  - phase: 13-gest-o-e-qualidade (planos 13-01, 13-02, 13-03)
    provides: os sete núcleos puros (shared/grafico.js, shared/indicadores.js, shared/gantt.js, shared/abc.js, shared/kanban.js, shared/calendario.js, shared/gut.js) e a extração de Máquinas que deixou o CSS de kanban/calendário fora do módulo
provides:
  - único bloco de CSS em shared/pmoc.css que resolve todas as classes emitidas pelos sete núcleos da Onda A
  - as 20 regras-base de kanban/calendário migradas byte a byte de maquinas/index.html
  - gate permanente (tests/estilos-gestao-compartilhados.test.js) que prova cobertura de classe, ausência de cor literal e tokens intocados
affects: [13-05, 13-06, 13-07, gestao (Onda B), painéis de Máquinas/Transportes (Onda C)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS de componente compartilhado vive só em shared/pmoc.css, nunca dentro de um módulo (D-10, mesmo precedente de .pilula/.regua)"
    - "tom semântico (neutro/info/ok/warn/erro, mais accent onde reservado) resolvido pela folha via classe -tom-{x}, nunca cor escrita em JavaScript"

key-files:
  created:
    - tests/estilos-gestao-compartilhados.test.js
  modified:
    - shared/pmoc.css

key-decisions:
  - "As 20 regras de kanban/calendário migraram idênticas — mesmo valor, mesmo token, mesma medida — porque é extração, não redesenho"
  - ".grafico define height:140px uma única vez no arquivo; .grafico-sparkline sobrescreve para 32px por ordem de cascata (mesma especificidade, declarada depois) — evita duplicar o literal 140px"
  - "Gantt não usa position:sticky: .gantt-rotulos e .gantt-linhas são colunas irmãs de uma grade CSS de duas faixas, não um cabeçalho dentro do mesmo contêiner que rola — a coluna de rótulos fica fixa por estrutura, não por um mecanismo que poderia repetir a armadilha de D-8yc-01"
  - "Curva ABC usa classes próprias (.abc-classe-a/b/c) fora do vocabulário de 5 tons — accent/info/neutro — porque é classificação de valor, não alerta (UI-SPEC, seção Color)"

requirements-completed: [GEQ-01, GEQ-02, GEQ-03, GEQ-04, PLAT-16]

coverage:
  - id: D1
    description: "As 20 regras-base de kanban/calendário migram de maquinas/index.html para shared/pmoc.css, byte a byte iguais, mais a classe .calendar-day.hoje"
    requirement: "GEQ-04"
    verification:
      - kind: unit
        ref: "tests/estilos-gestao-compartilhados.test.js#as classes migradas de maquinas/index.html chegam com pelo menos 19 seletores distintos"
        status: pass
      - kind: unit
        ref: "tests/tema-superficies.test.js"
        status: pass
      - kind: unit
        ref: "tests/mobile-375.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "CSS novo para gráfico (6 tons incl. accent), indicador (5 tons, casca .kpi), Gantt (grade de 2 faixas, 5 tons, marca de hoje) e curva ABC (classes A/B/C) — sem token de cor novo, sem cor literal"
    requirement: "GEQ-01"
    verification:
      - kind: unit
        ref: "tests/estilos-gestao-compartilhados.test.js#toda classe emitida pelos núcleos da Onda A tem regra em shared/pmoc.css"
        status: pass
      - kind: unit
        ref: "tests/estilos-gestao-compartilhados.test.js#nenhuma regra nova usa cor literal"
        status: pass
      - kind: unit
        ref: "tests/estilos-gestao-compartilhados.test.js#os tokens declarados no :root são exatamente os que já existiam"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gate permanente prova que nenhum contêiner de Gantt/kanban/calendário recorta conteúdo e que o alvo de toque de 44px continua na @media de 480px"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "tests/estilos-gestao-compartilhados.test.js#nenhum contêiner de Gantt, kanban ou calendário declara recorte de conteúdo"
        status: pass
      - kind: unit
        ref: "tests/estilos-gestao-compartilhados.test.js#a @media de 480px continua com o alvo de toque de 44px"
        status: pass
    human_judgment: false
  - id: D4
    description: "Verificação visual real das telas de Máquinas (kanban/calendário) e de um consumidor de gráfico/indicador/Gantt/ABC — os testes provam texto de CSS, não pixel renderizado"
    verification: []
    human_judgment: true
    rationale: "Este plano só escreve a folha de estilo; nenhum consumidor novo (painel, /gestao) foi ligado ainda nesta fase — a verificação visual de fato só é possível quando as Ondas B/C consumirem estas classes em tela."

# Metrics
duration: 18min
completed: 2026-09-04
status: complete
---

# Phase 13 Plan 04: CSS compartilhado de gestão à vista Summary

**Único bloco novo em `shared/pmoc.css` que dá cor, medida e espaçamento aos sete núcleos puros da Onda A (kanban, calendário, gráfico, indicador, Gantt, curva ABC), incluindo a migração byte a byte das 20 regras que saíam de `maquinas/index.html`.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-04T16:35:00-03:00
- **Completed:** 2026-09-04T16:53:00-03:00
- **Tasks:** 3
- **Files modified:** 2 (1 modificado, 1 criado)

## Accomplishments
- As 20 regras-base de `.kanban`/`.op-*`/`.calendar-*` migraram de `maquinas/index.html` para `shared/pmoc.css`, idênticas — mesmo valor, mesmo token, mesma medida — mais a classe nova `.calendar-day.hoje` (borda de 1px em `var(--accent)`)
- 48 classes novas cobrem `shared/grafico.js` (SVG em `currentColor`, 6 tons incluindo `accent` reservado à linha acumulada do Pareto e ao ponto do sparkline), `shared/indicadores.js` (casca `.kpi` com borda esquerda de 3px por tom), `shared/gantt.js` (grade CSS de duas faixas, marca de "hoje" em accent) e `shared/abc.js` (classes A/B/C fora da escala de 5 tons semânticos)
- Gate permanente `tests/estilos-gestao-compartilhados.test.js` (9 casos) prova cobertura de classe contra a lista fechada do plano, ausência de cor literal, tokens de `:root` intocados, os tons corretos por componente e ausência de recorte de conteúdo nos três contêineres de rolagem
- `node --test` sobe de 1192 para 1201 testes, 0 falhas

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: migrar as regras de kanban e calendário para a folha comum** - `002aefc` (feat)
2. **Tarefa 2: escrever as classes novas de gráfico, indicador, Gantt e curva ABC** - `bf2d936` (feat)
3. **Tarefa 3: gate da folha comum** - `a1e2211` (test)

**Plan metadata:** committed alongside this SUMMARY

## Files Created/Modified
- `shared/pmoc.css` - bloco novo (109 linhas acrescentadas, 0 removidas): 20 regras migradas de kanban/calendário + `.calendar-day.hoje` + 48 classes novas de gráfico/indicador/Gantt/ABC
- `tests/estilos-gestao-compartilhados.test.js` - gate permanente, lê só `shared/pmoc.css`, 9 casos

## Decisions Made
- `.grafico{height:140px}` aparece uma única vez no arquivo; `.grafico-sparkline{height:32px}` vem depois com a mesma especificidade e vence por ordem de cascata — evita duplicar o literal `140px` e ainda assim dá ao sparkline a altura menor que ele sempre teve (32px, sem eixo)
- Gantt não usa `position:sticky` para a coluna de rótulos: `.gantt-rotulos` e `.gantt-linhas` são colunas irmãs de uma grade CSS de duas faixas (`grid-template-columns:160px 1fr`), não um cabeçalho dentro do mesmo contêiner que rola — a coluna fica fixa por estrutura (está fora do elemento que tem `overflow-x:auto`), sem repetir o mecanismo que causou a armadilha de recorte em D-8yc-01
- Curva ABC ganhou classes próprias (`.abc-classe-a/b/c`) em vez de reaproveitar `.pilula-{tom}`: é classificação de valor, não alerta, e o UI-SPEC reserva um mapeamento próprio (A→accent, B→info, C→neutro) deliberadamente fora da escala de 5 tons semânticos
- O gate de "nenhum token de cor novo" compara a lista de tokens declarados em `:root` contra uma lista travada no próprio teste (15 tokens), em vez de tentar reconstituir um "antes" que o arquivo de teste não tem como conhecer sozinho — mesmo raciocínio de outros gates de decisão travada do projeto (`tests/mapa-decisoes.test.js`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `shared/pmoc.css` agora resolve todas as classes que os sete núcleos da Onda A emitem — os planos seguintes da fase (adoção em Máquinas/Predial, e futuramente as Ondas B/C) podem consumir `shared/grafico.js`/`shared/indicadores.js`/`shared/gantt.js`/`shared/abc.js` sem escrever CSS próprio
- Nenhum consumidor novo foi ligado em tela nesta plano — a verificação visual real (D4 no bloco de cobertura) fica para quando um painel de fato desenhar um gráfico/indicador/Gantt/curva ABC
- `tests/tema-superficies.test.js` e `tests/mobile-375.test.js` seguem intocados e verdes, confirmando que a migração não introduziu token de cor por módulo nem quebrou a `@media` própria de Máquinas

---
*Phase: 13-gest-o-e-qualidade*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: shared/pmoc.css
- FOUND: tests/estilos-gestao-compartilhados.test.js
- FOUND: commit 002aefc (Tarefa 1)
- FOUND: commit bf2d936 (Tarefa 2)
- FOUND: commit a1e2211 (Tarefa 3)
- `node --test`: 1201 tests, 0 failures (baseline 1192)
- `git diff --numstat` shared/pmoc.css across the three task commits: 109 insertions, 0 deletions
- `tests/tema-superficies.test.js` and `tests/mobile-375.test.js`: green
