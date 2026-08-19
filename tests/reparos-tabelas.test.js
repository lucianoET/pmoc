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
test('renderReparos() escreve o ⚙ sob podeConhecimento() e interrompe a propagação do clique da linha', () => {
  const bloco = APP.match(/function renderReparos\(\)\{([\s\S]*?)\n\}\n/)
  assert.ok(bloco, 'renderReparos() deveria existir')
  assert.match(bloco[1], /onclick="abrirModalVinculo\(\$\{r\.id\}\)"/, 'a linha inteira continua abrindo o modal de peças e serviços')
  assert.match(bloco[1],
    /podeConhecimento\(\)\s*\n\s*\? `<button class="btn btn-s btn-sm" onclick="event\.stopPropagation\(\);abrirModalReparo\(\$\{r\.id\}\)" title="Editar cadastro do reparo" aria-label="Editar cadastro do reparo">⚙<\/button>`/,
    'o ⚙ de Reparos precisa interromper a propagação antes de chamar abrirModalReparo')
})

test('renderServicos() escreve o ⚙ sob podeCatalogo()', () => {
  const bloco = APP.match(/function renderServicos\(\)\{([\s\S]*?)\n\}\n/)
  assert.ok(bloco, 'renderServicos() deveria existir')
  assert.match(bloco[1],
    /podeCatalogo\(\)\s*\n\s*\? `<button class="btn btn-s btn-sm" onclick="abrirModalServico\(\$\{s\.id\}\)" title="Editar cadastro do serviço" aria-label="Editar cadastro do serviço">⚙<\/button>`/)
})

test('renderModelos() escreve o ⚙ sob podeCatalogo()', () => {
  const bloco = APP.match(/function renderModelos\(\)\{([\s\S]*?)\n\}\n/)
  assert.ok(bloco, 'renderModelos() deveria existir')
  assert.match(bloco[1],
    /podeCatalogo\(\)\s*\n\s*\? `<button class="btn btn-s btn-sm" onclick="abrirModalModelo\(\$\{m\.id\}\)" title="Editar cadastro do modelo" aria-label="Editar cadastro do modelo">⚙<\/button>`/)
})

test('as três tabelas ganharam uma coluna final de ações e os colspans das mensagens de carga foram ajustados', () => {
  assert.match(HTML, /<th>Peças \/ serviços<\/th><th><\/th>/)
  assert.match(HTML, /id="tb-reparos"><tr><td colspan="9"/)
  assert.match(HTML, /<th>Usado em<\/th><th><\/th>/)
  assert.match(HTML, /id="tb-servicos"><tr><td colspan="7"/)
  assert.match(HTML, /<th>Reparos<\/th><th><\/th>/)
  assert.match(HTML, /id="tb-modelos"><tr><td colspan="8"/)
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
