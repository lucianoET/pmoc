const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do plano 10-07 (posicionamento de ativo, PLAT-20) — alcance e limite.
//
// Sem navegador neste ambiente, não dá para clicar no mapa nem arrastar um
// marcador. O que dá para provar por comando é estrutural: que a lista de
// cargos do posicionamento é diferente da do editor de zonas (e por quê),
// que a constante tem origem única, que a gravação valida a coordenada
// antes de enviar e nunca escreve na tabela de locais, que as duas
// coordenadas saem juntas no mesmo comando, que os quatro números do
// envelope são os mesmos dos dois lados (núcleo puro × check do banco), e
// que o mapa não cadastra ativo novo. A prova de que clicar e arrastar
// funcionam de ponta a ponta é do roteiro manual do plano 10-08 — fica lá
// registrada como pendência nomeada, não marcada aqui como se tivesse
// passado.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const MAPA = path.join(RAIZ, 'mapa')
const EDITOR = path.join(MAPA, 'mapa-editor.js')
const DADOS = path.join(MAPA, 'mapa-dados.js')
const APP = path.join(MAPA, 'app.js')
const INDEX_HTML = path.join(MAPA, 'index.html')
const GEOMETRIA = path.join(MAPA, 'mapa-geometria.js')
const MIGRACAO_25 = path.join(RAIZ, 'supabase', '25_mapa_geometria_posicao.sql')
const MIGRACAO_01 = path.join(RAIZ, 'supabase', '01_maquinas_schema.sql')
const MIGRACAO_14 = path.join(RAIZ, 'supabase', '14_eletrica_fonoclama_schema.sql')

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

function arquivosJsDeMapa() {
  return fs
    .readdirSync(MAPA)
    .filter((nome) => nome.endsWith('.js'))
    .map((nome) => path.join(MAPA, nome))
}

// Generaliza extrairCargosEditor de tests/mapa-editor.test.js para
// qualquer nome de constante, aceitando o `export` que CARGOS_POSICAO tem
// e CARGOS_ZONA não tem.
function extrairCargosConst(conteudo, nome) {
  const re = new RegExp(`^(?:export\\s+)?(?:const|let)\\s+${nome}\\s*=\\s*\\[([^\\]]*)\\]`, 'm')
  const m = conteudo.match(re)
  if (!m) return null
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .sort()
}

// Recorta o corpo de uma função exportada pelo nome, do início da
// declaração até o `\n}` que a fecha — mesma técnica que os
// <verify><automated> deste plano usam via sed, reescrita em JS puro.
function corpoDaFuncao(conteudo, nomeFuncao) {
  const inicio = conteudo.indexOf(`function ${nomeFuncao}`)
  if (inicio < 0) return null
  const fechamento = conteudo.indexOf('\n}', inicio)
  return conteudo.slice(inicio, fechamento < 0 ? undefined : fechamento)
}

