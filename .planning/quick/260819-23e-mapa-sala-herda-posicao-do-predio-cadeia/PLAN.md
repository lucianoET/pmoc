---
quick_id: 260819-23e
slug: mapa-sala-herda-posicao-do-predio-cadeia
date: 2026-08-19
mode: quick
---

# Sala herda a posição do prédio; só prédio e área externa são posicionáveis

## O que o banco diz

| aponta para | ativos | locais distintos |
|---|---|---|
| `sala` | **175** | 132 |
| `Organizacao Militar` | 9 | 1 |
| `area_externa` | 3 | 2 |
| `edificacao` | 2 | 2 |
| `complexo_paiol` | 1 | 1 |

As 132 salas são **todas** filhas de `edificacao`, e a árvore tem profundidade máxima 2
(sala → edificação → CMASM). A herança de hoje olha **só o local direto**: um ativo ligado a
uma sala fica sem posição mesmo com o prédio dela posicionado. Ou seja, posicionar os 30
prédios acenderia **2 ativos**, não 177 — e a lista pedia para posicionar 132 salas, uma a uma.

## Decisões travadas

- **D-F** — a posição herdada sobe a cadeia `parent_id` até o primeiro ancestral com
  coordenada válida. `resolverPosicao` **não muda de contrato** (própria vence herdada): quem
  muda é quem escolhe o local a passar para ela.
- **D-G** — `sala` é o único tipo que **nunca** é oferecido para posicionar: ela existe dentro
  de um prédio. Lista fechada e invertida de propósito (o que herda, não o que posiciona): um
  tipo novo aparece na lista para alguém posicionar em vez de sumir em silêncio.
- **D-H** — sala já posicionada à mão continua valendo: posição própria da linha vence a
  herdada, e 4 salas já têm coordenada. Nada é apagado.
- **D-I** — a contagem "quantos ativos este prédio acende" passa a rolar para cima: o ativo
  ligado à sala conta para o prédio dela.

## Tarefas

1. `mapa/mapa-geometria.js` — núcleo puro: `TIPOS_QUE_HERDAM_POSICAO`, `herdaPosicao(tipo)` e
   `localAscendente(localId, locais, aceita)` (sobe `parent_id` com guarda de ciclo).
2. `mapa/mapa-dados.js` — `carregarLocaisComPosicao` vira `carregarArvoreDeLocais` (todos os
   locais ativos com `parent_id` e `tipo`, não só os que têm coordenada — sem os intermediários
   a cadeia não sobe); `posicionarAtivos` resolve o ancestral e anota de onde veio a posição e
   qual prédio posicionar; `carregarLocaisSemPosicao` deixa de listar sala.
3. `mapa/app.js` — contagem por ancestral posicionável; título e texto da seção.
4. `mapa/xmap-layers-*.js` — balão diz de qual local a posição foi herdada.
5. `tests/mapa-heranca-posicao.test.js` — gate por comportamento.
