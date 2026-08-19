---
phase: quick
plan: 260818-vtm
type: execute
wave: 1
depends_on: []
files_modified:
  - shared/tabela.js
  - maquinas/estoque-tabela.js
  - reparos/tabelas.js
  - reparos/app.js
  - reparos/index.html
  - tests/tabela-compartilhada.test.js
  - tests/reparos-tabelas.test.js
autonomous: true
requirements: []
must_haves:
  truths:
    - "Cada linha das três tabelas de /reparos tem um botão ⚙ explícito na célula de ações que abre o modal já preenchido para editar o cadastro daquele registro; sem id o mesmo modal continua criando (D1)."
    - "O título do modal diz se é criação ou edição, e o salvar correspondente faz update quando há registro em edição e insert quando não há (D1)."
    - "O ⚙ de modelos e serviços só aparece para quem passa em podeCatalogo(); o de reparos, para quem passa em podeConhecimento() — as mesmas regras que já governam os botões de criar (D1)."
    - "Clicar na linha de Reparos continua abrindo o modal de peças e serviços; o ⚙ não dispara os dois modais ao mesmo tempo (D1)."
    - "O núcleo puro de ordenação e filtro vive em shared/tabela.js, dirigido por definição de colunas passada como parâmetro, sem nenhum campo de material escrito no código (D2)."
    - "maquinas/estoque-tabela.js continua exportando as mesmas quatro funções com as mesmas assinaturas, e tests/estoque-cabecalho-maquinas.test.js passa sem uma linha alterada (D2)."
    - "As três tabelas de /reparos ordenam por coluna no ciclo sem ordem → crescente → decrescente → sem ordem, uma coluna por vez, com aria-sort no th, numérica onde o dado é número e pt-BR no resto, vazios sempre no fim nas duas direções (D2)."
    - "O ⌕ abre a linha de filtros e foca o campo da coluna clicada; o filtro é substring sem acento e sem caixa sobre o texto exibido, acumulável entre colunas, com contador e limpar tudo (D2)."
    - "Ordenar e filtrar são estado de tela: nenhuma consulta nova ao Supabase, nenhuma chamada a carregarTudo() (D2)."
    - "Digitar num campo de filtro redesenha só o corpo da tabela — o foco e o cursor do campo não se perdem (D2)."
    - "Reparos mostra 5 colunas mais ações, Serviços 4 mais ações e Modelos 4 mais ações; nenhum dado que perdeu coluna própria sumiu da tela nem deixou de ser filtrável e ordenável pela coluna que passou a contê-lo (D3)."
    - "O espaçamento reduzido das tabelas está escopado ao módulo /reparos; shared/pmoc.css não foi tocado (D3)."
    - "Um controle de tipo de máquina no topo das três abas oferece as categorias distintas de rep_modelos em um grupo e os modelos em outro, com rótulo acentuado e capitalizado mesmo quando o dado gravado não tem acento (D4)."
    - "O filtro por tipo/modelo vale para as três abas ao mesmo tempo: reparo sem modelo nunca é filtrado fora, modelo filtra direto, e serviço aparece quando algum reparo do tipo escolhido o consome — serviço sem vínculo só aparece com o filtro vazio (D4)."
    - "Agrupar por tipo insere linhas de cabeçalho de grupo com a contagem do grupo, convive com a ordenação (que passa a ordenar dentro do grupo) e com o filtro (D4)."
    - "Nenhuma migração de banco foi criada nem alterada — a coluna categoria já existe e já está preenchida."
    - "Nenhuma aba de peças foi criada em /reparos e nenhum catálogo de material foi duplicado (D5)."
    - "node --test na raiz continua 100% verde (279 hoje, mais os novos); nenhum teste apagado."
  artifacts:
    - "shared/tabela.js — núcleo puro genérico (ciclo de ordem, normalização de busca, comparador e filtro dirigidos por definição de colunas), sem API de navegador"
    - "maquinas/estoque-tabela.js reduzido a COLUNAS_ESTOQUE mais o adaptador que reexporta as funções genéricas com as assinaturas de ontem"
    - "reparos/tabelas.js — definições de coluna das três tabelas, construtores de linha de exibição, vocabulário de tipo de máquina e agrupamento, tudo puro"
    - "reparos/app.js com os três modais servindo criação e edição, os três pares cabeçalho/corpo e o estado de tela de ordem, filtro, tipo e agrupamento"
    - "reparos/index.html com os três theads renderizados por JS, o controle de tipo de máquina, o resumo de filtro e o CSS compacto escopado ao módulo"
    - "tests/tabela-compartilhada.test.js — gate do núcleo genérico"
    - "tests/reparos-tabelas.test.js — gate de /reparos, crescido em dois commits"
  key_links:
    - "shared/tabela.js → maquinas/estoque-tabela.js (adaptador) → tests/estoque-cabecalho-maquinas.test.js intocado"
    - "shared/tabela.js → reparos/tabelas.js → reparos/app.js (cabeçalho e corpo separados) → tbody, sem tocar o Supabase"
    - "podeCatalogo() → ⚙ de modelos e serviços + guarda dos respectivos salvar; podeConhecimento() → ⚙ de reparos + guarda de salvarReparo()"
    - "rep_modelos.categoria → vocabulário de tipo de máquina → filtro das três abas e chave de agrupamento"
    - "todo handler inline novo no markup → exporNoWindow() (gate em tests/integracao-reparos.test.js)"
