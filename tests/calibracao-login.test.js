const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate da decisão D-06 fechada: /calibracao deixou de aceitar escrita
// anônima.
//
// O que este arquivo protege são as DUAS metades do conserto, que só
// funcionam juntas. Fechar a policy sem colocar login deixaria o módulo
// gravando erro em toda tela; colocar login sem fechar a policy deixaria
// o buraco aberto atrás de uma porta destrancada — a `anon key` está no
// HTML, então quem quisesse escrever nunca precisaria passar pela tela.
//
// A metade que mais convida a erro é a leitura: fechar `cal_*` inteiro
// para `authenticated` parece mais seguro e quebra o cargo "Livre", que
// é acesso de observador SEM SENHA e por isso continua sendo `anon`.
// Por isso o teste exige as duas policies por tabela, não uma.
const RAIZ = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(RAIZ, 'calibracao', 'index.html'), 'utf8')
const RLS = fs.readFileSync(path.join(RAIZ, 'supabase', '39_calibracao_rls_autenticada.sql'), 'utf8')

const TABELAS = ['cal_labs', 'cal_equipamentos', 'cal_ps', 'cal_lotes', 'cal_catalogo']

// ── migração 39 ───────────────────────────────────────────────────────────
test('a migração 39 restringe a policy de escrita das cinco tabelas a authenticated', () => {
  for (const t of TABELAS) {
    assert.match(
      RLS,
      new RegExp(`alter policy\\s+"${t}_tudo"\\s+on ${t}\\s+to authenticated`),
      `faltou restringir ${t}_tudo`,
    )
  }
})

test('a migração 39 devolve a leitura pública que o cargo Livre depende', () => {
  // Sem esta metade o observador (anon, sem senha) abriria o módulo e
  // veria onze telas vazias — o dado existe, a policy é que o recusa.
  for (const t of TABELAS) {
    assert.match(
      RLS,
      new RegExp(`create policy\\s+"${t}_sel"\\s+on ${t}\\s+for select to public using \\(true\\)`),
      `faltou o select público de ${t}`,
    )
  }
})

test('a migração 39 não dropa nenhuma policy que existisse antes dela', () => {
  // `drop policy if exists` é permitido só para as `_sel` que ela própria
  // cria — é o que a torna re-executável. Dropar uma `_tudo` apagaria a
  // policy de escrita das outras seis famílias de decisão registrada.
  const drops = RLS.match(/drop policy if exists\s+"([^"]+)"/g) || []
  for (const d of drops) {
    assert.match(d, /_sel"$/, `a 39 só pode dropar as policies que ela cria: ${d}`)
  }
  assert.doesNotMatch(RLS, /drop\s+(table|column|policy if exists\s+"[a-z_]+_tudo")/i)
})

test('a migração 39 não toca em tabela, coluna ou linha', () => {
  assert.doesNotMatch(RLS, /\b(insert into|update\s+cal_|delete from|alter table)\b/i)
})

