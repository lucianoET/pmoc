---
phase: quick
plan: 260818-twm
type: execute
wave: 1
depends_on: []
files_modified:
  - maquinas/app.js
  - maquinas/index.html
  - maquinas/estoque-tabela.js
  - tests/estoque-cabecalho-maquinas.test.js
autonomous: true
requirements: []
must_haves:
  truths:
    - "A linha do material tem um botão explícito de editar cadastro na coluna de ações, ao lado do botão de quantidade, visível só para Direção (admin) e gestor (D1)."
    - "O link no nome do material segue exatamente a mesma regra do botão novo — o técnico não alcança o cadastro por caminho escondido (D1)."
    - "salvarMaterial() recusa a edição de material existente quando o cargo não pode editar cadastro; criar material novo continua liberado a quem escreve no módulo (D1)."
    - "O botão ✎ de quantidade/mínimo/preço continua em podeEscreverNoModulo(), com o mesmo ícone, o mesmo gate e o mesmo comportamento (D2)."
    - "Cada coluna do cabeçalho do estoque tem um botão de ordenação que cicla sem ordem → crescente → decrescente → sem ordem, uma coluna por vez, numérica em estoque atual/mínimo/preço e textual (pt-BR) no resto, com vazios sempre no fim (D3)."
    - "O ícone ⌕ abre e fecha uma linha de campos de filtro sob o cabeçalho e foca o campo da coluna clicada; o filtro é substring sem acento e sem caixa sobre o texto exibido daquela coluna (D3)."
    - "Com filtro ativo o cabeçalho da view mostra quantos de quantos e oferece limpar tudo de uma vez; o estado de filtro ativo é visível no próprio ícone (D3)."
    - "Ordenar e filtrar são operações de tela: não refazem consulta ao Supabase nem chamam carregarTudo() (D3)."
    - "Se a linha em edição sair do conjunto filtrado, a edição é cancelada em vez de sumir com os campos preenchidos (D4)."
    - "node --test na raiz continua 100% verde (253 hoje, mais os novos); nenhum teste apagado."
  artifacts:
    - "maquinas/estoque-tabela.js — núcleo puro (descritores de coluna, ciclo de ordem, comparador, normalização de busca, filtro), sem API de navegador"
    - "maquinas/app.js com podeEditarCadastro(), renderCabecalhoMateriais(), renderLinhasMateriais(), MAT_ORD/MAT_FILTROS"
    - "maquinas/index.html com o thead do estoque renderizado por JS (id th-materiais) e o resumo de filtro no cabeçalho da view"
    - "tests/estoque-cabecalho-maquinas.test.js — gate novo, crescido em dois commits"
  key_links:
    - "podeEditarCadastro() → botão de cadastro da linha do estoque + link do nome + guarda de salvarMaterial() + ficha-btn-cadastro (uma regra, um lugar)"
    - "podeEscreverNoModulo() → botão ✎ da linha e abrirModalMaterial() sem id (intocados)"
    - "aplicarOrdemEFiltro(MATERIAIS, MAT_ORD, MAT_FILTROS) → renderLinhasMateriais() → tbody + contagem, sem tocar no Supabase"
    - "renderLinhasMateriais() → guarda de MATERIAL_EDIT_ID contra a lista visível (D4)"
---

<objective>
Duas frentes na aba Estoque do módulo Máquinas, cada uma commitável sozinha: (1) o cadastro completo do material deixa de ser uma afordância escondida no nome da linha e vira um botão explícito, restrito a Direção e gestor; (2) o cabeçalho da tabela do estoque ganha ordenação e filtro por coluna, de tela, sem ida ao banco.

Purpose: hoje o cadastro do material só é alcançável clicando no nome — descoberto por acaso no hover — e está liberado ao técnico, que não deveria mexer em cadastro. E a tabela do estoque cresceu para nove colunas e 34 linhas sem nenhuma forma de procurar ou ordenar: achar uma peça é rolar a lista com o olho.
Output: módulo Máquinas com a coluna de ações do estoque em dois botões de escopos diferentes, cabeçalho ordenável e filtrável, núcleo puro testável em Node e `node --test` verde.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

@maquinas/app.js
@maquinas/index.html
@shared/pmoc.css
@tests/necessidades-compras-maquinas.test.js
</context>

