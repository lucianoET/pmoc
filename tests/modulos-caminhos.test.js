// Gate de caminhos de asset por modulo.
//
// O vercel.json reescreve cada modulo a partir de uma URL SEM barra final
// (`/mapa` -> `mapa/index.html`). Nessa URL, o navegador resolve um caminho
// relativo simples contra a RAIZ do site: `xmap.js` vira `/xmap.js`, nao
// `/mapa/xmap.js`. O arquivo da 404, o script nunca roda e o modulo quebra em
// producao — sem erro de sintaxe, sem teste vermelho, e funcionando normalmente
// em `localhost:8000/mapa/` (com barra), que e onde se costuma conferir.
//
// Foi exatamente assim que /mapa quebrou ("xMap is not defined", 5 arquivos em
// 404), /calibracao perdeu duas folhas de estilo, e /refrigeracao serviu
// qrcode.js em 404 (defeito 260821-td4, "o qr nao esta carregando") — as tres
// vezes em producao.
//
// Regra: um modulo referencia asset proprio por caminho absoluto de raiz
// (`/mapa/xmap.js`) ou sobe explicitamente para o compartilhado (`../shared/...`,
// que resolve igual com ou sem barra). Relativo simples, nunca.

const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')

// Modulos com reescrita no vercel.json. `refrigeracao` estava de fora ate
// 260821-td4: e um arquivo unico de ~436 KB com JS embutido (D-04, congelada),
// onde uma varredura por `src=`/`href=` corria o risco de casar fragmento de
// template literal, nao marcacao real. A justificativa era legitima -- e foi
// exatamente essa exclusao que deixou passar o defeito reportado pelo usuario
// ("o qr nao esta carregando", qrcode.js em 404 na rota sem barra). A forma
// positiva de caminho abaixo resolve o problema original sem precisar excluir
// o modulo: medida contra os 9 modulos reais, ela devolve exatamente as
// referencias verdadeiras de cada um, com zero falso positivo -- inclusive na
// calibracao, que tem uma lib de QR embutida com fragmentos multilinha.
const MODULOS = ['maquinas', 'transportes', 'eletrica', 'fonoclama', 'predial', 'reparos', 'mapa', 'calibracao', 'refrigeracao']

function referenciasLocais(html) {
  const refs = []
  for (const m of html.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/gi)) {
    const alvo = m[1]
    // Descarte de CDN por `^(?:https?:)?//` — nao e redundante com a forma
    // positiva abaixo: uma URL de protocolo relativo (`//host/arquivo.css`)
    // e feita so de letras/digitos/`.`/`/`, casa a forma de caminho tambem, e
    // sem este descarte separado iria parar na checagem de existencia em
    // disco como se fosse caminho de raiz.
    if (/^(?:https?:)?\/\//.test(alvo)) continue
    // Forma positiva de caminho: so letras, digitos, `_`, `.`, `/` e `-`, do
    // comeco ao fim do valor. Substitui a antiga lista de exclusoes
    // (`data:`/`mailto:`/`#`, `'+`/`${`) — uma lista de exclusoes e uma lista
    // do que ja mordeu; a forma positiva sobrevive a um arquivo com JS
    // embutido porque exige que o valor PARECA um caminho, em vez de tentar
    // adivinhar toda forma de interpolacao. Custo aceito: um asset com query
    // string (`foo.css?v=2`) passaria despercebido pelo gate — nao existe
    // nenhum no repo hoje.
    if (!/^[A-Za-z0-9_./-]+$/.test(alvo)) continue
    refs.push(alvo)
  }
  return refs
}

for (const modulo of MODULOS) {
  const arquivo = path.join(RAIZ, modulo, 'index.html')
  if (!fs.existsSync(arquivo)) continue

  test(`${modulo}/index.html nao referencia asset por caminho relativo simples (quebraria na rota sem barra final do vercel.json)`, () => {
    const html = fs.readFileSync(arquivo, 'utf8')
    const ruins = referenciasLocais(html).filter(r => !r.startsWith('/') && !r.startsWith('../'))
    assert.deepStrictEqual(
      ruins,
      [],
      `${modulo}/index.html referencia ${ruins.join(', ')} por caminho relativo simples. ` +
      `Servido em /${modulo} (sem barra), isso resolve contra a raiz do site e da 404. ` +
      `Use /${modulo}/<arquivo> ou ../shared/<arquivo>.`
    )
  })

  test(`${modulo}/index.html so referencia asset que existe em disco`, () => {
    const html = fs.readFileSync(arquivo, 'utf8')
    const ausentes = referenciasLocais(html).filter(ref => {
      const alvo = ref.startsWith('/')
        ? path.join(RAIZ, ref.slice(1))            // absoluto de raiz: relativo a raiz do repo
        : path.join(RAIZ, modulo, ref)             // ../shared/...: relativo ao modulo
      return !fs.existsSync(alvo)
    })
    assert.deepStrictEqual(
      ausentes,
      [],
      `${modulo}/index.html aponta para arquivo inexistente: ${ausentes.join(', ')}`
    )
  })
}

// Terceiro teste, escopado so a refrigeracao/index.html (D-td4-06): nenhuma
// varredura de marcacao acima enxerga `new URL('...', location.href)` — essas
// construcoes eram metade do defeito 260821-td4 (CT_LOGO_URI/CT_QR_BRAND) e
// ficariam invisiveis para sempre se o gate so olhasse `src=`/`href=`.
// shared/supabase-config.js tambem usa `new URL`, mas com `import.meta.url`
// em Node — outra coisa, deliberadamente fora deste escopo.
test('refrigeracao/index.html so usa new URL(...) com primeiro argumento absoluto (nenhuma varredura de marcacao enxerga essa construcao)', () => {
  const arquivo = path.join(RAIZ, 'refrigeracao', 'index.html')
  const html = fs.readFileSync(arquivo, 'utf8')
  const primeirosArgumentos = [...html.matchAll(/new URL\(\s*'([^']*)'/g)].map(m => m[1])

  // A propria construcao precisa continuar existindo, senao este teste passa
  // por vacuidade se ela for removida num refactor futuro.
  assert.ok(
    primeirosArgumentos.includes('/refrigeracao/icone-192.png'),
    'construcao de CT_LOGO_URI (new URL) nao encontrada em refrigeracao/index.html'
  )

  const relativos = primeirosArgumentos.filter(arg => !arg.startsWith('/') && !/^https?:\/\//i.test(arg))
  assert.deepStrictEqual(
    relativos,
    [],
    `refrigeracao/index.html usa new URL(...) com primeiro argumento relativo: ${relativos.join(', ')}. ` +
    `Servido em /refrigeracao (sem barra), location.href tem a raiz do site como base, nao o modulo — ` +
    `e o resultado ainda precisa ser URL absoluta com origem, porque imprimirDocumento escreve num ` +
    `about:blank sem base nenhuma. Use caminho absoluto de raiz, ex: '/refrigeracao/<arquivo>'.`
  )
})
