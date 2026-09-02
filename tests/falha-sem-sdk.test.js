// Gate da mensagem de falha quando o SDK do Supabase não carrega (02/09/2026).
//
// MEDIDO ANTES, nas onze superfícies com o SDK bloqueado: dez morriam, e de
// QUATRO maneiras diferentes.
//   /calibracao   avisava em português — o único que dizia algo útil;
//   7 da base comum vazavam `Cannot read properties of undefined
//                 (reading 'createClient')`, que não diz o que houve nem o
//                 que fazer;
//   /equipes      ficava EM BRANCO, zero caractere;
//   /refrigeracao desenhava a barra de topo e as abas (HTML estático) e mais
//                 nada — parecia um parque vazio, que é o pior dos quatro
//                 porque não parece falha nenhuma.
//
// O conserto tem um princípio: a guarda mora na ÚNICA linha do projeto que
// dereferencia o SDK (`criarClienteSupabase`), não nas seis cópias de
// `mostrarErroBoot` que apenas desenham. Os oito módulos da base comum
// herdaram a frase sem uma linha mudada em cada um.
//
// A frase nomeia o host de propósito: a causa real é externa ao aplicativo
// — a rede não deixou o CDN passar — e quem administra a rede precisa saber
// QUAL endereço liberar.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')
const ler = r => fs.readFileSync(path.join(RAIZ, r), 'utf8')
// UTF-8, nunca latin1: /calibracao tem trechos binários e a tentação é ler
// como latin1, mas isso vira "NÃ£o" onde está "Não" e a comparação de frase
// passa a medir mojibake. `replace` deixa o lixo binário virar U+FFFD e
// preserva o texto, que é o que este gate compara.
const lerBin = r => fs.readFileSync(path.join(RAIZ, r)).toString('utf8')

// São TRÊS cópias da mesma frase porque /refrigeracao (congelado, D-04) e
// /calibracao (legado independente, D-05) não importam de shared/ — e é
// justamente por isso que este gate existe.
//
// A comparação é sobre a frase MONTADA, nunca sobre o texto-fonte: no
// shared/ ela sai de um template com ${ORIGEM_SDK}, no /refrigeracao de uma
// concatenação quebrada em linhas, e no /calibracao de um literal inteiro.
// Um gate que procurasse a substring reprovaria as três formas por escrito
// e não provaria nada sobre o que o usuário lê — foi o que aconteceu na
// primeira versão deste arquivo.
const PEDACOS = [
  'Não foi possível carregar o SDK do Supabase (cdn.jsdelivr.net)',
  'Sem ele o módulo não acessa o banco de dados',
  'se a rede bloqueia CDN externo, esse endereço precisa ser liberado',
]

/** Colapsa concatenação de literais JS (`'a ' + 'b'` → `'a b'`) para que uma
 *  frase escrita em várias linhas seja comparável como uma só. */
