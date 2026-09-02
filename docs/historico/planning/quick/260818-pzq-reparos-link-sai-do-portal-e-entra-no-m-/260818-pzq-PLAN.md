---
phase: quick
plan: 260818-pzq
type: execute
wave: 1
depends_on: []
files_modified:
  - index.html
  - maquinas/index.html
  - maquinas/app.js
  - tests/integracao-reparos.test.js
  - tests/integracao-operacoes-maquinas.test.js
  - tests/ficha-ativo-maquinas.test.js
autonomous: true
requirements: []
must_haves:
  truths:
    - "O portal não oferece mais Reparos como módulo próprio; quem procura o catálogo chega por dentro do Máquinas."
    - "A categoria Tobata pode ser escolhida no cadastro da máquina e usada como filtro na lista."
    - "Abrir a ficha de uma máquina mostra as manutenções vencidas/próximas dela, sem trocar de aba."
    - "A barra de abas do Máquinas cai de 10 para 8 itens: Vencimentos vive dentro de Máquinas e Operações dentro de OS."
    - "node --test continua verde (225 testes hoje) com os gates ajustados às decisões acima."
  artifacts:
    - "index.html sem o cartão /reparos"
    - "maquinas/index.html com link /reparos, opção Tobata nos dois selects, seções mescladas e bloco de vencimentos na ficha"
    - "maquinas/app.js com navItems de 8 abas e vencimentos renderizados em abrirFichaAtivo"
  key_links:
    - "renderVencimentos() → #venc-content (id preservado ao mover para view-ativos)"
    - "renderOperacoes() → #operacoes-kpis/#operacoes-kanban/#tb-areas (ids preservados ao mover para view-os)"
    - "abrirFichaAtivo(id) → calcVencimentos() filtrado pelo ativo → #ficha-vencimentos"
    - "ficha-btn-venc → abrirVencMaquina(id) (popup de itens já existente)"
---

<objective>
Três ajustes no módulo Máquinas e no portal: tirar Reparos do portal e ancorá-lo dentro do Máquinas (onde o catálogo é de fato consumido, na OS corretiva), acrescentar a categoria Tobata, e reduzir a barra de abas trazendo Vencimentos para dentro de Máquinas e Operações para dentro de OS — com os vencimentos da máquina também visíveis na ficha.

Purpose: o portal lista sistemas, não sub-catálogos de um sistema; e o mecânico não deveria trocar de aba para saber o que está vencido na máquina que ele acabou de abrir.
Output: portal e módulo Máquinas ajustados, gates de teste atualizados às novas decisões, `node --test` verde.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@index.html
@maquinas/index.html
@maquinas/app.js
@shared/shell.js

Fatos já apurados nesta investigação (não precisam ser reconfirmados):
- `maq_ativos.categoria` é `text not null` **sem check constraint** (supabase/01_maquinas_schema.sql:8) e nenhuma migração posterior adicionou restrição a essa coluna. **Não há migração a escrever** — a lista de categorias é só cliente, nos dois `<select>` de `maquinas/index.html` (`filtro-cat`, linha ~128; `at-cat`, linha ~483). "Tobata" hoje aparece no seed apenas como *fabricante* (`02_maquinas_seed.sql:49`), não como categoria.
- A faixa de abas é montada em tempo de execução por `shared/shell.js` a partir de `navItems` em `boot()` (`maquinas/app.js:2432-2443`). **Não mexer em `shared/shell.js`** — ele monta o header dos 6 módulos e qualquer link ali vazaria para os outros 5.
- `trocarView()` (app.js:243) alterna elementos `.view`; um `.view` dentro de outro `.view` quebraria a alternância. Por isso a mesclagem move o **conteúdo** e apaga o invólucro `.view`, preservando os ids internos.
- `irParaAba()` (app.js:344) clica no `.nav-btn[data-view=...]`. O painel só chama `irParaAba('os')`, `'ativos'` e `'materiais'` — nenhuma referência a `'vencimentos'` ou `'operacoes'`, então remover essas duas abas não deixa botão órfão.
- `node --test` hoje: 225 testes, 0 falhas.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reparos sai do portal e passa a ser alcançado de dentro do Máquinas</name>
  <files>index.html, maquinas/index.html, tests/integracao-reparos.test.js</files>
  <action>
