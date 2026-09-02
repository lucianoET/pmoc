---
quick_id: 260821-jpd
slug: corrigir-defeitos-verificados-do-modulo-
date: 2026-08-21
mode: quick
type: execute
status: pending
files_modified:
  - refrigeracao/index.html
  - tests/refrigeracao-contagens.test.js
  - tests/refrigeracao-encerramento-os.test.js
  - tests/refrigeracao-trilha-os.test.js
  - TESTES.md
autonomous: true
must_haves:
  truths:
    - O badge de OS pendente mostra o número real de OS com status PENDENTE
    - O badge de alerta mostra o mesmo número nas duas telas, sem contar o mesmo equipamento duas vezes
    - O observador (acesso livre) vê o histórico de manutenção, não "Sem hist." em 171 de 171
    - A trilha de auditoria da contratação mostra o que está gravado, não campos inexistentes
    - Encerrar uma OS (interna ou de contratação) grava a data em equipamentos.ultima_manutencao
    - Certificar duas vezes não gera duas linhas de histórico
    - Toda mudança de estado de uma OS de contratação deixa uma linha em os_eventos
  artifacts:
    - tests/refrigeracao-contagens.test.js
    - tests/refrigeracao-encerramento-os.test.js
    - tests/refrigeracao-trilha-os.test.js
  key_links:
    - saveLogEntry / ctCertificar -> atualizarUltimaManutencao -> equipamentos.ultima_manutencao -> nextPmoc
    - ctUpd -> ctRegistrarEvento -> os_eventos -> drawer de histórico e impressão da OS
---

# Corrigir defeitos verificados do `/refrigeracao`

Três blocos, todos dentro de `refrigeracao/index.html`. **Sem migração** — as colunas
`equipamentos.ultima_manutencao`, `logs_manutencao.*` e `os_eventos (evento, detalhe,
usuario, criado_em)` já existem em produção e foram conferidas contra o banco `pmoc`.

## O que o banco diz hoje

| Fato medido | Consequência na tela |
|---|---|
| 171 equipamentos, **0** com `ultima_manutencao`, só 4 com log | `nextPmoc()` calcula sobre nada; a agenda PMOC inteira é ficção |
| 4 OS em `os_contratacao`, **2 linhas** em `os_eventos` (ambas do seed SIAFI) | a trilha nunca foi escrita pelo app |
| `getAllOSEntries()` devolve `{equipId, equip, entry}` | `o.status` é `undefined` — badge de OS pendente sempre 0 |
| 35 NOK + vencidas + sem histórico somados sem deduplicar | KPI "Atenção PMOC" dá **202 sobre 171**; e o mesmo badge vale 35 depois de abrir a tela de alertas |
| `os_eventos` tem `detalhe` (singular), sem `de_status`/`para_status`/`role` | a trilha lê quatro campos que não existem |

## Decisões deste plano

- **D-jpd-01 — a contagem de alerta é uma união, não uma soma.** Um equipamento entra
  uma vez se for NOK **ou** vencido **ou** sem histórico. As duas telas passam a ler a
  mesma função (`alertasPmoc`), então o badge não muda mais conforme a última tela
  renderizada. As seções da tela de alertas continuam por motivo e **podem repetir** o
  mesmo equipamento — por isso a tela ganha uma linha dizendo que o total é sem repetição.
- **D-jpd-02 — a seção "sem histórico" passa a contar todos e listar só os críticos.**
  Listar 167 cartões seria inútil; esconder 167 é o que produzia a divergência. Cabeçalho
  conta todos, corpo lista os críticos, e o resto sai numa linha "+N não críticos".
- **D-jpd-03 — `ultima_manutencao` nunca retrocede.** A gravação só acontece se a data da
  OS for **maior** que a que já está lá (comparação de string ISO `YYYY-MM-DD`, que é
  ordem lexicográfica correta). Uma OS retroativa registrada depois não pode empurrar a
  próxima manutenção para trás.
