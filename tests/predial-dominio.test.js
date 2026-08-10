const assert = require('node:assert/strict')
const test = require('node:test')

const dominio = import('../predial/dominio.js')

test('classifica o total GUT nas faixas do legado', async () => {
  const { classificarGut } = await dominio
  assert.equal(classificarGut(0), 'ok')
  assert.equal(classificarGut(100), 'ok')
  assert.equal(classificarGut(101), 'atencao')
  assert.equal(classificarGut(400), 'atencao')
  assert.equal(classificarGut(401), 'critico')
  assert.equal(classificarGut(1000), 'critico')
})

test('monta a árvore em profundidade com o nível de cada local', async () => {
  const { montarArvore } = await dominio
  const arvore = await montarArvore([
    { id: 3, parent_id: 1, nome: 'Paiol 02' },
    { id: 1, parent_id: null, nome: 'CMASM' },
    { id: 2, parent_id: 1, nome: 'Paiol 01' },
    { id: 4, parent_id: 2, nome: 'Sala de carga' },
  ])
  assert.deepEqual(
    arvore.map(local => [local.nome, local.nivel]),
    [['CMASM', 0], ['Paiol 01', 1], ['Sala de carga', 2], ['Paiol 02', 1]],
  )
})

test('local com pai inexistente vira raiz em vez de sumir', async () => {
  const { montarArvore } = await dominio
  const arvore = await montarArvore([
    { id: 1, parent_id: null, nome: 'CMASM' },
    { id: 9, parent_id: 777, nome: 'Órfão' },
  ])
  assert.equal(arvore.length, 2)
  assert.deepEqual(arvore.map(local => local.nome).sort(), ['CMASM', 'Órfão'])
})

const ARVORE = [
  { id: 1, parent_id: null, nome: 'CMASM' },
  { id: 2, parent_id: 1, nome: 'Paiol 01' },
  { id: 3, parent_id: 2, nome: 'Sala de carga' },
  { id: 4, parent_id: 3, nome: 'Bancada' },
  { id: 5, parent_id: 1, nome: 'Zoficina' },
]

test('colapsada, a árvore mostra só as raízes', async () => {
  const { linhasVisiveis } = await dominio
  const linhas = await linhasVisiveis(ARVORE, new Set())
  assert.deepEqual(linhas.map(l => l.nome), ['CMASM'])
  assert.equal(linhas[0].filhos, 2)
  assert.equal(linhas[0].descendentes, 4)
})

test('expandir um nó revela só os filhos diretos', async () => {
  const { linhasVisiveis } = await dominio
  const linhas = await linhasVisiveis(ARVORE, new Set([1]))
  assert.deepEqual(linhas.map(l => l.nome), ['CMASM', 'Paiol 01', 'Zoficina'])
  assert.equal(linhas.find(l => l.nome === 'Paiol 01').descendentes, 2)
  assert.equal(linhas.find(l => l.nome === 'Zoficina').filhos, 0)
})

test('neto só aparece com pai e avô expandidos', async () => {
  const { linhasVisiveis } = await dominio
  // avô fechado: expandir o pai não basta
  assert.equal((await linhasVisiveis(ARVORE, new Set([2]))).length, 1)
  const abertos = await linhasVisiveis(ARVORE, new Set([1, 2]))
  assert.deepEqual(abertos.map(l => l.nome), ['CMASM', 'Paiol 01', 'Sala de carga', 'Zoficina'])
  assert.equal(abertos.find(l => l.nome === 'Sala de carga').nivel, 2)
})

test('ciclo entre pais não derruba a montagem', async () => {
  const { montarArvore } = await dominio
  const arvore = await montarArvore([
    { id: 1, parent_id: 2, nome: 'A' },
    { id: 2, parent_id: 1, nome: 'B' },
  ])
  assert.equal(arvore.length, 2)
})
