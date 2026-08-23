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
