---
phase: quick
plan: 260822-5hy
subsystem: ui
tags: [refrigeracao, csv, planilha, inventario, importacao, exportacao, arquivamento]

requires: []
provides:
  - "planoDeImportacao(texto, dados): função pura central — casa cabeçalho, produz atualizar/criar/erros, só então decide arquivar avaliando escopo+erros+contagem+teto"
  - "montarCsv/planilhaValor: serialização única, consumida por exportação e diff — o ciclo exportar→reimportar sem editar fecha em zero mudança por construção"
  - "csvParse: parser de máquina de estados (aspas escapadas, separador/quebra de linha dentro de campo, BOM, CRLF, apóstrofo de guarda contra fórmula)"
  - "#btn-planilha na faixa do Inventário: painel de exportar/importar na gaveta, com o escopo declarado em palavras antes de qualquer arquivo existir"
  - "renderConferenciaPlanilha/aplicarPlanoPlanilha: tela de conferência nominal antes de qualquer gravação, e a única porta de escrita (update por linha, insert único, update de arquivamento com payload de uma chave)"
affects: [refrigeracao]

tech-stack:
  added: []
  patterns:
    - "Diff calculado sobre a forma SERIALIZADA (planilhaValor), nunca sobre valor tipado — faz o ciclo fechado valer por construção e dissolve a briga null vs 0 de correnteNominal"
    - "Escopo derivado do CONTEÚDO (comparação de conjuntos de ids), nunca do estado da tela (chip/busca) — torna a exportação filtrada reimportada estruturalmente incapaz de arquivar, em vez de apenas gateada"
    - "candidatosArquivar (sempre populada, informativa) separada de arquivar (só populada quando as guardas passam) — permite a tela mostrar quem SERIA arquivado mesmo com o arquivamento desligado, sem que o núcleo precise saber de DOM"

key-files:
  created:
    - tests/refrigeracao-planilha.test.js
  modified:
    - refrigeracao/index.html
    - CLAUDE.md
    - TESTES.md

key-decisions:
  - "D-5hy-01 a D-5hy-05: as cinco vieram do usuário antes da execução (CSV não XLSX; arquivar é situação de removido e só ela; nada grava antes da conferência; exportar+reimportar sem editar fecha em zero; importar gateado em podeEditarCadastro na abertura E na gravação) — seguidas à risca, nenhuma reaberta"
  - "D-5hy-06 a D-5hy-12: colunas derivadas de EQUIP_EDITAVEIS (nunca lista literal); duas colunas somente-leitura nomeadas como tais; lat/lon/local_id fora da planilha; casamento por rótulo exato; id vazio=cria, não-numérico/inexistente/repetido=recusa; diff por forma serializada"
  - "D-5hy-13 a D-5hy-17: escopo declarado na linha 1 do CSV com três pré-condições (completo + zero erros + contagem batendo); escopo derivado do CONTEÚDO exportado, nunca do chip/busca ativos; guarda de escala max(5, ceil(10%)); presença nunca desarquiva; arquivamento grava só situacao, nada mais"
  - "D-5hy-18 a D-5hy-22: datas ISO ou dd/mm/aaaa validadas por reconstrução (nunca regex sozinha); booleano SIM/NÃO (não TRUE/FALSE — o Excel pt-BR localiza para VERDADEIRO/FALSO); corrente com vírgula decimal; três listas fechadas validadas no cliente (única guarda para criticidade/estado — sem check no banco); guarda de fórmula desfeita só quando seguida de =+-@"
  - "D-5hy-23 a D-5hy-25: botão único (#btn-planilha) antes de #btn-etiquetas; exportação exporta o FILTRADO com o escopo dito em palavras antes do arquivo existir; código novo no fim do último <script>, dois marcadores separando núcleo puro de tela/gravação"
  - "Deviação de composição (não uma nova decisão, um ajuste dentro do plano): montarCsv recebe `dados` (o DATA inteiro), não só uma contagem — necessário para escopoCompletoDe computar completude por conjunto de ids (D-5hy-14), que o pseudocódigo do plano não explicitava no parâmetro"
  - "Deviação de composição: planoDeImportacao ganhou `candidatosArquivar` (lista sempre populada) ao lado de `arquivar` (só populada quando habilitado) — sem essa distinção a tela não teria como mostrar, em tom neutro, quem SERIA arquivado quando uma guarda desliga o arquivamento (exigido pelo próprio texto da Tarefa 3), sem violar o contrato já testado da Tarefa 1 de que `arquivar` sai vazio quando bloqueado"

patterns-established:
  - "Serialização única consumida nos dois sentidos (export e diff) como forma de garantir ciclo fechado por construção, em vez de por comparação de valores tipados"
  - "Lista informativa paralela à lista acionável (candidatosArquivar vs arquivar) quando a tela precisa mostrar uma operação bloqueada sem executá-la"

