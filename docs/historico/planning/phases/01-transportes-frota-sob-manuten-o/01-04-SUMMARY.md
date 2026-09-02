---
phase: 01-transportes-frota-sob-manuten-o
plan: 04
subsystem: database
tags: [supabase, postgres, rls, data-conference, transportes, inventory-reconciliation]

# Dependency graph
requires:
  - phase: 01-transportes-frota-sob-manuten-o
    provides: "transp_planos, transp_pode_escrever() (Plano 01-01)"
  - phase: 01-transportes-frota-sob-manuten-o
    provides: "transp_materiais, transp_plano_materiais, transp_estoque_movimentos (Plano 01-02)"
  - phase: 01-transportes-frota-sob-manuten-o
    provides: "Vínculo peça-plano, lista de compras, OS com baixa de estoque (Plano 01-03)"
provides:
  - "Relatório de conferência pós-import (01-CONFERENCIA-IMPORT.md) validado contra o mapa VTR/EMB real"
  - "Inventário corrigido: 43 ativos (33 viaturas + 10 embarcações), não os 9 originalmente importados"
  - "Migração supabase/24_transportes_inventario_completo.sql, aplicada em produção"
  - "Evidência de não regressão de Refrigeração/Máquinas e isolamento das migrações do módulo"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conferência de import por reconciliação linha-a-linha contra a fonte primária correta (PDF do inventário), não contra um documento de nome similar mas de natureza diferente (CSV de viagens)"
    - "Import de equipamento sem placa: XXX do mapa vira identificacao = null, nunca a string literal"
    - "unidade_uso por natureza operacional do equipamento (horímetro vs. hodômetro), não pela categoria de schema (viatura vs. embarcação)"

key-files:
  created:
    - supabase/24_transportes_inventario_completo.sql
  modified:
    - .planning/phases/01-transportes-frota-sob-manuten-o/01-CONFERENCIA-IMPORT.md

key-decisions:
  - "O CSV ref/Mapa de VTR e EMB ATU 20FEV26.csv NÃO é o inventário — é um registro de viagens de um único dia (30JAN). O inventário real está no PDF de mesmo nome, com 43 ativos, não 9. O nome quase idêntico dos dois arquivos causou a confusão original no seed 11."
  - "Migração 24 corrige o achado sem alterar transportes/app.js nem transportes/index.html — é puramente dado (DML sobre transp_ativos), sem mudança de schema, RLS ou frontend"
  - "Equipamentos como empilhadeira, trator e guindaste são tipo='viatura' no schema mas unidade_uso='h' (horímetro), não 'km' — o must-have original ('toda viatura = km') foi substituído por essa regra mais precisa"
  - "VTR-012 (FIAT DUCATO) foi importado como status='disponivel' seguindo o mapa; o usuário confirmou em 10/08/2026 que está inoperante e o status foi corrigido para 'indisponivel' no banco e na migração 24 (commit 33fc6db)"

requirements-completed: [TRANSP-01, TRANSP-09, INTEG-02, INTEG-03, INTEG-04]

