---
phase: quick
plan: 260821-l7n
subsystem: ui
tags: [refrigeracao, os-interna, fluxo-aprovacao, evidencia, rls-pendente, supabase]

requires: []
provides:
  - "logs_manutencao ganha 7 estados novos (ABERTA→DELINEAMENTO→APROVACAO→EM_EXECUCAO→EXECUTADA→CONFERIDA, mais CANCELADA) sob a primeira check constraint de status que a tabela já teve, convivendo com os 3 valores do legado (PENDENTE/PARCIAL/CONCLUÍDA, nunca reescritos)"
  - "CAMPOS_LOG: ponte única camelCase↔coluna para logs_manutencao, lida por dbToLog/logParaDb, conferida coluna a coluna contra a migração 40"
  - "MAN_FLUXO_OK (manSondarEsquema): num banco sem a migração 40 a tela de /refrigeracao continua exatamente a de hoje, sem erro"
  - "OS interna nasce ABERTA (status deixa de ser campo do formulário), passa por delineamento e aprovação do gestor antes da execução, e conferência do gestor depois — com guarda dupla (manPode + manPodeIrPara) em cada botão"
  - "Execução grava fotos comprimidas (bucket os-fotos, prefixo manutencao/<log_id>/) e as cinco medições (temp_insuflamento/temp_retorno/delta_t/corrente_medida/pressao_succao) que existiam desde a migração 04 e nunca eram escritas; ΔT é sempre derivado (manDeltaT), nunca digitado"
  - "manTemEvidencia bloqueia a saída de EM_EXECUCAO sem foto/medição, mesmo chamando a ação direto (botão escondido não é validação)"
  - "Conferência aprovada grava equipamentos.ultima_manutencao com a data da OS (não a do clique), reaproveitando a proteção de não-retrocesso de atualizarUltimaManutencao"
  - "manNormalizar/manSemFluxo: equivalência agrupa as 10 linhas legadas nos filtros/badge/borda, mas nunca renomeia a pílula delas — nenhuma linha sem fluxo mostra régua ou botão de ação"
affects: [refrigeracao]

tech-stack:
  added: []
  patterns:
    - "reguaPassos(passoAtual, passos): a régua de 7 passos da contratação (ctTimeline) sobe a função compartilhada assim que aparece o segundo consumidor (D-l7n-10) — mesma regra do projeto que já promoveu shared/tabela.js"
    - "Sonda de esquema (manSondarEsquema) + flag MAN_FLUXO_OK: mesmo idioma de carregarCatalogoReparos()/carregarItensOS()/carregarCompras() em Máquinas — frontend publicado antes do SQL não quebra"
    - "Ponte de campos única (CAMPOS_LOG) testada coluna a coluna contra a migração — mesma lição paga em /calibracao (campo fora do mapa grava null sem erro)"

key-files:
  created:
    - supabase/40_refrigeracao_os_fluxo.sql
    - tests/refrigeracao-fluxo-os-interna.test.js
  modified:
    - refrigeracao/index.html
    - tests/refrigeracao-contagens.test.js
    - tests/refrigeracao-encerramento-os.test.js
    - TESTES.md

