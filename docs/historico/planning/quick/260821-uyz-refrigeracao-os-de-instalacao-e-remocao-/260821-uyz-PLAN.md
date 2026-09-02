---
quick_id: 260821-uyz
slug: refrigeracao-os-de-instalacao-e-remocao-
date: 2026-08-21
mode: quick
type: execute
status: pending
branch: refrigeracao-os-instalacao-remocao
files_modified:
  - supabase/42_refrigeracao_movimentacao.sql
  - refrigeracao/index.html
  - mapa/mapa-dados.js
  - tests/refrigeracao-situacao-equipamento.test.js
  - tests/refrigeracao-movimentacao-os.test.js
  - tests/refrigeracao-contagens.test.js
  - tests/refrigeracao-fluxo-os-interna.test.js
  - tests/mapa-cobertura.test.js
  - TESTES.md
autonomous: true
must_haves:
  truths:
    - Uma máquina entra num local por uma OS de Instalação, que só muda o cadastro quando o gestor confere
    - Uma máquina sai de um local por uma OS de Remoção, com checklist das partes (evaporadora, condensadora, linha, dreno, suportes, alimentação) — o que prova que não ficou tubulação pendurada na parede
    - A remoção tem dois destinos - guardada (volta ao inventário sem local, pronta para outra instalação) ou baixa patrimonial (terminal)
    - Dar baixa exige cargo admin; conferir uma remoção comum segue no gestor
    - Os três casos de instalação (novo local, mais uma máquina no mesmo local, substituição) são derivados do dado gravado, nunca digitados num campo
    - Máquina removida ou baixada some dos KPIs, dos alertas, do PMOC, dos seletores de OS e do mapa — e continua alcançável por chip próprio no inventário e por link direto
    - Instalar uma máquina que ainda não existe no cadastro é possível pelo próprio formulário
    - Num banco sem a migração 42 o terceiro segmento não aparece e a tela é a de hoje, sem erro; o /mapa cai para a consulta sem situação
    - Conferir duas vezes (ou um retry de rede) não produz cadastro meio-aplicado
  artifacts:
    - supabase/42_refrigeracao_movimentacao.sql
    - tests/refrigeracao-situacao-equipamento.test.js
    - tests/refrigeracao-movimentacao-os.test.js
  key_links:
    - EQUIP_SITUACOES -> normalizarSituacaoEquip -> equipamentosOperacionais -> renderDash / renderAlerts / renderPmoc / dvRenderCharts / openNewOSForm / ctNovaOS
    - filtrarInventario (chips removidos/baixados) -> renderInv + etiquetasDoInventario (os dois consumidores, D-s3h-08)
    - CONFIG_POR_MODULO.climatizacao.colunaSituacao -> carregarAtivosDoModulo -> os 171 marcadores do /mapa
    - MOV_OK (sonda própria, separada de MAN_FLUXO_OK) -> terceiro segmento -> openMovForm -> salvarMovOS -> logs_manutencao
    - casoDeInstalacao(destino, substituído, ocupantes) -> rótulo do caso, derivado do dado
    - checklistDaOS(tipoOS, tipoEquip) -> openMovForm + manAbrirOS + manTemEvidencia
    - manConferir -> aplicarInstalacao / aplicarRemocao -> equipamentos (local_id, predio, local, lat, lon, situacao, data_instalacao, data_remocao, data_baixa)
---

# `/refrigeracao` — OS de Instalação e de Remoção, com baixa patrimonial

O pedido, nas palavras dele:

> *"incluir nova 'aba' de OS, para Instalacao, Remocao. Instalacao sera a inclusao de uma maquina em
> um local. pode ser nova instalacao quando maquina e instalada em novo local, nova instalacao, mais
> uma maquina em um local... ou instalada em lugar de uma que foi removida. A remoca e a
> desistalacao da maquina e suas partes do local."*

E, depois, sobre a baixa patrimonial, que eu tinha proposto deixar de fora:

> *"implemente a baixa tambem"*

## O que o banco diz hoje (conferido em `pmoc`, `thoaqipyhfmromsgzmjs`, 21/08/2026)

| Fato medido | Consequência para este plano |
|---|---|
| `equipamentos`: 171 linhas, 32 colunas depois da 41 | a migração 42 acrescenta 3 (`situacao`, `data_remocao`, `data_baixa`) |
| **Todas** as colunas de local são anuláveis (`local_id`, `predio`, `local`, `area`, `tipo`, `funciona`, `criticidade`, `estado`) | limpar o local na remoção não esbarra em `not null` — o `update` da conferência passa |
| **0 equipamentos sem `local_id`** hoje; 234 locais ativos em `cmasm_locais` | a derivação dos três casos (D-uyz-03) tem dado real desde o primeiro uso |
| `logs_manutencao`: 26 colunas depois da 41, **10 linhas**, `tipo` com dois valores em uso (`CORRETIVA` 4, `INSPEÇÃO` 7) e **sem check constraint**; `status` com trava de 10 valores | `tipo` = `INSTALAÇÃO`/`REMOÇÃO` entra sem tocar em trava nenhuma (D-uyz-02) |
| `cmasm_locais.id` é `integer`; `equipamentos.id` é `serial` (integer) | as três FKs novas são `integer`, não `uuid` nem `bigint` |
| Migrações **40 e 41 já aplicadas em produção em 21/08/2026** | `MAN_FLUXO_OK` é verdadeiro em produção hoje — o fluxo de 6 estados está no ar |
| `CONFIG_POR_MODULO.climatizacao` tem **`colunaAtivo: null`** — as outras quatro famílias filtram por `ativo` | sem tratar isso, uma máquina removida ou baixada continua desenhada no prédio onde não está mais |
| `dvRenderCharts` filtra `e.tipo !== 'RETIRADO'` — e as **2 linhas RETIRADO foram excluídas na importação** (`05_refrigeracao_import_171.sql`, linha 4: "174 linhas → 171 equipamentos") | esse filtro casa com **zero** linha hoje; é o marcador improvisado que `situacao` substitui. **Registrar, não converter** — não há linha para converter |
| RLS de `equipamentos` e de `logs_manutencao`: `to authenticated using (true)`, **sem cargo** | a trava de admin da baixa é **UX apenas** (D-uyz-23), sem eufemismo |
| `node --test`: **647/647 verde** | é a linha de base; nenhum gate pode ficar verde por acidente |

## Decisões deste plano

As nove primeiras já foram fechadas com o usuário nesta sessão — **não reabrir**, só registrar.

- **D-uyz-01 — terceiro segmento na aba OS**, não uma sexta aba. A barra inferior já tem 5 itens e
  não cabe outro a 375 px (`tests/mobile-375.test.js` é gate permanente). O segmento entra no
  `seg-toggle` que já existe em `#page-os`: **Manutenção | Contratações | Inst./Remoção**.

- **D-uyz-02 — reusa `logs_manutencao` e o fluxo de 6 estados** que entrou hoje (Aberta →
  Delineamento → Aprovação → Em execução → Executada → Conferida, mais Cancelada), com `tipo` =
  `INSTALAÇÃO` / `REMOÇÃO`. Instalar exige autorização, evidência e conferência — é exatamente o
  fluxo que já existe e já tem gate. Uma tabela nova seria um segundo fluxo para manter em paralelo,
  com a segunda régua, a segunda lista de cargos e a segunda porta de escrita.

- **D-uyz-03 — os três casos de instalação são DERIVADOS do dado, nunca digitados.** As colunas são
  `local_destino_id`, `local_origem_id` e `equip_substituido_id`; o caso sai delas:
  `equip_substituido_id` preenchido → **substituição**; senão, destino que já tem equipamento
  instalado → **mais uma máquina**; senão → **novo local**. Um campo "tipo de instalação" digitado
  diverge do que aconteceu na primeira vez que alguém erra o clique.

- **D-uyz-04 — a conferência do gestor é quem aplica a mudança no cadastro.** Instalação grava
  `local_id`, `predio`, `local` e `data_instalacao`; remoção limpa o local. Mesma mecânica que já
  grava `ultima_manutencao` em `manConferir`: prende a mudança à OS que a causou, com trilha
  assinada, sem tela nova de "mover equipamento".

- **D-uyz-05 — `equipamentos.situacao`, lista fechada `instalado` | `removido` | `baixado`** (no
  lugar do booleano `instalado` cogitado antes). `baixado` é **terminal**: uma OS de instalação
  recusa máquina baixada. Máquina `removido` continua no inventário, sem local, fora do mapa e dos
  KPIs de operação, pronta para uma instalação futura.

- **D-uyz-06 — a OS de remoção tem destino: `guardada` ou `baixa`.** Guardada →
  `situacao='removido'`. Baixa → `situacao='baixado'`.