<interface_context>
Pontos de ancoragem já existentes (conferidos em 18/08/2026):

- `maquinas/app.js:40` — `let MATERIAL_EDIT_ID = null` (edição em linha).
- `maquinas/app.js:342` — o painel chama `editarMaterial(${m.id})` no bloco de estoque baixo: entra na aba Estoque e abre a linha em edição.
- `maquinas/app.js:819` — `renderMateriais()`: ramo de linha em edição (três inputs numéricos com ids fixos `ed-atual`/`ed-minimo`/`ed-preco`) e ramo de linha normal; hoje o link do nome (linha 853) e o botão `✎` (linha 872) usam ambos `podeEscreverNoModulo()`.
- `maquinas/app.js:896` — `podeEscreverNoModulo()` → `['admin','gestor','tecnico'].includes(USUARIO?.role)`.
- `maquinas/app.js:939-987` — `editarMaterial(id)` / `cancelarEdicaoMaterial()` / `salvarLinhaMaterial(id)`.
- `maquinas/app.js:2325-2327` — precedente da restrição a cadastro: `btnCadastro.style.display = ['admin','gestor'].includes(USUARIO?.role) ? '' : 'none'` no `ficha-btn-cadastro`.
- `maquinas/app.js:2509` / `2541` — `abrirModalMaterial(id)` (id ausente = criar novo, `MATERIAL_MODAL_ID = null`) e `salvarMaterial()` (ramo update quando `MATERIAL_MODAL_ID`, ramo insert quando não).
- `maquinas/app.js:2692` — `exporNoWindow()`: todo nome usado em `onclick=` inline precisa estar publicado aqui (gate estrutural da Fase 05-06).
- `maquinas/app.js:722` — `esc(valor)`.
- `maquinas/index.html:11-78` — `<style>` do módulo (CSS novo vai aqui).
- `maquinas/index.html:235-252` — `view-materiais`: cabeçalho com os botões `+ Entrada`/`+ Material`, `view-sub`, `thead` estático de 9 colunas e `tbody id="tb-materiais"` com `colspan="9"` nos estados vazios.
- `maquinas/index.html:907` — `<script type="module" src="/maquinas/app.js">`: `import` de arquivo irmão funciona, sem bundler.
- `shared/pmoc.css:98-122` — `.tbl-wrap`, `.tbl`, `.tbl th`, `.badge`, `.btn`/`.btn-s`/`.btn-sm`. `.btn-sm` (5px 12px) é grande demais para dentro de um `<th>`; `.btn-tema` (4px 9px) é o precedente de botão-ícone pequeno da casa.
</interface_context>

<tasks>

<task type="auto">
  <name>Task 1: botão explícito de editar cadastro do material, restrito a Direção e gestor (D1, D2)</name>
  <files>maquinas/app.js, tests/estoque-cabecalho-maquinas.test.js</files>
  <action>
Criar em `maquinas/app.js`, ao lado de `podeEscreverNoModulo()` (linha ~896), o helper `podeEditarCadastro()` devolvendo `['admin','gestor'].includes(USUARIO?.role)`, com comentário `// ── nome ──` de seção explicando a regra: mexer em cadastro é exceção, não rotina do dia a dia; quem opera o estoque (técnico) ajusta quantidade, não identidade da peça.

Passar a usar esse helper em quatro lugares, sem que a lista literal de cargos sobre em nenhum outro (D1 pede helper nomeado justamente para não espalhá-la):
1. `renderMateriais()`, linha do nome (~853): trocar `podeEscreverNoModulo()` por `podeEditarCadastro()` no ternário que decide entre `<a>` e texto puro. Manter o `title` atual.
2. `renderMateriais()`, coluna de ações (~870-876): acrescentar, ao lado do botão `✎` e sob `podeEditarCadastro()`, um segundo botão `class="btn btn-s btn-sm"` com `onclick="abrirModalMaterial(${m.id})"`, rótulo `⚙`, `title="Editar cadastro do material"` e `aria-label` igual ao title. Ordem na linha: `✎` primeiro (ação do dia a dia), cadastro depois.
3. `salvarMaterial()` (~2541): logo no início, guardar apenas o ramo de edição — `if(MATERIAL_MODAL_ID && !podeEditarCadastro()){ alert('Seu cargo não altera o cadastro do material.'); return }`. Criar material novo segue como está.
4. `aplicarPermissoesFicha` (`maquinas/app.js:2326`): substituir a expressão literal idêntica por `podeEditarCadastro()`. É a mesma regra que D1 cita como precedente; deixar a lista escrita duas vezes é exatamente o que o helper existe para evitar. Nenhuma mudança de comportamento.

