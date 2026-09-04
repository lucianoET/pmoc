const assert = require('node:assert/strict')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do núcleo puro de Gantt (D-03, D-13-04, GEQ-03) — CSS grid, sem
// canvas, posição sempre em porcentagem de dias ISO. Cobre os casos
// degenerados que quebram cálculo de porcentagem: intervalo de um único
// dia, item que começa antes do intervalo, hoje fora do intervalo, item
// sem início/fim, item inteiramente fora.
// ══════════════════════════════════════════════════════════════════

const { linhasGantt, htmlGantt } = require('../shared/gantt.js')

test('lista vazia devolve linhas vazias, zero ignorados e hojePct calculável', () => {
  const r = linhasGantt([], { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-09-15' })
  assert.deepEqual(r.linhas, [])
  assert.equal(r.ignorados, 0)
  assert.equal(typeof r.hojePct, 'number')
})

test('item com início nulo ou não-ISO é omitido e contado em ignorados, sem lançar', () => {
  const itens = [
    { id: 1, rotulo: 'Sem início', inicio: null, fim: '2026-09-10' },
    { id: 2, rotulo: 'Data inválida', inicio: '31/09/2026', fim: '2026-09-10' },
    { id: 3, rotulo: 'Válido', inicio: '2026-09-05', fim: '2026-09-10' },
  ]
  const r = linhasGantt(itens, { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-09-15' })
  assert.equal(r.ignorados, 2)
  assert.equal(r.linhas.length, 1)
  assert.equal(r.linhas[0].id, 3)
})

test('item sem data de fim recebe aberto:true e a barra vai até hoje', () => {
  const r = linhasGantt(
    [{ id: 1, rotulo: 'Em andamento', inicio: '2026-09-05', fim: null }],
    { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-09-15' },
  )
  assert.equal(r.linhas[0].aberto, true)
})

test('item inteiramente fora do intervalo pedido é omitido e contado em ignorados', () => {
  const r = linhasGantt(
    [{ id: 1, rotulo: 'Mês passado', inicio: '2026-07-01', fim: '2026-07-10' }],
    { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-09-15' },
  )
  assert.equal(r.linhas.length, 0)
  assert.equal(r.ignorados, 1)
})

test('item que começa antes do intervalo é recortado: inicioPct 0 e largura só da parte visível', () => {
  const r = linhasGantt(
    [{ id: 1, rotulo: 'Começou antes', inicio: '2026-08-20', fim: '2026-09-10' }],
    { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-09-15' },
  )
  assert.equal(r.linhas[0].inicioPct, 0)
  assert.ok(r.linhas[0].larguraPct > 0 && r.linhas[0].larguraPct < 100)
})

test('toda barra fica dentro de 0..100 e nunca tem largura zero, mesmo para item de um único dia', () => {
  const r = linhasGantt(
    [{ id: 1, rotulo: 'Um dia', inicio: '2026-09-15', fim: '2026-09-15' }],
    { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-09-15' },
  )
  const linha = r.linhas[0]
  assert.ok(linha.inicioPct >= 0)
  assert.ok(linha.inicioPct + linha.larguraPct <= 100.0001)
  assert.ok(linha.larguraPct > 0)
})

test('intervalo degenerado (início igual a fim) não divide por zero: largura 100 para o item daquele dia', () => {
  const r = linhasGantt(
    [{ id: 1, rotulo: 'Único dia do intervalo', inicio: '2026-09-15', fim: '2026-09-15' }],
    { inicio: '2026-09-15', fim: '2026-09-15', hoje: '2026-09-15' },
  )
  assert.equal(r.linhas[0].inicioPct, 0)
  assert.equal(r.linhas[0].larguraPct, 100)
})

test('hojePct é null quando hoje está fora do intervalo pedido', () => {
  const r = linhasGantt([], { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-10-15' })
  assert.equal(r.hojePct, null)
})

test('hojePct é um número dentro de 0..100 quando hoje está dentro do intervalo', () => {
  const r = linhasGantt([], { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-09-15' })
  assert.ok(r.hojePct >= 0 && r.hojePct <= 100)
})

test('htmlGantt com lista vazia devolve o HTML de vazio() com os dois textos do contrato', () => {
  const html = htmlGantt([], { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-09-15' })
  assert.match(html, /Nenhuma ação no período/)
  assert.match(html, /Ajuste o intervalo ou cadastre uma ação/)
})

test('htmlGantt com item populado desenha a barra e escapa o rótulo', () => {
  const html = htmlGantt(
    [{ id: 1, rotulo: '<script>x</script>', inicio: '2026-09-05', fim: '2026-09-10', tom: 'ok' }],
    { inicio: '2026-09-01', fim: '2026-09-30', hoje: '2026-09-15' },
  )
  assert.match(html, /gantt-tom-ok/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>x<\/script>/)
})
