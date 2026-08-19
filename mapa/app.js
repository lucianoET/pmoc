import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { aplicarShell } from '../shared/shell.js'
import {
  definirCliente,
  NAO_LOCALIZADOS,
  POSICIONADOS,
  LOCAIS_SEM_POSICAO,
  CARGOS_POSICAO,
  carregarLocaisSemPosicao,
  carregarAreas,
} from './mapa-dados.js'
import { registrarCamadasGrama } from './xmap-layers-grama.js'
import { registrarCamadasEletrica } from './xmap-layers-eletrica.js'
import { registrarCamadaDeAtivos } from './xmap-layers-ativos.js'
import { registrarCamadaPredios } from './xmap-layers-predios.js'
import { iniciarEditorZonas, iniciarEditorAtivos } from './mapa-editor.js'
import { ESTADOS, corDoEstado } from './mapa-geometria.js'
import { CARGOS_ZONA } from './mapa-editor.js'

// Rótulo de exibição por módulo de origem — o mesmo vocabulário fechado de
// mapa-dados.js#CONFIG_POR_MODULO, só que para texto de tela, não nome de
// tabela.
const ORIGEM_LABEL = {
  maquinas: 'Máquinas',
  eletrica: 'Elétrica',
  transportes: 'Transportes',
  fonoclama: 'Fonoclama',
  climatizacao: 'Climatização',
}

// Módulos ligados no primeiro desenho. A aguada fica de FORA: ela é o
// único módulo que ainda exibe dado de demonstração (D-01), e abrir o mapa
// já mostrando dado falso junto do real é pior do que abrir sem ele.
// `predios` entra na lista: o contorno do prédio é o fundo em que todo o
// resto é lido — abrir o mapa com os marcadores flutuando sem as plantas
// é o que fazia a tela parecer vazia.
const MODULOS_INICIAIS = ['predios', 'grama', 'eletrica', 'transportes', 'fonoclama', 'climatizacao']

// Quantos itens a lista de prédios mostra antes de exigir o filtro. São
// centenas de locais; despejar todos na barra transforma a seção num
// rolamento infinito onde nada é encontrado.
const LIMITE_LISTA_LOCAIS = 25

// ── estado global ──
let supa = null
let auth = null
let USUARIO = null
const MODULOS_ATIVOS = new Set()
let MAPA_INICIALIZADO = false

function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[caractere])
}

// ── tela ──
function mostrarLogin() {
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('app').style.display = 'none'
}

function mostrarApp() {
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('app').style.display = 'flex'
  atualizarCabecalhoUsuario()
  // Antes de inicializarMapa() e fora do try dele de propósito: a barra de
  // módulos não depende do mapa, e se o mapa falhar ao subir ela precisa
  // continuar abrindo — senão a falha de um leva o outro junto.
  ligarBarraModulos()
  ligarDesenhoDeZona()
  inicializarMapa()
}

function atualizarCabecalhoUsuario() {
  const texto = USUARIO
    ? `${USUARIO.funcao || USUARIO.posto_graduacao || USUARIO.nome || 'Usuário'} · ${USUARIO.role}`
    : 'Livre · observador'
  document.getElementById('user-chip').textContent = texto
}

// ── mapa ──
function inicializarMapa() {
  if (MAPA_INICIALIZADO) return
  try {
    xMap.init('mapa', {
      modules: [],
      basemap: 'map',
      center: [-22.8400, -43.1055],
      zoom: 15,
      minZoom: 13,
      maxZoom: 19,
    })
    MAPA_INICIALIZADO = true
    ligarBuscaDeAtivo()
    ligarFiltroDeLocal()
    renderLegenda()
    registrarCamadasDoBanco()
  } catch (error) {
    mostrarErroMapa(error)
  }
}

