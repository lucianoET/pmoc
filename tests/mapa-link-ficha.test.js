const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate do caminho de VOLTA do deep link (09/09/2026): ficha → mapa.
//
// A metade mapa → ficha existe desde o plano 10-05 (linkDoModulo em
// mapa/mapa-geometria.js, gate em tests/mapa-deep-link.test.js). A volta
// não existia: nenhuma ficha ligava para o mapa, e mapa/app.js não lia
// parâmetro nenhum da URL — um técnico na OS não sabia onde a máquina
// estava. As duas metades novas:
//   - origem: `verNoMapa(modulo, id)` em shared/componentes.js, UMA função
//     para os três consumidores (maquinas, motor compartilhado, transportes);
//   - destino: `destinoDaUrl(search)` em mapa/mapa-geometria.js (núcleo
//     puro), consumida por mapa/app.js depois da carga.
//
// O que este arquivo PROVA: as duas metades fecham uma na outra (ida e
// volta por comportamento, não por texto), a lista fechada de módulos da
// origem é subconjunto da que o mapa sabe carregar, nenhum consumidor
// escreve a rota à mão, e o mapa só procura o ativo depois de a lista de
// posicionados existir. O que NÃO prova: o voo até o ponto na tela — isso
// fica no roteiro manual (TESTES.md).

const RAIZ = path.join(__dirname, '..')
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8')

const CONSUMIDORES = ['maquinas/app.js', 'shared/modulo-manutencao.js', 'transportes/app.js']

const nucleo = import('../mapa/mapa-geometria.js')
const componentes = import('../shared/componentes.js')
const dados = import('../mapa/mapa-dados.js')

function hrefDe(html) {
  const m = html.match(/href="([^"]+)"/)
  assert.ok(m, `sem href em: ${html}`)
  return m[1].replace(/&amp;/g, '&')
}

// ── ida e volta ──────────────────────────────────────────────────────
test('verNoMapa monta um link que destinoDaUrl lê de volta, para cada módulo da lista', async () => {
  const { verNoMapa, MODULOS_NO_MAPA } = await componentes
  const { destinoDaUrl } = await nucleo
  assert.ok(MODULOS_NO_MAPA.length >= 4, 'os quatro módulos com ficha devem estar na lista')
  for (const modulo of MODULOS_NO_MAPA) {
    const html = verNoMapa(modulo, 42)
    assert.match(html, /^<a /, `${modulo}: deveria devolver uma âncora`)
    assert.match(html, /Ver no mapa/, `${modulo}: rótulo da âncora`)
    const url = new URL(hrefDe(html), 'http://localhost')
    assert.equal(url.pathname, '/mapa', `${modulo}: rota do mapa`)
    assert.deepEqual(destinoDaUrl(url.search), { modulo, id: 42 }, `${modulo}: a volta não fecha`)
  }
})

test('a lista de módulos da origem é subconjunto do que o mapa sabe carregar', async () => {
  const { MODULOS_NO_MAPA } = await componentes
  const { MODULOS_DE_ATIVO } = await dados
  for (const modulo of MODULOS_NO_MAPA) {
    assert.ok(MODULOS_DE_ATIVO.includes(modulo), `${modulo} não está em CONFIG_POR_MODULO de mapa-dados.js`)
  }
})

// ── recusas ──────────────────────────────────────────────────────────
test('verNoMapa devolve vazio para módulo fora da lista ou id que não é inteiro', async () => {
  const { verNoMapa } = await componentes
  assert.equal(verNoMapa('refrigeracao', 1), '')
  assert.equal(verNoMapa('predial', 1), '')
  assert.equal(verNoMapa('inventado', 1), '')
  assert.equal(verNoMapa('maquinas', '7'), '')
  assert.equal(verNoMapa('maquinas', 7.5), '')
  assert.equal(verNoMapa('maquinas', null), '')
  assert.equal(verNoMapa(undefined, 1), '')
})

test('destinoDaUrl devolve nulo para tudo que não é módulo conhecido mais id de dígitos', async () => {
  const { destinoDaUrl } = await nucleo
  assert.equal(destinoDaUrl(''), null)
  assert.equal(destinoDaUrl('?ativo=7'), null, 'sem módulo')
  assert.equal(destinoDaUrl('?modulo=maquinas'), null, 'sem id')
  assert.equal(destinoDaUrl('?modulo=refrigeracao&ativo=7'), null, 'módulo fora da lista')
  assert.equal(destinoDaUrl('?modulo=__proto__&ativo=7'), null, 'chave herdada não é módulo')
  assert.equal(destinoDaUrl('?modulo=maquinas&ativo=-7'), null, 'negativo')
  assert.equal(destinoDaUrl('?modulo=maquinas&ativo=7.5'), null, 'fracionário')
  assert.equal(destinoDaUrl('?modulo=maquinas&ativo=1e3'), null, 'notação exponencial')
  assert.equal(destinoDaUrl('?modulo=maquinas&ativo=abc'), null, 'texto')
  assert.equal(destinoDaUrl('?modulo=maquinas&ativo=99999999999999999999'), null, 'fora do inteiro seguro')
  assert.equal(destinoDaUrl(undefined), null)
})

