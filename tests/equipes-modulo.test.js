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
