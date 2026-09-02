<!-- refreshed: 2026-08-07 -->
# Architecture

**Analysis Date:** 2026-08-07

## System Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│                    Vercel (Static Hosting)                         │
│  Rewrites: /refrigeracao → /refrigeracao/index.html                │
│           /maquinas → /maquinas/index.html                         │
└────────────────────────┬───────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼────┐      ┌────▼──────┐   ┌───▼───────────┐
    │ Portal │      │Refrigeracao│   │Máquinas (app) │
    │index.  │      │/index.html │   │/index.html    │
    │html    │      │(v2.8, 436KB)   │+app.js        │
    └───┬────┘      └────┬──────┘   └───┬───────────┘
        │                │              │
        └────────────────┼──────────────┘
                         │
        ┌────────────────▼────────────────┐
        │   Supabase JS SDK (CDN v2)      │
        │ @supabase/supabase-js           │
        └────────────────┬────────────────┘
                         │
        ┌────────────────▼────────────────────────────────┐
        │      PostgreSQL (Supabase Backend)              │
        ├────────────────────────────────────────────────┤
        │ Schema: maquinas (7 assets, 59 plans)           │
        │ Schema: refrigeracao (171 equipment)            │
        │ Shared: usuarios (role-based)                   │
        │ RLS Policies: All tables have public+auth       │
        └─────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Portal | App index and routing | `/index.html` |
| Refrigeracao App | Equipment maintenance tracking (v2.8) | `/refrigeracao/index.html` |
| Máquinas App | Cutting equipment lifecycle management | `/maquinas/index.html`, `/maquinas/app.js` |
| Shared Auth | Reusable role-based login module | `/shared/auth.js` |
| DB Schema | Data models and migrations | `/supabase/*.sql` |

## Pattern Overview

**Overall:** Single-Page Application (SPA) Multi-Module Architecture

**Key Characteristics:**
- **No build step** — HTML + vanilla JavaScript + Supabase JS SDK via CDN
- **Global state model** — Each app maintains arrays in memory (ATIVOS, PLANOS, MATERIAIS, OS_LIST, etc.)
- **Modal-driven CRUD** — All data entry through overlay modals
- **Event-driven rendering** — Functions re-render DOM sections on state changes
- **Role-based access** — Authentication layer maps users to roles (admin, gestor, tecnico, observador)
- **RLS-protected** — Database policies enforce row-level security; frontend security is UX-only

## Layers

**Frontend (Client):**
- Purpose: HTML5 markup, CSS styling, vanilla JavaScript logic
- Location: `/index.html`, `/maquinas/index.html`, `/refrigeracao/index.html`, `/maquinas/app.js`
- Contains: View rendering, event handlers, modal state management, CSV export
- Depends on: Supabase JS SDK (CDN), browser APIs
- Used by: Web browsers (Vercel static delivery)

**Auth Layer:**
- Purpose: Role-based login and session management
- Location: `/shared/auth.js`, inline auth code in `/maquinas/app.js`
- Contains: Cargo selection UI, password prompt, token exchange, session persistence
- Depends on: Supabase Auth API
- Used by: All frontend apps

**API Layer:**
- Purpose: Data access (read/write/delete)
- Location: Supabase JavaScript SDK (instantiated with URL + anon key)
- Contains: SQL queries via `.from()`, `.select()`, `.insert()`, `.update()`, `.delete()`
- Depends on: PostgreSQL, RLS policies
- Used by: All frontend state-management functions

**Database Layer:**
- Purpose: Persistent storage with role-based access control
- Location: `/supabase/01_*.sql` through `/supabase/09_*.sql`
- Contains: Table schemas, RLS policies, triggers for auto-profile creation
- Depends on: PostgreSQL 13+
- Used by: Supabase API

## Data Flow

### Primary Request Path (Machines App Example)

1. **Init on page load** (`/maquinas/index.html:20`)
   - `init()` checks for active session
   - If session exists: `carregarUsuario(session.user.id)` → fetch user profile from `usuarios` table
   - Trigger `mostrarApp()` → hide login, show app UI

2. **Load all data** (`/maquinas/app.js:50-69`)
   - `carregarTudo()` runs 7 parallel Supabase queries:
     - `maq_ativos.select('*')`
     - `maq_os.select('*, maq_ativos(*), maq_planos(*)')`
     - `maq_materiais.select('*')`
     - `maq_planos.select('*').eq('ativo', true)`
     - `maq_plano_materiais.select('*, maq_materiais(*)')`
     - `maq_abastecimentos.select('*, maq_ativos(*)')`
     - `maq_uso_registros.select('*, maq_ativos(*)')`
   - Data stored in global arrays: `ATIVOS[]`, `OS_LIST[]`, `MATERIAIS[]`, etc.
   - Trigger render functions: `renderPainel()`, `renderAtivos()`, `renderOS()`, etc.

3. **User interaction** (example: register maintenance task)
   - Click "Registrar OS" → `abrirModalOS(ativoId, planoId)`
   - Modal populates selectors with current data
   - User fills form, clicks "Salvar"
   - `salvarOS()` inserts to `maq_os` + updates `maq_ativos.uso_atual` + inserts `maq_uso_registros` + decrements `maq_materiais.estoque_atual`
   - On success: `fecharModal()` + `carregarTudo()` reloads all data and re-renders

