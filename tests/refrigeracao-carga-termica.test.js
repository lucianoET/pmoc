// Gate da quick-260831-2wq — carga térmica, eficiência energética e
// parâmetros de inspeção (/refrigeracao).
//
// Três fatos que este trabalho estabelece:
//
//  - D-2wq-01: as CINCO colunas de ambiente da migração 04 (`area_m2`,
//    `pe_direito`, `n_pessoas`, `dissipacao_w`, `fator_insolacao`)
//    estavam fora de EQUIP_EDITAVEIS — existiam no banco desde 2026 e
//    eram impossíveis de preencher pela tela. Entram sem sonda: são
//    colunas antigas, não novas.
//  - D-2wq-02: `fator_insolacao` NÃO ganha coluna de texto ao lado. Já é
//    numeric default 1.0 e é a forma que o cálculo consome; a tela
//    oferece rótulo e grava número.
//  - D-2wq-06: INSP_OK e o vocabulário de inspeção moram dentro do
//    recorte "── fluxo da OS interna: porta de escrita ──", pelo mesmo
//    motivo de EST_OK (D-6wy-08).
//
// O cálculo é portado em FUNÇÃO do PMOC v8.3 do usuário, não em código:
// lá as entradas eram digitadas num formulário e guardadas em
// localStorage; aqui são as colunas do cadastro.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const SQL_47 = fs.readFileSync(path.join(RAIZ, 'supabase', '47_refrigeracao_carga_termica.sql'), 'utf8');
const SQL_48 = fs.readFileSync(path.join(RAIZ, 'supabase', '48_refrigeracao_inspecao_qualidade.sql'), 'utf8');

function recorte(ini, fim) {
  const a = HTML.indexOf(ini);
  assert.ok(a > 0, `marcador de início não encontrado: ${ini}`);
  const b = HTML.indexOf(fim, a);
  assert.ok(b > a, `marcador de fim não encontrado: ${fim}`);
  return HTML.slice(a, b);
}

// Objetos criados DENTRO do sandbox têm Array/Object.prototype de outro
// realm — deepStrictEqual contra um literal daqui falha por identidade,
// não por conteúdo. Trazer para este realm antes de comparar (mesma
// armadilha registrada em tests/refrigeracao-desktop.test.js).
function daqui(v) { return JSON.parse(JSON.stringify(v)); }

// `bloco` conta chaves e só serve para função/objeto. Uma declaração de
// ARRAY (var X = [ ... ];) precisa contar colchetes, senão o helper sai
// procurando a próxima `{` do arquivo e recorta um pedaço sem fim.
function decl(marcador) {
  const ini = HTML.indexOf(marcador);
  assert.ok(ini >= 0, `marcador "${marcador}" não encontrado`);
  const abertura = marcador.trimEnd().slice(-1);
  const fechamento = abertura === '[' ? ']' : '}';
  const abre = HTML.indexOf(abertura, ini);
  let depth = 1;
  let j = abre + 1;
  while (j < HTML.length && depth > 0) {
    if (HTML[j] === abertura) depth++;
    else if (HTML[j] === fechamento) depth--;
    j++;
  }
  return HTML.slice(ini, HTML.indexOf(';', j) + 1);
}

function bloco(marcador) {
  const ini = HTML.indexOf(marcador);
  assert.ok(ini >= 0, `marcador "${marcador}" não encontrado`);
  const abre = HTML.indexOf('{', ini);
  let depth = 1;
  let j = abre + 1;
  while (j < HTML.length && depth > 0) {
    if (HTML[j] === '{') depth++;
    else if (HTML[j] === '}') depth--;
    j++;
  }
  return HTML.slice(ini, j);
}

