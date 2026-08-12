const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do plano 10-05: a origem do que o mapa exibe passa a ser o banco.
//
// Divisão de responsabilidade com tests/mapa-decisoes.test.js (plano
// 10-02), para os dois arquivos não disputarem os mesmos alvos:
//   - AQUI ficam as afirmações POSITIVAS sobre grama e elétrica — elas
//     leem do banco, não reimplementam o núcleo puro, montam o link pela
//     função pura, e nenhum arquivo fora de mapa/mapa-dados.js fala com o
//     Supabase dentro de mapa/.
//   - LÁ ficam as afirmações NEGATIVAS sobre aguada (D-01, continua mock)
//     e sobre estimativa por zona (D-04, maq_operacoes/horas_utilizadas/
//     area_executada_m2 ausentes de mapa/*.js).
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const MAPA = path.join(RAIZ, 'mapa')
const GRAMA = path.join(MAPA, 'xmap-layers-grama.js')
const ELETRICA = path.join(MAPA, 'xmap-layers-eletrica.js')
const DADOS = path.join(MAPA, 'mapa-dados.js')
const INDEX_HTML = path.join(MAPA, 'index.html')

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

// varredura dinâmica do diretório do módulo — não lista fixa — para que
// qualquer arquivo novo criado pelos planos 10-06/10-07 entre no gate de
// porta única automaticamente, mesmo espírito de tests/mapa-decisoes.test.js
function arquivosJsDeMapa() {
  return fs
    .readdirSync(MAPA)
    .filter((nome) => nome.endsWith('.js'))
    .map((nome) => path.join(MAPA, nome))
}

