---
quick_id: 260829-a8u
slug: menu-de-coluna-estilo-excel-com-ordenaca
status: complete
date: 2026-08-29
---

# Menu de coluna estilo Excel — e um defeito que já estava publicado

## O que entrou

A seta do cabeçalho virou um botão que abre um painel com **ordenar
crescente/decrescente/limpar**, **busca** dentro dos valores e a **lista de
marcar**. Coluna com filtro troca a seta por um funil.

Vale nas seis tabelas de computador — o desenhista é o mesmo.

## O achado, que é o mais importante deste arquivo

A regra do filtro de coluna existia em **duas cópias**, e a de
`filtrarInventario` era anterior ao filtro multivalor (D-8yc-08): não entendia a
vírgula. Com `AZUL, VERMELHA` ela procurava a subcadeia literal
`"azul, vermelha"` e devolvia **zero linha**, enquanto a mesma tela —
redesenhando só o `<tbody>` pelo caminho de `tabAplicar` — devolvia 175.

Ou seja: **o filtro multivalor entregue ontem só funcionava enquanto se
digitava.** Qualquer `renderInv()` completo — abrir uma ficha e voltar, trocar
de chip — esvaziava a tabela. Estava em produção desde a PR #32.

Agora é `tabCasaFiltro`: uma função, dois consumidores. Foi o menu que expôs
isto, porque ele redesenha a tabela inteira a cada clique.

## Decisões

- **O gatilho é a seta que já existia** (D-a8u-01). Somar um ícone por coluna
  custaria ~11px × 15 e desfaria o "cabe na tela" da task anterior. Clicar no
  rótulo continua ordenando em ciclo.
- **Um filtro, dois editores** (D-a8u-02). O menu edita a mesma string por
  coluna que a linha de campos edita; o estado das caixas é **derivado** dela,
  sem segunda fonte de verdade.
- **Tudo marcado é filtro vazio** (D-a8u-05); nada marcado é um termo que não
  casa com nada — a tabela esvazia, que é o que a pessoa pediu ao desmarcar
  tudo. Desmarcar a partir de "tudo" materializa "todos menos um", que é a única
  forma de isso existir numa string de termos.
- **A lista de marcar lê a seleção ANTES dos filtros de coluna** (D-a8u-04).
  Sobre a lista já filtrada, desmarcar um valor o apagaria da própria lista e
  não haveria caminho de volta.
- **O painel mora no `<body>`, `position:fixed`** (D-a8u-03) — dentro da tabela
  seria recortado pelo `overflow:auto`, o mesmo tipo de armadilha que matou o
  sticky em D-8yc-01.

## Verificação

- `node --test tests/*.test.js` → **1091/1091** (1073 antes + 18 novos).
- Navegador, 1440×900, cada passo conferido: abrir (AZUL✓ VERMELHA✓, 175) →
  desmarcar VERMELHA (84, filtro `"AZUL"`) → remarcar (175, filtro vazio) →
  desmarcar AZUL (91) → limpar todos (0) → marcar todos (175).
- Ordenação pelo menu (BTU desc → 360K no topo, `aria-sort=descending`,
  "Limpar ordenação" aparece só quando há ordem); busca dentro do menu em
  **125 locais** distintos → 19 com "sala de"; funil no cabeçalho da coluna
  filtrada; Esc, clique fora e segundo clique no gatilho fecham, devolvendo o
  foco; painel dentro da janela na última coluna (direita 1432 de 1440).
- Filtro do menu combina com o de texto: VERMELHA (91) + Prédio F21 = 23.
- Rolagem horizontal continua **0** (1337px em 1352px). Console sem erro.

## Fora de escopo

Cartão de celular (tabelas só existem ≥1024px); nenhuma das outras cinco tabelas
foi redesenhada à mão.
