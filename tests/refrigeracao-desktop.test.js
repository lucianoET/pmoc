// Gate da quick-260822-8rz — versão de computador de /refrigeracao: núcleo
// puro de tabela (modo de tela, ordenação, filtro, colunas), layout de
// computador (Tarefa 2) e as seis tabelas desenhadas por um único
// desenhista (Tarefa 3).
//
// D-8rz-25: este arquivo foi escrito e visto FALHANDO antes do núcleo
// existir em refrigeracao/index.html — o mesmo procedimento de 260822-48m.
//
// D-8rz-03: a lógica é replicada DENTRO do arquivo (D-04 proíbe importar de
// shared/), então este gate recorta o trecho novo do HTML e o avalia num
// sandbox node:vm, no padrão dos outros 15 gates de refrigeração — mocks
// determinísticos para as dependências que já têm gate próprio (autoCrit,
// nextPmoc, CRIT_ORDEM…), e o código REAL do arquivo para o que está sob
// teste aqui.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'refrigeracao-css-mobile.css'), 'utf8');

// ── extração do CSS fora de @media — MESMO código usado para gerar o
// fixture (nenhuma segunda extração inventada, conforme a ação da Tarefa 1). ──
function extrairCssForaDeMedia(html) {
  var blocos = [];
  var re = /<style>([\s\S]*?)<\/style>/g;
  var m;
  while ((m = re.exec(html))) blocos.push(m[1]);
  var css = blocos.join('\n');
  var out = '';
  var i = 0;
  while (i < css.length) {
    var idx = css.indexOf('@media', i);
    if (idx === -1) { out += css.slice(i); break; }
    out += css.slice(i, idx);
    var open = css.indexOf('{', idx);
    var depth = 1;
    var j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    i = j;
  }
  return out;
}

// Objetos criados DENTRO do sandbox (node:vm) têm Object.prototype/
// Array.prototype de outro realm — deepStrictEqual contra um literal do
// realm principal falha por "mesma estrutura, não referência-igual" mesmo
// quando o conteúdo é idêntico (mesma armadilha de tests/refrigeracao-
// planilha.test.js). `eq` compara pela forma serializada.
function eq(actual, expected, message) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

// ── carregarSandbox: dois recortes num contexto só ───────────────────────
// A — código REAL do arquivo (PMOC_INT até renderInv): esc/fmtDate, o
//     vocabulário de estado/situação do equipamento, autoCrit, nextPmoc,
//     CRIT_ORDEM, proxManut, isVencido, cmpInv, setInvOrdem, setChip,
//     filtrarInventario — tudo isso já tem gate próprio em outro arquivo;
//     aqui é reusado, não retestado.
// B — o núcleo NOVO desta tarefa: tabelas de desktop (núcleo puro, colunas,
//     estado por tabela, linhas de alerta).
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
    // dependências de outras seções do arquivo, com gate próprio — mockadas
    // aqui só para as colunas que as consomem (COLS_MOVIM/COLS_PMOC/COLS_CONTRAT).
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

test('os dois recortes de carregarSandbox existem no HTML', () => {
  assert.doesNotThrow(() => carregarSandbox());
});

function equipTeste(over) {
  return Object.assign(
    {
      id: 1, local: 'Sala 1', predio: 'F21', area: 'VERMELHA', tipo: 'Split',
      fabricante: 'LG', btu: 12000, funciona: 'OP', criticidade: 'ALTA',
      obs: '', situacao: 'instalado', ultimaManutencao: '2026-01-01',
    },
    over || {}
  );
}

// ═══════════════════ 1. modoDaTela ═══════════════════════════════════════

test('modoDaTela(1023) é cartao; modoDaTela(1024) e (1920) são tabela', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.modoDaTela(1023), 'cartao');
  assert.equal(ctx.modoDaTela(1024), 'tabela');
  assert.equal(ctx.modoDaTela(1920), 'tabela');
});

