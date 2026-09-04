const assert = require('node:assert/strict')
const test = require('node:test')

// Gate de comportamento de shared/indicadores.js (Fase 13, D-02) —
// avaliação por meta, tendência e cartão de indicador. A definição do
// indicador é sempre parâmetro (nunca constante concreta da plataforma),
// mesma disciplina de shared/tabela.js. Testa comportamento (importar em
// Node e chamar as funções), nunca regex sobre o texto do arquivo.
const { avaliar, tendencia, cartaoIndicador } = require('../shared/indicadores.js')

test('importar shared/indicadores.js em Node puro não lança e expõe as três funções', () => {
  assert.equal(typeof avaliar, 'function')
  assert.equal(typeof tendencia, 'function')
  assert.equal(typeof cartaoIndicador, 'function')
})

// ── avaliar ──

test('avaliar(null, def) devolve neutro; avaliar sem meta devolve info', () => {
  assert.equal(avaliar(null, { meta: 10, sentido: 'maior' }), 'neutro')
  assert.equal(avaliar(undefined, {}), 'neutro')
  assert.equal(avaliar(10, {}), 'info')
})

test('sentido maior é melhor: acima da meta é ok, abaixo é erro', () => {
  assert.equal(avaliar(12, { meta: 10, sentido: 'maior' }), 'ok')
  assert.equal(avaliar(8, { meta: 10, sentido: 'maior' }), 'erro')
  assert.equal(avaliar(10, { meta: 10, sentido: 'maior' }), 'ok', 'exatamente na meta é ok')
})

test('sentido menor é melhor (o caso onde a regra erra fácil): acima da meta é erro, não ok', () => {
  assert.equal(avaliar(12, { meta: 10, sentido: 'menor' }), 'erro')
  assert.equal(avaliar(8, { meta: 10, sentido: 'menor' }), 'ok')
  assert.equal(avaliar(10, { meta: 10, sentido: 'menor' }), 'ok', 'exatamente na meta é ok')
})

test('com faixas declaradas, valor perto do limite devolve warn em vez de ok/erro', () => {
  // sentido maior: faixa de atenção é [meta*faixas, meta)
  assert.equal(avaliar(9.5, { meta: 10, sentido: 'maior', faixas: 0.9 }), 'warn')
  assert.equal(avaliar(5, { meta: 10, sentido: 'maior', faixas: 0.9 }), 'erro', 'longe do limite continua erro')
  // sentido menor: faixa de atenção é (meta, meta*(2-faixas)]
  assert.equal(avaliar(10.5, { meta: 10, sentido: 'menor', faixas: 0.9 }), 'warn')
  assert.equal(avaliar(15, { meta: 10, sentido: 'menor', faixas: 0.9 }), 'erro', 'longe do limite continua erro')
})

test('avaliar nunca lança para definição nula ou valor não numérico', () => {
  assert.equal(avaliar('abc', { meta: 10, sentido: 'maior' }), 'neutro')
  assert.equal(avaliar(10, null), 'info')
  assert.equal(avaliar(10, undefined), 'info')
})

// ── tendencia ──

test('tendencia exige ao menos dois pontos; série vazia ou de um ponto devolve null', () => {
  assert.equal(tendencia([]), null)
  assert.equal(tendencia([5]), null)
  assert.equal(tendencia(null), null)
})

test('tendencia identifica subindo, descendo e estável', () => {
  assert.equal(tendencia([1, 2, 3]), 'subindo')
  assert.equal(tendencia([3, 2, 1]), 'descendo')
  assert.equal(tendencia([2, 2, 2]), 'estavel')
})

test('tendencia ignora pontos não numéricos sem lançar', () => {
  assert.equal(tendencia(['x', 1, null, 3]), 'subindo')
})

// ── cartaoIndicador ──

test('cartaoIndicador sem valor mostra "Sem dado no período", tom neutro e nenhum <svg', () => {
  const html = cartaoIndicador({ rotulo: 'Indicador X' }, null, [])
  assert.match(html, /Sem dado no período/)
  assert.match(html, /indicador-tom-neutro/)
  assert.doesNotMatch(html, /<svg/)
})

test('cartaoIndicador sem meta mostra "Sem meta definida" no lugar do semáforo, tom info', () => {
  const html = cartaoIndicador({ rotulo: 'x' }, 10, [8, 10])
  assert.match(html, /Sem meta definida/)
  assert.match(html, /indicador-tom-info/)
})

test('cartaoIndicador com meta desenha "Meta: {valor} {unidade}" e uma marca de tendência textual', () => {
  const html = cartaoIndicador({ rotulo: 'Disponibilidade', unidade: '%', meta: 95, sentido: 'maior' }, 97, [90, 93, 97])
  assert.match(html, /Meta: 95 %/)
  assert.match(html, /indicador-tom-ok/)
  assert.match(html, /indicador-tendencia/)
  assert.match(html, /▲|▼|—/)
})

test('cartaoIndicador com um único ponto na série desenha sparkline degenerado, sem marca de tendência', () => {
  const html = cartaoIndicador({ rotulo: 'x', meta: 10, sentido: 'maior' }, 12, [12])
  assert.match(html, /indicador-spark/)
  assert.doesNotMatch(html, /indicador-tendencia/)
})

test('rótulo com caractere de marcação vem escapado no HTML devolvido', () => {
  const html = cartaoIndicador({ rotulo: '<script>alert(1)</script>' }, 5, [5])
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
})

test('cartaoIndicador nunca lança para definição nula, série nula ou valor não numérico', () => {
  assert.doesNotThrow(() => cartaoIndicador(null, null, null))
  assert.doesNotThrow(() => cartaoIndicador(undefined, 'abc', undefined))
  const html = cartaoIndicador(null, null, null)
  assert.equal(typeof html, 'string')
  assert.notEqual(html, '')
})
