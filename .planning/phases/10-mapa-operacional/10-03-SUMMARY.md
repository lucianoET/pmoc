---
phase: 10-mapa-operacional
plan: 03
subsystem: frontend
tags: [deep-link, url-search-params, maquinas, modulo-manutencao, node-test]

requires:
  - phase: 10-mapa-operacional plan 02
    provides: "mapa/mapa-geometria.js — linkDoModulo, que monta a rota `?ativo=<id>` que este plano lê no outro lado"
provides:
  - "maquinas/app.js lê o parâmetro `ativo` da URL e abre a ficha do ativo correspondente após a primeira carga de dados"
  - "shared/modulo-manutencao.js faz o mesmo, servindo eletrica e fonoclama de uma vez (o motor compartilhado dos dois)"
  - "tests/mapa-deep-link.test.js — gate estático das duas metades de destino, incluindo a chave de parâmetro conferida contra o resultado real de linkDoModulo()"
affects: [10-05]

tech-stack:
  added: []
  patterns:
    - "Deep link de URL validado por forma estrita antes de qualquer uso — mesmo espírito de normalizarTema/normalizarFlora (comparação estrita, sem adivinhação), aplicado a URLSearchParams em vez de localStorage"
    - "Execução única por carregamento de página via marca em variável de módulo (DEEP_LINK_ATIVO_CONSUMIDO), não via limpeza da URL"

key-files:
  created:
    - tests/mapa-deep-link.test.js
  modified:
    - maquinas/app.js
    - shared/modulo-manutencao.js

key-decisions:
  - "tests/mapa-deep-link.test.js não compara a chave do parâmetro com um texto literal repetido a mão — deriva a chave chamando o linkDoModulo('maquinas', 1) real de mapa/mapa-geometria.js e extraindo a chave do URL resultante via URLSearchParams. mapa-geometria.js (já existente desde o plano 10-02) não exporta uma constante isolada só com o nome da chave — a chave está embutida no template da rota dentro de linkDoModulo — então extrair do comportamento real da função é mais fiel à intenção do plano ('não repetir a chave a mão') do que inventar uma constante que o núcleo puro não expõe"
  - "Ambas as funções privadas usam o mesmo nome (_abrirAtivoDaUrl) e a mesma marca de execução única (DEEP_LINK_ATIVO_CONSUMIDO) nos dois arquivos — mesmo padrão, escrito duas vezes, como o plano pediu"

requirements-completed: [PLAT-14, PLAT-16]

coverage:
  - id: D1
    description: "maquinas/app.js lê o parâmetro `ativo`, valida como inteiro estrito, espera carregarTudo() terminar e abre abrirModalAtivo() do ativo encontrado, uma vez por carregamento de página"
    requirement: "PLAT-14"
    verification:
      - kind: unit
        ref: "tests/mapa-deep-link.test.js#os dois arquivos de destino leem o parâmetro de busca da URL pelo leitor padrão do navegador"
        status: pass
      - kind: unit
        ref: "tests/mapa-deep-link.test.js#os dois arquivos validam o identificador como inteiro antes de qualquer uso"
        status: pass
      - kind: unit
        ref: "tests/mapa-deep-link.test.js#nos dois arquivos, a função de exibição virou assíncrona e espera a carga"
        status: pass
      - kind: other
        ref: "gate estático da Task 1 — grep URLSearchParams/'ativo'/Number.isSafeInteger/async function mostrarApp, node --check via cópia .mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "shared/modulo-manutencao.js faz a mesma leitura, servindo eletrica e fonoclama de uma vez, sem alterar a assinatura pública de iniciarModulo"
    requirement: "PLAT-14"
    verification:
      - kind: unit
        ref: "tests/mapa-deep-link.test.js#a API pública do motor compartilhado (iniciarModulo) está intacta"
        status: pass
      - kind: other
        ref: "git diff --name-only -- eletrica/app.js fonoclama/app.js — 0 arquivos"
        status: pass
    human_judgment: false
  - id: D3
    description: "A chave de parâmetro dos dois arquivos de destino é a mesma que linkDoModulo() de mapa/mapa-geometria.js produz — as duas metades de PLAT-14 não podem divergir de nome sem o teste acusar"
    requirement: "PLAT-14"
    verification:
      - kind: unit
        ref: "tests/mapa-deep-link.test.js#os dois arquivos usam a mesma chave de parâmetro que linkDoModulo monta em mapa/mapa-geometria.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "A função nova não vaza para o escopo global e a lista de exporNoWindow() de maquinas/app.js continua com 24 entradas; a API pública do motor compartilhado (iniciarModulo) não muda"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "tests/mapa-deep-link.test.js#nos dois arquivos, a função de deep link não vaza para o escopo global"
        status: pass
      - kind: unit
        ref: "tests/mapa-deep-link.test.js#a lista de nomes publicados em maquinas/app.js continua com 24 entradas"
        status: pass
    human_judgment: false
  - id: D5
    description: "node --test sobe de 94 para 101, nenhum teste anterior removido; mapa/, eletrica/app.js, fonoclama/app.js e refrigeracao/ intocados"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "node --test (94 → 101, fail 0)"
        status: pass
      - kind: other
        ref: "git diff --name-only -- mapa/ eletrica/app.js fonoclama/app.js — 0 arquivos; git diff --name-only 511bb9e..HEAD -- refrigeracao/ — 0 arquivos"
        status: pass
    human_judgment: false
  - id: D6
    description: "A prova de ponta a ponta (clicar num balão do mapa e ver a ficha abrir de fato) não é possível sem navegador/credenciais neste ambiente — fica no roteiro manual da fase (TESTES.md), não como item concluído"
    verification: []
    human_judgment: true
    rationale: "Requer sessão de navegador autenticada e a metade de origem do link (plano 10-05, ainda não executado); o gate estático deste plano prova a metade de destino de forma determinística, mas o fluxo completo é UAT manual por natureza"

