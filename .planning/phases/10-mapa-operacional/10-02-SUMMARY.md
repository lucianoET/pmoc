---
phase: 10-mapa-operacional
plan: 02
subsystem: frontend
tags: [pure-core, node-test, leaflet, geodesy, rbac-vocabulary]

requires:
  - phase: 10-mapa-operacional plan 01
    provides: "maq_areas.geom/flora/inclinacao/limpeza e lat/lon nas seis tabelas de posição (migração 25), com as mesmas listas fechadas e o mesmo envelope geográfico que este plano duplica no cliente"
provides:
  - "mapa/mapa-geometria.js — núcleo puro do módulo mapa: calcAreaM2 (portada e medida), calcCompatCliente (portada), normalizarCategoria + maquinasParaZona (normalização de vocabulário que faltava no legado), normalizarFlora/Inclinacao/Limpeza, dentroDoEnvelope, resolverPosicao, linkDoModulo"
  - "Suposição A2 da pesquisa (correção da fórmula de área) fechada por medição, não por leitura"
  - "Pitfall 1 da pesquisa (vocabulário de categoria não bate) resolvido e coberto por teste com as categorias reais do inventário"
  - "D-01 e D-04 (decisões travadas da Fase 10) viram gate automatizado permanente"
affects: [10-05, 10-06, 10-07]

tech-stack:
  added: []
  patterns:
    - "Núcleo puro / aplicador de navegador — mesma divisão de shared/tema.js, replicada para mapa/mapa-geometria.js"
    - "Decisão de exclusão de escopo vira teste, não comentário — mesmo padrão de tests/tema-superficies.test.js, replicado em tests/mapa-decisoes.test.js com varredura dinâmica (readdirSync) em vez de lista fixa de arquivos"

key-files:
  created:
    - mapa/mapa-geometria.js
    - tests/mapa-geometria.test.js
    - tests/mapa-decisoes.test.js
  modified: []

key-decisions:
  - "calcAreaM2 e calcCompatCliente portadas byte-a-byte do legado (DEV_ERP/cmms-mapa/admin.html), incluindo o ternário redundante do ramo 'acentuado' — a decisão de portar, não reescrever, se aplica também a quirks sem efeito prático, não só à fórmula"
  - "VOCABULARIO_REGRA (interno) fixado em três termos (cortador_grama, roçadeira, motosserra) — o universo real de saídas possíveis de calcCompatCliente — em vez dos 'quatro termos' mencionados na prosa do plano, que na leitura mais provável se refere às quatro categorias do inventário, não ao tamanho do vocabulário da regra; nenhum gate automatizado do plano afirma o número quatro, então a implementação segue a semântica correta (ver Deviations)"
  - "resolverPosicao aceita local ausente/nulo via optional chaining, sem checagem explícita — mais curto e igualmente seguro, já que dentroDoEnvelope(undefined, undefined) já devolve false"

requirements-completed: [PLAT-18, PLAT-13, PLAT-16]

