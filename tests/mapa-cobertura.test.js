const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate da quick-260818-vxu — cobertura e posicionamento do mapa.
//
// Divisão com os gates de mapa que já existem, para nenhum caso ficar em
// dois arquivos:
//   - tests/mapa-camadas.test.js: porta única de dados, grama e elétrica.
//   - tests/mapa-editor.test.js: cargo de zona, inventário de tabelas.
//   - tests/mapa-posicionamento.test.js: tudo sobre salvarPosicaoAtivo.
//   - AQUI: as três famílias novas, a SEGUNDA porta de posição
//     (salvarPosicaoLocal, a camada herdada), o vocabulário de estado do
//     núcleo puro e o que a tela promete sobre os dois.
//
// O vocabulário de estado é testado por COMPORTAMENTO, importando o
// núcleo puro dentro do node — não por expressão regular sobre o texto do
// arquivo. É a mesma escolha que tests/mapa-geometria.test.js já fez: a
// pergunta "OK vira operante?" tem resposta executável, e uma expressão
// regular só provaria que a letra está escrita em algum lugar.
// ══════════════════════════════════════════════════════════════════

const RAIZ = path.join(__dirname, '..')
const MAPA = path.join(RAIZ, 'mapa')
const DADOS = path.join(MAPA, 'mapa-dados.js')
const APP = path.join(MAPA, 'app.js')
const EDITOR = path.join(MAPA, 'mapa-editor.js')
const ATIVOS = path.join(MAPA, 'xmap-layers-ativos.js')
const INDEX_HTML = path.join(MAPA, 'index.html')
const GEOMETRIA = path.join(MAPA, 'mapa-geometria.js')

// As cinco famílias de ativo que o mapa cobre depois desta task, com a
// tabela de cada uma. `climatizacao` aponta para `equipamentos` de
// propósito: a chave NÃO se chama refrigeracao porque o app de
// Refrigeração está congelado e seu caminho não pode ser citado em
// mapa/index.html (PLAT-15, tests/mobile-375.test.js) — o mapa lê a
// tabela, não o app.
const MODULOS_ESPERADOS = {
  maquinas: 'maq_ativos',
  eletrica: 'elet_ativos',
  transportes: 'transp_ativos',
  fonoclama: 'fono_ativos',
  climatizacao: 'equipamentos',
}

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8')
}

// Mesma técnica de tests/mapa-posicionamento.test.js: recorta da
// declaração até o `\n}` de coluna zero que fecha a função.
function corpoDaFuncao(conteudo, nomeFuncao) {
  const inicio = conteudo.indexOf(`function ${nomeFuncao}`)
  if (inicio < 0) return null
  const fechamento = conteudo.indexOf('\n}', inicio)
  return conteudo.slice(inicio, fechamento < 0 ? undefined : fechamento)
}

// Recorta o bloco de configuração de um módulo dentro de
// CONFIG_POR_MODULO, da chave até a linha que fecha o objeto dele.
function blocoDoModulo(conteudo, modulo) {
  const inicio = conteudo.indexOf(`\n  ${modulo}: {`)
  if (inicio < 0) return null
  const fim = conteudo.indexOf('\n  },', inicio)
  return conteudo.slice(inicio, fim < 0 ? undefined : fim)
}

// ── 1. as cinco famílias estão na lista fechada, com a tabela certa ─────
test('CONFIG_POR_MODULO cobre as cinco famílias de ativo, cada uma com a sua tabela', async () => {
  const dados = ler(DADOS)
  for (const [modulo, tabela] of Object.entries(MODULOS_ESPERADOS)) {
    const bloco = blocoDoModulo(dados, modulo)
    assert.ok(bloco, `módulo ${modulo} ausente de CONFIG_POR_MODULO`)
    assert.match(bloco, new RegExp(`tabela:\\s*'${tabela}'`), `${modulo} deveria apontar para ${tabela}`)
  }
  const { MODULOS_DE_ATIVO } = await import('../mapa/mapa-dados.js')
  assert.deepEqual(
    [...MODULOS_DE_ATIVO].sort(),
    Object.keys(MODULOS_ESPERADOS).sort(),
    'MODULOS_DE_ATIVO divergiu das cinco famílias previstas'
  )
})

