// ══════════════════════════════════════════════════════════════════
// shared/gut.js — matriz GUT (Gravidade × Urgência × Tendência), GEQ-05.
//
// (1) Por que existe: a mesma escala e a mesma regra de classificação já
// viviam dentro de predial/dominio.js, o único módulo que hoje desenha um
// seletor de GUT — mas o /gestao (Onda B) precisa da mesma matriz para
// priorizar as ações 5W2H. Copiá-la seria a segunda cópia da mesma regra
// de negócio; sobe para cá e o Predial reexporta (D-09), o mesmo
// precedente que shared/arvore.js já é para montarArvore/linhasVisiveis
// neste mesmo arquivo.
//
// (2) O que ele NÃO faz: não sabe nome de tabela, não desenha select, não
// grava. `gutTotal`/`classificarGut` só recebem número — quem lê o banco e
// quem desenha o `<select>` fica no módulo consumidor.
//
// (3) `null` é "não avaliado" e é diferente de `0` — mesma regra já usada
// nos atributos técnicos de /refrigeracao (D-500-02). Uma dimensão fora de
// GUT_ESCALA nunca produz um total inventado: gutTotal() devolve null em
// vez de calcular um total parcial que priorizaria a fila errada.
// ══════════════════════════════════════════════════════════════════

// Escala GUT do legado: cada dimensão vale 0, 1, 3, 6, 8 ou 10, então o
// total (G × U × T) vai de 0 a 1000.
export const GUT_ESCALA = [0, 1, 3, 6, 8, 10]

function _numeroValido(valor) {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/**
 * Classifica um total GUT nas faixas do IBAPE-NA:2012 usadas pelo legado.
 * Mesma regra da coluna gerada `pred_inspecao_itens.condicao`.
 * @param {number|null|undefined} total G × U × T
 * @returns {'ok'|'atencao'|'critico'|null}
 */
export function classificarGut(total) {
  if (!_numeroValido(total)) return null
  if (total > 400) return 'critico'
  if (total > 100) return 'atencao'
  return 'ok'
}

/**
 * Total G × U × T. Devolve `null` quando qualquer dimensão for nula,
 * indefinida ou não pertencer a GUT_ESCALA — um total parcial afirmaria
 * uma priorização que ninguém fez.
 * @param {number} g
 * @param {number} u
 * @param {number} t
 * @returns {number|null}
 */
export function gutTotal(g, u, t) {
  if (![g, u, t].every((dimensao) => GUT_ESCALA.includes(dimensao))) return null
  return g * u * t
}

/**
 * Rótulo de tela por faixa, sempre de uma palavra. `null` vira "Não
 * avaliado" — o mesmo texto usado onde o total ainda não foi calculado.
 * @param {number|null|undefined} total
 * @returns {string}
 */
export function rotuloGut(total) {
  const faixa = classificarGut(total)
  if (faixa === 'critico') return 'Crítico'
  if (faixa === 'atencao') return 'Atenção'
  if (faixa === 'ok') return 'Baixo'
  return 'Não avaliado'
}
