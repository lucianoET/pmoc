---
phase: quick
plan: 260821-uyz
subsystem: ui
tags: [refrigeracao, os-instalacao, os-remocao, baixa-patrimonial, situacao-patrimonial, mapa, supabase]

requires: []
provides:
  - "equipamentos.situacao (instalado/removido/baixado, terminal) + data_remocao/data_baixa — migração 42, escrita, aditiva, NÃO aplicada"
  - "logs_manutencao ganha local_destino_id/local_origem_id/equip_substituido_id/destino_remocao — a OS de Instalação e a de Remoção reusam o fluxo de 6 estados de 260821-l7n"
  - "normalizarSituacaoEquip/equipInstalado/equipRemovido/equipBaixado/equipamentosOperacionais/contarNaoOperacionais: vocabulário único de situação, respondendo 'instalado' para a ausência da coluna (banco pré-42)"
  - "terceiro segmento da aba OS (Manutenção | Contratações | Inst./Remoção), sob MAN_FLUXO_OK && MOV_OK — MOV_OK é sonda própria, separada de MAN_FLUXO_OK (D-uyz-13)"
  - "casoDeInstalacao/CASOS_INSTALACAO: os três casos de instalação (novo local, mais uma máquina, substituição) derivados do dado gravado, nunca digitados"
  - "aplicarInstalacao/aplicarRemocao: convergentes e idempotentes, chamadas por manConferir ANTES do status terminal — conferir a mesma OS duas vezes não grava duas vezes"
  - "mapa/mapa-dados.js: CONFIG_POR_MODULO.climatizacao filtra por situacao='instalado', com recuo de uma repetição sem a coluna quando o banco não tem a migração 42"
affects: [refrigeracao, mapa]

tech-stack:
  added: []
  patterns:
    - "Sonda de esquema própria por funcionalidade (MOV_OK ao lado de MAN_FLUXO_OK, nunca dentro) — estender uma sonda existente desligaria funcionalidade já publicada num banco parcialmente migrado"
    - "Funções de conferência convergentes/idempotentes (aplicarInstalacao/aplicarRemocao): calculam o alvo, comparam com o estado atual, só escrevem se diferente — mesma técnica de atualizarEstadoEquip/atualizarUltimaManutencao (260821-l7n/q57) e de baixarPecasDaOS() em Máquinas"
    - "Cadastro gravado ANTES do status terminal na conferência de movimentação (D-uyz-15) — inverte a ordem usada na conferência de manutenção comum, com o motivo escrito nos dois pontos"

key-files:
  created:
    - supabase/42_refrigeracao_movimentacao.sql
    - tests/refrigeracao-situacao-equipamento.test.js
    - tests/refrigeracao-movimentacao-os.test.js
  modified:
    - refrigeracao/index.html
    - mapa/mapa-dados.js
    - tests/refrigeracao-contagens.test.js
    - tests/refrigeracao-ficha-equipamento.test.js
    - tests/refrigeracao-fluxo-os-interna.test.js
    - tests/refrigeracao-qr-nfc.test.js
    - tests/mapa-cobertura.test.js
    - TESTES.md