// Núcleo puro do térmico: código REAL do arquivo, nunca reescrito aqui.
function sandboxTermico(extra) {
  const ctx = Object.assign({ dvPotenciaW: undefined }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
  vm.runInContext(recorte('/* ══ carga térmica: núcleo puro (migração 47) ══', '/* -- ficha: uma fonte, dois continentes -- */'), ctx);
  return ctx;
}

const SALA = {
  areaM2: 20, tipoUso: 'escritorio', peDireito: 2.7,
  nPessoas: null, janelas: null, dissipacaoW: null,
  fatorInsolacao: null, refrigPermanente: false, btu: 18000,
  tensao: 220, correnteNominal: null, horasDia: 8, diasSemana: 5,
};

test('os recortes existem no HTML', () => {
  assert.doesNotThrow(() => sandboxTermico());
});

// ═══════════ o motor de cálculo ═══════════

test('sem área não há cálculo: termCalcular devolve null, e termFaltantes NOMEIA o que falta', () => {
  const ctx = sandboxTermico();
  assert.strictEqual(ctx.termCalcular(Object.assign({}, SALA, { areaM2: null })), null);
  assert.strictEqual(ctx.termCalcular(Object.assign({}, SALA, { areaM2: 0 })), null);
  // Nomear é o que separa "não calculável" de "0 BTU" — um número na tela
  // é lido como resposta.
  assert.deepStrictEqual(daqui(ctx.termFaltantes(Object.assign({}, SALA, { areaM2: null }))), ['área do ambiente']);
  assert.deepStrictEqual(daqui(ctx.termFaltantes(Object.assign({}, SALA, { tipoUso: null }))), ['tipo de uso']);
  assert.deepStrictEqual(daqui(ctx.termFaltantes({ areaM2: null, tipoUso: null })), ['área do ambiente', 'tipo de uso']);
  assert.deepStrictEqual(daqui(ctx.termFaltantes(SALA)), []);
});

test('o nível entregue é o mais completo que os DADOS sustentam — nunca uma escolha de aba', () => {
  const ctx = sandboxTermico();
  // Só área: nível 1. Sem ocupação nem janelas, o nível 2 seria idêntico
  // ao 1 fingindo refinamento.
  assert.strictEqual(ctx.termCalcular(SALA).nivel, 1);
  assert.strictEqual(ctx.termCalcular(Object.assign({}, SALA, { nPessoas: 4 })).nivel, 2);
  assert.strictEqual(ctx.termCalcular(Object.assign({}, SALA, { janelas: 2 })).nivel, 2);
  assert.strictEqual(ctx.termCalcular(Object.assign({}, SALA, { dissipacaoW: 500 })).nivel, 3);
  const c = ctx.termCalcular(SALA);
  assert.strictEqual(c.total, c.nivel1);
});

test('cada entrada empurra a carga para CIMA, e o total do nível bate com a soma das parcelas', () => {
  const ctx = sandboxTermico();
  const base = ctx.termCalcular(SALA);
  assert.ok(ctx.termCalcular(Object.assign({}, SALA, { nPessoas: 6 })).total > base.total);
  assert.ok(ctx.termCalcular(Object.assign({}, SALA, { janelas: 3 })).total > base.total);
  assert.ok(ctx.termCalcular(Object.assign({}, SALA, { fatorInsolacao: 1.25 })).total > base.total);
  assert.ok(ctx.termCalcular(Object.assign({}, SALA, { refrigPermanente: true })).total > base.total);
  assert.ok(ctx.termCalcular(Object.assign({}, SALA, { peDireito: 4.5 })).total > base.total);

  const c = ctx.termCalcular(Object.assign({}, SALA, { nPessoas: 4, janelas: 2, dissipacaoW: 300 }));
  const soma = (c.qBase + c.qPess + c.qJanela + c.qIlum + c.qEquip) * c.fSolar * c.fAltura * c.fContinuo;
  assert.strictEqual(c.nivel3, Math.round(soma));
});

test('janela é carga PONTUAL, não fator: duas janelas pesam o mesmo em BTU numa sala grande e numa pequena', () => {
  const ctx = sandboxTermico();
  const pequena = { areaM2: 10, tipoUso: 'escritorio', janelas: 2 };
  const grande = { areaM2: 60, tipoUso: 'escritorio', janelas: 2 };
  assert.strictEqual(ctx.termCalcular(pequena).qJanela, ctx.termCalcular(grande).qJanela);
  assert.strictEqual(ctx.termCalcular(pequena).qJanela, 2 * ctx.TERM_BTU_POR_JANELA);
});

test('fator de altura só age acima de 2,8 m, em degraus (NBR 16401)', () => {
  const ctx = sandboxTermico();
  assert.strictEqual(ctx.termFatorAltura(2.5), 1.0);
  assert.strictEqual(ctx.termFatorAltura(2.8), 1.0);
  assert.strictEqual(ctx.termFatorAltura(2.9), 1.05);
  assert.strictEqual(ctx.termFatorAltura(3.2), 1.10);
  assert.strictEqual(ctx.termFatorAltura(3.8), 1.20);
  assert.strictEqual(ctx.termFatorAltura(5.0), 1.30);
  // Pé-direito ausente NÃO pode inflar nem encolher a carga.
  assert.strictEqual(ctx.termFatorAltura(null), 1.0);
});

test('o que foi suposto é DECLARADO — nunca some em silêncio', () => {
  const ctx = sandboxTermico();
  const c = ctx.termCalcular({ areaM2: 20, tipoUso: 'escritorio' });
  assert.ok(c.suposicoes.some((x) => /pé-direito/.test(x)));
  assert.ok(c.suposicoes.some((x) => /insolação/.test(x)));
  assert.ok(c.suposicoes.some((x) => /ocupação/.test(x)));
  // Com tudo cadastrado, nada é suposto.
  const cheio = ctx.termCalcular(Object.assign({}, SALA, { peDireito: 3, fatorInsolacao: 1.1, nPessoas: 4 }));
  assert.deepStrictEqual(daqui(cheio.suposicoes), []);
});

test('tipo de uso desconhecido cai em "outro" em vez de quebrar, e tipos diferentes dão cargas diferentes', () => {
  const ctx = sandboxTermico();
  const desconhecido = ctx.termCalcular(Object.assign({}, SALA, { tipoUso: 'inexistente' }));
  const outro = ctx.termCalcular(Object.assign({}, SALA, { tipoUso: 'outro' }));
  assert.strictEqual(desconhecido.total, outro.total);
  const tecnica = ctx.termCalcular(Object.assign({}, SALA, { tipoUso: 'sala_tecnica' }));
  const corredor = ctx.termCalcular(Object.assign({}, SALA, { tipoUso: 'corredor' }));
  assert.ok(tecnica.total > corredor.total, 'sala técnica tem de pedir mais que corredor de mesma área');
});

// ═══════════ D-2wq-02 — insolação é número, com rótulo ═══════════

test('termRotuloInsolacao casa pelo MAIS PRÓXIMO — um 1.2 vindo de importação não vira "—"', () => {
  const ctx = sandboxTermico();
  assert.strictEqual(ctx.termRotuloInsolacao(1.0), ctx.TERM_INSOLACAO[0].rotulo);
  assert.strictEqual(ctx.termRotuloInsolacao(1.25), ctx.TERM_INSOLACAO[3].rotulo);
  // 1.2 não está na lista: cai no mais próximo (1.15 ou 1.25), nunca em '—'.
  const r = ctx.termRotuloInsolacao(1.2);
  assert.ok(ctx.TERM_INSOLACAO.some((o) => o.rotulo === r), 'valor fora da lista precisa cair num rótulo real');
  assert.strictEqual(ctx.termRotuloInsolacao(null), '—');
  assert.strictEqual(ctx.termRotuloInsolacao('abc'), '—');
});

// ═══════════ veredito de dimensionamento ═══════════

test('termAdequacao separa subdimensionado, adequado, folga e superdimensionado', () => {
  const ctx = sandboxTermico();
  assert.strictEqual(ctx.termAdequacao(8000, 12000).chave, 'sub');
  assert.strictEqual(ctx.termAdequacao(12000, 12000).chave, 'ok');
  assert.strictEqual(ctx.termAdequacao(13000, 12000).chave, 'ok');
  assert.strictEqual(ctx.termAdequacao(15000, 12000).chave, 'suave');
  assert.strictEqual(ctx.termAdequacao(24000, 12000).chave, 'super');
});

test('a faixa "adequado" é LARGA de propósito — capacidade comercial é escalonada', () => {
  const ctx = sandboxTermico();
  // 12.000 BTU para uma carga de 11.000 é a escolha certa na prateleira;
  // uma faixa estreita apontaria "inadequado" para a decisão correta.
  assert.strictEqual(ctx.termAdequacao(12000, 11000).chave, 'ok');
  assert.strictEqual(ctx.termAdequacao(9000, 8200).chave, 'ok');
});

test('sem capacidade ou sem carga não há veredito — null, nunca um palpite', () => {
  const ctx = sandboxTermico();
  assert.strictEqual(ctx.termAdequacao(null, 12000), null);
  assert.strictEqual(ctx.termAdequacao(0, 12000), null);
  assert.strictEqual(ctx.termAdequacao(12000, null), null);
  assert.strictEqual(ctx.termAdequacao(12000, 0), null);
});

// ═══════════ eficiência energética ═══════════

test('termEficiencia REUSA dvPotenciaW — uma regra de potência, um ponto só', () => {
  let chamou = 0;
  const ctx = sandboxTermico({ dvPotenciaW(e) { chamou++; return 1400; } });
  const ef = ctx.termEficiencia(SALA, 0.85);
  assert.strictEqual(chamou, 1);
  assert.strictEqual(ef.w, 1400);
  assert.strictEqual(ef.kw, 1.4);
  // 8 h/dia × 5 dias × 4,345 semanas × 70% de ciclo
  const horasMes = 8 * 5 * 4.345;
  assert.ok(Math.abs(ef.kwhMes - (1.4 * horasMes * ctx.TERM_FATOR_CICLO)) < 1e-9);
  assert.ok(Math.abs(ef.custoMes - ef.kwhMes * 0.85) < 1e-9);
});

test('D-2wq-07: sem corrente de PLACA não há EER — a estimativa por BTU daria 10,2 para o parque inteiro', () => {
  // dvPotenciaW sem corrente de placa devolve btu/3412/COP*1000; dividir o
  // BTU por isso dá sempre a mesma constante, para qualquer máquina. Publicar
  // como "Classe B" seria inventar etiqueta de eficiência a partir de nenhuma
  // medição — e as 175 linhas do banco têm corrente_nominal nula.
  const real = sandboxTermico({ dvPotenciaW: undefined });
  vm.runInContext('var DV_BTU_POR_KW=3412, DV_COP=3;' + bloco('function dvPotenciaW(e){'), real);

  const semPlaca = Object.assign({}, SALA, { correnteNominal: null });
  const efSem = real.termEficiencia(semPlaca, 0.85);
  assert.strictEqual(efSem.potenciaDePlaca, false);
  assert.strictEqual(efSem.eer, null, 'EER derivado de potência derivada do BTU é tautologia, não medição');
  // O consumo continua valendo: é a mesma estimativa que o painel publica.
  assert.ok(efSem.kwhMes > 0);

  const comPlaca = Object.assign({}, SALA, { correnteNominal: 7.5, tensao: 220 });
  const efCom = real.termEficiencia(comPlaca, 0.85);
  assert.strictEqual(efCom.potenciaDePlaca, true);
  assert.ok(efCom.eer > 0, 'com corrente de placa o EER é uma razão de verdade');

  // A prova de que seria constante: duas máquinas de capacidades muito
  // diferentes, ambas sem placa, dariam exatamente o mesmo EER.
  const a = real.termEficiencia(Object.assign({}, semPlaca, { btu: 9000 }), 0.85);
  const b = real.termEficiencia(Object.assign({}, semPlaca, { btu: 60000 }), 0.85);
  assert.ok(Math.abs((9000 / a.w) - (60000 / b.w)) < 0.05,
    'pré-condição do caso: sem placa a razão BTU/W é a mesma para qualquer máquina');
  assert.strictEqual(a.eer, null);
  assert.strictEqual(b.eer, null);
});

test('sem potência estimável não há eficiência, e sem tarifa não há custo inventado', () => {
  const ctx = sandboxTermico({ dvPotenciaW() { return 0; } });
  assert.strictEqual(ctx.termEficiencia(SALA, 0.85), null);
  const ctx2 = sandboxTermico({ dvPotenciaW() { return 1400; } });
  assert.strictEqual(ctx2.termEficiencia(SALA, null).custoMes, null);
  // Sem BTU cadastrado o EER seria divisão disfarçada por zero.
  assert.strictEqual(ctx2.termEficiencia(Object.assign({}, SALA, { btu: 0, correnteNominal: 7.5 }), 0.85).eer, null);
});

test('classe de eficiência sai da régua, e nunca é inventada sem EER', () => {
  const ctx = sandboxTermico();
  assert.strictEqual(ctx.termClasseEER(11.5), 'A');
  assert.strictEqual(ctx.termClasseEER(10.2), 'B');
  assert.strictEqual(ctx.termClasseEER(9.5), 'C');
  assert.strictEqual(ctx.termClasseEER(6.0), 'F');
  assert.strictEqual(ctx.termClasseEER(null), null);
  assert.strictEqual(ctx.termClasseEER(0), null);
});

// ═══════════ vocabulário de inspeção (migração 48) ═══════════

function sandboxInsp(inspOk) {
  const ctx = {
    INSP_OK: !!inspOk,
    esc: (s) => String(s === undefined || s === null ? '' : s),
    el: () => null,
    manValCampo: () => '',
    manNumOuNull: () => null,
  };
  vm.createContext(ctx);
  vm.runInContext(decl('var INSP_ESTADOS = ['), ctx);
  vm.runInContext(decl('var INSP_ESTADO_INFO = {'), ctx);
  vm.runInContext(decl('var INSP_CAMPOS = ['), ctx);
  ['function inspNormalizar(v){', 'function inspRotulo(v){', 'function inspTom(v){',
   'function inspPior(entry){', 'function inspCampoHtml(prefixo, entry){',
   'function inspLerForm(prefixo){'].forEach((m) => vm.runInContext(bloco(m), ctx));
  return ctx;
}

test('inspNormalizar aceita só a lista fechada — qualquer outra coisa é null, nunca um estado inventado', () => {
  const ctx = sandboxInsp(true);
  assert.strictEqual(ctx.inspNormalizar('bom'), 'bom');
  assert.strictEqual(ctx.inspNormalizar(' RUIM '), 'ruim');
  assert.strictEqual(ctx.inspNormalizar('péssimo'), null);
  assert.strictEqual(ctx.inspNormalizar(''), null);
  assert.strictEqual(ctx.inspNormalizar(null), null);
  assert.strictEqual(ctx.inspNormalizar(undefined), null);
});

test('inspPior devolve o PIOR dos quatro, e desconhecido NUNCA conta como bom', () => {
  const ctx = sandboxInsp(true);
  assert.strictEqual(ctx.inspPior({ qualidadeAr: 'bom', aspecto: 'bom', dreno: 'ruim', suporte: 'bom' }), 'ruim');
  assert.strictEqual(ctx.inspPior({ qualidadeAr: 'bom', aspecto: 'regular' }), 'regular');
  assert.strictEqual(ctx.inspPior({ qualidadeAr: 'bom' }), 'bom');
  // Uma OS que não inspecionou nada não pode fazer a máquina parecer aprovada.
  assert.strictEqual(ctx.inspPior({}), null);
  assert.strictEqual(ctx.inspPior({ dreno: 'lixo' }), null);
});

test('com a sonda desligada o formulário não desenha nada e o patch sai VAZIO — nunca cita coluna inexistente', () => {
  const off = sandboxInsp(false);
  assert.strictEqual(off.inspCampoHtml('man-ex', null), '');
  assert.deepStrictEqual(daqui(off.inspLerForm('man-ex')), {});
  // Um patch com chave de coluna ausente derruba a gravação inteira da OS,
  // não só o campo novo (mesma lição de D-500-05).
  const on = sandboxInsp(true);
  assert.ok(on.inspCampoHtml('man-ex', null).indexOf('man-ex-dreno') > 0);
  assert.deepStrictEqual(daqui(Object.keys(on.inspLerForm('man-ex'))).sort(),
    ['aspecto', 'dreno', 'qualidadeAr', 'ruidoDb', 'suporte'].sort());
});

test('os quatro <select> saem da LISTA, nunca de quatro cópias', () => {
  const ctx = sandboxInsp(true);
  const html = ctx.inspCampoHtml('man-ed', {});
  ctx.INSP_CAMPOS.forEach((c) => {
    assert.ok(html.indexOf('id="man-ed-' + c.id + '"') > 0, `${c.chave} não apareceu no formulário`);
  });
  assert.strictEqual(html.split('— não avaliado —').length - 1, ctx.INSP_CAMPOS.length);
});

// ═══════════ a tela e o banco falam a MESMA lista fechada ═══════════

test('as chaves de TERM_TIPOS_USO batem exatamente com o check de tipo_uso da migração 47', () => {
  const ctx = sandboxTermico();
  const m = SQL_47.match(/tipo_uso in \(([^)]*)\)/);
  assert.ok(m, 'check de tipo_uso não encontrado na migração 47');
  const noBanco = m[1].match(/'([a-z_]+)'/g).map((x) => x.replace(/'/g, '')).sort();
  const naTela = daqui(Object.keys(ctx.TERM_TIPOS_USO)).sort();
  // Um valor fora do check não daria erro visível: cairia no ramo `outro`
  // e produziria um número plausível e errado.
  assert.deepStrictEqual(naTela, noBanco);
  assert.deepStrictEqual(daqui(ctx.TERM_TIPOS_ORDEM).sort(), noBanco);
});

test('INSP_ESTADOS bate com o check das quatro colunas verbais da migração 48', () => {
  const ctx = sandboxInsp(true);
  const m = SQL_48.match(/in \(''bom'',''regular'',''ruim''\)/);
  assert.ok(m, 'check da escala verbal não encontrado na migração 48');
  assert.deepStrictEqual(daqui(ctx.INSP_ESTADOS), ['bom', 'regular', 'ruim']);
});

test('as migrações são ADITIVAS e não têm DROP — o projeto arquiva, nunca reescreve', () => {
  [SQL_47, SQL_48].forEach((sql) => {
    assert.ok(!/\bdrop\s+(table|column|constraint)\b/i.test(sql), 'migração não pode conter DROP');
    assert.ok(/add column if not exists/i.test(sql), 'migração precisa ser aditiva');
  });
});

// ═══════════ D-2wq-01 — as cinco colunas antigas entram SEM sonda ═══════════

test('as cinco colunas de ambiente da migração 04 são editáveis sem depender de sonda nenhuma', () => {
  const ini = HTML.indexOf('var EQUIP_EDITAVEIS = [');
  const fim = HTML.indexOf('];', ini);
  const lista = HTML.slice(ini, fim);
  ['areaM2', 'peDireito', 'nPessoas', 'dissipacaoW', 'fatorInsolacao'].forEach((k) => {
    assert.ok(new RegExp("'" + k + "'").test(lista), `${k} (migração 04) precisa ser editável`);
  });
  // As duas da 47 NÃO podem estar na lista literal: dependem de TERM_OK.
  ['tipoUso', 'janelas'].forEach((k) => {
    assert.ok(!new RegExp("'" + k + "'").test(lista), `${k} (migração 47) não pode entrar sem a sonda`);
  });
});

test('TERM_OK empurra tipoUso/janelas num ponto só, e nunca duas vezes', () => {
  const fonte = bloco('async function termSondarEsquema() {');
  assert.match(fonte, /EQUIP_EDITAVEIS\.indexOf\('tipoUso'\) < 0/,
    'sem a guarda de idempotência, duas chamadas da sonda duplicam os campos no formulário');
  assert.match(fonte, /TERM_OK = !r\.error/);
});

test('as sondas 47 e 48 são SEPARADAS — uma migração aplicada não pode ligar a outra', () => {
  const t = bloco('async function termSondarEsquema() {');
  const i = bloco('async function inspSondarEsquema() {');
  assert.match(t, /from\('equipamentos'\)/);
  assert.match(i, /from\('logs_manutencao'\)/);
  assert.ok(!/INSP_OK/.test(t), 'termSondarEsquema não pode mexer em INSP_OK');
  assert.ok(!/TERM_OK/.test(i), 'inspSondarEsquema não pode mexer em TERM_OK');
});

test('D-2wq-06: INSP_OK mora dentro do recorte da porta de escrita, como EST_OK', () => {
  const trecho = recorte('/* ── fluxo da OS interna: porta de escrita ── */', '/* ── núcleo puro: sem API de navegador nenhuma');
  assert.ok(trecho.indexOf('var INSP_OK = false;') > 0, 'INSP_OK fora do recorte produz ReferenceError em sandbox');
  assert.ok(trecho.indexOf('var EST_OK = false;') > 0, 'o precedente de EST_OK precisa continuar valendo');
  assert.ok(trecho.indexOf('function inspPior(entry){') > 0);
});

test('o bloco térmico da ficha é o sexto e some inteiro sem a migração 47', () => {
  const fonte = bloco('function fichaBlocoTermico(e){');
  assert.match(fonte, /if \(!TERM_OK\) return '';/);
  // É a primeira linha: sem a sonda, nem o título é montado.
  const corpo = fonte.slice(fonte.indexOf('{') + 1);
  assert.ok(corpo.trimStart().startsWith('if (!TERM_OK)'), 'a guarda tem de ser a primeira instrução');
  const blocos = bloco('function fichaBlocos(e, logs, id){');
  assert.match(blocos, /fichaBlocoTermico\(e\)/);
});

test('EQUIP_DECIMAIS substitui a comparação literal por correnteNominal (D-2wq-05)', () => {
  const ini = HTML.indexOf('var EQUIP_DECIMAIS = [');
  assert.ok(ini > 0, 'EQUIP_DECIMAIS não encontrada');
  const lista = HTML.slice(ini, HTML.indexOf('];', ini));
  ['correnteNominal', 'areaM2', 'peDireito', 'dissipacaoW'].forEach((k) => {
    assert.ok(new RegExp("'" + k + "'").test(lista), `${k} precisa aceitar decimal`);
  });
  // O ramo antigo por literal não pode ter sobrado em equipParaDb.
  const conv = bloco('function equipParaDb(patch) {');
  assert.ok(!/k === 'correnteNominal'/.test(conv), 'a comparação literal precisa ter saído de equipParaDb');
  assert.match(conv, /EQUIP_DECIMAIS\.indexOf\(k\) >= 0/);
});
