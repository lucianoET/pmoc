---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Consolidação da plataforma
current_phase: 06
current_phase_name: tema-claro-escuro
status: executing
stopped_at: Completed 06-02-PLAN.md
last_updated: "2026-08-11T10:06:40.421Z"
last_activity: 2026-08-11
last_activity_desc: Phase 06 execution started
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 11
  completed_plans: 9
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-08)

**Core value:** Cada módulo novo entra no ar seguindo o padrão pmoc existente (Vercel + Supabase + login por cargo), com os dados legados consolidados e importados — sem quebrar os módulos em produção.
**Current focus:** Phase 06 — tema-claro-escuro

## Current Position

Phase: 06 (tema-claro-escuro) — EXECUTING
Plan: 3 of 4
Status: Ready to execute
Last activity: 2026-08-11 — Completed quick task 260811-9sb: Importar módulo Calibração como cópia independente

Progress: [████████░░] 82% (v2.0)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 17min | 3 tasks | 3 files |
| Phase 01 P02 | 10min | 3 tasks | 3 files |
| Phase 01 P03 | 14min | 2 tasks | 2 files |
| Phase quick-260810-k0q P01 | 55min | 3 tasks | 10 files |
| Phase 01 P04 | 50min | 3 tasks | 2 files |
| Phase 05 P01 | 5min | 3 tasks | 4 files |
| Phase 05-base-unificada P02 | 10min | 2 tasks | 3 files |
| Phase 05 P03 | 12min | 1 tasks | 2 files |
| Phase 05 P04 | 8min | 2 tasks | 2 files |
| Phase 05 P05 | 20min | 2 tasks | 3 files |
| Phase 05 P06 | 35min | 2 tasks | 3 files |
| Phase 05-base-unificada P07 | 15min | 2 tasks | 5 files |
| Phase 06 P01 | 3min | 2 tasks | 2 files |
| Phase 06 P02 | 5min | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Decisões completas em PROJECT.md (Key Decisions). Relevantes agora:

- Novos módulos copiam o padrão atual — sem refatorar refrigeração e máquinas
- **Revisto em 09/08/2026:** elétrica e fonoclama têm modelo de manutenção idêntico,
  então compartilham o motor `shared/modulo-manutencao.js` em vez de duplicar ~700
  linhas duas vezes. Cada módulo é só um arquivo de configuração. Os módulos em
  produção continuam intocados — o núcleo comum vale só para os módulos novos.