key-decisions:
  - "D-uyz-01: terceiro segmento no seg-toggle existente de #page-os (Manutenção | Contratações | Inst./Remoção), não uma sexta aba — a barra inferior não tem espaço para outro item a 375px"
  - "D-uyz-02: reusa logs_manutencao e o fluxo de 6 estados de 260821-l7n, com tipo=INSTALAÇÃO/REMOÇÃO — evita um segundo fluxo, uma segunda régua e uma segunda porta de escrita"
  - "D-uyz-03: os três casos de instalação são DERIVADOS: equip_substituido_id preenchido → substituição; senão destino ocupado → adicional; senão → novo local. Nunca um campo digitado"
  - "D-uyz-04: a conferência do gestor aplica a mudança no cadastro — mesma mecânica de atualizarUltimaManutencao"
  - "D-uyz-05: equipamentos.situacao, lista fechada instalado/removido/baixado; baixado é TERMINAL — uma instalação recusa máquina baixada"
  - "D-uyz-06: a OS de remoção tem destino: guardada (→ removido) ou baixa (→ baixado)"
  - "D-uyz-07: a baixa exige cargo admin, não gestor — desinstalar é manutenção, dar baixa é ato patrimonial formal (podeDarBaixa())"
  - "D-uyz-08: instalação de máquina que ainda não existe no cadastro é possível pelo próprio formulário (openEquipNovo/salvarEquipNovo), reusando EQUIP_EDITAVEIS/equipParaDb/campoEquipForm"
  - "D-uyz-09: as partes da remoção viram checklist (CHECKLIST_REMOCAO/CHECKLIST_INSTALACAO), no mecanismo por tipo de equipamento que já existe para manutenção"
  - "D-uyz-10: só instalado participa da operação — KPIs, alertas, PMOC, gráficos e os dois seletores de OS leem equipamentosOperacionais(DATA); removido/baixado continuam carregados e alcançáveis por chip próprio e link direto"
  - "D-uyz-11: normalizarSituacaoEquip responde 'instalado' para ausência (banco pré-42) e null para texto fora da lista — duas causas diferentes, duas respostas diferentes"
  - "D-uyz-12: situacao/dataRemocao/dataBaixa ficam FORA de EQUIP_EDITAVEIS — mudam só por conferência de OS, nunca pelo formulário de cadastro"
  - "D-uyz-13: MOV_OK é sonda PRÓPRIA, separada de MAN_FLUXO_OK/manSondarEsquema — estender a sonda existente desligaria o fluxo de manutenção inteiro num banco com 40+41 e sem 42"
  - "D-uyz-14: a OS de instalação NÃO remove a máquina substituída — a conferência recusa enquanto ela ainda estiver instalada, nomeando a OS de remoção que falta"
  - "D-uyz-15: na conferência de movimentação o cadastro é gravado ANTES do status terminal (CONFERIDA); aplicarInstalacao/aplicarRemocao são convergentes — a ordem da OS de manutenção comum não muda"
  - "D-uyz-16: checklistDaOS(tipoOS, tipoEquip) escolhe primeiro pelo tipo da OS, depois pelo do equipamento, com o mesmo recuo para SPLIT que já existia"
  - "D-uyz-17: evidência de movimentação é foto OU checklist de partes COMPLETO — medição de insuflamento não faz sentido em remoção"
  - "D-uyz-18: a data é sempre a da OS (entry.date), nunca a do clique — data_instalacao/data_remocao/data_baixa"
  - "D-uyz-19: a remoção limpa lat/lon junto do local — coordenada de máquina numa prateleira é dado falso"
  - "D-uyz-20: situacao e funciona são eixos ortogonais — a baixa NÃO força INOP; o seletor de estado não aparece em OS de movimentação"
  - "D-uyz-21: MOV_TIPOS nunca entram em MAINT_TIPOS — o formulário de manutenção não tem onde pôr destino/origem/substituída"
  - "D-uyz-22: logs_manutencao.tipo continua sem check constraint — texto livre desde a migração 04, o app é o único escritor e escreve de lista fechada"
  - "D-uyz-23: a trava de cargo é UX apenas, inclusive a da baixa — as policies de equipamentos/logs_manutencao são to authenticated using(true), sem distinção de cargo. Pendência registrada sem eufemismo"
  - "D-uyz-24: sem a migração 42, MOV_OK fica falso e o terceiro segmento não é injetado; no /mapa, carregarAtivosDoModulo repete uma única vez sem a coluna/filtro no erro"
  - "D-uyz-25: predio/local são derivados de cmasm_locais no momento da conferência via rotuloLocalDestino (guarda de ciclo) — aplicarInstalacao recusa em vez de gravar meia coisa quando o destino não resolve"

