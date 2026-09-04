const assert = require('node:assert/strict')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do núcleo GUT (Gravidade × Urgência × Tendência), promovido de
// predial/dominio.js para shared/gut.js (D-09, GEQ-05). As seis fronteiras
// numéricas repetem tests/predial-dominio.test.js contra shared/gut.js
// diretamente — a regra fica provada dos dois lados, e este arquivo nunca
// altera tests/predial-dominio.test.js.
// ══════════════════════════════════════════════════════════════════

const { GUT_ESCALA, classificarGut, gutTotal, rotuloGut } = require('../shared/gut.js')

test('classifica o total GUT nas mesmas seis fronteiras do legado', () => {
  assert.equal(classificarGut(0), 'ok')
  assert.equal(classificarGut(100), 'ok')
  assert.equal(classificarGut(101), 'atencao')
  assert.equal(classificarGut(400), 'atencao')
  assert.equal(classificarGut(401), 'critico')
  assert.equal(classificarGut(1000), 'critico')
})

test('classificarGut(null)/classificarGut(undefined) devolvem null — não avaliado não é ok', () => {
  assert.equal(classificarGut(null), null)
  assert.equal(classificarGut(undefined), null)
})

test('classificarGut com entrada não numérica devolve null, nunca lança', () => {
  assert.equal(classificarGut('muito'), null)
  assert.doesNotThrow(() => classificarGut('muito'))
})

test('gutTotal multiplica as três dimensões quando todas pertencem a GUT_ESCALA', () => {
  assert.equal(gutTotal(6, 8, 10), 480)
  assert.equal(gutTotal(0, 0, 0), 0, 'zero é uma avaliação, não uma ausência')
})

test('gutTotal com dimensão faltando devolve null — total parcial não existe', () => {
  assert.equal(gutTotal(6, null, 10), null)
  assert.equal(gutTotal(6, undefined, 10), null)
})

test('gutTotal com dimensão fora de GUT_ESCALA devolve null', () => {
  assert.equal(gutTotal(6, 5, 10), null, '5 não está em GUT_ESCALA')
})

test('0 e null são resultados distintos — zero é avaliação real, não ausência', () => {
  assert.notEqual(classificarGut(0), null)
  assert.equal(classificarGut(0), 'ok')
  assert.notEqual(gutTotal(0, 0, 0), null)
  assert.equal(gutTotal(0, 0, 0), 0)
  assert.notEqual(rotuloGut(0), rotuloGut(null))
})

test('gutTotal com total não numérico na origem (dimensão string) devolve null, nunca lança', () => {
  assert.equal(gutTotal(6, 8, 'dez'), null)
  assert.doesNotThrow(() => gutTotal(6, 8, 'dez'))
})

test('rotuloGut devolve texto por faixa, e "Não avaliado" para null', () => {
  assert.equal(rotuloGut(null), 'Não avaliado')
  assert.equal(rotuloGut(480), classificarGut(480) === 'critico' ? 'Crítico' : rotuloGut(480))
  assert.notEqual(rotuloGut(480), 'Não avaliado')
})

test('GUT_ESCALA continua exatamente [0,1,3,6,8,10], na mesma ordem', () => {
  assert.deepEqual(GUT_ESCALA, [0, 1, 3, 6, 8, 10])
})

test('predial/dominio.js continua entregando GUT_ESCALA, classificarGut, gutTotal, montarArvore e linhasVisiveis', async () => {
  const dominio = await import('../predial/dominio.js')
  assert.deepEqual(dominio.GUT_ESCALA, [0, 1, 3, 6, 8, 10])
  assert.equal(dominio.classificarGut(401), 'critico')
  assert.equal(dominio.gutTotal(6, 8, 10), 480)
  assert.equal(typeof dominio.montarArvore, 'function')
  assert.equal(typeof dominio.linhasVisiveis, 'function')
})
