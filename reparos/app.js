import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { aplicarShell } from '../shared/shell.js'
import { proximaOrdem, aplicarOrdemEFiltro } from '../shared/tabela.js'
import {
  COLUNAS_REPAROS, linhasReparos,
  COLUNAS_SERVICOS, linhasServicos,
  COLUNAS_MODELOS, linhasModelos,
} from './tabelas.js'

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

// id do registro em edição de cada um dos três modais de cadastro (D1,
// quick-260818-vtm) — nulo é "criando", preenchido é "editando". Cada
// abridor de modal atribui a partir do argumento recebido; fecharModal()
// zera, para que a próxima abertura pelo botão de criar não caia em update.
let REPARO_EDIT_ID = null
let SERVICO_EDIT_ID = null
let MODELO_EDIT_ID = null

// estado de tela de ordem e filtro por coluna (D2), três conjuntos
// independentes — um por aba, mesmo padrão de MAT_ORD/MAT_FILTROS em
// maquinas/app.js. Nenhuma consulta ao Supabase envolvida.
let TAB_REPAROS_ORD = { coluna: null, dir: null }
let TAB_REPAROS_FILTROS = {}
let TAB_REPAROS_FILTROS_ABERTO = false
let TAB_SERVICOS_ORD = { coluna: null, dir: null }
let TAB_SERVICOS_FILTROS = {}
let TAB_SERVICOS_FILTROS_ABERTO = false
let TAB_MODELOS_ORD = { coluna: null, dir: null }
let TAB_MODELOS_FILTROS = {}
let TAB_MODELOS_FILTROS_ABERTO = false

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

// ── TABELAS (D2/D3) ──
// as três seguem o mesmo par cabeçalho/corpo de renderMateriais() em
// maquinas/app.js: a função de entrada só delega; a de cabeçalho desenha o
// <thead> a partir da definição de colunas; a de corpo aplica ordem e
// filtro e escreve o <tbody>. Digitar num campo de filtro chama só a
// função de corpo — redesenhar o cabeçalho a cada tecla mataria o foco e o
// cursor do campo.
function renderReparos(){
  renderCabecalhoReparos()
  renderLinhasReparos()
}

function renderServicos(){
  renderCabecalhoServicos()
  renderLinhasServicos()
}

function renderModelos(){
  renderCabecalhoModelos()
  renderLinhasModelos()
}

// mapa de tabela → estado + definição de colunas + funções de render, para
// que os handlers de ordenar/filtrar sejam uma implementação só, que
// recebe qual tabela está operando (D2). Getters/setters porque o estado é
// `let` reatribuído a cada mudança, não mutado no lugar — mesma disciplina
// de MAT_ORD/MAT_FILTROS em maquinas/app.js.
function _estadoTabela(tabela){
  const mapa = {
    reparos: {
      colunas: COLUNAS_REPAROS,
      getOrd: () => TAB_REPAROS_ORD, setOrd: v => { TAB_REPAROS_ORD = v },
      getFiltros: () => TAB_REPAROS_FILTROS, setFiltros: v => { TAB_REPAROS_FILTROS = v },
      getAberto: () => TAB_REPAROS_FILTROS_ABERTO, setAberto: v => { TAB_REPAROS_FILTROS_ABERTO = v },
      render: renderReparos, renderCorpo: renderLinhasReparos,
    },
    servicos: {
      colunas: COLUNAS_SERVICOS,
      getOrd: () => TAB_SERVICOS_ORD, setOrd: v => { TAB_SERVICOS_ORD = v },
      getFiltros: () => TAB_SERVICOS_FILTROS, setFiltros: v => { TAB_SERVICOS_FILTROS = v },
      getAberto: () => TAB_SERVICOS_FILTROS_ABERTO, setAberto: v => { TAB_SERVICOS_FILTROS_ABERTO = v },
      render: renderServicos, renderCorpo: renderLinhasServicos,
    },
    modelos: {
      colunas: COLUNAS_MODELOS,
      getOrd: () => TAB_MODELOS_ORD, setOrd: v => { TAB_MODELOS_ORD = v },
      getFiltros: () => TAB_MODELOS_FILTROS, setFiltros: v => { TAB_MODELOS_FILTROS = v },
      getAberto: () => TAB_MODELOS_FILTROS_ABERTO, setAberto: v => { TAB_MODELOS_FILTROS_ABERTO = v },
      render: renderModelos, renderCorpo: renderLinhasModelos,
    },
  }
  return mapa[tabela]
}

