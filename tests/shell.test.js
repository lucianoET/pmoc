const assert = require('node:assert/strict')
const test = require('node:test')

const modulo = import('../shared/shell.js')

test('barra superior sempre traz o chip de usuário e o botão de saída', async () => {
  const { montarShell } = await modulo
  const { topo } = montarShell({ nome: 'Máquinas', navItems: [] })
  assert.match(topo, /id="user-chip"/)
  assert.match(topo, /onclick="sair\(\)"/)
})

test('com lista de abas vazia, o topo gerado não contém a faixa de abas', async () => {
  const { montarShell } = await modulo
  const { topo } = montarShell({ nome: 'Mapa', navItems: [] })
  assert.doesNotMatch(topo, /class="nav"/)
})

test('com duas abas, o topo traz dois botões, o ativo recebe a classe de estado e cada botão carrega data-view', async () => {
  const { montarShell } = await modulo
  const { topo } = montarShell({
    nome: 'Máquinas',
    navItems: [
      { id: 'painel', icone: '📊', label: 'Painel', ativo: true },
      { id: 'ativos', icone: '🔧', label: 'Ativos', ativo: false },
    ],
  })
  const botoes = topo.match(/<button class="nav-btn[^"]*"/g)
  assert.equal(botoes.length, 2)
  assert.match(topo, /class="nav-btn active" data-view="painel"/)
  assert.match(topo, /class="nav-btn" data-view="ativos"/)
})

test('com o link do portal desligado, o topo não traz o link de volta', async () => {
  const { montarShell } = await modulo
  const { topo } = montarShell({ nome: 'Máquinas', navItems: [], portalLink: false })
  assert.doesNotMatch(topo, /topbar-back/)
})

