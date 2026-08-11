# Roadmap: PMOC · CMASM

## Milestone corrente: v2.0 — Consolidação da plataforma

Unificar a base visual e de código dos módulos e entregar as capacidades transversais sobre essa base, em vez de implementá-las seis vezes. Escopo: `maquinas`, `transportes`, `eletrica`, `fonoclama`, `predial` e `mapa`. O `refrigeracao` fica **congelado** por decisão do usuário — é o app mais valioso em produção e migrá-lo seria metade do esforço com o maior risco; vira milestone próprio depois, com o padrão já provado.

A ordem das três primeiras fases não é negociável: a base unificada (Fase 5) é pré-requisito de tema (6) e mobile (7). Feitas antes, seriam refeitas depois. Da Fase 8 em diante a ordem é flexível.

As fases 2 a 4 do v1.0 (domínio: abastecimento de transportes, inspeções de elétrica, testes de fonoclama) ficam **para depois do v2.0**, para serem construídas uma vez só, já sobre a base unificada.

- [ ] **Phase 5: Base unificada** - Os 6 módulos passam a carregar `shared/pmoc.css` como fonte única de tokens e `shared/auth.js` para login, com shell de layout comum
- [ ] **Phase 6: Tema claro/escuro** - Alternância de tema em qualquer módulo, numa implementação só, com preferência persistida entre módulos
- [ ] **Phase 7: UI/UX mobile** - `eletrica`, `fonoclama`, `predial` e `mapa` utilizáveis em celular, sem rolagem horizontal da página
- [ ] **Phase 8: Kanban e calendário compartilhados** - Componentes extraídos de `maquinas/` para `shared/`, com os testes preservados, e adotados por outros módulos
- [ ] **Phase 9: Documentos** - Exportação CSV unificada, importação de arquivo com conferência e geração de PDF
- [ ] **Phase 10: Mapa integrado** - Ativos dos módulos plotados sobre a planta do CMASM via `cmasm_locais.local_id`, com navegação para o módulo de origem

### Detalhamento das fases do v2.0

### Phase 5: Base unificada

**Goal**: Os 6 módulos no escopo compartilham tokens visuais, login e shell de layout — nenhum define paleta própria nem duplica o fluxo de autenticação
**Depends on**: Nothing (primeira fase do v2.0)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-15, PLAT-16
**Success Criteria** (what must be TRUE):

  1. Os 6 módulos (`maquinas`, `transportes`, `eletrica`, `fonoclama`, `predial`, `mapa`) carregam `shared/pmoc.css` e nenhum deles define cor, fonte ou espaçamento fora das variáveis dele
  2. Os 6 módulos autenticam por `shared/auth.js`; `maquinas/app.js` não tem mais fluxo de login inline
  3. Cabeçalho, navegação por abas e rodapé vêm de um shell comum — mudar o shell muda os 6 módulos de uma vez
  4. `refrigeracao` continua idêntico: não carrega `pmoc.css`, não carrega o shell, e abre normalmente em produção
  5. Nenhuma funcionalidade existente foi perdida — cada módulo faz depois tudo o que fazia antes, e os testes em `tests/` continuam passando

**Plans**: 5/7 plans executed

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Base compartilhada: `shared/shell.js` extraído com teste, folha comum estendida e rótulo do observador (PLAT-01, PLAT-02, PLAT-03)

**Wave 2** *(blocked on Wave 1 completion — quatro planos em paralelo, sem sobreposição de arquivos)*

- [x] 05-02-PLAN.md — Motor de manutenção consome o shell; elétrica e fonoclama saem junto (PLAT-03, PLAT-16)
- [x] 05-03-PLAN.md — Predial monta cabeçalho, abas e rodapé pelo shell comum (PLAT-03, PLAT-16)
- [x] 05-04-PLAN.md — Mapa adota a folha comum e o shell sem abas (PLAT-01, PLAT-03, PLAT-16)
- [x] 05-05-PLAN.md — Transportes adota a folha comum, aposenta a classe de marca própria e monta o shell (PLAT-01, PLAT-03, PLAT-16)

**Wave 3** *(blocked on Wave 2 completion — módulo de maior risco, por último)*