key-decisions:
  - "D-l7n-01: o terminal de sucesso chama-se CONFERIDA, nunca CONCLUIDA sem acento — uma distinção semântica é uma palavra diferente, não um caractere que normalizarBusca() (NFD) apagaria em silêncio"
  - "D-l7n-02: a equivalência (PENDENTE→ABERTA, PARCIAL→EM_EXECUCAO, CONCLUÍDA→CONFERIDA) agrupa para filtro/badge/borda, mas o rótulo de uma linha legada continua sendo a palavra da própria linha — nunca reescrita, nunca com régua"
  - "D-l7n-03: a trava de cargo do gestor é UX apenas — a policy de logs_manutencao segue for update to authenticated using(true), sem distinção de cargo. Pendência de RLS registrada abaixo, sem eufemismo"
  - "D-l7n-04: transição por adjacência (seguinte/anterior) mais cancelamento de qualquer etapa aberta, replicada de shared/fluxo.js (não importada — D-04 proíbe referenciar shared/ em refrigeracao/)"
  - "D-l7n-05: abrir/delinear/executar = admin+gestor+tecnico; aprovar/conferir/cancelar = admin+gestor. Nenhum papel do ciclo de contratação (empresa/fiscal) aparece na lista do fluxo interno"
  - "D-l7n-06: sem a migração 40, manSondarEsquema deixa MAN_FLUXO_OK=false e a tela é byte a byte a de hoje — testado nos dois lados (dbToLog de linha sem colunas novas não lança; openLogForm/saveLogEntry ramificam por MAN_FLUXO_OK)"
  - "D-l7n-07: CAMPOS_LOG é a única ponte de campos, conferida por teste contra os nomes de coluna extraídos de 40_refrigeracao_os_fluxo.sql + 04_refrigeracao_schema.sql (nas duas direções: toda coluna nova está no mapa, todo valor do mapa é coluna real)"
  - "D-l7n-08: a trilha da OS interna são as próprias colunas de assinatura (delineado_por/em, aprovador/data_aprovacao/parecer_aprovacao, conferente/data_conferencia/parecer_conferencia) — os_eventos.os_id referencia só os_contratacao, criar uma segunda tabela de eventos ficou fora de escopo"
  - "D-l7n-09: EM_EXECUCAO não sai para EXECUTADA sem manTemEvidencia (foto OU medição) — o guarda está em manMudarStatus, não só na renderização do botão"
  - "D-l7n-10: reguaPassos(passoAtual, passos) ganha dois consumidores; ctTimeline vira casca sobre ela; CT_STATUS não foi tocada (tests/refrigeracao-trilha-os.test.js segue verde sem alteração)"
  - "D-l7n-11: equipamentos.ultima_manutencao é gravada por manConferir (aprovado) com a data da OS, nunca a de hoje, reusando o guard de não-retrocesso de atualizarUltimaManutencao (D-jpd-03) — com o fluxo desligado o comportamento de hoje (gravar ao salvar com status legado CONCLUÍDA) permanece intacto"

patterns-established:
  - "Guarda dupla manPode(acao) + manPodeIrPara(atual,destino) em toda ação de mudança de estado — nunca uma condição só, porque os botões são reconstruídos a cada render e um clique atrasado chegaria fora de tempo"

requirements-completed: []