// ═══════════════════ 2. tabProximaOrdem ══════════════════════════════════

test('tabProximaOrdem: ciclo travado nulo→asc→desc→nulo, qualquer lixo entra como nulo', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.tabProximaOrdem(null), 'asc');
  assert.equal(ctx.tabProximaOrdem('asc'), 'desc');
  assert.equal(ctx.tabProximaOrdem('desc'), null);
  assert.equal(ctx.tabProximaOrdem('lixo'), 'asc');
});

// ═══════════════════ 3. tabNormalizar ════════════════════════════════════

test('tabNormalizar: minúsculas + NFD sem diacríticos, tolera null/undefined/número', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.tabNormalizar('Óleo'), ctx.tabNormalizar('oleo'));
  assert.doesNotThrow(() => ctx.tabNormalizar(null));
  assert.doesNotThrow(() => ctx.tabNormalizar(undefined));
  assert.equal(ctx.tabNormalizar(42), '42');
});

// ═══════════════════ 4/5/6. tabComparar ══════════════════════════════════

const COLUNAS_NUM = [{ id: 'n', tipo: 'numero', valor: (x) => x.n, texto: (x) => String(x.n) }];
const COLUNAS_TXT = [{ id: 't', tipo: 'texto', valor: (x) => x.t, texto: (x) => x.t }];

test('tabComparar numérica: 2 antes de 10 crescente, 10 antes de 2 decrescente', () => {
  const ctx = carregarSandbox();
  assert.ok(ctx.tabComparar({ n: 2 }, { n: 10 }, 'n', 'asc', COLUNAS_NUM) < 0);
  assert.ok(ctx.tabComparar({ n: 10 }, { n: 2 }, 'n', 'desc', COLUNAS_NUM) < 0);
});

test('tabComparar numérica: null/undefined/vazio/NaN sempre no fim, nas duas direções; zero ordena como número', () => {
  const ctx = carregarSandbox();
  for (const dir of ['asc', 'desc']) {
    assert.ok(ctx.tabComparar({ n: 5 }, { n: null }, 'n', dir, COLUNAS_NUM) < 0);
    assert.ok(ctx.tabComparar({ n: null }, { n: 5 }, 'n', dir, COLUNAS_NUM) > 0);
    assert.ok(ctx.tabComparar({ n: 5 }, { n: undefined }, 'n', dir, COLUNAS_NUM) < 0);
    assert.ok(ctx.tabComparar({ n: 5 }, { n: '' }, 'n', dir, COLUNAS_NUM) < 0);
    assert.ok(ctx.tabComparar({ n: 5 }, { n: NaN }, 'n', dir, COLUNAS_NUM) < 0);
  }
  // zero não é vazio: 0 antes de 5 crescente, depois de 5 decrescente
  assert.ok(ctx.tabComparar({ n: 0 }, { n: 5 }, 'n', 'asc', COLUNAS_NUM) < 0);
  assert.ok(ctx.tabComparar({ n: 0 }, { n: 5 }, 'n', 'desc', COLUNAS_NUM) > 0);
});

test('tabComparar de texto: localeCompare pt-BR (Ácido antes de Bravo); vazio no fim nas duas direções', () => {
  const ctx = carregarSandbox();
  assert.ok(ctx.tabComparar({ t: 'Ácido' }, { t: 'Bravo' }, 't', 'asc', COLUNAS_TXT) < 0);
  for (const dir of ['asc', 'desc']) {
    assert.ok(ctx.tabComparar({ t: 'Bravo' }, { t: '' }, 't', dir, COLUNAS_TXT) < 0);
    assert.ok(ctx.tabComparar({ t: '' }, { t: 'Bravo' }, 't', dir, COLUNAS_TXT) > 0);
  }
});

test('tabComparar com coluna que não existe na definição devolve 0 — nem ordena nem quebra', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.tabComparar({ n: 1 }, { n: 2 }, 'fantasma', 'asc', COLUNAS_NUM), 0);
});

