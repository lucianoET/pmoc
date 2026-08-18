const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate do ciclo de vida da OS no módulo Máquinas.
//
// O que estava errado antes: toda OS nascia com status 'concluida' fixo no
// insert, então não existia serviço aberto nem em execução — e, pior, a baixa
// de estoque acontecia junto da criação. Registrar um serviço que ainda não
// começou já tirava a peça da prateleira no sistema.
//
// Estes casos protegem as três coisas que a correção estabelece: a situação
// vem da tela, a baixa acontece na conclusão, e uma OS pode carregar vários
// itens de manutenção (migração 29).
const RAIZ = path.join(__dirname, '..')
const APP = fs.readFileSync(path.join(RAIZ, 'maquinas', 'app.js'), 'utf8')
const HTML = fs.readFileSync(path.join(RAIZ, 'maquinas', 'index.html'), 'utf8')
const SCHEMA_01 = fs.readFileSync(path.join(RAIZ, 'supabase', '01_maquinas_schema.sql'), 'utf8')
const MIGRACAO_29 = path.join(RAIZ, 'supabase', '29_maquinas_os_itens.sql')

// ── migração 29 ───────────────────────────────────────────────────────────
test('a migração 29 existe, cria maq_os_itens e é aditiva', () => {
  assert.ok(fs.existsSync(MIGRACAO_29), 'supabase/29_maquinas_os_itens.sql deveria existir')
  const sql = fs.readFileSync(MIGRACAO_29, 'utf8')

  assert.match(sql, /create table if not exists maq_os_itens/)
  assert.match(sql, /os_id uuid not null references maq_os\(id\) on delete cascade/)
  assert.match(sql, /unique \(os_id, plano_id\)/,
    'o mesmo plano não pode entrar duas vezes na mesma OS — isso é erro de digitação, não intenção')
  assert.match(sql, /alter table maq_os_itens enable row level security/)

  // regra de plataforma: migração é aditiva, nunca DROP de tabela ou coluna
  assert.doesNotMatch(sql, /drop\s+table/i)
  assert.doesNotMatch(sql, /drop\s+column/i)
})

test('a migração 29 não remove maq_os.plano_id — o caminho antigo continua válido', () => {
  const sql = fs.readFileSync(MIGRACAO_29, 'utf8')
  // a migração só toca a tabela nova; maq_os não é alterada em nada
  assert.doesNotMatch(sql, /alter table maq_os\s/i,
    'plano_id segue preenchido com o primeiro item, para não quebrar consulta nem relatório anterior')
  assert.match(SCHEMA_01, /plano_id integer references maq_planos\(id\)/,
    'a coluna original precisa continuar existindo no schema base')
})

