import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { aplicarShell } from '../shared/shell.js'

let supa = null
let auth = null
let USUARIO = null

let ATIVOS = []
let VIAGENS = []
let MANUTENCOES = []
let PLANOS = []
let PLANO_MATS = []
let MATERIAIS = []
let ESTOQUE_MOV = []
let COMPRAS = []
let ERRO_CARGA = null

let ATIVO_EDIT_ID = null
let VIAGEM_EDIT_ID = null
let PLANO_EDIT_ID = null
let MATERIAL_EDIT_ID = null

const LIMIAR_PROXIMO = 80
const LIMIAR_COMPRAS = 70

const STATUS_ATIVO = {
  disponivel: 'Disponível',
  em_uso: 'Em uso',
  manutencao: 'Manutenção',
  sobreaviso: 'Sobreaviso',
  indisponivel: 'Indisponível',
}

const STATUS_VIAGEM = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_BADGE = {
  disponivel: 'b-ok',
  em_uso: 'b-blue',
  manutencao: 'b-warn',
  sobreaviso: 'b-accent',
  indisponivel: 'b-red',
  agendada: 'b-blue',
  em_andamento: 'b-warn',
  concluida: 'b-ok',
  cancelada: 'b-red',
  pendente: 'b-warn',
}

const TIPO_MANUTENCAO = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
  inspecao: 'Inspeção',
}

const STATUS_OS = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const ROLES_ESCRITA = ['admin', 'gestor', 'tecnico']

function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[caractere])
}

function podeEditar() {
  return ROLES_ESCRITA.includes(USUARIO?.role)
}

function fmtDate(valor) {
  if (!valor) return '—'
  const [ano, mes, dia] = String(valor).slice(0, 10).split('-')
  if (!ano || !mes || !dia) return valor
  return `${dia}/${mes}/${ano}`
}

function fmtDateTime(data, hora) {
  return hora ? `${fmtDate(data)} ${String(hora).slice(0, 5)}` : fmtDate(data)
}

function badgeStatus(chave, mapa) {
  return `<span class="badge ${STATUS_BADGE[chave] || 'b-blue'}">${esc((mapa || STATUS_ATIVO)[chave] || chave)}</span>`
}

function obterTripulacao(viagem) {
  return [viagem.motorista_nome, viagem.patrao_nome, viagem.mo_nome].filter(Boolean).join(' · ') || '—'
}

function ordenarViagens(lista) {
  return [...lista].sort((a, b) => {
    const ka = `${a.data_saida || ''} ${a.hora_saida_prevista || ''}`
    const kb = `${b.data_saida || ''} ${b.hora_saida_prevista || ''}`
    return kb.localeCompare(ka)
  })
}

function calcularAlertasManutencao() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  return ATIVOS
    .filter(ativo => ativo.ativo !== false && ativo.prox_manutencao)
    .map(ativo => {
      const alvo = new Date(`${ativo.prox_manutencao}T12:00:00`)
      const dias = Math.ceil((alvo - hoje) / 86400000)
      return { ativo, dias }
    })
    .sort((a, b) => a.dias - b.dias)
}

function obterResumoRelatorio() {
  return {
    viagens: VIAGENS.length,
    passageiros: VIAGENS.reduce((total, viagem) => total + Number(viagem.passageiros || 0), 0),
    cargaKg: VIAGENS.reduce((total, viagem) => total + Number(viagem.carga_kg || 0), 0),
    uso: ATIVOS.reduce((total, ativo) => total + Number(ativo.uso_atual || 0), 0),
  }
}

function mostrarLogin() {
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('app').style.display = 'none'
}

function mostrarApp() {
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('app').style.display = 'block'
  atualizarCabecalhoUsuario()
  aplicarPermissoes()
  carregarTudo()
}

function atualizarCabecalhoUsuario() {
  const texto = USUARIO
    ? `${USUARIO.funcao || USUARIO.posto_graduacao || USUARIO.nome || 'Usuário'} · ${USUARIO.role}`
    : 'Livre · observador'
  document.getElementById('user-chip').textContent = texto
}

function aplicarPermissoes() {
  const esconder = !podeEditar()
  document.getElementById('btn-novo-ativo').classList.toggle('hidden', esconder)
  document.getElementById('btn-nova-viagem').classList.toggle('hidden', esconder)
  document.getElementById('btn-nova-manut').classList.toggle('hidden', esconder)
  document.getElementById('btn-novo-plano').classList.toggle('hidden', esconder)
  document.getElementById('btn-novo-material').classList.toggle('hidden', esconder)
  document.getElementById('btn-novo-movimento').classList.toggle('hidden', esconder)
}

function renderErroPainel() {
  const el = document.getElementById('painel-erro')
  if (!ERRO_CARGA) {
    el.innerHTML = ''
    return
  }

  el.innerHTML = `<div class="callout co-red">Não foi possível carregar as tabelas do módulo Transportes. Detalhe: ${esc(ERRO_CARGA)}. Execute as migrações [10_transportes_schema.sql](/home/luc/Downloads/pmoc-overlay/supabase/10_transportes_schema.sql) e [11_transportes_seed.sql](/home/luc/Downloads/pmoc-overlay/supabase/11_transportes_seed.sql) no Supabase.</div>`
}

async function carregarTudo() {
  try {
    const [ativosRes, viagensRes, manutRes, planosRes, planoMatsRes, materiaisRes, movRes] = await Promise.all([
      supa.from('transp_ativos').select('*').order('codigo'),
      supa.from('transp_viagens').select('*, transp_ativos(codigo,nome,tipo,unidade_uso)').order('data_saida', { ascending: false }).order('hora_saida_prevista', { ascending: false }),
      supa.from('transp_manutencoes').select('*, transp_ativos(codigo,nome)').order('data_manutencao', { ascending: false }),
      supa.from('transp_planos').select('*').order('ordem'),
      supa.from('transp_plano_materiais').select('*'),
      supa.from('transp_materiais').select('*').order('nome'),
      supa.from('transp_estoque_movimentos').select('*, transp_materiais(nome,unidade)').order('registrado_em', { ascending: false }).limit(200),
    ])

    const erro = ativosRes.error || viagensRes.error || manutRes.error || planosRes.error || planoMatsRes.error || materiaisRes.error || movRes.error
    if (erro) throw erro

    ERRO_CARGA = null
    ATIVOS = ativosRes.data || []
    VIAGENS = viagensRes.data || []
    MANUTENCOES = manutRes.data || []
    PLANOS = planosRes.data || []
    PLANO_MATS = planoMatsRes.data || []
    MATERIAIS = materiaisRes.data || []
    ESTOQUE_MOV = movRes.data || []
  } catch (error) {
    ERRO_CARGA = error.message || String(error)
    ATIVOS = []
    VIAGENS = []
    MANUTENCOES = []
    PLANOS = []
    PLANO_MATS = []
    MATERIAIS = []
    ESTOQUE_MOV = []
  }

  renderTudo()
}

function renderTudo() {
  renderPainel()
  renderAtivos()
  renderViagens()
  renderManutencoes()
  renderPlanos()
  renderVencimentos()
  renderMateriais()
  renderMovimentos()
  renderCompras()
  renderRelatorios()
}

function trocarView(id, botao) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(item => item.classList.remove('active'))
  document.getElementById(`view-${id}`).classList.add('active')
  botao.classList.add('active')
}

