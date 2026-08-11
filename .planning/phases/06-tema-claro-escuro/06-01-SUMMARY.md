---
phase: 06-tema-claro-escuro
plan: 01
subsystem: ui
tags: [css, custom-properties, color-mix, wcag, shared/pmoc.css, shared/auth.js]

requires:
  - phase: 05-base-unificada
    provides: "shared/pmoc.css como fonte única de tokens de cor para os 6 módulos no escopo, shared/auth.js como login por cargo compartilhado"
provides:
  - "Bloco [data-theme=\"claro\"] em shared/pmoc.css com os 12 tokens de cor do tema claro, todos verificados em WCAG AA (mínimo 4,5:1) contra os três fundos claros"
  - "Token derivado --accent-texto (:root e redefinido no tema claro via color-mix), único ponto de controle para destaque-como-texto/borda que sobrevive à cascata de --accent declarado por módulo"
  - "Classe .btn-tema pronta para o botão de alternância que o plano 06-02 injeta na barra superior"
  - "shared/pmoc.css sem nenhuma cor hardcoded dependente de fundo escuro (rgba branco translúcido, componentes de token copiados à mão, hex literal em callout) — bordas, selos, botão destrutivo e callouts todos via color-mix sobre token"
  - "Tela de login compartilhada (shared/auth.js) legível nos dois temas — cor de texto dos dois botões Entrar deriva de var(--bg,#1a1a18) em vez de #1a1a18 fixo"
affects: [06-02-tema-claro-escuro, 06-03-tema-claro-escuro, 06-04-tema-claro-escuro]

tech-stack:
  added: []
  patterns:
    - "color-mix(in srgb,var(--TOKEN) N%,transparent) como padrão único para fundo tingido de selo/callout/botão destrutivo, substituindo rgba com componentes numéricos copiados à mão"
    - "Token derivado --accent-texto para resolver o problema de --accent ser declarado por módulo (mesma especificidade que a folha comum, ordem de cascata vence) — a folha comum não pode redefinir --accent por tema, mas pode declarar um token novo que só ela controla"

key-files:
  created: []
  modified:
    - shared/pmoc.css
    - shared/auth.js

key-decisions:
  - "PLAT-04 não foi marcado como concluído em REQUIREMENTS.md: este plano só prepara a folha de estilo (tokens + eliminação de hardcode); não existe botão nem lógica de alternância de tema em nenhum módulo ainda — isso é o plano 06-02. Marcar completo agora seria falso."
  - "PLAT-16 não foi reescrito em REQUIREMENTS.md: já está marcado [x] com evidência específica da Fase 5 (05-07); a reverificação completa para a Fase 6 fica registrada no roteiro do plano 06-04, conforme a Suposição sinalizada do próprio 06-01-PLAN.md"
  - ".co-blue teve a cor de texto alinhada ao token --blue (era um azul mais claro escolhido à mão, #8eb9d1) — única mudança visual intencional no tema escuro, documentada no plano como consciente"

patterns-established:
  - "Correções de hardcode de cor em shared/pmoc.css seguem sempre o par (fundo via color-mix sobre token semântico, texto via var(--TOKEN) ou var(--accent-texto)), nunca hex/rgba literal"

requirements-completed: []

coverage:
  - id: D1
    description: "Bloco [data-theme=\"claro\"] com os 12 tokens de cor do tema claro (7 neutros + 5 semânticos) mais --accent-texto, todos com contraste AA medido, sem redefinir --accent nem --ff"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "bash gate embutido no plano — grep dos 12 valores de token + verificação de que --accent/--ff não aparecem no bloco do seletor"
        status: pass
    human_judgment: true
    rationale: "O contraste AA foi calculado analiticamente pelo planner e verificado estruturalmente por grep, não medido por ferramenta de acessibilidade automatizada em runtime; a conferência visual real (troca de tema, leitura em tela) fica para o roteiro manual do plano 06-04"
  - id: D2
    description: "shared/pmoc.css sem nenhuma cor hardcoded dependente de fundo escuro (branco translúcido, rgba com componentes de token copiados à mão, hex literal de callout)"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "bash gate embutido no plano — grep de ausência de rgba(255,255,255, dos 5 grupos de componentes numéricos e dos 4 hex de callout; contagem de color-mix >= 12 e var(--accent-texto) >= 7"
        status: pass
    human_judgment: false
  - id: D3
    description: "Botões Entrar de shared/auth.js legíveis nos dois temas, derivando cor de texto de var(--bg,#1a1a18) em vez de #1a1a18 fixo, sem alterar a API pública do módulo"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "bash gate embutido no plano — grep de ausência de color:#1a1a18, presença de color:var(--bg,#1a1a18) x2, node --check no arquivo copiado para .mjs, grep das 3 exportações públicas"
        status: pass
    human_judgment: false
  - id: D4
    description: "node --test na raiz permanece verde com os 25 testes do baseline após as duas tarefas"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "node --test (25 testes, fail 0)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-11
status: complete
---

# Phase 06 Plan 01: Tokens de tema claro em shared/pmoc.css Summary