requirements-completed: []

coverage:
  - id: D1
    description: "O parser de CSV sobrevive ao caso chato: separador dentro de aspas, aspas escapadas, quebra de linha dentro de campo, BOM, CRLF, última linha vazia, apóstrofo de guarda contra fórmula"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#csvParse: campo entre aspas contendo o separador volta inteiro"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#csvParse: aspas duplicadas dentro de campo entre aspas voltam como uma aspa só"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#csvParse: quebra de linha dentro de aspas não parte a linha em duas"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#csvParse: marca de ordem de byte na primeira célula não gruda no primeiro cabeçalho"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#csvParse: fim de linha estilo Windows não deixa retorno de carro no último campo"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#csvParse: apóstrofo inicial seguido de caractere de fórmula é removido; seguido de letra é preservado"
        status: pass
    human_judgment: false
  - id: D2
    description: "Exportar o inventário completo e reimportá-lo sem editar produz um plano com zero atualizações, zero criações, zero arquivamentos e zero erros, mesmo com aspas/separador/quebra de linha/decimal/hífen inicial na observação"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#ciclo fechado: montar o CSV de uma lista e reimportá-lo devolve plano zerado"
        status: pass
    human_judgment: false
  - id: D3
    description: "A chave (id) e as guardas de arquivamento: escopo derivado do conteúdo (não do chip/busca), três pré-condições, guarda de escala, presença nunca desarquiva/muda situação"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#escopo completo de fato (todos os instalados no arquivo) arquiva quem ficou de fora só quando exportado assim"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#linha de escopo ausente: arquivar sai vazio e o bloqueio é nomeado"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#qualquer linha recusada desliga o arquivamento do arquivo inteiro"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#contagem de instalados divergente da atual desliga o arquivamento"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#já removido, presente no arquivo, tem campos atualizados e situação intocada"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#guarda de escala: com 171 instalados, 18 ausentes passa e 19 é bloqueado; com 20 instalados o piso deixa passar 5"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-5hy-02/08 travadas por gate permanente: o núcleo puro nunca cita a baixa patrimonial nem referencia posição geográfica/vínculo organizacional"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#D-5hy-02: o núcleo puro nunca cita a palavra terminal de SITUACAO_ORDEM (a baixa patrimonial)"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#D-5hy-08: o núcleo puro não referencia coordenadas nem vínculo organizacional (limite de palavra)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Tela: botão na faixa do inventário antes de #btn-etiquetas; exportação exporta o filtrado; download com BOM por escape e revogação de URL; conferência nunca toca supa; gravação em três formas de chamada exatas, arquivamento com payload de uma chave"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js##btn-planilha existe, com aria-label e class sec-etq, antes de #btn-etiquetas na mesma .sec-head"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#baixarPlanilha grava a marca de ordem de byte como sequência de escape, o tipo com charset=utf-8, e revoga a URL do objeto"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#aplicarPlanoPlanilha: um plano com as três operações produz exatamente três formas de chamada, e o payload do arquivamento tem uma única chave cujo valor é o segundo item de SITUACAO_ORDEM"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-planilha.test.js#um erro na atualização de um id não impede a criação nem o arquivamento, e a mensagem final reporta a falha"
        status: pass
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — planilha do inventário: exportar e importar (22/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "A prova visual do painel, do escopo em palavras na tela, da conferência nominal completa e do resultado real após Aplicar (equipamento some do chip Todos e aparece em Removidos) exige sessão autenticada e navegador, fora do alcance deste executor autônomo. Roteiro de 10 passos documentado em TESTES.md."

duration: ~38min
completed: 2026-08-22
status: complete
---

# Quick Task 260822-5hy: Planilha do inventário da Refrigeração — exportar e importar — Summary

**`/refrigeracao` ganha exportação e importação em CSV do cadastro de 171 equipamentos, no modo mais perigoso dos três que o usuário poderia ter escolhido (atualizar + criar + arquivar por ausência) — depois de eu recomendar contra, por escrito, e ele escolher assim mesmo. O que este task entrega não é o modo seguro: é o modo perigoso tornado sobrevivível, com duas guardas estruturais (escopo derivado do conteúdo do arquivo, nunca do filtro da tela; teto de escala baseado em que este banco nunca registrou uma remoção) e uma tela de conferência nominal que nomeia, um a um, quem seria arquivado antes de qualquer gravação.**

## Performance

- **Duration:** ~38min
- **Completed:** 2026-08-22
- **Tasks:** 3/3 completas
- **Files modified:** 4 (1 criado: `tests/refrigeracao-planilha.test.js`; 3 modificados: `refrigeracao/index.html`, `CLAUDE.md`, `TESTES.md`)

## Accomplishments

- **Núcleo puro** (Tarefa 1): `csvParse` (máquina de estados de um caractere por vez — aspas escapadas, separador/quebra de linha dentro de campo, BOM, CRLF, apóstrofo de guarda contra fórmula desfeito só quando seguido de `=+-@`), `planilhaValor` (serialização única, consumida por exportação e diff), `montarCsv`, `mapearCabecalho`, `celulaParaValor` (datas por reconstrução, corrente com vírgula, três listas fechadas), `tetoArquivar` e `planoDeImportacao` — a função pura central que decide atualizar/criar/arquivar sem tocar DOM nem `supa`.
- **Exportação** (Tarefa 2): `#btn-planilha` na faixa do Inventário, antes de `#btn-etiquetas`, abrindo `abrirPainelPlanilha()` na gaveta — o painel diz o escopo em palavras ("completo, poderá arquivar" ou "parcial, nunca arquivará") antes de qualquer arquivo existir. `exportarInventarioCsv()` exporta o FILTRADO (mesma seleção da folha de etiquetas); `baixarPlanilha()` grava a marca de ordem de byte como sequência de escape (nunca colada literal) e revoga a URL do objeto no fim.
- **Importação** (Tarefa 3): `aoEscolherArquivoPlanilha()` lê o arquivo e monta o plano; `renderConferenciaPlanilha()` mostra a conferência nominal completa (arquivar primeiro, do mais perigoso ao menos — erros, atualizar, criar, ignorados) sem gravar nada; `aplicarPlanoPlanilha()` é a única porta de gravação, com o payload do arquivamento sendo uma única chave (`situacao`, sempre o segundo item de `SITUACAO_ORDEM` — nunca a baixa patrimonial).
- **As duas guardas que tornam o modo perigoso sobrevivível:** (1) o escopo `completo`/`parcial` é derivado por comparação de CONJUNTOS de ids contra `DATA`, nunca lido do chip/busca ativos — uma exportação filtrada nasce estruturalmente `parcial` e nunca chega a calcular arquivamento (Acidente A, impossível por construção); (2) guarda de escala `max(5, ceil(10% dos instalados))` — hoje 18 — bloqueia qualquer lote maior, com o número e o caminho alternativo (OS de movimentação) ditos na tela (Acidente B).
- `node --test`: 772/772 (762 de antes + 10 novos/movidos entre commits). Os quatro `grep -c` do congelamento D-04 continuam em 0. `tests/modulos-caminhos.test.js`: 19/19.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: núcleo puro da planilha (serializar, parsear, planejar) + gate comportamental** - `2d704e7` (feat)
2. **Tarefa 2: exportação — botão na faixa do inventário, painel da gaveta e download** - `3dde67c` (feat)
3. **Tarefa 3: importação — leitura do arquivo, tela de conferência, guardas e gravação** - `af76342` (feat)

**Plan pre-dispatch:** `90ce25e` (docs)

## Files Created/Modified

- `refrigeracao/index.html` — seção "planilha do inventário: núcleo puro" e "planilha do inventário: tela e gravação" no fim do último `<script>`; `#btn-planilha` na faixa do Inventário
- `tests/refrigeracao-planilha.test.js` — gate novo, 43 casos (parser, ciclo fechado, casamento/chave, tipos, arquivamento e guardas, estrutural D-5hy-02/08, tela de exportação, tela de importação/gravação)
- `CLAUDE.md` — parágrafo novo no bloco de `/refrigeracao` documentando a feature, as duas guardas estruturais e a decisão consciente do usuário contra minha recomendação
- `TESTES.md` — roteiro manual de 10 passos (ciclo fechado, edição de uma célula, escopo parcial nunca arquiva, guarda de escala em 20 vs 10 ausentes, colunas somente-leitura ignoradas, coluna desconhecida ignorada, observador sem bloco de importar, criação por id vazio)

## Decisions Made

Ver `key-decisions` no frontmatter — D-5hy-01 a D-5hy-25, todas travadas no próprio PLAN.md (as cinco primeiras vindas do usuário antes da execução) e seguidas à risca. Duas composições internas não previstas no pseudocódigo do plano, documentadas abaixo em Deviations — nenhuma delas reabre ou enfraquece uma decisão travada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/ajuste de composição] `montarCsv` precisa de `dados` (DATA inteiro), não só de uma contagem**
- **Found during:** Tarefa 1
- **Issue:** O pseudocódigo do plano descreve `montarCsv(lista, instaladosTotal, dataIso)`, mas também exige que `escopo=completo` saia de `escopoCompletoDe(lista, dados)` (D-5hy-14) — uma função que precisa do array `dados` inteiro para comparar conjuntos de ids, não de uma contagem isolada. As duas frases do próprio plano eram inconsistentes entre si.
- **Fix:** `montarCsv(lista, dados, dataIso)` recebe o array completo, computa `instaladosTotal` internamente (`dados.filter(equipInstalado).length`) e chama `escopoCompletoDe(lista, dados)` — sem introduzir estado nem quebrar o contrato de que a função é pura.
- **Files modified:** `refrigeracao/index.html`
- **Verification:** `tests/refrigeracao-planilha.test.js` — testes de ciclo fechado e de escopo completo/parcial exercitam a assinatura real.
- **Committed in:** `2d704e7` (parte do commit da Tarefa 1)