test('nome de módulo com marcação sai escapado, sem marcação crua no HTML gerado', async () => {
  const { montarShell } = await modulo
  const { topo } = montarShell({ nome: '<script>alert(1)</script>', navItems: [] })
  assert.doesNotMatch(topo, /<script>alert\(1\)<\/script>/)
  assert.match(topo, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('o rodapé traz o nome do módulo e o link do portal, com a versão aparecendo apenas quando informada', async () => {
  const { montarShell } = await modulo
  const comVersao = montarShell({ nome: 'Elétrica', navItems: [], versao: '2.1' }).rodape
  const semVersao = montarShell({ nome: 'Elétrica', navItems: [] }).rodape
  assert.match(comVersao, /Elétrica/)
  assert.match(comVersao, /href="\/"/)
  assert.match(comVersao, /v2\.1/)
  assert.doesNotMatch(semVersao, /<span>v/)
})

// O botão de tema saiu da barra superior para o rodapé em 19/08/2026: é
// preferência de exibição, escolhida uma vez, e disputava espaço no topo
// com Portal e Sair, que são as ações. O que o gate garante continua sendo
// o mesmo — existe UM botão de tema, com o id que iniciarTema() procura e
// o manipulador que shared/tema.js publica —, só mudou o lugar.
test('o alternador de tema está no rodapé, com o id e o manipulador que shared/tema.js espera', async () => {
  const { montarShell } = await modulo
  const { topo, rodape } = montarShell({ nome: 'Máquinas', navItems: [] })
  assert.match(rodape, /id="btn-tema"/)
  assert.match(rodape, /onclick="alternarTema\(\)"/)
  assert.doesNotMatch(topo, /id="btn-tema"/, 'o tema não pode continuar na barra superior')
  assert.doesNotMatch(rodape, /class="btn-tema[^"]*nav/)
})

// Padronização do chrome (19/08/2026): Portal é botão, e vem imediatamente
// antes de Sair — as duas ações de saída do módulo, com o mesmo peso, na
// mesma ordem em todos os módulos.
test('o Portal é um botão e fica imediatamente antes de Sair', async () => {
  const { montarShell } = await modulo
  const { topo } = montarShell({ nome: 'Máquinas', navItems: [] })
  assert.match(topo, /class="[^"]*topbar-portal[^"]*"/)
  assert.doesNotMatch(topo, /<a class="topbar-back"/, 'o Portal deixou de ser link de texto')
  const posPortal = topo.indexOf('topbar-portal')
  const posSair = topo.indexOf('btn-sair')
  assert.ok(posPortal >= 0 && posSair > posPortal, 'Portal deveria vir antes de Sair')
})

test('o rodapé traz a marca da empresa, em nova aba e sem vazar a referência da janela', async () => {
  const { montarShell } = await modulo
  const { rodape } = montarShell({ nome: 'Máquinas', navItems: [] })
  assert.match(rodape, /href="https:\/\/luctronics\.com\.br"/)
  // rel noopener é o que impede a página aberta de manipular esta pela
  // referência window.opener.
  assert.match(rodape, /rel="noopener noreferrer"/)
})

test('ícone de aba aceita nome do conjunto comum e caractere solto, sem quebrar quem ainda usa emoji', async () => {
  const { montarShell } = await modulo
  const { topo } = montarShell({
    nome: 'Máquinas',
    navItems: [
      { id: 'painel', icone: 'painel', label: 'Painel', ativo: true },
      { id: 'consumo', icone: '⛽', label: 'Consumo' },
    ],
  })
  assert.match(topo, /<svg class="ico nav-ico"/, 'nome conhecido deveria virar SVG monocromático')
  assert.match(topo, /⛽ Consumo/, 'caractere solto continua saindo como texto')
})

// ═══════════ o contrato de montagem do #app ═══════════
//
// Dois defeitos reais, os dois em produção do dia 31/08 ao 01/09, os dois
// em `/equipes`, e nenhum gate os via — porque o de 375px lê texto e diz
// isso de si mesmo ("o repo é zero-build, sem navegador headless"), e
// porque nenhum caso afirmava COMO o módulo monta o #app.
//
// 1) `#app` aberto com `display:flex` sem `flex-direction`. O padrão do
//    flex é `row`: topbar, faixa de abas, conteúdo e rodapé desenhavam
//    LADO A LADO, em qualquer largura — a faixa espremida a 20px de
//    conteúdo (duas das cinco abas na tela) e o rodapé virando uma coluna
//    no meio. `column` também não serve de conserto: como item flex com
//    `margin:0 auto`, a `.main` deixa de esticar e cai de 1240px para o
//    tamanho do conteúdo. Quem quiser flex declara a direção, como
//    `/mapa` faz no próprio HTML.
//
// 2) miolo inserido DEPOIS de `aplicarShell`. O shell põe a topbar com
//    `afterbegin` e o rodapé com `beforeend` — o que chega depois cai
//    ABAIXO do rodapé, que foi exatamente o que aconteceu.
//
// Continua sendo verificação estática: Playwright existe no ambiente de
// desenvolvimento, não no repositório, e um gate que exigisse dependência
// nova reprovaria na máquina do usuário.

const fs = require('node:fs')
const path = require('node:path')
const RAIZ = path.join(__dirname, '..')

// Os módulos que consomem o shell. `equipes` está aqui de propósito: ele
// ficou de fora da lista do gate de 375px, e foi o único que quebrou.
const CONSOMEM_SHELL = ['maquinas', 'transportes', 'eletrica', 'fonoclama', 'predial', 'mapa', 'equipes']

function fontesDo(modulo) {
  const dir = path.join(RAIZ, modulo)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.html'))
    .map(f => ({ nome: `${modulo}/${f}`, txt: fs.readFileSync(path.join(dir, f), 'utf8') }))
}

test('nenhum módulo abre o #app como flex sem declarar a direção', () => {
  for (const modulo of CONSOMEM_SHELL) {
    const fontes = fontesDo(modulo)
    const abreFlex = fontes.some(f => /el\('app'\)\.style\.display\s*=\s*'flex'/.test(f.txt)
      || /getElementById\('app'\)\.style\.display\s*=\s*'flex'/.test(f.txt))
    if (!abreFlex) continue
    const declara = fontes.some(f => /#app\s*\{[^}]*flex-direction\s*:/.test(f.txt))
    assert.ok(declara,
      `${modulo} abre o #app com display:flex e não declara flex-direction — ` +
      'o padrão é row, e o shell inteiro sai lado a lado')
  }
})

test('nenhum módulo insere miolo no #app DEPOIS de aplicarShell — cairia abaixo do rodapé', () => {
  for (const modulo of CONSOMEM_SHELL) {
    for (const f of fontesDo(modulo)) {
      const i = f.txt.indexOf('aplicarShell(')
      if (i < 0) continue
      const depois = f.txt.slice(i)
      assert.ok(!/el\('app'\)\.insertAdjacentHTML\('beforeend'/.test(depois),
        `${f.nome} insere conteúdo no fim do #app depois de aplicarShell; ` +
        'o rodapé já está lá, então o miolo cai abaixo dele')
    }
  }
})

test('o shell põe topo no início e rodapé no fim — é o que torna a ordem de chamada decisiva', () => {
  const shell = fs.readFileSync(path.join(RAIZ, 'shared', 'shell.js'), 'utf8')
  assert.match(shell, /insertAdjacentHTML\('afterbegin', topo\)/)
  assert.match(shell, /insertAdjacentHTML\('beforeend', rodape\)/)
})
