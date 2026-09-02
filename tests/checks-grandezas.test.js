const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════════
// Migração 58 — segunda camada da varredura de colunas numéricas sem check.
//
// A varredura de 02/09/2026 achou 77 colunas numéricas sem `check` no banco
// inteiro. As migrações 56 e 57 fecharam as dez de `equipamentos`, urgentes
// porque estavam na planilha que foi a campo. A 58 fecha o que é digitado em
// formulário, um valor por vez, nos outros módulos.
//
// Este gate protege DUAS coisas, e a segunda é a que costuma se perder:
//
//   1. que as 27 constraints continuem lá, sobre tabela e coluna que existem
//      de verdade — um nome de coluna com erro de digitação não falha na
//      leitura do arquivo, falha no `apply_migration`, longe daqui;
//
//   2. que as QUATRO colunas deixadas de fora continuem de fora. Isso é
//      decisão, não esquecimento, e a regra do projeto desde a Fase 10 é que
//      "a exclusão deve virar teste, não omissão" (D-01) — comentário não
//      falha sozinho quando alguém o contraria seis meses depois.
//
// A tentação de "completar" a migração pondo `>= 0` nas quatro é real e
// custaria caro: pressão de sucção NEGATIVA é vácuo, e evacuar o sistema é
// procedimento normal de carga. O check recusaria a leitura mais rotineira do
// serviço, com erro de banco, na cara do técnico, no meio da OS.
// ══════════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const SQL_DIR = path.join(RAIZ, 'supabase')
const MIGRACAO = path.join(SQL_DIR, '58_grandezas_fisicas_checks.sql')
const sql = fs.readFileSync(MIGRACAO, 'utf8')

// O corpo EXECUTÁVEL, não o arquivo: as quatro colunas de fora aparecem no
// comentário de rodapé de propósito, explicando por que ficaram de fora.
// Procurá-las no arquivo inteiro reprovaria justamente a documentação da
// decisão que este gate existe para proteger.
const corpoExecutavel = (() => {
  const ini = sql.indexOf('do $$')
  const fim = sql.indexOf('end $$;')
  assert.ok(ini > -1 && fim > ini, 'a migração 58 perdeu seu bloco do $$ … end $$')
  return sql.slice(ini, fim)
})()

// Cada linha `alter table X add constraint Y check (Z is null or …)`.
const DECLARACOES = (() => {
  const re = /alter table ([a-z_]+) add constraint ([a-z_]+)\s*\n?\s*check \(([a-z_]+) ([\s\S]*?)\);/g
  const out = []
  let m
  while ((m = re.exec(corpoExecutavel))) {
    out.push({ tabela: m[1], constraint: m[2], coluna: m[3], corpo: m[4] })
  }
  return out
})()

// ── mapa tabela → colunas, lido dos próprios arquivos de schema ──────────
// Sem banco no teste, esta é a única forma de pegar um nome de coluna errado
// antes do `apply_migration`. O fatiamento respeita parênteses porque um
// `check (tipo in ('entrada','saida'))` na definição da coluna tem vírgula
// dentro.
function fatiarPorVirgulaNoNivelZero(corpo) {
  const partes = []
  let nivel = 0
  let atual = ''
  for (const ch of corpo) {
    if (ch === '(') nivel++
    if (ch === ')') nivel--
    if (ch === ',' && nivel === 0) { partes.push(atual); atual = ''; continue }
    atual += ch
  }
  partes.push(atual)
  return partes
}

const TIPOS = 'integer|numeric|text|date|boolean|uuid|jsonb|serial|timestamptz|bigint|real|double|smallint|time'

const COLUNAS_POR_TABELA = (() => {
  const mapa = {}
  for (const arquivo of fs.readdirSync(SQL_DIR).sort()) {
    if (!arquivo.endsWith('.sql')) continue
    const texto = fs.readFileSync(path.join(SQL_DIR, arquivo), 'utf8').replace(/^\s*--.*$/gm, '')
    let m
    const reCreate = /create table (?:if not exists )?([a-z_]+)\s*\(([\s\S]*?)\n\);/g
    while ((m = reCreate.exec(texto))) {
      const tabela = m[1]
      mapa[tabela] = mapa[tabela] || new Set()
      fatiarPorVirgulaNoNivelZero(m[2]).forEach((parte) => {
        const c = parte.trim().match(new RegExp('^([a-z_]+)\\s+(?:' + TIPOS + ')'))
        if (c) mapa[tabela].add(c[1])
      })
    }
    const reAlter = /alter table (?:only )?([a-z_]+)([\s\S]*?);/g
    while ((m = reAlter.exec(texto))) {
      const tabela = m[1]
      let c
      const reCol = /add column (?:if not exists )?([a-z_]+)/g
      while ((c = reCol.exec(m[2]))) {
        mapa[tabela] = mapa[tabela] || new Set()
        mapa[tabela].add(c[1])
      }
    }
  }
  return mapa
})()

