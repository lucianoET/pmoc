---
quick_id: 260819-4wn
slug: maquinas-tabela-de-areas-com-edicao-filt
date: 2026-08-19
status: complete
---

# Sumário — tabela de áreas com edição, filtro e ordenação

## O que era

A tabela "Áreas de serviço" (aba OS de Máquinas) era **só leitura**: o modal só inseria, e as
16 linhas saíam sempre na mesma ordem, sem filtro. Enquanto isso, o Estoque e as três tabelas
de /reparos já tinham ordenação e filtro por coluna vindos de `shared/tabela.js`.

## O que foi feito

- **`maquinas/areas-tabela.js`** — terceiro consumidor do núcleo genérico, e a prova de que
  ele é genérico: **nenhuma linha de `shared/tabela.js` mudou**. Como no Estoque, aqui mora só
  a definição de colunas mais os wrappers que a injetam.
- **Ordenação e filtro por coluna** (⇅ e ⌕ no cabeçalho), com `aria-sort`; `tipo:'numero'` em
  dimensão e periodicidade, texto no resto; não informado sempre no fim, nas duas direções.
- **Edição pelo `⚙`** de cada linha: o mesmo formulário insere e atualiza, escolhido pelo id em
  edição. Gate por `podeEditarAreas()` — que **espelha a policy real** de `maq_areas`
  (migração 12: admin, gestor). Diferente do gate do cadastro de material, este não é só de
  tela: o banco recusa técnico e observador de qualquer forma. É a mesma lista que
  `mapa/mapa-editor.js#CARGOS_ZONA` usa, pela mesma razão — a tabela é a mesma.
- **A dimensão derivada do contorno não é regravada pela tela.** Zona desenhada no /mapa tem
  `area_m2` recalculada a cada gravação da geometria; o campo fica travado, a tela diz por quê
  e o valor **não entra no payload**. Sem isso, um número digitado sobreviveria até o próximo
  ajuste do contorno e sumiria sem aviso.
- Marca **MAPA** na célula de dimensão, filtrável: procurar "mapa" isola as zonas cuja área
  veio do polígono.
- Metro quadrado passou a ser exibido **sem casas decimais**, como no /mapa — a área vem do
  cálculo geodésico e chegava como "5.392,806 m²".

## Verificação

- `node --test`: **445/445** (novo gate `tests/areas-tabela-maquinas.test.js`).
- Na tela, com dado real (16 áreas, todas com contorno): ordenação por dimensão invertendo
  exatamente, filtro "campo" → 2 de 16, filtro sem acento ("praca" achando "Praça"), foco indo
  para o campo da coluna ao abrir a linha de filtro, e **nenhum botão de edição para o
  observador**.

## Fora de escopo, de propósito

- **Flora, inclinação e limpeza** continuam sendo editadas no /mapa, onde se vê o terreno —
  não no formulário de cadastro.
- **Arquivar área pela tabela**: o projeto arquiva (`ativo = false`), mas expor isso aqui é
  decisão de produto, não consequência deste pedido.
