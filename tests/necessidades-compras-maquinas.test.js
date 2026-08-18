const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate da aba Necessidades (ex-"Lista de compras") e das listas de compra.
//
// A aba antiga era uma foto: mostrava o que faltava, mas ninguém conseguia
// dizer "isto já foi pedido" nem dar entrada no que chegou — a necessidade
// sumia assim que a página recarregava. Este gate cresce em três commits:
// migração 34 (colunas do material + tabelas de lista), material com
// sistema/aplicação, e a aba Necessidades com cálculo, geração de lista e
// recebimento item a item.
const RAIZ = path.join(__dirname, '..')
const APP = fs.readFileSync(path.join(RAIZ, 'maquinas', 'app.js'), 'utf8')
const HTML = fs.readFileSync(path.join(RAIZ, 'maquinas', 'index.html'), 'utf8')
const MIGRACAO = path.join(RAIZ, 'supabase', '34_maquinas_compras_necessidades.sql')

// ── migração 34 ──────────────────────────────────────────────────────────
test('a migração 34 existe e é aditiva', () => {
  assert.ok(fs.existsSync(MIGRACAO), 'supabase/34_maquinas_compras_necessidades.sql deveria existir')
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.doesNotMatch(sql, /drop\s+table/i)
  assert.doesNotMatch(sql, /drop\s+column/i)
})

test('a migração 34 cria as duas tabelas e acrescenta as duas colunas ao material', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /create table if not exists maq_compras_listas/)
  assert.match(sql, /create table if not exists maq_compras_itens/)
  assert.match(sql, /add column if not exists sistema text/)
  assert.match(sql, /add column if not exists aplicacao text/)
})

test('preco_unit existe em maq_compras_itens e o arquivo justifica o congelamento', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /preco_unit numeric/)
  assert.match(sql, /congelado na linha/i)
})

test('unique (lista_id, material_id) impede a mesma peça duas vezes na mesma lista', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /unique \(lista_id, material_id\)/)
})

test('qtd_recebida nasce em 0 e nunca fica negativa', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /qtd_recebida numeric not null default 0 check \(qtd_recebida >= 0\)/)
})

test('os quatro status da lista estão no check', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /check \(status in \('aberta','enviada','recebida','cancelada'\)\)/)
})

test('RLS ligada nas duas tabelas novas', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  for (const tabela of ['maq_compras_listas', 'maq_compras_itens']) {
    assert.match(sql, new RegExp(`alter table ${tabela}\\s+enable row level security`),
      `${tabela} precisa de RLS ligado`)
  }
})

test('os dois índices de maq_compras_itens existem', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /create index if not exists maq_compras_itens_lista_idx on maq_compras_itens\(lista_id\)/)
  assert.match(sql, /create index if not exists maq_compras_itens_material_idx on maq_compras_itens\(material_id\)/)
})

test('nenhuma coluna de aquisição foi acrescentada a maq_materiais — a quantidade é derivada', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  // as únicas duas colunas novas em maq_materiais são sistema e aplicacao
  const alteracoesMaterial = sql.match(/alter table maq_materiais add column if not exists (\w+)/g) || []
  const colunas = alteracoesMaterial.map(l => l.replace('alter table maq_materiais add column if not exists ', ''))
  assert.deepEqual(colunas.sort(), ['aplicacao', 'sistema'],
    'a quantidade em aquisição é derivada de quantidade - qtd_recebida, não uma coluna denormalizada')
})

// ── material: sistema e aplicação (migração 34) ────────────────────────────
test('o modal de material tem os dois campos novos, com o datalist de sugestões', () => {
  assert.match(HTML, /id="mat-sistema"/)
  assert.match(HTML, /id="mat-aplicacao"/)
  assert.match(HTML, /id="lista-sistemas"/)
  for (const sugestao of ['Motor', 'Transmissão', 'Hidráulico', 'Elétrico', 'Corte', 'Chassi', 'Filtragem', 'Lubrificação']) {
    assert.match(HTML, new RegExp(`<option value="${sugestao}">`),
      `sugestão "${sugestao}" deveria estar no datalist de sistemas`)
  }
})

test('a tabela do estoque tem as colunas Sistema e Aplicação', () => {
  assert.match(HTML, /<th>Sistema<\/th><th>Aplicação<\/th>/)
  assert.match(APP, /esc\(m\.sistema \|\| '—'\)/)
  assert.match(APP, /esc\(m\.aplicacao \|\| '—'\)/)
})

test('opcoesAplicacao() põe Vários no topo e junta ATIVOS.tipo_modelo com fabricante+modelo de MODELOS', () => {
  const bloco = APP.match(/function opcoesAplicacao\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar opcoesAplicacao')
  assert.match(bloco[1], /ATIVOS\.map\(a => a\.tipo_modelo\)/)
  assert.match(bloco[1], /MODELOS\.map\(m => `\$\{m\.fabricante\} \$\{m\.modelo\}`/)
  assert.match(bloco[1], /return \['Vários', \.\.\.distintas\]/)
})

test('salvarMaterial() só envia sistema/aplicação quando a migração 34 está disponível (D7)', () => {
  const salvar = APP.match(/async function salvarMaterial\(\)\{([\s\S]*?)\n\}/)
  assert.ok(salvar)
  assert.match(salvar[1], /if\(MIGRACAO_34\)\{[\s\S]*?campos\.sistema[\s\S]*?campos\.aplicacao/,
    'num banco sem a migração, mandar coluna inexistente derrubaria todo o cadastro de material')
})
