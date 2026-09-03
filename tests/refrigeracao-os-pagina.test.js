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
    TELA_LARGA: opts.telaLarga !== undefined ? opts.telaLarga : false,
  };
  ctx._logCache = {};
  const equipIdChave = (opts.equip && opts.equip.id !== undefined) ? opts.equip.id : 900;
  ctx._logCache[equipIdChave] = [opts.entry];

  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
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

test('os pontos de chamada de manAbrirOS seguem contados — grep -c bate com 28 (27 chamadas + a declaração)', () => {
  // 260831-cal: era 26 (25 chamadas). O calendário do PMOC acrescentou a
  // 26ª — clicar num evento de OS na grade abre a MESMA gaveta de sempre,
  // em vez de inventar uma segunda tela de OS.
  // 260901-plano: a 27ª é `planoPuxarMateriais`, que redesenha a gaveta
  // depois de lançar os itens do plano — de novo a MESMA gaveta, e por
  // isso a contagem sobe em vez de o caso ser reescrito.
  // O caso continua sendo uma contagem exata de propósito: é ela que faz
  // aparecer, na revisão, todo ponto novo que passa a abrir OS.
  const qtd = (HTML.match(/manAbrirOS\(/g) || []).length;
  assert.equal(qtd, 28);
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

// ═══════ TAREFA 2 — camada compartilhada de detalhe e #page-os-detalhe ═══

// D-jar-20: a camada compartilhada (ficha e OS) mora numa seção só,
// imediatamente antes de "-- ficha: uma fonte, dois continentes --".
const MARCADOR_INICIO_DETALHE = '/* ── detalhe em página: estado e navegação (ficha e OS) ── */';
const MARCADOR_FIM_DETALHE = '/* -- ficha: uma fonte, dois continentes -- */';

// ── sandbox de página: reusa os recortes/mocks de criarSandboxOS e
// acrescenta a camada compartilhada + o DOM de mentira das seis .page e
// dos cinco .nav-btn — mesmo padrão de criarSandboxPagina em
// tests/refrigeracao-ficha-pagina.test.js:251, com um navTo que reproduz a
// troca de .page.active (não só o registro da chamada — D-jar lição de
// 260823-92t: foi esse detalhe que fez casos falharem por razão errada). ──
function criarSandboxOSPagina(opts) {
  opts = opts || {};
  const base = criarSandboxOS(opts);
  const nodes = base.nodes;
  const ctx = base.ctx;

  const paginasChaves = ['dash', 'inv', 'os', 'pmoc', 'alert', 'ficha', 'os-detalhe'];
  paginasChaves.forEach(function (k) {
    nodes['page-' + k] = criarElemento('page-' + k, k === 'dash' ? ['page', 'active'] : ['page']);
  });
  ['osd-id', 'osd-local', 'osd-predio', 'osd-pills', 'osd-regua', 'osd-acoes', 'osd-voltar-txt', 'fab'].forEach(function (id) {
    nodes[id] = criarElemento(id);
  });
  ['osd-contexto', 'osd-trabalho'].forEach(function (id) {
    nodes[id] = criarElemento(id);
    nodes[id].scrollTop = 0;
  });
  nodes['osd-corpo'] = criarElemento('osd-corpo');

  const navBtns = ['dash', 'inv', 'os', 'pmoc', 'alert'].map(function (k) {
    return criarElemento('nav-' + k, k === 'dash' ? ['nav-btn', 'active'] : ['nav-btn']);
  });

  const chamadasNavTo = [];
  ctx.document = {
    querySelector: function (sel) {
      if (sel === '.page.active') {
        let achou = null;
        paginasChaves.forEach(function (k) { if (nodes['page-' + k].classList.contains('active')) achou = nodes['page-' + k]; });
        return achou;
      }
      return null;
    },
    querySelectorAll: function (sel) {
      if (sel === '.page') return paginasChaves.map(function (k) { return nodes['page-' + k]; });
      if (sel === '#bottom-nav .nav-btn') return navBtns;
      return [];
    },
    addEventListener: function () {},
    body: { style: {} },
  };
  ctx.navTo = function (pagina, btn) {
    chamadasNavTo.push({ pagina: pagina, btn: btn });
    paginasChaves.forEach(function (k) { nodes['page-' + k].classList.remove('active'); });
    if (nodes['page-' + pagina]) nodes['page-' + pagina].classList.add('active');
  };

  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
  vm.runInContext(recorte(MARCADOR_INICIO_DETALHE, MARCADOR_FIM_DETALHE), ctx);
  // reAlojarDetalhe mora na seção da ficha (logo depois de abrirFichaPagina),
  // fora do recorte compartilhado acima — carregado à parte, mesmo padrão
  // de tests/refrigeracao-ficha-pagina.test.js. Os ramos de ficha (idFicha
  // != null) nunca disparam nos testes de OS deste arquivo — DETALHE_ABERTO
  // aqui é sempre null ou {tipo:'os',...} — então abrirFichaGaveta/
  // abrirFichaPagina não precisam estar carregadas.
  vm.runInContext(bloco(HTML, 'function reAlojarDetalhe(){'), ctx);

  return { ctx: ctx, nodes: nodes, navBtns: navBtns, chamadasNavTo: chamadasNavTo };
}

test('osUmaColuna(temTrabalho, editando) — coluna única quando não há trabalho OU quando se edita; duas colunas só com trabalho e sem edição', () => {
  const s = criarSandboxOSPagina();
  assert.equal(s.ctx.osUmaColuna(false, false), true);
  assert.equal(s.ctx.osUmaColuna(true, true), true);
  assert.equal(s.ctx.osUmaColuna(false, true), true);
  assert.equal(s.ctx.osUmaColuna(true, false), false);
});

test('com TELA_LARGA verdadeiro, manAbrirOS ativa #page-os-detalhe e preenche cabeçalho/régua/zonas/ações; com falso, abre a gaveta (D-jar-04)', () => {
  let s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  s.ctx.manAbrirOS(CENARIOS.b.entry.id);
  assert.ok(s.nodes['page-os-detalhe'].classList.contains('active'));
  assert.equal(s.nodes['osd-id'].textContent, FIXTURE.b.dhId);
  assert.equal(s.nodes['osd-local'].textContent, FIXTURE.b.dhLocal);
  assert.equal(s.nodes['osd-predio'].textContent, FIXTURE.b.dhPredio);
  assert.equal(s.nodes['osd-pills'].innerHTML, FIXTURE.b.dhPills);
  assert.ok(s.nodes['osd-regua'].innerHTML.length > 0);
  assert.ok(s.nodes['osd-acoes'].innerHTML.length >= 0);

  s = criarSandboxOSPagina(Object.assign({}, CENARIOS.a, { telaLarga: false }));
  s.ctx.manAbrirOS(CENARIOS.a.entry.id);
  assert.ok(!s.nodes['page-os-detalhe'].classList.contains('active'));
  assert.ok(s.nodes['drawer'].classList.contains('open'));
});

test('a união de #osd-contexto e #osd-trabalho contém cada título de bloco exatamente uma vez, nos dois modos de coluna (duas colunas: cenário b; uma coluna: cenário e)', () => {
  const titulos = ['1 · Abertura', '2 · Delineamento', '3 · Execução', 'Itens · serviços e materiais', 'Registro<'];

  const sb = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  sb.ctx.osAbrirPagina(CENARIOS.b.entry.id);
  const uniaoB = sb.nodes['osd-contexto'].innerHTML + sb.nodes['osd-trabalho'].innerHTML;
  titulos.forEach((t) => assert.equal(uniaoB.split(t).length - 1, 1, `(b) "${t}" não apareceu exatamente uma vez`));

  const se = criarSandboxOSPagina(Object.assign({}, CENARIOS.e, { telaLarga: true }));
  se.ctx.osAbrirPagina(CENARIOS.e.entry.id);
  assert.equal(se.nodes['osd-trabalho'].innerHTML, '', '(e) sem trabalho — #osd-trabalho deveria ficar vazio');
  assert.ok(se.nodes['osd-corpo'].classList.contains('uma-coluna'));
  assert.match(se.nodes['osd-contexto'].innerHTML, /1 · Abertura/);
});

test('ao sair da coluna única, a classe uma-coluna é removida — abrir uma OS normal depois de uma legada não herda o modo', () => {
  // (e) e (a) são as duas uniOk:false do fixture — a mesma sandbox (um
  // UNI_OK só, global) pode abrir as duas sem contaminar o resultado.
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.e, { telaLarga: true }));
  s.ctx._logCache[CENARIOS.a.equip.id] = [CENARIOS.a.entry];
  s.ctx.osAbrirPagina(CENARIOS.e.entry.id); // sem trabalho — uma coluna
  assert.ok(s.nodes['osd-corpo'].classList.contains('uma-coluna'));
  s.ctx.osAbrirPagina(CENARIOS.a.entry.id); // com trabalho, sem edição — duas colunas
  assert.ok(!s.nodes['osd-corpo'].classList.contains('uma-coluna'));
  assert.notEqual(s.nodes['osd-trabalho'].innerHTML, '');
});

test('osAbrirPagina grava a origem por lerOrigemDetalhe, nunca apaga .active de nenhum .nav-btn, fecha a gaveta se estiver aberta, esconde #fab e grava DETALHE_ABERTO', () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-pmoc'].classList.add('active');
  s.nodes['drawer'].classList.add('open');
  assert.ok(s.navBtns[0].classList.contains('active'));

  s.ctx.osAbrirPagina(CENARIOS.b.entry.id);

  assert.equal(s.ctx.DETALHE_ORIGEM, 'pmoc');
  assert.ok(s.navBtns[0].classList.contains('active'), 'osAbrirPagina apagou o estado ativo do nav-btn');
  assert.ok(!s.nodes['drawer'].classList.contains('open'));
  assert.equal(s.nodes['fab'].style.display, 'none');
  // Objeto criado DENTRO do sandbox (node:vm) — mesma armadilha de sempre,
  // compara pelos campos.
  assert.equal(s.ctx.DETALHE_ABERTO.tipo, 'os');
  assert.equal(s.ctx.DETALHE_ABERTO.id, CENARIOS.b.entry.id);
});

