const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do quick-260819-348 — legibilidade do mapa.
//
// O que este arquivo trava foi MEDIDO na tela com dado real, não suposto:
// com os 30 prédios posicionados, o mapa desenhava 195 marcadores em 51
// pontos distintos, a maior pilha com 24 ícones no mesmo pixel, e exibia 12
// rótulos — todos da planta do OSM, nenhum do cadastro. Depois: 56
// marcadores e 66 rótulos.
//
// O agrupamento e a escolha de cor do grupo são regra, e regra se confere
// executando. O resto é estrutural, e cada asserção corresponde a uma
// regressão concreta: uma camada que volte a desenhar marcador a marcador
// devolve a pilha; um rótulo sem corte por zoom devolve o campo de texto
// sobreposto; um fitBounds animado no boot não acontece.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const MAPA = path.join(RAIZ, 'mapa')
const APP = path.join(MAPA, 'app.js')
const INDEX_HTML = path.join(MAPA, 'index.html')
const MARCADORES = path.join(MAPA, 'xmap-marcadores.js')
const CAMADAS_DE_ATIVO = ['xmap-layers-ativos.js', 'xmap-layers-grama.js', 'xmap-layers-eletrica.js']

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

// ── 1. agrupamento por ponto ────────────────────────────────────────────
test('ativos no mesmo ponto viram um grupo, e a ordem de chegada é preservada', async () => {
  const { agruparPorPonto } = await import('../mapa/mapa-geometria.js')
  const grupos = agruparPorPonto([
    { id: 1, lat: -22.8395, lon: -43.1091 },
    { id: 2, lat: -22.8400, lon: -43.1055 },
    { id: 3, lat: -22.8395, lon: -43.1091 },
  ])
  assert.equal(grupos.length, 2)
  assert.deepEqual(grupos[0].ativos.map((a) => a.id), [1, 3])
  assert.deepEqual(grupos[1].ativos.map((a) => a.id), [2])
  assert.equal(grupos[0].lat, -22.8395)
})

test('ativo sem coordenada não entra em grupo nenhum', async () => {
  const { agruparPorPonto } = await import('../mapa/mapa-geometria.js')
  assert.deepEqual(agruparPorPonto([{ id: 1, lat: null, lon: null }]), [])
  assert.deepEqual(agruparPorPonto([{ id: 1, lat: -22.84, lon: null }]), [])
  assert.deepEqual(agruparPorPonto(null), [])
})

test('a chave do grupo é a coordenada exata, não um arredondamento grosseiro', async () => {
  const { agruparPorPonto } = await import('../mapa/mapa-geometria.js')
  // ~11 cm de diferença: pontos distintos, porque a pilha real vem de
  // coordenada IDÊNTICA (herança do mesmo prédio), não de proximidade —
  // agrupar por perto moveria o marcador de lugar, o que num mapa de
  // manutenção é pior do que empilhar.
  const grupos = agruparPorPonto([
    { id: 1, lat: -22.839500, lon: -43.109100 },
    { id: 2, lat: -22.839501, lon: -43.109100 },
  ])
  assert.equal(grupos.length, 2)
})

// ── 2. cor do grupo pelo estado mais grave ──────────────────────────────
test('o grupo assume o estado mais grave — um inoperante entre operantes não desaparece', async () => {
  const { estadoMaisGrave } = await import('../mapa/xmap-marcadores.js')
  assert.equal(estadoMaisGrave([{ estado: 'operante' }, { estado: 'inoperante' }, { estado: 'operante' }]), 'inoperante')
  assert.equal(estadoMaisGrave([{ estado: 'operante' }, { estado: 'manutencao' }]), 'manutencao')
  assert.equal(estadoMaisGrave([{ estado: 'operante' }, { estado: 'standby' }]), 'standby')
  assert.equal(estadoMaisGrave([{ estado: 'operante' }, { estado: 'operante' }]), 'operante')
})

test('estado desconhecido não finge gravidade que não se sabe', async () => {
  const { estadoMaisGrave } = await import('../mapa/xmap-marcadores.js')
  assert.equal(estadoMaisGrave([{ estado: null }, { estado: 'operante' }]), 'operante')
  assert.equal(estadoMaisGrave([{ estado: 'inventado' }]), 'inventado')
  assert.equal(estadoMaisGrave([]), null)
})