**2. [Rule 2 - Funcionalidade crítica ausente] `candidatosArquivar` — lista informativa separada de `arquivar`**
- **Found during:** Tarefa 3
- **Issue:** A Tarefa 1 estabeleceu (e testou) que `plano.arquivar` sai vazio sempre que uma guarda bloqueia o arquivamento. A Tarefa 3 exige que a tela de conferência mostre, "em tom neutro", a MESMA lista nominal de quem seria arquivado mesmo quando bloqueado — informação que `plano.arquivar` vazio não carrega mais nesse ponto.
- **Fix:** Adicionado `plano.candidatosArquivar` ao núcleo (Tarefa 1, já commitada) — sempre populada com a lista de candidatos por ausência, independente do resultado das guardas; `plano.arquivar` continua vazio quando bloqueado (contrato original intacto, testes da Tarefa 1 seguem passando sem alteração). `renderConferenciaPlanilha` lê `candidatosArquivar` só no ramo bloqueado.
- **Files modified:** `refrigeracao/index.html`
- **Verification:** Testes da Tarefa 1 (arquivar vazio quando bloqueado) continuam verdes sem modificação; teste estrutural novo confere que `renderConferenciaPlanilha` nunca toca `supa`.
- **Committed in:** `af76342` (parte do commit da Tarefa 3, editando a função já commitada em `2d704e7`)

