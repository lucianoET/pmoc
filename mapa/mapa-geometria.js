// ══════════════════════════════════════════════════════════════════
// Núcleo puro do mapa operacional — cálculo e regra, sem Leaflet e sem DOM.
//
// (1) O que este arquivo é: tudo que o editor de zona (plano 10-06) e as
// camadas do mapa (plano 10-05) precisam calcular — área de polígono,
// compatibilidade de máquinas, validação de terreno e de coordenada,
// resolução de posição de ativo e link para o módulo de origem — vive
// aqui, como função pura.
//
// (2) Restrição estrutural: nada roda no escopo de topo além de declarar
// constantes e funções, e nenhuma API de navegador é tocada — nem
// document, nem window, nem localStorage, nem fetch, nem o global L do
// Leaflet. tests/mapa-geometria.test.js importa este arquivo dentro do
// node --test; qualquer acesso a API de navegador no momento do import
// quebraria essa suíte. Mesma divisão que shared/tema.js já estabeleceu
// entre núcleo puro (normalizarTema, proximoTema) e aplicadores de
// navegador (detectarTema, aplicarTema, alternarTema, iniciarTema).
//
// (3) calcAreaM2 e calcCompatCliente são PORTADAS do editor legado
// (/home/luc/DEV_ERP/cmms-mapa/admin.html, linhas 1268-1282 e 1009-1026),
// não reescritas. calcAreaM2 é fórmula por excesso esférico — mesma
// família de turf.js area() — correta para a latitude do CMASM; a
// suposição de que ela está certa (A2 da pesquisa da Fase 10) é fechada
// por medição em tests/mapa-geometria.test.js, não por leitura.
//
// (4) O que NÃO é portado: a camada de rede do legado. Lá havia um
// backend Node próprio em localhost (`http://localhost:8010/api/grama`);
// aqui há Supabase, e falar com ele mora em mapa/mapa-editor.js e
// mapa/xmap-layers-*.js (planos 10-05/10-06), nunca neste arquivo.
// ══════════════════════════════════════════════════════════════════

// ── Bloco 1 — listas fechadas de terreno ──────────────────────────────
// Os mesmos nove valores que o `check ... in (...)` da migração 25 grava
// no banco (supabase/25_mapa_geometria_posicao.sql) — duplicação
// deliberada, cada lado com teste próprio afirmando os literais, para que
// mudar um sem o outro quebre um dos dois gates.
export const FLORAS = ['gramado', 'capim_colonial', 'mata_fechada']
export const INCLINACOES = ['plano', 'moderado', 'acentuado']
export const LIMPEZAS = ['limpa', 'media', 'densa']

// Mesmo espírito de normalizarTema (shared/tema.js): o valor vem de tela
// e de banco, os dois tratados como não confiáveis — comparação estrita
// contra a lista fechada, sem trim, sem conversão de caixa, sem conversão
// para texto (ASVS V5).
export function normalizarFlora(valor) {
  return FLORAS.includes(valor) ? valor : null
}

export function normalizarInclinacao(valor) {
  return INCLINACOES.includes(valor) ? valor : null
}

export function normalizarLimpeza(valor) {
  return LIMPEZAS.includes(valor) ? valor : null
}

// ── Bloco 2 — área do polígono ─────────────────────────────────────────
// Portada IDÊNTICA de DEV_ERP/cmms-mapa/admin.html:1269-1282, incluindo a
// constante de raio da Terra e o Math.abs final. Não é fórmula planar
// "corrigida por latitude" (como o comentário do legado sugeria) — é
// fórmula por excesso esférico, a mesma família que turf.js `area()` e
// `SphericalUtil.computeArea()` do Google Maps Android usam, adequada à
// latitude do CMASM (≈ -22,84°) e a polígonos de algumas centenas de
// metros. A correção dela foi confirmada por medição no teste que
// acompanha este plano (quadrado de 100 m, folga de 1%), não só por
// leitura — a pesquisa da Fase 10 tinha isso como suposição em aberto (A2).
export function calcAreaM2(coords) {
  if (!coords || coords.length < 3) return 0
  const R = 6371000 // raio da Terra em metros
  const toRad = (d) => (d * Math.PI) / 180
  let area = 0
  const n = coords.length
  for (let i = 0; i < n; i++) {
    const [lat1, lon1] = coords[i]
    const [lat2, lon2] = coords[(i + 1) % n]
    area += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)))
  }
  return Math.abs((area * R * R) / 2)
}

// ── Bloco 3 — compatibilidade de máquinas ──────────────────────────────
// Portada IDÊNTICA de DEV_ERP/cmms-mapa/admin.html:1009-1026, cascata de
// condições e vocabulário de saída inalterados (cortador_grama,
// roçadeira com cedilha, motosserra com dois esses) — inclusive o ternário
// redundante do ramo "inclinacao === 'acentuado'", que no legado sempre
// devolve ['roçadeira'] independente de `limpeza`: é um resquício do
// legado, não um bug deste port, e mantê-lo como está é o que "portar, não
// reescrever" significa. O sentido da tradução de vocabulário é herdado
// do legado (compatibilidade → nome de exibição); o sentido inverso
// (categoria do banco → vocabulário desta regra) é o Bloco 4, que o
// legado não tinha.
export function calcCompatCliente(flora, inclinacao, limpeza) {
  if (!flora || !inclinacao || !limpeza) return []
  if (flora === 'mata_fechada') return ['motosserra', 'roçadeira']
  if (inclinacao === 'acentuado') {
    return limpeza === 'densa' ? ['roçadeira'] : ['roçadeira']
  }
  if (flora === 'gramado') {
    if (inclinacao === 'plano' && limpeza === 'limpa') return ['cortador_grama']
    if (inclinacao === 'plano') return ['cortador_grama', 'roçadeira']
    return ['roçadeira']
  }
  if (flora === 'capim_colonial') {
    if (inclinacao === 'plano' && limpeza === 'limpa') return ['cortador_grama', 'roçadeira']
    if (limpeza === 'media' || limpeza === 'densa') return ['roçadeira']
    return ['roçadeira']
  }
  return []
}