// ── situação da OS ────────────────────────────────────────────────────────
test('a situação da OS vem da tela, não é mais fixa em concluída', () => {
  assert.match(HTML, /id="os-status"/, 'o modal de OS precisa do seletor de situação')
  assert.match(APP, /const status = document\.getElementById\('os-status'\)\.value/)
  assert.doesNotMatch(APP, /insert\(\{[^}]*status: 'concluida'/,
    'era este literal que fazia toda OS nascer concluída')
})

test('os rótulos de situação cobrem exatamente a lista fechada do banco', () => {
  // a lista fechada é do banco (migração 01); a tela só traduz
  const check = SCHEMA_01.match(/status text not null default 'pendente' check \(status in \(([^)]+)\)\)/)
  assert.ok(check, 'maq_os.status deveria continuar com lista fechada no schema')
  const doBanco = check[1].split(',').map(s => s.trim().replace(/'/g, '')).sort()

  const bloco = APP.match(/const STATUS_OS = \{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar STATUS_OS')
  const naTela = [...bloco[1].matchAll(/^\s{2}(\w+):/gm)].map(m => m[1]).sort()

  assert.deepEqual(naTela, doBanco,
    'a tela e o banco precisam falar do mesmo conjunto de situações — nem a mais, nem a menos')
})

test('o fluxo é aberta → execução → concluída, e os estados finais não avançam', () => {
  const bloco = APP.match(/function proximoStatus\(status\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar proximoStatus')
  assert.match(bloco[1], /if\(status === 'pendente'\)\s+return \{ status: 'em_andamento'/)
  assert.match(bloco[1], /if\(status === 'em_andamento'\) return \{ status: 'concluida'/)
  assert.match(bloco[1], /return null/,
    'concluída e cancelada são finais — sem botão de avançar')
})

// ── baixa de estoque só na conclusão ──────────────────────────────────────
test('a baixa de peças mora numa função só, chamada pelos caminhos de conclusão', () => {
  assert.match(APP, /async function baixarPecasDaOS\(osId, planoIds, pecasReparo, reparo\)/)

  // três caminhos levam à conclusão e os três precisam debitar igual
  const chamadas = APP.match(/await baixarPecasDaOS\(/g) || []
  assert.ok(chamadas.length >= 3,
    `esperado ao menos 3 chamadas de baixarPecasDaOS (criar concluída, concluir pela lista, concluir pelo detalhe), encontradas ${chamadas.length}`)
})

test('criar uma OS aberta não baixa estoque', () => {
  const bloco = APP.match(/async function salvarOS\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar salvarOS')
  assert.match(bloco[1], /if\(concluida && osNova\?\.id\)\{\s*\n\s*await baixarPecasDaOS/,
    'a baixa dentro de salvarOS precisa estar sob a condição de OS concluída')
  assert.match(bloco[1], /custo_pecas: concluida \? custo_pecas : 0/,
    'OS aberta não consumiu peça nenhuma ainda — custo entra na conclusão')
  assert.match(bloco[1], /data_conclusao: concluida \? data : null/)
})

test('concluir uma OS aberta baixa o estoque e fecha os itens', () => {
  const bloco = APP.match(/async function concluirOS\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar concluirOS')
  assert.match(bloco[1], /status: 'concluida'/)
  assert.match(bloco[1], /maq_os_itens'\)\.update\(\{ concluido: true \}\)/)
  assert.match(bloco[1], /await baixarPecasDaOS/)
  assert.match(bloco[1], /confirm\(/, 'concluir baixa estoque — o usuário confirma antes')
})

// ── tolerância à ausência da migração 29 ──────────────────────────────────
test('o módulo continua funcionando se a migração 29 não tiver rodado', () => {
  // mesmo padrão do catálogo de reparos (migração 26): carga fora do Promise.all
  // principal, erro contido, lista vazia
  const promiseAll = APP.match(/const \[a, o, m, p, pm, ab, ur, ar, op\] = await Promise\.all\(\[([\s\S]*?)\]\)/)
  assert.ok(promiseAll, 'carregarTudo deveria continuar com o Promise.all principal')
  assert.doesNotMatch(promiseAll[1], /maq_os_itens/,
    'maq_os_itens fora do Promise.all — senão a ausência da tabela derruba a carga inteira')

  assert.match(APP, /async function carregarItensOS\(\)\{[\s\S]*?OS_ITENS = error \? \[\] : \(data \|\| \[\]\)/)
  assert.match(APP, /function itensDaOS\(os\)\{[\s\S]*?if\(!os\.plano_id\) return \[\]/,
    'sem a migração 29, a OS volta a ser de um item só, pelo plano_id de sempre')
})

// ── aba Máquinas ──────────────────────────────────────────────────────────
test('a tabela de máquinas perdeu categoria e fabricante e ganhou os dois botões', () => {
  const cabecalho = HTML.match(/<thead><tr>\s*<th>Código<\/th><th>Nome<\/th>([\s\S]*?)<\/tr><\/thead>/)
  assert.ok(cabecalho, 'a tabela de máquinas deveria continuar começando por Código e Nome')
  assert.doesNotMatch(cabecalho[1], /Categoria/, 'Categoria saiu da tabela — vive no modal da máquina')
  assert.doesNotMatch(cabecalho[1], /Fabricante/, 'Fabricante/Modelo saiu da tabela')

  assert.match(APP, /abrirModalUso\(\$\{a\.id\}\)[\s\S]*?>USO</, 'a linha precisa do botão USO')
  assert.match(APP, /abrirModalOS\(\$\{a\.id\}\)[\s\S]*?>OS</, 'a linha precisa do botão OS')

  // o colspan da linha vazia tem que bater com o número de colunas, senão a
  // mensagem de "nenhuma máquina" fica torta
  const colunas = (HTML.match(/<th>Código<\/th><th>Nome<\/th>\s*<th>Uso atual<\/th><th>Status<\/th><th>Local<\/th><th>Ações<\/th>/) || []).length
  assert.equal(colunas, 1, 'a tabela de máquinas deveria ter exatamente as 6 colunas previstas')
  assert.match(HTML, /id="tb-ativos"><tr><td colspan="6"/)
  assert.match(APP, /colspan="6"[^`]*Nenhuma máquina encontrada/)
})

test('registrar uso não cria OS — grava uso e horímetro, e só', () => {
  const bloco = APP.match(/async function salvarUso\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar salvarUso')
  assert.match(bloco[1], /from\('maq_uso_registros'\)\.insert/)
  assert.match(bloco[1], /from\('maq_ativos'\)\.update\(\{ uso_atual: uso_total \}\)/)
  assert.doesNotMatch(bloco[1], /from\('maq_os'\)/,
    'anotar horímetro não é ordem de serviço — era isso que obrigava a criar OS de mentira')
})

// ── vencimentos agrupados ─────────────────────────────────────────────────
test('a aba de vencimentos agrupa por máquina, não por item', () => {
  assert.match(APP, /function vencimentosPorMaquina\(\)/)
  const bloco = APP.match(/function renderVencimentos\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar renderVencimentos')
  assert.match(bloco[1], /const grupos = vencimentosPorMaquina\(\)/,
    'a aba desenha um cartão por máquina — um por item fazia a página passar de vinte telas')
  assert.match(bloco[1], /abrirVencMaquina\(/, 'o cartão abre o popup com os itens daquela máquina')
})

test('o popup de itens tem checkbox por item e gera uma OS com os marcados', () => {
  assert.match(HTML, /id="modal-venc"/)
  assert.match(APP, /class="venc-check"/, 'cada item de manutenção precisa da própria caixa de marcação')
  assert.match(APP, /function planosMarcadosNoVenc\(\)/)
  assert.match(APP, /function abrirOSDosItensMarcados\(\)\{[\s\S]*?abrirModalOS\(ativoId, planos\[0\], planos\)/,
    'uma OS com os itens marcados — não uma OS por item')
})

// ── detalhe e exportação da OS ────────────────────────────────────────────
test('a linha da OS abre o detalhe', () => {
  const bloco = APP.match(/function renderOS\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar renderOS')
  assert.match(bloco[1], /onclick="abrirDetalheOS\('\$\{o\.id\}'\)"/)
  assert.match(HTML, /id="modal-os-detalhe"/)
  assert.match(APP, /async function salvarDetalheOS\(\)/)
})

test('concluir pelo detalhe baixa estoque igual a concluir pela lista', () => {
  const bloco = APP.match(/async function salvarDetalheOS\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /const virouConcluida = status === 'concluida' && os\.status !== 'concluida'/)
  assert.match(bloco[1], /if\(virouConcluida\)\{[\s\S]*?await baixarPecasDaOS/,
    'deixar um caminho de conclusão sem baixa seria um furo no estoque')
})

test('a exportação da OS não introduz dependência externa', () => {
  for (const fn of ['exportarOSPdf', 'exportarOSDoc', 'exportarOSCsv']) {
    assert.ok(APP.includes(`function ${fn}(`), `${fn} deveria existir`)
  }
  // decisão do usuário: zero dependência — PDF pela impressão do navegador,
  // Word por blob HTML, Excel por CSV
  assert.doesNotMatch(APP, /jspdf|sheetjs|xlsx|cdn\.jsdelivr[^']*(pdf|xlsx)/i,
    'a exportação é por recurso nativo do navegador, sem biblioteca via CDN')
  assert.match(APP, /window\.open\('', '_blank'\)[\s\S]*?janela\.print\(\)/)
  assert.match(APP, /'application\/msword'/)
})

test('o CSV da OS protege contra injeção de fórmula em planilha', () => {
  // mesma proteção que transportes/app.js já aplicava — uma célula começando
  // com =, +, - ou @ vira comando ao abrir no Excel
  assert.match(APP, /function csvSeguro\(valor\)\{[\s\S]*?\/\^\[=\+\\-@\]\/\.test\(texto\)/)
  assert.match(APP, /csvEscape\(csvSeguro\(v\)\)/)
})
