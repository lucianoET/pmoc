const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do quick-260819-5jf (parte 2) — fluxo de contratação e as peças de
// tela compartilhadas.
//
// O miolo é regra e se confere executando: quais estados podem vir depois
// de qual, e o progresso. Um processo público não salta etapa, e um bug aí
// não dá erro — deixa passar uma contratação fiscalizada sem execução.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const APP = path.join(RAIZ, 'maquinas', 'app.js')
const HTML = path.join(RAIZ, 'maquinas', 'index.html')
const MIGRACAO = path.join(RAIZ, 'supabase', '38_maquinas_contratacoes.sql')
const FLUXO = path.join(RAIZ, 'shared', 'fluxo.js')
const COMPONENTES = path.join(RAIZ, 'shared', 'componentes.js')

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

// ── 1. o fluxo, por comportamento ───────────────────────────────────────
test('o processo não salta etapa: de solicitada só se vai para orçamento ou cancelada', async () => {
  const { estadosPossiveis } = await import('../maquinas/contratacoes.js')
  assert.deepEqual(estadosPossiveis('solicitada'), ['orcamento', 'cancelada'])
  assert.ok(!estadosPossiveis('solicitada').includes('fiscalizada'), 'não se fiscaliza o que não foi executado')
  assert.ok(!estadosPossiveis('aprovada').includes('executada'), 'entre aprovada e executada existe a execução')
})

test('voltar uma etapa é permitido — corrigir avanço errado não deveria exigir mexer no banco', async () => {
  const { estadosPossiveis } = await import('../maquinas/contratacoes.js')
  assert.ok(estadosPossiveis('em_execucao').includes('aprovada'))
  assert.ok(estadosPossiveis('em_execucao').includes('executada'))
})

test('cancelada é terminal; encerrada só volta uma etapa ou cancela', async () => {
  const { estadosPossiveis } = await import('../maquinas/contratacoes.js')
  assert.deepEqual(estadosPossiveis('cancelada'), [], 'reabrir cancelamento é decisão de processo, não botão')
  assert.deepEqual(estadosPossiveis('encerrada'), ['fiscalizada', 'cancelada'])
})

test('o progresso conta etapa concluída, e cancelar não é progredir', async () => {
  const { progressoDe } = await import('../maquinas/contratacoes.js')
  assert.deepEqual(progressoDe('solicitada'), { passo: 1, total: 7, pct: 14 })
  assert.deepEqual(progressoDe('encerrada'), { passo: 7, total: 7, pct: 100 })
  assert.deepEqual(progressoDe('cancelada'), { passo: 0, total: 7, pct: 0 })
})

test('estado desconhecido aparece na tela em vez de sumir', async () => {
  const { rotuloEstado, tomEstado, progressoDe } = await import('../maquinas/contratacoes.js')
  assert.equal(rotuloEstado('inventado'), 'inventado')
  assert.equal(tomEstado('inventado'), 'neutro')
  assert.deepEqual(progressoDe('inventado'), { passo: 0, total: 7, pct: 0 })
})

test('recortes da lista somam o total e "para aprovar" isola quem espera decisão', async () => {
  const { filtrarPorRecorte, contagensPorRecorte } = await import('../maquinas/contratacoes.js')
  const lista = [
    { status: 'solicitada' }, { status: 'orcamento' }, { status: 'executada' },
    { status: 'encerrada' }, { status: 'cancelada' },
  ]
  const c = contagensPorRecorte(lista)
  assert.equal(c.todas, 5)
  assert.equal(c.andamento, 3)
  assert.equal(c.aprovar, 2, 'orçamento e executada são as duas etapas que esperam decisão de alguém')
  assert.equal(c.encerradas, 2)
  assert.deepEqual(filtrarPorRecorte(lista, 'aprovar').map((x) => x.status), ['orcamento', 'executada'])
})

test('a numeração é derivada do maior número do ano, nunca de contador guardado', async () => {
  const { proximoNumero } = await import('../maquinas/contratacoes.js')
  assert.equal(proximoNumero([], 2026), 'CT-MAQ-2026-001')
  assert.equal(proximoNumero([{ numero: 'CT-MAQ-2026-007' }, { numero: 'CT-MAQ-2026-003' }], 2026), 'CT-MAQ-2026-008')
  assert.equal(proximoNumero([{ numero: 'CT-MAQ-2025-090' }], 2026), 'CT-MAQ-2026-001', 'a série reinicia por ano')
  assert.equal(proximoNumero([{ numero: 'lixo' }], 2026), 'CT-MAQ-2026-001')
})

