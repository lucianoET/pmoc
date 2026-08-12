const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Este arquivo é o gate estático das duas metades de destino de PLAT-14
// (plano 10-03). O que ele PROVA: os dois arquivos de destino
// (maquinas/app.js e shared/modulo-manutencao.js) leem o parâmetro de
// busca `ativo` da URL, validam a forma do identificador antes de
// qualquer uso, esperam a primeira carga de dados terminar antes de abrir
// a ficha, e não vazam a função nova para o escopo global.
//
// O que ele NÃO prova: sem navegador e sem credenciais, não dá para
// clicar num balão do mapa e ver a ficha abrir de fato — essa prova de
// ponta a ponta fica no roteiro manual da fase (TESTES.md), registrada
// como pendência nomeada, não como item concluído aqui.
const RAIZ = path.join(__dirname, '..')
const MAQUINAS_APP = path.join(RAIZ, 'maquinas', 'app.js')
const MODULO_MANUTENCAO = path.join(RAIZ, 'shared', 'modulo-manutencao.js')

const ARQUIVOS_DESTINO = [
  { nome: 'maquinas/app.js', caminho: MAQUINAS_APP },
  { nome: 'shared/modulo-manutencao.js', caminho: MODULO_MANUTENCAO },
]

const conteudoDe = (caminho) => fs.readFileSync(caminho, 'utf8')

// A chave de parâmetro correta não é repetida à mão neste teste — ela vem
// do próprio linkDoModulo() de mapa/mapa-geometria.js (plano 10-02, mesma
// onda), a função que a metade de ORIGEM do link (plano 10-05) vai usar
// para montar a rota. mapa-geometria.js não exporta uma constante isolada
// só com o nome da chave — a chave está embutida no template da rota que
// linkDoModulo produz — então extraímos a chave do resultado real da
// função, em vez de comparar com um texto repetido à mão nos dois lados.
async function chaveDoParametroDoMapa() {
  const { linkDoModulo } = await import('../mapa/mapa-geometria.js')
  const rota = linkDoModulo('maquinas', 1)
  const url = new URL(rota, 'http://localhost')
  const chaves = [...url.searchParams.keys()]
  assert.equal(chaves.length, 1, 'linkDoModulo deveria montar exatamente um parâmetro de busca')
  return chaves[0]
}

test('os dois arquivos de destino leem o parâmetro de busca da URL pelo leitor padrão do navegador', () => {
  for (const { nome, caminho } of ARQUIVOS_DESTINO) {
    assert.match(conteudoDe(caminho), /URLSearchParams/, `${nome} deveria ler a URL com URLSearchParams`)
  }
})

test('os dois arquivos usam a mesma chave de parâmetro que linkDoModulo monta em mapa/mapa-geometria.js', async () => {
  const chave = await chaveDoParametroDoMapa()
  assert.equal(chave, 'ativo', 'sanity check — a chave que a metade de origem do link monta')
  for (const { nome, caminho } of ARQUIVOS_DESTINO) {
    const conteudo = conteudoDe(caminho)
    const temAChave = conteudo.includes(`'${chave}'`) || conteudo.includes(`"${chave}"`)
    assert.ok(temAChave, `${nome} deveria buscar a mesma chave que linkDoModulo produz ('${chave}')`)
  }
})

test('os dois arquivos validam o identificador como inteiro antes de qualquer uso', () => {
  for (const { nome, caminho } of ARQUIVOS_DESTINO) {
    assert.match(
      conteudoDe(caminho),
      /Number\.(isSafeInteger|isInteger)/,
      `${nome} deveria validar o identificador com Number.isSafeInteger/isInteger`,
    )
  }
})

test('nos dois arquivos, a função de exibição virou assíncrona e espera a carga', () => {
  for (const { nome, caminho } of ARQUIVOS_DESTINO) {
    const conteudo = conteudoDe(caminho)
    assert.match(conteudo, /async function mostrarApp/, `${nome} deveria ter mostrarApp assíncrona`)
    assert.match(conteudo, /await/, `${nome} deveria aguardar a carga dentro de mostrarApp`)
  }
})

test('nos dois arquivos, a função de deep link não vaza para o escopo global', () => {
  for (const { nome, caminho } of ARQUIVOS_DESTINO) {
    const conteudo = conteudoDe(caminho)
    const blocoExporNoWindow = conteudo.match(/function exporNoWindow[\s\S]*?\n}/)
    assert.ok(blocoExporNoWindow, `${nome} deveria ter exporNoWindow()`)
    assert.doesNotMatch(
      blocoExporNoWindow[0],
      /_abrirAtivoDaUrl/,
      `${nome}: a função de deep link é interna — não deveria estar publicada em exporNoWindow`,
    )
  }
})

// A lista de nomes publicados em exporNoWindow() de maquinas/app.js é
// conferida por gate de extração dinâmica desde o plano 05-06 (contagem
// dos handlers inline extraídos da marcação, 22 nomes). O número abaixo
// (24) é deliberadamente diferente: é o tamanho da LISTA PUBLICADA em
// exporNoWindow(), não a contagem de handlers extraídos do HTML — mexer
// nele sem necessidade quebraria um gate de outra fase sem relação
// nenhuma com este plano.
test('a lista de nomes publicados em maquinas/app.js continua com 24 entradas', () => {
  const conteudo = conteudoDe(MAQUINAS_APP)
  const bloco = conteudo.match(/function exporNoWindow\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria ter exporNoWindow()')
  const nomes = bloco[1].match(/^ +[a-zA-Z_][a-zA-Z0-9_]*,$/gm) || []
  assert.equal(nomes.length, 24, 'lista de exporNoWindow() de maquinas/app.js mudou de tamanho')
})

test('a API pública do motor compartilhado (iniciarModulo) está intacta', () => {
  assert.match(
    conteudoDe(MODULO_MANUTENCAO),
    /export async function iniciarModulo/,
    'shared/modulo-manutencao.js deveria continuar exportando iniciarModulo como está',
  )
})
