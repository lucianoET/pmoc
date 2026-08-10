# Codebase Structure

**Analysis Date:** 2026-08-07

## Directory Layout

```
pmoc-overlay/
├── index.html                       # Portal — app index and navigation
├── vercel.json                      # Vercel rewrites + build config
├── docs/historico/                 # Registros de setup e incidentes resolvidos
├── README.md                        # Project overview
│
├── maquinas/                        # Cutting equipment maintenance app (v1.0)
│   ├── index.html                   # Main page + inline CSS + login UI
│   └── app.js                       # App logic, state, views, modals (41 KB)
│
├── refrigeracao/                    # HVAC equipment maintenance app (v2.8)
│   └── index.html                   # Single file (436 KB), inline everything
│
├── shared/                          # Reusable modules
│   └── auth.js                      # Role-based login component (ES6 class)
│
└── supabase/                        # Database schema + migrations
    ├── 01_maquinas_schema.sql       # Machines tables (maq_ativos, maq_planos, etc.)
    ├── 02_maquinas_seed.sql         # Initial data (7 machines, 59 plans, 34 materials)
    ├── 03_usuarios_cargos.sql       # User roles and auth trigger
    ├── 04_refrigeracao_schema.sql   # Equipment tables (equipamentos, plano_tarefas, etc.)
    ├── 05_refrigeracao_import_171.sql # 171 equipment records from CSV
    ├── 06_arp_04_2024_import.sql    # Public contracting catalog (ARP items)
    ├── 07_contratacoes_alinhamento.sql # Contracting alignment updates
    ├── 08_usuarios_refrigeracao.sql # Refrigeration user permissions
    └── 09_importa_frota_28.sql      # Fleet unit imports (v2.8)
```

## Directory Purposes

**Root:**
- Purpose: Vercel static hosting root; portal and config files
- Contains: HTML entry points, JSON config, markdown docs
- Key files: `index.html` (portal), `vercel.json` (routing rules)

**maquinas/:**
- Purpose: Machines/cutting equipment maintenance module
- Contains: Complete SPA for asset lifecycle tracking
- Key files: 
  - `index.html` — HTML structure + CSS design system + login overlay
  - `app.js` — State arrays, Supabase client init, all CRUD functions, render functions, modal handlers

**refrigeracao/:**
- Purpose: HVAC/refrigeration equipment maintenance module
- Contains: Single monolithic HTML file (436 KB) with inline CSS + JS
- Key files: `index.html` — Everything in one file for standalone operation

**shared/:**
- Purpose: Reusable authentication and utility modules
- Contains: ES6 class-based auth component
- Key files: `auth.js` — Importable `Auth` class for login flow (currently unused; machines app has inline version)

**supabase/:**
- Purpose: Database schema, migrations, and seed data
- Contains: PostgreSQL DDL, RLS policies, triggers, import scripts
- Key files: 01–09 executed in order during initial setup
  - 01–03: Machines schema + seed + user roles
  - 04–06: Refrigeration schema + seed + ARP catalog
  - 07–09: Updates and alignment patches

## Key File Locations

**Entry Points:**
- `/index.html` — Portal landing page (links to apps)
- `/maquinas/index.html` — Machines app (loads app.js)
- `/refrigeracao/index.html` — Refrigeration app (standalone)

**Configuration:**
- `/vercel.json` — Route rewrites (maps `/refrigeracao` → `/refrigeracao/index.html`, etc.)
- `/maquinas/app.js:2-5` — Supabase URL + anon key (public by design; RLS protects data)
- `/README.md:113-130` — Conventions and configuration notes

**Core Logic:**
- `/maquinas/app.js:10-12` — Global state initialization (ATIVOS[], OS_LIST[], MATERIAIS[], etc.)
- `/maquinas/app.js:50-69` — Data loading (`carregarTudo()` function)
- `/maquinas/app.js:71-508` — Render functions (renderPainel, renderAtivos, renderOS, renderMateriais, etc.)
- `/maquinas/app.js:509-703` — Modal handlers (abrirModalOS, salvarOS, abrirModalAtivo, etc.)
- `/maquinas/app.js:711-889` — Auth UI and initialization

**Database Schema:**
- `/supabase/01_maquinas_schema.sql:6-120` — `maq_ativos`, `maq_planos`, `maq_materiais`, `maq_plano_materiais`, `maq_uso_registros`, `maq_os`, `maq_estoque_movimentos`, `maq_abastecimentos`, `usuarios`, RLS policies
- `/supabase/04_refrigeracao_schema.sql:6-100` — `equipamentos`, `plano_tarefas`, `campanhas`, `logs_manutencao`, `arp_itens`, `os_contratacao`, `os_orcamento_itens`, `os_execucao`, `os_composicao`, `os_eventos`

**Testing:**
- No test files — manual/browser testing only
- Test data: SQL seed files (02, 05, 06, 09)

## Naming Conventions

**Files:**
- `index.html` — main SPA file per module
- `app.js` — application logic (only in machines, refrigeration is inline)
- SQL files: `NN_<module>_<purpose>.sql` (e.g., `01_maquinas_schema.sql`)

