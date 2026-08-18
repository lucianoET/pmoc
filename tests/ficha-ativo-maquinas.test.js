const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate da ficha da máquina.
//
// A decisão que este arquivo protege: a ficha é CONSULTA E AÇÃO, não edição.
// Código, nome, categoria, fabricante, modelo e patrimônio não mudam no dia a
// dia; o uso atual é calculado dos registros; o que a oficina faz todo dia
// (registrar uso, abrir OS, anotar) tem botão na ficha.
const RAIZ = path.join(__dirname, '..')
const APP = fs.readFileSync(path.join(RAIZ, 'maquinas', 'app.js'), 'utf8')
const HTML = fs.readFileSync(path.join(RAIZ, 'maquinas', 'index.html'), 'utf8')
const MIGRACAO = path.join(RAIZ, 'supabase', '32_maquinas_ficha.sql')

// ── migração 32 ───────────────────────────────────────────────────────────
test('a migração 32 cria os comentários e a coluna de instruções, e é aditiva', () => {
  assert.ok(fs.existsSync(MIGRACAO), 'supabase/32_maquinas_ficha.sql deveria existir')
  const sql = fs.readFileSync(MIGRACAO, 'utf8')
  assert.match(sql, /create table if not exists maq_ativo_comentarios/)
  assert.match(sql, /ativo_id integer not null references maq_ativos\(id\) on delete cascade/)
  assert.match(sql, /check \(nullif\(btrim\(texto\), ''\) is not null\)/,
    'comentário vazio não diz nada — o banco recusa')
  assert.match(sql, /alter table maq_ativo_comentarios enable row level security/)
  assert.match(sql, /alter table maq_ativos add column if not exists instrucoes text/)
  assert.doesNotMatch(sql, /drop\s+(table|column)/i)
})

// ── a linha abre a ficha, não o cadastro ──────────────────────────────────
test('clicar na máquina abre a ficha de consulta, não o formulário de edição', () => {
  assert.match(APP, /<tr onclick="abrirFichaAtivo\(\$\{a\.id\}\)">/,
    'a linha da tabela abre a ficha — o cadastro virou exceção atrás de botão restrito')
  assert.match(HTML, /id="modal-ficha"/)
})

test('a identidade da máquina aparece na ficha como texto, sem campo de edição', () => {
  const bloco = APP.match(/function abrirFichaAtivo\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar abrirFichaAtivo')
  for (const rotulo of ['Categoria', 'Fabricante/Modelo', 'Patrimônio', 'Uso atual', 'Status']) {
    assert.ok(bloco[1].includes(`'${rotulo}'`), `a ficha deveria exibir ${rotulo}`)
  }
  assert.match(bloco[1], /calculado dos registros/,
    'a ficha diz de onde o uso atual vem — de registros, não de digitação')
})

test('as ações do dia a dia têm botão na ficha; o cadastro é restrito a admin/gestor', () => {
  assert.match(HTML, /id="ficha-btn-uso"/)
  assert.match(HTML, /id="ficha-btn-os"/)
  assert.match(HTML, /id="ficha-btn-cadastro"/)
  assert.match(APP, /btnCadastro\.style\.display = \['admin','gestor'\]\.includes\(USUARIO\?\.role\) \? '' : 'none'/,
    'editar código, nome ou patrimônio é correção de exceção — não aparece para técnico nem observador')
})

// ── uso atual calculado, nunca digitado na edição ─────────────────────────
test('o uso atual não é editável numa máquina existente', () => {
  const abrir = APP.match(/function abrirModalAtivo\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(abrir)
  assert.match(abrir[1], /campoUso\.disabled = !!ativo/,
    'na edição o campo de uso fica travado — o horímetro pertence aos registros de uso')

  const salvar = APP.match(/async function salvarAtivo\(\)\{([\s\S]*?)\n\}/)
  assert.ok(salvar)
  assert.match(salvar[1], /if\(!ATIVO_EDIT_ID\)\{\s*\n\s*campos\.uso_atual/,
    'uso_atual só entra no payload na criação (leitura inicial do horímetro)')
  assert.doesNotMatch(salvar[1], /^\s*uso_atual:/m,
    'uso_atual não pode voltar para o objeto de campos comum a criação e edição')
})

// ── comentários ───────────────────────────────────────────────────────────
test('a ficha tem diário de bordo: comentários datados e assinados', () => {
  assert.match(APP, /async function carregarComentarios\(\)\{[\s\S]*?COMENTARIOS = error \? \[\] : \(data \|\| \[\]\)/,
    'a carga é tolerante — sem a migração 32 a ficha só não mostra o diário')
  const promiseAll = APP.match(/const \[a, o, m, p, pm, ab, ur, ar, op\] = await Promise\.all\(\[([\s\S]*?)\]\)/)
  assert.ok(promiseAll)
  assert.doesNotMatch(promiseAll[1], /maq_ativo_comentarios/,
    'maq_ativo_comentarios fora do Promise.all principal, como as outras cargas tolerantes')

  const salvar = APP.match(/async function salvarComentarioAtivo\(\)\{([\s\S]*?)\n\}/)
  assert.ok(salvar)
  assert.match(salvar[1], /\.select\(\)/, 'escrita sem efeito sob RLS não pode passar por sucesso')
  assert.match(salvar[1], /if\(!data \|\| !data\.length\)/)
  assert.match(APP, /ficha-comentar-wrap'\)\.style\.display = podeEscreverNoModulo\(\) \? '' : 'none'/,
    'observador lê o diário, não escreve nele')
})

// ── histórico e agenda na ficha ───────────────────────────────────────────
test('a ficha mostra as últimas OS, os últimos usos e as operações agendadas', () => {
  const bloco = APP.match(/function abrirFichaAtivo\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /OS_LIST\.filter\(o => o\.ativo_id === id\)\.slice\(0,5\)/)
  assert.match(bloco[1], /USOS\.filter\(u => u\.ativo_id === id\)\.slice\(0,5\)/)
  assert.match(bloco[1], /OPERACOES\.filter\(o => o\.ativo_id === id && \['programada','em_execucao'\]\.includes\(o\.status\)\)/)
  assert.match(bloco[1], /abrirDetalheOS\('\$\{o\.id\}'\)/, 'a OS listada na ficha abre o próprio detalhe')
})