// desenha o <thead> de uma das três tabelas a partir da definição de
// colunas — rótulo, botão de ordenação de três estados e ⌕ de filtro por
// coluna, mais a coluna final de ações sem rótulo e, com o filtro aberto,
// a linha de campos. Uma implementação só serve as três abas porque o
// único ponto que muda é qual definição de colunas e qual estado ela lê.
function _cabecalhoTabela(tabela, colunas, ord, filtros, aberto){
  const linhaRotulos = '<tr>' + colunas.map(col => {
    const dir = ord.coluna === col.id ? ord.dir : null
    const ariaSort = dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'
    const iconeOrdem = dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '⇅'
    const tituloOrdem = `Ordenar por ${col.rotulo}`
    const filtroAtivo = !!filtros[col.id]
    const tituloFiltro = `Filtrar por ${col.rotulo}`
    return `<th aria-sort="${ariaSort}">
      <span class="th-rotulo">
        ${esc(col.rotulo)}
        <button type="button" class="th-acao" onclick="ordenarTabelaReparos('${tabela}','${col.id}')" title="${tituloOrdem}" aria-label="${tituloOrdem}">${iconeOrdem}</button>
        <button type="button" class="th-acao${filtroAtivo?' ativo':''}" onclick="filtrarColunaTabelaReparos('${tabela}','${col.id}')" title="${tituloFiltro}" aria-label="${tituloFiltro}">⌕</button>
      </span>
    </th>`
  }).join('') + '<th></th></tr>'

  const linhaFiltros = aberto
    ? '<tr>' + colunas.map(col => `<th>
        <input type="search" id="filtro-${tabela}-${col.id}" value="${esc(filtros[col.id] || '')}"
          oninput="aplicarFiltroTabelaReparos('${tabela}','${col.id}', this.value)" placeholder="filtrar"/>
      </th>`).join('') + '<th></th></tr>'
    : ''

  return linhaRotulos + linhaFiltros
}

// mostra "N de total" e o botão de limpar só quando há ordem ou filtro
// ativos — mesma razão de atualizarContagemMateriais() em maquinas/app.js:
// sem isso a tela sempre mostraria "33 de 33", ruído no caso comum.
function _atualizarContagemTabela(tabela, visiveis, total){
  const t = _estadoTabela(tabela)
  const contagem = document.getElementById(`rep-contagem-${tabela}`)
  const btnLimpar = document.getElementById(`btn-limpar-${tabela}`)
  const ativo = t.getOrd().coluna !== null || Object.values(t.getFiltros()).some(Boolean)
  if(contagem) contagem.textContent = ativo ? `${visiveis} de ${total}` : ''
  if(btnLimpar) btnLimpar.style.display = ativo ? '' : 'none'
}

function renderCabecalhoReparos(){
  const thead = document.getElementById('th-reparos')
  if(!thead) return
  thead.innerHTML = _cabecalhoTabela('reparos', COLUNAS_REPAROS, TAB_REPAROS_ORD, TAB_REPAROS_FILTROS, TAB_REPAROS_FILTROS_ABERTO)
}

function renderLinhasReparos(){
  const tbody = document.getElementById('tb-reparos')
  if(!tbody) return

  if(!REPAROS.length){
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">Nenhum reparo cadastrado</td></tr>'
    _atualizarContagemTabela('reparos', 0, 0)
    return
  }

  const todas = linhasReparos(REPAROS, MODELOS, REP_MATS, REP_SERVS)
  const visiveis = aplicarOrdemEFiltro(todas, TAB_REPAROS_ORD, TAB_REPAROS_FILTROS, COLUNAS_REPAROS)

  if(!visiveis.length){
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">Nenhum reparo corresponde ao filtro</td></tr>'
    _atualizarContagemTabela('reparos', 0, todas.length)
    return
  }

  const badgeGrav = { alta:'b-red', media:'b-warn', baixa:'b-ok' }
  tbody.innerHTML = visiveis.map(l => {
    const r = l.registro
    return `<tr onclick="abrirModalVinculo(${r.id})">
      <td class="hi">${esc(l.codigo)}<div class="cel-sub">${l.modelo ? esc(l.modeloTexto) : 'qualquer modelo'}</div></td>
      <td>${esc(l.sintoma)}<div class="cel-sub">${esc(l.causaProvavel)}</div></td>
      <td><span class="badge b-blue">${esc(l.sistema)}</span> <span class="badge ${badgeGrav[l.gravidade] || 'b-blue'}">${esc(l.gravidade)}</span></td>
      <td>${l.confirmacoes}×</td>
      <td>${l.pecas} / ${l.servicos}</td>
      <td>${podeConhecimento()
        ? `<button class="btn btn-s btn-sm" onclick="event.stopPropagation();abrirModalReparo(${r.id})" title="Editar cadastro do reparo" aria-label="Editar cadastro do reparo">⚙</button>`
        : ''}</td>
    </tr>`
  }).join('')

  _atualizarContagemTabela('reparos', visiveis.length, todas.length)
}