// ── 1. cargo do posicionamento: subconjunto deliberado da política real,
// diferente do cargo do editor de zonas ──────────────────────────────────
// O caso mais valioso do arquivo, mesmo espírito do caso 1 de
// tests/mapa-editor.test.js, mas com uma diferença importante: a policy de
// update de maq_ativos/elet_ativos NÃO restringe por cargo (`to
// authenticated using (true)`, sem `role in (...)`) — aceitaria qualquer
// sessão autenticada. CARGOS_POSICAO é mais estreita por decisão de
// produto (10-07-PLAN.md § "Decisão de planejamento registrada"), não um
// espelho 1:1 da policy como CARGOS_ZONA é de maq_areas — risco residual
// registrado em T-10-37. Este caso afirma as duas coisas juntas: que
// CARGOS_POSICAO é subconjunto do que o banco aceitaria, e que ela é
// diferente de CARGOS_ZONA — para que ninguém "uniformize" as duas listas
// numa fase futura achando que uma delas está errada.
test('CARGOS_POSICAO é subconjunto deliberado do que a policy de update das tabelas de ativo aceitaria, e é diferente de CARGOS_ZONA (mapa-editor.js)', () => {
  const dados = ler(DADOS)
  const editor = ler(EDITOR)
  const migMaquinas = ler(MIGRACAO_01)
  const migEletrica = ler(MIGRACAO_14)

  const cargosPosicao = extrairCargosConst(dados, 'CARGOS_POSICAO')
  assert.ok(cargosPosicao, 'não foi possível extrair CARGOS_POSICAO de mapa-dados.js')
  assert.deepEqual(cargosPosicao, ['admin', 'gestor', 'tecnico'].sort())

  // A ausência de `role in (...)` na policy real (ao contrário de
  // maq_areas_insert, que o editor de zona espelha) é o que prova que
  // CARGOS_POSICAO estreita a tela por decisão de produto, não replica uma
  // restrição do banco que não existe.
  assert.match(
    migMaquinas,
    /for update to authenticated using \(true\)/,
    'a policy de update de maq_ativos mudou de forma — CARGOS_POSICAO precisa ser revisada junto'
  )
  assert.doesNotMatch(
    migMaquinas,
    /for update[^;]*role in \(/,
    'a policy de update de maq_ativos passou a restringir por cargo — CARGOS_POSICAO deixaria de ser subconjunto e passaria a precisar espelhar, como o editor de zona faz com maq_areas'
  )
  assert.match(
    migEletrica,
    /for update to authenticated using \(true\) with check \(true\)/,
    'a policy de update de elet_ativos mudou de forma — CARGOS_POSICAO precisa ser revisada junto'
  )

  const cargosZona = extrairCargosConst(editor, 'CARGOS_ZONA')
  assert.ok(cargosZona, 'não foi possível extrair CARGOS_ZONA de mapa-editor.js')
  assert.notDeepEqual(
    cargosPosicao,
    cargosZona,
    `CARGOS_POSICAO (${cargosPosicao.join(',')}) e CARGOS_ZONA (${cargosZona.join(',')}) deveriam ser diferentes — tabelas e políticas diferentes (10-06-PLAN.md / 10-07-PLAN.md), a divergência é intencional`
  )
})

// ── 2. origem única: declarada em mapa-dados.js, importada pelo editor ──
test('CARGOS_POSICAO é declarada uma vez só, na camada de dados — o editor importa em vez de redeclarar', () => {
  const dados = ler(DADOS)
  const editor = ler(EDITOR)
  assert.match(dados, /^export const CARGOS_POSICAO/m, 'mapa-dados.js não declara CARGOS_POSICAO no início da linha')
  assert.match(
    editor,
    /import\s*\{[^}]*CARGOS_POSICAO[^}]*\}\s*from\s*['"]\.\/mapa-dados\.js['"]/,
    'mapa-editor.js não importa CARGOS_POSICAO de ./mapa-dados.js'
  )
  assert.doesNotMatch(
    editor,
    /^(const|let)\s+CARGOS_POSICAO/m,
    'mapa-editor.js redeclara CARGOS_POSICAO em vez de importar — origem deixaria de ser única'
  )
})

// ── 3. validação de envelope acontece ANTES da gravação ──────────────────
test('salvarPosicaoAtivo valida a coordenada pelo núcleo puro (dentroDoEnvelope) antes de qualquer .update(', () => {
  const dados = ler(DADOS)
  const funcao = corpoDaFuncao(dados, 'salvarPosicaoAtivo')
  assert.ok(funcao, 'não foi possível localizar o corpo de salvarPosicaoAtivo em mapa-dados.js')
  const posValidacao = funcao.indexOf('dentroDoEnvelope')
  const posUpdate = funcao.indexOf('.update(')
  assert.ok(posValidacao >= 0, 'salvarPosicaoAtivo não chama dentroDoEnvelope')
  assert.ok(posUpdate >= 0, 'salvarPosicaoAtivo não grava com .update(')
  assert.ok(
    posValidacao < posUpdate,
    'a validação de envelope acontece DEPOIS do .update( — deveria vir antes, para nunca mandar coordenada implausível para o banco'
  )
})

// ── 4. os quatro números do envelope são iguais nos dois lados — só possível
// agora, com os dois arquivos já existindo (ver 10-07-PLAN.md § Task 3) ──
test('os quatro números do envelope (mapa-geometria.js) são exatamente os quatro do check da migração 25 (25_mapa_geometria_posicao.sql)', () => {
  const geometria = ler(GEOMETRIA)
  const migracao = ler(MIGRACAO_25)

  const mEnvelope = geometria.match(
    /ENVELOPE\s*=\s*\{\s*latMin:\s*(-?[\d.]+),\s*latMax:\s*(-?[\d.]+),\s*lonMin:\s*(-?[\d.]+),\s*lonMax:\s*(-?[\d.]+)\s*\}/
  )
  assert.ok(mEnvelope, 'não foi possível extrair ENVELOPE de mapa-geometria.js')
  const [, latMinNucleo, latMaxNucleo, lonMinNucleo, lonMaxNucleo] = mEnvelope

  const mLat = migracao.match(/lat between (-?[\d.]+) and (-?[\d.]+)/)
  const mLon = migracao.match(/lon between (-?[\d.]+) and (-?[\d.]+)/)
  assert.ok(mLat, 'não foi possível extrair o intervalo de lat do check da migração 25')
  assert.ok(mLon, 'não foi possível extrair o intervalo de lon do check da migração 25')

  assert.equal(Number(latMinNucleo), Number(mLat[1]), 'latMin diverge entre o núcleo puro e a migração 25')
  assert.equal(Number(latMaxNucleo), Number(mLat[2]), 'latMax diverge entre o núcleo puro e a migração 25')
  assert.equal(Number(lonMinNucleo), Number(mLon[1]), 'lonMin diverge entre o núcleo puro e a migração 25')
  assert.equal(Number(lonMaxNucleo), Number(mLon[2]), 'lonMax diverge entre o núcleo puro e a migração 25')
})

