const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

// ══════════════════════════════════════════════════════════════════════
// Migração 59 — os três campos que o formulário coletava e a fronteira
// jogava fora.
//
// `AflEditor` (pontos as-found/as-left), a marca "houve ajuste" e
// "Aprovado por" gravavam em `ef` e nunca chegavam ao banco: nenhum dos
// três estava em `CAMPOS_PS`, e `paraLinha` só copia o que está no mapa.
// Sumiam sem erro nenhum.
//
// Não é perda cosmética: `maxAbsErr(p.afl,'found')` alimenta a seção de
// deriva da ficha (gráfico + tabela), `sugestaoIntervalo` (método escada
// da ILAC-G24), a lista de não-conformidades do dashboard e a ficha
// impressa. A análise rodava sobre dado que nunca foi salvo — e a
// mensagem que ela exibia mandava o usuário "registrar os erros as-found
// nas calibrações concluídas", pedindo exatamente o que o app descartava.
//
// O caso de maior valor deste arquivo é o ÚLTIMO: o gate que compara o
// FORMULÁRIO com o mapa. `tests/calibracao-supabase.test.js` compara o
// mapa com as colunas da migração, e um campo de tela sem coluna passa
// por baixo dele — foi por essa fresta que os três caíram.
// ══════════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(RAIZ, 'calibracao', 'index.html'), 'utf8')
const SQL = fs.readFileSync(path.join(RAIZ, 'supabase', '59_calibracao_deriva.sql'), 'utf8')
const SQL_SEM_COMENTARIO = SQL.replace(/--[^\n]*/g, '')

const COLUNAS = ['afl', 'ajust', 'apv']

function recorte(ini, fim) {
  const i = HTML.indexOf(ini)
  assert.ok(i >= 0, `marcador inicial não encontrado: ${ini}`)
  const j = HTML.indexOf(fim, i)
  assert.ok(j > i, `marcador final não encontrado: ${fim}`)
  return HTML.slice(i, j)
}

// ═══════ 1. a migração ═════════════════════════════════════════════════

test('a migração 59 é aditiva e acrescenta as três colunas a cal_ps', () => {
  for (const c of COLUNAS) {
    assert.match(SQL_SEM_COMENTARIO,
      new RegExp(`alter table cal_ps add column if not exists ${c}\\s`),
      `faltou a coluna ${c}`)
  }
  assert.doesNotMatch(SQL_SEM_COMENTARIO, /drop\s+(table|column|constraint)/i,
    'o projeto arquiva e acrescenta; nunca derruba')
  assert.doesNotMatch(SQL_SEM_COMENTARIO, /alter\s+table\s+\w+\s+alter\s+column/i,
    'alterar coluna existente sai do contrato de migração aditiva')
})

test('as três nascem nuláveis e sem default — null é "não registrado"', () => {
  // Mesma regra de `refrig_permanente` (migração 45, D-500-02). Um
  // `default false` em `ajust` afirmaria "não houve ajuste" nos 12 PS que
  // ninguém avaliou; um `default '[]'` em `afl` afirmaria "calibração sem
  // nenhum ponto medido".
  for (const c of COLUNAS) {
    const linha = SQL_SEM_COMENTARIO.split('\n')
      .find(l => new RegExp(`add column if not exists ${c}\\s`).test(l))
    assert.ok(linha, `sem definição de ${c}`)
    assert.doesNotMatch(linha, /not null/i, `${c} não pode nascer not null`)
    assert.doesNotMatch(linha, /default/i, `${c} não pode nascer com default`)
  }
})

test('o único check é o de LISTA em afl, e a forma do ponto fica de fora', () => {
  // `(afl || []).forEach(...)` é o consumo: um objeto ou um número no
  // lugar da lista não é dado ruim, é ficha que não abre. Travar a forma
  // de cada ponto obrigaria migração no dia em que o ponto ganhar um
  // campo — e um campo a mais não quebra `forEach`.
  assert.match(SQL_SEM_COMENTARIO,
    /check\s*\(\s*afl is null or jsonb_typeof\(afl\)\s*=\s*'array'\s*\)/,
    'faltou a guarda de que afl é uma lista')
  const checks = SQL_SEM_COMENTARIO.match(/add constraint/g) || []
  assert.equal(checks.length, 1,
    'um check só: teto ou forma inventados aqui recusariam dado legítimo (a lição da 58)')
})

