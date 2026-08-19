const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate da migração do módulo Calibração para o Supabase.
//
// A decisão que este arquivo protege: os dados de calibração do CMASM
// NÃO voltam a morar no navegador. Eram 38 instrumentos, 8 laboratórios,
// os pedidos de serviço e o catálogo da ata inteiros dentro de
// localStorage['cmasm_erp_state_v1'] — limpar o cache apagava o
// controle, e cada computador via um dado diferente.
//
// O teste de maior valor aqui é o de deriva (mais abaixo): o app fala
// camelCase e o Postgres fala snake_case, e a tradução mora num mapa só.
// Se alguém acrescentar coluna na migração e esquecer o mapa — ou o
// contrário — o campo some em silêncio, sem erro, e o dado do
// instrumento é gravado pela metade. É exatamente o tipo de falha que
// não aparece em teste de tela.
const RAIZ = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(RAIZ, 'calibracao', 'index.html'), 'utf8')
const SCHEMA = fs.readFileSync(path.join(RAIZ, 'supabase', '35_calibracao_schema.sql'), 'utf8')
const SEED = fs.readFileSync(path.join(RAIZ, 'supabase', '36_calibracao_seed.sql'), 'utf8')

const TABELAS = ['cal_labs', 'cal_equipamentos', 'cal_ps', 'cal_lotes', 'cal_catalogo']

// ── migração 35 ───────────────────────────────────────────────────────────
test('a migração 35 cria as cinco tabelas do módulo e é aditiva', () => {
  for (const t of TABELAS) {
    assert.match(SCHEMA, new RegExp(`create table if not exists ${t}\\b`), `faltou ${t}`)
  }
  assert.doesNotMatch(SCHEMA, /drop\s+(table|column)/i,
    'migração aditiva: arquiva com ativo = false, nunca dropa')
})

test('a chave primária é o id de texto que o React já usa como referência', () => {
  // Trocar por identity obrigaria a reescrever eqId/labId nas 11 páginas
  // para não ganhar nada em 38 linhas.
  for (const t of ['cal_labs', 'cal_equipamentos', 'cal_ps', 'cal_lotes']) {
    const bloco = corpoDaTabela(t)
    assert.match(bloco, /\bid\s+text primary key/, `${t} deveria ter id text primary key`)
  }
})

test('o número do PS é único, porque passou a ser gerado por vários clientes', () => {
  // Sem isto, dois técnicos emitindo ao mesmo tempo produzem dois
  // PS-CMS-26-013 e ninguém descobre.
  assert.match(corpoDaTabela('cal_ps'), /num\s+text not null unique/)
})

test('o contador de PS não virou coluna nem tabela — é derivado', () => {
  assert.doesNotMatch(SCHEMA, /\bcal_(contador|sequencia|cnt)\b/,
    'o contador é lido do maior número já emitido, não persistido')
})

test('toda coluna de FK tem índice, e prox tem índice parcial só dos ativos', () => {
  assert.match(SCHEMA, /create index if not exists cal_equipamentos_lab_idx on cal_equipamentos\(lab_id\)/)
  assert.match(SCHEMA, /create index if not exists cal_ps_eq_idx\s+on cal_ps\(eq_id\)/)
  assert.match(SCHEMA, /create index if not exists cal_ps_lab_idx\s+on cal_ps\(lab_id\)/)
  assert.match(SCHEMA, /on cal_equipamentos\(prox\) where ativo/,
    'prox decide vencido/a vencer no dashboard; instrumento baixado não entra na conta')
})

test('RLS ligado nas cinco tabelas', () => {
  for (const t of TABELAS) {
    assert.match(SCHEMA, new RegExp(`alter table ${t}\\s+enable row level security`), `RLS faltando em ${t}`)
  }
})

test('as políticas aceitam anon — e o arquivo diz por quê, em letras grandes', () => {
  // Não é descuido: o módulo segue sem login por decisão do usuário
  // (18/08/2026). Se algum dia ganhar shared/auth.js, este teste é o
  // lembrete de que a migração de políticas faz parte do trabalho.
  for (const t of TABELAS) {
    assert.match(SCHEMA, new RegExp(`create policy "${t}_tudo" on ${t}\\s+for all to anon, authenticated`),
      `política de ${t} deveria aceitar anon enquanto o módulo não tem login`)
  }
  assert.match(SCHEMA, /⚠ SEGURANÇA/,
    'a consequência de não ter login fica escrita no topo da migração')
  assert.match(SCHEMA, /QUALQUER PESSOA COM A URL/)
})

