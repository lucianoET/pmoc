// ══════════════════════════════════════════════════════════════════
// Camada de dados do módulo mapa — única porta de saída para o Supabase.
//
// (1) O que este arquivo é: depois deste plano (10-05), nenhum outro
// arquivo de mapa/ chama o cliente do Supabase diretamente — áreas,
// ativos posicionados por módulo, locais com coordenada e a coleta dos
// ativos sem posição passam todos por aqui. Os planos 10-06 e 10-07
// acrescentam as escritas neste arquivo, não espalhadas por xmap-layers-*.
//
// (2) O que NÃO é reimplementado aqui: resolução de posição (duas
// camadas — própria vence herdada), compatibilidade de máquina por zona e
// montagem de link para o módulo de origem vêm de mapa/mapa-geometria.js
// (núcleo puro, plano 10-02). Este arquivo só busca a linha crua e entrega
// para o núcleo puro calcular — a mesma divisão que shared/tema.js já
// estabeleceu entre núcleo puro e aplicador.
//
// (3) A lista de ativos sem posição (NAO_LOCALIZADOS) é estado deste
// arquivo de propósito: quem descobre que um ativo não tem coordenada
// nenhuma (nem própria, nem herdada do local) é quem acabou de ler a
// linha dele — descartar em silêncio aqui, como o código de camada de
// hoje faz (mapa/xmap-layers-grama.js:154 antes deste plano), é o
// principal modo de falha do mapa com dado real: um mapa vazio, sem erro
// nenhum, indistinguível de mapa quebrado (critério de sucesso 4).
// ══════════════════════════════════════════════════════════════════

import { resolverPosicao } from './mapa-geometria.js'

// ── Bloco 1 — cliente ───────────────────────────────────────────────
// Existe UM cliente Supabase por página — o que o boot de mapa/app.js cria
// depois do login — não um cliente por arquivo de camada. definirCliente é
// chamada uma vez, no boot; obterCliente é chamada pelas funções de leitura
// abaixo e por quem for registrar camada.
let _supa = null

export function definirCliente(supa) {
  _supa = supa
}

export function obterCliente() {
  if (!_supa) {
    throw new Error(
      'mapa-dados: cliente do Supabase ainda não foi definido — chame definirCliente(supa) no boot do módulo (mapa/app.js) antes de qualquer carga.'
    )
  }
  return _supa
}

// ── Bloco 4 (declarado antes do uso) — erro visível ─────────────────
// A pesquisa da Fase 10 registrou como armadilha o registro de camada não
// esperar por render assíncrono: o grupo entra vazio no mapa e, se a
// consulta falhar, o usuário vê um mapa sem nada e sem mensagem nenhuma.
// Esta função é a resposta — mesmo idioma visual de mapa/app.js
// (mostrarErroMapa: classe `callout co-red` de shared/pmoc.css), só que
// fixada num ponto da tela em vez de substituir o mapa inteiro, porque um
// erro de UMA camada não deveria apagar as outras que carregaram bem.
const ERRO_CARGA_ID = 'mapa-dados-erro-carga'

export function mostrarErroDeCarga(mensagem) {
  if (typeof document === 'undefined') return
  let el = document.getElementById(ERRO_CARGA_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = ERRO_CARGA_ID
    el.className = 'callout co-red'
    el.style.cssText =
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:1000;max-width:min(560px,92vw);margin:0'
    document.body.appendChild(el)
  }
  el.textContent = mensagem
}

// ── Bloco 2 — leitura ────────────────────────────────────────────────
// Uma função por consulta, todas assíncronas, todas no idioma de erro do
// projeto (CLAUDE.md § Conventions): desestruturar dado e erro, e em caso
// de erro registrar no console com o nome da tabela e devolver lista
// vazia, sem lançar — o mapa carrega parcialmente em vez de não carregar.

// maq_areas — zonas ativas de grama (D-03: zona mora aqui, não em
// cmasm_locais), com geometria e os três atributos de terreno da
// migração 25.
export async function carregarAreas() {
  const supa = obterCliente()
  const { data, error } = await supa
    .from('maq_areas')
    .select('id, codigo, nome, tipo, area_m2, geom, flora, inclinacao, limpeza')
    .eq('ativo', true)
    .order('nome')
  if (error) {
    console.error('mapa-dados: falha ao carregar maq_areas —', error.message)
    mostrarErroDeCarga('Não foi possível carregar as zonas de grama. ' + error.message)
    return []
  }
  return data || []
}

// cmasm_locais — só os que têm coordenada (posição herdada de prédio ou
// sala), devolvidos como mapa de id → local, pronto para o cruzamento em
// memória que posicionarAtivos faz — dezenas de locais contra centenas de
// ativos, cruzar em memória é mais simples que uma junção por ativo e não
// muda o resultado.
export async function carregarLocaisComPosicao() {
  const supa = obterCliente()
  const { data, error } = await supa
    .from('cmasm_locais')
    .select('id, nome, lat, lon')
    .not('lat', 'is', null)
    .not('lon', 'is', null)
  if (error) {
    console.error('mapa-dados: falha ao carregar cmasm_locais —', error.message)
    mostrarErroDeCarga('Não foi possível carregar os locais com posição. ' + error.message)
    return {}
  }
  const porId = {}
  for (const local of data || []) porId[local.id] = local
  return porId
}

