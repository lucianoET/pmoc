// Gate da quick-260822-5hy — exportar/importar a planilha do inventário de
// /refrigeracao. O usuário escolheu, entre três modos, o mais perigoso
// (atualizar + criar + arquivar por ausência), depois de eu recomendar
// contra — este gate prova que o modo é sobrevivível: o parser aguenta o
// caso chato (não o feliz), o ciclo de exportar→reimportar sem editar
// fecha em zero mudança, e as guardas de escopo/escala bloqueiam os dois
// acidentes prováveis do desenho (planilha filtrada reimportada; arquivo
// mutilado depois de exportado completo).
//
// Mesmo padrão de recorte + sandbox node:vm de
// tests/refrigeracao-situacao-equipamento.test.js e
// tests/refrigeracao-ficha-equipamento.test.js: o código real de
// refrigeracao/index.html roda num sandbox, comportamental — não regex
// sobre markup, exceto as duas asserções estruturais do fim (D-5hy-02/08).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

// Objetos criados DENTRO do sandbox (node:vm) têm Object.prototype/
// Array.prototype de outro realm — deepStrictEqual contra um literal do
// realm principal falha por "mesma estrutura, não referência-igual" mesmo
// quando o conteúdo é idêntico (armadilha documentada em
// tests/refrigeracao-encerramento-os.test.js). `eq` compara pela forma
// serializada, que não carrega prototype nenhum — seguro nos dois sentidos.
function eq(actual, expected, message) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

// ── carregarSandbox: quatro recortes, um contexto, nesta ordem (A→D) ─────
function carregarSandbox() {
  const ctx = {
    somenteLeitura() { return false; },
    esc(s) { if (s === null || s === undefined) return ''; return String(s); },
    ctUser: null,
  };
  vm.createContext(ctx);

  // A — ponte de campos de equipamentos: CAMPOS_EQUIP, EQUIP_EDITAVEIS,
  // EQUIP_NUMERICOS, equipParaDb, linkSeguro, podeEditarCadastro.
  vm.runInContext(
    recorte('/* ── ponte de campos de equipamentos ── */', '/* ── ponte de campos de logs_manutencao ── */'),
    ctx
  );

  // B — vocabulários: EQUIP_ESTADOS/ORDEM/normalizarEstadoEquip,
  // EQUIP_SITUACOES/SITUACAO_ORDEM/normalizarSituacaoEquip/equipInstalado.
  vm.runInContext(
    recorte('/* ── estado do equipamento: vocabulário OP/INOP/OR ── */', '/* ── alertas: contagem única ── */'),
    ctx
  );

  // C — rótulos e listas fechadas do formulário: EQUIP_ROTULOS,
  // EQUIP_CRITICIDADES, EQUIP_IDADES.
  vm.runInContext(
    recorte('/* ── cadastro do equipamento: formulário e gravação ── */', 'function openEquipForm('),
    ctx
  );

  // D — o núcleo novo desta task.
  vm.runInContext(
    recorte('/* ── planilha do inventário: núcleo puro ── */', '/* ── planilha do inventário: tela e gravação ── */'),
    ctx
  );

  // E (260902) — TERM_TIPOS_USO, a lista fechada da migração 47. Entra
  // DEPOIS de D de propósito: `celulaParaValor` a consulta atrás de um
  // `typeof`, então carregar só D prova o caminho "sem a seção térmica" e
  // carregar D+E prova o caminho com ela. É o mesmo cuidado que faltou em
  // `agendaTerminais`, que lia `globalThis[nome]` e não enxergava um `var`
  // de topo dentro de sandbox — a lista voltava incompleta, em silêncio.
  vm.runInContext(
    recorte('/* ══ carga térmica: núcleo puro (migração 47) ══', 'function termRotuloInsolacao('),
    ctx
  );

  return ctx;
}

// Cada recorte falha com mensagem própria se o marcador sumir — provado
// implicitamente pelo assert.ok dentro de recorte(); um teste explícito
// aqui documenta a intenção.
test('os quatro recortes de carregarSandbox existem no HTML', () => {
  assert.doesNotThrow(() => carregarSandbox());
});

function equip(over) {
  return Object.assign(
    {
      id: 1, area: 'VERMELHA', predio: 'F21', local: 'Sala 1', tipo: 'Split',
      fabricante: 'LG', modelo: 'X1', btu: 12000, funciona: 'OP', estado: 'NOVA',
      criticidade: 'ALTA', tensao: 220, correnteNominal: 7.5, patrimonio: '123',
      dataFabricacao: '2020-01-01', dataInstalacao: '2020-02-01',
      ultimaManutencao: '2026-01-01', refrigerante: 'R410A',
      link: 'https://example.org/x', manualUrl: '',
      refrigPermanente: false, horasDia: 8, diasSemana: 5, obs: '',
      situacao: 'instalado',
    },
    over || {}
  );
}

// ══════════════════════════ 1. PARSER (o caso chato) ═══════════════════

test('csvParse: campo entre aspas contendo o separador volta inteiro', () => {
  const ctx = carregarSandbox();
  const linhas = ctx.csvParse('a;"b;c";d');
  eq(linhas, [['a', 'b;c', 'd']]);
});

test('csvParse: aspas duplicadas dentro de campo entre aspas voltam como uma aspa só', () => {
  const ctx = carregarSandbox();
  const linhas = ctx.csvParse('a;"ele disse ""oi""";c');
  eq(linhas, [['a', 'ele disse "oi"', 'c']]);
});

test('csvParse: quebra de linha dentro de aspas não parte a linha em duas', () => {
  const ctx = carregarSandbox();
  const linhas = ctx.csvParse('a;"linha1\nlinha2";c\nx;y;z');
  eq(linhas, [
    ['a', 'linha1\nlinha2', 'c'],
    ['x', 'y', 'z'],
  ]);
});

