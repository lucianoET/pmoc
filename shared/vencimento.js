// Regra de vencimento por horímetro, comum aos módulos de manutenção.
// Isolada aqui para poder ser testada sem navegador.

/**
 * Calcula a próxima ocorrência de um item de plano e sua situação.
 * A próxima ocorrência é o múltiplo do intervalo imediatamente acima
 * da última execução registrada (mesma regra dos apps legados).
 *
 * @param {number} ultimo    Horímetro da última execução (0 = nunca executado).
 * @param {number} intervalo Intervalo do plano, na unidade do horímetro.
 * @param {number} usoAtual  Horímetro atual do ativo.
 * @returns {{proximo:number, falta:number, status:'vencida'|'urgente'|'proxima'|'ok'}}
 */
export function calcularOcorrencia(ultimo, intervalo, usoAtual) {
  const proximo = ultimo === 0 ? intervalo : (Math.floor(ultimo / intervalo) + 1) * intervalo
  const falta = proximo - usoAtual

  let status = 'ok'
  if (falta <= 0) status = 'vencida'
  else if (falta <= intervalo * 0.15) status = 'urgente'
  else if (falta <= intervalo * 0.30) status = 'proxima'

  return { proximo, falta, status }
}