function renderPainel() {
  renderErroPainel()

  const disponiveis = ATIVOS.filter(ativo => ativo.status === 'disponivel').length
  const sobreaviso = ATIVOS.filter(ativo => ativo.status === 'sobreaviso').length
  const alertas = calcularAlertasManutencao().filter(item => item.dias <= 30).length

  document.getElementById('kpi-total').textContent = ATIVOS.length
  document.getElementById('kpi-disponiveis').textContent = disponiveis
  document.getElementById('kpi-sobreaviso').textContent = sobreaviso
  document.getElementById('kpi-viagens').textContent = VIAGENS.length
  document.getElementById('kpi-manut').textContent = alertas
  document.getElementById('kpi-vencidas').textContent = calcVencimentos().filter(item => item.falta <= 0).length

  const painelViagens = document.getElementById('painel-viagens')
  const agoraChave = `${new Date().toISOString().slice(0, 10)} ${new Date().toTimeString().slice(0, 5)}`
  const ordenadas = ordenarViagens(VIAGENS)
  const proximas = ordenadas.filter(viagem => `${viagem.data_saida || ''} ${String(viagem.hora_saida_prevista || '').slice(0, 5)}` >= agoraChave).slice().reverse()
  const basePainel = (proximas.length ? proximas : ordenadas).slice(0, 5)

  if (!basePainel.length) {
    painelViagens.innerHTML = '<div class="empty"><div class="empty-ico">🗺️</div><p>Nenhuma viagem cadastrada.</p></div>'
  } else {
    painelViagens.innerHTML = basePainel.map(viagem => `
      <div class="mat-alert">
        <div class="mat-info">
          <div class="mat-nome">${esc(viagem.transp_ativos?.codigo || 'Sem ativo')} — ${esc(viagem.destino || '—')}</div>
          <div class="mat-stock">${fmtDateTime(viagem.data_saida, viagem.hora_saida_prevista)} · ${esc(viagem.missao || '—')}</div>
        </div>
        ${badgeStatus(viagem.status, STATUS_VIAGEM)}
      </div>
    `).join('')
  }

  const painelAtivos = document.getElementById('painel-ativos-alerta')
  const ativosAtencao = ATIVOS.filter(ativo => ativo.status !== 'disponivel')
  const primeirosAlertas = calcularAlertasManutencao().slice(0, 3)

  if (!ativosAtencao.length && !primeirosAlertas.length) {
    painelAtivos.innerHTML = '<div class="empty"><div class="empty-ico">✅</div><p>Sem alertas no momento.</p></div>'
    return
  }

  const blocos = []
  for (const ativo of ativosAtencao.slice(0, 4)) {
    blocos.push(`
      <div class="mat-alert">
        <div class="mat-info">
          <div class="mat-nome">${esc(ativo.codigo)} — ${esc(ativo.nome)}</div>
          <div class="mat-stock">${esc(STATUS_ATIVO[ativo.status] || ativo.status)}</div>
        </div>
        ${badgeStatus(ativo.status, STATUS_ATIVO)}
      </div>
    `)
  }
  for (const alerta of primeirosAlertas) {
    const textoDias = alerta.dias < 0 ? `vencida há ${Math.abs(alerta.dias)} dia(s)` : `vence em ${alerta.dias} dia(s)`
    blocos.push(`
      <div class="mat-alert">
        <div class="mat-info">
          <div class="mat-nome">${esc(alerta.ativo.codigo)} — ${esc(alerta.ativo.nome)}</div>
          <div class="mat-stock">Preventiva ${textoDias}</div>
        </div>
        <span class="badge ${alerta.dias < 0 ? 'b-red' : 'b-warn'}">${fmtDate(alerta.ativo.prox_manutencao)}</span>
      </div>
    `)
  }
  painelAtivos.innerHTML = blocos.join('')
}

function renderAtivos() {
  const tipo = document.getElementById('filtro-ativo-tipo').value
  const status = document.getElementById('filtro-ativo-status').value
  const busca = document.getElementById('filtro-ativo-busca').value.trim().toLowerCase()
  const tbody = document.getElementById('tb-ativos')

  const lista = ATIVOS.filter(ativo => {
    const texto = `${ativo.codigo || ''} ${ativo.nome || ''} ${ativo.identificacao || ''}`.toLowerCase()
    return (!tipo || ativo.tipo === tipo)
      && (!status || ativo.status === status)
      && (!busca || texto.includes(busca))
  })

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="tagline">Nenhum ativo encontrado.</td></tr>'
    return
  }

  tbody.innerHTML = lista.map(ativo => `
    <tr>
      <td class="hi mono">${esc(ativo.codigo)}</td>
      <td>
        <div class="hi">${esc(ativo.nome)}</div>
        <div class="tagline">${esc(ativo.subtipo || '—')}</div>
      </td>
      <td>${esc(ativo.tipo === 'embarcacao' ? 'Embarcação' : 'Viatura')}</td>
      <td class="mono">${esc(ativo.identificacao || '—')}</td>
      <td>${Number(ativo.uso_atual || 0).toLocaleString('pt-BR')} ${esc(ativo.unidade_uso || '')}</td>
      <td>${badgeStatus(ativo.status, STATUS_ATIVO)}</td>
      <td>${fmtDate(ativo.prox_manutencao)}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${podeEditar() ? `<button class="btn btn-s btn-sm" onclick="abrirModalViagem(${ativo.id})">+ Viagem</button>` : ''}
          ${podeEditar() ? `<button class="btn btn-s btn-sm" onclick="abrirModalManutencao(${ativo.id})">+ Manut.</button>` : ''}
          ${podeEditar() ? `<button class="btn btn-s btn-sm" onclick="abrirModalAtivo(${ativo.id})">Editar</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('')
}

function renderViagens() {
  const status = document.getElementById('filtro-viagem-status').value
  const busca = document.getElementById('filtro-viagem-busca').value.trim().toLowerCase()
  const tbody = document.getElementById('tb-viagens')

  const lista = ordenarViagens(VIAGENS).filter(viagem => {
    const texto = `${viagem.destino || ''} ${viagem.missao || ''} ${viagem.motorista_nome || ''} ${viagem.patrao_nome || ''} ${viagem.mo_nome || ''} ${viagem.transp_ativos?.codigo || ''} ${viagem.transp_ativos?.nome || ''}`.toLowerCase()
    return (!status || viagem.status === status)
      && (!busca || texto.includes(busca))
  })

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="tagline">Nenhuma viagem encontrada.</td></tr>'
    return
  }

  tbody.innerHTML = lista.slice(0, 200).map(viagem => `
    <tr>
      <td class="mono">${fmtDateTime(viagem.data_saida, viagem.hora_saida_prevista)}</td>
      <td>
        <div class="hi">${esc(viagem.transp_ativos?.codigo || 'Sem ativo')}</div>
        <div class="tagline">${esc(viagem.transp_ativos?.nome || '—')}</div>
      </td>
      <td>${esc(viagem.destino || '—')}</td>
      <td>${esc(viagem.missao || '—')}</td>
      <td>${esc(obterTripulacao(viagem))}</td>
      <td>${badgeStatus(viagem.status, STATUS_VIAGEM)}</td>
      <td>${podeEditar() ? `<button class="btn btn-s btn-sm" onclick="abrirModalViagem(null,'${viagem.id}')">Editar</button>` : '—'}</td>
    </tr>
  `).join('')
}

function renderManutencoes() {
  const alertas = calcularAlertasManutencao().filter(item => item.dias <= 30)
  const divAlertas = document.getElementById('manut-alertas')
  if (!alertas.length) {
    divAlertas.innerHTML = '<div class="callout co-ok">Nenhum ativo com manutenção vencida ou próxima nos próximos 30 dias.</div>'
  } else {
    divAlertas.innerHTML = alertas.map(item => `
      <div class="callout ${item.dias < 0 ? 'co-red' : 'co-warn'}">
        <strong>${esc(item.ativo.codigo)} — ${esc(item.ativo.nome)}</strong>: manutenção ${item.dias < 0 ? `vencida há ${Math.abs(item.dias)} dia(s)` : `vence em ${item.dias} dia(s)`} (${fmtDate(item.ativo.prox_manutencao)}).
      </div>
    `).join('')
  }

  const tbody = document.getElementById('tb-manutencoes')
  if (!MANUTENCOES.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="tagline">Nenhuma manutenção registrada.</td></tr>'
    return
  }

  tbody.innerHTML = MANUTENCOES.map(item => `
    <tr>
      <td class="mono">${fmtDate(item.data_manutencao)}</td>
      <td>
        <div class="hi">${esc(item.transp_ativos?.codigo || '—')}</div>
        <div class="tagline">${esc(item.transp_ativos?.nome || '—')}</div>
      </td>
      <td>${badgeStatus(item.tipo, TIPO_MANUTENCAO)}</td>
      <td>${esc(item.descricao || '—')}</td>
      <td>${item.uso_referencia == null ? '—' : `${Number(item.uso_referencia).toLocaleString('pt-BR')} ${esc(ATIVOS.find(ativo => ativo.id === item.ativo_id)?.unidade_uso || '')}`}</td>
      <td>${fmtDate(item.prox_manutencao)}</td>
      <td>${esc(item.executado_por || item.fornecedor || '—')}</td>
      <td>${badgeStatus(item.status || 'concluida', STATUS_OS)}</td>
      <td>${podeEditar() && item.status !== 'concluida' ? `<button class="btn btn-s btn-sm" onclick="concluirOS('${item.id}')">Concluir OS</button>` : '—'}</td>
    </tr>
  `).join('')
}

