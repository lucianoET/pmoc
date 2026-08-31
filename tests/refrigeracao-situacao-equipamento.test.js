// Gate da quick-260821-uyz — Task 1: situação patrimonial do equipamento
// (instalado/removido/baixado) atravessando a tela e o mapa.
//
// O núcleo puro (EQUIP_SITUACOES, normalizarSituacaoEquip, equipInstalado,
// equipamentosOperacionais, contarNaoOperacionais) e o vocabulário de
// inventário (filtrarInventario) são recortados do HTML e avaliados num
// sandbox `node:vm` — mesmo padrão de tests/refrigeracao-contagens.test.js
// e tests/refrigeracao-fluxo-os-interna.test.js. Objetos criados DENTRO do
// sandbox têm Object.prototype de outro realm — as comparações abaixo são
// sempre campo a campo ou por strictEqual de primitivo, nunca deepEqual
// estrutural contra literal do realm principal (armadilha documentada em
// tests/refrigeracao-encerramento-os.test.js).
//
// Estrutural: a migração 42 (aditiva, sem drop/delete), EQUIP_SITUACOES
// batendo nos dois sentidos com o `check` do arquivo .sql, a ordem
// update→set not null, e a ponte CAMPOS_EQUIP/EQUIP_EDITAVEIS (D-uyz-12).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const SQL_DIR = path.join(RAIZ, 'supabase');

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

function carregarNucleoSituacao() {
  const ctx = {
    esc(s) { if (!s) return ''; return String(s); },
  };
  vm.createContext(ctx);
  // bloco do vocabulário de situação (entre "estado do equipamento" e "alertas: contagem única")
  vm.runInContext(
    recorte('/* ── estado do equipamento: vocabulário OP/INOP/OR ── */', '/* ── alertas: contagem única ── */'),
    ctx
  );
  return ctx;
}

function carregarNucleoInventario() {
  const ctx = {
    esc(s) { if (!s) return ''; return String(s); },
  };
  vm.createContext(ctx);
  vm.runInContext(
    recorte('/* ── estado do equipamento: vocabulário OP/INOP/OR ── */', '/* ── alertas: contagem única ── */'),
    ctx
  );
  vm.runInContext(recorte('/* ── inventário: a seleção filtrada, com dois consumidores ── */', 'function renderInv('), ctx);
  return ctx;
}

function carregarPonteEquip() {
  const ini = HTML.indexOf('/* ── ponte de campos de equipamentos ── */');
  const fim = HTML.indexOf('function linkSeguro(');
  assert.ok(ini > 0 && fim > ini, 'ponte de campos de equipamentos não encontrada');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  return ctx;
}

// ── 1. normalizarSituacaoEquip: as três respostas ───────────────────────
test('normalizarSituacaoEquip devolve instalado para undefined, null e vazio (banco pré-42)', () => {
  const ctx = carregarNucleoSituacao();
  assert.strictEqual(ctx.normalizarSituacaoEquip(undefined), 'instalado');
  assert.strictEqual(ctx.normalizarSituacaoEquip(null), 'instalado');
  assert.strictEqual(ctx.normalizarSituacaoEquip(''), 'instalado');
});

test('normalizarSituacaoEquip devolve o próprio valor para os três da lista fechada', () => {
  const ctx = carregarNucleoSituacao();
  assert.strictEqual(ctx.normalizarSituacaoEquip('instalado'), 'instalado');
  assert.strictEqual(ctx.normalizarSituacaoEquip('removido'), 'removido');
  assert.strictEqual(ctx.normalizarSituacaoEquip('baixado'), 'baixado');
});

test('normalizarSituacaoEquip devolve null para texto fora da lista fechada — lixo não é ausência', () => {
  const ctx = carregarNucleoSituacao();
  assert.strictEqual(ctx.normalizarSituacaoEquip('sucateado'), null);
  assert.strictEqual(ctx.normalizarSituacaoEquip('INSTALADO'), null); // sem conversão de caixa
  assert.strictEqual(ctx.normalizarSituacaoEquip('__proto__'), null);
});

// ── 2. equipInstalado / equipRemovido / equipBaixado ─────────────────────
test('equipInstalado é verdadeiro para instalado e para ausência; falso para removido, baixado e valor inventado', () => {
  const ctx = carregarNucleoSituacao();
  assert.strictEqual(ctx.equipInstalado({ situacao: 'instalado' }), true);
  assert.strictEqual(ctx.equipInstalado({}), true); // ausência = pré-42
  assert.strictEqual(ctx.equipInstalado({ situacao: 'removido' }), false);
  assert.strictEqual(ctx.equipInstalado({ situacao: 'baixado' }), false);
  assert.strictEqual(ctx.equipInstalado({ situacao: 'inventado' }), false);
});