// Registra as camadas que leem do Supabase (grama e elétrica — PLAT-17)
// depois de o mapa existir. A aguada continua se registrando sozinha por
// script clássico (D-01), sem passar por aqui. Falha de uma camada não
// derruba o boot inteiro: cada função de leitura já mostra o próprio erro
// visível (mapa/mapa-dados.js#mostrarErroDeCarga); este catch cobre só o
// caso de a própria chamada de registro lançar antes disso.
async function registrarCamadasDoBanco() {
  try {
    await Promise.all([
      registrarCamadasGrama(),
      registrarCamadasEletrica(),
      registrarCamadaDeAtivos('transportes'),
      registrarCamadaDeAtivos('fonoclama'),
      registrarCamadaDeAtivos('climatizacao'),
      registrarCamadaPredios(),
      // Fora do desenho do mapa, mas na mesma leva de leitura: a barra
      // lateral precisa das duas listas assim que a tela abre.
      carregarLocaisSemPosicao(),
    ])
    ligarCamadasIniciais()
    // Editor de zona (plano 10-06) — depois de o mapa existir e as camadas
    // estarem registradas, sobre a mesma instância que xMap já expõe
    // (nenhuma segunda instância de mapa é criada). Sai sem efeito se o
    // cargo da sessão não estiver na lista de escrita de maq_areas.
    iniciarEditorZonas(xMap.getLeafletMap(), USUARIO)
    // Modo de posicionamento de ativo (plano 10-07, PLAT-20) — mesma
    // instância de mapa, cargo próprio (CARGOS_POSICAO, deliberadamente
    // diferente do editor de zona). renderNaoLocalizados é o callback que
    // o editor chama depois de gravar uma posição, para a lista da barra
    // lateral sair de sincronia o mínimo possível.
    iniciarEditorAtivos(xMap.getLeafletMap(), USUARIO, renderNaoLocalizados)
    // Primeiro desenho das listas: as camadas acima já rodaram
    // posicionarAtivos e povoaram NAO_LOCALIZADOS/POSICIONADOS antes deste
    // ponto.
    renderNaoLocalizados()
    await renderZonasSemContorno()
  } catch (error) {
    mostrarErroMapa(error)
  }
}

function mostrarErroMapa(error) {
  const el = document.getElementById('mapa')
  el.innerHTML = `<div class="callout co-red">Falha ao carregar o mapa. ${esc(error.message || String(error))}</div>`
}

// ── painel de não localizados (plano 10-07, PLAT-20, critério de sucesso
// 4) ── Desenhado a partir de NAO_LOCALIZADOS (mapa/mapa-dados.js), a
// lista acumulada pelos planos 10-05/10-07: ativo sem posição nenhuma
// (nem própria, nem herdada do prédio) entra aqui em vez de desaparecer em
// silêncio. Estado vazio é explícito de propósito — uma seção que some não
// distingue "está tudo certo" de "quebrou".
function renderNaoLocalizados() {
  // A lista de prédios é redesenhada junto porque as duas medem a mesma
  // coisa por ângulos opostos: posicionar um prédio esvazia parte dos não
  // localizados, e posicionar um ativo tira uma unidade da contagem do
  // prédio dele.
  renderLocaisSemPosicao()
  const container = document.getElementById('nao-localizados')
  const titulo = document.getElementById('nao-localizados-titulo')
  if (!container) return
  const total = NAO_LOCALIZADOS.length
  if (titulo) titulo.textContent = total ? `Não localizados (${total})` : 'Não localizados'
  if (!total) {
    container.innerHTML = '<div class="nl-vazio">Todos os ativos carregados estão posicionados.</div>'
    return
  }
  // Ação de posicionar só aparece para quem o banco aceitaria — mesma
  // lista fechada que mapa-editor.js usa para sair sem efeito, importada
  // daqui, nunca redeclarada.
  const podePosicionar = CARGOS_POSICAO.includes(USUARIO?.role)
  const porModulo = {}
  for (const ativo of NAO_LOCALIZADOS) {
    const modulo = ativo.origemModulo || 'outro'
    ;(porModulo[modulo] ||= []).push(ativo)
  }
  container.innerHTML = Object.entries(porModulo)
    .map(([modulo, itens]) => `
      <div class="nl-modulo">
        <div class="nl-modulo-nome">${esc(ORIGEM_LABEL[modulo] || modulo)} (${itens.length})</div>
        ${itens.map(ativo => renderItemNaoLocalizado(modulo, ativo, podePosicionar)).join('')}
      </div>
    `)
    .join('')
}

// O onclick recebe só módulo (vocabulário fechado) e identificador
// numérico — nunca o nome do ativo. Passar texto livre por atributo
// onclick, mesmo escapado por esc(), decodificaria de volta a aspas
// dentro da string JS de aspas simples na hora de o navegador avaliar o
// atributo, abrindo caminho de quebra de string; mapa-editor.js busca o
// nome de novo em NAO_LOCALIZADOS pelo par módulo+id.
function renderItemNaoLocalizado(modulo, ativo, podePosicionar) {
  const rotulo = ativo.rotulo || `#${ativo.id}`
  const acao =
    podePosicionar && Number.isSafeInteger(ativo.id)
      ? `<button type="button" class="btn btn-s nl-btn" onclick="posSelecionarAtivo('${modulo}', ${ativo.id})">Posicionar</button>`
      : ''
  return `<div class="nl-item"><span>${esc(rotulo)}</span>${acao}</div>`
}