// ── 2. o núcleo de fluxo é genérico ─────────────────────────────────────
test('shared/fluxo.js não conhece nenhum estado de contratação nem de OS', () => {
  const nucleo = ler(FLUXO)
  for (const palavra of ['solicitada', 'orcamento', 'fiscalizada', 'em_andamento', 'delineamento', 'maq_', 'os_contratacao']) {
    assert.ok(!nucleo.includes(palavra), `shared/fluxo.js passou a citar "${palavra}" — a definição é parâmetro`)
  }
  assert.doesNotMatch(nucleo, /document|window|localStorage/, 'o núcleo de fluxo não toca o navegador')
})

test('shared/componentes.js devolve texto, sem cor escrita à mão e sem tocar o DOM', () => {
  const fonte = ler(COMPONENTES)
  assert.doesNotMatch(fonte, /document\.|window\./, 'componente que toca o DOM deixa de ser testável e de servir a dois apps')
  assert.doesNotMatch(fonte, /#[0-9a-fA-F]{6}/, 'cor em JavaScript seria mais uma cópia da paleta')
})

test('as peças escapam o que vem de linha de banco', async () => {
  const { pilula, chips, seletor } = await import('../shared/componentes.js')
  assert.match(pilula('<script>x</script>', 'ok'), /&lt;script&gt;/)
  assert.match(chips([{ id: 'a', rotulo: '<b>' }], 'a', 'f'), /&lt;b&gt;/)
  assert.match(seletor([{ id: "a'b", rotulo: 'x' }], 'a', 'f'), /&#39;/)
})

test('tom fora da lista cai em neutro, não em classe inexistente', async () => {
  const { pilula } = await import('../shared/componentes.js')
  assert.match(pilula('x', 'roxo'), /pilula-neutro/)
  assert.match(pilula('x'), /pilula-neutro/)
})

// ── 3. migração e tela ──────────────────────────────────────────────────
test('a migração 38 é aditiva, não toca os_contratacao e trava o vocabulário', () => {
  const sql = ler(MIGRACAO)
  assert.doesNotMatch(sql, /\bdrop\b/i)
  assert.ok(!/alter table os_contratacao|alter table equipamentos/i.test(sql), 'o módulo Refrigeração está congelado (D-04)')
  assert.match(sql, /check \(status in \('solicitada','orcamento','aprovada','em_execucao','executada','fiscalizada','encerrada','cancelada'\)\)/)
  // Máquina OU área, nunca as duas: alternativas, não acumulativas.
  assert.match(sql, /num_nonnulls\(ativo_id, area_id\) <= 1/)
  // total é coluna gerada: não existe linha em que ele divirja do produto.
  assert.match(sql, /total numeric\(14,2\) generated always as/)
  assert.match(sql, /enable row level security/)
})

test('a lista de contratação e o vocabulário do fluxo saem do mesmo lugar que o banco aceita', async () => {
  const { FLUXO_CONTRATACAO } = await import('../maquinas/contratacoes.js')
  const sql = ler(MIGRACAO)
  const noBanco = sql.match(/check \(status in \(([^)]*)\)\)/)[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort()
  const naTela = [...FLUXO_CONTRATACAO.etapas.map((e) => e.id), ...FLUXO_CONTRATACAO.terminais].sort()
  assert.deepEqual(naTela, noBanco, 'um estado que a tela oferece e o banco recusa é um botão que sempre falha')
})

test('a aba de OS ganhou o seletor entre as duas listas, e a contratação tolera a ausência da migração', () => {
  const app = ler(APP)
  const html = ler(HTML)
  assert.match(html, /id="os-seletor"/)
  assert.match(html, /id="os-bloco-contratacoes"/)
  assert.match(html, /id="modal-contratacao"/)
  // Mesma tolerância de carregarCatalogoReparos/carregarItensOS: erro contido.
  const bloco = app.match(/async function carregarContratacoes\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'carregarContratacoes não encontrada')
  assert.match(bloco[1], /ct\.error \? \[\]/, 'sem a migração a lista fica vazia, sem alarme')
  assert.doesNotMatch(bloco[1], /alert\(/, 'ausência de migração não é erro para o usuário')
})

test('a permissão de contratar é conferida na abertura do formulário, na gravação e na mudança de etapa', () => {
  const app = ler(APP)
  for (const fn of ['abrirModalContratacao', 'salvarContratacao', 'mudarEstadoContratacao']) {
    const inicio = app.indexOf(`function ${fn}(`)
    assert.notEqual(inicio, -1, `${fn} não encontrada`)
    const corpo = app.slice(inicio, app.indexOf('\n}', inicio))
    assert.match(corpo, /podeContratar\(\)/, `${fn} deveria conferir o cargo`)
  }
  // E a transição é validada contra o fluxo antes de ir ao banco.
  const mudar = app.match(/async function mudarEstadoContratacao\([^)]*\)\{([\s\S]*?)\n\}/)[1]
  assert.match(mudar, /estadosPossiveis\(ct\.status\)\.includes\(destino\)/)
})
