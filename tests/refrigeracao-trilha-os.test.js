// Gate da trilha de auditoria da OS unificada — quick 260821-jpd, Task 3,
// reescrito por 260823-cf8 (D-cf8-15/22/28).
//
// 260823-cf8: a trilha deixou de morar em os_eventos, gravada por ctUpd
// (removida) — agora é a MESMA tabela do comentário do usuário,
// os_comentarios, distinguida por origem='sistema' (D-cf8-15), gravada
// por osRegistrarEvento a partir de um ÚNICO ponto: manAtualizarOS,
// sempre que o patch contém status. A pergunta continua a mesma ("cada
// transição deixa um registro assinado"), só o alvo mudou. O texto do
// registro reusa a forma que a antiga ctDetalheEvento produzia (rótulo
// anterior → rótulo novo, via osDetalheEvento/osRotulo) — a MENSAGEM que
// o chamador passa (ex.: "OS aprovada") continua indo só para o toast,
// nunca para a trilha, como já era antes (D-jpd: evento != mensagem de
// toast).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

function carregarSandbox(opts) {
  opts = opts || {};
  const updatesLog = [];
  const insertsComentarios = [];
  const toasts = [];
  const warns = [];

  const linhaBase = { id: 'log-1', equip_id: 10 };

  const ctx = {
    esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    ctUser: opts.ctUser !== undefined ? opts.ctUser : { nome: 'Fulano', role: 'gestor' },
    showToast(msg, tipo) { toasts.push({ msg, tipo }); },
    console: { warn(...args) { warns.push(args); }, error() {} },
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
        if (tabela === 'os_comentarios') {
          return {
            insert(payload) {
              return {
                select() {
                  return {
                    single() {
                      if (opts.erroInsertComentario) return Promise.resolve({ error: { message: 'falhou' } });
                      const linha = Object.assign({ id: 'com-' + (insertsComentarios.length + 1), criado_em: '2026-08-21T12:00:00Z' }, payload);
                      insertsComentarios.push(linha);
                      return Promise.resolve({ error: null, data: linha });
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
    },
  };
  ctx._logCache = {};
  ctx._logCache[linhaBase.equip_id] = [Object.assign({ id: linhaBase.id }, opts.entryInicial || {})];

  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: porta de escrita ── */', '/* ── REALTIME ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
  // UNI_OK é "var" dentro da porta de escrita — setado DEPOIS dos
  // runInContext, senão a própria declaração sobrescreve para false
  // (o mesmo cuidado já registrado em tests/refrigeracao-os-unificada.test.js).
  ctx.UNI_OK = opts.uniOk !== undefined ? opts.uniOk : true;

  ctx._updatesLog = updatesLog;
  ctx._insertsComentarios = insertsComentarios;
  ctx._toasts = toasts;
  ctx._warns = warns;
  return ctx;
}

test('manAtualizarOS lê o status anterior ANTES do update — DELINEAMENTO→APROVACAO grava o detalhe correto, não X → X', async () => {
  const ctx = carregarSandbox({ entryInicial: { status: 'DELINEAMENTO', tipoExecutor: 'interna' } });
  await ctx.manAtualizarOS('log-1', 10, { status: 'APROVACAO' }, 'msg qualquer');
  assert.strictEqual(ctx._insertsComentarios.length, 1);
  assert.strictEqual(ctx._insertsComentarios[0].texto, 'Em delineamento → Aguardando aprovação do gestor');
  assert.strictEqual(ctx._insertsComentarios[0].origem, 'sistema');
});

test('a mensagem passada pelo chamador vai só para o toast — a trilha grava o rótulo anterior → rótulo novo, nunca a mensagem', async () => {
  const ctx = carregarSandbox({ entryInicial: { status: 'APROVACAO', tipoExecutor: 'interna' } });
  await ctx.manAtualizarOS('log-1', 10, { status: 'EM_EXECUCAO' }, 'Execução iniciada');
  assert.strictEqual(ctx._insertsComentarios[0].texto, 'Aguardando aprovação do gestor → Em execução');
  assert.strictEqual(ctx._toasts.some((t) => t.msg === 'Execução iniciada' && t.tipo === 'ok'), true);
});

test('status anterior desconhecido (OS nunca vista antes no cache) produz — no lado esquerdo, sem lançar exceção', async () => {
  const ctx = carregarSandbox({ entryInicial: undefined }); // cache sem status prévio
  ctx._logCache[10] = [{ id: 'log-1' }]; // entrada existe, mas sem status
  await ctx.manAtualizarOS('log-1', 10, { status: 'DELINEAMENTO' }, 'msg');
  assert.strictEqual(ctx._insertsComentarios.length, 1);
  assert.match(ctx._insertsComentarios[0].texto, /^— →/);
});

test('patch sem mudança de status não grava trilha nenhuma — nem um "X → X" falso, nem um registro vazio', async () => {
  const ctx = carregarSandbox({ entryInicial: { status: 'EM_EXECUCAO', tipoExecutor: 'contrato' } });
  await ctx.manAtualizarOS('log-1', 10, { fiscal: 'Fulano', parecerFiscal: 'ok' }, 'Devolvida p/ correção');
  assert.strictEqual(ctx._insertsComentarios.length, 0);
});

test('sem UNI_OK, manAtualizarOS não grava trilha nenhuma — os_comentarios não existe sem a migração 43', async () => {
  const ctx = carregarSandbox({ uniOk: false, entryInicial: { status: 'DELINEAMENTO', tipoExecutor: 'interna' } });
  await ctx.manAtualizarOS('log-1', 10, { status: 'APROVACAO' }, 'msg');
  assert.strictEqual(ctx._insertsComentarios.length, 0);
  assert.strictEqual(ctx._updatesLog.length, 1); // a OS em si grava normalmente
});

test('insert de os_comentarios com erro: manAtualizarOS ainda devolve true e o toast de sucesso foi chamado uma vez (D-jpd-05)', async () => {
  const ctx = carregarSandbox({ entryInicial: { status: 'DELINEAMENTO', tipoExecutor: 'interna' }, erroInsertComentario: true });
  const ok = await ctx.manAtualizarOS('log-1', 10, { status: 'APROVACAO' }, 'msg');
  assert.strictEqual(ok, true);
  const toastsSucesso = ctx._toasts.filter((t) => t.tipo === 'ok');
  assert.strictEqual(toastsSucesso.length, 1);
  assert.strictEqual(ctx._warns.length, 1); // trilha falhou em silêncio, sem alerta por cima (mesmo D-jpd-05 de sempre)
});

test('em sucesso, OS_COMENTARIOS[osId] passa a conter a linha nova (D-jpd-06, sem recarga)', async () => {
  const ctx = carregarSandbox({ entryInicial: { status: 'DELINEAMENTO', tipoExecutor: 'interna' } });
  await ctx.manAtualizarOS('log-1', 10, { status: 'APROVACAO' }, 'msg');
  assert.strictEqual((ctx.OS_COMENTARIOS['log-1'] || []).length, 1);
  assert.strictEqual(ctx.OS_COMENTARIOS['log-1'][0].origem, 'sistema');
});

test('osRegistrarEvento grava o autor e o cargo do usuário logado', async () => {
  const ctx = carregarSandbox({ entryInicial: { status: 'DELINEAMENTO', tipoExecutor: 'interna' }, ctUser: { nome: 'Gestora Fulana', role: 'gestor' } });
  await ctx.manAtualizarOS('log-1', 10, { status: 'APROVACAO' }, 'msg');
  assert.strictEqual(ctx._insertsComentarios[0].autor, 'Gestora Fulana');
  assert.strictEqual(ctx._insertsComentarios[0].cargo, 'gestor');
});

test('nenhuma chamada a os_eventos sobrevive no arquivo — a trilha é os_comentarios, sempre (D-cf8-22)', () => {
  assert.doesNotMatch(HTML, /supa\.from\('os_eventos'\)/);
  assert.doesNotMatch(HTML, /supa\.from\("os_eventos"\)/);
});

test('os quatro grep do PLAT-15 continuam em 0', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
