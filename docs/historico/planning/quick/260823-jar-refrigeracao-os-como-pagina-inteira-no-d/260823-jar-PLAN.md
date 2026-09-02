---
phase: quick
plan: 260823-jar
type: execute
wave: 1
depends_on: []
files_modified:
  - refrigeracao/index.html
  - tests/refrigeracao-os-pagina.test.js
  - tests/fixtures/refrigeracao-os-gaveta.json
  - tests/refrigeracao-ficha-pagina.test.js
  - tests/refrigeracao-os-unificada.test.js
  - TESTES.md
autonomous: true
requirements: [QUICK-260823-jar]
subsystem: ui
tags: [refrigeracao, desktop, os, css, media-query, node-vm]

must_haves:
  truths:
    - "Em >=1024px, abrir uma OS (lista de OS, lista de Inst./Remoção, botão Abrir OS da ficha, retorno de qualquer ação) mostra a OS como PÁGINA inteira, ocupando a largura e a altura da viewport"
    - "Os seis campos de texto da OS deixam de morar num painel de ~380px: nenhum textarea da página tem menos de 870px de largura nem menos de 140px de altura"
    - "A página não rola; o que rola é cada zona por dentro — e nunca existe uma coluna vazia ao lado de outra"
    - "Abaixo de 1024px a OS continua sendo a gaveta de hoje, com HTML byte a byte idêntico ao de antes desta tarefa, nos cinco cenários do fixture"
    - "O mecanismo de página da ficha (registro do que está aberto, origem, voltar, re-alojamento) tem UM dono com dois consumidores — nenhuma segunda cópia"
    - "Instalação/Remoção vira página junto com a OS de manutenção — os dois segmentos passam pelo mesmo abridor"
    - "Cruzar 1024px nos dois sentidos preserva a OS aberta E o texto digitado e não salvo"
    - "O CSS de celular continua byte a byte igual ao fixture, e continua existindo exatamente um @media novo"
  artifacts:
    - refrigeracao/index.html
    - tests/refrigeracao-os-pagina.test.js
    - tests/fixtures/refrigeracao-os-gaveta.json
  key_links:
    - "manAbrirOS(logId) continua a porta única — os 25 pontos de chamada não mudam; o que muda é o continente escolhido lá dentro por TELA_LARGA (o mesmo contrato de D-92t-01 para openDetail)"
    - "manMontarOS devolve {regua, contexto[], trabalho[]} como CORTE DE PREFIXO da ordem que já existe — é isso que faz regua+contexto.join('')+trabalho.join('') ser byte a byte o h de hoje"
    - "renderPaginaAtiva() -> reAlojarDetalhe(): o mesmo gancho único de cruzar o limiar passa a despachar entre ficha e OS, em vez de ganhar um segundo ouvinte de resize"
---

<objective>
Em `>=1024px`, a ordem de serviço de `/refrigeracao` deixa de ser painel lateral e vira **página inteira** (`#page-os-detalhe`), com faixa de cabeçalho que carrega a régua de passos e um corpo de duas zonas que rolam por dentro enquanto a página não rola. Abaixo de 1024px nada muda — e isso é **provado**, não afirmado: o conteúdo da OS passa a ter uma fonte única e o HTML que a gaveta produz é comparado byte a byte, em cinco cenários, com uma impressão digital capturada antes da extração.

Purpose: a OS é onde se **escreve** — delineamento, parecer de aprovação, parecer de conferência, parecer de fiscalização, correção de dados e (quando a migração 43 rodar) comentário. Seis campos de texto espremidos num painel de ~380px foi exatamente a reclamação do usuário depois de abrir a versão de computador em produção. A ficha virou página ontem; a OS ficou para trás.
Output: `#page-os-detalhe` dentro do mesmo arquivo, CSS inteiro dentro do `@media (min-width:1024px)` que já existe, camada compartilhada de estado/navegação com dois consumidores, gate novo `tests/refrigeracao-os-pagina.test.js` mais o fixture da gaveta da OS.
</objective>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md

Alvo: `refrigeracao/index.html` (7.146 linhas). Baseline conferida agora: `node --test` = **908/908 verde**, árvore limpa, HEAD `7f777c0`, ramo `refrigeracao-os-pagina`.

**O irmão gêmeo (260823-92t, ontem) — o mecanismo a reusar, já conferido linha a linha:**
- `#page-ficha` é a sexta `.page`, irmã das outras cinco dentro de `#content` (linha 1000), nasce sem `.active`, sem nenhuma regra de CSS fora do `@media`.
- Seção `/* -- ficha: uma fonte, dois continentes -- */` (2333): `fichaBlocoLocal/Dados/Estado/Historico`, `fichaBlocos` (array de 5), `fichaIdentidade`, `fichaAcoes(id,alvo)`, `FICHA_COLUNAS`, `ABAS_NAV`/`indiceDaAba`/`ROTULOS_VOLTA`/`rotuloVolta` (2466-2484), `FICHA_ABERTA`/`FICHA_ORIGEM` (2491-2492), `botaoDaAba` (2497), `abrirFichaPagina` (2506), `voltarDaFicha` (2547), `reAlojarFicha` (2560), `abrirFichaGaveta` (2585), `openDetail` (2608, delega por `TELA_LARGA`).
- `renderPaginaAtiva` (6945) abre com `if(reAlojarFicha()) return;` — gancho único, chamado por `iniciarModoDeTela` (6957) na mudança de `matchMedia`. **Não existe um segundo ouvinte de resize e não deve passar a existir.**
- Escape (6978): dois ramos, gaveta primeiro, ficha-página depois.
- CSS da ficha-página: 5427-5468, **dentro** do `@media (min-width:1024px)`, que fecha em `}</style>` na linha 5469.
- `#app` no `@media` (5261) é grade `auto auto 1fr auto auto` × `56px 1fr`, `height:100vh;height:100dvh`; `#content` é `grid-row:2; grid-column:1/-1` — a página de detalhe tem a largura inteira da viewport, sem trilho lateral.

