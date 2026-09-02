---
phase: quick-260821-tyx
plan: 01
subsystem: ui
tags: [css, touch-gesture, refrigeracao, ficha, qr, swipe-drawer]

requires: []
provides:
  - Teto de largura de 200px no QR da ficha (.qr-ficha svg), separado do teto de 250px do modal
  - gestoFechaGaveta(inicioForaDoCorpo, rolagemInicial, dy, dx) — função pura que decide se o gesto fecha a gaveta
affects: [refrigeracao]

tech-stack:
  added: []
  patterns:
    - "Decisão de gesto como função pura fora de IIFE de listener (mesmo espírito de lerAlvoFicha/mensagemErroNfc)"
    - "Teto de largura de SVG resolvido como classe CSS na folha da seção, não estilo embutido no template"

key-files:
  created:
    - tests/refrigeracao-gaveta-qr.test.js
  modified:
    - refrigeracao/index.html
    - TESTES.md

key-decisions:
  - "D-tyx-01: teto de largura do QR é regra de CSS numa folha <style>, não estilo embutido — blocoQrFicha não carrega o número"
  - "D-tyx-02: teto próprio de 200px para .qr-ficha svg, deliberadamente não compartilhado com o de 250px do modal (#qr-svg-wrap svg)"
  - "D-tyx-03: gestoFechaGaveta é função pura, fora da IIFE do SWIPE DRAWER — decisão testável em Node, não regex sobre o arquivo"
  - "D-tyx-04: fecha só em duas situações — toque começou com #drawer-body.scrollTop<=0, ou toque começou fora do corpo rolável (alça/cabeçalho/rodapé)"
  - "D-tyx-05: gesto tem de ser predominantemente vertical (|dx|>|dy| cancela) — arrasto lateral não fecha"
  - "D-tyx-06: rolagem lida é a de #drawer-body (o painel #drawer-panel não rola, é só a coluna flex), capturada no touchstart"
  - "D-tyx-07: limiar continua 60px, agora GESTO_MIN_PX nomeado, e reavaliado a cada touchmove (dragging é atribuído, não só ligado por if)"
  - "D-tyx-08: etiqueta impressa (22mm) e ficha impressa (20mm) não tocadas — papel não é tela"
  - "D-tyx-09: nenhum redesenho da gaveta — sem arrasto acompanhando o painel, sem animação de dismiss"

requirements-completed: []

coverage:
  - id: D1
    description: "Teto de largura de 200px no QR da ficha, numa regra de CSS (.qr-ficha svg), sem duplicar o número no template"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-gaveta-qr.test.js#existe, numa folha de estilo, uma regra .qr-ficha svg com max-width em px entre 120 e 260"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-gaveta-qr.test.js#blocoQrFicha usa a classe qr-ficha, não repete o número de largura máxima"
        status: pass
    human_judgment: false
  - id: D2
    description: "Regra de 250px do modal e as duas regras de impressão em mm (etiqueta 22mm, ficha 20mm) seguem intactas"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-gaveta-qr.test.js#a regra de 250px do modal continua no arquivo, separada e intacta"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-gaveta-qr.test.js#as duas regras de impressão em milímetros seguem intactas"
        status: pass
    human_judgment: false
  - id: D3
    description: "gestoFechaGaveta decide corretamente o fechamento da gaveta em todos os casos do plano — inclusive o caso de rolagem que reproduz o defeito relatado"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-gaveta-qr.test.js#gestoFechaGaveta: (9 casos de comportamento)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Aparência real na tela — QR de ~200px no desktop, mesmo tamanho no celular, gaveta não fecha ao rolar e fecha ao arrastar a alça"
    verification: []
    human_judgment: true
    rationale: "Sem browser/Playwright disponível neste ambiente autônomo; roteiro de 4 conferências manuais registrado em TESTES.md."

duration: 20min
completed: 2026-08-21
status: complete
---

