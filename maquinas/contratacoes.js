// ══════════════════════════════════════════════════════════════════
// maquinas/contratacoes.js — definição do fluxo de contratação de empresa
// e núcleo puro da tela (migração 38).
//
// O CICLO é o mesmo da contratação de Refrigeração — é o processo de
// contratação pública, não invenção de módulo. O que se reaproveita é o
// fluxo (shared/fluxo.js), não a tabela: `os_contratacao` é do módulo
// congelado (D-04), referencia `equipamentos` e traz os itens da ARP de
// refrigeração. Aqui o objeto é máquina ou área, e o vocabulário é
// minúsculo como o resto das tabelas `maq_`.
//
// Nada neste arquivo toca o DOM nem o Supabase: definição + contas.
// ══════════════════════════════════════════════════════════════════
import { progresso, proximosEstados, rotuloDaEtapa, tomDaEtapa, ehTerminal } from '../shared/fluxo.js'

// As sete etapas na ordem do processo, mais os dois terminais. Os rótulos
// dizem o que se ESPERA na etapa, não o que já aconteceu: "aguardando
// orçamento" responde a pergunta que quem olha a lista está fazendo.
export const FLUXO_CONTRATACAO = {
  etapas: [
    { id: 'solicitada', rotulo: 'Aguardando orçamento', curto: 'Solicit.', tom: 'warn' },
    { id: 'orcamento', rotulo: 'Orçamento para aprovação', curto: 'Orçam.', tom: 'info' },
    { id: 'aprovada', rotulo: 'Aprovada para execução', curto: 'Aprov.', tom: 'info' },
    { id: 'em_execucao', rotulo: 'Em execução', curto: 'Execução', tom: 'warn' },
    { id: 'executada', rotulo: 'Aguardando fiscalização', curto: 'Fiscal', tom: 'info' },
    { id: 'fiscalizada', rotulo: 'Aguardando NF e certificação', curto: 'NF', tom: 'info' },
    { id: 'encerrada', rotulo: 'Encerrada', curto: 'Encerr.', tom: 'ok' },
  ],
  terminais: ['cancelada'],
  terminaisDeSucesso: ['encerrada'],
  rotulosTerminais: { cancelada: 'Cancelada' },
  tonsTerminais: { cancelada: 'erro' },
}

// A última etapa é também terminal de sucesso: dela não se avança, e é isso
// que `proximosEstados` precisa saber. Declarada aqui, não no núcleo, para o
// núcleo não conhecer o vocabulário deste fluxo.
export function estadosPossiveis(atual) {
  if (atual === 'encerrada') return ['fiscalizada', 'cancelada']
  return proximosEstados(FLUXO_CONTRATACAO, atual)
}

export function rotuloEstado(estado) {
  return rotuloDaEtapa(FLUXO_CONTRATACAO, estado)
}

export function tomEstado(estado) {
  return tomDaEtapa(FLUXO_CONTRATACAO, estado)
}

export function progressoDe(estado) {
  return progresso(FLUXO_CONTRATACAO, estado)
}

export function encerrada(estado) {
  return estado === 'encerrada' || ehTerminal(FLUXO_CONTRATACAO, estado)
}

// Recortes da lista, o mesmo vocabulário de chips da tela de Refrigeração.
// "Para aprovar" junta as duas etapas em que a contratação espera decisão
// de alguém — é a fila de trabalho de quem gerencia, e sem ela é preciso
// varrer a lista inteira para achá-la.
const ABERTAS = ['solicitada', 'orcamento', 'aprovada', 'em_execucao', 'executada', 'fiscalizada']
const ESPERANDO_DECISAO = ['orcamento', 'executada']

export const RECORTES = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'andamento', rotulo: 'Em andamento' },
  { id: 'aprovar', rotulo: 'Para aprovar' },
  { id: 'encerradas', rotulo: 'Encerradas' },
]

export function filtrarPorRecorte(lista, recorte) {
  const itens = lista || []
  if (recorte === 'andamento') return itens.filter((c) => ABERTAS.includes(c.status))
  if (recorte === 'aprovar') return itens.filter((c) => ESPERANDO_DECISAO.includes(c.status))
  if (recorte === 'encerradas') return itens.filter((c) => c.status === 'encerrada' || c.status === 'cancelada')
  return itens
}

export function contagensPorRecorte(lista) {
  const contagens = {}
  for (const recorte of RECORTES) contagens[recorte.id] = filtrarPorRecorte(lista, recorte.id).length
  return contagens
}

// Total do orçamento a partir dos itens. `total` é coluna gerada no banco,
// mas a soma é feita aqui para a tela não depender de o servidor devolvê-la
// — e para o valor mostrado ser sempre o dos itens que estão na tela.
export function totalDosItens(itens) {
  return (itens || []).reduce((soma, i) => soma + Number(i.quantidade || 0) * Number(i.valor_unitario || 0), 0)
}

// Numeração por ano, derivada do que já existe — nunca um contador
// guardado. Contador no cliente produz número duplicado assim que duas
// pessoas emitem ao mesmo tempo; aqui o `unique` do banco recusa, e a
// próxima tentativa já vê o número novo. Mesma decisão do contador de PS
// em /calibracao.
export function proximoNumero(lista, ano) {
  const prefixo = `CT-MAQ-${ano}-`
  const maior = (lista || [])
    .map((c) => String(c.numero || ''))
    .filter((n) => n.startsWith(prefixo))
    .map((n) => parseInt(n.slice(prefixo.length), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0)
  return `${prefixo}${String(maior + 1).padStart(3, '0')}`
}
