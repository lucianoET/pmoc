# Requisitos — PMOC · CMASM

> Milestone corrente: **v2.0 — Consolidação da plataforma** (requisitos `PLAT-*` abaixo).
> Os requisitos `v1` seguem listados: os marcados `[x]` foram entregues no v1.0; os `[ ]`
> foram adiados para depois do v2.0, por decisão do usuário em 10/08/2026 — consolidar a
> base antes de continuar o trabalho de domínio, para construí-lo uma vez só.

## v2 Requirements — Consolidação da plataforma (PLAT)

Escopo: `maquinas`, `transportes`, `eletrica`, `fonoclama`, `predial`, `mapa`.
**`refrigeracao` está fora** — congelado por decisão do usuário.

### Base unificada

- [x] **PLAT-01**: Os 6 módulos no escopo carregam `shared/pmoc.css` como fonte única de tokens visuais (cor, tipografia, espaçamento) — nenhum define paleta própria — **verificado em 05-07**: `grep -c "shared/pmoc.css" {maquinas,transportes,eletrica,fonoclama,predial,mapa}/index.html` = 1 em cada um dos 6; nenhum dos 6 declara `--bg:`/`--surface:`/`--border:`/`--text:`/`--ff:` (a única declaração de cor própria restante em cada um é `--accent`)
- [x] **PLAT-02**: Os 6 módulos usam `shared/auth.js` para login por cargo — `maquinas/app.js` deixa de duplicar o fluxo inline — **verificado em 05-07**: `transportes`, `predial`, `mapa` e `maquinas` importam `Auth` de `shared/auth.js` diretamente em `app.js`; `eletrica`/`fonoclama` autenticam pelo motor `shared/modulo-manutencao.js`, que importa `Auth` de `./auth.js`; nenhum dos 6 declara `CARGOS` inline nem contém endereço `@cmasm.local` (0 ocorrências em todos)
- [x] **PLAT-03**: Existe um shell de layout comum (cabeçalho, navegação por abas, rodapé) reutilizado pelos módulos, sem cada um remontar a estrutura — **verificado em 05-07**: `maquinas`, `transportes`, `predial` e `mapa` chamam `aplicarShell()` de `shared/shell.js` diretamente em `app.js`; `eletrica`/`fonoclama` herdam via `shared/modulo-manutencao.js`, que também chama `aplicarShell()`; os 3 módulos com faixa de abas escrita à mão antes da fase (`maquinas`, `transportes`, `predial`) têm 0 ocorrências de `nav-btn` estático em `index.html`

### Tema

- [x] **PLAT-04**: Usuário alterna entre tema claro e escuro em qualquer módulo, com uma única implementação apoiada nas variáveis de `pmoc.css` — **verificado em 06-04**: `shared/tema.js` é a única implementação (núcleo puro + aplicadores de DOM) para as 7 superfícies do projeto; o botão `#btn-tema` é injetado uma vez em `shared/shell.js`/`montarShell()` e chega aos 6 módulos via `aplicarShell()`, e o portal o consome diretamente; `for f in index.html maquinas/index.html transportes/index.html eletrica/index.html fonoclama/index.html predial/index.html mapa/index.html; do grep -h "pmoc-tema" $f | head -1; done | sort -u | wc -l` = 1 (as 7 cópias do script de pré-desenho são byte-idênticas); `tests/tema-superficies.test.js` (10 casos) prova por comando que nenhum dos 6 módulos declara token de cor além de `--accent` nem cria bloco de tema próprio — **parcialmente fechado em produção (12/08/2026)**, em navegador real contra `https://pmoc-orcin.vercel.app` após o merge do PR #6: clique real em `#btn-tema` no portal alterna `claro → escuro` e grava em `localStorage['pmoc-tema']`; o critério de sucesso 5 deixou de ser calculado e passou a ser **medido** sobre a renderização real em `/maquinas`, compondo o alfa de 8% do fundo dos callouts sobre o fundo da página — corpo 14,05:1 (claro) / 13,71:1 (escuro), `co-warn` 4,81:1 / 6,68:1, `co-ok` 5,08:1 / 4,90:1, todos acima do mínimo AA de 4,5:1, com margem mais estreita de 0,31 em `co-warn` no tema claro — **pendência remanescente**: o clique foi exercitado no portal e em `/maquinas`; `transportes`, `eletrica`, `fonoclama`, `predial` e `mapa` não foram abertos, e `co-red`/`co-blue` não estavam renderizados na página medida; registrados em `TESTES.md` § "Fase 6" como roteiro manual para o UAT
- [x] **PLAT-05**: A preferência de tema persiste entre sessões e entre módulos, e respeita `prefers-color-scheme` na primeira visita — **verificado em 06-04**: `shared/tema.js` centraliza a leitura salvo→sistema→padrão sob a chave única `localStorage['pmoc-tema']`, compartilhada entre as 7 superfícies pela mesma origem; `normalizarTema` valida por lista fechada com comparação estrita, sem trim nem conversão de caixa (ASVS V5), coberto por `tests/tema.test.js` (8 casos, incluindo recusa de carga de marcação e de valor corrompido); nenhuma escuta de `prefers-color-scheme` em tempo de execução, para que a escolha manual do usuário não seja sobrescrita pelo sistema — **parcialmente fechado em produção (12/08/2026)**, em navegador real contra `https://pmoc-orcin.vercel.app`: com `localStorage` sem a chave `pmoc-tema` e o navegador em `prefers-color-scheme: light`, o portal carregou já em `data-theme="claro"` — a cadeia salvo → sistema → padrão funciona no navegador, não só no teste de unidade; alternado para `escuro` no portal e navegando para `/maquinas`, o módulo herdou `escuro` e trouxe o botão, provando a persistência entre superfícies com sessão real — **pendência remanescente**: fechar e reabrir o navegador de fato (a verificação usou navegação e recarga, não reinício do processo) e trocar a preferência do sistema operacional com a chave já gravada; registrados em `TESTES.md` § "Fase 6" como roteiro manual para o UAT