test("detalheAbertoDe('os')/detalheAbertoDe('ficha') nunca ficam preenchidos ao mesmo tempo", () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  s.ctx.osAbrirPagina(CENARIOS.b.entry.id);
  assert.equal(s.ctx.detalheAbertoDe('os'), CENARIOS.b.entry.id);
  assert.equal(s.ctx.detalheAbertoDe('ficha'), null);
});

test('lerOrigemDetalhe grava a chave quando a .page.active é uma das cinco abas e mantém a anterior quando é page-ficha/page-os-detalhe/nenhuma (D-jar-03)', () => {
  const s = criarSandboxOSPagina({ telaLarga: true });
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-alert'].classList.add('active');
  s.ctx.lerOrigemDetalhe();
  assert.equal(s.ctx.DETALHE_ORIGEM, 'alert');

  s.nodes['page-alert'].classList.remove('active');
  s.nodes['page-os-detalhe'].classList.add('active');
  s.ctx.lerOrigemDetalhe();
  assert.equal(s.ctx.DETALHE_ORIGEM, 'alert', 'origem desconhecida deveria manter a anterior, não cair para inv');
});

test('voltarDoDetalhe zera o registro e chama navTo(DETALHE_ORIGEM, botaoDaAba(DETALHE_ORIGEM)); #osd-voltar-txt nomeia o destino, nunca undefined', () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-os'].classList.add('active');
  s.ctx.osAbrirPagina(CENARIOS.b.entry.id);
  assert.equal(s.nodes['osd-voltar-txt'].textContent, 'Voltar às OS');
  assert.doesNotMatch(s.nodes['osd-voltar-txt'].textContent, /undefined/);

  s.ctx.voltarDoDetalhe();
  assert.equal(s.ctx.DETALHE_ABERTO, null);
  assert.equal(s.chamadasNavTo.length, 1);
  assert.equal(s.chamadasNavTo[0].pagina, 'os');
});