NÃO tocar (D2): `editarMaterial`, `salvarLinhaMaterial`, `cancelarEdicaoMaterial`, o gate `podeEscreverNoModulo()` do botão `✎`, o ícone `✎`, o `abrirModalMaterial()` sem id do botão `+ Material` no cabeçalho da view, e a chamada `editarMaterial(${m.id})` do painel (linha 342).

`abrirModalMaterial` já está publicado em `exporNoWindow()`; nenhum nome novo entra em `onclick=` inline, então a lista não muda.

Criar `tests/estoque-cabecalho-maquinas.test.js` no estilo dos gates do módulo (`node:test` + `node:assert/strict`, leitura de arquivo como texto, comentário de cabeçalho dizendo por que o gate existe e que ele cresce em dois commits). Casos desta task:
- `podeEditarCadastro` é declarado uma vez em `maquinas/app.js` e devolve a lista de cargos admin+gestor.
- a lista literal de cargos de cadastro aparece exatamente uma vez no arquivo inteiro (contagem sobre linhas não comentadas), provando que ela não voltou a se espalhar.
- `podeEscreverNoModulo` continua devolvendo os três cargos, e a chamada `editarMaterial(` na linha do estoque continua guardada por ele.
- na região de `renderMateriais()` (do início da função até `// ── valor da hora-homem`), `abrirModalMaterial(${m.id})` aparece duas vezes — link do nome e botão novo — e ambas as ocorrências estão sob `podeEditarCadastro()`.
- `salvarMaterial()` tem a guarda condicionada a `MATERIAL_MODAL_ID` (só edição), e a criação de material novo não é bloqueada.
- `ficha-btn-cadastro` usa o helper.
  </action>
  <verify>
    <automated>cd /home/luc/Downloads/pmoc-overlay && node --test tests/estoque-cabecalho-maquinas.test.js && node --test 2>&1 | tail -5</automated>
  </verify>
  <done>Suite nova verde e suite completa verde (253 + os casos novos, zero fail). Na tabela do estoque, admin/gestor veem `✎` e `⚙` na coluna de ações e o nome como link; técnico vê só o `✎` e o nome como texto; observador não vê botão nenhum. Editar cadastro de material existente é recusado com aviso para quem não é admin/gestor; `+ Material` continua abrindo para os três cargos que escrevem.</done>
</task>

<task type="auto">
  <name>Task 2: ordenação e filtro por coluna no cabeçalho do estoque (D3, D4)</name>
  <files>maquinas/estoque-tabela.js, maquinas/app.js, maquinas/index.html, tests/estoque-cabecalho-maquinas.test.js</files>
  <action>
**Núcleo puro — `maquinas/estoque-tabela.js` (arquivo novo).** Mesmo padrão núcleo-puro/aplicador-de-DOM já usado em `shared/tema.js` e `mapa/mapa-geometria.js`: nenhuma API de navegador, testável em Node. Exporta:

- `COLUNAS_ESTOQUE` — nove descritores na ordem da tabela (`codigo`, `nome`, `tipo`, `sistema`, `aplicacao`, `estoque_atual`, `estoque_minimo`, `preco`, `status`), cada um com `{ id, rotulo, tipo: 'texto'|'numero', valor(m), texto(m) }`. `tipo: 'numero'` só em `estoque_atual`, `estoque_minimo` e `preco`; o resto é texto. `texto(m)` devolve o que a célula mostra (`tipo` em maiúsculas, `— ` quando vazio vira string vazia, `status` devolve `OK`/`BAIXO` pela mesma comparação `estoque_atual >= estoque_minimo` da linha).
- `proximaOrdem(dir)` — ciclo travado `null → 'asc' → 'desc' → null`.
- `normalizarBusca(texto)` — minúsculas + `normalize('NFD')` sem diacríticos, tolerando `null`/`undefined`/número.
- `compararMateriais(a, b, coluna, dir)` — numérico por `valor()` nas três colunas numéricas, `localeCompare(_, 'pt-BR')` sobre `texto()` no resto; vazio/nulo **sempre no fim**, independentemente da direção (o vazio não é "menor", é "não informado").
- `aplicarOrdemEFiltro(lista, ord, filtros)` — filtra por substring normalizada sobre `texto()` de cada coluna com filtro preenchido (todos os filtros ativos em conjunção) e depois ordena; sem `ord.coluna` devolve a ordem de entrada. Sem sintaxe de comparação: `>` e `<` são texto como qualquer outro caractere.

