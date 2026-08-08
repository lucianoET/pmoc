# Requisitos — PMOC · CMASM (Milestone: Transportes, Elétrica, Fonoclama)

## v1 Requirements

### Transportes (TRANSP)

- [ ] **TRANSP-01**: Gestor pode cadastrar viaturas e embarcações num inventário único, com categoria (viatura/embarcação) e unidade de medida de uso (km ou horas de motor)
- [ ] **TRANSP-02**: Gestor pode definir planos de manutenção por `tipo_modelo` com intervalos em km ou horas
- [ ] **TRANSP-03**: Técnico pode abrir e concluir OS vinculada a ativo + plano + peças, com baixa automática de estoque e atualização do uso do ativo
- [ ] **TRANSP-04**: Usuário pode registrar uso (km rodado / horas de motor) e o sistema detecta manutenção vencida/próxima
- [ ] **TRANSP-05**: Usuário pode registrar abastecimento por veículo/condutor e ver consumo médio (km/l ou l/h)
- [ ] **TRANSP-06**: Gestor pode cadastrar documentos por ativo (licenciamento, seguro, vistoria) com data de vencimento e receber alertas com antecedência
- [ ] **TRANSP-07**: Gestor pode controlar estoque de peças com alerta de mínimo e lista de compras CSV
- [ ] **TRANSP-08**: Gestor vê dashboard de frota (KPIs, disponibilidade operacional, alertas)
- [ ] **TRANSP-09**: Dados legados de transportes são analisados, consolidados e importados via SQL seed

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
- [ ] **INTEG-02**: Rotas `/transportes`, `/eletrica`, `/fonoclama` configuradas em `vercel.json`
- [ ] **INTEG-03**: Login por cargo (admin/gestor/tecnico/observador) funciona nos três módulos novos via tabela `usuarios` compartilhada, com RLS
- [ ] **INTEG-04**: Módulos em produção (refrigeração, máquinas) continuam funcionando sem alteração — migrações apenas aditivas

## v2 Requirements (deferred)

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

(Preenchido pelo roadmap)
