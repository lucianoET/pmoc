const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do plano 10-06 (editor de zona, PLAT-18) — alcance e limite.
//
// Sem navegador e sem credenciais do Supabase neste ambiente, não dá para
// desenhar um polígono e ver a área/máquinas compatíveis aparecerem na
// tela. O que dá para provar por comando é estrutural: que o editor está
// escopado ao cargo certo (comparado com a política real do banco, não
// só lido), que ele não reimplementa o que o plano 10-02 já testou, que
// não criou uma segunda instância de mapa, que restringe o desenho a
// polígono e que a camada de rede do editor legado não veio junto. A
// prova de que o desenho funciona de ponta a ponta é do roteiro manual do
// plano 10-08 — fica lá registrada como pendência nomeada, não marcada
// aqui como se tivesse passado.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const MAPA = path.join(RAIZ, 'mapa')
const EDITOR = path.join(MAPA, 'mapa-editor.js')
const DADOS = path.join(MAPA, 'mapa-dados.js')
const APP = path.join(MAPA, 'app.js')
const INDEX_HTML = path.join(MAPA, 'index.html')
const MIGRACAO_12 = path.join(RAIZ, 'supabase', '12_maquinas_areas_operacoes.sql')

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

// remove comentário de linha (// até o fim da linha) — mesma técnica do
// <verify> deste plano, para que uma referência dentro de um comentário
// explicando "o que NÃO é portado" não derrube o teste que confere
// justamente a ausência dela no código real
function semComentarios(conteudo) {
  return conteudo
    .split('\n')
    .map((linha) => linha.replace(/\/\/.*$/, ''))
    .join('\n')
}

function extrairCargosEditor(conteudo) {
  const linha = conteudo.split('\n').find((l) => /^(const|let) +CARGOS[A-Z_]* *=/i.test(l))
  if (!linha) return null
  const m = linha.match(/\[([^\]]*)\]/)
  if (!m) return null
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .sort()
}

function extrairCargosPolicy(sql, nomePolicy) {
  const inicio = sql.indexOf(`policyname='${nomePolicy}'`)
  if (inicio < 0) return null
  const trecho = sql.slice(inicio, inicio + 500)
  const m = trecho.match(/role in \(([^)]*)\)/)
  if (!m) return null
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .sort()
}

// ── 1. cargo do editor == cargo da política real do banco ──────────────
// O caso mais valioso do arquivo: impede que a tela e o banco divirjam em
// qualquer direção — nem a tela prometendo o que o banco recusa, nem o
// banco aceitando de quem a tela não mostra (T-10-28). A divergência com
// o teste equivalente do plano 10-07 (posicionamento de ativo) é
// esperada: as duas telas gravam tabelas diferentes, com políticas
// diferentes (maq_areas aqui, tabelas de ativo lá).
test('a lista de cargos do editor de zona é exatamente a da política de escrita real de maq_areas (migração 12)', () => {
  const editor = ler(EDITOR)
  const migracao = ler(MIGRACAO_12)
  const cargosEditor = extrairCargosEditor(editor)
  const cargosPolicy = extrairCargosPolicy(migracao, 'maq_areas_insert')
  assert.ok(cargosEditor, 'não foi possível extrair a constante CARGOS_ZONA de mapa-editor.js')
  assert.ok(cargosPolicy, 'não foi possível extrair os cargos de maq_areas_insert de 12_maquinas_areas_operacoes.sql')
  assert.deepEqual(
    cargosEditor,
    cargosPolicy,
    `cargos do editor (${cargosEditor.join(',')}) divergem da política de escrita real de maq_areas (${cargosPolicy.join(',')})`
  )
})

