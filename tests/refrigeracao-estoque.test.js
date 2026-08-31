// Gate do estoque de peças e materiais (/refrigeracao) — quick task
// 260826-6wy.
//
// Escrito ANTES de existir migração ou código (RED visto: recorte não
// encontrado, supabase/44_refrigeracao_estoque.sql inexistente) — TDD por
// task, como as demais quick tasks deste módulo.
//
// Por que a idempotência da baixa é conferida contra a TABELA de
// movimentos (estoque_movimentos), nunca contra uma bandeira do cliente:
// uma bandeira paralela dessincroniza de uma retentativa de rede; o
// registro do próprio estoque não pode dessincronizar de si mesmo
// (D-6wy-03/T-6wy-02).
//
// EST_OK mora DELIBERADAMENTE dentro do recorte
// "── fluxo da OS interna: porta de escrita ──" (D-6wy-08) — os cinco
// gates que já carregam esse recorte em seus sandboxes
// (refrigeracao-os-pagina, refrigeracao-desktop, refrigeracao-trilha-os,
// refrigeracao-fluxo-os-interna, refrigeracao-os-unificada,
// refrigeracao-encerramento-os) recebem EST_OK declarado e FALSO de
// graça — nenhum precisa de uma linha mudada para continuar passando.
// Declará-la em outro lugar produziria ReferenceError em sandbox, falha
// de infraestrutura fingindo de regressão.
//
// Mesmo idioma dos outros gates de /refrigeracao: node:test +
// node:assert/strict, fs.readFileSync de refrigeracao/index.html e das
// migrações, recorte(marcadorIni, marcadorFim) com asserção de que os
// dois marcadores foram achados, vm.createContext/vm.runInContext, e o
// helper eq (compara por JSON.stringify — objeto criado DENTRO do
// sandbox tem prototype de outro realm; deepStrictEqual falha com
// conteúdo idêntico, armadilha já documentada em três gates deste
// módulo).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');
const SQL_44 = fs.readFileSync(path.join(__dirname, '..', 'supabase', '44_refrigeracao_estoque.sql'), 'utf8');

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

// Objetos criados DENTRO do sandbox (node:vm) têm Object.prototype/Array.prototype
// de outro realm — deepStrictEqual falha por "mesma estrutura, não referência-igual"
// mesmo com conteúdo idêntico.
function eq(actual, expected, message) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

const MARCA_INI = '/* ── fluxo da OS interna: porta de escrita ── */';
const MARCA_FIM = '/* ── REALTIME ── */';
const MARCA_ESTOQUE_INI = '/* ── estoque: catálogo, movimentos e baixa ── */';

// ── parser genérico de colunas de "create table if not exists NOME (...)" ──
function colunasDeTabela(sql, nomeTabela) {
  const re = new RegExp('create table if not exists ' + nomeTabela + '\\s*\\(');
  const m = re.exec(sql);
  assert.ok(m, `create table if not exists ${nomeTabela} não encontrada`);
  const abre = m.index + m[0].length - 1;
  let prof = 0, fimCorpo = -1;
  for (let i = abre; i < sql.length; i++) {
    if (sql[i] === '(') prof++;
    if (sql[i] === ')') { prof--; if (prof === 0) { fimCorpo = i; break; } }
  }
  assert.ok(fimCorpo > abre, `fechamento de ${nomeTabela} não encontrado`);
  const corpo = sql.slice(abre + 1, fimCorpo);
  const segmentos = [];
  let atual = '', p2 = 0;
  for (const ch of corpo) {
    if (ch === '(') p2++;
    if (ch === ')') p2--;
    if (ch === ',' && p2 === 0) { segmentos.push(atual); atual = ''; }
    else atual += ch;
  }
  if (atual.trim()) segmentos.push(atual);
  const nomes = [];
  segmentos.forEach((seg) => {
    const mm = seg.trim().match(/^([a-z_][a-z0-9_]*)\s+/i);
    if (mm) nomes.push(mm[1]);
  });
  return nomes;
}

function carregarNucleo() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(recorte(MARCA_INI, MARCA_FIM), ctx);
  return ctx;
}

