const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate do plano 10-04 da Fase 10 (PLAT-19, critério de sucesso 9): o mapa
// desenha a área do CMASM com a rede desligada, a partir de um arquivo
// estático do próprio projeto, e o basemap de satélite continua apenas
// online por decisão travada (D-02). Ver mapa/tiles/GERAR-TILES.md para o
// procedimento de tiles raster e a limitação de testar isso contra produção.
const RAIZ = path.join(__dirname, '..')
const PLANTA = path.join(RAIZ, 'mapa', 'planta-cmasm.geojson')
const XMAP = path.join(RAIZ, 'mapa', 'xmap.js')
const GERADOR = path.join(RAIZ, 'mapa', 'gerar-planta.mjs')
const PROCEDIMENTO = path.join(RAIZ, 'mapa', 'tiles', 'GERAR-TILES.md')

const TETO_PLANTA_BYTES = 512000 // 500 KB — mesmo teto do <verify> da Task 1

// ── caso 1 — a planta existe, é JSON válido, é FeatureCollection e tem feição de verdade ──
test('mapa/planta-cmasm.geojson existe, é JSON válido, é FeatureCollection e tem pelo menos 100 feições', () => {
  assert.ok(fs.existsSync(PLANTA), 'mapa/planta-cmasm.geojson deveria existir')
  const conteudo = fs.readFileSync(PLANTA, 'utf8')
  const planta = JSON.parse(conteudo) // lança se não for JSON válido — é o próprio caso de teste
  assert.equal(planta.type, 'FeatureCollection', 'a planta deveria ser uma FeatureCollection')
  assert.ok(Array.isArray(planta.features), 'planta.features deveria ser um array')
  assert.ok(
    planta.features.length >= 100,
    `a planta deveria ter pelo menos 100 feições, tem ${planta.features.length}`
  )
})

// ── caso 2 — a atribuição de licença viaja com o dado ──
test('mapa/planta-cmasm.geojson traz a atribuição ODbL nos metadados', () => {
  const planta = JSON.parse(fs.readFileSync(PLANTA, 'utf8'))
  assert.match(
    JSON.stringify(planta.metadados || {}),
    /ODbL|opendatacommons/i,
    'planta.metadados deveria conter a atribuição de licença ODbL do dado OpenStreetMap'
  )
})

// ── caso 3 — orçamento de tamanho ──
test('mapa/planta-cmasm.geojson cabe no orçamento de 500 KB', () => {
  const { size } = fs.statSync(PLANTA)
  assert.ok(
    size <= TETO_PLANTA_BYTES,
    `planta-cmasm.geojson tem ${size} bytes, acima do teto de ${TETO_PLANTA_BYTES}`
  )
})

// ── caso 4 — D-02: o satélite continua online puro ──
// O gate é escopado à REGIÃO do arquivo que constrói o basemap de satélite,
// de propósito: a classe TileLocalComFallback precisa aparecer no arquivo,
// legitimamente, na construção do outro basemap (mapa) — um gate sobre o
// arquivo inteiro seria impossível de satisfazer (a classe sempre aparece
// em algum lugar), e um gate sobre a ausência total do texto "satellite"
// seria falso positivo constante. Recortar as poucas linhas em volta da
// atribuição de `_baseLayers.satellite` é o que torna o gate verificável.
test('D-02 — a construção do basemap de satélite em mapa/xmap.js não referencia tile local nem TileLocalComFallback', () => {
  const linhas = fs.readFileSync(XMAP, 'utf8').split('\n')
  const indice = linhas.findIndex((l) => l.includes('_baseLayers.satellite'))
  assert.ok(indice >= 0, '_baseLayers.satellite deveria existir em mapa/xmap.js')

  const regiao = linhas.slice(indice, indice + 7).join('\n')
  assert.doesNotMatch(
    regiao,
    /\/mapa\/tiles\//,
    'D-02 violada: a construção do basemap de satélite referencia o diretório de tiles locais'
  )
  assert.doesNotMatch(
    regiao,
    /TileLocalComFallback/,
    'D-02 violada: a construção do basemap de satélite usa a classe customizada de tile local'
  )
})

