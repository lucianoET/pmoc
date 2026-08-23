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
//
// 260821-l7n (Task 2): contarOSPendentes passou a delegar em manPendente() — o vocabulário
// do fluxo de aprovação da OS interna, que muda o SENTIDO de "pendente" (agora inclui todo
// estado não terminal, legado e novo). Um gate que continuasse recortando só o bloco de
// alertas ficaria verde por acaso (ReferenceError silenciado por acidente nenhum, mas cego
// ao novo sentido) — por isso o mesmo contexto do sandbox agora roda DOIS recortes
// (`vm.runInContext` duas vezes, como tests/refrigeracao-encerramento-os.test.js já faz):
// o bloco de alertas E o bloco de vocabulário/transições.
//
// 260821-q57 (Task 1): alertasPmoc passou a chamar equipInoperante/equipComRestricao, do
// bloco de vocabulário do ESTADO DO EQUIPAMENTO (OP/INOP/OR) — um terceiro recorte, que
// entra ANTES do bloco de alertas porque é dele que alertasPmoc depende. Sem ele o gate
// ficaria verde por acaso do mesmo jeito que o comentário acima já registrou para 260821-l7n.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

function carregarNucleoAlertas() {
  const ctx = {
    // 260823-cf8: UNI_OK falso é o padrão (banco sem a migração 43) — as
    // cascas finas do fluxo (manPendente/manEhTerminal/…) resolvem pelo
    // fluxo legado, o mesmo vocabulário de sempre.
    UNI_OK: false,
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
  // bloco de vocabulário do estado do equipamento (alertasPmoc chama equipInoperante/equipComRestricao)
  vm.runInContext(recorte('/* ── estado do equipamento: vocabulário OP/INOP/OR ── */', '/* ── alertas: contagem única ── */'), ctx);
  // bloco de alertas (contarOSPendentes chama manPendente, definido no bloco de vocabulário)
  vm.runInContext(recorte('/* ── alertas: contagem única ── */', 'function dueBadgeHtml('), ctx);
  // bloco de vocabulário e transições do fluxo da OS interna (260821-l7n)
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
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

test('contarOSPendentes ignora o status de primeiro nível e lê o de dentro de entry (defeito 1a) — continua valendo: PENDENTE (legado) conta, CONCLUÍDA (legado, terminal via equivalência) não', () => {
  const ctx = carregarNucleoAlertas();
  const entradas = [
    { status: 'PENDENTE', entry: { status: 'CONCLUÍDA' } }, // forma exata do defeito 1a — não pode contar
    { entry: { status: 'PENDENTE' } },
  ];
  assert.strictEqual(ctx.contarOSPendentes(entradas), 1);
});

test('contarOSPendentes (260821-l7n): PARCIAL do legado e EM_EXECUCAO do fluxo novo contam; CANCELADA, CONFERIDA e CONCLUÍDA (legado) não contam', () => {
  const ctx = carregarNucleoAlertas();
  const entradas = [
    { entry: { status: 'PARCIAL' } },       // legado, não terminal via equivalência (EM_EXECUCAO)
    { entry: { status: 'EM_EXECUCAO' } },   // fluxo novo, não terminal
    { entry: { status: 'CANCELADA' } },     // terminal
    { entry: { status: 'CONFERIDA' } },     // terminal
    { entry: { status: 'CONCLUÍDA' } },     // legado, terminal via equivalência
  ];
  assert.strictEqual(ctx.contarOSPendentes(entradas), 2);
});

// 260823-cf8 (Task 2): CONCLUIDA (sem acento, D-cf8-10) é o terminal do
// fluxo próprio/externa unificado — contarOSPendentes continua tratando-o
// como terminal, com a migração 43 aplicada (UNI_OK verdadeiro).
test('contarOSPendentes (260823-cf8): com UNI_OK verdadeiro, CONCLUIDA (sem acento) é terminal — não conta; EM_EXECUCAO continua contando', () => {
  const ctx = carregarNucleoAlertas();
  ctx.UNI_OK = true;
  const entradas = [
    { entry: { status: 'EM_EXECUCAO', tipoExecutor: 'interna' } },
    { entry: { status: 'CONCLUIDA', tipoExecutor: 'interna' } },
    { entry: { status: 'CANCELADA', tipoExecutor: 'externa' } },
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

test('alertasPmoc (260821-q57): um equipamento OR cai na cesta restricao e entra em todos uma única vez', () => {
  const ctx = carregarNucleoAlertas();
  const orSemMotivoExtra = { id: 6, funciona: 'OR', ultimaManutencao: '2026-08-01', _prox: 100 };
  const ag = ctx.alertasPmoc([orSemMotivoExtra], new Date('2026-08-21T12:00:00Z'));
  assert.strictEqual(ag.restricao.includes(orSemMotivoExtra), true);
  assert.strictEqual(ag.nok.includes(orSemMotivoExtra), false); // D-q57-07: OR não é "Fora de Operação"
  assert.strictEqual(ag.todos.filter((e) => e === orSemMotivoExtra).length, 1);
  assert.strictEqual(ag.total, 1);
});

test('alertasPmoc (260821-q57): um OR que também está vencido continua contando uma única vez no total', () => {
  const ctx = carregarNucleoAlertas();
  const orEVencido = { id: 7, funciona: 'OR', ultimaManutencao: '2020-01-01', _prox: -10 };
  const ag = ctx.alertasPmoc([orEVencido], new Date('2026-08-21T12:00:00Z'));
  assert.strictEqual(ag.restricao.includes(orEVencido), true);
  assert.strictEqual(ag.vencidos.includes(orEVencido), true);
  assert.strictEqual(ag.todos.filter((e) => e === orEVencido).length, 1);
  assert.strictEqual(ag.total, 1);
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

// 260821-uyz (Task 1): removido/baixado somem das operações — KPIs, alertas
// e PMOC leem só equipamentosOperacionais(DATA). alertasPmoc CONTINUA pura,
// sem filtrar por dentro — é o que mantém este gate válido em vez de verde
// por acidente.
test('o corpo de renderDash chama equipamentosOperacionais(DATA) e passa o resultado para alertasPmoc', () => {
  const ini = HTML.indexOf('function renderDash(){');
  const fim = HTML.indexOf('var CRIT_ORDEM =');
  assert.ok(ini > 0 && fim > ini, 'renderDash / CRIT_ORDEM não encontrados');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /equipamentosOperacionais\(DATA\)/);
  assert.match(corpo, /alertasPmoc\(opDATA/);
});

test('o corpo de renderAlerts chama alertasPmoc(equipamentosOperacionais(DATA)', () => {
  const ini = HTML.indexOf('function renderAlerts(){');
  const fim = HTML.indexOf('DRAWER / DETAIL', ini);
  assert.ok(ini > 0 && fim > ini, 'renderAlerts / próxima seção não encontrados');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /alertasPmoc\(equipamentosOperacionais\(DATA\)/);
});

test('o corpo de renderPmoc filtra a partir de equipamentosOperacionais(DATA)', () => {
  const ini = HTML.indexOf('function renderPmoc(){');
  const fim = HTML.indexOf('el(\'pmoc-cnt\')', ini) > 0 ? HTML.indexOf('\n}', HTML.indexOf('function renderPmoc(){')) : -1;
  assert.ok(ini > 0, 'renderPmoc não encontrada');
  const corpo = HTML.slice(ini, HTML.indexOf('\n}\n', ini));
  assert.match(corpo, /equipamentosOperacionais\(DATA\)/);
});

test('alertasPmoc continua pura — o corpo dela não menciona equipInstalado (o contrato não mudou)', () => {
  const ini = HTML.indexOf('function alertasPmoc(');
  const fim = HTML.indexOf('function contarOSPendentes(', ini);
  assert.ok(ini > 0 && fim > ini, 'alertasPmoc / contarOSPendentes não encontrados');
  const corpo = HTML.slice(ini, fim);
  assert.doesNotMatch(corpo, /equipInstalado/, 'alertasPmoc não deveria filtrar por dentro — quem filtra é o chamador');
});
