---
phase: 13-gest-o-e-qualidade
plan: 07
subsystem: frontend
tags: [gestao, indicadores, abc, adocao, maquinas, transportes, painel, estoque]

# Dependency graph
requires:
  - phase: 13-gest-o-e-qualidade (planos 13-01, 13-02, 13-04)
    provides: shared/indicadores.js, shared/abc.js e as classes .indicador-*/.abc-* em shared/pmoc.css
  - phase: 13-gest-o-e-qualidade (plano 13-06)
    provides: gestao/app.js — o consumidor de referência, cuja forma de chamada foi copiada (não o texto)
provides:
  - painel de /maquinas com cinco cartões de indicador e curva ABC na aba Estoque
  - painel de /transportes com cinco cartões de indicador
  - tests/adocao-indicadores.test.js — gate permanente da Onda C (14 casos)
affects: [Fase 8 do roadmap (segundo consumidor dos núcleos), futuras metas cadastradas em maq_config]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Definição de indicador declarada no módulo consumidor (INDICADORES_MAQUINAS/INDICADORES_TRANSPORTES), nunca dentro do núcleo — a mesma forma dos dois lados"
    - "Cartão de indicador AO LADO da fila .kpi-row, não no lugar dela: a fila é a fotografia crua, o cartão acrescenta porcentagem, semáforo ou tendência"
    - "Valor e série medem sempre a MESMA grandeza — contagem do mês corrente e a mesma contagem nos meses anteriores"
    - "Meta só onde o cadastro a sustenta; sem alvo cadastrado o cartão diz 'Sem meta definida' em tom de informação"
    - "Gate comportamental sobre declaração recortada do módulo (node:vm) em vez de expressão regular sobre o texto"

key-files:
  created:
    - tests/adocao-indicadores.test.js
  modified:
    - maquinas/app.js
    - maquinas/index.html
    - transportes/app.js
    - transportes/index.html

key-decisions:
  - "Os cartões entram AO LADO da fila de KPI, não no lugar dela (mudança pedida na instrução de execução, contra a letra do plano). A razão é estrutural: outros gates e o roteiro manual leem os seis/sete ids, e trocar a marcação por cartões os apagaria da tela sem ninguém notar."
  - "Cada cartão só existe porque acrescenta uma das três coisas que a contagem não dá — porcentagem, semáforo contra um alvo, ou tendência ao longo dos meses. Cartão que repetisse um número da fila logo acima, sem nenhuma das três, seria ruído e não indicador — e é por isso que os cinco cartões não são os cinco KPIs."
  - "Meta só onde o cadastro a sustenta, e são exatamente duas em cada módulo: o intervalo do plano (maq_planos.intervalo / transp_planos.intervalo) diz quando a manutenção vence, e o mínimo da peça (maq_materiais.estoque_minimo / transp_materiais.estoque_minimo) diz o piso — nos dois casos o alvo do que passou do limite é ZERO, derivado do cadastro e não escolhido por mim. Disponibilidade e contagens por mês não têm alvo em coluna nenhuma destes bancos e saem com 'Sem meta definida'."
  - "Valor e série medem a MESMA grandeza. 'OS abertas no mês' é a contagem do mês corrente e a série é essa contagem nos seis meses anteriores — misturar a fotografia de agora com uma curva reconstruída de outra grandeza daria um desenho plausível e errado (a lição que o Painel do /gestao já registrou em `serie: false`)."
  - "Os meses saem do calendário local, nunca de toISOString(): a conversão para UTC empurraria o mês virado para o anterior nas primeiras horas do dia 1º no nosso fuso — mesmo defeito que `agendaChave` evitou em /refrigeracao."
  - "A curva ABC classifica o catálogo INTEIRO, nunca o recorte filtrado da tabela acima: sobre a lista filtrada as porcentagens seriam relativas ao filtro, e a tela responderia 'onde está o dinheiro deste filtro' em vez de 'onde está o dinheiro do estoque' — mesmo cuidado de D-a8u-04."
  - "Disponibilidade em Transportes conta quem NÃO está parado: em uso e sobreaviso são veículo disponível para a missão; contar só o status `disponivel` chamaria de indisponível o caminhão que está justamente rodando. Em Máquinas o denominador exclui as baixadas — contá-las faria a disponibilidade cair para sempre por causa de um ato patrimonial."
  - "Zero CSS novo, nem no módulo nem em shared/pmoc.css: a grade é `.fgrid` (duas colunas na folha comum, uma abaixo de 700px), a tabela da curva é `.tbl` dentro de `.tbl-wrap`, e os tons vêm de `.indicador-tom-*`/`.abc-classe-*`/`.pilula-*` do plano 13-04. Mesmo precedente de reúso da classe `tres` em /refrigeracao (D-cf8-21)."

