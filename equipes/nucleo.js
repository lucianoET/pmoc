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

// ══ plano & capacidade: a demanda ═══════════════════════════════════
//
// A capacidade já vem das alocações. A demanda é o outro lado: quanto
// tempo o plano de manutenção OBRIGA por ano.
//
// Ela sai de `plano_tarefas`, que é o plano REAL da refrigeração já no
// banco (9 tarefas da NBR 17037, cada uma com sua periodicidade) — NÃO
// de uma cópia da tabela de intervalos que vive dentro do arquivo de
// /refrigeracao. Duplicar aquelas constantes criaria duas fontes de
// verdade para "de quanto em quanto tempo", e como /refrigeracao é
// módulo congelado a cópia divergiria sem ninguém perceber.

/** Quantas vezes por ano cada periodicidade acontece. Lista fechada:
 *  uma periodicidade desconhecida devolve 0 e é CONTADA à parte, nunca
 *  suposta como anual — supor faria uma tarefa nova aparecer na conta
 *  com um número inventado. */
export const OCORRENCIAS_ANO = {
  MENSAL: 12,
  BIMESTRAL: 6,
  TRIMESTRAL: 4,
  QUADRIMESTRAL: 3,
  SEMESTRAL: 2,
  ANUAL: 1,
}

export function ocorrenciasPorAno(periodicidade) {
  const k = String(periodicidade ?? '').trim().toUpperCase()
  return Object.prototype.hasOwnProperty.call(OCORRENCIAS_ANO, k) ? OCORRENCIAS_ANO[k] : 0
}

/** Agrupa as tarefas do plano por periodicidade. É esse agrupamento que
 *  transforma "41 execuções de tarefa por ano" em "19 VISITAS por ano":
 *  o técnico que faz as duas tarefas mensais do mesmo aparelho se
 *  desloca uma vez só, e cobrar setup por tarefa inflaria a demanda em
 *  quase o dobro. */
export function visitasDoPlano(tarefas) {
  const buckets = new Map()
  let semPeriodicidade = 0
  for (const t of tarefas || []) {
    if (t && t.ativo === false) continue
    const n = ocorrenciasPorAno(t && t.periodicidade)
    if (!n) { semPeriodicidade++; continue }
    const k = String(t.periodicidade).trim().toUpperCase()
    if (!buckets.has(k)) buckets.set(k, { periodicidade: k, porAno: n, tarefas: 0 })
    buckets.get(k).tarefas++
  }
  const visitas = [...buckets.values()].sort((a, b) => b.porAno - a.porAno)
  return {
    visitas,
    semPeriodicidade,
    visitasPorAno: visitas.reduce((s, v) => s + v.porAno, 0),
    tarefasPorAno: visitas.reduce((s, v) => s + v.porAno * v.tarefas, 0),
  }
}

// ── a regra de escopo do plano ──────────────────────────────────────
//
// SEGUNDA CÓPIA, DELIBERADA E VIGIADA. A regra original mora em
// `refrigeracao/index.html`, que é módulo congelado (D-04) e não pode
// importar deste diretório — a plataforma inteira proíbe a palavra
// dentro daquele arquivo, e quinze gates a conferem. Subir a regra um
// nível daria um arquivo com UM importador (este) e deixaria a réplica
// de /refrigeracao exatamente como está, com mais um lugar para
// divergir. O que impede a divergência não é o lugar: é o gate, que roda
// as DUAS implementações sobre a mesma tabela de casos e falha se elas
// discordarem em um único deles.

export const PLANO_TODOS = 'TODOS'

/** A tarefa vale para este equipamento?
 *
 *  `aplica_a` é 'TODOS' ou um valor de `equipamentos.tipo`; `aplica_modelo`
 *  é refinamento OPCIONAL — nulo ou vazio não restringe, porque `modelo` é
 *  nulo em 117 das 175 linhas e exigir igualdade com nulo tiraria a regra
 *  de todo o resto do parque.
 *
 *  Comparação por texto normalizado (trim + maiúsculas) porque `tipo` é
 *  cadastro livre do usuário: 'Split' e 'SPLIT' são o mesmo tipo, e uma
 *  comparação sensível a caixa faria a regra alcançar zero equipamento
 *  sem nada na tela dizendo por quê. */
export function planoAplicaAoEquip(tarefa, equip) {
  if (!tarefa || !equip) return false
  const escopo = String(tarefa.aplica_a || PLANO_TODOS).trim().toUpperCase()
  if (escopo !== PLANO_TODOS) {
    if (String(equip.tipo || '').trim().toUpperCase() !== escopo) return false
  }
  const modelo = String(tarefa.aplica_modelo || '').trim()
  if (!modelo) return true
  return String(equip.modelo || '').trim().toUpperCase() === modelo.toUpperCase()
}

