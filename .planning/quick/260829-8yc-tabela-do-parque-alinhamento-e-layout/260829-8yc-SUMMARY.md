---
quick_id: 260829-8yc
slug: tabela-do-parque-alinhamento-e-layout
status: complete
date: 2026-08-29
---

# Tabela do Parque — alinhamento, layout, atributos e filtro multivalor

## Antes → depois (medido no navegador, 1440×900, 175 linhas)

| | Antes | Depois |
|---|---|---|
| Cabeçalho ao rolar | `y=44` (some da tela) | `y=644` = topo do container ✓ |
| Linha de filtros sobre a de rótulos | 42px de sobreposição | 0 |
| Criticidade / Próx. manutenção | à direita (pílula na beirada) | à esquerda, junto com Estado |
| Última inspeção / BTU / # | à direita, sem numeral tabular | à direita, dígito sobre dígito |
| Colunas | 12 | 13 (Atributos) |
| Largura da tabela | 1462px | 1489px — as 12 antigas caíram para 1387px (−75px), a coluna nova soma 102px |
| Filtro por coluna | um valor | vários, separados por vírgula, com lista de sugestões |

## O que a decisão custou (e por quê)

- **O sticky de D-8rz-20 nunca funcionou** — e isso não se enxerga lendo o CSS:
  a regra do `position:sticky` estava escrita e correta. O que a quebrava era o
  `overflow:hidden` da `.lista-tabela`, posto ali só para o `border-radius`
  recortar os cantos, que torna a tabela o scrollport mais próximo do `<thead>`.
  Os cantos passaram a ser recortados nas células das pontas: mesmo desenho,
  sem scrollport. **Devolver o `overflow` "para arredondar" reintroduz o defeito
  em silêncio** — por isso o gate proíbe pelo nome.
- **Consertar o sticky expôs o segundo defeito.** Com as duas linhas do `<thead>`
  grudando, ambas em `top:0`, a de filtros cobria a de rótulos: sumia justamente
  o nome da coluna sendo filtrada. Uma variável CSS (`--alt-rotulos`) é a altura
  da linha 1 **e** o `top` da linha 2 — duas metades do mesmo número, escritas
  uma vez.
- **Alinhamento deixou de sair do tipo de ordenação.** `tipo` existe para
  ordenar (é o que faz criticidade ordenar CRÍTICA→BAIXA e não alfabeticamente);
  usá-lo para alinhar punha as pílulas na beirada direita. `alinhar` é
  propriedade nova e **opcional**: coluna que não declara se comporta como hoje,
  então as outras cinco tabelas não mudam um pixel.
- **D-3a6-14 respeitada:** nada de `table-layout`, largura de coluna ou
  truncagem — a tabela é larga porque o dado é largo, e quem cede é a rolagem.
  O que encolheu foi o que não é dado: o espaçamento dos dois botões de
  cabeçalho, em doze colunas.
- **Filtro com vários valores** (pedido no meio da execução): vírgula separa, OU
  dentro da coluna, E entre colunas — a conjunção entre colunas é a regra que já
  existia. Termo vazio é descartado porque, sem isso, a vírgula recém digitada
  zeraria a lista na frente da pessoa. As sugestões saem da lista **inteira**,
  não da já filtrada, senão escolher o primeiro valor apagaria as opções do
  segundo.

## Verificação

- `node --test tests/*.test.js` → **1066/1066** (1047 antes + 19 novos), 0 falhas.
- Navegador, 1440×900: sticky grudando, sobreposição 0, alinhamentos conferidos
  coluna a coluna, `AZUL` → 84 linhas, `AZUL, VERMELHA` → 175, `AZUL,` → 84 (não
  pisca vazio), filtro `inverter` → 19, `redundante` → 16, `inverter, redundante`
  → 35. Console sem erro.
- 375×812: modo `cartao`, 175 `equip-card`, nenhuma tabela — o caminho de celular
  não foi tocado.

## Fora de escopo

Popover de caixas de marcar no filtro (o `<datalist>` entrega "mais de um" sem
componente novo); cartão de celular; largura de coluna (D-3a6-14).
