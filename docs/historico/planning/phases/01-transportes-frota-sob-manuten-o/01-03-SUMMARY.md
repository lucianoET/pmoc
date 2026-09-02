---
phase: 01-transportes-frota-sob-manuten-o
plan: 03
subsystem: frontend
tags: [vanilla-js, supabase, transportes, estoque, csv]

# Dependency graph
requires:
  - phase: 01-transportes-frota-sob-manuten-o
    provides: "transp_planos, transp_pode_escrever() (Plano 01-01)"
  - phase: 01-transportes-frota-sob-manuten-o
    provides: "transp_materiais, transp_plano_materiais, transp_estoque_movimentos, plano_id/status/custo_pecas em transp_manutencoes (Plano 01-02)"
provides:
  - "Vínculo peça-plano no modal de plano (adicionarPecaAoPlano/removerPecaDoPlano) com upsert por (plano_id, material_id)"
  - "Lista de compras (renderCompras/COMPRAS) combinando estoque mínimo e planos próximos do vencimento (LIMIAR_COMPRAS=70%), exportável em CSV saneado contra fórmula (csvSeguro)"
  - "OS de manutenção vinculada a ativo, plano e peças (salvarOS/concluirOS) com baixa automática de estoque idempotente (baixarPecasDoPlano) e atualização de uso do ativo só para cima"
  - "Coerência km/h aplicada também no seletor de plano da OS (popularPlanosOS, D-04)"
