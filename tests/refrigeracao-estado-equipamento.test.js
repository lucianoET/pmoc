// Gate do vocabulário de estado do equipamento (OP/INOP/OR) — 260821-q57 Task 1.
//
// A lógica mora inline em refrigeracao/index.html — o app é single-file e continua
// congelado (D-04). O teste recorta o bloco
// "/* ── estado do equipamento: vocabulário OP/INOP/OR ── */" e o avalia num sandbox
// node:vm, mesmo padrão de tests/inventario-ordem-refrigeracao.test.js. O bloco só
// depende de esc() (já definido no arquivo antes dele), fornecido no contexto.
//
// A migração 41 (supabase/41_refrigeracao_ficha_estado.sql) é lida também — as chaves
// de EQUIP_ESTADOS e o vocabulário do `check (funciona in (...))` são conferidos nos
// dois sentidos, para os dois lados não divergirem (mesma lição de CAMPOS_LOG/migração
// 40 em tests/refrigeracao-fluxo-os-interna.test.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');
const SQL = fs.readFileSync(path.join(__dirname, '..', 'supabase', '41_refrigeracao_ficha_estado.sql'), 'utf8');

function carregarSandbox() {
  const ini = HTML.indexOf('/* ── estado do equipamento: vocabulário OP/INOP/OR ── */');
  const fim = HTML.indexOf('/* ── alertas: contagem única ── */', ini);
  assert.ok(ini > 0 && fim > ini, 'bloco de vocabulário do estado do equipamento não encontrado em refrigeracao/index.html');
  const ctx = {
    esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  };
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  return ctx;
}

test('normalizarEstadoEquip devolve OP/OR/INOP para os três valores novos, traduz OK/NOK, e recusa qualquer outra coisa', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.normalizarEstadoEquip('OP'), 'OP');
  assert.equal(ctx.normalizarEstadoEquip('OR'), 'OR');
  assert.equal(ctx.normalizarEstadoEquip('INOP'), 'INOP');
  assert.equal(ctx.normalizarEstadoEquip('OK'), 'OP');
  assert.equal(ctx.normalizarEstadoEquip('NOK'), 'INOP');
  for (const invalido of ['', null, undefined, 'inventado', '__proto__', 'constructor', ' OP ', 'op']) {
    assert.equal(ctx.normalizarEstadoEquip(invalido), null, `normalizarEstadoEquip(${JSON.stringify(invalido)}) deveria ser null`);
  }
});

test('equipInoperante é verdadeiro para NOK e para INOP; equipOperante para OK e para OP (D-q57-06)', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.equipInoperante({ funciona: 'NOK' }), true);
  assert.equal(ctx.equipInoperante({ funciona: 'INOP' }), true);
  assert.equal(ctx.equipInoperante({ funciona: 'OP' }), false);
  assert.equal(ctx.equipOperante({ funciona: 'OK' }), true);
  assert.equal(ctx.equipOperante({ funciona: 'OP' }), true);
  assert.equal(ctx.equipOperante({ funciona: 'NOK' }), false);
});

test('equipComRestricao é verdadeiro só para OR', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.equipComRestricao({ funciona: 'OR' }), true);
  for (const v of ['OP', 'INOP', 'OK', 'NOK', 'inventado']) {
    assert.equal(ctx.equipComRestricao({ funciona: v }), false, `equipComRestricao(funciona:${v}) deveria ser false`);
  }
});

test('statusPill desenha os três estados com rótulo distinto, pill-or só no OR, e um valor inventado sai escapado sem virar pill-ok', () => {
  const ctx = carregarSandbox();
  const op = ctx.statusPill('OP'), or = ctx.statusPill('OR'), inop = ctx.statusPill('INOP');
  assert.match(op, /pill-ok/);
  assert.match(inop, /pill-nok/);
  assert.match(or, /pill-or/);
  assert.doesNotMatch(op, /pill-or/);
  assert.doesNotMatch(inop, /pill-or/);

  const inventado = ctx.statusPill('<script>alert(1)</script>');
  assert.doesNotMatch(inventado, /pill-ok/);
  assert.doesNotMatch(inventado, /<script>/);
  assert.match(inventado, /&lt;script&gt;/);
});

test('as chaves de EQUIP_ESTADOS batem com o check(funciona in (...)) da migração 41, nos dois sentidos', () => {
  const ctx = carregarSandbox();
  const m = SQL.match(/add constraint equipamentos_funciona_chk\s*\n?\s*check \(funciona in \(([^)]*)\)\)/);
  assert.ok(m, 'check de equipamentos_funciona_chk não encontrado em supabase/41_refrigeracao_ficha_estado.sql');
  const valoresSql = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  const chavesJs = Object.keys(ctx.EQUIP_ESTADOS);
  assert.deepEqual(valoresSql.slice().sort(), chavesJs.slice().sort());
});

test('EQUIP_EQUIVALENCIA mapeia só OK e NOK, e todo destino dela é uma chave de EQUIP_ESTADOS', () => {
  const ctx = carregarSandbox();
  assert.deepEqual(Object.keys(ctx.EQUIP_EQUIVALENCIA).sort(), ['NOK', 'OK']);
  for (const destino of Object.values(ctx.EQUIP_EQUIVALENCIA)) {
    assert.ok(ctx.EQUIP_ESTADOS.hasOwnProperty(destino), `EQUIP_EQUIVALENCIA aponta para "${destino}", fora de EQUIP_ESTADOS`);
  }
});

test('migração 41: único arquivo 41_*.sql, sem drop table/column nem delete from, updates idempotentes, e a trava de funciona vem depois deles', () => {
  const dir = path.join(__dirname, '..', 'supabase');
  const arquivos41 = fs.readdirSync(dir).filter((f) => /^41_/.test(f));
  assert.deepEqual(arquivos41, ['41_refrigeracao_ficha_estado.sql']);

  // Fora dos comentários — o cabeçalho do arquivo CITA "drop table"/"delete
  // from" para explicar que não os usa; a asserção precisa valer sobre o
  // SQL executável, não sobre a própria documentação que os proíbe.
  const sqlSemComentarios = SQL.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(sqlSemComentarios, /drop\s+table/i);
  assert.doesNotMatch(sqlSemComentarios, /drop\s+column/i);
  assert.doesNotMatch(sqlSemComentarios, /delete\s+from/i);

  const updates = [...SQL.matchAll(/update\s+equipamentos\s+set\s+funciona\s*=\s*'[A-Z]+'\s+where\s+funciona\s*=\s*'[A-Z]+'/gi)];
  assert.equal(updates.length, 2, 'esperados os dois updates idempotentes (OK→OP, NOK→INOP), cada um com where funciona= na mesma instrução');

  const posUltimoUpdate = Math.max(...updates.map((u) => u.index));
  const posTravaFunciona = SQL.indexOf('add constraint equipamentos_funciona_chk');
  assert.ok(posTravaFunciona > posUltimoUpdate, 'a trava equipamentos_funciona_chk precisa vir DEPOIS dos dois updates');
});

test('os quatro grep do PLAT-15 continuam em 0 em refrigeracao/index.html', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.equal((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
