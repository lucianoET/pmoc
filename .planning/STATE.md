---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Consolidação da plataforma
current_phase: 7
current_phase_name: ui-ux-mobile
status: verifying
stopped_at: Completed 07-01-PLAN.md — Fase 7 (UI/UX mobile) executada; migração 25 rodou e o UAT de leitura da Fase 10 passou, falta exercitar a escrita no app
last_updated: "2026-08-18T13:30:00.000Z"
last_activity: 2026-08-18
last_activity_desc: Módulo Reparos entregue fora do fluxo de fases (164 testes verdes; migrações 26-28 em produção)
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 20
  completed_plans: 20
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-08)

**Core value:** Cada módulo novo entra no ar seguindo o padrão pmoc existente (Vercel + Supabase + login por cargo), com os dados legados consolidados e importados — sem quebrar os módulos em produção.
**Current focus:** Phase 7 — ui-ux-mobile

## Current Position

Phase: 7 (ui-ux-mobile) — EXECUTED
Plan: 1 of 1
Status: Fase 7 completa. Fase 10 completa e com a migração 25 em produção desde 18/08/2026 — o UAT de leitura passou; o que falta é validar a escrita (posicionar ativo, desenhar zona) pela interface, em TESTES.md
Last activity: 2026-08-18 — Fase 7 executada; UAT da Fase 10 registrado; módulo Reparos entregue fora do fluxo de fases

Progress: [██████████] 100% (v2.0)

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
| Phase 06 P03 | 3min | 3 tasks | 8 files |
| Phase 06 P04 | 25min | 2 tasks | 5 files |
| Phase 10 P01 | 15min | 2 tasks | 2 files |
| Phase 10 P02 | 20min | 3 tasks | 3 files |
| Phase 10 P03 | 15min | 2 tasks | 3 files |
| Phase 10 P04 | 35min | 3 tasks | 6 files |
| Phase 10-mapa-operacional P05 | 30min | 3 tasks | 7 files |
| Phase 10-mapa-operacional P06 | 40min | 3 tasks | 5 files |
| Phase 10-mapa-operacional P07 | 50min | 3 tasks | 5 files |
| Phase 10-mapa-operacional P08 | 45min | 3 tasks | 4 files |

## Accumulated Context

### Decisions

- [Reparos 18/08/2026]: o módulo foi entregue **fora do fluxo de fases do GSD** — sem
  `.planning/phases/`, sem PLAN/SUMMARY. Decisões e requisito estão em PROJECT.md; roteiro de
  teste manual em TESTES.md. Uma fase futura que reorganizar isso não deve tratar como lacuna.
- [Reparos 18/08/2026]: `create table if not exists` numa migração aditiva garante a **existência**
  da tabela, não a **forma** dela. As `rep_*` foram criadas de um rascunho antes da 26; quando a 26
  rodou, os `create table` viraram no-op e as definições corretas foram ignoradas em silêncio, sem
  erro nenhum. A migração 28 fecha a diferença. Conferir colunas depois de aplicar, não só se o
  script terminou sem exceção.
