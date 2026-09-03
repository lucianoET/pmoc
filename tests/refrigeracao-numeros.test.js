const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

// ══════════════════════════════════════════════════════════════════════
// Porta única de leitura numérica de /refrigeracao.
//
// Medido no Chromium, com teclado de verdade, em pt-BR e en-US (idêntico
// nos dois — não é locale): os 30 campos `type="number"` deste módulo
// descartavam a vírgula e mantinham os dígitos, então "12,5" chegava ao
// JavaScript como "125". Dez vezes o valor, com `validity.badInput` false
// e `min` calado.
//
// O pior caso não é o preço: é a OS. `corrente_medida` tem check
// `<= 1000` na migração 58, então 12,5 A vira 125 A e PASSA; e
// insuflamento, retorno e pressão são três das quatro colunas que a 58
// deixou deliberadamente sem check, onde −3,5 °C vira −35 °C sem barreira
// nenhuma.
//
// Este gate prova COMPORTAMENTO, carregando o núcleo do próprio HTML num
// sandbox — não regex sobre o arquivo — e mais três coisas que só um teste
// pega: que nenhum campo voltou a ser `type=number`; que a ida e a volta
// fecham; e que esta réplica não divergiu de maquinas/numeros.js.
// ══════════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8')

function recorte(ini, fim) {
  const i = HTML.indexOf(ini)
  assert.ok(i >= 0, `marcador inicial não encontrado: ${ini}`)
  const j = HTML.indexOf(fim, i)
  assert.ok(j > i, `marcador final não encontrado: ${fim}`)
  return HTML.slice(i, j)
}