coverage:
  - id: D1
    description: "Migração 40 escrita (aditiva, sem drop), com a ponte CAMPOS_LOG conferida coluna a coluna e a porta de escrita (manSondarEsquema/manAtualizarOS) que desliga o fluxo sem erro num banco sem a migração"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#toda coluna criada pela migração 40 aparece como valor em CAMPOS_LOG (D-l7n-07)"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#todo valor de CAMPOS_LOG é uma coluna real (união das colunas da migração 04 com as da 40)"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#manSondarEsquema devolve false e MAN_FLUXO_OK false quando o select erra, sem lançar"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#dbToLog de uma linha sem as colunas novas (banco pré-migração) não lança e devolve fotos como lista vazia"
        status: pass
    human_judgment: false
  - id: D2
    description: "Máquina de estados na tela: OS nasce ABERTA, régua de 6 passos com dois consumidores, equivalência do legado agrupa sem renomear, cargos do gestor restritos a aprovar/conferir/cancelar"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#manProximos(APROVACAO) contém o seguinte, o anterior e o cancelamento — nada mais; terminais são vazios (D-l7n-04)"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#a equivalência agrupa sem renomear (D-l7n-01/02)"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#manPodeCargo: aprovar/conferir só para admin/gestor; executar também para tecnico; nenhum papel de contratação aparece (D-l7n-05)"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#o corpo de saveLogEntry grava o status inicial fixo e não lê o campo de status no ramo do fluxo ligado"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-contagens.test.js#contarOSPendentes (260821-l7n): PARCIAL do legado e EM_EXECUCAO do fluxo novo contam; CANCELADA, CONFERIDA e CONCLUÍDA (legado) não contam"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-encerramento-os.test.js#saveLogEntry com o fluxo ligado: OS nasce ABERTA, status nunca lido do formulário, e NÃO grava última manutenção (D-l7n-11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Evidência da execução (fotos comprimidas + as 5 medições, ΔT derivado) exigida antes de sair de EM_EXECUCAO; conferência do gestor grava a data da OS em ultima_manutencao"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#manMudarStatus de EM_EXECUCAO para EXECUTADA sem evidência é recusado e não chama a porta de escrita (D-l7n-09)"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#conferência aprovada grava o estado terminal, o conferente do perfil e a data de conferência, e chama a gravação de última manutenção com a data da OS"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#conferência com parecer vazio na devolução não grava nada; com parecer, volta um estado e mantém a lista de fotos intacta"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#um técnico chamando a conferência direto (sem passar pelo botão) é recusado — a guarda de cargo está na ação"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-fluxo-os-interna.test.js#registrar evidência numa OS que já tem duas fotos deixa a lista com as duas antigas mais as novas, na ordem, e nunca sobrescreve"
        status: pass
    human_judgment: false
  - id: D4
    description: "Roteiro manual completo contra produção depois de aplicar a migração 40: fluxo ponta a ponta por cargo (técnico abre/delineia/executa; gestor aprova/confere), os dois caminhos negativos, e as 10 linhas legadas continuando sem régua/botão"
    verification: []
    human_judgment: true
    rationale: "Migração 40 ainda não aplicada em produção (escrita apenas, por decisão do plano — quem aplica é o usuário). A prova de D-l7n-06 (tela antes da migração) e o fluxo completo com upload de foto real e sessão autenticada exigem o SQL rodado e credenciais reais, fora do alcance deste executor autônomo. Roteiro documentado em TESTES.md."

duration: ~35min
completed: 2026-08-21
status: complete
---

# Quick Task 260821-l7n: OS interna com fluxo de aprovação pelo gestor — Summary

**`/refrigeracao` ganha o mesmo fluxo de aprovação de duas pontas da contratação (gestor autoriza antes, confere depois) para a manutenção interna: `logs_manutencao` sai de "sem trava nenhuma de status" para sete estados novos com adjacência guardada, evidência obrigatória (fotos + 5 medições que nunca eram gravadas) e `ultima_manutencao` passando a ser gravada pela conferência, não pela abertura — tudo isso sobre uma migração ainda não aplicada e um banco pré-migração que continua funcionando exatamente como hoje.**

## Performance

- **Duration:** ~35min
- **Completed:** 2026-08-21
- **Tasks:** 3/3 completas
- **Files modified:** 6 (2 criados: `supabase/40_refrigeracao_os_fluxo.sql`, `tests/refrigeracao-fluxo-os-interna.test.js`; 4 modificados)

## Accomplishments

