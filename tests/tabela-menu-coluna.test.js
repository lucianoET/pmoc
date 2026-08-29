// Gate da quick-260829-a8u — menu de coluna estilo Excel (ordenação +
// caixas de marcar) nas tabelas de computador do /refrigeracao.
//
// O caso mais importante deste arquivo não é o menu: é `tabCasaFiltro`.
// `filtrarInventario` carregava a PRÓPRIA cópia da regra de filtro de
// coluna, escrita antes de o filtro multivalor existir (D-8yc-08). Com
// "AZUL, VERMELHA" ela procurava a subcadeia literal "azul, vermelha" e
// devolvia zero linha, enquanto a mesma tela — redesenhando só o <tbody>
// pelo caminho de `tabAplicar` — devolvia 175. Duas implementações da
// mesma regra divergem no primeiro dia em que uma muda; agora é uma só,
// com dois consumidores.

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

const COL = { id: 'area', tipo: 'texto', valor: (e) => e.area, texto: (e) => e.area };
const ITENS = [
  { area: 'AZUL' }, { area: 'AZUL' }, { area: 'VERMELHA' }, { area: 'VERDE' },
];

// ── 1. uma regra de filtro, dois consumidores (D-a8u-09) ────────────

test('tabCasaFiltro entende a vírgula — era isto que filtrarInventario não fazia', () => {
  const ctx = nucleo();
  assert.equal(ctx.tabCasaFiltro(COL, 'AZUL', { area: 'AZUL' }), true);
  assert.equal(ctx.tabCasaFiltro(COL, 'AZUL', { area: 'VERMELHA' }), false);
  assert.equal(ctx.tabCasaFiltro(COL, 'AZUL, VERMELHA', { area: 'VERMELHA' }), true,
    'a cópia antiga procurava a subcadeia literal "azul, vermelha" e devolvia zero linha');
  assert.equal(ctx.tabCasaFiltro(COL, '', { area: 'AZUL' }), true, 'filtro vazio não filtra');
  assert.equal(ctx.tabCasaFiltro(null, 'AZUL', { area: 'AZUL' }), true,
    'coluna ausente da definição é ignorada, não zera a lista');
});

test('filtrarInventario chama tabCasaFiltro em vez de reimplementar a regra', () => {
  const corpo = recorte('function filtrarInventario(', '\n}');
  assert.match(corpo, /tabCasaFiltro\(col, par\[1\], e\)/,
    'a regra do filtro de coluna não pode voltar a existir em duas cópias');
  assert.ok(!/indexOf\(tabNormalizar\(par\[1\]\)\)/.test(corpo),
    'a cópia antiga (subcadeia literal do texto inteiro) não pode voltar');
});

test('tabAplicar também usa a regra única', () => {
  const corpo = recorte('function tabAplicar(', '\n}');
  assert.match(corpo, /tabCasaFiltro\(_tabColuna\(colunas, par\[0\]\), par\[1\], item\)/);
});

// ── 2. valores distintos (D-a8u-04) ─────────────────────────────────

test('tabValoresDistintos: distintos, ordenados, sem vazios e sem vírgula', () => {
  const ctx = nucleo();
  const v = ctx.tabValoresDistintos(
    [{ area: 'VERDE' }, { area: 'AZUL' }, { area: 'AZUL' }, { area: '' }, { area: 'A, B' }, { area: null }],
    COL
  );
  assert.equal(JSON.stringify(v), JSON.stringify(['AZUL', 'VERDE']),
    'valor com vírgula fica fora: a vírgula é o separador do filtro');
});

test('tabValoresDistintos respeita o teto', () => {
  const ctx = nucleo();
  const muitos = Array.from({ length: 50 }, (_, i) => ({ area: 'A' + i }));
  assert.equal(ctx.tabValoresDistintos(muitos, COL, 10).length, 10);
});

// ── 3. estado das caixas derivado da string (D-a8u-02/05) ───────────

const VALORES = ['AZUL', 'VERDE', 'VERMELHA'];

test('filtro vazio significa TUDO marcado — não lista vazia', () => {
  const ctx = nucleo();
  for (const v of VALORES) {
    assert.equal(ctx.tabValorSelecionado('', v, VALORES), true,
      'marcar tudo e não filtrar são a mesma coisa (D-a8u-05)');
  }
});

test('o estado de cada caixa sai da string do filtro, sem segunda fonte de verdade', () => {
  const ctx = nucleo();
  assert.equal(ctx.tabValorSelecionado('AZUL', 'AZUL', VALORES), true);
  assert.equal(ctx.tabValorSelecionado('AZUL', 'VERDE', VALORES), false);
  assert.equal(ctx.tabValorSelecionado('AZUL, VERDE', 'VERDE', VALORES), true);
  assert.equal(ctx.tabValorSelecionado('azul', 'AZUL', VALORES), true, 'sem caixa, sem acento');
});

test('desmarcar a partir de "tudo marcado" materializa todos menos um', () => {
  const ctx = nucleo();
  assert.equal(ctx.tabAlternarValor('', 'VERDE', VALORES), 'AZUL, VERMELHA',
    'é a única forma de "todos menos um" existir numa string de termos');
});

