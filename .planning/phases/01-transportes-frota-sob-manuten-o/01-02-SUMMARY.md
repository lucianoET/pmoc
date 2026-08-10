---
phase: 01-transportes-frota-sob-manuten-o
plan: 02
subsystem: database
tags: [supabase, postgres, rls, rbac, vanilla-js, transportes, estoque]

# Dependency graph
requires:
  - phase: 01-transportes-frota-sob-manuten-o
    provides: "transp_planos e transp_pode_escrever() (migração 22, Plano 01-01)"
provides:
  - "Tabelas transp_materiais, transp_plano_materiais e transp_estoque_movimentos, com estoque próprio do módulo (D-06)"
  - "Colunas plano_id/status/custo_pecas em transp_manutencoes, prontas para a OS do Plano 01-03"
  - "Aba Estoque em /transportes: cadastro de peça, registro de movimento e alerta de estoque mínimo"
affects: [01-03, 01-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reutilização (sem redefinição) de função RBAC SECURITY DEFINER já existente — policies das tabelas novas apenas invocam transp_pode_escrever() criada na migração 22"
    - "Saldo de estoque calculado no cliente e gravado por update, com CHECK (estoque_atual >= 0) no banco como barreira final contra negativo (mesmo padrão de dívida técnica já documentado para maq_materiais em CONCERNS.md)"

key-files:
  created:
    - supabase/23_transportes_estoque_os.sql
  modified:
    - transportes/app.js
    - transportes/index.html

key-decisions:
  - "transp_pode_escrever() não foi redefinida — a migração 23 reutiliza a função da migração 22 (já com o ativo=true corrigido), evitando um create or replace desnecessário sobre objeto em produção"
  - "Policies de transp_manutencoes herdadas da migração 10 (sem distinção de cargo) não foram alteradas, conforme decisão registrada no plano; risco residual documentado como T-02-05 (accept) no modelo de ameaças"

requirements-completed: [TRANSP-07]

coverage:
  - id: D1
    description: "Migração 23 cria transp_materiais/transp_plano_materiais/transp_estoque_movimentos com constraints de não negatividade, acrescenta plano_id/status/custo_pecas a transp_manutencoes via ADD COLUMN IF NOT EXISTS, cria os 5 índices de FK e reutiliza transp_pode_escrever() sem redefini-la"
    requirement: "TRANSP-07"
    verification:
      - kind: other
        ref: "gates estáticos da Task 1 (grep sobre supabase/23_transportes_estoque_os.sql) — todos passaram, incluindo ausência de with check (true), de DROP destrutivo e de referência a maq_/equipamentos/arp_/os_contratacao"
        status: pass
    human_judgment: false
  - id: D2
    description: "Migração 23 aplicada ao projeto pmoc de produção; transp_materiais e transp_estoque_movimentos existem vazias; as três colunas novas de transp_manutencoes respondem; transp_viagens continua com 23 linhas; Refrigeração e Máquinas seguem carregando"
    requirement: "TRANSP-07"
    verification: []
    human_judgment: true
    rationale: "Aplicação em banco de produção compartilhado com Refrigeração e Máquinas — confirmação humana obrigatória (checkpoint blocking da Task 2), já obtida (\"aprovado\", com as quatro contagens/leituras de comprovação confirmadas pelo usuário)"
  - id: D3
    description: "Gestor cadastra peça com estoque mínimo/preço, registra entrada e saída, vê peças abaixo do mínimo destacadas na aba Estoque e no KPI do Painel, saída que zeraria o saldo negativo é recusada com mensagem clara, e observador não vê os botões de cadastro/movimento"
    verification: []
    human_judgment: true
    rationale: "Fluxo de UI multi-papel (gestor vs. observador) com regra de negócio (bloqueio de saldo negativo) — verificação humana prevista no próprio plano (human-check da Task 3), ainda não executada nesta sessão"

duration: ~10min (exclui a espera pela confirmação humana do checkpoint da Task 2)
completed: 2026-08-10
status: complete
---

# Phase 1 Plan 2: Estoque de peças do módulo Transportes Summary

**Tabelas `transp_materiais`/`transp_plano_materiais`/`transp_estoque_movimentos` (estoque próprio do módulo, D-06) com RBAC reaproveitado da migração 22, colunas de OS em `transp_manutencoes`, e aba "Estoque" em `/transportes` com cadastro de peça, movimento de entrada/saída e alerta de estoque mínimo.**

## Performance

- **Duration:** ~10 min de trabalho ativo (Tasks 1 e 3); a Task 2 é um checkpoint bloqueante de aplicação em produção, confirmado pelo usuário fora da janela de execução ativa
- **Started:** 2026-08-10T15:45:00Z (aprox., leitura inicial dos arquivos do plano)
- **Completed:** 2026-08-10T15:53:37Z
- **Tasks:** 3 (1 auto + 1 checkpoint:human-verify blocking + 1 auto)
- **Files modified:** 3 (1 criado, 2 modificados)

## Accomplishments
- Migração aditiva `supabase/23_transportes_estoque_os.sql` criada, com gates estáticos 100% aprovados, aplicada em produção (`pmoc`) e confirmada pelo usuário: `transp_materiais`, `transp_plano_materiais` e `transp_estoque_movimentos` com `check (estoque_atual >= 0)`/`check (estoque_minimo >= 0)`; `transp_manutencoes` estendida com `plano_id`/`status`/`custo_pecas` via `ADD COLUMN IF NOT EXISTS`; 5 índices de chave estrangeira; grants de tabela e de sequence; policies `sel_/ins_/upd_/del_` reutilizando (sem redefinir) `transp_pode_escrever()` da migração 22
- Aba "📦 Estoque" em `/transportes`: tabela de peças com badge de situação (Baixo/OK/Arquivada), callout de alertas de estoque mínimo, histórico de movimentos (últimos 200, mais recentes primeiro), modais de cadastro de peça e de registro de movimento, botões ocultos para observador
- `materiaisAbaixoDoMinimo()` exige `estoque_minimo > 0` — peça sem mínimo definido nunca é sinalizada como estoque baixo, conforme must_have do plano
- `salvarMovimento()` calcula o novo saldo no cliente e recusa a operação com `alert` antes de qualquer escrita quando o resultado seria negativo; o `check (estoque_atual >= 0)` do banco permanece como barreira final contra escrita direta via API (T-02-03)
- Migração aditiva confirmada sem perda de dados: `transp_viagens` seguiu com 23 linhas após aplicar a migração 23; Refrigeração e Máquinas confirmados intactos (INTEG-04)
- Suíte `tests/*.test.js` (`node <arquivo>`) continua passando integralmente (19 testes, 0 falhas) após as mudanças

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Criar a migração 23 com estoque, vínculo plano-material e colunas de OS** - `fbebd52` (feat)
2. **Task 2: [BLOCKING] Aplicar a migração 23 no Supabase de produção** - checkpoint humano, sem commit próprio (aplicação feita via SQL Editor pelo usuário, sem MCP do Supabase disponível nesta sessão; confirmação explícita recebida: "aprovado")
3. **Task 3: Aba Estoque com cadastro de peças, movimentos e alerta de estoque mínimo** - `ca2540d` (feat)

_Nenhuma tarefa desta plan usa TDD — não há commits test→feat→refactor separados._

## Files Created/Modified
- `supabase/23_transportes_estoque_os.sql` - Tabelas `transp_materiais`/`transp_plano_materiais`/`transp_estoque_movimentos`, colunas de OS em `transp_manutencoes`, índices, grants e RLS reutilizando `transp_pode_escrever()`
- `transportes/app.js` - Globals `MATERIAIS`/`ESTOQUE_MOV`/`PLANO_MATS`/`MATERIAL_EDIT_ID`, `carregarTudo()` estendido, `materiaisAbaixoDoMinimo()`, `renderMateriais()`, `renderMovimentos()`, CRUD de material e registro de movimento de estoque
- `transportes/index.html` - Nova aba Estoque, KPI `kpi-estoque-baixo`, `modal-material` e `modal-movimento`

## Decisions Made
- `transp_pode_escrever()` não é redefinida na migração 23 — reutilizada tal como corrigida na migração 22 (`usuarios.ativo = true` + cargo), evitando qualquer risco de sobrescrever um objeto de produção com uma versão desatualizada do plano
- Policies de `transp_manutencoes` (herdadas da migração 10, sem distinção de cargo) permanecem inalteradas — decisão já registrada no plano e no modelo de ameaças (T-02-05, accept), fora do escopo desta migração

## Deviations from Plan

None - plan executado exatamente como escrito. A aplicação manual da migração via SQL Editor (em vez de MCP automático) é o caminho alternativo já previsto no próprio texto do plano quando nenhuma ferramenta MCP do Supabase está disponível na sessão — não é uma correção de bug nem um desvio de escopo, e o mesmo padrão já havia ocorrido no Plano 01-01.

## Issues Encountered
- Nenhuma ferramenta MCP do Supabase estava disponível nesta sessão para aplicar a migração 23 automaticamente; o caminho manual (SQL Editor do dashboard), já previsto como alternativa no próprio plano, foi usado pelo usuário, com confirmação explícita ("aprovado") incluindo as quatro contagens/leituras de comprovação.

## User Setup Required
None - nenhuma configuração de serviço externo além da aplicação manual da migração SQL, já realizada e confirmada no checkpoint da Task 2.

## Next Phase Readiness
- `transp_estoque_movimentos.manutencao_id` está pronta para o Plano 01-03 vincular a baixa automática de estoque a uma OS específica e evitar duplicação
- `transp_plano_materiais` foi criada e sua leitura (`PLANO_MATS`) já é carregada por `carregarTudo()`, mas ainda não é consumida por nenhuma tela — consumo previsto no Plano 01-03 (vínculo plano×peça e baixa automática de estoque na OS), conforme já registrado no próprio texto do plano
- `transp_manutencoes.status`/`plano_id`/`custo_pecas` existem e estão prontas para a tela de OS do Plano 01-03
- Human-check da Task 3 (cadastro de peça com mínimo 5, entrada de 10, saída de 50 recusada, botões ocultos para observador) ainda não foi executado end-to-end nesta sessão — recomenda-se confirmar antes de dar TRANSP-07 por totalmente encerrado
- Nenhum bloqueio identificado para o Plano 01-03

---
*Phase: 01-transportes-frota-sob-manuten-o*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created/modified files confirmed on disk (`supabase/23_transportes_estoque_os.sql`, `transportes/app.js`, `transportes/index.html`, this SUMMARY.md). Both task commit hashes (`fbebd52`, `ca2540d`) confirmed in `git log`.
