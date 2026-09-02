---
phase: 05-base-unificada
plan: 05
subsystem: ui
tags: [vanilla-js, es-modules, shell-comum, zero-build]

# Dependency graph
requires:
  - phase: 05-base-unificada
    provides: "shared/shell.js — montarShell(cfg)/aplicarShell(cfg) (05-01)"
provides:
  - "transportes/app.js consumindo aplicarShell() de shared/shell.js para montar cabeçalho, abas e rodapé"
  - "transportes/index.html reduzido ao miolo (main + sete views) e aos seis modais, sem chrome escrito à mão e sem paleta própria"
  - "shared/pmoc.css com .b-accent alinhada ao padrão de fundo tintado das demais famílias de badge"
affects: [05-06, 05-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Terceiro módulo de arquivo próprio (depois de predial e mapa) a chamar aplicarShell() diretamente no boot(), logo após exporNoWindow(); primeiro a exercitar a aposentadoria completa de uma família de marca própria (--cyan/kc-cyan/b-cyan) em favor da folha comum"

key-files:
  created: []
  modified:
    - shared/pmoc.css
    - transportes/index.html
    - transportes/app.js

key-decisions:
  - "accent passado ao shell (#4aa0a0) é idêntico ao antigo token --cyan removido do CSS local e ao --accent declarado no bloco de estilo local do HTML — nenhuma paleta própria foi reintroduzida"
  - "versao: '1.0' repete a mesma versão já exibida no cartão do Transportes no portal (index.html linha ~69)"
  - ".b-accent em shared/pmoc.css passou a usar color-mix(in srgb, var(--accent) 15%, transparent) em vez do fundo branco a 7% que tinha antes, igualando-a às irmãs .b-ok/.b-warn/.b-red/.b-blue; como nenhum módulo usava essa classe antes desta mudança, a alteração não teve efeito colateral em nenhum módulo já migrado"
  - "aplicarShell() chamada logo após exporNoWindow() e antes de fecharAoClicarFora() (que já existia em boot()), preservando a ordem de eventos original e garantindo que os handlers inline do shell (sair(), trocarView()) já encontrem os nomes publicados no objeto global"

patterns-established:
  - "Terceiro módulo de arquivo próprio a chamar aplicarShell() diretamente no boot() (depois de predial 05-03 e mapa 05-04); primeiro caso documentado de remoção completa de uma paleta de marca própria pré-existente com três pontos de uso (token CSS, HTML estático, template literal JS)"

requirements-completed: []

coverage:
  - id: D1
    description: "transportes/index.html carrega shared/pmoc.css e o bloco de estilo local guarda apenas --accent:#4aa0a0; os cinco tokens de paleta própria (--bg, --surface, --border, --text, --ff) e todas as regras de seletor que existiam no bloco antigo desapareceram, cobertas pela folha comum"
    requirement: "PLAT-01"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (contagem de shared/pmoc.css=1, ausência dos cinco tokens próprios, zero regras de seletor no <style> local, --accent declarado)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A família de marca própria (--cyan, kc-cyan, b-cyan) tem contagem zero em transportes/index.html e transportes/app.js; os três usos de KPI viraram kc-accent (definição de linha, dois usos no painel, um em relatórios — total de três) e o badge de sobreaviso no mapa de status virou b-accent"
    requirement: "PLAT-01"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (grep -ro de --cyan|kc-cyan|b-cyan em transportes/ = 0; grep -c kc-accent em index.html = 3; grep -q b-accent em app.js)"
        status: pass
    human_judgment: false
  - id: D3
    description: "shared/pmoc.css: .b-accent passa a ter fundo tintado via color-mix, igual às demais famílias de badge, preservando a aparência do badge de sobreaviso do Transportes; nenhum módulo já migrado usava essa classe antes, então não há regressão"
    requirement: "PLAT-01"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (sed + grep confirmando color-mix na regra .b-accent); node --test 25/25 verde após a mudança compartilhada"
        status: pass
    human_judgment: false
  - id: D4
    description: "transportes/app.js importa aplicarShell de shared/shell.js e a chama dentro de boot(), depois de exporNoWindow() e antes de fecharAoClicarFora(), passando nome 'Transportes', accent '#4aa0a0', versao '1.0' e as sete abas (painel, ativos/Frota, viagens, manutencao, planos, estoque, relatorios) na ordem e rótulos originais, com painel ativa"
    requirement: "PLAT-03"
    verification:
      - kind: other
        ref: "gate automatizado da Task 2 (grep de import/uso, sete ocorrências de id: no bloco aplicarShell, ordem de linhas exporNoWindow/aplicarShell, node --check)"
        status: pass
    human_judgment: false
  - id: D5
    description: "transportes/index.html perde a barra superior (.topbar) e a faixa de abas (.nav) escritas à mão; #app passa a conter só o .main com as sete views e, fora dele, os seis modais intocados; nenhum id usado pelo JavaScript foi removido ou renomeado"
    requirement: "PLAT-16"
    verification:
      - kind: other
        ref: "gate automatizado da Task 2 (zero .topbar/.nav estáticos, sete ids de view presentes, seis botões controlados por permissão presentes, csvSeguro e shared/auth.js intactos)"
        status: pass
    human_judgment: false
  - id: D6
    description: "O layout, as sete abas na ordem/rótulos originais, os seis modais, a checagem de permissão por cargo (aplicarPermissoes) e a exportação CSV protegida (csvSeguro) continuam funcionando visualmente no navegador, com o rodapé novo no fim da página"
    verification: []
    human_judgment: true
    rationale: "Requer login real via Supabase (credenciais de cargo) para exercitar a tela pós-autenticação num navegador interativo; sem credenciais disponíveis neste ambiente de execução autônoma e sem Playwright instalado (fora do escopo do plano e do padrão zero-build do projeto), a verificação ficou estrutural: gates automatizados das Tasks 1 e 2 mais confirmação via `python -m http.server` + curl de que transportes/index.html serve o miolo reduzido (sem .topbar/.nav estáticos) e que shared/shell.js, shared/pmoc.css e transportes/app.js respondem 200. A marcação gerada por aplicarShell() é a mesma coberta pelos testes de tests/shell.test.js (plano 05-01). Mesmo padrão de deviation documentado nos planos 05-02, 05-03 e 05-04.

duration: 20min
completed: 2026-08-10
status: complete
---

# Phase 5 Plan 5: Transportes consumindo o shell unificado, aposentando a marca --cyan Summary

**`transportes/app.js` passa a chamar `aplicarShell()` de `shared/shell.js`, e `transportes/index.html` perde a paleta própria (`--cyan`/`kc-cyan`/`b-cyan`) e o chrome escrito à mão — o Transportes prova a aposentadoria completa de uma família de marca própria em três pontos de uso, com `shared/pmoc.css` ganhando badge de destaque tintado (PLAT-01, PLAT-03, PLAT-16)**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10
- **Completed:** 2026-08-10
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `transportes/index.html` carrega `shared/pmoc.css` uma única vez, por caminho relativo (`../shared/pmoc.css`); o bloco de estilo local encolheu do inteiro subconjunto quase literal da folha comum (~90 linhas) para uma única declaração: `:root{--accent:#4aa0a0}`.
- Os três usos da classe de KPI de marca própria (`kc-cyan`) — dois no painel (Ativos, Viagens) e um em Relatórios (Viagens registradas) — viraram `kc-accent`, a classe que a folha comum já define.
- O único uso no JavaScript, no mapa `STATUS_BADGE` de `transportes/app.js` (`sobreaviso: 'b-cyan'`), virou `sobreaviso: 'b-accent'` — o terceiro e último lugar onde o nome de marca própria vivia, confirmando a contagem zero exigida pelo gate.
- `shared/pmoc.css`: `.b-accent` deixou de ser a exceção da família de badges (fundo branco a 7%) e passou a usar `color-mix(in srgb, var(--accent) 15%, transparent)`, igual a `.b-ok`/`.b-warn`/`.b-red`/`.b-blue`, preservando exatamente a aparência do badge de sobreaviso do Transportes de antes da migração. Como nenhum módulo já migrado usava essa classe, a mudança compartilhada não teve efeito colateral nos quatro módulos anteriores (`node --test` seguiu em 25/25 verdes).
- `transportes/app.js` importa `aplicarShell` de `../shared/shell.js`, no mesmo estilo dos outros dois imports de `shared/` já presentes no topo do arquivo.
- Dentro de `boot()`, `aplicarShell()` é chamada logo depois de `exporNoWindow()` e antes de `fecharAoClicarFora()` — a ordem exigida pelo plano para que os handlers inline gerados pelo shell (`sair()`, `trocarView()`) já encontrem os nomes publicados no objeto global.
- A chamada passa `nome: 'Transportes'`, `accent: '#4aa0a0'` (idêntico ao antigo `--cyan` e ao `--accent` do CSS local), `versao: '1.0'` (mesma versão já exibida no cartão do Transportes no portal) e as sete abas na ordem original — painel, ativos (rótulo "Frota"), viagens, manutencao, planos, estoque, relatorios — com painel marcada como ativa. O identificador da segunda aba (`ativos`) é diferente do rótulo visível ("Frota"), preservado exatamente como estava no HTML original.
- `transportes/index.html` perde o bloco inteiro da barra superior (`.topbar` com logo, chip de usuário e botão de sair) e da faixa de abas (`.nav` com os sete botões); `#app` passa a conter só o `.main` com as sete views, com todos os ids exatamente como estavam.
- Os seis modais (`modal-ativo`, `modal-viagem`, `modal-manutencao`, `modal-plano`, `modal-material`, `modal-movimento`) continuam intocados, fora do contêiner de aplicação.
- Nenhuma função de domínio do Transportes (frota, viagens, manutenção, planos, estoque, relatórios) foi alterada — a mudança ficou confinada ao chrome e aos nomes de classe de estilo.
- A proteção contra injeção de fórmula na exportação CSV (`csvSeguro()`) continua intacta e sem alteração.
- `node --test` segue em **25** testes, todos verdes.
- `refrigeracao/` intocado: `git diff --name-only b53505c..HEAD -- refrigeracao/` vazio.

## Task Commits

Each task was committed atomically:

1. **Task 1: Transportes adota a folha comum e a classe de marca própria é aposentada** - `7a056a9` (feat)
2. **Task 2: Transportes monta cabeçalho, abas e rodapé pelo shell comum** - `38b7222` (feat)

**Plan metadata:** (a seguir, commit de docs)

## Files Created/Modified

- `shared/pmoc.css` - `.b-accent` ganha fundo tintado via `color-mix`, alinhada às demais famílias de badge
- `transportes/index.html` - carrega `shared/pmoc.css`; bloco de estilo local reduzido a `--accent`; três `kc-cyan` viraram `kc-accent`; barra superior e faixa de abas saíram de `#app`, que fica só com `.main` e os seis modais
- `transportes/app.js` - importa `aplicarShell`; `STATUS_BADGE.sobreaviso` vira `b-accent`; `boot()` monta cabeçalho, abas e rodapé pelo shell comum, na ordem correta em relação a `exporNoWindow()`

## Decisions Made

- A cor de destaque (`#4aa0a0`) é repetida de forma idêntica no CSS local do HTML (evita o piscar antes do JavaScript rodar) e na chamada do shell — nenhuma paleta própria foi reintroduzida em `transportes/index.html`.
- `.b-accent` em `shared/pmoc.css` foi corrigida para usar `color-mix` em vez do fundo fixo em `rgba(255,255,255,.07)` que tinha antes, porque a cor de destaque varia por módulo (`var(--accent)`) e um `rgba()` fixo não acompanharia essa variação — a mesma técnica que os outros badges não precisam porque suas cores são fixas na folha comum (verde, amarelo, vermelho, azul).
- `aplicarShell()` chamada antes de `fecharAoClicarFora()` (que já existia em `boot()` como função própria, diferente do padrão inline de predial/mapa), preservando a ordem de eventos original do módulo.

## Deviations from Plan

None - plano executado exatamente como escrito. A verificação humana descrita no `<human-check>` da Task 2 (servir a raiz do repositório por HTTP, abrir `/transportes/`, entrar como Gestor, navegar pelas sete abas, abrir/fechar modais, conferir cores dos KPIs, sair e entrar como Livre, checar console) foi parcialmente substituída por verificação automatizada nesta execução autônoma: servidor `python -m http.server` local confirmando via `curl` que `transportes/index.html` serve o miolo reduzido (sem `.topbar`/`.nav` estáticos) e que `shared/shell.js`, `shared/pmoc.css` e `transportes/app.js` respondem 200. Playwright não está instalado e sua instalação não foi realizada por estar fora do escopo do plano e do padrão zero-build do projeto — mesma decisão tomada nos planos 05-02, 05-03 e 05-04. A conferência visual pós-login (D6 na tabela de cobertura) fica marcada como `human_judgment: true` para a próxima oportunidade.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `transportes` prova, num módulo de arquivo próprio com sete abas e seis modais, que `aplicarShell()` funciona sem reescrever nenhuma lógica de domínio (frota, viagens, manutenção, planos, estoque, relatórios) — e é o primeiro caso documentado da fase de aposentadoria completa de uma família de marca própria com três pontos de uso reais (token CSS, HTML estático, template literal JS).
- `refrigeracao/` permanece intocado.
- `shared/pmoc.css` ganhou `.b-accent` tintada — mudança compartilhada com os quatro módulos já migrados (eletrica, fonoclama, predial, mapa) e verificada sem regressão (`node --test` 25/25 verde; nenhum deles usava a classe antes).
- Falta `05-06` (máquinas) para completar os 6 módulos da fase; PLAT-01/03/16 continuam **não marcados** como completos em `REQUIREMENTS.md` até que todos os módulos migrem (fecham só no plano `05-07`), conforme instrução explícita da fase.
- Pendência: conferência visual humana de `/transportes` (login real, sete abas, seis modais, permissão por cargo, chip "Livre · observador", botão de sair, rodapé) na próxima oportunidade — nenhum indício de risco no código, já que a marcação gerada por `aplicarShell()` é a mesma coberta pelos testes de `tests/shell.test.js`.

---
*Phase: 05-base-unificada*
*Completed: 2026-08-10*

## Self-Check: PASSED
</content>