// ── 5. nunca escreve na tabela de locais ──────────────────────────────────
test('salvarPosicaoAtivo não referencia cmasm_locais — posição de ativo não pode mover o prédio (D-03)', () => {
  const dados = ler(DADOS)
  const funcao = corpoDaFuncao(dados, 'salvarPosicaoAtivo')
  assert.ok(funcao, 'não foi possível localizar o corpo de salvarPosicaoAtivo em mapa-dados.js')
  assert.doesNotMatch(funcao, /cmasm_locais/, 'salvarPosicaoAtivo referencia cmasm_locais')
})

// ── 6. as duas coordenadas saem juntas no mesmo comando ──────────────────
test('lat e lon são gravados no mesmo objeto .update( — nunca em duas chamadas separadas', () => {
  const dados = ler(DADOS)
  const funcao = corpoDaFuncao(dados, 'salvarPosicaoAtivo')
  assert.ok(funcao, 'não foi possível localizar o corpo de salvarPosicaoAtivo em mapa-dados.js')
  const mUpdate = funcao.match(/\.update\(\{([^}]*)\}\)/)
  assert.ok(mUpdate, 'salvarPosicaoAtivo não chama .update({ ... })')
  assert.match(mUpdate[1], /\blat\b/, 'o objeto do .update( não inclui lat')
  assert.match(mUpdate[1], /\blon\b/, 'o objeto do .update( não inclui lon')
})

// ── 7. o mapa não cadastra ativo novo ─────────────────────────────────────
// A única inserção que o módulo mapa/ deveria ter no total é a de zona
// (salvarZona, maq_areas, plano 10-06) — posicionamento de ativo grava só
// por .update( (Task 1 deste plano). Contagem total, não por arquivo, para
// pegar tanto um .insert( solto em mapa-editor.js quanto uma segunda
// função de escrita esquecida em mapa-dados.js.
test('mapa/ não cadastra ativo novo — a única .insert( do módulo continua sendo a de zona (maq_areas)', () => {
  let totalInserts = 0
  for (const arquivo of arquivosJsDeMapa()) {
    const conteudo = ler(arquivo)
    const inserts = (conteudo.match(/\.insert\(/g) || []).length
    totalInserts += inserts
    if (arquivo !== DADOS) {
      assert.equal(
        inserts,
        0,
        `${path.basename(arquivo)} chama .insert( — nenhum arquivo fora de mapa-dados.js deveria escrever no banco`
      )
    }
  }
  assert.equal(
    totalInserts,
    1,
    'mapa/ deveria ter exatamente uma chamada .insert( no total (salvarZona, maq_areas) — posicionamento de ativo grava só por .update('
  )
})

// ── 8. lista de não localizados vem da camada de dados, estado vazio
// explícito ────────────────────────────────────────────────────────────
test('o painel de não localizados vem de NAO_LOCALIZADOS (mapa-dados.js) e tem estado vazio explícito', () => {
  const app = ler(APP)
  const html = ler(INDEX_HTML)
  assert.match(
    app,
    /import\s*\{[^}]*NAO_LOCALIZADOS[^}]*\}\s*from\s*['"]\.\/mapa-dados\.js['"]/,
    'mapa/app.js não importa NAO_LOCALIZADOS de ./mapa-dados.js'
  )
  assert.match(app, /NAO_LOCALIZADOS\.length/, 'mapa/app.js não lê o total de NAO_LOCALIZADOS')
  assert.match(
    app,
    /Todos os ativos carregados estão posicionados/,
    'mapa/app.js não mostra a frase de estado vazio explícito da lista de não localizados'
  )
  assert.match(html, /id="nao-localizados"/, 'mapa/index.html não tem o contêiner id="nao-localizados"')
})
