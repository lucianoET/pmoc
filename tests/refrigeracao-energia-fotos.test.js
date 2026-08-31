// Gate da quick-260826-3v8 — fallback de potência estimada por capacidade
// (BTU/h ÷ 3412 ÷ COP) quando falta corrente nominal de placa, e seletor de
// fotos livre (câmera + fototeca + arquivos) na execução da OS.
//
// Escrito e visto FALHANDO antes da mudança — procedimento padrão dos gates
// de /refrigeracao (mesmo de tests/refrigeracao-planilha.test.js e
// tests/refrigeracao-os-pagina.test.js): comportamental sobre o código
// real, via node:vm, não regex sobre o arquivo, exceto as três asserções
// estruturais de marcação do fim (mesmo precedente de D-5hy-02/08).
//
// Por que o fallback existe: equipamentos.corrente_nominal é NULL nas 175
// linhas do banco (a migração 05 nunca importou o campo) — a conta antiga,
// tensão × corrente, produzia potência 0 para o parque inteiro, mesmo com
// 8.890.000 BTU/h em operação. Sem corrente de placa, a potência passa a
// ser estimada pela capacidade; dado de placa vence estimativa quando
// existe — por isso o caso com corrente E capacidade ao mesmo tempo é
// testado explicitamente (nunca soma as duas contas).
//
// D-3v8-recorte: o recorte da potência aponta para '/* ── potência
// estimada', o comentário que a Task 2 escreve imediatamente antes das
// constantes DV_BTU_POR_KW/DV_COP e da própria dvPotenciaW — marcador que
// ainda NÃO existe no arquivo nesta task (RED). Por isso os dez testes de
// potência falham agora por "recorte não encontrado" (uma asserção, não um
// erro de sintaxe), e não por valor errado; a Task 2 escreve o comentário e
// as duas constantes no mesmo commit que corrige dvPotenciaW, e o mesmo
// recorte passa a encontrar e a carregar os três juntos, sem precisar tocar
// neste arquivo de novo (GREEN).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

function carregarSandboxPotencia() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── potência estimada', 'function dvDonut('), ctx);
  return ctx;
}

function equip(over) {
  return Object.assign({ tensao: 220, correnteNominal: 0, btu: 0 }, over || {});
}

// ══════════════════════ dvPotenciaW (comportamental) ════════════════════

test('dvPotenciaW: com corrente, é tensão × corrente, como hoje (220V)', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW(equip({ tensao: 220, correnteNominal: 5.5 })), 1210);
});

test('dvPotenciaW: corrente como string do banco não muda o resultado', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW(equip({ tensao: 220, correnteNominal: '5.5' })), 1210);
});

test('dvPotenciaW: trifásico 380V multiplica por 1,732, como hoje', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW(equip({ tensao: 380, correnteNominal: 5.5 })), 3620);
});

test('dvPotenciaW: dado de placa vence a estimativa — nunca soma com ela', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW(equip({ tensao: 220, correnteNominal: 5.5, btu: 12000 })), 1210);
});

test('dvPotenciaW: sem corrente, cai no fallback por capacidade (12000 BTU/h)', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW(equip({ tensao: 220, correnteNominal: null, btu: 12000 })), 1172);
});

test('dvPotenciaW: correnteNominal 0 também cai no fallback', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW(equip({ tensao: 220, correnteNominal: 0, btu: 9000 })), 879);
});

test('dvPotenciaW: fallback não muda com a tensão — √3 é da conta de corrente, não da capacidade', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW(equip({ tensao: 380, correnteNominal: null, btu: 12000 })), 1172);
});

test('dvPotenciaW: sem corrente e sem capacidade (btu 0), a potência é 0', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW(equip({ tensao: 220, correnteNominal: null, btu: 0 })), 0);
});

test('dvPotenciaW: objeto vazio não inventa potência', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW({}), 0);
});

test('dvPotenciaW: tensão ausente cai no padrão 220', () => {
  const ctx = carregarSandboxPotencia();
  assert.equal(ctx.dvPotenciaW({ correnteNominal: 5.5 }), 1210);
});

// ══════════════════════ marcação: input de fotos da execução ═══════════

test('input de fotos da execução mantém accept="image/*" e multiple', () => {
  const inputFotos = recorte('id="man-ex-fotos"', '/>');
  assert.ok(inputFotos.includes('accept="image/*"'));
  assert.ok(inputFotos.includes('multiple'));
});

test('o atributo que força a origem do arquivo à câmera não aparece em nenhum ponto do arquivo', () => {
  // Montado por concatenação a partir da palavra do atributo, não escrito
  // inteiro no fonte deste teste — o próprio gate não pode ser a ocorrência
  // que ele proíbe.
  const atributoCamera = 'capture' + '=' + '"environment"';
  assert.ok(!HTML.includes(atributoCamera));
});

// ══════════════════════ marcação: nota do card de energia ═══════════════

test('a nota do card de energia menciona BTU e COP — a tela diz de onde veio o número estimado', () => {
  const blocoEnergia = recorte('/* ── energia elétrica ── */', '/* ── BTU por prédio');
  assert.ok(blocoEnergia.includes('chart-note'));
  assert.ok(blocoEnergia.includes('BTU'));
  assert.ok(blocoEnergia.includes('COP'));
});
