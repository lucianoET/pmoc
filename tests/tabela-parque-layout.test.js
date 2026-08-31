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

function larguras() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(recorte('function tabTemLarguras(', 'function tabDesenhar('), ctx);
  return ctx;
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

test('D-8yc-05: a seta tem largura fixa — a coluna não muda de tamanho ao ordenar', () => {
  const seta = recorte('.lista-tabela .th-seta{', '}');
  assert.match(seta, /width:\s*[\d.]+em/, 'sem largura fixa, ⇅/↑/↓/funil mudam a largura da coluna');
  assert.match(seta, /display:\s*inline-block/);
  // 260829-a8u: a seta deixou de ser um <span> e virou o botão que abre o
  // menu de coluna — mesma largura, comportamento novo (D-a8u-01).
  assert.match(HTML, /class="th-seta'\+\(filtroPreenchido\?' com-filtro':''\)\+'"/,
    'o cabeçalho tem de usar a classe, e marcar quando a coluna está filtrada');
});

// D-3a6-14 dizia o contrário disto — "quem cede é a rolagem, nunca a
// coluna" — e foi REVERTIDA a pedido do usuário em 29/08/2026: ele quer a
// tabela cabendo na tela. A preocupação registrada lá (Local é o único
// campo longo e variável) não foi ignorada: virou peso, e é o que estes
// casos protegem.
test('D-8yc-09: table-layout:fixed existe, mas só sob a classe .fixa', () => {
  const bloco = recorte('/* ── tabela (D-8rz-19', '.tab-barra{')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(bloco, /\.lista-tabela\.fixa\{\s*table-layout:fixed/,
    'a largura declarada é o que faz a tabela caber');
  assert.ok(!/^\s*\.lista-tabela\{[^}]*table-layout/m.test(bloco),
    'a regra base não pode fixar o layout — as outras cinco tabelas seguem automáticas');
});

test('D-8yc-09: só vira fixa quando TODAS as colunas declaram largura', () => {
  const ctx = larguras();
  assert.equal(ctx.tabTemLarguras([{ largura: 1 }, { largura: 2 }]), true);
  assert.equal(ctx.tabTemLarguras([{ largura: 1 }, {}]), false,
    'meia declaração é pior que nenhuma: o navegador divide o resto igualmente e a coluna longa some');
  assert.equal(ctx.tabTemLarguras([]), false);
  assert.equal(ctx.tabGrupoLarguras([{ largura: 1 }, {}]), '', 'sem colgroup, sem layout fixo');
});

test('D-8yc-09: largura é PESO relativo — qualquer subconjunto soma 100%', () => {
  const ctx = larguras();
  const pct = (cols) => [...ctx.tabGrupoLarguras(cols).matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]));
  const soma = (a) => a.reduce((t, n) => t + n, 0);
  assert.ok(Math.abs(soma(pct([{ largura: 3 }, { largura: 15 }, { largura: 8 }])) - 100) < 0.01);
  // É isto que deixa as três colunas de atributo entrar e sair pela sonda
  // sem ninguém recalcular as outras à mão.
  assert.ok(Math.abs(soma(pct([{ largura: 3 }, { largura: 15 }, { largura: 8 }, { largura: 4 }])) - 100) < 0.01);
});

test('a preocupação de D-3a6-14 vira peso: Local é a coluna mais larga', () => {
  const cols = recorte('var COLS_INV = [', 'function colAtributoEquip(');
  const peso = (id) => Number(new RegExp(`\\{ id:'${id}', largura:(\\d+)`).exec(cols)[1]);
  const outras = ['id', 'area', 'predio', 'tipo', 'btu', 'fabricante', 'modelo', 'estado', 'criticidade', 'prox', 'ultimaInspecao'];
  for (const id of outras) {
    assert.ok(peso('local') > peso(id),
      `Local é o único campo longo e variável (D-3a6-14) e precisa de mais peso que "${id}"`);
  }
});

