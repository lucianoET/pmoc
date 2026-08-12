import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { aplicarShell } from '../shared/shell.js'
import { definirCliente, NAO_LOCALIZADOS, CARGOS_POSICAO } from './mapa-dados.js'
import { registrarCamadasGrama } from './xmap-layers-grama.js'
import { registrarCamadasEletrica } from './xmap-layers-eletrica.js'
import { iniciarEditorZonas, iniciarEditorAtivos } from './mapa-editor.js'

// Rótulo de exibição por módulo de origem — o mesmo vocabulário fechado de
// mapa-dados.js#TABELA_POR_MODULO, só que para texto de tela, não nome de
// tabela.
const ORIGEM_LABEL = { maquinas: 'Máquinas', eletrica: 'Elétrica' }

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
    await Promise.all([registrarCamadasGrama(), registrarCamadasEletrica()])
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
    // Primeiro desenho da lista: registrarCamadasGrama/Eletrica (acima) já
    // rodaram posicionarAtivos e povoaram NAO_LOCALIZADOS antes deste ponto.
    renderNaoLocalizados()
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
  const rotulo = ativo.codigo || ativo.nome || `#${ativo.id}`
  const acao =
    podePosicionar && Number.isSafeInteger(ativo.id)
      ? `<button type="button" class="btn btn-s nl-btn" onclick="posSelecionarAtivo('${modulo}', ${ativo.id})">Posicionar</button>`
      : ''
  return `<div class="nl-item"><span>${esc(rotulo)}</span>${acao}</div>`
}

// ── módulos ──
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