---

**Total deviations:** 2 auto-fixados (Rule 1 e Rule 2)
**Impact on plan:** Nenhuma decisão travada (D-5hy-01 a D-5hy-25) foi alterada, reaberta ou enfraquecida — os dois ajustes são de composição interna entre funções, necessários para o pseudocódigo do próprio plano fazer sentido enquanto sistema (a Tarefa 3 depende de dados que a Tarefa 1, escrita antes, precisava expor). Sem escopo criado além do pedido.

## Issues Encountered

- Comparações `assert.deepEqual`/`deepStrictEqual` do `node:assert/strict` contra literais do realm principal falham com "mesma estrutura, não referência-igual" quando o valor real vem de dentro do sandbox `node:vm` (armadilha já documentada em `tests/refrigeracao-encerramento-os.test.js`) — resolvido com um helper `eq()` que compara pela forma serializada (`JSON.stringify`), sem prototype nenhum envolvido. Nenhum código de produção foi afetado, só o teste.
- A marca de ordem de byte (`﻿`) precisou ser escrita explicitamente como sequência de escape em `baixarPlanilha()` — uma primeira tentativa colou o caractere literal (invisível no editor), o que violaria D-5hy-13's exigência textual e teria sido apagado sem aviso pela próxima pessoa a editar o arquivo. Corrigido antes do commit da Tarefa 2, com um gate estrutural que garante `﻿` como escape e recusa o caractere colado.

## User Setup Required

None - nenhuma migração, nenhuma dependência nova, nenhuma configuração externa. A feature funciona assim que o deploy for publicado.

## Next Phase Readiness

- `node --test`: 772/772, 0 falhas
- Os quatro `grep -c` do congelamento D-04 em `refrigeracao/index.html`: 0/0/0/0
- `tests/modulos-caminhos.test.js`: 19/19 (nenhum caminho de asset novo fora da forma absoluta de raiz)
- `git status` não mostra nada em `supabase/` — nenhuma migração, nenhum SQL novo
- `/home/luc/DEV_ERP` não foi tocado
- **Pendente de verificação manual:** roteiro de 10 passos em `TESTES.md` ("Refrigeração — planilha do inventário: exportar e importar") — exige sessão autenticada real (Gestor/Admin) contra o Supabase, fora do alcance deste executor autônomo. Cobre especificamente: ciclo fechado, edição de uma célula, escopo parcial nunca arquiva, guarda de escala (20 vs 10 ausentes), colunas somente-leitura ignoradas, coluna desconhecida ignorada, bloco de importar ausente para observador, e criação por id vazio.

## Self-Check: PASSED

- `tests/refrigeracao-planilha.test.js` confirmado em disco.
- Os 3 commits de task (`2d704e7`, `3dde67c`, `af76342`) confirmados em `git log`.
- `node --test`: 772/772 verde.
- Os quatro `grep -c` do congelamento D-04 em `refrigeracao/index.html`: 0/0/0/0.
- `git status` sem arquivos em `supabase/`.
