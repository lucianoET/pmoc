---
phase: quick
plan: 260818-twm
subsystem: ui
tags: [maquinas, estoque, rbac, ordenacao, filtro, nucleo-puro]

requires: []
provides:
  - "Botão explícito de editar cadastro do material (⚙), restrito a Direção e gestor, ao lado do ✎ de quantidade/mínimo/preço"
  - "salvarMaterial() recusa editar cadastro existente para quem não é admin/gestor; criar material novo continua liberado"
  - "Cabeçalho da tabela do estoque ordenável (3 estados, uma coluna por vez, numérico/textual por tipo, vazios no fim) e filtrável (substring sem acento/caixa, acumulável por coluna), tudo de tela"
  - "maquinas/estoque-tabela.js: núcleo puro (COLUNAS_ESTOQUE, proximaOrdem, normalizarBusca, compararMateriais, aplicarOrdemEFiltro), testável em Node"
affects: [maquinas, estoque]

tech-stack:
  added: []
  patterns:
    - "Núcleo-puro/aplicador-de-DOM aplicado a mais um módulo: maquinas/estoque-tabela.js segue o mesmo corte de shared/tema.js e mapa/mapa-geometria.js"
    - "renderX() vira renderCabecalhoX() + renderLinhasX(): reescrever o cabeçalho inteiro só quando a estrutura muda (ordenar, abrir/fechar filtro); digitar num campo redesenha só o corpo, preservando foco e cursor"

key-files:
  created:
    - maquinas/estoque-tabela.js
    - tests/estoque-cabecalho-maquinas.test.js
  modified:
    - maquinas/app.js
    - maquinas/index.html
    - tests/ficha-ativo-maquinas.test.js
    - tests/necessidades-compras-maquinas.test.js

key-decisions:
  - "podeEditarCadastro() (admin+gestor) é um helper novo, não uma repetição da lista de cargos — reaproveitado também no botão de cadastro da ficha da máquina, que já usava a mesma regra escrita à mão (D1)"
  - "O botão ✎ de quantidade/mínimo/preço fica byte-idêntico, sob podeEscreverNoModulo() (D2) — cadastro e operação do dia a dia são permissões diferentes por design, não uma restringindo a outra"
  - "Ordenar e filtrar nunca tocam o Supabase nem chamam carregarTudo() — são só um recorte/reordenção de MATERIAIS em memória (D3)"
  - "Filtro por coluna é uma única linha de campos compartilhada (não uma por coluna): clicar em ⌕ alterna a linha inteira aberta/fechada, e fechar limpa todos os filtros para não deixar um filtro invisível escondendo linhas"
  - "MATERIAL_EDIT_ID nunca aponta para uma linha invisível: se o filtro exclui a linha em edição, a edição é cancelada; se o painel pede uma peça fora do filtro/ordem ativos, editarMaterial() limpa os dois antes de abrir a aba (D4)"

patterns-established:
  - "Formatação de célula (preço, unidade) duplicada no núcleo puro em vez de reaproveitar o template de linha travado por gate — ordenação não é motivo para reabrir markup já fechado"

requirements-completed: []

coverage:
  - id: D1
    description: "Botão ⚙ de editar cadastro do material, restrito a admin/gestor, ao lado do ✎; link do nome segue a mesma regra; salvarMaterial() recusa edição para quem não pode"
    verification:
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#podeEditarCadastro() é declarado uma vez e devolve admin+gestor"
        status: pass
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#renderMateriais() chama abrirModalMaterial(${m.id}) duas vezes — nome e botão novo —, ambas sob podeEditarCadastro()"
        status: pass
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#salvarMaterial() recusa edição de material existente para quem não edita cadastro, mas não bloqueia criação"
        status: pass
    human_judgment: false
  - id: D2
    description: "Botão ✎ de quantidade/mínimo/preço continua byte-idêntico, sob podeEscreverNoModulo()"
    verification:
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#o botão ✎ da linha do estoque continua guardado por podeEscreverNoModulo(), byte-idêntico"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cabeçalho ordena (3 estados, numérico/textual por tipo, vazios no fim) e filtra (substring, acumulável) sem tocar o Supabase"
    verification:
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#ordenação numérica ordena por número, não por string (10 depois de 9)"
        status: pass
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#ordenação textual usa pt-BR e vazio/nulo fica no fim nas duas direções"
        status: pass
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#filtro é substring sobre o texto exibido, sem acento e sem caixa, e filtros de colunas diferentes se acumulam"
        status: pass
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#ordenar e filtrar não tocam o Supabase — nenhuma das quatro chama carregarTudo() nem supa.from("
        status: pass
    human_judgment: false
  - id: D4
    description: "A linha em edição nunca fica pendurada num conjunto invisível — cancelada se sair do filtro; editarMaterial() do painel limpa filtro/ordem quando a peça pedida está fora da lista visível"
    verification:
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#renderLinhasMateriais() contém a guarda de MATERIAL_EDIT_ID contra a lista visível (D4)"
        status: pass
      - kind: unit
        ref: "tests/estoque-cabecalho-maquinas.test.js#editarMaterial() limpa filtro e ordem quando o material pedido está fora da lista visível (D4, caminho do painel)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Conferência visual em navegador por cargo (admin/gestor veem ✎ e ⚙; técnico só ✎; observador nenhum), ordenar/filtrar nas 9 colunas, cursor não perdido ao digitar no filtro"
    verification: []
    human_judgment: true
    rationale: "Plano type=execute autonomous sem checkpoint de verificação humana e sem credenciais Supabase/Playwright neste ambiente; a suíte automatizada cobre lógica, gates e presença de markup, mas a conferência visual por cargo (itens 3–6 da seção <verification> do plano) não foi observada diretamente."