---

<objective>
Três frentes no módulo /reparos, cada uma commitável sozinha: (1) o núcleo puro de ordenação e filtro entregue ontem para o Estoque vira genérico em `shared/tabela.js` e as três tabelas de /reparos ganham edição de cadastro por modal; (2) as três tabelas ganham ordenação e filtro por coluna e passam a mostrar menos colunas com mais informação por célula; (3) um controle único filtra e agrupa as três abas por tipo de máquina.

Purpose: hoje as três tabelas de /reparos são somente leitura — um sintoma escrito errado só se conserta no SQL editor; não têm ordenação nem filtro, e já nasceram largas demais (8, 6 e 7 colunas) para caber sem rolagem horizontal. E a pergunta que o mecânico faz na oficina — "o que quebra numa roçadeira" — não tem resposta na tela, apesar de `rep_modelos.categoria` estar preenchida desde a migração 27.
Output: módulo /reparos com cadastro editável pelos modais que já existem, tabelas densas ordenáveis e filtráveis por coluna, filtro e agrupamento por tipo de máquina, núcleo de tabela compartilhado com Máquinas e `node --test` verde.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

@reparos/app.js
@reparos/index.html
@maquinas/estoque-tabela.js
@tests/estoque-cabecalho-maquinas.test.js
@tests/integracao-reparos.test.js
</context>

<interface_context>

**Núcleo puro do Estoque, hoje em `maquinas/estoque-tabela.js` — assinaturas que o gate de ontem congela:**

```
COLUNAS_ESTOQUE          // array de { id, rotulo, tipo:'texto'|'numero', valor(m), texto(m) }, 9 itens
proximaOrdem(dir)                              -> 'asc' | 'desc' | null
normalizarBusca(texto)                         -> string minúscula, NFD sem diacríticos
compararMateriais(a, b, coluna, dir)           -> number
aplicarOrdemEFiltro(lista, ord, filtros)       -> array
```

`tests/estoque-cabecalho-maquinas.test.js` faz `require('../maquinas/estoque-tabela.js')` (Node 24 resolve ESM por require) e chama as quatro com exatamente essas assinaturas. Ele é contrato: o adaptador se ajusta a ele, nunca o contrário.

**Aplicador de DOM que serve de modelo, em `maquinas/app.js`:** `renderMateriais()` só delega para `renderCabecalhoMateriais()` (desenha o `<thead>` com rótulo, botão de ordem de três estados e ⌕ por coluna, mais a linha de campos de filtro quando aberta) e `renderLinhasMateriais()` (aplica ordem e filtro sobre o array global e escreve o `<tbody>`, mais o contador). Estado de tela em `MAT_ORD` / `MAT_FILTROS` / `MAT_FILTROS_ABERTO`. Handlers `ordenarMateriais`, `filtrarColunaMateriais`, `aplicarFiltroMaterial`, `limparFiltrosMateriais`, todos publicados em `exporNoWindow()`. CSS `.th-rotulo` / `.th-acao` / `.th-acao.ativo` vive no `<style>` de `maquinas/index.html`, não em `shared/pmoc.css`.

