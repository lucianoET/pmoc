// Árvore de locais do CMASM — compartilhada pelos módulos, sem DOM nem
// Supabase, para poder testar.

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

/**
 * Monta as linhas visíveis de uma árvore colapsável.
 * Um nó só aparece se todos os ancestrais dele estiverem expandidos.
 * Cada linha ganha:
 *   nivel        — profundidade, para a indentação
 *   filhos       — quantos filhos diretos tem
 *   descendentes — quantos nós existem abaixo, em qualquer nível
 *   expandido    — se está aberto
 *
 * @param {Array<{id:number, parent_id:number|null, nome:string}>} locais
 * @param {Set<number>} expandidos Ids dos nós abertos.
 * @returns {Array<object>}
 */
export function linhasVisiveis(locais, expandidos = new Set()) {
  const todos = montarArvore(locais)
  const porId = new Map(todos.map(local => [local.id, local]))

  const filhos = new Map()
  for (const local of todos) {
    const pai = porId.has(local.parent_id) ? local.parent_id : null
    filhos.set(pai, (filhos.get(pai) || 0) + 1)
  }

  const descendentes = new Map()
  // percorre do fim para o começo: em ordem de profundidade, todo filho vem
  // depois do pai, então os filhos já estão contados quando chega no pai
  for (let i = todos.length - 1; i >= 0; i--) {
    const local = todos[i]
    const abaixo = descendentes.get(local.id) || 0
    if (porId.has(local.parent_id)) {
      descendentes.set(local.parent_id, (descendentes.get(local.parent_id) || 0) + abaixo + 1)
    }
  }

  const visivel = local => {
    let pai = porId.get(local.parent_id)
    const vistos = new Set()
    while (pai && !vistos.has(pai.id)) {
      if (!expandidos.has(pai.id)) return false
      vistos.add(pai.id)
      pai = porId.get(pai.parent_id)
    }
    return true
  }

  return todos.filter(visivel).map(local => ({
    ...local,
    filhos: filhos.get(local.id) || 0,
    descendentes: descendentes.get(local.id) || 0,
    expandido: expandidos.has(local.id),
  }))
}
