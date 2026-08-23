// Gate do fluxo de aprovação da OS interna de manutenção (/refrigeracao) —
// quick task 260821-l7n. Três recortes do HTML avaliados em sandboxes
// node:vm, no mesmo padrão de tests/refrigeracao-encerramento-os.test.js:
// (1) a ponte de campos de logs_manutencao (CAMPOS_LOG/dbToLog/logParaDb);
// (2) a porta de escrita (manSondarEsquema/manAtualizarOS/carregarPerfil);
// (3) o vocabulário e as transições de estado (Task 2), e a evidência da
// execução (Task 3), acrescentados nas próximas tarefas deste mesmo arquivo
// de teste.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');
const SQL_40 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '40_refrigeracao_os_fluxo.sql'), 'utf8');
const SQL_41 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '41_refrigeracao_ficha_estado.sql'), 'utf8');
const SQL_04 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '04_refrigeracao_schema.sql'), 'utf8');
// 260821-uyz: a migração 42 acrescenta quatro colunas de movimentação em
// logs_manutencao (local_destino_id/local_origem_id/equip_substituido_id/
// destino_remocao) — sem somá-la aqui este gate voltaria a afirmar que a
// união das migrações é a verdade, quando não seria mais.
const SQL_42 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '42_refrigeracao_movimentacao.sql'), 'utf8');
// 260823-cf8 (Task 1): a migração 43 acrescenta 18 colunas da OS unificada
// por tipo de executor em logs_manutencao — mesmo raciocínio já registrado
// para a 42: sem somá-la aqui este gate voltaria a afirmar que a união das
// migrações é a verdade, quando não seria mais.
const SQL_43 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '43_refrigeracao_os_unificada.sql'), 'utf8');

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

// ── colunas conhecidas de logs_manutencao (migração 04 + migração 40) ──
function colunasLogsManutencao04() {
  const ini = SQL_04.indexOf('create table if not exists logs_manutencao');
  const abre = SQL_04.indexOf('(', ini);
  const fim = SQL_04.indexOf(');', ini);
  assert.ok(ini > 0 && fim > ini, 'logs_manutencao não encontrada em 04_refrigeracao_schema.sql');
  const corpo = SQL_04.slice(abre + 1, fim);
  // separa por vírgula no nível 0 de parênteses (há chamadas como gen_random_uuid())
  const segmentos = [];
  let atual = '', prof = 0;
  for (const ch of corpo) {
    if (ch === '(') prof++;
    if (ch === ')') prof--;
    if (ch === ',' && prof === 0) { segmentos.push(atual); atual = ''; }
    else atual += ch;
  }
  if (atual.trim()) segmentos.push(atual);
  const nomes = [];
  segmentos.forEach((seg) => {
    const m = seg.trim().match(/^([a-z_][a-z0-9_]*)\s+/i);
    if (m) nomes.push(m[1]);
  });
  return nomes;
}

function colunasNovasMigracao40() {
  const re = /alter table logs_manutencao add column if not exists (\w+)/g;
  const nomes = [];
  let m;
  while ((m = re.exec(SQL_40))) nomes.push(m[1]);
  return nomes;
}

// 260821-q57 (Task 3): a migração 41 acrescenta três colunas em
// logs_manutencao (capacitor_marcha, capacitor_partida, tensao_medida) — o
// gate precisa aprender o fato novo, não a ponte que está errada.
function colunasNovasMigracao41() {
  const re = /alter table logs_manutencao add column if not exists (\w+)/g;
  const nomes = [];
  let m;
  while ((m = re.exec(SQL_41))) nomes.push(m[1]);
  return nomes;
}

// 260821-uyz (Task 2): a migração 42 acrescenta quatro colunas de
// movimentação em logs_manutencao.
function colunasNovasMigracao42() {
  const re = /alter table logs_manutencao add column if not exists (\w+)/g;
  const nomes = [];
  let m;
  while ((m = re.exec(SQL_42))) nomes.push(m[1]);
  return nomes;
}

// 260823-cf8 (Task 1): a migração 43 acrescenta 18 colunas da OS unificada
// por tipo de executor em logs_manutencao.
function colunasNovasMigracao43() {
  const re = /alter table logs_manutencao add column if not exists (\w+)/g;
  const nomes = [];
  let m;
  while ((m = re.exec(SQL_43))) nomes.push(m[1]);
  return nomes;
}

// ── ponte de campos ── (CAMPOS_LOG / dbToLog / logParaDb)
function carregarPonte() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  return ctx;
}

test('toda coluna criada pela migração 40 aparece como valor em CAMPOS_LOG (D-l7n-07)', () => {
  const ctx = carregarPonte();
  const novas = colunasNovasMigracao40();
  assert.ok(novas.length >= 9, 'migração 40 deveria criar 9 colunas novas');
  const valores = Object.keys(ctx.CAMPOS_LOG).map((k) => ctx.CAMPOS_LOG[k]);
  novas.forEach((col) => {
    assert.ok(valores.includes(col), `coluna nova "${col}" não está em CAMPOS_LOG`);
  });
});

