// ══════════════════════════════════════════════════════════════════
// shared/gantt.js — linha do tempo em CSS grid, sem canvas e sem
// biblioteca de gráfico (D-03, D-13-04, GEQ-03).
//
// (1) Por que existe: nenhum módulo do repositório tem Gantt hoje, e seria
// escrito duas vezes assim que dois consumidores precisassem dele (o
// /gestao de Ações e, depois, os painéis que já leem OS por data). A
// posição de cada barra é sempre porcentagem do intervalo pedido — nunca
// pixel fixo — calculada por diferença de dias entre datas ISO
// `AAAA-MM-DD`, no mesmo estilo funcional de
// maquinas/operacoes.js#criarEventosCalendario.
//
// (2) O que ele NÃO faz: não sabe nome de tabela nem vocabulário de
// estado. O tom de cada barra (`item.tom`) é resolvido por quem chama, a
// partir de shared/fluxo.js#tomDaEtapa — este arquivo só sabe desenhar um
// tom já resolvido. `linhasGantt` nunca lança: item com data ausente ou
// mal formada é omitido e contado em `ignorados`, e quem desenha (a tela)
// decide o que fazer com esse número.
//
// (3) Item sem data de fim usa hoje como fim e leva `aberto:true`
// (rótulo "em aberto" ao lado da barra) — mesmo padrão de OS em aberto do
// resto do projeto. A marca de "hoje" é o único elemento em accent do
// gráfico. Intervalo degenerado (um único dia) e item de um único dia
// nunca dividem por zero — resolvidos como casos próprios.
// ══════════════════════════════════════════════════════════════════

import { vazio } from './componentes.js'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DIA_MS = 24 * 60 * 60 * 1000
const TONS = ['neutro', 'info', 'ok', 'warn', 'erro']

// esc — mesma regra de escape de shared/componentes.js, replicada aqui
// (não importada) pelo mesmo motivo já registrado em shared/grafico.js e
// shared/indicadores.js: cada núcleo fica autocontido.
function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[c])
}

function _tomValido(tom) {
  return TONS.includes(tom) ? tom : 'neutro'
}

// paraData — valida AAAA-MM-DD por componente (rejeita 31/09, 29/02 fora
// de ano bissexto, etc.) em vez de confiar no parser de Date, que rola
// datas inválidas para o mês seguinte em vez de recusar.
function paraData(iso) {
  if (typeof iso !== 'string') return null
  const m = ISO_RE.exec(iso)
  if (!m) return null
  const ano = Number(m[0].slice(0, 4))
  const mes = Number(m[0].slice(5, 7))
  const dia = Number(m[0].slice(8, 10))
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null
  return data
}

function hojeUtc() {
  const agora = new Date()
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()))
}

function diasEntre(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DIA_MS)
}

/**
 * Calcula, para cada item com data de início válida dentro (ou cruzando)
 * o intervalo pedido, a posição da barra em porcentagem.
 *
 * @param {Array<{id, rotulo, inicio:string, fim?:string, tom?:string}>} itens
 * @param {{inicio:string, fim:string, hoje?:string}} opcoes
 * @returns {{linhas:Array<{id,rotulo,inicioPct:number,larguraPct:number,aberto:boolean,tom}>, hojePct:number|null, ignorados:number}}
 */
export function linhasGantt(itens, opcoes = {}) {
  const lista = itens || []
  const inicioIntervalo = paraData(opcoes.inicio)
  const fimIntervaloBruto = paraData(opcoes.fim)
  const hoje = paraData(opcoes.hoje) || hojeUtc()

  if (!inicioIntervalo || !fimIntervaloBruto) {
    return { linhas: [], ignorados: lista.length, hojePct: null }
  }

  // intervalo invertido (fim antes do início) é tratado como o único dia
  // do início — nunca produz um total de dias negativo.
  const fimIntervalo = fimIntervaloBruto.getTime() < inicioIntervalo.getTime()
    ? inicioIntervalo
    : fimIntervaloBruto

  const totalDias = diasEntre(inicioIntervalo, fimIntervalo) + 1

  let ignorados = 0
  const linhas = []

  for (const item of lista) {
    const inicioItem = paraData(item?.inicio)
    if (!inicioItem) {
      ignorados++
      continue
    }

    const aberto = !item.fim
    const fimItemBruto = aberto ? hoje : paraData(item.fim)
    if (!fimItemBruto) {
      ignorados++
      continue
    }

    const fimItem = fimItemBruto.getTime() < inicioItem.getTime() ? inicioItem : fimItemBruto

    const foraDoIntervalo = fimItem.getTime() < inicioIntervalo.getTime() ||
      inicioItem.getTime() > fimIntervalo.getTime()
    if (foraDoIntervalo) {
      ignorados++
      continue
    }

    const inicioClip = inicioItem.getTime() < inicioIntervalo.getTime() ? inicioIntervalo : inicioItem
    const fimClip = fimItem.getTime() > fimIntervalo.getTime() ? fimIntervalo : fimItem

    const offsetDias = diasEntre(inicioIntervalo, inicioClip)
    const duracaoDias = diasEntre(inicioClip, fimClip) + 1

    linhas.push({
      id: item.id,
      rotulo: item.rotulo,
      inicioPct: (offsetDias / totalDias) * 100,
      larguraPct: (duracaoDias / totalDias) * 100,
      aberto,
      tom: item.tom,
    })
  }

  let hojePct = null
  if (hoje.getTime() >= inicioIntervalo.getTime() && hoje.getTime() <= fimIntervalo.getTime()) {
    hojePct = (diasEntre(inicioIntervalo, hoje) / totalDias) * 100
  }

  return { linhas, ignorados, hojePct }
}

/**
 * HTML em CSS grid — coluna de rótulos (sticky, aplicada pelo CSS do
 * consumidor) + área de barras. Sem canvas, sem cor escrita aqui.
 * @param {Array} itens
 * @param {{inicio:string, fim:string, hoje?:string}} opcoes
 * @returns {string}
 */
export function htmlGantt(itens, opcoes = {}) {
  const { linhas, hojePct } = linhasGantt(itens, opcoes)

  if (!linhas.length) {
    return vazio('Nenhuma ação no período', 'Ajuste o intervalo ou cadastre uma ação')
  }

  const rotulos = linhas
    .map((linha) => `<span class="gantt-rotulo">${esc(linha.rotulo)}</span>`)
    .join('')

  const barras = linhas
    .map((linha) => {
      const abertoHtml = linha.aberto ? ' <span class="gantt-aberto">em aberto</span>' : ''
      return `<div class="gantt-linha"><div class="gantt-barra gantt-tom-${_tomValido(linha.tom)}" style="left:${linha.inicioPct}%;width:${linha.larguraPct}%"></div>${abertoHtml}</div>`
    })
    .join('')

  const marcaHoje = hojePct == null
    ? ''
    : `<div class="gantt-hoje" style="left:${hojePct}%"><span class="gantt-hoje-rotulo">Hoje</span></div>`

  return `<div class="gantt"><div class="gantt-rotulos">${rotulos}</div><div class="gantt-linhas">${barras}${marcaHoje}</div></div>`
}