coverage:
  - id: D1
    description: "Relatório de conferência (01-CONFERENCIA-IMPORT.md) reescrito para refletir o inventário real de 43 ativos (33 viaturas + 10 embarcações), reconciliado linha a linha contra o PDF do mapa VTR/EMB, com as 23 viagens do CSV mantidas como fonte correta desse dado específico"
    requirement: "TRANSP-09"
    verification:
      - kind: other
        ref: "gates estáticos (grep de seções/códigos VTR/EMB) — todos passaram; reconciliação manual de 43/43 ativos contra o PDF por este executor"
        status: pass
    human_judgment: true
    rationale: "A correspondência entre inventário e mapa é, por definição da D-02, uma confirmação humana — o usuário já aplicou a migração 24 via MCP e conferiu as contagens em produção antes de instruir a finalização desta plan; este executor não tem acesso direto ao console/MCP para revalidar ao vivo nesta sessão"
  - id: D2
    description: "supabase/24_transportes_inventario_completo.sql aplicada em produção (commit c7c9c2c, fora do escopo de execução direta deste plano) corrigindo os 9 ativos antigos e acrescentando os 34 ausentes, com placas, status operacional, subtipo e tipo_modelo corretos"
    requirement: "TRANSP-01"
    verification:
      - kind: other
        ref: "contagens pós-aplicação relatadas pelo coordenador: total 43, viaturas 33, embarcações 10, sem placa 16, sem tipo_modelo 0, viagens 23, embarcação com unidade != h: 0, INOP 25/43"
        status: pass
    human_judgment: true
    rationale: "Migração em banco de produção compartilhado, aplicada e conferida via MCP do Supabase pelo usuário/coordenador fora da sessão direta deste executor"
  - id: D3
    description: "Seção 'Não regressão da produção' (Task 3): isolamento de arquivos desde o commit base, isolamento das três migrações da fase (22/23/24) sem referência a outros módulos e sem remoção destrutiva, prefixação transp_ de todos os objetos novos, rotas e portal conferidos, sintaxe JS e serving estático conferidos"
    requirement: "INTEG-04"
    verification:
      - kind: other
        ref: "git diff --name-status restrito a refrigeracao/maquinas/shared/auth.js (vazio); grep de referência cruzada nas migrações 22/23/24 (0 ocorrências); node --check nos três app.js; curl HTTP 200 nas três rotas"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rotas /refrigeracao, /maquinas, /transportes declaradas em vercel.json e cartão do portal apontando para /transportes"
    requirement: "INTEG-02"
    verification:
      - kind: other
        ref: "grep das três rotas em vercel.json e do href do portal em index.html — todos passaram"
        status: pass
    human_judgment: false
  - id: D5
    description: "Login por cargo funcional e escrita bloqueada para o cargo observador contra chamada direta à API (RBAC via transp_pode_escrever(), migrações 22/23, herdado dos Planos 01-01/01-02)"
    requirement: "INTEG-03"
    verification: []
    human_judgment: true
    rationale: "Verificação end-to-end (tela de login sem e-mails, teste de escrita recusado pelo console como observador, gravação funcionando como gestor, reidratação de sessão entre módulos) é o objeto da Parte B do checkpoint da Task 2; este executor não tem visibilidade direta da transcrição dessa verificação, que ocorreu fora desta sessão — o coordenador instruiu a finalização do plano sem reportar falha nessa parte, mas a ausência de evidência direta aqui é registrada para auditoria"

duration: ~50min de trabalho ativo do executor (geração do relatório original, checkpoint, reescrita pós-correção); o ciclo completo incluindo a revisão humana e a aplicação da migração 24 se estendeu por ~5h de calendário
completed: 2026-08-10
status: complete
---

# Phase 1 Plan 4: Conferência do import, RLS por cargo e não regressão da produção Summary

**Relatório de conferência corrigido: o inventário real da frota é 43 ativos (33 viaturas + 10 embarcações), não os 9 originalmente importados — o seed 11 confundiu um registro de viagens de um dia com o inventário completo, corrigido pela migração `supabase/24_transportes_inventario_completo.sql` já aplicada e conferida em produção.**

## Performance

- **Duration:** ~50 min de trabalho ativo do executor, em duas rodadas (geração inicial do relatório + reescrita pós-correção), separadas por um checkpoint bloqueante de validação humana que se estendeu por horas de calendário
- **Started:** 2026-08-10T16:10:00Z (aprox.)
- **Completed:** 2026-08-10T21:14:00Z
- **Tasks:** 3 (1 auto + 1 checkpoint:human-verify blocking + 1 auto), mais uma correção pós-checkpoint dirigida pelo coordenador
- **Files modified:** 2 (1 relatório reescrito, 1 SUMMARY criado) — nenhum arquivo de código do módulo Transportes tocado por este plano

