const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do quick-260819-4wn — tabela de áreas de serviço (aba Operações de
// Máquinas) com edição, ordenação e filtro.
//
// A ordenação e o filtro são testados por COMPORTAMENTO, através do
// adaptador: é o contrato que importa (a coluna certa, o tipo certo, o
// vazio no fim), não o texto do arquivo. O núcleo genérico
// (shared/tabela.js) não precisou de uma linha para atender a terceira
// tabela do projeto — e este arquivo trava isso.
//
// O resto é estrutural, com um caso valioso: a lista de cargos da tela
// contra a policy REAL de maq_areas. Diferente do gate do cadastro de
// material (que é UX apenas), aqui o banco recusa técnico e observador —
// tela e banco não podem divergir em nenhuma direção.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const APP = path.join(RAIZ, 'maquinas', 'app.js')
const INDEX_HTML = path.join(RAIZ, 'maquinas', 'index.html')
const TABELA_AREAS = path.join(RAIZ, 'maquinas', 'areas-tabela.js')
const NUCLEO = path.join(RAIZ, 'shared', 'tabela.js')
const MIGRACAO_12 = path.join(RAIZ, 'supabase', '12_maquinas_areas_operacoes.sql')

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

function corpoDaFuncao(fonte, nome) {
  const inicio = fonte.indexOf(`function ${nome}(`)
  assert.notEqual(inicio, -1, `função ${nome} não encontrada`)
  const fim = fonte.indexOf('\n}', inicio)
  return fonte.slice(inicio, fim)
}

const AREAS = [
  { id: 'a', codigo: 'AV-02', nome: 'Área Verde', tipo: 'poda', area_m2: 900, periodicidade_dias: 30, localizacao: 'Fundos' },
  { id: 'b', codigo: 'AV-01', nome: 'Campo futebol', tipo: 'corte', area_m2: 1200, periodicidade_dias: null, localizacao: 'Frente', geom: [[1, 2], [3, 4], [5, 6]] },
  { id: 'c', codigo: null, nome: 'Ácer do pátio', tipo: 'corte', area_m2: null, periodicidade_dias: 7, localizacao: '' },
]

// ── 1. ordenação ────────────────────────────────────────────────────────
test('dimensão ordena por número, e o não informado fica no fim nas duas direções', async () => {
  const { aplicarOrdemEFiltro } = await import('../maquinas/areas-tabela.js')
  const asc = aplicarOrdemEFiltro(AREAS, { coluna: 'area_m2', dir: 'asc' }, {}).map((a) => a.id)
  const desc = aplicarOrdemEFiltro(AREAS, { coluna: 'area_m2', dir: 'desc' }, {}).map((a) => a.id)
  assert.deepEqual(asc, ['a', 'b', 'c'])
  assert.deepEqual(desc, ['b', 'a', 'c'], 'o não informado não pode subir ao topo quando a ordem inverte')
})

test('periodicidade também é número — 7 antes de 30, nunca "30" antes de "7"', async () => {
  const { aplicarOrdemEFiltro } = await import('../maquinas/areas-tabela.js')
  const asc = aplicarOrdemEFiltro(AREAS, { coluna: 'periodicidade_dias', dir: 'asc' }, {}).map((a) => a.periodicidade_dias)
  assert.deepEqual(asc, [7, 30, null])
})

test('texto ordena em pt-BR — acento não joga a linha para o fim do alfabeto', async () => {
  const { aplicarOrdemEFiltro } = await import('../maquinas/areas-tabela.js')
  const asc = aplicarOrdemEFiltro(AREAS, { coluna: 'nome', dir: 'asc' }, {}).map((a) => a.nome)
  assert.deepEqual(asc, ['Ácer do pátio', 'Área Verde', 'Campo futebol'])
})

// ── 2. filtro ───────────────────────────────────────────────────────────
test('filtro é por trecho, sem acento e sem caixa, e os filtros se somam', async () => {
  const { aplicarOrdemEFiltro } = await import('../maquinas/areas-tabela.js')
  assert.deepEqual(aplicarOrdemEFiltro(AREAS, {}, { nome: 'AREA' }).map((a) => a.id), ['a'])
  assert.deepEqual(aplicarOrdemEFiltro(AREAS, {}, { nome: 'acer' }).map((a) => a.id), ['c'])
  assert.deepEqual(aplicarOrdemEFiltro(AREAS, {}, { tipo: 'corte', localizacao: 'fre' }).map((a) => a.id), ['b'])
  assert.deepEqual(aplicarOrdemEFiltro(AREAS, {}, { nome: 'não existe' }), [])
})

test('a zona cuja dimensão vem do contorno é encontrável por "mapa"', async () => {
  const { aplicarOrdemEFiltro, temContorno } = await import('../maquinas/areas-tabela.js')
  assert.equal(temContorno(AREAS[1]), true)
  assert.equal(temContorno(AREAS[0]), false)
  assert.equal(temContorno(null), false)
  assert.equal(temContorno({ geom: [[1, 2], [3, 4]] }), false, 'dois vértices não fecham polígono')
  assert.deepEqual(aplicarOrdemEFiltro(AREAS, {}, { area_m2: 'mapa' }).map((a) => a.id), ['b'])
})

test('metro quadrado é exibido sem casas decimais, como no /mapa', async () => {
  const { formatarArea } = await import('../maquinas/areas-tabela.js')
  assert.equal(formatarArea(5392.806), '5.393')
  assert.equal(formatarArea(1099.393), '1.099')
  assert.equal(formatarArea(0), '0', 'zero é informação, não ausência')
  assert.equal(formatarArea(null), '')
  assert.equal(formatarArea('abc'), '')
})

test('o tipo aparece traduzido, não cru — e o desconhecido não vira vazio', async () => {
  const { rotuloDoTipo } = await import('../maquinas/areas-tabela.js')
  assert.equal(rotuloDoTipo('corte'), 'Corte')
  assert.equal(rotuloDoTipo('mista'), 'Mista')
  assert.equal(rotuloDoTipo('tipo_novo'), 'tipo_novo')
  assert.equal(rotuloDoTipo(null), '')
})

// ── 3. o núcleo genérico continua genérico ──────────────────────────────
test('shared/tabela.js não conhece nenhum campo de área — quem adapta é o adaptador', () => {
  const nucleo = ler(NUCLEO)
  for (const campo of ['area_m2', 'periodicidade_dias', 'localizacao', 'maq_areas']) {
    assert.ok(!nucleo.includes(campo), `shared/tabela.js passou a citar ${campo}`)
  }
  assert.match(ler(TABELA_AREAS), /from '\.\.\/shared\/tabela\.js'/, 'o adaptador deveria usar o núcleo comum')
})

// ── 4. permissão: espelho da policy real, não preferência de tela ───────
test('a lista de cargos da tela é exatamente a da política de escrita de maq_areas (migração 12)', () => {
  const corpo = corpoDaFuncao(ler(APP), 'podeEditarAreas')
  const cargosTela = [...corpo.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort()
  const sql = ler(MIGRACAO_12)
  const inicio = sql.indexOf("policyname='maq_areas_insert'")
  assert.ok(inicio >= 0, 'policy maq_areas_insert não encontrada na migração 12')
  const cargosPolicy = sql
    .slice(inicio, inicio + 500)
    .match(/role in \(([^)]*)\)/)[1]
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean)
    .sort()
  assert.deepEqual(cargosTela, cargosPolicy, `tela (${cargosTela}) divergiu do banco (${cargosPolicy})`)
})

