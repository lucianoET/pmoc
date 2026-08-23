// Gate da quick-260821-uyz — Task 2: o terceiro segmento e o formulário
// das duas OS (Instalação/Remoção), com os três casos de instalação
// derivados do dado (D-uyz-03), nunca digitados.
//
// Mesmo padrão de recorte + sandbox node:vm dos gates anteriores. O bloco
// `/* ── movimentação: instalação e remoção ── */` roda em cima do bloco
// que declara MAINT_TIPOS/CHECKLIST (checklistDaOS cai para a tabela de
// manutenção fora de INSTALAÇÃO/REMOÇÃO). Objetos criados DENTRO do
// sandbox têm Object.prototype de outro realm — comparações sempre campo
// a campo ou por strictEqual de primitivo.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const SQL_04 = fs.readFileSync(path.join(RAIZ, 'supabase', '04_refrigeracao_schema.sql'), 'utf8');
const SQL_40 = fs.readFileSync(path.join(RAIZ, 'supabase', '40_refrigeracao_os_fluxo.sql'), 'utf8');
const SQL_41 = fs.readFileSync(path.join(RAIZ, 'supabase', '41_refrigeracao_ficha_estado.sql'), 'utf8');
const SQL_42 = fs.readFileSync(path.join(RAIZ, 'supabase', '42_refrigeracao_movimentacao.sql'), 'utf8');
// 260823-cf8 (Task 1): a migração 43 acrescenta 18 colunas de OS unificada
// por tipo de executor em logs_manutencao — sem somá-la aqui este gate
// voltaria a afirmar que a união das migrações é a verdade, quando não
// seria mais (mesmo raciocínio já registrado para a 42 em 260821-uyz).
const SQL_43 = fs.readFileSync(path.join(RAIZ, 'supabase', '43_refrigeracao_os_unificada.sql'), 'utf8');

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

function carregarNucleoMovimentacao() {
  const ctx = { esc(s) { return s == null ? '' : String(s); } };
  vm.createContext(ctx);
  // MAINT_TIPOS + CHECKLIST (checklistDaOS recua para CHECKLIST fora de mov.)
  vm.runInContext(recorte('var MAINT_TIPOS =', 'var CRIT_COLORS ='), ctx);
  // vocabulário de movimentação + carga de locais + formulário/gravação
  vm.runInContext(
    recorte('/* ── movimentação: instalação e remoção ── */', '/* ── fluxo da OS interna: tela e ações ── */'),
    ctx
  );
  return ctx;
}

// ── 1. casoDeInstalacao — os três casos, na ordem exata ──────────────────
test('casoDeInstalacao devolve "substituicao" sempre que há máquina substituída, mesmo com o destino já ocupado', () => {
  const ctx = carregarNucleoMovimentacao();
  assert.strictEqual(ctx.casoDeInstalacao(10, 99, 5), 'substituicao');
  assert.strictEqual(ctx.casoDeInstalacao(10, 99, 0), 'substituicao');
});

test('casoDeInstalacao devolve "adicional" quando o destino já tem ao menos um equipamento instalado e não há substituída', () => {
  const ctx = carregarNucleoMovimentacao();
  assert.strictEqual(ctx.casoDeInstalacao(10, null, 1), 'adicional');
  assert.strictEqual(ctx.casoDeInstalacao(10, undefined, 3), 'adicional');
});

test('casoDeInstalacao devolve "novo-local" quando o destino está vazio e não há substituída', () => {
  const ctx = carregarNucleoMovimentacao();
  assert.strictEqual(ctx.casoDeInstalacao(10, null, 0), 'novo-local');
  assert.strictEqual(ctx.casoDeInstalacao(10, '', 0), 'novo-local');
});

// ── 2. osEhMovimentacao ───────────────────────────────────────────────────
test('osEhMovimentacao é verdadeiro só para INSTALAÇÃO e REMOÇÃO, e falso para os sete tipos de manutenção', () => {
  const ctx = carregarNucleoMovimentacao();
  assert.strictEqual(ctx.osEhMovimentacao({ tipo: 'INSTALAÇÃO' }), true);
  assert.strictEqual(ctx.osEhMovimentacao({ tipo: 'REMOÇÃO' }), true);
  ctx.MAINT_TIPOS.forEach((t) => {
    assert.strictEqual(ctx.osEhMovimentacao({ tipo: t }), false, `${t} não deveria ser movimentação`);
  });
  assert.strictEqual(ctx.osEhMovimentacao({}), false);
  assert.strictEqual(ctx.osEhMovimentacao(null), false);
});

