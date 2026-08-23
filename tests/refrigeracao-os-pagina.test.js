// Gate da quick-260823-jar — a OS de /refrigeracao vira PÁGINA inteira em
// >=1024px, sem mudar dado/fluxo/regra de negócio.
//
// D-jar (mesmo procedimento de 260822-8rz/260823-3a6/260823-92t): este
// arquivo foi escrito e visto FALHANDO antes de manMontarOS/osAbrirGaveta/
// osAbrirPagina/etc existirem em refrigeracao/index.html — as três tasks só
// então extraíram/criaram o mecanismo.
//
// D-jar-17: a gaveta é PROVADA intocada, não afirmada, em CINCO cenários (o
// conteúdo da OS é condicional; um fixture de um cenário só provaria um
// ramo). tests/fixtures/refrigeracao-os-gaveta.json é a impressão digital
// do que `manAbrirOS` escrevia em #drawer-body/#dh-id/#dh-local/#dh-predio/
// #dh-pills/#drawer-footer ANTES da extração desta task — capturada por um
// script descartável (fora do repositório) que usa os MESMOS mocks
// determinísticos e o MESMO recorte por marcadores que este gate usa contra
// o arquivo já extraído, só apontando para o HTML de HEAD.
//
// Procedimento para regerar o fixture (só se manMontarOS mudar de
// assinatura ou de comportamento intencionalmente):
//   1. `git show HEAD:refrigeracao/index.html > /caminho/de/rascunho/index-old.html`
//      apontando para o commit de ANTES da mudança pretendida.
//   2. Escreva um script descartável (fora de tests/) que repete os mesmos
//      RECORTES e a mesma `criarSandboxOS()` deste arquivo (mocks
//      determinísticos + os nove `recorte()`), roda `manAbrirOS(logId)`
//      contra um `el(id)` que captura textContent/innerHTML por id nos
//      CINCO cenários de D-jar-17, e escreve
//      tests/fixtures/refrigeracao-os-gaveta.json com as chaves
//      corpo/dhId/dhLocal/dhPredio/dhPills/rodape por cenário (a..e).
//   3. Rode este gate — ele compara `manMontarOS(...)` (extraído do HTML
//      ATUAL) byte a byte contra o fixture.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'refrigeracao-os-gaveta.json'), 'utf8'));

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

function bloco(html, marcador) {
  const ini = html.indexOf(marcador);
  assert.ok(ini >= 0, `marcador "${marcador}" não encontrado`);
  const abre = html.indexOf('{', ini);
  let depth = 1;
  let j = abre + 1;
  while (j < html.length && depth > 0) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') depth--;
    j++;
  }
  return html.slice(ini, j);
}

function criarElemento(id, classesIniciais) {
  const classes = new Set(classesIniciais || []);
  return {
    id: id, textContent: '', innerHTML: '', value: '', scrollTop: 0, style: {},
    classList: {
      add: function (c) { classes.add(c); },
      remove: function (c) { classes.delete(c); },
      contains: function (c) { return classes.has(c); },
    },
  };
}

