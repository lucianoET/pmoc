// Gate da quick-260823-92t — a ficha do equipamento de /refrigeracao vira
// PÁGINA inteira em >=1024px, sem mudar dado/fluxo/regra de negócio.
//
// D-92t-19 (mesmo procedimento de 260822-8rz/260823-3a6): este arquivo foi
// escrito e visto FALHANDO antes de `fichaBlocos`/`fichaIdentidade`/
// `fichaAcoes`/`FICHA_COLUNAS`/etc. existirem em refrigeracao/index.html —
// a Task 1 só então extraiu os blocos.
//
// D-92t-14: a gaveta é PROVADA intocada, não afirmada. O fixture
// tests/fixtures/refrigeracao-ficha-gaveta.json é a impressão digital do
// que `openDetail` escrevia em #drawer-body/#dh-id/#dh-local/#dh-predio/
// #dh-pills/#drawer-footer ANTES da extração desta task — capturada por um
// script descartável (fora do repositório) que usa os MESMOS mocks
// determinísticos e o MESMO helper de recorte por bracket-counting (`bloco`)
// que este gate usa contra o arquivo já extraído, só apontando para o HTML
// de HEAD (`git show HEAD:refrigeracao/index.html`) em vez do atual.
//
// Procedimento para regerar o fixture (só se `fichaBlocos`/`fichaIdentidade`/
// `fichaAcoes` mudarem de assinatura ou de comportamento intencionalmente):
//   1. `git show HEAD:refrigeracao/index.html > /caminho/de/rascunho/index-old.html`
//      apontando para o commit de ANTES da mudança pretendida.
//   2. Escreva um script descartável (fora de tests/) que repete os mesmos
//      MARCADORES_REAIS e a mesma `mocksComuns()` deste arquivo, recorta
//      `function openDetail(id){` do HTML antigo com `bloco()`, roda
//      `openDetail(EQUIP_FIXO.id)` contra um `el(id)` que captura
//      textContent/innerHTML por id, e escreve
//      tests/fixtures/refrigeracao-ficha-gaveta.json com as chaves corpo/
//      dhId/dhLocal/dhPredio/dhPills/rodape.
//   3. Rode este gate — ele compara `fichaBlocos(...).join('')`,
//      `fichaIdentidade(...)` e `fichaAcoes(id,'gaveta')` (extraídos do HTML
//      ATUAL) byte a byte contra o fixture.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'refrigeracao-ficha-gaveta.json'), 'utf8'));

// ── recorte por contagem de chaves — mesma técnica de extrairCssForaDeMedia
// (tests/refrigeracao-desktop.test.js) e do script descartável do fixture. ──
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

function ateFimDeLinha(html, marcador) {
  const ini = html.indexOf(marcador);
  assert.ok(ini >= 0, `marcador "${marcador}" não encontrado`);
  const fim = html.indexOf(';', ini);
  return html.slice(ini, fim + 1);
}

// ── código REAL, recortado do arquivo (nunca reescrito) — o mesmo conjunto
// que o script descartável do fixture usa contra o HTML de HEAD. ──
const MARCADORES_REAIS = [
  'function esc(s){',
  'function fmtDate(iso){',
  'var EQUIP_SITUACOES = {',
  'function normalizarSituacaoEquip(v){',
  'function equipSituacao(e){',
  'function equipInstalado(e){',
  'function equipBaixado(e){',
  'function rotuloSituacaoEquip(v){',
  'function linkSeguro(u) {',
  'function campoLinkFicha(rotulo, valor){',
];

const MARCADORES_FICHA = [
  'function fichaBlocoLocal(e){',
  // 260831-2mx: fichaBlocoLocal chama fichaAcaoMovimentacao, que devolve
  // vazio enquanto MAN_FLUXO_OK/MOV_OK forem falsos — é por isso que o
  // fixture da gaveta continua byte a byte igual sem a migração 42.
  'function fichaAcaoMovimentacao(e){',
  // 260829-500: fichaBlocoDados chama fichaAtributos, que devolve vazio
  // enquanto ATRIB_OK for falso — é por isso que o fixture da gaveta
  // continua byte a byte igual sem a migração 45.
  'function fichaAtributos(e){',
  'function fichaBlocoDados(e){',
  'function fichaBlocoEstado(e, logs, crit, lastDate, ni, np){',
  'function fichaBlocoHistorico(id, logs){',
  'function fichaBlocos(e, logs, id){',
  'function fichaIdentidade(e, crit){',
  'function fichaAcoes(id, alvo){',
  'function indiceDaAba(chave){',
  'function rotuloVolta(chave){',
];

