const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const modulo = import('../shared/tema.js')

// as 7 superficies do projeto (os 6 modulos que chamam aplicarShell() mais
// o portal, entrado por decisao D-02), caminhos relativos a raiz do
// repositorio — resolvidos a partir do diretorio do proprio arquivo de
// teste, para funcionar tanto rodando `node --test` na raiz quanto
// apontando direto para este arquivo
const SUPERFICIES = [
  'index.html',
  'maquinas/index.html',
  'transportes/index.html',
  'eletrica/index.html',
  'fonoclama/index.html',
  'predial/index.html',
  'mapa/index.html',
]

const RAIZ = path.join(__dirname, '..')
const REFRIGERACAO = path.join(RAIZ, 'refrigeracao', 'index.html')
const XMAP_CSS = path.join(RAIZ, 'mapa', 'xmap.css')

// le um arquivo e devolve a primeira linha que contem a chave de tema —
// e essa linha, byte a byte, que precisa ser identica nas 7 superficies
function linhaDoScript(caminhoRelativo, chave) {
  const conteudo = fs.readFileSync(path.join(RAIZ, caminhoRelativo), 'utf8')
  return conteudo.split('\n').find((linha) => linha.includes(chave))
}

test('as 7 superficies contem a chave de tema exportada por shared/tema.js', async () => {
  const { CHAVE_TEMA } = await modulo
  for (const caminho of SUPERFICIES) {
    const linha = linhaDoScript(caminho, CHAVE_TEMA)
    assert.ok(linha, `${caminho} nao contem a chave de tema '${CHAVE_TEMA}'`)
  }
})

// o caso mais valioso do arquivo: e a unica defesa contra o modo de falha
// real desta tecnica, que nao e escrever o script errado uma vez, e sim
// corrigir uma das 7 copias e esquecer as outras 6 numa fase futura
test('o script de pre-desenho extraido das 7 superficies reduz a exatamente um valor distinto — as copias nao divergiram', async () => {
  const { CHAVE_TEMA } = await modulo
  const linhas = SUPERFICIES.map((caminho) => linhaDoScript(caminho, CHAVE_TEMA))
  const distintas = new Set(linhas)
  assert.equal(distintas.size, 1, 'as copias do script anti-FOUC divergem entre as superficies')
})

