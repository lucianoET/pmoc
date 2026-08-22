// Gate da ficha do equipamento em quatro blocos, do cadastro editável e da
// folha timbrada com dois consumidores — 260821-q57 Task 2.
//
// Mesmo padrão de recorte + sandbox node:vm de tests/inventario-ordem-refrigeracao.test.js
// e tests/refrigeracao-estado-equipamento.test.js. CAMPOS_EQUIP é conferido contra as
// colunas REAIS de `equipamentos`, extraídas das migrações 04 (create table) + 19 + 25 + 41
// (add column) — a mesma lição que tests/refrigeracao-fluxo-os-interna.test.js já paga
// para CAMPOS_LOG/logs_manutencao (migrações 04+40).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const SQL_04 = fs.readFileSync(path.join(RAIZ, 'supabase', '04_refrigeracao_schema.sql'), 'utf8');
const SQL_19 = fs.readFileSync(path.join(RAIZ, 'supabase', '19_cmasm_locais_unificado.sql'), 'utf8');
const SQL_25 = fs.readFileSync(path.join(RAIZ, 'supabase', '25_mapa_geometria_posicao.sql'), 'utf8');
const SQL_41 = fs.readFileSync(path.join(RAIZ, 'supabase', '41_refrigeracao_ficha_estado.sql'), 'utf8');
// 260821-uyz: a migração 42 acrescenta situacao/data_remocao/data_baixa em
// equipamentos — sem somá-la aqui este gate voltaria a afirmar que a união
// das migrações é a verdade, quando não seria mais.
const SQL_42 = fs.readFileSync(path.join(RAIZ, 'supabase', '42_refrigeracao_movimentacao.sql'), 'utf8');

// ── colunas reais de `equipamentos` (união das 4 migrações) ──────────────
function colunasDaCreateTable() {
  const ini = SQL_04.indexOf('create table if not exists equipamentos (');
  assert.ok(ini >= 0, 'create table equipamentos não encontrada na migração 04');
  const fim = SQL_04.indexOf(');', ini);
  const corpo = SQL_04.slice(ini + 'create table if not exists equipamentos ('.length, fim);
  return corpo.split(',').map((seg) => seg.trim().split(/\s+/)[0]).filter(Boolean);
}
function colunasAddColumn(sql, tabela) {
  const re = new RegExp(`alter table ${tabela}\\s+add column if not exists (\\w+)`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(sql))) out.push(m[1]);
  return out;
}
const COLUNAS_EQUIPAMENTOS = [
  ...colunasDaCreateTable(),
  ...colunasAddColumn(SQL_19, 'equipamentos'),
  ...colunasAddColumn(SQL_25, 'equipamentos'),
  ...colunasAddColumn(SQL_41, 'equipamentos'),
  ...colunasAddColumn(SQL_42, 'equipamentos'),
];

function carregarSandboxPonte() {
  const ini = HTML.indexOf('/* ── ponte de campos de equipamentos ── */');
  const fim = HTML.indexOf('/* ── ponte de campos de logs_manutencao ── */', ini);
  assert.ok(ini > 0 && fim > ini, 'bloco "ponte de campos de equipamentos" não encontrado');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  return ctx;
}

function carregarSandboxDbToEquip() {
  const iniConv = HTML.indexOf('/* ── CONVERSORES ── */');
  const fimPonte = HTML.indexOf('/* ── ponte de campos de logs_manutencao ── */');
  assert.ok(iniConv > 0 && fimPonte > iniConv, 'CONVERSORES/ponte de equipamentos não encontrados');
  const ctx = {};
  vm.createContext(ctx);
  // dbToEquip depende de CAMPOS_EQUIP, definida logo depois dela no arquivo —
  // roda o trecho inteiro (CONVERSORES + ponte de equipamentos) de uma vez.
  vm.runInContext(HTML.slice(iniConv, fimPonte), ctx);
  return ctx;
}

