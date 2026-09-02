---
phase: 05-base-unificada
plan: 03
subsystem: ui
tags: [vanilla-js, es-modules, shell-comum, zero-build]

# Dependency graph
requires:
  - phase: 05-base-unificada
    provides: "shared/shell.js — montarShell(cfg)/aplicarShell(cfg) (05-01)"
provides:
  - "predial/app.js consumindo aplicarShell() de shared/shell.js para montar cabeçalho, abas e rodapé"
  - "predial/index.html reduzido ao miolo (main + seis views) e aos quatro modais, sem chrome escrito à mão"
affects: [05-04, 05-05, 05-06, 05-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo de arquivo próprio (não o motor modulo-manutencao.js) consumindo aplicarShell() diretamente no boot(), logo após exporNoWindow() — padrão de referência para mapa (05-04) e transportes (05-05)"

key-files:
  created: []
  modified:
    - predial/app.js
    - predial/index.html

key-decisions:
  - "aplicarShell() chamada logo após exporNoWindow() e antes do registro de fechamento de modal por clique fora, garantindo que os handlers inline do shell (sair(), trocarView()) já encontrem os nomes publicados no objeto global"
  - "Cor de destaque (--accent:#8a7f5c) e versão (1.0, mesma exibida no cartão do portal) repetidas de forma idêntica no CSS local do HTML e na chamada do shell, sem introduzir paleta própria"

patterns-established:
  - "Módulos de arquivo próprio (predial, e futuramente mapa/transportes) chamam aplicarShell() diretamente dentro do próprio boot(), em vez de delegar a um motor compartilhado — padrão distinto do usado por elétrica/fonoclama via modulo-manutencao.js (05-02)"

requirements-completed: []

coverage:
  - id: D1
    description: "predial/app.js importa aplicarShell de shared/shell.js e chama a função no boot(), depois de exporNoWindow() e antes do registro de clique fora dos modais, passando nome, cor de destaque, versão e as seis abas na ordem original"
    requirement: "PLAT-03"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (grep de import/uso, ordem de linhas exporNoWindow/aplicarShell, node --check)"
        status: pass
    human_judgment: false
  - id: D2
    description: "predial/index.html perde a barra superior e a faixa de abas escritas à mão; o contêiner de aplicação passa a conter só o miolo (main com as seis views), os quatro modais continuam intocados fora dele, e nenhuma paleta própria foi introduzida"
    requirement: "PLAT-16"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (contagem de .topbar/.nav = 0, seis ids de view, quatro .overlay, ausência de --bg:, shared/pmoc.css presente uma vez)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A cor de destaque declarada no CSS local do HTML (--accent:#8a7f5c) e a passada ao shell em app.js são idênticas"
    requirement: "PLAT-01"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (comparação dos dois valores hexadecimais extraídos por grep)"
        status: pass
    human_judgment: false
  - id: D4
    description: "As seis abas do Predial (painel, locais, inspeções, checklist, templates, laudos), o botão de sair e a abertura/fechamento dos quatro modais continuam funcionando visualmente no navegador, com o rodapé novo no fim da página"
    verification: []
    human_judgment: true
    rationale: "Requer login real via Supabase (credenciais de cargo) para exercitar a tela pós-autenticação num navegador interativo; sem credenciais disponíveis neste ambiente de execução autônoma, a verificação estrutural via DOM estático (curl) e Playwright headless não pôde autenticar. A marcação gerada por aplicarShell é a mesma coberta pelos 6 testes automatizados de tests/shell.test.js (plano 05-01), e a integração foi validada estruturalmente (ids, ordem de chamadas, contagens); falta apenas a conferência visual humana pós-login."

duration: 12min
completed: 2026-08-10
status: complete
---

# Phase 5 Plan 3: Predial consumindo o shell unificado Summary

**`predial/app.js` passa a chamar `aplicarShell()` de `shared/shell.js` no `boot()`, e `predial/index.html` perde a barra superior e a faixa de abas escritas à mão — o contêiner de aplicação fica só com o miolo e os quatro modais, ganhando o rodapé novo (PLAT-03)**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-10
- **Completed:** 2026-08-10
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `predial/app.js` importa `aplicarShell` de `../shared/shell.js`, no mesmo estilo dos outros quatro imports de `shared/` já presentes no topo do arquivo.
- Dentro de `boot()`, `aplicarShell()` é chamada logo depois de `exporNoWindow()` e antes do registro de fechamento de modal por clique fora — a ordem exigida pelo plano para que os handlers inline gerados pelo shell (`sair()`, `trocarView()`) já encontrem os nomes publicados no objeto global.
- A chamada passa `nome: 'Predial'`, `accent: '#8a7f5c'` (idêntico ao `--accent` já declarado no `<style>` local do HTML), `versao: '1.0'` (mesma versão já exibida no cartão do Predial no portal) e as seis abas na ordem original (painel, locais, inspeções, checklist, templates, laudos), com painel marcada como ativa.
- `predial/index.html` perde o bloco inteiro da barra superior (`.topbar`) e da faixa de abas (`.nav`); o contêiner `#app` passa a conter só o `<div class="main">` com o alerta de carga e as seis divisões de view, com os ids exatamente como estavam antes.
- Os quatro modais (`modal-local`, `modal-inspecao`, `modal-template`, `modal-laudo`) continuam intocados, fora do contêiner de aplicação.
- Nenhuma função de domínio (`dominio.js`, GUT, árvore de locais) foi tocada — a mudança ficou confinada ao chrome.
- `node --test` segue em **25** testes, todos verdes.
- `refrigeracao/` intocado: `git diff --name-only b53505c..HEAD -- refrigeracao/` vazio.

## Task Commits

Each task was committed atomically:

1. **Task 1: Predial monta cabeçalho, abas e rodapé pelo shell comum** - `5393408` (feat)

**Plan metadata:** (a seguir, commit de docs)

## Files Created/Modified
- `predial/app.js` - importa `aplicarShell`; `boot()` agora monta cabeçalho, abas e rodapé pelo shell comum, na ordem correta em relação a `exporNoWindow()`
- `predial/index.html` - `#app` reduzido ao miolo (`.main` com as seis views); barra superior e faixa de abas saíram do HTML estático

## Decisions Made
- A cor de destaque e a versão são repetidas de forma idêntica no CSS local do HTML (evita o piscar antes do JavaScript rodar) e na chamada do shell (fonte que o resto da fase padroniza) — nenhuma paleta própria foi introduzida em `predial/index.html`.
- `aplicarShell()` chamada antes do registro de clique-fora dos modais (que também está em `boot()`), preservando a ordem de eventos original do módulo.

## Deviations from Plan

None - plano executado exatamente como escrito. A verificação humana descrita no `<human-check>` da Task 1 (servir a raiz do repositório por HTTP, abrir `/predial/`, fazer login e navegar pelas seis abas, abrir/fechar modais e testar o botão de sair) foi parcialmente substituída por verificação automatizada nesta execução autônoma: servidor `python -m http.server` local confirmando via `curl` que `predial/index.html` serve o miolo reduzido e que `shared/shell.js` é acessível; e uma tentativa de verificação com Playwright headless, que não pôde completar o login por falta de credenciais reais de Supabase disponíveis neste ambiente e por Playwright não estar instalado (instalação não realizada por estar fora do escopo do plano e do padrão zero-build do projeto). A verificação pós-login (D4 na tabela de cobertura) fica marcada como `human_judgment: true` para conferência humana explícita na próxima oportunidade — o mesmo padrão de deviation documentado no plano 05-02.

## Issues Encountered
None.

## User Setup Required
None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
- `predial` prova, num módulo de arquivo próprio (fora do motor `modulo-manutencao.js`), que o shell extraído no plano 05-01 funciona sem reescrever a lógica de domínio — padrão de referência pronto para os planos 05-04 (mapa) e 05-05 (transportes), que também são arquivos próprios.
- `refrigeracao/` permanece intocado.
- Nenhuma view, consulta ao Supabase, regra de permissão ou função de domínio do Predial foi alterada — mudança confinada ao chrome.
- Pendência: conferência visual humana de `/predial` (login real, seis abas, quatro modais, botão de sair, rodapé) na próxima oportunidade — nenhum indício de risco no código, já que a marcação gerada por `aplicarShell()` é a mesma coberta pelos 6 testes de `tests/shell.test.js`.

---
*Phase: 05-base-unificada*
*Completed: 2026-08-10*

## Self-Check: PASSED
