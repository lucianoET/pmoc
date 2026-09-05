---
phase: 13-gest-o-e-qualidade
plan: 05
subsystem: database
tags: [supabase, migracao, rls, gut, 5w2h, ishikawa, indicadores, pop]

# Dependency graph
requires:
  - phase: 13-gest-o-e-qualidade (planos 13-01, 13-02, 13-03)
    provides: shared/gut.js (GUT_ESCALA, classificarGut, gutTotal) — a escala que a migração 60 espelha no check de g/u/t
provides:
  - supabase/60_gestao_schema.sql — cinco tabelas ges_* (ações 5W2H+GUT, indicadores, série de indicadores, POP, causas Ishikawa), escrita e conferida, NÃO aplicada em produção
  - tests/gestao-schema.test.js — gate permanente que prova a forma do arquivo sem banco e sem depender de gestao/
affects: [13-06 (módulo /gestao, consome estas tabelas e implementa a sonda GES_OK), 13-07 (Onda C)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migração aditiva com cabeçalho-ensaio (por quê, prefixo, ADITIVA/SEM DROP, ORDEM DE PUBLICAÇÃO, sonda) — mesmo formato de supabase/44_refrigeracao_estoque.sql"
    - "RLS reexecutável: drop policy if exists antes de cada create policy, sem loop dinâmico — cada tabela com suas quatro policies escritas por extenso, porque create policy não aceita if not exists e um loop format() não deixaria o grep do plano contar as ocorrências literais"
    - "Coluna gerada (generated always as ... stored) para uma prioridade calculada — gut_total nunca é gravável pelo cliente, mesmo desenho de os_itens.total (migração 43) e maq_contratacao_itens.total (migração 38)"
    - "Escala fechada do banco comparada por teste contra a constante JavaScript (shared/gut.js#GUT_ESCALA), elemento a elemento — não por disciplina de manter os dois textos iguais"

key-files:
  created:
    - supabase/60_gestao_schema.sql
    - tests/gestao-schema.test.js
  modified: []

key-decisions:
  - "RLS sem loop dinâmico (do $$ ... foreach ... $$): o plano exige >=15 ocorrências literais de 'to authenticated' no arquivo (grep sobre o TEXTO, não sobre a execução), e um bloco em loop como o da migração 44 só produz 3 ocorrências independente do número de tabelas no array — por isso as 20 policies (5 tabelas × 4) foram escritas por extenso, uma a uma"
  - "Nenhum grant explícito a anon/authenticated: seguindo o precedente mais recente com prefixo cmasm_ (migração 49), que também não grava grant — e o critério do plano proíbe a palavra 'anon' em qualquer forma no arquivo inteiro, então nomear o papel explicitamente (como a migração 44 faz) quebraria a acceptance criteria"
  - "ges_indicador_valores.indicador_id (FK) não ganhou índice de coluna única separado: a unicidade (indicador_id, periodo) já o lidera, mesmo raciocínio que a migração 44 registrou para estoque_movimentos (os_id, tipo) — evita um índice redundante que a skill de boas práticas não pede quando a FK já lidera outro índice"
  - "Dois índices por modulo em ges_pop e ges_indicadores, além dos explicitamente citados pelo plano (ges_acoes.status/modulo, ges_causas.acao_id) — mesma razão já usada para ges_acoes (a tela sempre filtra por módulo), dentro do 'Claude's Discretion' do 13-CONTEXT; fecham o mínimo de 5 create index sem redundância"
  - "RLS de escrita SEM checagem de cargo (para authenticated using(true), sem exists(select ... usuarios.role)), diferente do estilo de migração 49/38 — porque D-13-05 e o threat model do próprio plano (T-13-20) descrevem explicitamente o padrão simples já vigente na plataforma, aceitando que o cargo filtra só na tela"

requirements-completed: [GEQ-06, GEQ-07, GEQ-08]

coverage:
  - id: D1
    description: "Migração 60 escrita: cinco tabelas ges_* aditivas, sem DROP, com RLS leitura pública/escrita autenticada"
    requirement: "GEQ-06"
    verification:
      - kind: unit
        ref: "tests/gestao-schema.test.js#as cinco tabelas nascem com create table if not exists e prefixo ges_"
        status: pass
      - kind: unit
        ref: "tests/gestao-schema.test.js#a migração é aditiva — nenhum drop de tabela ou coluna em lugar nenhum"
        status: pass
      - kind: unit
        ref: "tests/gestao-schema.test.js#as cinco tabelas ligam RLS"
        status: pass
      - kind: unit
        ref: "tests/gestao-schema.test.js#a palavra anon não aparece em nenhuma policy — nem em política, nem em prosa"
        status: pass
    human_judgment: false
  - id: D2
    description: "gut_total é coluna gerada; g/u/t só aceitam a escala fechada de shared/gut.js (GUT_ESCALA) ou nulo"
    requirement: "GEQ-06"
    verification:
      - kind: unit
        ref: "tests/gestao-schema.test.js#gut_total é coluna gerada a partir de g, u e t — não uma coluna gravável"
        status: pass
      - kind: unit
        ref: "tests/gestao-schema.test.js#a escala aceita por g, u e t no banco é exatamente GUT_ESCALA de shared/gut.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "ges_indicadores/ges_indicador_valores: definição + série histórica única por (indicador_id, periodo), índice nas FKs"
    requirement: "GEQ-07"
    verification:
      - kind: unit
        ref: "tests/gestao-schema.test.js#ges_indicador_valores tem unicidade por (indicador_id, periodo)"
        status: pass
      - kind: unit
        ref: "tests/gestao-schema.test.js#ges_indicador_valores.indicador_id (FK) tem índice — explícito ou como coluna líder da unicidade"
        status: pass
      - kind: unit
        ref: "tests/gestao-schema.test.js#ges_causas.acao_id (FK) tem índice próprio"
        status: pass
    human_judgment: false
  - id: D4
    description: "ges_pop aceita ativo_ref e plano_ref nulos e independentes, sem chave estrangeira para tabela de outro módulo"
    requirement: "GEQ-08"
    verification:
      - kind: unit
        ref: "tests/gestao-schema.test.js#ges_acoes e ges_pop registram autoria — um plano de ação sem autor não é auditável"
        status: pass
      - kind: human
        ref: "leitura do arquivo: ativo_ref/plano_ref declarados sem 'references', texto livre"
        status: pass
    human_judgment: true
    rationale: "Não há um regex isolado só para 'ausência de FK' em ges_pop — confirmado por leitura direta do CREATE TABLE (ativo_ref text, plano_ref text, nenhum references) e pela ausência de qualquer 'references ges_pop' ou 'ges_pop references' no arquivo inteiro."
  - id: D5
    description: "Gate autocontido: lê só a migração 60 e shared/gut.js, nenhuma dependência de gestao/ (outro plano da mesma onda)"
    requirement: "GEQ-06/07/08 (não-regressão de escopo)"
    verification:
      - kind: unit
        ref: "tests/gestao-schema.test.js#este gate lê só a migração 60 e shared/gut.js"
        status: pass
      - kind: human
        ref: "grep -n 'readFileSync\\|require(' tests/gestao-schema.test.js — só supabase/60_gestao_schema.sql e shared/gut.js"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-09-05
status: complete
---

# Phase 13 Plan 05: Migração 60 — esquema de Gestão e Qualidade Summary

**`supabase/60_gestao_schema.sql` escrita e conferida (não aplicada): as cinco tabelas `ges_*` que sustentam o módulo `/gestao` — ações 5W2H priorizadas por GUT, indicadores com série histórica, POP e a espinha do Ishikawa — aditivas, com RLS no padrão da plataforma, e um gate permanente que prova a forma sem precisar de banco.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-05
- **Completed:** 2026-09-05
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- `supabase/60_gestao_schema.sql`: `ges_acoes` (5W2H + GUT, `gut_total` gerada), `ges_indicadores` + `ges_indicador_valores` (definição + série única por período), `ges_pop` (vínculos soltos e independentes) e `ges_causas` (espinha do Ishikawa, 6M) — aditiva, sem DROP, sem tocar tabela de outro módulo, RLS leitura pública/escrita autenticada, 5 índices (2 de chave estrangeira, 3 de recorte de tela), cabeçalho-ensaio no formato da migração 44 e rodapé de conferência pós-aplicação
- `tests/gestao-schema.test.js`: 20 casos, autocontido (lê só a migração 60 e `shared/gut.js`), provando prefixo, ausência de DROP, coluna gerada, escala GUT idêntica elemento a elemento, listas fechadas de `status`/`categoria`/`sentido`, índices de FK, unicidade, RLS completa sem `anon`, e o bloco de policies reexecutável
- Cinco defeitos foram reintroduzidos de propósito no arquivo final e conferidos reprovando antes de restaurar a versão limpa (escala GUT alterada, `gut_total` virando coluna comum, policy de escrita para `anon`, `drop policy` ausente antes de um `create policy`, índice de FK removido) — todos pegos pelo gate
- `node --test`: 1481 → 1501 (20 novos), 0 falhas
- Migração **não aplicada** em produção — arquivo escrito e conferido; aplicação é passo do usuário, depois do deploy do frontend do plano 13-06

## Task Commits

1. **Tarefa 1: supabase/60_gestao_schema.sql — as cinco tabelas com RLS e índices** — `f12f31a` (feat)
2. **Tarefa 2: gate do esquema** — `9242a80` (test)

**Plan metadata:** committed alongside this SUMMARY

## Files Created/Modified

- `supabase/60_gestao_schema.sql` — arquivo novo, 305 linhas: cinco `create table if not exists`, checks de lista fechada (status, categoria, sentido, g/u/t), coluna gerada (`gut_total`), 5 índices, RLS (5× enable + 20 policies com `drop policy if exists` pareado), comentários de tabela/coluna, rodapé de conferência
- `tests/gestao-schema.test.js` — arquivo novo, 20 casos

## Decisions Made

- **RLS escrita por extenso, sem loop dinâmico.** A migração 44 usa um `do $$ ... foreach t in array [...] loop ... $$` para gerar as policies — mas isso produz só 3 ocorrências literais de `to authenticated` no TEXTO do arquivo, não uma por tabela (o loop roda em tempo de execução, não multiplica o texto). O plano exige `grep -c 'to authenticated' >= 15`. Por isso as 20 policies (5 tabelas × leitura + 3 escritas) foram escritas uma a uma, por extenso — mais verboso que o loop, mas literal e diretamente auditável pelo gate.
- **Sem `grant ... to anon`.** A migração 44 concede `select` explicitamente a `anon, authenticated`; a 49 (mais recente, prefixo `cmasm_`) não concede nada — confia nos privilégios padrão do schema `public` do projeto Supabase. Como o critério do plano proíbe a palavra `anon` em qualquer lugar do arquivo (`grep -ci '\banon\b'` = 0), segui o precedente da 49 e não escrevi nenhum `grant`.
- **`ges_indicador_valores.indicador_id` sem índice de coluna única separado.** A unicidade `(indicador_id, periodo)` já o lidera — mesmo raciocínio que a migração 44 registrou explicitamente para `estoque_movimentos (os_id, tipo)` ("a coluna líder já serve de índice da chave estrangeira — não precisa de um segundo índice só dela"). O gate aceita as duas formas (índice explícito OU coluna líder de unicidade) para não travar essa escolha de design.
- **Dois índices extras** (`ges_pop.modulo`, `ges_indicadores.modulo`), além dos quatro citados literalmente pelo plano. Mesma razão já usada para `ges_acoes.modulo`: as telas de Ferramentas/POP e do Painel também filtram por módulo. Fecham o mínimo de 5 `create index` do plano sem duplicar nenhum índice já existente.
- **Escrita sem checagem de cargo na RLS** (`to authenticated using (true)`, sem `exists(select ... usuarios.role in (...))`), diferente do estilo de `maq_contratacoes` (migração 38) e `cmasm_*` (migração 49). O próprio plano (`must_haves`, D-13-05) e o threat model (`T-13-20`, aceito) descrevem o padrão simples já vigente na plataforma — cargo filtra só na tela, restringir por papel no banco é mudança de régua de toda a plataforma, fora do escopo desta fase.

## Deviations from Plan

Nenhum desvio nos critérios de aceite — todos os oito bullets de `acceptance_criteria` da Tarefa 1 e os quatro de `acceptance_criteria` da Tarefa 2 foram conferidos literalmente (comandos abaixo, em "Self-Check"). A única liberdade tomada foi de **forma**, não de conteúdo: dois índices adicionais por `modulo` (`ges_pop`, `ges_indicadores`) que o texto do plano não menciona por nome, adicionados para fechar o piso de 5 índices sem redundância — registrados acima em "Decisions Made" em vez de escondidos.

## Issues Encountered

Nenhum. A única armadilha real — o loop dinâmico de RLS não multiplicar `to authenticated` no texto do arquivo — foi pega ANTES de escrever o arquivo final, comparando contra `supabase/44_refrigeracao_estoque.sql` com `grep -c` (4 ocorrências para 2 tabelas, não 8), o que evitou reescrever a migração depois de uma primeira tentativa reprovada.

## User Setup Required

**A migração 60 não foi aplicada em produção.** Conforme o plano e a regra do projeto (frontend antes do SQL, D-cf8-25/D-6wy/D-500):

1. Aguardar o deploy do frontend do `/gestao` (plano 13-06, que implementa a sonda `GES_OK`)
2. Colar `supabase/60_gestao_schema.sql` inteiro no SQL Editor do projeto `pmoc` (thoaqipyhfmromsgzmjs)
3. Rodar as quatro consultas de conferência do rodapé do arquivo (contagem de colunas, checks, policies, e que as cinco tabelas nascem vazias) — a lição da migração 28 é que "sem erro" não é "com a forma certa"

## Next Phase Readiness

- `supabase/60_gestao_schema.sql` está pronta para o plano 13-06 implementar `gestao/index.html` + `gestao/app.js`, a sonda `GES_OK` e as cinco abas (Painel, Ações, Calendário, Ferramentas, POP) sobre estas cinco tabelas
- O gate `tests/gestao-schema.test.js` é autocontido e continuará passando independentemente do que o plano 13-06 escrever em `gestao/` — nenhuma dependência cruzada
- A escala GUT do banco (`g`/`u`/`t`) está textualmente amarrada a `shared/gut.js#GUT_ESCALA` por teste; se a Onda A um dia mudar essa constante, este gate reprova antes de a migração e o núcleo puro divergirem

---
*Phase: 13-gest-o-e-qualidade*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: supabase/60_gestao_schema.sql
- FOUND: tests/gestao-schema.test.js
- FOUND: commit f12f31a (Tarefa 1)
- FOUND: commit 9242a80 (Tarefa 2)
- `node --test`: 1501 tests, 0 failures (baseline 1481)
- `grep -ci 'drop table\|drop column' supabase/60_gestao_schema.sql` = 0
- `grep -ci 'alter table' supabase/60_gestao_schema.sql` = 5, todas com alvo `ges_*`
- `grep -c 'generated always as' supabase/60_gestao_schema.sql` = 1
- `grep -c 'enable row level security' supabase/60_gestao_schema.sql` = 5
- `grep -c 'to authenticated' supabase/60_gestao_schema.sql` = 15; `grep -ci '\banon\b'` = 0
- `grep -c 'create index if not exists' supabase/60_gestao_schema.sql` = 5
- `grep -c '0, 1, 3, 6, 8, 10' supabase/60_gestao_schema.sql` = 3
- `git diff --name-only -- refrigeracao/ mapa/xmap.js` vazio (D-19)
- `git diff --name-only supabase/` lista só `60_gestao_schema.sql`
- A migração **não foi aplicada** em produção — pendência registrada acima em "User Setup Required"

## Adendo (05/09/2026) — a migração já estava aplicada, com outro texto

Ao conferir o `/gestao` no navegador contra o banco de produção, a sonda `GES_OK` voltou
verdadeira: as cinco tabelas `ges_*` já existiam. O log do Postgres mostra o DDL rodando em
**04/09/2026 23:24 UTC pelo SQL editor do dashboard** (`source: dashboard`), com um texto
diferente do arquivo desta branch (`bigserial`, policies `r_*`, índices `idx_*`,
`quanto >= 0`, `uq_ges_indicador_valores_periodo`) e sem registro em `supabase_migrations`.
Nenhum agente desta execução aplicou nada. Pela lição da migração 28, `supabase/60_gestao_schema.sql`
passou a ser o **texto que rodou**, com o cabeçalho explicando, e `tests/gestao-schema.test.js`
deixou de casar a grafia do rascunho (nomes de índice/constraint, `to public` explícito) para
casar o fato. Conferência em três camadas em 05/09: colunas 19/10/5/9/5, 20 policies `r_*`,
porta da frente com a chave pública (`select` 200, coluna inexistente 400, `POST` anônimo 401,
`PATCH` anônimo `[]`). "Não aplicada" acima descreve o estado no momento da execução do plano.
