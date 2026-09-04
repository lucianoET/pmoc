// ══════════════════════════════════════════════════════════════════
// shared/calendario.js — núcleo puro de grade de calendário mensal,
// extraído de maquinas/app.js#renderAgenda e
// maquinas/operacoes.js#criarEventosCalendario (Fase 13 Plano 03,
// PLAT-09, D-07).
//
// (1) Por que existe: a montagem da grade (dias vazios antes do dia 1,
// texto do cabeçalho de dias da semana, agrupamento de eventos por data)
// vivia inline dentro de `renderAgenda`, misturada com `document`. Este
// núcleo sobe essa lógica para cá, genérica por ano/mês/lista de eventos,
// para que Máquinas e o calendário consolidado de /gestao (Onda B,
// GEQ-09) consumam a mesma implementação em vez de duas cópias.
//
// (2) Funções PURAS. Nenhuma API de navegador — mesmo corte núcleo-puro/
// aplicador-de-DOM de shared/tema.js e shared/kanban.js. `htmlCalendario`
// devolve texto; quem injeta no DOM é o módulo consumidor.
//
// (3) Regra central: uma data que não bate com AAAA-MM-DD nunca lança —
// é descartada. Um mês/ano fora de faixa devolve grade vazia em vez de
// tentar montar uma grade sem sentido (T-13-12).
// ══════════════════════════════════════════════════════════════════

function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[c])
}

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const RE_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

function anoMesValidos(ano, mes) {
  return Number.isInteger(ano) && Number.isInteger(mes) && mes >= 0 && mes <= 11
}

/**
 * Grade de um mês (`mes` base zero, como o resto do código de Máquinas já
 * usa). Ano/mês fora de faixa devolve grade vazia em vez de laço sem fim.
 *
 * @param {number} ano
 * @param {number} mes  0..11
 * @returns {{primeiroDiaSemana:number, totalDias:number, dias:Array<{dia:number, data:string}>}}
 */
export function gradeMes(ano, mes) {
  if (!anoMesValidos(ano, mes)) return { primeiroDiaSemana: 0, totalDias: 0, dias: [] }

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const dias = []
  for (let dia = 1; dia <= totalDias; dia++) {
    const data = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    dias.push({ dia, data })
  }
  return { primeiroDiaSemana, totalDias, dias }
}

/**
 * Agrupa eventos por `evento.data` (AAAA-MM-DD). Evento com data nula,
 * vazia ou fora do formato ISO é descartado, nunca lança.
 *
 * @param {Array<{data:string}>} eventos
 */
export function agruparPorData(eventos) {
  const grupos = {}
  for (const evento of (eventos || [])) {
    const data = evento?.data
    if (typeof data !== 'string' || !RE_DATA_ISO.test(data)) continue
    ;(grupos[data] ||= []).push(evento)
  }
  return grupos
}

/**
 * Filtra `eventos` para o mês/ano recebidos (mesmo formato de data de
 * `agruparPorData`) e ordena por data crescente.
 *
 * @param {Array<{data:string}>} eventos
 * @param {number} ano
 * @param {number} mes  0..11
 */
export function eventosDoMes(eventos, ano, mes) {
  if (!anoMesValidos(ano, mes)) return []
  const prefixo = `${ano}-${String(mes + 1).padStart(2, '0')}`
  return (eventos || [])
    .filter((evento) => typeof evento?.data === 'string' && evento.data.startsWith(prefixo))
    .sort((a, b) => a.data.localeCompare(b.data))
}

/**
 * Devolve o texto do cabeçalho de dias da semana mais as células do mês.
 * `opcoes.hoje` marca a célula desse dia com a classe `hoje` (nenhuma
 * quando o dia não pertence ao mês). `opcoes.rotuloEvento(evento)` monta
 * o prefixo do evento (padrão: `evento.origem`); evento sem `titulo`
 * recebe esse mesmo rótulo em vez de string vazia. `opcoes.classeEvento
 * (evento)` monta a classe CSS extra do evento (padrão: `evento.origem`).
 *
 * @param {number} ano
 * @param {number} mes
 * @param {Array<{data:string, origem?:string, titulo?:string}>} eventos
 * @param {{hoje?:number, rotuloEvento?:(e:object)=>string, classeEvento?:(e:object)=>string}} [opcoes]
 */
export function htmlCalendario(ano, mes, eventos, opcoes = {}) {
  const hoje = opcoes.hoje
  const rotuloEvento = typeof opcoes.rotuloEvento === 'function'
    ? opcoes.rotuloEvento
    : (evento) => evento?.origem || ''
  const classeEvento = typeof opcoes.classeEvento === 'function'
    ? opcoes.classeEvento
    : (evento) => evento?.origem || ''

  const grade = gradeMes(ano, mes)
  const porData = agruparPorData(eventosDoMes(eventos, ano, mes))

  const cabecalho = DIAS_SEMANA.map((dia) => `<div class="calendar-weekday">${dia}</div>`).join('')
  const vazias = '<div class="calendar-day is-empty"></div>'.repeat(grade.primeiroDiaSemana)
  const dias = grade.dias.map(({ dia, data }) => {
    const eventosDia = porData[data] || []
    const classeHoje = hoje === dia ? ' hoje' : ''
    const corpo = eventosDia.map((evento) => {
      const rotulo = rotuloEvento(evento)
      const titulo = evento.titulo || rotulo
      return `<div class="calendar-event ${esc(classeEvento(evento))}">${esc(rotulo)} · ${esc(titulo)}</div>`
    }).join('')
    return `<div class="calendar-day${classeHoje}"><div class="calendar-date">${dia}</div>${corpo}</div>`
  }).join('')

  return cabecalho + vazias + dias
}
