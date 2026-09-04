const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// tests/estilos-gestao-compartilhados.test.js — gate permanente da
// folha comum para os componentes da Fase 13 (plano 13-04, D-10).
//
// Este arquivo é o contrato entre o que os núcleos escrevem em
// `class="..."` (shared/grafico.js, shared/indicadores.js,
// shared/gantt.js, shared/abc.js, shared/kanban.js,
// shared/calendario.js) e o que shared/pmoc.css sabe desenhar — uma
// classe emitida sem regra correspondente é um componente invisível,
// que nenhum teste de comportamento pega (os gates de núcleo, como
// tests/grafico-compartilhado.test.js, provam a string HTML/SVG
// devolvida, não a cor que ela ganha na tela).
//
// Lê **apenas** shared/pmoc.css — nenhum arquivo de outro plano. A
// lista fechada abaixo é a fonte da verdade: um componente futuro que
// emitir classe nova sem entrar aqui primeiro falha este gate, não o
// contrário.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const FOLHA = path.join(RAIZ, 'shared', 'pmoc.css')

function ler(arquivo) {
  return fs.readFileSync(arquivo, 'utf8')
}

// Escapa caracteres especiais de regex e verifica que a classe aparece
// como seletor de verdade (não como prefixo de outra classe — .kanban
// não pode "achar" .kanban-col só por compartilhar as 7 primeiras
// letras). O limite é qualquer caractere que não continua um nome de
// classe CSS (letra, dígito, hífen, sublinhado).
function temSeletor(css, classe) {
  const escapado = classe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\.${escapado}(?![a-zA-Z0-9_-])`)
  return re.test(css)
}

// ── lista fechada — migradas de maquinas/index.html (D-06/D-07) ──
const CLASSES_MIGRADAS = [
  'kanban', 'kanban-col', 'kanban-title', 'kanban-count',
  'op-card', 'op-card:last-child', 'op-name', 'op-meta', 'op-actions',
  'calendar-head', 'calendar-title', 'calendar-grid',
  'calendar-weekday', 'calendar-day', 'calendar-day.is-empty',
  'calendar-date', 'calendar-event', 'calendar-event.op', 'calendar-event.os',
]

// ── lista fechada — novas (grafico/indicadores/gantt/abc + hoje) ──
const CLASSES_NOVAS = [
  'calendar-day.hoje',
  'grafico', 'grafico-barra', 'grafico-linha', 'grafico-acumulado',
  'grafico-ponto', 'grafico-media', 'grafico-limite', 'grafico-eixo',
  'grafico-rotulo', 'grafico-vazio', 'grafico-sparkline',
  'grafico-tom-neutro', 'grafico-tom-info', 'grafico-tom-ok',
  'grafico-tom-warn', 'grafico-tom-erro', 'grafico-tom-accent',
  'indicador', 'indicador-meta', 'indicador-tendencia', 'indicador-spark',
  'indicador-vazio', 'indicador-tom-neutro', 'indicador-tom-info',
  'indicador-tom-ok', 'indicador-tom-warn', 'indicador-tom-erro',
  'gantt', 'gantt-rotulos', 'gantt-rotulo', 'gantt-linhas', 'gantt-linha',
  'gantt-barra', 'gantt-aberto', 'gantt-hoje', 'gantt-hoje-rotulo',
  'gantt-tom-neutro', 'gantt-tom-info', 'gantt-tom-ok', 'gantt-tom-warn',
  'gantt-tom-erro',
  'abc', 'abc-linha', 'abc-barra', 'abc-classe-a', 'abc-classe-b', 'abc-classe-c',
]

const TODAS_AS_CLASSES = CLASSES_MIGRADAS.concat(CLASSES_NOVAS)

// Tokens de cor que já existiam em :root antes desta fase — a única
// prova possível de "nenhum token novo" num teste que nasce depois da
// mudança é comparar contra uma lista travada, não contra um "antes"
// que o teste não tem como reconstituir sozinho.
const TOKENS_ESPERADOS = [
  '--bg', '--surface', '--surface2', '--border',
  '--text', '--text2', '--text3',
  '--green', '--yellow', '--red', '--blue',
  '--accent', '--accent-texto', '--orange', '--ff',
]

test('toda classe emitida pelos núcleos da Onda A (kanban, calendário, gráfico, indicador, Gantt, curva ABC) tem regra em shared/pmoc.css', () => {
  const css = ler(FOLHA)
  for (const classe of TODAS_AS_CLASSES) {
    assert.ok(temSeletor(css, classe), `shared/pmoc.css não declara regra para .${classe}`)
  }
})

test('as classes migradas de maquinas/index.html chegam com pelo menos 19 seletores distintos — nenhuma das 20 regras-base se perdeu na extração', () => {
  const css = ler(FOLHA)
  const encontradas = CLASSES_MIGRADAS.filter((classe) => temSeletor(css, classe))
  assert.equal(encontradas.length, CLASSES_MIGRADAS.length)
})

test('nenhuma regra nova (bloco kanban/calendário/gráfico/indicador/Gantt/ABC) usa cor literal — hexadecimal, rgb(), hsl() ou nome de cor do navegador', () => {
  const css = ler(FOLHA)
  const inicio = css.indexOf('/* ── kanban e calendário')
  assert.ok(inicio >= 0, 'marcador de início do bloco novo não encontrado em shared/pmoc.css')
  const fim = css.indexOf('/* ── rodapé do shell comum ── */')
  assert.ok(fim > inicio, 'marcador de fim do bloco novo (rodapé do shell) não encontrado')
  const bloco = css.slice(inicio, fim)

  assert.doesNotMatch(bloco, /#[0-9a-fA-F]{3,8}\b/, 'bloco novo usa cor hexadecimal literal')
  assert.doesNotMatch(bloco, /\brgb\(/, 'bloco novo usa rgb() literal')
  assert.doesNotMatch(bloco, /\brgba\(/, 'bloco novo usa rgba() literal')
  assert.doesNotMatch(bloco, /\bhsl\(/, 'bloco novo usa hsl() literal')
  // nomes de cor do navegador que apareceriam soltos como valor de
  // propriedade — o projeto não usa nenhum, então qualquer ocorrência é
  // uma cor nova escapando da folha de tokens
  const NOMES_DE_COR = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'gray', 'grey']
  for (const nome of NOMES_DE_COR) {
    assert.doesNotMatch(
      bloco,
      new RegExp(`:\\s*${nome}\\b`, 'i'),
      `bloco novo usa o nome de cor do navegador '${nome}'`
    )
  }
})

test('os tokens declarados no :root são exatamente os que já existiam — nenhum token de cor novo entrou nesta fase', () => {
  const css = ler(FOLHA)
  const raiz = css.match(/:root\s*\{([^}]*)\}/)
  assert.ok(raiz, ':root não encontrado em shared/pmoc.css')
  const declarados = [...raiz[1].matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1])

  const distintos = new Set(declarados)
  assert.equal(distintos.size, TOKENS_ESPERADOS.length, 'quantidade de tokens em :root mudou')
  for (const token of TOKENS_ESPERADOS) {
    assert.ok(distintos.has(token), `token esperado '${token}' não está mais em :root`)
  }
  for (const token of distintos) {
    assert.ok(TOKENS_ESPERADOS.includes(token), `token novo '${token}' entrou em :root — proibido nesta fase`)
  }
})

test('os seis tons de gráfico existem, com os cinco nomes semânticos do vocabulário fechado mais accent (reservado a Pareto/sparkline)', () => {
  const css = ler(FOLHA)
  for (const tom of ['neutro', 'info', 'ok', 'warn', 'erro', 'accent']) {
    assert.ok(temSeletor(css, `grafico-tom-${tom}`), `falta .grafico-tom-${tom}`)
  }
})

test('os cinco tons de indicador e os cinco de Gantt existem, só com o vocabulário fechado de 5 tons — sem accent (reservado só ao gráfico)', () => {
  const css = ler(FOLHA)
  for (const prefixo of ['indicador-tom-', 'gantt-tom-']) {
    for (const tom of ['neutro', 'info', 'ok', 'warn', 'erro']) {
      assert.ok(temSeletor(css, `${prefixo}${tom}`), `falta .${prefixo}${tom}`)
    }
    assert.ok(!temSeletor(css, `${prefixo}accent`), `.${prefixo}accent não deveria existir — accent é reserva exclusiva do gráfico/Gantt-hoje/ABC-A`)
  }
})

test('nenhum contêiner de Gantt, kanban ou calendário declara recorte de conteúdo (overflow:hidden) — a armadilha que matou o cabeçalho fixo em D-8yc-01', () => {
  const css = ler(FOLHA)
  for (const seletor of ['.gantt', '.gantt-linhas', '.kanban', '.kanban-col', '.calendar-grid']) {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regra = css.match(new RegExp(`${escapado}\\{([^}]*)\\}`))
    if (!regra) continue
    assert.doesNotMatch(
      regra[1],
      /overflow(-x|-y)?\s*:\s*hidden/,
      `${seletor} declara recorte de conteúdo — quem rola tem de ser o contêiner interno, nunca o pai`
    )
  }
})

test('a @media de 480px continua com o alvo de toque de 44px (mínimo já travado pela Fase 7)', () => {
  const css = ler(FOLHA)
  const faixas = [...css.matchAll(/@media\(max-width:(\d+)px\)\{((?:[^{}]|\{[^{}]*\})*)\}/g)]
  const estreitas = faixas.filter(([, largura]) => Number(largura) <= 480)
  assert.ok(estreitas.length > 0, 'shared/pmoc.css precisa de uma faixa @media de no máximo 480px')

  const temAlvo = estreitas.some(([, , corpo]) => {
    const regra = corpo.match(/\.nav-btn\{([^}]*)\}/)
    if (!regra) return false
    const altura = regra[1].match(/min-height:\s*(\d+)px/)
    return altura && Number(altura[1]) >= 44
  })
  assert.ok(temAlvo, '.nav-btn precisa manter min-height >= 44px na @media estreita')
})

test('o gráfico tem 100% de largura e altura fixa de 140px, menor que a altura mínima de uma coluna de kanban (180px)', () => {
  const css = ler(FOLHA)
  const regraGrafico = css.match(/\.grafico\{([^}]*)\}/)
  assert.ok(regraGrafico, '.grafico não encontrado')
  assert.match(regraGrafico[1], /width:\s*100%/)
  assert.match(regraGrafico[1], /height:\s*140px/)

  const regraKanbanCol = css.match(/\.kanban-col\{([^}]*)\}/)
  assert.ok(regraKanbanCol, '.kanban-col não encontrado')
  const minHeightKanban = Number(regraKanbanCol[1].match(/min-height:\s*(\d+)px/)[1])
  assert.ok(140 < minHeightKanban, 'o gráfico (140px) precisa ficar menor que a coluna de kanban (min-height)')
})
