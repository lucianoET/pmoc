const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Gate de duas melhorias do /mapa (09/09/2026):
//   (2) OS aberta no marcador — a cor do marcador vinha só de `status`; 8 OS
//       abertas em 4 máquinas eram invisíveis. Agora cada família de ativo
//       declara em CONFIG_POR_MODULO de onde vêm as OS (tabela, coluna do
//       ativo, coluna de estado, estados terminais), mapa-dados.js conta as
//       não terminais por ativo e o marcador compartilhado desenha o
//       distintivo — nas três camadas de uma vez.
//   (3) Balão da zona com última execução e vencimento —
//       `maq_areas.periodicidade_dias` e `maq_operacoes.concluido_em` já
//       existiam e o balão não os mostrava. `situacaoDaZona` (núcleo puro)
//       responde em dia / a vencer / vencida / sem registro / sem
//       periodicidade, e a zona vencida sai tracejada.
//
// O que este arquivo PROVA: o cálculo por comportamento (datas de borda,
// data-só sem deslizar um dia, entrada inválida), a contagem de OS por
// comportamento com um cliente falso (inclusive a falha não derrubando a
// camada), a configuração completa nas cinco famílias, e que as três camadas
// e a legenda consomem o compartilhado. O que NÃO prova: o distintivo na
// tela — roteiro manual em TESTES.md.

const RAIZ = path.join(__dirname, '..')
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8')

const nucleo = import('../mapa/mapa-geometria.js')
const dados = import('../mapa/mapa-dados.js')
const marcadores = import('../mapa/xmap-marcadores.js')

const HOJE = new Date(2026, 8, 9) // 09/09/2026, local
const dia = (d) => d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ── situacaoDaZona ───────────────────────────────────────────────────
test('zona sem execução concluída é "sem registro", mesmo com periodicidade', async () => {
  const { situacaoDaZona } = await nucleo
  const s = situacaoDaZona({ periodicidade_dias: 7 }, [], HOJE)
  assert.equal(s.estado, 'sem_registro')
  assert.equal(s.ultimo, null)
  assert.equal(s.proximo, null)
  const s2 = situacaoDaZona({ periodicidade_dias: 7 }, [{ status: 'em_execucao', data_programada: '2026-08-18' }], HOJE)
  assert.equal(s2.estado, 'sem_registro', 'em execução ainda não é execução concluída')
  assert.equal(s2.emExecucao, true)
})

test('zona com execução mas sem periodicidade diz isso, e mostra a última', async () => {
  const { situacaoDaZona } = await nucleo
  for (const periodicidade of [null, undefined, 0, -5, 'abc']) {
    const s = situacaoDaZona({ periodicidade_dias: periodicidade }, [{ status: 'concluida', concluido_em: '2026-08-18T14:29:38+00:00' }], HOJE)
    assert.equal(s.estado, 'sem_periodicidade', `periodicidade ${periodicidade}`)
    assert.equal(dia(s.ultimo), '2026-08-18')
    assert.equal(s.proximo, null)
  }
})

test('em dia, a vencer e vencida saem da última execução mais a periodicidade, contra a data de hoje', async () => {
  const { situacaoDaZona, JANELA_A_VENCER_DIAS } = await nucleo
  const ops = [{ status: 'concluida', concluido_em: '2026-08-18T14:29:38+00:00' }]
  // 18/08 + 30 = 17/09 → 8 dias para 09/09
  const emDia = situacaoDaZona({ periodicidade_dias: 30 }, ops, HOJE)
  assert.equal(emDia.estado, 'em_dia')
  assert.equal(dia(emDia.proximo), '2026-09-17')
  assert.equal(emDia.dias, 8)
  // 18/08 + 22 = 09/09 → vence hoje: a vencer, não vencida
  const hoje = situacaoDaZona({ periodicidade_dias: 22 }, ops, HOJE)
  assert.equal(hoje.estado, 'a_vencer')
  assert.equal(hoje.dias, 0)
  // 18/08 + 15 = 02/09 → 7 dias atrás
  const vencida = situacaoDaZona({ periodicidade_dias: 15 }, ops, HOJE)
  assert.equal(vencida.estado, 'vencida')
  assert.equal(vencida.dias, -7)
  // a janela é uma constante nomeada, não um número solto no cálculo
  const naBorda = situacaoDaZona({ periodicidade_dias: 22 + JANELA_A_VENCER_DIAS }, ops, HOJE)
  assert.equal(naBorda.estado, 'a_vencer')
  const foraDaBorda = situacaoDaZona({ periodicidade_dias: 23 + JANELA_A_VENCER_DIAS }, ops, HOJE)
  assert.equal(foraDaBorda.estado, 'em_dia')
})

