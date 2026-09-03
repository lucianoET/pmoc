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
const MIGRACAO_31 = path.join(RAIZ, 'supabase', '31_maquinas_os_fluxo.sql')

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
  // a lista fechada é do banco — a migração 31 alargou a da 01 com os dois
  // estados de oficina (delineamento e espera); a tela só traduz
  const sql31 = fs.readFileSync(MIGRACAO_31, 'utf8')
  const check = sql31.match(/check \(status in \(([^)]+)\)\)/)
  assert.ok(check, 'a migração 31 deveria declarar a lista fechada alargada de maq_os.status')
  const doBanco = check[1].split(',').map(s => s.trim().replace(/'/g, '')).sort()

  const bloco = APP.match(/const STATUS_OS = \{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar STATUS_OS')
  const naTela = [...bloco[1].matchAll(/^\s{2}(\w+):/gm)].map(m => m[1]).sort()

  assert.deepEqual(naTela, doBanco,
    'a tela e o banco precisam falar do mesmo conjunto de situações — nem a mais, nem a menos')
})

test('o fluxo da oficina é aberta → delineamento → espera → execução → concluída', () => {
  const bloco = APP.match(/function proximoStatus\(status\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar proximoStatus')
  assert.match(bloco[1], /if\(status === 'pendente'\)\s+return \{ status: 'delineamento'/)
  assert.match(bloco[1], /if\(status === 'delineamento'\) return \{ status: 'espera'/)
  assert.match(bloco[1], /if\(status === 'espera'\)\s+return \{ status: 'em_andamento'/)
  assert.match(bloco[1], /if\(status === 'em_andamento'\) return \{ status: 'concluida'/)
  assert.match(bloco[1], /return null/,
    'concluída e cancelada são finais — sem botão de avançar')
})

test('encerrar o delineamento registra quem e quando, e a migração 31 dá as colunas', () => {
  const sql31 = fs.readFileSync(MIGRACAO_31, 'utf8')
  assert.match(sql31, /add column if not exists delineado_por text/)
  assert.match(sql31, /add column if not exists delineado_em timestamptz/)
  assert.doesNotMatch(sql31, /drop\s+(table|column)/i,
    'a 31 troca um check e adiciona colunas — não remove nada')

  const bloco = APP.match(/async function avancarOS\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /payload\.delineado_por = USUARIO\?\.nome/)
  assert.match(bloco[1], /payload\.delineado_em = new Date\(\)\.toISOString\(\)/)
})

// ── baixa de estoque só na conclusão ──────────────────────────────────────
test('a baixa de peças mora numa função só, chamada pelos caminhos de conclusão', () => {
  // a função passou a receber a lista de peças já resolvida, em vez de montar
  // a lista por dentro a partir de plano e diagnóstico
  assert.match(APP, /async function baixarPecasDaOS\(osId, pecas, reparo\)/)

  // três caminhos levam à conclusão e os três precisam debitar igual
  const chamadas = APP.match(/await baixarPecasDaOS\(/g) || []
  assert.ok(chamadas.length >= 3,
    `esperado ao menos 3 chamadas de baixarPecasDaOS (criar concluída, concluir pela lista, concluir pelo detalhe), encontradas ${chamadas.length}`)
})

test('criar uma OS que ainda não executa não baixa estoque', () => {
  const bloco = APP.match(/async function salvarOS\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco, 'maquinas/app.js deveria declarar salvarOS')
  assert.match(bloco[1], /const executando = status === 'em_andamento' \|\| concluida/,
    'a baixa acompanha o início da execução, não a conclusão')
  assert.match(bloco[1], /if\(executando && osNova\?\.id\)\{\s*\n\s*await baixarPecasDaOS/,
    'a baixa dentro de salvarOS precisa estar sob a condição de execução')
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

test('entrar em execução pelo detalhe baixa estoque igual a entrar pela lista', () => {
  const bloco = APP.match(/async function salvarDetalheOS\(\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /const virouExecucao = EXECUTADOS\.includes\(status\) && !EXECUTADOS\.includes\(os\.status\)/)
  assert.match(bloco[1], /if\(virouExecucao\) await baixarPecasDaOS/,
    'deixar um caminho de execução sem baixa seria um furo no estoque')
})

test('a baixa é idempotente: quem já debitou na execução não debita de novo na conclusão', () => {
  assert.match(APP, /async function estoqueJaBaixadoDaOS\(osId\)/)
  assert.match(APP, /eq\('os_id', osId\)\.eq\('tipo', 'saida'\)\.limit\(1\)/,
    'a fonte é o movimento de estoque da própria OS, não uma flag paralela')
  const bloco = APP.match(/async function baixarPecasDaOS\(osId, pecas, reparo\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /if\(await estoqueJaBaixadoDaOS\(osId\)\) return/,
    'a guarda mora dentro da baixa — todos os caminhos a ganham de graça')
})

test('a lista de OS sinaliza falta de material e o filtro isola essas OS', () => {
  assert.match(APP, /function faltasDaOS\(os\)/)
  assert.match(APP, /if\(filtro === 'falta'\) lista = lista\.filter\(o => faltasDaOS\(o\)\.length > 0\)/)
  assert.match(HTML, /id="filtro-os"/)
  assert.match(HTML, /<option value="falta">/)
  assert.match(HTML, /<th>Material<\/th>/)
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

// ── painel como resumo, não relatório ─────────────────────────────────────
test('cada bloco do painel corta em 5 linhas e manda o resto para a aba', () => {
  assert.match(APP, /function pintarResumo\(\{ alvo, itens, vazio, aba, linha, teto \}\)/)
  assert.match(APP, /const TETO = 5/)
  assert.match(APP, /const visiveis = itens\.slice\(0, teto\)/,
    'sem o corte, 28 máquinas e 34 materiais viravam três telas de rolagem antes do primeiro dado útil')
  assert.match(APP, /Ver os outros \$\{restantes\}/)
  assert.match(APP, /function irParaAba\(id\)/)
})

test('o painel mostra as OS em aberto — a lista que a situação da OS tornou possível', () => {
  assert.match(HTML, /id="kpi-os-abertas"/)
  assert.match(HTML, /id="painel-os"/)
  assert.match(APP, /!\['concluida','cancelada'\]\.includes\(o\.status\)/,
    'aberto é tudo que ainda não terminou — inclusive delineamento e espera')
})

// ── estoque editável em linha ─────────────────────────────────────────────
test('a linha do estoque edita quantidade, mínimo e preço', () => {
  assert.match(APP, /function editarMaterial\(id\)/)
  assert.match(APP, /async function salvarLinhaMaterial\(id\)/)
  for (const campo of ['ed-atual', 'ed-minimo', 'ed-preco']) {
    assert.ok(APP.includes(`id="${campo}"`), `o campo ${campo} deveria existir na linha em edição`)
  }
  assert.match(APP, /update\(\{ estoque_atual: atual, estoque_minimo: minimo, preco \}\)/)
})

test('mexer na quantidade à mão deixa rastro em maq_estoque_movimentos', () => {
  const bloco = APP.match(/async function salvarLinhaMaterial\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /const diferenca = atual - Number\(material\.estoque_atual\)/)
  assert.match(bloco[1], /tipo: diferenca > 0 \? 'entrada' : 'saida'/)
  assert.match(bloco[1], /motivo: `Ajuste manual no estoque/,
    'sem o movimento, o saldo muda e ninguém sabe por quê')
})

test('a edição em linha valida antes de gravar', () => {
  const bloco = APP.match(/async function salvarLinhaMaterial\(id\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  // A regra não mudou — quantidade, mínimo e preço negativos ou não numéricos
  // continuam sem chegar ao banco. Mudou QUEM a aplica: a comparação escrita à
  // mão aqui virou `lerNumero`, a porta única de maquinas/numeros.js, e o
  // comportamento é provado por tests/maquinas-numeros.test.js. Este caso
  // afirma o que é dele: que esta função não voltou a ler o campo cru.
  for(const campo of ['ed-atual', 'ed-minimo', 'ed-preco']){
    assert.match(bloco[1], new RegExp(`lerNumero\\('${campo}'\\)`),
      `${campo} tem de ser lido pelo leitor central, não por parseFloat`)
  }
  assert.match(bloco[1], /if\(!r\.ok\)\{ alert\(r\.erro\); return \}/,
    'a recusa do leitor interrompe a gravação e mostra o motivo escrito')
  assert.doesNotMatch(bloco[1], /parseFloat|parseInt/,
    'nenhuma leitura numérica crua sobrevive nesta função')
})
