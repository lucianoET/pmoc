// Gate do acervo de documentos (/refrigeracao, migrações 52 e 53).
//
// A plataforma APLICA norma o tempo todo e não tinha onde consultá-la:
// `plano_tarefas.norma_ref` guarda "NBR 17037" como texto solto, e o
// código sozinho não diz o título, não diz o órgão e não abre nada.
//
// O que este arquivo trava:
//  - UMA fonte por tipo de coisa: norma continua em `pred_normas`, que
//    já existia com 10 linhas desde a migração 18; o `check` de
//    `cmasm_documentos.categoria` NÃO aceita 'norma', de modo que o
//    Postgres — e não a disciplina de quem escreve — impede a segunda
//    lista de normas;
//  - a tela NÃO escreve em `pred_normas`: uma segunda porta de escrita
//    sobre a tabela que /predial também lê é o que se evita aqui;
//  - sonda própria (DOC_OK), a oitava, e o botão de navegação injetado
//    em runtime — sem migração, sem botão, estruturalmente;
//  - link com três estados (conferido, não conferido, sem link) e
//    `linkSeguro` em toda âncora (D-q57-09);
//  - nenhuma classe de CSS nova (D-cf8-20) e as cinco `.nav-btn` da
//    marcação intactas.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const SQL_52 = fs.readFileSync(path.join(RAIZ, 'supabase', '52_documentos_acervo.sql'), 'utf8');
const SQL_53 = fs.readFileSync(path.join(RAIZ, 'supabase', '53_documentos_seed.sql'), 'utf8');

// Os comentários deste projeto NOMEIAM o que as regras proíbem ("norma
// NÃO se edita aqui", "nenhuma classe nova"). Grepar o texto cru
// acusaria a explicação como se fosse a infração.
function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
function semComentarioSql(txt) { return txt.replace(/^\s*--.*$/gm, ''); }
function semProsaSql(txt) {
  return semComentarioSql(txt).replace(/comment on[\s\S]*?is\s*'(?:[^']|'')*'\s*;/gi, ' ');
}

const MARCA_INI = '   DOCUMENTOS — acervo de normas, manuais, formulários e conceitos';
const MARCA_FIM = '\nfunction docAbrirForm(';

function recorte() {
  const ini = HTML.lastIndexOf('/* ═', HTML.indexOf(MARCA_INI));
  const fim = HTML.indexOf(MARCA_FIM, ini);
  assert.ok(ini > 0 && fim > ini, 'recorte da seção DOCUMENTOS não encontrado');
  return HTML.slice(ini, fim);
}

function carregarNucleo() {
  const ctx = {
    esc: (s) => String(s === null || s === undefined ? '' : s)
      .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    el: () => null,
    linkSeguro: (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : ''),
    podeEditarCadastro: () => false,
    tabNormalizar: (t) => String(t === null || t === undefined ? '' : t)
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    document: { querySelector: () => null },
    console: { warn() {} },
    supa: null,
  };
  vm.createContext(ctx);
  vm.runInContext(recorte(), ctx);
  return ctx;
}

// ═══════════ uma fonte por tipo de coisa ═══════════

test('cmasm_documentos NÃO aceita a categoria norma — o Postgres impede a segunda lista', () => {
  const check = SQL_52.match(/categoria text not null check \(categoria in \(([^)]*)\)\)/);
  assert.ok(check, 'o check de categoria não foi encontrado na migração 52');
  const valores = [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepStrictEqual(valores, ['conceito', 'formulario', 'manual']);
  assert.ok(!valores.includes('norma'),
    'norma em cmasm_documentos criaria duas fontes de verdade ao lado de pred_normas');
});

