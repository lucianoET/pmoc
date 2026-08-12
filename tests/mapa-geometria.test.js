const assert = require('node:assert/strict')
const test = require('node:test')

const modulo = import('../mapa/mapa-geometria.js')

// ── calcAreaM2 — fecha por medição a suposição A2 da pesquisa da Fase 10 ──
// A pesquisa leu calcAreaM2 (portada do editor legado) e cruzou com a
// literatura (fórmula por excesso esférico, mesma família de turf.js
// area()), mas nunca executou o cálculo contra um valor de referência.
// Enquanto ninguém medir, os metros quadrados que o editor exibir são um
// número que ninguém conferiu. Este é o caso que mede.
//
// Quadrado de ~100 m de lado na latitude do CMASM — deslocamento em
// latitude e em longitude calculado no planejamento a partir do
// comprimento de grau naquela latitude (≈ -22,84°).
const QUADRADO_100M = [
  [-22.84000000, -43.10600000],
  [-22.84000000, -43.10502526],
  [-22.83909563, -43.10502526],
  [-22.83909563, -43.10600000],
]

test('calcAreaM2 do quadrado de 100 m de lado fica dentro de 1% de 10 000 m² — valor medido no planejamento: 10 044,89 m² (0,45% acima, diferença de modelo esférico vs. área de referência elipsoidal, não defeito)', async () => {
  const { calcAreaM2 } = await modulo
  const area = calcAreaM2(QUADRADO_100M)
  assert.ok(Math.abs(area - 10000) < 100, `área ${area} fora da folga de 1% de 10 000 m²`)
})

test('calcAreaM2 devolve o mesmo valor com a ordem dos vértices invertida — o sinal do somatório não vaza', async () => {
  const { calcAreaM2 } = await modulo
  const direto = calcAreaM2(QUADRADO_100M)
  const invertido = calcAreaM2([...QUADRADO_100M].reverse())
  assert.equal(invertido, direto)
})

test('calcAreaM2 devolve 0 para lista nula, vazia ou com menos de três vértices, em vez de lançar', async () => {
  const { calcAreaM2 } = await modulo
  assert.equal(calcAreaM2(null), 0)
  assert.equal(calcAreaM2([]), 0)
  assert.equal(calcAreaM2([[-22.84, -43.1], [-22.83, -43.1]]), 0)
})

// ── normalizadores de terreno — mesmo vetor de tests/tema.test.js ──────
test('normalizarFlora aceita só os três valores da lista fechada', async () => {
  const { normalizarFlora } = await modulo
  assert.equal(normalizarFlora('gramado'), 'gramado')
  assert.equal(normalizarFlora('capim_colonial'), 'capim_colonial')
  assert.equal(normalizarFlora('mata_fechada'), 'mata_fechada')
  assert.equal(normalizarFlora('inventado'), null)
})

test('normalizarFlora recusa caixa diferente, espaço em volta, texto vazio, nulo, número e carga de marcação', async () => {
  const { normalizarFlora } = await modulo
  assert.equal(normalizarFlora('GRAMADO'), null)
  assert.equal(normalizarFlora(' gramado '), null)
  assert.equal(normalizarFlora(''), null)
  assert.equal(normalizarFlora(null), null)
  assert.equal(normalizarFlora(42), null)
  assert.equal(normalizarFlora('"><script>'), null)
})

test('normalizarInclinacao aceita só os três valores da lista fechada e recusa o resto', async () => {
  const { normalizarInclinacao } = await modulo
  assert.equal(normalizarInclinacao('plano'), 'plano')
  assert.equal(normalizarInclinacao('moderado'), 'moderado')
  assert.equal(normalizarInclinacao('acentuado'), 'acentuado')
  assert.equal(normalizarInclinacao('PLANO'), null)
  assert.equal(normalizarInclinacao(' plano '), null)
  assert.equal(normalizarInclinacao(''), null)
  assert.equal(normalizarInclinacao(null), null)
  assert.equal(normalizarInclinacao(42), null)
  assert.equal(normalizarInclinacao('"><script>'), null)
})

