// Gate da quick-260823-3a6 — barra do topo limpa com navegação (Tarefa 1) e
// as doze colunas do parque (Tarefa 2), em /refrigeracao.
//
// D-3a6-19: este arquivo foi escrito e visto FALHANDO antes da mudança
// existir em refrigeracao/index.html — mesmo procedimento de 260822-8rz.
//
// D-3a6-16/17: nenhum caso aqui compara CSS fora do @media contra o
// fixture — isso é tests/refrigeracao-desktop.test.js#D-8rz-04, permanente,
// e continuar verde é o critério desta tarefa (não duplicado aqui).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

function eq(actual, expected, message) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

// ── extração do @media (min-width:1024px) — mesmo algoritmo de casamento
// de chaves usado em tests/refrigeracao-desktop.test.js, mas devolvendo o
// CONTEÚDO do bloco em vez do que fica FORA dele. ──
function extrairBlocoMedia1024(html) {
  var blocos = [];
  var re = /<style>([\s\S]*?)<\/style>/g;
  var m;
  while ((m = re.exec(html))) blocos.push(m[1]);
  var css = blocos.join('\n');
  var idx = css.indexOf('@media (min-width:1024px)');
  assert.ok(idx >= 0, '@media (min-width:1024px) não encontrado');
  var open = css.indexOf('{', idx);
  var depth = 1;
  var j = open + 1;
  while (j < css.length && depth > 0) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') depth--;
    j++;
  }
  return css.slice(open + 1, j - 1);
}