4. **Output/Response** (`/maquinas/app.js:67-68`)
   - All views re-render based on updated global state
   - User sees changes immediately in tables/KPIs
   - No page reload

### Secondary Flow: Refrigeration App

1. Load equipment list from `equipamentos` table
2. Fetch maintenance tasks from `plano_tarefas` (filtered by role)
3. Render in grid/table format
4. Modal-driven workflow: budget → execution → certification → audit
5. QR code generation for inspection tasks
6. CSV export for public contracting (CATMAT)

**State Management:**
- **Scope:** Global (window scope in each app)
- **Mutability:** Direct array mutations (no immutability framework)
- **Synchronization:** Manual — each operation re-fetches via `carregarTudo()`
- **Consistency:** RLS policies enforce server-side constraints; client-side validation is UX helper only

## Key Abstractions

**Active (Ativo):**
- Purpose: Represents a physical asset (machine, refrigeration unit)
- Examples: `maq_ativos` table, `ATIVOS[]` array in machines app
- Pattern: Serial ID + rich metadata (código, nome, categoria, status, uso_atual, etc.)

**Maintenance Plan (Plano):**
- Purpose: Recurring task template linked to asset type
- Examples: `maq_planos` table, `PLANOS[]` array
- Pattern: Type-model matching (`tipo_modelo` field) allows multiple plans per asset type

**Work Order (OS):**
- Purpose: Instance of actual maintenance work performed
- Examples: `maq_os` table (UUID), `os_contratacao` table (refrigeration)
- Pattern: Links asset + plan + execution details (date, technician, cost)

**Material/Part:**
- Purpose: Consumable or spare part with cost and stock tracking
- Examples: `maq_materiais` table, `arp_itens` table (refrigeration)
- Pattern: Quantity-based with minimum threshold alerts

## Entry Points

**Portal:**
- Location: `/index.html`
- Triggers: Direct browser visit to domain root
- Responsibilities: Navigation hub, system status overview, links to app modules

**Machines App:**
- Location: `/maquinas/index.html` (loads `/maquinas/app.js`)
- Triggers: Browser visit to `/maquinas` (Vercel rewrite)
- Responsibilities:
  - Dashboard with KPIs (total assets, operational status, maintenance deadlines, stock alerts)
  - Asset inventory and lifecycle tracking
  - Maintenance plan scheduling and overdue detection
  - Consumable inventory with low-stock alerts
  - Fuel consumption tracking by machine and operator
  - Depreciation and cost-per-hour calculations
  - Shopping list export (CSV for procurement)

**Refrigeration App:**
- Location: `/refrigeracao/index.html` (single 436KB file, v2.8)
- Triggers: Browser visit to `/refrigeracao` (Vercel rewrite)
- Responsibilities:
  - 171-unit equipment inventory
  - Work order lifecycle: budget → execution → certification → audit
  - ARP (Ata de Registro de Preço) item linking for public contracting
  - QR code generation for field inspection
  - Print-friendly forms

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

**What happens:** Failed queries show browser `alert()` with raw error message; UI may enter inconsistent state if async operation fails mid-sequence
**Why it's wrong:** User can't recover cleanly; subsequent operations may fail silently or crash; no error logging for debugging
**Do this instead:** Wrap `carregarTudo()` calls in try-catch; show user-friendly error UI; optionally log to server-side error tracking (Sentry, etc.)

### Overfetching on Every Edit

**What happens:** Each save operation triggers full `carregarTudo()` re-fetch of all 7 tables
**Why it's wrong:** 100+ records × 7 tables = significant latency; scales poorly as data grows
**Do this instead:** Implement optimistic updates + targeted queries; only re-fetch modified table or use delta updates

### No Data Validation at UI

**What happens:** `alert()` prompts check only presence of required fields (e.g., `if(!ativo_id || !data)`)
**Why it's wrong:** Invalid data (negative hours, future dates) passes through; no format validation (e.g., email in user input fields)
**Do this instead:** Add schema validation library (e.g., Zod); show inline errors; validate before insert

### Inline Auth Code Instead of Shared Module

**What happens:** `/maquinas/app.js` duplicates full auth UI inline (lines 720-889); `/shared/auth.js` exists but not used
**Why it's wrong:** Hard to update auth flow; duplication creates maintenance burden; refrig app has different auth pattern
**Do this instead:** Refactor all apps to use `/shared/auth.js` as importable ES module; test once, use everywhere

## Error Handling

**Strategy:** Client-side try-catch with user alerts; no centralized error handler

**Patterns:**
- CRUD operations catch `error` from Supabase response: `if(error){ alert('Erro: '+error.message); return }`
- Failed queries prevent state update and re-render (user sees stale data)
- No automatic retry; manual page refresh required to recover
- RLS policy violations return "permission denied" error (expected for role-based access)

## Cross-Cutting Concerns

**Logging:** None — no structured logging library; debugging via browser console

**Validation:** Client-side only — `if()` checks for required fields; database constraints (e.g., `check (status in (...))`) provide server-side safety

**Authentication:** Role-based via Supabase Auth + local cargo lookup:
- User email authenticated against Supabase users table
- Role field in `usuarios` table determines feature visibility
- No fine-grained row-level permissions on UI (RLS policies are server-only)

---

*Architecture analysis: 2026-08-07*