/** Há alguma regra com escopo? É o que decide se a demanda tem uma forma
 *  só para o parque inteiro ou uma por tipo — e, portanto, o que a tela
 *  precisa mostrar. Enquanto as 9 tarefas da NBR forem TODOS isto é
 *  falso, e a tela continua dizendo o que sempre disse. */
export function planoTemEscopo(tarefas) {
  return (tarefas || []).some(t => t && t.ativo !== false && (
    String(t.aplica_a || PLANO_TODOS).trim().toUpperCase() !== PLANO_TODOS ||
    String(t.aplica_modelo || '').trim() !== ''))
}

/** Agrupa os equipamentos pelo par que DECIDE o plano: tipo e modelo.
 *  Dois equipamentos com o mesmo par recebem exatamente as mesmas
 *  tarefas, então o plano se resolve uma vez por grupo em vez de 175
 *  vezes. É o par e não só o tipo porque `aplica_modelo` refina por
 *  modelo — agrupar só por tipo faria a regra de modelo valer para o
 *  tipo inteiro, que é a mesma classe de erro que esta correção conserta.
 *
 *  Não filtra por situação: quem filtra é a consulta. Uma segunda
 *  filtragem aqui esconderia o dia em que a consulta mudasse. */
export function gruposDePlano(equipamentos) {
  const mapa = new Map()
  for (const e of equipamentos || []) {
    if (!e) continue
    const tipo = String(e.tipo || '').trim()
    const modelo = String(e.modelo || '').trim()
    const k = `${tipo.toUpperCase()}|${modelo.toUpperCase()}`
    if (!mapa.has(k)) mapa.set(k, { tipo, modelo, quantidade: 0, exemplo: e })
    mapa.get(k).quantidade++
  }
  return [...mapa.values()]
}

/** Minutos que UM equipamento consome por ano.
 *
 *  Por visita: (tarefas da visita × minutos por tarefa) + setup. O setup
 *  é por visita e não por tarefa — é deslocamento, montagem e registro,
 *  e acontece uma vez por ida ao equipamento. */
export function minutosPorEquipamentoAno(plano, params) {
  const minTarefa = numeroOuZero(params && params.minutos_por_tarefa)
  const setup = numeroOuZero(params && params.minutos_setup)
  return (plano.visitas || []).reduce(
    (s, v) => s + v.porAno * (v.tarefas * minTarefa + setup), 0)
}