function carregarSandboxSonda(opts) {
  opts = opts || {};
  const chamadas = [];
  const linhasMateriais = opts.linhasMateriais || [
    { id: 2, codigo: 'B', nome: 'Belt B', tipo: 'peca', unidade: 'un', aplicacao: null, preco: 10, estoque_atual: 5, estoque_minimo: 1, obs: null, ativo: true },
    { id: 1, codigo: 'A', nome: 'Filtro A', tipo: 'consumivel', unidade: 'un', aplicacao: 'SPLIT', preco: 20, estoque_atual: 8, estoque_minimo: 2, obs: null, ativo: true },
  ];
  const ctx = {
    console: { warn(...a) { chamadas.push(['warn', ...a]); }, error() {} },
    supa: {
      from(tabela) {
        chamadas.push(['from', tabela]);
        if (tabela === 'materiais') {
          return {
            select() {
              return {
                limit() {
                  if (opts.sondaFalha) return Promise.resolve({ error: { message: 'falhou' }, data: null });
                  return Promise.resolve({ error: null, data: [{ id: 1 }] });
                },
                order() {
                  return Promise.resolve({ error: null, data: linhasMateriais });
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
  vm.runInContext(recorte(MARCA_INI, MARCA_FIM), ctx);
  ctx._chamadas = chamadas;
  return ctx;
}

// ══════════════════════════════════════════════════════════════════
// Migração 44 — forma, por regex
// ══════════════════════════════════════════════════════════════════

test('migração 44: declara create table if not exists materiais e create table if not exists estoque_movimentos', () => {
  assert.match(SQL_44, /create table if not exists materiais\s*\(/);
  assert.match(SQL_44, /create table if not exists estoque_movimentos\s*\(/);
});

test('migração 44: materiais tem exatamente as onze colunas — nem mais, nem menos', () => {
  const nomes = colunasDeTabela(SQL_44, 'materiais');
  eq(nomes.sort(), ['id', 'codigo', 'nome', 'tipo', 'unidade', 'aplicacao', 'preco', 'estoque_atual', 'estoque_minimo', 'obs', 'ativo'].sort());
});

test('migração 44: materiais.codigo é unique', () => {
  assert.match(SQL_44, /codigo\s+text\s+unique/);
});

test('migração 44: materiais.tipo tem lista fechada consumivel|peca', () => {
  assert.match(SQL_44, /check\s*\(\s*tipo\s+in\s*\(\s*'consumivel'\s*,\s*'peca'\s*\)\s*\)/);
});

test('migração 44: estoque_atual e estoque_minimo têm check de não-negativo', () => {
  assert.match(SQL_44, /estoque_atual[\s\S]*?check\s*\(\s*estoque_atual\s*>=\s*0\s*\)/);
  assert.match(SQL_44, /estoque_minimo[\s\S]*?check\s*\(\s*estoque_minimo\s*>=\s*0\s*\)/);
});

test('migração 44: preco aceita nulo ou não-negativo', () => {
  assert.match(SQL_44, /check\s*\(\s*preco\s+is\s+null\s+or\s+preco\s*>=\s*0\s*\)/);
});

test('migração 44: ativo nasce true', () => {
  assert.match(SQL_44, /ativo\s+boolean\s+not\s+null\s+default\s+true/);
});

test('migração 44: estoque_movimentos tem as sete colunas esperadas', () => {
  const nomes = colunasDeTabela(SQL_44, 'estoque_movimentos');
  eq(nomes.sort(), ['id', 'material_id', 'os_id', 'tipo', 'quantidade', 'motivo', 'registrado_em'].sort());
});

test('migração 44: estoque_movimentos.tipo é lista fechada entrada|saida, quantidade > 0', () => {
  assert.match(SQL_44, /check\s*\(\s*tipo\s+in\s*\(\s*'entrada'\s*,\s*'saida'\s*\)\s*\)/);
  assert.match(SQL_44, /quantidade[\s\S]{0,40}check\s*\(\s*quantidade\s*>\s*0\s*\)/);
});

test('migração 44: os_itens ganha material_id por add column if not exists, anulável', () => {
  assert.match(SQL_44, /alter table os_itens add column if not exists material_id bigint references materiais\(id\)/);
  assert.doesNotMatch(SQL_44, /material_id bigint.*not null/);
});

test('migração 44: existe índice para cada FK nova, incluindo o composto (os_id, tipo)', () => {
  assert.match(SQL_44, /create index if not exists estoque_movimentos_material_id_idx on estoque_movimentos \(material_id\)/);
  assert.match(SQL_44, /create index if not exists estoque_movimentos_os_id_tipo_idx on estoque_movimentos \(os_id,\s*tipo\)/);
  assert.match(SQL_44, /create index if not exists os_itens_material_id_idx on os_itens \(material_id\)/);
});

test('migração 44: aditiva — nenhum "drop" fora de "drop policy if exists"', () => {
  const linhas = SQL_44.split('\n');
  linhas.forEach((linha) => {
    const semComentario = linha.split('--')[0];
    if (/\bdrop\b/i.test(semComentario)) {
      assert.match(semComentario, /drop policy if exists/i, `linha com "drop" fora de "drop policy if exists": ${linha}`);
    }
  });
});

test('migração 44: RLS ligada nas duas tabelas, quatro policies por tabela (select using(true), escrita to authenticated)', () => {
  assert.match(SQL_44, /array\['materiais',\s*'estoque_movimentos'\]/);
  assert.match(SQL_44, /alter table %I enable row level security/);
  assert.match(SQL_44, /'r_sel_'/);
  assert.match(SQL_44, /'r_ins_'/);
  assert.match(SQL_44, /'r_upd_'/);
  assert.match(SQL_44, /'r_del_'/);
  assert.match(SQL_44, /for select using \(true\)/);
  assert.match(SQL_44, /for insert to authenticated/);
  assert.match(SQL_44, /for update to authenticated/);
  assert.match(SQL_44, /for delete to authenticated/);
});

test('migração 44: grant de sequence para a identity de materiais', () => {
  assert.match(SQL_44, /grant usage, select on sequence materiais_id_seq to anon, authenticated/);
});

// ══════════════════════════════════════════════════════════════════
// CAMPOS_MATERIAL — ponte de campos, coluna a coluna (D-6wy-11)
// ══════════════════════════════════════════════════════════════════

test('CAMPOS_MATERIAL: toda coluna de materiais na migração 44 aparece como valor no mapa', () => {
  const ctx = carregarNucleo();
  const colunas = colunasDeTabela(SQL_44, 'materiais');
  const valores = Object.values(ctx.CAMPOS_MATERIAL);
  colunas.forEach((c) => assert.ok(valores.includes(c), `coluna "${c}" não está em CAMPOS_MATERIAL`));
});

test('CAMPOS_MATERIAL: todo valor do mapa é uma coluna que a migração 44 declara', () => {
  const ctx = carregarNucleo();
  const colunas = colunasDeTabela(SQL_44, 'materiais');
  Object.values(ctx.CAMPOS_MATERIAL).forEach((v) => assert.ok(colunas.includes(v), `valor "${v}" de CAMPOS_MATERIAL não é coluna de materiais`));
});

// ══════════════════════════════════════════════════════════════════
// Núcleo puro — sem API de navegador nenhuma
// ══════════════════════════════════════════════════════════════════

test('estItensParaBaixa([]) devolve lista vazia', () => {
  const ctx = carregarNucleo();
  eq(ctx.estItensParaBaixa([]), []);
});

test('estItensParaBaixa: itens de tipo SERVICO nunca entram, mesmo com materialId', () => {
  const ctx = carregarNucleo();
  eq(ctx.estItensParaBaixa([{ tipo: 'SERVICO', materialId: 5, quantidade: 2 }]), []);
});

test('estItensParaBaixa: item de MATERIAL sem materialId (texto livre) nunca entra', () => {
  const ctx = carregarNucleo();
  eq(ctx.estItensParaBaixa([{ tipo: 'MATERIAL', quantidade: 2 }]), []);
});

test('estItensParaBaixa: item de MATERIAL com materialId e quantidade zero ou negativa nunca entra', () => {
  const ctx = carregarNucleo();
  eq(ctx.estItensParaBaixa([{ tipo: 'MATERIAL', materialId: 1, quantidade: 0 }]), []);
  eq(ctx.estItensParaBaixa([{ tipo: 'MATERIAL', materialId: 1, quantidade: -3 }]), []);
});

test('estItensParaBaixa: dois itens de MATERIAL do mesmo materialId saem consolidados numa entrada só (D-6wy-10)', () => {
  const ctx = carregarNucleo();
  const r = ctx.estItensParaBaixa([
    { tipo: 'MATERIAL', materialId: 7, quantidade: 2 },
    { tipo: 'MATERIAL', materialId: 7, quantidade: 3 },
  ]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].materialId, 7);
  assert.strictEqual(r[0].quantidade, 5);
});

test('estItensParaBaixa: quantidade em string conta como número', () => {
  const ctx = carregarNucleo();
  const r = ctx.estItensParaBaixa([{ tipo: 'MATERIAL', materialId: 9, quantidade: '2' }]);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].quantidade, 2);
});

test('estAbaixoDoMinimo: só o que tem atual estritamente menor que mínimo', () => {
  const ctx = carregarNucleo();
  const r = ctx.estAbaixoDoMinimo([
    { id: 1, ativo: true, estoqueAtual: 1, estoqueMinimo: 5 },
    { id: 2, ativo: true, estoqueAtual: 5, estoqueMinimo: 5 },
    { id: 3, ativo: true, estoqueAtual: 10, estoqueMinimo: 5 },
  ]);
  eq(r.map((m) => m.id), [1]);
});

test('estAbaixoDoMinimo: mínimo zero nunca alerta', () => {
  const ctx = carregarNucleo();
  const r = ctx.estAbaixoDoMinimo([{ id: 1, ativo: true, estoqueAtual: 0, estoqueMinimo: 0 }]);
  eq(r, []);
});

test('estAbaixoDoMinimo: material com ativo falso nunca alerta', () => {
  const ctx = carregarNucleo();
  const r = ctx.estAbaixoDoMinimo([{ id: 1, ativo: false, estoqueAtual: 0, estoqueMinimo: 5 }]);
  eq(r, []);
});

test('estMotivoDaOS: usa o número da OS de contrato quando existe', () => {
  const ctx = carregarNucleo();
  const m = ctx.estMotivoDaOS({ id: 'abcdef01-0000', tipoExecutor: 'contrato', numero: 'OSC 003/2026' });
  assert.strictEqual(m, 'OS OSC 003/2026 — material lançado na ordem');
});

test('estMotivoDaOS: usa um identificador curto derivado do id quando não é contrato ou não tem número', () => {
  const ctx = carregarNucleo();
  const m = ctx.estMotivoDaOS({ id: 'abcdef01-2222-3333', tipoExecutor: 'interna' });
  assert.strictEqual(m, 'OS abcdef01 — material lançado na ordem');
});

test('estRotuloMaterial: formato com código, nome, unidade e preço', () => {
  const ctx = carregarNucleo();
  const r = ctx.estRotuloMaterial({ codigo: 'FLT-01', nome: 'Filtro de ar', unidade: 'un', preco: 12.5 });
  assert.match(r, /FLT-01/);
  assert.match(r, /Filtro de ar/);
  assert.match(r, /un/);
  assert.match(r, /12,50/);
});

// ══════════════════════════════════════════════════════════════════
// Sonda e carga (supa dublado)
// ══════════════════════════════════════════════════════════════════

test('estSondarEsquema(): true e grava EST_OK true quando a leitura de materiais passa', async () => {
  const ctx = carregarSandboxSonda();
  const r = await ctx.estSondarEsquema();
  assert.strictEqual(r, true);
  assert.strictEqual(ctx.EST_OK, true);
});

test('estSondarEsquema(): devolve false, sem lançar, quando a leitura falha', async () => {
  const ctx = carregarSandboxSonda({ sondaFalha: true });
  const r = await ctx.estSondarEsquema();
  assert.strictEqual(r, false);
  assert.strictEqual(ctx.EST_OK, false);
});

test('carregarMateriais(): com EST_OK falso não consulta nada e deixa MATERIAIS vazio', async () => {
  const ctx = carregarSandboxSonda();
  ctx.EST_OK = false;
  await ctx.carregarMateriais();
  eq(ctx.MATERIAIS, []);
  assert.strictEqual(ctx._chamadas.some((c) => c[0] === 'from'), false);
});

test('carregarMateriais(): com EST_OK true, ordena e povoa MATERIAIS pela ponte de campos', async () => {
  const ctx = carregarSandboxSonda();
  ctx.EST_OK = true;
  await ctx.carregarMateriais();
  assert.strictEqual(ctx.MATERIAIS.length, 2);
  assert.strictEqual(ctx.MATERIAIS[0].codigo, 'B');
  assert.strictEqual(ctx.MATERIAIS[0].estoqueAtual, 5);
  assert.strictEqual(ctx.MATERIAIS[0].estoqueMinimo, 1);
});

// ══════════════════════════════════════════════════════════════════
// Compatibilidade (D-6wy-06)
// ══════════════════════════════════════════════════════════════════

test('refrigeracao/index.html declara var EST_OK = false — padrão desligado', () => {
  assert.match(HTML, /var EST_OK = false;/);
});

test('estSondarEsquema é chamada nas duas sequências de arranque, fora do Promise.all principal', () => {
  const acessoLivre = recorte('async function acessoLivre() {', '/* ═══════════════════════════════════════════════════════════\n   INIT');
  const initAppOnce = recorte('async function initAppOnce(){', 'window.initAppOnce = initAppOnce;');
  assert.match(acessoLivre, /await estSondarEsquema\(\);/);
  assert.match(initAppOnce, /await estSondarEsquema\(\);/);
});

test('carregarMateriais é chamada nas duas sequências de arranque, fora do Promise.all principal', () => {
  const acessoLivre = recorte('async function acessoLivre() {', '/* ═══════════════════════════════════════════════════════════\n   INIT');
  const initAppOnce = recorte('async function initAppOnce(){', 'window.initAppOnce = initAppOnce;');
  assert.match(acessoLivre, /await carregarMateriais\(\);/);
  assert.match(initAppOnce, /await carregarMateriais\(\);/);
});

test('nenhuma menção às tabelas de estoque dos outros módulos em refrigeracao/index.html', () => {
  assert.doesNotMatch(HTML, /maq_materiais/);
  assert.doesNotMatch(HTML, /transp_materiais/);
});

test('EST_OK está declarado dentro do recorte "── fluxo da OS interna: porta de escrita ──" (D-6wy-08)', () => {
  const trecho = recorte(MARCA_INI, MARCA_FIM);
  assert.match(trecho, /var EST_OK = false;/);
  assert.ok(trecho.includes(MARCA_ESTOQUE_INI), 'subseção "estoque: catálogo, movimentos e baixa" não está dentro do recorte da porta de escrita');
});

// ══════════════════════════════════════════════════════════════════
// Task 2 — baixa idempotente ao entrar em EM_EXECUCAO, e item de OS
// escolhido do catálogo
// ══════════════════════════════════════════════════════════════════

const MARCA_PONTE_LOG_INI = '/* ── ponte de campos de logs_manutencao ── */';
const MARCA_PONTE_LOG_FIM = '/* ── CAMADA DE DADOS SUPABASE ── */';
const MARCA_ITENS_INI = '/* ── OS unificada: itens de serviço e material (D-cf8-05/14) ── */';
const MARCA_ITENS_FIM = '/* ── OS unificada: contrato — fiscalização, composição da ata, certificação ── */';

// ── sandbox da baixa (D-6wy-03): logs_manutencao + os_comentarios +
// estoque_movimentos + materiais dublados, mesma forma de
// tests/refrigeracao-trilha-os.test.js:carregarSandbox — UNI_OK fica
// FALSO por padrão de propósito (o objeto sob teste aqui é a baixa de
// estoque, não a trilha de auditoria da OS unificada; falso evita
// depender de osFluxoDe/osDetalheEvento, que têm gate próprio noutro
// arquivo).
function carregarSandboxBaixa(opts) {
  opts = opts || {};
  const updatesLog = [];
  const insertsMovimentos = [];
  const updatesMateriais = [];
  const selectsMovimentos = [];
  const chamadasFrom = [];
  const toasts = [];
  const warns = [];

  const linhaBase = { id: 'log-1', equip_id: 10 };
  const movimentosExistentes = opts.movimentosExistentes || [];

  const ctx = {
    esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    ctUser: opts.ctUser !== undefined ? opts.ctUser : { nome: 'Fulano', role: 'gestor' },
    showToast(msg, tipo) { toasts.push({ msg, tipo }); },
    console: { warn(...args) { warns.push(args); }, error() {} },
    supa: {
      from(tabela) {
        chamadasFrom.push(tabela);
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
          return { insert() { return { select() { return { single() { return Promise.resolve({ error: null, data: { id: 'com-1' } }); } }; } }; } };
        }
        if (tabela === 'estoque_movimentos') {
          return {
            select() {
              return {
                eq(col1, val1) {
                  return {
                    eq(col2, val2) {
                      return {
                        limit() {
                          selectsMovimentos.push({ col1, val1, col2, val2 });
                          const existe = movimentosExistentes.some((m) => m.os_id === val1 && m.tipo === val2);
                          return Promise.resolve({ error: null, data: existe ? [{ id: 'mov-existente' }] : [] });
                        },
                      };
                    },
                  };
                },
              };
            },
            insert(payload) {
              if (opts.erroInsertMovimento) return Promise.resolve({ error: { message: 'falhou' } });
              insertsMovimentos.push(payload);
              return Promise.resolve({ error: null, data: payload });
            },
          };
        }
        if (tabela === 'materiais') {
          return {
            update(patch) {
              return {
                eq(col, val) {
                  updatesMateriais.push({ id: val, patch });
                  return Promise.resolve({ error: null, data: null });
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
  vm.runInContext(recorte(MARCA_PONTE_LOG_INI, MARCA_PONTE_LOG_FIM), ctx);
  vm.runInContext(recorte(MARCA_INI, MARCA_FIM), ctx);

  // UNI_OK/EST_OK/OS_ITENS/MATERIAIS são "var" dentro dos recortes acima —
  // reatribuídos ao rodar. Semeados DEPOIS de todos os runInContext (mesmo
  // cuidado de tests/refrigeracao-trilha-os.test.js).
  ctx.UNI_OK = opts.uniOk !== undefined ? opts.uniOk : false;
  ctx.EST_OK = opts.estOk !== undefined ? opts.estOk : true;
  ctx.OS_ITENS = opts.osItens || {};
  ctx.MATERIAIS = opts.materiais || [];

  ctx._updatesLog = updatesLog;
  ctx._insertsMovimentos = insertsMovimentos;
  ctx._updatesMateriais = updatesMateriais;
  ctx._selectsMovimentos = selectsMovimentos;
  ctx._chamadasFrom = chamadasFrom;
  ctx._toasts = toasts;
  ctx._warns = warns;
  return ctx;
}

test('manAtualizarOS: com EST_OK falso, EM_EXECUCAO não consulta nem escreve nada de estoque', async () => {
  const ctx = carregarSandboxBaixa({
    estOk: false,
    entryInicial: { status: 'APROVACAO' },
    osItens: { 'log-1': [{ id: 'i1', tipo: 'MATERIAL', materialId: 1, quantidade: 2 }] },
    materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 10 }],
  });
  await ctx.manAtualizarOS('log-1', 10, { status: 'EM_EXECUCAO' }, 'msg');
  assert.strictEqual(ctx._chamadasFrom.includes('estoque_movimentos'), false);
  assert.strictEqual(ctx._chamadasFrom.includes('materiais'), false);
});

test('manAtualizarOS: EST_OK true, dois itens de MATERIAL catalogados — duas saídas gravadas com os_id/material_id/quantidade/motivo', async () => {
  const ctx = carregarSandboxBaixa({
    estOk: true,
    entryInicial: { status: 'APROVACAO' },
    osItens: { 'log-1': [
      { id: 'i1', tipo: 'MATERIAL', materialId: 1, quantidade: 2 },
      { id: 'i2', tipo: 'MATERIAL', materialId: 2, quantidade: 1 },
    ] },
    materiais: [
      { id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 10 },
      { id: 2, codigo: 'B', nome: 'Correia', estoqueAtual: 3 },
    ],
  });
  await ctx.manAtualizarOS('log-1', 10, { status: 'EM_EXECUCAO' }, 'msg');
  assert.strictEqual(ctx._insertsMovimentos.length, 2);
  ctx._insertsMovimentos.forEach((m) => {
    assert.strictEqual(m.os_id, 'log-1');
    assert.strictEqual(m.tipo, 'saida');
    assert.ok(m.material_id === 1 || m.material_id === 2);
    assert.ok(m.motivo && m.motivo.indexOf('material lançado na ordem') >= 0);
  });
});

test('manAtualizarOS: estoque_atual atualizado para atual - quantidade, nunca abaixo de zero', async () => {
  const ctx = carregarSandboxBaixa({
    estOk: true,
    entryInicial: { status: 'APROVACAO' },
    osItens: { 'log-1': [{ id: 'i1', tipo: 'MATERIAL', materialId: 1, quantidade: 50 }] },
    materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 10 }],
  });
  await ctx.manAtualizarOS('log-1', 10, { status: 'EM_EXECUCAO' }, 'msg');
  assert.strictEqual(ctx._updatesMateriais.length, 1);
  assert.strictEqual(ctx._updatesMateriais[0].patch.estoque_atual, 0);
});

test('manAtualizarOS: repetir a mesma transição com saída já existente para o os_id não grava nada e não altera saldo', async () => {
  const ctx = carregarSandboxBaixa({
    estOk: true,
    entryInicial: { status: 'APROVACAO' },
    osItens: { 'log-1': [{ id: 'i1', tipo: 'MATERIAL', materialId: 1, quantidade: 2 }] },
    materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 10 }],
    movimentosExistentes: [{ os_id: 'log-1', tipo: 'saida' }],
  });
  await ctx.manAtualizarOS('log-1', 10, { status: 'EM_EXECUCAO' }, 'msg');
  assert.strictEqual(ctx._insertsMovimentos.length, 0);
  assert.strictEqual(ctx._updatesMateriais.length, 0);
});

test('manAtualizarOS: transição para outro status (DELINEAMENTO/APROVACAO/CONCLUIDA) não baixa nada', async () => {
  for (const destino of ['DELINEAMENTO', 'APROVACAO', 'CONCLUIDA']) {
    const ctx = carregarSandboxBaixa({
      estOk: true,
      entryInicial: { status: 'ABERTA' },
      osItens: { 'log-1': [{ id: 'i1', tipo: 'MATERIAL', materialId: 1, quantidade: 2 }] },
      materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 10 }],
    });
    await ctx.manAtualizarOS('log-1', 10, { status: destino }, 'msg');
    assert.strictEqual(ctx._insertsMovimentos.length, 0, `status ${destino} não deveria baixar`);
  }
});

test('manAtualizarOS: patch sem status não baixa nada', async () => {
  const ctx = carregarSandboxBaixa({
    estOk: true,
    entryInicial: { status: 'EM_EXECUCAO' },
    osItens: { 'log-1': [{ id: 'i1', tipo: 'MATERIAL', materialId: 1, quantidade: 2 }] },
    materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 10 }],
  });
  await ctx.manAtualizarOS('log-1', 10, { fiscal: 'Fulano' }, 'msg');
  assert.strictEqual(ctx._insertsMovimentos.length, 0);
});

test('manAtualizarOS: OS só com itens de SERVICO, ou só com material de texto livre, não gera movimento nenhum e não consulta o saldo', async () => {
  const ctx = carregarSandboxBaixa({
    estOk: true,
    entryInicial: { status: 'APROVACAO' },
    osItens: { 'log-1': [
      { id: 'i1', tipo: 'SERVICO', quantidade: 1 },
      { id: 'i2', tipo: 'MATERIAL', quantidade: 2 }, // texto livre: sem materialId
    ] },
    materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 10 }],
  });
  await ctx.manAtualizarOS('log-1', 10, { status: 'EM_EXECUCAO' }, 'msg');
  assert.strictEqual(ctx._chamadasFrom.includes('estoque_movimentos'), false);
  assert.strictEqual(ctx._chamadasFrom.includes('materiais'), false);
});

test('manAtualizarOS: falha do insert do movimento não derruba a transição — devolve true, toast de sucesso uma vez (D-jpd-05)', async () => {
  const ctx = carregarSandboxBaixa({
    estOk: true,
    entryInicial: { status: 'APROVACAO' },
    osItens: { 'log-1': [{ id: 'i1', tipo: 'MATERIAL', materialId: 1, quantidade: 2 }] },
    materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 10 }],
    erroInsertMovimento: true,
  });
  const ok = await ctx.manAtualizarOS('log-1', 10, { status: 'EM_EXECUCAO' }, 'msg');
  assert.strictEqual(ok, true);
  const toastsSucesso = ctx._toasts.filter((t) => t.tipo === 'ok');
  assert.strictEqual(toastsSucesso.length, 1);
});

