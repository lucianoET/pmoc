import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { aplicarShell } from '../shared/shell.js'

// ── CONFIG: shared/supabase-config.js descobre a configuração dos outros
// cinco módulos lendo este arquivo por expressão regular — as duas
// constantes abaixo continuam declaradas por isso, mesmo que o cliente
// Supabase deste módulo seja criado por criarClienteSupabase().
const SUPA_URL = 'https://thoaqipyhfmromsgzmjs.supabase.co'
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRob2FxaXB5aGZtcm9tc2d6bWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNjk5NTksImV4cCI6MjEwMTY0NTk1OX0.1Ig6ijb6SKgeQRgGwM54MyzlVr-n_feSAxaFTwbHRGY'
// ─────────────────────────────────────────────────────────────────

let supa = null
let auth = null

// ── estado global ──
let ATIVOS = [], OS_LIST = [], MATERIAIS = [], PLANOS = [], PLANO_MATS = [], ABASTS = [], USOS = []
let AREAS = [], OPERACOES = [], OPERACOES_ERRO = null
// Catálogo de reparos (migração 26). Carregado à parte e tolerante a ausência:
// enquanto a migração não rodar em produção, as três listas ficam vazias e o
// módulo segue funcionando exatamente como antes.
let REPAROS = [], REP_MATS = [], REP_SERVS = [], SERVICOS = []
let USUARIO = null
let ATIVO_EDIT_ID = null
let OPERACAO_CONCLUIR_ID = null
let AGENDA_ANO = new Date().getFullYear()
let AGENDA_MES = new Date().getMonth()

// ── auth compartilhado (shared/auth.js) ──
async function sair(){
  try {
    if (auth?.sair) await auth.sair()
  } finally {
    window.location.reload()
  }
}
async function mostrarApp(){
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('app').style.display = 'block'
  atualizarCabecalhoUsuario()
  await carregarTudo()
  _abrirAtivoDaUrl()
}
function mostrarLogin(){
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('app').style.display = 'none'
}
function atualizarCabecalhoUsuario(){
  const texto = USUARIO
    ? `${USUARIO.funcao || USUARIO.posto_graduacao || USUARIO.nome || 'Usuário'} · ${USUARIO.role}`
    : 'Livre · observador'
  document.getElementById('user-chip').textContent = texto
}

// ── deep link do mapa (PLAT-14) ──
// Metade de destino do link que sai do balão de ativo no mapa (plano 10-05
// monta a rota, `linkDoModulo` de mapa/mapa-geometria.js). A barra de
// endereço é a entrada menos confiável que existe — a validação de forma
// é anterior a qualquer uso (T-10-12). Roda uma vez por carregamento de
// página: a marca abaixo impede que trocar de aba dentro do módulo reabra
// a ficha por cima do que o usuário estiver fazendo.
let DEEP_LINK_ATIVO_CONSUMIDO = false
function _abrirAtivoDaUrl(){
  if (DEEP_LINK_ATIVO_CONSUMIDO) return
  DEEP_LINK_ATIVO_CONSUMIDO = true
  const bruto = new URLSearchParams(window.location.search).get('ativo')
  // Conversão estrita: só dígitos (sem sinal, fração ou notação exponencial)
  // e o resultado precisa ser um inteiro seguro. Qualquer outra forma é
  // descartada em silêncio, sem erro e sem mensagem.
  if (bruto === null || !/^\d+$/.test(bruto)) return
  const id = Number(bruto)
  if (!Number.isSafeInteger(id)) return
  const ativo = ATIVOS.find(a => a.id === id)
  // Não encontrado é o caso normal de um ativo desativado entre uma tela e
  // outra, não uma condição de erro — sai sem consulta extra ao banco.
  if (!ativo) return
  abrirModalAtivo(ativo.id)
}

// ── dados ──
async function carregarTudo(){
  const [a, o, m, p, pm, ab, ur, ar, op] = await Promise.all([
    supa.from('maq_ativos').select('*').order('codigo'),
    supa.from('maq_os').select('*, maq_ativos(codigo,nome), maq_planos(nome)').order('data_abertura', {ascending:false}),
    supa.from('maq_materiais').select('*').order('nome'),
    supa.from('maq_planos').select('*').eq('ativo', true).order('tipo_modelo').order('ordem'),
    supa.from('maq_plano_materiais').select('*, maq_materiais(nome,unidade)'),
    supa.from('maq_abastecimentos').select('*, maq_ativos(codigo,nome,emoji)').order('data',{ascending:false}),
    supa.from('maq_uso_registros').select('*, maq_ativos(codigo,nome)').order('registrado_em',{ascending:false}),
    supa.from('maq_areas').select('*').eq('ativo', true).order('nome'),
    supa.from('maq_operacoes').select('*, maq_areas(nome,codigo,area_m2), maq_ativos(codigo,nome,emoji,uso_atual)').order('data_programada',{ascending:false}),
  ])
  ATIVOS    = a.data || []
  OS_LIST   = o.data || []
  MATERIAIS = m.data || []
  PLANOS    = p.data || []
  PLANO_MATS= pm.data|| []
  ABASTS    = ab.data|| []
  USOS      = ur.data|| []
  AREAS     = ar.data|| []
  OPERACOES = op.data|| []
  OPERACOES_ERRO = ar.error || op.error || null
  await carregarCatalogoReparos()
  aplicarPermissoesOperacoes()
  renderPainel(); renderAtivos(); renderVencimentos(); renderOS(); renderMateriais()
  renderConsumo(); renderCiclo(); renderCompras(); renderOperacoes(); renderAgenda()
}

// ── catálogo de reparos (migração 26) ──
// Fora do Promise.all de carregarTudo() de propósito: se as tabelas rep_* ainda
// não existirem, o erro fica contido aqui e o módulo continua igual ao que era.
async function carregarCatalogoReparos(){
  const [rp, rm, rs, sv] = await Promise.all([
    supa.from('rep_reparos').select('*').eq('ativo', true).order('frequencia', {ascending:false}),
    supa.from('rep_reparo_materiais').select('*'),
    supa.from('rep_reparo_servicos').select('*'),
    supa.from('rep_servicos').select('*').eq('ativo', true),
  ])
  const indisponivel = rp.error || rm.error || rs.error || sv.error
  REPAROS   = indisponivel ? [] : (rp.data || [])
  REP_MATS  = indisponivel ? [] : (rm.data || [])
  REP_SERVS = indisponivel ? [] : (rs.data || [])
  SERVICOS  = indisponivel ? [] : (sv.data || [])
}

// peças essenciais de um reparo, já resolvidas contra maq_materiais
function pecasEssenciaisDoReparo(reparoId){
  return REP_MATS
    .filter(x => x.reparo_id === reparoId && x.essencial)
    .map(x => ({ ...x, mat: MATERIAIS.find(m => m.id === x.material_id) }))
    .filter(x => x.mat)
}

// ── views ──
function trocarView(id, btn){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  document.getElementById('view-'+id).classList.add('active')
  btn.classList.add('active')
}

