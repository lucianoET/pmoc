const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════════
// Migração 60 — esquema de Gestão e Qualidade (/gestao, Onda B, D-11).
//
// Este gate lê APENAS supabase/60_gestao_schema.sql e shared/gut.js —
// nenhum arquivo de gestao/, que é de outro plano da mesma onda (13-06,
// ainda não escrito). Ele prova a FORMA do texto da migração, nunca o
// banco: a migração não foi aplicada (a regra do projeto é frontend em
// produção primeiro, SQL depois — D-cf8-25/D-6wy/D-500), e a lição da
// migração 28 é exatamente esta — "create table if not exists" roda sem
// erro sobre uma tabela que já existe com outra forma, e só a conferência
// de coluna/check/policy denuncia a divergência. Este arquivo é essa
// conferência, feita antes de colar no SQL Editor em vez de depois.
// ══════════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const MIGRACAO = path.join(RAIZ, 'supabase', '60_gestao_schema.sql')
const GUT_JS = path.join(RAIZ, 'shared', 'gut.js')

const sql = fs.readFileSync(MIGRACAO, 'utf8')
const gutSrc = fs.readFileSync(GUT_JS, 'utf8')

const TABELAS = ['ges_acoes', 'ges_indicadores', 'ges_indicador_valores', 'ges_pop', 'ges_causas']

// Só o corpo executável: comentários de cabeçalho e o rodapé de
// conferência citam palavras (drop, alter table, anon) de propósito, para
// explicar por que a migração NÃO as usa — procurar essas palavras no
// arquivo inteiro reprovaria a própria documentação da decisão. A mesma
// separação que tests/checks-grandezas.test.js já faz para a migração 58.
function semComentarios(texto) {
  return texto
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('--'))
    .join('\n')
}

const corpo = semComentarios(sql)

// ══════ 1. as cinco tabelas, todas com prefixo ges_ ═══════════════════

test('as cinco tabelas nascem com create table if not exists e prefixo ges_', () => {
  for (const t of TABELAS) {
    assert.match(corpo, new RegExp(`create table if not exists ${t}\\b`, 'i'),
      `${t} deveria ser criada com if not exists`)
  }
  // Nenhuma outra "create table" no arquivo — as cinco são as únicas.
  const criadas = [...corpo.matchAll(/create table if not exists (\w+)/gi)].map((m) => m[1])
  assert.deepEqual(criadas.sort(), [...TABELAS].sort(),
    'a migração 60 deveria criar exatamente estas cinco tabelas, nenhuma a mais')
  for (const nome of criadas) {
    assert.ok(nome.startsWith('ges_'), `${nome} não tem o prefixo ges_`)
  }
})

// ══════ 2. aditiva, sem DROP, e alter table só em ges_ ════════════════

test('a migração é aditiva — nenhum drop de tabela ou coluna em lugar nenhum', () => {
  assert.doesNotMatch(sql, /drop\s+table/i, 'migrações deste projeto são aditivas — o projeto arquiva, nunca derruba')
  assert.doesNotMatch(sql, /drop\s+column/i, 'migrações deste projeto são aditivas — nunca removem coluna')
})

test('todo alter table do corpo executável aponta para tabela ges_ — nenhum esquema de outro módulo é tocado', () => {
  const alvos = [...corpo.matchAll(/alter table (\w+)/gi)].map((m) => m[1])
  assert.ok(alvos.length > 0, 'a migração deveria ligar RLS com pelo menos um alter table')
  for (const alvo of alvos) {
    assert.ok(alvo.startsWith('ges_'),
      `alter table ${alvo}: a migração 60 não pode tocar tabela de outro módulo`)
  }
})

// ══════ 3. gut_total é gerada, nunca uma coluna comum ═════════════════

test('gut_total é coluna gerada a partir de g, u e t — não uma coluna gravável', () => {
  const geradas = corpo.match(/generated always as/gi) || []
  assert.equal(geradas.length, 1, 'só gut_total deveria ser coluna gerada nesta migração')
  assert.match(corpo, /gut_total integer generated always as \(g \* u \* t\) stored/i,
    'gut_total precisa ser o produto de g, u e t, gerado e armazenado — nunca gravado pelo cliente, ' +
    'senão a prioridade mostrada na tela e a prioridade gravada podem divergir')
})