**Estado de /reparos (apurado, não reinvestigar):** as três tabelas não têm clique de edição; a linha de Reparos abre `abrirModalVinculo(id)`; os três `abrirModal*()` não recebem id e os três `salvar*()` só fazem `insert`; filtros existem só no Diagnóstico (`dg-modelo`, `dg-sistema`, `dg-busca`); `podeCatalogo()` = admin+gestor governa modelos e serviços, `podeConhecimento()` = admin+gestor+tecnico governa reparos, e `aplicarPermissoes()` já esconde os três botões de criar.

**Colunas reais das tabelas `rep_*` (migração 26):** `rep_modelos(codigo, fabricante, modelo, categoria, motor, unidade_uso, ano_inicio, ano_fim, origem, obs, ativo)`; `rep_servicos(codigo, nome, especialidade, tempo_padrao_h, valor_hora, descricao, origem, ativo)`; `rep_reparos(codigo, modelo_id, sistema, sintoma, causa_provavel, gravidade, frequencia, procedimento, origem, ativo)`.

**Categorias reais em produção:** `rocadeira` (2 modelos), `trator` (3), `motoserra` (1), `minitrator` (1). Gravadas sem acento; a tela mostra com acento e inicial maiúscula.

**Gates que não podem quebrar:** `tests/integracao-reparos.test.js` exige que todo nome chamado por handler inline no markup de /reparos esteja em `exporNoWindow()`; `tests/mobile-375.test.js` proíbe `width:<n>px` acima de 375px fora de `min()` ou `@media` nos index.html dos módulos e exige `<table class="tbl">` dentro de `.tbl-wrap`; `tests/estoque-cabecalho-maquinas.test.js` é o contrato do núcleo.

</interface_context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: núcleo de tabela promovido a shared/tabela.js e edição de cadastro pelos três modais de /reparos (D1, D2)</name>
  <files>shared/tabela.js, maquinas/estoque-tabela.js, reparos/app.js, reparos/index.html, tests/tabela-compartilhada.test.js, tests/reparos-tabelas.test.js</files>
  <behavior>
    Núcleo genérico (tests/tabela-compartilhada.test.js):
    - `proximaOrdem` e `normalizarBusca` mantêm o comportamento de ontem, agora exportados de shared/tabela.js.
    - `comparar(a, b, coluna, dir, colunas)` e `aplicarOrdemEFiltro(lista, ord, filtros, colunas)` funcionam com uma definição de colunas inventada no próprio teste (dois campos que não existem em material nenhum) — prova de que nada de estoque sobrou escrito no código.
    - ordem numérica por `valor()` onde a coluna é numérica, `localeCompare('pt-BR')` sobre `texto()` no resto, vazio no fim nas duas direções, zero não é vazio.
    - coluna desconhecida devolve 0 no comparador e é ignorada no filtro.
    - `shared/tabela.js` importado em Node puro não lança.
    Adaptador (tests/estoque-cabecalho-maquinas.test.js, sem alteração):
    - as quatro exportações de maquinas/estoque-tabela.js continuam com as assinaturas de ontem e os mesmos resultados sobre os mesmos dados.
    Edição por modal (tests/reparos-tabelas.test.js):
    - os três `abrirModal*(id)` aceitam id opcional; com id preenchem os campos e o título de edição, sem id limpam e mostram o título de criação.
    - os três `salvar*()` fazem update quando há registro em edição e insert quando não há, e recusam a operação quando o cargo não passa no gate da tabela.
    - o ⚙ de cada linha está sob o gate correto e o de Reparos interrompe a propagação do clique da linha.
  </behavior>
  <action>
