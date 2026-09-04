const assert = require('node:assert/strict')
const test = require('node:test')

// Gate do núcleo genérico de kanban e calendário (Fase 13 Plano 03, D-06/D-07,
// PLAT-08/PLAT-09). Cobre os núcleos puros em shared/kanban.js e
// shared/calendario.js com dado sintético — nenhum campo de Máquinas
// aparece aqui. A outra metade da prova é que
// tests/operacoes-maquinas.test.js e tests/integracao-operacoes-maquinas.test.js
// continuam passando SEM UMA LINHA MUDADA: eles protegem o comportamento
// observável de Máquinas, este arquivo protege a genericidade da extração.
const { agruparKanban, htmlKanban } = require('../shared/kanban.js')
const {
  DIAS_SEMANA, MESES, gradeMes, agruparPorData, eventosDoMes, htmlCalendario,
} = require('../shared/calendario.js')

test('importar shared/kanban.js e shared/calendario.js em Node puro não lança', () => {
  assert.ok(agruparKanban)
  assert.ok(htmlKanban)
  assert.ok(gradeMes)
  assert.ok(agruparPorData)
  assert.ok(eventosDoMes)
  assert.ok(htmlCalendario)
  assert.equal(DIAS_SEMANA.length, 7)
  assert.equal(MESES.length, 12)
})

// ── shared/kanban.js ───────────────────────────────────────────────────

const COLUNAS_TESTE = [
  { id: 'aberta', rotulo: 'Aberta' },
  { id: 'fechada', rotulo: 'Fechada' },
]

test('agruparKanban([], colunas) devolve as duas chaves, ambas vazias', () => {
  const grupos = agruparKanban([], COLUNAS_TESTE)
  assert.deepEqual(Object.keys(grupos), ['aberta', 'fechada'])
  assert.deepEqual(grupos.aberta, [])
  assert.deepEqual(grupos.fechada, [])
})

test('agruparKanban: status fora da lista cai na primeira coluna, preservando a ordem de entrada', () => {
  const itens = [
    { id: 1, status: 'aberta' },
    { id: 2, status: 'fechada' },
    { id: 3, status: 'desconhecido' },
  ]
  const grupos = agruparKanban(itens, COLUNAS_TESTE)
  assert.deepEqual(grupos.aberta.map((x) => x.id), [1, 3])
  assert.deepEqual(grupos.fechada.map((x) => x.id), [2])
})

test('agruparKanban(itens, []) devolve objeto vazio e não lança', () => {
  assert.deepEqual(agruparKanban([{ id: 1, status: 'x' }], []), {})
})

test('agruparKanban aceita campoStatus alternativo por opções', () => {
  const itens = [{ id: 1, etapa: 'fechada' }]
  const grupos = agruparKanban(itens, COLUNAS_TESTE, { campoStatus: 'etapa' })
  assert.deepEqual(grupos.fechada.map((x) => x.id), [1])
})

test('htmlKanban desenha a contagem de cada coluna, inclusive zero', () => {
  const grupos = agruparKanban([{ id: 1, status: 'aberta' }], COLUNAS_TESTE)
  const html = htmlKanban(grupos, COLUNAS_TESTE, { cartao: (item) => `<article>${item.id}</article>`, vazio: 'Nenhum item' })
  assert.match(html, /<span class="kanban-count">1<\/span>/)
  assert.match(html, /<span class="kanban-count">0<\/span>/)
})

test('htmlKanban desenha o bloco de coluna vazia com o rótulo recebido em opcoes.vazio', () => {
  const grupos = agruparKanban([], COLUNAS_TESTE)
  const html = htmlKanban(grupos, COLUNAS_TESTE, { cartao: () => '', vazio: 'Nada por aqui' })
  assert.match(html, /<div class="empty"[^>]*><p>Nada por aqui<\/p><\/div>/)
})

test('htmlKanban sem opcoes.vazio cai para "Nenhum item"', () => {
  const grupos = agruparKanban([], COLUNAS_TESTE)
  const html = htmlKanban(grupos, COLUNAS_TESTE, { cartao: () => '' })
  assert.match(html, /Nenhum item/)
})

test('htmlKanban: cartão sem metadado opcional não injeta "undefined" no HTML', () => {
  const grupos = agruparKanban([{ id: 1, status: 'aberta' }], COLUNAS_TESTE)
  const cartao = (item) => `<article>${item.id}${item.maquina ? ` · ${item.maquina}` : ''}</article>`
  const html = htmlKanban(grupos, COLUNAS_TESTE, { cartao, vazio: 'Nenhum item' })
  assert.doesNotMatch(html, /undefined/)
})

