// Gate da OS unificada por tipo de executor (/refrigeracao) — quick task
// 260823-cf8, Task 1: núcleo puro de fluxo por definição de etapas
// (OS_FLUXOS/osFluxoDe/osProximos/…), a migração 43 e a sonda UNI_OK — a
// tela não muda nesta tarefa (D-cf8-13/25).
//
// Mesmo padrão de tests/refrigeracao-fluxo-os-interna.test.js: recorte do
// HTML avaliado em sandbox node:vm, e leitura das migrações SQL para
// comparar CAMPOS_LOG coluna a coluna com o banco real.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');
const SQL_04 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '04_refrigeracao_schema.sql'), 'utf8');
const SQL_40 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '40_refrigeracao_os_fluxo.sql'), 'utf8');
const SQL_41 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '41_refrigeracao_ficha_estado.sql'), 'utf8');
const SQL_42 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '42_refrigeracao_movimentacao.sql'), 'utf8');
const SQL_43 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '43_refrigeracao_os_unificada.sql'), 'utf8');

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

// Objetos criados DENTRO do sandbox (node:vm) têm Object.prototype/Array.prototype
// de outro realm — deepStrictEqual falha por "mesma estrutura, não referência-igual"
// mesmo com conteúdo idêntico (mesma armadilha de tests/refrigeracao-desktop.test.js).
function eq(actual, expected, message) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

// ── colunas conhecidas de logs_manutencao (migração 04) ──
function colunasLogsManutencao04() {
  const ini = SQL_04.indexOf('create table if not exists logs_manutencao');
  const abre = SQL_04.indexOf('(', ini);
  const fim = SQL_04.indexOf(');', ini);
  assert.ok(ini > 0 && fim > ini, 'logs_manutencao não encontrada em 04_refrigeracao_schema.sql');
  const corpo = SQL_04.slice(abre + 1, fim);
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

function colunasNovasDe(sql) {
  const re = /alter table logs_manutencao add column if not exists (\w+)/g;
  const nomes = [];
  let m;
  while ((m = re.exec(sql))) nomes.push(m[1]);
  return nomes;
}

// ── carrega o vocabulário antigo + o núcleo novo, num sandbox só ──
// A seção nova (D-cf8) fica logo depois da antiga, antes de loadData( —
// um recorte só captura as duas, e é isso que permite testar como as
// cascas finas (manEhTerminal/manClasseCard/…) resolvem o fluxo por
// osFluxoDe, sem duplicar o sandbox.
function carregarTudo(uniOk) {
  const ctx = {
    UNI_OK: !!uniOk,
    esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
  };
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
  return ctx;
}

// ── ponte de campos (CAMPOS_LOG) ──
function carregarPonte() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  return ctx;
}

// ══════════════════════════════════════════════════════════════════
// OS_EXECUTORES / osTipoExecutor
// ══════════════════════════════════════════════════════════════════

test('OS_EXECUTORES é a lista fechada de três, e osTipoExecutor nunca lança', () => {
  const ctx = carregarTudo(true);
  eq(ctx.OS_EXECUTORES, ['interna', 'externa', 'contrato']);
  assert.doesNotThrow(() => ctx.osTipoExecutor());
  assert.strictEqual(ctx.osTipoExecutor(undefined), 'interna');
  assert.strictEqual(ctx.osTipoExecutor(null), 'interna');
  assert.strictEqual(ctx.osTipoExecutor({}), 'interna');
  assert.strictEqual(ctx.osTipoExecutor({ tipoExecutor: null }), 'interna');
  assert.strictEqual(ctx.osTipoExecutor({ tipoExecutor: undefined }), 'interna');
  assert.strictEqual(ctx.osTipoExecutor({ tipoExecutor: 'alienigena' }), 'interna');
  assert.strictEqual(ctx.osTipoExecutor({ tipoExecutor: 'externa' }), 'externa');
  assert.strictEqual(ctx.osTipoExecutor({ tipoExecutor: 'contrato' }), 'contrato');
});

// ══════════════════════════════════════════════════════════════════
// OS_FLUXOS — identidade (D-cf8-09)
// ══════════════════════════════════════════════════════════════════

