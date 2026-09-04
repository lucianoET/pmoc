const assert = require('node:assert/strict')
const test = require('node:test')

// Gate de comportamento de shared/grafico.js (Fase 13, D-01) — os seis
// núcleos puros de gráfico SVG. Testa comportamento (importar em Node e
// chamar as funções), nunca expressão regular sobre o texto do arquivo —
// a lição já paga em tests/mapa-cobertura.test.js, onde um gate por
// literal ficou cego quando o dado mudou de lugar.
const {
  barras, linha, pareto, limitesControle, cartaControle, sparkline,
} = require('../shared/grafico.js')

test('importar shared/grafico.js em Node puro não lança e expõe as seis funções', () => {
  assert.equal(typeof barras, 'function')
  assert.equal(typeof linha, 'function')
  assert.equal(typeof pareto, 'function')
  assert.equal(typeof limitesControle, 'function')
  assert.equal(typeof cartaControle, 'function')
  assert.equal(typeof sparkline, 'function')
})

// ── estado vazio ──

test('barras([], {}) devolve SVG de "Sem dado" com aria-label, nunca string vazia', () => {
  const svg = barras([], {})
  assert.equal(typeof svg, 'string')
  assert.notEqual(svg, '')
  assert.match(svg, /Sem dado/)
  assert.match(svg, /aria-label="Sem dado"/)
})

test('barras/linha/pareto/sparkline com entrada null, undefined ou não-array devolvem o SVG vazio, nunca lançam', () => {
  for (const entrada of [null, undefined, 'x', 42, {}]) {
    assert.match(barras(entrada), /Sem dado/, `barras(${JSON.stringify(entrada)})`)
    assert.match(linha(entrada), /Sem dado/, `linha(${JSON.stringify(entrada)})`)
    assert.match(pareto(entrada), /Sem dado/, `pareto(${JSON.stringify(entrada)})`)
    assert.match(sparkline(entrada), /Sem dado/, `sparkline(${JSON.stringify(entrada)})`)
  }
})

test('série só de nulos cai no mesmo estado vazio', () => {
  assert.match(barras([null, null, undefined]), /Sem dado/)
  assert.match(linha([{ valor: null }, { valor: 'x' }]), /Sem dado/)
})

// ── barras ──

test('barras com dois pontos válidos devolve dois <rect fill="currentColor">, nenhum com cor literal', () => {
  const svg = barras([{ rotulo: 'A', valor: 3 }, { rotulo: 'B', valor: 1 }], {})
  const rects = svg.match(/<rect/g) || []
  assert.equal(rects.length, 2)
  const comCorrente = svg.match(/fill="currentColor"/g) || []
  assert.ok(comCorrente.length >= 2)
  assert.doesNotMatch(svg, /#[0-9a-fA-F]{3,8}|rgba?\(|hsl\(/)
})

test('barras ignora valor não numérico no meio da série e conta no aria-label', () => {
  const svg = barras([
    { rotulo: 'A', valor: 3 },
    { rotulo: 'B', valor: 'não é número' },
    { rotulo: 'C', valor: 5 },
  ], {})
  const rects = svg.match(/<rect/g) || []
  assert.equal(rects.length, 2, 'o ponto inválido não vira barra')
  assert.match(svg, /1 ponto ignorado/)
})

// ── linha ──

test('linha com um único ponto devolve SVG válido, sem <path> degenerado', () => {
  const svg = linha([{ rotulo: 'Jan', valor: 10 }], {})
  assert.doesNotMatch(svg, /<path/)
  assert.match(svg, /<circle/)
})

test('linha com N pontos desenha um <path> de linha, sem lançar', () => {
  const svg = linha([{ valor: 1 }, { valor: 5 }, { valor: 3 }], {})
  assert.match(svg, /<path class="grafico-linha"/)
})

// ── limitesControle ──

test('limitesControle([]) devolve os quatro campos nulos/vazios', () => {
  assert.deepEqual(limitesControle([]), { media: null, lsc: null, lic: null, fora: [] })
})

test('limitesControle com entrada não-array devolve o mesmo formato nulo, sem lançar', () => {
  assert.deepEqual(limitesControle(null), { media: null, lsc: null, lic: null, fora: [] })
  assert.deepEqual(limitesControle(undefined), { media: null, lsc: null, lic: null, fora: [] })
})

test('limitesControle com menos de dois pontos não inventa limite (lsc/lic nulos)', () => {
  const um = limitesControle([5])
  assert.equal(um.lsc, null)
  assert.equal(um.lic, null)
  assert.equal(um.media, 5)
  assert.deepEqual(um.fora, [])
})

test('limitesControle([2,2,2,2,10]) marca o índice 4 em fora e nenhum outro', () => {
  const r = limitesControle([2, 2, 2, 2, 10])
  assert.deepEqual(r.fora, [4])
  assert.ok(r.lsc > 2, 'o limite superior fica acima da base estável')
})

// ── cartaControle ──

test('cartaControle desenha o ponto fora de limite no tom erro e os demais no tom ok', () => {
  const svg = cartaControle([2, 2, 2, 2, 10], {})
  assert.match(svg, /<g class="grafico-tom-erro"><circle/)
  const gruposOk = svg.match(/<g class="grafico-tom-ok">/g) || []
  assert.equal(gruposOk.length, 4)
})

test('cartaControle com série vazia devolve o SVG de estado vazio, sem lançar', () => {
  assert.match(cartaControle([], {}), /Sem dado/)
})

// ── pareto ──

test('pareto devolve barras mais uma linha acumulada cujo último ponto fecha em 100%', () => {
  const svg = pareto([{ rotulo: 'A', valor: 5 }, { rotulo: 'B', valor: 3 }, { rotulo: 'C', valor: 2 }], { altura: 140 })
  assert.match(svg, /<path class="grafico-acumulado"/)
  const d = svg.match(/<path class="grafico-acumulado" d="([^"]+)"/)[1]
  const segmentos = d.trim().split(/\s+(?=[ML])/)
  const ultimo = segmentos[segmentos.length - 1]
  const [, yTexto] = ultimo.replace(/^[ML]/, '').trim().split(/\s+/)
  const y = Number(yTexto)
  // topo da área útil (100%) = altura(140) - margemInferior(24) - areaAltura(106) = 10
  assert.ok(Math.abs(y - 10) < 1, `último ponto deveria estar no topo (y≈10), veio ${y}`)
})

