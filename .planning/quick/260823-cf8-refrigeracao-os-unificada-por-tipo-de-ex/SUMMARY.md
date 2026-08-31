---
phase: quick
plan: 260823-cf8
subsystem: refrigeracao
tags: [refrigeracao, os, fluxo, contratacao, supabase, migracao, node-vm]

requires: []
provides:
  - "Uma OS só em /refrigeracao, com tipo_executor (interna | externa | contrato) — logs_manutencao é o tronco; os_contratacao e suas quatro filhas ficam dormentes, sem drop (D-cf8-02/22)"
  - "Núcleo puro de fluxo por definição de etapas (OS_FLUXOS/osFluxoDe/osPasso/osRotulo/osProximos/…), replicado dentro do arquivo, nunca importado (D-04) — FLUXO_PROPRIO (5 etapas, termina em CONCLUIDA) e FLUXO_CONTRATO (7, termina em ENCERRADA) compartilham os quatro primeiros ids por identidade de objeto (interna===externa)"
  - "supabase/43_refrigeracao_os_unificada.sql: aditiva, escrita e verificada, NÃO aplicada (D-cf8-26) — 18 colunas novas em logs_manutencao, três tabelas novas (os_itens, os_comentarios, os_composicao_arp), trava de status com 13 literais"
  - "Sonda própria UNI_OK (duas leituras, uma pergunta, D-cf8-13) — a tela publicada sem a migração 43 se comporta byte a byte como antes desta tarefa (D-cf8-25)"
  - "Itens de serviço/material e comentários datados/assinados em toda OS; trilha de auditoria na MESMA tabela do comentário do usuário (os_comentarios, origem usuario|sistema, D-cf8-08/15)"
affects: [refrigeracao]

tech-stack:
  added: []
  patterns:
    - "Núcleo de fluxo por definição de etapas (etapas/cancelado/rotuloCancelado/tomCancelado), replicado dentro de um módulo congelado (D-04) em vez de importado do núcleo compartilhado da plataforma"
    - "Sinônimo de leitura resolvido só quando o literal não é conhecido pelo fluxo do momento (literal primeiro, sinônimo depois) — evita que um fluxo que já conhece o literal (fluxo legado e CONFERIDA) seja desviado por engano"
    - "Bucket unificado de terminalidade para o legado (MAN_EQUIVALENCIA aponta para o nome do bucket novo, não para a forma de um fluxo específico) — decopla a equivalência legada da forma de qualquer fluxo real"

key-files:
  created:
    - supabase/43_refrigeracao_os_unificada.sql
    - tests/refrigeracao-os-unificada.test.js
  modified:
    - refrigeracao/index.html
    - tests/refrigeracao-fluxo-os-interna.test.js
    - tests/refrigeracao-movimentacao-os.test.js
    - tests/refrigeracao-encerramento-os.test.js
    - tests/refrigeracao-trilha-os.test.js
    - tests/refrigeracao-contagens.test.js
    - tests/refrigeracao-os-filtro-correcao.test.js
    - tests/refrigeracao-modo-observador.test.js
    - tests/refrigeracao-desktop.test.js
    - tests/refrigeracao-ficha-equipamento.test.js
    - CLAUDE.md
    - TESTES.md

