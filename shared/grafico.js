// ══════════════════════════════════════════════════════════════════
// shared/grafico.js — gráficos em SVG inline, escritos à mão.
//
// (1) Por que existe: hoje nenhum módulo da plataforma desenha gráfico —
// o primeiro que precisasse importaria uma biblioteca ou escreveria a
// própria versão dentro do módulo. Este arquivo fecha esse caminho: um
// núcleo só, reaproveitado por indicadores, painéis e ferramentas de
// qualidade (Pareto, carta de controle) nas ondas seguintes.
//
// (2) O que NÃO faz: nenhuma biblioteca de gráfico, nenhum `<canvas>`
// (D-13-01/D-13-04 do ROADMAP) — só `<svg>` montado por template literal,
// devolvido como string. Não injeta nada em tela; quem injeta é o módulo
// consumidor, mesma separação núcleo-puro/aplicador-de-DOM de
// shared/tema.js e shared/tabela.js.
//
// (3) Nenhuma cor escrita aqui. `tom` é o nome de um tom semântico
// (neutro/info/ok/warn/erro, mais `accent` — reservado só para a linha
// acumulada do Pareto e o ponto atual do sparkline) resolvido pela folha
// comum via classe `grafico-tom-{tom}`; todo traço e preenchimento usa
// `currentColor`.
// ══════════════════════════════════════════════════════════════════

const TONS = ['neutro', 'info', 'ok', 'warn', 'erro']
const TONS_COM_ACCENT = TONS.concat('accent')

const ALTURA_PADRAO = 140
const LARGURA_PADRAO = 300

function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[c])
}

// Tom fora da lista cai em 'neutro' — mesma queda defensiva de
// shared/componentes.js#tomValido, para nunca gerar uma classe que a
// folha comum não conhece.
function tomValido(tom) {
  return TONS.includes(tom) ? tom : 'neutro'
}

// Mesma ideia, mas para os dois pontos que podem legitimamente pedir o
// tom accent (linha acumulada do Pareto, ponto atual do sparkline) — se
// não vier tom nenhum, o padrão é accent, não neutro, porque é o desenho
// que esses dois elementos sempre tiveram.
function tomAccentOuPadrao(tom) {
  return TONS_COM_ACCENT.includes(tom) ? tom : 'accent'
}