- `supabase/40_refrigeracao_os_fluxo.sql`: 9 colunas novas em `logs_manutencao` (fotos + as 3 assinaturas de delineamento/aprovação/conferência), a **primeira** check constraint de status que a tabela já teve (7 valores novos + 3 do legado, sem `not valid` — de propósito, para uma correção futura de histórico não estourar a trava), índice de `equip_id`. Escrita, nunca aplicada por este executor.
- `CAMPOS_LOG`/`dbToLog`/`logParaDb`: ponte única de campos, conferida por teste contra as colunas reais das migrações 04+40; `dbToLog` agora lê as 5 medições e as fotos, que a tela nunca consumia.
- `manSondarEsquema`/`MAN_FLUXO_OK`/`manAtualizarOS`: porta de escrita e sonda de esquema — sem a migração 40, `openLogForm`/`saveLogEntry` continuam byte a byte como hoje.
- Vocabulário do fluxo (`MAN_STATUS`, `MAN_EQUIVALENCIA`, `manNormalizar`, `manSemFluxo`, `manPendente`, `manProximos`, `manPodeIrPara`, `manPodeCargo`, `manClasseCard`, `statusPillOS` reescrita): a equivalência do legado agrupa nos filtros/badge/borda sem nunca renomear a pílula de uma linha que não passou pelo fluxo.
- `reguaPassos(passoAtual, passos)`: régua com dois consumidores — `ctTimeline` (contratação) vira casca sobre ela, `CT_STATUS` intocada.
- Drawer da OS interna (`manAbrirOS`, `manMudarStatus`, `manDelinear`, `manAprovar`, `manDevolver`, `manCancelar`): 4 seções (Abertura/Delineamento/Execução/Conferência), guarda dupla `manPode(acao) && manPodeIrPara(atual,destino)` em cada botão de gestor.
- Evidência da execução (`manRegistrarEvidencia`, `manTemEvidencia`, `manRenderEvidencia`): reusa `ctCompressFoto` (não copia), limite de 6 fotos por registro, arquivo não-imagem ignorado, fotos **acrescentadas** ao array existente (nunca substituídas), ΔT sempre derivado (`manDeltaT`) — `manMudarStatus` recusa `EM_EXECUCAO → EXECUTADA` sem evidência mesmo chamado direto.
- Conferência do gestor (`manConferir`): aprovada grava `CONFERIDA` + assinatura e só então chama `atualizarUltimaManutencao` com a **data da OS**; devolvida exige parecer e não toca em foto/medição.
- `renderOS`/`openDetail`/`contarOSPendentes` migram para o vocabulário canônico; chips do OS viram Todos/Em aberto/P·aprovar/Concluída/Crítica.
- Três gates existentes acompanharam a mudança de sentido (nenhum ficou verde por acidente): `refrigeracao-contagens` roda o recorte do vocabulário junto do de alertas; `refrigeracao-encerramento-os` fixa o guarda (fluxo ligado não grava última manutenção, desligado grava); `refrigeracao-trilha-os` continua verde **sem alteração** (prova de que `CT_STATUS` não foi tocada).
- `node --test`: 556/556 (514 de antes + 42 novos/alterados). Os quatro `grep -c` do PLAT-15 continuam em 0.

## Task Commits

1. **Task 1: migração 40, ponte de campos, porta de escrita, cargo no init e realtime de UPDATE** - `697d023` (feat)
2. **Task 2: máquina de estados na tela — vocabulário, régua, botões do gestor e gates existentes atualizados** - `a08b8fb` (feat)
3. **Task 3: evidência — fotos comprimidas e as cinco medições, e a conferência do gestor** - `bce8ee2` (feat)

## Files Created/Modified

- `supabase/40_refrigeracao_os_fluxo.sql` — migração aditiva nova, escrita e conferida por teste, **não aplicada**
- `refrigeracao/index.html` — ponte de campos, porta de escrita, vocabulário/transições, drawer da OS interna, evidência, conferência; `openLogForm`/`saveLogEntry`/`renderOS`/`openDetail`/`contarOSPendentes`/`setupRealtime`/`initAppOnce`/`acessoLivre`/`ctLoad`/`ctTimeline` ajustados
- `tests/refrigeracao-fluxo-os-interna.test.js` — gate novo, 39 casos (ponte de campos, porta de escrita, vocabulário/transições, evidência, conferência)
- `tests/refrigeracao-contagens.test.js` — sandbox passa a avaliar também o recorte do vocabulário; nova asserção fixando o sentido novo do badge
- `tests/refrigeracao-encerramento-os.test.js` — asserção solta de "saveLogEntry chama atualizarUltimaManutencao" virou 3 testes comportamentais fixando o guarda dos dois lados de `MAN_FLUXO_OK`
- `TESTES.md` — roteiro manual completo do fluxo (ponta a ponta por cargo + os dois caminhos negativos)

## Decisions Made

Ver `key-decisions` no frontmatter — D-l7n-01 a D-l7n-11, todas travadas no próprio PLAN.md e seguidas à risca. Nenhuma decisão nova tomada durante a execução; a única leitura de julgamento foi a divisão de `manMudarStatus` (guarda genérica de adjacência) versus as ações específicas (`manDelinear`/`manAprovar`/`manDevolver`/`manConferir`, que gravam campos extras e por isso não passam pela porta genérica).

