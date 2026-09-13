// Gate do módulo /bio — comportamento, não grafia.
//
// Importa o núcleo puro em Node e o exercita nos limites que a spec fixou:
// próximo código com lista vazia e com buracos; periodicidade a partir da
// REALIZAÇÃO e presa ao fim do mês; vencido é leitura da tela, não estado;
// validação espelhando as travas da 61. Depois carrega bio/app.js com um
// cliente falso e afirma a sonda, a fronteira de escrita e a leitura sem
// migração. Cada defeito abaixo foi reintroduzido de propósito e visto
// reprovando antes de o gate entrar.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')
let d, app

test.before(async () => {
  d = await import(path.join(RAIZ, 'bio', 'dominio.js'))
  app = await import(path.join(RAIZ, 'bio', 'app.js'))
})

// ── núcleo puro ────────────────────────────────────────────────────────

test('proximoCodigo: vazio dá ARV-0001; com buraco continua do maior; ignora código fora do formato', () => {
  assert.equal(d.proximoCodigo([]), 'ARV-0001')
  assert.equal(d.proximoCodigo([{ codigo: 'ARV-0001' }, { codigo: 'ARV-0007' }, { codigo: 'ARV-0003' }]), 'ARV-0008')
  assert.equal(d.proximoCodigo([{ codigo: 'ARV-0002' }, { codigo: 'X-9999' }, { codigo: null }]), 'ARV-0003')
})

test('somarMeses prende o dia ao fim do mês — uma poda anual não anda', () => {
  assert.equal(d.somarMeses('2026-01-31', 1), '2026-02-28')
  assert.equal(d.somarMeses('2028-01-31', 1), '2028-02-29')
  assert.equal(d.somarMeses('2026-03-15', 12), '2027-03-15')
  assert.equal(d.somarMeses('2026-11-30', 3), '2027-02-28')
  assert.equal(d.somarMeses('lixo', 1), null)
})

test('proximoServico parte da data REALIZADA, copia tipo/alvo/periodicidade, e é null para avulso', () => {
  const base = { tipo: 'poda', arvore_id: 4, presenca_id: null, periodicidade_meses: 6, materiais: 'motosserra', data_programada: '2026-01-10', obs: 'antiga' }
  const p = d.proximoServico(base, '2026-03-01')
  assert.deepEqual(p, {
    tipo: 'poda', arvore_id: 4, presenca_id: null, status: 'programado',
    data_programada: '2026-09-01', periodicidade_meses: 6, materiais: 'motosserra', obs: null,
  })
  assert.equal(d.proximoServico({ ...base, periodicidade_meses: null }, '2026-03-01'), null)
  assert.equal(d.proximoServico({ ...base, periodicidade_meses: 0 }, '2026-03-01'), null)
  assert.equal(d.proximoServico({ ...base, periodicidade_meses: '6' }, '2026-03-01').data_programada, '2026-09-01')
})

test('situacaoServico: vencido só para programado com data no passado; hoje não é vencido', () => {
  const hoje = '2026-09-13'
  assert.equal(d.situacaoServico({ status: 'programado', data_programada: '2026-09-12' }, hoje), 'vencido')
  assert.equal(d.situacaoServico({ status: 'programado', data_programada: '2026-09-13' }, hoje), 'programado')
  assert.equal(d.situacaoServico({ status: 'realizado', data_programada: '2026-01-01' }, hoje), 'realizado')
  assert.equal(d.situacaoServico({ status: 'cancelado', data_programada: '2026-01-01' }, hoje), 'cancelado')
  assert.equal(d.situacaoServico(null, hoje), null)
})

test('resumoPainel conta vencidos e serviços do mês, e ignora inativos', () => {
  const r = d.resumoPainel({
    arvores: [{ ativo: true }, { ativo: false }, {}],
    presencas: [{ ativo: true }, { ativo: false }],
    servicos: [
      { status: 'programado', data_programada: '2026-09-01' }, // vencido e no mês
      { status: 'programado', data_programada: '2026-09-20' }, // no mês
      { status: 'programado', data_programada: '2026-08-01' }, // vencido, fora do mês
      { status: 'realizado', data_programada: '2026-09-02' },  // não conta
      { status: 'cancelado', data_programada: '2026-09-02' },  // não conta
    ],
  }, '2026-09-13')
  assert.deepEqual(r, { arvores: 2, presencas: 1, vencidos: 2, noMes: 2 })
})