test('htmlKanban usa a marcação kanban-col/kanban-title existente, sem classe nova', () => {
  const grupos = agruparKanban([], COLUNAS_TESTE)
  const html = htmlKanban(grupos, COLUNAS_TESTE, { cartao: () => '', vazio: 'x' })
  assert.match(html, /<section class="kanban-col">/)
  assert.match(html, /<div class="kanban-title">/)
})

// ── shared/calendario.js ───────────────────────────────────────────────

test('gradeMes(2026,1) — fevereiro de 2026, não bissexto, 28 dias', () => {
  assert.equal(gradeMes(2026, 1).totalDias, 28)
})

test('gradeMes(2024,1) — fevereiro de 2024, bissexto, 29 dias', () => {
  assert.equal(gradeMes(2024, 1).totalDias, 29)
})

test('gradeMes de um mês que começa no domingo devolve zero células vazias antes do dia 1', () => {
  // Fevereiro de 2026 começa num domingo.
  const grade = gradeMes(2026, 1)
  assert.equal(grade.primeiroDiaSemana, 0)
})

test('gradeMes devolve, para cada dia, a data em texto ISO com zero à esquerda', () => {
  const grade = gradeMes(2026, 0)
  assert.equal(grade.dias[0].data, '2026-01-01')
  assert.equal(grade.dias[8].data, '2026-01-09')
})

test('gradeMes com ano/mês fora de faixa devolve grade vazia, não lança', () => {
  assert.deepEqual(gradeMes(NaN, 1), { primeiroDiaSemana: 0, totalDias: 0, dias: [] })
  assert.deepEqual(gradeMes(2026, 12), { primeiroDiaSemana: 0, totalDias: 0, dias: [] })
  assert.deepEqual(gradeMes(2026, -1), { primeiroDiaSemana: 0, totalDias: 0, dias: [] })
})

test('agruparPorData ignora evento com data nula, vazia ou fora do formato ISO, sem lançar', () => {
  const eventos = [
    { id: 1, data: '2026-08-03' },
    { id: 2, data: null },
    { id: 3, data: '' },
    { id: 4, data: '03/08/2026' },
    { id: 5 },
  ]
  const grupos = agruparPorData(eventos)
  assert.deepEqual(Object.keys(grupos), ['2026-08-03'])
  assert.equal(grupos['2026-08-03'].length, 1)
})

test('eventosDoMes(eventos, 2026, 7) devolve só os de agosto de 2026, ordenados por data crescente', () => {
  const eventos = [
    { id: 'op-1', data: '2026-08-12' },
    { id: 'op-2', data: '2026-09-01' },
    { id: 'os-1', data: '2026-08-03' },
    { id: 'os-2', data: '2026-07-31' },
  ]
  const resultado = eventosDoMes(eventos, 2026, 7)
  assert.deepEqual(resultado.map((e) => e.id), ['os-1', 'op-1'])
})

test('htmlCalendario marca com a classe hoje a célula do dia recebido em opcoes.hoje', () => {
  const html = htmlCalendario(2026, 0, [], { hoje: 9 })
  assert.match(html, /<div class="calendar-day hoje">/)
})

test('htmlCalendario não marca hoje quando o dia não pertence ao mês', () => {
  const html = htmlCalendario(2026, 0, [], { hoje: 40 })
  assert.doesNotMatch(html, /calendar-day hoje/)
})

test('evento sem título recebe o rótulo da origem em vez de string vazia', () => {
  const eventos = [{ id: 1, data: '2026-01-05', origem: 'operacao' }]
  const html = htmlCalendario(2026, 0, eventos, {
    rotuloEvento: (e) => (e.origem === 'operacao' ? 'Operação' : 'OS'),
  })
  assert.match(html, /Operação · Operação/)
})

test('0/1/N eventos por dia empilham em .calendar-event, sem limite artificial', () => {
  const eventos = [
    { id: 1, data: '2026-01-05', origem: 'operacao', titulo: 'a' },
    { id: 2, data: '2026-01-05', origem: 'os', titulo: 'b' },
    { id: 3, data: '2026-01-05', origem: 'os', titulo: 'c' },
  ]
  const html = htmlCalendario(2026, 0, eventos, {})
  const ocorrencias = html.match(/calendar-event/g) || []
  assert.equal(ocorrencias.length, 3)
})

test('nenhuma das funções de kanban ou calendário toca API de navegador', () => {
  assert.doesNotThrow(() => {
    agruparKanban([{ id: 1, status: 'aberta' }], COLUNAS_TESTE)
    htmlKanban({ aberta: [], fechada: [] }, COLUNAS_TESTE, { cartao: () => '', vazio: 'x' })
    gradeMes(2026, 5)
    agruparPorData([{ id: 1, data: '2026-01-01' }])
    eventosDoMes([{ id: 1, data: '2026-01-01' }], 2026, 0)
    htmlCalendario(2026, 5, [], { hoje: 1 })
  })
})