- **D-jpd-04 — o marcador de idempotência é o próprio registro do histórico**, não uma
  coluna nova (não há migração): a descrição da linha criada pela certificação **começa**
  com `Contratação <numero>` (`o.numero` é `unique` no banco; sem número, o `id` uuid).
  Antes de inserir, o app consulta `logs_manutencao` daquele equipamento e desiste se
  alguma descrição já começa com esse prefixo. Certificar duas vezes, ou um retry de rede,
  não duplica.
- **D-jpd-05 — a trilha nunca derruba a ação.** Falha ao gravar `os_eventos` vira
  `console.warn` e segue; a OS já avançou. Nada de `alert` por cima do toast de sucesso.
- **D-jpd-06 — o cache `ctEvt` é atualizado na hora**, não por recarga: `ctSetupRealtime()`
  não escuta `os_eventos` e `ctOpenOS()` é chamado logo depois da ação — sem isso a trilha
  apareceria uma ação atrasada.
- **Fora de escopo, por decisão:** fluxo interno com estados/fotos, RLS por cargo e edição
  de equipamento (passos 4–6 da análise). Exigem migração e decisão de produto.

## Restrições que valem para todo código novo

- `refrigeracao/index.html` é **congelada e standalone** (D-04): nenhuma referência a
  `shared/`, `pmoc.css`, à chave de tema da plataforma nem ao atributo de tema. Os quatro
  `grep -c` do PLAT-15 estão em 0 hoje e continuam em 0.
- Estilo do arquivo: `var`, `function`, ES5, sem arrow function, português, comentário de
  seção no formato `/* ── nome ── */`, erro no idioma
  `if(r.error){ showToast('Erro: '+r.error.message,'error'); return; }`.
- Zero build: nada de import, bundler ou dependência nova.

<!-- planner-discipline-allow: _logCache -->
<!-- planner-discipline-allow: de_status -->
<!-- planner-discipline-allow: para_status -->
<!-- planner-discipline-allow: ev.detalhes -->
<!-- planner-discipline-allow: ev.role -->

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: quatro bugs de leitura e contagem (1a–1d)</name>
  <files>refrigeracao/index.html, tests/refrigeracao-contagens.test.js</files>
  <behavior>
    - contarOSPendentes ignora um `status` de primeiro nível e lê o de dentro de `entry` (a forma exata do bug)
    - alertasPmoc conta um equipamento NOK-e-sem-histórico uma única vez no total, e nas duas parcelas
    - alertasPmoc devolve as três listas separadas, para as seções continuarem por motivo
    - ctEvtTexto lê a coluna `detalhe` do banco e ignora o nome no plural que nunca existiu
  </behavior>
  <action>
Quatro correções, todas em `refrigeracao/index.html`.

**(a) Bloco novo de núcleo puro.** Inserir imediatamente **antes** de `function dueBadgeHtml(d){`
um bloco começando com a linha exata `/* ── alertas: contagem única ── */` contendo quatro
funções (o teste recorta desse comentário até `function dueBadgeHtml(`):

- `equipSemHist(e)` — devolve true quando `!e.ultimaManutencao && !getLatestLogDate(e.id)`.
- `equipVencido(e, agora)` — `nextPmoc(e,'inspecao')` existe e é menor que `agora`
  (default `new Date()`).
- `alertasPmoc(lista, agora)` — percorre a lista **uma vez** e devolve
  `{nok:[], vencidos:[], semHist:[], todos:[], total:N}`, onde `todos` recebe o equipamento
  **uma única vez** se qualquer um dos três critérios bater (D-jpd-01), e `total` é
  `todos.length`. Nunca somar os tamanhos das parcelas.
- `contarOSPendentes(entradas)` — conta itens cujo `o.entry && o.entry.status==='PENDENTE'`.
  Deliberadamente ignora qualquer `status` no primeiro nível do objeto: `getAllOSEntries()`
  devolve `{equipId, equip, entry}` e ler o nível errado é exatamente o defeito 1a.