requirements-completed: [GEQ-02, GEQ-07, PLAT-16]

coverage:
  - id: D1
    description: "shared/indicadores.js ganha dois consumidores reais além do /gestao, por importação e nunca por cópia"
    requirement: "GEQ-02, D-18"
    verification:
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#os dois módulos importam shared/indicadores.js, e Máquinas importa também shared/abc.js"
        status: pass
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#nenhum dos dois módulos copiou a lógica de meta, tendência ou classificação para dentro de si"
        status: pass
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#a adoção não precisou mudar os dois núcleos — se precisasse, o domínio teria vazado para dentro deles"
        status: pass
      - kind: manual
        ref: "página real de /maquinas e /transportes: cinco cartões desenhados em cada painel, dois com sparkline e seta de tendência"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nenhum KPI que existia antes deixa de aparecer — a adoção acrescenta, nunca substitui"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#todo id de KPI que existia antes da adoção continua na marcação dos dois painéis"
        status: pass
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#cada KPI antigo continua sendo preenchido pelo JavaScript — id na marcação não basta"
        status: pass
      - kind: manual
        ref: "página real: os seis KPIs de Máquinas (8/5/1/7/7/11) e os sete de Transportes (9/4/3/28/9/5/2) preenchidos com valor, não com travessão"
        status: pass
    human_judgment: false
  - id: D3
    description: "Indicador sem meta aparece em tom de informação com 'Sem meta definida'; com meta cadastrada, o semáforo funciona"
    requirement: "GEQ-02"
    verification:
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#indicador sem meta sai em tom de informação com \"Sem meta definida\"; com meta, o semáforo funciona"
        status: pass
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#as definições vivem nos módulos consumidores, com a mesma forma dos dois lados"
        status: pass
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#indicador sem valor devolve o vazio do contrato, e não zero"
        status: pass
      - kind: manual
        ref: "página real: três cartões em azul dizendo 'Sem meta definida' e dois em vermelho com 'Meta: 0 planos' / 'Meta: 0 itens', nos dois módulos"
        status: pass
    human_judgment: false
  - id: D4
    description: "A aba Estoque de Máquinas mostra a curva ABC por valor imobilizado, com os cortes padrão"
    requirement: "GEQ-07, D-18"
    verification:
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#o acessor de valor do Estoque é declarado no módulo e produz a curva pelo valor imobilizado"
        status: pass
      - kind: manual
        ref: "página real com 25 materiais: 11 em A (81,2% do valor), 6 em B, 8 em C; barra de acumulado crescendo em accent para A e azul para B; pílula de classe por linha"
        status: pass
    human_judgment: false
  - id: D5
    description: "Curva ABC com lista vazia desenha o vazio do contrato; com um item só, uma linha de classe A"
    requirement: "GEQ-07"
    verification:
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#a lista vazia desenha o vazio do contrato, nunca uma tabela sem linha"
        status: pass
      - kind: manual
        ref: "página real, três cenários: catálogo vazio e catálogo inteiro sem preço desenham 'Nenhum item para classificar / Cadastre itens com valor para gerar a curva'; um item só devolve uma linha classe A a 100,0%"
        status: pass
    human_judgment: false
  - id: D6
    description: "A curva é estado de tela: nenhuma consulta ao banco, e a estrutura cabeçalho/corpo da tabela de Estoque intacta"
    requirement: "GEQ-07, PLAT-16"
    verification:
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#a curva ABC do Estoque não consulta o banco — é derivada da lista já carregada"
        status: pass
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#a estrutura cabeçalho/corpo da tabela de Estoque não foi mexida pela adoção"
        status: pass
      - kind: unit
        ref: "node --test tests/estoque-cabecalho-maquinas.test.js tests/necessidades-compras-maquinas.test.js tests/os-custos-maquinas.test.js tests/ficha-ativo-maquinas.test.js — 83 casos, sem uma linha mudada"
        status: pass
    human_judgment: false
  - id: D7
    description: "Nenhuma cor escrita em JavaScript e nenhuma regra de CSS acrescentada; 375px sem rolagem horizontal da página, nos dois temas"
    requirement: "GEQ-02 (threat model T-13-29), D-13-01"
    verification:
      - kind: unit
        ref: "tests/adocao-indicadores.test.js#nenhuma cor literal foi acrescentada ao JavaScript dos dois módulos"
        status: pass
      - kind: manual
        ref: "página real nos dois temas, em 1280px e 375px: transbordo horizontal do documento 0 nas 12 medições; grade 557px 557px / 577px 577px no computador e uma coluna no celular; tabela da curva rolando dentro do próprio .tbl-wrap em 375px; zero erro de página"
        status: pass
    human_judgment: false