// ── 3. uma implementação de agrupamento, não três ───────────────────────
test('as três camadas de ativo desenham pelo módulo compartilhado', () => {
  for (const nome of CAMADAS_DE_ATIVO) {
    const fonte = ler(path.join(MAPA, nome))
    assert.match(fonte, /desenharAtivosAgrupados/, `${nome} não usa o desenho compartilhado`)
    assert.doesNotMatch(fonte, /function\s+grupoSVG\b/, `${nome} redeclarou o ícone de grupo`)
    assert.doesNotMatch(fonte, /function\s+estadoMaisGrave\b/, `${nome} redeclarou a escolha de estado do grupo`)
    // Um L.marker solto por ativo é exatamente a pilha que este trabalho
    // desfez: quem desenha marcador de ativo é o módulo compartilhado.
    assert.doesNotMatch(fonte, /L\.marker\(/, `${nome} voltou a criar marcador por ativo`)
  }
})

test('o balão do grupo lista os ativos e leva à ficha — agrupar não pode custar o acesso', () => {
  const fonte = ler(MARCADORES)
  assert.match(fonte, /linkDoModulo\(modulo, ativo\.id\)/, 'cada linha do grupo deveria levar à ficha do ativo')
  assert.match(fonte, /LIMITE_LISTA_GRUPO/, 'a lista do grupo deveria ter corte')
  assert.match(fonte, /\+\$\{sobrando\} neste ponto/, 'o resto cortado precisa ser anunciado, nunca omitido')
  assert.doesNotMatch(fonte, /\.from\(/, 'nenhuma consulta pode aparecer em arquivo de desenho')
})

// ── 4. rótulos: existem, e só no zoom de detalhe ────────────────────────
test('prédio, zona e ativo ganham rótulo permanente com classe cortada por zoom', () => {
  assert.match(ler(path.join(MAPA, 'xmap-layers-predios.js')), /permanent: true[^}]*xmap-rotulo/s)
  assert.match(ler(path.join(MAPA, 'xmap-layers-grama.js')), /permanent: true,[\s\S]{0,120}xmap-rotulo/)
  assert.match(ler(MARCADORES), /permanent: true/)
  const html = ler(INDEX_HTML)
  assert.match(
    html,
    /\.leaflet-container:not\(\.zoom-detalhe\) \.xmap-rotulo\{display:none\}/,
    'sem o corte por zoom, todos os nomes aparecem ao mesmo tempo e a tela vira texto sobreposto'
  )
  assert.match(ler(APP), /classList\.toggle\('zoom-detalhe'/, 'app.js deveria ligar a classe pelo zoom')
})

// ── 5. barra lateral e painel de camadas ────────────────────────────────
test('a barra lateral é colapsável e só Módulos e Edição nascem abertas', () => {
  const html = ler(INDEX_HTML)
  const secoes = [...html.matchAll(/<details class="sb-sec"([^>]*)>[\s\S]*?<summary[^>]*>([^<]+)</g)].map(
    (m) => ({ abre: /\bopen\b/.test(m[1]), titulo: m[2].trim() })
  )
  assert.ok(secoes.length >= 6, `esperava as seções da barra, achei ${secoes.length}`)
  const abertas = secoes.filter((s) => s.abre).map((s) => s.titulo)
  assert.deepEqual(abertas, ['Módulos', 'Edição'], `abertas por padrão: ${abertas.join(', ')}`)
})

test('o painel de camadas nasce recolhido, tem cabeçalho em português e não cobre o do editor', () => {
  const html = ler(INDEX_HTML)
  const app = ler(APP)
  assert.match(html, /id="btn-camadas"/, 'falta o cabeçalho do painel de camadas')
  assert.match(html, /\.xmap-filters \.xmap-filters-title\{display:none\}/, 'o título em inglês do componente deveria sair de cena')
  assert.match(app, /classList\.add\('camadas-recolhidas'\)/, 'o painel deveria nascer recolhido')
  assert.match(app, /Camadas \(\$\{quantas\}\)/, 'o botão deveria dizer quantas camadas existem')
  // xmap.js e xmap.css continuam intocados — o painel é do componente.
  assert.doesNotMatch(ler(path.join(MAPA, 'xmap.js')), /btn-camadas|camadas-recolhidas|sb-sec/)
})

// ── 6. enquadramento inicial ────────────────────────────────────────────
test('o mapa abre enquadrando o que tem posição, sem animação', () => {
  const app = ler(APP)
  const inicio = app.indexOf('function enquadrarNoQueExiste(')
  assert.notEqual(inicio, -1, 'enquadrarNoQueExiste não encontrada')
  const corpo = app.slice(inicio, app.indexOf('\n}', inicio))
  assert.match(corpo, /fitBounds/)
  assert.match(corpo, /animate: false/, 'a animação do Leaflet roda em requestAnimationFrame e não acontece no boot')
  assert.match(corpo, /maxZoom: 18/, 'sem teto, um único ativo posicionado colaria a câmera nele')
  assert.match(corpo, /POSICIONADOS\.length/, 'sem posição nenhuma não há o que enquadrar')
})
