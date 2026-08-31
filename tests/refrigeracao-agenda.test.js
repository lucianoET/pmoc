// Gate da quick-260831-cal — calendário de OS e vencimentos (/refrigeracao).
//
// O cronograma do PMOC v8.3 era uma LISTA gerada uma vez, sem memória.
// O que entra aqui é um calendário: mostra o que está marcado e deixa
// remarcar arrastando.
//
//  - D-cal-01: SEM migração. A data de uma OS já é `logs_manutencao.data_os`;
//    remarcar é um update nessa coluna pela MESMA porta de escrita de
//    sempre (manAtualizarOS). Uma coluna `data_programada` ao lado seria a
//    sétima migração pendente e uma segunda fonte de verdade para "quando".
//  - D-cal-02: nenhuma segunda porta de escrita nasce aqui.
//  - D-cal-03: OS em estado terminal não se move — a data de uma OS
//    concluída é registro do que foi feito, não plano.
//  - D-cal-04: 169 dos 171 equipamentos não têm histórico, e sem data
//    anterior nextPmoc() devolve null. A tela CONTA quantos ficaram de
//    fora em vez de parecer um calendário vazio.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

function recorte(ini, fim) {
  const a = HTML.indexOf(ini);
  assert.ok(a > 0, `marcador de início não encontrado: ${ini}`);
  const b = HTML.indexOf(fim, a);
  assert.ok(b > a, `marcador de fim não encontrado: ${fim}`);
  return HTML.slice(a, b);
}

function bloco(marcador) {
  const ini = HTML.indexOf(marcador);
  assert.ok(ini >= 0, `marcador "${marcador}" não encontrado`);
  const abre = HTML.indexOf('{', ini);
  let depth = 1;
  let j = abre + 1;
  while (j < HTML.length && depth > 0) {
    if (HTML[j] === '{') depth++;
    else if (HTML[j] === '}') depth--;
    j++;
  }
  return HTML.slice(ini, j);
}

function daqui(v) { return JSON.parse(JSON.stringify(v)); }

// Os comentários deste arquivo-fonte NOMEIAM justamente o que as regras
// proíbem ("nunca a busca por propriedade do global", "uma coluna
// data_programada seria..."). Grepar o texto cru acusaria a explicação
// como se fosse a infração. Só o código conta.
function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

// Núcleo puro: código REAL do arquivo, nunca reescrito aqui.
function sandbox(fluxos) {
  const ctx = Object.assign({
    FLUXO_PROPRIO: [{ id: 'ABERTA' }, { id: 'CONCLUIDA' }],
    FLUXO_CONTRATO: [{ id: 'ABERTA' }, { id: 'ENCERRADA' }],
    FLUXO_LEGADO: [{ id: 'ABERTA' }, { id: 'CONFERIDA' }],
  }, fluxos || {});
  vm.createContext(ctx);
  vm.runInContext(recorte('/* ══ agenda: núcleo puro (sem migração) ══', '/* ══ carga térmica: núcleo puro (migração 47) ══'), ctx);
  return ctx;
}

test('o recorte do núcleo existe no HTML', () => {
  assert.doesNotThrow(() => sandbox());
});

// ═══════════ datas: a armadilha de fuso ═══════════

test('agendaChave usa a data LOCAL — nunca toISOString, que empurraria o dia para trás', () => {
  const ctx = sandbox();
  // 5 de março de 2026, 08h local. Em qualquer fuso a oeste de Greenwich,
  // toISOString() ainda dá 2026-03-05; às 22h daria 2026-03-06. O que
  // realmente prova a regra é a ausência da conversão para UTC.
  assert.strictEqual(ctx.agendaChave(new Date(2026, 2, 5, 8, 0, 0)), '2026-03-05');
  assert.strictEqual(ctx.agendaChave(new Date(2026, 2, 5, 23, 30, 0)), '2026-03-05');
  assert.strictEqual(ctx.agendaChave(new Date(2026, 2, 5, 0, 15, 0)), '2026-03-05');
  assert.strictEqual(ctx.agendaChave(new Date(2026, 0, 1)), '2026-01-01');
  assert.strictEqual(ctx.agendaChave(new Date(2026, 11, 31)), '2026-12-31');
  assert.strictEqual(ctx.agendaChave(null), '');

  const fonte = bloco('function agendaChave(d){');
  assert.ok(!/toISOString/.test(fonte),
    'toISOString converte para UTC: no nosso fuso, tudo antes das 21h cairia no dia anterior');
});

