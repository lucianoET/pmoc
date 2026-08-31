// Gate da ordenação e do filtro de vencidos do inventário da Refrigeração.
//
// A lógica mora inline em refrigeracao/index.html — o app é single-file e continua
// congelado (D-04), então não há núcleo puro em arquivo separado como em
// maquinas/estoque-tabela.js. O teste recorta o trecho das funções acrescentadas e
// o avalia num sandbox com os dois helpers de que ele depende (nextPmoc, autoCrit)
// substituídos por versões controladas — assim o que está sob teste é a ordenação
// em si, não o cronograma PMOC, que já tem regra própria.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');

function carregarSandbox() {
  const ini = HTML.indexOf('var CRIT_ORDEM =');
  const fim = HTML.indexOf('function setChip(btn, val){');
  assert.ok(ini > 0 && fim > ini, 'trecho de ordenação do inventário não encontrado em refrigeracao/index.html');

  const ctx = {
    invOrdem: 'local',
    // Vencimento controlado: dias no campo _prox, negativo = já vencido, null = sem histórico.
    nextPmoc(e, tipo) {
      if (e._prox === null || e._prox === undefined) return null;
      const d = new Date('2026-08-18T12:00:00Z');
      d.setDate(d.getDate() + e._prox + (tipo === 'preventiva' ? 5 : 0));
      return d;
    },
    autoCrit: (e) => e.criticidade,
    renderInv() {},
  };
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  return ctx;
}

const EQUIPS = [
  { local: 'Zulu',    predio: 'B', criticidade: 'BAIXA',   _prox: 170 },
  { local: 'Alfa',    predio: 'C', criticidade: 'CRÍTICA', _prox: -30 },
  { local: 'Bravo',   predio: 'A', criticidade: 'ALTA',    _prox: null },
  { local: 'Charlie', predio: 'A', criticidade: 'MÉDIA',   _prox: 85  },
];

function ordenar(ctx, modo) {
  ctx.invOrdem = modo;
  return EQUIPS.slice().sort(ctx.cmpInv).map((e) => e.local);
}

test('ordena por local em pt-BR', () => {
  assert.deepStrictEqual(ordenar(carregarSandbox(), 'local'), ['Alfa', 'Bravo', 'Charlie', 'Zulu']);
});

test('ordena por prédio e desempata pelo local', () => {
  assert.deepStrictEqual(ordenar(carregarSandbox(), 'predio'), ['Bravo', 'Charlie', 'Zulu', 'Alfa']);
});

test('criticidade usa a ordem semântica CRÍTICA > ALTA > MÉDIA > BAIXA, não a alfabética', () => {
  assert.deepStrictEqual(ordenar(carregarSandbox(), 'criticidade'), ['Alfa', 'Bravo', 'Charlie', 'Zulu']);
});

test('ordena por vencimento com os sem histórico sempre no fim', () => {
  assert.deepStrictEqual(ordenar(carregarSandbox(), 'vencimento'), ['Alfa', 'Charlie', 'Zulu', 'Bravo']);
});

test('proxManut devolve a data mais próxima entre inspeção e preventiva', () => {
  const ctx = carregarSandbox();
  const insp = ctx.nextPmoc(EQUIPS[0], 'inspecao');
  assert.strictEqual(ctx.proxManut(EQUIPS[0]).getTime(), insp.getTime());
});

test('sem histórico não conta como vencido — sem data anterior não há o que vencer', () => {
  const ctx = carregarSandbox();
  assert.strictEqual(ctx.proxManut(EQUIPS[2]), null);
  assert.strictEqual(ctx.isVencido(EQUIPS[2]), false);
});

test('só o equipamento com data passada entra no filtro de vencidos', () => {
  const ctx = carregarSandbox();
  assert.deepStrictEqual(EQUIPS.filter(ctx.isVencido).map((e) => e.local), ['Alfa']);
});

test('os assets da refrigeração saíram do HTML e nenhum data URI base64 sobrou', () => {
  assert.strictEqual((HTML.match(/base64,[A-Za-z0-9+/=]{40,}/g) || []).length, 0);
  for (const arq of ['icone-192.png', 'icone-512.png', 'icone-apple-180.png', 'qr-brand.png', 'manifest.json', 'qrcode.js']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'refrigeracao', arq)), `refrigeracao/${arq} não existe`);
  }
  // CT_LOGO_URI vai parar dentro de um document.write() de janela about:blank
  // — precisa ser URL absoluta resolvida em runtime, não caminho relativo. O
  // primeiro argumento passou a caminho absoluto de raiz (260821-td4,
  // D-td4-01/02): a rota sem barra final do vercel.json resolve relativo
  // simples contra a raiz do site, não contra /refrigeracao.
  assert.match(HTML, /var CT_LOGO_URI = new URL\('\/refrigeracao\/icone-192\.png', location\.href\)\.href;/);
  // CT_QR_BRAND deixou de existir (D-td4-03): o atalho de PNG estático em
  // qrRender saiu, o QR passa a ser sempre gerado a partir da URL viva.
  assert.strictEqual(HTML.includes('CT_QR_BRAND'), false);
});

test('o viewport não bloqueia o zoom de pinça', () => {
  const m = HTML.match(/<meta name="viewport" content="([^"]+)"/);
  assert.ok(m, 'meta viewport não encontrada');
  assert.doesNotMatch(m[1], /user-scalable=no|maximum-scale/);
});
