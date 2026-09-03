// Gate da fila de trabalho da aba OS e da correção de dados pelo gestor
// (/refrigeracao) — quick task 260822-1ak.
//
// Duas regras que só se enxergam juntas: o chip "Todos" passou a ser a fila
// do que ainda precisa de alguém (OS conferida e cancelada saem dele e
// ganham chip próprio), e o gestor passou a corrigir os dados da OS em
// QUALQUER estado — inclusive nos dois terminais, que é justamente onde
// manProximos() devolve [] e a gaveta não oferecia mais nada.
//
// O filtro é testado por COMPORTAMENTO (função pura avaliada em node:vm,
// como o gate do fluxo já faz), não por regex sobre o markup: a pergunta é
// o que a lista mostra, não como o `if` está escrito.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');

function recorte(ini, fim) {
  const a = HTML.indexOf(ini);
  const b = HTML.indexOf(fim, a);
  assert.ok(a > 0 && b > a, `recorte "${ini}" → "${fim}" não encontrado`);
  return HTML.slice(a, b);
}

function sandboxFiltro() {
  // 260823-cf8: o recorte agora vai até loadData( — cobre manClasseCard e
  // o núcleo puro de fluxo (osFluxoDe/osEhTerminal/OS_EXECUTORES/…) que
  // osNoChip passou a consultar. UNI_OK é lido de fora (porta de escrita,
  // fora deste recorte) — falso aqui é o comportamento de hoje sem a
  // migração 43.
  const vocabulario = recorte('var MAN_STATUS = {', 'function loadData(');
  const filtro = recorte('function osNoChip(', 'function renderOS()');
  const ctx = { window: {}, UNI_OK: false };
  vm.createContext(ctx);
  vm.runInContext(vocabulario + '\n' + filtro, ctx);
  return ctx;
}

const OS = (status) => ({ status });

test('"Todos" é a fila de trabalho: conferida e cancelada ficam de fora', () => {
  const ctx = sandboxFiltro();
  assert.strictEqual(ctx.osNoChip('todos', OS('ABERTA'), false), true);
  assert.strictEqual(ctx.osNoChip('todos', OS('DELINEAMENTO'), false), true);
  assert.strictEqual(ctx.osNoChip('todos', OS('EXECUTADA'), false), true);
  assert.strictEqual(ctx.osNoChip('todos', OS('CONFERIDA'), false), false);
  assert.strictEqual(ctx.osNoChip('todos', OS('CANCELADA'), false), false);
});

test('a linha legada CONCLUÍDA sai do "Todos" pela mesma equivalência que já a agrupava', () => {
  const ctx = sandboxFiltro();
  // 260823-cf8: a equivalência agora mira o bucket unificado CONCLUIDA (sem
  // acento, D-cf8-10), não mais o literal CONFERIDA do fluxo legado — o
  // AGRUPAMENTO continua o mesmo (D-l7n-01/02), só o nome do destino mudou.
  assert.strictEqual(ctx.manNormalizar('CONCLUÍDA'), 'CONCLUIDA');
  assert.strictEqual(ctx.osNoChip('todos', OS('CONCLUÍDA'), false), false);
  assert.strictEqual(ctx.osNoChip('concluida', OS('CONCLUÍDA'), false), true);
  // PENDENTE/PARCIAL são legado ATIVO — continuam na fila
  assert.strictEqual(ctx.osNoChip('todos', OS('PENDENTE'), false), true);
  assert.strictEqual(ctx.osNoChip('todos', OS('PARCIAL'), false), true);
});

test('cada terminal tem o seu chip, e um não mostra o outro', () => {
  const ctx = sandboxFiltro();
  assert.strictEqual(ctx.osNoChip('concluida', OS('CONFERIDA'), false), true);
  assert.strictEqual(ctx.osNoChip('concluida', OS('CANCELADA'), false), false);
  assert.strictEqual(ctx.osNoChip('cancelada', OS('CANCELADA'), false), true);
  assert.strictEqual(ctx.osNoChip('cancelada', OS('CONFERIDA'), false), false);
});

test('um status desconhecido conta como ativo — some da tela é pior que aparecer', () => {
  const ctx = sandboxFiltro();
  assert.strictEqual(ctx.osNoChip('todos', OS('INVENTADO'), false), true);
  assert.strictEqual(ctx.osNoChip('chip-que-nao-existe', OS('ABERTA'), false), true);
});

