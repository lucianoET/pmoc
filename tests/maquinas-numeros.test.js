const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════════
// Leitor numérico central de /maquinas (maquinas/numeros.js).
//
// O módulo lia número de campo em 25 lugares, cada um do seu jeito, e a
// migração 58 saiu sem espelho na tela justamente por isso — com a
// justificativa, registrada no CLAUDE.md, de que `type="number"` entrega
// número e não há corrupção silenciosa.
//
// A medição no navegador desmentiu a justificativa: digitando "12,5" num
// `input[type=number]`, `.value` vira "125". A vírgula é descartada e os
// dígitos ficam — dez vezes o valor, sem erro, com `badInput` false. Os
// campos passaram a `type="text" inputmode="decimal"`, porque `type=number`
// não tem conserto (sem API de seleção e com sanitização na atribuição), e
// a leitura passou a ser uma porta só.
//
// Este gate prova COMPORTAMENTO importando o núcleo puro em Node — não
// regex sobre o arquivo —, e mais duas coisas que só um teste pega:
//   · que a tela nunca fica mais frouxa que o `check` do Postgres;
//   · que nenhum campo numérico voltou a ser `type="number"`.
// ══════════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const APP = fs.readFileSync(path.join(RAIZ, 'maquinas', 'app.js'), 'utf8')
const HTML = fs.readFileSync(path.join(RAIZ, 'maquinas', 'index.html'), 'utf8')
const FONTE = fs.readFileSync(path.join(RAIZ, 'maquinas', 'numeros.js'), 'utf8')

// O núcleo é ES module e este gate é CommonJS, como todos os outros do
// projeto. Em vez de trocar o formato de um lado só, o import dinâmico
// resolve — e é o mesmo recurso que outros gates já usam para ler shared/.
let NUM
test.before(async () => { NUM = await import('../maquinas/numeros.js') })

// ═══════ 1. o defeito medido: separador decimal ════════════════════════

test('a vírgula decimal é lida como decimal, não descartada', () => {
  const spec = { rotulo: 'Litros', min: 0, exclusivo: true, max: 10000 }
  assert.deepEqual(NUM.validarNumero('12,5', spec), { ok: true, valor: 12.5 },
    'o caso medido no navegador: digitando 12,5 num type=number o .value vinha "125" — ' +
    'doze e meio virava cento e vinte e cinco, sem erro nenhum')
  assert.deepEqual(NUM.validarNumero('0,5', spec), { ok: true, valor: 0.5 })
  assert.deepEqual(NUM.validarNumero('1234,56', spec), { ok: true, valor: 1234.56 },
    'forma brasileira completa: o ponto é milhar quando existe vírgula')
  assert.deepEqual(NUM.validarNumero('1.234,56', spec), { ok: true, valor: 1234.56 })
})

test('ponto separando três casas é recusado por ambíguo, nunca adivinhado', () => {
  const r = NUM.validarNumero('1.200', { rotulo: 'Litros', min: 0 })
  assert.equal(r.ok, false,
    '"1.200" pode ser mil e duzentos ou um vírgula dois; adivinhar é o que fez ' +
    'dissipacao_w virar 1,2 antes da migração 56')
  assert.match(r.erro, /amb[íi]guo/i)
  // A regra é a mesma de celulaParaValor em /refrigeracao — uma regra, dois
  // pontos de entrada. Se as duas divergirem, o mesmo texto passa numa tela
  // e é recusado na outra.
  const planilha = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8')
  assert.match(planilha, /é ambíguo — ponto separando três casas/,
    'a regra de ambiguidade de /refrigeracao é a origem desta; se ela sumir de lá, ' +
    'as duas telas passaram a discordar sobre o mesmo texto')
})

test('duas vírgulas ou dois pontos são recusados', () => {
  const spec = { rotulo: 'Valor', min: 0 }
  assert.equal(NUM.validarNumero('1,2,3', spec).ok, false)
  assert.equal(NUM.validarNumero('1.2.3', spec).ok, false)
})

// ═══════ 2. vazio, zero e lixo são TRÊS respostas ══════════════════════

test('vazio devolve null e lixo devolve erro — nem um nem outro vira zero', () => {
  const spec = { rotulo: 'Preço', min: 0 }
  assert.deepEqual(NUM.validarNumero('', spec), { ok: true, valor: null },
    'campo vazio é "não informado", que é diferente de zero')
  assert.deepEqual(NUM.validarNumero('   ', spec), { ok: true, valor: null })
  assert.deepEqual(NUM.validarNumero('0', spec), { ok: true, valor: 0 },
    'zero digitado é uma afirmação e tem de sobreviver como zero')
  const lixo = NUM.validarNumero('abc', spec)
  assert.equal(lixo.ok, false,
    '`parseFloat("abc") || 0` devolvia 0: um cadastro incompleto virava afirmação numérica')
  assert.match(lixo.erro, /Preço/, 'a mensagem nomeia o campo — "erro ao salvar" não diz onde olhar')
})

