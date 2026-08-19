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
