// ══════════════════════════════════════════════════════════════════
// shared/fluxo.js — núcleo puro de fluxo de estados, genérico por
// definição de etapas.
//
// (1) Por que existe: o projeto tem o MESMO processo escrito três vezes —
// a OS de manutenção de Máquinas (6 estados, migração 31), a contratação
// de Refrigeração (8 estados, `CT_STATUS`) e agora a contratação de
// Máquinas. Em cada cópia estavam juntos: a lista fechada de estados, o
// rótulo de tela, a cor, a ordem das etapas e a regra de qual estado pode
// vir depois de qual. Corrigir a ordem numa cópia não chegava nas outras.
//
// (2) O que ele NÃO faz: não sabe nome de tabela, não grava, não desenha.
// Recebe a definição de etapas como parâmetro — nenhum vocabulário de
// contratação ou de OS aparece neste arquivo, do mesmo jeito que
// shared/tabela.js não conhece campo de material. Testável em Node.
//
// (3) A regra de transição é ADJACÊNCIA na lista, mais o cancelamento: um
// processo público não salta etapa (não se fiscaliza o que não foi
// executado), e cancelar é possível de qualquer etapa aberta. Voltar uma
// etapa é permitido de propósito — corrigir um avanço errado por engano é
// mais comum do que parece, e sem isso o único caminho é editar o banco.
// ══════════════════════════════════════════════════════════════════

// Uma definição de fluxo é uma lista ordenada de etapas:
//   [{ id, rotulo, curto, tom }]
// `tom` é o nome de um tom semântico da folha comum (info/ok/warn/erro/
// neutro) — não uma cor: cor escrita aqui seria a sétima cópia da paleta.
// Etapas terminais ficam FORA da lista e entram em `terminais`.

export function etapasDe(fluxo) {
  return (fluxo?.etapas || []).map((e) => e.id)
}

export function etapa(fluxo, id) {
  return (fluxo?.etapas || []).find((e) => e.id === id) || null
}

export function indiceDaEtapa(fluxo, id) {
  return (fluxo?.etapas || []).findIndex((e) => e.id === id)
}

export function ehTerminal(fluxo, id) {
  return (fluxo?.terminais || []).includes(id)
}

export function estadoValido(fluxo, id) {
  return indiceDaEtapa(fluxo, id) >= 0 || ehTerminal(fluxo, id)
}

// Rótulo longo para o balão/detalhe; curto para a régua de etapas. Estado
// desconhecido devolve o próprio id, nunca vazio: um estado que a lista não
// conhece precisa aparecer na tela para alguém corrigir o cadastro.
export function rotuloDaEtapa(fluxo, id) {
  const achada = etapa(fluxo, id) || (fluxo?.rotulosTerminais || {})[id]
  if (!achada) return String(id ?? '')
  return typeof achada === 'string' ? achada : achada.rotulo || achada.id
}

export function tomDaEtapa(fluxo, id) {
  const achada = etapa(fluxo, id)
  if (achada) return achada.tom || 'neutro'
  return (fluxo?.tonsTerminais || {})[id] || 'neutro'
}

/**
 * Estados que podem vir depois de `atual`: a etapa seguinte, a anterior
 * (correção de avanço errado) e os terminais ainda alcançáveis. Estado
 * terminal não tem para onde ir — encerrado é encerrado, cancelado é
 * cancelado; reabrir é decisão de processo, não de botão.
 */
export function proximosEstados(fluxo, atual) {
  if (!fluxo || ehTerminal(fluxo, atual)) return []
  const i = indiceDaEtapa(fluxo, atual)
  if (i < 0) return []
  const etapas = fluxo.etapas
  const seguintes = []
  if (i + 1 < etapas.length) seguintes.push(etapas[i + 1].id)
  if (i > 0) seguintes.push(etapas[i - 1].id)
  return [...seguintes, ...(fluxo.terminais || [])]
}

export function podeIrPara(fluxo, atual, destino) {
  return proximosEstados(fluxo, atual).includes(destino)
}

// Progresso em etapas concluídas / total, para a régua e para a barra.
// Terminal de sucesso conta como completo; terminal de cancelamento não
// conta nada — cancelar não é progredir.
export function progresso(fluxo, atual) {
  const total = (fluxo?.etapas || []).length
  if (!total) return { passo: 0, total: 0, pct: 0 }
  if (ehTerminal(fluxo, atual)) {
    const completo = (fluxo.terminaisDeSucesso || []).includes(atual)
    return { passo: completo ? total : 0, total, pct: completo ? 100 : 0 }
  }
  const i = indiceDaEtapa(fluxo, atual)
  if (i < 0) return { passo: 0, total, pct: 0 }
  const passo = i + 1
  return { passo, total, pct: Math.round((passo / total) * 100) }
}
