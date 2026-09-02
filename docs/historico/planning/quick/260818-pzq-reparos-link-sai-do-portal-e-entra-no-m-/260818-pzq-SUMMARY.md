---
phase: quick
plan: 260818-pzq
subsystem: ui
tags: [maquinas, portal, navegacao, vencimentos, operacoes, reparos]

requires: []
provides:
  - "Portal sem cartão de Reparos; catálogo alcançado de dentro do Máquinas, no cabeçalho da view de OS"
  - "Categoria Tobata nos dois selects de máquinas (filtro-cat, at-cat)"
  - "Vencimentos como seção final da aba Máquinas (não mais aba própria)"
  - "Operações como seção final da aba OS (não mais aba própria)"
  - "Bloco de manutenções (vencidas/próximas) na ficha de consulta da máquina, com atalho para o popup de itens"
affects: [maquinas, portal, reparos]

tech-stack:
  added: []
  patterns:
    - "Mesclagem de view: mover o miolo de um <div class=\"view\"> para dentro de outro, preservando ids internos, em vez de aninhar .view (trocarView() só alterna irmãos diretos)"
    - "Ficha reaproveita a função de cálculo existente (calcVencimentos) filtrada por ativo, em vez de duplicar a conta"

key-files:
  created: []
  modified:
    - index.html
    - maquinas/index.html
    - maquinas/app.js
    - tests/integracao-reparos.test.js
    - tests/integracao-operacoes-maquinas.test.js
    - tests/ficha-ativo-maquinas.test.js

key-decisions:
  - "Reparos sai do portal (que lista sistemas, não sub-catálogos) e passa a ser alcançado de dentro do Máquinas, onde a OS corretiva de fato consome o catálogo"
  - "Tobata é categoria (mini-trator agrícola), texto livre sem check constraint — nenhuma migração SQL necessária"
  - "Vencimento é atributo da máquina → vive na aba Máquinas; operação é execução de serviço → vive na aba OS; nenhuma das duas precisa de aba própria"
  - "Faixa de abas cai de 10 para 8 itens (navItems em boot())"

patterns-established:
  - "Ao apagar uma aba, mover conteúdo com ids preservados para o fim da aba relacionada, nunca aninhar .view"

requirements-completed: []

coverage:
  - id: D1
    description: "Portal sem cartão de Reparos; /reparos alcançável de dentro do Máquinas e ainda roteado no vercel.json"
    verification:
      - kind: unit
        ref: "tests/integracao-reparos.test.js#reparos está roteado no Vercel e é alcançado por dentro do Máquinas"
        status: pass
    human_judgment: false
  - id: D2
    description: "Categoria Tobata disponível nos dois selects de categoria (filtro-cat e at-cat), sem migração SQL nova"
    verification:
      - kind: other
        ref: "grep -c 'value=\"tobata\"' maquinas/index.html == 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "Faixa de abas do Máquinas com 8 itens (navItems); Vencimentos e Operações viram seção das abas Máquinas e OS, preservando ids e funções de render"
    verification:
      - kind: unit
        ref: "tests/integracao-operacoes-maquinas.test.js#expõe operações, agenda e os três formulários do fluxo"
        status: pass
      - kind: other
        ref: "grep 'id: ' maquinas/app.js (8 entradas em navItems: painel, ativos, os, agenda, materiais, consumo, ciclo, compras)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ficha da máquina mostra as manutenções vencidas/próximas dela (derivadas de calcVencimentos(), sem repetir a conta) e tem botão para o popup de itens já existente"
    verification:
      - kind: unit
        ref: "tests/ficha-ativo-maquinas.test.js#a ficha tem o contêiner de manutenções e o botão para o popup de itens"
        status: pass
      - kind: unit
        ref: "tests/ficha-ativo-maquinas.test.js#abrirFichaAtivo deriva os vencimentos filtrando calcVencimentos() pelo ativo, sem repetir a conta"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual/funcional em navegador (8 botões na faixa de abas, seções na posição certa, popup de vencimentos, filtro/cadastro por Tobata) — não observado diretamente por este executor"
    verification: []
    human_judgment: true
    rationale: "Plano type=execute autonomous sem checkpoint de verificação humana; a suíte automatizada cobre estrutura/ids/config, mas a conferência visual em navegador (itens 2–5 da seção <verification> do plano) não foi executada nesta sessão."