test('toda coluna criada pela migração 41 em equipamentos aparece como valor em CAMPOS_EQUIP', () => {
  const ctx = carregarSandboxPonte();
  const novas41 = colunasAddColumn(SQL_41, 'equipamentos');
  assert.deepEqual(novas41.sort(), ['data_fabricacao', 'link', 'manual_url', 'modelo'].sort());
  const valoresMapa = Object.values(ctx.CAMPOS_EQUIP);
  for (const coluna of novas41) {
    assert.ok(valoresMapa.includes(coluna), `${coluna} (migração 41) não está em CAMPOS_EQUIP`);
  }
});

test('todo valor de CAMPOS_EQUIP é coluna real de equipamentos (união das migrações 04+19+25+41)', () => {
  const ctx = carregarSandboxPonte();
  for (const coluna of Object.values(ctx.CAMPOS_EQUIP)) {
    assert.ok(COLUNAS_EQUIPAMENTOS.includes(coluna), `CAMPOS_EQUIP aponta para "${coluna}", que não é coluna real de equipamentos`);
  }
});

test('criticidade_manual NÃO está entre os valores de CAMPOS_EQUIP, e a linha legada de dbToEquip continua presente (pendência registrada, não consertada)', () => {
  const ctx = carregarSandboxPonte();
  assert.ok(!Object.values(ctx.CAMPOS_EQUIP).includes('criticidade_manual'));
  assert.match(HTML, /o\.criticidadeManual = r\.criticidade_manual;/);
});

test('dbToEquip de uma linha completa devolve as nove chaves que hoje somem, e mantém as que a tela já lia', () => {
  const ctx = carregarSandboxDbToEquip();
  const linha = {
    id: 7, area: 'AZUL', predio: 'F21', local: 'Sala 1', tipo: 'SPLIT', fabricante: 'LG',
    modelo: 'X1', btu: 12000, funciona: 'OP', estado: 'NOVA', obs: '',
    refrig_permanente: true, horas_dia: 8, dias_semana: 5,
    criticidade: 'ALTA', tensao: 220, corrente_nominal: '5.5',
    patrimonio: '123', data_fabricacao: '2020-01-01', data_instalacao: '2021-01-01',
    ultima_manutencao: '2026-01-01', refrigerante: 'R410A',
    link: 'https://x', manual_url: 'https://y',
    area_m2: 20, pe_direito: 3, n_pessoas: 4, dissipacao_w: 100, fator_insolacao: 1.2,
    local_id: 302, lat: -22.84, lon: -43.1,
    criticidade_manual: null,
  };
  const e = ctx.dbToEquip(linha);
  for (const chave of ['refrigerante', 'areaM2', 'peDireito', 'nPessoas', 'dissipacaoW', 'fatorInsolacao', 'localId', 'lat', 'lon']) {
    assert.notEqual(e[chave], undefined, `dbToEquip não devolveu a chave ${chave}`);
  }
  assert.equal(e.refrigerante, 'R410A');
  assert.equal(e.areaM2, 20);
  assert.equal(e.localId, 302);
  assert.equal(e.lat, -22.84);
  // chaves que a tela já lia continuam presentes
  for (const chave of ['id', 'area', 'predio', 'local', 'tipo', 'fabricante', 'btu', 'funciona', 'estado', 'obs', 'refrigPermanente', 'horasDia', 'diasSemana', 'criticidade', 'tensao', 'correnteNominal', 'patrimonio', 'dataInstalacao', 'ultimaManutencao']) {
    assert.notEqual(e[chave], undefined, `dbToEquip perdeu a chave ${chave}`);
  }
  assert.equal(e.modelo, 'X1');
  assert.equal(e.dataFabricacao, '2020-01-01');
});

test('EQUIP_EDITAVEIS é subconjunto de CAMPOS_EQUIP, e lat/lon/localId/ultimaManutencao/id não estão nela', () => {
  const ctx = carregarSandboxPonte();
  for (const chave of ctx.EQUIP_EDITAVEIS) {
    assert.ok(ctx.CAMPOS_EQUIP.hasOwnProperty(chave), `EQUIP_EDITAVEIS contém "${chave}", fora de CAMPOS_EQUIP`);
  }
  for (const proibida of ['lat', 'lon', 'localId', 'ultimaManutencao', 'id']) {
    assert.ok(!ctx.EQUIP_EDITAVEIS.includes(proibida), `EQUIP_EDITAVEIS não deveria conter "${proibida}"`);
  }
});