test('a migração 52 é ADITIVA sobre pred_normas — nunca recria nem apaga a tabela', () => {
  const sql = semProsaSql(SQL_52);
  assert.match(sql, /alter table pred_normas add column if not exists modulo text/);
  assert.match(sql, /alter table pred_normas add column if not exists url_conferido date/);
  assert.ok(!/drop\s+(table|column|policy)/i.test(sql), 'o projeto arquiva, nunca apaga');
  assert.ok(!/create table[^;]*pred_normas/i.test(sql),
    'pred_normas já existe desde a migração 17 — recriá-la aqui seria a segunda definição');
});

test('a tela LÊ pred_normas e nunca escreve nela — /predial lê a mesma tabela', () => {
  const fonte = semComentarios(recorte());
  assert.match(fonte, /supa\.from\('pred_normas'\)\.select/);
  for (const escrita of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`from\\('pred_normas'\\)\\s*\\.\\s*${escrita}`);
    assert.ok(!re.test(fonte), `a tela não pode ${escrita} em pred_normas`);
  }
});

test('a escrita do acervo tem UMA porta: cmasm_documentos, no insert e no update', () => {
  const fonte = semComentarios(HTML);
  const escritas = [...fonte.matchAll(/from\('cmasm_documentos'\)\s*\.\s*(insert|update|delete|upsert)/g)]
    .map((m) => m[1]).sort();
  assert.deepStrictEqual(escritas, ['insert', 'update'],
    'exatamente uma inserção e uma atualização — uma terceira seria porta de escrita nova');
});

// ═══════════ sonda própria e navegação injetada ═══════════

test('DOC_OK é sonda PRÓPRIA — não é ramo de EST_OK nem de nenhuma outra', () => {
  const fonte = semComentarios(recorte());
  assert.match(fonte, /var DOC_OK = false;/);
  assert.match(fonte, /async function docSondarEsquema\(\)/);
  assert.match(fonte, /supa\.from\('cmasm_documentos'\)\.select\('id'\)\.limit\(1\)/);
  for (const outra of ['EST_OK', 'MAN_FLUXO_OK', 'UNI_OK', 'ATRIB_OK', 'TERM_OK', 'INSP_OK', 'MOV_OK']) {
    assert.ok(!fonte.includes(outra),
      `a seção de documentos não pode depender de ${outra} — sonda por migração (D-6wy-08)`);
  }
});

test('duas leituras, duas perguntas: pred_normas existe desde a 17 e é sondada à parte', () => {
  const fonte = semComentarios(recorte());
  assert.match(fonte, /var DOC_NORMAS_OK = false;/);
  assert.match(fonte, /supa\.from\('pred_normas'\)\.select\('id,modulo'\)\.limit\(1\)/,
    'a sonda precisa pedir a coluna NOVA, senão passaria num banco sem a migração 52');
});

