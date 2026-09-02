// Gate das bibliotecas hospedadas no próprio projeto (02/09/2026).
//
// MEDIDO ANTES: com o CDN externo bloqueado — o caso real de uma rede de OM
// que só libera o necessário — dois módulos degradavam de formas diferentes.
// `/refrigeracao` perdia 19 dos 26 ícones visíveis, e como o <i> colapsa para
// 0x0 o rótulo subia e a bolha de contagem cobria "OS" e "Alertas".
// `/mapa` perdia o mapa INTEIRO: sem .leaflet-container, 220 marcadores
// viravam zero e a tela caía de 1.197 para 160 caracteres.
//
// O que este arquivo trava:
//  - nenhuma superfície volta a pedir CSS/JS de CDN externo, com UMA exceção
//    nomeada (o SDK do Supabase, que continua vindo de jsdelivr e está fora
//    do escopo desta mudança);
//  - os arquivos hospedados existem de verdade e são referenciados por
//    caminho RAIZ-ABSOLUTO (a rota do Vercel serve /modulo sem barra final,
//    e caminho relativo quebra ali — D-td4-07);
//  - tudo que as folhas hospedadas pedem por `url(...)` existe no disco: foi
//    a armadilha desta task, porque o CSS do Font Awesome chama
//    `../webfonts/` e exige que css/ e webfonts/ sejam irmãos;
//  - só a família `fas` aparece em /refrigeracao, porque só o webfont solid
//    foi versionado — um `far`/`fab` novo não desenharia, em silêncio.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')
const SUPERFICIES = ['index.html', 'refrigeracao/index.html', 'maquinas/index.html',
  'transportes/index.html', 'eletrica/index.html', 'fonoclama/index.html',
  'predial/index.html', 'reparos/index.html', 'mapa/index.html',
  'calibracao/index.html', 'equipes/index.html']

// As duas dependências externas que SOBRAM, nomeadas de propósito para
// ficarem visíveis em vez de esquecidas — e para que uma TERCEIRA não entre
// sem alguém decidir:
//
//  1. o SDK do Supabase (207 KB). Sem ele nenhum módulo tem dado nenhum, e
//     hospedá-lo é decisão à parte: vale para as onze superfícies de uma vez.
//  2. o SheetJS do /calibracao (~950 KB). Carregado SOB DEMANDA por
//     `ensureXLSX()`, só quando alguém exporta para Excel, e o módulo já diz
//     "Sem internet para carregar" quando falha. Hospedá-lo custaria mais que
//     tudo o que esta task versionou junto, para uma ação ocasional.
//     (A documentação do projeto dizia que o SheetJS era embutido; não é.)
const EXCECOES = [
  /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/,
  /cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\//,
]

function ler(rel) { return fs.readFileSync(path.join(RAIZ, rel), 'utf8') }

