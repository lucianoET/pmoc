const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do quick-260819-406 — features portadas de
// DEV_reference_readonly/cmasm-mapa-v2 (2).html.
//
// A referência é MapLibre + mapbox-gl-draw; o /mapa é Leaflet com
// mapa/xmap.js travado. O que se porta é função, não código, e o que este
// arquivo trava é o único pedaço com uma resposta certa e uma errada
// indistinguíveis a olho: a ORDEM das coordenadas no GeoJSON. `geom` guarda
// [lat, lon] (ordem do Leaflet) e o RFC 7946 exige [lon, lat]. Exportar
// trocado não dá erro em lugar nenhum — só põe a base do CMASM na
// Antártida quando o arquivo abrir no QGIS.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const MAPA = path.join(RAIZ, 'mapa')
const APP = path.join(MAPA, 'app.js')
const INDEX_HTML = path.join(MAPA, 'index.html')
const EDITOR = path.join(MAPA, 'mapa-editor.js')
const PLANTA = path.join(MAPA, 'mapa-planta.js')
const EXPORTAR = path.join(MAPA, 'mapa-exportar.js')

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

const ZONA = {
  id: 'z1',
  nome: 'Campo futebol A',
  tipo: 'corte',
  flora: 'gramado',
  area_m2: 1234,
  geom: [
    [-22.8400, -43.1100],
    [-22.8400, -43.1090],
    [-22.8390, -43.1090],
  ],
}

// ── 1. ordem das coordenadas ────────────────────────────────────────────
test('o GeoJSON sai em [lon, lat], não na ordem do Leaflet', async () => {
  const { montarGeoJSON } = await import('../mapa/mapa-exportar.js')
  const { features } = montarGeoJSON({
    posicionados: [{ id: 7, lat: -22.8395, lon: -43.1091, rotulo: 'AC-01', origemModulo: 'climatizacao' }],
  })
  assert.equal(features.length, 1)
  assert.deepEqual(features[0].geometry.coordinates, [-43.1091, -22.8395])
  // A longitude do CMASM é ~-43; a latitude ~-22. Se sair trocado, o
  // primeiro número passa a ser -22 — e é isso que esta asserção pega.
  assert.ok(features[0].geometry.coordinates[0] < -43, 'a longitude deveria vir primeiro')
})

test('o anel do polígono é fechado na exportação — o Leaflet não repete o primeiro vértice', async () => {
  const { montarGeoJSON } = await import('../mapa/mapa-exportar.js')
  const [feicao] = montarGeoJSON({ zonas: [ZONA] }).features
  const anel = feicao.geometry.coordinates[0]
  assert.equal(anel.length, 4, 'três vértices desenhados viram quatro posições no anel')
  assert.deepEqual(anel[0], anel[anel.length - 1], 'o anel precisa fechar (RFC 7946)')
  assert.deepEqual(anel[0], [-43.11, -22.84], 'e continuar em [lon, lat]')
})

test('geometria inválida é descartada, nunca exportada torta', async () => {
  const { montarGeoJSON } = await import('../mapa/mapa-exportar.js')
  const { features } = montarGeoJSON({
    posicionados: [{ id: 1, lat: null, lon: null }],
    zonas: [{ nome: 'sem contorno', geom: null }, { nome: 'traço', geom: [[-22.84, -43.11], [-22.83, -43.10]] }],
    predios: [{ nome: 'ok', geom: ZONA.geom }],
  })
  assert.equal(features.length, 1)
  assert.equal(features[0].properties.camada, 'predio')
})

test('cada feição diz de que camada veio e carrega o que identifica a linha', async () => {
  const { montarGeoJSON } = await import('../mapa/mapa-exportar.js')
  const { features } = montarGeoJSON({
    posicionados: [{ id: 7, lat: -22.8395, lon: -43.1091, rotulo: 'AC-01', origemModulo: 'climatizacao', estado: 'operante', origemPosicao: 'herdada', localPosicao: 'COMANDO' }],
    zonas: [ZONA],
    predios: [{ id: 302, codigo: 'REFRI-COMANDO', nome: 'COMANDO', tipo: 'edificacao', geom: ZONA.geom }],
  })
  assert.deepEqual(features.map((f) => f.properties.camada), ['ativo', 'zona', 'predio'])
  assert.equal(features[0].properties.local_posicao, 'COMANDO')
  assert.equal(features[0].properties.modulo, 'climatizacao')
  assert.equal(features[1].properties.flora, 'gramado')
  assert.equal(features[2].properties.codigo, 'REFRI-COMANDO')
})

