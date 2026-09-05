// ══════════════════════════════════════════════════════════════════
// PMOC Gestão — gestão à vista, plano de ação 5W2H, calendário
// consolidado, ferramentas da qualidade e POP (Fase 13, Onda B).
//
// (1) Por que existe: a Onda A entregou sete núcleos puros em `shared/`
// (gráfico, indicadores, Gantt, curva ABC, GUT, kanban, calendário) e
// nenhuma tela usava os sete juntos. Este módulo é o primeiro consumidor
// de todos ao mesmo tempo — e é onde a gestão da manutenção deixa de ser
// planilha: indicadores do item 7.5 da NBR 5674 com meta e semáforo,
// ações 5W2H priorizadas por GUT em lista, kanban e Gantt, o calendário
// de todos os módulos num mês só, e as ferramentas de análise.
//
// (2) Fronteira de leitura (D-13-03, D-19, PLAT-15): este módulo LÊ
// `maq_*`, `transp_*`, `logs_manutencao` (Refrigeração), `pred_*` e
// `cal_*`, e NUNCA escreve em nenhuma delas. A única escrita do módulo é
// nas cinco tabelas `ges_*` da migração 60, que são suas. Refrigeração é
// módulo congelado: lido, jamais editado.
//
// (3) A sonda `GES_OK` é o que torna este arquivo publicável ANTES da
// migração 60 rodar (mesma ordem de D-cf8-25: frontend primeiro, SQL
// depois). Uma leitura só, sobre uma tabela só, dentro de um bloco de
// captura, fora do carregamento principal — com ela falsa o módulo abre,
// diz na tela que a migração não foi aplicada, e o Calendário e as
// ferramentas que leem os outros módulos continuam inteiros.
//
// (4) Nenhuma cor escrita aqui. Tom é sempre o nome de um tom semântico
// resolvido por `shared/pmoc.css` — mesma regra de `shared/icones.js`,
// `shared/componentes.js` e dos sete núcleos da Onda A.
// ══════════════════════════════════════════════════════════════════

import { Auth } from '../shared/auth.js'
import { aplicarShell } from '../shared/shell.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { icone } from '../shared/icones.js'
import { pilula, seletor, chips, regua, vazio } from '../shared/componentes.js'
import { barras, pareto, cartaControle } from '../shared/grafico.js'
import { cartaoIndicador } from '../shared/indicadores.js'
import { htmlGantt } from '../shared/gantt.js'
import { classificarAbc } from '../shared/abc.js'
import { GUT_ESCALA, gutTotal, rotuloGut, classificarGut } from '../shared/gut.js'
import { agruparKanban, htmlKanban } from '../shared/kanban.js'
import { htmlCalendario, MESES } from '../shared/calendario.js'
import { aplicarOrdemEFiltro, proximaOrdem } from '../shared/tabela.js'
import { etapasDe, rotuloDaEtapa, tomDaEtapa, proximosEstados, ehTerminal } from '../shared/fluxo.js'

// ── estado global ──────────────────────────────────────────────────────
let supa = null
let auth = null
let USUARIO = null

// Sonda da migração 60. Nasce FALSA de propósito: qualquer consumidor que
// rode antes de `sondarGestao()` cai no ramo honesto — a tela diz que a
// migração não foi aplicada — em vez de consultar uma tabela inexistente.
let GES_OK = false

let ACOES = []
let INDICADORES = []
let INDICADOR_VALORES = []
let POPS = []
let CAUSAS = []
let EVENTOS_CALENDARIO = []
// Fonte cuja relação não existe neste banco, ou que devolveu erro: é
// OMITIDA do calendário e CONTADA aqui, nunca silenciada. Uma fonte que
// some sem aviso faz o mês parecer vazio quando na verdade não foi lido.
let FONTES_OMITIDAS = []
let METRICAS = { valores: {}, series: {} }

let ACOES_VISTA = 'lista'
let ORD_ACOES = { coluna: 'gut_total', dir: 'desc' }
let FILTROS_ACOES = {}
let FILTRO_ABERTO = false
let FERRAMENTA = 'pareto'
let CAL_ANO = new Date().getFullYear()
let CAL_MES = new Date().getMonth()

let ACAO_EDICAO = null
let POP_EDICAO = null
let ACAO_DA_CAUSA = null
let CONFIRMACAO = null

const el = id => document.getElementById(id)
const esc = valor => String(valor ?? '').replace(/[&<>'"]/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[c])

// ── permissões ─────────────────────────────────────────────────────────
// Espelha a policy da migração 60: escrita para quem autenticou. O cargo
// Livre (observador) nunca chama signInWithPassword, logo continua anônimo
// e o Postgres recusaria — a checagem aqui é UX, a RLS é a autoridade.
const podeEditarGestao = () => ['admin', 'gestor', 'tecnico'].includes(USUARIO?.role)

// ── fluxo da ação 5W2H ─────────────────────────────────────────────────
// Os cinco estados são a MESMA lista fechada do check de `ges_acoes.status`
// na migração 60. Os rótulos nomeiam o que a etapa espera, que é a pergunta
// de quem varre a lista. Terminais ficam fora de `etapas`, como manda
// shared/fluxo.js — encerrado é encerrado.
const FLUXO_ACAO = {
  etapas: [
    { id: 'planejada', curto: 'Planejar', rotulo: 'Planejada — aguardando início', tom: 'info' },
    { id: 'em_execucao', curto: 'Executar', rotulo: 'Em execução — aguardando conclusão', tom: 'warn' },
    { id: 'verificacao', curto: 'Verificar', rotulo: 'Em verificação — aguardando conferência', tom: 'warn' },
  ],
  terminais: ['concluida', 'cancelada'],
  terminaisDeSucesso: ['concluida'],
  rotulosTerminais: { concluida: 'Concluída — verificada e fechada', cancelada: 'Cancelada — fora do fluxo' },
  tonsTerminais: { concluida: 'ok', cancelada: 'neutro' },
}

// Derivada, nunca escrita à mão: um estado novo no fluxo passa a valer
// aqui sozinho.
const ESTADOS_ACAO = [...etapasDe(FLUXO_ACAO), ...FLUXO_ACAO.terminais]
const COLUNAS_KANBAN = ESTADOS_ACAO.map(id => ({ id, rotulo: rotuloDaEtapa(FLUXO_ACAO, id).split(' — ')[0] }))

// PDCA é o mesmo fluxo lido por outro nome — não uma segunda lista de
// estados. Ciclo de Deming sobre as ações que já existem.
const PDCA = [
  { fase: 'P · Planejar', estados: ['planejada'] },
  { fase: 'D · Executar', estados: ['em_execucao'] },
  { fase: 'C · Verificar', estados: ['verificacao'] },
  { fase: 'A · Agir', estados: ['concluida'] },
]

// 6M do Ishikawa: mesma lista fechada do check de `ges_causas.categoria`.
const CATEGORIAS_6M = [
  { id: 'metodo', rotulo: 'Método' },
  { id: 'maquina', rotulo: 'Máquina' },
  { id: 'mao_de_obra', rotulo: 'Mão de obra' },
  { id: 'material', rotulo: 'Material' },
  { id: 'medicao', rotulo: 'Medição' },
  { id: 'meio_ambiente', rotulo: 'Meio ambiente' },
]

// Os módulos que uma ação ou um POP pode nomear. Texto livre no banco
// (`ges_acoes.modulo`), lista fechada só na tela — o /gestao lê os outros
// módulos, nunca amarra o esquema deles.
const MODULOS_ORIGEM = ['refrigeracao', 'maquinas', 'transportes', 'eletrica', 'fonoclama', 'predial', 'calibracao', 'geral']

// ── indicadores calculados da plataforma ───────────────────────────────
// A DEFINIÇÃO de meta, sentido e faixa de atenção vem de `ges_indicadores`
// quando a migração 60 existe; a FORMA (rótulo, unidade, como se calcula)
// mora aqui, porque é derivada do dado dos outros módulos e não de um
// cadastro. Indicador cadastrado cujo código não bate com nenhum destes é
// desenhado com o último valor lançado em `ges_indicador_valores`.
//
// `serie: false` é declaração de honestidade, não limitação técnica: OS
// abertas agora, backlog médio e MTBF são fotografia do momento, e o banco
// não guarda a fotografia de meses passados. Reconstruir a curva a partir
// do que existe hoje produziria um desenho plausível e errado.
const INDICADORES_PLATAFORMA = [
  { codigo: 'os_abertas', rotulo: 'OS abertas (todos os módulos)', unidade: 'OS', sentido: 'menor', serie: false },
  { codigo: 'backlog_dias', rotulo: 'Backlog médio das OS abertas', unidade: 'dias', sentido: 'menor', serie: false },
  { codigo: 'mtbf', rotulo: 'MTBF — tempo médio entre falhas', unidade: 'dias', sentido: 'maior', serie: false },
  { codigo: 'mttr', rotulo: 'MTTR — tempo médio de reparo', unidade: 'dias', sentido: 'menor', serie: true },
  { codigo: 'custo_realizado_previsto', rotulo: 'Custo realizado sobre previsto', unidade: '%', sentido: 'menor', serie: true },
  { codigo: 'retrabalho', rotulo: 'Taxa de retrabalho', unidade: '%', sentido: 'menor', serie: true },
]

// ── utilidades ─────────────────────────────────────────────────────────
const RE_ISO = /^\d{4}-\d{2}-\d{2}$/
const DIA_MS = 24 * 60 * 60 * 1000

function apenasData(valor) {
  if (typeof valor !== 'string') return null
  const recorte = valor.slice(0, 10)
  return RE_ISO.test(recorte) ? recorte : null
}

function paraDia(iso) {
  const data = apenasData(iso)
  return data ? Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10))) : null
}

