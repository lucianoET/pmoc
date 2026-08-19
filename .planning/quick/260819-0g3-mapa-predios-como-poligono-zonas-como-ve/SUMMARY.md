---
quick_id: 260819-0g3
slug: mapa-predios-como-poligono-zonas-como-ve
date: 2026-08-19
status: complete
---

# Sumário — prédio como polígono, zona como vegetação, controles reorganizados

## O que estava errado

O banco contava a história: das 7 zonas desenhadas em `maq_areas`, **duas eram prédios**
("Predio Comando", "Museu"). Não foi engano de cadastro — era a única ferramenta de desenho
que existia. Prédio (`cmasm_locais`) tinha `lat`/`lon` e nada mais, um ponto. O efeito
colateral: 2.253 m² de Comando entrando na conta de área de corte de grama.

Nos controles, três sobreposições reais: o painel "Layers" (z-index 1000, canto superior
direito) cobria os dois botões de modo do editor (controles Leaflet no **mesmo canto**, abaixo
na pilha) e o painel do editor (z-index 900); a barra Mapa/Satélite colidia com ☰ Módulos em
tela estreita.

## O que foi feito

1. **`cmasm_locais.geom`** (migração 37, aditiva, aplicada e conferida em produção) —
   contorno no mesmo formato de `maq_areas.geom`, com `check` de forma na coluna nova.
2. **`centroidePoligono`** no núcleo puro — centroide de área, não média de vértices.
   `salvarGeomLocal` grava contorno e centroide **no mesmo `update`**: `resolverPosicao` lê o
   ponto, então contorno sem ponto apagaria os ativos que herdam do prédio.
3. **Camada Prédios** (`xmap-layers-predios.js`), ligada no primeiro desenho, cor de
   edificação, fora da paleta de estado — prédio não opera nem entra em manutenção.
4. **Botão "Contorno"** ao lado de "Ponto" em cada prédio sem posição; desenho por
   `L.Draw.Polygon` direto, sem barra de ferramentas nova. Cargo: `CARGOS_POSICAO`.
5. **Zona = vegetação e área externa**: cor por `flora` (lista fechada da migração 25) e não
   pelo dicionário legado jardim/bosque/canteiro, que nunca existiu neste banco.
6. **Controles**: modos do editor para a barra lateral (seção Edição), painel "Layers" recuando
   quando o editor abre, barra de basemap no canto inferior esquerdo, chips de módulo ocultos.
   Tudo em CSS do módulo — `mapa/xmap.js` e `mapa/xmap.css` intocados.

## Verificação

- `node --test`: **400/400**.
- Migração 37 aplicada em produção e conferida (coluna + `check`).
- Caminho de escrita exercido com dado real: contorno do Comando gravado no local 302
  (8 vértices, centroide −22,8395545 / −43,1091537, 2.253 m²); locais ativos sem posição
  caíram de 227 para 226.
- Roteiro manual em `TESTES.md`.

## Dois gates alterados, por mudança de fato

- `MODULOS_INICIAIS` ganhou `predios`.
- "toda camada usa `corDoEstado`" virou a asserção **inversa** para a camada de prédio: exigir
  cor de estado de uma edificação criaria uma leitura que o polígono não tem.

## O que ficou de fora, de propósito

- **Redesenhar o contorno de um prédio que já tem um**: o caminho de entrada é a lista
  "Prédios sem posição", e o prédio sai dela ao ganhar coordenada. Falta um caminho pelo
  próprio polígono.
- **Converter as duas zonas que são prédios** ("Predio Comando", "Museu"): é dado do usuário,
  não do código. Museu nem tem linha correspondente em `cmasm_locais`.
- **Recarregar a camada de prédios sem recarregar a página** depois de gravar um contorno: a
  camada é registrada uma vez no boot; recarregar a página perderia o estado do mapa.
