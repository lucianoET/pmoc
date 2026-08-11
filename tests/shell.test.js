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

test('a barra superior traz o botão de tema, com manipulador de alternância, e a classe não colide com o prefixo de aba', async () => {
  const { montarShell } = await modulo
  const { topo } = montarShell({ nome: 'Máquinas', navItems: [] })
  assert.match(topo, /id="btn-tema"/)
  assert.match(topo, /onclick="alternarTema\(\)"/)
  assert.doesNotMatch(topo, /class="btn-tema[^"]*nav/)
})