duration: ~20min
completed: 2026-08-18
status: complete
---

# Quick Task 260818-twm: Botão de editar cadastro do material e cabeçalho ordenável/filtrável do estoque — Summary

**Coluna de ações do estoque ganha um segundo botão (⚙, restrito a admin/gestor) para o cadastro do material, mantendo o ✎ de quantidade/mínimo/preço intocado; e o cabeçalho da tabela de 34 materiais passa a ordenar e filtrar por coluna, de tela, via núcleo puro testável em Node (maquinas/estoque-tabela.js).**

## Performance

- **Duration:** ~20min
- **Completed:** 2026-08-18
- **Tasks:** 2/2 completas
- **Files modified:** 6 (2 criados: `maquinas/estoque-tabela.js`, `tests/estoque-cabecalho-maquinas.test.js`; 4 modificados)

## Accomplishments

- `podeEditarCadastro()` (admin+gestor) guarda o link do nome do material, o botão novo `⚙` na coluna de ações, a guarda de edição em `salvarMaterial()` e o botão de cadastro da ficha da máquina (`ficha-btn-cadastro`) — uma regra, quatro pontos de uso, lista literal escrita uma única vez
- Botão `✎` de quantidade/mínimo/preço fica byte-idêntico, sob `podeEscreverNoModulo()` (três cargos)
- `maquinas/estoque-tabela.js` (núcleo puro, sem API de navegador): `COLUNAS_ESTOQUE` (9 colunas, 3 numéricas), `proximaOrdem()` (ciclo `null → asc → desc → null`), `normalizarBusca()` (minúsculas + NFD sem acento), `compararMateriais()` (numérico por valor, textual por `localeCompare('pt-BR')`, vazio sempre no fim nas duas direções), `aplicarOrdemEFiltro()` (filtro substring em conjunção + ordenação)
- `renderMateriais()` vira `renderCabecalhoMateriais()` + `renderLinhasMateriais()`: cabeçalho com botão de ordenação (`⇅`/`↑`/`↓`) e de filtro (`⌕`, com classe de estado ativo) por coluna; digitar num campo de filtro só redesenha o `tbody`, sem perder foco/cursor
- D4: `MATERIAL_EDIT_ID` é cancelado se a linha em edição sair do conjunto filtrado; `editarMaterial()` (chamada do painel, que pode pedir uma peça de estoque baixo fora do filtro ativo) limpa filtro e ordem antes de abrir a aba
- `maquinas/index.html`: `<thead>` do estoque vira `id="th-materiais"` gerado por JS; cabeçalho da view ganha `#mat-contagem` ("N de 34") e botão "Limpar filtros", visíveis só com ordem/filtro ativos; CSS novo (`.th-rotulo`, `.th-acao`, `.th-acao.ativo`) seguindo `.btn-tema` como precedente
- `node --test`: 279/279 (253 de antes + 26 novos em `tests/estoque-cabecalho-maquinas.test.js`)

## Task Commits

1. **Task 1: botão explícito de editar cadastro do material, restrito a Direção e gestor (D1, D2)** - `a336cfb` (feat)
2. **Task 2: ordenação e filtro por coluna no cabeçalho do estoque (D3, D4)** - `d2c95e2` (feat)

