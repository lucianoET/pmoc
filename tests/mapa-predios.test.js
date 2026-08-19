const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do quick-260819-0g3 — prédio como polígono, zona como vegetação,
// controles sem sobreposição. Alcance e limite:
//
// O centroide é testado por COMPORTAMENTO — importado e executado em Node,
// com números —, não por expressão regular sobre o arquivo: é a única
// parte deste trabalho que é conta, e conta se confere calculando. O resto
// é estrutural (qual tabela cada porta escreve, onde os botões moram, que
// vocabulário a camada de vegetação fala), porque sem navegador não há
// como clicar no mapa e desenhar um contorno aqui. A prova de que o
// desenho grava de ponta a ponta é do roteiro manual (TESTES.md), não
// desta suíte.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const MAPA = path.join(RAIZ, 'mapa')
const DADOS = path.join(MAPA, 'mapa-dados.js')
const EDITOR = path.join(MAPA, 'mapa-editor.js')
const APP = path.join(MAPA, 'app.js')
const INDEX_HTML = path.join(MAPA, 'index.html')
const GRAMA = path.join(MAPA, 'xmap-layers-grama.js')
const PREDIOS = path.join(MAPA, 'xmap-layers-predios.js')
const MIGRACAO_37 = path.join(RAIZ, 'supabase', '37_locais_geometria.sql')

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

// Corpo de uma função nomeada, do `function nome(` até a chave de fechamento
// na coluna zero — mesmo recorte que tests/mapa-posicionamento.test.js usa
// para não deixar uma asserção sobre UMA função ser satisfeita por outra.
function corpoDaFuncao(fonte, nome) {
  const inicio = fonte.indexOf(`function ${nome}(`)
  assert.notEqual(inicio, -1, `função ${nome} não encontrada`)
  const fim = fonte.indexOf('\n}', inicio)
  assert.notEqual(fim, -1, `fim da função ${nome} não encontrado`)
  return fonte.slice(inicio, fim)
}

// ── 1. centroide: conta, testada como conta ─────────────────────────────
test('centroidePoligono devolve o centro de área de um quadrado', async () => {
  const { centroidePoligono } = await import('../mapa/mapa-geometria.js')
  const quadrado = [
    [-22.84, -43.11],
    [-22.84, -43.10],
    [-22.83, -43.10],
    [-22.83, -43.11],
  ]
  const [lat, lon] = centroidePoligono(quadrado)
  assert.ok(Math.abs(lat - -22.835) < 1e-9, `lat do centroide saiu ${lat}`)
  assert.ok(Math.abs(lon - -43.105) < 1e-9, `lon do centroide saiu ${lon}`)
})

test('é centroide de ÁREA, não média de vértices — uma fachada detalhada não puxa o ponto', async () => {
  const { centroidePoligono } = await import('../mapa/mapa-geometria.js')
  // Mesmo quadrado do teste acima, com a fachada de baixo subdividida em
  // vários vértices. A forma não mudou, então o centroide não pode mudar —
  // mas a média aritmética dos vértices desce em direção à fachada cheia.
  const comFachadaDetalhada = [
    [-22.84, -43.11],
    [-22.84, -43.108],
    [-22.84, -43.106],
    [-22.84, -43.104],
    [-22.84, -43.102],
    [-22.84, -43.10],
    [-22.83, -43.10],
    [-22.83, -43.11],
  ]
  const [lat] = centroidePoligono(comFachadaDetalhada)
  assert.ok(Math.abs(lat - -22.835) < 1e-9, `o centroide de área mudou com a subdivisão: ${lat}`)
  const mediaVertices =
    comFachadaDetalhada.reduce((soma, [la]) => soma + la, 0) / comFachadaDetalhada.length
  assert.ok(
    Math.abs(mediaVertices - -22.835) > 1e-4,
    'o teste não prova nada se a média de vértices também der o centro'
  )
})

test('polígono degenerado devolve null, nunca NaN', async () => {
  const { centroidePoligono } = await import('../mapa/mapa-geometria.js')
  assert.equal(centroidePoligono(null), null)
  assert.equal(centroidePoligono([]), null)
  assert.equal(centroidePoligono([[-22.84, -43.11], [-22.83, -43.10]]), null, 'dois vértices não fecham área')
  // Três vértices colineares: existe lista, não existe área. NaN aqui
  // atravessaria a validação de envelope como "fora da região" — mensagem
  // errada para o problema certo.
  assert.equal(centroidePoligono([[-22.84, -43.11], [-22.83, -43.10], [-22.82, -43.09]]), null)
  assert.equal(centroidePoligono([[-22.84, 'x'], [-22.83, -43.10], [-22.82, -43.11]]), null)
})

