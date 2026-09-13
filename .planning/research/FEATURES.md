# Feature Research

**Domínio:** Gestão de manutenção de ativos — Transportes (viaturas + embarcações), Elétrica (infraestrutura elétrica), Fonoclama (sistema de som PA 70V)
**Pesquisado em:** 2026-08-08
**Confiança:** MÉDIA — normas brasileiras (NR-10, NBR 5410, CONTRAN/DETRAN, NORMAM) confirmadas em nível de princípio via fontes secundárias/blogs técnicos; padrões de CMMS/fleet software confirmados via múltiplos fornecedores de mercado; NFPA 72 confirmado como referência internacional de boas práticas (não é norma brasileira vinculante para PA de sonorização, usada aqui apenas como benchmark de ITM — Inspeção/Teste/Manutenção). Sem acesso aos apps legados do usuário (ainda não fornecidos) — este documento cobre o comportamento esperado do *domínio*, não os requisitos exatos que serão extraídos na fase de análise/consolidação de cada módulo.

## Abordagem

O ciclo adiciona três módulos com naturezas distintas, mas o CMASM já validou dois padrões em produção que devem ser reaproveitados:

- **Transportes** segue o **estilo máquinas**: ativo com ciclo de vida por uso (km/horímetro/horas de motor), plano de manutenção por `tipo_modelo`, OS vinculada a ativo+plano, estoque de peças com baixa automática, abastecimento com cálculo de consumo.
- **Elétrica** e **Fonoclama** seguem o **estilo refrigeração**: ativo com plano de inspeção periódica (não por uso, por tempo), checklist de tarefas, detecção de vencimento, QR code de campo.

Por isso, "table stakes" nestes dois grupos não são genéricos de mercado — são principalmente **a réplica fiel do padrão já validado internamente**, adaptada ao domínio de cada ativo. Diferenciais são as adaptações específicas que cada tipo de ativo exige e que o padrão genérico não cobre.

---

## Módulo 1 — Transportes (Viaturas + Embarcações)

### Table Stakes

Funcionalidades que replicam o padrão máquinas e que os usuários (gestores de frota, condutores, técnicos) vão considerar padrão mínimo.

| Feature | Por que é esperado | Complexidade | Notas |
|---------|--------------------|---------------|-------|
| Cadastro de ativos (viaturas e embarcações) | Base de qualquer módulo de manutenção — sem isso nada mais funciona | BAIXA | Reusa padrão `maq_ativos`; precisa de campo `categoria` (viatura/embarcação) e `unidade_medida_uso` (km ou horas) |
| Planos de manutenção por `tipo_modelo` | Cada modelo de viatura/motor de popa tem intervalos distintos (troca de óleo a cada X km, revisão de motor a cada Y horas) — sem isso a manutenção vira reativa | MÉDIA | Reusa `maq_planos`; precisa suportar dois tipos de unidade de medida no mesmo plano (km OU horas) |
| Ordem de Serviço (OS) vinculada a ativo + plano + peças | Registro formal do que foi feito, quando, por quem, com que peça — auditoria e histórico | MÉDIA | Reusa `maq_os`; ao salvar, atualiza `uso_atual` do ativo e baixa estoque, igual ao padrão máquinas |
| Registro de uso (km rodado / horas de motor) | Sem atualização de uso, os alertas de manutenção por km/horímetro não disparam | BAIXA-MÉDIA | Reusa `maq_uso_registros`; para embarcações é "horas de motor" em vez de "km" |
| Estoque de peças com baixa automática | Peças de viatura (filtros, óleo, pneus) têm giro alto — sem controle, falta peça na hora da OS | MÉDIA | Reusa `maq_materiais` + `maq_estoque_movimentos`; alerta de estoque mínimo |
| Abastecimento por viatura/condutor com consumo médio | Requisito explícito do usuário; consumo é indicador de saúde do motor e de possível desvio/furto de combustível | MÉDIA | Novo cálculo: km rodado ÷ litros abastecidos (viatura) ou litros/hora (embarcação) |
| Alertas de vencimento de documentação (licenciamento/CRLV, seguro, vistoria) | Viatura com documento vencido não pode circular legalmente (autuação, apreensão, responsabilidade do gestor) — é a maior exposição de risco do módulo | MÉDIA-ALTA | Funcionalidade nova, não existe em nenhum módulo atual; precisa de tabela de documentos por ativo com data de vencimento e antecedência de alerta configurável |
| Detecção de manutenção vencida/próxima | Já é padrão em máquinas (comparação `uso_atual` vs `uso_alvo_plano`) | BAIXA | Reusa lógica existente |
| Dashboard/KPIs de frota (operacional, em manutenção, baixada, alertas) | Visão gerencial rápida — padrão em ambos módulos existentes | BAIXA | Reusa padrão de painel |
| Depreciação e custo por km/hora | Já existe em máquinas; útil para decisão de baixa de viatura antiga | BAIXA | Reusa fórmula existente |
| Lista de compras CSV (peças abaixo do mínimo) | Já existe em máquinas; usado para processo de aquisição | BAIXA | Reuso direto |
| Cadastro de condutor/motorista vinculado a abastecimento e OS | Abastecimento "por condutor" exige uma entidade condutor, não existe hoje | MÉDIA | Nova entidade; pode reusar `usuarios` ou tabela própria `transp_condutores` se condutor não for necessariamente usuário do sistema |

