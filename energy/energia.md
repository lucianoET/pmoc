---
titulo: Eficiência Energética e Hídrica — Base de Conhecimento
escopo: CMASM · Divisão de Manutenção Especializada · Seção de Eletrônica
versao: 1.0
data: 2026-08-29
status: em construção — Fase 1 do roteiro não iniciada
---

# Eficiência Energética e Hídrica — Base de Conhecimento

Documento de referência do projeto **xEnergia**. Consolida normas aplicáveis, conceitos,
indicadores, práticas de mercado e o diagnóstico do parque do CMASM.

Serve a três usos: alimentar o painel `xenergia-demo.html`, embasar o relatório de gestão
e servir de fonte para redação de Termos de Referência.

## Convenção de procedência

Todo número neste documento carrega um marcador. Sem ele, o dado não entra.

| Marcador | Significado |
|---|---|
| **[REAL]** | Extraído do inventário do PMOC Refrigeração, exportação de 29/08/2026 |
| **[SIM]** | Simulado para demonstração do cálculo. Não usar em decisão |
| **[PREM]** | Premissa de engenharia, editável, a ser substituída por medição |
| **[NORMA]** | Texto normativo vigente |

---

# 1. Resumo executivo

O CMASM não tem problema de tecnologia: tem problema de dado e de manutenção.

1. **A lacuna principal é cadastral, não instrumental.** Sem série histórica de faturas e sem
   variáveis de normalização, nenhum indicador confiável existe — ainda que se instalem sensores.
2. **A Fase 1 do roteiro não custa nada.** Digitalizar 24 a 36 meses de contas de energia e água
   e levantar área útil e efetivo já produz linha de base, fator de carga, demanda ociosa e
   provavelmente economia imediata por correção contratual.
3. **Certificação externa não se justifica agora.** O método da ISO 50001 gera a economia;
   o certificado gera custo. Adotar o método, dispensar o selo.
4. **Um único prédio concentra o problema físico.** O F21 responde por 58% de toda a capacidade
   de climatização parada da OM. **[REAL]**
5. **A tecnologia eficiente já foi comprada e está parada.** Dos 24 equipamentos inverter do
   parque, 13 estão inoperantes e 21 estão no F21. **[REAL]**
6. **O cadastro tem sete inconsistências que afetam indicador**, incluindo um identificador
   cobrindo seis máquinas distintas e campos de placa vazios em mais de 90% dos registros. **[REAL]**

---

# 2. Marco normativo

## 2.1 O que já obriga uma OM federal

| Norma | Exigência | Repercussão |
|---|---|---|
| **Lei 10.295/2001** | Política Nacional de Conservação e Uso Racional de Energia. Autoriza o Poder Executivo a fixar índices mínimos de eficiência | Base legal de tudo abaixo |
| **IN SLTI/MPOG 02/2014** | ENCE em edificações públicas federais novas e em retrofit. **Classe "A" obrigatória na aquisição e locação de máquinas e aparelhos consumidores de energia.** Dispensa até 500 m² ou obra abaixo do CUB equivalente | Todo edital de ar-condicionado, iluminação, bomba e motor deve exigir ENCE "A". Verificar TR em uso |
| **Resolução CGIEE 04/2025** | Índices mínimos. Edificação pública federal nova: nível "A" a partir de 01/01/2027; progressão até padrão NZEB em 2035. **Não alcança edificação existente** | Não obriga etiquetar os prédios atuais. Obriga projetar obra nova para nível "A" |
| **INI-C (Inmetro)** | Método vigente de classificação de edificações comerciais, de serviços e públicas. Substituiu o RTQ-C | Método a citar em TR de projeto. Avalia envoltória, iluminação e condicionamento de ar |
| **Decreto 7.746/2012** | Critérios de sustentabilidade nas contratações; plano de gestão de logística sustentável com indicadores | Respaldo formal para os indicadores virarem rotina |
| **Lei 14.133/2021** | Sustentabilidade como diretriz; prevê contrato de eficiência remunerado por percentual da economia gerada | Instrumento para retrofit sem dotação. Confirmar dispositivo com a assessoria jurídica |
| **Normas ambientais da MB (DGMM)** | Diretrizes internas de gestão ambiental | **PENDENTE**: confirmar a norma vigente. Provavelmente já define o formato de reporte |

## 2.2 Os três níveis de certificação

Confusão recorrente. São coisas distintas e só uma certifica a organização.

| Nível | Objeto | Instrumentos |
|---|---|---|
| **Produto** | O equipamento | Selo PROCEL; ENCE de produto (PBE/Inmetro) |
| **Edificação** | O prédio, em projeto ou construído | ENCE de Edificação (INI-C); Selo PROCEL Edificações; LEED; AQUA-HQE; EDGE |
| **Organização** | O sistema de gestão | **ISO 50001** (energia); **ISO 46001** (água); ISO 14001 (ambiental) |

> PROCEL e LEED **não** certificam a OM. Certificam produtos e prédios.
> Para estatística de gestão da organização, o referencial é ISO 50001 / ISO 46001.

## 2.3 Avaliação das certificações voluntárias