test('a última execução é a MAIS RECENTE das concluídas, e a programada é a mais próxima', async () => {
  const { situacaoDaZona } = await nucleo
  const s = situacaoDaZona({ periodicidade_dias: 30 }, [
    { status: 'concluida', concluido_em: '2026-07-01T10:00:00+00:00' },
    { status: 'concluida', concluido_em: '2026-08-18T14:29:38+00:00' },
    { status: 'concluida', concluido_em: '2026-08-02T09:00:00+00:00' },
    { status: 'programada', data_programada: '2026-09-20' },
    { status: 'programada', data_programada: '2026-09-12' },
  ], HOJE)
  assert.equal(dia(s.ultimo), '2026-08-18')
  assert.equal(dia(s.programada), '2026-09-12')
})

test('data-só (data_programada) não desliza um dia por fuso: 2026-08-18 continua dia 18', async () => {
  const { situacaoDaZona } = await nucleo
  const s = situacaoDaZona({}, [{ status: 'programada', data_programada: '2026-08-18' }], HOJE)
  assert.equal(dia(s.programada), '2026-08-18')
})

test('data inválida, operação nula e lista ausente não derrubam o cálculo', async () => {
  const { situacaoDaZona } = await nucleo
  const s = situacaoDaZona({ periodicidade_dias: 7 }, [null, { status: 'concluida', concluido_em: 'ontem' }, { status: 'concluida' }], HOJE)
  assert.equal(s.estado, 'sem_registro')
  assert.equal(situacaoDaZona(null, undefined, HOJE).estado, 'sem_registro')
})

// ── configuração das OS por família ──────────────────────────────────
test('as cinco famílias de ativo declaram de onde vêm as OS, com estados terminais não vazios', async () => {
  const { MODULOS_DE_ATIVO, configDoModulo } = await dados
  assert.equal(MODULOS_DE_ATIVO.length, 5)
  for (const modulo of MODULOS_DE_ATIVO) {
    const os = configDoModulo(modulo).os
    assert.ok(os, `${modulo} sem configuração de OS`)
    for (const campo of ['tabela', 'colunaAtivo', 'colunaStatus']) assert.equal(typeof os[campo], 'string', `${modulo}.os.${campo}`)
    assert.ok(Array.isArray(os.terminais) && os.terminais.length > 0, `${modulo}: terminais vazios contariam OS concluída como aberta`)
  }
  // os vocabulários reais, conferidos no banco em 09/09/2026
  assert.deepEqual(configDoModulo('maquinas').os.terminais, ['concluida', 'cancelada'])
  assert.equal(configDoModulo('climatizacao').os.tabela, 'logs_manutencao')
  assert.equal(configDoModulo('climatizacao').os.colunaAtivo, 'equip_id')
  for (const t of ['CONCLUIDA', 'CONFERIDA', 'ENCERRADA', 'CANCELADA']) {
    assert.ok(configDoModulo('climatizacao').os.terminais.includes(t), `climatização: ${t} é terminal (FLUXO_PROPRIO/CONTRATO/LEGADO da Refrigeração)`)
  }
})

// ── contagem de OS por ativo, com cliente falso ───────────────────────
function clienteFalso(respostas) {
  const chamadas = []
  return {
    chamadas,
    from(tabela) {
      const reg = { tabela, filtros: [] }
      chamadas.push(reg)
      const b = {
        select(c) { reg.select = c; return b },
        eq(col, v) { reg.filtros.push(['eq', col, v]); return b },
        not(col, op, v) { reg.filtros.push(['not', col, op, v]); return b },
        order() { return b },
        then(ok, erro) { return Promise.resolve(respostas[tabela] || { data: [], error: null }).then(ok, erro) },
      }
      return b
    },
  }
}

test('carregarOsAbertas conta OS não terminais por ativo, pedindo ao banco só o que não é terminal', async () => {
  const { definirCliente, carregarOsAbertas, configDoModulo } = await dados
  const falso = clienteFalso({
    maq_os: { data: [{ ativo_id: 1, status: 'pendente' }, { ativo_id: 1, status: 'espera' }, { ativo_id: 7, status: 'delineamento' }, { ativo_id: null, status: 'pendente' }], error: null },
  })
  definirCliente(falso)
  const contagem = await carregarOsAbertas('maquinas')
  assert.equal(contagem.get(1), 2)
  assert.equal(contagem.get(7), 1)
  assert.equal(contagem.get(99), undefined)
  const chamada = falso.chamadas.find((c) => c.tabela === 'maq_os')
  assert.ok(chamada, 'deveria consultar a tabela declarada na configuração')
  const not = chamada.filtros.find((f) => f[0] === 'not')
  assert.ok(not, 'o filtro de terminais vai ao banco, não só à memória')
  assert.equal(not[1], 'status')
  assert.equal(not[2], 'in')
  for (const t of configDoModulo('maquinas').os.terminais) assert.ok(not[3].includes(t), `${t} deveria estar no not.in`)
})

