const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

// ══════════════════════════════════════════════════════════════════════
// Porta única de leitura numérica de /calibracao — a terceira e última.
//
// Medido no Chromium, com teclado de verdade e o app bootado de verdade
// (SDK do Supabase servido por stub no lugar do CDN, porque a guarda de
// D-sdk-01 corretamente impede o boot sem ele): os cinco campos
// `type="number"` do módulo descartavam a vírgula e mantinham os dígitos.
//
//   "12,5"    → value "125"     → 125       (dez vezes o valor)
//   "0,5"     → value "05"      → 5
//   "1.200"   → value "1.200"   → 1.2
//   "1234,56" → value "123456"  → 123456
//
// E um segundo defeito que só o navegador achou, pior que o primeiro: o
// campo de preço do Catálogo era controlado por `(+o.preco).toFixed(2)`
// enquanto `edit()` guardava o texto cru, então o React reescrevia o campo
// a cada tecla e o cursor voltava ao começo. Medido: digitar "90" deixava
// 0,01; digitar "1.200" deixava 0,00. O campo não era ruim com vírgula —
// era impossível de digitar, com qualquer valor.
//
// Este gate prova COMPORTAMENTO, carregando o núcleo do próprio HTML num
// sandbox, e mais quatro coisas que só teste pega: que nenhum campo voltou
// a ser `type=number`; que a tela nunca fica mais frouxa que o `check` da
// migração 35; que campo vazio nunca manda null para coluna `not null`
// (erro opaco do Postgres no meio da gravação, que é o que esta porta
// existe para evitar); e que esta réplica não divergiu de
// maquinas/numeros.js.
// ══════════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(RAIZ, 'calibracao', 'index.html'), 'utf8')
const SCHEMA = fs.readFileSync(path.join(RAIZ, 'supabase', '35_calibracao_schema.sql'), 'utf8')
const MAQ = require(path.join(RAIZ, 'maquinas', 'numeros.js'))

// Comentário não é marcação. Sem esta separação o gate mede a própria
// prosa: as quatro primeiras rodadas reprovaram porque os comentários que
// EXPLICAM o defeito citam `type="number"` e citam o ramo morto que foi
// removido. É a terceira vez que esta armadilha se paga nesta base, depois
// de `shared/` num comentário sobre PLAT-15 e de `"@media"` — e ela só
// aparece quando o texto que descreve a regra usa as palavras da regra.
// Só linhas que COMEÇAM em comentário saem: as bibliotecas minificadas
// embutidas são linhas gigantes de código, nenhuma começa em `//`.
const HTML_SEM_PROSA = HTML.split('\n')
  .filter(l => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l))
  .join('\n')

function recorte(ini, fim) {
  const i = HTML.indexOf(ini)
  assert.ok(i >= 0, `marcador inicial não encontrado: ${ini}`)
  const j = HTML.indexOf(fim, i)
  assert.ok(j > i, `marcador final não encontrado: ${fim}`)
  return HTML.slice(i, j)
}

const NUCLEO = recorte('// ── borda: texto da tela ↔ número do banco ──',
                       '// objeto do app → linha do banco.')

function sandbox() {
  const ctx = { console }
  vm.createContext(ctx)
  vm.runInContext(NUCLEO, ctx)
  return ctx
}

// `const` de topo num script de vm NÃO vira propriedade do objeto global —
// vive no registro léxico do contexto, alcançável só avaliando o
// identificador. É o mesmo tipo de armadilha que deixou `agendaTerminais`
// enxergando só CANCELADA em /refrigeracao, e sem isto o gate leria
// `undefined` e passaria verde afirmando nada.
function campos(ctx) {
  return vm.runInContext('NUM_CAMPOS', ctx)
}

// ═══════ 1. o defeito medido ═══════════════════════════════════════════

test('a vírgula decimal é lida como decimal, não descartada', () => {
  const ctx = sandbox()
  const spec = { rotulo: 'Custo', min: 0, max: 10000000 }
  // Campo a campo, e não deepEqual sobre o objeto inteiro: o retorno vem do
  // sandbox, logo tem outro prototype, e o deepEqual estrito reprovaria por
  // causa disso e não do valor.
  const leu = t => { const r = ctx.numValidar(t, spec); return [r.ok, r.valor] }
  assert.deepEqual(leu('12,5'), [true, 12.5],
    'o caso medido: num type=number, digitar 12,5 deixava .value em "125" — ' +
    'doze e meio virava cento e vinte e cinco, sem erro nenhum na tela')
  assert.deepEqual(leu('0,5'), [true, 0.5])
  assert.deepEqual(leu('1234,56'), [true, 1234.56])
  assert.deepEqual(leu('1.234,56'), [true, 1234.56],
    'forma brasileira completa: o ponto é milhar quando existe vírgula')
})