// ── PAINEL ──
function renderPainel(){
  const total  = ATIVOS.length
  const op     = ATIVOS.filter(a => a.status === 'operante').length
  const inop   = ATIVOS.filter(a => a.status === 'inoperante').length
  const venc   = calcVencimentos().filter(v => v.pct >= 80).length
  const baixo  = MATERIAIS.filter(m => m.estoque_atual < m.estoque_minimo).length

  document.getElementById('kpi-total').textContent     = total
  document.getElementById('kpi-operantes').textContent = op
  document.getElementById('kpi-inop').textContent      = inop
  document.getElementById('kpi-venc').textContent      = venc
  document.getElementById('kpi-estoque-baixo').textContent = baixo

  // inoperantes
  const inopList = ATIVOS.filter(a => a.status !== 'operante')
  const divInop = document.getElementById('painel-inop')
  if(!inopList.length){
    divInop.innerHTML = '<div class="empty"><div class="empty-ico">✅</div><p>Todas operantes</p></div>'
  } else {
    divInop.innerHTML = inopList.map(a => `
      <div class="mat-alert">
        <div class="mat-info">
          <div class="mat-nome">${a.codigo} — ${a.nome}</div>
          <div class="mat-stock">${a.local || '—'}</div>
        </div>
        <span class="badge ${a.status==='inoperante'?'b-red':'b-warn'}">${a.status.toUpperCase()}</span>
      </div>`).join('')
  }

  // materiais críticos
  const matsLow = MATERIAIS.filter(m => m.estoque_atual < m.estoque_minimo)
  const divMats = document.getElementById('painel-mats')
  if(!matsLow.length){
    divMats.innerHTML = '<div class="empty"><div class="empty-ico">✅</div><p>Estoque OK</p></div>'
  } else {
    divMats.innerHTML = matsLow.map(m => `
      <div class="mat-alert">
        <div class="mat-info">
          <div class="mat-nome">${m.nome}</div>
          <div class="mat-stock">${m.estoque_atual} ${m.unidade} · mín: ${m.estoque_minimo}</div>
        </div>
        <span class="badge b-red">BAIXO</span>
      </div>`).join('')
  }
}

// ── ATIVOS ──
function renderAtivos(){
  const cat    = document.getElementById('filtro-cat').value
  const status = document.getElementById('filtro-status').value
  let lista = ATIVOS.filter(a =>
    (!cat    || a.categoria === cat) &&
    (!status || a.status    === status)
  )
  const tbody = document.getElementById('tb-ativos')
  if(!lista.length){
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">Nenhuma máquina encontrada</td></tr>'
    return
  }
  const statusBadge = s => s==='operante'?'b-ok':s==='inoperante'?'b-red':'b-warn'
  tbody.innerHTML = lista.map(a => `
    <tr onclick="abrirModalAtivo(${a.id})">
      <td class="hi" style="color:${a.cor||'var(--text)'}">${a.emoji||''} ${a.codigo||'—'}</td>
      <td class="hi">${a.nome}</td>
      <td>${a.categoria||'—'}</td>
      <td>${[a.fabricante,a.modelo].filter(Boolean).join(' ') || '—'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span>${a.uso_atual} ${a.unidade_uso}</span>
        </div>
      </td>
      <td><span class="badge ${statusBadge(a.status)}">${a.status.toUpperCase()}</span></td>
      <td>${a.local||'—'}</td>
      <td>
        <button class="btn btn-s btn-sm" onclick="event.stopPropagation();abrirModalOS(${a.id})">+ OS</button>
      </td>
    </tr>`).join('')
}

// ── VENCIMENTOS ──
function calcVencimentos(){
  const items = []
  for(const ativo of ATIVOS){
    if(ativo.status === 'baixado') continue
    const planosAtivo = PLANOS.filter(p => p.tipo_modelo === ativo.tipo_modelo)
    for(const plano of planosAtivo){
      if(plano.unidade !== 'h' && plano.unidade !== 'km' && plano.unidade !== 'ciclos') continue
      // último uso registrado neste plano
      const ultimaOS = OS_LIST.find(o => o.ativo_id === ativo.id && o.plano_id === plano.id && o.status === 'concluida')
      const baseUso = ultimaOS ? (ultimaOS.uso_na_os || 0) : 0
      const proxUso = baseUso + plano.intervalo
      const falta = proxUso - ativo.uso_atual
      const pct = Math.min(100, Math.round(((ativo.uso_atual - baseUso) / plano.intervalo) * 100))
      items.push({ ativo, plano, proxUso, falta, pct })
    }
  }
  return items.sort((a,b) => b.pct - a.pct)
}

function renderVencimentos(){
  const items = calcVencimentos()
  const div = document.getElementById('venc-content')
  if(!items.length){
    div.innerHTML = '<div class="callout co-ok">Nenhum plano de manutenção configurado para os ativos cadastrados.</div>'
    return
  }
  const card = v => {
    const cls = v.pct >= 100 ? 'urgente' : v.pct >= 80 ? 'proximo' : 'ok'
    const cor = v.pct >= 100 ? 'var(--red)' : v.pct >= 80 ? 'var(--yellow)' : 'var(--green)'
    const label = v.pct >= 100 ?
      `<span class="badge b-red">VENCIDO (${Math.abs(v.falta).toFixed(0)} ${v.plano.unidade} atrás)</span>` :
      v.falta <= 5 ?
      `<span class="badge b-warn">Falta ${v.falta.toFixed(0)} ${v.plano.unidade}</span>` :
      `<span style="font-size:11px;color:var(--text3)">Falta ${v.falta.toFixed(0)} ${v.plano.unidade}</span>`
    return `<div class="venc-card ${cls}">
      <div class="venc-ativo">${v.ativo.codigo} — ${v.ativo.nome}</div>
      <div class="venc-plano">${v.plano.nome} · a cada ${v.plano.intervalo} ${v.plano.unidade}</div>
      <div class="uso-bar-wrap" style="margin:8px 0">
        <div class="uso-bar" style="width:${v.pct}%;background:${cor}"></div>
      </div>
      <div class="venc-progress">
        <span>${v.pct}% do intervalo</span> · ${label}
        <button class="btn btn-s btn-sm" style="margin-left:auto"
          onclick="abrirModalOS(${v.ativo.id}, ${v.plano.id})">Registrar OS</button>
      </div>
    </div>`
  }
  div.innerHTML = '<div class="venc-grid">' + items.map(card).join('') + '</div>'
}

// ── OS ──
function renderOS(){
  const tbody = document.getElementById('tb-os')
  if(!OS_LIST.length){
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">Nenhuma OS registrada</td></tr>'
    return
  }
  const sBadge = s => s==='concluida'?'b-ok':s==='pendente'?'b-warn':s==='cancelada'?'b-red':'b-blue'
  const tBadge = t => t==='preventiva'?'b-blue':t==='corretiva'?'b-red':'b-ok'
  tbody.innerHTML = OS_LIST.slice(0,100).map(o => `<tr>
    <td>${o.data_abertura||'—'}</td>
    <td class="hi">${o.maq_ativos?.codigo||'?'} — ${o.maq_ativos?.nome||'?'}</td>
    <td><span class="badge ${tBadge(o.tipo)}">${o.tipo.toUpperCase()}</span></td>
    <td>${o.maq_planos?.nome || (o.tipo==='uso'?'Registro de uso':'Corretiva')}</td>
    <td>${o.tecnico||'—'}</td>
    <td><span class="badge ${sBadge(o.status)}">${o.status.toUpperCase()}</span></td>
    <td>${o.status==='pendente'?`<button class="btn btn-p btn-sm" onclick="concluirOS('${o.id}')">Concluir</button>`:'—'}</td>
  </tr>`).join('')
}

