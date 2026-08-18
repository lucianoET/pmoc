const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const schemaPath = path.join(__dirname, '..', 'supabase', '26_reparos_schema.sql')
const seedPath = path.join(__dirname, '..', 'supabase', '27_reparos_seed.sql')

const schema = () => fs.readFileSync(schemaPath, 'utf8')
const seed = () => fs.readFileSync(seedPath, 'utf8')

test('migração 26 cria o catálogo de reparos sem tocar em objeto existente', () => {
  assert.ok(fs.existsSync(schemaPath), 'a migração 26 deve existir')
  const sql = schema()

  for (const t of ['rep_modelos', 'rep_servicos', 'rep_reparos',
                   'rep_reparo_servicos', 'rep_reparo_materiais']) {
    assert.match(sql, new RegExp(`create table if not exists ${t}\\b`, 'i'),
      `${t} deve ser criada com if not exists`)
  }

  // Migração aditiva: nada de DROP TABLE/COLUMN. DROP POLICY é permitido —
  // as policies são recriadas logo abaixo, nas tabelas novas deste módulo.
  assert.doesNotMatch(sql, /drop\s+table/i, 'migração aditiva não derruba tabela')
  assert.doesNotMatch(sql, /drop\s+column/i, 'migração aditiva não derruba coluna')
  assert.doesNotMatch(sql, /alter\s+table\s+\w+\s+drop/i, 'migração aditiva não remove nada')
})

test('colunas novas em tabelas de produção usam add column if not exists', () => {
  const sql = schema()
  for (const [tabela, coluna] of [
    ['maq_ativos', 'modelo_id'],
    ['maq_os', 'reparo_id'],
    ['maq_os', 'sintoma_relatado'],
    ['maq_os', 'reparo_confirmado'],
  ]) {
    assert.match(sql,
      new RegExp(`alter table ${tabela}\\s+add column if not exists ${coluna}\\b`, 'i'),
      `${tabela}.${coluna} deve ser aditiva e reexecutável`)
  }
})

test('todo FK do módulo tem índice (skill supabase-postgres-best-practices)', () => {
  const sql = schema()
  for (const idx of [
    'rep_reparos_modelo_id_idx',
    'rep_reparo_servicos_reparo_id_idx',
    'rep_reparo_servicos_servico_id_idx',
    'rep_reparo_materiais_reparo_id_idx',
    'rep_reparo_materiais_material_id_idx',
    'maq_ativos_modelo_id_idx',
    'maq_os_reparo_id_idx',
  ]) {
    assert.match(sql, new RegExp(`create index if not exists ${idx}\\b`, 'i'),
      `índice ${idx} ausente`)
  }
})

test('sequences de identity recebem grant (Pitfall 4)', () => {
  const sql = schema()
  for (const t of ['rep_modelos', 'rep_servicos', 'rep_reparos',
                   'rep_reparo_servicos', 'rep_reparo_materiais']) {
    assert.match(sql, new RegExp(`grant usage, select on sequence ${t}_id_seq`, 'i'),
      `sequence de ${t} sem grant — insert pelo cliente falharia`)
  }
})

test('RLS ligada nas cinco tabelas, com leitura pública preservada', () => {
  const sql = schema()
  for (const t of ['rep_modelos', 'rep_servicos', 'rep_reparos',
                   'rep_reparo_servicos', 'rep_reparo_materiais']) {
    assert.match(sql, new RegExp(`alter table ${t}\\s+enable row level security`, 'i'),
      `${t} sem RLS`)
  }
  assert.match(sql, /for select using \(true\)/i,
    'leitura pública mantém o acesso do cargo observador')
})

test('escrita passa por RBAC e a estrutura do catálogo é mais restrita', () => {
  const sql = schema()
  assert.match(sql, /create or replace function rep_pode_escrever\(p_roles text\[\]\)/i)
  assert.match(sql, /security definer/i)
  assert.match(sql, /set search_path = public/i)
  assert.match(sql, /auth\.uid\(\)/i)
  assert.match(sql, /ativo = true/i, 'usuário inativo não pode escrever')
  assert.match(sql, /array\['admin','gestor'\]/i, 'modelos e serviços: admin e gestor')
  assert.match(sql, /array\['admin','gestor','tecnico'\]/i,
    'reparos e vínculos: técnico também, senão o catálogo não cresce')
})

test('EXECUTE é revogado de public antes de conceder (default do Postgres)', () => {
  const sql = schema()
  for (const fn of [/rep_pode_escrever\(text\[\]\)/, /rep_confirmar_reparo\(uuid,\s*boolean\)/]) {
    const revoke = new RegExp(`revoke execute on function ${fn.source} from public, anon`, 'i')
    assert.match(sql, revoke, `EXECUTE de ${fn.source} não foi revogado de public`)
  }
})

test('rep_confirmar_reparo trava a linha e é idempotente', () => {
  const sql = schema()
  assert.match(sql, /create or replace function rep_confirmar_reparo/i)
  assert.match(sql, /security invoker/i,
    'invoker: quem não passa na RLS de rep_reparos não incrementa a frequência')
  assert.match(sql, /from maq_os where id = p_os_id for update/i)
  assert.match(sql, /reparo_confirmado is not null/i,
    'segunda chamada deve falhar — retentativa de rede não conta duas vezes')
  assert.match(sql, /update rep_reparos set frequencia = frequencia \+ 1/i)
})

test('seed 27 é reexecutável e faz o backfill por tipo_modelo', () => {
  assert.ok(fs.existsSync(seedPath), 'a migração 27 deve existir')
  const sql = seed()

  const inserts = sql.match(/insert into/gi) || []
  const conflitos = sql.match(/on conflict[^;]*do nothing/gi) || []
  assert.equal(inserts.length, conflitos.length,
    'todo insert do seed precisa de on conflict do nothing para ser reexecutável')

  assert.match(sql, /update maq_ativos a[\s\S]*?set modelo_id = m\.id[\s\S]*?a\.tipo_modelo = m\.codigo/i,
    'backfill deve ligar o ativo ao modelo pelo tipo_modelo legado')
  assert.match(sql, /where a\.modelo_id is null/i,
    'backfill não pode sobrescrever vínculo já definido')
})

test('seed não inventa vínculo de peça — só usa códigos do catálogo 02', () => {
  const sql = seed()
  const trecho = sql.slice(sql.indexOf('rep_reparo_materiais'))
  const pecas = [...trecho.matchAll(/'(PE\d{2})'/g)].map(m => m[1])
  assert.ok(pecas.length > 0, 'o seed deve vincular peças')
  for (const p of pecas) {
    const n = Number(p.slice(2))
    assert.ok(n >= 1 && n <= 34, `${p} está fora do catálogo PE01–PE34 da migração 02`)
  }
  assert.match(sql, /join\s+maq_materiais\s+mt\s+on mt\.codigo = v\.peca/i,
    'vínculo por código, não por id fixo')
})

test('sistema do reparo é lista fechada; sintoma segue texto livre', () => {
  const sql = schema()
  assert.match(sql, /sistema text not null check \(sistema in/i)
  assert.match(sql, /sintoma text not null,/i)
  assert.doesNotMatch(sql, /sintoma text not null check/i,
    'o vocabulário real de sintomas ainda não é conhecido — não fechar agora')
})
