---
phase: 06-tema-claro-escuro
plan: 04
subsystem: docs
tags: [auditoria, testes-md, requirements, claude-md, d-05, gate-defect]

requires:
  - phase: 06-tema-claro-escuro
    provides: "06-01: tokens de tema claro em shared/pmoc.css; 06-02: shared/tema.js + botão #btn-tema; 06-03: script anti-FOUC nas 7 superfícies + tema no portal + tests/tema-superficies.test.js"
provides:
  - "TESTES.md § 'Fase 6' — roteiro manual completo (preparação, 7 superfícies, 5 critérios de sucesso nomeados, bordas, D-01, D-05, conferência isolada da refrigeração, testes automatizados), com os itens que dependem de navegador explicitamente em aberto"
  - "D-05 registrada por escrito e em código: /calibracao (8ª superfície, importada por tarefa concorrente durante a fase) fica fora da convenção pmoc-tema por decisão, não por esquecimento — tests/tema-superficies.test.js ganha o caso que prova isso"
  - "CLAUDE.md e .claude/CLAUDE.md descrevendo shared/tema.js, a convenção data-theme=\"claro\"|\"escuro\", a chave pmoc-tema e as duas exceções de escopo (portal, mapa/xmap.css)"
  - "REQUIREMENTS.md com PLAT-04/PLAT-05 fechados com evidência por comando e PLAT-15/PLAT-16 reverificados para a Fase 6, sem apagar o registro da Fase 5"
affects: []

tech-stack:
  added: []
  patterns:
    - "Auditoria de fechamento de fase prova por comando em vez de presumir — mesmo papel que 05-07 teve na Fase 5"

key-files:
  created: []
  modified:
    - TESTES.md
    - CLAUDE.md
    - .claude/CLAUDE.md
    - .planning/REQUIREMENTS.md
    - tests/tema-superficies.test.js

key-decisions:
  - "D-05 registrada: /calibracao (8ª superfície, importada por tarefa concorrente quick-260811-9sb durante a Fase 6, commits 240cfa6/eb1e342) fica fora do escopo desta fase, no mesmo raciocínio de D-04 para refrigeracao — mas com uma diferença importante: calibracao NÃO está sem tema, tem o próprio alternador (chave localStorage['cmasm_erp_theme'], valores 'dark'/'light'), incompatível de propósito com a convenção da plataforma (pmoc-tema, 'claro'/'escuro')"
  - "Deviation Rule 2 (funcionalidade crítica faltante) aplicada fora do arquivo declarado pela frontmatter do plano: tests/tema-superficies.test.js ganhou um caso novo (D-05) por instrução explícita do orquestrador — a exclusão de calibracao precisa ficar provada em código, não só em prosa, para não ser lida como esquecimento por uma fase futura"
  - "Dois gates automatizados mal especificados em 06-02-PLAN.md, identificados e já contornados no próprio 06-02 (sem alterar comportamento/API): grep -c \"btn-tema\" conta linhas casadas, não ocorrências (id e class na mesma linha); e o gate de núcleo puro colidiu com a palavra portuguesa 'documento' contendo a substring 'document'. Nenhum outro gate do escopo das 4 SUMMARY revisadas (06-01/06-02/06-03) repete esse padrão — não corrigido aqui, por decisão explícita de não patchear fora do plano de origem"
  - "Achado adicional desta auditoria (não estava nos dois achados do orquestrador): o próprio 06-04-PLAN.md usa grep -qiE \"termoA\\|termoB\" no gate da Task 1 — sob -E (ERE real), \\| é literal, não alternação, então o padrão nunca alterna sob GNU grep puro nem sob o grep deste ambiente; verificado com grep -qi (sem -E, onde \\| é extensão GNU de alternação em BRE) que o conteúdo de TESTES.md de fato satisfaz a intenção de cada termo"
  - "Gate 9 do plano (nenhum arquivo fora do escopo da fase modificado) não se sustenta como diff bruto contra 351b13c: calibracao/* (8 arquivos), vercel.json, .gitignore e .claude/launch.json aparecem no diff, mas por atribuição de commit nenhum pertence às plans 06-01..06-04 — vieram de tarefas concorrentes (quick-260811-9sb e dois chores de infraestrutura), documentado aqui em vez de silenciado"

