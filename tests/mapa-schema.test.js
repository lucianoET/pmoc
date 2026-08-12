const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Por que este arquivo existe: a migração 25 roda num Supabase
// compartilhado com dois módulos em produção, uma única vez, colada à
// mão no SQL Editor. Não há `migrate up`, não há ambiente de teste, não
// há rollback. O único momento em que dá para pegar um `drop` acidental
// ou uma policy frouxa é antes de colar. É isso que este arquivo faz —
// ele lê o TEXTO da migração, não valida o banco.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const SUPABASE_DIR = path.join(RAIZ, 'supabase')
const MIGRACAO = path.join(SUPABASE_DIR, '25_mapa_geometria_posicao.sql')

const TABELAS_COM_POSICAO = [
  'cmasm_locais',
  'maq_ativos',
  'transp_ativos',
  'elet_ativos',
  'fono_ativos',
  'equipamentos',
]

function lerMigracao() {
  return fs.readFileSync(MIGRACAO, 'utf8')
}

test('a migração 25 existe e é a única com esse número', () => {
  assert.ok(fs.existsSync(MIGRACAO), 'supabase/25_mapa_geometria_posicao.sql deveria existir')
  const arquivos25 = fs.readdirSync(SUPABASE_DIR).filter((f) => f.startsWith('25_'))
  assert.deepEqual(arquivos25, ['25_mapa_geometria_posicao.sql'], 'deveria haver só um arquivo 25_*.sql')
})

test('a migração é aditiva — nenhuma linha começa por comando destrutivo', () => {
  const sql = lerMigracao()
  // A asserção é sobre as LINHAS, não sobre o arquivo inteiro — assim a
  // palavra pode aparecer livremente dentro de um comentário explicativo
  // (é justamente o comentário do cabeçalho que diz que a migração não
  // faz isso).
  const linhasDestrutivas = sql
    .split('\n')
    .filter((linha) => /^\s*(drop|truncate|delete from)/i.test(linha))
  assert.deepEqual(linhasDestrutivas, [], 'nenhuma linha deveria começar por drop/truncate/delete from')
})

test('as três listas fechadas de terreno têm exatamente os valores previstos', () => {
  const sql = lerMigracao()

  function valoresDaLista(coluna) {
    const re = new RegExp(`${coluna}\\s+in\\s*\\(([^)]+)\\)`, 'i')
    const m = sql.match(re)
    assert.ok(m, `não encontrei a lista fechada de ${coluna}`)
    return m[1]
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''))
      .sort()
  }

  // Comparação de conjunto, não busca de substring — pega tanto um valor
  // faltando quanto um valor a mais.
  assert.deepEqual(valoresDaLista('flora'), ['capim_colonial', 'gramado', 'mata_fechada'].sort())
  assert.deepEqual(valoresDaLista('inclinacao'), ['acentuado', 'moderado', 'plano'].sort())
  assert.deepEqual(valoresDaLista('limpeza'), ['densa', 'limpa', 'media'].sort())
})

test('as seis tabelas recebem as duas coordenadas (lat e lon)', () => {
  const sql = lerMigracao()
  for (const tabela of TABELAS_COM_POSICAO) {
    const reLat = new RegExp(`alter table ${tabela}\\s+add column if not exists lat double precision`, 'i')
    const reLon = new RegExp(`alter table ${tabela}\\s+add column if not exists lon double precision`, 'i')
    assert.match(sql, reLat, `${tabela} deveria ganhar a coluna lat`)
    assert.match(sql, reLon, `${tabela} deveria ganhar a coluna lon`)
  }
})

test('toda tabela que ganha coordenada também ganha as duas travas — envelope e par completo', () => {
  // Este caso é o que impede que uma sétima tabela seja acrescentada no
  // futuro sem as travas: percorre a lista fixa das seis tabelas e afirma
  // a existência das duas restrições nomeadas para cada uma.
  const sql = lerMigracao()
  for (const tabela of TABELAS_COM_POSICAO) {
    assert.match(sql, new RegExp(`${tabela}_posicao_envelope_chk`), `${tabela} deveria ter a restrição de envelope`)
    assert.match(sql, new RegExp(`${tabela}_posicao_par_chk`), `${tabela} deveria ter a restrição de par completo`)
  }
})

test('os quatro números do envelope geográfico são exatamente os fixados', () => {
  // Escritos à mão aqui, não lidos de outro arquivo. O plano 10-02 escreve
  // os mesmos quatro números no lado do JavaScript e o teste dele os
  // afirma de forma independente — dois gates independentes sobre os
  // mesmos quatro números, para que mudar um lado sem o outro quebre um
  // dos dois testes.
  const sql = lerMigracao()
  for (const numero of ['-23.2', '-22.5', '-43.5', '-42.7']) {
    assert.ok(sql.includes(numero), `o número de envelope ${numero} deveria estar na migração`)
  }
})

test('nenhuma policy é criada — e se um dia for, ela precisa declarar escopo de papel', () => {
  // Este caso passa hoje de forma vazia, de propósito: ele existe para o
  // dia em que alguém acrescentar uma policy a esta migração. É a
  // tradução em código do risco real desta fase (T-10-01) — não "o
  // observador escreve", e sim "alguém escreve uma policy nova sem
  // escopo de papel".
  const sql = lerMigracao()
  const policies = sql.match(/create policy[\s\S]*?;/gi) || []
  assert.deepEqual(policies, [], 'a migração 25 não deveria criar nenhuma policy')
  for (const policy of policies) {
    assert.match(policy, /to authenticated/i, `toda policy futura nesta migração precisa declarar "to authenticated": ${policy}`)
  }
})

test('PostGIS fica fora — geometria é jsonb, sem extensão nova', () => {
  const sql = lerMigracao()
  assert.doesNotMatch(sql, /create extension/i, 'nenhuma extensão do Postgres deveria ser habilitada')
})

test('maq_operacoes não é tocada (D-04) — estimativa de tempo/custo por zona fica fora desta fase', () => {
  const sql = lerMigracao()
  assert.doesNotMatch(sql, /maq_operacoes/i, 'maq_operacoes não deveria aparecer em nenhum comando desta migração')
})