// ═══════ 2. o mapa, e a sonda que o liga ═══════════════════════════════

test('as três colunas entram no mapa por CAMPOS_PS_DERIVA, nunca direto', () => {
  // Direto no `CAMPOS_PS`, `paraLinha` citaria `afl` num banco sem a 59 e
  // o Postgres derrubaria TODA gravação de PS — não só o campo novo, que
  // é a lição de D-500-05.
  const mapa = recorte('const CAMPOS_PS = {', 'const CAMPOS_PS_DERIVA')
  for (const c of COLUNAS) {
    assert.doesNotMatch(mapa, new RegExp(`\\b${c}\\s*:`),
      `${c} está no CAMPOS_PS de declaração; tem de entrar só pela sonda`)
  }
  assert.match(HTML,
    /const CAMPOS_PS_DERIVA = \{ afl: 'afl', ajust: 'ajust', apv: 'apv' \};/,
    'o mapa condicional precisa nomear exatamente as três colunas da 59')
})

test('a sonda pede as três colunas pelo nome e não derruba a carga', () => {
  // Pelo NOME e não pela tabela: `cal_ps` existe desde a 35 em qualquer
  // banco, então perguntar pela tabela responderia sempre que sim.
  assert.match(HTML, /supa\.from\('cal_ps'\)\.select\('id,afl,ajust,apv'\)\.limit\(1\)/,
    'a sonda da migração 59 sumiu ou mudou de forma')
  // E o resultado dela fica FORA da lista de falhas: o erro da sonda é a
  // resposta, não uma falha de carga. Dentro, um banco sem a 59 abriria o
  // módulo em erro em vez de abrir sem a deriva.
  const falha = HTML.match(/const falha = \[([^\]]*)\]\.find\(r => r\.error\)/)
  assert.ok(falha, 'não achei a checagem de falha da carga')
  assert.doesNotMatch(falha[1], /\brd\b/,
    'a sonda entrou na lista de falhas e passou a poder derrubar a carga inteira')
  assert.match(HTML, /if \(!rd\.error\) Object\.assign\(CAMPOS_PS, CAMPOS_PS_DERIVA\);/,
    'o mapa precisa ser estendido num ponto só, e só com a sonda verde')
})

test('a tela deriva da MESMA fonte que a gravação, não de uma bandeira', () => {
  // Duas fontes de verdade para "a deriva está disponível?" divergiriam no
  // primeiro refactor — o erro que D-eq-08 e a migração 52 registram.
  assert.match(HTML, /const derivaDisponivel = \(\) => 'afl' in CAMPOS_PS;/,
    'derivaDisponivel tem de ler o próprio mapa')
})

