import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'

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
  } catch (error) {
    mostrarErroMapa(error)
  }
}

function mostrarErroMapa(error) {
  const el = document.getElementById('mapa')
  el.innerHTML = `<div class="callout co-red">Falha ao carregar o mapa. ${esc(error.message || String(error))}</div>`
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

  try {
    supa = await criarClienteSupabase()
  } catch (error) {
    mostrarErroBoot(error)
    return
  }

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
