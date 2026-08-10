// PMOC Predial — inspeção predial do CMASM (NBR 5674:2012 / NBR 16747:2020).
// Portado do app legado xPredial (SQLite + Flask) para o padrão pmoc.
// Fluxo: local (árvore) → template de checklist → inspeção → itens com GUT → laudo.

import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { GUT_ESCALA, classificarGut, montarArvore } from './dominio.js'

let supa = null
let auth = null
let USUARIO = null

let LOCAIS = []
let TEMPLATES = []
let TEMPLATE_ITENS = []
let INSPECOES = []
let ITENS = []
let LAUDOS = []
let NORMAS = []
let ERRO_CARGA = null

let LOCAL_EDIT_ID = null
let INSPECAO_ABERTA_ID = null

const ROLES_ESCRITA = ['admin', 'gestor', 'tecnico']

const STATUS_INSPECAO = {
  planejada: 'Planejada',
  em_execucao: 'Em execução',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
  concluida: 'Concluída',
}

const BADGE_INSPECAO = {
  planejada: 'b-blue',
  em_execucao: 'b-warn',
  aguardando_aprovacao: 'b-warn',
  aprovada: 'b-ok',
  reprovada: 'b-red',
  concluida: 'b-ok',
}

// Transições permitidas — espelha o workflow do legado.
const PROXIMOS_STATUS = {
  planejada: ['em_execucao'],
  em_execucao: ['aguardando_aprovacao'],
  aguardando_aprovacao: ['aprovada', 'reprovada'],
  aprovada: ['concluida'],
  reprovada: ['em_execucao'],
  concluida: [],
}

const CONDICAO = {
  ok: { rotulo: 'Baixo', badge: 'b-ok' },
  atencao: { rotulo: 'Atenção', badge: 'b-warn' },
  critico: { rotulo: 'Crítico', badge: 'b-red' },
}

const AREAS = { ADM: 'Administrativa', OPE: 'Operacional', APA: 'Apoio' }

const TIPOS_LAUDO = {
  laudo_inspecao: 'Laudo de inspeção',
  art: 'ART',
  rrt: 'RRT',
  relatorio_fotog: 'Relatório fotográfico',
  plano_manutencao: 'Plano de manutenção',
  outro: 'Outro',
}

// ── utilidades ──
function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[caractere])
}

const el = id => document.getElementById(id)
const val = id => (el(id)?.value ?? '').trim()
const hoje = () => new Date().toISOString().slice(0, 10)
const fmtData = iso => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '—')

function podeEscrever() {
  return ROLES_ESCRITA.includes(USUARIO?.role)
}

function exigirEscrita() {
  if (podeEscrever()) return true
  alert('Seu cargo tem acesso somente de leitura.')
  return false
}

function erroSupabase(error) {
  alert(`Erro: ${error.message}`)
}

function botaoEscrita(rotulo, acao, classe = 'btn-p') {
  return `<button class="btn ${classe} btn-sm" onclick="${acao}" ${podeEscrever() ? '' : 'disabled'}>${rotulo}</button>`
}

const localPorId = id => LOCAIS.find(local => local.id === id)
const itensDaInspecao = id => ITENS.filter(item => item.inspecao_id === id)

// Caminho completo do local na árvore, para dar contexto na lista de inspeções.
function caminhoLocal(id) {
  const nomes = []
  let atual = localPorId(id)
  const vistos = new Set()
  while (atual && !vistos.has(atual.id)) {
    vistos.add(atual.id)
    nomes.unshift(atual.nome)
    atual = atual.parent_id ? localPorId(atual.parent_id) : null
  }
  return nomes.join(' › ') || '—'
}

// ── carga de dados ──
async function carregarTudo() {
  ERRO_CARGA = null
  const [locais, templates, templateItens, inspecoes, itens, laudos, normas] = await Promise.all([
    supa.from('pred_locais').select('*').eq('ativo', true).order('nome'),
    supa.from('pred_checklist_templates').select('*').eq('ativo', true).order('id'),
    supa.from('pred_checklist_itens').select('*').order('sistema').order('ordem'),
    supa.from('pred_inspecoes').select('*').order('data_vistoria', { ascending: false, nullsFirst: false }),
    supa.from('pred_inspecao_itens').select('*').order('gut_total', { ascending: false }),
    supa.from('pred_laudos').select('*').order('data_emissao', { ascending: false, nullsFirst: false }),
    supa.from('pred_normas').select('*').eq('ativo', true).order('codigo'),
  ])

  const falha = [locais, templates, templateItens, inspecoes, itens, laudos, normas].find(r => r.error)
  if (falha) {
    ERRO_CARGA = falha.error.message
    return
  }

  LOCAIS = locais.data || []
  TEMPLATES = templates.data || []
  TEMPLATE_ITENS = templateItens.data || []
  INSPECOES = inspecoes.data || []
  ITENS = itens.data || []
  LAUDOS = laudos.data || []
  NORMAS = normas.data || []
}

