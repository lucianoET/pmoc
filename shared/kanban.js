// ══════════════════════════════════════════════════════════════════
// shared/kanban.js — núcleo puro de kanban por definição de colunas,
// extraído de maquinas/operacoes.js (Fase 13 Plano 03, PLAT-08, D-06).
//
// (1) Por que existe: o kanban de Máquinas (agruparOperacoes/STATUS_KANBAN)
// vivia preso a maquinas/operacoes.js, com a marcação misturada dentro de
// maquinas/app.js#renderOperacoes. Quando /gestao precisar do mesmo padrão
// para as ações 5W2H, copiaria — e uma correção num lado nunca chegaria ao
// outro. Este núcleo sobe a lógica de agrupamento e de marcação para cá,
// genérica por definição de colunas ([{id, rotulo}]), e Máquinas passa a
// consumi-la de shared/ em vez de manter cópia local.
//
// (2) Funções PURAS. Nenhuma API de navegador (document/window/
// localStorage) — mesmo corte núcleo-puro/aplicador-de-DOM de
// shared/tema.js e shared/tabela.js. `htmlKanban` devolve texto; quem
// injeta no DOM é o módulo consumidor.
//
// (3) Regra central: item cujo status não está na lista de colunas cai
// sempre na primeira coluna, preservando a ordem de entrada — é a regra
// que `agruparOperacoes` já aplicava (lá, a primeira coluna era
// 'programada'), e que continua valendo para qualquer definição de
// colunas nova que um chamador passe.
// ══════════════════════════════════════════════════════════════════

function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[c])
}

/**
 * Agrupa `itens` nas `colunas` recebidas, por `opcoes.campoStatus`
 * (padrão 'status'). Item cujo valor não bate com nenhuma coluna cai na
 * primeira coluna, na ordem de entrada. Lista de colunas vazia devolve
 * objeto vazio, sem lançar.
 *
 * @param {Array<object>} itens
 * @param {Array<{id:string, rotulo:string}>} colunas
 * @param {{campoStatus?: string}} [opcoes]
 */
export function agruparKanban(itens, colunas, opcoes = {}) {
  const campoStatus = opcoes.campoStatus || 'status'
  const lista = colunas || []
  const grupos = Object.fromEntries(lista.map((col) => [col.id, []]))
  if (!lista.length) return grupos

  const primeiraColuna = lista[0].id
  for (const item of (itens || [])) {
    const status = item?.[campoStatus]
    const coluna = Object.prototype.hasOwnProperty.call(grupos, status) ? status : primeiraColuna
    grupos[coluna].push(item)
  }
  return grupos
}

/**
 * Devolve a marcação das colunas do kanban a partir de `grupos`
 * (devolvido por `agruparKanban`) e da mesma definição de `colunas`.
 * `opcoes.cartao(item)` é fornecida pelo chamador e desenha cada item;
 * `opcoes.vazio` é o texto da coluna sem item (padrão 'Nenhum item').
 *
 * @param {Record<string, Array<object>>} grupos
 * @param {Array<{id:string, rotulo:string}>} colunas
 * @param {{cartao?: (item:object)=>string, vazio?: string}} [opcoes]
 */
export function htmlKanban(grupos, colunas, opcoes = {}) {
  const cartao = typeof opcoes.cartao === 'function' ? opcoes.cartao : () => ''
  const vazio = opcoes.vazio || 'Nenhum item'

  return (colunas || []).map((col) => {
    const itens = grupos?.[col.id] || []
    const corpo = itens.length
      ? itens.map(cartao).join('')
      : `<div class="empty" style="padding:24px 8px"><p>${esc(vazio)}</p></div>`
    return `<section class="kanban-col">
        <div class="kanban-title"><span>${esc(col.rotulo)}</span><span class="kanban-count">${itens.length}</span></div>
        ${corpo}
      </section>`
  }).join('')
}