test('equipParaDb({modelo, lat, bobagem}) devolve só {modelo} — chave fora do mapa e chave proibida caem juntas', () => {
  const ctx = carregarSandboxPonte();
  const patch = ctx.equipParaDb({ modelo: 'X', lat: 1, bobagem: 2 });
  // Comparação campo a campo, não deepEqual: `patch` nasce dentro do sandbox
  // node:vm, com Object.prototype de outro realm — deepStrictEqual falharia
  // por prototype diferente mesmo com os mesmos campos (mesma armadilha já
  // documentada em tests/refrigeracao-encerramento-os.test.js).
  assert.deepEqual(Object.keys(patch), ['modelo']);
  assert.equal(patch.modelo, 'X');
});

test('equipParaDb converte "" em null nos campos de data, número e texto — nunca manda texto vazio', () => {
  const ctx = carregarSandboxPonte();
  const patch = ctx.equipParaDb({ dataFabricacao: '', btu: '', area: '', modelo: 'X' });
  assert.strictEqual(patch.data_fabricacao, null);
  assert.strictEqual(patch.btu, null);
  assert.strictEqual(patch.area, null);
  assert.strictEqual(patch.modelo, 'X');
  const numerico = ctx.equipParaDb({ btu: '12000', tensao: '220', correnteNominal: '5.5' });
  assert.strictEqual(numerico.btu, 12000);
  assert.strictEqual(numerico.tensao, 220);
  assert.strictEqual(numerico.corrente_nominal, 5.5);
});

test('linkSeguro aceita http/https (inclusive maiúsculo) e recusa javascript:, data:, protocolo-relativo, caminho e espaço à frente', () => {
  const ctx = carregarSandboxPonte();
  assert.equal(ctx.linkSeguro('http://x'), 'http://x');
  assert.equal(ctx.linkSeguro('https://x'), 'https://x');
  assert.equal(ctx.linkSeguro('HTTPS://X'), 'HTTPS://X');
  for (const bruto of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', '/interno', ' https://x', '', null, undefined]) {
    assert.equal(ctx.linkSeguro(bruto), '', `linkSeguro(${JSON.stringify(bruto)}) deveria recusar`);
  }
});

test('podeEditarCadastro é verdadeiro para admin/gestor, falso para tecnico/observador/vazio/nulo, e falso no modo observador mesmo com cargo admin', () => {
  const ctx = carregarSandboxPonte();
  // 260822-48m: o ponto de chamada real trocou window._modoObservador por
  // somenteLeitura() (D-48m-01) — troca de stub, a asserção continua provando
  // que este ponto honra o modo somente-leitura.
  ctx.somenteLeitura = () => false;
  ctx.ctUser = { role: 'admin' };
  assert.equal(ctx.podeEditarCadastro(), true);
  ctx.ctUser = { role: 'gestor' };
  assert.equal(ctx.podeEditarCadastro(), true);
  ctx.ctUser = { role: 'tecnico' };
  assert.equal(ctx.podeEditarCadastro(), false);
  ctx.ctUser = { role: 'observador' };
  assert.equal(ctx.podeEditarCadastro(), false);
  ctx.ctUser = { role: '' };
  assert.equal(ctx.podeEditarCadastro(), false);
  ctx.ctUser = null;
  assert.equal(ctx.podeEditarCadastro(), false);
  ctx.ctUser = { role: 'admin' };
  ctx.somenteLeitura = () => true;
  assert.equal(ctx.podeEditarCadastro(), false);
});