- [Reparos 18/08/2026]: o write path do módulo **nunca foi exercido** — `rep_reparos.frequencia`
  está 0 nos 33 reparos. Mesma pendência do `/mapa` na Fase 10. Checklist em TESTES.md.

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
- [Phase ?]: 06-03: script anti-FOUC posicionado byte-idêntico (mesma posição relativa, não só mesmo comportamento) imediatamente após a meta tag de cor de barra nas 7 superfícies, para que o teste de superfícies compare a mesma linha sem ambiguidade de contexto
- [Phase ?]: 06-03: portal ganhou bloco [data-theme="claro"] embutido (cópia deliberada dos tokens de shared/pmoc.css, D-02) e consome shared/tema.js via iniciarTema() — duplicação de tokens é obrigatória, duplicação de lógica não acontece
- [Phase ?]: 06-03: PLAT-04/PLAT-05/PLAT-16 não marcados [x] em REQUIREMENTS.md — fechamento formal com evidência reservado ao plano 06-04, mesmo precedente de 06-01/06-02
- [Phase ?]: [Phase 06-04] D-05 registrada: /calibracao (8a superficie, importada por tarefa concorrente durante a Fase 6) fica fora da convencao pmoc-tema por decisao — tem alternador de tema proprio e incompativel (cmasm_erp_theme, dark/light), provado em codigo por caso novo em tests/tema-superficies.test.js
- [Phase ?]: [Phase 06-04] PLAT-04/PLAT-05 fechados com evidencia por comando; PLAT-15/PLAT-16 reverificados para a Fase 6 sem apagar o registro da Fase 5 (05-07) — node --test 44/44, refrigeracao/mapa/xmap.css intocados desde 351b13c
- [Phase ?]: [Phase 06-04] Tres gates automatizados mal especificados encontrados na auditoria (dois em 06-02-PLAN.md ja contornados por comentario legitimo, um no proprio 06-04-PLAN.md — grep -qiE com \| sob -E nao alterna) — documentados no SUMMARY, nao corrigidos nos planos de origem
- [Phase ?]: [Phase 10-01] Envelope geográfico como restrição única por tabela combinando lat e lon com AND (não duas restrições separadas), capturando o par trocado (latitude gravada na coluna de longitude)
- [Phase ?]: [Phase 10-01] Nenhuma policy nova criada na migração 25: as seis tabelas (cmasm_locais + 5 tabelas de ativo) já escopam insert/update a authenticated desde suas migrações de origem; colunas novas herdam essa restrição
- [Phase ?]: [Phase 10-01] cmasm_locais.lat/lon completa o Pattern 2 do RESEARCH (posição herdada do prédio/sala); coluna maquinas_compativeis não criada em maq_areas — compatibilidade fica derivada por função pura no cliente (plano 10-02)
- [Phase ?]: [Phase 10-02] calcAreaM2 e calcCompatCliente portadas byte-a-byte do legado (DEV_ERP/cmms-mapa/admin.html), incluindo o ternário redundante do ramo acentuado — quirk sem efeito prático preservado, não uma correção
- [Phase ?]: [Phase 10-02] VOCABULARIO_REGRA fixado nos três termos reais de calcCompatCliente (cortador_grama, roçadeira, motosserra); minitrator/trator saem em semMapeamento sem adivinhação, cobrindo o Pitfall 1 da pesquisa
- [Phase ?]: [Phase 10-02] D-01 (aguada mock) e D-04 (sem maq_operacoes/horas_utilizadas/area_executada_m2 em mapa/) viram gate permanente em tests/mapa-decisoes.test.js, com varredura dinâmica de diretório
- [Phase ?]: [Phase 10-03] Chave de parâmetro do deep link conferida por teste contra o resultado real de linkDoModulo() de mapa/mapa-geometria.js, não repetida a mão — mapa-geometria.js não exporta constante isolada com o nome da chave
- [Phase ?]: [Phase 10-03] _abrirAtivoDaUrl() e DEEP_LINK_ATIVO_CONSUMIDO usam o mesmo nome nos dois arquivos de destino (maquinas/app.js, shared/modulo-manutencao.js) — mesma adição, escrita duas vezes
- [Phase ?]: createTile usa getTileUrl() publico do Leaflet (troca sincrona de this._url) em vez do _getTileData(coords) do esboco do RESEARCH — metodo inexistente na API real do Leaflet 1.9.4
- [Phase ?]: Poligono vs linha na conversao OSM decidido pela chave principal (building/landuse/natural/man_made), nao por qualquer caminho fechado — highway/waterway/barrier/place continuam linha
- [Phase ?]: mapa-dados.js: TABELA_POR_MODULO fica só com maquinas/eletrica (o que o plano 10-05 usa), cresce nos planos 10-06/10-07
- [Phase ?]: Ponte de vocabulário status/estado local a cada arquivo de camada (statusParaExibicao/estadoParaExibicao) traduz operante/inoperante/manutencao/baixado do banco para o vocabulário de cor/ícone dos componentes visuais portados do legado, sem tocar essas funções
- [Phase ?]: CARGOS_ZONA = [admin, gestor] espelha a política de escrita real de maq_areas (migração 12), comparada por teste com a política real, não apenas lida
- [Phase ?]: area_m2 nunca aceito pronto da tela — sempre recalculado via calcAreaM2 na mesma chamada que grava geom (T-10-30)
- [Phase ?]: CARGOS_POSICAO = [admin, gestor, tecnico]: subconjunto deliberado da policy real de update de maq_ativos/elet_ativos (sem role in(...)), diferente de CARGOS_ZONA (10-06) que espelha 1:1 a policy de maq_areas
- [Phase ?]: Modo 'Mover ativos' com toggle próprio (camada arrastável separada da de exibição) — evita duplicar visualmente marcadores; xMap.registerLayer não é chamado de novo após uma gravação por causa de bug conhecido em mapa/xmap.js (arquivo com edição proibida) que duplicaria layerGroups
- [Phase ?]: PLAT-19 fechado como parcial — desenho de zona sem rede pronto e provado; tiles raster ficam como procedimento do usuário (mapa/tiles/GERAR-TILES.md), nunca marcado completo por presunção
- [Phase ?]: PLAT-13 corrigido no próprio texto do requisito: o vínculo cmasm_locais.local_id é organizacional, não geográfico — a migração 25 acrescentou lat/lon de fato

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

Last session: 2026-08-12T10:26:24.909Z
Stopped at: Completed 10-08-PLAN.md — Fase 10 (mapa operacional) fechada
Resume file: None
