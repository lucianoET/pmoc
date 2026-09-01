// Gate do fluxo de plano (/refrigeracao, migrações 54 e 55).
//
// O DEFEITO QUE ISTO CONSERTA: `checklistDaOS` terminava em
// `tabela[tipoEquip] || tabela['SPLIT']`, e `CHECKLIST` tem QUATRO
// chaves para um parque de SEIS tipos — a CENTRAL de 30 TR recebia o
// checklist do split, em silêncio. Ao mesmo tempo `plano_tarefas`, o
// plano real da NBR 17037, estava no banco desde a migração 04 e não era
// lido por tela nenhuma deste módulo.
//
// O que este arquivo trava:
//  - `aplica_a` É o escopo por tipo — nenhuma coluna nova respondendo a
//    mesma pergunta (o erro que D-eq-08 e a migração 52 registram);
//  - a regra de escopo mora num ponto só e é usada pelos três
//    consumidores (checklist, alcance, cobertura);
//  - com a sonda desligada, `checklistDaOS` se comporta byte a byte como
//    hoje, fallback errado incluído — consertá-lo sem migração mudaria
//    tela publicada (D-cf8-25);
//  - rótulo curto ESCRITO, nunca cortado, e nenhum rótulo de dado do
//    usuário dentro de etiqueta de largura fixa;
//  - o plano chega na OS pela porta de escrita que já existe
//    (`osAddItem`), nunca por um segundo insert em `os_itens`;
//  - nenhuma classe de CSS nova (D-cf8-20) e as cinco `.nav-btn`
//    intactas.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const SQL_54 = fs.readFileSync(path.join(RAIZ, 'supabase', '54_refrigeracao_plano_servicos.sql'), 'utf8');
const SQL_55 = fs.readFileSync(path.join(RAIZ, 'supabase', '55_refrigeracao_plano_servicos_seed.sql'), 'utf8');

function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
function semComentarioSql(txt) { return txt.replace(/^\s*--.*$/gm, ''); }
function semProsaSql(txt) {
  return semComentarioSql(txt).replace(/comment on[\s\S]*?is\s*'(?:[^']|'')*'\s*;/gi, ' ');
}

const MARCA_INI = '   PLANO DE MANUTENÇÃO — serviço padrão, material por serviço e regra';
const MARCA_FIM = '\nfunction planoAbrirTarefa(';

function recorte() {
  const ini = HTML.lastIndexOf('/* ═', HTML.indexOf(MARCA_INI));
  const fim = HTML.indexOf(MARCA_FIM, ini);
  assert.ok(ini > 0 && fim > ini, 'recorte da seção PLANO não encontrado');
  return HTML.slice(ini, fim);
}

function carregarNucleo() {
  const ctx = {
    esc: (s) => String(s === null || s === undefined ? '' : s)
      .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    el: () => null,
    equipInstalado: (e) => !!e && e.situacao === 'instalado',
    podeEditarCadastro: () => false,
    console: { warn() {} },
    supa: null,
  };
  vm.createContext(ctx);
  vm.runInContext(recorte(), ctx);
  return ctx;
}

const inst = (id, tipo, modelo) => ({ id, tipo, modelo: modelo || null, situacao: 'instalado' });

// ═══════════ uma pergunta, uma coluna ═══════════

test('`aplica_a` é o escopo — a migração NÃO cria uma segunda coluna de tipo', () => {
  const sql = semProsaSql(SQL_54);
  assert.match(sql, /alter table plano_tarefas add column if not exists aplica_modelo text/);
  assert.match(sql, /alter table plano_tarefas add column if not exists servico_id integer/);
  assert.ok(!/add column[^;]*tipo_equip/i.test(sql),
    'tipo_equip ao lado de aplica_a seriam duas colunas respondendo "a que equipamento se aplica"');
  assert.ok(!/alter table plano_tarefas[^;]*(drop|alter column aplica_a)/i.test(sql),
    'aplica_a não pode ser redefinida: as 9 linhas existentes valem como estão');
});