test('fiação: openDetail traz os quatro blocos na ordem, salvarEquip chama podeEditarCadastro(), e o formulário rotula o campo de estado como Idade aparente', () => {
  const iniDetail = HTML.indexOf('function openDetail(id){');
  const fimDetail = HTML.indexOf('\n}', HTML.indexOf('openDrawer();', iniDetail));
  assert.ok(iniDetail > 0 && fimDetail > iniDetail, 'openDetail não encontrada');
  const corpoDetail = HTML.slice(iniDetail, fimDetail);
  const titulos = ['1 · Local', '2 · Dados do equipamento', '3 · Estado e PMOC', '4 · Histórico de OS/manutenções'];
  let ultimoIndice = -1;
  for (const titulo of titulos) {
    const idx = corpoDetail.indexOf(titulo);
    assert.ok(idx >= 0, `bloco "${titulo}" não encontrado em openDetail`);
    assert.ok(idx > ultimoIndice, `bloco "${titulo}" fora de ordem`);
    ultimoIndice = idx;
  }

  const iniSalvar = HTML.indexOf('async function salvarEquip(id){');
  const fimSalvar = HTML.indexOf('\n}', iniSalvar);
  assert.ok(iniSalvar > 0 && fimSalvar > iniSalvar, 'salvarEquip não encontrada');
  assert.match(HTML.slice(iniSalvar, fimSalvar), /podeEditarCadastro\(\)/);

  const iniForm = HTML.indexOf('/* ── cadastro do equipamento: formulário e gravação ── */');
  const fimForm = HTML.indexOf('function openEquipForm(');
  assert.ok(iniForm > 0 && fimForm > iniForm, 'bloco de cadastro do equipamento não encontrado');
  const corpoForm = HTML.slice(iniForm, fimForm);
  assert.match(corpoForm, /Idade aparente/);
  assert.match(corpoForm, /NOVA/);
  assert.match(corpoForm, /SEMI/);
  assert.match(corpoForm, /VELHA/);
  // o rótulo "Estado" pertence ao select ligado a `funciona`, nunca ao select ligado a `estado`
  const blocoEstadoDb = corpoForm.slice(corpoForm.indexOf("chave==='estado'"));
  assert.doesNotMatch(blocoEstadoDb.slice(0, blocoEstadoDb.indexOf('}')), />Estado</);
});