test('ponto separando três casas é recusado por ambíguo, nunca adivinhado', () => {
  const ctx = sandbox()
  const r = ctx.numValidar('1.200', { rotulo: 'Custo', min: 0 })
  assert.equal(r.ok, false,
    '"1.200" pode ser mil e duzentos ou um vírgula dois; adivinhar é o que fez ' +
    'dissipacao_w virar 1,2 em /refrigeracao antes da migração 56')
  assert.match(r.erro, /amb[íi]guo/i)
})

test('texto que não é número vira recusa com motivo, nunca zero', () => {
  const ctx = sandbox()
  // `+e.target.value` devolvia NaN para "abc" e ZERO para "" — as duas
  // respostas silenciosas que esta porta existe para acabar.
  const r = ctx.numValidar('12abc', { rotulo: 'Custo', min: 0 })
  assert.equal(r.ok, false,
    'Number() e não parseFloat(): parseFloat("12abc") devolve 12 e engole o resto')
  assert.match(r.erro, /não é um número/)
})

// ═══════ 2. o campo deixou de ser type=number ══════════════════════════

test('nenhum campo do módulo voltou a ser type="number"', () => {
  // `type="number"` não tem conserto para separador decimal: medido, sem API
  // de seleção não dá para trocar a vírgula por ponto enquanto se digita, e
  // atribuir um valor parcial ("12.") ZERA o campo. A conversão para
  // `type="text" inputmode="decimal"` é a correção inteira, e voltar atrás
  // reintroduz o defeito sem sintoma nenhum na tela.
  const ocorrencias = HTML_SEM_PROSA.match(/type:\s*"number"|type=["']number["']/g) || []
  assert.deepEqual(ocorrencias, [],
    `ainda há ${ocorrencias.length} campo(s) type="number" no módulo`)
})

test('os cinco campos numéricos passam pelo CampoNum, com a chave da coluna', () => {
  for (const chave of ['per', 'cC', 'cR', 'preco', 'vE']) {
    const re = new RegExp(`React\\.createElement\\(CampoNum, \\{\\s*chave: "${chave}"`)
    assert.match(HTML, re, `o campo ${chave} não está usando CampoNum`)
  }
  // A leitura crua não pode reaparecer em nenhum dos cinco.
  for (const chave of ['per', 'cC', 'cR']) {
    assert.doesNotMatch(HTML, new RegExp(`sf\\('${chave}', \\+e\\.target\\.value\\)`),
      `${chave} voltou a ler o campo cru`)
  }
  assert.doesNotMatch(HTML, /sfe\('vE', \+e\.target\.value\)/)
})

test('o ramo morto de vírgula do catálogo não voltou', () => {
  // A conversão que morava em `edit()` já esperava a vírgula, mas
  // `type="number"` a descartava antes — nunca chegava um texto com vírgula
  // para converter. O `|| 0` que sobrava era pior que inútil: colapsava lixo
  // em zero, em silêncio.
  //
  // O corpo de `edit` é recortado ANTES da busca: existe outro leitor de
  // vírgula neste arquivo (`numBR`, da análise de deriva), e procurar no
  // arquivo inteiro casaria com ele — a cegueira que o gate de /refrigeracao
  // pagou ao procurar `qtd<=0` fora do corpo de `osAddItemUI`.
  const corpo = recorte('const edit = (eq, idx, f, v) => {', '\n  };')
  assert.doesNotMatch(corpo, /preco/,
    'edit() voltou a tratar preço por dentro; a leitura mora no CampoNum, num lugar só')
  assert.match(corpo, /cat\[eq\]\[idx\]\[f\] = v;/,
    'edit() continua sendo a atribuição genérica que era')
})

// ═══════ 3. a tela nunca é mais frouxa que o banco ═════════════════════

// Comentários saem primeiro, e a busca é presa à TABELA: nome de coluna se
// repete entre tabelas, e sem escopo o gate compara a tela com a regra de
// outra tabela — a cegueira que `tests/mapa-editor.test.js` teve ao varrer
// `.from('...')` e que o gate de /maquinas pagou ao ler `delta`.
const SQL_SEM_COMENTARIO = SCHEMA.replace(/--[^\n]*/g, '')

function corpoDaTabela(tabela) {
  const re = new RegExp(`create table if not exists ${tabela}\\s*\\(([\\s\\S]*?)\\n\\);`)
  const m = SQL_SEM_COMENTARIO.match(re)
  assert.ok(m, `não achei a definição de ${tabela} na migração 35`)
  return m[1]
}

function defColuna(tabela, coluna) {
  const corpo = corpoDaTabela(tabela)
  const linhas = corpo.split('\n').filter(l => new RegExp(`^\\s*${coluna}\\s`).test(l))
  assert.equal(linhas.length, 1, `esperava uma definição de ${tabela}.${coluna}`)
  return linhas[0]
}

test('cada campo declara a coluna que alimenta, e ela existe na migração 35', () => {
  const ctx = sandbox()
  const chaves = Object.keys(campos(ctx))
  assert.deepEqual(chaves.sort(), ['cC', 'cR', 'preco', 'per', 'vE'].sort(),
    'os campos numéricos do módulo são exatamente estes cinco')
  for (const chave of chaves) {
    const spec = campos(ctx)[chave]
    assert.ok(spec.coluna, `${chave} não declara a coluna`)
    const [tabela, coluna] = spec.coluna.split('.')
    assert.ok(defColuna(tabela, coluna), `${spec.coluna} não existe`)
  }
})

test('o mínimo da tela espelha o check da coluna — nunca mais frouxo', () => {
  const ctx = sandbox()
  for (const [chave, spec] of Object.entries(campos(ctx))) {
    const [tabela, coluna] = spec.coluna.split('.')
    const def = defColuna(tabela, coluna)
    const m = def.match(new RegExp(`check\\s*\\(\\s*${coluna}\\s*(>=|>)\\s*(-?[\\d.]+)\\s*\\)`))
    if (!m) continue // coluna sem check: a tela pode ser estrita à vontade
    const [, operador, limite] = m
    assert.equal(spec.min, Number(limite),
      `${spec.coluna}: o banco recusa abaixo de ${limite} e a tela diz ${spec.min}`)
    if (operador === '>') {
      assert.equal(spec.exclusivo, true,
        `${spec.coluna}: o banco exige > ${limite}; sem exclusivo a tela aceitaria o próprio ${limite} ` +
        'e o Postgres devolveria erro opaco no meio da gravação')
    }
  }
})

test('valor_exec não tem check e a tela é mais estrita de propósito', () => {
  const ctx = sandbox()
  const def = defColuna('cal_ps', 'valor_exec')
  assert.doesNotMatch(def, /check/,
    'se a coluna ganhar check, o mínimo da tela precisa ser reconferido contra ele')
  assert.equal(campos(ctx).vE.min, 0,
    'valor executado negativo não é nota fiscal nenhuma — mais estrita que o banco, ' +
    'como uso-delta em /maquinas')
})

test('coluna not null nunca recebe null de campo vazio', () => {
  // Esta é a regra que o `+''` de antes escondia por acidente: ele produzia
  // zero, que a coluna aceita. Devolver null "honestamente" para uma coluna
  // `not null default 0` trocaria um defeito silencioso por um erro opaco do
  // Postgres — por isso `vazio` diz o que o branco significa para AQUELA
  // coluna, e não é preferência de tela.
  const ctx = sandbox()
  for (const [chave, spec] of Object.entries(campos(ctx))) {
    const [tabela, coluna] = spec.coluna.split('.')
    const notNull = /\bnot null\b/.test(defColuna(tabela, coluna))
    const r = ctx.numValidar('', spec)
    if (notNull) {
      assert.ok(spec.obrigatorio || 'vazio' in spec,
        `${spec.coluna} é not null e ${chave} não declara nem obrigatorio nem vazio`)
      if (spec.obrigatorio) {
        assert.equal(r.ok, false, `${chave}: vazio precisa ser recusado na tela`)
      } else {
        assert.notEqual(r.valor, null,
          `${chave}: vazio viraria null numa coluna not null`)
      }
    } else {
      assert.deepEqual([r.ok, r.valor], [true, null],
        `${chave}: a coluna aceita null, e null é o fato — foi isto que o +'' virava zero`)
    }
  }
})

test('periodicidade é inteira, porque a coluna é integer', () => {
  const ctx = sandbox()
  assert.match(defColuna('cal_equipamentos', 'per'), /\binteger\b/)
  const r = ctx.numValidar('12,5', campos(ctx).per)
  assert.equal(r.ok, false, 'meio mês de periodicidade não existe, e a coluna é integer')
  assert.match(r.erro, /inteiro/)
})

// ═══════ 4. a ida e a volta fecham ═════════════════════════════════════

test('o que o app escreve no campo é o que o app lê de volta', () => {
  // Sem esta metade o aplicativo preenche o campo com um texto que ele
  // próprio recusa: String(1234.56) é "1234.56", e String(5.392) é "5.392",
  // que a regra de ambiguidade barra.
  const ctx = sandbox()
  const spec = { rotulo: 'Custo', min: 0, max: 10000000 }
  for (const n of [0, 90, 100, 12.5, 1234.56, 5.392, 0.01]) {
    const texto = ctx.numParaCampo(n)
    const r = ctx.numValidar(texto, spec)
    assert.equal(r.ok, true, `${n} virou "${texto}", que o próprio leitor recusa`)
    assert.equal(r.valor, n, `${n} → "${texto}" → ${r.valor}`)
  }
  assert.equal(ctx.numParaCampo(1234.56), '1234,56',
    'escreve com vírgula, que é como se lê decimal em português')
  assert.equal(ctx.numParaCampo(null), '')
})

// ═══════ 5. a réplica não divergiu ═════════════════════════════════════

test('a regra é a mesma de maquinas/numeros.js, caso a caso', () => {
  // Réplica deliberada: /calibracao é legado independente (D-05) e não
  // importa da pasta comum, como /refrigeracao não importa por ser congelado.
  // O que impede a divergência não é o lugar, é este caso — ele roda as DUAS
  // implementações sobre a mesma tabela.
  const ctx = sandbox()
  const spec = { rotulo: 'Valor', min: 0, max: 10000000 }
  const ENTRADAS = ['12,5', '0,5', '1234,56', '1.234,56', '1.200', '12.5', '90', '',
                    '-3', '12abc', '1,2,3', '1.2.3', '0', '10000001', '  7  ', '0,01']
  let concordaramOk = 0
  let concordaramRecusa = 0
  for (const t of ENTRADAS) {
    const a = ctx.numValidar(t, spec)
    const b = MAQ.validarNumero(t, spec)
    assert.equal(a.ok, b.ok, `divergiram em "${t}": calibracao ok=${a.ok}, maquinas ok=${b.ok}`)
    if (a.ok) { assert.equal(a.valor, b.valor, `divergiram no valor de "${t}"`); concordaramOk++ }
    else concordaramRecusa++
  }
  // Sem isto, duas implementações que recusassem tudo (ou aceitassem tudo)
  // passariam concordando — a tabela precisa exercer os dois lados.
  assert.ok(concordaramOk >= 6, `poucos casos aceitos (${concordaramOk}): a tabela não exerce o caminho feliz`)
  assert.ok(concordaramRecusa >= 5, `poucos casos recusados (${concordaramRecusa}): a tabela não exerce a recusa`)
})

test('a única diferença declarada com /maquinas é o vazio por coluna', () => {
  // `vazio` existe aqui e não lá porque quatro das cinco colunas deste
  // módulo são `not null`, e nenhuma das 25 de /maquinas é lida por um campo
  // que possa ficar em branco numa coluna assim. Sem spec.vazio as duas
  // implementações têm de responder igual, inclusive no vazio.
  const ctx = sandbox()
  const spec = { rotulo: 'Valor', min: 0 }
  const a = ctx.numValidar('', spec)
  const b = MAQ.validarNumero('', spec)
  assert.deepEqual([a.ok, a.valor], [b.ok, b.valor],
    'sem `vazio` declarado, vazio é null nos dois lados')
  const comVazio = ctx.numValidar('', { rotulo: 'Valor', min: 0, vazio: 0 })
  assert.deepEqual([comVazio.ok, comVazio.valor], [true, 0])
})

// ═══════ 6. salvar não grava o que não está na tela ════════════════════

test('o Salvar dos dois formulários é desabilitado enquanto há erro numérico', () => {
  // Enquanto o texto é inválido o CampoNum NÃO atualiza o valor de fora — o
  // formulário segue com o valor anterior. Sem esta guarda, clicar em Salvar
  // gravaria o número antigo com a tela mostrando outro, que é a falha
  // silenciosa que o campo vermelho existe para evitar.
  //
  // Afirma o GUARDA, não a frase: uma busca por texto continuaria passando
  // com o bloco desligado (a lição do caso cego de /equipes).
  assert.match(HTML, /disabled: !fm\.tipo \|\| !fm\.mod \|\| temErroNum\b/,
    'o Salvar do formulário de equipamento não olha o erro numérico')
  assert.match(HTML, /onClick: salvarEd,\s*\n\s*disabled: temErroNumPs/,
    'o Salvar do formulário de PS não olha o erro numérico')
  for (const nome of ['temErroNum', 'temErroNumPs']) {
    assert.match(HTML, new RegExp(`const ${nome} = Object\\.values\\(erros`),
      `${nome} precisa ser derivado do mapa de erros, não de uma bandeira solta`)
  }
})

test('o CampoNum só entrega o valor quando o texto é válido', () => {
  // O corpo da função, recortado antes de procurar dentro dele: `aoMudar`
  // aparece em outros lugares do arquivo, e procurar no arquivo inteiro
  // passaria verde com a guarda removida.
  const corpo = recorte('function CampoNum(', '\n}\n')
  assert.match(corpo, /if \(lido\.ok\) aoMudar\(lido\.valor\)/,
    'o valor está sendo entregue mesmo com o texto inválido')
  assert.match(corpo, /inputMode: spec && spec\.inteiro \? 'numeric' : 'decimal'/,
    'o celular precisa continuar abrindo teclado numérico')
})
