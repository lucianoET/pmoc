---
phase: 10-mapa-operacional
plan: 08
subsystem: docs
tags: [auditoria, testes-md, requirements, claude-md, closing-audit]

requires:
  - phase: 10-mapa-operacional
    provides: "10-01 a 10-07: migração 25, núcleo puro, deep link, base offline, camadas reais, editor de zona, posicionamento de ativo — os sete planos que esta auditoria prova por comando em vez de presumir"
provides:
  - "TESTES.md § 'Fase 10' — roteiro manual completo pelos dez critérios de sucesso, com a migração 25 como primeiro passo bloqueante, o aviso de banco vazio, o teste do observador em duas partes, o teste sem rede por servidor local com a impossibilidade contra produção escrita, bordas a exercitar, limitações conhecidas com o motivo de cada uma, conferência isolada da refrigeração e o que este ambiente não pode provar"
  - "CLAUDE.md e .claude/CLAUDE.md descrevendo o módulo mapa como ele ficou: camada de dados única, núcleo puro, editor por cargo, planta vetorial offline, diretório de tiles com procedimento próprio, as duas listas de cargo e as colunas novas com a arquitetura de duas camadas de posição"
  - "REQUIREMENTS.md com PLAT-13/14/17/18/20 fechados com evidência por comando, PLAT-19 explicitamente parcial, PLAT-15/16 reverificados para a Fase 10 sem apagar o histórico das Fases 5 e 6, e as três pendências de dados/operação nomeadas por extenso"
affects: []

tech-stack:
  added: []
  patterns:
    - "Auditoria de fechamento de fase prova por comando em vez de presumir — mesmo papel que 05-07 (Fase 5) e 06-04 (Fase 6) tiveram"

key-files:
  created: []
  modified:
    - TESTES.md
    - CLAUDE.md
    - .claude/CLAUDE.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "PLAT-19 fechado como parcial, não completo — a metade de desenho sem rede (planta vetorial + tile local com fallback) está pronta e conferível localmente por gate estrutural; a metade de tiles raster depende de procedimento do usuário (mapa/tiles/GERAR-TILES.md), nunca exercitado neste ambiente. Marcar como completo seria presunção sobre algo que ninguém desligou a rede para testar"
  - "PLAT-13 ganhou correção de premissa no próprio texto do requisito: a versão original dizia 'usando o vínculo cmasm_locais.local_id já existente' — a pesquisa da fase mostrou que esse vínculo é organizacional, não geográfico; corrigir o texto é parte do fechamento, não uma nota à margem, porque deixá-lo errado faria a próxima leitura repetir o engano"
  - "PLAT-15 (não regressão da refrigeração) registra explicitamente que a migração 25 acrescentou lat/lon a equipamentos (tabela da refrigeração) e por que isso não viola o requisito: o requisito protege o app (código intocado, confirmado por diff), a alteração no banco compartilhado é aditiva, com precedente aceito na migração 19"
  - "O critério de dez itens do roteiro manual foi escrito com marcador explícito 'Critério N —' para cada um dos dez critérios de sucesso do ROADMAP.md, na ordem, incluindo os que dependem de sessão real (marcados 'Pendente de sessão real', nunca marcados como concluídos por presunção)"
  - "As quatro decisões travadas da fase (D-01 a D-04) entraram em seção própria de CLAUDE.md ('Decisões travadas — Phase 10'), cada uma com o gate automatizado que a protege — segue o mesmo formato que o roteiro de TESTES.md usa, para que a Phase 11 encontre a fronteira já desenhada em vez de precisar redescobri-la"

patterns-established: []

requirements-completed: [PLAT-13, PLAT-14, PLAT-17, PLAT-18, PLAT-20, PLAT-15, PLAT-16]