// ── planos e vencimento por uso ──

function unidadeDoModelo(tipoModelo) {
  const ativo = ATIVOS.find(item => item.ativo !== false && item.tipo_modelo === tipoModelo)
  return ativo ? ativo.unidade_uso : null
}

function modelosDisponiveis() {
  const modelos = new Set(ATIVOS.filter(ativo => ativo.ativo !== false && ativo.tipo_modelo).map(ativo => ativo.tipo_modelo))
  return [...modelos].sort((a, b) => a.localeCompare(b))
}

function calcVencimentos() {
  const items = []
  for (const ativo of ATIVOS) {
    if (ativo.ativo === false || !ativo.tipo_modelo) continue
    const planosAtivo = PLANOS.filter(plano => plano.ativo !== false && plano.tipo_modelo === ativo.tipo_modelo)
    for (const plano of planosAtivo) {
      if (plano.unidade !== ativo.unidade_uso) continue

      const ultimaManutencao = MANUTENCOES.find(item =>
        item.ativo_id === ativo.id
        && item.plano_id === plano.id
        && (item.status == null || item.status === 'concluida'))
      const base = ultimaManutencao ? Number(ultimaManutencao.uso_referencia || 0) : 0
      const proxUso = base + Number(plano.intervalo)
      const falta = proxUso - Number(ativo.uso_atual || 0)
      const pct = Math.min(100, Math.max(0, Math.round(((Number(ativo.uso_atual || 0) - base) / Number(plano.intervalo)) * 100)))
      items.push({ ativo, plano, proxUso, falta, pct })
    }
  }
  return items.sort((a, b) => b.pct - a.pct)
}

function renderVencimentos() {
  const items = calcVencimentos().filter(item => item.falta <= 0 || item.pct >= LIMIAR_PROXIMO)
  const html = !items.length
    ? '<div class="callout co-ok">Nenhuma manutenção vencida ou próxima por uso no momento.</div>'
    : items.map(item => {
      const vencida = item.falta <= 0
      const textoFalta = vencida
        ? `vencida há ${Math.abs(item.falta).toFixed(1)} ${esc(item.plano.unidade)}`
        : `faltam ${item.falta.toFixed(1)} ${esc(item.plano.unidade)}`
      return `
        <div class="mat-alert">
          <div class="mat-info">
            <div class="mat-nome">${esc(item.ativo.codigo)} — ${esc(item.ativo.nome)}</div>
            <div class="mat-stock">${esc(item.plano.nome)} · a cada ${item.plano.intervalo} ${esc(item.plano.unidade)} · ${textoFalta} · ${item.pct}% do intervalo</div>
          </div>
          <span class="badge ${vencida ? 'b-red' : 'b-warn'}">${vencida ? 'VENCIDA' : 'PRÓXIMA'}</span>
        </div>
      `
    }).join('')

  const vencLista = document.getElementById('venc-lista')
  if (vencLista) vencLista.innerHTML = html
  const vencListaManut = document.getElementById('venc-lista-manut')
  if (vencListaManut) vencListaManut.innerHTML = html

  const kpiVencidas = document.getElementById('kpi-vencidas')
  if (kpiVencidas) kpiVencidas.textContent = items.filter(item => item.falta <= 0).length
}

function renderPlanos() {
  const tbody = document.getElementById('tb-planos')

  if (!PLANOS.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="tagline">Nenhum plano cadastrado.</td></tr>'
    return
  }

  tbody.innerHTML = PLANOS.map(plano => `
    <tr>
      <td class="hi">${esc(plano.tipo_modelo)}</td>
      <td>${esc(plano.nome)}</td>
      <td>${Number(plano.intervalo).toLocaleString('pt-BR')}</td>
      <td>${esc(plano.unidade)}</td>
      <td>${esc(plano.ordem ?? 0)}</td>
      <td>${plano.ativo === false ? '<span class="badge b-red">Inativo</span>' : '<span class="badge b-ok">Ativo</span>'}</td>
      <td>${podeEditar() ? `<button class="btn btn-s btn-sm" onclick="abrirModalPlano(${plano.id})">Editar</button>` : '—'}</td>
    </tr>
  `).join('')
}

function abrirModalPlano(id = null) {
  if (!podeEditar()) return

  PLANO_EDIT_ID = null
  document.getElementById('titulo-modal-plano').textContent = 'Novo plano'

  const selectModelo = document.getElementById('pl-tipo-modelo')
  const modelos = modelosDisponiveis()
  selectModelo.innerHTML = modelos.map(modelo => `<option value="${esc(modelo)}">${esc(modelo)}</option>`).join('')

  const atualizarUnidade = () => {
    document.getElementById('pl-unidade').value = unidadeDoModelo(selectModelo.value) || 'km'
  }
  selectModelo.onchange = atualizarUnidade

  document.getElementById('pl-nome').value = ''
  document.getElementById('pl-intervalo').value = ''
  document.getElementById('pl-ordem').value = 0
  document.getElementById('pl-ativo').value = 'true'
  document.getElementById('pl-descricao').value = ''

  if (id != null) {
    const plano = PLANOS.find(item => item.id === id)
    if (!plano) return
    PLANO_EDIT_ID = plano.id
    document.getElementById('titulo-modal-plano').textContent = 'Editar plano'
    selectModelo.value = plano.tipo_modelo
    document.getElementById('pl-nome').value = plano.nome || ''
    document.getElementById('pl-intervalo').value = plano.intervalo ?? ''
    document.getElementById('pl-ordem').value = plano.ordem ?? 0
    document.getElementById('pl-ativo').value = plano.ativo === false ? 'false' : 'true'
    document.getElementById('pl-descricao').value = plano.descricao || ''
  }

  atualizarUnidade()
  document.getElementById('modal-plano').classList.add('open')
  renderPecasDoPlano()
}

function renderPecasDoPlano() {
  const aviso = document.getElementById('pl-materiais-aviso')
  const selectAdd = document.getElementById('pl-material-add')
  const qtdInput = document.getElementById('pl-material-qtd')
  const btnAdd = document.getElementById('btn-add-peca')
  const container = document.getElementById('pl-materiais')

  if (PLANO_EDIT_ID == null) {
    aviso.textContent = 'Salve o plano antes de vincular peças.'
    selectAdd.disabled = true
    qtdInput.disabled = true
    btnAdd.disabled = true
    container.innerHTML = ''
    return
  }

  aviso.textContent = ''
  selectAdd.disabled = false
  qtdInput.disabled = false
  btnAdd.disabled = false

  const disponiveis = MATERIAIS.filter(material => material.ativo !== false)
  selectAdd.innerHTML = disponiveis.map(material => `<option value="${material.id}">${esc(material.nome)}</option>`).join('')

  const vinculadas = PLANO_MATS.filter(item => item.plano_id === PLANO_EDIT_ID)

  if (!vinculadas.length) {
    container.innerHTML = '<div class="tagline">Nenhuma peça vinculada a este plano.</div>'
    return
  }

  container.innerHTML = vinculadas.map(item => {
    const material = MATERIAIS.find(mat => mat.id === item.material_id)
    return `
      <div class="mat-alert">
        <div class="mat-info">
          <div class="mat-nome">${esc(material?.nome || 'Peça removida')}</div>
          <div class="mat-stock">Quantidade prevista: ${Number(item.quantidade).toLocaleString('pt-BR')} ${esc(material?.unidade || 'un')}</div>
        </div>
        ${podeEditar() ? `<button class="btn btn-d btn-sm" onclick="removerPecaDoPlano(${item.id})">Remover</button>` : ''}
      </div>
    `
  }).join('')
}