### Differentiators

| Feature | Valor agregado | Complexidade | Notas |
|---------|-----------------|---------------|-------|
| Modelo único para dois tipos de ativo (viatura por km × embarcação por horas de motor) no mesmo módulo | Evita duplicar módulo; um único painel de frota consolidada, mais simples de manter e de dar visibilidade gerencial | MÉDIA | Chave de design: `unidade_medida` no plano/ativo determina qual contador é usado |
| Alerta de anomalia de consumo (outlier de litros/km fora do padrão histórico do ativo) | Sinaliza vazamento, motor desregulado ou possível desvio de combustível — vai além do registro passivo | MÉDIA | Comparar abastecimento atual com média móvel do próprio ativo; não é IA, é regra simples de desvio-padrão |
| Alertas de documentação com antecedência escalonada (ex: aviso em 60 dias, urgente em 15 dias) | Reduz risco de viatura circular irregular — diferencial real de um órgão público que responde por isso | BAIXA-MÉDIA | Camada extra sobre a tabela de documentos: níveis de severidade do alerta |
| Painel de disponibilidade operacional (quantas viaturas/embarcações aptas vs indisponíveis agora) | Decisão operacional diária ("temos viatura disponível para a missão de amanhã?") — diferente do KPI histórico de máquinas | BAIXA | Cálculo simples sobre `status` do ativo, mas com foco de UX diferente (operação, não gestão de patrimônio) |
| Exportação de histórico de manutenção por ativo (auditoria/prestação de contas) | Órgão público precisa comprovar manutenção realizada — auditoria interna/externa (TCU, CGU) | BAIXA | CSV/impressão por ativo, já existe padrão de export em refrigeração |

### Anti-Features

| Feature | Por que parece atrativo | Por que é problemático aqui | Alternativa |
|---------|--------------------------|-------------------------------|-------------|
| Telemetria/GPS em tempo real (rastreador embarcado) | "Sabemos onde está cada viatura e km em tempo real" | Exige hardware de rastreamento + assinatura de operadora + integração de API — custo e escopo de projeto de telemetria, não de manutenção; fora do que foi pedido | Registro manual de km/horímetro por condutor/técnico na OS ou abastecimento, como já é feito em máquinas |
| Roteirização/otimização de rotas | Parece complementar "gestão de frota" | É problema de logística operacional, não de manutenção de ativos — módulo age como gestor de patrimônio e manutenção, não como despachante | Não construir; se necessário no futuro, é outro módulo |
| Integração automática com DETRAN/RENAVAM para puxar vencimento de licenciamento | Eliminaria digitação manual da data de vencimento | Não há API pública/gratuita de uso institucional simples para isso; integração exigiria convênio/certificado digital e manutenção de integração externa | Cadastro manual da data de vencimento (poucos ativos, baixo esforço) com alerta interno |
| Multi-frota / multi-organização | Parece "mais robusto" | CMASM tem uma única frota; não há necessidade de isolamento entre organizações — over-engineering | Um schema único, como os módulos existentes |
| Fluxo de contratação pública (ARP/empenho/fiscalização) dentro do módulo | Refrigeração já tem esse fluxo, pareceria "completo" copiar | Já definido como fora de escopo no PROJECT.md — apenas manutenção interna por ora | Se necessário depois, entra como fase separada, reaproveitando o padrão de refrigeração |