function diasEntre(inicio, fim) {
  const a = paraDia(inicio)
  const b = paraDia(fim)
  if (a == null || b == null) return null
  return Math.round((b - a) / DIA_MS)
}

function hojeIso() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

function fmtNumero(valor, casas = 1) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—'
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

function fmtData(iso) {
  const data = apenasData(iso)
  if (!data) return '—'
  return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`
}

function media(numeros) {
  const validos = numeros.filter(n => typeof n === 'number' && Number.isFinite(n))
  if (!validos.length) return null
  return validos.reduce((soma, n) => soma + n, 0) / validos.length
}

/** Erro no idioma do projeto: o aviso nomeia a mensagem do banco, na ação
 *  que falhou, e o que já estava na tela permanece. */
function erroDe(error, contexto) {
  alert(`Erro: ${error?.message || contexto || 'falha desconhecida'}`)
}

// ── sonda da migração 60 ───────────────────────────────────────────────
// Uma leitura, uma linha, uma pergunta — sonda própria, jamais estendida a
// partir de outra (a lição que EST_OK, ATRIB_OK e UNI_OK já pagaram em
// /refrigeracao). O `try` é o que impede um erro de rede de virar exceção
// não tratada no boot.
async function sondarGestao() {
  try {
    const { error } = await supa.from('ges_acoes').select('id').limit(1)
    GES_OK = !error
  } catch (_erro) {
    GES_OK = false
  }
  return GES_OK
}

// ── carga ──────────────────────────────────────────────────────────────
/** Lê uma fonte de outro módulo. Relação inexistente, RLS fechada ou falha
 *  de rede devolvem lista vazia e a fonte é contada em FONTES_OMITIDAS —
 *  uma fonte que falha nunca pode derrubar as outras seis. */
async function lerFonte(rotulo, consulta) {
  try {
    const { data, error } = await consulta()
    if (error) { FONTES_OMITIDAS.push(rotulo); return [] }
    return data || []
  } catch (_erro) {
    FONTES_OMITIDAS.push(rotulo)
    return []
  }
}

async function carregarTudo() {
  // A sonda roda ANTES e FORA do Promise.all: é ela que decide se as
  // leituras de `ges_*` entram na lista. Sem isso, um erro de relação
  // inexistente derrubaria a carga inteira, inclusive a do Calendário
  // consolidado, que não depende da migração 60 para nada.
  await sondarGestao()

  FONTES_OMITIDAS = []
  const [maqOs, maqOps, refriOs, viagens, transpManut, predInsp, predItens, calEquip, calPs] = await Promise.all([
    lerFonte('Máquinas', () => supa.from('maq_os').select('id,ativo_id,tipo,status,descricao,data_abertura,data_conclusao,custo_pecas,custo_mo')),
    lerFonte('Corte', () => supa.from('maq_operacoes').select('id,ativo_id,tipo_servico,status,data_programada')),
    lerFonte('Refrigeração', () => supa.from('logs_manutencao').select('id,equip_id,tipo,status,descricao,data_os')),
    lerFonte('Transportes', () => supa.from('transp_viagens').select('id,ativo_id,data_saida,destino')),
    lerFonte('Transportes', () => supa.from('transp_manutencoes').select('id,ativo_id,status,descricao,data_manutencao')),
    lerFonte('Predial', () => supa.from('pred_inspecoes').select('id,titulo,status,data_vistoria')),
    lerFonte('Predial', () => supa.from('pred_inspecao_itens').select('id,descricao,categoria,gut_total,condicao')),
    lerFonte('Calibração', () => supa.from('cal_equipamentos').select('id,tipo,mod,prox,status')),
    lerFonte('Calibração', () => supa.from('cal_ps').select('id,num,status,cal,valor_prev,valor_exec')),
  ])

  const fontes = { maqOs, maqOps, refriOs, viagens, transpManut, predInsp, predItens, calEquip, calPs }
  EVENTOS_CALENDARIO = montarEventos(fontes)
  METRICAS = calcularMetricas(fontes)

  if (GES_OK) await carregarGestao()
  else { ACOES = []; INDICADORES = []; INDICADOR_VALORES = []; POPS = []; CAUSAS = [] }
}

/** As cinco tabelas próprias. Só chamada com a sonda verde — sem a
 *  migração 60 nenhuma consulta a `ges_*` é disparada. */
async function carregarGestao() {
  const [acoes, indicadores, valores, pops, causas] = await Promise.all([
    supa.from('ges_acoes').select('*').eq('ativo', true).order('criado_em', { ascending: false }),
    supa.from('ges_indicadores').select('*').eq('ativo', true).order('rotulo'),
    supa.from('ges_indicador_valores').select('*').order('periodo'),
    supa.from('ges_pop').select('*').eq('ativo', true).order('criado_em', { ascending: false }),
    supa.from('ges_causas').select('*').order('criado_em'),
  ])
  const falha = [acoes, indicadores, valores, pops, causas].find(r => r.error)
  if (falha) { erroDe(falha.error, 'não foi possível ler as tabelas de gestão'); return }
  ACOES = acoes.data || []
  INDICADORES = indicadores.data || []
  INDICADOR_VALORES = valores.data || []
  POPS = pops.data || []
  CAUSAS = causas.data || []
}

// ── calendário consolidado ─────────────────────────────────────────────
// O evento leva PREFIXO TEXTUAL de origem, nunca uma cor por módulo: o
// vocabulário de tons tem cinco entradas e há sete fontes — inventar uma
// sexta cor diria menos que a palavra. Evento sem data é descartado, que é
// o que shared/calendario.js já faz por conta própria.
function montarEventos({ maqOs, maqOps, refriOs, viagens, transpManut, predInsp, calEquip }) {
  const eventos = []
  const juntar = (lista, origem, campoData, titulo, classe) => {
    for (const linha of lista) {
      const data = apenasData(linha[campoData])
      if (!data) continue
      eventos.push({ data, origem, titulo: titulo(linha), classe })
    }
  }

  juntar(maqOs, 'Máquinas', 'data_abertura', l => l.descricao || `OS ${l.tipo || ''}`.trim(), 'os')
  juntar(maqOps, 'Corte', 'data_programada', l => `Operação de ${l.tipo_servico || 'serviço'}`, 'op')
  juntar(refriOs, 'Refrigeração', 'data_os', l => l.descricao || `OS ${l.tipo || ''}`.trim(), 'os')
  juntar(viagens, 'Transportes', 'data_saida', l => `Viagem ${l.destino || ''}`.trim(), 'op')
  juntar(transpManut, 'Transportes', 'data_manutencao', l => l.descricao || 'Manutenção', 'os')
  juntar(predInsp, 'Predial', 'data_vistoria', l => l.titulo || 'Inspeção', 'op')
  juntar(calEquip, 'Calibração', 'prox', l => `Vence: ${l.tipo || ''} ${l.mod || ''}`.trim(), 'os')

  return eventos
}

// ── indicadores calculados ─────────────────────────────────────────────
const ABERTAS_MAQ = ['pendente', 'em_andamento']
const ABERTAS_REFRI = ['ABERTA', 'DELINEAMENTO', 'APROVACAO', 'EM_EXECUCAO']

function osAbertas({ maqOs, refriOs, transpManut }) {
  return [
    ...maqOs.filter(o => ABERTAS_MAQ.includes(o.status)).map(o => ({ origem: 'Máquinas', abertura: o.data_abertura })),
    ...refriOs.filter(o => ABERTAS_REFRI.includes(String(o.status || '').toUpperCase())).map(o => ({ origem: 'Refrigeração', abertura: o.data_os })),
    ...transpManut.filter(o => ABERTAS_MAQ.includes(o.status)).map(o => ({ origem: 'Transportes', abertura: o.data_manutencao })),
  ]
}

/** Corretivas concluídas de Máquinas, que é o único módulo com as duas
 *  datas do reparo (abertura e conclusão) gravadas hoje. Sem as duas não
 *  existe MTTR — e um MTTR calculado sobre uma data só seria invenção. */
function corretivasConcluidas(maqOs) {
  return maqOs
    .filter(o => o.tipo === 'corretiva' && o.status === 'concluida' && apenasData(o.data_abertura) && apenasData(o.data_conclusao))
    .map(o => ({ ativo: o.ativo_id, abertura: apenasData(o.data_abertura), conclusao: apenasData(o.data_conclusao) }))
    .sort((a, b) => a.abertura.localeCompare(b.abertura))
}

function calcMttr(maqOs) {
  return media(corretivasConcluidas(maqOs).map(o => diasEntre(o.abertura, o.conclusao)))
}

/** MTBF como intervalo médio entre corretivas consecutivas do MESMO ativo.
 *  Um ativo com uma corretiva só não tem intervalo nenhum: fica de fora, em
 *  vez de entrar com um número suposto. */
function calcMtbf(maqOs) {
  const porAtivo = {}
  for (const o of corretivasConcluidas(maqOs)) (porAtivo[o.ativo] ||= []).push(o.abertura)
  const intervalos = []
  for (const datas of Object.values(porAtivo)) {
    for (let i = 1; i < datas.length; i++) intervalos.push(diasEntre(datas[i - 1], datas[i]))
  }
  return media(intervalos)
}

/** Retrabalho: corretiva aberta sobre o mesmo ativo em até 30 dias depois
 *  de outra ter sido concluída. É a definição do item 7.5 da NBR 5674 —
 *  o serviço que precisou ser refeito. */
function calcRetrabalho(maqOs) {
  const lista = corretivasConcluidas(maqOs)
  if (lista.length < 2) return null
  const porAtivo = {}
  for (const o of lista) (porAtivo[o.ativo] ||= []).push(o)
  let refeitas = 0
  for (const ordens of Object.values(porAtivo)) {
    for (let i = 1; i < ordens.length; i++) {
      const intervalo = diasEntre(ordens[i - 1].conclusao, ordens[i].abertura)
      if (intervalo != null && intervalo >= 0 && intervalo <= 30) refeitas++
    }
  }
  return (refeitas / lista.length) * 100
}

/** Custo realizado sobre previsto, em %. Vem de `cal_ps`, que é onde a
 *  plataforma guarda o par previsto × executado do mesmo serviço. Soma de
 *  previsto igual a zero devolve nulo — não existe razão sobre zero. */
function calcCusto(calPs) {
  const concluidos = calPs.filter(p => p.status === 'CONCLUIDO')
  const previsto = concluidos.reduce((s, p) => s + (Number(p.valor_prev) || 0), 0)
  const executado = concluidos.reduce((s, p) => s + (Number(p.valor_exec) || 0), 0)
  if (previsto <= 0) return null
  return (executado / previsto) * 100
}

function ultimosMeses(quantos) {
  const hoje = new Date()
  const meses = []
  for (let i = quantos - 1; i >= 0; i--) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    meses.push(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`)
  }
  return meses
}

