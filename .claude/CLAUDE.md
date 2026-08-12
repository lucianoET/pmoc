<!-- GSD:project-start source:PROJECT.md -->

## Project

**PMOC · CMASM — Plataforma Modular de Manutenção**

Sistema modular de gestão da manutenção de ativos do CMASM (Centro de Mísseis e Armas Submarinas da Marinha, UASG 744030). Cada domínio de ativos é um módulo/app independente servido estaticamente pelo Vercel sobre um único backend Supabase (PostgreSQL + Auth + RLS). Já existem dois módulos em produção (Refrigeração v2.8 e Máquinas v1.0); este ciclo adiciona três novos: **Transportes, Elétrica e Fonoclama**, portando apps legados funcionais para o padrão pmoc.

**Core Value:** Cada módulo novo entra no ar seguindo o padrão pmoc existente (Vercel + Supabase + login por cargo), com os dados legados consolidados e importados — sem quebrar os módulos em produção.

### Constraints

- **Tech stack**: HTML + vanilla JS + Supabase SDK via CDN, zero-build — padrão estabelecido, novos módulos copiam
- **Compatibilidade**: módulos em produção (refrigeração, máquinas) não podem quebrar — migrações aditivas, sem alterar tabelas existentes
- **Deploy**: Vercel estático via push no GitHub `luctronics-ET/pmoc` (URL de produção `https://pmoc-orcin.vercel.app`) — sem build command
- **Idioma**: português em código, commits, UI e docs
- **Dependência**: apps legados e planilhas fornecidos pelo usuário por módulo — análise/consolidação precede implementação

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- HTML5 - Portal and app markup
- JavaScript (ES6+) - All frontend logic and client-side operations
- SQL (PostgreSQL) - Database schema, migrations, and RLS policies

## Runtime

- Browser-based (client-side execution)
- No Node.js or server-side runtime required
- None — Zero build process; no npm, yarn, or package.json
- All dependencies delivered via CDN

## Frameworks

- Vanilla JavaScript — No framework dependencies (React, Vue, Svelte not used)
- None — Static HTML + JS files deployed directly
- Vercel handles static asset hosting and URL rewrites via `vercel.json`

## Key Dependencies

- **Supabase JS SDK** (v2) - Client library for PostgreSQL, Auth, and RLS
- **PostgreSQL** (via Supabase) - Relational database
- **jsDelivr** - CDN for Supabase JS SDK distribution

## Configuration

- Supabase credentials hardcoded in HTML files:
- No `.env` file or environment variable system
- No build-time configuration
- `vercel.json` — Static file serving configuration:
- Supabase Auth (email + password)
- Role-based access control via Row Level Security (RLS) policies
- Four role groups configured: `admin`, `gestor`, `tecnico`, `observador`
- User profiles stored in `usuarios` table with `role` field

## Database Schema

- `maq_areas.geom`/`flora`/`inclinacao`/`limpeza` (Phase 10, migration 25) — service-zone geometry (`jsonb`) and three closed-list terrain attributes, additive columns on the existing table
- `lat`/`lon` on `cmasm_locais` + five asset tables (`maq_ativos`, `transp_ativos`, `elet_ativos`, `fono_ativos`, `equipamentos`) — Phase 10, migration 25, two-layer position (inherited from location, overridable per asset), each pair guarded by a geographic-envelope check and a complete-pair check
- `maq_ativos` — Equipment inventory
- `maq_planos` — Maintenance plans by equipment type
- `maq_materiais` — Spare parts and consumables
- `maq_plano_materiais` — Plan-to-material mappings
- `maq_uso_registros` — Usage hours/km tracking
- `maq_os` — Work orders
- `maq_estoque_movimentos` — Inventory movements
- `maq_abastecimentos` — Fuel consumption logs
- `equipamentos` — 171 HVAC units
- `plano_tarefas` — Maintenance tasks (NBR 17037 standard)
- `campanhas` — Maintenance campaigns
- `campanha_equip` — Campaign-to-equipment mappings
- `logs_manutencao` — Maintenance execution records
- `arp_itens` — Public procurement contract items (ARP 04/2024)
- `os_contratacao` — Procurement work orders
- `os_orcamento_itens` — Budget line items
- `os_execucao` — Execution records with photos
- `os_composicao` — Cost composition by ARP item
- `os_eventos` — Audit trail events
- `usuarios` — User profiles linked to auth.users