test('"12abc" é recusado, não truncado em 12', () => {
  const r = NUM.validarNumero('12abc', { rotulo: 'Horas', min: 0 })
  assert.equal(r.ok, false,
    'parseFloat("12abc") devolve 12 e engole o resto — é a leitura silenciosa ' +
    'que esta porta existe para acabar; Number() devolve NaN e vira mensagem')
})

test('obrigatório distingue "não preencheu" de "preencheu com zero"', () => {
  const spec = { rotulo: 'Litros', min: 0, exclusivo: true, obrigatorio: true }
  assert.equal(NUM.validarNumero('', spec).ok, false)
  assert.equal(NUM.validarNumero('0', spec).ok, false, 'zero não passa num mínimo exclusivo')
  assert.deepEqual(NUM.validarNumero('0.1', spec), { ok: true, valor: 0.1 })
})

// ═══════ 3. faixas ═════════════════════════════════════════════════════

test('mínimo inclusivo aceita a borda; exclusivo recusa', () => {
  assert.deepEqual(NUM.validarNumero('0', { rotulo: 'X', min: 0 }), { ok: true, valor: 0 })
  assert.equal(NUM.validarNumero('0', { rotulo: 'X', min: 0, exclusivo: true }).ok, false,
    '`exclusivo` espelha `> 0` do banco; sem ele o mínimo espelha `>= 0`')
  assert.equal(NUM.validarNumero('-0.01', { rotulo: 'X', min: 0 }).ok, false)
})

test('o teto pega dígito repetido e a mensagem diz que é isso', () => {
  const r = NUM.validarNumero('100000', { rotulo: 'Litros', min: 0, max: 10000 })
  assert.equal(r.ok, false)
  assert.match(r.erro, /d[íi]gito/, 'o teto existe para pegar digitação, e a frase orienta a conferir')
})

test('inteiro recusa fração', () => {
  const spec = { rotulo: 'Periodicidade', min: 0, exclusivo: true, inteiro: true }
  assert.equal(NUM.validarNumero('30.5', spec).ok, false)
  assert.deepEqual(NUM.validarNumero('30', spec), { ok: true, valor: 30 })
})

// ═══════ 4. a tela nunca mais frouxa que o banco ═══════════════════════
//
// Esta é a invariante que dá sentido ao arquivo. Onde a coluna tem `check`,
// a tela pode ser MAIS estrita (e é, de propósito, em uso-delta), mas nunca
// mais frouxa: frouxidão é o erro opaco do Postgres no meio da gravação.
//
// Diferente de PLANILHA_FAIXAS em /refrigeracao, que exige igualdade nas
// duas direções — lá o ciclo exportar/reimportar (D-5hy-04) obriga um valor
// aceito pelo banco a sobreviver à volta. Aqui não há ida e volta.