| Certificação | Objeto | Esforço | Avaliação para o CMASM |
|---|---|---|---|
| ISO 50001:2018 (+Amd 1:2024) | Sistema de gestão de energia | Médio; auditoria externa periódica | **Adotar o método, sem certificar** |
| ISO 46001:2019 | Sistema de gestão de eficiência hídrica | Médio; compatível com 50001 e 14001 | **Adotar o método**; útil ao balanço hídrico |
| Selo PROCEL Edificações | Faixa superior do nível "A" da ENCE | Baixo se já houver ENCE | Considerar em obra nova |
| LEED v5, trilha O+M | Prédio existente ocupado há ≥ 1 ano | Alto; consultoria e taxas em USD | Não recomendado agora |
| AQUA-HQE | Prédio; versão brasileira | Médio-alto | Não recomendado agora |
| EDGE (IFC) | Prédio; energia, água e materiais | Baixo entre as internacionais | Só sob exigência externa |

**Por que recusar LEED e AQUA nesta fase:** custo de consultoria, auditor externo em área militar,
documentação de projeto provavelmente inexistente para os prédios atuais, e exposição de dados de
operação. Retorno institucional baixo.

**Por que adotar o método da ISO 50001 sem o certificado:** o que produz economia é a disciplina de
linha de base (EnB), indicador de desempenho (EnPI) e verificação (M&V). O certificado prova para
terceiros; não é ele que reduz consumo. Normas de apoio úteis: **ISO 50006** (linhas de base e
indicadores), **ISO 50015** (M&V), **ISO 50002-1 e 50002-2:2025** (auditoria energética, princípios
e edificações), **IPMVP** (protocolo de medição e verificação).

---

# 3. Indicadores de energia

## 3.1 Quadro-resumo

| Indicador | Expressão | Referência de ordem de grandeza | Origem do dado |
|---|---|---|---|
| Intensidade energética (IDE/EUI) | kWh ÷ (m² · ano) | 60–150 kWh/m²·ano em edificação administrativa **[PREM]** | Fatura + cadastro de área |
| Consumo per capita | kWh ÷ (pessoa · ano) | Depende do perfil da OM | Fatura + efetivo |
| Fator de carga | demanda média ÷ demanda máxima | Acima de 0,6 é bom aproveitamento **[PREM]** | Fatura |
| Fator de potência | ativa ÷ aparente | **Mínimo 0,92** **[NORMA]** | Fatura |
| Utilização da demanda | registrada ÷ contratada | Alvo entre 85% e 100% **[PREM]** | Fatura |
| Ultrapassagem | registrada > 105% da contratada | **Tolerância de 5%** **[NORMA]** | Fatura |
| Consumo de base noturno | menor potência em janela de madrugada | — | Medição horária |
| Custo unitário | R$ ÷ kWh | — | Fatura |
| Emissão associada | kWh × fator de emissão do SIN | — | Fatura + fator MCTI |

## 3.2 Detalhamento

### Intensidade energética (IDE / EUI)

```
IDE = consumo anual (kWh) ÷ área útil (m²)
```

Referência universal de comparação entre edificações de portes diferentes; base do método INI-C.

**Armadilha:** só faz sentido com área útil cadastrada e atualizada. Área errada produz indicador
errado com aparência de precisão. É o erro mais comum em relatório de gestão pública.

### Consumo per capita

```
per capita = consumo anual (kWh) ÷ efetivo médio presente
```

Essencial numa OM, onde o efetivo varia muito ao longo do ano. Sem ele, uma queda de consumo por
férias coletivas é lida como ganho de eficiência.

**Armadilha:** usar efetivo lotado em vez de efetivo presente.

### Fator de carga

```
FC = demanda média do período ÷ demanda máxima registrada
```

Definido na REN 1.000/2021 como a razão entre demanda média e demanda máxima no mesmo intervalo.
Mede o aproveitamento da demanda contratada: fator baixo indica que se paga por uma potência usada
em poucos instantes do mês.

**Armadilha:** fator baixo não é defeito em si. É sinal para investigar picos e verificar se podem
ser deslocados no tempo.

### Fator de potência

```
FP = energia ativa ÷ √(ativa² + reativa²)      referência mínima: 0,92
```

Limite mínimo de 0,92, indutivo ou capacitivo, para unidade consumidora do grupo A. Abaixo disso a
distribuidora cobra energia e demanda reativas excedentes — custo puro, sem contrapartida de consumo.
A norma prevê período de ajuste de três ciclos completos de faturamento no início do fornecimento.

**Armadilha:** sobrecorreção por banco de capacitores mal dimensionado também é penalizada, pois o
limite vale nos dois sentidos.

### Demanda contratada × registrada

```
utilização = demanda registrada ÷ demanda contratada
ultrapassagem quando registrada > 1,05 × contratada
```

A demanda é integralizada em intervalos de 15 minutos durante o período de faturamento. A cobrança
por ultrapassagem incide sobre o que exceder 5% da contratada. Na modalidade azul a verificação é
feita **por posto tarifário** — não haver ultrapassagem na ponta não elimina a cobrança fora da ponta.

**Armadilha operacional:** é comum a instalação ter os dois problemas ao mesmo tempo — ultrapassagem
no verão e ociosidade no inverno. Reduzir a contratação olhando só o mês mais fraco troca um custo
pelo outro. **A sequência correta é achatar a ponta primeiro e só depois renegociar.**

### Consumo de base noturno

```
base = menor potência registrada na janela de madrugada (ex.: 02h–04h)
energia fora do expediente = base × horas anuais fora de expediente
```

Melhor indicador isolado de desperdício em instalação predial: é a carga que permanece ligada com o
prédio vazio.

