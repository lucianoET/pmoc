const assert = require('node:assert/strict')
const test = require('node:test')

// Gate do núcleo genérico de ordenação e filtro (quick-260818-vtm, D2),
// promovido de maquinas/estoque-tabela.js para shared/tabela.js. Cobre só o
// que é genérico — nada de material, nada de reparo — dirigido por uma
// definição de colunas inventada no próprio teste, prova de que nenhum
// campo de domínio ficou escrito no núcleo.
const {
  proximaOrdem, normalizarBusca, comparar, aplicarOrdemEFiltro,
} = require('../shared/tabela.js')

test('importar shared/tabela.js em Node puro não lança', () => {
  assert.ok(proximaOrdem)
  assert.ok(normalizarBusca)
  assert.ok(comparar)
  assert.ok(aplicarOrdemEFiltro)
})

test('proximaOrdem cicla null → asc → desc → null', () => {
  assert.equal(proximaOrdem(null), 'asc')
  assert.equal(proximaOrdem('asc'), 'desc')
  assert.equal(proximaOrdem('desc'), null)
  assert.equal(proximaOrdem(undefined), 'asc', 'qualquer valor fora de asc/desc entra como sem ordem')
})

test('normalizarBusca derruba acento e caixa, tolera null/undefined/número', () => {
  assert.equal(normalizarBusca('Óleo'), normalizarBusca('oleo'))
  assert.equal(normalizarBusca('ÓLEO'), 'oleo')
  assert.equal(normalizarBusca(null), '')
  assert.equal(normalizarBusca(undefined), '')
  assert.equal(normalizarBusca(10), '10')
})

// definição de colunas inventada no próprio teste — dois campos que não
// existem em material nem em reparo nenhum
const COLUNAS_TESTE = [
  {
    id: 'apelido', rotulo: 'Apelido', tipo: 'texto',
    valor: x => x.apelido || '',
    texto: x => x.apelido || '',
  },
  {
    id: 'pontuacao', rotulo: 'Pontuação', tipo: 'numero',
    valor: x => (x.pontuacao === null || x.pontuacao === undefined ? null : Number(x.pontuacao)),
    texto: x => (x.pontuacao === null || x.pontuacao === undefined ? '' : String(x.pontuacao)),
  },
]

const ITEM_A = { id: 1, apelido: 'Zebra', pontuacao: 9 }
const ITEM_B = { id: 2, apelido: 'Abelha', pontuacao: null }
const ITEM_C = { id: 3, apelido: 'Ôrix', pontuacao: 100 }
const ITEM_ZERO = { id: 4, apelido: '', pontuacao: 0 }
const LISTA = [ITEM_A, ITEM_B, ITEM_C, ITEM_ZERO]

test('ordenação numérica ordena por número, não por string (9 antes de 100)', () => {
  const asc = aplicarOrdemEFiltro(LISTA, { coluna: 'pontuacao', dir: 'asc' }, {}, COLUNAS_TESTE).map(x => x.id)
  assert.deepEqual(asc, [4, 1, 3, 2], '0, 9, 100, vazio — numérico, não string')
  const desc = aplicarOrdemEFiltro(LISTA, { coluna: 'pontuacao', dir: 'desc' }, {}, COLUNAS_TESTE).map(x => x.id)
  assert.deepEqual(desc, [3, 1, 4, 2], 'vazio continua no fim mesmo decrescente')
})

test('zero não é vazio — fica ordenado como valor real, não jogado para o fim', () => {
  const asc = aplicarOrdemEFiltro(LISTA, { coluna: 'pontuacao', dir: 'asc' }, {}, COLUNAS_TESTE).map(x => x.id)
  assert.equal(asc[0], 4, 'ITEM_ZERO (pontuacao 0) é o menor, não o vazio')
})

test('ordenação textual usa pt-BR e vazio fica no fim nas duas direções', () => {
  const asc = aplicarOrdemEFiltro(LISTA, { coluna: 'apelido', dir: 'asc' }, {}, COLUNAS_TESTE).map(x => x.id)
  assert.deepEqual(asc, [2, 3, 1, 4], 'Abelha, Ôrix, Zebra, vazio')
  const desc = aplicarOrdemEFiltro(LISTA, { coluna: 'apelido', dir: 'desc' }, {}, COLUNAS_TESTE).map(x => x.id)
  assert.deepEqual(desc, [1, 3, 2, 4], 'Zebra, Ôrix, Abelha, vazio — vazio continua por último')
})

test('filtro é substring sem acento e sem caixa, e filtros de colunas diferentes se acumulam', () => {
  const porApelido = aplicarOrdemEFiltro(LISTA, null, { apelido: 'orix' }, COLUNAS_TESTE).map(x => x.id)
  assert.deepEqual(porApelido, [3], '"Ôrix" casa com "orix" sem acento')

  const semOrdem = aplicarOrdemEFiltro(LISTA, null, {}, COLUNAS_TESTE).map(x => x.id)
  assert.deepEqual(semOrdem, [1, 2, 3, 4], 'sem ord.coluna devolve a ordem de entrada')

  const doisFiltros = aplicarOrdemEFiltro(LISTA, null, { apelido: 'a', pontuacao: '9' }, COLUNAS_TESTE).map(x => x.id)
  assert.deepEqual(doisFiltros, [1], 'só ITEM_A casa em apelido E pontuação ao mesmo tempo')
})

test('coluna desconhecida devolve 0 no comparador e é ignorada no filtro', () => {
  assert.equal(comparar(ITEM_A, ITEM_B, 'coluna-que-nao-existe', 'asc', COLUNAS_TESTE), 0)
  const resultado = aplicarOrdemEFiltro(LISTA, null, { 'coluna-que-nao-existe': 'qualquer' }, COLUNAS_TESTE).map(x => x.id)
  assert.deepEqual(resultado, [1, 2, 3, 4], 'filtro numa coluna que não existe na definição não derruba a lista')
})

test('comparar sem definição de colunas devolve 0, não lança', () => {
  assert.equal(comparar(ITEM_A, ITEM_B, 'apelido', 'asc', undefined), 0)
})
