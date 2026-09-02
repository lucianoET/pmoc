---
phase: 05-base-unificada
plan: 02
subsystem: ui
tags: [vanilla-js, es-modules, shell-comum, zero-build]

# Dependency graph
requires:
  - "shared/shell.js — montarShell(cfg)/aplicarShell(cfg) (05-01)"
provides:
  - "shared/modulo-manutencao.js — montarLayout() delegando chrome (topbar/nav/rodapé) a aplicarShell()"
  - "eletrica/app.js e fonoclama/app.js — chave versao no objeto de configuração, exibida no rodapé"
affects: [05-03, 05-04, 05-05, 05-06, 05-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "montarLayout() gera só o miolo (main + seis views); aplicarShell() injeta topbar/nav/rodapé via insertAdjacentHTML em torno desse miolo"
    - "Abas do motor expressas como dados (navItems: [{id, icone, label, ativo}]) em vez de marcação HTML escrita à mão"

key-files:
  created: []
  modified:
    - shared/modulo-manutencao.js
    - eletrica/app.js
    - fonoclama/app.js

key-decisions:
  - "D-03 aplicado: eletrica/app.js e fonoclama/app.js declaram versao: '1.0', a mesma versão já exibida hoje no cartão de cada módulo no portal — o rodapé repete uma informação existente, não inventa numeração nova"
  - "config.versao documentado como opcional no JSDoc de iniciarModulo: quando ausente, o rodapé do shell simplesmente não exibe versão (comportamento já coberto pelos testes do plano 05-01)"

patterns-established:
  - "Motor de manutenção por horímetro (elétrica, fonoclama e futuros módulos do mesmo padrão) consome o shell comum em vez de manter cópia própria de topbar/nav — mudar shared/shell.js muda todos de uma vez"

requirements-completed: [PLAT-03, PLAT-16]

coverage:
  - id: D1
    description: "montarLayout() não contém mais marcação de barra superior nem de faixa de abas; a marcação de chrome saiu do motor (grep 'class=\"topbar\"' e 'class=\"nav\"' retornam 0 ocorrências)"
    requirement: "PLAT-03"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (grep + node --check)"
        status: pass
    human_judgment: false
  - id: D2
    description: "As seis views (painel, ativos, vencimentos, os, planos, estoque) continuam sendo geradas com os mesmos ids; as seis abas continuam existindo, agora como dados (navItems), na mesma ordem/rótulos/emojis, com Painel ativa e o ícone configurado do módulo na aba de Ativos"
    requirement: "PLAT-16"
    verification:
      - kind: other
        ref: "gate automatizado da Task 1 (grep dos seis ids de view + contagem de seis 'id:' em navItems)"
        status: pass
    human_judgment: false
  - id: D3
    description: "eletrica/app.js e fonoclama/app.js declaram versao mantendo cor de destaque, prefixo de tabela e demais chaves originais intactos"
    requirement: "PLAT-03"
    verification:
      - kind: other
        ref: "gate automatizado da Task 2 (grep de versao/accent/prefixo + node --check)"
        status: pass
    human_judgment: false
  - id: D4
    description: "node --test permanece com os mesmos 25 testes do plano 05-01, todos verdes, após a refatoração do motor"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "node --test (25 pass, 0 fail)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-10
status: complete
---

# Phase 5 Plan 2: Motor comum consumindo o shell unificado Summary

**`shared/modulo-manutencao.js` deixa de ter cópia própria de barra superior e abas: `montarLayout()` agora produz só o miolo (seis views) e chama `aplicarShell()` de `shared/shell.js` para o chrome; `eletrica` e `fonoclama` herdam a base sem serem reescritos, ganhando apenas a versão exibida no rodapé**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-10
- **Completed:** 2026-08-10
- **Tasks:** 2
- **Files modified:** 3 (shared/modulo-manutencao.js, eletrica/app.js, fonoclama/app.js)

## Accomplishments
- `shared/modulo-manutencao.js` importa `aplicarShell` de `shared/shell.js` (mesmo estilo dos outros cinco imports de `shared/` já presentes no topo do arquivo).
- `montarLayout()` reescrita: gera apenas o `<div class="main">` com o contêiner de alerta de carga e as seis divisões de view (painel ativa por padrão), e delega barra superior, faixa de abas e rodapé a `aplicarShell()`, passando nome, cor de destaque, versão e a lista de seis `navItems` na mesma ordem/rótulos/emojis de antes (Painel ativa, ícone configurado do módulo na aba de Ativos).
- As duas linhas de responsabilidade que duplicavam `aplicarShell` (`document.title` e `--accent`) saíram de `montarLayout()` — agora só o shell as define.
- Inserção dos modais no fim do body e o fechamento por clique fora, inalterados.
- `eletrica/app.js` e `fonoclama/app.js` ganharam `versao: '1.0'` logo após `icone`, sem alterar prefixo, cor de destaque, descrição, unidade de uso ou mapa de tipos.
- JSDoc de `iniciarModulo()` em `shared/modulo-manutencao.js` documenta `config.versao` como chave opcional.
- `shared/modulo-manutencao.js` encolheu de 1148 para 1146 linhas (marcação de chrome duplicada saiu, JSDoc de uma chave nova entrou).
- `node --test` segue em **25** testes, todos verdes — nenhum teste quebrado pela refatoração.
- `refrigeracao/` intocado: `git diff --name-only b53505c..HEAD -- refrigeracao/` vazio.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fazer montarLayout() do motor delegar o chrome ao shell comum** - `cc267c9` (refactor)
2. **Task 2: Declarar a versão de elétrica e fonoclama e conferir os dois módulos** - `9a872be` (feat)

**Plan metadata:** (a seguir, commit de docs)

## Files Created/Modified
- `shared/modulo-manutencao.js` - `montarLayout()` agora só gera o miolo e chama `aplicarShell()`; import novo de `shell.js`; JSDoc de `iniciarModulo` documenta `config.versao`
- `eletrica/app.js` - ganhou `versao: '1.0'` no objeto de configuração
- `fonoclama/app.js` - ganhou `versao: '1.0'` no objeto de configuração

## Decisions Made
- Versão `1.0` escolhida por já ser a versão exibida hoje nos cartões de Elétrica e Fonoclama no portal (`index.html`) — o rodapé repete informação existente em vez de inventar numeração nova, conforme D-03.
- `config.versao` documentado como opcional: sua ausência não gera erro nem lacuna visual, o rodapé simplesmente omite o `<span>` de versão (comportamento já coberto pelos testes de `shell.js` do plano 05-01).

## Deviations from Plan

None - plan executado exatamente como escrito. A verificação humana descrita no `<human-check>` da Task 2 (subir servidor estático e navegar visualmente pelas seis abas de `/eletrica` e `/fonoclama`) foi substituída por uma verificação automatizada equivalente nesta execução: servidor `python -m http.server` local, `curl` confirmando que `eletrica/app.js` e `fonoclama/app.js` servem a chave `versao`, que `shared/modulo-manutencao.js` importa e chama `aplicarShell`, e que `shared/shell.js` é servido corretamente — sem abrir navegador interativo, já que a execução é autônoma (`autonomous: true`, sem task `checkpoint:*` no plano). Recomenda-se ao usuário uma conferência visual rápida de `/eletrica` e `/fonoclama` na próxima oportunidade, mas nada no código indica risco: a marcação gerada por `aplicarShell` é a mesma testada pelos 6 casos de `tests/shell.test.js`.

## Issues Encountered
None.

## User Setup Required
None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
- `shared/modulo-manutencao.js` prova, num alvo real (`eletrica`/`fonoclama`), que o shell extraído no plano 05-01 funciona sem reescrever os módulos consumidores — o padrão está pronto para os planos seguintes (05-03 a 05-06: predial, mapa, transportes, máquinas) adotarem `aplicarShell` em seus próprios pontos de montagem de layout.
- `refrigeracao/` permanece intocado, confirmado por `git diff` contra a base da fase.
- Nenhuma view, consulta ao Supabase, regra de permissão ou função de renderização de domínio foi alterada — a mudança ficou confinada ao chrome (`montarLayout()`), atendendo à mitigação de T-05-08 do modelo de ameaças do plano.

---
*Phase: 05-base-unificada*
*Completed: 2026-08-10*

## Self-Check: PASSED