// ── sandbox do formulário de item — só o que osItensHtml/osAddItem/
// osAddItemUI/estPreencherItemDaOS precisam; o resto (manPode,
// manEhTerminal, osTotalItens, fmtMoney) é stub simples, cada um com
// gate próprio noutro arquivo (mesmo idioma de
// tests/refrigeracao-trilha-os.test.js, que estuba esc()). ──
function elFalso(id) {
  return { id: id, value: '', textContent: '', innerHTML: '' };
}
function carregarSandboxItens(opts) {
  opts = opts || {};
  const nodes = {};
  const insertsItens = [];
  const chamadasManAbrirOS = [];
  const toasts = [];

  const ctx = {
    esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    el(id) { return nodes[id] || (nodes[id] = elFalso(id)); },
    val(id) { const n = nodes[id]; return n ? n.value : ''; },
    fmtMoney(v) { return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ','); },
    manPode() { return opts.podeEditar !== false; },
    manEhTerminal() { return opts.terminal === true; },
    manEntrada() { return opts.entradaDe || null; },
    osTotalItens(itens) { return (itens || []).reduce((s, i) => s + (Number(i.total) || 0), 0); },
    manAbrirOS(osId) { chamadasManAbrirOS.push(osId); },
    showToast(msg, tipo) { toasts.push({ msg, tipo }); },
    console: { warn() {}, error() {} },
    supa: {
      from(tabela) {
        if (tabela !== 'os_itens') throw new Error('tabela inesperada: ' + tabela);
        return {
          insert(payload) {
            return {
              select() {
                return {
                  single() {
                    const linha = Object.assign({ id: 'item-' + (insertsItens.length + 1) }, payload);
                    insertsItens.push({ payload: payload, linha: linha });
                    return Promise.resolve({ error: null, data: linha });
                  },
                };
              },
            };
          },
        };
      },
    },
  };

  vm.createContext(ctx);
  vm.runInContext(recorte(MARCA_INI, MARCA_FIM), ctx);
  vm.runInContext(recorte(MARCA_ITENS_INI, MARCA_ITENS_FIM), ctx);

  // EST_OK/MATERIAIS/OS_ITENS são "var" dentro dos recortes acima.
  ctx.EST_OK = opts.estOk !== undefined ? opts.estOk : false;
  ctx.MATERIAIS = opts.materiais || [];
  ctx.OS_ITENS = opts.osItens || {};

  ctx._insertsItens = insertsItens;
  ctx._chamadasManAbrirOS = chamadasManAbrirOS;
  ctx._toasts = toasts;
  return ctx;
}

