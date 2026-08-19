const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate das três frentes do módulo /reparos (quick-260818-vtm): edição de
// cadastro pelos modais já existentes (D1), ordenação e filtro por coluna
// com colunas densas (D2, D3) e filtro/agrupamento por tipo de máquina
// (D4). Cresce em três commits — os casos de D1 nascem na Task 1, os de
// D2/D3 chegam na Task 2, os de D4 na Task 3.
const RAIZ = path.join(__dirname, '..')
const APP = fs.readFileSync(path.join(RAIZ, 'reparos', 'app.js'), 'utf8')
const HTML = fs.readFileSync(path.join(RAIZ, 'reparos', 'index.html'), 'utf8')

// ── D1: os três estados de edição ───────────────────────────────────────
test('REPARO_EDIT_ID, SERVICO_EDIT_ID e MODELO_EDIT_ID nascem nulos', () => {
  assert.match(APP, /let REPARO_EDIT_ID = null/)
  assert.match(APP, /let SERVICO_EDIT_ID = null/)
  assert.match(APP, /let MODELO_EDIT_ID = null/)
})

test('os três abrirModal*(id) aceitam id opcional e escrevem título de criação ou edição', () => {
  const casos = [
    { fn: 'abrirModalReparo', edit: 'REPARO_EDIT_ID', lista: 'REPAROS', titulo: 'modal-reparo-titulo', criar: 'Novo reparo', editar: 'Editar reparo' },
    { fn: 'abrirModalServico', edit: 'SERVICO_EDIT_ID', lista: 'SERVICOS', titulo: 'modal-servico-titulo', criar: 'Novo serviço', editar: 'Editar serviço' },
    { fn: 'abrirModalModelo', edit: 'MODELO_EDIT_ID', lista: 'MODELOS', titulo: 'modal-modelo-titulo', criar: 'Novo modelo', editar: 'Editar modelo' },
  ]
  for (const c of casos) {
    const bloco = APP.match(new RegExp(`function ${c.fn}\\(id\\)\\{([\\s\\S]*?)\\n\\}\\n`))
    assert.ok(bloco, `${c.fn}(id) deveria existir com o parâmetro id`)
    assert.match(bloco[1], new RegExp(`${c.edit} = id \\|\\| null`), `${c.fn} deveria atribuir ${c.edit} a partir do argumento`)
    assert.match(bloco[1], new RegExp(`${c.lista}\\.find\\(x => x\\.id === ${c.edit}\\)`), `${c.fn} deveria buscar o registro em ${c.lista}`)
    assert.match(bloco[1], new RegExp(`getElementById\\('${c.titulo}'\\)\\.textContent = `), `${c.fn} deveria escrever o título em #${c.titulo}`)
    assert.ok(bloco[1].includes(c.criar), `${c.fn} deveria ter o texto "${c.criar}"`)
    assert.ok(bloco[1].includes(c.editar), `${c.fn} deveria ter o texto "${c.editar}"`)
  }
})

test('os três títulos de modal existem no markup com o id que os abridores escrevem', () => {
  assert.match(HTML, /<h3 id="modal-reparo-titulo">/)
  assert.match(HTML, /<h3 id="modal-servico-titulo">/)
  assert.match(HTML, /<h3 id="modal-modelo-titulo">/)
})

test('os três salvar*() recusam a operação quando o cargo não passa no gate da tabela, antes de montar o payload', () => {
  const casos = [
    { fn: 'salvarReparo', gate: 'podeConhecimento', msg: 'Seu cargo não altera o cadastro de reparos.' },
    { fn: 'salvarServico', gate: 'podeCatalogo', msg: 'Seu cargo não altera o cadastro de serviços.' },
    { fn: 'salvarModelo', gate: 'podeCatalogo', msg: 'Seu cargo não altera o cadastro de modelos.' },
  ]
  for (const c of casos) {
    const bloco = APP.match(new RegExp(`async function ${c.fn}\\(\\)\\{([\\s\\S]*?)\\n\\}\\n`))
    assert.ok(bloco, `${c.fn}() deveria existir`)
    const primeiraLinhaDeCodigo = bloco[1].split('\n').map(l => l.trim()).find(l => l && !l.startsWith('//'))
    assert.match(primeiraLinhaDeCodigo, new RegExp(`^if\\(!${c.gate}\\(\\)\\)`), `${c.fn} deveria testar ${c.gate}() na primeira linha de código`)
    assert.ok(bloco[1].includes(c.msg), `${c.fn} deveria alertar "${c.msg}"`)
  }
})