test('OS_FLUXOS.interna e OS_FLUXOS.externa são o MESMO objeto (identidade); contrato é outro', () => {
  const ctx = carregarTudo(true);
  assert.strictEqual(ctx.OS_FLUXOS.interna, ctx.OS_FLUXOS.externa);
  assert.strictEqual(ctx.OS_FLUXOS.interna, ctx.FLUXO_PROPRIO);
  assert.notStrictEqual(ctx.OS_FLUXOS.interna, ctx.OS_FLUXOS.contrato);
  assert.strictEqual(ctx.OS_FLUXOS.contrato, ctx.FLUXO_CONTRATO);
});

// ══════════════════════════════════════════════════════════════════
// Forma dos dois fluxos novos
// ══════════════════════════════════════════════════════════════════

test('os quatro primeiros ids de etapa de FLUXO_PROPRIO e FLUXO_CONTRATO são iguais e na mesma ordem', () => {
  const ctx = carregarTudo(true);
  const quatroProprio = ctx.osEtapas(ctx.FLUXO_PROPRIO).slice(0, 4);
  const quatroContrato = ctx.osEtapas(ctx.FLUXO_CONTRATO).slice(0, 4);
  const esperado = ['ABERTA', 'DELINEAMENTO', 'APROVACAO', 'EM_EXECUCAO'];
  eq(quatroProprio, esperado);
  eq(quatroContrato, esperado);
});

test('FLUXO_PROPRIO tem 5 etapas e termina em CONCLUIDA; FLUXO_CONTRATO tem 7 e termina em ENCERRADA; nenhum dos dois contém CONFERIDA', () => {
  const ctx = carregarTudo(true);
  const idsProprio = ctx.osEtapas(ctx.FLUXO_PROPRIO);
  const idsContrato = ctx.osEtapas(ctx.FLUXO_CONTRATO);
  assert.strictEqual(idsProprio.length, 5);
  assert.strictEqual(idsProprio[idsProprio.length - 1], 'CONCLUIDA');
  assert.strictEqual(idsContrato.length, 7);
  assert.strictEqual(idsContrato[idsContrato.length - 1], 'ENCERRADA');
  assert.strictEqual(idsProprio.includes('CONFERIDA'), false);
  assert.strictEqual(idsContrato.includes('CONFERIDA'), false);
});

// ══════════════════════════════════════════════════════════════════
// osProximos
// ══════════════════════════════════════════════════════════════════

test('osProximos devolve seguinte + anterior + cancelamento; lista vazia nos dois terminais de cada fluxo', () => {
  const ctx = carregarTudo(true);
  const prox = ctx.osProximos(ctx.FLUXO_PROPRIO, 'DELINEAMENTO');
  assert.strictEqual(prox.length, 3);
  assert.ok(prox.includes('APROVACAO'));
  assert.ok(prox.includes('ABERTA'));
  assert.ok(prox.includes('CANCELADA'));

  assert.strictEqual(ctx.osProximos(ctx.FLUXO_PROPRIO, 'CONCLUIDA').length, 0);
  assert.strictEqual(ctx.osProximos(ctx.FLUXO_PROPRIO, 'CANCELADA').length, 0);
  assert.strictEqual(ctx.osProximos(ctx.FLUXO_CONTRATO, 'ENCERRADA').length, 0);
  assert.strictEqual(ctx.osProximos(ctx.FLUXO_CONTRATO, 'CANCELADA').length, 0);
});

test('o mesmo estado em fluxos diferentes tem próximos diferentes: EM_EXECUCAO leva a CONCLUIDA na própria e a EXECUTADA na de contrato', () => {
  const ctx = carregarTudo(true);
  const proxProprio = ctx.osProximos(ctx.FLUXO_PROPRIO, 'EM_EXECUCAO');
  const proxContrato = ctx.osProximos(ctx.FLUXO_CONTRATO, 'EM_EXECUCAO');
  assert.ok(proxProprio.includes('CONCLUIDA'));
  assert.ok(!proxProprio.includes('EXECUTADA'));
  assert.ok(proxContrato.includes('EXECUTADA'));
  assert.ok(!proxContrato.includes('CONCLUIDA'));
});

test('osPodeIrPara(FLUXO_PROPRIO, ABERTA, EM_EXECUCAO) é falso — não se pula etapa', () => {
  const ctx = carregarTudo(true);
  assert.strictEqual(ctx.osPodeIrPara(ctx.FLUXO_PROPRIO, 'ABERTA', 'EM_EXECUCAO'), false);
  assert.strictEqual(ctx.osPodeIrPara(ctx.FLUXO_PROPRIO, 'ABERTA', 'DELINEAMENTO'), true);
});