**O alvo (a OS), já conferido:**
- `manAbrirOS(logId)` (3627) monta uma string `h` **condicional** e escreve em `#drawer-body`; cabeçalho em `#dh-id`/`#dh-local`/`#dh-predio`/`#dh-pills`; rodapé em `#drawer-footer`; termina com `openDrawer()`. **25 pontos de chamada** (lista de OS, lista de movimentação, botão "Abrir OS" da ficha, e o retorno de cada ação: `manMudarStatus`, `manDelinear`, `manAprovar`, `manDevolver`, `manConferir`, `manConcluir`, `manFiscalizar`, `manCertificar`, `osAddItemUI`, `osDelItem`, `osAddComp`, `osDelComp`, `osEnviarComentarioUI`, `manMarcarChecklist`, `manSalvarDados`, `manEditarDados`, `manCancelarEdicao`, `manRegistrarEvidencia`, …).
- **A ordem em que `h` é montado hoje** (3660-3842), que é o que torna o corte possível: (1) régua `reguaPassos(...)` OU a nota "Registro direto" de `manSemFluxo`; (2) `1 · Abertura` (ou `manFormDados` quando `MAN_EDIT_ID===logId`); (3) `movPainelDaOS(...)` **ou** o bloco `Executor` (`UNI_OK`); (4) `2 · Delineamento`; (5) `3 · Execução`; (6) `4 · Conferência` **ou** (`4 · Fiscalização` + `osComposicaoAtaHtml`); (7) `osItensHtml`; (8) `osComentariosHtml`.
- Os seis campos de texto: `man-ed-desc` (3568, dentro de `manFormDados`), `man-delin-desc` (3718), `man-conf-parecer` (3793), `man-fis-parecer` (3816), `os-comentario-texto` (4256), mais os numéricos de `3 · Execução` (`man-ex-*`, 3744-3754) e os de item/composição (`oi-un-*`, `cp-*`, `cf-*`).
- `manCancelar` (3896) é o **único** ponto de ação de OS que chama `closeDrawer()` (3901).
- `ctInjectToggle` (4698): dois segmentos, `#seg-pmoc` ("OS") e `#seg-movim` ("Inst./Remoção") — **os dois listam com `manAbrirOS` como abridor** (2045/2052 em `renderOS`, 2102/2117 em `renderMovim`).
- `.fgt{...;min-height:80px}` (266), `.fg2{display:grid;grid-template-columns:1fr 1fr;gap:8px;...}` (268), `.dfields2{...1fr 1fr;gap:8px}` (248), `.ct-timeline{display:flex;...;margin:4px 0 12px;overflow-x:auto}` (4549), `#drawer-panel` no `@media` = `width:min(560px,46vw)` (5416).

Gates que este plano cruza:
- `tests/refrigeracao-desktop.test.js:333` — CSS fora de `@media` estritamente igual a `tests/fixtures/refrigeracao-css-mobile.css`.
- `tests/refrigeracao-desktop.test.js:369` — **exatamente um** `@media` novo, e ele é `(min-width:1024px)`. Proíbe um segundo limiar.
- `tests/refrigeracao-desktop.test.js:378` — nenhum seletor de elemento nu `table{`/`th{`/`td{`/`tr{`.
- `tests/refrigeracao-ficha-pagina.test.js` — o gate irmão, 28 casos. Lê `var FICHA_ABERTA = `, `var FICHA_ORIGEM = `, `ctx.FICHA_ABERTA`, `ctx.voltarDaFicha()`, `bloco(HTML,'function reAlojarFicha(){')` e `/FICHA_ABERTA\s*=\s*null;/` em quatro corpos. **Muda de alvo nesta tarefa (D-jar-18).**
- `tests/refrigeracao-os-unificada.test.js:727/734/762` — três casos estruturais que recortam `function manAbrirOS(logId){` até `async function manMudarStatus(` e exigem `flOS`/`reguaPassos`/`flComConferencia`/`flContrato`/`osItensHtml`/`osComentariosHtml` **dentro desse recorte**. **Mudam de alvo nesta tarefa (D-jar-18).**
- `tests/refrigeracao-os-unificada.test.js:417` — `carregarTelaCompleta(opts)`: o sandbox `node:vm` que já monta a tela inteira da OS (sete recortes, `supa` de mentira, `_logCache`, `esc`/`fmtDate`/`el`/`val` mockados) mas **substitui `manAbrirOS` por um contador** depois dos `runInContext`. É o molde do sandbox da Task 1 — copie a forma, não o mock de `manAbrirOS`.
</context>

<decisoes>

Cite estes identificadores no SUMMARY.

**D-jar-01 — sobe para camada compartilhada o ESTADO e a NAVEGAÇÃO; conteúdo e layout ficam por consumidor.** O projeto sobe para função compartilhada quando aparece o segundo consumidor, e este é o segundo — mas só a metade que é genuinamente a mesma. Três fatos decidem onde fica a linha: (a) existe **uma** gaveta e **um** lugar de página ativa, logo só uma coisa de detalhe pode estar aberta — dois registros independentes representariam um estado impossível, e o projeto prefere estrutura a disciplina; (b) `voltarDaFicha` e um `voltarDaOS` seriam byte a byte iguais a menos do registro que zeram; (c) `renderPaginaAtiva` tem **um** gancho de cruzar o limiar — dois re-alojadores não cabem nele sem um despachante. Já o conteúdo é genuinamente diferente (cinco blocos fixos × pilha condicional) e o layout também (três colunas fixas × duas zonas dirigidas pelo conteúdo): generalizar isso produziria um `switch` fantasiado de abstração. **Compartilhado:** `DETALHE_ABERTO`, `DETALHE_ORIGEM`, `detalheAbertoDe`, `lerOrigemDetalhe`, `PAGINAS_DETALHE`, `paginaDetalheAtiva`, `ativarPaginaDetalhe`, `voltarDoDetalhe`, `fecharDetalhe`, `reAlojarDetalhe`, mais `ABAS_NAV`/`indiceDaAba`/`ROTULOS_VOLTA`/`rotuloVolta`/`botaoDaAba` (que já eram genéricos e **não mudam uma linha**). **Por consumidor:** marcação, CSS, montadores e os quatro `abrir*`.

**D-jar-02 — um registro só, com tipo.** `var DETALHE_ABERTO = null;` ou `{tipo:'ficha'|'os', id:<number|string>}` substitui `FICHA_ABERTA`; `var DETALHE_ORIGEM = 'inv';` substitui `FICHA_ORIGEM`. Leitura por `detalheAbertoDe(tipo)`, que devolve o id quando o tipo bate e `null` caso contrário — nenhum chamador desestrutura o objeto à mão. `null` continua significando exatamente o que significava: **a gaveta mostra um formulário**, não um detalhe (zerado por `openLogForm`/`openEquipForm`/`openNewOS`/`closeDrawer`, que continuam sendo os quatro pontos).

**D-jar-03 — a origem é ATUALIZADA, nunca redefinida às cegas.** `lerOrigemDetalhe()` só grava `DETALHE_ORIGEM` quando a `.page.active` é uma das cinco abas (`indiceDaAba(chave) >= 0`); em qualquer outro caso **mantém a atual** em vez de cair para `'inv'`. É o que faz o encadeamento funcionar: quem triava Alertas → abriu a ficha → clicou "Abrir OS" volta aos **Alertas**, não ao Parque. Os três casos do gate irmão continuam passando sem edição porque o valor inicial da variável já é `'inv'` — o comportamento antigo era um caso particular deste.

**D-jar-04 — `manAbrirOS(logId)` continua sendo a porta única.** Mesmo nome, mesma assinatura, **os 25 pontos de chamada intocados**, nenhum deles editado. O que muda é dentro: `if(TELA_LARGA) return osAbrirPagina(logId); return osAbrirGaveta(logId);`. É o contrato de D-92t-01 aplicado ao segundo consumidor, e é o que faz a lista de OS, a lista de Inst./Remoção, o botão "Abrir OS" da ficha e o retorno de **cada** ação funcionarem nos dois continentes sem uma linha de edição em nenhum deles.

