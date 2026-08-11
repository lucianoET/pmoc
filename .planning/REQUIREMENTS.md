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

- [ ] **PLAT-04**: Usuário alterna entre tema claro e escuro em qualquer módulo, com uma única implementação apoiada nas variáveis de `pmoc.css`
- [ ] **PLAT-05**: A preferência de tema persiste entre sessões e entre módulos, e respeita `prefers-color-scheme` na primeira visita

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

- [ ] **PLAT-13**: O `/mapa` plota ativos dos módulos sobre a planta do CMASM, usando o vínculo `cmasm_locais.local_id` já existente
- [ ] **PLAT-14**: Usuário navega do ativo no mapa para o registro dele no módulo de origem

### Não regressão

- [x] **PLAT-15**: `refrigeracao` continua funcionando sem nenhuma alteração — não carrega `pmoc.css` nem o shell comum — **verificado em 05-07**: `git diff --name-only b53505c..HEAD -- refrigeracao/` retorna lista vazia (nenhum commit da fase tocou o diretório); `grep -c 'shared/\|pmoc.css' refrigeracao/index.html` = 0 — **pendência herdada**: a conferência humana com o inspetor de rede aberto e a checagem visual do fluxo principal não puderam ser feitas neste plano nem em nenhum dos planos 05-02 a 05-06 (ambiente autônomo, sem credenciais Supabase nem Playwright) — fica registrada em `TESTES.md` § "Fase 5" como item isolado para o UAT
- [x] **PLAT-16**: Nenhum módulo perde funcionalidade na unificação; o que existia antes continua existindo depois — **verificado em 05-07**: cada plano (05-01 a 05-06) documentou por gate estrutural que views/ids/modais/permissões de domínio permaneceram intactos; `node --test` subiu de 19 para 25 testes, todos verdes, sem nenhum teste removido ou enfraquecido; as 7 rotas do `vercel.json` resolvem para arquivos existentes — **pendência herdada**: a conferência visual humana pós-login (clicar em todas as abas/modais dos 6 módulos com sessão Supabase real) não pôde ser feita em nenhum plano da fase por falta de credenciais e de Playwright no ambiente autônomo; registrada como roteiro manual pendente em `TESTES.md` § "Fase 5", item para o UAT

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

Cobertura v2.0: 16/16 requisitos `PLAT-*` mapeados. Cobertura v1.0: 24/24 requisitos mapeados.

| Requisito | Fase | Status |
|-----------|------|--------|
| PLAT-01 | Phase 5 | Complete — verificado em 05-07 |
| PLAT-02 | Phase 5 | Complete — verificado em 05-07 |
| PLAT-03 | Phase 5 | Complete — verificado em 05-07 |
| PLAT-04 | Phase 6 | Pending |
| PLAT-05 | Phase 6 | Pending |
| PLAT-06 | Phase 7 | Pending |
| PLAT-07 | Phase 7 | Pending |
| PLAT-08 | Phase 8 | Pending |
| PLAT-09 | Phase 8 | Pending |
| PLAT-10 | Phase 9 | Pending |
| PLAT-11 | Phase 9 | Pending |
| PLAT-12 | Phase 9 | Pending |
| PLAT-13 | Phase 10 | Pending |
| PLAT-14 | Phase 10 | Pending |
| PLAT-15 | Phases 5-10 | Complete para a Fase 5 — verificado em 05-07; reverifica em cada fase seguinte |
| PLAT-16 | Phases 5-10 | Complete para a Fase 5 — verificado em 05-07; reverifica em cada fase seguinte |

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
