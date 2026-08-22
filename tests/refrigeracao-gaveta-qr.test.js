// Gate do QR da ficha com teto de largura e da gaveta que não fecha ao
// rolar — 260821-tyx.
//
// Mesmo padrão de recorte + sandbox node:vm de tests/refrigeracao-qr-nfc.test.js
// e tests/inventario-ordem-refrigeracao.test.js. Objetos criados dentro do
// sandbox têm Object.prototype de outro realm — comparação campo a campo,
// nunca deepEqual sobre objetos vindos de lá.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

// ══════════════════════════════════════════════════════════════════
// Task 1 — teto de largura do QR da ficha, numa regra de CSS
// ══════════════════════════════════════════════════════════════════

function folhasDeEstilo() {
  var blocos = [];
  var re = /<style[^>]*>([\s\S]*?)<\/style>/g;
  var m;
  while ((m = re.exec(HTML))) blocos.push(m[1]);
  return blocos.join('\n');
}

test('existe, numa folha de estilo, uma regra .qr-ficha svg com max-width em px entre 120 e 260 (D-tyx-01/D-tyx-02)', () => {
  const css = folhasDeEstilo();
  const re = /\.qr-ficha\s+svg\{[^}]*max-width:\s*(\d+)px/;
  const m = css.match(re);
  assert.ok(m, 'nenhuma regra ".qr-ficha svg" com max-width em px encontrada em nenhuma folha <style>');
  const valor = Number(m[1]);
  assert.ok(valor >= 120 && valor <= 260, `max-width de ${valor}px fora da faixa 120–260`);
});

