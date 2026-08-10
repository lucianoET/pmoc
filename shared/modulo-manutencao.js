// ══════════════════════════════════════════════════════════════════
// Motor comum dos módulos de manutenção por horímetro do PMOC.
//
// Cada módulo (elétrica, fonoclama, …) é só um arquivo de configuração
// que chama iniciarModulo({...}). O modelo de dados é sempre o mesmo,
// mudando apenas o prefixo das tabelas:
//   {p}_ativos  {p}_planos  {p}_materiais  {p}_plano_materiais
//   {p}_uso_registros  {p}_os  {p}_estoque_movimentos
//
// Os módulos em produção (refrigeração, máquinas, transportes) não usam
// este motor — continuam como estão.
// ══════════════════════════════════════════════════════════════════

import { Auth } from './auth.js'
import { criarClienteSupabase } from './supabase-config.js'
import { gravar } from './persistencia.js'
import { calcularOcorrencia } from './vencimento.js'

const ROLES_ESCRITA = ['admin', 'gestor', 'tecnico']

const STATUS_ATIVO = {
  operante: 'Operante',
  inoperante: 'Inoperante',
  manutencao: 'Em manutenção',
  baixado: 'Baixado',
}

const BADGE_ATIVO = {
  operante: 'b-ok',
  inoperante: 'b-red',
  manutencao: 'b-warn',
  baixado: 'b-blue',
}

const STATUS_OS = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const BADGE_OS = {
  pendente: 'b-blue',
  em_andamento: 'b-warn',
  concluida: 'b-ok',
  cancelada: 'b-red',
}

const VENCIMENTO = {
  vencida: { rotulo: 'Vencida', badge: 'b-red', peso: 0 },
  urgente: { rotulo: 'Urgente', badge: 'b-warn', peso: 1 },
  proxima: { rotulo: 'Próxima', badge: 'b-blue', peso: 2 },
  ok: { rotulo: 'Em dia', badge: 'b-ok', peso: 3 },
}

// ── estado do módulo ──
let CFG = null
let supa = null
let auth = null
let USUARIO = null

let ATIVOS = []
let PLANOS = []
let MATERIAIS = []
let PLANO_MATERIAIS = []
let OS_LIST = []
let USOS = []
let ERRO_CARGA = null

let ATIVO_EDIT_ID = null
let MATERIAL_EDIT_ID = null
let PLANO_EDIT_ID = null

// ── utilidades ──
function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[caractere])
}

const el = id => document.getElementById(id)
const val = id => (el(id)?.value ?? '').trim()
const num = id => {
  const bruto = val(id)
  return bruto === '' ? null : Number(bruto)
}
const hoje = () => new Date().toISOString().slice(0, 10)
const fmtNum = v => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const fmtMoeda = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const fmtData = iso => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '—')
const tabela = sufixo => `${CFG.prefixo}_${sufixo}`
const rotuloTipo = tipo => CFG.tipos[tipo]?.nome || tipo
const emojiTipo = tipo => CFG.tipos[tipo]?.emoji || '•'

function podeEscrever() {
  return ROLES_ESCRITA.includes(USUARIO?.role)
}

function exigirEscrita() {
  if (podeEscrever()) return true
  avisar('Seu cargo tem acesso somente de leitura.', 'erro')
  return false
}

let TOAST_TIMER = null

// Aviso curto no rodapé — dá retorno visível de que a gravação foi (ou não) feita.
function avisar(mensagem, tipo = 'ok') {
  let toast = el('toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'toast'
    document.body.appendChild(toast)
  }
  toast.className = `toast ${tipo}`
  toast.textContent = mensagem
  clearTimeout(TOAST_TIMER)
  TOAST_TIMER = setTimeout(() => toast.remove(), tipo === 'erro' ? 8000 : 3500)
}

/**
 * Executa uma escrita exigindo que ela tenha afetado alguma linha; recarrega e
 * avisa em caso de sucesso. Devolve as linhas gravadas, ou null se falhou.
 */
async function gravarERecarregar(consulta, acao, mensagemOk) {
  const { ok, dados, erro } = await gravar(consulta, acao)
  if (!ok) {
    avisar(erro, 'erro')
    return null
  }
  await recarregar()
  avisar(mensagemOk)
  return dados
}

// ── cálculo de vencimento por uso ──
// Espelha a regra do app legado: próxima ocorrência é o múltiplo do
// intervalo acima da última execução registrada.
function calcularVencimentos(ativo) {
  return PLANOS
    .filter(plano => plano.ativo && plano.tipo === ativo.tipo)
    .map(plano => {
      const ultimo = OS_LIST
        .filter(os => os.ativo_id === ativo.id && os.plano_id === plano.id && os.status === 'concluida')
        .reduce((maior, os) => Math.max(maior, Number(os.uso_na_os || 0)), 0)

      const ocorrencia = calcularOcorrencia(ultimo, Number(plano.intervalo), Number(ativo.uso_atual || 0))
      return { ativo, plano, ultimo, ...ocorrencia }
    })
    .sort((a, b) => VENCIMENTO[a.status].peso - VENCIMENTO[b.status].peso || a.falta - b.falta)
}

function todosVencimentos() {
  return ATIVOS
    .filter(ativo => ativo.ativo && ativo.status !== 'baixado')
    .flatMap(calcularVencimentos)
    .sort((a, b) => VENCIMENTO[a.status].peso - VENCIMENTO[b.status].peso || a.falta - b.falta)
}

function materiaisDoPlano(planoId) {
  return PLANO_MATERIAIS
    .filter(vinculo => vinculo.plano_id === planoId)
    .map(vinculo => ({
      vinculo,
      material: MATERIAIS.find(material => material.id === vinculo.material_id),
    }))
    .filter(item => item.material)
}

function materiaisEmFalta() {
  return MATERIAIS.filter(m => Number(m.estoque_atual) <= Number(m.estoque_minimo))
}

