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
