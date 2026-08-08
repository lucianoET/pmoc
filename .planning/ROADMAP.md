# Roadmap: PMOC · CMASM — Transportes, Elétrica e Fonoclama

## Visão Geral

Este ciclo adiciona três módulos novos à plataforma PMOC, um de cada vez, na ordem de prioridade definida (Transportes → Elétrica → Fonoclama). Cada fase entrega uma fatia vertical completa: dados legados analisados e importados, schema Postgres com RLS, frontend zero-build e rota publicada no Vercel — ou seja, ao fim de cada fase existe um módulo que o usuário consegue abrir, autenticar e usar de verdade. Transportes é dividido em duas fases (manutenção por uso primeiro; abastecimento, documentação e painel depois) porque é o módulo mais denso e o primeiro a estabelecer o padrão de integração (rota, login por cargo, migração aditiva) que os demais reaproveitam. Elétrica e Fonoclama seguem o estilo refrigeração (inspeções/testes periódicos com checklist) e cada um entrega seu módulo completo numa fase. A última fase fecha o ciclo publicando o portal com os cinco módulos e seus status.

**Modo do projeto:** mvp — cada fase é uma fatia vertical (capacidade de ponta a ponta), nunca uma camada técnica.

**Dependência externa recorrente:** os apps legados (várias versões, provavelmente localStorage) são fornecidos pelo usuário por módulo. A análise/consolidação desses dados é o primeiro trabalho — e bloqueante — das Fases 1, 3 e 4, antes de qualquer schema.

## Phases

**Numeração de fases:**
- Fases inteiras (1, 2, 3): trabalho planejado do milestone
- Fases decimais (2.1, 2.2): inserções urgentes (marcadas com INSERTED)

Fases decimais aparecem entre suas inteiras vizinhas, em ordem numérica.

- [ ] **Phase 1: Transportes — Frota sob manutenção** - Módulo `/transportes` no ar com inventário legado importado, planos por modelo, OS com baixa de estoque e alerta de manutenção por km/horas
- [ ] **Phase 2: Transportes — Abastecimento, documentação e painel da frota** - Consumo médio por veículo/condutor, alertas de vencimento documental e dashboard de disponibilidade
- [ ] **Phase 3: Elétrica — Inspeções da infraestrutura elétrica** - Módulo `/eletrica` no ar com ativos por local, planos de inspeção periódica, checklist com não conformidade e QR em campo
- [ ] **Phase 4: Fonoclama — Testes das zonas de áudio e portal integrado** - Módulo `/fonoclama` no ar com zonas e testes periódicos do PA 70V, e portal listando os cinco módulos com status

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
**Plans**: TBD
**Bloqueio inicial**: apps legados de transportes fornecidos pelo usuário; primeiro trabalho da fase é mapa de campos, reconciliação entre versões e conferência pós-import (seed idempotente com ON CONFLICT)
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

## Progress

**Ordem de execução:**
Fases executam em ordem numérica: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Transportes — Frota sob manutenção | 0/TBD | Not started | - |
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