test('"Crítica" responde pelo equipamento, não pelo estado da OS', () => {
  const ctx = sandboxFiltro();
  assert.strictEqual(ctx.osNoChip('critica', OS('CONFERIDA'), true), true);
  assert.strictEqual(ctx.osNoChip('critica', OS('ABERTA'), false), false);
});

test('os cinco chips de estado existem no markup, cada um chamando setOSChip', () => {
  const bloco = recorte('<div class="chips" id="os-chips">', '<div class="sec-head">');
  ['todos', 'aberto', 'aprovacao', 'concluida', 'cancelada', 'critica'].forEach((chave) => {
    assert.ok(bloco.includes(`setOSChip(this,'${chave}')`), `chip ${chave} ausente`);
  });
});

test('a correção do gestor é gateada na AÇÃO, não só no botão', () => {
  const abrir = recorte('function manEditarDados(', 'function manCancelarEdicao(');
  const salvar = recorte('async function manSalvarDados(', '/* ── fluxo da OS interna');
  assert.match(abrir, /if \(!podeEditarCadastro\(\)\)/);
  assert.match(salvar, /if \(!podeEditarCadastro\(\)\)/);
});

test('corrigir dado não move o processo: status fica fora do patch', () => {
  const salvar = recorte('async function manSalvarDados(', '/* ── fluxo da OS interna');
  assert.doesNotMatch(salvar, /\bstatus\s*:/, 'manSalvarDados não pode gravar status');
  assert.match(salvar, /manAtualizarOS\(logId, achado\.equipId, patch/);
});

test('o botão Corrigir não olha o estado da OS — terminal inclusive', () => {
  const bloco = recorte("1 · Abertura'", 'if (osEhMovimentacao(entry))');
  const condicao = bloco.match(/\(podeEditarCadastro\(\) && !editando/);
  assert.ok(condicao, 'condição do botão Corrigir mudou de forma');
  assert.doesNotMatch(bloco, /manEhTerminal|manPodeIrPara/,
    'o bloco de abertura não pode voltar a condicionar a correção ao estado');
});

test('medição zero sobrevive ao formulário, e o decimal sai na forma que o leitor lê de volta', () => {
  // O zero continua sobrevivendo — era o que este caso protegia, e continua
  // protegendo. O que mudou é o DECIMAL: desde que os campos deixaram de ser
  // type=number (que descartava a vírgula digitada), o formulário escreve
  // "21,5" e não "21.5", porque é essa a forma que numValidar lê de volta.
  // Escrever com ponto voltaria a encher o campo com algo que o próprio
  // aplicativo recusaria quando o valor caísse em três casas decimais.
  const ctx = { esc: (s) => String(s) };
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ── leitura numérica de formulário: porta única ─', 'function showToast(msg, type){'), ctx);
  vm.runInContext(recorte('function manValCampo(', 'function manFormDados('), ctx);
  assert.strictEqual(ctx.manValCampo(0), '0', 'zero é medição, não ausência');
  assert.strictEqual(ctx.manValCampo(null), '');
  assert.strictEqual(ctx.manValCampo(undefined), '');
  assert.strictEqual(ctx.manValCampo(''), '');
  assert.strictEqual(ctx.manValCampo(21.5), '21,5');
  // A ida e a volta fecham: é isso que impede o campo de nascer recusado.
  for (const v of [0, 21.5, 5.392, 1200, 380.5]) {
    const escrito = ctx.manValCampo(v);
    const lido = ctx.numValidar(escrito, { rotulo: 'x' });
    assert.strictEqual(lido.ok, true, `manValCampo(${v}) = "${escrito}" foi recusado pelo leitor`);
    assert.strictEqual(lido.valor, v, `${v} não sobreviveu à ida e volta`);
  }
});

test('o checklist também responde ao gestor em qualquer estado', () => {
  const painel = recorte('function movPainelDaOS(', 'async function manMarcarChecklist(');
  assert.match(painel, /podeMarcar = \(entry\.status==='EM_EXECUCAO' && manPode\('executar'\)\) \|\| podeEditarCadastro\(\)/);
  const acao = recorte('async function manMarcarChecklist(', '/* ── correção de dados pelo gestor');
  assert.match(acao, /!manPode\('executar'\) && !podeEditarCadastro\(\)/,
    'a guarda da ação tem que aceitar o gestor, senão o clique falha depois de já ter desenhado a caixa');
});
