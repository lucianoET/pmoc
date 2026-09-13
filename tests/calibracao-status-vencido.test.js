const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

// ══════════════════════════════════════════════════════════════════════
// Status efetivo, botão Sair e modo observador em /calibracao (13/09/2026).
//
// Medido no navegador, contra produção, no cargo Livre:
//   · os 21 instrumentos "Calibrado" tinham a próxima calibração vencida
//     (218 a 550 dias) e o Relatório dava 55% de conformidade — listando
//     esses mesmos 21 em "Cal. vencida" logo abaixo. Pela data, 0 de 38;
//   · a pílula fixa "⇚ CMASM" (z-index 9999) ficava em cima do botão Sair:
//     o clique levava ao portal sem encerrar a sessão;
//   · um preço editado no Catálogo pelo observador disparava uma gravação
//     e um alerta POR TECLA, com o texto cru do Postgres;
//   · "somente leitura" usava a classe do separador, opacidade 0,18.
//
// O status efetivo é provado por COMPORTAMENTO (o núcleo carregado do
// próprio HTML num sandbox); o resto por estrutura, recortando o corpo de
// cada função antes de procurar dentro dele — varrer o arquivo inteiro
// casaria com outra função que tem a mesma linha, a cegueira que
// tests/mapa-editor.test.js já pagou.
// ══════════════════════════════════════════════════════════════════════

const HTML = fs.readFileSync(path.join(__dirname, '..', 'calibracao', 'index.html'), 'utf8')

function recorte(ini, fim) {
  const i = HTML.indexOf(ini)
  assert.ok(i >= 0, `marcador inicial não encontrado: ${ini}`)
  const j = HTML.indexOf(fim, i + ini.length)
  assert.ok(j > i, `marcador final não encontrado: ${fim}`)
  return HTML.slice(i, j)
}

// `const` de topo num script de vm vive no registro léxico, não no objeto
// global — por isso o recorte devolve o que interessa como última expressão.
function nucleoStatus() {
  const src = recorte('const STATUS_CFG = {', 'function fmt(v)')
  return vm.runInContext(src + '\n;({ stEf, STATUS_CFG })', vm.createContext({}))
}

function portaGravacao(usuario) {
  const alertas = []
  const ctx = vm.createContext({ window: { CAL_USUARIO: usuario }, alert: m => alertas.push(m) })
  const src = recorte('// ── porta de gravação: modo observador e aviso único ──', 'const PRAZO_MS')
  const api = vm.runInContext(src + '\n;({ somenteLeitura, avisar, mensagemErro, AVISO_OBSERVADOR })', ctx)
  return { ...api, alertas }
}

// dd/mm/aaaa a `dias` de hoje, no fuso local — é o formato que `dv` lê.
function data(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return [d.getDate(), d.getMonth() + 1, d.getFullYear()].map(n => String(n).padStart(2, '0')).join('/')
}

test('Calibrado com a próxima calibração no passado aparece como calibração vencida', () => {
  const { stEf } = nucleoStatus()
  assert.equal(stEf({ status: 'CALIBRADO', prox: data(-10) }), 'VENCIDO')
  assert.equal(stEf({ status: 'CALIBRADO', prox: data(-550) }), 'VENCIDO')
})

test('Calibrado no prazo, ou sem data, continua Calibrado', () => {
  const { stEf } = nucleoStatus()
  assert.equal(stEf({ status: 'CALIBRADO', prox: data(10) }), 'CALIBRADO')
  assert.equal(stEf({ status: 'CALIBRADO', prox: null }), 'CALIBRADO',
    'sem data não há como afirmar vencimento — não inventar')
})

test('os outros status não são reescritos pela data', () => {
  const { stEf } = nucleoStatus()
  for (const st of ['DESCALIBRADO', 'SEM_CERTIFICADO', 'EM_REPARO', 'NAO_UTILIZADO'])
    assert.equal(stEf({ status: st, prox: data(-30) }), st)
})

