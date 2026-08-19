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

// ── Bloco 2b — centroide do polígono ───────────────────────────────────
// Centroide de ÁREA (fórmula do polígono), não média de vértices: um lado
// com muitos vértices — a fachada detalhada de um prédio — puxaria a média
// aritmética para cima dele e o ponto sairia de dentro da planta. Trabalha
// em graus, sem projeção: para um edifício de dezenas de metros na
// latitude do CMASM o erro é irrelevante e o resultado precisa voltar em
// grau, que é o que `cmasm_locais.lat`/`lon` guardam.
//
// Polígono degenerado (menos de três vértices, ou área nula porque todos
// os vértices são colineares) devolve null em vez de NaN: quem chama grava
// coordenada, e NaN atravessaria a validação de envelope como "fora da
// região" — mensagem errada para o problema certo.
const AREA_MINIMA_CENTROIDE = 1e-12

export function centroidePoligono(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return null
  // A conta roda com o primeiro vértice na origem e o deslocamento é
  // somado de volta no fim. Sem isso, um prédio de 30 m em -22,84 / -43,10
  // multiplica dois números da ordem de 20-40 e subtrai o resultado de
  // outro quase igual: sobra ruído de ponto flutuante da mesma ordem da
  // área do prédio. O resultado ainda saía a milímetros do certo, mas o
  // erro cresce com a distância à origem do sistema de coordenadas, e é
  // gratuito não tê-lo.
  const [latOrigem, lonOrigem] = coords[0]
  if (!Number.isFinite(latOrigem) || !Number.isFinite(lonOrigem)) return null
  let areaDobro = 0
  let lat = 0
  let lon = 0
  const n = coords.length
  for (let i = 0; i < n; i++) {
    const [latA, lonA] = coords[i]
    const [latB, lonB] = coords[(i + 1) % n]
    if (!Number.isFinite(latA) || !Number.isFinite(lonA) || !Number.isFinite(latB) || !Number.isFinite(lonB)) return null
    const lat1 = latA - latOrigem
    const lon1 = lonA - lonOrigem
    const lat2 = latB - latOrigem
    const lon2 = lonB - lonOrigem
    const cruzado = lat1 * lon2 - lat2 * lon1
    areaDobro += cruzado
    lat += (lat1 + lat2) * cruzado
    lon += (lon1 + lon2) * cruzado
  }
  // Comparar com zero exato não basta: três vértices colineares produzem
  // resto de ponto flutuante da ordem de 1e-17, e o "centroide" resultante
  // é ruído dividido por ruído. O corte é 1e-12 em grau² dobrado — cerca
  // de 0,006 m², menor que qualquer coisa que alguém desenhe no mapa e dez
  // ordens de grandeza acima do resto (um prédio de 30 m dá ~1,8e-7).
  if (Math.abs(areaDobro) < AREA_MINIMA_CENTROIDE) return null
  return [latOrigem + lat / (3 * areaDobro), lonOrigem + lon / (3 * areaDobro)]
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

// ── Bloco 5b — a árvore de locais e a cadeia de herança ────────────────
// Uma sala não recebe coordenada própria: ela fica DENTRO de um prédio, e
// a posição dela é a do prédio. O banco confirma que essa é a forma da
// coisa — 175 dos 190 ativos apontam para uma sala, e as 132 salas ativas
// são todas filhas de uma edificação.
//
// A lista é do que HERDA, não do que posiciona, de propósito: um tipo novo
// que apareça no cadastro aparece na tela para alguém posicionar, em vez
// de sumir em silêncio da lista e ninguém descobrir por quê.
export const TIPOS_QUE_HERDAM_POSICAO = ['sala']

export function herdaPosicao(tipo) {
  return TIPOS_QUE_HERDAM_POSICAO.includes(String(tipo ?? '').toLowerCase())
}

// O outro extremo da cadeia: a raiz da árvore é a Organização Militar
// inteira, e ela TEM coordenada. Sem esta lista, subir o `parent_id` até o
// fim daria posição a todo ativo do CMASM — 188 pinos empilhados no mesmo
// ponto, o mapa dizendo "tudo localizado" e a lista de não localizados
// esvaziando justamente o trabalho de campo que falta fazer. Um ponto no
// centro de 20 hectares não é uma posição; é a ausência dela com aparência
// de dado. Comparação em minúsculas porque o tipo vem do cadastro com a
// caixa que o cadastro tem ("Organizacao Militar").
export const TIPOS_SEM_HERANCA = ['organizacao militar']

export function serveDePosicaoHerdada(local) {
  if (!local) return false
  if (TIPOS_SEM_HERANCA.includes(String(local.tipo ?? '').toLowerCase())) return false
  return dentroDoEnvelope(local.lat, local.lon)
}

// Sobe a cadeia `parent_id` a partir de `localId` e devolve o primeiro
// local que satisfaz `aceita` — o próprio local incluído. Devolve null se
// a cadeia acabar sem ninguém aceito.
//
// A guarda de ciclo não é hipótese acadêmica: `parent_id` é uma coluna
// comum, sem restrição de aciclicidade no banco, e um cadastro que aponte
// dois locais um para o outro travaria a tela inteira num laço infinito —
// não daria erro, daria uma aba congelada. O conjunto de visitados custa
// nada e transforma isso em "não achei ancestral".
export function localAscendente(localId, locais, aceita) {
  if (localId == null || !locais || typeof aceita !== 'function') return null
  const visitados = new Set()
  let atual = locais[localId]
  while (atual && !visitados.has(atual.id)) {
    visitados.add(atual.id)
    if (aceita(atual)) return atual
    atual = atual.parent_id != null ? locais[atual.parent_id] : null
  }
  return null
}

// As duas subidas que a tela faz, cada uma com o seu critério:
//
// (1) de onde a posição vem — o primeiro ancestral com coordenada válida;
// (2) qual local o usuário deveria posicionar para acender este ativo — o
//     primeiro ancestral que não herda posição (a sala manda para o prédio
//     dela). É o que faz a contagem da barra lateral dizer a verdade.
export function localComPosicao(localId, locais) {
  return localAscendente(localId, locais, serveDePosicaoHerdada)
}

export function localPosicionavel(localId, locais) {
  return localAscendente(localId, locais, (l) => !herdaPosicao(l?.tipo))
}

// ── Bloco 6 — resolução de posição em duas camadas ─────────────────────
// A posição do local (cmasm_locais.lat/lon) é do prédio inteiro,
// compartilhada por todos os ativos ligados a ele — inclusive os ligados a
// uma SALA dele, que chega aqui já resolvida pelo Bloco 5b: esta função
// continua decidindo só entre duas camadas (própria × herdada), e quem
// escolhe qual local representa a camada herdada é o chamador; a posição própria do
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

// ── Bloco 8 — vocabulário de estado do ativo ───────────────────────────
// Cada tabela de ativo fala o estado com palavras próprias, e até agora
// cada camada trazia a própria ponte: statusParaExibicao em
// xmap-layers-grama.js, estadoParaExibicao em xmap-layers-eletrica.js,
// mais os dicionários de cor logo ao lado de cada uma. Com três famílias
// novas entrando (transportes, fonoclama, refrigeração) seriam seis
// pontes e seis paletas — e a legenda da tela não teria de onde ler a cor
// sem escrever hex à mão numa sétima cópia. A ponte passa a morar aqui,
// no núcleo puro, junto das outras listas fechadas do arquivo.
//
// `sobreaviso` (transp_ativos) ganhou estado próprio em vez de ser dobrado
// em `operante` ou `manutencao`: um veículo de sobreaviso não está livre
// nem parado, e achatar os dois casos apagaria da tela justamente a
// distinção que o despachante procura.
export const ESTADOS = {
  operante:   { rotulo: 'Operante',      cor: '#22c55e' },
  standby:    { rotulo: 'Sobreaviso',    cor: '#38bdf8' },
  manutencao: { rotulo: 'Em manutenção', cor: '#f59e0b' },
  inoperante: { rotulo: 'Inoperante',    cor: '#ef4444' },
  baixado:    { rotulo: 'Baixado',       cor: '#4a6785' },
}

// Cor de quem não casou com a lista fechada — nunca a cor de "operante",
// para um valor desconhecido não passar por máquina boa na tela.
export const COR_ESTADO_DESCONHECIDO = '#8fa8c8'

// Um dicionário por módulo, cada um com os valores REAIS da coluna que
// aquela tabela usa (verificados no banco de produção em 18/08/2026):
// status em maq_ativos/elet_ativos/fono_ativos, status em transp_ativos
// (outro vocabulário) e `funciona` em equipamentos (OK/NOK — a tabela de
// refrigeração é anterior ao padrão e não tem coluna `status`).
const ESTADO_POR_MODULO = {
  maquinas:     { operante: 'operante', manutencao: 'manutencao', inoperante: 'inoperante', baixado: 'baixado' },
  eletrica:     { operante: 'operante', manutencao: 'manutencao', inoperante: 'inoperante', baixado: 'baixado' },
  fonoclama:    { operante: 'operante', manutencao: 'manutencao', inoperante: 'inoperante', baixado: 'baixado' },
  transportes:  { disponivel: 'operante', sobreaviso: 'standby', manutencao: 'manutencao', indisponivel: 'inoperante', baixado: 'baixado' },
  climatizacao: { OK: 'operante', NOK: 'inoperante' },
}

// Mesma técnica de normalizarFlora acima: comparação contra lista fechada,
// sem trim e sem conversão de caixa. hasOwnProperty em vez de acesso
// direto para um valor como "constructor" ou "__proto__" vindo do banco
// não devolver função nenhuma.
export function normalizarEstado(modulo, valor) {
  const dicionario = ESTADO_POR_MODULO[modulo]
  if (!dicionario) return null
  return Object.prototype.hasOwnProperty.call(dicionario, valor) ? dicionario[valor] : null
}

export function corDoEstado(estado) {
  return ESTADOS[estado]?.cor || COR_ESTADO_DESCONHECIDO
}

export function rotuloDoEstado(estado) {
  return ESTADOS[estado]?.rotulo || 'Estado desconhecido'
}

// Classe visual da linha do balão, por estado — o mesmo vocabulário de
// ok/warn/error que mapa/xmap.css já define para as linhas de popup. Mora
// aqui, e não em cada camada, pela mesma razão que a cor: é mapeamento de
// lista fechada, não desenho, e três camadas precisam do mesmo resultado.
const CLASSE_POR_ESTADO = {
  operante: 'ok',
  standby: 'info',
  manutencao: 'warn',
  inoperante: 'error',
  baixado: '',
}

export function classeDoEstado(estado) {
  return Object.prototype.hasOwnProperty.call(CLASSE_POR_ESTADO, estado) ? CLASSE_POR_ESTADO[estado] : ''
}
