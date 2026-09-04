---
phase: 13-gest-o-e-qualidade
plan: 01
subsystem: ui
tags: [svg, kpi, spc, carta-de-controle, pareto, node-test]

# Dependency graph
requires: []
provides:
  - "shared/grafico.js — núcleo puro SVG (barras, linha, Pareto, limitesControle, cartaControle, sparkline)"
  - "shared/indicadores.js — núcleo puro (avaliar, tendencia, cartaoIndicador)"
  - "Gates tests/grafico-compartilhado.test.js e tests/indicadores-compartilhados.test.js"
affects: [13-02, 13-03, 13-04, gestao-onda-b, painéis-máquinas-transportes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SVG inline escrito à mão, currentColor + classe grafico-tom-{tom} — sem biblioteca de gráfico (D-13-01)"
    - "Carta de controle de indivíduos (X-mR): LSC/LIC derivados da amplitude móvel entre pontos consecutivos, não do desvio-padrão bruto"
    - "Definição de indicador sempre parâmetro ({id,rotulo,unidade,meta,sentido,faixas}) — nenhum nome concreto de indicador no núcleo"

key-files:
  created:
    - shared/grafico.js
    - shared/indicadores.js
    - tests/grafico-compartilhado.test.js
    - tests/indicadores-compartilhados.test.js
  modified: []

key-decisions:
  - "limitesControle() usa o método de carta de indivíduos (X-mR — amplitude móvel média × 3/1.128) em vez de desvio-padrão da série bruta; é o que reproduz o caso do plano ([2,2,2,2,10] → só o índice 4 fora dos limites)"
  - "faixas (fração da meta) define uma zona de atenção espelhada em torno da meta: [meta*faixas, meta) para sentido 'maior', (meta, meta*(2-faixas)] para sentido 'menor'"
  - "sparkline() aceita opcoes.tom; sem tom informado usa 'accent' (Pareto/sparkline avulso), mas cartaoIndicador() sempre passa o próprio tom do indicador (ok/warn/erro), sobrescrevendo o padrão"
  - "TONS e esc() replicados em cada arquivo (não importados de shared/componentes.js), por instrução explícita do CONTEXT — módulos ficam autocontidos, sem acoplamento adicional"

patterns-established:
  - "Cabeçalho-ensaio de três parágrafos numerados (por que existe / o que não faz / regra de tom) — mesmo formato de shared/componentes.js e shared/icones.js, agora usado por dois núcleos de gráfico/indicador"

requirements-completed: [GEQ-01, GEQ-02]

coverage:
  - id: D1
    description: "shared/grafico.js: barras, linha, Pareto, carta de controle (limitesControle/cartaControle) e sparkline, todos núcleos puros sem cor em JavaScript"
    requirement: GEQ-01
    verification:
      - kind: unit
        ref: "tests/grafico-compartilhado.test.js (23 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "shared/indicadores.js: avaliar (meta/sentido/faixas), tendencia e cartaoIndicador, consumindo sparkline() de shared/grafico.js"
    requirement: GEQ-02
    verification:
      - kind: unit
        ref: "tests/indicadores-compartilhados.test.js (15 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Casos-limite backstop do UI-SPEC (rótulo longo no eixo do Pareto, rótulo longo no cartão de indicador, ambos em 375px) — não aplicável nesta onda porque nenhuma tela consome os núcleos ainda"
    verification: []
    human_judgment: true
    rationale: "Este plano não injeta nada em tela (objetivo explícito: 'nenhuma tela alterada'). A conferência visual de quebra/abreviação de texto longo só é possível quando um consumidor real (Onda B/C) desenhar esses núcleos numa página — fica registrada aqui para não ser esquecida quando esse consumidor existir."

# Metrics
duration: 20min
completed: 2026-09-04
status: complete
---

# Phase 13 Plan 01: Núcleos de gráfico e indicador (Onda A) Summary

**`shared/grafico.js` (barras/linha/Pareto/carta de controle X-mR/sparkline) e `shared/indicadores.js` (avaliar/tendência/cartão de KPI), dois núcleos puros SVG/HTML, cada um com gate próprio de 23 e 15 casos em Node — nenhuma tela tocada.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-04T19:19:00Z (aprox., primeiro commit RED)
- **Completed:** 2026-09-04T19:21:28Z (último commit de gate)
- **Tasks:** 3
- **Files modified:** 4 (todos criados)

## Accomplishments

- `shared/grafico.js`: seis funções puras (`barras`, `linha`, `pareto`, `limitesControle`, `cartaControle`, `sparkline`) devolvendo SVG inline em `currentColor`, com tom semântico resolvido por classe (`grafico-tom-{tom}`), estado vazio único ("Sem dado"), descarte contado de valor não numérico e rótulos de eixo limitados a 6.
- `limitesControle()` implementa a carta de indivíduos (X-mR): média das amplitudes móveis entre pontos consecutivos estima o desvio do processo — método que produz o resultado esperado no caso de exemplo do plano (`[2,2,2,2,10]` → só o índice 4 fora dos limites; um desvio-padrão simples da série bruta não teria marcado esse ponto).
- `shared/indicadores.js`: `avaliar(valor, def)` respeita `sentido: 'maior'|'menor'` (o caso onde inverter a regra é fácil de errar — testado explicitamente), `tendencia(serie)` exige ao menos dois pontos, e `cartaoIndicador()` importa `sparkline()` de `grafico.js` — o cartão e o painel desenham a mesma série pela mesma função.
- Dois gates comportamentais em Node (nunca regex sobre o texto do arquivo): 23 casos em `tests/grafico-compartilhado.test.js`, 15 em `tests/indicadores-compartilhados.test.js`. Suíte completa: 1133/1133, 0 falhas (baseline era 1095 — cresceu em 38).
- Ciclo RED-GREEN seguido nas Tarefas 1 e 2: cada teste foi commitado primeiro (confirmado falho por módulo inexistente), depois a implementação (confirmado verde).

## Task Commits

Cada tarefa gerou dois ou três commits (padrão TDD):

1. **Tarefa 1 — RED:** `e1fa578` (test) — teste falho de `shared/grafico.js`
2. **Tarefa 1 — GREEN:** `600f660` (feat) — implementação de `shared/grafico.js`
3. **Tarefa 2 — RED:** `feebe60` (test) — teste falho de `shared/indicadores.js`
4. **Tarefa 2 — GREEN:** `1bbd354` (feat) — implementação de `shared/indicadores.js`
5. **Tarefa 3:** `c8a0dc2` (test) — completa a cobertura dos dois gates contra os `must_haves` do UI-SPEC (aria-label de máx/mín/último, limite de 6 rótulos de eixo) e confirma a suíte completa

**Plan metadata:** commit desta etapa, a seguir.

_Nota: TDD — cada núcleo teve o teste commitado (RED, confirmado falho fora do módulo) antes da implementação (GREEN)._

## Files Created/Modified

- `shared/grafico.js` — seis funções puras de gráfico SVG
- `shared/indicadores.js` — avaliação por meta, tendência e cartão de indicador
- `tests/grafico-compartilhado.test.js` — gate comportamental (23 casos)
- `tests/indicadores-compartilhados.test.js` — gate comportamental (15 casos)

## Decisions Made

- **Método de carta de controle:** X-mR (amplitude móvel) em vez de desvio-padrão bruto da série — é o único método consistente com o caso de exemplo do plano (`[2,2,2,2,10]`). Documentado no cabeçalho de `limitesControle()`.
- **Faixas de atenção espelhadas em torno da meta:** para `sentido:'maior'`, a zona de atenção é `[meta*faixas, meta)`; para `sentido:'menor'`, é `(meta, meta*(2-faixas)]` — construção simétrica em vez de uma divisão assimétrica, mais fácil de raciocinar e testar nos dois sentidos.
- **TONS/esc() replicados, não importados** de `shared/componentes.js` — seguindo a opção explícita do CONTEXT ("replique-as neste arquivo ou importe — a escolha é sua"); mantém os dois núcleos autocontidos.
- **`sparkline()` aceita `opcoes.tom`** com padrão `'accent'` — o Pareto e um sparkline avulso usam accent (leitura secundária), mas `cartaoIndicador()` sempre passa o tom do próprio indicador, sobrescrevendo o padrão para casar com o semáforo do cartão.

## Deviations from Plan

None - plan executado exatamente como escrito. As duas tarefas TDD (1 e 2) produziram um commit de teste a mais do que o mínimo "test→feat" ao antecipar, durante o ciclo RED, os casos que a Tarefa 3 exigiria (sentido invertido, escape de rótulo, estado vazio, ponto único) — isso não é desvio de escopo, é a mesma cobertura pedida pela Tarefa 3 chegando mais cedo. A Tarefa 3 completou com dois casos que ainda faltavam (aria-label de máximo/mínimo/último; limite de 6 rótulos de eixo) e confirmou a suíte inteira.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `shared/grafico.js` e `shared/indicadores.js` estão prontos para consumo nas Ondas B (`/gestao`) e C (painéis de Máquinas/Transportes) — nenhuma tela os usa ainda, por objetivo explícito deste plano.
- As classes CSS emitidas (`grafico-*`, `indicador-*`) aguardam o plano 13-04, que escreve `shared/pmoc.css` — sem esse CSS os componentes desenham sem cor nenhuma (comportamento esperado até lá, não um bug).
- Os dois casos backstop de texto longo em 375px (D3 no coverage) só poderão ser conferidos visualmente quando um consumidor real existir — registrados para não serem esquecidos.
- `node --test`: 1133/1133, 0 falhas. `refrigeracao/` e `mapa/xmap.js` intocados.

---
*Phase: 13-gest-o-e-qualidade*
*Completed: 2026-09-04*

## Self-Check: PASSED

- Arquivos criados confirmados em disco: `shared/grafico.js`, `shared/indicadores.js`, `tests/grafico-compartilhado.test.js`, `tests/indicadores-compartilhados.test.js`, este SUMMARY.
- Commits confirmados em `git log`: `e1fa578`, `600f660`, `feebe60`, `1bbd354`, `c8a0dc2`.
- `node --test`: 1133/1133, 0 falhas (baseline 1095).