test('agendaData interpreta ao meio-dia — meia-noite mais fuso negativo cai na véspera', () => {
  const ctx = sandbox();
  const d = ctx.agendaData('2026-03-05');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 2);
  assert.strictEqual(d.getDate(), 5);
  assert.match(bloco('function agendaData(chave){'), /T12:00:00/);
  // Entrada inválida devolve null, nunca um Invalid Date que se propaga.
  assert.strictEqual(ctx.agendaData(''), null);
  assert.strictEqual(ctx.agendaData('05/03/2026'), null);
  assert.strictEqual(ctx.agendaData('2026-13-40'), null);
  assert.strictEqual(ctx.agendaData(null), null);
});

test('agendaChave e agendaData são inversas uma da outra', () => {
  const ctx = sandbox();
  ['2026-01-01', '2026-02-28', '2026-08-31', '2026-12-31'].forEach((k) => {
    assert.strictEqual(ctx.agendaChave(ctx.agendaData(k)), k);
  });
});

// ═══════════ a grade ═══════════

test('a grade tem SEMPRE 42 células e começa no domingo — nunca 35', () => {
  const ctx = sandbox();
  // Um mês de 31 dias começando no sábado precisa de 6 linhas; uma grade
  // que muda de altura faz o conteúdo pular ao navegar de mês.
  [[2026, 0], [2026, 1], [2026, 7], [2026, 11], [2024, 1]].forEach(([ano, mes]) => {
    const c = ctx.agendaCelulas(ano, mes);
    assert.strictEqual(c.length, 42, `${ano}-${mes} não deu 42 células`);
    assert.strictEqual(c[0].data.getDay(), 0, 'a primeira célula tem de ser um domingo');
  });
});

test('a grade cobre o mês inteiro e marca corretamente o que é de fora', () => {
  const ctx = sandbox();
  const c = ctx.agendaCelulas(2026, 7); // agosto/2026, 31 dias
  const doMes = c.filter((x) => x.doMes);
  assert.strictEqual(doMes.length, 31);
  assert.strictEqual(doMes[0].dia, 1);
  assert.strictEqual(doMes[30].dia, 31);
  assert.strictEqual(doMes[0].chave, '2026-08-01');
  assert.strictEqual(doMes[30].chave, '2026-08-31');
  // Fevereiro bissexto continua fechando em 29.
  const fev = ctx.agendaCelulas(2024, 1).filter((x) => x.doMes);
  assert.strictEqual(fev.length, 29);
});

test('agendaMover atravessa a virada de ano nos dois sentidos', () => {
  const ctx = sandbox();
  assert.deepStrictEqual(daqui(ctx.agendaMover(2026, 11, 1)), { ano: 2027, mes: 0 });
  assert.deepStrictEqual(daqui(ctx.agendaMover(2026, 0, -1)), { ano: 2025, mes: 11 });
  assert.deepStrictEqual(daqui(ctx.agendaMover(2026, 5, 1)), { ano: 2026, mes: 6 });
  assert.deepStrictEqual(daqui(ctx.agendaMover(2026, 0, -13)), { ano: 2024, mes: 11 });
});

test('agendaRotulo nomeia o mês em português e nunca contém undefined', () => {
  const ctx = sandbox();
  assert.strictEqual(ctx.agendaRotulo(2026, 7), 'Agosto de 2026');
  for (let m = 0; m < 12; m++) {
    assert.ok(!/undefined/.test(ctx.agendaRotulo(2026, m)), `mês ${m} sem rótulo`);
  }
});

