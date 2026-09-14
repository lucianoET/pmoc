// ══════════════════════════════════════════════════════════════════
// CMASM Bio — núcleo puro. Sem DOM, sem Supabase, sem Date.now():
// tudo que decide recebe a data como parâmetro, para o gate rodar em
// Node com data fixa. Mesmo corte de predial/dominio.js e equipes/nucleo.js.
//
// As listas fechadas espelham os `check` da migração 61 — o gate
// tests/bio-schema.test.js compara as duas fontes e reprova a divergência
// nas duas direções, porque um valor fora do check é gravação recusada
// com erro opaco, e um valor do check que a tela não oferece é opção
// que ninguém alcança.
// ══════════════════════════════════════════════════════════════════

export const CATEGORIAS = {
  animal: { rotulo: 'Animal', icone: '🐾' },
  praga: { rotulo: 'Praga', icone: '🐜' },
  arvore: { rotulo: 'Árvore', icone: '🌳' },
}

export const GRUPOS = {
  mamifero: 'Mamífero', ave: 'Ave', peixe: 'Peixe', reptil: 'Réptil', anfibio: 'Anfíbio',
  inseto: 'Inseto', aracnideo: 'Aracnídeo', molusco: 'Molusco', roedor: 'Roedor',
  arvore: 'Árvore', outro: 'Outro',
}

export const RISCOS = {
  baixo: { rotulo: 'Baixo', tom: 'ok' },
  medio: { rotulo: 'Médio', tom: 'warn' },
  alto: { rotulo: 'Alto', tom: 'erro' },
}

export const TIPOS_SERVICO = {
  poda: 'Poda', supressao: 'Supressão', dedetizacao: 'Dedetização', desratizacao: 'Desratização',
  armadilha: 'Armadilha', isca: 'Isca', monitoramento: 'Monitoramento', outro: 'Outro',
}

// Tipos que fazem sentido para cada alvo. Um serviço de árvore não é
// dedetização; um controle de praga não é poda. A tela filtra por aqui;
// o banco aceita qualquer combinação — a exclusividade que ele trava é
// "um alvo só", não o tipo (migração 61, item 4).
export const TIPOS_POR_ALVO = {
  arvore: ['poda', 'supressao', 'monitoramento', 'outro'],
  presenca: ['dedetizacao', 'desratizacao', 'armadilha', 'isca', 'monitoramento', 'outro'],
}

export const STATUS_SERVICO = {
  programado: { rotulo: 'Programado', tom: 'info' },
  realizado: { rotulo: 'Realizado', tom: 'ok' },
  cancelado: { rotulo: 'Cancelado', tom: 'neutro' },
}

export const PREFIXO_ARVORE = 'ARV'
export const FORMATO_CODIGO = /^ARV-[0-9]{4}$/

// ── datas ──────────────────────────────────────────────────────────────
// Sempre `aaaa-mm-dd` LOCAL, nunca `toISOString()`: a conversão para UTC
// empurra para o dia anterior tudo antes das 21h no nosso fuso — a lição
// de `agendaChave` em /refrigeracao.

