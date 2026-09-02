---
quick_id: 260819-23e
slug: mapa-sala-herda-posicao-do-predio-cadeia
date: 2026-08-19
status: complete
---

# Sumário — sala herda a posição do prédio

## O que estava errado

Posicionar prédio não acendia quase nada. O banco explica: **175 dos 190 ativos apontam para
uma `sala`**, e a herança olhava só o `local_id` direto. As 132 salas ativas são todas filhas
de uma `edificacao` (árvore de profundidade 2: sala → prédio → OM). A tela pedia para
posicionar 132 salas, uma a uma, para acender o que 30 prédios acendem.

## O que foi feito

- Herança sobe a cadeia `parent_id` (`localAscendente`, núcleo puro, com guarda de ciclo — a
  coluna não tem restrição de aciclicidade no banco e um cadastro circular congelaria a aba
  sem erro nenhum). Duas subidas: de onde vem a posição, e qual local posicionar.
- `carregarLocaisComPosicao` → `carregarArvoreDeLocais`, sem o filtro por coordenada: o elo do
  meio (a sala) nunca tem lat/lon e precisa vir, senão a cadeia se rompe onde ia subir.
- `sala` sai da lista de posicionar (`TIPOS_QUE_HERDAM_POSICAO`, lista do que **herda**).
- **A coordenada da OM não é herdável** (`TIPOS_SEM_HERANCA`): a raiz tem coordenada, e subir
  até ela daria posição a 188 ativos num pino só — mapa dizendo "tudo localizado" e a lista de
  trabalho de campo esvaziando sozinha.
- Balão diz de onde a posição veio ("Herdada de COMANDO"). `xmap-layers-ativos.js` ganhou o
  `esc()` que não tinha e passou a escapar rótulo, detalhe e subtipo.

## Verificação

- `node --test`: **409/409** (novo gate `tests/mapa-heranca-posicao.test.js`, por comportamento).
- Contra o banco real, conferido na tela: 216 não localizados (bate com o SQL), 98 prédios na
  lista (sem sala nenhuma), ordenados por quantos ativos acendem — F21 19, PAIOL 16, MK48 12 —
  e um balão real dizendo "Herdada de COMANDO".
- Antes: 39 ativos posicionados. Depois: **54** (16 próprios + 38 herdados), sem ninguém sair
  a campo — só pelos dois prédios que já têm contorno.

## Efeito colateral aceito, não escondido

Os 9 ativos ligados **direto** na Organização Militar deixaram de ser exibidos: antes caíam no
ponto da OM, agora voltam para a lista de não localizados. É uma correção — eles nunca
estiveram naquele ponto —, e é o que devolve sentido à lista.
