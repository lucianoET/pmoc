// Gate da quick-260829-8yc — alinhamento, layout e filtro multivalor da
// tabela de computador do /refrigeracao.
//
// Os dois primeiros casos protegem defeitos que foram MEDIDOS no
// navegador, não deduzidos do código:
//
//   1. `.lista-tabela{overflow:hidden}` — que existia só para o
//      border-radius recortar os cantos — fazia da própria tabela o
//      scrollport mais próximo e matava o `position:sticky` do <thead>
//      (D-8rz-20). Medido: container em y=644, cabeçalho rolando até
//      y=44. É um defeito invisível na leitura do CSS: a regra do sticky
//      continua lá, escrita e correta, e não funciona. Devolver o
//      overflow "para arredondar" o reintroduz sem nenhum sintoma —
//      daí este gate.
//   2. Com o sticky funcionando, as duas linhas do <thead> grudam ambas
//      em top:0 e a de filtros cobre a de rótulos (42px medidos) — some
//      justamente o nome da coluna que se está filtrando.
//
// O resto é comportamento: alinhamento separado do tipo de ordenação,
// filtro com vários valores por coluna, e a coluna de atributos entrando
// pela sonda.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

function recorte(ini, fim) {
  const i = HTML.indexOf(ini);
  const f = HTML.indexOf(fim, i);
  assert.ok(i > 0 && f > i, `recorte "${ini}" → "${fim}" não encontrado`);
  return HTML.slice(i, f);
}

function nucleo() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(
    recorte('/* ── tabelas de desktop: núcleo puro ── */', '/* ── tabelas de desktop: colunas ── */'),
    ctx
  );
  return ctx;
}

// ── 1. CSS: os dois defeitos medidos ────────────────────────────────

// O bloco da regra `.lista-tabela{...}` — não o arquivo inteiro, senão
// qualquer `overflow:hidden` de outra regra daria falso positivo.
function regraListaTabela() {
  const ini = HTML.indexOf('.lista-tabela{');
  assert.ok(ini > 0, 'regra .lista-tabela não encontrada');
  const fim = HTML.indexOf('}', ini);
  return HTML.slice(ini, fim);
}

test('D-8yc-01: .lista-tabela não pode ter overflow — é o que mata o sticky do cabeçalho', () => {
  const regra = regraListaTabela();
  assert.ok(!/overflow\s*:\s*hidden/.test(regra),
    'overflow:hidden na .lista-tabela transforma a tabela no scrollport do <thead> e o cabeçalho ' +
    'deixa de grudar (D-8rz-20) sem nenhum sintoma no CSS. Os cantos são recortados nas células ' +
    'das pontas.');
  assert.ok(/border-radius/.test(regra), 'a tabela continua arredondada');
});

test('D-8yc-01: os cantos são recortados nas células das pontas', () => {
  for (const seletor of [
    '.lista-tabela thead tr:first-child th:first-child',
    '.lista-tabela thead tr:first-child th:last-child',
    '.lista-tabela tbody tr:last-child td:first-child',
    '.lista-tabela tbody tr:last-child td:last-child',
  ]) {
    assert.ok(HTML.includes(seletor), `falta o recorte de canto: ${seletor}`);
  }
});

test('D-8yc-02: a linha de filtros desce pela altura da linha de rótulos, das duas pontas', () => {
  assert.match(HTML, /--alt-rotulos:\s*\d+px/, 'falta a variável única da altura do cabeçalho');
  const rotulos = recorte('.lista-tabela thead tr:first-child th{', '}');
  assert.match(rotulos, /top:\s*0/, 'a linha de rótulos gruda em 0');
  assert.match(rotulos, /height:\s*var\(--alt-rotulos\)/,
    'a altura da linha 1 tem de ser a MESMA variável que o top da linha 2 — duas metades do mesmo número');
  const filtros = recorte('.lista-tabela thead tr:nth-child(2) th{', '}');
  assert.match(filtros, /top:\s*var\(--alt-rotulos\)/,
    'sem este top as duas linhas grudam em 0 e a de filtros cobre a de rótulos');
});

// ── 2. alinhamento separado do tipo de ordenação (D-8yc-03) ─────────

function alinhamento() {
  const ctx = { esc: (s) => String(s ?? '') };
  vm.createContext(ctx);
  vm.runInContext(recorte('var TAB_ALINHAR = {', 'function tabCabecalho('), ctx);
  return ctx;
}

test('coluna sem `alinhar` mantém exatamente o comportamento de hoje', () => {
  const ctx = alinhamento();
  assert.equal(ctx.tabClasseAlinhamento({ tipo: 'numero' }), ' class="num"');
  assert.equal(ctx.tabClasseAlinhamento({ tipo: 'texto' }), '');
  assert.equal(ctx.tabClasseAlinhamento({}), '',
    'coluna sem tipo nenhum não pode ganhar classe — as outras cinco tabelas dependem disso');
});