// ── 1. as duas camadas importam a camada de dados ───────────────────────
test('xmap-layers-grama.js e xmap-layers-eletrica.js importam mapa-dados.js — a camada de dados, não o Supabase direto', () => {
  for (const arquivo of [GRAMA, ELETRICA]) {
    const conteudo = ler(arquivo)
    assert.match(
      conteudo,
      /from\s+['"]\.\/mapa-dados\.js['"]/,
      `${path.basename(arquivo)} deveria importar de ./mapa-dados.js`
    )
  }
})

// ── 2. registro pelo boot, não mais sozinhas ao carregar ────────────────
test('xmap-layers-grama.js e xmap-layers-eletrica.js exportam a função de registro esperada e não tentam se registrar sozinhas em intervalo', () => {
  const grama = ler(GRAMA)
  const eletrica = ler(ELETRICA)
  assert.match(grama, /export\s+async\s+function\s+registrarCamadasGrama/, 'registrarCamadasGrama ausente ou não exportada')
  assert.match(eletrica, /export\s+async\s+function\s+registrarCamadasEletrica/, 'registrarCamadasEletrica ausente ou não exportada')
  for (const [nome, conteudo] of [['grama', grama], ['eletrica', eletrica]]) {
    assert.doesNotMatch(conteudo, /tryRegister/, `${nome}: sobrou a rotina de nova tentativa (tryRegister) do registro automático antigo`)
    assert.doesNotMatch(conteudo, /setTimeout/, `${nome}: sobrou setTimeout — o registro deveria vir só do boot chamando a função exportada`)
  }
})

// ── 3. nenhuma lista de dados fixos sobrou ───────────────────────────────
// A asserção é sobre a FORMA da declaração (const MAIUSCULA = [ ...) — não
// sobre a palavra "mock", que pode aparecer legitimamente num comentário
// explicando que os dados de demonstração saíram (e aparece: os
// cabeçalhos dos dois arquivos citam MOCK_AREAS/MOCK_MAQUINAS e
// GERADORES/TRANSFORMADORES/QUADROS/RAMAIS por nome, em prosa).
test('nenhuma das duas camadas declara lista de dados fixos (const MAIUSCULA = array) — só a camada de dados fala com o banco, aqui deveria sobrar só configuração (TIPOS_ELETRICOS, mapas de cor/ícone)', () => {
  const declaracaoDeArray = /^\s*const\s+[A-Z][A-Z0-9_]*\s*=\s*\[/m
  for (const arquivo of [GRAMA, ELETRICA]) {
    const conteudo = ler(arquivo)
    assert.doesNotMatch(
      conteudo,
      declaracaoDeArray,
      `${path.basename(arquivo)} ainda declara uma constante maiúscula como array — parece lista de dados fixos sobrevivente`
    )
  }
})

// ── 4. contrato de registro do componente preservado ─────────────────────
test('as duas camadas continuam chamando xMap.registerLayer com o nome de módulo certo', () => {
  const grama = ler(GRAMA)
  const eletrica = ler(ELETRICA)
  assert.match(grama, /xMap\.registerLayer\(\s*['"]grama['"]/, 'grama não chama xMap.registerLayer("grama", ...)')
  assert.match(eletrica, /xMap\.registerLayer\(\s*['"]eletrica['"]/, 'eletrica não chama xMap.registerLayer("eletrica", ...)')
})

// ── 5. link vem da função pura, nunca escrito à mão ───────────────────────
test('as duas camadas usam linkDoModulo do núcleo puro e não montam a rota do módulo de origem à mão', () => {
  for (const arquivo of [GRAMA, ELETRICA]) {
    const conteudo = ler(arquivo)
    assert.match(conteudo, /linkDoModulo/, `${path.basename(arquivo)} não usa linkDoModulo`)
    assert.doesNotMatch(
      conteudo,
      /\/maquinas\?ativo=|\/eletrica\?ativo=/,
      `${path.basename(arquivo)} monta a rota de destino escrita à mão — deveria vir só de linkDoModulo`
    )
  }
})

// ── 6. compatibilidade de máquina vem do núcleo puro ──────────────────────
test('xmap-layers-grama.js usa maquinasParaZona do núcleo puro para as máquinas compatíveis da zona', () => {
  const conteudo = ler(GRAMA)
  assert.match(conteudo, /maquinasParaZona/, 'grama não usa maquinasParaZona')
})

// ── 7. porta única para o banco dentro de mapa/ ───────────────────────────
test('mapa/mapa-dados.js é o único arquivo de mapa/ que fala com o banco (.from)', () => {
  const comConsulta = arquivosJsDeMapa().filter((arquivo) => /\.from\(/.test(ler(arquivo)))
  assert.deepEqual(
    comConsulta.map((c) => path.basename(c)),
    ['mapa-dados.js'],
    `arquivos de mapa/ falando com o banco fora de mapa-dados.js: ${comConsulta.map((c) => path.basename(c)).join(', ') || 'nenhum'}`
  )
})

// ── 8. marcação: as duas camadas convertidas saem da etiqueta clássica,
// aguada continua, selo de demonstração só nela ────────────────────────
test('mapa/index.html não carrega mais grama/eletrica por etiqueta de script clássica, continua carregando aguada, e o selo de demonstração aparece uma única vez', () => {
  const conteudo = ler(INDEX_HTML)
  assert.doesNotMatch(
    conteudo,
    /<script[^>]*src="[^"]*xmap-layers-grama\.js"/,
    'index.html ainda carrega xmap-layers-grama.js por <script src=...> — deveria vir só de import no módulo'
  )
  assert.doesNotMatch(
    conteudo,
    /<script[^>]*src="[^"]*xmap-layers-eletrica\.js"/,
    'index.html ainda carrega xmap-layers-eletrica.js por <script src=...> — deveria vir só de import no módulo'
  )
  assert.match(
    conteudo,
    /<script[^>]*src="[^"]*xmap-layers-aguada\.js"/,
    'index.html deixou de carregar xmap-layers-aguada.js — a aguada continua script clássico (D-01)'
  )
  const selos = conteudo.match(/class="mod-badge-demo"/g) || []
  assert.equal(selos.length, 1, `esperado 1 selo de demonstração nos botões de módulo, encontrado ${selos.length}`)
})