// ── caso 5 — a classe customizada é instanciada uma única vez em todo o arquivo ──
test('TileLocalComFallback é instanciada exatamente uma vez em mapa/xmap.js', () => {
  const conteudo = fs.readFileSync(XMAP, 'utf8')
  const ocorrencias = conteudo.match(/new TileLocalComFallback\(/g) || []
  assert.equal(
    ocorrencias.length,
    1,
    `TileLocalComFallback deveria ser instanciada uma única vez, encontrada(s) ${ocorrencias.length}`
  )
})

// ── caso 6 — nenhum script do projeto baixa tile ──
// Duas escolhas deliberadas neste gate:
// (a) é uma CONTAGEM de arquivos que mencionam o serviço público de tiles,
//     não uma proibição de texto — proibir a palavra "tile.openstreetmap.org"
//     quebraria o próprio comentário que explica a proibição (este arquivo,
//     e o cabeçalho de mapa/gerar-planta.mjs, citam o endereço para dizer
//     que ele NÃO deve ser chamado em laço).
// (b) tests/ fica FORA da varredura — obrigatoriamente: este arquivo de
//     teste precisa conter o texto "tile.openstreetmap.org" para poder
//     procurá-lo, e variar sobre si mesmo tornaria o gate impossível de
//     satisfazer (a contagem nunca bateria com 1).
const DIRETORIOS_DE_CODIGO = ['mapa', 'shared', 'maquinas', 'transportes', 'eletrica', 'fonoclama', 'predial']

function arquivosJsRecursivo(diretorio) {
  if (!fs.existsSync(diretorio)) return []
  const resultado = []
  for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = path.join(diretorio, entrada.name)
    if (entrada.isDirectory()) {
      resultado.push(...arquivosJsRecursivo(caminho))
    } else if (/\.(js|mjs)$/.test(entrada.name)) {
      resultado.push(caminho)
    }
  }
  return resultado
}

test('nenhum script do projeto baixa tile — só mapa/xmap.js menciona o serviço público de tiles, como endereço de queda', () => {
  const arquivosComMencao = []
  for (const dir of DIRETORIOS_DE_CODIGO) {
    for (const arquivo of arquivosJsRecursivo(path.join(RAIZ, dir))) {
      const conteudo = fs.readFileSync(arquivo, 'utf8')
      if (conteudo.includes('tile.openstreetmap.org')) arquivosComMencao.push(arquivo)
    }
  }
  assert.equal(
    arquivosComMencao.length,
    1,
    `esperado exatamente 1 arquivo mencionando tile.openstreetmap.org, encontrado(s): ${arquivosComMencao.join(', ')}`
  )
  assert.equal(
    path.basename(arquivosComMencao[0]),
    'xmap.js',
    'o único arquivo que menciona o serviço público de tiles deveria ser mapa/xmap.js (endereço de queda)'
  )
})

test('mapa/gerar-planta.mjs não importa nenhum módulo de rede', () => {
  const conteudo = fs.readFileSync(GERADOR, 'utf8')
  const linhasDeImport = conteudo.split('\n').filter((l) => l.startsWith('import '))
  assert.ok(linhasDeImport.length > 0, 'o gerador deveria ter pelo menos um import (node:fs, no mínimo)')
  for (const linha of linhasDeImport) {
    assert.match(
      linha,
      /from ['"]node:/,
      `import fora do núcleo do Node em mapa/gerar-planta.mjs: ${linha.trim()}`
    )
  }
})

// ── caso 7 — caminho absoluto de raiz, mesma convenção de tests/modulos-caminhos.test.js ──
test('o modelo de tile local e a planta usam caminho absoluto de raiz em mapa/xmap.js', () => {
  const conteudo = fs.readFileSync(XMAP, 'utf8')
  assert.match(conteudo, /\/mapa\/tiles\//, 'o modelo de tile local deveria usar /mapa/tiles/{z}/{x}/{y}.png')
  assert.match(
    conteudo,
    /\/mapa\/planta-cmasm\.geojson/,
    'a busca da planta deveria usar /mapa/planta-cmasm.geojson'
  )
})

// ── caso 8 — o documento de procedimento existe e cobre os pontos que não podem sumir numa reescrita ──
test('mapa/tiles/GERAR-TILES.md existe e cobre a proibição, a fonte ODbL, as alternativas e a limitação do teste contra produção', () => {
  assert.ok(fs.existsSync(PROCEDIMENTO), 'mapa/tiles/GERAR-TILES.md deveria existir')
  const conteudo = fs.readFileSync(PROCEDIMENTO, 'utf8')
  assert.match(conteudo, /odbl/i, 'o procedimento deveria citar a licença ODbL')
  assert.match(
    conteudo,
    /bulk|prefetch|proib/i,
    'o procedimento deveria registrar a proibição de download em massa do serviço de tiles'
  )
  assert.match(
    conteudo,
    /service worker/i,
    'o procedimento deveria registrar que o teste offline contra produção é impossível (sem service worker)'
  )
  for (const limite of ['-22.84731', '-43.11868', '-22.82761', '-43.09739']) {
    assert.ok(conteudo.includes(limite), `o procedimento deveria citar o limite geográfico ${limite}`)
  }
})

// ── caso extra — mapa/tiles/.gitkeep existe, para o caminho existir com zero tile ──
test('mapa/tiles/.gitkeep existe — o caminho de tile local existe no repositório mesmo vazio', () => {
  assert.ok(
    fs.existsSync(path.join(RAIZ, 'mapa', 'tiles', '.gitkeep')),
    'mapa/tiles/.gitkeep deveria existir'
  )
})