// ── login no módulo ───────────────────────────────────────────────────────
test('o app React só monta depois do login, nunca na carga da página', () => {
  // A regressão que este teste pega: alguém devolve o render para o topo
  // "porque estava mais simples" e o módulo volta a consultar o banco
  // antes de existir sessão.
  const renders = HTML.match(/ReactDOM\.createRoot\(document\.getElementById\('root'\)\)\.render\(/g) || []
  assert.equal(renders.length, 1, 'deveria haver exatamente um render')
  assert.match(HTML, /window\.__calIniciar\s*=\s*function/,
    'o render precisa ser corpo de __calIniciar')

  const posIniciar = HTML.indexOf('window.__calIniciar = function')
  const posRender = HTML.indexOf('ReactDOM.createRoot(document.getElementById(\'root\')).render(')
  assert.ok(posRender > posIniciar, 'o render precisa estar DENTRO de __calIniciar')
})

test('o login é o Auth compartilhado, não uma cópia dentro do módulo', () => {
  assert.match(HTML, /import\s*\{\s*Auth\s*\}\s*from\s*'\.\.\/shared\/auth\.js'/,
    'o módulo precisa importar shared/auth.js')
  assert.match(HTML, /new Auth\(window\.__calSupa/,
    'o Auth precisa receber o client do módulo')
  assert.doesNotMatch(HTML, /signInWithPassword/,
    'autenticação é responsabilidade de shared/auth.js — copiar o login aqui '
    + 'criaria a segunda tela de login para alguém esquecer de corrigir')
})

test('o login e as consultas usam um client só', () => {
  // Dois clients = duas sessões: o usuário digitaria a senha numa e o
  // módulo consultaria pela outra, ainda como anon, e a escrita seria
  // recusada pelo Postgres sem nada na tela explicando por quê.
  const clients = HTML.match(/createClient\(/g) || []
  assert.equal(clients.length, 1, 'deveria haver exatamente um createClient')
  assert.match(HTML, /window\.__calSupa\s*=\s*supa/)
})

test('onLogin monta o app uma vez só, mesmo recebendo a sessão salva duas vezes', () => {
  // `Auth.mount` checa getSession() E escuta onAuthStateChange: com sessão
  // válida no navegador, onLogin chega duas vezes para o mesmo login.
  assert.match(HTML, /if \(iniciado\) return/,
    'faltou a trava de dupla montagem no onLogin')
})

test('o módulo oferece a saída, senão só o cache expira a sessão', () => {
  assert.match(HTML, /window\.__calSair\s*=\s*async function/)
  assert.match(HTML, /auth\.signOut\(\)/)
  assert.match(HTML, /onClick: \(\) => window\.__calSair\(\)/,
    'o botão Sair precisa estar na topbar')
})

test('a tela de login recebe os tokens deste módulo, não os da plataforma', () => {
  // shared/auth.js desenha com --surface/--border/--text; aqui os nomes
  // são --sf/--bd/--tx. Sem a ponte o cartão cai nos fallbacks escuros do
  // próprio auth.js e sai escuro sobre o tema claro.
  const ponte = HTML.match(/#login-cal\{[^}]+\}/)
  assert.ok(ponte, 'faltou o bloco #login-cal com o mapa de tokens')
  for (const par of [
    ['--surface', '--sf'],
    ['--border', '--bd'],
    ['--text', '--tx'],
    ['--yellow', '--blue'],
  ]) {
    assert.match(ponte[0], new RegExp(`${par[0]}:var\\(${par[1]}\\)`),
      `faltou mapear ${par[0]} para ${par[1]}`)
  }
})

test('o tema é aplicado antes de desenhar o login, não depois', () => {
  // O React é quem aplica o tema, e ele só monta depois do login: sem
  // estas linhas a tela de login pisca no tema errado para quem escolheu
  // claro. É a mesma razão do script anti-FOUC dos outros módulos.
  assert.match(HTML, /localStorage\.getItem\('cmasm_erp_theme'\)[\s\S]{0,200}dataset\.theme/,
    'o módulo de login precisa aplicar o tema salvo antes de montar')
})

test('sem SDK o módulo diz o que houve em vez de abrir onze telas vazias', () => {
  assert.match(HTML, /if \(!window\.__calSupa\)/)
})

// ── documentação da decisão ───────────────────────────────────────────────
test('o aviso de escrita anônima saiu do topo da migração 35', () => {
  // O aviso ficou verdadeiro por um dia. Deixá-lo lá depois da 39 faria
  // a próxima pessoa fechar de novo o que já está fechado — ou pior,
  // acreditar que ainda está aberto e não usar o módulo.
  const m35 = fs.readFileSync(path.join(RAIZ, 'supabase', '35_calibracao_schema.sql'), 'utf8')
  assert.match(m35, /39_calibracao_rls_autenticada|migração 39/,
    'o topo da 35 precisa apontar para a migração que fechou o buraco')
})