test('os três salvar*() fazem update filtrado pelo id em edição quando há um, e insert quando não há', () => {
  const casos = [
    { fn: 'salvarReparo', edit: 'REPARO_EDIT_ID', tabela: 'rep_reparos' },
    { fn: 'salvarServico', edit: 'SERVICO_EDIT_ID', tabela: 'rep_servicos' },
    { fn: 'salvarModelo', edit: 'MODELO_EDIT_ID', tabela: 'rep_modelos' },
  ]
  for (const c of casos) {
    const bloco = APP.match(new RegExp(`async function ${c.fn}\\(\\)\\{([\\s\\S]*?)\\n\\}\\n`))
    assert.ok(bloco, `${c.fn}() deveria existir`)
    assert.match(bloco[1], new RegExp(`\\{ error \\} = ${c.edit}\\s*\\n\\s*\\? await supa\\.from\\('${c.tabela}'\\)\\.update\\(campos\\)\\.eq\\('id', ${c.edit}\\)\\s*\\n\\s*: await supa\\.from\\('${c.tabela}'\\)\\.insert\\(campos\\)`),
      `${c.fn} deveria alternar entre update(campos).eq('id', ${c.edit}) e insert(campos)`)
  }
})

test('fecharModal() zera o id de edição do modal correspondente', () => {
  const bloco = APP.match(/function fecharModal\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'fecharModal() deveria existir')
  assert.match(bloco[1], /if\(id === 'modal-reparo'\) REPARO_EDIT_ID = null/)
  assert.match(bloco[1], /if\(id === 'modal-servico'\) SERVICO_EDIT_ID = null/)
  assert.match(bloco[1], /if\(id === 'modal-modelo'\) MODELO_EDIT_ID = null/)
})

// ── D1: o ⚙ de cada linha, sob o gate correto ───────────────────────────
// A partir da Task 2, renderReparos()/renderServicos()/renderModelos() só
// delegam para o par cabeçalho/corpo (D2) — o ⚙ de cada linha passa a
// viver em renderLinhas*(), não mais na função de entrada.
test('renderLinhasReparos() escreve o ⚙ sob podeConhecimento() e interrompe a propagação do clique da linha', () => {
  const bloco = APP.match(/function renderLinhasReparos\(\)\{([\s\S]*?)\n\}\n/)
  assert.ok(bloco, 'renderLinhasReparos() deveria existir')
  assert.match(bloco[1], /onclick="abrirModalVinculo\(\$\{r\.id\}\)"/, 'a linha inteira continua abrindo o modal de peças e serviços')
  assert.match(bloco[1],
    /podeConhecimento\(\)\s*\n\s*\? `<button class="btn btn-s btn-sm" onclick="event\.stopPropagation\(\);abrirModalReparo\(\$\{r\.id\}\)" title="Editar cadastro do reparo" aria-label="Editar cadastro do reparo">⚙<\/button>`/,
    'o ⚙ de Reparos precisa interromper a propagação antes de chamar abrirModalReparo')
})

test('renderLinhasServicos() escreve o ⚙ sob podeCatalogo()', () => {
  const bloco = APP.match(/function renderLinhasServicos\(\)\{([\s\S]*?)\n\}\n/)
  assert.ok(bloco, 'renderLinhasServicos() deveria existir')
  assert.match(bloco[1],
    /podeCatalogo\(\)\s*\n\s*\? `<button class="btn btn-s btn-sm" onclick="abrirModalServico\(\$\{s\.id\}\)" title="Editar cadastro do serviço" aria-label="Editar cadastro do serviço">⚙<\/button>`/)
})

