import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { aplicarShell } from '../shared/shell.js'

// ══════════════════════════════════════════════════════════════════
// PMOC Reparos — catálogo de sintomas, causas, peças e serviços.
// Complementa Máquinas: lá o disparo é o horímetro (maq_planos),
// aqui é o sintoma. Consome maq_materiais em vez de duplicar o
// catálogo de peças, para não quebrar a baixa de estoque que já existe.
// ══════════════════════════════════════════════════════════════════

let supa = null
let auth = null

let MODELOS = [], SERVICOS = [], REPAROS = [], REP_SERVS = [], REP_MATS = []
let MATERIAIS = [], ATIVOS = []
let USUARIO = null
let VINCULO_REPARO_ID = null

const SISTEMAS = ['motor','combustivel','transmissao','corte','eletrico','hidraulico','estrutura']
const ESPECIALIDADES = ['mecanica','eletrica','solda','usinagem','pintura','hidraulica']

// espelha a RLS da migração 26: estrutura do catálogo é mais restrita que o
// conhecimento operacional. Checagem no cliente é UX — quem manda é o Postgres.
const CARGOS_CATALOGO = ['admin','gestor']
const CARGOS_CONHECIMENTO = ['admin','gestor','tecnico']

function esc(valor){
  return String(valor ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[c])
}

const fR = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')
const fH = v => Number(v || 0).toFixed(1).replace('.', ',') + ' h'

function podeCatalogo(){ return CARGOS_CATALOGO.includes(USUARIO?.role) }
function podeConhecimento(){ return CARGOS_CONHECIMENTO.includes(USUARIO?.role) }

async function sair(){
  await supa.auth.signOut()
  location.reload()
}

async function mostrarApp(){
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('app').style.display = 'block'
  atualizarCabecalhoUsuario()
  aplicarPermissoes()
  await carregarTudo()
}

function mostrarLogin(){
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('app').style.display = 'none'
}

function atualizarCabecalhoUsuario(){
  const chip = document.getElementById('user-chip')
  if(chip && USUARIO) chip.textContent = `${USUARIO.nome} · ${USUARIO.role}`
}

function aplicarPermissoes(){
  const cat = podeCatalogo(), con = podeConhecimento()
  for(const [id, ok] of [['btn-novo-modelo',cat],['btn-novo-servico',cat],['btn-novo-reparo',con]]){
    const btn = document.getElementById(id)
    if(btn) btn.style.display = ok ? '' : 'none'
  }
}

// O módulo não existe sem as tabelas rep_*. Em vez de repassar o erro cru do
// PostgREST num alert, diz o que falta e como resolver.
function catalogoAusente(erro){
  const msg = String(erro?.message || '')
  return /rep_(modelos|servicos|reparos|reparo_)/.test(msg) &&
         /could not find the table|does not exist|schema cache/i.test(msg)
}

function mostrarCatalogoAusente(){
  document.querySelector('#app .main').innerHTML = `
    <div class="callout co-red" style="max-width:680px">
      <strong>O catálogo de reparos ainda não existe neste banco.</strong><br><br>
      Rode as migrações <code>26_reparos_schema.sql</code> e <code>27_reparos_seed.sql</code>
      no SQL Editor do Supabase — ou, do repositório:<br><br>
      <code>uv run --with "psycopg[binary]" python supabase/aplicar.py 26_reparos_schema.sql 27_reparos_seed.sql</code>
      <br><br>Os outros módulos não são afetados: as migrações são aditivas.
    </div>`
}

// ── CARGA ──
async function carregarTudo(){
  const [md, sv, rp, rs, rm, mt, at] = await Promise.all([
    supa.from('rep_modelos').select('*').eq('ativo', true).order('fabricante'),
    supa.from('rep_servicos').select('*').eq('ativo', true).order('codigo'),
    supa.from('rep_reparos').select('*').eq('ativo', true).order('frequencia', { ascending:false }),
    supa.from('rep_reparo_servicos').select('*'),
    supa.from('rep_reparo_materiais').select('*'),
    supa.from('maq_materiais').select('*').order('codigo'),
    supa.from('maq_ativos').select('id,codigo,nome,modelo_id,tipo_modelo'),
  ])

  const erro = [md,sv,rp,rs,rm,mt,at].find(r => r.error)
  if(erro){
    // caso esperado enquanto a migração 26 não rodar: o PostgREST devolve
    // "Could not find the table", que não diz a ninguém o que fazer a respeito
    if(catalogoAusente(erro.error)){ mostrarCatalogoAusente(); return }
    alert('Erro ao carregar: ' + erro.error.message)
    return
  }

  MODELOS = md.data || []; SERVICOS = sv.data || []; REPAROS = rp.data || []
  REP_SERVS = rs.data || []; REP_MATS = rm.data || []
  MATERIAIS = mt.data || []; ATIVOS = at.data || []

  popularFiltros()
  renderDiagnostico()
  renderReparos()
  renderServicos()
  renderModelos()
}

