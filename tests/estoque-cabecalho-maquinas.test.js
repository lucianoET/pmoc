const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate da aba Estoque do módulo Máquinas (quick-260818-twm).
//
// Duas frentes: (1) o cadastro completo do material deixa de ser uma
// afordância escondida no nome da linha e vira botão explícito, restrito a
// Direção e gestor (D1), sem tocar o botão ✎ de quantidade/mínimo/preço,
// que continua liberado aos três cargos que escrevem no módulo (D2); (2) o
// cabeçalho da tabela ganha ordenação e filtro por coluna, de tela (D3, D4).
// Este gate cresce em dois commits — os casos de D1/D2 nascem na Task 1, os
// de D3/D4 (e o núcleo puro maquinas/estoque-tabela.js) chegam na Task 2.
const RAIZ = path.join(__dirname, '..')
const APP = fs.readFileSync(path.join(RAIZ, 'maquinas', 'app.js'), 'utf8')
const HTML = fs.readFileSync(path.join(RAIZ, 'maquinas', 'index.html'), 'utf8')

// região de renderMateriais() — do início da função até o comentário de
// seção seguinte, onde o markup da linha do estoque é montado
const RENDER_MATERIAIS = APP.match(
  /function renderMateriais\(\)\{[\s\S]*?\n\}\n\n\/\/ ── valor da hora-homem/
)