Em `index.html`, apagar o cartão inteiro do módulo Reparos — o bloco `<a class="card" href="/reparos"> … </a>` (ícone 🛠, título "Reparos", tags v1.0 / 33 reparos), que hoje fica entre o cartão de Máquinas de corte e o de Transportes. Nada mais no portal muda: `vercel.json` continua com o rewrite de `/reparos` (a rota permanece válida, só deixa de ser anunciada no índice de sistemas).

Em `maquinas/index.html`, dar entrada ao catálogo no ponto onde ele é consumido: o cabeçalho da view de OS (`<div class="view" id="view-os">`), ao lado do botão `+ OS`. Envolver os dois num contêiner de ações e acrescentar uma âncora estilizada como botão secundário, texto "🛠 Catálogo de reparos", `href="/reparos"` (caminho absoluto de raiz — `tests/modulos-caminhos.test.js` proíbe relativo simples nos módulos) e `title` explicando que é o catálogo sintoma → causa por modelo. Comentário curto em português acima da âncora dizendo por que o link mora aqui e não no portal: Reparos é o catálogo de diagnóstico que a OS corretiva usa, não um sistema à parte.

Não usar `navItems` nem tocar em `shared/shell.js`: um item de aba dispara `trocarView('<id>')` e procuraria um `.view` inexistente, e o shell é compartilhado pelos 6 módulos.

Em `tests/integracao-reparos.test.js`, o gate "reparos está roteado no Vercel e visível no portal" (por volta da linha 96) codifica a decisão antiga. Atualizar para a decisão nova, mantendo as duas asserções do rewrite (`source === '/reparos'` e `destination === '/reparos/index.html'`) e trocando a asserção sobre o portal por duas: o portal não aponta mais para essa rota, e `maquinas/index.html` aponta. Renomear o teste para algo como "reparos está roteado no Vercel e é alcançado por dentro do Máquinas" e deixar uma linha de comentário registrando a decisão (18/08/2026) para que uma fase futura não "conserte" o portal de volta.
  </action>
  <verify>
    <automated>node --test 2>&1 | tail -8</automated>
    <automated>grep -c 'href="/reparos"' index.html | grep -qx 0 &amp;&amp; grep -q 'href="/reparos"' maquinas/index.html &amp;&amp; echo OK-LINK</automated>
  </verify>
  <done>Portal sem cartão de Reparos; `maquinas/index.html` com âncora para `/reparos` no cabeçalho da view de OS; `node --test` verde com o gate de integração reescrito para a decisão nova.</done>
</task>

<task type="auto">
  <name>Task 2: Categoria Tobata no cadastro e no filtro de máquinas</name>
  <files>maquinas/index.html</files>
  <action>
Acrescentar a categoria Tobata nos dois únicos lugares onde a lista de categorias existe (é lista de cliente — `maq_ativos.categoria` é texto livre no banco, sem check constraint, então nenhuma migração é necessária):

1. Filtro da aba de máquinas, `<select id="filtro-cat">`: nova opção `value="tobata"` com rótulo no plural, no mesmo estilo das vizinhas ("Roçadeiras", "Mini-tratores"), posicionada junto dos tratores/mini-tratores — Tobata é a família de mini-trator agrícola usada na oficina, não um "outro".
2. Formulário da máquina, `<select id="at-cat">`: opção `value="tobata"` com rótulo no singular ("Tobata"), na mesma posição relativa da lista do filtro, para que as duas listas fiquem na mesma ordem.

O valor gravado é a string em minúsculas sem acento (`tobata`), consistente com `rocadeira`/`minitrator`/`motoserra` já em uso. Manter `outro` como última opção nas duas listas. Nada em `maquinas/app.js` precisa mudar: `renderAtivos()` compara `a.categoria === cat` direto e a ficha exibe `ativo.categoria` como texto.
  </action>
  <verify>
    <automated>grep -c 'value="tobata"' maquinas/index.html | grep -qx 2 &amp;&amp; echo OK-TOBATA</automated>
    <automated>node --test 2>&1 | tail -8</automated>
  </verify>
  <done>Os dois selects de categoria oferecem Tobata com valor `tobata`; suíte segue verde; nenhum arquivo em `supabase/` foi criado ou alterado.</done>
</task>

<task type="auto">
  <name>Task 3: Vencimentos na ficha da máquina e unificação de duas abas</name>
  <files>maquinas/index.html, maquinas/app.js, tests/integracao-operacoes-maquinas.test.js, tests/ficha-ativo-maquinas.test.js</files>
  <action>