// ── carga de dados ──
async function carregarTudo() {
  ERRO_CARGA = null
  const [ativos, planos, materiais, planoMateriais, ordens, usos] = await Promise.all([
    supa.from(tabela('ativos')).select('*').order('codigo'),
    supa.from(tabela('planos')).select('*').order('tipo').order('ordem'),
    supa.from(tabela('materiais')).select('*').order('nome'),
    supa.from(tabela('plano_materiais')).select('*'),
    supa.from(tabela('os')).select('*').order('data_abertura', { ascending: false }),
    supa.from(tabela('uso_registros')).select('*').order('data', { ascending: false }).limit(200),
  ])

  const falha = [ativos, planos, materiais, planoMateriais, ordens, usos].find(r => r.error)
  if (falha) {
    ERRO_CARGA = falha.error.message
    return
  }

  ATIVOS = ativos.data || []
  PLANOS = planos.data || []
  MATERIAIS = materiais.data || []
  PLANO_MATERIAIS = planoMateriais.data || []
  OS_LIST = ordens.data || []
  USOS = usos.data || []
}

async function recarregar() {
  await carregarTudo()
  renderTudo()
}

// ── layout ──
function montarLayout() {
  document.title = `PMOC ${CFG.nome}`
  document.documentElement.style.setProperty('--accent', CFG.accent)

  el('app').innerHTML = `
    <div class="topbar">
      <div class="logo"><div class="logo-dot"></div> PMOC <span class="logo-accent">${esc(CFG.nome)}</span></div>
      <div class="topbar-right">
        <a class="topbar-back" href="/">← Portal</a>
        <span class="user-chip" id="user-chip">—</span>
        <button class="btn btn-s btn-sm" onclick="sair()">Sair</button>
      </div>
    </div>

    <div class="nav">
      <button class="nav-btn active" onclick="trocarView('painel',this)">📊 Painel</button>
      <button class="nav-btn" onclick="trocarView('ativos',this)">${CFG.icone} Ativos</button>
      <button class="nav-btn" onclick="trocarView('vencimentos',this)">⏱️ Vencimentos</button>
      <button class="nav-btn" onclick="trocarView('os',this)">🔧 Ordens de serviço</button>
      <button class="nav-btn" onclick="trocarView('planos',this)">📋 Planos</button>
      <button class="nav-btn" onclick="trocarView('estoque',this)">📦 Estoque</button>
    </div>

    <div class="main">
      <div id="alerta-carga"></div>
      <div class="view active" id="view-painel"></div>
      <div class="view" id="view-ativos"></div>
      <div class="view" id="view-vencimentos"></div>
      <div class="view" id="view-os"></div>
      <div class="view" id="view-planos"></div>
      <div class="view" id="view-estoque"></div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', montarModais())
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', evento => {
      if (evento.target === overlay) overlay.classList.remove('open')
    })
  })
}

function montarModais() {
  const opcoesTipo = Object.entries(CFG.tipos)
    .map(([chave, tipo]) => `<option value="${esc(chave)}">${esc(tipo.nome)}</option>`).join('')
  const opcoesStatus = Object.entries(STATUS_ATIVO)
    .map(([chave, rotulo]) => `<option value="${chave}">${rotulo}</option>`).join('')

  return `
  <div class="overlay" id="modal-ativo"><div class="modal">
    <div class="modal-hd"><h3 id="ativo-titulo">Novo ativo</h3><button class="btn btn-s btn-sm" onclick="fecharModal('ativo')">Fechar</button></div>
    <div class="modal-body">
      <div class="fgrid">
        <div class="frow"><label>Código *</label><input id="at-codigo"/></div>
        <div class="frow"><label>Nome *</label><input id="at-nome"/></div>
      </div>
      <div class="fgrid3">
        <div class="frow"><label>Tipo *</label><select id="at-tipo">${opcoesTipo}</select></div>
        <div class="frow"><label>Status</label><select id="at-status">${opcoesStatus}</select></div>
        <div class="frow"><label>Horímetro atual (${esc(CFG.unidadeUso)})</label><input id="at-uso" type="number" min="0" step="0.1"/></div>
      </div>
      <div class="fgrid">
        <div class="frow"><label>Patrimônio</label><input id="at-patrimonio"/></div>
        <div class="frow"><label>Local</label><input id="at-local"/></div>
      </div>
      <div class="frow"><label>Observações</label><textarea id="at-obs"></textarea></div>
    </div>
    <div class="modal-ft"><button class="btn btn-s" onclick="fecharModal('ativo')">Cancelar</button><button class="btn btn-p" onclick="salvarAtivo()">Salvar</button></div>
  </div></div>

  <div class="overlay" id="modal-uso"><div class="modal">
    <div class="modal-hd"><h3>Registrar uso</h3><button class="btn btn-s btn-sm" onclick="fecharModal('uso')">Fechar</button></div>
    <div class="modal-body">
      <div class="fgrid">
        <div class="frow"><label>Ativo *</label><select id="us-ativo"></select></div>
        <div class="frow"><label>Data</label><input id="us-data" type="date"/></div>
      </div>
      <div class="fgrid">
        <div class="frow"><label>Uso no período (${esc(CFG.unidadeUso)}) *</label><input id="us-delta" type="number" min="0.1" step="0.1"/></div>
        <div class="frow"><label>Operador</label><input id="us-operador"/></div>
      </div>
      <div class="frow"><label>Observações</label><textarea id="us-obs"></textarea></div>
      <div class="help" id="us-previsao"></div>
    </div>
    <div class="modal-ft"><button class="btn btn-s" onclick="fecharModal('uso')">Cancelar</button><button class="btn btn-p" onclick="salvarUso()">Salvar</button></div>
  </div></div>

  <div class="overlay" id="modal-os"><div class="modal">
    <div class="modal-hd"><h3>Ordem de serviço</h3><button class="btn btn-s btn-sm" onclick="fecharModal('os')">Fechar</button></div>
    <div class="modal-body">
      <div class="fgrid">
        <div class="frow"><label>Ativo *</label><select id="os-ativo" onchange="popularPlanosOS()"></select></div>
        <div class="frow"><label>Item do plano</label><select id="os-plano" onchange="mostrarPecasDoPlano()"></select></div>
      </div>
      <div class="fgrid3">
        <div class="frow"><label>Tipo</label><select id="os-tipo"><option value="preventiva">Preventiva</option><option value="corretiva">Corretiva</option><option value="inspecao">Inspeção</option></select></div>
        <div class="frow"><label>Status</label><select id="os-status"><option value="concluida">Concluída</option><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option></select></div>
        <div class="frow"><label>Horímetro na OS (${esc(CFG.unidadeUso)})</label><input id="os-uso" type="number" min="0" step="0.1"/></div>
      </div>
      <div class="frow"><label>Descrição *</label><textarea id="os-descricao"></textarea></div>
      <div class="fgrid">
        <div class="frow"><label>Técnico</label><input id="os-tecnico"/></div>
        <div class="frow"><label>Data</label><input id="os-data" type="date"/></div>
      </div>
      <div class="fgrid">
        <div class="frow"><label>Conformidade</label><select id="os-conforme"><option value="">Não avaliada</option><option value="sim">Conforme</option><option value="nao">Não conforme</option></select></div>
        <div class="frow"><label>Não conformidade</label><input id="os-nc"/></div>
      </div>
      <div class="frow"><label>Ação corretiva</label><textarea id="os-acao"></textarea></div>
      <div class="callout co-blue" id="os-pecas">Selecione um item do plano para ver as peças previstas.</div>
    </div>
    <div class="modal-ft"><button class="btn btn-s" onclick="fecharModal('os')">Cancelar</button><button class="btn btn-p" onclick="salvarOS()">Salvar</button></div>
  </div></div>

  <div class="overlay" id="modal-plano"><div class="modal">
    <div class="modal-hd"><h3 id="plano-titulo">Novo plano</h3><button class="btn btn-s btn-sm" onclick="fecharModal('plano')">Fechar</button></div>
    <div class="modal-body">
      <div class="fgrid">
        <div class="frow"><label>Código *</label><input id="pl-codigo"/></div>
        <div class="frow"><label>Tipo de ativo *</label><select id="pl-tipo">${opcoesTipo}</select></div>
      </div>
      <div class="frow"><label>Nome *</label><input id="pl-nome"/></div>
      <div class="fgrid3">
        <div class="frow"><label>Intervalo (${esc(CFG.unidadeUso)}) *</label><input id="pl-intervalo" type="number" min="1" step="1"/></div>
        <div class="frow"><label>Ordem</label><input id="pl-ordem" type="number" min="0" step="1"/></div>
        <div class="frow"><label>Norma de referência</label><input id="pl-norma"/></div>
      </div>
      <div class="frow"><label>Descrição</label><textarea id="pl-descricao"></textarea></div>
    </div>
    <div class="modal-ft"><button class="btn btn-s" onclick="fecharModal('plano')">Cancelar</button><button class="btn btn-p" onclick="salvarPlano()">Salvar</button></div>
  </div></div>

  <div class="overlay" id="modal-material"><div class="modal">
    <div class="modal-hd"><h3 id="material-titulo">Nova peça</h3><button class="btn btn-s btn-sm" onclick="fecharModal('material')">Fechar</button></div>
    <div class="modal-body">
      <div class="fgrid">
        <div class="frow"><label>Código *</label><input id="ma-codigo"/></div>
        <div class="frow"><label>Nome *</label><input id="ma-nome"/></div>
      </div>
      <div class="fgrid3">
        <div class="frow"><label>Categoria</label><input id="ma-categoria"/></div>
        <div class="frow"><label>Unidade</label><input id="ma-unidade" placeholder="UN"/></div>
        <div class="frow"><label>Preço unitário</label><input id="ma-preco" type="number" min="0" step="0.01"/></div>
      </div>
      <div class="fgrid">
        <div class="frow"><label>Estoque atual</label><input id="ma-atual" type="number" min="0" step="1"/></div>
        <div class="frow"><label>Estoque mínimo</label><input id="ma-minimo" type="number" min="0" step="1"/></div>
      </div>
      <div class="frow"><label>Observações</label><textarea id="ma-obs"></textarea></div>
    </div>
    <div class="modal-ft"><button class="btn btn-s" onclick="fecharModal('material')">Cancelar</button><button class="btn btn-p" onclick="salvarMaterial()">Salvar</button></div>
  </div></div>

  <div class="overlay" id="modal-movimento"><div class="modal">
    <div class="modal-hd"><h3>Movimentar estoque</h3><button class="btn btn-s btn-sm" onclick="fecharModal('movimento')">Fechar</button></div>
    <div class="modal-body">
      <div class="frow"><label>Peça *</label><select id="mv-material"></select></div>
      <div class="fgrid">
        <div class="frow"><label>Tipo</label><select id="mv-tipo"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div>
        <div class="frow"><label>Quantidade *</label><input id="mv-quantidade" type="number" min="0.01" step="1"/></div>
      </div>
      <div class="frow"><label>Motivo</label><input id="mv-motivo"/></div>
    </div>
    <div class="modal-ft"><button class="btn btn-s" onclick="fecharModal('movimento')">Cancelar</button><button class="btn btn-p" onclick="salvarMovimento()">Salvar</button></div>
  </div></div>
  `
}

// ── navegação ──
function trocarView(id, botao) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'))
  el(`view-${id}`).classList.add('active')
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'))
  if (botao) botao.classList.add('active')
}

function fecharModal(id) {
  el(`modal-${id}`).classList.remove('open')
}

function abrirModal(id) {
  el(`modal-${id}`).classList.add('open')
}

// ── render ──
// Cada painel é renderizado isolado: se um quebrar, os outros continuam
// atualizando em vez de a tela inteira congelar sem explicação.
function renderTudo() {
  const falhas = []

  for (const [nome, render] of [
    ['Painel', renderPainel],
    ['Ativos', renderAtivos],
    ['Vencimentos', renderVencimentos],
    ['OS', renderOS],
    ['Planos', renderPlanos],
    ['Estoque', renderEstoque],
  ]) {
    try {
      render()
    } catch (error) {
      console.error(`Falha ao renderizar ${nome}:`, error)
      falhas.push(`${nome}: ${error.message}`)
    }
  }

  const avisos = []
  if (ERRO_CARGA) avisos.push(`<div class="callout co-red"><strong>Falha ao carregar dados.</strong> ${esc(ERRO_CARGA)}</div>`)
  if (falhas.length) avisos.push(`<div class="callout co-red"><strong>Falha ao desenhar a tela.</strong> ${esc(falhas.join(' · '))}</div>`)
  el('alerta-carga').innerHTML = avisos.join('')
}

function botaoEscrita(rotulo, acao, classe = 'btn-p') {
  const desabilitado = podeEscrever() ? '' : 'disabled'
  return `<button class="btn ${classe} btn-sm" onclick="${acao}" ${desabilitado}>${rotulo}</button>`
}

function renderPainel() {
  const operantes = ATIVOS.filter(a => a.ativo && a.status === 'operante').length
  const emManutencao = ATIVOS.filter(a => a.ativo && a.status === 'manutencao').length
  const vencimentos = todosVencimentos()
  const vencidas = vencimentos.filter(v => v.status === 'vencida').length
  const urgentes = vencimentos.filter(v => v.status === 'urgente').length
  const faltando = materiaisEmFalta()

  const porTipo = Object.keys(CFG.tipos).map(tipo => {
    const doTipo = ATIVOS.filter(a => a.ativo && a.tipo === tipo)
    const pendentes = vencimentos.filter(v => v.ativo.tipo === tipo && (v.status === 'vencida' || v.status === 'urgente')).length
    return { tipo, total: doTipo.length, pendentes }
  }).filter(linha => linha.total > 0)

  el('view-painel').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Painel</div><div class="view-sub">${esc(CFG.descricao)}</div></div>
      <div class="section-row">
        ${botaoEscrita('⏱️ Registrar uso', 'abrirModalUso()', 'btn-s')}
        ${botaoEscrita('🔧 Nova OS', 'abrirModalOS()')}
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi kc-accent"><div class="kpi-n">${ATIVOS.filter(a => a.ativo).length}</div><div class="kpi-l">Ativos cadastrados</div></div>
      <div class="kpi kc-ok"><div class="kpi-n">${operantes}</div><div class="kpi-l">Operantes</div></div>
      <div class="kpi kc-warn"><div class="kpi-n">${emManutencao}</div><div class="kpi-l">Em manutenção</div></div>
      <div class="kpi kc-red"><div class="kpi-n">${vencidas}</div><div class="kpi-l">Manutenções vencidas</div></div>
      <div class="kpi kc-warn"><div class="kpi-n">${urgentes}</div><div class="kpi-l">Urgentes</div></div>
      <div class="kpi kc-blue"><div class="kpi-n">${faltando.length}</div><div class="kpi-l">Peças no mínimo</div></div>
    </div>

    <div class="section-split">
      <div class="panel-card">
        <h3>Próximas manutenções</h3>
        ${listaVencimentos(vencimentos.slice(0, 12))}
      </div>
      <div class="stack">
        <div class="panel-card">
          <h3>Ativos por tipo</h3>
          <div class="stack">
            ${porTipo.map(linha => `
              <div class="mat-alert">
                <div class="mat-info">
                  <div class="mat-nome">${emojiTipo(linha.tipo)} ${esc(rotuloTipo(linha.tipo))}</div>
                  <div class="mat-stock">${linha.total} ativo(s)</div>
                </div>
                <span class="badge ${linha.pendentes ? 'b-warn' : 'b-ok'}">${linha.pendentes ? `${linha.pendentes} pendente(s)` : 'em dia'}</span>
              </div>
            `).join('') || '<div class="tagline">Nenhum ativo cadastrado.</div>'}
          </div>
        </div>
        <div class="panel-card">
          <h3>Estoque no mínimo</h3>
          <div class="stack">
            ${faltando.slice(0, 8).map(material => `
              <div class="mat-alert">
                <div class="mat-info">
                  <div class="mat-nome">${esc(material.nome)}</div>
                  <div class="mat-stock">${fmtNum(material.estoque_atual)} / mín. ${fmtNum(material.estoque_minimo)} ${esc(material.unidade)}</div>
                </div>
                <span class="badge b-red">repor</span>
              </div>
            `).join('') || '<div class="tagline">Estoque em dia.</div>'}
          </div>
        </div>
      </div>
    </div>
  `
}