test('o tipo NÃO tem lista fechada — ao contrário de tipo_uso, ele é cadastro do usuário', () => {
  const sql = semProsaSql(SQL_54);
  assert.ok(!/aplica_a[^;]*check[^;]*in \(/i.test(sql),
    'um check recusaria o sétimo tipo que o usuário cadastrar em equipamentos.tipo');
  // O que TEM lista fechada é o que indexa constante, e aqui nada indexa.
  assert.match(sql, /quantidade numeric not null default 1 check \(quantidade > 0\)/,
    'quantidade zero num material do serviço sumiria da previsão sem erro');
});

test('material pendura no SERVIÇO, e aponta para o catálogo que o Estoque administra', () => {
  const sql = semProsaSql(SQL_54);
  assert.match(sql, /create table if not exists servico_materiais/);
  assert.match(sql, /servico_id integer not null references servicos\(id\) on delete cascade/);
  assert.match(sql, /material_id integer not null references materiais\(id\) on delete cascade/,
    'aponta para `materiais` (migração 44) — nunca uma segunda lista de peças');
  assert.match(sql, /unique \(servico_id, material_id\)/,
    'duas linhas do mesmo material fariam a quantidade depender da ordem de cadastro');
});

test('as migrações são aditivas — nada de drop, e a semente não apaga nem duplica', () => {
  for (const [nome, sql] of [['54', semProsaSql(SQL_54)], ['55', semProsaSql(SQL_55)]]) {
    assert.ok(!/\bdrop\b|\btruncate\b/i.test(sql), `migração ${nome}: o projeto arquiva, nunca apaga`);
  }
  assert.ok(!/\bdelete\b/i.test(semProsaSql(SQL_55)), 'a semente não apaga linha nenhuma');
  assert.match(SQL_55, /on conflict \(codigo\) do nothing/);
  assert.match(SQL_55, /and t\.servico_id is null/,
    'o update só toca tarefa ainda sem serviço — não desfaz ligação corrigida na tela');
});

test('a semente não inventa conteúdo técnico: os serviços saem das tarefas que já existem', () => {
  const sql = semProsaSql(SQL_55);
  assert.match(sql, /from plano_tarefas t/, 'os serviços são derivados do plano real, não escritos aqui');
  assert.match(sql, /t\.descricao/);
  assert.ok(!/insert into servico_materiais/i.test(sql),
    'materiais está vazia — apontar para peça inventada poria no plano o que o estoque não conhece');
  assert.ok(!/tempo_padrao_min\s*[,)]/i.test(sql.replace(/select[\s\S]*?from/i, ' ')),
    'tempo é medição de oficina; um número aqui competiria com os parâmetros de /equipes');
  assert.match(sql, /raise exception 'SEMENTE INCOMPLETA/,
    'semente que falha em silêncio é pior que semente que não roda');
});

// ═══════════ a sonda e o comportamento sem migração ═══════════

test('PLAN_OK é sonda PRÓPRIA e pede as COLUNAS NOVAS, não a tabela', () => {
  const fonte = semComentarios(HTML);
  assert.match(fonte, /var PLAN_OK = false;/);
  assert.match(fonte, /async function planoSondarEsquema\(\)/);
  assert.match(fonte, /supa\.from\('plano_tarefas'\)\.select\('id,servico_id,aplica_modelo'\)\.limit\(1\)/,
    'plano_tarefas existe desde a 04 em qualquer banco — só a coluna nova distingue');
});

test('PLAN_OK é declarada ao lado de checklistDaOS — a lição de D-6wy-08, quarta vez', () => {
  const iChk = HTML.indexOf('function checklistDaOS(');
  const iFlag = HTML.indexOf('var PLAN_OK = false;');
  assert.ok(iFlag > 0 && iChk > 0);
  assert.ok(iChk - iFlag > 0 && iChk - iFlag < 1200,
    'a sonda precisa estar no mesmo recorte de checklistDaOS, senão os gates daquela região dão ReferenceError');
});