## Platform Requirements

- Modern browser with ES6 support (Chrome, Firefox, Safari, Edge)
- Text editor or IDE for editing HTML/JS files
- Git for version control
- (Optional) Local web server for development (e.g., `python -m http.server`)
- **Deployment target:** Vercel (configured via GitHub integration)
- **Static hosting:** No server-side rendering required
- **Custom domain:** Optional (can use vercel.app domain)
- **Database:** Supabase managed PostgreSQL instance
- **SSL/TLS:** Automatic via Vercel and Supabase
- ES6 JavaScript required (no transpilation or polyfills)
- CSS variables required (no fallbacks)
- No specific version minimums documented

## Feature Flags

- ✅ PMOC Refrigeração (v2.8) — 171 HVAC units, procurement workflows
- ✅ PMOC Máquinas (v1.0) — 7 cutting machines, maintenance by hour
- 📋 Portal (index.html) — Landing page and app navigation
- Fonoclama (70V PA system)
- Transportes (vehicles and vessels)
- Elétrica (electrical infrastructure)
- Calibração (metrology instruments)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Components/modules use camelCase: `auth.js`, `app.js`
- HTML files use lowercase: `index.html`
- SQL migrations use numbered prefix: `01_maquinas_schema.sql`, `02_maquinas_seed.sql`
- Public functions: `camelCase` — e.g., `renderAtivos()`, `carregarUsuario()`, `mostrarApp()`, `salvarAtivo()`
- Private functions (internal helpers): prefixed with `_` — e.g., `_render()`, `_bindEventos()`, `_selecionarCargo()`, `_loginCargo()`, `_carregarPerfil()`
- Async functions: same camelCase convention — e.g., `async function carregarTudo()`, `async function salvarMovimento()`
- Global state: `UPPER_CASE` — e.g., `ATIVOS`, `OS_LIST`, `MATERIAIS`, `PLANOS`, `USUARIO`, `ATIVO_EDIT_ID`
- Local/parameter variables: `camelCase` — e.g., `ativo`, `usuario`, `total`, `inop`, `venc`, `baixo`
- DOM element references: camelCase — e.g., `card`, `grid`, `btn`, `erroEl`, `sel`
- Short abbreviations used in destructuring: `a`, `o`, `m`, `p`, `pm`, `ab`, `ur` (from query results)
- kebab-case with descriptive purpose — e.g., `login-screen`, `app`, `kpi-total`, `modal-ativo`, `tb-ativos`, `auth-senha`, `btn-entrar`, `step-cargo`
- Constructor names: `PascalCase` — e.g., `class Auth`
- Constants for configuration: `UPPER_CASE` — e.g., `CARGOS_PADRAO`, `SUPA_URL`, `SUPA_KEY`

## Code Style

- No automated formatter (Prettier/ESLint) detected
- Manual indentation with 2-space tabs
- Inline styles preferred over CSS classes for dynamic styling
- JSDoc comments for exported functions and classes
- No linting tool configured
- No code style enforcer (ESLint/Biome)
- Manual code review approach
- Portuguese for all comments, variable names, UI strings, and documentation
- Comments explaining business logic in Portuguese
- Example: `// ── auth ──`, `// ── estado global ──`, `// "Livre" → acesso observador sem senha`

## Import Organization

- Not used; direct relative paths: `./auth.js`, `./app.js`
- ES6 module syntax: `export class Auth`, `export const CARGOS_PADRAO`, `export async function cadastrarCargo()`
- Single-file apps: global functions and variables, no exports

## Error Handling