**Armadilha:** nem toda carga de base é desperdício. Servidores, CFTV, sistemas de segurança, câmaras
frias e paióis 24/7 são legítimos. O indicador serve para **abrir investigação**, não para concluir.

**Requisito:** exige medição com registro horário. Não é obtenível da fatura convencional.

---

# 4. Indicadores de água

| Indicador | Expressão | Situação no CMASM |
|---|---|---|
| Consumo per capita | L ÷ (pessoa · dia) | Calculável já, com fatura e efetivo |
| Índice de perdas | (macromedido − Σ micromedido) ÷ macromedido | **Bloqueado** — exige hidrômetro por prédio |
| Vazão mínima noturna (VMN) | Δ volume ÷ Δ tempo, com bombas paradas | **Derivável hoje** do xAguada |
| Balanço hídrico | entrada − consumo medido − perdas | Parcial; falta o lado do consumo |
| Consumo por uso final | m³ por refeição, lavagem, m² irrigado | Exige medição dedicada |
| Percentual de reúso | alternativo ÷ total | Não aplicável; sem sistema de reúso |
| Tempo de detecção de vazamento | horas entre evento e abertura da OS | Métrica de processo, integrável ao ERP |

## 4.1 Vazão mínima noturna — o indicador de maior retorno

```
VMN = (volume_t0 − volume_t1) ÷ (t1 − t0)     com as bombas comprovadamente paradas
```

Com o prédio vazio e as bombas desligadas, o que continua saindo da rede é perda. É a evidência
objetiva de vazamento mais acessível num campus, e **pode ser obtida do xAguada sem nenhum hardware
novo** — basta derivar a variação de nível do reservatório na madrugada.

**Condição de validade, inegociável:** as bombas precisam estar comprovadamente paradas na janela.
Se houver recalque, torre de arrefecimento ou irrigação operando, o cálculo mede a bomba, não o
vazamento. **Confirmar a janela real de parada antes de publicar o indicador.**

## 4.2 Sobre o índice de perdas

Indicador consagrado do saneamento (referências SNIS e PNCDA), mas depende de micromedição setorial.
Sem hidrômetro por prédio, o valor é **indeterminado**.

Registrar "não calculável" é mais honesto e mais útil do que estimar. A parcela não medida do balanço
hídrico não é "perda comprovada" — é indeterminação, e apresentá-la como perda destrói a credibilidade
do painel na primeira pergunta difícil.

---

# 5. Normalização e linha de base

## 5.1 A regra

**Comparar consumo bruto entre períodos mede clima, efetivo e escala de serviço — não eficiência.**

Variáveis relevantes, na acepção da ISO 50006:

- área útil construída (m²);
- efetivo presente no período;
- graus-dia de refrigeração — variável crítica no clima do Rio de Janeiro;
- dias úteis e regime de serviço.

## 5.2 Duas armadilhas de normalização

**Normalizar por constante não informa nada.** A área útil não varia entre os meses do ano. Dividir
por ela desloca a escala e mantém o índice idêntico. Normalização só produz informação quando a
variável varia entre os períodos comparados.

**Divisão simples por graus-dia supercorrige.** Parte da carga não depende do clima — iluminação,
equipamentos, cargas de base — e continua no numerador enquanto o denominador despenca no inverno.
O resultado é um indicador que "piora" todo inverno, sem que nada tenha piorado.

## 5.3 O método correto: regressão

```
consumo esperado = a + b × graus-dia

a  →  carga fixa, independente do clima (kWh/mês)
b  →  sensibilidade ao clima (kWh por grau-dia)
R² →  fração da variação explicada pelo clima
desvio = consumo real − consumo esperado
```

É o que fazem a ISO 50006 e o IPMVP. O coeficiente `a` é a mesma grandeza que o consumo de base
noturno mede pelo outro lado — duas leituras independentes da carga fixa, e por isso servem para
validar uma à outra.

**Metas de economia devem ser fixadas sobre o desvio, nunca sobre o consumo bruto.**

**Requisitos:** mínimo de 12 meses de dados. R² baixo indica que falta variável relevante no modelo,
não que a gestão está ruim.

---

# 6. Práticas de mercado — tarifação

## 6.1 Estrutura tarifária do grupo A

Unidade atendida em média tensão é faturada em duas parcelas: **demanda** (kW) e **consumo** (kWh).

| Modalidade | Demanda | Quando costuma compensar |
|---|---|---|
| **Verde** | Preço único de demanda | Instalação que consegue reduzir carga na ponta |
| **Azul** | Demanda diferenciada em ponta e fora de ponta | Instalação que não consegue evitar carga na ponta |

O enquadramento errado é uma das causas mais comuns de sobrecusto em instalação pública — e sua
correção não exige obra, apenas análise dos 12 meses de fatura e pedido à distribuidora.

## 6.2 Roteiro de auditoria de fatura

Ordem de leitura de uma conta do grupo A, do achado mais provável ao menos provável:

1. **Demanda contratada × registrada nos 12 meses.** Ociosidade e ultrapassagem.
2. **Modalidade tarifária × perfil de consumo em ponta e fora de ponta.**
3. **Cobrança de excedente de reativos.** Indica FP abaixo de 0,92.
4. **Bandeiras tarifárias e tributos.** Conferir imunidades e alíquotas aplicáveis.
5. **Multas, juros e refaturamentos.** Costumam indicar falha de processo interno.

