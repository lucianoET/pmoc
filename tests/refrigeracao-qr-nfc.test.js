// Gate do acesso à ficha por QR code e por tag NFC — 260821-s3h.
//
// Mesmo padrão de recorte + sandbox node:vm de tests/inventario-ordem-refrigeracao.test.js
// e tests/refrigeracao-ficha-equipamento.test.js. Objetos criados dentro do sandbox têm
// Object.prototype de outro realm — comparação campo a campo (Array.from, chaves, valores),
// nunca deepEqual sobre objetos vindos de lá (mesma armadilha de
// tests/refrigeracao-encerramento-os.test.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

// ══════════════════════════════════════════════════════════════════
// Task 1 — link profundo ?equip=
// ══════════════════════════════════════════════════════════════════

function carregarSandboxAlvo(searchInicial) {
  const ini = HTML.indexOf('/* ── link profundo: ?equip= ── */');
  const fim = HTML.indexOf('/* ── ACESSO LIVRE (modo observador, somente leitura) ── */', ini);
  assert.ok(ini > 0 && fim > ini, 'bloco "link profundo: ?equip=" não encontrado');

  const chamadas = { openDetail: [], navTo: [], showToast: [], replaceState: [] };
  const ctx = {
    location: { search: searchInicial || '', hash: '', pathname: '/refrigeracao' },
    history: {
      replaceState(state, title, url) { chamadas.replaceState.push(url); },
    },
    DATA: [],
    showToast(msg, tipo) { chamadas.showToast.push({ msg: msg, tipo: tipo }); },
    navTo(page, btn) { chamadas.navTo.push({ page: page, btn: btn }); },
    openDetail(id) { chamadas.openDetail.push(id); },
    el(id) { return 'el:' + id; },
  };
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  ctx.__chamadas = chamadas;
  return ctx;
}

test('lerAlvoFicha devolve o inteiro 42 (número, não string) para as cinco formas de query aceitas', () => {
  const ctx = carregarSandboxAlvo();
  for (const busca of ['?equip=42', 'equip=42', '?a=1&equip=42', '?equip=42&a=1', '?equip=42#x']) {
    const r = ctx.lerAlvoFicha(busca);
    assert.strictEqual(r, 42, `lerAlvoFicha(${JSON.stringify(busca)}) deveria devolver 42`);
    assert.strictEqual(typeof r, 'number');
  }
});

test('lerAlvoFicha devolve null para lixo, ausência, decimal, negativo, notação científica, percent-encoded, estouro de dígitos, espaço e chave parecida — sem lançar', () => {
  const ctx = carregarSandboxAlvo();
  const casos = [
    undefined, '', '?equip=', '?equip=abc', '?equip=-3', '?equip=1.5', '?equip=1e3',
    '?equip=%31', '?equip=1234567890', '?equip=1 ', '?equipe=5',
    '?equip=<img src=x onerror=1>',
  ];
  for (const busca of casos) {
    assert.doesNotThrow(() => {
      const r = ctx.lerAlvoFicha(busca);
      assert.strictEqual(r, null, `lerAlvoFicha(${JSON.stringify(busca)}) deveria devolver null`);
    });
  }
});

test('buscaSemAlvo remove só o par equip e preserva a ordem e o par sem "="', () => {
  const ctx = carregarSandboxAlvo();
  assert.strictEqual(ctx.buscaSemAlvo('?a=1&equip=5&b=2'), '?a=1&b=2');
  assert.strictEqual(ctx.buscaSemAlvo('?equip=5'), '');
  assert.strictEqual(ctx.buscaSemAlvo('?a=1'), '?a=1');
  assert.strictEqual(ctx.buscaSemAlvo(''), '');
});