coverage:
  - id: D1
    description: "TESTES.md ganha a seção 'Fase 10' no formato das Fases 5/6: preparação com a migração 25 como primeiro passo bloqueante, os dez critérios de sucesso na ordem do ROADMAP, teste do observador em duas partes (interface + tentativa de gravação pelo console), teste sem rede por servidor local com a impossibilidade contra produção explicada, bordas a exercitar, limitações conhecidas (D-01 a D-04), conferência isolada da refrigeração e o que este ambiente não pode provar"
    requirement: "PLAT-13"
    verification:
      - kind: unit
        ref: "gate embutido no plano (Task 1) — grep dos termos exigidos na seção, contagem de itens de critério (26, mínimo 10), presença de todos os quatro D- e da migração 25, node --test fail 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Não regressão conferida por comando antes de qualquer linha de documentação nova: refrigeracao/ e mapa/xmap.css intocados desde o baseline 511bb9e, satélite sem referência a tile local (D-02), 8 rotas do vercel.json resolvendo para arquivo existente, node --test 135/135 sobre o baseline de 58, nenhum arquivo do baseline removido"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "gate embutido no plano (Task 2, Parte A) — todos os comandos executados e confirmados antes da Parte B (documentação)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CLAUDE.md e .claude/CLAUDE.md descrevem o módulo mapa como ele ficou — mapa-dados.js (porta única de banco), mapa-geometria.js (núcleo puro), mapa-editor.js (dois modos de edição), planta-cmasm.geojson (117 feições, 171 KB medidas no plano 10-04), as duas listas de cargo (CARGOS_ZONA/CARGOS_POSICAO) e por que divergem, as colunas novas da migração 25 com a arquitetura de duas camadas de posição, e as quatro decisões travadas com o gate de cada uma"
    requirement: "PLAT-17"
    verification:
      - kind: unit
        ref: "gate embutido no plano (Task 2, Parte B) — grep de presença dos termos nos dois arquivos, node --test fail 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "REQUIREMENTS.md fecha PLAT-13/14/17/18/20 com evidência por comando anexada ao texto, deixa PLAT-19 explicitamente parcial (não marcado [x]), reverifica PLAT-15/16 para a Fase 10 sem apagar o histórico das Fases 5 e 6, atualiza a tabela de rastreabilidade e nomeia as três pendências de dados/operação"
    requirement: "PLAT-18"
    verification:
      - kind: unit
        ref: "gate embutido no plano (Task 3) — grep de cada requisito marcado/não marcado, presença de 10-08/05-07/06-04, tabela de rastreabilidade com >=5 linhas 'Phase 10', node --test fail 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Os dez critérios de sucesso da fase saem do roteiro cada um com a marca honesta de como é provado — comando, pendente de sessão real, ou impossível neste ambiente com o motivo escrito — sem nenhum marcado concluído por presunção"
    verification: []
    human_judgment: true
    rationale: "O ambiente autônomo não tem credenciais do Supabase nem navegador controlável — nenhuma conferência visual pós-login foi feita, mesmo limite que fechou as Fases 5 e 6. Toda evidência deste plano é estática, por comando; os itens que dependem de sessão real ficam nomeados no roteiro manual de TESTES.md § 'Fase 10' para o UAT do usuário"

duration: 45min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 08: Auditoria de fechamento — TESTES.md, CLAUDE.md e REQUIREMENTS.md Summary

**Fecha a Fase 10 provando os dez critérios de sucesso por comando em vez de presumi-los: `node --test` sobe de 58 para 135 sem nenhum teste removido, `refrigeracao/` e `mapa/xmap.css` continuam intocados, `PLAT-19` fecha explicitamente parcial (a metade de tiles raster depende de procedimento do usuário), `PLAT-13` ganha a correção de premissa que a pesquisa da fase já havia identificado, e as duas coisas que esta fase tem e as Fases 5/6 não tinham — a migração 25 pendente de execução e o teste sem rede que só existe em servidor local — viram item nomeado do roteiro em vez de caixa que ninguém consegue marcar.**

## Performance

- **Duration:** 45min
- **Completed:** 2026-08-12
- **Tasks:** 3/3 completed
- **Files modified:** 4 (todos documentação/registro, nenhum arquivo de código)