test('nenhuma superfície carrega CSS ou JS de CDN externo — só o SDK do Supabase', () => {
  const proibidos = /https:\/\/(cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|cdn\.jsdelivr\.net)\/[^"'\s)]+/g
  for (const arq of SUPERFICIES) {
    const txt = fs.readFileSync(path.join(RAIZ, arq), 'latin1')
    for (const u of txt.match(proibidos) || []) {
      assert.ok(EXCECOES.some(e => e.test(u)),
        `${arq} pede ${u} de CDN externo; hospede no projeto, como Leaflet e Font Awesome`)
    }
  }
})

test('as bibliotecas hospedadas existem e são pedidas por caminho raiz-absoluto', () => {
  const esperado = {
    'mapa/index.html': ['/mapa/vendor/leaflet.css', '/mapa/vendor/leaflet.js',
                        '/mapa/vendor/leaflet.draw.css', '/mapa/vendor/leaflet.draw.js'],
    'refrigeracao/index.html': ['/refrigeracao/vendor/css/all.min.css'],
  }
  for (const [arq, urls] of Object.entries(esperado)) {
    const txt = fs.readFileSync(path.join(RAIZ, arq), 'latin1')
    for (const u of urls) {
      assert.ok(txt.includes(`"${u}"`), `${arq} não referencia ${u}`)
      assert.ok(fs.existsSync(path.join(RAIZ, u.slice(1))), `arquivo ausente: ${u}`)
    }
  }
})

test('tudo que as folhas hospedadas pedem por url(...) existe no disco', () => {
  const folhas = ['mapa/vendor/leaflet.css', 'mapa/vendor/leaflet.draw.css',
                  'refrigeracao/vendor/css/all.min.css']
  let conferidos = 0
  for (const folha of folhas) {
    const dir = path.dirname(path.join(RAIZ, folha))
    const css = ler(folha)
    for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      let alvo = m[1].split('?')[0].split('#')[0]
      if (!alvo || alvo.startsWith('data:') || alvo.startsWith('http')) continue
      // O CSS do Font Awesome declara as TRÊS famílias (solid, regular,
      // brands) e, em cada uma, eot/ttf/woff/svg ao lado do woff2 para
      // navegador antigo. Só `fa-solid-900.woff2` é versionado: solid é a
      // única família usada (o caso seguinte trava isso) e woff2 é o que
      // todo navegador com ES6 — o mínimo da plataforma — sabe ler. As
      // outras declarações ficam no arquivo porque ele é cópia intocada do
      // upstream; editá-lo convidaria divergência na próxima atualização.
      if (folha.includes('all.min.css') &&
          !/fa-solid-900\.woff2$/.test(alvo)) continue
      conferidos++
      assert.ok(fs.existsSync(path.resolve(dir, alvo)),
        `${folha} pede ${alvo}, que não existe — o CSS chama por caminho relativo à própria folha`)
    }
  }
  assert.ok(conferidos >= 8, `poucos recursos conferidos (${conferidos}); o teste ficou cego`)
})

test('o webfont solid está versionado e é o que o CSS alcança', () => {
  const woff2 = path.join(RAIZ, 'refrigeracao/vendor/webfonts/fa-solid-900.woff2')
  assert.ok(fs.existsSync(woff2))
  // css/ e webfonts/ precisam ser IRMÃOS: o CSS chama `../webfonts/`.
  const css = ler('refrigeracao/vendor/css/all.min.css')
  assert.match(css, /url\(\.\.\/webfonts\/fa-solid-900\.woff2\)/)
  assert.ok(fs.existsSync(path.resolve(RAIZ, 'refrigeracao/vendor/css', '../webfonts/fa-solid-900.woff2')))
})

test('só a família solid é usada em /refrigeracao — as outras não foram versionadas', () => {
  const txt = fs.readFileSync(path.join(RAIZ, 'refrigeracao/index.html'), 'latin1')
  for (const fam of ['far', 'fab', 'fal', 'fad']) {
    const usos = (txt.match(new RegExp(`class="${fam} fa-`, 'g')) || []).length
    assert.strictEqual(usos, 0,
      `${usos} ícone(s) da família ${fam}: só fa-solid-900.woff2 foi versionado, ` +
      'então eles não desenhariam — versione o webfont ou troque o ícone')
  }
  assert.ok((txt.match(/class="fas fa-/g) || []).length > 100, 'a família solid deveria ser a usada')
})

test('hospedar a biblioteca NÃO é hospedar os tiles — o mapa-base segue online', () => {
  // Distinção que a medição impôs: a biblioteca são 228 KB e resolve o
  // módulo inteiro; os tiles do CMASM até o zoom 17 são ~3,9 MB e são
  // decisão à parte, com procedimento próprio. D-02 mantém o satélite online.
  const xmap = ler('mapa/xmap.js')
  assert.match(xmap, /tile\.openstreetmap\.org/)
  assert.ok(fs.existsSync(path.join(RAIZ, 'mapa/tiles/GERAR-TILES.md')),
    'o procedimento dos tiles continua sendo o caminho para o mapa-base offline')
})
