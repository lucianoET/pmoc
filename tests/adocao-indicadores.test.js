const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')

// ══════════════════════════════════════════════════════════════════
// Gate permanente da ADOÇÃO (Fase 13, Onda C, plano 13-07).
//
// Este arquivo é a prova de que os núcleos da Onda A servem módulos que
// JÁ EXISTIAM, e não só o /gestao recém-nascido. Um núcleo compartilhado
// com um consumidor só é uma promessa, não um fato — a mesma régua que
// shared/tabela.js teve de passar quando reparos/tabelas.js e
// maquinas/areas-tabela.js viraram seu segundo e terceiro consumidores
// sem uma linha mudada no núcleo.
//
// O que ele protege, e por quê:
//
// (1) IMPORTAÇÃO, NUNCA CÓPIA. Os dois módulos importam
//     shared/indicadores.js e Máquinas importa shared/abc.js. Reprovar a
//     cópia é o ponto: uma segunda implementação de "avaliar contra a
//     meta" divergiria da primeira no dia em que uma das duas mudasse, e
//     ninguém veria.
//
// (2) NENHUM KPI SUMIU. A lista de ids de KPI de cada módulo fica escrita
//     AQUI, como constante. É o que impede uma limpeza futura de apagar
//     um número da tela sem ninguém notar — a adoção acrescentou cartões
//     ao lado da fila de KPI, nunca no lugar dela. E não basta o id estar
//     na marcação: o gate exige também que o JavaScript continue
//     preenchendo cada um, senão um id órfão passaria mostrando "—".
//
// (3) A LISTA FECHADA DE SENTIDO. `maior`/`menor` é o vocabulário que
//     shared/indicadores.js entende; um terceiro valor inventado no
//     consumidor não daria erro nenhum — `avaliar` trataria como 'maior'
//     e o semáforo sairia invertido em silêncio.
//
// (4) A CURVA ABC NÃO CONSULTA O BANCO. É estado de tela sobre a lista já
//     carregada, a mesma régua da ordenação e do filtro da tabela de
//     Estoque.
//
// (5) NENHUMA COR EM JAVASCRIPT. Tom vem sempre de classe, resolvida na
//     folha comum — mesma regra de shared/icones.js e shared/componentes.js.
//
// (6) O NÚCLEO CONTINUA GENÉRICO. shared/indicadores.js não pode ganhar
//     nome de indicador concreto: a generalidade vaza pelo lado do
//     consumidor, que é onde este gate olha.
//
// Onde dá, a prova é COMPORTAMENTAL: as definições declaradas nos módulos
// são avaliadas de verdade (node:vm) e passadas para as funções reais de
// shared/, em vez de conferidas por expressão regular.
// ══════════════════════════════════════════════════════════════════

const { avaliar, cartaoIndicador } = require('../shared/indicadores.js')
const { classificarAbc } = require('../shared/abc.js')

const RAIZ = path.join(__dirname, '..')
const ler = relativo => fs.readFileSync(path.join(RAIZ, relativo), 'utf8')

const MAQ_APP = ler('maquinas/app.js')
const MAQ_HTML = ler('maquinas/index.html')
const TRA_APP = ler('transportes/app.js')
const TRA_HTML = ler('transportes/index.html')
const NUCLEO_INDICADORES = ler('shared/indicadores.js')