test('osItensHtml: com EST_OK falso, o formulário de item não contém nenhum identificador novo (byte a byte o de hoje)', () => {
  const ctx = carregarSandboxItens({ estOk: false, materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', unidade: 'un', preco: 10, ativo: true }] });
  const html = ctx.osItensHtml('os-1', { status: 'DELINEAMENTO', tipoExecutor: 'interna' });
  assert.doesNotMatch(html, /oi-un-mat/);
  assert.doesNotMatch(html, /Material do catálogo/);
});

test('osItensHtml: com EST_OK true, o seletor traz "Texto livre" primeiro e uma opção por material ativo; arquivado não aparece', () => {
  const ctx = carregarSandboxItens({
    estOk: true,
    materiais: [
      { id: 1, codigo: 'A', nome: 'Filtro', unidade: 'un', preco: 10, ativo: true },
      { id: 2, codigo: 'B', nome: 'Correia', unidade: 'un', preco: 20, ativo: false },
    ],
  });
  const html = ctx.osItensHtml('os-1', { status: 'DELINEAMENTO', tipoExecutor: 'interna' });
  assert.match(html, /id="oi-un-mat"/);
  const iniSelect = html.indexOf('id="oi-un-mat"');
  const fimSelect = html.indexOf('</select>', iniSelect);
  const trechoSelect = html.slice(iniSelect, fimSelect);
  const iniLivre = trechoSelect.indexOf('<option value="">');
  const iniA = trechoSelect.indexOf('value="1"');
  assert.ok(iniLivre >= 0 && iniA > iniLivre, 'a opção de texto livre não veio primeiro');
  assert.doesNotMatch(trechoSelect, /value="2"/); // material arquivado não aparece
});

test('estPreencherItemDaOS: escolher um material preenche descrição, valor unitário e força o tipo MATERIAL', () => {
  const ctx = carregarSandboxItens({ estOk: true, materiais: [{ id: 5, codigo: 'X', nome: 'Compressor', unidade: 'un', preco: 350.5, ativo: true }] });
  ctx.el('oi-un-mat').value = '5';
  ctx.estPreencherItemDaOS();
  assert.strictEqual(ctx.el('oi-un-desc').value, 'Compressor');
  assert.strictEqual(ctx.el('oi-un-vu').value, 350.5);
  assert.strictEqual(ctx.el('oi-un-tipo').value, 'MATERIAL');
});

test('estPreencherItemDaOS: sem material escolhido, não mexe em nada (quem já digitou não perde o que digitou)', () => {
  const ctx = carregarSandboxItens({ estOk: true, materiais: [{ id: 5, codigo: 'X', nome: 'Compressor', unidade: 'un', preco: 350.5, ativo: true }] });
  ctx.el('oi-un-desc').value = 'texto já digitado';
  ctx.el('oi-un-mat').value = '';
  ctx.estPreencherItemDaOS();
  assert.strictEqual(ctx.el('oi-un-desc').value, 'texto já digitado');
});

test('osAddItem sem material escolhido: payload byte a byte o de hoje (sem a chave material_id) — D-6wy-12', async () => {
  const ctx = carregarSandboxItens({ estOk: true });
  await ctx.osAddItem('os-1', { tipo: 'SERVICO', descricao: 'Troca de filtro', quantidade: 1, valorUnitario: 50 });
  const payload = ctx._insertsItens[0].payload;
  assert.strictEqual('material_id' in payload, false);
  eq(Object.keys(payload).sort(), ['os_id', 'tipo', 'descricao', 'unidade', 'quantidade', 'valor_unitario', 'ordem'].sort());
});

test('osAddItem com material escolhido: inclui material_id e a unidade do catálogo, valor unitário do momento do lançamento', async () => {
  const ctx = carregarSandboxItens({ estOk: true });
  await ctx.osAddItem('os-1', { tipo: 'MATERIAL', descricao: 'Compressor', quantidade: 1, valorUnitario: 350.5, materialId: 5, unidade: 'un' });
  const payload = ctx._insertsItens[0].payload;
  assert.strictEqual(payload.material_id, 5);
  assert.strictEqual(payload.unidade, 'un');
  assert.strictEqual(payload.valor_unitario, 350.5);
});

test('a linha renderizada de um item do catálogo mostra o código do material; a de texto livre não ganha código nenhum', () => {
  const ctx = carregarSandboxItens({
    estOk: true,
    materiais: [{ id: 5, codigo: 'CMP-01', nome: 'Compressor', unidade: 'un', preco: 350.5, ativo: true }],
    osItens: { 'os-1': [
      { id: 'i1', tipo: 'MATERIAL', descricao: 'Compressor', quantidade: 1, valorUnitario: 350.5, total: 350.5, materialId: 5 },
      { id: 'i2', tipo: 'SERVICO', descricao: 'Mão de obra', quantidade: 1, valorUnitario: 100, total: 100 },
    ] },
  });
  const html = ctx.osItensHtml('os-1', { status: 'DELINEAMENTO', tipoExecutor: 'interna' });
  assert.match(html, /CMP-01/);
  const iniServico = html.indexOf('Mão de obra');
  const linhaServico = html.slice(Math.max(0, iniServico - 20), iniServico + 120);
  assert.doesNotMatch(linhaServico, /CMP-01/);
});

// ══════════════════════════════════════════════════════════════════
// Task 3 — página Estoque: navegação injetada, lista, edição inline,
// cadastro e entrada
// ══════════════════════════════════════════════════════════════════

const MARCA_PAGINA_INI = '/* ── ESTOQUE: página, navegação injetada, edição inline ── */';
const MARCA_PAGINA_FIM = 'function openDrawer(){';
const MARCA_VOCAB_INI = '/* ── fluxo da OS interna: vocabulário e transições ── */';
const MARCA_VOCAB_FIM = 'function loadData(';

test('#bottom-nav continua com exatamente cinco .nav-btn na marcação', () => {
  const ini = HTML.indexOf('<div id="bottom-nav">');
  assert.ok(ini > 0, '#bottom-nav não encontrado');
  const fim = HTML.indexOf('</div>', ini);
  const trecho = HTML.slice(ini, fim);
  const qtd = (trecho.match(/class="nav-btn/g) || []).length;
  assert.equal(qtd, 5);
});

test('existe <div class="page" id="page-estoque"> na marcação, irmã de page-alert', () => {
  assert.match(HTML, /<div class="page" id="page-estoque">/);
});

test('MAN_ACOES_CARGO ganha a ação estoque com admin, gestor e tecnico', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(recorte(MARCA_VOCAB_INI, MARCA_VOCAB_FIM), ctx);
  eq(ctx.MAN_ACOES_CARGO.estoque.slice().sort(), ['admin', 'gestor', 'tecnico'].sort());
});

test('navTo despacha "estoque" para renderEstoque(); renderPaginaAtiva despacha page-estoque para renderEstoque()', () => {
  assert.match(HTML, /if\(page==='estoque'\) renderEstoque\(\);/);
  assert.match(HTML, /id==='page-estoque'\) renderEstoque\(\);/);
});

test('estInjectNav é chamada nas duas sequências de arranque, logo depois de estSondarEsquema()', () => {
  const acessoLivre = recorte('async function acessoLivre() {', '/* ═══════════════════════════════════════════════════════════\n   INIT');
  const initAppOnce = recorte('async function initAppOnce(){', 'window.initAppOnce = initAppOnce;');
  assert.match(acessoLivre, /await estSondarEsquema\(\);\s*\n\s*estInjectNav\(\);/);
  assert.match(initAppOnce, /await estSondarEsquema\(\);\s*\n\s*estInjectNav\(\);/);
});

// ── sandbox de navegação: DOM estrito (getElementById nunca auto-cria —
// é o que permite provar "não existe até ser injetado"), só para
// estInjectNav. ──
function carregarSandboxNav(opts) {
  opts = opts || {};
  const elementos = {};
  const bottomNav = { id: 'bottom-nav', appendChild(b) { elementos[b.id] = b; } };
  elementos['bottom-nav'] = bottomNav;
  const documentFalso = {
    getElementById(id) { return elementos[id] || null; },
    createElement() { return { id: '', className: '', innerHTML: '', onclick: null, classList: { add() {}, remove() {}, contains() { return false; } } }; },
  };
  const chamadasNavTo = [];
  const ctx = {
    document: documentFalso,
    el(id) { return documentFalso.getElementById(id); },
    navTo(page, btn) { chamadasNavTo.push({ page, btn }); },
  };
  vm.createContext(ctx);
  vm.runInContext(recorte(MARCA_INI, MARCA_FIM), ctx);
  vm.runInContext(recorte(MARCA_PAGINA_INI, MARCA_PAGINA_FIM), ctx);
  ctx.EST_OK = opts.estOk !== undefined ? opts.estOk : true;
  ctx._elementos = elementos;
  ctx._chamadasNavTo = chamadasNavTo;
  return ctx;
}

test('estInjectNav: com EST_OK falso, não cria botão nenhum', () => {
  const ctx = carregarSandboxNav({ estOk: false });
  ctx.estInjectNav();
  assert.strictEqual(ctx.el('nav-estoque'), null);
});

test('estInjectNav: com EST_OK true, cria um .nav-btn que chama navTo(\'estoque\',…); chamar duas vezes não duplica', () => {
  const ctx = carregarSandboxNav({ estOk: true });
  ctx.estInjectNav();
  const btn = ctx.el('nav-estoque');
  assert.ok(btn, 'botão não foi criado');
  assert.strictEqual(btn.className, 'nav-btn');
  btn.onclick();
  assert.strictEqual(ctx._chamadasNavTo.length, 1);
  assert.strictEqual(ctx._chamadasNavTo[0].page, 'estoque');
  ctx.estInjectNav(); // segunda chamada: não duplica
  const total = Object.keys(ctx._elementos).filter((k) => k.indexOf('nav-estoque') === 0).length;
  assert.strictEqual(total, 1);
});

// ── sandbox da página: el() AUTO-CRIA (mesma forma de
// tests/refrigeracao-os-pagina.test.js:criarSandboxOS) — aqui o alvo é
// renderEstoque/estLinhaHtml/openMaterialForm/estSalvar*/openEntradaForm/
// estRegistrarEntrada, não a existência prévia de um nó. ──
function elFalso(id) {
  return { id: id, value: '', textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, contains() { return false; } } };
}
function carregarSandboxEstoquePagina(opts) {
  opts = opts || {};
  const nodes = {};
  const updatesLinha = [];
  const insertsMateriaisCadastro = [];
  const updatesMateriaisCadastro = [];
  const insertsMovimentosEntrada = [];
  const updatesMateriaisEntrada = [];
  const toasts = [];
  let chamadasCarregarMateriais = 0;

  const ctx = {
    esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    el(id) { return nodes[id] || (nodes[id] = elFalso(id)); },
    val(id) { const n = nodes[id]; return n ? n.value : ''; },
    fmtMoney(v) { return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ','); },
    manPode(acao) { return opts.podeGerir !== false && acao === 'estoque'; },
    podeEditarCadastro() { return opts.podeCadastro !== false; },
    openDrawer() {},
    closeDrawer() {},
    showToast(msg, tipo) { toasts.push({ msg, tipo }); },
    console: { warn() {}, error() {} },
    supa: {
      from(tabela) {
        if (tabela === 'materiais') {
          return {
            update(patch) {
              return {
                eq(col, val) {
                  updatesLinha.push({ id: val, patch });
                  if (opts.erroUpdate) return Promise.resolve({ error: { message: 'falhou' } });
                  return Promise.resolve({ error: null, data: null });
                },
              };
            },
            insert(payload) {
              insertsMateriaisCadastro.push(payload);
              return Promise.resolve({ error: null, data: Object.assign({ id: 99 }, payload) });
            },
          };
        }
        if (tabela === 'estoque_movimentos') {
          return {
            insert(payload) {
              insertsMovimentosEntrada.push(payload);
              return Promise.resolve({ error: null, data: payload });
            },
          };
        }
        throw new Error('tabela inesperada: ' + tabela);
      },
    },
  };

  vm.createContext(ctx);
  vm.runInContext(recorte(MARCA_INI, MARCA_FIM), ctx);
  vm.runInContext(recorte(MARCA_PAGINA_INI, MARCA_PAGINA_FIM), ctx);

  ctx.EST_OK = true;
  ctx.MATERIAIS = opts.materiais || [];
  ctx.carregarMateriais = function () { chamadasCarregarMateriais++; return Promise.resolve(); };

  ctx._updatesLinha = updatesLinha;
  ctx._insertsMateriaisCadastro = insertsMateriaisCadastro;
  ctx._updatesMateriaisCadastro = updatesMateriaisCadastro;
  ctx._insertsMovimentosEntrada = insertsMovimentosEntrada;
  ctx._updatesMateriaisEntrada = updatesMateriaisEntrada;
  ctx._toasts = toasts;
  ctx._nodes = nodes;
  ctx._chamadasCarregarMateriais = () => chamadasCarregarMateriais;
  return ctx;
}

