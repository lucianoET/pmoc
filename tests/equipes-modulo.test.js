// Gate do módulo /equipes (260831) — pessoas, ofícios, equipes, turnos e
// escala semanal.
//
// A plataforma sabia o que precisa de manutenção (nove módulos de ativos)
// e não sabia QUEM faz: toda OS registra o técnico como texto livre.
//
// Decisões que este arquivo trava:
//  - prefixo `cmasm_`, não `equipe_`: o requisito atravessa módulos
//    ("elétrica por eletricistas"), e `cmasm_locais` é o precedente de
//    tabela que mora fora de módulo porque vários leem;
//  - especialidade é TABELA, não lista fechada em código;
//  - turno tem hora de início e fim, não uma duração digitada;
//  - NÃO existe coluna de "dias úteis": alocar É dizer que se trabalha;
//  - capacidade sai das alocações reais, nunca de um número teórico;
//  - especialidade sem domínio não habilita ninguém (nunca "atende tudo").

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');
const SQL_49 = fs.readFileSync(path.join(RAIZ, 'supabase', '49_equipes_schema.sql'), 'utf8');
const SQL_50 = fs.readFileSync(path.join(RAIZ, 'supabase', '50_equipes_seed.sql'), 'utf8');
const APP = fs.readFileSync(path.join(RAIZ, 'equipes', 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(RAIZ, 'equipes', 'index.html'), 'utf8');

// Os comentários deste projeto NOMEIAM o que as regras proíbem ("não usa
// shared/modulo-manutencao.js", "on conflict do nothing"). Grepar o texto
// cru acusaria a explicação como se fosse a infração — só o código conta.
function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
function semComentarioSql(txt) { return txt.replace(/^\s*--.*$/gm, ''); }
// Além dos comentários `--`, remove os `comment on ... is '...'`: aquilo é
// prosa explicativa dentro de um literal SQL, e uma checagem que procura
// uma palavra proibida acharia justamente o texto que explica por que ela
// é proibida. Os literais dos `check` ficam, senão a checagem cegaria.
function semProsaSql(txt) {
  return semComentarioSql(txt).replace(/comment on[\s\S]*?is\s*'(?:[^']|'')*'\s*;/gi, ' ');
}

let N; // núcleo puro, carregado uma vez
test.before(async () => { N = await import(path.join(RAIZ, 'equipes', 'nucleo.js')); });

// ═══════════ datas e semana ═══════════

test('chaveData usa a data LOCAL — nunca toISOString, que empurraria o dia para trás', async () => {
  assert.strictEqual(N.chaveData(new Date(2026, 2, 5, 8, 0)), '2026-03-05');
  assert.strictEqual(N.chaveData(new Date(2026, 2, 5, 23, 30)), '2026-03-05');
  assert.strictEqual(N.chaveData(new Date(2026, 0, 1)), '2026-01-01');
  assert.strictEqual(N.chaveData(null), '');
  const fonte = fs.readFileSync(path.join(RAIZ, 'equipes', 'nucleo.js'), 'utf8');
  const corpo = fonte.slice(fonte.indexOf('export function chaveData'), fonte.indexOf('export function dataDaChave'));
  assert.ok(!/toISOString/.test(corpo), 'toISOString converte para UTC e move a alocação de dia');
});

test('semanaDe devolve SEMPRE sete dias, do domingo ao sábado, contendo a data pedida', () => {
  [new Date(2026, 7, 31), new Date(2026, 0, 1), new Date(2024, 1, 29)].forEach((d) => {
    const s = N.semanaDe(d);
    assert.strictEqual(s.length, 7);
    assert.strictEqual(s[0].dow, 0, 'a semana começa no domingo');
    assert.strictEqual(s[6].dow, 6);
    assert.ok(s.some((x) => x.chave === N.chaveData(d)), 'a semana precisa conter a data de referência');
  });
});

test('moverSemana atravessa mês e ano nos dois sentidos', () => {
  assert.strictEqual(N.chaveData(N.moverSemana(new Date(2026, 11, 29), 1)), '2027-01-05');
  assert.strictEqual(N.chaveData(N.moverSemana(new Date(2026, 0, 5), -1)), '2025-12-29');
});

test('rotuloSemana nomeia os DOIS lados quando a semana atravessa mês ou ano', () => {
  const cruzaMes = N.rotuloSemana(N.semanaDe(new Date(2026, 8, 30)));
  assert.match(cruzaMes, /–/);
  assert.ok(!/undefined/.test(cruzaMes));
  const cruzaAno = N.rotuloSemana(N.semanaDe(new Date(2026, 11, 30)));
  assert.match(cruzaAno, /2026[\s\S]*2027/, 'semana entre anos precisa nomear os dois anos');
});

// ═══════════ turnos: hora, não duração digitada ═══════════

test('a duração do turno é DERIVADA das horas — nunca um campo à parte', () => {
  assert.strictEqual(N.horasDoTurno({ hora_inicio: '08:00', hora_fim: '12:00' }), 4);
  assert.strictEqual(N.horasDoTurno({ hora_inicio: '13:00', hora_fim: '17:30' }), 4.5);
  assert.strictEqual(N.horasDoTurno({ hora_inicio: '08:00:00', hora_fim: '12:00:00' }), 4);
});

test('turno malformado vale 0 h, nunca NaN — um NaN se propagaria pela soma e sumiria', () => {
  [null, {}, { hora_inicio: '12:00', hora_fim: '08:00' }, { hora_inicio: '12:00', hora_fim: '12:00' },
   { hora_inicio: 'abc', hora_fim: '12:00' }, { hora_inicio: '99:99', hora_fim: '12:00' }].forEach((t) => {
    const h = N.horasDoTurno(t);
    assert.strictEqual(h, 0, `${JSON.stringify(t)} deveria valer 0`);
    assert.ok(!Number.isNaN(h));
  });
});

// ═══════════ capacidade: das alocações reais ═══════════