test('falha na tabela de OS devolve contagem vazia e NÃO derruba a carga dos ativos', async () => {
  const { definirCliente, carregarOsAbertas, carregarAtivosDoModulo } = await dados
  definirCliente(clienteFalso({
    maq_os: { data: null, error: { message: 'relation "maq_os" does not exist' } },
    maq_ativos: { data: [{ id: 1, nome: 'A' }, { id: 2, nome: 'B' }], error: null },
  }))
  const contagem = await carregarOsAbertas('maquinas')
  assert.equal(contagem.size, 0)
  const ativos = await carregarAtivosDoModulo('maquinas')
  assert.equal(ativos.length, 2, 'os ativos continuam vindo')
  assert.deepEqual(ativos.map((a) => a.osAbertas), [0, 0])
})

test('carregarAtivosDoModulo entrega cada ativo com osAbertas resolvido', async () => {
  const { definirCliente, carregarAtivosDoModulo } = await dados
  definirCliente(clienteFalso({
    transp_ativos: { data: [{ id: 30, nome: 'MUNK' }, { id: 31, nome: 'KOMBI' }], error: null },
    transp_manutencoes: { data: [{ ativo_id: 31, status: 'pendente' }, { ativo_id: 31, status: 'em_andamento' }], error: null },
  }))
  const ativos = await carregarAtivosDoModulo('transportes')
  assert.deepEqual(ativos.map((a) => [a.id, a.osAbertas]), [[30, 0], [31, 2]])
})

test('carregarOperacoesPorZona agrupa por zona e não pede as colunas de custo/tempo (D-04)', async () => {
  const { definirCliente, carregarOperacoesPorZona } = await dados
  const falso = clienteFalso({
    maq_operacoes: { data: [{ area_id: 'z1', status: 'concluida', concluido_em: '2026-08-18T14:29:38+00:00' }, { area_id: 'z1', status: 'em_execucao' }, { area_id: 'z2', status: 'programada', data_programada: '2026-09-12' }, { area_id: null, status: 'concluida' }], error: null },
  })
  definirCliente(falso)
  const porZona = await carregarOperacoesPorZona()
  assert.equal(porZona.get('z1').length, 2)
  assert.equal(porZona.get('z2').length, 1)
  assert.equal(porZona.size, 2)
  const sel = falso.chamadas.find((c) => c.tabela === 'maq_operacoes').select
  assert.doesNotMatch(sel, /horas_utilizadas|area_executada_m2/)
})

// ── distintivo compartilhado e consumidores ──────────────────────────
test('o distintivo de OS só existe com OS aberta, e corta em 9+', async () => {
  const { distintivoOS, linhaOS, osAbertasDe } = await marcadores
  assert.equal(distintivoOS(0), '')
  assert.equal(distintivoOS(undefined), '')
  assert.match(distintivoOS(3), /xmap-os-badge/)
  assert.match(distintivoOS(3), />3</)
  assert.match(distintivoOS(12), />9\+</)
  assert.equal(linhaOS({ osAbertas: 0 }), null)
  assert.deepEqual(linhaOS({ osAbertas: 2 }), ['OS abertas', '2', 'warn'])
  assert.equal(osAbertasDe([{ osAbertas: 2 }, { osAbertas: 0 }, {}, { osAbertas: 'x' }]), 2)
})

test('o marcador compartilhado desenha o distintivo no ativo só e no grupo; as três camadas põem a linha de OS no balão', () => {
  const m = ler('mapa/xmap-marcadores.js')
  const desenho = m.match(/export function desenharAtivosAgrupados[\s\S]*?\n\}/)[0]
  assert.match(desenho, /distintivoOS\(/, 'o html do ícone deveria receber o distintivo')
  assert.match(desenho, /osAbertasDe\(ponto\.ativos\)/, 'no grupo, a contagem é a soma dos ativos do ponto')
  for (const rel of ['mapa/xmap-layers-grama.js', 'mapa/xmap-layers-eletrica.js', 'mapa/xmap-layers-ativos.js']) {
    assert.match(ler(rel), /linhaOS\(/, `${rel}: o balão de um ativo só deveria mostrar as OS abertas`)
    assert.doesNotMatch(ler(rel), /xmap-os-badge/, `${rel}: o distintivo é do compartilhado, não da camada`)
  }
  assert.match(ler('mapa/index.html'), /\.xmap-os-badge\{/, 'o distintivo precisa de regra na folha do módulo (xmap.css é travado)')
  assert.match(ler('mapa/app.js').match(/function renderLegenda[\s\S]*?\n\}/)[0], /distintivoOS\(/, 'a legenda explica o distintivo desenhando-o pelo compartilhado, não copiando a classe')
})

test('a camada de grama lê a situação pelo núcleo puro e traceja a zona vencida', () => {
  const g = ler('mapa/xmap-layers-grama.js')
  assert.match(g, /import\s*\{[^}]*\bsituacaoDaZona\b[^}]*\}\s*from\s*'\.\/mapa-geometria\.js'/)
  assert.match(g, /carregarOperacoesPorZona\(\)/, 'as operações vêm pela porta única')
  assert.match(g, /dashArray/, 'zona vencida sai tracejada')
  assert.match(g, /vencida/)
  assert.doesNotMatch(g, /\.from\(/)
})
