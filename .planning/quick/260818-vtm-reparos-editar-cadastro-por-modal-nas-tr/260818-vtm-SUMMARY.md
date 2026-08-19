---
phase: quick
plan: 260818-vtm
subsystem: ui
tags: [reparos, maquinas, nucleo-puro, ordenacao, filtro, agrupamento, rbac]

requires: []
provides:
  - "Núcleo genérico de ordenação e filtro por definição de colunas em shared/tabela.js, consumido por Máquinas (adaptador) e por Reparos"
  - "As três tabelas de /reparos (Reparos, Serviços, Modelos) editam cadastro pelo modal já existente, com botão ⚙ na célula de ações sob o mesmo gate que já governava o botão de criar"
  - "As três tabelas ordenam (3 estados, numérico/textual pt-BR, vazios no fim) e filtram (substring sem acento/caixa, acumulável) por coluna, de tela"
  - "Reparos, Serviços e Modelos mostram 5, 4 e 4 colunas mais ações (eram 8, 6 e 7), sem perder dado de vista nem de alcance do filtro"
  - "Controle único de tipo/modelo (categorias de rep_modelos + modelos) filtra e agrupa as três abas ao mesmo tempo"
affects: [reparos, maquinas]

tech-stack:
  added: []
  patterns:
    - "Núcleo-puro/aplicador-de-DOM promovido a compartilhado: shared/tabela.js nasceu em maquinas/estoque-tabela.js (quick-260818-twm) e agora serve dois módulos via adaptador fino, mesmo corte de shared/tema.js e mapa/mapa-geometria.js"
    - "reparos/tabelas.js segue o mesmo padrão para o módulo novo: definição de colunas + construtor de linha de exibição + vocabulário/predicados/agrupamento, tudo puro"
    - "renderX() vira renderCabecalhoX() + renderLinhasX() nas três tabelas de Reparos, replicando o corte já estabelecido em maquinas/app.js — digitar num filtro só redesenha o corpo"
    - "Handlers genéricos parametrizados pela tabela (ordenarTabelaReparos(tabela,...), etc.) — uma implementação só serve as três abas"

key-files:
  created:
    - shared/tabela.js
    - reparos/tabelas.js
    - tests/tabela-compartilhada.test.js
    - tests/reparos-tabelas.test.js
  modified:
    - maquinas/estoque-tabela.js
    - reparos/app.js
    - reparos/index.html

key-decisions:
  - "shared/tabela.js é dirigido por definição de colunas passada como último parâmetro (comparar(a,b,coluna,dir,colunas), aplicarOrdemEFiltro(lista,ord,filtros,colunas)) — nenhum nome de campo de material ou de reparo aparece no núcleo (D2)"
  - "maquinas/estoque-tabela.js vira adaptador fino: reexporta proximaOrdem/normalizarBusca tal como estão e envolve as duas funções dirigidas por colunas em wrappers que injetam COLUNAS_ESTOQUE, preservando as quatro assinaturas de ontem — tests/estoque-cabecalho-maquinas.test.js passou sem uma linha alterada"
  - "Os três salvar*() de Reparos recusam a operação (criação OU edição) quando o cargo não passa no gate da tabela — diferente do precedente de Máquinas (salvarMaterial(), que só guarda o ramo de edição), porque aqui a checagem espelha 1:1 a RLS real da migração 26 (T-vtm-01) e o botão de criar já era escondido para quem não tem o cargo"
  - "O texto() de cada coluna agrupada carrega todos os dados que a célula mostra (fabricante/modelo, causa provável, gravidade, valor-hora) — é o que mantém filtrável e ordenável o dado que perdeu coluna própria (D3)"
  - "Controle de tipo/modelo é um só par de estado (TIPO_SELECIONADO/AGRUPAR_POR_TIPO) para as três abas — um controle único com três apresentações, não três estados independentes (D4)"
  - "Reparo sem modelo nunca é filtrado fora por tipo — regra preservada literalmente do reparosFiltrados() do Diagnóstico, agora também em filtroTipoReparos()"
  - "Serviço agrupado por mais de uma categoria cai num grupo único 'Vários tipos' em vez de duplicado em cada categoria — duplicar mentiria sobre a contagem de cada grupo"

