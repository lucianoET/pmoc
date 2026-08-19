---
quick_id: 260819-406
slug: mapa-portar-features-do-cmasm-mapa-v2-co
date: 2026-08-19
mode: quick
---

# Portar features do cmasm-mapa-v2 para o /mapa

Referência: `/home/luc/DEV_reference_readonly/cmasm-mapa-v2 (2).html` (somente leitura).
Ela é MapLibre GL + mapbox-gl-draw; o /mapa é Leaflet + leaflet-draw, com `mapa/xmap.js`
travado. Portanto o que se porta é **função**, não código.

## Entra

| Feature da referência | Como entra no /mapa |
|---|---|
| `#coordBar` — LAT/LON sob o cursor | faixa no alto do mapa, com zoom junto (mousemove + zoomend) |
| `ScaleControl` métrico | `L.control.scale`, canto inferior esquerdo |
| `exportGeoJSON()` | exporta ativos posicionados + zonas + contornos de prédio, do que já está em memória |
| `toast()` | avisos informativos do editor deixam de ser `alert()` que bloqueia o clique seguinte |
| opacidade por camada (slider) | **uma** opacidade global das camadas, na barra lateral |
| overlay de planta (opacidade/escala/rotação, drag&drop) | `L.imageOverlay` georreferenciado nos limites da tela, com opacidade, reenquadrar e remover |

## Fica de fora, com motivo

- **Basemap TOPO** — a lista de basemaps mora em `mapa/xmap.js`, arquivo travado (D-01/D-02).
  Entra junto da primeira mudança autorizada naquele arquivo.
- **Rotação (N↑/↻/↺) e pitch 3D** — Leaflet 1.9 não gira nem inclina o mapa; exigiria trocar
  o componente por MapLibre, que é a reescrita que o porte do xMap evitou.
- **Paleta de símbolos + inserir elemento avulso** — no pmoc o ativo vem de uma das cinco
  tabelas do banco; elemento criado só no mapa não tem cadastro, não tem OS e não tem dono.
  Contraria a arquitetura, não é falta de tempo.
- **Painel de propriedades / lista de elementos / modal 3D** — já existem em equivalente
  (barra lateral + balão + ficha do módulo); o modal 3D da referência é um placeholder vazio.
- **Atalho Delete** — o projeto arquiva (`ativo = false`), nunca apaga.

## Tarefas

1. `mapa/mapa-exportar.js` — núcleo puro `montarGeoJSON()` (converte `[lat,lon]` → `[lon,lat]`) + download.
2. `mapa/mapa-planta.js` — planta de referência (imageOverlay, opacidade, reenquadrar, remover, drag&drop).
3. `mapa/app.js` + `mapa/index.html` — faixa de coordenadas, escala, toast, opacidade global,
   seção "Planta de referência" e botão de exportar.
4. `mapa/mapa-editor.js` — avisos informativos passam a usar o toast.
5. `tests/mapa-referencia-v2.test.js` — gate por comportamento do GeoJSON.
