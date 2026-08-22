---
phase: quick
plan: 260821-td4
subsystem: ui
tags: [refrigeracao, vercel, static-assets, testing, qrcode]

requires: []
provides:
  - "As 7 referências de asset de refrigeracao/index.html (5 de marcação + 2 new URL) em caminho absoluto de raiz — qrcode.js, favicon, apple-touch-icon, manifest, logo da topbar e CT_LOGO_URI resolvem na rota sem barra final que o vercel.json de fato serve"
  - "CT_APP_URL corrigido do domínio morto pmoc-refrigeracao.vercel.app para https://pmoc-orcin.vercel.app/refrigeracao"
  - "Atalho de PNG estático de marca (CT_QR_BRAND) removido de qrRender — o QR do app passa a ser sempre gerado da URL viva"
  - "tests/modulos-caminhos.test.js cobre a refrigeração (deixou de estar excluída) com forma positiva de caminho e um terceiro teste escopado para new URL(...)"
affects: [refrigeracao]

tech-stack:
  added: []
  patterns:
    - "Forma positiva de caminho (^[A-Za-z0-9_./-]+$) substitui lista de exclusões (data:/mailto:/#, '+/${}) num gate que varre marcação dentro de JS embutido — sobrevive a interpolação sem precisar adivinhar toda forma dela"

key-files:
  created: []
  modified:
    - refrigeracao/index.html
    - tests/modulos-caminhos.test.js
    - tests/refrigeracao-qr-nfc.test.js
    - tests/inventario-ordem-refrigeracao.test.js
    - CLAUDE.md
    - TESTES.md