### Mobile

- [ ] **PLAT-06**: Os módulos `eletrica`, `fonoclama`, `predial` e `mapa` são utilizáveis em tela de celular — tabelas, modais e navegação sem rolagem horizontal da página
- [ ] **PLAT-07**: Alvos de toque e formulários seguem tamanho mínimo utilizável em campo, onde o uso é por celular

### Componentes compartilhados

- [ ] **PLAT-08**: Kanban extraído de `maquinas/operacoes.js` para `shared/`, com os testes existentes preservados, e adotado por ao menos mais um módulo
- [ ] **PLAT-09**: Calendário/agenda extraído de `maquinas/` para `shared/` e adotado por ao menos mais um módulo

### Documentos

- [ ] **PLAT-10**: Exportação CSV unificada num utilitário compartilhado — hoje são 5 implementações independentes, com separador e escape divergentes
- [ ] **PLAT-11**: Usuário importa dados de arquivo (CSV) nos módulos, com pré-visualização e conferência antes de gravar
- [ ] **PLAT-12**: Usuário gera PDF do que está vendo (inventário, OS, inspeção) a partir de uma implementação compartilhada

### Mapa

- [x] **PLAT-13**: O `/mapa` plota ativos dos módulos sobre a planta do CMASM, posicionados por coordenada geográfica própria ou herdada do local. **Correção de premissa** (registrada no `ROADMAP.md` § Phase 10 e reafirmada aqui no fechamento): o texto original deste requisito dizia "usando o vínculo `cmasm_locais.local_id` já existente" — a pesquisa da fase mostrou que esse vínculo é organizacional (posiciona o ativo na árvore de locais), não geográfico; `cmasm_locais` não tinha nenhuma coluna de coordenada. A migração 25 (`supabase/25_mapa_geometria_posicao.sql`) acrescentou `lat`/`lon` a `cmasm_locais` e às cinco tabelas de ativo — **verificado em 10-08**: as colunas existem no arquivo da migração (`grep -c 'add column if not exists lat' supabase/25_mapa_geometria_posicao.sql`), `resolverPosicao` (`mapa/mapa-geometria.js`) é função pura que resolve posição própria vencendo herdada, coberta por `tests/mapa-geometria.test.js`; `mapa/mapa-dados.js#posicionarAtivos` consome essa função e acumula ativos sem posição em `NAO_LOCALIZADOS` em vez de os descartar em silêncio. **Pendência nomeada**: a conferência visual com ativo posicionado depende de sessão real e da migração 25 aplicada em produção — nenhuma das duas disponível neste ambiente; roteiro em `TESTES.md` § "Fase 10", Critérios 1 e 4
- [x] **PLAT-14**: Usuário navega do ativo no mapa para o registro dele no módulo de origem — **verificado em 10-08**: as duas metades existem e são testadas separadamente. Origem: `linkDoModulo` (`mapa/mapa-geometria.js`, núcleo puro) monta a rota `?ativo=<id>` só para módulo de lista fechada e id inteiro, consumida por `mapa/xmap-layers-grama.js`/`-eletrica.js`, nunca concatenada à mão (`tests/mapa-camadas.test.js`). Destino: `maquinas/app.js` e `shared/modulo-manutencao.js` (eletrica/fonoclama) leem `URLSearchParams`, validam o identificador (`Number.isSafeInteger`) e abrem a ficha depois de `carregarTudo()` terminar (`tests/mapa-deep-link.test.js`), com a chave de parâmetro comparada entre os dois lados por teste, não repetida a mão. **Pendência nomeada**: o percurso de ponta a ponta pela tela (clicar de fato e ver a ficha abrir) depende de sessão real — roteiro em `TESTES.md` § "Fase 10", Critério 3
- [x] **PLAT-17**: As camadas do mapa leem dados do Supabase em vez dos dados de demonstração embutidos em `mapa/xmap-layers-*.js` — sem isso não há onde gravar edição. **Verificado em 10-08**: `mapa/xmap-layers-grama.js` e `mapa/xmap-layers-eletrica.js` não têm mais `MOCK_AREAS`/`MOCK_MAQUINAS`/`GERADORES`/`TRANSFORMADORES`/`QUADROS`/`RAMAIS` — nenhuma das duas declara lista de dados fixos, gate permanente em `tests/mapa-camadas.test.js`. **Fronteira D-01 registrada explicitamente**: a camada `aguada` continua com os 35 pontos fixos em `mapa/xmap-layers-aguada.js` — decisão travada (não tem tabela no pmoc, é sistema externo autônomo por MQTT), adiada para a Phase 11, travada por gate (`tests/mapa-decisoes.test.js`) — não é regressão deste requisito
- [x] **PLAT-18**: Usuário desenha zonas de serviço no mapa (polígono), atribui características de terreno (flora, inclinação, limpeza), vê a área calculada em m² e as máquinas compatíveis. As zonas são auxiliares e temporárias: ficam em `maq_areas`, **fora** da árvore `cmasm_locais` (D-03). **Verificado em 10-08**: `mapa/mapa-editor.js` (modo "Editar zonas", escopado por `CARGOS_ZONA = ['admin','gestor']`, comparado por teste com a política real de escrita de `maq_areas` — migração 12) desenha só polígono sobre a instância de mapa existente; a área calculada usa `calcAreaM2` (núcleo puro, fórmula geodésica portada e conferida numericamente contra um quadrado de 100 m de lado, dentro de 1% de 10.000 m²) e as máquinas compatíveis usam `maquinasParaZona`, mostrando as não classificadas em vez de escondê-las; `salvarZona`/`atualizarZona` (`mapa/mapa-dados.js`) recalculam `area_m2` na mesma chamada que gravam `geom`, nunca aceitam área pronta da tela. **Pendência nomeada**: desenhar de fato e ver a zona persistir/reabrir depende de sessão real e da migração 25 — roteiro em `TESTES.md` § "Fase 10", Critério 7
- [ ] **PLAT-19** *(parcial)*: O mapa base abre sem internet na área do CMASM, a partir de tiles servidos pelo próprio projeto, caindo para o provedor online fora dessa área ou além do zoom coberto. O satélite fica **apenas online**, por decisão do usuário (D-02). **Fecha parcial, e escrito como parcial — verificado em 10-08**: a metade que garante o desenho da área sem rede está pronta e conferível localmente — `mapa/planta-cmasm.geojson` (117 feições, 171 KB, atribuição ODbL, gerado sem rede por `mapa/gerar-planta.mjs`) desenha a área do CMASM independente de qualquer tile, e o mecanismo `TileLocalComFallback` (`mapa/xmap.js`, instanciado uma única vez, só no basemap `map`) cai para o provedor online quando não há tile local — gate estrutural em `tests/mapa-base-offline.test.js` (10 casos), satélite confirmado sem referência a tile local (D-02). A metade de tiles raster depende de o usuário rodar o procedimento em `mapa/tiles/GERAR-TILES.md` na própria máquina — hoje `mapa/tiles/` só tem `.gitkeep`. **Não marcado como completo**: nenhuma sessão de navegador com a rede desligada foi exercitada neste ambiente (sem service worker, o teste contra a URL de produção é fisicamente impossível — só serve servidor local), e presumir isso seria presunção sobre algo que ninguém exercitou. Roteiro em `TESTES.md` § "Fase 10", Critério 9
- [x] **PLAT-20**: Usuário acrescenta e reposiciona ativos dos módulos diretamente pelo mapa, com a posição persistida. **Verificado em 10-08**: `salvarPosicaoAtivo(modulo, id, lat, lon)` (`mapa/mapa-dados.js`) resolve a tabela pela lista fechada (`TABELA_POR_MODULO`), valida o id como inteiro estrito e a coordenada pelo envelope geográfico (`dentroDoEnvelope`, núcleo puro) antes de qualquer viagem de rede, grava `lat`/`lon` juntos no mesmo `.update(`, nunca em `cmasm_locais` (só a tabela do próprio ativo) — gate: `tests/mapa-posicionamento.test.js`, com os quatro números do envelope conferidos idênticos entre `mapa-geometria.js` e o `check` da migração 25. O modo "Mover ativos" (`mapa/mapa-editor.js`) reverte o marcador para a posição anterior quando a gravação falha (arraste para fora do envelope, ou erro do banco) — nunca fica visualmente "salvo" num lugar que o banco recusou. Escopado por `CARGOS_POSICAO = ['admin','gestor','tecnico']` — subconjunto deliberado da política real (que aceitaria qualquer sessão `authenticated`), diferente de `CARGOS_ZONA` por desenho. **Pendência nomeada**: arrastar de fato e ver a coordenada persistir depende de sessão real e da migração 25 — roteiro em `TESTES.md` § "Fase 10", Critério 8