// ═══════════════════ 7. tabAplicar ═══════════════════════════════════════

test('tabAplicar sem ord.coluna preserva a ordem de entrada', () => {
  const ctx = carregarSandbox();
  const lista = [{ n: 3 }, { n: 1 }, { n: 2 }];
  const r = ctx.tabAplicar(lista, { coluna: null, dir: null }, {}, COLUNAS_NUM);
  assert.deepStrictEqual(r.map((x) => x.n), [3, 1, 2]);
});

test('tabAplicar: filtros múltiplos combinam em conjunção', () => {
  const ctx = carregarSandbox();
  const colunas = [
    { id: 'a', tipo: 'texto', valor: (x) => x.a, texto: (x) => x.a },
    { id: 'b', tipo: 'texto', valor: (x) => x.b, texto: (x) => x.b },
  ];
  const lista = [{ a: 'norte', b: 'sul' }, { a: 'norte', b: 'leste' }, { a: 'oeste', b: 'sul' }];
  const r = ctx.tabAplicar(lista, { coluna: null, dir: null }, { a: 'norte', b: 'sul' }, colunas);
  assert.equal(r.length, 1);
  assert.equal(r[0].a, 'norte');
  assert.equal(r[0].b, 'sul');
});

test('tabAplicar: filtro em coluna inexistente é ignorado — não zera a lista', () => {
  const ctx = carregarSandbox();
  const lista = [{ n: 1 }, { n: 2 }];
  const r = ctx.tabAplicar(lista, { coluna: null, dir: null }, { fantasma: 'x' }, COLUNAS_NUM);
  assert.equal(r.length, 2);
});

test("tabAplicar: '>' e '<' são texto, não operador de comparação", () => {
  const ctx = carregarSandbox();
  const colunas = [{ id: 't', tipo: 'texto', valor: (x) => x.t, texto: (x) => x.t }];
  const lista = [{ t: 'menor > que 10' }, { t: 'nada a ver' }];
  const r = ctx.tabAplicar(lista, { coluna: null, dir: null }, { t: '>' }, colunas);
  assert.equal(r.length, 1);
  assert.equal(r[0].t, 'menor > que 10');
});

// ═══════════════════ 8. COLS_INV ═════════════════════════════════════════

function col(colunas, id) {
  return colunas.find((c) => c.id === id);
}

test('COLS_INV.criticidade ordena CRÍTICA→ALTA→MÉDIA→BAIXA (semântica) e filtra pelo texto CRÍTICA', () => {
  const ctx = carregarSandbox();
  const c = col(ctx.COLS_INV, 'criticidade');
  const critica = equipTeste({ criticidade: 'CRÍTICA' });
  const alta = equipTeste({ criticidade: 'ALTA' });
  const media = equipTeste({ criticidade: 'MÉDIA' });
  const baixa = equipTeste({ criticidade: 'BAIXA' });
  assert.ok(ctx.tabComparar(critica, alta, 'criticidade', 'asc', ctx.COLS_INV) < 0);
  assert.ok(ctx.tabComparar(alta, media, 'criticidade', 'asc', ctx.COLS_INV) < 0);
  assert.ok(ctx.tabComparar(media, baixa, 'criticidade', 'asc', ctx.COLS_INV) < 0);
  assert.equal(c.texto(critica), 'CRÍTICA');
});

// 260823-3a6, D-3a6-18: a coluna composta "Prédio · Área" foi separada em
// duas colunas próprias (predio e area) — a intenção continua sendo
// "prédio ordena por prédio", mas a prova passou a ser que a área NÃO
// participa da comparação de prédio, e texto() do prédio é só o prédio.
test('COLS_INV.predio ordena pelo prédio; a área não vaza para a comparação, e texto() é só o prédio (260823-3a6)', () => {
  const ctx = carregarSandbox();
  // mesmo prédio, área diferente: pelo dado principal (prédio) é empate.
  const a = equipTeste({ id: 1, predio: 'F21', area: 'ZZZ' });
  const b = equipTeste({ id: 2, predio: 'F21', area: 'AAA' });
  assert.equal(ctx.tabComparar(a, b, 'predio', 'asc', ctx.COLS_INV), 0);
  const c = col(ctx.COLS_INV, 'predio');
  assert.equal(c.texto(a), 'F21');
});