## 6.3 Contrato de eficiência (ESCO / EPC)

A Lei 14.133/2021 prevê contrato remunerado por percentual da economia gerada. É o instrumento
viável para retrofit de iluminação e climatização sem dotação orçamentária dedicada.

**Pré-requisito absoluto:** linha de base auditável. Sem ela não há como medir a economia que
remunera o contratado — e o contrato vira disputa. **A Fase 1 do roteiro é condição para a Fase 3.**

---

# 7. Práticas de mercado — climatização

## 7.1 Métricas de eficiência

| Métrica | O que mede | Uso |
|---|---|---|
| **EER** | Capacidade ÷ potência elétrica, em carga nominal | Comparação em condição de projeto |
| **COP** | Coeficiente de desempenho, adimensional | Equivalente ao EER em unidades SI |
| **IPLV / NPLV** | Desempenho ponderado em carga parcial | **Métrica correta para chiller e self contained** |
| **ENCE / PBE** | Classificação oficial A–E | Exigência contratual, conforme IN 02/2014 |

Conversão útil: `1 TR ≈ 12.000 BTU/h`; `kW elétrico ≈ BTU/h ÷ EER ÷ 1000` com EER em BTU/(W·h).

## 7.2 Inverter — onde faz sentido e onde a pergunta é outra

**Expansão direta de pequeno porte (split, piso-teto):** inverter é a norma de mercado. O binário
"tem ou não tem" é indicador válido. Ganho típico de 20% a 40% em carga parcial **[PREM]**, que é o
regime real quase o tempo todo.

**Janela:** existe oferta inverter no Brasil, mas residual — poucos modelos e poucas capacidades. Na
prática a substituição é por split inverter, não por janela inverter. Manter janela no denominador do
índice piora o número por limitação de mercado, não por decisão de gestão.

**Self contained:** o parque instalado tradicional usa scroll de velocidade fixa com controle liga-desliga
e estágios. Existem linhas com scroll digital e com inverter scroll. **Confirmado no parque do CMASM:
3 unidades self contained inverter no prédio EXOCET. [REAL]**

**Chiller:** velocidade variável é comum no mercado atual — scroll modular inverter, parafuso e
centrífugo com VSD.

> **Ressalva de método:** para self contained e chiller, "tem inverter?" é a pergunta errada. Esses
> equipamentos modulam por estágios, descarga de cilindro, scroll digital ou VSD, e o desempenho em
> carga parcial se mede por **IPLV/NPLV**. Um chiller de dois compressores sem inverter pode ter IPLV
> melhor que um inverter mal aplicado.

Consequência para o cadastro: o campo não deve ser booleano. Deve ser
`tecnologia_compressor ∈ {on_off, inverter, scroll_digital, vsd, desconhecido}`.

## 7.3 Índice de penetração inverter (IPI)

```
IPI = equipamentos inverter ÷ equipamentos do escopo considerado
```

**O denominador decide a conclusão.** Nunca apresentar o número sem dizer o escopo.

| Escopo | Composição | Serve para |
|---|---|---|
| Parque inteiro | Todos os tipos | Reporte institucional; diluído |
| Total − (self + chiller) | Split + piso-teto + janela | Toda a expansão direta; comparável |
| Split + janela | Split hi-wall + janela | Escopo literal; **deixa o piso-teto de fora** |
| **Split + piso-teto** | Expansão direta de pequeno porte | **Escopo de gestão**; onde a decisão é de compra |

> **Piso-teto é split.** Muda a configuração da evaporadora, não a arquitetura do sistema, e há linha
> inverter para ele. Excluí-lo do denominador subestima a base sem justificativa técnica.

**Recomendação:** reportar o IPI sobre split + piso-teto, e tratar a janela em indicador próprio de
substituição tecnológica.

## 7.4 Substituição por inverter — quando NÃO fazer

Retorno simples de troca de equipamento em funcionamento:

```
economia anual = kW médio × horas/ano × % economia × tarifa
payback simples = custo da troca ÷ economia anual
```

Com premissas típicas de sala de uso administrativo (2.080 h/ano, 32% de economia), o payback fica
acima de cinco anos. **Substituir equipamento em funcionamento não se justifica apenas por eficiência.**

Três políticas melhores, em ordem de retorno:

1. **Recolocar em operação o inverter já instalado e parado.** Custa manutenção, não aquisição, e o
   ganho de eficiência já foi pago.
2. **Exigir inverter e ENCE classe "A" em toda compra nova e em toda troca por falha.** O IPI sobe por
   renovação natural do parque, sem investimento dedicado. Já é exigência da IN 02/2014.
3. **Troca dirigida apenas a ambientes de uso intenso** (acima de ~3.500 h/ano), onde o payback cai
   para menos de quatro anos.

## 7.5 Redundância × diversidade — não confundir

Dois abatimentos de naturezas diferentes, que precisam ser aplicados **separadamente**:

```
carga operacional = carga instalada − carga em reserva     ← redundância (estrutural)
carga simultânea  = carga operacional × fator diversidade  ← diversidade (térmica)
```

- **Redundância** é de projeto: a máquina reserva nunca opera junto com a principal.
- **Diversidade** é operacional: máquinas ativas não atingem plena carga ao mesmo tempo.