// ── mocks determinísticos: só para o que já tem gate próprio noutro
// arquivo (D-92t: autoCrit, nextPmoc, dueBadgeHtml, statusPill, critPill,
// situacaoPill, statusPillOS, renderMedicoesFicha, blocoQrFicha,
// podeEditarCadastro, MAN_FLUXO_OK). Tudo o mais é código real recortado. ──
function mocksComuns() {
  return {
    getLatestLogDate: function () { return null; },
    autoCrit: function (e) { return e.criticidade; },
    nextPmoc: function () { return null; },
    dueBadgeHtml: function (d) { return '<span class="due-mock">' + (d ? 'x' : 'none') + '</span>'; },
    statusPill: function (fn) { return '<span class="pill-mock-status">' + fn + '</span>'; },
    critPill: function (crit) { return '<span class="pill-mock-crit">' + crit + '</span>'; },
    situacaoPill: function (v) { return (v && v !== 'instalado') ? '<span class="pill-mock-sit">' + v + '</span>' : ''; },
    statusPillOS: function (s) { return '<span class="pill-mock-os">' + s + '</span>'; },
    renderMedicoesFicha: function (logs) { return '<div class="medicoes-mock">' + (logs ? logs.length : 0) + '</div>'; },
    blocoQrFicha: function (id) { return '<div class="qr-mock">' + id + '</div>'; },
    podeEditarCadastro: function () { return true; },
    MAN_FLUXO_OK: false,
    // 260831-2mx: a segunda sonda do atalho de movimentação da ficha. Fica
    // explícita mesmo sendo curto-circuitada por MAN_FLUXO_OK, para que
    // reordenar a guarda um dia não faça o gate passar por acidente.
    MOV_OK: false,
    manPode: function () { return true; },
    // 260829-500: mesma ideia de MAN_FLUXO_OK — a sonda desligada é o
    // estado da tela publicada antes da migração 45, e é sob ela que o
    // fixture da gaveta tem de continuar byte a byte igual.
    ATRIB_OK: false,
  };
}