# Metrics
duration: 2h
completed: 2026-09-05
status: complete
---

# Phase 13 Plan 07: adoção dos núcleos (Onda C) Summary

**Os núcleos da Onda A deixaram de ser promessa: `shared/indicadores.js` desenha cinco cartões no painel de Máquinas e cinco no de Transportes, `shared/abc.js` classifica o estoque de Máquinas por valor imobilizado, e nenhum dos dois núcleos precisou de uma linha para servir a módulos que já existiam — o que é a prova de que a extração foi genérica.**

## Performance

- **Duration:** ~2 h
- **Tasks:** 3, entregues em 3 commits
- **Files created:** 1 · **Files modified:** 4
- **`node --test`:** 1526 → **1540**, 0 falhas

## Accomplishments

- **Painel de Máquinas** — cinco cartões de indicador numa grade `.fgrid` abaixo da fila de KPI: disponibilidade da frota (%), manutenções vencidas, materiais abaixo do mínimo, OS abertas no mês e OS concluídas no mês. Os dois últimos carregam série de seis meses, sparkline e seta de tendência; os dois do meio carregam semáforo contra meta zero derivada do cadastro.
- **Curva ABC no Estoque de Máquinas** — tabela `.tbl` dentro de `.tbl-wrap`, num cartão depois de `#tb-materiais`: classe, material, saldo, valor em estoque, participação, acumulado e a barra da curva. Resumo por classe e total imobilizado na linha de ajuda; lista cortada em 20 com o **restante anunciado**, nunca escondido em silêncio.
- **Painel de Transportes** — os mesmos cinco papéis com o vocabulário do módulo: disponibilidade da frota (%), manutenções vencidas por uso, peças abaixo do mínimo, viagens no mês e manutenções no mês. A definição é declarada exatamente com a mesma forma de Máquinas.
- **Gate da adoção** (`tests/adocao-indicadores.test.js`, 14 casos) — importação e não cópia, nenhum KPI sumido (ids escritos no próprio teste **e** exigidos preenchidos pelo JavaScript), lista fechada de sentido, curva sem consulta ao banco, nenhuma cor em JavaScript, e o núcleo continuando sem vocabulário de domínio. Onde dá, a prova é comportamental: as declarações do consumidor são recortadas e avaliadas em `node:vm`, depois passadas para as funções reais de `shared/`.
- **Verificado na página real**, servida por HTTP com um cliente falso no lugar do SDK e entrada pelo cargo Livre: os dois painéis e a aba Estoque, nos dois temas, em 1280px e em 375px — **12 medições, transbordo horizontal do documento 0 em todas, zero erro de página**. Mais três cenários-limite da curva conferidos na tela.

## Task Commits

| # | Tarefa | Commit | Tipo |
|---|--------|--------|------|
| 1 | Painel de Máquinas com cartão de indicador e curva ABC no Estoque | `09b9bd6` | feat |
| 2 | Painel de Transportes com o mesmo cartão de indicador | `cbb8714` | feat |
| 3 | Gate da adoção | `dc77012` | test |