## Accomplishments
- `01-CONFERENCIA-IMPORT.md` gerado originalmente a partir do seed 11 e do CSV `ref/Mapa de VTR e EMB ATU 20FEV26.csv`, com contagens de 9 ativos (6 viaturas + 3 embarcações) e 23 viagens, declarando "zero divergência" — **essa conclusão estava incorreta**, porque o CSV usado é um registro de viagens de um único dia, não o inventário completo
- A Parte A do checkpoint da Task 2 (validação humana contra o mapa real) revelou a divergência: o inventário verdadeiro, no PDF `Mapa de VTR e EMB ATU 20FEV26.pdf`, tem **43 ativos** (33 viaturas + 10 embarcações) — mais de quatro vezes o que havia sido importado
- Migração `supabase/24_transportes_inventario_completo.sql` (commit `c7c9c2c`, aplicada fora da execução direta deste plano, via MCP do Supabase, e conferida pelo usuário) corrigiu os 9 ativos já importados (placas de VTR-003/004/005, remoção da string "GUINDASTE" indevidamente gravada como placa de VTR-006, estado operacional de EMB-001 e VTR-001) e acrescentou os 34 ausentes (7 embarcações EMB-004..010, 27 viaturas VTR-007..033), com `subtipo`/`tipo_modelo` preenchidos em todos os 43
- `01-CONFERENCIA-IMPORT.md` foi **inteiramente reescrito**: nova Seção 0 explicando o achado central (CSV ≠ inventário), contagens corrigidas para 43/33/10, correção ao must-have de unidade de uso (empilhadeira/trator/guindaste são `'h'` mesmo sendo `tipo='viatura'`), reinterpretação da seção de lacunas (16 ativos sem placa por não terem placa no próprio mapa, não por falha documental — as 3 lacunas antigas foram resolvidas), e registro explícito da pendência aberta do VTR-012 (FIAT DUCATO — "P" no mapa mas com nota de que está na oficina JOMAP), deixada sem resolução por instrução do usuário
- Seção "Não regressão da produção" (Task 3) executada e anexada ao relatório: Refrigeração, Máquinas e `shared/auth.js` confirmados intocados desde o commit base `67bef6e`; as três migrações da fase (22/23/24) isoladas, sem referência a outros módulos e sem remoção destrutiva; todos os objetos novos prefixados com `transp_`; as três rotas e o cartão do portal conferidos; sintaxe JS e serving estático conferidos (checagem de console de navegador real registrada como pendente, por falta de ferramenta de navegador interativo nesta sessão)

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Gerar o relatório de conferência do inventário importado** - `460edaa` (feat) — versão original, baseada no CSV, posteriormente corrigida
2. **Task 2: [BLOCKING] Validação humana do import e do controle de acesso por cargo** - checkpoint humano; Parte A não aprovada como estava (divergência CSV-vs-PDF), correção conduzida pelo usuário fora desta sessão de execução direta
3. **(fora do plano, aplicada durante o checkpoint) Migração 24 — inventário completo:** `c7c9c2c` (feat), aplicada em produção via MCP e conferida pelo usuário
4. **Correção do relatório pós-checkpoint (reescrita completa + Task 3 anexada):** `89234e3` (fix)

**Plan metadata:** commit deste SUMMARY, a seguir.

_Nenhuma tarefa desta plan usa TDD — não há commits test→feat→refactor separados._

## Files Created/Modified
- `.planning/phases/01-transportes-frota-sob-manuten-o/01-CONFERENCIA-IMPORT.md` - Relatório de conferência do inventário, reescrito integralmente após a Parte A do checkpoint revelar a divergência CSV-vs-PDF; inclui a seção "Não regressão da produção" (Task 3)
- `supabase/24_transportes_inventario_completo.sql` - **Não criado por este executor** (commit `c7c9c2c`, aplicado fora desta sessão de execução direta) — referenciado e conferido linha a linha contra o PDF do mapa como parte da reescrita do relatório