Criar `shared/tabela.js` movendo para lá, sem mudança de comportamento, o núcleo puro que hoje vive em `maquinas/estoque-tabela.js`: o ciclo de ordem de três estados, a normalização de busca (minúsculas mais NFD sem diacríticos), o teste interno de valor ausente (nulo, indefinido, string vazia ou NaN — zero não é ausência) e as duas funções dirigidas por colunas. Nas duas funções dirigidas por colunas o parâmetro `colunas` entra por último, para que o adaptador seja uma amarração fina: `comparar(a, b, coluna, dir, colunas)` e `aplicarOrdemEFiltro(lista, ord, filtros, colunas)`. Nenhum nome de campo de material pode aparecer no arquivo — a definição de colunas é sempre parâmetro. Cabeçalho de arquivo no padrão do repo, explicando que é o mesmo par núcleo-puro/aplicador-de-DOM de `shared/tema.js` e `mapa/mapa-geometria.js`, agora compartilhado por dois módulos.

Reduzir `maquinas/estoque-tabela.js` a `COLUNAS_ESTOQUE` mais o adaptador: importa de `shared/tabela.js`, reexporta o ciclo de ordem e a normalização de busca tal como estão, e envolve as duas funções dirigidas por colunas em wrappers que injetam `COLUNAS_ESTOQUE` e preservam exatamente as assinaturas que o gate de ontem chama (comparador com quatro argumentos, filtro com três). Comentário curto registrando que o gate do Estoque é contrato e que é o adaptador que absorve qualquer diferença de assinatura. Não tocar em `tests/estoque-cabecalho-maquinas.test.js` nem em `maquinas/app.js`.

Criar `tests/tabela-compartilhada.test.js` cobrindo o núcleo genérico com uma definição de colunas própria do teste (campos inventados, nada de material), incluindo os casos de vazio no fim nas duas direções, zero não vazio, acumulação de filtros de colunas diferentes, coluna desconhecida e importação em Node puro.

Em `reparos/app.js`, declarar três identificadores de registro em edição (um por tabela, iniciando nulos) na seção de estado do topo e transformar os três abridores de modal em criação-ou-edição: recebendo um id, buscam o registro no array já carregado, preenchem cada campo do formulário e escrevem o título de edição; sem id, limpam os campos, zeram o identificador e escrevem o título de criação. Os três títulos precisam de id no markup — o modal de reparo já tem, os de serviço e modelo ganham um. Em cada `salvar*()`, primeira linha de código do corpo, uma guarda de cargo pelo gate que já governa aquela tabela (catálogo para modelos e serviços, conhecimento para reparos) com mensagem em português dizendo que o cargo não altera aquele cadastro; em seguida, o mesmo objeto de campos já montado hoje passa a alimentar update filtrado pelo id em edição quando há um, e insert quando não há. Ao fechar o modal, zerar o identificador de edição, para que a próxima abertura pelo botão de criar não caia no ramo de update.

Em `reparos/index.html`, acrescentar às três tabelas uma coluna final de ações (cabeçalho sem rótulo) e ajustar o `colspan` das três mensagens de carregamento; em `reparos/app.js`, acrescentar aos três templates de linha a célula de ações com um botão `⚙` sob o gate daquela tabela, com `title` e `aria-label` em português, chamando o abridor de modal com o id da linha — e no de Reparos, interrompendo a propagação do clique antes de chamar, porque a linha inteira já abre o modal de peças e serviços. Ajustar também os `colspan` das mensagens de tabela vazia geradas em JS. Publicar em `exporNoWindow()` qualquer nome novo chamado por handler inline.