- **D-uyz-07 — a baixa exige cargo `admin`**, não gestor. Desinstalar é ato de manutenção; dar baixa
  é ato patrimonial formal. A conferência de uma remoção comum (destino `guardada`) segue no gestor.

- **D-uyz-08 — instalação de máquina que ainda não existe no cadastro faz parte.** O formulário
  oferece cadastrar na hora, reusando o cadastro que entrou hoje (`campoEquipForm`/`equipParaDb`/
  `EQUIP_EDITAVEIS`/`podeEditarCadastro`). Sem isso o fluxo trava na primeira vez que é usado de
  verdade, porque "nova instalação em novo local" quase sempre é máquina nova chegando.

- **D-uyz-09 — as "partes" da remoção viram checklist** (evaporadora, condensadora, linha
  frigorígena, dreno, suportes, alimentação elétrica), no mecanismo `CHECKLIST` que já existe por
  tipo de equipamento. É o que a frase do usuário pede — "a máquina **e suas partes**" — e é o que
  prova, na conferência, que não ficou tubulação pendurada na parede.

As demais são deste plano.

- **D-uyz-10 — só `instalado` participa da operação.** KPIs, alertas, PMOC, gráficos, seletores de
  equipamento das duas OS (manutenção e contratação), etiquetas e mapa passam a ler
  `equipamentosOperacionais(DATA)`. Removido e baixado continuam **carregados** em `DATA` e
  alcançáveis por chip próprio no inventário e por link direto `?equip=` — sumir do inventário
  inteiro seria trocar um erro (contar máquina que não está lá) por outro (esconder patrimônio).

- **D-uyz-11 — `normalizarSituacaoEquip` responde coisas diferentes para ausência e para lixo.**
  `undefined`/`null`/`''` → `'instalado'`: é o banco **sem** a migração 42, ou uma consulta que não
  pediu a coluna, e nesse caso as 171 máquinas estão instaladas — traduzir para `null` faria os KPIs
  zerarem no minuto do deploy, sem erro nenhum no console. Texto fora da lista fechada → `null`,
  que a tela mostra como desconhecido. Duas causas diferentes, duas respostas diferentes.

- **D-uyz-12 — `situacao` fica FORA de `EQUIP_EDITAVEIS`.** Ela muda só por conferência de OS. Um
  `<select>` de situação no formulário de cadastro deixaria qualquer gestor dar baixa em uma máquina
  sem OS, sem checklist de partes, sem assinatura e sem a trava de admin — desfazendo D-uyz-04,
  D-uyz-07 e D-uyz-09 de uma vez. `dataRemocao` e `dataBaixa` ficam de fora pelo mesmo motivo.

- **D-uyz-13 — sonda própria (`MOV_OK`), separada de `MAN_FLUXO_OK`.** Estender `manSondarEsquema`
  para pedir também as colunas da 42 desligaria o fluxo **inteiro** num banco com 40+41 e sem 42 —
  uma regressão do que entrou hoje. São duas perguntas diferentes; são duas sondas. O terceiro
  segmento exige `MAN_FLUXO_OK && MOV_OK`.

- **D-uyz-14 — a OS de instalação NÃO remove a máquina substituída.** `equip_substituido_id` é
  referência documental ("B entrou no lugar de A"); A precisa da própria OS de remoção. Remover é
  trabalho físico com checklist de partes, executor e evidência próprios — dobrar isso na OS de B
  produziria uma OS cuja evidência prova uma coisa e cujo efeito muda duas máquinas, e um estado
  meio-aplicado quando só uma das duas metades roda. A conferência **recusa** a instalação enquanto
  A ainda estiver `instalado`, dizendo qual OS falta abrir; o formulário avisa antes, no momento da
  escolha.

- **D-uyz-15 — na conferência de movimentação o cadastro é gravado ANTES do status terminal.**
  `CONFERIDA` é terminal (`manProximos` devolve `[]`), então uma falha de rede **depois** do status
  deixaria a OS fechada com o cadastro não aplicado e sem caminho de repetição. Na ordem
  cadastro→status, a falha na primeira metade deixa a OS em `EXECUTADA` e o gestor repete; a falha
  na segunda deixa o cadastro certo e a repetição converge. `aplicarInstalacao`/`aplicarRemocao` são
  **convergentes**: calculam o estado-alvo a partir das colunas da própria OS, comparam com o atual
  e não escrevem quando já é igual — mesma técnica de `atualizarEstadoEquip` e de
  `baixarPecasDaOS()` no módulo Máquinas. A ordem da OS de manutenção comum **não muda** (tem gate).

- **D-uyz-16 — `checklistDaOS(tipoOS, tipoEquip)`: o checklist é escolhido primeiro pelo tipo da OS,
  depois pelo tipo do equipamento.** `CHECKLIST` (manutenção) não é embaralhada: ganham vizinhas
  `CHECKLIST_INSTALACAO` e `CHECKLIST_REMOCAO`, com as mesmas chaves de tipo e o mesmo recuo para
  `SPLIT`. Sem isso a OS de instalação abriria pedindo "limpeza dos filtros da evaporadora" — o
  formulário renderiza um checklist sempre, e o único disponível hoje é o de manutenção. `JANELA`
  tem lista própria de partes: é um bloco único, não tem evaporadora, condensadora nem linha
  frigorígena separadas.

- **D-uyz-17 — evidência de movimentação é foto OU checklist de partes completo.** Medição de
  insuflamento não faz sentido em remoção (não há o que medir), então `manTemEvidencia` ganha um
  ramo por tipo de OS. A saída de `EM_EXECUCAO` continua guardada na própria ação
  (`manMudarStatus`), não só na renderização do botão — D-l7n-09 vale igual aqui.

- **D-uyz-18 — a data é a da OS, nunca a do clique** (precedente D-l7n-11). Instalação grava
  `data_instalacao` = `entry.date`; remoção grava `data_remocao`; baixa grava também `data_baixa`.

- **D-uyz-19 — a remoção limpa `lat`/`lon` junto de `local_id`/`predio`/`local`.** Coordenada
  própria de máquina que está numa prateleira é dado falso, e voltaria a desenhar o marcador no
  prédio errado no dia em que alguém afrouxar o filtro do mapa. A escrita vai por
  `aplicarRemocao`, **não** por `equipParaDb`/`EQUIP_EDITAVEIS` — a exclusão de `lat`/`lon` da lista
  de escrita do cadastro (D-q57-08, posição é trabalho de campo do `/mapa`) fica intacta: aqui não
  se está posicionando, se está desposicionando, por causa de um fato físico registrado numa OS.

- **D-uyz-20 — `situacao` e `funciona` são eixos ortogonais.** A baixa **não** força `INOP`. Uma
  máquina pode ser removida operante e guardada como reserva; escrever `INOP` na baixa contaria como
  defeito o que é decisão patrimonial e sujaria o único número que orienta compra e contratação. É
  precisamente por isso que `situacao` não foi dobrada dentro de `funciona`.

- **D-uyz-21 — `MOV_TIPOS` nunca aparecem no `<select>` de tipo da OS de manutenção.** `MAINT_TIPOS`
  fica como está. O formulário de manutenção não tem onde pôr destino, origem, substituída nem
  destino da remoção — uma OS `INSTALAÇÃO` nascida por lá seria uma OS que a conferência não
  consegue aplicar e que some entre os dois segmentos.

- **D-uyz-22 — `logs_manutencao.tipo` continua sem `check constraint`.** Ele é texto livre desde a
  migração 04 e as 10 linhas legadas gravam duas palavras; travar agora congelaria um vocabulário de
  tela dentro do banco e quebraria a primeira correção de histórico. O app é o único escritor e
  escreve de lista fechada (`MAINT_TIPOS` / `MOV_TIPOS`); o gate confere isso na tela.

- **D-uyz-23 — a trava de cargo é UX apenas, inclusive a da baixa.** As policies de `equipamentos` e
  `logs_manutencao` são `to authenticated using (true)`, sem distinção de cargo: um técnico
  autenticado consegue, por chamada REST montada à mão, gravar `situacao='baixado'`. A tela não
  oferece o caminho e cada passo grava quem assinou. Fechar de verdade é migração de policy,
  **fora deste escopo** — pendência registrada sem eufemismo, como D-l7n-03 e D-q57-13.

- **D-uyz-24 — sem a migração 42 nada quebra, dos dois lados.** Na refrigeração, `MOV_OK` fica falso
  e o terceiro segmento não é injetado — o `seg-toggle` volta a ter dois botões e a tela é a de
  hoje. No `/mapa`, `carregarAtivosDoModulo` tenta a consulta com `situacao` e, no erro, **repete
  uma única vez** sem a coluna e sem o filtro, com aviso no console. Selecionar coluna inexistente
  no PostgREST devolve 400 e a camada inteira viraria lista vazia: 171 marcadores sumiriam da tela
  sem nada dizendo por quê.