function listaVencimentos(itens) {
  if (!itens.length) return '<div class="tagline">Nada programado — registre uso ou cadastre planos.</div>'
  return `<div class="stack">${itens.map(item => `
    <div class="mat-alert">
      <div class="mat-info">
        <div class="mat-nome">${esc(item.ativo.codigo)} · ${esc(item.plano.nome)}</div>
        <div class="mat-stock">${item.falta <= 0 ? `${fmtNum(Math.abs(item.falta))} ${CFG.unidadeUso} em atraso` : `faltam ${fmtNum(item.falta)} ${CFG.unidadeUso}`} · próxima em ${fmtNum(item.proximo)} ${CFG.unidadeUso}</div>
      </div>
      <span class="badge ${VENCIMENTO[item.status].badge}">${VENCIMENTO[item.status].rotulo}</span>
    </div>
  `).join('')}</div>`
}

function renderAtivos() {
  const linhas = ATIVOS.filter(ativo => ativo.ativo).map(ativo => {
    const pendentes = calcularVencimentos(ativo).filter(v => v.status === 'vencida' || v.status === 'urgente').length
    return `
      <tr>
        <td class="hi">${esc(ativo.codigo)}</td>
        <td>${emojiTipo(ativo.tipo)} ${esc(rotuloTipo(ativo.tipo))}</td>
        <td>${esc(ativo.local || '—')}</td>
        <td class="num">${fmtNum(ativo.uso_atual)} ${esc(ativo.unidade_uso)}</td>
        <td><span class="badge ${BADGE_ATIVO[ativo.status]}">${STATUS_ATIVO[ativo.status]}</span></td>
        <td>${pendentes ? `<span class="badge b-warn">${pendentes}</span>` : '<span class="badge b-ok">0</span>'}</td>
        <td>${botaoEscrita('Editar', `abrirModalAtivo(${ativo.id})`, 'btn-s')}</td>
      </tr>`
  }).join('')

  el('view-ativos').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Ativos</div><div class="view-sub">${ATIVOS.filter(a => a.ativo).length} ativo(s) sob manutenção</div></div>
      ${botaoEscrita('+ Novo ativo', 'abrirModalAtivo()')}
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Código</th><th>Tipo</th><th>Local</th><th>Horímetro</th><th>Status</th><th>Pendências</th><th></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="7"><div class="empty"><div class="empty-ico">📭</div>Nenhum ativo cadastrado.</div></td></tr>'}</tbody>
    </table></div>
  `
}

function renderVencimentos() {
  const itens = todosVencimentos()
  const linhas = itens.map(item => `
    <tr>
      <td class="hi">${esc(item.ativo.codigo)}</td>
      <td>${esc(item.plano.nome)}</td>
      <td class="num">${fmtNum(item.plano.intervalo)} ${esc(item.plano.unidade)}</td>
      <td class="num">${item.ultimo ? fmtNum(item.ultimo) : '—'}</td>
      <td class="num">${fmtNum(item.proximo)}</td>
      <td class="num">${fmtNum(item.falta)}</td>
      <td><span class="badge ${VENCIMENTO[item.status].badge}">${VENCIMENTO[item.status].rotulo}</span></td>
      <td>${botaoEscrita('Abrir OS', `abrirModalOS(${item.ativo.id}, ${item.plano.id})`, 'btn-s')}</td>
    </tr>
  `).join('')

  el('view-vencimentos').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Vencimentos</div><div class="view-sub">Calculado pelo horímetro de cada ativo contra o intervalo do plano</div></div>
      <button class="btn btn-s btn-sm" onclick="exportarVencimentosCsv()">⬇ CSV</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Ativo</th><th>Plano</th><th>Intervalo</th><th>Última</th><th>Próxima</th><th>Falta</th><th>Situação</th><th></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="8"><div class="empty"><div class="empty-ico">✅</div>Nenhum plano aplicável aos ativos cadastrados.</div></td></tr>'}</tbody>
    </table></div>
  `
}