test('a ata não virou tabela: só é lida, nunca gravada', () => {
  assert.doesNotMatch(SCHEMA, /create table if not exists cal_ata/)
  assert.match(HTML, /const ATA_ITEMS_SEED = \[/, 'a ata continua constante no código')
  assert.match(HTML, /const ATA_INFO = \{/)
})

// ── migração 36 ───────────────────────────────────────────────────────────
test('o seed carrega as cinco tabelas e reaplicar não duplica', () => {
  for (const t of TABELAS) {
    assert.match(SEED, new RegExp(`insert into ${t} \\(`), `seed faltando para ${t}`)
  }
  const conflitos = SEED.match(/on conflict \([^)]+\) do nothing;/g) || []
  assert.equal(conflitos.length, 5, 'todo insert do seed é idempotente')
})

test('o seed foi gerado, não digitado à mão', () => {
  // ~60 linhas de patrimônio, certificado, data e custo reais: transcrever
  // à mão é erro garantido.
  assert.match(SEED, /GERADO por `node calibracao\/gerar-seed\.mjs`/)
  assert.ok(fs.existsSync(path.join(RAIZ, 'calibracao', 'gerar-seed.mjs')))
})

test('o seed traz a carga que o módulo mostrava de fábrica', () => {
  const linhas = t => {
    const m = new RegExp(`insert into ${t} \\([^)]*\\) values\\n([\\s\\S]*?)\\non conflict`).exec(SEED)
    assert.ok(m, `bloco de ${t} não encontrado no seed`)
    return m[1].split('\n').filter(l => l.trim().startsWith('(')).length
  }
  assert.equal(linhas('cal_labs'), 8)
  assert.equal(linhas('cal_equipamentos'), 38)
  assert.equal(linhas('cal_ps'), 12)
  assert.equal(linhas('cal_lotes'), 2)
})

test('as datas do seed viraram ISO — nenhum dd/mm/aaaa sobrou como texto', () => {
  assert.doesNotMatch(SEED, /'\d{2}\/\d{2}\/\d{4}'/,
    'data em dd/mm/aaaa dentro do SQL significa conversão que não aconteceu')
})

// ── o módulo saiu do localStorage ─────────────────────────────────────────
test('o estado do módulo não é mais gravado no navegador', () => {
  assert.doesNotMatch(HTML, /localStorage\.setItem\(STATE_KEY/,
    'gravar o estado no navegador de volta desfaz a migração inteira')
  assert.match(HTML, /const supa = window\.supabase \? window\.supabase\.createClient/)
})

test('a carga lê as cinco tabelas em paralelo', () => {
  const bloco = /async function carregarTudo\(\)\s*\{([\s\S]*?)\n  \}/.exec(HTML)
  assert.ok(bloco, 'carregarTudo() deveria existir em useStore')
  for (const t of TABELAS) {
    assert.ok(bloco[1].includes(`from('${t}')`), `carregarTudo deveria ler ${t}`)
  }
  assert.match(bloco[1], /Promise\.all\(\[/)
})

test('falha de carga avisa em vez de mostrar telas vazias', () => {
  // Num controle de calibração, tela vazia é indistinguível de "não há
  // instrumento cadastrado" — que é a leitura assustadora e errada.
  assert.match(HTML, /Não foi possível carregar os dados/)
  assert.match(HTML, /isso não significa que não há instrumentos cadastrados/)
  assert.match(HTML, /onClick: \(\) => s\.recarregar\(\)/)
})

test('apagar tudo avisa que o estrago é compartilhado, não local', () => {
  // O texto antigo dizia "alterações feitas neste navegador": depois da
  // migração isso é mentira, e é o clique mais destrutivo do módulo.
  assert.doesNotMatch(HTML, /Todas as alterações feitas neste navegador serão perdidas/,
    'o aviso antigo mentia sobre o alcance do estrago')
  assert.match(HTML, /APAGAR TODOS OS DADOS DE CALIBRAÇÃO\?/)
  assert.match(HTML, /para todos os usuários e todos os computadores/)
})

test('quem tem dado antigo preso no navegador é avisado e consegue exportá-lo', () => {
  assert.match(HTML, /Este navegador ainda guarda dados da versão anterior/)
  assert.match(HTML, /function baixarLegado\(\)/)
})

// ── deriva entre o mapa do app e o schema ─────────────────────────────────
// O teste que mais importa deste arquivo.
function corpoDaTabela(nome) {
  const m = new RegExp(`create table if not exists ${nome} \\(([\\s\\S]*?)\\n\\);`).exec(SCHEMA)
  assert.ok(m, `tabela ${nome} não encontrada na migração 35`)
  return m[1]
}

function colunasDe(nome) {
  return corpoDaTabela(nome)
    .split('\n')
    .map(l => l.replace(/--.*$/, '').trim())
    .filter(l => l && !/^(primary key|unique|check|constraint|foreign key)\b/i.test(l))
    .map(l => (/^([a-z_]+)\s+/.exec(l) || [])[1])
    .filter(Boolean)
}

function mapaDoApp(nome) {
  const m = new RegExp(`const ${nome} = \\{([\\s\\S]*?)\\n\\};`).exec(HTML)
  assert.ok(m, `${nome} não encontrado em calibracao/index.html`)
  return [...m[1].matchAll(/(\w+):\s*'([a-z_]+)'/g)].map(x => x[2])
}

const PARES = [
  ['CAMPOS_LAB', 'cal_labs'],
  ['CAMPOS_EQ', 'cal_equipamentos'],
  ['CAMPOS_PS', 'cal_ps'],
  ['CAMPOS_LOTE', 'cal_lotes']
]

for (const [mapa, tabela] of PARES) {
  test(`${mapa} cobre exatamente as colunas de ${tabela}`, () => {
    const doSchema = colunasDe(tabela).sort()
    const doApp = mapaDoApp(mapa).sort()
    assert.deepEqual(doApp, doSchema,
      `${mapa} e ${tabela} divergiram: um campo fora do mapa é gravado como null, em silêncio`)
  })
}

test('o catálogo grava as mesmas colunas que a tabela declara', () => {
  // Este não passa por CAMPOS_*: o mapa tipo→opções é montado à mão.
  const bloco = /function persistirCatalogo\(c\)\s*\{([\s\S]*?)\n  \}/.exec(HTML)
  assert.ok(bloco, 'persistirCatalogo() deveria existir')
  for (const col of colunasDe('cal_catalogo')) {
    assert.ok(new RegExp(`\\b${col}:`).test(bloco[1]), `persistirCatalogo não grava ${col}`)
  }
})

// ── conversão de data ─────────────────────────────────────────────────────
// O app fala dd/mm/aaaa, o banco fala date. Os dois helpers abaixo são a
// única fronteira; se um deles errar, a data da próxima calibração sai
// trocada e o dashboard inteiro mente.
function extrairFuncao(nome) {
  const m = new RegExp(`function ${nome}\\(v\\) \\{[\\s\\S]*?\\n\\}`).exec(HTML)
  assert.ok(m, `${nome} não encontrada`)
  return m[0]
}
const { paraISO, paraBR } = (() => {
  const src = `${extrairFuncao('paraISO')}\n${extrairFuncao('paraBR')}\nreturn { paraISO, paraBR }`
  return new Function(src)()
})()

test('dd/mm/aaaa vira ISO e volta sem se perder', () => {
  assert.equal(paraISO('12/03/2024'), '2024-03-12')
  assert.equal(paraBR('2024-03-12'), '12/03/2024')
  assert.equal(paraBR(paraISO('01/12/2026')), '01/12/2026')
})

test('dia e mês não se invertem no caminho', () => {
  // 03/12 e 12/03 são datas diferentes; trocar as duas é o erro clássico
  // e silencioso desta conversão.
  assert.equal(paraISO('03/12/2024'), '2024-12-03')
  assert.notEqual(paraISO('03/12/2024'), paraISO('12/03/2024'))
})

test('data ausente ou malformada vira null, nunca uma data errada', () => {
  for (const ruim of [null, undefined, '', '2024-03-12', '12/3/2024', 'sem data', '12/03/24']) {
    assert.equal(paraISO(ruim), null, `paraISO(${JSON.stringify(ruim)}) deveria ser null`)
  }
  assert.equal(paraBR(null), null)
  assert.equal(paraBR(''), null)
})

test('paraBR aceita o timestamp completo que o Postgres pode devolver', () => {
  assert.equal(paraBR('2024-03-12T00:00:00+00:00'), '12/03/2024')
})
