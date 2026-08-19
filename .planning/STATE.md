---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Consolidação da plataforma
current_phase: 7
current_phase_name: ui-ux-mobile
status: verifying
stopped_at: Completed 07-01-PLAN.md — Fase 7 (UI/UX mobile) executada; migração 25 rodou e o UAT de leitura da Fase 10 passou, falta exercitar a escrita no app
last_updated: "2026-08-18T21:56:34.000Z"
last_activity: 2026-08-18
last_activity_desc: Quick task 260818-pzq — Reparos alcançado de dentro do Máquinas, categoria Tobata, ficha com vencimentos (227 testes verdes)
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
Last activity: 2026-08-18 — Quick task 260818-vtm concluída: /reparos com edição por modal, ordenação e filtro por coluna, colunas densas e filtro/agrupamento por tipo de máquina

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
| 2026-08-18 | 260818-pzq-reparos-link-sai-do-portal-e-entra-no-m | Reparos sai do portal e é alcançado de dentro do Máquinas (âncora no cabeçalho da view de OS); categoria Tobata nos dois selects de máquinas; faixa de abas cai de 10 para 8 — Vencimentos vira seção da aba Máquinas e Operações vira seção da aba OS; ficha da máquina ganha bloco de manutenções derivado de calcVencimentos(); node --test 227/227 (commits d0d1b9c, 7630212, 7564dbe) |
| 2026-08-18 | 260818-r65-estoque-e-necessidades-hora-homem-sai-do | Valor da hora-homem sai da aba Estoque para um modal aberto do cabeçalho da aba OS, onde o custo de mão de obra é consumido; `maq_materiais` ganha `sistema` e `aplicacao` (com "Vários" para peça de mais de um modelo), editáveis no modal e visíveis na tabela do estoque; aba "Lista de compras" vira "Necessidades", com preventiva/corretiva/aquisição/a comprar por material, geração de lista de compra (BOM: título, descrição, data, preço congelado na linha) e recebimento item a item que dá entrada no estoque; migração 34 **aplicada em produção em 18/08/2026** e conferida contra o banco (forma, constraints, índices, RLS); o fluxo inteiro foi exercido com dados reais e os artefatos de teste removidos; sem a migração o módulo continua funcionando como antes (D7, conferido antes de aplicar); node --test 253/253 (commits 4591abc, 14c1b30, e260f80, 4c2151d) |
| 2026-08-18 | 260818-twm-estoque-botao-de-editar-cadastro-do-mate | Editar o cadastro do material sai do link escondido no nome e vira botão `⚙` explícito na linha, restrito a `admin`/`gestor` pelo helper `podeEditarCadastro()` — o mesmo que já governa "Editar cadastro" na ficha da máquina, agora escrito num lugar só; o `✎` de quantidade/mínimo/preço fica intocado em `podeEscreverNoModulo()`, que é a ação do técnico. Cada coluna do Estoque ganha ordenação (⇅/↑/↓, `aria-sort`, numérica ou `localeCompare` pt-BR, vazios sempre no fim) e filtro (substring sem acento/caixa, acumulável, com contador "N de 35" e "Limpar filtros"); estado de tela, sem consulta ao Supabase. Núcleo puro em `maquinas/estoque-tabela.js` (padrão de `shared/tema.js`), `renderMateriais()` dividido em cabeçalho + linhas para não matar o foco do campo ao digitar; node --test 279/279 (commits a336cfb, d2c95e2) |
| 2026-08-18 | 260818-vyv-refrigeracao-assets-fora-do-html-acessib | Os 278 KB de base64 embutidos em `refrigeracao/index.html` viram seis arquivos reais ao lado dele — o PNG de 192×192 estava **cinco vezes** no arquivo (favicon, `<img>` da barra, `CT_LOGO_URI` e mais duas dentro do manifest, que era um JSON de 83 KB codificado em base64 só para reembutir os ícones); index.html cai de 445.661 para 143.793 bytes (−67,7%) e os assets passam a ser cacheáveis (conferido: 304 na segunda carga). `CT_LOGO_URI`/`CT_QR_BRAND` viram `new URL(..., location.href).href` porque entram em `document.write()` de janela `about:blank`, onde caminho relativo depende do navegador herdar a base do opener. Acessibilidade: viewport deixa de bloquear o zoom de pinça, `aria-label` nos 7 botões só-de-ícone, `#toast` com `role="status"`/`aria-live`, 95 ícones decorativos `aria-hidden`, `:focus-visible` de volta (branco sobre a barra escura). Inventário ganha ordenação (local, prédio, criticidade, próxima manutenção — criticidade em ordem semântica, sem histórico sempre no fim) e chip "Vencidos"; estado de tela, sem consulta nova nem migração. Achado: **169 dos 171 equipamentos não têm histórico algum**, então "Vencidos" dá 0 hoje — o estado vazio passou a dizer isso em vez de parecer defeito. Os quatro gates do PLAT-15 seguem em 0 e o módulo continua congelado (D-04); gate novo `tests/inventario-ordem-refrigeracao.test.js` 9/9 (commit fc75978) |
| 2026-08-18 | 260818-vtm-reparos-editar-cadastro-por-modal-nas-tr | As três tabelas do /reparos deixam de ser só leitura: cada linha ganha `⚙` que reabre o próprio modal em modo de edição, com o cargo que já governa aquela tabela (`podeCatalogo()` em modelos/serviços, `podeConhecimento()` em reparos) — e aqui a guarda não é só UX, a migração 26 recusa no Postgres. Núcleo de ordenação/filtro do Estoque promovido a `shared/tabela.js` genérico; `tests/estoque-cabecalho-maquinas.test.js` passou sem uma linha alterada. Colunas condensadas (8→5, 6→4, 7→4) com o que se lê junto na mesma célula, CSS compacto escopado ao módulo. Um `<select>` com optgroup Tipo (categoria) + Modelo (onde "Tobata CT151" aparece) filtra as três abas, mais "Agrupar por tipo" com contagem; reparo sem modelo nunca é filtrado fora. node --test 384/384 (commits 3bbf3d9, 4fa5b44, f0f3b56, d8eede3) |
| 2026-08-18 | 260818-vxu-mapa-cobertura-e-posicionamento | Mapa cobre 5 famílias de ativo em vez de 2: `CONFIG_POR_MODULO` substitui os dois dicionários de tabela/colunas porque `equipamentos` (climatização) não tem `ativo`, `codigo`, `nome` nem `status` — o estado dela está em `funciona` (OK/NOK) e a coluna `estado` guarda a idade; camada genérica `mapa/xmap-layers-ativos.js` em vez de três arquivos copiados. Chave `climatizacao`, não `refrigeracao`, porque o gate PLAT-15 proíbe citar o app congelado em `mapa/index.html` — e não há rota em `MODULOS`, então o balão sai sem link de ficha. Segunda porta de posição criada (`salvarPosicaoLocal`, `cmasm_locais`): até agora só existia a posição própria do ativo e a camada herdada de `resolverPosicao` era código morto — 233 prédios ficam posicionáveis, ordenados por quantos ativos cada um acende, com filtro e corte anunciado. Zona sem contorno vira alcançável: "Desenhar" arma o próximo polígono para `atualizarZona` da linha existente em vez de inserir a quarta. Vocabulário de estado unificado no núcleo puro (`ESTADOS`/`normalizarEstado`/`corDoEstado`), com `sobreaviso` ganhando estado próprio; legenda e marcadores leem da mesma lista. Mapa abre com as 5 camadas de dado real ligadas (aguada fica fora, D-01) e ganha busca que voa até o ativo. **Achado:** o gate de inventário de tabelas ficou cego ao varrer só `.from('...')` literal — continuou passando sem ver as cinco tabelas de ativo; corrigido para ler também `CONFIG_POR_MODULO`. Sem migração; `node --test` 342/342 (commits pendentes de PR) |
| 2026-08-18 | 260818-k9c-calibracao-migra-de-localstorage-para-sup | `/calibracao` era o único módulo da plataforma sem banco — 38 instrumentos, 8 laboratórios, 12 PS, 2 lotes e o catálogo da ATA viviam num blob de `localStorage`, de modo que limpar o cache apagava o controle de calibração e cada computador via um dado diferente. Migrações **35 e 36 aplicadas em produção em 18/08/2026** e conferidas contra o banco (68 colunas, 7 checks, 10 índices, RLS nas 5 tabelas, 0 FK órfã); seed **gerado** por `calibracao/gerar-seed.mjs` a partir das constantes do próprio `index.html`. `useStore()` segue sendo a costura única: carrega as 5 tabelas em paralelo e cada mutator grava a própria linha (nunca o blob, senão dois usuários se sobrescrevem); fora dela o React é intocado, e por isso a gravação é otimista. `CAMPOS_*` e `paraISO`/`paraBR` são as duas fronteiras de tradução, com gate comparando os mapas coluna a coluna com a migração. Contador de PS deixou de ser persistido (derivado + `num` unique); a ATA não ganhou tabela. **Dois bugs que só o navegador pegou:** leitura sem `order` reembaralhava a lista a cada edição, e consulta contra host inalcançável não rejeita nem resolve — travava o módulo em "Carregando…" para sempre e engolia gravações perdidas em silêncio (corrigido com prazo de 15 s). Verificado no navegador de ponta a ponta e artefatos de teste removidos. **Pendência de segurança: o módulo segue sem login, policies aceitam `anon`.** node --test 386/386 (commits 9b018a6, 1cacc0a, 7551031, 23e767e, 49f960d, 6fe6170, 21a5e73) |
| 2026-08-19 | 260819-0g3-mapa-predios-como-poligono-zonas-como-ve | Prédio deixa de ser ponto: `cmasm_locais.geom` (migração 37, **aplicada em produção em 19/08/2026** e conferida), contorno desenhado por `L.Draw.Polygon` a partir da lista de prédios sem posição, camada de exibição própria e centroide gravado no mesmo `update` (contorno sem ponto apagaria os ativos que herdam do prédio). Achado que motivou o trabalho: 2 das 7 zonas de `maq_areas` eram edifícios, desenhados com a ferramenta de zona porque não havia outra — e os 2.253 m² do Comando entravam na conta de corte de grama. Zona passa a ser vegetação/área externa, colorida por `flora` e não pelo dicionário legado jardim/bosque, que nunca existiu neste banco. Três sobreposições de controle corrigidas em CSS do módulo (modos do editor para a barra lateral, painel Layers recuando do painel do editor, barra de basemap fora do topo) com `mapa/xmap.js` e `mapa/xmap.css` intocados; caminho de escrita exercido com dado real (contorno do Comando, local 302); as duas zonas que eram prédios convertidas e arquivadas (`ativo = false`) — Museu cadastrado como `CMASM-MUSEU` (id 623) —, com a vegetação ativa caindo de 12.680 m² para 8.754 m²; node --test 400/400 |
| 2026-08-19 | 260819-23e-mapa-sala-herda-posicao-do-predio-cadeia | Herança de posição passa a subir a cadeia `parent_id` com guarda de ciclo: 175 dos 190 ativos apontam para uma `sala`, e a herança olhava só o local direto — posicionar prédio não acendia nada. Sala sai da lista de posicionar (herda do prédio) e a contagem da barra lateral rola da sala para o prédio; a coordenada da Organização Militar **não** é herdável, senão 188 ativos ficariam empilhados num pino só e a lista de trabalho de campo esvaziaria sozinha. Balão diz de qual local a posição veio. Medido no banco real: 54 ativos posicionados (16 próprios + 38 herdados) contra 39 antes, 98 prédios na lista contra 226; node --test 409/409 |
| 2026-08-19 | 260819-348-mapa-legibilidade-agrupar-ativos-co-posi | Legibilidade do mapa, com números medidos na tela: 195 marcadores em 51 pontos (maior pilha 24 no mesmo pixel) viraram **56** por agrupamento de coordenada exata, e 12 rótulos (todos da planta OSM) viraram **66** do cadastro, cortados por zoom. Um desenho de marcador para as três camadas de ativo (`xmap-marcadores.js`), cor do grupo pelo estado mais grave, balão do grupo listando os ativos com link para a ficha. Barra lateral em `<details>` (só Módulos e Edição abertas, contador por cabeçalho) e painel de camadas recolhido com cabeçalho próprio. Achado que só a tela revelava: `fitBounds` animado não acontece sem composição de quadros — o mapa abria em zoom 15 sem erro nenhum. node --test 420/420 |
| 2026-08-19 | 260819-406-mapa-portar-features-do-cmasm-mapa-v2-co | Features do protótipo `cmasm-mapa-v2` (MapLibre) portadas em **função** para o /mapa (Leaflet, `xmap.js` travado): coordenada sob o cursor com 6 casas + zoom, escala métrica, exportação GeoJSON (269 feições no banco atual — 256 ativos, 8 zonas, 5 contornos), aviso não bloqueante no lugar do `alert()` de instrução (alert é modal e engolia o clique que a instrução pedia), opacidade global das camadas atuando em polígono/marcador/rótulo e nunca no tile, e planta de referência com `L.imageOverlay` georreferenciado — melhor que o original, cujo `<img>` com `transform` de CSS não acompanha o mapa. Ordem `[lon,lat]` do RFC 7946 travada por teste: trocada não dá erro, só põe o CMASM na Antártida no QGIS. Fora de escopo com motivo: basemap TOPO (arquivo travado), rotação/pitch 3D (Leaflet não faz), símbolos avulsos (ativo vem do banco), modal 3D (placeholder vazio), atalho Delete (o projeto arquiva). node --test 430/430 |
| 2026-08-19 | 260819-4gq-mapa-estado-ativo-dos-menus-visivel-e-ic | Estado ativo dos menus deixa de ser uma borda de 1px e passa a somar quatro sinais (barra de 4px, fundo tingido, peso 700 e ponto cheio × anel vazio), com `aria-pressed` declarado na marcação; o painel de camadas do `xmap.js` travado ganha a linha inteira marcada, só por CSS. `☰` e `▤` viraram SVG — caíam em fonte de símbolo e apareciam como bloco preto no sistema do usuário. Dois erros achados na própria tela: token de tema (`--text`) num painel que é escuro sempre, e limiar único de rótulo baixado para 16 gerando 137 rótulos sobrepostos — corrigido com dois limiares (estrutura em 15, ativo em 17). O rótulo do grupo passou a nomear o prédio. Fora do código: as 14 máquinas sem posição foram gravadas no ponto do Apoio, e o mapa chegou a **270 de 270 ativos posicionados** (91 próprias, 179 herdadas). node --test 431/431 |
| 2026-08-19 | 260819-4wn-maquinas-tabela-de-areas-com-edicao-filt | Tabela de áreas de serviço (aba OS) deixa de ser só leitura: ordenação e filtro por coluna vindos de `shared/tabela.js` — terceiro consumidor do núcleo, sem uma linha de mudança nele — e edição pelo `⚙`, com um formulário só para inserir e atualizar. A permissão espelha a policy real de `maq_areas` (migração 12: admin, gestor) e é conferida na abertura E na gravação; diferente do gate do estoque, o banco também recusa. A dimensão derivada do contorno desenhado no /mapa fica travada e fora do payload — um número digitado sobreviveria até o próximo ajuste da geometria e sumiria sem aviso. Marca MAPA filtrável e metro quadrado sem casas decimais. node --test 445/445 |
| 2026-08-19 | 260819-5jf-chrome-padronizado-icones-monocromaticos | Chrome padronizado: `shared/icones.js` (17 ícones monocromáticos em `currentColor`, traço Material, núcleo puro) substitui os caracteres do chrome — `☰` aparecia como bloco preto e emoji de aba ignorava o tema. Barra superior virou título/usuário/**Portal (botão)**/Sair em todos os módulos; o tema desceu para o rodapé (6 módulos + portal), que também ganhou o link da Luctronics. Em Máquinas, `OS` virou **OS-Manutenção** e **OS-Corte** entrou logo depois com view própria — "Operações de serviço" → "Ordem de Serviço de Corte", "Áreas de serviço" → "Áreas Vegetais". **Não entregue, aguardando recorte:** componentes compartilhados de serviços/manutenções/estoque/compras/contratações e o porte do fluxo de Contratações (ARP) de Refrigeração — é decisão de dados antes de tela. node --test 456/456 |

