// ══════════════════════════════════════════════════════════════════
// Rotinas por calendário de /transportes — núcleo puro
//
// Sem API de navegador: testável em Node (tests/transportes-rotinas.test.js).
// A leitura numérica passa por validarNumero de /maquinas/numeros.js — o campo
// de medição é `type="text" inputmode="decimal"` pelo mesmo motivo registrado
// lá: `type="number"` descarta a vírgula e "6,31 V" chegaria como 631.
// ══════════════════════════════════════════════════════════════════
import { validarNumero } from '../maquinas/numeros.js'

export const JANELA_PROXIMA_DIAS = 3

// Quantos valores coletar por item (`registro_por` do plano).
export const PONTOS = {
  banco: ['Banco'],
  bateria: [1, 2, 3, 4, 5, 6].map(b => `B${b}`),
  elemento: [1, 2, 3, 4, 5, 6].flatMap(b => [1, 2, 3].map(e => `B${b}·${e}`)),
  pneu: ['Diant. esq.', 'Diant. dir.', 'Tras. esq.', 'Tras. dir.'],
}

/** true/false contra a faixa do item; null quando o item não declara faixa (ex.: pressão até haver manual). */
export function avaliarMedida(valor, item) {
  if (valor == null || !Number.isFinite(valor)) return null
  const { minimo, maximo } = item
  if (minimo == null && maximo == null) return null
  if (minimo != null && valor < Number(minimo)) return false
  if (maximo != null && valor > Number(maximo)) return false
  return true
}

/** Diferença entre o maior e o menor ponto; `estoura` quando passa de dif_max. */
export function diferencaEntrePontos(valores, difMax) {
  const v = valores.filter(x => x != null && Number.isFinite(x))
  if (v.length < 2) return { spread: null, estoura: false }
  const spread = Math.max(...v) - Math.min(...v)
  // 1e-9: 6,45 − 6,35 em ponto flutuante dá 0,1000000000000005 e reprovaria um limite de 0,10.
  return { spread, estoura: difMax != null && spread > Number(difMax) + 1e-9 }
}

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = s => { const [a, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d) }

export const hojeISO = () => iso(new Date())

/** Data-só vira dia LOCAL: new Date('2026-10-07') é meia-noite UTC, dia 6 às 21h neste fuso. */
export function somarDias(dataISO, dias) {
  const d = parse(dataISO)
  d.setDate(d.getDate() + dias)
  return iso(d)
}

export function situacaoRotina(ultimaISO, intervaloDias, hoje = hojeISO()) {
  if (!ultimaISO) return { estado: 'nunca', proxima: null, dias: null }
  const proxima = somarDias(ultimaISO, intervaloDias)
  const dias = Math.round((parse(proxima) - parse(hoje)) / 86400000)
  const estado = dias < 0 ? 'vencida' : dias <= JANELA_PROXIMA_DIAS ? 'proxima' : 'em_dia'
  return { estado, proxima, dias }
}

/**
 * Transforma o que a tela coletou nas linhas de transp_execucao_valores.
 * `leituras`: { 'itemId|ponto': texto } — para item `check`, ponto '' e texto 'ok' | 'nc'.
 * Check sem resposta é erro (rotina pela metade não é execução); medida em branco é "não medido" e fica de fora.
 */
export function montarLinhas(itens, leituras) {
  const linhas = []
  const erros = []
  let checksSemResposta = 0
  let medidasEmBranco = 0

  for (const item of itens) {
    if (item.tipo === 'check') {
      const r = leituras[`${item.id}|`]
      if (r !== 'ok' && r !== 'nc') { checksSemResposta++; continue }
      linhas.push({ item_id: item.id, ponto: '', valor: null, conforme: r === 'ok', observacao: null })
      continue
    }
    for (const ponto of PONTOS[item.registro_por] || []) {
      const texto = leituras[`${item.id}|${ponto}`]
      const res = validarNumero(texto, { rotulo: `${item.descricao} (${ponto})` })
      if (!res.ok) { erros.push(res.erro); continue }
      if (res.valor == null) { medidasEmBranco++; continue }
      linhas.push({ item_id: item.id, ponto, valor: res.valor, conforme: avaliarMedida(res.valor, item), observacao: null })
    }
  }
  if (checksSemResposta) erros.push(`${checksSemResposta} item(ns) do checklist sem resposta (Conforme / Não conforme)`)
  return { linhas, erros, medidasEmBranco }
}

/** Itens fora da faixa + itens cuja dispersão entre pontos passou de dif_max. */
export function naoConformidades(itens, linhas) {
  const porItem = new Map(itens.map(i => [i.id, i]))
  const nc = linhas.filter(l => l.conforme === false).map(l => ({ item: porItem.get(l.item_id), ponto: l.ponto, valor: l.valor }))
  const dispersoes = []
  for (const item of itens) {
    if (item.dif_max == null) continue
    const { spread, estoura } = diferencaEntrePontos(linhas.filter(l => l.item_id === item.id).map(l => l.valor), item.dif_max)
    if (estoura) dispersoes.push({ item, spread })
  }
  return { nc, dispersoes, total: nc.length + dispersoes.length }
}
