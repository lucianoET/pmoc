const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Decisão de 02/09/2026: o CLAUDE.md da raiz é o registro único do projeto.
//
// Este gate segue o padrão que tests/tema-superficies.test.js estabeleceu na
// Fase 6 e que tests/mapa-decisoes.test.js repetiu na Fase 10: uma decisão de
// exclusão vira teste, não comentário — porque comentário não falha sozinho
// quando alguém o contraria depois. O ROADMAP.md dizia isso com todas as
// letras em D-01 ("a exclusão deve virar teste, não omissão"), e ele mesmo
// está arquivado agora, então a regra tem de sobreviver ao próprio arquivo
// que a escreveu.
//
// O que se protege aqui NÃO é a ausência de pastas por gosto de faxina. É que
// o projeto já pagou o preço de ter dois registros com um deles morto: o
// .planning/ parou em 23/08/2026 sem artefato para as 12 tasks mescladas de
// 30/08 em diante, e o /.claude/CLAUDE.md — gerado dele, todas as 382 linhas
// dentro de blocos GSD — era injetado como instrução em toda sessão afirmando
// "dois módulos em produção" quando havia dez, "7 cutting machines" quando
// havia 28 e "migrações 01 a 09" quando havia 55. Instrução errada carregada
// automaticamente é pior que documentação velha parada numa pasta: ela chega
// antes de qualquer pergunta.
const RAIZ = path.join(__dirname, '..')
const ARQUIVO_MORTO = path.join(RAIZ, 'docs', 'historico', 'planning')

test('não existe /.planning na raiz — o registro é o CLAUDE.md', () => {
  assert.equal(
    fs.existsSync(path.join(RAIZ, '.planning')),
    false,
    'recriar /.planning devolve o segundo registro que a decisão de 02/09/2026 aposentou; ' +
      'o histórico está em docs/historico/planning/ e cada task nova se registra no CLAUDE.md'
  )
})

test('não existe /.claude/CLAUDE.md — um só arquivo de instrução, o da raiz', () => {
  assert.equal(
    fs.existsSync(path.join(RAIZ, '.claude', 'CLAUDE.md')),
    false,
    'um segundo CLAUDE.md é carregado como instrução junto com o da raiz; quando os dois ' +
      'divergem não há como saber qual vale, e foi exatamente assim que "dois módulos em ' +
      'produção" seguiu sendo afirmado com dez no ar'
  )
})

// O acervo continua legível: aposentar é arquivar, nunca apagar — a mesma
// regra que vale para o banco (migrações aditivas, `ativo = false`). Se
// alguém "limpar" a pasta arquivada, o CONFERENCIA-IMPORT.md citado pelo
// README e pelo TESTES.md vira link morto, e a lista completa das 54
// pendências de segurança se perde — o CLAUDE.md só carrega o resumo delas.
test('o acervo aposentado continua no repositório — o projeto arquiva, nunca apaga', () => {
  assert.ok(
    fs.existsSync(path.join(ARQUIVO_MORTO, 'LEIA-ME.md')),
    'docs/historico/planning/LEIA-ME.md explica o que foi aposentado e por quê'
  )
  assert.ok(
    fs.existsSync(path.join(ARQUIVO_MORTO, 'BACKLOG-TECNICO.md')),
    'a lista completa dos 54 itens de segurança; o CLAUDE.md guarda só o resumo'
  )
  assert.ok(
    fs.existsSync(
      path.join(
        ARQUIVO_MORTO,
        'phases',
        '01-transportes-frota-sob-manuten-o',
        '01-CONFERENCIA-IMPORT.md'
      )
    ),
    'citado por README.md e TESTES.md — registra por que o seed importou 9 de 43 ativos'
  )
})

// A análise em .planning/codebase/ é da era de dois módulos: o STRUCTURE.md
// de lá só conhece refrigeracao/ e maquinas/, e hoje são dez. Enquanto o
// CLAUDE.md mandava lê-la "antes de mudanças grandes", o conselho era
// ativamente errado. Ela segue arquivada e legível; o que não pode voltar é
// a instrução de consultá-la.
test('o CLAUDE.md não manda mais ler a análise de codebase da era de dois módulos', () => {
  const claude = fs.readFileSync(path.join(RAIZ, 'CLAUDE.md'), 'utf8')
  assert.doesNotMatch(
    claude,
    /lives in `\.planning\/codebase\/`|read those before large changes/,
    'o ponteiro para .planning/codebase/ descrevia um projeto de dois módulos'
  )
})