patterns-established:
  - "situacaoPill/EQUIP_SITUACOES como ponto único do vocabulário visual de situação patrimonial — instalado não desenha pílula (caso normal), removido/baixado ganham classes próprias (pill-sit-removido/pill-sit-baixado, nunca colidindo com pill-baixa de criticidade)"

requirements-completed: []

coverage:
  - id: D1
    description: "Migração 42 escrita (aditiva, sem drop/delete), garantindo forma além de existência (set not null depois do update de backfill), com a ponte CAMPOS_EQUIP/CAMPOS_LOG conferida coluna a coluna nos dois sentidos"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-situacao-equipamento.test.js#EQUIP_SITUACOES bate nos dois sentidos com o check(situacao in (...)) da migração 42"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-situacao-equipamento.test.js#o set not null de situacao vem DEPOIS do update ... where situacao is null"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-movimentacao-os.test.js#todo valor de CAMPOS_LOG é coluna real de logs_manutencao (união 04+40+41+42)"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-ficha-equipamento.test.js#todo valor de CAMPOS_EQUIP é coluna real de equipamentos (união das migrações 04+19+25+41)"
        status: pass
    human_judgment: false
  - id: D2
    description: "situacao atravessa a tela e o mapa: equipamentosOperacionais(DATA) alimenta KPIs/alertas/PMOC/gráficos/seletores; inventário com dois chips novos e busca dentro deles; /mapa filtra por situacao com recuo de uma repetição sem a migração 42"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-situacao-equipamento.test.js#equipamentosOperacionais devolve só os instalados, preservando a ordem da lista recebida"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-contagens.test.js#o corpo de renderDash chama equipamentosOperacionais(DATA) e passa o resultado para alertasPmoc"
        status: pass
      - kind: unit
        ref: "tests/mapa-cobertura.test.js#carregarAtivosDoModulo repete a consulta sem situacao uma única vez quando a primeira erra, e devolve as linhas da segunda"
        status: pass
    human_judgment: false
  - id: D3
    description: "Terceiro segmento da aba OS e formulário das duas OS, com os três casos de instalação derivados e cadastro de equipamento novo pelo próprio formulário"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-movimentacao-os.test.js#casoDeInstalacao devolve substituicao sempre que há máquina substituída, mesmo com o destino já ocupado"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-movimentacao-os.test.js#ctInjectToggle só injeta o terceiro botão (#seg-movim) sob MAN_FLUXO_OK && MOV_OK"
        status: pass
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — OS de Instalação e de Remoção, com baixa patrimonial (21/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "A prova visual do formulário, do cadastro na hora e da tela em 375px exige sessão autenticada e navegador, fora do alcance deste executor autônomo. Roteiro documentado em TESTES.md."
  - id: D4
    description: "Conferência aplica cadastro/local/situação (aplicarInstalacao/aplicarRemocao, convergentes e idempotentes) com a baixa gateada em admin (podeDarBaixa) e checklist de partes como evidência"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-movimentacao-os.test.js#aplicarInstalacao não escreve nada quando o equipamento já está exatamente no estado-alvo — conferir duas vezes não grava duas vezes"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-movimentacao-os.test.js#aplicarRemocao recusa o destino baixa para gestor e para técnico, e aceita para admin"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-movimentacao-os.test.js#manConferir de movimentação com aplicarInstalacao falhando (destino não resolve) NÃO chama a porta de escrita do status"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-movimentacao-os.test.js#manTemEvidencia de uma OS de remoção aceita checklist de partes completo sem foto, e recusa checklist parcial sem foto"
        status: pass
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — OS de Instalação e de Remoção, com baixa patrimonial (21/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "A prova de que a máquina some do mapa/inventário/KPIs ao conferir uma remoção real, e de que a baixa recusa para gestor e aceita para admin na tela de verdade, exige sessão autenticada contra o Supabase — fora do alcance deste executor autônomo. Roteiro documentado em TESTES.md."

duration: ~29min
completed: 2026-08-21
status: complete
---

# Quick Task 260821-uyz: OS de Instalação e de Remoção, com baixa patrimonial — Summary

**`/refrigeracao` ganha um terceiro segmento na aba OS (Manutenção | Contratações | Inst./Remoção) que reusa o fluxo de aprovação de 6 estados de hoje para instalar e remover máquinas — com os três casos de instalação derivados do dado gravado (nunca digitados), baixa patrimonial gateada em cargo admin, e a conferência do gestor aplicando cadastro/local/situação de forma convergente e idempotente — tudo sobre uma migração (42) escrita, aditiva e ainda não aplicada.**

## Performance

- **Duration:** ~29min
- **Completed:** 2026-08-21
- **Tasks:** 3/3 completas
- **Files modified:** 11 (3 criados: `supabase/42_refrigeracao_movimentacao.sql`, `tests/refrigeracao-situacao-equipamento.test.js`, `tests/refrigeracao-movimentacao-os.test.js`; 8 modificados)

## Accomplishments

- `supabase/42_refrigeracao_movimentacao.sql`: `equipamentos.situacao` (default `'instalado'`, backfill garantido antes do `not null`, `check` fechado) + `data_remocao`/`data_baixa`; quatro colunas novas em `logs_manutencao` (`local_destino_id`/`local_origem_id`/`equip_substituido_id`/`destino_remocao`), sem índice novo (nenhuma consulta filtra por elas). Escrita, aditiva, conferida por teste, **não aplicada**.
- Vocabulário de situação (`EQUIP_SITUACOES`/`normalizarSituacaoEquip`/`equipInstalado`/`equipRemovido`/`equipBaixado`/`equipamentosOperacionais`/`contarNaoOperacionais`, `situacaoPill`): ponto único, respondendo `'instalado'` para a ausência da coluna (D-uyz-11) — o frontend publicado hoje já entende o banco de amanhã. Todos os call sites que contavam sobre `DATA` inteiro (`renderDash`, `renderAlerts`, `renderPmoc`, `dvRenderCharts`, `openNewOSForm`, `ctNovaOS`) migraram para `equipamentosOperacionais(DATA)`.
- Inventário ganha dois chips (`Removidos`/`Baixados`), a busca continua valendo dentro deles, e o estado vazio anuncia quantos equipamentos removidos/baixados casam com a busca em vez de calar. A ficha (`openDetail`) mostra `situacaoPill` e uma linha honesta ("Sem local — removido em dd/mm/aaaa"/"Baixado em dd/mm/aaaa") no lugar de campos de local vazios.
- Terceiro segmento na aba OS (`ctInjectToggle`/`ctSetMode`), injetado só sob `MAN_FLUXO_OK && MOV_OK` — `MOV_OK`/`movSondarEsquema` são sonda **própria**, ao lado de `manSondarEsquema`, nunca dentro (D-uyz-13). CSS `.seg-toggle.tres` esconde os ícones para "Contratações" caber inteiro em 375px.
- Vocabulário de movimentação (`MOV_TIPOS`, `osEhMovimentacao`, `CHECKLIST_INSTALACAO`/`CHECKLIST_REMOCAO`, `checklistDaOS`, `CASOS_INSTALACAO`/`casoDeInstalacao`, `rotuloLocalDestino` com guarda de ciclo), `carregarLocais()` sob demanda, `renderMovim()` espelhando `renderOS()`, `openMovForm`/`salvarMovOS` (status sempre `'ABERTA'`, nunca lido de campo), `openEquipNovo`/`salvarEquipNovo` (D-uyz-08) e `podeDarBaixa()` junto de `podeEditarCadastro`.
- `aplicarInstalacao`/`aplicarRemocao` (D-uyz-15): convergentes e idempotentes, um único `.update(` cada, chamadas por `manConferir` **antes** do status `CONFERIDA` no ramo de movimentação — o ramo de manutenção comum não muda. Painel de movimentação na gaveta (`movPainelDaOS`) com origem/destino/caso/substituída (link para a ficha) e checklist marcável (`manMarcarChecklist`) durante `EM_EXECUCAO`. `manTemEvidencia` ganha o ramo de movimentação (foto OU checklist completo, D-uyz-17); o seletor de estado (`#man-conf-estado`) não aparece em OS de movimentação (D-uyz-20).
- `mapa/mapa-dados.js`: `CONFIG_POR_MODULO.climatizacao` ganha `colunaSituacao`/`situacaoVisivel`; `carregarAtivosDoModulo` recua uma única vez sem a coluna/filtro quando a primeira consulta erra (D-uyz-24) — só o segundo erro chama `mostrarErroDeCarga`.
- `node --test`: 714/714 (647 de antes + 67 novos/alterados). Os quatro `grep -c` do PLAT-15 continuam em 0.

## Task Commits

1. **Task 1: migração 42 e a situação patrimonial atravessando a tela e o mapa** - `a97cec3` (feat)
2. **Task 2: o terceiro segmento e o formulário das duas OS, com os três casos derivados** - `e9a252c` (feat)
3. **Task 3: a conferência aplicando cadastro, local e situação, com a baixa gateada em admin** - `03b760e` (feat)

## Files Created/Modified

- `supabase/42_refrigeracao_movimentacao.sql` — migração aditiva nova, escrita e conferida por teste, **não aplicada**
- `refrigeracao/index.html` — vocabulário de situação, ponte de campos, terceiro segmento, formulário de movimentação, conferência (aplicarInstalacao/aplicarRemocao), painel na gaveta, evidência
- `mapa/mapa-dados.js` — `colunaSituacao`/`situacaoVisivel` em `climatizacao`, recuo de uma repetição em `carregarAtivosDoModulo`
- `tests/refrigeracao-situacao-equipamento.test.js` — gate novo, 18 casos (vocabulário de situação, inventário, estrutural da migração 42, CAMPOS_EQUIP/EQUIP_EDITAVEIS)
- `tests/refrigeracao-movimentacao-os.test.js` — gate novo, 41 casos (vocabulário de movimentação, terceiro segmento, formulário, aplicarInstalacao/aplicarRemocao, manConferir, manTemEvidencia)
- `tests/refrigeracao-contagens.test.js` — asserções de que renderDash/renderAlerts/renderPmoc leem `equipamentosOperacionais(DATA)`, e que `alertasPmoc` continua pura
- `tests/refrigeracao-ficha-equipamento.test.js` — união de colunas de `equipamentos` estendida com a migração 42
- `tests/refrigeracao-fluxo-os-interna.test.js` — união de colunas de `logs_manutencao` estendida com a migração 42; stubs de `osEhMovimentacao`/`podeDarBaixa` no sandbox de manutenção
- `tests/refrigeracao-qr-nfc.test.js` — stubs de `equipInstalado`/`equipRemovido`/`equipBaixado` no sandbox de `filtrarInventario`
- `tests/mapa-cobertura.test.js` — cobertura de `colunaSituacao` e comportamento de `carregarAtivosDoModulo` com `supa` falso (erra na primeira, funciona na segunda; funciona de primeira)
- `TESTES.md` — roteiro manual de 7 passos (inclusive a tela em 375px) + pendência de RLS registrada

## Decisions Made

Ver `key-decisions` no frontmatter — D-uyz-01 a D-uyz-25, todas travadas no próprio PLAN.md (nove delas fechadas com o usuário antes da execução) e seguidas à risca. Nenhuma decisão nova tomada durante a execução.

## Deviations from Plan

None - plano executado conforme escrito. Um ajuste dentro do espaço de liberdade do plano: a verificação automatizada `grep -c 'drop table\|drop column\|delete from' supabase/42_*.sql | grep -qx 0` do PLAN.md conta 2 ocorrências porque o próprio cabeçalho comentado da migração **cita** essas três frases para explicar que o arquivo não as usa (mesmo padrão pré-existente em `supabase/41_refrigeracao_ficha_estado.sql`, verificado com o mesmo comando). O gate real (`tests/refrigeracao-situacao-equipamento.test.js`) confere a ausência das operações destrutivas fora dos comentários, com a mesma técnica já usada em `tests/refrigeracao-estado-equipamento.test.js` — a verificação de shell do PLAN.md é imprecisa por precedente, não uma regressão introduzida aqui.

## Issues Encountered

- Quatro arquivos de teste existentes precisaram de atualização para acompanhar a mudança de contrato: `tests/refrigeracao-ficha-equipamento.test.js` e `tests/refrigeracao-fluxo-os-interna.test.js` somavam as colunas das migrações 04+19+25+41/04+40+41 para validar `CAMPOS_EQUIP`/`CAMPOS_LOG` — sem somar a migração 42, os dois passaram a acusar as colunas novas como inexistentes; `tests/refrigeracao-qr-nfc.test.js` mockava `filtrarInventario` sem `equipInstalado`/`equipRemovido`/`equipBaixado` (a função passou a exigi-los); `tests/refrigeracao-fluxo-os-interna.test.js` também precisou de stubs de `osEhMovimentacao`/`podeDarBaixa` porque `manConferir` passou a referenciá-los. Todos resolvidos sem alterar o comportamento coberto por cada gate.

## User Setup Required

**Migração `supabase/42_refrigeracao_movimentacao.sql` precisa ser rodada no SQL editor do Supabase.** Ordem de publicação (D-uyz-24): o frontend das três tasks (merge + push) vai a produção **primeiro** — nada muda para o usuário, o terceiro segmento não aparece e o `/mapa` continua funcionando exatamente como hoje. **Depois**, aplicar a migração 42 e colar o resultado do bloco de conferência do próprio arquivo no roteiro de `TESTES.md`. Até lá, o app funciona exatamente como hoje (testado nos dois lados: `MOV_OK` falso desliga o terceiro segmento sem erro, e `carregarAtivosDoModulo` recua sem a coluna `situacao`).

## Next Phase Readiness

- `node --test`: 714/714, 0 falhas
- `git diff --stat` (as três tasks) toca só `refrigeracao/index.html`, `mapa/mapa-dados.js`, `supabase/42_refrigeracao_movimentacao.sql`, sete arquivos de teste e `TESTES.md` — nada em `shared/`, `maquinas/`, `reparos/`, `calibracao/`, `predial/`, nem em `mapa/xmap.js`/`mapa/xmap.css`
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0
- **Pendência de RLS (D-uyz-23, sem eufemismo):** as policies de `equipamentos` e `logs_manutencao` continuam `to authenticated using (true)`, sem distinção de cargo — um técnico autenticado poderia gravar `situacao='baixado'` por uma chamada REST montada à mão, contornando a trava de admin da tela. A tela não oferece o caminho e cada passo grava quem assinou, mas fechar de verdade exige uma migração de policy, fora deste escopo — mesma pendência já registrada em D-l7n-03/D-q57-13.
- **Migração 42:** escrita e conferida por teste (colunas, travas, ordem update→set not null), **ainda não aplicada** em produção — próximo passo é o usuário rodá-la e seguir o roteiro em `TESTES.md`.
- Fora de escopo por decisão do plano, para não ser "consertado" sem querer: tempo/custo de movimentação (não pedido), segunda foto/medição específica de movimentação além do checklist (D-uyz-17 já cobre com foto OU checklist completo).

## Self-Check: PASSED

- Os 3 arquivos criados (`supabase/42_refrigeracao_movimentacao.sql`, `tests/refrigeracao-situacao-equipamento.test.js`, `tests/refrigeracao-movimentacao-os.test.js`) confirmados em disco.
- Os 3 commits de task (`a97cec3`, `e9a252c`, `03b760e`) confirmados em `git log`.
- `node --test`: 714/714 verde.
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0.
- `supabase/42_refrigeracao_movimentacao.sql`: sem `drop table`, `drop column` ou `delete from` fora dos comentários que os citam para explicar a ausência.