### Mapa — fases posteriores

- [ ] **PLAT-21**: Posições de GPS e leituras de sensores aparecem no mapa, alimentadas pela camada de dispositivos (Home Assistant/MQTT) por escrita de fora para dentro no Supabase — nenhum serviço do CMASM aceita conexão de entrada. Inclui mapa de calor de sensores. **Travado** por decisão de política de segurança da OM sobre exposição de telemetria
- [ ] **PLAT-22**: Usuário sobrepõe planta ao mapa (imagem, PDF ou CAD vetorial), ancorada geograficamente, acompanhando pan e zoom, com controle de opacidade, rotação e escala. Para CAD vetorial (DXF), a planta entra como geometria do mapa em vez de imagem sobreposta

### Não regressão

- [x] **PLAT-15**: `refrigeracao` continua funcionando sem nenhuma alteração — não carrega `pmoc.css` nem o shell comum — **verificado em 05-07**: `git diff --name-only b53505c..HEAD -- refrigeracao/` retorna lista vazia (nenhum commit da fase tocou o diretório); `grep -c 'shared/\|pmoc.css' refrigeracao/index.html` = 0 — **pendência herdada**: a conferência humana com o inspetor de rede aberto e a checagem visual do fluxo principal não puderam ser feitas neste plano nem em nenhum dos planos 05-02 a 05-06 (ambiente autônomo, sem credenciais Supabase nem Playwright) — fica registrada em `TESTES.md` § "Fase 5" como item isolado para o UAT — **reverificado na Fase 6 (06-04)**: `git diff --name-only 351b13c..HEAD -- refrigeracao/` continua vazio; `grep -c 'shared/\|pmoc.css' refrigeracao/index.html`, `grep -c 'pmoc-tema' refrigeracao/index.html` e `grep -c 'data-theme' refrigeracao/index.html` são todos 0 — os três agora também travados por gate automatizado permanente em `tests/tema-superficies.test.js`, deixando de depender só de disciplina humana; **pendência herdada repetida**: a conferência humana com inspetor de rede e o percurso do fluxo principal continuam pendentes, mesmo motivo — registrada de novo em `TESTES.md` § "Fase 6" — **reverificado na Fase 10 (10-08)**: `git diff --name-only 511bb9e..HEAD -- refrigeracao/` continua vazio (baseline da Fase 10); `grep -c "$p" refrigeracao/index.html` para `shared/`, `pmoc.css`, `pmoc-tema`, `data-theme`, `mapa-dados` e `mapa-geometria` dá **0** para os seis termos — as duas últimas buscas são novas nesta fase (nenhum arquivo do módulo mapa vazou para dentro da refrigeração). Esta fase **acrescentou colunas a `equipamentos`** (a tabela da refrigeração — `lat`/`lon` via migração 25) — isto **não viola** o requisito: o requisito protege o app (nenhuma linha de código do app tocada, confirmado acima), a alteração no banco compartilhado é aditiva, e há precedente aceito de coluna aditiva em tabela compartilhada na migração 19 (`local_id`). **Pendência herdada repetida, mesmo motivo**: conferência humana de rede e percurso do fluxo principal seguem pendentes — registrada de novo em `TESTES.md` § "Fase 10"
- [x] **PLAT-16**: Nenhum módulo perde funcionalidade na unificação; o que existia antes continua existindo depois — **verificado em 05-07**: cada plano (05-01 a 05-06) documentou por gate estrutural que views/ids/modais/permissões de domínio permaneceram intactos; `node --test` subiu de 19 para 25 testes, todos verdes, sem nenhum teste removido ou enfraquecido; as 7 rotas do `vercel.json` resolvem para arquivos existentes — **pendência herdada**: a conferência visual humana pós-login (clicar em todas as abas/modais dos 6 módulos com sessão Supabase real) não pôde ser feita em nenhum plano da fase por falta de credenciais e de Playwright no ambiente autônomo; registrada como roteiro manual pendente em `TESTES.md` § "Fase 5", item para o UAT — **reverificado na Fase 6 (06-04)**: `node --test` sobe de 25 (baseline pós-Fase 5) para 44 testes, 0 falhas, nenhum teste removido — crescimento em `tests/shell.test.js` (6→7, botão de tema), `tests/tema.test.js` (novo, 8 casos) e `tests/tema-superficies.test.js` (novo no plano 06-03 com 9, mais 1 caso desta auditoria — D-05 calibração — 10 no total); as rotas de `vercel.json` (as 7 desta fase mais `/calibracao`, importada por tarefa concorrente fora do escopo da fase) resolvem para arquivo existente; nenhuma view/id/modal/permissão de domínio mudou nos 6 módulos — **pendência herdada repetida**: a conferência visual humana pós-login continua pendente, mesmo motivo — registrada de novo em `TESTES.md` § "Fase 6" — **reverificado na Fase 10 (10-08)**: `node --test` sobe de 58 (baseline `511bb9e`, início da Fase 10) para **135** testes, 0 falhas, nenhum teste do baseline removido ou enfraquecido — os 77 casos novos vêm de sete arquivos (`tests/mapa-schema.test.js` 9, `tests/mapa-geometria.test.js` 23, `tests/mapa-decisoes.test.js` 4, `tests/mapa-deep-link.test.js` 7, `tests/mapa-base-offline.test.js` 10, `tests/mapa-camadas.test.js` 8, `tests/mapa-editor.test.js` 8, `tests/mapa-posicionamento.test.js` 8); as 8 rotas do `vercel.json` (as 7 anteriores mais `/calibracao`) resolvem para arquivo existente. **Pendência herdada repetida, mesmo motivo**: conferência visual humana pós-login continua pendente — registrada de novo em `TESTES.md` § "Fase 10"