- **D-uyz-25 — `predio`/`local` são derivados de `cmasm_locais` no momento da conferência**, não
  congelados na OS. A OS guarda `local_destino_id`; o nome atual da sala é o nome certo. Como a
  árvore tem exatamente dois níveis (sala → edificação, documentado no CLAUDE.md), `local` é o nome
  do próprio nó e `predio` é o nome do pai (ou o do próprio nó, quando o destino já é a edificação).
  Se a árvore não puder ser carregada na hora, `aplicarInstalacao` **recusa** em vez de gravar
  `local_id` com `predio`/`local` velhos — meia gravação é pior que nenhuma.

## Ordem de publicação

Igual à das duas migrações de hoje: **frontend primeiro, SQL depois.** `MOV_OK` (D-uyz-13) e o
recuo do mapa (D-uyz-24) existem exatamente para essa janela. Na ordem inversa, o banco teria
`situacao` e a tela publicada ainda contaria máquina baixada como operante — sem erro nenhum.

**Quem aplica a migração é o usuário/orquestrador. Este plano só escreve o arquivo.**

## Restrições que valem para todo código novo

- **Zero build.** ES5: `var`, `function`, sem arrow function, sem template literal, sem `const`/`let`
  no código novo de `refrigeracao/index.html`. `mapa/mapa-dados.js` é ES module moderno e segue o
  estilo do próprio arquivo.
- **D-04 — `refrigeracao/index.html` é congelada e standalone.** Nenhuma referência a `shared/`,
  `pmoc.css`, `pmoc-tema` ou `data-theme`. Os quatro `grep -c` continuam em **0** — e isso vale
  também para **comentário**: citar um dos quatro literais dentro do arquivo, mesmo em prosa
  explicando que ele não é usado, faz o próprio gate falhar.
<!-- planner-discipline-allow: shared/ -->
<!-- planner-discipline-allow: pmoc.css -->
<!-- planner-discipline-allow: pmoc-tema -->
<!-- planner-discipline-allow: data-theme -->
- **Caminho de asset absoluto de raiz** (`/refrigeracao/...`) — `tests/modulos-caminhos.test.js`.
- Português em nomes, comentários e UI. Seções como `/* ── nome ── */`.
- Idioma de erro do projeto: `if(error){ showToast('Erro: '+error.message,'error'); return }`.
- **Migração aditiva, nunca `drop` de coluna, nunca `delete`.** Bloco de conferência pós-aplicação
  comentado no rodapé do arquivo.
- **Não tocar em `/home/luc/DEV_ERP`.**
- Cuidado com os **recortes** dos gates: eles fatiam `refrigeracao/index.html` por comentário de
  seção (`recorte(inicio, fim)`). Onde este plano manda inserir um bloco "imediatamente antes de X",
  é porque o recorte que termina em X precisa passar a conter o bloco novo.
- Cuidado com **colisão de nome de classe CSS**: `pill-baixa` já existe e é a criticidade BAIXA. As
  pílulas de situação chamam-se `pill-sit-removido` e `pill-sit-baixado`.
- Objetos criados dentro do sandbox `node:vm` têm `Object.prototype` de outro realm — comparar
  **campo a campo**, nunca `deepStrictEqual` contra literal do realm principal (armadilha já
  documentada em `tests/refrigeracao-encerramento-os.test.js`).

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: migração 42 e a situação patrimonial atravessando a tela e o mapa</name>
  <files>supabase/42_refrigeracao_movimentacao.sql, refrigeracao/index.html, mapa/mapa-dados.js, tests/refrigeracao-situacao-equipamento.test.js, tests/refrigeracao-contagens.test.js, tests/mapa-cobertura.test.js</files>
  <behavior>
    - normalizarSituacaoEquip devolve 'instalado' para undefined, null e '' (banco pré-42), devolve o próprio valor para os três da lista fechada, e null para qualquer outro texto
    - equipInstalado é verdadeiro para 'instalado' e para ausência; falso para 'removido', 'baixado' e para valor inventado
    - equipamentosOperacionais devolve só os instalados, preservando a ordem da lista recebida
    - filtrarInventario esconde removido e baixado nos chips de sempre, e os isola nos dois chips novos
    - filtrarInventario aplica a busca textual dentro de cada chip novo — buscar dentro de "removidos" continua filtrando
    - contarNaoOperacionais conta quantos removidos/baixados casam com uma busca, para a tela poder dizer que existem em vez de calar
    - CONFIG_POR_MODULO.climatizacao declara colunaSituacao e o valor visível, e continua com colunaAtivo null
    - carregarAtivosDoModulo repete a consulta sem situacao uma única vez quando a primeira erra, e devolve as linhas da segunda
    - carregarAtivosDoModulo não repete quando a primeira consulta funciona
  </behavior>
  <action>
**(a) `supabase/42_refrigeracao_movimentacao.sql`** — arquivo novo, aditivo, com a moldura `══` e o
cabeçalho comentado do projeto explicando **o porquê**: hoje uma máquina entra e sai de um local sem
registro nenhum — `local_id`/`predio`/`local` são editados no cadastro e o valor anterior some, sem
data, sem quem, sem autorização. A OS de Instalação e a de Remoção trazem essa movimentação para o
mesmo fluxo de aprovação da manutenção (migração 40), e a baixa patrimonial passa a ser um estado do
próprio equipamento em vez de uma linha apagada. Registrar no cabeçalho: os números medidos hoje
(171 equipamentos, **0 sem `local_id`**, 234 locais ativos, `logs_manutencao` com 10 linhas e `tipo`
sem trava); que **as 2 linhas `RETIRADO` foram excluídas na importação** (`05_*.sql`, linha 4) e por
isso não há dado legado para converter em `baixado`; e a **ordem de publicação** (frontend primeiro,
SQL depois, D-uyz-24) com o motivo em uma linha.

Conteúdo, nesta ordem:

1. **`equipamentos.situacao`** — `alter table equipamentos add column if not exists situacao text
   not null default 'instalado';`. Em Postgres 11+ isso preenche as 171 linhas **sem reescrever a
   tabela**, o que dispensa o `update` de backfill (diferente da migração 41, que precisou dele
   porque a coluna já existia com dado). Logo em seguida, **e é o ponto**, dois comandos que
   garantem a **forma** e não só a existência:
   `alter table equipamentos alter column situacao set default 'instalado';`
   `update equipamentos set situacao = 'instalado' where situacao is null;`
   `alter table equipamentos alter column situacao set not null;`
   Comentar por quê: `add column if not exists` é **no-op numa coluna que já existe**, e não garante
   o tipo, o default nem o `not null` — é exatamente a armadilha que custou a migração 28
   (`rep_*` criadas de um esquema rascunho, com a 26 pulada em silêncio). Aditivo garante
   existência, não formato; os três comandos acima são idempotentes e garantem formato.
2. **`equipamentos.data_remocao date`** e **`equipamentos.data_baixa date`**, com
   `add column if not exists`. Anuláveis, sem default.
3. **Trava da situação**: `drop constraint if exists equipamentos_situacao_chk` seguido de
   `add constraint equipamentos_situacao_chk check (situacao in ('instalado','removido','baixado'))`.
   Comentar que, ao contrário de `funciona` na migração 41, aqui **não** há dado legado para migrar
   antes: a coluna nasce com o default no passo 1, então nenhuma linha pode invalidar a trava.
4. **Trava de coerência da baixa**:
   `add constraint equipamentos_baixa_chk check (data_baixa is null or situacao = 'baixado')`.
   Comentar que ela é possível porque `baixado` é **terminal** (D-uyz-05): não existe caminho de
   volta que deixasse uma data de baixa órfã. Comentar também por que **não** existe a trava
   simétrica para `data_remocao`: uma máquina removida e depois reinstalada mantém, de propósito, a
   data da remoção anterior — é histórico, não incoerência.
5. **Quatro colunas em `logs_manutencao`**, todas `add column if not exists`, todas anuláveis (só a
   OS de movimentação as usa):
   `local_destino_id integer references cmasm_locais(id) on delete set null`,
   `local_origem_id integer references cmasm_locais(id) on delete set null`,
   `equip_substituido_id integer references equipamentos(id) on delete set null`,
   `destino_remocao text`.
   Comentar a escolha de `on delete set null` em vez do `cascade` que `equip_id` usa: perder a
   referência é ruim, apagar a OS inteira é pior — e o projeto arquiva, então na prática nenhuma das
   três dispara. Comentar que os tipos são `integer` porque `cmasm_locais.id` e `equipamentos.id`
   são `integer` (conferido nas migrações 04 e 19), não `uuid` como `logs_manutencao.id`.