- [ ] 05-06-PLAN.md — Máquinas: folha comum, login compartilhado, shell e migração para módulo ES com handlers publicados (PLAT-01, PLAT-02, PLAT-03, PLAT-16)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 05-07-PLAN.md — Auditoria da fase, roteiro em `TESTES.md` e conferência isolada de não regressão da refrigeração (PLAT-15, PLAT-16)

**Baseline da fase**: commit `b53505c` (19 testes passando em `node --test`); os gates de não regressão comparam contra ele
**Decisões travadas**: D-01 rótulo do observador preservado · D-02 cor de destaque do Máquinas `#c9a84c` (a que o módulo já usa hoje na aba ativa, botão primário, foco e nome no logo — corrigida após conferência no código; o verde `#5a9e6f` é token semântico, não de marca) · D-03 rodapé com nome, versão e link do portal
**UI hint**: yes

### Phase 6: Tema claro/escuro

**Goal**: Usuário alterna claro/escuro em qualquer módulo e a escolha o acompanha entre módulos e sessões
**Depends on**: Phase 5 (sem tokens únicos, seriam 6 implementações divergentes)
**Requirements**: PLAT-04, PLAT-05, PLAT-15, PLAT-16
**Success Criteria** (what must be TRUE):

  1. Existe um controle de tema visível nos 6 módulos e ele alterna claro/escuro sem recarregar a página
  2. A alternância é uma implementação só, apoiada nas variáveis de `shared/pmoc.css` — não há CSS de tema por módulo
  3. A preferência persiste ao fechar e reabrir o navegador, e vale ao navegar de um módulo para outro
  4. Na primeira visita, sem preferência salva, o tema segue `prefers-color-scheme` do sistema
  5. Todo texto permanece legível nos dois temas, inclusive os estados de alerta (vencido, estoque baixo, INOP)

### Phase 7: UI/UX mobile

**Goal**: Os 4 módulos sem tratamento responsivo ficam utilizáveis em tela de celular
**Depends on**: Phase 5
**Requirements**: PLAT-06, PLAT-07, PLAT-15, PLAT-16
**Success Criteria** (what must be TRUE):

  1. `eletrica`, `fonoclama`, `predial` e `mapa` abrem em tela de 375 px sem rolagem horizontal da página
  2. Tabelas largas rolam dentro do próprio contêiner, não empurrando a página
  3. Modais e formulários cabem na tela e permitem preencher e salvar sem zoom
  4. A navegação principal é alcançável com o polegar, sem depender de precisão de mouse
  5. `maquinas` e `transportes`, que já tinham `@media`, não regridem

### Phase 8: Kanban e calendário compartilhados

**Goal**: Kanban e calendário deixam de ser exclusivos do módulo de máquinas e passam a ser componentes reutilizáveis
**Depends on**: Phase 5
**Requirements**: PLAT-08, PLAT-09, PLAT-16
**Success Criteria** (what must be TRUE):

  1. O kanban vive em `shared/` e o módulo de máquinas o consome de lá, sem cópia local
  2. `tests/operacoes-maquinas.test.js` e `tests/integracao-operacoes-maquinas.test.js` continuam passando após a extração
  3. O calendário vive em `shared/` e o módulo de máquinas o consome de lá
  4. Ao menos um módulo além de máquinas usa o kanban, e ao menos um usa o calendário, com dados próprios
  5. O comportamento no módulo de máquinas é o mesmo de antes — arrastar, mudar de coluna e agendar seguem funcionando

### Phase 9: Documentos

**Goal**: Exportar, importar e imprimir deixa de ser reimplementado por módulo
**Depends on**: Phase 5
**Requirements**: PLAT-10, PLAT-11, PLAT-12, PLAT-16
**Success Criteria** (what must be TRUE):

  1. Existe um utilitário de CSV em `shared/` e os módulos exportam por ele — as 5 implementações independentes deixam de existir
  2. O CSV exportado protege contra injeção de fórmula em planilha, como já fazia `transportes/app.js` com `csvSeguro()`
  3. Usuário importa um CSV, vê a pré-visualização do que será gravado e confirma antes de qualquer escrita no banco
  4. Importar o mesmo arquivo duas vezes não duplica registros
  5. Usuário gera PDF do que está vendo, a partir de uma implementação compartilhada

### Phase 10: Mapa integrado