function juntarConcatenacao(txt) {
  let anterior
  do { anterior = txt; txt = txt.replace(/(['"])\s*\+\s*\1/g, '') } while (txt !== anterior)
  return txt
}

test('a guarda mora na única linha que dereferencia o SDK, não nos desenhos', () => {
  const cfg = ler('shared/supabase-config.js')
  // Antes desta guarda, `window.supabase.createClient` explodia e o
  // TypeError cru chegava à tela de sete módulos.
  assert.match(cfg, /if \(!window\.supabase \|\| typeof window\.supabase\.createClient !== 'function'\)/)
  assert.match(cfg, /throw new Error\(MSG_SDK_AUSENTE\)/)
  const i = cfg.indexOf('MSG_SDK_AUSENTE'), j = cfg.indexOf('window.supabase.createClient(url, key)')
  assert.ok(i > 0 && j > i, 'a guarda precisa vir ANTES da chamada que ela protege')
})

test('as três cópias da mensagem dizem a mesma coisa, palavra por palavra', async () => {
  // A do shared/ é lida EXECUTANDO o módulo: é a frase que os oito da base
  // comum realmente exibem, template resolvido.
  const { MSG_SDK_AUSENTE, ORIGEM_SDK } = await import('../shared/supabase-config.js')
  assert.strictEqual(ORIGEM_SDK, 'cdn.jsdelivr.net')
  for (const p of PEDACOS) {
    assert.ok(MSG_SDK_AUSENTE.includes(p), `a frase montada do shared/ perdeu "${p.slice(0,40)}…"`)
  }
  for (const arq of ['refrigeracao/index.html', 'calibracao/index.html']) {
    const txt = juntarConcatenacao(lerBin(arq))
    for (const p of PEDACOS) {
      assert.ok(txt.includes(p),
        `${arq} não contém "${p.slice(0, 45)}…" — as cópias divergiram, e ` +
        'quem lê a tela de um módulo passa a receber outra orientação')
    }
  }
})

test('/equipes escreve a falha onde ela PODE ser vista', () => {
  const app = ler('equipes/app.js')
  const i = app.indexOf('supa = await criarClienteSupabase()')
  assert.ok(i > 0)
  const bloco = app.slice(i, i + 900)
  // O #app nasce display:none e só aparece em mostrarApp(), que nunca roda
  // quando a carga falha: escrever ali deixava o módulo em branco.
  assert.match(bloco, /el\('login-screen'\)\.innerHTML/,
    'a falha precisa ir para a tela de login, que está visível no boot')
  assert.match(bloco, /el\('login-screen'\)\.style\.display = 'flex'/)
  assert.ok(!/el\('app'\)\.innerHTML/.test(bloco),
    'escrever no #app escondido foi exatamente o defeito: tela em branco')
})

test('/refrigeracao não morre em silêncio: guarda antes do createClient de topo', () => {
  const html = lerBin('refrigeracao/index.html')
  const g = html.indexOf("typeof supabase === 'undefined'")
  const c = html.indexOf('const supa = supabase.createClient(SUPA_URL, SUPA_KEY);')
  assert.ok(g > 0, 'sem guarda, a linha de topo lança e mata o <script> inteiro')
  assert.ok(c > g, 'a guarda precisa vir antes da criação do cliente')
  // Módulo congelado: nada de classe de CSS nova (D-cf8-20). O aviso é
  // desenhado com estilo em linha, como a correção de D-2mx-04 já fez.
  const bloco = html.slice(g, c)
  assert.match(bloco, /style\.cssText/)
  assert.match(bloco, /role', 'alert'/)
  assert.ok(!/class="/.test(bloco), 'o aviso não pode depender de classe nenhuma')
})

test('nenhuma superfície com SDK deixa de ter caminho de falha nomeado', async () => {
  const superficies = ['refrigeracao', 'maquinas', 'transportes', 'eletrica', 'fonoclama',
    'predial', 'reparos', 'mapa', 'calibracao', 'equipes']
  const { MSG_SDK_AUSENTE } = await import('../shared/supabase-config.js')
  for (const m of superficies) {
    const html = juntarConcatenacao(lerBin(`${m}/index.html`))
    assert.match(html, /supabase-js@2/, `${m} deveria carregar o SDK`)
    const proprio = PEDACOS.every(p => html.includes(p))
    // Herda quem chama a porta única — direto, ou pelo esqueleto comum,
    // que é como /eletrica e /fonoclama fazem (o app.js deles é só a
    // configuração passada a iniciarModulo).
    const js = fs.existsSync(path.join(RAIZ, m, 'app.js')) ? ler(`${m}/app.js`) : ''
    const herdado = /criarClienteSupabase/.test(js) ||
      /modulo-manutencao\.js/.test(js) ||
      /supabase-config\.js/.test(html)
    assert.ok(proprio || (herdado && PEDACOS.every(p => MSG_SDK_AUSENTE.includes(p))),
      `${m} não tem mensagem própria nem herda a de shared/supabase-config.js`)
  }
  // O portal é a exceção real: não carrega SDK nenhum, logo não falha.
  assert.ok(!/supabase-js@2/.test(lerBin('index.html')),
    'o portal não deveria ter ganhado dependência de SDK')
})
