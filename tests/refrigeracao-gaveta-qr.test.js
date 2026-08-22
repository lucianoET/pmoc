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