**(b) `renderDash`** passa a usar o bloco: `var ag = alertasPmoc(DATA, now);`,
`var nok = ag.nok.length;`, `var semHist = ag.semHist.length;`,
`var vencidas = ag.vencidos.length;`, `var alertCount = ag.total;`. O sub-rótulo do KPI
"Atenção PMOC" continua detalhando as parcelas (`N vencidas · N sem histórico`) — só o
número grande e o badge passam a ser o total sem repetição. A lista "Alertas top 5" passa
a partir de `ag.todos.slice().sort(...)` em vez de refazer o mesmo filtro. O badge de OS
passa a ser `var osPend = contarOSPendentes(osAll);` (defeito 1a).

**(c) `renderAlerts`** passa a ler o mesmo `alertasPmoc(DATA, now)`:
`nokList = ag.nok.slice().sort(...)`, `vencList = ag.vencidos.slice().sort(...)`,
`semHistCrit = ag.semHist.filter(função que testa autoCrit(e)==='CRÍTICA')`. O badge no fim
da função vira `ag.total` — o mesmo número do dashboard.
Seção "Sem Histórico" (D-jpd-02): renderizar quando `ag.semHist.length > 0`, com o contador
do cabeçalho igual a `ag.semHist.length`, os cartões só dos críticos, e — quando
`ag.semHist.length > semHistCrit.length` — uma linha final no estilo `.alert-sub`
dizendo `+N não críticos sem registro de manutenção`.
Depois de montar as seções e **antes** do `if(!html)` do estado vazio, prefixar `html`
(só quando `html` já tem conteúdo, senão o estado vazio morre) com uma linha
`font-size:11px;color:#888` informando o total sem repetição e que um equipamento aparece
em mais de uma seção quando tem mais de um motivo.

**(d) `acessoLivre()`** — trocar a linha que zera o cache de log por
`await loadLogsFromSupabase();`, mantida antes de `renderDash()`/`renderInv()`. A policy de
`logs_manutencao` é `for select using (true)`, então o SELECT funciona com a anon key; sem
essa chamada o observador vê os 171 equipamentos como "Sem hist.". Nenhuma outra atribuição
ao cache de log pode sobrar dentro dessa função.

**(e) Trilha lida pelo schema real.** No bloco de contratação, inserir entre
`function ctStatusPill(...)` e `function ctEquip(...)` a função
`function ctEvtTexto(ev){ ... }`, que devolve `String(ev.detalhe)` quando existe e `''` caso
contrário — a coluna real de `os_eventos` é `detalhe`, no singular. Usar `ctEvtTexto(ev)`
nos dois lugares que hoje leem campos inexistentes:
  - no drawer (`Histórico / Auditoria`): o texto do evento vira `ctEvtTexto(ev)` e o bloco do
    usuário deixa de concatenar o cargo — `os_eventos` não tem coluna de cargo; o cargo já
    vai dentro de `usuario` (Task 3);
  - na impressão `ctPrintOS`: a coluna `De → Para` do cabeçalho vira `Detalhe`, a célula vira
    `esc(ctEvtTexto(ev))` e a célula de usuário perde a concatenação de cargo.
Depois desta task, nenhuma das quatro leituras fantasma (as duas de status de origem/destino,
o plural de detalhe e o cargo do evento) pode existir no arquivo.
  </action>
  <verify>
    <automated>node --test tests/refrigeracao-contagens.test.js</automated>
  </verify>
  <done>