**Erro comum:** aplicar só um fator de diversidade baixo sobre o parque inteiro. Isso conta o mesmo
abatimento duas vezes. Separados os efeitos, o fator de diversidade das máquinas efetivamente ativas
sobe — tipicamente para a faixa de 0,65 a 0,80 **[PREM]**.

## 7.6 Índice de redundância efetiva

```
redundância efetiva = conjuntos com todas as máquinas operantes ÷ conjuntos redundantes
```

Transforma o número solto de equipamentos inoperantes em informação de **criticidade**. Um conjunto
com a reserva parada não está redundante: está a uma falha de perder a climatização do ambiente.

**Três consequências operacionais do regime redundante:**

1. **Prioridade de reparo.** A fila deve ser ordenada pelo conjunto a que o equipamento pertence, não
   pela ordem de abertura da OS. Reparar o split de uma sala com reserva íntegra antes da máquina de um
   paiol exposto é priorização invertida.
2. **Plano por horímetro segue a máquina, não o ambiente.** Em rodízio, cada máquina acumula cerca de
   metade das horas do local. Plano amarrado ao ambiente dobra o intervalo real de cada unidade.
3. **Reserva não se testa sozinha.** A máquina que só liga quando a principal falha é justamente a que
   ninguém percebe estar quebrada. O rodízio programado é o único teste funcional da reserva.

---

# 8. Diagnóstico do parque — dados reais

Fonte: exportação `pmoc-refrigeracao-inventario-2026-08-29.csv`, 183 registros. **[REAL]**

## 8.1 Retrato geral

| Grandeza | Valor |
|---|---|
| Registros | 183 (175 identificadores únicos) |
| Operantes | 144 (inclui 1 registro com estado "OR") |
| Inoperantes | 39 — 21% das unidades |
| Capacidade instalada | 12.154.000 BTU/h ≈ 1.013 TR |
| Capacidade parada | 2.868.000 BTU/h ≈ 239 TR — 24% |
| Regime 24/7 declarado | 19 equipamentos |

| Tipo | Total | Operante | Inoperante | BTU instalado | Inverter | Redundante |
|---|---:|---:|---:|---:|---:|---:|
| Split | 105 | 79 | 26 | 3.389.000 | 21 | 1 |
| Self contained | 44 | 38 | 6 | 7.252.000 | 3 | 10 |
| Piso-teto | 22 | 16 | 6 | 1.202.000 | 0 | 0 |
| Janela | 11 | 11 | 0 | 131.000 | 0 | 0 |
| Chiller | 1 | 0 | 1 | 180.000 | 0 | 0 |
| **Total** | **183** | **144** | **39** | **12.154.000** | **24** | **11** |

## 8.2 O F21 concentra o problema

| Prédio | Equipamentos | Parados | TR instalados | TR parados |
|---|---:|---:|---:|---:|
| PAIOL | 20 | 2 | 300 | 30 |
| **F21** | **27** | **17 (63%)** | **212** | **138** |
| EXOCET | 10 | 0 | 78 | 0 |
| MK48 | 12 | 4 | 59 | 28 |
| RANCHO/COZINHA | 9 | 5 | 42 | 25 |

**O F21 responde por 58% de toda a capacidade parada da OM.** Uma lista de 39 inoperantes distribuída
por tipo não mostra isso. O mesmo dado agrupado por prédio transforma manutenção corretiva difusa em
uma intervenção concentrada, contratável como lote único.

**Situação interna do F21:**

- Central de bombordo operante, **central de boreste inoperante** (360.000 BTU cada) — o par
  redundante do prédio está sem reserva.
- MECÂNICA 03: 3 dos 4 self contained parados, 1 com estado "OR"; os 4 splits operantes estão
  sustentando o ambiente. **O regime informado — self principal, split reserva — está invertido
  na prática.**
- 4 splits das salas de bateria, criticidade CRÍTICA, **todos parados** — e são exatamente os
  4 registros sem regime de uso preenchido.
- 21 dos 24 equipamentos inverter da OM estão neste prédio, a maioria parada.

## 8.3 Criticidade × estado

| Criticidade | Total | Operante | Inoperante | % parado |
|---|---:|---:|---:|---:|
| CRÍTICA | 22 | 16 | 6 | 27% |
| ALTA | 100 | 76 | 24 | 24% |
| MÉDIA | 24 | 23 | 1 | 4% |
| BAIXA | 37 | 29 | 8 | 22% |

Dos 39 parados, **6 têm consequência imediata sobre material sensível** — 4 deles em salas de bateria
do F21. Este é o cruzamento que a contagem simples de inoperantes não entrega.

## 8.4 Redundância

| Conjunto | Máquinas | Operantes | Situação |
|---|---:|---:|---|
| PAIOL D-5, G-6, G-8, K-6, U-6, U-7, U-8, R-7 | 2 cada | 2 | Reserva íntegra |
| **PAIOL G-5** | 2 | 1 | **Sem reserva real** |
| **PAIOL G-7** | 2 | 1 | **Sem reserva real** |
| COMANDO INFORMÁTICA (servidor) | — | — | Marcado como redundante |

- **Redundância efetiva: 82%** (2 conjuntos comprometidos de 11).
- Paiol K-6 opera em regime 24/7 e criticidade CRÍTICA, com o par íntegro.
- **O F21 tem zero equipamentos marcados como redundantes**, embora a DME informe regime
  principal-reserva no prédio. Enquanto o campo estiver vazio, a carga do F21 entra inteira no
  cálculo de demanda e o prédio não aparece na análise de conjuntos.