test('renderEstoque: desenha uma linha por material ativo, com código/nome/tipo/aplicação/unidade/atual/mínimo/preço', () => {
  const ctx = carregarSandboxEstoquePagina({
    materiais: [{ id: 1, codigo: 'FLT-01', nome: 'Filtro de ar', tipo: 'consumivel', unidade: 'un', aplicacao: 'SPLIT', preco: 12.5, estoqueAtual: 8, estoqueMinimo: 2, ativo: true }],
  });
  ctx.renderEstoque();
  const html = ctx.el('page-estoque').innerHTML;
  assert.match(html, /FLT-01/);
  assert.match(html, /Filtro de ar/);
  assert.match(html, /SPLIT/);
  assert.match(html, /\(un\)/);
  assert.match(html, /8 \/ mín 2/);
  assert.match(html, /R\$ 12,50/);
});

test('renderEstoque: material abaixo do mínimo recebe o aviso; material em dia não recebe', () => {
  const ctx = carregarSandboxEstoquePagina({
    materiais: [
      { id: 1, codigo: 'A', nome: 'Abaixo', tipo: 'consumivel', unidade: 'un', preco: 1, estoqueAtual: 1, estoqueMinimo: 5, ativo: true },
      { id: 2, codigo: 'B', nome: 'Em dia', tipo: 'consumivel', unidade: 'un', preco: 1, estoqueAtual: 10, estoqueMinimo: 5, ativo: true },
    ],
  });
  ctx.renderEstoque();
  const html = ctx.el('page-estoque').innerHTML;
  const linhaA = html.slice(html.indexOf('mat-row-1'), html.indexOf('mat-row-2'));
  const linhaB = html.slice(html.indexOf('mat-row-2'));
  assert.match(linhaA, /pill-nok/);
  assert.doesNotMatch(linhaB, /pill-nok/);
});