function renderCabecalhoServicos(){
  const thead = document.getElementById('th-servicos')
  if(!thead) return
  thead.innerHTML = _cabecalhoTabela('servicos', COLUNAS_SERVICOS, TAB_SERVICOS_ORD, TAB_SERVICOS_FILTROS, TAB_SERVICOS_FILTROS_ABERTO)
}

function renderLinhasServicos(){
  const tbody = document.getElementById('tb-servicos')
  if(!tbody) return

  if(!SERVICOS.length){
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3)">Nenhum serviço cadastrado</td></tr>'
    _atualizarContagemTabela('servicos', 0, 0)
    return
  }

  const todas = linhasServicos(SERVICOS, REP_SERVS)
  const visiveis = aplicarOrdemEFiltro(todas, TAB_SERVICOS_ORD, TAB_SERVICOS_FILTROS, COLUNAS_SERVICOS)

  if(!visiveis.length){
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3)">Nenhum serviço corresponde ao filtro</td></tr>'
    _atualizarContagemTabela('servicos', 0, todas.length)
    return
  }

  tbody.innerHTML = visiveis.map(l => {
    const s = l.registro
    return `<tr>
      <td class="hi">${esc(l.codigo)}<div class="cel-sub">${esc(l.nome)}</div></td>
      <td>${esc(l.especialidade)}</td>
      <td>${l.tempoPadraoH ? fH(l.tempoPadraoH) : '—'}${l.valorHora ? ' · ' + fR(l.valorHora) : ''}</td>
      <td>${l.usos} reparo(s)</td>
      <td>${podeCatalogo()
        ? `<button class="btn btn-s btn-sm" onclick="abrirModalServico(${s.id})" title="Editar cadastro do serviço" aria-label="Editar cadastro do serviço">⚙</button>`
        : ''}</td>
    </tr>`
  }).join('')

  _atualizarContagemTabela('servicos', visiveis.length, todas.length)
}

function renderCabecalhoModelos(){
  const thead = document.getElementById('th-modelos')
  if(!thead) return
  thead.innerHTML = _cabecalhoTabela('modelos', COLUNAS_MODELOS, TAB_MODELOS_ORD, TAB_MODELOS_FILTROS, TAB_MODELOS_FILTROS_ABERTO)
}

function renderLinhasModelos(){
  const tbody = document.getElementById('tb-modelos')
  if(!tbody) return

  if(!MODELOS.length){
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3)">Nenhum modelo cadastrado</td></tr>'
    _atualizarContagemTabela('modelos', 0, 0)
    return
  }

  const todas = linhasModelos(MODELOS, ATIVOS, REPAROS)
  const visiveis = aplicarOrdemEFiltro(todas, TAB_MODELOS_ORD, TAB_MODELOS_FILTROS, COLUNAS_MODELOS)

  if(!visiveis.length){
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3)">Nenhum modelo corresponde ao filtro</td></tr>'
    _atualizarContagemTabela('modelos', 0, todas.length)
    return
  }

  tbody.innerHTML = visiveis.map(l => {
    const m = l.registro
    return `<tr>
      <td class="hi">${esc(l.codigo)}<div class="cel-sub">${esc(l.fabricanteModelo)}</div></td>
      <td>${esc(l.categoria)}</td>
      <td>${esc(l.motor)}</td>
      <td>${l.maquinas} máquinas / ${l.reparos} reparos</td>
      <td>${podeCatalogo()
        ? `<button class="btn btn-s btn-sm" onclick="abrirModalModelo(${m.id})" title="Editar cadastro do modelo" aria-label="Editar cadastro do modelo">⚙</button>`
        : ''}</td>
    </tr>`
  }).join('')

  _atualizarContagemTabela('modelos', visiveis.length, todas.length)
}