coverage:
  - id: D1
    description: "Núcleo puro mapa/mapa-geometria.js existe, sem nenhuma API de navegador nem Leaflet, e importa dentro do Node sem lançar"
    requirement: "PLAT-18"
    verification:
      - kind: unit
        ref: "tests/mapa-geometria.test.js#importar o módulo dentro do Node, sem nenhuma API de navegador disponível, não lança"
        status: pass
      - kind: other
        ref: "gate estático da Task 1 — grep de document./window./localStorage/matchMedia(/fetch(/L. após remover comentários, e node --check"
        status: pass
    human_judgment: false
  - id: D2
    description: "calcAreaM2 portada do editor legado e a suposição A2 da pesquisa (correção da fórmula) fechada por medição contra um quadrado de 100 m de lado"
    requirement: "PLAT-18"
    verification:
      - kind: unit
        ref: "tests/mapa-geometria.test.js#calcAreaM2 do quadrado de 100 m de lado fica dentro de 1% de 10 000 m²"
        status: pass
    human_judgment: false
  - id: D3
    description: "calcCompatCliente portada e normalizarCategoria/maquinasParaZona resolvem o vocabulário divergente de maq_ativos.categoria; minitrator/trator saem em lista própria, não adivinhados (Pitfall 1)"
    requirement: "PLAT-18"
    verification:
      - kind: unit
        ref: "tests/mapa-geometria.test.js#maquinasParaZona: categoria real do banco (rocadeira, motoserra) vira compatível depois da normalização; minitrator e trator saem em semMapeamento"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolverPosicao resolve posição em duas camadas (própria vence herdada), dentroDoEnvelope recusa coordenada implausível do lado do cliente, e linkDoModulo só monta rota para módulo de lista fechada e id inteiro"
    requirement: "PLAT-13"
    verification:
      - kind: unit
        ref: "tests/mapa-geometria.test.js#resolverPosicao prefere a posição própria do ativo quando ela está dentro do envelope"
        status: pass
      - kind: unit
        ref: "tests/mapa-geometria.test.js#resolverPosicao recusa coordenada fora do envelope, inclusive o par latitude/longitude trocado"
        status: pass
      - kind: unit
        ref: "tests/mapa-geometria.test.js#linkDoModulo devolve nulo para módulo fora da lista fechada"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-01 (aguada continua mock) e D-04 (nenhum arquivo de mapa/ referencia maq_operacoes/horas_utilizadas/area_executada_m2) viram gate automatizado, com varredura dinâmica do diretório"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "tests/mapa-decisoes.test.js#mapa/xmap-layers-aguada.js continua mock por decisão D-01 — não busca no Supabase"
        status: pass
      - kind: unit
        ref: "tests/mapa-decisoes.test.js#nenhum arquivo JavaScript de mapa/ referencia a tabela de execução de operação de máquina (D-04)"
        status: pass
    human_judgment: false
  - id: D6
    description: "node --test sobe de 67 para 94, nenhum teste removido; mapa/xmap-layers-aguada.js, mapa/xmap.js, mapa/xmap.css e refrigeracao/ intocados desde a migração 25"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "node --test (67 → 94, fail 0)"
        status: pass
      - kind: other
        ref: "git diff --name-only 6101c31~1..HEAD -- mapa/xmap-layers-aguada.js mapa/xmap.js mapa/xmap.css refrigeracao/ — 0 arquivos"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 02: Núcleo puro do mapa — geometria, compatibilidade e posição Summary

**`mapa/mapa-geometria.js` criado como núcleo puro do módulo mapa (mesma disciplina de `shared/tema.js`): a fórmula de área geodésica e a regra de compatibilidade de máquinas são portadas do editor legado sem reescrita, a divergência de vocabulário que deixaria a lista de máquinas compatíveis sempre vazia está resolvida com o que a regra não conhece visível numa lista própria, e as decisões travadas D-01/D-04 passam a falhar sozinhas se contrariadas.**

## Performance

- **Duration:** 20 min
- **Completed:** 2026-08-12
- **Tasks:** 3/3 completed
- **Files modified:** 3 (todos novos)

## Accomplishments