## 8.5 Penetração inverter

| Escopo | Inverter | Base | IPI |
|---|---:|---:|---:|
| Parque inteiro | 24 | 183 | 13,1% |
| Total − (self + chiller) | 21 | 138 | 15,2% |
| Split + janela | 21 | 116 | 18,1% |
| **Split + piso-teto** | 21 | 127 | **16,5%** |

**O achado que muda a recomendação: 13 dos 24 equipamentos inverter estão inoperantes.** O IPI mede
tecnologia instalada, não tecnologia em uso. A diferença entre as duas leituras é exatamente o que já
foi comprado e não está entregando economia.

## 8.6 Estimativa de carga

Com EER por tipo como premissa **[PREM]** — split 9,5; piso-teto 9,0; janela 8,5; self contained 9,0;
chiller 10,0 BTU/(W·h); ganho inverter 1,20:

| Grandeza | Valor |
|---|---:|
| Carga instalada operante | ~1.008 kW |
| Carga em reserva (11 unidades) | ~162 kW |
| Carga operacional | ~846 kW |
| Carga simultânea (diversidade 0,70) | ~592 kW |
| Carga latente parada | ~297 kW |

**Alerta de gestão:** reparar os 39 equipamentos parados acrescenta cerca de 208 kW à demanda
simultânea. É melhoria de serviço que **aumenta** o consumo. Precisa estar explicada antes de aparecer
como piora no indicador do exercício seguinte.

## 8.7 Teste de coerência

```
carga simultânea estimada ≤ demanda máxima registrada
```

Se a climatização estimada excede a demanda medida, o resultado é impossível e uma das três premissas
está errada: o EER adotado, o fator de diversidade ou a série de demanda.

Este teste deve ficar permanentemente no painel. Quando a fatura real entrar, ele passa a ser a
**validação cruzada entre cadastro e medição** — se não fechar, um dos dois está errado.

---

# 9. Qualidade do cadastro

Um indicador vale o que vale o cadastro. Achados da exportação de 29/08/2026. **[REAL]**

| Achado | Ocorrências | Efeito |
|---|---|---|
| Registros × cabeçalho | 183 linhas, 175 declarados | Todo indicador com denominador de contagem muda conforme a escolha |
| Registros sem identificador | 4 (paióis D-5, K-6, R-7) | Sem rastreabilidade de OS e de histórico |
| Identificador repetido | id 138 cobre 6 máquinas em MECÂNICA 03 | Horímetro e histórico embaralhados no prédio mais crítico |
| Regime de uso em branco | 4 | Todos splits CRÍTICOS das salas de bateria do F21 |
| Permanente com jornada de 8 h | 2 | Centrais de bombordo e boreste; uma das informações está errada |
| Estado fora do domínio | 1 ("OR") | Tratado como operante; decisão a confirmar |
| Redundância do F21 não cadastrada | 0 marcados | Carga entra inteira na demanda |

## 9.1 Completude por campo

| Campo | Preenchido | Consequência |
|---|---:|---|
| Criticidade | 100% | Permite priorização por risco |
| BTU | 99% (2 zerados) | Base da estimativa de carga |
| Identificador | 98% | 4 registros irrastreáveis |
| Fabricante | 68% | Limita análise por marca |
| Patrimônio | 11% | Dificulta conciliação com o SIAFI |
| Modelo | 9% | **Sem modelo não há dado de placa** |
| **Corrente nominal** | **0% — todos os 183 registros com valor zero** | Impede substituir a premissa de EER por medida real |
| Data de instalação | 1% | Impede análise de ciclo de vida |
| Última manutenção | 1 de 183 | **Impede correlacionar desempenho com o PMOC** |

**Leitura:** o inventário está bom no que serve à gestão de manutenção (criticidade, estado, local) e
vazio no que serve à gestão de energia (placa, potência, histórico). São dois cadastros diferentes
convivendo na mesma tabela, e o segundo ainda não foi feito.

**Prioridade de campo:** `corrente nominal` e `modelo`. Com corrente e tensão, a potência elétrica sai
por medida em vez de premissa, e todo o estimador de carga deixa de depender de EER estimado.

---

# 10. Modelo de dados

## 10.1 Núcleo de medição

```sql
create table ponto_medicao (
  id        serial primary key,
  nome      text not null,
  tipo      text not null,       -- 'energia' | 'agua'
  escopo    text not null,       -- 'geral' | 'predio' | 'quadro' | 'reservatorio'
  local_id  int references local(id)
);

create table leitura (
  id        bigserial primary key,
  ponto_id  int not null references ponto_medicao(id),
  instante  timestamptz not null,
  grandeza  text not null,       -- 'kwh' | 'kw' | 'm3' | 'nivel_m3' | 'fp'
  valor     numeric not null,
  unique (ponto_id, instante, grandeza)
);

-- Sem esta tabela não existe EnPI. É a que costuma ser esquecida.
create table variavel_periodo (
  competencia   date primary key,
  area_util_m2  numeric not null,
  efetivo_medio numeric not null,
  graus_dia     numeric not null,
  dias_uteis    int     not null
);

-- Fonte primária da Fase 1, anterior a qualquer sensor.
create table fatura (
  competencia        date not null,
  tipo               text not null,   -- 'energia' | 'agua'
  consumo            numeric not null,
  demanda_registrada numeric,
  demanda_contratada numeric,
  fator_potencia     numeric,
  valor_total        numeric,
  primary key (competencia, tipo)
);
```