### Pendências de dados e operação (não são requisito — não sumem)

- **Migração 25 não executada em produção**: `supabase/25_mapa_geometria_posicao.sql` precisa ser
  colado e rodado no SQL Editor do projeto `pmoc` antes de qualquer conferência visual do mapa.
  Procedimento e consultas de confirmação em `10-01-SUMMARY.md` § "User Setup Required" e no
  rodapé do próprio arquivo de migração.
- **Coordenada dos prédios em `cmasm_locais` não preenchida**: a camada herdada de
  `resolverPosicao` (posição do prédio/sala) só passa a valer depois de alguém gravar `lat`/`lon`
  nesses registros — pendência de dado, não de código; posicionar ativo por ativo pela lista de
  não localizados já resolve o caso de uso sem depender disso.
- **Tiles raster locais não gerados** (opcional, fidelidade cartográfica adicional a PLAT-19):
  procedimento completo em `mapa/tiles/GERAR-TILES.md`, passo do usuário, não bloqueante.

---

## v1 Requirements

### Transportes (TRANSP)

- [x] **TRANSP-01**: Gestor pode cadastrar viaturas e embarcações num inventário único, com categoria (viatura/embarcação) e unidade de medida de uso (km ou horas de motor)
- [x] **TRANSP-02**: Gestor pode definir planos de manutenção por `tipo_modelo` com intervalos em km ou horas
- [x] **TRANSP-03**: Técnico pode abrir e concluir OS vinculada a ativo + plano + peças, com baixa automática de estoque e atualização do uso do ativo
- [x] **TRANSP-04**: Usuário pode registrar uso (km rodado / horas de motor) e o sistema detecta manutenção vencida/próxima
- [ ] **TRANSP-05**: Usuário pode registrar abastecimento por veículo/condutor e ver consumo médio (km/l ou l/h)
- [ ] **TRANSP-06**: Gestor pode cadastrar documentos por ativo (licenciamento, seguro, vistoria) com data de vencimento e receber alertas com antecedência
- [x] **TRANSP-07**: Gestor pode controlar estoque de peças com alerta de mínimo e lista de compras CSV
- [ ] **TRANSP-08**: Gestor vê dashboard de frota (KPIs, disponibilidade operacional, alertas)
- [x] **TRANSP-09**: Dados legados de transportes são analisados, consolidados e importados via SQL seed