## Deviations from Plan

None - plano executado conforme escrito, incluindo a revisão que trocou o terminal de sucesso para `CONFERIDA` (já refletida no PLAN.md antes da execução começar).

## Issues Encountered

- `reguaPassos`/`logParaDb`/`dbToLog` criam objetos **dentro** do sandbox `node:vm` — comparações `deepStrictEqual` contra literais do realm principal do Node falham por `Object.prototype` diferente entre realms (mesma armadilha já documentada em `tests/refrigeracao-encerramento-os.test.js`). Resolvido comparando campo a campo em vez de estrutural.
- Duas iterações de ajuste nos testes novos da Task 3: o `patch` capturado pelo `supa` falso reflete os nomes de **coluna** (pós-`logParaDb`), não o camelCase do app — as primeiras versões dos testes checavam `patch.insuflamento`/`patch.dataConferencia`/`patch.parecerConferencia` em vez de `patch.temp_insuflamento`/`patch.data_conferencia`/`patch.parecer_conferencia`. `setTimeout` também precisou de um stub no sandbox (não existe por padrão em `node:vm`).
- `manMudarStatus` não tinha, na primeira versão, o guard de evidência para a transição `EM_EXECUCAO → EXECUTADA` (D-l7n-09 só estava na renderização condicional do botão) — corrigido acrescentando `manTemEvidencia` diretamente na função antes de escrever o teste que prova a chamada direta recusada.

## User Setup Required

**Migração `supabase/40_refrigeracao_os_fluxo.sql` precisa ser rodada no SQL editor do Supabase antes de o fluxo entrar em vigor.** Depois de aplicar, colar o resultado do bloco de conferência (comentado no fim do próprio arquivo) no roteiro manual de `TESTES.md`. Até lá, o frontend publicado continua funcionando exatamente como hoje (D-l7n-06, testado).

## Next Phase Readiness

- `node --test`: 556/556, 0 falhas
- `git diff --stat` (branch inteira) toca só `refrigeracao/index.html`, `supabase/40_refrigeracao_os_fluxo.sql`, `TESTES.md` e três arquivos de teste — nada em `shared/`, `maquinas/`, `mapa/`, `reparos/` ou `calibracao/`
- **Pendência de RLS (D-l7n-03, sem eufemismo):** a policy de `logs_manutencao` continua `for update to authenticated using(true)`, sem distinção de cargo — um técnico autenticado poderia aprovar/conferir a própria OS por uma chamada REST montada à mão. A tela não oferece os botões, e cada passo grava quem assinou, mas fechar de verdade exige uma migração de policy, fora deste escopo.
- **Pendência do bucket público (T-l7n-05):** `os-fotos` continua público (pré-existente, migração 07); tornar privado quebraria as fotos já publicadas da contratação e exigiria URL assinada em dois módulos. Mitigação em vigor: caminho `manutencao/<log_id>/<timestamp>_<i>.jpg`, não enumerável, sem dado pessoal no nome.
- **Migração 40:** escrita e conferida por teste (colunas, trava, índice), **ainda não aplicada** em produção — próximo passo é o usuário rodá-la e seguir o roteiro em `TESTES.md`.
- Fora de escopo por decisão do plano, registrado para não ser "consertado" sem querer: gate de cargo em `delLog` (defeito pré-existente), trilha de eventos em tabela própria para a OS interna (usa as próprias colunas de assinatura, D-l7n-08).

## Self-Check: PASSED

- Todos os 6 arquivos citados (criados/modificados) confirmados em disco.
- Os 3 commits de task (`697d023`, `a08b8fb`, `bce8ee2`) confirmados em `git log`.
- `node --test`: 556/556 verde.
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0.
- `supabase/40_refrigeracao_os_fluxo.sql`: sem `drop table`, `drop column` ou `delete from`.