test('VENCIDO tem rótulo e é marcado como derivado', () => {
  const { STATUS_CFG } = nucleoStatus()
  assert.equal(STATUS_CFG.VENCIDO.lbl, 'Cal. vencida')
  assert.equal(STATUS_CFG.VENCIDO.derivado, true)
  assert.equal(Object.values(STATUS_CFG).filter(v => v.derivado).length, 1)
})

test('VENCIDO nunca é gravado: o formulário não o oferece e o store não o conhece', () => {
  // cal_equipamentos.status não tem check — um VENCIDO gravado entraria
  // sem erro e não voltaria a Calibrado quando o próximo PS concluísse.
  assert.match(HTML, /sf\('status', e\.target\.value\)\s*\}, Object\.entries\(STATUS_CFG\)\.filter\(\(\[, v\]\) => !v\.derivado\)/)
  const store = recorte('function useStore() {', 'function Modal({')
  assert.doesNotMatch(store, /VENCIDO|stEf/, 'o caminho de escrita trabalha só com o status gravado')
})

test('contagens e rótulos passam pelo status efetivo', () => {
  const corpos = {
    Dashboard: recorte('function Dashboard({', '// ===== FICHA DO EQUIPAMENTO'),
    Relatorio: recorte('function Relatorio({', 'function normHdr('),
    printRelatorioISO: recorte('function printRelatorioISO(s) {', '// ===== AJUDA'),
    Lotes: recorte('function Lotes({', 'function useStore() {'),
  }
  for (const [nome, corpo] of Object.entries(corpos))
    assert.doesNotMatch(corpo, /\be\.status\s*(===|!==)/, `${nome} ainda compara o status gravado`)
  const badges = [...HTML.matchAll(/SBdg, \{\s*s: ([^}\n]+)/g)].map(m => m[1].trim())
  assert.ok(badges.length >= 5, 'os badges de status deveriam ser encontrados')
  for (const b of badges) assert.match(b, /^stEf\(/, `badge de status sem stEf: ${b}`)
  assert.match(HTML, /\['DESCALIBRADO', 'VENCIDO', 'EM_REPARO', 'SEM_CERTIFICADO'\]\.includes\(stEf\(e\)\)/,
    'o contador da barra lateral conta calibração vencida')
})

test('o Dashboard tem o indicador de calibração vencida', () => {
  const dash = recorte('function Dashboard({', '// ===== FICHA DO EQUIPAMENTO')
  assert.match(dash, /lbl: 'Cal\. vencida',\s*v: cnt\.VENCIDO/)
})

test('o botão Sair não fica mais embaixo da pílula fixa', () => {
  const ini = recorte('window.__calIniciar = function (usuario) {', 'window.__calSair')
  assert.match(ini, /document\.querySelector\('\.calib-home'\)\?\.remove\(\)/,
    'com o app montado a pílula cobria o Sair')
  const topo = recorte('className: "topbar"', 'className: "content"')
  assert.match(topo, /React\.createElement\("a", \{\s*className: "thm tb-a",\s*href: "\/"/,
    'a volta ao portal passa a morar na barra')
  assert.ok(topo.indexOf('href: "/"') < topo.indexOf('window.__calSair()'), 'Portal vem antes de Sair')
})

test('"somente leitura" é pílula legível, não a classe do separador', () => {
  const topo = recorte('className: "topbar"', 'className: "content"')
  assert.match(topo, /somenteLeitura\(\) && \/\*#__PURE__\*\/React\.createElement\("span", \{\s*className: "bdg b-i tb-ro"/)
  assert.doesNotMatch(topo, /className: "tb-s",\s*title:/)
})

test('em tela estreita a barra esconde os rótulos em vez de empurrar o Sair para fora', () => {
  const m = /@media\(max-width:768px\)\{([\s\S]*?)\n\}/.exec(HTML)
  assert.ok(m, 'o bloco de 768px deveria existir')
  assert.match(m[1], /\.tb-c,\.tb-s,\.tb-lbl\{display:none\}/)
  assert.match(HTML, /\.tb-p\{[^}]*text-overflow:ellipsis/)
})

test('observador: nada vai para a rede e o aviso não se repete', () => {
  const p = portaGravacao({ role: 'observador' })
  assert.equal(p.somenteLeitura(), true)
  p.avisar(p.AVISO_OBSERVADOR); p.avisar(p.AVISO_OBSERVADOR); p.avisar(p.AVISO_OBSERVADOR)
  assert.equal(p.alertas.length, 1, 'uma gravação por tecla não pode virar um alerta por tecla')
  p.avisar('outra coisa')
  assert.equal(p.alertas.length, 2)
  assert.equal(portaGravacao({ role: 'tecnico' }).somenteLeitura(), false)
  assert.equal(portaGravacao(null).somenteLeitura(), false)
})

test('recusa da RLS vira frase acionável, não o texto cru do Postgres', () => {
  const { mensagemErro } = portaGravacao(null)
  const rls = mensagemErro('o catálogo', { code: '42501', message: 'new row violates row-level security policy for table "cal_catalogo"' })
  assert.doesNotMatch(rls, /row-level/)
  assert.match(rls, /não tem permissão de escrita/)
  assert.equal(mensagemErro('o PS', { message: 'timeout' }), 'Erro ao salvar o PS: timeout')
})

test('toda porta de escrita confere o modo observador antes de tocar a rede', () => {
  const store = recorte('function useStore() {', 'function Modal({')
  const gravar = recorte('  function gravar(q, oque) {', '\n  }\n')
  // `comPrazo(q).then` e não `comPrazo(q)`: o comentário que explica a
  // guarda cita `comPrazo(q)` antes dela, e o gate mediria a própria prosa.
  assert.ok(gravar.indexOf('somenteLeitura()') >= 0, 'gravar() sem a guarda do observador')
  assert.ok(gravar.indexOf('if (somenteLeitura())') < gravar.indexOf('comPrazo(q).then'),
    'a guarda precisa vir antes da chamada que dispara a requisição')
  const cat = recorte('  function persistirCatalogo(c) {', '  function setCatalog(c) {')
  assert.ok(cat.indexOf('somenteLeitura()') < cat.indexOf('.upsert('), 'a limpeza do catálogo não passa por gravar()')
  for (const f of ['async function replaceState(d) {', 'async function resetAll() {']) {
    const corpo = store.slice(store.indexOf(f), store.indexOf(f) + 200)
    assert.match(corpo, /if \(somenteLeitura\(\)\)/, `${f} sem a guarda`)
  }
})

test('o remapeamento escuro do shell não anula o tema claro do módulo', () => {
  // Desde a importação (11/08) o bloco do shell redefinia as variáveis no
  // <body> e vencia html[data-theme="light"]: o botão de tema trocava o
  // rótulo e a tela continuava escura. Só a pílula da tela de login, que
  // tem cores próprias, pode ficar fora do escopo.
  const css = fs.readFileSync(path.join(__dirname, '..', 'calibracao', 'assets', 'erp-module-shell.css'), 'utf8')
  const regras = css.split('\n').filter(l => /^[^\s/*].*body\.erp-calibracao-body/.test(l))
  assert.ok(regras.length > 10, 'as regras do calibracao no shell deveriam ser encontradas')
  for (const r of regras.filter(r => !r.includes('.calib-home')))
    assert.match(r, /^html:not\(\[data-theme="light"\]\) body\.erp-calibracao-body/, `regra sem escopo de tema: ${r}`)
})

test('o Catálogo não diz mais que salva no navegador, e trava para o observador', () => {
  const cat = recorte('function Catalogo({', 'function Lotes({')
  assert.doesNotMatch(HTML, /salvo localmente/)
  assert.doesNotMatch(cat, /localStorage/, 'o catálogo mora no banco desde a migração 35')
  assert.doesNotMatch(HTML, /CAT_KEY|loadCatalog/)
  assert.match(cat, /React\.createElement\("fieldset", \{\s*disabled: somenteLeitura\(\)/)
})