## Accomplishments

- `TESTES.md` ganhou a seção `## Fase 10 — Mapa operacional — auditoria de fechamento — 12/08/2026` (mais de 250 linhas), no formato das seções das Fases 5 e 6: preparação com a migração 25 (`supabase/25_mapa_geometria_posicao.sql`) como primeiro passo bloqueante e as duas consultas de conferência, o aviso destacado de que nenhum ativo tem coordenada logo após a migração, o roteiro pelos dez critérios de sucesso na ordem exata do `ROADMAP.md` (cada um marcado "pendente de sessão real" quando aplicável, nunca concluído por presunção), o teste do observador em duas partes (interface + tentativa de gravação direta pelo console do navegador, com a nota explícita de que é a segunda parte que prova o critério), o teste sem rede por servidor local com a impossibilidade física contra a URL de produção explicada (sem service worker, o navegador nunca chega a buscar a própria página sem rede), quatro bordas a exercitar, sete limitações conhecidas com o motivo de cada uma (incluindo D-01 a D-04 e a deviation de 10-07 sobre a camada de exibição não atualizar na hora), a conferência isolada de não regressão da refrigeração e a lista honesta do que este ambiente autônomo não pode provar. A seção "Módulo Mapa" anterior (estado de demonstração, pré-Fase 10) ganhou uma nota apontando para a nova.
- **Não regressão conferida por comando antes de qualquer linha de documentação escrita** (Task 2, Parte A): `git diff --name-only 511bb9e..HEAD -- refrigeracao/` vazio; `refrigeracao/index.html` sem referência a `shared/`, `pmoc.css`, `pmoc-tema`, `data-theme`, `mapa-dados` ou `mapa-geometria` (0 ocorrências dos seis termos); `mapa/xmap.css` intocado desde `511bb9e`; construção do basemap satélite sem referência a `/mapa/tiles/` (D-02); as 8 rotas de `vercel.json` (as 7 anteriores + `/calibracao`) resolvem para arquivo existente; os 9 arquivos de teste do baseline continuam presentes; `node --test` sobe de 58 para **135**, 0 falhas, nenhum teste do baseline removido.
- `CLAUDE.md` deixa de descrever o módulo mapa como "visualização de dados de demonstração" e passa a citar `mapa-dados.js` (porta única de banco em `mapa/`), `mapa-geometria.js` (núcleo puro, mesma divisão pura/DOM que `shared/tema.js` já usa), `mapa-editor.js` (dois modos de edição escopados por cargo) e `planta-cmasm.geojson` (117 feições, 171 KB medidas no plano 10-04, não a estimativa do planejamento). Ganhou seção própria "Decisões travadas — Phase 10" com D-01 a D-04, cada uma com o gate automatizado que a protege; a seção de auth/segurança passou a registrar as duas listas de cargo (`CARGOS_ZONA` espelhando 1:1 a política de `maq_areas`, `CARGOS_POSICAO` como subconjunto deliberado — não espelho — da política das tabelas de ativo) e por que divergem; a seção de banco de dados ganhou as colunas novas da migração 25 com a arquitetura de duas camadas de posição (herdada do local + própria do ativo) e as duas travas de integridade (envelope + par completo); a seção de comandos registrou que a planta vetorial é gerada por script rodado à mão e que os tiles raster têm procedimento próprio, não passo de deploy. `.claude/CLAUDE.md` ganhou os mesmos arquivos na lista de organização de código e as colunas novas na lista de schema.
- `REQUIREMENTS.md` (Task 3): `PLAT-13`, `PLAT-14`, `PLAT-17`, `PLAT-18` e `PLAT-20` marcados `[x]` com a evidência por comando anexada ao texto de cada um, no formato que `05-07` e `06-04` estabeleceram. `PLAT-13` ganhou a correção de premissa já sinalizada pela pesquisa da fase — o texto original falava em usar o vínculo `cmasm_locais.local_id` já existente para posicionar, mas esse vínculo é organizacional, não geográfico; o texto corrigido descreve a arquitetura de duas camadas que a migração 25 de fato entregou. `PLAT-19` ficou **explicitamente parcial** (`- [ ]`, não `[x]`): a metade de desenho sem rede está pronta e provada por gate; a metade de tiles raster depende do procedimento do usuário em `mapa/tiles/GERAR-TILES.md`, nunca marcada completa por presunção. `PLAT-15` e `PLAT-16` foram reverificados para a Fase 10 sem apagar os registros das Fases 5 e 6 — `PLAT-15` registra explicitamente que a migração 25 acrescentou `lat`/`lon` a `equipamentos` (tabela da refrigeração) e por que isso não viola o requisito (código intocado, alteração de banco aditiva, precedente na migração 19). A tabela de rastreabilidade foi atualizada para as seis entradas da Fase 10, e as três pendências de dados/operação (migração 25 não aplicada, coordenada dos prédios em `cmasm_locais` vazia, tiles raster não gerados) foram registradas em seção própria, cada uma com onde o procedimento está escrito.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Escrever a seção da Fase 10 em TESTES.md** — `5a7c033` (docs)
2. **Task 2: Conferir a não regressão por comando e atualizar a documentação do projeto** — `b7e0483` (docs)
3. **Task 3: Fechar os requisitos da fase em REQUIREMENTS.md** — `0cf496f` (docs)