test('normalizarLimpeza aceita só os três valores da lista fechada e recusa o resto', async () => {
  const { normalizarLimpeza } = await modulo
  assert.equal(normalizarLimpeza('limpa'), 'limpa')
  assert.equal(normalizarLimpeza('media'), 'media')
  assert.equal(normalizarLimpeza('densa'), 'densa')
  assert.equal(normalizarLimpeza('LIMPA'), null)
  assert.equal(normalizarLimpeza(' limpa '), null)
  assert.equal(normalizarLimpeza(''), null)
  assert.equal(normalizarLimpeza(null), null)
  assert.equal(normalizarLimpeza(42), null)
  assert.equal(normalizarLimpeza('"><script>'), null)
})

// ── calcCompatCliente — reproduz as saídas do legado ────────────────────
test('calcCompatCliente devolve motosserra e roçadeira para mata fechada, qualquer inclinação/limpeza', async () => {
  const { calcCompatCliente } = await modulo
  assert.deepEqual(calcCompatCliente('mata_fechada', 'plano', 'limpa'), ['motosserra', 'roçadeira'])
})

test('calcCompatCliente devolve só roçadeira para inclinação acentuada', async () => {
  const { calcCompatCliente } = await modulo
  assert.deepEqual(calcCompatCliente('gramado', 'acentuado', 'densa'), ['roçadeira'])
})

test('calcCompatCliente devolve só cortador_grama para gramado plano e limpo', async () => {
  const { calcCompatCliente } = await modulo
  assert.deepEqual(calcCompatCliente('gramado', 'plano', 'limpa'), ['cortador_grama'])
})

test('calcCompatCliente devolve cortador_grama e roçadeira para gramado plano com limpeza média', async () => {
  const { calcCompatCliente } = await modulo
  assert.deepEqual(calcCompatCliente('gramado', 'plano', 'media'), ['cortador_grama', 'roçadeira'])
})

test('calcCompatCliente devolve cortador_grama e roçadeira para capim colonial plano e limpo', async () => {
  const { calcCompatCliente } = await modulo
  assert.deepEqual(calcCompatCliente('capim_colonial', 'plano', 'limpa'), ['cortador_grama', 'roçadeira'])
})

test('calcCompatCliente devolve lista vazia quando falta qualquer um dos três atributos', async () => {
  const { calcCompatCliente } = await modulo
  assert.deepEqual(calcCompatCliente(null, 'plano', 'limpa'), [])
  assert.deepEqual(calcCompatCliente('gramado', null, 'limpa'), [])
  assert.deepEqual(calcCompatCliente('gramado', 'plano', null), [])
})

// ── Pitfall 1 — categoria real do banco passa a casar depois da normalização ──
// Sem normalizarCategoria, esta zona (mata fechada, os três atributos
// definidos) devolveria a lista de compatíveis vazia mesmo com máquinas
// reais cadastradas — o modo de falha silenciosa que a pesquisa da Fase 10
// descreveu. Este caso prova que rocadeira/motoserra (grafia do banco)
// passam a bater, e que minitrator/trator (que a regra nunca considerou)
// saem visíveis na lista de não classificados, não descartados em silêncio.
test('maquinasParaZona: categoria real do banco (rocadeira, motoserra) vira compatível depois da normalização; minitrator e trator saem em semMapeamento', async () => {
  const { maquinasParaZona } = await modulo
  const zona = { flora: 'mata_fechada', inclinacao: 'moderado', limpeza: 'densa' }
  const ativos = [
    { id: 1, categoria: 'rocadeira' },
    { id: 2, categoria: 'motoserra' },
    { id: 3, categoria: 'minitrator' },
    { id: 4, categoria: 'trator' },
  ]
  const { compativeis, semMapeamento } = maquinasParaZona(zona, ativos)
  assert.notEqual(compativeis.length, 0, 'lista de compatíveis não deveria sair vazia com máquinas reais cadastradas')
  assert.ok(compativeis.some((a) => a.id === 1), 'roçadeira (rocadeira normalizada) deveria estar em compatíveis')
  assert.ok(compativeis.some((a) => a.id === 2), 'motosserra (motoserra normalizada) deveria estar em compatíveis')
  assert.ok(semMapeamento.some((a) => a.id === 3), 'minitrator deveria sair em semMapeamento, não adivinhado')
  assert.ok(semMapeamento.some((a) => a.id === 4), 'trator deveria sair em semMapeamento, não adivinhado')
})