test('sem a migração, checklistDaOS se comporta byte a byte como hoje — fallback errado incluído', () => {
  const ctx = { CHECKLIST: { SPLIT: ['a'], JANELA: ['b'] },
                CHECKLIST_REMOCAO: { SPLIT: ['r'] }, CHECKLIST_INSTALACAO: { SPLIT: ['i'] },
                PLAN_OK: false };
  vm.createContext(ctx);
  const ini = HTML.indexOf('function checklistDaOS(');
  vm.runInContext(HTML.slice(ini, HTML.indexOf('\n}', HTML.indexOf('return CHECKLIST[tipoEquip]', ini)) + 2), ctx);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.checklistDaOS(null, 'JANELA'))), ['b']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.checklistDaOS(null, 'CENTRAL'))), ['a'],
    'sem migração a CENTRAL continua caindo no split — mudar isso aqui alteraria tela publicada (D-cf8-25)');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.checklistDaOS('REMOÇÃO', 'CENTRAL'))), ['r']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.checklistDaOS('INSTALAÇÃO', 'CENTRAL'))), ['i']);
});

test('a sonda e a carga entram nas DUAS entradas do app', () => {
  const fonte = semComentarios(HTML);
  assert.equal((fonte.match(/await planoSondarEsquema\(\);/g) || []).length, 2);
  assert.equal((fonte.match(/await planoCarregar\(\);/g) || []).length, 6,
    'duas na carga (observador e sessão) e quatro depois de gravar');
});

// ═══════════ núcleo puro: comportamento, não regex ═══════════

test('TODOS alcança qualquer tipo; um tipo no escopo restringe a esse tipo', () => {
  const N = carregarNucleo();
  const todos = { aplica_a: 'TODOS' };
  const central = { aplica_a: 'CENTRAL' };
  assert.equal(N.planoAplicaAoEquip(todos, inst(1, 'SPLIT')), true);
  assert.equal(N.planoAplicaAoEquip(todos, inst(2, 'CHILLER')), true);
  assert.equal(N.planoAplicaAoEquip(central, inst(3, 'CENTRAL')), true);
  assert.equal(N.planoAplicaAoEquip(central, inst(4, 'SPLIT')), false);
  // Caixa e espaço não podem decidir escopo: o tipo é digitado por gente.
  assert.equal(N.planoAplicaAoEquip({ aplica_a: ' central ' }, inst(5, 'Central')), true);
  // aplica_a ausente é TODOS, o default da coluna desde a migração 04.
  assert.equal(N.planoAplicaAoEquip({}, inst(6, 'JANELA')), true);
});

test('modelo é refinamento: vazio não restringe, preenchido exige igualdade', () => {
  const N = carregarNucleo();
  const regra = { aplica_a: 'CENTRAL', aplica_modelo: '38CCL090235MC' };
  assert.equal(N.planoAplicaAoEquip(regra, inst(1, 'CENTRAL', '38CCL090235MC')), true);
  assert.equal(N.planoAplicaAoEquip(regra, inst(2, 'CENTRAL', 'OUTRO')), false);
  assert.equal(N.planoAplicaAoEquip(regra, inst(3, 'CENTRAL', null)), false,
    '117 dos 175 não têm modelo — a regra por modelo não pode alcançá-los por omissão');
  assert.equal(N.planoAplicaAoEquip({ aplica_a: 'CENTRAL', aplica_modelo: '' }, inst(4, 'CENTRAL', null)), true,
    'modelo vazio é ausência de refinamento, nunca um modelo chamado ""');
});

test('o alcance conta só INSTALADO — removido e baixado não recebem plano', () => {
  const N = carregarNucleo();
  const parque = [inst(1, 'SPLIT'), inst(2, 'SPLIT'),
                  { id: 3, tipo: 'SPLIT', situacao: 'removido' },
                  { id: 4, tipo: 'SPLIT', situacao: 'baixado' }];
  assert.equal(N.planoAlcance({ aplica_a: 'TODOS' }, parque), 2);
  assert.equal(N.planoAlcance({ aplica_a: 'CHILLER' }, parque), 0,
    'regra que não alcança ninguém tem de contar zero, não sumir');
});