Três mudanças coordenadas. Regra que rege todas: **preservar os ids dos contêineres**, para que `renderVencimentos()`, `renderOperacoes()` e `renderAgenda()` continuem intactas.

**(a) Vencimentos vira seção da aba Máquinas.** Em `maquinas/index.html`, remover o invólucro `<div class="view" id="view-vencimentos"> … </div>` e mover seu miolo para o fim de `<div class="view" id="view-ativos">`, logo após o `div.tbl-wrap` da tabela de máquinas: um `<h3 class="section-spaced">Vencimentos de manutenção</h3>`, a linha de subtítulo em `class="view-sub"` e o `<div id="venc-content">` sem alteração nenhuma no id nem no conteúdo inicial de carregamento.

**(b) Operações vira seção da aba OS.** Mesmo movimento: remover o invólucro `<div class="view" id="view-operacoes"> … </div>` e mover seu miolo para o fim de `<div class="view" id="view-os">`, depois da tabela de OS — cabeçalho `<h3 class="section-spaced">Operações de serviço</h3>` com os botões `btn-nova-area` e `btn-nova-operacao` (ids preservados, `aplicarPermissoesOperacoes()` depende deles), o subtítulo, `<div class="kpi-row" id="operacoes-kpis">`, `<div class="kanban" id="operacoes-kanban">`, o `<h3>Áreas de serviço</h3>` e a tabela com `<tbody id="tb-areas">`. A aba Agenda permanece como está — não faz parte deste pedido.

Em `maquinas/app.js`, em `boot()`, remover de `navItems` os itens `{ id: 'vencimentos' … }` e `{ id: 'operacoes' … }`, deixando 8 abas (painel, ativos, os, agenda, materiais, consumo, ciclo, compras). Comentário em português acima da lista registrando por que essas duas viraram seção: vencimento é atributo da máquina e operação é execução de serviço — cada uma pertence à aba onde já se estava trabalhando.

**(c) Vencimentos na ficha.** Em `maquinas/index.html`, no `#modal-ficha`: acrescentar um botão `id="ficha-btn-venc"` na `section-row` de ações (ao lado de Registrar uso / Abrir OS), e um bloco `<div class="frow" id="ficha-vencimentos-wrap" style="display:none">` com rótulo "Manutenções" e `<div id="ficha-vencimentos" class="stack"></div>`, posicionado logo antes do bloco de operações agendadas — o que está vencido pesa mais que o que está agendado.

Em `abrirFichaAtivo(id)` (app.js ~2014), depois do trecho de instruções e antes do de operações agendadas, derivar os itens com `calcVencimentos().filter(i => i.ativo.id === id)` (a função já devolve ordenado por `pct` decrescente, então o pior vem primeiro), mostrar os 5 primeiros e esconder o wrapper quando a lista estiver vazia. Cada linha reaproveita o vocabulário visual já usado no popup: nome do plano, `a cada {intervalo} {unidade}`, a barra `uso-bar-wrap`/`uso-bar` com a mesma escala de cor por faixa de percentual (vermelho ≥100, amarelo ≥80, verde abaixo) e um selo dizendo vencido — com quanto passou — ou quanto falta. Reaproveitar `esc()` em todo texto vindo do banco. O botão `ficha-btn-venc` é ligado por `.onclick` em JS (mesmo padrão de `ficha-btn-uso`/`ficha-btn-os`), fechando a ficha e chamando `abrirVencMaquina(id)`, que já monta o popup com seleção de itens e geração de OS; esconder o botão quando a máquina não tiver item algum. Por ser ligação em JS, nada novo precisa entrar em `exporNoWindow()`.

**Gates.** Em `tests/integracao-operacoes-maquinas.test.js`, o teste "expõe operações, agenda e os três formulários do fluxo" afirma marcação e configuração de aba que esta tarefa remove de propósito. Ajustar: tirar da lista de trechos o id da view de operações removida (manter `id="view-agenda"`, `id="operacoes-kanban"`, `id="agenda-calendario"` e os três modais), substituir a asserção de item de aba `operacoes` em `app.js` por uma que prove a nova disposição — a marcação de operações fica dentro do bloco da view de OS e a configuração de abas não declara mais nem operações nem vencimentos — e manter intacta a asserção da aba agenda. Comentário curto registrando a decisão (18/08/2026) e por quê.