function carregarSandboxFicha() {
  const ctx = mocksComuns();
  vm.createContext(ctx);
  MARCADORES_REAIS.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  MARCADORES_FICHA.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  vm.runInContext(ateFimDeLinha(HTML, 'var FICHA_COLUNAS = '), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var ABAS_NAV = '), ctx);
  vm.runInContext(bloco(HTML, 'var ROTULOS_VOLTA = {'), ctx);
  return ctx;
}

const EQUIP_FIXO = {
  id: 501, local: 'Sala 1', predio: 'F21', area: 'VERMELHA', tipo: 'SPLIT',
  fabricante: 'LG', modelo: 'X1', btu: 12000, funciona: 'OP', estado: 'NOVA',
  criticidade: 'ALTA', tensao: 220, correnteNominal: '5.5', patrimonio: '123',
  dataFabricacao: '2020-01-01', dataInstalacao: '2021-01-01',
  ultimaManutencao: '2026-01-01', refrigerante: 'R410A',
  link: 'https://x.example', manualUrl: 'https://y.example',
  obs: 'Observação de teste', situacao: 'instalado',
  horasDia: 8, diasSemana: 5,
};

const LOGS_FIXOS = [
  { id: 'l1', date: '2026-01-15', tipo: 'PREVENTIVA', status: 'CONCLUÍDA', tecnico: 'João', desc: 'Troca de filtro', checklist: [{ done: true }, { done: false }] },
  { id: 'l2', date: '2026-01-01', tipo: 'INSPEÇÃO', status: 'CONCLUÍDA', tecnico: '', desc: '', checklist: [] },
];

test('os recortes de carregarSandboxFicha existem no HTML', () => {
  assert.doesNotThrow(() => carregarSandboxFicha());
});

// ═══════════════ TAREFA 1 — fonte única, gaveta provada byte a byte ══════

test('fichaBlocos(e, logs, id) devolve array de 5 strings, e .join(\'\') é byte a byte igual ao fixture da gaveta (D-92t-02/14)', () => {
  const ctx = carregarSandboxFicha();
  const blocos = ctx.fichaBlocos(EQUIP_FIXO, LOGS_FIXOS, EQUIP_FIXO.id);
  assert.equal(blocos.length, 5);
  blocos.forEach((b) => assert.equal(typeof b, 'string'));
  assert.strictEqual(blocos.join(''), FIXTURE.corpo);
});

test('fichaIdentidade(e, crit) devolve os quatro campos byte a byte iguais ao fixture', () => {
  const ctx = carregarSandboxFicha();
  const crit = ctx.autoCrit(EQUIP_FIXO);
  const ident = ctx.fichaIdentidade(EQUIP_FIXO, crit);
  assert.strictEqual(ident.id, FIXTURE.dhId);
  assert.strictEqual(ident.local, FIXTURE.dhLocal);
  assert.strictEqual(ident.predio, FIXTURE.dhPredio);
  assert.strictEqual(ident.pills, FIXTURE.dhPills);
});

test('fichaAcoes(id, \'gaveta\') é byte a byte igual ao rodapé de hoje (D-92t-07)', () => {
  const ctx = carregarSandboxFicha();
  assert.strictEqual(ctx.fichaAcoes(EQUIP_FIXO.id, 'gaveta'), FIXTURE.rodape);
});

test('equipamento removido/baixado produz a linha honesta do bloco 1 em vez de prédio/local vazios (D-uyz-10/f)', () => {
  const ctx = carregarSandboxFicha();
  const removido = Object.assign({}, EQUIP_FIXO, { id: 502, situacao: 'removido', dataRemocao: '2026-02-01' });
  const b1r = ctx.fichaBlocoLocal(removido);
  assert.match(b1r, /Sem local — removido em 01\/02\/2026/);
  assert.doesNotMatch(b1r, /<label>Prédio<\/label>/);

  const baixado = Object.assign({}, EQUIP_FIXO, { id: 503, situacao: 'baixado', dataBaixa: '2026-03-01' });
  const b1b = ctx.fichaBlocoLocal(baixado);
  assert.match(b1b, /Baixado em 01\/03\/2026/);
  assert.doesNotMatch(b1b, /<label>Local<\/label>/);
});

test('FICHA_COLUNAS achatada é permutação exata de [0,1,2,3,4] — nenhum bloco some, nenhum duplica', () => {
  const ctx = carregarSandboxFicha();
  const achatada = [].concat.apply([], ctx.FICHA_COLUNAS).slice().sort();
  assert.deepStrictEqual(achatada, [0, 1, 2, 3, 4]);
});

test('rotuloVolta devolve texto para as cinco abas e \'Voltar\' para chave desconhecida, nunca contendo undefined', () => {
  const ctx = carregarSandboxFicha();
  ['dash', 'inv', 'os', 'pmoc', 'alert'].forEach((chave) => {
    const r = ctx.rotuloVolta(chave);
    assert.equal(typeof r, 'string');
    assert.ok(r.length > 0, `rotuloVolta('${chave}') veio vazio`);
    assert.doesNotMatch(r, /undefined/);
  });
  assert.equal(ctx.rotuloVolta('fantasma'), 'Voltar');
  assert.doesNotMatch(ctx.rotuloVolta('fantasma'), /undefined/);
});

test('indiceDaAba devolve 0..4 para as cinco chaves e -1 para desconhecida, sem lançar', () => {
  const ctx = carregarSandboxFicha();
  ['dash', 'inv', 'os', 'pmoc', 'alert'].forEach((chave, i) => {
    assert.equal(ctx.indiceDaAba(chave), i);
  });
  assert.doesNotThrow(() => ctx.indiceDaAba('fantasma'));
  assert.equal(ctx.indiceDaAba('fantasma'), -1);
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

// ═══════════ TAREFA 2 — #page-ficha: marcação, CSS, abrir e voltar ═══════

// 260823-jar (D-jar-18): a camada compartilhada de estado/navegação
// (detalheAbertoDe/lerOrigemDetalhe/paginaDetalheAtiva/ativarPaginaDetalhe/
// fecharDetalhe/voltarDoDetalhe) — voltarDoDetalhe deixou de existir.
const MARCADORES_PAGINA = [
  'function botaoDaAba(chave){',
  'function detalheAbertoDe(tipo){',
  'function lerOrigemDetalhe(){',
  'function paginaDetalheAtiva(){',
  'function ativarPaginaDetalhe(idDaPagina){',
  'function voltarDoDetalhe(){',
  'function fecharDetalhe(){',
  'function abrirFichaPagina(id){',
  'function abrirFichaGaveta(id){',
  'function openDetail(id){',
];

// ── DOM de mentira: só o suficiente para abrirFichaPagina/voltarDoDetalhe —
// mesmo padrão de objetos com classList de conjunto e querySelector(All)
// sobre uma lista declarada no teste já usado nos outros gates do módulo. ──
function criarElemento(id, classesIniciais) {
  const classes = new Set(classesIniciais || []);
  return {
    id: id,
    textContent: '',
    innerHTML: '',
    scrollTop: 0,
    style: {},
    classList: {
      add: function (c) { classes.add(c); },
      remove: function (c) { classes.delete(c); },
      contains: function (c) { return classes.has(c); },
    },
  };
}

// navTo tem gate próprio (chamadas registradas, não reexecutadas — o que
// está sob teste aqui é abrirFichaPagina/voltarDoDetalhe, não navTo em si).
function criarSandboxPagina(extras) {
  const paginasChaves = ['dash', 'inv', 'os', 'pmoc', 'alert', 'ficha'];
  const nodes = {};
  paginasChaves.forEach(function (k) {
    nodes['page-' + k] = criarElemento('page-' + k, k === 'dash' ? ['page', 'active'] : ['page']);
  });
  ['fh-id', 'fh-local', 'fh-predio', 'fh-pills', 'fh-acoes', 'fh-voltar-txt',
    'ficha-col-1', 'ficha-col-2', 'ficha-col-3', 'fab',
    'dh-id', 'dh-local', 'dh-predio', 'dh-pills', 'drawer-body', 'drawer-footer'].forEach(function (id) {
    nodes[id] = criarElemento(id);
  });
  nodes['drawer'] = criarElemento('drawer');

  const navBtns = ['dash', 'inv', 'os', 'pmoc', 'alert'].map(function (k) {
    return criarElemento('nav-' + k, k === 'dash' ? ['nav-btn', 'active'] : ['nav-btn']);
  });

  const chamadasNavTo = [];
  const ctx = mocksComuns();
  Object.assign(ctx, {
    DATA: [EQUIP_FIXO],
    getEquipLog: function (id) { return id === EQUIP_FIXO.id ? LOGS_FIXOS : []; },
    TELA_LARGA: true,
    el: function (id) { return nodes[id] || null; },
    document: {
      querySelector: function (sel) {
        if (sel === '.page.active') {
          let achou = null;
          paginasChaves.forEach(function (k) { if (nodes['page-' + k].classList.contains('active')) achou = nodes['page-' + k]; });
          return achou;
        }
        return null;
      },
      querySelectorAll: function (sel) {
        if (sel === '.page') return paginasChaves.map(function (k) { return nodes['page-' + k]; });
        if (sel === '#bottom-nav .nav-btn') return navBtns;
        return [];
      },
      addEventListener: function () {},
      body: { style: {} },
    },
    closeDrawer: function () { nodes['drawer'].classList.remove('open'); },
    openDrawer: function () { nodes['drawer'].classList.add('open'); },
    // navTo tem gate próprio — o mock reproduz só o efeito de marcação que
    // reAlojarDetalhe/voltarDoDetalhe dependem (troca de .page.active), não a
    // lógica real de qual render* chamar.
    navTo: function (pagina, btn) {
      chamadasNavTo.push({ pagina: pagina, btn: btn });
      paginasChaves.forEach(function (k) { nodes['page-' + k].classList.remove('active'); });
      if (nodes['page-' + pagina]) nodes['page-' + pagina].classList.add('active');
    },
  });
  Object.assign(ctx, extras || {});
  vm.createContext(ctx);
  MARCADORES_REAIS.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  MARCADORES_FICHA.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  MARCADORES_PAGINA.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  vm.runInContext(ateFimDeLinha(HTML, 'var FICHA_COLUNAS = '), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var ABAS_NAV = '), ctx);
  vm.runInContext(bloco(HTML, 'var ROTULOS_VOLTA = {'), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var DETALHE_ABERTO = '), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var DETALHE_ORIGEM = '), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var PAGINAS_DETALHE = '), ctx);
  return { ctx: ctx, nodes: nodes, navBtns: navBtns, chamadasNavTo: chamadasNavTo };
}

test('openDetail: TELA_LARGA verdadeiro abre a ficha como página; falso abre a gaveta como antes (D-92t-01)', () => {
  let s = criarSandboxPagina({ TELA_LARGA: true });
  s.ctx.openDetail(EQUIP_FIXO.id);
  assert.ok(s.nodes['page-ficha'].classList.contains('active'));
  assert.ok(s.nodes['ficha-col-1'].innerHTML.length > 0);

  s = criarSandboxPagina({ TELA_LARGA: false });
  s.ctx.openDetail(EQUIP_FIXO.id);
  assert.ok(!s.nodes['page-ficha'].classList.contains('active'));
  assert.ok(s.nodes['drawer'].classList.contains('open'));
});

test('as três colunas recebem os blocos por FICHA_COLUNAS — os cinco títulos aparecem, cada um exatamente uma vez', () => {
  const s = criarSandboxPagina();
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  const uniao = s.nodes['ficha-col-1'].innerHTML + s.nodes['ficha-col-2'].innerHTML + s.nodes['ficha-col-3'].innerHTML;
  const titulos = ['1 · Local', '2 · Dados do equipamento', '3 · Estado e PMOC', '4 · Histórico de OS/manutenções'];
  titulos.forEach((titulo) => {
    const qtd = uniao.split(titulo).length - 1;
    assert.equal(qtd, 1, `título "${titulo}" apareceu ${qtd} vez(es)`);
  });
  assert.equal((uniao.match(/qr-mock/g) || []).length, 1, 'bloco 5 (QR, mockado) não apareceu exatamente uma vez');
});

test('abrirFichaPagina grava DETALHE_ORIGEM a partir de .page.active, cai para \'inv\' quando desconhecida/nenhuma/a própria ficha', () => {
  let s = criarSandboxPagina();
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-alert'].classList.add('active');
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.equal(s.ctx.DETALHE_ORIGEM, 'alert');

  s = criarSandboxPagina();
  s.nodes['page-dash'].classList.remove('active'); // nenhuma página ativa
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.equal(s.ctx.DETALHE_ORIGEM, 'inv');

  s = criarSandboxPagina();
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-ficha'].classList.add('active'); // a própria ficha já ativa
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.equal(s.ctx.DETALHE_ORIGEM, 'inv');
});

test('abrirFichaPagina nunca apaga .active de nenhum .nav-btn', () => {
  const s = criarSandboxPagina();
  assert.ok(s.navBtns[0].classList.contains('active'));
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.ok(s.navBtns[0].classList.contains('active'), 'abrirFichaPagina apagou o estado ativo do nav-btn');
});

test('abrirFichaPagina fecha a gaveta se estiver aberta — impede gaveta órfã', () => {
  const s = criarSandboxPagina();
  s.nodes['drawer'].classList.add('open');
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.ok(!s.nodes['drawer'].classList.contains('open'));
});

test('voltarDoDetalhe chama navTo(DETALHE_ORIGEM, botaoDaAba(DETALHE_ORIGEM)) e zera DETALHE_ABERTO', () => {
  const s = criarSandboxPagina();
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-pmoc'].classList.add('active');
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.equal(s.ctx.detalheAbertoDe('ficha'), EQUIP_FIXO.id);
  s.ctx.voltarDoDetalhe();
  assert.equal(s.ctx.detalheAbertoDe('ficha'), null);
  assert.equal(s.chamadasNavTo.length, 1);
  assert.equal(s.chamadasNavTo[0].pagina, 'pmoc');
  assert.strictEqual(s.chamadasNavTo[0].btn, s.navBtns[3]); // pmoc = índice 3 em ABAS_NAV
});

test('#fh-voltar-txt nomeia o destino e nunca contém undefined', () => {
  const s = criarSandboxPagina();
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-os'].classList.add('active');
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.equal(s.nodes['fh-voltar-txt'].textContent, 'Voltar às OS');
  assert.doesNotMatch(s.nodes['fh-voltar-txt'].textContent, /undefined/);
});

test('#fab fica escondido enquanto a ficha-página está ativa', () => {
  const s = criarSandboxPagina();
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.equal(s.nodes['fab'].style.display, 'none');
});

test('as três colunas voltam ao topo a cada abertura', () => {
  const s = criarSandboxPagina();
  s.nodes['ficha-col-1'].scrollTop = 400;
  s.nodes['ficha-col-2'].scrollTop = 250;
  s.nodes['ficha-col-3'].scrollTop = 900;
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.equal(s.nodes['ficha-col-1'].scrollTop, 0);
  assert.equal(s.nodes['ficha-col-2'].scrollTop, 0);
  assert.equal(s.nodes['ficha-col-3'].scrollTop, 0);
});

test('#page-ficha é a sexta .page dentro de #content, com os identificadores de D-92t-04', () => {
  const iniContent = HTML.indexOf('id="content"');
  const fimContent = HTML.indexOf('<!-- /content -->');
  assert.ok(iniContent > 0 && fimContent > iniContent, '#content não encontrado');
  const trecho = HTML.slice(iniContent, fimContent);
  assert.match(trecho, /id="page-ficha"/);
  for (const id of ['fh-voltar', 'fh-voltar-txt', 'fh-id', 'fh-local', 'fh-predio', 'fh-pills', 'fh-acoes', 'ficha-hdr', 'ficha-colunas', 'ficha-col-1', 'ficha-col-2', 'ficha-col-3']) {
    assert.match(trecho, new RegExp('id="' + id + '"'), `id="${id}" não encontrado em #page-ficha`);
  }
});

test('D-92t-04: nenhum id dh-* é duplicado no documento — um só elemento por id', () => {
  ['dh-id', 'dh-local', 'dh-predio', 'dh-pills'].forEach((id) => {
    const qtd = (HTML.match(new RegExp('id="' + id + '"', 'g')) || []).length;
    assert.equal(qtd, 1, `id="${id}" aparece ${qtd} vez(es)`);
  });
});

// ═══════════ TAREFA 3 — cruzar o limiar, formulários, link profundo ══════

test('DETALHE_ABERTO é zerado no topo de openLogForm/openEquipForm/openNewOS e dentro de closeDrawer', () => {
  const casos = [
    'function openLogForm(equipId){',
    'function openEquipForm(id){',
    'function openNewOS(){',
    'function closeDrawer(){',
  ];
  casos.forEach((marcador) => {
    const corpo = bloco(HTML, marcador);
    assert.match(corpo, /DETALHE_ABERTO\s*=\s*null;/, `"${marcador}" não zera DETALHE_ABERTO`);
  });
});

test('reAlojarDetalhe: página+estreitar sai da ficha-página, volta à origem, e abre a gaveta com o MESMO equipamento', () => {
  const s = criarSandboxPagina({ TELA_LARGA: true });
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-pmoc'].classList.add('active');
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.ok(s.nodes['page-ficha'].classList.contains('active'));

  vm.runInContext(bloco(HTML, 'function reAlojarDetalhe(){'), s.ctx);
  s.ctx.TELA_LARGA = false;
  const houve = s.ctx.reAlojarDetalhe();
  assert.equal(houve, true);
  assert.ok(!s.nodes['page-ficha'].classList.contains('active'));
  assert.equal(s.chamadasNavTo.length, 1);
  assert.equal(s.chamadasNavTo[0].pagina, 'pmoc');
  assert.ok(s.nodes['drawer'].classList.contains('open'), 'a gaveta deveria abrir com o mesmo equipamento');
  assert.match(s.nodes['dh-id'].textContent, new RegExp('#' + EQUIP_FIXO.id));
  assert.equal(s.ctx.detalheAbertoDe('ficha'), EQUIP_FIXO.id);
});

test('reAlojarDetalhe: página+largo (já correto) devolve false, sem chamar navTo nem tocar #page-ficha', () => {
  const s = criarSandboxPagina({ TELA_LARGA: true });
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  vm.runInContext(bloco(HTML, 'function reAlojarDetalhe(){'), s.ctx);
  const houve = s.ctx.reAlojarDetalhe();
  assert.equal(houve, false);
  assert.ok(s.nodes['page-ficha'].classList.contains('active'));
  assert.equal(s.chamadasNavTo.length, 0);
});

test('reAlojarDetalhe: gaveta+alargar fecha a gaveta e abre a ficha-página com o MESMO equipamento; a origem por baixo continua', () => {
  const s = criarSandboxPagina({ TELA_LARGA: true });
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-alert'].classList.add('active');
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id); // origem = alert, DETALHE_ABERTO = id

  vm.runInContext(bloco(HTML, 'function reAlojarDetalhe(){'), s.ctx);
  // estreita — vira gaveta com o mesmo equipamento (ramo já provado acima)
  s.ctx.TELA_LARGA = false;
  s.ctx.reAlojarDetalhe();
  assert.ok(s.nodes['drawer'].classList.contains('open'));
  assert.equal(s.ctx.detalheAbertoDe('ficha'), EQUIP_FIXO.id);

  // alarga de volta — vira página de novo, com o MESMO equipamento
  s.ctx.TELA_LARGA = true;
  const houve = s.ctx.reAlojarDetalhe();
  assert.equal(houve, true);
  assert.ok(!s.nodes['drawer'].classList.contains('open'), 'a gaveta deveria fechar');
  assert.ok(s.nodes['page-ficha'].classList.contains('active'));
  assert.equal(s.ctx.DETALHE_ORIGEM, 'alert', 'a origem por baixo deveria continuar sendo a mesma');
});

test('reAlojarDetalhe: gaveta+estreito (já correto, gaveta comum) devolve false', () => {
  const s = criarSandboxPagina({ TELA_LARGA: false });
  s.ctx.abrirFichaGaveta(EQUIP_FIXO.id);
  vm.runInContext(bloco(HTML, 'function reAlojarDetalhe(){'), s.ctx);
  const houve = s.ctx.reAlojarDetalhe();
  assert.equal(houve, false);
  assert.ok(s.nodes['drawer'].classList.contains('open'));
});

test('reAlojarDetalhe: formulário aberto sobre a ficha-página (DETALHE_ABERTO nulo) — #page-ficha nunca fica ativa no estreito, e o conteúdo da gaveta não é sobrescrito', () => {
  const s = criarSandboxPagina({ TELA_LARGA: true });
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-os'].classList.add('active');
  s.ctx.abrirFichaPagina(EQUIP_FIXO.id);
  assert.ok(s.nodes['page-ficha'].classList.contains('active'));

  // simula um formulário aberto sobre a ficha-página — openEquipForm/
  // openLogForm/openNewOS zerariam DETALHE_ABERTO (caso já provado acima).
  s.ctx.DETALHE_ABERTO = null;
  s.nodes['drawer-body'].innerHTML = '<div class="ds">FORM MARCADO</div>';
  s.nodes['drawer'].classList.add('open');

  vm.runInContext(bloco(HTML, 'function reAlojarDetalhe(){'), s.ctx);
  s.ctx.TELA_LARGA = false;
  const houve = s.ctx.reAlojarDetalhe();
  assert.equal(houve, true);
  assert.ok(!s.nodes['page-ficha'].classList.contains('active'));
  assert.match(s.nodes['drawer-body'].innerHTML, /FORM MARCADO/, 'o conteúdo do formulário foi sobrescrito — deveria sobreviver ao redimensionamento');
});

const MARCADORES_ALVO = [
  'function lerAlvoFicha(busca) {',
  'function buscaSemAlvo(busca) {',
  'function limparUrlDoAlvo() {',
  'function aplicarAlvoFicha() {',
];

function criarSandboxAlvoFicha(overrides) {
  const paginasChaves = ['dash', 'inv', 'os', 'pmoc', 'alert', 'ficha'];
  const nodes = {};
  paginasChaves.forEach(function (k) {
    nodes['page-' + k] = criarElemento('page-' + k, k === 'dash' ? ['page', 'active'] : ['page']);
  });
  ['fh-id', 'fh-local', 'fh-predio', 'fh-pills', 'fh-acoes', 'fh-voltar-txt',
    'ficha-col-1', 'ficha-col-2', 'ficha-col-3', 'fab',
    'dh-id', 'dh-local', 'dh-predio', 'dh-pills', 'drawer-body', 'drawer-footer',
    'nav-inv'].forEach(function (id) { nodes[id] = criarElemento(id); });
  nodes['drawer'] = criarElemento('drawer');
  const navBtns = ['dash', 'inv', 'os', 'pmoc', 'alert'].map(function (k) {
    return criarElemento('nav-' + k, k === 'dash' ? ['nav-btn', 'active'] : ['nav-btn']);
  });

  const chamadasNavTo = [];
  const ctx = mocksComuns();
  Object.assign(ctx, {
    DATA: [EQUIP_FIXO],
    getEquipLog: function (id) { return id === EQUIP_FIXO.id ? LOGS_FIXOS : []; },
    TELA_LARGA: true,
    el: function (id) { return nodes[id] || null; },
    document: {
      querySelector: function (sel) {
        if (sel === '.page.active') {
          let achou = null;
          paginasChaves.forEach(function (k) { if (nodes['page-' + k].classList.contains('active')) achou = nodes['page-' + k]; });
          return achou;
        }
        return null;
      },
      querySelectorAll: function (sel) {
        if (sel === '.page') return paginasChaves.map(function (k) { return nodes['page-' + k]; });
        if (sel === '#bottom-nav .nav-btn') return navBtns;
        return [];
      },
      addEventListener: function () {},
      body: { style: {} },
    },
    closeDrawer: function () { nodes['drawer'].classList.remove('open'); },
    openDrawer: function () { nodes['drawer'].classList.add('open'); },
    navTo: function (pagina, btn) {
      chamadasNavTo.push({ pagina: pagina, btn: btn });
      paginasChaves.forEach(function (k) { nodes['page-' + k].classList.remove('active'); });
      if (nodes['page-' + pagina]) nodes['page-' + pagina].classList.add('active');
    },
    showToast: function () {},
  });
  Object.assign(ctx, overrides || {});
  vm.createContext(ctx);
  MARCADORES_REAIS.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  MARCADORES_FICHA.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  MARCADORES_PAGINA.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  vm.runInContext(ateFimDeLinha(HTML, 'var FICHA_COLUNAS = '), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var ABAS_NAV = '), ctx);
  vm.runInContext(bloco(HTML, 'var ROTULOS_VOLTA = {'), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var DETALHE_ABERTO = '), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var DETALHE_ORIGEM = '), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var PAGINAS_DETALHE = '), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var PARAM_FICHA = '), ctx);
  vm.runInContext(ateFimDeLinha(HTML, 'var ALVO_FICHA = null;'), ctx);
  MARCADORES_ALVO.forEach(function (m) { vm.runInContext(bloco(HTML, m), ctx); });
  return { ctx: ctx, nodes: nodes, navBtns: navBtns, chamadasNavTo: chamadasNavTo };
}

test('aplicarAlvoFicha em tela larga: URL consumida uma vez, ficha abre como página com origem Parque, sem edição em aplicarAlvoFicha (D-92t-11/12)', () => {
  const s = criarSandboxAlvoFicha();
  s.ctx.ALVO_FICHA = EQUIP_FIXO.id;
  const achou = s.ctx.aplicarAlvoFicha();
  assert.equal(achou, true);
  assert.equal(s.ctx.ALVO_FICHA, null, 'ALVO_FICHA deveria ser consumido uma única vez');
  assert.ok(s.nodes['page-ficha'].classList.contains('active'));
  assert.equal(s.ctx.DETALHE_ORIGEM, 'inv');
  assert.equal(s.chamadasNavTo.length, 1);
  assert.equal(s.chamadasNavTo[0].pagina, 'inv');
});

test('nenhuma função nova escreve na barra de endereço — zero pushState no arquivo, limparUrlDoAlvo com o corpo de hoje (D-92t-12)', () => {
  assert.equal((HTML.match(/pushState/g) || []).length, 0);
  const corpoLimpar = bloco(HTML, 'function limparUrlDoAlvo() {');
  assert.match(corpoLimpar, /history\.replaceState/);
});
