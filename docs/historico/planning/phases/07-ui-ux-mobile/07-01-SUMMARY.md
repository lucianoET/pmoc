# 07-01 — Responsividade de celular na base compartilhada

**Executado:** 2026-08-18
**Commit:** `ce82203`
**Suíte:** 135 → 144 testes, zero falhas

## O que mudou

| Arquivo | Mudança |
|---------|---------|
| `shared/pmoc.css` | Faixa `@media(max-width:480px)` nova: campos a 16px, barra superior de altura livre sem o link do portal, `.nav-btn` com 44px de alvo de toque, KPIs em coluna única, modal e conteúdo com folga menor |
| `shared/auth.js` | Os três campos de digitação da tela de login sobem de 14px para 16px |
| `mapa/index.html` | `#editor-painel` de `300px` para `min(300px,90vw)` |
| `tests/mobile-375.test.js` | Gate permanente, 9 casos |
| `TESTES.md` | Roteiro manual de 375 px, com a tabela de não regressão de `maquinas`/`transportes` |

## O que o scout mudou no plano

A fase estava dimensionada como "4 módulos sem tratamento responsivo". Na leitura do código,
`eletrica` e `fonoclama` não têm **uma linha** de CSS própria e `predial` tem uma (`min-height`
de um campo de texto) — o chrome inteiro dos quatro vem de `shared/pmoc.css`. O trabalho virou
3 arquivos em vez de 4 módulos, e de quebra melhorou `maquinas` e `transportes`.

## Descoberto durante a execução

- **Os campos do login escapavam da folha comum.** Medindo no navegador, três campos continuavam
  em 14px depois da regra de `@media`: são montados por `shared/auth.js` com estilo embutido, que
  vence a folha por especificidade. É a primeira tela que o usuário toca — teria levado zoom do
  iOS antes de ver módulo algum. Corrigido no arquivo e coberto por um caso próprio no gate.
- **Padding sozinho não dava 44px.** `padding:12px` + linha de texto de 13px resultou em 41px
  medidos. Entrou `min-height:44px` explícito, e o gate passou a exigir isso em vez de fazer a
  conta pelo padding.
- **Tabelas já estavam todas embrulhadas.** A contagem inicial sugeria 11 tabelas soltas em
  `maquinas`/`transportes`; era falha da expressão de busca — o `.tbl-wrap` está na linha
  anterior. Nenhuma correção foi necessária, e o gate agora afirma isso para as tabelas futuras.

## Evidência

Medido no navegador em 375×812, com a sessão autenticada e o app renderizado:

- `document.documentElement.scrollWidth == 375` em `/eletrica`, `/fonoclama`, `/predial`,
  `/mapa`, `/maquinas` e `/transportes` — nenhuma rolagem horizontal de página (critério 1 e 5)
- Nenhuma `table.tbl` ultrapassando a borda de 375px; nenhum `.tbl-wrap` empurrando a página
  (critério 2)
- `.nav-btn` com 44px de altura (critério 4)

O que **não** foi provado neste ambiente: preencher e salvar um modal num iOS real (critério 3) —
está no roteiro de `TESTES.md`. O que se podia provar estaticamente virou gate.

## Requisitos

PLAT-06, PLAT-07, PLAT-15, PLAT-16.