patterns-established:
  - "Um módulo que precisa de tabela ordenável/filtrável não duplica o núcleo — importa shared/tabela.js e escreve só a definição de colunas e os construtores de linha (reparos/tabelas.js é o segundo exemplo depois de maquinas/estoque-tabela.js)"

requirements-completed: []

coverage:
  - id: D1
    description: "As três tabelas de /reparos editam cadastro pelo modal que já existia (criação-ou-edição pelo mesmo abridor), sob os cargos que já governavam cada tabela"
    verification:
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#os três abrirModal*(id) aceitam id opcional e escrevem título de criação ou edição"
        status: pass
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#os três salvar*() recusam a operação quando o cargo não passa no gate da tabela, antes de montar o payload"
        status: pass
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#os três salvar*() fazem update filtrado pelo id em edição quando há um, e insert quando não há"
        status: pass
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#renderLinhasReparos() escreve o ⚙ sob podeConhecimento() e interrompe a propagação do clique da linha"
        status: pass
    human_judgment: false
  - id: D2
    description: "Núcleo de ordenação e filtro único em shared/tabela.js, dirigido por definição de colunas, consumido por Máquinas e /reparos, gate do Estoque intocado"
    verification:
      - kind: unit
        ref: "tests/tabela-compartilhada.test.js#coluna desconhecida devolve 0 no comparador e é ignorada no filtro"
        status: pass
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js (26/26, arquivo não alterado)"
        status: pass
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#as três tabelas se separam em par cabeçalho/corpo, como renderMateriais() em maquinas/app.js"
        status: pass
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#digitar num filtro chama só a função de corpo — não reescreve o cabeçalho e não perde foco/cursor"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reparos, Serviços e Modelos mostram 5, 4 e 4 colunas mais ações; dado que perdeu coluna própria continua filtrável/ordenável pela coluna que o contém"
    verification:
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#COLUNAS_REPAROS tem 5 colunas, COLUNAS_SERVICOS 4, COLUNAS_MODELOS 4"
        status: pass
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#causa provável, gravidade, peças e serviços continuam alcançáveis pelo filtro da coluna que os contém (D3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Controle único de tipo/modelo filtra e agrupa as três abas; reparo sem modelo nunca filtrado fora; agrupamento com grupo de ausência por último"
    verification:
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#filtroTipoReparos: reparo sem modelo passa sempre; com modelo, passa pelo modelo ou pela categoria escolhida"
        status: pass
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#agrupar(): ordena os grupos pelo rótulo em pt-BR, grupo de ausência por último, ordem de entrada preservada dentro do grupo"
        status: pass
      - kind: unit
        ref: "tests/reparos-tabelas.test.js#chaveGrupoServicos: serviço usado por mais de uma categoria cai em \"Vários tipos\"; sem vínculo, no grupo de ausência"
        status: pass
    human_judgment: false
  - id: D5-verificacao-visual
    description: "Conferência manual no navegador (⚙ abre modal preenchido, ordenar cicla, ⌕ mantém foco, filtro por coluna agrupada encontra a linha, tipo/modelo filtra e agrupa as três abas; Estoque de Máquinas continua igual)"
    verification: []
    human_judgment: true
    rationale: "Plano type=execute autonomous sem checkpoint de verificação humana e sem credenciais Supabase neste ambiente. Verificado por outros meios: (1) node -e import('./reparos/app.js') confirma que o grafo de módulos (shared/tabela.js → reparos/tabelas.js → reparos/app.js) resolve sem SyntaxError, falhando só no ponto esperado (window is not defined, fora de qualquer navegador); (2) os quatro arquivos novos/alterados respondem HTTP 200 com Content-Type text/javascript pelo mesmo `python -m http.server` usado em produção estática, confirmando que chegam ao navegador como ES module e não só existem no disco. A interação de fato (clique, digitação, login por cargo) não foi observada — Playwright não está instalado neste ambiente e instalar um pacote novo está fora do escopo desta quick task."