test('#bottom-nav continua com exatamente cinco .nav-btn na marcação', () => {
  const ini = HTML.indexOf('<div id="bottom-nav">');
  assert.ok(ini > 0);
  const trecho = HTML.slice(ini, HTML.indexOf('</div>', ini));
  assert.equal((trecho.match(/class="nav-btn/g) || []).length, 5);
});

test('o botão de Documentos é INJETADO em runtime e só com sonda ligada', () => {
  const fonte = semComentarios(recorte());
  assert.match(fonte, /function docInjectNav\(\)/);
  assert.match(fonte, /if \(!DOC_OK && !DOC_NORMAS_OK\) return;/);
  assert.ok(!/id="nav-documentos"/.test(HTML.slice(HTML.indexOf('<div id="bottom-nav">'), HTML.indexOf('</div>', HTML.indexOf('<div id="bottom-nav">')))),
    'sem migração, sem botão — tem de ser estrutural, não escondido por CSS');
});

test('acessoLivre e initApp chamam a sonda, a injeção e a carga — nas duas entradas', () => {
  const fonte = semComentarios(HTML);
  assert.equal((fonte.match(/await docSondarEsquema\(\);/g) || []).length, 2);
  assert.equal((fonte.match(/\n\s*docInjectNav\(\);/g) || []).length, 2);
  assert.equal((fonte.match(/await carregarDocumentos\(\);/g) || []).length, 3,
    'duas na carga (observador e sessão) e uma depois de salvar');
});

test('sem as duas migrações a página DIZ o que houve, em vez de sumir', () => {
  const fonte = recorte();
  assert.match(fonte, /if \(!DOC_OK && !DOC_NORMAS_OK\) \{[\s\S]*?migração 52/);
  assert.match(fonte, /O resto do módulo continua funcionando normalmente/);
});

// ═══════════ núcleo puro: comportamento, não regex ═══════════

test('docNormalizar traduz as DUAS formas de linha para a mesma — descricao vs resumo', () => {
  const N = carregarNucleo();
  const norma = N.docNormalizar(
    { id: 7, codigo: 'NBR 17037:2023', titulo: 'Qualidade do ar', orgao: 'ABNT', ano: 2023,
      modulo: 'refrigeracao', url: null, url_conferido: null, descricao: 'a norma do PMOC' }, 'norma');
  assert.equal(norma.codigo, 'NBR 17037:2023');
  assert.equal(norma.fonte, 'ABNT');
  assert.equal(norma.ano, 2023);
  assert.equal(norma.resumo, 'a norma do PMOC', 'norma guarda o texto em `descricao`');

  const doc = N.docNormalizar(
    { id: 3, categoria: 'conceito', titulo: 'PMOC', fonte: null, modulo: 'refrigeracao',
      url: null, url_conferido: null, onde: null, resumo: 'plano de manutenção' }, 'conceito');
  assert.equal(doc.codigo, '', 'conceito não tem código de norma');
  assert.equal(doc.ano, null);
  assert.equal(doc.resumo, 'plano de manutenção', 'documento guarda o texto em `resumo`');
});

test('docEstadoLink tem TRÊS estados — link não conferido não pode passar por conferido', () => {
  const N = carregarNucleo();
  assert.equal(N.docEstadoLink({ url: '', urlConferido: '' }), 'sem');
  assert.equal(N.docEstadoLink({ url: 'https://a.b', urlConferido: '' }), 'nao-conferido');
  assert.equal(N.docEstadoLink({ url: 'https://a.b', urlConferido: '2026-08-31' }), 'conferido');
});

test('a busca ignora acento e caixa, e acha pelo número da norma sem o prefixo', () => {
  const N = carregarNucleo();
  const item = N.docNormalizar(
    { id: 1, codigo: 'NBR 17037:2023', titulo: 'Qualidade do ar interior em ambientes climatizados',
      orgao: 'ABNT', ano: 2023, modulo: 'refrigeracao', descricao: 'a norma do PMOC' }, 'norma');
  for (const termo of ['17037', 'climatizados', 'CLIMATIZADOS', 'qualidade', 'abnt', 'refrigeracao', 'pmoc']) {
    assert.ok(N.docCasaBusca(item, termo), `deveria achar por "${termo}"`);
  }
  assert.ok(N.docCasaBusca(item, ''), 'termo vazio não filtra nada');
  assert.ok(!N.docCasaBusca(item, 'motosserra'));
});

test('docFiltrar combina categoria E termo; "tudo" não filtra por categoria', () => {
  const N = carregarNucleo();
  const acervo = N.docAcervo(
    [{ id: 1, categoria: 'conceito', titulo: 'PMOC', resumo: '' },
     { id: 2, categoria: 'formulario', titulo: 'Etiqueta com QR', resumo: '' }],
    [{ id: 3, codigo: 'NR-10', titulo: 'Eletricidade', orgao: 'MTE', descricao: '' }]);
  assert.equal(acervo.length, 3);
  assert.equal(N.docFiltrar(acervo, 'tudo', '').length, 3);
  assert.equal(N.docFiltrar(acervo, 'conceito', '').length, 1);
  assert.equal(N.docFiltrar(acervo, 'tudo', 'qr').length, 1);
  assert.equal(N.docFiltrar(acervo, 'norma', 'qr').length, 0, 'categoria E termo, nunca OU');
});

test('docAcervo põe norma e documento na MESMA lista, sem perder nenhum dos dois', () => {
  const N = carregarNucleo();
  const acervo = N.docAcervo([{ id: 1, categoria: 'manual', titulo: 'M' }], [{ id: 2, codigo: 'X', titulo: 'N' }]);
  assert.deepStrictEqual(acervo.map((i) => i.categoria).sort(), ['manual', 'norma']);
  assert.equal(N.docAcervo(null, null).length, 0, 'sem dado nenhum a lista é vazia, nunca undefined');
});

test('o rótulo curto é ESCRITO, não cortado — uma norma não pode dizer "NORMAS"', () => {
  const N = carregarNucleo();
  assert.equal(N.docCurtoCategoria('norma'), 'NORMA');
  assert.equal(N.docCurtoCategoria('formulario'), 'FORM.');
  assert.equal(N.docCurtoCategoria('conceito'), 'CONC.');
  assert.equal(N.docCurtoCategoria('manual'), 'MANUAL');
  const fonte = semComentarios(recorte());
  assert.ok(!/\.slice\(0,\s*6\)/.test(fonte), 'cortar o rótulo produz palavra quebrada');
});

test('a contagem por categoria não inventa chave nem perde item', () => {
  const N = carregarNucleo();
  const c = N.docContarPorCategoria(N.docAcervo(
    [{ id: 1, categoria: 'conceito', titulo: 'a' }, { id: 2, categoria: 'conceito', titulo: 'b' }],
    [{ id: 3, codigo: 'X', titulo: 'n' }]));
  // objeto vindo de outro realm do vm: comparar por estrutura, não por referência
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c)), { norma: 1, manual: 0, formulario: 0, conceito: 2 });
});

// ═══════════ link seguro e cabeçalho de grupo ═══════════

test('toda âncora do acervo passa por linkSeguro — url gravada vira texto, nunca href', () => {
  const N = carregarNucleo();
  const perigoso = N.docNormalizar(
    { id: 1, codigo: 'X', titulo: 'T', orgao: 'O', url: 'javascript:alert(1)', url_conferido: '2026-08-31' }, 'norma');
  const html = N.docItemHtml(perigoso);
  assert.ok(!/javascript:/i.test(html), 'D-q57-09: url que não passa em linkSeguro não pode virar âncora');
  assert.ok(!/<a /.test(html), 'sem link seguro não existe âncora nenhuma');

  const bom = N.docNormalizar(
    { id: 2, codigo: 'Y', titulo: 'T', orgao: 'O', url: 'https://www.gov.br/x', url_conferido: '2026-08-31' }, 'norma');
  const htmlBom = N.docItemHtml(bom);
  assert.match(htmlBom, /<a href="https:\/\/www\.gov\.br\/x" target="_blank" rel="noopener"/);
});

test('o link NÃO conferido é rotulado como tal na tela — a data é uma afirmação', () => {
  const N = carregarNucleo();
  const html = N.docItemHtml(N.docNormalizar(
    { id: 1, codigo: 'X', titulo: 'T', orgao: 'O', url: 'https://a.b', url_conferido: null }, 'norma'));
  assert.match(html, /não conferido/);
});

test('o cabeçalho de grupo só aparece em "Tudo" — filtrado, o chip já diz a categoria', () => {
  const N = carregarNucleo();
  const lista = N.docAcervo([{ id: 1, categoria: 'conceito', titulo: 'PMOC' }],
                            [{ id: 2, codigo: 'NR-10', titulo: 'Eletricidade', orgao: 'MTE' }]);
  N.DOC_FILTRO = 'tudo';
  const comGrupo = N.docListaHtml(lista);
  assert.match(comGrupo, /sec-title">Normas</);
  assert.match(comGrupo, /sec-title">Conceitos</);
  N.DOC_FILTRO = 'conceito';
  const semGrupo = N.docListaHtml(lista.filter((i) => i.categoria === 'conceito'));
  assert.ok(!/sec-title/.test(semGrupo), 'com o chip aceso o cabeçalho seria redundante');
});

// ═══════════ nada de classe nova ═══════════

test('a seção não inventa classe de CSS — só usa as que já existem na folha', () => {
  const fonte = recorte();
  const usadas = new Set();
  for (const m of fonte.matchAll(/class="([^"'+]*)"/g)) {
    m[1].split(/\s+/).filter(Boolean).forEach((c) => usadas.add(c));
  }
  assert.ok(usadas.size > 5, 'esperava classes na seção');
  for (const c of usadas) {
    // `fas`/`fa-*` vêm do Font Awesome, carregado por CDN — não são
    // classes desta folha e o resto do arquivo já as usa assim.
    if (/^fa($|[srb-])/.test(c)) continue;
    assert.ok(HTML.includes('.' + c + '{') || HTML.includes('.' + c + ' ') || HTML.includes('.' + c + ','),
      `classe "${c}" não existe na folha — criar CSS aqui quebra a comparação byte a byte (D-cf8-20)`);
  }
});

// ═══════════ a semente não inventa ═══════════

test('a semente não marca como conferido nenhum link que não foi aberto', () => {
  // Só os endereços de gov.br e do catálogo da ABNT responderam do
  // ambiente onde a semente foi escrita; planalto.gov.br não responde.
  // Um planalto marcado com data seria uma afirmação sobre uma página
  // que ninguém viu.
  const linhas = SQL_53.split('\n');
  linhas.forEach((linha, i) => {
    if (!/'\d{4}-\d{2}-\d{2}'/.test(linha)) return;
    const janela = linhas.slice(Math.max(0, i - 4), i + 1).join(' ');
    if (!/https?:\/\//.test(janela)) return;
    assert.ok(!/planalto\.gov\.br/.test(janela),
      'link do planalto não pode entrar como conferido — o host não responde deste ambiente');
  });
});

test('a semente não usa DELETE nem DROP e é idempotente onde pode ser', () => {
  const sql = semProsaSql(SQL_53);
  assert.ok(!/\bdelete\b|\bdrop\b|\btruncate\b/i.test(sql), 'o projeto arquiva, nunca apaga');
  assert.match(sql, /insert into pred_normas[\s\S]*?on conflict \(codigo\) do nothing/,
    'reaplicar a semente não pode duplicar norma nem sobrescrever título corrigido na tela');
});

test('nenhum manual é semeado — manual é do fabricante e do modelo', () => {
  const sql = semProsaSql(SQL_53);
  assert.ok(!/'manual'/.test(sql),
    'inventar endereço de manual poria no acervo documento que ninguém pode abrir (mesma regra de D-eq-06)');
  assert.match(recorte(), /Nenhum manual no acervo/,
    'a tela precisa DIZER que a seção está vazia e como preenchê-la');
});

test('as normas semeadas declaram módulo — é como a tela agrupa', () => {
  const sql = semProsaSql(SQL_53);
  assert.match(sql, /update pred_normas set modulo = 'predial'/);
  assert.match(sql, /update pred_normas set modulo = 'geral'/);
  for (const m of ['refrigeracao', 'eletrica', 'geral']) {
    assert.ok(sql.includes(`'${m}'`), `esperava norma do módulo ${m} na semente`);
  }
});

test('a RLS do acervo é a da plataforma: leitura aberta, escrita admin/gestor', () => {
  assert.match(SQL_52, /create policy cmasm_documentos_sel on cmasm_documentos\s*\n?\s*for select to public using \(true\)/);
  assert.match(SQL_52, /create policy cmasm_documentos_write on cmasm_documentos[\s\S]*?to authenticated[\s\S]*?in \('admin','gestor'\)/);
});
