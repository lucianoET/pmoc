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
// Itens de manutenção por OS (migração 29). Mesma tolerância do catálogo de
// reparos: sem a migração a lista fica vazia, a OS volta a ser de um item só e
// nada quebra.
let OS_ITENS = []
// Peças e serviços escolhidos na OS, e a configuração do módulo (migração 30).
// Mesma tolerância: sem a migração as listas ficam vazias, o custo volta a ser
// o número digitado à mão e nada quebra.
let OS_MATERIAIS = [], OS_SERVICOS = [], CONFIG = {}
let USUARIO = null
let ATIVO_EDIT_ID = null
let OPERACAO_CONCLUIR_ID = null
// máquina aberta no popup de vencimentos e planos que o usuário marcou lá
let VENC_ATIVO_ID = null
let OS_PLANOS_MARCADOS = []
// OS aberta no modal de detalhe
let OS_DETALHE_ID = null
// material com a linha aberta em edição na aba de estoque
let MATERIAL_EDIT_ID = null
// máquina aberta na ficha e comentários por máquina (migração 32)
let FICHA_ATIVO_ID = null
let COMENTARIOS = []
// listas de peças e serviços em edição no modal de detalhe da OS — vivem em
// memória e só vão ao banco no Salvar
let OSD_PECAS = [], OSD_SERVICOS = []
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
  await carregarItensOS()
  await carregarCustosOS()
  await carregarComentarios()
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

// ── itens de manutenção por OS (migração 29) ──
// Também fora do Promise.all: num banco onde a migração 29 não rodou, a lista
// fica vazia e cada OS volta a ser de um item só, pelo maq_os.plano_id de
// sempre. Nenhuma tela quebra — elas só mostram menos.
async function carregarItensOS(){
  const { data, error } = await supa
    .from('maq_os_itens')
    .select('*, maq_planos(nome,intervalo,unidade)')
  OS_ITENS = error ? [] : (data || [])
}

// ── peças, serviços e configuração (migração 30) ──
// Fora do Promise.all pelo mesmo motivo das duas cargas acima: sem a migração
// as listas ficam vazias e a OS volta a se comportar como antes.
async function carregarCustosOS(){
  const [mt, sv, cf] = await Promise.all([
    supa.from('maq_os_materiais').select('*, maq_materiais(nome,unidade,preco,estoque_atual)'),
    supa.from('maq_os_servicos').select('*, rep_servicos(nome,especialidade,tempo_padrao_h)'),
    supa.from('maq_config').select('*'),
  ])
  OS_MATERIAIS = mt.error ? [] : (mt.data || [])
  OS_SERVICOS  = sv.error ? [] : (sv.data || [])
  CONFIG = cf.error ? {} : Object.fromEntries((cf.data || []).map(l => [l.chave, l.valor]))
}

// valor da hora-homem do módulo. Sem valor informado devolve null — e null não
// é zero: zero afirmaria que a mão de obra não custa nada, null diz que ninguém
// informou ainda, e a tela avisa.
function valorHoraPadrao(){
  const bruto = CONFIG.valor_hora_padrao
  if(bruto === null || bruto === undefined || String(bruto).trim() === '') return null
  const numero = Number(bruto)
  return Number.isFinite(numero) && numero >= 0 ? numero : null
}

// ── custos derivados das listas ──
// A regra pedida: custo de peça é quantidade × preço; custo de mão de obra é
// horas × valor da hora. Nenhum dos dois é digitado à mão.
function custoPecasDaOS(osId){
  return OS_MATERIAIS.filter(m => m.os_id === osId)
    .reduce((soma, m) => soma + Number(m.quantidade || 0) * Number(m.preco_unit || 0), 0)
}

function horasDaOS(osId){
  return OS_SERVICOS.filter(s => s.os_id === osId)
    .reduce((soma, s) => soma + Number(s.horas || 0), 0)
}

function custoMaoDeObraDaOS(osId){
  return OS_SERVICOS.filter(s => s.os_id === osId)
    .reduce((soma, s) => soma + Number(s.horas || 0) * Number(s.valor_hora || 0), 0)
}

// ── comentários por máquina (migração 32) ──
// Fora do Promise.all pelo mesmo motivo das outras cargas tolerantes: sem a
// migração a lista fica vazia e a ficha só não mostra o diário de bordo.
async function carregarComentarios(){
  const { data, error } = await supa
    .from('maq_ativo_comentarios')
    .select('*')
    .order('criado_em', { ascending: false })
  COMENTARIOS = error ? [] : (data || [])
}

// itens de uma OS, com fallback para o plano único de maq_os quando a
// migração 29 ainda não rodou
function itensDaOS(os){
  const itens = OS_ITENS.filter(i => i.os_id === os.id)
  if(itens.length) return itens
  if(!os.plano_id) return []
  // O plano vem de PLANOS, não do join da OS: o join traz só o nome, e a tela
  // precisa também de intervalo e unidade — sem isso o detalhe escrevia
  // "a cada undefined".
  return [{
    id: null, os_id: os.id, plano_id: os.plano_id,
    concluido: os.status === 'concluida',
    maq_planos: PLANOS.find(p => p.id === os.plano_id) || os.maq_planos || null,
  }]
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

  const abertas = OS_LIST.filter(o => !['concluida','cancelada'].includes(o.status))
  document.getElementById('kpi-os-abertas').textContent = abertas.length

  // O painel é resumo, não relatório: cada bloco mostra os primeiros itens e
  // manda o resto para a aba própria. Sem o corte, com 28 máquinas e 34
  // materiais a página virava três telas de rolagem antes do primeiro dado útil.
  const TETO = 5

  // OS em aberto — o bloco novo, que só faz sentido depois de a OS ganhar
  // situação: antes toda ordem nascia concluída e esta lista seria sempre vazia
  pintarResumo({
    alvo: 'painel-os',
    itens: abertas,
    vazio: { icone: '✅', texto: 'Nenhuma OS em aberto' },
    aba: 'os',
    linha: o => ({
      nome: `${esc(o.maq_ativos?.codigo || '?')} — ${esc(itensDaOS(o)[0]?.maq_planos?.nome || o.tipo)}`,
      detalhe: `aberta em ${esc(o.data_abertura || '—')}${o.tecnico ? ' · ' + esc(o.tecnico) : ''}`,
      selo: `<span class="badge ${badgeStatusOS(o.status)}">${rotuloStatusOS(o.status)}</span>`,
      acao: `abrirDetalheOS('${o.id}')`,
    }),
    teto: TETO,
  })

  pintarResumo({
    alvo: 'painel-inop',
    itens: ATIVOS.filter(a => a.status !== 'operante'),
    vazio: { icone: '✅', texto: 'Todas operantes' },
    aba: 'ativos',
    linha: a => ({
      nome: `${esc(a.codigo)} — ${esc(a.nome)}`,
      detalhe: esc(a.local || '—'),
      selo: `<span class="badge ${a.status==='inoperante'?'b-red':'b-warn'}">${a.status.toUpperCase()}</span>`,
      acao: `abrirModalAtivo(${a.id})`,
    }),
    teto: TETO,
  })

  pintarResumo({
    alvo: 'painel-mats',
    itens: MATERIAIS.filter(m => m.estoque_atual < m.estoque_minimo),
    vazio: { icone: '✅', texto: 'Estoque OK' },
    aba: 'materiais',
    linha: m => ({
      nome: esc(m.nome),
      detalhe: `${m.estoque_atual} ${esc(m.unidade)} · mín: ${m.estoque_minimo}`,
      selo: '<span class="badge b-red">BAIXO</span>',
      acao: `editarMaterial(${m.id})`,
    }),
    teto: TETO,
  })
}

// desenha um bloco de resumo do painel: até `teto` linhas e, se sobrou coisa,
// um botão que leva à aba onde a lista inteira vive
function pintarResumo({ alvo, itens, vazio, aba, linha, teto }){
  const div = document.getElementById(alvo)
  if(!div) return
  if(!itens.length){
    div.innerHTML = `<div class="empty"><div class="empty-ico">${vazio.icone}</div><p>${vazio.texto}</p></div>`
    return
  }
  const visiveis = itens.slice(0, teto)
  const restantes = itens.length - visiveis.length
  div.innerHTML = visiveis.map(item => {
    const l = linha(item)
    return `<div class="mat-alert" onclick="${l.acao}" style="cursor:pointer">
      <div class="mat-info">
        <div class="mat-nome">${l.nome}</div>
        <div class="mat-stock">${l.detalhe}</div>
      </div>
      ${l.selo}
    </div>`
  }).join('') + (restantes > 0
    ? `<button class="btn btn-s btn-sm" style="width:100%;margin-top:2px"
         onclick="irParaAba('${aba}')">Ver os outros ${restantes} →</button>`
    : '')
}