async function adicionarPecaAoPlano() {
  if (!podeEditar()) return
  if (PLANO_EDIT_ID == null) {
    alert('Salve o plano antes de vincular peças.')
    return
  }

  const materialId = Number(document.getElementById('pl-material-add').value)
  const quantidade = Number(document.getElementById('pl-material-qtd').value)

  if (!materialId) {
    alert('Selecione uma peça.')
    return
  }
  if (!quantidade || quantidade <= 0) {
    alert('Informe uma quantidade maior que zero.')
    return
  }

  const resposta = await supa.from('transp_plano_materiais')
    .upsert({ plano_id: PLANO_EDIT_ID, material_id: materialId, quantidade }, { onConflict: 'plano_id,material_id' })

  if (resposta.error) {
    alert(`Erro: ${resposta.error.message}`)
    return
  }

  await carregarTudo()
  renderPecasDoPlano()
}

async function removerPecaDoPlano(id) {
  if (!podeEditar()) return

  const resposta = await supa.from('transp_plano_materiais').delete().eq('id', id)
  if (resposta.error) {
    alert(`Erro: ${resposta.error.message}`)
    return
  }

  await carregarTudo()
  renderPecasDoPlano()
}

async function salvarPlano() {
  if (!podeEditar()) return

  const tipoModelo = document.getElementById('pl-tipo-modelo').value
  const nome = document.getElementById('pl-nome').value.trim()
  const intervalo = Number(document.getElementById('pl-intervalo').value)

  if (!tipoModelo || !nome) {
    alert('Selecione o modelo e informe o nome do plano.')
    return
  }
  if (!intervalo || intervalo <= 0) {
    alert('Informe um intervalo maior que zero.')
    return
  }

  const unidade = unidadeDoModelo(tipoModelo)
  if (!unidade) {
    alert('Nenhum ativo ativo encontrado para este modelo — cadastre o ativo antes do plano.')
    return
  }

  const payload = {
    tipo_modelo: tipoModelo,
    nome,
    intervalo,
    unidade,
    ordem: Number(document.getElementById('pl-ordem').value || 0),
    ativo: document.getElementById('pl-ativo').value === 'true',
    descricao: document.getElementById('pl-descricao').value.trim() || null,
  }

  const resposta = PLANO_EDIT_ID == null
    ? await supa.from('transp_planos').insert(payload)
    : await supa.from('transp_planos').update(payload).eq('id', PLANO_EDIT_ID)

  if (resposta.error) {
    alert(`Erro: ${resposta.error.message}`)
    return
  }

  fecharModal('plano')
  await carregarTudo()
}

// ── estoque de peças ──

function materiaisAbaixoDoMinimo() {
  return MATERIAIS.filter(material =>
    material.ativo !== false
    && Number(material.estoque_minimo || 0) > 0
    && Number(material.estoque_atual || 0) < Number(material.estoque_minimo || 0))
}

function renderMateriais() {
  const tbody = document.getElementById('tb-materiais')
  const divAlertas = document.getElementById('estoque-alertas')
  const kpiEstoqueBaixo = document.getElementById('kpi-estoque-baixo')
  const abaixoDoMinimo = materiaisAbaixoDoMinimo()

  if (kpiEstoqueBaixo) kpiEstoqueBaixo.textContent = abaixoDoMinimo.length

  if (divAlertas) {
    divAlertas.innerHTML = !abaixoDoMinimo.length
      ? '<div class="callout co-ok">Nenhuma peça abaixo do estoque mínimo no momento.</div>'
      : abaixoDoMinimo.map(material => `
        <div class="callout co-warn">
          <strong>${esc(material.nome)}</strong>: saldo ${Number(material.estoque_atual || 0).toLocaleString('pt-BR')} ${esc(material.unidade || 'un')}, mínimo ${Number(material.estoque_minimo || 0).toLocaleString('pt-BR')} ${esc(material.unidade || 'un')}.
        </div>
      `).join('')
  }

  if (!MATERIAIS.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="tagline">Nenhuma peça cadastrada.</td></tr>'
    return
  }

  tbody.innerHTML = MATERIAIS.map(material => {
    const arquivado = material.ativo === false
    const abaixo = !arquivado
      && Number(material.estoque_minimo || 0) > 0
      && Number(material.estoque_atual || 0) < Number(material.estoque_minimo || 0)
    const badge = arquivado
      ? '<span class="badge b-blue">Arquivada</span>'
      : abaixo
        ? '<span class="badge b-red">Baixo</span>'
        : '<span class="badge b-ok">OK</span>'
    return `
    <tr>
      <td class="hi mono">${esc(material.codigo || '—')}</td>
      <td>${esc(material.nome)}</td>
      <td>${esc(material.tipo === 'peca' ? 'Peça' : 'Consumível')}</td>
      <td>${Number(material.estoque_atual || 0).toLocaleString('pt-BR')} ${esc(material.unidade || 'un')}</td>
      <td>${Number(material.estoque_minimo || 0).toLocaleString('pt-BR')} ${esc(material.unidade || 'un')}</td>
      <td>${material.preco != null ? `R$ ${Number(material.preco).toFixed(2)}` : '—'}</td>
      <td>${badge}</td>
      <td>${podeEditar() ? `<button class="btn btn-s btn-sm" onclick="abrirModalMaterial(${material.id})">Editar</button>` : '—'}</td>
    </tr>
  `}).join('')
}

function renderMovimentos() {
  const tbody = document.getElementById('tb-movimentos')
  if (!ESTOQUE_MOV.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="tagline">Nenhum movimento registrado.</td></tr>'
    return
  }

  tbody.innerHTML = ESTOQUE_MOV.map(mov => `
    <tr>
      <td class="mono">${fmtDate(mov.registrado_em)}</td>
      <td>${esc(mov.transp_materiais?.nome || '—')}</td>
      <td>${esc(mov.tipo === 'saida' ? 'Saída' : 'Entrada')}</td>
      <td>${Number(mov.quantidade || 0).toLocaleString('pt-BR')} ${esc(mov.transp_materiais?.unidade || '')}</td>
      <td>${esc(mov.motivo || '—')}</td>
    </tr>
  `).join('')
}

function csvSeguro(valor) {
  const texto = String(valor ?? '')
  return /^[=+\-@]/.test(texto) ? `'${texto}` : texto
}