function numerico(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

// Estado vazio único para as seis funções: série vazia, série só de
// nulos ou entrada que não é array caem todas aqui — nunca lança, nunca
// devolve string vazia.
function svgVazio(largura, altura, texto = 'Sem dado') {
  const l = numerico(largura) ? largura : LARGURA_PADRAO
  const a = numerico(altura) ? altura : ALTURA_PADRAO
  return `<svg class="grafico" viewBox="0 0 ${l} ${a}" width="100%" height="${a}" role="img" aria-label="${esc(texto)}"><text class="grafico-vazio" x="${(l / 2).toFixed(1)}" y="${(a / 2).toFixed(1)}" text-anchor="middle">${esc(texto)}</text></svg>`
}

// Rótulos de eixo, no máximo 6 por gráfico. Com mais categorias do que
// isso, raleia mantendo sempre o primeiro e o último índice — perder as
// pontas seria pior do que perder o meio.
function escolherIndicesRotulo(n, maximo = 6) {
  if (!numerico(n) || n <= 0) return []
  if (n <= maximo) return Array.from({ length: n }, (_, i) => i)
  const passo = (n - 1) / (maximo - 1)
  const indices = new Set()
  for (let i = 0; i < maximo; i++) indices.add(Math.round(i * passo))
  return Array.from(indices).sort((a, b) => a - b)
}

// Resume máximo/mínimo/último de uma série já filtrada (sem os pontos
// não numéricos) para compor o aria-label — o SVG é o dado, então o
// aria-label precisa contar a mesma história de quem não vê o desenho.
function resumoSerie(pontosValidos) {
  if (!pontosValidos.length) return null
  let max = pontosValidos[0]
  let min = pontosValidos[0]
  for (const p of pontosValidos) {
    if (p.valor > max.valor) max = p
    if (p.valor < min.valor) min = p
  }
  const ultimo = pontosValidos[pontosValidos.length - 1]
  return { max, min, ultimo }
}

function descricaoPonto(p) {
  return p.rotulo ? `${p.valor} (${p.rotulo})` : String(p.valor)
}

function ariaLabelSerie(descricao, pontosValidos, ignorados) {
  const resumo = resumoSerie(pontosValidos)
  if (!resumo) return 'Sem dado'
  let texto = `${descricao}. Máximo: ${descricaoPonto(resumo.max)}. Mínimo: ${descricaoPonto(resumo.min)}. Último: ${descricaoPonto(resumo.ultimo)}.`
  if (ignorados > 0) {
    texto += ` ${ignorados} ponto${ignorados > 1 ? 's' : ''} ignorado${ignorados > 1 ? 's' : ''}.`
  }
  return texto
}

// Extrai {rotulo, valor} de uma série de entrada tolerante: aceita
// objeto {rotulo, valor, tom}, número solto, ou lixo — o que não tem
// valor numérico é descartado e contado, nunca lança.
function extrairPontos(serie) {
  let ignorados = 0
  const pontos = []
  for (const item of serie) {
    const valor = item && typeof item === 'object' ? item.valor : item
    if (!numerico(valor)) {
      ignorados++
      continue
    }
    const rotulo = item && typeof item === 'object' ? item.rotulo : undefined
    const tom = item && typeof item === 'object' ? item.tom : undefined
    pontos.push({ rotulo, valor, tom })
  }
  return { pontos, ignorados }
}

/**
 * Gráfico de barras — um `<rect fill="currentColor">` por ponto, dentro
 * do `<g class="grafico-tom-{tom}">` que resolve a cor.
 * @param {Array<{rotulo?:string, valor:number, tom?:string}>} serie
 * @param {{largura?:number, altura?:number}} [opcoes]
 */
export function barras(serie, opcoes = {}) {
  const largura = numerico(opcoes.largura) ? opcoes.largura : LARGURA_PADRAO
  const altura = numerico(opcoes.altura) ? opcoes.altura : ALTURA_PADRAO
  if (!Array.isArray(serie) || serie.length === 0) return svgVazio(largura, altura)

  const { pontos, ignorados } = extrairPontos(serie)
  if (pontos.length === 0) return svgVazio(largura, altura)

  const margemInferior = 24
  const margemSuperior = 10
  const margemLateral = 10
  const areaAltura = altura - margemSuperior - margemInferior
  const areaLargura = largura - margemLateral * 2
  const max = Math.max(...pontos.map((p) => p.valor), 0) || 1
  const n = pontos.length
  const passo = areaLargura / n
  const larguraBarra = passo * 0.6
  const indicesRotulo = new Set(escolherIndicesRotulo(n))

  let rects = ''
  let eixoTextos = ''
  pontos.forEach((p, i) => {
    const tom = tomValido(p.tom)
    const alturaBarra = Math.max(0, (p.valor / max) * areaAltura)
    const x = margemLateral + passo * i + (passo - larguraBarra) / 2
    const y = altura - margemInferior - alturaBarra
    rects += `<g class="grafico-tom-${tom}"><rect class="grafico-barra" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${larguraBarra.toFixed(1)}" height="${alturaBarra.toFixed(1)}" fill="currentColor"/></g>`
    if (indicesRotulo.has(i)) {
      const cx = margemLateral + passo * i + passo / 2
      eixoTextos += `<text class="grafico-rotulo" x="${cx.toFixed(1)}" y="${(altura - 6).toFixed(1)}" text-anchor="middle">${esc(p.rotulo ?? '')}</text>`
    }
  })

  const ariaLabel = ariaLabelSerie('Gráfico de barras', pontos, ignorados)
  return `<svg class="grafico" viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img" aria-label="${esc(ariaLabel)}"><g class="grafico-eixo">${rects}${eixoTextos}</g></svg>`
}

/**
 * Gráfico de linha — `<path>` em `currentColor`. Um único ponto não vira
 * um `<path>` degenerado (só um `moveto`, sem traço nenhum); vira um
 * ponto isolado desenhado com `<circle>`.
 * @param {Array<{rotulo?:string, valor:number}>} serie
 * @param {{largura?:number, altura?:number, tom?:string}} [opcoes]
 */
export function linha(serie, opcoes = {}) {
  const largura = numerico(opcoes.largura) ? opcoes.largura : LARGURA_PADRAO
  const altura = numerico(opcoes.altura) ? opcoes.altura : ALTURA_PADRAO
  if (!Array.isArray(serie) || serie.length === 0) return svgVazio(largura, altura)

  const { pontos, ignorados } = extrairPontos(serie)
  if (pontos.length === 0) return svgVazio(largura, altura)

  const margemInferior = 24
  const margemSuperior = 10
  const margemLateral = 10
  const areaAltura = altura - margemSuperior - margemInferior
  const areaLargura = largura - margemLateral * 2
  const max = Math.max(...pontos.map((p) => p.valor), 0) || 1
  const n = pontos.length

  const coords = pontos.map((p, i) => ({
    x: n === 1 ? largura / 2 : margemLateral + (areaLargura * i) / (n - 1),
    y: altura - margemInferior - (p.valor / max) * areaAltura,
  }))

  const indicesRotulo = new Set(escolherIndicesRotulo(n))
  let eixoTextos = ''
  pontos.forEach((p, i) => {
    if (indicesRotulo.has(i)) {
      eixoTextos += `<text class="grafico-rotulo" x="${coords[i].x.toFixed(1)}" y="${(altura - 6).toFixed(1)}" text-anchor="middle">${esc(p.rotulo ?? '')}</text>`
    }
  })

  const tom = tomValido(opcoes.tom)
  let corpo
  if (n === 1) {
    corpo = `<circle class="grafico-ponto" cx="${coords[0].x.toFixed(1)}" cy="${coords[0].y.toFixed(1)}" r="3" fill="currentColor"/>`
  } else {
    const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
    corpo = `<path class="grafico-linha" d="${d}" stroke="currentColor" stroke-width="2" fill="none"/>`
  }

  const ariaLabel = ariaLabelSerie('Gráfico de linha', pontos, ignorados)
  return `<svg class="grafico" viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img" aria-label="${esc(ariaLabel)}"><g class="grafico-tom-${tom}">${corpo}</g><g class="grafico-eixo">${eixoTextos}</g></svg>`
}

/**
 * Núcleo numérico puro da carta de controle — carta de indivíduos
 * (X-mR): média das amplitudes móveis entre pontos consecutivos estima o
 * desvio-padrão do processo, sem depender de subgrupos. Menos de dois
 * pontos não tem amplitude móvel nenhuma, então não existe limite.
 * @param {Array<number>} valores
 * @returns {{media:number|null, lsc:number|null, lic:number|null, fora:number[]}}
 */
export function limitesControle(valores) {
  if (!Array.isArray(valores)) return { media: null, lsc: null, lic: null, fora: [] }

  const numeros = []
  const indicesOriginais = []
  valores.forEach((v, i) => {
    if (numerico(v)) {
      numeros.push(v)
      indicesOriginais.push(i)
    }
  })
  if (numeros.length === 0) return { media: null, lsc: null, lic: null, fora: [] }

  const media = numeros.reduce((s, v) => s + v, 0) / numeros.length

  if (numeros.length < 2) return { media, lsc: null, lic: null, fora: [] }

  const amplitudes = []
  for (let i = 1; i < numeros.length; i++) amplitudes.push(Math.abs(numeros[i] - numeros[i - 1]))
  const amplitudeMedia = amplitudes.reduce((s, v) => s + v, 0) / amplitudes.length
  const FATOR_LIMITE = 3 / 1.128
  const lsc = media + FATOR_LIMITE * amplitudeMedia
  const lic = media - FATOR_LIMITE * amplitudeMedia

  const fora = []
  numeros.forEach((v, i) => {
    if (v > lsc || v < lic) fora.push(indicesOriginais[i])
  })

  return { media, lsc, lic, fora }
}

/**
 * Carta de controle desenhada — pontos dentro dos limites no tom `ok`,
 * pontos fora no tom `erro`; linha de média contínua, LSC/LIC tracejados.
 * @param {Array<{rotulo?:string, valor:number}|number>} serie
 * @param {{largura?:number, altura?:number}} [opcoes]
 */
export function cartaControle(serie, opcoes = {}) {
  const largura = numerico(opcoes.largura) ? opcoes.largura : LARGURA_PADRAO
  const altura = numerico(opcoes.altura) ? opcoes.altura : ALTURA_PADRAO
  if (!Array.isArray(serie) || serie.length === 0) return svgVazio(largura, altura)

  const { pontos, ignorados } = extrairPontos(serie)
  if (pontos.length === 0) return svgVazio(largura, altura)

  const { media, lsc, lic, fora } = limitesControle(pontos.map((p) => p.valor))
  const foraSet = new Set(fora)

  const margemInferior = 24
  const margemSuperior = 10
  const margemLateral = 10
  const areaAltura = altura - margemSuperior - margemInferior
  const areaLargura = largura - margemLateral * 2
  const valoresEscala = pontos.map((p) => p.valor).concat(lsc != null ? [lsc, lic] : [])
  const max = Math.max(...valoresEscala, 0)
  const min = Math.min(...valoresEscala, 0)
  const amplitude = max - min || 1
  const n = pontos.length

  function escalaY(v) {
    return altura - margemInferior - ((v - min) / amplitude) * areaAltura
  }

  const coords = pontos.map((p, i) => ({
    x: n === 1 ? largura / 2 : margemLateral + (areaLargura * i) / (n - 1),
    y: escalaY(p.valor),
  }))

  let pontosSvg = ''
  coords.forEach((c, i) => {
    const tom = foraSet.has(i) ? 'erro' : 'ok'
    pontosSvg += `<g class="grafico-tom-${tom}"><circle class="grafico-ponto" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="currentColor"/></g>`
  })

  let linhas = ''
  if (media != null) {
    const y = escalaY(media)
    linhas += `<line class="grafico-media" x1="${margemLateral}" y1="${y.toFixed(1)}" x2="${(largura - margemLateral).toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor"/>`
  }
  if (lsc != null && lic != null) {
    const yLsc = escalaY(lsc)
    const yLic = escalaY(lic)
    linhas += `<line class="grafico-limite" x1="${margemLateral}" y1="${yLsc.toFixed(1)}" x2="${(largura - margemLateral).toFixed(1)}" y2="${yLsc.toFixed(1)}" stroke="currentColor" stroke-dasharray="4 3"/>`
    linhas += `<line class="grafico-limite" x1="${margemLateral}" y1="${yLic.toFixed(1)}" x2="${(largura - margemLateral).toFixed(1)}" y2="${yLic.toFixed(1)}" stroke="currentColor" stroke-dasharray="4 3"/>`
  }

  let ariaLabel = ariaLabelSerie('Carta de controle', pontos, ignorados)
  if (fora.length > 0) {
    ariaLabel += ` ${fora.length} ponto${fora.length > 1 ? 's' : ''} fora dos limites.`
  }
  return `<svg class="grafico" viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img" aria-label="${esc(ariaLabel)}"><g class="grafico-eixo">${linhas}${pontosSvg}</g></svg>`
}

/**
 * Pareto — barras de frequência (ordenadas decrescente) mais linha
 * acumulada no tom `accent`, cujo último ponto fecha em 100%.
 * @param {Array<{rotulo?:string, valor:number}>} serie
 * @param {{largura?:number, altura?:number}} [opcoes]
 */
export function pareto(serie, opcoes = {}) {
  const largura = numerico(opcoes.largura) ? opcoes.largura : LARGURA_PADRAO
  const altura = numerico(opcoes.altura) ? opcoes.altura : ALTURA_PADRAO
  if (!Array.isArray(serie) || serie.length === 0) return svgVazio(largura, altura)

  const { pontos, ignorados } = extrairPontos(serie)
  if (pontos.length === 0) return svgVazio(largura, altura)

  const ordenados = pontos.slice().sort((a, b) => b.valor - a.valor)
  const total = ordenados.reduce((s, p) => s + p.valor, 0) || 1
  let acumulado = 0
  const comAcumulado = ordenados.map((p) => {
    acumulado += p.valor
    return { ...p, acumuladoPct: (acumulado / total) * 100 }
  })

  const margemInferior = 24
  const margemSuperior = 10
  const margemLateral = 10
  const areaAltura = altura - margemSuperior - margemInferior
  const areaLargura = largura - margemLateral * 2
  const max = Math.max(...comAcumulado.map((p) => p.valor), 0) || 1
  const n = comAcumulado.length
  const passo = areaLargura / n
  const larguraBarra = passo * 0.6
  const indicesRotulo = new Set(escolherIndicesRotulo(n))

  let rects = ''
  let eixoTextos = ''
  const coordsLinha = []
  comAcumulado.forEach((p, i) => {
    const alturaBarra = Math.max(0, (p.valor / max) * areaAltura)
    const x = margemLateral + passo * i + (passo - larguraBarra) / 2
    const y = altura - margemInferior - alturaBarra
    rects += `<g class="grafico-tom-neutro"><rect class="grafico-barra" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${larguraBarra.toFixed(1)}" height="${alturaBarra.toFixed(1)}" fill="currentColor"/></g>`
    const cxLinha = margemLateral + passo * i + passo / 2
    const yLinha = altura - margemInferior - (p.acumuladoPct / 100) * areaAltura
    coordsLinha.push({ x: cxLinha, y: yLinha })
    if (indicesRotulo.has(i)) {
      eixoTextos += `<text class="grafico-rotulo" x="${cxLinha.toFixed(1)}" y="${(altura - 6).toFixed(1)}" text-anchor="middle">${esc(p.rotulo ?? '')}</text>`
    }
  })

  let linhaAcumulada
  if (coordsLinha.length === 1) {
    linhaAcumulada = `<circle class="grafico-ponto" cx="${coordsLinha[0].x.toFixed(1)}" cy="${coordsLinha[0].y.toFixed(1)}" r="3" fill="currentColor"/>`
  } else {
    const d = coordsLinha.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
    linhaAcumulada = `<path class="grafico-acumulado" d="${d}" stroke="currentColor" stroke-width="2" fill="none"/>`
  }

  const ariaLabel = ariaLabelSerie('Gráfico de Pareto', comAcumulado, ignorados)
  return `<svg class="grafico" viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img" aria-label="${esc(ariaLabel)}"><g class="grafico-eixo">${rects}${eixoTextos}</g><g class="grafico-tom-accent">${linhaAcumulada}</g></svg>`
}

/**
 * Sparkline — traço fino sem eixo, último ponto marcado com `<circle>`
 * no tom `accent` por padrão (o cartão de indicador substitui pelo
 * próprio tom via `opcoes.tom`).
 * @param {Array<number>} valores
 * @param {{largura?:number, altura?:number, tom?:string}} [opcoes]
 */
export function sparkline(valores, opcoes = {}) {
  const largura = numerico(opcoes.largura) ? opcoes.largura : 100
  const altura = numerico(opcoes.altura) ? opcoes.altura : 32
  if (!Array.isArray(valores) || valores.length === 0) return svgVazio(largura, altura)

  let ignorados = 0
  const pontos = []
  for (const v of valores) {
    if (!numerico(v)) {
      ignorados++
      continue
    }
    pontos.push(v)
  }
  if (pontos.length === 0) return svgVazio(largura, altura)

  const margem = 3
  const areaAltura = altura - margem * 2
  const areaLargura = largura - margem * 2
  const max = Math.max(...pontos)
  const min = Math.min(...pontos)
  const amplitude = max - min || 1
  const n = pontos.length

  const coords = pontos.map((v, i) => ({
    x: n === 1 ? largura / 2 : margem + (areaLargura * i) / (n - 1),
    y: altura - margem - ((v - min) / amplitude) * areaAltura,
  }))

  const pontosStr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const ultimo = coords[coords.length - 1]
  const tom = tomAccentOuPadrao(opcoes.tom)
  const ariaLabel = ariaLabelSerie('Sparkline', pontos.map((v) => ({ valor: v })), ignorados)

  return `<svg class="grafico grafico-sparkline" viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img" aria-label="${esc(ariaLabel)}"><g class="grafico-tom-${tom}"><polyline points="${pontosStr}" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="${ultimo.x.toFixed(1)}" cy="${ultimo.y.toFixed(1)}" r="2.5" fill="currentColor"/></g></svg>`
}
