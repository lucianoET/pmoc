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

import {
  resolverPosicao,
  calcAreaM2,
  normalizarFlora,
  normalizarInclinacao,
  normalizarLimpeza,
  dentroDoEnvelope,
  normalizarEstado,
  centroidePoligono,
  localComPosicao,
  localPosicionavel,
  herdaPosicao,
} from './mapa-geometria.js'

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

// cmasm_locais — a ÁRVORE inteira de locais ativos, devolvida como mapa de
// id → local, pronta para o cruzamento em memória que posicionarAtivos faz
// (234 locais contra centenas de ativos; cruzar em memória é mais simples
// que uma junção por ativo e não muda o resultado).
//
// Antes esta consulta trazia só quem tinha coordenada, e por isso a
// herança enxergava um passo só. Não dava: 175 dos 190 ativos apontam para
// uma SALA, e sala não recebe coordenada — ela fica dentro de um prédio. O
// local intermediário PRECISA vir mesmo sem lat/lon, senão a cadeia
// `parent_id` se rompe justamente no elo que faltava subir, e posicionar
// os 30 prédios acenderia 2 ativos em vez de 177.
export async function carregarArvoreDeLocais() {
  const supa = obterCliente()
  const { data, error } = await supa
    .from('cmasm_locais')
    .select('id, nome, tipo, parent_id, lat, lon')
    .eq('ativo', true)
  if (error) {
    console.error('mapa-dados: falha ao carregar cmasm_locais —', error.message)
    mostrarErroDeCarga('Não foi possível carregar a árvore de locais. ' + error.message)
    return {}
  }
  const porId = {}
  for (const local of data || []) porId[local.id] = local
  return porId
}

// cmasm_locais — o oposto da consulta acima: os locais ATIVOS que ainda
// não têm coordenada. É a lista de onde sai a seção "Prédios sem posição"
// da barra lateral, e a razão de ela existir é a alavanca da arquitetura
// de duas camadas: posicionar UM prédio acende de uma vez todos os ativos
// ligados a ele por local_id, enquanto posicionar ativo a ativo custa um
// ato de campo por ativo. Em 18/08/2026 são 311 locais, 0 com coordenada,
// e 190 ativos apontando para 138 deles.
// Estado deste arquivo pelo mesmo motivo de NAO_LOCALIZADOS: quem leu a
// linha é quem sabe. A tela desenha a lista e o editor precisa do nome do
// prédio para a faixa de "clique no mapa" — sem uma lista compartilhada,
// o nome teria que viajar por atributo onclick, exatamente o que
// renderItemNaoLocalizado evita de propósito.
export const LOCAIS_SEM_POSICAO = []

export async function carregarLocaisSemPosicao() {
  const supa = obterCliente()
  const { data, error } = await supa
    .from('cmasm_locais')
    .select('id, codigo, nome, tipo')
    .eq('ativo', true)
    .is('lat', null)
    .order('nome')
  if (error) {
    console.error('mapa-dados: falha ao carregar cmasm_locais sem posição —', error.message)
    mostrarErroDeCarga('Não foi possível carregar os prédios sem posição. ' + error.message)
    return []
  }
  LOCAIS_SEM_POSICAO.length = 0
  // Sala fica de fora: ela não recebe coordenada própria, herda a do
  // prédio (núcleo puro, TIPOS_QUE_HERDAM_POSICAO). Oferecer as 132 salas
  // para posicionar uma a uma era pedir 132 atos de campo para acender o
  // que 30 prédios acendem. O filtro é do cliente e não da consulta de
  // propósito: a lista de quem herda mora no núcleo puro, e duplicá-la
  // dentro de um `.not('tipo','in',...)` criaria a segunda cópia — a
  // primeira a divergir.
  LOCAIS_SEM_POSICAO.push(...(data || []).filter((local) => !herdaPosicao(local.tipo)))
  return LOCAIS_SEM_POSICAO
}

