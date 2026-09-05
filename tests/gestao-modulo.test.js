const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate permanente do módulo /gestao (Fase 13, Onda B, plano 13-06).
//
// O que ele protege, e por quê:
//
// (1) A SONDA `GES_OK`. O módulo é publicado ANTES de a migração 60 rodar
//     (a ordem de sempre: frontend primeiro, SQL depois). Enquanto a
//     migração não existe, o banco não tem `ges_acoes` — e sem a sonda o
//     erro de relação inexistente derrubaria a carga inteira, inclusive a
//     do Calendário consolidado, que não depende dela para nada. Os dois
//     casos abaixo exercem a sonda pelos dois lados: com erro de relação
//     e com resposta boa.
//
// (2) A FRONTEIRA DE ESCRITA (D-13-03, D-19, PLAT-15). O /gestao lê
//     `maq_*`, `transp_*`, `logs_manutencao`, `pred_*` e `cal_*`, e grava
//     só nas cinco `ges_*`, que são suas. Refrigeração é módulo congelado:
//     lida, nunca editada. Um `insert`/`update` sobre tabela de outro
//     módulo aqui reprova.
//
// (3) O ESCAPE. 5W2H, causas do Ishikawa, POP e rótulo de indicador são
//     texto livre do usuário e voltam para a marcação. O caso abaixo
//     manda marcação pelo banco e exige que ela saia escapada.
//
// O gate lê SÓ `gestao/index.html`, `gestao/app.js`, `vercel.json` e o
// portal — nenhum arquivo produzido por outro plano da mesma onda.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const ler = relativo => fs.readFileSync(path.join(RAIZ, relativo), 'utf8')

const HTML = ler('gestao/index.html')
const APP = ler('gestao/app.js')

const modulo = import('../gestao/app.js')

// Remove linha de comentário antes de afirmar ausência: o comentário que
// explica POR QUE algo não pode aparecer costuma citar a própria coisa
// proibida. Mesma técnica de tests/chrome-icones.test.js.
function semComentarios(conteudo) {
  return conteudo.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
}

/** Cliente falso: `resposta(tabela)` decide o que cada tabela devolve. O
 *  encadeamento imita o do SDK (select/eq/order/limit) e é aguardável em
 *  qualquer ponto, que é como o módulo o usa. */
function supaFalso(resposta) {
  const alvo = tabela => {
    const encadeavel = {
      select: () => encadeavel,
      eq: () => encadeavel,
      order: () => encadeavel,
      limit: () => Promise.resolve(resposta(tabela)),
      then: (ok, err) => Promise.resolve(resposta(tabela)).then(ok, err),
    }
    return encadeavel
  }
  return { from: alvo }
}

const SEM_MIGRACAO = supaFalso(tabela => tabela.startsWith('ges_')
  ? { data: null, error: { message: `relation "public.${tabela}" does not exist` } }
  : { data: [], error: null })

const COM_MIGRACAO = supaFalso(() => ({ data: [], error: null }))

// ── 1. a sonda GES_OK ───────────────────────────────────────────────────
test('sem a migração 60 a sonda fica falsa, a carga não lança e a aba Ações diz o que houve', async () => {
  const { __teste } = await modulo
  __teste.definirSupa(SEM_MIGRACAO)
  await assert.doesNotReject(() => __teste.carregarTudo())
  assert.equal(__teste.estado().GES_OK, false, 'a sonda deveria ficar falsa com a relação inexistente')
  assert.match(__teste.htmlAcoes(), /Migração 60 não aplicada/)
  assert.match(__teste.htmlAcoes(), /As tabelas ges_\* ainda não existem neste banco/)
})

test('com a migração 60 a sonda fica verdadeira', async () => {
  const { __teste } = await modulo
  __teste.definirSupa(COM_MIGRACAO)
  assert.equal(await __teste.sondarGestao(), true)
  assert.equal(__teste.estado().GES_OK, true)
})

