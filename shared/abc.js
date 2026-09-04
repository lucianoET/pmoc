// ══════════════════════════════════════════════════════════════════
// shared/abc.js — curva ABC genérica (D-04, GEQ-07).
//
// (1) Por que existe: classificação por Pareto (poucos itens concentram a
// maior parte do valor) é útil em pelo menos dois lugares independentes —
// a aba Estoque de Máquinas (peças por valor de saída) e as Ferramentas do
// /gestao (GEQ-07). `classificarAbc` é puro e devolve só os números; a
// peça visual (barra + pílula de classe) fica com o consumidor,
// reaproveitando `pilula()` de shared/componentes.js.
//
// (2) O que ele NÃO faz: não conhece nenhum campo de domínio. O acessor
// de valor é sempre parâmetro (`campoValor`), nunca um nome de coluna
// escrito aqui — mesma disciplina de shared/tabela.js. Item com valor não
// numérico entra como 0 e nunca lança: uma linha suja não pode derrubar a
// curva inteira.
//
// (3) A classe de cada linha é decidida pelo acumulado ANTES de somar o
// próprio item, não depois — é o que faz um item único (ou um item
// desproporcionalmente grande) permanecer em A mesmo fechando em 100%: o
// corte pertence a quem cruza a fronteira, não ao primeiro item que a
// ultrapassa. `acumulado`, o valor reportado na linha, é sempre o
// acumulado DEPOIS (o que a tela desenha como barra de progresso).
// ══════════════════════════════════════════════════════════════════

function _valorNumerico(bruto) {
  const n = Number(bruto)
  return Number.isFinite(n) ? n : 0
}

// cortes fora de ordem ou fora de 0..1 caem no padrão — um corte inválido
// não pode produzir uma curva sem sentido (B antes de A, por exemplo).
function _cortesValidos(cortes) {
  if (!Array.isArray(cortes) || cortes.length !== 2) return [0.8, 0.95]
  const [a, b] = cortes
  const valido = typeof a === 'number' && typeof b === 'number' &&
    a >= 0 && a <= 1 && b >= 0 && b <= 1 && a < b
  return valido ? [a, b] : [0.8, 0.95]
}

/**
 * Classifica itens em A/B/C pelo valor acumulado, maior valor primeiro.
 * @param {Array} itens
 * @param {string|((item:any) => number)} campoValor nome do campo ou função acessora
 * @param {[number, number]} [cortes] frações de 0..1, padrão [0.8, 0.95]
 * @returns {{linhas:Array<{item, valor:number, participacao:number, acumulado:number, classe:'A'|'B'|'C'}>, total:number}}
 */
export function classificarAbc(itens, campoValor, cortes = [0.8, 0.95]) {
  const acessar = typeof campoValor === 'function' ? campoValor : (item) => item?.[campoValor]
  const [corteA, corteB] = _cortesValidos(cortes)

  const base = (itens || []).map((item) => ({ item, valor: _valorNumerico(acessar(item)) }))
  const total = base.reduce((soma, linha) => soma + linha.valor, 0)
  const ordenado = base.slice().sort((a, b) => b.valor - a.valor)

  let acumulado = 0
  const linhas = ordenado.map((linha) => {
    if (total <= 0) {
      return { item: linha.item, valor: linha.valor, participacao: 0, acumulado: 0, classe: 'C' }
    }

    const acumuladoAntesPct = (acumulado / total) * 100
    acumulado += linha.valor
    const acumuladoDepoisPct = Math.min(100, (acumulado / total) * 100)
    const participacao = (linha.valor / total) * 100

    const classe = acumuladoAntesPct < corteA * 100
      ? 'A'
      : acumuladoAntesPct < corteB * 100
        ? 'B'
        : 'C'

    return { item: linha.item, valor: linha.valor, participacao, acumulado: acumuladoDepoisPct, classe }
  })

  return { linhas, total }
}