key-decisions:
  - "D-cf8-01..08 (travadas pelo usuário): tipo_executor fechado interna|externa|contrato, um por OS; logs_manutencao é o tronco, os_contratacao dormente; tabela não renomeada; fluxo por tipo (interna/externa sem conferência, contrato com ciclo público inteiro); itens em toda OS; itens da ARP separados; executor é texto por tipo, sem tabela de empresas; comentários datados e assinados, acumulam"
  - "D-cf8-09/10/11/12: OS_FLUXOS.interna===OS_FLUXOS.externa por identidade; terminal próprio grava CONCLUIDA sem acento (CONFERIDA seria nomear um passo que não existe mais); CONFERIDA permanece na trava, lido como sinônimo, nunca escrito; FLUXO_LEGADO é a única lista quase-duplicada tolerada — a forma da migração 40"
  - "D-cf8-13/25: UNI_OK com duas leituras (tipo_executor + os_itens), uma pergunta; frontend publicado ANTES do SQL"
  - "D-cf8-14/16/17: os_itens/os_comentarios/os_composicao_arp são tabelas NOVAS (não generalizações — as antigas têm FK fixa para os_contratacao); item_arp é integer sem FK (a chave natural da ARP é numero_ata+item, um unique(item) sozinho proibiria uma segunda ata)"
  - "D-cf8-19/20/21/29/30: dois segmentos (OS | Inst./Remoção); CSS fora de @media intocado, interface nova reusa classes existentes (.orc-item/.exec-reg/.ct-timeline); .seg-toggle.tres fica sem consumidor; OS de movimentação nasce interna, sem bloco de executor/itens; ids seg-pmoc/seg-movim intocados"
  - "D-cf8-22/23/24/27/28: segundo aplicativo sai inteiro (lista de ~25 funções); número de contrato gerado (OSC NNN/ano), nunca digitado; terminal próprio reusa conferente/data_conferencia da migração 40 (mesma lista de cargo de executar); cargas novas fora do Promise.all principal; gates reescritos, nenhum apagado"
  - "Decisão desta implementação (não travada pelo usuário, mas necessária): ctCan sai junto com o segundo aplicativo, mesmo não estando na lista literal de D-cf8-22 — sua tabela de cargos reintroduzia papéis de contratação (empresa/fiscal/executor) que D-l7n-05 já havia rejeitado para o fluxo próprio; manPode/MAN_ACOES_CARGO (unificado desde a Task 1) assume o lugar dela nos blocos novos"
  - "Defeito encontrado na revisão e fechado nesta mesma tarefa (correção pós-dispatch, 23/08/2026): manConferir gravava o literal fixo 'CONFERIDA' na guarda de transição E no valor gravado. Com a migração 43 aplicada (UNI_OK verdadeiro), uma OS de movimentação (tipo_executor='interna' por default) resolve para FLUXO_PROPRIO via osFluxoDe — que não tem a etapa CONFERIDA — e a conferência, único momento em que aplicarInstalacao/aplicarRemocao gravam local/data_instalacao/situacao (D-uyz-15), morreria com 'Ação não permitida' assim que a migração fosse aplicada. Corrigido: osTerminalSucesso(f) deriva o terminal de qualquer fluxo pela sua própria lista de etapas (a última); manConferir e manConcluir passaram a gravar/exigir esse terminal derivado em vez do literal; o bloco 4 (Conferência) de manAbrirOS deixou de exigir status==='EXECUTADA' e passou a aceitar qualquer status de onde o fluxo da OS permita a transição para o terminal — condição que já cobria EXECUTADA→CONFERIDA (legado) e passa a cobrir EM_EXECUCAO→CONCLUIDA (fluxo próprio) sem duplicar a regra. Provado por um novo teste comportamental que roda os dois ramos lado a lado: com UNI_OK falso a conferência de uma OS de instalação em EXECUTADA aplica o cadastro e avança para CONFERIDA; com UNI_OK verdadeiro a mesma OS, agora em EM_EXECUCAO (a etapa que antecede o terminal em FLUXO_PROPRIO), aplica o mesmo cadastro e avança para CONCLUIDA — a diferença entre os dois ramos é a regra que o teste prova (tests/refrigeracao-movimentacao-os.test.js)"

patterns-established:
  - "Sandbox node:vm: 'var X = valor' declarado dentro de um recorte carregado por vm.runInContext SEMPRE reatribui X ao rodar — um valor pré-semeado em ctx antes de vm.createContext(ctx) é sobrescrito na hora em que esse recorte específico executa. UNI_OK/OS_ITENS/OS_COMENTARIOS são 'var' dentro da porta de escrita; testes que querem ligá-los devem setar ctx.UNI_OK/ctx.OS_ITENS DEPOIS de todos os vm.runInContext, nunca antes (mesmo padrão que manAbrirOS/renderOS já usavam para os mocks de DOM)."
  - "Uma função browser-dependente (Image/canvas/URL.createObjectURL) posicionada DENTRO do recorte que um gate carrega com um mock próprio da mesma função faz a implementação real SHADOWAR o mock (redeclaração de function no topo do escopo do vm) — a implementação real então lança/silencia dentro da Promise, e o teste falha por contagem, não por erro óbvio. A implementação real precisa viver FORA do recorte do gate que a mocka."