// Remove a linha de comentário antes de afirmar ausência: o comentário que
// explica POR QUE algo não pode aparecer costuma citar a própria coisa
// proibida. Terceira armadilha dessa família paga no projeto (shared/,
// "@media", type="number") — mesma técnica de tests/chrome-icones.test.js.
function semComentarios(conteudo) {
  return conteudo
    .split('\n')
    .filter(linha => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .map(linha => linha.replace(/\/\/.*$/, ''))
    .join('\n')
}

// Avalia um literal recortado do módulo (uma lista de definições, uma função
// acessora) num contexto vazio. É o que torna os casos abaixo comportamentais:
// o que roda é a declaração REAL do consumidor, não uma cópia dela escrita no
// teste — que concordaria consigo mesma para sempre.
function avaliarLiteral(fonte, nome) {
  // lista de várias linhas: fecha na primeira linha que começa em "]"
  const lista = fonte.match(new RegExp(`const ${nome} = (\\[[\\s\\S]*?\\n\\])`))
  if (lista) return vm.runInNewContext(`(${lista[1]})`)
  // expressão de uma linha (o acessor de valor da curva)
  const linha = fonte.match(new RegExp(`const ${nome} = (.+)$`, 'm'))
  assert.ok(linha, `${nome} deveria ser declarado como const de topo do módulo`)
  return vm.runInNewContext(`(${linha[1]})`)
}

// ── (1) importação, nunca cópia ───────────────────────────────────────────

test('os dois módulos importam shared/indicadores.js, e Máquinas importa também shared/abc.js', () => {
  for (const [nome, fonte] of [['maquinas/app.js', MAQ_APP], ['transportes/app.js', TRA_APP]]) {
    const importacoes = fonte.match(/import \{[^}]*\} from '\.\.\/shared\/indicadores\.js'/g) || []
    assert.equal(importacoes.length, 1,
      `${nome} deveria importar shared/indicadores.js exatamente uma vez`)
    assert.match(fonte, /import \{[^}]*cartaoIndicador[^}]*\} from '\.\.\/shared\/indicadores\.js'/,
      `${nome} deveria consumir cartaoIndicador do núcleo comum`)
  }

  const abc = MAQ_APP.match(/import \{[^}]*\} from '\.\.\/shared\/abc\.js'/g) || []
  assert.equal(abc.length, 1, 'maquinas/app.js deveria importar shared/abc.js exatamente uma vez')
  assert.match(MAQ_APP, /import \{[^}]*classificarAbc[^}]*\} from '\.\.\/shared\/abc\.js'/)

  // transportes não tem estoque com curva ABC nesta onda — e não pode ganhar
  // uma cópia local do núcleo por isso
  assert.doesNotMatch(semComentarios(TRA_APP), /function classificarAbc/)
})

test('nenhum dos dois módulos copiou a lógica de meta, tendência ou classificação para dentro de si', () => {
  // As funções do núcleo, pelo nome de declaração. Consumir é `avaliar(...)`;
  // copiar é `function avaliar(`/`const avaliar =` — é essa a diferença que o
  // caso separa, e é a única que importa: uma segunda implementação diverge da
  // primeira na próxima mudança, em silêncio.
  const proibidos = [
    'function avaliar', 'const avaliar =',
    'function tendencia', 'const tendencia =',
    'function cartaoIndicador', 'const cartaoIndicador =',
    'function classificarAbc', 'const classificarAbc =',
  ]
  for (const [nome, fonte] of [['maquinas/app.js', MAQ_APP], ['transportes/app.js', TRA_APP]]) {
    const limpo = semComentarios(fonte)
    for (const proibido of proibidos) {
      assert.ok(!limpo.includes(proibido),
        `${nome} declara "${proibido}" — é cópia do núcleo, não adoção. ` +
        'A regra do componente compartilhado mora em shared/, num lugar só.')
    }
  }
})

// ── (2) nenhum KPI sumiu ──────────────────────────────────────────────────

// A lista fica escrita aqui de propósito: é o retrato do que os dois painéis
// mostravam ANTES da Onda C. Apagar um número da tela passa a exigir apagar uma
// linha desta constante, que é uma decisão visível em revisão.
const KPIS_ANTES = {
  maquinas: ['kpi-total', 'kpi-operantes', 'kpi-inop', 'kpi-venc', 'kpi-estoque-baixo', 'kpi-os-abertas'],
  transportes: ['kpi-total', 'kpi-disponiveis', 'kpi-sobreaviso', 'kpi-viagens', 'kpi-manut', 'kpi-vencidas', 'kpi-estoque-baixo'],
}

test('todo id de KPI que existia antes da adoção continua na marcação dos dois painéis', () => {
  for (const [modulo, html] of [['maquinas', MAQ_HTML], ['transportes', TRA_HTML]]) {
    for (const id of KPIS_ANTES[modulo]) {
      assert.ok(html.includes(`id="${id}"`),
        `${modulo}/index.html perdeu o KPI id="${id}". ` +
        'A adoção acrescenta cartões AO LADO da fila de KPI, nunca no lugar dela (PLAT-16).')
    }
    assert.match(html, /<div class="kpi-row">/,
      `${modulo}/index.html deveria manter a fila .kpi-row — é a fotografia crua do painel`)
  }
})

