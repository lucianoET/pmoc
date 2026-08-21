// Gate da trilha de auditoria de os_eventos gravada por ctUpd — quick 260821-jpd, Task 3.
//
// Dois recortes do HTML — a tabela CT_STATUS (para o teste provar que os rótulos usados
// são os reais, não inventados) e a região /* ══ AÇÕES ══ */ → async function
// ctMudarStatus( — avaliados juntos num sandbox node:vm com supa falso (registrando os
// payloads de update de os_contratacao e de insert em os_eventos), showToast, ctOS,
// ctUser e ctEvt controlados.

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
  const updates = [];
  const inserts = [];

  const ctx = {
    ctOS: opts.ctOS || [],
    ctUser: opts.ctUser !== undefined ? opts.ctUser : null,
    ctEvt: {},
    _warns: [],
    _toasts: [],
    console: { warn(...args) { ctx._warns.push(args); } },
    showToast(msg, tipo) { ctx._toasts.push({ msg, tipo }); },
    supa: {
      from(tabela) {
        if (tabela === 'os_contratacao') {
          return {
            update(patch) {
              return {
                eq(col, val) {
                  return {
                    select() {
                      return {
                        single() {
                          if (opts.erroUpdate) return Promise.resolve({ error: { message: 'falhou' } });
                          const base = (opts.ctOS || []).find((o) => o.id === val) || {};
                          const novo = Object.assign({}, base, patch);
                          updates.push({ id: val, patch });
                          return Promise.resolve({ error: null, data: novo });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (tabela === 'os_eventos') {
          return {
            insert(payload) {
              return {
                select() {
                  return {
                    single() {
                      if (opts.erroInsertEvento) return Promise.resolve({ error: { message: 'falhou' } });
                      const linha = Object.assign({ id: 'ev-' + (inserts.length + 1), criado_em: '2026-08-21T12:00:00Z' }, payload);
                      inserts.push(linha);
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
  vm.createContext(ctx);
  vm.runInContext(recorte('var CT_STATUS = {', 'var CT_STEPS ='), ctx);
  vm.runInContext(recorte('/* ══ AÇÕES ══ */', 'async function ctMudarStatus('), ctx);
  ctx._updates = updates;
  ctx._inserts = inserts;
  return ctx;
}

test('ctUpd lê o status anterior ANTES do update — SOLICITADA→ORCAMENTO grava o detalhe correto, não X → X', async () => {
  const ctx = carregarSandbox({ ctOS: [{ id: 'os-1', status: 'SOLICITADA' }] });
  await ctx.ctUpd('os-1', { status: 'ORCAMENTO' }, 'Status: Orçamento p/ aprovação');
  assert.strictEqual(ctx._inserts.length, 1);
  assert.strictEqual(ctx._inserts[0].detalhe, 'Aguard. orçamento → Orçamento p/ aprovação');
});

test('o evento gravado é a mensagem passada pelo chamador', async () => {
  const ctx = carregarSandbox({ ctOS: [{ id: 'os-1', status: 'APROVADA' }] });
  await ctx.ctUpd('os-1', { status: 'EM_EXECUCAO' }, 'Execução iniciada');
  assert.strictEqual(ctx._inserts[0].evento, 'Execução iniciada');
});

test('status anterior desconhecido produz — no lado esquerdo, sem lançar exceção', async () => {
  const ctx = carregarSandbox({ ctOS: [{ id: 'os-2' }] }); // sem status prévio
  await ctx.ctUpd('os-2', { status: 'ORCAMENTO' }, 'Status: Orçamento p/ aprovação');
  assert.strictEqual(ctx._inserts.length, 1);
  assert.match(ctx._inserts[0].detalhe, /^— →/);
});

test('patch sem mudança de status grava evento com detalhe nulo/vazio, não um X → X falso', async () => {
  const ctx = carregarSandbox({ ctOS: [{ id: 'os-3', status: 'EM_EXECUCAO' }] });
  await ctx.ctUpd('os-3', { fiscal: 'Fulano', parecer_fiscal: 'ok' }, 'Devolvida p/ correção');
  assert.strictEqual(ctx._inserts.length, 1);
  assert.ok(!ctx._inserts[0].detalhe, 'detalhe deveria ser nulo/vazio sem mudança de status');
});

test('ctUsuarioEvento devolve nome+cargo, nome puro sem cargo, e vazio sem usuário', () => {
  const ctx = carregarSandbox({});
  assert.strictEqual(ctx.ctUsuarioEvento({ nome: 'Fulano', role: 'gestor' }), 'Fulano (gestor)');
  assert.strictEqual(ctx.ctUsuarioEvento({ nome: 'Fulano' }), 'Fulano');
  assert.strictEqual(ctx.ctUsuarioEvento(null), '');
});

test('insert de os_eventos com erro: ctUpd ainda devolve true e o toast de sucesso foi chamado uma vez (D-jpd-05)', async () => {
  const ctx = carregarSandbox({ ctOS: [{ id: 'os-4', status: 'SOLICITADA' }], erroInsertEvento: true });
  const ok = await ctx.ctUpd('os-4', { status: 'ORCAMENTO' }, 'Status: Orçamento p/ aprovação');
  assert.strictEqual(ok, true);
  const toastsSucesso = ctx._toasts.filter((t) => t.tipo === 'ok');
  assert.strictEqual(toastsSucesso.length, 1);
  assert.strictEqual(ctx._warns.length, 1); // trilha falhou em silêncio, sem alert por cima
});

test('em sucesso, ctEvt[osId] passa a conter a linha nova (D-jpd-06, sem recarga)', async () => {
  const ctx = carregarSandbox({ ctOS: [{ id: 'os-5', status: 'SOLICITADA' }] });
  await ctx.ctUpd('os-5', { status: 'ORCAMENTO' }, 'Status: Orçamento p/ aprovação');
  assert.strictEqual((ctx.ctEvt['os-5'] || []).length, 1);
  assert.strictEqual(ctx.ctEvt['os-5'][0].evento, 'Status: Orçamento p/ aprovação');
});

test('os quatro grep do PLAT-15 continuam em 0', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
