const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const raiz = path.join(__dirname, '..')
const html = fs.readFileSync(path.join(raiz, 'maquinas', 'index.html'), 'utf8')
const app = fs.readFileSync(path.join(raiz, 'maquinas', 'app.js'), 'utf8')

test('carrega o domínio antes da aplicação', () => {
  const dominio = html.indexOf('/maquinas/operacoes.js')
  const aplicacao = html.indexOf('/maquinas/app.js')
  assert.ok(dominio >= 0)
  assert.ok(dominio < aplicacao)
})

test('expõe operações, agenda e os três formulários do fluxo', () => {
  for (const trecho of [
    'id="view-operacoes"',
    'id="view-agenda"',
    'id="operacoes-kanban"',
    'id="agenda-calendario"',
    'id="modal-operacao"',
    'id="modal-area"',
    'id="modal-concluir-operacao"',
  ]) assert.match(html, new RegExp(trecho))
  // Desde a Fase 5 Plano 6, a faixa de abas (com data-view) é gerada em
  // tempo de execução por shared/shell.js (aplicarShell), não é mais
  // markup estático em maquinas/index.html — a exposição de operações e
  // agenda passa a ser verificada pela configuração de abas em app.js.
  assert.match(app, /id:\s*'operacoes'/)
  assert.match(app, /id:\s*'agenda'/)
})

test('carrega áreas e operações e conclui por RPC', () => {
  assert.match(app, /from\('maq_areas'\)/)
  assert.match(app, /from\('maq_operacoes'\)/)
  assert.match(app, /rpc\('concluir_maq_operacao'/)
  assert.match(app, /function renderOperacoes\(/)
  assert.match(app, /function renderAgenda\(/)
})