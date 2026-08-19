---
quick_id: 260819-348
slug: mapa-legibilidade-agrupar-ativos-co-posi
date: 2026-08-19
status: complete
---

# Sumário — legibilidade do mapa

## O que foi medido (não suposto)

Com os 30 prédios posicionados: **195 marcadores em 51 pontos distintos**, maior pilha com
**24 ícones no mesmo pixel**; **12 rótulos** na tela, todos da planta do OSM, nenhum do
cadastro; painel de camadas aberto ocupando ~1/4 da largura; 7 seções da barra lateral abertas
ao mesmo tempo.

Os toggles de camada **funcionavam** — desligar Climatização removia 171 marcadores e religar
devolvia. O que não funcionava era *ver* o efeito.

## O que foi feito

1. **Agrupamento por ponto** (`agruparPorPonto`, núcleo puro) — coordenada exata, porque a
   pilha vem de coordenada idêntica (herança do prédio), não de proximidade.
2. **`mapa/xmap-marcadores.js`** — um desenho para as três camadas de ativo. Cor do grupo pelo
   **estado mais grave**; balão do grupo **lista** os ativos com link para a ficha.
3. **Rótulos permanentes** de prédio, zona e ativo/grupo, cortados por zoom via classe no
   contêiner do mapa.
4. **Barra lateral em `<details>`**, só Módulos e Edição abertas, contador em cada cabeçalho.
5. **Painel de camadas recolhido** por padrão, com cabeçalho próprio em português.
6. **Enquadramento no boot** com `animate: false`.

## Verificação

- `node --test`: **420/420** (novo gate `tests/mapa-legibilidade.test.js`).
- Conferido na tela: 56 marcadores, 66 rótulos (COMANDO, MUSEU, ELETRÔNICA, SALA DE ESTADO,
  SAÚDE, baixadao A, campo futebol…), zoom 17, "Camadas (10)" recolhido, balão de grupo real
  ("CENTRAL TELEFÔNICA · 2 ativos", linhas com link para `/fonoclama?ativo=2`).

## Achado que só a tela revelava

`fitBounds` animado **não acontece** quando a aba não está compondo quadros: a animação do
Leaflet roda em `requestAnimationFrame`. O mapa abria em zoom 15 sem erro nenhum. No boot não
há de onde animar, então o enquadramento passou a ser síncrono.

## Fora de escopo, de propósito

- Cluster por proximidade (dependência nova): resolveria um problema que não é o nosso e moveria
  o marcador de lugar.
- Unificar a barra de módulos com o painel de camadas: são dois controles com escopos
  diferentes (família de ativo × camada registrada). Vale rever, mas não sem decidir qual dos
  dois manda.