test('todo valor de CAMPOS_LOG é uma coluna real (união das colunas da migração 04 com as da 40, 41, 42 e 43)', () => {
  const ctx = carregarPonte();
  const colunasReais = colunasLogsManutencao04().concat(colunasNovasMigracao40(), colunasNovasMigracao41(), colunasNovasMigracao42(), colunasNovasMigracao43());
  Object.keys(ctx.CAMPOS_LOG).forEach((k) => {
    const col = ctx.CAMPOS_LOG[k];
    assert.ok(colunasReais.includes(col), `CAMPOS_LOG.${k} = "${col}" não é coluna real de logs_manutencao`);
  });
});

test('as três colunas novas da migração 41 (capacitor_marcha, capacitor_partida, tensao_medida) aparecem como valor em CAMPOS_LOG (D-q57-12)', () => {
  const ctx = carregarPonte();
  const novas41 = colunasNovasMigracao41();
  assert.deepEqual(novas41.sort(), ['capacitor_marcha', 'capacitor_partida', 'tensao_medida'].sort());
  const valores = Object.keys(ctx.CAMPOS_LOG).map((k) => ctx.CAMPOS_LOG[k]);
  novas41.forEach((col) => assert.ok(valores.includes(col), `coluna nova "${col}" não está em CAMPOS_LOG`));
});

test('dbToLog de uma linha completa devolve as 5 medições e as fotos, e mantém as sete chaves que a tela já consumia', () => {
  const ctx = carregarPonte();
  const linha = {
    id: 'log-1', equip_id: 10, data_os: '2026-08-21', tipo: 'PREVENTIVA', status: 'ABERTA',
    tecnico: 'Fulano', descricao: 'problema x', checklist: [{ i: 0, done: true }],
    fotos: ['manutencao/log-1/1.jpg'],
    temp_insuflamento: 12, temp_retorno: 24, delta_t: 12, corrente_medida: 5.5, pressao_succao: 60,
  };
  const o = ctx.dbToLog(linha);
  assert.strictEqual(o.insuflamento, 12);
  assert.strictEqual(o.retorno, 24);
  assert.strictEqual(o.deltaT, 12);
  assert.strictEqual(o.corrente, 5.5);
  assert.strictEqual(o.pressao, 60);
  assert.deepStrictEqual(o.fotos, ['manutencao/log-1/1.jpg']);
  ['id', 'date', 'tipo', 'status', 'tecnico', 'desc', 'checklist'].forEach((k) => {
    assert.ok(k in o, `chave "${k}" sumiu de dbToLog`);
  });
  assert.strictEqual(o.date, '2026-08-21');
  assert.strictEqual(o.desc, 'problema x');
});

test('dbToLog de uma linha sem as colunas novas (banco pré-migração) não lança e devolve fotos como lista vazia', () => {
  const ctx = carregarPonte();
  const linhaAntiga = { id: 'log-2', equip_id: 5, data_os: '2020-01-01', tipo: 'PREVENTIVA', status: 'CONCLUÍDA', tecnico: null, descricao: null, checklist: null };
  assert.doesNotThrow(() => { ctx.dbToLog(linhaAntiga); });
  const o = ctx.dbToLog(linhaAntiga);
  assert.strictEqual(Array.isArray(o.fotos), true);
  assert.strictEqual(o.fotos.length, 0);
  assert.strictEqual(o.tecnico, '');
  assert.strictEqual(o.desc, '');
  assert.strictEqual(Array.isArray(o.checklist), true);
  assert.strictEqual(o.checklist.length, 0);
});

test('logParaDb({aprovador, bobagem}) devolve só a coluna conhecida — chave fora do mapa não vaza crua', () => {
  const ctx = carregarPonte();
  const alvo = ctx.logParaDb({ aprovador: 'X', bobagem: 1 });
  assert.strictEqual(alvo.aprovador, 'X');
  assert.strictEqual('bobagem' in alvo, false);
  assert.strictEqual(Object.keys(alvo).length, 1);
});