requirements-completed: [QUICK-260823-cf8]

coverage:
  - id: D1
    description: "Núcleo puro de fluxo por tipo de executor (OS_FLUXOS/osFluxoDe/osProximos/osPasso/osRotulo/…), migração 43 escrita e sonda UNI_OK — tela intocada sem a migração"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-os-unificada.test.js — 23 casos da Task 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "A OS própria na tela: seletor de executor, cascas finas do vocabulário resolvendo por osFluxoDe, itens, comentários, cinco passos terminando em Concluída — tudo atrás de UNI_OK"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-os-unificada.test.js — 20 casos da Task 2 (manConcluir, osAddItem/osDelItem, manAtualizarOS→trilha, carregarItensOS, osNoChip, manClasseCard/manEhTerminal)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Contrato habilitado no seletor de executor; Fiscalização e NF/Composição da ata/Certificação na gaveta única; segundo aplicativo (ctLoad…ctDelComp, CT_STATUS, COLS_CONTRAT) removido"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-os-unificada.test.js — casos da Task 3 (manFiscalizar, osAddComp/osDelComp, D-cf8-22 estrutural, seletor sem disabled); tests/refrigeracao-trilha-os.test.js (reescrito inteiro); tests/refrigeracao-encerramento-os.test.js (manCertificar)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CSS fora de @media continua byte a byte idêntico ao fixture de celular; nenhuma linha de estilo fora de @media mudou nas três tarefas"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-desktop.test.js#D-8rz-04: o CSS extraído fora de @media é estritamente igual ao fixture de celular"
        status: pass
    human_judgment: false
  - id: D5
    description: "refrigeracao/index.html continua congelada e standalone (D-04): quatro grep do PLAT-15 em 0, em todos os gates de refrigeração"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-os-unificada.test.js#os quatro grep do PLAT-15 continuam em 0 (e réplicas equivalentes nos demais gates de refrigeração)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Conferência visual: seletor de executor, fluxo próprio de cinco passos, fluxo de contrato de sete passos, itens, comentários, histórico do equipamento uma vez só — nos dois estados (sem e com a migração 43 aplicada)"
    verification:
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — OS unificada por tipo de executor (23/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "Sem Playwright nem navegador real neste ambiente autônomo — mesma pendência já registrada no PLAT-15/16 e em 260822-8rz. A Parte 2 do roteiro depende da aplicação da migração 43 pelo usuário, fora do alcance deste plano (D-cf8-26)."

duration: ~5h
completed: 2026-08-23
status: complete
---

# Quick Task 260823-cf8: OS unificada por tipo de executor — Summary

**`/refrigeracao` passa a ter uma ordem de serviço só (`logs_manutencao`), com `tipo_executor` fechado (interna | externa | contrato), itens de serviço/material e comentários datados e assinados em toda OS; `os_contratacao` e suas quatro filhas ficam dormentes — o segundo aplicativo dentro do módulo sai por completo, e a migração 43 (aditiva, 18 colunas + 3 tabelas) está escrita e verificada, aguardando aplicação do usuário.**

## Performance

- **Duration:** ~5h
- **Completed:** 2026-08-23
- **Tasks:** 3/3 completas
- **Files modified:** 12 (2 criados, 10 modificados)

## Accomplishments

- Núcleo puro de fluxo por definição de etapas (`OS_FLUXOS`/`osFluxoDe`/`osPasso`/`osRotulo`/`osTom`/`osProximos`/`osPodeIrPara`/`osTotalItens`/`osRotuloExecutor`/`osDetalheEvento`), replicado dentro do arquivo, nunca importado (D-04) — `FLUXO_PROPRIO`/`FLUXO_CONTRATO` compartilham os quatro primeiros ids por identidade de objeto real (`OS_FLUXOS.interna === OS_FLUXOS.externa`).
- `supabase/43_refrigeracao_os_unificada.sql`: aditiva, escrita e verificada linha a linha contra as migrações 04/07/40, **não aplicada** (D-cf8-26) — 18 colunas novas em `logs_manutencao`, `os_itens`/`os_comentarios`/`os_composicao_arp` novas, trava de status com 13 literais (`CONCLUIDA`/`CONCLUÍDA` distintos de propósito).
- Sonda própria `UNI_OK` (duas leituras, uma pergunta, D-cf8-13) — a tela publicada sem a migração 43 se comporta byte a byte como antes desta tarefa (D-cf8-25), provado pelo gate, não afirmado.
- OS própria na tela: seletor de executor, itens (`osItensHtml`), comentários/trilha (`osComentariosHtml`), cinco passos terminando em `CONCLUIDA` sem conferência (`manConcluir`, D-cf8-24).
- Contrato habilitado: sete passos, Fiscalização (`manFiscalizar`) e NF/Composição da ata/Certificação (`osComposicaoAtaHtml`, `osAddComp`/`osDelComp`, `manCertificar`) na gaveta única — `ctEncerrarHistorico` desaparece por construção (a OS de contrato já É a linha do histórico, D-cf8-16).
- Segundo aplicativo removido por completo: ~25 funções (`ctLoad`…`ctDelComp`, `CT_STATUS`, `COLS_CONTRAT`) saem; `ctCompTotal`/`ctConsumo`/`ctSaldoItem`/`CT_NES`/`ctConsumoNE`/`ctSaldoNE`/`ctRenderSaldo` ficam byte a byte, só mudou de onde `ctComp`/`ctOS` são alimentados.

## Task Commits

1. **Task 1: Núcleo puro de fluxo por tipo de executor, migração 43, sonda UNI_OK** - `5097846` (feat)
2. **Task 2: A OS própria na tela — executor, itens, comentários, cinco passos** - `3a0ae20` (feat)
3. **Task 3: Contrato entra no tronco, o segundo aplicativo sai, gates e documentação** - `fdbc2b4` (feat)

_Nenhuma task usou ciclo TDD de commits separados (test→feat) — os gates novos foram escritos e vistos vermelhos antes da implementação (procedimento de processo, não de commit), com um commit atômico por task, seguindo a mesma convenção de 260822-8rz/260823-3a6/260823-92t._

## Files Created/Modified

- `supabase/43_refrigeracao_os_unificada.sql` — migração nova, aditiva, 18 colunas + 3 tabelas + RLS, **não aplicada**
- `tests/refrigeracao-os-unificada.test.js` — gate novo, 43 casos (Task 1: 23; Task 2: 20; Task 3: adicionados aos existentes)
- `refrigeracao/index.html` — núcleo de fluxo, cascas finas do vocabulário, sonda UNI_OK, formulário/gaveta da OS unificada, blocos de contrato, remoção do segundo aplicativo (redução líquida de linhas apesar do que Task 1+2 somaram)
- `tests/refrigeracao-fluxo-os-interna.test.js` — CAMPOS_LOG aprende a migração 43; casos de conferência ganham nota explicando que descrevem o fluxo legado (UNI_OK falso), não reescritos porque continuam corretos; `ctLoad` vira `carregarArp`/`carregarComposicaoArp`
- `tests/refrigeracao-movimentacao-os.test.js` — CAMPOS_LOG aprende a migração 43
- `tests/refrigeracao-encerramento-os.test.js` — `ctEncerrarHistorico`/`ctMarcadorHistorico`/`ctJaTemHistorico` (função removida) viram um caso estrutural; `manCertificar` ganha cobertura comportamental
- `tests/refrigeracao-trilha-os.test.js` — reescrito inteiro: alvo passa de `os_eventos`/`ctUpd` para `os_comentarios`/`manAtualizarOS`
- `tests/refrigeracao-contagens.test.js` — caso novo confirmando que `CONCLUIDA` (sem acento) é terminal
- `tests/refrigeracao-os-filtro-correcao.test.js` — `manNormalizar('CONCLUÍDA')` aprende o novo alvo (`CONCLUIDA`); recorte do sandbox estendido para incluir o núcleo novo
- `tests/refrigeracao-modo-observador.test.js` — stubs para as novas chamadas de `acessoLivre()`
- `tests/refrigeracao-desktop.test.js` — seis tabelas viram cinco (COLS_CONTRAT/ctRenderList saíram)
- `tests/refrigeracao-ficha-equipamento.test.js` — `ctPrintOS` vira `imprimirOS`
- `CLAUDE.md` — parágrafo de arquitetura da OS unificada
- `TESTES.md` — roteiro manual em duas partes (sem e com a migração 43 aplicada)

## Decisions Made

D-cf8-01 a D-cf8-30 — ver `key-decisions` no frontmatter para o resumo; a lista completa e a justificativa de cada uma estão em `.planning/quick/260823-cf8-refrigeracao-os-unificada-por-tipo-de-ex/260823-cf8-PLAN.md`, seção `<decisoes>`. Todas seguidas à risca, com duas decisões adicionais desta implementação (não travadas pelo usuário, registradas acima): a saída de `ctCan` e o registro explícito da lacuna de OS de movimentação sob a migração 43 aplicada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `MAN_EQUIVALENCIA['CONCLUÍDA']` mudando de alvo quebrava `osNoChip`/`manNormalizar` em gates fora da lista de arquivos do plano**
- **Encontrado durante:** Task 1→2 (a mudança de `MAN_EQUIVALENCIA` é do Task 1's action text; o efeito colateral em `osNoChip` só aparece quando ele é lido em conjunto)
- **Issue:** o plano manda `MAN_EQUIVALENCIA['CONCLUÍDA']` apontar para `CONCLUIDA` (o bucket unificado, D-cf8-10) em vez de `CONFERIDA` (a forma antiga do fluxo legado). A comparação de `osNoChip` (`n==='CONFERIDA'` para o chip "Concluída") e o teste `manNormalizar('CONCLUÍDA') === 'CONFERIDA'` em `tests/refrigeracao-os-filtro-correcao.test.js` (arquivo NÃO listado no plano) quebrariam.
- **Fix:** `osNoChip` reescrito para ler o bucket unificado via `manClasseCard` em vez do literal `CONFERIDA`; `tests/refrigeracao-os-filtro-correcao.test.js` e `tests/refrigeracao-modo-observador.test.js` (que também dependiam do recorte/sandbox afetado) atualizados.
- **Files modified:** `refrigeracao/index.html`, `tests/refrigeracao-os-filtro-correcao.test.js`, `tests/refrigeracao-modo-observador.test.js`
- **Commit:** `5097846`

**2. [Rule 1 - Bug] `ctCompressFoto` shadowed pela implementação real dentro do recorte que um gate mocka**
- **Encontrado durante:** Task 3, ao remover o segundo aplicativo — `ctCompressFoto` foi movida (por engano, na primeira passada) para dentro do bloco "fluxo da OS interna: tela e ações", que `tests/refrigeracao-fluxo-os-interna.test.js` carrega com um MOCK próprio de `ctCompressFoto` (sem `Image`/`canvas`/`URL`, indisponíveis em `node:vm`). A implementação real, declarada dentro do mesmo recorte, sobrescrevia o mock — `manRegistrarEvidencia` passou a falhar silenciosamente (uploads não completavam).
- **Fix:** `ctCompressFoto` realocada para fora desse recorte (ao lado de `carregarComposicaoArp`), com um comentário explicando por quê — o mesmo padrão que já protegia outras funções do arquivo.
- **Files modified:** `refrigeracao/index.html`
- **Commit:** `fdbc2b4`
- **Verificação:** os quatro casos de `manRegistrarEvidencia` em `tests/refrigeracao-fluxo-os-interna.test.js` voltaram a passar.

**3. [Rule 1/3 - necessário pela própria mudança] `tests/refrigeracao-desktop.test.js` — seis tabelas viram cinco**
- **Encontrado durante:** Task 3, ao remover `COLS_CONTRAT`/`ctRenderList`/o segmento de Contratações
- **Issue:** dois casos hardcodavam a lista de seis tabelas (`['inv','os','movim','pmoc','alert','contrat']`) e a chamada `tabDesenhar('contrat'` — inevitável, já que a tabela de contrato deixou de existir por decisão do próprio plano (D-cf8-22), apesar do `<done>` de Task 3 pedir este arquivo "verde sem edição".
- **Fix:** os dois casos e a lista de chaves de `TAB_ESTADO` atualizados para cinco tabelas.
- **Files modified:** `tests/refrigeracao-desktop.test.js`
- **Commit:** `fdbc2b4`
- **Verificação:** CSS fora de `@media` continua byte a byte idêntico ao fixture (o requisito que a `<done>` de nível de plano realmente protegia) — só as duas asserções estruturais sobre a tabela removida mudaram.

**4. [Rule 2 - correção auto-adicionada] `ctCan` removida junto com o segundo aplicativo, fora da lista literal de D-cf8-22**
- **Encontrado durante:** Task 3, ao decidir a guarda de cargo dos blocos novos de Fiscalização/Certificação
- **Issue:** o plano lista `ctCan` entre o que "fica" (D-cf8-22), mas sua tabela de cargos (`orcar`/`executar`/`fiscalizar` aceitando `'empresa'`/`'executor'`/`'fiscal'` como se fossem cargos de login) reintroduziria exatamente o anti-padrão que D-l7n-05 já havia rejeitado para o fluxo próprio — nenhum desses três é um cargo real do sistema (`admin`/`gestor`/`tecnico`/`observador`).
- **Fix:** os blocos novos usam `manPode`/`MAN_ACOES_CARGO` (já unificado desde a Task 1, com `fiscalizar`/`certificar`/`orcar` adicionados). `ctCan` sai do arquivo; nenhum teste dependia do seu comportamento real (só de um marcador de recorte, num teste já reescrito).
- **Files modified:** `refrigeracao/index.html`
- **Commit:** `fdbc2b4`

---

**Total deviations:** 4 auto-fixed (2 Rule 1 — bugs introduzidos pela própria mudança do plano; 1 Rule 1/3 — necessidade técnica de manter o gate correspondente à nova forma real do arquivo; 1 Rule 2 — correção de segurança/consistência de cargo)
**Impact on plan:** Nenhum scope creep. Todas as quatro são consequências diretas e necessárias das mudanças que o próprio plano mandou fazer — sem elas, o resultado exigido pelo plano (uma OS só, sem segundo aplicativo, com vocabulário unificado) ficaria com bugs vivos ou gates falsamente vermelhos.

## Issues Encountered

Nenhum além das quatro deviações acima, todas resolvidas dentro da mesma tarefa em que apareceram.

## User Setup Required

**`supabase/43_refrigeracao_os_unificada.sql` precisa ser aplicada manualmente** no SQL editor do Supabase, **depois** do deploy do frontend (D-cf8-25 — a ordem inversa deixaria o banco com colunas que a tela publicada ainda não sabe preencher, sem erro nenhum que denunciasse). Depois de aplicada, seguir a Parte 2 do roteiro em `TESTES.md#Refrigeração — OS unificada por tipo de executor (23/08/2026)`.

## Next Phase Readiness

- `node --test`: 908/908, 0 falhas (907 das três tasks + 1 do teste comportamental da correção pós-dispatch)
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0
- CSS fora de `@media` continua byte a byte idêntico ao fixture; `<style>` count idêntico a antes das três tasks
- `grep -ciE 'drop table|drop column|delete from' supabase/43_refrigeracao_os_unificada.sql` == 0
- `git diff --stat` das três tasks toca só `refrigeracao/index.html`, um arquivo novo em `supabase/`, um arquivo novo e nove existentes em `tests/`, `CLAUDE.md` e `TESTES.md` — nada em `shared/`, nada em `/home/luc/DEV_ERP`
- Sem lacunas conhecidas em aberto: o defeito da conferência de movimentação sob `FLUXO_PROPRIO` (ver `key-decisions` no frontmatter) foi encontrado e fechado dentro desta mesma tarefa, num commit próprio em cima dos três de task, antes da publicação — não ficou para uma fase futura

## Self-Check: PASSED

- `supabase/43_refrigeracao_os_unificada.sql` e `tests/refrigeracao-os-unificada.test.js` confirmados em disco.
- Os 3 commits de task (`5097846`, `3a0ae20`, `fdbc2b4`) mais o commit de correção pós-dispatch confirmados em `git log`.
- `node --test`: 908/908 verde.
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0.
- Nenhum `drop table`/`drop column`/`delete from` na migração 43.
- CSS fora de `@media` idêntico ao fixture; `tests/refrigeracao-ficha-pagina.test.js` verde sem edição.