- Transportes = estilo máquinas (`index.html` + `app.js`); Elétrica/Fonoclama = estilo refrigeração (arquivo único)
- Ordem: Transportes → Elétrica → Fonoclama (prioridade do usuário)
- Dados legados: analisar → consolidar → importar via SQL seed (bloqueante antes do schema)
- Contratação pública (ARP/empenho) fora dos módulos novos
- [Phase ?]: transp_pode_escrever() exige usuarios.ativo=true além do cargo, alinhado com 12_maquinas_areas_operacoes.sql
- [Phase ?]: Leitura de transp_planos permanece pública (using(true)); apenas escrita passa por RBAC, preservando acesso do observador
- [Phase ?]: transp_pode_escrever() não foi redefinida na migração 23 — reutiliza a função já corrigida na migração 22 (ativo=true + cargo)
- [Phase ?]: Policies herdadas de transp_manutencoes (migração 10, sem distinção de cargo) permanecem inalteradas — risco residual T-02-05 (accept)
- [Phase ?]: baixarPecasDoPlano() centraliza todo débito de estoque por OS (salvarOS + concluirOS), guardada por idempotência via manutencao_id em transp_estoque_movimentos
- [Phase ?]: popularPlanosOS() reforça a coerência km/h (D-04) também no seletor de plano da OS, filtrando por tipo_modelo e unidade_uso do ativo
- [Phase ?]: Nenhuma migração SQL nova criada para reimportar o CSV de VTR/EMB — import já concluído em 11_transportes_seed.sql (Fase 01 Plano 04); apenas a consulta de conferência foi documentada em TESTES.md
- [Phase ?]: 01-04: o CSV ref/Mapa de VTR e EMB ATU 20FEV26.csv NAO e o inventario — e registro de viagens de um dia; o inventario real (PDF de mesmo nome) tem 43 ativos (33 viaturas + 10 embarcacoes), corrigido pela migracao 24
- [Phase ?]: 01-04: unidade_uso segue a natureza operacional do equipamento (horimetro vs hodometro), nao a categoria de schema — empilhadeira/trator/guindaste sao tipo=viatura mas unidade_uso=h
- [Phase ?]: D-01: acesso Livre em shared/auth.js grava funcao=cargo.label, preservando o chip 'Livre · observador' de Máquinas
- [Phase ?]: D-03 aplicado: eletrica/app.js e fonoclama/app.js declaram versao: '1.0' no rodapé, repetindo a versão já exibida no cartão do portal
- [Phase 05-03]: predial passa a chamar aplicarShell() diretamente no boot() (padrao distinto do motor modulo-manutencao.js), servindo de referencia para mapa e transportes
- [Phase 05-04]: mapa e o primeiro modulo de producao a usar aplicarShell() com navItems: [] (sem faixa de abas), provando o caso de tela cheia do shell comum
- [Phase 05-05]: transportes e o primeiro caso da fase de aposentadoria completa de uma familia de marca propria (--cyan/kc-cyan/b-cyan) em favor de --accent/kc-accent/b-accent da folha comum; shared/pmoc.css ganhou .b-accent com fundo tintado via color-mix, sem afetar os modulos ja migrados (nenhum usava a classe antes)
- [Phase 05-06]: maquinas e o unico modulo da fase migrado de script classico para type=module no mesmo commit da adocao do login/shell compartilhados — exporNoWindow() vira requisito estrutural (nao so boa pratica) e passa por gate de extracao dinamica dos handlers inline
- [Phase 05-06]: extracao dinamica dos handlers inline em maquinas/index.html + maquinas/app.js encontra 22 nomes (nao 24 como o texto do plano previa), porque sair() e trocarView() passaram a existir so no markup gerado em runtime por shared/shell.js — ambos continuam publicados em exporNoWindow(); todos os 22 nomes extraidos estao publicados (T-05-21 mitigado). Piso numerico "≥23" do gate do plano 05-06 ficou desalinhado com a arquitetura real; documentado como deviation no 05-06-SUMMARY.md
- [Phase 05-06]: tests/integracao-operacoes-maquinas.test.js ajustado — data-view="operacoes"/"agenda" nao existem mais como markup estatico (geradas por aplicarShell()); teste passou a checar id="view-operacoes"/"view-agenda" no HTML e id:'operacoes'/id:'agenda' na config de abas de app.js
- [Phase ?]: [Phase 05-07] Requisitos PLAT-01/02/03/15/16 fechados em REQUIREMENTS.md apenas com evidencia de comando anexada ao texto do requisito, nunca por presuncao
- [Phase ?]: [Phase 05-07] PLAT-15/16 fecham para a Fase 5 com pendencia herdada explicita: conferencia visual humana pos-login nao foi possivel em nenhum plano da fase (sem credenciais Supabase nem Playwright no ambiente autonomo) - registrada em TESTES.md como item isolado para o UAT
- [Phase ?]: 06-01: PLAT-04 nao marcado completo — este plano so prepara CSS (tokens + eliminacao de hardcode), botao e logica de alternancia ficam para 06-02
- [Phase ?]: 06-01: token --accent-texto criado em shared/pmoc.css porque --accent e declarado por modulo (mesma especificidade, cascata posterior) e a folha comum nao consegue redefini-lo por tema
- [Phase ?]: 06-02: shared/tema.js criado como implementação única de tema (núcleo puro + aplicadores), botão #btn-tema injetado em montarShell() propaga para os 6 módulos via aplicarShell()->iniciarTema()
- [Phase ?]: 06-02: normalizarTema valida localStorage por lista fechada com comparação estrita (ASVS V5); sem escuta de prefers-color-scheme em tempo de execução para não sobrescrever escolha manual do usuário

