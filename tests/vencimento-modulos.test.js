const assert = require('node:assert/strict')
const test = require('node:test')

const modulo = import('../shared/vencimento.js')

test('nunca executado: primeira ocorrência é o próprio intervalo', async () => {
  const { calcularOcorrencia } = await modulo
  assert.deepEqual(calcularOcorrencia(0, 250, 0), { proximo: 250, falta: 250, status: 'ok' })
})

test('próxima ocorrência é o múltiplo do intervalo acima da última execução', async () => {
  const { calcularOcorrencia } = await modulo
  assert.equal(calcularOcorrencia(260, 250, 300).proximo, 500)
  assert.equal(calcularOcorrencia(500, 250, 520).proximo, 750)
})

test('classifica vencida, urgente, próxima e em dia', async () => {
  const { calcularOcorrencia } = await modulo
  assert.equal(calcularOcorrencia(0, 100, 120).status, 'vencida')  // falta -20
  assert.equal(calcularOcorrencia(0, 100, 90).status, 'urgente')   // falta 10 (<= 15%)
  assert.equal(calcularOcorrencia(0, 100, 75).status, 'proxima')   // falta 25 (<= 30%)
  assert.equal(calcularOcorrencia(0, 100, 50).status, 'ok')        // falta 50
})