## 10.2 Campos a criar no PMOC

```sql
alter table equipamento_climatizacao
  add column tecnologia_compressor text
    check (tecnologia_compressor in
      ('on_off','inverter','scroll_digital','vsd','desconhecido'))
    default 'desconhecido',
  add column ence_classe     text,
  add column ano_fabricacao  int,
  add column potencia_kw     numeric;   -- de placa, não estimada

create table grupo_redundancia (
  id       serial primary key,
  nome     text not null,          -- 'Paiol G-5', 'F21 — MECÂNICA 03'
  local_id int references local(id),
  regime   text not null check (regime in ('rodizio','principal_reserva'))
);

alter table equipamento_climatizacao
  add column grupo_id int references grupo_redundancia(id),
  add column papel    text check (papel in ('principal','reserva','unico'))
                           default 'unico';
```

## 10.3 Consultas de referência

```sql
-- IPI no escopo de gestão
select count(*) filter (where tecnologia_compressor = 'inverter')::numeric
       / nullif(count(*),0) as ipi
from equipamento_climatizacao
where situacao = 'operante' and tipo in ('SPLIT','PISO/TETO');

-- Conjuntos que perderam a reserva: fila de reparo por criticidade
select g.nome, g.regime,
       count(*) filter (where e.situacao = 'operante') as operantes,
       count(*) as maquinas
from grupo_redundancia g
join equipamento_climatizacao e on e.grupo_id = g.id
group by g.id, g.nome, g.regime
having count(*) filter (where e.situacao = 'operante') < count(*);

-- Vazão mínima noturna a partir do nível do reservatório
with janela as (
  select instante, valor as volume_m3
  from leitura
  where ponto_id = :reservatorio and grandeza = 'nivel_m3'
    and instante::time between '02:00' and '04:00'
    and instante::date = :dia
)
select (max(volume_m3) - min(volume_m3)) * 1000
       / extract(epoch from (max(instante) - min(instante))) * 3600
       as vmn_litros_hora
from janela;

-- Fila de levantamento de placa
select tipo, count(*) as pendentes
from equipamento_climatizacao
where tecnologia_compressor = 'desconhecido'
group by tipo order by 2 desc;
```

---

# 11. Roteiro de implantação

**Princípio: começar pelo dado que já existe. Sensor é a última etapa, não a primeira.**

| Fase | Objeto | Recurso | Bloqueia |
|---|---|---|---|
| **1 — Linha de base documental** | Digitalizar 24–36 meses de faturas; levantar área útil e efetivo; calcular os primeiros indicadores | Nulo | Fases 2, 3 e 4 |
| **2 — Ganhos contratuais** | Revisar demanda, modalidade tarifária e fator de potência; padronizar cláusula ENCE "A" nos TR | Baixo | — |
| **3 — Micromedição** | Hidrômetros setoriais e medidores elétricos por quadro, no barramento MQTT existente | Licitação | — |
| **4 — Painel e rotina** | Indicadores normalizados, relatório mensal, alarme de desvio | Desenvolvimento interno | — |

As Fases 1 e 2 tendem a produzir economia superior à da micromedição, com custo nulo e sem licitação.
Ainda que a Fase 3 não se concretize por restrição orçamentária, o trabalho já terá gerado resultado.

## 11.1 Ganhos rápidos, por ordem de retorno

| # | Medida | Custo |
|---|---|---|
| 1 | Revisar demanda contratada contra a registrada em 12 meses | Nulo |
| 2 | Revisar modalidade tarifária contra o perfil de consumo | Nulo |
| 3 | Verificar cobrança de reativo excedente; se houver, dimensionar capacitores | Baixo |
| 4 | Investigar o consumo de base na madrugada e fins de semana | Nulo |
| 5 | Calcular a VMN a partir do xAguada | Nulo |
| 6 | Padronizar exigência de ENCE "A" em toda compra de equipamento | Nulo |
| 7 | **Recolocar em operação os 13 inverter parados** | Manutenção |

## 11.2 Especificação de medidor

**Não usar módulos de baixo custo do tipo PZEM-016 para indicador ligado a faturamento.** Não têm
registro de demanda máxima em janela de 15 minutos nem leitura de reativo — e o número não fecha com a
fatura, o que destrói a credibilidade do painel na primeira apresentação.

| Uso | Requisito | Exemplos de classe adequada |
|---|---|---|
| Indicador de faturamento | Demanda máxima em janela de 15 min, energia reativa, Modbus RTU | Kron Mult-K, Embrasul, Schneider PM2100 |
| Tendência de consumo | Energia ativa por circuito | Shelly Pro 3EM |

---

# 12. Riscos e pontos de atenção

| Risco | Tratamento |
|---|---|
| **Sensibilidade da informação** | Curva de carga e consumo de água revelam efetivo, turnos e ritmo operacional. Definir previamente o nível de agregação de divulgação irrestrita (mensal, sem série fina) e o de acesso restrito |
| **Medidor inadequado** | Ver 11.2. Número que não fecha com a fatura invalida o indicador |
| **Dado sem normalização** | Gráfico de consumo bruto conduz a decisão equivocada. Normalização é requisito de método |
| **Descontinuidade** | Painel sem responsável designado torna-se inoperante em poucos meses. A rotina mensal precisa de dono formal na DME |
| **Infraestrutura externa** | Serviços de nuvem em conta gratuita, fora do domínio da MB, exigem avaliação de retenção e continuidade antes de o painel ser oficial |
| **Melhoria que piora o indicador** | Reparar os 39 parados aumenta o consumo. Explicar antes, não depois |