// cmasm_locais — os prédios que já têm CONTORNO desenhado (migração 37).
// Consulta separada de carregarArvoreDeLocais de propósito: aquela
// devolve um mapa de id → ponto para o cruzamento em memória de
// posicionarAtivos e é chamada a cada gravação de posição; esta devolve
// uma lista de polígonos para desenhar. Trazer `geom` — dezenas de
// vértices por prédio — na consulta de posição encareceria o caminho
// quente sem que ninguém ali fosse ler a geometria.
export async function carregarLocaisComGeom() {
  const supa = obterCliente()
  const { data, error } = await supa
    .from('cmasm_locais')
    .select('id, codigo, nome, tipo, geom')
    .eq('ativo', true)
    .not('geom', 'is', null)
    .order('nome')
  if (error) {
    console.error('mapa-dados: falha ao carregar contornos de cmasm_locais —', error.message)
    mostrarErroDeCarga('Não foi possível carregar os contornos dos prédios. ' + error.message)
    return []
  }
  // Linha com `geom` gravada mas curta demais para fechar um polígono é
  // descartada aqui, não no desenho: o Leaflet aceitaria dois pontos e
  // desenharia um traço, que na tela lê como prédio errado, não como dado
  // faltando.
  return (data || []).filter((local) => Array.isArray(local.geom) && local.geom.length >= 3)
}

// Relação de módulo para tabela e colunas: LISTA FECHADA. Módulo fora
// dela lança, e o nome da tabela nunca é montado por concatenação de
// texto — nome de tabela composto a partir de string é o começo de uma
// injeção, e a lista fechada custa três linhas (T-10-23).
//
// Por que virou um objeto de configuração por módulo, e não mais dois
// dicionários de tabela e de colunas: `equipamentos` (refrigeração) é
// anterior ao padrão `*_ativos` do projeto e não tem NENHUMA das colunas
// que as outras quatro compartilham — não tem `ativo`, não tem `codigo`,
// não tem `nome` e não tem `status`. Tem `predio`, `local`, `tipo`,
// `funciona` (OK/NOK), `estado` (NOVA/SEMI/VELHA) e `patrimonio`.
// Com colunas fixas no corpo da consulta, a única saída seria um `if`
// para refrigeração dentro de carregarAtivosDoModulo — e o próximo
// módulo com schema próprio traria o segundo. A forma da tabela passa a
// ser dado, não desvio de fluxo.
//
// Atenção ao par de nomes parecidos: em refrigeração, `colunaEstado` é
// `funciona`, NÃO a coluna literalmente chamada `estado` — essa guarda a
// idade do aparelho (NOVA/SEMI/VELHA), não se ele opera.
const CONFIG_POR_MODULO = {
  maquinas: {
    tabela: 'maq_ativos',
    colunas: 'id, codigo, nome, categoria, status, uso_atual, unidade_uso, local_id, lat, lon',
    colunaAtivo: 'ativo',
    colunaOrdem: 'nome',
    colunaRotulo: 'nome',
    colunaDetalhe: 'codigo',
    colunaSubtipo: 'categoria',
    colunaEstado: 'status',
  },
  eletrica: {
    tabela: 'elet_ativos',
    colunas: 'id, codigo, nome, tipo, status, uso_atual, unidade_uso, local_id, lat, lon',
    colunaAtivo: 'ativo',
    colunaOrdem: 'nome',
    colunaRotulo: 'nome',
    colunaDetalhe: 'codigo',
    colunaSubtipo: 'tipo',
    colunaEstado: 'status',
  },
  transportes: {
    tabela: 'transp_ativos',
    colunas: 'id, codigo, nome, tipo, subtipo, identificacao, status, uso_atual, unidade_uso, local_id, lat, lon',
    colunaAtivo: 'ativo',
    colunaOrdem: 'nome',
    colunaRotulo: 'nome',
    colunaDetalhe: 'identificacao',
    colunaSubtipo: 'tipo',
    colunaEstado: 'status',
  },
  fonoclama: {
    tabela: 'fono_ativos',
    colunas: 'id, codigo, nome, tipo, patrimonio, status, uso_atual, unidade_uso, local_id, lat, lon',
    colunaAtivo: 'ativo',
    colunaOrdem: 'nome',
    colunaRotulo: 'nome',
    colunaDetalhe: 'codigo',
    colunaSubtipo: 'tipo',
    colunaEstado: 'status',
  },
  climatizacao: {
    tabela: 'equipamentos',
    colunas: 'id, tipo, predio, local, funciona, estado, patrimonio, local_id, lat, lon, situacao',
    colunaAtivo: null,
    colunaOrdem: 'predio',
    colunaRotulo: 'tipo',
    colunaDetalhe: 'local',
    colunaSubtipo: 'tipo',
    colunaEstado: 'funciona',
    // D-uyz: duas perguntas diferentes de colunaAtivo — equipamentos não
    // tem coluna de arquivamento (colunaAtivo continua null), e a
    // situação patrimonial não é arquivamento. Só climatizacao declara
    // colunaSituacao — as outras quatro famílias não ganham nada aqui.
    colunaSituacao: 'situacao',
    situacaoVisivel: 'instalado',
  },
}

