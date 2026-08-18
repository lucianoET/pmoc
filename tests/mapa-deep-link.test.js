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

// Este caso já foi uma contagem fixa (24 nomes publicados em exporNoWindow()).
// Número fixo protege pouco e atrapalha muito: quebra em toda fase que adiciona
// um handler legítimo, e não pega o erro que importa — publicar de menos, que é
// o que produz "função não definida" no clique do usuário. Agora afirma o
// contrato de verdade, no mesmo formato de tests/integracao-reparos.test.js:
// todo handler chamado na marcação existe na lista publicada.
function handlersInline(html) {
  const nomes = new Set()
  for (const m of html.matchAll(/\son[a-z]+="([A-Za-z_$][\w$]*)\(/g)) nomes.add(m[1])
  return [...nomes].sort()
}

test('maquinas publica no window todo handler inline do próprio markup', () => {
  const conteudo = conteudoDe(MAQUINAS_APP)
  const bloco = conteudo.match(/Object\.assign\(window,\s*\{([\s\S]*?)\}\)/)
  assert.ok(bloco, 'maquinas/app.js deveria ter o Object.assign(window, {...}) de exporNoWindow()')
  const publicados = new Set(bloco[1].split(',').map(s => s.trim()).filter(Boolean))

  const html = conteudoDe(path.join(RAIZ, 'maquinas', 'index.html'))
  // handlers da marcação e também os que nascem dentro de literal de gabarito
  // no próprio app.js — os dois viram atributo inline no DOM do usuário
  const usados = [...new Set([...handlersInline(html), ...handlersInline(conteudo)])]
  assert.ok(usados.length > 0, 'o markup deve usar handlers inline — é o padrão do repo')
  for (const nome of usados) {
    assert.ok(publicados.has(nome), `${nome}() é chamado no markup mas não está em exporNoWindow()`)
  }
})

test('a API pública do motor compartilhado (iniciarModulo) está intacta', () => {
  assert.match(
    conteudoDe(MODULO_MANUTENCAO),
    /export async function iniciarModulo/,
    'shared/modulo-manutencao.js deveria continuar exportando iniciarModulo como está',
  )
})