Gate `tests/refrigeracao-contagens.test.js` criado no padrão de
`tests/inventario-ordem-refrigeracao.test.js` (recorte do HTML + sandbox `node:vm`, sem
framework), com `nextPmoc`/`getLatestLogDate`/`autoCrit` substituídos por versões
controladas, provando por **comportamento**:
  1. `contarOSPendentes([{status:'PENDENTE',entry:{status:'CONCLUÍDA'}},{entry:{status:'PENDENTE'}}])`
     devolve **1** — a primeira entrada é a forma exata do defeito 1a e não pode contar;
  2. um equipamento NOK **e** sem histórico aparece em `nok`, em `semHist` e **uma só vez**
     em `todos`, com `total` menor que a soma das parcelas;
  3. `total` bate com o tamanho de `todos` e com a união calculada à mão numa fixture com
     sobreposição nos três critérios;
  4. `equipVencido` é falso para quem não tem data anterior (sem histórico não vence);
  5. `ctEvtTexto({detalhe:'x'})` devolve `'x'`, e um objeto que só traga o nome no plural
     devolve `''` — a coluna inexistente não pode voltar a ser lida.
Mais três asserções de presença/ausência, cada uma **recortada na região** onde vale (única
forma de conferir fiação):
  6. o corpo entre `function renderDash(){` e `var CRIT_ORDEM =` chama `alertasPmoc(` e
     `contarOSPendentes(`;
  7. o corpo entre `function renderAlerts(){` e a linha seguinte de seção chama `alertasPmoc(`
     e não recalcula o badge somando os tamanhos das listas;
  8. o corpo de `acessoLivre()` chama `await loadLogsFromSupabase()` e não contém nenhuma
     atribuição ao cache de log;
  9. varredura no arquivo inteiro: zero ocorrências dos quatro campos inexistentes de
     `os_eventos`.
`node --test` inteiro verde. Os quatro `grep -c` do PLAT-15 continuam em 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: encerrar OS grava ultima_manutencao, com histórico da contratação idempotente</name>
  <files>refrigeracao/index.html, tests/refrigeracao-encerramento-os.test.js</files>
  <behavior>
    - atualizarUltimaManutencao grava quando a data é mais recente que a registrada
    - atualizarUltimaManutencao não grava quando a data é igual ou anterior (não retrocede)
    - o objeto em memória é atualizado junto, para a tela refletir sem novo fetch
    - ctEncerrarHistorico insere uma linha de histórico na primeira certificação
    - a segunda certificação da mesma OS não insere nada (idempotência pelo prefixo da descrição)
  </behavior>
  <action>
**(a) Bloco de encerramento (fluxo interno).** Inserir imediatamente **antes** de
`async function saveLogEntry(` um bloco começando com a linha exata
`/* ── encerramento de OS: última manutenção ── */` (o teste recorta desse comentário até
`async function saveLogEntry(`) com:

`async function atualizarUltimaManutencao(equipId, data)`:
  - sai devolvendo `false` se `data` for vazia ou se o equipamento não estiver em `DATA`;
  - **não retrocede** (D-jpd-03): se `e.ultimaManutencao` existe e é `>= data` (comparação
    direta de string ISO `YYYY-MM-DD`), devolve `false` sem tocar no banco;
  - `supa.from('equipamentos').update({ultima_manutencao:data}).eq('id',equipId)`; em erro,
    `showToast` no idioma do arquivo e devolve `false`;
  - em sucesso atualiza `e.ultimaManutencao = data` (o objeto em `DATA`, para a tela refletir
    sem novo fetch) e devolve `true`.

Em `saveLogEntry`, guardar o retorno de `addLogEntryAsync` numa variável e, **só** quando ele
for verdadeiro **e** `status==='CONCLUÍDA'`, `await atualizarUltimaManutencao(equipId, date)`.
Não alterar o toast nem o fluxo existente: a única mudança de comportamento autorizada aqui
é a gravação da data.

**(b) Bloco de histórico da contratação.** Inserir no bloco de contratação, imediatamente
**antes** de `async function ctCertificar(`, um bloco começando com a linha exata
`/* ── histórico da contratação ── */` (recorte do teste: desse comentário até
`async function ctCertificar(`) com quatro funções:

- `ctMarcadorHistorico(o)` — devolve `'Contratação ' + (o.numero || o.id)` (D-jpd-04);
  `os_contratacao.numero` é `unique` no banco, e o uuid é o recurso quando não houver número.
- `ctDescricaoHistorico(o)` — `ctMarcadorHistorico(o)` + `' — '` + `(o.problema || 'Serviço
  executado por empresa contratada')` + `' · NF ' + o.nf` quando houver NF. O marcador fica
  **no começo**, porque a deduplicação é por prefixo.
- `ctJaTemHistorico(linhas, marcador)` — devolve true se alguma linha tiver descrição
  **começando** com o marcador; aceita as duas formas em que uma linha aparece no app
  (`descricao`, como vem do banco, e `desc`, como fica no cache depois de `dbToLog`).
- `async ctEncerrarHistorico(o)`:
  1. sai devolvendo `false` se a OS não tiver `equip_id` — nem toda OS aponta para equipamento;
  2. `data = o.data_nf || today()`;
  3. consulta `supa.from('logs_manutencao').select('id,descricao').eq('equip_id', o.equip_id)`
     — **o banco é o critério**, não o cache local, que pode estar velho; em erro,
     `console.warn` e devolve `false` (não derruba a certificação, que já aconteceu);
  4. se `ctJaTemHistorico(...)` bater, devolve `false` sem inserir (D-jpd-04);
  5. `addLogEntryAsync(o.equip_id, {date:data, tipo:'CORRETIVA', status:'CONCLUÍDA',
     tecnico:(o.empresa||''), desc:ctDescricaoHistorico(o), checklist:[]})`;
  6. só se a inserção devolver id, `await atualizarUltimaManutencao(o.equip_id, data)` —
     mesma regra de não retroceder.

Em `ctCertificar`, dentro do `if(await ctUpd(...))` que já existe: recuperar a linha fresca
com `ctOS.find(...)` (o `ctUpd` acabou de substituí-la pela versão do banco) e
`await ctEncerrarHistorico(o)` **antes** de `ctOpenOS(osId)`, para a ficha já abrir com o
registro. Não mudar as validações de NF e de composição que já existem.
  </action>
  <verify>
    <automated>node --test tests/refrigeracao-encerramento-os.test.js</automated>
  </verify>
  <done>
Gate `tests/refrigeracao-encerramento-os.test.js` criado no mesmo padrão (dois recortes do
HTML — o bloco de encerramento e o bloco de histórico — avaliados juntos num sandbox
`node:vm` com `supa`, `DATA`, `showToast`, `today`, `console` e uma tabela falsa de
`logs_manutencao` em memória), provando por **comportamento**:
  1. equipamento sem `ultimaManutencao` + data `2026-08-21` → o fake `supa` registra um
     update com `{ultima_manutencao:'2026-08-21'}` e o objeto em `DATA` passa a ter a data;
  2. equipamento com `2026-09-01` + data `2026-08-01` → **nenhum** update chegou ao fake e o
     retorno é `false` (não retrocede, D-jpd-03);
  3. data igual à registrada → nenhum update;
  4. `ctMarcadorHistorico` usa `numero` quando existe e cai no `id` quando não existe;
  5. `ctJaTemHistorico` reconhece o prefixo tanto numa linha vinda do banco quanto numa linha
     do cache, e não confunde uma OS com outra de número diferente;
  6. **idempotência de ponta a ponta:** rodar `ctEncerrarHistorico` duas vezes sobre a mesma
     OS contra a tabela falsa (onde o `addLogEntryAsync` falso acumula as linhas inseridas)
     deixa **uma** linha, com `tipo:'CORRETIVA'`, `status:'CONCLUÍDA'`, `tecnico` igual à
     empresa e descrição começando pelo marcador;
  7. OS sem `equip_id` não insere nada;
  8. erro na consulta de `logs_manutencao` devolve `false` sem lançar exceção.