// ── mesmo sandbox node:vm do gate de ontem (tests/refrigeracao-desktop.
// test.js#carregarSandbox): dois recortes reais do arquivo — A (PMOC_INT
// até renderInv) e B (o núcleo novo de tabelas de desktop, que é onde
// COLS_INV mora). getEquipLog é mockado aqui e sobrescrito por teste. ──
function carregarSandbox() {
  const ctx = {
    DATA: [],
    ctUser: null,
    somenteLeitura() { return false; },
    document: {
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    window: {},
    getLatestLogDate() { return null; },
    getEquipLog() { return []; },
    ocupantesDoLocal() { return 0; },
    casoDeInstalacao() { return 'novo'; },
    CASOS_INSTALACAO: { novo: 'Novo local (sem ocupante)' },
    ctEquip(id) { return { id, local: 'Local ' + id, predio: 'Predio ' + id }; },
    ctOrcTotal() { return 0; },
    CT_STATUS: { SOLICITADA: { label: 'Aguard. orçamento', bg: '#fff', fg: '#000' } },
    ctStatusPill(s) { return '<span class="ct-status">' + s + '</span>'; },
    fmtMoney(v) { return 'R$ ' + Number(v || 0).toFixed(2); },
  };
  vm.createContext(ctx);

  vm.runInContext(recorte('var PMOC_INT = {', 'function renderInv(){'), ctx);
  vm.runInContext(
    recorte('/* ── tabelas de desktop: núcleo puro ── */', '</script>'),
    ctx
  );

  return ctx;
}

function equipTeste(over) {
  return Object.assign(
    {
      id: 1, local: 'Sala 1', predio: 'F21', area: 'VERMELHA', tipo: 'Split',
      fabricante: 'LG', modelo: 'X100', btu: 12000, funciona: 'OP', criticidade: 'ALTA',
      obs: '', situacao: 'instalado', ultimaManutencao: '2026-01-01',
    },
    over || {}
  );
}

function col(colunas, id) {
  return colunas.find((c) => c.id === id);
}

// ═══════════════════════ TAREFA 1 — barra do topo, rótulos ══════════════

test('a inscrição institucional aparece exatamente 2 vezes no arquivo inteiro (as duas telas de login)', () => {
  const ocorrencias = (HTML.match(/CMASM · DME · UASG 744030/g) || []).length;
  assert.equal(ocorrencias, 2, `esperado 2, achado ${ocorrencias}`);
});

test('a região #topbar não contém a inscrição institucional nem nenhum <span>', () => {
  const trecho = recorte('<div id="topbar">', '</div>');
  assert.doesNotMatch(trecho, /CMASM · DME · UASG 744030/);
  assert.doesNotMatch(trecho, /<span/);
});

test('#bottom-nav mantém 5 .nav-btn, ordem dash,inv,os,pmoc,alert, com os rótulos Painel/Parque/OS/PMOC/Alertas', () => {
  const ini = HTML.indexOf('<div id="bottom-nav">');
  assert.ok(ini > 0, '#bottom-nav não encontrado');
  const fim = HTML.indexOf('</div>', ini);
  const trecho = HTML.slice(ini, fim);
  const qtd = (trecho.match(/class="nav-btn/g) || []).length;
  assert.equal(qtd, 5);
  const rotulos = Array.from(trecho.matchAll(/<\/i>\s*([^<\n]*)/g)).map((m) => m[1].trim());
  eq(rotulos, ['Painel', 'Parque', 'OS', 'PMOC', 'Alertas']);
});

test('os identificadores de D-3a6-04 continuam todos presentes no arquivo', () => {
  const IDENTS = [
    'id="page-inv"', 'id="page-dash"', "navTo('inv'", "navTo('dash'",
    'function renderInv', 'function renderDash', 'id="inv-list"', 'id="inv-chips"',
    'id="inv-cnt"', 'id="inv-label"', 'id="inv-ordem"', 'invChip', 'invOrdem',
    'filtrarInventario', 'etiquetasDoInventario', 'exportarInventarioCsv',
    'COLS_INV', 'TAB_ESTADO.inv', 'PLANILHA_MARCA', 'pmoc-refrigeracao-inventario-',
  ];
  IDENTS.forEach((id) => assert.ok(HTML.includes(id), `identificador ausente: ${id}`));
});

test('#btn-planilha fala em "parque" no title e no aria-label, e nenhum dos dois fala em "inventário"', () => {
  const ini = HTML.indexOf('id="btn-planilha"');
  assert.ok(ini > 0, '#btn-planilha não encontrado');
  const fimTag = HTML.indexOf('>', ini);
  const trecho = HTML.slice(ini, fimTag);
  const titleMatch = trecho.match(/title="([^"]*)"/);
  const ariaMatch = trecho.match(/aria-label="([^"]*)"/);
  assert.ok(titleMatch && /parque/i.test(titleMatch[1]), 'title não fala em "parque"');
  assert.ok(ariaMatch && /parque/i.test(ariaMatch[1]), 'aria-label não fala em "parque"');
  assert.doesNotMatch(trecho, /invent[aá]rio/i);
});

test("o título da gaveta da planilha é 'Planilha do parque'", () => {
  assert.match(HTML, /el\('dh-id'\)\.textContent\s*=\s*'Planilha do parque';/);
  assert.doesNotMatch(HTML, /'Planilha do inventário'/);
});

test('as 5 ocorrências de "Guardada — volta ao inventário" continuam intactas — a renomeação não vazou para o vocabulário de OS', () => {
  const ocorrencias = (HTML.match(/Guardada — volta ao invent[aá]rio/g) || []).length;
  assert.equal(ocorrencias, 5, `esperado 5, achado ${ocorrencias}`);
});

test('dentro do @media (min-width:1024px): #topbar vira display:contents, #bottom-nav ocupa a linha 1 da grade, #app fica escuro e #content claro', () => {
  const bloco = extrairBlocoMedia1024(HTML);
  assert.match(bloco, /#topbar\{[^}]*display:contents[^}]*\}/);
  assert.match(bloco, /#app\{[^}]*background:#071D41[^}]*\}/);
  assert.match(bloco, /#content\{[^}]*background:#F0F2F5[^}]*\}/);
  assert.match(bloco, /#bottom-nav\{[^}]*grid-row:1[^}]*\}/);
});

test('.nav-btn.active carrega os quatro sinais (sublinhado, fundo, peso 700, cor clara) na paleta do escuro', () => {
  const bloco = extrairBlocoMedia1024(HTML);
  assert.match(bloco, /\.nav-btn\.active\{[^}]*font-weight:700[^}]*color:#fff[^}]*\}/);
  assert.match(bloco, /\.nav-btn\.active::before\{[^}]*background:#fff[^}]*\}/);
  assert.match(bloco, /\.nav-btn\.active i\{[^}]*color:#fff[^}]*\}/);
});

test('a coluna lateral de 220px e grid-template-areas deixaram de existir no arquivo', () => {
  assert.doesNotMatch(HTML, /grid-template-areas/);
  assert.doesNotMatch(HTML, /220px/);
});

// ═══════════════════════ TAREFA 2 — as doze colunas do parque ═══════════

const COLUNAS_ESPERADAS = [
  ['id', '#'], ['area', 'Área'], ['predio', 'Prédio'], ['local', 'Local'],
  ['tipo', 'Tipo'], ['btu', 'BTU'], ['fabricante', 'Marca'], ['modelo', 'Modelo'],
  ['estado', 'Estado'], ['criticidade', 'Criticidade'], ['prox', 'Próx. manutenção'],
  ['ultimaInspecao', 'Última inspeção'],
];

test('D-3a6-24: COLS_INV tem doze colunas, com o CONJUNTO e a ORDEM exatos de id e de rótulo', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.COLS_INV.length, 12, `esperado 12 colunas, achado ${ctx.COLS_INV.length}`);
  eq(ctx.COLS_INV.map((c) => c.id), COLUNAS_ESPERADAS.map((p) => p[0]));
  eq(ctx.COLS_INV.map((c) => c.rotulo), COLUNAS_ESPERADAS.map((p) => p[1]));
});

test('COLS_INV.area: valor/texto = e.area; AZUL antes de VERMELHA crescente, o inverso decrescente; vazio no fim nas duas direções', () => {
  const ctx = carregarSandbox();
  const c = col(ctx.COLS_INV, 'area');
  const azul = equipTeste({ area: 'AZUL' });
  const vermelha = equipTeste({ area: 'VERMELHA' });
  const semArea = equipTeste({ area: '' });
  assert.equal(c.valor(azul), 'AZUL');
  assert.equal(c.texto(azul), 'AZUL');
  assert.ok(ctx.tabComparar(azul, vermelha, 'area', 'asc', ctx.COLS_INV) < 0);
  assert.ok(ctx.tabComparar(vermelha, azul, 'area', 'desc', ctx.COLS_INV) < 0);
  for (const dir of ['asc', 'desc']) {
    assert.ok(ctx.tabComparar(azul, semArea, 'area', dir, ctx.COLS_INV) < 0);
    assert.ok(ctx.tabComparar(semArea, azul, 'area', dir, ctx.COLS_INV) > 0);
  }
});

test('COLS_INV.predio: texto() é só o prédio (a forma composta morreu); mesmo prédio e área diferente empata em predio e desempata em area', () => {
  const ctx = carregarSandbox();
  const a = equipTeste({ id: 1, predio: 'F21', area: 'ZZZ' });
  const b = equipTeste({ id: 2, predio: 'F21', area: 'AAA' });
  assert.equal(ctx.tabComparar(a, b, 'predio', 'asc', ctx.COLS_INV), 0);
  assert.notEqual(ctx.tabComparar(a, b, 'area', 'asc', ctx.COLS_INV), 0);
  const c = col(ctx.COLS_INV, 'predio');
  assert.equal(c.texto(a), 'F21');
});

test('COLS_INV.fabricante: rótulo Marca, ordena por e.fabricante, vazio no fim nas duas direções', () => {
  const ctx = carregarSandbox();
  const c = col(ctx.COLS_INV, 'fabricante');
  assert.equal(c.rotulo, 'Marca');
  const lg = equipTeste({ fabricante: 'LG' });
  const springer = equipTeste({ fabricante: 'Springer' });
  const semMarca = equipTeste({ fabricante: '' });
  assert.ok(ctx.tabComparar(lg, springer, 'fabricante', 'asc', ctx.COLS_INV) < 0);
  for (const dir of ['asc', 'desc']) {
    assert.ok(ctx.tabComparar(lg, semMarca, 'fabricante', dir, ctx.COLS_INV) < 0);
  }
});

test('COLS_INV.modelo: rótulo Modelo, tolera e.modelo nulo sem lançar em valor/texto/ordenação/filtro, e nulo vai para o fim nas duas direções', () => {
  const ctx = carregarSandbox();
  const c = col(ctx.COLS_INV, 'modelo');
  assert.equal(c.rotulo, 'Modelo');
  const comModelo = equipTeste({ modelo: 'X100' });
  const semModelo = equipTeste({ modelo: null });
  assert.doesNotThrow(() => c.valor(semModelo));
  assert.doesNotThrow(() => c.texto(semModelo));
  for (const dir of ['asc', 'desc']) {
    assert.doesNotThrow(() => ctx.tabComparar(comModelo, semModelo, 'modelo', dir, ctx.COLS_INV));
    assert.ok(ctx.tabComparar(comModelo, semModelo, 'modelo', dir, ctx.COLS_INV) < 0);
  }
  assert.doesNotThrow(() => ctx.filtrarInventario([comModelo, semModelo], '', 'todos', { modelo: 'x100' }));
});

test("COLS_INV.ultimaInspecao: equipamento com inspeções E corretivas devolve a data da INSPEÇÃO mais recente, mesmo havendo corretiva posterior", () => {
  const ctx = carregarSandbox();
  ctx.getEquipLog = (id) => (id === 1 ? [
    { date: '2026-01-10', tipo: 'INSPEÇÃO' },
    { date: '2026-03-15', tipo: 'CORRETIVA' },
    { date: '2026-02-20', tipo: 'INSPEÇÃO' },
  ] : []);
  const c = col(ctx.COLS_INV, 'ultimaInspecao');
  const e = equipTeste({ id: 1 });
  assert.equal(c.texto(e), '20/02/2026');
  assert.equal(c.valor(e), new Date('2026-02-20T12:00:00').getTime());
});

test('COLS_INV.ultimaInspecao: equipamento só com corretivas (ou sem log nenhum) devolve "Sem hist." e vai para o fim nas duas direções', () => {
  const ctx = carregarSandbox();
  ctx.getEquipLog = (id) => (id === 2 ? [{ date: '2026-05-01', tipo: 'CORRETIVA' }] : []);
  const c = col(ctx.COLS_INV, 'ultimaInspecao');
  const soCorretiva = equipTeste({ id: 2 });
  const semLogNenhum = equipTeste({ id: 3 });
  assert.equal(c.texto(soCorretiva), 'Sem hist.');
  assert.equal(c.valor(soCorretiva), null);
  assert.equal(c.texto(semLogNenhum), 'Sem hist.');
  const comInspecao = equipTeste({ id: 1 });
  ctx.getEquipLog = (id) => (id === 1 ? [{ date: '2026-01-01', tipo: 'INSPEÇÃO' }] : []);
  for (const dir of ['asc', 'desc']) {
    assert.ok(ctx.tabComparar(comInspecao, soCorretiva, 'ultimaInspecao', dir, ctx.COLS_INV) < 0);
  }
});

test('COLS_INV.ultimaInspecao: a varredura não ordena o array de getEquipLog no lugar — dois valor() seguidos devolvem o mesmo instante e o log continua na ordem em que chegou', () => {
  const ctx = carregarSandbox();
  const log = [
    { date: '2026-01-10', tipo: 'INSPEÇÃO' },
    { date: '2026-03-15', tipo: 'CORRETIVA' },
    { date: '2026-02-20', tipo: 'INSPEÇÃO' },
  ];
  ctx.getEquipLog = (id) => (id === 1 ? log : []);
  const c = col(ctx.COLS_INV, 'ultimaInspecao');
  const e = equipTeste({ id: 1 });
  const v1 = c.valor(e);
  const v2 = c.valor(e);
  assert.equal(v1, v2);
  eq(log.map((l) => l.date), ['2026-01-10', '2026-03-15', '2026-02-20']);
});

test('filtrarInventario com o quarto argumento filtra por area, sozinho e em conjunção com fabricante', () => {
  const ctx = carregarSandbox();
  const dados = [
    equipTeste({ id: 1, area: 'VERMELHA', fabricante: 'Springer' }),
    equipTeste({ id: 2, area: 'AZUL', fabricante: 'LG' }),
    equipTeste({ id: 3, area: 'VERMELHA', fabricante: 'LG' }),
  ];
  const r1 = ctx.filtrarInventario(dados, '', 'todos', { area: 'vermelha' });
  eq(r1.map((e) => e.id), [1, 3]);
  const r2 = ctx.filtrarInventario(dados, '', 'todos', { area: 'vermelha', fabricante: 'springer' });
  eq(r2.map((e) => e.id), [1]);
});

test('filtrarInventario: filtrar por ultimaInspecao casa o texto dd/mm/aaaa', () => {
  const ctx = carregarSandbox();
  ctx.getEquipLog = (id) => (id === 1 ? [{ date: '2026-02-20', tipo: 'INSPEÇÃO' }] : []);
  const dados = [equipTeste({ id: 1 }), equipTeste({ id: 2 })];
  const r = ctx.filtrarInventario(dados, '', 'todos', { ultimaInspecao: '20/02/2026' });
  eq(r.map((e) => e.id), [1]);
});

test('filtrarInventario com três argumentos continua devolvendo exatamente o de antes', () => {
  const ctx = carregarSandbox();
  const dados = [equipTeste({ id: 1, funciona: 'INOP' }), equipTeste({ id: 2, funciona: 'OP' })];
  const r = ctx.filtrarInventario(dados, '', 'nok');
  eq(r.map((e) => e.id), [1]);
});

test('tabCabecalho e tabCorpo emitem doze <th>/<td> na ordem de COLS_INV', () => {
  const ctx = carregarSandbox();
  const cab = ctx.tabCabecalho('inv', ctx.COLS_INV);
  // [ >] evita casar o <thead> que abre o cabeçalho (prefixo de <th).
  assert.equal((cab.match(/<th[ >]/g) || []).length, 12);
  const corpo = ctx.tabCorpo('inv', ctx.COLS_INV, [equipTeste({ id: 1 })], 'openDetail');
  assert.equal((corpo.match(/<td/g) || []).length, 12);
});

test('um fabricante ou modelo contendo <script> sai escapado na célula', () => {
  const ctx = carregarSandbox();
  const e = equipTeste({ id: 1, fabricante: '<script>alert(1)</script>', modelo: '<script>x</script>' });
  const corpo = ctx.tabCorpo('inv', ctx.COLS_INV, [e], 'openDetail');
  assert.doesNotMatch(corpo, /<script>alert/);
  assert.doesNotMatch(corpo, /<script>x</);
  assert.match(corpo, /&lt;script&gt;/);
});

test('D-3a6-23: dentro do @media, #inv-list ganha overflow:auto e um teto de altura — o cabeçalho grudento depende disso', () => {
  const bloco = extrairBlocoMedia1024(HTML);
  assert.match(bloco, /#inv-list\{[^}]*overflow:auto[^}]*\}/);
  assert.match(bloco, /#inv-list\{[^}]*max-height:[^}]*\}/);
});