duration: ~20min (sessão atual; Tasks 1 e 2 foram commitadas em sessão anterior)
completed: 2026-08-18
status: complete
---

# Quick Task 260818-pzq: Reparos sai do portal, Tobata e ficha com vencimentos — Summary

**Portal perde o cartão de Reparos (agora alcançado de dentro do Máquinas), categoria Tobata entra nos dois selects, e a faixa de abas do Máquinas cai de 10 para 8 com Vencimentos/Operações viradas seção das abas Máquinas/OS — incluindo bloco de manutenções na ficha da máquina.**

## Performance

- **Duration:** ~20min nesta sessão (Tasks 1 e 2 já estavam commitadas de uma sessão anterior interrompida; esta sessão retomou o trabalho, terminou a Task 3 e ajustou os dois gates de teste)
- **Completed:** 2026-08-18T21:56:34Z
- **Tasks:** 3/3 completas
- **Files modified:** 6 (index.html, maquinas/index.html, maquinas/app.js, 3 arquivos de teste)

## Accomplishments

- Cartão "Reparos" removido de `index.html`; âncora "🛠 Catálogo de reparos" (`href="/reparos"`) no cabeçalho da view de OS em `maquinas/index.html`
- Categoria `tobata` nos dois selects (`filtro-cat`, `at-cat`), sem migração SQL (coluna já era texto livre)
- `view-vencimentos` e `view-operacoes` deixaram de existir como abas: o miolo de cada uma foi movido para o fim de `view-ativos` e `view-os` respectivamente, preservando `#venc-content`, `#operacoes-kpis`, `#operacoes-kanban`, `#tb-areas`, `btn-nova-area`, `btn-nova-operacao`
- `navItems` em `boot()` (maquinas/app.js) cai de 10 para 8 abas
- Ficha da máquina (`abrirFichaAtivo`) ganha bloco "Manutenções": deriva `calcVencimentos().filter(i => i.ativo.id === id)`, mostra os 5 primeiros com o mesmo vocabulário visual do popup (`uso-bar`, badges `b-red`/`b-warn`/`b-ok`), e o botão `ficha-btn-venc` fecha a ficha e abre `abrirVencMaquina(id)`
- `node --test`: 227/227 (225 anteriores + 2 novos testes de ficha)

## Task Commits

Tasks 1 e 2 foram executadas e commitadas numa sessão anterior (git log já as continha ao início desta execução):

1. **Task 1: Reparos sai do portal e passa a ser alcançado de dentro do Máquinas** - `d0d1b9c` (feat)
2. **Task 2: Categoria Tobata no cadastro e no filtro de máquinas** - `7630212` (feat)
3. **Task 3: Vencimentos na ficha da máquina e unificação de duas abas** - `7564dbe` (feat) — completada e commitada nesta sessão

## Files Created/Modified

- `index.html` - cartão de Reparos removido da grade do portal (Task 1)
- `maquinas/index.html` - âncora para `/reparos`, opção Tobata nos dois selects, `view-vencimentos`/`view-operacoes` mescladas em `view-ativos`/`view-os`, bloco `ficha-vencimentos`/`ficha-btn-venc` no modal de ficha
- `maquinas/app.js` - `navItems` com 8 abas; `abrirFichaAtivo()` deriva e renderiza os vencimentos da máquina
- `tests/integracao-reparos.test.js` - gate do link reescrito para a decisão nova (Task 1, sessão anterior)
- `tests/integracao-operacoes-maquinas.test.js` - gate reescrito: não exige mais `id="view-operacoes"`, prova que a config de abas não declara `operacoes`/`vencimentos` e que a marcação de operações está dentro do bloco `view-os`
- `tests/ficha-ativo-maquinas.test.js` - dois testes novos fixando o contêiner de manutenções da ficha e a derivação sem duplicar `calcVencimentos()`

## Decisions Made

