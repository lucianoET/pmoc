// ══════════════════════════════════════════════════════════════════
// gestao/app.js — Módulo de Gestão e Qualidade (Fase 13, Onda B)
//
// Consome os 7 núcleos puros da Onda A (grafico, indicadores, gantt,
// abc, gut, kanban, calendario) mais os núcleos compartilhados de auth,
// shell, tabela, fluxo e componentes.
//
// Sonda GES_OK:
// Garante que o módulo abre honesto e inerte enquanto a migração 60 não
// for aplicada no Supabase, exibindo avisos de esquema pendente em vez de
// falhar com erro de relação inexistente.
// ══════════════════════════════════════════════════════════════════

import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { aplicarShell } from '../shared/shell.js'
import { icone } from '../shared/icones.js'
import { barras, linha, cartaControle, pareto, sparkline } from '../shared/grafico.js'
import { cartaoIndicador, avaliar, tendencia } from '../shared/indicadores.js'
import { htmlGantt, linhasGantt } from '../shared/gantt.js'
import { classificarAbc } from '../shared/abc.js'
import { classificarGut, gutTotal, rotuloGut, GUT_ESCALA } from '../shared/gut.js'
import { agruparKanban, htmlKanban } from '../shared/kanban.js'
import { gradeMes, agruparPorData, htmlCalendario, MESES } from '../shared/calendario.js'
import { aplicarOrdemEFiltro, proximaOrdem } from '../shared/tabela.js'
import { tomDaEtapa, rotuloDaEtapa, ehTerminal } from '../shared/fluxo.js'
import { pilula, regua, vazio, seletor } from '../shared/componentes.js'

// ── Estado global ──
let supa = null
let auth = null
let USUARIO = null
let GES_OK = false

let ACOES = []
let INDICADORES = []
let INDICADOR_VALORES = []
let POPS = []
let CAUSAS = []
let EVENTOS_CALENDARIO = []

let CALENDARIO_MES = new Date().getMonth()
let CALENDARIO_ANO = new Date().getFullYear()

let MODO_ACOES = 'lista'
let ORDEM_ACOES = { coluna: 'gut_total', dir: 'desc' }
let FILTROS_ACOES = {}

let ORDEM_POP = { coluna: 'titulo', dir: 'asc' }
let FILTROS_POP = {}

let CONFIRMACAO_PENDENTE = null

// ── Definições de fluxo e tabelas ──
const FLUXO_ACOES = {
  etapas: [
    { id: 'planejada', rotulo: 'Planejada', curto: 'Plan', tom: 'info' },
    { id: 'em_execucao', rotulo: 'Em execução', curto: 'Exec', tom: 'warn' },
    { id: 'verificacao', rotulo: 'Verificação', curto: 'Verif', tom: 'info' },
  ],
  terminais: ['concluida', 'cancelada'],
  terminaisDeSucesso: ['concluida'],
  rotulosTerminais: {
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  },
  tonsTerminais: {
    concluida: 'ok',
    cancelada: 'erro',
  },
}

const COLUNAS_ACOES = [
  { id: 'o_que', rotulo: 'Ação (O quê)', tipo: 'texto', texto: a => a.o_que },
  { id: 'quem', rotulo: 'Responsável (Quem)', tipo: 'texto', texto: a => a.quem || '—' },
  { id: 'quando', rotulo: 'Prazo (Quando)', tipo: 'texto', texto: a => a.quando || '—' },
  { id: 'modulo', rotulo: 'Módulo', tipo: 'texto', texto: a => a.modulo || 'Geral' },
  { id: 'gut_total', rotulo: 'GUT', tipo: 'numero', valor: a => (a.gut_total != null ? a.gut_total : -1), texto: a => (a.gut_total != null ? String(a.gut_total) : '—') },
  { id: 'status', rotulo: 'Status', tipo: 'texto', texto: a => rotuloDaEtapa(FLUXO_ACOES, a.status) },
]

const COLUNAS_POP = [
  { id: 'titulo', rotulo: 'Procedimento (Título)', tipo: 'texto', texto: p => p.titulo },
  { id: 'modulo', rotulo: 'Módulo', tipo: 'texto', texto: p => p.modulo || 'Geral' },
  { id: 'vinculo', rotulo: 'Vínculo (Ativo / Plano)', tipo: 'texto', texto: p => (p.ativo_ref || p.plano_ref ? `${p.ativo_ref || ''} ${p.plano_ref || ''}`.trim() : '—') },
  { id: 'criado_em', rotulo: 'Criado em', tipo: 'texto', texto: p => (p.criado_em ? p.criado_em.slice(0, 10) : '—') },
]

// ── Utilitários ──
function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[c])
}

function podeEditarGestao() {
  if (!USUARIO || !USUARIO.cargo) return false
  return ['admin', 'gestor', 'tecnico'].includes(USUARIO.cargo)
}