patterns-established: []

requirements-completed: [PLAT-04, PLAT-05]

coverage:
  - id: D1
    description: "TESTES.md ganha seção 'Fase 6' no formato das anteriores: preparação, roteiro por superfície (7), item nomeado por critério de sucesso, bordas, D-01, D-05, conferência isolada da refrigeração e bloco de testes automatizados"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "bash gate embutido no plano (Task 1) — grep dos termos exigidos na seção, contagem de linhas, ausência de diff em shared/tests"
        status: pass
    human_judgment: true
    rationale: "O gate literal do plano usa grep -qiE \"termoA\\|termoB\" (ERE), que sob -E trata \\| como literal, não alternação — falha mesmo com conteúdo correto. Reexecutado com grep -qi (sem -E, BRE com extensão GNU de alternação), onde todos os termos passam. Documentado como achado, não corrigido no gate do plano (fora do escopo desta auditoria corrigir o próprio arquivo em execução)"
  - id: D2
    description: "D-05 registrada em TESTES.md (prosa) e em tests/tema-superficies.test.js (código) — calibracao fora da convenção por decisão, com alternador de tema próprio e incompatível, não por esquecimento"
    requirement: "PLAT-15"
    verification:
      - kind: unit
        ref: "tests/tema-superficies.test.js — caso novo, node --test (44/44, antes 43)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CLAUDE.md e .claude/CLAUDE.md descrevem shared/tema.js, data-theme=\"claro\"|\"escuro\", chave pmoc-tema, script anti-FOUC clássico replicado e as duas exceções (portal, mapa/xmap.css)"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "bash gate embutido no plano (Task 2) — grep de presença dos três termos nos dois arquivos"
        status: pass
    human_judgment: false
  - id: D4
    description: "REQUIREMENTS.md fecha PLAT-04/PLAT-05 com evidência por comando e reverifica PLAT-15/PLAT-16 para a Fase 6, preservando o registro da Fase 5; tabela de rastreabilidade atualizada"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "bash gate embutido no plano (Task 2) — grep '06-04' em REQUIREMENTS.md; node --test 44/44; refrigeracao/mapa intocados desde 351b13c; 8 rotas de vercel.json resolvem (7 da fase + /calibracao)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Toda conferência visual pós-navegador (fechar/reabrir, clique real nos 7 botões, contraste medido em ferramenta, inspetor de rede da refrigeração) fica registrada como pendência nomeada em TESTES.md, não presumida"
    verification: []
    human_judgment: true
    rationale: "Ambiente autônomo sem credenciais Supabase nem navegador controlável — mesma limitação herdada da Fase 5 (05-07), repetida e nomeada explicitamente para a Fase 6"

duration: 25min
completed: 2026-08-11
status: complete
---

# Phase 06 Plan 04: Auditoria de fechamento — TESTES.md, CLAUDE.md e REQUIREMENTS.md Summary

**Fecha a Fase 6 provando os cinco critérios de sucesso por comando (node --test 44/44, refrigeracao/mapa intocados, 7 cópias do script anti-FOUC idênticas), registra D-05 (calibracao fora da convenção pmoc-tema, com prova em código) e reporta dois gates automatizados mal especificados encontrados no plano 06-02, mais um terceiro achado neste próprio plano.**

## Performance

- **Duration:** 25min
- **Started:** 2026-08-11T21:20:00Z (estimado — leitura de contexto)
- **Completed:** 2026-08-11T21:52:30Z
- **Tasks:** 2 completed + 1 deviation (teste D-05)
- **Files modified:** 5 (4 declarados no plano + tests/tema-superficies.test.js por deviation)

## Accomplishments