- Reparos sai do portal (índice de sistemas) e passa a ser alcançado de dentro do Máquinas, onde a OS corretiva de fato consome o catálogo — decisão registrada em comentário no teste e no HTML para que uma fase futura não "conserte" o portal de volta
- `tobata` gravado em minúsculas sem acento, mesmo padrão de `rocadeira`/`minitrator`/`motoserra`; nenhuma migração SQL necessária (`maq_ativos.categoria` já era texto livre desde a migração 01)
- Vencimento é atributo da máquina → seção da aba Máquinas; operação é execução de serviço → seção da aba OS; nenhuma das duas precisa de aba própria na faixa de navegação
- Ids internos (`venc-content`, `operacoes-kpis`, `operacoes-kanban`, `tb-areas`, `btn-nova-area`, `btn-nova-operacao`) preservados byte-a-byte na mesclagem, para que `renderVencimentos()`/`renderOperacoes()`/`aplicarPermissoesOperacoes()` continuem funcionando sem alteração

## Deviations from Plan

### Auto-fixed Issues

Nenhum desvio de código sob as Regras 1-3 — a implementação já encontrada (Tasks 1-2 commitadas, Task 3 com HTML/JS prontos mas sem os gates) foi conferida linha a linha contra o plano e bateu com o que foi pedido; o trabalho desta sessão foi terminar os dois gates de teste da Task 3 e commitar.

**1. [Gate mal especificado no próprio plano] Verify script `grep -c 'class="view" id=' maquinas/index.html | grep -qx 8` não bate com a contagem real**
- **Encontrado em:** verificação da Task 3
- **Problema:** o padrão exato `class="view" id=` não casa com a linha do painel (`<div class="view active" id="view-painel">`, que tem a classe extra `active` entre `view` e `id=`). Com 8 views reais no HTML (painel, ativos, os, agenda, materiais, consumo, ciclo, compras), o grep conta 7, não 8 — o mesmo padrão já contava 9 (não 10) no arquivo original, antes desta tarefa.
- **Fix:** nenhum — é um script de verificação do próprio PLAN.md, não código de produção; o critério real ("faixa de abas com 8 itens") foi confirmado por outra via: contagem de `id: '...'` em `navItems` (8) e inspeção manual do HTML (8 `<div class="view">`, sendo 1 com `active`)
- **Verificação:** `grep -n "id: '" maquinas/app.js` dentro de `navItems` retorna 8 entradas; `grep -n 'class="view' maquinas/index.html` retorna 8 linhas de abertura de view
- **Committed in:** não aplicável (não é alteração de código; documentado aqui para não ser tratado como lacuna futura, no mesmo espírito do registro de gates mal especificados da Fase 6)

---

**Total deviations:** 1 (achado de gate mal especificado, sem correção de código necessária)
**Impact on plan:** Nenhum — o comportamento real bate com o `<done>` da Task 3; apenas o script de verificação do PLAN.md tem um padrão de grep que não cobre a view do painel.

## Issues Encountered

Nenhum. A sessão anterior havia deixado `maquinas/index.html` e `maquinas/app.js` com a implementação da Task 3 pronta mas não commitada, e os dois arquivos de teste dessa tarefa desatualizados (causando falha em `node --test`). Esta sessão conferiu a implementação contra o plano, reescreveu os dois gates conforme especificado, confirmou 227/227 testes verdes e commitou.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `node --test`: 227/227, 0 falhas
- Nenhuma migração SQL criada; `shared/shell.js` intocado; nenhum dos outros 5 módulos alterado
- Pendente (não bloqueante, fora do escopo desta tarefa): conferência visual em navegador dos itens 2–5 da seção `<verification>` do plano (8 botões na faixa, seções na posição certa, popup de vencimentos, filtro/cadastro por Tobata) — recomendado no próximo UAT manual do módulo Máquinas

## Self-Check: PASSED

Todos os arquivos citados (`index.html`, `maquinas/index.html`, `maquinas/app.js`, os três arquivos de teste, este SUMMARY) existem em disco; os três commits citados (`d0d1b9c`, `7630212`, `7564dbe`) existem no histórico do git.