## Session Continuity

Last session: 2026-08-19T02:30:00.000Z
Stopped at: Completed quick task 260819-5jf-chrome-padronizado-icones-monocromaticos — chrome padronizado e abas OS-Manutenção/OS-Corte; pendente de recorte: componentes compartilhados e porte das Contratações; node --test 456/456. Anterior: 260819-4wn-maquinas-tabela-de-areas-com-edicao-filt — tabela de áreas com edição, ordenação e filtro; node --test 445/445. Anterior: 260819-4gq-mapa-estado-ativo-dos-menus-visivel-e-ic — estado ativo dos menus legível de relance, ícones em SVG, dois limiares de rótulo; 270/270 ativos posicionados; node --test 431/431. Anterior: 260819-406-mapa-portar-features-do-cmasm-mapa-v2-co — features do protótipo cmasm-mapa-v2 portadas em função (GeoJSON, planta georreferenciada, coordenada, escala, aviso, opacidade); node --test 430/430. Anterior: 260819-348-mapa-legibilidade-agrupar-ativos-co-posi — agrupamento de marcadores, rótulos por zoom, barra lateral colapsável e painel de camadas recolhido; node --test 420/420. Anterior: 260819-23e-mapa-sala-herda-posicao-do-predio-cadeia — sala herda a posição do prédio pela cadeia parent_id; node --test 409/409. Anterior: 260819-0g3-mapa-predios-como-poligono-zonas-como-ve — prédio como polígono (migração 37 aplicada), zona como vegetação e controles do mapa sem sobreposição; node --test 400/400. Anterior: 260818-k9c-calibracao-migra-de-localstorage-para-sup — Calibração migrado do localStorage para o Supabase (migrações 35/36 aplicadas e conferidas); dois bugs de integração pegos no navegador (ordem instável, prazo com rede fora); falta publicar o código
Resume file: None
