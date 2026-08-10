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

/**
 * Ordena os locais em profundidade a partir das raízes e anota o nível de
 * cada um, para desenhar a árvore como lista indentada.
 * Locais órfãos (pai inexistente ou ciclo) entram no fim, no nível 0, em vez
 * de sumirem da tela.
 * @param {Array<{id:number, parent_id:number|null, nome:string}>} locais
 * @returns {Array<object>} mesmos objetos com `nivel` adicionado
 */
export function montarArvore(locais) {
  const porPai = new Map()
  const ids = new Set(locais.map(local => local.id))

  for (const local of locais) {
    const pai = local.parent_id != null && ids.has(local.parent_id) ? local.parent_id : null
    if (!porPai.has(pai)) porPai.set(pai, [])
    porPai.get(pai).push(local)
  }

  for (const filhos of porPai.values()) {
    filhos.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
  }

  const saida = []
  const visitados = new Set()

  const descer = (pai, nivel) => {
    for (const local of porPai.get(pai) || []) {
      if (visitados.has(local.id)) continue
      visitados.add(local.id)
      saida.push({ ...local, nivel })
      descer(local.id, nivel + 1)
    }
  }

  descer(null, 0)

  // sobrou algo? é ciclo entre pais — mostra no nível 0 para não sumir
  for (const local of locais) {
    if (!visitados.has(local.id)) saida.push({ ...local, nivel: 0 })
  }

  return saida
}