---

## Módulo 2 — Elétrica (Subestações, Painéis, Geradores)

### Table Stakes

Segue o padrão refrigeração (checklist de inspeção periódica), adaptado ao contexto de infraestrutura elétrica (NR-10/NBR 5410 como referência de boas práticas, não como certificação formal a ser emitida pelo sistema).

| Feature | Por que é esperado | Complexidade | Notas |
|---------|--------------------|---------------|-------|
| Cadastro de ativos elétricos por local/instalação (subestações, quadros/painéis, geradores, transformadores) | Base do módulo — sem isso não há o que inspecionar | BAIXA | Reusa padrão `equipamentos`, com campo de localização/setor mais relevante aqui do que em refrigeração |
| Planos de inspeção periódica por tipo de ativo (mensal/trimestral/semestral/anual) | Boas práticas de NR-10/NBR 5410 recomendam cronogramas de inspeção preventiva — sem plano, a inspeção não acontece de forma sistemática | MÉDIA | Reusa `plano_tarefas`; periodicidade por tipo de ativo, não por uso |
| Checklist de tarefas de inspeção (execução, técnico, data, conformidade sim/não, observações) | É o núcleo do padrão refrigeração — usuário já espera essa UX | MÉDIA | Reuso direto do padrão `logs_manutencao` |
| Detecção de tarefa vencida/próxima do vencimento | Padrão já validado em refrigeração | BAIXA | Reuso direto |
| Registro de não conformidade com ação corretiva | Inspeção sem achado registrado não gera valor — é o que justifica a manutenção corretiva | MÉDIA | Campo de "conformidade" além do checklist simples: descrição do achado + status de correção |
| Dashboard com KPIs (ativos em dia vs vencidos, não conformidades abertas) | Visão gerencial padrão dos módulos existentes | BAIXA | Reuso do padrão de painel |
| QR code para inspeção em campo | Já validado em refrigeração para acesso rápido ao ativo no local | BAIXA | Reuso direto do gerador de QR existente |

### Differentiators

| Feature | Valor agregado | Complexidade | Notas |
|---------|-----------------|---------------|-------|
| Registro de termografia (upload de imagem + temperatura medida) como parte da inspeção de painéis/geradores | Termografia é a técnica preditiva mais citada para detectar pontos quentes antes da falha — vai além do checklist visual simples e agrega valor real de manutenção preditiva | MÉDIA | Anexo de imagem à tarefa + campo numérico de temperatura; sem processamento de imagem automático (não é visão computacional) |
| Regime de teste de geradores (partida, teste de carga, autonomia) distinto de inspeção estática de painel | Gerador tem ciclo de teste operacional próprio (partida a frio, tempo de resposta, autonomia de combustível) que um quadro elétrico estático não tem — tratar os dois com o mesmo checklist genérico perde informação relevante | MÉDIA | Tipo de plano/checklist específico para "gerador" com campos próprios (tempo de partida, autonomia testada) |
| Registro de qualificação/matrícula do técnico responsável pela inspeção | NR-10 exige execução por profissional qualificado/autorizado — registrar quem assinou a inspeção é rastreabilidade de conformidade | BAIXA | Campo adicional na OS/tarefa referenciando o técnico (já existe conceito de técnico responsável no padrão) |
| Alerta de recorrência de não conformidade no mesmo ativo | Falha repetida no mesmo ponto indica problema estrutural (não é ruído aleatório) — diferencial de gestão de manutenção madura | MÉDIA | Consulta agregando não conformidades por ativo ao longo do tempo |

### Anti-Features