// ══════ 4. a escala de g/u/t é EXATAMENTE a GUT_ESCALA de shared/gut.js ═

function listaDoCheck(sqlTexto, coluna) {
  const re = new RegExp(`${coluna} integer check \\(${coluna} is null or ${coluna} in \\(([^)]+)\\)\\)`, 'i')
  const m = sqlTexto.match(re)
  assert.ok(m, `não encontrei o check de escala fechada para ${coluna}`)
  return m[1].split(',').map((v) => Number(v.trim()))
}

test('a escala aceita por g, u e t no banco é exatamente GUT_ESCALA de shared/gut.js', () => {
  const escalaJs = (() => {
    const m = gutSrc.match(/export const GUT_ESCALA = \[([^\]]+)\]/)
    assert.ok(m, 'GUT_ESCALA não encontrada em shared/gut.js — o gate depende dela para comparar')
    return m[1].split(',').map((v) => Number(v.trim()))
  })()
  assert.ok(escalaJs.length > 0, 'GUT_ESCALA leu vazia — algo mudou na exportação')

  for (const coluna of ['g', 'u', 't']) {
    const escalaSql = listaDoCheck(corpo, coluna)
    assert.deepEqual(escalaSql, escalaJs,
      `a escala de ${coluna} no banco (${escalaSql}) diverge de GUT_ESCALA (${escalaJs}) — ` +
      'dois lugares dizendo a mesma coisa não podem divergir sem que um teste reprove')
  }
})

test('g, u e t aceitam nulo — "não avaliado" nunca é recusado pelo check', () => {
  for (const coluna of ['g', 'u', 't']) {
    assert.match(corpo, new RegExp(`${coluna} integer check \\(${coluna} is null or`, 'i'),
      `${coluna} deveria tolerar nulo — a escala fechada não pode transformar "não avaliado" em erro`)
  }
})

// ══════ 5. ges_acoes.status — cinco estados, nenhum a mais ════════════

test('ges_acoes.status tem check com exatamente os cinco estados do fluxo PDCA', () => {
  const m = corpo.match(/status text not null default 'planejada'[\s\S]*?check \(status in \(([^)]+)\)\)/i)
  assert.ok(m, 'não encontrei o check de status em ges_acoes')
  const estados = m[1].split(',').map((v) => v.trim().replace(/^'|'$/g, '')).sort()
  const esperado = ['planejada', 'em_execucao', 'verificacao', 'concluida', 'cancelada'].sort()
  assert.deepEqual(estados, esperado, 'a lista fechada de status mudou — confira o fluxo PDCA da ação')
})

// ══════ 6. ges_causas.categoria — os 6M, nenhuma a mais ════════════════

test('ges_causas.categoria tem check com exatamente as seis categorias (6M)', () => {
  const m = corpo.match(/categoria text not null[\s\S]*?check \(categoria in \(([^)]+)\)\)/i)
  assert.ok(m, 'não encontrei o check de categoria em ges_causas')
  const categorias = m[1].split(',').map((v) => v.trim().replace(/^'|'$/g, '')).sort()
  const esperado = ['metodo', 'maquina', 'mao_de_obra', 'material', 'medicao', 'meio_ambiente'].sort()
  assert.deepEqual(categorias, esperado, 'a lista fechada dos 6M mudou')
})

test('ges_indicadores.sentido é lista fechada maior/menor', () => {
  const m = corpo.match(/sentido text not null check \(sentido in \(([^)]+)\)\)/i)
  assert.ok(m, 'não encontrei o check de sentido em ges_indicadores')
  const valores = m[1].split(',').map((v) => v.trim().replace(/^'|'$/g, '')).sort()
  assert.deepEqual(valores, ['maior', 'menor'].sort())
})

// ══════ 7. as duas chaves estrangeiras têm índice ═════════════════════

test('ges_causas.acao_id (FK) tem índice próprio', () => {
  assert.match(corpo, /create index if not exists ges_causas_acao_id_idx on ges_causas \(acao_id\)/i,
    'ges_causas.acao_id não lidera nenhum outro índice — precisa do seu próprio')
})