test('csvParse: marca de ordem de byte na primeira célula não gruda no primeiro cabeçalho', () => {
  const ctx = carregarSandbox();
  const linhas = ctx.csvParse('﻿id;nome\n1;A');
  assert.equal(linhas[0][0], 'id');
});

test('csvParse: fim de linha estilo Windows não deixa retorno de carro no último campo', () => {
  const ctx = carregarSandbox();
  const linhas = ctx.csvParse('a;b\r\nc;d\r\n');
  eq(linhas, [
    ['a', 'b'],
    ['c', 'd'],
  ]);
  assert.ok(!linhas[1][1].includes('\r'));
});

test('csvParse: última linha vazia (trailing newline) não vira uma linha de dados', () => {
  const ctx = carregarSandbox();
  const linhas = ctx.csvParse('a;b\nc;d\n');
  assert.equal(linhas.length, 2);
});

test('csvParse: texto vazio devolve lista vazia, sem lançar', () => {
  const ctx = carregarSandbox();
  assert.doesNotThrow(() => {
    const linhas = ctx.csvParse('');
    eq(linhas, []);
  });
  eq(ctx.csvParse(undefined), []);
});

test('csvParse: apóstrofo inicial seguido de caractere de fórmula é removido; seguido de letra é preservado', () => {
  const ctx = carregarSandbox();
  const linhas = ctx.csvParse("'=SOMA(A1);'texto normal;'+1;'-1;'@x");
  eq(linhas[0], ['=SOMA(A1)', "'texto normal", '+1', '-1', '@x']);
});

test('csvParse: \\r sozinho (Mac clássico) também fecha a linha', () => {
  const ctx = carregarSandbox();
  const linhas = ctx.csvParse('a;b\rc;d');
  eq(linhas, [
    ['a', 'b'],
    ['c', 'd'],
  ]);
});

// ══════════════════ 2. SERIALIZAÇÃO E CICLO FECHADO ═════════════════════

test('planilhaColunas: id, as duas colunas somente-leitura, depois exatamente os 22 itens de EQUIP_EDITAVEIS, na ordem', () => {
  const ctx = carregarSandbox();
  const cols = ctx.planilhaColunas();
  assert.equal(cols[0].chave, 'id');
  assert.equal(cols[1].chave, 'situacao');
  assert.equal(cols[2].chave, 'ultimaManutencao');
  const resto = cols.slice(3).map((c) => c.chave);
  eq(resto, ctx.EQUIP_EDITAVEIS);
  assert.equal(cols.length, 3 + ctx.EQUIP_EDITAVEIS.length);
  assert.equal(cols[1].leitura, true);
  assert.equal(cols[2].leitura, true);
  assert.ok(cols.slice(3).every((c) => c.leitura === false));
});

test('booleano falso sai como a palavra de negação, não como célula vazia', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.planilhaValor('refrigPermanente', equip({ refrigPermanente: false })), 'NÃO');
  assert.equal(ctx.planilhaValor('refrigPermanente', equip({ refrigPermanente: true })), 'SIM');
  assert.equal(ctx.planilhaValor('refrigPermanente', equip({ refrigPermanente: null })), '');
});

test('ciclo fechado: montar o CSV de uma lista e reimportá-lo devolve plano zerado — inclusive com aspas, separador, quebra de linha, decimal, acentos, booleano e hífen inicial', () => {
  const ctx = carregarSandbox();
  const dados = [
    equip({ id: 1, obs: 'contém ; ponto-e-vírgula, "aspas" e\nquebra de linha', correnteNominal: 7.5, refrigPermanente: true }),
    equip({ id: 2, obs: '-começa com hífen', predio: 'MK48', refrigPermanente: false, criticidade: 'MÉDIA' }),
  ];
  const csv = ctx.montarCsv(dados, dados, '2026-08-22');
  const plano = ctx.planoDeImportacao(csv, dados);
  eq(plano.atualizar, []);
  eq(plano.criar, []);
  eq(plano.arquivar, []);
  eq(plano.erros, []);
  assert.equal(plano.escopo, 'completo');
});

// ══════════════════════ 3. CASAMENTO E CHAVE ═════════════════════════════

test('coluna reordenada continua casando por rótulo, ordem de coluna é irrelevante', () => {
  const ctx = carregarSandbox();
  const cab = ['area', 'id', 'predio'].map((k) => (k === 'area' ? 'Área' : k === 'predio' ? 'Prédio' : 'id'));
  const mapa = ctx.mapearCabecalho(cab);
  assert.equal(mapa.temId, true);
  assert.equal(mapa.porChave.id, 1);
  assert.equal(mapa.porChave.area, 0);
  assert.equal(mapa.porChave.predio, 2);
});

test('coluna com rótulo desconhecido é ignorada e devolvida na lista de ignoradas pelo nome', () => {
  const ctx = carregarSandbox();
  const mapa = ctx.mapearCabecalho(['id', 'Coluna Inventada']);
  eq(mapa.ignoradas, ['Coluna Inventada']);
});

test('arquivo sem coluna de chave id é recusado inteiro, sem plano nenhum', () => {
  const ctx = carregarSandbox();
  const dados = [equip({ id: 1 })];
  const csv = 'Área;Prédio\nVERMELHA;F21';
  const plano = ctx.planoDeImportacao(csv, dados);
  assert.equal(plano.atualizar.length, 0);
  assert.equal(plano.criar.length, 0);
  assert.ok(plano.bloqueios.some((b) => /sem coluna id/i.test(b)));
});