test('remarcar o último que faltava volta a filtro vazio, não à lista inteira', () => {
  const ctx = nucleo();
  assert.equal(ctx.tabAlternarValor('AZUL, VERMELHA', 'VERDE', VALORES), '',
    'guardar os 175 valores na string quando o filtro é "tudo" seria absurdo (D-a8u-05)');
});

test('desmarcar tudo produz um filtro que não casa nada — não um filtro ausente', () => {
  const ctx = nucleo();
  const vazio = ctx.tabAlternarValor('AZUL', 'AZUL', VALORES);
  assert.notEqual(vazio, '', 'string vazia significaria "sem filtro" e mostraria tudo');
  assert.equal(ctx.tabCasaFiltro(COL, vazio, { area: 'AZUL' }), false,
    'desmarcar tudo tem de esvaziar a tabela, que é o que a pessoa pediu');
});

test('o ciclo fecha: desmarcar e remarcar volta ao estado inicial', () => {
  const ctx = nucleo();
  const passo1 = ctx.tabAlternarValor('', 'VERMELHA', VALORES);
  const passo2 = ctx.tabAlternarValor(passo1, 'VERMELHA', VALORES);
  assert.equal(passo2, '');
  for (const v of VALORES) assert.equal(ctx.tabValorSelecionado(passo2, v, VALORES), true);
});

// ── 4. a lista de marcar lê a lista ANTES do filtro da coluna ───────

test('D-a8u-04: TAB_CACHE guarda `todos`, e o menu lê dela', () => {
  const desenhar = recorte('function tabDesenhar(tid, colunas, itens, aoAbrir, todos)', '\n}');
  assert.match(desenhar, /todos:\s*todos\|\|itens/,
    'quem não passa a lista completa cai na filtrada, como antes — as outras cinco tabelas');
  const menu = recorte('function tabRenderMenu(', '\n}');
  assert.match(menu, /tabValoresDistintos\(cache\.todos \|\| cache\.itens, col\)/,
    'lendo a lista já filtrada, desmarcar um valor o apagaria da própria lista, sem volta');
});

test('renderInv entrega as duas listas — com e sem filtro de coluna', () => {
  const corpo = recorte('function renderInv(){', '\n}');
  assert.match(corpo, /filtrarInventario\(DATA, busca, invChip\)\.sort\(cmpInv\)/,
    'a segunda chamada, sem TAB_ESTADO.inv.filtros, é a lista que alimenta o menu');
  assert.match(corpo, /tabDesenhar\('inv', COLS_INV, list, 'openDetail', semColuna\)/);
});

// ── 5. gatilho e sinal de coluna filtrada (D-a8u-01/07) ─────────────

test('D-a8u-01: o gatilho é a seta que já existia — nenhuma coluna ficou mais larga', () => {
  const cab = recorte('function tabCabecalho(', 'function tabSugestoes');
  assert.match(cab, /class="th-seta'\+\(filtroPreenchido\?' com-filtro':''\)\+'"/);
  assert.match(cab, /onclick="event\.stopPropagation\(\);tabAbrirMenu\(/,
    'o clique no gatilho não pode também disparar a ordenação do rótulo');
  assert.match(cab, /aria-haspopup="dialog"/);
  assert.match(cab, /tabOrdenarColuna/, 'clicar no rótulo continua ordenando — o caminho rápido fica');
});

test('D-a8u-07: coluna filtrada mostra funil, não a seta de ordenação', () => {
  const cab = recorte('function tabCabecalho(', 'function tabSugestoes');
  assert.match(cab, /var glifo = filtroPreenchido \? '\\u2707' : seta;/,
    'com o painel fechado, nada mais dizia que a coluna estava filtrada');
});

// ── 6. o painel não pode ser recortado nem virar armadilha de teclado ─

test('D-a8u-03: o painel mora no <body>, fora do container que rola', () => {
  const criar = recorte('function tabMenuEl(){', '\n}');
  assert.match(criar, /document\.body\.appendChild/,
    'dentro da tabela ele seria recortado pelo overflow:auto do #inv-list');
  const css = recorte('#tab-menu{', '}');
  assert.match(css, /position:fixed/);
});

test('D-a8u-06: fecha por Esc, por clique fora e pelo próprio gatilho', () => {
  const bloco = recorte('/* ── menu de coluna estilo Excel', 'function tabCorpo(');
  assert.match(bloco, /ev\.key==='Escape'/);
  assert.match(bloco, /!el\.contains\(ev\.target\)\) tabFecharMenu\(\)/);
  assert.match(bloco, /if\(TAB_MENU && TAB_MENU\.tid===tid && TAB_MENU\.colId===colId\)\{ tabFecharMenu\(\); return; \}/,
    'segundo clique no mesmo gatilho fecha');
  assert.match(bloco, /gatilho\.focus\(\)/, 'o foco volta para o gatilho, não fica solto no body');
});

test('os ouvintes de documento são registrados UMA vez, não por abertura', () => {
  const bloco = recorte('/* ── menu de coluna estilo Excel', 'function tabCorpo(');
  assert.equal((bloco.match(/document\.addEventListener/g) || []).length, 2,
    'um por evento (click e keydown) — registrar por abertura vazaria um ouvinte a cada clique');
});