duration: ~90min
completed: 2026-08-18
status: complete
---

# Quick Task 260818-vtm: Reparos — edição por modal, ordenação/filtro por coluna e agrupamento por tipo — Summary

**O núcleo de ordenação/filtro do Estoque de Máquinas vira genérico em `shared/tabela.js`; as três tabelas de /reparos (Reparos, Serviços, Modelos) ganham edição de cadastro pelos modais já existentes, ordenação e filtro por coluna com colunas densas, e um controle único de tipo/modelo que filtra e agrupa as três abas ao mesmo tempo.**

## Performance

- **Duration:** ~90min
- **Completed:** 2026-08-18
- **Tasks:** 3/3 completas
- **Files modified:** 7 (4 criados: `shared/tabela.js`, `reparos/tabelas.js`, `tests/tabela-compartilhada.test.js`, `tests/reparos-tabelas.test.js`; 3 modificados)

## Accomplishments

- `shared/tabela.js` (núcleo puro, sem API de navegador): `proximaOrdem()`, `normalizarBusca()`, `comparar(a,b,coluna,dir,colunas)` e `aplicarOrdemEFiltro(lista,ord,filtros,colunas)`, dirigido por definição de colunas — nenhum campo de domínio escrito no arquivo
- `maquinas/estoque-tabela.js` reduzido a `COLUNAS_ESTOQUE` mais um adaptador fino que injeta essa definição no núcleo genérico, preservando as quatro assinaturas de ontem — `tests/estoque-cabecalho-maquinas.test.js` passa sem uma linha alterada (26/26)
- Os três `abrirModal*(id)`/`salvar*()` de Reparos, Serviços e Modelos passam a criar ou editar; guarda de cargo (`podeConhecimento`/`podeCatalogo`) é a primeira linha de código de cada `salvar*()`, espelhando a RLS real da migração 26; botão `⚙` na célula de ações de cada linha, sob o mesmo gate que já escondia o botão de criar; `fecharModal()` zera o id de edição do modal correspondente
- `reparos/tabelas.js` (núcleo puro, mesmo padrão): `COLUNAS_REPAROS` (5), `COLUNAS_SERVICOS` (4), `COLUNAS_MODELOS` (4), com construtores de linha de exibição (`linhasReparos`/`linhasServicos`/`linhasModelos`) que carregam nas células agrupadas todo dado que perdeu coluna própria
- As três tabelas viram par cabeçalho/corpo (`renderCabecalhoX()`/`renderLinhasX()`, mesmo corte de `maquinas/app.js`), com `theads` dinâmicos por id, estado de ordem/filtro independente por aba e handlers genéricos parametrizados pela tabela (`ordenarTabelaReparos`, `filtrarColunaTabelaReparos`, `aplicarFiltroTabelaReparos`, `limparFiltrosTabelaReparos`)
- D4: vocabulário fechado de categoria (`rotuloTipo`), `opcoesTipoMaquina()` construída a partir dos dados, predicados de filtro por tipo/modelo em cada aba e `agrupar()`/`chaveGrupo*` com grupo de ausência sempre por último; controle único (`TIPO_SELECIONADO`/`AGRUPAR_POR_TIPO`) compartilhado pelas três abas
- CSS compacto (linha secundária de célula, `.linha-grupo`, controles de tipo) inteiramente no `<style>` de `reparos/index.html` — `shared/pmoc.css` intocado
- `node --test`: 384/384 (279 de antes + 105 novos entre `tests/tabela-compartilhada.test.js` e `tests/reparos-tabelas.test.js`)

## Task Commits

