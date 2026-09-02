---
phase: quick
plan: 260826-6wy
subsystem: ui
tags: [refrigeracao, estoque, materiais, catalogo, baixa-estoque, supabase, rls-pendente]

requires: []
provides:
  - "materiais (catálogo) e estoque_movimentos (histórico) em supabase/44_refrigeracao_estoque.sql, aditiva, escrita e conferida, NÃO aplicada — os_itens.material_id como vínculo anulável"
  - "EST_OK (estSondarEsquema): sonda própria dentro do recorte \"── fluxo da OS interna: porta de escrita ──\" (D-6wy-08) — sem a migração 44 a tela publicada continua byte a byte como hoje, e os cinco gates existentes que já carregam esse recorte recebem a sonda desligada de graça"
  - "CAMPOS_MATERIAL/dbToMaterial/materialParaDb: ponte única camelCase↔coluna para materiais, conferida coluna a coluna contra a migração 44 (D-6wy-11)"
  - "estItensParaBaixa/estAbaixoDoMinimo/estMotivoDaOS/estRotuloMaterial: núcleo puro sem API de navegador, testável em node:vm"
  - "estBaixarItensDaOS: baixa idempotente na entrada em EM_EXECUCAO, consolidada por material (D-6wy-10), conferida contra o registro do próprio estoque_movimentos (nunca uma bandeira do cliente), saldo nunca abaixo de zero"
  - "osItensHtml/osSeletorMaterialHtml/estPreencherItemDaOS/osAddItem: item de OS escolhido do catálogo, com descrição/unidade/valor preenchidos, material_id só no payload quando escolhido (D-6wy-12) — texto livre continua byte a byte"
  - "renderEstoque/estInjectNav: página Estoque em cartão nas duas larguras (D-6wy-09), botão de navegação injetado em runtime (D-6wy-07) — #bottom-nav continua com cinco .nav-btn na marcação estática"
  - "estAlertaHtml: seção \"Estoque abaixo do mínimo\" nos dois ramos de renderAlerts, sem alterar a contagem do distintivo de alertas"
affects: [refrigeracao]

tech-stack:
  added: []
  patterns:
    - "Sonda de esquema (estSondarEsquema) + flag EST_OK, dentro do recorte da porta de escrita — mesmo idioma de manSondarEsquema/movSondarEsquema/uniSondarEsquema já em uso"
    - "Ponte de campos única (CAMPOS_MATERIAL) testada coluna a coluna contra a migração — mesma lição paga em /calibracao"
    - "Página em cartão nas duas larguras (nunca tabDesenhar) quando a folha de tabela só existe dentro do @media de computador — precedente ctRenderSaldo"
    - "Edição inline redesenha só a linha afetada (estRedesenharLinha), nunca a lista inteira — lição paga por Máquinas ao partir renderMateriais()"

key-files:
  created:
    - supabase/44_refrigeracao_estoque.sql
    - tests/refrigeracao-estoque.test.js
  modified:
    - refrigeracao/index.html
    - tests/refrigeracao-modo-observador.test.js
    - CLAUDE.md
    - README.md
    - TESTES.md

key-decisions:
  - "D-6wy-01 a D-6wy-06 (do usuário, travadas no PLAN.md): migração 44, item de OS do catálogo, baixa idempotente na entrada em execução, página Estoque, alerta abaixo do mínimo, sonda EST_OK"
  - "D-6wy-07: botão de Estoque INJETADO em runtime (estInjectNav) — dois gates afirmam exatamente cinco .nav-btn em #bottom-nav, e \"sem migração 44, sem botão\" fica estrutural, não escondido por CSS"
  - "D-6wy-08: EST_OK/MATERIAIS/núcleo puro nascem DENTRO do recorte \"── fluxo da OS interna: porta de escrita ──\" — os cinco gates que já carregam esse recorte recebem a sonda desligada de graça, sem uma linha mudada"
  - "D-6wy-09: página Estoque é lista de cartões nas DUAS larguras, nunca tabDesenhar — .lista-tabela só existe no @media de computador, e edição inline não sobrevive a uma tabela que se redesenha a cada tecla"
  - "D-6wy-10: estItensParaBaixa consolida por material — duas linhas do mesmo material na mesma OS produzem um decremento e uma linha de saída só"
  - "D-6wy-11: CAMPOS_MATERIAL é a única ponte, comparada coluna a coluna com a migração 44 pelo gate (lição de /calibracao: campo fora do mapa grava null sem erro)"
  - "D-6wy-12: material_id só entra no payload de osAddItem quando um material foi escolhido — texto livre continua byte a byte o payload de hoje"
  - "D-6wy-13 (limite conhecido, registrado, não resolvido): voltar de EM_EXECUCAO para trás não estorna o estoque — a peça já saiu de verdade; correção é uma entrada registrada à mão na página Estoque"
  - "D-6wy-14: índice composto (os_id, tipo) em estoque_movimentos — a sonda de idempotência filtra pelos dois, e a coluna líder já serve de índice da FK"
  - "D-6wy-15: estoque_movimentos.os_id é on delete set null — o módulo apaga linha de OS, e o movimento de estoque sobrevive (a peça saiu de verdade)"