function calcularMetricas(fontes) {
  const abertas = osAbertas(fontes)
  const hoje = hojeIso()
  const meses = ultimosMeses(6)

  const valores = {
    os_abertas: abertas.length,
    backlog_dias: media(abertas.map(o => diasEntre(o.abertura, hoje))),
    mtbf: calcMtbf(fontes.maqOs),
    mttr: calcMttr(fontes.maqOs),
    custo_realizado_previsto: calcCusto(fontes.calPs),
    retrabalho: calcRetrabalho(fontes.maqOs),
  }

  // Série só para o que fecha dentro de um mês (ver o comentário de
  // INDICADORES_PLATAFORMA). Mês sem dado sai da série em vez de virar
  // zero — zero afirmaria uma medição que não houve.
  const porMes = (lista, campo, calculo) => meses
    .map(mes => calculo(lista.filter(item => String(item[campo] || '').startsWith(mes))))
    .filter(v => typeof v === 'number' && Number.isFinite(v))

  const series = {
    mttr: porMes(fontes.maqOs, 'data_conclusao', calcMttr),
    custo_realizado_previsto: porMes(fontes.calPs, 'cal', calcCusto),
    retrabalho: porMes(fontes.maqOs, 'data_abertura', calcRetrabalho),
  }

  // Custo de manutenção por ativo, para a curva ABC. `maq_os` é a única
  // tabela da plataforma que guarda peças e mão de obra na mesma linha;
  // OS sem custo lançado fica fora, em vez de entrar como zero e empurrar
  // todo mundo para a classe C.
  const acumulado = {}
  for (const o of fontes.maqOs) {
    const custo = (Number(o.custo_pecas) || 0) + (Number(o.custo_mo) || 0)
    if (custo > 0 && o.ativo_id != null) acumulado[o.ativo_id] = (acumulado[o.ativo_id] || 0) + custo
  }
  const custoPorAtivo = Object.entries(acumulado).map(([ativo, valor]) => ({ ativo, valor }))

  return { valores, series, abertas, custoPorAtivo }
}

// ── Painel ─────────────────────────────────────────────────────────────
/** Definição de tela de um indicador calculado: a forma vem daqui, a meta
 *  e a faixa de atenção vêm de `ges_indicadores` quando existe uma linha
 *  com o mesmo código. Sem cadastro o cartão sai com "Sem meta definida",
 *  em tom de informação — não é bom nem ruim, é dado sem referência. */
function definicaoDe(base) {
  const cadastrada = INDICADORES.find(i => i.codigo === base.codigo)
  return {
    rotulo: base.rotulo,
    unidade: cadastrada?.unidade || base.unidade,
    meta: cadastrada && cadastrada.meta != null ? Number(cadastrada.meta) : undefined,
    sentido: cadastrada?.sentido || base.sentido,
    faixas: cadastrada && cadastrada.faixa_atencao != null ? Number(cadastrada.faixa_atencao) : undefined,
  }
}