// ── 2. instância de mapa existente, não uma segunda ─────────────────────
test('o editor obtém a instância de mapa existente e não cria uma segunda instância de Leaflet', () => {
  const editor = semComentarios(ler(EDITOR))
  assert.doesNotMatch(editor, /L\.map\(/, 'mapa-editor.js chama L.map( — criaria uma segunda instância')
  const app = ler(APP)
  assert.match(app, /getLeafletMap/, 'mapa/app.js não obtém a instância de mapa existente via getLeafletMap')
  assert.match(app, /iniciarEditorZonas/, 'mapa/app.js não chama iniciarEditorZonas')
})

// ── 3. núcleo puro reusado, não reimplementado ──────────────────────────
test('o editor importa o núcleo puro de mapa-geometria.js e não reimplementa o cálculo de área', () => {
  const editor = ler(EDITOR)
  assert.match(editor, /from\s+['"]\.\/mapa-geometria\.js['"]/, 'mapa-editor.js não importa de ./mapa-geometria.js')
  assert.doesNotMatch(editor, /6371000/, 'mapa-editor.js contém a constante de raio da Terra — cálculo de área reimplementado')
})

// ── 4. desenho restrito a polígono ──────────────────────────────────────
test('o editor restringe a ferramenta de desenho a polígono — as demais formas do leaflet-draw ficam desligadas', () => {
  const editor = ler(EDITOR)
  assert.match(editor, /L\.Draw\.Event\.CREATED/, 'mapa-editor.js não escuta o evento de criação do leaflet-draw')
  for (const forma of ['polyline: false', 'rectangle: false', 'circle: false', 'marker: false', 'circlemarker: false']) {
    assert.ok(editor.includes(forma), `mapa-editor.js não desliga a forma "${forma}"`)
  }
})

// ── 5. camada de rede do legado não foi portada ──────────────────────────
// Procurado em código SEM comentário, de propósito: o próprio arquivo
// explica em prosa por que o padrão do legado (requisição a serviço em
// porta local, própria do editor DEV_ERP) não foi portado — essa
// explicação mencionaria os termos sem violar a ausência real no código.
test('a camada de rede do editor legado (endereço de serviço local, chamada de requisição) não foi portada para o código de mapa-editor.js', () => {
  const codigo = semComentarios(ler(EDITOR))
  assert.doesNotMatch(codigo, /localhost/i, 'código de mapa-editor.js referencia endereço de serviço local')
  assert.doesNotMatch(codigo, /fetch\(/, 'código de mapa-editor.js chama fetch( diretamente')
  assert.doesNotMatch(codigo, /XMLHttpRequest/, 'código de mapa-editor.js usa XMLHttpRequest')
})

// ── 6. escritas moram na camada de dados, não no editor ──────────────────
test('as escritas em maq_areas moram em mapa-dados.js — mapa-editor.js chama salvarZona/atualizarZona, nunca .insert/.update diretamente', () => {
  const editor = ler(EDITOR)
  const dados = ler(DADOS)
  for (const escrita of ['.insert(', '.update(', '.upsert(', '.delete(']) {
    assert.ok(!editor.includes(escrita), `mapa-editor.js contém uma escrita direta (${escrita}) — deveria estar só em mapa-dados.js`)
  }
  assert.match(dados, /export\s+(async\s+function|function)\s+salvarZona/, 'mapa-dados.js não exporta salvarZona')
  assert.match(dados, /export\s+(async\s+function|function)\s+atualizarZona/, 'mapa-dados.js não exporta atualizarZona')
  assert.match(editor, /salvarZona/, 'mapa-editor.js não chama salvarZona')
  assert.match(editor, /atualizarZona/, 'mapa-editor.js não chama atualizarZona')
})

// ── 7. a camada de dados só grava nas tabelas previstas ──────────────────
// Duas origens de nome de tabela, não uma: até a quick-260818-vxu todas
// apareciam literalmente dentro de .from('...'), e varrer só isso bastava.
// Com CONFIG_POR_MODULO, o .from( recebe uma variável e as cinco tabelas
// de ativo passaram a viver na configuração — uma varredura só de .from(
// continuaria PASSANDO enquanto tivesse ficado cega para a metade que
// mais cresce. As duas origens são lidas juntas, de propósito.
test('mapa-dados.js só fala com as tabelas previstas (maq_areas, cmasm_locais e as cinco tabelas de ativo)', () => {
  const dados = ler(DADOS)
  const literais = [...dados.matchAll(/\.from\(\s*['"]([a-z_]+)['"]/g)].map((m) => m[1])
  const configuradas = [...dados.matchAll(/tabela:\s*['"]([a-z_]+)['"]/g)].map((m) => m[1])
  const tabelas = new Set([...literais, ...configuradas])
  assert.ok(tabelas.has('maq_areas'), 'mapa-dados.js não referencia maq_areas — a escrita de zona deveria estar aqui (D-03)')
  assert.ok(tabelas.has('cmasm_locais'), 'mapa-dados.js não referencia cmasm_locais — as duas camadas de posição passam por aqui')
  assert.ok(
    configuradas.length >= 5,
    `esperadas ao menos as cinco tabelas de ativo em CONFIG_POR_MODULO, encontradas ${configuradas.length}`
  )
  const permitidas = new Set([
    'maq_areas',
    'cmasm_locais',
    'maq_ativos',
    'elet_ativos',
    'transp_ativos',
    'fono_ativos',
    'equipamentos',
  ])
  for (const tabela of tabelas) {
    assert.ok(permitidas.has(tabela), `mapa-dados.js referencia tabela inesperada: ${tabela}`)
  }
})

// ── 8. painel sem cor escrita à mão na marcação do módulo ────────────────
// Mesma propriedade que tests/tema-superficies.test.js já afirma para os
// seis módulos (D-01 da Fase 6) — reafirmada aqui, sobre a alteração
// deste plano especificamente, porque foi este plano que acrescentou
// marcação nova a mapa/index.html (o painel do editor).
test('mapa/index.html continua sem declarar token de cor além de --accent, mesmo depois do painel do editor entrar na marcação (D-01 da Fase 6, reafirmado)', () => {
  const html = ler(INDEX_HTML)
  assert.doesNotMatch(
    html,
    /--(bg|surface|surface2|border|text2|text3|green|yellow|red|blue|orange):/,
    'mapa/index.html declarou token de cor próprio, fora de --accent'
  )
  assert.doesNotMatch(html, /\[data-theme="claro"\]/, 'mapa/index.html criou bloco de tema próprio')
})
