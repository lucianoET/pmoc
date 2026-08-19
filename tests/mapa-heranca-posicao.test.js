const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do quick-260819-23e — sala herda a posição do prédio.
//
// O miolo é testado por COMPORTAMENTO: a subida da cadeia `parent_id` é
// uma regra, e regra se confere executando, com uma árvore montada à mão.
// O resto é estrutural, e existe por um motivo específico: a consulta da
// árvore PRECISA trazer o local sem coordenada. Se alguém "otimizar" isso
// de volta para `.not('lat','is',null)`, a cadeia se rompe no elo do meio
// — a sala — e 175 dos 190 ativos somem do mapa sem erro nenhum. É
// exatamente o tipo de regressão silenciosa que este arquivo trava.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const MAPA = path.join(RAIZ, 'mapa')
const DADOS = path.join(MAPA, 'mapa-dados.js')
const INDEX_HTML = path.join(MAPA, 'index.html')

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

// Árvore igual à real: sala dentro de edificação dentro da OM. Só a
// edificação tem coordenada — que é a situação de campo depois deste
// trabalho, e a que produzia mapa vazio antes dele.
const ARVORE = {
  1: { id: 1, nome: 'CMASM', tipo: 'Organizacao Militar', parent_id: null, lat: null, lon: null },
  2: { id: 2, nome: 'COMANDO', tipo: 'edificacao', parent_id: 1, lat: -22.8395, lon: -43.1091 },
  3: { id: 3, nome: 'SALA DE ESTADO', tipo: 'sala', parent_id: 2, lat: null, lon: null },
  4: { id: 4, nome: 'PAIOL', tipo: 'edificacao', parent_id: 1, lat: null, lon: null },
  5: { id: 5, nome: 'DEPÓSITO', tipo: 'sala', parent_id: 4, lat: null, lon: null },
}

test('a posição sobe a cadeia: ativo numa sala recebe a coordenada do prédio', async () => {
  const { localComPosicao } = await import('../mapa/mapa-geometria.js')
  assert.equal(localComPosicao(3, ARVORE).id, 2, 'a sala deveria herdar do prédio dela')
  assert.equal(localComPosicao(2, ARVORE).id, 2, 'o próprio local entra na busca')
  assert.equal(localComPosicao(5, ARVORE), null, 'prédio sem coordenada não inventa posição')
  assert.equal(localComPosicao(null, ARVORE), null)
  assert.equal(localComPosicao(3, null), null)
})

test('o alvo de posicionamento de uma sala é o prédio dela, nunca a sala', async () => {
  const { localPosicionavel } = await import('../mapa/mapa-geometria.js')
  assert.equal(localPosicionavel(3, ARVORE).id, 2)
  assert.equal(localPosicionavel(5, ARVORE).id, 4, 'vale mesmo com o prédio ainda sem coordenada')
  assert.equal(localPosicionavel(4, ARVORE).id, 4)
})

test('a lista do que herda é fechada e invertida — o desconhecido é posicionável', async () => {
  const { herdaPosicao, TIPOS_QUE_HERDAM_POSICAO } = await import('../mapa/mapa-geometria.js')
  assert.deepEqual(TIPOS_QUE_HERDAM_POSICAO, ['sala'])
  assert.equal(herdaPosicao('sala'), true)
  assert.equal(herdaPosicao('SALA'), true)
  for (const tipo of ['edificacao', 'area_externa', 'paiol', 'complexo_paiol', 'infraestrutura', 'tipo_que_ainda_nao_existe']) {
    assert.equal(herdaPosicao(tipo), false, `${tipo} deveria continuar posicionável`)
  }
  assert.equal(herdaPosicao(null), false)
  assert.equal(herdaPosicao('__proto__'), false)
})