function htmlPainelPlataforma() {
  const porOrigem = {}
  for (const o of (METRICAS.abertas || [])) porOrigem[o.origem] = (porOrigem[o.origem] || 0) + 1
  const serie = Object.entries(porOrigem).map(([rotulo, valor]) => ({ rotulo, valor }))

  const cartoes = INDICADORES_PLATAFORMA.map(base => {
    const valor = METRICAS.valores?.[base.codigo]
    const arredondado = typeof valor === 'number' && Number.isFinite(valor) ? Number(valor.toFixed(1)) : null
    const serieIndicador = base.serie ? (METRICAS.series?.[base.codigo] || []) : []
    return cartaoIndicador(definicaoDe(base), arredondado, serieIndicador)
  }).join('')

  return `
    <div class="panel-card" style="margin-bottom:16px">
      <h3>Ordens de serviço abertas por módulo</h3>
      ${serie.length
        ? barras(serie)
        : vazio('Nenhuma OS aberta na plataforma', 'Todo serviço registrado está concluído ou cancelado')}
      <div class="help">Contado ao vivo de <code>maq_os</code>, <code>logs_manutencao</code> e
        <code>transp_manutencoes</code>. Não depende da migração 60.</div>
    </div>
    <div class="panel-card" style="margin-bottom:16px">
      <h3>Indicadores da manutenção (NBR 5674, item 7.5)</h3>
      <div class="painel-grade">${cartoes}</div>
      <div class="help">Valor calculado sobre o dado dos outros módulos. A meta e a faixa de atenção
        vêm de <code>ges_indicadores</code> — sem cadastro, o cartão diz que não há meta em vez de
        inventar um alvo.</div>
    </div>`
}

function htmlPainelCadastrados() {
  if (!GES_OK) {
    return `<div class="panel-card"><h3>Indicadores cadastrados</h3>
      ${vazio('Migração 60 não aplicada', 'As tabelas ges_* ainda não existem neste banco')}</div>`
  }

  const codigosCalculados = INDICADORES_PLATAFORMA.map(i => i.codigo)
  const proprios = INDICADORES.filter(i => !codigosCalculados.includes(i.codigo))
  if (!proprios.length) {
    return `<div class="panel-card"><h3>Indicadores cadastrados</h3>
      ${vazio('Nenhum indicador cadastrado', 'Indicadores aparecem aqui depois da migração 60 e do primeiro valor lançado')}</div>`
  }

  const cartoes = proprios.map(def => {
    const serie = INDICADOR_VALORES
      .filter(v => v.indicador_id === def.id)
      .map(v => Number(v.valor))
      .filter(v => Number.isFinite(v))
    const ultimo = serie.length ? serie[serie.length - 1] : null
    return cartaoIndicador({
      rotulo: def.rotulo,
      unidade: def.unidade || '',
      meta: def.meta != null ? Number(def.meta) : undefined,
      sentido: def.sentido,
      faixas: def.faixa_atencao != null ? Number(def.faixa_atencao) : undefined,
    }, ultimo, serie)
  }).join('')

  return `<div class="panel-card"><h3>Indicadores cadastrados</h3>
    <div class="painel-grade">${cartoes}</div></div>`
}

function htmlPainel() {
  return htmlPainelPlataforma() + htmlPainelCadastrados()
}

function renderPainel() {
  el('painel-indicadores').innerHTML = htmlPainel()
}

// ── Ações ──────────────────────────────────────────────────────────────
const COLUNAS_ACOES = [
  { id: 'o_que', rotulo: 'O quê', tipo: 'texto', valor: a => a.o_que, texto: a => a.o_que || '' },
  { id: 'quem', rotulo: 'Quem', tipo: 'texto', valor: a => a.quem, texto: a => a.quem || '' },
  { id: 'quando', rotulo: 'Quando', tipo: 'texto', valor: a => a.quando, texto: a => a.quando || '' },
  { id: 'modulo', rotulo: 'Módulo', tipo: 'texto', valor: a => a.modulo, texto: a => a.modulo || '' },
  { id: 'gut_total', rotulo: 'GUT', tipo: 'numero', valor: a => a.gut_total, texto: a => a.gut_total == null ? '' : String(a.gut_total) },
  { id: 'status', rotulo: 'Situação', tipo: 'texto', valor: a => a.status, texto: a => rotuloDaEtapa(FLUXO_ACAO, a.status) },
]

function acoesNaTela() {
  return aplicarOrdemEFiltro(ACOES, ORD_ACOES, FILTROS_ACOES, COLUNAS_ACOES)
}

/** O total vem da coluna gerada do banco. `gutTotal` é a rede de segurança
 *  para a linha que ainda não tem a coluna resolvida (uma leitura parcial,
 *  um registro recém-inserido devolvido sem ela): mesma regra, mesmo
 *  resultado, e nulo continua sendo "não avaliado". */
function totalGut(acao) {
  return acao.gut_total != null ? acao.gut_total : gutTotal(acao.g, acao.u, acao.t)
}

function setaDe(coluna) {
  if (ORD_ACOES.coluna !== coluna) return '⇅'
  return ORD_ACOES.dir === 'asc' ? '↑' : ORD_ACOES.dir === 'desc' ? '↓' : '⇅'
}