## Decisions Made
- O CSV `ref/Mapa de VTR e EMB ATU 20FEV26.csv` continua sendo a fonte correta das 23 viagens históricas — o erro estava em usá-lo também como fonte do inventário, não em tê-lo usado para as viagens
- `unidade_uso` é definido pela natureza operacional do equipamento (horímetro vs. hodômetro), não pela categoria de schema (`tipo = 'viatura'` vs. `'embarcacao'`) — empilhadeira, trator e guindaste são `'viatura'` no schema mas `'h'` na unidade de uso
- Ativos sem placa no próprio mapa (`XXX`) recebem `identificacao = null`, nunca a string literal `'XXX'` nem um valor inventado
- VTR-012 foi importado como `status = 'disponivel'` seguindo literalmente o mapa; a contradição sobre a oficina JOMAP foi levada ao usuário, que confirmou INOP em 10/08/2026 — corrigido para `'indisponivel'` no banco e na migração 24 (commit `33fc6db`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 aplicada pelo coordenador/usuário — Correção arquitetural de dado] Inventário importado com fonte errada, corrigido por migração não prevista no plano**
- **Found during:** Task 2 (Parte A do checkpoint bloqueante) — o usuário confrontou o relatório original contra o PDF real do mapa e identificou que o CSV usado como fonte é um registro de viagens, não o inventário
- **Issue:** O seed `11_transportes_seed.sql` (de plano anterior a este, fora do escopo desta fase) importou apenas os 9 ativos que apareciam em viagens de um único dia (30JAN) no CSV `ref/Mapa de VTR e EMB ATU 20FEV26.csv`, tratando-os como se fossem o inventário completo da frota. O inventário real, conforme `Mapa de VTR e EMB ATU 20FEV26.pdf`, tem 43 ativos — mais de quatro vezes o volume importado. Esta é uma divergência de dado, não um bug de código, mas afeta diretamente o must-have "o inventário importado contém 9 ativos... conforme o mapa VTR/EMB", que estava fundamentado numa premissa factualmente incorreta.
- **Fix:** Migração `supabase/24_transportes_inventario_completo.sql`, criada e aplicada fora da execução direta deste plano (por decisão e ação do usuário/coordenador, via MCP do Supabase), corrigindo os 9 ativos já importados e acrescentando os 34 ausentes, com placas, estado operacional, `subtipo` e `tipo_modelo` extraídos do PDF.
- **Files modified:** `supabase/24_transportes_inventario_completo.sql` (fora desta sessão); `.planning/phases/01-transportes-frota-sob-manuten-o/01-CONFERENCIA-IMPORT.md` (reescrito por este executor para refletir a correção)
- **Verification:** Contagens pós-aplicação relatadas pelo coordenador (total 43, viaturas 33, embarcações 10, sem placa 16, sem tipo_modelo 0, viagens 23 preservadas, INOP 25/43 no momento do relato — passou para 26/43 após a correção do VTR-012, commit `33fc6db`, ver deviation 2 abaixo); reconciliação independente linha a linha de todos os 43 ativos contra o PDF, feita por este executor durante a reescrita do relatório.
- **Committed in:** `c7c9c2c` (migração, fora desta sessão) e `89234e3` (reescrita do relatório, por este executor)

**2. [Rule 1 aplicada pelo usuário — Correção de dado divergente da própria fonte] VTR-012 (FIAT DUCATO) marcado INOP apesar de o mapa dizer "P"**
- **Found during:** Reescrita do relatório de conferência (Seção 5) — a linha do VTR-012 no mapa traz simultaneamente o código "P" (disponível) e uma restrição textual dizendo que a viatura está na oficina JOMAP para delineamento, uma contradição na própria fonte primária
- **Issue:** A migração 24, na sua primeira versão, seguiu literalmente a coluna de estado operacional ("P") e importou `status = 'disponivel'`, apesar da restrição textual indicar que o ativo está indisponível na prática
- **Fix:** O usuário confirmou em 10/08/2026 que a viatura está inoperante; `status` corrigido para `'indisponivel'` tanto no `insert` quanto num `update` próprio na migração 24 (necessário porque o `insert` usa `on conflict do nothing` e não alcançaria uma linha já existente numa reexecução)
- **Files modified:** `supabase/24_transportes_inventario_completo.sql`; `.planning/phases/01-transportes-frota-sob-manuten-o/01-CONFERENCIA-IMPORT.md` (Seção 2 e Seção 5 atualizadas para refletir a correção e o novo total de 26 INOP)
- **Verification:** Commit `33fc6db` aplicado sobre a migração; relatório de conferência atualizado com o precedente registrado ("onde a restrição contradiz o 'P', a restrição tende a ser a informação mais atual")
- **Committed in:** `33fc6db` (fora desta sessão de execução direta)