test('COLS_INV.prox: equipamento sem histórico vai para o fim nas duas direções', () => {
  const ctx = carregarSandbox();
  const semHist = equipTeste({ ultimaManutencao: null });
  const comHist = equipTeste({ ultimaManutencao: '2026-01-01' });
  for (const dir of ['asc', 'desc']) {
    assert.ok(ctx.tabComparar(comHist, semHist, 'prox', dir, ctx.COLS_INV) < 0);
  }
  const c = col(ctx.COLS_INV, 'prox');
  assert.equal(c.texto(semHist), 'Sem hist.');
});

// ═══════════════════ 9. TAB_ESTADO ════════════════════════════════════════

test('TAB_ESTADO isola as tabelas: gravar ordem em inv deixa os intacto', () => {
  const ctx = carregarSandbox();
  ctx.TAB_ESTADO.inv.ord = { coluna: 'predio', dir: 'asc' };
  assert.equal(ctx.TAB_ESTADO.os.ord.coluna, null);
  assert.deepStrictEqual(Object.keys(ctx.TAB_ESTADO), ['inv', 'os', 'movim', 'pmoc', 'alert', 'contrat']);
});

// ═══════════════════ 10. filtrarInventario (D-8rz-09) ════════════════════

test('filtrarInventario com três argumentos continua devolvendo o de sempre — comportamento idêntico', () => {
  const ctx = carregarSandbox();
  const dados = [equipTeste({ id: 1, funciona: 'INOP' }), equipTeste({ id: 2, funciona: 'OP' })];
  const r = ctx.filtrarInventario(dados, '', 'nok');
  assert.deepStrictEqual(r.map((e) => e.id), [1]);
});

test('filtrarInventario com o quarto argumento também filtra por coluna, em conjunção, sem acento e sem caixa', () => {
  const ctx = carregarSandbox();
  const dados = [
    equipTeste({ id: 1, predio: 'F21', tipo: 'Split' }),
    equipTeste({ id: 2, predio: 'MK48', tipo: 'Split' }),
    equipTeste({ id: 3, predio: 'F21', tipo: 'Piso/Teto' }),
  ];
  const r = ctx.filtrarInventario(dados, '', 'todos', { predio: 'f21', tipo: 'split' });
  assert.deepStrictEqual(r.map((e) => e.id), [1]);
});

test('filtrarInventario: filtro do quarto argumento em coluna inexistente não derruba a lista', () => {
  const ctx = carregarSandbox();
  const dados = [equipTeste({ id: 1 }), equipTeste({ id: 2 })];
  const r = ctx.filtrarInventario(dados, '', 'todos', { colunaFantasma: 'x' });
  assert.equal(r.length, 2);
});

// ═══════════════════ 11. linhasAlertas ═══════════════════════════════════

test('linhasAlertas: uma linha por par motivo×equipamento, mesma ordem das seções de hoje', () => {
  const ctx = carregarSandbox();
  const e1 = equipTeste({ id: 1, criticidade: 'CRÍTICA' });
  const e2 = equipTeste({ id: 2, criticidade: 'ALTA' });
  const ag = { nok: [e1], restricao: [], vencidos: [e2], semHist: [e1], total: 3 };
  const linhas = ctx.linhasAlertas(ag, new Date('2026-08-22T12:00:00Z'));
  assert.equal(linhas.length, 3);
  eq(linhas.map((l) => l.motivo), ['Inoperante', 'PMOC vencida', 'Sem histórico']);
  // e1 aparece duas vezes (nok e semHist) — motivos diferentes, mesmo equip
  assert.equal(linhas[0].equip.id, 1);
  assert.equal(linhas[2].equip.id, 1);
  assert.equal(linhas[1].equip.id, 2);
});