test('sem a migração não há editor de deriva nem "Aprovado por" na tela', () => {
  // Um formulário que aceita o que vai jogar fora é pior que formulário
  // nenhum — é literalmente o defeito que esta migração conserta. Mesmo
  // precedente de "sem migração, sem botão" (D-6wy-07).
  assert.match(HTML, /derivaDisponivel\(\) && \/\*#__PURE__\*\/React\.createElement\(AflEditor/,
    'o AflEditor precisa estar atrás da sonda')
  const apv = recorte('"Aprovado por"), /*#__PURE__*/React.createElement("input"', 'AflEditor')
  assert.match(apv, /sfe\('apv'/, 'recorte errado: não achei o campo Aprovado por')
  const antes = HTML.slice(0, HTML.indexOf('"Aprovado por"), /*#__PURE__*/React.createElement("input"'))
  assert.match(antes.slice(-220), /derivaDisponivel\(\) \?/,
    '"Aprovado por" precisa estar atrás da mesma sonda')
})

// ═══════ 3. o quarto leitor de vírgula ═════════════════════════════════

function sandboxDeriva() {
  const ctx = { console }
  vm.createContext(ctx)
  vm.runInContext(recorte('// ── borda: texto da tela ↔ número do banco ──',
                          '// objeto do app → linha do banco.'), ctx)
  vm.runInContext(recorte('// ===== DERIVA / AS-FOUND AS-LEFT', 'function DerivaChart'), ctx)
  return ctx
}

test('numBR passou a usar a porta única e recusa o ambíguo', () => {
  // Era o quarto leitor de vírgula do arquivo e o único sem a guarda:
  // `parseFloat('1.200')` devolvia 1,2 em silêncio, e esse número entrava
  // no gráfico de deriva e na comparação com o EMA como se fosse medição.
  const ctx = sandboxDeriva()
  assert.equal(ctx.numBR('1.200'), null,
    '"1.200" é ambíguo; adivinhar mil e duzentos como 1,2 é o defeito da migração 56')
  assert.equal(ctx.numBR('0,25'), 0.25, 'a vírgula continua sendo lida como decimal')
  assert.equal(ctx.numBR('-3,5'), -3.5, 'erro de calibração negativo é comum e legítimo')
  assert.equal(ctx.numBR(0.12), 0.12, 'desde a 59 o valor chega como número')
  assert.equal(ctx.numBR(''), null)
  assert.equal(ctx.numBR(null), null)
  assert.equal(ctx.numBR('abc'), null)
  const corpo = recorte('function numBR(v) {', '\n}\n')
  assert.doesNotMatch(corpo, /parseFloat/,
    'numBR voltou a parsear sozinho em vez de delegar a numNormalizar')
})

test('maxAbsErr ignora ponto sem valor e devolve o maior valor ABSOLUTO', () => {
  const ctx = sandboxDeriva()
  assert.equal(ctx.maxAbsErr([{ found: 0.1 }, { found: -0.4 }, { found: 0.2 }], 'found'), 0.4,
    'o erro que importa é o de maior módulo, com sinal ou sem ele')
  assert.equal(ctx.maxAbsErr([{ found: '' }, { found: null }], 'found'), null,
    'nenhum ponto medido é null, nunca zero — zero seria "medi e deu zero"')
  assert.equal(ctx.maxAbsErr(null, 'found'), null, 'PS sem deriva registrada')
})

// ═══════ 4. o gate que faltava: o formulário contra o mapa ═════════════

test('todo campo que o formulário de PS grava tem coluna no mapa', () => {
  // ESTE é o caso que teria pego o defeito. O gate existente compara o
  // MAPA com a migração; ninguém comparava o FORMULÁRIO com o mapa, e foi
  // por essa fresta que afl, ajust e apv caíram — coletados na tela,
  // descartados por `paraLinha`, sem erro nenhum.
  const form = recorte('function PedidosServico({', 'function PSPrev({')
  const chaves = new Set()
  for (const m of form.matchAll(/sfe\('([A-Za-z_]\w*)'/g)) chaves.add(m[1])
  // O AflEditor não passa por `sfe`: escreve direto no draft com setEf.
  // Era justamente a forma que ninguém varria.
  for (const m of form.matchAll(/setEf\(f => \(\{\s*\.\.\.f,\s*([^)]*)\}\)\)/g)) {
    for (const par of m[1].split(',')) {
      const k = par.split(':')[0].trim()
      if (/^[A-Za-z_]\w*$/.test(k)) chaves.add(k)
    }
  }
  assert.ok(chaves.size >= 12, `varri poucas chaves (${chaves.size}) — o recorte deve estar errado`)
  for (const c of COLUNAS) {
    assert.ok(chaves.has(c), `o recorte perdeu ${c}: o gate não estaria provando nada`)
  }

  const mapa = recorte('const CAMPOS_PS = {', 'const derivaDisponivel')
  const conhecidas = new Set()
  for (const m of mapa.matchAll(/(\w+)\s*:\s*'(\w+)'/g)) conhecidas.add(m[1])
  for (const k of chaves) {
    assert.ok(conhecidas.has(k),
      `o formulário grava "${k}" e CAMPOS_PS não tem coluna para ele — ` +
      'paraLinha vai descartar em silêncio, que é o defeito da migração 59')
  }
})
