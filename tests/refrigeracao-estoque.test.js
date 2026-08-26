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