async function recarregar() {
  await carregarTudo()
  renderTudo()
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

// ── render ──
function renderTudo() {
  el('alerta-carga').innerHTML = ERRO_CARGA
    ? `<div class="callout co-red"><strong>Falha ao carregar dados.</strong> ${esc(ERRO_CARGA)}</div>`
    : ''
  renderPainel()
  renderLocais()
  renderInspecoes()
  renderChecklist()
  renderLaudos()
}

function renderPainel() {
  const abertas = INSPECOES.filter(i => !['concluida', 'reprovada'].includes(i.status)).length
  const criticos = ITENS.filter(item => item.condicao === 'critico')
  const atencao = ITENS.filter(item => item.condicao === 'atencao')
  const naoConformes = ITENS.filter(item => item.presente)

  const porSistema = Object.entries(
    criticos.concat(atencao).reduce((mapa, item) => {
      const chave = item.categoria || 'sem categoria'
      mapa[chave] = (mapa[chave] || 0) + 1
      return mapa
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 8)

  el('view-painel').innerHTML = `
    <div class="view-head">
      <div>
        <div class="view-title">Painel</div>
        <div class="view-sub">Inspeção predial por NBR 5674:2012 · NBR 16747:2020 · matriz GUT do IBAPE-NA:2012</div>
      </div>
      ${botaoEscrita('+ Nova inspeção', 'abrirModalInspecao()')}
    </div>

    <div class="kpi-row">
      <div class="kpi kc-accent"><div class="kpi-n">${LOCAIS.length}</div><div class="kpi-l">Locais cadastrados</div></div>
      <div class="kpi kc-blue"><div class="kpi-n">${INSPECOES.length}</div><div class="kpi-l">Inspeções</div></div>
      <div class="kpi kc-warn"><div class="kpi-n">${abertas}</div><div class="kpi-l">Em aberto</div></div>
      <div class="kpi kc-red"><div class="kpi-n">${criticos.length}</div><div class="kpi-l">Itens críticos (GUT &gt; 400)</div></div>
      <div class="kpi kc-warn"><div class="kpi-n">${atencao.length}</div><div class="kpi-l">Itens em atenção</div></div>
      <div class="kpi kc-ok"><div class="kpi-n">${LAUDOS.filter(l => l.status === 'emitido').length}</div><div class="kpi-l">Laudos emitidos</div></div>
    </div>

    <div class="section-split">
      <div class="panel-card">
        <h3>Prioridades por GUT</h3>
        ${criticos.concat(atencao).length ? `<div class="stack">${criticos.concat(atencao).slice(0, 12).map(item => {
          const inspecao = INSPECOES.find(i => i.id === item.inspecao_id)
          return `
            <div class="mat-alert">
              <div class="mat-info">
                <div class="mat-nome">${esc(item.descricao)}</div>
                <div class="mat-stock">${esc(inspecao?.titulo || 'inspeção removida')} · ${esc(item.local_ref || caminhoLocal(inspecao?.local_id))}</div>
              </div>
              <span class="badge ${CONDICAO[item.condicao].badge}">GUT ${item.gut_total}</span>
            </div>`
        }).join('')}</div>` : '<div class="tagline">Nenhuma anomalia pontuada ainda.</div>'}
      </div>
      <div class="stack">
        <div class="panel-card">
          <h3>Anomalias por sistema</h3>
          <div class="stack">
            ${porSistema.map(([sistema, quantidade]) => `
              <div class="mat-alert">
                <div class="mat-info"><div class="mat-nome">${esc(sistema)}</div></div>
                <span class="badge b-warn">${quantidade}</span>
              </div>`).join('') || '<div class="tagline">Sem anomalias registradas.</div>'}
          </div>
        </div>
        <div class="panel-card">
          <h3>Resumo</h3>
          <div class="stack">
            <div class="mat-alert"><div class="mat-info"><div class="mat-nome">Não conformidades marcadas</div></div><span class="badge b-red">${naoConformes.length}</span></div>
            <div class="mat-alert"><div class="mat-info"><div class="mat-nome">Templates de checklist</div></div><span class="badge b-blue">${TEMPLATES.length}</span></div>
            <div class="mat-alert"><div class="mat-info"><div class="mat-nome">Normas de referência</div></div><span class="badge b-blue">${NORMAS.length}</span></div>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderLocais() {
  const filtro = (el('filtro-local')?.value || '').toLowerCase()
  const arvore = montarArvore(LOCAIS)
  const visiveis = filtro
    ? arvore.filter(local => `${local.nome} ${local.codigo || ''} ${local.tipo || ''}`.toLowerCase().includes(filtro))
    : arvore

  const linhas = visiveis.map(local => `
    <tr>
      <td class="hi">${'&nbsp;'.repeat(local.nivel * 4)}${local.nivel ? '└ ' : ''}${esc(local.nome)}</td>
      <td class="mono">${esc(local.codigo || '—')}</td>
      <td>${esc(local.tipo || '—')}</td>
      <td>${esc(AREAS[local.area] || '—')}</td>
      <td><span class="badge ${local.restricao === 'civil' ? 'b-ok' : 'b-warn'}">${esc(local.restricao)}</span></td>
      <td>${botaoEscrita('Editar', `abrirModalLocal(${local.id})`, 'btn-s')}</td>
    </tr>`).join('')

  el('view-locais').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Locais</div><div class="view-sub">${LOCAIS.length} locais na árvore do CMASM</div></div>
      ${botaoEscrita('+ Novo local', 'abrirModalLocal()')}
    </div>
    <div class="filters-inline">
      <input class="control-search" id="filtro-local" placeholder="Filtrar por nome, código ou tipo" value="${esc(filtro)}" oninput="renderLocais()"/>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Local</th><th>Código</th><th>Tipo</th><th>Área</th><th>Restrição</th><th></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="6"><div class="empty"><div class="empty-ico">🏛️</div>Nenhum local encontrado.</div></td></tr>'}</tbody>
    </table></div>
  `
  if (filtro) el('filtro-local').focus()
}

function renderInspecoes() {
  const linhas = INSPECOES.map(inspecao => {
    const itens = itensDaInspecao(inspecao.id)
    const criticos = itens.filter(item => item.condicao === 'critico').length
    return `
      <tr>
        <td class="hi">${esc(inspecao.titulo)}</td>
        <td>${esc(caminhoLocal(inspecao.local_id))}</td>
        <td>${fmtData(inspecao.data_vistoria)}</td>
        <td>Nível ${esc(inspecao.nivel)}</td>
        <td>${esc(inspecao.responsavel_tecnico || '—')}</td>
        <td class="num">${itens.length}${criticos ? ` <span class="badge b-red">${criticos}</span>` : ''}</td>
        <td><span class="badge ${BADGE_INSPECAO[inspecao.status]}">${STATUS_INSPECAO[inspecao.status]}</span></td>
        <td><button class="btn btn-s btn-sm" onclick="abrirChecklist(${inspecao.id})">Abrir</button></td>
      </tr>`
  }).join('')

  el('view-inspecoes').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Inspeções</div><div class="view-sub">${INSPECOES.length} inspeção(ões) registradas</div></div>
      <div class="section-row">
        <button class="btn btn-s btn-sm" onclick="exportarItensCsv()">⬇ CSV de anomalias</button>
        ${botaoEscrita('+ Nova inspeção', 'abrirModalInspecao()')}
      </div>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Título</th><th>Local</th><th>Vistoria</th><th>Nível</th><th>Responsável</th><th>Itens</th><th>Status</th><th></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="8"><div class="empty"><div class="empty-ico">📋</div>Nenhuma inspeção registrada.</div></td></tr>'}</tbody>
    </table></div>
  `
}

function renderChecklist() {
  const inspecao = INSPECOES.find(i => i.id === INSPECAO_ABERTA_ID)
  if (!inspecao) {
    el('view-checklist').innerHTML = `
      <div class="view-title">Checklist</div>
      <div class="view-sub">Abra uma inspeção na aba Inspeções para executar o checklist.</div>`
    return
  }

  const itens = itensDaInspecao(inspecao.id)
  const transicoes = PROXIMOS_STATUS[inspecao.status] || []
  const editavel = podeEscrever() && !['concluida', 'aprovada'].includes(inspecao.status)

  const linhas = itens.map(item => `
    <tr>
      <td class="hi">${esc(item.descricao)}<div class="tagline">${esc(item.categoria || '—')}</div></td>
      <td><input type="checkbox" style="width:auto" ${item.presente ? 'checked' : ''} ${editavel ? '' : 'disabled'}
           onchange="marcarPresente(${item.id}, this.checked)"/></td>
      ${['g', 'u', 't'].map(dim => `
        <td>${selectGut(dim, item, editavel)}</td>`).join('')}
      <td class="num"><span class="badge ${CONDICAO[item.condicao].badge}">${item.gut_total}</span></td>
      <td><input value="${esc(item.local_ref || '')}" ${editavel ? '' : 'disabled'} placeholder="onde"
           onchange="salvarCampoItem(${item.id}, 'local_ref', this.value)"/></td>
      <td><input value="${esc(item.observacao || '')}" ${editavel ? '' : 'disabled'} placeholder="observação"
           onchange="salvarCampoItem(${item.id}, 'observacao', this.value)"/></td>
    </tr>`).join('')

  el('view-checklist').innerHTML = `
    <div class="view-head">
      <div>
        <div class="view-title">${esc(inspecao.titulo)}</div>
        <div class="view-sub">${esc(caminhoLocal(inspecao.local_id))} · nível ${esc(inspecao.nivel)} · ${esc(inspecao.tipo_inspecao)} · ${fmtData(inspecao.data_vistoria)}</div>
      </div>
      <div class="section-row">
        <span class="badge ${BADGE_INSPECAO[inspecao.status]}">${STATUS_INSPECAO[inspecao.status]}</span>
        ${transicoes.map(status => botaoEscrita(
          STATUS_INSPECAO[status], `mudarStatus(${inspecao.id}, '${status}')`,
          status === 'reprovada' ? 'btn-d' : 'btn-s',
        )).join('')}
      </div>
    </div>

    <div class="section-row">
      ${botaoEscrita('Carregar itens do template', `carregarItensDoTemplate(${inspecao.id})`, 'btn-s')}
      ${botaoEscrita('+ Item avulso', `adicionarItemManual(${inspecao.id})`, 'btn-s')}
      ${botaoEscrita('Emitir laudo', `abrirModalLaudo(${inspecao.id})`, 'btn-s')}
    </div>

    <div class="callout co-blue">
      Matriz GUT — cada dimensão vale 0, 1, 3, 6, 8 ou 10.
      Total até 100 é baixo, 101–400 pede atenção e acima de 400 é crítico.
      Marque o quadrado quando a anomalia estiver <strong>presente</strong> no local.
    </div>

    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Item</th><th>Presente</th><th>G</th><th>U</th><th>T</th><th>GUT</th><th>Local</th><th>Observação</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="8"><div class="empty"><div class="empty-ico">📝</div>Sem itens. Carregue o template ou adicione um item avulso.</div></td></tr>'}</tbody>
    </table></div>
  `
}

function selectGut(dim, item, editavel) {
  const opcoes = GUT_ESCALA
    .map(valor => `<option value="${valor}" ${item[dim] === valor ? 'selected' : ''}>${valor || '—'}</option>`)
    .join('')
  return `<select class="control-auto" ${editavel ? '' : 'disabled'}
    onchange="salvarGut(${item.id}, '${dim}', Number(this.value))">${opcoes}</select>`
}

function renderLaudos() {
  const linhas = LAUDOS.map(laudo => `
    <tr>
      <td class="hi">${esc(laudo.titulo)}</td>
      <td>${esc(TIPOS_LAUDO[laudo.tipo] || laudo.tipo)}</td>
      <td>${esc(INSPECOES.find(i => i.id === laudo.inspecao_id)?.titulo || '—')}</td>
      <td>${esc(laudo.responsavel || '—')}</td>
      <td>${fmtData(laudo.data_emissao)}</td>
      <td>${fmtData(laudo.data_validade)}</td>
      <td><span class="badge ${laudo.status === 'emitido' ? 'b-ok' : laudo.status === 'arquivado' ? 'b-blue' : 'b-warn'}">${esc(laudo.status)}</span></td>
    </tr>`).join('')

  el('view-laudos').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Laudos</div><div class="view-sub">${LAUDOS.length} documento(s)</div></div>
      ${botaoEscrita('+ Novo laudo', 'abrirModalLaudo()')}
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Título</th><th>Tipo</th><th>Inspeção</th><th>Responsável</th><th>Emissão</th><th>Validade</th><th>Status</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="7"><div class="empty"><div class="empty-ico">🧾</div>Nenhum laudo emitido.</div></td></tr>'}</tbody>
    </table></div>
  `
}

// ── locais ──
function opcoesLocais(selecionado = null, incluirVazio = true) {
  const opcoes = montarArvore(LOCAIS).map(local =>
    `<option value="${local.id}" ${local.id === selecionado ? 'selected' : ''}>${'— '.repeat(local.nivel)}${esc(local.nome)}</option>`)
  return (incluirVazio ? '<option value="">Sem local</option>' : '') + opcoes.join('')
}

function abrirModalLocal(id = null) {
  if (!exigirEscrita()) return
  LOCAL_EDIT_ID = id
  const local = localPorId(id)
  el('local-titulo').textContent = local ? `Editar ${local.nome}` : 'Novo local'
  el('lo-nome').value = local?.nome || ''
  el('lo-codigo').value = local?.codigo || ''
  el('lo-neo').value = local?.neo || ''
  el('lo-tipo').value = local?.tipo || ''
  el('lo-area').value = local?.area || ''
  el('lo-restricao').value = local?.restricao || 'civil'
  el('lo-parent').innerHTML = opcoesLocais(local?.parent_id ?? null)
  el('lo-descricao').value = local?.descricao || ''
  el('modal-local').classList.add('open')
}

async function salvarLocal() {
  if (!exigirEscrita()) return
  const nome = val('lo-nome')
  if (!nome) return alert('Informe o nome do local.')

  const paiId = val('lo-parent') ? Number(val('lo-parent')) : null
  if (paiId && paiId === LOCAL_EDIT_ID) return alert('Um local não pode ser pai de si mesmo.')

  const registro = {
    nome,
    codigo: val('lo-codigo') || null,
    neo: val('lo-neo') || null,
    tipo: val('lo-tipo') || null,
    area: val('lo-area') || null,
    restricao: val('lo-restricao'),
    parent_id: paiId,
    descricao: val('lo-descricao') || null,
  }

  const { error } = LOCAL_EDIT_ID
    ? await supa.from('pred_locais').update(registro).eq('id', LOCAL_EDIT_ID)
    : await supa.from('pred_locais').insert(registro)
  if (error) return erroSupabase(error)

  fecharModal('local')
  await recarregar()
}

// ── inspeções ──
function abrirModalInspecao() {
  if (!exigirEscrita()) return
  el('in-titulo').value = ''
  el('in-local').innerHTML = opcoesLocais()
  el('in-template').innerHTML = '<option value="">Sem template</option>' + TEMPLATES
    .map(template => `<option value="${template.id}">${esc(template.nome)}</option>`).join('')
  el('in-responsavel').value = USUARIO?.nome || ''
  el('in-data').value = hoje()
  el('in-nivel').value = '1'
  el('in-tipo').value = 'extrinseca'
  el('in-observacoes').value = ''
  el('modal-inspecao').classList.add('open')
}

async function salvarInspecao() {
  if (!exigirEscrita()) return
  const titulo = val('in-titulo')
  if (!titulo) return alert('Informe o título da inspeção.')

  const { data, error } = await supa.from('pred_inspecoes').insert({
    titulo,
    local_id: val('in-local') ? Number(val('in-local')) : null,
    template_id: val('in-template') ? Number(val('in-template')) : null,
    responsavel_tecnico: val('in-responsavel') || null,
    data_vistoria: val('in-data') || null,
    nivel: val('in-nivel'),
    tipo_inspecao: val('in-tipo'),
    observacoes: val('in-observacoes') || null,
  }).select().single()
  if (error) return erroSupabase(error)

  await registrarEvento(data.id, null, 'planejada', 'inspeção criada')
  fecharModal('inspecao')
  await recarregar()
  abrirChecklist(data.id)
}

function abrirChecklist(id) {
  INSPECAO_ABERTA_ID = id
  renderChecklist()
  const botao = [...document.querySelectorAll('.nav-btn')].find(b => b.textContent.includes('Checklist'))
  trocarView('checklist', botao)
}

async function registrarEvento(inspecaoId, de, para, motivo) {
  await supa.from('pred_eventos').insert({
    inspecao_id: inspecaoId,
    de_status: de,
    para_status: para,
    responsavel: USUARIO?.nome || null,
    motivo: motivo || null,
  })
}

async function mudarStatus(inspecaoId, novoStatus) {
  if (!exigirEscrita()) return
  const inspecao = INSPECOES.find(i => i.id === inspecaoId)
  if (!inspecao) return
  if (!(PROXIMOS_STATUS[inspecao.status] || []).includes(novoStatus)) {
    return alert(`Transição não permitida: ${STATUS_INSPECAO[inspecao.status]} → ${STATUS_INSPECAO[novoStatus]}.`)
  }

  const motivo = novoStatus === 'reprovada' ? prompt('Motivo da reprovação:') : null
  if (novoStatus === 'reprovada' && !motivo) return

  const { error } = await supa.from('pred_inspecoes')
    .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
    .eq('id', inspecaoId)
  if (error) return erroSupabase(error)

  await registrarEvento(inspecaoId, inspecao.status, novoStatus, motivo)
  await recarregar()
}

// ── itens do checklist ──
async function carregarItensDoTemplate(inspecaoId) {
  if (!exigirEscrita()) return
  const inspecao = INSPECOES.find(i => i.id === inspecaoId)
  if (!inspecao?.template_id) return alert('Esta inspeção não tem template associado.')

  const doTemplate = TEMPLATE_ITENS.filter(item => item.template_id === inspecao.template_id)
  if (!doTemplate.length) return alert('Template sem itens cadastrados.')

  const jaExistem = new Set(itensDaInspecao(inspecaoId).map(item => item.descricao))
  const novos = doTemplate
    .filter(item => !jaExistem.has(item.descricao))
    .map(item => ({
      inspecao_id: inspecaoId,
      descricao: item.descricao,
      categoria: item.sistema,
      item_origem: 'template',
    }))

  if (!novos.length) return alert('Todos os itens do template já estão na inspeção.')

  const { error } = await supa.from('pred_inspecao_itens').insert(novos)
  if (error) return erroSupabase(error)
  await recarregar()
}

async function adicionarItemManual(inspecaoId) {
  if (!exigirEscrita()) return
  const descricao = prompt('Descrição da anomalia:')
  if (!descricao?.trim()) return

  const { error } = await supa.from('pred_inspecao_itens').insert({
    inspecao_id: inspecaoId,
    descricao: descricao.trim(),
    categoria: prompt('Sistema / categoria (opcional):')?.trim() || null,
    item_origem: 'manual',
  })
  if (error) return erroSupabase(error)
  await recarregar()
}

// gut_total e condicao são colunas geradas no banco — só gravamos g, u e t.
async function salvarGut(itemId, dimensao, valor) {
  if (!exigirEscrita()) return
  const { error } = await supa.from('pred_inspecao_itens')
    .update({ [dimensao]: valor }).eq('id', itemId)
  if (error) return erroSupabase(error)

  const item = ITENS.find(i => i.id === itemId)
  if (item) {
    item[dimensao] = valor
    item.gut_total = item.g * item.u * item.t
    item.condicao = classificarGut(item.gut_total)
  }
  renderChecklist()
}

async function marcarPresente(itemId, presente) {
  if (!exigirEscrita()) return
  const { error } = await supa.from('pred_inspecao_itens')
    .update({ presente }).eq('id', itemId)
  if (error) return erroSupabase(error)
  const item = ITENS.find(i => i.id === itemId)
  if (item) item.presente = presente
}

async function salvarCampoItem(itemId, campo, valor) {
  if (!exigirEscrita()) return
  const { error } = await supa.from('pred_inspecao_itens')
    .update({ [campo]: valor.trim() || null }).eq('id', itemId)
  if (error) return erroSupabase(error)
  const item = ITENS.find(i => i.id === itemId)
  if (item) item[campo] = valor.trim() || null
}

// ── laudos ──
function abrirModalLaudo(inspecaoId = null) {
  if (!exigirEscrita()) return
  const inspecao = INSPECOES.find(i => i.id === inspecaoId)
  el('la-titulo').value = inspecao ? `Laudo — ${inspecao.titulo}` : ''
  el('la-inspecao').innerHTML = '<option value="">Sem inspeção</option>' + INSPECOES
    .map(i => `<option value="${i.id}" ${i.id === inspecaoId ? 'selected' : ''}>${esc(i.titulo)}</option>`).join('')
  el('la-local').innerHTML = opcoesLocais(inspecao?.local_id ?? null)
  el('la-responsavel').value = USUARIO?.nome || ''
  el('la-emissao').value = hoje()
  el('la-validade').value = ''
  el('la-art').value = ''
  el('la-conteudo').value = inspecao ? resumoDaInspecao(inspecao) : ''
  el('modal-laudo').classList.add('open')
}

// Rascunho do laudo com as anomalias já pontuadas, em ordem de prioridade.
function resumoDaInspecao(inspecao) {
  const itens = itensDaInspecao(inspecao.id)
    .filter(item => item.presente || item.gut_total > 0)
    .sort((a, b) => b.gut_total - a.gut_total)

  const linhas = itens.map(item =>
    `- [${CONDICAO[item.condicao].rotulo}] GUT ${item.gut_total} · ${item.descricao}` +
    `${item.local_ref ? ` (${item.local_ref})` : ''}${item.observacao ? ` — ${item.observacao}` : ''}`)

  return [
    `Inspeção: ${inspecao.titulo}`,
    `Local: ${caminhoLocal(inspecao.local_id)}`,
    `Vistoria: ${fmtData(inspecao.data_vistoria)} · nível ${inspecao.nivel} · ${inspecao.tipo_inspecao}`,
    `Responsável técnico: ${inspecao.responsavel_tecnico || '—'}`,
    '',
    `Anomalias registradas (${itens.length}):`,
    ...(linhas.length ? linhas : ['- nenhuma anomalia pontuada']),
  ].join('\n')
}

async function salvarLaudo() {
  if (!exigirEscrita()) return
  const titulo = val('la-titulo')
  if (!titulo) return alert('Informe o título do laudo.')

  const { error } = await supa.from('pred_laudos').insert({
    titulo,
    inspecao_id: val('la-inspecao') ? Number(val('la-inspecao')) : null,
    local_id: val('la-local') ? Number(val('la-local')) : null,
    tipo: val('la-tipo'),
    numero_art: val('la-art') || null,
    responsavel: val('la-responsavel') || null,
    data_emissao: val('la-emissao') || null,
    data_validade: val('la-validade') || null,
    conteudo: val('la-conteudo') || null,
    status: val('la-status'),
  })
  if (error) return erroSupabase(error)

  fecharModal('laudo')
  await recarregar()
}

// ── exportação ──
function csvEscape(valor) {
  const texto = String(valor ?? '')
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function exportarItensCsv() {
  const linhas = ITENS.map(item => {
    const inspecao = INSPECOES.find(i => i.id === item.inspecao_id)
    return [
      inspecao?.titulo || '', caminhoLocal(inspecao?.local_id), fmtData(inspecao?.data_vistoria),
      item.categoria || '', item.descricao, item.presente ? 'sim' : 'nao',
      item.g, item.u, item.t, item.gut_total, CONDICAO[item.condicao].rotulo,
      item.local_ref || '', item.observacao || '',
    ]
  })

  const csv = [
    ['inspecao', 'local', 'vistoria', 'sistema', 'anomalia', 'presente', 'g', 'u', 't', 'gut', 'faixa', 'local_ref', 'observacao'],
    ...linhas,
  ].map(colunas => colunas.map(csvEscape).join(';')).join('\n')

  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `predial-anomalias-${hoje()}.csv`
  link.click()
  URL.revokeObjectURL(url)
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
      <strong>Falha ao iniciar o módulo Predial.</strong><br>
      ${esc(error.message || String(error))}
    </div>`
}

function exporNoWindow() {
  Object.assign(window, {
    abrirChecklist, abrirModalInspecao, abrirModalLaudo, abrirModalLocal,
    adicionarItemManual, carregarItensDoTemplate, exportarItensCsv, fecharModal,
    marcarPresente, mudarStatus, renderLocais, sair, salvarCampoItem, salvarGut,
    salvarInspecao, salvarLaudo, salvarLocal, trocarView,
  })
}

async function boot() {
  exporNoWindow()
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', evento => {
      if (evento.target === overlay) overlay.classList.remove('open')
    })
  })

  try {
    supa = await criarClienteSupabase()
  } catch (error) {
    mostrarErroBoot(error)
    return
  }

  auth = new Auth(supa, { appNome: 'Predial', appIcone: '🏛️' })
  auth.onLogin(usuario => {
    USUARIO = usuario
    mostrarApp()
  })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}

boot()