- `TESTES.md` ganhou a seção `## Fase 6 — Tema claro/escuro — auditoria de fechamento — 11/08/2026` (175 linhas), no formato da seção da Fase 5: parágrafo de abertura, preparação, roteiro manual pelas 7 superfícies, item nomeado para cada um dos 5 critérios de sucesso da fase (incluindo o de legibilidade dos alertas nos dois temas), 4 bordas a exercitar, limitação conhecida de D-01 (mapa Leaflet permanece dark-only, marcada como esperada), nova seção D-05 (calibracao), conferência isolada da refrigeração (PLAT-15) e bloco de testes automatizados. Nenhum item foi marcado concluído sem evidência — os que dependem de navegador real (persistência entre sessões, primeira visita por `prefers-color-scheme`, contraste medido em ferramenta, inspetor de rede) ficam com a caixa vazia e a observação explícita da limitação do ambiente autônomo.
- **D-05 registrada** (achado do orquestrador, não previsto no `06-04-PLAN.md` original): `/calibracao`, importada por uma tarefa concorrente durante a própria Fase 6 (`quick-260811-9sb`, commits `240cfa6`/`eb1e342`), é uma 8ª superfície fora do escopo D-02 (7 superfícies). Diferente de `refrigeracao` (D-04, congelada e sem nenhum mecanismo de tema), `calibracao` **já tem** o próprio alternador de tema — botão "☀️ Claro"/"🌙 Escuro" visível no cabeçalho, `document.documentElement.dataset.theme` gravado via `localStorage['cmasm_erp_theme']`, valores `'dark'`/`'light'` em inglês — completamente desconectado da convenção da plataforma (`pmoc-tema`, `'claro'`/`'escuro'`, `shared/tema.js`). Um caso novo em `tests/tema-superficies.test.js` prova as duas metades do fato: a chave `pmoc-tema` não vazou para dentro do módulo, e o módulo de fato tem seu próprio `data-theme` (não é ausência por esquecimento). `node --test`: 43 → 44.
- Auditoria por comando (Parte A do Task 2), baseline `351b13c` (pesquisa da Fase 6, commit anterior à execução): `node --test` 44/44 verde, sem teste removido; `refrigeracao/` e `mapa/xmap.css` intocados desde a baseline (`git diff --name-only` vazio nos dois); as 7 cópias do script anti-FOUC seguem byte-idênticas; nenhum dos 6 módulos declara token de cor além de `--accent` nem cria bloco de tema próprio (gate estrutural em `tests/tema-superficies.test.js`); projeto continua sem `package.json`; as 8 rotas de `vercel.json` (as 7 desta fase mais `/calibracao`, adicionada fora do escopo da fase) resolvem para arquivo existente.
- `CLAUDE.md` e `.claude/CLAUDE.md` passam a descrever `shared/tema.js` (núcleo puro + aplicadores, mesma separação que `shell.js` já usa), a convenção travada `data-theme="claro"|"escuro"` com chave `pmoc-tema`, o padrão dark-default aditivo em `shared/pmoc.css`, o script anti-FOUC clássico (não módulo ES) replicado byte-idêntico nas 7 superfícies, e as duas exceções de escopo (portal duplica valores de token sem duplicar lógica; `mapa/xmap.css` permanece dark-only).
- `.planning/REQUIREMENTS.md`: `PLAT-04` e `PLAT-05` marcados `[x]` com evidência por comando anexada ao texto, no formato que `05-07` estabeleceu; `PLAT-15`/`PLAT-16` reverificados para a Fase 6 com uma segunda evidência anexada à mesma linha, preservando o registro original da Fase 5; tabela de rastreabilidade atualizada (as 4 linhas). As 4 pendências humanas herdadas (conferência visual pós-login, contraste medido em ferramenta, inspetor de rede, fechar/reabrir navegador de fato) ficam nomeadas em cada requisito, apontando para o roteiro manual de `TESTES.md` § "Fase 6".
- **Achado sobre gates mal especificados** (instrução explícita do orquestrador): confirmados os dois defeitos já descritos em `06-02-SUMMARY.md` — `grep -c "btn-tema" shared/shell.js` conta linhas casadas, não ocorrências (o `id` e a `class` do botão estão na mesma linha, então o valor real era 1, não 2; contornado por um comentário HTML genuinamente útil, não um hack vazio); e o gate de núcleo puro (`document|window|localStorage|matchMedia`) colidiu com a palavra portuguesa "documento" (contém "document" como substring), contornado reescrevendo o comentário para "página". Varredura nos gates de `06-01-PLAN.md` e `06-03-PLAN.md` não encontrou repetição do mesmo padrão — as duas SUMMARY correspondentes já registravam "None — executado exatamente como escrito", e a inspeção confirma que os gates lá (`--accent-texto >= 2`, `color-mix >= 12`, `insertAdjacentHTML == 2`, etc.) já eram satisfeitos naturalmente pelo código real, sem depender de contagem de linha vs. ocorrência. Um **terceiro achado**, desta vez no próprio `06-04-PLAN.md`: o gate da Task 1 usa `grep -qiE "termoA\|termoB"` — sob `-E` (ERE real), `\|` é tratado como caractere literal, não como alternação (confirmado com GNU grep 3.12 puro, via `command grep`, fora do alias deste ambiente para `ugrep`), então o padrão nunca alterna. Reexecutado com `grep -qi` (sem `-E`, onde `\|` é uma extensão GNU de alternação em BRE), todos os termos passam — o conteúdo de `TESTES.md` está correto; é o gate que está mal especificado. Nenhum desses três achados foi corrigido nos arquivos de origem (`06-01`/`06-02`/`06-03`-PLAN.md nem o próprio `06-04-PLAN.md`), por decisão explícita de não patchear planos fora do escopo desta auditoria — reportado aqui para que uma fase futura de escrita de gates saiba evitar os dois padrões (contagem de linha vs. ocorrência; `\|` sob `-E`).
- **Achado sobre o gate 9 do plano** ("nenhum arquivo fora do escopo da fase foi modificado"): avaliado como diff bruto contra `351b13c`, a afirmação não se sustenta — `calibracao/*` (8 arquivos), `vercel.json`, `.gitignore` e `.claude/launch.json` aparecem no `git diff --name-only 351b13c..HEAD`. Atribuição por commit confirma que nenhum desses arquivos pertence às plans `06-01`..`06-04`: vieram de `240cfa6`/`eb1e342` (a tarefa concorrente `quick-260811-9sb`, importação de Calibração) e de `dbfc2e5`/`397f250` (dois chores de infraestrutura de sessão, preview server e `.gitignore` — sem relação com tema). Documentado em vez de silenciado; nenhuma correção necessária, porque o gate real (por atribuição de commit, não por diff bruto) passa.

