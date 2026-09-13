// tests/supabase-env.test.js
//
// O endereço do banco era DESCOBERTO por expressão regular sobre
// maquinas/app.js. Um `let` no lugar de um `const`, uma quebra de linha
// diferente, as duas constantes movidas de arquivo — qualquer uma dessas
// coisas derrubava os nove módulos de uma vez, sem erro de sintaxe e sem
// nada que uma revisão de código enxergasse.
//
// Agora ele é DECLARADO em shared/supabase-env.js, e as duas cópias que
// sobraram (maquinas/app.js e refrigeracao/index.html, que não importam de
// lugar nenhum por decisão de projeto) são comparadas aqui caractere a
// caractere. Este gate existe para que trocar a chave em um lugar só falhe
// no `node --test`, e não na portaria.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8')
// calibracao/index.html tem ~860 KB com React embutido e é lido como
// binário pelos outros gates; aqui basta o texto, mas sem 'utf8' estrito.
const lerBin = (rel) => fs.readFileSync(path.join(RAIZ, rel)).toString('latin1')

function literais(txt) {
  const u = txt.match(/const\s+SUPA_URL\s*=\s*['"]([^'"]+)['"]/)
  const k = txt.match(/const\s+SUPA_KEY\s*=\s*['"]([^'"]+)['"]/)
  return { url: u && u[1], key: k && k[1] }
}

test('shared/supabase-env.js declara URL e chave — ninguém mais precisa adivinhar', async () => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PROJETO } =
    await import('../shared/supabase-env.js')

  assert.match(SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/,
    'a URL precisa ser um endereço de projeto Supabase completo')
  assert.ok(SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.split('.').length === 3,
    'a anon key precisa ser um JWT de três partes')
  assert.ok(SUPABASE_URL.includes(SUPABASE_PROJETO),
    'SUPABASE_PROJETO tem de ser o mesmo projeto da URL — apontar a ' +
    'plataforma para um projeto e as migrações para outro é invisível na tela')

  // O `ref` do JWT é o projeto. Se divergir da URL, o cliente monta sem
  // erro e toda consulta volta 401 sem dizer por quê.
  const corpo = JSON.parse(
    Buffer.from(SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString('utf8'))
  assert.strictEqual(corpo.ref, SUPABASE_PROJETO,
    'o `ref` dentro da chave não é o projeto da URL')
  assert.strictEqual(corpo.role, 'anon',
    'a chave publicada no navegador tem de ser a anon — nunca a service_role')
})

test('as três cópias do endereço do banco são o mesmo literal', async () => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../shared/supabase-env.js')

  // Três, não duas: calibracao/index.html é o app React independente e
  // também carrega o par. Este gate nasceu já encontrando essa terceira
  // cópia, que ninguém tinha registrado em lugar nenhum.
  const copias = [
    ['maquinas/app.js', literais(ler('maquinas/app.js'))],
    ['refrigeracao/index.html', literais(lerBin('refrigeracao/index.html'))],
    ['calibracao/index.html', literais(lerBin('calibracao/index.html'))],
  ]

  for (const [arq, { url, key }] of copias) {
    assert.ok(url && key,
      `${arq} deixou de declarar SUPA_URL/SUPA_KEY — é o resgate de ` +
      'shared/supabase-config.js e o gate perde a referência')
    assert.strictEqual(url, SUPABASE_URL,
      `${arq} aponta para outra URL que shared/supabase-env.js`)
    assert.strictEqual(key, SUPABASE_ANON_KEY,
      `${arq} tem outra anon key que shared/supabase-env.js — um dos dois ` +
      'módulos vai falar com o projeto errado, e só quem abrir ele descobre')
  }
})

test('supabase-config.js lê do módulo declarado antes de tentar a varredura', () => {
  const cfg = ler('shared/supabase-config.js')

  assert.match(cfg, /import \{ SUPABASE_URL, SUPABASE_ANON_KEY \} from '\.\/supabase-env\.js'/,
    'a configuração precisa vir do módulo que a declara')

  const iEnv = cfg.indexOf('CONFIG_CACHE = { url: SUPABASE_URL, key: SUPABASE_ANON_KEY }')
  const iFetch = cfg.indexOf('const candidatos = [')
  assert.ok(iEnv > 0, 'o caminho declarado sumiu de obterSupabaseConfig()')
  assert.ok(iFetch > iEnv,
    'a varredura por regex é resgate, não caminho normal: ela não pode ' +
    'rodar antes do valor declarado')
})

test('nenhum módulo declara a chave por conta própria', () => {
  // Quem importa criarClienteSupabase() não deve ter cópia: cada cópia a
  // mais é um lugar onde a rotação da chave pode ser esquecida. As três
  // exceções são deliberadas e cobertas pelo gate acima.
  const EXCECOES = new Set([
    'maquinas/app.js', 'refrigeracao/index.html', 'calibracao/index.html',
  ])
  const modulos = fs.readdirSync(RAIZ, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'tests')
    .map(d => d.name)

  const infratores = []
  for (const m of modulos) {
    for (const arq of ['app.js', 'index.html']) {
      const rel = `${m}/${arq}`
      if (EXCECOES.has(rel)) continue
      const caminho = path.join(RAIZ, rel)
      if (!fs.existsSync(caminho)) continue
      if (/const\s+SUPA_KEY\s*=/.test(fs.readFileSync(caminho).toString('latin1'))) {
        infratores.push(rel)
      }
    }
  }

  assert.deepStrictEqual(infratores, [],
    'declararam a anon key por conta própria: ' + infratores.join(', ') +
    ' — importar de shared/supabase-env.js')
})
