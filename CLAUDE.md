# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PMOC · CMASM — maintenance management systems (Plano de Manutenção, Operação e Controle) for the Brazilian Navy's submarine weapons center (UASG 744030). Two production apps plus a portal, all backed by one Supabase project (`pmoc`, `thoaqipyhfmromsgzmjs`, sa-east-1).

**Project language is Portuguese** — code identifiers, comments, commits, UI strings, and docs are all in Portuguese. Keep it that way.

## Workspace boundaries

- `/home/luc/Downloads/pmoc-overlay` is the only development target in this workspace.
- `/home/luc/DEV_ERP` is a reference monorepo and is strictly read-only, including every descendant directory and repository.
- In `DEV_ERP`, use only read/search operations. Never edit, create, delete, rename, format, generate, install, build, test, start services, run migrations, or perform Git operations there.
- Patterns and domain knowledge found in `DEV_ERP` may be adapted into new changes under `pmoc-overlay`; all generated files and command side effects must remain under `pmoc-overlay`.
- If a task appears to require changing `DEV_ERP`, stop and ask for explicit authorization instead of modifying it.

## Commands

There is no build, no npm, no lint, no automated tests. Zero-build static site.

- **Run locally:** open any `index.html` directly in a browser, or `python -m http.server` from the repo root.
- **Deploy:** push to GitHub (`luctronics-ET/pmoc` — this is what `git remote origin` points to and what triggers the deploy; the old `pmoc-overlay` name and the `luctronicserp/pmoc` reference are stale). Vercel serves the repo statically at `https://pmoc-orcin.vercel.app` (`vercel.json` rewrites `/refrigeracao`, `/maquinas`, `/transportes`, `/eletrica` and `/fonoclama` to their `index.html`; framework "Other", no build command).
- **Database changes:** write a new numbered SQL file in `supabase/` (e.g. `10_*.sql`) and run it in the Supabase SQL editor. Migrations are **additive only — never `DROP`**; archive rows with `ativo = false` instead of deleting.
- **Testing:** manual only, checklist in `TESTES.md`. Verify against the live Supabase data (currently 171 `equipamentos`, 28 `maq_ativos`, 43 `transp_ativos`, etc.).

## Architecture

Three independent frontend entry points sharing one Postgres backend via the Supabase JS SDK (v2, loaded from CDN — no imports/bundler):

- `/index.html` — portal (navigation hub)
- `/refrigeracao/index.html` — PMOC Refrigeração v2.8, a **single ~436 KB file** with embedded CSS + JS. HVAC inventory with the full public-contracting workflow: orçamento → execução → fiscalização → composição de pagamento (ARP items) → certificação → auditoria. QR codes, print forms, CSV export (CATMAT).
- `/maquinas/index.html` + `/maquinas/app.js` — PMOC Máquinas v1.0. Hour-meter-based maintenance of cutting equipment: plans per `tipo_modelo`, automatic stock decrement, fuel tracking, depreciation, procurement shopping-list CSV.
- `/shared/auth.js` — reusable role-login ES module (`Auth` class), imported by all six new-generation modules (`transportes`, `eletrica`, `fonoclama`, `predial`, `mapa`, `maquinas`). `refrigeracao` stays outside this base, frozen by user decision.
- `/shared/shell.js` — reusable layout shell (`aplicarShell()`): header, tab strip (when the module has one) and footer, consumed by the same six modules above. Changing `shell.js` changes header/tabs/footer for all six at once.
- `/shared/tema.js` — single light/dark theme implementation (detection, closed-list validation, application, toggling and persistence) for all 7 surfaces (the 6 modules + portal). Consumed by the 6 modules through `aplicarShell()` → `iniciarTema()`, and by the portal directly (it doesn't load the shared shell). Changing it changes the theme mechanism for all 7 surfaces at once. Its two pure functions (`normalizarTema`, `proximoTema`) are deliberately free of any browser API, kept testable in Node — the same pure-core/DOM-applier split `shell.js` already uses between `montarShell()`/`aplicarShell()`.

**Theme convention (locked, Phase 6):** `data-theme="claro"|"escuro"` attribute on the root element, `localStorage` key `pmoc-tema` (values in Portuguese, matching the rest of the codebase). Dark stays the default in `shared/pmoc.css:root` (unchanged, byte-identical); light is an additive `[data-theme="claro"]` block overriding only the neutral/semantic tokens. Two deliberate exceptions: the portal duplicates the same token *values* inline (it never loads `shared/pmoc.css`) but reuses `shared/tema.js` for all logic — no theme code is duplicated; `mapa/xmap.css` (the Leaflet skin, its own `--xm-*` token system) stays dark-only by decision, out of scope. A classic (non-module, no external `src`) anti-FOUC script — inline, byte-identical — is replicated in the `<head>` of all 7 surfaces, immediately after the `theme-color` meta tag, applying the saved/detected theme before first paint; ES modules are deferred and would repaint too late, reintroducing the flash. `tests/tema-superficies.test.js` enforces that the 7 copies stay identical — don't fix one and forget the other six.

**State pattern (both apps):** global UPPER_CASE arrays (`ATIVOS`, `OS_LIST`, `MATERIAIS`, `PLANOS`, …) populated by `carregarTudo()` (parallel `Promise.all` Supabase queries), then `render*()` functions rebuild DOM sections via template literals. Every save re-runs `carregarTudo()` — no optimistic updates, no partial refresh. Modals drive all CRUD; inline `onclick="fn(${id})"` handlers are the norm.

**Auth & security:** login is by cargo button + password — emails (`direcao@cmasm.local`, etc.) are internal and never shown to users. Roles: `admin`, `gestor`, `tecnico`, `observador` (read-only, no password). Role lives in the `usuarios` table. The Supabase `anon key` is hardcoded in the frontends **by design** — real access control is RLS policies in Postgres; any client-side permission check is UX only. New cargos: edit the `CARGOS` array at the top of `maquinas/app.js`.

**Database:** machine tables use the `maq_` prefix; refrigeration tables are unprefixed (`equipamentos`, `arp_itens`, `os_contratacao`, `os_composicao`, …); `usuarios` is shared. Maintenance plans link to assets by `tipo_modelo` (each model has its own manual), not by FK to a specific asset.

## Conventions

- Globals `UPPER_CASE`, functions `camelCase`, private helpers `_prefixed`, HTML ids `kebab-case`.
- Section comments as `// ── nome ──`.
- Supabase error handling idiom: `const { error } = await supa.from(...)…; if(error){ alert('Erro: '+error.message); return }`.
- Detailed codebase analysis lives in `.planning/codebase/` (ARCHITECTURE, STACK, CONVENTIONS, TESTING, CONCERNS, INTEGRATIONS, STRUCTURE) — read those before large changes.

## Known pendências (from README)

- RLP divergence: MCP R$ 43.467,13 vs NE334 R$ 39.926,11 (diff R$ 3.541,02).
- F21 centrals are 30 TR but adhered ARP items 1365/1366 are 12 TR — applicability unverified.
- Role passwords still at initial `cmasm2026`; machine acquisition values are estimates.