**D-jar-05 — uma fonte, duas apresentações, e o corte é um PREFIXO da ordem que já existe.** `manMontarOS(logId)` devolve `{equipId, entry, ident:{id,local,predio,pills}, regua, contexto:[], trabalho:[], rodape:{gaveta,pagina}}`. A gaveta escreve `regua + contexto.join('') + trabalho.join('')` em `#drawer-body`; a página distribui. A fronteira entre `contexto` e `trabalho` é **um ponto de corte na ordem de montagem de hoje, nunca uma reordenação** — os itens (1),(2),(3) da lista do `<context>` são `contexto` e os itens (4)…(8) são `trabalho`, exatamente nessa sequência. É isso, e só isso, que torna a igualdade byte a byte alcançável. Se um bloco futuro precisar mudar de zona, ele tem de mudar de lugar **na ordem** também; o fixture pega quem tentar o contrário.

**D-jar-06 — as zonas têm significado, não são metades.** `contexto` é o que se **lê enquanto se escreve**: `1 · Abertura` e `Movimentação`/`Executor`. `trabalho` é onde se **escreve**: Delineamento, Execução, Conferência **ou** Fiscalização+Composição da ata, Itens, Registro. A **régua de passos sai das duas zonas e vai para a faixa de cabeçalho** (`#osd-regua`), permanentemente visível: é a resposta a "onde estou no processo", a pergunta que se faz justamente enquanto se rola para escrever. Contexto nunca fica vazio (`1 · Abertura` existe sempre); trabalho pode ficar — e é aí que entra D-jar-07.

**D-jar-07 — grade dirigida pelo conteúdo: coluna única quando a segunda zona não se justifica.** Uma grade de colunas fixas com uma coluna vazia é pior que uma coluna só. Duas situações reais produzem isso e as duas caem na mesma regra pura `osUmaColuna(temTrabalho, editando)`:
1. **`trabalho` vazio** — linha legada sem fluxo (`manSemFluxo(st)` verdadeiro pula os blocos 2/3/4/itens) e sem `UNI_OK` (sem Registro). Sobra só o contexto.
2. **`MAN_EDIT_ID === logId`** — a correção de dados é um formulário de treze campos com o textarea `man-ed-desc`, e ele mora no bloco 1, ou seja, na zona **estreita**. Espremê-lo em 360px seria reproduzir exatamente a reclamação do usuário dentro da própria correção. Corrigir é um modo que toma a tela.

Em coluna única o renderizador **concatena** `contexto+trabalho` dentro de `#osd-contexto` e esconde `#osd-trabalho` (que fica com `innerHTML` vazio). Não se resolve isso por CSS: duas zonas com `overflow-y:auto` empilhadas em linhas de altura automática não rolam — o contêiner é que estoura e é cortado, e a rolagem volta para o lugar de onde este pedido a tirou.

**D-jar-08 — as larguras e alturas dos campos de texto, ditas em número, porque são o motivo do pedido.** Duas colunas: `grid-template-columns:minmax(0,360px) minmax(0,1fr)`, `gap:20px`, `padding:16px 24px`. Numa viewport de 1440px (`#content` ocupa a largura inteira, `#app` não tem trilho lateral) a zona de trabalho fica com ~1.010px e um `textarea` dentro de um `.ds` (padding 12px) com **~985px**. Coluna única: trilha de 900px centrada, `textarea` com **~875px**. Em 1024px, a zona de trabalho fica com ~594px e o textarea com ~570px — contra os ~330px úteis do painel de 380px de hoje. Altura: `#page-os-detalhe .fgt{min-height:140px}` contra os 80px de hoje (de ~3 para ~6 linhas visíveis). E, pelo mesmo motivo de D-92t-09, o que adapta entre 1024px e 1440px é o **interior** da zona, sem limiar novo: `#page-os-detalhe .fg2` e `#page-os-detalhe .dfields2` passam a `repeat(auto-fit,minmax(170px,1fr))` — no trilho de 360px isso colapsa para um campo por linha, na zona de trabalho abre até cinco.

**D-jar-09 — texto digitado e não salvo sobrevive ao cruzamento do limiar.** Perder o que a pessoa escreveu é pior que qualquer layout. `OS_CAMPOS_VOLATEIS` é a lista fechada dos ids de campo que a OS pode ter na tela (`man-ed-*`, `man-delin-desc`, `man-ex-*` numéricos, `man-conf-estado`, `man-conf-parecer`, `man-fis-parecer`, `oi-un-*`, `cp-*`, `cf-*`, `os-comentario-texto`); `osCapturarCampos()` lê os que existem, `osRestaurarCampos(mapa)` reescreve os que voltaram a existir. **`man-ex-fotos` fica deliberadamente fora**: o `value` de um `input[type=file]` não pode ser escrito por script, e listá-lo daria a impressão de que as fotos escolhidas sobreviveram quando não sobrevivem. `MAN_EDIT_ID` é global e sobrevive sozinho, então a correção volta aberta **e** preenchida. A captura/restauração acontece **só no caminho de re-alojamento** — nunca dentro de `manAbrirOS`, onde o re-render depois de uma ação **deve** limpar o campo que acabou de ser gravado.

**D-jar-10 — a rolagem das duas zonas é preservada quando o re-render é da MESMA OS.** `innerHTML =` zera o `scrollTop` do contêiner, e `manAbrirOS` é chamado depois de **cada** ação. Na gaveta isso já era assim e é uma rolagem só; na página são duas, e ser jogado ao topo de `trabalho` a cada item lançado ou comentário registrado numa OS de contrato é um incômodo **novo, criado por esta mudança**. `osAbrirPagina` lê os dois `scrollTop` antes de escrever e os devolve depois, **e só quando `detalheAbertoDe('os')` já era este mesmo `logId`** — abrir uma OS diferente começa do topo, como deve.

**D-jar-11 — o rodapé leva as mesmas ações de hoje, sem inventar nenhuma; muda a forma.** `manMontarOS` devolve `rodape.gaveta` **byte a byte** o de hoje (fechar em ícone, imprimir em ícone só quando `flContrato`, "Cancelar OS" em vermelho quando permitido) e `rodape.pagina` com os mesmos itens rotulados em texto ("Imprimir OS", "Cancelar OS"), porque na faixa há largura; o "fechar" **não** aparece na página — lá o equivalente é `#osd-voltar`, à esquerda da faixa. Fechar numa gaveta é ação; voltar numa página é navegação; o lugar dos dois não é o mesmo (D-92t-07).

**D-jar-12 — `manCancelar` fecha o continente certo.** É o único ponto de ação de OS que chamava `closeDrawer()`, e numa página `closeDrawer()` não fecha nada: a OS cancelada continuaria na tela. `fecharDetalhe()` (compartilhada, D-jar-01) resolve: página de detalhe ativa → `voltarDoDetalhe()`; senão → `closeDrawer()`. Nenhum outro ponto muda.