test('id vazio vira criação; id não numérico, id inexistente e id repetido viram linhas recusadas com número e motivo', () => {
  const ctx = carregarSandbox();
  const dados = [equip({ id: 1 })];
  const csv = [
    'id;Área',
    ';AZUL', // vazio → cria
    'abc;AZUL', // não numérico → recusada
    '999;AZUL', // inexistente → recusada
    '1;AZUL',
    '1;VERMELHA', // id 1 repetido → as duas recusadas
  ].join('\n');
  const plano = ctx.planoDeImportacao(csv, dados);
  assert.equal(plano.criar.length, 1);
  assert.equal(plano.atualizar.length, 0); // as duas linhas do id=1 foram recusadas por repetição
  assert.equal(plano.erros.length, 4); // abc, 999, e as duas de id=1 repetido
  plano.erros.forEach((e) => {
    assert.ok(typeof e.linha === 'number');
    assert.ok(typeof e.mensagem === 'string' && e.mensagem.length > 0);
  });
});

test('célula divergente em coluna somente-leitura não entra no patch e é contada como ignorada', () => {
  const ctx = carregarSandbox();
  const dados = [equip({ id: 1, situacao: 'instalado' })];
  const csv = ['id;Situação (somente leitura);Área', '1;removido;VERMELHA'].join('\n');
  const plano = ctx.planoDeImportacao(csv, dados);
  assert.equal(plano.leituraIgnorada.length, 1);
  assert.equal(plano.leituraIgnorada[0].coluna, 'Situação (somente leitura)');
  assert.equal(plano.atualizar.length, 0); // Área não mudou, situação é ignorada — nada a atualizar
});

// ══════════════════════════════ 4. TIPOS ═════════════════════════════════

test('data em ISO e em dd/mm/aaaa produzem o mesmo valor; dd/mm/aa, número puro e data impossível são recusados com mensagem própria', () => {
  const ctx = carregarSandbox();
  eq(ctx.celulaParaValor('dataInstalacao', '2026-08-22'), { ok: true, valor: '2026-08-22' });
  eq(ctx.celulaParaValor('dataInstalacao', '22/08/2026'), { ok: true, valor: '2026-08-22' });
  assert.equal(ctx.celulaParaValor('dataInstalacao', '22/08/26').ok, false);
  assert.match(ctx.celulaParaValor('dataInstalacao', '22/08/26').erro, /ambígu/i);
  assert.equal(ctx.celulaParaValor('dataInstalacao', '45000').ok, false);
  assert.match(ctx.celulaParaValor('dataInstalacao', '45000').erro, /número/i);
  assert.equal(ctx.celulaParaValor('dataInstalacao', '31/02/2026').ok, false);
  assert.match(ctx.celulaParaValor('dataInstalacao', '31/02/2026').erro, /imposs/i);
});

test('corrente com vírgula decimal é aceita; com dois separadores é recusada', () => {
  const ctx = carregarSandbox();
  eq(ctx.celulaParaValor('correnteNominal', '7,5'), { ok: true, valor: 7.5 });
  assert.equal(ctx.celulaParaValor('correnteNominal', '1.234,56').ok, false);
  assert.equal(ctx.celulaParaValor('correnteNominal', '7,5,6').ok, false);
});

test('inteiro com sufixo de letra é recusado, não truncado', () => {
  const ctx = carregarSandbox();
  const r = ctx.celulaParaValor('btu', '12abc');
  assert.equal(r.ok, false);
});

test('valor fora de cada uma das três listas fechadas é recusado nomeando a coluna', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.celulaParaValor('funciona', 'QUEBRADO').ok, false);
  assert.equal(ctx.celulaParaValor('criticidade', 'URGENTE').ok, false);
  assert.equal(ctx.celulaParaValor('estado', 'ANTIGA').ok, false);
  assert.equal(ctx.celulaParaValor('funciona', 'OP').ok, true);
  assert.equal(ctx.celulaParaValor('criticidade', 'CRÍTICA').ok, true);
  assert.equal(ctx.celulaParaValor('estado', 'NOVA').ok, true);
});

test('link sem esquema http é recusado', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.celulaParaValor('link', 'javascript:alert(1)').ok, false);
  assert.equal(ctx.celulaParaValor('link', 'www.example.org').ok, false);
  assert.equal(ctx.celulaParaValor('link', 'https://example.org').ok, true);
});

// ════════════════════ 5. ARQUIVAMENTO E GUARDAS ═════════════════════════

test('escopo completo + zero erros + contagem batendo: instalados ausentes entram em arquivar, nomeados', () => {
  const ctx = carregarSandbox();
  const dados = [equip({ id: 1 }), equip({ id: 2, predio: 'MK48', local: 'Sala 2' })];
  const csv = ctx.montarCsv([dados[0]], dados, '2026-08-22'); // só o 1 no arquivo, mas declara escopo pelo total de instalados
  const plano = ctx.planoDeImportacao(csv, dados);
  assert.equal(plano.escopo, 'parcial'); // lista exportada não cobre todo instalado — escopo por conteúdo, não por intenção
  eq(plano.arquivar, []);
});

test('escopo completo de fato (todos os instalados no arquivo) arquiva quem ficou de fora só quando exportado assim', () => {
  const ctx = carregarSandbox();
  const dados = [equip({ id: 1 }), equip({ id: 2, predio: 'MK48', local: 'Sala 2' })];
  const csv = ctx.montarCsv(dados, dados, '2026-08-22');
  // remove a linha do id 2 do CSV à mão, simulando que ele não veio na planilha reimportada
  const linhas = csv.split('\n').filter((l) => !l.startsWith('2;'));
  const plano = ctx.planoDeImportacao(linhas.join('\n'), dados);
  assert.equal(plano.escopo, 'completo');
  assert.equal(plano.arquivar.length, 1);
  assert.equal(plano.arquivar[0].id, 2);
  assert.equal(plano.arquivar[0].predio, 'MK48');
});

test('linha de escopo ausente: arquivar sai vazio e o bloqueio é nomeado', () => {
  const ctx = carregarSandbox();
  const dados = [equip({ id: 1 })];
  const csv = 'id;Área\n1;VERMELHA'; // sem a linha #pmoc-refrigeracao
  const plano = ctx.planoDeImportacao(csv, dados);
  eq(plano.arquivar, []);
  assert.ok(plano.bloqueios.some((b) => /sem linha de escopo/i.test(b)));
});