### Pending Todos

- ✅ Migrações 14–16 executadas pelo usuário; `/eletrica` e `/fonoclama` no ar
  (contagens conferidas via REST: 13/9/11/14 e 10/7/10/13).

- ✅ Migrações 17–21 aplicadas e conferidas em produção (10/08/2026): 233 locais
  físicos, 29 edificações, 132 salas, 78 nós de organograma em `cmasm_estrutura`,
  171 equipamentos ligados por `local_id`, zero órfão na árvore.

- Resolver pela tela os locais de Elétrica e Fonoclama que ficaram sem vínculo
  (textos dos apps de demonstração; query de conferência no rodapé da migração 21).

- Seguir o fluxo manual das seções "Predial" e "Locais compartilhados" do `TESTES.md`.

### Módulos fora do roadmap original

Predial não estava no roadmap v1 (que previa Transportes, Elétrica e Fonoclama).
Entrou por decisão do usuário em 09/08/2026, por ser o legado com schema e seed
de dados reais já prontos. A Fase 2 (Transportes — abastecimento, documentação e
painel) segue pendente.

### Blockers/Concerns

- **Fase 1 bloqueada por insumo do usuário:** apps legados de transportes (várias versões, provavelmente localStorage) ainda não fornecidos. Mesmo bloqueio se repete nas Fases 3 (elétrica) e 4 (fonoclama).
- **Decisão pendente na Fase 1:** RLS — corrigir o padrão permissivo herdado ou replicá-lo. Mínimo esperado: `observador` somente leitura.
- **Decisão pendente na Fase 1:** reutilizar `shared/auth.js` por caminho absoluto em vez de duplicar o fluxo de login inline (hoje `maquinas/app.js` duplica).
- **Risco recorrente:** Supabase é compartilhado com produção — revisar cada migração e fazer smoke test em Refrigeração e Máquinas após aplicá-la.
- 01-04: VTR-012 (FIAT DUCATO) importado como status=disponivel seguindo o mapa, mas a restricao registrada diz que a VTR esta na oficina JOMAP — contradicao na propria fonte, nao resolvida, decisao pendente do usuario
- 01-04: Parte B do checkpoint da Task 2 (teste RBAC como observador contra transp_planos, tela de login sem e-mails, gravacao como Gestor, sessao reaproveitada entre modulos) e a checagem de console de navegador de Refrigeracao/Maquinas (INTEG-04) nao foram diretamente observadas por este executor — coordenador direcionou a finalizacao sem reportar falha, mas recomenda-se confirmacao humana explicita

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Quick Tasks Completed

| Data | Tarefa | Resultado |
|------|--------|-----------|
| 2026-08-10 | renumera-migracoes-fase1 | Migrações da Fase 1 renumeradas de 14/15 para 22/23 (14 e 15 já ocupados por elétrica/fonoclama) |
| 2026-08-10 | importar-csv-programacao-vtr-emb-em-transportes | Módulo /mapa portado do legado cmms-mapa (Leaflet + xMap) no padrão pmoc, roteado no vercel.json e no portal; import do CSV VTR/EMB já concluído, apenas consulta de conferência documentada em TESTES.md |
| 2026-08-11 | importar-modulo-calibracao | App legado de calibração (single-file, localStorage, sem Supabase) copiado como módulo independente em /calibracao com assets próprios; rewrite no vercel.json e card ativado no portal — sem unificação com shared/ nem locais (commits 240cfa6, eb1e342) |

## Session Continuity

Last session: 2026-08-11T10:06:40.380Z
Stopped at: Completed 06-02-PLAN.md
Resume file: None