function numeroOuZero(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Demanda anual do plano, em homem-hora — SOMADA POR ESCOPO.
 *
 *  ── O DEFEITO QUE ISTO CONSERTA ──
 *
 *  Esta função recebia `nEquipamentos`, um NÚMERO, e multiplicava por ele
 *  um único plano montado sobre a lista inteira de tarefas. Enquanto as 9
 *  tarefas da NBR valessem para TODOS a conta estava certa por acidente:
 *  todo equipamento tinha mesmo o mesmo plano. Desde a migração 54 a tela
 *  do Plano em /refrigeracao permite criar regra por tipo e por modelo, e
 *  a primeira que o usuário criasse seria contada para os 175
 *  equipamentos em vez de para o tipo — uma regra mensal escrita só para
 *  o CHILLER (1 máquina) inflaria a demanda anual em 174 equipamentos de
 *  trabalho que ninguém vai fazer. Uma função que recebe uma CONTAGEM não
 *  tem como estar certa depois que o escopo existe: a contagem não sabe
 *  de que tipo é cada máquina.
 *
 *  Agora recebe os equipamentos, resolve o plano de cada grupo
 *  (tipo × modelo) e soma. Com as 9 tarefas em TODOS o resultado é
 *  idêntico ao de antes, dígito por dígito — é a mesma multiplicação,
 *  feita uma vez por grupo.
 *
 *  `semRegra` é o outro lado, e precisa ser dito em voz alta: equipamento
 *  que nenhuma regra alcança contribui ZERO para a demanda. Sem esse
 *  número a soma encolheria e a tela pareceria estar em folga, quando o
 *  que houve foi máquina saindo da OS sem checklist nenhum. É o mesmo
 *  cuidado de `semPeriodicidade` e de `naoCobertos`. */
export function demandaAnual(tarefas, equipamentos, params, naoCobertos) {
  const lista = (tarefas || []).filter(t => t && t.ativo !== false)
  const grupos = gruposDePlano(equipamentos)

  // Contada UMA vez sobre o plano inteiro, nunca por grupo: a mesma
  // tarefa de periodicidade desconhecida apareceria em cada grupo que
  // ela alcança e a tela relataria seis quando existe uma.
  const semPeriodicidade = visitasDoPlano(lista).semPeriodicidade

  const porTipo = new Map()
  let minutos = 0
  let visitasAno = 0
  let cobertos = 0
  let semRegra = 0

  for (const g of grupos) {
    const doGrupo = lista.filter(t => planoAplicaAoEquip(t, g.exemplo))
    const plano = visitasDoPlano(doGrupo)
    const minEquip = minutosPorEquipamentoAno(plano, params)

    minutos += minEquip * g.quantidade
    visitasAno += plano.visitasPorAno * g.quantidade
    cobertos += g.quantidade
    if (!plano.visitas.length) semRegra += g.quantidade

    const tipo = g.tipo || '—'
    if (!porTipo.has(tipo)) {
      porTipo.set(tipo, { tipo, equipamentos: 0, minutos: 0, visitasAno: 0,
                          regrasMin: Infinity, regrasMax: 0 })
    }
    const linha = porTipo.get(tipo)
    linha.equipamentos += g.quantidade
    linha.minutos += minEquip * g.quantidade
    linha.visitasAno += plano.visitasPorAno * g.quantidade
    // Faixa, não média: um tipo com dois modelos e uma regra só para um
    // deles tem MESMO duas contagens, e uma média esconderia isso atrás
    // de um número que não vale para nenhum dos dois.
    linha.regrasMin = Math.min(linha.regrasMin, plano.visitas.length ? doGrupo.length : 0)
    linha.regrasMax = Math.max(linha.regrasMax, doGrupo.length)
  }

  const linhas = [...porTipo.values()]
    .map(l => ({
      tipo: l.tipo,
      equipamentos: l.equipamentos,
      regrasMin: Number.isFinite(l.regrasMin) ? l.regrasMin : 0,
      regrasMax: l.regrasMax,
      visitasAno: l.visitasAno,
      horasAno: l.minutos / 60,
      horasPorEquipamentoAno: l.equipamentos ? l.minutos / l.equipamentos / 60 : 0,
    }))
    .sort((a, b) => b.horasAno - a.horasAno || String(a.tipo).localeCompare(String(b.tipo), 'pt-BR'))

  return {
    horasAno: minutos / 60,
    horasSemana: minutos / 60 / 52,
    // MÉDIA ponderada, e nomeada como média: com escopo em jogo não
    // existe "o" número por equipamento, e um nome que não diz isso seria
    // lido como se existisse.
    horasPorEquipamentoAnoMedia: cobertos ? minutos / cobertos / 60 : 0,
    equipamentos: cobertos,
    naoCobertos: Math.max(0, Math.floor(Number(naoCobertos) || 0)),
    visitasAno,
    semPeriodicidade,
    semRegra,
    tiposSemRegra: linhas.filter(l => l.regrasMax === 0).map(l => l.tipo),
    porTipo: linhas,
    comEscopo: planoTemEscopo(lista),
  }
}

/** Utilização = demanda ÷ capacidade. Devolve null sem capacidade, em
 *  vez de Infinity ou de um 0 que passaria por "folga": uma semana sem
 *  ninguém escalado não tem utilização definida, e um número ali seria
 *  lido como resposta. */
export function utilizacao(horasDemanda, horasCapacidade) {
  const d = Number(horasDemanda)
  const c = Number(horasCapacidade)
  if (!Number.isFinite(d) || !Number.isFinite(c) || c <= 0) return null
  return d / c
}

/** Faixas de leitura da utilização. Acima de 100% o plano não cabe na
 *  escala; entre 85 e 100 cabe sem folga nenhuma para corretiva, que
 *  numa oficina de manutenção é o mesmo que não caber. */
export const FAIXAS_UTILIZACAO = [
  { ate: 0.70, chave: 'folga',   rotulo: 'Dentro da capacidade', tom: '#168821' },
  { ate: 0.85, chave: 'apertado', rotulo: 'Apertado',            tom: '#B46800' },
  { ate: 1.00, chave: 'limite',  rotulo: 'No limite',            tom: '#B46800' },
  { ate: Infinity, chave: 'acima', rotulo: 'Acima da capacidade', tom: '#E52207' },
]

export function faixaUtilizacao(u) {
  if (u === null || u === undefined || !Number.isFinite(u)) return null
  return FAIXAS_UTILIZACAO.find(f => u <= f.ate) || FAIXAS_UTILIZACAO[FAIXAS_UTILIZACAO.length - 1]
}

/** Parâmetros vindos do banco (linhas chave/valor) viram um objeto. Uma
 *  função, um formato — senão cada chamador reinventa o reduce e um
 *  deles esquece o parseFloat. */
export function parametrosComoObjeto(linhas) {
  const out = {}
  for (const l of linhas || []) {
    if (!l || !l.chave) continue
    const n = parseFloat(l.valor)
    out[l.chave] = Number.isFinite(n) ? n : 0
  }
  return out
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
