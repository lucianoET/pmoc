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
// 404) e /calibracao perdeu duas folhas de estilo, as duas em producao.
//
// Regra: um modulo referencia asset proprio por caminho absoluto de raiz
// (`/mapa/xmap.js`) ou sobe explicitamente para o compartilhado (`../shared/...`,
// que resolve igual com ou sem barra). Relativo simples, nunca.

const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')

// Modulos com reescrita no vercel.json. `refrigeracao` fica de fora: e um arquivo
// unico de ~436 KB com JS embutido (D-04, congelada), onde uma varredura por
// `src=`/`href=` casa fragmentos de template literal, nao marcacao real.
const MODULOS = ['maquinas', 'transportes', 'eletrica', 'fonoclama', 'predial', 'mapa', 'calibracao']

function referenciasLocais(html) {
  const refs = []
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/gi)) {
    const alvo = m[1]
    if (/^(?:https?:)?\/\//.test(alvo)) continue        // CDN
    if (/^(?:data:|mailto:|#)/.test(alvo)) continue     // nao e arquivo
    if (alvo.includes("'+") || alvo.includes('${')) continue // interpolacao em JS embutido
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