- `mapa/mapa-geometria.js` criado: núcleo puro sem `document`/`window`/`localStorage`/`fetch`/`L.` (Leaflet), dez funções e cinco constantes exportadas, `6371000` (raio da Terra) aparecendo uma única vez em todo o JavaScript do projeto.
- `calcAreaM2` e `calcCompatCliente` portadas byte-a-byte de `DEV_ERP/cmms-mapa/admin.html` (linhas 1268-1282 e 1009-1026), sem reescrita — inclusive o ternário redundante do ramo `inclinacao === 'acentuado'` do legado.
- Suposição A2 da pesquisa (correção da fórmula de área) fechada por medição: um quadrado de 100 m de lado na latitude do CMASM devolve 10 044,89 m² — 0,45% acima de 10 000 m², dentro da folga de 1% e registrado no teste como diferença de modelo esférico, não defeito.
- `normalizarCategoria` + `maquinasParaZona` resolvem o Pitfall 1 da pesquisa: a categoria real do banco (`rocadeira`, `motoserra`) passa a casar com o vocabulário da regra (`roçadeira`, `motosserra`) depois da normalização; `minitrator`/`trator` saem numa lista `semMapeamento` própria, sem adivinhação.
- `dentroDoEnvelope` e `resolverPosicao` replicam o envelope geográfico (`-23.2/-22.5/-43.5/-42.7`) e a hierarquia posição própria/herdada da migração 25, com a origem da coordenada exposta no resultado.
- `linkDoModulo` monta rota só para módulo de lista fechada (`maquinas`, `transportes`, `eletrica`, `fonoclama`, `predial`) e identificador inteiro.
- `tests/mapa-geometria.test.js` criado com 23 casos, incluindo o quadrado de área conhecida e a categoria real do banco passando pela normalização.
- `tests/mapa-decisoes.test.js` criado com 4 casos, travando D-01 (aguada continua mock, com os dados fixos preservados) e D-04 (nenhum arquivo de `mapa/` referencia `maq_operacoes`/`horas_utilizadas`/`area_executada_m2`) por varredura dinâmica de diretório.
- Confirmado por `node --test`: suíte sobe de 67 para 94 testes, 0 falhas, nenhum teste anterior removido.
- Confirmado que `mapa/xmap-layers-aguada.js`, `mapa/xmap.js`, `mapa/xmap.css` e `refrigeracao/` continuam intocados desde a migração 25 (`git diff --name-only`, 0 arquivos em cada caso).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Criar mapa/mapa-geometria.js** — `b431361` (feat)
2. **Task 2: Criar tests/mapa-geometria.test.js** — `85fa2c9` (test)
3. **Task 3: Criar tests/mapa-decisoes.test.js** — `55dcd67` (test)

**Plan metadata:** (a seguir, neste commit)

## Files Created/Modified

- `mapa/mapa-geometria.js` — núcleo puro do mapa: área geodésica, compatibilidade de máquinas com normalização de vocabulário, listas fechadas de terreno, envelope de coordenada, resolução de posição em duas camadas e link para o módulo de origem
- `tests/mapa-geometria.test.js` — 23 casos: quadrado de área conhecida (A2), normalizadores de terreno, saídas de `calcCompatCliente`, Pitfall 1 (categoria real do banco), `resolverPosicao`, `dentroDoEnvelope`, `linkDoModulo`
- `tests/mapa-decisoes.test.js` — 4 casos: D-01 (aguada mock, dados fixos preservados) e D-04 (`maq_operacoes`/`horas_utilizadas`/`area_executada_m2` ausentes de `mapa/*.js`), varredura dinâmica via `readdirSync`

## Decisions Made

- `calcAreaM2` e `calcCompatCliente` portadas byte-a-byte, sem simplificar o ternário redundante do legado (`inclinacao === 'acentuado'` sempre devolve `['roçadeira']` independente de `limpeza`) — "portar, não reescrever" se aplica também a quirks sem efeito prático.
- `VOCABULARIO_REGRA` (constante interna, não exportada) fixado nos três termos que `calcCompatCliente` de fato devolve (`cortador_grama`, `roçadeira`, `motosserra`). A prosa do plano menciona "quatro termos do vocabulário da regra" em `maquinasParaZona`, mas nenhum gate automatizado do plano afirma esse número — a leitura mais coerente com o resto do texto (que fala em "quatro categorias reais do inventário" alguns parágrafos depois) é que a prosa confundiu os dois conjuntos. A implementação segue a semântica correta e verificável: `semMapeamento` contém só categorias que a regra nunca reconhece como tipo de máquina, testado com as quatro categorias reais do inventário (`rocadeira`→compatível, `motoserra`→compatível, `minitrator`→semMapeamento, `trator`→semMapeamento).
- `resolverPosicao` aceita `local` ausente/nulo via optional chaining (`local?.lat`), sem checagem explícita de `local == null` — mais curto e com o mesmo resultado, já que `dentroDoEnvelope(undefined, undefined)` devolve `false`.