const TURNOS = [
  { id: 1, nome: 'Manhã', hora_inicio: '08:00', hora_fim: '12:00' },
  { id: 2, nome: 'Tarde', hora_inicio: '13:00', hora_fim: '17:00' },
];
const PESSOAS = [
  { id: 10, nome: 'A', ativo: true }, { id: 11, nome: 'B', ativo: true },
  { id: 12, nome: 'C', ativo: false },
];
const MEMBROS = [
  { equipe_id: 1, pessoa_id: 10 }, { equipe_id: 1, pessoa_id: 11 },
  { equipe_id: 1, pessoa_id: 12 }, // inativa
  { equipe_id: 2, pessoa_id: 10 },
];

test('pessoa INATIVA não conta no tamanho da equipe — a oficina pareceria maior do que é', () => {
  assert.strictEqual(N.tamanhoDaEquipe(1, MEMBROS, PESSOAS), 2);
  assert.strictEqual(N.tamanhoDaEquipe(2, MEMBROS, PESSOAS), 1);
  assert.strictEqual(N.tamanhoDaEquipe(99, MEMBROS, PESSOAS), 0);
});

test('capacidade = Σ (horas do turno × pessoas ativas), só da semana pedida', () => {
  const dias = N.semanaDe(new Date(2026, 7, 31)); // 30/08 a 05/09
  const d0 = dias[1].chave; // segunda
  const alocacoes = [
    { id: 1, equipe_id: 1, turno_id: 1, data: d0 },  // 4 h × 2 = 8
    { id: 2, equipe_id: 2, turno_id: 2, data: d0 },  // 4 h × 1 = 4
    { id: 3, equipe_id: 1, turno_id: 1, data: '2020-01-01' }, // fora da semana
  ];
  const cap = N.capacidadeDaSemana(dias, alocacoes, TURNOS, MEMBROS, PESSOAS);
  assert.strictEqual(cap.horas, 12);
  assert.strictEqual(cap.alocacoes, 2, 'a de outra semana não pode ser contada');
  assert.strictEqual(cap.equipes, 2);
});

test('alocação de equipe SEM pessoal vale zero e é contada à parte, não somada em silêncio', () => {
  const dias = N.semanaDe(new Date(2026, 7, 31));
  const cap = N.capacidadeDaSemana(
    dias, [{ id: 1, equipe_id: 77, turno_id: 1, data: dias[1].chave }], TURNOS, MEMBROS, PESSOAS);
  assert.strictEqual(cap.horas, 0);
  assert.strictEqual(cap.alocacoesSemPessoal, 1, 'equipe vazia é quase sempre erro de cadastro e precisa aparecer');
  assert.strictEqual(cap.equipes, 0);
});

test('a capacidade não tem NENHUMA noção de "dias úteis" — alocar é o que declara o trabalho', () => {
  const fonte = fs.readFileSync(path.join(RAIZ, 'equipes', 'nucleo.js'), 'utf8');
  const corpo = fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  assert.ok(!/dias_uteis|diasUteis/.test(corpo), 'dias úteis seria segunda fonte de verdade ao lado das alocações');
  assert.ok(!/dias_uteis/.test(SQL_49), 'nem coluna de dias úteis no esquema');
});

test('alocacoesPorCelula indexa por dia|turno e ignora o que está fora da semana', () => {
  const dias = N.semanaDe(new Date(2026, 7, 31));
  const k = dias[2].chave;
  const mapa = N.alocacoesPorCelula(dias, [
    { id: 1, equipe_id: 1, turno_id: 1, data: k },
    { id: 2, equipe_id: 2, turno_id: 1, data: k },
    { id: 3, equipe_id: 1, turno_id: 1, data: '2019-05-05' },
  ]);
  assert.strictEqual(mapa[`${k}|1`].length, 2, 'duas equipes cabem na mesma célula');
  assert.strictEqual(Object.keys(mapa).length, 1);
});

// ═══════════ a regra que o usuário pediu em palavras ═══════════

test('especialidade sem domínio NÃO habilita ninguém — nunca "lista vazia = atende tudo"', () => {
  // O contrário mandaria o carpinteiro para a OS de refrigeração: um
  // cadastro incompleto viraria habilitação universal.
  assert.strictEqual(N.atendeDominio({ dominios: [] }, 'refrigeracao'), false);
  assert.strictEqual(N.atendeDominio({ dominios: null }, 'refrigeracao'), false);
  assert.strictEqual(N.atendeDominio({}, 'refrigeracao'), false);
  assert.strictEqual(N.atendeDominio(null, 'refrigeracao'), false);
});

test('"elétrica por eletricistas, refrigeração por técnico em refrigeração"', () => {
  const eletricista = { id: 1, nome: 'Eletricista', dominios: ['eletrica', 'predial'] };
  const refrig = { id: 2, nome: 'Téc. Refrigeração', dominios: ['refrigeracao'] };
  assert.strictEqual(N.atendeDominio(eletricista, 'eletrica'), true);
  assert.strictEqual(N.atendeDominio(eletricista, 'refrigeracao'), false);
  assert.strictEqual(N.atendeDominio(refrig, 'refrigeracao'), true);
  assert.strictEqual(N.atendeDominio(refrig, 'eletrica'), false);

  const equipes = [
    { id: 1, nome: 'Elétrica 1', especialidade_id: 1, ativo: true },
    { id: 2, nome: 'Refrigeração 1', especialidade_id: 2, ativo: true },
    { id: 3, nome: 'Elétrica 2 (inativa)', especialidade_id: 1, ativo: false },
  ];
  const hab = N.equipesParaDominio(equipes, [eletricista, refrig], 'eletrica');
  assert.deepStrictEqual(hab.map((e) => e.nome), ['Elétrica 1'], 'equipe inativa não é habilitada');
});

test('dominios vem do jsonb como array OU string — uma função trata os dois', () => {
  assert.deepStrictEqual(N.normalizarDominios(['a', 'b']), ['a', 'b']);
  assert.deepStrictEqual(N.normalizarDominios('["a","b"]'), ['a', 'b']);
  assert.deepStrictEqual(N.normalizarDominios('não é json'), []);
  assert.deepStrictEqual(N.normalizarDominios(null), []);
  assert.deepStrictEqual(N.normalizarDominios([1, 'a', null]), ['a'], 'só strings');
});