// ── resolverPosicao — própria vence herdada, envelope recusa o resto ────
test('resolverPosicao prefere a posição própria do ativo quando ela está dentro do envelope', async () => {
  const { resolverPosicao } = await modulo
  const ativo = { lat: -22.84, lon: -43.1 }
  const local = { lat: -22.85, lon: -43.11 }
  const resultado = resolverPosicao(ativo, local)
  assert.deepEqual(resultado, { lat: -22.84, lon: -43.1, origem: 'propria' })
})

test('resolverPosicao cai para a posição herdada do local quando o ativo não tem posição própria', async () => {
  const { resolverPosicao } = await modulo
  const ativo = { lat: null, lon: null }
  const local = { lat: -22.85, lon: -43.11 }
  const resultado = resolverPosicao(ativo, local)
  assert.deepEqual(resultado, { lat: -22.85, lon: -43.11, origem: 'herdada' })
})

test('resolverPosicao devolve origem nula quando não há posição própria nem herdada, e não lança com local ausente', async () => {
  const { resolverPosicao } = await modulo
  assert.deepEqual(resolverPosicao({}, null), { lat: null, lon: null, origem: null })
  assert.deepEqual(resolverPosicao({}, undefined), { lat: null, lon: null, origem: null })
})

test('resolverPosicao recusa coordenada fora do envelope, inclusive o par latitude/longitude trocado', async () => {
  const { resolverPosicao } = await modulo
  // lat/lon trocados: -43.1 (fora da faixa de latitude) na coluna de latitude,
  // -22.84 (fora da faixa de longitude) na coluna de longitude
  const ativoTrocado = { lat: -43.1, lon: -22.84 }
  const local = { lat: -43.1, lon: -22.84 }
  assert.deepEqual(resolverPosicao(ativoTrocado, local), { lat: null, lon: null, origem: null })
})

// ── dentroDoEnvelope ──────────────────────────────────────────────────
test('dentroDoEnvelope aceita coordenada dentro da faixa do CMASM e recusa fora dela', async () => {
  const { dentroDoEnvelope } = await modulo
  assert.equal(dentroDoEnvelope(-22.8396, -43.1094), true)
  assert.equal(dentroDoEnvelope(0, 0), false)
  assert.equal(dentroDoEnvelope(-43.1, -22.84), false)
  assert.equal(dentroDoEnvelope(null, -43.1), false)
  assert.equal(dentroDoEnvelope(-22.84, undefined), false)
})

// ── linkDoModulo ──────────────────────────────────────────────────────
test('linkDoModulo monta a rota com o parâmetro ativo para módulo conhecido e id inteiro', async () => {
  const { linkDoModulo } = await modulo
  assert.equal(linkDoModulo('maquinas', 7), '/maquinas?ativo=7')
  assert.equal(linkDoModulo('transportes', 43), '/transportes?ativo=43')
})

test('linkDoModulo devolve nulo para módulo fora da lista fechada', async () => {
  const { linkDoModulo } = await modulo
  assert.equal(linkDoModulo('refrigeracao', 1), null)
  assert.equal(linkDoModulo('inventado', 1), null)
})

test('linkDoModulo devolve nulo para identificador em texto, fracionário ou nulo', async () => {
  const { linkDoModulo } = await modulo
  assert.equal(linkDoModulo('maquinas', '7'), null)
  assert.equal(linkDoModulo('maquinas', 7.5), null)
  assert.equal(linkDoModulo('maquinas', null), null)
  assert.equal(linkDoModulo('maquinas', undefined), null)
})

test('importar o módulo dentro do Node, sem nenhuma API de navegador disponível, não lança', async () => {
  const { FLORAS } = await modulo
  assert.deepEqual(FLORAS, ['gramado', 'capim_colonial', 'mata_fechada'])
})