function renderCompras() {
  COMPRAS = []

  for (const material of materiaisAbaixoDoMinimo()) {
    const quantidade = Number(material.estoque_minimo || 0) - Number(material.estoque_atual || 0)
    COMPRAS.push({
      codigo: material.codigo || '',
      nome: material.nome,
      unidade: material.unidade || 'un',
      quantidade,
      preco: material.preco,
      motivo: `Reposição de estoque mínimo (saldo ${Number(material.estoque_atual || 0).toLocaleString('pt-BR')}, mínimo ${Number(material.estoque_minimo || 0).toLocaleString('pt-BR')})`,
    })
  }

  for (const item of calcVencimentos().filter(venc => venc.pct >= LIMIAR_COMPRAS)) {
    const itensPlano = PLANO_MATS.filter(pm => pm.plano_id === item.plano.id)
    for (const itemPlano of itensPlano) {
      const material = MATERIAIS.find(mat => mat.id === itemPlano.material_id)
      if (!material) continue
      const saldo = Number(material.estoque_atual || 0)
      const prevista = Number(itemPlano.quantidade)
      if (saldo >= prevista) continue
      COMPRAS.push({
        codigo: material.codigo || '',
        nome: material.nome,
        unidade: material.unidade || 'un',
        quantidade: prevista,
        preco: material.preco,
        motivo: `Plano "${item.plano.nome}" em ${item.ativo.codigo} (${item.pct}% do intervalo)`,
      })
    }
  }

  const tbody = document.getElementById('tb-compras')
  const vazio = document.getElementById('compras-vazio')
  if (!tbody) return

  if (!COMPRAS.length) {
    tbody.innerHTML = ''
    if (vazio) vazio.innerHTML = '<div class="callout co-ok">Nenhuma compra necessária no momento.</div>'
    return
  }

  if (vazio) vazio.innerHTML = ''

  tbody.innerHTML = COMPRAS.map(item => {
    const total = item.preco != null ? Number(item.preco) * Number(item.quantidade) : null
    return `
      <tr>
        <td class="mono">${esc(item.codigo || '—')}</td>
        <td>${esc(item.nome)}</td>
        <td>${Number(item.quantidade).toLocaleString('pt-BR')}</td>
        <td>${esc(item.unidade)}</td>
        <td>${item.preco != null ? `R$ ${Number(item.preco).toFixed(2)}` : '—'}</td>
        <td>${total != null ? `R$ ${total.toFixed(2)}` : '—'}</td>
        <td>${esc(item.motivo)}</td>
      </tr>
    `
  }).join('')
}