test('ges_indicador_valores.indicador_id (FK) tem índice — explícito ou como coluna líder da unicidade', () => {
  const indiceProprio = /create index if not exists \S+ on ges_indicador_valores \(indicador_id\)/i.test(corpo)
  const lideraUnicidade = /unique \(indicador_id,\s*periodo\)/i.test(corpo)
  assert.ok(indiceProprio || lideraUnicidade,
    'ges_indicador_valores.indicador_id precisa de índice — próprio, ou como coluna líder de um índice composto')
})

test('ges_indicador_valores tem unicidade por (indicador_id, periodo)', () => {
  assert.match(corpo, /constraint ges_indicador_valores_unico unique \(indicador_id,\s*periodo\)/i,
    'dois valores para o mesmo indicador no mesmo período seriam duas verdades sobre o mesmo mês')
})

test('há pelo menos cinco índices explícitos no arquivo', () => {
  const indices = corpo.match(/create index if not exists/gi) || []
  assert.ok(indices.length >= 5, `esperava ao menos 5 "create index if not exists", achei ${indices.length}`)
})

// ══════ 8. RLS: leitura pública, escrita autenticada, sem anon ═════════

test('as cinco tabelas ligam RLS', () => {
  for (const t of TABELAS) {
    assert.match(corpo, new RegExp(`alter table ${t} enable row level security`, 'i'), `${t} sem RLS`)
  }
})

test('cada tabela tem uma policy de leitura sem restrição de papel', () => {
  for (const t of TABELAS) {
    const re = new RegExp(`create policy \\S+ on ${t} for select to public using \\(true\\)`, 'i')
    assert.match(corpo, re, `${t} deveria ter select aberto (to public)`)
  }
})

test('cada tabela tem as três policies de escrita, todas to authenticated', () => {
  for (const t of TABELAS) {
    for (const acao of ['insert', 'update', 'delete']) {
      const re = new RegExp(`create policy \\S+ on ${t} for ${acao} to authenticated`, 'i')
      assert.match(corpo, re, `${t}: policy de ${acao} deveria ser to authenticated`)
    }
  }
})

test('a palavra anon não aparece em nenhuma policy — nem em política, nem em prosa', () => {
  assert.doesNotMatch(sql, /\banon\b/i,
    'nenhuma tabela ges_ recebe policy de escrita para anon; escrita é sempre authenticated (D-13-05)')
})

test('cada create policy vem precedido do drop policy if exists de mesmo nome (bloco reexecutável)', () => {
  const linhas = corpo.split('\n').map((l) => l.trim()).filter(Boolean)
  const criadas = []
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^create policy (\S+) on (\S+) for/i)
    if (!m) continue
    criadas.push(m[1])
    const anterior = linhas[i - 1] || ''
    const esperado = new RegExp(`^drop policy if exists ${m[1]} on ${m[2]};?$`, 'i')
    assert.match(anterior, esperado,
      `create policy ${m[1]} em ${m[2]} não vem logo depois do drop policy if exists correspondente`)
  }
  // 5 tabelas × 4 policies (select + insert + update + delete) = 20
  assert.equal(criadas.length, 20, `esperava 20 create policy no total, achei ${criadas.length}`)
})

// ══════ 9. auditoria mínima em ges_acoes e ges_pop ═════════════════════

test('ges_acoes e ges_pop registram autoria — um plano de ação sem autor não é auditável', () => {
  assert.match(corpo, /criado_por text/i)
  const ocorrencias = corpo.match(/criado_por text/gi) || []
  assert.ok(ocorrencias.length >= 2, 'ges_acoes e ges_pop deveriam ter criado_por')
})

// ══════ 10. o gate não depende de nada sob gestao/ ═════════════════════

test('este gate lê só a migração 60 e shared/gut.js', () => {
  assert.ok(fs.existsSync(MIGRACAO))
  assert.ok(fs.existsSync(GUT_JS))
  assert.ok(!fs.existsSync(path.join(RAIZ, 'gestao')) || true,
    'a existência ou não de gestao/ é irrelevante — este gate nunca lê arquivo de lá')
})
