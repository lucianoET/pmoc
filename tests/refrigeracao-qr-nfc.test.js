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

// ══════════════════════════════════════════════════════════════════
// Task 2 — QR por equipamento na ficha e na ficha impressa, etiquetas
// ══════════════════════════════════════════════════════════════════

function fakeQrcode() {
  var data = '';
  return {
    addData: function (d) { data = String(d); },
    make: function () {},
    createSvgTag: function () {
      var hash = 0;
      for (var i = 0; i < data.length; i++) hash = (hash * 31 + data.charCodeAt(i)) >>> 0;
      return '<svg xmlns="http://www.w3.org/2000/svg"><path d="M' + hash + ' 0h1v1h-1z"/></svg>';
    },
  };
}

function carregarSandboxQr(overrides) {
  const ini = HTML.indexOf('/* ── QR e etiquetas do equipamento ── */');
  const fim = HTML.indexOf('/* ══ IMPRESSÃO DA OS ══ */', ini);
  assert.ok(ini > 0 && fim > ini, 'bloco "QR e etiquetas do equipamento" não encontrado');
  const chamadas = { showToast: [], imprimirDocumento: [] };
  const ctx = {
    PARAM_FICHA: 'equip',
    CT_APP_URL: 'https://pmoc-orcin.vercel.app/refrigeracao',
    location: { protocol: 'https:', origin: 'https://x.tld', pathname: '/refrigeracao' },
    localStorage: { getItem: function () { return null; } },
    linkSeguro(u) { return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : ''; },
    esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    DATA: [],
    showToast(msg, tipo) { chamadas.showToast.push({ msg: msg, tipo: tipo }); },
    imprimirDocumento(opcoes) { chamadas.imprimirDocumento.push(opcoes); },
    qrcode: fakeQrcode,
    navigator: {},
  };
  Object.assign(ctx, overrides || {});
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  ctx.__chamadas = chamadas;
  return ctx;
}

test('urlFichaEquip(42) devolve base + ?equip=42, sem arrastar a query nem o hash da página atual', () => {
  const ctx = carregarSandboxQr();
  assert.strictEqual(ctx.urlFichaEquip(42), 'https://x.tld/refrigeracao?equip=42');
});

test('urlBaseApp usa o pmoc_app_url salvo quando é http(s)://, e cai no endereço da própria página quando o valor é envenenado', () => {
  let ctx = carregarSandboxQr({ localStorage: { getItem: () => 'https://saved.example/app/' } });
  assert.strictEqual(ctx.urlBaseApp(), 'https://saved.example/app');

  for (const veneno of ['javascript:alert(1)', '"><img src=x>', '//outro.host']) {
    ctx = carregarSandboxQr({ localStorage: { getItem: () => veneno } });
    assert.strictEqual(ctx.urlBaseApp(), 'https://x.tld/refrigeracao', `valor "${veneno}" deveria cair no endereço da página`);
  }
});

test('qrSvgDe devolve SVG de verdade, URLs diferentes produzem desenhos diferentes, e sem qrcode devolve "" sem lançar', () => {
  const ctx = carregarSandboxQr();
  const svg1 = ctx.qrSvgDe('https://x.tld/refrigeracao?equip=1');
  assert.match(svg1, /^<svg/);
  assert.match(svg1, /<path/);
  const svg2 = ctx.qrSvgDe('https://x.tld/refrigeracao?equip=2');
  assert.notStrictEqual(svg1, svg2);

  const ctxSemQr = carregarSandboxQr({ qrcode: undefined });
  assert.doesNotThrow(() => {
    assert.strictEqual(ctxSemQr.qrSvgDe('https://x.tld'), '');
  });
});

