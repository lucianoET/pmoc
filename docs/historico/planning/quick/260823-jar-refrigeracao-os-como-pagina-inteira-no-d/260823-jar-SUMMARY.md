---
phase: quick
plan: 260823-jar
subsystem: ui
tags: [refrigeracao, desktop, os, css, media-query, tdd]

requires: ["quick/260823-92t"]
provides:
  - "Em >=1024px, a OS de /refrigeracao vira PÁGINA inteira (#page-os-detalhe), com faixa de cabeçalho carregando a régua de passos permanentemente visível e um corpo de duas zonas (contexto/trabalho) que rolam por dentro enquanto a página não rola"
  - "manMontarOS(logId): fonte única do conteúdo da OS — devolve {ident,regua,contexto[],trabalho[],rodape:{gaveta,pagina}}, corte de PREFIXO da ordem de montagem de sempre, sem reescrever uma vírgula de conteúdo"
  - "Camada compartilhada de detalhe em página (DETALHE_ABERTO/DETALHE_ORIGEM/detalheAbertoDe/lerOrigemDetalhe/paginaDetalheAtiva/ativarPaginaDetalhe/voltarDoDetalhe/fecharDetalhe/reAlojarDetalhe) serve ficha E OS, um dono e dois consumidores, sem segunda cópia e sem segundo ouvinte de resize"
  - "OS_CAMPOS_VOLATEIS/osCapturarCampos/osRestaurarCampos: texto digitado e não salvo sobrevive ao cruzamento do limiar de 1024px nos dois sentidos"
affects: [refrigeracao]

tech-stack:
  added: []
  patterns:
    - "Corte de PREFIXO: quando uma função monta uma string condicional que precisa virar duas apresentações (gaveta concatenada vs. página distribuída em zonas), a extração separa em ARRAYS (contexto[]/trabalho[]) na MESMA ORDEM de montagem de hoje, nunca reordenando — é isso que torna a igualdade byte a byte alcançável e verificável por fixture"
    - "Grade dirigida pelo conteúdo: quando uma das duas zonas de uma página de detalhe pode legitimamente ficar vazia (linha sem fluxo, formulário que toma a tela), a função de decisão de layout é PURA (osUmaColuna(temTrabalho, editando)) e o renderizador concatena as duas zonas numa coluna única em vez de deixar uma coluna vazia ao lado da outra"
    - "Registro único com tipo ({tipo,id} em vez de duas variáveis paralelas) quando dois consumidores (ficha, OS) compartilham a mesma invariante 'só um detalhe pode estar aberto por vez' — detalheAbertoDe(tipo) é a única porta de leitura, nenhum chamador desestrutura o objeto à mão"

key-files:
  created:
    - tests/refrigeracao-os-pagina.test.js
    - tests/fixtures/refrigeracao-os-gaveta.json
  modified:
    - refrigeracao/index.html
    - tests/refrigeracao-os-unificada.test.js
    - tests/refrigeracao-ficha-pagina.test.js
    - TESTES.md