6. **Trava do destino da remoção**: `add constraint logs_manutencao_destino_remocao_chk check
   (destino_remocao is null or destino_remocao in ('guardada','baixa'))`. `null` é o caso normal:
   toda OS que não é de remoção.
7. **Nenhum índice novo**, e comentar por quê: nenhuma consulta filtra por essas quatro colunas —
   `loadLogsFromSupabase()` faz `select('*')` sem `where` e resolve tudo em memória. O índice de
   `equip_id` da migração 40 existe porque `ctEncerrarHistorico()` consulta por ele; criar índice em
   tabela de 10 linhas que ninguém consulta só custa escrita.
8. `comment on column` para as sete colunas novas, dizendo o que cada uma guarda e citando a decisão
   correspondente (D-uyz-03 nas três FKs, D-uyz-05 em `situacao`, D-uyz-06 em `destino_remocao`,
   D-uyz-18 nas duas datas). No comentário de `situacao`, escrever com todas as letras que ela é
   **ortogonal a `funciona`** (D-uyz-20) — uma diz onde a máquina está no ciclo patrimonial, a outra
   diz se ela funciona — e que `baixado` é terminal.
9. **Nada de RLS neste arquivo**, escrito como comentário: as policies de `equipamentos` e
   `logs_manutencao` continuam `to authenticated using (true)`, sem cargo (D-uyz-23), e a trava de
   admin da baixa é UX apenas. Nenhuma tabela nova foi criada, então nenhuma policy nova é devida.
10. **Bloco final comentado com a conferência pós-aplicação**: contagem de `situacao` agrupada
    (esperado `instalado` 171, e nada mais); as 3 colunas novas de `equipamentos` e as 4 de
    `logs_manutencao` em `information_schema.columns` (esperado 7); as três travas em `pg_constraint`
    com `pg_get_constraintdef`; `select is_nullable, column_default from information_schema.columns
    where table_name='equipamentos' and column_name='situacao'` (esperado `NO` e
    `'instalado'::text` — é o que prova que a forma foi garantida, não só a existência); e
    `select count(*) from equipamentos where situacao <> 'instalado'` (esperado 0 no dia).

**(b) Bloco de vocabulário na refrigeração.** Em `refrigeracao/index.html`, inserir **imediatamente
antes** da linha `/* ── alertas: contagem única ── */` (o recorte que os gates já usam termina ali e
passa a conter o bloco novo, que é o que faz `alertasPmoc` e o inventário enxergarem os helpers) um
bloco começando com a linha exata
`/* ── situação patrimonial do equipamento: instalado/removido/baixado ── */`, contendo:

- `var EQUIP_SITUACOES = {...}` — lista fechada de três chaves com `rotulo` ("Instalado", "Removido
  — sem local", "Baixado"), `curto` ("INSTALADO", "REMOVIDO", "BAIXADO"), `classe` e `icone` do
  FontAwesome já usado no arquivo. `instalado` **não desenha pílula nenhuma** na lista (é o caso
  normal de 171 de 171; uma pílula em todo cartão é ruído); as classes novas chamam-se
  `pill-sit-removido` e `pill-sit-baixado` — **nunca** `pill-baixa`, que já existe e é a criticidade.
- `var SITUACAO_ORDEM = ['instalado','removido','baixado'];`
- `function normalizarSituacaoEquip(v)` — D-uyz-11, com o comentário explicando as duas respostas
  diferentes: `undefined`/`null`/`''` devolvem `'instalado'` (banco sem a migração 42, ou consulta
  que não pediu a coluna); `hasOwnProperty` contra a lista fechada devolve o próprio valor; qualquer
  outro texto devolve `null`. Sem `trim`, sem conversão de caixa, sem conversão para texto — mesma
  técnica de `normalizarEstadoEquip` e `normalizarFlora`.
- `function equipSituacao(e)`, `function equipInstalado(e)`, `function equipRemovido(e)`,
  `function equipBaixado(e)`, `function rotuloSituacaoEquip(v)`, `function situacaoPill(v)`
  (devolve string vazia para `instalado`).
- `function equipamentosOperacionais(lista)` — `filter(equipInstalado)`, preservando a ordem.
  É o ponto único que o resto da tela chama.
- `function contarNaoOperacionais(dados, busca)` — quantos removidos/baixados casam com a mesma
  busca textual de `filtrarInventario`, para a tela vazia poder **dizer** que eles existem em vez de
  calar. Pura, sem DOM.

**(c) A ponte de campos.** Em `CAMPOS_EQUIP`, acrescentar `situacao: 'situacao'`,
`dataRemocao: 'data_remocao'` e `dataBaixa: 'data_baixa'`. **Não** acrescentar nenhuma das três a
`EQUIP_EDITAVEIS` (D-uyz-12) — e escrever o motivo no comentário que já explica por que `lat`/`lon`/
`localId`/`ultimaManutencao` ficam de fora, na mesma frase: situação muda por conferência de OS.

**(d) A varredura dos call sites.** Lista fechada, levantada lendo o arquivo — nenhum pode ficar
para trás, porque um deles sozinho já desalinha um número da tela:

| Onde | O que muda |
|---|---|
| `renderDash` | `var total`, `ok`, `critica`, `alertasPmoc(...)`, `pmocDue` e o badge `pmoc-badge` passam a partir de `equipamentosOperacionais(DATA)`, calculada **uma vez** no topo da função |
| `renderAlerts` | `alertasPmoc(DATA, now)` → `alertasPmoc(equipamentosOperacionais(DATA), now)` |
| `renderPmoc` | `DATA.filter(...)` → `equipamentosOperacionais(DATA).filter(...)` |
| `dvRenderCharts` | `var ativos = DATA.filter(e.tipo!=='RETIRADO')` passa a filtrar **também** por `equipInstalado`. O filtro legado de `RETIRADO` **fica** — casa com zero linha hoje (as 2 foram excluídas na importação) e removê-lo é conserto não pedido |
| `openNewOSForm` | o `<select>` de equipamento lista só operacionais — não se abre OS de manutenção para máquina que não está instalada |
| `ctNovaOS` | idem, no `<select>` da contratação |
| `filtrarInventario` | ver (e) |
| `openDetail` | ver (f) |

`alertasPmoc` **não** filtra por dentro: ela é pura, tem gate próprio e continua recebendo a lista
que o chamador escolher. Manter o contrato dela intacto é o que mantém `tests/refrigeracao-contagens.test.js`
válido em vez de verde por acidente.

**(e) `filtrarInventario` e os dois chips novos.** Na função pura `filtrarInventario(dados, busca,
chip)`, aplicar a busca textual como hoje e depois:
- `chip==='removidos'` → `equipRemovido(e)`;
- `chip==='baixados'` → `equipBaixado(e)`;
- **qualquer outro chip** (inclusive `'todos'`) → exige `equipInstalado(e)` **antes** de avaliar a
  regra de hoje.
No markup de `#inv-chips`, dois botões novos ao fim: `Removidos` e `Baixados`. Em `renderInv`, o
rótulo `#inv-label` diz "Todos os Equipamentos" só quando o chip é `todos` **e** não há
não-operacional escondido; havendo, dizer "Instalados". No estado vazio, quando a busca não casa com
nenhum instalado mas casa com N removidos/baixados (`contarNaoOperacionais`), a mensagem informa o
número e nomeia o chip que os alcança — mesmo idioma da mensagem de "Vencidos" que já está lá.
`etiquetasDoInventario` herda tudo sem alteração (é o segundo consumidor, D-s3h-08): etiqueta de
máquina baixada não sai por acidente.

**(f) A ficha.** Em `openDetail`, no bloco **1 · Local**: quando a máquina não está instalada,
mostrar `situacaoPill(...)` no `#dh-pills` (ao lado de `statusPill`/`critPill`) e, dentro do bloco,
substituir os campos de local por uma linha honesta — "Sem local — removido em dd/mm/aaaa" ou
"Baixado em dd/mm/aaaa" — em vez de exibir `predio`/`local` vazios. **Os quatro blocos e a ordem
deles não mudam** (`tests/refrigeracao-ficha-equipamento.test.js` compara os índices no corpo da
função). O link direto `?equip=` continua abrindo a ficha de máquina removida ou baixada: um link
que alguém guardou não pode passar a mentir que o equipamento não existe.

**(g) O mapa.** Em `mapa/mapa-dados.js`:
- `CONFIG_POR_MODULO.climatizacao` ganha `colunaSituacao: 'situacao'` e
  `situacaoVisivel: 'instalado'`, e `situacao` entra na string `colunas`. `colunaAtivo` **continua
  `null`** — são duas perguntas diferentes: `equipamentos` não tem coluna de arquivamento, e a
  situação patrimonial não é arquivamento. As outras quatro famílias não ganham nada.
- `carregarAtivosDoModulo` monta a consulta com a coluna e com `.eq(config.colunaSituacao,
  config.situacaoVisivel)` **quando a config declara**, e ganha **um único recuo**: se essa consulta
  erra e `config.colunaSituacao` está declarada, repete uma vez sem a coluna e sem o filtro,
  registrando `console.warn` com o motivo (banco sem a migração 42). Só o segundo erro chama
  `mostrarErroDeCarga`. Comentar D-uyz-24 no ponto: selecionar coluna inexistente devolve 400 no
  PostgREST e 171 marcadores sumiriam da tela sem nada dizendo por quê.
- Toda a consulta continua dentro de `mapa-dados.js` — a porta única do módulo
  (`tests/mapa-camadas.test.js`) não é atravessada.

**(h) Gates.**
- **`tests/refrigeracao-situacao-equipamento.test.js`** (novo): sandbox `node:vm` com os recortes
  `/* ── estado do equipamento: vocabulário OP/INOP/OR ── */` → `/* ── alertas: contagem única ── */`
  (que agora contém o bloco de situação) e o recorte do inventário, exercitando **comportamento**:
  as três respostas de `normalizarSituacaoEquip`, `equipamentosOperacionais` preservando ordem,
  `filtrarInventario` nos dois sentidos (chip normal esconde, chip novo isola, busca combina com
  chip novo), e `contarNaoOperacionais`. Mais as asserções estruturais da migração: existe um único
  `42_*.sql`; ele não contém `drop table`, `drop column` nem `delete from`; as chaves de
  `EQUIP_SITUACOES` batem **nos dois sentidos** com o `check (situacao in (...))` do arquivo; o
  `set not null` aparece **depois** do `update ... where situacao is null`; e `situacao`,
  `dataRemocao`, `dataBaixa` estão em `CAMPOS_EQUIP` e **fora** de `EQUIP_EDITAVEIS` (D-uyz-12).
- **`tests/refrigeracao-contagens.test.js`**: acrescentar que `renderDash`, `renderAlerts` e
  `renderPmoc` chamam `equipamentosOperacionais(` — e que `alertasPmoc` **não** filtra por dentro
  (o corpo dela não menciona `equipInstalado`), que é o que prova que o contrato ficou intacto.
- **`tests/mapa-cobertura.test.js`**: o teste que hoje afirma `colunaAtivo: null` para
  `climatizacao` continua valendo; acrescentar que só `climatizacao` declara `colunaSituacao`, e um
  teste de comportamento de `carregarAtivosDoModulo` com um `supa` falso que **erra na primeira
  chamada e devolve linhas na segunda** — asserindo duas chamadas e as linhas da segunda — e outro
  com um `supa` que funciona de primeira, asserindo **uma só** chamada.
  </action>
  <verify>
    <automated>node --test 2>&1 | tail -6</automated>
    <automated>grep -c 'drop table\|drop column\|delete from' supabase/42_refrigeracao_movimentacao.sql | grep -qx 0 && echo OK-sem-destrutivo</automated>
    <automated>for p in 'shared/' 'pmoc.css' 'pmoc-tema' 'data-theme'; do printf '%s=' "$p"; grep -c "$p" refrigeracao/index.html; done</automated>
  </verify>
  <done>
    `supabase/42_refrigeracao_movimentacao.sql` existe, é aditivo, garante forma além de existência,
    e traz o bloco de conferência. `situacao` é lida por um vocabulário único que responde
    "instalado" para a ausência da coluna, e só o instalado alimenta KPIs, alertas, PMOC, gráficos e
    seletores. O inventário esconde removido/baixado dos chips de sempre e os alcança por dois chips
    próprios, dizendo quantos escondeu quando a busca não acha nada. O `/mapa` filtra por situação e
    ainda desenha os 171 marcadores num banco sem a migração. `node --test` verde, os quatro
    `grep -c` do PLAT-15 em 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: o terceiro segmento e o formulário das duas OS, com os três casos derivados</name>
  <files>refrigeracao/index.html, tests/refrigeracao-movimentacao-os.test.js</files>
  <behavior>
    - casoDeInstalacao devolve 'substituicao' sempre que há máquina substituída, mesmo com o destino já ocupado
    - casoDeInstalacao devolve 'adicional' quando o destino já tem ao menos um equipamento instalado e não há substituída
    - casoDeInstalacao devolve 'novo-local' quando o destino está vazio e não há substituída
    - osEhMovimentacao é verdadeiro só para INSTALAÇÃO e REMOÇÃO, e falso para os sete tipos de manutenção
    - checklistDaOS devolve a lista de partes na remoção, a de instalação na instalação, e a de manutenção em qualquer outro tipo
    - checklistDaOS recua para SPLIT num tipo de equipamento desconhecido, nos três casos
    - checklistDaOS de JANELA na remoção não menciona condensadora nem linha frigorígena — é bloco único
    - MOV_TIPOS não aparece em MAINT_TIPOS, nos dois sentidos
    - rotuloLocalDestino devolve "PRÉDIO / SALA" quando o nó tem pai, e só o nome quando é a própria edificação
    - rotuloLocalDestino não entra em laço infinito quando parent_id aponta para o próprio nó
    - movSondarEsquema deixa MOV_OK falso quando o select erra, sem lançar
    - renderOS exclui as OS de movimentação, e renderMovim exclui as de manutenção — nenhuma OS aparece nos dois segmentos nem some dos dois
  </behavior>
  <action>
**(a) Vocabulário da movimentação.** Em `refrigeracao/index.html`, inserir **imediatamente antes**
da linha `/* ── fluxo da OS interna: tela e ações ── */` um bloco começando com
`/* ── movimentação: instalação e remoção ── */`, contendo (tudo puro, sem API de navegador, para o
gate exercitar em Node):

- `var MOV_TIPOS = ['INSTALAÇÃO','REMOÇÃO'];` com o comentário de D-uyz-21 dizendo por que eles
  **não** entram em `MAINT_TIPOS`. `MAINT_TIPOS` não é tocada.
- `function osEhMovimentacao(entry)` — `MOV_TIPOS.indexOf(entry && entry.tipo) >= 0`.
- `var CHECKLIST_REMOCAO = {...}` e `var CHECKLIST_INSTALACAO = {...}`, com as **mesmas quatro
  chaves** de `CHECKLIST` (`SPLIT`, `PISO/TETO`, `SELF CONTAINED`, `JANELA`). Remoção: evaporadora
  desmontada e retirada, condensadora desmontada e retirada, linha frigorígena recolhida (com
  recolhimento do gás), dreno removido e ponto vedado, suportes/mão-francesa retirados, alimentação
  elétrica desligada e ponto isolado, local limpo e furos vedados. `JANELA` é bloco único: aparelho
  retirado, moldura/vedação do vão, alimentação elétrica isolada, suportes retirados, vão vedado —
  **sem** condensadora e **sem** linha frigorígena (D-uyz-16). Instalação: fixação de suportes,
  posicionamento das unidades, linha frigorígena conectada, teste de estanqueidade/vácuo, dreno com
  caimento verificado, alimentação elétrica e disjuntor, teste de funcionamento e medição inicial.
- `function checklistDaOS(tipoOS, tipoEquip)` — escolhe a tabela pelo tipo da **OS** e depois a
  entrada pelo tipo do **equipamento**, com o mesmo recuo para `SPLIT` que `openLogForm` já usa
  (`tabela[tipoEquip] || tabela['SPLIT']`). Ponto único: `openLogForm`, `openMovForm` e `manAbrirOS`
  passam a chamá-la.
- `var CASOS_INSTALACAO = {...}` (rótulos dos três casos) e
  `function casoDeInstalacao(destinoId, substituidoId, ocupantesDoDestino)` — a derivação de
  D-uyz-03, nesta ordem exata: substituída preenchida → `'substituicao'`; senão `ocupantes > 0` →
  `'adicional'`; senão → `'novo-local'`. `ocupantesDoDestino` é **número**, calculado pelo chamador
  a partir de `DATA` (nenhuma consulta nova: as 171 linhas já estão em memória e todas têm
  `local_id`).
- `function rotuloLocalDestino(id, porId)` — D-uyz-25. `porId` é um índice `{id: linha}`; sobe um
  nível por `parent_id` com **guarda de ciclo** (`parent_id` não tem restrição de aciclicidade no
  Postgres, e um cadastro circular travaria a aba sem erro nenhum — a mesma lição de
  `localAscendente` em `mapa/mapa-geometria.js`). Devolve `{predio, local, rotulo}`; quando o nó não
  tem pai (já é edificação), `predio` e `local` são o próprio nome. Devolve `null` quando o id não
  está no índice — é o que faz `aplicarInstalacao` recusar em vez de gravar meia coisa.

**(b) Colunas novas na ponte e a sonda própria.** Em `CAMPOS_LOG`, acrescentar
`localDestinoId: 'local_destino_id'`, `localOrigemId: 'local_origem_id'`,
`equipSubstituidoId: 'equip_substituido_id'` e `destinoRemocao: 'destino_remocao'`. No bloco
`/* ── fluxo da OS interna: porta de escrita ── */`, acrescentar, **sem tocar** em
`manSondarEsquema` (D-uyz-13):

```
var MOV_OK = false;
async function movSondarEsquema() { ... select('id,local_destino_id,destino_remocao').limit(1) ... }
```

`MOV_OK` é falso no erro, sem lançar. `initAppOnce` (e `acessoLivre`) passam a chamá-la **ao lado**
de `manSondarEsquema`, não dentro dela.

**(c) Carga dos locais, sob demanda.** No bloco de movimentação, `var LOCAIS = []`,
`var LOCAIS_POR_ID = {}`, `var LOCAIS_CARREGADOS = false` e
`async function carregarLocais()` — `supa.from('cmasm_locais').select('id,nome,tipo,parent_id,ativo')
.eq('ativo', true).order('nome')`, montando o índice por id. Chamada **fora** do `Promise.all`
principal, como `carregarCatalogoReparos()`/`carregarCompras()` em Máquinas: sob demanda, ao abrir o
formulário de movimentação e ao aplicar uma instalação. No erro, deixa `LOCAIS` vazio e
`LOCAIS_CARREGADOS` falso — o formulário diz que não conseguiu carregar os locais e desabilita o
botão de salvar, em vez de oferecer um `<select>` vazio que grava `null`. Note que a árvore tem
exatamente dois níveis (sala → edificação) e que **175 dos 190 ativos posicionados apontam para
`sala`**, então o `<select>` de destino apresenta as salas com o prédio no rótulo.

**(d) O terceiro segmento.** Em `ctInjectToggle`: quando `MAN_FLUXO_OK && MOV_OK`, injetar o
terceiro botão `#seg-movim` (`onclick="ctSetMode('movim')"`), acrescentar a classe `tres` ao
`.seg-toggle` e inserir `#movim-chips` (oculto) ao lado de `#ct-chips`. Sem as duas flags, a função
faz **exatamente** o que faz hoje: dois botões, sem a classe `tres` (D-uyz-24).

Rótulos e largura (o desenho importa e 375 px é a tela alvo): **"Manutenção" | "Contratações" |
"Inst./Remoção"**, cada botão com `title` e `aria-label` com o nome por extenso. No CSS embutido,
uma regra nova `.seg-toggle.tres .seg-btn{font-size:12px;padding:9px 4px;white-space:nowrap}` e
`.seg-toggle.tres .seg-btn i{display:none}` — com três segmentos o ícone come os ~20 px que faltam
para "Contratações" caber inteiro, e rótulo cortado dentro de botão é defeito, não detalhe. As duas
regras nascem na folha embutida da refrigeração; nenhuma folha comum do projeto é tocada, e nenhum
comentário do código novo pode citar o caminho dela (é um dos quatro literais que o PLAT-15 conta).

Em `ctSetMode`, tratar o terceiro modo: as três classes `active`, as três faixas de chips, o título
da seção (`'Instalação e Remoção'`) e o render correspondente. `openNewOS()` passa a ramificar: em
`ctMode==='movim'`, abre `openMovForm()`; nos outros dois, o comportamento de hoje **intacto**
(inclusive a esquisitice pré-existente de o FAB abrir OS de manutenção no modo contratações —
registrar, não consertar).

**(e) As duas listas.** `renderOS` passa a **excluir** as OS de movimentação
(`!osEhMovimentacao(o.entry)`) logo no início do filtro; `renderMovim()` é o espelho, listando só
elas, ordenadas como `getAllOSEntries()` já ordena. O cartão de movimentação reusa `.os-card`,
`statusPillOS`, `manClasseCard` e `critPill`, e acrescenta uma linha com o **rótulo do caso**
(instalação) ou o **destino** (remoção, com a palavra "Baixa patrimonial" destacada em vermelho).
Clicar abre `manAbrirOS` — é a mesma OS, na mesma gaveta. `#movim-chips`: Todas / Em aberto / P/
aprovar / Instalações / Remoções. `contarOSPendentes` e o `#os-badge` **não** mudam: uma instalação
pendente é trabalho pendente e deve contar.

**(f) O formulário.** `openMovForm(tipoInicial)` — uma gaveta, com:
- `<select>` de **tipo**: Instalação / Remoção (`MOV_TIPOS`), que redesenha o corpo ao mudar;
- data (padrão `today()`), técnico, descrição — os mesmos campos de `openLogForm`;
- **Instalação**: `<select>` de equipamento listando os **removidos** (`equipRemovido`) mais a opção
  **"➕ Cadastrar novo equipamento…"** (D-uyz-08), que abre o cadastro em modo criação e volta com o
  id novo selecionado; `<select>` de **local de destino** (salas ativas, rotuladas por
  `rotuloLocalDestino`); `<select>` opcional de **máquina substituída**, limitado aos equipamentos
  hoje instalados **no destino escolhido** — quando o destino muda, essa lista é redesenhada. Abaixo
  dos três, uma linha viva com o **caso derivado** (`casoDeInstalacao`), que muda sozinha conforme o
  usuário escolhe: é o que torna D-uyz-03 visível em vez de implícito. Escolher uma substituída que
  ainda está `instalado` mostra o aviso de D-uyz-14 ali mesmo, nomeando a OS de remoção que falta.
  Máquina `baixado` **não é listada** (D-uyz-05, terminal);
- **Remoção**: `<select>` de equipamento listando só os **instalados**; a origem é preenchida
  sozinha a partir do `local_id` da máquina escolhida e é **mostrada, não editável**; `<select>` de
  **destino**: "Guardada — volta ao inventário" e, **só para admin** (`podeDarBaixa()`), "Baixa
  patrimonial". Escolher baixa mostra um aviso de que é irreversível;
- o **checklist** vindo de `checklistDaOS(tipo, tipoDoEquipamentoEscolhido)`, redesenhado quando o
  equipamento muda (é o tipo dele que escolhe a lista).

`function podeDarBaixa()` fica junto de `podeEditarCadastro`: falso no modo observador, verdadeiro
só para `admin`. Uma lista, os pontos de chamada todos citando-a — o botão, o `<select>`, o salvar e
(na Task 3) a conferência.

**(g) O salvar.** `salvarMovOS()`:
- recusa em modo observador e sem `manPode('abrir')`, com as mesmas mensagens de `saveLogEntry`;
- valida: tipo dentro de `MOV_TIPOS`; equipamento escolhido; instalação exige destino e recusa
  máquina `baixado`; remoção exige destino da remoção dentro da lista fechada e recusa `baixa` sem
  `podeDarBaixa()` — **guarda na ação, não só no `<select>`** (D-l7n-03);
- monta o `insert` com `status:'ABERTA'` (o status **nunca** vem de campo, D-l7n-06), o checklist
  montado como em `saveLogEntry`, e as colunas de movimentação. `local_origem_id` da remoção sai do
  `local_id` do equipamento no momento da abertura;
- `addLogEntryAsync` hoje enumera colunas à mão no `insert` — estendê-lo para gravar também as
  quatro novas **por `logParaDb`**, de modo que a ponte de campos continue sendo a única (o gate
  compara `CAMPOS_LOG` com as colunas das migrações 04+40+41+42, nos dois sentidos);
- em seguida abre `manAbrirOS(id)` e chama `renderMovim()` — a OS nasce na gaveta do fluxo, igual à
  de manutenção.

**(h) Cadastro na hora (D-uyz-08).** `openEquipForm(id)` hoje exige `DATA.find(id)` e só atualiza.
Acrescentar, **sem alterar o caminho de edição**, `openEquipNovo(aoCriar)` e `salvarEquipNovo()`:
reusam `campoEquipForm` (sobre um objeto vazio), `EQUIP_EDITAVEIS`, `equipParaDb`, `linkSeguro` e
`podeEditarCadastro`, fazem `insert(...).select().single()`, empurram `dbToEquip(r.data)` em `DATA`
e chamam `aoCriar(novoId)`. É o idioma "➕ Cadastrar novo…" que `maquinas/app.js` já usa nas duas
listas da OS. A situação do equipamento novo **não** é escolhida no formulário: ela nasce
`'instalado'` pelo default do banco e é a conferência da OS que a confirma — no intervalo, a máquina
recém-cadastrada aparece como instalada sem local, que é a verdade do momento.

**(i) Gate.** `tests/refrigeracao-movimentacao-os.test.js` (novo), sandbox `node:vm` com os recortes
`/* ── movimentação: instalação e remoção ── */` → `/* ── fluxo da OS interna: tela e ações ── */`,
o do vocabulário do fluxo e o da porta de escrita. Comportamento: os três casos de
`casoDeInstalacao` (incluindo substituída **com** destino ocupado, que é o caso que a ordem das
condições decide), `osEhMovimentacao` nos dois sentidos, `checklistDaOS` nos três tipos e no recuo
para `SPLIT`, `JANELA` na remoção sem condensadora nem linha, `rotuloLocalDestino` com pai/sem pai/
com ciclo, `movSondarEsquema` no erro. Estrutural: `MOV_TIPOS` disjunto de `MAINT_TIPOS` nos dois
sentidos; toda coluna criada pela migração 42 em `logs_manutencao` aparece como valor em
`CAMPOS_LOG` e todo valor de `CAMPOS_LOG` é coluna real (união 04+40+41+42); o corpo de `renderOS`
chama `osEhMovimentacao` e o de `renderMovim` também; `ctInjectToggle` só injeta o terceiro botão
sob `MAN_FLUXO_OK && MOV_OK`; a regra `.seg-toggle.tres` existe no CSS embutido; `salvarMovOS` grava
`'ABERTA'` fixo e **não** lê nenhum campo de status.
  </action>
  <verify>
    <automated>node --test 2>&1 | tail -6</automated>
    <automated>grep -v '^#' refrigeracao/index.html | grep -c "seg-movim"</automated>
    <automated>for p in 'shared/' 'pmoc.css' 'pmoc-tema' 'data-theme'; do printf '%s=' "$p"; grep -c "$p" refrigeracao/index.html; done</automated>
  </verify>
  <done>
    A aba OS tem três segmentos e o terceiro lista as OS de instalação e remoção, que somem do
    segmento de manutenção sem sumir do badge. O formulário abre as duas OS, deriva o caso da
    instalação na tela conforme o usuário escolhe, oferece cadastrar equipamento novo na hora, e só
    mostra "Baixa patrimonial" para admin. Num banco sem a migração 42 o terceiro botão não é
    injetado e a tela é a de hoje. `node --test` verde, PLAT-15 em 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: a conferência aplicando cadastro, local e situação, com a baixa gateada em admin</name>
  <files>refrigeracao/index.html, tests/refrigeracao-movimentacao-os.test.js, tests/refrigeracao-fluxo-os-interna.test.js, TESTES.md</files>
  <behavior>
    - aplicarInstalacao grava local_id, predio, local, data_instalacao (a data da OS) e situacao instalado, num único update
    - aplicarInstalacao não escreve nada quando o equipamento já está exatamente no estado-alvo — conferir duas vezes não grava duas vezes
    - aplicarInstalacao recusa quando o destino não resolve na árvore de locais, sem gravar nada
    - aplicarInstalacao recusa máquina baixada
    - aplicarInstalacao recusa quando a máquina substituída ainda está instalada, e a mensagem nomeia a OS de remoção que falta
    - aplicarRemocao limpa local_id, predio, local, lat e lon, grava data_remocao com a data da OS e situacao removido
    - aplicarRemocao com destino baixa grava situacao baixado e data_baixa, e não muda funciona
    - aplicarRemocao recusa o destino baixa para gestor e para tecnico, e aceita para admin
    - manConferir de uma OS de movimentação grava o cadastro ANTES do status terminal, e não avança o status quando o cadastro falha
    - manConferir de uma OS de manutenção continua exatamente como hoje — ultima_manutencao e estado, na ordem de hoje
    - manTemEvidencia de uma OS de remoção aceita checklist de partes completo sem foto, e recusa checklist parcial sem foto
    - manTemEvidencia de uma OS de manutenção continua aceitando medição isolada
  </behavior>
  <action>
**(a) Aplicação do cadastro.** No bloco `/* ── encerramento de OS: última manutenção ── */`, ao lado
de `atualizarUltimaManutencao` e `atualizarEstadoEquip` (mesma vizinhança, mesmo idioma), duas
funções novas — **convergentes e idempotentes** (D-uyz-15), cada uma com **um único** `.update()`:

`async function aplicarInstalacao(equipId, entry)`
1. `await carregarLocais()` se ainda não carregou; resolver `rotuloLocalDestino(entry.localDestinoId,
   LOCAIS_POR_ID)`. **Null → recusa** com mensagem clara, sem escrever (D-uyz-25).
2. Recusar se o equipamento é `baixado` (D-uyz-05) e se a substituída (`entry.equipSubstituidoId`,
   quando houver) ainda está `instalado` (D-uyz-14) — a mensagem nomeia a OS de remoção que falta.
3. Montar o alvo: `local_id`, `predio`, `local`, `data_instalacao` = **`entry.date`** (D-uyz-18),
   `situacao` = `'instalado'`. **Comparar campo a campo com o estado atual do objeto em `DATA`** e
   devolver `true` sem escrever quando já é igual — é isso que torna a repetição inofensiva.
4. `supa.from('equipamentos').update(alvo).eq('id',equipId)`; no erro, `showToast` e `false`.
   No sucesso, refletir os campos no objeto de `DATA` e devolver `true`.

`async function aplicarRemocao(equipId, entry)`
1. Ler `entry.destinoRemocao`; recusar valor fora de `['guardada','baixa']`.
2. **`'baixa'` exige `podeDarBaixa()`** (D-uyz-07) — guarda na ação, não só no `<select>` e não só no
   botão. Escrever no comentário, sem eufemismo, que essa guarda é UX (D-uyz-23).
3. Alvo: `local_id`, `predio`, `local`, `lat`, `lon` todos `null` (D-uyz-19); `data_remocao` =
   `entry.date`; `situacao` = `'removido'` ou `'baixado'`; e, na baixa, `data_baixa` = `entry.date`.
   **`funciona` não é tocada** (D-uyz-20).
4. Mesma convergência, mesmo `update` único, mesmo reflexo em `DATA`.

**(b) A conferência.** Em `manConferir`, no ramo aprovado, **antes** de `manAtualizarOS` (D-uyz-15):
se `osEhMovimentacao(achado.entry)`, chamar `aplicarInstalacao`/`aplicarRemocao` conforme o tipo e
**abortar sem mudar o status** quando devolverem `false`. Só depois vem o `update` do status para
`CONFERIDA` com a assinatura. A guarda de cargo ganha um degrau: uma OS de remoção com
`destinoRemocao === 'baixa'` exige `podeDarBaixa()` além de `manPode('conferir')` — um gestor confere
remoção comum, não confere baixa.

O ramo de manutenção **não muda em nada**: continua `manAtualizarOS` primeiro,
`atualizarUltimaManutencao` + `atualizarEstadoEquip` depois, na ordem de hoje, com o gate atual
intacto. Duas ordens diferentes, cada uma com o motivo escrito no ponto: na manutenção os efeitos
são idempotentes por si (`ultima_manutencao` não retrocede, `atualizarEstadoEquip` não grava igual) e
não há o que repetir; na movimentação a repetição é a rede de segurança, e ela só existe enquanto a
OS não é terminal.

O seletor `#man-conf-estado` (D-q57-04) **não aparece** em OS de movimentação: instalar ou remover
não é diagnóstico de funcionamento (D-uyz-20). `atualizarEstadoEquip` continua sendo chamada só no
ramo de manutenção.

**(c) O painel da movimentação na gaveta.** Em `manAbrirOS`, quando `osEhMovimentacao(entry)`,
inserir **depois** do bloco `1 · Abertura` um painel próprio (não um quinto bloco solto — é a
mesma OS): origem, destino, caso derivado (instalação) ou destino da remoção (remoção, com a baixa
em destaque), máquina substituída com link para a ficha dela, e o **checklist de partes** listado
item a item com o estado de cada um — não só o `done/total` que o cabeçalho mostra. Em
`EM_EXECUCAO` e com `manPode('executar')`, os itens são marcáveis, e
`manMarcarChecklist(logId)` grava o array por `manAtualizarOS` (a porta de escrita de sempre).
Os títulos dos blocos 2/3/4 continuam os mesmos — a régua de 6 passos é a mesma régua.

**(d) Evidência (D-uyz-17).** `manTemEvidencia(entry)` ganha um ramo: para OS de movimentação, é
verdadeira com **ao menos uma foto** OU com o **checklist completo** (todos os itens `done`, e a
lista não vazia). Para as demais, a regra de hoje, byte a byte. O guarda continua também dentro de
`manMudarStatus` (D-l7n-09): botão escondido não é validação.

**(e) Gates.**
- **`tests/refrigeracao-movimentacao-os.test.js`**: os casos de comportamento de (a)–(d), com um
  `supa` falso capturando o `patch`. Lembrar que o `patch` capturado traz **nomes de coluna**
  (`local_destino_id`, `data_remocao`), não o camelCase do app — foi o tropeço registrado no SUMMARY
  do 260821-l7n. Comparar **campo a campo** (realm do `node:vm`). Casos obrigatórios: a segunda
  chamada de `aplicarInstalacao` no mesmo estado **não** chama a porta de escrita; `aplicarRemocao`
  com `baixa` sob cargo `gestor` recusa e **não** escreve; sob `admin` escreve `situacao='baixado'`
  e `data_baixa`, e o patch **não contém** `funciona`; `aplicarRemocao` põe `null` em `lat` e `lon`;
  `manConferir` de movimentação com `aplicarInstalacao` falhando **não** chama a porta de escrita do
  status; `manTemEvidencia` nos quatro recortes (movimentação com checklist completo / parcial /
  com foto; manutenção com medição isolada).
- **`tests/refrigeracao-fluxo-os-interna.test.js`**: acrescentar a asserção que fixa o **sentido
  novo sem afrouxar o antigo** — o corpo de `manConferir` chama `aplicarInstalacao`/`aplicarRemocao`
  **antes** de `manAtualizarOS` no ramo de movimentação (comparação de índices no corpo da função),
  e continua chamando `atualizarUltimaManutencao` **depois** no ramo de manutenção. Os casos de
  hoje continuam passando sem alteração — se algum precisar mudar, é porque o comportamento antigo
  foi quebrado.
- **`TESTES.md`**: roteiro manual novo, depois de aplicar a migração 42, cobrindo o ciclo real com
  sessão autenticada: (1) técnico abre OS de Remoção de uma máquina, marca as partes, executa,
  gestor confere → a máquina some do mapa, do inventário padrão, dos KPIs e dos dois seletores de
  OS, e aparece no chip "Removidos"; (2) técnico abre OS de Instalação dessa mesma máquina em outra
  sala → o rótulo do caso muda sozinho entre "novo local" e "mais uma máquina" conforme o destino;
  (3) instalação com substituição de uma máquina ainda instalada → a conferência **recusa** e nomeia
  a OS de remoção que falta; (4) baixa: gestor **não** consegue conferir, admin consegue, e a
  máquina passa a "Baixados" e nunca mais aceita instalação; (5) cadastrar equipamento novo pelo
  próprio formulário de instalação; (6) conferir a mesma OS duas vezes (recarregando a página entre
  as duas) → nada duplica; (7) a tela em **375 px** com os três segmentos, conferindo que nenhum
  rótulo é cortado. Registrar a conferência pós-aplicação da migração colada do rodapé do `.sql`.
  </action>
  <verify>
    <automated>node --test 2>&1 | tail -6</automated>
    <automated>node --test tests/refrigeracao-fluxo-os-interna.test.js 2>&1 | tail -4</automated>
    <automated>for p in 'shared/' 'pmoc.css' 'pmoc-tema' 'data-theme'; do printf '%s=' "$p"; grep -c "$p" refrigeracao/index.html; done</automated>
  </verify>
  <done>
    Conferir uma OS de instalação move a máquina no cadastro; conferir uma de remoção a tira do
    local, limpa a coordenada e a manda para "removida" ou "baixada". A baixa só passa por admin, e
    isso está escrito como trava de tela, não de banco. Conferir duas vezes não muda nada na
    segunda, e uma falha no cadastro deixa a OS aberta para repetir em vez de fechada pela metade. O
    checklist de partes é visível e marcável na gaveta, e vale como evidência de execução. `node
    --test` verde com os gates antigos intactos, PLAT-15 em 0, roteiro manual em `TESTES.md`.
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Fronteira | Descrição |
|---|---|
| navegador → PostgREST (`anon key` no HTML, por decisão de projeto) | qualquer pessoa com a URL monta chamada REST à mão; a autorização real é RLS, e a RLS destas duas tabelas é `to authenticated using (true)` |
| formulário → `logs_manutencao` | texto livre do usuário (descrição, técnico, itens de checklist) entra em `jsonb` e volta para o DOM |
| `cmasm_locais` → `equipamentos` | o nome da sala, escolhido por terceiros noutro módulo, é copiado para `predio`/`local` na conferência |
| conferência → cadastro | uma única ação muda, de uma vez, local, coordenada e situação patrimonial de um bem público |

## STRIDE Threat Register

| Threat ID | Categoria | Componente | Severidade | Disposição | Mitigação |
|---|---|---|---|---|---|
| T-uyz-01 | Elevation of Privilege | baixa patrimonial (`podeDarBaixa`) | high | accept | A policy de `equipamentos` é `to authenticated using (true)`: um técnico autenticado consegue gravar `situacao='baixado'` por REST. A tela guarda em três pontos (`<select>`, `aplicarRemocao`, `manConferir`) e a OS grava quem conferiu. Fechar exige migração de policy, **fora deste escopo** (D-uyz-23) — pendência a registrar no SUMMARY sem eufemismo, ao lado de D-l7n-03 e D-q57-13 |
| T-uyz-02 | Tampering | `manConferir` → `aplicarInstalacao`/`aplicarRemocao` | high | mitigate | Cadastro antes do status terminal (D-uyz-15) e funções convergentes: um retry de rede ou um duplo clique não produzem estado meio-aplicado nem gravação dupla; `CONFERIDA` terminal barra a segunda conferência pelo próprio fluxo |
| T-uyz-03 | Tampering | `aplicarInstalacao` sem árvore de locais | medium | mitigate | Recusa quando `rotuloLocalDestino` devolve null — nunca grava `local_id` com `predio`/`local` de outra sala (D-uyz-25) |
| T-uyz-04 | Information Disclosure | checklist e descrição renderizados no cartão e na gaveta | medium | mitigate | Todo texto vindo do banco passa por `esc()` — inclusive os rótulos de item de checklist e o nome da sala vindo de `cmasm_locais`, que é escrito por outro módulo |
| T-uyz-05 | Denial of Service | `rotuloLocalDestino` subindo `parent_id` | medium | mitigate | Guarda de ciclo com teto de saltos: `parent_id` não tem restrição de aciclicidade no Postgres e um cadastro circular travaria a aba sem erro nenhum (mesma lição de `localAscendente` em `mapa/mapa-geometria.js`) |
| T-uyz-06 | Repudiation | quem moveu ou baixou o bem | medium | mitigate | A movimentação só acontece por OS, e a OS já grava `delineado_por`, `aprovador`/`data_aprovacao` e `conferente`/`data_conferencia` (migração 40) — a trilha é a própria OS (D-l7n-08) |
| T-uyz-07 | Denial of Service | `/mapa` num banco sem a migração 42 | medium | mitigate | Recuo de uma repetição em `carregarAtivosDoModulo` (D-uyz-24): sem ele, um `select` de coluna inexistente devolve 400 e apaga 171 marcadores sem nada dizendo por quê |
| T-uyz-08 | Tampering | `situacao` alterada pelo formulário de cadastro | high | mitigate | `situacao`/`dataRemocao`/`dataBaixa` ficam fora de `EQUIP_EDITAVEIS` (D-uyz-12) — `equipParaDb` descarta a chave, então nem um `patch` montado à mão pela tela passa |
| T-uyz-09 | Spoofing | pacote npm/pip/cargo | — | n/a | Zero build, zero dependência nova, nada instalado — não há superfície de cadeia de suprimentos neste task |

</threat_model>

## Critérios de sucesso

- [ ] `supabase/42_refrigeracao_movimentacao.sql` escrito, aditivo, **não aplicado** por este executor
- [ ] `node --test` verde, partindo de **647/647** e sem nenhum gate antigo afrouxado
- [ ] Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html` continuam em **0**
- [ ] `git diff --stat` toca só `refrigeracao/index.html`, `mapa/mapa-dados.js`, o `.sql` novo, os
      arquivos de teste e `TESTES.md` — nada em `shared/`, `maquinas/`, `reparos/`, `calibracao/`,
      `predial/`, nem em `mapa/xmap.js`/`mapa/xmap.css`
- [ ] `TESTES.md` com o roteiro manual das sete verificações, incluindo a de 375 px
</content>
</invoke>
