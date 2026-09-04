// ══════════════════════════════════════════════════════════════════
// tests/gestao-schema.test.js — Gate permanente da migração 60 (Gestão e Qualidade)
//
// O que protege:
// Valida a forma e os contratos estruturais de supabase/60_gestao_schema.sql
// sem depender de conexão com banco de dados.
//
// Lição da migração 28:
// `create table if not exists` é silencioso quando uma tabela já existe com
// outra estrutura. O gate garante que o script define as cinco tabelas ges_*,
// os checks com as listas fechadas corretas, a coluna gerada gut_total,
// índices de chave estrangeira e RLS no padrão da plataforma (leitura pública,
// escrita restrita a authenticated, sem anon).
// ══════════════════════════════════════════════════════════════════

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const schemaPath = path.join(__dirname, '..', 'supabase', '60_gestao_schema.sql')
const gutPath = path.join(__dirname, '..', 'shared', 'gut.js')

const schema = () => fs.readFileSync(schemaPath, 'utf8')

test('as cinco tabelas são criadas e todas têm prefixo ges_', () => {
  const sql = schema()
  const tabelas = [
    'ges_acoes',
    'ges_indicadores',
    'ges_indicador_valores',
    'ges_pop',
    'ges_causas',
  ]
  for (const t of tabelas) {
    assert.match(
      sql,
      new RegExp(`create table if not exists ${t}\\b`, 'i'),
      `Tabela ${t} deve ser criada com if not exists e prefixo ges_`
    )
  }
})

test('migração é estritamente aditiva: sem drop table/column e alter table restrito a ges_*', () => {
  const sql = schema()
  assert.equal(
    (sql.match(/drop\s+table/gi) || []).length,
    0,
    'Migração aditiva não pode conter DROP TABLE'
  )
  assert.equal(
    (sql.match(/drop\s+column/gi) || []).length,
    0,
    'Migração aditiva não pode conter DROP COLUMN'
  )

  const alters = sql.match(/alter\s+table\s+([^\s]+)/gi) || []
  assert.ok(alters.length >= 5, 'Deve conter alter table para habilitar RLS nas tabelas ges_')
  for (const a of alters) {
    const nomeTabela = a.replace(/alter\s+table\s+/i, '').trim()
    assert.ok(
      nomeTabela.startsWith('ges_'),
      `alter table deve atuar exclusivamente em tabelas ges_*, encontrou: ${nomeTabela}`
    )
  }
})

test('gut_total é coluna gerada armazenada e não coluna gravável comum', () => {
  const sql = schema()
  const match = sql.match(/gut_total\s+integer\s+generated\s+always\s+as\s*\(([^)]+)\)\s+stored/i)
  assert.ok(match, 'gut_total deve ser gerada com generated always as (...) stored')
  assert.match(match[1], /g\s*\*\s*u\s*\*\s*t/i, 'gut_total deve ser o produto g * u * t')
  assert.equal(
    (sql.match(/generated\s+always\s+as/gi) || []).length,
    1,
    'generated always as deve aparecer apenas para gut_total'
  )
})

test('a escala aceita por g, u e t no banco é idêntica a GUT_ESCALA de shared/gut.js', async () => {
  const sql = schema()
  const { GUT_ESCALA } = await import(gutPath)
  assert.ok(Array.isArray(GUT_ESCALA), 'GUT_ESCALA deve ser exportada')

  const esperadoSql = GUT_ESCALA.join(', ')
  for (const dim of ['g', 'u', 't']) {
    const regex = new RegExp(`${dim}\\s+integer\\s+check\\s*\\(${dim}\\s+is\\s+null\\s+or\\s+${dim}\\s+in\\s*\\(([0-9,\\s]+)\\)\\)`, 'i')
    const m = sql.match(regex)
    assert.ok(m, `Check de escala para ${dim} deve existir`)
    const valoresBanco = m[1].split(',').map(s => Number(s.trim()))
    assert.deepEqual(
      valoresBanco,
      GUT_ESCALA,
      `Escala do banco para ${dim} deve coincidir com GUT_ESCALA`
    )
  }
})