### Elétrica (ELET)

- [ ] **ELET-01**: Gestor pode cadastrar ativos elétricos por local (subestações, quadros, geradores, transformadores)
- [ ] **ELET-02**: Gestor pode definir planos de inspeção periódica por tipo de ativo (mensal/trimestral/semestral/anual)
- [ ] **ELET-03**: Técnico pode executar checklist de inspeção com registro de não conformidade e ação corretiva
- [ ] **ELET-04**: Sistema detecta inspeções vencidas/próximas e exibe dashboard com KPIs
- [ ] **ELET-05**: Técnico pode acessar ativo em campo via QR code
- [ ] **ELET-06**: Dados legados de elétrica são analisados, consolidados e importados via SQL seed

### Fonoclama (FONO)

- [ ] **FONO-01**: Gestor pode cadastrar zonas/ativos de áudio (amplificadores, central, zonas de alto-falantes)
- [ ] **FONO-02**: Gestor pode definir planos de teste periódico (teste de zona, carga do amplificador, continuidade da linha 70V)
- [ ] **FONO-03**: Técnico pode executar checklist de teste com registro de não conformidade e ação corretiva
- [ ] **FONO-04**: Sistema detecta testes vencidos e exibe dashboard com estado das zonas
- [ ] **FONO-05**: Dados legados do fonoclama são analisados, consolidados e importados via SQL seed