test('renderEstoque: catálogo vazio mostra o estado vazio, nunca uma lista em branco', () => {
  const ctx = carregarSandboxEstoquePagina({ materiais: [] });
  ctx.renderEstoque();
  const html = ctx.el('page-estoque').innerHTML;
  assert.match(html, /class="empty"/);
});

test('renderEstoque: cargo sem a ação estoque e sem podeEditarCadastro não desenha controle de edição, entrada nem cadastro', () => {
  const ctx = carregarSandboxEstoquePagina({
    podeGerir: false,
    podeCadastro: false,
    materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', tipo: 'consumivel', unidade: 'un', preco: 1, estoqueAtual: 5, estoqueMinimo: 1, ativo: true }],
  });
  ctx.renderEstoque();
  const html = ctx.el('page-estoque').innerHTML;
  assert.doesNotMatch(html, /estIniciarEdicaoLinha/);
  assert.doesNotMatch(html, /openEntradaForm/);
  assert.doesNotMatch(html, /openMaterialForm/);
});

test('renderEstoque: a lista não consulta TELA_LARGA — a mesma nas duas larguras', () => {
  const corpo = recorte(MARCA_PAGINA_INI, MARCA_PAGINA_FIM);
  const funcao = corpo.slice(corpo.indexOf('function renderEstoque('), corpo.indexOf('function estLinhaHtml('));
  assert.doesNotMatch(funcao, /TELA_LARGA/);
});

