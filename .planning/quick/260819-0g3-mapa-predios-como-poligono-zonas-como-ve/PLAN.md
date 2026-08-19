---
quick_id: 260819-0g3
slug: mapa-predios-como-poligono-zonas-como-ve
date: 2026-08-19
mode: quick
---

# Prédios como polígono, zonas como vegetação, controles do mapa reorganizados

## Problema observado

O usuário desenhou 7 zonas em `maq_areas`. **Duas delas são prédios** ("Predio Comando",
"Museu"): ele desenhou o contorno de edifício com a ferramenta de zona de serviço porque
é a única ferramenta de desenho que existe hoje. Prédio (`cmasm_locais`) só tem `lat`/`lon`
— um ponto —, então não havia como dar contorno a ele. As outras cinco são o que a zona
realmente é: vegetação e área externa (campo de futebol, calçada, baixadão, entorno).

Os controles do mapa se sobrepõem: o painel "Layers" (`.xmap-filters`, z-index 1000,
top/right 10) cobre os dois botões de modo do editor (controles Leaflet em `topright`,
z-index ~800) **e** o painel do editor (`#editor-painel`, z-index 900). Em tela estreita
a barra Mapa/Satélite (top, centralizada) colide com o botão ☰ Módulos.

## Decisões travadas

- **D-A** — prédio é polígono em `cmasm_locais.geom` (`jsonb`, mesma forma de
  `maq_areas.geom`), migração 37 aditiva. Não vira linha em `maq_areas`: D-03 diz que
  zona é auxiliar e temporária, prédio é local permanente da árvore de locais.
- **D-B** — gravar contorno grava `lat`/`lon` do **centroide** no mesmo `.update(`.
  A herança de posição (`resolverPosicao`) continua funcionando sem ser tocada, e não
  existe prédio com contorno e sem ponto.
- **D-C** — desenhar contorno de prédio usa `CARGOS_POSICAO` (mesma tabela que
  `salvarPosicaoLocal` escreve), não `CARGOS_ZONA` (que espelha a policy de `maq_areas`).
- **D-D** — zona de `maq_areas` é vegetação/área externa: o estilo passa a sair de
  `flora` (lista fechada da migração 25), não do vocabulário legado
  jardim/bosque/canteiro/horta, que nunca existiu no banco deste projeto.
- **D-E** — os dois botões de modo saem dos controles Leaflet e vão para a barra lateral;
  o desenho de contorno de prédio usa `new L.Draw.Polygon(mapa).enable()` direto, sem
  adicionar barra de ferramentas nova sobre o mapa.

## Tarefas

1. `supabase/37_locais_geometria.sql` — `cmasm_locais.geom jsonb` (aditiva, sem `drop`).
2. `mapa/mapa-geometria.js` — `centroidePoligono(coords)` no núcleo puro (sem API de navegador).
3. `mapa/mapa-dados.js` — `carregarLocaisComGeom()` e `salvarGeomLocal(id, geom)` (grava
   `geom` + centroide num `.update(` só, valida envelope antes da rede; toca só `cmasm_locais`).
4. `mapa/xmap-layers-predios.js` — camada de exibição dos contornos, módulo `predios`.
5. `mapa/mapa-editor.js` — `posDesenharPredio(id)`: desenho de polígono sob demanda,
   `CARGOS_POSICAO`; botões de modo migrados para a barra lateral.
6. `mapa/app.js` + `mapa/index.html` — botão "Contorno" na lista de prédios, seção de
   edição na barra, módulo `predios` ligado no primeiro desenho.
7. `mapa/xmap-layers-grama.js` — estilo de zona por `flora`, rótulo de vegetação/área externa.
8. `mapa/index.html` — reposicionamento dos controles (D-E).
9. `tests/mapa-predios.test.js` — gate: centroide por comportamento, porta única de escrita,
   migração aditiva, botões de modo fora dos controles Leaflet.

## Verificação

`node --test` inteiro verde; migração 37 aplicada e conferida no banco; desenho de um
contorno real gravando `geom` + centroide.