test('cada KPI antigo continua sendo preenchido pelo JavaScript — id na marcação não basta', () => {
  for (const [modulo, fonte] of [['maquinas', MAQ_APP], ['transportes', TRA_APP]]) {
    for (const id of KPIS_ANTES[modulo]) {
      assert.ok(fonte.includes(`'${id}'`),
        `${modulo}/app.js não escreve mais em ${id} — o cartão ficaria na tela mostrando "—"`)
    }
  }
})

// ── (3) definição de indicador declarada no consumidor ────────────────────

const SENTIDOS = ['maior', 'menor']
const CHAVES_DA_DEFINICAO = ['id', 'rotulo', 'unidade', 'meta', 'sentido', 'faixas']

test('as definições vivem nos módulos consumidores, com a mesma forma dos dois lados', () => {
  const maq = avaliarLiteral(MAQ_APP, 'INDICADORES_MAQUINAS')
  const tra = avaliarLiteral(TRA_APP, 'INDICADORES_TRANSPORTES')

  for (const [nome, lista] of [['INDICADORES_MAQUINAS', maq], ['INDICADORES_TRANSPORTES', tra]]) {
    assert.ok(Array.isArray(lista) && lista.length > 0, `${nome} deveria ser uma lista não vazia`)
    for (const def of lista) {
      assert.equal(typeof def.id, 'string', `${nome}: todo indicador precisa de id`)
      assert.ok(def.rotulo && def.rotulo.trim(), `${nome}: ${def.id} sem rótulo`)
      assert.ok(SENTIDOS.includes(def.sentido),
        `${nome}: ${def.id} declara sentido "${def.sentido}", fora da lista fechada ${SENTIDOS.join('/')}. ` +
        'Um terceiro valor não daria erro nenhum — avaliar() o trataria como "maior" e o semáforo sairia invertido em silêncio.')
      for (const chave of Object.keys(def)) {
        assert.ok(CHAVES_DA_DEFINICAO.includes(chave),
          `${nome}: ${def.id} declara a chave "${chave}", que shared/indicadores.js não lê`)
      }
      if ('meta' in def) {
        assert.ok(typeof def.meta === 'number' && Number.isFinite(def.meta),
          `${nome}: ${def.id} declara meta não numérica — avaliar() a descartaria e o cartão diria "Sem meta definida"`)
      }
    }
  }
})

test('indicador sem meta sai em tom de informação com "Sem meta definida"; com meta, o semáforo funciona', () => {
  const definicoes = [
    ...avaliarLiteral(MAQ_APP, 'INDICADORES_MAQUINAS'),
    ...avaliarLiteral(TRA_APP, 'INDICADORES_TRANSPORTES'),
  ]

  const semMeta = definicoes.filter(def => !('meta' in def))
  const comMeta = definicoes.filter(def => 'meta' in def)
  assert.ok(semMeta.length > 0, 'a adoção precisa exercer o caso "sem meta" — é o estado do contrato de UI')
  assert.ok(comMeta.length > 0, 'a adoção precisa exercer o caso "com meta" — senão o semáforo nunca é provado')

  for (const def of semMeta) {
    assert.equal(avaliar(7, def), 'info',
      `${def.id} não tem meta e deveria ser lido como informação, nunca como alarme`)
    const html = cartaoIndicador(def, 7, [])
    assert.match(html, /indicador-tom-info/)
    assert.match(html, /Sem meta definida/)
  }

  for (const def of comMeta) {
    // as duas metas desta onda são zero, com sentido "menor": o alvo do que
    // passou do limite cadastrado (intervalo do plano, mínimo da peça) é
    // nenhum — zero é "ok" e qualquer coisa acima é falha contra o cadastro
    assert.equal(def.meta, 0)
    assert.equal(def.sentido, 'menor')
    assert.equal(avaliar(0, def), 'ok', `${def.id}: dentro da meta deveria ser ok`)
    assert.equal(avaliar(3, def), 'erro', `${def.id}: acima da meta deveria ser erro`)
    assert.match(cartaoIndicador(def, 3, []), /indicador-tom-erro/)
  }
})