**D-jar-13 — Instalação/Remoção entra junto, por construção.** Os dois segmentos (`#seg-pmoc` e `#seg-movim`) já abrem pelo mesmo `manAbrirOS`, e a decisão de continente é **dentro** dele — não há um segundo abridor onde esquecer o segmento. `movPainelDaOS` vai para `contexto` (é referência: origem, destino, caso, máquina substituída, checklist de partes). Deixar um segmento em painel e outro em página seria pior que não fazer nada, e a estrutura torna isso impossível de acontecer por esquecimento.

**D-jar-14 — `navTo` zera `DETALHE_ABERTO`.** Navegar para uma lista significa que nenhum detalhe está aberto. Sem isso o registro passa a mentir depois de sair da página de detalhe pela barra de navegação, e o re-alojamento tomaria decisão sobre algo que já não está na tela.

**D-jar-15 — Escape ganha uma lista fechada, não um terceiro `if` avulso.** `PAGINAS_DETALHE = ['page-ficha','page-os-detalhe']` e `paginaDetalheAtiva()` respondem por ambas. A **ordem dos dois ramos não muda** (gaveta primeiro, página depois): um formulário aberto sobre a página tem de fechar o formulário, nunca navegar para longe do que o usuário estava digitando.

**D-jar-16 — CSS só dentro do `@media` que já existe, e nenhum `<style>` novo.** Anexe antes do `}` de fechamento do bloco `@media (min-width:1024px)` (linha 5469, `}</style>`), logo depois do bloco da ficha-página. Criar um `<style>` novo desloca a impressão digital do CSS de celular — a folha de impressão está embutida como texto de JavaScript e a extração ingênua de `<style>…</style>` a casa como se fosse bloco real (lição de 260822-8rz). Nenhum seletor de elemento nu (`table{`/`th{`/`td{`/`tr{`). **Se concluir que precisa de uma regra fora do `@media`, PARE e diga — não regenere `tests/fixtures/refrigeracao-css-mobile.css`.**

**D-jar-17 — a gaveta da OS é PROVADA intocada, em cinco cenários, não afirmada.** O conteúdo da OS é condicional; um fixture de um cenário só provaria um ramo. Os cinco: (a) `ABERTA`, interna, `UNI_OK` falso — o fluxo legado, que é o que está no ar hoje; (b) `EM_EXECUCAO`, interna, `UNI_OK` verdadeiro — Executor + Itens + Registro + conclusão direta; (c) OS de movimentação `INSTALAÇÃO` em `EM_EXECUCAO` — `movPainelDaOS` + bloco 4 de conferência; (d) contrato em `FISCALIZADA`, `UNI_OK` verdadeiro — Fiscalização + Composição da ata + Certificação; (e) linha legada sem fluxo (`manSemFluxo`) com `MAN_EDIT_ID` ligado — a nota "Registro direto", `manFormDados` e a zona de trabalho vazia. Cada entrada guarda `corpo`, `dhId`, `dhLocal`, `dhPredio`, `dhPills` e `rodape`.

**D-jar-18 — os gates existentes são REESCRITOS, nunca apagados.** Precedente D-92t-15. Dois arquivos mudam de alvo porque o **fato** mudou: (i) `tests/refrigeracao-os-unificada.test.js` casos das linhas 727/734/762 recortam o corpo de `manAbrirOS` e exigem lá dentro `flOS`/`reguaPassos`/`flComConferencia`/`flContrato`/`osItensHtml`/`osComentariosHtml`; depois da extração isso mora em `manMontarOS` e `manAbrirOS` é um despachante de quatro linhas — os três recortes passam a apontar para `manMontarOS`, e ganham um assert novo provando que `manAbrirOS` **não monta bloco por conta própria**; (ii) `tests/refrigeracao-ficha-pagina.test.js` aprende `DETALHE_ABERTO`/`DETALHE_ORIGEM`/`voltarDoDetalhe`/`reAlojarDetalhe`. Nenhum caso é removido.

**D-jar-19 — nenhuma migração, nenhum dado, nenhuma regra de fluxo.** É apresentação. Nada de Supabase, nada de `supabase/*.sql`, nenhum estado de OS novo, nenhuma mudança em `manPode`/`manPodeIrPara`/`osFluxoDe`. **O textarea de comentário atrás de `UNI_OK` NÃO é escopo deste plano**: o campo `os-comentario-texto` existe e está correto; o que falta é a migração 43, que é outro assunto e não deve ser "consertada" aqui.

**D-jar-20 — uma casa para cada coisa.** A camada compartilhada nasce numa seção nova `/* ── detalhe em página: estado e navegação (ficha e OS) ── */`, inserida **imediatamente antes** de `/* -- ficha: uma fonte, dois continentes -- */`, e recebe por mudança de endereço (sem reescrita de corpo) `ABAS_NAV`/`indiceDaAba`/`ROTULOS_VOLTA`/`rotuloVolta`/`botaoDaAba` e os dois registros renomeados. O código novo da OS (`manMontarOS`, `osAbrirGaveta`, `osAbrirPagina`, `osUmaColuna`, `OS_CAMPOS_VOLATEIS`, `osCapturarCampos`, `osRestaurarCampos`) mora **dentro** da seção `/* ── fluxo da OS interna: tela e ações ── */` que já existe — é ela que os recortes dos gates de OS alcançam, e sair dela quebraria sandboxes que não estão na lista deste plano.

</decisoes>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fonte única do conteúdo da OS, com a gaveta provada byte a byte em cinco cenários</name>
  <files>tests/refrigeracao-os-pagina.test.js, tests/fixtures/refrigeracao-os-gaveta.json, refrigeracao/index.html, tests/refrigeracao-os-unificada.test.js</files>
  <behavior>
    - `manMontarOS(logId)` devolve `null` para logId inexistente, e para os cinco cenários devolve um objeto com `ident` (quatro campos), `regua` (string não vazia), `contexto` (array), `trabalho` (array) e `rodape` (`{gaveta, pagina}`).
    - Nos cinco cenários, `regua + contexto.join('') + trabalho.join('')` é byte a byte igual ao `corpo` do fixture, e os quatro campos de `ident` mais `rodape.gaveta` são byte a byte iguais às demais chaves.
    - `contexto` traz `1 · Abertura` e, quando cabe, `Movimentação` ou `Executor` — e **nunca** um título de `trabalho`.
    - `trabalho` traz, quando cabem, `2 · Delineamento`, `3 · Execução`, `4 · Conferência` ou `4 · Fiscalização`+`5 · NF`, `Itens · serviços e materiais` e `Registro` — e **nunca** `1 · Abertura`.
    - No cenário (e) (linha legada sem fluxo, sem `UNI_OK`) `trabalho` sai **vazio** e `regua` traz a nota "Registro direto".
    - `rodape.gaveta` traz o botão de imprimir **só** no cenário de contrato, e o de cancelar só quando a transição para `CANCELADA` é permitida.
    - Cada um dos títulos de bloco aparece **exatamente uma vez** na união `contexto.concat(trabalho).join('')`.
  </behavior>
  <action>