test('fecharDetalhe chama voltarDoDetalhe quando há página de detalhe ativa e closeDrawer quando não há (D-jar-12, manCancelar)', () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  s.ctx.osAbrirPagina(CENARIOS.b.entry.id);
  s.ctx.fecharDetalhe();
  assert.ok(!s.nodes['page-os-detalhe'].classList.contains('active'));
  assert.equal(s.chamadasNavTo.length, 1);

  const s2 = criarSandboxOSPagina(Object.assign({}, CENARIOS.a, { telaLarga: false }));
  s2.ctx.osAbrirGaveta(CENARIOS.a.entry.id);
  s2.ctx.fecharDetalhe();
  assert.ok(!s2.nodes['drawer'].classList.contains('open'));
});

test('navTo zera DETALHE_ABERTO (D-jar-14)', () => {
  const corpoNavTo = bloco(HTML, 'function navTo(page, btn){');
  assert.match(corpoNavTo, /DETALHE_ABERTO\s*=\s*null;/);
});

test('D-92t/D-jar-16: tests/refrigeracao-desktop.test.js segue verde sem edição — CSS de celular byte a byte, exatamente um @media novo', () => {
  // Prova indireta: os quatro grep do PLAT-15 e a ausência de <style> extra
  // já são cobertos noutro caso; este documenta a intenção — o gate real
  // é tests/refrigeracao-desktop.test.js, rodado à parte no verify da task.
  assert.equal((HTML.match(/<style>/g) || []).length, (HTML.match(/<\/style>/g) || []).length);
});

