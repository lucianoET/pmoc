// Gate dos quatro bugs de leitura e contagem do módulo /refrigeracao (quick 260821-jpd,
// Task 1: badge de OS pendente, contagem de alertas sem duplicidade, cache de log do
// observador, leitura da trilha de auditoria).
//
// O núcleo puro (equipSemHist, equipVencido, alertasPmoc, contarOSPendentes) é recortado
// do HTML entre o comentário `/* ── alertas: contagem única ── */` e
// `function dueBadgeHtml(` e avaliado num sandbox `node:vm`, com `nextPmoc` e
// `getLatestLogDate` substituídos por versões controladas — mesmo padrão de
// tests/inventario-ordem-refrigeracao.test.js. `ctEvtTexto` é puro e recortado sozinho.
// As últimas asserções são de presença/ausência de texto, recortadas na região onde
// valem — única forma de conferir fiação num app single-file sem montar o DOM inteiro.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');

function carregarNucleoAlertas() {
  const ini = HTML.indexOf('/* ── alertas: contagem única ── */');
  const fim = HTML.indexOf('function dueBadgeHtml(');
  assert.ok(ini > 0 && fim > ini, 'bloco "alertas: contagem única" não encontrado em refrigeracao/index.html');

  const ctx = {
    // nextPmoc controlado: cada equipamento traz _prox (dias a partir de 21/08/2026,
    // negativo = vencido, null/undefined = sem histórico — igual ao teste de inventário).
    nextPmoc(e) {
      if (e._prox === null || e._prox === undefined) return null;
      const d = new Date('2026-08-21T12:00:00Z');
      d.setDate(d.getDate() + e._prox);
      return d;
    },
    // getLatestLogDate controlado: nenhum equipamento tem log fora de ultimaManutencao
    // nesta suíte — equipSemHist depende só de e.ultimaManutencao.
    getLatestLogDate() { return null; },
  };
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  return ctx;
}

function carregarCtEvtTexto() {
  const ini = HTML.indexOf('function ctEvtTexto(');
  const fim = HTML.indexOf('function ctEquip(');
  assert.ok(ini > 0 && fim > ini, 'ctEvtTexto não encontrada entre ctStatusPill e ctEquip');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  return ctx;
}

test('contarOSPendentes ignora o status de primeiro nível e lê o de dentro de entry (defeito 1a)', () => {
  const ctx = carregarNucleoAlertas();
  const entradas = [
    { status: 'PENDENTE', entry: { status: 'CONCLUÍDA' } }, // forma exata do defeito 1a — não pode contar
    { entry: { status: 'PENDENTE' } },
  ];
  assert.strictEqual(ctx.contarOSPendentes(entradas), 1);
});

test('alertasPmoc conta um equipamento NOK-e-sem-histórico uma única vez no total e nas duas parcelas', () => {
  const ctx = carregarNucleoAlertas();
  const nokESemHist = { id: 4, funciona: 'NOK', ultimaManutencao: '', _prox: 100 };
  const lista = [nokESemHist];
  const ag = ctx.alertasPmoc(lista, new Date('2026-08-21T12:00:00Z'));
  assert.strictEqual(ag.nok.includes(nokESemHist), true);
  assert.strictEqual(ag.semHist.includes(nokESemHist), true);
  assert.strictEqual(ag.todos.filter((e) => e === nokESemHist).length, 1);
  assert.ok(ag.total < ag.nok.length + ag.semHist.length);
});

test('total bate com o tamanho de todos e com a união calculada à mão numa fixture com sobreposição nos três critérios', () => {
  const ctx = carregarNucleoAlertas();
  const agora = new Date('2026-08-21T12:00:00Z');
  const eNok = { id: 1, funciona: 'NOK', ultimaManutencao: '2026-01-01', _prox: 100 };
  const eSemHist = { id: 2, funciona: 'OK', ultimaManutencao: '', _prox: null };
  const eVencido = { id: 3, funciona: 'OK', ultimaManutencao: '2020-01-01', _prox: -10 };
  const eNokESemHist = { id: 4, funciona: 'NOK', ultimaManutencao: '', _prox: null };
  const eTodosOsTres = { id: 5, funciona: 'NOK', ultimaManutencao: '', _prox: -5 };
  const lista = [eNok, eSemHist, eVencido, eNokESemHist, eTodosOsTres];

  const ag = ctx.alertasPmoc(lista, agora);

  assert.strictEqual(ag.total, ag.todos.length);
  assert.strictEqual(ag.total, 5); // união à mão: {eNok, eSemHist, eVencido, eNokESemHist, eTodosOsTres}
  assert.ok(ag.nok.length + ag.vencidos.length + ag.semHist.length > ag.total, 'a soma das parcelas deve exceder o total sem repetição, provando a sobreposição');
});

test('equipVencido é falso para quem não tem data anterior — sem histórico não vence', () => {
  const ctx = carregarNucleoAlertas();
  const semHist = { id: 2, funciona: 'OK', ultimaManutencao: '', _prox: null };
  assert.strictEqual(ctx.equipVencido(semHist, new Date('2026-08-21T12:00:00Z')), false);
});

test('ctEvtTexto lê a coluna detalhe do banco e ignora o nome no plural que nunca existiu', () => {
  const ctx = carregarCtEvtTexto();
  assert.strictEqual(ctx.ctEvtTexto({ detalhe: 'x' }), 'x');
  assert.strictEqual(ctx.ctEvtTexto({ detalhes: 'y' }), ''); // coluna inexistente não pode voltar a ser lida
  assert.strictEqual(ctx.ctEvtTexto({}), '');
});

test('o corpo de renderDash chama alertasPmoc( e contarOSPendentes(', () => {
  const ini = HTML.indexOf('function renderDash(){');
  const fim = HTML.indexOf('var CRIT_ORDEM =');
  assert.ok(ini > 0 && fim > ini, 'renderDash / CRIT_ORDEM não encontrados');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /alertasPmoc\(/);
  assert.match(corpo, /contarOSPendentes\(/);
});

test('o corpo de renderAlerts chama alertasPmoc( e não recalcula o badge somando os tamanhos das listas', () => {
  const ini = HTML.indexOf('function renderAlerts(){');
  const fim = HTML.indexOf('DRAWER / DETAIL', ini);
  assert.ok(ini > 0 && fim > ini, 'renderAlerts / próxima seção não encontrados');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /alertasPmoc\(/);
  assert.doesNotMatch(corpo, /nokList\.length\s*\+\s*vencList\.length/);
});

test('o corpo de acessoLivre() chama await loadLogsFromSupabase() e não zera o cache de log', () => {
  const ini = HTML.indexOf('async function acessoLivre() {');
  const fim = HTML.indexOf('INIT — aguarda DOM', ini);
  assert.ok(ini > 0 && fim > ini, 'acessoLivre / marcador de INIT não encontrados');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /await loadLogsFromSupabase\(\)/);
  assert.doesNotMatch(corpo, /_logCache\s*=\s*\{\}/);
});

test('nenhuma das quatro leituras fantasma de os_eventos sobrevive no arquivo inteiro', () => {
  assert.doesNotMatch(HTML, /\bde_status\b/);
  assert.doesNotMatch(HTML, /\bpara_status\b/);
  assert.doesNotMatch(HTML, /ev\.detalhes\b/);
  assert.doesNotMatch(HTML, /ev\.role\b/);
});

test('os quatro grep do PLAT-15 continuam em 0 — refrigeração segue congelada e standalone', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
