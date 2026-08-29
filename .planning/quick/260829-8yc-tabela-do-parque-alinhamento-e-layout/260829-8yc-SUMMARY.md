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

## Segunda rodada — caber na tela (mesmo dia)

| | Antes | Depois |
|---|---|---|
| Rolagem horizontal em 1440px | 137px | **0** |
| Rolagem horizontal em 1024px | (não cabia) | **0** |
| Colunas | 13 (uma de chips) | 15 (três de atributo, depois de Criticidade) |
| Largura da tabela | 1489px | 1337px em container de 1352px |
| Padding lateral | 12px | 8px (2px nas colunas de símbolo) |
| Botões no cabeçalho | 2 por coluna (26) | 1 por coluna (15) + um "Filtros" na barra |

**D-3a6-14 foi revertida a pedido do usuário.** Ela dizia "sem largura fixa e sem
`table-layout:fixed`; o que resolve o excesso é rolagem". A preocupação registrada
lá — Local é o único campo longo e variável — virou **peso**: Local leva a maior
fatia das quinze colunas (195px em 1440, 140px em 1024).

**De onde vinha a largura, e não era o dado:** o cabeçalho `nowrap` fazia
"Próx. manutenção" pedir 149px para conteúdo que cabe em 90; o ⌕ eram doze botões
de ~20px fazendo o que um faz; e o padding de coluna de texto numa coluna de `✓`
é espaço morto.

`largura` é **peso relativo normalizado no desenho**, não porcentagem — é o que
deixa as três colunas de atributo entrar e sair pela sonda sem recalcular as
outras doze à mão. E só vira `table-layout:fixed` quando **todas** declaram:
meia declaração é pior que nenhuma, porque o navegador divide o resto igualmente
e a coluna longa some.

Medido depois: rolagem horizontal **0** em 1024, 1440 e 1920; `AZUL, VERMELHA` →
175; Inverter `Sim` → 19; Redundante `Sim` → 16; celular em 375px continua com
175 cartões e nenhuma tabela. `node --test` **1073/1073** (7 casos novos, 4
reescritos porque o fato mudou — nenhum apagado).

## Fora de escopo

Popover de caixas de marcar no filtro (o `<datalist>` entrega "mais de um" sem
componente novo); cartão de celular; largura de coluna (D-3a6-14).