// ── 3. checklistDaOS ───────────────────────────────────────────────────────
test('checklistDaOS devolve a lista de partes na remoção, a de instalação na instalação, e a de manutenção em qualquer outro tipo', () => {
  const ctx = carregarNucleoMovimentacao();
  const remocao = ctx.checklistDaOS('REMOÇÃO', 'SPLIT');
  const instalacao = ctx.checklistDaOS('INSTALAÇÃO', 'SPLIT');
  const manutencao = ctx.checklistDaOS('CORRETIVA', 'SPLIT');
  assert.deepStrictEqual(remocao, ctx.CHECKLIST_REMOCAO.SPLIT);
  assert.deepStrictEqual(instalacao, ctx.CHECKLIST_INSTALACAO.SPLIT);
  assert.deepStrictEqual(manutencao, ctx.CHECKLIST.SPLIT);
  assert.notDeepStrictEqual(remocao, instalacao);
  assert.notDeepStrictEqual(remocao, manutencao);
});

test('checklistDaOS recua para SPLIT num tipo de equipamento desconhecido, nos três casos', () => {
  const ctx = carregarNucleoMovimentacao();
  assert.deepStrictEqual(ctx.checklistDaOS('REMOÇÃO', 'INVENTADO'), ctx.CHECKLIST_REMOCAO.SPLIT);
  assert.deepStrictEqual(ctx.checklistDaOS('INSTALAÇÃO', 'INVENTADO'), ctx.CHECKLIST_INSTALACAO.SPLIT);
  assert.deepStrictEqual(ctx.checklistDaOS('CORRETIVA', 'INVENTADO'), ctx.CHECKLIST.SPLIT);
});

test('checklistDaOS de JANELA na remoção não menciona condensadora nem linha frigorígena — é bloco único', () => {
  const ctx = carregarNucleoMovimentacao();
  const janela = ctx.checklistDaOS('REMOÇÃO', 'JANELA').join(' ').toLowerCase();
  assert.doesNotMatch(janela, /condensadora/);
  assert.doesNotMatch(janela, /linha frigor[ií]gena/);
});

// ── 4. MOV_TIPOS disjunto de MAINT_TIPOS ──────────────────────────────────
test('MOV_TIPOS não aparece em MAINT_TIPOS, nos dois sentidos', () => {
  const ctx = carregarNucleoMovimentacao();
  ctx.MOV_TIPOS.forEach((t) => assert.strictEqual(ctx.MAINT_TIPOS.indexOf(t), -1, `${t} não deveria estar em MAINT_TIPOS`));
  ctx.MAINT_TIPOS.forEach((t) => assert.strictEqual(ctx.MOV_TIPOS.indexOf(t), -1, `${t} não deveria estar em MOV_TIPOS`));
});

// ── 5. rotuloLocalDestino ─────────────────────────────────────────────────
test('rotuloLocalDestino devolve "PRÉDIO / SALA" quando o nó tem pai, e só o nome quando é a própria edificação', () => {
  const ctx = carregarNucleoMovimentacao();
  const porId = {
    100: { id: 100, nome: 'F21', tipo: 'edificacao', parent_id: null },
    200: { id: 200, nome: 'Sala 3', tipo: 'sala', parent_id: 100 },
  };
  const comPai = ctx.rotuloLocalDestino(200, porId);
  assert.strictEqual(comPai.predio, 'F21');
  assert.strictEqual(comPai.local, 'Sala 3');
  assert.strictEqual(comPai.rotulo, 'F21 / Sala 3');

  const semPai = ctx.rotuloLocalDestino(100, porId);
  assert.strictEqual(semPai.predio, 'F21');
  assert.strictEqual(semPai.local, 'F21');
  assert.strictEqual(semPai.rotulo, 'F21');
});

test('rotuloLocalDestino devolve null quando o id não está no índice', () => {
  const ctx = carregarNucleoMovimentacao();
  assert.strictEqual(ctx.rotuloLocalDestino(999, { 100: { id: 100, nome: 'X', parent_id: null } }), null);
  assert.strictEqual(ctx.rotuloLocalDestino(null, {}), null);
});

test('rotuloLocalDestino não entra em laço infinito quando parent_id aponta para o próprio nó', () => {
  const ctx = carregarNucleoMovimentacao();
  const porId = { 5: { id: 5, nome: 'Ciclo', tipo: 'sala', parent_id: 5 } };
  let resultado;
  assert.doesNotThrow(() => { resultado = ctx.rotuloLocalDestino(5, porId); });
  assert.strictEqual(resultado.predio, 'Ciclo');
  assert.strictEqual(resultado.local, 'Ciclo');
});

test('rotuloLocalDestino não entra em laço infinito num ciclo de dois nós (A→B→A)', () => {
  const ctx = carregarNucleoMovimentacao();
  const porId = {
    1: { id: 1, nome: 'A', parent_id: 2 },
    2: { id: 2, nome: 'B', parent_id: 1 },
  };
  let resultado;
  assert.doesNotThrow(() => { resultado = ctx.rotuloLocalDestino(1, porId); });
  assert.ok(resultado);
});