// leva o usuário à aba pedida pelo mesmo caminho que o clique na faixa de abas
function irParaAba(id){
  const botao = document.querySelector(`.nav-btn[data-view="${id}"]`)
  if(botao) botao.click()
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">Nenhuma máquina encontrada</td></tr>'
    return
  }
  const statusBadge = s => s==='operante'?'b-ok':s==='inoperante'?'b-red':'b-warn'
  tbody.innerHTML = lista.map(a => `
    <tr onclick="abrirFichaAtivo(${a.id})">
      <td class="hi" style="color:${a.cor||'var(--text)'}">${a.emoji||''} ${a.codigo||'—'}</td>
      <td class="hi">${a.nome}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span>${a.uso_atual} ${a.unidade_uso}</span>
        </div>
      </td>
      <td><span class="badge ${statusBadge(a.status)}">${a.status.toUpperCase()}</span></td>
      <td>${a.local||'—'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-s btn-sm" onclick="event.stopPropagation();abrirModalUso(${a.id})" title="Registrar horas ou quilometragem">USO</button>
          <button class="btn btn-s btn-sm" onclick="event.stopPropagation();abrirModalOS(${a.id})" title="Abrir ordem de serviço">OS</button>
        </div>
      </td>
    </tr>`).join('')
}

// ── MODAL: REGISTRO DE USO ──
// Anotar horímetro não é ordem de serviço: grava em maq_uso_registros e
// atualiza maq_ativos.uso_atual, e para por aí. Antes só existia embutido no
// modal de OS, o que obrigava a criar uma OS de mentira para anotar horas.
function abrirModalUso(ativoId){
  const sel = document.getElementById('uso-ativo')
  sel.innerHTML = ATIVOS.filter(a => a.status !== 'baixado')
    .map(a => `<option value="${a.id}" ${a.id===ativoId?'selected':''}>${esc(a.codigo)} — ${esc(a.nome)}</option>`).join('')
  sel.onchange = () => atualizarContextoUso()

  document.getElementById('uso-data').value = new Date().toISOString().slice(0,10)
  document.getElementById('uso-delta').value = ''
  document.getElementById('uso-operador').value = USUARIO?.nome || ''
  document.getElementById('uso-obs').value = ''
  const campoDelta = document.getElementById('uso-delta')
  campoDelta.oninput = () => atualizarContextoUso()

  atualizarContextoUso()
  document.getElementById('modal-uso').classList.add('open')
}

// mostra o uso atual e o total que ficará gravado — o operador confere o
// número antes de salvar, em vez de descobrir o erro no relatório
function atualizarContextoUso(){
  const ativo = ATIVOS.find(a => a.id === parseInt(document.getElementById('uso-ativo').value))
  if(!ativo) return
  const unidade = ativo.unidade_uso || 'h'
  const delta = parseFloat(document.getElementById('uso-delta').value) || 0
  document.getElementById('uso-atual').textContent = `${ativo.uso_atual} ${unidade}`
  document.getElementById('uso-delta-label').textContent =
    unidade === 'km' ? 'Quilômetros rodados *' : `Uso no período (${unidade}) *`
  document.getElementById('uso-previsto').textContent = delta > 0
    ? `Novo total: ${(Number(ativo.uso_atual) + delta).toFixed(1)} ${unidade}`
    : '—'
}