| Feature | Por que parece atrativo | Por que é problemático aqui | Alternativa |
|---------|--------------------------|-------------------------------|-------------|
| Monitoramento contínuo via IoT/sensores (corrente, tensão, temperatura em tempo real) | "Manutenção preditiva de verdade" | Exige hardware de instrumentação instalado nos painéis/geradores, que não existe hoje — é projeto de instrumentação, não de software de gestão de manutenção | Inspeção periódica manual registrada no sistema, com termografia pontual como proxy preditivo de baixo custo |
| Cálculo automático de dimensionamento elétrico (queda de tensão, curto-circuito, seletividade conforme NBR 5410) | Pareceria "completo" para um módulo elétrico | É engenharia de projeto elétrico, não manutenção — exige laudo de engenheiro responsável, fora do escopo de um sistema de gestão de tarefas | Campo de anexo para laudo técnico externo quando necessário, sem tentar recalcular internamente |
| Módulo de estoque de peças elétricas dedicado e paralelo ao de máquinas | Pareceria "módulo completo" | Duplica lógica já existente sem necessidade clara no MVP — antes de construir, validar se o volume de peças elétricas justifica um controle de estoque próprio ou se cabe reaproveitar o padrão existente depois de Transportes | Adiar para v1.x; no MVP, registrar peça usada como texto livre na OS, sem controle de estoque formal |

---

## Módulo 3 — Fonoclama (Sistema de Som PA 70V)

### Table Stakes

Também segue o padrão refrigeração, adaptado ao domínio de áudio distribuído em linha de 70V (alta impedância), típico de sistemas de sonorização/aviso em instalações grandes.

| Feature | Por que é esperado | Complexidade | Notas |
|---------|--------------------|---------------|-------|
| Cadastro de ativos de áudio (amplificadores, central, zonas/setores de alto-falantes) | Base do módulo | BAIXA | Reusa padrão `equipamentos`; unidade de inspeção mais natural aqui é a **zona/setor**, não o alto-falante individual (壊 muitos alto-falantes por zona) |
| Planos de inspeção/teste periódico (teste de zona, teste de carga do amplificador, continuidade da linha 70V) | Boas práticas de ITM (inspeção-teste-manutenção) de sistemas de sonorização — sem teste periódico, falha só é descoberta quando o sistema é realmente necessário | MÉDIA | Reusa `plano_tarefas`; periodicidade sugerida: teste de zona mensal, teste de carga do amplificador semestral/anual (referência de boas práticas ITM tipo NFPA 72, adaptada — não é sistema de alarme de incêndio certificado) |
| Checklist de tarefas (execução, técnico, data, resultado) | Padrão já validado em refrigeração | MÉDIA | Reuso direto |
| Detecção de tarefa vencida | Padrão já validado | BAIXA | Reuso direto |
| Registro de não conformidade (zona muda, alto-falante queimado, curto na linha) com ação corretiva | É o que justifica a manutenção corretiva e dá rastreabilidade | MÉDIA | Igual ao padrão de Elétrica |
| Dashboard com KPIs (zonas operacionais vs com falha) | Visão gerencial rápida do estado do sistema | BAIXA | Reuso do padrão de painel |

### Differentiators

| Feature | Valor agregado | Complexidade | Notas |
|---------|-----------------|---------------|-------|
| Teste por zona/setor com mapa de cobertura (qual área fica sem áudio em caso de falha) | Numa instalação militar, o PA pode ter função de aviso geral, não só sonorização ambiente — saber exatamente qual área está descoberta é informação operacional crítica, diferente de "equipamento X com defeito" | MÉDIA | Vínculo zona → área física/prédio; visão do dashboard por área, não só por ativo |
| Registro de teste de autonomia de energia de backup (bateria/nobreak da central, se existir) | Se o sistema tem função de aviso, precisa continuar funcionando em falta de energia — testar isso é diferencial real de confiabilidade, alinhado a boas práticas de ITM de sistemas de comunicação de emergência | MÉDIA | Campo de teste específico no plano da central, condicional à existência de backup |
| Histórico de falhas recorrentes por zona (identifica trecho de cabeamento problemático) | Sistemas de 70V costumam falhar por mau contato/emenda de cabo — recorrência no mesmo trecho aponta causa raiz, não sintoma isolado | MÉDIA | Mesma lógica de agregação usada em Elétrica |

### Anti-Features