// ── ordenação e filtro por coluna (D2) — tudo de tela, nada de Supabase ──
// as quatro recebem qual tabela estão operando ('reparos'|'servicos'|
// 'modelos'), para que uma implementação só sirva as três abas.
function ordenarTabelaReparos(tabela, coluna){
  const t = _estadoTabela(tabela)
  const ordAtual = t.getOrd()
  const dirAtual = ordAtual.coluna === coluna ? ordAtual.dir : null
  const proximo = ordAtual.coluna === coluna ? proximaOrdem(dirAtual) : 'asc'
  t.setOrd(proximo === null ? { coluna: null, dir: null } : { coluna, dir: proximo })
  t.render()
}

function filtrarColunaTabelaReparos(tabela, coluna){
  const t = _estadoTabela(tabela)
  const aberto = !t.getAberto()
  // fechar limpa os filtros inteiros — um filtro invisível escondendo
  // linhas seria pior do que nenhum filtro (mesma regra de Máquinas)
  t.setAberto(aberto)
  if(!aberto) t.setFiltros({})
  t.render()
  if(aberto){
    const campo = document.getElementById(`filtro-${tabela}-${coluna}`)
    if(campo) campo.focus()
  }
}

function aplicarFiltroTabelaReparos(tabela, coluna, valor){
  const t = _estadoTabela(tabela)
  const filtros = t.getFiltros()
  if(valor){
    t.setFiltros({ ...filtros, [coluna]: valor })
  } else {
    const { [coluna]: _removido, ...resto } = filtros
    t.setFiltros(resto)
  }
  // só o corpo — reescrever o cabeçalho a cada tecla tiraria o foco e o
  // cursor do campo de busca
  t.renderCorpo()
}

function limparFiltrosTabelaReparos(tabela){
  const t = _estadoTabela(tabela)
  t.setFiltros({})
  t.setOrd({ coluna: null, dir: null })
  t.setAberto(false)
  t.render()
}

// ── MODAL REPARO ──
// id opcional (D1): com id, preenche os campos e o título de edição; sem
// id, limpa tudo e mostra o título de criação — o mesmo modal serve os dois
// casos, como já servia abrirModalMaterial() em maquinas/app.js.
function abrirModalReparo(id){
  REPARO_EDIT_ID = id || null
  const r = REPARO_EDIT_ID ? REPAROS.find(x => x.id === REPARO_EDIT_ID) : null

  document.getElementById('modal-reparo-titulo').textContent = r ? 'Editar reparo' : 'Novo reparo'
  document.getElementById('rp-codigo').value = r?.codigo || ''
  document.getElementById('rp-sintoma').value = r?.sintoma || ''
  document.getElementById('rp-causa').value = r?.causa_provavel || ''
  document.getElementById('rp-proc').value = r?.procedimento || ''
  document.getElementById('rp-gravidade').value = r?.gravidade || 'media'
  document.getElementById('rp-modelo').innerHTML = '<option value="">— qualquer modelo —</option>' +
    MODELOS.map(m => `<option value="${m.id}" ${m.id===r?.modelo_id?'selected':''}>${esc(m.fabricante)} ${esc(m.modelo)}</option>`).join('')
  document.getElementById('rp-sistema').innerHTML =
    SISTEMAS.map(s => `<option value="${s}" ${s===r?.sistema?'selected':''}>${s}</option>`).join('')
  document.getElementById('modal-reparo').classList.add('open')
}

async function salvarReparo(){
  // guarda de cargo (D1): a mesma que já esconde o botão "+ Reparo" em
  // aplicarPermissoes(), agora também no salvar — espelha a RLS real da
  // migração 26 (T-vtm-01), não afrouxa nem troca por um helper comum
  if(!podeConhecimento()){ alert('Seu cargo não altera o cadastro de reparos.'); return }

  const codigo = document.getElementById('rp-codigo').value.trim()
  const sintoma = document.getElementById('rp-sintoma').value.trim()
  const causa = document.getElementById('rp-causa').value.trim()
  if(!codigo || !sintoma || !causa){ alert('Preencha código, sintoma e causa provável.'); return }

  const campos = {
    codigo,
    modelo_id: parseInt(document.getElementById('rp-modelo').value) || null,
    sistema: document.getElementById('rp-sistema').value,
    sintoma, causa_provavel: causa,
    gravidade: document.getElementById('rp-gravidade').value,
    procedimento: document.getElementById('rp-proc').value.trim() || null,
  }
  const { error } = REPARO_EDIT_ID
    ? await supa.from('rep_reparos').update(campos).eq('id', REPARO_EDIT_ID)
    : await supa.from('rep_reparos').insert(campos)
  if(error){ alert('Erro: ' + error.message); return }
  fecharModal('modal-reparo')
  await carregarTudo()
}

