const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Este arquivo continua o padrão que tests/tema-superficies.test.js
// estabeleceu na Fase 6: uma decisão de exclusão de escopo vira teste,
// não comentário — porque comentário não falha sozinho quando alguém o
// contraria numa fase futura. Ali eram D-01 (mapa/xmap.css dark-only) e
// D-05 (calibração fora da convenção pmoc-tema); aqui são as duas
// exclusões da Fase 10, ROADMAP.md § "Phase 10 → Decisões travadas".
const RAIZ = path.join(__dirname, '..')
const MAPA = path.join(RAIZ, 'mapa')
const AGUADA = path.join(MAPA, 'xmap-layers-aguada.js')

// arquivos JavaScript de mapa/ varridos dinamicamente — não uma lista
// fixa — para que qualquer arquivo novo criado pelos planos 10-04 a
// 10-07 entre no gate automaticamente, em vez de escapar dele por
// omissão de quem escreveu este teste em 10-02
function arquivosJsDeMapa() {
  return fs
    .readdirSync(MAPA)
    .filter((nome) => nome.endsWith('.js'))
    .map((nome) => path.join(MAPA, nome))
}

// ── D-01 — a camada aguada fica fora do PLAT-17 ─────────────────────────
// `aguada` não tem tabela no pmoc: é sistema externo autônomo, com FastAPI
// e SQLite próprios, alimentado por MQTT (ver ref/MODULOS_EXTERNOS.md).
// Criar uma tabela estática agora duplicaria esse sistema só para
// descartá-la quando a telemetria da Phase 11 chegar. Sem este teste, um
// desenvolvedor futuro "uniformiza" as três camadas (grama, elétrica,
// água) para todas lerem do Supabase, contrariando a decisão sem saber
// que ela existiu.
test('mapa/xmap-layers-aguada.js continua mock por decisão D-01 — não busca no Supabase', () => {
  const conteudo = fs.readFileSync(AGUADA, 'utf8')
  assert.doesNotMatch(
    conteudo,
    /supa\.from\(/,
    'xmap-layers-aguada.js deveria continuar mock (D-01), não ganhar leitura Supabase nesta fase'
  )
})

// O primeiro caso impede que alguém acrescente Supabase à aguada; este
// impede o erro oposto — alguém "limpar" o arquivo removendo os dados de
// demonstração achando que o critério de sucesso 6 (nenhum dado mock
// permanece na origem do que é exibido) também vale para ela. O critério
// 6 vale para grama e elétrica, que têm tabela real; a aguada não tem, e
// é essa fronteira que este par de casos desenha.
test('mapa/xmap-layers-aguada.js continua declarando os dados fixos de infraestrutura (reservoirs, pumps) — a exclusão de D-01 não é licença para apagar os dados de demonstração', () => {
  const conteudo = fs.readFileSync(AGUADA, 'utf8')
  assert.match(conteudo, /reservoirs\s*:/, 'objeto INFRA.reservoirs deveria continuar presente')
  assert.match(conteudo, /pumps\s*:/, 'objeto INFRA.pumps deveria continuar presente')
})

// Este terceiro caso do D-01 vai falhar até o plano 10-05 acrescentar a
// linha de cabeçalho citando a decisão em mapa/xmap-layers-aguada.js — não
// escrito aqui de propósito. A marcação do cabeçalho da aguada é
// responsabilidade do plano 10-05 (que edita esse arquivo); o caso
// correspondente vive no teste de camadas daquele plano, para não haver
// dois arquivos de teste disputando a mesma propriedade.
//
// (nenhum caso automatizado aqui — só este comentário registrando por que
// não há um terceiro `test()` para a menção de D-01 no cabeçalho)

// ── D-04 — nada de estimativa de tempo/custo por zona nesta fase ───────
// A escolha do gate é deliberada: procurar as palavras "custo" e "tempo"
// no código colidiria com prosa comum em português — a Fase 6 tropeçou
// exatamente nisso, num gate que proibia uma subsequência que aparecia
// dentro de uma palavra portuguesa comum (registrado em 06-04-SUMMARY.md).
// Nome de tabela e nome de coluna do banco não colidem com nada. O que a
// decisão preserva: as colunas continuam existindo no banco desde a
// migração 12, e quando a estimativa vier ela vai sair de execução real
// em vez de constante arbitrária.
test('nenhum arquivo JavaScript de mapa/ referencia a tabela de execução de operação de máquina (D-04)', () => {
  for (const arquivo of arquivosJsDeMapa()) {
    const conteudo = fs.readFileSync(arquivo, 'utf8')
    assert.doesNotMatch(
      conteudo,
      /maq_operacoes/,
      `${path.basename(arquivo)} referencia maq_operacoes — estimativa de tempo/custo por zona é D-04, fora desta fase`
    )
  }
})

test('nenhum arquivo JavaScript de mapa/ referencia as colunas de execução que permitiriam derivar rendimento por hora (D-04)', () => {
  for (const arquivo of arquivosJsDeMapa()) {
    const conteudo = fs.readFileSync(arquivo, 'utf8')
    assert.doesNotMatch(
      conteudo,
      /horas_utilizadas/,
      `${path.basename(arquivo)} referencia horas_utilizadas — estimativa de tempo/custo por zona é D-04, fora desta fase`
    )
    assert.doesNotMatch(
      conteudo,
      /area_executada_m2/,
      `${path.basename(arquivo)} referencia area_executada_m2 — estimativa de tempo/custo por zona é D-04, fora desta fase`
    )
  }
})
