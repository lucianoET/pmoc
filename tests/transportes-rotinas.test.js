// tests/transportes-rotinas.test.js — núcleo puro das rotinas por calendário + coerência do seed.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { avaliarMedida, diferencaEntrePontos, situacaoRotina, somarDias, montarLinhas, naoConformidades, PONTOS } from '../transportes/rotinas.js'

const volt = { id: 1, tipo: 'medida', descricao: 'Tensão', registro_por: 'bateria', minimo: 6.31, maximo: 6.45, dif_max: 0.10 }
const chk = { id: 2, tipo: 'check', descricao: 'Freio' }

test('faixa: dentro, fora e sem faixa', () => {
  assert.equal(avaliarMedida(6.31, volt), true)
  assert.equal(avaliarMedida(6.30, volt), false)
  assert.equal(avaliarMedida(6.46, volt), false)
  assert.equal(avaliarMedida(30, { minimo: null, maximo: null }), null)
})

test('dispersão: 0,10 exato não estoura (ponto flutuante); 0,11 estoura', () => {
  assert.equal(diferencaEntrePontos([6.35, 6.45], 0.10).estoura, false)
  assert.equal(diferencaEntrePontos([6.35, 6.46], 0.10).estoura, true)
  assert.equal(diferencaEntrePontos([6.35], 0.10).spread, null)
})

test('vencimento por calendário, em dia local', () => {
  assert.equal(somarDias('2026-01-31', 30), '2026-03-02')
  assert.equal(situacaoRotina(null, 7).estado, 'nunca')
  assert.equal(situacaoRotina('2026-10-01', 7, '2026-10-07').estado, 'proxima')
  assert.equal(situacaoRotina('2026-10-01', 7, '2026-10-09').estado, 'vencida')
  assert.equal(situacaoRotina('2026-10-07', 30, '2026-10-07').estado, 'em_dia')
})

test('vírgula brasileira vira número; check sem resposta e lixo são recusados', () => {
  const l = {}
  PONTOS.bateria.forEach((p, i) => { l[`1|${p}`] = i === 0 ? '6,31' : '' })
  l['2|'] = 'ok'
  const r = montarLinhas([volt, chk], l)
  assert.deepEqual(r.erros, [])
  assert.equal(r.linhas.find(x => x.item_id === 1).valor, 6.31)
  assert.equal(r.medidasEmBranco, 5)
  assert.ok(montarLinhas([chk], {}).erros[0].includes('sem resposta'))
  assert.ok(montarLinhas([volt], { '1|B1': '6,3x' }).erros.length >= 1)
  assert.ok(montarLinhas([volt], { '1|B1': '1.200' }).erros[0].includes('ambíguo'))
})

test('não conformidade: valor fora da faixa e dispersão entre baterias', () => {
  const l = [{ item_id: 1, ponto: 'B1', valor: 6.40, conforme: true }, { item_id: 1, ponto: 'B2', valor: 6.20, conforme: false }]
  const r = naoConformidades([volt], l)
  assert.equal(r.nc.length, 1)
  assert.equal(r.dispersoes.length, 1)
})

test('seed: 6 rotinas e 48 itens', () => {
  const sql = fs.readFileSync(new URL('../supabase/66_transportes_vpx_seed.sql', import.meta.url), 'utf8')
  assert.equal((sql.match(/insert into transp_rotinas/g) || []).length, 6)
  assert.equal((sql.match(/^  \(\d+, /gm) || []).length, 48)
})

test('todo onclick/oninput/onchange das rotinas está exposto em window e existe no HTML/JS', () => {
  const app = fs.readFileSync(new URL('../transportes/app.js', import.meta.url), 'utf8')
  const html = fs.readFileSync(new URL('../transportes/index.html', import.meta.url), 'utf8')
  const expostas = app.slice(app.indexOf('function exporNoWindow'))
  for (const fn of ['abrirModalRotina', 'salvarRotina', 'verExecucao', 'atualizarResumoRotina', 'marcarChecksConformes']) {
    assert.ok(new RegExp(`\\b${fn},`).test(expostas), `${fn} fora de exporNoWindow`)
    assert.ok(new RegExp(`function ${fn}\\(`).test(app), `${fn} não definida`)
  }
  for (const id of ['rotinas-bloco', 'btn-exec-rotina', 'lista-rotinas', 'execucoes-bloco', 'planos-rotinas', 'rt-progresso', 'rt-marcar-ok', 'kpi-rotinas', 'tb-execucoes', 'modal-rotina', 'modal-execucao-ver', 'rt-itens', 'rt-resumo', 'rt-erro', 'ev-corpo', 'ev-titulo']) {
    assert.ok(html.includes(`id="${id}"`), `#${id} ausente do HTML`)
  }
})

test('campos de medição não são type="number" (a vírgula seria descartada)', () => {
  const app = fs.readFileSync(new URL('../transportes/app.js', import.meta.url), 'utf8')
  const html = fs.readFileSync(new URL('../transportes/index.html', import.meta.url), 'utf8')
  assert.ok(!/data-item[^>]*type="number"|type="number"[^>]*data-item/.test(app))
  assert.ok(!/id="rt-uso"[^>]*type="number"/.test(html))
})

test('rótulos de periodicidade e prazo', async () => {
  const { rotuloPeriodicidade, textoPrazo } = await import('../transportes/rotinas.js')
  assert.equal(rotuloPeriodicidade(1), 'Diária')
  assert.equal(rotuloPeriodicidade(365), 'Anual')
  assert.equal(rotuloPeriodicidade(45), 'a cada 45 dias')
  assert.equal(textoPrazo({ estado: 'nunca', dias: null }), 'nunca executada')
  assert.equal(textoPrazo({ estado: 'proxima', dias: 0 }), 'vence hoje')
  assert.equal(textoPrazo({ estado: 'vencida', dias: -1 }), 'atrasada 1 dia')
  assert.equal(textoPrazo({ estado: 'em_dia', dias: 12 }), 'em 12 dias')
})