test('renderLinhasModelos() escreve o ⚙ sob podeCatalogo()', () => {
  const bloco = APP.match(/function renderLinhasModelos\(\)\{([\s\S]*?)\n\}\n/)
  assert.ok(bloco, 'renderLinhasModelos() deveria existir')
  assert.match(bloco[1],
    /podeCatalogo\(\)\s*\n\s*\? `<button class="btn btn-s btn-sm" onclick="abrirModalModelo\(\$\{m\.id\}\)" title="Editar cadastro do modelo" aria-label="Editar cadastro do modelo">⚙<\/button>`/)
})

test('todo nome novo chamado por handler inline no markup de reparos está em exporNoWindow()', () => {
  const bloco = APP.match(/Object\.assign\(window,\s*\{([\s\S]*?)\}\)/)
  assert.ok(bloco, 'exporNoWindow() deveria existir')
  const publicados = new Set(bloco[1].split(',').map(s => s.trim()).filter(Boolean))
  const usados = new Set()
  for (const m of HTML.matchAll(/\son[a-z]+="([A-Za-z_$][\w$]*)\(/g)) usados.add(m[1])
  for (const nome of usados) {
    assert.ok(publicados.has(nome), `${nome}() é chamado no markup mas não está em exporNoWindow()`)
  }
})

// ── D2/D3: núcleo puro de reparos/tabelas.js ────────────────────────────
const {
  COLUNAS_REPAROS, linhasReparos,
  COLUNAS_SERVICOS, linhasServicos,
  COLUNAS_MODELOS, linhasModelos,
} = require('../reparos/tabelas.js')
const { aplicarOrdemEFiltro } = require('../shared/tabela.js')

test('importar reparos/tabelas.js em Node puro não lança', () => {
  assert.ok(linhasReparos); assert.ok(linhasServicos); assert.ok(linhasModelos)
})

test('COLUNAS_REPAROS tem 5 colunas, COLUNAS_SERVICOS 4, COLUNAS_MODELOS 4', () => {
  assert.equal(COLUNAS_REPAROS.length, 5)
  assert.equal(COLUNAS_SERVICOS.length, 4)
  assert.equal(COLUNAS_MODELOS.length, 4)
})

const MODELOS_T = [{ id: 1, fabricante: 'Husqvarna', modelo: 'TS114', categoria: 'trator', motor: 'HS452AE' }]
const REPAROS_T = [
  { id: 1, codigo: 'RP1', modelo_id: 1, sistema: 'motor', sintoma: 'Não liga', causa_provavel: 'Vela suja', gravidade: 'alta', frequencia: 3 },
  { id: 2, codigo: 'RP2', modelo_id: null, sistema: 'corte', sintoma: 'Corte irregular', causa_provavel: 'Lâmina cega', gravidade: 'baixa', frequencia: 0 },
]
const REP_MATS_T = [{ id: 1, reparo_id: 1, material_id: 9 }]
const REP_SERVS_T = [{ id: 1, reparo_id: 1, servico_id: 5 }, { id: 2, reparo_id: 1, servico_id: 6 }]

test('reparo sem modelo mostra "qualquer modelo"; com modelo, carrega fabricante e modelo no texto da coluna código (D3)', () => {
  const linhas = linhasReparos(REPAROS_T, MODELOS_T, REP_MATS_T, REP_SERVS_T)
  const semModelo = linhas.find(l => l.registro.id === 2)
  assert.equal(semModelo.modeloTexto, 'qualquer modelo')
  const comModelo = linhas.find(l => l.registro.id === 1)
  const col = COLUNAS_REPAROS.find(c => c.id === 'codigo')
  assert.match(col.texto(comModelo), /Husqvarna/, 'filtrar por fabricante precisa achar a linha pela coluna código')
})

test('causa provável, gravidade, peças e serviços continuam alcançáveis pelo filtro da coluna que os contém (D3)', () => {
  const linhas = linhasReparos(REPAROS_T, MODELOS_T, REP_MATS_T, REP_SERVS_T)
  const l = linhas.find(x => x.registro.id === 1)
  assert.match(COLUNAS_REPAROS.find(c => c.id === 'sintoma').texto(l), /Vela suja/)
  assert.match(COLUNAS_REPAROS.find(c => c.id === 'sistema_gravidade').texto(l), /alta/)
  assert.equal(l.pecas, 1)
  assert.equal(l.servicos, 2)
  assert.match(COLUNAS_REPAROS.find(c => c.id === 'pecas_servicos').texto(l), /1 peças 2 serviços/)
})

test('ordenação numérica por confirmações (frequência), textual por código em pt-BR', () => {
  const linhas = linhasReparos(REPAROS_T, MODELOS_T, REP_MATS_T, REP_SERVS_T)
  const ascConf = aplicarOrdemEFiltro(linhas, { coluna: 'confirmacoes', dir: 'asc' }, {}, COLUNAS_REPAROS).map(l => l.registro.id)
  assert.deepEqual(ascConf, [2, 1])

  const linhasTexto = linhasReparos(
    [{ id: 1, codigo: 'Zebra', modelo_id: null, sistema: 'motor', sintoma: 's', causa_provavel: 'c', gravidade: 'baixa', frequencia: 0 },
     { id: 2, codigo: 'Abelha', modelo_id: null, sistema: 'motor', sintoma: 's', causa_provavel: 'c', gravidade: 'baixa', frequencia: 0 }],
    [], [], [])
  const ascCod = aplicarOrdemEFiltro(linhasTexto, { coluna: 'codigo', dir: 'asc' }, {}, COLUNAS_REPAROS).map(l => l.registro.codigo)
  assert.deepEqual(ascCod, ['Abelha', 'Zebra'])
})

test('filtros de colunas diferentes se acumulam nas linhas de Reparos, sem acento e sem caixa', () => {
  const linhas = linhasReparos(REPAROS_T, MODELOS_T, REP_MATS_T, REP_SERVS_T)
  const resultado = aplicarOrdemEFiltro(linhas, null, { codigo: 'husqvarna', sintoma: 'nao liga' }, COLUNAS_REPAROS).map(l => l.registro.id)
  assert.deepEqual(resultado, [1])
})

const SERVICOS_T = [
  { id: 1, codigo: 'SVA', nome: 'Trocar vela', especialidade: 'mecanica', tempo_padrao_h: 1, valor_hora: 50 },
  { id: 2, codigo: 'SVB', nome: 'Sem tempo definido', especialidade: 'mecanica', tempo_padrao_h: null, valor_hora: null },
  { id: 3, codigo: 'SVC', nome: 'Ajuste rápido', especialidade: 'mecanica', tempo_padrao_h: 0.5, valor_hora: 80 },
]
const REP_SERVS_T2 = [{ id: 1, reparo_id: 1, servico_id: 1 }, { id: 2, reparo_id: 2, servico_id: 1 }]

test('serviço: usado em conta os vínculos, e valor-hora fica alcançável pelo filtro da coluna tempo/valor-hora (D3)', () => {
  const linhas = linhasServicos(SERVICOS_T, REP_SERVS_T2)
  const l1 = linhas.find(l => l.registro.id === 1)
  assert.equal(l1.usos, 2)
  assert.match(COLUNAS_SERVICOS.find(c => c.id === 'tempo_valor').texto(l1), /80,00|50,00/)
})

test('serviço sem tempo padrão fica no fim da ordenação numérica, nas duas direções', () => {
  const linhas = linhasServicos(SERVICOS_T, [])
  const asc = aplicarOrdemEFiltro(linhas, { coluna: 'tempo_valor', dir: 'asc' }, {}, COLUNAS_SERVICOS).map(l => l.registro.id)
  assert.deepEqual(asc, [3, 1, 2])
  const desc = aplicarOrdemEFiltro(linhas, { coluna: 'tempo_valor', dir: 'desc' }, {}, COLUNAS_SERVICOS).map(l => l.registro.id)
  assert.deepEqual(desc, [1, 3, 2])
})

const ATIVOS_T = [{ id: 1, modelo_id: 1 }, { id: 2, modelo_id: 1 }, { id: 3, modelo_id: 2 }]

test('modelo: contagem de máquinas e de reparos corretas, ambas alcançáveis pelo filtro da coluna que as contém', () => {
  const linhas = linhasModelos(MODELOS_T, ATIVOS_T, REPAROS_T)
  const l = linhas[0]
  assert.equal(l.maquinas, 2)
  assert.equal(l.reparos, 1)
  assert.match(COLUNAS_MODELOS.find(c => c.id === 'maquinas_reparos').texto(l), /2 máquinas 1 reparos/)
})

// ── D2: fiação em reparos/app.js e reparos/index.html ───────────────────
test('os três theads existem por id, vazios no markup — quem desenha é renderCabecalho*()', () => {
  assert.match(HTML, /<thead id="th-reparos"><\/thead>/)
  assert.match(HTML, /<thead id="th-servicos"><\/thead>/)
  assert.match(HTML, /<thead id="th-modelos"><\/thead>/)
  assert.doesNotMatch(HTML, /<th>Peças \/ serviços<\/th>/, 'o cabeçalho estático não pode voltar — quem desenha agora é renderCabecalhoReparos()')
})

test('colspans das mensagens de tabela refletem 5, 4 e 4 colunas mais ações', () => {
  assert.match(HTML, /id="tb-reparos"><tr><td colspan="6"/)
  assert.match(HTML, /id="tb-servicos"><tr><td colspan="5"/)
  assert.match(HTML, /id="tb-modelos"><tr><td colspan="5"/)
})

test('as três tabelas se separam em par cabeçalho/corpo, como renderMateriais() em maquinas/app.js', () => {
  for (const nome of ['Reparos', 'Servicos', 'Modelos']) {
    assert.match(APP, new RegExp(`function render${nome}\\(\\)\\{\\s*\\n\\s*renderCabecalho${nome}\\(\\)\\s*\\n\\s*renderLinhas${nome}\\(\\)\\s*\\n\\}`),
      `render${nome}() deveria só delegar para renderCabecalho${nome}() e renderLinhas${nome}()`)
  }
})

test('digitar num filtro chama só a função de corpo — não reescreve o cabeçalho e não perde foco/cursor', () => {
  const bloco = APP.match(/function aplicarFiltroTabelaReparos\(tabela, coluna, valor\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'aplicarFiltroTabelaReparos() deveria existir')
  assert.match(bloco[1], /t\.renderCorpo\(\)/)
  assert.doesNotMatch(bloco[1], /t\.render\(\)/)
})

test('as quatro funções de ordenação/filtro não tocam o Supabase nem chamam carregarTudo()', () => {
  for (const nome of ['ordenarTabelaReparos', 'filtrarColunaTabelaReparos', 'aplicarFiltroTabelaReparos', 'limparFiltrosTabelaReparos']) {
    const bloco = APP.match(new RegExp(`function ${nome}\\([^)]*\\)\\{([\\s\\S]*?)\\n\\}`))
    assert.ok(bloco, `${nome} deveria existir`)
    assert.doesNotMatch(bloco[1], /carregarTudo\(\)/, `${nome} não pode chamar carregarTudo()`)
    assert.doesNotMatch(bloco[1], /supa\.from\(/, `${nome} não pode consultar o Supabase`)
  }
})

test('as quatro funções de ordenação/filtro estão publicadas em exporNoWindow()', () => {
  const bloco = APP.match(/function exporNoWindow\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'exporNoWindow() deveria existir')
  for (const nome of ['ordenarTabelaReparos', 'filtrarColunaTabelaReparos', 'aplicarFiltroTabelaReparos', 'limparFiltrosTabelaReparos']) {
    assert.match(bloco[1], new RegExp(`\\b${nome}\\b`), `${nome} deveria estar publicada em exporNoWindow()`)
  }
})

test('CSS compacto vive no <style> do módulo, shared/pmoc.css não foi tocado', () => {
  assert.match(HTML, /\.th-rotulo\{/)
  assert.match(HTML, /\.th-acao\{[^}]*cursor:pointer/)
  assert.match(HTML, /\.th-acao\.ativo\{color:var\(--accent-texto\)\}/)
  assert.match(HTML, /\.cel-sub\{/)
  const pmocCss = fs.readFileSync(path.join(RAIZ, 'shared', 'pmoc.css'), 'utf8')
  assert.doesNotMatch(pmocCss, /\.cel-sub/, 'shared/pmoc.css é consumida por seis módulos — o CSS compacto de reparos não pode ir para lá')
  assert.doesNotMatch(pmocCss, /\.th-rotulo/, 'shared/pmoc.css não pode ganhar as classes de cabeçalho ordenável — isso é escopo de módulo')
})