// ══════════════════════════════════════════════════════════════════
// Rótulo por fluxo (o mesmo id, palavras diferentes)
// ══════════════════════════════════════════════════════════════════

test('um mesmo id de etapa tem rótulo diferente por fluxo (DELINEAMENTO)', () => {
  const ctx = carregarTudo(true);
  const rotuloProprio = ctx.osRotulo(ctx.FLUXO_PROPRIO, 'DELINEAMENTO');
  const rotuloContrato = ctx.osRotulo(ctx.FLUXO_CONTRATO, 'DELINEAMENTO');
  assert.strictEqual(rotuloProprio, 'Em delineamento');
  assert.strictEqual(rotuloContrato, 'Orçamento em elaboração');
  assert.notStrictEqual(rotuloProprio, rotuloContrato);
});

// ══════════════════════════════════════════════════════════════════
// UNI_OK falso → fluxo legado, para qualquer tipo
// ══════════════════════════════════════════════════════════════════

test('com UNI_OK falso, osFluxoDe devolve o fluxo legado de 6 etapas terminando em CONFERIDA, para qualquer tipo de executor', () => {
  const ctx = carregarTudo(false);
  ['interna', 'externa', 'contrato', undefined, 'alienigena'].forEach((t) => {
    const f = ctx.osFluxoDe({ tipoExecutor: t });
    assert.strictEqual(f, ctx.FLUXO_LEGADO, `tipo "${t}" não devolveu FLUXO_LEGADO com UNI_OK falso`);
  });
  const ids = ctx.osEtapas(ctx.FLUXO_LEGADO);
  assert.strictEqual(ids.length, 6);
  assert.strictEqual(ids[ids.length - 1], 'CONFERIDA');
});

test('com UNI_OK verdadeiro, osFluxoDe devolve FLUXO_PROPRIO para interna/externa e FLUXO_CONTRATO para contrato', () => {
  const ctx = carregarTudo(true);
  assert.strictEqual(ctx.osFluxoDe({ tipoExecutor: 'interna' }), ctx.FLUXO_PROPRIO);
  assert.strictEqual(ctx.osFluxoDe({ tipoExecutor: 'externa' }), ctx.FLUXO_PROPRIO);
  assert.strictEqual(ctx.osFluxoDe({ tipoExecutor: 'contrato' }), ctx.FLUXO_CONTRATO);
  assert.strictEqual(ctx.osFluxoDe({}), ctx.FLUXO_PROPRIO); // sem tipo → interna, o padrão
});

// ══════════════════════════════════════════════════════════════════
// OS_SINONIMOS (D-cf8-11)
// ══════════════════════════════════════════════════════════════════

test('OS_SINONIMOS lê CONFERIDA como CONCLUIDA — uma OS própria antiga (status CONFERIDA) é enxergada como terminal concluído', () => {
  const ctx = carregarTudo(true);
  assert.strictEqual(ctx.OS_SINONIMOS.CONFERIDA, 'CONCLUIDA');
  assert.strictEqual(ctx.osEhTerminal(ctx.FLUXO_PROPRIO, 'CONFERIDA'), true);
  assert.strictEqual(ctx.osRotulo(ctx.FLUXO_PROPRIO, 'CONFERIDA'), 'Concluída');
  // sob o fluxo legado (que TEM CONFERIDA como etapa própria), o literal
  // resolve direto — o sinônimo não pode desviar o que já é conhecido.
  assert.strictEqual(ctx.osEhTerminal(ctx.FLUXO_LEGADO, 'CONFERIDA'), true);
  assert.strictEqual(ctx.osRotulo(ctx.FLUXO_LEGADO, 'CONFERIDA'), 'Conferida');
});

test('manSemFluxo distingue CONFERIDA (não é registro direto) de CONCLUÍDA com acento (é registro direto, legado)', () => {
  const ctx = carregarTudo(true);
  assert.strictEqual(ctx.manSemFluxo('CONFERIDA'), false);
  assert.strictEqual(ctx.manSemFluxo('CONCLUÍDA'), true);
});

// ══════════════════════════════════════════════════════════════════
// osTotalItens
// ══════════════════════════════════════════════════════════════════