test('ges_acoes.status tem check com exatamente os 5 estados do fluxo PDCA', () => {
  const sql = schema()
  const estadosEsperados = ['planejada', 'em_execucao', 'verificacao', 'concluida', 'cancelada']
  const m = sql.match(/status\s+text[^,]*check\s*\(status\s+in\s*\(([^)]+)\)\)/i)
  assert.ok(m, 'Check de status em ges_acoes deve existir')

  const estados = m[1].replace(/['"\s]/g, '').split(',')
  assert.deepEqual(
    estados.sort(),
    [...estadosEsperados].sort(),
    'Estados de ges_acoes.status devem ser exatamente os cinco do fluxo'
  )
})

test('ges_causas.categoria tem check com exatamente as 6 categorias do Ishikawa (6M)', () => {
  const sql = schema()
  const seisMEsperados = ['metodo', 'maquina', 'mao_de_obra', 'material', 'medicao', 'meio_ambiente']
  const m = sql.match(/categoria\s+text[^,]*check\s*\(categoria\s+in\s*\(([^)]+)\)\)/i)
  assert.ok(m, 'Check de categoria em ges_causas deve existir')

  const categorias = m[1].replace(/['"\s]/g, '').split(',')
  assert.deepEqual(
    categorias.sort(),
    [...seisMEsperados].sort(),
    'Categorias de ges_causas devem ser exatamente as 6 do 6M'
  )
})

test('chaves estrangeiras têm índice correspondente', () => {
  const sql = schema()
  assert.match(
    sql,
    /create index if not exists\s+\w+\s+on\s+ges_indicador_valores\s*\(\s*indicador_id\s*\)/i,
    'FK ges_indicador_valores.indicador_id deve ter índice'
  )
  assert.match(
    sql,
    /create index if not exists\s+\w+\s+on\s+ges_causas\s*\(\s*acao_id\s*\)/i,
    'FK ges_causas.acao_id deve ter índice'
  )
})

test('ges_indicador_valores garante unicidade de período por indicador', () => {
  const sql = schema()
  assert.match(
    sql,
    /unique\s*\(\s*indicador_id\s*,\s*periodo\s*\)/i,
    'ges_indicador_valores deve ter constraint unique (indicador_id, periodo)'
  )
})

test('todas as 5 tabelas têm RLS ativada com leitura para public e escrita para authenticated', () => {
  const sql = schema()
  const tabelas = [
    'ges_acoes',
    'ges_indicadores',
    'ges_indicador_valores',
    'ges_pop',
    'ges_causas',
  ]

  for (const t of tabelas) {
    assert.match(
      sql,
      new RegExp(`alter table ${t} enable row level security`, 'i'),
      `RLS deve estar habilitada em ${t}`
    )
    assert.match(
      sql,
      new RegExp(`create policy \\w+ on ${t} for select using \\(true\\)`, 'i'),
      `Policy de select público deve existir em ${t}`
    )
    for (const cmd of ['insert', 'update', 'delete']) {
      assert.match(
        sql,
        new RegExp(`create policy \\w+ on ${t} for ${cmd} to authenticated`, 'i'),
        `Policy de ${cmd} restrita a authenticated deve existir em ${t}`
      )
    }
  }

  assert.doesNotMatch(
    sql,
    /\banon\b/i,
    'Nenhuma policy deve nomear o papel anon para escrita'
  )
})

test('bloco de RLS é reexecutável com drop policy if exists antes de cada create policy', () => {
  const sql = schema()
  const creates = sql.match(/create\s+policy\s+(\w+)\s+on\s+(\w+)/gi) || []
  assert.equal(creates.length, 20, 'Devem existir 20 policies (4 por tabela em 5 tabelas)')

  for (const cp of creates) {
    const [, nomePolicy, tabela] = cp.match(/create\s+policy\s+(\w+)\s+on\s+(\w+)/i)
    assert.match(
      sql,
      new RegExp(`drop policy if exists ${nomePolicy} on ${tabela}`, 'i'),
      `drop policy if exists ${nomePolicy} on ${tabela} deve anteceder create policy`
    )
  }
})
