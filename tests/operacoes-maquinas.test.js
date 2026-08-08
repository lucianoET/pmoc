const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const moduloPath = path.join(__dirname, '..', 'maquinas', 'operacoes.js')

test('módulo de operações existe', () => {
  assert.ok(fs.existsSync(moduloPath), 'maquinas/operacoes.js deve existir')
})

test('valida os campos obrigatórios de uma operação', () => {
  const { validarOperacao } = require(moduloPath)

  assert.deepEqual(validarOperacao({}), [
    'Selecione uma área.',
    'Selecione uma máquina.',
    'Informe a data programada.',
  ])
  assert.deepEqual(validarOperacao({ area_id: 1, ativo_id: 2, data_programada: '2026-08-08' }), [])
})

test('agrupa operações nas colunas do kanban', () => {
  const { agruparOperacoes } = require(moduloPath)
  const grupos = agruparOperacoes([
    { id: 1, status: 'programada' },
    { id: 2, status: 'em_execucao' },
    { id: 3, status: 'concluida' },
    { id: 4, status: 'cancelada' },
    { id: 5, status: 'desconhecida' },
  ])

  assert.deepEqual(grupos.programada.map(item => item.id), [1, 5])
  assert.deepEqual(grupos.em_execucao.map(item => item.id), [2])
  assert.deepEqual(grupos.concluida.map(item => item.id), [3])
  assert.deepEqual(grupos.cancelada.map(item => item.id), [4])
})

test('combina operações e OS no calendário mensal', () => {
  const { criarEventosCalendario } = require(moduloPath)
  const eventos = criarEventosCalendario(
    [
      { id: 'op-1', data_programada: '2026-08-12', tipo_servico: 'corte' },
      { id: 'op-2', data_programada: '2026-09-01', tipo_servico: 'poda' },
    ],
    [
      { id: 'os-1', data_abertura: '2026-08-03', tipo: 'preventiva' },
      { id: 'os-2', data_abertura: '2026-07-31', tipo: 'corretiva' },
    ],
    2026,
    7,
  )

  assert.deepEqual(eventos.map(evento => [evento.data, evento.origem, evento.id]), [
    ['2026-08-03', 'os', 'os-1'],
    ['2026-08-12', 'operacao', 'op-1'],
  ])
})

test('projeta o novo horímetro sem aceitar horas inválidas', () => {
  const { projetarUsoTotal } = require(moduloPath)

  assert.equal(projetarUsoTotal(10.5, 2.25), 12.75)
  assert.throws(() => projetarUsoTotal(10, 0), /maior que zero/)
  assert.throws(() => projetarUsoTotal(10, -1), /maior que zero/)
})