Mais uma asserção recortada em `saveLogEntry` e outra em `ctCertificar`, provando que cada
uma chama a função nova (fiação não é testável por comportamento sem montar o DOM).
`node --test` inteiro verde; os quatro `grep -c` do PLAT-15 continuam em 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: gravar a trilha os_eventos em ctUpd</name>
  <files>refrigeracao/index.html, tests/refrigeracao-trilha-os.test.js, TESTES.md</files>
  <behavior>
    - uma mudança de status grava um evento cujo detalhe traz "rótulo anterior → rótulo novo"
    - o status anterior é lido do estado em memória ANTES do update, senão o detalhe sai repetido
    - falha ao gravar o evento não derruba a ação principal nem troca o toast de sucesso
    - o usuário do evento traz nome e cargo quando houver sessão, e fica nulo quando não houver
  </behavior>
  <action>
Tudo dentro do bloco de contratação, entre a linha `/* ══ AÇÕES ══ */` e
`async function ctMudarStatus(` (é exatamente essa a região que o teste recorta).

**(a) Três funções puras**, inseridas logo depois do marcador `/* ══ AÇÕES ══ */`:
- `ctNomeEvento(msg)` — devolve `msg` quando houver, senão `'Atualização'`. Os chamadores de
  `ctUpd` já passam o rótulo curto do que aconteceu (`Orçamento aprovado`,
  `Devolvida p/ ajuste`, `Execução aprovada pelo fiscal`, `OS certificada e encerrada`,
  `OS cancelada`, `Status: <rótulo>`), então o `evento` é esse texto.
- `ctDetalheEvento(statusAnterior, patch)` — quando `patch.status` existir e for diferente do
  anterior, devolve `<rótulo anterior> → <rótulo novo>` usando **os rótulos de `CT_STATUS`**
  (`'—'` quando o anterior for desconhecido ou ausente, e o próprio código quando não houver
  rótulo mapeado). Sem mudança de status, devolve `''`. É aqui que mora o "de → para" que a
  coluna `detalhe` guarda como texto: **nenhuma coluna nova é criada** (sem migração).
- `ctUsuarioEvento(u)` — `nome` + `' (cargo)'` quando a linha de `usuarios` tiver cargo;
  devolve `''` sem usuário.

**(b) `async ctRegistrarEvento(osId, statusAnterior, patch, msg)`** — monta
`{os_id, evento:ctNomeEvento(msg), detalhe:<texto ou null>, usuario:<texto ou null>}` e
insere em `os_eventos` (`criado_em` fica com o default do banco). Envolver em `try/catch` e,
em erro ou exceção, `console.warn` e devolver `false` — **nunca** `showToast`/`alert`
(D-jpd-05): a OS avançou, a trilha é registro. Em sucesso, empurrar a linha devolvida para
`ctEvt[osId]` (D-jpd-06), que é o que faz a trilha aparecer já na abertura seguinte do
drawer — `ctSetupRealtime()` não escuta essa tabela.

**(c) `ctUpd`** — capturar `var anterior = ctOS.find(...)` e guardar `anterior.status`
numa variável **antes** da chamada de `update`. A ordem é o ponto: `ctUpd` substitui
`ctOS[i]` pela linha nova logo depois, e ler o status depois disso produziria
`X → X`. Depois de atualizar `ctOS[i]` e antes do `showToast(msg,'ok')`, chamar
`await ctRegistrarEvento(osId, statusAnterior, patch, msg)`. O retorno de `ctUpd` continua
`true` mesmo se a trilha falhar. Os oito chamadores de `ctUpd` não mudam — a trilha entra
num lugar só, que é o ponto único de update de `os_contratacao`.

