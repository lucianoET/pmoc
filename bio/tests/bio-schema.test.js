// Gate do módulo /bio — a forma da migração 61 e das listas fechadas.
//
// O que ele prova: cada lista fechada do domínio (categoria, grupo, risco,
// tipo e status de serviço) é IGUAL, nas duas direções, ao `check` da
// migração 61. Um valor a mais na tela é gravação recusada com erro opaco;
// um valor a mais no banco é opção que ninguém alcança. O seed (62) só usa
// valores das listas. E as decisões de forma que o texto explica existem
// mesmo no SQL: sem DELETE, envelope de posição, alvo exclusivo, coluna
// `lon` (nunca `lng`) e geom no formato da plataforma.
//
// Lê o SQL de verdade, não uma cópia: a lição de mapa-editor.test.js.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')
const SQL = fs.readFileSync(path.join(RAIZ, 'supabase', '61_bio_schema.sql'), 'utf8')
const SEED = fs.readFileSync(path.join(RAIZ, 'supabase', '62_bio_seed_fichas.sql'), 'utf8')

// Corpo de uma tabela, sem os comentários — nome de coluna se repete entre
// tabelas e um comentário em prosa cita valores que não são código.
function corpoDaTabela(nome) {
  const semComentario = SQL.replace(/--[^\n]*/g, '')
  const m = new RegExp(`create table if not exists ${nome} \\(([\\s\\S]*?)\\n\\);`).exec(semComentario)
  assert.ok(m, `migração 61 sem a tabela ${nome}`)
  return m[1]
}

function listaDoCheck(corpo, coluna) {
  const m = new RegExp(`${coluna}\\s+text[^,]*?check \\(${coluna} in \\(([^)]*)\\)`, 's').exec(corpo)
  assert.ok(m, `coluna ${coluna} sem check de lista`)
  return m[1].split(',').map(v => v.trim().replace(/^'|'$/g, '')).filter(Boolean).sort()
}

let dominio
test.before(async () => {
  dominio = await import(path.join(RAIZ, 'bio', 'dominio.js'))
})

test('categoria, grupo e risco da ficha espelham os checks nas duas direções', () => {
  const corpo = corpoDaTabela('bio_fichas')
  assert.deepEqual(Object.keys(dominio.CATEGORIAS).sort(), listaDoCheck(corpo, 'categoria'))
  assert.deepEqual(Object.keys(dominio.GRUPOS).sort(), listaDoCheck(corpo, 'grupo'))
  assert.deepEqual(Object.keys(dominio.RISCOS).sort(), listaDoCheck(corpo, 'risco'))
})

test('tipo e status do serviço espelham os checks; TIPOS_POR_ALVO só cita tipos que existem', () => {
  const corpo = corpoDaTabela('bio_servicos')
  assert.deepEqual(Object.keys(dominio.TIPOS_SERVICO).sort(), listaDoCheck(corpo, 'tipo'))
  assert.deepEqual(Object.keys(dominio.STATUS_SERVICO).sort(), listaDoCheck(corpo, 'status'))
  for (const [alvo, tipos] of Object.entries(dominio.TIPOS_POR_ALVO)) {
    for (const t of tipos) assert.ok(dominio.TIPOS_SERVICO[t], `TIPOS_POR_ALVO.${alvo} cita "${t}", que não está em TIPOS_SERVICO`)
  }
})

test('o formato do código da árvore é o mesmo no domínio e no check', () => {
  const corpo = corpoDaTabela('bio_arvores')
  assert.match(corpo, /codigo\s+text not null unique check \(codigo ~ '\^ARV-\[0-9\]\{4\}\$'\)/)
  assert.equal(dominio.FORMATO_CODIGO.source, '^ARV-[0-9]{4}$')
})

test('posição é lat/lon com envelope e par, nas duas tabelas posicionáveis — nunca "lng"', () => {
  assert.doesNotMatch(SQL, /\blng\b/, 'a plataforma escreve `lon` (migração 25); `lng` seria uma segunda grafia')
  for (const t of ['bio_arvores', 'bio_presencas']) {
    assert.match(SQL, new RegExp(`${t}_posicao_envelope_chk[\\s\\S]*?lat between -23\\.2 and -22\\.5[\\s\\S]*?lon between -43\\.5 and -42\\.7`))
    assert.match(SQL, new RegExp(`${t}_posicao_par_chk[\\s\\S]*?num_nulls\\(lat, lon\\) <> 1`))
  }
})

test('o serviço tem exatamente um alvo, e realizado exige data', () => {
  assert.match(SQL, /check \(\(arvore_id is null\) <> \(presenca_id is null\)\)/)
  assert.match(SQL, /check \(\(status = 'realizado'\) = \(data_realizada is not null\)\)/)
})

test('sem policy de DELETE em nenhuma tabela bio_ — o projeto arquiva', () => {
  assert.doesNotMatch(SQL, /for delete/i)
  assert.doesNotMatch(SQL, /grant[^;]*\bdelete\b/i)
})

test('duas funções de papel, security definer, negadas ao anon', () => {
  for (const f of ['bio_pode_escrever', 'bio_pode_gerir']) {
    assert.match(SQL, new RegExp(`create or replace function ${f}\\(\\)[\\s\\S]*?security definer`))
    assert.match(SQL, new RegExp(`revoke execute on function ${f}\\(\\) from public, anon`))
  }
  // ficha e árvore são cadastro (gerir); presença e serviço são campo (escrever)
  assert.match(SQL, /ins_bio_fichas[\s\S]*?bio_pode_gerir/)
  assert.match(SQL, /ins_bio_arvores[\s\S]*?bio_pode_gerir/)
  assert.match(SQL, /ins_bio_presencas[\s\S]*?bio_pode_escrever/)
  assert.match(SQL, /ins_bio_servicos[\s\S]*?bio_pode_escrever/)
})

test('o seed só usa valores das listas fechadas e não semeia árvore, presença nem serviço', () => {
  const linhas = [...SEED.matchAll(/^\s*\('([^']+)',\s*'[^']*',\s*'(\w+)',\s*'(\w+)',\s*'(\w+)',/gm)]
  assert.ok(linhas.length >= 25, `seed com ${linhas.length} fichas — esperava pelo menos 25`)
  for (const [, nome, categoria, grupo, risco] of linhas) {
    assert.ok(dominio.CATEGORIAS[categoria], `${nome}: categoria "${categoria}" fora da lista`)
    assert.ok(dominio.GRUPOS[grupo], `${nome}: grupo "${grupo}" fora da lista`)
    assert.ok(dominio.RISCOS[risco], `${nome}: risco "${risco}" fora da lista`)
  }
  assert.doesNotMatch(SEED, /insert into bio_(arvores|presencas|servicos)/)
  assert.match(SEED, /where not exists \(select 1 from bio_fichas/, 'seed precisa ser idempotente pelo nome')
})

test('rota, card no portal e vendor do QR existem', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'))
  assert.ok(vercel.rewrites.some(r => r.source === '/bio' && r.destination === '/bio/index.html'))
  const portal = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')
  assert.match(portal, /href="\/bio"/)
  assert.ok(fs.existsSync(path.join(RAIZ, 'bio', 'vendor', 'qrcode.js')))
})
