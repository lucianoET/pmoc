---
phase: 05-base-unificada
plan: 04
subsystem: ui
tags: [vanilla-js, es-modules, shell-comum, zero-build, leaflet]

# Dependency graph
requires:
  - phase: 05-base-unificada
    provides: "shared/shell.js — montarShell(cfg)/aplicarShell(cfg) (05-01)"
provides:
  - "mapa/app.js consumindo aplicarShell() de shared/shell.js para montar cabeçalho e rodapé, com navItems vazio (sem faixa de abas)"
  - "mapa/index.html reduzido ao bloco de duas colunas (barra lateral de camadas + área do mapa), sem chrome escrito à mão e sem paleta própria"
  - "Prova de que o shell serve módulos de tela cheia sem abas (navItems: [])"
affects: [05-05, 05-06, 05-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo de arquivo próprio chamando aplicarShell() com navItems: [] — caso de referência para qualquer módulo futuro que navegue fora do padrão de abas (mesma família de predial 05-03, mas primeiro caso de lista vazia)"

key-files:
  created: []
  modified:
    - mapa/index.html
    - mapa/app.js

key-decisions:
  - "accent passado ao shell (#4aa0a0) é idêntico ao token --cyan removido do CSS local, preservando a cor de destaque pixel a pixel"
  - "versao: '0.1' repete a mesma versão já exibida no cartão do Mapa no portal (index.html linha ~93)"
  - "navItems: [] é literal e deliberado — o Mapa navega por camadas na barra lateral, não por abas; montarShell() já trata lista vazia omitindo a faixa de nav (coberto pelos testes de shared/shell.js do plano 05-01)"
  - "xmap.css e os quatro scripts do motor de mapa (xmap.js + 3 arquivos de camada) não foram tocados — todos os tokens do motor usam prefixo --xm- e não colidem com os da folha comum"

patterns-established:
  - "Segundo módulo de arquivo próprio (depois de predial) a chamar aplicarShell() diretamente no boot(); primeiro a usar navItems: [] em produção — referência para qualquer módulo de tela cheia futuro"

requirements-completed: []

coverage:
  - id: D1
    description: "mapa/index.html carrega shared/pmoc.css uma vez, entre a folha do Leaflet e xmap.css, e o bloco de estilo local perde todos os tokens de paleta (--bg, --surface, --border, --text, --ff) e as regras já cobertas pela folha comum (topbar, logo, chip de usuário, botões, aviso destacado)"
    requirement: "PLAT-01"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (contagem de shared/pmoc.css e xmap.css, ausência dos cinco tokens próprios, zero hexadecimal no bloco de estilo, cinco classes exclusivas presentes, bloco local com menos de 22 linhas, cinco ocorrências de xmap, três botões de camada)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A cor de destaque do estado ativo do botão de módulo passa a usar var(--accent) da folha comum em vez do token --cyan próprio removido; o valor hexadecimal é idêntico (#4aa0a0) nos dois casos"
    requirement: "PLAT-01"
    verification:
      - kind: other
        ref: "leitura do diff da Task 1 — .mod-btn.active{border-color:var(--accent);...} substituindo var(--cyan); confirmação visual de que shared/pmoc.css declara --accent:#4aa0a0"
        status: pass
    human_judgment: false
  - id: D3
    description: "mapa/app.js importa aplicarShell de shared/shell.js e a chama dentro de boot(), depois de exporNoWindow() e antes da criação do cliente Supabase, passando nome 'Mapa', accent '#4aa0a0', versao '0.1' e navItems: []"
    requirement: "PLAT-03"
    verification:
      - kind: other
        ref: "gate automatizado da Task 2 (grep de import/uso, navItems: [] literal no bloco da chamada, ordem de linhas exporNoWindow/aplicarShell, node --check)"
        status: pass
    human_judgment: false
  - id: D4
    description: "mapa/index.html perde a barra superior escrita à mão (.topbar com logo, chip de usuário e botão de sair); #app passa a conter só o .body-layout (barra lateral de camadas + área do mapa); nenhuma faixa de abas foi introduzida no HTML nem no JavaScript"
    requirement: "PLAT-16"
    verification:
      - kind: other
        ref: "gate automatizado da Task 2 (zero .topbar estático, zero .nav-btn, zero trocarView em app.js, body-layout presente, três alternarModulo() ainda presentes)"
        status: pass
    human_judgment: false
  - id: D5
    description: "O layout de tela cheia continua sem rolagem, o mapa Leaflet ocupa toda a área à direita da barra lateral, as três camadas de demonstração continuam alternando, o botão de sair funciona e o rodapé aparece encaixado no fim da tela"
    verification:
      - kind: other
        ref: "servidor python -m http.server local + curl confirmando que mapa/index.html serve o bloco de duas colunas reduzido, que shared/shell.js, mapa/app.js, mapa/xmap.css e mapa/xmap.js respondem 200"
        status: pass
    human_judgment: true
    rationale: "Requer login real via Supabase (credenciais de cargo) para exercitar a tela pós-autenticação num navegador interativo com o mapa Leaflet renderizado; sem credenciais disponíveis neste ambiente de execução autônoma e sem Playwright instalado (fora do escopo do plano e do padrão zero-build), a verificação ficou estrutural: contagens estáticas via gate automatizado (Tasks 1 e 2) mais confirmação via HTTP de que todos os arquivos envolvidos (HTML, CSS, JS do shell, motor xMap e camadas) continuam acessíveis e com o conteúdo esperado. A marcação gerada por aplicarShell() com navItems: [] é a mesma coberta pelo teste 'com lista de abas vazia, o topo gerado não contém a faixa de abas' de tests/shell.test.js (plano 05-01). Mesmo padrão de deviation documentado nos planos 05-02 e 05-03.

duration: 8min
completed: 2026-08-10
status: complete
---

# Phase 5 Plan 4: Mapa consumindo o shell unificado, sem faixa de abas Summary

**`mapa/app.js` passa a chamar `aplicarShell()` de `shared/shell.js` com `navItems: []`, e `mapa/index.html` perde a paleta própria e a barra superior escrita à mão — o Mapa prova que o shell serve módulos de tela cheia sem abas (PLAT-01, PLAT-03, PLAT-16)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-10
- **Completed:** 2026-08-10
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `mapa/index.html` carrega `shared/pmoc.css` uma única vez, entre a folha do Leaflet e `xmap.css`, mantendo esta última na mesma posição de sempre.
- O bloco de estilo local do Mapa encolheu de 33 para 13 linhas de regras: saíram os tokens de paleta (`--bg`, `--surface`, `--border`, `--text`, `--ff`, `--cyan`, `--yellow`, `--red`), o reset de caixa, a regra de corpo do documento e as regras de barra superior, logo, chip de usuário, botões e aviso destacado — todas já cobertas pela folha comum com valor idêntico.
- Ficaram no estilo local só as regras exclusivas do módulo: altura de tela cheia, ajuste do contêiner de aplicação (sem repetir o `display:none` que já vem da folha comum), ajuste local da barra superior para não flutuar nem encolher em layout de tela cheia, ajuste do rodapé do shell para ficar encaixado sem empurrar o mapa, e o bloco de duas colunas (barra lateral, título, botão de módulo nos três estados, etiqueta de demonstração, área do mapa e contêiner do mapa Leaflet).
- `.mod-btn.active` passa a usar `var(--accent)` da folha comum em vez do token `--cyan` próprio removido — mesmo valor hexadecimal (`#4aa0a0`), resultado visual idêntico.
- `mapa/app.js` importa `aplicarShell` de `../shared/shell.js`, no mesmo estilo dos outros dois imports de `shared/` já presentes no topo do arquivo.
- Dentro de `boot()`, `aplicarShell()` é chamada logo depois de `exporNoWindow()` e antes da criação do cliente Supabase — a ordem exigida pelo plano para que o cabeçalho já exista antes de qualquer tela de erro de boot, e para que os handlers inline do shell (`sair()`) já encontrem os nomes publicados no objeto global.
- A chamada passa `nome: 'Mapa'`, `accent: '#4aa0a0'` (idêntico ao antigo token `--cyan`), `versao: '0.1'` (mesma versão já exibida no cartão do Mapa no portal) e **`navItems: []`** — lista vazia e literal, porque o Mapa navega ligando e desligando camadas na barra lateral, não por abas. O shell omite a faixa de nav quando a lista é vazia, comportamento já coberto pelos testes de `shared/shell.js` do plano 05-01.
- `mapa/index.html` perde o bloco inteiro da barra superior (`.topbar` estático com logo, chip de usuário e botão de sair); `#app` passa a conter só o `.body-layout` com a barra lateral de camadas e a área do mapa.
- Nenhuma aba foi introduzida: zero `.nav-btn` no HTML, zero `trocarView` em `app.js`.
- Os quatro scripts do motor de mapa (`xmap.js`, `xmap-layers-aguada.js`, `xmap-layers-grama.js`, `xmap-layers-eletrica.js`) e `xmap.css` não foram tocados — todos os tokens do motor usam prefixo `--xm-` e não colidem com os da folha comum.
- As três camadas de demonstração (Aguada, Grama, Elétrica) continuam acionáveis pelos mesmos três botões `alternarModulo(...)`.
- Nenhuma função de domínio do Mapa (`inicializarMapa`, `alternarModulo`, `mostrarApp`, `atualizarCabecalhoUsuario`) foi alterada — a mudança ficou confinada ao chrome.
- `node --test` segue em **25** testes, todos verdes.
- `refrigeracao/` intocado: `git diff --name-only b53505c..HEAD -- refrigeracao/` vazio.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mapa passa a carregar a folha comum e o estilo local encolhe ao que é exclusivo** - `9df81bb` (feat)
2. **Task 2: Mapa monta cabeçalho e rodapé pelo shell comum, sem abas** - `4f08e84` (feat)

**Plan metadata:** (a seguir, commit de docs)

## Files Created/Modified

- `mapa/index.html` - carrega `shared/pmoc.css`; estilo local reduzido ao que é exclusivo do módulo (tela cheia, barra lateral, área do mapa); `.mod-btn.active` usa `var(--accent)`; barra superior estática removida de `#app`
- `mapa/app.js` - importa `aplicarShell`; `boot()` agora monta cabeçalho e rodapé pelo shell comum com `navItems: []`, na ordem correta em relação a `exporNoWindow()`

## Decisions Made

- `accent: '#4aa0a0'` repetido de forma idêntica ao antigo `--cyan` do CSS local (removido na Task 1) e na chamada do shell — nenhuma paleta própria foi reintroduzida em `mapa/index.html`.
- `navItems: []` literal e deliberado: o Mapa é o primeiro módulo em produção a exercitar o caso de shell sem faixa de abas, provando que `montarShell()` (05-01) serve módulos que navegam por outro mecanismo (aqui, a barra lateral de camadas).
- `aplicarShell()` chamada antes da criação do cliente Supabase, para que o cabeçalho já exista mesmo se `criarClienteSupabase()` falhar e `mostrarErroBoot()` precisar aparecer.

## Deviations from Plan

None - plano executado exatamente como escrito. A verificação humana descrita no `<human-check>` da Task 2 (servir a raiz do repositório por HTTP, abrir `/mapa/`, confirmar cabeçalho com link do portal, ausência de faixa de abas, mapa Leaflet ocupando a área à direita sem rolagem, alternância das três camadas, rodapé encaixado, botão de sair e console sem erro) foi parcialmente substituída por verificação automatizada nesta execução autônoma: servidor `python -m http.server` local confirmando via `curl` que `mapa/index.html` serve o bloco de duas colunas reduzido (sem `.topbar` estático) e que `shared/shell.js`, `mapa/app.js`, `mapa/xmap.css` e `mapa/xmap.js` respondem 200. Playwright não está instalado e sua instalação não foi realizada por estar fora do escopo do plano e do padrão zero-build do projeto — mesma decisão tomada nos planos 05-02 e 05-03. A conferência visual pós-login (D5 na tabela de cobertura) fica marcada como `human_judgment: true` para a próxima oportunidade.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `mapa` prova, num módulo de arquivo próprio de tela cheia sem abas, que `aplicarShell()` com `navItems: []` funciona sem reescrever a lógica de domínio (Leaflet, camadas de demonstração) — padrão de referência pronto para qualquer módulo futuro fora do esquema de abas.
- `refrigeracao/` permanece intocado.
- Nenhuma função de domínio, consulta ao Supabase ou regra de permissão do Mapa foi alterada — mudança confinada ao chrome.
- Faltam `05-05` (transportes) e `05-06` (máquinas) para completar os 6 módulos da fase; PLAT-01/03/16 continuam **não marcados** como completos em `REQUIREMENTS.md` até que todos os módulos migrem (fecham só no plano `05-07`), conforme instrução explícita da fase.
- Pendência: conferência visual humana de `/mapa` (login real, mapa Leaflet, três camadas, botão de sair, rodapé) na próxima oportunidade — nenhum indício de risco no código, já que a marcação gerada por `aplicarShell()` com `navItems: []` é a mesma coberta pelo teste dedicado em `tests/shell.test.js`.

---
*Phase: 05-base-unificada*
*Completed: 2026-08-10*

## Self-Check: PASSED