// ── 6. movSondarEsquema (sonda própria, D-uyz-13) ─────────────────────────
function carregarPortaEscrita() {
  const ctx = {
    supa: {
      from() {
        return { select() { return { limit() { return Promise.resolve({ error: { message: 'coluna inexistente' } }); } }; } };
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(
    recorte('/* ── fluxo da OS interna: porta de escrita ── */', '// carregarPerfil só é CHAMADA'),
    ctx
  );
  return ctx;
}

test('movSondarEsquema deixa MOV_OK falso quando o select erra, sem lançar', async () => {
  const ctx = carregarPortaEscrita();
  assert.strictEqual(ctx.MOV_OK, false);
  let resultado;
  await assert.doesNotReject(async () => { resultado = await ctx.movSondarEsquema(); });
  assert.strictEqual(resultado, false);
  assert.strictEqual(ctx.MOV_OK, false);
});

test('movSondarEsquema não altera MAN_FLUXO_OK — são duas sondas separadas (D-uyz-13)', () => {
  const corpo = recorte('/* ── fluxo da OS interna: porta de escrita ── */', '// carregarPerfil só é CHAMADA');
  const posManSonda = corpo.indexOf('async function manSondarEsquema()');
  const posMovVar = corpo.indexOf('var MOV_OK');
  const posMovSonda = corpo.indexOf('async function movSondarEsquema()');
  assert.ok(posManSonda >= 0 && posMovVar > posManSonda && posMovSonda > posMovVar, 'MOV_OK/movSondarEsquema deveriam vir depois de manSondarEsquema, sem alterá-la');
  // manSondarEsquema não pode ter sido estendida para pedir colunas da 42
  const corpoManSonda = corpo.slice(posManSonda, corpo.indexOf('\n}', posManSonda));
  assert.doesNotMatch(corpoManSonda, /local_destino_id|destino_remocao/, 'manSondarEsquema não pode pedir colunas da migração 42 — regressão do fluxo de hoje (D-uyz-13)');
});

// ── 7. renderOS exclui movimentação; renderMovim exclui manutenção ───────
test('o corpo de renderOS filtra fora osEhMovimentacao(o.entry)', () => {
  const ini = HTML.indexOf('function renderOS(){');
  const fim = HTML.indexOf('function openNewOS(){', ini);
  assert.ok(ini > 0 && fim > ini, 'renderOS não encontrada');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /osEhMovimentacao\(o\.entry\)/);
});

test('o corpo de renderMovim exige osEhMovimentacao(o.entry) — nenhuma OS de manutenção aparece nela', () => {
  const ini = HTML.indexOf('function renderMovim(){');
  const fim = HTML.indexOf('function openNewOS(){', ini);
  assert.ok(ini > 0 && fim > ini, 'renderMovim não encontrada');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /osEhMovimentacao\(o\.entry\)/);
});

// ── 8. o terceiro segmento só entra sob MAN_FLUXO_OK && MOV_OK ────────────
test('ctInjectToggle só injeta o terceiro botão (#seg-movim) sob MAN_FLUXO_OK && MOV_OK', () => {
  const ini = HTML.indexOf('function ctInjectToggle(){');
  const fim = HTML.indexOf('async function ctSetMode(', ini);
  assert.ok(ini > 0 && fim > ini, 'ctInjectToggle não encontrada');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /MAN_FLUXO_OK\s*&&\s*MOV_OK/);
  assert.match(corpo, /seg-movim/);
});

test('a regra .seg-toggle.tres existe no CSS embutido', () => {
  assert.match(HTML, /\.seg-toggle\.tres\s+\.seg-btn\s*\{/);
});

// ── 9. salvarMovOS grava 'ABERTA' fixo e nunca lê campo de status ─────────
test('o corpo de salvarMovOS grava status:\'ABERTA\' fixo e não lê nenhum campo de status do formulário', () => {
  const ini = HTML.indexOf('async function salvarMovOS(){');
  const fim = HTML.indexOf('\n}\n\n/* ── fluxo da OS interna: tela e ações ── */', ini);
  assert.ok(ini > 0, 'salvarMovOS não encontrada');
  const corpo = HTML.slice(ini, fim > 0 ? fim : ini + 4000);
  assert.match(corpo, /status:\s*'ABERTA'/);
  assert.doesNotMatch(corpo, /val\('mov-status'\)/);
});

// ── 10. estrutural: colunas da migração 42 em CAMPOS_LOG (união 04+40+41+42) ──
function colunasAddColumn(sql, tabela) {
  const re = new RegExp(`alter table ${tabela}\\s+add column if not exists (\\w+)`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(sql))) out.push(m[1]);
  return out;
}
function colunasCreateTable04(tabela) {
  const ini = SQL_04.indexOf(`create table if not exists ${tabela}`);
  const abre = SQL_04.indexOf('(', ini);
  const fim = SQL_04.indexOf(');', ini);
  const corpo = SQL_04.slice(abre + 1, fim);
  const segmentos = [];
  let atual = '', prof = 0;
  for (const ch of corpo) {
    if (ch === '(') prof++;
    if (ch === ')') prof--;
    if (ch === ',' && prof === 0) { segmentos.push(atual); atual = ''; }
    else atual += ch;
  }
  if (atual.trim()) segmentos.push(atual);
  const nomes = [];
  segmentos.forEach((seg) => {
    const m = seg.trim().match(/^([a-z_][a-z0-9_]*)\s+/i);
    if (m) nomes.push(m[1]);
  });
  return nomes;
}