// ══════ 1. o que a migração declara ═══════════════════════════════════

test('a migração 58 declara as 28 constraints da segunda camada', () => {
  assert.equal(DECLARACOES.length, 28,
    'a segunda camada da varredura são 28 constraints em 11 tabelas; ' +
    'se o número mudou, o CLAUDE.md e o cabeçalho da migração precisam mudar junto')
})

test('cada constraint aponta para uma tabela e uma coluna que existem no schema', () => {
  for (const d of DECLARACOES) {
    const colunas = COLUNAS_POR_TABELA[d.tabela]
    assert.ok(colunas, `${d.constraint}: a tabela ${d.tabela} não é criada em nenhum arquivo de supabase/`)
    assert.ok(colunas.has(d.coluna),
      `${d.constraint}: ${d.tabela}.${d.coluna} não existe no schema — ` +
      'um nome errado aqui só falha no apply_migration, longe deste teste')
  }
})

test('nenhuma coluna recebe duas constraints — uma delas seria letra morta', () => {
  const vistas = new Set()
  for (const d of DECLARACOES) {
    const chave = d.tabela + '.' + d.coluna
    assert.equal(vistas.has(chave), false, `${chave} aparece duas vezes na migração 58`)
    vistas.add(chave)
  }
})

// ══════ 2. a forma exigida de toda migração deste projeto ═════════════

