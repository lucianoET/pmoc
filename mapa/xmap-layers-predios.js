// ══════════════════════════════════════════════════════════════════
// xMap Layers — contorno dos prédios (cmasm_locais.geom, migração 37).
//
// (1) Por que é camada própria e não parte da planta vetorial: a planta
// (mapa/planta-cmasm.geojson) é o extrato do OpenStreetMap, estático, e
// nomeia 12 feições que NÃO correspondem aos prédios do cadastro (COMANDO,
// F21, MK48, EXOCET…). Esta camada desenha o cadastro real — o mesmo
// `cmasm_locais` de onde os ativos herdam posição —, então cada polígono
// aqui tem identidade no banco e conta quantos ativos moram nele.
//
// (2) Não é zona de serviço. Zona (maq_areas) é vegetação e área externa,
// auxiliar e temporária (D-03); prédio é local permanente da árvore de
// locais. As duas geometrias são desenhadas em cores e camadas separadas
// justamente para nunca mais um edifício entrar na conta de área de corte.
//
// (3) Nenhuma consulta aqui: tudo vem de mapa/mapa-dados.js, porta única
// do módulo (gate tests/mapa-camadas.test.js).
// ══════════════════════════════════════════════════════════════════

import { carregarLocaisComGeom } from './mapa-dados.js'

// Cor de edificação, deliberadamente fora da paleta operacional do núcleo
// puro e da paleta verde das zonas: um prédio não opera nem entra em
// manutenção nesta tela, e pintá-lo com a cor de ativo em serviço faria a
// legenda mentir. É o mesmo tom que a planta vetorial já usa para
// `building` em mapa/xmap.js#_estiloPlanta — o cadastro real e o extrato
// do OSM lendo como a mesma família de coisa.
const COR_PREDIO = '#b08968'

// Cópia local, mesmo idioma de mapa/app.js e mapa/mapa-editor.js — o
// projeto não tem utilitário compartilhado de escape, e todo valor de
// linha de banco que entra em marcação passa por um antes.
function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[c])
}

function renderPredios(group, predios) {
  for (const predio of predios) {
    const poly = L.polygon(predio.geom, {
      color: COR_PREDIO,
      weight: 2,
      fillColor: COR_PREDIO,
      fillOpacity: 0.25,
    })
    const nome = predio.nome || predio.codigo || `#${predio.id}`
    // Rótulo permanente só a partir do zoom de detalhe seria melhor, mas
    // exigiria escutar o mapa daqui — a camada não guarda referência ao
    // mapa de propósito. Tooltip por passagem do cursor resolve sem isso.
    poly.bindTooltip(nome, { direction: 'center', className: 'xmap-planta-label' })
    const linhas = []
    if (predio.codigo) linhas.push(['Código', esc(predio.codigo)])
    if (predio.tipo) linhas.push(['Tipo', esc(predio.tipo)])
    linhas.push(['Posição', 'Centroide do contorno', 'info'])
    poly.bindPopup(xMap.utils.popupHTML('🏢', esc(nome), 'Prédio', linhas), { maxWidth: 220 })
    group.addLayer(poly)
  }
}

export async function registrarCamadaPredios() {
  const predios = await carregarLocaisComGeom()
  xMap.registerLayer('predios', {
    contornos: {
      label: 'Prédios',
      color: COR_PREDIO,
      render(group) {
        renderPredios(group, predios)
      },
    },
  })
}