// ── 2. a terceira porta de escrita, com uma tabela só ───────────────────
test('salvarGeomLocal escreve só em cmasm_locais e nunca em tabela de ativo', () => {
  const corpo = corpoDaFuncao(ler(DADOS), 'salvarGeomLocal')
  const tabelas = [...corpo.matchAll(/\.from\('([^']+)'\)/g)].map((m) => m[1])
  assert.deepEqual(tabelas, ['cmasm_locais'], 'salvarGeomLocal tocou tabela que não é cmasm_locais')
  for (const proibida of ['maq_ativos', 'transp_ativos', 'elet_ativos', 'fono_ativos', 'equipamentos', 'maq_areas']) {
    assert.doesNotMatch(corpo, new RegExp(proibida), `salvarGeomLocal não pode mencionar ${proibida}`)
  }
})

test('geometria e centroide saem no MESMO update — nunca em dois comandos', () => {
  const corpo = corpoDaFuncao(ler(DADOS), 'salvarGeomLocal')
  assert.equal((corpo.match(/\.update\(/g) || []).length, 1, 'deveria haver exatamente um .update(')
  assert.match(corpo, /\.update\(\{\s*geom,\s*lat,\s*lon\s*\}\)/, 'geom, lat e lon deveriam sair juntos')
})

test('o centroide é validado contra o envelope ANTES da viagem de rede', () => {
  const corpo = corpoDaFuncao(ler(DADOS), 'salvarGeomLocal')
  const posEnvelope = corpo.indexOf('dentroDoEnvelope')
  const posUpdate = corpo.indexOf('.update(')
  assert.ok(posEnvelope !== -1, 'salvarGeomLocal não valida o envelope')
  assert.ok(posEnvelope < posUpdate, 'a validação de envelope veio depois do update')
  assert.match(corpo, /Number\.isSafeInteger\(id\)/, 'identificador de local deveria ser inteiro estrito')
})

// ── 3. migração aditiva ─────────────────────────────────────────────────
test('a migração 37 é aditiva — nenhum drop, coluna criada com if not exists', () => {
  const sql = ler(MIGRACAO_37)
  assert.doesNotMatch(sql, /\bdrop\b/i, 'migração do projeto nunca derruba nada')
  assert.match(sql, /alter table cmasm_locais add column if not exists geom jsonb/i)
  assert.match(sql, /jsonb_typeof\(geom\) = 'array'/, 'a coluna nova deveria travar a forma')
})

// ── 4. prédio não é zona ────────────────────────────────────────────────
test('a camada de prédios lê pela porta única e não toca em maq_areas', () => {
  const fonte = ler(PREDIOS)
  assert.doesNotMatch(fonte, /\.from\(/, 'nenhuma consulta pode aparecer numa camada (gate mapa-camadas)')
  assert.match(fonte, /carregarLocaisComGeom/, 'a camada deveria ler os contornos pela porta de dados')
  // Nome de tabela entre aspas, não menção em comentário: o cabeçalho do
  // arquivo explica justamente por que prédio NÃO é zona, e proibir a
  // palavra proibiria a explicação.
  assert.doesNotMatch(fonte, /'maq_areas'/, 'prédio não é zona de serviço (D-03)')
})

test('o desenho de contorno usa o cargo da tabela que escreve (cmasm_locais), não o da zona', () => {
  const editor = ler(EDITOR)
  const corpo = corpoDaFuncao(editor, 'desenharContornoDoPredio')
  assert.match(corpo, /salvarGeomLocal/, 'o contorno deveria gravar pela porta única')
  assert.doesNotMatch(corpo, /CARGOS_ZONA/, 'o contorno não é governado pela policy de maq_areas')
  // Publicado dentro de exporManipuladoresPosicao, que só roda depois da
  // checagem de CARGOS_POSICAO — quem não tem cargo nunca ganha o manipulador.
  const expositor = corpoDaFuncao(editor, 'exporManipuladoresPosicao')
  assert.match(expositor, /posDesenharPredio/, 'posDesenharPredio deveria ser publicado com os demais manipuladores de posição')
})

// ── 5. zona é vegetação e área externa ──────────────────────────────────
test('a zona é pintada por flora (lista fechada da migração 25), não pelo vocabulário legado', () => {
  const fonte = ler(GRAMA)
  for (const legado of ['jardim', 'bosque', 'canteiro', 'area_recreativa', 'horta']) {
    assert.doesNotMatch(fonte, new RegExp(`${legado}\\s*:`), `o vocabulário legado "${legado}" voltou ao estilo da zona`)
  }
  for (const flora of ['gramado', 'capim_colonial', 'mata_fechada']) {
    assert.match(fonte, new RegExp(`${flora}\\s*:`), `falta a flora "${flora}" no estilo da zona`)
  }
  assert.match(fonte, /label: 'Vegetação e áreas externas'/, 'a camada deveria se anunciar como vegetação/área externa')
})

// ── 6. controles sem sobreposição ───────────────────────────────────────
test('nenhum botão de modo do editor volta a ser controle Leaflet no canto do painel de camadas', () => {
  const editor = ler(EDITOR)
  assert.doesNotMatch(editor, /position:\s*'topright'/, 'topright é o canto do painel .xmap-filters — dois controles empilhados, um invisível')
  assert.match(editor, /getElementById\('edicao-controles'\)/, 'os botões de modo deveriam morar na barra lateral')
  assert.match(ler(INDEX_HTML), /id="edicao-controles"/, 'falta o contêiner da seção de edição na barra')
})

test('o painel de camadas recua quando o painel do editor abre, em vez de ficar por cima', () => {
  const html = ler(INDEX_HTML)
  assert.match(
    html,
    /:has\(#editor-painel\.aberto\)\s*\.xmap-filters\{[^}]*right:/,
    'sem esta regra o painel "Layers" (z-index 1000) cobre o painel do editor (z-index 900)'
  )
  assert.match(html, /\.xmap-toolbar\{[^}]*bottom:/, 'a barra de basemap deveria ter saído do topo, onde colide com ☰ Módulos')
})

test('ligar um modo de edição fecha a barra lateral', () => {
  assert.match(ler(APP), /window\.mapaFecharBarra\s*=/, 'app.js deveria publicar o fechamento da barra')
  assert.match(ler(EDITOR), /fecharBarraLateral\(\)/, 'o editor deveria fechar a barra ao entrar em modo de edição')
})