// ── MODAL SERVIÇO ──
// id opcional (D1): mesmo padrão de abrirModalReparo().
function abrirModalServico(id){
  SERVICO_EDIT_ID = id || null
  const s = SERVICO_EDIT_ID ? SERVICOS.find(x => x.id === SERVICO_EDIT_ID) : null

  document.getElementById('modal-servico-titulo').textContent = s ? 'Editar serviço' : 'Novo serviço'
  document.getElementById('sv-codigo').value = s?.codigo || ''
  document.getElementById('sv-nome').value = s?.nome || ''
  document.getElementById('sv-tempo').value = s?.tempo_padrao_h ?? '0.5'
  document.getElementById('sv-valor').value = s?.valor_hora ?? ''
  document.getElementById('sv-esp').innerHTML = '<option value="">—</option>' +
    ESPECIALIDADES.map(e => `<option value="${e}" ${e===s?.especialidade?'selected':''}>${e}</option>`).join('')
  document.getElementById('modal-servico').classList.add('open')
}

async function salvarServico(){
  // guarda de cargo (D1): a mesma que já esconde o botão "+ Serviço" em
  // aplicarPermissoes() — espelha a RLS real da migração 26 (T-vtm-01)
  if(!podeCatalogo()){ alert('Seu cargo não altera o cadastro de serviços.'); return }

  const codigo = document.getElementById('sv-codigo').value.trim()
  const nome = document.getElementById('sv-nome').value.trim()
  if(!codigo || !nome){ alert('Preencha código e nome.'); return }

  const campos = {
    codigo, nome,
    especialidade: document.getElementById('sv-esp').value || null,
    tempo_padrao_h: parseFloat(document.getElementById('sv-tempo').value) || null,
    valor_hora: parseFloat(document.getElementById('sv-valor').value) || null,
  }
  const { error } = SERVICO_EDIT_ID
    ? await supa.from('rep_servicos').update(campos).eq('id', SERVICO_EDIT_ID)
    : await supa.from('rep_servicos').insert(campos)
  if(error){ alert('Erro: ' + error.message); return }
  fecharModal('modal-servico')
  await carregarTudo()
}

// ── MODAL MODELO ──
// id opcional (D1): mesmo padrão de abrirModalReparo().
function abrirModalModelo(id){
  MODELO_EDIT_ID = id || null
  const m = MODELO_EDIT_ID ? MODELOS.find(x => x.id === MODELO_EDIT_ID) : null

  document.getElementById('modal-modelo-titulo').textContent = m ? 'Editar modelo' : 'Novo modelo'
  document.getElementById('md-codigo').value = m?.codigo || ''
  document.getElementById('md-cat').value = m?.categoria || ''
  document.getElementById('md-fab').value = m?.fabricante || ''
  document.getElementById('md-mod').value = m?.modelo || ''
  document.getElementById('md-motor').value = m?.motor || ''
  document.getElementById('modal-modelo').classList.add('open')
}

async function salvarModelo(){
  // guarda de cargo (D1): a mesma que já esconde o botão "+ Modelo" em
  // aplicarPermissoes() — espelha a RLS real da migração 26 (T-vtm-01)
  if(!podeCatalogo()){ alert('Seu cargo não altera o cadastro de modelos.'); return }

  const fabricante = document.getElementById('md-fab').value.trim()
  const modelo = document.getElementById('md-mod').value.trim()
  if(!fabricante || !modelo){ alert('Preencha fabricante e modelo.'); return }

  const campos = {
    codigo: document.getElementById('md-codigo').value.trim() || null,
    fabricante, modelo,
    categoria: document.getElementById('md-cat').value.trim() || null,
    motor: document.getElementById('md-motor').value.trim() || null,
  }
  const { error } = MODELO_EDIT_ID
    ? await supa.from('rep_modelos').update(campos).eq('id', MODELO_EDIT_ID)
    : await supa.from('rep_modelos').insert(campos)
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

// zera o id de edição do modal fechado (D1) — a próxima abertura pelo botão
// de criar não pode cair no ramo de update de um registro antigo
function fecharModal(id){
  document.getElementById(id).classList.remove('open')
  if(id === 'modal-reparo') REPARO_EDIT_ID = null
  if(id === 'modal-servico') SERVICO_EDIT_ID = null
  if(id === 'modal-modelo') MODELO_EDIT_ID = null
}

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
    aplicarFiltroTabelaReparos,
    fecharModal,
    filtrarColunaTabelaReparos,
    limparFiltrosTabelaReparos,
    ordenarTabelaReparos,
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
