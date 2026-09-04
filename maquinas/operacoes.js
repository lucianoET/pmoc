// ══════════════════════════════════════════════════════════════════
// maquinas/operacoes.js — fachada de Máquinas sobre os núcleos
// genéricos de kanban e calendário (Fase 13 Plano 03, PLAT-08, PLAT-09,
// GEQ-04, D-13-03-A).
//
// (1) Por que existe: até esta extração, este arquivo continha a lógica
// de kanban e de calendário só para Máquinas. A lógica genérica subiu
// para shared/kanban.js e shared/calendario.js; este arquivo agora só
// declara o que é próprio de Máquinas — as quatro colunas do kanban de
// operações (STATUS_KANBAN/COLUNAS_KANBAN) — e delega o resto. Nenhuma
// cópia local da lógica genérica: agruparOperacoes e
// criarEventosCalendario são uma linha cada, chamando shared/.
//
// (2) Módulo ES puro, sem invólucro UMD. Continua carregável por
// require() em Node graças ao suporte nativo do Node >= 22.12 a
// require(esm) — conferido no Node 24.18 deste repositório — mesmo
// precedente de shared/tabela.js, carregado por require em
// tests/tabela-compartilhada.test.js. Condição de validade: este
// arquivo nunca pode ganhar espera de nível de topo (top-level await),
// ou deixa de ser carregável por require(). As quatro funções
// exportadas são síncronas e continuam síncronas.
//
// (3) validarOperacao e projetarUsoTotal não têm nada a ver com kanban
// ou calendário — ficam aqui porque são regra de negócio de Máquinas,
// não núcleo genérico de shared/. `maquinas/index.html` carrega este
// arquivo como `type="module"`, sempre antes de `maquinas/app.js`, que
// continua chamando `OperacoesMaq.validarOperacao`/
// `OperacoesMaq.projetarUsoTotal` sem alteração — a publicação em
// globalThis existe só para essa compatibilidade.
// ══════════════════════════════════════════════════════════════════

import { agruparKanban } from '../shared/kanban.js'
import { eventosDoMes } from '../shared/calendario.js'

const STATUS_KANBAN = ['programada', 'em_execucao', 'concluida', 'cancelada']

const COLUNAS_KANBAN = [
  { id: 'programada', rotulo: 'Programadas' },
  { id: 'em_execucao', rotulo: 'Em execução' },
  { id: 'concluida', rotulo: 'Concluídas' },
  { id: 'cancelada', rotulo: 'Canceladas' },
]

function validarOperacao(operacao) {
  const erros = []
  if (!operacao.area_id) erros.push('Selecione uma área.')
  if (!operacao.ativo_id) erros.push('Selecione uma máquina.')
  if (!operacao.data_programada) erros.push('Informe a data programada.')
  return erros
}

function agruparOperacoes(operacoes) {
  return agruparKanban(operacoes, COLUNAS_KANBAN)
}

function criarEventosCalendario(operacoes, ordensServico, ano, mes) {
  const eventosOperacoes = operacoes.map((operacao) => ({
    id: operacao.id,
    data: operacao.data_programada,
    origem: 'operacao',
    titulo: operacao.tipo_servico || 'Operação',
  }))
  const eventosOS = ordensServico.map((ordem) => ({
    id: ordem.id,
    data: ordem.data_abertura,
    origem: 'os',
    titulo: ordem.tipo || 'OS',
  }))
  return eventosDoMes([...eventosOperacoes, ...eventosOS], ano, mes)
}

function projetarUsoTotal(usoAtual, horasUtilizadas) {
  const horas = Number(horasUtilizadas)
  if (!Number.isFinite(horas) || horas <= 0) throw new Error('As horas utilizadas devem ser maior que zero.')
  return Math.round((Number(usoAtual || 0) + horas) * 100) / 100
}

globalThis.OperacoesMaq = {
  validarOperacao, agruparOperacoes, criarEventosCalendario, projetarUsoTotal, STATUS_KANBAN, COLUNAS_KANBAN,
}

export {
  validarOperacao, agruparOperacoes, criarEventosCalendario, projetarUsoTotal, STATUS_KANBAN, COLUNAS_KANBAN,
}