## Os dez indicadores, e de onde vem cada meta

| Módulo | Indicador | Sentido | Meta | Série | Tom com o dado de teste |
|---|---|---|---|---|---|
| Máquinas | Disponibilidade da frota (%) | maior | — | — | info |
| Máquinas | Manutenções vencidas | menor | **0** (`maq_planos.intervalo`) | — | erro |
| Máquinas | Materiais abaixo do mínimo | menor | **0** (`maq_materiais.estoque_minimo`) | — | erro |
| Máquinas | OS abertas no mês | menor | — | 6 meses | info + tendência |
| Máquinas | OS concluídas no mês | maior | — | 6 meses | info + tendência |
| Transportes | Disponibilidade da frota (%) | maior | — | — | info |
| Transportes | Manutenções vencidas por uso | menor | **0** (`transp_planos.intervalo`) | — | erro |
| Transportes | Peças abaixo do mínimo | menor | **0** (`transp_materiais.estoque_minimo`) | — | erro |
| Transportes | Viagens no mês | maior | — | 6 meses | info + tendência |
| Transportes | Manutenções no mês | menor | — | 6 meses | info + tendência |

As duas metas de cada módulo **não são números escolhidos por mim**: o cadastro já declara o limite (de quanto em quanto uso a manutenção vence; qual é o piso de cada peça), e o alvo da contagem do que passou desse limite é zero por definição. Onde o banco não declara alvo nenhum, o cartão diz que não há meta, em vez de inventar um número que pintaria a tela de verde ou de vermelho sem ninguém ter decidido nada.

## O que foi provado na tela e o que foi provado só por gate

**Na tela** (Chromium sobre a página real, servida em `localhost:8123`, com um cliente falso no lugar do SDK e entrada pelo cargo Livre): as duas grades desenhando em duas colunas no computador (`557px 557px` em Máquinas, `577px 577px` em Transportes) e em uma no celular (`317px`); a tabela da curva rolando dentro do próprio `.tbl-wrap` em 375px e não empurrando a página; transbordo horizontal do documento **0** nas 12 combinações de módulo × tema × largura; os treze ids de KPI antigos preenchidos com número; os três estados-limite da curva (catálogo vazio, catálogo inteiro sem preço, um item só); e **zero erro de página** em todas as execuções.

**Só por gate** (o que nenhuma tela mostra): que o núcleo é importado e não copiado; que a curva não dispara consulta ao banco; que `sentido` vem da lista fechada; que nenhuma cor foi escrita em JavaScript; e que `shared/indicadores.js` continua sem vocabulário de domínio dentro dele.

**Nem tela nem gate:** o comportamento contra o banco de produção real. O dado usado na renderização é fixture — 8 máquinas, 27 OS espalhadas por seis meses, 25 materiais, 9 viaturas, 28 viagens. Os números da tela em produção serão outros; o que foi provado é a forma, o layout e os estados.

## Decisions Made

Além das registradas no frontmatter:

- **O gate escreve a lista de ids de KPI dentro de si.** É o mecanismo, não a documentação, que impede uma limpeza futura de apagar um número da tela: apagar passa a exigir apagar uma linha de uma constante chamada `KPIS_ANTES`, que é uma decisão visível em revisão de código.
- **Não basta o id estar na marcação.** O gate exige também que o JavaScript continue escrevendo em cada um — um id órfão ficaria na tela mostrando "—" e passaria por qualquer verificação que só olhasse o HTML.
- **A extração para o gate é por `node:vm`, não por expressão regular.** O que roda nos casos comportamentais é a declaração real do módulo; uma cópia dela escrita no teste concordaria consigo mesma para sempre.
- **A curva é redesenhada por `renderMateriais()`, nunca por `renderLinhasMateriais()`.** Digitar num campo de filtro continua redesenhando só o `<tbody>` (D3, decisão travada: reescrever mais que isso mata o foco e o cursor do campo), e a curva — que classifica o catálogo inteiro e não muda com o filtro — não é recalculada a cada tecla.

## Deviations from Plan