- Supabase async operations use destructuring: `const { error } = await supa.from(...)`
- Error checking before proceeding: `if(error) { alert('Erro: '+error.message); return }`
- Validation errors use `alert()` for simple cases: `if(!senha) { erroEl.textContent = 'Digite a senha.'; return }`
- Form validation before submission: check required fields, trim input, parse numbers

## Logging

- Errors shown to user via `alert()` dialog
- Form validation feedback via DOM updates: `erroEl.textContent = 'message'`
- No debug logging in production code
- Console.warn for deprecated code: `console.warn('addLogEntry sync obsoleto')`

## Comments

- Section headers: `// ── SECTION NAME ──`
- Business logic explanations: `// "Livre" → acesso observador sem senha`
- Complex calculations or filter logic
- User-facing error conditions
- Used for exported classes and reusable functions in `shared/auth.js`
- Multi-line JSDoc with parameter descriptions
- Example from `auth.js`:

## Function Design

- Rendering functions: 30-80 lines with template literals
- Data loading: 20-40 lines with multiple Promise.all queries
- Modal handlers: 40-60 lines including DOM manipulation and validation
- Minimal parameters (1-3 typical)
- Relies on global state (`ATIVOS`, `USUARIO`, etc.) rather than passing through function chain
- Event handlers receive DOM elements: `onclick="abrirModalAtivo(${a.id})"`
- Most functions are void (side-effect based)
- Async functions return nothing or throw errors
- Pure functions for utilities: `esc()`, `el()`, `val()`, `fmtDate()`, `today()`

## Module Design

- Reusable module (`shared/auth.js`): exports `Auth` class and `cadastrarCargo()` function
- Reusable module (`shared/tema.js`): exports pure core (`normalizarTema`, `proximoTema`) plus DOM appliers (`detectarTema`, `temaAtual`, `aplicarTema`, `alternarTema`, `iniciarTema`) and two constants (`CHAVE_TEMA`, `TEMAS`)
- Single-file apps: no exports, global scope for functions and state
- Not used; each file is standalone
- No index.js files for re-exports
- No explicit private/public distinction except `_prefixed` methods in classes
- Exported from modules via `export` keyword
- Global state intentionally exposed at module level

## DOM Interaction

- Direct `document.getElementById()` for most lookups
- `document.querySelector()` for complex selectors
- Template literals for HTML generation: `<tr>${...}</tr>`
- Inline event handlers in HTML: `onclick="functionName(${value})"`
- Event listener attachment in setup functions: `btn.addEventListener('click', () => ...)`

## Code Organization

- `shared/auth.js` (`293` lines): Reusable authentication component
- `shared/tema.js` (`143` lines): Reusable light/dark theme module (pure core + DOM appliers)
- `maquinas/app.js` (`~900` lines): Single monolithic app with all logic and rendering
- `refrigeracao/index.html` (`~1400` lines): Single HTML file with embedded CSS and JavaScript
- `mapa/mapa-dados.js` (Phase 10): single Supabase read/write door for the whole `mapa/` module — every query in the module goes through here, enforced by a permanent gate
- `mapa/mapa-geometria.js` (Phase 10): pure core of the map module — geodesic area, machine-compatibility rule, terrain vocabulary normalizers, geographic envelope, two-layer position resolution, module deep-link builder — no browser API, testable in Node
- `mapa/mapa-editor.js` (Phase 10): two edit modes layered on the existing map instance (draw service zone; position/reposition asset), each scoped by its own role list mirroring the write policy of the table it touches
- `mapa/planta-cmasm.geojson` (Phase 10): static vector floor plan of the CMASM area (117 features, 171 KB), converted once from a local `.osm` extract by `mapa/gerar-planta.mjs`, draws the base map with the network off

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Portal | App index and routing | `/index.html` |
| Refrigeracao App | Equipment maintenance tracking (v2.8) | `/refrigeracao/index.html` |
| Máquinas App | Cutting equipment lifecycle management | `/maquinas/index.html`, `/maquinas/app.js` |
| Shared Auth | Reusable role-based login module | `/shared/auth.js` |
| Shared Tema | Single light/dark theme implementation (detection, validation, application, toggle, persistence) for all 7 surfaces | `/shared/tema.js` |
| DB Schema | Data models and migrations | `/supabase/*.sql` |