Duplicar aqui a formatação de texto de algumas células (preço, unidade) em vez de refatorar o template de linha de `renderMateriais()` é deliberado: o markup da linha já está travado por gates existentes e não vale reescrevê-lo por causa de ordenação.

**Estado e render — `maquinas/app.js`.** Importar o núcleo no topo do arquivo (`import { ... } from './estoque-tabela.js'` — `maquinas/index.html:907` já carrega o app como `type="module"`). Globais no padrão do módulo, junto de `MATERIAL_EDIT_ID` (linha ~40): `let MAT_ORD = { coluna: null, dir: null }`, `let MAT_FILTROS = {}`, `let MAT_FILTROS_ABERTO = false`.

Quebrar `renderMateriais()` em duas partes, mantendo o nome atual como entrada completa (ele é chamado de `carregarTudo()` e de `editarMaterial`/`cancelarEdicaoMaterial`):
- `renderCabecalhoMateriais()` — escreve o `<thead>` inteiro: por coluna, `<th>` com `aria-sort` (`ascending`/`descending`/`none`) e, ao lado do rótulo, dois botões — ordenação (`⇅` sem ordem, `↑` crescente, `↓` decrescente, `onclick="ordenarMateriais('<id>')"`) e filtro (`⌕`, `onclick="filtrarColunaMateriais('<id>')"`), ambos com `title` e `aria-label` em português dizendo a coluna e a ação. O botão de filtro ganha classe de estado ativo quando `MAT_FILTROS[id]` está preenchido, para o filtro ser visível no ícone e não só no campo. Quando `MAT_FILTROS_ABERTO`, escreve também a segunda linha do `thead`: um `<td>`/`<th>` por coluna com `<input type="search" id="filtro-<id>" value="${esc(...)}" oninput="aplicarFiltroMaterial('<id>', this.value)" placeholder="filtrar">`.
- `renderLinhasMateriais()` — calcula `const visiveis = aplicarOrdemEFiltro(MATERIAIS, MAT_ORD, MAT_FILTROS)`, aplica a guarda de D4 (ver abaixo), escreve o `<tbody>` reaproveitando o template de linha atual sem alterá-lo, e atualiza o resumo de filtro. Estado vazio por filtro é uma linha própria (`colspan="9"`, "Nenhum material corresponde ao filtro"), distinta do "Nenhum material cadastrado" que já existe.

`renderMateriais()` passa a chamar as duas. **Só o cabeçalho é reescrito ao ordenar e ao abrir/fechar a linha de filtro; digitar num campo de filtro chama apenas `renderLinhasMateriais()`** — reescrever o `thead` a cada tecla mataria o foco e o cursor do campo.

Funções de interação, todas de tela (nenhuma consulta ao Supabase, nenhuma chamada a `carregarTudo()`):
- `ordenarMateriais(coluna)` — se é outra coluna, começa em `'asc'` e zera a anterior; se é a mesma, aplica `proximaOrdem`. Uma coluna ordenada por vez. Re-render completo.
- `filtrarColunaMateriais(coluna)` — alterna `MAT_FILTROS_ABERTO` (fechar limpa `MAT_FILTROS` inteiro, para não deixar filtro invisível escondendo linhas), re-render completo e, ao abrir, foca `filtro-<coluna>`.
- `aplicarFiltroMaterial(coluna, valor)` — grava em `MAT_FILTROS` (string vazia remove a chave) e chama só `renderLinhasMateriais()`.
- `limparFiltrosMateriais()` — zera `MAT_FILTROS` e `MAT_ORD`, fecha a linha de filtro, re-render completo.

