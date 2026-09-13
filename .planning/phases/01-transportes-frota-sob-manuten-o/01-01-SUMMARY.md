---
phase: 01-transportes-frota-sob-manuten-o
plan: 01
subsystem: database
tags: [supabase, postgres, rls, rbac, vanilla-js, transportes]

# Dependency graph
requires: []
provides:
  - "Tabela transp_planos (planos de manutenção por tipo_modelo, intervalo em km ou h)"
  - "Função transp_pode_escrever() como padrão de RBAC reutilizável pelas demais tabelas novas do módulo Transportes"
  - "Aba Planos funcional em /transportes com CRUD de plano e unidade herdada do modelo (D-04)"
  - "Cálculo de vencimento por uso acumulado (calcVencimentos/renderVencimentos), visível no Painel (kpi-vencidas) e na aba Manutenção"
affects: [01-02, 01-03, 01-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RBAC mínimo via função SQL SECURITY DEFINER (transp_pode_escrever) em vez de custom JWT claims — reutilizável pelas próximas migrações do módulo"
    - "Vencimento por uso acumulado (uso_atual vs. intervalo do plano), portado do padrão já em produção em maquinas/app.js"

key-files:
  created:
    - supabase/22_transportes_planos_rbac.sql
  modified:
    - transportes/app.js
    - transportes/index.html

key-decisions:
  - "transp_pode_escrever() exige usuarios.ativo = true além do cargo, alinhando com o padrão já usado em 12_maquinas_areas_operacoes.sql (deviation aplicada pelo orquestrador, commit 39ba5ce)"
  - "Leitura de transp_planos permanece pública (using (true)) para preservar acesso do cargo observador; apenas insert/update/delete passam por transp_pode_escrever()"

patterns-established:
  - "Pattern 3 (01-RESEARCH.md): função RBAC SECURITY DEFINER + policies condicionadas, sem with check (true) constante — modelo para as tabelas novas restantes desta fase (transp_materiais, transp_plano_materiais, transp_estoque_movimentos)"

requirements-completed: [TRANSP-02, TRANSP-04]

coverage:
  - id: D1
    description: "Migração 22 cria transp_planos com constraints (intervalo > 0, unidade in km/h) e é aditiva"
    requirement: "TRANSP-02"
    verification:
      - kind: other
        ref: "gates estáticos da Task 1 (grep sobre supabase/22_transportes_planos_rbac.sql) — todos passaram"
        status: pass
    human_judgment: false
  - id: D2
    description: "Migração 22 aplicada ao projeto pmoc de produção; RLS/policies confirmadas; Refrigeração e Máquinas continuam carregando"
    requirement: "TRANSP-02"
    verification: []
    human_judgment: true
    rationale: "Aplicação em banco de produção compartilhado — confirmação humana obrigatória (checkpoint blocking da Task 2), já obtida (\"aprovado\")"
  - id: D3
    description: "Gestor cadastra plano por tipo_modelo com unidade herdada do modelo (D-04); observador não vê botão de criação"
    requirement: "TRANSP-02"
    verification: []
    human_judgment: true
    rationale: "Fluxo de UI multi-papel (gestor vs. observador) — verificação humana prevista no próprio plano (human-check da Task 3)"
  - id: D4
    description: "Vencimento por uso acumulado calculado e exibido no Painel (kpi-vencidas) e na aba Manutenção (venc-lista-manut), com percentual limitado a 100 e par unidade-incoerente descartado"
    requirement: "TRANSP-04"
    verification:
      - kind: other
        ref: "gates estáticos da Task 3 (node --check, grep de calcVencimentos/renderVencimentos/Math.min(100/unidade !== ativo.unidade_uso) — todos passaram"
        status: pass
    human_judgment: true
    rationale: "Cálculo correto depende de dado real vencido/próximo em produção — human-check da Task 3 cobre o cenário fim a fim"

duration: 17min
completed: 2026-08-10
status: complete
---

# Phase 1 Plan 1: Planos de manutenção por uso e RBAC do módulo Transportes Summary

**Tabela `transp_planos` com RBAC via `transp_pode_escrever()` (SECURITY DEFINER), aba Planos em `/transportes` e cálculo de vencimento por uso acumulado (km/h) portado do padrão já em produção em `maquinas/app.js`.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-10T15:26:45Z
- **Completed:** 2026-08-10T15:43:50Z
- **Tasks:** 3 (1 auto + 1 checkpoint:human-verify + 1 auto)
- **Files modified:** 3 (1 criado, 2 modificados)

## Accomplishments
- Migração aditiva `supabase/22_transportes_planos_rbac.sql` criada, aplicada em produção (`pmoc`) e confirmada pelo usuário: tabela `transp_planos`, função `transp_pode_escrever()` com `search_path` fixado e `auth.uid()` em subquery, grants de tabela e de sequence, quatro policies (`sel_/ins_/upd_/del_transp_planos`) sem condição permissiva constante
- Aba "🗓️ Planos" em `/transportes`: tabela de planos, modal de cadastro/edição com unidade herdada automaticamente do `tipo_modelo` (D-04), botão de criação oculto para observador
- `calcVencimentos()`/`renderVencimentos()` cruzam `PLANOS` × `ATIVOS` por `tipo_modelo`, descartam par com unidade divergente, usam 0 como uso de referência na ausência de manutenção concluída, limitam o percentual do intervalo a 100 e alimentam o KPI `kpi-vencidas` do Painel e o novo container `venc-lista-manut` na aba Manutenção
- Refrigeração e Máquinas confirmados intactos após a migração (INTEG-04)

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Criar a migração 22 com transp_planos e o RBAC do módulo** - `6268870` (feat)
2. **Task 2: [BLOCKING] Aplicar a migração 22 no Supabase de produção** - checkpoint humano, sem commit próprio (aplicação feita via SQL Editor pelo usuário; ajuste de RBAC entrou como deviation abaixo)
3. **Task 3: Aba Planos e detecção de vencimento por uso** - `7a8fc67` (feat)

**Deviation commit (aplicado pelo orquestrador durante o checkpoint):** `39ba5ce` — `fix(22): exige usuario ativo na funcao de RBAC do modulo transportes`

_Nenhuma tarefa desta plan usa TDD — não há commits test→feat→refactor separados._

## Files Created/Modified
- `supabase/22_transportes_planos_rbac.sql` - Tabela `transp_planos`, índice, função `transp_pode_escrever()`, grants e RLS
- `transportes/app.js` - Globals `PLANOS`/`PLANO_EDIT_ID`, `LIMIAR_PROXIMO`, CRUD de plano e cálculo/renderização de vencimento por uso
- `transportes/index.html` - Nova aba Planos, KPI `kpi-vencidas`, container `venc-lista-manut` na aba Manutenção e `modal-plano`

## Decisions Made
- `transp_pode_escrever()` checa `usuarios.ativo = true` além do cargo, alinhando com o padrão já estabelecido em `12_maquinas_areas_operacoes.sql` (ver Deviations)
- Leitura de `transp_planos` permanece pública (`using (true)`) para não quebrar o acesso somente-leitura do cargo observador/painel; apenas escrita passa pela função de RBAC

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `transp_pode_escrever()` passou a exigir `usuarios.ativo = true`**
- **Found during:** Task 2 (checkpoint de aplicação da migração 22), aplicado pelo orquestrador antes da aplicação em produção
- **Issue:** A função conforme especificada no plano checava apenas `u.role in ('admin','gestor','tecnico')`, permitindo que um usuário com `usuarios.ativo = false` continuasse escrevendo em `transp_planos`. A convenção já estabelecida no projeto (`supabase/12_maquinas_areas_operacoes.sql:52`) checa `ativo = true` junto com o cargo.
- **Fix:** Acrescentada a condição `and u.ativo = true` antes da checagem de `role` dentro de `transp_pode_escrever()`.
- **Files modified:** `supabase/22_transportes_planos_rbac.sql`
- **Verification:** Migração aplicada em produção já com a correção; `select transp_pode_escrever();` executa sem erro; policies de `transp_planos` confirmadas em `pg_policies`.
- **Committed in:** `39ba5ce` (fix, antes do checkpoint ser aprovado)

---

**Total deviations:** 1 auto-fixed (1 Rule 2 - missing critical, aplicado pelo orquestrador durante o checkpoint da Task 2)
**Impact on plan:** Correção necessária para segurança (usuário desativado não deve reter capacidade de escrita); sem scope creep — mesma tabela e mesma função já previstas no plano.

## Issues Encountered
- Nenhuma ferramenta MCP do Supabase estava disponível nesta sessão para aplicar a migração 22 automaticamente; o caminho manual (SQL Editor do dashboard) previsto como alternativa no próprio plano foi usado, com confirmação explícita do usuário ("aprovado").

## User Setup Required
None - nenhuma configuração de serviço externo além da aplicação manual da migração SQL, já realizada e confirmada no checkpoint da Task 2.

## Next Phase Readiness
- `transp_pode_escrever()` está pronta para ser reutilizada pelas policies das próximas tabelas novas do módulo (`transp_materiais`, `transp_plano_materiais`, `transp_estoque_movimentos`), previstas nos planos seguintes desta fase (TRANSP-03/TRANSP-07)
- `transp_manutencoes` ainda não tem a coluna `status` (chega na migração 23) — `calcVencimentos()` já foi escrita de forma tolerante a essa ausência, sem necessidade de reescrita futura
- Nenhum bloqueio identificado para o Plano 01-02

---
*Phase: 01-transportes-frota-sob-manuten-o*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created files confirmed on disk (`supabase/22_transportes_planos_rbac.sql`, `transportes/app.js`, `transportes/index.html`, this SUMMARY.md). All referenced commit hashes (`6268870`, `39ba5ce`, `7a8fc67`) confirmed in `git log`.