**(d) `TESTES.md`** — acrescentar uma seção curta "Refrigeração — encerramento de OS e
trilha" com o roteiro manual que nenhum gate alcança: avançar uma OS de contratação de
ponta a ponta com um usuário autenticado e conferir no drawer e na impressão que cada passo
deixou sua linha; certificar e conferir que o equipamento saiu de "Nenhum registro de
manutenção" na ficha e ganhou `ultima_manutencao`; repetir a certificação e conferir que
não nasceu uma segunda linha de histórico; entrar em "Visualizar sem login" e conferir que
o histórico aparece.
  </action>
  <verify>
    <automated>node --test tests/refrigeracao-trilha-os.test.js</automated>
  </verify>
  <done>
Gate `tests/refrigeracao-trilha-os.test.js` criado recortando **dois** trechos do HTML — a
tabela `CT_STATUS` (de `var CT_STATUS = {` até `var CT_STEPS =`, para o teste provar que os
rótulos usados são os reais) e a região `/* ══ AÇÕES ══ */` → `async function ctMudarStatus(`
— avaliados num sandbox `node:vm` com `supa` falso (registrando os payloads de `update` e de
`insert`), `showToast`, `ctOS`, `ctUser`, `ctEvt` e `console`, provando por **comportamento**:
  1. `ctUpd` sobre uma OS `SOLICITADA` com `{status:'ORCAMENTO'}` grava em `os_eventos` um
     `detalhe` contendo `Aguard. orçamento → Orçamento p/ aprovação` — se o status anterior
     for lido depois do update, o detalhe sai repetido e o teste falha (é este o caso que
     trava a ordem);
  2. o `evento` gravado é a mensagem passada pelo chamador;
  3. status anterior desconhecido produz `—` no lado esquerdo, sem lançar exceção;
  4. patch sem mudança de status grava evento com `detalhe` nulo/vazio, não um `X → X` falso;
  5. `ctUsuarioEvento` devolve `'Fulano (gestor)'` com cargo, o nome puro sem cargo, e `''`
     sem usuário;
  6. insert de `os_eventos` devolvendo erro: `ctUpd` ainda devolve `true` e o `showToast` de
     sucesso foi chamado uma vez (D-jpd-05);
  7. em sucesso, `ctEvt[osId]` passa a conter a linha nova (D-jpd-06).
`node --test` inteiro verde; os quatro `grep -c` do PLAT-15 continuam em 0; `TESTES.md` com a
seção nova.
  </done>
</task>

</tasks>

## Verificação do conjunto

```bash
node --test                              # suíte inteira verde (baseline 456 + os testes novos)
grep -c "shared/" refrigeracao/index.html      # 0
grep -c "pmoc.css" refrigeracao/index.html     # 0
grep -c "pmoc-tema" refrigeracao/index.html    # 0
grep -c "data-theme" refrigeracao/index.html   # 0
git diff --stat                          # só refrigeracao/index.html, tests/*, TESTES.md
```

Nenhum arquivo `supabase/*.sql` novo: se durante a execução a conclusão for que falta coluna,
o recorte está errado — parar e replanejar sem ela.

## Critérios de sucesso

- Badge de OS pendente deixa de ser 0 quando existe OS `PENDENTE`.
- KPI "Atenção PMOC" e badge de alerta mostram **o mesmo número** no dashboard e na tela de
  alertas, e esse número nunca passa de 171.
- O observador enxerga o histórico dos 4 equipamentos que têm log, em vez de 171 "Sem hist.".
- A trilha de auditoria mostra as 2 linhas que já existem em `os_eventos` (seed SIAFI) com
  seu `detalhe`, no drawer e na impressão.
- Encerrar uma OS interna concluída ou certificar uma OS de contratação passa a gravar
  `equipamentos.ultima_manutencao` — o primeiro valor não nulo dos 171.
- Certificar duas vezes deixa uma linha só em `logs_manutencao`.
- Cada ação sobre uma OS de contratação deixa uma linha em `os_eventos`.

## Saída

Ao concluir, escrever `.planning/quick/260821-jpd-corrigir-defeitos-verificados-do-modulo-/SUMMARY.md`.