| Feature | Por que parece atrativo | Por que é problemático aqui | Alternativa |
|---------|--------------------------|-------------------------------|-------------|
| Conformidade formal com NFPA 72 completo (supervisão de linha, SLA de resposta certificado) | Pareceria "nível internacional" de sistema de alarme de vida | O Fonoclama existente é PA de sonorização/aviso, não uma central de alarme de incêndio certificada com hardware supervisionado — simular conformidade regulatória que o hardware físico não sustenta cria falsa sensação de segurança | Usar NFPA 72 apenas como *benchmark de boas práticas de ITM* (frequência de teste, checklist), sem alegar certificação formal |
| Transmissão de áudio ao vivo pelo sistema (função "rádio"/central de anúncios) via módulo | Parece natural para um "módulo de som" | O módulo é de **manutenção** do sistema físico, não de operação/broadcast de conteúdo — escopo diferente, provavelmente já resolvido por hardware de central de som existente | Não construir; módulo só registra ativos, planos, testes e falhas |
| Monitoramento contínuo de linha (supervisão elétrica em tempo real de curto/aberto) | "Saberíamos na hora se uma linha caiu" | Exige hardware de supervisão de linha instalado na central, que provavelmente não existe no sistema legado 70V atual | Teste periódico manual (continuidade de linha) registrado como tarefa do plano |

---

## Dependências entre Features (todos os módulos)

```
[Cadastro de Ativo]
    └──requires──> [Plano de Manutenção/Inspeção]
                       └──requires──> [OS / Checklist de Tarefa]
                                          └──requires──> [Registro de Uso ou Resultado]

[Transportes] Registro de Uso (km/horas) ──enhances──> [Detecção de manutenção vencida]
[Transportes] Cadastro de Condutor ──requires──> [Abastecimento por condutor]
[Transportes] Abastecimento (histórico) ──enhances──> [Alerta de anomalia de consumo]
[Transportes] Alerta de vencimento de documentação ──independente de──> [Plano de manutenção]
   (documentação vence por calendário, não por uso — fluxo paralelo, não sequencial)

[Elétrica/Fonoclama] Checklist de Tarefa ──enhances──> [Registro de Não Conformidade]
[Elétrica/Fonoclama] Não Conformidade (histórico) ──enhances──> [Alerta de recorrência]
[Elétrica] Termografia ──enhances (opcional)──> [Checklist de Tarefa de painel/gerador]
[Fonoclama] Teste de zona ──enhances──> [Mapa de cobertura no dashboard]

[Estoque de Peças] (Transportes) ──reusa padrão de──> [maq_materiais / maq_estoque_movimentos]
[Checklist de Tarefas] (Elétrica, Fonoclama) ──reusa padrão de──> [equipamentos / plano_tarefas / logs_manutencao (refrigeração)]
```

### Notas de dependência

- **Cadastro de Ativo é pré-requisito universal** dos três módulos — deve ser a primeira entrega de cada módulo, mesmo antes de planos/checklists.
- **Alerta de vencimento de documentação (Transportes) é independente do ciclo de manutenção por uso** — pode e deve ser implementado em paralelo, já que é orientado a calendário (data), não a contador (km/horas). Isso significa que pode entrar em fase própria sem esperar o motor de planos por `tipo_modelo` estar pronto.
- **Estoque de peças em Elétrica é opcional no MVP** — se reaproveitar o padrão de máquinas, depende de Transportes ter sido consolidado primeiro (mesmo schema, prefixo de tabela `ele_`); se ficar como texto livre por ora, não há dependência.
- **Termografia e teste de autonomia de backup são anexos opcionais** à tarefa — não bloqueiam o fluxo básico de checklist, podem ser adicionados depois sem redesenhar o plano.

---

## Definição de MVP por Módulo

### Transportes (fase 1 — prioridade)

**Lançar com (v1):**
- [ ] Cadastro de viaturas e embarcações (ativo único, campo de tipo/unidade de medida)
- [ ] Planos de manutenção por `tipo_modelo` (km ou horas de motor)
- [ ] OS vinculada a ativo + plano + peças, com baixa de estoque
- [ ] Registro de uso (km/horas) e detecção de manutenção vencida
- [ ] Abastecimento por veículo/condutor com consumo médio
- [ ] Alertas de vencimento de documentação (licenciamento, seguro, vistoria)
- [ ] Dashboard de frota (KPIs + disponibilidade operacional)

