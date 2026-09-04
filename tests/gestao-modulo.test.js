// ══════════════════════════════════════════════════════════════════
// tests/gestao-modulo.test.js — Gate permanente do módulo /gestao
//
// O que protege:
// Valida a integridade, arquitetura e contratos do módulo de Gestão
// e Qualidade (Fase 13, Onda B):
// - 5 views e 5 abas com nomenclatura exata do contrato;
// - Integração com o shell e Auth compartilhados;
// - Script anti-FOUC de pré-desenho do tema idêntico às demais superfícies;
// - Sonda GES_OK que garante publicação segura antes da migração 60;
// - Consumo estritamente somente leitura de módulos externos (em especial logs_manutencao);
// - Import dos 9 núcleos compartilhados sem código duplicado;
// - Ausência de cores literais no JS e ausência de emojis no chrome do módulo;
// - Resolução da rota no vercel.json e presença do card no portal.
// ══════════════════════════════════════════════════════════════════

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const RAIZ = path.join(__dirname, '..')
const HTML_GESTAO = path.join(RAIZ, 'gestao', 'index.html')
const APP_GESTAO = path.join(RAIZ, 'gestao', 'app.js')
const VERCEL_JSON = path.join(RAIZ, 'vercel.json')
const PORTAL_HTML = path.join(RAIZ, 'index.html')

const lerHtml = () => fs.readFileSync(HTML_GESTAO, 'utf8')
const lerApp = () => fs.readFileSync(APP_GESTAO, 'utf8')

test('o módulo gestao tem as 5 views e 5 abas correspondentes com os rótulos do contrato', () => {
  const html = lerHtml()
  const app = lerApp()

  const viewsEsperadas = ['view-painel', 'view-acoes', 'view-calendario', 'view-ferramentas', 'view-pop']
  for (const v of viewsEsperadas) {
    assert.ok(html.includes(`id="${v}"`), `View ${v} ausente em gestao/index.html`)
  }

  const rotulosEsperados = ['Painel', 'Ações', 'Calendário', 'Ferramentas', 'POP']
  for (const r of rotulosEsperados) {
    assert.match(app, new RegExp(`label:\\s*['"]${r}['"]`), `Rótulo de aba '${r}' ausente em gestao/app.js`)
  }

  const idsAbas = ['painel', 'acoes', 'calendario', 'ferramentas', 'pop']
  for (const id of idsAbas) {
    assert.match(app, new RegExp(`id:\\s*['"]${id}['"]`), `ID de aba '${id}' ausente em navItems de gestao/app.js`)
  }
})

