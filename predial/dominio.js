// Regras puras do módulo Predial — sem DOM e sem Supabase, para poder testar.

// Escala GUT usada pelo app legado: cada dimensão vale 0, 1, 3, 6, 8 ou 10,
// então o total (G × U × T) vai de 0 a 1000.
export const GUT_ESCALA = [0, 1, 3, 6, 8, 10]

/**
 * Classifica um total GUT nas faixas do IBAPE-NA:2012 usadas pelo legado.
 * Mesma regra da coluna gerada `pred_inspecao_itens.condicao`.
 * @param {number} total G × U × T
 * @returns {'ok'|'atencao'|'critico'}
 */
export function classificarGut(total) {
  if (total > 400) return 'critico'
  if (total > 100) return 'atencao'
  return 'ok'
}

// A árvore de locais virou registro compartilhado; as funções vivem em
// shared/arvore.js e são reexportadas aqui para quem já importava daqui.
export { montarArvore, linhasVisiveis } from '../shared/arvore.js'