// ── D1: podeEditarCadastro() ────────────────────────────────────────────
test('podeEditarCadastro() é declarado uma vez e devolve admin+gestor', () => {
  const ocorrencias = APP.match(/function podeEditarCadastro\(\)\{/g) || []
  assert.equal(ocorrencias.length, 1, 'podeEditarCadastro() deveria ser declarado uma única vez')
  const bloco = APP.match(/function podeEditarCadastro\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar podeEditarCadastro()')
  assert.match(bloco[1], /return \['admin','gestor'\]\.includes\(USUARIO\?\.role\)/)
})

test('a lista literal de cargos de cadastro não voltou a se espalhar pelos pontos de uso do material', () => {
  // os quatro pontos que D1 pede sob o mesmo helper: link do nome, botão
  // novo, guarda de salvarMaterial() e ficha-btn-cadastro — nenhum deles
  // pode repetir a lista ['admin','gestor'] escrita à mão
  const pontos = [
    /podeEditarCadastro\(\)\s*\n\s*\? `<a href="#" onclick="event\.preventDefault\(\);abrirModalMaterial/,
    /podeEditarCadastro\(\)\s*\n\s*\? `<button class="btn btn-s btn-sm" onclick="abrirModalMaterial/,
    /if\(MATERIAL_MODAL_ID && !podeEditarCadastro\(\)\)/,
    /btnCadastro\.style\.display = podeEditarCadastro\(\) \? '' : 'none'/,
  ]
  for (const padrao of pontos) {
    assert.match(APP, padrao, `ponto de uso não usa podeEditarCadastro(): ${padrao}`)
  }
  // nenhum desses quatro trechos, isolados, contém a lista literal — só o
  // corpo de podeEditarCadastro() a declara
  const semComentarios = APP.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  const literalFoco = semComentarios.match(/podeEditarCadastro\(\)\{\s*\n\s*return \['admin','gestor'\]/)
  assert.ok(literalFoco, "a lista literal só aparece dentro do corpo de podeEditarCadastro()")
})

test('podeEscreverNoModulo() continua com os três cargos, intocado', () => {
  assert.match(APP, /function podeEscreverNoModulo\(\)\{/)
  const bloco = APP.match(/function podeEscreverNoModulo\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /return \['admin','gestor','tecnico'\]\.includes\(USUARIO\?\.role\)/)
})

test('o botão ✎ da linha do estoque continua guardado por podeEscreverNoModulo(), byte-idêntico', () => {
  assert.ok(RENDER_MATERIAIS, 'renderMateriais() deveria existir')
  assert.match(RENDER_MATERIAIS[0],
    /podeEscreverNoModulo\(\)\s*\n\s*\? `<button class="btn btn-s btn-sm" onclick="editarMaterial\(\$\{m\.id\}\)" title="Editar quantidade, mínimo e preço">✎<\/button>`/,
    'o gate, o ícone e o texto do botão ✎ não podem mudar (D2)')
})

test('renderMateriais() chama abrirModalMaterial(${m.id}) duas vezes — nome e botão novo —, ambas sob podeEditarCadastro()', () => {
  assert.ok(RENDER_MATERIAIS, 'renderMateriais() deveria existir')
  const chamadas = RENDER_MATERIAIS[0].match(/abrirModalMaterial\(\$\{m\.id\}\)/g) || []
  assert.equal(chamadas.length, 2, 'esperava o link do nome e o botão ⚙, nada mais')
  // as duas ocorrências vivem sob o ternário de podeEditarCadastro() — testado
  // em detalhe no caso anterior de "não voltou a se espalhar"
  assert.match(RENDER_MATERIAIS[0], /podeEditarCadastro\(\)[\s\S]*abrirModalMaterial\(\$\{m\.id\}\)[\s\S]*podeEditarCadastro\(\)[\s\S]*abrirModalMaterial\(\$\{m\.id\}\)/)
})

test('o botão novo tem o ícone ⚙, title e aria-label em português', () => {
  assert.ok(RENDER_MATERIAIS, 'renderMateriais() deveria existir')
  assert.match(RENDER_MATERIAIS[0],
    /<button class="btn btn-s btn-sm" onclick="abrirModalMaterial\(\$\{m\.id\}\)" title="Editar cadastro do material" aria-label="Editar cadastro do material">⚙<\/button>/)
})

test('a ordem na linha é ✎ primeiro, ⚙ depois', () => {
  assert.ok(RENDER_MATERIAIS, 'renderMateriais() deveria existir')
  const posEditar = RENDER_MATERIAIS[0].indexOf('editarMaterial(${m.id})" title="Editar quantidade')
  const posCadastro = RENDER_MATERIAIS[0].indexOf('abrirModalMaterial(${m.id})" title="Editar cadastro do material"')
  assert.ok(posEditar > -1 && posCadastro > -1)
  assert.ok(posEditar < posCadastro, '✎ (ação do dia a dia) vem antes de ⚙ (cadastro)')
})

test('salvarMaterial() recusa edição de material existente para quem não edita cadastro, mas não bloqueia criação', () => {
  const bloco = APP.match(/async function salvarMaterial\(\)\{([\s\S]*?)\n\}\n\n\/\/ ── MODAL MOVIMENTO/)
  assert.ok(bloco, 'salvarMaterial() deveria existir')
  assert.match(bloco[1],
    /if\(MATERIAL_MODAL_ID && !podeEditarCadastro\(\)\)\{ alert\('Seu cargo não altera o cadastro do material\.'\); return \}/,
    'a guarda precisa ser condicionada a MATERIAL_MODAL_ID — só o ramo de edição')
  // a guarda é a primeira linha de código do corpo (fora do comentário que a
  // antecede) — criar material novo (MATERIAL_MODAL_ID nulo) nunca entra nela
  const primeiraLinhaDeCodigo = bloco[1].split('\n').map(l => l.trim()).find(l => l && !l.startsWith('//'))
  assert.match(primeiraLinhaDeCodigo, /^if\(MATERIAL_MODAL_ID && !podeEditarCadastro\(\)\)/)
})

test('ficha-btn-cadastro usa podeEditarCadastro()', () => {
  assert.match(HTML, /id="ficha-btn-cadastro"/)
  assert.match(APP, /btnCadastro\.style\.display = podeEditarCadastro\(\) \? '' : 'none'/)
})

// ── D3/D4: núcleo puro maquinas/estoque-tabela.js ──────────────────────────
const {
  COLUNAS_ESTOQUE, proximaOrdem, normalizarBusca, compararMateriais, aplicarOrdemEFiltro,
} = require('../maquinas/estoque-tabela.js')

test('COLUNAS_ESTOQUE tem nove colunas na ordem do markup, três numéricas', () => {
  assert.equal(COLUNAS_ESTOQUE.length, 9)
  assert.deepEqual(COLUNAS_ESTOQUE.map(c => c.id), [
    'codigo', 'nome', 'tipo', 'sistema', 'aplicacao',
    'estoque_atual', 'estoque_minimo', 'preco', 'status',
  ])
  const numericas = COLUNAS_ESTOQUE.filter(c => c.tipo === 'numero').map(c => c.id)
  assert.deepEqual(numericas.sort(), ['estoque_atual', 'estoque_minimo', 'preco'])
})

test('proximaOrdem cicla null → asc → desc → null', () => {
  assert.equal(proximaOrdem(null), 'asc')
  assert.equal(proximaOrdem('asc'), 'desc')
  assert.equal(proximaOrdem('desc'), null)
})

test('normalizarBusca derruba acento e caixa — "Óleo" casa com "oleo"', () => {
  assert.equal(normalizarBusca('Óleo'), normalizarBusca('oleo'))
  assert.equal(normalizarBusca('ÓLEO'), 'oleo')
  assert.equal(normalizarBusca(null), '')
  assert.equal(normalizarBusca(undefined), '')
  assert.equal(normalizarBusca(10), '10')
})

const MAT_A = { id: 1, codigo: 'A', nome: 'Zebra', tipo: 'consumivel', sistema: 'Motor', aplicacao: 'Vários', estoque_atual: 10, estoque_minimo: 2, unidade: 'un', preco: 5 }
const MAT_B = { id: 2, codigo: 'B', nome: 'Abelha', tipo: 'peca', sistema: '', aplicacao: '', estoque_atual: 9, estoque_minimo: 20, unidade: 'un', preco: null }
const MAT_C = { id: 3, codigo: 'C', nome: 'Óleo hidráulico', tipo: 'peca', sistema: 'Hidráulico', aplicacao: '', estoque_atual: 100, estoque_minimo: 2, unidade: 'L', preco: 30 }
const LISTA = [MAT_A, MAT_B, MAT_C]

test('ordenação numérica ordena por número, não por string (10 depois de 9)', () => {
  const asc = aplicarOrdemEFiltro(LISTA, { coluna: 'estoque_atual', dir: 'asc' }, {}).map(m => m.codigo)
  assert.deepEqual(asc, ['B', 'A', 'C'], '9, 10, 100 em ordem numérica — string ordenaria 10 antes de 9')
  const desc = aplicarOrdemEFiltro(LISTA, { coluna: 'estoque_atual', dir: 'desc' }, {}).map(m => m.codigo)
  assert.deepEqual(desc, ['C', 'A', 'B'])
})

test('ordenação textual usa pt-BR e vazio/nulo fica no fim nas duas direções', () => {
  const asc = aplicarOrdemEFiltro(LISTA, { coluna: 'sistema', dir: 'asc' }, {}).map(m => m.codigo)
  assert.deepEqual(asc, ['C', 'A', 'B'], 'Hidráulico, Motor, vazio — vazio sempre por último')
  const desc = aplicarOrdemEFiltro(LISTA, { coluna: 'sistema', dir: 'desc' }, {}).map(m => m.codigo)
  assert.deepEqual(desc, ['A', 'C', 'B'], 'Motor, Hidráulico, vazio — vazio continua por último mesmo decrescente')
})

test('preço nulo (não informado) fica no fim nas duas direções — não é zero', () => {
  const asc = aplicarOrdemEFiltro(LISTA, { coluna: 'preco', dir: 'asc' }, {}).map(m => m.codigo)
  assert.deepEqual(asc, ['A', 'C', 'B'])
  const desc = aplicarOrdemEFiltro(LISTA, { coluna: 'preco', dir: 'desc' }, {}).map(m => m.codigo)
  assert.deepEqual(desc, ['C', 'A', 'B'])
})

test('filtro é substring sobre o texto exibido, sem acento e sem caixa, e filtros de colunas diferentes se acumulam', () => {
  const porNome = aplicarOrdemEFiltro(LISTA, null, { nome: 'oleo' }).map(m => m.codigo)
  assert.deepEqual(porNome, ['C'], '"Óleo hidráulico" casa com "oleo" sem acento')
  const semOrdem = aplicarOrdemEFiltro(LISTA, null, {}).map(m => m.codigo)
  assert.deepEqual(semOrdem, ['A', 'B', 'C'], 'sem ord.coluna devolve a ordem de entrada')
  // dois filtros em conjunção: só C casa em sistema E nome ao mesmo tempo
  const doisFiltros = aplicarOrdemEFiltro(LISTA, null, { sistema: 'hidraul', nome: 'oleo' }).map(m => m.codigo)
  assert.deepEqual(doisFiltros, ['C'])
  const doisFiltrosSemCasar = aplicarOrdemEFiltro(LISTA, null, { sistema: 'motor', nome: 'oleo' }).map(m => m.codigo)
  assert.deepEqual(doisFiltrosSemCasar, [], 'sistema=motor e nome=oleo não casam na mesma linha')
})

test('compararMateriais devolve 0 para coluna desconhecida', () => {
  assert.equal(compararMateriais(MAT_A, MAT_B, 'coluna-que-nao-existe', 'asc'), 0)
})

// ── D3/D4: fiação em maquinas/app.js e maquinas/index.html ─────────────────
test('o thead do estoque é o id="th-materiais", não mais markup estático de nove <th>', () => {
  assert.match(HTML, /<thead id="th-materiais"><\/thead>/)
  assert.doesNotMatch(HTML,
    /<thead><tr>\s*<th>Código<\/th><th>Nome<\/th><th>Tipo<\/th><th>Sistema<\/th>/,
    'o cabeçalho estático de nove colunas não pode voltar — quem desenha agora é renderCabecalhoMateriais()')
})

test('MAT_ORD e MAT_FILTROS são declarados em maquinas/app.js', () => {
  assert.match(APP, /let MAT_ORD = \{ coluna: null, dir: null \}/)
  assert.match(APP, /let MAT_FILTROS = \{\}/)
  assert.match(APP, /let MAT_FILTROS_ABERTO = false/)
})

test('as quatro funções de interação estão publicadas em exporNoWindow()', () => {
  const bloco = APP.match(/function exporNoWindow\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'exporNoWindow() deveria existir')
  for (const nome of ['ordenarMateriais', 'filtrarColunaMateriais', 'aplicarFiltroMaterial', 'limparFiltrosMateriais']) {
    assert.match(bloco[1], new RegExp(`\\b${nome}\\b`), `${nome} deveria estar publicada em exporNoWindow()`)
  }
})

test('ordenar e filtrar não tocam o Supabase — nenhuma das quatro chama carregarTudo() nem supa.from(', () => {
  for (const nome of ['ordenarMateriais', 'filtrarColunaMateriais', 'aplicarFiltroMaterial', 'limparFiltrosMateriais']) {
    const bloco = APP.match(new RegExp(`function ${nome}\\([^)]*\\)\\{([\\s\\S]*?)\\n\\}`))
    assert.ok(bloco, `${nome} deveria existir`)
    assert.doesNotMatch(bloco[1], /carregarTudo\(\)/, `${nome} não pode chamar carregarTudo()`)
    assert.doesNotMatch(bloco[1], /supa\.from\(/, `${nome} não pode consultar o Supabase`)
  }
})

test('renderLinhasMateriais() contém a guarda de MATERIAL_EDIT_ID contra a lista visível (D4)', () => {
  const bloco = APP.match(/function renderLinhasMateriais\(\)\{([\s\S]*?)\n\}\n\n\/\/ mostra "N de total"/)
  assert.ok(bloco, 'renderLinhasMateriais() deveria existir')
  assert.match(bloco[1],
    /if\(MATERIAL_EDIT_ID !== null && !visiveis\.some\(m => m\.id === MATERIAL_EDIT_ID\)\)\{\s*\n\s*MATERIAL_EDIT_ID = null/,
    'se a linha em edição saiu do filtro, a edição é cancelada em vez de sumir com os campos preenchidos')
})

test('editarMaterial() limpa filtro e ordem quando o material pedido está fora da lista visível (D4, caminho do painel)', () => {
  const bloco = APP.match(/function editarMaterial\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'editarMaterial() deveria existir')
  assert.match(bloco[1], /aplicarOrdemEFiltro\(MATERIAIS, MAT_ORD, MAT_FILTROS\)/)
  assert.match(bloco[1], /MAT_FILTROS = \{\}/)
  assert.match(bloco[1], /MAT_ORD = \{ coluna: null, dir: null \}/)
})

test('aria-sort é escrito pelo cabeçalho, um valor fechado por estado', () => {
  assert.match(APP, /const ariaSort = dir === 'asc' \? 'ascending' : dir === 'desc' \? 'descending' : 'none'/)
  assert.match(APP, /<th aria-sort="\$\{ariaSort\}">/)
})

test('renderCabecalhoMateriais() escreve um botão de ordenação e um de filtro por coluna, com título em português', () => {
  const bloco = APP.match(/function renderCabecalhoMateriais\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'renderCabecalhoMateriais() deveria existir')
  assert.match(bloco[1], /onclick="ordenarMateriais\('\$\{col\.id\}'\)"/)
  assert.match(bloco[1], /onclick="filtrarColunaMateriais\('\$\{col\.id\}'\)"/)
  assert.match(bloco[1], /class="th-acao\$\{filtroAtivo\?' ativo':''\}"/,
    'o botão de filtro precisa de classe de estado ativo quando a coluna tem filtro preenchido')
})

test('CSS novo de cabeçalho segue .btn-tema como precedente de botão-ícone pequeno', () => {
  assert.match(HTML, /\.th-acao\{[^}]*cursor:pointer/)
  assert.match(HTML, /\.th-acao\.ativo\{color:var\(--accent-texto\)\}/)
})