test('o script de pre-desenho nao declara tipo de modulo nem origem externa', async () => {
  const { CHAVE_TEMA } = await modulo
  const linha = linhaDoScript(SUPERFICIES[0], CHAVE_TEMA)
  assert.doesNotMatch(linha, /type=["']module["']/)
  assert.doesNotMatch(linha, /\bsrc=/)
})

test('o script de pre-desenho menciona os dois textos da lista fechada e a consulta de preferencia de esquema de cor do sistema', async () => {
  const { CHAVE_TEMA, TEMAS } = await modulo
  const linha = linhaDoScript(SUPERFICIES[0], CHAVE_TEMA)
  for (const tema of TEMAS) {
    assert.ok(linha.includes(tema), `script nao menciona o tema '${tema}'`)
  }
  assert.match(linha, /prefers-color-scheme/)
})

test('o script de pre-desenho tolera armazenamento bloqueado, com bloco de captura de excecao', async () => {
  const { CHAVE_TEMA } = await modulo
  const linha = linhaDoScript(SUPERFICIES[0], CHAVE_TEMA)
  assert.match(linha, /catch/)
})

test('o script de pre-desenho aparece antes do fechamento do cabecalho do documento em cada uma das 7 superficies', async () => {
  const { CHAVE_TEMA } = await modulo
  for (const caminho of SUPERFICIES) {
    const linhas = fs.readFileSync(path.join(RAIZ, caminho), 'utf8').split('\n')
    const indiceScript = linhas.findIndex((linha) => linha.includes(CHAVE_TEMA))
    const indiceFechamento = linhas.findIndex((linha) => linha.includes('</head>'))
    assert.ok(indiceScript >= 0, `${caminho}: script de pre-desenho ausente`)
    assert.ok(indiceFechamento >= 0, `${caminho}: fechamento de <head> ausente`)
    assert.ok(indiceScript < indiceFechamento, `${caminho}: script fora do cabecalho`)
  }
})

test('os 6 modulos nao declaram nenhum token de cor alem da cor de destaque, e nenhum tem bloco de tema proprio', () => {
  const modulosDeAtivo = SUPERFICIES.filter((caminho) => caminho !== 'index.html')
  for (const caminho of modulosDeAtivo) {
    const conteudo = fs.readFileSync(path.join(RAIZ, caminho), 'utf8')
    assert.doesNotMatch(
      conteudo,
      /--(bg|surface|surface2|border|text2|text3|green|yellow|red|blue|orange):/,
      `${caminho}: declarou token de cor proprio, fora de --accent`
    )
    assert.doesNotMatch(conteudo, /\[data-theme="claro"\]/, `${caminho}: criou bloco de tema proprio`)
  }
})

// D-04 e PLAT-15 deixam de depender de disciplina humana e passam a
// falhar sozinhos se o tema vazar para refrigeracao/ numa fase futura
test('refrigeracao/index.html nao menciona a chave de tema, nao menciona o atributo de tema e nao referencia nenhum arquivo compartilhado (D-04, PLAT-15)', async () => {
  const { CHAVE_TEMA } = await modulo
  const conteudo = fs.readFileSync(REFRIGERACAO, 'utf8')
  assert.ok(!conteudo.includes(CHAVE_TEMA), `refrigeracao/index.html menciona a chave de tema '${CHAVE_TEMA}'`)
  assert.doesNotMatch(conteudo, /data-theme/)
  assert.doesNotMatch(conteudo, /shared\//)
})

// D-01: o skin do Leaflet fica fora do escopo e permanece dark-only
test('mapa/xmap.css nao menciona o atributo de tema (D-01)', () => {
  const conteudo = fs.readFileSync(XMAP_CSS, 'utf8')
  assert.doesNotMatch(conteudo, /data-theme/)
})

// D-05 (registrada em 06-04, auditoria de fechamento): calibracao entrou no
// repositorio durante esta fase, por uma tarefa concorrente (commits
// 240cfa6/eb1e342), como copia independente do app legado — nao e um dos
// 6 modulos nem o portal (D-02), e fica fora do escopo desta fase, no
// mesmo raciocinio que ja vale para refrigeracao (D-04). A diferenca e que
// calibracao NAO esta simplesmente sem tema: o proprio app legado ja tem
// alternador de tema visivel, so que com mecanismo proprio e incompativel
// com a convencao da plataforma (chave 'cmasm_erp_theme', nao 'pmoc-tema';
// valores 'dark'/'light' em ingles, nao 'claro'/'escuro'; nenhuma
// referencia a shared/). Este teste prova as duas coisas ao mesmo tempo —
// que a convencao da plataforma nao vazou para dentro do modulo, e que a
// ausencia dela e deliberada, nao esquecida, porque o modulo de fato tem
// o proprio atributo de tema, só que desconectado.
test('calibracao/index.html fica fora da convencao pmoc-tema por decisao (D-05) — tem alternador de tema proprio, incompativel de proposito com a convencao da plataforma', async () => {
  const { CHAVE_TEMA, TEMAS } = await modulo
  const conteudo = fs.readFileSync(path.join(RAIZ, 'calibracao', 'index.html'), 'utf8')
  assert.ok(
    !conteudo.includes(CHAVE_TEMA),
    `calibracao/index.html menciona a chave de tema da plataforma '${CHAVE_TEMA}' — a convencao vazou para um modulo que deveria ficar fora dela`
  )
  assert.doesNotMatch(
    conteudo,
    /shared\//,
    'calibracao/index.html referencia shared/ — deveria continuar standalone, como o app legado que e'
  )
  for (const tema of TEMAS) {
    assert.doesNotMatch(
      conteudo,
      new RegExp(`data-theme=["']${tema}["']`),
      `calibracao usa o valor '${tema}' da lista fechada da plataforma — deveria usar o proprio vocabulario (dark/light)`
    )
  }
  // confirma que a ausencia da convencao da plataforma nao e por o modulo
  // simplesmente nao ter nocao de tema nenhuma — ele tem a propria, e essa
  // presenca é o que torna a exclusao uma decisao registrada, nao uma
  // lacuna descoberta por quem for usar
  assert.match(
    conteudo,
    /data-theme/,
    'calibracao deixou de ter qualquer atributo de tema proprio — revisar esta nota de exclusao deliberada (D-05), o cenario mudou'
  )
})