Crie `tests/refrigeracao-os-pagina.test.js` **antes** de mexer no HTML, e veja-o falhar (vermelho antes de verde, procedimento de 260822-8rz/260823-3a6/260823-92t).

**O sandbox.** Copie a forma de `carregarTelaCompleta(opts)` de `tests/refrigeracao-os-unificada.test.js:417` — os mocks (`esc`, `fmtDate`, `el`, `val`, `somenteLeitura`, `ctUser`, `DATA`, `showToast`, `today`, `confirm`, `openDrawer`, `closeDrawer`, `supa` de mentira, `_logCache`) e os sete `recorte(...)` da linha 556-562. Três diferenças, todas obrigatórias:
1. **NÃO substitua `manAbrirOS`** por um contador (é o que aquele arquivo faz na linha 573); aqui o que está sob teste é justamente o montador.
2. **NÃO mocke `osEhMovimentacao`** com um booleano fixo (aquele arquivo mocka); carregue o real, recortando `'/* ── movimentação: instalação e remoção ── */'` até `'/* ── movimentação: carga dos locais, sob demanda ── */'`, para o cenário (c) escolher o ramo pelo `tipo` da entrada.
3. Acrescente o recorte `'/* ── movimentação: formulário e gravação ── */'` até `'/* ── fluxo da OS interna: tela e ações ── */'`, que é onde moram `movPainelDaOS`, `manFormDados` e `MAN_EDIT_ID`.
Mocke ainda `LOCAIS_POR_ID`, `rotuloLocalDestino`, `ocupantesDoLocal`, `casoDeInstalacao`, `CASOS_INSTALACAO`, `ctArp`, `ctComp`, `ctCompTotal`, `ctSaldoItem`, `ctSaldoNE`, `fmtMoney`, `equipEstado`, `EQUIP_ORDEM`, `EQUIP_ESTADOS`, `manRenderEvidencia`, `manTemEvidencia`, `renderMedicoesFicha`, `podeEditarCadastro` — determinísticos, um valor fixo cada, porque cada um já tem gate próprio noutro arquivo. Lembre da lição de 260823-cf8: `UNI_OK`/`OS_ITENS`/`OS_COMENTARIOS` são `var` dentro dos recortes e **reatribuem ao rodar** — semeie-os em `ctx` **depois** de todos os `vm.runInContext`, nunca antes.

**O fixture.** Gere `tests/fixtures/refrigeracao-os-gaveta.json` **a partir do arquivo de antes da mudança, pelo mesmo caminho de código do gate**, para gerador e verificador nunca divergirem: `git show HEAD:refrigeracao/index.html` para um arquivo de rascunho **fora do repositório** (use o diretório de rascunho da sessão, nunca `tests/`), aponte o carregador do gate para ele num script descartável, rode `manAbrirOS(logId)` nos cinco cenários de D-jar-17 com um `el(id)` que devolve um objeto capturando `textContent`/`innerHTML` por id, e escreva um objeto com as cinco chaves de cenário, cada uma com `corpo`/`dhId`/`dhLocal`/`dhPredio`/`dhPills`/`rodape`. **Deixe no cabeçalho do gate, em comentário, o procedimento exato de regeração** — o fixture é impressão digital, e sem o procedimento escrito ninguém o reproduz daqui a um mês.

**Só então edite `refrigeracao/index.html`.** Dentro da seção `/* ── fluxo da OS interna: tela e ações ── */` (D-jar-20), imediatamente antes de `function manAbrirOS(logId){`, crie `manMontarOS(logId)` **movendo** para dentro dela, sem reescrever uma vírgula de conteúdo, tudo o que hoje mora entre `var achado = manEntrada(logId)` e o `openDrawer()` final — trocando `h += X` por `contexto.push(X)` ou `trabalho.push(X)` conforme o corte de prefixo de D-jar-05, tirando a régua para `regua`, os quatro `el('dh-*')` para `ident` e a montagem do rodapé para `rodape.gaveta`. Acrescente `rodape.pagina` conforme D-jar-11 (mesmas condições booleanas, rótulos em texto, sem o botão de fechar). Devolva `null` quando `manEntrada` não achar.

`osAbrirGaveta(logId)` passa a ser o corpo de escrita de hoje, consumindo `manMontarOS`: escreve os quatro `dh-*`, `#drawer-body` = `regua + contexto.join('') + trabalho.join('')`, `#drawer-footer` = `rodape.gaveta`, `openDrawer()`. `manAbrirOS(logId)` fica delegando a ele. **Ainda não** crie o ramo de `TELA_LARGA` nem toque em `DETALHE_ABERTO` — isso é a Task 2; nesta tarefa `manAbrirOS` só delega, para o fixture provar a extração isolada da mudança de continente.

Reescreva os três casos de `tests/refrigeracao-os-unificada.test.js` (linhas 727, 734, 762) conforme D-jar-18: os recortes passam de `function manAbrirOS(logId){`→`async function manMudarStatus(` para `function manMontarOS(logId){`→`function osAbrirGaveta(`, e cada um ganha um assert provando que o corpo de `manAbrirOS` **não** contém o padrão que acabou de ser exigido em `manMontarOS`.
  </action>
  <verify>
    <automated>cd /home/luc/Downloads/pmoc-overlay && node --test tests/refrigeracao-os-pagina.test.js && node --test 2>&1 | tail -8</automated>
  </verify>
  <done>
`node --test` verde com 908 + os casos novos, zero falhas. `tests/fixtures/refrigeracao-os-gaveta.json` existe com os cinco cenários e o gate prova cada `corpo`/`dhId`/`dhLocal`/`dhPredio`/`dhPills`/`rodape` byte a byte. Nenhuma linha de CSS mudou nesta tarefa: `git diff HEAD -- refrigeracao/index.html | grep -c '^[+-].*@media'` == 0. Os 25 pontos de chamada de `manAbrirOS` seguem intocados: `grep -c 'manAbrirOS(' refrigeracao/index.html` == 26 (25 chamadas + a declaração).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Camada compartilhada de detalhe e #page-os-detalhe — marcação, CSS no @media existente, abrir e voltar</name>
  <files>refrigeracao/index.html, tests/refrigeracao-os-pagina.test.js, tests/refrigeracao-ficha-pagina.test.js</files>
  <behavior>
    - Com `TELA_LARGA` verdadeiro, `manAbrirOS(logId)` ativa `#page-os-detalhe` e preenche cabeçalho/régua/zonas/ações; com falso, abre a gaveta exatamente como na Task 1.
    - A união de `#osd-contexto` e `#osd-trabalho` contém cada título de bloco **exatamente uma vez**, nos dois modos de coluna.
    - `osUmaColuna(temTrabalho, editando)` é `true` quando `trabalho` está vazio **ou** quando se está corrigindo, e `false` só quando há trabalho e não se está corrigindo.
    - Em coluna única, `#osd-trabalho.innerHTML` é `''`, `#osd-corpo` ganha a classe `uma-coluna`, e `#osd-contexto` contém o que as duas zonas teriam — na mesma ordem.
    - Ao sair da coluna única, a classe `uma-coluna` é **removida** (abrir uma OS normal depois de uma legada não herda o modo).
    - `osAbrirPagina` grava a origem por `lerOrigemDetalhe()`, nunca apaga o `.active` de nenhum `.nav-btn`, fecha a gaveta se estiver aberta, esconde o `#fab` e grava `DETALHE_ABERTO = {tipo:'os', id:logId}`.
    - `detalheAbertoDe('os')` devolve o logId depois de abrir a OS e `null` depois de abrir a ficha (e vice-versa) — os dois nunca estão preenchidos ao mesmo tempo.
    - `lerOrigemDetalhe()` grava a chave quando a `.page.active` é uma das cinco abas e **mantém a anterior** quando é `page-ficha`, `page-os-detalhe` ou nenhuma (D-jar-03).
    - `voltarDoDetalhe()` zera o registro e chama `navTo(DETALHE_ORIGEM, botaoDaAba(DETALHE_ORIGEM))`; o rótulo de `#osd-voltar-txt` nomeia o destino e nunca contém `undefined`.
    - `fecharDetalhe()` chama `voltarDoDetalhe` quando há página de detalhe ativa e `closeDrawer` quando não há.
    - `navTo` zera `DETALHE_ABERTO`.
  </behavior>
  <action>
