const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate permanente da Fase 7 (UI/UX mobile), no padrão que a Fase 6
// (tests/tema-superficies.test.js) e a Fase 10 (tests/mapa-decisoes.test.js)
// estabeleceram: decisão travada vira teste, porque comentário não falha
// sozinho quando uma fase futura o contraria.
//
// O que este arquivo prova é o que dá para provar lendo texto: medida, tamanho
// de fonte e onde a tabela está. O que ele NÃO prova — se a página rola na
// horizontal em 375 px de verdade — é decisão consciente (D-03 da fase: o repo
// é zero-build, sem npm e sem navegador headless) e está coberto pelo roteiro
// manual em TESTES.md.
const RAIZ = path.join(__dirname, '..')
const FOLHA = path.join(RAIZ, 'shared', 'pmoc.css')

// os 6 módulos da base unificada — refrigeracao fica de fora por decisão
// (PLAT-15: congelada, nem lida para modificação)
// `equipes` entrou em 02/09/2026: ele ficou fora desta lista quando o módulo
// nasceu, e foi o único que quebrou o shell — abrindo o #app como flex-row e
// inserindo o miolo depois do rodapé. Ausência de um módulo numa lista de
// gate é a forma mais barata de um defeito passar.
const MODULOS = ['maquinas', 'transportes', 'eletrica', 'fonoclama', 'predial', 'reparos', 'mapa', 'equipes', 'gestao']

// Renderizadores dos 4 módulos no escopo da fase. maquinas e transportes não
// entram aqui: o critério de sucesso 5 pede que eles não regridam, não que
// sejam reformados por esta fase.
const RENDERIZADORES_NO_ESCOPO = [
  path.join(RAIZ, 'shared', 'modulo-manutencao.js'),
  path.join(RAIZ, 'predial', 'app.js'),
  path.join(RAIZ, 'eletrica', 'app.js'),
  path.join(RAIZ, 'fonoclama', 'app.js'),
  path.join(RAIZ, 'mapa', 'app.js'),
]

function ler(arquivo) {
  return fs.readFileSync(arquivo, 'utf8')
}

// ── D-05: campo de formulário a 16px em tela estreita ──────────────────────
// Abaixo de 16px o navegador do iOS aplica zoom automático ao focar o campo, e
// o critério de sucesso 3 ("preencher e salvar sem zoom") se perde por um
// detalhe de plataforma, não por erro de layout.
test('campos de formulário sobem para 16px numa faixa estreita de @media', () => {
  const css = ler(FOLHA)
  const faixas = [...css.matchAll(/@media\(max-width:(\d+)px\)\{((?:[^{}]|\{[^{}]*\})*)\}/g)]
  const estreitas = faixas.filter(([, largura]) => Number(largura) <= 480)

  assert.ok(
    estreitas.length > 0,
    'shared/pmoc.css precisa de uma faixa @media de no máximo 480px — é onde as regras de celular da Fase 7 vivem',
  )

  const temRegra = estreitas.some(([, , corpo]) =>
    /input\s*,\s*select\s*,\s*textarea\s*\{[^}]*font-size:\s*16px/.test(corpo),
  )
  assert.ok(
    temRegra,
    'D-05 da Fase 7: input, select e textarea precisam de font-size:16px em tela estreita, senão o iOS dá zoom no foco',
  )
})

// A tela de login monta os campos com estilo embutido, que vence a folha comum
// por especificidade — a regra de @media não a alcança. Se este caso cair, o
// usuário leva zoom do iOS logo no login, antes de ver módulo algum.
test('os campos da tela de login também estão em 16px', () => {
  const auth = ler(path.join(RAIZ, 'shared', 'auth.js'))

  for (const campo of auth.matchAll(/<input[^>]*style="([^"]*)"/g)) {
    const tamanho = campo[1].match(/font-size:\s*(\d+)px/)
    if (!tamanho) continue
    assert.ok(
      Number(tamanho[1]) >= 16,
      `shared/auth.js: campo de login em ${tamanho[1]}px. ` +
      'D-05 da Fase 7 — abaixo de 16px o iOS dá zoom ao focar, e o estilo embutido não é alcançado por shared/pmoc.css.',
    )
  }
})