const SQL = fs.readdirSync(path.join(RAIZ, 'supabase'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => fs.readFileSync(path.join(RAIZ, 'supabase', f), 'utf8'))
  .join('\n')

// Lê o piso que o banco declara para UMA coluna de UMA tabela.
//
// A primeira versão procurava o nome da coluna no SQL inteiro e errou duas
// vezes, as duas pegas antes de entrar:
//
//   · casou `check (delta > 0)` de `elet_uso_registros`/`fono_uso_registros`
//     (migração 14) ao perguntar por `maq_uso_registros.delta`, que é `>= 0`
//     — nome de coluna se repete entre tabelas, e sem escopo o gate compara
//     a tela com a regra de outro módulo;
//   · casou o texto de um COMENTÁRIO da própria migração 58, que discute
//     `delta >= 0` em prosa.
//
// É a cegueira de tests/mapa-editor.test.js varrendo `.from('...')`: procurar
// o texto certo no lugar errado. Agora os comentários saem primeiro e a busca
// é presa à tabela, nas duas formas que o projeto usa — coluna declarada
// dentro do `create table` e `alter table ... add constraint`.
const SQL_SEM_COMENTARIO = SQL.replace(/--[^\n]*/g, '')

function pisoNoBanco(coluna) {
  const [tabela, campo] = coluna.split('.')
  const trechos = []

  const criacao = SQL_SEM_COMENTARIO.match(
    new RegExp(`create table (?:if not exists )?${tabela}\\s*\\(([\\s\\S]*?)\\n\\);`))
  if (criacao) trechos.push(criacao[1])

  const reAlter = new RegExp(`alter table ${tabela} add constraint [a-z_]+\\s*check \\(([^;]*?)\\);`, 'g')
  let m
  while ((m = reAlter.exec(SQL_SEM_COMENTARIO))) trechos.push(m[1])

  for (const trecho of trechos) {
    const c = trecho.match(new RegExp(`\\b${campo}\\s*(>=|>)\\s*(-?[0-9.]+)`))
    if (c) return { min: Number(c[2]), exclusivo: c[1] === '>' }
  }
  return null
}

test('todo campo de NUM_CAMPOS nomeia a coluna que alimenta', () => {
  for (const [id, spec] of Object.entries(NUM.NUM_CAMPOS)) {
    assert.match(spec.coluna || '', /^[a-z_]+\.[a-z_0-9]+$/,
      `${id}: sem a coluna não há como comparar a tela com o banco`)
    assert.ok(spec.rotulo, `${id}: sem rótulo a mensagem de erro não diz qual campo`)
    assert.equal(typeof spec.min, 'number', `${id}: todo campo declara um piso`)
  }
})

test('nenhum campo aceita o que o Postgres recusa', () => {
  let comparados = 0
  for (const [id, spec] of Object.entries(NUM.NUM_CAMPOS)) {
    const banco = pisoNoBanco(spec.coluna)
    if (!banco) continue
    comparados++
    // A tela é pelo menos tão estrita: piso maior, ou piso igual com
    // exclusividade igual ou mais forte.
    const telaOk = spec.min > banco.min ||
      (spec.min === banco.min && (spec.exclusivo === true || banco.exclusivo !== true))
    assert.ok(telaOk,
      `${id} (${spec.coluna}): a tela aceita ${spec.exclusivo ? '>' : '>='} ${spec.min} ` +
      `e o banco exige ${banco.exclusivo ? '>' : '>='} ${banco.min} — ` +
      'a tela mais frouxa que o banco é exatamente o erro opaco no meio da gravação')
  }
  assert.ok(comparados >= 10,
    `só ${comparados} campos foram comparados contra o SQL; se esse número desabar, ` +
    'a leitura das migrações quebrou e este caso está passando sem comparar nada')
})

test('uso-delta é mais estrito que o banco, e isso é deliberado', () => {
  const spec = NUM.NUM_CAMPOS['uso-delta']
  assert.equal(spec.exclusivo, true)
  const banco = pisoNoBanco('maq_uso_registros.delta')
  assert.deepEqual(banco, { min: 0, exclusivo: false },
    'a migração 58 registra por que o banco aceita delta zero: ' +
    '"nenhum uso desde a última leitura" é plausível')
  // A tela recusa mesmo assim: registrar uso de zero hora é digitação sem
  // conteúdo. É o caso que prova que a invariante é "contido", não "igual".
  assert.equal(NUM.validarNumero('0', spec).ok, false)
})

// ═══════ 5. o tipo de campo não pode voltar ════════════════════════════

test('nenhum campo numérico é type="number" — nem no HTML nem criado em JS', () => {
  for (const [arquivo, texto] of [['maquinas/index.html', HTML], ['maquinas/app.js', APP]]) {
    assert.doesNotMatch(texto, /type="number"/,
      `${arquivo}: type="number" descarta a vírgula decimal em silêncio ` +
      '(medido: "12,5" vira "125", dez vezes o valor, com badInput false). ' +
      'Não tem conserto: setRangeText lança "does not support selection" e ' +
      'atribuir "12." zera o campo. Use type="text" inputmode="decimal".')
  }
})

test('todo input de leitura numérica declara inputmode', () => {
  const comInputmode = (HTML.match(/inputmode="(decimal|numeric)"/g) || []).length +
                       (APP.match(/inputmode="(decimal|numeric)"/g) || []).length
  assert.ok(comInputmode >= 25,
    `só ${comInputmode} campos declaram inputmode; eram 25 campos numéricos e sem ` +
    'inputmode o celular abre teclado de texto num aplicativo usado em campo')
})

// ═══════ 6. a porta é única ════════════════════════════════════════════

test('nenhuma leitura numérica de formulário escapa do leitor', () => {
  // parseInt sobre `<select>` continua legítimo e fora do escopo: id de
  // registro não é grandeza física, não tem faixa e não alimenta cálculo.
  // O que não pode voltar é parse* sobre campo onde alguém DIGITA número.
  const IDS_NUMERICOS = Object.keys(NUM.NUM_CAMPOS)
  for (const id of IDS_NUMERICOS) {
    const re = new RegExp(`parse(Float|Int)\\([^)]*['"\`]${id}`)
    assert.doesNotMatch(APP, re,
      `${id} voltou a ser lido com parse* direto — a porta única deixou de ser única`)
  }
  assert.doesNotMatch(APP, /parseFloat\(document\.getElementById/,
    'parseFloat sobre campo de formulário é a leitura que este arquivo substituiu')
})

test('app.js importa o leitor e não reimplementa a regra', () => {
  assert.match(APP, /import \{[^}]*\} from '\.\/numeros\.js'/,
    'app.js importa do leitor central')
  for (const nome of ['lerNumero', 'lerNumeroTexto', 'paraCampo']) {
    assert.match(APP, new RegExp(`import \\{[^}]*\\b${nome}\\b[^}]*\\} from '\\./numeros\\.js'`),
      `${nome} tem de vir do leitor — a lista do import não é fixa, mas estes três são`)
  }
  assert.doesNotMatch(APP, /replace\(',', ?'\.'\)/,
    'a tradução de vírgula mora só em normalizarDecimal; uma segunda cópia ' +
    'diverge na primeira correção feita de um lado só')
})

test('o núcleo puro não toca em API de navegador', () => {
  const nucleo = FONTE.slice(0, FONTE.indexOf('// ── borda de DOM'))
  assert.ok(nucleo.length > 500, 'o marcador que separa núcleo de borda sumiu')
  for (const proibido of ['document', 'window', 'localStorage', 'alert(']) {
    assert.ok(!nucleo.includes(proibido),
      `o núcleo cita ${proibido}: a divisão núcleo puro / borda de DOM é o que ` +
      'permite testar comportamento em Node, como shared/tema.js e mapa-geometria.js')
  }
})

test('o prompt do recebimento passa pelo leitor — ali a vírgula chega inteira', () => {
  // prompt() devolve texto cru: "12,5" chega com a vírgula, e parseFloat
  // truncava em 12. É o único campo numérico que nunca foi um <input>.
  const bloco = APP.match(/async function receberItem\(itemId\)\{([\s\S]*?)\n\}/)
  assert.ok(bloco)
  assert.match(bloco[1], /lerNumeroTexto\(bruto, 'recebimento'\)/)
  assert.doesNotMatch(bloco[1], /parseFloat/)
})

test('o que o app escreve no campo é o que o leitor lê de volta', () => {
  // A metade que faltava na primeira versão: sem paraCampo o app preenchia
  // `area-m2` com "5.392" (Number(5.392) em texto) e o próprio leitor
  // recusava por ambíguo — um campo que o aplicativo enche com algo que ele
  // mesmo não aceita. Hoje não existe valor assim nas oito colunas
  // (conferido no banco), e é justamente por isso que o gate existe: o
  // primeiro a aparecer não pode encontrar a porta fechada.
  const spec = { rotulo: 'Área', min: 0 }
  for (const v of [0, 1, 1.5, 5.392, 1200, 1234.56, 8.5, 0.001, 66, 185000]) {
    const escrito = NUM.paraCampo(v)
    const lido = NUM.validarNumero(escrito, spec)
    assert.equal(lido.ok, true, `paraCampo(${v}) = ${JSON.stringify(escrito)} foi recusado pelo leitor`)
    assert.equal(lido.valor, v, `${v} não sobreviveu à ida e volta (virou ${lido.valor})`)
  }
  assert.equal(NUM.paraCampo(null), '', 'null vira campo vazio, não "null" nem zero')
  assert.equal(NUM.paraCampo(undefined), '')
  assert.equal(NUM.paraCampo(''), '')
  assert.match(NUM.paraCampo(2.5), /,/, 'decimal é escrito com vírgula — é assim que se lê em português')
  assert.doesNotMatch(NUM.paraCampo(1200), /\./,
    'nunca separador de milhar: reintroduziria a ambiguidade do outro lado')
})

test('nenhum campo numérico é preenchido sem passar por paraCampo', () => {
  // O caminho de volta tem de ser único como o de ida. Um `value="${x}"` cru
  // devolve o número na forma do JavaScript (ponto), que é o que o leitor
  // recusa quando cai em três casas decimais.
  const crus = APP.match(/id="(ed-atual|ed-minimo|ed-preco|nec-qtd-\$\{[^}]*\})"[^>]*value="\$\{(?!paraCampo)[^}]*\}"/g) || []
  assert.deepEqual(crus, [], `campos preenchidos sem paraCampo: ${crus.join(' | ')}`)
})