test('equipRemovido e equipBaixado só respondem para o próprio valor', () => {
  const ctx = carregarNucleoSituacao();
  assert.strictEqual(ctx.equipRemovido({ situacao: 'removido' }), true);
  assert.strictEqual(ctx.equipRemovido({ situacao: 'baixado' }), false);
  assert.strictEqual(ctx.equipRemovido({ situacao: 'instalado' }), false);
  assert.strictEqual(ctx.equipBaixado({ situacao: 'baixado' }), true);
  assert.strictEqual(ctx.equipBaixado({ situacao: 'removido' }), false);
});

// ── 3. equipamentosOperacionais preserva ordem ───────────────────────────
test('equipamentosOperacionais devolve só os instalados, preservando a ordem da lista recebida', () => {
  const ctx = carregarNucleoSituacao();
  const lista = [
    { id: 1, situacao: 'instalado' },
    { id: 2, situacao: 'removido' },
    { id: 3, situacao: 'instalado' },
    { id: 4, situacao: 'baixado' },
    { id: 5 }, // ausência = instalado
  ];
  const op = ctx.equipamentosOperacionais(lista);
  assert.deepStrictEqual(op.map((e) => e.id), [1, 3, 5]);
});

// ── 4. situacaoPill: string vazia para instalado ─────────────────────────
test('situacaoPill devolve string vazia para instalado, e pílula com classe própria para removido/baixado', () => {
  const ctx = carregarNucleoSituacao();
  assert.strictEqual(ctx.situacaoPill('instalado'), '');
  assert.strictEqual(ctx.situacaoPill(undefined), '');
  assert.match(ctx.situacaoPill('removido'), /pill-sit-removido/);
  assert.match(ctx.situacaoPill('baixado'), /pill-sit-baixado/);
  assert.doesNotMatch(ctx.situacaoPill('removido'), /\bpill-baixa\b/, 'não pode colidir com a classe de criticidade BAIXA');
});

// ── 5. filtrarInventario: chips de sempre escondem, chips novos isolam ──
test('filtrarInventario esconde removido e baixado nos chips de sempre (inclusive "todos")', () => {
  const ctx = carregarNucleoInventario();
  const lista = [
    { id: 1, situacao: 'instalado', local: 'A', predio: 'P', funciona: 'OP' },
    { id: 2, situacao: 'removido', local: 'B', predio: 'P', funciona: 'OP' },
    { id: 3, situacao: 'baixado', local: 'C', predio: 'P', funciona: 'INOP' },
  ];
  const todos = ctx.filtrarInventario(lista, '', 'todos');
  assert.deepStrictEqual(todos.map((e) => e.id), [1]);
  const nok = ctx.filtrarInventario(lista, '', 'nok');
  assert.deepStrictEqual(nok.map((e) => e.id), []); // #3 é INOP mas está baixado — some do chip de sempre
});

test('filtrarInventario isola removido/baixado nos dois chips próprios', () => {
  const ctx = carregarNucleoInventario();
  const lista = [
    { id: 1, situacao: 'instalado', local: 'A', predio: 'P' },
    { id: 2, situacao: 'removido', local: 'B', predio: 'P' },
    { id: 3, situacao: 'baixado', local: 'C', predio: 'P' },
  ];
  assert.deepStrictEqual(ctx.filtrarInventario(lista, '', 'removidos').map((e) => e.id), [2]);
  assert.deepStrictEqual(ctx.filtrarInventario(lista, '', 'baixados').map((e) => e.id), [3]);
});

test('filtrarInventario aplica a busca textual dentro de cada chip novo — buscar dentro de "removidos" continua filtrando', () => {
  const ctx = carregarNucleoInventario();
  const lista = [
    { id: 1, situacao: 'removido', local: 'Sala Alfa', predio: 'F21' },
    { id: 2, situacao: 'removido', local: 'Sala Beta', predio: 'MK48' },
    { id: 3, situacao: 'baixado', local: 'Sala Alfa', predio: 'F21' },
  ];
  assert.deepStrictEqual(ctx.filtrarInventario(lista, 'alfa', 'removidos').map((e) => e.id), [1]);
  assert.deepStrictEqual(ctx.filtrarInventario(lista, 'beta', 'baixados').map((e) => e.id), []);
});

// ── 6. contarNaoOperacionais ──────────────────────────────────────────────
test('contarNaoOperacionais conta quantos removidos/baixados casam com uma busca', () => {
  const ctx = carregarNucleoInventario();
  const lista = [
    { id: 1, situacao: 'instalado', local: 'Sala Alfa', predio: 'F21' },
    { id: 2, situacao: 'removido', local: 'Sala Alfa', predio: 'F21' },
    { id: 3, situacao: 'baixado', local: 'Sala Alfa Extra', predio: 'MK48' },
    { id: 4, situacao: 'removido', local: 'Outra', predio: 'PAIOL' },
  ];
  assert.strictEqual(ctx.contarNaoOperacionais(lista, 'alfa'), 2);
  assert.strictEqual(ctx.contarNaoOperacionais(lista, ''), 3);
  assert.strictEqual(ctx.contarNaoOperacionais(lista, 'inexistente'), 0);
});