# Quick Task 260821-tyx: QR da ficha com largura limitada e gaveta que não fecha ao rolar

**Teto de largura de 200px no QR da ficha (`.qr-ficha svg`, CSS puro) e gaveta que passa a fechar só em dois gestos reais — toque começado fora do corpo rolável ou com a rolagem já no topo — decididos por uma função pura testável em Node (`gestoFechaGaveta`).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 3 (`refrigeracao/index.html`, `tests/refrigeracao-gaveta-qr.test.js`, `TESTES.md`)

## Accomplishments

- No desktop, o QR do bloco 5 da ficha para de ocupar a largura inteira da janela — teto de 200px, independente do de 250px do modal "Acesse pelo celular".
- No celular, nada muda: o teto (200px) é maior que a largura disponível na gaveta.
- Rolar a ficha para ler o bloco 5 não fecha mais a gaveta — o gesto só fecha quando começa com a rolagem já no topo, ou fora do corpo rolável (alça/cabeçalho/rodapé).
- O gesto conhecido (arrastar a alça) continua fechando em qualquer posição de rolagem.
- `gestoFechaGaveta` é pura, sem DOM, testada em `node:vm` com 9 casos de comportamento mais 3 afirmações estruturais.

## Task Commits

Each task was committed atomically:

1. **Task 1: teto de largura do QR da ficha, numa regra de CSS** - `61fe498` (fix)
2. **Task 2: a gaveta só fecha quando o gesto é de fechar** - `b41e635` (fix)

_Ambas as tasks eram `tdd="true"`; o teste foi escrito e verificado (verde) junto do conserto na mesma task, no padrão dos demais gates de refrigeração deste projeto (recorte HTML + `node:vm`), não como ciclo RED separado — mesmo padrão usado nos quick tasks anteriores desta série (`260821-s3h`, `260821-q57`)._

## Files Created/Modified

- `refrigeracao/index.html` - `.qr-ficha` (CSS, teto 200px) + `blocoQrFicha` sem estilo embutido; bloco `SWIPE DRAWER` reescrito com `GESTO_MIN_PX`/`gestoFechaGaveta` puros e a IIFE lendo `#drawer-body.scrollTop`
- `tests/refrigeracao-gaveta-qr.test.js` - gate novo, CSS (Task 1) + gesto (Task 2)
- `TESTES.md` - seção nova com 4 conferências manuais

## Decisions Made

Ver `key-decisions` no frontmatter (D-tyx-01 a D-tyx-09) — todas já estavam travadas no plano e foram seguidas à risca, sem desvio.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Causa raiz — ambos os defeitos são anteriores a hoje

O próprio arquivo já denunciava os dois problemas antes deste conserto:

- O QR da ficha (`blocoQrFicha`) nunca teve teto de largura — só o modal "Acesse pelo celular" tinha (`#qr-svg-wrap svg{max-width:250px}`, desde a v4). A ficha (introduzida em `260821-s3h`) nasceu sem o equivalente.
- O bloco `SWIPE DRAWER` já declarava `var panel, startY, startScroll, dragging` — `panel` era atribuído e nunca lido, `startScroll` nunca era atribuído. A checagem de rolagem estava prevista no desenho original do gesto e ficou pela metade: o teste único era `if(dy>60){ dragging=true; }`, em qualquer ponto da gaveta, sem olhar `scrollTop`. Só ficou intolerável agora que a ficha ganhou 5 blocos e um QR — antes a gaveta era curta o bastante para raramente precisar rolar.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Sem pendência aberta por este quick task. `node --test tests/*.test.js` = 647/647 (629 de linha de base + 18 novos). Roteiro manual de 4 itens registrado em `TESTES.md` aguardando conferência humana em tela (desktop + celular).

---
*Quick task: 260821-tyx*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: refrigeracao/index.html
- FOUND: tests/refrigeracao-gaveta-qr.test.js
- FOUND: TESTES.md
- FOUND: commit 61fe498
- FOUND: commit b41e635