**Directories:**
- `/<module>/` — one directory per app (maquinas, refrigeracao)
- `/shared/` — reusable code
- `/supabase/` — database migrations

**HTML IDs and Classes:**
- Lowercase with hyphens: `login-screen`, `modal-ativo`, `tb-ativos`, `view-title`
- Form inputs: `<abbrev>-<field>` (e.g., `at-codigo`, `ab-data`, `os-ativo`)
- CSS classes: BEM-ish but flat (`.badge`, `.b-ok`, `.kpi`, `.kpi-l`)

**JavaScript Variables:**
- Global state arrays: UPPERCASE + plurals: `ATIVOS`, `OS_LIST`, `MATERIAIS`, `PLANOS`, `USUARIO`
- Functions: camelCase: `renderPainel()`, `carregarTudo()`, `abrirModalOS()`
- Local: lowercase/camelCase: `ativoId`, `planoId`, `totalPatrim`

**Database Tables:**
- Machines module: `maq_*` prefix (e.g., `maq_ativos`, `maq_planos`)
- Refrigeration module: no prefix (e.g., `equipamentos`, `plano_tarefas`)
- Shared: `usuarios` (user profiles)

**Database Columns:**
- Timestamp fields: `criado_em`, `registrado_em`, `updated_at` (timestamptz)
- Status fields: lowercase + underscores (e.g., `status in ('operante','inoperante','manutencao','baixado')`)
- Foreign keys: `<table>_id` (e.g., `ativo_id`, `plano_id`, `material_id`)

## Where to Add New Code

**New Feature in Machines App:**
- **Primary code:** `/maquinas/app.js`
  - Add global state array at top (line 10 area)
  - Add fetch function in `carregarTudo()` (line 50)
  - Add render function (e.g., `renderXyz()`)
  - Add modal handler (e.g., `abrirModalXyz()`, `salvarXyz()`)
- **HTML structure:** `/maquinas/index.html` (add view div + modal overlay)
- **CSS:** `/maquinas/index.html` `<style>` tag (match existing token design system)
- **Tests:** Create manual test checklist in TESTES.md

**New Feature in Refrigeration App:**
- **Primary code:** `/refrigeracao/index.html` (single file)
  - Append JavaScript at end in `<script>` tag
  - Add HTML structure (view div or modal)
  - Update CSS in `<style>` tag
- **Limitation:** File is 436 KB; consider splitting if exceeds 500 KB

**New Database Schema/Table:**
- **Location:** `/supabase/10_<module>_<feature>.sql` (follow sequence)
- **Pattern:** Use same RLS policy loop as 01_maquinas_schema.sql (lines 92–105)
- **Constraint:** Only additive (`CREATE TABLE IF NOT EXISTS`, never `DROP`); archive with `ativo = false` instead

**Shared Module (future):**
- **Location:** `/shared/<module>.js` (ES6 class or export)
- **Pattern:** Match `auth.js` style (default export + named exports)
- **Usage:** Import with `<script type="module">` in HTML

**New User Role:**
- **Location:** `/maquinas/app.js:713-718` (CARGOS array)
- **Pattern:** `{ label: 'Nome', email: 'email@cmasm.local', role: 'identificador' }`
- **Database:** Add role to `usuarios` table `role` field check constraint; update RLS policies as needed

## Special Directories

**supabase/:**
- Purpose: Version-controlled database migrations
- Generated: No — all hand-written SQL
- Committed: Yes — tracks schema evolution
- **Execution order:** Run 01–09 sequentially on first setup; new features add 10, 11, 12, etc.
- **Safety:** Never `DROP TABLE` or `DROP COLUMN`; archive inactive records with `ativo = false`

**.planning/:**
- Purpose: Generated codebase documentation (this file set)
- Generated: Yes — created by `/gsd-map-codebase` skill
- Committed: Yes — reference for team

**.claude/:**
- Purpose: Claude Code workspace settings
- Generated: Yes — created by Claude Code harness
- Committed: Selectively (settings.json for team, .local.json is personal)

**.remember/:**
- Purpose: Session memory cache (internal state)
- Generated: Yes — created by `/remember` skill
- Committed: No — temporary session files

## How to Add a New Module (Future Expansion)

1. Create directory: `/newfature/` (lowercase, hyphenated)
2. Create `/newfature/index.html` with:
   - Same CSS tokens as existing apps (copy from maquinas/index.html)
   - Single app container (or modular approach if large)
   - Link to Supabase JS SDK via CDN
3. Create `/newfature/app.js` (if >2000 lines) or inline in HTML
4. Create `/supabase/NN_newfature_schema.sql` with:
   - Table definitions
   - RLS policy loop (follow pattern from 01_maquinas_schema.sql)
5. Add route to `/vercel.json`:
   ```json
   { "source": "/newfature", "destination": "/newfature/index.html" }
   ```
6. Add navigation link to `/index.html` portal
7. Document in `README.md` (Apps section)

---

*Structure analysis: 2026-08-07*