key-decisions:
  - "D-jar-01..20: as vinte decisões travadas no PLAN.md, seguidas à risca — D-jar-01/02: camada compartilhada sobe estado+navegação (DETALHE_ABERTO com tipo, um registro só); D-jar-03: lerOrigemDetalhe ATUALIZA, nunca redefine às cegas — mantém a origem anterior quando a página ativa não é uma das cinco abas, o que faz o encadeamento Alertas→ficha→OS→volta funcionar; D-jar-04: manAbrirOS continua porta única, 25 pontos de chamada intocados, delega por TELA_LARGA; D-jar-05/06: manMontarOS é corte de prefixo, contexto=o que se lê enquanto se escreve, trabalho=onde se escreve; D-jar-07: osUmaColuna pura decide coluna única quando não há trabalho ou quando se edita; D-jar-08: larguras/alturas dos campos ditas em número (~985px/~875px contra ~330px, 140px contra 80px); D-jar-09: OS_CAMPOS_VOLATEIS exclui man-ex-fotos (value de file input não é escrevível); D-jar-10: rolagem preservada só na MESMA OS, explícita, não implícita; D-jar-11: rodape.pagina mesmas ações em texto, sem o botão de fechar; D-jar-12: fecharDetalhe() resolve o continente certo para manCancelar; D-jar-13: Inst./Remoção entra junto por construção (mesmo manAbrirOS); D-jar-14: navTo zera DETALHE_ABERTO; D-jar-15: Escape usa PAGINAS_DETALHE, ordem gaveta-depois-página preservada; D-jar-16: CSS só dentro do @media (min-width:1024px) existente; D-jar-17: gaveta provada em cinco cenários por fixture; D-jar-18: gates existentes reescritos, nunca apagados; D-jar-19: nenhuma migração/dado/regra nova; D-jar-20: uma seção só para a camada compartilhada, código novo da OS dentro da seção existente"
  - "Deviação (Rule 1, bug descoberto escrevendo o gate da Task 3): osAbrirGaveta passou a gravar DETALHE_ABERTO = {tipo:'os', id} — o plano define isso em osAbrirPagina mas nunca instrui osAbrirGaveta a gravá-lo, e sem essa gravação abrir uma OS direto pela gaveta (fluxo mais comum em celular) e depois alargar a janela nunca saberia qual OS reabrir como página. Mesmo padrão do deviation documentado em 260823-92t para abrirFichaGaveta/FICHA_ABERTA."
  - "Deviação (Rule 1, bug descoberto no mesmo teste): osAbrirPagina passou a zerar scrollTop explicitamente ao trocar de OS — a implementação original só preservava a rolagem na MESMA OS, mas nunca reafirmava zero na troca, deixando a rolagem 'vazada' de uma OS para a seguinte num ambiente onde innerHTML não reseta scrollTop sozinho (e não deveria depender disso em produção também)."
  - "Deviação (Rule 1, documentação/comentário): o critério do PLAN.md 'grep -c man-ex-fotos == 1' está factualmente incorreto para este código-base — a contagem de HEAD (antes desta tarefa) já era 2 (o campo + a leitura em manRegistrarEvidencia), não 1. O comentário explicativo de OS_CAMPOS_VOLATEIS foi escrito para não introduzir uma TERCEIRA ocorrência textual, mantendo a contagem em 2 (igual ao baseline) — o invariante real (a lista fechada nunca contém o id) está provado pelo teste 'OS_CAMPOS_VOLATEIS não contém man-ex-fotos'."

requirements-completed: [QUICK-260823-jar]