test('`alinhar` vence o tipo — é o que tira a pílula da beirada direita', () => {
  const ctx = alinhamento();
  assert.equal(ctx.tabClasseAlinhamento({ tipo: 'numero', alinhar: 'esq' }), ' class="al-esq"');
  assert.equal(ctx.tabClasseAlinhamento({ tipo: 'texto', alinhar: 'dir' }), ' class="al-dir"');
  assert.equal(ctx.tabClasseAlinhamento({ tipo: 'texto', alinhar: 'centro' }), ' class="al-centro"');
  assert.equal(ctx.tabClasseAlinhamento({ tipo: 'numero', alinhar: 'diagonal' }), ' class="num"',
    'valor fora da lista cai no padrão em vez de emitir classe inexistente');
});

test('as colunas de pílula do Parque declaram alinhamento à esquerda', () => {
  const cols = recorte('var COLS_INV = [', 'var COLS_OS = [');
  // Casa a linha de declaração da coluna, não o corpo: `celula:` traz
  // chaves e um [^}]* pararia na primeira delas.
  for (const id of ['estado', 'criticidade', 'prox']) {
    const re = new RegExp(`\\{ id:'${id}',[^\\n]*alinhar:'esq'`);
    assert.ok(re.test(cols), `a coluna "${id}" desenha pílula e precisa de alinhar:'esq'`);
  }
  assert.match(cols, /\{ id:'ultimaInspecao',[^\n]*alinhar:'dir'/, 'data alinha à direita, com numeral tabular');
  assert.match(cols, /\{ id:'criticidade',[^\n]*tipo:'numero'/,
    'criticidade continua ordenando pela ordem semântica — alinhar não pode ter virado tipo');
});

test('numerais tabulares nas colunas de número e data', () => {
  assert.match(HTML, /\.lista-tabela td\.num,\s*\n\s*\.lista-tabela td\.al-dir\{\s*font-variant-numeric:tabular-nums/);
});

test('D-8yc-05: a seta de ordenação tem largura fixa — a coluna não muda de tamanho ao ordenar', () => {
  const seta = recorte('.lista-tabela .th-seta{', '}');
  assert.match(seta, /width:\s*1em/);
  assert.match(seta, /display:\s*inline-block/);
  assert.ok(HTML.includes('class="th-seta"'), 'o cabeçalho tem de usar a classe');
});

test('D-3a6-14 continua valendo: nem largura de coluna, nem table-layout, nem truncagem', () => {
  // Comentário é prosa: o próprio CSS explica POR QUE não usa
  // table-layout, e essa frase não é uma declaração.
  const bloco = recorte('/* ── tabela (D-8rz-19', '.tab-barra{')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/table-layout/.test(bloco), 'D-3a6-14: sem table-layout');
  assert.ok(!/text-overflow/.test(bloco), 'D-3a6-14: quem cede é a rolagem, nunca o conteúdo');
  assert.ok(!/\bmax-width:\s*\d/.test(bloco), 'D-3a6-14: sem largura fixada de coluna');
});

// ── 3. filtro com vários valores por coluna (D-8yc-08) ──────────────

test('tabTermos: vírgula separa, espaço não conta, vazio é descartado', () => {
  const ctx = nucleo();
  // Array vindo de dentro do node:vm tem prototype de outro realm —
  // deepStrictEqual falha "mesma estrutura, não referência-igual"
  // (armadilha já documentada nos gates de refrigeração).
  const termos = (v) => JSON.stringify(ctx.tabTermos(v));
  assert.equal(termos('AZUL'), '["azul"]');
  assert.equal(termos('AZUL, VERMELHA'), '["azul","vermelha"]');
  assert.equal(termos('  azul ,, vermelha ,'), '["azul","vermelha"]',
    'vírgula solta enquanto se digita não pode virar termo vazio');
  assert.equal(termos(''), '[]');
  assert.equal(termos(null), '[]');
  assert.equal(termos('CRÍTICA'), '["critica"]', 'acento normalizado, como o resto do filtro');
});

const COLS = [
  { id: 'area', tipo: 'texto', valor: (e) => e.area, texto: (e) => e.area },
  { id: 'predio', tipo: 'texto', valor: (e) => e.predio, texto: (e) => e.predio },
];
const ITENS = [
  { area: 'AZUL', predio: 'COMANDO' },
  { area: 'AZUL', predio: 'GARAGEM' },
  { area: 'VERMELHA', predio: 'F21' },
  { area: 'VERDE', predio: 'F21' },
];

test('dentro da coluna é OU; entre colunas continua sendo E', () => {
  const ctx = nucleo();
  const so = (f) => ctx.tabAplicar(ITENS, {}, f, COLS).length;
  assert.equal(so({ area: 'AZUL' }), 2);
  assert.equal(so({ area: 'AZUL, VERMELHA' }), 3, 'OU dentro da coluna');
  assert.equal(so({ area: 'AZUL, VERMELHA', predio: 'F21' }), 1, 'E entre colunas — a regra de sempre');
  assert.equal(so({ area: 'AZUL, VERMELHA, VERDE' }), 4);
});

test('vírgula recém digitada não zera a lista, e filtro só de vírgulas é filtro nenhum', () => {
  const ctx = nucleo();
  assert.equal(ctx.tabAplicar(ITENS, {}, { area: 'AZUL,' }, COLS).length, 2,
    'a lista não pode piscar vazia entre um valor e o próximo');
  assert.equal(ctx.tabAplicar(ITENS, {}, { area: ' , , ' }, COLS).length, 4,
    'sem termo nenhum, a coluna volta a não filtrar');
});

test('um valor só continua se comportando como antes desta task', () => {
  const ctx = nucleo();
  assert.equal(ctx.tabAplicar(ITENS, {}, { predio: 'f2' }, COLS).length, 2, 'subcadeia, sem caixa, sem acento');
});

// ── 4. sugestões por coluna ─────────────────────────────────────────

function sugestoes() {
  const ctx = { esc: (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), TAB_CACHE: {} };
  vm.createContext(ctx);
  vm.runInContext(recorte('var TAB_TETO_SUGESTOES', 'function tabCorpo('), ctx);
  return ctx;
}

test('as sugestões saem da lista inteira, distintas e ordenadas em pt-BR', () => {
  const ctx = sugestoes();
  ctx.TAB_CACHE.inv = { itens: ITENS };
  const html = ctx.tabSugestoes('inv', COLS[0], 'dl');
  assert.match(html, /^<datalist id="dl">/);
  const valores = [...html.matchAll(/value="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(JSON.stringify(valores), JSON.stringify(['AZUL', 'VERDE', 'VERMELHA']), 'distintas e em ordem');
});

test('valor que contém vírgula fica fora — a vírgula é o separador', () => {
  const ctx = sugestoes();
  ctx.TAB_CACHE.inv = { itens: [{ area: 'SALA 1, FUNDOS' }, { area: 'AZUL' }] };
  const valores = [...ctx.tabSugestoes('inv', COLS[0], 'dl').matchAll(/value="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(JSON.stringify(valores), JSON.stringify(['AZUL']),
    'sugerir um valor com vírgula ensinaria um filtro que não funciona');
});

test('sem cache, sem sugestão — e nunca uma exceção', () => {
  const ctx = sugestoes();
  assert.equal(ctx.tabSugestoes('inv', COLS[0], 'dl'), '');
  ctx.TAB_CACHE.inv = { itens: [] };
  assert.equal(ctx.tabSugestoes('inv', COLS[0], 'dl'), '', 'datalist vazio não é emitido');
});

// ── 5. a coluna de atributos entra pela sonda (D-8yc-07) ────────────

test('COLS_INV não nasce com a coluna de atributos — ela entra pela sonda', () => {
  const cols = recorte('var COLS_INV = [', 'var COL_ATRIBUTOS = {');
  assert.ok(!/id:'atributos'/.test(cols),
    'sem a migração 45 a coluna não pode existir: nem cabeçalho, nem filtro, nem ordenação');
  const sonda = recorte('async function atribSondarEsquema()', '}\n');
  assert.match(sonda, /COLS_INV = COLS_INV\.concat/,
    'a coluna liga no MESMO ponto que liga EQUIP_EDITAVEIS (D-500-05/D-8yc-07)');
});

function colAtributos() {
  const ctx = {
    esc: (s) => String(s ?? ''),
    EQUIP_ATRIBUTOS: ['inverter', 'redundante', 'automacao'],
    EQUIP_ROTULOS: { inverter: 'Inverter', redundante: 'Redundante', automacao: 'Automação' },
  };
  vm.createContext(ctx);
  vm.runInContext(recorte('var COL_ATRIBUTOS = {', '\n};') + '\n};', ctx);
  return ctx.COL_ATRIBUTOS;
}

test('a coluna de atributos filtra pela palavra inteira e desenha a sigla', () => {
  const col = colAtributos();
  const marcado = { inverter: true, redundante: true };
  assert.equal(col.texto(marcado), 'Inverter Redundante',
    'o filtro casa "inverter", que é o que a pessoa digita — não "INV"');
  assert.ok(col.celula(marcado).includes('INV'));
  assert.ok(col.celula(marcado).includes('RED'));
  assert.ok(!col.celula(marcado).includes('AUT'), 'atributo não marcado não vira chip');
});

test('não avaliado é travessão, não chip vazio, e ordena depois dos marcados', () => {
  const col = colAtributos();
  assert.equal(col.texto({}), '');
  assert.match(col.celula({}), /—/);
  assert.equal(col.valor({}), null, 'null é vazio para tabVazio — vai para o fim nas duas direções');
  assert.equal(col.valor({ inverter: true }), 1);
  assert.equal(col.valor({ inverter: true, redundante: true, automacao: true }), 3);
  assert.equal(col.valor({ inverter: false }), null,
    'marcado como "não" não é o mesmo que marcado — não conta');
});