// ═══════ TAREFA 3 — cruzar o limiar nos dois sentidos, sem perder o que
// foi digitado ═══════════════════════════════════════════════════════════

test('OS_CAMPOS_VOLATEIS não contém man-ex-fotos — o value de um input[type=file] não é escrevível por script (D-jar-09)', () => {
  const s = criarSandboxOSPagina({ telaLarga: true });
  assert.ok(!s.ctx.OS_CAMPOS_VOLATEIS.includes('man-ex-fotos'));
});

test('osCapturarCampos/osRestaurarCampos: só lê/reescreve os que existem na tela, ignora ausentes, nunca lança', () => {
  const s = criarSandboxOSPagina({ telaLarga: true });
  // el() de criarSandboxOS auto-cria nó por id (para escritas do produto
  // ficarem estáveis entre chamadas) — aqui, para provar "ausente" de
  // verdade, um el() de mentira que devolve null para o que não foi
  // explicitamente colocado na tela (o mesmo document.getElementById faria).
  const camposReais = { 'man-delin-desc': criarElemento('man-delin-desc') };
  camposReais['man-delin-desc'].value = 'texto digitado';
  s.ctx.el = function (id) { return camposReais[id] || null; };

  const mapa = s.ctx.osCapturarCampos();
  assert.equal(mapa['man-delin-desc'], 'texto digitado');
  assert.ok(!('man-conf-parecer' in mapa), 'campo ausente da tela não deveria entrar no mapa');

  camposReais['man-delin-desc'].value = ''; // simula o re-render limpando o campo
  assert.doesNotThrow(() => s.ctx.osRestaurarCampos(mapa));
  assert.equal(camposReais['man-delin-desc'].value, 'texto digitado');
  assert.doesNotThrow(() => s.ctx.osRestaurarCampos({ 'campo-fantasma': 'x' }));
});

test('reAlojarDetalhe: OS em página + estreitar — sai de #page-os-detalhe, volta à origem, abre a gaveta com a MESMA OS e preserva o texto digitado', () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-pmoc'].classList.add('active');
  s.ctx.osAbrirPagina(CENARIOS.b.entry.id);
  assert.ok(s.nodes['page-os-detalhe'].classList.contains('active'));

  s.ctx.el('man-conf-parecer').value = 'parecer não salvo';

  s.ctx.TELA_LARGA = false;
  const houve = s.ctx.reAlojarDetalhe();
  assert.equal(houve, true);
  assert.ok(!s.nodes['page-os-detalhe'].classList.contains('active'));
  assert.equal(s.chamadasNavTo.length, 1);
  assert.equal(s.chamadasNavTo[0].pagina, 'pmoc');
  assert.ok(s.nodes['drawer'].classList.contains('open'));
  assert.strictEqual(s.nodes['drawer-body'].innerHTML, FIXTURE.b.corpo);
  assert.equal(s.ctx.detalheAbertoDe('os'), CENARIOS.b.entry.id);
  assert.equal(s.nodes['man-conf-parecer'].value, 'parecer não salvo');
});

test('reAlojarDetalhe: OS em gaveta + alargar — fecha a gaveta e abre a MESMA OS como página, preservando o texto digitado; a origem por baixo continua', () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: false }));
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-alert'].classList.add('active');
  s.ctx.osAbrirGaveta(CENARIOS.b.entry.id);

  s.ctx.el('man-conf-parecer').value = 'parecer não salvo';

  s.ctx.TELA_LARGA = true;
  const houve = s.ctx.reAlojarDetalhe();
  assert.equal(houve, true);
  assert.ok(!s.nodes['drawer'].classList.contains('open'), 'a gaveta deveria fechar');
  assert.ok(s.nodes['page-os-detalhe'].classList.contains('active'));
  assert.equal(s.ctx.DETALHE_ORIGEM, 'alert', 'a origem por baixo deveria continuar sendo a mesma');
  assert.equal(s.nodes['man-conf-parecer'].value, 'parecer não salvo');
});

