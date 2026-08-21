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

test('os quatro grep do PLAT-15 continuam em 0', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