patterns-established:
  - "Núcleo puro autossuficiente (estRotuloMaterial não chama fmtMoney, definida bem mais adiante no arquivo) para o gate poder testar o comportamento carregando só o recorte da porta de escrita, sem ReferenceError de sandbox"

requirements-completed: [D-6wy-01, D-6wy-02, D-6wy-03, D-6wy-04, D-6wy-05, D-6wy-06]

coverage:
  - id: D-6wy-01/06/11
    description: "Migração 44 escrita, aditiva, com CAMPOS_MATERIAL conferida coluna a coluna, e EST_OK mantendo a tela byte a byte sem a migração"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#migração 44: materiais tem exatamente as onze colunas — nem mais, nem menos"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#CAMPOS_MATERIAL: toda coluna de materiais na migração 44 aparece como valor no mapa"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#CAMPOS_MATERIAL: todo valor do mapa é uma coluna que a migração 44 declara"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#estSondarEsquema(): devolve false, sem lançar, quando a leitura falha"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#carregarMateriais(): com EST_OK falso não consulta nada e deixa MATERIAIS vazio"
        status: pass
    human_judgment: false
  - id: D-6wy-02/12
    description: "Item de OS escolhido do catálogo — descrição/unidade/valor preenchidos, material_id só quando escolhido, texto livre inalterado"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#osItensHtml: com EST_OK falso, o formulário de item não contém nenhum identificador novo (byte a byte o de hoje)"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#osAddItem sem material escolhido: payload byte a byte o de hoje (sem a chave material_id) — D-6wy-12"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#osAddItem com material escolhido: inclui material_id e a unidade do catálogo, valor unitário do momento do lançamento"
        status: pass
    human_judgment: false
  - id: D-6wy-03/10/13
    description: "Baixa idempotente ao entrar em EM_EXECUCAO, consolidada por material, nunca abaixo de zero, sem estorno automático ao voltar"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#manAtualizarOS: com EST_OK falso, EM_EXECUCAO não consulta nem escreve nada de estoque"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#manAtualizarOS: repetir a mesma transição com saída já existente para o os_id não grava nada e não altera saldo"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#manAtualizarOS: estoque_atual atualizado para atual - quantidade, nunca abaixo de zero"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#manAtualizarOS: falha do insert do movimento não derruba a transição — devolve true, toast de sucesso uma vez (D-jpd-05)"
        status: pass
    human_judgment: false
  - id: D-6wy-04/07/09
    description: "Página Estoque alcançável pela navegação injetada, cartão nas duas larguras, edição inline por linha, cadastro e entrada"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#estInjectNav: com EST_OK true, cria um .nav-btn que chama navTo('estoque',…); chamar duas vezes não duplica"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#renderEstoque: a lista não consulta TELA_LARGA — a mesma nas duas larguras"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#estSalvarLinha: grava atual/mínimo/preço, recusa valores negativos, recusa cargo sem a ação, recarrega o catálogo"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#estSalvarMaterial: insere quando não há id em edição e atualiza quando há; recusa sem podeEditarCadastro; recusa nome vazio; passa por materialParaDb"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#estRegistrarEntrada: recusa quantidade zero/negativa, recusa cargo sem a ação, grava entrada com o motivo digitado, soma ao estoque_atual, não toca em os_id nenhum"
        status: pass
    human_judgment: false
  - id: D-6wy-05
    description: "Alerta \"Estoque abaixo do mínimo\" nos dois ramos de Alertas, sem alterar o distintivo"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#estAlertaHtml: com EST_OK true e materiais abaixo do mínimo, devolve título, contagem, uma linha por material, e onclick leva à página Estoque"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-estoque.test.js#renderAlerts: atualizarBadgeAlertas(ag) continua aparecendo exatamente duas vezes — o distintivo não muda por causa do estoque"
        status: pass
    human_judgment: false
  - id: D6
    description: "Roteiro manual completo contra produção depois de aplicar a migração 44: cadastro, item pelo catálogo, baixa única, idempotência, entrada, alerta nas duas larguras"
    verification: []
    human_judgment: true
    rationale: "Migração 44 ainda não aplicada em produção (escrita apenas, por decisão do plano — quem aplica é o usuário, depois do deploy do frontend). A prova visual da tela publicada antes/depois da migração e o fluxo completo com sessão autenticada real exigem o SQL rodado e credenciais reais, fora do alcance deste executor autônomo. Roteiro documentado em TESTES.md."