Publicar `ordenarMateriais`, `filtrarColunaMateriais`, `aplicarFiltroMaterial` e `limparFiltrosMateriais` em `exporNoWindow()` — são chamados de `onclick`/`oninput` inline em markup gerado em runtime.

**D4 — a edição de linha não pode ser quebrada.** Em `renderLinhasMateriais()`, antes de escrever o corpo: se `MATERIAL_EDIT_ID` não estiver na lista visível, `MATERIAL_EDIT_ID = null` — a edição é cancelada, em vez de a linha sumir levando os campos preenchidos. E em `editarMaterial(id)`, se o material pedido não estiver na lista visível (o caminho do painel, `maquinas/app.js:342`, pede uma peça de estoque baixo que pode estar fora do filtro), limpar filtros e ordem antes de entrar na aba, senão o botão do painel pareceria quebrado.

**Contagem e limpeza — `maquinas/index.html`.** No cabeçalho de `view-materiais` (~236), ao lado dos botões existentes, acrescentar `<span id="mat-contagem" class="tagline"></span>` e `<button id="btn-limpar-filtros" class="btn btn-s btn-sm" onclick="limparFiltrosMateriais()">Limpar filtros</button>`; ambos preenchidos/escondidos por `renderLinhasMateriais()` — texto `N de 34` e botão visível apenas com filtro ou ordem ativa. Trocar o `<thead>` estático de nove `<th>` por `<thead id="th-materiais"></thead>` (o conteúdo passa a vir do JS). O `tbody` e o `colspan="9"` ficam.

CSS novo (mínimo) no `<style>` de `maquinas/index.html`, seguindo `.btn-tema` como precedente de botão-ícone pequeno: `.th-rotulo` (inline-flex, gap 4px, alinhado), `.th-acao` (fundo transparente, sem borda, `color:var(--text3)`, cursor pointer, font-size 11px, padding 1px 3px) e `.th-acao.ativo{color:var(--accent-texto)}`. Nada mais — `.tbl`, `.btn`, `.badge` e `.tbl-wrap` de `shared/pmoc.css` cobrem o resto.

**Escopo:** só `#tb-materiais`. Não mexer nas tabelas de OS, Máquinas ou Necessidades.

Estender `tests/estoque-cabecalho-maquinas.test.js` (sem apagar os casos da Task 1) importando `maquinas/estoque-tabela.js` de verdade e testando comportamento, não só texto:
- `proximaOrdem` cicla `null → 'asc' → 'desc' → null`.
- `normalizarBusca` derruba acento e caixa (`'Óleo'` casa com `'oleo'`).
- ordenação numérica em `estoque_atual`/`estoque_minimo`/`preco` ordena por número, não por string (`10` depois de `9`).
- ordenação textual usa pt-BR e vazio/nulo fica no fim nas duas direções.
- filtro é substring sobre o texto exibido, sem acento e sem caixa, e filtros de colunas diferentes se acumulam.
- `COLUNAS_ESTOQUE` tem nove colunas na ordem do markup e exatamente três marcadas como numéricas.
E, por leitura de texto dos dois arquivos do módulo:
- `maquinas/index.html` tem `id="th-materiais"` e o cabeçalho do estoque não é mais markup estático de nove `<th>`.
- `MAT_ORD` e `MAT_FILTROS` são declarados em `maquinas/app.js`.
- as quatro funções de interação estão publicadas em `exporNoWindow()`.
- nenhuma delas chama `carregarTudo()` nem `supa.from(` — ordenar e filtrar são de tela.
- `renderLinhasMateriais()` contém a guarda de `MATERIAL_EDIT_ID` (D4).
- `aria-sort` é escrito pelo cabeçalho.
  </action>
  <verify>
    <automated>cd /home/luc/Downloads/pmoc-overlay && node --test tests/estoque-cabecalho-maquinas.test.js && node --test 2>&1 | tail -5</automated>
  </verify>
  <done>Suite completa verde (253 + os casos das duas tasks, zero fail). Clicar no ícone de ordenação de uma coluna cicla os três estados e zera a coluna anterior; `⌕` abre a linha de campos, foca o campo da coluna clicada e filtra enquanto se digita sem perder o cursor; com filtro ativo o cabeçalho mostra `N de 34` e o botão de limpar; a linha em edição fora do filtro é cancelada em vez de desaparecer com os campos preenchidos; nenhuma requisição ao Supabase é disparada por ordenar ou filtrar.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → Postgres (RLS) | toda escrita em `maq_materiais` atravessa aqui; o controle real é a policy, o cliente é UX |