function carregarPonteLog() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  return ctx;
}

test('toda coluna criada pela migração 42 em logs_manutencao aparece como valor em CAMPOS_LOG', () => {
  const ctx = carregarPonteLog();
  const novas42 = colunasAddColumn(SQL_42, 'logs_manutencao');
  assert.deepStrictEqual(novas42.sort(), ['destino_remocao', 'equip_substituido_id', 'local_destino_id', 'local_origem_id'].sort());
  const valores = Object.values(ctx.CAMPOS_LOG);
  novas42.forEach((col) => assert.ok(valores.includes(col), `${col} (migração 42) não está em CAMPOS_LOG`));
});

test('todo valor de CAMPOS_LOG é coluna real de logs_manutencao (união 04+40+41+42+43)', () => {
  const ctx = carregarPonteLog();
  const reais = colunasCreateTable04('logs_manutencao')
    .concat(colunasAddColumn(SQL_40, 'logs_manutencao'))
    .concat(colunasAddColumn(SQL_41, 'logs_manutencao'))
    .concat(colunasAddColumn(SQL_42, 'logs_manutencao'))
    .concat(colunasAddColumn(SQL_43, 'logs_manutencao'));
  Object.entries(ctx.CAMPOS_LOG).forEach(([k, col]) => {
    assert.ok(reais.includes(col), `CAMPOS_LOG.${k} = "${col}" não é coluna real de logs_manutencao`);
  });
});

// ── 11. os quatro grep do PLAT-15 continuam em 0 ──────────────────────────
test('os quatro grep do PLAT-15 continuam em 0 em refrigeracao/index.html', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});

// ══════════════════════════════════════════════════════════════════
// Task 3 — a conferência aplicando cadastro, local e situação, com a
// baixa gateada em admin. aplicarInstalacao/aplicarRemocao são
// CONVERGENTES e IDEMPOTENTES (D-uyz-15) — um único .update( cada,
// nenhuma escrita quando o alvo já bate com o estado atual.
// ══════════════════════════════════════════════════════════════════