test('D-8yc-10: quem trunca devolve o texto inteiro no title — nada é escondido', () => {
  const bloco = recorte('.lista-tabela.fixa td{', '}');
  assert.match(bloco, /text-overflow:\s*ellipsis/);
  const corpo = recorte('function tabCorpo(', 'function tabRedesenhar');
  assert.match(corpo, /title="'\+esc\(bruto\)\+'"/,
    'reticências sem title esconderiam dado — o title é o que torna a truncagem honesta');
  assert.match(corpo, /col\.celula \? '' :/,
    'célula de pílula/símbolo não recebe title duplicado');
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
  // 260829-a8u: tabSugestoes passou a reusar tabValoresDistintos, do
  // núcleo puro — uma função com dois consumidores (o datalist e a lista
  // de marcar do menu de coluna). O recorte do núcleo entra junto porque
  // a dependência é real, não andaime de teste.
  vm.runInContext(
    recorte('/* ── tabelas de desktop: núcleo puro ── */', '/* ── tabelas de desktop: colunas ── */'),
    ctx
  );
  // Recorte fecha ANTES do menu de coluna: aquele bloco registra
  // ouvintes no `document` ao carregar, e o sandbox não tem DOM.
  vm.runInContext(recorte('var TAB_TETO_SUGESTOES', '/* ── menu de coluna estilo Excel'), ctx);
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

test('COLS_INV não nasce com as colunas de atributo — elas entram pela sonda', () => {
  const cols = recorte('var COLS_INV = [', 'function colAtributoEquip(');
  for (const id of ['inverter', 'redundante', 'automacao']) {
    assert.ok(!new RegExp(`\\{ id:'${id}'`).test(cols),
      `sem a migração 45 a coluna "${id}" não pode existir: nem cabeçalho, nem filtro, nem ordenação`);
  }
  const sonda = recorte('async function atribSondarEsquema()', '}\n');
  assert.match(sonda, /COLS_INV = COLS_INV\.slice\(0, posicao\)/,
    'as colunas ligam no MESMO ponto que liga EQUIP_EDITAVEIS (D-500-05/D-8yc-07)');
});

test('D-8yc-12: as três entram logo depois de Criticidade, e caem para o fim se ela sumir', () => {
  const sonda = recorte('async function atribSondarEsquema()', '}\n');
  assert.match(sonda, /indexOf\('criticidade'\)/, 'a posição pedida pelo usuário é depois de Criticidade');
  assert.match(sonda, /apos < 0 \? COLS_INV\.length : apos \+ 1/,
    'sumindo a coluna de referência, as três vão para o fim em vez de derrubar a tabela');
});

function colAtributo(chave) {
  const ctx = {
    esc: (s) => String(s ?? ''),
    EQUIP_ROTULOS: { inverter: 'Inverter', redundante: 'Redundante', automacao: 'Automação' },
  };
  vm.createContext(ctx);
  vm.runInContext(recorte('function colAtributoEquip(chave){', '\n}') + '\n}', ctx);
  return ctx.colAtributoEquip(chave);
}

test('cada atributo filtra por Sim/Não — é a palavra que a lista de sugestões oferece', () => {
  const col = colAtributo('inverter');
  assert.equal(col.rotulo, 'Inverter');
  assert.equal(col.texto({ inverter: true }), 'Sim');
  assert.equal(col.texto({ inverter: false }), 'Não');
  assert.equal(col.texto({}), '', 'não avaliado não é "Não" — é ausência de resposta');
});

test('a célula é símbolo, e o title diz de qual atributo se trata', () => {
  const col = colAtributo('redundante');
  assert.match(col.celula({ redundante: true }), /marca-sim/);
  assert.match(col.celula({ redundante: true }), /Redundante: Sim/);
  assert.match(col.celula({ redundante: false }), /Redundante: Não/);
  assert.match(col.celula({}), /não avaliado/,
    'sem title, um traço numa coluna estreita não diz nada a ninguém');
});

test('ordena marcado antes de não-marcado, e não avaliado sempre no fim', () => {
  const col = colAtributo('automacao');
  assert.equal(col.valor({ automacao: true }), 1);
  assert.equal(col.valor({ automacao: false }), 0);
  assert.equal(col.valor({}), null, 'null é vazio para tabVazio — vai para o fim nas duas direções');
});

test('a coluna de atributo é estreita: o espaçamento sai da célula, não do cabeçalho', () => {
  assert.equal(colAtributo('inverter').largura, 4);
  assert.equal(colAtributo('inverter').alinhar, 'centro');
  assert.match(HTML, /\.lista-tabela td\.al-centro\{\s*padding-left:2px/,
    'coluna de símbolo com padding de coluna de texto é espaço morto');
});