function htmlListaAcoes(lista) {
  if (!lista.length) return vazioDasAcoes()

  const cabecalho = COLUNAS_ACOES.map(c => `<th><button class="btn btn-s btn-sm" style="width:100%"
    onclick="ordenarAcoes('${c.id}')" aria-label="Ordenar por ${esc(c.rotulo)}">${esc(c.rotulo)} ${setaDe(c.id)}</button></th>`).join('')
  const filtros = FILTRO_ABERTO
    ? `<tr>${COLUNAS_ACOES.map(c => `<th><input type="text" value="${esc(FILTROS_ACOES[c.id] || '')}"
        placeholder="filtrar" oninput="filtrarAcoes('${c.id}',this.value)"/></th>`).join('')}<th></th></tr>`
    : ''

  const linhas = lista.map(a => {
    const total = totalGut(a)
    return `<tr>
      <td class="hi txt-quebra" title="${esc(a.o_que)}">${esc(a.o_que)}</td>
      <td>${esc(a.quem || '—')}</td>
      <td>${esc(fmtData(a.quando))}</td>
      <td>${esc(a.modulo || '—')}</td>
      <td class="num">${total == null ? '<span class="pilula pilula-neutro">Não avaliado</span>' : pilula(String(total), tomGut(total))}</td>
      <td>${pilula(rotuloDaEtapa(FLUXO_ACAO, a.status).split(' — ')[0], tomDaEtapa(FLUXO_ACAO, a.status))}</td>
      <td>${botoesDaAcao(a)}</td>
    </tr>`
  }).join('')

  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr>${cabecalho}<th><button class="btn btn-s btn-sm" onclick="alternarFiltroAcoes()"
      aria-label="Filtrar a lista">Filtrar</button></th></tr>${filtros}</thead>
    <tbody>${linhas}</tbody></table></div>`
}

function tomGut(total) {
  const faixa = classificarGut(total)
  return faixa === 'critico' ? 'erro' : faixa === 'atencao' ? 'warn' : faixa === 'ok' ? 'ok' : 'neutro'
}

function botoesDaAcao(acao) {
  if (!GES_OK || !podeEditarGestao()) return ''
  const avancos = proximosEstados(FLUXO_ACAO, acao.status)
    .filter(destino => destino !== 'cancelada')
    .map(destino => `<button class="btn btn-s btn-sm" onclick="mudarEstadoAcao(${acao.id},'${destino}')">${esc(rotuloDaEtapa(FLUXO_ACAO, destino).split(' — ')[0])}</button>`)
    .join(' ')
  const cancelar = ehTerminal(FLUXO_ACAO, acao.status)
    ? ''
    : `<button class="btn btn-d btn-sm" onclick="pedirCancelamento(${acao.id})">Cancelar ação</button>`
  return `<div class="section-row" style="margin-bottom:0">
    <button class="btn btn-s btn-sm" onclick="abrirAcao(${acao.id})">Editar</button>
    <button class="btn btn-s btn-sm" onclick="abrirIshikawaDa(${acao.id})">Ishikawa</button>
    ${avancos}${cancelar}</div>`
}

function cartaoAcao(acao) {
  const total = totalGut(acao)
  return `<div class="panel-card" style="margin-bottom:8px;padding:11px 13px">
    <div class="txt-quebra" style="font-weight:600">${esc(acao.o_que)}</div>
    <div class="help">${esc(acao.quem || 'Sem responsável')} · ${esc(fmtData(acao.quando))}</div>
    <div style="margin-top:6px">${total == null
      ? '<span class="pilula pilula-neutro">Não avaliado</span>'
      : pilula(`GUT ${total} · ${rotuloGut(total)}`, tomGut(total))}</div>
  </div>`
}

function htmlKanbanAcoes(lista) {
  return htmlKanban(agruparKanban(lista, COLUNAS_KANBAN), COLUNAS_KANBAN, {
    cartao: cartaoAcao,
    vazio: 'Nenhuma ação',
  })
}

function htmlGanttAcoes(lista) {
  const hoje = hojeIso()
  const itens = lista.map(a => ({
    id: a.id,
    rotulo: a.o_que,
    inicio: apenasData(a.criado_em) || hoje,
    // Ação sem `quando` é item em aberto: a barra vai até hoje e leva o
    // rótulo "em aberto" que shared/gantt.js já desenha.
    fim: apenasData(a.quando) || null,
    tom: tomDaEtapa(FLUXO_ACAO, a.status),
  }))
  const datas = itens.flatMap(i => [i.inicio, i.fim]).filter(Boolean).sort()
  const inicio = datas[0] || hoje
  const fim = datas[datas.length - 1] || hoje
  return `<div class="panel-card">${htmlGantt(itens, { inicio, fim: fim < hoje ? hoje : fim, hoje })}</div>`
}

function vazioDasAcoes() {
  if (!GES_OK) return vazio('Migração 60 não aplicada', 'As tabelas ges_* ainda não existem neste banco')
  if (Object.values(FILTROS_ACOES).some(v => v)) return vazio('Nenhuma ação com esse filtro', 'Limpe os campos de filtro para ver a lista inteira')
  return vazio('Nenhuma ação registrada', 'Clique em + Nova ação para abrir o primeiro 5W2H')
}

function htmlAcoes() {
  const lista = GES_OK ? acoesNaTela() : []
  if (!lista.length) return vazioDasAcoes()
  if (ACOES_VISTA === 'kanban') return htmlKanbanAcoes(lista)
  if (ACOES_VISTA === 'gantt') return htmlGanttAcoes(lista)
  return htmlListaAcoes(lista)
}

function renderAcoes() {
  // Os ícones vêm do conjunto comum pelo NOME, nunca de emoji: o traço
  // herda a cor do texto e responde ao tema, que é a razão de shared/
  // icones.js existir.
  el('acoes-seletor').innerHTML = seletor([
    { id: 'lista', rotulo: 'Lista', icone: icone('plano', { tamanho: 14 }) },
    { id: 'kanban', rotulo: 'Kanban', icone: icone('corte', { tamanho: 14 }) },
    { id: 'gantt', rotulo: 'Gantt', icone: icone('prazo', { tamanho: 14 }) },
  ], ACOES_VISTA, 'trocarVistaAcoes')

  el('acoes-acoes').innerHTML = (GES_OK && podeEditarGestao())
    ? '<button class="btn btn-p btn-sm" onclick="abrirAcao()">+ Nova ação</button>'
    : ''

  const lista = GES_OK ? acoesNaTela() : []
  const kanban = el('acoes-kanban')
  const listaEl = el('acoes-lista')
  const gantt = el('acoes-gantt')
  listaEl.innerHTML = ''; kanban.innerHTML = ''; gantt.innerHTML = ''
  kanban.classList.add('hidden')

  if (!lista.length) { listaEl.innerHTML = vazioDasAcoes(); return }
  if (ACOES_VISTA === 'kanban') { kanban.innerHTML = htmlKanbanAcoes(lista); kanban.classList.remove('hidden'); return }
  if (ACOES_VISTA === 'gantt') { gantt.innerHTML = htmlGanttAcoes(lista); return }
  listaEl.innerHTML = htmlListaAcoes(lista)
}

function trocarVistaAcoes(vista) { ACOES_VISTA = vista; renderAcoes() }
function alternarFiltroAcoes() { FILTRO_ABERTO = !FILTRO_ABERTO; renderAcoes() }
function filtrarAcoes(coluna, valor) {
  FILTROS_ACOES[coluna] = valor
  // Só o corpo é redesenhado quando o filtro muda? Não: a tabela inteira é
  // pequena e o foco é devolvido logo abaixo, o que resolve o mesmo problema
  // que /maquinas resolveu partindo o render em dois.
  renderAcoes()
  const campo = document.querySelector(`#acoes-lista input[oninput*="'${coluna}'"]`)
  if (campo) { campo.focus(); campo.setSelectionRange(campo.value.length, campo.value.length) }
}
function ordenarAcoes(coluna) {
  const dir = ORD_ACOES.coluna === coluna ? proximaOrdem(ORD_ACOES.dir) : 'asc'
  ORD_ACOES = { coluna: dir ? coluna : null, dir }
  renderAcoes()
}

// ── formulário 5W2H ────────────────────────────────────────────────────
function opcoesGut(atual) {
  // Vazio é "Não avaliado", nunca zero: nulo e zero são coisas diferentes
  // (D-500-02), e o próprio banco aceita nulo nas três dimensões.
  return `<option value="">Não avaliado</option>` + GUT_ESCALA
    .map(v => `<option value="${v}"${String(atual) === String(v) ? ' selected' : ''}>${v}</option>`).join('')
}