test('pareto com um único ponto não lança e desenha um ponto isolado em vez de <path>', () => {
  const svg = pareto([{ rotulo: 'Único', valor: 7 }], {})
  assert.doesNotMatch(svg, /<path class="grafico-acumulado"/)
  assert.match(svg, /<circle/)
})

// ── sparkline ──

test('sparkline de N pontos devolve <polyline> com N pares de coordenadas e um <circle> no último ponto', () => {
  const svg = sparkline([1, 4, 2, 8, 5])
  const pontos = svg.match(/points="([^"]+)"/)[1].trim().split(/\s+/)
  assert.equal(pontos.length, 5)
  assert.match(svg, /<circle/)
})

test('sparkline com 0 pontos devolve o estado vazio; com 1 ponto degenera num ponto só, sem lançar', () => {
  assert.match(sparkline([]), /Sem dado/)
  const svg = sparkline([9])
  const pontos = svg.match(/points="([^"]+)"/)[1].trim().split(/\s+/)
  assert.equal(pontos.length, 1)
})

test('sparkline ignora entradas não numéricas e ainda desenha o restante', () => {
  const svg = sparkline([1, null, 'x', 4])
  const pontos = svg.match(/points="([^"]+)"/)[1].trim().split(/\s+/)
  assert.equal(pontos.length, 2)
})

test('sparkline aceita opcoes.tom e usa o tom accent quando nenhum é informado', () => {
  const semTom = sparkline([1, 2, 3])
  assert.match(semTom, /<g class="grafico-tom-accent">/)
  const comTom = sparkline([1, 2, 3], { tom: 'erro' })
  assert.match(comTom, /<g class="grafico-tom-erro">/)
})

// ── aria-label resume máximo/mínimo/último (populated) ──

test('aria-label de barras/linha resume máximo, mínimo e último ponto da série', () => {
  const svg = barras([{ rotulo: 'A', valor: 1 }, { rotulo: 'B', valor: 9 }, { rotulo: 'C', valor: 4 }], {})
  const ariaLabel = svg.match(/aria-label="([^"]+)"/)[1]
  assert.match(ariaLabel, /Máximo/)
  assert.match(ariaLabel, /Mínimo/)
  assert.match(ariaLabel, /Último/)
})

// ── rótulos de eixo limitados a 6 por gráfico (overflow) ──

test('rótulos de eixo nunca passam de 6, mesmo com mais categorias — a barra continua existindo', () => {
  const serie = Array.from({ length: 12 }, (_, i) => ({ rotulo: `Cat${i}`, valor: i + 1 }))
  const svg = barras(serie, {})
  const rects = svg.match(/<rect/g) || []
  assert.equal(rects.length, 12, 'todas as 12 barras são desenhadas, só o rótulo é que raleia')
  const rotulos = svg.match(/<text class="grafico-rotulo"/g) || []
  assert.ok(rotulos.length <= 6, `esperado <= 6 rótulos, veio ${rotulos.length}`)
  assert.match(svg, />Cat0</, 'o primeiro rótulo é mantido')
  assert.match(svg, />Cat11</, 'o último rótulo é mantido')
})

// ── nenhuma função devolve undefined; nenhuma lança para objeto sem os campos esperados ──

test('nenhuma das seis funções devolve undefined para entrada vazia ou malformada', () => {
  for (const fn of [barras, linha, pareto, cartaControle]) {
    assert.notEqual(fn([{}, { rotulo: 'sem valor' }]), undefined)
  }
  assert.notEqual(limitesControle([{}]), undefined)
  assert.notEqual(sparkline([{}]), undefined)
})
