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

test('todo valor de CAMPOS_LOG é coluna real de logs_manutencao (união 04+40+41+42)', () => {
  const ctx = carregarPonteLog();
  const reais = colunasCreateTable04('logs_manutencao')
    .concat(colunasAddColumn(SQL_40, 'logs_manutencao'))
    .concat(colunasAddColumn(SQL_41, 'logs_manutencao'))
    .concat(colunasAddColumn(SQL_42, 'logs_manutencao'));
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
