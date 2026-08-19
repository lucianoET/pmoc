// ══════════════════════════════════════════════════════════════════
// mapa/xmap-marcadores.js — desenho de marcador de ativo, compartilhado
// pelas três camadas que desenham ativo (genérica, grama, elétrica).
//
// (1) Por que existe: com os 30 prédios posicionados, a tela media 195
// marcadores em 51 pontos distintos — a maior pilha com 24 ícones no mesmo
// pixel. Isso é consequência direta da herança de posição: todo ativo de um
// prédio recebe a coordenada DAQUELE prédio. Desenhados um a um viram um
// borrão onde deveria haver informação, e desligar uma camada não muda nada
// visível na tela.
//
// (2) Por que compartilhado e não copiado três vezes: o que varia entre as
// camadas é o ícone de UM ativo (máquina por categoria, elétrica por tipo,
// genérico por emoji) e o balão dele. O agrupamento, a contagem no ícone, a
// escolha da cor pelo estado mais grave, o balão de lista e o rótulo são os
// mesmos — e a primeira correção que alguém fizesse numa cópia não chegaria
// nas outras duas.
//
// (3) Nenhuma consulta aqui e nenhuma dependência nova: o agrupamento é do
// núcleo puro (mapa/mapa-geometria.js#agruparPorPonto).
// ══════════════════════════════════════════════════════════════════

import {
  agruparPorPonto,
  corDoEstado,
  rotuloDoEstado,
  classeDoEstado,
  linkDoModulo,
} from './mapa-geometria.js'

function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[c])
}

// A cor do grupo é a do estado MAIS GRAVE dele: um inoperante entre vinte
// operantes precisa ser visível de longe. Média ou maioria esconderia
// exatamente o que a tela existe para mostrar. Estado fora da lista (ou
// nulo) pesa como o menos grave, para não fingir gravidade que não se sabe.
const GRAVIDADE = ['inoperante', 'manutencao', 'standby', 'operante', 'baixado']

export function estadoMaisGrave(ativos) {
  let escolhido = null
  let melhor = Infinity
  for (const ativo of ativos || []) {
    const posicao = GRAVIDADE.indexOf(ativo?.estado)
    const peso = posicao === -1 ? GRAVIDADE.length : posicao
    if (peso < melhor) {
      melhor = peso
      escolhido = ativo?.estado ?? null
    }
  }
  return escolhido
}

function grupoSVG(emoji, estado, quantos) {
  const c = corDoEstado(estado)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <rect x="2" y="8" width="22" height="22" rx="5" fill="rgba(7,17,31,.94)" stroke="${c}" stroke-width="1.5"/>
    <text x="13" y="23" text-anchor="middle" font-size="12" fill="${c}">${emoji}</text>
    <circle cx="25" cy="9" r="8" fill="${c}" stroke="rgba(7,17,31,.94)" stroke-width="1.5"/>
    <text x="25" y="12.5" text-anchor="middle" font-size="9" font-weight="700" fill="#07111f">${quantos > 99 ? '99+' : quantos}</text>
  </svg>`
}

// Corta em 15 e ANUNCIA o resto, mesmo idioma das listas da barra lateral:
// truncar em silêncio faria o balão mentir sobre o próprio tamanho.
const LIMITE_LISTA_GRUPO = 15

function balaoDoGrupo(grupo, modulo, apresentacao) {
  const linhas = grupo.ativos.slice(0, LIMITE_LISTA_GRUPO).map((ativo) => {
    // O agrupamento não pode custar o acesso ao ativo: cada linha leva à
    // ficha quando o módulo tem rota (linkDoModulo valida módulo por lista
    // fechada e identificador por forma — nada é concatenado aqui).
    const link = linkDoModulo(modulo, ativo.id)
    const nome = link
      ? `<a href="${link}" class="xmap-popup-link">${esc(ativo.rotulo)}</a>`
      : esc(ativo.rotulo)
    return [nome, rotuloDoEstado(ativo.estado), classeDoEstado(ativo.estado)]
  })
  const sobrando = grupo.ativos.length - linhas.length
  if (sobrando > 0) linhas.push([`+${sobrando} neste ponto`, 'refine pela lista do módulo', 'info'])
  const onde = grupo.ativos[0]?.localPosicao
  const sub = onde
    ? `${esc(onde)} · ${grupo.ativos.length} ativos`
    : `${grupo.ativos.length} ativos neste ponto`
  return xMap.utils.popupHTML(apresentacao.emoji, esc(apresentacao.nome), sub, linhas)
}

/**
 * Desenha os ativos de uma camada agrupando os que caíram no mesmo ponto.
 *
 * @param {L.LayerGroup} group   camada do xMap
 * @param {object[]} ativos      ativos já posicionados (mapa-dados.js)
 * @param {object} opcoes
 *   - modulo: string             chave de módulo, só para linkDoModulo
 *   - emoji, nome: string        apresentação da camada (ícone do grupo/rótulo)
 *   - svgDeUm(ativo): string     ícone de um ativo só — o que varia por camada
 *   - ladoDeUm: number           lado do ícone de um ativo (padrão 26)
 *   - popupDeUm(ativo): string   balão de um ativo só
 *   - rotuloDeUm(ativo): string  texto do rótulo permanente (padrão: ativo.rotulo)
 */
export function desenharAtivosAgrupados(group, ativos, opcoes) {
  const { modulo, emoji, nome, svgDeUm, popupDeUm, ladoDeUm = 26, rotuloDeUm } = opcoes
  for (const ponto of agruparPorPonto(ativos)) {
    const varios = ponto.ativos.length > 1
    const primeiro = ponto.ativos[0]
    const lado = varios ? 34 : ladoDeUm
    const marker = L.marker([ponto.lat, ponto.lon], {
      icon: L.divIcon({
        html: varios ? grupoSVG(emoji, estadoMaisGrave(ponto.ativos), ponto.ativos.length) : svgDeUm(primeiro),
        className: '',
        iconSize: [lado, lado],
        iconAnchor: [lado / 2, lado / 2],
        popupAnchor: [0, -lado / 2],
      }),
    })
    marker.bindPopup(varios ? balaoDoGrupo(ponto, modulo, { emoji, nome }) : popupDeUm(primeiro), {
      maxWidth: 260,
    })
    // Rótulo permanente, escondido por CSS abaixo do zoom de detalhe
    // (mapa/index.html): sem nome nenhum, o mapa era um campo de ícones
    // iguais; com todos os nomes sempre visíveis, seria um campo de texto
    // sobreposto. O corte por zoom é o que faz os dois conviverem.
    // O rótulo do grupo nomeia o LOCAL, não repete o nome da camada:
    // "Climatização (16)" dito dezenas de vezes na tela não informa nada,
    // enquanto "F21 (16)" responde as duas perguntas de uma vez — onde é e
    // quantos há. Sem local herdado (posição própria), cai para o nome da
    // camada, que é a única identidade que o grupo tem.
    const texto = varios
      ? `${primeiro.localPosicao || nome} (${ponto.ativos.length})`
      : (rotuloDeUm ? rotuloDeUm(primeiro) : primeiro.rotulo)
    marker.bindTooltip(String(texto ?? ''), {
      permanent: true,
      direction: 'right',
      offset: [lado / 2 - 2, 0],
      className: 'xmap-rotulo',
    })
    group.addLayer(marker)
  }
}
