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
const SQL_04 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '04_refrigeracao_schema.sql'), 'utf8');

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

test('todo valor de CAMPOS_LOG é uma coluna real (união das colunas da migração 04 com as da 40)', () => {
  const ctx = carregarPonte();
  const colunasReais = colunasLogsManutencao04().concat(colunasNovasMigracao40());
  Object.keys(ctx.CAMPOS_LOG).forEach((k) => {
    const col = ctx.CAMPOS_LOG[k];
    assert.ok(colunasReais.includes(col), `CAMPOS_LOG.${k} = "${col}" não é coluna real de logs_manutencao`);
  });
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

test('os quatro grep do PLAT-15 continuam em 0', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