test('o checklist da OS vem do plano e NÃO repete serviço entre periodicidades', () => {
  const N = carregarNucleo();
  const servicos = [{ id: 10, nome: 'Limpeza dos filtros de ar' }];
  const tarefas = [
    { id: 1, aplica_a: 'TODOS', periodicidade: 'MENSAL', servico_id: 10, descricao: 'x' },
    { id: 2, aplica_a: 'TODOS', periodicidade: 'TRIMESTRAL', servico_id: 10, descricao: 'y' },
    { id: 3, aplica_a: 'CENTRAL', periodicidade: 'ANUAL', servico_id: null, descricao: 'Troca de correia' },
  ];
  const naCentral = N.planoChecklistDe(tarefas, servicos, inst(1, 'CENTRAL'));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(naCentral)),
    ['Limpeza dos filtros de ar', 'Troca de correia'],
    'quem está com a máquina aberta limpa o filtro uma vez, não uma por periodicidade');
  const noSplit = N.planoChecklistDe(tarefas, servicos, inst(2, 'SPLIT'));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(noSplit)), ['Limpeza dos filtros de ar']);
});

test('tarefa sem serviço usa a própria descrição — as 9 originais são assim', () => {
  const N = carregarNucleo();
  assert.equal(N.planoRotuloTarefa({ descricao: 'Medição de corrente elétrica', servico_id: null }, []),
    'Medição de corrente elétrica');
  assert.equal(N.planoRotuloTarefa({ descricao: 'x', servico_id: 5 }, [{ id: 5, nome: 'Serviço' }]), 'Serviço');
  assert.equal(N.planoRotuloTarefa({}, []), '', 'nunca undefined numa linha de checklist');
});

test('a cobertura por tipo conta regras que ALCANÇAM, e distingue as próprias', () => {
  const N = carregarNucleo();
  const parque = [inst(1, 'SPLIT'), inst(2, 'SPLIT'), inst(3, 'CENTRAL')];
  const tarefas = [
    { id: 1, aplica_a: 'TODOS' }, { id: 2, aplica_a: 'TODOS' },
    { id: 3, aplica_a: 'CENTRAL' },
  ];
  const cob = JSON.parse(JSON.stringify(N.planoCoberturaPorTipo(tarefas, parque)));
  assert.deepStrictEqual(cob, [
    { tipo: 'CENTRAL', equipamentos: 1, regras: 3, proprias: 1 },
    { tipo: 'SPLIT', equipamentos: 2, regras: 2, proprias: 0 },
  ]);
});

test('tipo com ZERO regra aplicável é o único caso de alarme — o plano saudável não dispara nada', () => {
  const N = carregarNucleo();
  // Sem nenhuma regra TODOS, um tipo sem regra própria fica sem plano.
  const cob = N.planoCoberturaPorTipo([{ id: 1, aplica_a: 'SPLIT' }], [inst(1, 'SPLIT'), inst(2, 'CHILLER')]);
  const zero = cob.filter((c) => c.regras === 0).map((c) => c.tipo);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(zero)), ['CHILLER']);
  // Com as 9 TODOS de verdade, nenhum tipo fica sem plano — e é por isso
  // que o aviso não pode ser "sem regra PRÓPRIA": dispararia sempre.
  const sadio = N.planoCoberturaPorTipo([{ id: 1, aplica_a: 'TODOS' }], [inst(1, 'SPLIT'), inst(2, 'CHILLER')]);
  assert.equal(JSON.parse(JSON.stringify(sadio)).filter((c) => c.regras === 0).length, 0);
  assert.ok(!/planoTiposSemRegra/.test(HTML), 'o aviso que gritava lobo saiu inteiro, não ficou desligado');
});