duration: ~50min
completed: 2026-08-26
status: complete
---

# Quick Task 260826-6wy: Estoque de peças e materiais (`/refrigeracao`) — Summary

**`/refrigeracao` deixa de ser o único módulo da plataforma que faz manutenção sem catálogo: ganha `materiais` (catálogo), `estoque_movimentos` (histórico), item de OS escolhido do estoque em vez de texto livre com valor digitado, baixa idempotente na entrada em execução, página Estoque com edição inline/cadastro/entrada, e alerta abaixo do mínimo — tudo sobre uma migração ainda não aplicada e uma tela publicada que continua se comportando byte a byte como hoje enquanto ela não roda.**

## Performance

- **Duration:** ~50min
- **Completed:** 2026-08-26
- **Tasks:** 4/4 completas
- **Files modified:** 7 (2 criados: `supabase/44_refrigeracao_estoque.sql`, `tests/refrigeracao-estoque.test.js`; 5 modificados)

## Accomplishments

- `supabase/44_refrigeracao_estoque.sql`: `materiais` (catálogo, 11 colunas, tipo consumível|peça, checks de não-negativo) e `estoque_movimentos` (histórico, tipo entrada|saída, quantidade > 0) sem prefixo (convenção do módulo), `os_itens.material_id` anulável, índices (incluindo o composto `(os_id, tipo)` de D-6wy-14), RLS leitura pública/escrita autenticada, grants de sequence, bloco de conferência comentado. Escrita, aditiva, **nunca aplicada** por este executor.
- `EST_OK`/`estSondarEsquema`: sonda própria dentro do recorte da porta de escrita (D-6wy-08) — os cinco gates que já carregam esse recorte (os-pagina, desktop, trilha-os, fluxo-os-interna, os-unificada, encerramento-os) recebem a sonda desligada de graça, nenhum precisou de uma linha mudada.
- `CAMPOS_MATERIAL`/`dbToMaterial`/`materialParaDb`/`MATERIAIS`/`carregarMateriais`: ponte e catálogo em memória, carregados fora do `Promise.all` principal, guardados por `EST_OK`.
- Núcleo puro (`estItensParaBaixa`, `estAbaixoDoMinimo`, `estMotivoDaOS`, `estRotuloMaterial`): sem API de navegador, `estRotuloMaterial` deliberadamente sem depender de `fmtMoney` (definida bem mais adiante no arquivo) para o gate testar o comportamento carregando só o recorte da porta de escrita.
- `estJaBaixadoDaOS`/`estBaixarItensDaOS`: baixa consolidada por material, idempotente contra `estoque_movimentos` (nunca uma bandeira paralela), saldo `max(0, atual - quantidade)`, erro de escrita vira `console.warn` sem derrubar a transição já ocorrida. `manAtualizarOS` chama num ponto só, logo após a trilha de sistema, só em `EM_EXECUCAO`.
- `osSeletorMaterialHtml`/`estPreencherItemDaOS`/`osItensHtml`/`osAddItem`/`osAddItemUI`/`dbToItem`: seletor do catálogo concatenado só quando `EST_OK` (texto livre primeiro, material arquivado fora); escolher preenche descrição/valor/tipo; `material_id` no payload só quando escolhido (D-6wy-12); linha renderizada mostra o código do material quando veio do catálogo.
- `<div class="page" id="page-estoque">` (irmã de `page-alert`, sem CSS próprio), `estInjectNav` (botão injetado em runtime, guardado por `EST_OK`, sem duplicar), `MAN_ACOES_CARGO.estoque` (admin/gestor/tecnico), despacho em `navTo`/`renderPaginaAtiva`.
- `renderEstoque`/`estLinhaHtml`/`estLinhaEdicaoHtml`/`estRedesenharLinha`: lista de cartões nas duas larguras (D-6wy-09), edição inline redesenha só a linha afetada. `openMaterialForm`/`estSalvarMaterial` (cadastro, insere ou atualiza por `EST_MATERIAL_EDIT_ID`), `openEntradaForm`/`estRegistrarEntrada` (recebimento, nunca vínculo com OS), `estSalvarLinha` (atual/mínimo/preço) — todos guardados na ação (D-l7n-03), nunca só no botão.
- `estAlertaHtml`: seção "Estoque abaixo do mínimo" calculada uma vez, concatenada nos dois ramos de `renderAlerts` (tabela de computador e cartões de celular), sem alterar `atualizarBadgeAlertas` (continua contando equipamento, não peça).
- `node --test tests/*.test.js`: **1032/1032** (958 de antes + 74 novos), 0 falhas. Nenhum fixture tocado (`refrigeracao-os-gaveta.json`/`refrigeracao-css-mobile.css` fora do `git diff --numstat`).