duration: 15min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 03: Metade de destino do deep link do mapa Summary

**`maquinas/app.js` e `shared/modulo-manutencao.js` leem `?ativo=<id>` da URL, validam o identificador como inteiro estrito e abrem a ficha do ativo direto — sem lista, sem busca — depois que a primeira carga de dados termina; a chave de parâmetro é conferida por teste contra o resultado real de `linkDoModulo()` do núcleo puro do mapa, não repetida a mão.**

## Performance

- **Duration:** 15 min
- **Completed:** 2026-08-12
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 modificados, 1 novo)

## Accomplishments

- `maquinas/app.js`: `mostrarApp()` virou assíncrona e aguarda `carregarTudo()` antes de acionar `_abrirAtivoDaUrl()`, uma função privada nova que lê `URLSearchParams`, valida o identificador com regex de dígitos + `Number.isSafeInteger`, procura o ativo em `ATIVOS` (já carregado) e só então chama `abrirModalAtivo()` — a mesma função que a linha da tabela já chama hoje.
- `shared/modulo-manutencao.js`: mesma adição, mesmo nome de função e de marca de execução única, servindo `eletrica` e `fonoclama` de uma vez porque os dois compartilham este motor. `mostrarApp()` agora aguarda `recarregar()` antes do deep link.
- Nos dois arquivos, um comentário registra explicitamente por que a chamada só acontece depois de encontrar o ativo: `abrirModalAtivo` do motor compartilhado trata `id` nulo como "novo ativo" — passar o valor cru adiante abriria um formulário de cadastro vazio para quem clicou num ativo do mapa (T-10-13, mitigado).
- Execução única por carregamento de página via variável de módulo (`DEEP_LINK_ATIVO_CONSUMIDO`); a URL não é limpa depois de usar, mantendo o endereço compartilhável e recarregável.
- `tests/mapa-deep-link.test.js` criado com 7 casos: leitura de `URLSearchParams`, chave de parâmetro derivada do resultado real de `linkDoModulo('maquinas', 1)` (não repetida a mão), validação de inteiro, `mostrarApp` assíncrona com `await`, ausência da função nova em `exporNoWindow()`, contagem de 24 entradas na lista publicada de `maquinas/app.js`, e assinatura pública de `iniciarModulo` intacta.
- `node --test`: suíte sobe de 94 para 101 testes, 0 falhas, nenhum teste anterior removido.
- Confirmado que `mapa/`, `eletrica/app.js`, `fonoclama/app.js` e `refrigeracao/` (desde `511bb9e`) continuam intocados.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Ler o parâmetro de ativo na URL em maquinas/app.js e no motor compartilhado** — `0642fde` (feat)
2. **Task 2: Criar tests/mapa-deep-link.test.js — gate estático das duas metades de destino** — `cb1b775` (test)

**Plan metadata:** (a seguir, neste commit)

## Files Created/Modified

- `maquinas/app.js` — `mostrarApp()` assíncrona; `_abrirAtivoDaUrl()` nova (privada, não publicada) lê e valida o parâmetro `ativo` e abre a ficha do ativo encontrado
- `shared/modulo-manutencao.js` — mesma adição, servindo `eletrica`/`fonoclama`; `iniciarModulo()` (API pública) inalterada
- `tests/mapa-deep-link.test.js` — 7 casos: leitura de URL, chave de parâmetro derivada de `linkDoModulo()`, validação de inteiro, `mostrarApp` assíncrona, ausência em `exporNoWindow()`, contagem de 24 entradas, API pública intacta

## Decisions Made

