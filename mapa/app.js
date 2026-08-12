import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { aplicarShell } from '../shared/shell.js'
import { definirCliente } from './mapa-dados.js'
import { registrarCamadasGrama } from './xmap-layers-grama.js'
import { registrarCamadasEletrica } from './xmap-layers-eletrica.js'

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