Criar `tests/reparos-tabelas.test.js` com os casos de D1 acima, no estilo dos gates do repo (leitura dos arquivos e asserções sobre a estrutura, mais chamadas reais ao núcleo puro onde houver função pura). Registrar em comentário de cabeçalho que este gate cresce em três commits.
  </action>
  <verify>
    <automated>cd /home/luc/Downloads/pmoc-overlay && node --test tests/tabela-compartilhada.test.js tests/estoque-cabecalho-maquinas.test.js tests/reparos-tabelas.test.js tests/integracao-reparos.test.js && node --test 2>&1 | tail -8 | grep -E 'fail 0' && test -z "$(git status --porcelain tests/estoque-cabecalho-maquinas.test.js)" && grep -vE '^\s*//' shared/tabela.js | grep -cE 'estoque_atual|estoque_minimo|COLUNAS_ESTOQUE' | grep -qx 0 && echo OK</automated>
  </verify>
  <done>`shared/tabela.js` existe e é genérico; `maquinas/estoque-tabela.js` é definição de colunas mais adaptador; o gate do Estoque passa sem uma linha alterada no arquivo de teste; as três tabelas de /reparos têm ⚙ na célula de ações sob o gate correto; os três modais criam e editam; `node --test` verde com os novos casos somados aos 279.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ordenação e filtro por coluna nas três tabelas de /reparos, com colunas densas (D2, D3)</name>
  <files>reparos/tabelas.js, reparos/app.js, reparos/index.html, tests/reparos-tabelas.test.js</files>
  <behavior>
    - `COLUNAS_REPAROS` tem 5 colunas, `COLUNAS_SERVICOS` 4 e `COLUNAS_MODELOS` 4, cada uma com id, rótulo, tipo, `valor()` e `texto()`.
    - o `texto()` de cada coluna agrupada contém todos os dados que a célula exibe — filtrar por fabricante, por causa provável, por gravidade ou por valor-hora encontra a linha mesmo sem coluna própria para eles.
    - os construtores de linha de exibição são puros: recebem os arrays como argumento e devolvem o objeto que a coluna e o template de linha leem, incluindo as contagens de peças, serviços, usos, máquinas e reparos.
    - ordem numérica nas colunas de contagem e de tempo, textual pt-BR no resto, vazios no fim nas duas direções.
    - filtros de colunas diferentes se acumulam; substring sem acento e sem caixa.
    - `reparos/tabelas.js` importado em Node puro não lança.
  </behavior>
  <action>
Criar `reparos/tabelas.js`, núcleo puro do módulo no mesmo padrão de `maquinas/estoque-tabela.js`: sem API de navegador, sem leitura de variável global, tudo recebido por parâmetro. Ele exporta três coisas por tabela — a definição de colunas e o construtor da linha de exibição — mais o que a Task 3 vai acrescentar.

Construtores de linha de exibição: para Reparos, recebe a lista de reparos, a de modelos, a de vínculos de material e a de vínculos de serviço, e devolve por reparo um objeto com os campos do registro mais o texto do modelo (fabricante e modelo, ou a palavra que hoje indica reparo sem modelo) e as duas contagens; para Serviços, recebe serviços e vínculos de serviço e acrescenta a contagem de usos; para Modelos, recebe modelos, ativos e reparos e acrescenta as contagens de máquinas e de reparos. Guardar o registro original dentro do objeto de linha, porque o template precisa do id para os handlers.

Definições de coluna, com o `texto()` de cada célula agrupada carregando tudo o que a célula mostra — é o que mantém filtrável e ordenável o que perdeu coluna própria (D3):
- Reparos, 5 colunas: código com o modelo abaixo; sintoma com a causa provável abaixo; sistema e gravidade como dois selos na mesma célula; confirmações, numérica pela frequência; peças e serviços, numérica pela contagem de peças e com as duas contagens no texto.
- Serviços, 4 colunas: código com o nome abaixo; especialidade; tempo padrão com o valor-hora na mesma célula, numérica pelo tempo (o dado primário) e com os dois valores no texto; usado em, numérica pela contagem.
- Modelos, 4 colunas: código com fabricante e modelo abaixo; tipo, lendo a categoria; motor; máquinas e reparos na mesma célula, numérica pela contagem de máquinas e com as duas no texto.
Documentar em comentário, nas duas colunas mistas, qual dos dois valores rege a ordenação e por quê — a alternativa (ordenar por texto concatenado) produziria ordem sem significado.