Quatro, todas registradas e nenhuma silenciosa:

1. **Os cartões entram AO LADO da fila de KPI, não no lugar dela.** O plano dizia "substituir a marcação de KPI escrita à mão por chamadas a `cartaoIndicador`"; a instrução de execução mudou isso explicitamente, e a razão é boa: `tests/os-ciclo-vida-maquinas.test.js` afirma `id="kpi-os-abertas"` na marcação, `tests/chrome-compacto.test.js` afirma a fila `.kpi-row`, e o roteiro manual lê os números. Substituir apagaria treze números da tela para trocar de componente.
2. **Os cinco cartões não são os cinco KPIs.** Como consequência direta do desvio 1, repetir os mesmos números logo abaixo da fila seria redundância pura. Cada cartão passou a ser um indicador de verdade — só entra se acrescentar porcentagem, semáforo ou tendência. Os números antigos continuam todos, na fila.
3. **Transportes não ganhou o indicador de "documentos a vencer"** que o plano nomeia. O módulo não guarda documento de veículo em coluna nenhuma (`transp_ativos` tem `prox_manutencao`, não licenciamento nem seguro), e um cartão sobre dado que não existe seria pior que cartão nenhum. Se o cadastro ganhar a coluna, o cartão é uma linha em `INDICADORES_TRANSPORTES`.
4. **`INDICADORES_MAQUINAS`, `INDICADORES_TRANSPORTES` e `ABC_ESTOQUE` foram criados como o plano previa; `ABC_TETO` e `ABC_TOM` não estavam na lista** de constantes do plano e entraram: o teto é o corte da lista visível (com o restante anunciado) e o tom mapeia a classe para a pílula. São dois nomes a mais, no mesmo lugar, não um conceito novo.

## Issues Encountered

- **Três defeitos que só a renderização mostrou**, todos corrigidos dentro do commit da tarefa 1: os cartões esticavam à altura do mais alto da linha (`.fgrid` não declara `align-items`, e o padrão do grid é `stretch` — resolvido com `align-items:start` inline, como a `.fgrid3` ao lado já fazia); "71,4" saía sem dizer de quê, porque `cartaoIndicador` só mostra a unidade dentro do texto da meta e este indicador não tem meta (o "%" foi para o rótulo, no consumidor — o núcleo não foi tocado); e **a cor da classe não chegava à barra da curva**, porque `.tbl td{color:var(--text2)}` tem especificidade (0,1,1) e vence `.abc-classe-*` (0,1,0) quando a classe fica na linha ou na célula. A barra passou a levar a classe no próprio elemento e a se pintar com `currentColor` — o mecanismo dos SVG de `shared/grafico.js`, e o oposto de escrever cor: ele *delega* a cor para a folha.
- **Dois casos do meu próprio gate nasceram quebrados** e foram corrigidos antes de entrar: o recortador de literal parava antes do `]` de fechamento da lista (o `lookahead` por caractere não-branco casava exatamente com a linha do `]`), e `classificarAbc.length` é **2** e não 3, porque parâmetro com valor padrão não entra em `Function.length` — assertar 3 teria feito o caso reprovar por um fato do JavaScript, não do código.
- **`/transportes/index.html` não boota; `/transportes/` boota.** O módulo resolve o caminho de `app.js` a partir de `location.pathname`, assumindo a rota de reescrita que a Vercel serve sem barra final. Abrir o arquivo pelo nome faz o `import()` procurar `/transportes/index.html/app.js` e a página fica em branco. Não é defeito desta task nem regressão — é a mesma regra de D-td4-07 vista pelo outro lado —, mas custou uma rodada de depuração no harness e vale ficar registrado para quem for renderizar o módulo à mão.
- **Treze defeitos foram reintroduzidos um a um e conferidos reprovando** antes de restaurar (lista completa no corpo do commit `dc77012`), incluindo os dois que mais importam: a lógica de meta copiada para dentro do módulo e a curva classificando a lista filtrada em vez do catálogo.

## Achado fora do escopo, medido e NÃO corrigido