export function hojeIso(data = new Date()) {
  const y = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Soma meses a uma data ISO, prendendo o dia ao fim do mês quando não
 *  existe (31/01 + 1 mês = 28/02, não 03/03 — que é o que `setMonth`
 *  sozinho devolve e faria uma poda anual "andar" a cada ciclo). */
export function somarMeses(iso, meses) {
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  const alvo = new Date(y, m - 1 + meses, 1)
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  alvo.setDate(Math.min(d, ultimoDia))
  return hojeIso(alvo)
}

export function fmtData(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : String(iso)
}

// ── código da árvore ───────────────────────────────────────────────────
/** Próximo código livre a partir dos já existentes. É contagem no cliente,
 *  e por isso `bio_arvores.codigo` é `unique`: duas pessoas cadastrando ao
 *  mesmo tempo produzem o mesmo número, e o banco recusa a segunda — o
 *  app recalcula e tenta de novo. Nunca guardar o contador. */
export function proximoCodigo(arvores) {
  let maior = 0
  for (const a of arvores || []) {
    const m = FORMATO_CODIGO.exec(a?.codigo || '')
    if (m) maior = Math.max(maior, Number(a.codigo.slice(4)))
  }
  return `${PREFIXO_ARVORE}-${String(maior + 1).padStart(4, '0')}`
}

// ── serviços ───────────────────────────────────────────────────────────
/** Situação de um serviço numa data: `vencido` é programado com data no
 *  passado — não é estado do banco, é leitura da tela. */
export function situacaoServico(servico, hoje) {
  if (!servico) return null
  if (servico.status !== 'programado') return servico.status
  return servico.data_programada < hoje ? 'vencido' : 'programado'
}

/** O serviço seguinte que um realizado periódico gera — ou null quando é
 *  avulso. Mesmo tipo, mesmo alvo, mesma periodicidade; data a partir da
 *  REALIZAÇÃO (não da programada), senão um atraso de dois meses viraria
 *  dois meses de adiantamento no ciclo seguinte. */
export function proximoServico(servico, dataRealizada) {
  const meses = Number(servico?.periodicidade_meses)
  if (!Number.isInteger(meses) || meses < 1) return null
  const data = somarMeses(dataRealizada, meses)
  if (!data) return null
  return {
    tipo: servico.tipo,
    arvore_id: servico.arvore_id ?? null,
    presenca_id: servico.presenca_id ?? null,
    status: 'programado',
    data_programada: data,
    periodicidade_meses: meses,
    materiais: servico.materiais ?? null,
    obs: null,
  }
}

/** Validação da tela — espelha as travas da migração 61 para o erro
 *  aparecer no formulário e não como erro opaco do Postgres. */
export function validarServico(s) {
  const erros = []
  if (!TIPOS_SERVICO[s?.tipo]) erros.push('Tipo de serviço inválido.')
  const temArvore = s?.arvore_id != null
  const temPresenca = s?.presenca_id != null
  if (temArvore === temPresenca) erros.push('O serviço precisa de exatamente um alvo: uma árvore ou uma presença.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s?.data_programada || '')) erros.push('Data programada obrigatória.')
  const p = s?.periodicidade_meses
  if (p != null && p !== '' && !(Number.isInteger(Number(p)) && Number(p) >= 1 && Number(p) <= 120)) {
    erros.push('Periodicidade deve ser um inteiro de 1 a 120 meses.')
  }
  return erros
}

export function validarArvore(a) {
  const erros = []
  if (!a?.ficha_id) erros.push('Escolha a espécie (ficha).')
  if (!FORMATO_CODIGO.test(a?.codigo || '')) erros.push('Código no formato ARV-0000.')
  const lat = a?.lat, lon = a?.lon
  if ((lat == null) !== (lon == null)) erros.push('Latitude e longitude andam juntas.')
  if (lat != null && !(lat >= -23.2 && lat <= -22.5 && lon >= -43.5 && lon <= -42.7)) {
    erros.push('Coordenada fora da região do CMASM.')
  }
  return erros
}

export function validarPresenca(p) {
  const erros = []
  if (!p?.ficha_id) erros.push('Escolha a espécie (ficha).')
  const lat = p?.lat, lon = p?.lon
  if ((lat == null) !== (lon == null)) erros.push('Latitude e longitude andam juntas.')
  if (lat != null && !(lat >= -23.2 && lat <= -22.5 && lon >= -43.5 && lon <= -42.7)) {
    erros.push('Coordenada fora da região do CMASM.')
  }
  if (p?.quantidade_estimada != null && p.quantidade_estimada !== '' && !(Number(p.quantidade_estimada) >= 0)) {
    erros.push('Quantidade não pode ser negativa.')
  }
  return erros
}

// ── painel ─────────────────────────────────────────────────────────────
/** Os quatro números da tela inicial. Serviço do mês = programado com
 *  data dentro do mês de `hoje`, vencido ou não. */
export function resumoPainel({ arvores = [], presencas = [], servicos = [] }, hoje) {
  const mes = String(hoje).slice(0, 7)
  let vencidos = 0
  let noMes = 0
  for (const s of servicos) {
    if (s.status !== 'programado') continue
    if (s.data_programada < hoje) vencidos += 1
    if (String(s.data_programada).slice(0, 7) === mes) noMes += 1
  }
  return {
    arvores: arvores.filter(a => a.ativo !== false).length,
    presencas: presencas.filter(p => p.ativo !== false).length,
    vencidos,
    noMes,
  }
}

/** Próximo serviço programado de um alvo (a data mais próxima), ou null. */
export function proximoDoAlvo(servicos, chave, id) {
  let melhor = null
  for (const s of servicos || []) {
    if (s.status !== 'programado' || s[chave] !== id) continue
    if (!melhor || s.data_programada < melhor.data_programada) melhor = s
  }
  return melhor
}

/** Endereço de deep link que a etiqueta carrega — só o código, nunca o
 *  id: o código está impresso e sobrevive a uma reimportação. */
export function urlDaEtiqueta(origem, codigo) {
  if (!FORMATO_CODIGO.test(codigo || '')) return null
  return `${origem}/bio?codigo=${codigo}`
}