test('osTotalItens soma quantidade × valor unitário tratando valor nulo como zero, e devolve 0 para lista vazia', () => {
  const ctx = carregarTudo(true);
  assert.strictEqual(ctx.osTotalItens([]), 0);
  assert.strictEqual(ctx.osTotalItens(undefined), 0);
  assert.strictEqual(ctx.osTotalItens([{ quantidade: 2, valorUnitario: 10 }, { quantidade: 3, valorUnitario: 5 }]), 35);
  assert.strictEqual(ctx.osTotalItens([{ quantidade: 2, valorUnitario: null }]), 0);
  assert.strictEqual(ctx.osTotalItens([{ quantidade: 2 }]), 0);
});

// ══════════════════════════════════════════════════════════════════
// osRotuloExecutor
// ══════════════════════════════════════════════════════════════════

test('osRotuloExecutor devolve o rótulo em português do tipo, e cai em interna sem tipo', () => {
  const ctx = carregarTudo(true);
  assert.strictEqual(ctx.osRotuloExecutor({ tipoExecutor: 'contrato' }), ctx.OS_EXECUTOR_ROTULOS.contrato);
  assert.strictEqual(ctx.osRotuloExecutor({}), ctx.OS_EXECUTOR_ROTULOS.interna);
});

// ══════════════════════════════════════════════════════════════════
// CAMPOS_LOG — cobertura exata da união 04+40+41+42+43
// ══════════════════════════════════════════════════════════════════

test('CAMPOS_LOG cobre exatamente as colunas de logs_manutencao da união das migrações 04+40+41+42+43, sem sobra e sem falta (exceto campanha_id)', () => {
  const ctx = carregarPonte();
  const uniao = colunasLogsManutencao04()
    .concat(colunasNovasDe(SQL_40), colunasNovasDe(SQL_41), colunasNovasDe(SQL_42), colunasNovasDe(SQL_43))
    .filter((c) => c !== 'campanha_id');
  const valores = Object.keys(ctx.CAMPOS_LOG).map((k) => ctx.CAMPOS_LOG[k]);

  uniao.forEach((col) => assert.ok(valores.includes(col), `coluna real "${col}" não está em CAMPOS_LOG`));
  valores.forEach((col) => assert.ok(uniao.includes(col), `CAMPOS_LOG aponta para "${col}", que não é coluna real de logs_manutencao (nem campanha_id)`));
});

test('as 18 colunas novas da migração 43 aparecem como valor em CAMPOS_LOG', () => {
  const ctx = carregarPonte();
  const novas43 = colunasNovasDe(SQL_43);
  assert.strictEqual(novas43.length, 18, `migração 43 deveria criar 18 colunas novas, achou ${novas43.length}`);
  const valores = Object.keys(ctx.CAMPOS_LOG).map((k) => ctx.CAMPOS_LOG[k]);
  novas43.forEach((col) => assert.ok(valores.includes(col), `coluna nova "${col}" não está em CAMPOS_LOG`));
});

// ══════════════════════════════════════════════════════════════════
// UNI_OK / uniSondarEsquema (D-cf8-13: duas leituras, uma pergunta)
// ══════════════════════════════════════════════════════════════════

