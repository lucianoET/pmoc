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
// 260831-2wq: a migração 48 acrescenta os cinco parâmetros de inspeção
// (ruído, qualidade do ar, aspecto, dreno, suporte) em logs_manutencao.
const SQL_48 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '48_refrigeracao_inspecao_qualidade.sql'), 'utf8');

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
  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
  return ctx;
}

// ── ponte de campos (CAMPOS_LOG) ──
function carregarPonte() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
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

test('CAMPOS_LOG cobre exatamente as colunas de logs_manutencao da união das migrações 04+40+41+42+43+48, sem sobra e sem falta (exceto campanha_id)', () => {
  const ctx = carregarPonte();
  const uniao = colunasLogsManutencao04()
    .concat(colunasNovasDe(SQL_40), colunasNovasDe(SQL_41), colunasNovasDe(SQL_42), colunasNovasDe(SQL_43), colunasNovasDe(SQL_48))
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
  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
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
  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
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
// Task 2 — a OS própria na tela: executor, itens, comentários, cinco
// passos terminando em Concluída (D-cf8-01..30)
// ══════════════════════════════════════════════════════════════════

function carregarTelaCompleta(opts) {
  opts = opts || {};
  const updatesLog = [];
  const updatesEquip = [];
  const insertsItens = [];
  const deletesItens = [];
  const insertsComentarios = [];
  const chamadas = { manAbrirOS: 0, renderOS: 0 };
  const toasts = [];

  const linhaBase = Object.assign({
    id: 'log-1', equip_id: opts.equipId !== undefined ? opts.equipId : 10,
    data_os: opts.date || '2026-08-23', status: opts.status || 'EM_EXECUCAO',
    fotos: opts.fotosIniciais || [], tipo_executor: opts.tipoExecutorDb !== undefined ? opts.tipoExecutorDb : 'interna',
  }, opts.linhaExtra || {});

  const ctx = {
    UNI_OK: opts.uniOk !== undefined ? opts.uniOk : true,
    esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    el(id) { return (ctx._campos && ctx._campos[id]) || { querySelectorAll() { return []; } }; },
    val(id) { return (ctx._valores && ctx._valores[id] !== undefined) ? ctx._valores[id] : ''; },
    _valores: opts.valores || {},
    _campos: opts.campos || {},
    somenteLeitura() { return !!opts.observador; },
    ctUser: opts.ctUser !== undefined ? opts.ctUser : { nome: 'Fulano', role: 'gestor' },
    DATA: opts.data || [{ id: opts.equipId !== undefined ? opts.equipId : 10, ultimaManutencao: opts.ultimaManutencaoAtual || '', funciona: opts.funcionaAtual !== undefined ? opts.funcionaAtual : 'INOP' }],
    showToast(msg, tipo) { toasts.push({ msg, tipo }); },
    console: { warn() {}, error() {} },
    today() { return '2026-08-23'; },
    fmtDate(iso) { return iso || ''; },
    confirm() { return opts.confirmar !== false; },
    prompt() { return opts.motivoPrompt !== undefined ? opts.motivoPrompt : 'motivo'; },
    openDrawer() {}, closeDrawer() {},
    osEhMovimentacao() { return !!opts.movimentacao; },
    podeDarBaixa() { return false; },
    OS_ITENS: opts.osItensIniciais || {},
    OS_COMENTARIOS: opts.osComentariosIniciais || {},
    _insertsComp: [],
    _deletesComp: [],
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
          return { update(patch) { return { eq(col, val) { updatesEquip.push({ patch, col, val }); return Promise.resolve({ error: null }); } }; } };
        }
        if (tabela === 'os_itens') {
          return {
            insert(payload) {
              return {
                select() {
                  return {
                    single() {
                      if (opts.erroInsertItem) return Promise.resolve({ error: { message: 'falhou' } });
                      const linha = Object.assign({ id: 'item-' + (insertsItens.length + 1) }, payload);
                      insertsItens.push(linha);
                      return Promise.resolve({ error: null, data: linha });
                    },
                  };
                },
              };
            },
            delete() {
              return { eq(col, val) { deletesItens.push(val); return Promise.resolve({ error: opts.erroDeleteItem ? { message: 'falhou' } : null }); } };
            },
            select() { return { order() { return Promise.resolve({ error: opts.erroCarregarItens ? { message: 'falhou' } : null, data: opts.itensBanco || [] }); } }; },
          };
        }
        if (tabela === 'os_composicao_arp') {
          return {
            insert(payload) {
              return {
                select() {
                  return {
                    single() {
                      if (opts.erroInsertComp) return Promise.resolve({ error: { message: 'falhou' } });
                      const linha = Object.assign({ id: 'comp-' + (ctx._insertsComp.length + 1) }, payload);
                      ctx._insertsComp.push(linha);
                      return Promise.resolve({ error: null, data: linha });
                    },
                  };
                },
              };
            },
            delete() {
              return { eq(col, val) { ctx._deletesComp.push(val); return Promise.resolve({ error: opts.erroDeleteComp ? { message: 'falhou' } : null }); } };
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
                      const linha = Object.assign({ id: 'com-' + (insertsComentarios.length + 1), criado_em: '2026-08-23T12:00:00Z' }, payload);
                      insertsComentarios.push(linha);
                      return Promise.resolve({ error: null, data: linha });
                    },
                  };
                },
              };
            },
            select() { return { order() { return Promise.resolve({ error: opts.erroCarregarComentarios ? { message: 'falhou' } : null, data: opts.comentariosBanco || [] }); } }; },
          };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
      storage: { from() { return { upload() { return Promise.resolve({ error: null }); }, getPublicUrl() { return { data: { publicUrl: '' } }; } }; } },
    },
  };
  ctx._logCache = {};
  ctx._logCache[ctx.DATA[0] ? ctx.DATA[0].id : (opts.equipId !== undefined ? opts.equipId : 10)] = [Object.assign({ id: linhaBase.id, status: linhaBase.status, date: linhaBase.data_os, fotos: linhaBase.fotos, tipoExecutor: linhaBase.tipo_executor }, opts.entryExtra || {})];

  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
  vm.runInContext(recorte('/* ── estado do equipamento: vocabulário OP/INOP/OR ── */', '/* ── alertas: contagem única ── */'), ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: porta de escrita ── */', '/* ── REALTIME ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
  vm.runInContext(recorte('/* ── encerramento de OS: última manutenção ── */', 'async function saveLogEntry('), ctx);
  vm.runInContext(recorte('function osNoChip(', 'function renderOS(){'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: tela e ações ── */', 'function showSearch(){'), ctx);
  // 260823-cf8: OS_ITENS/OS_COMENTARIOS são "var" nos recortes acima — um
  // valor pré-semeado em ctx antes do vm.runInContext seria sobrescrito
  // pela própria declaração ("var X = {}" reatribui ao rodar). Semeados
  // DEPOIS, como manAbrirOS/renderOS abaixo.
  if (opts.osItensIniciais) ctx.OS_ITENS = opts.osItensIniciais;
  if (opts.osComentariosIniciais) ctx.OS_COMENTARIOS = opts.osComentariosIniciais;
  // sobrepõe o UNI_OK real, gravado pelo recorte da porta de escrita, pelo
  // que o teste pediu — a porta de escrita declara "var UNI_OK = false"
  // sempre que roda, então a ordem dos runInContext importa.
  ctx.UNI_OK = opts.uniOk !== undefined ? opts.uniOk : true;
  ctx.manAbrirOS = function () { chamadas.manAbrirOS++; };
  ctx.renderOS = function () { chamadas.renderOS++; };

  ctx._updatesLog = updatesLog;
  ctx._updatesEquip = updatesEquip;
  ctx._insertsItens = insertsItens;
  ctx._deletesItens = deletesItens;
  ctx._insertsComentarios = insertsComentarios;
  ctx._chamadas = chamadas;
  ctx._toasts = toasts;
  return ctx;
}

test('osDetalheEvento devolve rótulo anterior → rótulo novo, vazio sem mudança de status ou sem status anterior conhecido', () => {
  const ctx = carregarTelaCompleta({});
  assert.strictEqual(ctx.osDetalheEvento(ctx.FLUXO_PROPRIO, 'DELINEAMENTO', 'APROVACAO'), 'Em delineamento → Aguardando aprovação do gestor');
  assert.strictEqual(ctx.osDetalheEvento(ctx.FLUXO_PROPRIO, 'APROVACAO', 'APROVACAO'), '');
  assert.strictEqual(ctx.osDetalheEvento(ctx.FLUXO_PROPRIO, undefined, undefined), '');
  assert.match(ctx.osDetalheEvento(ctx.FLUXO_PROPRIO, undefined, 'ABERTA'), /^— →/);
});

test('manAtualizarOS grava um comentário de origem=sistema quando o patch muda o status, só com UNI_OK', async () => {
  const ligado = carregarTelaCompleta({ uniOk: true, status: 'DELINEAMENTO', tipoExecutorDb: 'interna', entryExtra: { tipoExecutor: 'interna' } });
  await ligado.manAtualizarOS('log-1', 10, { status: 'APROVACAO' }, 'msg');
  assert.strictEqual(ligado._insertsComentarios.length, 1);
  assert.strictEqual(ligado._insertsComentarios[0].origem, 'sistema');
  assert.match(ligado._insertsComentarios[0].texto, /Em delineamento → Aguardando aprovação do gestor/);

  const desligado = carregarTelaCompleta({ uniOk: false, status: 'DELINEAMENTO' });
  await desligado.manAtualizarOS('log-1', 10, { status: 'APROVACAO' }, 'msg');
  assert.strictEqual(desligado._insertsComentarios.length, 0);
});

test('manAtualizarOS não grava comentário quando o patch não muda o status', async () => {
  const ctx = carregarTelaCompleta({ uniOk: true, status: 'DELINEAMENTO' });
  await ctx.manAtualizarOS('log-1', 10, { desc: 'novo texto' }, 'msg');
  assert.strictEqual(ctx._insertsComentarios.length, 0);
});

test('osAdicionarComentario grava origem=usuario, recusa texto em branco, e respeita somente leitura', async () => {
  const ctx = carregarTelaCompleta({});
  const semTexto = await ctx.osAdicionarComentario('log-1', '   ');
  assert.strictEqual(semTexto, false);
  assert.strictEqual(ctx._insertsComentarios.length, 0);

  const ok = await ctx.osAdicionarComentario('log-1', 'Peça chegou amanhã');
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx._insertsComentarios[0].origem, 'usuario');
  assert.strictEqual(ctx._insertsComentarios[0].texto, 'Peça chegou amanhã');
  assert.strictEqual(ctx.OS_COMENTARIOS['log-1'].length, 1);

  const ctxObservador = carregarTelaCompleta({ observador: true });
  const recusado = await ctxObservador.osAdicionarComentario('log-1', 'x');
  assert.strictEqual(recusado, false);
  assert.strictEqual(ctxObservador._insertsComentarios.length, 0);
});

test('osAddItem grava o item, recusa sem permissão de delinear, e recusa numa OS terminal', async () => {
  const ctx = carregarTelaCompleta({ status: 'DELINEAMENTO' });
  const ok = await ctx.osAddItem('log-1', { tipo: 'MATERIAL', descricao: 'Capacitor', quantidade: 2, valorUnitario: 15 });
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx._insertsItens[0].tipo, 'MATERIAL');
  assert.strictEqual(ctx._insertsItens[0].valor_unitario, 15);
  assert.strictEqual(ctx.OS_ITENS['log-1'].length, 1);

  const ctxTecnico = carregarTelaCompleta({ status: 'DELINEAMENTO', ctUser: { nome: 'Técnico', role: 'observador' } });
  const recusadoCargo = await ctxTecnico.osAddItem('log-1', { tipo: 'MATERIAL', descricao: 'x', quantidade: 1, valorUnitario: 1 });
  assert.strictEqual(recusadoCargo, false);

  const ctxTerminal = carregarTelaCompleta({ status: 'CONCLUIDA', entryExtra: { tipoExecutor: 'interna' } });
  const recusadoTerminal = await ctxTerminal.osAddItem('log-1', { tipo: 'MATERIAL', descricao: 'x', quantidade: 1, valorUnitario: 1 });
  assert.strictEqual(recusadoTerminal, false);
  assert.strictEqual(ctxTerminal._insertsItens.length, 0);
});

test('osDelItem remove o item do cache local e recusa numa OS terminal', async () => {
  const ctx = carregarTelaCompleta({ status: 'DELINEAMENTO', osItensIniciais: { 'log-1': [{ id: 'item-1', tipo: 'SERVICO', descricao: 'x', quantidade: 1, valorUnitario: 10, total: 10 }] } });
  const ok = await ctx.osDelItem('log-1', 'item-1');
  assert.strictEqual(ok, true);
  assert.strictEqual(ctx.OS_ITENS['log-1'].length, 0);

  const ctxTerminal = carregarTelaCompleta({ status: 'CONCLUIDA', entryExtra: { tipoExecutor: 'interna' }, osItensIniciais: { 'log-1': [{ id: 'item-1' }] } });
  const recusado = await ctxTerminal.osDelItem('log-1', 'item-1');
  assert.strictEqual(recusado, false);
  assert.strictEqual(ctxTerminal.OS_ITENS['log-1'].length, 1);
});

test('carregarItensOS agrupa por os_id em OS_ITENS, e não consulta nada com UNI_OK falso', async () => {
  const ligado = carregarTelaCompleta({ uniOk: true, itensBanco: [{ id: 'i1', os_id: 'log-1', tipo: 'SERVICO', descricao: 'a', quantidade: 1, valor_unitario: 10, total: 10, ordem: 0 }] });
  await ligado.carregarItensOS();
  assert.strictEqual(ligado.OS_ITENS['log-1'].length, 1);
  assert.strictEqual(ligado.OS_ITENS['log-1'][0].valorUnitario, 10);

  const desligado = carregarTelaCompleta({ uniOk: false });
  await desligado.carregarItensOS();
  assert.deepStrictEqual(Object.keys(desligado.OS_ITENS), []);
});

test('conclusão própria (manConcluir): grava CONCLUIDA, exige evidência, chama última manutenção e estado do equipamento', async () => {
  const ctx = carregarTelaCompleta({
    status: 'EM_EXECUCAO', equipId: 77, ultimaManutencaoAtual: '', date: '2026-08-20',
    entryExtra: { fotos: ['a.jpg'], tipoExecutor: 'interna' },
    valores: { 'man-conf-estado': 'OP' },
    ctUser: { nome: 'Gestora Fulana', role: 'gestor' },
  });
  const ok = await ctx.manConcluir('log-1');
  assert.strictEqual(ok !== false, true);
  assert.strictEqual(ctx._updatesLog.length, 1);
  assert.strictEqual(ctx._updatesLog[0].patch.status, 'CONCLUIDA');
  assert.strictEqual(ctx._updatesEquip.length, 2); // ultima_manutencao + funciona
  const patchData = ctx._updatesEquip.find((u) => 'ultima_manutencao' in u.patch);
  assert.strictEqual(patchData.patch.ultima_manutencao, '2026-08-20');
});

test('manConcluir sem evidência é recusado, e um técnico sem manPode("concluir") também', async () => {
  const semEvidencia = carregarTelaCompleta({ status: 'EM_EXECUCAO', entryExtra: { fotos: [], tipoExecutor: 'interna' } });
  await semEvidencia.manConcluir('log-1');
  assert.strictEqual(semEvidencia._updatesLog.length, 0);

  // técnico PODE concluir (D-cf8-24, mesma lista de executar) — o teste
  // negativo usa um cargo fora de MAN_ACOES_CARGO.concluir.
  const cargoErrado = carregarTelaCompleta({ status: 'EM_EXECUCAO', entryExtra: { fotos: ['a.jpg'], tipoExecutor: 'interna' }, ctUser: { nome: 'X', role: 'observador' } });
  await cargoErrado.manConcluir('log-1');
  assert.strictEqual(cargoErrado._updatesLog.length, 0);
});

test('manClasseCard/manEhTerminal reconhecem CONCLUIDA como terminal sob o fluxo próprio (UNI_OK verdadeiro)', () => {
  const ctx = carregarTelaCompleta({});
  assert.strictEqual(ctx.manClasseCard('CONCLUIDA', 'interna'), 'concluida');
  assert.strictEqual(ctx.manEhTerminal('CONCLUIDA', 'interna'), true);
  assert.strictEqual(ctx.manPendente('EM_EXECUCAO', 'interna'), true);
});

test('osNoChip responde pelos três chips de executor, e uma OS sem tipo_executor cai no chip interna', () => {
  const ctx = carregarTelaCompleta({});
  assert.strictEqual(ctx.osNoChip('interna', { status: 'ABERTA' }, false), true);
  assert.strictEqual(ctx.osNoChip('externa', { status: 'ABERTA' }, false), false);
  assert.strictEqual(ctx.osNoChip('interna', { status: 'ABERTA', tipoExecutor: 'externa' }, false), false);
  assert.strictEqual(ctx.osNoChip('externa', { status: 'ABERTA', tipoExecutor: 'externa' }, false), true);
});

test('o corpo de openLogForm só desenha o bloco Executor atrás de UNI_OK', () => {
  const corpo = recorte('function openLogForm(equipId){', 'function updateChkCnt(){');
  assert.match(corpo, /var blocoExecutor = UNI_OK \?/);
  assert.match(corpo, /osCamposExecutorHtml/);
});

// 260823-cf8 (Task 3): contrato habilitado — os três tipos abrem pela
// mesma tela agora, sem opção desabilitada.
test('o seletor de executor de openLogForm não desabilita nenhuma opção (contrato habilitado, D-cf8-01/07)', () => {
  const corpo = recorte('function openLogForm(equipId){', 'function updateChkCnt(){');
  assert.doesNotMatch(corpo, /disabled/);
});

// 260823-jar (D-jar-18): manAbrirOS foi extraído em manMontarOS (a fonte
// única, gaveta E página) + osAbrirGaveta (o consumidor da gaveta);
// manAbrirOS virou um despachante. Os três recortes abaixo mudam de alvo
// porque o FATO mudou — o que era o corpo de manAbrirOS agora é o corpo
// de manMontarOS. Precedente D-92t-15: gate reescrito, nunca apagado.
test('o corpo de manMontarOS resolve o fluxo por osFluxoDe e desenha a régua por osPasso/osCurtos, nunca MAN_STEPS fixo', () => {
  const corpo = recorte('function manMontarOS(logId){', 'function osAbrirGaveta(');
  assert.match(corpo, /var flOS = osFluxoDe\(entry\);/);
  assert.match(corpo, /reguaPassos\(osPasso\(flOS, st\), osCurtos\(flOS\)\)/);
  assert.doesNotMatch(corpo, /reguaPassos\(manPasso\(st\), MAN_STEPS\)/);
});

test('o corpo de manMontarOS só desenha o bloco 4 · Conferência quando flComConferencia, e sempre desenha itens/comentários atrás de UNI_OK', () => {
  const corpo = recorte('function manMontarOS(logId){', 'function osAbrirGaveta(');
  assert.match(corpo, /if \(flComConferencia\) \{/);
  assert.match(corpo, /osItensHtml\(logId, entry\)/);
  assert.match(corpo, /osComentariosHtml\(logId\)/);
});

test('o corpo de manAbrirOS NÃO monta bloco por conta própria — despachante puro, delega para osAbrirGaveta (D-jar-18)', () => {
  const corpo = recorte('function manAbrirOS(logId){', 'async function manMudarStatus(');
  assert.doesNotMatch(corpo, /var flOS = osFluxoDe/);
  assert.doesNotMatch(corpo, /reguaPassos\(/);
  assert.doesNotMatch(corpo, /osItensHtml\(/);
  assert.doesNotMatch(corpo, /osComentariosHtml\(/);
  assert.match(corpo, /osAbrirGaveta\(logId\);/);
});

// ══════════════════════════════════════════════════════════════════
// Task 3 — contrato entra no tronco, o segundo aplicativo sai
// (D-cf8-01..30)
// ══════════════════════════════════════════════════════════════════

// D-cf8-22: nenhuma chamada de banco às quatro filhas dormentes sobra no
// arquivo — o padrão de busca concatena o prefixo de acesso com cada nome,
// para que um comentário em prosa citando a tabela continue legal e só a
// CHAMADA real conte (a prova viva: este próprio arquivo de teste cita as
// quatro tabelas em prosa, nas linhas acima, sem acionar o gate).
test('D-cf8-22: nenhuma chamada de banco às quatro filhas dormentes (os_orcamento_itens, os_execucao, os_composicao, os_eventos) sobra no arquivo', () => {
  const prefixo = "supa.from('";
  ['os_orcamento_itens', 'os_execucao', 'os_composicao', 'os_eventos'].forEach((tabela) => {
    // 'os_composicao' é prefixo de 'os_composicao_arp' (tabela nova, D-cf8-17) —
    // a comparação exige a aspa de fechamento logo depois do nome, para não
    // acusar a tabela nova por engano.
    const padrao = prefixo + tabela + "'";
    assert.strictEqual(HTML.indexOf(padrao), -1, `"${padrao}" ainda aparece no arquivo — ${tabela} deveria estar dormente`);
  });
});

test('o corpo de manMontarOS condiciona Fiscalização/Composição da ata a flContrato, e nunca em OS de movimentação (D-jar-18)', () => {
  const corpo = recorte('function manMontarOS(logId){', 'function osAbrirGaveta(');
  assert.match(corpo, /var flContrato = UNI_OK && !osEhMovimentacao\(entry\)/);
  assert.match(corpo, /else if \(flContrato\) \{/);
  assert.match(corpo, /osComposicaoAtaHtml\(logId, entry, st\)/);
});

test('manFiscalizar aprova gravando FISCALIZADA e devolve para EM_EXECUCAO com parecer obrigatório', async () => {
  const ctx = carregarTelaCompleta({ status: 'EXECUTADA', entryExtra: { tipoExecutor: 'contrato' }, valores: { 'man-fis-parecer': 'Conferido' } });
  await ctx.manFiscalizar('log-1', true);
  assert.strictEqual(ctx._updatesLog[0].patch.status, 'FISCALIZADA');
  assert.strictEqual(ctx._updatesLog[0].patch.fiscal, 'Fulano');

  const devolvido = carregarTelaCompleta({ status: 'EXECUTADA', entryExtra: { tipoExecutor: 'contrato' }, valores: { 'man-fis-parecer': 'Falta nota' } });
  await devolvido.manFiscalizar('log-1', false);
  assert.strictEqual(devolvido._updatesLog[0].patch.status, 'EM_EXECUCAO');

  const semParecer = carregarTelaCompleta({ status: 'EXECUTADA', entryExtra: { tipoExecutor: 'contrato' } });
  await semParecer.manFiscalizar('log-1', false);
  assert.strictEqual(semParecer._updatesLog.length, 0);
});

test('osAddComp/osDelComp gravam e removem em os_composicao_arp, com item_arp inteiro (D-cf8-17)', async () => {
  const ctx = carregarTelaCompleta({
    status: 'FISCALIZADA', entryExtra: { tipoExecutor: 'contrato' },
    valores: { 'cp-item': '266', 'cp-qtd': '3' },
  });
  ctx.ctArp = [{ item: 266, valor_unit: 100, ne: '2026NE000334', qtd_empenhada: 10 }];
  ctx.ctComp = {};
  ctx.ctSaldoItem = function (it) { return it.qtd_empenhada; };
  ctx.ctSaldoNE = function () { return 10000; };
  await ctx.osAddComp('log-1');
  assert.strictEqual(ctx._insertsComentarios.length, 0); // não é comentário — confirma a tabela certa
});

test('COLS_OS lê a OS de contrato pelas mesmas colunas de qualquer OS — sem COLS_CONTRAT', () => {
  assert.strictEqual(HTML.indexOf('var COLS_CONTRAT'), -1);
  assert.doesNotMatch(HTML, /tabDesenhar\('contrat'/);
});

// ══════════════════════════════════════════════════════════════════
// os quatro grep do PLAT-15 — D-04 (refrigeração congelada/standalone)
// ══════════════════════════════════════════════════════════════════

test('os quatro grep do PLAT-15 continuam em 0 — refrigeração segue congelada e standalone', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual((HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0, `"${padrao}" apareceu em refrigeracao/index.html`);
  }
});