**Plan metadata:** (a seguir, neste commit)

## Files Created/Modified

- `TESTES.md` — seção nova `## Fase 10 — Mapa operacional — auditoria de fechamento`; nota adicionada à seção "Módulo Mapa" anterior apontando para a nova
- `CLAUDE.md` — arquitetura do mapa atualizada, seção "Decisões travadas — Phase 10", duas listas de cargo, colunas novas da migração 25, comandos de planta/tiles, pendências acrescentadas a "Known pendências"
- `.claude/CLAUDE.md` — arquivos novos do mapa na lista de organização de código, colunas novas na lista de schema
- `.planning/REQUIREMENTS.md` — PLAT-13/14/17/18/20 fechados com evidência; PLAT-19 explicitamente parcial; PLAT-15/16 reverificados para a Fase 10; tabela de rastreabilidade atualizada; três pendências de dados/operação registradas

## Decisions Made

- `PLAT-19` fechado como parcial, não completo — ver `key-decisions` no frontmatter.
- `PLAT-13` ganhou correção de premissa no próprio texto do requisito — ver `key-decisions`.
- `PLAT-15` registra explicitamente por que a alteração aditiva em `equipamentos` (tabela da refrigeração) não viola o requisito — ver `key-decisions`.
- Os dez critérios do roteiro manual foram escritos com marcador "Critério N —" explícito, na ordem do `ROADMAP.md`, cada um com a marca honesta de prova (comando / pendente de sessão real / impossível neste ambiente).
- As quatro decisões travadas (D-01 a D-04) entraram em seção própria de `CLAUDE.md`, cada uma com o gate automatizado que a protege.

## Deviations from Plan

### Nenhuma — plano executado como escrito, um ajuste de gate registrado

Não houve bugs a corrigir, funcionalidade crítica ausente a acrescentar, nem mudança arquitetural. Este plano não escreve nenhuma linha de código de produção, por desenho — se a auditoria tivesse encontrado defeito, ele voltaria para o plano de origem, e nenhum foi encontrado.

**1. [Ajuste durante escrita, não deviation de Regra 1-4] Gate da Task 1 exigia D-03 explicitamente citado no roteiro**