test('a sonda faz UMA leitura só, sobre uma tabela só, dentro de bloco de captura', () => {
  assert.equal((APP.match(/from\('ges_acoes'\)\.select\('id'\)\.limit\(1\)/g) || []).length, 1,
    'a sonda precisa ser uma leitura só — duas consultas para a mesma pergunta é o que a lição de EST_OK/UNI_OK proíbe')
  const corpo = APP.slice(APP.indexOf('async function sondarGestao'), APP.indexOf('async function lerFonte'))
  assert.match(corpo, /try \{/, 'sem bloco de captura, uma falha de rede vira exceção não tratada no boot')
  assert.match(corpo, /GES_OK = !error/)
  assert.match(APP, /^let GES_OK = false$/m, 'a sonda nasce falsa: quem rodar antes dela cai no ramo honesto')
})

test('a sonda é chamada ANTES e FORA do Promise.all da carga', () => {
  // Sem tirar os comentários primeiro, este caso mediria a própria prosa: o
  // comentário que explica a ordem cita "Promise.all" antes da chamada da
  // sonda, e o gate reprovaria um arquivo correto.
  const limpo = semComentarios(APP)
  const carga = limpo.slice(limpo.indexOf('async function carregarTudo'), limpo.indexOf('async function carregarGestao'))
  const posSonda = carga.indexOf('await sondarGestao()')
  const posPromise = carga.indexOf('Promise.all')
  assert.ok(posSonda > 0, 'carregarTudo precisa chamar a sonda')
  assert.ok(posPromise > posSonda,
    'a sonda tem de resolver antes do Promise.all — é ela que decide se as leituras de ges_* entram nele')
})

test('sem a sonda verde, nenhuma consulta a ges_* é disparada', async () => {
  const { __teste } = await modulo
  const consultadas = []
  __teste.definirSupa(supaFalso(tabela => {
    consultadas.push(tabela)
    return tabela.startsWith('ges_')
      ? { data: null, error: { message: 'relation does not exist' } }
      : { data: [], error: null }
  }))
  await __teste.carregarTudo()
  const deGestao = consultadas.filter(t => t.startsWith('ges_'))
  assert.deepStrictEqual(deGestao, ['ges_acoes'],
    'só a sonda pode tocar em ges_* quando a migração 60 não existe — as demais leituras ficariam de fora do Promise.all')
})

// ── 2. os estados da ação são a lista fechada da migração 60 ────────────
test('a lista fechada de estados da ação no cliente tem exatamente os cinco nomes do banco', async () => {
  const { __teste } = await modulo
  assert.deepStrictEqual(__teste.ESTADOS_ACAO,
    ['planejada', 'em_execucao', 'verificacao', 'concluida', 'cancelada'])
})

test('as seis categorias do Ishikawa são as mesmas do check de ges_causas', async () => {
  const { __teste } = await modulo
  assert.deepStrictEqual(__teste.CATEGORIAS_6M.map(c => c.id),
    ['metodo', 'maquina', 'mao_de_obra', 'material', 'medicao', 'meio_ambiente'])
})

// ── 3. fronteira de escrita ─────────────────────────────────────────────
test('nenhuma tabela de outro módulo aparece seguida de gravação — refrigeração é lida, nunca editada', () => {
  const alheias = ['logs_manutencao', 'equipamentos', 'maq_os', 'maq_operacoes', 'maq_ativos',
    'transp_ativos', 'transp_viagens', 'transp_manutencoes', 'pred_inspecoes', 'pred_inspecao_itens',
    'cal_ps', 'cal_equipamentos', 'usuarios']
  const limpo = semComentarios(APP)
  for (const tabela of alheias) {
    const escritas = new RegExp(`from\\('${tabela}'\\)[^\\n]*\\.(insert|update|upsert|delete)`, 'g')
    assert.equal((limpo.match(escritas) || []).length, 0,
      `gestao/app.js grava em ${tabela}, que é de outro módulo — o /gestao lê, nunca escreve fora de ges_*`)
  }
  assert.match(limpo, /from\('logs_manutencao'\)[^\n]*\.select\(/,
    'o calendário consolidado precisa continuar LENDO logs_manutencao (D-13-03/D-15)')
})

test('nenhum arquivo de refrigeracao/ é carregado pelo módulo (PLAT-15)', () => {
  assert.ok(!/refrigeracao\//.test(HTML), 'gestao/index.html referencia refrigeracao/')
  assert.ok(!/refrigeracao\//.test(APP), 'gestao/app.js referencia refrigeracao/ — a palavra só pode aparecer como valor de módulo')
})

// ── 4. escape de tudo que vem do banco ──────────────────────────────────
test('texto vindo do banco sai escapado nas quatro abas que o desenham', async () => {
  const { __teste } = await modulo
  const marcacao = '<img src=x onerror=alert(1)>'
  const dados = {
    ges_acoes: [{ id: 1, o_que: marcacao, quem: marcacao, modulo: 'geral', status: 'planejada', g: 6, u: 6, t: 6, gut_total: 216, criado_em: '2026-09-01T10:00:00Z', quando: '2026-09-30' }],
    ges_indicadores: [{ id: 1, codigo: 'proprio', rotulo: marcacao, unidade: 'un', meta: 5, sentido: 'maior', ativo: true }],
    ges_indicador_valores: [{ id: 1, indicador_id: 1, periodo: '2026-08-01', valor: 4 }],
    ges_pop: [{ id: 1, titulo: marcacao, modulo: 'geral', ativo_ref: null, plano_ref: null, criado_em: '2026-09-01T10:00:00Z' }],
    ges_causas: [{ id: 1, acao_id: 1, categoria: 'metodo', causa: marcacao }],
    logs_manutencao: [{ id: 'r1', equip_id: 1, tipo: 'PREVENTIVA', status: 'ABERTA', descricao: marcacao, data_os: '2026-09-10' }],
  }
  __teste.definirSupa(supaFalso(t => ({ data: dados[t] || [], error: null })))
  __teste.definirUsuario({ role: 'gestor', nome: 'Gestor' })
  await __teste.carregarTudo()

  for (const [aba, html] of Object.entries({
    Painel: __teste.htmlPainel(),
    Ações: __teste.htmlAcoes(),
    Calendário: __teste.htmlCalendarioMes(),
    Ferramentas: __teste.htmlFerramentas(),
    POP: __teste.htmlPop(),
  })) {
    assert.ok(!html.includes(marcacao), `${aba} deixou marcação crua vinda do banco entrar no HTML`)
  }
  assert.match(__teste.htmlPop(), /&lt;img/, 'o POP deveria mostrar o texto escapado, não sumir com ele')
})

test('o módulo declara a própria função de escape e a usa', () => {
  assert.match(APP, /const esc = valor => String\(valor \?\? ''\)\.replace\(/,
    'sem função de escape declarada, todo texto de usuário entraria cru na marcação')
  assert.ok((APP.match(/\besc\(/g) || []).length > 40, 'o escape existe mas quase não é usado')
})

// ── 5. nenhuma cor escrita em JavaScript ────────────────────────────────
test('nenhuma cor literal aparece no JavaScript do módulo — tom vem sempre de classe', () => {
  const semComentario = APP.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
  const cores = semComentario.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsl\(/g) || []
  assert.deepStrictEqual(cores, [],
    'cor em JavaScript é mais uma cópia da paleta para alguém esquecer de atualizar')
})

test('o módulo não declara token de cor além da cor de destaque, nem bloco de tema próprio', () => {
  assert.doesNotMatch(HTML, /--(bg|surface|surface2|border|text2|text3|green|yellow|red|blue|orange):/,
    'gestao/index.html declarou token de cor próprio, fora de --accent')
  assert.doesNotMatch(HTML, /\[data-theme="claro"\]/, 'o módulo criou bloco de tema próprio')
  assert.match(HTML, /--accent:/, 'o módulo precisa declarar a própria cor de destaque, como os outros seis')
})

// ── 6. o chrome comum ───────────────────────────────────────────────────
test('o script de pré-desenho do tema é idêntico ao das outras superfícies', () => {
  const linhaDe = arquivo => ler(arquivo).split('\n').find(l => l.includes('pmoc-tema'))
  const referencia = linhaDe('maquinas/index.html')
  assert.ok(referencia, 'a superfície de referência perdeu o script de pré-desenho')
  assert.equal(linhaDe('gestao/index.html'), referencia,
    'a cópia do script anti-FOUC divergiu — o defeito real não é escrevê-lo errado uma vez, é corrigir uma cópia e esquecer as outras')
  const linhas = HTML.split('\n')
  assert.ok(linhas.findIndex(l => l.includes('pmoc-tema')) < linhas.findIndex(l => l.includes('</head>')),
    'o script precisa rodar antes do primeiro desenho, dentro do cabeçalho')
})

test('o módulo usa o shell e o Auth compartilhados, e não declara login próprio', () => {
  assert.match(APP, /import \{ aplicarShell \} from '\.\.\/shared\/shell\.js'/)
  assert.match(APP, /import \{ Auth \} from '\.\.\/shared\/auth\.js'/)
  assert.match(APP, /import \{ criarClienteSupabase \} from '\.\.\/shared\/supabase-config\.js'/)
  // Também sobre o código sem comentário: a nota que explica por que o cargo
  // Livre continua anônimo cita signInWithPassword pelo nome.
  assert.ok(!/signInWithPassword/.test(semComentarios(APP)),
    'o módulo escreveu a própria tela de login em vez de usar o Auth comum')
  assert.match(APP, /el\('login-screen'\)\.innerHTML/,
    'a falha de boot precisa ir para a tela de login, que está visível — o #app nasce escondido')
})

test('as cinco abas têm os rótulos do contrato e um ícone distinto do conjunto comum, nunca emoji', async () => {
  const { existeIcone } = await import('../shared/icones.js')
  const bloco = APP.match(/navItems: \[([\s\S]*?)\n {4}\]/)
  assert.ok(bloco, 'navItems não encontrada em gestao/app.js')
  const abas = [...bloco[1].matchAll(/id: '([^']+)', label: '([^']+)', icone: '([^']+)'/g)]
  assert.deepStrictEqual(abas.map(a => a[1]), ['painel', 'acoes', 'calendario', 'ferramentas', 'pop'])
  assert.deepStrictEqual(abas.map(a => a[2]), ['Painel', 'Ações', 'Calendário', 'Ferramentas', 'POP'])
  const icones = abas.map(a => a[3])
  for (const nome of icones) assert.ok(existeIcone(nome), `a aba usa o ícone "${nome}", que não existe no conjunto`)
  assert.equal(new Set(icones).size, icones.length,
    'duas abas da mesma faixa com o mesmo desenho devolvem a faixa ao estado em que só o texto informa')
  assert.doesNotMatch(bloco[1], /[\u{1F300}-\u{1FAFF}☀-➿]/u, 'sobrou emoji na declaração das abas')
})

test('as cinco views existem na marcação, e o miolo não é inserido depois do shell', () => {
  for (const view of ['painel', 'acoes', 'calendario', 'ferramentas', 'pop']) {
    assert.match(HTML, new RegExp(`id="view-${view}"`), `falta a view da aba ${view}`)
  }
  const depoisDoShell = APP.slice(APP.indexOf('aplicarShell('))
  assert.ok(!/el\('app'\)\.insertAdjacentHTML\('beforeend'/.test(depoisDoShell),
    'inserir miolo no fim do #app depois de aplicarShell o faz cair abaixo do rodapé — foi o defeito de /equipes')
  assert.ok(!/el\('app'\)\.style\.display = 'flex'/.test(APP),
    'o #app aberto como flex sem direção sai com o shell inteiro lado a lado — o outro defeito de /equipes')
})

// ── 7. os nove núcleos da Onda A são importados, nunca copiados ─────────
test('os nove núcleos compartilhados são importados uma vez cada', () => {
  for (const nucleo of ['grafico', 'indicadores', 'gantt', 'abc', 'gut', 'kanban', 'calendario', 'tabela', 'fluxo']) {
    assert.equal((APP.match(new RegExp(`from '\\.\\./shared/${nucleo}\\.js'`, 'g')) || []).length, 1,
      `shared/${nucleo}.js deveria ser importado exatamente uma vez`)
  }
})

// ── 8. leitura do decimal digitado ──────────────────────────────────────
// Medido no navegador, gravando com um cliente falso que registra a carga:
// "1.234,56" digitado no campo "Quanto" chegava ao banco como null, sem uma
// palavra na tela. `null` é indistinguível de "não informado" — é a mesma
// classe de defeito que a travessia numérica de /maquinas, /refrigeracao e
// /calibracao já pagou três vezes.
test('o decimal do 5W2H é lido em português, e o que não é número é recusado com motivo', async () => {
  const { __teste } = await modulo
  const { lerDecimal } = __teste
  assert.deepStrictEqual(lerDecimal(''), { valor: null }, 'campo em branco é ausência de valor, não zero')
  assert.deepStrictEqual(lerDecimal('   '), { valor: null })
  assert.deepStrictEqual(lerDecimal('1234'), { valor: 1234 })
  assert.deepStrictEqual(lerDecimal('1234,56'), { valor: 1234.56 })
  assert.deepStrictEqual(lerDecimal('1.234,56'), { valor: 1234.56 }, 'ponto de milhar com vírgula decimal é a forma brasileira')
  assert.ok(lerDecimal('1.234').erro, '"1.234" é ambíguo e tem de ser recusado, nunca adivinhado')
  assert.ok(lerDecimal('abc').erro)
  assert.ok(lerDecimal('-5').erro)
  for (const entrada of ['1.234', 'abc', '-5']) {
    assert.equal(lerDecimal(entrada).valor, undefined,
      `"${entrada}" devolveu um valor além do motivo — recusa que também grava é pior que recusa nenhuma`)
  }
})

// ── 9. rota e portal ────────────────────────────────────────────────────
test('a rota /gestao existe no vercel.json e resolve para um arquivo que existe no disco', () => {
  const vercel = JSON.parse(ler('vercel.json'))
  const rota = vercel.rewrites.find(r => r.source === '/gestao')
  assert.ok(rota, 'sem a reescrita, /gestao devolve 404 em produção mesmo com o arquivo no repositório')
  assert.equal(rota.destination, '/gestao/index.html')
  assert.ok(fs.existsSync(path.join(RAIZ, rota.destination.slice(1))),
    'a rota aponta para um arquivo que não existe')
  assert.equal(vercel.rewrites.length, new Set(vercel.rewrites.map(r => r.source)).size,
    'duas reescritas para a mesma origem: a segunda nunca seria alcançada')
})

test('o portal ganhou um card para /gestao, sem mexer nos que já existiam', () => {
  const portal = ler('index.html')
  const destinos = [...portal.matchAll(/<a class="card" href="([^"]+)"/g)].map(m => m[1])
  assert.equal(destinos.filter(d => d === '/gestao').length, 1,
    'o portal precisa de exatamente um card apontando para /gestao')
  assert.deepStrictEqual(destinos, ['/refrigeracao', '/maquinas', '/transportes', '/eletrica',
    '/fonoclama', '/predial', '/mapa', '/equipes', '/gestao', '/calibracao'],
    'a lista de cards do portal mudou além do acréscimo de /gestao')
  const cartao = portal.slice(portal.indexOf('href="/gestao"'), portal.indexOf('href="/calibracao"'))
  for (const classe of ['ico', 'nm', 'ds', 'tags']) {
    assert.match(cartao, new RegExp(`class="${classe}"`), `o card novo não segue o formato dos outros (falta .${classe})`)
  }
  assert.doesNotMatch(cartao, /style="/, 'o card novo introduziu estilo próprio em vez de reusar a classe .card')
})

test('nenhuma lógica dos núcleos foi copiada para dentro do módulo', () => {
  for (const assinatura of ['export function classificarAbc', 'export function gutTotal', 'export function agruparKanban',
    'export function gradeMes', 'export function linhasGantt', 'export function limitesControle', 'export function avaliar']) {
    assert.ok(!APP.includes(assinatura),
      `${assinatura} foi reimplementada no módulo — o ponto da Onda A é existir uma vez só`)
  }
  assert.ok(!/GUT_ESCALA = \[/.test(APP), 'a escala GUT foi copiada em vez de importada de shared/gut.js')
})