key-decisions:
  - "D-td4-01: refrigeração passa a referenciar asset próprio por caminho absoluto de raiz (/refrigeracao/…), nunca ../shared/… (D-04 proíbe) nem relativo simples (era o defeito)"
  - "D-td4-02: new URL(…, location.href) continua existindo e continua absoluto com origem — necessário porque imprimirDocumento escreve num about:blank sem base; só o primeiro argumento vira caminho de raiz"
  - "D-td4-03: o atalho de PNG estático (CT_QR_BRAND) sai de qrRender — um QR estático não acompanha mudança de domínio nem é verificável, e reativá-lo consertando só CT_APP_URL geraria um QR novo apontando para lugar errado; qr-brand.png fica em disco, o projeto arquiva"
  - "D-td4-04: CT_APP_URL passa a https://pmoc-orcin.vercel.app/refrigeracao, com o caminho do módulo — é o fallback de urlBaseApp() fora de http(s)"
  - "D-td4-05: o gate deixa de excluir a refrigeração; troca lista de exclusões por forma positiva de caminho, medida sem falso positivo nos 9 módulos (inclusive calibração, que tem lib de QR embutida)"
  - "D-td4-06: terceiro teste, escopado só a refrigeracao/index.html, cobre new URL(...) — nenhuma varredura de marcação enxerga essa construção; shared/supabase-config.js (import.meta.url) fica deliberadamente fora"
  - "D-td4-07: abrir index.html direto do sistema de arquivos deixa de funcionar em qualquer módulo — custo da regra de caminho absoluto de raiz, pago pelos 9 módulos, registrado em CLAUDE.md"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "As 7 referências de asset da refrigeração (5 de marcação + 2 new URL) resolvem em caminho absoluto de raiz; CT_APP_URL aponta para o domínio vivo com o caminho do módulo"
    verification:
      - kind: unit
        ref: "tests/modulos-caminhos.test.js#refrigeracao/index.html nao referencia asset por caminho relativo simples"
        status: pass
      - kind: unit
        ref: "tests/modulos-caminhos.test.js#refrigeracao/index.html so referencia asset que existe em disco"
        status: pass
      - kind: unit
        ref: "tests/modulos-caminhos.test.js#refrigeracao/index.html so usa new URL(...) com primeiro argumento absoluto"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js (30 casos, sandbox com CT_APP_URL atualizado)"
        status: pass
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — caminhos de asset absolutos de raiz (21/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "A prova real do defeito reportado ('o qr nao esta carregando') exige abrir https://pmoc-orcin.vercel.app/refrigeracao SEM barra final em produção depois do deploy — a mesma conferência com barra já passava antes e não prova nada. Fora do alcance deste executor autônomo (sem navegador, sem produção)."
  - id: D2
    description: "Atalho de PNG estático de marca removido de qrRender — o QR do app é sempre gerado a partir da URL viva, nunca de uma imagem estática apontando para domínio morto"
    verification:
      - kind: unit
        ref: "tests/modulos-caminhos.test.js#refrigeracao/index.html (CT_QR_BRAND ausente)"
        status: pass
      - kind: unit
        ref: "tests/inventario-ordem-refrigeracao.test.js#os assets da refrigeração saíram do HTML e nenhum data URI base64 sobrou (assercao de ausencia de CT_QR_BRAND)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gate de caminhos (tests/modulos-caminhos.test.js) cobre os 9 módulos, inclusive refrigeração, com forma positiva de caminho e sem falso positivo — visto falhando (mensagem legível) e voltando a passar, duas vezes (referência de marcação relativa e new URL relativo)"
    verification:
      - kind: unit
        ref: "node --test tests/modulos-caminhos.test.js — 19/19 (17 pré-existentes + 2 novos de refrigeração + 1 escopado a new URL)"
        status: pass
      - kind: manual_procedural
        ref: "Reprodução manual do gate falhando e voltando a passar (comandos abaixo, executados durante a task)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-22
status: complete
---

# Quick Task 260821-td4: Caminhos de asset absolutos de raiz na refrigeração — Summary

**Conserto do defeito reportado pelo usuário ("o qr nao esta carregando"): as 7 referências de asset de `refrigeracao/index.html` — 5 de marcação e 2 `new URL(...)` — passam de caminho relativo simples (que resolvia contra a raiz do site na rota `/refrigeracao` sem barra final) para caminho absoluto de raiz; o gate `tests/modulos-caminhos.test.js`, que excluía a refrigeração por escrito, passa a cobri-la.**

## Performance

- **Duration:** ~35min
- **Completed:** 2026-08-22
- **Tasks:** 2/2 completas
- **Files modified:** 6 (`refrigeracao/index.html`, `tests/modulos-caminhos.test.js`, `tests/refrigeracao-qr-nfc.test.js`, `tests/inventario-ordem-refrigeracao.test.js`, `CLAUDE.md`, `TESTES.md`)

## Accomplishments

- As 5 referências de marcação (`<link rel="icon">`, `<link rel="apple-touch-icon">`, `<link rel="manifest">`, `<img>` do logo da topbar, `<script src="qrcode.js">`) prefixadas com `/refrigeracao/` — D-td4-01.
- `CT_LOGO_URI` mantém `new URL(…, location.href).href` (necessário: `imprimirDocumento` escreve num `about:blank` sem base), com o primeiro argumento em caminho absoluto de raiz — D-td4-02.
- `CT_APP_URL` corrigido de `https://pmoc-refrigeracao.vercel.app` (404 hoje) para `https://pmoc-orcin.vercel.app/refrigeracao` — D-td4-04.
- `CT_QR_BRAND` removido, junto com o `if` de atalho em `qrRender` que exibia um PNG estático quando a URL batia com `CT_APP_URL` — o QR passa a ser sempre gerado da URL viva, nunca uma imagem que poderia apontar para um domínio morto registrável por terceiro — D-td4-03. `qr-brand.png` continua em disco.
- **O ícone da topbar** (linha 718, o `<img>` do logo) **aparecia quebrado no screenshot que o usuário mandou** — corrigido pelo mesmo prefixo `/refrigeracao/`; ninguém tinha notado antes porque a conferência de sempre é feita com barra final (`localhost:8000/refrigeracao/`), onde o caminho relativo resolvia certo.
- `tests/modulos-caminhos.test.js`: `referenciasLocais()` ganha `img` na alternação de tags, troca a lista de exclusões por uma forma positiva de caminho (`^[A-Za-z0-9_./-]+$`), `refrigeracao` entra em `MODULOS` com o comentário de exclusão reescrito, e um terceiro teste escopado só a `refrigeracao/index.html` cobre as construções `new URL(...)` — D-td4-05/D-td4-06.
- O gate foi visto **falhando de verdade**, duas vezes, antes de dar por pronto: uma referência de marcação relativa reintroduzida (`manifest.json` sem prefixo) e um primeiro argumento relativo em `new URL` reintroduzido (`'icone-192.png'`) — ambos produziram `AssertionError` com mensagem legível, restaurados em seguida com `cp`. Comandos e saída completa registrados abaixo.
- `CLAUDE.md`: linha "Run locally" registra D-td4-07 — abrir `index.html` direto do sistema de arquivos deixa de funcionar em qualquer módulo, porque todos referenciam asset por caminho absoluto de raiz; a forma suportada é `python -m http.server`.
- `TESTES.md`: nova seção com a conferência manual em produção, explicitamente na URL **sem barra final** — a mesma conferência com barra já passava antes e não prova nada.
- `node --test`: **629/629** (626 baseline + 3 testes novos de `modulos-caminhos.test.js` cobrindo a refrigeração).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: as 7 referências de asset em caminho absoluto de raiz, e o CT_APP_URL morto** - `4387841` (fix)
2. **Task 2: o gate de caminhos cobrindo a refrigeração, inclusive as construções new URL** - `1f98a07` (test)

## Files Created/Modified

- `refrigeracao/index.html` — 7 referências de asset em caminho absoluto de raiz, `CT_APP_URL` corrigido, `CT_QR_BRAND` e o atalho de PNG removidos
- `tests/modulos-caminhos.test.js` — `img` na varredura, forma positiva de caminho, `refrigeracao` em `MODULOS`, terceiro teste escopado a `new URL(...)`
- `tests/refrigeracao-qr-nfc.test.js` — `CT_APP_URL` do sandbox atualizado para o valor novo
- `tests/inventario-ordem-refrigeracao.test.js` — assercao de `CT_LOGO_URI` atualizada para o caminho absoluto; assercao de `CT_QR_BRAND` trocada por confirmar que a constante deixou de existir (achado durante a execução, ver Deviations)
- `CLAUDE.md` — D-td4-07 registrada na linha "Run locally"
- `TESTES.md` — nova seção de conferência manual em produção, na URL sem barra final

## Decisions Made

Ver `key-decisions` no frontmatter — D-td4-01 a D-td4-07, todas travadas no PLAN.md e seguidas à risca. Nenhuma decisão nova tomada durante a execução.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/inventario-ordem-refrigeracao.test.js` quebrava com a mudança da Task 1**
- **Found during:** Task 1, ao rodar `node --test` na raiz depois de editar `refrigeracao/index.html`
- **Issue:** o teste (não listado em `files_modified` do plano) tinha uma asserção fixando `CT_LOGO_URI` no caminho relativo antigo e outra exigindo que `CT_QR_BRAND` existisse com o valor antigo — ambas as expectativas contradiziam D-td4-02/D-td4-03, que o próprio plano manda seguir
- **Fix:** assercao de `CT_LOGO_URI` atualizada para o caminho absoluto (`/refrigeracao/icone-192.png`); assercao de `CT_QR_BRAND` trocada por `assert.strictEqual(HTML.includes('CT_QR_BRAND'), false)`, confirmando a remoção em vez de um valor que não existe mais. A checagem de que `qr-brand.png` continua em disco não mudou — o arquivo fica, só a constante que o referenciava saiu
- **Files modified:** `tests/inventario-ordem-refrigeracao.test.js`
- **Verification:** `node --test tests/inventario-ordem-refrigeracao.test.js` verde; `node --test` completo 629/629
- **Committed in:** `4387841` (parte do commit da Task 1, junto com as mudanças que o motivaram)

---

**Total deviations:** 1 auto-fixed (Rule 1 — teste pré-existente quebrado pela própria correção que o plano pedia)
**Impact on plan:** Necessário para o baseline verde exigido antes de cada commit. Sem crescimento de escopo — nenhum arquivo fora da lista do plano recebeu mudança de comportamento, só a asserção de um teste foi realinhada com a decisão já travada.

## Issues Encountered

None.

## User Setup Required

None - sem migração, sem dependência nova, sem configuração externa. `refrigeracao/manifest.json` e `refrigeracao/qrcode.js` intocados, conforme fronteira do plano.

## Next Phase Readiness

- `node --test`: 629/629, 0 falhas
- Os quatro `grep -c` do PLAT-15 (D-04) em `refrigeracao/index.html`: 0/0/0/0
- `git diff --stat 81cccbd..HEAD` toca exatamente os 6 arquivos listados em `files_modified`
- `refrigeracao/manifest.json`, `refrigeracao/qrcode.js` e `refrigeracao/qr-brand.png` intocados
- **Verificação humana pendente (roteiro em `TESTES.md`, seção "Refrigeração — caminhos de asset absolutos de raiz"):** abrir `https://pmoc-orcin.vercel.app/refrigeracao` **sem barra final** depois do deploy e conferir logo da topbar, favicon, QR do app (SVG gerado, não imagem) e cabeçalho da ficha/OS impressa com o logo — a única conferência que prova o defeito reportado corrigido, fora do alcance deste executor autônomo (sem navegador, sem produção).
- Reprodução do gate mordendo, para referência (rodada durante a Task 2, arquivo restaurado logo em seguida com `cp`):
  ```
  $ cp refrigeracao/index.html /tmp/td4-bak.html
  $ sed -i 's#href="/refrigeracao/manifest.json"#href="manifest.json"#' refrigeracao/index.html
  $ node --test tests/modulos-caminhos.test.js
  ✖ refrigeracao/index.html nao referencia asset por caminho relativo simples ...
    AssertionError: refrigeracao/index.html referencia manifest.json por caminho relativo simples. ...
  $ cp /tmp/td4-bak.html refrigeracao/index.html   # restaurado, verde de novo

  $ sed -i "s#new URL('/refrigeracao/icone-192.png'#new URL('icone-192.png'#" refrigeracao/index.html
  $ node --test tests/modulos-caminhos.test.js
  ✖ refrigeracao/index.html so usa new URL(...) com primeiro argumento absoluto ...
    AssertionError: construcao de CT_LOGO_URI (new URL) nao encontrada em refrigeracao/index.html
  $ cp /tmp/td4-bak.html refrigeracao/index.html   # restaurado, verde de novo
  ```

## Self-Check: PASSED

- `refrigeracao/index.html` confirmado com as 7 referências em caminho absoluto de raiz (`grep`).
- `tests/modulos-caminhos.test.js`, `tests/refrigeracao-qr-nfc.test.js`, `tests/inventario-ordem-refrigeracao.test.js` confirmados modificados em disco.
- Os 2 commits de task (`4387841`, `1f98a07`) confirmados em `git log`.
- `node --test`: 629/629 verde.
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0.
- Gate visto falhando e voltando a passar duas vezes (registrado acima), com `refrigeracao/index.html` restaurado byte a byte ao estado do commit em ambos os casos (`diff` confirmou ausência de diferença).
