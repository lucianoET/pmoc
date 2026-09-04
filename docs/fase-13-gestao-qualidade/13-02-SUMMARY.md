---
phase: 13-gest-o-e-qualidade
plan: 02
subsystem: ui
tags: [css-grid, pareto, gut, node-test]

# Dependency graph
requires:
  - phase: 13-gest-o-e-qualidade (plano 01)
    provides: "shared/componentes.js#vazio() reaproveitado pelo Gantt vazio"
provides:
  - "shared/gantt.js — núcleo puro CSS grid (linhasGantt/htmlGantt), posição sempre em porcentagem de dias ISO"
  - "shared/abc.js — núcleo puro (classificarAbc), curva ABC genérica por acessor de valor"
  - "shared/gut.js — GUT_ESCALA/classificarGut/gutTotal/rotuloGut, extraído de predial/dominio.js"
  - "predial/dominio.js reexportando GUT de shared/gut.js sem cópia local"
  - "Gates tests/gantt-compartilhado.test.js, tests/abc-compartilhado.test.js, tests/gut-compartilhado.test.js"
affects: [13-03, 13-04, gestao-onda-b, painéis-máquinas-transportes, estoque-maquinas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gantt em CSS grid, sem canvas: posição por diferença de dias entre datas ISO AAAA-MM-DD, nunca pixel fixo"
    - "Curva ABC classifica pelo acumulado ANTES de somar o próprio item (não depois) — é o que faz um item único fechar em 100% e continuar em A"
    - "esc()/vazio() de shared/componentes.js: vazio() importado, esc() replicado (mesmo padrão de shared/grafico.js/indicadores.js)"

key-files:
  created:
    - shared/gantt.js
    - shared/abc.js
    - shared/gut.js
    - tests/gantt-compartilhado.test.js
    - tests/abc-compartilhado.test.js
    - tests/gut-compartilhado.test.js
  modified:
    - predial/dominio.js

key-decisions:
  - "classificarAbc() usa o acumulado ANTES de somar o item corrente para decidir a classe (não o acumulado depois) — só assim um item único, ou um item desproporcionalmente grande, permanece em A mesmo fechando em 100% (>95%); o corte pertence a quem cruza a fronteira, não ao primeiro item que a ultrapassa"
  - "linhasGantt() valida AAAA-MM-DD por componente (ano/mês/dia via Date.UTC e comparação de round-trip) em vez de confiar no parser nativo de Date, que rola datas inválidas (31/09) para o mês seguinte em vez de recusar"
  - "Item sem fim usa hoje como fim efetivo e é clipado ao intervalo pedido como qualquer outro item — se hoje cai fora do intervalo, a barra aberta termina na borda do intervalo, não em um ponto fora da grade"
  - "gutTotal() e classificarGut() tratam null/undefined/valor fora de GUT_ESCALA como 'não avaliado', nunca como total parcial — mesma regra de null≠0 já usada nos atributos técnicos de /refrigeracao (D-500-02)"
  - "esc() é replicado dentro de shared/gantt.js (não importado de shared/componentes.js), mesmo padrão que shared/grafico.js/indicadores.js já estabeleceram; vazio() é importado porque já é a peça pronta que os dois núcleos anteriores não precisavam (nenhum tinha estado 'vazio' com HTML de componentes.js)"

patterns-established:
  - "Cabeçalho-ensaio de três parágrafos numerados, agora usado por shared/gut.js e shared/gantt.js/abc.js — quarto e quinto núcleos a seguir o formato de shared/componentes.js"

requirements-completed: [GEQ-03, GEQ-05]

coverage:
  - id: D1
    description: "shared/gantt.js: linhasGantt()/htmlGantt() em CSS grid, item sem fim usa hoje (aberto:true), intervalo degenerado e item de um dia sem divisão por zero, item recortado no início, item fora do intervalo descartado e contado em ignorados"
    requirement: GEQ-03
    verification:
      - kind: unit
        ref: "tests/gantt-compartilhado.test.js (11 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "shared/gut.js: GUT_ESCALA/classificarGut/gutTotal/rotuloGut extraídos de predial/dominio.js sem mudar as seis fronteiras numéricas do legado; predial/dominio.js passa a reexportar"
    requirement: GEQ-05
    verification:
      - kind: unit
        ref: "tests/gut-compartilhado.test.js (11 casos) + tests/predial-dominio.test.js (intocado, 7 casos, verde)"
        status: pass
    human_judgment: false
  - id: D3
    description: "shared/abc.js: classificarAbc() genérico por acessor de valor — ordenação decrescente, acumulado fechando em 100, fronteira exata dos cortes, item não numérico em C, item único em A, total zero sem divisão por zero"
    verification:
      - kind: unit
        ref: "tests/abc-compartilhado.test.js (9 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Casos backstop do UI-SPEC (rolagem da área de barras com coluna sticky, nome de ação longo sem ellipsis, nome de material longo com title) — não aplicável nesta onda porque nenhuma tela consome os núcleos ainda"
    verification: []
    human_judgment: true
    rationale: "Este plano não injeta nada em tela (mesmo objetivo explícito do plano 13-01: núcleos puros, sem consumidor). A conferência visual desses casos só é possível quando um consumidor real (Onda B, /gestao Ações/Ferramentas) desenhar shared/gantt.js/shared/abc.js numa página — registrado para não ser esquecido."

# Metrics
duration: 12min
completed: 2026-09-04
status: complete
---

# Phase 13 Plan 02: Gantt, curva ABC e extração do GUT (Onda A) Summary

**`shared/gantt.js` (linha do tempo em CSS grid, sem canvas), `shared/abc.js` (curva ABC genérica) e `shared/gut.js` (matriz GUT extraída de `predial/dominio.js`, que agora reexporta) — três núcleos puros novos, 31 casos de teste, `tests/predial-dominio.test.js` sem uma linha mudada.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-04T19:22:44Z (aprox., logo após 13-01)
- **Completed:** 2026-09-04T19:34:00Z (aprox., último commit de gate)
- **Tasks:** 3
- **Files modified:** 7 (6 criados, 1 editado)

## Accomplishments

- `shared/gantt.js`: `linhasGantt(itens, opcoes)` calcula `inicioPct`/`larguraPct` por diferença de dias ISO (nunca pixel fixo); item sem `fim` usa hoje e leva `aberto:true`; intervalo degenerado (início=fim) e item de um único dia nunca dividem por zero; item que começa antes do intervalo é recortado com `inicioPct:0`; item inteiramente fora é descartado e contado em `ignorados`; `htmlGantt()` reaproveita `vazio()` de `shared/componentes.js` para a lista vazia e escapa o rótulo do item.
- `shared/abc.js`: `classificarAbc(itens, campoValor, cortes)` genérico por acessor de valor (função ou nome de campo, nunca um nome de coluna escrito no núcleo); classifica pelo acumulado ANTES de somar o próprio item — é o que faz um item único, mesmo fechando em 100%, permanecer em classe A; valor não numérico entra como 0; total zero não divide por zero (todas as linhas em C, acumulado 0); cortes fora de ordem ou fora de 0..1 caem no padrão `[0.8, 0.95]`.
- `shared/gut.js`: `GUT_ESCALA`, `classificarGut` (as seis fronteiras numéricas idênticas ao legado: 0/100→ok, 101/400→atenção, 401/1000→crítico) e dois acréscimos — `gutTotal(g,u,t)` (null quando qualquer dimensão falta ou está fora da escala) e `rotuloGut(total)` ("Não avaliado" para null, senão o rótulo de uma palavra da faixa). `predial/dominio.js` passa a reexportar as três funções em vez de declará-las — mesmo precedente já usado para `montarArvore`/`linhasVisiveis` de `shared/arvore.js` no mesmo arquivo.
- `tests/predial-dominio.test.js` e `predial/app.js` ficam sem uma linha mudada (critério 3 do ROADMAP) — confirmado por `git diff --stat` vazio nos dois.
- Três gates novos em Node puro (nunca regex sobre o texto do arquivo): 11 casos em `tests/gantt-compartilhado.test.js`, 11 em `tests/gut-compartilhado.test.js`, 9 em `tests/abc-compartilhado.test.js`. Suíte completa: 1164/1164, 0 falhas (baseline era 1133 — cresceu em 31).
- Ciclo RED-GREEN seguido nas Tarefas 1 e 2: cada teste foi commitado primeiro (confirmado falho por módulo inexistente), depois a implementação (confirmado verde).

## Task Commits

Cada tarefa TDD gerou dois commits (teste falho → implementação); a Tarefa 3 é um commit de teste:

1. **Tarefa 1 — RED:** `c6c4a99` (test) — teste falho de `shared/gut.js`
2. **Tarefa 1 — GREEN:** `a636998` (feat) — `shared/gut.js` + reexport em `predial/dominio.js`
3. **Tarefa 2 — RED:** `85e2233` (test) — testes falhos de `shared/gantt.js` e `shared/abc.js`
4. **Tarefa 2 — GREEN:** `b73d9bb` (feat) — `shared/gantt.js` + `shared/abc.js`
5. **Tarefa 3:** `0a3db75` (test) — completa a cobertura dos três gates (distinção 0≠null em GUT, dimensão não numérica, fronteira exata dos cortes em ABC) e confirma a suíte completa

**Plan metadata:** commit desta etapa, a seguir.

_Nota: TDD — cada núcleo teve o teste commitado (RED, confirmado falho fora do módulo) antes da implementação (GREEN)._

## Files Created/Modified

- `shared/gantt.js` — núcleo puro de Gantt em CSS grid
- `shared/abc.js` — núcleo puro de curva ABC
- `shared/gut.js` — núcleo puro da matriz GUT
- `predial/dominio.js` — GUT_ESCALA/classificarGut/gutTotal substituídos por reexport de `../shared/gut.js`
- `tests/gantt-compartilhado.test.js` — gate comportamental (11 casos)
- `tests/abc-compartilhado.test.js` — gate comportamental (9 casos)
- `tests/gut-compartilhado.test.js` — gate comportamental (11 casos)

## Decisions Made

- **Classe ABC pelo acumulado ANTES do item, não depois:** a alternativa óbvia (classificar pelo acumulado já incluindo o item) classificaria um item único como C, porque seu próprio acumulado fecha em 100% (>95%) — o que contradiz o requisito explícito do plano ("1 item → tudo A, comportamento matemático correto"). Usar o acumulado antes de somar resolve isso sem caso especial: o corte pertence a quem cruza a fronteira, não a quem primeiro a ultrapassa.
- **Validação de data por componente, não por round-trip de string:** `new Date('2026-09-31T00:00:00Z')` não lança e rola para outubro em vez de recusar; `paraData()` decompõe ano/mês/dia, reconstrói via `Date.UTC` e compara os componentes de volta — datas como 31/09 ou 29/02 fora de ano bissexto são recusadas, entrando em `ignorados` em vez de desenhar uma barra na posição errada.
- **`esc()` replicado, `vazio()` importado:** seguindo o precedente já registrado no 13-01-SUMMARY.md (TONS/esc replicados em `shared/grafico.js`/`shared/indicadores.js` para manter cada núcleo autocontido), `shared/gantt.js` replica sua própria `esc()`. `vazio()`, por outro lado, é importado de `shared/componentes.js` — é a peça de estado vazio já pronta e com os textos que o UI-SPEC pede; replicá-la duplicaria uma função inteira (não uma linha de regex) sem ganho.
- **`GEQ-07` marcado como parcial, não completo:** o requisito cobre Pareto, Ishikawa, PDCA, carta de controle, curva ABC e checklist 5S — este plano entrega só a curva ABC (Pareto/carta de controle já vieram do 13-01; Ishikawa/PDCA/5S são Onda B). Seguindo a convenção já registrada no projeto ("não marcado completo por presunção" — ver histórico de PLAT-04/PLAT-19 em STATE.md), `GEQ-07` **não** foi marcado `[x]` em REQUIREMENTS.md nesta etapa; apenas `GEQ-03` e `GEQ-05`, que este plano entrega por inteiro.

## Deviations from Plan

None - plan executado exatamente como escrito. As duas tarefas TDD (1 e 2) produziram exatamente o ciclo test→feat mínimo; a Tarefa 3 acrescentou 3 casos que ainda faltavam (distinção 0≠null em GUT, dimensão não numérica em `gutTotal`, fronteira exata dos cortes em ABC) e confirmou a suíte inteira — igual ao padrão já usado no 13-01.

A única decisão que vale registrar como interpretação (não desvio): `requirements: [GEQ-03, GEQ-05, GEQ-07]` no frontmatter do plano foi copiado integralmente para `requirements-completed` deste SUMMARY (obrigação do workflow), mas o passo de `requirements.mark-complete` só marcou `[x]` GEQ-03 e GEQ-05 em REQUIREMENTS.md — GEQ-07 fica pendente porque este plano entrega apenas uma parte dele (curva ABC), documentado acima em Decisions Made.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `shared/gantt.js`, `shared/abc.js` e `shared/gut.js` estão prontos para consumo nas Ondas B (`/gestao`) e C (Estoque de Máquinas, no caso da curva ABC) — nenhuma tela os usa ainda, por objetivo explícito desta onda.
- As classes CSS emitidas por `htmlGantt` (`gantt-*`) aguardam o plano 13-04, que escreve `shared/pmoc.css` — sem esse CSS o Gantt desenha sem cor nenhuma (esperado até lá).
- `shared/abc.js` não desenha HTML (por decisão do plano) — o plano 13-04/Onda B ainda precisa decidir como a barra + pílula de classe são montadas a partir de `{linhas, total}`, reaproveitando `pilula()` de `shared/componentes.js`.
- Os casos backstop de rolagem/texto longo em 375px (D4 no coverage) só poderão ser conferidos visualmente quando um consumidor real existir — registrados para não serem esquecidos.
- `node --test`: 1164/1164, 0 falhas. `refrigeracao/`, `mapa/xmap.js` e `shared/pmoc.css` intocados desde o início da Fase 13.
- Pronto para `13-03-PLAN.md` (próximo plano da Onda A, se houver) ou para a extração de Máquinas/Predial (`shared/kanban.js`, `shared/calendario.js`, D-06/D-07).

---
*Phase: 13-gest-o-e-qualidade*
*Completed: 2026-09-04*

## Self-Check: PASSED

- Arquivos criados confirmados em disco: `shared/gantt.js`, `shared/abc.js`, `shared/gut.js`, `tests/gantt-compartilhado.test.js`, `tests/abc-compartilhado.test.js`, `tests/gut-compartilhado.test.js`, este SUMMARY.
- Commits confirmados em `git log`: `c6c4a99`, `a636998`, `85e2233`, `b73d9bb`, `0a3db75`.
- `node --test`: 1164/1164, 0 falhas (baseline 1133).
- `git diff --stat tests/predial-dominio.test.js` e `git diff --stat predial/app.js`: ambos vazios.
