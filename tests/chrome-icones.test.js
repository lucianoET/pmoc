const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate do quick-260819-5jf — chrome padronizado.
//
// O que trava aqui tem uma causa concreta: ícone em CARACTERE depende da
// fonte que o sistema tem. O `☰` do mapa apareceu como bloco preto na
// máquina do usuário, e emoji de aba muda de desenho e de paleta em cada
// sistema — o que impede qualquer padronização e faz o ícone ignorar o
// tema. Daí o conjunto único em SVG com `currentColor`.
//
// A ordem da barra superior e o lugar do tema também são travados: são a
// padronização pedida, e uma regressão nelas é silenciosa (a tela continua
// funcionando, só deixa de ser padrão).
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const SHELL = path.join(RAIZ, 'shared', 'shell.js')
const TEMA = path.join(RAIZ, 'shared', 'tema.js')
const APP_MAQ = path.join(RAIZ, 'maquinas', 'app.js')
const HTML_MAQ = path.join(RAIZ, 'maquinas', 'index.html')
const PORTAL = path.join(RAIZ, 'index.html')

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

// Remove comentário de linha antes de afirmar ausência: o comentário que
// explica POR QUE o caractere saiu cita o caractere, e proibir a palavra
// proibiria a explicação. Mesma técnica de tests/mapa-editor.test.js.
function semComentarios(conteudo) {
  return conteudo
    .split('\n')
    .map((linha) => linha.replace(/\/\/.*$/, ''))
    .join('\n')
}

// Emoji e símbolos que o chrome usava antes desta tarefa. A faixa não
// pretende cobrir todo o Unicode — cobre exatamente o que estava em uso.
const GLIFOS_ANTIGOS = /[☰▤☀🌙📊🔧📋▦📦⛽📈🛒❄️🚚📢🗺️]/

// ── 1. o conjunto de ícones ─────────────────────────────────────────────
test('icone() devolve SVG monocromático que herda a cor do texto', async () => {
  const { icone } = await import('../shared/icones.js')
  const svg = icone('portal')
  assert.match(svg, /^<svg /)
  assert.match(svg, /stroke="currentColor"/, 'sem currentColor o ícone não responde a tema nem a estado')
  assert.match(svg, /viewBox="0 0 24 24"/)
  assert.match(svg, /aria-hidden="true"/, 'o ícone acompanha rótulo de texto — anunciá-lo seria ruído')
  assert.doesNotMatch(svg, /fill="#|stroke="#/, 'cor escrita à mão no ícone briga com o tema')
})

test('nome desconhecido devolve vazio em vez de lançar', async () => {
  const { icone, existeIcone } = await import('../shared/icones.js')
  assert.equal(icone('nao-existe'), '')
  assert.equal(icone(null), '')
  assert.equal(icone('__proto__'), '', 'chave herdada de Object não pode virar ícone')
  assert.equal(existeIcone('constructor'), false)
})

test('todo ícone declarado nas abas de Máquinas existe no conjunto', async () => {
  const { existeIcone } = await import('../shared/icones.js')
  const bloco = ler(APP_MAQ).match(/navItems: \[([\s\S]*?)\n {4}\]/)
  assert.ok(bloco, 'navItems de maquinas/app.js não encontrada')
  const nomes = [...bloco[1].matchAll(/icone: '([^']+)'/g)].map((m) => m[1])
  assert.ok(nomes.length >= 9, `esperava as abas de Máquinas, achei ${nomes.length}`)
  for (const nome of nomes) {
    assert.ok(existeIcone(nome), `aba usa ícone "${nome}", que não existe no conjunto — sairia sem desenho`)
  }
})

// ── 2. nenhum caractere de ícone sobrou no chrome ───────────────────────
test('o chrome comum não usa mais caractere como ícone', () => {
  for (const arquivo of [SHELL, TEMA]) {
    const conteudo = semComentarios(ler(arquivo))
    assert.doesNotMatch(conteudo, GLIFOS_ANTIGOS, `${path.basename(arquivo)} ainda usa caractere como ícone`)
  }
  assert.match(ler(TEMA), /icone\(vaiParaClaro \? 'claro' : 'escuro'\)/, 'o botão de tema deveria desenhar pelo conjunto comum')
})

test('as abas de Máquinas usam nome de ícone, não emoji', () => {
  const bloco = ler(APP_MAQ).match(/navItems: \[([\s\S]*?)\n {4}\]/)[1]
  assert.doesNotMatch(bloco, GLIFOS_ANTIGOS, 'sobrou emoji na declaração das abas')
})

// ── 3. abas OS-Manutenção e OS-Corte ────────────────────────────────────
test('OS virou OS-Manutenção e OS-Corte entrou logo depois, com view própria', () => {
  const app = ler(APP_MAQ)
  const bloco = app.match(/navItems: \[([\s\S]*?)\n {4}\]/)[1]
  const posOS = bloco.indexOf("id: 'os'")
  const posCorte = bloco.indexOf("id: 'corte'")
  assert.ok(posOS >= 0 && posCorte > posOS, 'OS-Corte deveria vir imediatamente depois de OS-Manutenção')
  assert.match(bloco, /id: 'os', icone: 'os', label: 'OS-Manutenção'/)
  assert.match(bloco, /id: 'corte', icone: 'corte', label: 'OS-Corte'/)
  assert.match(ler(HTML_MAQ), /id="view-corte"/, 'falta a view da aba nova')
})

test('operações e áreas saíram da aba de OS e estão na de corte, com o vocabulário novo', () => {
  const html = ler(HTML_MAQ)
  const viewOS = html.slice(html.indexOf('id="view-os"'), html.indexOf('id="view-corte"'))
  for (const marca of ['operacoes-kanban', 'tb-areas', 'operacoes-kpis']) {
    assert.ok(!viewOS.includes(marca), `${marca} continua na aba de OS-Manutenção`)
  }
  const viewCorte = html.slice(html.indexOf('id="view-corte"'), html.indexOf('id="view-agenda"'))
  for (const marca of ['operacoes-kanban', 'tb-areas', 'th-areas', 'operacoes-kpis']) {
    assert.ok(viewCorte.includes(marca), `${marca} deveria estar na aba OS-Corte`)
  }
  assert.match(viewCorte, /Ordem de Serviço de Corte/)
  assert.match(viewCorte, /Áreas Vegetais/)
  assert.ok(!viewCorte.includes('Operações de serviço'), 'o título antigo sobrou')
  assert.ok(!viewCorte.includes('Áreas de serviço'), 'o título antigo sobrou')
})

// ── 4. portal segue a mesma padronização ────────────────────────────────
test('no portal o tema também desceu para o rodapé, com a marca da empresa', () => {
  const portal = ler(PORTAL)
  const cabecalho = portal.slice(portal.indexOf('<div class="hd">'), portal.indexOf('<div class="main">'))
  assert.ok(!cabecalho.includes('btn-tema'), 'o tema não pode continuar no cabeçalho do portal')
  const rodape = portal.slice(portal.indexOf('<div class="ft">'))
  assert.match(rodape, /id="btn-tema"/)
  assert.match(rodape, /luctronics\.com\.br/)
  assert.match(rodape, /rel="noopener noreferrer"/)
  assert.match(portal, /from '\.\/shared\/icones\.js'/, 'o portal deveria usar o conjunto comum de ícones')
})
