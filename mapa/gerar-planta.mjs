#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// gerar-planta.mjs — conversor de extrato OSM em planta vetorial estática
// ════════════════════════════════════════════════════════════════════════
//
// (1) O que é e por quê. O mapa do módulo `/mapa` precisa desenhar a área
//     do CMASM com a rede desligada (critério de sucesso 9, PLAT-19). A
//     fonte já está em mãos: um extrato `.osm` local da área. Este script
//     converte esse extrato num GeoJSON pequeno e estático, que o Leaflet
//     abre sem nenhuma requisição de rede.
//
// (2) Licença. O extrato `.osm` é dado ODbL (OpenStreetMap and
//     contributors, http://opendatacommons.org/licenses/odbl/1-0/). Usar
//     o dado bruto como dado — lendo o arquivo do disco e convertendo — é
//     diferente de baixar tiles do serviço público de tiles, que é o que a
//     política de uso do OpenStreetMap Foundation proíbe (ver
//     mapa/tiles/GERAR-TILES.md). A atribuição viaja com o resultado, na
//     chave `metadados.atribuicao` do GeoJSON gerado.
//
// (3) Sem rede. Este script não faz nenhuma requisição de rede: ele só lê
//     um arquivo do disco (`node:fs`) e escreve outro. Conferido por gate
//     estático em `tests/mapa-base-offline.test.js` e no `<verify>` do
//     plano que o criou (10-04): nenhuma linha de `import` referencia
//     módulo de requisição, e não há chamada de busca em rede no código.
//
// (4) Como rodar. Não é passo de build — o projeto não tem build. Roda uma
//     vez, à mão, e o resultado (`mapa/planta-cmasm.geojson`) é commitado:
//
//       node mapa/gerar-planta.mjs <caminho-do-extrato.osm> [caminho-de-saida.geojson]
//
//     Rodar de novo com o mesmo extrato produz um arquivo idêntico byte a
//     byte (saída determinística — sem timestamp de geração, sem ordem
//     dependente da ordem de iteração de objeto).
// ════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* ── Escopo do arquivo — lista fechada de etiquetas aceitas ──
   Entram só o desenho da área: edificação, via, curso de água, uso do
   solo, elemento natural, elemento construído, barreira e local. Tudo o
   mais do extrato é descartado — o objetivo é o desenho da área, não uma
   cópia do extrato inteiro (quem quiser o extrato tem o .osm). A ordem
   desta lista é a ordem de prioridade usada para escolher a "chave
   principal" de um elemento com mais de uma etiqueta aceita. */
const CHAVES_ACEITAS = [
  'building',   // edificação
  'waterway',   // curso de água
  'natural',    // elemento natural
  'landuse',    // uso do solo
  'man_made',   // elemento construído
  'barrier',    // barreira
  'highway',    // via
  'place',      // local
];

/* Etiquetas cujo caminho fechado vira polígono (edificação, uso do solo,
   elemento natural, elemento construído — convenção de "área" do próprio
   OSM). Via, curso de água, barreira e local nunca viram polígono aqui,
   mesmo quando o caminho é fechado — continuam linha. */
const CHAVES_DE_AREA = new Set(['building', 'landuse', 'natural', 'man_made']);

/* ── Utilitários de texto ── */