**Goal**: O mapa deixa de ser uma planta isolada e passa a mostrar onde estão os ativos de cada módulo
**Depends on**: Phase 5
**Requirements**: PLAT-13, PLAT-14, PLAT-16
**Success Criteria** (what must be TRUE):

  1. O `/mapa` mostra ativos dos módulos sobre a planta do CMASM, posicionados pelo vínculo `cmasm_locais.local_id` já existente
  2. Usuário filtra o que aparece no mapa por módulo de origem
  3. Clicar num ativo leva ao registro dele no módulo de origem
  4. Ativo sem `local_id` preenchido não quebra o mapa — some ou aparece numa lista de não localizados, de forma explícita
  5. O mapa continua funcionando para quem só tem acesso de observador

---

## Milestone v1.0 (fases 1 a 4) — Visão Geral

Este ciclo adiciona três módulos novos à plataforma PMOC, um de cada vez, na ordem de prioridade definida (Transportes → Elétrica → Fonoclama). Cada fase entrega uma fatia vertical completa: dados legados analisados e importados, schema Postgres com RLS, frontend zero-build e rota publicada no Vercel — ou seja, ao fim de cada fase existe um módulo que o usuário consegue abrir, autenticar e usar de verdade. Transportes é dividido em duas fases (manutenção por uso primeiro; abastecimento, documentação e painel depois) porque é o módulo mais denso e o primeiro a estabelecer o padrão de integração (rota, login por cargo, migração aditiva) que os demais reaproveitam. Elétrica e Fonoclama seguem o estilo refrigeração (inspeções/testes periódicos com checklist) e cada um entrega seu módulo completo numa fase. A última fase fecha o ciclo publicando o portal com os cinco módulos e seus status.

**Modo do projeto:** mvp — cada fase é uma fatia vertical (capacidade de ponta a ponta), nunca uma camada técnica.

**Dependência externa recorrente:** os apps legados (várias versões, provavelmente localStorage) são fornecidos pelo usuário por módulo. A análise/consolidação desses dados é o primeiro trabalho — e bloqueante — das Fases 1, 3 e 4, antes de qualquer schema.

## Phases

**Numeração de fases:**

- Fases inteiras (1, 2, 3): trabalho planejado do milestone
- Fases decimais (2.1, 2.2): inserções urgentes (marcadas com INSERTED)

Fases decimais aparecem entre suas inteiras vizinhas, em ordem numérica.

- [x] **Phase 1: Transportes — Frota sob manutenção** ✅ concluída em 10/08/2026 — Módulo `/transportes` no ar com inventário legado importado, planos por modelo, OS com baixa de estoque e alerta de manutenção por km/horas
- [ ] **Phase 2: Transportes — Abastecimento, documentação e painel da frota** ⏸️ adiada para depois do v2.0 — Consumo médio por veículo/condutor, alertas de vencimento documental e dashboard de disponibilidade
- [ ] **Phase 3: Elétrica — Inspeções da infraestrutura elétrica** ⏸️ adiada para depois do v2.0 — Módulo `/eletrica` no ar com ativos por local, planos de inspeção periódica, checklist com não conformidade e QR em campo
- [ ] **Phase 4: Fonoclama — Testes das zonas de áudio e portal integrado** ⏸️ adiada para depois do v2.0 — Módulo `/fonoclama` no ar com zonas e testes periódicos do PA 70V, e portal listando os cinco módulos com status

## Phase Details

### Phase 1: Transportes — Frota sob manutenção

