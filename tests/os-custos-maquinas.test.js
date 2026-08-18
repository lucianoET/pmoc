const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate dos custos da OS.
//
// Antes, custo_pecas e custo_mo eram números digitados na tela: ninguém sabia
// de quais peças nem de quantas horas o valor tinha saído. Agora a OS carrega
// as duas listas e o custo é a soma delas — peça é quantidade × preço, mão de
// obra é horas × valor da hora.
const RAIZ = path.join(__dirname, '..')
const APP = fs.readFileSync(path.join(RAIZ, 'maquinas', 'app.js'), 'utf8')
const HTML = fs.readFileSync(path.join(RAIZ, 'maquinas', 'index.html'), 'utf8')
const MIGRACAO = path.join(RAIZ, 'supabase', '30_maquinas_os_custos.sql')

// ── migração 30 ───────────────────────────────────────────────────────────
test('a migração 30 cria as duas listas e a configuração, e é aditiva', () => {
  assert.ok(fs.existsSync(MIGRACAO), 'supabase/30_maquinas_os_custos.sql deveria existir')
  const sql = fs.readFileSync(MIGRACAO, 'utf8')

  assert.match(sql, /create table if not exists maq_os_materiais/)
  assert.match(sql, /create table if not exists maq_os_servicos/)
  assert.match(sql, /create table if not exists maq_config/)

  for (const tabela of ['maq_os_materiais', 'maq_os_servicos', 'maq_config']) {
    assert.match(sql, new RegExp(`alter table ${tabela}\\s+enable row level security`),
      `${tabela} precisa de RLS ligado`)
  }

  assert.doesNotMatch(sql, /drop\s+table/i)
  assert.doesNotMatch(sql, /drop\s+column/i)
  assert.doesNotMatch(sql, /alter table maq_os\s/i,
    'a migração 30 não altera maq_os — as colunas de custo já existem desde a 01')
})

test('os valores unitários são congelados na linha, não só referenciados', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /preco_unit numeric check \(preco_unit is null or preco_unit >= 0\)/,
    'o preço da peça no momento da OS — reajuste no catálogo não pode mudar OS fechada')
  assert.match(sql, /valor_hora numeric check \(valor_hora is null or valor_hora >= 0\)/)
  assert.match(sql, /unique \(os_id, material_id\)/,
    'a mesma peça não entra duas vezes na mesma OS — soma-se a quantidade')
})

test('serviço avulso é possível: servico_id nullable com descrição obrigatória no lugar', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /servico_id bigint references rep_servicos\(id\)/)
  assert.doesNotMatch(sql, /servico_id bigint not null/,
    'num banco sem a migração 26 não há catálogo — a linha precisa valer pela descrição')
  assert.match(sql, /check \(servico_id is not null or nullif\(btrim\(coalesce\(descricao,''\)\), ''\) is not null\)/,
    'linha sem serviço e sem descrição não diz nada')
})

test('o valor da hora nasce vazio — nenhum número é inventado', () => {
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /values \('valor_hora_padrao', null,/,
    'inventar um valor produziria custo de mão de obra falso em toda OS')
})

// ── cálculo ───────────────────────────────────────────────────────────────
test('o custo de peças é quantidade × preço, e o de mão de obra é horas × valor da hora', () => {
  const pecas = APP.match(/function custoPecasDaOS\(osId\)\{([\s\S]*?)\n\}/)
  assert.ok(pecas, 'maquinas/app.js deveria declarar custoPecasDaOS')
  assert.match(pecas[1], /Number\(m\.quantidade \|\| 0\) \* Number\(m\.preco_unit \|\| 0\)/)

  const mo = APP.match(/function custoMaoDeObraDaOS\(osId\)\{([\s\S]*?)\n\}/)
  assert.ok(mo, 'maquinas/app.js deveria declarar custoMaoDeObraDaOS')
  assert.match(mo[1], /Number\(s\.horas \|\| 0\) \* Number\(s\.valor_hora \|\| 0\)/)
})