function trocarView(id, btn){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.getElementById('view-' + id).classList.add('active')
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  if(btn) btn.classList.add('active')
}

// ── RESUMO DE UM REPARO — peças, serviços, custo, horas e falta de estoque ──
// Só peças essenciais entram no custo mínimo; as não essenciais ("verificar se
// precisa trocar") aparecem na lista mas não inflam a estimativa.
function resumoReparo(reparoId){
  const pecas = REP_MATS.filter(x => x.reparo_id === reparoId).map(x => {
    const mat = MATERIAIS.find(m => m.id === x.material_id)
    return { ...x, mat, falta: mat ? mat.estoque_atual < x.quantidade : false }
  })
  const servs = REP_SERVS.filter(x => x.reparo_id === reparoId).map(x => {
    const sv = SERVICOS.find(s => s.id === x.servico_id)
    return { ...x, sv }
  })
  const custo = pecas
    .filter(p => p.essencial && p.mat?.preco)
    .reduce((soma, p) => soma + Number(p.mat.preco) * Number(p.quantidade), 0)
  const horas = servs
    .reduce((soma, s) => soma + Number(s.sv?.tempo_padrao_h || 0) * Number(s.quantidade), 0)
  const faltando = pecas.filter(p => p.essencial && p.falta)
  return { pecas, servs, custo, horas, faltando }
}

function popularFiltros(){
  const md = document.getElementById('dg-modelo')
  const anteriorMd = md.value
  md.innerHTML = '<option value="">Todos os modelos</option>' +
    MODELOS.map(m => `<option value="${m.id}">${esc(m.fabricante)} ${esc(m.modelo)}</option>`).join('')
  md.value = anteriorMd

  const sis = document.getElementById('dg-sistema')
  const anteriorSis = sis.value
  sis.innerHTML = '<option value="">Todos os sistemas</option>' +
    SISTEMAS.map(s => `<option value="${s}">${s}</option>`).join('')
  sis.value = anteriorSis
}

function reparosFiltrados(){
  const modeloId = parseInt(document.getElementById('dg-modelo').value) || null
  const sistema = document.getElementById('dg-sistema').value
  const busca = document.getElementById('dg-busca').value.trim().toLowerCase()

  return REPAROS.filter(r => {
    // reparo sem modelo vale para qualquer um — nunca é filtrado fora
    if(modeloId && r.modelo_id && r.modelo_id !== modeloId) return false
    if(sistema && r.sistema !== sistema) return false
    if(busca && !`${r.sintoma} ${r.causa_provavel}`.toLowerCase().includes(busca)) return false
    return true
  })
}