Estenda o gate com os casos acima **antes** de implementar, num `document` de mentira no mesmo padrão de `criarSandboxPagina` de `tests/refrigeracao-ficha-pagina.test.js:251` (objetos com `classList` de conjunto, `querySelector`/`querySelectorAll` sobre uma lista declarada no teste, `el(id)` devolvendo o nó pedido, `navTo` de mentira que reproduz **a troca de `.page.active`**, não só o registro da chamada — foi esse detalhe que fez três casos falharem por razão errada em 260823-92t). Veja falhar.

**Camada compartilhada (D-jar-01/02/03/20).** Abra a seção `/* ── detalhe em página: estado e navegação (ficha e OS) ── */` imediatamente antes de `/* -- ficha: uma fonte, dois continentes -- */` e **mova para dentro dela, sem reescrever corpo**: `ABAS_NAV`, `indiceDaAba`, `ROTULOS_VOLTA`, `rotuloVolta`, `botaoDaAba`. Renomeie `FICHA_ABERTA` → `DETALHE_ABERTO` (agora `null` ou `{tipo,id}`) e `FICHA_ORIGEM` → `DETALHE_ORIGEM`, e acrescente:
- `detalheAbertoDe(tipo)` — o id quando o tipo bate, `null` caso contrário. **Nenhum chamador desestrutura `DETALHE_ABERTO` à mão.**
- `lerOrigemDetalhe()` — lê `.page.active`, tira o prefixo `page-`, e **só grava** `DETALHE_ORIGEM` se `indiceDaAba(chave) >= 0`.
- `PAGINAS_DETALHE = ['page-ficha','page-os-detalhe']` e `paginaDetalheAtiva()` — devolve o id da página de detalhe ativa, ou `null`.
- `ativarPaginaDetalhe(idDaPagina)` — apaga o `.active` de todas as `.page`, acende a pedida, esconde `#fab`. Não toca em `.nav-btn`.
- `voltarDoDetalhe()` — zera `DETALHE_ABERTO` e chama `navTo(DETALHE_ORIGEM, botaoDaAba(DETALHE_ORIGEM))`. Substitui `voltarDaFicha`, que **deixa de existir**; o `onclick` de `#fh-voltar` na marcação passa a chamá-la.
- `fecharDetalhe()` — D-jar-12.
Ajuste `abrirFichaPagina` para usar `lerOrigemDetalhe()` e `ativarPaginaDetalhe('page-ficha')` (o corpo encolhe; nada de comportamento muda além de D-jar-03), e `abrirFichaGaveta`/`abrirFichaPagina` para gravar `DETALHE_ABERTO = {tipo:'ficha', id:id}`. Os quatro pontos que zeravam (`openLogForm`, `openEquipForm`, `openNewOS`, `closeDrawer`) passam a `DETALHE_ABERTO = null;`. Acrescente a mesma linha no topo de `navTo` (D-jar-14). Escape passa a usar `paginaDetalheAtiva()` (D-jar-15), **sem trocar a ordem dos dois ramos**. `renderPaginaAtiva` continua com uma linha só — `if(reAlojarDetalhe()) return;` — mas `reAlojarDetalhe` ainda é o `reAlojarFicha` de hoje **renomeado**, com os dois ramos da ficha lendo pelo novo registro; os ramos da OS são a Task 3.

**Marcação.** Acrescente `#page-os-detalhe` como sétima `.page`, irmã imediatamente depois de `#page-ficha`, dentro de `#content`: faixa `#osd-hdr` com `#osd-voltar` (contendo `<span id="osd-voltar-txt">`), `#osd-id`, `#osd-local`, `#osd-predio`, `#osd-pills`, `#osd-regua` e `#osd-acoes`; abaixo, `#osd-corpo` com `#osd-contexto` e `#osd-trabalho`. Nasce sem `.active`; **nenhum id `dh-*` pode ser duplicado** (o gate irmão exige exatamente uma ocorrência de cada). Por nunca ser ativada abaixo de 1024px, **não precisa e não deve** ganhar regra de CSS fora do `@media`.

**CSS (D-jar-08/16).** Anexe uma seção nova dentro do `@media (min-width:1024px)`, depois do bloco da ficha-página e antes do `}` final: `#page-os-detalhe{max-width:none;padding:0;overflow:hidden}`; `#page-os-detalhe.active{display:grid;grid-template-rows:auto 1fr;height:100%;min-height:0}` (especificidade de id vence `.page.active{display:block}`; `height:100%`, **nada de `dvh` aqui** — `#app` já tem o dele, D-92t-08); `#osd-hdr` em `grid-row:1`, flex com `align-items:center;flex-wrap:wrap;gap:12px;padding:12px 24px`, fundo claro e borda inferior; `#osd-voltar` no mesmo desenho de `#fh-voltar`; `#osd-regua{flex:1 1 320px;min-width:0}` e `#osd-regua .ct-timeline{margin:0}`; `#osd-acoes{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}`; `#osd-corpo{grid-row:2;min-height:0;display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:20px;padding:16px 24px}`; `#osd-corpo.uma-coluna{grid-template-columns:minmax(0,900px);justify-content:center}`; `#osd-corpo.uma-coluna #osd-trabalho{display:none}`; `#osd-contexto,#osd-trabalho{min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}` (o `min-height:0` é obrigatório pelo mesmo motivo de D-92t-10 — sem ele a zona empurra a página e a rolagem volta); `#page-os-detalhe .fgt{min-height:140px}`; `#page-os-detalhe .fg2{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}`; `#page-os-detalhe .dfields2{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}`. Nenhum seletor de elemento nu dos quatro proibidos.