// ═══════════════ ESTRUTURAL — D-8rz-04, escala e PLAT-15 ═════════════════

test('D-8rz-04: o CSS extraído fora de @media é estritamente igual ao fixture de celular', () => {
  assert.strictEqual(extrairCssForaDeMedia(HTML), FIXTURE);
});

test('o fixture de CSS mobile tem mais de 8000 caracteres — um fixture vazio não provaria nada', () => {
  assert.ok(FIXTURE.length > 8000, `fixture tem só ${FIXTURE.length} caracteres`);
});

test('os quatro grep do PLAT-15 continuam em 0 — refrigeração segue congelada e standalone', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual(
      (HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
      0,
      `"${padrao}" apareceu em refrigeracao/index.html`
    );
  }
});

// ═══════════ TAREFA 2 — layout de computador ═════════════════════════════

function todosOsAtMedia(html) {
  var blocos = [];
  var re = /<style>([\s\S]*?)<\/style>/g;
  var m;
  while ((m = re.exec(html))) blocos.push(m[1]);
  var achados = [];
  blocos.forEach(function (css) {
    var re2 = /@media[^{]*/g;
    var mm;
    while ((mm = re2.exec(css))) achados.push(mm[0].trim());
  });
  return achados;
}

test('existe exatamente um @media NOVO dentro dos blocos <style>, e ele é (min-width:1024px)', () => {
  // A regex ingênua de <style>…</style> também casa com a folha de
  // impressão embutida como texto de JavaScript (o único @media que já
  // existia antes desta tarefa, D-8rz-04) — legítimo, pré-existente, fora
  // do escopo desta tarefa. Filtrado explicitamente, não ignorado por acaso.
  const medias = todosOsAtMedia(HTML).filter((m) => m !== '@media print');
  assert.equal(medias.length, 1, `esperado 1 @media novo, achados: ${JSON.stringify(medias)}`);
  assert.equal(medias[0], '@media (min-width:1024px)');
});

test('nenhum seletor de elemento nu (table{, th{, td{, tr{) foi acrescentado nas folhas embutidas', () => {
  const ocorrencias = (HTML.match(/(^|\})\s*(table|th|td|tr)\s*\{/gm) || []).length;
  assert.equal(ocorrencias, 0);
});

test('#bottom-nav continua com exatamente cinco .nav-btn na marcação — a navegação lateral é a mesma barra, deitada por CSS', () => {
  const ini = HTML.indexOf('<div id="bottom-nav">');
  assert.ok(ini > 0, '#bottom-nav não encontrado');
  const fim = HTML.indexOf('</div>', ini);
  const trecho = HTML.slice(ini, fim);
  const qtd = (trecho.match(/class="nav-btn/g) || []).length;
  assert.equal(qtd, 5);
});

test('aplicarModoDeTela(1023)/(1024) gravam TELA_LARGA como falso/verdadeiro — comportamento em node:vm, não regex', () => {
  const ctx = carregarSandbox();
  ctx.aplicarModoDeTela(1023);
  assert.equal(ctx.TELA_LARGA, false);
  ctx.aplicarModoDeTela(1024);
  assert.equal(ctx.TELA_LARGA, true);
});

test('aplicarModoDeTela devolve o modo calculado por modoDaTela', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.aplicarModoDeTela(500), 'cartao');
  assert.equal(ctx.aplicarModoDeTela(1600), 'tabela');
});

// ═══════════ TAREFA 3 — desenhista único, seis adaptadores ═══════════════

const COLS_TESTE = [
  { id: 'nome', rotulo: 'Nome', tipo: 'texto', valor: (x) => x.nome, texto: (x) => x.nome },
  { id: 'valor', rotulo: 'Valor', tipo: 'numero', valor: (x) => x.valor, texto: (x) => String(x.valor) },
];

test('tabCorpo de uma lista de três itens devolve três <tr>', () => {
  const ctx = carregarSandbox();
  const itens = [
    { id: 1, nome: 'A', valor: 3 },
    { id: 2, nome: 'B', valor: 1 },
    { id: 3, nome: 'C', valor: 2 },
  ];
  const html = ctx.tabCorpo('inv', COLS_TESTE, itens, 'openDetail');
  assert.equal((html.match(/<tr/g) || []).length, 3);
});

test('ordenar por uma coluna numérica muda a ordem dos identificadores na saída', () => {
  const ctx = carregarSandbox();
  const itens = [
    { id: 1, nome: 'A', valor: 3 },
    { id: 2, nome: 'B', valor: 1 },
    { id: 3, nome: 'C', valor: 2 },
  ];
  ctx.TAB_ESTADO.inv.ord = { coluna: 'valor', dir: 'asc' };
  const html = ctx.tabCorpo('inv', COLS_TESTE, itens, 'openDetail');
  const ids = Array.from(html.matchAll(/<tr onclick="openDetail\((\d+)\)">/g)).map((m) => m[1]);
  eq(ids, ['2', '3', '1']);
});

test('um filtro por coluna reduz a contagem de <tr>', () => {
  const ctx = carregarSandbox();
  const itens = [
    { id: 1, nome: 'Alfa', valor: 1 },
    { id: 2, nome: 'Beta', valor: 2 },
  ];
  ctx.TAB_ESTADO.inv.filtros = { nome: 'alfa' };
  const html = ctx.tabCorpo('inv', COLS_TESTE, itens, 'openDetail');
  assert.equal((html.match(/<tr/g) || []).length, 1);
});

test('um campo com <script> no valor do filtro sai escapado no cabeçalho gerado — nem <script cru nem aspas cruas no value', () => {
  const ctx = carregarSandbox();
  ctx.TAB_ESTADO.inv.aberto = true;
  ctx.TAB_ESTADO.inv.filtros = { nome: '"><script>alert(1)</script>' };
  const html = ctx.tabCabecalho('inv', COLS_TESTE);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /value=""><script/);
});