// ── OPERAÇÕES DE SERVIÇO ──
function esc(valor){
  return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  })[caractere])
}

function podeEditarOperacoes(){
  return ['admin','gestor','tecnico','executor'].includes(USUARIO?.role)
}

function aplicarPermissoesOperacoes(){
  const btnOperacao = document.getElementById('btn-nova-operacao')
  const btnArea = document.getElementById('btn-nova-area')
  if(btnOperacao) btnOperacao.style.display = podeEditarOperacoes() ? '' : 'none'
  if(btnArea) btnArea.style.display = ['admin','gestor'].includes(USUARIO?.role) ? '' : 'none'
}

function renderOperacoes(){
  const kanban = document.getElementById('operacoes-kanban')
  const tbody = document.getElementById('tb-areas')
  if(!kanban || !tbody) return
  const colunas = [
    ['programada','Programadas'],['em_execucao','Em execução'],
    ['concluida','Concluídas'],['cancelada','Canceladas'],
  ]
  if(OPERACOES_ERRO){
    document.getElementById('operacoes-kpis').innerHTML=''
    kanban.innerHTML = '<div class="callout co-warn" style="grid-column:1/-1">Operações indisponíveis. A migração 12 precisa ser aplicada no Supabase.</div>'
  } else {
    const grupos = OperacoesMaq.agruparOperacoes(OPERACOES)
    document.getElementById('operacoes-kpis').innerHTML = colunas.map(([status,label]) => `
      <div class="kpi"><div class="kpi-n">${grupos[status].length}</div><div class="kpi-l">${label}</div></div>`).join('')
    kanban.innerHTML = colunas.map(([status,label]) => `
      <section class="kanban-col">
        <div class="kanban-title"><span>${label}</span><span class="kanban-count">${grupos[status].length}</span></div>
        ${grupos[status].length ? grupos[status].map(renderCartaoOperacao).join('') : '<div class="empty" style="padding:24px 8px"><p>Nenhuma operação</p></div>'}
      </section>`).join('')
  }
  tbody.innerHTML = AREAS.length ? AREAS.map(area => `<tr>
    <td class="hi">${esc(area.codigo || '—')}</td><td>${esc(area.nome)}</td>
    <td>${esc(area.tipo)}</td><td>${area.area_m2 == null ? '—' : Number(area.area_m2).toLocaleString('pt-BR')+' m²'}</td>
    <td>${area.periodicidade_dias ? area.periodicidade_dias+' dias' : '—'}</td><td>${esc(area.localizacao || '—')}</td>
  </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">Nenhuma área cadastrada</td></tr>'
}

function renderCartaoOperacao(operacao){
  const iniciar = podeEditarOperacoes() && operacao.status==='programada'
    ? `<button class="btn btn-s btn-sm" onclick="iniciarOperacao('${operacao.id}')">Iniciar</button>` : ''
  const concluir = podeEditarOperacoes() && operacao.status==='em_execucao'
    ? `<button class="btn btn-p btn-sm" onclick="abrirConcluirOperacao('${operacao.id}')">Concluir</button>` : ''
  return `<article class="op-card">
    <div class="op-name">${esc(operacao.maq_areas?.nome || 'Área não informada')}</div>
    <div class="op-meta">${esc(operacao.tipo_servico)} · ${esc(operacao.data_programada)}<br>
      ${esc(operacao.maq_ativos?.emoji || '')} ${esc(operacao.maq_ativos?.codigo || '?')} · ${esc(operacao.operador || 'Sem operador')}
      ${operacao.horas_utilizadas ? `<br>${Number(operacao.horas_utilizadas).toFixed(1)} h registradas` : ''}
    </div>
    ${iniciar || concluir ? `<div class="op-actions">${iniciar}${concluir}</div>` : ''}
  </article>`
}

async function iniciarOperacao(id){
  if(!podeEditarOperacoes()) return
  const { error } = await supa.from('maq_operacoes').update({status:'em_execucao',iniciado_em:new Date().toISOString()}).eq('id',id)
  if(error){ alert('Erro ao iniciar operação: '+error.message); return }
  await carregarTudo()
}

function renderAgenda(){
  const calendario = document.getElementById('agenda-calendario')
  if(!calendario) return
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  document.getElementById('agenda-titulo').textContent = `${meses[AGENDA_MES]} ${AGENDA_ANO}`
  const eventos = OperacoesMaq.criarEventosCalendario(OPERACOES,OS_LIST,AGENDA_ANO,AGENDA_MES)
  const porData = eventos.reduce((grupos,evento)=>{
    ;(grupos[evento.data] ||= []).push(evento); return grupos
  },{})
  const primeiroDia = new Date(AGENDA_ANO,AGENDA_MES,1).getDay()
  const totalDias = new Date(AGENDA_ANO,AGENDA_MES+1,0).getDate()
  const cabecalho = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(dia=>`<div class="calendar-weekday">${dia}</div>`).join('')
  let dias = '<div class="calendar-day is-empty"></div>'.repeat(primeiroDia)
  for(let dia=1;dia<=totalDias;dia++){
    const data = `${AGENDA_ANO}-${String(AGENDA_MES+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
    dias += `<div class="calendar-day"><div class="calendar-date">${dia}</div>${(porData[data]||[]).map(evento=>
      `<div class="calendar-event ${evento.origem==='operacao'?'op':'os'}">${evento.origem==='operacao'?'Operação':'OS'} · ${esc(evento.titulo)}</div>`
    ).join('')}</div>`
  }
  calendario.innerHTML = cabecalho+dias
}

function navegarAgenda(direcao){
  AGENDA_MES += direcao
  if(AGENDA_MES<0){ AGENDA_MES=11; AGENDA_ANO-- }
  if(AGENDA_MES>11){ AGENDA_MES=0; AGENDA_ANO++ }
  renderAgenda()
}

// ── MATERIAIS ──
function renderMateriais(){
  const tbody = document.getElementById('tb-materiais')
  if(!MATERIAIS.length){
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">Nenhum material cadastrado</td></tr>'
    return
  }
  tbody.innerHTML = MATERIAIS.map(m => {
    const ok = m.estoque_atual >= m.estoque_minimo
    const pct = m.estoque_minimo > 0 ? Math.min(100, Math.round((m.estoque_atual/m.estoque_minimo)*100)) : 100
    return `<tr>
      <td class="hi">${m.codigo||'—'}</td>
      <td>${m.nome}</td>
      <td><span class="badge b-blue">${m.tipo.toUpperCase()}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span>${m.estoque_atual} ${m.unidade}</span>
          <div class="uso-bar-wrap" style="width:60px">
            <div class="uso-bar" style="width:${pct}%;background:${ok?'var(--green)':'var(--red)'}"></div>
          </div>
        </div>
      </td>
      <td>${m.estoque_minimo} ${m.unidade}</td>
      <td>${m.preco?('R$ '+Number(m.preco).toFixed(2)):'—'}</td>
      <td><span class="badge ${ok?'b-ok':'b-red'}">${ok?'OK':'BAIXO'}</span></td>
    </tr>`}).join('')
}

// ── COMPRAS ──
function renderCompras(){
  const div = document.getElementById('compras-content')
  const linhas = []

  // 1. Materiais abaixo do mínimo
  const baixo = MATERIAIS.filter(m => m.estoque_atual < m.estoque_minimo)
  for(const m of baixo){
    const needed = m.estoque_minimo - m.estoque_atual
    linhas.push({
      codigo: m.codigo,
      nome: m.nome,
      unidade: m.unidade,
      qtd: needed,
      preco: m.preco,
      motivo: `Repor estoque mínimo (atual: ${m.estoque_atual} · mín: ${m.estoque_minimo})`
    })
  }

  // 2. Materiais dos planos que vão vencer em breve (pct >= 70)
  const venc = calcVencimentos().filter(v => v.pct >= 70)
  for(const v of venc){
    const pm = PLANO_MATS.filter(p => p.plano_id === v.plano.id)
    for(const pm_item of pm){
      const mat = MATERIAIS.find(m => m.id === pm_item.material_id)
      if(!mat) continue
      // só adiciona se não já coberto pelo estoque
      if(mat.estoque_atual >= pm_item.quantidade) continue
      const existe = linhas.find(l => l.codigo === mat.codigo)
      if(existe){
        existe.qtd = Math.max(existe.qtd, pm_item.quantidade)
        existe.motivo += ` + plano "${v.plano.nome}" em ${v.ativo.codigo}`
      } else {
        linhas.push({
          codigo: mat.codigo,
          nome: mat.nome,
          unidade: mat.unidade,
          preco: mat.preco,
          qtd: pm_item.quantidade,
          motivo: `Plano "${v.plano.nome}" em ${v.ativo.codigo} (${v.pct}% do intervalo)`
        })
      }
    }
  }

  if(!linhas.length){
    div.innerHTML = '<div class="callout co-ok">✅ Nenhuma compra necessária no momento. Todos os estoques estão adequados e nenhum plano está próximo do vencimento.</div>'
    return
  }

  div.innerHTML = `
    <div class="callout co-warn">⚠ ${linhas.length} ${linhas.length===1?'item':'itens'} a adquirir · <strong>Total estimado: R$ ${linhas.reduce((s,l)=>s+(l.preco||0)*l.qtd,0).toFixed(2)}</strong><br>Lista utilizável como insumo para processo licitatório (CATMAT/Compras.gov).</div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-s btn-sm" onclick="exportarComprasCSV()">⬇ Exportar CSV</button>
    </div>
    <div class="compra-grid">
      ${linhas.map(l => `
        <div class="compra-row">
          <div>
            <div class="compra-nome">${l.nome} ${l.codigo?'('+l.codigo+')':''}</div>
            <div class="compra-det">${l.motivo}</div>
          </div>
          <div style="text-align:right">
            <div class="compra-qtd">${l.qtd.toFixed(1)} ${l.unidade}</div>
            ${l.preco?`<div style="font-size:11px;color:var(--text3);margin-top:2px">R$ ${(l.preco*l.qtd).toFixed(2)}</div>`:''}
          </div>
        </div>`).join('')}
    </div>`

  // guarda para export
  window._comprasData = linhas
}

function exportarComprasCSV(){
  const linhas = window._comprasData || []
  const header = 'Codigo,Nome,Quantidade,Unidade,PrecoUnit,Total,Motivo'
  const rows = linhas.map(l => `${l.codigo||''},${JSON.stringify(l.nome)},${l.qtd},${l.unidade},${l.preco||''},${((l.preco||0)*l.qtd).toFixed(2)},${JSON.stringify(l.motivo)}`)
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = 'lista-compras-maquinas-' + new Date().toISOString().slice(0,10) + '.csv'
  a.click()
}


// ══ CONSUMO ══════════════════════════════════════════════
const fmtR = v => 'R$ ' + Number(v||0).toFixed(2)

function renderConsumo(){
  const totL   = ABASTS.reduce((s,a)=>s+Number(a.litros||0),0)
  const totR   = ABASTS.reduce((s,a)=>s+Number(a.custo_total||0),0)
  const totH   = USOS.reduce((s,u)=>s+Number(u.delta||0),0)
  const rend   = totH>0 ? (totL/totH) : 0

  document.getElementById('consumo-kpis').innerHTML = `
    <div class="kpi kc-blue"><div class="kpi-n">${totL.toFixed(1)}</div><div class="kpi-l">Litros no total</div></div>
    <div class="kpi kc-warn"><div class="kpi-n" style="font-size:1.4rem">${fmtR(totR)}</div><div class="kpi-l">Custo combustível</div></div>
    <div class="kpi kc-ok"><div class="kpi-n">${totH.toFixed(0)}h</div><div class="kpi-l">Horas registradas</div></div>
    <div class="kpi kc-gold"><div class="kpi-n">${rend.toFixed(2)}</div><div class="kpi-l">L/h médio da frota</div></div>`

  // por máquina
  const porMaq = {}
  for(const a of ABASTS){
    const k = a.ativo_id
    porMaq[k] = porMaq[k] || {nome:(a.maq_ativos?.emoji||'')+' '+(a.maq_ativos?.codigo||'?'), n:0, L:0, R:0, h:0}
    porMaq[k].n++; porMaq[k].L += Number(a.litros||0); porMaq[k].R += Number(a.custo_total||0)
  }
  for(const u of USOS){
    if(porMaq[u.ativo_id]) porMaq[u.ativo_id].h += Number(u.delta||0)
  }
  const linhasMaq = Object.values(porMaq)
  document.getElementById('tb-consumo-maq').innerHTML = linhasMaq.length ? linhasMaq.map(r=>`<tr>
    <td class="hi">${r.nome}</td><td>${r.n}</td><td>${r.L.toFixed(1)} L</td>
    <td>${fmtR(r.R)}</td><td>${r.h.toFixed(1)} h</td>
    <td class="hi">${r.h>0?(r.L/r.h).toFixed(2)+' L/h':'—'}</td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Nenhum abastecimento registrado</td></tr>'

  // por operador
  const porOp = {}
  for(const u of USOS){
    const k = (u.operador||'—').trim()
    porOp[k] = porOp[k] || {h:0,L:0,R:0}
    porOp[k].h += Number(u.delta||0)
  }
  for(const a of ABASTS){
    const k = (a.operador||'—').trim()
    porOp[k] = porOp[k] || {h:0,L:0,R:0}
    porOp[k].L += Number(a.litros||0); porOp[k].R += Number(a.custo_total||0)
  }
  const ops = Object.entries(porOp)
  document.getElementById('tb-consumo-op').innerHTML = ops.length ? ops.map(([nome,r])=>`<tr>
    <td class="hi">${nome}</td><td>${r.h.toFixed(1)} h</td><td>${r.L.toFixed(1)} L</td>
    <td>${fmtR(r.R)}</td><td>${r.h>0&&r.L>0?(r.L/r.h).toFixed(2)+' L/h':'—'}</td></tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Sem registros</td></tr>'

  // últimos abastecimentos
  document.getElementById('tb-abast').innerHTML = ABASTS.length ? ABASTS.slice(0,50).map(a=>`<tr>
    <td>${a.data||'—'}</td>
    <td class="hi">${a.maq_ativos?.emoji||''} ${a.maq_ativos?.codigo||'?'}</td>
    <td>${Number(a.litros).toFixed(1)} L</td>
    <td>${a.preco_litro?fmtR(a.preco_litro):'—'}</td>
    <td class="hi">${fmtR(a.custo_total)}</td>
    <td>${a.horimetro??'—'}</td>
    <td>${a.operador||'—'}</td></tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3)">Nenhum abastecimento</td></tr>'
}

function abrirModalAbastecimento(){
  document.getElementById('ab-data').value = new Date().toISOString().slice(0,10)
  document.getElementById('ab-ativo').innerHTML =
    ATIVOS.map(a=>`<option value="${a.id}">${a.emoji||''} ${a.codigo} — ${a.nome}</option>`).join('')
  ;['ab-litros','ab-preco','ab-horim','ab-obs'].forEach(id=>document.getElementById(id).value='')
  document.getElementById('ab-oper').value = USUARIO?.nome || ''
  document.getElementById('modal-abast').classList.add('open')
}

async function salvarAbastecimento(){
  const ativo_id = parseInt(document.getElementById('ab-ativo').value)
  const litros   = parseFloat(document.getElementById('ab-litros').value)
  if(!ativo_id || !litros){ alert('Informe máquina e litros.'); return }
  const { error } = await supa.from('maq_abastecimentos').insert({
    ativo_id, litros,
    data:        document.getElementById('ab-data').value,
    preco_litro: parseFloat(document.getElementById('ab-preco').value) || null,
    horimetro:   parseFloat(document.getElementById('ab-horim').value) || null,
    combustivel: document.getElementById('ab-comb').value,
    operador:    document.getElementById('ab-oper').value.trim(),
    obs:         document.getElementById('ab-obs').value.trim(),
  })
  if(error){ alert('Erro: '+error.message); return }
  fecharModal('modal-abast'); await carregarTudo()
}

// ══ CICLO DE VIDA ════════════════════════════════════════
function calcCiclo(){
  return ATIVOS.map(a=>{
    const valor = Number(a.valor_aquisicao||0)
    const vida  = Number(a.vida_util_h||0)
    const resid = valor * (Number(a.valor_residual||0)/100)
    const uso   = Number(a.uso_atual||0)
    const pctVida = vida>0 ? Math.min(100, (uso/vida)*100) : 0
    const deprec  = vida>0 ? Math.min(valor-resid, (valor-resid)*(uso/vida)) : 0
    const valorAtual = valor - deprec

    // custo de manutenção acumulado
    const osAtivo = OS_LIST.filter(o=>o.ativo_id===a.id)
    const custoManut = osAtivo.reduce((s,o)=>s+Number(o.custo_pecas||0)+Number(o.custo_mo||0),0)
    const custoComb  = ABASTS.filter(x=>x.ativo_id===a.id).reduce((s,x)=>s+Number(x.custo_total||0),0)
    const custoTotal = custoManut + custoComb
    const custoHora  = uso>0 ? (deprec + custoTotal)/uso : 0

    let situacao='ok', label='Operacional'
    if(pctVida>=100){ situacao='critico'; label='Vida útil esgotada' }
    else if(pctVida>=80){ situacao='alerta'; label='Fim de vida próximo' }
    else if(custoManut > valor*0.6){ situacao='alerta'; label='Custo manut. alto' }
    return {a, valor, vida, uso, pctVida, deprec, valorAtual, custoManut, custoComb, custoTotal, custoHora, situacao, label}
  })
}

function renderCiclo(){
  const items = calcCiclo()
  const totalPatrim = items.reduce((s,i)=>s+i.valor,0)
  const totalAtual  = items.reduce((s,i)=>s+i.valorAtual,0)
  const totalManut  = items.reduce((s,i)=>s+i.custoTotal,0)
  const criticos    = items.filter(i=>i.situacao!=='ok').length

  document.getElementById('ciclo-kpis').innerHTML = `
    <div class="kpi kc-blue"><div class="kpi-n" style="font-size:1.3rem">${fmtR(totalPatrim)}</div><div class="kpi-l">Patrimônio (aquisição)</div></div>
    <div class="kpi kc-ok"><div class="kpi-n" style="font-size:1.3rem">${fmtR(totalAtual)}</div><div class="kpi-l">Valor atual estimado</div></div>
    <div class="kpi kc-warn"><div class="kpi-n" style="font-size:1.3rem">${fmtR(totalManut)}</div><div class="kpi-l">Custo operacional acum.</div></div>
    <div class="kpi kc-red"><div class="kpi-n">${criticos}</div><div class="kpi-l">Máquinas em alerta</div></div>`

  const semDados = items.every(i=>i.uso===0)
  const aviso = document.getElementById('ciclo-aviso')
  if(semDados){
    aviso.style.display='block'
    aviso.innerHTML = '⚠ <strong>Dados insuficientes.</strong> Nenhuma hora de uso registrada ainda. A depreciação e o custo/hora só ficam significativos após alguns meses de registros reais de uso e manutenção.'
  } else aviso.style.display='none'

  const badge = s => s==='critico'?'b-red':s==='alerta'?'b-warn':'b-ok'
  document.getElementById('tb-ciclo').innerHTML = items.map(i=>`<tr>
    <td class="hi" style="color:${i.a.cor||'var(--text)'}">${i.a.emoji||''} ${i.a.codigo}</td>
    <td>${fmtR(i.valor)}</td>
    <td>${i.uso.toFixed(0)} h</td>
    <td>${i.vida.toFixed(0)} h
      <div class="uso-bar-wrap" style="margin-top:4px"><div class="uso-bar"
        style="width:${i.pctVida}%;background:${i.pctVida>=100?'var(--red)':i.pctVida>=80?'var(--yellow)':'var(--green)'}"></div></div>
    </td>
    <td>${fmtR(i.deprec)}</td>
    <td class="hi">${fmtR(i.valorAtual)}</td>
    <td>${fmtR(i.custoTotal)}</td>
    <td class="hi">${i.custoHora>0?fmtR(i.custoHora)+'/h':'—'}</td>
    <td><span class="badge ${badge(i.situacao)}">${i.label}</span></td>
  </tr>`).join('')

  // timeline
  const eventos = [
    ...OS_LIST.map(o=>({d:o.data_abertura, t:'os', txt:`${o.maq_ativos?.codigo||'?'} — ${o.maq_planos?.nome||o.tipo}`, c:'var(--blue)'})),
    ...ABASTS.map(a=>({d:a.data, t:'ab', txt:`${a.maq_ativos?.codigo||'?'} — ${Number(a.litros).toFixed(1)}L ${a.custo_total?'('+fmtR(a.custo_total)+')':''}`, c:'var(--yellow)'})),
  ].filter(e=>e.d).sort((x,y)=>y.d.localeCompare(x.d)).slice(0,40)

  document.getElementById('ciclo-timeline').innerHTML = eventos.length
    ? eventos.map(e=>`<div style="display:flex;gap:12px;align-items:center;padding:8px 12px;background:var(--surface);
        border-left:3px solid ${e.c};border-radius:0 6px 6px 0;margin-bottom:5px">
        <span style="font-size:11px;color:var(--text3);min-width:82px">${e.d}</span>
        <span style="font-size:16px">${e.t==='os'?'🔧':'⛽'}</span>
        <span style="font-size:13px">${e.txt}</span></div>`).join('')
    : '<div class="empty"><div class="empty-ico">📋</div><p>Sem eventos registrados</p></div>'
}

// ── MODAL OS ──
function abrirModalOS(ativoId, planoId){
  document.getElementById('os-data').value = new Date().toISOString().slice(0,10)
  // popular select de ativos
  const sel = document.getElementById('os-ativo')
  sel.innerHTML = ATIVOS.map(a => `<option value="${a.id}" ${a.id===ativoId?'selected':''}>${a.codigo} — ${a.nome}</option>`).join('')
  popularPlanosOS(ativoId, planoId)
  sel.onchange = () => { popularPlanosOS(parseInt(sel.value)); popularReparosOS(parseInt(sel.value)) }
  const selTipo = document.getElementById('os-tipo')
  selTipo.value = planoId ? 'preventiva' : 'corretiva'
  selTipo.onchange = () => alternarBlocoReparo(parseInt(sel.value))
  popularReparosOS(ativoId)
  alternarBlocoReparo(ativoId)
  document.getElementById('os-delta').value = ''
  document.getElementById('os-tecnico').value = USUARIO?.nome || ''
  document.getElementById('os-desc').value = ''
  document.getElementById('modal-os').classList.add('open')
}

function popularPlanosOS(ativoId, preselect){
  const ativo = ATIVOS.find(a => a.id === ativoId)
  const planos = ativo ? PLANOS.filter(p => p.tipo_modelo === ativo.tipo_modelo) : []
  const sel = document.getElementById('os-plano')
  sel.innerHTML = '<option value="">— sem plano (corretiva) —</option>' +
    planos.map(p => `<option value="${p.id}" ${p.id===preselect?'selected':''}>${p.nome} (a cada ${p.intervalo}${p.unidade})</option>`).join('')
  sel.onchange = () => mostrarMateriaisPlano(parseInt(sel.value))
  if(preselect) mostrarMateriaisPlano(preselect)
}

function mostrarMateriaisPlano(planoId){
  const wrap = document.getElementById('os-materiais-wrap')
  const list = document.getElementById('os-materiais-list')
  const pm = PLANO_MATS.filter(p => p.plano_id === planoId)
  if(!pm.length){ wrap.style.display='none'; return }
  wrap.style.display = 'block'
  list.innerHTML = pm.map(p => `<div style="padding:4px 0;border-bottom:1px solid var(--border)">
    ${p.maq_materiais?.nome || '?'} — ${p.quantidade} ${p.maq_materiais?.unidade||'un'}</div>`).join('')
}

// ── diagnóstico na OS corretiva (módulo Reparos) ──
function alternarBlocoReparo(ativoId){
  const corretiva = document.getElementById('os-tipo').value === 'corretiva'
  // sem catálogo (migração 26 ainda não rodou) o bloco nunca aparece
  const mostrar = corretiva && REPAROS.length > 0
  document.getElementById('os-reparo-wrap').style.display = mostrar ? '' : 'none'
  if(mostrar) popularReparosOS(ativoId)
  else mostrarResumoReparo(null)
}

function popularReparosOS(ativoId){
  const sel = document.getElementById('os-reparo')
  if(!sel) return
  const ativo = ATIVOS.find(a => a.id === ativoId)
  // reparo sem modelo vale para qualquer máquina — nunca é filtrado fora
  const lista = REPAROS.filter(r => !r.modelo_id || r.modelo_id === ativo?.modelo_id)
  sel.innerHTML = '<option value="">— sem diagnóstico do catálogo —</option>' +
    lista.map(r => `<option value="${r.id}">${esc(r.sintoma)} → ${esc(r.causa_provavel)}${r.frequencia ? ` (${r.frequencia}×)` : ''}</option>`).join('')
  sel.onchange = () => mostrarResumoReparo(parseInt(sel.value) || null)
  mostrarResumoReparo(null)
}

function mostrarResumoReparo(reparoId){
  const wrap = document.getElementById('os-reparo-resumo-wrap')
  const confirma = document.getElementById('os-reparo-confirma-wrap')
  if(!wrap) return
  if(!reparoId){ wrap.style.display = 'none'; confirma.style.display = 'none'; return }

  const pecas = pecasEssenciaisDoReparo(reparoId)
  const servs = REP_SERVS.filter(x => x.reparo_id === reparoId)
    .map(x => SERVICOS.find(s => s.id === x.servico_id)).filter(Boolean)
  const custo = pecas.reduce((soma, p) => soma + Number(p.mat.preco || 0) * Number(p.quantidade), 0)
  const horas = servs.reduce((soma, s) => soma + Number(s.tempo_padrao_h || 0), 0)
  const falta = pecas.filter(p => p.mat.estoque_atual < p.quantidade)

  wrap.style.display = ''
  confirma.style.display = ''
  document.getElementById('os-reparo-confirmado').checked = true
  document.getElementById('os-reparo-resumo').innerHTML = [
    pecas.map(p => `${esc(p.mat.nome)} — ${p.quantidade} ${esc(p.mat.unidade || 'un')}`).join('<br>') || 'Sem peça vinculada',
    servs.map(s => `${esc(s.nome)} — ${Number(s.tempo_padrao_h || 0).toFixed(1)} h`).join('<br>') || 'Sem serviço vinculado',
    `<strong>Total: R$ ${custo.toFixed(2)} · ${horas.toFixed(1)} h</strong>`,
    falta.length ? `<span style="color:var(--red)">Sem estoque: ${falta.map(p => esc(p.mat.nome)).join(', ')}</span>` : '',
  ].filter(Boolean).join('<br>')
}

async function salvarOS(){
  const ativo_id  = parseInt(document.getElementById('os-ativo').value)
  const plano_id  = parseInt(document.getElementById('os-plano').value) || null
  const tipo      = document.getElementById('os-tipo').value
  const data      = document.getElementById('os-data').value
  const delta     = parseFloat(document.getElementById('os-delta').value) || 0
  const tecnico   = document.getElementById('os-tecnico').value.trim()
  const descricao = document.getElementById('os-desc').value.trim()

  if(!ativo_id || !data){ alert('Preencha a máquina e a data.'); return }

  const ativo = ATIVOS.find(a => a.id === ativo_id)
  const uso_na_os = (ativo?.uso_atual || 0) + delta

  // inserir OS
  // custo das peças do plano
  let custo_pecas = 0
  if(plano_id){
    for(const item of PLANO_MATS.filter(p=>p.plano_id===plano_id)){
      const mat = MATERIAIS.find(m=>m.id===item.material_id)
      if(mat?.preco) custo_pecas += Number(mat.preco) * Number(item.quantidade)
    }
  }
  // diagnóstico do catálogo (só em corretiva, e só se a migração 26 rodou)
  const reparoSel = document.getElementById('os-reparo')
  const reparo_id = (tipo === 'corretiva' && REPAROS.length) ? (parseInt(reparoSel?.value) || null) : null
  const reparo = reparo_id ? REPAROS.find(r => r.id === reparo_id) : null
  const pecasReparo = reparo_id ? pecasEssenciaisDoReparo(reparo_id) : []
  if(reparo) custo_pecas += pecasReparo.reduce((s, p) => s + Number(p.mat.preco || 0) * Number(p.quantidade), 0)

  // as colunas de reparo só entram no payload quando há diagnóstico: assim o
  // insert continua válido mesmo num banco onde a migração 26 não rodou
  const { data: osNova, error: erOS } = await supa.from('maq_os').insert({
    ativo_id, plano_id, tipo,
    status: 'concluida',
    data_abertura: data, data_conclusao: data,
    uso_na_os, tecnico, descricao, custo_pecas,
    ...(reparo ? { reparo_id, sintoma_relatado: reparo.sintoma } : {}),
  }).select('id').single()
  if(erOS){ alert('Erro: ' + erOS.message); return }

  // atualizar horímetro
  if(delta > 0){
    await supa.from('maq_ativos').update({ uso_atual: uso_na_os }).eq('id', ativo_id)
    await supa.from('maq_uso_registros').insert({
      ativo_id, delta, uso_total: uso_na_os, data,
      operador: tecnico, obs: descricao
    })
  }

  // debitar materiais do estoque
  if(plano_id){
    const pm = PLANO_MATS.filter(p => p.plano_id === plano_id)
    for(const item of pm){
      const mat = MATERIAIS.find(m => m.id === item.material_id)
      if(mat){
        const novo = Math.max(0, mat.estoque_atual - item.quantidade)
        await supa.from('maq_materiais').update({ estoque_atual: novo }).eq('id', mat.id)
        await supa.from('maq_estoque_movimentos').insert({
          material_id: mat.id, tipo: 'saida', quantidade: item.quantidade,
          motivo: 'OS preventiva — ' + (PLANOS.find(p=>p.id===plano_id)?.nome||'')
        })
      }
    }
  }

  // debitar as peças essenciais do reparo — mesma mecânica da baixa do plano
  for(const item of pecasReparo){
    const novo = Math.max(0, item.mat.estoque_atual - item.quantidade)
    await supa.from('maq_materiais').update({ estoque_atual: novo }).eq('id', item.mat.id)
    await supa.from('maq_estoque_movimentos').insert({
      material_id: item.mat.id, os_id: osNova?.id || null,
      tipo: 'saida', quantidade: item.quantidade,
      motivo: 'OS corretiva — ' + (reparo?.causa_provavel || ''),
    })
  }

  // É esta chamada que faz o catálogo aprender: a causa confirmada incrementa
  // rep_reparos.frequencia e sobe no ranking do próximo diagnóstico. A RPC é
  // idempotente — repetir na mesma OS falha em vez de contar duas vezes.
  if(reparo && osNova?.id){
    const confirmado = document.getElementById('os-reparo-confirmado')?.checked ?? true
    const { error: erConf } = await supa.rpc('rep_confirmar_reparo', {
      p_os_id: osNova.id, p_confirmado: confirmado,
    })
    // falha aqui não invalida a OS, que já está gravada — só avisa
    if(erConf) alert('OS gravada, mas a confirmação do diagnóstico falhou: ' + erConf.message)
  }

  fecharModal('modal-os')
  await carregarTudo()
}

async function concluirOS(id){
  if(!confirm('Marcar OS como concluída?')) return
  await supa.from('maq_os').update({ status: 'concluida', data_conclusao: new Date().toISOString().slice(0,10) }).eq('id', id)
  await carregarTudo()
}

// ── MODAL ATIVO ──
function abrirModalAtivo(id){
  ATIVO_EDIT_ID = id || null
  const ativo = id ? ATIVOS.find(a => a.id === id) : null
  document.getElementById('modal-ativo-titulo').textContent = ativo ? 'Editar máquina' : 'Nova máquina'
  document.getElementById('at-codigo').value  = ativo?.codigo  || ''
  document.getElementById('at-nome').value    = ativo?.nome    || ''
  document.getElementById('at-cat').value     = ativo?.categoria|| 'rocadeira'
  document.getElementById('at-status').value  = ativo?.status  || 'operante'
  document.getElementById('at-fab').value     = ativo?.fabricante||''
  document.getElementById('at-mod').value     = ativo?.modelo  || ''
  document.getElementById('at-pat').value     = ativo?.patrimonio||''
  document.getElementById('at-uso').value     = ativo?.uso_atual||0
  document.getElementById('at-uni').value     = ativo?.unidade_uso||'h'
  document.getElementById('at-local').value   = ativo?.local   || ''
  document.getElementById('at-obs').value     = ativo?.obs     || ''
  document.getElementById('modal-ativo').classList.add('open')
}

async function salvarAtivo(){
  const campos = {
    codigo:      document.getElementById('at-codigo').value.trim().toUpperCase(),
    nome:        document.getElementById('at-nome').value.trim(),
    categoria:   document.getElementById('at-cat').value,
    status:      document.getElementById('at-status').value,
    fabricante:  document.getElementById('at-fab').value.trim(),
    modelo:      document.getElementById('at-mod').value.trim(),
    patrimonio:  document.getElementById('at-pat').value.trim(),
    uso_atual:   parseFloat(document.getElementById('at-uso').value) || 0,
    unidade_uso: document.getElementById('at-uni').value,
    local:       document.getElementById('at-local').value.trim(),
    obs:         document.getElementById('at-obs').value.trim(),
  }
  if(!campos.nome){ alert('Nome obrigatório.'); return }

  if(ATIVO_EDIT_ID){
    const { error } = await supa.from('maq_ativos').update(campos).eq('id', ATIVO_EDIT_ID)
    if(error){ alert('Erro: '+error.message); return }
  } else {
    const { error } = await supa.from('maq_ativos').insert(campos)
    if(error){ alert('Erro: '+error.message); return }
  }
  fecharModal('modal-ativo')
  await carregarTudo()
}

// ── MODAL MATERIAL ──
function abrirModalMaterial(){
  ['mat-cod','mat-nome','mat-uni'].forEach(id => {
    document.getElementById(id).value = id==='mat-uni'?'un':''
  })
  document.getElementById('mat-tipo').value = 'consumivel'
  document.getElementById('mat-min').value  = '2'
  document.getElementById('modal-material').classList.add('open')
}

async function salvarMaterial(){
  const nome = document.getElementById('mat-nome').value.trim()
  if(!nome){ alert('Nome obrigatório.'); return }
  const { error } = await supa.from('maq_materiais').insert({
    codigo:          document.getElementById('mat-cod').value.trim().toUpperCase() || null,
    nome,
    tipo:            document.getElementById('mat-tipo').value,
    unidade:         document.getElementById('mat-uni').value.trim() || 'un',
    estoque_minimo:  parseFloat(document.getElementById('mat-min').value) || 0,
    estoque_atual:   0,
  })
  if(error){ alert('Erro: '+error.message); return }
  fecharModal('modal-material')
  await carregarTudo()
}

// ── MODAL MOVIMENTO ──
function abrirModalMovimento(){
  const sel = document.getElementById('mov-material')
  sel.innerHTML = MATERIAIS.map(m => `<option value="${m.id}">${m.nome} (${m.estoque_atual} ${m.unidade})</option>`).join('')
  document.getElementById('mov-qtd').value    = '1'
  document.getElementById('mov-motivo').value = ''
  document.getElementById('modal-movimento').classList.add('open')
}

async function salvarMovimento(){
  const material_id = parseInt(document.getElementById('mov-material').value)
  const quantidade  = parseFloat(document.getElementById('mov-qtd').value)
  const motivo      = document.getElementById('mov-motivo').value.trim()
  if(!material_id || !quantidade){ alert('Preencha material e quantidade.'); return }

  const mat = MATERIAIS.find(m => m.id === material_id)
  const novo = (mat?.estoque_atual || 0) + quantidade
  await supa.from('maq_materiais').update({ estoque_atual: novo }).eq('id', material_id)
  await supa.from('maq_estoque_movimentos').insert({ material_id, tipo: 'entrada', quantidade, motivo })
  fecharModal('modal-movimento')
  await carregarTudo()
}

function abrirModalArea(){
  ;['area-codigo','area-nome','area-m2','area-periodicidade','area-localizacao','area-obs'].forEach(id=>document.getElementById(id).value='')
  document.getElementById('area-tipo').value='corte'
  document.getElementById('modal-area').classList.add('open')
}

async function salvarArea(){
  const nome = document.getElementById('area-nome').value.trim()
  if(!nome){ alert('Informe o nome da área.'); return }
  const { error } = await supa.from('maq_areas').insert({
    codigo: document.getElementById('area-codigo').value.trim().toUpperCase() || null,
    nome,
    tipo: document.getElementById('area-tipo').value,
    area_m2: parseFloat(document.getElementById('area-m2').value) || null,
    periodicidade_dias: parseInt(document.getElementById('area-periodicidade').value) || null,
    localizacao: document.getElementById('area-localizacao').value.trim(),
    obs: document.getElementById('area-obs').value.trim(),
  })
  if(error){ alert('Erro ao salvar área: '+error.message); return }
  fecharModal('modal-area'); await carregarTudo()
}

function abrirModalOperacao(){
  document.getElementById('operacao-area').innerHTML = '<option value="">— selecione —</option>'+AREAS.map(area=>`<option value="${area.id}">${esc(area.codigo || '')} ${esc(area.nome)}</option>`).join('')
  document.getElementById('operacao-ativo').innerHTML = '<option value="">— selecione —</option>'+ATIVOS.filter(ativo=>ativo.ativo!==false).map(ativo=>`<option value="${ativo.id}">${esc(ativo.codigo)} — ${esc(ativo.nome)}</option>`).join('')
  document.getElementById('operacao-tipo').value='corte'
  document.getElementById('operacao-data').value=new Date().toISOString().slice(0,10)
  document.getElementById('operacao-operador').value=USUARIO?.nome || ''
  document.getElementById('operacao-obs').value=''
  document.getElementById('modal-operacao').classList.add('open')
}

async function salvarOperacao(){
  const operacao = {
    area_id: document.getElementById('operacao-area').value || null,
    ativo_id: parseInt(document.getElementById('operacao-ativo').value) || null,
    tipo_servico: document.getElementById('operacao-tipo').value,
    data_programada: document.getElementById('operacao-data').value,
    operador: document.getElementById('operacao-operador').value.trim(),
    obs: document.getElementById('operacao-obs').value.trim(),
  }
  const erros = OperacoesMaq.validarOperacao(operacao)
  if(erros.length){ alert(erros[0]); return }
  const { error } = await supa.from('maq_operacoes').insert(operacao)
  if(error){ alert('Erro ao programar operação: '+error.message); return }
  fecharModal('modal-operacao'); await carregarTudo()
}

function abrirConcluirOperacao(id){
  const operacao = OPERACOES.find(item=>item.id===id)
  if(!operacao) return
  OPERACAO_CONCLUIR_ID=id
  document.getElementById('concluir-operacao-resumo').textContent = `${operacao.maq_areas?.nome || 'Área'} · ${operacao.maq_ativos?.codigo || 'Máquina'}`
  document.getElementById('concluir-horas').value=''
  document.getElementById('concluir-area').value=operacao.maq_areas?.area_m2 || ''
  document.getElementById('concluir-combustivel').value=''
  document.getElementById('concluir-obs').value=operacao.obs || ''
  document.getElementById('modal-concluir-operacao').classList.add('open')
}

async function concluirOperacao(){
  const horas = parseFloat(document.getElementById('concluir-horas').value)
  try { OperacoesMaq.projetarUsoTotal(0,horas) }
  catch(error){ alert(error.message); return }
  const { error } = await supa.rpc('concluir_maq_operacao',{
    p_operacao_id: OPERACAO_CONCLUIR_ID,
    p_horas_utilizadas: horas,
    p_area_executada_m2: parseFloat(document.getElementById('concluir-area').value) || null,
    p_combustivel_utilizado: parseFloat(document.getElementById('concluir-combustivel').value) || null,
    p_observacoes: document.getElementById('concluir-obs').value.trim() || null,
  })
  if(error){ alert('Erro ao concluir operação: '+error.message); return }
  fecharModal('modal-concluir-operacao'); OPERACAO_CONCLUIR_ID=null; await carregarTudo()
}

// ── utils ──
function fecharModal(id){ document.getElementById(id).classList.remove('open') }
function fecharAoClicarFora(){
  document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => {
    if(e.target === o) o.classList.remove('open')
  }))
}

// ── publicação no objeto global — obrigatória em módulo ES para que os
// handlers inline (onclick/onchange no HTML e em templates literais) continuem
// resolvendo os nomes. Lista extraída dos dois arquivos, sem os quatro nomes
// do login antigo removido acima.
function exporNoWindow(){
  Object.assign(window, {
    abrirConcluirOperacao,
    abrirModalAbastecimento,
    abrirModalArea,
    abrirModalAtivo,
    abrirModalMaterial,
    abrirModalMovimento,
    abrirModalOperacao,
    abrirModalOS,
    concluirOperacao,
    concluirOS,
    exportarComprasCSV,
    fecharModal,
    iniciarOperacao,
    navegarAgenda,
    renderAtivos,
    sair,
    salvarAbastecimento,
    salvarArea,
    salvarAtivo,
    salvarMaterial,
    salvarMovimento,
    salvarOperacao,
    salvarOS,
    trocarView,
  })
}

function mostrarErroBoot(error){
  document.getElementById('login-screen').innerHTML = `
    <div class="callout co-red" style="max-width:560px">
      <strong>Falha ao iniciar o módulo Máquinas.</strong><br>
      ${esc(error.message || String(error))}
    </div>
  `
}

async function boot(){
  exporNoWindow()

  aplicarShell({
    nome: 'Máquinas',
    accent: '#c9a84c',
    versao: '1.0',
    navItems: [
      { id: 'painel', icone: '📊', label: 'Painel', ativo: true },
      { id: 'ativos', icone: '🔧', label: 'Máquinas' },
      { id: 'vencimentos', icone: '📅', label: 'Vencimentos' },
      { id: 'os', icone: '📋', label: 'OS' },
      { id: 'operacoes', icone: '▶', label: 'Operações' },
      { id: 'agenda', icone: '▦', label: 'Agenda' },
      { id: 'materiais', icone: '📦', label: 'Estoque' },
      { id: 'consumo', icone: '⛽', label: 'Consumo' },
      { id: 'ciclo', icone: '📈', label: 'Ciclo de vida' },
      { id: 'compras', icone: '🛒', label: 'Lista de compras' },
    ],
  })

  fecharAoClicarFora()

  try {
    supa = await criarClienteSupabase()
  } catch (error) {
    mostrarErroBoot(error)
    return
  }

  auth = new Auth(supa, { appNome: 'Máquinas', appIcone: '⚙️' })
  auth.onLogin(usuario => {
    USUARIO = usuario
    mostrarApp()
  })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}

boot()