function exportarComprasCsv() {
  const cabecalho = ['Codigo', 'Peca', 'Quantidade', 'Unidade', 'PrecoUnit', 'Total', 'Motivo']
  const linhas = COMPRAS.map(item => {
    const total = item.preco != null ? Number(item.preco) * Number(item.quantidade) : ''
    return [
      item.codigo || '',
      item.nome,
      item.quantidade,
      item.unidade,
      item.preco != null ? Number(item.preco).toFixed(2) : '',
      total !== '' ? total.toFixed(2) : '',
      item.motivo,
    ]
  })

  const csv = [cabecalho, ...linhas].map(colunas => colunas.map(valor => csvEscape(csvSeguro(valor))).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `transportes-lista-compras-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function abrirModalMaterial(id = null) {
  if (!podeEditar()) return

  MATERIAL_EDIT_ID = null
  document.getElementById('titulo-modal-material').textContent = 'Nova peça'
  document.getElementById('mat-codigo').value = ''
  document.getElementById('mat-nome').value = ''
  document.getElementById('mat-tipo').value = 'consumivel'
  document.getElementById('mat-unidade').value = 'un'
  document.getElementById('mat-minimo').value = 0
  document.getElementById('mat-preco').value = ''
  document.getElementById('mat-ativo').value = 'true'
  document.getElementById('mat-obs').value = ''

  if (id != null) {
    const material = MATERIAIS.find(item => item.id === id)
    if (!material) return
    MATERIAL_EDIT_ID = material.id
    document.getElementById('titulo-modal-material').textContent = 'Editar peça'
    document.getElementById('mat-codigo').value = material.codigo || ''
    document.getElementById('mat-nome').value = material.nome || ''
    document.getElementById('mat-tipo').value = material.tipo || 'consumivel'
    document.getElementById('mat-unidade').value = material.unidade || 'un'
    document.getElementById('mat-minimo').value = material.estoque_minimo ?? 0
    document.getElementById('mat-preco').value = material.preco ?? ''
    document.getElementById('mat-ativo').value = material.ativo === false ? 'false' : 'true'
    document.getElementById('mat-obs').value = material.obs || ''
  }

  document.getElementById('modal-material').classList.add('open')
}

async function salvarMaterial() {
  if (!podeEditar()) return

  const nome = document.getElementById('mat-nome').value.trim()
  if (!nome) {
    alert('Nome obrigatório.')
    return
  }

  const precoTexto = document.getElementById('mat-preco').value
  const payload = {
    codigo: document.getElementById('mat-codigo').value.trim().toUpperCase() || null,
    nome,
    tipo: document.getElementById('mat-tipo').value,
    unidade: document.getElementById('mat-unidade').value.trim() || 'un',
    estoque_minimo: Number(document.getElementById('mat-minimo').value || 0),
    preco: precoTexto === '' ? null : Number(precoTexto),
    ativo: document.getElementById('mat-ativo').value === 'true',
    obs: document.getElementById('mat-obs').value.trim() || null,
  }

  // estoque_atual nunca é enviado por aqui — o saldo só muda por movimento (salvarMovimento).
  const resposta = MATERIAL_EDIT_ID == null
    ? await supa.from('transp_materiais').insert(payload)
    : await supa.from('transp_materiais').update(payload).eq('id', MATERIAL_EDIT_ID)

  if (resposta.error) {
    alert(`Erro: ${resposta.error.message}`)
    return
  }

  fecharModal('material')
  await carregarTudo()
}

function abrirModalMovimento() {
  if (!podeEditar()) return

  const select = document.getElementById('mv-material')
  const disponiveis = MATERIAIS.filter(material => material.ativo !== false)
  select.innerHTML = disponiveis.map(material => `
    <option value="${material.id}">${esc(material.nome)} (${Number(material.estoque_atual || 0).toLocaleString('pt-BR')} ${esc(material.unidade || 'un')})</option>
  `).join('')

  document.getElementById('mv-tipo').value = 'entrada'
  document.getElementById('mv-quantidade').value = ''
  document.getElementById('mv-motivo').value = ''
  document.getElementById('modal-movimento').classList.add('open')
}

async function salvarMovimento() {
  if (!podeEditar()) return

  const materialId = Number(document.getElementById('mv-material').value)
  const tipo = document.getElementById('mv-tipo').value
  const quantidade = Number(document.getElementById('mv-quantidade').value)
  const motivo = document.getElementById('mv-motivo').value.trim() || null

  if (!materialId || !quantidade || quantidade <= 0) {
    alert('Selecione a peça e informe uma quantidade maior que zero.')
    return
  }

  const material = MATERIAIS.find(item => item.id === materialId)
  if (!material) {
    alert('Peça não encontrada.')
    return
  }

  const saldoAtual = Number(material.estoque_atual || 0)
  const novoSaldo = tipo === 'saida' ? saldoAtual - quantidade : saldoAtual + quantidade

  if (novoSaldo < 0) {
    alert('Operação recusada: essa saída deixaria o saldo negativo.')
    return
  }

  const insertRes = await supa.from('transp_estoque_movimentos').insert({
    material_id: materialId,
    tipo,
    quantidade,
    motivo,
  })
  if (insertRes.error) {
    alert(`Erro: ${insertRes.error.message}`)
    return
  }

  const updateRes = await supa.from('transp_materiais').update({ estoque_atual: novoSaldo }).eq('id', materialId)
  if (updateRes.error) {
    alert(`Movimento registrado, mas o saldo não foi atualizado: ${updateRes.error.message}`)
  }

  fecharModal('movimento')
  await carregarTudo()
}

function renderRelatorios() {
  const resumo = obterResumoRelatorio()
  document.getElementById('rel-viagens').textContent = resumo.viagens
  document.getElementById('rel-passageiros').textContent = resumo.passageiros
  document.getElementById('rel-carga').textContent = resumo.cargaKg.toLocaleString('pt-BR')
  document.getElementById('rel-uso').textContent = resumo.uso.toLocaleString('pt-BR')

  const tbody = document.getElementById('tb-relatorio-ativos')
  if (!ATIVOS.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="tagline">Nenhum ativo disponível.</td></tr>'
    return
  }

  tbody.innerHTML = ATIVOS.map(ativo => `
    <tr>
      <td class="mono">${esc(ativo.codigo)}</td>
      <td class="hi">${esc(ativo.nome)}</td>
      <td>${esc(ativo.tipo === 'embarcacao' ? 'Embarcação' : 'Viatura')}</td>
      <td class="mono">${esc(ativo.identificacao || '—')}</td>
      <td>${Number(ativo.uso_atual || 0).toLocaleString('pt-BR')} ${esc(ativo.unidade_uso || '')}</td>
      <td>${badgeStatus(ativo.status, STATUS_ATIVO)}</td>
      <td>${esc(ativo.responsavel_nome || '—')}</td>
    </tr>
  `).join('')
}

function fecharModal(chave) {
  document.getElementById(`modal-${chave}`).classList.remove('open')
}

function limparModalAtivo() {
  ATIVO_EDIT_ID = null
  document.getElementById('titulo-modal-ativo').textContent = 'Novo ativo'
  document.getElementById('at-codigo').value = ''
  document.getElementById('at-nome').value = ''
  document.getElementById('at-tipo').value = 'viatura'
  document.getElementById('at-subtipo').value = ''
  document.getElementById('at-tipo-modelo').value = ''
  document.getElementById('at-identificacao').value = ''
  document.getElementById('at-ano').value = ''
  document.getElementById('at-local').value = 'CMASM'
  document.getElementById('at-capacidade-pessoas').value = ''
  document.getElementById('at-capacidade-carga').value = ''
  document.getElementById('at-responsavel').value = ''
  document.getElementById('at-uso-atual').value = 0
  document.getElementById('at-unidade-uso').value = 'km'
  document.getElementById('at-status').value = 'disponivel'
  document.getElementById('at-prox-manut').value = ''
  document.getElementById('at-ativo').value = 'true'
  document.getElementById('at-observacoes').value = ''
}

function abrirModalAtivo(id = null) {
  if (!podeEditar()) return
  limparModalAtivo()
  if (id != null) {
    const ativo = ATIVOS.find(item => item.id === id)
    if (!ativo) return
    ATIVO_EDIT_ID = ativo.id
    document.getElementById('titulo-modal-ativo').textContent = 'Editar ativo'
    document.getElementById('at-codigo').value = ativo.codigo || ''
    document.getElementById('at-nome').value = ativo.nome || ''
    document.getElementById('at-tipo').value = ativo.tipo || 'viatura'
    document.getElementById('at-subtipo').value = ativo.subtipo || ''
    document.getElementById('at-tipo-modelo').value = ativo.tipo_modelo || ''
    document.getElementById('at-identificacao').value = ativo.identificacao || ''
    document.getElementById('at-ano').value = ativo.ano || ''
    document.getElementById('at-local').value = ativo.local || ''
    document.getElementById('at-capacidade-pessoas').value = ativo.capacidade_pessoas ?? ''
    document.getElementById('at-capacidade-carga').value = ativo.capacidade_carga_kg ?? ''
    document.getElementById('at-responsavel').value = ativo.responsavel_nome || ''
    document.getElementById('at-uso-atual').value = ativo.uso_atual ?? 0
    document.getElementById('at-unidade-uso').value = ativo.unidade_uso || 'km'
    document.getElementById('at-status').value = ativo.status || 'disponivel'
    document.getElementById('at-prox-manut').value = ativo.prox_manutencao || ''
    document.getElementById('at-ativo').value = ativo.ativo === false ? 'false' : 'true'
    document.getElementById('at-observacoes').value = ativo.observacoes || ''
  }
  document.getElementById('modal-ativo').classList.add('open')
}

async function salvarAtivo() {
  if (!podeEditar()) return
  const codigo = document.getElementById('at-codigo').value.trim()
  const nome = document.getElementById('at-nome').value.trim()
  if (!codigo || !nome) {
    alert('Preencha código e nome do ativo.')
    return
  }

  const payload = {
    codigo,
    nome,
    tipo: document.getElementById('at-tipo').value,
    subtipo: document.getElementById('at-subtipo').value.trim() || null,
    tipo_modelo: document.getElementById('at-tipo-modelo').value.trim() || null,
    identificacao: document.getElementById('at-identificacao').value.trim() || null,
    ano: document.getElementById('at-ano').value ? Number(document.getElementById('at-ano').value) : null,
    local: document.getElementById('at-local').value.trim() || null,
    capacidade_pessoas: document.getElementById('at-capacidade-pessoas').value ? Number(document.getElementById('at-capacidade-pessoas').value) : null,
    capacidade_carga_kg: document.getElementById('at-capacidade-carga').value ? Number(document.getElementById('at-capacidade-carga').value) : null,
    responsavel_nome: document.getElementById('at-responsavel').value.trim() || null,
    uso_atual: Number(document.getElementById('at-uso-atual').value || 0),
    unidade_uso: document.getElementById('at-unidade-uso').value,
    status: document.getElementById('at-status').value,
    prox_manutencao: document.getElementById('at-prox-manut').value || null,
    ativo: document.getElementById('at-ativo').value === 'true',
    observacoes: document.getElementById('at-observacoes').value.trim() || null,
  }

  const resposta = ATIVO_EDIT_ID == null
    ? await supa.from('transp_ativos').insert(payload)
    : await supa.from('transp_ativos').update(payload).eq('id', ATIVO_EDIT_ID)

  if (resposta.error) {
    alert(`Erro: ${resposta.error.message}`)
    return
  }

  fecharModal('ativo')
  await carregarTudo()
}

function popularSelectAtivos(id, selecionado = null) {
  const select = document.getElementById(id)
  select.innerHTML = ATIVOS.filter(ativo => ativo.ativo !== false).map(ativo => `
    <option value="${ativo.id}" ${Number(selecionado) === Number(ativo.id) ? 'selected' : ''}>${esc(ativo.codigo)} — ${esc(ativo.nome)}</option>
  `).join('')
}

function limparModalViagem(ativoId = null) {
  VIAGEM_EDIT_ID = null
  document.getElementById('titulo-modal-viagem').textContent = 'Nova viagem'
  popularSelectAtivos('vg-ativo', ativoId ?? ATIVOS[0]?.id)
  document.getElementById('vg-data').value = new Date().toISOString().slice(0, 10)
  document.getElementById('vg-saida-prevista').value = ''
  document.getElementById('vg-chegada-prevista').value = ''
  document.getElementById('vg-status').value = 'agendada'
  document.getElementById('vg-classificacao').value = 'programada'
  document.getElementById('vg-tipo-uso').value = 'servico'
  document.getElementById('vg-origem').value = 'CMASM'
  document.getElementById('vg-destino').value = ''
  document.getElementById('vg-missao').value = ''
  document.getElementById('vg-uso-saida').value = ''
  document.getElementById('vg-uso-chegada').value = ''
  document.getElementById('vg-passageiros').value = 0
  document.getElementById('vg-carga-kg').value = 0
  document.getElementById('vg-motorista').value = ''
  document.getElementById('vg-responsavel').value = ''
  document.getElementById('vg-patrao').value = ''
  document.getElementById('vg-mo').value = ''
  document.getElementById('vg-carga-desc').value = ''
  document.getElementById('vg-observacoes').value = ''
}

function abrirModalViagem(ativoId = null, viagemId = null) {
  if (!podeEditar()) return
  limparModalViagem(ativoId)
  if (viagemId) {
    const viagem = VIAGENS.find(item => item.id === viagemId)
    if (!viagem) return
    VIAGEM_EDIT_ID = viagem.id
    document.getElementById('titulo-modal-viagem').textContent = 'Editar viagem'
    popularSelectAtivos('vg-ativo', viagem.ativo_id)
    document.getElementById('vg-data').value = viagem.data_saida || ''
    document.getElementById('vg-saida-prevista').value = viagem.hora_saida_prevista ? String(viagem.hora_saida_prevista).slice(0, 5) : ''
    document.getElementById('vg-chegada-prevista').value = viagem.hora_chegada_prevista ? String(viagem.hora_chegada_prevista).slice(0, 5) : ''
    document.getElementById('vg-status').value = viagem.status || 'agendada'
    document.getElementById('vg-classificacao').value = viagem.classificacao || 'programada'
    document.getElementById('vg-tipo-uso').value = viagem.tipo_uso || 'servico'
    document.getElementById('vg-origem').value = viagem.origem || 'CMASM'
    document.getElementById('vg-destino').value = viagem.destino || ''
    document.getElementById('vg-missao').value = viagem.missao || ''
    document.getElementById('vg-uso-saida').value = viagem.uso_saida ?? ''
    document.getElementById('vg-uso-chegada').value = viagem.uso_chegada ?? ''
    document.getElementById('vg-passageiros').value = viagem.passageiros ?? 0
    document.getElementById('vg-carga-kg').value = viagem.carga_kg ?? 0
    document.getElementById('vg-motorista').value = viagem.motorista_nome || ''
    document.getElementById('vg-responsavel').value = viagem.responsavel_nome || ''
    document.getElementById('vg-patrao').value = viagem.patrao_nome || ''
    document.getElementById('vg-mo').value = viagem.mo_nome || ''
    document.getElementById('vg-carga-desc').value = viagem.carga_descricao || ''
    document.getElementById('vg-observacoes').value = viagem.observacoes || ''
  }
  document.getElementById('modal-viagem').classList.add('open')
}

async function salvarViagem() {
  if (!podeEditar()) return

  const ativoId = Number(document.getElementById('vg-ativo').value)
  const destino = document.getElementById('vg-destino').value.trim()
  const missao = document.getElementById('vg-missao').value.trim()
  const dataSaida = document.getElementById('vg-data').value
  const usoSaidaTexto = document.getElementById('vg-uso-saida').value
  const usoChegadaTexto = document.getElementById('vg-uso-chegada').value

  if (!ativoId || !destino || !missao || !dataSaida) {
    alert('Preencha ativo, data, destino e missão.')
    return
  }

  const usoSaida = usoSaidaTexto === '' ? null : Number(usoSaidaTexto)
  const usoChegada = usoChegadaTexto === '' ? null : Number(usoChegadaTexto)
  if (usoSaida != null && usoChegada != null && usoChegada < usoSaida) {
    alert('O uso na chegada não pode ser menor que o uso na saída.')
    return
  }

  const payload = {
    ativo_id: ativoId,
    classificacao: document.getElementById('vg-classificacao').value,
    tipo_uso: document.getElementById('vg-tipo-uso').value,
    origem: document.getElementById('vg-origem').value.trim() || 'CMASM',
    destino,
    missao,
    data_saida: dataSaida,
    hora_saida_prevista: document.getElementById('vg-saida-prevista').value || null,
    hora_chegada_prevista: document.getElementById('vg-chegada-prevista').value || null,
    uso_saida: usoSaida,
    uso_chegada: usoChegada,
    motorista_nome: document.getElementById('vg-motorista').value.trim() || null,
    patrao_nome: document.getElementById('vg-patrao').value.trim() || null,
    mo_nome: document.getElementById('vg-mo').value.trim() || null,
    responsavel_nome: document.getElementById('vg-responsavel').value.trim() || null,
    passageiros: Number(document.getElementById('vg-passageiros').value || 0),
    carga_kg: Number(document.getElementById('vg-carga-kg').value || 0),
    carga_descricao: document.getElementById('vg-carga-desc').value.trim() || null,
    status: document.getElementById('vg-status').value,
    observacoes: document.getElementById('vg-observacoes').value.trim() || null,
  }

  const resposta = VIAGEM_EDIT_ID == null
    ? await supa.from('transp_viagens').insert(payload)
    : await supa.from('transp_viagens').update(payload).eq('id', VIAGEM_EDIT_ID)

  if (resposta.error) {
    alert(`Erro: ${resposta.error.message}`)
    return
  }

  const ativoAtual = ATIVOS.find(item => Number(item.id) === ativoId)
  const ajusteAtivo = {}
  if (payload.status === 'em_andamento') {
    ajusteAtivo.status = 'em_uso'
  }
  if (payload.status === 'concluida' && usoChegada != null && ativoAtual && usoChegada > Number(ativoAtual.uso_atual || 0)) {
    ajusteAtivo.uso_atual = usoChegada
  }
  if (payload.status === 'concluida' && ativoAtual?.status === 'em_uso') {
    ajusteAtivo.status = 'disponivel'
  }

  if (Object.keys(ajusteAtivo).length) {
    const updateRes = await supa.from('transp_ativos').update(ajusteAtivo).eq('id', ativoId)
    if (updateRes.error) {
      alert(`Viagem salva, mas o ativo não foi atualizado: ${updateRes.error.message}`)
    }
  }

  fecharModal('viagem')
  await carregarTudo()
}

function popularPlanosOS(ativoId) {
  const ativo = ATIVOS.find(item => Number(item.id) === Number(ativoId))
  const select = document.getElementById('mn-plano')
  const planosCompativeis = ativo
    ? PLANOS.filter(plano => plano.ativo !== false && plano.tipo_modelo === ativo.tipo_modelo && plano.unidade === ativo.unidade_uso)
    : []
  select.innerHTML = '<option value="">Sem plano</option>' + planosCompativeis.map(plano => `
    <option value="${plano.id}">${esc(plano.nome)} (a cada ${plano.intervalo} ${esc(plano.unidade)})</option>
  `).join('')
}

function mostrarMateriaisPlano(planoId) {
  const container = document.getElementById('mn-pecas')
  if (!planoId) {
    container.innerHTML = ''
    return
  }

  const itens = PLANO_MATS.filter(item => item.plano_id === planoId)
  if (!itens.length) {
    container.innerHTML = '<div class="tagline">Nenhuma peça vinculada a este plano.</div>'
    return
  }

  container.innerHTML = itens.map(item => {
    const material = MATERIAIS.find(mat => mat.id === item.material_id)
    const saldo = Number(material?.estoque_atual || 0)
    const prevista = Number(item.quantidade)
    const insuficiente = saldo < prevista
    return `
      <div class="mat-alert">
        <div class="mat-info">
          <div class="mat-nome">${esc(material?.nome || 'Peça removida')}</div>
          <div class="mat-stock">Prevista: ${prevista.toLocaleString('pt-BR')} ${esc(material?.unidade || 'un')} · saldo: ${saldo.toLocaleString('pt-BR')} ${esc(material?.unidade || 'un')}</div>
        </div>
        ${insuficiente ? '<span class="badge b-red">Saldo insuficiente</span>' : '<span class="badge b-ok">OK</span>'}
      </div>
    `
  }).join('')
}

async function baixarPecasDoPlano(manutencaoId, planoId) {
  if (ESTOQUE_MOV.some(mov => mov.manutencao_id === manutencaoId)) return
  if (!planoId) return

  let custoTotal = 0
  const plano = PLANOS.find(item => item.id === planoId)

  for (const item of PLANO_MATS.filter(pm => pm.plano_id === planoId)) {
    const material = MATERIAIS.find(mat => mat.id === item.material_id)
    if (!material) continue

    const novoSaldo = Math.max(0, Number(material.estoque_atual || 0) - Number(item.quantidade))
    const updateRes = await supa.from('transp_materiais').update({ estoque_atual: novoSaldo }).eq('id', material.id)
    if (updateRes.error) {
      alert(`Erro ao baixar estoque de ${material.nome}: ${updateRes.error.message}`)
    }

    const insertRes = await supa.from('transp_estoque_movimentos').insert({
      material_id: material.id,
      manutencao_id: manutencaoId,
      tipo: 'saida',
      quantidade: item.quantidade,
      motivo: `OS de manutenção — plano "${plano?.nome || ''}"`,
    })
    if (insertRes.error) {
      alert(`Erro ao registrar movimento de ${material.nome}: ${insertRes.error.message}`)
    }

    if (material.preco != null) custoTotal += Number(material.preco) * Number(item.quantidade)
  }

  return custoTotal
}

function abrirModalManutencao(ativoId = null) {
  if (!podeEditar()) return
  const selectAtivo = document.getElementById('mn-ativo')
  popularSelectAtivos('mn-ativo', ativoId ?? ATIVOS[0]?.id)
  document.getElementById('mn-data').value = new Date().toISOString().slice(0, 10)
  document.getElementById('mn-tipo').value = 'preventiva'
  document.getElementById('mn-uso').value = ''
  document.getElementById('mn-novo-status').value = ''
  document.getElementById('mn-executado').value = ''
  document.getElementById('mn-fornecedor').value = ''
  document.getElementById('mn-descricao').value = ''
  document.getElementById('mn-prox').value = ''
  document.getElementById('mn-observacoes').value = ''
  document.getElementById('mn-status').value = 'concluida'

  popularPlanosOS(selectAtivo.value)
  document.getElementById('mn-pecas').innerHTML = ''

  selectAtivo.onchange = () => {
    popularPlanosOS(selectAtivo.value)
    document.getElementById('mn-pecas').innerHTML = ''
  }
  document.getElementById('mn-plano').onchange = evento => {
    mostrarMateriaisPlano(Number(evento.target.value) || null)
  }

  document.getElementById('modal-manutencao').classList.add('open')
}

async function salvarOS() {
  if (!podeEditar()) return
  const ativoId = Number(document.getElementById('mn-ativo').value)
  const descricao = document.getElementById('mn-descricao').value.trim()
  const data = document.getElementById('mn-data').value
  if (!ativoId || !descricao || !data) {
    alert('Preencha ativo, data e descrição.')
    return
  }

  const planoId = Number(document.getElementById('mn-plano').value) || null
  const status = document.getElementById('mn-status').value

  let custoPecas = 0
  if (planoId) {
    for (const item of PLANO_MATS.filter(pm => pm.plano_id === planoId)) {
      const material = MATERIAIS.find(mat => mat.id === item.material_id)
      if (material?.preco != null) custoPecas += Number(material.preco) * Number(item.quantidade)
    }
  }

  const usoTexto = document.getElementById('mn-uso').value
  const payload = {
    ativo_id: ativoId,
    tipo: document.getElementById('mn-tipo').value,
    data_manutencao: data,
    descricao,
    uso_referencia: usoTexto === '' ? null : Number(usoTexto),
    executado_por: document.getElementById('mn-executado').value.trim() || null,
    fornecedor: document.getElementById('mn-fornecedor').value.trim() || null,
    prox_manutencao: document.getElementById('mn-prox').value || null,
    novo_status: document.getElementById('mn-novo-status').value || null,
    observacoes: document.getElementById('mn-observacoes').value.trim() || null,
    plano_id: planoId,
    status,
    custo_pecas: custoPecas,
  }

  const insertRes = await supa.from('transp_manutencoes').insert(payload).select().single()
  if (insertRes.error) {
    alert(`Erro: ${insertRes.error.message}`)
    return
  }

  const manutencaoId = insertRes.data?.id

  const ativoAtual = ATIVOS.find(item => Number(item.id) === ativoId)
  const updatePayload = {}
  if (payload.prox_manutencao) updatePayload.prox_manutencao = payload.prox_manutencao
  if (payload.novo_status) updatePayload.status = payload.novo_status
  if (payload.uso_referencia != null && ativoAtual && payload.uso_referencia > Number(ativoAtual.uso_atual || 0)) {
    updatePayload.uso_atual = payload.uso_referencia
  }

  if (Object.keys(updatePayload).length) {
    const updateRes = await supa.from('transp_ativos').update(updatePayload).eq('id', ativoId)
    if (updateRes.error) {
      alert(`OS salva, mas o ativo não foi atualizado: ${updateRes.error.message}`)
    }
  }

  if (status === 'concluida' && planoId && manutencaoId) {
    await baixarPecasDoPlano(manutencaoId, planoId)
  }

  fecharModal('manutencao')
  await carregarTudo()
}

async function concluirOS(id) {
  if (!podeEditar()) return
  const manutencao = MANUTENCOES.find(item => item.id === id)
  if (!manutencao) return
  if (manutencao.status === 'concluida') return

  const updateRes = await supa.from('transp_manutencoes').update({ status: 'concluida' }).eq('id', id)
  if (updateRes.error) {
    alert(`Erro: ${updateRes.error.message}`)
    return
  }

  if (manutencao.plano_id) {
    await baixarPecasDoPlano(id, manutencao.plano_id)
  }

  const ativoAtual = ATIVOS.find(item => Number(item.id) === Number(manutencao.ativo_id))
  if (manutencao.uso_referencia != null && ativoAtual && Number(manutencao.uso_referencia) > Number(ativoAtual.uso_atual || 0)) {
    const updateAtivoRes = await supa.from('transp_ativos').update({ uso_atual: manutencao.uso_referencia }).eq('id', manutencao.ativo_id)
    if (updateAtivoRes.error) {
      alert(`OS concluída, mas o ativo não foi atualizado: ${updateAtivoRes.error.message}`)
    }
  }

  await carregarTudo()
}

function csvEscape(valor) {
  const texto = String(valor ?? '')
  return `"${texto.replace(/"/g, '""')}"`
}

