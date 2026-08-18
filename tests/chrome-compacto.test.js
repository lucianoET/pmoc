const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate do chrome compacto — barra superior, faixa de abas e fila de
// indicadores. Tudo aqui vive em shared/, então vale para os 6 módulos de uma
// vez: mudar uma dessas regras muda seis telas.
const RAIZ = path.join(__dirname, '..')
const FOLHA = fs.readFileSync(path.join(RAIZ, 'shared', 'pmoc.css'), 'utf8')
const SHELL = fs.readFileSync(path.join(RAIZ, 'shared', 'shell.js'), 'utf8')

function regra(seletor) {
  const achado = FOLHA.match(new RegExp(`(?:^|\\n)${seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n?\\}`))
  return achado ? achado[1] : null
}

// ── barra superior em uma linha ───────────────────────────────────────────
test('a barra superior traz os cinco elementos, nesta ordem', () => {
  const bloco = SHELL.match(/const topbar = `([\s\S]*?)`/)
  assert.ok(bloco, 'shared/shell.js deveria montar a barra superior')

  const ordem = ['class="logo"', 'id="user-chip"', 'id="btn-tema"', '${linkPortal}', 'onclick="sair()"']
  let posicao = -1
  for (const marca of ordem) {
    const onde = bloco[1].indexOf(marca)
    assert.ok(onde > posicao,
      `${marca} está fora de ordem na barra superior — a ordem pedida é título, usuário, modo, portal, sair`)
    posicao = onde
  }
})

test('a barra superior nunca quebra em duas linhas', () => {
  const corpo = regra('.topbar')
  assert.ok(corpo, 'shared/pmoc.css deveria continuar declarando .topbar')
  assert.doesNotMatch(corpo, /flex-wrap:\s*wrap/,
    'a barra fica em uma linha só — quem cede espaço é o título, que corta com reticências')
  assert.match(regra('.logo'), /min-width:0/,
    'sem min-width:0 o item flex não encolhe e o corte com reticências nunca acontece')
  assert.match(regra('.logo'), /text-overflow:ellipsis/)

  // nenhuma faixa estreita pode reintroduzir a quebra nem esconder o portal
  for (const [, largura, miolo] of FOLHA.matchAll(/@media\(max-width:(\d+)px\)\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    if (Number(largura) > 480) continue
    assert.doesNotMatch(miolo, /\.topbar\{[^}]*flex-wrap:\s*wrap/,
      'em tela estreita a barra também fica em uma linha')
    assert.doesNotMatch(miolo, /\.topbar-back\{[^}]*display:\s*none/,
      'o link do portal permanece na barra; o que some é só o rótulo, não a seta')
  }
})

test('em tela estreita some o rótulo do portal, não o link', () => {
  assert.match(SHELL, /class="topbar-back-txt"/,
    'o rótulo precisa de elemento próprio para poder sumir sozinho')
  const estreita = [...FOLHA.matchAll(/@media\(max-width:(\d+)px\)\{((?:[^{}]|\{[^{}]*\})*)\}/g)]
    .filter(([, largura]) => Number(largura) <= 480)
  assert.ok(estreita.some(([, , miolo]) => /\.topbar-back-txt\{display:none\}/.test(miolo)),
    'abaixo de 480px fica só a seta do portal — é o que cabe em 375px')
})

// ── faixa de abas ─────────────────────────────────────────────────────────
test('as abas têm cara de botão', () => {
  const corpo = regra('.nav-btn')
  assert.ok(corpo, 'shared/pmoc.css deveria continuar declarando .nav-btn')
  assert.match(corpo, /background:var\(--surface2\)/)
  assert.match(corpo, /border:1px solid var\(--border\)/)
  assert.match(corpo, /border-radius:7px/)
})

test('a rolagem das abas é anunciada por sombra, sem setas e sem JavaScript', () => {
  const corpo = regra('.nav')
  assert.ok(corpo)
  assert.match(corpo, /background-attachment:local, local, scroll, scroll/,
    'é este par local/scroll que faz a sombra sumir quando a rolagem chega ao fim')
  assert.match(corpo, /overflow-x:auto/)

  // decisão do usuário: nada de setas < > nas pontas
  assert.doesNotMatch(SHELL, /nav-seta|nav-arrow|rolarAbas/,
    'a rolagem se anuncia por sombra — seta é mais um alvo para o polegar errar e come largura em 375px')
})

// ── indicadores ───────────────────────────────────────────────────────────
test('os indicadores ficam em uma linha só, rolando quando não cabem', () => {
  const corpo = regra('.kpi-row')
  assert.ok(corpo, 'shared/pmoc.css deveria continuar declarando .kpi-row')
  assert.match(corpo, /grid-auto-flow:column/,
    'fluxo em coluna é o que mantém a fila única — o auto-fit antigo envolvia para a linha de baixo')
  assert.match(corpo, /overflow-x:auto/)
  assert.doesNotMatch(corpo, /grid-template-columns:repeat\(auto-fit/)

  // e nenhuma faixa estreita pode empilhar de volta
  for (const [, largura, miolo] of FOLHA.matchAll(/@media\(max-width:(\d+)px\)\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    if (Number(largura) > 480) continue
    assert.doesNotMatch(miolo, /\.kpi-row\{[^}]*grid-template-columns:\s*1fr/,
      'em celular os indicadores continuam em fila única, rolando — não empilhados')
  }
})

test('o cartão de indicador encolheu', () => {
  assert.match(regra('.kpi'), /padding:11px 13px/)
  assert.match(regra('.kpi-n'), /font-size:1\.45rem/,
    'era 1.8rem — o cartão ocupava meia tela antes do conteúdo começar')
})