---

# 13. Premissas e pendências

## 13.1 Premissas a substituir por medição

| Premissa | Valor adotado | Como substituir |
|---|---|---|
| EER por tipo | 9,5 / 9,0 / 8,5 / 9,0 / 10,0 BTU/(W·h) | Corrente nominal × tensão, do dado de placa |
| Ganho do inverter | 1,20 × | Ensaio ou dado de placa |
| Fator de diversidade | 0,70 | Medição por quadro |
| Horas equivalentes/ano | 2.500 | Registro de operação por ambiente |
| Área útil | 24.000 m² | Levantamento predial |

## 13.2 Pendências abertas

1. **Norma ambiental da MB aplicável** — confirmar a vigente e o formato de reporte exigido.
2. **Janela real de parada das bombas** — a VMN só é válida na janela em que nenhuma bomba, torre de
   arrefecimento ou irrigação opera.
3. **Regime do F21** — os splits são reserva fria ou entram em complemento nos dias mais quentes?
   Se complementarem, não são reserva: são carga adicional em ponta e o abatimento não se aplica.
4. **Discrepância 183 × 175 registros** — definir se são máquinas físicas distintas ou duplicidade de
   exportação. O denominador de todos os índices depende disso.
5. **Estado "OR"** — padronizar o domínio do campo.
6. **Dono da rotina mensal** — designação formal na DME.
7. **Política de dados** — o que é irrestrito, o que é restrito, o que não vai para nuvem.

---

# 14. Resumo por seção

| Seção | Mensagem central |
|---|---|
| **2. Marco normativo** | A ENCE classe "A" já é obrigatória nas compras. É a exigência de custo zero mais desperdiçada |
| **2.2–2.3 Certificações** | Só ISO 50001 e 46001 certificam a organização. Adotar o método, dispensar o selo |
| **3. Indicadores de energia** | Demanda contratada e fator de potência são os achados mais prováveis e mais baratos de corrigir |
| **4. Indicadores de água** | A VMN é obtenível hoje do xAguada; o índice de perdas está bloqueado e deve ser reportado como tal |
| **5. Normalização** | Consumo bruto não é indicador. Divisão simples por graus-dia supercorrige; use regressão |
| **6. Tarifação** | Auditar fatura antes de comprar sensor. A Fase 1 é pré-requisito do contrato de eficiência |
| **7. Climatização** | Inverter é indicador válido para split; para self e chiller a métrica é IPLV. Redundância ≠ diversidade |
| **8. Diagnóstico** | O F21 concentra 58% da capacidade parada. 13 dos 24 inverter estão inoperantes |
| **9. Qualidade do cadastro** | Corrente nominal 0% e última manutenção 1/183. O cadastro de energia ainda não foi feito |
| **10. Modelo de dados** | Faltam três campos no PMOC: tecnologia do compressor, grupo de redundância e potência de placa |
| **11. Roteiro** | Fases 1 e 2 custam zero e valem mais que a micromedição |
| **12. Riscos** | Dado de consumo é informação operacional. Definir agregação antes de publicar |

---

# 15. Referências

**Normas e regulamentos**

- Lei 10.295/2001 — Política Nacional de Conservação e Uso Racional de Energia
- Lei 14.133/2021 — Licitações e Contratos Administrativos
- Decreto 7.746/2012 — Sustentabilidade nas contratações públicas
- IN SLTI/MPOG 02/2014 — ENCE em edificações públicas federais e em aquisições
- Resolução CGIEE 04/2025 — Índices mínimos de eficiência energética para edificações
- INI-C — Instrução Normativa Inmetro para edificações comerciais, de serviços e públicas
- REN ANEEL 1.000/2021 — Condições gerais de fornecimento (fator de potência art. 302; ultrapassagem
  art. 300–301; definições art. 2)

**Normas técnicas**

- ABNT NBR ISO 50001:2018 (+ Amd 1:2024) — Sistemas de gestão da energia
- ISO 46001:2019 — Sistemas de gestão de eficiência hídrica
- ISO 50002-1:2025 e ISO 50002-2:2025 — Auditorias energéticas
- ISO 50006 — Medição do desempenho energético por linhas de base e indicadores
- ISO 50015 — Medição e verificação do desempenho energético
- IPMVP — International Performance Measurement and Verification Protocol

**Referências setoriais**

- SNIS — Sistema Nacional de Informações sobre Saneamento (indicadores de perdas)
- PNCDA — Programa Nacional de Combate ao Desperdício de Água
- PROCEL Edifica / PBE Edifica — etiquetagem de edificações
- MCTI — fatores de emissão do Sistema Interligado Nacional

**Artefatos do projeto**

- `xenergia-demo.html` — painel de demonstração, aba de climatização com dados reais
- `Levantamento_Eficiencia_Energetica_Hidrica_CMASM.docx` — relatório de gestão, padrão CMASM
- `Eficiencia_Energetica_Hidrica_CMASM.pptx` — apresentação de 16 slides
- `pmoc-refrigeracao-inventario-2026-08-29.csv` — fonte do diagnóstico do parque