1. **Task 1: núcleo de tabela promovido a shared/tabela.js e edição de cadastro pelos três modais de /reparos (D1, D2)** - `3bbf3d9` (feat)
2. **Task 2: ordenação e filtro por coluna nas três tabelas de /reparos, com colunas densas (D2, D3)** - `4fa5b44` (feat)
3. **Task 3: filtro e agrupamento por tipo de máquina nas três abas de /reparos (D4)** - `f0f3b56` (feat)

## Files Created/Modified

- `shared/tabela.js` — núcleo puro genérico, novo
- `reparos/tabelas.js` — núcleo puro do módulo /reparos (colunas, construtores de linha, vocabulário/predicados/agrupamento de D4), novo
- `maquinas/estoque-tabela.js` — reduzido a `COLUNAS_ESTOQUE` + adaptador sobre `shared/tabela.js`
- `reparos/app.js` — três `abrirModal*(id)`/`salvar*()` com edição; três pares cabeçalho/corpo; handlers genéricos de ordem/filtro; controle de tipo/modelo e agrupamento; `exporNoWindow()` com os 6 nomes novos
- `reparos/index.html` — coluna de ações nas três tabelas; `theads` dinâmicos por id; contador/limpar filtros por aba; `<select>` de tipo/modelo e botão de agrupar por aba; CSS compacto escopado ao módulo
- `tests/tabela-compartilhada.test.js` — gate do núcleo genérico, novo (9 casos)
- `tests/reparos-tabelas.test.js` — gate de /reparos, novo, crescido nos três commits (86 casos ao final)

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: `shared/tabela.js` nunca conhece nome de campo de domínio (D2); os três `salvar*()` de Reparos guardam criação E edição, diferente do precedente de Máquinas, porque aqui a checagem espelha 1:1 a RLS real (T-vtm-01); célula agrupada carrega todo dado que perdeu coluna própria no `texto()` (D3); tipo/modelo é um controle único com três apresentações, não três estados (D4); reparo sem modelo nunca é filtrado fora, regra preservada do Diagnóstico.

## Deviations from Plan

### Auto-fixed Issues

Nenhuma no sentido de bug ou lacuna de segurança — as únicas mudanças fora da leitura literal do plano foram reescritas de asserções dentro do próprio `tests/reparos-tabelas.test.js` conforme a implementação evoluiu de task para task (ex.: os testes de D1 que checavam `renderReparos()` inteira passaram a checar `renderLinhasReparos()` na Task 2, quando a função virou só um delegador) — o plano já previa explicitamente esse arquivo "crescer em três commits", e nenhuma cobertura foi perdida, só realocada para a função que passou a conter o comportamento testado.

### Ambiente: divergência de branch fora do controle desta execução

**[Deviation não prevista pelo plano] HEAD do checkout compartilhado já estava em `mapa-cobertura-e-posicionamento`, não em `maquinas-ficha-da-maquina`, antes de este executor rodar o primeiro comando.**
- **Encontrado em:** antes da Task 1 — `git status`/`git log --oneline` revelaram, via `git reflog`, que um processo concorrente (outra sessão executando as quick tasks `260818-vxu` e `260818-k9c`) já havia trocado o branch da árvore de trabalho e commitado por cima, tudo antes deste agente executar seu primeiro comando de shell.
- **Decisão:** não tentar `git checkout`/`git reset` para "corrigir" o branch — a árvore de trabalho é compartilhada por sessões concorrentes ativas, e uma troca de branch nesse momento arriscaria descartar trabalho em andamento de outra sessão ou aplicar `git checkout` sobre arquivos que outra sessão estava editando. `mapa-cobertura-e-posicionamento` é estritamente descendente de `maquinas-ficha-da-maquina` (`git merge-base` confirma `32b83b4` como ancestral comum, que é a própria ponta de `maquinas-ficha-da-maquina`), então nenhum commit desta quick task corre risco de ficar orfão — só precisa de um merge/rebase posterior, decisão do usuário, não deste executor.
- **Commits desta quick task ficaram em:** `mapa-cobertura-e-posicionamento` (não em `maquinas-ficha-da-maquina`, como o texto da constraint original previa).
- **Ação recomendada:** confirmar com o usuário se `mapa-cobertura-e-posicionamento` deve ser mesclada em `maquinas-ficha-da-maquina` (ou em `main`) antes do próximo `git push`, e evitar rodar múltiplas quick tasks concorrentes na mesma árvore de trabalho sem worktrees separadas — o próprio `CLAUDE.md`/constraints desta execução pediam "sem worktree", mas o ambiente já tinha mais de uma sessão ativa na mesma árvore.
- **Nenhum arquivo de outra quick task foi tocado ou commitado por este executor** — cada commit desta task ficou escopado exatamente aos arquivos de `files_modified` do plano.