## Task Commits

1. **Task 1: migração 44, sonda EST_OK, catálogo em memória e núcleo puro — nenhuma interface ainda** — RED `d819612` (test), GREEN `9f7ee1a` (feat)
2. **Task 2: baixa idempotente ao entrar em EM_EXECUCAO, e item de OS escolhido do catálogo** — RED `2ee9fe0` (test), GREEN `38f1064` (feat)
3. **Task 3: página Estoque — navegação injetada, lista, edição inline, cadastro e entrada** — RED `959797e` (test), GREEN `8d104cc` (feat)
4. **Task 4: alerta abaixo do mínimo, documentação e suíte verde** — RED `68f79dd` (test), GREEN `5a683d7` (feat), `88383d8` (docs)

## Files Created/Modified

- `supabase/44_refrigeracao_estoque.sql` — migração aditiva nova, escrita e conferida por teste, **não aplicada**
- `refrigeracao/index.html` — sonda/catálogo/núcleo puro/baixa dentro da porta de escrita; seletor de material no formulário de item; página Estoque completa; alerta em `renderAlerts`; `MAN_ACOES_CARGO`, `navTo`, `renderPaginaAtiva`, `acessoLivre`, `initAppOnce` ajustados
- `tests/refrigeracao-estoque.test.js` — gate novo, 74 casos (migração por regex, ponte de campos, núcleo puro em `node:vm`, sonda/carga/baixa/formulário/página/alerta com `supa` dublado)
- `tests/refrigeracao-modo-observador.test.js` — stubs de `estSondarEsquema`/`estInjectNav`/`carregarMateriais` no sandbox de `acessoLivre()` (mesmo motivo de `uniSondarEsquema`, D-cf8-28 — nenhum caso apagado)
- `CLAUDE.md` — parágrafo de arquitetura e entrada em "Known pendências"
- `README.md` — entrada em Pendências com o roteiro pós-aplicação e o limite conhecido
- `TESTES.md` — seção nova, Parte 1 (sem a migração 44) e Parte 2 (depois de aplicada)

## Decisions Made

Ver `key-decisions` no frontmatter — D-6wy-01 a D-6wy-06 do usuário (travadas no PLAN.md), D-6wy-07 a D-6wy-15 do planejador (registradas no PLAN.md, seguidas à risca). Nenhuma decisão de arquitetura nova tomada durante a execução — só as correções de teste documentadas abaixo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug de teste] Testes com asserções que não refletiam o HTML real produzido**
- **Encontrado em:** Task 2 (`osItensHtml: com EST_OK true, o seletor traz "Texto livre" primeiro…`) e Task 3 (`renderEstoque: desenha uma linha por material ativo…`)
- **Problema:** o primeiro buscava `value="1"` no HTML inteiro e batia primeiro no `value="1"` do campo de quantidade (que vem antes do seletor de material na marcação), não na opção do seletor; o segundo buscava `>8<`/`>2<` onde o HTML real produz `"8 / mín 2"`.
- **Correção:** o primeiro passou a escopar a busca dentro do próprio `<select id="oi-un-mat">…</select>`; o segundo passou a checar o texto real (`8 / mín 2`, `R$ 12,50`, `(un)`).
- **Arquivos:** `tests/refrigeracao-estoque.test.js`
- **Commits:** `38f1064`, `8d104cc`