**Goal**: Gestor e técnico passam a controlar a manutenção por uso (km/horas de motor) de viaturas e embarcações num módulo publicado em `/transportes`, com os dados legados já consolidados e importados
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: TRANSP-01, TRANSP-02, TRANSP-03, TRANSP-04, TRANSP-07, TRANSP-09, INTEG-02, INTEG-03, INTEG-04
**Success Criteria** (what must be TRUE):

  1. Usuário abre `/transportes`, faz login por cargo (admin/gestor/tecnico/observador) e vê o inventário real de viaturas e embarcações importado dos apps legados, cada ativo com categoria e unidade de uso explícita (km ou horas de motor)
  2. Gestor cadastra e edita ativos e planos de manutenção por `tipo_modelo`, com intervalo em km ou em horas conforme a unidade de uso do ativo
  3. Usuário registra uso (km rodado / horas de motor) e o sistema passa a mostrar quais manutenções estão vencidas e quais estão próximas do vencimento
  4. Técnico abre e conclui OS vinculada a ativo + plano + peças, com baixa automática de estoque e atualização do uso do ativo; gestor vê alerta de estoque mínimo e exporta a lista de compras em CSV
  5. Refrigeração e Máquinas continuam funcionando normalmente após as migrações do módulo novo (aditivas, sem DROP e sem alterar tabelas existentes)

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Planos de manutenção por `tipo_modelo` (km/h) e detecção de vencimento por uso (TRANSP-02, TRANSP-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Estoque de peças do módulo com alerta de mínimo e colunas de OS (TRANSP-07)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Peças do plano, lista de compras CSV e OS com baixa automática de estoque (TRANSP-07, TRANSP-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Conferência do import, RLS por cargo e não regressão da produção (TRANSP-01, TRANSP-09, INTEG-02, INTEG-03, INTEG-04)

**Bloqueio inicial**: apps legados de transportes fornecidos pelo usuário; primeiro trabalho da fase é mapa de campos, reconciliação entre versões e conferência pós-import (seed idempotente com ON CONFLICT)
**Nota de estado real**: o módulo `/transportes` já está em produção (walking skeleton comprovado — ver `phases/01-transportes-frota-sob-manuten-o/SKELETON.md`). TRANSP-01, INTEG-02 e o import de TRANSP-09 já foram entregues fora do fluxo GSD; os planos acima cobrem os gaps e a conferência formal pendente.
**UI hint**: yes

### Phase 2: Transportes — Abastecimento, documentação e painel da frota

**Goal**: Gestor enxerga custo e consumo de combustível, vencimentos documentais e disponibilidade da frota sem sair do módulo
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TRANSP-05, TRANSP-06, TRANSP-08
**Success Criteria** (what must be TRUE):

  1. Usuário registra abastecimento informando veículo, condutor, litros e uso no momento, e vê o consumo médio do ativo (km/l para viaturas, l/h para embarcações)
  2. Gestor cadastra documentos por ativo (licenciamento, seguro, vistoria) com data de vencimento e responsável
  3. Sistema destaca documentos a vencer com antecedência escalonada (60/15/7/0 dias) e documentos já vencidos, sem depender de o usuário procurar
  4. Gestor abre o dashboard da frota e vê KPIs de disponibilidade operacional, manutenções vencidas, documentos a vencer e consumo

**Plans**: TBD
**UI hint**: yes

### Phase 3: Elétrica — Inspeções da infraestrutura elétrica

**Goal**: Gestor e técnico executam o ciclo completo de inspeção periódica dos ativos elétricos num módulo publicado em `/eletrica`, com o inventário legado consolidado
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ELET-01, ELET-02, ELET-03, ELET-04, ELET-05, ELET-06
**Success Criteria** (what must be TRUE):

  1. Usuário abre `/eletrica`, autentica por cargo e vê os ativos elétricos organizados por local (subestações, quadros, geradores, transformadores) importados dos apps legados
  2. Gestor define planos de inspeção por tipo de ativo com periodicidade mensal, trimestral, semestral ou anual
  3. Técnico executa o checklist de inspeção de um ativo registrando não conformidade e ação corretiva, e o histórico fica visível na ficha do ativo
  4. Dashboard mostra inspeções vencidas e próximas do vencimento, com KPIs de conformidade por local
  5. Técnico lê o QR code afixado no ativo e cai direto na ficha/checklist daquele ativo no celular

**Plans**: TBD
**Bloqueio inicial**: apps legados de elétrica fornecidos pelo usuário; consolidar versões e validar a periodicidade real de inspeção antes do schema
**UI hint**: yes
**Nota de estado real (09/08/2026)**: módulo `/eletrica` portado do app legado
`ref/eletrica.html` fora do fluxo GSD — frontend, rota, migração `14` e seed `15`
prontos no repositório. Falta o usuário rodar as migrações no Supabase e a
conferência formal (ELET-05 QR em campo ainda não implementado; a inspeção usa
periodicidade por horas de operação, não por calendário — validar com o usuário).

### Phase 4: Fonoclama — Testes das zonas de áudio e portal integrado

**Goal**: Gestor e técnico mantêm o sistema PA 70V por testes periódicos por zona em `/fonoclama`, e o portal passa a apresentar os cinco módulos da plataforma com seus status
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: FONO-01, FONO-02, FONO-03, FONO-04, FONO-05, INTEG-01
**Success Criteria** (what must be TRUE):

  1. Usuário abre `/fonoclama`, autentica por cargo e vê amplificadores, central e zonas de alto-falantes importados dos dados legados
  2. Gestor define planos de teste periódico por zona/ativo (teste de zona, carga do amplificador, continuidade da linha 70V)
  3. Técnico executa o checklist de teste registrando não conformidade e ação corretiva, com histórico por zona
  4. Dashboard mostra testes vencidos e o estado atual de cada zona (operacional / com pendência / sem teste)
  5. Portal em `/` lista Refrigeração, Máquinas, Transportes, Elétrica e Fonoclama com o status de cada módulo, e cada card abre o módulo pela sua rota própria

**Plans**: TBD
**Bloqueio inicial**: app legado do fonoclama fornecido pelo usuário; consolidar zonas/linhas e regime de teste antes do schema
**UI hint**: yes
**Nota de estado real (09/08/2026)**: módulo `/fonoclama` portado do app legado
`DEV_ERP/cmms-fonoclama/fonoclama.html` fora do fluxo GSD — frontend, rota,
migração `14` e seed `16` prontos no repositório. O portal (INTEG-01) já lista os
cinco módulos. Falta rodar as migrações no Supabase e a conferência formal.

## Progress

**Ordem de execução:**
Fases executam em ordem numérica: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Transportes — Frota sob manutenção | 4/4 | In Progress|  |
| 2. Transportes — Abastecimento, documentação e painel | 0/TBD | Not started | - |
| 3. Elétrica — Inspeções da infraestrutura elétrica | 0/TBD | Not started | - |
| 4. Fonoclama — Testes das zonas e portal integrado | 0/TBD | Not started | - |

## Cobertura de Requisitos

24 de 24 requisitos v1 mapeados, cada um em exatamente uma fase.

| Fase | Requisitos | Qtd |
|------|------------|-----|
| 1 | TRANSP-01, TRANSP-02, TRANSP-03, TRANSP-04, TRANSP-07, TRANSP-09, INTEG-02, INTEG-03, INTEG-04 | 9 |
| 2 | TRANSP-05, TRANSP-06, TRANSP-08 | 3 |
| 3 | ELET-01, ELET-02, ELET-03, ELET-04, ELET-05, ELET-06 | 6 |
| 4 | FONO-01, FONO-02, FONO-03, FONO-04, FONO-05, INTEG-01 | 6 |

**Notas de mapeamento:**

- INTEG-02 (rotas), INTEG-03 (login por cargo) e INTEG-04 (produção intacta / migrações aditivas) ficam na Fase 1 porque é onde o padrão de integração é estabelecido e verificado pela primeira vez. As Fases 3 e 4 reaplicam o mesmo padrão para `/eletrica` e `/fonoclama`, e a checagem de não regressão de Refrigeração/Máquinas se repete a cada migração.
- INTEG-01 (portal com links e status) fica na Fase 4 porque só faz sentido conferir a lista completa quando os três módulos novos existem.
- TRANSP-07 (estoque) fica na Fase 1 porque TRANSP-03 depende de estoque existir para dar baixa automática.

## Restrições Herdadas (valem para todas as fases)

- Zero-build: HTML + vanilla JS + Supabase JS via CDN. Sem npm, bundler ou framework.
- Migrações SQL numeradas e **aditivas** em `supabase/` — nunca DROP; arquivar com `ativo = false`.
- Prefixo de tabela por módulo: `transp_`, `elet_`, `fono_`.
- RLS habilitada em toda tabela nova, com política revisada explicitamente (mínimo: `observador` somente leitura) — não copiar RLS permissiva.
- Auth por cargo reutilizando `shared/auth.js` por caminho absoluto, em vez de duplicar o fluxo inline.
- CHECKs no banco para validação numérica (litros > 0, uso não regressivo, `unidade_uso` restrita).
- Seeds idempotentes (`ON CONFLICT` por chave natural, em transação).
- Português em código, commits, UI e docs.