test('indicador sem valor devolve o vazio do contrato, e não zero', () => {
  // null é "não medido" e zero é uma medição — trocar um pelo outro é a classe
  // de erro que este projeto já pagou em `default false` de coluna não avaliada
  const def = avaliarLiteral(MAQ_APP, 'INDICADORES_MAQUINAS')[0]
  const html = cartaoIndicador(def, null, [])
  assert.match(html, /indicador-tom-neutro/)
  assert.match(html, /Sem dado no período/)
  assert.doesNotMatch(html, /kpi-n/)
})

// ── (4) a curva ABC é estado de tela ──────────────────────────────────────

const RENDER_ABC = MAQ_APP.match(/function renderAbcEstoque\(\)\{([\s\S]*?)\n\}\n/)

test('a curva ABC do Estoque não consulta o banco — é derivada da lista já carregada', () => {
  assert.ok(RENDER_ABC, 'maquinas/app.js deveria declarar renderAbcEstoque()')
  const corpo = semComentarios(RENDER_ABC[1])
  for (const proibido of ['supa.from', 'carregarTudo(', '.select(', '.rpc(']) {
    assert.ok(!corpo.includes(proibido),
      `renderAbcEstoque() contém "${proibido}" — a curva é estado de tela, a mesma régua da ordenação ` +
      'e do filtro da tabela de Estoque (nenhuma consulta, nenhuma recarga).')
  }
  assert.match(corpo, /classificarAbc\(MATERIAIS,/,
    'a curva classifica o catálogo inteiro; sobre a lista filtrada as porcentagens passariam a ser ' +
    'relativas ao filtro, e a tela responderia à pergunta errada')
})

test('o acessor de valor do Estoque é declarado no módulo e produz a curva pelo valor imobilizado', () => {
  const acessor = avaliarLiteral(MAQ_APP, 'ABC_ESTOQUE')
  assert.equal(typeof acessor, 'function', 'ABC_ESTOQUE deveria ser o acessor passado a classificarAbc')

  // comportamento, com o acessor REAL do módulo: quem tem saldo × preço maior
  // vem primeiro, e peça sem preço vale zero e cai em C
  const catalogo = [
    { nome: 'barata', estoque_atual: 2, preco: 1 },
    { nome: 'cara', estoque_atual: 10, preco: 100 },
    { nome: 'sem preço', estoque_atual: 50, preco: null },
  ]
  const { linhas, total } = classificarAbc(catalogo, acessor)
  assert.equal(total, 1002)
  assert.equal(linhas[0].item.nome, 'cara')
  assert.equal(linhas[0].classe, 'A')
  assert.equal(linhas.find(l => l.item.nome === 'sem preço').valor, 0)
  assert.equal(linhas.find(l => l.item.nome === 'sem preço').classe, 'C')

  // um item só é uma linha de classe A — comportamento matemático correto,
  // nunca um defeito
  const unico = classificarAbc([{ nome: 'única', estoque_atual: 1, preco: 5 }], acessor)
  assert.equal(unico.linhas.length, 1)
  assert.equal(unico.linhas[0].classe, 'A')
  assert.equal(unico.linhas[0].acumulado, 100)
})

test('a lista vazia desenha o vazio do contrato, nunca uma tabela sem linha', () => {
  assert.ok(RENDER_ABC)
  const corpo = RENDER_ABC[1]
  assert.match(corpo, /vazio\('Nenhum item para classificar', 'Cadastre itens com valor para gerar a curva'\)/,
    'o texto é o do contrato de UI (13-UI-SPEC, seção Copywriting)')
  assert.match(corpo, /total <= 0/,
    'catálogo inteiro sem preço também não tem curva: uma tabela de zeros seria uma curva que não existe')
  assert.ok(corpo.indexOf('vazio(') < corpo.indexOf('<table'),
    'o vazio precisa acontecer ANTES de montar a tabela, senão a tabela sai sem linha nenhuma')
})

test('a estrutura cabeçalho/corpo da tabela de Estoque não foi mexida pela adoção', () => {
  // renderCabecalhoMateriais()/renderLinhasMateriais() são decisão travada (D3):
  // digitar num filtro redesenha só o <tbody>, senão o foco e o cursor do campo
  // morrem a cada tecla. A curva entrou ao lado, num contêiner próprio.
  assert.match(MAQ_APP, /function renderCabecalhoMateriais\(\)\{/)
  assert.match(MAQ_APP, /function renderLinhasMateriais\(\)\{/)
  assert.match(MAQ_HTML, /<thead id="th-materiais"><\/thead>/)
  assert.match(MAQ_HTML, /id="estoque-abc"/, 'o contêiner da curva é próprio, fora de #tb-materiais')
  assert.ok(MAQ_HTML.indexOf('id="tb-materiais"') < MAQ_HTML.indexOf('id="estoque-abc"'),
    'a curva fica depois da tabela: a tabela é a ferramenta do dia a dia, a curva é leitura de gestão')
})

// ── (5) nenhuma cor em JavaScript ─────────────────────────────────────────

test('nenhuma cor literal foi acrescentada ao JavaScript dos dois módulos', () => {
  // O tom sai sempre de classe (.indicador-tom-*, .abc-classe-*, .pilula-*),
  // resolvida em shared/pmoc.css. `currentColor` é o oposto de cor escrita: ele
  // DELEGA a cor para a classe — mesmo mecanismo dos SVG de shared/grafico.js.
  const contar = fonte => (semComentarios(fonte).match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) || []).length

  // Máquinas já tinha 6 constantes de cor de accent/tema antes da Onda C, e
  // Transportes 1. O gate trava o número: a adoção não pode acrescentar nem uma.
  assert.equal(contar(MAQ_APP), 6, 'maquinas/app.js ganhou (ou perdeu) cor literal em JavaScript')
  assert.equal(contar(TRA_APP), 1, 'transportes/app.js ganhou (ou perdeu) cor literal em JavaScript')

  // e o que a adoção desenha é sempre por classe
  assert.ok(RENDER_ABC)
  assert.match(RENDER_ABC[1], /abc-classe-\$\{/, 'a classe da curva resolve a cor na folha, não aqui')
})

// ── (6) o núcleo continua genérico ────────────────────────────────────────

test('shared/indicadores.js continua sem nome de indicador concreto dentro dele', () => {
  const nucleo = semComentarios(NUCLEO_INDICADORES).toLowerCase()
  const vazamentos = [
    'disponibilidade', 'estoque', 'material', 'materiais', 'manutenç', 'manutenc',
    'viagem', 'viagens', 'frota', 'máquina', 'maquina', 'os abertas', 'mtbf', 'mttr',
  ]
  for (const palavra of vazamentos) {
    assert.ok(!nucleo.includes(palavra),
      `shared/indicadores.js menciona "${palavra}" — a definição do indicador é PARÂMETRO, ` +
      'e vocabulário de domínio no núcleo é o começo de um núcleo que só serve a um módulo.')
  }
})

test('a adoção não precisou mudar os dois núcleos — se precisasse, o domínio teria vazado para dentro deles', () => {
  // Prova pela assinatura: o consumidor passa (def, valor, série) e (itens,
  // acessor), exatamente o contrato que a Onda A publicou. Nenhum argumento
  // novo, nenhuma opção nova.
  assert.equal(cartaoIndicador.length, 3, 'cartaoIndicador(def, valor, serie)')
  // 2 e não 3: `cortes` tem valor padrão, e parâmetro com padrão não entra em
  // Function.length — os cortes [0.8, 0.95] são do núcleo, não do consumidor
  assert.equal(classificarAbc.length, 2, 'classificarAbc(itens, campoValor, cortes = [0.8, 0.95])')
  assert.match(cartaoIndicador({ rotulo: 'X', unidade: 'un' }, 1, [1, 2]), /class="kpi indicador/)
  assert.deepEqual(Object.keys(classificarAbc([], 'v')), ['linhas', 'total'])
})
