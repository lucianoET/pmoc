const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const migracaoPath = path.join(__dirname, '..', 'supabase', '12_maquinas_areas_operacoes.sql')

test('migração de áreas e operações mantém o fluxo transacional e sem seeds', () => {
  assert.ok(fs.existsSync(migracaoPath), 'a migração 12 deve existir')
  const sql = fs.readFileSync(migracaoPath, 'utf8')

  assert.match(sql, /create table if not exists maq_areas/i)
  assert.match(sql, /create table if not exists maq_operacoes/i)
  assert.match(sql, /create or replace function concluir_maq_operacao/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /update maq_ativos/i)
  assert.match(sql, /insert into maq_uso_registros/i)
  assert.match(sql, /auth\.uid\(\)/i)
  assert.match(sql, /revoke execute on function concluir_maq_operacao\(uuid,numeric,numeric,numeric,text\) from anon/i)
  assert.doesNotMatch(sql, /Pátio Principal|Sgt Silva|Cortador Husqvarna 550/i)
})