// ── 7. CAMPOS_EQUIP / EQUIP_EDITAVEIS (D-uyz-12) ─────────────────────────
test('situacao, dataRemocao e dataBaixa estão em CAMPOS_EQUIP e FORA de EQUIP_EDITAVEIS', () => {
  const ctx = carregarPonteEquip();
  assert.strictEqual(ctx.CAMPOS_EQUIP.situacao, 'situacao');
  assert.strictEqual(ctx.CAMPOS_EQUIP.dataRemocao, 'data_remocao');
  assert.strictEqual(ctx.CAMPOS_EQUIP.dataBaixa, 'data_baixa');
  assert.strictEqual(ctx.EQUIP_EDITAVEIS.indexOf('situacao'), -1);
  assert.strictEqual(ctx.EQUIP_EDITAVEIS.indexOf('dataRemocao'), -1);
  assert.strictEqual(ctx.EQUIP_EDITAVEIS.indexOf('dataBaixa'), -1);
});

test('equipParaDb descarta situacao/dataRemocao/dataBaixa mesmo se alguém montar o patch à mão', () => {
  const ini = HTML.indexOf('/* ── ponte de campos de equipamentos ── */');
  const fim = HTML.indexOf('function podeEditarCadastro(');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  const db = ctx.equipParaDb({ situacao: 'baixado', dataBaixa: '2026-08-21', area: 'AZUL' });
  assert.strictEqual(db.situacao, undefined);
  assert.strictEqual(db.data_baixa, undefined);
  assert.strictEqual(db.area, 'AZUL');
});

// ── 8. estrutural: a migração 42 ──────────────────────────────────────────
test('existe um único arquivo 42_*.sql em supabase/', () => {
  const arquivos = fs.readdirSync(SQL_DIR).filter((f) => /^42_.*\.sql$/.test(f));
  assert.strictEqual(arquivos.length, 1, `esperado 1 arquivo 42_*.sql, achado: ${arquivos.join(', ')}`);
});

function lerMigracao42() {
  const arquivo = fs.readdirSync(SQL_DIR).find((f) => /^42_.*\.sql$/.test(f));
  return fs.readFileSync(path.join(SQL_DIR, arquivo), 'utf8');
}

test('a migração 42 não contém drop table, drop column nem delete from', () => {
  // Fora dos comentários — o cabeçalho CITA "drop table"/"delete from" para
  // explicar que o arquivo não os usa; a asserção vale sobre o SQL
  // executável, não sobre a própria documentação que os proíbe (mesma
  // técnica de tests/refrigeracao-estado-equipamento.test.js).
  const sql = lerMigracao42();
  const sqlSemComentarios = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(sqlSemComentarios, /drop\s+table/i);
  assert.doesNotMatch(sqlSemComentarios, /drop\s+column/i);
  assert.doesNotMatch(sqlSemComentarios, /delete\s+from/i);
});

test('EQUIP_SITUACOES bate nos dois sentidos com o check(situacao in (...)) da migração 42', () => {
  const sql = lerMigracao42();
  const ctx = carregarNucleoSituacao();
  const m = sql.match(/check\s*\(situacao\s+in\s*\(([^)]*)\)\)/i);
  assert.ok(m, 'check(situacao in (...)) não encontrado na migração 42');
  const chavesSql = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  const chavesJs = Object.keys(ctx.EQUIP_SITUACOES);
  assert.deepStrictEqual(chavesSql.slice().sort(), chavesJs.slice().sort());
});

test('o set not null de situacao vem DEPOIS do update ... where situacao is null', () => {
  const sql = lerMigracao42();
  const posUpdate = sql.indexOf('update equipamentos set situacao');
  const posSetNotNull = sql.indexOf('alter column situacao set not null');
  assert.ok(posUpdate >= 0, 'update de backfill de situacao não encontrado');
  assert.ok(posSetNotNull >= 0, 'set not null de situacao não encontrado');
  assert.ok(posUpdate < posSetNotNull, 'set not null deveria vir depois do update de backfill');
});

test('a migração 42 cria as quatro colunas novas de logs_manutencao e as três de equipamentos', () => {
  const sql = lerMigracao42();
  for (const col of ['situacao', 'data_remocao', 'data_baixa']) {
    assert.match(sql, new RegExp(`alter table equipamentos add column if not exists ${col}\\b`));
  }
  for (const col of ['local_destino_id', 'local_origem_id', 'equip_substituido_id', 'destino_remocao']) {
    assert.match(sql, new RegExp(`alter table logs_manutencao add column if not exists ${col}\\b`));
  }
});