function renderOS() {
  const linhas = OS_LIST.map(os => {
    const ativo = ATIVOS.find(a => a.id === os.ativo_id)
    const plano = PLANOS.find(p => p.id === os.plano_id)
    const acao = os.status === 'concluida' || os.status === 'cancelada'
      ? ''
      : botaoEscrita('Concluir', `concluirOS('${os.id}')`, 'btn-s')
    return `
      <tr>
        <td class="hi">${fmtData(os.data_abertura)}</td>
        <td>${esc(ativo?.codigo || '—')}</td>
        <td>${esc(plano?.nome || os.tipo)}</td>
        <td>${esc(os.descricao)}</td>
        <td>${esc(os.tecnico || '—')}</td>
        <td class="num">${os.uso_na_os != null ? fmtNum(os.uso_na_os) : '—'}</td>
        <td class="num">${fmtMoeda(os.custo_pecas)}</td>
        <td><span class="badge ${BADGE_OS[os.status]}">${STATUS_OS[os.status]}</span></td>
        <td>${acao}</td>
      </tr>`
  }).join('')

  el('view-os').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Ordens de serviço</div><div class="view-sub">${OS_LIST.length} registro(s) · concluir uma OS dá baixa nas peças do plano</div></div>
      ${botaoEscrita('+ Nova OS', 'abrirModalOS()')}
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Data</th><th>Ativo</th><th>Plano / tipo</th><th>Descrição</th><th>Técnico</th><th>Horímetro</th><th>Peças</th><th>Status</th><th></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="9"><div class="empty"><div class="empty-ico">🔧</div>Nenhuma OS registrada.</div></td></tr>'}</tbody>
    </table></div>
  `
}

function renderPlanos() {
  const linhas = PLANOS.map(plano => {
    const pecas = materiaisDoPlano(plano.id)
      .map(item => `${esc(item.material.nome)} (${fmtNum(item.vinculo.quantidade)})`).join(', ')
    return `
      <tr>
        <td class="hi">${esc(plano.codigo)}</td>
        <td>${emojiTipo(plano.tipo)} ${esc(rotuloTipo(plano.tipo))}</td>
        <td>${esc(plano.nome)}</td>
        <td class="num">${fmtNum(plano.intervalo)} ${esc(plano.unidade)}</td>
        <td>${pecas || '—'}</td>
        <td>${botaoEscrita('Editar', `abrirModalPlano(${plano.id})`, 'btn-s')}</td>
      </tr>`
  }).join('')

  el('view-planos').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Planos de manutenção</div><div class="view-sub">Um plano vale para todos os ativos do mesmo tipo</div></div>
      ${botaoEscrita('+ Novo plano', 'abrirModalPlano()')}
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Código</th><th>Tipo</th><th>Plano</th><th>Intervalo</th><th>Peças previstas</th><th></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="6"><div class="empty"><div class="empty-ico">📋</div>Nenhum plano cadastrado.</div></td></tr>'}</tbody>
    </table></div>
  `
}