function carregarSandboxFiltro(overrides) {
  const ini = HTML.indexOf('/* ── inventário: a seleção filtrada, com dois consumidores ── */');
  const fim = HTML.indexOf('function getAllOSEntries(){', ini);
  assert.ok(ini > 0 && fim > ini, 'bloco "inventário: a seleção filtrada" não encontrado');
  const chamadas = { imprimirEtiquetas: [] };
  const ctx = {
    equipInoperante: (e) => e.funciona === 'NOK',
    equipOperante: (e) => e.funciona === 'OK',
    equipComRestricao: (e) => e.funciona === 'OR',
    // 260821-uyz: filtrarInventario passou a exigir equipInstalado antes da
    // regra de cada chip (D-uyz-10). Nenhum item de EQUIPS_FILTRO tem
    // `situacao` — mesmo comportamento de normalizarSituacaoEquip: ausência
    // conta como instalado.
    equipInstalado: (e) => !e.situacao || e.situacao === 'instalado',
    equipRemovido: (e) => e.situacao === 'removido',
    equipBaixado: (e) => e.situacao === 'baixado',
    autoCrit: (e) => e.criticidade,
    isVencido: (e) => !!e._vencido,
    equipEstado: () => 'OP',
    proxManut: () => null,
    statusPill: () => '',
    critPill: () => '',
    dueBadgeHtml: () => '',
    esc(s) { return s == null ? '' : String(s); },
    el: () => null,
    invChip: 'todos',
    DATA: [],
    cmpInv: (a, b) => (a.id || 0) - (b.id || 0),
    imprimirEtiquetas(lista) { chamadas.imprimirEtiquetas.push(lista); },
  };
  Object.assign(ctx, overrides || {});
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  ctx.__chamadas = chamadas;
  return ctx;
}

const EQUIPS_FILTRO = [
  { id: 1, local: 'Sala A', predio: 'F21', fabricante: 'LG', funciona: 'OK', obs: '', criticidade: 'CRÍTICA', area: 'VERMELHA', _vencido: false },
  { id: 2, local: 'Sala B', predio: 'MK48', fabricante: 'Springer', funciona: 'NOK', obs: 'Verificar filtro', criticidade: 'ALTA', area: 'AZUL', _vencido: true },
  { id: 3, local: null, predio: null, fabricante: '', funciona: 'OR', obs: '', criticidade: 'MÉDIA', area: 'VERMELHA', _vencido: false },
];

test('filtrarInventario devolve a mesma seleção que o inventário mostra, para cada chip e para a busca por local/predio/fabricante — sem lançar com local/predio nulos', () => {
  const ctx = carregarSandboxFiltro();
  const porChip = {
    todos: [1, 2, 3], nok: [2], ok: [1], or: [3], ver: [2], critica: [1],
    vencidos: [2], vermelha: [1, 3], azul: [2],
  };
  for (const chip of Object.keys(porChip)) {
    const r = Array.from(ctx.filtrarInventario(EQUIPS_FILTRO, '', chip), (e) => e.id);
    assert.deepEqual(r, porChip[chip], `chip "${chip}" divergiu`);
  }
  assert.doesNotThrow(() => ctx.filtrarInventario(EQUIPS_FILTRO, 'x', 'todos'));
  assert.deepEqual(Array.from(ctx.filtrarInventario(EQUIPS_FILTRO, 'sala a', 'todos'), (e) => e.id), [1]);
  assert.deepEqual(Array.from(ctx.filtrarInventario(EQUIPS_FILTRO, 'mk48', 'todos'), (e) => e.id), [2]);
  assert.deepEqual(Array.from(ctx.filtrarInventario(EQUIPS_FILTRO, 'spring', 'todos'), (e) => e.id), [2]);
});

test('a folha de etiquetas leva exatamente a seleção de filtrarInventario, comparação por id', () => {
  const ctx = carregarSandboxFiltro({ invChip: 'vermelha' });
  ctx.DATA = EQUIPS_FILTRO;
  ctx.etiquetasDoInventario();
  assert.strictEqual(ctx.__chamadas.imprimirEtiquetas.length, 1);
  const entregue = Array.from(ctx.__chamadas.imprimirEtiquetas[0], (e) => e.id);
  const esperado = Array.from(ctx.filtrarInventario(EQUIPS_FILTRO, '', 'vermelha'), (e) => e.id);
  assert.deepEqual(entregue, esperado);
});