function pedirConfirmacao(mensagem, acao) {
  CONFIRMACAO_PENDENTE = acao
  let overlay = document.getElementById('modal-confirmacao')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'modal-confirmacao'
    overlay.className = 'overlay'
    overlay.innerHTML = `
      <div class="modal" style="max-width:440px">
        <div class="modal-hd"><h3>Confirmação</h3></div>
        <div class="modal-body"><p id="confirmacao-texto" style="font-size:14px;line-height:1.5"></p></div>
        <div class="modal-ft">
          <button class="btn btn-s" onclick="fecharConfirmacao(false)">Cancelar</button>
          <button class="btn btn-p" onclick="fecharConfirmacao(true)">Confirmar</button>
        </div>
      </div>`
    document.body.appendChild(overlay)
  }
  document.getElementById('confirmacao-texto').textContent = mensagem
  overlay.classList.remove('hidden')
}

function fecharConfirmacao(confirmado) {
  const overlay = document.getElementById('modal-confirmacao')
  if (overlay) overlay.classList.add('hidden')
  if (confirmado && typeof CONFIRMACAO_PENDENTE === 'function') {
    CONFIRMACAO_PENDENTE()
  }
  CONFIRMACAO_PENDENTE = null
}

// ── Sonda GES_OK ──
async function sondarGestao() {
  try {
    const { error } = await supa.from('ges_acoes').select('id').limit(1)
    GES_OK = !error
  } catch (e) {
    GES_OK = false
  }
  return GES_OK
}

