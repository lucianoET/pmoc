---
quick_id: 260819-348
slug: mapa-legibilidade-agrupar-ativos-co-posi
date: 2026-08-19
mode: quick
---

# Legibilidade do mapa: pilha de marcadores, rótulos, barra lateral e painel de camadas

## Medido na tela, não suposto

Depois de o usuário posicionar os 30 prédios: **195 marcadores em 51 pontos distintos**, maior
pilha com **24 ícones no mesmo pixel** (F21 19, PAIOL 16, MK48 12). 27 dos 51 pontos são
pilhas. Os toggles de camada **funcionam** (desligar Climatização tira 171 marcadores e
religar devolve) — o que não funciona é *ver* o efeito, porque o amontoado continua igual.

Rótulos permanentes na tela: **12**, todos da planta OSM (ETE, CAV, CB01…). Prédio e zona do
cadastro só mostram nome ao passar o cursor, e ativo nenhum mostra nome.

Painel "Layers": 10 itens soltos, sem agrupamento, ocupando ~1/4 da largura da tela.

Barra lateral: 7 seções empilhadas, todas abertas ao mesmo tempo.

## Decisões travadas

- **D-J** — ativos no mesmo ponto viram **um marcador com contagem**, por camada. Sem
  dependência nova (Leaflet.markercluster ficaria de fora): o agrupamento é por coordenada
  exata, que é o caso real — a pilha existe porque todos herdam o ponto do mesmo prédio, não
  porque estão "perto".
- **D-K** — o marcador de grupo abre a **lista dos ativos** dele; um ativo sozinho continua
  abrindo o balão de sempre. Ninguém perde acesso ao ativo por causa do agrupamento.
- **D-L** — rótulo de cadastro (prédio, zona, grupo de ativos) é tooltip **permanente**,
  escondido por CSS abaixo do zoom de detalhe. A alternativa — ligar/desligar tooltip por
  evento — mexeria em cada camada; a classe no contêiner do mapa é uma linha e vale para todas.
- **D-M** — a barra lateral vira seções colapsáveis (`<details>`), só "Módulos" aberta, com
  contador no cabeçalho de cada uma.
- **D-N** — `mapa/xmap.js` e `mapa/xmap.css` continuam intocados. O painel de camadas é
  compactado e recolhido por CSS/JS do módulo.

## Tarefas

1. `mapa/mapa-geometria.js` — `agruparPorPonto(ativos)` no núcleo puro.
2. `mapa/xmap-layers-ativos.js`, `-grama.js`, `-eletrica.js` — desenhar grupo com contagem,
   balão de lista, rótulo permanente.
3. `mapa/xmap-layers-predios.js` — rótulo permanente do prédio.
4. `mapa/index.html` — barra lateral em `<details>`, painel de camadas compacto/recolhível,
   CSS dos rótulos por zoom.
5. `mapa/app.js` — classe de zoom no contêiner, contadores nos cabeçalhos, botão de recolher
   camadas, zoom inicial enquadrando o CMASM.
6. `tests/mapa-legibilidade.test.js` — gate por comportamento do agrupamento.