test('a regra de 250px do modal (#qr-svg-wrap svg) continua no arquivo, separada e intacta', () => {
  assert.match(HTML, /#qr-svg-wrap svg\{width:100%;max-width:250px;height:auto\}/);
});

test('as duas regras de impressão em milímetros seguem intactas — etiqueta 22mm e ficha impressa 20mm (D-tyx-08)', () => {
  assert.match(HTML, /\.etq-qr svg\{width:22mm;height:22mm/);
  assert.match(HTML, /\.hdr svg\{width:20mm;height:20mm/);
});

function corpoDe(assinatura) {
  const ini = HTML.indexOf(assinatura);
  assert.ok(ini > 0, `"${assinatura}" não encontrada`);
  var prof = 0, i = HTML.indexOf('{', ini), fim = -1;
  for (; i < HTML.length; i++) {
    if (HTML[i] === '{') prof++;
    else if (HTML[i] === '}') { prof--; if (prof === 0) { fim = i + 1; break; } }
  }
  assert.ok(fim > ini, `chave de fechamento de "${assinatura}" não encontrada`);
  return HTML.slice(ini, fim);
}

test('blocoQrFicha usa a classe qr-ficha, não repete o número de largura máxima, e não emite atributo style no div que embrulha o SVG', () => {
  const corpo = corpoDe('function blocoQrFicha(id){');
  assert.match(corpo, /class="qr-ficha"/);
  assert.doesNotMatch(corpo, /max-width/);
  // o div que embrulha o SVG não pode carregar estilo embutido
  assert.doesNotMatch(corpo, /<div class="qr-ficha" style=/);
  assert.doesNotMatch(corpo, /'<div style="text-align:center/);
});

test('os quatro grep do PLAT-15 continuam em 0 em refrigeracao/index.html', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.equal((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});

// ══════════════════════════════════════════════════════════════════
// Task 2 — a gaveta só fecha quando o gesto é de fechar
// ══════════════════════════════════════════════════════════════════

function recorteSwipeDrawer() {
  const marcaIni = 'SWIPE DRAWER';
  const marcaFim = '/* ── link profundo: ?equip= ── */';
  const idxMarcaIni = HTML.indexOf(marcaIni);
  const idxMarcaFim = HTML.indexOf(marcaFim, idxMarcaIni);
  assert.ok(idxMarcaIni > 0 && idxMarcaFim > idxMarcaIni, 'os dois marcadores de recorte do SWIPE DRAWER não foram encontrados na ordem certa');
  // recua até o começo do bloco de comentário de seção que precede o marcador
  const ini = HTML.lastIndexOf('/* ═', idxMarcaIni);
  return HTML.slice(ini > 0 ? ini : idxMarcaIni, idxMarcaFim);
}

function carregarSandboxGesto() {
  const recorte = recorteSwipeDrawer();
  const ctx = {
    document: {
      addEventListener: function () {},
    },
    el: function () { return null; },
  };
  vm.createContext(ctx);
  vm.runInContext(recorte, ctx);
  ctx.__recorte = recorte;
  return ctx;
}

test('carregar o bloco SWIPE DRAWER em Node, com um document que só registra ouvintes e el que devolve null, não lança', () => {
  assert.doesNotThrow(() => carregarSandboxGesto());
});

test('gestoFechaGaveta: topo (rolagem 0), dy 80, dx 0, dentro do corpo -> true (gesto padrão de bottom-sheet)', () => {
  const ctx = carregarSandboxGesto();
  assert.strictEqual(ctx.gestoFechaGaveta(false, 0, 80, 0), true);
});

test('gestoFechaGaveta: rolagem 120 (ficha já rolada), dy 80, dx 0 -> false — é o defeito relatado pelo usuário', () => {
  const ctx = carregarSandboxGesto();
  assert.strictEqual(ctx.gestoFechaGaveta(false, 120, 80, 0), false, 'rolar a ficha para baixo não pode fechar a gaveta');
});

test('gestoFechaGaveta: início fora do corpo rolável (alça/cabeçalho/rodapé), rolagem 400, dy 80 -> true (D-tyx-04b, gesto conhecido não regride)', () => {
  const ctx = carregarSandboxGesto();
  assert.strictEqual(ctx.gestoFechaGaveta(true, 400, 80, 0), true);
});

test('gestoFechaGaveta: dy 30, em qualquer combinação de início/rolagem/dx -> false (abaixo do limiar)', () => {
  const ctx = carregarSandboxGesto();
  assert.strictEqual(ctx.gestoFechaGaveta(false, 0, 30, 0), false);
  assert.strictEqual(ctx.gestoFechaGaveta(true, 0, 30, 0), false);
  assert.strictEqual(ctx.gestoFechaGaveta(false, 500, 30, 200), false);
});

test('gestoFechaGaveta: limiar estritamente maior que 60 (D-tyx-07) — dy 60 exato -> false; dy 61 no topo -> true', () => {
  const ctx = carregarSandboxGesto();
  assert.strictEqual(ctx.gestoFechaGaveta(false, 0, 60, 0), false);
  assert.strictEqual(ctx.gestoFechaGaveta(false, 0, 61, 0), true);
});

test('gestoFechaGaveta: dy -80 (arrasto para cima) -> false', () => {
  const ctx = carregarSandboxGesto();
  assert.strictEqual(ctx.gestoFechaGaveta(false, 0, -80, 0), false);
});

test('gestoFechaGaveta: dy 80 com dx 200 -> false — gesto lateral (D-tyx-05)', () => {
  const ctx = carregarSandboxGesto();
  assert.strictEqual(ctx.gestoFechaGaveta(false, 0, 80, 200), false);
});

test('gestoFechaGaveta: dy 80 com dx -200 -> false — só o módulo de dx importa, não o sinal', () => {
  const ctx = carregarSandboxGesto();
  assert.strictEqual(ctx.gestoFechaGaveta(false, 0, 80, -200), false);
});

test('gestoFechaGaveta: chamada duas vezes com os mesmos argumentos devolve o mesmo resultado — sem estado interno', () => {
  const ctx = carregarSandboxGesto();
  const r1 = ctx.gestoFechaGaveta(false, 0, 80, 0);
  const r2 = ctx.gestoFechaGaveta(false, 0, 80, 0);
  assert.strictEqual(r1, r2);
  assert.strictEqual(r1, true);
});

test('o recorte cita scrollTop e drawer-body — ler a rolagem do painel devolveria sempre 0 e o defeito sobreviveria', () => {
  const ctx = carregarSandboxGesto();
  assert.match(ctx.__recorte, /scrollTop/);
  assert.match(ctx.__recorte, /drawer-body/);
});

test('gestoFechaGaveta aparece ao menos duas vezes no recorte — definição mais chamada, o ouvinte não volta a decidir sozinho', () => {
  const ctx = carregarSandboxGesto();
  const ocorrencias = (ctx.__recorte.match(/gestoFechaGaveta/g) || []).length;
  assert.ok(ocorrencias >= 2, `gestoFechaGaveta apareceu ${ocorrencias} vez(es), esperado >= 2`);
});

test('o recorte não casa com a comparação crua /dy\\s*>\\s*60/ — o número passou a ter nome (GESTO_MIN_PX)', () => {
  const ctx = carregarSandboxGesto();
  assert.doesNotMatch(ctx.__recorte, /dy\s*>\s*60/);
});