test('coleção vazia continua sendo uma coleção válida', async () => {
  const { montarGeoJSON } = await import('../mapa/mapa-exportar.js')
  assert.deepEqual(montarGeoJSON(), { type: 'FeatureCollection', features: [] })
  assert.deepEqual(montarGeoJSON({}).type, 'FeatureCollection')
})

test('o nome do arquivo é ordenável por data', async () => {
  const { nomeDoArquivo } = await import('../mapa/mapa-exportar.js')
  assert.equal(nomeDoArquivo(new Date('2026-08-19T12:00:00Z')), 'cmasm-mapa-2026-08-19.geojson')
})

// ── 2. instrução deixou de bloquear o clique que ela pede ───────────────
test('a instrução do editor usa aviso não bloqueante; erro continua em alert', () => {
  const editor = ler(EDITOR)
  for (const trecho of ['Desenhe o contorno', 'Arraste os vértices', 'gravado']) {
    const linha = editor.split('\n').find((l) => l.includes(trecho) && (l.includes('_aviso(') || l.includes('alert(')))
    assert.ok(linha, `não achei a mensagem "${trecho}"`)
    assert.match(linha, /_aviso\(/, `"${trecho}" deveria ser aviso, não alert — alert engole o clique seguinte`)
  }
  // Erro e validação seguem no idioma do projeto — em alert, que para o
  // usuário. O que saiu do alert foi só a INSTRUÇÃO. O erro de gravação
  // mora na porta de dados; a validação de formulário, no editor.
  assert.match(editor, /alert\('Informe o nome da zona/, 'validação deveria continuar parando o usuário')
  assert.match(ler(path.join(MAPA, 'mapa-dados.js')), /alert\('Erro ao salvar/, 'erro do banco deveria continuar em alert')
  assert.match(ler(APP), /function mostrarAviso\(/, 'app.js deveria publicar o aviso')
})

// ── 3. o que a referência tinha e aqui entrou de outra forma ────────────
test('escala métrica, coordenada sob o cursor e opacidade das camadas estão ligadas', () => {
  const app = ler(APP)
  assert.match(app, /L\.control\.scale\(/, 'falta a escala métrica')
  assert.match(app, /mapa\.on\('mousemove'/, 'falta a leitura de coordenada sob o cursor')
  assert.match(app, /toFixed\(6\)/, 'a coordenada precisa da precisão que o posicionamento usa')
  // A opacidade atua no dado, nunca no tile: o objetivo é ver o terreno por baixo.
  const inicio = app.indexOf('function ligarOpacidadeDasCamadas(')
  const corpo = app.slice(inicio, app.indexOf('\n}', inicio))
  assert.match(corpo, /overlayPane/)
  assert.match(corpo, /markerPane/)
  assert.doesNotMatch(corpo, /tilePane/, 'escurecer o tile faria o oposto do que a opacidade serve')
  for (const id of ['mapa-coord', 'mapa-toast', 'opacidade-camadas', 'btn-exportar', 'planta-arquivo']) {
    assert.match(ler(INDEX_HTML), new RegExp(`id="${id}"`), `falta o elemento id="${id}"`)
  }
})

test('a planta de referência é georreferenciada, não uma imagem parada na tela', () => {
  const fonte = ler(PLANTA)
  // A diferença central em relação à referência: lá é um <img> com
  // transform de CSS, que não acompanha o mapa; aqui é imageOverlay em
  // coordenadas, que é o que permite desenhar por cima.
  assert.match(fonte, /L\.imageOverlay\(/, 'a planta deveria estar amarrada a coordenadas')
  assert.doesNotMatch(fonte, /style\.transform/, 'transform de CSS deixaria a planta parada enquanto o mapa se move')
  assert.match(fonte, /setBounds\(_mapa\.getBounds\(\)\)/, 'falta o encaixe nos limites atuais')
  assert.doesNotMatch(fonte, /\.from\(|insert\(|update\(/, 'a planta não vai para o banco')
})

// ── 4. o componente travado segue travado ───────────────────────────────
test('nada disso tocou mapa/xmap.js nem mapa/xmap.css', () => {
  const xmapJs = ler(path.join(MAPA, 'xmap.js'))
  const xmapCss = ler(path.join(MAPA, 'xmap.css'))
  for (const marca of ['mapa-coord', 'mapa-toast', 'opacidade-camadas', 'planta-arquivo', 'imageOverlay', 'control.scale']) {
    assert.ok(!xmapJs.includes(marca), `mapa/xmap.js foi editado (${marca})`)
    assert.ok(!xmapCss.includes(marca), `mapa/xmap.css foi editado (${marca})`)
  }
})