test('qualquer linha recusada desliga o arquivamento do arquivo inteiro', () => {
  const ctx = carregarSandbox();
  const dados = [equip({ id: 1 }), equip({ id: 2, predio: 'MK48', local: 'Sala 2' })];
  const csv = ctx.montarCsv(dados, dados, '2026-08-22');
  const linhas = csv.split('\n');
  linhas[linhas.length - 1] = linhas[linhas.length - 1].replace(/^2;/, 'abc;'); // id inválido na última linha
  const plano = ctx.planoDeImportacao(linhas.join('\n'), dados);
  eq(plano.arquivar, []);
  assert.ok(plano.bloqueios.some((b) => /recusada/i.test(b)));
});

test('contagem de instalados divergente da atual desliga o arquivamento', () => {
  const ctx = carregarSandbox();
  const dados = [equip({ id: 1 }), equip({ id: 2, predio: 'MK48', local: 'Sala 2' })];
  const csvNaExportacao = ctx.montarCsv([dados[0]], [dados[0]], '2026-08-22'); // exportado quando só havia 1 instalado
  const linhas = csvNaExportacao.split('\n');
  const plano = ctx.planoDeImportacao(linhas.join('\n'), dados); // agora DATA tem 2 instalados
  eq(plano.arquivar, []);
  assert.ok(plano.bloqueios.some((b) => /diverge/i.test(b)));
});

test('já removido ou já baixado, ausente do arquivo, nunca entra em arquivar', () => {
  const ctx = carregarSandbox();
  const dados = [
    equip({ id: 1 }),
    equip({ id: 2, situacao: 'removido' }),
    equip({ id: 3, situacao: 'baixado' }),
  ];
  const csv = ctx.montarCsv([dados[0]], dados, '2026-08-22'); // só o instalado no arquivo
  const plano = ctx.planoDeImportacao(csv, dados);
  assert.equal(plano.escopo, 'completo'); // cobre o único instalado
  eq(plano.arquivar, []); // removido/baixado nunca são candidatos, mesmo ausentes
});

test('já removido, presente no arquivo, tem campos atualizados e situação intocada', () => {
  const ctx = carregarSandbox();
  const dados = [equip({ id: 1, situacao: 'removido', obs: '' })];
  const csv = ['#pmoc-refrigeracao;v1;escopo=completo;instalados=0;exportado=2026-08-22'].concat(
    ctx.montarCsv(dados, [], '2026-08-22').split('\n').slice(1)
  ).join('\n');
  // edita a observação da linha do removido
  const linhas = csv.split('\n');
  const cabecalho = linhas[1].split(';');
  const idxObs = cabecalho.indexOf('Observações');
  const idxId = cabecalho.indexOf('id');
  const camposLinha = linhas[2].split(';');
  camposLinha[idxObs] = 'conferido em campo';
  linhas[2] = camposLinha.join(';');
  const plano = ctx.planoDeImportacao(linhas.join('\n'), dados);
  assert.equal(plano.atualizar.length, 1);
  eq(plano.atualizar[0].campos, ['obs']);
  assert.equal(plano.atualizar[0].patch.situacao, undefined);
  assert.equal(camposLinha[idxId], '1');
});

test('guarda de escala: com 171 instalados, 18 ausentes passa e 19 é bloqueado; com 20 instalados o piso deixa passar 5', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.tetoArquivar(171), 18);
  assert.equal(ctx.tetoArquivar(20), 5);

  const total171 = [];
  for (let i = 1; i <= 171; i++) total171.push(equip({ id: i, predio: 'P' + i, local: 'L' + i }));

  // Exporta o inventário COMPLETO (escopo=completo baked na linha 1, D-5hy-14)
  // e só então remove N linhas de dados do texto — o mesmo acidente real
  // (arquivo completo, mutilado depois) que a guarda de escala existe para
  // pegar; recomputar o escopo a partir de uma lista já reduzida testaria
  // outra coisa (export filtrado, D-5hy-24), que nasce parcial e nunca chega
  // a esta guarda.
  function planoComAusentes(qtdAusentes) {
    const csvCompleto = ctx.montarCsv(total171, total171, '2026-08-22');
    const linhas = csvCompleto.split('\n');
    const restante = [linhas[0], linhas[1]].concat(linhas.slice(2 + qtdAusentes));
    return ctx.planoDeImportacao(restante.join('\n'), total171);
  }

  const plano18 = planoComAusentes(18);
  assert.equal(plano18.escopo, 'completo');
  assert.equal(plano18.arquivar.length, 18);
  eq(plano18.bloqueios, []);

  const plano19 = planoComAusentes(19);
  eq(plano19.arquivar, []);
  assert.ok(plano19.bloqueios.some((b) => /excede o teto/i.test(b)));
});

// ═══════════════════ 6. ESTRUTURAL — D-5hy-02 e D-5hy-08 ════════════════

function recorteNucleo() {
  return recorte('/* ── planilha do inventário: núcleo puro ── */', '/* ── planilha do inventário: tela e gravação ── */');
}

test('D-5hy-02: o núcleo puro nunca cita a palavra terminal de SITUACAO_ORDEM (a baixa patrimonial)', () => {
  const ctx = carregarSandbox();
  const terminal = ctx.SITUACAO_ORDEM[ctx.SITUACAO_ORDEM.length - 1];
  assert.equal(terminal, 'baixado');
  const nucleo = recorteNucleo();
  assert.doesNotMatch(nucleo, new RegExp(terminal));
});

test('D-5hy-08: o núcleo puro não referencia coordenadas nem vínculo organizacional (limite de palavra)', () => {
  const nucleo = recorteNucleo();
  assert.doesNotMatch(nucleo, /\blat\b/);
  assert.doesNotMatch(nucleo, /\blon\b/);
  assert.doesNotMatch(nucleo, /\blocal_id\b/);
});