// ── prédios sem posição ────────────────────────────────────────────────
// A alavanca da arquitetura de duas camadas (mapa-geometria.js#resolverPosicao):
// posicionar UM prédio acende de uma vez todos os ativos ligados a ele por
// local_id. A contagem ao lado de cada prédio é exatamente esse número —
// quantos não localizados apontam para ele — e sai de NAO_LOCALIZADOS, sem
// consulta nova: um ativo só está naquela lista se não tem posição própria
// NEM herdada, então o prédio dele é justamente o que o acenderia.
function contagemPorLocal() {
  const contagem = new Map()
  for (const ativo of NAO_LOCALIZADOS) {
    if (ativo.local_id == null) continue
    contagem.set(ativo.local_id, (contagem.get(ativo.local_id) || 0) + 1)
  }
  return contagem
}

// Busca sem acento e sem caixa — o cadastro mistura "Fonoclama" e
// "FONOCLAMA", e ninguém digita acento numa caixa de filtro.
function normalizarBusca(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function renderLocaisSemPosicao() {
  const container = document.getElementById('locais-sem-posicao')
  const titulo = document.getElementById('locais-sem-posicao-titulo')
  if (!container) return
  const total = LOCAIS_SEM_POSICAO.length
  if (titulo) titulo.textContent = total ? `Prédios sem posição (${total})` : 'Prédios sem posição'
  if (!total) {
    container.innerHTML = '<div class="nl-vazio">Todos os prédios cadastrados têm coordenada.</div>'
    return
  }
  const filtro = normalizarBusca(document.getElementById('busca-local')?.value)
  const contagem = contagemPorLocal()
  const ordenados = LOCAIS_SEM_POSICAO.filter(
    (local) => !filtro || normalizarBusca(`${local.nome} ${local.codigo || ''}`).includes(filtro)
  )
    // Ordem por quantos ativos o prédio acenderia, do maior para o menor:
    // é a única ordem que responde "por onde começo" — alfabética
    // esconderia o galpão com trinta ativos atrás de uma guarita vazia.
    .sort((a, b) => (contagem.get(b.id) || 0) - (contagem.get(a.id) || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
  const podePosicionar = CARGOS_POSICAO.includes(USUARIO?.role)
  const mostrados = ordenados.slice(0, LIMITE_LISTA_LOCAIS)
  const sobrando = ordenados.length - mostrados.length
  container.innerHTML =
    (mostrados.length
      ? mostrados.map((local) => renderItemLocal(local, contagem.get(local.id) || 0, podePosicionar)).join('')
      : '<div class="nl-vazio">Nenhum prédio corresponde ao filtro.</div>') +
    // Truncar em silêncio faria a lista mentir sobre o próprio tamanho —
    // o resto é sempre anunciado, com o caminho para alcançá-lo.
    (sobrando > 0 ? `<div class="nl-vazio">+${sobrando} — refine o filtro para alcançar os demais.</div>` : '')
}

// Identificador de cmasm_locais é inteiro; o nome NUNCA entra no atributo
// onclick, mesma razão registrada em renderItemNaoLocalizado acima — o
// editor busca o nome de novo em LOCAIS_SEM_POSICAO pelo id.
function renderItemLocal(local, quantos, podePosicionar) {
  // Duas ações, a mesma tabela: "Ponto" marca o prédio com um clique —
  // rápido, quando o que importa é acender os ativos que herdam dele — e
  // "Contorno" desenha a planta dele, que é a forma que o prédio tem de
  // verdade. As duas gravam o ponto no fim (o contorno grava o centroide),
  // então nenhuma das duas deixa o prédio pela metade.
  const acao =
    podePosicionar && Number.isSafeInteger(local.id)
      ? `<button type="button" class="btn btn-s nl-btn" onclick="posSelecionarLocal(${local.id})">Ponto</button>` +
        `<button type="button" class="btn btn-s nl-btn" onclick="posDesenharPredio(${local.id})">Contorno</button>`
      : ''
  const contagem = quantos ? `<span class="nl-contagem">${quantos} ativo${quantos > 1 ? 's' : ''}</span>` : ''
  return `<div class="nl-item"><span>${esc(local.nome || local.codigo || `#${local.id}`)}</span>${contagem}${acao}</div>`
}

function ligarFiltroDeLocal() {
  document.getElementById('busca-local')?.addEventListener('input', renderLocaisSemPosicao)
}

// ── zonas sem contorno ─────────────────────────────────────────────────
// maq_areas aceita linha sem geometria, e o editor pula quem tem menos de
// três vértices — sem esta lista, uma zona cadastrada mas nunca desenhada
// fica invisível para sempre e desenhar "por cima" dela criaria uma
// segunda linha com o mesmo nome.
async function renderZonasSemContorno() {
  const container = document.getElementById('zonas-sem-contorno')
  const titulo = document.getElementById('zonas-sem-contorno-titulo')
  if (!container) return
  const zonas = (await carregarAreas()).filter((zona) => !Array.isArray(zona.geom) || zona.geom.length < 3)
  if (titulo) titulo.textContent = zonas.length ? `Zonas sem contorno (${zonas.length})` : 'Zonas sem contorno'
  if (!zonas.length) {
    container.innerHTML = '<div class="nl-vazio">Todas as zonas cadastradas têm contorno desenhado.</div>'
    return
  }
  const podeDesenhar = CARGOS_ZONA.includes(USUARIO?.role)
  container.innerHTML = zonas
    .map(
      (zona) => `<div class="nl-item"><span>${esc(zona.nome)}</span>${
        podeDesenhar ? `<button type="button" class="btn btn-s nl-btn" data-zona="${esc(zona.id)}">Desenhar</button>` : ''
      }</div>`
    )
    .join('')
}

// O identificador de zona é UUID, não inteiro — vai por atributo de dado e
// escuta delegada, nunca interpolado dentro da string JS de um onclick.
function ligarDesenhoDeZona() {
  document.getElementById('zonas-sem-contorno')?.addEventListener('click', (evento) => {
    const id = evento.target?.closest?.('button[data-zona]')?.dataset?.zona
    if (id && typeof window.edDesenharZona === 'function') window.edDesenharZona(id)
  })
}

// ── busca de ativo ─────────────────────────────────────────────────────
// Lê de POSICIONADOS (mapa-dados.js), não das camadas do Leaflet: procurar
// dentro do desenho amarraria a busca ao componente travado (mapa/xmap.js)
// e só encontraria o que a camada visível já mostra — a busca precisa
// achar o ativo mesmo com a camada dele desligada.
const LIMITE_RESULTADOS_BUSCA = 8

function ligarBuscaDeAtivo() {
  const campo = document.getElementById('busca-ativo')
  const caixa = document.getElementById('busca-resultados')
  if (!campo || !caixa) return
  campo.addEventListener('input', () => {
    const termo = normalizarBusca(campo.value)
    if (termo.length < 2) {
      caixa.innerHTML = ''
      return
    }
    const achados = POSICIONADOS.filter((a) =>
      normalizarBusca(`${a.rotulo} ${a.detalhe || ''} ${a.subtipo || ''}`).includes(termo)
    )
    if (!achados.length) {
      caixa.innerHTML = '<div class="nl-vazio">Nenhum ativo posicionado corresponde.</div>'
      return
    }
    caixa.innerHTML =
      achados
        .slice(0, LIMITE_RESULTADOS_BUSCA)
        .map(
          (a, i) =>
            `<div class="nl-item"><button type="button" class="nl-btn-link" data-achado="${i}">${esc(a.rotulo)}</button><span class="nl-contagem">${esc(ORIGEM_LABEL[a.origemModulo] || a.origemModulo)}</span></div>`
        )
        .join('') +
      (achados.length > LIMITE_RESULTADOS_BUSCA
        ? `<div class="nl-vazio">+${achados.length - LIMITE_RESULTADOS_BUSCA} — refine a busca.</div>`
        : '')
    caixa._achados = achados.slice(0, LIMITE_RESULTADOS_BUSCA)
  })
  caixa.addEventListener('click', (evento) => {
    const indice = evento.target?.closest?.('button[data-achado]')?.dataset?.achado
    if (indice == null) return
    const ativo = caixa._achados?.[Number(indice)]
    if (ativo) voarAte(ativo)
  })
}

// Voa até o ponto e marca com um círculo temporário. O marcador real é
// desenhado pela camada do módulo — este círculo só diz "é este aqui" e
// some sozinho, para não virar um segundo marcador permanente competindo
// com o da camada.
function voarAte(ativo) {
  const mapa = xMap.getLeafletMap()
  if (!mapa) return
  mapa.flyTo([ativo.lat, ativo.lon], 19, { duration: 0.6 })
  const halo = L.circleMarker([ativo.lat, ativo.lon], {
    radius: 22,
    color: corDoEstado(ativo.estado),
    weight: 3,
    fill: false,
  }).addTo(mapa)
  setTimeout(() => mapa.removeLayer(halo), 2500)
  _mostrarBarraModulos(false)
}

// ── legenda ────────────────────────────────────────────────────────────
// Desenhada a partir de ESTADOS (mapa/mapa-geometria.js) — a mesma lista
// fechada que pinta os marcadores. Escrever a legenda à mão criaria a
// sétima cópia da paleta, a única sem ninguém para corrigi-la quando uma
// cor mudasse.
function renderLegenda() {
  const container = document.getElementById('legenda-estados')
  if (!container) return
  container.innerHTML = Object.entries(ESTADOS)
    .map(
      ([chave, info]) =>
        `<div class="lg-item"><span class="lg-cor" style="background:${esc(info.cor)}"></span>${esc(info.rotulo)}</div>`
    )
    .join('')
}

// ── módulos ──
// Camadas ligadas no primeiro desenho, depois de registradas. Antes disso
// setModules não teria o que ligar: xMap.registerLayer é assíncrono no
// boot (as camadas esperam o banco), e um mapa que abre vazio até alguém
// achar a barra lateral parece um mapa quebrado.
function ligarCamadasIniciais() {
  for (const mod of MODULOS_INICIAIS) {
    MODULOS_ATIVOS.add(mod)
    document.querySelector(`.mod-btn[data-mod="${mod}"]`)?.classList.add('active')
  }
  xMap.setModules([...MODULOS_ATIVOS])
}

function alternarModulo(mod, btn) {
  if (MODULOS_ATIVOS.has(mod)) {
    MODULOS_ATIVOS.delete(mod)
    btn.classList.remove('active')
  } else {
    MODULOS_ATIVOS.add(mod)
    btn.classList.add('active')
  }
  xMap.setModules([...MODULOS_ATIVOS])
}

// ── barra de módulos retrátil ──
// A barra passa por cima do mapa em vez de disputar largura com ele. Em tela
// estreita ela consumia metade do espaço e o mapa virava uma tira.
function _barraModulos() {
  return document.getElementById('barra-modulos')
}

function _mostrarBarraModulos(abrir) {
  const barra = _barraModulos()
  const btn = document.getElementById('btn-modulos')
  if (!barra || !btn) return
  barra.classList.toggle('aberta', abrir)
  barra.setAttribute('aria-hidden', abrir ? 'false' : 'true')
  btn.setAttribute('aria-expanded', abrir ? 'true' : 'false')
}

function _barraEstaAberta() {
  return _barraModulos()?.classList.contains('aberta') === true
}

function ligarBarraModulos() {
  const barra = _barraModulos()
  const btn = document.getElementById('btn-modulos')
  if (!barra || !btn) return

  btn.addEventListener('click', evento => {
    evento.stopPropagation()
    _mostrarBarraModulos(!_barraEstaAberta())
  })

  // Clique fora fecha; clique dentro da própria barra, não — senão marcar um
  // módulo fecharia a barra antes de o usuário marcar o segundo.
  barra.addEventListener('click', evento => evento.stopPropagation())
  document.addEventListener('click', () => {
    if (_barraEstaAberta()) _mostrarBarraModulos(false)
  })
  document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && _barraEstaAberta()) _mostrarBarraModulos(false)
  })
}

