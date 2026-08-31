// Gate da quick-260831-2mx — adicionar e remover máquinas de ar-condicionado
// do parque em /refrigeracao.
//
// O que esta task acrescenta é CAMINHO, nunca uma segunda porta de escrita:
//
//  - D-2mx-01: a ficha do equipamento ganha um botão que abre a MESMA OS de
//    INSTALAÇÃO/REMOÇÃO de sempre, já apontando para aquela máquina. A
//    `situacao` continua mudando só por conferência de OS de movimentação
//    (D-uyz-12), com a trava de admin da baixa (D-uyz-07) intacta.
//  - D-2mx-02: o Parque ganha um botão de cadastrar equipamento, que chama o
//    `openEquipNovo` que já existia — hoje alcançável só por uma <option>
//    escondida dentro do formulário de movimentação.
//  - D-2mx-03: o id vindo da ficha POSICIONA o <select>, não o substitui.
//
// Escrito e visto falhando antes da implementação, no procedimento de
// 260822-8rz/260823-3a6/260823-92t.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

// ── recorte por contagem de chaves, a técnica dos gates vizinhos ──
function bloco(html, marcador) {
  const ini = html.indexOf(marcador);
  assert.ok(ini >= 0, `marcador "${marcador}" não encontrado`);
  const abre = html.indexOf('{', ini);
  let depth = 1;
  let j = abre + 1;
  while (j < html.length && depth > 0) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') depth--;
    j++;
  }
  return html.slice(ini, j);
}

const MARCADORES = [
  'var EQUIP_SITUACOES = {',
  'function normalizarSituacaoEquip(v){',
  'function equipSituacao(e){',
  'function equipInstalado(e){',
  'function equipRemovido(e){',
  'function equipBaixado(e){',
  'function fichaAcaoMovimentacao(e){',
  'function movPreSelecionarEquip(equipId){',
];

// Sandbox com as duas sondas e o cargo como PARÂMETROS — é exatamente o que
// decide se o botão existe, então nada aqui pode ser constante.
function sandbox(opts) {
  const o = opts || {};
  const ctx = {
    MAN_FLUXO_OK: o.MAN_FLUXO_OK !== undefined ? o.MAN_FLUXO_OK : true,
    MOV_OK: o.MOV_OK !== undefined ? o.MOV_OK : true,
    manPode: function (acao) {
      ctx._acoesConsultadas.push(acao);
      return o.manPode !== undefined ? o.manPode : true;
    },
    _acoesConsultadas: [],
    _toasts: [],
    _onChange: [],
    showToast: function (msg, tom) { ctx._toasts.push({ msg: msg, tom: tom }); },
    el: function (id) { return o.el ? o.el(id) : null; },
    val: function (id) { return o.val ? o.val(id) : ''; },
    movOnChangeEquipRemocao: function () { ctx._onChange.push('REMOÇÃO'); },
    movOnChangeEquipInstalacao: function () { ctx._onChange.push('INSTALAÇÃO'); },
  };
  vm.createContext(ctx);
  MARCADORES.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  return ctx;
}

const INSTALADO = { id: 501, situacao: 'instalado' };
const REMOVIDO = { id: 502, situacao: 'removido' };
const BAIXADO = { id: 503, situacao: 'baixado' };

test('os recortes existem no HTML', () => {
  assert.doesNotThrow(() => sandbox());
});

// ═════════ D-2mx-01 — a ação de movimentação na ficha ═════════

test('sem as sondas o botão não existe: com MAN_FLUXO_OK ou MOV_OK falso a ficha sai byte a byte como hoje', () => {
  assert.strictEqual(sandbox({ MAN_FLUXO_OK: false }).fichaAcaoMovimentacao(INSTALADO), '');
  assert.strictEqual(sandbox({ MOV_OK: false }).fichaAcaoMovimentacao(INSTALADO), '');
  assert.strictEqual(sandbox({ MAN_FLUXO_OK: false, MOV_OK: false }).fichaAcaoMovimentacao(INSTALADO), '');
});

