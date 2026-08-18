const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')
const ler = p => fs.readFileSync(path.join(RAIZ, ...p), 'utf8')

const repHtml = ler(['reparos', 'index.html'])
const repApp = ler(['reparos', 'app.js'])
const maqHtml = ler(['maquinas', 'index.html'])
const maqApp = ler(['maquinas', 'app.js'])

// Extrai os nomes chamados por handler inline no markup. O módulo é ES e não
// publica nada no window por padrão — sem exporNoWindow() o botão fica morto,
// sem erro de sintaxe e sem teste vermelho (Fase 05-06, maquinas/app.js).
function handlersInline(html) {
  const nomes = new Set()
  for (const m of html.matchAll(/\son[a-z]+="([A-Za-z_$][\w$]*)\(/g)) nomes.add(m[1])
  return [...nomes].sort()
}

test('reparos publica no window todo handler inline do próprio markup', () => {
  const bloco = repApp.match(/Object\.assign\(window,\s*\{([\s\S]*?)\}\)/)
  assert.ok(bloco, 'reparos/app.js deve ter o Object.assign(window, {...}) de exporNoWindow()')
  const publicados = new Set(bloco[1].split(',').map(s => s.trim()).filter(Boolean))

  const usados = handlersInline(repHtml)
  assert.ok(usados.length > 0, 'o markup deve usar handlers inline — é o padrão do repo')
  for (const nome of usados) {
    assert.ok(publicados.has(nome), `${nome}() é chamado no markup mas não está em exporNoWindow()`)
  }
})

test('reparos entra no shell comum e no login por cargo, como os outros módulos', () => {
  assert.match(repApp, /import \{ aplicarShell \} from '\.\.\/shared\/shell\.js'/)
  assert.match(repApp, /import \{ Auth \} from '\.\.\/shared\/auth\.js'/)
  assert.match(repApp, /import \{ criarClienteSupabase \} from '\.\.\/shared\/supabase-config\.js'/)
  assert.match(repApp, /aplicarShell\(\{[\s\S]*?nome: 'Reparos'/)
  assert.doesNotMatch(repApp, /const SUPA_KEY/,
    'a chave vive em maquinas/app.js e é lida por supabase-config.js — não duplicar')
})

test('máquinas continua funcionando se a migração 26 não tiver rodado', () => {
  // o catálogo é carregado fora do Promise.all principal justamente para que o
  // erro de tabela ausente fique contido e não derrube carregarTudo()
  assert.match(maqApp, /async function carregarCatalogoReparos\(\)/)
  assert.match(maqApp, /const indisponivel = rp\.error \|\| rm\.error \|\| rs\.error \|\| sv\.error/)
  assert.match(maqApp, /REPAROS\s*=\s*indisponivel \? \[\] :/)

  // as colunas novas só entram no payload quando há diagnóstico escolhido,
  // então o insert continua válido num banco sem as colunas da migração 26
  assert.match(maqApp, /\.\.\.\(reparo \? \{ reparo_id, sintoma_relatado: reparo\.sintoma \} : \{\}\)/)

  // e o bloco do modal fica escondido enquanto não houver catálogo
  assert.match(maqApp, /const mostrar = corretiva && REPAROS\.length > 0/)
})

test('OS corretiva com diagnóstico dá baixa e alimenta o ranking', () => {
  // A resolução das peças do diagnóstico saiu de salvarOS e virou
  // pecasPrevistasDaOS(), que junta plano e diagnóstico numa lista só. O que o
  // gate protege segue igual: as peças do diagnóstico entram na OS, e só as
  // essenciais.
  assert.match(maqApp, /function pecasPrevistasDaOS\(planoIds, reparoId\)/)
  assert.match(maqApp, /pecasEssenciaisDoReparo\(reparoId\)/)
  assert.match(maqApp, /pecasPrevistasDaOS\(planosDaOS, reparo_id\)/,
    'a criação da OS precisa continuar resolvendo as peças do diagnóstico')
  assert.match(maqApp, /x\.reparo_id === reparoId && x\.essencial/,
    'só peça essencial é debitada — a opcional é "verificar se precisa trocar"')
  // A chamada saiu de dentro de salvarOS() e virou confirmarDiagnostico(), porque
  // agora existem três caminhos até a conclusão de uma OS — criar já concluída,
  // concluir pela lista e concluir pelo detalhe — e os três precisam alimentar o
  // ranking do mesmo jeito. O que o gate protege continua sendo o mesmo: a RPC é
  // chamada com o id da OS gravada.
  assert.match(maqApp, /async function confirmarDiagnostico\(osId, reparo\)/)
  assert.match(maqApp, /supa\.rpc\('rep_confirmar_reparo', \{[\s\S]*?p_os_id: osId/)
  assert.match(maqApp, /confirmarDiagnostico\(osNova\.id, reparo\)/,
    'a criação de OS já concluída precisa continuar confirmando o diagnóstico')
  assert.match(maqApp, /\.select\('id'\)\.single\(\)/,
    'o id da OS é necessário para a RPC e para os_id do movimento de estoque')
  // o motivo do movimento de estoque passou a sair da origem da peça, mas a
  // peça do diagnóstico continua sendo registrada como corretiva
  assert.match(maqApp, /peca\.origem === 'reparo'\s*\n\s*\? 'OS corretiva — ' \+ \(reparo\?\.causa_provavel \|\| ''\)/)

  // falha na confirmação não pode invalidar a OS, que já está gravada
  assert.match(maqApp, /if\(error\) alert\('OS gravada, mas a confirmação do diagnóstico falhou/)
  assert.doesNotMatch(maqApp, /if\(error\)\s*\{?\s*return\s*\}?\s*\n\s*\/\/ falha aqui não invalida/)
})

test('o modal de OS tem o bloco de diagnóstico e ele nasce escondido', () => {
  assert.match(maqHtml, /id="os-reparo-wrap" style="display:none"/)
  assert.match(maqHtml, /id="os-reparo"/)
  assert.match(maqHtml, /id="os-reparo-confirmado"/)
})

test('reparos está roteado no Vercel e visível no portal', () => {
  const vercel = JSON.parse(ler(['vercel.json']))
  const rota = vercel.rewrites.find(r => r.source === '/reparos')
  assert.ok(rota, 'sem rewrite, /reparos dá 404 em produção')
  assert.equal(rota.destination, '/reparos/index.html')
  assert.match(ler(['index.html']), /href="\/reparos"/)
})

// Encontrado em smoke test com o Playwright em 18/08/2026: com a migração 26
// ainda não aplicada, /reparos abria um alert com o texto cru do PostgREST
// ("Could not find the table 'public.rep_modelos' in the schema cache"), que
// não diz a ninguém o que fazer a respeito.
test('reparos explica o que fazer quando as tabelas rep_* não existem', () => {
  assert.match(repApp, /function catalogoAusente\(erro\)/)
  assert.match(repApp, /could not find the table\|does not exist\|schema cache/i)
  assert.match(repApp, /if\(catalogoAusente\(erro\.error\)\)\{ mostrarCatalogoAusente\(\); return \}/)
  assert.match(repApp, /26_reparos_schema\.sql/,
    'a mensagem precisa nomear a migração que falta')
  assert.match(repApp, /27_reparos_seed\.sql/)
})