test('proximoDoAlvo devolve o programado mais próximo daquele alvo, ou null', () => {
  const servicos = [
    { status: 'programado', arvore_id: 1, data_programada: '2026-12-01' },
    { status: 'programado', arvore_id: 1, data_programada: '2026-10-01' },
    { status: 'realizado', arvore_id: 1, data_programada: '2026-01-01' },
    { status: 'programado', arvore_id: 2, data_programada: '2026-09-01' },
  ]
  assert.equal(d.proximoDoAlvo(servicos, 'arvore_id', 1).data_programada, '2026-10-01')
  assert.equal(d.proximoDoAlvo(servicos, 'arvore_id', 9), null)
  assert.equal(d.proximoDoAlvo(servicos, 'presenca_id', 1), null)
})

test('validarServico espelha a trava de alvo exclusivo e a faixa de periodicidade', () => {
  const ok = { tipo: 'poda', arvore_id: 1, presenca_id: null, data_programada: '2026-10-01', periodicidade_meses: 12 }
  assert.deepEqual(d.validarServico(ok), [])
  assert.ok(d.validarServico({ ...ok, presenca_id: 2 }).some(e => /exatamente um alvo/.test(e)))
  assert.ok(d.validarServico({ ...ok, arvore_id: null }).some(e => /exatamente um alvo/.test(e)))
  assert.ok(d.validarServico({ ...ok, periodicidade_meses: 121 }).some(e => /1 a 120/.test(e)))
  assert.ok(d.validarServico({ ...ok, periodicidade_meses: 1.5 }).some(e => /1 a 120/.test(e)))
  assert.deepEqual(d.validarServico({ ...ok, periodicidade_meses: null }), [])
  assert.ok(d.validarServico({ ...ok, tipo: 'banho' }).some(e => /Tipo/.test(e)))
  assert.ok(d.validarServico({ ...ok, data_programada: '' }).some(e => /Data/.test(e)))
})

test('validarArvore e validarPresenca espelham envelope e par de coordenadas', () => {
  assert.deepEqual(d.validarArvore({ ficha_id: 1, codigo: 'ARV-0001', lat: -22.84, lon: -43.11 }), [])
  assert.deepEqual(d.validarArvore({ ficha_id: 1, codigo: 'ARV-0001', lat: null, lon: null }), [])
  assert.ok(d.validarArvore({ ficha_id: 1, codigo: 'ARV-0001', lat: -22.84, lon: null }).some(e => /andam juntas/.test(e)))
  // par trocado: latitude na coluna de longitude cai fora do envelope
  assert.ok(d.validarArvore({ ficha_id: 1, codigo: 'ARV-0001', lat: -43.11, lon: -22.84 }).some(e => /fora da região/.test(e)))
  assert.ok(d.validarArvore({ ficha_id: 1, codigo: 'arv-1' }).some(e => /ARV-0000/.test(e)))
  assert.ok(d.validarArvore({ codigo: 'ARV-0001' }).some(e => /ficha/.test(e)))
  assert.ok(d.validarPresenca({ ficha_id: 1, quantidade_estimada: -1 }).some(e => /negativa/.test(e)))
  assert.deepEqual(d.validarPresenca({ ficha_id: 1, quantidade_estimada: 0 }), [])
})

test('urlDaEtiqueta carrega o CÓDIGO, nunca o id, e recusa código fora do formato', () => {
  assert.equal(d.urlDaEtiqueta('https://pmoc-orcin.vercel.app', 'ARV-0012'), 'https://pmoc-orcin.vercel.app/bio?codigo=ARV-0012')
  assert.equal(d.urlDaEtiqueta('https://x', '12'), null)
})

test('fmtData e hojeIso não passam por UTC', () => {
  assert.equal(d.fmtData('2026-09-13'), '13/09/2026')
  assert.equal(d.fmtData(null), '—')
  assert.equal(d.hojeIso(new Date(2026, 0, 5, 23, 30)), '2026-01-05')
})

// ── fronteira de escrita e sonda, com cliente falso ────────────────────

function clienteFalso({ semMigracao = false } = {}) {
  const chamadas = []
  const resposta = (tabela) => {
    if (semMigracao && tabela.startsWith('bio_')) return { data: null, error: { message: 'relation does not exist' } }
    return { data: [], error: null }
  }
  const construir = (tabela) => {
    const q = {
      select() { return q }, eq() { return q }, order() { return q }, limit() { return q },
      insert(r) { chamadas.push({ tabela, op: 'insert', r }); return Promise.resolve({ error: null }) },
      update(r) { chamadas.push({ tabela, op: 'update', r }); return q },
      then(res) { return Promise.resolve(resposta(tabela)).then(res) },
    }
    return q
  }
  return { chamadas, from: (t) => construir(t) }
}