test('imprimirDocumento tem dois consumidores (ctPrintOS e printFicha) e nenhum dos dois declara window.open próprio nem repete o CSS de A4', () => {
  const iniCtPrint = HTML.indexOf('function ctPrintOS(osId){');
  const fimCtPrint = HTML.indexOf('\n}', HTML.indexOf('function ctPrintOS(osId){'));
  const corpoCtPrint = HTML.slice(iniCtPrint, fimCtPrint);
  assert.match(corpoCtPrint, /imprimirDocumento\(/);
  assert.doesNotMatch(corpoCtPrint, /window\.open\(/);
  assert.doesNotMatch(corpoCtPrint, /@page\{size:A4/);

  const iniFicha = HTML.indexOf('function printFicha(equipId){');
  const fimFicha = HTML.indexOf('\n}', iniFicha);
  const corpoFicha = HTML.slice(iniFicha, fimFicha);
  assert.match(corpoFicha, /imprimirDocumento\(/);
  assert.doesNotMatch(corpoFicha, /window\.open\(/);
  assert.doesNotMatch(corpoFicha, /@page\{size:A4/);

  // window.open/@page/document.write aparecem exatamente uma vez no arquivo inteiro — dentro de imprimirDocumento
  assert.equal((HTML.match(/window\.open\(/g) || []).length, 1);
  assert.equal((HTML.match(/@page\{size:A4/g) || []).length, 1);
});

test('os quatro grep do PLAT-15 continuam em 0 em refrigeracao/index.html', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.equal((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});

// ══════════════════════════════════════════════════════════════════
// Task 3 — medições acompanhadas: tendência, sparkline e estado vazio
// (260821-q57)
// ══════════════════════════════════════════════════════════════════

function carregarSandboxMedicoes() {
  const ini = HTML.indexOf('/* ── ficha: medições acompanhadas ── */');
  const fim = HTML.indexOf('/* ── encerramento de OS: última manutenção ── */', ini);
  assert.ok(ini > 0 && fim > ini, 'bloco "ficha: medições acompanhadas" não encontrado');
  const ctx = {
    esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  };
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  return ctx;
}

test('serieMedicoes devolve só números finitos, do mais antigo ao mais novo, descartando null/""/undefined/texto', () => {
  const ctx = carregarSandboxMedicoes();
  // _logCache/getEquipLog vêm ordenados do mais novo para o mais antigo.
  const logsMaisNovoPrimeiro = [
    { date: '2026-08-20', insuflamento: 18 },
    { date: '2026-08-15', insuflamento: null },
    { date: '2026-08-10', insuflamento: '' },
    { date: '2026-08-05', insuflamento: undefined },
    { date: '2026-08-01', insuflamento: 'abc' },
    { date: '2026-07-25', insuflamento: 16 },
  ];
  const serie = ctx.serieMedicoes(logsMaisNovoPrimeiro, 'insuflamento');
  // Array.from (do realm do teste) em vez de .map/deepEqual direto: `serie`
  // nasce dentro do sandbox node:vm, com Array de outro realm — mesma
  // armadilha já documentada em tests/refrigeracao-encerramento-os.test.js.
  assert.deepEqual(Array.from(serie, (p) => p.valor), [16, 18]);
  assert.deepEqual(Array.from(serie, (p) => p.date), ['2026-07-25', '2026-08-20']);
});

test('serieMedicoes devolve lista vazia quando não há nenhuma leitura', () => {
  const ctx = carregarSandboxMedicoes();
  assert.equal(Array.from(ctx.serieMedicoes([], 'corrente')).length, 0);
  assert.equal(Array.from(ctx.serieMedicoes([{ date: '2026-08-01' }], 'corrente')).length, 0);
  assert.equal(Array.from(ctx.serieMedicoes(null, 'corrente')).length, 0);
});

test('tendenciaMedicao compara a PRIMEIRA com a ÚLTIMA leitura, não o mínimo com o máximo, e devolve null com menos de dois pontos', () => {
  const ctx = carregarSandboxMedicoes();
  assert.equal(ctx.tendenciaMedicao([]), null);
  assert.equal(ctx.tendenciaMedicao([{ date: 'x', valor: 10 }]), null);
  // pico no meio: min/max diria "oscilou" (10→30→12), a pergunta certa é "caiu?" (10→12, subiu)
  const serie = [{ date: 'a', valor: 10 }, { date: 'b', valor: 30 }, { date: 'c', valor: 12 }];
  const tend = ctx.tendenciaMedicao(serie);
  assert.equal(tend.primeiro, 10);
  assert.equal(tend.ultimo, 12);
  assert.equal(tend.delta, 2);
});

test('renderMedicoesFicha sem nenhuma leitura devolve a frase de vazio e nenhum <svg — o caso de todos os 171 equipamentos hoje', () => {
  const ctx = carregarSandboxMedicoes();
  const h = ctx.renderMedicoesFicha([]);
  assert.match(h, /Nenhuma medição registrada ainda/);
  assert.doesNotMatch(h, /<svg/);
});

test('série com um ponto mostra o valor, diz que não há tendência ainda, e não desenha <svg', () => {
  const ctx = carregarSandboxMedicoes();
  const h = ctx.renderMedicoesFicha([{ date: '2026-08-20', corrente: 5.5 }]);
  assert.match(h, /5\.5/);
  assert.match(h, /sem tendência ainda/);
  assert.doesNotMatch(h, /<svg/);
});

test('série com N >= 2 pontos desenha uma polyline com N pares de coordenadas, dentro do viewBox declarado, sem NaN mesmo em série constante', () => {
  const ctx = carregarSandboxMedicoes();
  const logs = [
    { date: '2026-08-20', corrente: 5.5 },
    { date: '2026-08-15', corrente: 5.5 },
    { date: '2026-08-10', corrente: 5.5 },
  ];
  const serie = ctx.serieMedicoes(logs, 'corrente');
  assert.equal(serie.length, 3);
  const svg = ctx.sparklineSVG(serie, '#1351B4');
  assert.doesNotMatch(svg, /NaN/);
  const m = svg.match(/<polyline points="([^"]*)"/);
  assert.ok(m, 'polyline não encontrada');
  const pares = m[1].trim().split(/\s+/);
  assert.equal(pares.length, 3);
  const mView = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(mView, 'viewBox não encontrado');
  const [vw, vh] = [Number(mView[1]), Number(mView[2])];
  for (const par of pares) {
    const [x, y] = par.split(',').map(Number);
    assert.ok(x >= 0 && x <= vw, `x=${x} fora do viewBox`);
    assert.ok(y >= 0 && y <= vh, `y=${y} fora do viewBox`);
  }
});