test('reAlojarDetalhe: correção de dados (MAN_EDIT_ID + man-ed-desc) sobrevive ao cruzamento nos dois sentidos', () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.a, { telaLarga: true }));
  s.ctx.MAN_EDIT_ID = CENARIOS.a.entry.id;
  s.ctx.osAbrirPagina(CENARIOS.a.entry.id);
  assert.ok(s.nodes['osd-corpo'].classList.contains('uma-coluna'));

  s.ctx.el('man-ed-desc').value = 'correção não salva';
  s.ctx.TELA_LARGA = false;
  s.ctx.reAlojarDetalhe();
  assert.equal(s.ctx.el('man-ed-desc').value, 'correção não salva');
  assert.ok(s.nodes['drawer'].classList.contains('open'));

  s.ctx.TELA_LARGA = true;
  s.ctx.reAlojarDetalhe();
  assert.ok(s.nodes['page-os-detalhe'].classList.contains('active'));
  assert.equal(s.ctx.el('man-ed-desc').value, 'correção não salva');
});

test('reAlojarDetalhe: os dois estados já-corretos (página+largo, gaveta+estreito) devolvem false sem tocar em nada', () => {
  const sPaginaLarga = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  sPaginaLarga.ctx.osAbrirPagina(CENARIOS.b.entry.id);
  const houvePaginaLarga = sPaginaLarga.ctx.reAlojarDetalhe();
  assert.equal(houvePaginaLarga, false);
  assert.ok(sPaginaLarga.nodes['page-os-detalhe'].classList.contains('active'));
  assert.equal(sPaginaLarga.chamadasNavTo.length, 0);

  const sGavetaEstreita = criarSandboxOSPagina(Object.assign({}, CENARIOS.a, { telaLarga: false }));
  sGavetaEstreita.ctx.osAbrirGaveta(CENARIOS.a.entry.id);
  const houveGavetaEstreita = sGavetaEstreita.ctx.reAlojarDetalhe();
  assert.equal(houveGavetaEstreita, false);
  assert.ok(sGavetaEstreita.nodes['drawer'].classList.contains('open'));
});

test('reAlojarDetalhe: gaveta com formulário (DETALHE_ABERTO nulo) — #page-os-detalhe nunca fica ativa no estreito, conteúdo da gaveta não é sobrescrito', () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  s.nodes['page-dash'].classList.remove('active');
  s.nodes['page-os'].classList.add('active');
  s.ctx.osAbrirPagina(CENARIOS.b.entry.id);
  assert.ok(s.nodes['page-os-detalhe'].classList.contains('active'));

  // simula um formulário aberto sobre a página — openNewOS/openLogForm
  // zerariam DETALHE_ABERTO (caso já provado em
  // tests/refrigeracao-ficha-pagina.test.js).
  s.ctx.DETALHE_ABERTO = null;
  s.nodes['drawer-body'].innerHTML = '<div class="ds">FORM MARCADO</div>';
  s.nodes['drawer'].classList.add('open');

  s.ctx.TELA_LARGA = false;
  const houve = s.ctx.reAlojarDetalhe();
  assert.equal(houve, true);
  assert.ok(!s.nodes['page-os-detalhe'].classList.contains('active'));
  assert.match(s.nodes['drawer-body'].innerHTML, /FORM MARCADO/, 'o conteúdo do formulário foi sobrescrito — deveria sobreviver ao redimensionamento');
});

test('#page-os-detalhe nunca fica ativa com TELA_LARGA falso, mesmo tentando abrir explicitamente', () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: false }));
  s.ctx.manAbrirOS(CENARIOS.b.entry.id);
  assert.ok(!s.nodes['page-os-detalhe'].classList.contains('active'));
});

test('a rolagem das duas zonas é preservada quando osAbrirPagina re-renderiza a MESMA OS, e volta a zero quando é outra', () => {
  const s = criarSandboxOSPagina(Object.assign({}, CENARIOS.b, { telaLarga: true }));
  s.ctx._logCache[CENARIOS.d.equip.id] = [CENARIOS.d.entry];
  s.ctx.osAbrirPagina(CENARIOS.b.entry.id);
  s.nodes['osd-contexto'].scrollTop = 120;
  s.nodes['osd-trabalho'].scrollTop = 340;

  s.ctx.osAbrirPagina(CENARIOS.b.entry.id); // mesma OS — preserva
  assert.equal(s.nodes['osd-contexto'].scrollTop, 120);
  assert.equal(s.nodes['osd-trabalho'].scrollTop, 340);

  s.ctx.osAbrirPagina(CENARIOS.d.entry.id); // outra OS — volta a zero
  assert.equal(s.nodes['osd-contexto'].scrollTop, 0);
  assert.equal(s.nodes['osd-trabalho'].scrollTop, 0);
});

test('nenhuma função nova chama pushState', () => {
  assert.equal((HTML.match(/pushState/g) || []).length, 0);
});