**Adicionar após validação (v1.x):**
- [ ] Alerta de anomalia de consumo (desvio-padrão sobre histórico)
- [ ] Exportação de histórico por ativo para auditoria

**Consideração futura (v2+):**
- [ ] Qualquer forma de telemetria/GPS — só se demanda real surgir

### Elétrica

**Lançar com (v1):**
- [ ] Cadastro de ativos elétricos por local
- [ ] Planos de inspeção periódica por tipo de ativo
- [ ] Checklist de tarefas com registro de não conformidade
- [ ] Detecção de vencimento + dashboard

**Adicionar após validação (v1.x):**
- [ ] Anexo de termografia à tarefa
- [ ] Regime de teste específico de gerador (partida/carga/autonomia)
- [ ] Registro de qualificação do técnico

**Consideração futura (v2+):**
- [ ] Alerta de recorrência de não conformidade
- [ ] Estoque de peças elétricas dedicado

### Fonoclama

**Lançar com (v1):**
- [ ] Cadastro de zonas/ativos de áudio
- [ ] Planos de teste periódico (zona, carga do amplificador, continuidade)
- [ ] Checklist de tarefas com registro de não conformidade
- [ ] Detecção de vencimento + dashboard

**Adicionar após validação (v1.x):**
- [ ] Mapa de cobertura por zona
- [ ] Teste de autonomia de backup (se aplicável)

**Consideração futura (v2+):**
- [ ] Histórico de falhas recorrentes por zona/trecho

---

## Matriz de Priorização (visão consolidada)

| Feature | Valor para usuário | Custo de implementação | Prioridade |
|---------|---------------------|--------------------------|------------|
| Cadastro de ativos (todos os módulos) | ALTO | BAIXO | P1 |
| Planos de manutenção/inspeção (todos) | ALTO | MÉDIO | P1 |
| OS / Checklist de tarefa (todos) | ALTO | MÉDIO | P1 |
| Alertas de vencimento (uso e documentação) | ALTO | MÉDIO | P1 |
| Abastecimento + consumo médio (Transportes) | ALTO | MÉDIO | P1 |
| Estoque de peças com baixa automática (Transportes) | ALTO | MÉDIO | P1 |
| Dashboard/KPIs (todos) | MÉDIO | BAIXO | P1 |
| QR code de campo (Elétrica, Fonoclama) | MÉDIO | BAIXO | P2 |
| Termografia anexada (Elétrica) | MÉDIO | MÉDIO | P2 |
| Teste específico de gerador (Elétrica) | MÉDIO | MÉDIO | P2 |
| Mapa de cobertura por zona (Fonoclama) | MÉDIO | MÉDIO | P2 |
| Alerta de anomalia de consumo (Transportes) | MÉDIO | MÉDIO | P2 |
| Alerta de recorrência de não conformidade (Elétrica/Fonoclama) | MÉDIO | MÉDIO | P3 |
| Teste de autonomia de backup (Fonoclama) | BAIXO-MÉDIO | MÉDIO | P3 |
| Telemetria/GPS (Transportes) | BAIXO (não solicitado) | ALTO | Não construir |

**Legenda de prioridade:**
- P1: essencial para o lançamento do módulo
- P2: deve entrar assim que possível, após o núcleo estar estável
- P3: desejável, consideração futura

## Análise de Padrões de Mercado (referência, não módulo específico)

