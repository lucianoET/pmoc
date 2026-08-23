// Gate do encerramento de OS gravando equipamentos.ultima_manutencao (D-jpd-03) e do
// histórico de manutenção da contratação, idempotente pelo prefixo da descrição
// (D-jpd-04) — quick 260821-jpd, Task 2.
//
// Dois recortes do HTML — o bloco de encerramento (atualizarUltimaManutencao) e o bloco
// de histórico da contratação (ctMarcadorHistorico/ctDescricaoHistorico/ctJaTemHistorico/
// ctEncerrarHistorico) — avaliados juntos num único sandbox node:vm, com supa, DATA,
// showToast, today, console e addLogEntryAsync todos substituídos por versões
// controladas. addLogEntryAsync falso grava numa tabela em memória, o que permite provar
// a idempotência de ponta a ponta sem tocar o Supabase de verdade.

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

function carregarSandbox(opts) {
  opts = opts || {};
  const updates = [];
  const logsFake = opts.logsIniciais ? opts.logsIniciais.slice() : [];
  const insercoes = [];

  const ctx = {
    DATA: opts.data || [],
    showToast(msg, tipo) { ctx._toasts.push({ msg, tipo }); },
    _toasts: [],
    today() { return '2026-08-21'; },
    console: { warn(...args) { ctx._warns.push(args); }, error(...args) {} },
    _warns: [],
    // supa falso: só o que os dois blocos usam — update de equipamentos e select de logs_manutencao.
    supa: {
      from(tabela) {
        if (tabela === 'equipamentos') {
          return {
            update(patch) {
              return {
                eq(col, val) {
                  if (opts.erroUpdate) return Promise.resolve({ error: { message: 'falhou' } });
                  updates.push({ patch, col, val });
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }
        if (tabela === 'logs_manutencao') {
          return {
            select() {
              return {
                eq() {
                  if (opts.erroSelectLogs) return Promise.resolve({ error: { message: 'falhou' }, data: null });
                  return Promise.resolve({ error: null, data: logsFake });
                },
              };
            },
          };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
    },
    // addLogEntryAsync falso: acumula em insercoes, simulando logs_manutencao pós-insert.
    addLogEntryAsync(equipId, entry) {
      const id = 'log-' + (insercoes.length + 1);
      const linha = { id, equip_id: equipId, descricao: entry.desc, tipo: entry.tipo, status: entry.status, tecnico: entry.tecnico };
      insercoes.push(linha);
      logsFake.push(linha); // uma segunda consulta a logs_manutencao já veria esta linha
      return Promise.resolve(id);
    },
  };
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── encerramento de OS: última manutenção ── */', 'async function saveLogEntry('), ctx);
  vm.runInContext(recorte('/* ── histórico da contratação ── */', 'async function ctCertificar('), ctx);
  ctx._updates = updates;
  ctx._insercoes = insercoes;
  return ctx;
}

test('atualizarUltimaManutencao grava quando a data é mais recente que a registrada', async () => {
  const equip = { id: 10, ultimaManutencao: '' };
  const ctx = carregarSandbox({ data: [equip] });
  const ok = await ctx.atualizarUltimaManutencao(10, '2026-08-21');
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx._updates.length, 1);
  // objeto criado dentro do sandbox vm: comparar por campo, não por deepStrictEqual
  // (realms diferentes têm Object.prototype diferentes e a comparação estrutural falha).
  assert.strictEqual(ctx._updates[0].patch.ultima_manutencao, '2026-08-21');
  assert.strictEqual(equip.ultimaManutencao, '2026-08-21');
});

test('atualizarUltimaManutencao não grava quando a data é anterior à registrada (D-jpd-03)', async () => {
  const equip = { id: 11, ultimaManutencao: '2026-09-01' };
  const ctx = carregarSandbox({ data: [equip] });
  const ok = await ctx.atualizarUltimaManutencao(11, '2026-08-01');
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx._updates.length, 0);
  assert.strictEqual(equip.ultimaManutencao, '2026-09-01');
});

test('atualizarUltimaManutencao não grava quando a data é igual à registrada', async () => {
  const equip = { id: 12, ultimaManutencao: '2026-08-21' };
  const ctx = carregarSandbox({ data: [equip] });
  const ok = await ctx.atualizarUltimaManutencao(12, '2026-08-21');
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx._updates.length, 0);
});

test('ctMarcadorHistorico usa numero quando existe e cai no id quando não existe', () => {
  const ctx = carregarSandbox({});
  assert.strictEqual(ctx.ctMarcadorHistorico({ numero: 'OS-42', id: 'uuid-1' }), 'Contratação OS-42');
  assert.strictEqual(ctx.ctMarcadorHistorico({ numero: '', id: 'uuid-1' }), 'Contratação uuid-1');
});

test('ctJaTemHistorico reconhece o prefixo numa linha do banco (descricao) e numa do cache (desc), sem confundir OS de número diferente', () => {
  const ctx = carregarSandbox({});
  const marcador = ctx.ctMarcadorHistorico({ numero: 'OS-42', id: 'x' });
  assert.strictEqual(ctx.ctJaTemHistorico([{ descricao: 'Contratação OS-42 — serviço x' }], marcador), true);
  assert.strictEqual(ctx.ctJaTemHistorico([{ desc: 'Contratação OS-42 — serviço x' }], marcador), true);
  assert.strictEqual(ctx.ctJaTemHistorico([{ descricao: 'Contratação OS-99 — outra coisa' }], marcador), false);
  assert.strictEqual(ctx.ctJaTemHistorico([], marcador), false);
});

test('idempotência de ponta a ponta: ctEncerrarHistorico duas vezes sobre a mesma OS deixa uma linha só', async () => {
  const equip = { id: 20, ultimaManutencao: '' };
  const ctx = carregarSandbox({ data: [equip] });
  const os = { id: 'os-1', numero: 'OS-100', equip_id: 20, problema: 'Vazamento de gás', empresa: 'Ar Frio Ltda', nf: '555', data_nf: '2026-08-20' };

  const r1 = await ctx.ctEncerrarHistorico(os);
  const r2 = await ctx.ctEncerrarHistorico(os);

  assert.strictEqual(r1, true);
  assert.strictEqual(r2, false);
  assert.strictEqual(ctx._insercoes.length, 1);
  const linha = ctx._insercoes[0];
  assert.strictEqual(linha.tipo, 'CORRETIVA');
  assert.strictEqual(linha.status, 'CONCLUÍDA');
  assert.strictEqual(linha.tecnico, 'Ar Frio Ltda');
  assert.strictEqual(linha.descricao.indexOf('Contratação OS-100'), 0);
});

test('OS sem equip_id não insere nada', async () => {
  const ctx = carregarSandbox({});
  const ok = await ctx.ctEncerrarHistorico({ id: 'os-2', numero: 'OS-200' });
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx._insercoes.length, 0);
});

test('erro na consulta de logs_manutencao devolve false sem lançar exceção', async () => {
  const ctx = carregarSandbox({ erroSelectLogs: true });
  const ok = await ctx.ctEncerrarHistorico({ id: 'os-3', numero: 'OS-300', equip_id: 30 });
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx._insercoes.length, 0);
  assert.strictEqual(ctx._warns.length, 1);
});

// 260821-l7n (Task 2): a asserção solta de "saveLogEntry chama atualizarUltimaManutencao"
// deixou de ser fiel — com o fluxo de aprovação ligado, criar a OS NÃO grava última
// manutenção (D-l7n-11: quem encerra é a conferência do gestor, não a abertura). A
// asserção agora fixa o GUARDA nos dois lados, executando saveLogEntry de ponta a ponta
// com um supa/DOM controlados, não só verificando que a chamada aparece no texto da função.
function carregarSandboxSaveLogEntry(opts) {
  opts = opts || {};
  const updatesEquip = [];
  const insercoes = [];
  const chamadas = { manAbrirOS: 0, openDetail: 0, manPode: 0 };

  const campos = {
    'log-date': opts.date !== undefined ? opts.date : '2026-08-21',
    'log-tipo': opts.tipo !== undefined ? opts.tipo : 'PREVENTIVA',
    'log-status': opts.status !== undefined ? opts.status : 'CONCLUÍDA',
    'log-tec': opts.tecnico || '',
    'log-desc': opts.desc || '',
    // 260823-cf8: campos de executor — vazios por padrão (formulário sem
    // UNI_OK não os desenha, val() de um id inexistente já devolve '').
    'log-executor': opts.tipoExecutor !== undefined ? opts.tipoExecutor : '',
    'log-executor-setor': opts.executorSetor || '',
    'log-executor-pessoas': opts.executorPessoas || '',
    'log-executor-org': opts.executorOrg || '',
  };

  const ctx = {
    MAN_FLUXO_OK: !!opts.fluxoLigado,
    DATA: opts.data || [],
    // 260822-48m: o ponto de chamada real trocou window._modoObservador por
    // somenteLeitura() (D-48m-01) — troca de stub, a asserção continua
    // provando que este ponto honra o modo somente-leitura.
    somenteLeitura() { return !!opts.observador; },
    showToast(msg, tipo) { ctx._toasts.push({ msg, tipo }); },
    _toasts: [],
    console: { warn() {}, error() {} },
    today() { return '2026-08-21'; },
    val(id) { return campos[id] !== undefined ? campos[id] : ''; },
    el(id) {
      // clistLen=0 nos testes — o laço do checklist nunca entra, então el() não
      // precisa suportar querySelectorAll de verdade aqui.
      return { querySelectorAll() { return []; } };
    },
    manPode(acao) { chamadas.manPode++; return opts.podeAbrir !== false; },
    manAbrirOS(logId) { chamadas.manAbrirOS++; },
    openDetail(equipId) { chamadas.openDetail++; },
    renderDash() {},
    setTimeout() {}, // sandbox vm não tem timers de navegador/Node por padrão
    supa: {
      from(tabela) {
        if (tabela === 'equipamentos') {
          return {
            update(patch) {
              return {
                eq(col, val) {
                  updatesEquip.push({ patch, col, val });
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
    },
    addLogEntryAsync(equipId, entry) {
      const id = 'log-' + (insercoes.length + 1);
      insercoes.push({ id, equipId, entry });
      return Promise.resolve(id);
    },
  };
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── encerramento de OS: última manutenção ── */', 'async function saveLogEntry('), ctx);
  vm.runInContext(recorte('async function saveLogEntry(', 'async function delLog('), ctx);
  ctx._updatesEquip = updatesEquip;
  ctx._insercoes = insercoes;
  ctx._chamadas = chamadas;
  return ctx;
}

test('saveLogEntry com o fluxo desligado: grava status CONCLUÍDA e chama atualizarUltimaManutencao (comportamento de hoje, D-l7n-06)', async () => {
  const equip = { id: 40, ultimaManutencao: '' };
  const ctx = carregarSandboxSaveLogEntry({ fluxoLigado: false, status: 'CONCLUÍDA', data: [equip] });
  await ctx.saveLogEntry(40, 0);
  assert.strictEqual(ctx._insercoes.length, 1);
  assert.strictEqual(ctx._insercoes[0].entry.status, 'CONCLUÍDA');
  assert.strictEqual(ctx._updatesEquip.length, 1); // atualizarUltimaManutencao gravou
  assert.strictEqual(ctx._chamadas.openDetail, 1);
  assert.strictEqual(ctx._chamadas.manAbrirOS, 0);
});

test('saveLogEntry com o fluxo ligado: OS nasce ABERTA, status nunca lido do formulário, e NÃO grava última manutenção (D-l7n-11)', async () => {
  const equip = { id: 41, ultimaManutencao: '' };
  const ctx = carregarSandboxSaveLogEntry({ fluxoLigado: true, status: 'CONCLUÍDA', data: [equip] });
  await ctx.saveLogEntry(41, 0);
  assert.strictEqual(ctx._insercoes.length, 1);
  assert.strictEqual(ctx._insercoes[0].entry.status, 'ABERTA'); // status fixo, não o valor do select
  assert.strictEqual(ctx._updatesEquip.length, 0); // D-l7n-11: nada de última manutenção na abertura
  assert.strictEqual(ctx._chamadas.manAbrirOS, 1);
  assert.strictEqual(ctx._chamadas.openDetail, 0);
});

// 260823-cf8 (Task 2): o payload da abertura ganha tipoExecutor e os campos
// do tipo escolhido — sem seletor no DOM (formulário sem UNI_OK), cai em
// 'interna' pelo default de saveLogEntry, nunca undefined.
test('saveLogEntry com o fluxo ligado grava tipoExecutor no entry — externa com organização preenchida, e interna como default sem seletor', async () => {
  const comExterna = carregarSandboxSaveLogEntry({ fluxoLigado: true, data: [{ id: 41, ultimaManutencao: '' }], tipoExecutor: 'externa', executorOrg: 'Fulano Ltda' });
  await comExterna.saveLogEntry(41, 0);
  assert.strictEqual(comExterna._insercoes[0].entry.tipoExecutor, 'externa');
  assert.strictEqual(comExterna._insercoes[0].entry.executorOrg, 'Fulano Ltda');

  const semSeletor = carregarSandboxSaveLogEntry({ fluxoLigado: true, data: [{ id: 41, ultimaManutencao: '' }] });
  await semSeletor.saveLogEntry(41, 0);
  assert.strictEqual(semSeletor._insercoes[0].entry.tipoExecutor, 'interna');
});

test('saveLogEntry com o fluxo ligado recusa sem permissão para abrir', async () => {
  const ctx = carregarSandboxSaveLogEntry({ fluxoLigado: true, podeAbrir: false, data: [] });
  await ctx.saveLogEntry(41, 0);
  assert.strictEqual(ctx._insercoes.length, 0);
  assert.strictEqual(ctx._toasts.some((t) => t.tipo === 'error'), true);
});

test('ctCertificar chama ctEncerrarHistorico', () => {
  const corpo = recorte('async function ctCertificar(osId){', 'async function ctCancelar(');
  assert.match(corpo, /await ctEncerrarHistorico\(/);
});

test('os quatro grep do PLAT-15 continuam em 0', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