async function salvarUso(){
  const ativo_id = parseInt(document.getElementById('uso-ativo').value)
  const delta    = parseFloat(document.getElementById('uso-delta').value)
  const data     = document.getElementById('uso-data').value
  const operador = document.getElementById('uso-operador').value.trim()
  const obs      = document.getElementById('uso-obs').value.trim()

  if(!ativo_id || !data){ alert('Preencha a máquina e a data.'); return }
  if(!(delta > 0)){ alert('Informe o uso do período — precisa ser maior que zero.'); return }

  const ativo = ATIVOS.find(a => a.id === ativo_id)
  const uso_total = Number(ativo?.uso_atual || 0) + delta

  const { error: erUso } = await supa.from('maq_uso_registros').insert({
    ativo_id, delta, uso_total, data, operador, obs,
  })
  if(erUso){ alert('Erro: ' + erUso.message); return }

  const { error: erAtivo } = await supa.from('maq_ativos').update({ uso_atual: uso_total }).eq('id', ativo_id)
  if(erAtivo){ alert('Erro: ' + erAtivo.message); return }

  fecharModal('modal-uso')
  await carregarTudo()
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

// Agrupa os itens por máquina. Antes a aba desenhava um cartão por item —
// 28 máquinas × N planos cada — e a página passava de vinte telas de rolagem.
// Agora é um cartão por máquina, com o pior item à vista; os demais ficam no
// popup, onde também se escolhe o que entra na OS.
function vencimentosPorMaquina(){
  const porAtivo = new Map()
  for(const item of calcVencimentos()){
    if(!porAtivo.has(item.ativo.id)) porAtivo.set(item.ativo.id, { ativo: item.ativo, itens: [] })
    porAtivo.get(item.ativo.id).itens.push(item)
  }
  const grupos = [...porAtivo.values()].map(grupo => ({
    ...grupo,
    vencidos: grupo.itens.filter(i => i.pct >= 100).length,
    proximos: grupo.itens.filter(i => i.pct >= 80 && i.pct < 100).length,
    pior: Math.max(...grupo.itens.map(i => i.pct)),
  }))
  // a máquina mais crítica primeiro, e entre iguais a que tem mais itens vencidos
  return grupos.sort((a, b) => b.pior - a.pior || b.vencidos - a.vencidos)
}

function renderVencimentos(){
  const grupos = vencimentosPorMaquina()
  const div = document.getElementById('venc-content')
  if(!grupos.length){
    div.innerHTML = '<div class="callout co-ok">Nenhum plano de manutenção configurado para os ativos cadastrados.</div>'
    return
  }
  const card = g => {
    const cls = g.pior >= 100 ? 'urgente' : g.pior >= 80 ? 'proximo' : 'ok'
    const cor = g.pior >= 100 ? 'var(--red)' : g.pior >= 80 ? 'var(--yellow)' : 'var(--green)'
    const selo = g.vencidos
      ? `<span class="badge b-red">${g.vencidos} vencido${g.vencidos>1?'s':''}</span>`
      : g.proximos
      ? `<span class="badge b-warn">${g.proximos} próximo${g.proximos>1?'s':''}</span>`
      : '<span class="badge b-ok">EM DIA</span>'
    return `<div class="venc-card ${cls}" onclick="abrirVencMaquina(${g.ativo.id})" style="cursor:pointer">
      <div class="venc-ativo">${esc(g.ativo.emoji||'')} ${esc(g.ativo.codigo)} — ${esc(g.ativo.nome)}</div>
      <div class="venc-plano">${g.itens.length} ${g.itens.length>1?'itens':'item'} de manutenção · ${g.ativo.uso_atual} ${esc(g.ativo.unidade_uso||'h')}</div>
      <div class="uso-bar-wrap" style="margin:8px 0">
        <div class="uso-bar" style="width:${Math.min(100,g.pior)}%;background:${cor}"></div>
      </div>
      <div class="venc-progress">
        ${selo}
        <button class="btn btn-s btn-sm" style="margin-left:auto"
          onclick="event.stopPropagation();abrirVencMaquina(${g.ativo.id})">Ver itens</button>
      </div>
    </div>`
  }
  div.innerHTML = '<div class="venc-grid">' + grupos.map(card).join('') + '</div>'
}

// ── POPUP: itens de manutenção de uma máquina ──
function abrirVencMaquina(ativoId){
  VENC_ATIVO_ID = ativoId
  const ativo = ATIVOS.find(a => a.id === ativoId)
  const itens = calcVencimentos().filter(i => i.ativo.id === ativoId)

  document.getElementById('modal-venc-titulo').textContent =
    `${ativo?.codigo || '?'} — ${ativo?.nome || ''}`

  document.getElementById('venc-itens').innerHTML = itens.map(v => {
    const cor = v.pct >= 100 ? 'var(--red)' : v.pct >= 80 ? 'var(--yellow)' : 'var(--green)'
    const situacao = v.pct >= 100
      ? `<span class="badge b-red">VENCIDO — ${Math.abs(v.falta).toFixed(0)} ${esc(v.plano.unidade)} atrás</span>`
      : `<span class="badge ${v.pct>=80?'b-warn':'b-ok'}">Falta ${v.falta.toFixed(0)} ${esc(v.plano.unidade)}</span>`
    // itens já vencidos ou próximos vêm marcados: é o que o mecânico vai fazer
    const marcado = v.pct >= 80 ? 'checked' : ''
    return `<label class="panel-card" style="display:block;cursor:pointer">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <input type="checkbox" class="venc-check" value="${v.plano.id}" ${marcado}
          onchange="atualizarSelecaoVenc()" style="width:auto;margin-top:3px"/>
        <div style="flex:1">
          <div class="hi" style="font-size:13px;color:var(--text);font-weight:500">${esc(v.plano.nome)}</div>
          <div style="font-size:12px;color:var(--text3);margin:2px 0 6px">a cada ${v.plano.intervalo} ${esc(v.plano.unidade)}</div>
          <div class="uso-bar-wrap"><div class="uso-bar" style="width:${Math.min(100,v.pct)}%;background:${cor}"></div></div>
          <div style="margin-top:6px">${situacao}</div>
        </div>
      </div>
    </label>`
  }).join('')

  atualizarSelecaoVenc()
  document.getElementById('modal-venc').classList.add('open')
}

function marcarTodosVenc(marcar){
  document.querySelectorAll('.venc-check').forEach(c => { c.checked = marcar })
  atualizarSelecaoVenc()
}

function planosMarcadosNoVenc(){
  return [...document.querySelectorAll('.venc-check:checked')].map(c => parseInt(c.value))
}

function atualizarSelecaoVenc(){
  const n = planosMarcadosNoVenc().length
  document.getElementById('venc-selecao').textContent =
    n === 0 ? 'Nenhum item marcado' : `${n} ${n>1?'itens':'item'} marcado${n>1?'s':''}`
}

// leva os itens marcados para o modal de OS — uma OS, vários itens
function abrirOSDosItensMarcados(){
  const planos = planosMarcadosNoVenc()
  if(!planos.length){ alert('Marque ao menos um item de manutenção.'); return }
  const ativoId = VENC_ATIVO_ID
  fecharModal('modal-venc')
  abrirModalOS(ativoId, planos[0], planos)
}

// ── OS ──
// peças que faltam no estoque para uma OS que ainda não executou — é o sinal
// de "necessidade de material" da lista. Depois que a execução começou (ou
// terminou), a pergunta perde o sentido: as peças já saíram da prateleira.
function faltasDaOS(os){
  if(['em_andamento','concluida','cancelada'].includes(os.status)) return []
  return pecasParaBaixa(os).filter(p => {
    const mat = MATERIAIS.find(m => m.id === p.material_id)
    return mat && Number(mat.estoque_atual) < Number(p.quantidade)
  })
}

function renderOS(){
  const tbody = document.getElementById('tb-os')
  const filtro = document.getElementById('filtro-os')?.value || ''

  let lista = OS_LIST
  if(filtro === 'falta') lista = lista.filter(o => faltasDaOS(o).length > 0)
  else if(filtro) lista = lista.filter(o => o.status === filtro)

  if(!lista.length){
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">Nenhuma OS nesta situação</td></tr>'
    return
  }
  tbody.innerHTML = lista.slice(0,100).map(o => {
    const itens = itensDaOS(o)
    // uma OS com vários itens mostra o primeiro e quantos mais existem, em vez
    // de uma célula quilométrica
    const servico = itens.length > 1
      ? `${esc(itens[0].maq_planos?.nome || 'Item')} +${itens.length - 1}`
      : esc(itens[0]?.maq_planos?.nome || (o.tipo === 'uso' ? 'Registro de uso' : 'Corretiva'))
    const proxima = proximoStatus(o.status)

    const faltas = faltasDaOS(o)
    const pecas = pecasParaBaixa(o)
    const material = ['em_andamento','concluida','cancelada'].includes(o.status) || !pecas.length
      ? '<span style="color:var(--text3)">—</span>'
      : faltas.length
      ? `<span class="badge b-red" title="${esc(faltas.map(f => MATERIAIS.find(m => m.id === f.material_id)?.nome).filter(Boolean).join(', '))}">⚠ falta ${faltas.length}</span>`
      : '<span class="badge b-ok">EM ESTOQUE</span>'

    return `<tr onclick="abrirDetalheOS('${o.id}')" style="cursor:pointer">
      <td>${esc(o.data_abertura||'—')}</td>
      <td class="hi">${esc(o.maq_ativos?.codigo||'?')} — ${esc(o.maq_ativos?.nome||'?')}</td>
      <td><span class="badge ${badgeTipoOS(o.tipo)}">${o.tipo.toUpperCase()}</span></td>
      <td>${servico}</td>
      <td>${material}</td>
      <td>${esc(o.tecnico||'—')}</td>
      <td><span class="badge ${badgeStatusOS(o.status)}">${rotuloStatusOS(o.status)}</span></td>
      <td>${proxima
        ? `<button class="btn btn-p btn-sm" onclick="event.stopPropagation();avancarOS('${o.id}')">${proxima.acao}</button>`
        : '—'}</td>
    </tr>`
  }).join('')
}

// ── ciclo de vida da OS ──
// A lista fechada vem do banco (maq_os.status, migração 01 alargada pela 31).
// Estes rótulos são só a tradução para a tela — o vocabulário do banco não muda.
const STATUS_OS = {
  pendente:     { rotulo: 'ABERTA',        badge: 'b-warn'   },
  delineamento: { rotulo: 'DELINEAMENTO',  badge: 'b-accent' },
  espera:       { rotulo: 'EM ESPERA',     badge: 'b-gold'   },
  em_andamento: { rotulo: 'EM EXECUÇÃO',   badge: 'b-blue'   },
  concluida:    { rotulo: 'CONCLUÍDA',     badge: 'b-ok'     },
  cancelada:    { rotulo: 'CANCELADA',     badge: 'b-red'    },
}

function rotuloStatusOS(status){ return STATUS_OS[status]?.rotulo || String(status).toUpperCase() }
function badgeStatusOS(status){ return STATUS_OS[status]?.badge || 'b-blue' }
function badgeTipoOS(tipo){ return tipo==='preventiva'?'b-blue':tipo==='corretiva'?'b-red':'b-ok' }

// O fluxo da oficina: aberta (recepção) → delineamento (diagnóstico com
// materiais e serviços lançados) → espera (aguardando material ou técnico) →
// execução (estoque desce aqui) → concluída. Cancelada e concluída são finais.
function proximoStatus(status){
  if(status === 'pendente')     return { status: 'delineamento', acao: 'Delinear' }
  if(status === 'delineamento') return { status: 'espera',       acao: 'Encerrar delineamento' }
  if(status === 'espera')       return { status: 'em_andamento', acao: 'Iniciar execução' }
  if(status === 'em_andamento') return { status: 'concluida',    acao: 'Concluir' }
  return null
}

async function avancarOS(id){
  const os = OS_LIST.find(o => o.id === id)
  const proxima = os && proximoStatus(os.status)
  if(!proxima) return
  if(proxima.status === 'concluida'){ await concluirOS(id); return }

  const payload = { status: proxima.status }

  // encerrar o delineamento registra quem diagnosticou e quando — é o que a
  // oficina audita depois ("quem disse que precisava dessas peças?")
  if(proxima.status === 'espera'){
    const pecas = OS_MATERIAIS.filter(m => m.os_id === id)
    const servicos = OS_SERVICOS.filter(s => s.os_id === id)
    if(!pecas.length && !servicos.length &&
       !confirm('Nenhum material ou serviço foi lançado no delineamento. Encerrar mesmo assim?')) return
    payload.delineado_por = USUARIO?.nome || os.tecnico || null
    payload.delineado_em = new Date().toISOString()
  }

  if(proxima.status === 'em_andamento' &&
     !confirm('Iniciar a execução? Os materiais da OS serão descontados do estoque agora.')) return

  const { error } = await supa.from('maq_os').update(payload).eq('id', id)
  if(error){ alert('Erro: ' + error.message); return }

  // a baixa acontece no início da execução: a peça sai da prateleira quando o
  // serviço começa, não quando termina
  if(proxima.status === 'em_andamento'){
    const reparo = os.reparo_id ? REPAROS.find(r => r.id === os.reparo_id) : null
    await baixarPecasDaOS(id, pecasParaBaixa(os), reparo)
  }
  await carregarTudo()
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
  const campoHora = document.getElementById('cfg-valor-hora')
  // não sobrescreve o que o usuário está digitando agora
  if(campoHora && document.activeElement !== campoHora){
    campoHora.value = valorHoraPadrao() ?? ''
  }
  aplicarPermissoesConfig()

  const tbody = document.getElementById('tb-materiais')
  if(!MATERIAIS.length){
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">Nenhum material cadastrado</td></tr>'
    return
  }
  tbody.innerHTML = MATERIAIS.map(m => {
    const ok = m.estoque_atual >= m.estoque_minimo
    const pct = m.estoque_minimo > 0 ? Math.min(100, Math.round((m.estoque_atual/m.estoque_minimo)*100)) : 100

    // linha em edição: os três números que mudam no dia a dia viram campo, e o
    // resto da linha continua igual, para não perder a referência de qual
    // material está sendo mexido
    if(MATERIAL_EDIT_ID === m.id){
      return `<tr>
        <td class="hi">${esc(m.codigo||'—')}</td>
        <td>${esc(m.nome)}</td>
        <td><span class="badge b-blue">${esc(m.tipo.toUpperCase())}</span></td>
        <td><input type="number" id="ed-atual" value="${m.estoque_atual}" min="0" step="0.5" style="width:88px"/></td>
        <td><input type="number" id="ed-minimo" value="${m.estoque_minimo}" min="0" step="0.5" style="width:88px"/></td>
        <td><input type="number" id="ed-preco" value="${m.preco ?? ''}" min="0" step="0.01" placeholder="0,00" style="width:96px"/></td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-p btn-sm" onclick="salvarLinhaMaterial(${m.id})">Salvar</button>
            <button class="btn btn-s btn-sm" onclick="cancelarEdicaoMaterial()">✕</button>
          </div>
        </td>
      </tr>`
    }

    return `<tr>
      <td class="hi">${esc(m.codigo||'—')}</td>
      <td>${esc(m.nome)}</td>
      <td><span class="badge b-blue">${esc(m.tipo.toUpperCase())}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span>${m.estoque_atual} ${esc(m.unidade)}</span>
          <div class="uso-bar-wrap" style="width:60px">
            <div class="uso-bar" style="width:${pct}%;background:${ok?'var(--green)':'var(--red)'}"></div>
          </div>
        </div>
      </td>
      <td>${m.estoque_minimo} ${esc(m.unidade)}</td>
      <td>${m.preco?('R$ '+Number(m.preco).toFixed(2)):'—'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${ok?'b-ok':'b-red'}">${ok?'OK':'BAIXO'}</span>
          ${podeEscreverNoModulo()
            ? `<button class="btn btn-s btn-sm" onclick="editarMaterial(${m.id})" title="Editar quantidade, mínimo e preço">✎</button>`
            : ''}
        </div>
      </td>
    </tr>`}).join('')
}

// ── valor da hora-homem (maq_config, migração 30) ──
// Conferido contra as políticas reais em 18/08/2026: TODA escrita do módulo
// Máquinas (maq_os, maq_materiais, maq_estoque_movimentos, maq_config) está
// escopada a `authenticated`, e o acesso Livre nunca autentica. Uma regra só,
// portanto — a tela não oferece controle que o banco vai recusar, mesmo
// princípio dos cargos do editor de zona no mapa.
function podeEscreverNoModulo(){
  return ['admin','gestor','tecnico'].includes(USUARIO?.role)
}

// observador vê o valor vigente, mas em leitura: o número é informação útil
// para ele; o campo editável seria promessa falsa
function aplicarPermissoesConfig(){
  const campo = document.getElementById('cfg-valor-hora')
  const botao = document.getElementById('btn-valor-hora')
  const aviso = document.getElementById('cfg-hora-ajuda')
  if(!campo || !botao) return
  const pode = podeEscreverNoModulo()
  campo.disabled = !pode
  botao.style.display = pode ? '' : 'none'
  if(aviso) aviso.textContent = pode
    ? 'Usado como padrão no custo de mão de obra das OS. Enquanto estiver vazio, o custo de mão de obra fica zerado.'
    : 'Somente leitura — seu cargo não altera a configuração do módulo.'
}

async function salvarValorHora(){
  const campo = document.getElementById('cfg-valor-hora')
  const texto = campo.value.trim()
  // vazio apaga o valor: é diferente de zero, e zero afirmaria que a hora não
  // custa nada em vez de "ainda não informado"
  const valor = texto === '' ? null : Number(texto)
  if(valor !== null && !(valor >= 0)){ alert('Valor da hora precisa ser um número não negativo.'); return }

  // .select() não é enfeite: sob RLS, um update que não alcança nenhuma linha
  // permitida volta SEM erro e sem efeito. Sem conferir a linha de retorno, a
  // tela diria "salvo" enquanto o banco continuava com o valor antigo.
  const { data, error } = await supa.from('maq_config')
    .upsert({ chave: 'valor_hora_padrao', valor: valor === null ? null : String(valor) }, { onConflict: 'chave' })
    .select()
  if(error){ alert('Erro: ' + error.message); return }
  if(!data || !data.length){
    alert('O valor não foi gravado: seu cargo não tem permissão de escrita na configuração do módulo.')
    return
  }
  await carregarTudo()
}

// ── edição em linha do estoque ──
function editarMaterial(id){
  MATERIAL_EDIT_ID = id
  irParaAba('materiais')
  renderMateriais()
}

function cancelarEdicaoMaterial(){
  MATERIAL_EDIT_ID = null
  renderMateriais()
}

async function salvarLinhaMaterial(id){
  const material = MATERIAIS.find(m => m.id === id)
  if(!material) return

  const atual  = parseFloat(document.getElementById('ed-atual').value)
  const minimo = parseFloat(document.getElementById('ed-minimo').value)
  const precoTexto = document.getElementById('ed-preco').value.trim()
  const preco = precoTexto === '' ? null : parseFloat(precoTexto)

  if(!(atual >= 0) || !(minimo >= 0)){ alert('Quantidade e mínimo precisam ser números não negativos.'); return }
  if(preco !== null && !(preco >= 0)){ alert('Preço precisa ser um número não negativo.'); return }

  // .select() pelo mesmo motivo de salvarValorHora(): sob RLS um update que não
  // alcança linha permitida volta sem erro e sem efeito, e a tela diria "salvo"
  const { data, error } = await supa.from('maq_materiais')
    .update({ estoque_atual: atual, estoque_minimo: minimo, preco })
    .eq('id', id)
    .select()
  if(error){ alert('Erro: ' + error.message); return }
  if(!data || !data.length){
    alert('Nada foi gravado: seu cargo não tem permissão de escrita no estoque.')
    return
  }

  // Mexer na quantidade à mão é movimento de estoque como qualquer outro, e
  // precisa deixar rastro: sem isso o saldo muda e ninguém sabe por quê.
  const diferenca = atual - Number(material.estoque_atual)
  if(diferenca !== 0){
    await supa.from('maq_estoque_movimentos').insert({
      material_id: id,
      tipo: diferenca > 0 ? 'entrada' : 'saida',
      quantidade: Math.abs(diferenca),
      motivo: `Ajuste manual no estoque (${material.estoque_atual} → ${atual})`,
    })
  }

  MATERIAL_EDIT_ID = null
  await carregarTudo()
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
function abrirModalOS(ativoId, planoId, planosMarcados){
  // planosMarcados vem do popup de vencimentos: uma OS com vários itens. Sem
  // ele o modal se comporta como sempre, com um plano só.
  OS_PLANOS_MARCADOS = Array.isArray(planosMarcados) ? planosMarcados : (planoId ? [planoId] : [])
  document.getElementById('os-status').value = 'pendente'
  renderItensDaNovaOS()
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

// lista os itens que a OS vai levar quando ela nasce do popup de vencimentos
function renderItensDaNovaOS(){
  const wrap = document.getElementById('os-itens-wrap')
  const lista = document.getElementById('os-itens-lista')
  if(OS_PLANOS_MARCADOS.length < 2){ wrap.style.display = 'none'; return }
  wrap.style.display = ''
  lista.innerHTML = OS_PLANOS_MARCADOS
    .map(id => PLANOS.find(p => p.id === id))
    .filter(Boolean)
    .map(p => `<div style="padding:4px 0;border-bottom:1px solid var(--border)">${esc(p.nome)} — a cada ${p.intervalo} ${esc(p.unidade)}</div>`)
    .join('')
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

  // diagnóstico do catálogo (só em corretiva, e só se a migração 26 rodou)
  const reparoSel = document.getElementById('os-reparo')
  const reparo_id = (tipo === 'corretiva' && REPAROS.length) ? (parseInt(reparoSel?.value) || null) : null
  const reparo = reparo_id ? REPAROS.find(r => r.id === reparo_id) : null

  // A OS nasce com as peças que o plano e o diagnóstico preveem, já gravadas
  // como linhas dela — o usuário ajusta depois no detalhe. O custo é a soma
  // dessa lista, não uma conta paralela: uma conta só, um número só.
  const planosDaOS = OS_PLANOS_MARCADOS.length ? OS_PLANOS_MARCADOS : (plano_id ? [plano_id] : [])
  const pecasPrevistas = pecasPrevistasDaOS(planosDaOS, reparo_id)
  const custo_pecas = pecasPrevistas.reduce((s, p) => s + Number(p.quantidade) * Number(p.preco_unit || 0), 0)

  // serviços que o diagnóstico prevê, com o valor da hora do módulo
  const servicosPrevistos = (reparo_id ? REP_SERVS.filter(x => x.reparo_id === reparo_id) : [])
    .map(x => SERVICOS.find(s => s.id === x.servico_id)).filter(Boolean)
    .map(s => ({
      servico_id: s.id, horas: Number(s.tempo_padrao_h) || 1,
      valor_hora: s.valor_hora != null ? Number(s.valor_hora) : valorHoraPadrao(),
    }))
  const horas_servico = servicosPrevistos.reduce((s, x) => s + x.horas, 0)
  const custo_mo = servicosPrevistos.reduce((s, x) => s + x.horas * Number(x.valor_hora || 0), 0)

  // A OS nasce na situação escolhida. Os custos são a previsão calculada das
  // listas (o delineamento precisa exibir o valor antes de executar); a baixa
  // de estoque, essa sim, só acontece quando a execução começa.
  const status = document.getElementById('os-status').value
  const concluida = status === 'concluida'
  // nascer já executando (ou concluída) consome as peças na hora
  const executando = status === 'em_andamento' || concluida

  // as colunas de reparo só entram no payload quando há diagnóstico: assim o
  // insert continua válido mesmo num banco onde a migração 26 não rodou
  const { data: osNova, error: erOS } = await supa.from('maq_os').insert({
    ativo_id, plano_id, tipo, status,
    data_abertura: data,
    data_conclusao: concluida ? data : null,
    uso_na_os, tecnico, descricao,
    custo_pecas, custo_mo,
    horas_servico: horas_servico > 0 ? horas_servico : null,
    ...(reparo ? { reparo_id, sintoma_relatado: reparo.sintoma } : {}),
  }).select('id').single()
  if(erOS){ alert('Erro: ' + erOS.message); return }

  // os itens da OS (migração 29). Falha aqui não invalida a OS, que já está
  // gravada com o plano_id de sempre — num banco sem a migração 29 este insert
  // erra e o módulo segue com uma OS de um item só.
  if(planosDaOS.length && osNova?.id){
    await supa.from('maq_os_itens').insert(planosDaOS.map(pid => ({
      os_id: osNova.id, plano_id: pid, concluido: concluida, uso_no_item: concluida ? uso_na_os : null,
    })))
  }

  // peças e serviços previstos (migração 30). Mesma tolerância: sem a migração
  // estes inserts erram, a OS segue gravada e o custo continua no número que
  // já foi para maq_os.
  if(osNova?.id){
    if(pecasPrevistas.length){
      await supa.from('maq_os_materiais').insert(pecasPrevistas.map(p => ({ os_id: osNova.id, ...p })))
    }
    if(servicosPrevistos.length){
      await supa.from('maq_os_servicos').insert(servicosPrevistos.map(x => ({ os_id: osNova.id, ...x })))
    }
  }

  // o horímetro sobe junto com o registro de uso, independentemente da situação
  // da OS: as horas foram trabalhadas de fato, mesmo com o serviço em aberto
  if(delta > 0){
    await supa.from('maq_ativos').update({ uso_atual: uso_na_os }).eq('id', ativo_id)
    await supa.from('maq_uso_registros').insert({
      ativo_id, delta, uso_total: uso_na_os, data,
      operador: tecnico, obs: descricao
    })
  }

  // A baixa de estoque acontece quando a execução começa. Uma OS aberta, em
  // delineamento ou em espera que já debitou peça mentiria o estoque — a peça
  // ainda está na prateleira.
  if(executando && osNova?.id){
    await baixarPecasDaOS(osNova.id, pecasPrevistas, reparo)
  }
  if(concluida && osNova?.id){
    await confirmarDiagnostico(osNova.id, reparo)
  }

  fecharModal('modal-os')
  await carregarTudo()
}

// ── peças previstas para uma OS ──
// Uma lista só, resolvida a partir do plano e do diagnóstico, com a origem
// marcada. É ela que a criação grava em maq_os_materiais e que a baixa
// consome — e é por existir uma lista única que a mesma peça não é debitada
// duas vezes quando ela aparece no plano e no diagnóstico ao mesmo tempo.
function pecasPrevistasDaOS(planoIds, reparoId){
  const porMaterial = new Map()

  const somar = (materialId, quantidade, origem) => {
    const mat = MATERIAIS.find(m => m.id === materialId)
    if(!mat) return
    const atual = porMaterial.get(materialId)
    if(atual) atual.quantidade += Number(quantidade)
    else porMaterial.set(materialId, {
      material_id: materialId, quantidade: Number(quantidade),
      preco_unit: mat.preco ?? null, origem,
    })
  }

  for(const planoId of planoIds || []){
    for(const item of PLANO_MATS.filter(p => p.plano_id === planoId)) somar(item.material_id, item.quantidade, 'plano')
  }
  for(const item of (reparoId ? pecasEssenciaisDoReparo(reparoId) : [])) somar(item.material_id, item.quantidade, 'reparo')

  return [...porMaterial.values()]
}

// ── peças de uma OS para efeito de baixa e de necessidade ──
// A lista da própria OS é a fonte. Só quando a OS não tem lista — porque
// nasceu antes da migração 30 — é que a previsão do plano e do diagnóstico é
// resolvida na hora, para essas OS antigas não ficarem sem baixa.
function pecasParaBaixa(os){
  const daOS = OS_MATERIAIS.filter(m => m.os_id === os.id)
    .map(m => ({ material_id: m.material_id, quantidade: Number(m.quantidade), preco_unit: m.preco_unit, origem: m.origem }))
  return daOS.length
    ? daOS
    : pecasPrevistasDaOS(itensDaOS(os).map(i => i.plano_id).filter(Boolean), os.reparo_id)
}

// A baixa aconteceu se existe movimento de saída com o id desta OS. É o
// registro do próprio estoque respondendo, não uma flag paralela que poderia
// dessincronizar dele.
async function estoqueJaBaixadoDaOS(osId){
  const { data } = await supa.from('maq_estoque_movimentos')
    .select('id').eq('os_id', osId).eq('tipo', 'saida').limit(1)
  return !!(data && data.length)
}

// ── baixa de peças — no INÍCIO DA EXECUÇÃO, venha ele de onde vier ──
// Recebe a lista já resolvida. Está numa função só porque vários caminhos
// levam a executar (iniciar pela lista, criar já executando, mudar a situação
// no detalhe, concluir OS antiga que nunca executou) e todos precisam debitar
// exatamente do mesmo jeito. A guarda no topo torna a chamada idempotente:
// quem concluir uma OS cujo estoque já desceu na execução não debita de novo.
async function baixarPecasDaOS(osId, pecas, reparo){
  if(await estoqueJaBaixadoDaOS(osId)) return
  for(const peca of pecas || []){
    const mat = MATERIAIS.find(m => m.id === peca.material_id)
    if(!mat || !(Number(peca.quantidade) > 0)) continue
    const novo = Math.max(0, Number(mat.estoque_atual) - Number(peca.quantidade))
    await supa.from('maq_materiais').update({ estoque_atual: novo }).eq('id', mat.id)
    await supa.from('maq_estoque_movimentos').insert({
      material_id: mat.id, os_id: osId,
      tipo: 'saida', quantidade: Number(peca.quantidade),
      motivo: peca.origem === 'reparo'
        ? 'OS corretiva — ' + (reparo?.causa_provavel || '')
        : peca.origem === 'plano' ? 'OS preventiva — peça do plano' : 'OS — peça lançada na ordem',
    })
  }
}

// É esta chamada que faz o catálogo aprender: a causa confirmada incrementa
// rep_reparos.frequencia e sobe no ranking do próximo diagnóstico. A RPC é
// idempotente — repetir na mesma OS falha em vez de contar duas vezes.
async function confirmarDiagnostico(osId, reparo){
  if(!reparo || !osId) return
  const confirmado = document.getElementById('os-reparo-confirmado')?.checked ?? true
  const { error } = await supa.rpc('rep_confirmar_reparo', {
    p_os_id: osId, p_confirmado: confirmado,
  })
  // falha aqui não invalida a OS, que já está gravada — só avisa
  if(error) alert('OS gravada, mas a confirmação do diagnóstico falhou: ' + error.message)
}

async function concluirOS(id){
  const os = OS_LIST.find(o => o.id === id)
  if(!os) return
  if(!confirm('Concluir a OS?')) return

  const hoje = new Date().toISOString().slice(0,10)
  const reparo = os.reparo_id ? REPAROS.find(r => r.id === os.reparo_id) : null
  // se a OS seguiu o fluxo, o estoque já desceu no início da execução e a
  // baixa abaixo vira no-op pela guarda; se ela pulou etapas (OS antiga,
  // concluída direto), a baixa acontece agora
  const pecas = pecasParaBaixa(os)

  const custoPecas = pecas.reduce((soma, p) => soma + Number(p.quantidade) * Number(p.preco_unit || 0), 0)
  const custoMO = custoMaoDeObraDaOS(id)
  const horas = horasDaOS(id)

  const { error } = await supa.from('maq_os').update({
    status: 'concluida', data_conclusao: hoje,
    custo_pecas: custoPecas,
    custo_mo: custoMO,
    horas_servico: horas > 0 ? horas : os.horas_servico,
  }).eq('id', id)
  if(error){ alert('Erro: ' + error.message); return }

  await supa.from('maq_os_itens').update({ concluido: true }).eq('os_id', id)
  await baixarPecasDaOS(id, pecas, reparo)
  await confirmarDiagnostico(id, reparo)
  await carregarTudo()
}

// ── MODAL: DETALHE DA OS ──
function abrirDetalheOS(id){
  const os = OS_LIST.find(o => o.id === id)
  if(!os) return
  OS_DETALHE_ID = id

  const ativo = ATIVOS.find(a => a.id === os.ativo_id)
  const itens = itensDaOS(os)

  document.getElementById('modal-os-detalhe-titulo').textContent =
    `OS ${os.tipo} — ${os.maq_ativos?.codigo || ativo?.codigo || '?'}`

  const linha = (rotulo, valor) =>
    `<div style="display:flex;gap:8px"><span style="color:var(--text3);min-width:130px">${rotulo}</span><span>${valor}</span></div>`

  document.getElementById('osd-cabecalho').innerHTML = [
    linha('Máquina', esc(`${os.maq_ativos?.codigo || '?'} — ${os.maq_ativos?.nome || '?'}`)),
    linha('Abertura', esc(os.data_abertura || '—')),
    linha('Conclusão', esc(os.data_conclusao || '—')),
    linha('Uso na OS', os.uso_na_os != null ? `${os.uso_na_os} ${esc(ativo?.unidade_uso || 'h')}` : '—'),
    os.sintoma_relatado ? linha('Sintoma', esc(os.sintoma_relatado)) : '',
    os.delineado_em ? linha('Delineamento', esc(`${os.delineado_por || '?'} — ${new Date(os.delineado_em).toLocaleString('pt-BR')}`)) : '',
  ].filter(Boolean).join('')

  document.getElementById('osd-status').value = os.status
  document.getElementById('osd-tecnico').value = os.tecnico || ''
  document.getElementById('osd-desc').value = os.descricao || ''

  // as duas listas viram estado de edição em memória e só vão ao banco no
  // Salvar — assim dá para montar a OS inteira e desistir sem sujar nada
  OSD_PECAS = OS_MATERIAIS.filter(m => m.os_id === id).map(m => ({
    material_id: m.material_id, quantidade: Number(m.quantidade),
    preco_unit: m.preco_unit == null ? null : Number(m.preco_unit),
    origem: m.origem || 'manual',
  }))
  OSD_SERVICOS = OS_SERVICOS.filter(s => s.os_id === id).map(s => ({
    servico_id: s.servico_id, descricao: s.descricao || '',
    horas: Number(s.horas), valor_hora: s.valor_hora == null ? null : Number(s.valor_hora),
  }))
  renderPecasOS()
  renderServicosOS()

  // itens sem id vêm do fallback do plano único (banco sem a migração 29):
  // aparecem para leitura, mas não têm linha própria para marcar
  document.getElementById('osd-itens').innerHTML = itens.length
    ? itens.map(i => `<label class="mat-alert" style="cursor:${i.id ? 'pointer' : 'default'}">
        <span class="mat-info">
          <span class="mat-nome">${esc(i.maq_planos?.nome || i.descricao || 'Item de manutenção')}</span>
          ${i.maq_planos?.intervalo ? `<span class="mat-stock">a cada ${i.maq_planos.intervalo} ${esc(i.maq_planos.unidade)}</span>` : ''}
        </span>
        <input type="checkbox" class="osd-item" data-id="${i.id || ''}" ${i.concluido ? 'checked' : ''}
          ${i.id ? '' : 'disabled'} style="width:auto"/>
      </label>`).join('')
    : '<div class="tagline">Sem itens vinculados — OS corretiva ou registro de uso.</div>'

  document.getElementById('modal-os-detalhe').classList.add('open')
}

// ── peças e serviços da OS (edição no modal de detalhe) ──
function renderPecasOS(){
  const div = document.getElementById('osd-pecas')
  if(!OSD_PECAS.length){
    div.innerHTML = '<div class="tagline">Nenhuma peça lançada.</div>'
    recalcularCustosOS()
    return
  }
  const rotuloOrigem = { plano: 'do plano', reparo: 'do diagnóstico', manual: '' }
  div.innerHTML = OSD_PECAS.map((peca, i) => {
    const mat = MATERIAIS.find(m => m.id === peca.material_id)
    const total = Number(peca.quantidade || 0) * Number(peca.preco_unit || 0)
    const semEstoque = mat && Number(mat.estoque_atual) < Number(peca.quantidade)
    return `<div class="panel-card" style="padding:10px 12px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select onchange="trocarPecaOS(${i}, this.value)" style="flex:1 1 180px;min-width:0">
          ${MATERIAIS.map(m => `<option value="${m.id}" ${m.id===peca.material_id?'selected':''}>${esc(m.nome)}</option>`).join('')}
        </select>
        <input type="number" value="${peca.quantidade}" min="0.01" step="0.5" title="Quantidade"
          oninput="atualizarPecaOS(${i}, 'quantidade', this.value)" style="width:82px"/>
        <input type="number" value="${peca.preco_unit ?? ''}" min="0" step="0.01" placeholder="preço" title="Preço unitário"
          oninput="atualizarPecaOS(${i}, 'preco_unit', this.value)" style="width:96px"/>
        <span class="mono" style="font-size:12px;color:var(--text2);min-width:80px;text-align:right">R$ ${total.toFixed(2)}</span>
        <button class="btn btn-d btn-sm" onclick="removerPecaOS(${i})" aria-label="Remover peça">✕</button>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">
        ${esc(mat?.unidade || 'un')}${rotuloOrigem[peca.origem] ? ' · ' + rotuloOrigem[peca.origem] : ''}
        ${semEstoque ? ` · <span style="color:var(--red)">estoque atual: ${mat.estoque_atual}</span>` : ''}
      </div>
    </div>`
  }).join('')
  recalcularCustosOS()
}

function renderServicosOS(){
  const div = document.getElementById('osd-servicos')
  if(!OSD_SERVICOS.length){
    div.innerHTML = '<div class="tagline">Nenhum serviço lançado.</div>'
    recalcularCustosOS()
    return
  }
  div.innerHTML = OSD_SERVICOS.map((servico, i) => {
    const total = Number(servico.horas || 0) * Number(servico.valor_hora || 0)
    // sem catálogo (migração 26 ausente) sobra a descrição livre, que é o
    // caminho previsto para o serviço combinado na hora
    const seletor = SERVICOS.length
      ? `<select onchange="trocarServicoOS(${i}, this.value)" style="flex:1 1 180px;min-width:0">
           <option value="">— serviço avulso —</option>
           ${SERVICOS.map(s => `<option value="${s.id}" ${s.id===servico.servico_id?'selected':''}>${esc(s.nome)}</option>`).join('')}
         </select>`
      : ''
    return `<div class="panel-card" style="padding:10px 12px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${seletor}
        <input type="number" value="${servico.horas}" min="0.1" step="0.5" title="Horas"
          oninput="atualizarServicoOS(${i}, 'horas', this.value)" style="width:78px"/>
        <input type="number" value="${servico.valor_hora ?? ''}" min="0" step="0.01" placeholder="R$/h" title="Valor da hora"
          oninput="atualizarServicoOS(${i}, 'valor_hora', this.value)" style="width:92px"/>
        <span class="mono" style="font-size:12px;color:var(--text2);min-width:80px;text-align:right">R$ ${total.toFixed(2)}</span>
        <button class="btn btn-d btn-sm" onclick="removerServicoOS(${i})" aria-label="Remover serviço">✕</button>
      </div>
      ${servico.servico_id ? '' : `<input type="text" value="${esc(servico.descricao)}" placeholder="Descreva o serviço"
        oninput="atualizarServicoOS(${i}, 'descricao', this.value)" style="margin-top:6px"/>`}
    </div>`
  }).join('')
  recalcularCustosOS()
}

// o total da tela é o mesmo cálculo que vai para o banco no Salvar — não há
// uma conta para exibir e outra para gravar
function recalcularCustosOS(){
  const pecas = OSD_PECAS.reduce((s, p) => s + Number(p.quantidade || 0) * Number(p.preco_unit || 0), 0)
  const horas = OSD_SERVICOS.reduce((s, x) => s + Number(x.horas || 0), 0)
  const mo    = OSD_SERVICOS.reduce((s, x) => s + Number(x.horas || 0) * Number(x.valor_hora || 0), 0)

  document.getElementById('osd-custo-pecas').textContent = pecas.toFixed(2)
  document.getElementById('osd-custo-mo').textContent    = mo.toFixed(2)
  document.getElementById('osd-horas').textContent       = horas.toFixed(1)
  document.getElementById('osd-custo-total').textContent = (pecas + mo).toFixed(2)

  // horas lançadas sem valor da hora produzem mão de obra zero — o usuário
  // precisa saber que o número está zerado por falta de cadastro, não por
  // não ter havido serviço
  const semValor = OSD_SERVICOS.some(x => Number(x.horas || 0) > 0 && !(Number(x.valor_hora) > 0))
  const aviso = document.getElementById('osd-aviso-hora')
  aviso.style.display = semValor ? '' : 'none'
  aviso.innerHTML = semValor
    ? (valorHoraPadrao() === null
      ? '⚠ Nenhum valor de hora-homem cadastrado no módulo — o custo de mão de obra fica zerado. Defina o valor na aba Estoque.'
      : '⚠ Há serviço sem valor da hora; o custo de mão de obra desconsidera essas linhas.')
    : ''
}

function adicionarPecaOS(){
  const material = MATERIAIS[0]
  if(!material){ alert('Nenhum material cadastrado no estoque.'); return }
  OSD_PECAS.push({ material_id: material.id, quantidade: 1, preco_unit: material.preco ?? null, origem: 'manual' })
  renderPecasOS()
}

function trocarPecaOS(indice, materialId){
  const material = MATERIAIS.find(m => m.id === parseInt(materialId))
  if(!material) return
  OSD_PECAS[indice].material_id = material.id
  // o preço acompanha a peça escolhida; se o usuário já tinha ajustado à mão,
  // trocar de peça troca o preço junto — é peça outra, preço outro
  OSD_PECAS[indice].preco_unit = material.preco ?? null
  renderPecasOS()
}

function atualizarPecaOS(indice, campo, valor){
  OSD_PECAS[indice][campo] = valor === '' ? null : Number(valor)
  recalcularCustosOS()
}

function removerPecaOS(indice){
  OSD_PECAS.splice(indice, 1)
  renderPecasOS()
}

function adicionarServicoOS(){
  const servico = SERVICOS[0] || null
  OSD_SERVICOS.push({
    servico_id: servico?.id ?? null,
    descricao: servico ? '' : '',
    horas: Number(servico?.tempo_padrao_h) || 1,
    valor_hora: (servico?.valor_hora != null ? Number(servico.valor_hora) : valorHoraPadrao()),
  })
  renderServicosOS()
}

function trocarServicoOS(indice, servicoId){
  const servico = SERVICOS.find(s => s.id === parseInt(servicoId)) || null
  OSD_SERVICOS[indice].servico_id = servico?.id ?? null
  if(servico){
    OSD_SERVICOS[indice].horas = Number(servico.tempo_padrao_h) || OSD_SERVICOS[indice].horas
    OSD_SERVICOS[indice].valor_hora = servico.valor_hora != null ? Number(servico.valor_hora) : valorHoraPadrao()
    OSD_SERVICOS[indice].descricao = ''
  }
  renderServicosOS()
}

function atualizarServicoOS(indice, campo, valor){
  OSD_SERVICOS[indice][campo] = campo === 'descricao' ? valor : (valor === '' ? null : Number(valor))
  if(campo === 'descricao') recalcularCustosOS()
  else recalcularCustosOS()
}

function removerServicoOS(indice){
  OSD_SERVICOS.splice(indice, 1)
  renderServicosOS()
}

// grava as duas listas: apaga e reinsere, que é o jeito honesto de salvar uma
// lista editada inteira sem inventar identidade para linha que o usuário mexeu
async function gravarListasDaOS(osId){
  await supa.from('maq_os_materiais').delete().eq('os_id', osId)
  await supa.from('maq_os_servicos').delete().eq('os_id', osId)

  const pecas = OSD_PECAS.filter(p => p.material_id && Number(p.quantidade) > 0)
  if(pecas.length){
    const { error } = await supa.from('maq_os_materiais').insert(pecas.map(p => ({
      os_id: osId, material_id: p.material_id,
      quantidade: Number(p.quantidade), preco_unit: p.preco_unit,
      origem: p.origem || 'manual',
    })))
    if(error){ alert('Erro ao gravar as peças: ' + error.message); return false }
  }

  const servicos = OSD_SERVICOS.filter(s => Number(s.horas) > 0 && (s.servico_id || (s.descricao || '').trim()))
  if(servicos.length){
    const { error } = await supa.from('maq_os_servicos').insert(servicos.map(s => ({
      os_id: osId, servico_id: s.servico_id || null,
      descricao: s.servico_id ? null : (s.descricao || '').trim(),
      horas: Number(s.horas), valor_hora: s.valor_hora,
    })))
    if(error){ alert('Erro ao gravar os serviços: ' + error.message); return false }
  }
  return true
}

async function salvarDetalheOS(){
  const os = OS_LIST.find(o => o.id === OS_DETALHE_ID)
  if(!os) return

  const status = document.getElementById('osd-status').value
  const EXECUTADOS = ['em_andamento','concluida']
  // entrou em execução (ou foi direto a concluída) por aqui: o estoque desce —
  // a guarda dentro da baixa evita débito duplo se já desceu em outro caminho
  const virouExecucao = EXECUTADOS.includes(status) && !EXECUTADOS.includes(os.status)
  const virouConcluida = status === 'concluida' && os.status !== 'concluida'

  // as listas vão primeiro: os custos gravados em maq_os têm de ser a soma do
  // que ficou gravado nelas, não de um estado de tela que ainda pode falhar
  if(!(await gravarListasDaOS(os.id))) return

  const custoPecas = OSD_PECAS.reduce((s, p) => s + Number(p.quantidade || 0) * Number(p.preco_unit || 0), 0)
  const horas      = OSD_SERVICOS.reduce((s, x) => s + Number(x.horas || 0), 0)
  const custoMO    = OSD_SERVICOS.reduce((s, x) => s + Number(x.horas || 0) * Number(x.valor_hora || 0), 0)

  const payload = {
    status,
    tecnico: document.getElementById('osd-tecnico').value.trim(),
    descricao: document.getElementById('osd-desc').value.trim(),
    custo_pecas: custoPecas,
    custo_mo: custoMO,
    horas_servico: horas > 0 ? horas : null,
  }
  if(status === 'concluida' && !os.data_conclusao) payload.data_conclusao = new Date().toISOString().slice(0,10)

  const { error } = await supa.from('maq_os').update(payload).eq('id', os.id)
  if(error){ alert('Erro: ' + error.message); return }

  // marcação item a item — só para os itens que existem em maq_os_itens
  for(const caixa of document.querySelectorAll('.osd-item')){
    if(!caixa.dataset.id) continue
    await supa.from('maq_os_itens').update({ concluido: caixa.checked }).eq('id', caixa.dataset.id)
  }

  // Iniciar a execução pelo detalhe baixa o estoque igual a iniciar pela
  // lista: é o mesmo evento, e deixar um caminho sem baixa seria um furo no
  // estoque. A lista de peças da própria OS já foi gravada acima, então é
  // dela que a baixa sai.
  const reparo = os.reparo_id ? REPAROS.find(r => r.id === os.reparo_id) : null
  if(virouExecucao) await baixarPecasDaOS(os.id, OSD_PECAS, reparo)
  if(virouConcluida) await confirmarDiagnostico(os.id, reparo)

  fecharModal('modal-os-detalhe')
  await carregarTudo()
}

// ── exportação da OS ──
// Zero dependência, por decisão: PDF pela impressão do navegador, Word por
// blob HTML (o Word abre HTML como documento) e Excel por CSV. A Fase 9 vai
// unificar exportação em shared/ — quando isso acontecer, estas três funções
// são as primeiras candidatas a sair daqui.
function osParaExportar(){
  const os = OS_LIST.find(o => o.id === OS_DETALHE_ID)
  if(!os) alert('Nenhuma OS aberta.')
  return os
}

function linhasDaOS(os){
  const ativo = ATIVOS.find(a => a.id === os.ativo_id)
  const itens = itensDaOS(os)
  return [
    ['Máquina',    `${os.maq_ativos?.codigo || ''} — ${os.maq_ativos?.nome || ''}`],
    ['Tipo',       os.tipo],
    ['Situação',   rotuloStatusOS(os.status)],
    ['Abertura',   os.data_abertura || ''],
    ['Conclusão',  os.data_conclusao || ''],
    ['Técnico',    os.tecnico || ''],
    ['Uso na OS',  os.uso_na_os != null ? `${os.uso_na_os} ${ativo?.unidade_uso || 'h'}` : ''],
    ['Itens',      itens.map(i => i.maq_planos?.nome || i.descricao || 'Item').join(' | ')],
    ['Sintoma',    os.sintoma_relatado || ''],
    ['Delineamento', os.delineado_em ? `${os.delineado_por || '?'} — ${new Date(os.delineado_em).toLocaleString('pt-BR')}` : ''],
    ['Descrição',  os.descricao || ''],
    ['Custo de peças (R$)', Number(os.custo_pecas || 0).toFixed(2)],
    ['Custo de mão de obra (R$)', Number(os.custo_mo || 0).toFixed(2)],
    ['Horas de serviço', os.horas_servico ?? ''],
  ]
}

function htmlDaOS(os){
  const linhas = linhasDaOS(os)
    .map(([rotulo, valor]) => `<tr><th align="left" width="200">${esc(rotulo)}</th><td>${esc(valor)}</td></tr>`)
    .join('')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>OS ${esc(os.maq_ativos?.codigo || '')} — ${esc(os.data_abertura || '')}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px}
      h1{font-size:18px;margin:0 0 4px} .sub{font-size:12px;color:#555;margin-bottom:20px}
      table{border-collapse:collapse;width:100%;font-size:13px}
      th,td{border:1px solid #ccc;padding:7px 9px;vertical-align:top}
      th{background:#f2f2f2}
      .assinatura{margin-top:48px;font-size:12px;display:flex;gap:48px}
      .assinatura div{flex:1;border-top:1px solid #333;padding-top:6px;text-align:center}
    </style></head><body>
    <h1>Ordem de Serviço — PMOC Máquinas</h1>
    <div class="sub">CMASM · Centro de Mísseis e Armas Submarinas · UASG 744030</div>
    <table>${linhas}</table>
    <div class="assinatura"><div>Técnico responsável</div><div>Encarregado</div></div>
    </body></html>`
}

function baixarArquivo(conteudo, tipo, nome){
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.click()
  URL.revokeObjectURL(url)
}

function nomeDoArquivoOS(os, extensao){
  const codigo = (os.maq_ativos?.codigo || 'os').replace(/[^\w-]+/g, '-')
  return `os-${codigo}-${os.data_abertura || 'sem-data'}.${extensao}`
}

function exportarOSPdf(){
  const os = osParaExportar()
  if(!os) return
  // sem biblioteca de PDF: a janela de impressão do navegador gera o arquivo,
  // e o usuário escolhe "Salvar como PDF"
  const janela = window.open('', '_blank')
  if(!janela){ alert('O navegador bloqueou a janela de impressão. Libere o pop-up e tente de novo.'); return }
  janela.document.write(htmlDaOS(os))
  janela.document.close()
  janela.focus()
  janela.print()
}

function exportarOSDoc(){
  const os = osParaExportar()
  if(!os) return
  baixarArquivo(htmlDaOS(os), 'application/msword', nomeDoArquivoOS(os, 'doc'))
}

// mesma proteção contra injeção de fórmula que transportes/app.js já aplica:
// uma célula começando com =, +, - ou @ vira comando ao abrir na planilha
function csvSeguro(valor){
  const texto = String(valor ?? '')
  return /^[=+\-@]/.test(texto) ? `'${texto}` : texto
}

function csvEscape(valor){
  const texto = String(valor ?? '')
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function exportarOSCsv(){
  const os = osParaExportar()
  if(!os) return
  const csv = [['Campo', 'Valor'], ...linhasDaOS(os)]
    .map(colunas => colunas.map(v => csvEscape(csvSeguro(v))).join(';'))
    .join('\n')
  // BOM para o Excel em português reconhecer os acentos
  baixarArquivo('﻿' + csv, 'text/csv;charset=utf-8', nomeDoArquivoOS(os, 'csv'))
}

// ── FICHA DA MÁQUINA ──
// Consulta e ação, não edição. O que muda no dia a dia (uso, OS, comentário)
// tem botão; a identidade (código, nome, categoria, fabricante, modelo,
// patrimônio) aparece só como texto, e o uso atual vem calculado dos registros.
function abrirFichaAtivo(id){
  const ativo = ATIVOS.find(a => a.id === id)
  if(!ativo) return
  FICHA_ATIVO_ID = id

  document.getElementById('ficha-titulo').textContent =
    `${ativo.emoji || ''} ${ativo.codigo || '?'} — ${ativo.nome}`

  const statusBadge = s => s==='operante'?'b-ok':s==='inoperante'?'b-red':'b-warn'
  const linha = (rotulo, valor) =>
    `<div style="display:flex;gap:8px"><span style="color:var(--text3);min-width:110px">${rotulo}</span><span>${valor}</span></div>`

  document.getElementById('ficha-identidade').innerHTML = [
    linha('Categoria', esc(ativo.categoria || '—')),
    linha('Fabricante/Modelo', esc([ativo.fabricante, ativo.modelo].filter(Boolean).join(' ') || '—')),
    linha('Patrimônio', esc(ativo.patrimonio || '—')),
    linha('Local', esc(ativo.local || '—')),
    // uso atual é o acumulado dos registros de uso — não se edita, se registra
    linha('Uso atual', `<strong>${ativo.uso_atual} ${esc(ativo.unidade_uso || 'h')}</strong> <span style="color:var(--text3)">(calculado dos registros)</span>`),
    linha('Status', `<span class="badge ${statusBadge(ativo.status)}">${esc(ativo.status.toUpperCase())}</span>`),
    ativo.obs ? linha('Observações', esc(ativo.obs)) : '',
  ].filter(Boolean).join('')

  // ações do dia a dia — e o cadastro atrás de botão restrito: editar código,
  // nome ou patrimônio é correção de exceção, não rotina
  document.getElementById('ficha-btn-uso').onclick = () => { fecharModal('modal-ficha'); abrirModalUso(id) }
  document.getElementById('ficha-btn-os').onclick = () => { fecharModal('modal-ficha'); abrirModalOS(id) }
  const btnCadastro = document.getElementById('ficha-btn-cadastro')
  btnCadastro.style.display = ['admin','gestor'].includes(USUARIO?.role) ? '' : 'none'
  btnCadastro.onclick = () => { fecharModal('modal-ficha'); abrirModalAtivo(id) }

  // instruções — só aparecem quando existem
  const insWrap = document.getElementById('ficha-instrucoes-wrap')
  insWrap.style.display = ativo.instrucoes ? '' : 'none'
  document.getElementById('ficha-instrucoes').textContent = ativo.instrucoes || ''

  // operações agendadas para esta máquina (programadas e em execução)
  const operacoes = OPERACOES.filter(o => o.ativo_id === id && ['programada','em_execucao'].includes(o.status))
  const opWrap = document.getElementById('ficha-operacoes-wrap')
  opWrap.style.display = operacoes.length ? '' : 'none'
  document.getElementById('ficha-operacoes').innerHTML = operacoes.slice(0,5).map(o => `
    <div class="mat-alert">
      <span class="mat-info">
        <span class="mat-nome">${esc(o.maq_areas?.nome || 'Área não informada')}</span>
        <span class="mat-stock">${esc(o.tipo_servico)} · ${esc(o.data_programada || '—')}</span>
      </span>
      <span class="badge ${o.status==='em_execucao'?'b-blue':'b-warn'}">${o.status==='em_execucao'?'EM EXECUÇÃO':'PROGRAMADA'}</span>
    </div>`).join('')

  // últimas OS — clicáveis, abrem o detalhe
  const osDaMaquina = OS_LIST.filter(o => o.ativo_id === id).slice(0,5)
  document.getElementById('ficha-os').innerHTML = osDaMaquina.length
    ? osDaMaquina.map(o => `
      <div class="mat-alert" style="cursor:pointer" onclick="fecharModal('modal-ficha');abrirDetalheOS('${o.id}')">
        <span class="mat-info">
          <span class="mat-nome">${esc(o.data_abertura || '—')} · ${esc(o.tipo)}</span>
          <span class="mat-stock">${esc(itensDaOS(o)[0]?.maq_planos?.nome || o.sintoma_relatado || '—')}</span>
        </span>
        <span class="badge ${badgeStatusOS(o.status)}">${rotuloStatusOS(o.status)}</span>
      </div>`).join('')
    : '<div class="tagline">Nenhuma OS registrada.</div>'

  // últimos registros de uso
  const usosDaMaquina = USOS.filter(u => u.ativo_id === id).slice(0,5)
  document.getElementById('ficha-usos').innerHTML = usosDaMaquina.length
    ? usosDaMaquina.map(u => `
      <div class="mat-alert">
        <span class="mat-info">
          <span class="mat-nome">+${u.delta} ${esc(ativo.unidade_uso || 'h')} → ${u.uso_total}</span>
          <span class="mat-stock">${esc(u.data || '—')}${u.operador ? ' · ' + esc(u.operador) : ''}</span>
        </span>
      </div>`).join('')
    : '<div class="tagline">Nenhum uso registrado.</div>'

  renderComentariosFicha()
  // observador lê o diário, não escreve nele — mesma regra de escrita do módulo
  document.getElementById('ficha-comentar-wrap').style.display = podeEscreverNoModulo() ? '' : 'none'
  document.getElementById('ficha-comentario').value = ''

  document.getElementById('modal-ficha').classList.add('open')
}

function renderComentariosFicha(){
  const lista = COMENTARIOS.filter(c => c.ativo_id === FICHA_ATIVO_ID).slice(0,10)
  document.getElementById('ficha-comentarios').innerHTML = lista.length
    ? lista.map(c => `
      <div class="mat-alert">
        <span class="mat-info">
          <span class="mat-nome">${esc(c.texto)}</span>
          <span class="mat-stock">${esc(c.autor || '—')} · ${new Date(c.criado_em).toLocaleString('pt-BR')}</span>
        </span>
      </div>`).join('')
    : '<div class="tagline">Nenhum comentário — o diário de bordo desta máquina começa aqui.</div>'
}

async function salvarComentarioAtivo(){
  const campo = document.getElementById('ficha-comentario')
  const texto = campo.value.trim()
  if(!texto){ alert('Escreva o comentário antes de anotar.'); return }

  // .select() pelo mesmo motivo de salvarValorHora: sob RLS uma escrita sem
  // efeito volta sem erro, e a tela mentiria "anotado"
  const { data, error } = await supa.from('maq_ativo_comentarios')
    .insert({ ativo_id: FICHA_ATIVO_ID, autor: USUARIO?.nome || null, texto })
    .select()
  if(error){ alert('Erro: ' + error.message); return }
  if(!data || !data.length){ alert('Nada foi anotado: seu cargo não tem permissão de escrita.'); return }

  campo.value = ''
  await carregarComentarios()
  renderComentariosFicha()
}

// ── MODAL ATIVO (cadastro — exceção, não rotina) ──
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
  document.getElementById('at-uni').value     = ativo?.unidade_uso||'h'
  document.getElementById('at-local').value   = ativo?.local   || ''
  document.getElementById('at-instrucoes').value = ativo?.instrucoes || ''
  document.getElementById('at-obs').value     = ativo?.obs     || ''

  // Uso só é digitável na criação (leitura inicial do horímetro). Numa máquina
  // existente ele é calculado dos registros de uso — editá-lo aqui
  // dessincronizaria o horímetro do histórico que o produziu.
  const campoUso = document.getElementById('at-uso')
  campoUso.value = ativo?.uso_atual || 0
  campoUso.disabled = !!ativo
  document.getElementById('at-uso-label').textContent = ativo ? 'Uso atual' : 'Uso inicial'
  document.getElementById('at-uso-ajuda').textContent = ativo
    ? 'Calculado dos registros de uso — registre uso na ficha da máquina.'
    : ''

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
    unidade_uso: document.getElementById('at-uni').value,
    local:       document.getElementById('at-local').value.trim(),
    instrucoes:  document.getElementById('at-instrucoes').value.trim() || null,
    obs:         document.getElementById('at-obs').value.trim(),
  }
  if(!campos.nome){ alert('Nome obrigatório.'); return }

  // uso_atual só entra na criação — depois disso ele pertence aos registros
  // de uso, nunca mais ao formulário
  if(!ATIVO_EDIT_ID){
    campos.uso_atual = parseFloat(document.getElementById('at-uso').value) || 0
  }

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
    abrirModalUso,
    abrirDetalheOS,
    abrirFichaAtivo,
    abrirOSDosItensMarcados,
    abrirVencMaquina,
    adicionarPecaOS,
    adicionarServicoOS,
    atualizarPecaOS,
    atualizarSelecaoVenc,
    atualizarServicoOS,
    avancarOS,
    cancelarEdicaoMaterial,
    concluirOperacao,
    concluirOS,
    editarMaterial,
    exportarComprasCSV,
    exportarOSCsv,
    exportarOSDoc,
    exportarOSPdf,
    fecharModal,
    irParaAba,
    marcarTodosVenc,
    removerPecaOS,
    removerServicoOS,
    iniciarOperacao,
    navegarAgenda,
    renderAtivos,
    renderOS,
    sair,
    salvarAbastecimento,
    salvarArea,
    salvarAtivo,
    salvarComentarioAtivo,
    salvarMaterial,
    salvarMovimento,
    salvarDetalheOS,
    salvarLinhaMaterial,
    salvarValorHora,
    salvarOperacao,
    salvarOS,
    salvarUso,
    trocarPecaOS,
    trocarServicoOS,
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