test('aria-sort acompanha o ciclo de ordenação', () => {
  const ctx = carregarSandbox();
  ctx.TAB_ESTADO.inv.ord = { coluna: 'valor', dir: 'asc' };
  assert.match(ctx.tabCabecalho('inv', COLS_TESTE), /aria-sort="ascending"/);
  ctx.TAB_ESTADO.inv.ord = { coluna: 'valor', dir: 'desc' };
  assert.match(ctx.tabCabecalho('inv', COLS_TESTE), /aria-sort="descending"/);
  ctx.TAB_ESTADO.inv.ord = { coluna: null, dir: null };
  assert.match(ctx.tabCabecalho('inv', COLS_TESTE), /aria-sort="none"/);
});

test('a primeira célula de dado traz um <button> com stopPropagation, e a <tr> também é clicável para o mouse', () => {
  const ctx = carregarSandbox();
  const itens = [{ id: 1, nome: 'A', valor: 3 }];
  const html = ctx.tabCorpo('inv', COLS_TESTE, itens, 'openDetail');
  assert.match(html, /<button[^>]*onclick="event\.stopPropagation\(\);openDetail\(1\)"/);
  assert.match(html, /<tr onclick="openDetail\(1\)">/);
});

test('tabOrdenarColuna: outra coluna começa em asc; a mesma avança no ciclo até voltar a nulo', () => {
  const ctx = carregarSandbox();
  ctx.renderInv = () => {}; // tabRedesenhar chama o dono da tabela — sem DOM real aqui
  ctx.tabOrdenarColuna('inv', 'valor');
  eq(ctx.TAB_ESTADO.inv.ord, { coluna: 'valor', dir: 'asc' });
  ctx.tabOrdenarColuna('inv', 'valor');
  eq(ctx.TAB_ESTADO.inv.ord, { coluna: 'valor', dir: 'desc' });
  ctx.tabOrdenarColuna('inv', 'valor');
  assert.equal(ctx.TAB_ESTADO.inv.ord.coluna, null);
});

