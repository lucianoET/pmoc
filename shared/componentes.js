// ══════════════════════════════════════════════════════════════════
// shared/componentes.js — peças de tela repetidas nos módulos, em um
// lugar só.
//
// (1) O que entra aqui: o que já existe em DUAS OU MAIS telas com o mesmo
// papel e desenho quase igual — a régua de etapas e a pílula de estado
// (Refrigeração e Máquinas), o par de botões que troca a lista mostrada
// (`seg-toggle`) e a fila de filtros rápidos (`chips`). O que ainda existe
// numa tela só continua lá: componente com um consumidor é abstração
// especulativa, e o projeto já tem `shared/tabela.js` como precedente do
// contrário — ele subiu para cá quando ganhou o segundo consumidor.
//
// (2) Funções PURAS que devolvem texto. Não tocam no DOM, não escutam
// evento, não guardam estado. Quem injeta e quem escuta é o módulo — assim
// estas peças são testáveis em Node e servem tanto a um app que redesenha
// tudo (Máquinas) quanto a um que redesenha por seção.
//
// (3) Nenhuma cor escrita aqui. `tom` é o nome de um tom semântico
// (info/ok/warn/erro/neutro) resolvido pela folha comum — cor em
// JavaScript seria mais uma cópia da paleta para alguém esquecer de
// atualizar.
// ══════════════════════════════════════════════════════════════════

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

// Tom fora da lista cai em 'neutro' em vez de virar classe inexistente: uma
// classe que a folha não conhece produz pílula sem cor nenhuma, que na tela
// parece defeito de carregamento.
function tomValido(tom) {
  return TONS.includes(tom) ? tom : 'neutro'
}

/**
 * Pílula de estado — o rótulo do estado atual, colorido pelo tom.
 */
export function pilula(rotulo, tom = 'neutro') {
  return `<span class="pilula pilula-${tomValido(tom)}">${esc(rotulo)}</span>`
}

/**
 * Par (ou trio) de botões que troca a lista mostrada, no lugar de duas abas
 * para o que é a mesma pergunta com dois recortes.
 *
 * @param {Array<{id:string,rotulo:string,icone?:string}>} opcoes
 * @param {string} ativo         id da opção ativa
 * @param {string} manipulador   nome da função global chamada com o id
 */
export function seletor(opcoes, ativo, manipulador) {
  const botoes = (opcoes || [])
    .map((o) => {
      const ligado = o.id === ativo
      // aria-pressed junto da classe: é um botão de alternância, e o leitor
      // de tela precisa do mesmo estado que o CSS usa para desenhar.
      return `<button type="button" class="seg-btn${ligado ? ' ativo' : ''}" aria-pressed="${ligado}" onclick="${esc(manipulador)}('${esc(o.id)}')">${o.icone || ''}${esc(o.rotulo)}</button>`
    })
    .join('')
  return `<div class="seg-toggle" role="group">${botoes}</div>`
}

/**
 * Fila de filtros rápidos. `contagem` é opcional e, quando vem, aparece no
 * próprio chip: um filtro que não diz quantos itens tem obriga a clicar
 * para descobrir que está vazio.
 */
export function chips(opcoes, ativo, manipulador) {
  return `<div class="chips">${(opcoes || [])
    .map((o) => {
      const ligado = o.id === ativo
      const contagem = o.contagem == null ? '' : ` <span class="chip-n">${esc(o.contagem)}</span>`
      return `<button type="button" class="chip${ligado ? ' ativo' : ''}" aria-pressed="${ligado}" onclick="${esc(manipulador)}('${esc(o.id)}')">${esc(o.rotulo)}${contagem}</button>`
    })
    .join('')}</div>`
}

/**
 * Régua de etapas do fluxo. Recebe a lista de etapas já resolvida pelo
 * núcleo de fluxo (shared/fluxo.js) e o índice do passo atual — não
 * recalcula nada, para não haver duas respostas para "em que etapa está".
 *
 * @param {Array<{id:string,curto?:string,rotulo:string}>} etapas
 * @param {number} passo  1-based; 0 significa fora do fluxo (cancelado)
 */
export function regua(etapas, passo) {
  const lista = etapas || []
  return `<ol class="regua">${lista
    .map((e, i) => {
      const n = i + 1
      const estado = n < passo ? ' feito' : n === passo ? ' atual' : ''
      return `<li class="regua-passo${estado}"><span class="regua-bola">${n}</span><span class="regua-txt">${esc(e.curto || e.rotulo)}</span></li>`
    })
    .join('')}</ol>`
}

/**
 * Estado vazio com motivo. Existe porque "lista vazia" e "filtro sem
 * resultado" e "erro de carga" produziam a mesma tela em branco em três
 * módulos — e uma tela em branco não distingue "está tudo certo" de
 * "quebrou".
 */
export function vazio(mensagem, dica) {
  return `<div class="vazio"><p>${esc(mensagem)}</p>${dica ? `<p class="vazio-dica">${esc(dica)}</p>` : ''}</div>`
}