// ═══════════ D-cal-03 — o que pode e o que não pode ser movido ═══════════

test('os terminais saem dos FLUXOS declarados, não de uma lista escrita à mão', () => {
  const ctx = sandbox();
  const t = daqui(ctx.agendaTerminais());
  assert.ok(t.CONCLUIDA, 'terminal de FLUXO_PROPRIO');
  assert.ok(t.ENCERRADA, 'terminal de FLUXO_CONTRATO');
  assert.ok(t.CONFERIDA, 'terminal de FLUXO_LEGADO');
  assert.ok(t.CANCELADA, 'cancelada é terminal sempre');

  // Um fluxo novo com terminal novo passa a ser respeitado sozinho.
  const outro = sandbox({ FLUXO_PROPRIO: [{ id: 'ABERTA' }, { id: 'ARQUIVADA' }] });
  assert.ok(daqui(outro.agendaTerminais()).ARQUIVADA);
});

test('agendaTerminais NÃO depende de globalThis — o defeito era silencioso', () => {
  // Os três fluxos são `var` de topo do mesmo script: dentro de um eval de
  // função ou de um sandbox eles existem como variáveis e não como
  // propriedades do objeto global. Com a busca por propriedade, a lista
  // voltava só com CANCELADA e uma OS concluída ficava arrastável.
  const fonte = semComentarios(bloco('function agendaTerminais(){'));
  assert.ok(!/globalThis\s*\[/.test(fonte), 'busca por propriedade do objeto global não encontra `var` de topo em todo ambiente');
  assert.match(fonte, /typeof FLUXO_PROPRIO/);
  assert.match(fonte, /typeof FLUXO_CONTRATO/);
  assert.match(fonte, /typeof FLUXO_LEGADO/);
});

test('OS em andamento se move; OS terminal, nunca — a data dela é registro do que foi feito', () => {
  const ctx = sandbox();
  assert.strictEqual(ctx.agendaPodeMover({ date: '2026-08-04', status: 'ABERTA' }), true);
  assert.strictEqual(ctx.agendaPodeMover({ date: '2026-08-04', status: 'EM_EXECUCAO' }), true);
  assert.strictEqual(ctx.agendaPodeMover({ date: '2026-08-04', status: 'DELINEAMENTO' }), true);
  ['CONCLUIDA', 'ENCERRADA', 'CONFERIDA', 'CANCELADA'].forEach((st) => {
    assert.strictEqual(ctx.agendaPodeMover({ date: '2026-08-04', status: st }), false, `${st} não pode se mover`);
  });
  // Sem data não há o que mover.
  assert.strictEqual(ctx.agendaPodeMover({ status: 'ABERTA' }), false);
  assert.strictEqual(ctx.agendaPodeMover(null), false);
});

// ═══════════ as duas camadas ═══════════

const OS_FIXAS = [
  { equipId: 12, entry: { id: 'a1', date: '2026-08-04', tipo: 'PREVENTIVA', status: 'ABERTA' } },
  { equipId: 37, entry: { id: 'a2', date: '2026-08-04', tipo: 'INSPEÇÃO', status: 'EM_EXECUCAO' } },
  { equipId: 5, entry: { id: 'a3', date: '2026-08-18', tipo: 'PREVENTIVA', status: 'CONCLUIDA' } },
];

test('as duas camadas convivem no mesmo dia, e só a de OS é arrastável', () => {
  const ctx = sandbox();
  const equipamentos = [{ id: 99 }];
  const projetar = (e, tipo) => (tipo === 'inspecao' ? new Date(2026, 7, 4) : null);
  const r = ctx.agendaEventos(OS_FIXAS, equipamentos, projetar);

  const dia4 = daqui(r.porDia['2026-08-04']);
  assert.strictEqual(dia4.length, 3, 'duas OS mais um vencimento projetado');
  assert.strictEqual(dia4.filter((x) => x.tipo === 'os').length, 2);
  assert.strictEqual(dia4.filter((x) => x.tipo === 'venc').length, 1);
  // Projeção NÃO se arrasta: é recalculada a cada abertura, não guardada.
  assert.strictEqual(dia4.find((x) => x.tipo === 'venc').movel, false);
  assert.ok(dia4.filter((x) => x.tipo === 'os').every((x) => x.movel === true));

  // A concluída aparece no calendário, mas travada.
  assert.strictEqual(daqui(r.porDia['2026-08-18'])[0].movel, false);
});

test('D-cal-04: conta quantos equipamentos ficaram SEM projeção em vez de calar', () => {
  const ctx = sandbox();
  const equipamentos = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  // Só o primeiro tem histórico: nextPmoc devolve null para os outros três.
  const projetar = (e, tipo) => (e.id === 1 && tipo === 'inspecao' ? new Date(2026, 7, 10) : null);
  const r = ctx.agendaEventos([], equipamentos, projetar);
  assert.strictEqual(r.semHistorico, 3);
  assert.strictEqual(daqui(r.porDia['2026-08-10']).length, 1);
});

test('sem projetor não há camada de vencimentos, e nada quebra', () => {
  const ctx = sandbox();
  const r = ctx.agendaEventos(OS_FIXAS, [{ id: 1 }], null);
  assert.strictEqual(r.semHistorico, 0);
  assert.strictEqual(daqui(r.porDia['2026-08-04']).length, 2);
});

test('agendaEventos não lê global nenhum — é isso que a deixa testável', () => {
  const fonte = semComentarios(bloco('function agendaEventos(osEntries, equipamentos, projetar){'));
  ['DATA', 'getAllOSEntries', 'nextPmoc', 'supa', 'document'].forEach((g) => {
    assert.ok(!new RegExp('\\b' + g + '\\b').test(fonte), `${g} não pode aparecer no núcleo puro`);
  });
});

// ═══════════ D-cal-01/02 — sem migração, sem segunda porta de escrita ═══════════

test('reagendar reusa manAtualizarOS — nenhuma segunda porta de escrita nasce aqui', () => {
  const fonte = bloco('async function agendaSoltar(ev, chave){');
  assert.match(fonte, /manAtualizarOS\(/);
  // Nada de supa direto na seção do calendário.
  const secao = semComentarios(recorte('/* ── agenda: a tela ── */', '/* ═══════════════════════════════════════════════════════════\n   ALERTS PAGE'));
  assert.ok(!/supa\.from\(/.test(secao), 'o calendário não pode falar com o banco por fora da porta de escrita');
  assert.ok(!/\.update\(/.test(secao), 'o update tem de ser o de manAtualizarOS');
});

test('a guarda de cargo está na AÇÃO, não só no atributo draggable', () => {
  const fonte = bloco('async function agendaSoltar(ev, chave){');
  assert.match(fonte, /agendaPodeReagendar\(\)/);
  // E a de estado terminal também: arrastar é affordance de tela, e uma
  // affordance não protege gravação nenhuma (D-l7n-03).
  assert.match(fonte, /agendaPodeMover\(/);
  const perm = bloco('function agendaPodeReagendar(){');
  assert.match(perm, /somenteLeitura\(\)/);
  assert.match(perm, /manPode\('abrir'\)/);
});

test('não existe migração nova para o calendário — data_os já é a coluna', () => {
  // O que este caso protege é o calendário NÃO ter criado uma coluna de
  // data própria — não o número da última migração do repositório, que
  // sobe por trabalhos sem relação nenhuma com esta tela (foi o que
  // aconteceu quando /equipes acrescentou a 49 e a 50). A invariante é
  // `data_programada` não existir em lugar nenhum: ela seria a segunda
  // fonte de verdade para "quando", divergindo da data_os no primeiro
  // reagendamento feito pela tela antiga.
  // Escopo: `logs_manutencao`, a tabela de OS de /refrigeracao. NÃO o
  // repositório inteiro — `maq_operacoes.data_programada` existe desde a
  // migração 12 e é do módulo Máquinas, onde a operação de corte é
  // agendada por um eixo diferente da OS. A decisão registrada aqui vale
  // para esta tela, não é uma regra universal da plataforma.
  const sqls = fs.readdirSync(path.join(RAIZ, 'supabase')).filter((f) => f.endsWith('.sql'));
  sqls.forEach((f) => {
    const txt = fs.readFileSync(path.join(RAIZ, 'supabase', f), 'utf8');
    const re = /alter\s+table\s+logs_manutencao[\s\S]{0,120}?data_programada/i;
    assert.ok(!re.test(txt), `${f} não pode dar a logs_manutencao uma coluna de data programada`);
  });
  const secao = semComentarios(recorte('/* ══ agenda: núcleo puro (sem migração) ══', '/* ══ carga térmica: núcleo puro (migração 47) ══'));
  assert.ok(!/data_programada/.test(secao), 'uma coluna de data programada seria segunda fonte de verdade');
  // E o reagendamento continua sendo um update na coluna que já existia.
  assert.match(bloco('async function agendaSoltar(ev, chave){'), /\{ date: chave \}/);
});

// ═══════════ a casa na tela ═══════════

test('o calendário vive na página PMOC atrás de um seg-toggle — não numa sexta aba', () => {
  // Dois gates afirmam exatamente cinco .nav-btn em #bottom-nav; e um
  // calendário de manutenção programada É a página do PMOC por outro eixo.
  const navs = (HTML.match(/class="nav-btn/g) || []).length;
  assert.strictEqual(navs, 5, 'o calendário não pode ter acrescentado botão de navegação');

  const ini = HTML.indexOf('id="page-pmoc"');
  const fim = HTML.indexOf('id="page-alert"');
  assert.ok(ini > 0 && fim > ini);
  const pagina = HTML.slice(ini, fim);
  assert.ok(pagina.indexOf('id="pmoc-seletor"') > 0, 'seg-toggle do PMOC não encontrado');
  assert.ok(pagina.indexOf('id="seg-pmoc-lista"') > 0);
  assert.ok(pagina.indexOf('id="seg-pmoc-agenda"') > 0);
  assert.ok(pagina.indexOf('id="pmoc-agenda"') > 0);
  // Nasce escondida: só renderAgenda() a preenche.
  assert.match(pagina.slice(pagina.indexOf('id="pmoc-agenda"')), /^id="pmoc-agenda" style="display:none"/);
});

test('trocar de vista esconde os chips — eles filtram a LISTA, e no calendário mentiriam', () => {
  const fonte = bloco('function pmocSetVista(v){');
  assert.match(fonte, /pmoc-chips/);
  assert.match(fonte, /aria-pressed/);
  assert.match(fonte, /renderAgenda\(\)/);
  assert.match(fonte, /renderPmoc\(\)/);
});

test('nenhuma classe nova do calendário entra na folha fora do @media', () => {
  // A folha de celular é comparada byte a byte com um fixture
  // (tests/refrigeracao-desktop.test.js). O calendário é feature nova nas
  // duas larguras, então sua aparência no celular vem de estilo inline e
  // de classes que já existiam.
  const blocos = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  let fora = '';
  let i = 0;
  while (i < blocos.length) {
    const idx = blocos.indexOf('@media', i);
    if (idx === -1) { fora += blocos.slice(i); break; }
    fora += blocos.slice(i, idx);
    const abre = blocos.indexOf('{', idx);
    let d = 1, j = abre + 1;
    while (j < blocos.length && d > 0) {
      if (blocos[j] === '{') d++;
      else if (blocos[j] === '}') d--;
      j++;
    }
    i = j;
  }
  ['.ag-grade', '.ag-cel', '.ag-dow', '.ag-num', '.ag-alvo'].forEach((c) => {
    assert.ok(fora.indexOf(c) < 0, `${c} não pode estar na folha fora do @media`);
  });
});
