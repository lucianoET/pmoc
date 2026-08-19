// ══════════════════════════════════════════════════════════════════
// mapa/mapa-exportar.js — exportação do que está no mapa como GeoJSON.
//
// Portado em FUNÇÃO de DEV_reference_readonly/cmasm-mapa-v2 (`exportGeoJSON`),
// não em código: lá o mapa é MapLibre e a fonte são elementos criados na
// própria tela; aqui a fonte é o que veio do banco pela porta única
// (mapa/mapa-dados.js) e já está em memória — nenhuma consulta nova.
//
// A conversão de ordem é o miolo disto: `maq_areas.geom` e
// `cmasm_locais.geom` guardam `[lat, lon]`, que é a ordem que o Leaflet
// consome, e o GeoJSON (RFC 7946) exige `[lon, lat]`. Trocar isso de lugar
// não dá erro em lugar nenhum — só põe a base do CMASM na Antártida quando
// alguém abrir o arquivo no QGIS.
// ══════════════════════════════════════════════════════════════════

// Um anel de polígono em GeoJSON precisa FECHAR (primeiro vértice repetido
// no fim). O desenho do Leaflet não repete, então quem exporta é que fecha
// — sem isso o arquivo é inválido para leitores estritos.
function anelFechado(coords) {
  const anel = coords.map(([lat, lon]) => [lon, lat])
  const [primeiro] = anel
  const ultimo = anel[anel.length - 1]
  if (primeiro && ultimo && (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1])) {
    anel.push([...primeiro])
  }
  return anel
}

function feicaoDePonto(ativo) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [ativo.lon, ativo.lat] },
    properties: {
      camada: 'ativo',
      modulo: ativo.origemModulo ?? null,
      id: ativo.id ?? null,
      rotulo: ativo.rotulo ?? null,
      identificacao: ativo.detalhe ?? null,
      subtipo: ativo.subtipo ?? null,
      estado: ativo.estado ?? null,
      origem_posicao: ativo.origemPosicao ?? null,
      local_posicao: ativo.localPosicao ?? null,
    },
  }
}

function feicaoDeZona(zona) {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [anelFechado(zona.geom)] },
    properties: {
      camada: 'zona',
      id: zona.id ?? null,
      nome: zona.nome ?? null,
      tipo_servico: zona.tipo ?? null,
      flora: zona.flora ?? null,
      inclinacao: zona.inclinacao ?? null,
      limpeza: zona.limpeza ?? null,
      area_m2: zona.area_m2 ?? null,
    },
  }
}

function feicaoDePredio(predio) {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [anelFechado(predio.geom)] },
    properties: {
      camada: 'predio',
      id: predio.id ?? null,
      codigo: predio.codigo ?? null,
      nome: predio.nome ?? null,
      tipo: predio.tipo ?? null,
    },
  }
}

/**
 * Monta a coleção de feições. Núcleo puro: sem DOM, sem rede, sem Leaflet —
 * é o que permite testar a ordem das coordenadas em Node.
 *
 * Polígono com menos de três vértices é descartado, não exportado torto:
 * geometria inválida num arquivo que vai para outro sistema é pior que
 * ausência de geometria.
 */
export function montarGeoJSON({ posicionados = [], zonas = [], predios = [] } = {}) {
  const feicoes = [
    ...posicionados.filter((a) => a?.lat != null && a?.lon != null).map(feicaoDePonto),
    ...zonas.filter((z) => Array.isArray(z?.geom) && z.geom.length >= 3).map(feicaoDeZona),
    ...predios.filter((p) => Array.isArray(p?.geom) && p.geom.length >= 3).map(feicaoDePredio),
  ]
  return { type: 'FeatureCollection', features: feicoes }
}

// Nome com a data no formato do arquivo, não no do usuário: um arquivo por
// dia de trabalho, ordenável por nome.
export function nomeDoArquivo(agora = new Date()) {
  const iso = agora.toISOString().slice(0, 10)
  return `cmasm-mapa-${iso}.geojson`
}

// A borda com DOM, separada do núcleo puro acima (mesma divisão de
// shared/tema.js e mapa/mapa-geometria.js).
export function baixarGeoJSON(dados, nome = nomeDoArquivo()) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  // Sem isto o blob fica preso na memória da aba até o recarregamento —
  // o arquivo tem centenas de KB e o usuário exporta várias vezes.
  URL.revokeObjectURL(url)
  return dados.features.length
}