## Pattern Overview

- **No build step** — HTML + vanilla JavaScript + Supabase JS SDK via CDN
- **Global state model** — Each app maintains arrays in memory (ATIVOS, PLANOS, MATERIAIS, OS_LIST, etc.)
- **Modal-driven CRUD** — All data entry through overlay modals
- **Event-driven rendering** — Functions re-render DOM sections on state changes
- **Role-based access** — Authentication layer maps users to roles (admin, gestor, tecnico, observador)
- **RLS-protected** — Database policies enforce row-level security; frontend security is UX-only

## Layers

- Purpose: HTML5 markup, CSS styling, vanilla JavaScript logic
- Location: `/index.html`, `/maquinas/index.html`, `/refrigeracao/index.html`, `/maquinas/app.js`
- Contains: View rendering, event handlers, modal state management, CSV export
- Depends on: Supabase JS SDK (CDN), browser APIs
- Used by: Web browsers (Vercel static delivery)
- Purpose: Role-based login and session management
- Location: `/shared/auth.js`, imported by `transportes`, `eletrica`, `fonoclama`, `predial`, `mapa` and `maquinas` (direct or via `shared/modulo-manutencao.js`); `refrigeracao` stays outside this base, frozen by user decision
- Contains: Cargo selection UI, password prompt, token exchange, session persistence
- Depends on: Supabase Auth API
- Used by: All frontend apps
- Purpose: Light/dark theme — detection (saved → `prefers-color-scheme` → dark default), closed-list validation, application, toggle and persistence
- Location: `/shared/tema.js`, consumed by the 6 modules via `shared/shell.js` (`aplicarShell()` → `iniciarTema()`) and by the portal (`/index.html`) directly, since the portal doesn't load the shared shell
- Contains: pure core (`normalizarTema`, `proximoTema`, no browser API — testable in Node) + DOM appliers (`detectarTema`, `temaAtual`, `aplicarTema`, `alternarTema`, `iniciarTema`)
- Depends on: `localStorage` (key `pmoc-tema`), `matchMedia('(prefers-color-scheme: light)')`, `data-theme="claro"|"escuro"` attribute on the root element
- Used by: All 7 surfaces (6 modules + portal); `refrigeracao` (frozen, D-04) and `mapa/xmap.css` (Leaflet skin, dark-only, D-01) stay outside; `/calibracao` (D-05) is outside too and has its own competing convention — `localStorage['cmasm_erp_theme']` with `dark`/`light` values, unrelated to `pmoc-tema` — so do not assume it follows this mechanism
- Purpose: Data access (read/write/delete)
- Location: Supabase JavaScript SDK (instantiated with URL + anon key)
- Contains: SQL queries via `.from()`, `.select()`, `.insert()`, `.update()`, `.delete()`
- Depends on: PostgreSQL, RLS policies
- Used by: All frontend state-management functions
- Purpose: Persistent storage with role-based access control
- Location: `/supabase/01_*.sql` through `/supabase/09_*.sql`
- Contains: Table schemas, RLS policies, triggers for auto-profile creation
- Depends on: PostgreSQL 13+
- Used by: Supabase API

## Data Flow

### Primary Request Path (Machines App Example)

### Secondary Flow: Refrigeration App

- **Scope:** Global (window scope in each app)
- **Mutability:** Direct array mutations (no immutability framework)
- **Synchronization:** Manual — each operation re-fetches via `carregarTudo()`
- **Consistency:** RLS policies enforce server-side constraints; client-side validation is UX helper only

## Key Abstractions