**2. [Rule 1 - Bug de teste/sandbox] Dois gates existentes quebrando por dependência não estubada**
- **Encontrado em:** Task 1 (`estSondarEsquema`/`carregarMateriais`) e Task 3 (`estInjectNav`)
- **Problema:** `tests/refrigeracao-modo-observador.test.js` carrega `acessoLivre()` real num sandbox com stubs de todas as suas chamadas (mesma técnica de `uniSondarEsquema` para D-cf8) — as três funções novas que `acessoLivre()` passou a chamar não existiam no sandbox, produzindo `ReferenceError` capturado pelo `try/catch` de `acessoLivre()`, que abortava antes de `entrarModoObservador()` — o teste falhava porque o modo observador nunca ligava.
- **Fix:** três stubs de uma linha cada (`estSondarEsquema`, `carregarMateriais`, `estInjectNav`), no mesmo padrão de `uniSondarEsquema`/`osInjectChipsExecutor` já presentes.
- **Arquivos:** `tests/refrigeracao-modo-observador.test.js`
- **Commits:** `9f7ee1a`, `8d104cc`

Nenhuma outra reescrita de teste existente foi necessária (D-cf8-28: nenhum caso apagado).

## Issues Encountered

Nenhum além dos dois itens de Deviations acima — ambos corrigidos durante o próprio ciclo TDD (RED → correção do teste → GREEN), sem afetar o código de produção.

## User Setup Required

**Migração `supabase/44_refrigeracao_estoque.sql` precisa ser rodada no SQL editor do Supabase, DEPOIS do deploy do frontend** (mesma ordem de D-cf8-25/D-q57-06/D-uyz-24). Até lá, o frontend publicado continua se comportando byte a byte como hoje (`EST_OK` falso: sem botão de Estoque, sem catálogo no formulário de item, sem baixa, sem alerta) — testado nos dois lados. Depois de aplicada, seguir o roteiro em duas partes de `TESTES.md` ("Refrigeração — estoque de peças e materiais").

## Next Phase Readiness

- `node --test tests/*.test.js`: 1032/1032, 0 falhas
- `git diff --stat` (fora de `.planning/`) toca só `refrigeracao/index.html`, `supabase/44_refrigeracao_estoque.sql`, `CLAUDE.md`, `README.md`, `TESTES.md` e dois arquivos de teste — nada em `shared/`, `maquinas/`, `mapa/`, `reparos/` ou `calibracao/`
- Nenhuma menção a `maq_materiais`/`transp_materiais` em `refrigeracao/index.html`; nenhum `import` de `shared/`
- `tests/fixtures/refrigeracao-os-gaveta.json` e `tests/fixtures/refrigeracao-css-mobile.css` fora do `git diff --numstat` da tarefa inteira — a gaveta da OS e o CSS fora de `@media` ficaram byte a byte
- **Limite conhecido, registrado, não resolvido (D-6wy-13):** voltar de `EM_EXECUCAO` para trás não estorna o estoque automaticamente — a correção é uma entrada registrada à mão na página Estoque. Documentado em `CLAUDE.md`, `README.md` e `TESTES.md`.
- **Fora de escopo por decisão do usuário, para a próxima task:** pedidos de material e listas de compra — nem tabela, nem tela, nem função foram criadas.
- **Migração 44:** escrita e conferida por teste (colunas, checks, índices, RLS), **ainda não aplicada** em produção — próximo passo é o usuário rodá-la e seguir o roteiro em `TESTES.md`.

## Self-Check: PASSED

- `supabase/44_refrigeracao_estoque.sql` confirmado em disco.
- `tests/refrigeracao-estoque.test.js` confirmado em disco.
- Os 9 commits de task (`d819612`, `9f7ee1a`, `2ee9fe0`, `38f1064`, `959797e`, `8d104cc`, `68f79dd`, `5a683d7`, `88383d8`) confirmados em `git log`.
- `node --test tests/*.test.js`: 1032/1032 verde.
- `supabase/44_refrigeracao_estoque.sql`: sem `drop` fora de `drop policy if exists` (conferido por grep e pelo gate).
- `git diff --numstat` (fora de `.planning/`) não lista `tests/fixtures/refrigeracao-os-gaveta.json` nem `tests/fixtures/refrigeracao-css-mobile.css`.