function carregarAplicacao(opts) {
  opts = opts || {};
  const patchesEquip = [];
  const updatesLog = [];
  const toasts = [];
  const chamadas = { manAbrirOS: 0, renderOS: 0, renderMovim: 0 };

  const linhaBase = Object.assign({
    id: 'log-1', equip_id: opts.equipId !== undefined ? opts.equipId : 10,
    data_os: opts.date || '2026-08-21', status: opts.status || 'EXECUTADA',
    tipo: opts.tipoOS || 'INSTALAÇÃO',
  }, opts.linhaExtra || {});

  const ctx = {
    esc(s) { return s == null ? '' : String(s); },
    el(id) { return (ctx._campos && ctx._campos[id]) || null; },
    val(id) { return (ctx._valores && ctx._valores[id] !== undefined) ? ctx._valores[id] : ''; },
    _valores: opts.valores || {},
    _campos: opts.campos || {},
    // 260822-48m: o ponto de chamada real trocou window._modoObservador por
    // somenteLeitura() (D-48m-01) — troca de stub, a asserção continua
    // provando que este ponto honra o modo somente-leitura.
    somenteLeitura() { return !!opts.observador; },
    ctUser: opts.ctUser !== undefined ? opts.ctUser : { nome: 'Gestora', role: 'gestor' },
    DATA: opts.data || [],
    showToast(msg, tipo) { toasts.push({ msg, tipo }); },
    console: { warn() {}, error() {} },
    today() { return '2026-08-21'; },
    fmtDate(iso) { return iso || ''; },
    supa: {
      from(tabela) {
        if (tabela === 'equipamentos') {
          return {
            update(patch) {
              return {
                eq(col, val) {
                  if (opts.erroUpdateEquip) return Promise.resolve({ error: { message: 'falhou equipamento' } });
                  patchesEquip.push({ id: val, patch: patch });
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }
        if (tabela === 'logs_manutencao') {
          return {
            update(patch) {
              return {
                eq(col, val) {
                  return {
                    select() {
                      return {
                        single() {
                          if (opts.erroUpdateLog) return Promise.resolve({ error: { message: 'falhou log' } });
                          updatesLog.push({ id: val, patch: patch });
                          return Promise.resolve({ error: null, data: Object.assign({}, linhaBase, patch) });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
    },
  };
  ctx._logCache = {};
  ctx._logCache[linhaBase.equip_id] = [Object.assign(
    { id: linhaBase.id, status: linhaBase.status, date: linhaBase.data_os, tipo: linhaBase.tipo, checklist: [] },
    opts.entryExtra || {}
  )];

  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── situação patrimonial do equipamento: instalado/removido/baixado ── */', '/* ── alertas: contagem única ── */'), ctx);
  vm.runInContext(recorte('function podeDarBaixa()', '/* ── ponte de campos de logs_manutencao ── */'), ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: porta de escrita ── */', '/* ── REALTIME ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
  vm.runInContext(recorte('/* ── movimentação: instalação e remoção ── */', '/* ── fluxo da OS interna: tela e ações ── */'), ctx);
  vm.runInContext(recorte('/* ── encerramento de OS: última manutenção ── */', 'async function saveLogEntry('), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: tela e ações ── */', 'function showSearch(){'), ctx);

  // Overrides pós-carga — os `var` de nível superior já rodaram, então isto
  // sobrescreve o estado inicial (LOCAIS_POR_ID vazio, LOCAIS_CARREGADOS
  // falso, UNI_OK falso) com a fixture do teste. UNI_OK é "var" dentro da
  // porta de escrita — setado DEPOIS dos runInContext, senão a própria
  // declaração ("var UNI_OK = false") sobrescreveria de volta (mesmo
  // cuidado já registrado em tests/refrigeracao-os-unificada.test.js).
  ctx.UNI_OK = opts.uniOk !== undefined ? opts.uniOk : false;
  ctx.LOCAIS_POR_ID = opts.locaisPorId || {};
  ctx.LOCAIS_CARREGADOS = opts.locaisCarregados !== undefined ? opts.locaisCarregados : true;
  ctx.carregarLocais = async function () { ctx.LOCAIS_CARREGADOS = true; };

  ctx.manAbrirOS = function () { chamadas.manAbrirOS++; };
  ctx.renderOS = function () { chamadas.renderOS++; };
  ctx.renderMovim = function () { chamadas.renderMovim++; };

  ctx._patchesEquip = patchesEquip;
  ctx._updatesLog = updatesLog;
  ctx._toasts = toasts;
  ctx._chamadas = chamadas;
  return ctx;
}

// ── aplicarInstalacao ────────────────────────────────────────────────────
test('aplicarInstalacao grava local_id, predio, local, data_instalacao (a data da OS) e situacao instalado, num único update', async () => {
  const ctx = carregarAplicacao({
    data: [{ id: 10, localId: null, predio: null, local: null, dataInstalacao: '', situacao: 'removido' }],
    locaisPorId: { 5: { id: 5, nome: 'Sala 3', parent_id: 100 }, 100: { id: 100, nome: 'F21', parent_id: null } },
  });
  const ok = await ctx.aplicarInstalacao(10, { date: '2026-08-21', localDestinoId: 5 });
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx._patchesEquip.length, 1);
  const patch = ctx._patchesEquip[0].patch;
  assert.strictEqual(patch.local_id, 5);
  assert.strictEqual(patch.predio, 'F21');
  assert.strictEqual(patch.local, 'Sala 3');
  assert.strictEqual(patch.data_instalacao, '2026-08-21');
  assert.strictEqual(patch.situacao, 'instalado');
});

test('aplicarInstalacao não escreve nada quando o equipamento já está exatamente no estado-alvo — conferir duas vezes não grava duas vezes', async () => {
  const ctx = carregarAplicacao({
    data: [{ id: 10, localId: 5, predio: 'F21', local: 'Sala 3', dataInstalacao: '2026-08-21', situacao: 'instalado' }],
    locaisPorId: { 5: { id: 5, nome: 'Sala 3', parent_id: 100 }, 100: { id: 100, nome: 'F21', parent_id: null } },
  });
  const ok = await ctx.aplicarInstalacao(10, { date: '2026-08-21', localDestinoId: 5 });
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx._patchesEquip.length, 0);
});

test('aplicarInstalacao recusa quando o destino não resolve na árvore de locais, sem gravar nada', async () => {
  const ctx = carregarAplicacao({
    data: [{ id: 10, situacao: 'removido' }],
    locaisPorId: {},
  });
  const ok = await ctx.aplicarInstalacao(10, { date: '2026-08-21', localDestinoId: 999 });
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx._patchesEquip.length, 0);
  assert.ok(ctx._toasts.some((t) => t.tipo === 'error'));
});

test('aplicarInstalacao recusa máquina baixada', async () => {
  const ctx = carregarAplicacao({
    data: [{ id: 10, situacao: 'baixado' }],
    locaisPorId: { 5: { id: 5, nome: 'Sala 3', parent_id: null } },
  });
  const ok = await ctx.aplicarInstalacao(10, { date: '2026-08-21', localDestinoId: 5 });
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx._patchesEquip.length, 0);
});

test('aplicarInstalacao recusa quando a máquina substituída ainda está instalada, e a mensagem nomeia a OS de remoção que falta', async () => {
  const ctx = carregarAplicacao({
    data: [
      { id: 10, situacao: 'removido' },
      { id: 20, situacao: 'instalado' },
    ],
    locaisPorId: { 5: { id: 5, nome: 'Sala 3', parent_id: null } },
  });
  const ok = await ctx.aplicarInstalacao(10, { date: '2026-08-21', localDestinoId: 5, equipSubstituidoId: 20 });
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx._patchesEquip.length, 0);
  assert.ok(ctx._toasts.some((t) => t.tipo === 'error' && String(t.msg).includes('20')));
});

// ── aplicarRemocao ───────────────────────────────────────────────────────
test('aplicarRemocao limpa local_id, predio, local, lat e lon, grava data_remocao com a data da OS e situacao removido', async () => {
  const ctx = carregarAplicacao({
    data: [{ id: 10, localId: 5, predio: 'F21', local: 'Sala 3', lat: -22.9, lon: -43.1, dataRemocao: '', situacao: 'instalado', funciona: 'OP' }],
  });
  const ok = await ctx.aplicarRemocao(10, { date: '2026-08-21', destinoRemocao: 'guardada' });
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx._patchesEquip.length, 1);
  const patch = ctx._patchesEquip[0].patch;
  assert.strictEqual(patch.local_id, null);
  assert.strictEqual(patch.predio, null);
  assert.strictEqual(patch.local, null);
  assert.strictEqual(patch.lat, null);
  assert.strictEqual(patch.lon, null);
  assert.strictEqual(patch.data_remocao, '2026-08-21');
  assert.strictEqual(patch.situacao, 'removido');
  assert.strictEqual('funciona' in patch, false); // D-uyz-20: situacao e funciona são eixos ortogonais
});

test('aplicarRemocao não escreve nada quando o equipamento já está exatamente no estado-alvo', async () => {
  const ctx = carregarAplicacao({
    data: [{ id: 10, localId: null, predio: null, local: null, lat: null, lon: null, dataRemocao: '2026-08-21', situacao: 'removido' }],
  });
  const ok = await ctx.aplicarRemocao(10, { date: '2026-08-21', destinoRemocao: 'guardada' });
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx._patchesEquip.length, 0);
});

test('aplicarRemocao com destino baixa grava situacao baixado e data_baixa, e o patch não contém funciona', async () => {
  const ctx = carregarAplicacao({
    ctUser: { nome: 'Admin', role: 'admin' },
    data: [{ id: 10, situacao: 'instalado', funciona: 'OP' }],
  });
  const ok = await ctx.aplicarRemocao(10, { date: '2026-08-21', destinoRemocao: 'baixa' });
  assert.strictEqual(ok, true);
  const patch = ctx._patchesEquip[0].patch;
  assert.strictEqual(patch.situacao, 'baixado');
  assert.strictEqual(patch.data_baixa, '2026-08-21');
  assert.strictEqual('funciona' in patch, false);
});

test('aplicarRemocao recusa o destino baixa para gestor e para técnico, e aceita para admin', async () => {
  for (const role of ['gestor', 'tecnico']) {
    const ctx = carregarAplicacao({ ctUser: { nome: 'X', role: role }, data: [{ id: 10, situacao: 'instalado' }] });
    const ok = await ctx.aplicarRemocao(10, { date: '2026-08-21', destinoRemocao: 'baixa' });
    assert.strictEqual(ok, false, role + ' não deveria conseguir dar baixa');
    assert.strictEqual(ctx._patchesEquip.length, 0);
  }
  const ctxAdmin = carregarAplicacao({ ctUser: { nome: 'Y', role: 'admin' }, data: [{ id: 10, situacao: 'instalado' }] });
  const okAdmin = await ctxAdmin.aplicarRemocao(10, { date: '2026-08-21', destinoRemocao: 'baixa' });
  assert.strictEqual(okAdmin, true);
});

test('aplicarRemocao recusa destino fora da lista fechada, sem gravar nada', async () => {
  const ctx = carregarAplicacao({ data: [{ id: 10, situacao: 'instalado' }] });
  const ok = await ctx.aplicarRemocao(10, { date: '2026-08-21', destinoRemocao: 'sucata' });
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx._patchesEquip.length, 0);
});

// ── manConferir de movimentação — cadastro ANTES do status terminal ──────
test('manConferir de uma OS de instalação chama aplicarInstalacao ANTES de gravar o status CONFERIDA', async () => {
  const ctx = carregarAplicacao({
    tipoOS: 'INSTALAÇÃO', status: 'EXECUTADA', equipId: 10,
    data: [{ id: 10, situacao: 'removido' }],
    locaisPorId: { 5: { id: 5, nome: 'Sala 3', parent_id: null } },
    entryExtra: { localDestinoId: 5, checklist: [{ i: 0, label: 'x', done: true }] },
  });
  await ctx.manConferir('log-1', true);
  assert.strictEqual(ctx._patchesEquip.length, 1, 'aplicarInstalacao deveria ter escrito em equipamentos');
  assert.strictEqual(ctx._updatesLog.length, 1, 'o status deveria ter avançado para CONFERIDA');
  assert.strictEqual(ctx._updatesLog[0].patch.status, 'CONFERIDA');
});

test('manConferir de movimentação com aplicarInstalacao falhando (destino não resolve) NÃO chama a porta de escrita do status', async () => {
  const ctx = carregarAplicacao({
    tipoOS: 'INSTALAÇÃO', status: 'EXECUTADA', equipId: 10,
    data: [{ id: 10, situacao: 'removido' }],
    locaisPorId: {}, // destino não resolve
    entryExtra: { localDestinoId: 999 },
  });
  await ctx.manConferir('log-1', true);
  assert.strictEqual(ctx._patchesEquip.length, 0);
  assert.strictEqual(ctx._updatesLog.length, 0, 'status não pode ter avançado quando o cadastro falhou');
});

test('manConferir de uma remoção com destinoRemocao "baixa" recusa para gestor — não escreve nem cadastro nem status', async () => {
  const ctx = carregarAplicacao({
    tipoOS: 'REMOÇÃO', status: 'EXECUTADA', equipId: 10,
    ctUser: { nome: 'Gestora', role: 'gestor' },
    data: [{ id: 10, situacao: 'instalado' }],
    entryExtra: { destinoRemocao: 'baixa', checklist: [{ i: 0, label: 'x', done: true }] },
  });
  await ctx.manConferir('log-1', true);
  assert.strictEqual(ctx._patchesEquip.length, 0);
  assert.strictEqual(ctx._updatesLog.length, 0);
  assert.ok(ctx._toasts.some((t) => t.tipo === 'error'));
});

test('manConferir de uma remoção com destinoRemocao "baixa" e cargo admin aplica a baixa e confere', async () => {
  const ctx = carregarAplicacao({
    tipoOS: 'REMOÇÃO', status: 'EXECUTADA', equipId: 10,
    ctUser: { nome: 'Admin', role: 'admin' },
    data: [{ id: 10, situacao: 'instalado' }],
    entryExtra: { destinoRemocao: 'baixa', checklist: [{ i: 0, label: 'x', done: true }] },
  });
  await ctx.manConferir('log-1', true);
  assert.strictEqual(ctx._patchesEquip.length, 1);
  assert.strictEqual(ctx._patchesEquip[0].patch.situacao, 'baixado');
  assert.strictEqual(ctx._updatesLog.length, 1);
  assert.strictEqual(ctx._updatesLog[0].patch.status, 'CONFERIDA');
});

// ── correção pós-dispatch: o terminal da conferência de movimentação é
// derivado do fluxo da OS, nunca o literal fixo CONFERIDA (D-uyz-15 +
// D-cf8-29). Uma OS de movimentação nasce tipo_executor='interna'
// (default) — sem a migração 43 (UNI_OK falso) ela resolve para o fluxo
// legado e confere para CONFERIDA, exatamente como hoje; COM a migração
// (UNI_OK verdadeiro) ela resolve para FLUXO_PROPRIO e confere para
// CONCLUIDA. Os dois lados no mesmo teste — é a diferença entre eles que
// é a regra: sem isso, a conferência (o ÚNICO momento em que a
// instalação/remoção aplica local/data_instalacao/situacao) pararia de
// existir no minuto em que a migração 43 fosse aplicada.
test('a conferência de uma OS de instalação aplica o cadastro e avança para o terminal certo — CONFERIDA sem UNI_OK, CONCLUIDA com UNI_OK', async () => {
  const semMigracao = carregarAplicacao({
    uniOk: false,
    tipoOS: 'INSTALAÇÃO', status: 'EXECUTADA', equipId: 10,
    data: [{ id: 10, situacao: 'removido' }],
    locaisPorId: { 5: { id: 5, nome: 'Sala 3', parent_id: null } },
    entryExtra: { localDestinoId: 5, checklist: [{ i: 0, label: 'x', done: true }], tipoExecutor: 'interna' },
  });
  await semMigracao.manConferir('log-1', true);
  assert.strictEqual(semMigracao._patchesEquip.length, 1, 'o cadastro (local/data_instalacao/situacao) deveria ter sido aplicado');
  assert.strictEqual(semMigracao._updatesLog.length, 1);
  assert.strictEqual(semMigracao._updatesLog[0].patch.status, 'CONFERIDA');

  const comMigracao = carregarAplicacao({
    uniOk: true,
    // Com UNI_OK verdadeiro a OS de movimentação resolve para FLUXO_PROPRIO
    // (osFluxoDe é genérico, sem caso especial para movimentação) — esse
    // fluxo não tem a etapa EXECUTADA, então a transição válida antes do
    // terminal é EM_EXECUCAO, não EXECUTADA (essa é a diferença de fluxo
    // que o teste existe para provar).
    tipoOS: 'INSTALAÇÃO', status: 'EM_EXECUCAO', equipId: 10,
    data: [{ id: 10, situacao: 'removido' }],
    locaisPorId: { 5: { id: 5, nome: 'Sala 3', parent_id: null } },
    entryExtra: { localDestinoId: 5, checklist: [{ i: 0, label: 'x', done: true }], tipoExecutor: 'interna' },
  });
  await comMigracao.manConferir('log-1', true);
  assert.strictEqual(comMigracao._patchesEquip.length, 1, 'o cadastro deveria continuar sendo aplicado com a migração 43 (D-uyz-15 intacto)');
  assert.strictEqual(comMigracao._updatesLog.length, 1, 'a conferência não pode morrer com "Ação não permitida" só porque UNI_OK é verdadeiro');
  assert.strictEqual(comMigracao._updatesLog[0].patch.status, 'CONCLUIDA');
});

// ── manTemEvidencia de movimentação (D-uyz-17) ────────────────────────────
test('manTemEvidencia de uma OS de remoção aceita checklist de partes completo sem foto, e recusa checklist parcial sem foto', () => {
  const ctx = carregarAplicacao({});
  assert.strictEqual(ctx.manTemEvidencia({ tipo: 'REMOÇÃO', fotos: [], checklist: [{ done: true }, { done: true }] }), true);
  assert.strictEqual(ctx.manTemEvidencia({ tipo: 'REMOÇÃO', fotos: [], checklist: [{ done: true }, { done: false }] }), false);
  assert.strictEqual(ctx.manTemEvidencia({ tipo: 'REMOÇÃO', fotos: [], checklist: [] }), false);
  assert.strictEqual(ctx.manTemEvidencia({ tipo: 'REMOÇÃO', fotos: ['a.jpg'], checklist: [] }), true);
});

test('manTemEvidencia de uma OS de instalação segue a mesma regra (foto OU checklist completo)', () => {
  const ctx = carregarAplicacao({});
  assert.strictEqual(ctx.manTemEvidencia({ tipo: 'INSTALAÇÃO', fotos: [], checklist: [{ done: true }] }), true);
  assert.strictEqual(ctx.manTemEvidencia({ tipo: 'INSTALAÇÃO', fotos: [], checklist: [{ done: false }] }), false);
});

test('manTemEvidencia de uma OS de manutenção continua aceitando medição isolada (contrato antigo intacto)', () => {
  const ctx = carregarAplicacao({});
  assert.strictEqual(ctx.manTemEvidencia({ tipo: 'CORRETIVA', fotos: [], insuflamento: 12 }), true);
  assert.strictEqual(ctx.manTemEvidencia({ tipo: 'CORRETIVA', fotos: [], checklist: [{ done: true }] }), false); // checklist não conta como evidência de manutenção
});

// ── fiação: a ordem certa em cada ramo ────────────────────────────────────
// 260823-cf8 (correção pós-dispatch): manConferir parou de gravar o
// literal fixo 'CONFERIDA' — o alvo agora é flTerminal, derivado do
// fluxo da própria OS (osTerminalSucesso(osFluxoDe(...))), para uma OS
// de movimentação continuar aplicando cadastro mesmo depois da migração
// 43 (quando ela resolve para FLUXO_PROPRIO, que não tem CONFERIDA).
test('o corpo de manConferir chama aplicarInstalacao/aplicarRemocao ANTES do update de status (o terminal derivado, nunca um literal fixo)', () => {
  const ini = HTML.indexOf('async function manConferir(logId, aprovado){');
  const fim = HTML.indexOf('\n}\n\n/* 260823-cf8 (D-cf8-04/24)', ini);
  assert.ok(ini > 0 && fim > ini, 'manConferir não encontrada');
  const corpo = HTML.slice(ini, fim);
  const posAplicar = corpo.search(/aplicarInstalacao\(achado\.equipId|aplicarRemocao\(achado\.equipId/);
  const posStatus = corpo.indexOf('status:flTerminal');
  assert.ok(posAplicar >= 0, 'manConferir não chama aplicarInstalacao/aplicarRemocao');
  assert.ok(posStatus >= 0, 'manConferir deveria gravar status:flTerminal (derivado do fluxo), não um literal fixo');
  assert.ok(posStatus > posAplicar, 'o update de status deveria vir DEPOIS de aplicarInstalacao/aplicarRemocao (D-uyz-15)');
  assert.doesNotMatch(corpo, /status:\s*'CONFERIDA'/, 'manConferir não pode voltar a gravar o literal fixo CONFERIDA');
});

test('o corpo de manConferir continua chamando atualizarUltimaManutencao/atualizarEstadoEquip DEPOIS do update de status, só no ramo de manutenção', () => {
  const ini = HTML.indexOf('async function manConferir(logId, aprovado){');
  const fim = HTML.indexOf('\n}\n\n/* 260823-cf8 (D-cf8-04/24)', ini);
  const corpo = HTML.slice(ini, fim);
  const posStatus = corpo.indexOf('status:flTerminal');
  const posUltima = corpo.indexOf('atualizarUltimaManutencao(achado.equipId');
  assert.ok(posUltima > posStatus, 'atualizarUltimaManutencao deveria continuar DEPOIS do update de status — ordem de hoje intacta');
  assert.match(corpo, /if\s*\(\s*!movimentacao\s*\)/, 'atualizarUltimaManutencao/atualizarEstadoEquip deveriam ficar fora do ramo de movimentação');
});