test('aplicarAlvoFicha com id existente abre a ficha, leva ao inventário, limpa a URL uma vez, e a segunda chamada não faz nada', () => {
  const ctx = carregarSandboxAlvo('?equip=7');
  ctx.DATA = [{ id: 7 }, { id: 8 }];
  const r1 = ctx.aplicarAlvoFicha();
  assert.strictEqual(r1, true);
  assert.deepEqual(Array.from(ctx.__chamadas.openDetail), [7]);
  assert.strictEqual(ctx.__chamadas.navTo[0].page, 'inv');
  assert.strictEqual(ctx.__chamadas.replaceState.length, 1);

  const r2 = ctx.aplicarAlvoFicha();
  assert.strictEqual(r2, false);
  assert.deepEqual(Array.from(ctx.__chamadas.openDetail), [7]); // não abriu de novo
});

test('aplicarAlvoFicha com id inexistente avisa nomeando o número, limpa a URL, não abre gaveta e devolve false', () => {
  const ctx = carregarSandboxAlvo('?equip=999');
  ctx.DATA = [{ id: 7 }];
  const r = ctx.aplicarAlvoFicha();
  assert.strictEqual(r, false);
  assert.strictEqual(ctx.__chamadas.openDetail.length, 0);
  assert.strictEqual(ctx.__chamadas.showToast.length, 1);
  assert.match(ctx.__chamadas.showToast[0].msg, /999/);
  assert.strictEqual(ctx.__chamadas.replaceState.length, 1);
});

test('aplicarAlvoFicha sem alvo (ALVO_FICHA=null) não chama replaceState, openDetail nem showToast', () => {
  const ctx = carregarSandboxAlvo(''); // sem ?equip= => ALVO_FICHA capturado como null
  ctx.DATA = [{ id: 7 }];
  const r = ctx.aplicarAlvoFicha();
  assert.strictEqual(r, false);
  assert.strictEqual(ctx.__chamadas.openDetail.length, 0);
  assert.strictEqual(ctx.__chamadas.showToast.length, 0);
  assert.strictEqual(ctx.__chamadas.replaceState.length, 0);
});

test('fiação: aplicarAlvoFicha() é chamada em initAppOnce e em acessoLivre, depois de renderInv()', () => {
  const iniInit = HTML.indexOf('async function initAppOnce(){');
  const fimInit = HTML.indexOf('\nwindow.initAppOnce = initAppOnce;', iniInit);
  assert.ok(iniInit > 0 && fimInit > iniInit, 'initAppOnce não encontrada');
  const corpoInit = HTML.slice(iniInit, fimInit);
  const idxRenderInvInit = corpoInit.indexOf('renderInv();');
  const idxAplicarInit = corpoInit.indexOf('aplicarAlvoFicha();');
  assert.ok(idxRenderInvInit >= 0 && idxAplicarInit >= 0, 'renderInv()/aplicarAlvoFicha() não encontradas em initAppOnce');
  assert.ok(idxAplicarInit > idxRenderInvInit, 'aplicarAlvoFicha() deveria vir depois de renderInv() em initAppOnce');

  const iniLivre = HTML.indexOf('async function acessoLivre() {');
  const fimLivre = HTML.indexOf('\n}', HTML.indexOf('catch(e) {', iniLivre));
  assert.ok(iniLivre > 0 && fimLivre > iniLivre, 'acessoLivre não encontrada');
  const corpoLivre = HTML.slice(iniLivre, fimLivre);
  const idxRenderInvLivre = corpoLivre.indexOf('renderInv();');
  const idxAplicarLivre = corpoLivre.indexOf('aplicarAlvoFicha();');
  assert.ok(idxRenderInvLivre >= 0 && idxAplicarLivre >= 0, 'renderInv()/aplicarAlvoFicha() não encontradas em acessoLivre');
  assert.ok(idxAplicarLivre > idxRenderInvLivre, 'aplicarAlvoFicha() deveria vir depois de renderInv() em acessoLivre');
});

test('id="nav-inv" está no botão de navTo(\'inv\', e aplicarAlvoFicha referencia \'nav-inv\'', () => {
  assert.match(HTML, /id="nav-inv" onclick="navTo\('inv',this\)"/);
  const ini = HTML.indexOf('function aplicarAlvoFicha()');
  const fim = HTML.indexOf('\n}', ini);
  assert.match(HTML.slice(ini, fim), /'nav-inv'/);
});

test('os quatro grep do PLAT-15 continuam em 0 em refrigeracao/index.html', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.equal((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
