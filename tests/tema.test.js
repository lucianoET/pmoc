const assert = require('node:assert/strict')
const test = require('node:test')

const modulo = import('../shared/tema.js')

test('a lista fechada aceita exatamente os dois textos previstos, sob a chave da decisão travada', async () => {
  const { TEMAS, CHAVE_TEMA } = await modulo
  assert.deepEqual(TEMAS, ['claro', 'escuro'])
  assert.equal(CHAVE_TEMA, 'pmoc-tema')
})

test('normalizarTema aceita claro e escuro, e só esses dois textos exatos', async () => {
  const { normalizarTema } = await modulo
  assert.equal(normalizarTema('claro'), 'claro')
  assert.equal(normalizarTema('escuro'), 'escuro')
})

test('normalizarTema recusa texto vazio, nulo, indefinido, número e objeto', async () => {
  const { normalizarTema } = await modulo
  assert.equal(normalizarTema(''), null)
  assert.equal(normalizarTema(null), null)
  assert.equal(normalizarTema(undefined), null)
  assert.equal(normalizarTema(42), null)
  assert.equal(normalizarTema({}), null)
})

test('normalizarTema recusa variação de caixa, espaços em volta e os textos em inglês', async () => {
  const { normalizarTema } = await modulo
  assert.equal(normalizarTema('light'), null)
  assert.equal(normalizarTema('dark'), null)
  assert.equal(normalizarTema('CLARO'), null)
  assert.equal(normalizarTema(' claro '), null)
})

test('normalizarTema recusa uma carga de marcação gravada na posição do valor salvo', async () => {
  const { normalizarTema } = await modulo
  assert.equal(normalizarTema('"><script>'), null)
})

test('proximoTema inverte o tema nos dois sentidos', async () => {
  const { proximoTema } = await modulo
  assert.equal(proximoTema('claro'), 'escuro')
  assert.equal(proximoTema('escuro'), 'claro')
})

test('proximoTema cai para o tema claro a partir de um valor não reconhecido, em vez de propagar o valor corrompido', async () => {
  const { proximoTema } = await modulo
  assert.equal(proximoTema('luz'), 'claro')
  assert.equal(proximoTema(null), 'claro')
})

test('importar o módulo em Node, sem nenhuma API de navegador disponível, não lança', async () => {
  const { CHAVE_TEMA } = await modulo
  assert.equal(CHAVE_TEMA, 'pmoc-tema')
})