| Feature | Como CMMS/fleet software de mercado fazem | Como Elétrica/Fonoclama fazem hoje (refrigeração) | Nossa abordagem |
|---------|----------------------------------------------|--------------------------------------------------|--------------------|
| Alerta de manutenção por uso | Baseado em odômetro/horímetro, com telemetria opcional via integração (Geotab, Samsara) | N/A (é inspeção por calendário) | Igual mercado, mas sem telemetria — leitura manual, como já é feito em máquinas |
| Alerta de documentação | Muitos CMMS de frota tratam licença/seguro/inspeção como "documentos" com alerta configurável de vencimento | N/A | Adotar o mesmo padrão: tabela de documentos por ativo + antecedência configurável |
| Inspeção preditiva elétrica | Ferramentas de facilities usam termografia como técnica padrão de manutenção preditiva de painéis | Refrigeração não usa (não se aplica ao domínio) | Adotar termografia como anexo opcional da tarefa em Elétrica |
| Teste de sistema de comunicação/PA | NFPA 72 define ITM formal com frequências por componente (semanal/mensal/anual) para sistemas de alarme de vida | Refrigeração usa checklist genérico por calendário | Usar frequências como benchmark de boas práticas, adaptando ao checklist já existente — sem alegar certificação NFPA 72 |

## Sources

- [FleetSoft — Fleet Maintenance Software Features](https://fleet-maintenance.com/features/) — MÉDIA confiança (marketing de fornecedor, mas consistente com múltiplas fontes)
- [Maintainly — Fleet & Industrial Vehicle Maintenance Software](https://maintainly.com/fleet-cmms) — MÉDIA confiança
- [Oxmaint — Fleet Maintenance Software](https://oxmaint.com/industries/fleet-management/) — MÉDIA confiança
- [Simply Fleet — Preventive Maintenance Software](https://www.simplyfleet.app/features/preventive-maintenance-software) — MÉDIA confiança
- [Revista FT — Conformidade de painéis elétricos com NR-10 e NBR 5410](https://revistaft.com.br/conformidade-de-paineis-eletricos-com-a-nr-10-e-nbr-5410/) — MÉDIA confiança (publicação técnica, não é o texto oficial da norma)
- [Engeman — Guia NBR 5410](https://blog.engeman.com.br/nbr-5410-instalacoes-eletricas-baixa-tensao/) — MÉDIA confiança
- [INSP-Therm — NR-10 guia completo](https://insp-therm.com.br/nr-10-norma-regulamentadora-10-guia-completo/) — MÉDIA confiança
- [ENERG Geradores — Manutenção em subestação de energia](https://www.energgeradores.com.br/manutencao-subestacao-energia) — MÉDIA confiança
- [Marinha do Brasil — NORMAM (DPC)](https://assets.marinha.mil.br/sites/default/files/atos-normativos/dpc/normam/) — ALTA confiança como fonte primária (documentos oficiais), porém não foi possível extrair o texto integral dos requisitos específicos de manutenção por horas de motor nesta pesquisa — recomenda-se leitura direta da NORMAM aplicável a embarcações de serviço/apoio na fase de análise dos apps legados
- [Detran-RJ / Justos — Vistoria veicular e documentação obrigatória](https://www.justos.com.br/blog/vistoria-veicular) — MÉDIA confiança
- [VEC Fleet — Documentos que uma frota precisa para operar legalmente](https://vecfleet.io/pt/blog/documentos-frota-operar-legalmente/) — MÉDIA confiança
- [NFPA 72 — Wikipedia / referências de ITM (Oxmaint checklist center)](https://oxmaint.com/checklist-center/voice-evacuation-speaker-inspection-checklist-facility-maintenance-guide) — MÉDIA confiança (usado apenas como benchmark internacional de boas práticas de teste, não como norma aplicável obrigatoriamente ao Fonoclama)
- Codebase interno: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` — ALTA confiança (fonte primária, código em produção)

**Gaps conhecidos para a fase de análise de cada módulo:**
- Texto completo da NORMAM aplicável às embarcações do CMASM (qual NORMAM específica rege embarcações de apoio/serviço da Marinha) não foi lido na íntegra — verificar diretamente com o usuário ou a documentação técnica da embarcação.
- Frequência real de inspeção elétrica e de teste do PA praticada hoje no CMASM (via apps legados) ainda não conhecida — este documento propõe frequências de mercado como ponto de partida, a validar na consolidação dos dados legados.
- Se o Fonoclama tem função formal de alarme/aviso de emergência (e não apenas sonorização) — isso muda a criticidade dos testes de backup e deve ser confirmado com o usuário antes do desenho final do módulo.

---
*Feature research for: Gestão de manutenção de ativos — CMASM (Transportes, Elétrica, Fonoclama)*
*Researched: 2026-08-08*