Em `reparos/app.js`, importar de `shared/tabela.js` o ciclo de ordem e a função que aplica ordem e filtro, e de `reparos/tabelas.js` as definições e os construtores. Declarar o estado de tela por tabela — coluna e direção de ordem, mapa de filtros e sinalizador de linha de filtros aberta — três conjuntos independentes, um por aba. Substituir cada `render*()` das três tabelas por um par cabeçalho/corpo, exatamente como em Máquinas: a função de entrada só delega; a de cabeçalho desenha o `<thead>` a partir da definição de colunas, com `aria-sort` no th, botão de ordem de três estados, ⌕ com estado visual de filtro ativo e a coluna final de ações sem rótulo, mais a linha de campos de filtro quando aberta; a de corpo constrói as linhas de exibição, aplica ordem e filtro, escreve o `<tbody>` no formato denso e atualiza o contador. Digitar num campo de filtro chama só a função de corpo — redesenhar o cabeçalho a cada tecla mataria o foco e o cursor. Os handlers de ordenar, abrir filtro, aplicar filtro e limpar recebem qual tabela estão operando, para que uma única implementação sirva às três, e todos entram em `exporNoWindow()`. Nada disso pode consultar o Supabase nem chamar a função de recarga geral.

Em `reparos/index.html`, trocar os três cabeçalhos estáticos por `<thead>` vazios com id, mantendo cada tabela dentro de `.tbl-wrap`; acrescentar ao cabeçalho de cada uma das três views o contador de linhas visíveis e o botão de limpar filtros, escondido enquanto não houver ordem nem filtro; e acrescentar ao `<style>` do módulo as classes do rótulo e dos botões do th e um conjunto compacto de regras escopado às tabelas deste módulo — espaçamento vertical menor de célula, tamanho de fonte reduzido para a linha secundária de cada célula agrupada e alinhamento superior das células. Nenhuma dessas regras pode ir para `shared/pmoc.css`, que é consumida por seis módulos, nem declarar largura absoluta acima da tela alvo fora de `min()` ou `@media`.

Crescer `tests/reparos-tabelas.test.js` com os casos de D2 e D3: as contagens de coluna por tabela, a presença de cada dado agrupado no texto da coluna que passou a contê-lo, ordem numérica e textual com vazios no fim, acumulação de filtros, a existência dos três theads por id, a separação cabeçalho/corpo, a ausência de consulta ao Supabase e de recarga geral nas funções de ordem e filtro, os handlers publicados no window e o CSS compacto escopado ao módulo.
  </action>
  <verify>
    <automated>cd /home/luc/Downloads/pmoc-overlay && node --test tests/reparos-tabelas.test.js tests/integracao-reparos.test.js tests/mobile-375.test.js && node --test 2>&1 | tail -8 | grep -E 'fail 0' && grep -vE '^\s*//' reparos/tabelas.js | grep -cE 'document\.|window\.|supa\.' | grep -qx 0 && test -z "$(git diff --name-only HEAD -- shared/pmoc.css)" && echo OK</automated>
  </verify>
  <done>As três tabelas de /reparos mostram 5, 4 e 4 colunas mais ações, ordenam e filtram por coluna sem ir ao banco, o dado que perdeu coluna própria continua visível e alcançável pelo filtro da coluna que o contém, o CSS compacto está no `<style>` do módulo, `shared/pmoc.css` intocado e `node --test` verde.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: filtro e agrupamento por tipo de máquina nas três abas de /reparos (D4)</name>
  <files>reparos/tabelas.js, reparos/app.js, reparos/index.html, tests/reparos-tabelas.test.js</files>
  <behavior>
    - o vocabulário de tipo devolve rótulo acentuado e capitalizado para as quatro categorias em produção e cai para a capitalização simples do valor bruto numa categoria desconhecida.
    - as opções do controle saem dos dados: um grupo com as categorias distintas presentes em rep_modelos e outro com fabricante mais modelo.
    - filtro de reparos: reparo sem modelo passa sempre; com modelo, passa quando o modelo é o escolhido ou tem a categoria escolhida.
    - filtro de modelos: passa quando é o modelo escolhido ou tem a categoria escolhida.
    - filtro de serviços: passa quando algum reparo que sobrevive ao filtro o consome; serviço sem nenhum vínculo passa só com o filtro vazio.
    - agrupamento: devolve grupos com chave, rótulo e linhas, na ordem dos rótulos em pt-BR, com o grupo de ausência por último e a ordem de entrada preservada dentro de cada grupo.
    - serviço usado por mais de uma categoria cai num grupo único de vários tipos; serviço sem vínculo, no grupo de ausência.
  </behavior>
  <action>
