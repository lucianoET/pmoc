(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.OperacoesMaq = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STATUS_KANBAN = ['programada', 'em_execucao', 'concluida', 'cancelada']

  function validarOperacao(operacao) {
    const erros = []
    if (!operacao.area_id) erros.push('Selecione uma área.')
    if (!operacao.ativo_id) erros.push('Selecione uma máquina.')
    if (!operacao.data_programada) erros.push('Informe a data programada.')
    return erros
  }

  function agruparOperacoes(operacoes) {
    const grupos = Object.fromEntries(STATUS_KANBAN.map(status => [status, []]))
    for (const operacao of operacoes) {
      const status = STATUS_KANBAN.includes(operacao.status) ? operacao.status : 'programada'
      grupos[status].push(operacao)
    }
    return grupos
  }

  function criarEventosCalendario(operacoes, ordensServico, ano, mes) {
    const prefixo = `${ano}-${String(mes + 1).padStart(2, '0')}`
    const eventosOperacoes = operacoes.map(operacao => ({
      id: operacao.id,
      data: operacao.data_programada,
      origem: 'operacao',
      titulo: operacao.tipo_servico || 'Operação',
    }))
    const eventosOS = ordensServico.map(ordem => ({
      id: ordem.id,
      data: ordem.data_abertura,
      origem: 'os',
      titulo: ordem.tipo || 'OS',
    }))
    return [...eventosOperacoes, ...eventosOS]
      .filter(evento => evento.data?.startsWith(prefixo))
      .sort((primeiro, segundo) => primeiro.data.localeCompare(segundo.data))
  }

  function projetarUsoTotal(usoAtual, horasUtilizadas) {
    const horas = Number(horasUtilizadas)
    if (!Number.isFinite(horas) || horas <= 0) throw new Error('As horas utilizadas devem ser maior que zero.')
    return Math.round((Number(usoAtual || 0) + horas) * 100) / 100
  }

  return { validarOperacao, agruparOperacoes, criarEventosCalendario, projetarUsoTotal }
})