test('os custos não são mais digitados na tela', () => {
  assert.doesNotMatch(APP, /custo_pecas: parseFloat\(document\.getElementById\('osd-custo-pecas'\)/,
    'era assim que o total podia ser "consertado" sem corrigir a linha que o produziu')
  assert.doesNotMatch(APP, /custo_mo: parseFloat\(document\.getElementById\('osd-custo-mo'\)/)
  // e no markup deixaram de ser campo
  assert.doesNotMatch(HTML, /<input[^>]*id="osd-custo-pecas"/)
  assert.doesNotMatch(HTML, /<input[^>]*id="osd-custo-mo"/)
  assert.match(HTML, /id="osd-custo-total"/, 'o total precisa aparecer somado')
})

test('a tela e o banco usam a mesma conta', () => {
  const salvar = APP.match(/async function salvarDetalheOS\(\)\{([\s\S]*?)\n\}/)
  assert.ok(salvar)
  assert.match(salvar[1], /OSD_PECAS\.reduce\(\(s, p\) => s \+ Number\(p\.quantidade \|\| 0\) \* Number\(p\.preco_unit \|\| 0\), 0\)/)
  assert.match(salvar[1], /OSD_SERVICOS\.reduce\(\(s, x\) => s \+ Number\(x\.horas \|\| 0\) \* Number\(x\.valor_hora \|\| 0\), 0\)/)
  assert.match(salvar[1], /custo_pecas: custoPecas/)
  assert.match(salvar[1], /custo_mo: custoMO/)
})

test('as listas vão ao banco antes dos totais', () => {
  const salvar = APP.match(/async function salvarDetalheOS\(\)\{([\s\S]*?)\n\}/)
  assert.ok(salvar)
  const posListas = salvar[1].indexOf('gravarListasDaOS')
  const posUpdate = salvar[1].indexOf("from('maq_os').update")
  assert.ok(posListas > -1 && posUpdate > posListas,
    'o total gravado precisa ser a soma do que ficou gravado nas listas, não de um estado de tela que ainda pode falhar')
})

// ── valor da hora ─────────────────────────────────────────────────────────
test('valor da hora ausente é null, não zero', () => {
  const bloco = APP.match(/function valorHoraPadrao\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar valorHoraPadrao')
  assert.match(bloco[1], /return null/,
    'zero afirmaria que a hora não custa nada; null diz que ninguém informou ainda')
  assert.match(APP, /Nenhum valor de hora-homem cadastrado no módulo/,
    'a tela precisa dizer por que a mão de obra está zerada')
})

test('o valor da hora é editável pelo usuário, sem passar por deploy', () => {
  assert.match(HTML, /id="cfg-valor-hora"/)
  assert.match(APP, /async function salvarValorHora\(\)/)
  assert.match(APP, /from\('maq_config'\)\s*\n?\s*\.upsert\(\{ chave: 'valor_hora_padrao'/)
  assert.match(APP, /valor: valor === null \? null : String\(valor\)/,
    'campo vazio apaga o valor — apagar é diferente de gravar zero')
})

// ── baixa de estoque a partir da lista ────────────────────────────────────
test('a mesma peça não é debitada duas vezes quando está no plano e no diagnóstico', () => {
  const bloco = APP.match(/function pecasPrevistasDaOS\(planoIds, reparoId\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar pecasPrevistasDaOS')
  assert.match(bloco[1], /new Map\(\)/)
  assert.match(bloco[1], /atual\.quantidade \+= Number\(quantidade\)/,
    'peça repetida soma quantidade em vez de virar duas linhas de baixa')
})

test('a conclusão debita a lista da OS, com fallback para as OS anteriores à migração 30', () => {
  const bloco = APP.match(/async function concluirOS\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /const daOS = OS_MATERIAIS\.filter\(m => m\.os_id === id\)/)
  assert.match(bloco[1], /daOS\.length\s*\n?\s*\? daOS\s*\n?\s*: pecasPrevistasDaOS\(/,
    'OS gravada antes da migração 30 não tem lista — a previsão é resolvida na hora para ela não ficar sem baixa')
})

// ── tolerância ────────────────────────────────────────────────────────────
test('o módulo continua funcionando se a migração 30 não tiver rodado', () => {
  const promiseAll = APP.match(/const \[a, o, m, p, pm, ab, ur, ar, op\] = await Promise\.all\(\[([\s\S]*?)\]\)/)
  assert.ok(promiseAll)
  for (const tabela of ['maq_os_materiais', 'maq_os_servicos', 'maq_config']) {
    assert.ok(!promiseAll[1].includes(tabela),
      `${tabela} fora do Promise.all — senão a ausência da tabela derruba a carga inteira`)
  }
  assert.match(APP, /OS_MATERIAIS = mt\.error \? \[\] : \(mt\.data \|\| \[\]\)/)
  assert.match(APP, /OS_SERVICOS\s+= sv\.error \? \[\] : \(sv\.data \|\| \[\]\)/)
  assert.match(APP, /CONFIG = cf\.error \? \{\} : /)
})

test('as duas listas aparecem no modal de detalhe, com botão de adicionar', () => {
  assert.match(HTML, /id="osd-pecas"/)
  assert.match(HTML, /id="osd-servicos"/)
  assert.match(HTML, /onclick="adicionarPecaOS\(\)"/)
  assert.match(HTML, /onclick="adicionarServicoOS\(\)"/)
  for (const fn of ['adicionarPecaOS', 'removerPecaOS', 'trocarPecaOS', 'atualizarPecaOS',
                    'adicionarServicoOS', 'removerServicoOS', 'trocarServicoOS', 'atualizarServicoOS']) {
    assert.ok(APP.includes(`function ${fn}(`), `${fn} deveria existir`)
  }
})