Em `reparos/tabelas.js`, acrescentar o vocabulário de tipo de máquina (mapa fechado das quatro categorias gravadas para o rótulo acentuado e capitalizado que a tela mostra, com queda para a capitalização simples do valor bruto quando a categoria não estiver no mapa — uma categoria nova cadastrada amanhã tem que aparecer, não sumir), o construtor das opções do controle a partir dos modelos carregados (um grupo de categorias distintas, um grupo de modelos identificados por fabricante e modelo), os três predicados de filtro por tipo ou modelo — um por aba, com as regras exatas do bloco de comportamento acima, e o de reparos preservando literalmente a regra que já existe hoje de que reparo sem modelo nunca é filtrado fora — e a função de agrupamento, que recebe as linhas já ordenadas e filtradas mais uma função de chave e devolve os grupos com rótulo e contagem, ordenados pelo rótulo em pt-BR e com o grupo de ausência ao fim. Definir a chave de agrupamento de cada aba: modelos pela própria categoria; reparos pela categoria do modelo, ou grupo de ausência quando o reparo não tem modelo; serviços pela categoria dos reparos que o consomem, caindo no grupo de vários tipos quando são mais de uma e no de ausência quando não há vínculo — documentar essa última regra em comentário, porque duplicar o serviço em vários grupos seria a alternativa e mentiria sobre a contagem.

Em `reparos/app.js`, declarar o tipo/modelo escolhido e o sinalizador de agrupamento como estado de tela do módulo (um só par para as três abas — é um controle único com três apresentações). Popular os três controles a partir das opções construídas no núcleo puro, sempre que os dados forem recarregados, preservando a escolha atual. O handler do controle grava a escolha, ressincroniza os outros dois controles com o mesmo valor e redesenha as três tabelas; o botão de agrupar inverte o sinalizador e redesenha as três. Nas três funções de corpo de tabela, aplicar o predicado de tipo antes da ordem e do filtro por coluna; quando o agrupamento estiver ligado, intercalar entre as linhas uma linha de cabeçalho de grupo com o rótulo e a contagem do grupo, ocupando a largura da tabela. O contador de linhas visíveis passa a considerar também o filtro por tipo. Limpar filtros zera igualmente a escolha de tipo. Publicar os nomes novos em `exporNoWindow()`. Não alterar os três controles do Diagnóstico além do necessário para que continuem funcionando.

Em `reparos/index.html`, acrescentar ao cabeçalho de cada uma das três views o `<select>` de tipo de máquina com dois `<optgroup>` preenchidos por JS e o botão de agrupar por tipo, com estado visual de ligado, e ao `<style>` do módulo a regra da linha de cabeçalho de grupo, escopada ao módulo.

Crescer `tests/reparos-tabelas.test.js` com os casos de D4 acima, exercitando os predicados e o agrupamento com listas montadas no próprio teste, mais as asserções de fiação: os três controles presentes no markup, o estado compartilhado entre as abas, os nomes novos publicados no window e a escolha de tipo entrando no contador e no limpar.
  </action>
  <verify>
    <automated>cd /home/luc/Downloads/pmoc-overlay && node --test tests/reparos-tabelas.test.js tests/integracao-reparos.test.js tests/mobile-375.test.js tests/estoque-cabecalho-maquinas.test.js && node --test 2>&1 | tail -8 | grep -E 'fail 0' && test -z "$(git status --porcelain supabase/)" && echo OK</automated>
  </verify>
  <done>As três abas de /reparos têm o mesmo controle de tipo de máquina com categorias e modelos, filtrando cada aba pela sua regra e com reparo sem modelo sempre presente; agrupar por tipo insere cabeçalhos de grupo com contagem e convive com ordem e filtro; nenhum arquivo em `supabase/` foi criado ou alterado; `node --test` verde.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → PostgREST | todo update e insert dos três modais atravessa aqui; o cargo do usuário só é verdade do lado do Postgres |