test('renderInv chama filtrarInventario( e a linha de "var list" não inlina mais o DATA.filter antigo', () => {
  const ini = HTML.indexOf('function renderInv(){');
  const fim = HTML.indexOf('\n}', ini);
  assert.ok(ini > 0 && fim > ini, 'renderInv não encontrada');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /filtrarInventario\(/);
  const idxList = corpo.indexOf('var list =');
  const linha = corpo.slice(idxList, corpo.indexOf('\n', idxList));
  assert.doesNotMatch(linha, /DATA\.filter\(/);
});

test('imprimirEtiquetas([]) e imprimirEtiquetas() avisam e não chamam imprimirDocumento nenhuma vez', () => {
  const ctx = carregarSandboxQr();
  ctx.imprimirEtiquetas([]);
  ctx.imprimirEtiquetas();
  assert.strictEqual(ctx.__chamadas.showToast.length, 2);
  assert.strictEqual(ctx.__chamadas.imprimirDocumento.length, 0);
});

test('imprimirEtiquetas com 3 equipamentos chama imprimirDocumento uma vez, com assinaturas vazias, estilo não vazio, e 3 etiquetas com QR', () => {
  const ctx = carregarSandboxQr();
  const lista = [
    { id: 1, local: 'A', predio: 'P1', tipo: 'SPLIT' },
    { id: 2, local: 'B', predio: 'P2', tipo: 'SPLIT' },
    { id: 3, local: 'C', predio: 'P3', tipo: 'SPLIT' },
  ];
  ctx.imprimirEtiquetas(lista);
  assert.strictEqual(ctx.__chamadas.imprimirDocumento.length, 1);
  const opcoes = ctx.__chamadas.imprimirDocumento[0];
  assert.strictEqual(opcoes.assinaturas.length, 0);
  assert.ok(opcoes.estilo && opcoes.estilo.length > 0);
  assert.strictEqual((opcoes.corpo.match(/class="etq"/g) || []).length, 3);
  assert.strictEqual((opcoes.corpo.match(/<svg/g) || []).length, 3);
});

test('etiquetaHtml de um equipamento com local marcado produz saída sem <img e com a forma escapada', () => {
  const ctx = carregarSandboxQr();
  const h = ctx.etiquetaHtml({ id: 9, local: '<img src=x onerror=alert(1)>', predio: 'F21', tipo: 'SPLIT' });
  assert.doesNotMatch(h, /<img src=x onerror/);
  assert.match(h, /&lt;img/);
});

test('o corpo de printFicha referencia qrSvgDe( e passa estilo:, sem window.open nem declaração de página própria', () => {
  const ini = HTML.indexOf('function printFicha(equipId){');
  const fim = HTML.indexOf('\n}', ini);
  assert.ok(ini > 0 && fim > ini, 'printFicha não encontrada');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /qrSvgDe\(/);
  assert.match(corpo, /estilo:/);
  assert.doesNotMatch(corpo, /window\.open\(/);
  assert.doesNotMatch(corpo, /@page\{size:A4/);
});

test('no arquivo inteiro, window.open( e a declaração de página A4 continuam em 1 ocorrência cada — a etiqueta não abriu segunda folha', () => {
  assert.strictEqual((HTML.match(/window\.open\(/g) || []).length, 1);
  assert.strictEqual((HTML.match(/@page\{size:A4/g) || []).length, 1);
});

test('qrGetUrl chama urlBaseApp() e não referencia location.href', () => {
  const ini = HTML.indexOf('function qrGetUrl(){');
  const fim = HTML.indexOf('\n}', ini);
  assert.ok(ini > 0 && fim > ini, 'qrGetUrl não encontrada');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /urlBaseApp\(\)/);
  assert.doesNotMatch(corpo, /location\.href/);
});

test('os quatro grep do PLAT-15 continuam em 0 em refrigeracao/index.html', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.equal((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});

// ══════════════════════════════════════════════════════════════════
// Task 3 — gravação de tag NFC condicional
// ══════════════════════════════════════════════════════════════════

function carregarSandboxNfc(overrides) {
  const ini = HTML.indexOf('/* ── NFC: gravação de tag ── */');
  const fim = HTML.indexOf('/* ══ IMPRESSÃO DA OS ══ */', ini);
  assert.ok(ini > 0 && fim > ini, 'bloco "NFC: gravação de tag" não encontrado');
  const chamadas = { showToast: [], setTimeout: [], clearTimeout: [] };
  const ctx = {
    window: {},
    showToast(msg, tipo) { chamadas.showToast.push({ msg: msg, tipo: tipo }); },
    urlFichaEquip(id) { return 'https://x.tld/refrigeracao?equip=' + id; },
    AbortController: AbortController,
    setTimeout(fn, ms) { const id = setTimeout(fn, ms); chamadas.setTimeout.push(id); return id; },
    clearTimeout(id) { chamadas.clearTimeout.push(id); return clearTimeout(id); },
  };
  Object.assign(ctx, overrides || {});
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  ctx.__chamadas = chamadas;
  return ctx;
}

test('nfcDisponivel() é true só com NDEFReader presente E isSecureContext===true; false nos três outros arranjos', () => {
  let ctx = carregarSandboxNfc({ window: { NDEFReader: function () {}, isSecureContext: true } });
  assert.strictEqual(ctx.nfcDisponivel(), true);

  ctx = carregarSandboxNfc({ window: { isSecureContext: true } }); // sem leitor
  assert.strictEqual(ctx.nfcDisponivel(), false);

  ctx = carregarSandboxNfc({ window: { NDEFReader: function () {}, isSecureContext: false } }); // sem contexto seguro
  assert.strictEqual(ctx.nfcDisponivel(), false);

  ctx = carregarSandboxNfc({ window: {} }); // sem nenhum dos dois
  assert.strictEqual(ctx.nfcDisponivel(), false);
});

test('mensagemErroNfc devolve frase distinta para cada um dos cinco nomes; nome desconhecido trata a mensagem (com e sem parênteses vazio); nunca contém undefined/null', () => {
  const ctx = carregarSandboxNfc({ window: {} });
  const nomes = ['NotAllowedError', 'NotSupportedError', 'NotReadableError', 'NetworkError', 'AbortError'];
  const frases = nomes.map((n) => ctx.mensagemErroNfc(n));
  const generica = ctx.mensagemErroNfc('QualquerOutraCoisa');
  const todas = frases.concat([generica]);
  assert.strictEqual(new Set(todas).size, todas.length, 'todas as frases deveriam ser distintas');
  for (const f of todas) {
    assert.doesNotMatch(f, /undefined/);
    assert.doesNotMatch(f, /null/);
  }
  const comMsg = ctx.mensagemErroNfc('OutraCoisa', 'detalhe tal');
  assert.match(comMsg, /detalhe tal/);
  assert.doesNotMatch(generica, /\(\)/); // sem parênteses vazio quando não há mensagem
});

test('gravarTagNfc(7) num contexto com suporte chama write uma vez, com records[0].recordType "url", records[0].data === urlFichaEquip(7), e um segundo argumento com signal', async () => {
  const chamadasWrite = [];
  function FakeReader() {}
  FakeReader.prototype.write = function (msg, opts) {
    chamadasWrite.push({ msg: msg, opts: opts });
    return Promise.resolve();
  };
  const ctx = carregarSandboxNfc({ window: { NDEFReader: FakeReader, isSecureContext: true } });
  const r = await ctx.gravarTagNfc(7);
  assert.strictEqual(r, true);
  assert.strictEqual(chamadasWrite.length, 1);
  assert.strictEqual(chamadasWrite[0].msg.records[0].recordType, 'url');
  assert.strictEqual(chamadasWrite[0].msg.records[0].data, ctx.urlFichaEquip(7));
  assert.ok(chamadasWrite[0].opts && chamadasWrite[0].opts.signal);
});

test('gravarTagNfc cuja escrita rejeita com NetworkError devolve false, avisa com a frase daquele nome, e não lança', async () => {
  function FakeReader() {}
  FakeReader.prototype.write = function () {
    var err = new Error('tag afastada');
    err.name = 'NetworkError';
    return Promise.reject(err);
  };
  const ctx = carregarSandboxNfc({ window: { NDEFReader: FakeReader, isSecureContext: true } });
  let r;
  await assert.doesNotReject(async () => { r = await ctx.gravarTagNfc(3); });
  assert.strictEqual(r, false);
  const ultimo = ctx.__chamadas.showToast[ctx.__chamadas.showToast.length - 1];
  assert.strictEqual(ultimo.msg, ctx.mensagemErroNfc('NetworkError'));
  assert.strictEqual(ultimo.tipo, 'error');
});

test('gravarTagNfc num contexto sem suporte devolve false, avisa, e o construtor de NDEFReader não é chamado nenhuma vez', async () => {
  let construido = 0;
  function FakeReader() { construido++; }
  FakeReader.prototype.write = function () { return Promise.resolve(); };
  const ctx = carregarSandboxNfc({ window: { NDEFReader: FakeReader, isSecureContext: false } });
  const r = await ctx.gravarTagNfc(5);
  assert.strictEqual(r, false);
  assert.strictEqual(construido, 0);
  assert.strictEqual(ctx.__chamadas.showToast.length, 1);
});

test('clearTimeout é chamado tanto no sucesso quanto na falha, com o mesmo identificador devolvido por setTimeout', async () => {
  function FakeReaderOk() {}
  FakeReaderOk.prototype.write = function () { return Promise.resolve(); };
  let ctx = carregarSandboxNfc({ window: { NDEFReader: FakeReaderOk, isSecureContext: true } });
  await ctx.gravarTagNfc(1);
  assert.strictEqual(ctx.__chamadas.setTimeout.length, 1);
  assert.strictEqual(ctx.__chamadas.clearTimeout.length, 1);
  assert.strictEqual(ctx.__chamadas.clearTimeout[0], ctx.__chamadas.setTimeout[0]);

  function FakeReaderFail() {}
  FakeReaderFail.prototype.write = function () {
    var e = new Error('sem tag');
    e.name = 'AbortError';
    return Promise.reject(e);
  };
  ctx = carregarSandboxNfc({ window: { NDEFReader: FakeReaderFail, isSecureContext: true } });
  await ctx.gravarTagNfc(1);
  assert.strictEqual(ctx.__chamadas.setTimeout.length, 1);
  assert.strictEqual(ctx.__chamadas.clearTimeout.length, 1);
  assert.strictEqual(ctx.__chamadas.clearTimeout[0], ctx.__chamadas.setTimeout[0]);
});

test('blocoNfc(7) com suporte contém gravarTagNfc(7 e um <button; sem suporte não contém <button e contém a instrução de gravar por app de NFC', () => {
  let ctx = carregarSandboxNfc({ window: { NDEFReader: function () {}, isSecureContext: true } });
  let h = ctx.blocoNfc(7);
  assert.match(h, /gravarTagNfc\(7/);
  assert.match(h, /<button/);

  ctx = carregarSandboxNfc({ window: {} });
  h = ctx.blocoNfc(7);
  assert.doesNotMatch(h, /<button/);
  assert.match(h, /NFC/);
});

test('blocoQrFicha chama blocoNfc( e não repete a instrução de gravação por conta própria', () => {
  const ini = HTML.indexOf('function blocoQrFicha(id){');
  const fim = HTML.indexOf('\n}', ini);
  assert.ok(ini > 0 && fim > ini, 'blocoQrFicha não encontrada');
  const corpo = HTML.slice(ini, fim);
  assert.match(corpo, /blocoNfc\(/);
  assert.doesNotMatch(corpo, /grave com qualquer app de NFC/);
});

test('os quatro grep do PLAT-15 continuam em 0 em refrigeracao/index.html (Task 3)', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.equal((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