test('a migração é aditiva: nenhum drop, e toda constraint atrás de if not exists', () => {
  assert.doesNotMatch(sql, /\bdrop\b/i,
    'migrações deste projeto são aditivas — o projeto arquiva, nunca derruba')
  const guardas = corpoExecutavel.match(/if not exists \(select 1 from pg_constraint/g) || []
  assert.equal(guardas.length, DECLARACOES.length,
    'toda constraint precisa da própria guarda: rodar a migração duas vezes tem de ser inofensivo')
})

test('todo check tolera null — a coluna vazia nunca é o erro', () => {
  for (const d of DECLARACOES) {
    assert.match(d.corpo, /^is null or/,
      `${d.constraint} não abre com "is null or": as colunas desta migração são opcionais, ` +
      'e um check que exigisse valor transformaria "ainda não medido" em erro de gravação')
  }
})

// ══════ 3. os limites que são decisão de DADO, não de gosto ═══════════

test('vida útil e intervalo exigem > 0 — zero divide a conta por zero', () => {
  const estritas = { maq_ativos_vida_util_check: 'vida_util_h', maq_planos_intervalo_check: 'intervalo' }
  for (const nome of Object.keys(estritas)) {
    const d = DECLARACOES.find((x) => x.constraint === nome)
    assert.ok(d, `${nome} sumiu da migração 58`)
    assert.match(d.corpo, new RegExp(estritas[nome] + ' > 0'),
      `${nome}: com zero, a depreciação divide por zero e o plano vence a cada leitura, para sempre`)
  }
})

test('quantidade de movimento exige > 0 — o sinal mora em `tipo`, nunca no número', () => {
  for (const nome of ['maq_estoque_mov_qtd_check', 'maq_plano_mat_qtd_check']) {
    const d = DECLARACOES.find((x) => x.constraint === nome)
    assert.ok(d, `${nome} sumiu da migração 58`)
    assert.match(d.corpo, /quantidade > 0/,
      `${nome}: quantidade negativa inverteria o sentido do movimento sem que ` +
      '`tipo` (entrada/saida) soubesse, e a idempotência da baixa lê `tipo`')
  }
})

test('delta de horímetro aceita zero, e isso é diferente de aceitar negativo', () => {
  const d = DECLARACOES.find((x) => x.constraint === 'maq_uso_delta_check')
  assert.ok(d, 'maq_uso_delta_check sumiu da migração 58')
  assert.match(d.corpo, /delta >= 0/,
    'a dívida de segurança herdada manda recusar delta NEGATIVO, que é o risco real; ' +
    'um registro de delta zero ("nenhum uso desde a última leitura") é plausível e não é erro')
})

// ══════ 4. a decisão de exclusão, que é o que este gate mais protege ══

const FORA = ['temp_insuflamento', 'temp_retorno', 'delta_t', 'pressao_succao']

test('as quatro colunas sem limite derivável continuam sem check', () => {
  for (const coluna of FORA) {
    assert.equal(
      DECLARACOES.some((d) => d.coluna === coluna), false,
      `logs_manutencao.${coluna} ganhou check na migração 58.\n` +
      'Um check errado é PIOR que check nenhum: o dado ruim que ele deixa passar continua ' +
      'passando, e o dado bom que ele recusa vira erro de banco no meio da OS.\n' +
      '  pressao_succao  — manométrica negativa é VÁCUO, e evacuar o sistema é procedimento\n' +
      '                    normal de carga; um piso em zero recusaria a leitura mais rotineira.\n' +
      '  temp_*          — as oito colunas de medição estão nulas nas 8 OS, então não há de\n' +
      '                    onde derivar piso; e o parque tem câmara refrigerada (PAIOL), onde\n' +
      '                    ar insuflado abaixo de zero não é improvável.\n' +
      '  delta_t         — o sinal depende da convenção de subtração, que não está escrita.\n' +
      'Se um limite for adicionado, ele tem de vir de leitura real acumulada.'
    )
  }
})

test('as quatro existem no schema — ficaram de fora por decisão, não por não existirem', () => {
  const colunas = COLUNAS_POR_TABELA['logs_manutencao']
  assert.ok(colunas, 'logs_manutencao não foi encontrada nos arquivos de schema')
  for (const coluna of FORA) {
    assert.ok(colunas.has(coluna),
      `logs_manutencao.${coluna} não existe no schema — então a lista deste gate está velha, ` +
      'e ele estaria protegendo a ausência de uma coluna que ninguém pode criar')
  }
})

test('a migração explica por escrito por que as quatro ficaram de fora', () => {
  for (const coluna of FORA) {
    assert.ok(sql.includes(coluna),
      `a migração 58 não menciona ${coluna}: uma exclusão sem motivo escrito é indistinguível ` +
      'de esquecimento, e o próximo a ler vai "completar" a migração')
  }
  assert.match(sql, /v[áa]cuo/i, 'o motivo de pressao_succao ficar de fora é o vácuo na evacuação')
})

// ══════ 5. o que só EXERCITAR a trava mostrou ═════════════════════════
//
// `os_itens.total` é coluna GERADA — `quantidade * coalesce(valor_unitario,0)`
// — e a primeira versão desta migração pôs check nela como se fosse gravável.
// Nada no arquivo denunciava isso; quem denunciou foi o Postgres, ao recusar
// o update da camada (b) com "column total can only be updated to DEFAULT".
// É a lição da migração 28 outra vez: ler o texto do check diz o que foi
// escrito, não o que o banco faz com ele.
//
// A coluna que precisava de barreira era `quantidade`, e ali — ao contrário
// de todo o resto desta migração — a regra JÁ existia na tela.

test('os_itens.quantidade tem check, e é > 0 como a tela já exigia', () => {
  const d = DECLARACOES.find((x) => x.constraint === 'os_itens_quantidade_check')
  assert.ok(d, 'sem esta constraint, a única coluna gravável de os_itens fica sem barreira — ' +
    '`total` é gerada e não aceita escrita, então o check dela nunca é atingido por um writer')
  assert.match(d.corpo, /quantidade > 0/,
    'osAddItemUI recusa `qtd<=0` com "Preencha descrição, qtd e valor"; o banco diz o mesmo')
})

// Este caso nasceu cego e foi corrigido antes de entrar: procurava `qtd<=0`
// no arquivo inteiro, e passou verde com a guarda de `osAddItemUI` afrouxada
// — porque `osAddComp`, outra função, tem a MESMA linha. Procurar o texto
// certo no lugar errado é a cegueira que tests/mapa-editor.test.js já pagou
// ao varrer `.from('...')` depois que os nomes mudaram de arquivo. Agora o
// corpo da função é recortado antes de procurar dentro dele.
test('osAddItemUI continua recusando quantidade zero — o banco espelha a tela, não a contradiz', () => {
  const app = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8')
  const ini = app.indexOf('async function osAddItemUI(')
  assert.ok(ini > -1, 'osAddItemUI sumiu — é ela que escreve os_itens pela tela')
  const corpo = app.slice(ini, app.indexOf('\nasync function', ini + 10))
  assert.match(corpo, /qtd\s*<=\s*0/,
    'se osAddItemUI passar a aceitar quantidade zero, o check `> 0` da migração 58 vira erro ' +
    'de banco na cara do usuário — os dois lados mudam juntos ou não mudam')
})

test('a migração registra que `total` é coluna gerada', () => {
  assert.match(sql, /GERADA|generated|gerada/,
    'um check sobre coluna gerada é avaliado no valor computado e, com quantidade > 0 e ' +
    'valor_unitario >= 0, nunca pode disparar; sem o registro, o próximo leitor procura um ' +
    'caminho de escrita que não existe')
  assert.match(sql, /quantidade \* coalesce\(valor_unitario/,
    'a expressão de geração escrita por extenso é o que prova a redundância do check de `total`')
})