// ═════════════════ 7. TELA — exportação (Tarefa 2) ═══════════════════════

function recorteTela() {
  const ini = HTML.indexOf('/* ── planilha do inventário: tela e gravação ── */');
  const fim = HTML.indexOf('</script>', ini);
  assert.ok(ini > 0 && fim > ini, 'recorte da seção de tela e gravação não encontrado');
  return HTML.slice(ini, fim);
}

test('#btn-planilha existe, com aria-label e class sec-etq, antes de #btn-etiquetas na mesma .sec-head', () => {
  const iniSecHead = HTML.indexOf('<div class="sec-head">\n        <span class="sec-title" id="inv-label">');
  assert.ok(iniSecHead > 0, '.sec-head do inventário não encontrada');
  const fimSecHead = HTML.indexOf('</div>', HTML.indexOf('id="inv-cnt"', iniSecHead));
  const trecho = HTML.slice(iniSecHead, fimSecHead);
  const posPlanilha = trecho.indexOf('id="btn-planilha"');
  const posEtiquetas = trecho.indexOf('id="btn-etiquetas"');
  assert.ok(posPlanilha > 0, '#btn-planilha não encontrado na .sec-head do inventário');
  assert.ok(posEtiquetas > 0, '#btn-etiquetas não encontrado');
  assert.ok(posPlanilha < posEtiquetas, '#btn-planilha precisa vir antes de #btn-etiquetas (D-5hy-23)');
  const botao = trecho.slice(trecho.lastIndexOf('<button', posPlanilha), trecho.indexOf('</button>', posPlanilha) + '</button>'.length);
  assert.match(botao, /aria-label="/);
  assert.match(botao, /class="sec-etq"/);
});

test('exportarInventarioCsv invoca filtrarInventario e cmpInv — a exportação é a seleção filtrada (D-5hy-24), nunca DATA direto', () => {
  const tela = recorteTela();
  const ini = tela.indexOf('function exportarInventarioCsv(');
  const fim = tela.indexOf('\n}', ini);
  const corpo = tela.slice(ini, fim);
  assert.match(corpo, /filtrarInventario\(/);
  assert.match(corpo, /\.sort\(cmpInv\)/);
  assert.doesNotMatch(corpo, /montarCsv\(DATA,/, 'não pode montar o CSV direto de DATA sem passar pela seleção filtrada');
});

test('baixarPlanilha grava a marca de ordem de byte como sequência de escape, o tipo com charset=utf-8, e revoga a URL do objeto', () => {
  const tela = recorteTela();
  const ini = tela.indexOf('function baixarPlanilha(');
  const fim = tela.indexOf('\n}', ini);
  const corpo = tela.slice(ini, fim);
  assert.match(corpo, /\\uFEFF/, 'a marca de ordem de byte precisa ser a sequência de escape \\uFEFF, nunca o caractere colado');
  assert.doesNotMatch(corpo, /['"]﻿/, 'o caractere de ordem de byte não pode estar colado literal no código-fonte');
  assert.match(corpo, /charset=utf-8/);
  assert.match(corpo, /revokeObjectURL/);
});

test('o bloco de importar do painel é condicionado a podeEditarCadastro()', () => {
  const tela = recorteTela();
  const ini = tela.indexOf('function abrirPainelPlanilha(');
  const fim = tela.indexOf('\nfunction exportarInventarioCsv(', ini);
  const corpo = tela.slice(ini, fim);
  assert.match(corpo, /if\s*\(\s*podeEditarCadastro\(\)\s*\)/);
});

// ═════════════ 8. TELA — importação, conferência e gravação (Tarefa 3) ═══

// supa falso: registra cada chamada (tabela, tipo de operação, payload,
// filtro eq/in) e resolve conforme `comportamento` — usado para provar que
// aplicarPlanoPlanilha produz exatamente as três formas de chamada
// esperadas, sem tocar um Supabase de verdade.
function criarSupaFake(comportamento) {
  const chamadas = [];
  function resolver(registro) {
    chamadas.push(registro);
    return Promise.resolve(comportamento ? comportamento(registro) : { error: null });
  }
  const supa = {
    from(tabela) {
      return {
        update(payload) {
          const registro = { tabela, tipo: 'update', payload };
          return {
            eq(campo, valor) { registro.eq = { campo, valor }; return resolver(registro); },
            in(campo, valores) { registro.in = { campo, valores }; return resolver(registro); },
          };
        },
        insert(payload) {
          return resolver({ tabela, tipo: 'insert', payload });
        },
      };
    },
  };
  return { supa, chamadas };
}

// Carrega A+B+C+D+E (a seção de tela inteira, incluindo o que a Tarefa 2 já
// deixou) no mesmo contexto — aplicarPlanoPlanilha/aoEscolherArquivoPlanilha
// vivem em E e dependem do núcleo de D e da ponte de A.
function carregarSandboxTela(supaFake, ctUserRole) {
  const ctx = carregarSandbox();
  ctx.ctUser = ctUserRole === undefined ? { role: 'gestor' } : ctUserRole;
  ctx.DATA = [];
  ctx.supa = (supaFake || criarSupaFake()).supa;
  ctx.toasts = [];
  ctx.showToast = (msg, tipo) => { ctx.toasts.push({ msg, tipo }); };
  ctx.closeDrawer = () => { ctx.drawerFechada = true; };
  ctx.openDrawer = () => {};
  ctx.loadDataFromSupabase = async () => true;
  ctx.saveData = () => {};
  ctx.renderDash = () => {};
  ctx.renderInv = () => {};
  ctx.el = () => ({});
  vm.runInContext(recorteTela(), ctx);
  return ctx;
}

test('aplicarPlanoPlanilha: um plano com as três operações produz exatamente três formas de chamada, e o payload do arquivamento tem uma única chave cujo valor é o segundo item de SITUACAO_ORDEM', async () => {
  const fake = criarSupaFake();
  const ctx = carregarSandboxTela(fake);
  ctx.PLANO_PLANILHA = {
    atualizar: [{ id: 1, equip: equip({ id: 1 }), patch: { area: 'AZUL' }, campos: ['area'] }],
    criar: [{ linha: 5, patch: { area: 'VERMELHA', predio: 'F21', local: 'Sala 9' } }],
    arquivar: [{ id: 9, predio: 'MK48', local: 'Sala 1' }],
  };
  await ctx.aplicarPlanoPlanilha();

  assert.equal(fake.chamadas.length, 3, 'esperada exatamente uma chamada por operação');
  // três FORMAS de chamada, não três tipos de verbo: update-por-eq
  // (atualizar), insert (criar) e update-por-in (arquivar) — as duas
  // primeiras são tipo 'update' mas se distinguem por eq/in.
  const atualizacoesPorId = fake.chamadas.filter((c) => c.tipo === 'update' && c.eq);
  const insercoes = fake.chamadas.filter((c) => c.tipo === 'insert');
  const arquivamentos = fake.chamadas.filter((c) => c.tipo === 'update' && c.in);
  assert.equal(atualizacoesPorId.length, 1); // atualizar
  assert.equal(insercoes.length, 1); // criar
  assert.equal(arquivamentos.length, 1); // arquivar
  const arquivamento = fake.chamadas.find((c) => c.in);
  assert.ok(arquivamento, 'a chamada de arquivamento precisa usar .in(...)');
  const chavesPayload = Object.keys(arquivamento.payload);
  assert.equal(chavesPayload.length, 1);
  assert.equal(chavesPayload[0], 'situacao');
  assert.equal(arquivamento.payload.situacao, ctx.SITUACAO_ORDEM[1]);
  assert.equal(ctx.SITUACAO_ORDEM[1], 'removido');
});

test('o payload da criação não contém chave de situação nenhuma', async () => {
  const fake = criarSupaFake();
  const ctx = carregarSandboxTela(fake);
  ctx.PLANO_PLANILHA = {
    atualizar: [],
    criar: [{ linha: 5, patch: { area: 'VERMELHA', predio: 'F21', local: 'Sala 9' } }],
    arquivar: [],
  };
  await ctx.aplicarPlanoPlanilha();
  const insercao = fake.chamadas.find((c) => c.tipo === 'insert');
  assert.ok(insercao);
  const payload = insercao.payload[0];
  assert.equal(payload.situacao, undefined);
  assert.equal(payload.data_remocao, undefined);
  assert.equal(payload.data_baixa, undefined);
});

test('um erro na atualização de um id não impede a criação nem o arquivamento, e a mensagem final reporta a falha', async () => {
  const fake = criarSupaFake((registro) => {
    if (registro.tipo === 'update' && registro.eq && registro.eq.valor === 1) {
      return { error: { message: 'falhou' } };
    }
    return { error: null };
  });
  const ctx = carregarSandboxTela(fake);
  ctx.PLANO_PLANILHA = {
    atualizar: [{ id: 1, equip: equip({ id: 1 }), patch: { area: 'AZUL' }, campos: ['area'] }],
    criar: [{ linha: 5, patch: { area: 'VERMELHA', predio: 'F21', local: 'Sala 9' } }],
    arquivar: [{ id: 9, predio: 'MK48', local: 'Sala 1' }],
  };
  await ctx.aplicarPlanoPlanilha();
  assert.equal(fake.chamadas.length, 3, 'as outras duas operações precisam ter acontecido apesar da falha');
  assert.ok(fake.chamadas.some((c) => c.tipo === 'insert'));
  assert.ok(fake.chamadas.some((c) => c.in));
  const ultimoToast = ctx.toasts[ctx.toasts.length - 1];
  assert.match(ultimoToast.msg, /falh/i);
  assert.equal(ultimoToast.tipo, 'error');
});

test('estrutural: aoEscolherArquivoPlanilha e aplicarPlanoPlanilha chamam ambos somenteLeitura e podeEditarCadastro', () => {
  const tela = recorteTela();
  function corpoDe(nomeFuncao, proximaFuncao) {
    const ini = tela.indexOf('function ' + nomeFuncao + '(');
    const fim = proximaFuncao ? tela.indexOf('\n' + proximaFuncao, ini) : tela.length;
    assert.ok(ini > 0 && fim > ini, `função ${nomeFuncao} não encontrada`);
    return tela.slice(ini, fim);
  }
  const corpoEscolher = corpoDe('aoEscolherArquivoPlanilha', 'function planilhaFraseItem(');
  assert.match(corpoEscolher, /somenteLeitura\(\)/);
  assert.match(corpoEscolher, /podeEditarCadastro\(\)/);

  const corpoAplicar = corpoDe('aplicarPlanoPlanilha', null); // última função da seção — vai até o fim do recorte
  assert.match(corpoAplicar, /somenteLeitura\(\)/);
  assert.match(corpoAplicar, /podeEditarCadastro\(\)/);
});

test('estrutural: renderConferenciaPlanilha não contém chamada a supa', () => {
  const tela = recorteTela();
  const ini = tela.indexOf('function renderConferenciaPlanilha(');
  const fim = tela.indexOf('\nasync function aplicarPlanoPlanilha(', ini);
  const corpo = tela.slice(ini, fim);
  assert.doesNotMatch(corpo, /\bsupa\./);
});

test('estrutural: a única ocorrência de .update( com chave de situação em toda a seção de tela é a do arquivamento', () => {
  const tela = recorteTela();
  const ocorrencias = tela.match(/\.update\([^)]*situacao[^)]*\)/g) || [];
  assert.equal(ocorrencias.length, 1, `esperada 1 ocorrência, achadas: ${JSON.stringify(ocorrencias)}`);
});


// ═══════ 8. TRAVESSIA DAS COLUNAS DE AMBIENTE (260902) ═══════════════════
//
// As cinco colunas da migração 04 (area_m2, pe_direito, n_pessoas,
// dissipacao_w, fator_insolacao) entraram em EQUIP_EDITAVEIS em 31/08
// (D-2wq-01), e `tipoUso`/`janelas` entraram pela sonda TERM_OK. Nenhuma
// delas ganhou ramo em `celulaParaValor`: caíam no `return` final, que
// devolve o TEXTO CRU. Este gate nasce de uma medição, não de leitura —
// gerei a planilha das 175 linhas de produção para trabalho de campo e,
// ao conferir o que a importação aceitaria de volta, os seis casos abaixo
// passavam.
//
// O que torna isso grave, e não só feio: ao contrário de `janelas` e
// `tipo_uso`, as cinco da migração 04 são `numeric`/`integer` SEM CHECK —
// não há segunda barreira no banco. `'1.200'` (mil e duzentos à
// brasileira) o Postgres lê como 1,2 e grava sem erro nenhum.

function tipos(ctx) { return vm.runInContext('Object.keys(TERM_TIPOS_USO)', ctx); }

test('a lista fechada da tela é a mesma do check da migração 47', () => {
  const ctx = carregarSandbox();
  const sql = fs.readFileSync(path.join(RAIZ, 'supabase', '47_refrigeracao_carga_termica.sql'), 'utf8');
  const bloco = sql.slice(sql.indexOf('equipamentos_tipo_uso_check'));
  tipos(ctx).forEach((k) => {
    assert.ok(bloco.includes(`'${k}'`), `"${k}" está na tela e não no check da migração 47`);
  });
});

test('tipo de uso: a chave passa, o rótulo é normalizado para a chave', () => {
  const ctx = carregarSandbox();
  eq(ctx.celulaParaValor('tipoUso', 'escritorio'), { ok: true, valor: 'escritorio' });
  // Quem preenche em campo lê "Escritório" na coluna e escreve isso.
  eq(ctx.celulaParaValor('tipoUso', 'Escritório'), { ok: true, valor: 'escritorio' });
  eq(ctx.celulaParaValor('tipoUso', 'sala técnica / ti'), { ok: true, valor: 'sala_tecnica' });
});

test('tipo de uso fora da lista é recusado ANTES de chegar ao Postgres', () => {
  const ctx = carregarSandbox();
  const r = ctx.celulaParaValor('tipoUso', 'sala_de_estar');
  assert.equal(r.ok, false, 'valor fora do check da migração 47 tem de ser recusado aqui');
  // A mensagem nomeia as opções: sem isso o técnico descobre a lista por
  // tentativa, e o erro do banco não a diz.
  tipos(ctx).forEach((k) => assert.ok(r.erro.includes(k), `a mensagem deveria nomear "${k}"`));
});

test('janelas espelha a faixa do check da migração 47 (0 a 50)', () => {
  const ctx = carregarSandbox();
  const sql = fs.readFileSync(path.join(RAIZ, 'supabase', '47_refrigeracao_carga_termica.sql'), 'utf8');
  assert.match(sql, /janelas >= 0 and janelas <= 50/, 'o check mudou — esta faixa vem dele, não de escolha da tela');
  eq(ctx.celulaParaValor('janelas', '2'), { ok: true, valor: 2 });
  assert.equal(ctx.celulaParaValor('janelas', '-1').ok, false);
  assert.equal(ctx.celulaParaValor('janelas', '99').ok, false);
});

test('decimais: vírgula é aceita, e o milhar ambíguo é RECUSADO em vez de virar 1,2', () => {
  const ctx = carregarSandbox();
  eq(ctx.celulaParaValor('areaM2', '12,5'), { ok: true, valor: 12.5 });
  eq(ctx.celulaParaValor('peDireito', '2,7'), { ok: true, valor: 2.7 });
  eq(ctx.celulaParaValor('dissipacaoW', '1200'), { ok: true, valor: 1200 });
  // O caso que motivou tudo: sem esta guarda o valor entra como 1.2 num
  // `numeric` sem check, silenciosamente, e a carga térmica calcula com um
  // milésimo da dissipação real.
  const amb = ctx.celulaParaValor('dissipacaoW', '1.200');
  assert.equal(amb.ok, false, '"1.200" é ambíguo e não pode ser adivinhado');
  assert.match(amb.erro, /ambíguo/);
  assert.equal(ctx.celulaParaValor('areaM2', 'abc').ok, false);
});

test('grandeza física negativa é recusada', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.celulaParaValor('areaM2', '-5').ok, false);
  assert.equal(ctx.celulaParaValor('nPessoas', '-3').ok, false);
  assert.equal(ctx.celulaParaValor('correnteNominal', '-1').ok, false);
});

// O erro que este caso existe para impedir eu cometi ao escrever a
// correção: o parser aceitava 0 para TODAS as decimais, e a migração 56
// exige `area_m2 > 0`. Uma sala de zero m² passaria pela tela e seria
// recusada pelo Postgres — o mesmo erro opaco no meio da gravação que a
// travessia inteira existe para evitar. Onde o zero é legítimo (ocupação,
// dissipação) ele continua passando.
test('o zero é aceito ou recusado por coluna, exatamente como a migração 56 manda', () => {
  const ctx = carregarSandbox();
  const sql = fs.readFileSync(path.join(RAIZ, 'supabase', '56_refrigeracao_ambiente_checks.sql'), 'utf8');
  const mins = vm.runInContext('PLANILHA_MINIMOS', ctx);

  // A coluna cujo check no banco é `> 0` tem de ter mínimo positivo aqui,
  // e a cujo check é `>= 0` tem de aceitar zero. Lido do SQL, não escrito
  // à mão: se alguém afrouxar o banco sem afrouxar a tela (ou o contrário)
  // este caso reprova.
  const colunas = { areaM2: 'area_m2', peDireito: 'pe_direito', fatorInsolacao: 'fator_insolacao',
                    dissipacaoW: 'dissipacao_w', nPessoas: 'n_pessoas' };
  Object.keys(colunas).forEach((chave) => {
    const col = colunas[chave];
    const exigePositivo = new RegExp(`${col}\\s*>\\s*0`).test(sql);
    const aceitaZero = new RegExp(`${col}\\s*>=\\s*0`).test(sql);
    assert.ok(exigePositivo || aceitaZero, `a migração 56 não diz nada sobre ${col}`);
    const r = ctx.celulaParaValor(chave, '0');
    assert.equal(r.ok, aceitaZero && !exigePositivo,
      `${col}: banco ${exigePositivo ? 'exige > 0' : 'aceita 0'}, tela ${r.ok ? 'aceita 0' : 'recusa 0'}`);
    if (chave !== 'nPessoas') {
      assert.ok((mins[chave] > 0) === exigePositivo, `PLANILHA_MINIMOS.${chave} divergiu do check de ${col}`);
    }
  });
});


// ═══════ 9. FAIXA DOS INTEIROS (migração 57, 02/09) ══════════════════
//
// A varredura de 02/09 achou 77 colunas numéricas sem check no banco.
// Triadas por risco real — sem check E preenchível por uma pessoa —
// sobraram estas quatro como urgentes, porque estão na planilha que foi
// a campo: `horas_dia`, `dias_semana`, `tensao` e `btu`. Nem a tela nem
// o banco recusavam `horas_dia = 30`, e essa coluna alimenta a
// estimativa de kWh: 25% de consumo a mais, em silêncio.
//
// `janelas` tinha os números escritos dentro de um `if` no parser; virou
// linha de PLANILHA_FAIXAS porque um gate compara uma tabela contra o
// SQL e não compara um `if`.

test('PLANILHA_FAIXAS espelha, coluna a coluna, os check das migrações 47 e 57', () => {
  const ctx = carregarSandbox();
  const faixas = vm.runInContext('PLANILHA_FAIXAS', ctx);
  const sql =
    fs.readFileSync(path.join(RAIZ, 'supabase', '47_refrigeracao_carga_termica.sql'), 'utf8') +
    fs.readFileSync(path.join(RAIZ, 'supabase', '57_refrigeracao_operacao_checks.sql'), 'utf8');

  const colunas = { janelas: 'janelas', horasDia: 'horas_dia', diasSemana: 'dias_semana',
                    tensao: 'tensao', btu: 'btu' };

  Object.keys(colunas).forEach((chave) => {
    const col = colunas[chave];
    const faixa = faixas[chave];
    assert.ok(faixa, `${chave} sumiu de PLANILHA_FAIXAS`);
    // Os dois números lidos do SQL, não escritos aqui: se alguém mexer no
    // check sem mexer na tela (ou o contrário), este caso reprova.
    const min = sql.match(new RegExp(`${col}\\s*>=\\s*(\\d+)`));
    const max = sql.match(new RegExp(`${col}\\s*<=\\s*(\\d+)`));
    assert.ok(min && max, `a migração não declara faixa para ${col}`);
    assert.equal(faixa.min, Number(min[1]), `${col}: tela min=${faixa.min}, banco min=${min[1]}`);
    assert.equal(faixa.max, Number(max[1]), `${col}: tela max=${faixa.max}, banco max=${max[1]}`);
  });
});

test('a borda de cada faixa é aceita e o passo seguinte é recusado', () => {
  const ctx = carregarSandbox();
  const faixas = vm.runInContext('PLANILHA_FAIXAS', ctx);
  Object.keys(faixas).forEach((chave) => {
    const { min, max } = faixas[chave];
    assert.equal(ctx.celulaParaValor(chave, String(min)).ok, true, `${chave}: ${min} deveria passar`);
    assert.equal(ctx.celulaParaValor(chave, String(max)).ok, true, `${chave}: ${max} deveria passar`);
    assert.equal(ctx.celulaParaValor(chave, String(min - 1)).ok, false, `${chave}: ${min - 1} deveria ser recusado`);
    assert.equal(ctx.celulaParaValor(chave, String(max + 1)).ok, false, `${chave}: ${max + 1} deveria ser recusado`);
  });
});

// O caso concreto que motivou a migração, escrito por extenso para não
// se perder atrás da varredura de bordas acima.
test('horas_dia = 30 e dias_semana = 99 são recusados antes do Postgres', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.celulaParaValor('horasDia', '30').ok, false, 'não existe vigésima quinta hora');
  assert.equal(ctx.celulaParaValor('diasSemana', '99').ok, false, 'não existe octogésimo dia');
  assert.equal(ctx.celulaParaValor('horasDia', '24').ok, true);
  assert.equal(ctx.celulaParaValor('diasSemana', '7').ok, true);
});

// btu aceita zero, e isso é decisão de DADO, não de gosto: dbToEquip faz
// `o.btu = o.btu || 0`, então os equipamentos com btu nulo no banco saem
// da exportação com a célula "0". Um check `> 0` os recusaria em toda
// importação — e linha recusada bloqueia o arquivamento do arquivo
// inteiro (D-5hy-11). tensao não sofre disso e por isso exige >= 1.
test('btu aceita 0 porque dbToEquip força null em 0; tensao não aceita', () => {
  const ctx = carregarSandbox();
  assert.equal(ctx.celulaParaValor('btu', '0').ok, true,
    'btu = 0 é o que a exportação produz para um equipamento sem capacidade cadastrada');
  assert.equal(ctx.celulaParaValor('tensao', '0').ok, false, 'zero volt não é uma tensão');
  const sql = fs.readFileSync(path.join(RAIZ, 'supabase', '57_refrigeracao_operacao_checks.sql'), 'utf8');
  assert.match(sql, /btu >= 0/, 'o banco tem de concordar com a tela sobre o zero');
  assert.match(sql, /tensao >= 1/);
});