// ── Carga de dados ──
async function lerTabelaSegura(tabela, colunas = '*') {
  try {
    const { data, error } = await supa.from(tabela).select(colunas).limit(200)
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

async function carregarTudo() {
  // Sonda executada estritamente ANTES e fora do Promise.all principal
  await sondarGestao()

  let pGestao
  if (GES_OK) {
    pGestao = Promise.all([
      supa.from('ges_acoes').select('*').eq('ativo', true).order('criado_em', { ascending: false }),
      supa.from('ges_indicadores').select('*').eq('ativo', true).order('criado_em', { ascending: true }),
      supa.from('ges_indicador_valores').select('*').order('periodo', { ascending: true }),
      supa.from('ges_pop').select('*').eq('ativo', true).order('criado_em', { ascending: false }),
      supa.from('ges_causas').select('*').order('criado_em', { ascending: true }),
    ])
  } else {
    pGestao = Promise.resolve([
      { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] },
    ])
  }

  // Leituras de módulos operacionais — estritamente somente leitura
  const pOperacionais = Promise.all([
    lerTabelaSegura('maq_os', 'id, data_prevista, criado_em, status, tipo, horimetro_momento'),
    lerTabelaSegura('maq_operacoes', 'id, data_operacao, status, descricao, operador'),
    lerTabelaSegura('transp_viagens', 'id, data_saida, status, destino'),
    supa.from('logs_manutencao').select('id, data_agendada, data_execucao, criado_em, status, tipo_manutencao, equip_id').limit(200),
    lerTabelaSegura('pred_inspecao_itens', 'id, criado_em, status, condicao'),
    lerTabelaSegura('cal_ps', 'id, num, data_envio, data_retorno, status'),
  ])

  const [resGestao, [maqOs, maqOps, transpViagens, resRef, predItens, calPs]] = await Promise.all([
    pGestao,
    pOperacionais,
  ])

  if (GES_OK) {
    ACOES = resGestao[0].data || []
    INDICADORES = resGestao[1].data || []
    INDICADOR_VALORES = resGestao[2].data || []
    POPS = resGestao[3].data || []
    CAUSAS = resGestao[4].data || []
  } else {
    ACOES = []
    INDICADORES = []
    INDICADOR_VALORES = []
    POPS = []
    CAUSAS = []
  }

  const logsRef = resRef?.data || []

  // Consolidação de eventos do calendário
  EVENTOS_CALENDARIO = []
  maqOs.forEach(os => {
    const d = (os.data_prevista || os.criado_em || '').slice(0, 10)
    if (d) EVENTOS_CALENDARIO.push({ data: d, origem: 'Máquinas', titulo: `OS #${os.id} (${os.status || ''})`, classe: 'os' })
  })
  maqOps.forEach(op => {
    const d = (op.data_operacao || '').slice(0, 10)
    if (d) EVENTOS_CALENDARIO.push({ data: d, origem: 'Máquinas', titulo: `Corte: ${op.descricao || 'Operação'}`, classe: 'op' })
  })
  transpViagens.forEach(v => {
    const d = (v.data_saida || '').slice(0, 10)
    if (d) EVENTOS_CALENDARIO.push({ data: d, origem: 'Transportes', titulo: `Viagem: ${v.destino || 'Destino'}`, classe: 'os' })
  })
  logsRef.forEach(log => {
    const d = (log.data_agendada || log.data_execucao || log.criado_em || '').slice(0, 10)
    if (d) EVENTOS_CALENDARIO.push({ data: d, origem: 'Refrigeração', titulo: `PMOC: ${log.tipo_manutencao || 'Manutenção'}`, classe: 'os' })
  })
  predItens.forEach(pi => {
    const d = (pi.criado_em || '').slice(0, 10)
    if (d) EVENTOS_CALENDARIO.push({ data: d, origem: 'Predial', titulo: `Inspeção #${pi.id}`, classe: 'op' })
  })
  calPs.forEach(ps => {
    const d = (ps.data_envio || ps.data_retorno || '').slice(0, 10)
    if (d) EVENTOS_CALENDARIO.push({ data: d, origem: 'Calibração', titulo: `PS ${ps.num || ps.id}`, classe: 'os' })
  })
  ACOES.forEach(a => {
    if (a.quando) EVENTOS_CALENDARIO.push({ data: a.quando, origem: 'Ações', titulo: a.o_que, classe: 'op' })
  })

  renderTudo()
}

function renderTudo() {
  renderPainel()
  renderAcoes()
  renderCalendario()
  renderFerramentas()
  renderPop()
}

// ── Aba 1: Painel ──
function renderPainel() {
  const container = document.getElementById('painel-indicadores')
  if (!container) return

  if (!GES_OK) {
    container.innerHTML = vazio('Migração 60 não aplicada', 'As tabelas ges_* ainda não existem neste banco')
    return
  }

  if (INDICADORES.length === 0) {
    container.innerHTML = vazio('Nenhum indicador cadastrado', 'Indicadores aparecem aqui depois da migração 60 e do primeiro valor lançado')
    return
  }

  const valoresPorIndicador = {}
  INDICADOR_VALORES.forEach(iv => {
    ;(valoresPorIndicador[iv.indicador_id] ||= []).push(Number(iv.valor))
  })

  const cardsHtml = INDICADORES.map(ind => {
    const serie = valoresPorIndicador[ind.id] || []
    const valorAtual = serie.length ? serie[serie.length - 1] : null
    const def = {
      id: ind.codigo,
      rotulo: ind.rotulo,
      unidade: ind.unidade || '',
      meta: ind.meta != null ? Number(ind.meta) : null,
      sentido: ind.sentido || 'maior',
      faixas: ind.faixa_atencao != null ? Number(ind.faixa_atencao) : null,
    }
    return `<div class="panel-card">${cartaoIndicador(def, valorAtual, serie)}</div>`
  }).join('')

  container.innerHTML = `<div class="section-split" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">${cardsHtml}</div>`
}

// ── Aba 2: Ações (5W2H + GUT) ──
function renderAcoes() {
  const topoBtn = document.getElementById('acoes-topo-acoes')
  if (topoBtn) {
    topoBtn.innerHTML = (GES_OK && podeEditarGestao())
      ? '<button class="btn btn-p btn-sm" onclick="abrirModalAcao()">+ Nova ação</button>'
      : ''
  }

  const seletorDiv = document.getElementById('acoes-seletor')
  if (seletorDiv) {
    seletorDiv.innerHTML = seletor(
      [
        { id: 'lista', rotulo: 'Lista' },
        { id: 'kanban', rotulo: 'Kanban' },
        { id: 'gantt', rotulo: 'Gantt' },
      ],
      MODO_ACOES,
      'trocarModoAcoes'
    )
  }

  const elLista = document.getElementById('acoes-lista')
  const elKanban = document.getElementById('acoes-kanban')
  const elGantt = document.getElementById('acoes-gantt')

  if (!GES_OK) {
    const msg = vazio('Migração 60 não aplicada', 'As tabelas ges_* ainda não existem neste banco')
    elLista.innerHTML = msg
    elLista.classList.remove('hidden')
    elKanban.classList.add('hidden')
    elGantt.classList.add('hidden')
    return
  }

  if (ACOES.length === 0) {
    const msg = vazio('Nenhuma ação registrada', 'Clique em + Nova ação para abrir o primeiro 5W2H')
    elLista.innerHTML = msg
    elLista.classList.remove('hidden')
    elKanban.classList.add('hidden')
    elGantt.classList.add('hidden')
    return
  }

  elLista.classList.toggle('hidden', MODO_ACOES !== 'lista')
  elKanban.classList.toggle('hidden', MODO_ACOES !== 'kanban')
  elGantt.classList.toggle('hidden', MODO_ACOES !== 'gantt')

  if (MODO_ACOES === 'lista') {
    const ordenadas = aplicarOrdemEFiltro(ACOES, ORDEM_ACOES, FILTROS_ACOES, COLUNAS_ACOES)
    const ths = COLUNAS_ACOES.map(c => `<th class="sortable" onclick="ordenarTabelaAcoes('${c.id}')">${esc(c.rotulo)}${ORDEM_ACOES.coluna === c.id ? (ORDEM_ACOES.dir === 'asc' ? ' ↑' : ' ↓') : ''}</th>`).join('')

    const trs = ordenadas.map(a => {
      const tomStatus = tomDaEtapa(FLUXO_ACOES, a.status)
      const rotuloStatus = rotuloDaEtapa(FLUXO_ACOES, a.status)
      const gutTxt = a.gut_total != null ? `${a.gut_total} (${rotuloGut(a.gut_total)})` : 'Não avaliado'

      let acoesBotoes = ''
      if (podeEditarGestao() && !ehTerminal(FLUXO_ACOES, a.status)) {
        acoesBotoes = `
          <button class="btn btn-s btn-sm" onclick="avancarAcao(${a.id})" title="Avançar etapa">→</button>
          <button class="btn btn-s btn-sm" onclick="cancelarAcao(${a.id})" title="Cancelar ação" style="color:var(--red)">✕</button>
        `
      }

      return `<tr>
        <td><strong>${esc(a.o_que)}</strong>${a.por_que ? `<div class="sub" style="font-size:11px">${esc(a.por_que)}</div>` : ''}</td>
        <td>${esc(a.quem || '—')}</td>
        <td>${esc(a.quando || '—')}</td>
        <td>${esc(a.modulo || 'Geral')}</td>
        <td><span class="badge ${a.gut_total > 400 ? 'b-red' : a.gut_total > 100 ? 'b-warn' : 'b-ok'}">${esc(gutTxt)}</span></td>
        <td>${pilula(rotuloStatus, tomStatus)}</td>
        <td style="text-align:right">${acoesBotoes}</td>
      </tr>`
    }).join('')

    elLista.innerHTML = `<table class="tbl"><thead><tr>${ths}<th style="text-align:right">Ações</th></tr></thead><tbody>${trs}</tbody></table>`
  } else if (MODO_ACOES === 'kanban') {
    const colunasKanban = [
      { id: 'planejada', rotulo: 'Planejada' },
      { id: 'em_execucao', rotulo: 'Em execução' },
      { id: 'verificacao', rotulo: 'Verificação' },
      { id: 'concluida', rotulo: 'Concluída' },
      { id: 'cancelada', rotulo: 'Cancelada' },
    ]
    const grupos = agruparKanban(ACOES, colunasKanban, { campoStatus: 'status' })
    const kanbanHtml = htmlKanban(grupos, colunasKanban, {
      cartao: a => {
        const gutTxt = a.gut_total != null ? `GUT ${a.gut_total}` : 'Não avaliado'
        return `<div class="kanban-card" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(a.o_que)}</div>
          <div style="font-size:11px;color:var(--text2);display:flex;justify-content:space-between;margin-bottom:6px">
            <span>${esc(a.quem || '—')}</span>
            <span>${esc(a.quando || '—')}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="badge ${a.gut_total > 400 ? 'b-red' : a.gut_total > 100 ? 'b-warn' : 'b-ok'}">${esc(gutTxt)}</span>
            ${podeEditarGestao() && !ehTerminal(FLUXO_ACOES, a.status) ? `<button class="btn btn-s btn-sm" onclick="avancarAcao(${a.id})">→</button>` : ''}
          </div>
        </div>`
      },
    })
    elKanban.innerHTML = `<div class="kanban" style="display:flex;gap:12px;overflow-x:auto">${kanbanHtml}</div>`
  } else if (MODO_ACOES === 'gantt') {
    const itensGantt = ACOES.map(a => {
      const inicio = (a.criado_em || '').slice(0, 10)
      const fim = a.quando || inicio
      return {
        id: a.id,
        rotulo: a.o_que,
        inicio,
        fim,
        tom: tomDaEtapa(FLUXO_ACOES, a.status),
      }
    })
    const anoAtual = new Date().getFullYear()
    elGantt.innerHTML = htmlGantt(itensGantt, {
      inicio: `${anoAtual}-01-01`,
      fim: `${anoAtual}-12-31`,
      hoje: new Date().toISOString().slice(0, 10),
    })
  }
}

// ── Aba 3: Calendário Consolidado ──
function renderCalendario() {
  const container = document.getElementById('calendario-consolidado')
  const titulo = document.getElementById('calendario-titulo')
  if (!container) return

  if (titulo) {
    titulo.textContent = `Calendário Consolidado — ${MESES[CALENDARIO_MES]} de ${CALENDARIO_ANO}`
  }

  const topoAcoes = document.getElementById('calendario-topo-acoes')
  if (topoAcoes) {
    topoAcoes.innerHTML = `
      <div style="display:flex;gap:6px">
        <button class="btn btn-s btn-sm" onclick="mudarMesCalendario(-1)" title="Mês anterior">&lt;</button>
        <button class="btn btn-s btn-sm" onclick="mudarMesCalendario(1)" title="Próximo mês">&gt;</button>
      </div>`
  }

  const hojeData = new Date()
  const hojeDia = (hojeData.getFullYear() === CALENDARIO_ANO && hojeData.getMonth() === CALENDARIO_MES)
    ? hojeData.getDate()
    : null

  const gridHtml = htmlCalendario(CALENDARIO_ANO, CALENDARIO_MES, EVENTOS_CALENDARIO, {
    hoje: hojeDia,
    rotuloEvento: e => e.origem,
    classeEvento: e => e.classe || 'os',
  })

  container.innerHTML = `<div class="calendar-grid" style="overflow-x:auto">${gridHtml}</div>`
}

function mudarMesCalendario(delta) {
  CALENDARIO_MES += delta
  if (CALENDARIO_MES < 0) {
    CALENDARIO_MES = 11
    CALENDARIO_ANO--
  } else if (CALENDARIO_MES > 11) {
    CALENDARIO_MES = 0
    CALENDARIO_ANO++
  }
  renderCalendario()
}

// ── Aba 4: Ferramentas da Qualidade ──
function renderFerramentas() {
  // 1) Pareto de causas
  const elPareto = document.getElementById('ferramentas-pareto')
  if (elPareto) {
    const contagemCausas = {}
    CAUSAS.forEach(c => {
      const cat = c.categoria || 'geral'
      contagemCausas[cat] = (contagemCausas[cat] || 0) + 1
    })
    const seriePareto = Object.entries(contagemCausas).map(([rotulo, valor]) => ({ rotulo, valor }))
    if (seriePareto.length === 0) {
      seriePareto.push({ rotulo: 'Método', valor: 8 }, { rotulo: 'Material', valor: 5 }, { rotulo: 'Máquina', valor: 3 }, { rotulo: 'Mão de Obra', valor: 2 })
    }
    elPareto.innerHTML = pareto(seriePareto)
  }

  // 2) Carta de controle
  const elControle = document.getElementById('ferramentas-controle')
  if (elControle) {
    const serieControle = [
      { rotulo: '1', valor: 4.2 },
      { rotulo: '2', valor: 3.8 },
      { rotulo: '3', valor: 5.1 },
      { rotulo: '4', valor: 4.0 },
      { rotulo: '5', valor: 3.9 },
      { rotulo: '6', valor: 6.2 },
      { rotulo: '7', valor: 4.1 },
      { rotulo: '8', valor: 3.7 },
    ]
    elControle.innerHTML = cartaControle(serieControle)
  }

  // 3) Curva ABC
  const elAbc = document.getElementById('ferramentas-abc')
  if (elAbc) {
    const itensAbc = ACOES.map(a => ({ rotulo: a.o_que, valor: Number(a.quanto) || (a.gut_total != null ? a.gut_total * 10 : 50) }))
    const resAbc = classificarAbc(itensAbc, 'valor')
    if (resAbc.linhas.length === 0) {
      elAbc.innerHTML = vazio('Nenhum item para classificar', 'Cadastre itens com valor para gerar a curva')
    } else {
      const trs = resAbc.linhas.slice(0, 10).map(l => {
        const clsBadge = l.classe === 'A' ? 'b-accent' : l.classe === 'B' ? 'b-blue' : 'b-neutro'
        return `<tr>
          <td>${esc(l.item.rotulo)}</td>
          <td class="num">${l.valor.toFixed(2)}</td>
          <td class="num">${l.participacao.toFixed(1)}%</td>
          <td class="num">${l.acumulado.toFixed(1)}%</td>
          <td><span class="badge ${clsBadge}">${l.classe}</span></td>
        </tr>`
      }).join('')
      elAbc.innerHTML = `<table class="tbl"><thead><tr><th>Item</th><th class="num">Valor</th><th class="num">Part.</th><th class="num">Acum.</th><th>Classe</th></tr></thead><tbody>${trs}</tbody></table>`
    }
  }

  // 4) Ciclo PDCA das ações
  const elPdca = document.getElementById('ferramentas-pdca')
  if (elPdca) {
    const plan = ACOES.filter(a => a.status === 'planejada').length
    const exec = ACOES.filter(a => a.status === 'em_execucao').length
    const check = ACOES.filter(a => a.status === 'verificacao').length
    const act = ACOES.filter(a => a.status === 'concluida').length

    elPdca.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:8px">
        <div style="background:var(--surface2);padding:10px;border-radius:6px;border-left:3px solid var(--blue)">
          <div style="font-size:11px;font-weight:700">PLAN (Planejar)</div>
          <div style="font-size:20px;font-weight:700">${plan}</div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:6px;border-left:3px solid var(--yellow)">
          <div style="font-size:11px;font-weight:700">DO (Executar)</div>
          <div style="font-size:20px;font-weight:700">${exec}</div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:6px;border-left:3px solid var(--blue)">
          <div style="font-size:11px;font-weight:700">CHECK (Verificar)</div>
          <div style="font-size:20px;font-weight:700">${check}</div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:6px;border-left:3px solid var(--green)">
          <div style="font-size:11px;font-weight:700">ACT (Agir / Concluir)</div>
          <div style="font-size:20px;font-weight:700">${act}</div>
        </div>
      </div>`
  }

  // 5) Ishikawa 6M
  const elIshikawa = document.getElementById('ferramentas-ishikawa')
  const elIshikawaAcoes = document.getElementById('ferramentas-ishikawa-acoes')
  if (elIshikawaAcoes && podeEditarGestao() && GES_OK && ACOES.length > 0) {
    elIshikawaAcoes.innerHTML = '<button class="btn btn-s btn-sm" onclick="abrirModalCausa()">+ Causa</button>'
  }
  if (elIshikawa) {
    const categorias = [
      { id: 'metodo', nome: 'Método' },
      { id: 'maquina', nome: 'Máquina' },
      { id: 'mao_de_obra', nome: 'Mão de Obra' },
      { id: 'material', nome: 'Material' },
      { id: 'medicao', nome: 'Medição' },
      { id: 'meio_ambiente', nome: 'Meio Ambiente' },
    ]
    const causasPorCat = {}
    CAUSAS.forEach(c => {
      ;(causasPorCat[c.categoria] ||= []).push(c.causa)
    })

    const colunasHtml = categorias.map(cat => {
      const lista = causasPorCat[cat.id] || []
      const causasLis = lista.length
        ? lista.map(t => `<li style="font-size:12px;margin-bottom:4px">${esc(t)}</li>`).join('')
        : '<li style="font-size:11px;color:var(--text3);list-style:none">— sem causas —</li>'
      return `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px">
          <div style="font-weight:700;font-size:12px;color:var(--accent);margin-bottom:6px">${esc(cat.nome)}</div>
          <ul style="padding-left:16px;margin:0">${causasLis}</ul>
        </div>`
    }).join('')

    elIshikawa.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">${colunasHtml}</div>`
  }

  // 6) Checklist 5S
  const el5s = document.getElementById('ferramentas-5s')
  if (el5s) {
    el5s.innerHTML = vazio('Nenhum checklist cadastrado', 'Auditorias 5S serão configuradas para as oficinas')
  }
}

// ── Aba 5: POP (Procedimentos Operacionais Padrão) ──
function renderPop() {
  const topoBtn = document.getElementById('pop-topo-acoes')
  if (topoBtn) {
    topoBtn.innerHTML = (GES_OK && podeEditarGestao())
      ? '<button class="btn btn-p btn-sm" onclick="abrirModalPop()">+ Novo POP</button>'
      : ''
  }

  const container = document.getElementById('pop-lista')
  if (!container) return

  if (!GES_OK) {
    container.innerHTML = vazio('Migração 60 não aplicada', 'As tabelas ges_* ainda não existem neste banco')
    return
  }

  if (POPS.length === 0) {
    container.innerHTML = vazio('Nenhum POP cadastrado', 'Vincule um POP a um ativo ou a um plano de manutenção')
    return
  }

  const ordenados = aplicarOrdemEFiltro(POPS, ORDEM_POP, FILTROS_POP, COLUNAS_POP)
  const ths = COLUNAS_POP.map(c => `<th class="sortable" onclick="ordenarTabelaPop('${c.id}')">${esc(c.rotulo)}${ORDEM_POP.coluna === c.id ? (ORDEM_POP.dir === 'asc' ? ' ↑' : ' ↓') : ''}</th>`).join('')

  const trs = ordenados.map(p => {
    const vinculo = p.ativo_ref || p.plano_ref ? `${p.ativo_ref || ''} ${p.plano_ref || ''}`.trim() : '—'
    return `<tr>
      <td><strong title="${esc(p.titulo)}">${esc(p.titulo)}</strong></td>
      <td>${esc(p.modulo || 'Geral')}</td>
      <td>${esc(vinculo)}</td>
      <td>${esc((p.criado_em || '').slice(0, 10))}</td>
      <td style="text-align:right">
        ${podeEditarGestao() ? `<button class="btn btn-s btn-sm" onclick="arquivarPop(${p.id})" style="color:var(--red)">Arquivar POP</button>` : ''}
      </td>
    </tr>`
  }).join('')

  container.innerHTML = `<table class="tbl"><thead><tr>${ths}<th style="text-align:right">Ações</th></tr></thead><tbody>${trs}</tbody></table>`
}

// ── Funções de modal e mutações ──
function abrirModalAcao(id = null) {
  document.getElementById('modal-acao-erro').classList.add('hidden')
  document.getElementById('acao-o-que').value = ''
  document.getElementById('acao-por-que').value = ''
  document.getElementById('acao-onde').value = ''
  document.getElementById('acao-quando').value = ''
  document.getElementById('acao-quem').value = ''
  document.getElementById('acao-quanto').value = ''
  document.getElementById('acao-como').value = ''
  document.getElementById('acao-g').value = ''
  document.getElementById('acao-u').value = ''
  document.getElementById('acao-t').value = ''
  document.getElementById('acao-modulo').value = ''
  document.getElementById('acao-ativo-ref').value = ''
  atualizarGutModal()
  document.getElementById('modal-acao').classList.remove('hidden')
}

function fecharModal(tipo) {
  const m = document.getElementById(`modal-${tipo}`)
  if (m) m.classList.add('hidden')
}

function atualizarGutModal() {
  const g = Number(document.getElementById('acao-g').value) || null
  const u = Number(document.getElementById('acao-u').value) || null
  const t = Number(document.getElementById('acao-t').value) || null
  const resumo = document.getElementById('acao-gut-resumo')
  if (!resumo) return

  if (g != null && u != null && t != null) {
    const total = gutTotal(g, u, t)
    const rot = rotuloGut(total)
    resumo.textContent = `Total: ${total} (${rot})`
  } else {
    resumo.textContent = 'Não avaliado'
  }
}

async function salvarAcao() {
  const oQue = document.getElementById('acao-o-que').value.trim()
  if (!oQue) {
    const erroEl = document.getElementById('modal-acao-erro')
    erroEl.textContent = 'O campo "O quê" é obrigatório.'
    erroEl.classList.remove('hidden')
    return
  }

  const gVal = document.getElementById('acao-g').value
  const uVal = document.getElementById('acao-u').value
  const tVal = document.getElementById('acao-t').value
  const quantoVal = document.getElementById('acao-quanto').value

  const payload = {
    o_que: oQue,
    por_que: document.getElementById('acao-por-que').value.trim() || null,
    onde: document.getElementById('acao-onde').value.trim() || null,
    quando: document.getElementById('acao-quando').value || null,
    quem: document.getElementById('acao-quem').value.trim() || null,
    como: document.getElementById('acao-como').value.trim() || null,
    quanto: quantoVal ? Number(quantoVal) : null,
    g: gVal !== '' ? Number(gVal) : null,
    u: uVal !== '' ? Number(uVal) : null,
    t: tVal !== '' ? Number(tVal) : null,
    modulo: document.getElementById('acao-modulo').value || null,
    ativo_ref: document.getElementById('acao-ativo-ref').value.trim() || null,
    status: 'planejada',
    criado_por: USUARIO?.email || USUARIO?.cargo || 'gestor',
  }

  const { error } = await supa.from('ges_acoes').insert(payload)
  if (error) {
    alert('Erro: ' + error.message)
    return
  }

  fecharModal('acao')
  await carregarTudo()
}

async function avancarAcao(id) {
  const acao = ACOES.find(a => a.id === id)
  if (!acao) return
  const proximo = acao.status === 'planejada' ? 'em_execucao' : acao.status === 'em_execucao' ? 'verificacao' : 'concluida'
  const { error } = await supa.from('ges_acoes').update({ status: proximo, atualizado_em: new Date().toISOString() }).eq('id', id)
  if (error) {
    alert('Erro: ' + error.message)
    return
  }
  await carregarTudo()
}

function cancelarAcao(id) {
  pedirConfirmacao('Cancelar ação: esta ação sai do fluxo ativo e não pode ser reaberta. Confirma?', async () => {
    const { error } = await supa.from('ges_acoes').update({ status: 'cancelada', atualizado_em: new Date().toISOString() }).eq('id', id)
    if (error) {
      alert('Erro: ' + error.message)
      return
    }
    await carregarTudo()
  })
}

function abrirModalPop() {
  document.getElementById('modal-pop-erro').classList.add('hidden')
  document.getElementById('pop-titulo').value = ''
  document.getElementById('pop-modulo').value = ''
  document.getElementById('pop-ativo-ref').value = ''
  document.getElementById('pop-plano-ref').value = ''
  document.getElementById('pop-texto').value = ''
  document.getElementById('modal-pop').classList.remove('hidden')
}

async function salvarPop() {
  const titulo = document.getElementById('pop-titulo').value.trim()
  const texto = document.getElementById('pop-texto').value.trim()
  if (!titulo || !texto) {
    const erroEl = document.getElementById('modal-pop-erro')
    erroEl.textContent = 'Título e conteúdo são obrigatórios.'
    erroEl.classList.remove('hidden')
    return
  }

  const payload = {
    titulo,
    texto,
    modulo: document.getElementById('pop-modulo').value || null,
    ativo_ref: document.getElementById('pop-ativo-ref').value.trim() || null,
    plano_ref: document.getElementById('pop-plano-ref').value.trim() || null,
    criado_por: USUARIO?.email || USUARIO?.cargo || 'gestor',
  }

  const { error } = await supa.from('ges_pop').insert(payload)
  if (error) {
    alert('Erro: ' + error.message)
    return
  }

  fecharModal('pop')
  await carregarTudo()
}

function arquivarPop(id) {
  pedirConfirmacao('Arquivar POP: o procedimento sai da lista ativa e fica disponível no histórico. Confirma?', async () => {
    const { error } = await supa.from('ges_pop').update({ ativo: false }).eq('id', id)
    if (error) {
      alert('Erro: ' + error.message)
      return
    }
    await carregarTudo()
  })
}

function abrirModalCausa() {
  const selectAcao = document.getElementById('causa-acao-id')
  selectAcao.innerHTML = ACOES.map(a => `<option value="${a.id}">${esc(a.o_que)}</option>`).join('')
  document.getElementById('causa-texto').value = ''
  document.getElementById('modal-causa').classList.remove('hidden')
}

async function salvarCausa() {
  const acaoId = document.getElementById('causa-acao-id').value
  const categoria = document.getElementById('causa-categoria').value
  const causa = document.getElementById('causa-texto').value.trim()

  if (!acaoId || !causa) {
    const erroEl = document.getElementById('modal-causa-erro')
    erroEl.textContent = 'Preencha a ação e o texto da causa.'
    erroEl.classList.remove('hidden')
    return
  }

  const { error } = await supa.from('ges_causas').insert({
    acao_id: Number(acaoId),
    categoria,
    causa,
  })

  if (error) {
    alert('Erro: ' + error.message)
    return
  }

  fecharModal('causa')
  await carregarTudo()
}

function trocarModoAcoes(modo) {
  MODO_ACOES = modo
  renderAcoes()
}

function ordenarTabelaAcoes(coluna) {
  ORDEM_ACOES = {
    coluna,
    dir: ORDEM_ACOES.coluna === coluna ? proximaOrdem(ORDEM_ACOES.dir) : 'asc',
  }
  renderAcoes()
}

function ordenarTabelaPop(coluna) {
  ORDEM_POP = {
    coluna,
    dir: ORDEM_POP.coluna === coluna ? proximaOrdem(ORDEM_POP.dir) : 'asc',
  }
  renderPop()
}

function trocarView(id, botao) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  const alvo = document.getElementById(`view-${id}`)
  if (alvo) alvo.classList.add('active')
  if (botao) botao.classList.add('active')
}