- **Found during:** Task 1, primeira execução do `<verify>` automatizado
- **Issue:** A primeira versão da seção "Fase 10" em `TESTES.md` cobria D-01, D-02 e D-04 nas Limitações conhecidas, mas não citava D-03 (zonas fora da árvore `cmasm_locais`) com o código literal — o gate da Task 1 exige as quatro decisões travadas presentes por código (`D-01`, `D-02`, `D-03`, `D-04`), e a checagem falhou nomeando `D-03` como ausente.
- **Fix:** Acrescentado um item às Limitações conhecidas citando D-03 explicitamente, com o mesmo raciocínio que os outros três já tinham (decisão travada, motivo, gate que a protege quando existe).
- **Files modified:** `TESTES.md`
- **Verification:** Gate da Task 1 reexecutado, passa; `node --test` continua 135/135
- **Committed in:** `5a7c033` (Task 1, antes do commit — o ajuste foi feito na mesma escrita, não como correção posterior)

---

**Total deviations:** 0 (Regras 1-4); 1 ajuste de conteúdo durante a própria escrita da Task 1, encontrado pelo gate antes do commit
**Impact on plan:** Nenhum — o gate automatizado da Task 1 fez exatamente o papel que deveria: pegar uma decisão travada esquecida antes do commit, não depois.

## Issues Encountered

Nenhum além do ajuste acima, já registrado.

## User Setup Required

Três pendências herdadas dos planos anteriores, nomeadas por extenso em `TESTES.md` § "Fase 10" e em `REQUIREMENTS.md` § "Pendências de dados e operação":

1. **Executar `supabase/25_mapa_geometria_posicao.sql`** no SQL Editor do projeto `pmoc` — bloqueante para qualquer conferência visual do mapa.
2. **Preencher `lat`/`lon` em `cmasm_locais`** para os prédios/salas — opcional, a posição herdada só passa a valer depois disso; posicionar ativo por ativo já resolve o caso de uso sem depender.
3. **Gerar tiles raster locais** (opcional) seguindo `mapa/tiles/GERAR-TILES.md` — fidelidade cartográfica adicional, não bloqueia PLAT-19 (que já fecha a metade de desenho sem rede).

## Next Phase Readiness

- A Fase 10 está fechada: seis requisitos com evidência por comando (`PLAT-13`, `PLAT-14`, `PLAT-17`, `PLAT-18`, `PLAT-20`, mais os dois de não regressão `PLAT-15`/`PLAT-16`), um requisito (`PLAT-19`) explicitamente parcial com a parte pendente nomeada. `node --test` em 135/135.
- As pendências humanas — a maior parte do roteiro de dez critérios, que depende de sessão Supabase real e da migração 25 aplicada — ficam para o UAT do usuário, registradas em `TESTES.md` § "Fase 10" sem nenhuma marcada como concluída por presunção.
- As quatro decisões travadas da fase (D-01 a D-04) saem documentadas em `CLAUDE.md` com o gate automatizado de cada uma — a Phase 11 (telemetria, hoje travada por decisão de segurança da OM) encontra a fronteira D-01 (aguada fora do PLAT-17) já desenhada, sem precisar redescobri-la.
- `refrigeracao/` e `mapa/xmap.css` seguem intocados, confirmados por comando nesta auditoria — a mesma disciplina que fechou as Fases 5 e 6.

---
*Phase: 10-mapa-operacional*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: TESTES.md (seção "Fase 10" presente)
- FOUND: CLAUDE.md (mapa-dados.js, mapa-geometria.js, mapa-editor.js, planta-cmasm.geojson, D-01 a D-04 presentes)
- FOUND: .claude/CLAUDE.md (mapa-dados.js, mapa-geometria.js, mapa-editor.js presentes)
- FOUND: .planning/REQUIREMENTS.md (PLAT-13/14/17/18/20 fechados, PLAT-19 parcial, PLAT-15/16 reverificados)
- FOUND: .planning/phases/10-mapa-operacional/10-08-SUMMARY.md
- FOUND commit: 5a7c033 (docs 10-08 TESTES.md)
- FOUND commit: b7e0483 (docs 10-08 CLAUDE.md + .claude/CLAUDE.md)
- FOUND commit: 0cf496f (docs 10-08 REQUIREMENTS.md)
