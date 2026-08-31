// Núcleo puro do módulo /equipes — sem API de navegador nenhuma.
//
// Mesmo corte que shared/tema.js e mapa/mapa-geometria.js já usam entre
// núcleo puro e aplicador de DOM: aqui ficam as regras (semana, duração
// de turno, capacidade, compatibilidade especialidade×domínio) e nada
// que dependa de `document`. É o que deixa o gate testar comportamento
// em Node em vez de passar regex por cima de marcação.

/** Domínios que a plataforma tem hoje — as chaves de módulo que uma
 *  especialidade pode declarar atender. Lista fechada de propósito: um
 *  domínio inventado não habilitaria ninguém para nada, e apareceria na
 *  tela como um ofício que não serve para coisa alguma. */
export const DOMINIOS = [
  { chave: 'refrigeracao', nome: 'Refrigeração' },
  { chave: 'eletrica',     nome: 'Elétrica' },
  { chave: 'maquinas',     nome: 'Máquinas' },
  { chave: 'transportes',  nome: 'Transportes' },
  { chave: 'fonoclama',    nome: 'Fonoclama' },
  { chave: 'predial',      nome: 'Predial' },
  { chave: 'calibracao',   nome: 'Calibração' },
]

const DOMINIO_NOME = Object.fromEntries(DOMINIOS.map(d => [d.chave, d.nome]))

export const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Chave ISO a partir da data LOCAL — nunca por toISOString().
 *  A conversão para UTC empurra para o dia anterior tudo que acontece
 *  antes das 21h no nosso fuso, e uma equipe alocada na segunda
 *  apareceria no domingo só para quem abrisse a tela de manhã. É o
 *  mesmo cuidado que o calendário de /refrigeracao já toma. */
export function chaveData(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return ''
  const m = d.getMonth() + 1
  const dia = d.getDate()
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${dia < 10 ? '0' : ''}${dia}`
}

/** Data local a partir da chave — ao meio-dia, porque meia-noite mais
 *  fuso negativo cai na véspera. */
export function dataDaChave(chave) {
  if (typeof chave !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(chave)) return null
  const d = new Date(`${chave}T12:00:00`)
  return isNaN(d.getTime()) ? null : d
}

/** Os sete dias da semana que contém `ref`, começando no domingo. */
export function semanaDe(ref) {
  const base = ref instanceof Date && !isNaN(ref.getTime()) ? ref : new Date()
  const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
    return { data: d, chave: chaveData(d), dow: d.getDay(), rotulo: DOW[d.getDay()], dia: d.getDate() }
  })
}

export function moverSemana(ref, deltaSemanas) {
  const base = ref instanceof Date && !isNaN(ref.getTime()) ? ref : new Date()
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaSemanas * 7)
}

/** Rótulo da semana. Quando ela atravessa mês ou ano, os dois lados são
 *  nomeados — "29 set – 5 out" diz mais que "setembro". */
export function rotuloSemana(dias) {
  if (!dias || !dias.length) return ''
  const a = dias[0].data
  const b = dias[dias.length - 1].data
  const mes = d => d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} ${mes(a)} ${a.getFullYear()} – ${b.getDate()} ${mes(b)} ${b.getFullYear()}`
  }
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${mes(a)} – ${b.getDate()} ${mes(b)} ${b.getFullYear()}`
  return `${a.getDate()} – ${b.getDate()} ${mes(b)} ${b.getFullYear()}`
}

/** Duração de um turno em horas, DERIVADA de hora_inicio/hora_fim.
 *  Nunca digitada: ninguém escreve "4h" por engano num turno de 08:00
 *  às 13:00. Devolve 0 para turno malformado em vez de NaN, porque um
 *  NaN se propaga pela soma da capacidade e some. */
export function horasDoTurno(turno) {
  if (!turno) return 0
  const ini = minutosDaHora(turno.hora_inicio)
  const fim = minutosDaHora(turno.hora_fim)
  if (ini === null || fim === null || fim <= ini) return 0
  return (fim - ini) / 60
}

export function minutosDaHora(hhmm) {
  if (typeof hhmm !== 'string') return null
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function formatarHora(hhmm) {
  const min = minutosDaHora(hhmm)
  if (min === null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`
}

/** Quantas pessoas ATIVAS a equipe tem. Pessoa inativa não entra na
 *  capacidade — está de licença, transferida ou desligada, e contá-la
 *  faria a oficina parecer maior do que é. */
export function tamanhoDaEquipe(equipeId, membros, pessoas) {
  const ativos = new Set((pessoas || []).filter(p => p.ativo !== false).map(p => p.id))
  return (membros || []).filter(m => m.equipe_id === equipeId && ativos.has(m.pessoa_id)).length
}