// ── 2. equipamentos é a exceção de forma, e só ela ──────────────────────
// O caso que justifica CONFIG_POR_MODULO existir. Se alguém "uniformizar"
// a configuração pondo colunaAtivo: 'ativo' em climatizacao, a consulta
// passa a filtrar por uma coluna que não existe e a camada volta vazia com
// erro do Postgres — falha silenciosa na tela, porque carregarAtivosDoModulo
// devolve lista vazia em caso de erro, de propósito.
test('só climatizacao (equipamentos) tem colunaAtivo nula — as outras quatro filtram por ativo', () => {
  const dados = ler(DADOS)
  for (const modulo of Object.keys(MODULOS_ESPERADOS)) {
    const bloco = blocoDoModulo(dados, modulo)
    if (modulo === 'climatizacao') {
      assert.match(bloco, /colunaAtivo:\s*null/, 'equipamentos não tem coluna `ativo` — o filtro precisa ficar nulo')
      assert.match(bloco, /colunaEstado:\s*'funciona'/, 'o estado de equipamentos está em `funciona`, não na coluna `estado` (que guarda a idade)')
    } else {
      assert.match(bloco, /colunaAtivo:\s*'ativo'/, `${modulo} deveria filtrar por ativo`)
    }
  }
})

// ── 3. o filtro de arquivamento é condicional, não incondicional ────────
test('carregarAtivosDoModulo só aplica .eq(colunaAtivo) quando a coluna existe', () => {
  const corpo = corpoDaFuncao(ler(DADOS), 'carregarAtivosDoModulo')
  assert.ok(corpo, 'carregarAtivosDoModulo não encontrada')
  assert.match(
    corpo,
    /if\s*\(config\.colunaAtivo\)/,
    'o filtro de arquivamento deveria ser condicional — equipamentos não tem a coluna'
  )
  assert.doesNotMatch(corpo, /\.eq\(\s*['"]ativo['"]/, 'sobrou o filtro fixo por `ativo` no corpo da consulta')
})

// ── 4. a segunda porta de posição: prédio ───────────────────────────────
// Mesmas três garantias que tests/mapa-posicionamento.test.js afirma sobre
// salvarPosicaoAtivo, agora sobre a outra camada. As duas funções juntas
// são as únicas escritas de coordenada do módulo, uma por tabela.
test('salvarPosicaoLocal valida a coordenada pelo núcleo puro antes de qualquer .update(', () => {
  const corpo = corpoDaFuncao(ler(DADOS), 'salvarPosicaoLocal')
  assert.ok(corpo, 'salvarPosicaoLocal não encontrada em mapa-dados.js')
  const posValidacao = corpo.indexOf('dentroDoEnvelope')
  const posUpdate = corpo.indexOf('.update(')
  assert.ok(posValidacao >= 0, 'salvarPosicaoLocal não chama dentroDoEnvelope')
  assert.ok(posUpdate >= 0, 'salvarPosicaoLocal não grava com .update(')
  assert.ok(posValidacao < posUpdate, 'a validação de envelope deveria vir ANTES da gravação')
  assert.match(corpo, /Number\.isSafeInteger\(id\)/, 'salvarPosicaoLocal não valida o identificador como inteiro estrito')
})

test('salvarPosicaoLocal grava lat e lon no mesmo .update( e não toca em nenhuma tabela de ativo', () => {
  const corpo = corpoDaFuncao(ler(DADOS), 'salvarPosicaoLocal')
  assert.ok(corpo, 'salvarPosicaoLocal não encontrada')
  const mUpdate = corpo.match(/\.update\(\s*\{([^}]*)\}/)
  assert.ok(mUpdate, 'salvarPosicaoLocal não chama .update({ ... })')
  assert.match(mUpdate[1], /\blat\b/, 'o objeto do .update( não inclui lat')
  assert.match(mUpdate[1], /\blon\b/, 'o objeto do .update( não inclui lon')
  assert.match(corpo, /\.from\(\s*'cmasm_locais'\s*\)/, 'salvarPosicaoLocal deveria gravar em cmasm_locais')
  for (const tabela of Object.values(MODULOS_ESPERADOS)) {
    assert.doesNotMatch(
      corpo,
      new RegExp(`\\b${tabela}\\b`),
      `salvarPosicaoLocal referencia ${tabela} — posicionar o prédio não pode escrever na tabela do ativo`
    )
  }
})

// ── 5. o desvio entre as duas portas mora no chamador ───────────────────
// Se o `if` migrar para dentro de uma das funções de gravação, ela vira
// uma função que decide sozinha em qual tabela escrever — exatamente o
// que a proibição de salvarPosicaoAtivo tocar cmasm_locais (D-03) existe
// para impedir.
test('o editor escolhe a porta de escrita pelo tipo do alvo, e as duas funções continuam com uma tabela cada', () => {
  const corpo = corpoDaFuncao(ler(EDITOR), 'aoClicarParaPosicionar')
  assert.ok(corpo, 'aoClicarParaPosicionar não encontrada em mapa-editor.js')
  assert.match(corpo, /alvo\.tipo === 'local'/, 'o desvio por tipo de alvo saiu do chamador')
  assert.match(corpo, /salvarPosicaoLocal\(/, 'o chamador não usa salvarPosicaoLocal')
  assert.match(corpo, /salvarPosicaoAtivo\(/, 'o chamador não usa salvarPosicaoAtivo')
})

// ── 6. zona sem contorno vira contorno da zona existente, não zona nova ──
test('aoCriarPoligono desvia para o modo de edição quando uma zona sem contorno está armada', () => {
  const editor = ler(EDITOR)
  const corpo = corpoDaFuncao(editor, 'aoCriarPoligono')
  assert.ok(corpo, 'aoCriarPoligono não encontrada')
  const posAlvo = corpo.indexOf('_zonaAlvo')
  const posCriacao = corpo.indexOf('abrirPainelCriacao')
  assert.ok(posAlvo >= 0, 'aoCriarPoligono não consulta a zona armada')
  assert.ok(posCriacao >= 0, 'aoCriarPoligono não abre mais o painel de criação')
  assert.ok(posAlvo < posCriacao, 'a zona armada precisa ser conferida ANTES de cair na criação de zona nova')
  assert.match(corpo, /abrirPainelEdicao\(/, 'a zona armada deveria abrir o painel em modo de edição (atualizarZona)')
  assert.match(editor, /window\.edDesenharZona\s*=/, 'edDesenharZona não é publicada')
})

// ── 7. vocabulário de estado: comportamento, não expressão regular ──────
test('normalizarEstado traduz o vocabulário real de cada tabela para a lista fechada', async () => {
  const { normalizarEstado, ESTADOS, corDoEstado, COR_ESTADO_DESCONHECIDO } = await import('../mapa/mapa-geometria.js')
  // Os valores conferidos no banco de produção em 18/08/2026.
  assert.equal(normalizarEstado('maquinas', 'operante'), 'operante')
  assert.equal(normalizarEstado('eletrica', 'inoperante'), 'inoperante')
  assert.equal(normalizarEstado('fonoclama', 'operante'), 'operante')
  assert.equal(normalizarEstado('transportes', 'disponivel'), 'operante')
  assert.equal(normalizarEstado('transportes', 'indisponivel'), 'inoperante')
  assert.equal(normalizarEstado('climatizacao', 'OK'), 'operante')
  assert.equal(normalizarEstado('climatizacao', 'NOK'), 'inoperante')
  // Toda tradução tem que cair DENTRO da lista fechada.
  for (const modulo of Object.keys(MODULOS_ESPERADOS)) {
    for (const bruto of ['operante', 'disponivel', 'OK', 'NOK', 'manutencao']) {
      const estado = normalizarEstado(modulo, bruto)
      if (estado !== null) assert.ok(ESTADOS[estado], `${modulo}/${bruto} produziu estado fora de ESTADOS: ${estado}`)
    }
  }
  assert.equal(corDoEstado(null), COR_ESTADO_DESCONHECIDO)
  assert.notEqual(
    corDoEstado('valor-que-nao-existe'),
    ESTADOS.operante.cor,
    'estado desconhecido não pode ser pintado como operante — passaria por máquina boa na tela'
  )
})

// ── 7b. climatizacao (260821-q57): cinco valores, não dois ──────────────
// A migração 41 amplia equipamentos.funciona de OK/NOK para OP/INOP/OR
// (D-q57-01), e ESTADO_POR_MODULO.climatizacao guarda os CINCO valores de
// propósito (D-q57-15) — as duas entradas antigas não somem no dia em que
// o frontend publica, só quando alguém confirmar que o banco não tem mais
// linha nenhuma em OK/NOK.
test('normalizarEstado(climatizacao, …) entende os cinco valores — os dois do legado e os três da migração 41', async () => {
  const { normalizarEstado } = await import('../mapa/mapa-geometria.js')
  assert.equal(normalizarEstado('climatizacao', 'OK'), 'operante')
  assert.equal(normalizarEstado('climatizacao', 'NOK'), 'inoperante')
  assert.equal(normalizarEstado('climatizacao', 'OP'), 'operante')
  assert.equal(normalizarEstado('climatizacao', 'INOP'), 'inoperante')
  assert.equal(normalizarEstado('climatizacao', 'OR'), 'restricao')
  assert.equal(normalizarEstado('climatizacao', 'inventado'), null)
})

test('ESTADOS.restricao existe, com rótulo não vazio e cor distinta das outras cinco', async () => {
  const { ESTADOS } = await import('../mapa/mapa-geometria.js')
  assert.ok(ESTADOS.restricao, 'ESTADOS.restricao não existe')
  assert.ok(ESTADOS.restricao.rotulo && ESTADOS.restricao.rotulo.length > 0, 'rótulo de restricao vazio')
  const cores = Object.entries(ESTADOS).filter(([k]) => k !== 'restricao').map(([, v]) => v.cor)
  assert.ok(!cores.includes(ESTADOS.restricao.cor), 'a cor de restricao colide com a de outro estado')
})

test('corDoEstado(restricao) não é a cor de desconhecido nem a de operante; classeDoEstado(restricao) não é vazia', async () => {
  const { corDoEstado, classeDoEstado, ESTADOS, COR_ESTADO_DESCONHECIDO } = await import('../mapa/mapa-geometria.js')
  assert.notEqual(corDoEstado('restricao'), COR_ESTADO_DESCONHECIDO)
  assert.notEqual(corDoEstado('restricao'), ESTADOS.operante.cor)
  assert.ok(classeDoEstado('restricao'), 'classeDoEstado(restricao) deveria devolver classe não vazia')
})

test('sobreaviso (transp_ativos) tem estado próprio — não é dobrado em operante nem em manutenção', async () => {
  const { normalizarEstado } = await import('../mapa/mapa-geometria.js')
  const estado = normalizarEstado('transportes', 'sobreaviso')
  assert.equal(estado, 'standby')
  assert.notEqual(estado, 'operante')
  assert.notEqual(estado, 'manutencao')
})

test('valor fora do vocabulário, herdado do protótipo ou de módulo desconhecido devolve nulo', async () => {
  const { normalizarEstado } = await import('../mapa/mapa-geometria.js')
  assert.equal(normalizarEstado('maquinas', 'inventado'), null)
  assert.equal(normalizarEstado('maquinas', '__proto__'), null)
  assert.equal(normalizarEstado('maquinas', 'constructor'), null)
  assert.equal(normalizarEstado('modulo-que-nao-existe', 'operante'), null)
  assert.equal(normalizarEstado('maquinas', undefined), null)
})

// ── 8. a ponte de vocabulário não voltou a ser duplicada nas camadas ─────
test('nenhuma camada reimplanta a tradução de estado nem a paleta — as duas vêm do núcleo puro', () => {
  for (const nome of fs.readdirSync(MAPA).filter((n) => n.startsWith('xmap-layers-') && n.endsWith('.js'))) {
    // A aguada fica de fora: é o módulo de demonstração (D-01), sem tabela
    // no projeto e sem vocabulário de estado de banco para traduzir.
    if (nome.includes('aguada')) continue
    const conteudo = ler(path.join(MAPA, nome))
    assert.doesNotMatch(conteudo, /function\s+(estadoColor|estadoClass|estadoParaExibicao|statusParaExibicao|statusClass)\b/, `${nome} voltou a declarar a ponte/paleta de estado localmente`)
    // Prédio não tem estado operacional (quick-260819-0g3): a camada de
    // contorno desenha edificação, não ativo. Exigir corDoEstado dela
    // criaria cor de estado onde não existe estado, e a legenda passaria
    // a prometer uma leitura que o polígono não tem. O que ela não pode é
    // inventar a paleta por fora — por isso a asserção aqui é a inversa,
    // não uma dispensa.
    if (nome.includes('predios')) {
      assert.doesNotMatch(conteudo, /ESTADOS|corDoEstado|rotuloDoEstado|classeDoEstado/, `${nome} não deveria falar de estado — prédio não tem estado operacional`)
      continue
    }
    assert.match(conteudo, /corDoEstado/, `${nome} não usa corDoEstado do núcleo puro`)
  }
})

// ── 9. a tela promete o que o módulo cobre ──────────────────────────────
test('mapa/index.html tem um botão por família de ativo e os contêineres das listas novas', () => {
  const html = ler(INDEX_HTML)
  for (const chave of ['grama', 'eletrica', 'transportes', 'fonoclama', 'climatizacao']) {
    assert.match(html, new RegExp(`data-mod="${chave}"`), `falta o botão de módulo ${chave}`)
  }
  for (const id of ['busca-ativo', 'busca-resultados', 'locais-sem-posicao', 'zonas-sem-contorno', 'legenda-estados', 'busca-local']) {
    assert.match(html, new RegExp(`id="${id}"`), `mapa/index.html não tem o contêiner id="${id}"`)
  }
})

test('o mapa não abre mais vazio — as camadas de dado real entram ligadas e a aguada (demonstração) não', () => {
  const app = ler(APP)
  const m = app.match(/const MODULOS_INICIAIS = \[([^\]]*)\]/)
  assert.ok(m, 'MODULOS_INICIAIS não encontrada em mapa/app.js')
  const iniciais = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
  assert.deepEqual(
    iniciais.sort(),
    ['climatizacao', 'eletrica', 'fonoclama', 'grama', 'predios', 'transportes'],
    'a lista de camadas ligadas no boot divergiu'
  )
  assert.ok(!iniciais.includes('aguada'), 'a aguada é o único módulo com dado de demonstração (D-01) — não pode abrir ligada')
  assert.match(app, /xMap\.setModules\(\[\.\.\.MODULOS_ATIVOS\]\)/, 'app.js não liga as camadas iniciais pelo componente')
})

// ── 10. as listas novas têm estado vazio explícito ──────────────────────
// Mesma propriedade que o painel de não localizados já tem (critério de
// sucesso 4 do plano 10-07): uma seção que some não distingue "está tudo
// certo" de "quebrou".
test('prédios sem posição e zonas sem contorno têm estado vazio explícito, como a lista de não localizados', () => {
  const app = ler(APP)
  assert.match(app, /Todos os prédios cadastrados têm coordenada/, 'falta o estado vazio da lista de prédios')
  assert.match(app, /Todas as zonas cadastradas têm contorno desenhado/, 'falta o estado vazio da lista de zonas')
  assert.match(app, /LOCAIS_SEM_POSICAO/, 'app.js não lê a lista de prédios da camada de dados')
})

// ── 11. truncagem anunciada, nunca silenciosa ───────────────────────────
// A lista de prédios corta em LIMITE_LISTA_LOCAIS porque são centenas. Uma
// lista cortada sem aviso lê como "acabou" — e o prédio que falta seria
// procurado para sempre.
test('a lista de prédios anuncia quantos ficaram de fora do corte', () => {
  const app = ler(APP)
  assert.match(app, /LIMITE_LISTA_LOCAIS/, 'o limite da lista de prédios não é uma constante nomeada')
  assert.match(app, /sobrando > 0/, 'app.js não confere se sobrou prédio fora do corte')
  assert.match(app, /refine o filtro/, 'o corte da lista de prédios não é anunciado na tela')
})

// ── 12. a camada genérica não fala com o banco nem monta rota à mão ──────
// Reafirma sobre o arquivo novo o que tests/mapa-camadas.test.js já afirma
// sobre grama e elétrica — a varredura de lá é dinâmica e já pega este
// arquivo na porta única, mas o link e a origem dos dados são propriedades
// dele que valem dizer por nome.
test('xmap-layers-ativos.js lê da camada de dados e monta o link só por linkDoModulo', () => {
  const conteudo = ler(ATIVOS)
  assert.match(conteudo, /from\s+['"]\.\/mapa-dados\.js['"]/, 'a camada genérica não importa a camada de dados')
  assert.match(conteudo, /linkDoModulo/, 'a camada genérica não usa linkDoModulo')
  assert.doesNotMatch(conteudo, /\?ativo=/, 'a camada genérica monta a rota de destino à mão')
  assert.doesNotMatch(conteudo, /\.from\(/, 'a camada genérica fala com o banco — só mapa-dados.js pode')
})

// ── 13. a legenda lê a paleta, não a reescreve ──────────────────────────
test('a legenda é desenhada a partir de ESTADOS e mapa/index.html não ganhou cor escrita à mão', () => {
  const app = ler(APP)
  const html = ler(INDEX_HTML)
  assert.match(app, /import\s*\{[^}]*ESTADOS[^}]*\}\s*from\s*['"]\.\/mapa-geometria\.js['"]/, 'app.js não importa ESTADOS do núcleo puro')
  assert.match(app, /Object\.entries\(ESTADOS\)/, 'a legenda não percorre ESTADOS')
  // Hex na marcação do módulo seria a cópia da paleta que este arranjo
  // existe para evitar — vale para a barra lateral inteira, não só a
  // legenda. #1a1a18 do theme-color é a exceção herdada (D-01, Fase 6).
  const hex = (html.match(/#[0-9a-fA-F]{6}\b/g) || []).filter((c) => c.toLowerCase() !== '#1a1a18')
  assert.deepEqual(hex, [], `mapa/index.html declarou cor em hex: ${hex.join(', ')}`)
  assert.ok(!/#[0-9a-fA-F]{6}/.test(ler(GEOMETRIA).split('Bloco 8')[0]), 'apareceu cor antes do bloco de estado do núcleo puro')
})

// ══════════════════════════════════════════════════════════════════
// Quick 260821-uyz — situação patrimonial no /mapa (Task 1).
// ══════════════════════════════════════════════════════════════════

// ── 14. só climatizacao declara colunaSituacao ──────────────────────────
test('só climatizacao declara colunaSituacao — as outras quatro famílias não ganham nada', () => {
  const dados = ler(DADOS)
  for (const modulo of Object.keys(MODULOS_ESPERADOS)) {
    const bloco = blocoDoModulo(dados, modulo)
    if (modulo === 'climatizacao') {
      assert.match(bloco, /colunaSituacao:\s*'situacao'/, 'climatizacao deveria declarar colunaSituacao')
      assert.match(bloco, /situacaoVisivel:\s*'instalado'/, 'climatizacao deveria declarar situacaoVisivel')
      assert.match(bloco, /colunaAtivo:\s*null/, 'climatizacao continua sem colunaAtivo — situação não é arquivamento')
    } else {
      assert.doesNotMatch(bloco, /colunaSituacao/, `${modulo} não deveria declarar colunaSituacao`)
    }
  }
})

// Fake chainable supabase client: conta quantas vezes `.from(` inicia uma
// consulta nova (o que uma retentativa faz) e devolve a resposta da fila.
function criarSupaFalso(respostas) {
  let chamadas = 0
  const supa = {
    from() {
      const idx = Math.min(chamadas, respostas.length - 1)
      chamadas++
      const builder = {
        select() { return builder },
        eq() { return builder },
        order() { return Promise.resolve(respostas[idx]) },
      }
      return builder
    },
  }
  return { supa, contarChamadas: () => chamadas }
}

// ── 15. carregarAtivosDoModulo recua uma vez sem a coluna de situação ───
test('carregarAtivosDoModulo repete a consulta sem situacao uma única vez quando a primeira erra, e devolve as linhas da segunda', async () => {
  const { definirCliente, carregarAtivosDoModulo } = await import('../mapa/mapa-dados.js')
  const linhas = [{ id: 1, tipo: 'SPLIT' }]
  const { supa, contarChamadas } = criarSupaFalso([
    { data: null, error: { message: 'column equipamentos.situacao does not exist' } },
    { data: linhas, error: null },
  ])
  definirCliente(supa)
  const resultado = await carregarAtivosDoModulo('climatizacao')
  assert.equal(contarChamadas(), 2, 'deveria ter tentado exatamente duas vezes')
  assert.deepEqual(resultado, linhas)
})

test('carregarAtivosDoModulo não repete quando a primeira consulta funciona', async () => {
  const { definirCliente, carregarAtivosDoModulo } = await import('../mapa/mapa-dados.js')
  const linhas = [{ id: 1, tipo: 'SPLIT', situacao: 'instalado' }]
  const { supa, contarChamadas } = criarSupaFalso([{ data: linhas, error: null }])
  definirCliente(supa)
  const resultado = await carregarAtivosDoModulo('climatizacao')
  assert.equal(contarChamadas(), 1, 'não deveria ter repetido a consulta')
  assert.deepEqual(resultado, linhas)
})

test('carregarAtivosDoModulo de um módulo sem colunaSituacao não recua no erro — devolve lista vazia direto', async () => {
  const { definirCliente, carregarAtivosDoModulo } = await import('../mapa/mapa-dados.js')
  const { supa, contarChamadas } = criarSupaFalso([{ data: null, error: { message: 'falha qualquer' } }])
  definirCliente(supa)
  const resultado = await carregarAtivosDoModulo('maquinas')
  assert.equal(contarChamadas(), 1, 'módulo sem colunaSituacao não deveria tentar duas vezes')
  assert.deepEqual(resultado, [])
})