### Integração (INTEG)

- [ ] **INTEG-01**: Portal em `/` exibe links e status dos novos módulos
- [x] **INTEG-02**: Rotas `/transportes`, `/eletrica`, `/fonoclama` configuradas em `vercel.json`
- [ ] **INTEG-03**: Login por cargo (admin/gestor/tecnico/observador) funciona nos três módulos novos via tabela `usuarios` compartilhada, com RLS — **parcial**: a camada de banco está verificada (policies de `transp_planos`/`transp_materiais` conferidas ao vivo, escrita restrita a `authenticated` com predicado `transp_pode_escrever()`, que exige `usuarios.ativo = true` e cargo em admin/gestor/tecnico); falta a verificação de ponta a ponta pela tela — login por cargo sem exibir e-mails, observador sem controles de escrita, e tentativa de escrita direta pelo console como observador (Parte B do checkpoint do Plano 01-04, não executada)
- [x] **INTEG-04**: Módulos em produção (refrigeração, máquinas) continuam funcionando sem alteração — migrações apenas aditivas

## Backlog de domínio (sem milestone atribuído)

Ideias levantadas na fase de requisitos do v1.0, ainda sem fase. Não confundir com os
requisitos `PLAT-*` do milestone v2.0 acima.

- [ ] Alerta de anomalia de consumo (desvio sobre histórico) — Transportes
- [ ] Exportação de histórico de manutenção por ativo para auditoria — Transportes
- [ ] Termografia anexada à tarefa — Elétrica
- [ ] Regime de teste específico de gerador (partida/carga/autonomia) — Elétrica
- [ ] Registro de qualificação do técnico (NR-10) — Elétrica
- [ ] Mapa de cobertura por zona — Fonoclama
- [ ] Teste de autonomia de backup — Fonoclama
- [ ] Alerta de recorrência de não conformidade — Elétrica/Fonoclama
- [ ] Estoque de peças elétricas dedicado — Elétrica