// ── critério de sucesso 1: nada mais largo que a tela ──────────────────────
// Largura absoluta acima de 375px no chrome empurra a página na horizontal. As
// exceções abaixo são limites (max-width) ou medidas já contidas por min(),
// não larguras impostas.
test('nenhuma largura absoluta acima de 375px escapa de min() ou de uma @media', () => {
  const arquivos = [FOLHA, ...MODULOS.map(m => path.join(RAIZ, m, 'index.html'))]

  for (const arquivo of arquivos) {
    const texto = ler(arquivo)
    const relativo = path.relative(RAIZ, arquivo)

    for (const achado of texto.matchAll(/(?<!max-|min-)width:\s*(\d+)px/g)) {
      const largura = Number(achado[1])
      if (largura <= 375) continue

      // min(300px,90vw) e afins: a medida está contida pela largura da tela
      const antes = texto.slice(Math.max(0, achado.index - 40), achado.index)
      if (/min\(\s*$/.test(antes)) continue

      assert.fail(
        `${relativo}: width:${largura}px é maior que a tela alvo de 375px e não está contido por min(). ` +
        'Fase 7, critério de sucesso 1 — use min(<n>px,<n>vw) ou max-width.',
      )
    }
  }
})

// ── D-02: tabela larga rola dentro do contêiner, não empurra a página ──────
test('toda tabela dos módulos no escopo nasce dentro de .tbl-wrap', () => {
  const alvos = [
    ...RENDERIZADORES_NO_ESCOPO,
    ...MODULOS.map(m => path.join(RAIZ, m, 'index.html')),
  ].filter(fs.existsSync)

  for (const arquivo of alvos) {
    const texto = ler(arquivo)
    const relativo = path.relative(RAIZ, arquivo)

    for (const achado of texto.matchAll(/<table class="tbl"/g)) {
      const antes = texto.slice(Math.max(0, achado.index - 200), achado.index)
      assert.ok(
        antes.includes('tbl-wrap'),
        `${relativo}: <table class="tbl"> sem .tbl-wrap por perto. ` +
        'D-02 da Fase 7 — tabela larga rola dentro do próprio contêiner, senão empurra a página.',
      )
    }
  }
})

// ── D-01: a navegação continua no topo ────────────────────────────────────
// A alternativa (barra fixa inferior) foi avaliada e descartada: a faixa de
// abas fica onde está e o alcance do polegar é resolvido por área de toque.
test('a faixa de abas não vira barra fixa inferior', () => {
  const css = ler(FOLHA)
  // Todas as regras `.nav{...}`, não só a primeira: a folha declara `.nav` fora
  // e dentro da faixa de celular, e olhar só a de fora deixaria a segunda livre
  // para virar barra fixa sem o gate perceber.
  const regrasNav = [...css.matchAll(/\.nav\{([^}]*)\}/g)]
  assert.ok(regrasNav.length > 0, 'shared/pmoc.css precisa continuar declarando .nav')

  for (const [, corpo] of regrasNav) {
    assert.ok(
      !/position:\s*fixed/.test(corpo),
      'D-01 da Fase 7: a faixa de abas permanece no topo, rolando na horizontal — não vira barra fixa',
    )
  }

  const shell = ler(path.join(RAIZ, 'shared', 'shell.js'))
  assert.ok(
    shell.includes('<div class="nav">'),
    'D-01 da Fase 7: o shell comum continua emitindo a faixa de abas no topo',
  )
})

test('a faixa de abas tem alvo de toque de ao menos 44px em tela estreita', () => {
  const css = ler(FOLHA)
  const faixas = [...css.matchAll(/@media\(max-width:(\d+)px\)\{((?:[^{}]|\{[^{}]*\})*)\}/g)]
    .filter(([, largura]) => Number(largura) <= 480)

  // 44px é o alvo de toque mínimo de fato usável com o polegar. Medido no
  // navegador, padding sozinho dava 41px — daí o min-height explícito, que é o
  // que este caso exige.
  const temAlvo = faixas.some(([, , corpo]) => {
    const regra = corpo.match(/\.nav-btn\{([^}]*)\}/)
    if (!regra) return false
    const altura = regra[1].match(/min-height:\s*(\d+)px/)
    return altura && Number(altura[1]) >= 44
  })

  assert.ok(
    temAlvo,
    'Fase 7, critério de sucesso 4: .nav-btn precisa de área de toque de ao menos 44px em tela estreita',
  )
})

// ── critério de sucesso 5: maquinas e transportes não regridem ────────────
test('maquinas mantém a própria @media', () => {
  const html = ler(path.join(RAIZ, 'maquinas', 'index.html'))
  assert.match(
    html,
    /@media\(max-width:\d+px\)\{[\s\S]*kanban[\s\S]*?\}/,
    'Fase 7, critério de sucesso 5: a @media própria de maquinas (kanban e calendário) não pode ser removida — ' +
    'a folha comum não conhece esses dois componentes até a Fase 8',
  )
})

// ── PLAT-15: refrigeracao congelada ───────────────────────────────────────
test('nenhum arquivo tocado pela Fase 7 referencia refrigeracao/', () => {
  // Os três arquivos que a Fase 7 de fato alterou — shared/auth.js inclusive,
  // que subiu os campos do login para 16px e ficou de fora desta lista na
  // primeira versão do gate.
  const tocados = [
    FOLHA,
    path.join(RAIZ, 'shared', 'auth.js'),
    path.join(RAIZ, 'mapa', 'index.html'),
  ]
  for (const arquivo of tocados) {
    const texto = ler(arquivo)
    const relativo = path.relative(RAIZ, arquivo)
    assert.ok(
      !/refrigeracao/.test(texto),
      `${relativo}: PLAT-15 — refrigeracao está congelada e não pode ser referenciada`,
    )
  }
})

// ── D-01 da Fase 6: o skin do Leaflet segue fechado ───────────────────────
test('mapa/xmap.css não ganhou regra de responsividade', () => {
  const css = ler(path.join(RAIZ, 'mapa', 'xmap.css'))
  assert.ok(
    !/@media/.test(css),
    'D-01 da Fase 6: mapa/xmap.css é o skin do Leaflet, com sistema de tokens próprio, e fica fora do escopo da Fase 7',
  )
})