// ── Bloco 4 — normalização de vocabulário, o que faltava no legado ────
// maq_ativos.categoria (supabase/02_maquinas_seed.sql:44-51) usa
// `rocadeira`/`motoserra` sem os acentos/dobras que calcCompatCliente
// espera. Mapeia só essas duas divergências de grafia — qualquer outro
// valor (inclusive minitrator/trator) volta como veio, sem adivinhação.
export function normalizarCategoria(categoria) {
  const mapa = { rocadeira: 'roçadeira', motoserra: 'motosserra' }
  return mapa[categoria] || categoria
}

// Os três termos que calcCompatCliente é capaz de devolver, em qualquer
// combinação dos três atributos de terreno — o vocabulário que a regra do
// legado conhece. Interno: não é a validação de terreno (Bloco 1), é o
// universo de tipos de máquina que a regra reconhece como máquina de
// controle vegetal.
const VOCABULARIO_REGRA = ['cortador_grama', 'roçadeira', 'motosserra']

// maquinasParaZona compõe os dois blocos anteriores. Das quatro
// categorias reais do inventário (rocadeira, motoserra, minitrator,
// trator — supabase/02_maquinas_seed.sql:44-51), duas são grafia
// diferente do mesmo equipamento (resolvidas por normalizarCategoria) e
// duas (minitrator, trator) descrevem máquinas que a regra do legado
// nunca considerou: dos três tratores do inventário, dois são cortadores
// de grama montados (Husqvarna LGT2654, TS114) e um é trator agrícola
// (Solis 90) — a coluna categoria sozinha não distingue os três. Mapear
// minitrator/trator por adivinhação (ex. sempre para cortador_grama)
// acertaria alguns casos e erraria outros, sem deixar rastro nenhum.
// Devolvê-los numa lista própria (semMapeamento) deixa a tela dizer
// "existem N máquinas fora da regra de compatibilidade" — a única saída
// honesta. Esta é a resposta ao Pitfall 1 da pesquisa da Fase 10: sem
// normalizarCategoria, a lista de compatíveis sai vazia mesmo com os três
// atributos definidos e máquinas reais cadastradas, sem nenhum erro.
export function maquinasParaZona(zona, ativos) {
  const compat = calcCompatCliente(zona?.flora, zona?.inclinacao, zona?.limpeza)
  const compativeis = []
  const semMapeamento = []
  for (const ativo of ativos || []) {
    const categoria = normalizarCategoria(ativo?.categoria)
    if (!VOCABULARIO_REGRA.includes(categoria)) {
      semMapeamento.push(ativo)
    } else if (compat.includes(categoria)) {
      compativeis.push(ativo)
    }
  }
  return { compativeis, semMapeamento }
}

// ── Bloco 5 — envelope de coordenada ───────────────────────────────────
// Os mesmos quatro números do `check` da migração 25
// (supabase/25_mapa_geometria_posicao.sql) — duplicação deliberada, cada
// lado com teste próprio afirmando os literais, para que um não mude sem
// quebrar o outro. A barreira real é a do banco; isto é só a recusa
// antecipada, para o usuário ver o erro na tela em vez de receber um erro
// de restrição do Postgres.
export const ENVELOPE = { latMin: -23.2, latMax: -22.5, lonMin: -43.5, lonMax: -42.7 }

export function dentroDoEnvelope(lat, lon) {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    lat >= ENVELOPE.latMin &&
    lat <= ENVELOPE.latMax &&
    lon >= ENVELOPE.lonMin &&
    lon <= ENVELOPE.lonMax
  )
}

// ── Bloco 6 — resolução de posição em duas camadas ─────────────────────
// A posição do local (cmasm_locais.lat/lon) é do prédio inteiro,
// compartilhada por todos os ativos ligados a ele; a posição própria do
// ativo é o que PLAT-20 grava quando alguém arrasta um ativo no mapa.
// Devolver a origem, e não só o par, é o que permite à tela distinguir
// "está no prédio" de "foi posicionado aqui". `local` ausente ou nulo não
// lança — só significa que não há posição herdada para cair.
export function resolverPosicao(ativo, local) {
  if (dentroDoEnvelope(ativo?.lat, ativo?.lon)) {
    return { lat: ativo.lat, lon: ativo.lon, origem: 'propria' }
  }
  if (dentroDoEnvelope(local?.lat, local?.lon)) {
    return { lat: local.lat, lon: local.lon, origem: 'herdada' }
  }
  return { lat: null, lon: null, origem: null }
}

// ── Bloco 7 — link para o módulo de origem ─────────────────────────────
// O valor vem de linha de banco (nome de módulo, id de ativo) e vai virar
// atributo de destino num balão do mapa (PLAT-14); montar URL a partir de
// texto não validado é o caminho curto para uma injeção de destino. Lista
// fechada de módulo, mesma técnica de normalizarTema, mais identificador
// inteiro — qualquer outra combinação devolve null em vez de montar rota.
export const MODULOS = {
  maquinas: '/maquinas',
  transportes: '/transportes',
  eletrica: '/eletrica',
  fonoclama: '/fonoclama',
  predial: '/predial',
}

export function linkDoModulo(modulo, id) {
  const rota = MODULOS[modulo]
  if (!rota) return null
  if (typeof id !== 'number' || !Number.isInteger(id)) return null
  return `${rota}?ativo=${id}`
}