---

**Total deviations:** 1 (ambiente — branch compartilhado divergente, sem impacto em integridade de dados)
**Impact on plan:** Funcional/lógico: nenhum. Operacional: os três commits desta quick task precisam ser reconciliados com `maquinas-ficha-da-maquina` antes do deploy, por decisão humana.

## Issues Encountered

Um teste da suíte completa (`tests/mobile-375.test.js#nenhum arquivo tocado pela Fase 7 referencia refrigeracao/`) falhou momentaneamente entre a Task 1 e a Task 2, por causa de edições em andamento de outra quick task concorrente em `mapa/index.html` (fora do escopo desta task, arquivo nunca tocado por ela) — o próprio `git status --porcelain` confirmou que o arquivo não fazia parte dos `files_modified` desta quick task, e a falha se resolveu sozinha assim que a sessão concorrente terminou aquele commit. Nenhuma ação foi tomada sobre `mapa/`.

## User Setup Required

None — nenhuma configuração de serviço externo necessária. Nenhuma migração SQL criada (`rep_modelos.categoria` já existe e já está preenchida desde a migração 27); `supabase/` conferido intocado ao fim de cada task.

## Next Phase Readiness

- `node --test`: 384/384, 0 falhas
- `git status --porcelain tests/estoque-cabecalho-maquinas.test.js` vazio — gate do Estoque não sofreu uma linha de alteração
- `git status --porcelain supabase/` vazio — nenhuma migração criada
- `git diff --stat shared/pmoc.css` vazio — CSS compacto ficou inteiramente em `reparos/index.html`
- `shared/tabela.js`, `reparos/tabelas.js`, `maquinas/estoque-tabela.js` e `reparos/app.js` conferidos como servidos por HTTP 200 com `Content-Type: text/javascript`, e o grafo de import resolve sem `SyntaxError` em Node
- Pendente (não bloqueante, D5): conferência visual humana no navegador por cargo — clicar ⚙ em cada tabela, ordenar/filtrar, escolher tipo/modelo e agrupar, e confirmar que o Estoque de Máquinas continua idêntico — recomendado no próximo UAT do módulo Reparos
- Pendente (bloqueante para deploy, não para esta execução): reconciliar `mapa-cobertura-e-posicionamento` (onde os três commits desta task ficaram) com `maquinas-ficha-da-maquina`, decisão do usuário

## Self-Check: PASSED

Arquivos criados/modificados conferidos em disco:
- FOUND: shared/tabela.js
- FOUND: reparos/tabelas.js
- FOUND: maquinas/estoque-tabela.js
- FOUND: tests/tabela-compartilhada.test.js
- FOUND: tests/reparos-tabelas.test.js
- FOUND: reparos/app.js
- FOUND: reparos/index.html

Commits conferidos em `git log --oneline --all`:
- FOUND: 3bbf3d9 (Task 1)
- FOUND: 4fa5b44 (Task 2)
- FOUND: f0f3b56 (Task 3)

`node --test` na raiz: 384/384, 0 falhas.