- A chave de parâmetro não é comparada com um texto literal repetido a mão no teste: `chaveDoParametroDoMapa()` chama `linkDoModulo('maquinas', 1)` de `mapa/mapa-geometria.js` (existente desde o plano 10-02) e extrai a chave do URL resultante via `URLSearchParams`. `mapa-geometria.js` não exporta uma constante isolada com o nome da chave — ela está embutida no template da rota dentro de `linkDoModulo` — então derivar do comportamento real da função, em vez de inventar uma constante que o núcleo puro não expõe, é a leitura mais fiel do que o plano pediu ("não repetir a chave a mão", ver Deviations).
- Nos dois arquivos de destino, a função privada nova e a variável de marca de execução única usam o mesmo nome (`_abrirAtivoDaUrl`, `DEEP_LINK_ATIVO_CONSUMIDO`) — facilita comparar os dois lados e é consistente com o pedido do plano de "a mesma adição, escrita duas vezes".

## Deviations from Plan

### Nenhuma — plano executado como escrito, uma nota de interpretação registrada

Não houve bugs a corrigir, funcionalidade crítica ausente a acrescentar, nem mudança arquitetural.

**1. [Nota de interpretação, não deviation de Regra 1-4] "Constante importada de mapa/mapa-geometria.js" na Task 2**

- **Found during:** Task 2, escrita de `tests/mapa-deep-link.test.js`
- **Observação:** O `<action>` da Task 2 pede afirmar a chave de parâmetro "comparando com a constante importada de `mapa/mapa-geometria.js`". `mapa/mapa-geometria.js` (plano 10-02, já executado nesta onda) exporta `linkDoModulo(modulo, id)`, mas não uma constante isolada só com o nome `'ativo'` — a chave está embutida no template de string dentro da função (`` `${rota}?ativo=${id}` ``).
- **Resolução:** O teste chama `linkDoModulo('maquinas', 1)` de verdade e extrai a chave do parâmetro do URL resultante via `URLSearchParams`, em vez de importar uma constante que não existe. Isso cumpre a intenção declarada da Task 2 ("Este é o caso que impede as duas metades de PLAT-14 de divergirem: se um dia alguém trocar o nome do parâmetro num lado, o teste acusa") — se `linkDoModulo` mudar a chave, `chaveDoParametroDoMapa()` muda junto, e o teste segue comparando contra o valor real, não um texto morto.
- **Files modified:** nenhum — decisão tomada na escrita original de `tests/mapa-deep-link.test.js`, não uma correção posterior
- **Verification:** `tests/mapa-deep-link.test.js` — caso "os dois arquivos usam a mesma chave de parâmetro que linkDoModulo monta em mapa/mapa-geometria.js" passa, incluindo um sanity check de que a chave real é `'ativo'`

---

**Total deviations:** 0 (Regras 1-4); 1 nota de interpretação de prosa, sem gate afetado
**Impact on plan:** Nenhum — todos os `<acceptance_criteria>` e `<verify>` automatizados das duas tasks passam.

## Issues Encountered

None.

## User Setup Required

Nenhum. Este plano não toca o banco nem exige nenhuma ação fora do repositório.

## Next Phase Readiness

- A metade de destino de PLAT-14 está pronta e testada antes da metade de origem (plano 10-05, que monta o link dentro do balão do mapa via `linkDoModulo`) existir.
- O plano 10-05 pode consumir `linkDoModulo('maquinas'|'transportes'|'eletrica'|'fonoclama'|'predial', id)` sabendo que `maquinas`, `eletrica` e `fonoclama` já leem `?ativo=<id>` corretamente; `transportes` e `predial` não entram nesta fase (nenhuma camada do mapa plota ativo desses dois módulos ainda).
- A prova de ponta a ponta (clicar num balão do mapa e ver a ficha abrir) segue como item do roteiro manual de `TESTES.md`, pendente até o plano 10-05 existir e uma sessão de navegador autenticada estar disponível.
- Bloqueio herdado dos planos 10-01/10-02: a migração 25 (lat/lon/geom/flora/inclinacao/limpeza) ainda não foi aplicada no banco de produção real pelo usuário — não afeta este plano (nenhuma leitura/escrita ao Supabase foi acrescentada), mas os planos 10-05/10-06/10-07 seguem dependentes dessa aplicação.

---
*Phase: 10-mapa-operacional*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: maquinas/app.js
- FOUND: shared/modulo-manutencao.js
- FOUND: tests/mapa-deep-link.test.js
- FOUND: .planning/phases/10-mapa-operacional/10-03-SUMMARY.md
- FOUND commit: 0642fde (feat 10-03 deep link maquinas + motor compartilhado)
- FOUND commit: cb1b775 (test 10-03 gate mapa-deep-link)