function abrirAcao(id) {
  if (!GES_OK || !podeEditarGestao()) return
  ACAO_EDICAO = id ? ACOES.find(a => a.id === id) || null : null
  const a = ACAO_EDICAO || {}
  el('modal-acao-titulo').textContent = ACAO_EDICAO ? 'Editar ação' : 'Nova ação'
  el('modal-acao-corpo').innerHTML = `
    <div class="frow"><label for="acao-o-que">O quê (obrigatório)</label>
      <input id="acao-o-que" type="text" value="${esc(a.o_que || '')}" placeholder="A ação a executar"/></div>
    <div class="frow"><label for="acao-por-que">Por quê</label>
      <textarea id="acao-por-que" placeholder="A razão da ação">${esc(a.por_que || '')}</textarea></div>
    <div class="fgrid">
      <div class="frow"><label for="acao-onde">Onde</label>
        <input id="acao-onde" type="text" value="${esc(a.onde || '')}"/></div>
      <div class="frow"><label for="acao-quem">Quem</label>
        <input id="acao-quem" type="text" value="${esc(a.quem || '')}"/></div>
    </div>
    <div class="fgrid">
      <div class="frow"><label for="acao-quando">Quando</label>
        <input id="acao-quando" type="date" value="${esc(apenasData(a.quando) || '')}"/></div>
      <div class="frow"><label for="acao-quanto">Quanto (R$)</label>
        <input id="acao-quanto" type="text" inputmode="decimal" value="${a.quanto == null ? '' : esc(String(a.quanto).replace('.', ','))}"/>
        <div class="help">Em branco grava nulo — a ficha omite a linha em vez de mostrar zero.</div></div>
    </div>
    <div class="frow"><label for="acao-como">Como</label>
      <textarea id="acao-como" placeholder="O método">${esc(a.como || '')}</textarea></div>
    <div class="fgrid">
      <div class="frow"><label for="acao-modulo">Módulo</label>
        <select id="acao-modulo"><option value="">—</option>${MODULOS_ORIGEM
          .map(m => `<option value="${m}"${a.modulo === m ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="frow"><label for="acao-ativo">Ativo de referência</label>
        <input id="acao-ativo" type="text" value="${esc(a.ativo_ref || '')}" placeholder="Código do ativo"/></div>
    </div>
    <div class="fgrid3">
      <div class="frow"><label for="acao-g">Gravidade</label><select id="acao-g">${opcoesGut(a.g)}</select></div>
      <div class="frow"><label for="acao-u">Urgência</label><select id="acao-u">${opcoesGut(a.u)}</select></div>
      <div class="frow"><label for="acao-t">Tendência</label><select id="acao-t">${opcoesGut(a.t)}</select></div>
    </div>
    <div class="help">Prioridade GUT: G × U × T. Deixar qualquer uma em branco mantém a ação
      como "Não avaliado" — nunca prioridade zero.</div>
    <div class="frow" style="margin-top:14px"><label for="acao-status">Situação</label>
      <select id="acao-status">${ESTADOS_ACAO.map(s => `<option value="${s}"${(a.status || 'planejada') === s ? ' selected' : ''}>${esc(rotuloDaEtapa(FLUXO_ACAO, s))}</option>`).join('')}</select></div>
    <div id="acao-erro" class="help"></div>`
  abrirModal('modal-acao')
}

/** Campo em branco grava NULO, nunca string vazia nem zero: é a diferença
 *  entre "não informado" e "informado como nada". */
function textoOuNulo(id) {
  const v = (el(id)?.value || '').trim()
  return v === '' ? null : v
}

function numeroOuNulo(id) {
  const v = (el(id)?.value || '').trim()
  if (v === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function inteiroOuNulo(id) {
  const v = (el(id)?.value || '').trim()
  if (v === '') return null
  const n = Number(v)
  return GUT_ESCALA.includes(n) ? n : null
}

async function salvarAcao() {
  const oQue = textoOuNulo('acao-o-que')
  if (!oQue) { el('acao-erro').textContent = 'O campo "O quê" é obrigatório.'; return }

  const carga = {
    o_que: oQue,
    por_que: textoOuNulo('acao-por-que'),
    onde: textoOuNulo('acao-onde'),
    quando: textoOuNulo('acao-quando'),
    quem: textoOuNulo('acao-quem'),
    como: textoOuNulo('acao-como'),
    quanto: numeroOuNulo('acao-quanto'),
    g: inteiroOuNulo('acao-g'),
    u: inteiroOuNulo('acao-u'),
    t: inteiroOuNulo('acao-t'),
    modulo: textoOuNulo('acao-modulo'),
    ativo_ref: textoOuNulo('acao-ativo'),
    status: el('acao-status').value,
    atualizado_em: new Date().toISOString(),
  }
  // `gut_total` NUNCA entra na carga: é coluna gerada pela migração 60, e
  // gravá-la faria a prioridade mostrada divergir da prioridade guardada.

  const { error } = ACAO_EDICAO
    ? await supa.from('ges_acoes').update(carga).eq('id', ACAO_EDICAO.id)
    : await supa.from('ges_acoes').insert({ ...carga, criado_por: USUARIO?.nome || USUARIO?.role || null })

  // O modal permanece aberto com o que foi digitado: fechar apagaria o
  // texto que a pessoa acabou de escrever, e a falha quase sempre é de rede.
  if (error) { erroDe(error, 'não foi possível gravar a ação'); return }
  fecharModal()
  await recarregar()
}

async function mudarEstadoAcao(id, destino) {
  const { error } = await supa.from('ges_acoes')
    .update({ status: destino, atualizado_em: new Date().toISOString() }).eq('id', id)
  if (error) { erroDe(error, 'não foi possível mudar a situação'); return }
  await recarregar()
}

// Confirmação NOMINAL, com o texto do contrato — nunca a caixa genérica do
// navegador, que não diz o que vai acontecer.
function pedirCancelamento(id) {
  pedirConfirmacao(
    'Cancelar ação',
    'Cancelar ação: esta ação sai do fluxo ativo e não pode ser reaberta. Confirma?',
    () => mudarEstadoAcao(id, 'cancelada'))
}

// ── Calendário ─────────────────────────────────────────────────────────
function htmlCalendarioMes() {
  const hoje = new Date()
  const diaDeHoje = (hoje.getFullYear() === CAL_ANO && hoje.getMonth() === CAL_MES) ? hoje.getDate() : undefined
  return htmlCalendario(CAL_ANO, CAL_MES, EVENTOS_CALENDARIO, {
    hoje: diaDeHoje,
    rotuloEvento: e => e.origem,
    classeEvento: e => e.classe || '',
  })
}

function renderCalendario() {
  el('calendario-titulo').textContent = `${MESES[CAL_MES]} de ${CAL_ANO}`
  el('calendario-consolidado').innerHTML = htmlCalendarioMes()
  const omitidas = [...new Set(FONTES_OMITIDAS)]
  el('calendario-fontes').innerHTML = omitidas.length
    ? `Fontes não lidas neste banco: <strong>${esc(omitidas.join(', '))}</strong> — as demais foram desenhadas normalmente.`
    : 'Todas as fontes foram lidas: Máquinas, Corte, Refrigeração, Transportes, Predial e Calibração. Refrigeração entra só em leitura.'
}

function navegarMes(passo) {
  const data = new Date(CAL_ANO, CAL_MES + passo, 1)
  CAL_ANO = data.getFullYear(); CAL_MES = data.getMonth()
  renderCalendario()
}

function irParaMesAtual() {
  const hoje = new Date()
  CAL_ANO = hoje.getFullYear(); CAL_MES = hoje.getMonth()
  renderCalendario()
}

// ── Ferramentas ────────────────────────────────────────────────────────
const FERRAMENTAS = [
  { id: 'pareto', rotulo: 'Pareto' },
  { id: 'controle', rotulo: 'Carta de controle' },
  { id: 'abc', rotulo: 'Curva ABC' },
  { id: 'ishikawa', rotulo: 'Ishikawa' },
  { id: 'pdca', rotulo: 'PDCA' },
  { id: '5s', rotulo: '5S' },
]

function htmlPareto() {
  const porOrigem = {}
  for (const e of EVENTOS_CALENDARIO) porOrigem[e.origem] = (porOrigem[e.origem] || 0) + 1
  const serie = Object.entries(porOrigem)
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor)
  return `<h3>Pareto — de onde vem o serviço</h3>
    ${serie.length ? pareto(serie) : vazio('Sem serviço registrado', 'Nenhum módulo devolveu ordem, operação ou vencimento')}
    <div class="help">Barras: quantidade de registros por módulo. Linha: acumulado —
      poucas origens costumam concentrar a maior parte do trabalho.</div>`
}

function htmlCartaControle() {
  const meses = ultimosMeses(12)
  const contagem = meses.map(mes => ({
    rotulo: mes.slice(5),
    valor: EVENTOS_CALENDARIO.filter(e => e.data.startsWith(mes)).length,
  }))
  return `<h3>Carta de controle — registros por mês</h3>
    ${cartaControle(contagem)}
    <div class="help">Carta de indivíduos (X-mR): a média e os limites saem da amplitude entre meses
      consecutivos. Com menos de dois meses não existe amplitude nenhuma, e os limites não são desenhados.</div>`
}

function htmlAbc() {
  // Custo por ativo de Máquinas: é onde a plataforma guarda peças e mão de
  // obra na mesma linha. Sem OS com custo, a curva não existe.
  const itens = METRICAS.custoPorAtivo || []
  if (!itens.length) {
    return `<h3>Curva ABC — custo de manutenção por ativo</h3>
      ${vazio('Nenhum item para classificar', 'Cadastre itens com valor para gerar a curva')}`
  }
  const { linhas, total } = classificarAbc(itens, 'valor')
  const corpo = linhas.map(l => `<div class="abc-linha abc-classe-${l.classe.toLowerCase()}">
      ${pilula(`Classe ${l.classe}`, l.classe === 'A' ? 'warn' : l.classe === 'B' ? 'info' : 'neutro')}
      <span class="txt-quebra">Ativo ${esc(l.item.ativo)}</span>
      <span class="abc-barra" style="width:${l.acumulado.toFixed(1)}%"></span>
      <span class="mono">${esc(fmtNumero(l.valor, 2))}</span>
    </div>`).join('')
  return `<h3>Curva ABC — custo de manutenção por ativo</h3>
    <div class="abc">${corpo}</div>
    <div class="help">Total classificado: ${esc(fmtNumero(total, 2))}. Classe A concentra os primeiros
      80% do valor acumulado; a classe não é alerta, é onde a gestão rende mais.</div>`
}

function htmlIshikawa() {
  if (!GES_OK) {
    return `<h3>Ishikawa — espinha das causas</h3>
      ${vazio('Migração 60 não aplicada', 'As tabelas ges_* ainda não existem neste banco')}`
  }
  const acao = ACOES.find(a => a.id === ACAO_DA_CAUSA) || ACOES[0] || null
  if (!acao) {
    return `<h3>Ishikawa — espinha das causas</h3>
      ${vazio('Nenhuma ação registrada', 'Clique em + Nova ação para abrir o primeiro 5W2H')}`
  }
  const daAcao = CAUSAS.filter(c => c.acao_id === acao.id)
  const cartao = cat => {
    const minhas = daAcao.filter(c => c.categoria === cat.id)
    const corpo = minhas.length
      ? minhas.map(c => `<div class="ishikawa-causa">${esc(c.causa)}</div>`).join('')
      : '<div class="ishikawa-vazia">Sem causa registrada</div>'
    return `<div class="ishikawa-cat"><h4>${esc(cat.rotulo)}</h4>${corpo}</div>`
  }
  const acrescentar = (GES_OK && podeEditarGestao())
    ? `<button class="btn btn-p btn-sm" onclick="abrirCausa(${acao.id})">+ Nova causa</button>`
    : ''
  const escolha = ACOES.length > 1
    ? `<select onchange="escolherAcaoIshikawa(this.value)" style="max-width:min(420px,100%)">${ACOES
        .map(a => `<option value="${a.id}"${a.id === acao.id ? ' selected' : ''}>${esc(a.o_que)}</option>`).join('')}</select>`
    : ''
  return `<h3>Ishikawa — espinha das causas</h3>
    <div class="section-row">${escolha}${acrescentar}</div>
    <div class="ishikawa">
      <div class="ishikawa-grade">${CATEGORIAS_6M.slice(0, 3).map(cartao).join('')}</div>
      <div class="ishikawa-espinha" role="presentation"></div>
      <div class="ishikawa-grade">${CATEGORIAS_6M.slice(3).map(cartao).join('')}</div>
    </div>
    <div class="help txt-quebra">Efeito: <strong>${esc(acao.o_que)}</strong>. Categoria sem causa
      registrada aparece vazia, nunca some da espinha — o 6M vale inteiro.</div>`
}

function htmlPdca() {
  if (!GES_OK) {
    return `<h3>PDCA — as ações no ciclo</h3>
      ${vazio('Migração 60 não aplicada', 'As tabelas ges_* ainda não existem neste banco')}`
  }
  if (!ACOES.length) {
    return `<h3>PDCA — as ações no ciclo</h3>
      ${vazio('Nenhuma ação registrada', 'Clique em + Nova ação para abrir o primeiro 5W2H')}`
  }
  const linhas = PDCA.map(f => {
    const quantas = ACOES.filter(a => f.estados.includes(a.status)).length
    return `<div class="abc-linha"><span class="pilula pilula-info">${esc(f.fase)}</span>
      <span class="mono">${quantas}</span> ação(ões)</div>`
  }).join('')
  const canceladas = ACOES.filter(a => a.status === 'cancelada').length
  return `<h3>PDCA — as ações no ciclo</h3>
    ${regua(FLUXO_ACAO.etapas, 1)}
    <div class="abc">${linhas}</div>
    <div class="help">O PDCA é o MESMO fluxo da aba Ações lido por outro nome — não uma segunda
      lista de estados. ${canceladas} ação(ões) cancelada(s) ficam fora do ciclo.</div>`
}

function html5s() {
  return `<h3>5S — checklist dos cinco sensos</h3>
    ${vazio('Nenhum checklist cadastrado', 'O roteiro dos cinco sensos entra como POP: cadastre-o na aba POP e vincule ao setor')}
    <div class="help">O 5S não ganhou tabela própria de propósito: um checklist de sensos é um
      procedimento operacional padrão, e duas tabelas para o mesmo fato divergiriam na primeira revisão.</div>`
}

function htmlDaFerramenta(id) {
  if (id === 'controle') return htmlCartaControle()
  if (id === 'abc') return htmlAbc()
  if (id === 'ishikawa') return htmlIshikawa()
  if (id === 'pdca') return htmlPdca()
  if (id === '5s') return html5s()
  return htmlPareto()
}

function htmlFerramentas() {
  return FERRAMENTAS.map(f => htmlDaFerramenta(f.id)).join('')
}

function renderFerramentas() {
  el('ferramentas-seletor').innerHTML = chips(FERRAMENTAS, FERRAMENTA, 'trocarFerramenta')
  for (const f of FERRAMENTAS) {
    const alvo = el(`ferramentas-${f.id}`)
    alvo.innerHTML = htmlDaFerramenta(f.id)
    alvo.classList.toggle('hidden', f.id !== FERRAMENTA)
  }
}

function trocarFerramenta(id) { FERRAMENTA = id; renderFerramentas() }
function escolherAcaoIshikawa(id) { ACAO_DA_CAUSA = Number(id); renderFerramentas() }

function abrirIshikawaDa(id) {
  ACAO_DA_CAUSA = id
  FERRAMENTA = 'ishikawa'
  trocarView('ferramentas', document.querySelector('.nav-btn[data-view="ferramentas"]'))
  renderFerramentas()
}

function abrirCausa(acaoId) {
  if (!GES_OK || !podeEditarGestao()) return
  ACAO_DA_CAUSA = acaoId
  el('modal-causa-corpo').innerHTML = `
    <div class="frow"><label for="causa-categoria">Categoria (6M)</label>
      <select id="causa-categoria">${CATEGORIAS_6M.map(c => `<option value="${c.id}">${esc(c.rotulo)}</option>`).join('')}</select></div>
    <div class="frow"><label for="causa-texto">Causa</label>
      <textarea id="causa-texto" placeholder="A causa provável"></textarea></div>
    <div id="causa-erro" class="help"></div>`
  abrirModal('modal-causa')
}

async function salvarCausa() {
  const causa = textoOuNulo('causa-texto')
  if (!causa) { el('causa-erro').textContent = 'Escreva a causa.'; return }
  const { error } = await supa.from('ges_causas')
    .insert({ acao_id: ACAO_DA_CAUSA, categoria: el('causa-categoria').value, causa })
  if (error) { erroDe(error, 'não foi possível gravar a causa'); return }
  fecharModal()
  await recarregar()
}

// ── POP ────────────────────────────────────────────────────────────────
function vinculoDoPop(pop) {
  const partes = [pop.ativo_ref, pop.plano_ref].filter(Boolean)
  return partes.length ? partes.join(' · ') : '—'
}

function htmlPop() {
  if (!GES_OK) return vazio('Migração 60 não aplicada', 'As tabelas ges_* ainda não existem neste banco')
  if (!POPS.length) return vazio('Nenhum POP cadastrado', 'Vincule um POP a um ativo ou a um plano de manutenção')

  const linhas = POPS.map(p => `<tr>
    <td class="hi txt-quebra" title="${esc(p.titulo)}">${esc(p.titulo)}</td>
    <td>${esc(p.modulo || '—')}</td>
    <td>${esc(vinculoDoPop(p))}</td>
    <td>${esc(fmtData(p.criado_em))}</td>
    <td>${(GES_OK && podeEditarGestao()) ? `<div class="section-row" style="margin-bottom:0">
      <button class="btn btn-s btn-sm" onclick="abrirPop(${p.id})">Editar</button>
      <button class="btn btn-d btn-sm" onclick="pedirArquivamento(${p.id})">Arquivar POP</button></div>` : ''}</td>
  </tr>`).join('')

  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Título</th><th>Módulo</th><th>Vínculo</th><th>Criado em</th><th></th></tr></thead>
    <tbody>${linhas}</tbody></table></div>`
}

function renderPop() {
  el('pop-acoes').innerHTML = (GES_OK && podeEditarGestao())
    ? '<button class="btn btn-p btn-sm" onclick="abrirPop()">+ Novo POP</button>'
    : ''
  el('pop-lista').innerHTML = htmlPop()
}

function abrirPop(id) {
  if (!GES_OK || !podeEditarGestao()) return
  POP_EDICAO = id ? POPS.find(p => p.id === id) || null : null
  const p = POP_EDICAO || {}
  el('modal-pop-titulo').textContent = POP_EDICAO ? 'Editar POP' : 'Novo POP'
  el('modal-pop-corpo').innerHTML = `
    <div class="frow"><label for="pop-titulo">Título (obrigatório)</label>
      <input id="pop-titulo" type="text" value="${esc(p.titulo || '')}"/></div>
    <div class="frow"><label for="pop-texto">Procedimento</label>
      <textarea id="pop-texto" style="min-height:200px" placeholder="Passo a passo">${esc(p.texto || '')}</textarea></div>
    <div class="fgrid">
      <div class="frow"><label for="pop-modulo">Módulo</label>
        <select id="pop-modulo"><option value="">—</option>${MODULOS_ORIGEM
          .map(m => `<option value="${m}"${p.modulo === m ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="frow"><label for="pop-ativo">Ativo de referência</label>
        <input id="pop-ativo" type="text" value="${esc(p.ativo_ref || '')}"/></div>
    </div>
    <div class="frow"><label for="pop-plano">Plano de referência</label>
      <input id="pop-plano" type="text" value="${esc(p.plano_ref || '')}"/>
      <div class="help">Os dois vínculos são opcionais e independentes: um POP sem ativo nem plano
        é legítimo, e a lista mostra travessão no lugar do vínculo.</div></div>
    <div id="pop-erro" class="help"></div>`
  abrirModal('modal-pop')
}

async function salvarPop() {
  const titulo = textoOuNulo('pop-titulo')
  if (!titulo) { el('pop-erro').textContent = 'O título é obrigatório.'; return }
  const carga = {
    titulo,
    texto: textoOuNulo('pop-texto'),
    modulo: textoOuNulo('pop-modulo'),
    ativo_ref: textoOuNulo('pop-ativo'),
    plano_ref: textoOuNulo('pop-plano'),
  }
  const { error } = POP_EDICAO
    ? await supa.from('ges_pop').update(carga).eq('id', POP_EDICAO.id)
    : await supa.from('ges_pop').insert({ ...carga, criado_por: USUARIO?.nome || USUARIO?.role || null })
  if (error) { erroDe(error, 'não foi possível gravar o POP'); return }
  fecharModal()
  await recarregar()
}

// O projeto ARQUIVA, nunca exclui: `ativo = false` e a linha continua no
// banco. Não existe "excluir POP" em lugar nenhum deste módulo.
function pedirArquivamento(id) {
  pedirConfirmacao(
    'Arquivar POP',
    'Arquivar POP: o procedimento sai da lista ativa e fica disponível no histórico. Confirma?',
    async () => {
      const { error } = await supa.from('ges_pop').update({ ativo: false }).eq('id', id)
      if (error) { erroDe(error, 'não foi possível arquivar o POP'); return }
      await recarregar()
    })
}

// ── modais ─────────────────────────────────────────────────────────────
function abrirModal(id) {
  for (const modal of document.querySelectorAll('.overlay .modal')) modal.classList.add('hidden')
  el(id).classList.remove('hidden')
  el('overlay').classList.add('open')
}

function fecharModal() {
  el('overlay').classList.remove('open')
  CONFIRMACAO = null
}

function pedirConfirmacao(titulo, texto, acao) {
  CONFIRMACAO = acao
  el('modal-confirmacao-titulo').textContent = titulo
  el('modal-confirmacao-corpo').innerHTML = `<p class="txt-quebra">${esc(texto)}</p>`
  abrirModal('modal-confirmacao')
}

async function executarConfirmacao() {
  const acao = CONFIRMACAO
  fecharModal()
  if (acao) await acao()
}

// ── navegação e boot ───────────────────────────────────────────────────
function trocarView(id, botao) {
  for (const v of document.querySelectorAll('.view')) v.classList.remove('active')
  el(`view-${id}`)?.classList.add('active')
  for (const b of document.querySelectorAll('.nav-btn')) b.classList.remove('active')
  botao?.classList.add('active')
}

function renderTudo() {
  renderPainel(); renderAcoes(); renderCalendario(); renderFerramentas(); renderPop()
}

async function recarregar() {
  try {
    await carregarTudo()
  } catch (erro) {
    erroDe(erro, 'não foi possível recarregar os dados')
    return
  }
  renderTudo()
}

function mostrarApp() {
  el('login-screen').style.display = 'none'
  // `block`, nunca `flex`: o padrão do flex é `row`, e o shell inteiro
  // (barra, abas, miolo, rodapé) sairia lado a lado — foi o que aconteceu
  // em /equipes. Os outros módulos abrem com `block`.
  el('app').style.display = 'block'
  const cargo = USUARIO?.role || '—'
  el('user-chip').textContent = podeEditarGestao() ? cargo : `${cargo} · somente leitura`
  renderTudo()
}

function mostrarLogin() {
  el('login-screen').style.display = 'flex'
  el('app').style.display = 'none'
}

async function sair() {
  await supa.auth.signOut()
  location.reload()
}

// Manipulador em atributo (onclick) resolve pelo escopo GLOBAL, e um
// módulo ES tem escopo próprio: sem esta exposição nenhum botão da tela
// acharia função nenhuma. Mesmo que mapa/app.js e equipes/app.js fazem.
function exporNoWindow() {
  Object.assign(window, {
    trocarView, sair, fecharModal, executarConfirmacao,
    trocarVistaAcoes, alternarFiltroAcoes, filtrarAcoes, ordenarAcoes,
    abrirAcao, salvarAcao, mudarEstadoAcao, pedirCancelamento,
    navegarMes, irParaMesAtual,
    trocarFerramenta, escolherAcaoIshikawa, abrirIshikawaDa, abrirCausa, salvarCausa,
    abrirPop, salvarPop, pedirArquivamento,
  })
}

async function boot() {
  exporNoWindow()

  aplicarShell({
    nome: 'Gestão',
    versao: '1.0',
    navItems: [
      { id: 'painel', label: 'Painel', icone: 'painel', ativo: true },
      { id: 'acoes', label: 'Ações', icone: 'checklist' },
      { id: 'calendario', label: 'Calendário', icone: 'agenda' },
      { id: 'ferramentas', label: 'Ferramentas', icone: 'chave' },
      { id: 'pop', label: 'POP', icone: 'relatorio' },
    ],
  })

  try {
    supa = await criarClienteSupabase()
  } catch (erro) {
    // Na tela de LOGIN, nunca no #app: o #app nasce `display:none` e só
    // aparece em mostrarApp(), que nunca roda quando a carga falha —
    // escrever ali deixaria o módulo em branco, sem uma palavra.
    el('login-screen').innerHTML = `
      <div class="callout co-red" style="max-width:min(560px,92vw);margin:40px auto">
        <strong>Falha ao iniciar o módulo Gestão.</strong><br>${esc(erro.message)}
      </div>`
    el('login-screen').style.display = 'flex'
    return
  }

  auth = new Auth(supa, { appNome: 'Gestão', appIcone: '📈' })
  auth.onLogin(async usuario => {
    USUARIO = usuario
    try {
      await carregarTudo()
    } catch (erro) {
      el('login-screen').innerHTML = `
        <div class="callout co-red" style="max-width:min(560px,92vw);margin:40px auto">
          <strong>Não foi possível carregar os dados de gestão.</strong><br>${esc(erro.message || '')}
        </div>`
      el('login-screen').style.display = 'flex'
      return
    }
    mostrarApp()
  })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}

// Fora do navegador (o gate roda em Node) não há tela para montar: o
// arquivo é só importado, e nada dispara.
if (typeof document !== 'undefined') boot()

// ── porta de teste ─────────────────────────────────────────────────────
// O gate precisa injetar um cliente falso e ler o HTML que cada aba
// desenharia, sem navegador. Nada aqui é consumido pela tela.
export const __teste = {
  definirSupa: cliente => { supa = cliente },
  definirUsuario: usuario => { USUARIO = usuario },
  estado: () => ({ GES_OK, ACOES, INDICADORES, POPS, CAUSAS, EVENTOS_CALENDARIO, FONTES_OMITIDAS, METRICAS }),
  sondarGestao, carregarTudo, podeEditarGestao,
  htmlPainel, htmlAcoes, htmlCalendarioMes, htmlFerramentas, htmlPop,
  FLUXO_ACAO, ESTADOS_ACAO, COLUNAS_ACOES, CATEGORIAS_6M, INDICADORES_PLATAFORMA,
}