---

**Total deviations:** 2 (1 correção de dado de escopo arquitetural — must-have original substituído por descoberta desta própria conferência; 1 correção pontual de estado operacional de um único ativo cuja própria fonte se contradizia — ambas conduzidas com aprovação/confirmação explícita do usuário)
**Impact on plan:** O objetivo da Task 2/D-02 — comprovar a correspondência entre inventário importado e mapa legado antes de fechar TRANSP-09 — funcionou exatamente como desenhado: a conferência humana pegou um erro real que a Task 1 automatizada não tinha como detectar sozinha (comparar contra a fonte errada não gera divergência aparente). Sem scope creep além do necessário para corrigir o dado incorreto; nenhum código de aplicação foi alterado.

## Issues Encountered
- Nenhuma ferramenta MCP do Supabase estava disponível para este executor nesta sessão direta — as contagens finais de 43 ativos citadas neste relatório vêm da consulta ao vivo relatada pelo coordenador/usuário (que aplicou e conferiu a migração 24 via MCP), não de uma consulta executada por este agente. A reconciliação independente feita por este executor foi estática: migração 24 lida linha a linha e comparada manualmente contra o texto extraído do PDF do mapa.
- Este executor não teve visibilidade direta da transcrição da Parte B do checkpoint da Task 2 (teste de escrita como observador contra `transp_planos`, verificação da tela de login sem e-mails internos, gravação como Gestor, reidratação de sessão entre `/maquinas` e `/transportes`). O coordenador instruiu a finalização do plano sem reportar falha nessa parte, mas a ausência de evidência direta é registrada aqui para fins de auditoria (ver `coverage` D5 no frontmatter).
- Sem ferramenta de navegador interativo disponível nesta sessão para a checagem de console de Refrigeração/Máquinas prevista no `human-check` da Task 3 — servido estaticamente e sintaticamente válido (`node --check`, HTTP 200), mas a confirmação final "carrega sem erro no console" fica registrada como pendência no relatório.

## User Setup Required
None - a migração 24 já foi aplicada e conferida em produção pelo usuário antes desta finalização; nenhuma configuração adicional é necessária.

## Next Phase Readiness
- O módulo Transportes está com o inventário real (43 ativos) refletido no banco de produção; a Fase 2 (abastecimento, documentação e painel) pode assumir esse volume real de frota, não os 9 ativos do seed original
- ✅ **Resolvido em 10/08/2026:** a contradição do VTR-012 (FIAT DUCATO) entre o "P" do mapa e a restrição de estar na oficina JOMAP foi levada ao usuário, que confirmou INOP. Status corrigido para `'indisponivel'`. Precedente registrado: onde a coluna de restrições contradiz o "P", a restrição é a informação mais atual
- **Pendência aberta, não bloqueante:** checagem de console de navegador real para Refrigeração/Máquinas (INTEG-04) e a transcrição completa da Parte B do checkpoint (INTEG-03) não foram diretamente observadas por este executor — recomenda-se confirmação humana explícita antes de considerar a fase 100% fechada, mesmo que o coordenador tenha direcionado a finalização da documentação
- Nenhum bloqueio para a Fase 2

---
*Phase: 01-transportes-frota-sob-manuten-o*
*Completed: 2026-08-10*

## Self-Check: PASSED

All referenced files confirmed on disk (`01-CONFERENCIA-IMPORT.md`, `supabase/24_transportes_inventario_completo.sql`, this SUMMARY.md). All referenced commit hashes (`460edaa`, `c7c9c2c`, `89234e3`) confirmed in `git log --oneline --all`.