- Purpose: Represents a physical asset (machine, refrigeration unit)
- Examples: `maq_ativos` table, `ATIVOS[]` array in machines app
- Pattern: Serial ID + rich metadata (código, nome, categoria, status, uso_atual, etc.)
- Purpose: Recurring task template linked to asset type
- Examples: `maq_planos` table, `PLANOS[]` array
- Pattern: Type-model matching (`tipo_modelo` field) allows multiple plans per asset type
- Purpose: Instance of actual maintenance work performed
- Examples: `maq_os` table (UUID), `os_contratacao` table (refrigeration)
- Pattern: Links asset + plan + execution details (date, technician, cost)
- Purpose: Consumable or spare part with cost and stock tracking
- Examples: `maq_materiais` table, `arp_itens` table (refrigeration)
- Pattern: Quantity-based with minimum threshold alerts

## Entry Points

- Location: `/index.html`
- Triggers: Direct browser visit to domain root
- Responsibilities: Navigation hub, system status overview, links to app modules
- Location: `/maquinas/index.html` (loads `/maquinas/app.js`)
- Triggers: Browser visit to `/maquinas` (Vercel rewrite)
- Responsibilities:
- Location: `/refrigeracao/index.html` (single 436KB file, v2.8)
- Triggers: Browser visit to `/refrigeracao` (Vercel rewrite)
- Responsibilities:

## Architectural Constraints

- **Threading:** Single-threaded JavaScript event loop (no workers)
- **Global state:** All app data in `window` scope (ATIVOS, OS_LIST, MATERIAIS, PLANOS, etc. in `/maquinas/app.js:10`)
- **Circular imports:** None — no module bundler; all files loaded sequentially
- **Async patterns:** Promise-based Supabase queries; no callback nesting (uses `await`)
- **User identity:** Single session per browser tab; logout via `supa.auth.signOut()`
- **Network:** One request per action; no optimistic updates (waits for server response before re-render)
- **Offline:** Not supported; requires internet connection to Supabase at all times

## Anti-Patterns

### Missing Error Boundaries

### Overfetching on Every Edit

### No Data Validation at UI

### Inline Auth Code Instead of Shared Module

## Error Handling

- CRUD operations catch `error` from Supabase response: `if(error){ alert('Erro: '+error.message); return }`
- Failed queries prevent state update and re-render (user sees stale data)
- No automatic retry; manual page refresh required to recover
- RLS policy violations return "permission denied" error (expected for role-based access)

## Cross-Cutting Concerns

- User email authenticated against Supabase users table
- Role field in `usuarios` table determines feature visibility
- No fine-grained row-level permissions on UI (RLS policies are server-only)

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| supabase | "Use when doing ANY task involving Supabase. Triggers: Supabase products (Database, Auth, Edge Functions, Realtime, Storage, Vectors, Cron, Queues); client libraries and SSR integrations (supabase-js, @supabase/ssr) in Next.js, React, SvelteKit, Astro, Remix; auth issues (login, logout, sessions, JWT, cookies, getSession, getUser, getClaims, RLS); Supabase CLI or MCP server; schema changes, migrations, declarative schemas, security audits, Postgres extensions (pg_graphql, pg_cron, pg_vector)." | `.agents/skills/supabase/SKILL.md` |
| supabase-postgres-best-practices | "Postgres best practices maintained by Supabase, for Postgres running anywhere. Load this skill BEFORE writing or changing anything that lives in a Postgres database: creating or altering tables and columns (including choosing column types), schema design, migrations and declarative schema files, RLS policies and the tests that verify them, indexes, triggers, database functions, queues and scheduled jobs (pg_cron, pgmq), vector/semantic search (pgvector), and restoring dumps (pg_restore) or importing data. Also load it when diagnosing slow queries, high CPU, timeouts, EXPLAIN plans, connection exhaustion, locking, bloat, or rows visible to the wrong user or tenant. This is not just a performance guide — schema, migration, security, and SQL authoring tasks need these rules too, even for a one-column change or a single query." | `.agents/skills/supabase-postgres-best-practices/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