## Out of Scope

- Telemetria/GPS em tempo real — hardware + integração externa; registro manual como em máquinas
- Roteirização/otimização de rotas — logística, não manutenção
- Integração DETRAN/RENAVAM — sem API pública viável; cadastro manual
- Fluxo de contratação pública (ARP/empenho/fiscalização) nos módulos novos — decisão de PROJECT.md
- Módulo Calibração — não selecionado neste ciclo
- Refatoração dos módulos existentes / núcleo compartilhado — decisão de PROJECT.md
- Conformidade formal NFPA 72 / broadcast de áudio ao vivo — Fonoclama é módulo de manutenção
- Build tooling — mantém zero-build

## Traceability

Cobertura v2.0: 22/22 requisitos `PLAT-*` mapeados — os 16 originais mais PLAT-17 a PLAT-22, acrescentados no replanejamento do mapa (Phase 10 expandida, Phases 11 e 12 criadas). Cobertura v1.0: 24/24 requisitos mapeados.

| Requisito | Fase | Status |
|-----------|------|--------|
| PLAT-01 | Phase 5 | Complete — verificado em 05-07 |
| PLAT-02 | Phase 5 | Complete — verificado em 05-07 |
| PLAT-03 | Phase 5 | Complete — verificado em 05-07 |
| PLAT-04 | Phase 6 | Complete — verificado em 06-04 |
| PLAT-05 | Phase 6 | Complete — verificado em 06-04 |
| PLAT-06 | Phase 7 | Pending |
| PLAT-07 | Phase 7 | Pending |
| PLAT-08 | Phase 8 | Pending |
| PLAT-09 | Phase 8 | Pending |
| PLAT-10 | Phase 9 | Pending |
| PLAT-11 | Phase 9 | Pending |
| PLAT-12 | Phase 9 | Pending |
| PLAT-13 | Phase 10 | Complete — verificado em 10-08 |
| PLAT-14 | Phase 10 | Complete — verificado em 10-08 |
| PLAT-17 | Phase 10 | Complete — verificado em 10-08 |
| PLAT-18 | Phase 10 | Complete — verificado em 10-08 |
| PLAT-19 | Phase 10 | Partial — verificado em 10-08, tiles raster pendente (`mapa/tiles/GERAR-TILES.md`) |
| PLAT-20 | Phase 10 | Complete — verificado em 10-08 |
| PLAT-21 | Phase 11 | Pending — travado por decisão de segurança |
| PLAT-22 | Phase 12 | Pending |
| PLAT-15 | Phases 5-10 | Complete para a Fase 5 (05-07), Fase 6 (06-04) e Fase 10 (10-08); reverifica em cada fase seguinte |
| PLAT-16 | Phases 5-10 | Complete para a Fase 5 (05-07), Fase 6 (06-04) e Fase 10 (10-08); reverifica em cada fase seguinte |

### Rastreabilidade v1.0

| Requisito | Fase | Status |
|-----------|------|--------|
| TRANSP-01 | Phase 1 | Complete |
| TRANSP-02 | Phase 1 | Complete |
| TRANSP-03 | Phase 1 | Complete |
| TRANSP-04 | Phase 1 | Complete |
| TRANSP-05 | Phase 2 | Pending |
| TRANSP-06 | Phase 2 | Pending |
| TRANSP-07 | Phase 1 | Complete |
| TRANSP-08 | Phase 2 | Pending |
| TRANSP-09 | Phase 1 | Complete |
| ELET-01 | Phase 3 | Pending |
| ELET-02 | Phase 3 | Pending |
| ELET-03 | Phase 3 | Pending |
| ELET-04 | Phase 3 | Pending |
| ELET-05 | Phase 3 | Pending |
| ELET-06 | Phase 3 | Pending |
| FONO-01 | Phase 4 | Pending |
| FONO-02 | Phase 4 | Pending |
| FONO-03 | Phase 4 | Pending |
| FONO-04 | Phase 4 | Pending |
| FONO-05 | Phase 4 | Pending |
| INTEG-01 | Phase 4 | Pending |
| INTEG-02 | Phase 1 | Complete |
| INTEG-03 | Phase 1 | Partial — falta UAT da Parte B (login por cargo e bloqueio de escrita do observador) |
| INTEG-04 | Phase 1 | Complete |