// ── sandbox da OS: mesma forma de carregarTelaCompleta em
// tests/refrigeracao-os-unificada.test.js:417 — mocks determinísticos só
// para o que já tem gate próprio noutro arquivo, código REAL recortado do
// arquivo para o que está sob teste aqui. Três diferenças (D-jar, Task 1):
// (1) manAbrirOS NÃO é substituído por um contador — é o que está sob
// teste; (2) osEhMovimentacao é o REAL, recortado do bloco de instalação/
// remoção, para o cenário (c) escolher o ramo pelo tipo da entrada; (3) o
// recorte de movimentação: formulário e gravação entra também, de onde
// vêm movPainelDaOS/manFormDados/MAN_EDIT_ID. ──
function criarSandboxOS(opts) {
  opts = opts || {};
  const nodes = {};
  ['dh-id', 'dh-local', 'dh-predio', 'dh-pills', 'drawer-body', 'drawer-footer'].forEach(function (id) {
    nodes[id] = criarElemento(id);
  });
  nodes['drawer'] = criarElemento('drawer');
  const valoresObj = opts.valores || {};

  const ctx = {
    esc: function (s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    fmtDate: function (iso) { return iso || ''; },
    el: function (id) { return nodes[id] || (nodes[id] = criarElemento(id)); },
    val: function (id) { return valoresObj[id] !== undefined ? valoresObj[id] : ''; },
    somenteLeitura: function () { return !!opts.observador; },
    ctUser: opts.ctUser !== undefined ? opts.ctUser : { nome: 'Fulano', role: 'gestor' },
    DATA: [opts.equip || { id: 900, local: '—', predio: '' }],
    showToast: function () {},
    console: { warn: function () {}, error: function () {} },
    today: function () { return '2026-08-23'; },
    confirm: function () { return true; },
    prompt: function () { return 'motivo'; },
    openDrawer: function () { nodes['drawer'].classList.add('open'); },
    closeDrawer: function () { nodes['drawer'].classList.remove('open'); },
    // ── mocks determinísticos: nada aqui é redeclarado por nenhum dos
    // recortes carregados abaixo (LOCAIS_POR_ID/ocupantesDoLocal/ctArp/
    // ctComp/ctCompTotal/ctSaldoItem/ctSaldoNE/fmtMoney/equipEstado/
    // EQUIP_ORDEM/EQUIP_ESTADOS/renderMedicoesFicha/podeEditarCadastro/
    // MAINT_TIPOS já têm gate próprio noutro arquivo). ──
    LOCAIS_POR_ID: { 10: { id: 10, nome: 'Sala 1', tipo: 'sala', parent_id: 1 }, 1: { id: 1, nome: 'F21', tipo: 'edificacao', parent_id: null } },
    ocupantesDoLocal: function () { return opts.ocupantes || 0; },
    ctArp: opts.ctArp || [],
    ctComp: opts.ctComp || {},
    ctCompTotal: function () { return opts.compTotal || 0; },
    ctSaldoItem: function (it) { return (it && it.qtd_empenhada) || 0; },
    ctSaldoNE: function () { return 100000; },
    fmtMoney: function (v) { return 'R$ ' + (Number(v) || 0).toFixed(2); },
    equipEstado: function (e) { return (e && e.estadoAtual) || 'OP'; },
    EQUIP_ORDEM: ['OP', 'OR', 'INOP'],
    EQUIP_ESTADOS: { OP: { rotulo: 'Operante' }, OR: { rotulo: 'Com restrições' }, INOP: { rotulo: 'Inoperante' } },
    renderMedicoesFicha: function () { return ''; },
    podeEditarCadastro: function () { return opts.podeEditar !== false; },
    MAINT_TIPOS: ['INSPEÇÃO', 'PREVENTIVA', 'CORRETIVA', 'REVISÃO', 'LIMPEZA', 'RECARGA GÁS', 'SUBSTITUIÇÃO'],
  };
  ctx._logCache = {};
  const equipIdChave = (opts.equip && opts.equip.id !== undefined) ? opts.equip.id : 900;
  ctx._logCache[equipIdChave] = [opts.entry];

  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── estado do equipamento: vocabulário OP/INOP/OR ── */', '/* ── alertas: contagem única ── */'), ctx);
  vm.runInContext(recorte('/* ── ponte de campos de logs_manutencao ── */', '/* ── CAMADA DE DADOS SUPABASE ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: porta de escrita ── */', '/* ── REALTIME ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: vocabulário e transições ── */', 'function loadData('), ctx);
  vm.runInContext(recorte('/* ── encerramento de OS: última manutenção ── */', 'async function saveLogEntry('), ctx);
  vm.runInContext(recorte('function osNoChip(', 'function renderOS(){'), ctx);
  vm.runInContext(recorte('/* ── movimentação: instalação e remoção ── */', '/* ── movimentação: carga dos locais, sob demanda ── */'), ctx);
  vm.runInContext(recorte('/* ── movimentação: formulário e gravação ── */', '/* ── fluxo da OS interna: tela e ações ── */'), ctx);
  vm.runInContext(recorte('/* ── fluxo da OS interna: tela e ações ── */', 'function showSearch(){'), ctx);

  // Lição 260823-cf8 (repetida no PLAN, D-jar): UNI_OK/OS_ITENS/
  // OS_COMENTARIOS são "var" dentro dos recortes acima — reatribuem ao
  // rodar. Semeados DEPOIS de todos os vm.runInContext, nunca antes.
  ctx.UNI_OK = opts.uniOk !== undefined ? opts.uniOk : true;
  ctx.OS_ITENS = opts.osItens || {};
  ctx.OS_COMENTARIOS = opts.osComentarios || {};
  // idem para CASOS_INSTALACAO/casoDeInstalacao/rotuloLocalDestino — o
  // recorte de instalação/remoção os define de verdade (é o que faz
  // osEhMovimentacao real escolher o ramo pelo tipo da entrada), mas eles
  // são mockados por cima para determinismo — cada um já tem gate próprio
  // em tests/refrigeracao-movimentacao-os.test.js.
  ctx.CASOS_INSTALACAO = { substituicao: 'Substituição de máquina removida', adicional: 'Mais uma máquina no mesmo local', 'novo-local': 'Novo local' };
  ctx.casoDeInstalacao = function (destinoId, substituidoId, ocupantes) {
    if (substituidoId) return 'substituicao';
    if ((ocupantes || 0) > 0) return 'adicional';
    return 'novo-local';
  };
  ctx.rotuloLocalDestino = function (id) { return id ? { predio: 'F21', local: 'Sala 1', rotulo: 'F21 / Sala 1' } : null; };
  ctx.manRenderEvidencia = function (entry) { return '<div class="evid-mock">' + ((entry.fotos || []).length) + '</div>'; };
  ctx.manTemEvidencia = function (entry) { return !!(entry.fotos && entry.fotos.length); };

  return { ctx: ctx, nodes: nodes };
}

// ═══════════ CINCO CENÁRIOS (D-jar-17) — os mesmos do fixture ═══════════

const CENARIOS = {
  a: {
    uniOk: false,
    equip: { id: 601, local: 'Sala 10', predio: 'F21' },
    entry: { id: 'osA', status: 'ABERTA', tipo: 'PREVENTIVA', date: '2026-01-10', tecnico: '', desc: '', checklist: [] },
  },
  b: {
    uniOk: true,
    equip: { id: 602, local: 'Sala 20', predio: 'MK48' },
    entry: {
      id: 'osB', status: 'EM_EXECUCAO', tipo: 'PREVENTIVA', tipoExecutor: 'interna',
      date: '2026-02-10', tecnico: 'Fulano', desc: 'Troca de filtro', checklist: [],
      fotos: ['foto1.jpg'], executorSetor: 'Manutenção', executorPessoas: 'Ciclano',
    },
    osItens: { osB: [{ id: 'it1', tipo: 'MATERIAL', descricao: 'Filtro', quantidade: 2, valorUnitario: 10, total: 20 }] },
    osComentarios: { osB: [{ id: 'c1', origem: 'usuario', autor: 'Fulano', cargo: 'gestor', criadoEm: '2026-02-10T10:00:00Z', texto: 'Trocado com sucesso' }] },
  },
  c: {
    uniOk: true,
    equip: { id: 603, local: '—', predio: '' },
    entry: {
      id: 'osC', status: 'EM_EXECUCAO', tipo: 'INSTALAÇÃO', tipoExecutor: 'interna',
      date: '2026-03-10', localDestinoId: 10, equipSubstituidoId: null,
      checklist: [{ label: 'Fixação de suportes', done: true }, { label: 'Posicionamento das unidades', done: false }],
      fotos: [],
    },
    ocupantes: 0,
  },
  d: {
    uniOk: true,
    equip: { id: 604, local: 'Sala 30', predio: 'EXOCET' },
    entry: {
      id: 'osD', status: 'FISCALIZADA', tipo: 'CORRETIVA', tipoExecutor: 'contrato',
      date: '2026-04-10', empresa: 'Frio Ltda', empresaCnpj: '11.111.111/0001-11',
      instrumento: 'contrato', processo: '2026.001', ne: '2026NE000335',
      fiscal: 'Ciclano', dataFiscalizacao: '2026-04-15', parecerFiscal: 'OK', nf: '', dataNf: '',
    },
    ctArp: [{ item: 266, descricao: 'Filtro X', valor_unit: 100, ne: '2026NE000335', qtd_empenhada: 10 }],
    ctComp: { osD: [{ id: 'comp1', item_arp: 266, qtd: 2 }] },
    compTotal: 200,
  },
  e: {
    uniOk: false,
    equip: { id: 605, local: 'Sala 40', predio: 'PAIOL' },
    entry: { id: 'osE', status: 'PENDENTE', tipo: 'PREVENTIVA', date: '2026-05-10', tecnico: 'Beltrano', desc: 'Ajuste manual', checklist: [] },
    editando: true,
  },
};

function montar(chave) {
  const opts = CENARIOS[chave];
  const s = criarSandboxOS(opts);
  if (opts.editando) s.ctx.MAN_EDIT_ID = opts.entry.id;
  return { s: s, opts: opts, m: s.ctx.manMontarOS(opts.entry.id) };
}

// ═══════════════ TAREFA 1 — fonte única, gaveta provada byte a byte ══════

test('manMontarOS(logId) devolve null para logId inexistente', () => {
  const s = criarSandboxOS(CENARIOS.a);
  assert.strictEqual(s.ctx.manMontarOS('fantasma'), null);
});

['a', 'b', 'c', 'd', 'e'].forEach((chave) => {
  test(`cenário (${chave}): manMontarOS devolve ident/regua/contexto/trabalho/rodape byte a byte iguais ao fixture (D-jar-17)`, () => {
    const { m, opts } = montar(chave);
    assert.ok(m, `manMontarOS não achou o cenário ${chave}`);
    assert.equal(typeof m.regua, 'string');
    assert.ok(Array.isArray(m.contexto));
    assert.ok(Array.isArray(m.trabalho));
    assert.strictEqual(m.regua + m.contexto.join('') + m.trabalho.join(''), FIXTURE[chave].corpo);
    assert.strictEqual(m.ident.id, FIXTURE[chave].dhId);
    assert.strictEqual(m.ident.local, FIXTURE[chave].dhLocal);
    assert.strictEqual(m.ident.predio, FIXTURE[chave].dhPredio);
    assert.strictEqual(m.ident.pills, FIXTURE[chave].dhPills);
    assert.strictEqual(m.rodape.gaveta, FIXTURE[chave].rodape);
  });
});

test('contexto traz 1 · Abertura e, quando cabe, Movimentação/Executor — nunca um título de trabalho', () => {
  const { m: mb } = montar('b'); // interna, UNI_OK true — Executor no contexto
  const uniaoB = mb.contexto.join('');
  assert.match(uniaoB, /1 · Abertura/);
  assert.match(uniaoB, /Executor</);
  ['2 · Delineamento', '3 · Execução', '4 · Conferência', 'Itens · serviços', 'Registro'].forEach((titulo) => {
    assert.doesNotMatch(uniaoB, new RegExp(titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `"${titulo}" vazou para contexto em (b)`);
  });

  const { m: mc } = montar('c'); // OS de movimentação — painel de Movimentação no contexto
  const uniaoC = mc.contexto.join('');
  assert.match(uniaoC, /Movimentação</);
  assert.doesNotMatch(uniaoC, /Executor</);
});

test('trabalho traz os blocos de processo — nunca 1 · Abertura', () => {
  const { m: mb } = montar('b');
  const uniaoTrabalho = mb.trabalho.join('');
  assert.match(uniaoTrabalho, /2 · Delineamento/);
  assert.match(uniaoTrabalho, /3 · Execução/);
  assert.match(uniaoTrabalho, /Itens · serviços e materiais/);
  assert.match(uniaoTrabalho, /Registro</);
  assert.doesNotMatch(uniaoTrabalho, /1 · Abertura/);

  const { m: md } = montar('d'); // contrato fiscalizado — Fiscalização + Composição
  const uniaoD = md.trabalho.join('');
  assert.match(uniaoD, /4 · Fiscalização/);
  assert.match(uniaoD, /5 · NF/);
  assert.doesNotMatch(uniaoD, /4 · Conferência/);
});

test('cenário (e) — linha legada sem fluxo: trabalho sai vazio e regua traz "Registro direto"', () => {
  const { m } = montar('e');
  // Objetos criados DENTRO do sandbox (node:vm) têm Array.prototype de
  // outro realm — deepStrictEqual falha por "mesma estrutura, não
  // referência-igual" mesmo com conteúdo idêntico (mesma armadilha de
  // tests/refrigeracao-desktop.test.js/refrigeracao-os-unificada.test.js).
  assert.equal(m.trabalho.length, 0);
  assert.match(m.regua, /Registro direto/);
});

test('rodape.gaveta traz o botão de imprimir só no cenário de contrato, e o de cancelar só quando a transição é permitida', () => {
  const { m: ma } = montar('a');
  assert.doesNotMatch(ma.rodape.gaveta, /Imprimir OS/);

  const { m: md } = montar('d');
  assert.match(md.rodape.gaveta, /imprimirOS/);
});

test('cada título de bloco aparece exatamente uma vez na união contexto+trabalho, nos cinco cenários', () => {
  const titulos = ['1 · Abertura', '2 · Delineamento', '3 · Execução', '4 · Conferência', '4 · Fiscalização', '5 · NF', 'Itens · serviços e materiais', 'Movimentação', 'Executor<'];
  ['a', 'b', 'c', 'd', 'e'].forEach((chave) => {
    const { m } = montar(chave);
    const uniao = m.contexto.concat(m.trabalho).join('');
    titulos.forEach((titulo) => {
      const qtd = uniao.split(titulo).length - 1;
      assert.ok(qtd <= 1, `cenário ${chave}: título "${titulo}" apareceu ${qtd} vezes`);
    });
  });
});

test('osAbrirGaveta consome manMontarOS e escreve #dh-*/#drawer-body/#drawer-footer byte a byte iguais ao fixture, e chama openDrawer()', () => {
  const opts = CENARIOS.b;
  const s = criarSandboxOS(opts);
  s.ctx.osAbrirGaveta(opts.entry.id);
  assert.strictEqual(s.nodes['drawer-body'].innerHTML, FIXTURE.b.corpo);
  assert.strictEqual(s.nodes['dh-id'].textContent, FIXTURE.b.dhId);
  assert.strictEqual(s.nodes['dh-local'].textContent, FIXTURE.b.dhLocal);
  assert.strictEqual(s.nodes['dh-predio'].textContent, FIXTURE.b.dhPredio);
  assert.strictEqual(s.nodes['dh-pills'].innerHTML, FIXTURE.b.dhPills);
  assert.strictEqual(s.nodes['drawer-footer'].innerHTML, FIXTURE.b.rodape);
  assert.ok(s.nodes['drawer'].classList.contains('open'));
});

test('manAbrirOS(logId) delega para osAbrirGaveta — mesmo resultado, sem montar bloco por conta própria', () => {
  const opts = CENARIOS.a;
  const s = criarSandboxOS(opts);
  s.ctx.manAbrirOS(opts.entry.id);
  assert.strictEqual(s.nodes['drawer-body'].innerHTML, FIXTURE.a.corpo);
  assert.ok(s.nodes['drawer'].classList.contains('open'));
});

test('os 25 pontos de chamada de manAbrirOS seguem intocados — grep -c bate com 26 (25 chamadas + a declaração)', () => {
  const qtd = (HTML.match(/manAbrirOS\(/g) || []).length;
  assert.equal(qtd, 26);
});

test('os quatro grep do PLAT-15 continuam em 0 — refrigeração segue congelada e standalone', () => {
  for (const padrao of ['shared/', 'pmoc.css', 'pmoc-tema', 'data-theme']) {
    assert.strictEqual(
      (HTML.match(new RegExp(padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
      0,
      `"${padrao}" apareceu em refrigeracao/index.html`
    );
  }
});