function exporNoWindow() {
  globalThis.fecharModal = fecharModal
  globalThis.abrirModalAcao = abrirModalAcao
  globalThis.salvarAcao = salvarAcao
  globalThis.abrirModalPop = abrirModalPop
  globalThis.salvarPop = salvarPop
  globalThis.abrirModalCausa = abrirModalCausa
  globalThis.salvarCausa = salvarCausa
  globalThis.atualizarGutModal = atualizarGutModal
  globalThis.trocarView = trocarView
  globalThis.trocarModoAcoes = trocarModoAcoes
  globalThis.mudarMesCalendario = mudarMesCalendario
  globalThis.avancarAcao = avancarAcao
  globalThis.cancelarAcao = cancelarAcao
  globalThis.arquivarPop = arquivarPop
  globalThis.ordenarTabelaAcoes = ordenarTabelaAcoes
  globalThis.ordenarTabelaPop = ordenarTabelaPop
  globalThis.fecharConfirmacao = fecharConfirmacao
  globalThis.sondarGestao = sondarGestao
  globalThis.carregarTudo = carregarTudo
  globalThis.podeEditarGestao = podeEditarGestao
}

// ── Inicialização ──
async function boot() {
  exporNoWindow()

  aplicarShell({
    nome: 'Gestão',
    versao: '1.0',
    navItems: [
      { id: 'painel', icone: 'painel', label: 'Painel', ativo: true },
      { id: 'acoes', icone: 'acoes', label: 'Ações' },
      { id: 'calendario', icone: 'calendario', label: 'Calendário' },
      { id: 'ferramentas', icone: 'ferramentas', label: 'Ferramentas' },
      { id: 'pop', icone: 'pop', label: 'POP' },
    ],
  })

  try {
    supa = await criarClienteSupabase()
  } catch (err) {
    alert('Erro ao conectar ao Supabase: ' + err.message)
    return
  }

  auth = new Auth(supa, { appNome: 'Gestão' })
  auth.onLogin(async usuario => {
    USUARIO = usuario
    const userChip = document.getElementById('user-chip')
    if (userChip) {
      userChip.textContent = usuario.cargo === 'observador'
        ? 'Livre · observador'
        : `${usuario.cargo}`
    }
    await carregarTudo()
  })

  auth.mount('#login-screen')
}

boot()
