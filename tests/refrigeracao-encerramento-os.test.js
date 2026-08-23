// Gate do encerramento de OS gravando equipamentos.ultima_manutencao (D-jpd-03)
// — quick 260821-jpd, Task 2.
//
// 260823-cf8 (Task 3, D-cf8-16/22): o bloco de histórico da contratação
// (ctMarcadorHistorico/ctDescricaoHistorico/ctJaTemHistorico/
// ctEncerrarHistorico) NÃO EXISTE MAIS neste arquivo — desaparece por
// construção, não por limpeza: a OS de contrato já nasce sendo a linha de
// logs_manutencao que ela antes espelhava, então não há mais o que
// espelhar de volta. manCertificar (o antigo ctCertificar) chama
// atualizarUltimaManutencao DIRETO, com a data da NF — os casos que
// provavam a idempotência do espelho e a leitura do prefixo da descrição
// aprendem o fato novo abaixo, em vez de desaparecer (D-cf8-28).

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

// 260823-cf8 (D-cf8-16/22, Task 3): os quatro casos acima testavam o
// espelho (ctMarcadorHistorico/ctJaTemHistorico/ctEncerrarHistorico) —
// nenhum dos três sobrevive. O fato novo é estrutural: nenhuma das quatro
// funções aparece mais no arquivo, e é a OS de contrato encerrada (via
// manCertificar) que passa a chamar atualizarUltimaManutencao DIRETO, sem
// inserir linha nenhuma — comportamento coberto por
// tests/refrigeracao-os-unificada.test.js (manCertificar).
test('ctMarcadorHistorico/ctDescricaoHistorico/ctJaTemHistorico/ctEncerrarHistorico não existem mais no arquivo (D-cf8-16/22)', () => {
  ['function ctMarcadorHistorico(', 'function ctDescricaoHistorico(', 'function ctJaTemHistorico(', 'async function ctEncerrarHistorico('].forEach((assinatura) => {
    assert.strictEqual(HTML.indexOf(assinatura), -1, `"${assinatura}" ainda está no arquivo — o espelho deveria ter desaparecido por construção`);
  });
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

// 260823-cf8 (Task 3, D-cf8-16/22): manCertificar substitui ctCertificar —
// nenhuma linha nova em logs_manutencao ao encerrar (a OS já É a linha),
// e atualizarUltimaManutencao é chamada DIRETO com a data da NF.
function carregarSandboxCertificar(opts) {
  opts = opts || {};
  const updatesLog = [];
  const updatesEquip = [];
  const insertsComentarios = [];
  const toasts = [];

  const linhaBase = { id: 'log-1', equip_id: opts.equipId !== undefined ? opts.equipId : 20, status: opts.status || 'FISCALIZADA' };

  const ctx = {
    esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    el(id) { return (ctx._campos && ctx._campos[id]) || { querySelectorAll() { return []; } }; },
    val(id) { return (ctx._valores && ctx._valores[id] !== undefined) ? ctx._valores[id] : ''; },
    _valores: opts.valores || { 'cf-nf': '555', 'cf-datanf': '2026-08-23' },
    somenteLeitura() { return !!opts.observador; },
    ctUser: opts.ctUser !== undefined ? opts.ctUser : { nome: 'Certificador', role: 'gestor' },
    DATA: opts.data || [{ id: opts.equipId !== undefined ? opts.equipId : 20, ultimaManutencao: '' }],
    showToast(msg, tipo) { toasts.push({ msg, tipo }); },
    console: { warn() {}, error() {} },
    today() { return '2026-08-23'; },
    fmtDate(iso) { return iso || ''; },
    confirm() { return true; },
    openDrawer() {}, closeDrawer() {},
    osEhMovimentacao() { return false; },
    ctComp: opts.ctComp !== undefined ? opts.ctComp : { 'log-1': [{ id: 'c1', os_id: 'log-1', item_arp: 266, qtd: 2 }] },
    supa: {
      from(tabela) {
        if (tabela === 'logs_manutencao') {
          return { update(patch) { return { eq(col, val) { return { select() { return { single() { updatesLog.push({ id: val, patch }); return Promise.resolve({ error: null, data: Object.assign({}, linhaBase, patch) }); } }; } }; } }; } };
        }
        if (tabela === 'equipamentos') {
          return { update(patch) { return { eq(col, val) { updatesEquip.push({ patch, col, val }); return Promise.resolve({ error: null }); } }; } };
        }
        if (tabela === 'os_comentarios') {
          return { insert(payload) { return { select() { return { single() { const linha = Object.assign({ id: 'com-' + (insertsComentarios.length + 1), criado_em: '2026-08-23T12:00:00Z' }, payload); insertsComentarios.push(linha); return Promise.resolve({ error: null, data: linha }); } }; } }; } };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
    },
  };
  ctx._logCache = {};
  ctx._logCache[linhaBase.equip_id] = [Object.assign({ id: linhaBase.id, status: linhaBase.status, tipoExecutor: 'contrato' }, opts.entryExtra || {})];
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: porta de escrita ── */', '/* ── REALTIME ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
  vm.runInContext(recorte('/* ── encerramento de OS: última manutenção ── */', 'async function saveLogEntry('), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: tela e ações ── */', 'function showSearch(){'), ctx);
  // 260823-cf8: UNI_OK é "var" dentro da porta de escrita — setado DEPOIS
  // dos runInContext, senão a própria declaração sobrescreve para false.
  ctx.UNI_OK = true;
  ctx.manAbrirOS = function () {};
  ctx.renderOS = function () {};
  ctx._updatesLog = updatesLog;
  ctx._updatesEquip = updatesEquip;
  ctx._insertsComentarios = insertsComentarios;
  ctx._toasts = toasts;
  return ctx;
}

test('manCertificar exige NF e composição não vazia, grava ENCERRADA, e chama atualizarUltimaManutencao com a data da NF — sem inserir linha nova (D-cf8-16)', async () => {
  const semComp = carregarSandboxCertificar({ ctComp: {} });
  await semComp.manCertificar('log-1');
  assert.strictEqual(semComp._updatesLog.length, 0);
  assert.ok(semComp._toasts.some((t) => t.tipo === 'error'));

  const ctx = carregarSandboxCertificar({});
  const ok = await ctx.manCertificar('log-1');
  assert.strictEqual(ok !== false, true);
  assert.strictEqual(ctx._updatesLog.length, 1);
  assert.strictEqual(ctx._updatesLog[0].patch.status, 'ENCERRADA');
  assert.strictEqual(ctx._updatesLog[0].patch.nf, '555');
  assert.strictEqual(ctx._updatesEquip.length, 1);
  assert.strictEqual(ctx._updatesEquip[0].patch.ultima_manutencao, '2026-08-23'); // a data da NF, D-l7n-11
});

test('os quatro grep do PLAT-15 continuam em 0', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
