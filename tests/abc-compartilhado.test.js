const assert = require('node:assert/strict')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do núcleo puro de curva ABC (D-04, GEQ-07) — genérico por
// definição de campo de valor, nunca por nome de coluna. Cobre ordenação
// decrescente, acumulado fechando em 100, item de valor não numérico
// caindo em C, um item só (tudo A) e total zero (sem divisão por zero).
// ══════════════════════════════════════════════════════════════════

const { classificarAbc } = require('../shared/abc.js')

test('lista vazia devolve linhas vazias e total 0', () => {
  const r = classificarAbc([], 'valor')
  assert.deepEqual(r.linhas, [])
  assert.equal(r.total, 0)
})

test('um único item vira tudo classe A com acumulado 100 — comportamento matemático correto', () => {
  const r = classificarAbc([{ nome: 'Único', valor: 500 }], 'valor')
  assert.equal(r.linhas.length, 1)
  assert.equal(r.linhas[0].classe, 'A')
  assert.ok(Math.abs(r.linhas[0].acumulado - 100) < 1e-6)
})

test('item com valor não numérico entra como 0 e cai na classe C, sem lançar', () => {
  const itens = [{ nome: 'Bom', valor: 100 }, { nome: 'Ruim', valor: 'não é número' }]
  const r = classificarAbc(itens, 'valor')
  const ruim = r.linhas.find((l) => l.item.nome === 'Ruim')
  assert.equal(ruim.valor, 0)
  assert.equal(ruim.classe, 'C')
})

test('linhas saem ordenadas por valor decrescente e o acumulado da última é 100', () => {
  const itens = [{ valor: 10 }, { valor: 50 }, { valor: 40 }]
  const r = classificarAbc(itens, 'valor')
  assert.deepEqual(r.linhas.map((l) => l.valor), [50, 40, 10])
  const ultima = r.linhas[r.linhas.length - 1]
  assert.ok(Math.abs(ultima.acumulado - 100) < 1e-6)
})

test('cortes personalizados são respeitados', () => {
  const itens = [{ valor: 60 }, { valor: 30 }, { valor: 10 }]
  const r = classificarAbc(itens, 'valor', [0.5, 0.9])
  assert.equal(r.linhas[0].classe, 'A')
})

test('cortes fora de ordem ou fora de 0..1 caem no padrão [0.8, 0.95]', () => {
  const itens = [{ valor: 60 }, { valor: 30 }, { valor: 10 }]
  const padrao = classificarAbc(itens, 'valor')
  const invertido = classificarAbc(itens, 'valor', [0.95, 0.8])
  const foraDeFaixa = classificarAbc(itens, 'valor', [0.8, 2])
  assert.deepEqual(invertido.linhas.map((l) => l.classe), padrao.linhas.map((l) => l.classe))
  assert.deepEqual(foraDeFaixa.linhas.map((l) => l.classe), padrao.linhas.map((l) => l.classe))
})

test('total zero (todos os valores nulos) não divide por zero: todas as linhas saem classe C com acumulado 0', () => {
  const itens = [{ valor: null }, { valor: undefined }, { valor: 0 }]
  const r = classificarAbc(itens, 'valor')
  assert.ok(r.linhas.every((l) => l.classe === 'C'))
  assert.ok(r.linhas.every((l) => l.acumulado === 0))
})

test('campoValor aceita função acessora, não só nome de campo', () => {
  const itens = [{ preco: 10, qtd: 2 }, { preco: 5, qtd: 1 }]
  const r = classificarAbc(itens, (item) => item.preco * item.qtd)
  assert.equal(r.total, 25)
  assert.equal(r.linhas[0].valor, 20)
})