test('a permissão é conferida na abertura do formulário E na gravação, não só no botão', () => {
  const app = ler(APP)
  assert.match(corpoDaFuncao(app, 'abrirModalArea'), /podeEditarAreas\(\)/)
  assert.match(corpoDaFuncao(app, 'salvarArea'), /podeEditarAreas\(\)/)
})

// ── 5. edição ───────────────────────────────────────────────────────────
test('o mesmo formulário insere e atualiza, escolhido pelo id em edição', () => {
  const corpo = corpoDaFuncao(ler(APP), 'salvarArea')
  assert.match(corpo, /AREA_EDIT_ID\s*\n?\s*\?\s*await supa\.from\('maq_areas'\)\.update\(/, 'falta o ramo de atualização')
  assert.match(corpo, /: await supa\.from\('maq_areas'\)\.insert\(/, 'falta o ramo de inserção')
  assert.match(corpo, /\.eq\('id', AREA_EDIT_ID\)/, 'o update precisa ser escopado à linha em edição')
})

test('a dimensão derivada do contorno não é regravada pela tela', () => {
  const salvar = corpoDaFuncao(ler(APP), 'salvarArea')
  assert.match(
    salvar,
    /if\(!temContorno\(area\)\) dados\.area_m2/,
    'com contorno desenhado, area_m2 é recalculada pelo /mapa a cada gravação da geometria'
  )
  const abrir = corpoDaFuncao(ler(APP), 'abrirModalArea')
  assert.match(abrir, /campoM2\.disabled = derivada/, 'o campo deveria ficar travado quando o número é derivado')
})

// ── 6. o cabeçalho não é redesenhado a cada tecla ───────────────────────
test('digitar no filtro redesenha só o corpo — redesenhar o cabeçalho mataria o foco', () => {
  const app = ler(APP)
  const filtro = corpoDaFuncao(app, 'aplicarFiltroArea')
  assert.match(filtro, /renderLinhasAreas\(\)/)
  assert.doesNotMatch(filtro, /renderCabecalhoAreas\(\)|renderAreas\(\)/, 'só o corpo pode ser redesenhado ao digitar')
  assert.match(corpoDaFuncao(app, 'ordenarAreas'), /renderAreas\(\)/, 'ordenar redesenha os dois')
  assert.match(app, /function renderAreas\(\)/)
  assert.match(ler(INDEX_HTML), /id="th-areas"/, 'falta o contêiner do cabeçalho na marcação')
})

test('ordenar e filtrar são estado de tela — nenhuma consulta, nenhum carregarTudo', () => {
  const app = ler(APP)
  for (const nome of ['ordenarAreas', 'aplicarFiltroArea', 'filtrarColunaAreas', 'renderLinhasAreas', 'renderCabecalhoAreas']) {
    const corpo = corpoDaFuncao(app, nome)
    assert.doesNotMatch(corpo, /carregarTudo\(\)/, `${nome} não pode recarregar tudo`)
    assert.doesNotMatch(corpo, /supa\.from\(/, `${nome} não pode consultar o banco`)
  }
})