test('destinoDaUrl aceita a forma que o navegador entrega em location.search', async () => {
  const { destinoDaUrl } = await nucleo
  assert.deepEqual(destinoDaUrl('?modulo=transportes&ativo=12'), { modulo: 'transportes', id: 12 })
  assert.deepEqual(destinoDaUrl('?ativo=12&modulo=eletrica&x=1'), { modulo: 'eletrica', id: 12 }, 'ordem e parâmetro extra não importam')
})

// ── consumidores ─────────────────────────────────────────────────────
test('os três consumidores importam verNoMapa do compartilhado e nenhum escreve a rota do mapa à mão', () => {
  for (const rel of CONSUMIDORES) {
    const src = ler(rel)
    // o motor mora em shared/ e importa './componentes.js'; os módulos, '../shared/componentes.js'
    assert.match(src, /import\s*\{[^}]*\bverNoMapa\b[^}]*\}\s*from\s*'(\.\.\/shared|\.)\/componentes\.js'/, `${rel}: deveria importar verNoMapa de shared/componentes.js`)
    assert.match(src, /verNoMapa\(/, `${rel}: deveria chamar verNoMapa`)
    const semComentario = src.replace(/^\s*\/\/.*$/gm, '')
    assert.doesNotMatch(semComentario, /['"`]\/mapa\?/, `${rel}: a rota do mapa é montada pelo compartilhado, não escrita aqui`)
  }
})

test('elétrica e fonoclama declaram chaveMapa com um módulo da lista, e o motor a usa', async () => {
  const { MODULOS_NO_MAPA } = await componentes
  for (const rel of ['eletrica/app.js', 'fonoclama/app.js']) {
    const m = ler(rel).match(/chaveMapa:\s*'([a-z]+)'/)
    assert.ok(m, `${rel}: deveria declarar chaveMapa na config de iniciarModulo`)
    assert.ok(MODULOS_NO_MAPA.includes(m[1]), `${rel}: chaveMapa '${m[1]}' não está na lista da origem`)
  }
  assert.match(ler('shared/modulo-manutencao.js'), /verNoMapa\(CFG\.chaveMapa,/, 'o motor deveria montar o link a partir da config, não de um nome fixo')
})

test('a ficha de Máquinas tem o ponto de injeção e o preenche ao abrir', () => {
  assert.match(ler('maquinas/index.html'), /id="ficha-btn-mapa"/)
  const corpo = ler('maquinas/app.js').match(/function abrirFichaAtivo\(id\)\{[\s\S]*?\n\}/)
  assert.ok(corpo, 'abrirFichaAtivo não encontrada')
  assert.match(corpo[0], /ficha-btn-mapa[\s\S]*verNoMapa\('maquinas', id\)/, 'abrirFichaAtivo deveria preencher #ficha-btn-mapa com verNoMapa')
})

// ── destino: mapa/app.js ─────────────────────────────────────────────
test('mapa/app.js lê o destino pelo núcleo puro, depois de a lista de posicionados existir, e não publica a função', () => {
  const src = ler('mapa/app.js')
  assert.match(src, /import\s*\{[^}]*\bdestinoDaUrl\b[^}]*\}\s*from\s*'\.\/mapa-geometria\.js'/, 'deveria importar destinoDaUrl do núcleo puro')
  assert.doesNotMatch(src, /URLSearchParams/, 'a leitura da URL mora no núcleo puro, não na tela')
  const carga = src.match(/async function registrarCamadasDoBanco\(\)[\s\S]*?\n\}/)
  assert.ok(carga, 'registrarCamadasDoBanco não encontrada')
  const posRender = carga[0].indexOf('renderNaoLocalizados()')
  const posLink = carga[0].indexOf('_irParaAtivoDaUrl()')
  assert.ok(posRender > 0 && posLink > posRender, 'o voo até o ativo só pode acontecer depois de POSICIONADOS/NAO_LOCALIZADOS estarem povoados')
  const expor = src.match(/function exporNoWindow[\s\S]*?\n\}/)
  assert.ok(expor)
  assert.doesNotMatch(expor[0], /_irParaAtivoDaUrl/, 'função interna, não vai para o window')
  assert.match(src, /NAO_LOCALIZADOS\.find/, 'um ativo sem posição precisa ser reconhecido, não ignorado em silêncio')
})