## Deviations from Plan

### Nenhuma — plano executado como escrito, uma nota de interpretação registrada

Não houve bugs a corrigir, funcionalidade crítica ausente a acrescentar, nem mudança arquitetural. A única observação é de leitura de prosa, não de código ou de gate:

**1. [Nota de interpretação, não deviation de Regra 1-4] "Quatro termos do vocabulário da regra" na descrição de `maquinasParaZona`**

- **Found during:** Task 1, escrita de `maquinasParaZona`
- **Observação:** O `<action>` do plano descreve `semMapeamento` como "os ativos cuja categoria normalizada não é nenhum dos quatro termos do vocabulário da regra" — mas `calcCompatCliente` só é capaz de devolver três termos (`cortador_grama`, `roçadeira`, `motosserra`) em qualquer combinação de atributos. Um parágrafo depois, o mesmo texto fala em "quatro categorias reais do inventário" (`rocadeira`, `motoserra`, `minitrator`, `trator`) — um conjunto diferente, do lado do banco, não do lado da regra.
- **Resolução:** Implementei o vocabulário da regra com os três termos reais que `calcCompatCliente` devolve. Nenhum `<acceptance_criteria>` ou `<verify>` automatizado do plano afirma o número "quatro" para este conjunto — o gate real (Task 2, caso do Pitfall 1) verifica o comportamento (categorias reais mapeiam corretamente, `minitrator`/`trator` saem em `semMapeamento`), que está satisfeito independente de o vocabulário interno ter três ou quatro entradas.
- **Files modified:** nenhum — decisão tomada na escrita original de `mapa/mapa-geometria.js`, não uma correção posterior
- **Verification:** `tests/mapa-geometria.test.js` — caso do Pitfall 1 passa com as quatro categorias reais do inventário

---

**Total deviations:** 0 (Regras 1-4); 1 nota de interpretação de prosa, sem gate afetado
**Impact on plan:** Nenhum — todos os `<acceptance_criteria>` e `<verify>` automatizados das três tasks passam.

## Issues Encountered

None.

## User Setup Required

Nenhum. Este plano não toca o banco (a migração 25 já foi entregue pelo plano 10-01, cuja aplicação em produção segue pendente do usuário) nem exige nenhuma ação fora do repositório.

## Next Phase Readiness

- `mapa/mapa-geometria.js` está pronto para os planos seguintes consumirem: `mapa-editor.js` (10-06) usa `calcAreaM2`/`calcCompatCliente`/`normalizarFlora`/`normalizarInclinacao`/`normalizarLimpeza`; `xmap-layers-*.js` (10-05) usa `normalizarCategoria`/`maquinasParaZona`/`resolverPosicao`/`dentroDoEnvelope`/`linkDoModulo`.
- D-01 e D-04 têm gate permanente em `tests/mapa-decisoes.test.js` — qualquer plano futuro que contrariar essas decisões falha o `node --test` antes de chegar a revisão humana.
- Bloqueio herdado do plano 10-01: a migração 25 ainda não foi aplicada no banco de produção real pelo usuário. Nenhum plano que leia/escreva `lat`/`lon`/`geom`/`flora`/`inclinacao`/`limpeza` contra o Supabase real pode ser considerado testado ponta a ponta até essa aplicação acontecer — `mapa/mapa-geometria.js` em si não depende do banco (é núcleo puro), mas os planos 10-05/10-06/10-07 que o consomem, sim.

---
*Phase: 10-mapa-operacional*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: mapa/mapa-geometria.js
- FOUND: tests/mapa-geometria.test.js
- FOUND: tests/mapa-decisoes.test.js
- FOUND: .planning/phases/10-mapa-operacional/10-02-SUMMARY.md
- FOUND commit: b431361 (feat 10-02 núcleo puro)
- FOUND commit: 85fa2c9 (test 10-02 mapa-geometria)
- FOUND commit: 55dcd67 (test 10-02 mapa-decisoes)