test('tabAlternarFiltros: fechar limpa os filtros — um filtro invisível é pior que nenhum', () => {
  const ctx = carregarSandbox();
  ctx.renderInv = () => {};
  ctx.TAB_ESTADO.inv.filtros = { nome: 'x' };
  ctx.TAB_ESTADO.inv.aberto = true;
  ctx.tabAlternarFiltros('inv', 'nome');
  assert.equal(ctx.TAB_ESTADO.inv.aberto, false);
  eq(ctx.TAB_ESTADO.inv.filtros, {});
});

test('as seis tabelas têm sua própria chamada tabDesenhar — um desenhista, seis adaptadores', () => {
  for (const tid of ['inv', 'os', 'movim', 'pmoc', 'alert', 'contrat']) {
    assert.match(HTML, new RegExp(`tabDesenhar\\('${tid}'`), `tabDesenhar('${tid}' não encontrado`);
  }
});

test('estrutural: as guardas de TELA_LARGA em renderInv/renderOS/renderMovim/renderPmoc/ctRenderList vêm depois do primeiro "return;" do corpo (o ramo de lista vazia)', () => {
  const casos = [
    ['renderInv', "tabDesenhar('inv'"],
    ['renderOS', "tabDesenhar('os'"],
    ['renderMovim', "tabDesenhar('movim'"],
    ['renderPmoc', "tabDesenhar('pmoc'"],
    ['ctRenderList', "tabDesenhar('contrat'"],
  ];
  casos.forEach(([fn, guarda]) => {
    const iniFn = HTML.indexOf(`function ${fn}(){`);
    assert.ok(iniFn > 0, `${fn} não encontrada`);
    const posGuarda = HTML.indexOf(guarda, iniFn);
    assert.ok(posGuarda > iniFn, `guarda "${guarda}" não encontrada dentro de ${fn}`);
    const posReturn = HTML.indexOf('return;', iniFn);
    assert.ok(posReturn > iniFn && posReturn < posGuarda, `guarda de ${fn} não vem depois do ramo de lista vazia`);
  });
});

test('estrutural: a guarda de renderAlerts entra depois dos quatro conjuntos calculados (forma própria, D-8rz-23)', () => {
  const iniAlerts = HTML.indexOf('function renderAlerts(){');
  assert.ok(iniAlerts > 0, 'renderAlerts não encontrada');
  const posSemHistCrit = HTML.indexOf('var semHistCrit', iniAlerts);
  const posGuardaAlert = HTML.indexOf("tabDesenhar('alert'", iniAlerts);
  assert.ok(posSemHistCrit > iniAlerts, 'var semHistCrit não encontrada em renderAlerts');
  assert.ok(posGuardaAlert > posSemHistCrit, 'guarda de renderAlerts não vem depois dos quatro conjuntos calculados');
});

test('atualizarBadgeAlertas é chamada nos dois ramos de renderAlerts — sem duplicar a contagem do distintivo', () => {
  const iniAlerts = HTML.indexOf('function renderAlerts(){');
  const fimAlerts = HTML.indexOf('\nfunction atualizarBadgeAlertas', iniAlerts);
  assert.ok(iniAlerts > 0 && fimAlerts > iniAlerts, 'renderAlerts / atualizarBadgeAlertas não encontrados');
  const corpo = HTML.slice(iniAlerts, fimAlerts);
  const ocorrencias = (corpo.match(/atualizarBadgeAlertas\(ag\)/g) || []).length;
  assert.equal(ocorrencias, 2);
});