function exportarViagensCsv() {
  const cabecalho = ['data_saida', 'hora_saida_prevista', 'ativo_codigo', 'ativo_nome', 'destino', 'missao', 'status', 'tripulacao', 'passageiros', 'carga_kg']
  const linhas = ordenarViagens(VIAGENS).map(viagem => [
    viagem.data_saida || '',
    viagem.hora_saida_prevista || '',
    viagem.transp_ativos?.codigo || '',
    viagem.transp_ativos?.nome || '',
    viagem.destino || '',
    viagem.missao || '',
    STATUS_VIAGEM[viagem.status] || viagem.status,
    obterTripulacao(viagem),
    viagem.passageiros || 0,
    viagem.carga_kg || 0,
  ])

  const csv = [cabecalho, ...linhas].map(colunas => colunas.map(csvEscape).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `transportes-viagens-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

async function sair() {
  try {
    if (auth?.sair) await auth.sair()
  } finally {
    window.location.reload()
  }
}

function fecharAoClicarFora() {
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', evento => {
      if (evento.target === overlay) overlay.classList.remove('open')
    })
  })
}

function exporNoWindow() {
  Object.assign(window, {
    abrirModalAtivo,
    abrirModalViagem,
    abrirModalManutencao,
    abrirModalPlano,
    abrirModalMaterial,
    abrirModalMovimento,
    adicionarPecaAoPlano,
    removerPecaDoPlano,
    exportarViagensCsv,
    exportarComprasCsv,
    fecharModal,
    renderAtivos,
    renderViagens,
    renderPlanos,
    sair,
    salvarAtivo,
    salvarViagem,
    salvarOS,
    concluirOS,
    salvarPlano,
    salvarMaterial,
    salvarMovimento,
    trocarView,
  })
}

function mostrarErroBoot(error) {
  document.getElementById('login-screen').innerHTML = `
    <div class="callout co-red" style="max-width:560px">
      <strong>Falha ao iniciar o módulo Transportes.</strong><br>
      ${esc(error.message || String(error))}
    </div>
  `
}

async function boot() {
  exporNoWindow()

  aplicarShell({
    nome: 'Transportes',
    accent: '#4aa0a0',
    versao: '1.0',
    navItems: [
      { id: 'painel', icone: '📊', label: 'Painel', ativo: true },
      { id: 'ativos', icone: '🚚', label: 'Frota' },
      { id: 'viagens', icone: '🗺️', label: 'Viagens' },
      { id: 'manutencao', icone: '🔧', label: 'Manutenção' },
      { id: 'planos', icone: '🗓️', label: 'Planos' },
      { id: 'estoque', icone: '📦', label: 'Estoque' },
      { id: 'relatorios', icone: '🧾', label: 'Relatórios' },
    ],
  })

  fecharAoClicarFora()

  try {
    supa = await criarClienteSupabase()
  } catch (error) {
    mostrarErroBoot(error)
    return
  }

  auth = new Auth(supa, { appNome: 'Transportes', appIcone: '🚚' })
  auth.onLogin(usuario => {
    USUARIO = usuario
    mostrarApp()
  })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}

boot()