## Task Commits

Each task was committed atomically:

1. **Deviation — D-05: registra calibracao fora da convenção pmoc-tema em tests/tema-superficies.test.js** - `4744978` (test)
2. **Task 1: Escrever a seção da Fase 6 em TESTES.md** - `50acd25` (docs)
3. **Task 2: Auditar a fase por comando e atualizar CLAUDE.md, .claude/CLAUDE.md e REQUIREMENTS.md** - `866de3a` (docs)

**Plan metadata:** pending (docs: complete plan) — commit hash recorded after this SUMMARY

## Files Created/Modified
- `TESTES.md` - Seção nova `## Fase 6 — Tema claro/escuro — auditoria de fechamento`
- `tests/tema-superficies.test.js` - Caso novo (D-05): calibracao fora da convenção pmoc-tema, por decisão
- `CLAUDE.md` - Descrição de `shared/tema.js`, convenção `data-theme`/`pmoc-tema`, exceções de escopo
- `.claude/CLAUDE.md` - `shared/tema.js` listado entre os componentes e camadas compartilhadas
- `.planning/REQUIREMENTS.md` - PLAT-04/PLAT-05 fechados; PLAT-15/PLAT-16 reverificados para a Fase 6; tabela de rastreabilidade atualizada

## Decisions Made
- D-05 registrada (ver `key-decisions` no frontmatter e a seção dedicada em `TESTES.md`): `/calibracao` fica fora do escopo desta fase, mas sua exclusão é provada em código, não presumida.
- A extensão de `tests/tema-superficies.test.js` foi feita fora da lista `files_modified` declarada no frontmatter de `06-04-PLAN.md` (que lista só `TESTES.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `.planning/REQUIREMENTS.md`) — decisão deliberada, por instrução explícita e direta do contexto desta execução (achado do orquestrador, não do plano), tratada como Deviation Rule 2 (funcionalidade crítica faltante: a exclusão de calibracao precisa estar em código, não só em prosa, para não virar dívida invisível).
- Os três achados de gate mal especificado (dois em `06-02-PLAN.md`, um no próprio `06-04-PLAN.md`) foram documentados, não corrigidos nos arquivos de origem — respeitando a instrução "não patchear fora do plano de origem" e, no caso do achado no próprio `06-04-PLAN.md`, a inutilidade de editar o gate de uma tarefa que já terminou de executar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Funcionalidade crítica faltante] D-05 não provada em código, só em prosa, no plano original**
- **Found during:** Leitura do contexto do orquestrador (achado concorrente, não estava no `06-04-PLAN.md`)
- **Issue:** `/calibracao` entrou no repositório como 8ª superfície durante a fase, sem tema, e sem nenhum gate automatizado cobrindo sua exclusão — um risco real de a exclusão ser lida como esquecimento numa fase futura
- **Fix:** Caso novo em `tests/tema-superficies.test.js` provando (a) ausência da chave `pmoc-tema` no arquivo e (b) presença do próprio `data-theme` do módulo, desconectado — a exclusão fica marcada em código
- **Files modified:** `tests/tema-superficies.test.js`
- **Commit:** `4744978`

Nenhum outro Rule 1-4 acionado. As duas Tasks do plano original foram executadas como escritas, com as ressalvas de achados de auditoria documentadas acima (gates mal especificados, gate 9 avaliado por atribuição de commit em vez de diff bruto).

## Issues Encountered
- O gate literal da Task 1 (`grep -qiE "termoA\|termoB"`) não passa sob `-E` real (GNU grep 3.12, confirmado via `command grep` para contornar o alias deste ambiente para `ugrep`) — `\|` é tratado como caractere literal sob ERE, não como alternação. Reverificado com `grep -qi` (BRE, onde `\|` é extensão GNU de alternação): todos os termos exigidos estão presentes no conteúdo de `TESTES.md`. Não é um problema de conteúdo — é um problema do próprio gate, documentado em `key-decisions` acima.
- `.claude/CLAUDE.md` e `CLAUDE.md` continuam com outras seções desatualizadas fora do escopo desta fase (por exemplo, `CLAUDE.md` ainda lista só "Two production apps" na introdução e não menciona `predial`/`mapa`/`calibracao` na lista de rotas do Vercel) — fora do escopo do plano 06-04, que só pede a descrição do módulo de tema; não corrigido aqui.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
A Fase 6 está fechada: PLAT-04 e PLAT-05 têm evidência por comando; PLAT-15/PLAT-16 reverificados sem apagar o histórico da Fase 5. `node --test` está em 44/44. As pendências humanas (5 itens do roteiro de `TESTES.md` § "Fase 6", mais os 2 itens herdados de `TESTES.md` § "Fase 5") ficam para o UAT do usuário, com navegador real e credenciais Supabase. D-05 (`/calibracao`) fica registrada como item de backlog para uma fase futura de portar o módulo à base comum — mesmo trabalho que Transportes/Elétrica/Fonoclama/Predial/Mapa já passaram na Fase 5. `refrigeracao/` e `mapa/xmap.css` seguem intocados e agora travados por gate automatizado permanente (`tests/tema-superficies.test.js`), não só por disciplina humana.

---
*Phase: 06-tema-claro-escuro*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: TESTES.md
- FOUND: CLAUDE.md
- FOUND: .claude/CLAUDE.md
- FOUND: .planning/REQUIREMENTS.md
- FOUND: tests/tema-superficies.test.js
- FOUND: .planning/phases/06-tema-claro-escuro/06-04-SUMMARY.md
- FOUND: 4744978 (deviation commit — D-05)
- FOUND: 50acd25 (Task 1 commit)
- FOUND: 866de3a (Task 2 commit)