**Comportamento.** Na seção da OS (D-jar-20), acrescente `osUmaColuna(temTrabalho, editando)` — função pura, sem API de navegador, para o gate a exercitar em Node como comportamento — e `osAbrirPagina(logId)`, na ordem: chame `manMontarOS`, desista se vier `null`; guarde os dois `scrollTop` **se** `detalheAbertoDe('os') === logId` (D-jar-10, a devolução vem no fim); feche a gaveta se estiver aberta (é `closeDrawer()` que devolve o `overflow` do `body`); `lerOrigemDetalhe()`; preencha `#osd-id`/`#osd-local`/`#osd-predio` por `textContent` e `#osd-pills`/`#osd-regua`/`#osd-acoes` por `innerHTML` (`rodape.pagina`); rotule `#osd-voltar-txt` com `rotuloVolta(DETALHE_ORIGEM)`; decida a coluna por `osUmaColuna(trabalho.length>0, MAN_EDIT_ID===logId)` e escreva as zonas conforme D-jar-07, **adicionando ou removendo** a classe `uma-coluna` em `#osd-corpo` (nunca só adicionando); `ativarPaginaDetalhe('page-os-detalhe')`; devolva os `scrollTop` guardados; grave `DETALHE_ABERTO = {tipo:'os', id:logId}` **depois** do `closeDrawer()`, nunca antes. `manAbrirOS(logId)` ganha o ramo de D-jar-04, e `manCancelar` troca `closeDrawer()` por `fecharDetalhe()` (D-jar-12).

**Gate irmão (D-jar-18).** Reescreva em `tests/refrigeracao-ficha-pagina.test.js` só o que mudou de nome ou de forma: `ateFimDeLinha(HTML,'var FICHA_ABERTA = ')`→`'var DETALHE_ABERTO = '`, `'var FICHA_ORIGEM = '`→`'var DETALHE_ORIGEM = '`, `bloco(HTML,'function reAlojarFicha(){')`→`'function reAlojarDetalhe(){'`, `ctx.voltarDaFicha()`→`ctx.voltarDoDetalhe()`, `ctx.FICHA_ORIGEM`→`ctx.DETALHE_ORIGEM`, as leituras de `ctx.FICHA_ABERTA` passam por `ctx.detalheAbertoDe('ficha')`, o caso que exige `/FICHA_ABERTA\s*=\s*null;/` nos quatro corpos passa a exigir `/DETALHE_ABERTO\s*=\s*null;/`, e `MARCADORES_PAGINA` aprende as funções compartilhadas novas. **Nenhum caso é apagado**, e o caso "abrirFichaPagina nunca apaga .active de nenhum .nav-btn" continua valendo palavra por palavra.
  </action>
  <verify>
    <automated>cd /home/luc/Downloads/pmoc-overlay && node --test tests/refrigeracao-os-pagina.test.js && node --test tests/refrigeracao-ficha-pagina.test.js && node --test tests/refrigeracao-desktop.test.js && node --test 2>&1 | tail -8</automated>
  </verify>
  <done>
`node --test` verde, zero falhas. `tests/refrigeracao-desktop.test.js` verde **sem edição**: CSS fora de `@media` estritamente igual ao fixture de celular, **exatamente um** `@media` novo, nenhum seletor de elemento nu. `grep -c '<style>' refrigeracao/index.html` idêntico a HEAD. `grep -c 'voltarDaFicha' refrigeracao/index.html` == 0. Cada `dh-*` continua com uma ocorrência só. Os quatro `grep` do PLAT-15 seguem em 0: `for t in 'shared/' 'pmoc.css' 'pmoc-tema' 'data-theme'; do grep -c "$t" refrigeracao/index.html; done` imprime `0` quatro vezes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Cruzar o limiar nos dois sentidos sem perder o que foi digitado, e roteiro manual</name>
  <files>refrigeracao/index.html, tests/refrigeracao-os-pagina.test.js, TESTES.md</files>
  <behavior>
    - OS em página + estreitar: `#page-os-detalhe` deixa de estar ativa, a página de origem volta a ser a ativa e a gaveta abre com a **mesma** OS.
    - OS em gaveta + alargar: a gaveta fecha e a OS abre como página, com a mesma OS e a mesma origem por baixo.
    - Os dois estados já-corretos (página+largo, gaveta+estreito) devolvem `false` sem tocar em nada.
    - Ficha e OS não se confundem: com `{tipo:'ficha'}` no registro o re-alojamento nunca ativa `#page-os-detalhe`, e vice-versa.
    - `#page-os-detalhe` nunca fica ativa com `TELA_LARGA` falso, inclusive quando o que está na gaveta é um formulário.
    - Texto digitado nos campos da OS sobrevive ao cruzamento nos dois sentidos, incluindo a correção de dados (`MAN_EDIT_ID` + `man-ed-desc`) e o parecer de conferência.
    - `OS_CAMPOS_VOLATEIS` **não** contém `man-ex-fotos`.
    - A rolagem das duas zonas é preservada quando `osAbrirPagina` re-renderiza a **mesma** OS, e volta a zero quando é outra.
    - Nenhuma função nova chama `pushState`.
  </behavior>
  <action>
Estenda o gate com os casos acima **antes** de implementar, exercitando `reAlojarDetalhe()` nos quatro estados × dois tipos e provando o valor devolvido em cada um. Veja falhar.

Acrescente na seção da OS `OS_CAMPOS_VOLATEIS` (lista fechada de D-jar-09), `osCapturarCampos()` (devolve um objeto id→`value` só dos que existem) e `osRestaurarCampos(mapa)` (reescreve `.value` nos que voltaram a existir; ignora chave ausente, nunca lança). Escreva no comentário **por que `man-ex-fotos` está fora** — o `value` de um `input[type=file]` não é escrevível, e listá-lo prometeria uma sobrevivência que não existe.

Estenda `reAlojarDetalhe()` para quatro ramos, mantendo a forma de hoje (cada ramo só dispara quando o continente está **errado** para o `TELA_LARGA` corrente; nos já-corretos devolve `false` sem tocar em nada — é o que impede a realimentação, T-jar-04):
1. Página de detalhe ativa e `TELA_LARGA` falso: guarde `DETALHE_ABERTO` numa variável local **antes** de `voltarDoDetalhe()` (que a zera); quando o tipo guardado for `'os'`, capture os campos **antes** e restaure **depois** de `osAbrirGaveta`; quando for `'ficha'`, chame `abrirFichaGaveta` como hoje; quando não houver registro (formulário na gaveta por cima da página), o `voltarDoDetalhe()` sozinho já cumpre a invariante — **não** chame abridor nenhum, que sobrescreveria o formulário.
2. Gaveta aberta, `TELA_LARGA` verdadeiro e registro preenchido: `'ficha'` → `abrirFichaPagina`; `'os'` → capture, `osAbrirPagina` (que fecha a gaveta lá dentro), restaure. Registro nulo é formulário: devolva `false`, para o formulário sobreviver ao alargamento.