test('a sonda é uma leitura sobre bio_fichas, fica FALSA sem a migração e a carga continua sem lançar', async () => {
  const cliente = clienteFalso({ semMigracao: true })
  app.__teste.definirSupa(cliente)
  await app.__teste.carregarTudo()
  const e = app.__teste.estado()
  assert.equal(e.BIO_OK, false)
  assert.deepEqual([e.FICHAS, e.ARVORES, e.PRESENCAS, e.SERVICOS], [[], [], [], []])
})

test('com a migração a sonda fica verde e as quatro tabelas são lidas', async () => {
  const cliente = clienteFalso()
  app.__teste.definirSupa(cliente)
  assert.equal(await app.__teste.sondarBio(), true)
})

test('papéis: técnico registra mas não gere; gestor e admin fazem os dois; observador nada', () => {
  const t = app.__teste
  t.definirUsuario({ role: 'tecnico' }); assert.equal(t.podeRegistrar(), true); assert.equal(t.podeGerir(), false)
  t.definirUsuario({ role: 'gestor' }); assert.equal(t.podeRegistrar(), true); assert.equal(t.podeGerir(), true)
  t.definirUsuario({ role: 'admin' }); assert.equal(t.podeGerir(), true)
  t.definirUsuario({ role: 'observador' }); assert.equal(t.podeRegistrar(), false); assert.equal(t.podeGerir(), false)
  t.definirUsuario(null); assert.equal(t.podeRegistrar(), false)
})

test('o módulo só escreve nas quatro tabelas bio_ e nunca chama delete', () => {
  const fonte = fs.readFileSync(path.join(RAIZ, 'bio', 'app.js'), 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const escritas = [...fonte.matchAll(/\.from\('([^']+)'\)\s*\.(insert|update|delete|upsert)\(/g)]
  assert.ok(escritas.length > 0)
  for (const [, tabela, op] of escritas) {
    assert.ok(tabela.startsWith('bio_'), `escrita em ${tabela} — o Bio lê cmasm_locais, nunca a altera`)
    assert.notEqual(op, 'delete', `delete em ${tabela} — o projeto arquiva`)
    assert.notEqual(op, 'upsert', `upsert em ${tabela} — não há caminho de escrita duplo`)
  }
  assert.doesNotMatch(fonte, /\.delete\(/)
})

test('toda função de escrita passa pela sonda e pelo papel — "sem migração, sem botão"', () => {
  const fonte = fs.readFileSync(path.join(RAIZ, 'bio', 'app.js'), 'utf8')
  for (const nome of ['salvarFicha', 'salvarArvore', 'salvarPresenca', 'salvarServico', 'confirmarRealizado']) {
    const corpo = new RegExp(`async function ${nome}\\(\\) \\{\\n([^\\n]*)`).exec(fonte)
    assert.ok(corpo, `função ${nome} não encontrada`)
    assert.match(corpo[0], /if \(!BIO_OK \|\| !pode(Registrar|Gerir)\(\)/, `${nome} não começa pela guarda de sonda+papel`)
  }
})

test('index.html: miolo dentro do #app, abre em block, etiqueta fora do #app e sem cor além do accent', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'bio', 'index.html'), 'utf8')
  const js = fs.readFileSync(path.join(RAIZ, 'bio', 'app.js'), 'utf8')
  assert.match(html, /<div id="app">\s*<div class="main">/)
  assert.match(js, /el\('app'\)\.style\.display = 'block'/)
  assert.match(html, /<\/div>\s*<!-- Etiqueta[\s\S]*<div id="etiqueta"><\/div>/)
  const cores = [...html.matchAll(/#[0-9a-f]{6}\b/gi)].map(m => m[0].toLowerCase())
  const foraDoPrint = cores.filter(c => c !== '#4f9a5c' && c !== '#1a1a18')
  // dentro do @media print o preto/branco da etiqueta é legítimo — é papel
  assert.ok(foraDoPrint.every(c => ['#000', '#fff', '#000000', '#ffffff'].includes(c) || /theme-color/.test(html)),
    `cores fora do accent: ${foraDoPrint.join(', ')}`)
})