/** Capacidade em homem-hora, das ALOCAÇÕES REAIS — não de um número
 *  teórico de "equipes × turnos × dias úteis".
 *
 *  É a diferença que dá sentido ao calendário: alocar uma equipe num
 *  turno É declarar aquela capacidade. Um campo "dias úteis" ao lado
 *  seria uma segunda fonte de verdade para o mesmo fato, e as duas
 *  divergiriam no primeiro feriado ou na primeira escala de sábado.
 *
 *  Uma alocação de equipe VAZIA vale zero hora e é contada à parte: é
 *  quase sempre erro de cadastro (equipe sem membro), e somar zero em
 *  silêncio esconderia isso. */
export function capacidadeDaSemana(dias, alocacoes, turnos, membros, pessoas) {
  const chaves = new Set((dias || []).map(d => d.chave))
  const porId = Object.fromEntries((turnos || []).map(t => [t.id, t]))
  let horas = 0
  let alocadas = 0
  let vazias = 0
  const equipes = new Set()

  for (const a of alocacoes || []) {
    if (!chaves.has(a.data)) continue
    alocadas++
    const t = porId[a.turno_id]
    const n = tamanhoDaEquipe(a.equipe_id, membros, pessoas)
    if (n === 0) { vazias++; continue }
    equipes.add(a.equipe_id)
    horas += horasDoTurno(t) * n
  }
  return { horas, alocacoes: alocadas, alocacoesSemPessoal: vazias, equipes: equipes.size }
}

/** Índice alocações → { 'chave|turnoId': [alocação, …] }, que é como a
 *  grade lê. Só as da semana pedida. */
export function alocacoesPorCelula(dias, alocacoes) {
  const chaves = new Set((dias || []).map(d => d.chave))
  const mapa = {}
  for (const a of alocacoes || []) {
    if (!chaves.has(a.data)) continue
    const k = `${a.data}|${a.turno_id}`
    if (!mapa[k]) mapa[k] = []
    mapa[k].push(a)
  }
  return mapa
}

/** A regra que o usuário pediu em palavras: "elétrica por eletricistas,
 *  refrigeração por técnico em refrigeração".
 *
 *  Especialidade SEM domínio declarado não atende nada — devolve false,
 *  nunca true. O contrário (lista vazia = atende tudo) transformaria um
 *  cadastro incompleto em habilitação universal, que é o erro mais caro
 *  possível aqui: mandaria o carpinteiro para a OS de refrigeração. */
export function atendeDominio(especialidade, dominio) {
  if (!especialidade || !dominio) return false
  const lista = normalizarDominios(especialidade.dominios)
  return lista.indexOf(dominio) >= 0
}

/** `dominios` vem do banco como jsonb; o SDK pode devolver array ou
 *  string dependendo de como foi gravado. Uma função, os dois casos —
 *  senão cada chamador reinventa o parse e um deles esquece o try. */
export function normalizarDominios(valor) {
  if (Array.isArray(valor)) return valor.filter(x => typeof x === 'string')
  if (typeof valor === 'string') {
    try {
      const v = JSON.parse(valor)
      return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []
    } catch (_e) { return [] }
  }
  return []
}

export function rotuloDominios(valor) {
  const lista = normalizarDominios(valor)
  if (!lista.length) return '—'
  return lista.map(c => DOMINIO_NOME[c] || c).join(' · ')
}

/** Equipes habilitadas para um domínio, via a especialidade da equipe.
 *  Ordenadas por nome para a lista não dançar entre desenhos. */
export function equipesParaDominio(equipes, especialidades, dominio) {
  const porId = Object.fromEntries((especialidades || []).map(e => [e.id, e]))
  return (equipes || [])
    .filter(eq => eq.ativo !== false && atendeDominio(porId[eq.especialidade_id], dominio))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
}

/** Cores de equipe. Fechada e com contraste conferido contra fundo
 *  claro e escuro — cor de equipe é o que separa dois retângulos na
 *  grade, então não pode sair de um gerador aleatório que um dia
 *  devolve dois tons iguais. */
export const CORES_EQUIPE = [
  '#1351B4', '#168821', '#B46800', '#7B1FA2',
  '#00897B', '#C2185B', '#5D4037', '#455A64',
]

/** Cor sugerida para a próxima equipe: a primeira ainda não usada, e só
 *  então volta a repetir. */
export function proximaCor(equipes) {
  const usadas = new Set((equipes || []).map(e => e.cor).filter(Boolean))
  return CORES_EQUIPE.find(c => !usadas.has(c)) || CORES_EQUIPE[(equipes || []).length % CORES_EQUIPE.length]
}
