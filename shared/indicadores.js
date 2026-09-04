// ══════════════════════════════════════════════════════════════════
// shared/indicadores.js — cartão de indicador com meta, semáforo e
// tendência, num lugar só.
//
// (1) Por que existe: o cartão de indicador de qualidade (valor + meta +
// seta de tendência + minigráfico) é marcação repetida à mão em cada
// painel que precisar dele. A definição do indicador é sempre PARÂMETRO
// — `{id, rotulo, unidade, meta, sentido, faixas}` — nunca uma lista
// concreta escrita aqui, mesma disciplina que impede shared/tabela.js de
// conhecer "material" ou "reparo".
//
// (2) Funções puras que devolvem tom/texto/HTML. Não tocam no DOM, não
// leem banco. `cartaoIndicador()` importa `sparkline()` de
// shared/grafico.js — o cartão de indicador e o gráfico do painel
// desenham a mesma série pela mesma função.
//
// (3) Nenhuma cor escrita aqui. `tom` é resolvido pela folha comum via
// classe `indicador-tom-{tom}` — mesmo vocabulário fechado de
// shared/componentes.js (neutro/info/ok/warn/erro).
// ══════════════════════════════════════════════════════════════════

import { sparkline } from './grafico.js'

const TONS = ['neutro', 'info', 'ok', 'warn', 'erro']

function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[c])
}

function tomValido(tom) {
  return TONS.includes(tom) ? tom : 'neutro'
}

function numerico(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * Avalia o tom de um valor contra a definição do indicador.
 * - Sem valor numérico → 'neutro' (indicador ainda não tem dado).
 * - Sem meta numérica → 'info' (não é bom nem ruim — é dado sem
 *   referência).
 * - Com meta: 'ok' dentro/melhor que a meta, conforme `sentido`
 *   ('maior' é melhor por padrão; 'menor' inverte — ex.: um tempo médio
 *   de reparo, onde acima da meta é ruim). Com `faixas` (fração da meta
 *   a partir da qual o estado é de atenção) e o valor na zona entre a
 *   meta e o limite de atenção, o tom é 'warn' em vez de 'ok'/'erro'.
 *
 * @param {number|null|undefined} valor
 * @param {{meta?:number, sentido?:'maior'|'menor', faixas?:number}} def
 * @returns {'neutro'|'info'|'ok'|'warn'|'erro'}
 */
export function avaliar(valor, def) {
  if (!numerico(valor)) return 'neutro'

  const definicao = def || {}
  const meta = definicao.meta
  if (!numerico(meta)) return 'info'

  const sentido = definicao.sentido === 'menor' ? 'menor' : 'maior'
  const faixas = numerico(definicao.faixas) ? definicao.faixas : null

  if (sentido === 'maior') {
    if (valor >= meta) return 'ok'
    if (faixas != null && valor >= meta * faixas) return 'warn'
    return 'erro'
  }

  // sentido === 'menor' — acima da meta é o lado ruim
  if (valor <= meta) return 'ok'
  if (faixas != null) {
    const limiteAtencao = meta * (2 - faixas)
    if (valor <= limiteAtencao) return 'warn'
  }
  return 'erro'
}

/**
 * Tendência de uma série numérica — compara o primeiro e o último ponto
 * válido. Exige ao menos dois pontos; menos que isso não é tendência
 * nenhuma, é um valor só.
 *
 * @param {Array<number>} serie
 * @returns {'subindo'|'descendo'|'estavel'|null}
 */
export function tendencia(serie) {
  if (!Array.isArray(serie)) return null
  const pontos = serie.filter(numerico)
  if (pontos.length < 2) return null
  const primeiro = pontos[0]
  const ultimo = pontos[pontos.length - 1]
  if (ultimo > primeiro) return 'subindo'
  if (ultimo < primeiro) return 'descendo'
  return 'estavel'
}

function marcaTendencia(t) {
  if (t === 'subindo') return '▲ subindo'
  if (t === 'descendo') return '▼ descendo'
  if (t === 'estavel') return '— estável'
  return ''
}

/**
 * Cartão de indicador — reaproveita a casca `.kpi` existente. Sem valor,
 * mostra o texto de estado vazio e não desenha sparkline. Sem meta,
 * mostra o texto de meta ausente no lugar do semáforo. Com um único
 * ponto na série: sparkline degenerado num ponto, sem marca de
 * tendência (tendencia() exige >= 2 pontos).
 *
 * @param {{id?:string, rotulo?:string, unidade?:string, meta?:number, sentido?:'maior'|'menor', faixas?:number}} def
 * @param {number|null|undefined} valor
 * @param {Array<number>} serie
 * @returns {string} HTML
 */
export function cartaoIndicador(def, valor, serie) {
  const definicao = def || {}
  const rotulo = esc(definicao.rotulo ?? '')
  const unidade = definicao.unidade ?? ''
  const serieValida = Array.isArray(serie) ? serie.filter(numerico) : []
  const temValor = numerico(valor)
  const tom = avaliar(temValor ? valor : null, definicao)

  let corpo
  if (!temValor) {
    corpo = `<p class="indicador-vazio">Sem dado no período</p>`
  } else {
    const valorTexto = esc(String(valor))

    let metaTexto
    if (!numerico(definicao.meta)) {
      metaTexto = `<p class="indicador-meta">Sem meta definida</p>`
    } else {
      metaTexto = `<p class="indicador-meta">Meta: ${esc(String(definicao.meta))} ${esc(unidade)}</p>`
    }

    const t = tendencia(serieValida)
    const marca = marcaTendencia(t)
    const tendTexto = marca ? `<p class="indicador-tendencia">${esc(marca)}</p>` : ''

    const sparkHtml = serieValida.length >= 1
      ? `<div class="indicador-spark">${sparkline(serieValida, { tom })}</div>`
      : ''

    corpo = `<p class="kpi-n">${valorTexto}</p>${metaTexto}${tendTexto}${sparkHtml}`
  }

  return `<div class="kpi indicador indicador-tom-${tomValido(tom)}"><p class="kpi-l">${rotulo}</p>${corpo}</div>`
}
