---
phase: 05-base-unificada
plan: 06
subsystem: ui
tags: [vanilla-js, es-modules, shell-comum, zero-build, maior-risco]

# Dependency graph
requires:
  - phase: 05-base-unificada
    provides: "shared/shell.js — montarShell(cfg)/aplicarShell(cfg) (05-01)"
  - phase: 05-base-unificada
    provides: "shared/auth.js — acesso Livre grava funcao=cargo.label (05-01, D-01)"
provides:
  - "maquinas/app.js consumindo Auth (shared/auth.js), criarClienteSupabase (shared/supabase-config.js) e aplicarShell (shared/shell.js)"
  - "maquinas/index.html carregado como o sexto e último módulo na base unificada — folha comum, sem paleta própria, sem login inline, sem chrome escrito à mão"
  - "maquinas/app.js como módulo ES com todos os handlers inline publicados via exporNoWindow(), prova de que o padrão dos outros cinco módulos também resolve o único caso que partia de script clássico"
affects: [05-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sexto e último módulo a chamar aplicarShell() no boot(), e o único que migrou de <script> clássico para type=module no mesmo commit — publicação explícita no objeto global (exporNoWindow) é obrigatória aqui, opcional nos outros cinco"

key-files:
  created: []
  modified:
    - maquinas/index.html
    - maquinas/app.js
    - tests/integracao-operacoes-maquinas.test.js

key-decisions:
  - "D-02 aplicada: --accent:#c9a84c é a única declaração de paleta que sobra em maquinas/index.html — mesma cor que o módulo já usava como destaque de aba ativa, botão primário, borda em foco e nome no logo; o ponto do logo passa de verde (regra local) para dourado (--accent do shell comum), efeito aceito e documentado no plano"
  - "D-01 aplicada: atualizarCabecalhoUsuario() lê USUARIO.funcao (com fallback para posto_graduacao e nome), reproduzindo o texto 'Livre · observador' que o módulo já exibia — combinado com o ajuste do plano 05-01 em shared/auth.js"
  - "SUPA_URL/SUPA_KEY permanecem declaradas em maquinas/app.js com comentário explicando a dependência de shared/supabase-config.js (descoberta por regex) — não removidas"
  - "maquinas/operacoes.js não foi tocado e continua <script> clássico antes de maquinas/app.js (type=module); a ordem é seguramente preservada porque scripts de módulo são adiados por definição"
  - "tests/integracao-operacoes-maquinas.test.js ajustado (Rule 1 — bug de verificação pré-existente descoberto durante a execução): o teste checava data-view=\"operacoes\"/\"agenda\" como markup estático de maquinas/index.html; desde este plano essas abas são geradas em runtime por aplicarShell() (shared/shell.js), então o teste passou a checar id=\"view-operacoes\"/\"view-agenda\" no HTML e a configuração id:'operacoes'/id:'agenda' em app.js — mesma cobertura, mesma garantia de que operações e agenda continuam expostas"

patterns-established:
  - "Único módulo da fase migrado de <script> clássico para type=module no mesmo commit da adoção do login/shell compartilhados — exporNoWindow() deixa de ser 'boa prática' (como nos outros cinco) e passa a ser requisito estrutural, coberto por gate de extração dinâmica"

requirements-completed: []

coverage:
  - id: D1
    description: "maquinas/index.html carrega shared/pmoc.css uma vez; bloco de estilo local reduzido às famílias exclusivas do módulo (barra de uso, cartões de vencimento, lista de compras, operações/kanban/cartão de operação, calendário) e às seis divergências preservadas (largura do main, largura do modal, afastamento/ícone do estado vazio, coluna mínima do grid de KPI, h3 global, hover de linha de tabela); os seis tokens de paleta própria (--bg/--surface/--border/--text/--ff/--orange) desapareceram"
    requirement: "PLAT-01"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (contagem de shared/pmoc.css=1, ausência dos seis tokens próprios, bloco de estilo local com menos de 90 linhas, presença das seis famílias exclusivas e dos dois overrides de largura)"
        status: pass
    human_judgment: false
  - id: D2
    description: "--accent:#c9a84c é a única declaração de cor de destaque em maquinas/index.html; a cor semântica de verde (--green:#5a9e6f) não foi promovida a --accent por engano; o token semântico de verde continua disponível pela folha comum, e as duas regras locais que dependem dele (uso-bar, venc-card.ok) continuam referenciando var(--green)"
    requirement: "PLAT-01"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (grep de --accent:#c9a84c, contagem zero de --accent:#5a9e6f, grep de --green:#5a9e6f em shared/pmoc.css, grep de var(--green) no bloco de estilo local)"
        status: pass
    human_judgment: false
  - id: D3
    description: "maquinas/app.js importa Auth de shared/auth.js, cria a instância com new Auth(...), e não contém mais nenhum vestígio do fluxo de login inline (array de cargos, renderLogin, loginCargo, loginEmail, mostrarStepEmail, voltarCargos) nem e-mail de cargo (@cmasm.local); as duas constantes de configuração do Supabase continuam declaradas e comentadas"
    requirement: "PLAT-02"
    verification:
      - kind: other
        ref: "gate automatizado da Task 2 (grep de shared/auth.js e new Auth(, contagem zero dos cinco nomes do login antigo, contagem zero de @cmasm.local, presença de const SUPA_URL/SUPA_KEY)"
        status: pass
    human_judgment: false
  - id: D4
    description: "maquinas/app.js chama aplicarShell() dentro de boot(), depois de exporNoWindow(), passando nome 'Máquinas', accent '#c9a84c' (idêntico ao declarado no CSS local), versao '1.0' (mesma do cartão do portal) e as dez abas na ordem/rótulos/emojis originais, com painel ativa; maquinas/index.html perdeu a barra superior e a faixa de abas estáticas e passou a carregar app.js como módulo ES, com maquinas/operacoes.js intocado e ainda como script clássico antes dele"
    requirement: "PLAT-03"
    verification:
      - kind: other
        ref: "gate automatizado da Task 2 (dez ocorrências de id: no bloco aplicarShell, cor idêntica entre CSS e chamada do shell, ausência de .topbar/.nav estáticos, tag type=module + script clássico de operacoes.js na ordem correta, ordem exporNoWindow()<aplicarShell() por número de linha, git diff vazio em maquinas/operacoes.js)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Gate crítico dos handlers inline (T-05-21): extração dinâmica dos nomes usados em onclick/onchange/oninput/onsubmit/onkeydown em maquinas/index.html e maquinas/app.js encontra 22 nomes distintos (não os >=23 previstos no texto do plano), e todos os 22 estão publicados em exporNoWindow(); os dois nomes que fariam o total chegar a 24 no cálculo original do plano — sair e trocarView — deixaram de aparecer como texto literal porque migraram para o markup gerado em runtime por shared/shell.js (mesma arquitetura já usada pelos outros cinco módulos), mas ambos continuam publicados manualmente em exporNoWindow(), então a garantia real da ameaça (nenhum handler acionável fica sem função no objeto global) permanece integralmente satisfeita"
    requirement: "PLAT-16"
    verification:
      - kind: other
        ref: "gate automatizado da Task 2 (extração dinâmica + verificação de que os 22 nomes extraídos estão todos no bloco de exporNoWindow — zero ausências); verificação manual adicional de que sair e trocarView, usados pelo markup gerado por aplicarShell(), também estão publicados"
        status: pass
    human_judgment: false
  - id: D6
    description: "O acesso Livre continua exibindo 'Livre · observador' (D-01); as dez abas, os modais, o kanban, a agenda, o estoque, o consumo e a exportação CSV continuam funcionando visualmente, sem erro de referência no console"
    verification: []
    human_judgment: true
    rationale: "Mesma limitação estrutural documentada nos planos 05-02 a 05-05: login real via Supabase e clique interativo nos dez fluxos exigem um navegador com sessão válida; Playwright não está instalado (fora do escopo zero-build) e não foi instalado agora. Verificação estrutural feita nesta execução: servidor `python -m http.server` local confirmando 200 em maquinas/index.html, maquinas/app.js, maquinas/operacoes.js, shared/auth.js, shared/shell.js, shared/supabase-config.js e shared/pmoc.css; os testes automatizados de shared/shell.js (plano 05-01) já cobrem a marcação exata que aplicarShell() gera. Roteiro humano completo (dez abas, login por cargo, chip do observador, rodapé) fica pendente para a próxima oportunidade com sessão real."
duration: 35min
completed: 2026-08-11
status: complete
---

# Phase 5 Plan 6: Máquinas migra para a base unificada — o módulo de maior risco Summary

**`maquinas/app.js` passa a consumir `Auth`, `criarClienteSupabase` e `aplicarShell` de `shared/`, migrando de `<script>` clássico para `type="module"` no mesmo commit — o único módulo da fase que partia com login inline duplicado, paleta própria e chrome escrito à mão, e o único que exigiu a publicação explícita dos handlers no objeto global (`exporNoWindow`) como requisito estrutural, não como boa prática (PLAT-01, PLAT-02, PLAT-03, PLAT-16)**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-10
- **Completed:** 2026-08-11
- **Tasks:** 2
- **Files modified:** 3 (2 do plano + 1 ajuste de teste pré-existente, deviation documentada)

## Accomplishments

- `maquinas/index.html` carrega `shared/pmoc.css` por link relativo (`../shared/pmoc.css`); o bloco de estilo local caiu de ~180 para 66 linhas, guardando só `--accent:#c9a84c`, as seis famílias exclusivas do módulo (barra de uso, cartões de vencimento, lista de compras, ações/espaçamento de operações, kanban/cartão de operação, calendário) e as seis divergências preservadas (largura do `.main`, largura do `.modal`, afastamento/ícone do `.empty`, coluna mínima do `.kpi-row`, `h3` global, hover de linha de `.tbl`).
- As cinco regras de estilo do login antigo (`login-card`, `login-logo`, `login-sub`, `login-err`, `login-toggle`) foram removidas — a pesquisa da fase já havia confirmado que nenhum arquivo as referenciava.
- `maquinas/app.js` importa `Auth` de `shared/auth.js`, `criarClienteSupabase` de `shared/supabase-config.js` e `aplicarShell` de `shared/shell.js`. O fluxo de login inline inteiro (array `CARGOS` duplicado, IIFE de `renderLogin`, `selecionarCargo`, `loginCargo`, `loginEmail`, `mostrarStepEmail`, `voltarCargos`, checagem de sessão e `onAuthStateChange` manuais) foi removido por completo — zero e-mail de cargo (`@cmasm.local`) restante no arquivo.
- As duas constantes `SUPA_URL`/`SUPA_KEY` continuam declaradas, agora com comentário explicando que `shared/supabase-config.js` as descobre por expressão regular para os outros cinco módulos; o cliente Supabase do próprio módulo passou a ser criado por `criarClienteSupabase()` dentro de `boot()`, com tratamento de erro que escreve um aviso na tela de login em caso de falha.
- `atualizarCabecalhoUsuario()` (padrão do módulo Transportes) lê `USUARIO.funcao` com fallback para `posto_graduacao` e `nome`, reproduzindo exatamente o texto `"Livre · observador"` que o acesso Livre já exibia — combinado com o ajuste feito em `shared/auth.js` no plano 05-01 (D-01).
- `exporNoWindow()` publica os 24 nomes necessários no objeto global (22 encontrados por extração dinâmica em `maquinas/index.html` + `maquinas/app.js`, mais `sair` e `trocarView`, que passaram a viver só no markup gerado em runtime por `shared/shell.js`) — a extração confirma que nenhum dos 22 nomes literais ficou de fora da publicação.
- `boot()` segue a ordem exigida: `exporNoWindow()` → `aplicarShell({ nome: 'Máquinas', accent: '#c9a84c', versao: '1.0', navItems: [...dez abas...] })` → `fecharAoClicarFora()` (antes uma expressão solta no meio do arquivo, agora função própria chamada no boot) → criação do cliente Supabase com tratamento de erro → instância de `Auth` → `auth.mount('#login-screen')` → checagem de sessão.
- `maquinas/index.html` perdeu o bloco inteiro da barra superior (`.topbar`) e da faixa de abas (`.nav`) escritas à mão; `#app` ficou só com `.main` e as dez views, com todos os ids intactos. Os modais continuam fora do contêiner de aplicação, intocados.
- `maquinas/app.js` passou a ser carregado como `type="module"`; `maquinas/operacoes.js` não foi tocado e continua `<script>` clássico, na mesma posição, antes do app — ordem segura porque scripts de módulo são adiados por definição e `globalThis.OperacoesMaq` já existe quando o app roda.
- Nenhuma função de domínio do módulo (ativos, planos, OS, materiais, operações, agenda, consumo, ciclo de vida, compras) foi alterada.
- `node --test` segue em **25** testes, todos verdes (com o ajuste documentado abaixo em `tests/integracao-operacoes-maquinas.test.js`).
- `refrigeracao/` intocado: `git diff --name-only b53505c..HEAD -- refrigeracao/` vazio.

## Task Commits

Each task was committed atomically:

1. **Task 1: Máquinas adota a folha comum e a cor de destaque decidida (D-02)** - `310e770` (feat)
2. **Task 2: Máquinas migra para o login e o shell compartilhados, virando módulo ES com handlers publicados** - `a33351c` (feat, inclui o ajuste de teste descrito abaixo)

**Plan metadata:** (a seguir, commit de docs)

## Files Created/Modified

- `maquinas/index.html` - carrega `shared/pmoc.css`; bloco de estilo local reduzido; cinco regras do login antigo removidas; barra superior e faixa de abas estáticas removidas; `app.js` carregado como `type="module"`, `operacoes.js` continua clássico e antes
- `maquinas/app.js` - importa `Auth`/`criarClienteSupabase`/`aplicarShell`; login inline removido; `atualizarCabecalhoUsuario()`, `fecharAoClicarFora()`, `exporNoWindow()`, `mostrarErroBoot()` e `boot()` criados; `SUPA_URL`/`SUPA_KEY` preservadas com comentário
- `tests/integracao-operacoes-maquinas.test.js` - ajuste de deviation (ver abaixo): troca de `data-view="operacoes"/"agenda"` (markup estático) por `id="view-operacoes"/"view-agenda"` + configuração `id:'operacoes'/id:'agenda'` em `app.js`

## Decisions Made

- A cor de destaque (`#c9a84c`) é declarada de forma idêntica no CSS local e na chamada de `aplicarShell()`, confirmada por gate automatizado comparando os dois valores — nenhuma paleta própria foi reintroduzida.
- `atualizarCabecalhoUsuario()` foi escrita no mesmo formato do módulo Transportes (fallback funcao → posto_graduacao → nome) para garantir que o texto do observador Livre não mudasse (D-01).
- `fecharAoClicarFora()` virou função nomeada, chamada dentro de `boot()` depois de `aplicarShell()` — antes era uma expressão solta executada no carregamento do script, incompatível com o novo `boot()` assíncrono que monta o shell primeiro.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug de verificação pré-existente] `tests/integracao-operacoes-maquinas.test.js` checava markup estático que a própria arquitetura da fase elimina**
- **Encontrado durante:** verificação da Task 2, ao rodar `node --test` após remover a barra de abas estática de `maquinas/index.html`
- **Problema:** o teste `'expõe operações, agenda e os três formulários do fluxo'` verificava `data-view="operacoes"` e `data-view="agenda"` como texto literal em `maquinas/index.html`. Esses atributos só existiam porque a faixa de abas era escrita à mão no HTML; a partir deste plano, a faixa de abas é gerada em tempo de execução por `aplicarShell()` (`shared/shell.js`) — o mesmo padrão já usado pelos outros cinco módulos, nenhum dos quais tem faixa de abas estática no HTML.
- **Fix:** o teste passou a verificar `id="view-operacoes"`/`id="view-agenda"` (as views continuam estáticas e intocadas) e, adicionalmente, a configuração `id:'operacoes'`/`id:'agenda'` dentro do array `navItems` de `aplicarShell()` em `maquinas/app.js` — preservando exatamente a mesma garantia original ("operações e agenda estão expostas no módulo"), agora verificada pelos marcadores corretos pós-migração.
- **Arquivos modificados:** `tests/integracao-operacoes-maquinas.test.js`
- **Commit:** `a33351c`

### Discrepância documentada (sem fix de código — ver rationale)

**2. Gate crítico dos handlers: extração encontra 22 nomes, não os ≥23 previstos no texto do plano**
- **Encontrado durante:** verificação final da Task 2
- **Situação:** a extração dinâmica de `on(click|change|input|submit|keydown)=` em `maquinas/index.html` + `maquinas/app.js` encontra 22 nomes distintos (listados no item de cobertura D5 acima), abaixo do piso de 23 escrito no texto do plano e no seu script `<automated>`. Todos os 22 nomes extraídos estão publicados em `exporNoWindow()` — a checagem crítica de ausência (`FALTA=0`) passa integralmente.
- **Causa raiz:** o cálculo original do plano (extração pré-migração encontrou 28 nomes no total, dos quais 4 eram do login antigo, sobrando 24 esperados) não considerou que **dois nomes adicionais** — `sair` e `trocarView` — deixariam de aparecer como texto literal em `maquinas/index.html`/`maquinas/app.js` assim que a barra superior e a faixa de abas estáticas (onde esses dois `onclick=` viviam) fossem substituídas pelo markup gerado em runtime por `shared/shell.js`. Essa é exatamente a mesma arquitetura já adotada nos cinco módulos anteriores (confirmada em `transportes/app.js`, que também publica `sair` e `trocarView` em `exporNoWindow()` sem que apareçam como texto literal em `transportes/index.html`); os planos desses cinco módulos, aliás, não tinham um piso numérico fixo equivalente neste gate — só checagens de presença/ordem — o que sugere que o piso "≥23" foi uma estimativa específica deste plano que não recalculou o efeito da migração do chrome.
- **Por que não foi corrigido no código:** a garantia real que o gate protege — nenhum handler acionável fica sem função no objeto global (mitigação de T-05-21) — está **integralmente satisfeita**: os 22 nomes extraídos estão todos publicados, e os dois nomes que "sumiriam" da contagem (`sair`, `trocarView`) foram publicados de forma proativa em `exporNoWindow()` porque são exigidos pelo markup que `aplicarShell()` gera. Forçar a contagem a bater com 23 exigiria reintroduzir texto `onclick=` morto ou redundante em `maquinas/index.html`/`maquinas/app.js` só para satisfazer o regex do gate — o que contradiria a própria Task 1/2 do plano (remover o chrome escrito à mão) sem nenhum ganho de segurança real.
- **Impacto:** nenhum. Roteiro humano da Task 2 (clicar em todos os botões das dez abas) é a verificação definitiva deste ponto e fica pendente como item de verificação humana (ver D6).

## Issues Encountered

Nenhum bloqueador além do documentado acima. `node --test` permanece em 25/25 após o ajuste do teste.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Os seis módulos da base unificada (predial, mapa, elétrica/fonoclama via `modulo-manutencao.js`, transportes e agora máquinas) consomem `shared/shell.js`, `shared/pmoc.css` e `shared/auth.js` de forma consistente — máquinas era o único caso com login inline duplicado, paleta própria e chrome escrito à mão, e também o único que migrou de `<script>` clássico para módulo ES no mesmo commit.
- `refrigeracao/` permanece intocado durante toda a fase.
- PLAT-01/02/03/16 ficam **prontos para fechar** no plano `05-07` (não marcados aqui, conforme instrução explícita da fase — os requisitos só fecham quando os seis módulos estiverem confirmados juntos).
- Pendência: roteiro humano completo de `/maquinas` (login real por cargo, dez abas, kanban, agenda, estoque, consumo, ciclo de vida, lista de compras, chip "Livre · observador", rodapé, console sem erro de referência) na próxima oportunidade com sessão Supabase real — mesma pendência estrutural documentada nos planos 05-02 a 05-05.
- Pendência: revisão do piso numérico do gate de handlers (documentada acima) pode informar o plano 05-07 ou uma futura correção de `05-06-PLAN.md`, caso o coordenador da fase quiera alinhar o texto do plano ao comportamento real da arquitetura.

---
*Phase: 05-base-unificada*
*Completed: 2026-08-11*

## Self-Check: PASSED