Não crie ouvinte de `resize` nenhum: `renderPaginaAtiva` já chama `reAlojarDetalhe()` na primeira linha desde a Task 2, e `iniciarModoDeTela` já a chama na mudança de `matchMedia`.

Escreva em `TESTES.md` a seção de conferência manual, no formato das anteriores, datada de 23/08/2026: em 1440px abrir uma OS pela lista de OS, pela lista de Inst./Remoção e pelo botão "Abrir OS" da ficha, conferindo que o voltar nomeia e alcança cada origem (inclusive o encadeamento Alertas → ficha → OS → volta aos Alertas); conferir que a página não rola e que as duas zonas rolam por dentro; medir que os campos de parecer, delineamento e comentário passaram dos ~330px úteis do painel para ~985px; abrir a correção de dados e conferir que a página vira coluna única de 900px; abrir uma OS legada sem fluxo e conferir que **não** aparece coluna vazia; digitar num parecer sem salvar e arrastar a janela de 1440px para 900px e de volta, conferindo que o texto e a OS são os mesmos; lançar um item numa OS de contrato longa e conferir que a zona de trabalho não pula para o topo; cancelar uma OS pela página e conferir que ela volta à lista de origem; em 375px percorrer uma OS de cada tipo conferindo que é idêntica à de hoje.
  </action>
  <verify>
    <automated>cd /home/luc/Downloads/pmoc-overlay && node --test tests/refrigeracao-os-pagina.test.js && node --test 2>&1 | tail -8</automated>
  </verify>
  <done>
`node --test` verde, zero falhas, contagem >= 908. `grep -c 'pushState' refrigeracao/index.html` == 0. `grep -c 'man-ex-fotos' refrigeracao/index.html` == 1 (só o campo em si, nunca na lista de voláteis). `tests/refrigeracao-desktop.test.js`, `tests/refrigeracao-topbar-parque.test.js`, `tests/refrigeracao-qr-nfc.test.js`, `tests/refrigeracao-gaveta-qr.test.js`, `tests/refrigeracao-fluxo-os-interna.test.js`, `tests/refrigeracao-movimentacao-os.test.js` e `tests/refrigeracao-trilha-os.test.js` verdes **sem edição**. `TESTES.md` tem a seção nova datada de 23/08/2026.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| dado do Supabase → `innerHTML` das duas zonas e da faixa | campos de `logs_manutencao`, `os_itens`, `os_comentarios`, `os_composicao_arp` e `equipamentos` (texto livre: parecer, descrição, técnico, empresa, autor do comentário) atravessam para HTML |
| DOM → `osCapturarCampos()` → DOM | valores digitados são lidos e reescritos ao cruzar o limiar de largura |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-jar-01 | Tampering (XSS armazenado) | `manMontarOS` → `#osd-contexto`/`#osd-trabalho`.innerHTML | high | mitigate | Superfície **inalterada**: são exatamente as mesmas strings que a gaveta já insere hoje, com toda interpolação por `esc()`; o fixture de cinco cenários da Task 1 é a prova de que a extração não perdeu um `esc()` pelo caminho |
| T-jar-02 | Tampering (XSS refletido) | `osRestaurarCampos` | medium | mitigate | Escreve sempre em `.value`, **nunca** em `innerHTML`; a lista de ids é fechada e literal, nenhuma chave vem de dado; chave ausente é ignorada, não criada |
| T-jar-03 | Information disclosure | `rodape.pagina` e os blocos de ação | medium | mitigate | Cada botão continua atrás da **mesma** guarda de hoje (`manPode(...)`, `manPodeIrPara(...)`, `podeEditarCadastro()`, `somenteLeitura()`) — `manMontarOS` é a fonte única dos dois rodapés, e o ramo `'gaveta'` é provado byte a byte, o que impede que a mudança de continente vire mudança de permissão. O controle real segue sendo RLS |
| T-jar-04 | Denial of service (auto-infligido) | `reAlojarDetalhe` ↔ os quatro abridores | medium | mitigate | Laço de re-alojamento: cada ramo só dispara quando o continente está *errado* para o `TELA_LARGA` corrente, e o abridor corrige o continente antes de qualquer novo evento; o gate exercita os quatro estados × dois tipos e exige `false` nos já-corretos |
| T-jar-05 | Repudiation | conferência/fiscalização/certificação pela página | low | accept | Nenhuma gravação muda: `manConferir`/`manFiscalizar`/`manCertificar`/`manAtualizarOS` não são tocadas, e a trilha em `os_comentarios` continua sendo escrita pelo mesmo caminho |
| T-jar-06 | Tampering | nenhum install de pacote | low | accept | Zero build, zero dependência nova (D-jar-19) — não há gate de legitimidade de pacote a rodar |
</threat_model>

<verification>
- `node --test` verde, >= 908 casos, zero falhas.
- `tests/refrigeracao-desktop.test.js` verde **sem edição**: CSS fora de `@media` estritamente igual a `tests/fixtures/refrigeracao-css-mobile.css`, exatamente um `@media` novo, nenhum seletor de elemento nu. **`tests/fixtures/refrigeracao-css-mobile.css` não é regenerado.**
- D-04: `for t in 'shared/' 'pmoc.css' 'pmoc-tema' 'data-theme'; do grep -c "$t" refrigeracao/index.html; done` → `0 0 0 0`.
- Nenhum arquivo sob `supabase/` tocado, nenhuma migração escrita nem aplicada.
- Nenhum arquivo criado fora de `refrigeracao/`, `tests/` e `TESTES.md`; o rascunho do HTML de HEAD usado para gerar o fixture fica **fora do repositório**.
- `/home/luc/DEV_ERP` intocado.
</verification>

<success_criteria>
- Em `>=1024px` a OS abre como página inteira, com a régua de passos permanentemente visível na faixa e duas zonas que rolam por dentro enquanto a página não rola — e nunca uma coluna vazia ao lado de outra.
- Nenhum dos seis campos de texto da OS tem menos de ~870px de largura nem menos de 140px de altura na página, contra os ~330px úteis do painel de hoje.
- Abaixo de 1024px a OS é byte a byte a de hoje nos cinco cenários, provado por fixture e não por afirmação.
- O mecanismo de página tem um dono e dois consumidores: `DETALHE_ABERTO`/`DETALHE_ORIGEM`/`voltarDoDetalhe`/`reAlojarDetalhe` servem ficha e OS, sem uma segunda cópia e sem um segundo ouvinte de resize.
- Instalação/Remoção vira página junto, por construção.
- Cruzar o limiar nos dois sentidos preserva a OS aberta **e** o texto digitado e não salvo.
- Três commits atômicos, um por task, em `refrigeracao-os-pagina`.
</success_criteria>

<output>
Criar `.planning/quick/260823-jar-refrigeracao-os-como-pagina-inteira-no-d/260823-jar-SUMMARY.md` ao terminar, citando D-jar-01..20.
</output>