// Lista de módulos que o mapa sabe carregar, na ordem em que a tela os
// apresenta. Exportada para a tela e o editor não redeclararem a lista —
// mesmo motivo de CARGOS_POSICAO morar aqui e ser importada.
export const MODULOS_DE_ATIVO = Object.keys(CONFIG_POR_MODULO)

export function configDoModulo(modulo) {
  const config = Object.prototype.hasOwnProperty.call(CONFIG_POR_MODULO, modulo)
    ? CONFIG_POR_MODULO[modulo]
    : null
  if (!config) {
    throw new Error(
      `mapa-dados: módulo "${modulo}" não está na lista fechada de tabelas de ativo (CONFIG_POR_MODULO).`
    )
  }
  return config
}

export async function carregarAtivosDoModulo(modulo) {
  const config = configDoModulo(modulo)
  const supa = obterCliente()
  let consulta = supa.from(config.tabela).select(config.colunas)
  // `equipamentos` não tem coluna de arquivamento — filtrar por ela
  // devolveria erro do Postgres em vez de lista. O filtro é aplicado só
  // onde a coluna existe.
  if (config.colunaAtivo) consulta = consulta.eq(config.colunaAtivo, true)
  if (config.colunaSituacao) consulta = consulta.eq(config.colunaSituacao, config.situacaoVisivel)
  const { data, error } = await consulta.order(config.colunaOrdem)
  if (error) {
    // D-uyz-24: num banco sem a migração 42, `situacao` não existe — o
    // select acima devolve 400 do PostgREST e a camada inteira viraria
    // lista vazia (171 marcadores sumindo sem nada dizendo por quê). Um
    // único recuo: repete a consulta sem a coluna e sem o filtro, com
    // aviso no console — só o SEGUNDO erro chama mostrarErroDeCarga.
    if (config.colunaSituacao) {
      console.warn(
        `mapa-dados: ${config.tabela} sem a coluna de situação (banco sem a migração 42?) — repetindo sem ela.`,
        error.message
      )
      let retentativa = supa.from(config.tabela).select(config.colunas.replace(/,\s*situacao/, ''))
      if (config.colunaAtivo) retentativa = retentativa.eq(config.colunaAtivo, true)
      const semSituacao = await retentativa.order(config.colunaOrdem)
      if (semSituacao.error) {
        console.error(`mapa-dados: falha ao carregar ${config.tabela} —`, semSituacao.error.message)
        mostrarErroDeCarga(`Não foi possível carregar os ativos de ${modulo}. ${semSituacao.error.message}`)
        return []
      }
      return semSituacao.data || []
    }
    console.error(`mapa-dados: falha ao carregar ${config.tabela} —`, error.message)
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

// Contraparte de NAO_LOCALIZADOS, pelo mesmo motivo e com a mesma regra de
// limpeza por módulo: quem sabe quais ativos ficaram no mapa é quem acabou
// de resolver a posição deles. A busca da tela (voar até o ativo) lê daqui
// em vez de percorrer as camadas do Leaflet — a lista é dado, o marcador é
// desenho, e procurar dentro do desenho amarraria a busca ao componente
// travado (mapa/xmap.js).
export const POSICIONADOS = []

export function limparNaoLocalizados(modulo) {
  for (let i = NAO_LOCALIZADOS.length - 1; i >= 0; i--) {
    if (NAO_LOCALIZADOS[i].origemModulo === modulo) NAO_LOCALIZADOS.splice(i, 1)
  }
}

export function limparPosicionados(modulo) {
  for (let i = POSICIONADOS.length - 1; i >= 0; i--) {
    if (POSICIONADOS[i].origemModulo === modulo) POSICIONADOS.splice(i, 1)
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
  limparPosicionados(modulo)
  const config = configDoModulo(modulo)
  const posicionados = []
  for (const ativo of ativos || []) {
    // Duas subidas na árvore, cada uma com o seu critério (núcleo puro):
    // de onde a posição vem, e qual local o usuário posicionaria para
    // acender este ativo. A segunda só interessa a quem ficou sem posição.
    const local = localComPosicao(ativo?.local_id, locais)
    const posicao = resolverPosicao(ativo, local)
    // Rótulo, subtipo e estado são resolvidos AQUI, uma vez, pelo nome de
    // coluna que a configuração do módulo declara — as camadas e a busca
    // recebem um formato único e nunca precisam saber que refrigeração
    // guarda o estado em `funciona` e as outras em `status`.
    const comum = {
      ...ativo,
      origemModulo: modulo,
      rotulo: ativo?.[config.colunaRotulo] ?? ativo?.[config.colunaDetalhe] ?? `#${ativo?.id}`,
      detalhe: ativo?.[config.colunaDetalhe] ?? null,
      subtipo: ativo?.[config.colunaSubtipo] ?? null,
      estado: normalizarEstado(modulo, ativo?.[config.colunaEstado]),
    }
    if (posicao.lat != null && posicao.lon != null) {
      const posicionado = {
        ...comum,
        lat: posicao.lat,
        lon: posicao.lon,
        origemPosicao: posicao.origem,
        // De QUAL local a posição foi herdada. Com a cadeia subindo, "do
        // local" deixou de ser suficiente na tela: o ativo está numa sala,
        // e a coordenada é do prédio — dizer o nome é a diferença entre
        // "herdada" e "herdada de onde".
        localPosicao: posicao.origem === 'herdada' ? local?.nome ?? null : null,
      }
      posicionados.push(posicionado)
      POSICIONADOS.push(posicionado)
    } else {
      // O alvo de posicionamento é o prédio, não a sala: é ele que a barra
      // lateral oferece, e é para ele que a contagem de "quantos ativos
      // este local acende" precisa rolar.
      const alvo = localPosicionavel(ativo?.local_id, locais)
      NAO_LOCALIZADOS.push({ ...comum, local_id: alvo?.id ?? ativo?.local_id ?? null })
    }
  }
  return posicionados
}

// ── Bloco 5 — escrita de zona (plano 10-06) ─────────────────────────
// salvarZona/atualizarZona são as duas únicas funções deste arquivo que
// gravam em maq_areas — e em nenhuma outra tabela (D-03: zona não entra em
// cmasm_locais). mapa/mapa-editor.js chama só estas duas; nenhuma operação
// de escrita mora lá.
//
// O que NÃO é portado: o padrão de gravação do editor legado
// (DEV_ERP/cmms-mapa/admin.html) fala com um backend Node próprio, com
// requisição a serviço em porta local, captura de exceção e aviso
// flutuante próprio (toast). Não existe backend aqui — o Supabase é o
// backend do projeto inteiro — e o idioma de erro é um só (CLAUDE.md §
// Conventions): desestruturar o erro, avisar com a mensagem, voltar.

// Confere os três atributos de terreno pela mesma lista fechada que o
// `check` da migração 25 grava no banco, antes de gastar uma viagem de
// rede — a barreira real é a do banco, esta é só a recusa antecipada
// (T-10-29), para o usuário ver o erro na hora em vez de um erro de
// restrição do Postgres.
function validarAtributosZona(zona) {
  if (zona?.flora != null && normalizarFlora(zona.flora) == null) {
    return `flora "${zona.flora}" fora da lista fechada`
  }
  if (zona?.inclinacao != null && normalizarInclinacao(zona.inclinacao) == null) {
    return `inclinação "${zona.inclinacao}" fora da lista fechada`
  }
  if (zona?.limpeza != null && normalizarLimpeza(zona.limpeza) == null) {
    return `limpeza "${zona.limpeza}" fora da lista fechada`
  }
  return null
}

// A área em metros quadrados nunca vem pronta da tela — é sempre
// recalculada aqui, na mesma chamada que grava a geometria, a partir da
// mesma lista de vértices, para os dois valores nunca ficarem fora de
// sincronia (T-10-30).
export async function salvarZona(zona) {
  const problema = validarAtributosZona(zona)
  if (problema) {
    alert('Erro: ' + problema)
    return null
  }
  const supa = obterCliente()
  const { data, error } = await supa
    .from('maq_areas')
    .insert({
      codigo: zona?.codigo || null,
      nome: zona?.nome,
      tipo: zona?.tipo,
      geom: zona?.geom,
      area_m2: calcAreaM2(zona?.geom),
      flora: zona?.flora ?? null,
      inclinacao: zona?.inclinacao ?? null,
      limpeza: zona?.limpeza ?? null,
    })
    .select()
    .single()
  if (error) {
    alert('Erro ao salvar zona: ' + error.message)
    return null
  }
  return data
}

export async function atualizarZona(id, zona) {
  const problema = validarAtributosZona(zona)
  if (problema) {
    alert('Erro: ' + problema)
    return null
  }
  const supa = obterCliente()
  const { data, error } = await supa
    .from('maq_areas')
    .update({
      nome: zona?.nome,
      tipo: zona?.tipo,
      geom: zona?.geom,
      area_m2: calcAreaM2(zona?.geom),
      flora: zona?.flora ?? null,
      inclinacao: zona?.inclinacao ?? null,
      limpeza: zona?.limpeza ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    alert('Erro ao atualizar zona: ' + error.message)
    return null
  }
  return data
}

// ── Bloco 6 — escrita de posição de ativo (plano 10-07, PLAT-20) ───────
// salvarPosicaoAtivo é a única função deste arquivo que grava lat/lon na
// tabela do PRÓPRIO ativo. Ela nunca escreve na tabela de locais: a
// coordenada de um local (cmasm_locais.lat/lon) é do prédio inteiro,
// compartilhada por todos os ativos ligados a ele — gravá-la a partir do
// arraste de UM ativo moveria todos os vizinhos junto, exatamente o modo
// de falha que a arquitetura de duas camadas do plano 10-01 existe para
// evitar (resolverPosicao: própria vence herdada, nunca o contrário).

// Cargos que podem posicionar ativo — DELIBERADAMENTE DIFERENTE de
// CARGOS_ZONA (mapa/mapa-editor.js, plano 10-06: admin+gestor, espelhando
// a política de maq_areas). As tabelas de ativo escritas aqui
// (supabase/01_maquinas_schema.sql linhas 97-101 — maq_ativos;
// supabase/14_eletrica_fonoclama_schema.sql linhas 166-170 — elet_ativos)
// escopam update a "authenticated" SEM distinção de cargo: o banco
// aceitaria qualquer sessão autenticada. A lista abaixo é mais estreita
// por decisão de produto — posicionamento é trabalho de campo, quem sabe
// onde a máquina está é quem a opera — registrada em
// 10-07-PLAN.md § "Decisão de planejamento registrada". O risco residual
// (a política do banco aceitando um cargo futuro que esta lista não
// inclui) é aceito e registrado no modelo de ameaças do plano (T-10-37):
// estreitar a policy exigiria remover e recriar restrição existente, fora
// do "aditivo apenas" que a fase respeita.
export const CARGOS_POSICAO = ['admin', 'gestor', 'tecnico']

export async function salvarPosicaoAtivo(modulo, id, lat, lon) {
  // Resolve a tabela pela mesma lista fechada de carregarAtivosDoModulo —
  // nome de tabela nunca é montado por concatenação de texto.
  const { tabela } = configDoModulo(modulo)
  // Identificador validado como inteiro estrito, mesmo critério que o lado
  // de destino do link já usa (maquinas/app.js#_abrirAtivoDaUrl, plano
  // 10-03) — Number.isSafeInteger, não um cast tolerante.
  if (!Number.isSafeInteger(id)) {
    alert('Erro: identificador de ativo inválido.')
    return null
  }
  // Validação de coordenada pelo núcleo puro, ANTES de qualquer viagem de
  // rede. Os mesmos quatro números estão no check da migração 25 — a
  // barreira real é a de lá; esta recusa existe só para o usuário ver uma
  // frase em português em vez de um erro de restrição do Postgres. O par
  // incompleto (só lat ou só lon) não pode acontecer por construção: as
  // duas coordenadas são gravadas juntas, abaixo, no mesmo comando — o que
  // a segunda restrição (num_nulls) da migração 25 protege.
  if (!dentroDoEnvelope(lat, lon)) {
    alert('Erro: a coordenada está fora da região do CMASM. Verifique o ponto marcado no mapa.')
    return null
  }
  const supa = obterCliente()
  const { data, error } = await supa
    .from(tabela)
    .update({ lat, lon })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    alert('Erro ao salvar posição: ' + error.message)
    return null
  }
  return data
}

// ── Bloco 7 — escrita de posição de LOCAL ──────────────────────────────
// A outra metade da arquitetura de duas camadas. salvarPosicaoAtivo (Bloco
// 6) grava a posição PRÓPRIA do ativo e por isso tem proibição explícita
// de tocar em cmasm_locais — mover um ativo não pode arrastar os vizinhos
// dele junto. Esta função é o caminho oposto e deliberado: quem chama
// sabe que está posicionando o PRÉDIO, e que todos os ativos ligados a ele
// sem posição própria passam a herdar essa coordenada (resolverPosicao:
// própria vence herdada, nunca o contrário). São as duas únicas portas de
// escrita de coordenada do módulo, uma por camada, cada uma numa tabela.
//
// Mesmo cargo do posicionamento de ativo (CARGOS_POSICAO, Bloco 6): a
// policy de cmasm_locais também escopa escrita a `authenticated`, e a
// lista da tela continua sendo mais estreita por decisão de produto, não
// espelho da policy. Mesmas três garantias que tests/mapa-posicionamento
// afirma sobre salvarPosicaoAtivo: identificador inteiro estrito,
// coordenada validada pelo núcleo puro ANTES da viagem de rede, e lat/lon
// no mesmo .update( — nunca em dois comandos, que deixariam meia
// coordenada gravada se o segundo falhasse.
export async function salvarPosicaoLocal(id, lat, lon) {
  if (!Number.isSafeInteger(id)) {
    alert('Erro: identificador de local inválido.')
    return null
  }
  if (!dentroDoEnvelope(lat, lon)) {
    alert('Erro: a coordenada está fora da região do CMASM. Verifique o ponto marcado no mapa.')
    return null
  }
  const supa = obterCliente()
  const { data, error } = await supa
    .from('cmasm_locais')
    .update({ lat, lon })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    alert('Erro ao salvar posição do prédio: ' + error.message)
    return null
  }
  return data
}

// ── Bloco 7 — contorno do prédio (migração 37) ─────────────────────────
// Terceira e última porta de escrita de geometria do módulo, e a segunda
// que toca `cmasm_locais` — nenhuma tabela de ativo aparece aqui, mesma
// separação de D-03 que salvarPosicaoAtivo/salvarPosicaoLocal já mantêm.
//
// `geom` e o centroide vão no MESMO `.update(`, nunca em dois comandos:
// um prédio com contorno e sem ponto pararia de acender os ativos que
// herdam posição dele (mapa-geometria.js#resolverPosicao lê o ponto, não
// o polígono), e essa metade gravada seria invisível na tela — o contorno
// apareceria, os ativos sumiriam.
//
// O centroide é calculado pelo núcleo puro e validado contra o envelope
// ANTES da viagem de rede, como as duas portas anteriores: o polígono
// inteiro pode estar fora da região do CMASM, e o `check` do banco só
// veria o par lat/lon.
export async function salvarGeomLocal(id, geom) {
  if (!Number.isSafeInteger(id)) {
    alert('Erro: identificador de local inválido.')
    return null
  }
  const centro = centroidePoligono(geom)
  if (!centro) {
    alert('Erro: o contorno precisa de pelo menos três vértices que formem uma área.')
    return null
  }
  const [lat, lon] = centro
  if (!dentroDoEnvelope(lat, lon)) {
    alert('Erro: o contorno está fora da região do CMASM. Verifique o polígono desenhado.')
    return null
  }
  const supa = obterCliente()
  const { data, error } = await supa
    .from('cmasm_locais')
    .update({ geom, lat, lon })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    alert('Erro ao salvar contorno do prédio: ' + error.message)
    return null
  }
  return data
}