| dado do banco → innerHTML | sintoma, causa, procedimento, fabricante e categoria vêm da tabela e são interpolados em template literal |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-vtm-01 | Elevation of Privilege | ⚙ e guardas de `salvar*()` em reparos/app.js | medium | mitigate | Diferente do Estoque, aqui a checagem de cliente **espelha** a RLS real: a migração 26 concede escrita em `rep_modelos`/`rep_servicos` a admin e gestor e em `rep_reparos` a admin, gestor e técnico — exatamente os gates usados. Um técnico que force o update de um modelo pelo console leva recusa do Postgres, não só da tela. Não afrouxar os gates nem trocá-los por um único helper comum às três tabelas. |
| T-vtm-02 | Tampering | update dos três `salvar*()` | medium | mitigate | O update é sempre filtrado pelo id do registro em edição, que só é atribuído pelo abridor de modal a partir de uma linha renderizada. Fechar o modal zera o identificador, para que a próxima criação não vire update silencioso de outro registro. |
| T-vtm-03 | Information Disclosure | células agrupadas e rótulos de grupo escritos por template literal | medium | mitigate | Todo texto vindo do banco passa pela função de escape que o módulo já usa antes de entrar no markup, inclusive nos novos textos concatenados de célula agrupada, nos rótulos de grupo e nos valores de `<option>` do controle de tipo. |
| T-vtm-04 | Denial of Service | ordenação e filtro em memória | low | accept | Volume real: 33 reparos, 25 serviços, 7 modelos. Ordenar e filtrar em memória a cada tecla é irrelevante nessa escala e evita ida ao banco. |
| T-vtm-SC | Tampering | instalação de pacotes | low | accept | Nenhuma dependência nova: zero-build, sem npm, sem biblioteca de tabela. Não há instalação a auditar nesta task. |
</threat_model>

<verification>
1. `node --test` na raiz: 279 casos de hoje mais os novos, tudo verde, nenhum teste apagado.
2. `git status --porcelain tests/estoque-cabecalho-maquinas.test.js` vazio ao fim da Task 1 — o gate do Estoque é contrato, não rascunho.
3. `git status --porcelain supabase/` vazio ao fim das três tasks — nenhuma migração criada ou alterada.
4. `git diff --stat shared/pmoc.css` vazio — o CSS compacto ficou escopado ao `<style>` de `reparos/index.html`.
5. Verificação manual no navegador (abrir `reparos/index.html` ou servir a raiz), nas três abas: ⚙ abre o modal preenchido e salvar altera o registro; ordenar cicla nos três estados numa coluna por vez; ⌕ abre a linha de filtros com o foco no campo certo e digitar não perde o cursor; filtro por fabricante, por causa provável e por valor-hora encontra a linha pela coluna agrupada; escolher um tipo filtra as três abas ao mesmo tempo e agrupar insere os cabeçalhos com contagem.
6. Confirmar que `/maquinas`, aba Estoque, continua ordenando e filtrando exatamente como ontem — é o consumidor do núcleo promovido.
</verification>

<success_criteria>
- As três tabelas de /reparos editam cadastro pelo modal que já existia, sob os cargos que já governavam cada tabela, sem afordância escondida (D1).
- O núcleo de ordenação e filtro é um só, em `shared/tabela.js`, dirigido por definição de colunas, consumido por Máquinas e /reparos, com o gate do Estoque passando sem alteração (D2).
- As três tabelas ordenam e filtram por coluna, de tela, com o comportamento idêntico ao do Estoque (D2).
- Reparos, Serviços e Modelos mostram 5, 4 e 4 colunas mais ações, sem perder nenhum dado de vista nem de alcance do filtro (D3).
- Um controle de tipo de máquina filtra e agrupa as três abas, com o vocabulário de categoria e de modelo saindo dos dados (D4).
- Nenhuma aba de peças, nenhum catálogo de material duplicado, nenhuma migração (D5).
- `node --test` verde na raiz.
</success_criteria>

<output>
Criar `.planning/quick/260818-vtm-reparos-editar-cadastro-por-modal-nas-tr/260818-vtm-SUMMARY.md` ao concluir.
</output>