test('MAN_FLUXO_OK é consultada ANTES de MOV_OK — a ordem é o que protege o fixture da gaveta', () => {
  // Com MAN_FLUXO_OK falso, MOV_OK nem é avaliada: um sandbox sem MOV_OK
  // definida não pode lançar ReferenceError.
  const ctx = { MAN_FLUXO_OK: false, manPode: function () { return true; } };
  vm.createContext(ctx);
  MARCADORES.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  assert.doesNotThrow(() => ctx.fichaAcaoMovimentacao(INSTALADO));
  assert.strictEqual(ctx.fichaAcaoMovimentacao(INSTALADO), '');
});

test('o cargo é o mesmo que salvarMovOS exige: sem manPode(\'abrir\') não há botão', () => {
  const ctx = sandbox({ manPode: false });
  assert.strictEqual(ctx.fichaAcaoMovimentacao(INSTALADO), '');
  assert.deepStrictEqual(ctx._acoesConsultadas, ['abrir']);
});

test('instalado oferece REMOÇÃO apontando para a própria máquina', () => {
  const html = sandbox().fichaAcaoMovimentacao(INSTALADO);
  assert.match(html, /openMovForm\(&quot;REMOÇÃO&quot;,501\)/);
  assert.match(html, /Remover do local/);
  assert.ok(!/INSTALAÇÃO/.test(html), 'máquina instalada não pode oferecer instalação');
});

test('removido oferece INSTALAÇÃO — a máquina guardada volta ao parque pelo mesmo botão', () => {
  const html = sandbox().fichaAcaoMovimentacao(REMOVIDO);
  assert.match(html, /openMovForm\(&quot;INSTALAÇÃO&quot;,502\)/);
  assert.match(html, /Instalar em um local/);
  assert.ok(!/REMOÇÃO/.test(html), 'máquina removida não pode oferecer remoção');
});

test('baixado não oferece nada — a baixa é terminal (D-uyz-05), reinstalar por clique desfaria um ato patrimonial', () => {
  assert.strictEqual(sandbox().fichaAcaoMovimentacao(BAIXADO), '');
});