**shared/pmoc.css ganha um tema claro completo em tokens (12 cores + --accent-texto derivado) verificado em WCAG AA, e perde todo hardcode de cor que só funcionava sobre fundo escuro; shared/auth.js corrige a cor de texto dos dois botões Entrar para acompanhar o tema.**

## Performance

- **Duration:** 3min
- **Started:** 2026-08-11T09:54:46Z
- **Completed:** 2026-08-11T09:57:20Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Bloco `[data-theme="claro"]` acrescentado a `shared/pmoc.css` com exatamente os 12 tokens de cor do tema claro (7 neutros + 5 semânticos) mais `--accent-texto`, sem tocar `--accent` nem `--ff`; o bloco `:root` do tema escuro permanece com os 14 valores originais, byte-idênticos.
- Token derivado `--accent-texto` criado em `:root` (`var(--accent)` no escuro) e redefinido no tema claro via `color-mix(in srgb,var(--accent) 55%,#000)` — resolve o problema estrutural de `--accent` ser declarado por cada módulo no próprio `<style>`, com a mesma especificidade que a folha comum e posição posterior na cascata.
- Classe `.btn-tema` (e `:hover`) criada para o botão de alternância que o plano 06-02 vai injetar — nome verificado sem a subsequência `nav`, preservando as regex de `tests/shell.test.js`.
- Cinco pontos de hardcode de cor eliminados em `shared/pmoc.css`: borda de linha de tabela (branco translúcido → `color-mix` sobre `--border`), fundo dos cinco selos, botão destrutivo `.btn-d`, e os quatro callouts de alerta (fundo e cor de texto, incluindo o desalinhamento de `.co-blue`).
- Seis regras que pintam o destaque como texto ou borda de componente (`.logo-accent`, `.topbar-back:hover`, `.nav-btn.active`, `.btn-s:hover`, `input:focus`, `.shell-footer a:hover`) passaram a usar `var(--accent-texto)` em vez de `var(--accent)`; `.logo-dot`, `.kc-accent` e `.btn-p` mantidos intocados de propósito (preenchimento decorativo, não texto/borda).
- Os dois botões `Entrar` de `shared/auth.js` (senha e e-mail) passaram a derivar a cor do texto de `var(--bg,#1a1a18)`, byte-equivalente no tema escuro e legível (5,35:1) no tema claro.

## Task Commits

Each task was committed atomically:

1. **Task 1: Acrescentar o bloco de tema claro, o token --accent-texto e a classe .btn-tema em shared/pmoc.css** - `d4084e2` (feat)
2. **Task 2: Eliminar de shared/pmoc.css e shared/auth.js as cores que dependem de fundo escuro** - `cbcea63` (fix)

**Plan metadata:** pending (docs: complete plan) — commit hash recorded after this SUMMARY

## Files Created/Modified
- `shared/pmoc.css` - Bloco `[data-theme="claro"]`, token `--accent-texto`, classe `.btn-tema`, e cinco famílias de regras convertidas de hex/rgba literal para `color-mix`/`var()` sobre token
- `shared/auth.js` - Cor de texto dos dois botões `Entrar` trocada de `#1a1a18` fixo para `var(--bg,#1a1a18)`

## Decisions Made
- PLAT-04 não foi marcado `[x]` em REQUIREMENTS.md: este plano é só a preparação de CSS (tokens + eliminação de hardcode); não há botão nem `data-theme` sendo escrito em nenhum lugar ainda — a funcionalidade real de "usuário alterna tema" só existe a partir do plano 06-02. Marcar completo agora anteciparia uma entrega que não aconteceu.
- PLAT-16 não foi reescrito: já está `[x]` com evidência específica e datada da Fase 5 (verificado em 05-07); este plano manteve `node --test` verde com os mesmos 25 testes, mas a reverificação formal para a Fase 6 fica para o roteiro do plano 06-04, como a própria tabela de suposições sinalizadas do plano já previa.
- `.co-blue` teve a cor de texto alinhada ao token `--blue` (era `#8eb9d1`, um azul mais claro escolhido à mão, diferente do token `#4a7fa0`) — a única mudança visual no tema escuro deste plano, e intencional conforme o próprio plano documentava.

## Deviations from Plan

None - plan executed exactly as written. Os dois tasks seguiram a ação descrita valor por valor; nenhum Rule 1-4 foi acionado.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`shared/pmoc.css` está pronto para o plano 06-02 injetar o botão `.btn-tema` na barra superior e a lógica JS de alternância (`data-theme` + `localStorage['pmoc-tema']`, convenção D-03). Nenhum módulo foi tocado — a adoção acontece nos planos 06-02 e 06-03, e o portal (que duplica os tokens inline em vez de carregar `shared/pmoc.css`) recebe o próprio bloco de tema claro no plano 06-03 (D-02). `refrigeracao/` e `mapa/xmap.css` permanecem intocados, confirmado por `git diff --name-only`.

---
*Phase: 06-tema-claro-escuro*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: shared/pmoc.css
- FOUND: shared/auth.js
- FOUND: .planning/phases/06-tema-claro-escuro/06-01-SUMMARY.md
- FOUND: d4084e2 (Task 1 commit)
- FOUND: cbcea63 (Task 2 commit)