coverage:
  - id: D1
    description: "manMontarOS(logId): fonte única do conteúdo da OS, com a gaveta provada byte a byte em cinco cenários (D-jar-17)"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-os-pagina.test.js — 15 casos da Task 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Camada compartilhada de detalhe em página + #page-os-detalhe: marcação, CSS dentro do @media existente, abrir e voltar"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-os-pagina.test.js — 11 casos da Task 2; tests/refrigeracao-desktop.test.js e tests/refrigeracao-ficha-pagina.test.js sem edição de comportamento (só renomes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cruzar o limiar de 1024px nos dois sentidos preserva a OS aberta e o texto digitado e não salvo, incluindo correção de dados"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-os-pagina.test.js — 10 casos da Task 3"
        status: pass
    human_judgment: false
  - id: D4
    description: "Conferência visual em 1440px/1024px/375px, largura dos campos de texto, coluna única, rolagem, cancelamento pela página"
    verification:
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — a OS como página inteira no computador (23/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "Sem Playwright nem navegador real neste ambiente autônomo — mesma pendência já registrada em PLAT-15/16, 260822-8rz, 260823-3a6 e 260823-92t. Roteiro documentado em TESTES.md."

duration: ~2h10min
completed: 2026-08-23
status: complete
---

# Quick Task 260823-jar: A OS como página inteira no computador — Summary

**Em `>=1024px`, a ordem de serviço de `/refrigeracao` deixa de ser painel lateral estreito e vira página inteira, com faixa de cabeçalho carregando a régua de passos e um corpo de duas zonas que rolam por dentro; abaixo de 1024px a gaveta continua byte a byte a de hoje, provada por fixture em cinco cenários, não afirmada. Mecanismo de página compartilhado com a ficha do equipamento (260823-92t) — um dono, dois consumidores.**

## Performance

- **Duration:** ~2h10min
- **Completed:** 2026-08-23
- **Tasks:** 3/3 completas
- **Files modified:** 7 (2 criados: `tests/refrigeracao-os-pagina.test.js`, `tests/fixtures/refrigeracao-os-gaveta.json`; 4 modificados; 1 doc de plano já existente)

## Accomplishments

- `manMontarOS(logId)` extrai o corpo monolítico de `manAbrirOS` em `{equipId, entry, ident, regua, contexto:[], trabalho:[], rodape:{gaveta, pagina}}` — corte de PREFIXO da ordem de montagem de hoje (D-jar-05/06), sem reescrever uma vírgula de conteúdo. Provado byte a byte contra `tests/fixtures/refrigeracao-os-gaveta.json`, impressão digital de cinco cenários (legado, interna+UNI_OK, movimentação, contrato fiscalizado, legado sem fluxo — D-jar-17) capturada do HTML de HEAD por um script descartável fora do repositório.
- Nova seção compartilhada `/* ── detalhe em página: estado e navegação (ficha e OS) ── */` concentra `DETALHE_ABERTO`/`DETALHE_ORIGEM`/`detalheAbertoDe`/`lerOrigemDetalhe`/`PAGINAS_DETALHE`/`paginaDetalheAtiva`/`ativarPaginaDetalhe`/`voltarDoDetalhe`/`fecharDetalhe`, mais `ABAS_NAV`/`indiceDaAba`/`ROTULOS_VOLTA`/`rotuloVolta`/`botaoDaAba` movidos sem reescrever corpo (D-jar-20). `FICHA_ABERTA`/`FICHA_ORIGEM` viraram `DETALHE_ABERTO` (um registro com `{tipo,id}`) e `DETALHE_ORIGEM`.
- `#page-os-detalhe`: sétima `.page`, faixa `#osd-hdr` (voltar, identidade, pílulas, régua permanentemente visível, ações) + `#osd-corpo` com `#osd-contexto`/`#osd-trabalho`. CSS inteiro dentro do `@media (min-width:1024px)` já existente — larguras/alturas específicas (D-jar-08): textarea de ~985px/140px na zona de trabalho contra os ~330px/80px de hoje.
- `osUmaColuna(temTrabalho, editando)`: função pura, coluna única quando não há trabalho (legado sem fluxo) ou quando se corrige dados — nunca uma coluna vazia ao lado de outra.
- `osAbrirPagina`/`osAbrirGaveta`: consomem `manMontarOS`, `manAbrirOS` despacha por `TELA_LARGA` (D-jar-04), os 25 pontos de chamada intocados.
- `reAlojarDetalhe()` (renomeado de `reAlojarFicha`) ganha os dois ramos da OS ao lado dos da ficha — quatro ramos no total, cada um só dispara quando o continente está errado para `TELA_LARGA`; os dois estados já-corretos devolvem `false` sem tocar em nada (T-jar-04, DoS auto-infligido).
- `OS_CAMPOS_VOLATEIS`/`osCapturarCampos`/`osRestaurarCampos`: texto digitado sobrevive ao cruzamento nos dois sentidos, incluindo correção de dados (`MAN_EDIT_ID` + `man-ed-desc`); `man-ex-fotos` fica deliberadamente fora (value de `input[type=file]` não é escrevível por script).

## Task Commits

1. **Task 1: Fonte única do conteúdo da OS, gaveta provada byte a byte** - `7e4c3d4` (test)
2. **Task 2: Camada compartilhada de detalhe e #page-os-detalhe** - `dc39da1` (feat)
3. **Task 3: Cruza o limiar de 1024px sem perder texto digitado** - `3cffde5` (feat)

**Plan metadata:** `b3c878a` (docs: pre-dispatch plan)

_Mesmo padrão de 260822-8rz/260823-3a6/260823-92t: cada task teve o gate escrito e visto FALHANDO antes da implementação, com um commit único cobrindo teste + implementação por task (Task 1 é `test(...)` por introduzir o gate e o fixture junto com a extração inicial; Tasks 2/3 são `feat(...)`)._

## Files Created/Modified

- `tests/refrigeracao-os-pagina.test.js` — gate novo, 36 casos (fonte única de `manMontarOS`, `#page-os-detalhe` marcação e comportamento, `osUmaColuna`, `reAlojarDetalhe` nos quatro estados × dois tipos, captura/restauração de campos voláteis, ausência de `pushState`)
- `tests/fixtures/refrigeracao-os-gaveta.json` — impressão digital da gaveta em cinco cenários (corpo/dhId/dhLocal/dhPredio/dhPills/rodape), capturada do HTML de HEAD antes da extração
- `refrigeracao/index.html` — `manMontarOS`/`osAbrirGaveta`/`osAbrirPagina`/`osUmaColuna`/`OS_CAMPOS_VOLATEIS`/`osCapturarCampos`/`osRestaurarCampos` novos dentro da seção `/* ── fluxo da OS interna: tela e ações ── */`; nova seção compartilhada `/* ── detalhe em página: estado e navegação (ficha e OS) ── */` antes da seção da ficha; `#page-os-detalhe` como sétima `.page`; CSS anexado ao `@media (min-width:1024px)` existente; `reAlojarDetalhe` (renomeado) com quatro ramos; `navTo`/`manCancelar`/Escape/`renderPaginaAtiva` ajustados para a camada compartilhada
- `tests/refrigeracao-os-unificada.test.js` — os três casos estruturais que recortavam `manAbrirOS` agora recortam `manMontarOS` (D-jar-18), com um caso novo provando que `manAbrirOS` não monta bloco por conta própria
- `tests/refrigeracao-ficha-pagina.test.js` — identificadores renomeados (`FICHA_ABERTA`→`DETALHE_ABERTO`, `FICHA_ORIGEM`→`DETALHE_ORIGEM`, `voltarDaFicha`→`voltarDoDetalhe`, `reAlojarFicha`→`reAlojarDetalhe`), `MARCADORES_PAGINA` aprende as funções compartilhadas novas — nenhum caso apagado
- `TESTES.md` — roteiro manual de conferência em 1440px/1024px/375px, datado de 23/08/2026

## Decisions Made

Ver `key-decisions` no frontmatter — D-jar-01 a D-jar-20, todas travadas no próprio PLAN.md e seguidas à risca, mais três deviações documentadas abaixo (Rule 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — comportamento exigido pelo próprio plano, mecanismo não explicitado] `osAbrirGaveta` passou a gravar `DETALHE_ABERTO = {tipo:'os', id}`**
- **Encontrado durante:** Task 3, ao escrever o gate do cenário "gaveta+alargar fecha a gaveta e abre a MESMA OS como página"
- **Issue:** o plano define `DETALHE_ABERTO` em `osAbrirPagina` (Task 2) e usa `detalheAbertoDe('os')` como precondição do ramo "gaveta aberta → vira página" em `reAlojarDetalhe` (Task 3), mas nunca instrui `osAbrirGaveta` a gravá-la. Sem isso, o fluxo mais comum — usuário abre a OS pelo celular/tela estreita (que chama `osAbrirGaveta` direto, nunca passando por `osAbrirPagina`) e depois alarga a janela — deixaria `detalheAbertoDe('os')` sempre `null`, e o ramo "gaveta+alargar" nunca dispararia
- **Fix:** `osAbrirGaveta` grava `DETALHE_ABERTO = {tipo:'os', id:logId}` logo após `openDrawer()` — simétrico a `abrirFichaGaveta` (mesmo precedente documentado em 260823-92t)
- **Files modified:** `refrigeracao/index.html`
- **Commit:** `3cffde5`
- **Verificação:** os quatro estados de `reAlojarDetalhe` para OS (página+estreito, página+largo, gaveta+largo, gaveta+estreito) passam, incluindo o round-trip completo

**2. [Rule 1 — bug de rolagem] `osAbrirPagina` passou a zerar `scrollTop` explicitamente ao trocar de OS**
- **Encontrado durante:** Task 3, ao escrever o gate "a rolagem das duas zonas é preservada quando osAbrirPagina re-renderiza a MESMA OS, e volta a zero quando é outra"
- **Issue:** a implementação da Task 2 só escrevia `scrollTop` quando `mesmaOS` era verdadeiro; ao trocar de OS, simplesmente não tocava em `scrollTop`, deixando o valor anterior "vazado" para a OS seguinte (num sandbox `node:vm` sem DOM real isso é explícito; em produção depender do navegador zerar `scrollTop` sozinho ao trocar `innerHTML` é um comportamento implícito que o próprio D-jar-10 pede para ser explícito)
- **Fix:** ramo `else` explícito zerando `#osd-contexto`/`#osd-trabalho`.scrollTop quando não é a mesma OS
- **Files modified:** `refrigeracao/index.html`
- **Commit:** `3cffde5`

**3. [Rule 1 — critério do plano factualmente incorreto] `grep -c 'man-ex-fotos'` — baseline já era 2, não 1**
- **Encontrado durante:** Task 3, ao conferir os critérios de `<done>`
- **Issue:** o PLAN.md pede `grep -c 'man-ex-fotos' refrigeracao/index.html == 1 (só o campo em si, nunca na lista de voláteis)`, mas o HEAD anterior a esta tarefa já tinha 2 ocorrências (o campo `<input id="man-ex-fotos">` e a leitura `el('man-ex-fotos').files` em `manRegistrarEvidencia`, pré-existente de 260821-l7n) — o critério `==1` nunca foi alcançável neste código-base
- **Fix:** o comentário explicativo de `OS_CAMPOS_VOLATEIS` foi escrito para NÃO citar o id textualmente, mantendo a contagem em 2 (igual ao baseline, sem introduzir uma terceira ocorrência); o invariante real ("a lista fechada nunca contém o id") é provado pelo teste `OS_CAMPOS_VOLATEIS não contém man-ex-fotos`
- **Files modified:** `refrigeracao/index.html`, `tests/refrigeracao-os-pagina.test.js`
- **Commit:** `3cffde5`

---

**Total deviations:** 3 auto-fixed (Rule 1)
**Impact on plan:** As duas primeiras são necessárias para as verdades "cruzar o limiar preserva a OS aberta" e "rolagem correta" do próprio plano funcionarem no fluxo mais comum (abertura direta pelo celular) e no caso de troca de OS; nenhuma introduz superfície nova. A terceira é só documentação — corrige um número no plano, sem mudar código de produção além do texto de um comentário.

## Issues Encountered

Nenhum além das três deviações acima. O padrão de sandbox `node:vm` reusado de `tests/refrigeracao-os-unificada.test.js`/`tests/refrigeracao-ficha-pagina.test.js` exigiu atenção redobrada em duas armadilhas já conhecidas do projeto: (a) `UNI_OK`/`OS_ITENS`/`OS_COMENTARIOS`/`CASOS_INSTALACAO`/`casoDeInstalacao`/`rotuloLocalDestino`/`manRenderEvidencia`/`manTemEvidencia` são `var`/`function` dentro dos recortes carregados e reatribuem ao rodar — sempre semeados **depois** de todos os `vm.runInContext`; (b) `assert.deepStrictEqual`/`deepEqual` falha em objetos/arrays criados dentro do sandbox (`Object.prototype` de outro realm) mesmo com conteúdo idêntico — usado `assert.equal` campo a campo ou `.length`/`JSON.stringify` em seu lugar.

## User Setup Required

Nenhum. Frontend puro, nenhuma migração, nenhuma dependência nova, `refrigeracao/index.html` continua congelada e standalone (D-04, os quatro `grep -c` do PLAT-15 em 0). Basta o próximo deploy (push em `luctronics-ET/pmoc`).

## Next Phase Readiness

- `node --test`: 945/945, 0 falhas (908 baseline + 37 novos: 36 em `refrigeracao-os-pagina.test.js` + 1 estrutural novo em `refrigeracao-os-unificada.test.js`)
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0
- `grep -c 'pushState'`: 0
- `grep -c 'voltarDaFicha'`: 0 (função e literal em comentários eliminados)
- `grep -c 'manAbrirOS('`: 26 (25 chamadas + a declaração — intocados)
- `tests/refrigeracao-desktop.test.js`, `tests/refrigeracao-topbar-parque.test.js`, `tests/refrigeracao-qr-nfc.test.js`, `tests/refrigeracao-gaveta-qr.test.js`, `tests/refrigeracao-fluxo-os-interna.test.js`, `tests/refrigeracao-movimentacao-os.test.js` e `tests/refrigeracao-trilha-os.test.js` verdes **sem edição** — CSS de celular byte a byte intacto, um único `@media` novo
- `git diff --stat` das três tasks toca só `refrigeracao/index.html`, dois arquivos novos em `tests/`, dois arquivos existentes em `tests/` e `TESTES.md` — nada em `supabase/`, nada em `/home/luc/DEV_ERP`
- Roteiro manual pendente em `TESTES.md`: conferência visual em 1440px/1024px/375px, largura/altura dos campos, coluna única, rolagem, cancelamento pela página — sem Playwright nem navegador real neste ambiente, mesma pendência do PLAT-15/16/260822-8rz/260823-3a6/260823-92t
- **Não é escopo desta task** (D-jar-19): o textarea de comentário `os-comentario-texto` continua atrás de `UNI_OK`, esperando a migração 43 — não tocado

## Self-Check: PASSED

- `tests/refrigeracao-os-pagina.test.js` e `tests/fixtures/refrigeracao-os-gaveta.json` confirmados em disco.
- Os 3 commits de task (`7e4c3d4`, `dc39da1`, `3cffde5`) confirmados em `git log`.
- `node --test`: 945/945 verde.
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0.
- `grep -c 'pushState'`: 0.

---
*Phase: quick-260823-jar*
*Completed: 2026-08-23*