test('as chaves de DOMINIOS são módulos que existem de verdade na plataforma', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
  const rotas = new Set(vercel.rewrites.map((r) => r.source.replace('/', '')));
  N.DOMINIOS.forEach((d) => {
    assert.ok(rotas.has(d.chave), `${d.chave} não é um módulo roteado — domínio que não existe não habilita nada`);
  });
});

test('as cores de equipe são lista fechada e sem repetição — cor é o que separa duas equipes na grade', () => {
  assert.strictEqual(new Set(N.CORES_EQUIPE).size, N.CORES_EQUIPE.length);
  N.CORES_EQUIPE.forEach((c) => assert.match(c, /^#[0-9A-Fa-f]{6}$/));
  // A sugestão é a primeira ainda não usada, para duas equipes novas não
  // nascerem iguais.
  assert.strictEqual(N.proximaCor([]), N.CORES_EQUIPE[0]);
  assert.strictEqual(N.proximaCor([{ cor: N.CORES_EQUIPE[0] }]), N.CORES_EQUIPE[1]);
});

// ═══════════ plano & capacidade: a demanda ═══════════

// O plano REAL da refrigeração no banco, conferido em 31/08/2026:
// 9 tarefas da NBR 17037, todas aplicando a TODOS.
const PLANO_REAL = [
  { periodicidade: 'MENSAL', ativo: true }, { periodicidade: 'MENSAL', ativo: true },
  { periodicidade: 'TRIMESTRAL', ativo: true }, { periodicidade: 'TRIMESTRAL', ativo: true },
  { periodicidade: 'SEMESTRAL', ativo: true }, { periodicidade: 'SEMESTRAL', ativo: true },
  { periodicidade: 'SEMESTRAL', ativo: true }, { periodicidade: 'SEMESTRAL', ativo: true },
  { periodicidade: 'ANUAL', ativo: true },
];
const PARAMS_SEED = { minutos_por_tarefa: 10, minutos_setup: 15 };

test('periodicidade desconhecida vale 0 e é CONTADA à parte — nunca suposta como anual', () => {
  assert.strictEqual(N.ocorrenciasPorAno('MENSAL'), 12);
  assert.strictEqual(N.ocorrenciasPorAno('semestral'), 2);
  assert.strictEqual(N.ocorrenciasPorAno(' ANUAL '), 1);
  assert.strictEqual(N.ocorrenciasPorAno('QUINZENAL'), 0);
  assert.strictEqual(N.ocorrenciasPorAno(null), 0);
  // Supor faria uma tarefa nova entrar na conta com um número inventado.
  const p = N.visitasDoPlano([...PLANO_REAL, { periodicidade: 'QUINZENAL', ativo: true }]);
  assert.strictEqual(p.semPeriodicidade, 1);
  assert.strictEqual(p.tarefasPorAno, 41, 'a tarefa desconhecida não pode ter entrado na soma');
});

test('as tarefas são agrupadas em VISITAS — 19 idas por ano, não 41', () => {
  // O técnico que faz as duas tarefas mensais do mesmo aparelho se desloca
  // UMA vez. Cobrar setup por tarefa quase dobraria a demanda.
  const p = N.visitasDoPlano(PLANO_REAL);
  assert.strictEqual(p.visitasPorAno, 19, '12 mensais + 4 trimestrais + 2 semestrais + 1 anual');
  assert.strictEqual(p.tarefasPorAno, 41);
  assert.deepStrictEqual(p.visitas.map(v => [v.periodicidade, v.porAno, v.tarefas]),
    [['MENSAL', 12, 2], ['TRIMESTRAL', 4, 2], ['SEMESTRAL', 2, 4], ['ANUAL', 1, 1]]);
});

test('tarefa inativa sai do plano', () => {
  const p = N.visitasDoPlano([...PLANO_REAL, { periodicidade: 'MENSAL', ativo: false }]);
  assert.strictEqual(p.tarefasPorAno, 41);
});

test('o setup é cobrado por VISITA, não por tarefa — a diferença é de quase metade da demanda', () => {
  const p = N.visitasDoPlano(PLANO_REAL);
  const porVisita = N.minutosPorEquipamentoAno(p, PARAMS_SEED);
  // Por visita: 12×(2×10+15) + 4×(2×10+15) + 2×(4×10+15) + 1×(1×10+15)
  assert.strictEqual(porVisita, 12 * 35 + 4 * 35 + 2 * 55 + 1 * 25);
  // Se o setup fosse por tarefa seriam 41 setups em vez de 19: 1025 min
  // contra 695, um inchaço de ~47% — o técnico não desloca, abre o
  // equipamento e fecha uma vez por tarefa, e sim uma vez por visita.
  const seFosseTarefa = 41 * PARAMS_SEED.minutos_por_tarefa + 41 * PARAMS_SEED.minutos_setup;
  assert.strictEqual(seFosseTarefa, 1025);
  assert.ok(seFosseTarefa > porVisita * 1.4, 'a decisão de agrupar em visitas precisa importar de verdade');
});

// O parque REAL, contado pela porta da frente em 01/09/2026: 175
// instalados em seis tipos — SPLIT 103, SELF CONTAINED 32, PISO/TETO 22,
// JANELA 11, CENTRAL 6, CHILLER 1. Os números importam: é o CHILLER
// sozinho que mostra o tamanho do defeito, porque uma regra escrita para
// ele era cobrada de 175 máquinas.
const TIPOS_REAIS = [
  ['SPLIT', 103], ['SELF CONTAINED', 32], ['PISO/TETO', 22],
  ['JANELA', 11], ['CENTRAL', 6], ['CHILLER', 1],
];
let _seq = 0;
const PARQUE = TIPOS_REAIS.flatMap(([tipo, n]) =>
  Array.from({ length: n }, () => ({ id: ++_seq, tipo, modelo: null })));

test('o parque de teste é o parque real: 175 instalados em seis tipos', () => {
  assert.strictEqual(PARQUE.length, 175);
  assert.strictEqual(TIPOS_REAIS.reduce((s, [, n]) => s + n, 0), 175);
  assert.strictEqual(PARQUE.filter(e => e.tipo === 'SPLIT').length, 103);
  assert.strictEqual(PARQUE.filter(e => e.tipo === 'CHILLER').length, 1);
  // Seis tipos para um CHECKLIST de quatro chaves — a lacuna que a
  // migração 54 fechou em /refrigeracao e que este módulo agora respeita
  // ao cobrar cada regra a quem ela pertence.
  assert.strictEqual(new Set(PARQUE.map(e => e.tipo)).size, 6);
});

test('a demanda anual bate com os números REAIS do banco (175 equipamentos)', () => {
  const d = N.demandaAnual(PLANO_REAL, PARQUE, PARAMS_SEED, 99);
  assert.strictEqual(Math.round(d.horasPorEquipamentoAnoMedia * 100) / 100, 11.58);
  assert.strictEqual(Math.round(d.horasAno), 2027);
  assert.strictEqual(Math.round(d.horasSemana * 10) / 10, 39);
  assert.strictEqual(d.visitasAno, 19 * 175);
  // A correção NÃO pode mover o estado saudável: com as 9 tarefas em
  // TODOS, somar por escopo é a mesma multiplicação feita uma vez por
  // grupo, e tem de dar o mesmo dígito que dava.
  assert.strictEqual(d.comEscopo, false);
  assert.strictEqual(d.semRegra, 0);
});

// ═══════════ O DEFEITO QUE ESTA CORREÇÃO CONSERTA ═══════════
//
// `demandaAnual` recebia `nEquipamentos`, um NÚMERO, e multiplicava por
// ele um plano montado sobre a lista inteira de tarefas. Uma função que
// recebe uma CONTAGEM não tem como estar certa depois que o escopo
// existe: a contagem não sabe de que tipo é cada máquina.

test('regra por TIPO é cobrada só ao tipo — não aos 175 equipamentos', () => {
  // Uma tarefa mensal escrita só para o CHILLER, que é UMA máquina.
  const comRegra = [...PLANO_REAL, { periodicidade: 'MENSAL', ativo: true, aplica_a: 'CHILLER' }];
  const base = N.demandaAnual(PLANO_REAL, PARQUE, PARAMS_SEED, 99);
  const d = N.demandaAnual(comRegra, PARQUE, PARAMS_SEED, 99);

  assert.strictEqual(d.comEscopo, true, 'a tela precisa saber que o escopo entrou em jogo');

  // O chiller passa a ter 3 tarefas mensais em vez de 2 — 12 visitas de
  // 3×10+15 no lugar de 12 de 2×10+15, ou seja 12×10 = 120 min a mais.
  // Uma máquina, 120 minutos: 2 horas no ano inteiro.
  const acrescimo = d.horasAno - base.horasAno;
  assert.strictEqual(Math.round(acrescimo * 100) / 100, 2,
    'a regra do chiller vale para 1 máquina, não para 175');

  // O que a conta ANTIGA faria: 9+1 tarefas para todo mundo.
  const seFosseGlobal = 175 * 120 / 60;
  assert.strictEqual(seFosseGlobal, 350);
  assert.ok(acrescimo < seFosseGlobal / 100,
    'o defeito inflaria a demanda em 350 h/ano de trabalho que ninguém vai fazer');

  const chiller = d.porTipo.find(l => l.tipo === 'CHILLER');
  const split = d.porTipo.find(l => l.tipo === 'SPLIT');
  assert.strictEqual(chiller.regrasMax, 10);
  assert.strictEqual(split.regrasMax, 9, 'a regra do chiller não pode ter alcançado o split');
});

test('regra por MODELO alcança só aquele modelo, dentro do tipo', () => {
  const parque = [
    { id: 1, tipo: 'SPLIT', modelo: 'ASBG18' },
    { id: 2, tipo: 'SPLIT', modelo: 'ASBG18' },
    { id: 3, tipo: 'SPLIT', modelo: 'OUTRO' },
    { id: 4, tipo: 'SPLIT', modelo: null },
  ];
  const tarefas = [{ periodicidade: 'ANUAL', ativo: true, aplica_a: 'SPLIT', aplica_modelo: 'ASBG18' }];
  const d = N.demandaAnual(tarefas, parque, PARAMS_SEED, 0);

  // 2 máquinas × 1 visita anual de (1×10+15) = 50 min.
  assert.strictEqual(Math.round(d.horasAno * 60), 50);
  assert.strictEqual(d.visitasAno, 2);
  // As outras duas SPLIT não são alcançadas por regra nenhuma.
  assert.strictEqual(d.semRegra, 2);
  // E o tipo mostra a FAIXA, não uma média: 0 para umas, 1 para outras.
  const split = d.porTipo.find(l => l.tipo === 'SPLIT');
  assert.strictEqual(split.regrasMin, 0);
  assert.strictEqual(split.regrasMax, 1);
});

test('equipamento que NENHUMA regra alcança vale zero — e é contado, nunca somado em silêncio', () => {
  // O estado que a migração 55 deliberadamente deixou: nenhuma regra
  // própria de CENTRAL/CHILLER foi escrita. Se um dia as 9 TODOS virarem
  // regras de SPLIT, a central sai da conta — e isso não é folga.
  const soSplit = PLANO_REAL.map(t => ({ ...t, aplica_a: 'SPLIT' }));
  const d = N.demandaAnual(soSplit, PARQUE, PARAMS_SEED, 99);

  assert.strictEqual(d.equipamentos, 175, 'os não alcançados continuam sendo parque');
  assert.strictEqual(d.semRegra, 72, '175 − 103 SPLIT');
  assert.deepStrictEqual(d.tiposSemRegra.sort(),
    ['CENTRAL', 'CHILLER', 'JANELA', 'PISO/TETO', 'SELF CONTAINED']);
  assert.strictEqual(Math.round(d.horasAno), Math.round(103 * 695 / 60));

  // E a tela precisa DIZER, não só a função saber: uma demanda que
  // encolhe sem explicação é lida como folga.
  //
  // O que se afirma aqui é o GUARDA, não a frase. Uma primeira versão
  // deste caso procurava o texto do aviso, e ele passou verde com o
  // bloco inteiro desativado — a frase continua no arquivo mesmo quando
  // nada a alcança. É a mesma cegueira que `tests/mapa-editor.test.js`
  // teve ao procurar `.from('...')` depois que os nomes mudaram de
  // lugar: um gate que não consegue reprovar não é um gate.
  assert.match(APP, /\$\{dem\.semRegra \? `<div class="callout co-warn"/,
    'o aviso precisa ser alcançado exatamente quando há o que avisar');
  const aviso = APP.slice(APP.indexOf('${dem.semRegra ? `<div'));
  assert.match(aviso.slice(0, 600), /que nenhuma regra do plano alcança/);
  assert.match(aviso.slice(0, 600), /zero hora/);
  assert.match(aviso.slice(0, 600), /dem\.tiposSemRegra/,
    'dizer quantos sem dizer quais deixa o usuário sem o próximo passo');
});

test('a periodicidade desconhecida é contada UMA vez, não uma por grupo', () => {
  const tarefas = [...PLANO_REAL, { periodicidade: 'QUINZENAL', ativo: true }];
  const d = N.demandaAnual(tarefas, PARQUE, PARAMS_SEED, 99);
  // São seis tipos no parque; contar por grupo relataria seis tarefas
  // sem periodicidade onde existe uma.
  assert.strictEqual(d.semPeriodicidade, 1);
  assert.strictEqual(Math.round(d.horasAno), 2027, 'nem entrou na conta com número suposto');
});

test('os grupos são tipo × MODELO, não só tipo — senão a regra de modelo valeria para o tipo', () => {
  const g = N.gruposDePlano([
    { tipo: 'SPLIT', modelo: 'A' }, { tipo: 'SPLIT', modelo: 'A' },
    { tipo: 'SPLIT', modelo: 'B' }, { tipo: 'SPLIT', modelo: null },
    { tipo: 'CENTRAL', modelo: null },
  ]);
  assert.strictEqual(g.length, 4);
  assert.deepStrictEqual(g.map(x => x.quantidade), [2, 1, 1, 1]);
});

test('tipo é cadastro livre: a comparação normaliza caixa e espaço', () => {
  const t = { periodicidade: 'ANUAL', ativo: true, aplica_a: ' split ' };
  assert.strictEqual(N.planoAplicaAoEquip(t, { tipo: 'SPLIT' }), true);
  assert.strictEqual(N.planoAplicaAoEquip(t, { tipo: 'Split' }), true);
  assert.strictEqual(N.planoAplicaAoEquip(t, { tipo: 'CENTRAL' }), false);
  // Sem escopo declarado, vale para todos — inclusive para tipo vazio.
  assert.strictEqual(N.planoAplicaAoEquip({ ativo: true }, { tipo: 'QUALQUER' }), true);
});

test('`aplica_modelo` ausente NÃO restringe — 117 das 175 linhas têm modelo nulo', () => {
  const t = { periodicidade: 'ANUAL', ativo: true, aplica_a: 'SPLIT' };
  assert.strictEqual(N.planoAplicaAoEquip(t, { tipo: 'SPLIT', modelo: null }), true);
  assert.strictEqual(N.planoAplicaAoEquip({ ...t, aplica_modelo: '' }, { tipo: 'SPLIT', modelo: 'X' }), true);
  // Exigir igualdade com nulo tiraria a regra de dois terços do parque.
  assert.strictEqual(N.planoAplicaAoEquip({ ...t, aplica_modelo: 'X' }, { tipo: 'SPLIT', modelo: null }), false);
});

test('tarefa inativa não entra na demanda nem liga o escopo', () => {
  const d = N.demandaAnual([...PLANO_REAL, { periodicidade: 'MENSAL', ativo: false, aplica_a: 'CHILLER' }],
    PARQUE, PARAMS_SEED, 99);
  assert.strictEqual(Math.round(d.horasAno), 2027);
  assert.strictEqual(d.comEscopo, false, 'regra desativada não muda a forma da tela');
});

test('a demanda lê as LINHAS dos equipamentos, não uma contagem — uma contagem não sabe o tipo', () => {
  const app = semComentarios(APP);
  assert.match(app, /from\('equipamentos'\)\s*\.select\('id,tipo,modelo'\)/,
    'sem tipo e modelo não há como cobrar a regra a quem ela pertence');
  assert.ok(!/from\('equipamentos'\)[^\n]*head:\s*true/.test(app),
    'o head count era exatamente o que impedia a conta de estar certa');
  assert.match(app, /demandaAnual\(TAREFAS_PLANO, EQUIPAMENTOS, PARAMS/);
});

test('a explicação da FAIXA só aparece quando há faixa na tela', () => {
  // Mesma classe de defeito que o aviso de "tipos sem regra própria"
  // custou em /refrigeracao: texto que descreve o que não está ali
  // ensina a ler explicação sem procurar o fato.
  assert.match(APP, /const temFaixa = dem\.porTipo\.some\(l => l\.regrasMin !== l\.regrasMax\)/);
  const tabela = APP.slice(APP.indexOf('function renderDemandaPorTipo'));
  assert.match(tabela.slice(0, 2000), /\$\{temFaixa \? `[^`]*A faixa em/,
    'a frase precisa estar sob a condição, não solta debaixo da tabela');
  // E o que some com o escopo — a periodicidade de cada regra — precisa
  // ter para onde apontar, senão a tela tira uma informação sem dizer
  // para onde ela foi.
  assert.match(tabela.slice(0, 2000), /aba <em>Plano<\/em> de \/refrigeracao/);
});

// ═══════════ a cópia vigiada ═══════════
//
// A regra de escopo existe DUAS vezes: aqui, em `equipes/nucleo.js`, e
// em `refrigeracao/index.html`, que é módulo congelado e não pode
// importar nada deste diretório. Não há terceiro lugar onde pôr a regra
// que apague uma das duas cópias — subi-la um nível daria um arquivo com
// um importador só e deixaria a réplica congelada exatamente onde está.
//
// O que impede a divergência não é o lugar: é este caso. Ele carrega as
// duas implementações e roda as duas sobre a mesma tabela, e uma
// discordância em qualquer linha reprova. Se um dia alguém corrigir a
// regra num lado e esquecer o outro, a tela de /refrigeracao passaria a
// dar um checklist que esta conta não cobra — e ninguém veria.

const HTML_REFRIG = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

function regraDaRefrigeracao() {
  const MARCA_INI = '   PLANO DE MANUTENÇÃO — serviço padrão, material por serviço e regra';
  const MARCA_FIM = '\nfunction planoAbrirTarefa(';
  const ini = HTML_REFRIG.lastIndexOf('/* ═', HTML_REFRIG.indexOf(MARCA_INI));
  const fim = HTML_REFRIG.indexOf(MARCA_FIM, ini);
  assert.ok(ini > 0 && fim > ini, 'recorte da seção PLANO de /refrigeracao não encontrado');
  const ctx = {
    esc: (x) => String(x ?? ''),
    el: () => null,
    equipInstalado: (e) => !!e && e.situacao === 'instalado',
    podeEditarCadastro: () => false,
    console: { warn() {} },
    supa: null,
  };
  vm.createContext(ctx);
  vm.runInContext(HTML_REFRIG.slice(ini, fim), ctx);
  assert.strictEqual(typeof ctx.planoAplicaAoEquip, 'function');
  return ctx.planoAplicaAoEquip;
}

test('a regra de escopo daqui e a de /refrigeracao concordam em TODOS os casos', () => {
  const outra = regraDaRefrigeracao();

  const tarefas = [
    { nome: 'sem escopo nenhum' },
    { aplica_a: 'TODOS' },
    { aplica_a: 'todos' },
    { aplica_a: ' TODOS ' },
    { aplica_a: 'SPLIT' },
    { aplica_a: 'split' },
    { aplica_a: ' SPLIT ' },
    { aplica_a: 'CENTRAL' },
    { aplica_a: 'SPLIT', aplica_modelo: 'ASBG18' },
    { aplica_a: 'SPLIT', aplica_modelo: 'asbg18' },
    { aplica_a: 'SPLIT', aplica_modelo: '' },
    { aplica_a: 'SPLIT', aplica_modelo: null },
    { aplica_a: 'TODOS', aplica_modelo: 'ASBG18' },
    { aplica_a: null, aplica_modelo: 'ASBG18' },
    { aplica_a: '', aplica_modelo: '' },
  ];
  const equipamentos = [
    { tipo: 'SPLIT', modelo: 'ASBG18' },
    { tipo: 'SPLIT', modelo: 'asbg18' },
    { tipo: 'split', modelo: null },
    { tipo: 'SPLIT', modelo: '' },
    { tipo: 'CENTRAL', modelo: null },
    { tipo: 'CHILLER', modelo: 'ASBG18' },
    { tipo: '', modelo: null },
    { tipo: null, modelo: null },
    { tipo: ' SPLIT ', modelo: ' ASBG18 ' },
  ];

  let comparados = 0;
  let houveTrue = 0;
  let houveFalse = 0;
  for (const t of tarefas) {
    for (const e of equipamentos) {
      const aqui = N.planoAplicaAoEquip(t, e);
      const la = outra(t, e);
      assert.strictEqual(aqui, la,
        `divergência: tarefa ${JSON.stringify(t)} × equipamento ${JSON.stringify(e)} ` +
        `— /equipes diz ${aqui}, /refrigeracao diz ${la}`);
      comparados++;
      if (aqui) houveTrue++; else houveFalse++;
    }
  }
  assert.strictEqual(comparados, tarefas.length * equipamentos.length);
  // Uma tabela em que tudo dá o mesmo valor não compara nada: as duas
  // implementações concordariam sendo ambas `() => true`.
  assert.ok(houveTrue > 20 && houveFalse > 20,
    `a tabela precisa exercer os dois lados (${houveTrue} true, ${houveFalse} false)`);

  // E os dois argumentos ausentes, que é como a função é chamada quando
  // o dado ainda não carregou.
  for (const par of [[null, {}], [{}, null], [null, null], [undefined, undefined]]) {
    assert.strictEqual(N.planoAplicaAoEquip(par[0], par[1]), outra(par[0], par[1]));
  }
});

test('plano_tarefas é lida com select(*) — sem a migração 54 a aba não pode cair', () => {
  const app = semComentarios(APP);
  assert.match(app, /from\('plano_tarefas'\)\.select\('\*'\)/);
  // Pedir `aplica_modelo` pelo nome num banco sem a 54 devolve 400 e
  // derruba a aba inteira; vindo undefined, a regra já a trata como
  // "sem refinamento". É o que dispensa uma sonda aqui.
  assert.ok(!/plano_tarefas'\)\.select\('[^']*aplica_modelo/.test(app));
});

test('parâmetro ausente ou inválido vale 0, nunca NaN — um NaN se propagaria pela demanda inteira', () => {
  const p = N.visitasDoPlano(PLANO_REAL);
  [{}, null, { minutos_por_tarefa: 'abc' }, { minutos_por_tarefa: -5 }].forEach((par) => {
    const m = N.minutosPorEquipamentoAno(p, par);
    assert.ok(Number.isFinite(m), `${JSON.stringify(par)} produziu NaN`);
    assert.ok(m >= 0);
  });
});

test('sem capacidade não há utilização — null, nunca Infinity nem um 0 que passaria por folga', () => {
  assert.strictEqual(N.utilizacao(39, 0), null);
  assert.strictEqual(N.utilizacao(39, null), null);
  assert.strictEqual(N.utilizacao(39, -1), null);
  assert.strictEqual(N.faixaUtilizacao(null), null);
  // E a tela trata esse caso em vez de imprimir o null.
  assert.match(APP, /Sem capacidade escalada nesta semana/);
});

test('as faixas de utilização separam folga, apertado, limite e acima', () => {
  assert.strictEqual(N.faixaUtilizacao(N.utilizacao(39, 80)).chave, 'folga');   // 49%
  assert.strictEqual(N.faixaUtilizacao(0.80).chave, 'apertado');
  assert.strictEqual(N.faixaUtilizacao(0.95).chave, 'limite');
  assert.strictEqual(N.faixaUtilizacao(N.utilizacao(39, 20)).chave, 'acima');   // 195%
  // 85% é o limite entre apertado e limite: acima disso não sobra folga
  // para corretiva, que numa oficina é o mesmo que não caber.
  assert.strictEqual(N.faixaUtilizacao(0.85).chave, 'apertado');
  assert.strictEqual(N.faixaUtilizacao(0.851).chave, 'limite');
});

test('parametrosComoObjeto converte as linhas chave/valor e não deixa NaN passar', () => {
  const o = N.parametrosComoObjeto([
    { chave: 'minutos_por_tarefa', valor: '10' },
    { chave: 'minutos_setup', valor: 15 },
    { chave: 'quebrado', valor: 'abc' },
    null, { valor: 3 },
  ]);
  assert.strictEqual(o.minutos_por_tarefa, 10);
  assert.strictEqual(o.minutos_setup, 15);
  assert.strictEqual(o.quebrado, 0);
});

// ═══════════ D-eq-08: a demanda vem do plano REAL, não de uma cópia ═══════

test('a demanda lê plano_tarefas — nenhuma cópia de intervalos de /refrigeracao', () => {
  // Duplicar PMOC_INT aqui criaria duas fontes de verdade para "de quanto
  // em quanto tempo", e /refrigeracao é módulo congelado: a cópia
  // divergiria da original sem ninguém perceber.
  assert.match(APP, /from\('plano_tarefas'\)/);
  const nucleo = semComentarios(fs.readFileSync(path.join(RAIZ, 'equipes', 'nucleo.js'), 'utf8'));
  assert.ok(!/PMOC_INT|inspecao\s*:\s*\d+|preventiva\s*:\s*\d+/.test(nucleo),
    'intervalos por criticidade não podem ser copiados para cá');
  // O que a migração 51 acrescenta é só o TEMPO, que é calibração de
  // oficina e não norma.
  const sql51 = fs.readFileSync(path.join(RAIZ, 'supabase', '51_equipes_parametros_plano.sql'), 'utf8');
  assert.match(sql51, /create table if not exists cmasm_parametros/);
  assert.ok(!/interval|periodicidade/i.test(semProsaSql(sql51)),
    'a migração não pode duplicar periodicidade — ela vem de plano_tarefas');
  assert.match(sql51, /check \(valor >= 0\)/, 'tempo negativo encolheria a demanda em silêncio');
});

test('o plano é carregado FORA do Promise.all principal — sem a 51 o módulo segue inteiro', () => {
  assert.match(APP, /async function carregarPlano\(\)/);
  const ini = APP.indexOf('async function carregarPlano()');
  const fonte = APP.slice(ini, APP.indexOf('\n// ── plano & capacidade', ini));
  assert.match(fonte, /catch/, 'a falha não pode derrubar a carga do módulo');
  assert.match(fonte, /PLANO_OK = false/);
  assert.match(APP, /Não foi possível montar o plano/);
});

// ═══════════ o esquema ═══════════

test('as tabelas nascem com prefixo cmasm_, não equipe_ — o requisito atravessa módulos', () => {
  ['cmasm_especialidades', 'cmasm_pessoas', 'cmasm_equipes',
   'cmasm_equipe_membros', 'cmasm_turnos', 'cmasm_alocacoes'].forEach((t) => {
    assert.ok(SQL_49.includes(`create table if not exists ${t}`), `${t} não foi criada`);
  });
  assert.ok(!/create table if not exists equipe_/.test(SQL_49),
    'prefixo de módulo custaria uma migração de renomeação com dado em produção');
});

test('a migração é aditiva e não tem DROP — o projeto arquiva, nunca reescreve', () => {
  [SQL_49, SQL_50].forEach((sql) => {
    assert.ok(!/\bdrop\s+(table|column|constraint|policy)\b/i.test(sql));
  });
  assert.ok(/create table if not exists/.test(SQL_49));
  assert.ok(/on conflict .* do nothing/i.test(SQL_50), 'o seed precisa ser idempotente');
});

test('as travas que impedem capacidade contada em dobro existem no banco', () => {
  assert.match(SQL_49, /constraint cmasm_alocacoes_unico unique \(equipe_id, data, turno_id\)/,
    'a mesma equipe no mesmo turno do mesmo dia contaria a capacidade duas vezes');
  assert.match(SQL_49, /constraint cmasm_equipe_membros_unico unique \(equipe_id, pessoa_id\)/,
    'a mesma pessoa duas vezes na equipe dobraria o tamanho dela');
  assert.match(SQL_49, /check \(hora_fim > hora_inicio\)/,
    'turno invertido daria duração negativa e subtrairia capacidade');
});

test('o esquema tem hora_inicio/hora_fim, e NÃO uma coluna de duração digitada', () => {
  assert.match(SQL_49, /hora_inicio time not null/);
  assert.match(SQL_49, /hora_fim    time not null/);
  assert.ok(!/\bhoras\s+(numeric|integer|real)/.test(semComentarioSql(SQL_49)),
    'duração é derivada das horas; uma coluna ao lado divergiria delas');
});

test('RLS: leitura por public, escrita por cargo — e alocar inclui o técnico', () => {
  assert.match(SQL_49, /enable row level security/);
  // Cadastro é admin/gestor; escalar é planejamento de rotina.
  assert.match(SQL_49, /cadastro text\[\] := array\['cmasm_especialidades','cmasm_pessoas','cmasm_equipes','cmasm_equipe_membros','cmasm_turnos'\]/);
  assert.match(SQL_49, /cmasm_alocacoes_write[\s\S]{0,400}'admin','gestor','tecnico'/);
  assert.match(SQL_49, /for select to public using \(true\)/);
});

test('as duas listas de permissão da TELA espelham as policies do banco', () => {
  assert.match(APP, /podeCadastrar = \(\) => \['admin', 'gestor'\]/);
  assert.match(APP, /podeAlocar = \(\) => \['admin', 'gestor', 'tecnico'\]/);
});

test('nenhuma pessoa ou equipe é semeada — nome de militar é dado real da OM', () => {
  assert.ok(!/insert into cmasm_pessoas/i.test(SQL_50));
  assert.ok(!/insert into cmasm_equipes/i.test(SQL_50));
  assert.match(SQL_50, /insert into cmasm_especialidades/i);
  assert.match(SQL_50, /insert into cmasm_turnos/i);
});

test('nenhuma especialidade semeada nasce sem domínio — seria um ofício que não serve para nada', () => {
  const ini = SQL_50.indexOf('insert into cmasm_especialidades');
  const linhas = SQL_50.slice(ini, SQL_50.indexOf('on conflict', ini))
    .split('\n').filter((l) => l.includes('jsonb'));
  assert.ok(linhas.length >= 5, 'o seed deveria trazer os ofícios da oficina');
  linhas.forEach((l) => {
    const m = l.match(/'(\[[^']*\])'::jsonb/);
    assert.ok(m, `linha sem domínios: ${l}`);
    assert.ok(JSON.parse(m[1]).length > 0, `especialidade sem domínio: ${l}`);
  });
});

// ═══════════ o módulo na plataforma ═══════════

test('/equipes está roteado no Vercel e no portal', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
  assert.ok(vercel.rewrites.some((r) => r.source === '/equipes' && r.destination === '/equipes/index.html'),
    'sem o rewrite, /equipes dá 404 em produção');
  const portal = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  assert.ok(portal.includes('href="/equipes"'), 'o módulo precisa de porta de entrada no portal');
});

test('usa a base comum (Auth, shell, tema) — não é um segundo login na plataforma', () => {
  assert.match(APP, /from '\.\.\/shared\/auth\.js'/);
  assert.match(APP, /from '\.\.\/shared\/shell\.js'/);
  assert.match(APP, /from '\.\.\/shared\/supabase-config\.js'/);
  assert.match(HTML, /\.\.\/shared\/pmoc\.css/);
  // O anti-FOUC de tema é replicado byte a byte nas superfícies (D-05).
  assert.match(HTML, /localStorage\.getItem\('pmoc-tema'\)/);
  // Não usa o esqueleto de manutenção de ativos: aqui não há ativo nenhum.
  assert.ok(!/modulo-manutencao/.test(semComentarios(APP)));
});

test('os handlers inline são expostos no window — um módulo ES tem escopo próprio', () => {
  // Sem isso, todo onclick/ondrop da tela procuraria uma função que não
  // existe no escopo global e falharia em silêncio.
  const ini = APP.indexOf('function exporNoWindow()');
  const fim = APP.indexOf('}', APP.indexOf('Object.assign(window', ini));
  const bloco = APP.slice(ini, fim);
  ['trocarView', 'aoArrastar', 'aoSobrepor', 'aoSoltar', 'aoSair', 'removerAlocacao',
   'abrirPessoa', 'abrirEquipe', 'abrirMembros', 'abrirEspecialidade', 'abrirTurno',
   'navegarSemana', 'irParaHoje', 'fecharModal', 'confirmarModal', 'sair'].forEach((f) => {
    assert.ok(bloco.includes(f), `${f} é chamada de atributo inline e precisa estar no window`);
  });
});

test('soltar de novo no mesmo lugar não grava nada, e a guarda de cargo está na AÇÃO', () => {
  const ini = APP.indexOf('async function aoSoltar(');
  const fonte = APP.slice(ini, APP.indexOf('\nasync function removerAlocacao', ini));
  assert.match(fonte, /podeAlocar\(\)/, 'arrastar é affordance de tela e não protege gravação');
  assert.match(fonte, /ALOCACOES\.some\(/, 'soltar no mesmo lugar não pode tentar inserir e mostrar erro');
});

test('escalar por toque existe e usa a MESMA gravação do arrastar — não uma segunda porta', () => {
  // Abaixo de 900px a grade não existe e o arrastar do HTML5 não dispara
  // em toque: sem este caminho o celular ficaria só de leitura, num
  // aplicativo usado em campo.
  assert.match(APP, /function escalarPorFormulario\(equipeId\)/);
  const ini = APP.indexOf('function escalarPorFormulario(');
  const fonte = APP.slice(ini, APP.indexOf('\nasync function removerAlocacao', ini));
  assert.match(fonte, /podeAlocar\(\)/, 'a guarda de cargo tem de estar aqui também');
  assert.match(fonte, /from\('cmasm_alocacoes'\)\s*\n?\s*\.insert/, 'mesma tabela, mesmo insert');
  assert.match(fonte, /ALOCACOES\.some\(/, 'já escalada ali não pode virar linha nova');
  // Exatamente DOIS inserts em cmasm_alocacoes: o arrastar e o
  // formulário — dois gatilhos para a mesma gravação. Um terceiro seria
  // porta de escrita nova, que é o que este caso existe para pegar.
  const inserts = (semComentarios(APP).match(/from\('cmasm_alocacoes'\)\s*\n?\s*\.insert/g) || []).length;
  assert.strictEqual(inserts, 2, 'só o arrastar e o formulário podem criar alocação');
  // E os outros dois acessos à tabela são a leitura da semana e a
  // remoção — nenhum caminho escondido.
  const acessos = (semComentarios(APP).match(/from\('cmasm_alocacoes'\)/g) || []).length;
  assert.strictEqual(acessos, 4, 'esperado: 1 select da semana + 2 inserts + 1 delete');
});

test('o chip da paleta é alcançável por teclado, não só por mouse', () => {
  assert.match(APP, /role="button" tabindex="0"/);
  assert.match(APP, /onkeydown="if\(event\.key==='Enter'\|\|event\.key===' '\)/);
});

test('a carga de alocações é limitada à semana na tela', () => {
  const ini = APP.indexOf('async function carregarAlocacoes()');
  const fonte = APP.slice(ini, APP.indexOf('\n}', APP.indexOf('return', ini)) + 2);
  assert.match(fonte, /\.gte\('data'/);
  assert.match(fonte, /\.lte\('data'/);
});

test('sem a migração 49 a tela DIZ o que houve, em vez de parecer uma oficina sem ninguém', () => {
  assert.match(APP, /49_equipes_schema\.sql/);
  assert.match(APP, /Não foi possível ler o cadastro de equipes/);
});