test('o botão é um atalho de navegação, nunca uma porta de escrita: fichaAcaoMovimentacao não cita situacao, update, insert nem aplicarRemocao', () => {
  const fonte = bloco(HTML, 'function fichaAcaoMovimentacao(e){');
  [/\bsitua[cç]ao\s*[:=]/i, /\.update\(/, /\.insert\(/, /aplicarRemocao/, /aplicarInstalacao/, /supa\./].forEach((re) => {
    assert.ok(!re.test(fonte), `fichaAcaoMovimentacao não pode conter ${re}`);
  });
});

test('fichaBlocoLocal é quem hospeda a ação — no bloco "1 · Local", não no rodapé de ações (D-92t-07 preservada)', () => {
  const blocoLocal = bloco(HTML, 'function fichaBlocoLocal(e){');
  assert.match(blocoLocal, /fichaAcaoMovimentacao\(e\)/);
  const acoes = bloco(HTML, 'function fichaAcoes(id, alvo){');
  assert.ok(!/fichaAcaoMovimentacao/.test(acoes), 'o rodapé de ações continua com as quatro ações de sempre');
});

// ═════════ D-2mx-03 — o id posiciona o <select>, não o substitui ═════════

function selectFalso(valores, valorInicial) {
  return {
    options: valores.map(function (v) { return { value: String(v) }; }),
    value: valorInicial === undefined ? String(valores[0]) : String(valorInicial),
  };
}

test('sem id (abertura normal pela página de OS) não mexe em nada', () => {
  const sel = selectFalso([1, 2, 3]);
  const ctx = sandbox({ el: () => sel, val: () => 'REMOÇÃO' });
  assert.strictEqual(ctx.movPreSelecionarEquip(undefined), false);
  assert.strictEqual(ctx.movPreSelecionarEquip(null), false);
  assert.strictEqual(sel.value, '1');
  assert.deepStrictEqual(ctx._onChange, []);
});

test('id presente nas opções: seleciona e dispara o on-change do TIPO corrente', () => {
  const sel = selectFalso([1, 501, 3]);
  const ctx = sandbox({ el: () => sel, val: () => 'REMOÇÃO' });
  assert.strictEqual(ctx.movPreSelecionarEquip(501), true);
  assert.strictEqual(sel.value, '501');
  assert.deepStrictEqual(ctx._onChange, ['REMOÇÃO']);

  const sel2 = selectFalso([1, 502, 3]);
  const ctx2 = sandbox({ el: () => sel2, val: () => 'INSTALAÇÃO' });
  assert.strictEqual(ctx2.movPreSelecionarEquip(502), true);
  assert.strictEqual(sel2.value, '502');
  assert.deepStrictEqual(ctx2._onChange, ['INSTALAÇÃO']);
});

test('id AUSENTE das opções: não seleciona nada, avisa, e nunca cai na primeira máquina da lista', () => {
  const sel = selectFalso([1, 2, 3]);
  const ctx = sandbox({ el: () => sel, val: () => 'REMOÇÃO' });
  assert.strictEqual(ctx.movPreSelecionarEquip(999), false);
  assert.strictEqual(sel.value, '1', 'o <select> não pode se mover para uma máquina que não é a pedida');
  assert.deepStrictEqual(ctx._onChange, []);
  assert.strictEqual(ctx._toasts.length, 1);
  assert.match(ctx._toasts[0].msg, /#999/);
  assert.strictEqual(ctx._toasts[0].tom, 'error');
});

test('openMovForm recebe o equipamento como SEGUNDO parâmetro e delega a movPreSelecionarEquip depois de montar o corpo', () => {
  assert.match(HTML, /async function openMovForm\(tipoInicial, equipId\)\{/);
  const fonte = bloco(HTML, 'async function openMovForm(tipoInicial, equipId){');
  const posMontar = fonte.lastIndexOf('movMontarCorpo();');
  const posPre = fonte.indexOf('movPreSelecionarEquip(equipId);');
  assert.ok(posMontar > 0 && posPre > posMontar, 'a pré-seleção precisa vir DEPOIS de movMontarCorpo — antes o <select> não existe');
});

// ═════════ D-2mx-02 — cadastrar equipamento a partir do Parque ═════════

test('#btn-novo-equip vive na .sec-head do Parque, antes de #btn-planilha, e chama openEquipNovo() sem argumento', () => {
  const ini = HTML.indexOf('id="page-inv"');
  const fim = HTML.indexOf('id="page-os"');
  assert.ok(ini > 0 && fim > ini);
  const pagina = HTML.slice(ini, fim);

  const iniHead = pagina.indexOf('<div class="sec-head">');
  const fimHead = pagina.indexOf('</div>', pagina.indexOf('id="inv-cnt"'));
  const head = pagina.slice(iniHead, fimHead);

  const posNovo = head.indexOf('id="btn-novo-equip"');
  const posPlanilha = head.indexOf('id="btn-planilha"');
  assert.ok(posNovo > 0, '#btn-novo-equip não encontrado na .sec-head do Parque');
  assert.ok(posPlanilha > posNovo, '#btn-novo-equip precisa vir antes de #btn-planilha — criar vem antes de exportar');

  const botao = head.slice(head.lastIndexOf('<button', posNovo), head.indexOf('</button>', posNovo));
  assert.match(botao, /class="sec-etq"/);
  assert.match(botao, /aria-label="[^"]+"/);
  assert.match(botao, /title="[^"]+"/);
  // Sem argumento: openEquipNovo(aoCriar) guarda o callback, e um MouseEvent
  // ali dentro viraria uma função inexistente chamada depois de gravar.
  assert.match(botao, /onclick="openEquipNovo\(\)"/);
});

test('D-2mx-04: os três botões da .sec-head são UM item do flex — sem regra nova na folha, o CSS fora de @media segue byte a byte igual ao fixture', () => {
  const ini = HTML.indexOf('id="btn-novo-equip"');
  const abre = HTML.lastIndexOf('<span', ini);
  const fecha = HTML.indexOf('</span>', HTML.indexOf('id="btn-etiquetas"'));
  const grupo = HTML.slice(abre, fecha + 7);
  assert.match(grupo, /^<span style="display:flex;[^"]*"/, 'o agrupamento tem de ser inline — uma classe nova quebraria tests/refrigeracao-desktop.test.js');
  assert.strictEqual(grupo.split('<button').length - 1, 3, 'os três botões precisam estar no MESMO span');
  ['btn-novo-equip', 'btn-planilha', 'btn-etiquetas'].forEach((id) => {
    assert.ok(grupo.includes('id="' + id + '"'), id + ' ficou fora do grupo');
  });
  // Em 375px a .sec-head quebra linha; soltos, os três se espalhavam entre
  // as duas linhas com o space-between abrindo ~150px no meio deles.
  assert.ok(!/\n/.test(grupo), 'o grupo fica numa linha só — quebra de linha vira espaço em branco entre botões inline-flex');
});

test('a visibilidade do botão é decidida por podeEditarCadastro() ANTES de qualquer retorno antecipado de renderInv', () => {
  const fonte = bloco(HTML, 'function renderInv(){');
  const posBotao = fonte.indexOf("el('btn-novo-equip')");
  assert.ok(posBotao > 0, 'renderInv não liga/desliga #btn-novo-equip');
  assert.match(fonte.slice(posBotao, posBotao + 300), /podeEditarCadastro\(\)/);
  const posPrimeiroReturn = fonte.indexOf('return');
  assert.ok(posPrimeiroReturn > posBotao, 'o botão não pode depender de a lista ter linhas');
});

test('o botão do Parque reusa salvarEquipNovo: continuam existindo os DOIS caminhos de criação de sempre (formulário e planilha), nenhum terceiro', () => {
  // Dois inserts em `equipamentos` no arquivo inteiro, e cada um no seu
  // dono: o formulário de cadastro (uma máquina) e a importação da
  // planilha (lote). Esta task não pode ter aberto um terceiro — o botão
  // novo é só mais um gatilho para o primeiro.
  const inserts = HTML.split("from('equipamentos').insert").length - 1;
  assert.strictEqual(inserts, 2, 'nenhum terceiro caminho de criação de equipamento pode existir');
  const salvar = bloco(HTML, 'async function salvarEquipNovo(){');
  assert.match(salvar, /from\('equipamentos'\)\.insert/);
  assert.match(salvar, /podeEditarCadastro\(\)/);
  assert.match(salvar, /somenteLeitura\(\)/);
  const planilha = bloco(HTML, 'async function aplicarPlanoPlanilha(){');
  assert.match(planilha, /from\('equipamentos'\)\.insert/);
});

// ═════════ o que esta task NÃO pode ter afrouxado ═════════

test('D-uyz-12 intacta: situacao/dataRemocao/dataBaixa continuam fora de EQUIP_EDITAVEIS', () => {
  const ini = HTML.indexOf('var EQUIP_EDITAVEIS = [');
  const fim = HTML.indexOf('];', ini);
  assert.ok(ini > 0 && fim > ini);
  const lista = HTML.slice(ini, fim);
  ['situacao', 'dataRemocao', 'dataBaixa', 'localId', 'lat', 'lon', 'ultimaManutencao'].forEach((k) => {
    assert.ok(!new RegExp("'" + k + "'").test(lista), `${k} não pode entrar no formulário de cadastro`);
  });
});

test('D-uyz-07 intacta: a baixa continua exigindo podeDarBaixa() no <select>, no salvar e na conferência', () => {
  assert.ok((HTML.split('podeDarBaixa()').length - 1) >= 3, 'a trava de admin da baixa perdeu pontos de chamada');
  assert.match(bloco(HTML, 'async function aplicarRemocao(equipId, entry){'), /podeDarBaixa\(\)/);
  assert.match(bloco(HTML, 'async function salvarMovOS(){'), /podeDarBaixa\(\)/);
});