test('estSalvarLinha: grava atual/mínimo/preço, recusa valores negativos, recusa cargo sem a ação, recarrega o catálogo', async () => {
  const ctx = carregarSandboxEstoquePagina({ materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 5, estoqueMinimo: 1 }] });
  ctx.el('est-ed-atual').value = '7';
  ctx.el('est-ed-minimo').value = '2';
  ctx.el('est-ed-preco').value = '10.5';
  await ctx.estSalvarLinha(1);
  assert.strictEqual(ctx._updatesLinha.length, 1);
  assert.strictEqual(ctx._updatesLinha[0].patch.estoque_atual, 7);
  assert.strictEqual(ctx._updatesLinha[0].patch.estoque_minimo, 2);
  assert.strictEqual(ctx._updatesLinha[0].patch.preco, 10.5);
  assert.strictEqual(ctx._chamadasCarregarMateriais(), 1);

  const ctxNeg = carregarSandboxEstoquePagina({ materiais: [{ id: 1 }] });
  ctxNeg.el('est-ed-atual').value = '-1';
  ctxNeg.el('est-ed-minimo').value = '2';
  await ctxNeg.estSalvarLinha(1);
  assert.strictEqual(ctxNeg._updatesLinha.length, 0);

  const ctxSemAcao = carregarSandboxEstoquePagina({ podeGerir: false, materiais: [{ id: 1 }] });
  await ctxSemAcao.estSalvarLinha(1);
  assert.strictEqual(ctxSemAcao._updatesLinha.length, 0);
});