// Relação de módulo para tabela: LISTA FECHADA. Módulo fora dela lança, e
// o nome da tabela nunca é montado por concatenação de texto — nome de
// tabela composto a partir de string é o começo de uma injeção, e a lista
// fechada custa três linhas (T-10-23). Cresce nos planos 10-06/10-07
// conforme mais módulos ganharem posição no mapa; hoje só grama
// (maq_ativos) e elétrica (elet_ativos) leem daqui.
const TABELA_POR_MODULO = {
  maquinas: 'maq_ativos',
  eletrica: 'elet_ativos',
}

// Colunas por módulo: categoria é exclusiva de maq_ativos, tipo é
// exclusiva de elet_ativos — o resto (identificação, estado, uso, vínculo
// de local, posição própria) é comum às duas tabelas.
const COLUNAS_POR_MODULO = {
  maquinas: 'id, codigo, nome, categoria, status, uso_atual, unidade_uso, local_id, lat, lon',
  eletrica: 'id, codigo, nome, tipo, status, uso_atual, unidade_uso, local_id, lat, lon',
}

export async function carregarAtivosDoModulo(modulo) {
  const tabela = TABELA_POR_MODULO[modulo]
  if (!tabela) {
    throw new Error(
      `mapa-dados: módulo "${modulo}" não está na lista fechada de tabelas de ativo (TABELA_POR_MODULO).`
    )
  }
  const supa = obterCliente()
  const { data, error } = await supa
    .from(tabela)
    .select(COLUNAS_POR_MODULO[modulo])
    .eq('ativo', true)
    .order('nome')
  if (error) {
    console.error(`mapa-dados: falha ao carregar ${tabela} —`, error.message)
    mostrarErroDeCarga(`Não foi possível carregar os ativos de ${modulo}. ${error.message}`)
    return []
  }
  return data || []
}

// Atalhos nomeados sobre carregarAtivosDoModulo, só para as camadas
// ficarem legíveis (mapa/xmap-layers-grama.js e -eletrica.js).
export function carregarMaquinas() {
  return carregarAtivosDoModulo('maquinas')
}

export function carregarAtivosEletricos() {
  return carregarAtivosDoModulo('eletrica')
}

// ── Bloco 3 — posicionamento e não localizados ──────────────────────
// Acumulada aqui, exportada, para o plano 10-07 exibir. Cada carga limpa
// só a fatia do módulo que está recarregando (limparNaoLocalizados),
// nunca a lista inteira — grama e elétrica registram-se em paralelo
// (Promise.all no boot de mapa/app.js) e uma limpeza total apagaria o que
// a outra acabou de escrever.
export const NAO_LOCALIZADOS = []

export function limparNaoLocalizados(modulo) {
  for (let i = NAO_LOCALIZADOS.length - 1; i >= 0; i--) {
    if (NAO_LOCALIZADOS[i].origemModulo === modulo) NAO_LOCALIZADOS.splice(i, 1)
  }
}

// posicionarAtivos percorre os ativos, chama resolverPosicao do núcleo
// puro para cada um (posição própria vence herdada do local) e devolve só
// os posicionados, cada um com lat/lon/origemPosicao anexados. Os sem
// posição não são descartados: entram em NAO_LOCALIZADOS com o nome do
// módulo de origem junto.
//
// Comentário longo aqui, porque é o ponto do plano: hoje o código de
// camada faz o descarte em silêncio (mapa/xmap-layers-grama.js:154), e com
// dados fixos isso nunca apareceu porque todos os pontos de demonstração
// tinham coordenada. Com dados reais, logo depois da migração 25 aplicada,
// o número esperado de ativos com posição é ZERO — ninguém posicionou nada
// ainda. Isso não é falha, é o estado inicial — e é exatamente por isso
// que esta lista precisa existir antes de qualquer conferência visual do
// mapa, senão a primeira impressão de um mapa real é "não funciona".
export function posicionarAtivos(ativos, locais, modulo) {
  limparNaoLocalizados(modulo)
  const posicionados = []
  for (const ativo of ativos || []) {
    const local = ativo?.local_id != null ? locais?.[ativo.local_id] : null
    const posicao = resolverPosicao(ativo, local)
    if (posicao.lat != null && posicao.lon != null) {
      posicionados.push({ ...ativo, lat: posicao.lat, lon: posicao.lon, origemPosicao: posicao.origem })
    } else {
      NAO_LOCALIZADOS.push({ ...ativo, origemModulo: modulo })
    }
  }
  return posicionados
}