// ── DIAGNÓSTICO ──
function renderDiagnostico(){
  const div = document.getElementById('dg-lista')
  const lista = reparosFiltrados()
  if(!lista.length){
    div.innerHTML = '<div class="empty"><div class="empty-ico">🔍</div>Nenhum reparo para este filtro.</div>'
    return
  }

  div.innerHTML = lista.map(r => {
    const { pecas, servs, custo, horas, faltando } = resumoReparo(r.id)
    const modelo = MODELOS.find(m => m.id === r.modelo_id)
    const alvo = modelo ? `${esc(modelo.fabricante)} ${esc(modelo.modelo)}` : 'qualquer modelo'

    const linhasPecas = pecas.length
      ? pecas.map(p => `<div class="diag-linha">
          ${p.essencial ? '' : '<span class="badge b-blue">opcional</span> '}
          ${esc(p.mat?.nome || '?')} — ${p.quantidade} ${esc(p.mat?.unidade || 'un')}
          ${p.falta ? '<span class="badge b-red">sem estoque</span>' : ''}
        </div>`).join('')
      : '<div class="diag-linha" style="color:var(--text3)">Sem peça vinculada</div>'

    const linhasServs = servs.length
      ? servs.map(s => `<div class="diag-linha">${esc(s.sv?.nome || '?')} — ${fH(s.sv?.tempo_padrao_h)}${s.quantidade > 1 ? ' ×' + s.quantidade : ''}</div>`).join('')
      : '<div class="diag-linha" style="color:var(--text3)">Sem serviço vinculado</div>'

    return `<div class="diag-card g-${esc(r.gravidade)}">
      <div class="diag-hd">
        <div>
          <div class="diag-sintoma">${esc(r.sintoma)}</div>
          <div class="diag-causa">${esc(r.causa_provavel)} · ${alvo} · ${esc(r.sistema)}</div>
        </div>
        <span class="badge ${r.frequencia > 0 ? 'b-ok' : 'b-blue'}">${r.frequencia > 0 ? 'confirmado ' + r.frequencia + '×' : 'nunca confirmado'}</span>
      </div>
      <div class="diag-metricas">
        <span>Peças <b>${fR(custo)}</b></span>
        <span>Mão de obra <b>${fH(horas)}</b></span>
        ${faltando.length ? `<span style="color:var(--red)">Faltam <b>${faltando.length}</b> peça(s) em estoque</span>` : ''}
      </div>
      <div class="diag-cols">
        <div class="diag-col"><strong style="font-size:11px;color:var(--text3)">PEÇAS</strong>${linhasPecas}</div>
        <div class="diag-col"><strong style="font-size:11px;color:var(--text3)">SERVIÇOS</strong>${linhasServs}</div>
      </div>
      ${r.procedimento ? `<div class="diag-linha" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">${esc(r.procedimento)}</div>` : ''}
    </div>`
  }).join('')
}

// ── TABELAS ──
function renderReparos(){
  const tbody = document.getElementById('tb-reparos')
  if(!REPAROS.length){
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">Nenhum reparo cadastrado</td></tr>'
    return
  }
  const badgeGrav = { alta:'b-red', media:'b-warn', baixa:'b-ok' }
  tbody.innerHTML = REPAROS.map(r => {
    const { pecas, servs } = resumoReparo(r.id)
    const modelo = MODELOS.find(m => m.id === r.modelo_id)
    return `<tr onclick="abrirModalVinculo(${r.id})">
      <td class="hi">${esc(r.codigo || '—')}</td>
      <td>${modelo ? esc(modelo.modelo) : '<span style="color:var(--text3)">qualquer</span>'}</td>
      <td>${esc(r.sistema)}</td>
      <td>${esc(r.sintoma)}</td>
      <td>${esc(r.causa_provavel)}</td>
      <td><span class="badge ${badgeGrav[r.gravidade] || 'b-blue'}">${esc(r.gravidade)}</span></td>
      <td>${r.frequencia}×</td>
      <td>${pecas.length} / ${servs.length}</td>
    </tr>`
  }).join('')
}

function renderServicos(){
  const tbody = document.getElementById('tb-servicos')
  if(!SERVICOS.length){
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">Nenhum serviço cadastrado</td></tr>'
    return
  }
  tbody.innerHTML = SERVICOS.map(s => {
    const usos = REP_SERVS.filter(x => x.servico_id === s.id).length
    return `<tr>
      <td class="hi">${esc(s.codigo || '—')}</td>
      <td>${esc(s.nome)}</td>
      <td>${esc(s.especialidade || '—')}</td>
      <td>${s.tempo_padrao_h ? fH(s.tempo_padrao_h) : '—'}</td>
      <td>${s.valor_hora ? fR(s.valor_hora) : '—'}</td>
      <td>${usos} reparo(s)</td>
    </tr>`
  }).join('')
}

function renderModelos(){
  const tbody = document.getElementById('tb-modelos')
  if(!MODELOS.length){
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">Nenhum modelo cadastrado</td></tr>'
    return
  }
  tbody.innerHTML = MODELOS.map(m => `<tr>
    <td class="hi">${esc(m.codigo || '—')}</td>
    <td>${esc(m.fabricante)}</td>
    <td>${esc(m.modelo)}</td>
    <td>${esc(m.categoria || '—')}</td>
    <td>${esc(m.motor || '—')}</td>
    <td>${ATIVOS.filter(a => a.modelo_id === m.id).length}</td>
    <td>${REPAROS.filter(r => r.modelo_id === m.id).length}</td>
  </tr>`).join('')
}

// ── MODAL REPARO ──
function abrirModalReparo(){
  document.getElementById('rp-codigo').value = ''
  document.getElementById('rp-sintoma').value = ''
  document.getElementById('rp-causa').value = ''
  document.getElementById('rp-proc').value = ''
  document.getElementById('rp-gravidade').value = 'media'
  document.getElementById('rp-modelo').innerHTML = '<option value="">— qualquer modelo —</option>' +
    MODELOS.map(m => `<option value="${m.id}">${esc(m.fabricante)} ${esc(m.modelo)}</option>`).join('')
  document.getElementById('rp-sistema').innerHTML =
    SISTEMAS.map(s => `<option value="${s}">${s}</option>`).join('')
  document.getElementById('modal-reparo').classList.add('open')
}

async function salvarReparo(){
  const codigo = document.getElementById('rp-codigo').value.trim()
  const sintoma = document.getElementById('rp-sintoma').value.trim()
  const causa = document.getElementById('rp-causa').value.trim()
  if(!codigo || !sintoma || !causa){ alert('Preencha código, sintoma e causa provável.'); return }

  const { error } = await supa.from('rep_reparos').insert({
    codigo,
    modelo_id: parseInt(document.getElementById('rp-modelo').value) || null,
    sistema: document.getElementById('rp-sistema').value,
    sintoma, causa_provavel: causa,
    gravidade: document.getElementById('rp-gravidade').value,
    procedimento: document.getElementById('rp-proc').value.trim() || null,
  })
  if(error){ alert('Erro: ' + error.message); return }
  fecharModal('modal-reparo')
  await carregarTudo()
}

// ── MODAL SERVIÇO ──
function abrirModalServico(){
  document.getElementById('sv-codigo').value = ''
  document.getElementById('sv-nome').value = ''
  document.getElementById('sv-tempo').value = '0.5'
  document.getElementById('sv-valor').value = ''
  document.getElementById('sv-esp').innerHTML = '<option value="">—</option>' +
    ESPECIALIDADES.map(e => `<option value="${e}">${e}</option>`).join('')
  document.getElementById('modal-servico').classList.add('open')
}

async function salvarServico(){
  const codigo = document.getElementById('sv-codigo').value.trim()
  const nome = document.getElementById('sv-nome').value.trim()
  if(!codigo || !nome){ alert('Preencha código e nome.'); return }

  const { error } = await supa.from('rep_servicos').insert({
    codigo, nome,
    especialidade: document.getElementById('sv-esp').value || null,
    tempo_padrao_h: parseFloat(document.getElementById('sv-tempo').value) || null,
    valor_hora: parseFloat(document.getElementById('sv-valor').value) || null,
  })
  if(error){ alert('Erro: ' + error.message); return }
  fecharModal('modal-servico')
  await carregarTudo()
}

// ── MODAL MODELO ──
function abrirModalModelo(){
  for(const id of ['md-codigo','md-cat','md-fab','md-mod','md-motor']){
    document.getElementById(id).value = ''
  }
  document.getElementById('modal-modelo').classList.add('open')
}

async function salvarModelo(){
  const fabricante = document.getElementById('md-fab').value.trim()
  const modelo = document.getElementById('md-mod').value.trim()
  if(!fabricante || !modelo){ alert('Preencha fabricante e modelo.'); return }

  const { error } = await supa.from('rep_modelos').insert({
    codigo: document.getElementById('md-codigo').value.trim() || null,
    fabricante, modelo,
    categoria: document.getElementById('md-cat').value.trim() || null,
    motor: document.getElementById('md-motor').value.trim() || null,
  })
  if(error){ alert('Erro: ' + error.message); return }
  fecharModal('modal-modelo')
  await carregarTudo()
}

// ── MODAL VÍNCULO ──
function abrirModalVinculo(reparoId){
  VINCULO_REPARO_ID = reparoId
  const r = REPAROS.find(x => x.id === reparoId)
  document.getElementById('modal-vinculo-titulo').textContent = `${r?.codigo || 'Reparo'} — ${r?.sintoma || ''}`
  document.getElementById('vc-qtd').value = '1'
  document.getElementById('vc-essencial').checked = true
  popularVinculoAlvo()
  renderVinculosAtuais()
  document.getElementById('modal-vinculo').classList.add('open')
}

function popularVinculoAlvo(){
  const tipo = document.getElementById('vc-tipo').value
  const sel = document.getElementById('vc-alvo')
  sel.innerHTML = tipo === 'material'
    ? MATERIAIS.map(m => `<option value="${m.id}">${esc(m.codigo || '')} ${esc(m.nome)}</option>`).join('')
    : SERVICOS.map(s => `<option value="${s.id}">${esc(s.codigo || '')} ${esc(s.nome)}</option>`).join('')
  document.getElementById('vc-essencial-wrap').style.display = tipo === 'material' ? '' : 'none'
}

function renderVinculosAtuais(){
  const { pecas, servs } = resumoReparo(VINCULO_REPARO_ID)
  const linha = (texto, tabela, id) => `<div class="diag-linha" style="display:flex;justify-content:space-between;align-items:center">
    <span>${texto}</span>
    <button class="btn btn-s btn-sm" onclick="removerVinculo('${tabela}',${id})">remover</button>
  </div>`
  document.getElementById('vc-atuais').innerHTML =
    `<strong style="font-size:11px;color:var(--text3)">PEÇAS</strong>` +
    (pecas.length ? pecas.map(p => linha(
      `${esc(p.mat?.nome || '?')} — ${p.quantidade} ${esc(p.mat?.unidade || 'un')}${p.essencial ? '' : ' (opcional)'}`,
      'rep_reparo_materiais', p.id)).join('') : '<div class="diag-linha" style="color:var(--text3)">—</div>') +
    `<strong style="font-size:11px;color:var(--text3);display:block;margin-top:10px">SERVIÇOS</strong>` +
    (servs.length ? servs.map(s => linha(
      `${esc(s.sv?.nome || '?')} — ${fH(s.sv?.tempo_padrao_h)}`,
      'rep_reparo_servicos', s.id)).join('') : '<div class="diag-linha" style="color:var(--text3)">—</div>')
}

async function salvarVinculo(){
  const tipo = document.getElementById('vc-tipo').value
  const alvo = parseInt(document.getElementById('vc-alvo').value)
  const qtd = parseFloat(document.getElementById('vc-qtd').value)
  if(!alvo || !(qtd > 0)){ alert('Escolha o item e informe uma quantidade maior que zero.'); return }

  const { error } = tipo === 'material'
    ? await supa.from('rep_reparo_materiais').insert({
        reparo_id: VINCULO_REPARO_ID, material_id: alvo, quantidade: qtd,
        essencial: document.getElementById('vc-essencial').checked,
      })
    : await supa.from('rep_reparo_servicos').insert({
        reparo_id: VINCULO_REPARO_ID, servico_id: alvo, quantidade: qtd,
      })

  if(error){ alert('Erro: ' + error.message); return }
  await carregarTudo()
  renderVinculosAtuais()
}

async function removerVinculo(tabela, id){
  const { error } = await supa.from(tabela).delete().eq('id', id)
  if(error){ alert('Erro: ' + error.message); return }
  await carregarTudo()
  renderVinculosAtuais()
}

function fecharModal(id){ document.getElementById(id).classList.remove('open') }

function fecharAoClicarFora(){
  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', evento => {
      if(evento.target === ov) ov.classList.remove('open')
    })
  })
}

// Handlers inline no markup exigem os nomes no window — o módulo é ES e não
// publica nada por padrão. Requisito estrutural, não boa prática opcional
// (mesma razão documentada em maquinas/app.js na Fase 05-06).
function exporNoWindow(){
  Object.assign(window, {
    abrirModalModelo,
    abrirModalReparo,
    abrirModalServico,
    abrirModalVinculo,
    fecharModal,
    popularVinculoAlvo,
    removerVinculo,
    renderDiagnostico,
    sair,
    salvarModelo,
    salvarReparo,
    salvarServico,
    salvarVinculo,
    trocarView,
  })
}

function mostrarErroBoot(error){
  document.getElementById('login-screen').innerHTML = `
    <div class="callout co-red" style="max-width:560px">
      <strong>Falha ao iniciar o módulo Reparos.</strong><br>
      ${esc(error.message || String(error))}
    </div>
  `
}

async function boot(){
  exporNoWindow()

  aplicarShell({
    nome: 'Reparos',
    accent: '#c96f4c',
    versao: '1.0',
    navItems: [
      { id: 'diagnostico', icone: '🔍', label: 'Diagnóstico', ativo: true },
      { id: 'reparos', icone: '🛠', label: 'Reparos' },
      { id: 'servicos', icone: '⏱', label: 'Serviços' },
      { id: 'modelos', icone: '🏷', label: 'Modelos' },
    ],
  })

  fecharAoClicarFora()

  try {
    supa = await criarClienteSupabase()
  } catch (error) {
    mostrarErroBoot(error)
    return
  }

  auth = new Auth(supa, { appNome: 'Reparos', appIcone: '🛠' })
  auth.onLogin(usuario => {
    USUARIO = usuario
    mostrarApp()
  })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}

boot()