test('os materiais do plano são CONSOLIDADOS por material antes de virarem item', () => {
  const N = carregarNucleo();
  const servicos = [{ id: 10, nome: 'A' }, { id: 20, nome: 'B' }];
  const sm = [{ id: 1, servico_id: 10, material_id: 7, quantidade: 2 },
              { id: 2, servico_id: 20, material_id: 7, quantidade: 3 }];
  const materiais = [{ id: 7, nome: 'Filtro G4', unidade: 'un', preco: 35 }];
  const tarefas = [{ id: 1, aplica_a: 'TODOS', servico_id: 10 }, { id: 2, aplica_a: 'TODOS', servico_id: 20 }];
  const out = JSON.parse(JSON.stringify(
    N.planoMateriaisParaEquip(tarefas, servicos, sm, materiais, inst(1, 'SPLIT'))));
  assert.equal(out.length, 1, 'o mesmo filtro em dois serviços é UMA linha de item, não duas');
  assert.equal(out[0].quantidade, 5);
  assert.equal(out[0].nome, 'Filtro G4');
});

test('material do serviço sobrevive a um catálogo que não conhece a peça', () => {
  const N = carregarNucleo();
  const out = JSON.parse(JSON.stringify(
    N.planoMateriaisDoServico(10, [{ id: 1, servico_id: 10, material_id: 99, quantidade: 1 }], [])));
  assert.equal(out.length, 1);
  assert.match(out[0].nome, /material #99/, 'nunca undefined: a linha diz qual id não foi encontrado');
});

// ═══════════ rótulo escrito, nunca cortado ═══════════

test('o rótulo curto de periodicidade é ESCRITO — "TRIMES"/"SEMEST" foram defeito de verdade', () => {
  const N = carregarNucleo();
  assert.equal(N.planoPeriodCurto('TRIMESTRAL'), 'TRIM.');
  assert.equal(N.planoPeriodCurto('SEMESTRAL'), 'SEM.');
  assert.equal(N.planoPeriodCurto('MENSAL'), 'MENSAL');
  assert.equal(N.planoPeriodCurto('ANUAL'), 'ANUAL');
  assert.equal(N.planoPeriodCurto('QUINZENAL'), 'QUINZENAL',
    'periodicidade desconhecida sai inteira, nunca cortada pela metade');
});

test('nenhum dado do usuário é cortado para caber em etiqueta', () => {
  const fonte = semComentarios(recorte()) +
    semComentarios(HTML.slice(HTML.indexOf('function renderPlanoManutencao'), HTML.indexOf('function planoAbrirTarefa')));
  assert.ok(!/\.slice\(0,\s*\d+\)/.test(fonte),
    'tipo e modelo são cadastro do usuário: cortar produz "CENTRA"/"CHILLE", como já aconteceu três vezes');
});

// ═══════════ portas de escrita ═══════════

test('o plano chega na OS pela porta que já existe — nunca um segundo insert em os_itens', () => {
  const fonte = semComentarios(HTML);
  assert.match(fonte, /async function planoPuxarMateriais\(osId\)/);
  const dentro = fonte.slice(fonte.indexOf('async function planoPuxarMateriais'));
  const corpo = dentro.slice(0, dentro.indexOf('\n}'));
  assert.match(corpo, /await osAddItem\(osId,/);
  assert.ok(!/from\('os_itens'\)/.test(corpo), 'resolver QUAIS materiais, nunca COMO gravá-los');
  // A porta única de os_itens continua sendo uma só.
  const escritas = [...fonte.matchAll(/from\('os_itens'\)\s*\.\s*(insert|update|upsert)/g)].map((m) => m[1]);
  assert.deepStrictEqual(escritas, ['insert'], 'um insert em os_itens no arquivo inteiro');
});

test('as três tabelas do plano têm porta de escrita contada', () => {
  const fonte = semComentarios(HTML);
  const conta = (t) => [...fonte.matchAll(new RegExp(`from\\('${t}'\\)\\s*\\.\\s*(insert|update|delete|upsert)`, 'g'))]
    .map((m) => m[1]).sort();
  assert.deepStrictEqual(conta('plano_tarefas'), ['insert', 'update']);
  assert.deepStrictEqual(conta('servicos'), ['insert', 'update']);
  assert.deepStrictEqual(conta('servico_materiais'), ['delete', 'insert'],
    'material de serviço entra e sai; editar quantidade é remover e acrescentar');
});

// ═══════════ tela: três segmentos, nada de aba nova, nada de CSS novo ═══════════

test('#bottom-nav continua com exatamente cinco .nav-btn na marcação', () => {
  const ini = HTML.indexOf('<div id="bottom-nav">');
  const trecho = HTML.slice(ini, HTML.indexOf('</div>', ini));
  assert.equal((trecho.match(/class="nav-btn/g) || []).length, 5);
});

test('o terceiro segmento reusa `tres`, que já existia na folha sem consumidor', () => {
  assert.match(HTML, /<div class="seg-toggle tres" id="pmoc-seletor">/);
  assert.match(HTML, /id="seg-pmoc-plano"/);
  assert.match(HTML, /\.seg-toggle\.tres \.seg-btn\{/, 'a regra já existia — nenhuma linha de CSS acrescentada');
  assert.match(HTML, /<div id="pmoc-plano" style="display:none"><\/div>/);
});

test('pmocSetVista trata as três vistas pela MESMA lista, não por ifs em pares', () => {
  const ctx = { PMOC_VISTA: 'lista', _painel: {}, _btn: {},
                renderAgenda() {}, renderPmoc() {}, renderPlanoManutencao() { ctx._chamou = 'plano'; } };
  ctx.el = (id) => {
    if (id.indexOf('seg-pmoc-') === 0) return (ctx._btn[id] = ctx._btn[id] || { className: '', setAttribute() {} });
    return (ctx._painel[id] = ctx._painel[id] || { style: {} });
  };
  vm.createContext(ctx);
  const ini = HTML.indexOf('var PMOC_VISTAS = ');
  vm.runInContext(HTML.slice(ini, HTML.indexOf('\n}', HTML.indexOf('else renderPmoc();', ini)) + 2), ctx);
  ctx.pmocSetVista('plano');
  assert.equal(ctx.PMOC_VISTA, 'plano');
  assert.equal(ctx._chamou, 'plano');
  assert.equal(ctx._painel['pmoc-plano'].style.display, '');
  assert.equal(ctx._painel['pmoc-list'].style.display, 'none');
  assert.equal(ctx._painel['pmoc-agenda'].style.display, 'none');
  // Os chips filtram a lista por equipamento; fora dela mentiriam.
  assert.equal(ctx._painel['pmoc-chips'].style.display, 'none');
  ctx.pmocSetVista('bobagem');
  assert.equal(ctx.PMOC_VISTA, 'lista', 'vista desconhecida cai na lista, nunca numa tela em branco');
});

test('a seção não inventa classe de CSS — só usa as que já existem na folha', () => {
  const trecho = HTML.slice(HTML.indexOf(MARCA_INI), HTML.indexOf('function planoAbrirTarefa'));
  const usadas = new Set();
  for (const m of trecho.matchAll(/class="([^"'+]*)"/g)) {
    m[1].split(/\s+/).filter(Boolean).forEach((c) => usadas.add(c));
  }
  assert.ok(usadas.size > 5);
  for (const c of usadas) {
    if (/^fa($|[srb-])/.test(c)) continue; // Font Awesome vem de CDN
    assert.ok(HTML.includes('.' + c + '{') || HTML.includes('.' + c + ' ') || HTML.includes('.' + c + ','),
      `classe "${c}" não existe nesta folha — este módulo é standalone e congelado (D-cf8-20)`);
  }
});

test('sem a migração a aba DIZ o que houve, e promete o resto intacto', () => {
  const fonte = recorte() + HTML.slice(HTML.indexOf('function renderPlanoManutencao'), HTML.indexOf('function planoLinhaHtml'));
  assert.match(fonte, /if \(!PLAN_OK\) \{[\s\S]*?migração 54/);
  assert.match(fonte, /o checklist da OS segue como está hoje/);
});