function desescaparXml(texto) {
  return texto
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function arredondar6(valor) {
  return Math.round(valor * 1e6) / 1e6;
}

/* Extrai a "chave principal" e o "valor" de um objeto de etiquetas, na
   ordem de prioridade de CHAVES_ACEITAS. Devolve null se nenhuma etiqueta
   aceita estiver presente — o elemento é descartado pelo chamador. */
function chavePrincipal(tags) {
  for (const chave of CHAVES_ACEITAS) {
    if (tags[chave]) return { chave, valor: tags[chave] };
  }
  return null;
}

/* ── Passagem 1: pontos ──
   Cada ponto do extrato traz identificador, latitude e longitude. Guarda
   num mapa de identificador → [lat, lon], com a coordenada arredondada a
   seis casas decimais (cerca de 11 cm no terreno — muito acima da precisão
   necessária, e que corta o arquivo pela metade). Também devolve, para
   cada ponto, as etiquetas que ele carrega (usadas na Passagem 3). */
function lerPontos(textoOsm) {
  const coordenadas = new Map();   // id → [lat, lon]
  const etiquetasPorPonto = new Map(); // id → { chave: valor, ... }

  const reNode = /<node\s+([^>]*?)(\/>|>([\s\S]*?)<\/node>)/g;
  let m;
  while ((m = reNode.exec(textoOsm))) {
    const atributos = m[1];
    const corpo = m[3];
    const id = /\bid="(\d+)"/.exec(atributos)?.[1];
    const lat = /\blat="(-?\d+\.?\d*)"/.exec(atributos)?.[1];
    const lon = /\blon="(-?\d+\.?\d*)"/.exec(atributos)?.[1];
    if (!id || lat === undefined || lon === undefined) continue;

    coordenadas.set(id, [arredondar6(Number(lat)), arredondar6(Number(lon))]);

    if (corpo) {
      const tags = lerEtiquetas(corpo);
      if (Object.keys(tags).length) etiquetasPorPonto.set(id, tags);
    }
  }
  return { coordenadas, etiquetasPorPonto };
}

function lerEtiquetas(corpo) {
  const tags = {};
  const reTag = /<tag\s+k="([^"]*)"\s+v="([^"]*)"\s*\/>/g;
  let t;
  while ((t = reTag.exec(corpo))) {
    tags[desescaparXml(t[1])] = desescaparXml(t[2]);
  }
  return tags;
}

/* ── Passagem 2: caminhos ──
   Cada caminho tem uma sequência de referências a ponto e um conjunto de
   etiquetas. Resolve as referências pelo mapa da Passagem 1. Um caminho
   cujo primeiro e último ponto coincidem e cuja chave principal é uma
   etiqueta de área (CHAVES_DE_AREA) vira polígono; os demais viram linha.
   Caminhos sem etiqueta aceita, ou com referência a ponto ausente do
   extrato, são descartados. */
function lerCaminhos(textoOsm, coordenadas) {
  const caminhos = [];
  const reWay = /<way\s+([^>]*?)>([\s\S]*?)<\/way>/g;
  let m;
  while ((m = reWay.exec(textoOsm))) {
    const id = /\bid="(\d+)"/.exec(m[1])?.[1];
    const corpo = m[2];
    if (!id) continue;

    const tags = lerEtiquetas(corpo);
    const principal = chavePrincipal(tags);
    if (!principal) continue; // fora do escopo — nenhuma etiqueta aceita

    const refs = [...corpo.matchAll(/<nd\s+ref="(\d+)"\s*\/>/g)].map((r) => r[1]);
    if (refs.length < 2) continue; // caminho degenerado, sem geometria útil

    const pontos = refs.map((r) => coordenadas.get(r));
    if (pontos.some((p) => !p)) continue; // referência a ponto ausente

    const fechado = refs[0] === refs[refs.length - 1];
    const ehPoligono = fechado && CHAVES_DE_AREA.has(principal.chave);

    caminhos.push({
      idOrigem: id,
      tipoOrigem: 'way',
      geometry: ehPoligono
        ? { type: 'Polygon', coordinates: [pontos.map(([lat, lon]) => [lon, lat])] }
        : { type: 'LineString', coordinates: pontos.map(([lat, lon]) => [lon, lat]) },
      properties: propriedades(principal, tags),
    });
  }
  return caminhos;
}

/* ── Passagem 3: pontos com nome ──
   Pontos que tenham etiqueta de nome e uma etiqueta de classificação
   aceita (CHAVES_ACEITAS) viram ponto nomeado, para as legendas do
   terreno. Pontos sem nome, ou cuja única etiqueta seja fora do escopo,
   não entram. */
function lerPontosNomeados(etiquetasPorPonto, coordenadas) {
  const pontos = [];
  for (const [id, tags] of etiquetasPorPonto) {
    if (!tags.name) continue;
    const principal = chavePrincipal(tags);
    if (!principal) continue;

    const [lat, lon] = coordenadas.get(id);
    pontos.push({
      idOrigem: id,
      tipoOrigem: 'node',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: propriedades(principal, tags),
    });
  }
  return pontos;
}

function propriedades(principal, tags) {
  const props = { chave: principal.chave, valor: principal.valor };
  if (tags.name) props.nome = desescaparXml(tags.name);
  return props;
}

/* ── Limites geográficos do extrato (elemento <bounds>) ── */
function lerLimites(textoOsm) {
  const m = /<bounds\s+minlat="([^"]+)"\s+minlon="([^"]+)"\s+maxlat="([^"]+)"\s+maxlon="([^"]+)"/.exec(
    textoOsm
  );
  if (!m) return null;
  return {
    minlat: Number(m[1]),
    minlon: Number(m[2]),
    maxlat: Number(m[3]),
    maxlon: Number(m[4]),
  };
}

/* ── Conversão principal ── */
function converter(textoOsm, nomeExtrato) {
  const { coordenadas, etiquetasPorPonto } = lerPontos(textoOsm);
  const caminhos = lerCaminhos(textoOsm, coordenadas);
  const pontosNomeados = lerPontosNomeados(etiquetasPorPonto, coordenadas);

  /* Saída determinística: ordena por tipo de origem e depois por
     identificador de origem (numérico), para que rodar de novo com o
     mesmo extrato produza um arquivo idêntico e o histórico do
     repositório não fique cheio de diferença de ordenação. */
  const todas = [...caminhos, ...pontosNomeados].sort((a, b) => {
    if (a.tipoOrigem !== b.tipoOrigem) return a.tipoOrigem < b.tipoOrigem ? -1 : 1;
    return Number(a.idOrigem) - Number(b.idOrigem);
  });

  const features = todas.map(({ geometry, properties, idOrigem }) => ({
    type: 'Feature',
    id: Number(idOrigem),
    properties,
    geometry,
  }));

  const limites = lerLimites(textoOsm);
  const contagem = {
    total: features.length,
    poligonos: features.filter((f) => f.geometry.type === 'Polygon').length,
    linhas: features.filter((f) => f.geometry.type === 'LineString').length,
    pontos: features.filter((f) => f.geometry.type === 'Point').length,
  };

  return {
    type: 'FeatureCollection',
    metadados: {
      atribuicao:
        '© OpenStreetMap contributors, dado ODbL — http://opendatacommons.org/licenses/odbl/1-0/',
      extrato_origem: nomeExtrato,
      limites,
      contagem,
    },
    features,
  };
}

/* ── CLI ── */
function main() {
  const [, , caminhoExtrato, caminhoSaida] = process.argv;
  if (!caminhoExtrato) {
    console.error('Uso: node mapa/gerar-planta.mjs <caminho-do-extrato.osm> [caminho-de-saida.geojson]');
    process.exit(1);
  }

  const aquiDir = dirname(fileURLToPath(import.meta.url));
  const saida = caminhoSaida || join(aquiDir, 'planta-cmasm.geojson');

  const textoOsm = readFileSync(caminhoExtrato, 'utf8');
  const nomeExtrato = caminhoExtrato.split('/').pop();
  const planta = converter(textoOsm, nomeExtrato);

  writeFileSync(saida, JSON.stringify(planta, null, 2) + '\n', 'utf8');
  console.log(
    `planta gerada: ${saida} — ${planta.metadados.contagem.total} feições ` +
      `(${planta.metadados.contagem.poligonos} polígonos, ` +
      `${planta.metadados.contagem.linhas} linhas, ` +
      `${planta.metadados.contagem.pontos} pontos)`
  );
}

main();
