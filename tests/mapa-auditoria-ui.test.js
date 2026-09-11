const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate da auditoria de UI do /mapa (11/09/2026). Sete defeitos medidos no
// navegador com o dado real, depois da PR #70 (OS aberta no marcador,
// vencimento da zona): distintivo "8" do Apoio por baixo dos vizinhos,
// barra de basemap tapando a legenda, título do balão atrás dos controles
// flutuantes, chaves do balão a 2,9:1, foco de teclado invisível no
// marcador, marcador sem nome acessível e área com três casas decimais.
//
// O que este arquivo PROVA: o marcador por comportamento (Leaflet falso,
// importando o módulo compartilhado de verdade), o contraste por conta
// sobre os tokens do componente, e a presença das regras que corrigem o
// resto. O que NÃO prova: a sobreposição na tela — isso só o navegador
// mede; roteiro manual em TESTES.md § "Auditoria de UI do mapa".

const RAIZ = path.join(__dirname, '..')
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8')

// Leaflet e xMap falsos: só o que desenharAtivosAgrupados toca.
function leafletFalso() {
  const criados = []
  globalThis.L = {
    divIcon: (o) => o,
    marker: (latlng, opcoes) => {
      const m = { latlng, opcoes, bindPopup() { return m }, bindTooltip(t) { m.rotulo = t; return m } }
      criados.push(m)
      return m
    },
  }
  globalThis.xMap = { utils: { popupHTML: () => '' } }
  return { addLayer() {}, criados }
}

test('marcador com OS aberta sobe na pilha; sem OS fica na ordem do Leaflet', async () => {
  const { desenharAtivosAgrupados } = await import('../mapa/xmap-marcadores.js')
  const grupo = leafletFalso()
  desenharAtivosAgrupados(grupo, [
    { id: 1, lat: -22.8, lon: -43.1, estado: 'inoperante', osAbertas: 5, rotulo: 'A', localPosicao: 'APOIO' },
    { id: 2, lat: -22.8, lon: -43.1, estado: 'operante', osAbertas: 3, rotulo: 'B', localPosicao: 'APOIO' },
    { id: 3, lat: -22.9, lon: -43.2, estado: 'operante', osAbertas: 0, rotulo: 'C' },
  ], { modulo: 'maquinas', emoji: 'M', nome: 'Máquinas', svgDeUm: () => '<svg/>', popupDeUm: () => '' })
  const [comOS, semOS] = grupo.criados
  assert.ok(comOS.opcoes.zIndexOffset > 0, 'o grupo com OS aberta ficou na ordem por latitude, por baixo dos vizinhos')
  assert.equal(semOS.opcoes.zIndexOffset, 0)
})

test('marcador tem nome acessível, e o do grupo diz quantas OS há', async () => {
  const { desenharAtivosAgrupados } = await import('../mapa/xmap-marcadores.js')
  const grupo = leafletFalso()
  desenharAtivosAgrupados(grupo, [
    { id: 1, lat: -22.8, lon: -43.1, estado: 'inoperante', osAbertas: 5, rotulo: 'A', localPosicao: 'APOIO' },
    { id: 2, lat: -22.8, lon: -43.1, estado: 'operante', osAbertas: 3, rotulo: 'B', localPosicao: 'APOIO' },
    { id: 3, lat: -22.9, lon: -43.2, estado: 'operante', osAbertas: 0, rotulo: 'C' },
  ], { modulo: 'maquinas', emoji: 'M', nome: 'Máquinas', svgDeUm: () => '<svg/>', popupDeUm: () => '' })
  const [comOS, semOS] = grupo.criados
  assert.equal(comOS.opcoes.title, 'APOIO (2) · 8 OS aberta(s)')
  assert.equal(semOS.opcoes.title, 'C', 'marcador sem title é um role="button" mudo para o leitor de tela')
  assert.equal(semOS.rotulo, semOS.opcoes.title, 'rótulo e nome acessível divergiram')
})

// Luminância relativa (WCAG 2.x) de "#rrggbb" ou "r,g,b".
function luminancia(cor) {
  const rgb = cor.startsWith('#') ? [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16)) : cor.split(',').map(Number)
  const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('chave e subtítulo do balão passam de 4,5:1 sobre o fundo do balão', () => {
  const css = ler('mapa/xmap.css')
  const html = ler('mapa/index.html')
  const token = (nome) => new RegExp(`--xm-${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(css)[1]
  const fundo = /\.leaflet-popup-content-wrapper\s*\{[^}]*background:\s*rgba\((\d+,\s*\d+,\s*\d+)/.exec(css)[1].replace(/\s/g, '')
  const regra = /\.xmap-popup-key,\.xmap-popup-sub\{color:var\(--xm-([a-z0-9]+)\)\}/.exec(html)
  assert.ok(regra, 'mapa/index.html deveria sobrescrever a cor da chave e do subtítulo do balão')
  const razao = contraste(token(regra[1]), fundo)
  assert.ok(razao >= 4.5, `chave do balão a ${razao.toFixed(2)}:1`)
  assert.ok(contraste(token('text3'), fundo) < 4.5, 'o token antigo passou a atender — rever se a regra ainda é necessária')
})

test('barra de basemap e escala saem de cima da barra lateral aberta', () => {
  const html = ler('mapa/index.html')
  assert.match(html, /\.body-layout:has\(\.sidebar\.aberta\) \.xmap-toolbar\{left:/)
  assert.match(html, /\.body-layout:has\(\.sidebar\.aberta\) \.leaflet-bottom\.leaflet-left\{left:/)
  const estreita = /@media \(max-width:480px\)\{([^{]+)\{display:none\}\}/.exec(html)
  assert.ok(estreita, 'em tela estreita a barra aberta deveria tirar de cena o que não cabe ao lado dela')
  assert.match(estreita[1], /\.body-layout:has\(\.sidebar\.aberta\) \.xmap-toolbar/)
  // Sem esta, em 375px #btn-modulos deslizado cai embaixo de #btn-camadas
  // e a barra lateral fica sem o botão que a fecha.
  assert.match(estreita[1], /\.body-layout:has\(\.sidebar\.aberta\) #btn-camadas/)
})

test('foco de teclado visível no marcador', () => {
  assert.match(ler('mapa/index.html'), /\.leaflet-marker-icon:focus-visible\{outline:2px solid/)
})

test('balão abre abaixo da faixa dos controles flutuantes', () => {
  const m = /L\.Popup\.mergeOptions\(\{ autoPanPaddingTopLeft: \[\d+, (\d+)\] \}\)/.exec(ler('mapa/app.js'))
  assert.ok(m, 'mapa/app.js deveria dar margem de topo aos balões')
  // Controles em top:10px com 33px de altura (medido) terminam em 43px.
  assert.ok(Number(m[1]) >= 44, `margem de ${m[1]}px deixa o título do balão atrás dos controles`)
})

test('área da zona sem casa decimal no balão', () => {
  assert.match(ler('mapa/xmap-layers-grama.js'), /\['Área',\s*Math\.round\(area\.area_m2 \|\| 0\)\.toLocaleString\('pt-BR'\)/)
})
