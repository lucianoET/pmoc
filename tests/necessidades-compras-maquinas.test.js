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

// ── aba Necessidades: renomeação (D3) ───────────────────────────────────────
test('a aba se chama Necessidades e tem id necessidades; nenhum id antigo de compras sobrou', () => {
  assert.match(HTML, /id="view-necessidades"/)
  assert.match(HTML, /id="necessidades-content"/)
  assert.match(APP, /id: 'necessidades', icone: '🛒', label: 'Necessidades'/)
  assert.doesNotMatch(HTML, /view-compras|compras-content/)
  assert.doesNotMatch(APP, /id: 'compras'/)
  assert.doesNotMatch(APP, /function renderCompras\(/)
  assert.match(APP, /function renderNecessidades\(\)\{/)
})

test('exportarComprasCSV mantém o nome (D8), mas lê o novo estado', () => {
  assert.match(APP, /function exportarComprasCSV\(\)\{/)
  const bloco = APP.match(/function exportarComprasCSV\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /window\._necessidadesData/)
  assert.match(bloco[1], /'necessidades-maquinas-'/)
})

// ── carga tolerante (D7) ────────────────────────────────────────────────────
test('carregarCompras() está fora do Promise.all principal e zera as listas em caso de erro', () => {
  const promiseAll = APP.match(/const \[a, o, m, p, pm, ab, ur, ar, op\] = await Promise\.all\(\[([\s\S]*?)\]\)/)
  assert.ok(promiseAll)
  assert.ok(!promiseAll[1].includes('maq_compras_listas') && !promiseAll[1].includes('maq_compras_itens'),
    'maq_compras_listas/maq_compras_itens fora do Promise.all principal — senão a ausência das tabelas derruba a carga inteira')

  const bloco = APP.match(/async function carregarCompras\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar carregarCompras')
  assert.match(bloco[1], /COMPRAS_LISTAS = indisponivel \? \[\] : /)
  assert.match(bloco[1], /COMPRAS_ITENS\s+= indisponivel \? \[\] : /)
  assert.match(bloco[1], /MIGRACAO_34 = !indisponivel/)

  assert.match(APP, /await carregarComentarios\(\)\s*\n\s*await carregarCompras\(\)/,
    'carregarCompras() entra logo depois de carregarComentarios(), no molde de carregarCustosOS()')
})

// ── cálculo (D4) ─────────────────────────────────────────────────────────────
test('necessidadePorMaterial() implementa a fórmula travada', () => {
  const bloco = APP.match(/function necessidadePorMaterial\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar necessidadePorMaterial')
  const corpo = bloco[1]

  // reposição de mínimo entra por Math.max (piso), não somada
  assert.match(corpo, /l\.bruto = Math\.max\(l\.prev \+ l\.corr, l\.min_rep\)/,
    'a reposição de mínimo é PISO da demanda, não parcela somada — somar contaria a peça duas vezes')
  // a_comprar desconta estoque e aquisição
  assert.match(corpo, /l\.a_comprar = Math\.max\(0, l\.bruto - Number\(l\.material\.estoque_atual\) - l\.aquisicao\)/)
  // a linha aparece quando há o que comprar ou algo em aquisição
  assert.match(corpo, /\.filter\(l => l\.a_comprar > 0 \|\| l\.aquisicao > 0\)/)
})

test('corr sai de pecasParaBaixa() e considera exatamente os quatro status não executados', () => {
  assert.match(APP, /const OS_NAO_EXECUTADA = \['aberta', 'delineamento', 'espera', 'pendente'\]/)
  const bloco = APP.match(/function necessidadePorMaterial\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /OS_LIST\.filter\(o => OS_NAO_EXECUTADA\.includes\(o\.status\)\)/)
  assert.match(bloco[1], /pecasParaBaixa\(os\)/)
})

test('prev usa o mesmo corte de 70% de calcVencimentos()', () => {
  const bloco = APP.match(/function necessidadePorMaterial\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /calcVencimentos\(\)\.filter\(x => x\.pct >= 70\)/)
})

// ── geração de lista (D5) ────────────────────────────────────────────────────
test('preco_unit do item é copiado do material na criação da lista', () => {
  const salvar = APP.match(/async function salvarListaCompra\(\)\{([\s\S]*?)\n\}/)
  assert.ok(salvar, 'maquinas/app.js deveria declarar salvarListaCompra')
  assert.match(salvar[1], /preco_unit: material\?\.preco \?\? null/)
})

// ── recebimento item a item (D6) ─────────────────────────────────────────────
test('receberItem() recusa acima do pendente, dá entrada no estoque e fecha a lista sozinha', () => {
  const bloco = APP.match(/async function receberItem\(itemId\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar receberItem')
  assert.match(bloco[1], /if\(quantidade > pendente\)\{/,
    'qtd_recebida nunca pode ultrapassar quantidade — D6')
  assert.match(bloco[1], /tipo: 'entrada'/)
  assert.match(bloco[1], /estoque_atual: novoEstoque/)
  assert.match(bloco[1], /todosRecebidos/)
  assert.match(bloco[1], /status: 'recebida'/)
})

// ── permissões (D9) ──────────────────────────────────────────────────────────
test('criar lista e receber item são oferecidos por podeEscreverNoModulo(), sem lista de cargos nova', () => {
  const podeGerar = APP.match(/const podeGerar = MIGRACAO_34 && podeEscreverNoModulo\(\)/)
  assert.ok(podeGerar, 'o botão de gerar lista depende de podeEscreverNoModulo()')
  assert.match(APP, /podeEscreverNoModulo\(\) && pendente > 0/,
    'o botão de receber depende de podeEscreverNoModulo()')
  // nenhum array de cargos novo — só a função existente é reutilizada
  const declaracoesDeCargos = APP.match(/const CARGOS\w* = \[/g) || []
  assert.equal(declaracoesDeCargos.length, 0,
    'nenhuma lista de cargos nova deveria ter sido introduzida no módulo Máquinas')
})

// ── export (D8) ───────────────────────────────────────────────────────────────
test('existe export CSV por lista, além do export da aba', () => {
  assert.match(APP, /function exportarListaCompraCSV\(listaId\)\{/)
  assert.match(APP, /function exportarComprasCSV\(\)\{/)
  assert.match(APP, /onclick="exportarListaCompraCSV\('\$\{lista\.id\}'\)"/,
    'o cartão de cada lista precisa do botão de export próprio')
})