// ── porta de escrita ── (manSondarEsquema / manAtualizarOS / carregarPerfil)
function carregarPortaEscrita(opts) {
  opts = opts || {};
  const updates = [];
  const usuariosConsultas = [];
  const ctx = {
    ctUser: opts.ctUser !== undefined ? opts.ctUser : null,
    _toasts: [],
    showToast(msg, tipo) { ctx._toasts.push({ msg, tipo }); },
    supa: {
      from(tabela) {
        if (tabela === 'logs_manutencao') {
          return {
            select() {
              return { limit() { return opts.erroSonda ? Promise.resolve({ error: { message: 'falhou' } }) : Promise.resolve({ error: null, data: [] }); } };
            },
            update(patch) {
              return {
                eq(col, val) {
                  return {
                    select() {
                      return {
                        single() {
                          if (opts.erroUpdate) return Promise.resolve({ error: { message: 'falhou' } });
                          updates.push({ id: val, patch });
                          const base = (opts.linhaBanco || { id: val });
                          return Promise.resolve({ error: null, data: Object.assign({}, base, patch) });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (tabela === 'usuarios') {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle() {
                      usuariosConsultas.push(1);
                      return Promise.resolve({ error: null, data: opts.perfil || null });
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
      auth: {
        getSession() {
          return Promise.resolve({ data: { session: opts.sessao || null } });
        },
      },
    },
  };
  // dependências: CAMPOS_LOG/dbToLog/logParaDb (ponte) + _logCache (camada de dados)
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  ctx._logCache = opts.logCache || {};
  vm.runInContext(recorte('/* ── fluxo da OS interna: porta de escrita ── */', '/* ── REALTIME ── */'), ctx);
  ctx._updates = updates;
  ctx._usuariosConsultas = usuariosConsultas;
  return ctx;
}

test('manSondarEsquema devolve true e MAN_FLUXO_OK true quando o select não erra', async () => {
  const ctx = carregarPortaEscrita({});
  const ok = await ctx.manSondarEsquema();
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx.MAN_FLUXO_OK, true);
});

test('manSondarEsquema devolve false e MAN_FLUXO_OK false quando o select erra, sem lançar', async () => {
  const ctx = carregarPortaEscrita({ erroSonda: true });
  let lancou = false;
  let ok;
  try { ok = await ctx.manSondarEsquema(); } catch (e) { lancou = true; }
  assert.strictEqual(lancou, false);
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx.MAN_FLUXO_OK, false);
});

test('manAtualizarOS em sucesso troca a entrada no cache pela linha nova e devolve true', async () => {
  const entradaAntiga = { id: 'log-9', status: 'ABERTA', desc: 'antigo' };
  const ctx = carregarPortaEscrita({
    logCache: { 10: [entradaAntiga] },
    linhaBanco: { id: 'log-9', equip_id: 10, status: 'ABERTA', descricao: 'antigo' },
  });
  const ok = await ctx.manAtualizarOS('log-9', 10, { status: 'DELINEAMENTO' }, 'Delineamento enviado');
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx._logCache[10][0].status, 'DELINEAMENTO');
  assert.strictEqual(ctx._toasts.filter((t) => t.tipo === 'ok').length, 1);
});

test('manAtualizarOS em erro devolve false, deixa o cache intacto e chama o toast uma vez', async () => {
  const entradaAntiga = { id: 'log-9', status: 'ABERTA' };
  const ctx = carregarPortaEscrita({ logCache: { 10: [entradaAntiga] }, erroUpdate: true });
  const ok = await ctx.manAtualizarOS('log-9', 10, { status: 'DELINEAMENTO' }, 'msg');
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx._logCache[10][0].status, 'ABERTA');
  assert.strictEqual(ctx._toasts.length, 1);
  assert.strictEqual(ctx._toasts[0].tipo, 'error');
});

test('carregarPerfil sem sessão não consulta usuário nenhum e deixa o perfil nulo', async () => {
  const ctx = carregarPortaEscrita({ sessao: null });
  await ctx.carregarPerfil();
  assert.strictEqual(ctx.ctUser, null);
  assert.strictEqual(ctx._usuariosConsultas.length, 0);
});

test('carregarPerfil com sessão consulta usuarios por auth_id e atribui a ctUser', async () => {
  const ctx = carregarPortaEscrita({ sessao: { user: { id: 'uid-1' } }, perfil: { nome: 'Fulano', role: 'gestor' } });
  await ctx.carregarPerfil();
  assert.strictEqual(ctx._usuariosConsultas.length, 1);
  assert.strictEqual(ctx.ctUser.nome, 'Fulano');
});

// ── fiação: initAppOnce / acessoLivre / ctLoad ──
test('o corpo de initAppOnce chama manSondarEsquema e carregarPerfil', () => {
  const corpo = recorte('async function initAppOnce(){', 'window.initAppOnce = initAppOnce;');
  assert.match(corpo, /await manSondarEsquema\(\)/);
  assert.match(corpo, /await carregarPerfil\(\)/);
});

test('o corpo de acessoLivre chama manSondarEsquema (perfil não, é o caso do observador)', () => {
  const corpo = recorte('async function acessoLivre() {', 'async function initAppOnce(){');
  assert.match(corpo, /await manSondarEsquema\(\)/);
});

test('o corpo de ctLoad só chama carregarPerfil quando ctUser ainda não existe, e não consulta a sessão/usuário direto', () => {
  const corpo = recorte('async function ctLoad(){', 'async function ctEnsureLoaded(){');
  assert.match(corpo, /if\(!ctUser\)\s*await carregarPerfil\(\);/);
  assert.doesNotMatch(corpo, /supa\.from\('usuarios'\)/);
});

test('o ramo de UPDATE existe no handler de realtime de logs_manutencao e substitui a entrada pelo resultado de dbToLog', () => {
  const corpo = recorte('function setupRealtime() {', 'function renderLoginMobile()');
  assert.match(corpo, /p\.eventType === 'UPDATE'/);
  assert.match(corpo, /dbToLog\(p\.new\)/);
});

// ══════════════════════════════════════════════════════════════════
// Task 2 — vocabulário, régua, transições, cargos (D-l7n-01/02/04/05/10)
// ══════════════════════════════════════════════════════════════════

function carregarVocabulario() {
  // esc() real do arquivo (utilitário fora do recorte) — reproduzido aqui para o teste
  // de escape do statusPillOS ser fiel ao comportamento real, não a um mock permissivo.
  const ctx = {
    esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
  };
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
  return ctx;
}

test('manProximos(APROVACAO) contém o seguinte, o anterior e o cancelamento — nada mais; terminais são vazios (D-l7n-04)', () => {
  const ctx = carregarVocabulario();
  const prox = ctx.manProximos('APROVACAO');
  assert.strictEqual(prox.length, 3);
  assert.ok(prox.includes('EM_EXECUCAO'));
  assert.ok(prox.includes('DELINEAMENTO'));
  assert.ok(prox.includes('CANCELADA'));
  assert.strictEqual(ctx.manProximos('CONFERIDA').length, 0);
  assert.strictEqual(ctx.manProximos('CANCELADA').length, 0);
});

test('manPodeIrPara(ABERTA,EM_EXECUCAO) é falso — não se pula a aprovação', () => {
  const ctx = carregarVocabulario();
  assert.strictEqual(ctx.manPodeIrPara('ABERTA', 'EM_EXECUCAO'), false);
});

test('manPodeCargo: aprovar/conferir só para admin/gestor; executar também para tecnico; nenhum papel de contratação aparece (D-l7n-05)', () => {
  const ctx = carregarVocabulario();
  assert.strictEqual(ctx.manPodeCargo('aprovar', 'tecnico'), false);
  assert.strictEqual(ctx.manPodeCargo('conferir', 'tecnico'), false);
  assert.strictEqual(ctx.manPodeCargo('aprovar', 'gestor'), true);
  assert.strictEqual(ctx.manPodeCargo('aprovar', 'admin'), true);
  assert.strictEqual(ctx.manPodeCargo('conferir', 'gestor'), true);
  assert.strictEqual(ctx.manPodeCargo('conferir', 'admin'), true);
  assert.strictEqual(ctx.manPodeCargo('executar', 'tecnico'), true);
  Object.keys(ctx.MAN_ACOES_CARGO).forEach((acao) => {
    ['empresa', 'fiscal', 'executor'].forEach((cargo) => {
      assert.strictEqual(ctx.manPodeCargo(acao, cargo), false, `"${cargo}" não deveria poder "${acao}"`);
    });
  });
});

test('manNormalizar traduz os três do legado, devolve intacto um status conhecido, e devolve intacto um status inventado', () => {
  const ctx = carregarVocabulario();
  assert.strictEqual(ctx.manNormalizar('PENDENTE'), 'ABERTA');
  assert.strictEqual(ctx.manNormalizar('PARCIAL'), 'EM_EXECUCAO');
  assert.strictEqual(ctx.manNormalizar('CONCLUÍDA'), 'CONFERIDA');
  assert.strictEqual(ctx.manNormalizar('APROVACAO'), 'APROVACAO');
  assert.strictEqual(ctx.manNormalizar('ESTADO_INVENTADO'), 'ESTADO_INVENTADO'); // nunca vira ABERTA por baixo do pano
});

test('manSemFluxo é verdadeiro para os três do legado e falso para os sete do fluxo novo', () => {
  const ctx = carregarVocabulario();
  ['PENDENTE', 'PARCIAL', 'CONCLUÍDA'].forEach((s) => assert.strictEqual(ctx.manSemFluxo(s), true));
  ['ABERTA', 'DELINEAMENTO', 'APROVACAO', 'EM_EXECUCAO', 'EXECUTADA', 'CONFERIDA', 'CANCELADA'].forEach((s) => {
    assert.strictEqual(ctx.manSemFluxo(s), false);
  });
});

test('manPendente conta os dois abertos do legado e os cinco estados não terminais; não conta os dois terminais nem o concluído do legado', () => {
  const ctx = carregarVocabulario();
  ['PENDENTE', 'PARCIAL'].forEach((s) => assert.strictEqual(ctx.manPendente(s), true));
  ['ABERTA', 'DELINEAMENTO', 'APROVACAO', 'EM_EXECUCAO', 'EXECUTADA'].forEach((s) => assert.strictEqual(ctx.manPendente(s), true));
  assert.strictEqual(ctx.manPendente('CONFERIDA'), false);
  assert.strictEqual(ctx.manPendente('CANCELADA'), false);
  assert.strictEqual(ctx.manPendente('CONCLUÍDA'), false);
});

test('a equivalência agrupa sem renomear (D-l7n-01/02): a pílula do concluído legado tem a palavra dele, nunca a do terminal novo; um status inventado sai escapado', () => {
  const ctx = carregarVocabulario();
  const pillLegado = ctx.statusPillOS('CONCLUÍDA');
  assert.ok(pillLegado.indexOf('CONCLUÍDA') >= 0);
  assert.ok(pillLegado.indexOf('Conferida') < 0);
  assert.strictEqual(ctx.manNormalizar('CONCLUÍDA'), 'CONFERIDA'); // mesmo caindo junto no chip "Concluída"
  const pillDesconhecido = ctx.statusPillOS('ALGO_ESTRANHO<script>');
  assert.ok(pillDesconhecido.indexOf('ALGO_ESTRANHO') >= 0);
  assert.ok(pillDesconhecido.indexOf('<script>') < 0); // esc() ativo
});

test('reguaPassos com a lista da contratação e com a lista do fluxo interno produz o número de etapas de cada uma (D-l7n-10)', () => {
  const ctx = carregarVocabulario();
  const CT_STEPS = ['Solicit.', 'Orçam.', 'Aprov.', 'Execução', 'Fiscal', 'NF', 'Encerr.'];
  const h1 = ctx.reguaPassos(2, CT_STEPS);
  const h2 = ctx.reguaPassos(2, ctx.MAN_STEPS);
  assert.strictEqual((h1.match(/ct-dot/g) || []).length, CT_STEPS.length);
  assert.strictEqual((h2.match(/ct-dot/g) || []).length, ctx.MAN_STEPS.length);
  assert.strictEqual(ctx.MAN_STEPS.length, 6);
});

test('reguaPassos(-1, …) devolve a frase de cancelamento, não a régua', () => {
  const ctx = carregarVocabulario();
  const h = ctx.reguaPassos(-1, ctx.MAN_STEPS);
  assert.ok(h.indexOf('ct-timeline') < 0);
  assert.match(h, /[Cc]ancelad/);
});

test('manClasseCard mapeia os sete estados nas quatro classes de borda', () => {
  const ctx = carregarVocabulario();
  assert.strictEqual(ctx.manClasseCard('CONFERIDA'), 'concluida');
  assert.strictEqual(ctx.manClasseCard('CANCELADA'), 'cancelada');
  assert.strictEqual(ctx.manClasseCard('ABERTA'), 'pendente');
  ['DELINEAMENTO', 'APROVACAO', 'EM_EXECUCAO', 'EXECUTADA'].forEach((s) => {
    assert.strictEqual(ctx.manClasseCard(s), 'parcial');
  });
});

test('o corpo de saveLogEntry grava o status inicial fixo e não lê o campo de status no ramo do fluxo ligado', () => {
  const corpo = recorte('async function saveLogEntry(', 'async function delLog(');
  const iniFluxo = corpo.indexOf('if (MAN_FLUXO_OK) {');
  const fimFluxo = corpo.indexOf('\n  var status=val');
  assert.ok(iniFluxo > 0 && fimFluxo > iniFluxo, 'ramo MAN_FLUXO_OK não encontrado em saveLogEntry');
  const ramoLigado = corpo.slice(iniFluxo, fimFluxo);
  assert.match(ramoLigado, /status:'ABERTA'/);
  assert.doesNotMatch(ramoLigado, /val\('log-status'\)/);
});

test('o corpo de renderOS chama manPendente( e manClasseCard(', () => {
  const corpo = recorte('function renderOS(){', 'function openNewOS(){');
  assert.match(corpo, /manPendente\(/);
  assert.match(corpo, /manClasseCard\(/);
});

test('o corpo do drawer da OS interna chama manPode( e manPodeIrPara( no mesmo bloco de cada botão de gestor', () => {
  const corpo = recorte('/* ── fluxo da OS interna: tela e ações ── */', "\n/* ═══");
  // Aprovar/Devolver e Cancelar são os botões de gestor (aprovar/conferir/cancelar, D-l7n-05).
  assert.match(corpo, /manPode\('aprovar'\)\s*&&\s*manPodeIrPara\(/);
  assert.match(corpo, /manPode\('cancelar'\)\s*&&\s*manPodeIrPara\(/);
});

// ══════════════════════════════════════════════════════════════════
// Task 3 — evidência (fotos + as 5 medições) e a conferência do gestor
// (D-l7n-08/09/11)
// ══════════════════════════════════════════════════════════════════

function carregarFluxoCompleto(opts) {
  opts = opts || {};
  const updatesLog = [];
  const updatesEquip = [];
  const uploads = [];
  const chamadas = { manAbrirOS: 0, renderOS: 0 };
  const toasts = [];

  const linhaBase = Object.assign({
    id: 'log-1', equip_id: opts.equipId !== undefined ? opts.equipId : 10,
    data_os: opts.date || '2026-08-10', status: opts.status || 'EM_EXECUCAO',
    fotos: opts.fotosIniciais || [],
  }, opts.linhaExtra || {});

  const ctx = {
    esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    el(id) { return (ctx._campos && ctx._campos[id]) || { querySelectorAll() { return []; } }; },
    val(id) { return (ctx._valores && ctx._valores[id] !== undefined) ? ctx._valores[id] : ''; },
    _valores: opts.valores || {},
    _campos: opts.campos || {},
    // 260822-48m: o ponto de chamada real trocou window._modoObservador por
    // somenteLeitura() (D-48m-01) — troca de stub, a asserção continua
    // provando que este ponto honra o modo somente-leitura.
    somenteLeitura() { return !!opts.observador; },
    ctUser: opts.ctUser !== undefined ? opts.ctUser : { nome: 'Fulano', role: 'gestor' },
    DATA: opts.data || [{ id: opts.equipId !== undefined ? opts.equipId : 10, ultimaManutencao: opts.ultimaManutencaoAtual || '', funciona: opts.funcionaAtual !== undefined ? opts.funcionaAtual : 'INOP' }],
    showToast(msg, tipo) { toasts.push({ msg, tipo }); },
    console: { warn() {}, error() {} },
    today() { return '2026-08-21'; },
    fmtDate(iso) { return iso || ''; },
    confirm() { return opts.confirmar !== false; },
    prompt() { return opts.motivoPrompt !== undefined ? opts.motivoPrompt : 'motivo'; },
    openDrawer() {}, closeDrawer() {},
    // 260821-uyz: manConferir passou a ramificar por osEhMovimentacao/
    // podeDarBaixa (definidas no bloco "movimentação", fora deste recorte
    // de manutenção) — este gate é só sobre OS de manutenção comum, então
    // os dois stubs abaixo mantêm o comportamento de sempre.
    osEhMovimentacao() { return false; },
    podeDarBaixa() { return false; },
    ctCompressFoto(file) {
      if (opts.falhaCompressao) return Promise.reject(new Error('falhou compressão'));
      return Promise.resolve({ _blob: true, nome: file && file.name });
    },
    supa: {
      from(tabela) {
        if (tabela === 'logs_manutencao') {
          return {
            update(patch) {
              return {
                eq(col, val) {
                  return {
                    select() {
                      return {
                        single() {
                          if (opts.erroUpdateLog) return Promise.resolve({ error: { message: 'falhou' } });
                          updatesLog.push({ id: val, patch });
                          return Promise.resolve({ error: null, data: Object.assign({}, linhaBase, patch) });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (tabela === 'equipamentos') {
          return {
            update(patch) {
              return { eq(col, val) { updatesEquip.push({ patch, col, val }); return Promise.resolve({ error: null }); } };
            },
          };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
      storage: {
        from(bucket) {
          return {
            upload(path, blob, cfg) {
              if (opts.falhaUpload && uploads.length === (opts.falhaNoIndice || 0)) {
                uploads.push({ path, falhou: true });
                return Promise.resolve({ error: { message: 'falhou upload' } });
              }
              uploads.push({ path, blob, cfg });
              return Promise.resolve({ error: null });
            },
            getPublicUrl(path) { return { data: { publicUrl: 'https://x/' + path } }; },
          };
        },
      },
    },
  };
  ctx._logCache = {};
  ctx._logCache[ctx.DATA[0] ? ctx.DATA[0].id : (opts.equipId !== undefined ? opts.equipId : 10)] = [Object.assign({ id: linhaBase.id, status: linhaBase.status, date: linhaBase.data_os, fotos: linhaBase.fotos }, opts.entryExtra || {})];

  vm.createContext(ctx);
  // bloco do estado do equipamento (260821-q57): atualizarEstadoEquip chama
  // normalizarEstadoEquip/equipEstado, definidos aqui — sem ele o sandbox
  // lança ReferenceError na primeira conferência aprovada.
  vm.runInContext(recorte('/* ── estado do equipamento: vocabulário OP/INOP/OR ── */', '/* ── alertas: contagem única ── */'), ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: porta de escrita ── */', '/* ── REALTIME ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
  vm.runInContext(recorte('/* ── encerramento de OS: última manutenção ── */', 'async function saveLogEntry('), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: tela e ações ── */', 'function showSearch(){'), ctx);
  // manAbrirOS/renderOS são pesadas (DOM) — mock depois de carregadas, chamado só no rodapé de cada ação.
  ctx.manAbrirOS = function () { chamadas.manAbrirOS++; };
  ctx.renderOS = function () { chamadas.renderOS++; };

  ctx._updatesLog = updatesLog;
  ctx._updatesEquip = updatesEquip;
  ctx._uploads = uploads;
  ctx._chamadas = chamadas;
  ctx._toasts = toasts;
  return ctx;
}

test('manDeltaT(12,24) devolve 12; com qualquer um dos dois ausente devolve null; quebrado sai com uma casa decimal', () => {
  const ctx = carregarVocabulario();
  assert.strictEqual(ctx.manDeltaT(12, 24), 12);
  assert.strictEqual(ctx.manDeltaT(null, 24), null);
  assert.strictEqual(ctx.manDeltaT(12, null), null);
  assert.strictEqual(ctx.manDeltaT('', ''), null);
  assert.strictEqual(ctx.manDeltaT(12.33, 24.789), 12.5);
});

test('registrar evidência numa OS que já tem duas fotos deixa a lista com as duas antigas mais as novas, na ordem, e nunca sobrescreve', async () => {
  const ctx = carregarFluxoCompleto({
    fotosIniciais: ['manutencao/log-1/a.jpg', 'manutencao/log-1/b.jpg'],
    entryExtra: { fotos: ['manutencao/log-1/a.jpg', 'manutencao/log-1/b.jpg'] },
    campos: { 'man-ex-fotos': { files: [{ name: 'c.jpg', type: 'image/jpeg' }] } },
  });
  const ok = await ctx.manRegistrarEvidencia('log-1');
  assert.strictEqual(ctx._updatesLog.length, 1);
  const fotos = ctx._updatesLog[0].patch.fotos;
  assert.strictEqual(fotos.length, 3);
  assert.strictEqual(fotos[0], 'manutencao/log-1/a.jpg');
  assert.strictEqual(fotos[1], 'manutencao/log-1/b.jpg');
  assert.ok(fotos[2].indexOf('manutencao/log-1/') === 0);
});

test('o caminho enviado ao bucket começa com o prefixo do fluxo interno e contém o id da OS', async () => {
  const ctx = carregarFluxoCompleto({ campos: { 'man-ex-fotos': { files: [{ name: 'a.jpg', type: 'image/jpeg' }] } } });
  await ctx.manRegistrarEvidencia('log-1');
  assert.strictEqual(ctx._uploads.length, 1);
  assert.match(ctx._uploads[0].path, /^manutencao\/log-1\//);
});

test('falha no upload de uma foto não impede a gravação das medições nem das demais fotos', async () => {
  const ctx = carregarFluxoCompleto({
    falhaUpload: true, falhaNoIndice: 0,
    valores: { 'man-ex-ti': '12', 'man-ex-tr': '24' },
    campos: { 'man-ex-fotos': { files: [{ name: 'a.jpg', type: 'image/jpeg' }, { name: 'b.jpg', type: 'image/jpeg' }] } },
  });
  await ctx.manRegistrarEvidencia('log-1');
  assert.strictEqual(ctx._updatesLog.length, 1);
  assert.strictEqual(ctx._updatesLog[0].patch.temp_insuflamento, 12);
  assert.strictEqual(ctx._updatesLog[0].patch.fotos.length, 1); // a primeira falhou, a segunda subiu
  assert.ok(ctx._toasts.some((t) => t.tipo === 'error'));
});

test('mais de seis arquivos: só os seis primeiros sobem; um arquivo que não é imagem é ignorado', async () => {
  const files = [];
  for (let i = 0; i < 8; i++) files.push({ name: 'f' + i + '.jpg', type: 'image/jpeg' });
  files[2] = { name: 'doc.pdf', type: 'application/pdf' }; // não é imagem, dentro dos 6 primeiros
  const ctx = carregarFluxoCompleto({ campos: { 'man-ex-fotos': { files } } });
  await ctx.manRegistrarEvidencia('log-1');
  assert.strictEqual(ctx._uploads.length, 5); // 6 primeiros, menos 1 não-imagem
});

test('manTemEvidencia é falso para OS sem foto e sem medição, verdadeiro com só uma foto, verdadeiro com só uma medição', () => {
  const ctx = carregarFluxoCompleto({});
  assert.strictEqual(ctx.manTemEvidencia({}), false);
  assert.strictEqual(ctx.manTemEvidencia({ fotos: [] }), false);
  assert.strictEqual(ctx.manTemEvidencia({ fotos: ['a.jpg'] }), true);
  assert.strictEqual(ctx.manTemEvidencia({ insuflamento: 12 }), true);
});

test('manTemEvidencia é verdadeiro com só capMarcha, com só capPartida e com só tensaoMedida (D-q57-12), e continua falso com a entrada vazia', () => {
  const ctx = carregarFluxoCompleto({});
  assert.strictEqual(ctx.manTemEvidencia({ capMarcha: 8.5 }), true);
  assert.strictEqual(ctx.manTemEvidencia({ capPartida: 40 }), true);
  assert.strictEqual(ctx.manTemEvidencia({ tensaoMedida: 220 }), true);
  assert.strictEqual(ctx.manTemEvidencia({}), false);
});

test('manMudarStatus de EM_EXECUCAO para EXECUTADA passa quando a única evidência é uma leitura de capacitor', async () => {
  const ctx = carregarFluxoCompleto({ status: 'EM_EXECUCAO', entryExtra: { fotos: [], capMarcha: 8.5 } });
  await ctx.manMudarStatus('log-1', 'EXECUTADA');
  assert.strictEqual(ctx._updatesLog.length, 1);
  assert.strictEqual(ctx._updatesLog[0].patch.status, 'EXECUTADA');
});

test('manRegistrarEvidencia grava as três medições novas sob os nomes de coluna, e omite do patch o campo deixado em branco', async () => {
  const ctx = carregarFluxoCompleto({
    status: 'EM_EXECUCAO',
    valores: { 'man-ex-cap-marcha': '8.5', 'man-ex-cap-partida': '', 'man-ex-tensao': '221' },
    campos: { 'man-ex-fotos': { files: [] } },
  });
  await ctx.manRegistrarEvidencia('log-1');
  assert.strictEqual(ctx._updatesLog.length, 1);
  const patch = ctx._updatesLog[0].patch;
  assert.strictEqual(patch.capacitor_marcha, 8.5);
  assert.strictEqual(patch.tensao_medida, 221);
  assert.strictEqual('capacitor_partida' in patch, false); // campo vazio nunca apaga leitura anterior
});

test('manMudarStatus de EM_EXECUCAO para EXECUTADA sem evidência é recusado e não chama a porta de escrita (D-l7n-09)', async () => {
  const ctx = carregarFluxoCompleto({ status: 'EM_EXECUCAO', entryExtra: { fotos: [] } });
  await ctx.manMudarStatus('log-1', 'EXECUTADA');
  assert.strictEqual(ctx._updatesLog.length, 0);
  assert.ok(ctx._toasts.some((t) => t.tipo === 'error'));
});

test('conferência aprovada grava o estado terminal, o conferente do perfil e a data de conferência, e chama a gravação de última manutenção com a data da OS', async () => {
  const ctx = carregarFluxoCompleto({
    status: 'EXECUTADA', date: '2026-08-10',
    equipId: 77, ultimaManutencaoAtual: '',
    ctUser: { nome: 'Gestora Fulana', role: 'gestor' },
  });
  const ok = await ctx.manConferir('log-1', true);
  assert.strictEqual(ok !== false, true);
  assert.strictEqual(ctx._updatesLog.length, 1);
  assert.strictEqual(ctx._updatesLog[0].patch.status, 'CONFERIDA');
  assert.strictEqual(ctx._updatesLog[0].patch.conferente, 'Gestora Fulana');
  assert.strictEqual(ctx._updatesLog[0].patch.data_conferencia, '2026-08-21'); // today() do mock
  assert.strictEqual(ctx._updatesEquip.length, 1); // sem valor no seletor: só a última manutenção é gravada
  assert.strictEqual(ctx._updatesEquip[0].patch.ultima_manutencao, '2026-08-10'); // data da OS, não a de hoje
});

test('conferência aprovada (D-q57-04) chama atualizarEstadoEquip com o valor do seletor, gravando funciona junto de ultima_manutencao', async () => {
  const ctx = carregarFluxoCompleto({
    status: 'EXECUTADA', date: '2026-08-10',
    equipId: 77, ultimaManutencaoAtual: '', funcionaAtual: 'INOP',
    ctUser: { nome: 'Gestora Fulana', role: 'gestor' },
    valores: { 'man-conf-estado': 'OP' },
  });
  await ctx.manConferir('log-1', true);
  assert.strictEqual(ctx._updatesEquip.length, 2); // ultima_manutencao + funciona
  const patchEstado = ctx._updatesEquip.find((u) => 'funciona' in u.patch);
  assert.ok(patchEstado, 'nenhum update de equipamentos gravou funciona');
  assert.strictEqual(patchEstado.patch.funciona, 'OP');
});

test('atualizarEstadoEquip não grava quando o estado escolhido é igual ao atual, quando é vazio, e quando está fora da lista fechada — três chamadas, nenhuma escrita', async () => {
  const ctx = carregarFluxoCompleto({ funcionaAtual: 'OP' });
  const r1 = await ctx.atualizarEstadoEquip(10, 'OP'); // igual ao atual
  const r2 = await ctx.atualizarEstadoEquip(10, ''); // vazio
  const r3 = await ctx.atualizarEstadoEquip(10, 'ESTRANHO'); // fora da lista fechada
  assert.strictEqual(r1, false);
  assert.strictEqual(r2, false);
  assert.strictEqual(r3, false);
  assert.strictEqual(ctx._updatesEquip.length, 0);
});

test('a devolução (aprovado falso) não chama atualizarEstadoEquip — uma OS devolvida não concluiu nada', async () => {
  const ctx = carregarFluxoCompleto({
    status: 'EXECUTADA', funcionaAtual: 'INOP',
    valores: { 'man-conf-parecer': 'faltou uma peça', 'man-conf-estado': 'OP' },
  });
  await ctx.manConferir('log-1', false);
  assert.strictEqual(ctx._updatesEquip.length, 0);
});

test('conferência com parecer vazio na devolução não grava nada; com parecer, volta um estado e mantém a lista de fotos intacta', async () => {
  const semParecer = carregarFluxoCompleto({ status: 'EXECUTADA', valores: {} });
  await semParecer.manConferir('log-1', false);
  assert.strictEqual(semParecer._updatesLog.length, 0);
  assert.ok(semParecer._toasts.some((t) => t.tipo === 'error'));

  const comParecer = carregarFluxoCompleto({
    status: 'EXECUTADA',
    fotosIniciais: ['manutencao/log-1/a.jpg'],
    entryExtra: { fotos: ['manutencao/log-1/a.jpg'] },
    valores: { 'man-conf-parecer': 'faltou uma peça' },
  });
  await comParecer.manConferir('log-1', false);
  assert.strictEqual(comParecer._updatesLog.length, 1);
  assert.strictEqual(comParecer._updatesLog[0].patch.status, 'EM_EXECUCAO');
  assert.strictEqual(comParecer._updatesLog[0].patch.parecer_conferencia, 'faltou uma peça');
  assert.strictEqual('fotos' in comParecer._updatesLog[0].patch, false); // não toca em foto nem medição
});

test('um técnico chamando a conferência direto (sem passar pelo botão) é recusado — a guarda de cargo está na ação', async () => {
  const ctx = carregarFluxoCompleto({ status: 'EXECUTADA', ctUser: { nome: 'Técnico Fulano', role: 'tecnico' } });
  await ctx.manConferir('log-1', true);
  assert.strictEqual(ctx._updatesLog.length, 0);
  assert.ok(ctx._toasts.some((t) => t.tipo === 'error'));
});

test('os quatro grep do PLAT-15 continuam em 0', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