const NUCLEO = recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){')

function sandbox() {
  const ctx = { console }
  vm.createContext(ctx)
  vm.runInContext(NUCLEO, ctx)
  return ctx
}

// ═══════ 1. o defeito medido ═══════════════════════════════════════════

test('a vírgula decimal é lida como decimal, não descartada', () => {
  const ctx = sandbox()
  const spec = { rotulo: 'Corrente', min: 0, max: 1000 }
  // Campo a campo, e não deepEqual: o objeto vem do sandbox, logo tem outro
  // prototype, e o deepEqual estrito reprovaria por causa disso e não do valor.
  const leu = (t, sp) => { const r = ctx.numValidar(t, sp || spec); return [r.ok, r.valor] }
  assert.deepEqual(leu('12,5'), [true, 12.5],
    'o caso medido: num type=number, digitar 12,5 deixava .value em "125" — ' +
    'doze e meio virava cento e vinte e cinco, e o check <= 1000 da migração 58 aceitava')
  assert.deepEqual(leu('0,5'), [true, 0.5])
  assert.deepEqual(leu('1234,56', { rotulo: 'x', min: 0 }), [true, 1234.56])
  assert.deepEqual(leu('1.234,56', { rotulo: 'x', min: 0 }), [true, 1234.56])
})

test('ponto separando três casas é recusado por ambíguo, nunca adivinhado', () => {
  const ctx = sandbox()
  const r = ctx.numValidar('1.200', { rotulo: 'Corrente', min: 0 })
  assert.equal(r.ok, false,
    '"1.200" pode ser mil e duzentos ou um vírgula dois; adivinhar é o que fez ' +
    'dissipacao_w virar 1,2 antes da migração 56')
  assert.match(r.erro, /amb[íi]guo/i)
})

test('vazio, zero e lixo são três respostas — o `||0` de antes devolvia uma só', () => {
  const ctx = sandbox()
  const spec = { rotulo: 'Preço', min: 0 }
  assert.deepEqual([ctx.numValidar('', spec).ok, ctx.numValidar('', spec).valor], [true, null])
  assert.deepEqual([ctx.numValidar('0', spec).ok, ctx.numValidar('0', spec).valor], [true, 0],
    'zero digitado é afirmação')
  const lixo = ctx.numValidar('abc', spec)
  assert.equal(lixo.ok, false)
  assert.match(lixo.erro, /Preço/, 'a mensagem nomeia o campo')
  assert.equal(ctx.numValidar('12abc', spec).ok, false,
    'parseFloat("12abc") devolvia 12 e engolia o resto — a leitura silenciosa que esta porta acaba')
})

// ═══════ 2. as três medições sem piso, que a 58 deixou sem check ═══════

test('insuflamento, retorno e pressão aceitam negativo — vácuo e câmara fria são leitura real', () => {
  const ctx = sandbox()
  for (const chave of ['med-ins', 'med-ret', 'med-press']) {
    const spec = ctx.NUM_CAMPOS[chave]
    assert.ok(spec, `${chave} sumiu de NUM_CAMPOS`)
    assert.ok(spec.min < 0,
      `${chave}: a migração 58 deixou esta coluna SEM check justamente porque o negativo é ` +
      'legítimo — pressão manométrica negativa é vácuo, e câmara refrigerada insufla abaixo de zero. ' +
      'Um piso em zero aqui recusaria a leitura mais rotineira do serviço.')
    assert.equal(ctx.numValidar('-3,5', spec).valor, -3.5)
  }
  // Corrente e tensão são o contrário: têm check e a tela o espelha.
  assert.equal(ctx.NUM_CAMPOS['med-corr'].min, 0)
  assert.equal(ctx.NUM_CAMPOS['med-corr'].max, 1000)
  assert.equal(ctx.numValidar('-1', ctx.NUM_CAMPOS['med-corr']).ok, false)
})

test('o teto da corrente é o mesmo da migração 58, lido do SQL', () => {
  const ctx = sandbox()
  const sql = fs.readFileSync(path.join(RAIZ, 'supabase', '58_grandezas_fisicas_checks.sql'), 'utf8')
  for (const [chave, coluna] of [['med-corr', 'corrente_medida'], ['med-tensao', 'tensao_medida'],
                                 ['med-cap-marcha', 'capacitor_marcha'], ['med-cap-partida', 'capacitor_partida']]) {
    const m = sql.match(new RegExp(`${coluna} <= \\((\\d+)\\)|${coluna} <= (\\d+)`))
    assert.ok(m, `a migração 58 não declara teto para ${coluna}`)
    const teto = Number(m[1] || m[2])
    assert.equal(ctx.NUM_CAMPOS[chave].max, teto,
      `${chave}: tela ${ctx.NUM_CAMPOS[chave].max}, banco ${teto} — a tela mais frouxa que o ` +
      'check é o erro opaco do Postgres no meio da gravação')
  }
})

// ═══════ 3. os limites do cadastro NÃO são copiados ════════════════════

test('o cadastro de equipamento lê os limites das tabelas da planilha, sem segunda cópia', () => {
  // PLANILHA_MINIMOS e PLANILHA_FAIXAS já espelham os check das migrações
  // 47/56/57. Repetir esses números em NUM_CAMPOS seria a segunda fonte de
  // verdade que D-eq-08 e a migração 52 registram como erro.
  const ctx = sandbox()
  for (const chave of ['areaM2', 'peDireito', 'btu', 'tensao', 'horasDia', 'janelas']) {
    assert.ok(!(chave in ctx.NUM_CAMPOS),
      `${chave} entrou em NUM_CAMPOS — o limite dele já vive em PLANILHA_MINIMOS/PLANILHA_FAIXAS`)
  }
  // Prova por COMPORTAMENTO, não por grep: a primeira versão deste caso
  // procurava "PLANILHA_FAIXAS" no texto de numSpecEquip e passava verde com
  // a leitura desativada por um `false &&` — o texto continua lá. É a mesma
  // cegueira de tests/mapa-editor.test.js varrendo `.from('...')`. Agora
  // injeta-se uma tabela SENTINELA e exige-se que numSpecEquip a devolva.
  vm.runInContext(`
    var PLANILHA_FAIXAS = { btu: {min: 7, max: 77} };
    var PLANILHA_MINIMOS = { areaM2: 0.0001, dissipacaoW: 0 };
  `, ctx)
  const faixa = ctx.numSpecEquip('btu', 'BTU')
  assert.equal(faixa.min, 7, 'numSpecEquip não leu PLANILHA_FAIXAS')
  assert.equal(faixa.max, 77)
  assert.equal(faixa.inteiro, true, 'coluna de PLANILHA_FAIXAS é inteira')
  const area = ctx.numSpecEquip('areaM2', 'Área')
  assert.equal(area.exclusivo, true,
    'PLANILHA_MINIMOS usa 0.0001 como "maior que zero"; aqui isso vira exclusividade declarada')
  const diss = ctx.numSpecEquip('dissipacaoW', 'Dissipação')
  assert.equal(diss.min, 0)
  assert.ok(!diss.exclusivo, 'dissipação aceita zero de verdade — a migração 56 registra por quê')
})

// ═══════ 4. a ida e a volta fecham ═════════════════════════════════════

test('o que o app escreve no campo é o que o leitor lê de volta', () => {
  const ctx = sandbox()
  const spec = { rotulo: 'x' }
  for (const v of [0, 21.5, 5.392, 1200, 380.5, 1234.56, -3.5]) {
    const escrito = ctx.numParaCampo(v)
    const lido = ctx.numValidar(escrito, spec)
    assert.equal(lido.ok, true, `numParaCampo(${v}) = ${JSON.stringify(escrito)} foi recusado pelo leitor`)
    assert.equal(lido.valor, v, `${v} não sobreviveu à ida e volta`)
  }
  assert.equal(ctx.numParaCampo(null), '')
  assert.equal(ctx.numParaCampo(''), '')
  assert.match(ctx.numParaCampo(2.5), /,/, 'decimal com vírgula — é como se lê em português')
  assert.doesNotMatch(ctx.numParaCampo(1200), /\./, 'nunca separador de milhar')
})

// ═══════ 5. o tipo de campo não pode voltar ════════════════════════════

test('nenhum campo do módulo é type="number"', () => {
  assert.doesNotMatch(HTML, /type="number"/,
    'type="number" descarta a vírgula decimal em silêncio (medido: "12,5" vira "125"). ' +
    'Não tem conserto: setRangeText lança "does not support selection" e atribuir "12." zera ' +
    'o campo. Use type="text" com inputmode.')
  const comInputmode = (HTML.match(/inputmode="(decimal|numeric)"/g) || []).length
  assert.ok(comInputmode >= 30,
    `só ${comInputmode} campos declaram inputmode; eram 30 campos numéricos, e sem inputmode ` +
    'o celular abre teclado de texto num aplicativo usado em campo')
})

test('nenhuma leitura numérica de formulário escapa da porta', () => {
  // parseInt sobre <select> continua legítimo: id de registro não é grandeza
  // física. O que não pode voltar é parse* sobre campo onde alguém DIGITA.
  const ctx = sandbox()
  for (const id of Object.keys(ctx.NUM_CAMPOS)) {
    if (id.startsWith('med-') || id === 'ruido' || id === 'tarifa') continue
    assert.doesNotMatch(HTML, new RegExp(`parse(Float|Int)\\([^)]*['"\`]${id}`),
      `${id} voltou a ser lido com parse* direto — a porta única deixou de ser única`)
  }
  assert.doesNotMatch(HTML, /parseFloat\(val\('man-ex/,
    'as medições da evidência passam por manLerMedicoes, que recusa com motivo')
})

// ═══════ 6. a réplica não divergiu de /maquinas ════════════════════════
//
// Este arquivo é congelado e não pode citar a pasta comum, então a regra é
// copiada — precedente de D-eq-15. O que impede a divergência não é o
// lugar, é este caso: as DUAS implementações rodam sobre a mesma tabela.

test('a regra desta réplica é a mesma de maquinas/numeros.js, caso a caso', async () => {
  const ctx = sandbox()
  const MAQ = await import('../maquinas/numeros.js')
  const CASOS = ['12,5', '0,5', '1.200', '1234,56', '1.234,56', '-3,5', '', '   ', '0',
                 'abc', '12abc', '1,2,3', '1.2.3', '8.5', '380,5', '1e3']
  const spec = { rotulo: 'x', min: -90, max: 100000 }
  let divergiu = 0
  for (const c of CASOS) {
    const a = ctx.numValidar(c, spec)
    const b = MAQ.validarNumero(c, spec)
    assert.equal(a.ok, b.ok, `"${c}": refrigeracao ok=${a.ok}, maquinas ok=${b.ok}`)
    if (a.ok) assert.equal(a.valor, b.valor, `"${c}": refrigeracao ${a.valor}, maquinas ${b.valor}`)
    else divergiu++
  }
  assert.ok(divergiu >= 4,
    'a tabela precisa exercer os dois lados: se nada fosse recusado, duas implementações ' +
    'que aceitam tudo passariam de mãos dadas')
  // A metade inversa também: o mesmo número sai igual dos dois.
  for (const v of [0, 21.5, 5.392, 1200, -3.5]) {
    assert.equal(ctx.numParaCampo(v), MAQ.paraCampo(v), `numParaCampo(${v}) divergiu`)
  }
})

test('a planilha continua MAIS estrita que o formulário, e isso é deliberado', () => {
  // celulaParaDecimal recusa "1.234,56"; o formulário aceita. Não é
  // descuido: o CSV é editado à mão e vale forçar a limpeza do arquivo,
  // enquanto no formulário é uma pessoa digitando uma vez. O gate da
  // planilha (refrigeracao-planilha.test.js) trava o lado de lá; este
  // trava o de cá, para a diferença ser lida como decisão e não como bug.
  const ctx = sandbox()
  assert.equal(ctx.numValidar('1.234,56', { rotulo: 'x' }).ok, true,
    'o formulário aceita a forma brasileira completa')
  const planilha = recorte('function celulaParaDecimal(', 'function celulaParaCorrente(')
  assert.match(planilha, /separador de milhar não é aceito/,
    'a planilha recusa a mesma entrada, de propósito — se isso mudar, as duas telas ' +
    'passaram a concordar e este caso vira letra morta')
})
