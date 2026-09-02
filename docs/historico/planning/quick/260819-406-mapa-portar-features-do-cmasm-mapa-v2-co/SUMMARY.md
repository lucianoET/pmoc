---
quick_id: 260819-406
slug: mapa-portar-features-do-cmasm-mapa-v2-co
date: 2026-08-19
status: complete
---

# Sumário — features portadas do cmasm-mapa-v2

Referência: `/home/luc/DEV_reference_readonly/cmasm-mapa-v2 (2).html` (somente leitura, não
modificada). MapLibre GL + mapbox-gl-draw contra Leaflet + leaflet-draw com `xmap.js` travado —
o que se porta é **função, não código**.

## Entrou

| Referência | Aqui |
|---|---|
| `#coordBar` | faixa no alto: LAT/LON com 6 casas + zoom, some abaixo de 820 px |
| `ScaleControl` | `L.control.scale` métrica, canto inferior esquerdo (a barra de basemap subiu 26 px) |
| `exportGeoJSON()` | `mapa/mapa-exportar.js` — ativos, zonas e contornos; **269 feições** no banco atual |
| `toast()` | aviso curto no rodapé do mapa; a instrução do editor deixou de ser `alert()` |
| slider de opacidade por camada | **uma** opacidade global, em polígono/marcador/rótulo, nunca no tile |
| overlay de planta | `mapa/mapa-planta.js` — `L.imageOverlay` **georreferenciado**, com encaixe manual |

## O que ficou melhor que o original

O overlay da referência é um `<img>` posicionado por `transform` de CSS: ele **não acompanha o
mapa**. Arrastar move o mapa e deixa a planta parada — serve para olhar, não para desenhar por
cima. Aqui é `L.imageOverlay` amarrado a coordenadas, com "Encaixar aqui" prendendo a imagem
nos limites atuais. É o que permite traçar o contorno de um prédio sobre a planta escaneada.

## O detalhe que o teste existe para pegar

`geom` guarda `[lat, lon]` (ordem do Leaflet); GeoJSON (RFC 7946) exige `[lon, lat]`. Trocado,
**não dá erro em lugar nenhum** — só põe o CMASM na Antártida quando o arquivo abre no QGIS.
O anel do polígono também é fechado na exportação, porque o desenho do Leaflet não repete o
primeiro vértice.

## Ficou de fora, com motivo

- **Basemap TOPO** — a lista de basemaps mora em `mapa/xmap.js`, travado (D-01/D-02).
- **Rotação (N↑/↻/↺) e pitch 3D** — Leaflet 1.9 não gira nem inclina; exigiria trocar o
  componente por MapLibre, que é a reescrita que o porte do xMap evitou.
- **Paleta de símbolos com elemento avulso** — ativo no pmoc vem de uma das cinco tabelas;
  elemento que só existe no mapa não tem cadastro, não tem OS e não tem dono.
- **Painel de propriedades, lista de elementos, modal 3D** — já existem em equivalente
  (barra lateral, balão, ficha do módulo); o modal 3D da referência é placeholder vazio.
- **Atalho Delete** — o projeto arquiva (`ativo = false`), nunca apaga.

## Verificação

- `node --test`: **430/430** (novo gate `tests/mapa-referencia-v2.test.js`).
- Na tela, com dado real: escala "200 m"; coordenada `LAT -22.839554 LON -43.109153 · Z 16.0`;
  export com 256 ativos + 8 zonas + 5 prédios, longitude primeiro, anel fechado; opacidade 40%
  em polígono e marcador com o tile intocado.