## Files Created/Modified

- `maquinas/estoque-tabela.js` — núcleo puro de ordenação/filtro do estoque, novo
- `maquinas/app.js` — `podeEditarCadastro()`; `renderMateriais()` dividido em `renderCabecalhoMateriais()`/`renderLinhasMateriais()`; `MAT_ORD`/`MAT_FILTROS`/`MAT_FILTROS_ABERTO`; `ordenarMateriais()`/`filtrarColunaMateriais()`/`aplicarFiltroMaterial()`/`limparFiltrosMateriais()`; `editarMaterial()` com guarda D4; `salvarMaterial()` com guarda D1; `exporNoWindow()` com as seis funções novas
- `maquinas/index.html` — `<thead id="th-materiais">` vazio (gerado por JS), `#mat-contagem`/`#btn-limpar-filtros` no cabeçalho da view, CSS `.th-rotulo`/`.th-acao`
- `tests/estoque-cabecalho-maquinas.test.js` — gate novo, 26 casos (9 de D1/D2 na Task 1, 17 de D3/D4/fiação na Task 2)
- `tests/ficha-ativo-maquinas.test.js` — assert do botão de cadastro da ficha atualizado para `podeEditarCadastro()` (era a lista literal que D1 pediu para substituir)
- `tests/necessidades-compras-maquinas.test.js` — assert do `<thead>` estático do estoque atualizado para o `id="th-materiais"` gerado por JS

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: `podeEditarCadastro()` é um helper nomeado justamente para não espalhar a lista de cargos por quatro pontos do arquivo (D1); ordenar/filtrar são operações de tela puras, sem round-trip ao Supabase (D3); a linha em edição nunca aponta para uma peça invisível (D4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dois gates pré-existentes desatualizados pela própria mudança pedida no plano**
- **Found during:** Task 1 (verificação) e Task 2 (verificação)
- **Issue:** `tests/ficha-ativo-maquinas.test.js` fixava a expressão literal antiga (`['admin','gestor'].includes(USUARIO?.role)`) para `btnCadastro.style.display`, que a própria Task 1 substitui por `podeEditarCadastro()` (instrução explícita do plano). `tests/necessidades-compras-maquinas.test.js` fixava o `<thead><tr><th>Sistema</th>...` estático que a Task 2 substitui por `<thead id="th-materiais">` gerado por JS.
- **Fix:** os dois asserts foram reescritos para verificar o comportamento novo (helper nomeado; rótulos de coluna em `COLUNAS_ESTOQUE`), sem remover cobertura — ambos continuam provando a mesma regra de negócio (cadastro restrito a admin/gestor; colunas Sistema/Aplicação existem).
- **Files modified:** `tests/ficha-ativo-maquinas.test.js`, `tests/necessidades-compras-maquinas.test.js`
- **Verification:** `node --test` 279/279 após o ajuste
- **Committed in:** `a336cfb` (ficha-ativo) e `d2c95e2` (necessidades-compras)

---

**Total deviations:** 1 (dois gates pré-existentes, mesma causa: o plano instruiu explicitamente a mudança que os quebrou)
**Impact on plan:** Nenhum além do previsto — os dois arquivos de teste não estão em `<files>` das tasks, mas atualizá-los era necessário para manter `node --test` 100% verde sem apagar cobertura, condição explícita do plano.

## Issues Encountered

Nenhum. `maquinas/estoque-tabela.js` foi conferido como ES module real chegando ao navegador: servido com HTTP 200 via `python -m http.server`, e importado com sucesso pelo resolvedor de módulos do Node a partir de `/maquinas/app.js` (falha apenas no ponto esperado, `window is not defined`, fora do módulo novo).

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Nenhuma migração SQL criada — mudança só de tela.

## Next Phase Readiness

- `node --test`: 279/279, 0 falhas
- `git diff --stat` toca só `maquinas/app.js`, `maquinas/index.html`, `maquinas/estoque-tabela.js` e os três arquivos de teste — nenhuma migração, nada em `refrigeracao/` ou `shared/`
- Pendente (não bloqueante): conferência visual em navegador por cargo e do comportamento de ordenar/filtrar nas 9 colunas (itens 3–6 da seção `<verification>` do plano) — recomendado no próximo UAT manual do módulo Máquinas

## Self-Check: PASSED

Ver seção abaixo.