**`fmtR` de `maquinas/app.js` escreve dinheiro com ponto decimal e sem separador de milhar** — `R$ 14808.57` onde o português escreve `R$ 14.808,57`. É a mesma classe do defeito que o plano 13-06 corrigiu em `shared/indicadores.js` no dia anterior (o cartão de indicador já mostra "71,4", com vírgula), mas aqui o alcance é outro: `fmtR` tem **24 pontos de chamada** em Máquinas (21 anteriores a esta onda, 3 na curva) — custo de OS, consumo de combustível, ciclo de vida, contratações — e a correção, embora seja de uma linha
(`Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})`), mudaria a aparência de telas que este plano não toca e não renderizou.

A curva ABC usa `fmtR` **de propósito**, e não um formatador próprio: a tabela de materiais logo acima, na mesma aba, mostra `R$ 900.00`. Dois formatos de moeda na mesma tela seriam pior que um formato errado e consistente. Conferido que os 24 usos são todos de exibição — nenhum alimenta CSV, impressão ou comparação —, então a correção é segura quando for pedida, e é task própria.

## Next Phase Readiness

- **Fase 8 do roadmap fecha aqui em parte**: `shared/indicadores.js` e `shared/abc.js` passam a ter **três** e **dois** consumidores reais respectivamente. Kanban e calendário continuam com um consumidor (Máquinas via `maquinas/operacoes.js`) — o segundo chega quando o `/gestao` da Onda B for aprovado em produção.
- **As metas podem ser cadastradas sem migração.** `maq_config` já é uma tabela chave/valor com RLS pronta (migração 30, hoje com uma linha: `valor_hora_padrao`). Ligar a meta de disponibilidade a uma chave `meta_disponibilidade` é uma linha em `metricasIndicadoresMaquinas()` mais um `insert`; ficou de fora porque não há linha cadastrada e um caminho de leitura sem dado do outro lado seria machinery sem consumidor.
- **`TESTES.md` não recebeu roteiro manual desta task** — o plano não o lista entre os artefatos e a instrução de execução não o pediu. Fica como próximo passo natural, no formato da seção "Gestão e Qualidade — Onda A".
- **Nenhuma migração**: esta onda é só leitura e cálculo sobre dado já carregado. Não há passo de banco a executar depois do deploy.

---
*Phase: 13-gest-o-e-qualidade*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: `tests/adocao-indicadores.test.js` (14 casos, todos passando)
- FOUND: commits `09b9bd6`, `cbb8714`, `dc77012`
- `node --test`: **1540 testes, 0 falhas** (baseline 1526)
- `grep -c "from '../shared/indicadores.js'" maquinas/app.js` = 1 · idem `transportes/app.js` = 1
- `grep -c "from '../shared/abc.js'" maquinas/app.js` = 1 · `grep -c 'classificarAbc' maquinas/app.js` = 2
- `grep -cE 'kpi-total|kpi-operantes|kpi-inop|kpi-venc|kpi-estoque-baixo' maquinas/index.html` = 5; os 6 ids de Máquinas e os 7 de Transportes presentes e preenchidos
- cores literais em JavaScript: `maquinas/app.js` 6 antes e 6 depois; `transportes/app.js` 1 antes e 1 depois
- `git diff --stat` de `tests/` lista **um único arquivo**, o novo — nenhum gate existente alterado (PLAT-16)
- `git diff --name-only -- refrigeracao/ mapa/xmap.js shared/pmoc.css` **vazio** (D-19, D-13-03)
- `git diff --name-only -- shared/indicadores.js shared/abc.js shared/grafico.js` **vazio** — a adoção não precisou mudar os núcleos
- `node --test tests/estoque-cabecalho-maquinas.test.js tests/necessidades-compras-maquinas.test.js tests/os-custos-maquinas.test.js tests/ficha-ativo-maquinas.test.js` = 83 casos, 0 falhas, sem uma linha mudada
- `node --test tests/mobile-375.test.js tests/shell.test.js tests/chrome-icones.test.js tests/vencimento-modulos.test.js` = 0 falhas
- Renderização: 12 medições (2 módulos × 2 temas × 2 larguras, mais a aba Estoque), **transbordo horizontal 0** em todas, **zero erro de página**