affects: [01-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotência de baixa de estoque via checagem de manutencao_id já presente em ESTOQUE_MOV antes de debitar (sem função/trigger de banco)"
    - "Guarda dupla de coerência de unidade km×h: calcVencimentos() e popularPlanosOS() aplicam o mesmo filtro plano.unidade === ativo.unidade_uso (D-04)"

key-files:
  created: []
  modified:
    - transportes/app.js
    - transportes/index.html

key-decisions:
  - "onConflict: 'plano_id,material_id' no upsert de adicionarPecaAoPlano() aproveita a constraint unique já criada na migração 23, evitando duplicar peça vinculada ao mesmo plano"
  - "baixarPecasDoPlano() é a única função autorizada a debitar estoque a partir de uma OS — chamada tanto por salvarOS() (OS já criada como concluída) quanto por concluirOS() (transição posterior), ambas guardadas pela mesma checagem de manutencao_id"
  - "COMPRAS é global do módulo em UPPER_CASE (não pendurada em window._comprasData como no analog de máquinas), seguindo a convenção já usada por PLANOS/MATERIAIS/ESTOQUE_MOV"

requirements-completed: [TRANSP-03, TRANSP-07]

coverage:
  - id: D1
    description: "Gestor vincula e remove peças de um plano salvo (adicionarPecaAoPlano/removerPecaDoPlano), com upsert idempotente por (plano_id, material_id)"
    requirement: "TRANSP-07"
    verification:
      - kind: other
        ref: "gates estáticos da Task 1 (node --check, grep de funções/ids) — todos passaram"
        status: pass
    human_judgment: true
    rationale: "Fluxo de UI (vincular/remover peça mantendo o modal aberto) depende de dado real em produção — human-check da Task 1 ainda não executado nesta sessão"
  - id: D2
    description: "Lista de compras reúne peças abaixo do mínimo e peças de planos com uso >= 70% do intervalo, exporta CSV com separador ';' e csvSeguro() contra injeção de fórmula, funcionando também vazia"
    requirement: "TRANSP-07"
    verification:
      - kind: other
        ref: "gates estáticos da Task 1 (grep de renderCompras/exportarComprasCsv/csvSeguro/LIMIAR_COMPRAS/join(';')) — todos passaram"
        status: pass
    human_judgment: true
    rationale: "Conteúdo correto do CSV (colunas, saneamento de fórmula) depende de abrir o arquivo numa planilha real — human-check da Task 1"
  - id: D3
    description: "Técnico abre e conclui OS vinculada a ativo, plano e peças; conclusão debita estoque exatamente uma vez, grava custo_pecas e atualiza uso_atual só para cima; observador não vê os controles"
    requirement: "TRANSP-03"
    verification:
      - kind: other
        ref: "gates estáticos da Task 2 (node --check, grep de salvarOS/concluirOS/baixarPecasDoPlano/popularPlanosOS/mostrarMateriaisPlano, ausência de salvarManutencao residual, .select() no insert, manutencao_id na guarda) — todos passaram"
        status: pass
    human_judgment: true
    rationale: "Fluxo completo (abrir OS, concluir, conferir saldo debitado uma única vez, conferir uso do ativo, conferir ocultação para observador) depende de dado real em produção — human-check da Task 2 ainda não executado nesta sessão"

duration: 14min
completed: 2026-08-10
status: complete
---

# Phase 1 Plan 3: Peças do plano, lista de compras e OS com baixa de estoque Summary

**Vínculo peça-plano com lista de compras exportável em CSV saneado (`csvSeguro`), e OS de manutenção vinculada a ativo/plano/peças com baixa de estoque idempotente (`baixarPecasDoPlano`) e atualização de uso do ativo só para cima — fecha o ciclo plano → uso → OS → estoque → reposição do módulo Transportes.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-10T15:55:22Z (retomada da sessão, conforme STATE.md)
- **Completed:** 2026-08-10T16:08:57Z
- **Tasks:** 2 (ambas `type="auto"`, sem checkpoint — nenhuma migração nova, todo o trabalho é no cliente)
- **Files modified:** 2

## Accomplishments
- Modal de plano ganhou seção "Peças previstas": `adicionarPecaAoPlano()` faz `upsert` em `transp_plano_materiais` com resolução de conflito por `(plano_id, material_id)`, e `removerPecaDoPlano()` remove por id; ambas recarregam os dados e mantêm o modal aberto
- Aba Estoque ganhou bloco "Lista de compras": `renderCompras()` combina peças abaixo do mínimo (via `materiaisAbaixoDoMinimo()`) com peças de planos cujo uso já atingiu `LIMIAR_COMPRAS` (70%) e cujo saldo é insuficiente; `exportarComprasCsv()` exporta em CSV com separador `;`, `csvEscape()` e `csvSeguro()` (prefixa aspa simples em valores iniciados por `=`, `+`, `-` ou `@`, contra injeção de fórmula em planilha), funcionando também com a lista vazia (só cabeçalho)
- Modal de manutenção virou modal de OS: `mn-plano` (filtrado por `tipo_modelo` **e** `unidade_uso` do ativo — D-04, via `popularPlanosOS()`), `mn-status` e `mn-pecas` (peças previstas com aviso de saldo insuficiente, via `mostrarMateriaisPlano()`)
- `salvarOS()` substitui `salvarManutencao()`: grava `plano_id`/`status`/`custo_pecas`, recupera o id gerado com `.select().single()` e, quando o status já é concluído e há plano, chama `baixarPecasDoPlano()`
- `baixarPecasDoPlano()` é o único caminho de débito de estoque a partir de uma OS: guarda de idempotência checando `manutencao_id` já existente em `ESTOQUE_MOV`, piso zero no novo saldo, movimento de saída rastreável por OS
- `concluirOS()` ignora OS já concluída, chama a mesma `baixarPecasDoPlano()` e atualiza `uso_atual` do ativo apenas quando o uso de referência é maior que o atual
- Tabela de manutenções ganhou coluna de Status e botão "Concluir OS", visível só para quem `podeEditar()` e só para OS ainda não concluída
- Suíte `tests/*.test.js` (19 testes) segue passando integralmente após as mudanças

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Peças do plano e lista de compras exportável em CSV** - `0d4fa74` (feat)
2. **Task 2: OS vinculada a ativo, plano e peças com baixa automática de estoque** - `fc2e968` (feat)

_Nenhuma tarefa desta plan usa TDD — não há commits test→feat→refactor separados._

## Files Created/Modified
- `transportes/app.js` - `COMPRAS`/`LIMIAR_COMPRAS`/`STATUS_OS`, `renderPecasDoPlano`/`adicionarPecaAoPlano`/`removerPecaDoPlano`, `csvSeguro`/`renderCompras`/`exportarComprasCsv`, `popularPlanosOS`/`mostrarMateriaisPlano`/`baixarPecasDoPlano`, `salvarOS` (substitui `salvarManutencao`), `concluirOS`, `renderManutencoes` estendido
- `transportes/index.html` - Seção "Peças previstas" no `modal-plano`; bloco "Lista de compras" na aba Estoque (`tb-compras`, `btn-exportar-compras`, `compras-vazio`); `modal-manutencao` virou "Registrar OS de manutenção" (`mn-plano`, `mn-status`, `mn-pecas`); colunas Status/Ações em `tb-manutencoes`

## Decisions Made
- `onConflict: 'plano_id,material_id'` no `upsert` de `adicionarPecaAoPlano()` reaproveita a constraint `unique(plano_id, material_id)` já criada na migração 23 — vincular a mesma peça duas vezes atualiza a quantidade em vez de falhar
- `baixarPecasDoPlano()` centraliza todo débito de estoque por OS, chamada tanto de `salvarOS()` (quando a OS já nasce concluída) quanto de `concluirOS()` (transição posterior); a mesma guarda de idempotência (`manutencao_id` em `ESTOQUE_MOV`) cobre os dois caminhos
- `COMPRAS` é global do módulo em `UPPER_CASE`, não pendurada em `window._comprasData` como no analog `maquinas/app.js` — segue a convenção já usada por `PLANOS`/`MATERIAIS`/`ESTOQUE_MOV`

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhuma migração nova foi necessária (confirmado pelo próprio plano); todo o trabalho ficou em `transportes/app.js` e `transportes/index.html`.

## Issues Encountered
- Nenhum. Os dois arquivos modificados já continham as globals (`PLANO_MATS`, `MATERIAIS`, `ESTOQUE_MOV`) e as colunas de banco (`plano_id`/`status`/`custo_pecas`) necessárias, herdadas dos Planos 01-01/01-02.

## User Setup Required
None - nenhuma migração ou configuração de serviço externo é necessária nesta plan.

## Next Phase Readiness
- TRANSP-03 e TRANSP-07 completos do ponto de vista de implementação; falta apenas o human-check end-to-end das Tasks 1 e 2 (vincular/remover peça, exportar CSV numa planilha real, abrir/concluir OS conferindo saldo debitado uma única vez, uso do ativo e ocultação para observador) — nenhum desses passos foi executado nesta sessão por não haver ambiente de navegador/Supabase interativo disponível
- Nenhum bloqueio identificado para o Plano 01-04

---
*Phase: 01-transportes-frota-sob-manuten-o*
*Completed: 2026-08-10*

## Self-Check: PASSED

All modified files confirmed on disk (`transportes/app.js`, `transportes/index.html`, this SUMMARY.md). Both task commit hashes (`0d4fa74`, `fc2e968`) confirmed in `git log`.