// ── sessão ──
async function sair() {
  try {
    if (auth?.sair) await auth.sair()
  } finally {
    window.location.reload()
  }
}

// ── boot ──
function exporNoWindow() {
  window.alternarModulo = alternarModulo
  window.sair = sair
  // mapa/mapa-editor.js fecha a barra ao ligar um modo de edição — com ela
  // aberta, metade do mapa fica coberta justamente na hora de clicar nele.
  // Publicado aqui porque a barra é desta tela, não do editor.
  window.mapaFecharBarra = () => _mostrarBarraModulos(false)
}

function mostrarErroBoot(error) {
  document.getElementById('login-screen').innerHTML = `
    <div class="callout co-red" style="max-width:560px">
      <strong>Falha ao iniciar o módulo Mapa.</strong><br>
      ${esc(error.message || String(error))}
    </div>
  `
}

async function boot() {
  exporNoWindow()

  aplicarShell({
    nome: 'Mapa',
    accent: '#4aa0a0',
    versao: '0.1',
    navItems: [],
  })

  try {
    supa = await criarClienteSupabase()
  } catch (error) {
    mostrarErroBoot(error)
    return
  }
  definirCliente(supa)

  auth = new Auth(supa, { appNome: 'Mapa', appIcone: '🗺️' })
  auth.onLogin(usuario => {
    USUARIO = usuario
    mostrarApp()
  })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}

boot()