test('a coordenada da Organização Militar NÃO serve de posição herdada', async () => {
  const { localComPosicao, serveDePosicaoHerdada, TIPOS_SEM_HERANCA } = await import('../mapa/mapa-geometria.js')
  // A raiz real tem coordenada. Se ela servisse de herança, todo ativo do
  // CMASM ficaria "posicionado" no mesmo pino e a lista de não localizados
  // — o trabalho de campo que falta — esvaziaria sozinha.
  const comRaizPosicionada = {
    1: { id: 1, nome: 'CMASM', tipo: 'Organizacao Militar', parent_id: null, lat: -22.8396, lon: -43.1094 },
    2: { id: 2, nome: 'PAIOL', tipo: 'edificacao', parent_id: 1, lat: null, lon: null },
    3: { id: 3, nome: 'DEPÓSITO', tipo: 'sala', parent_id: 2, lat: null, lon: null },
  }
  assert.deepEqual(TIPOS_SEM_HERANCA, ['organizacao militar'])
  assert.equal(localComPosicao(3, comRaizPosicionada), null, 'a sala não pode cair na coordenada da OM')
  assert.equal(localComPosicao(1, comRaizPosicionada), null, 'nem o ativo ligado direto na OM')
  assert.equal(serveDePosicaoHerdada(comRaizPosicionada[1]), false)
  assert.equal(serveDePosicaoHerdada({ tipo: 'edificacao', lat: -22.8395, lon: -43.1091 }), true)
})

test('cadastro com ciclo em parent_id não trava a tela — devolve "não achei"', async () => {
  const { localComPosicao, localPosicionavel } = await import('../mapa/mapa-geometria.js')
  const ciclo = {
    7: { id: 7, nome: 'A', tipo: 'sala', parent_id: 8, lat: null, lon: null },
    8: { id: 8, nome: 'B', tipo: 'sala', parent_id: 7, lat: null, lon: null },
  }
  assert.equal(localComPosicao(7, ciclo), null)
  assert.equal(localPosicionavel(7, ciclo), null)
})

test('posição própria continua vencendo a herdada — resolverPosicao não mudou de contrato', async () => {
  const { resolverPosicao, localComPosicao } = await import('../mapa/mapa-geometria.js')
  const ativoNaSalaComPosicaoPropria = { lat: -22.8400, lon: -43.1055 }
  const herdado = localComPosicao(3, ARVORE)
  const r = resolverPosicao(ativoNaSalaComPosicaoPropria, herdado)
  assert.equal(r.origem, 'propria')
  assert.equal(r.lat, -22.84)
})

test('a árvore é carregada INTEIRA — o elo do meio não tem coordenada e precisa vir', () => {
  const fonte = ler(DADOS)
  const inicio = fonte.indexOf('export async function carregarArvoreDeLocais(')
  assert.notEqual(inicio, -1, 'carregarArvoreDeLocais não encontrada')
  const corpo = fonte.slice(inicio, fonte.indexOf('\n}', inicio))
  assert.match(corpo, /parent_id/, 'sem parent_id a cadeia não sobe')
  assert.doesNotMatch(
    corpo,
    /\.not\('lat', 'is', null\)/,
    'filtrar por coordenada rompe a cadeia na sala e apaga 175 ativos do mapa sem erro'
  )
})

test('a lista de posicionar não oferece sala, e usa a lista fechada do núcleo puro', () => {
  const fonte = ler(DADOS)
  const inicio = fonte.indexOf('export async function carregarLocaisSemPosicao(')
  const corpo = fonte.slice(inicio, fonte.indexOf('\n}', inicio))
  assert.match(corpo, /herdaPosicao/, 'o filtro deveria vir do núcleo puro')
  assert.doesNotMatch(corpo, /'sala'/, "o vocabulário não pode ser redeclarado aqui")
  assert.match(ler(INDEX_HTML), /herda a posição do prédio/, 'a tela deveria dizer por que sala não está na lista')
})

test('o balão diz de qual local a posição foi herdada, não só que foi', () => {
  for (const nome of ['xmap-layers-ativos.js', 'xmap-layers-grama.js', 'xmap-layers-eletrica.js']) {
    const fonte = ler(path.join(MAPA, nome))
    assert.match(fonte, /Herdada de \$\{/, `${nome} ainda diz só "herdada", sem dizer de onde`)
  }
  assert.match(ler(DADOS), /localPosicao:/, 'mapa-dados deveria anexar o nome do local de origem')
})