| texto do usuário → DOM | valores de filtro e campos do material voltam para o markup gerado por template literal |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-twm-01 | Elevation of Privilege | `salvarMaterial()` / `podeEditarCadastro()` | medium | accept | A restrição a admin/gestor é UX: a policy real de `maq_materiais` escopa escrita a `authenticated` sem distinguir cargo, então um técnico com console consegue o mesmo update. Aceito nesta task, mesmo princípio já registrado para `CARGOS_POSICAO` no mapa (lista do cliente mais estreita que a do banco, por decisão). Fechar isso exigiria migração, e esta task é só tela. |
| T-twm-02 | Tampering | `renderCabecalhoMateriais()` — `value` dos campos de filtro | medium | mitigate | Texto digitado pelo usuário volta ao markup: passar todo valor de filtro por `esc()` antes de interpolar, mesma regra já aplicada às células. |
| T-twm-03 | Information Disclosure | linha do estoque para `observador` | low | accept | Observador continua lendo a tabela inteira, incluindo preço — comportamento atual, inalterado por esta task. |
| T-twm-04 | Denial of Service | `aplicarOrdemEFiltro()` sobre `MATERIAIS` | low | accept | Ordenação/filtro em memória sobre ~34 linhas, em cada tecla. Custo irrelevante nessa ordem de grandeza; nenhuma consulta ao banco é disparada. |
| T-twm-SC | Tampering | instalação de pacotes | high | mitigate | Nenhum pacote instalado: zero-build, sem npm, sem `package.json`. Gate de legitimidade não se aplica. |
</threat_model>

<verification>
1. `node --test` na raiz: 253 testes de hoje continuam verdes, mais os novos; nenhum arquivo de teste apagado ou esvaziado.
2. `git diff --stat` toca apenas `maquinas/app.js`, `maquinas/index.html`, `maquinas/estoque-tabela.js` e `tests/estoque-cabecalho-maquinas.test.js` — nenhuma migração, nenhum arquivo em `supabase/`, nada em `refrigeracao/` ou `shared/`.
3. Conferência manual em `/maquinas` (aba Estoque), por cargo: Direção/gestor veem `✎` e `⚙`; técnico vê só `✎` e o nome sem link; observador vê a tabela sem botões de ação, mas com ordenação e filtro funcionando (ler e procurar não é escrever).
4. Ordenar por cada uma das nove colunas nos dois sentidos; conferir que vazios ficam no fim nos dois e que ordenar outra coluna zera a anterior.
5. Abrir `⌕` numa coluna, digitar, conferir que o cursor não é perdido entre teclas, que a contagem `N de 34` aparece e que "Limpar filtros" devolve a lista inteira.
6. Entrar em edição de linha, aplicar um filtro que exclua a linha em edição, conferir que a edição é cancelada; e clicar no alerta de estoque baixo do painel com filtro ativo, conferindo que a linha pedida aparece em edição.
</verification>

<success_criteria>
- Cadastro de material existente só é alcançável por admin/gestor, pelos dois caminhos (botão e nome), e recusado no `salvarMaterial()` para os demais; criar material novo segue liberado a quem escreve no módulo.
- O botão `✎` de quantidade/mínimo/preço está byte-idêntico ao de hoje em gate, ícone e cargo.
- A lista literal de cargos de cadastro existe num único lugar do `maquinas/app.js`.
- Cabeçalho do estoque ordena (três estados, uma coluna por vez, numérico/textual por tipo, vazios no fim) e filtra (substring sem acento e sem caixa, por coluna, acumulável) sem tocar o Supabase.
- `MATERIAL_EDIT_ID` nunca fica pendurado numa linha invisível.
- `node --test` 100% verde; gate novo em `tests/estoque-cabecalho-maquinas.test.js` cobrindo D1–D4.
</success_criteria>

<output>
Criar `.planning/quick/260818-twm-estoque-botao-de-editar-cadastro-do-mate/260818-twm-SUMMARY.md` ao terminar.
</output>