Em `tests/ficha-ativo-maquinas.test.js`, acrescentar um teste novo (sem remover nenhum existente) fixando a decisão desta tarefa: a ficha tem o contêiner de manutenções e o botão que leva ao popup de itens, e `abrirFichaAtivo` deriva os vencimentos da máquina em vez de repetir a conta — verificando que o corpo da função chama a função de cálculo já existente e filtra pelo ativo da ficha.

Rodar `node --test` e manter as 225 asserções verdes (o número sobe com o teste novo).
  </action>
  <verify>
    <automated>node --test 2>&1 | tail -8</automated>
    <automated>grep -c 'class="view" id=' maquinas/index.html | grep -qx 8 &amp;&amp; echo OK-ABAS</automated>
    <automated>grep -q 'id="venc-content"' maquinas/index.html &amp;&amp; grep -q 'id="operacoes-kanban"' maquinas/index.html &amp;&amp; grep -q 'id="tb-areas"' maquinas/index.html &amp;&amp; grep -q 'id="ficha-vencimentos"' maquinas/index.html &amp;&amp; echo OK-IDS</automated>
  </verify>
  <done>A barra de abas do Máquinas tem 8 botões; a aba Máquinas termina com a seção de vencimentos e a aba OS com a seção de operações, ambas renderizando pelos mesmos ids de antes; a ficha da máquina lista as manutenções dela e tem botão para o popup de itens; `node --test` verde com os dois gates atualizados.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → Supabase (PostgREST) | única fronteira do módulo; nenhuma tarefa aqui cria consulta nova |
| dado do banco → HTML por template literal | texto vindo de `maq_planos`/`maq_ativos` desenhado na ficha |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-pzq-01 | Tampering | bloco de vencimentos em `abrirFichaAtivo` | medium | mitigate | todo texto vindo do banco (nome do plano, unidade) passa por `esc()`, como já fazem as outras seções da ficha; só número calculado entra sem escape |
| T-pzq-02 | Elevation of Privilege | seção de operações movida para a aba OS | medium | mitigate | os ids `btn-nova-area`/`btn-nova-operacao` são preservados, então `aplicarPermissoesOperacoes()` continua escondendo os botões fora de admin/gestor; a regra real continua sendo a RLS de `maq_areas`/`maq_operacoes` |
| T-pzq-03 | Information Disclosure | link `/reparos` dentro do Máquinas | low | accept | a rota já é pública e protegida por login por cargo + RLS das tabelas `rep_*`; sair do portal não altera a superfície de acesso |
| T-pzq-04 | Tampering | categoria `tobata` gravada em `maq_ativos.categoria` | low | accept | coluna é texto livre por design desde a migração 01; o valor sai de um `<select>` fechado no cliente e a coluna não alimenta decisão de autorização |
| T-pzq-SC | Tampering | instalação de pacote | low | accept | nenhuma tarefa instala dependência — projeto é zero-build, sem npm |
</threat_model>

<verification>
1. `node --test` — 0 falhas, contagem ≥ 226 (225 atuais + o teste novo da ficha).
2. Abrir `/maquinas` com `python -m http.server` e conferir: 8 botões na faixa de abas; aba Máquinas com a tabela seguida da seção de vencimentos; aba OS com a tabela seguida do kanban de operações e da tabela de áreas; botão "🛠 Catálogo de reparos" abrindo `/reparos`.
3. Abrir a ficha de uma máquina com plano configurado: bloco "Manutenções" preenchido e o botão levando ao popup de itens já existente.
4. Abrir `/` (portal) e confirmar que Reparos não aparece mais na grade e que os demais 8 cartões seguem intactos.
5. Cadastrar/filtrar por Tobata no formulário e no filtro de categorias.
</verification>

<success_criteria>
- Portal sem cartão Reparos; `/reparos` alcançável de dentro do Máquinas e ainda roteado no `vercel.json`.
- `tobata` disponível nos dois selects de categoria; nenhum arquivo novo em `supabase/`.
- Ficha da máquina mostra manutenções vencidas/próximas da própria máquina, com acesso ao popup de itens.
- Faixa de abas do Máquinas com 8 itens; conteúdos de Vencimentos e Operações preservados dentro de Máquinas e OS, renderizados pelas mesmas funções e ids.
- `node --test` verde; `shared/shell.js` não modificado; nenhum dos outros 5 módulos alterado.
</success_criteria>

<output>
Create `.planning/quick/260818-pzq-reparos-link-sai-do-portal-e-entra-no-m-/260818-pzq-SUMMARY.md` when done
</output>