function carregarPortaEscritaUni(opts) {
  opts = opts || {};
  const chamadas = [];
  const ctx = {
    supa: {
      from(tabela) {
        chamadas.push(tabela);
        if (tabela === 'logs_manutencao') {
          return { select() { return { limit() { return (opts.erroLogs) ? Promise.resolve({ error: { message: 'falhou' } }) : Promise.resolve({ error: null, data: [] }); } }; } };
        }
        if (tabela === 'os_itens') {
          return { select() { return { limit() { return (opts.erroItens) ? Promise.resolve({ error: { message: 'falhou' } }) : Promise.resolve({ error: null, data: [] }); } }; } };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: porta de escrita ── */', '/* ── REALTIME ── */'), ctx);
  ctx._chamadas = chamadas;
  return ctx;
}

test('uniSondarEsquema devolve true e UNI_OK true quando as duas leituras passam', async () => {
  const ctx = carregarPortaEscritaUni({});
  const ok = await ctx.uniSondarEsquema();
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx.UNI_OK, true);
  assert.ok(ctx._chamadas.includes('logs_manutencao'));
  assert.ok(ctx._chamadas.includes('os_itens'));
});

test('uniSondarEsquema devolve false sem lançar quando a leitura de logs_manutencao falha', async () => {
  const ctx = carregarPortaEscritaUni({ erroLogs: true });
  let lancou = false;
  let ok;
  try { ok = await ctx.uniSondarEsquema(); } catch (e) { lancou = true; }
  assert.strictEqual(lancou, false);
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx.UNI_OK, false);
});

test('uniSondarEsquema devolve false quando a leitura de os_itens falha, mesmo com logs_manutencao passando', async () => {
  const ctx = carregarPortaEscritaUni({ erroItens: true });
  const ok = await ctx.uniSondarEsquema();
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx.UNI_OK, false);
});

// ══════════════════════════════════════════════════════════════════
// addLogEntryAsync — extraUni só quando UNI_OK (D-cf8-13, mesmo padrão de extraMov)
// ══════════════════════════════════════════════════════════════════

function carregarCamadaDados(opts) {
  opts = opts || {};
  const inserts = [];
  const ctx = {
    UNI_OK: !!opts.uniOk,
    _logCache: {},
    showToast() {},
    supa: {
      from(tabela) {
        if (tabela === 'logs_manutencao') {
          return {
            insert(payload) {
              return {
                select() {
                  return {
                    single() {
                      inserts.push(payload);
                      return Promise.resolve({ error: null, data: Object.assign({ id: 'log-x' }, payload) });
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
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  vm.runInContext(recorte('/* ── CAMADA DE DADOS SUPABASE ── */', '/* ── fluxo da OS interna: porta de escrita ── */'), ctx);
  ctx._inserts = inserts;
  return ctx;
}

test('addLogEntryAsync inclui tipo_executor/executor_org no payload só quando UNI_OK', async () => {
  const ligado = carregarCamadaDados({ uniOk: true });
  await ligado.addLogEntryAsync(10, { date: '2026-08-23', tipo: 'PREVENTIVA', status: 'ABERTA', tipoExecutor: 'externa', executorOrg: 'Fulano Ltda' });
  assert.strictEqual(ligado._inserts[0].tipo_executor, 'externa');
  assert.strictEqual(ligado._inserts[0].executor_org, 'Fulano Ltda');

  const desligado = carregarCamadaDados({ uniOk: false });
  await desligado.addLogEntryAsync(10, { date: '2026-08-23', tipo: 'PREVENTIVA', status: 'ABERTA', tipoExecutor: 'externa', executorOrg: 'Fulano Ltda' });
  assert.strictEqual('tipo_executor' in desligado._inserts[0], false);
  assert.strictEqual('executor_org' in desligado._inserts[0], false);
});

// ══════════════════════════════════════════════════════════════════
// Migração 43 — aditiva, e a trava de status com os 13 literais
// ══════════════════════════════════════════════════════════════════

test('a migração 43 é aditiva — nenhum drop table, drop column nem delete from', () => {
  assert.strictEqual((SQL_43.match(/drop table|drop column|delete from/gi) || []).length, 0);
});

test('a trava de status da migração 43 contém CONCLUIDA e CONCLUÍDA como literais distintos, e continua contendo CONFERIDA e os três do legado', () => {
  const ini = SQL_43.indexOf('check (status in (');
  assert.ok(ini > 0, 'trava de status não encontrada em 43_refrigeracao_os_unificada.sql');
  const trecho = SQL_43.slice(ini, SQL_43.indexOf(';', ini));
  ['CONCLUIDA', 'CONCLUÍDA', 'CONFERIDA', 'PENDENTE', 'PARCIAL', 'ABERTA', 'DELINEAMENTO', 'APROVACAO', 'EM_EXECUCAO', 'CANCELADA', 'EXECUTADA', 'FISCALIZADA', 'ENCERRADA'].forEach((lit) => {
    assert.ok(trecho.indexOf("'" + lit + "'") >= 0, `literal "${lit}" não está na trava de status`);
  });
  const idxSemAcento = trecho.indexOf("'CONCLUIDA'");
  const idxComAcento = trecho.indexOf("'CONCLUÍDA'");
  assert.notStrictEqual(idxSemAcento, idxComAcento);
});

// ══════════════════════════════════════════════════════════════════
// os quatro grep do PLAT-15 — D-04 (refrigeração congelada/standalone)
// ══════════════════════════════════════════════════════════════════

test('os quatro grep do PLAT-15 continuam em 0 — refrigeração segue congelada e standalone', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