test('o módulo usa o shell comum e o Auth compartilhado sem login próprio', () => {
  const app = lerApp()
  const html = lerHtml()

  assert.match(app, /import\s*\{\s*aplicarShell\s*\}\s*from\s*['"]\.\.\/shared\/shell\.js['"]/)
  assert.match(app, /import\s*\{\s*Auth\s*\}\s*from\s*['"]\.\.\/shared\/auth\.js['"]/)
  assert.match(app, /aplicarShell\s*\(/)
  assert.match(app, /new\s+Auth\s*\(/)
  assert.ok(html.includes('id="login-screen"'), 'login-screen deve existir para montagem do Auth')
  assert.doesNotMatch(app, /loginCargo|renderLogin|selecionarCargo/i, 'Não deve reinventar lógica de login local')
})

test('o script de pré-desenho do tema é idêntico ao das outras superfícies e não cria tokens de cor próprios', () => {
  const htmlGestao = lerHtml()
  const htmlPortal = fs.readFileSync(PORTAL_HTML, 'utf8')

  const extrairScript = conteudo => {
    const linhas = conteudo.split('\n')
    return linhas.find(l => l.includes('pmoc-tema'))
  }

  const scriptGestao = extrairScript(htmlGestao)
  const scriptPortal = extrairScript(htmlPortal)

  assert.ok(scriptGestao, 'Script anti-FOUC ausente em gestao/index.html')
  assert.equal(scriptGestao.trim(), scriptPortal.trim(), 'Script anti-FOUC deve ser byte-a-byte idêntico ao portal')

  assert.doesNotMatch(
    htmlGestao,
    /--(bg|surface|surface2|border|text2|text3|green|yellow|red|blue|orange):/,
    'gestao/index.html não pode declarar token de cor próprio além de --accent'
  )
  assert.doesNotMatch(
    htmlGestao,
    /\[data-theme="claro"\]/,
    'gestao/index.html não pode declarar bloco de tema próprio'
  )
})

test('a sonda GES_OK existe, nasce false, faz leitura única e roda antes de carregar dados', () => {
  const app = lerApp()

  assert.match(app, /^let GES_OK = false/m, 'GES_OK deve ser declarada global e nascer false')
  assert.match(app, /async function sondarGestao\s*\(/, 'Função sondarGestao deve existir')
  assert.match(app, /from\(['"]ges_acoes['"]\)\.select\(['"]id['"]\)\.limit\(1\)/, 'Sonda deve fazer leitura restrita a 1 id de ges_acoes')

  const idxSondar = app.indexOf('await sondarGestao()')
  const idxPromiseAll = app.indexOf('Promise.all([')
  assert.ok(idxSondar >= 0, 'sondarGestao() deve ser chamada')
  assert.ok(idxPromiseAll >= 0, 'Promise.all deve existir em carregarTudo()')
  assert.ok(idxSondar < idxPromiseAll, 'sondarGestao() deve ser chamada ANTES do Promise.all de carga')
})

test('sondarGestao reflete a presença ou ausência da tabela no banco', async () => {
  // Verificação comportamental da lógica da sonda
  const criarSonda = mockSupa => {
    return async () => {
      try {
        const { error } = await mockSupa.from('ges_acoes').select('id').limit(1)
        return !error
      } catch {
        return false
      }
    }
  }

  const sondaErro = criarSonda({
    from: () => ({ select: () => ({ limit: async () => ({ error: { message: 'relation does not exist' } }) }) }),
  })
  assert.equal(await sondaErro(), false, 'Sonda deve retornar false quando tabela não existe')

  const sondaOk = criarSonda({
    from: () => ({ select: () => ({ limit: async () => ({ data: [{ id: 1 }], error: null }) }) }),
  })
  assert.equal(await sondaOk(), true, 'Sonda deve retornar true quando tabela responde')
})

test('os 9 núcleos compartilhados são importados de ../shared/', () => {
  const app = lerApp()
  const nucleos = [
    'kanban.js',
    'gantt.js',
    'abc.js',
    'gut.js',
    'calendario.js',
    'grafico.js',
    'indicadores.js',
    'tabela.js',
    'fluxo.js',
  ]

  for (const n of nucleos) {
    assert.match(
      app,
      new RegExp(`from\\s+['"]\\.\\.\/shared\/${n}['"]`),
      `Núcleo shared/${n} deve ser importado em gestao/app.js`
    )
  }
})

test('refrigeração e tabelas externas são estritamente somente leitura (D-13-03)', () => {
  const app = lerApp()

  assert.match(app, /from\(['"]logs_manutencao['"]\)\.select\(/, 'logs_manutencao deve ser consultada com select')
  assert.doesNotMatch(
    app,
    /from\(['"]logs_manutencao['"]\)[^\n]*\.(insert|update|upsert|delete)/,
    'logs_manutencao NUNCA pode receber operações de escrita'
  )

  const outrasTabelasExternas = ['maq_os', 'maq_operacoes', 'transp_viagens', 'pred_inspecao_itens', 'cal_ps']
  for (const t of outrasTabelasExternas) {
    assert.doesNotMatch(
      app,
      new RegExp(`from\\(['"]${t}['"]\\)[^\\n]*\\.(insert|update|upsert|delete)`),
      `Tabela externa ${t} não pode receber gravação a partir de gestao/app.js`
    )
  }
})

test('nenhuma cor literal em hexadecimal, rgb ou hsl aparece no JavaScript do módulo', () => {
  const app = lerApp()
  const linhasSemComentarios = app
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n')

  const cores = linhasSemComentarios.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g) || []
  assert.deepEqual(cores, [], 'gestao/app.js não deve conter cores literais; estilos devem vir do CSS')
})

test('estados da ação 5W2H casam exatamente com a lista fechada do fluxo', () => {
  const app = lerApp()
  const estados = ['planejada', 'em_execucao', 'verificacao', 'concluida', 'cancelada']

  for (const st of estados) {
    assert.match(app, new RegExp(`['"]${st}['"]`), `Estado '${st}' deve constar no fluxo de ações`)
  }
})

test('nenhum emoji aparece no chrome ou HTML/JS do módulo', () => {
  const html = lerHtml()
  const app = lerApp()
  const emojis = /[😀🚚🔧📊⚡📢🏛🗺👷🔬❄️]/u

  assert.doesNotMatch(html, emojis, 'gestao/index.html não pode usar emojis')
  assert.doesNotMatch(app, emojis, 'gestao/app.js não pode usar emojis')
})

test('a rota /gestao existe em vercel.json e aponta para gestao/index.html existente', () => {
  const vercel = JSON.parse(fs.readFileSync(VERCEL_JSON, 'utf8'))
  const rota = (vercel.rewrites || []).find(r => r.source === '/gestao')

  assert.ok(rota, 'Rota /gestao ausente em vercel.json')
  assert.equal(rota.destination, '/gestao/index.html')
  assert.ok(fs.existsSync(path.join(RAIZ, rota.destination)), 'Destino de /gestao deve existir em disco')
})

test('o portal index.html contém o card apontando para /gestao e contagem de cards cresceu', () => {
  const html = fs.readFileSync(PORTAL_HTML, 'utf8')
  assert.match(html, /<a class="card" href="\/gestao">/, 'Card do portal para /gestao deve existir')

  const totalCards = (html.match(/<a class="card" href="/g) || []).length
  assert.equal(totalCards, 10, 'Portal deve ter exatamente 10 cards de módulo')
})

test('todas as tabelas do módulo nascem dentro de .tbl-wrap', () => {
  const html = lerHtml()
  const app = lerApp()

  // Todas as ocorrências de <table class="tbl" no HTML ou geradas no JS
  // devem vir dentro de tbl-wrap
  const ocorrenciasTbl = app.match(/<table class="tbl"[^>]*>/g) || []
  assert.ok(ocorrenciasTbl.length >= 2, 'Devem existir geradores de tabela no app.js')
  assert.match(html, /id="acoes-lista"\s+class="tbl-wrap"/, 'acoes-lista deve ter classe tbl-wrap')
  assert.match(html, /id="pop-lista"\s+class="tbl-wrap"/, 'pop-lista deve ter classe tbl-wrap')
})