test('estSalvarMaterial: insere quando não há id em edição e atualiza quando há; recusa sem podeEditarCadastro; recusa nome vazio; passa por materialParaDb', async () => {
  const ctx = carregarSandboxEstoquePagina({});
  ctx.el('mt-nome').value = 'Filtro novo';
  ctx.el('mt-codigo').value = 'F-99';
  ctx.el('mt-unidade').value = 'un';
  await ctx.estSalvarMaterial();
  assert.strictEqual(ctx._insertsMateriaisCadastro.length, 1);
  assert.strictEqual(ctx._insertsMateriaisCadastro[0].nome, 'Filtro novo');
  assert.strictEqual(ctx._insertsMateriaisCadastro[0].codigo, 'F-99');

  const ctxEd = carregarSandboxEstoquePagina({});
  ctxEd.EST_MATERIAL_EDIT_ID = 5;
  ctxEd.el('mt-nome').value = 'Filtro editado';
  await ctxEd.estSalvarMaterial();
  assert.strictEqual(ctxEd._updatesLinha.length, 1);
  assert.strictEqual(ctxEd._updatesLinha[0].id, 5);

  const ctxSemPerm = carregarSandboxEstoquePagina({ podeCadastro: false });
  ctxSemPerm.el('mt-nome').value = 'Não deveria gravar';
  await ctxSemPerm.estSalvarMaterial();
  assert.strictEqual(ctxSemPerm._insertsMateriaisCadastro.length, 0);

  const ctxSemNome = carregarSandboxEstoquePagina({});
  ctxSemNome.el('mt-nome').value = '   ';
  await ctxSemNome.estSalvarMaterial();
  assert.strictEqual(ctxSemNome._insertsMateriaisCadastro.length, 0);
});

test('estRegistrarEntrada: recusa quantidade zero/negativa, recusa cargo sem a ação, grava entrada com o motivo digitado, soma ao estoque_atual, não toca em os_id nenhum', async () => {
  const ctx = carregarSandboxEstoquePagina({ materiais: [{ id: 1, codigo: 'A', nome: 'Filtro', estoqueAtual: 10 }] });
  ctx.el('ent-qtd').value = '5';
  ctx.el('ent-motivo').value = 'Recebimento NF 123';
  await ctx.estRegistrarEntrada(1);
  assert.strictEqual(ctx._insertsMovimentosEntrada.length, 1);
  const mov = ctx._insertsMovimentosEntrada[0];
  assert.strictEqual(mov.tipo, 'entrada');
  assert.strictEqual(mov.motivo, 'Recebimento NF 123');
  assert.strictEqual('os_id' in mov, false);
  assert.strictEqual(ctx._updatesLinha[0].patch.estoque_atual, 15);

  const ctxZero = carregarSandboxEstoquePagina({ materiais: [{ id: 1, estoqueAtual: 10 }] });
  ctxZero.el('ent-qtd').value = '0';
  await ctxZero.estRegistrarEntrada(1);
  assert.strictEqual(ctxZero._insertsMovimentosEntrada.length, 0);

  const ctxSemAcao = carregarSandboxEstoquePagina({ podeGerir: false, materiais: [{ id: 1, estoqueAtual: 10 }] });
  ctxSemAcao.el('ent-qtd').value = '5';
  await ctxSemAcao.estRegistrarEntrada(1);
  assert.strictEqual(ctxSemAcao._insertsMovimentosEntrada.length, 0);
});

// ══════════════════════════════════════════════════════════════════
// Task 4 — alerta abaixo do mínimo em Alertas
// ══════════════════════════════════════════════════════════════════

function carregarSandboxAlerta(opts) {
  opts = opts || {};
  const ctx = {
    esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    el() { return null; },
    navTo() {},
  };
  vm.createContext(ctx);
  vm.runInContext(recorte(MARCA_INI, MARCA_FIM), ctx);
  vm.runInContext(recorte(MARCA_PAGINA_INI, MARCA_PAGINA_FIM), ctx);
  ctx.EST_OK = opts.estOk !== undefined ? opts.estOk : true;
  ctx.MATERIAIS = opts.materiais || [];
  return ctx;
}

test('estAlertaHtml: com EST_OK falso, devolve string vazia', () => {
  const ctx = carregarSandboxAlerta({ estOk: false, materiais: [{ id: 1, ativo: true, estoqueAtual: 0, estoqueMinimo: 5 }] });
  assert.strictEqual(ctx.estAlertaHtml(), '');
});

test('estAlertaHtml: com EST_OK true e nenhum material abaixo do mínimo, devolve string vazia — a seção só aparece quando há o que dizer', () => {
  const ctx = carregarSandboxAlerta({ estOk: true, materiais: [{ id: 1, ativo: true, estoqueAtual: 10, estoqueMinimo: 5 }] });
  assert.strictEqual(ctx.estAlertaHtml(), '');
});

test('estAlertaHtml: com EST_OK true e materiais abaixo do mínimo, devolve título, contagem, uma linha por material, e onclick leva à página Estoque', () => {
  const ctx = carregarSandboxAlerta({
    estOk: true,
    materiais: [
      { id: 1, codigo: 'A', nome: 'Filtro', ativo: true, estoqueAtual: 1, estoqueMinimo: 5 },
      { id: 2, codigo: 'B', nome: 'Correia', ativo: true, estoqueAtual: 0, estoqueMinimo: 2 },
    ],
  });
  const html = ctx.estAlertaHtml();
  assert.match(html, /Estoque abaixo do mínimo/);
  assert.match(html, /<span class="sec-count">2<\/span>/);
  assert.match(html, /Filtro/);
  assert.match(html, /Correia/);
  assert.match(html, /navTo\('estoque', el\('nav-estoque'\)\)/);
  assert.match(html, /class="alert-card"/);
});

test('renderAlerts: var estAlerta = estAlertaHtml() calculado depois de semHistCrit e antes do ramo TELA_LARGA', () => {
  const corpo = recorte('function renderAlerts(){', 'function atualizarBadgeAlertas(');
  const iniSemHist = corpo.indexOf('var semHistCrit');
  const iniEstAlerta = corpo.indexOf('var estAlerta = estAlertaHtml();');
  const iniTelaLarga = corpo.indexOf('if(TELA_LARGA){');
  assert.ok(iniSemHist >= 0 && iniEstAlerta > iniSemHist && iniTelaLarga > iniEstAlerta, 'ordem incorreta: semHistCrit -> estAlerta -> if(TELA_LARGA)');
});

test('renderAlerts: ramo TELA_LARGA só mostra "Nenhum alerta ativo" quando também não há alerta de estoque, e concatena estAlerta', () => {
  const corpo = recorte('function renderAlerts(){', 'function atualizarBadgeAlertas(');
  assert.match(corpo, /if\(!linhasTab\.length && !estAlerta\)/);
  assert.match(corpo, /tabDesenhar\('alert', COLS_ALERT, linhasTab, 'openDetail'\) \+ estAlerta/);
});

test('renderAlerts: ramo de cartões concatena estAlerta antes da decisão de estado vazio', () => {
  const corpo = recorte('function renderAlerts(){', 'function atualizarBadgeAlertas(');
  const iniHtmlEstAlerta = corpo.indexOf('html += estAlerta;');
  const iniIfHtml = corpo.indexOf('if(html){');
  assert.ok(iniHtmlEstAlerta >= 0 && iniIfHtml > iniHtmlEstAlerta, 'estAlerta não concatenado antes do bloco de total/estado vazio');
});

test('renderAlerts: atualizarBadgeAlertas(ag) continua aparecendo exatamente duas vezes — o distintivo não muda por causa do estoque', () => {
  const corpo = recorte('function renderAlerts(){', 'function atualizarBadgeAlertas(');
  const qtd = (corpo.match(/atualizarBadgeAlertas\(ag\)/g) || []).length;
  assert.strictEqual(qtd, 2);
});