function renderEstoque() {
  const linhas = MATERIAIS.map(material => {
    const baixo = Number(material.estoque_atual) <= Number(material.estoque_minimo)
    return `
      <tr>
        <td class="hi">${esc(material.codigo)}</td>
        <td>${esc(material.nome)}</td>
        <td>${esc(material.categoria || '—')}</td>
        <td class="num">${fmtNum(material.estoque_atual)} ${esc(material.unidade)}</td>
        <td class="num">${fmtNum(material.estoque_minimo)}</td>
        <td class="num">${fmtMoeda(material.preco)}</td>
        <td><span class="badge ${baixo ? 'b-red' : 'b-ok'}">${baixo ? 'repor' : 'ok'}</span></td>
        <td>${botaoEscrita('Editar', `abrirModalMaterial(${material.id})`, 'btn-s')}</td>
      </tr>`
  }).join('')

  const faltando = materiaisEmFalta()
  const custoReposicao = faltando.reduce((total, material) => {
    const falta = Math.max(0, Number(material.estoque_minimo) - Number(material.estoque_atual))
    return total + falta * Number(material.preco || 0)
  }, 0)

  el('view-estoque').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Estoque</div><div class="view-sub">${MATERIAIS.length} item(ns) · ${faltando.length} no mínimo · reposição estimada ${fmtMoeda(custoReposicao)}</div></div>
      <div class="section-row">
        <button class="btn btn-s btn-sm" onclick="exportarComprasCsv()">⬇ Lista de compras</button>
        ${botaoEscrita('Movimentar', 'abrirModalMovimento()', 'btn-s')}
        ${botaoEscrita('+ Nova peça', 'abrirModalMaterial()')}
      </div>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Código</th><th>Peça</th><th>Categoria</th><th>Atual</th><th>Mínimo</th><th>Preço</th><th>Situação</th><th></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="8"><div class="empty"><div class="empty-ico">📦</div>Nenhuma peça cadastrada.</div></td></tr>'}</tbody>
    </table></div>
  `
}

// ── modais: ativo ──
function abrirModalAtivo(id = null) {
  if (!exigirEscrita()) return
  ATIVO_EDIT_ID = id
  const ativo = ATIVOS.find(a => a.id === id)
  el('ativo-titulo').textContent = ativo ? `Editar ${ativo.codigo}` : 'Novo ativo'
  el('at-codigo').value = ativo?.codigo || ''
  el('at-nome').value = ativo?.nome || ''
  el('at-tipo').value = ativo?.tipo || Object.keys(CFG.tipos)[0]
  el('at-status').value = ativo?.status || 'operante'
  el('at-uso').value = ativo?.uso_atual ?? 0
  el('at-patrimonio').value = ativo?.patrimonio || ''
  el('at-local').value = ativo?.local || ''
  el('at-obs').value = ativo?.obs || ''
  abrirModal('ativo')
}

async function salvarAtivo() {
  if (!exigirEscrita()) return
  const registro = {
    codigo: val('at-codigo'),
    nome: val('at-nome'),
    tipo: val('at-tipo'),
    status: val('at-status'),
    uso_atual: num('at-uso') ?? 0,
    unidade_uso: CFG.unidadeUso,
    patrimonio: val('at-patrimonio') || null,
    local: val('at-local') || null,
    obs: val('at-obs') || null,
  }
  if (!registro.codigo || !registro.nome) return alert('Código e nome são obrigatórios.')

  const consulta = ATIVO_EDIT_ID
    ? supa.from(tabela('ativos')).update(registro).eq('id', ATIVO_EDIT_ID)
    : supa.from(tabela('ativos')).insert(registro)

  const salvo = await gravarERecarregar(
    consulta,
    ATIVO_EDIT_ID ? 'salvar o ativo' : 'criar o ativo',
    `Ativo ${registro.codigo} ${ATIVO_EDIT_ID ? 'atualizado' : 'criado'}.`,
  )
  if (salvo) fecharModal('ativo')
}

// ── modais: uso ──
function abrirModalUso() {
  if (!exigirEscrita()) return
  el('us-ativo').innerHTML = ATIVOS.filter(a => a.ativo)
    .map(a => `<option value="${a.id}">${esc(a.codigo)} — ${esc(a.nome)} (${fmtNum(a.uso_atual)} ${esc(a.unidade_uso)})</option>`).join('')
  el('us-data').value = hoje()
  el('us-delta').value = ''
  el('us-operador').value = ''
  el('us-obs').value = ''
  el('us-previsao').textContent = ''
  abrirModal('uso')
}

async function salvarUso() {
  if (!exigirEscrita()) return
  const ativoId = Number(val('us-ativo'))
  const delta = num('us-delta')
  const ativo = ATIVOS.find(a => a.id === ativoId)
  if (!ativo) return alert('Selecione um ativo.')
  if (!delta || delta <= 0) return alert('Informe o uso do período.')

  const usoTotal = Number(ativo.uso_atual) + delta

  const registrado = await gravar(
    supa.from(tabela('uso_registros')).insert({
      ativo_id: ativoId,
      delta,
      uso_total: usoTotal,
      data: val('us-data') || hoje(),
      operador: val('us-operador') || null,
      obs: val('us-obs') || null,
    }),
    'registrar o uso',
  )
  if (!registrado.ok) return avisar(registrado.erro, 'erro')

  const atualizado = await gravarERecarregar(
    supa.from(tabela('ativos')).update({ uso_atual: usoTotal }).eq('id', ativoId),
    'atualizar o horímetro',
    `${ativo.codigo} agora com ${fmtNum(usoTotal)} ${CFG.unidadeUso}.`,
  )
  if (atualizado) fecharModal('uso')
}

// ── modais: OS ──
function abrirModalOS(ativoId = null, planoId = null) {
  if (!exigirEscrita()) return
  el('os-ativo').innerHTML = ATIVOS.filter(a => a.ativo)
    .map(a => `<option value="${a.id}">${esc(a.codigo)} — ${esc(a.nome)}</option>`).join('')
  if (ativoId) el('os-ativo').value = String(ativoId)
  popularPlanosOS(planoId)
  el('os-tipo').value = 'preventiva'
  el('os-status').value = 'concluida'
  el('os-descricao').value = ''
  el('os-tecnico').value = USUARIO?.nome || ''
  el('os-data').value = hoje()
  el('os-conforme').value = ''
  el('os-nc').value = ''
  el('os-acao').value = ''
  abrirModal('os')
}

function popularPlanosOS(planoId = null) {
  const ativo = ATIVOS.find(a => a.id === Number(val('os-ativo')))
  const aplicaveis = PLANOS.filter(plano => plano.ativo && plano.tipo === ativo?.tipo)
  el('os-plano').innerHTML = '<option value="">Sem plano (corretiva)</option>' + aplicaveis
    .map(plano => `<option value="${plano.id}">${esc(plano.nome)} — ${fmtNum(plano.intervalo)} ${esc(plano.unidade)}</option>`).join('')
  if (planoId) el('os-plano').value = String(planoId)
  el('os-uso').value = ativo ? ativo.uso_atual : ''
  mostrarPecasDoPlano()
}

function mostrarPecasDoPlano() {
  const planoId = Number(val('os-plano'))
  const caixa = el('os-pecas')
  if (!planoId) {
    caixa.textContent = 'Sem plano selecionado — nenhuma baixa automática de estoque.'
    return
  }
  const pecas = materiaisDoPlano(planoId)
  if (!pecas.length) {
    caixa.textContent = 'Plano sem peças previstas.'
    return
  }
  const custo = pecas.reduce((total, item) => total + Number(item.vinculo.quantidade) * Number(item.material.preco || 0), 0)
  caixa.innerHTML = `<strong>Baixa automática ao concluir:</strong><br>${pecas
    .map(item => `${esc(item.material.nome)} — ${fmtNum(item.vinculo.quantidade)} ${esc(item.material.unidade)} (estoque ${fmtNum(item.material.estoque_atual)})`)
    .join('<br>')}<br><strong>Custo estimado:</strong> ${fmtMoeda(custo)}`
}

async function salvarOS() {
  if (!exigirEscrita()) return
  const ativoId = Number(val('os-ativo'))
  const planoId = Number(val('os-plano')) || null
  const descricao = val('os-descricao') || PLANOS.find(p => p.id === planoId)?.nome
  if (!ativoId) return alert('Selecione um ativo.')
  if (!descricao) return alert('Descreva o serviço.')

  const status = val('os-status')
  const conforme = val('os-conforme')
  const dataOS = val('os-data') || hoje()

  const registro = {
    ativo_id: ativoId,
    plano_id: planoId,
    tipo: val('os-tipo'),
    status,
    descricao,
    uso_na_os: num('os-uso'),
    tecnico: val('os-tecnico') || null,
    conforme: conforme === '' ? null : conforme === 'sim',
    nao_conformidade: val('os-nc') || null,
    acao_corretiva: val('os-acao') || null,
    data_abertura: dataOS,
    data_conclusao: status === 'concluida' ? dataOS : null,
  }

  const { ok, dados, erro } = await gravar(supa.from(tabela('os')).insert(registro), 'salvar a OS')
  if (!ok) return avisar(erro, 'erro')

  if (status === 'concluida') await baixarPecasDaOS(dados[0])

  fecharModal('os')
  await recarregar()
  avisar('OS registrada.')
}

async function concluirOS(id) {
  if (!exigirEscrita()) return
  const os = OS_LIST.find(item => item.id === id)
  if (!os) return
  if (!confirm('Concluir esta OS e dar baixa nas peças previstas?')) return

  const { ok, erro } = await gravar(
    supa.from(tabela('os')).update({ status: 'concluida', data_conclusao: hoje() }).eq('id', id),
    'concluir a OS',
  )
  if (!ok) return avisar(erro, 'erro')

  await baixarPecasDaOS(os)
  await recarregar()
  avisar('OS concluída e estoque atualizado.')
}

// Baixa as peças previstas no plano da OS e grava o custo consumido.
async function baixarPecasDaOS(os) {
  if (!os?.plano_id) return
  const pecas = materiaisDoPlano(os.plano_id)
  if (!pecas.length) return

  let custo = 0
  for (const { vinculo, material } of pecas) {
    const quantidade = Number(vinculo.quantidade)
    const novoSaldo = Math.max(0, Number(material.estoque_atual) - quantidade)
    custo += quantidade * Number(material.preco || 0)

    const { ok, erro } = await gravar(
      supa.from(tabela('materiais')).update({ estoque_atual: novoSaldo }).eq('id', material.id),
      'dar baixa no estoque',
    )
    if (!ok) return avisar(erro, 'erro')

    await supa.from(tabela('estoque_movimentos')).insert({
      material_id: material.id,
      os_id: os.id,
      tipo: 'saida',
      quantidade,
      motivo: `OS ${os.id.slice(0, 8)}`,
    })
  }

  await supa.from(tabela('os')).update({ custo_pecas: custo }).eq('id', os.id)
}

// ── modais: plano ──
function abrirModalPlano(id = null) {
  if (!exigirEscrita()) return
  PLANO_EDIT_ID = id
  const plano = PLANOS.find(p => p.id === id)
  el('plano-titulo').textContent = plano ? `Editar ${plano.codigo}` : 'Novo plano'
  el('pl-codigo').value = plano?.codigo || ''
  el('pl-tipo').value = plano?.tipo || Object.keys(CFG.tipos)[0]
  el('pl-nome').value = plano?.nome || ''
  el('pl-intervalo').value = plano?.intervalo ?? ''
  el('pl-ordem').value = plano?.ordem ?? 0
  el('pl-norma').value = plano?.norma_ref || ''
  el('pl-descricao').value = plano?.descricao || ''
  abrirModal('plano')
}

async function salvarPlano() {
  if (!exigirEscrita()) return
  const registro = {
    codigo: val('pl-codigo'),
    tipo: val('pl-tipo'),
    nome: val('pl-nome'),
    intervalo: num('pl-intervalo'),
    unidade: CFG.unidadeUso,
    ordem: num('pl-ordem') ?? 0,
    norma_ref: val('pl-norma') || null,
    descricao: val('pl-descricao') || null,
  }
  if (!registro.codigo || !registro.nome) return alert('Código e nome são obrigatórios.')
  if (!registro.intervalo || registro.intervalo <= 0) return alert('Informe um intervalo maior que zero.')

  const consulta = PLANO_EDIT_ID
    ? supa.from(tabela('planos')).update(registro).eq('id', PLANO_EDIT_ID)
    : supa.from(tabela('planos')).insert(registro)

  const salvo = await gravarERecarregar(
    consulta,
    PLANO_EDIT_ID ? 'salvar o plano' : 'criar o plano',
    `Plano ${registro.codigo} ${PLANO_EDIT_ID ? 'atualizado' : 'criado'}.`,
  )
  if (salvo) fecharModal('plano')
}

// ── modais: material ──
function abrirModalMaterial(id = null) {
  if (!exigirEscrita()) return
  MATERIAL_EDIT_ID = id
  const material = MATERIAIS.find(m => m.id === id)
  el('material-titulo').textContent = material ? `Editar ${material.nome}` : 'Nova peça'
  el('ma-codigo').value = material?.codigo || ''
  el('ma-nome').value = material?.nome || ''
  el('ma-categoria').value = material?.categoria || ''
  el('ma-unidade').value = material?.unidade || 'UN'
  el('ma-preco').value = material?.preco ?? ''
  el('ma-atual').value = material?.estoque_atual ?? 0
  el('ma-minimo').value = material?.estoque_minimo ?? 0
  el('ma-obs').value = material?.obs || ''
  abrirModal('material')
}

async function salvarMaterial() {
  if (!exigirEscrita()) return
  const registro = {
    codigo: val('ma-codigo'),
    nome: val('ma-nome'),
    categoria: val('ma-categoria') || null,
    unidade: val('ma-unidade') || 'UN',
    preco: num('ma-preco'),
    estoque_atual: num('ma-atual') ?? 0,
    estoque_minimo: num('ma-minimo') ?? 0,
    obs: val('ma-obs') || null,
  }
  if (!registro.codigo || !registro.nome) return alert('Código e nome são obrigatórios.')

  const consulta = MATERIAL_EDIT_ID
    ? supa.from(tabela('materiais')).update(registro).eq('id', MATERIAL_EDIT_ID)
    : supa.from(tabela('materiais')).insert(registro)

  const salvo = await gravarERecarregar(
    consulta,
    MATERIAL_EDIT_ID ? 'salvar a peça' : 'criar a peça',
    `Peça ${registro.nome} ${MATERIAL_EDIT_ID ? 'atualizada' : 'criada'}.`,
  )
  if (salvo) fecharModal('material')
}

// ── modais: movimento de estoque ──
function abrirModalMovimento() {
  if (!exigirEscrita()) return
  el('mv-material').innerHTML = MATERIAIS
    .map(m => `<option value="${m.id}">${esc(m.nome)} (${fmtNum(m.estoque_atual)} ${esc(m.unidade)})</option>`).join('')
  el('mv-tipo').value = 'entrada'
  el('mv-quantidade').value = ''
  el('mv-motivo').value = ''
  abrirModal('movimento')
}

async function salvarMovimento() {
  if (!exigirEscrita()) return
  const materialId = Number(val('mv-material'))
  const quantidade = num('mv-quantidade')
  const tipo = val('mv-tipo')
  const material = MATERIAIS.find(m => m.id === materialId)
  if (!material) return alert('Selecione uma peça.')
  if (!quantidade || quantidade <= 0) return alert('Informe a quantidade.')

  const saldo = tipo === 'entrada'
    ? Number(material.estoque_atual) + quantidade
    : Math.max(0, Number(material.estoque_atual) - quantidade)

  const movimento = await gravar(
    supa.from(tabela('estoque_movimentos')).insert({
      material_id: materialId,
      tipo,
      quantidade,
      motivo: val('mv-motivo') || null,
    }),
    'registrar o movimento',
  )
  if (!movimento.ok) return avisar(movimento.erro, 'erro')

  const atualizado = await gravarERecarregar(
    supa.from(tabela('materiais')).update({ estoque_atual: saldo }).eq('id', materialId),
    'atualizar o saldo',
    `${material.nome}: saldo agora é ${fmtNum(saldo)} ${material.unidade}.`,
  )
  if (atualizado) fecharModal('movimento')
}

// ── exportações ──
function csvEscape(valor) {
  const texto = String(valor ?? '')
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function baixarCsv(nome, linhas) {
  const csv = linhas.map(colunas => colunas.map(csvEscape).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${CFG.prefixo}-${nome}-${hoje()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function exportarVencimentosCsv() {
  baixarCsv('vencimentos', [
    ['ativo', 'nome', 'tipo', 'plano', 'intervalo', 'ultima', 'proxima', 'falta', 'situacao'],
    ...todosVencimentos().map(item => [
      item.ativo.codigo, item.ativo.nome, rotuloTipo(item.ativo.tipo), item.plano.nome,
      item.plano.intervalo, item.ultimo || '', item.proximo, item.falta,
      VENCIMENTO[item.status].rotulo,
    ]),
  ])
}

function exportarComprasCsv() {
  const linhas = materiaisEmFalta().map(material => {
    const falta = Math.max(0, Number(material.estoque_minimo) - Number(material.estoque_atual))
    return [
      material.codigo, material.nome, material.categoria || '', material.unidade,
      material.estoque_atual, material.estoque_minimo, falta,
      Number(material.preco || 0).toFixed(2).replace('.', ','),
      (falta * Number(material.preco || 0)).toFixed(2).replace('.', ','),
    ]
  })
  baixarCsv('compras', [
    ['codigo', 'peca', 'categoria', 'unidade', 'atual', 'minimo', 'comprar', 'preco_unit', 'total'],
    ...linhas,
  ])
}

// ── sessão ──
function mostrarApp() {
  el('login-screen').style.display = 'none'
  el('app').style.display = 'block'
  el('user-chip').textContent = `${USUARIO?.nome || 'Usuário'} · ${USUARIO?.role || '—'}`
  recarregar()
}

function mostrarLogin() {
  el('login-screen').style.display = 'block'
  el('app').style.display = 'none'
}

async function sair() {
  try {
    if (auth?.sair) await auth.sair()
  } finally {
    window.location.reload()
  }
}

function mostrarErroBoot(error) {
  el('login-screen').innerHTML = `
    <div class="callout co-red" style="max-width:560px;margin:40px auto">
      <strong>Falha ao iniciar o módulo ${esc(CFG.nome)}.</strong><br>
      ${esc(error.message || String(error))}
    </div>
  `
}

function exporNoWindow() {
  Object.assign(window, {
    abrirModalAtivo, abrirModalMaterial, abrirModalMovimento, abrirModalOS,
    abrirModalPlano, abrirModalUso, concluirOS, exportarComprasCsv,
    exportarVencimentosCsv, fecharModal, mostrarPecasDoPlano, popularPlanosOS,
    sair, salvarAtivo, salvarMaterial, salvarMovimento, salvarOS, salvarPlano,
    salvarUso, trocarView,
  })
}

/**
 * Inicia um módulo de manutenção por horímetro.
 * @param {object} config
 * @param {string} config.prefixo    Prefixo das tabelas no Postgres (ex.: 'elet').
 * @param {string} config.nome       Nome exibido do módulo (ex.: 'Elétrica').
 * @param {string} config.icone      Emoji do módulo.
 * @param {string} config.accent     Cor de destaque (CSS).
 * @param {string} config.descricao  Subtítulo do painel.
 * @param {object} config.tipos      { CHAVE: { nome, emoji } } — tipos de ativo.
 * @param {string} [config.unidadeUso='h'] Unidade do horímetro.
 */
export async function iniciarModulo(config) {
  CFG = { unidadeUso: 'h', ...config }

  exporNoWindow()
  montarLayout()

  try {
    supa = await criarClienteSupabase()
  } catch (error) {
    mostrarErroBoot(error)
    return
  }

  auth = new Auth(supa, { appNome: CFG.nome, appIcone: CFG.icone })
  auth.onLogin(usuario => {
    USUARIO = usuario
    mostrarApp()
  })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}
