# Technology Stack

**Analysis Date:** 2026-08-07

## Languages

**Primary:**
- HTML5 - Portal and app markup
- JavaScript (ES6+) - All frontend logic and client-side operations
- SQL (PostgreSQL) - Database schema, migrations, and RLS policies

## Runtime

**Environment:**
- Browser-based (client-side execution)
- No Node.js or server-side runtime required

**Package Manager:**
- None — Zero build process; no npm, yarn, or package.json
- All dependencies delivered via CDN

## Frameworks

**Core:**
- Vanilla JavaScript — No framework dependencies (React, Vue, Svelte not used)

**Build/Dev:**
- None — Static HTML + JS files deployed directly
- Vercel handles static asset hosting and URL rewrites via `vercel.json`

## Key Dependencies

**Critical:**
- **Supabase JS SDK** (v2) - Client library for PostgreSQL, Auth, and RLS
  - Loaded via: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`
  - Location: Referenced in `maquinas/index.html:8` and `refrigeracao/index.html:341`
  - Why: Entire backend communication (database queries, auth, real-time)

**Infrastructure:**
- **PostgreSQL** (via Supabase) - Relational database
  - Region: sa-east-1 (São Paulo)
  - Hosted by: Supabase Cloud
  - Version: Managed by Supabase (not user-specified)

**CDN:**
- **jsDelivr** - CDN for Supabase JS SDK distribution

## Configuration

**Environment:**
- Supabase credentials hardcoded in HTML files:
  - `maquinas/app.js:3-4` — `SUPA_URL` and `SUPA_KEY`
  - `refrigeracao/index.html:344-345` — Same credentials (shared project)
- No `.env` file or environment variable system
- No build-time configuration

**Build:**
- `vercel.json` — Static file serving configuration:
  - Rewrites `/refrigeracao` → `/refrigeracao/index.html`
  - Rewrites `/maquinas` → `/maquinas/index.html`
  - Clean URLs enabled (`cleanUrls: true`)

**Authentication:**
- Supabase Auth (email + password)
- Role-based access control via Row Level Security (RLS) policies
- Four role groups configured: `admin`, `gestor`, `tecnico`, `observador`
- User profiles stored in `usuarios` table with `role` field

## Database Schema

**Machines (Máquinas):**
- `maq_ativos` — Equipment inventory
- `maq_planos` — Maintenance plans by equipment type
- `maq_materiais` — Spare parts and consumables
- `maq_plano_materiais` — Plan-to-material mappings
- `maq_uso_registros` — Usage hours/km tracking
- `maq_os` — Work orders
- `maq_estoque_movimentos` — Inventory movements
- `maq_abastecimentos` — Fuel consumption logs

**Refrigeration (Refrigeração):**
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

**User Management:**
- `usuarios` — User profiles linked to auth.users

## Platform Requirements

**Development:**
- Modern browser with ES6 support (Chrome, Firefox, Safari, Edge)
- Text editor or IDE for editing HTML/JS files
- Git for version control
- (Optional) Local web server for development (e.g., `python -m http.server`)

**Production:**
- **Deployment target:** Vercel (configured via GitHub integration)
- **Static hosting:** No server-side rendering required
- **Custom domain:** Optional (can use vercel.app domain)
- **Database:** Supabase managed PostgreSQL instance
- **SSL/TLS:** Automatic via Vercel and Supabase

**Browser Support:**
- ES6 JavaScript required (no transpilation or polyfills)
- CSS variables required (no fallbacks)
- No specific version minimums documented

## Feature Flags

**Apps Active:**
- ✅ PMOC Refrigeração (v2.8) — 171 HVAC units, procurement workflows
- ✅ PMOC Máquinas (v1.0) — 7 cutting machines, maintenance by hour
- 📋 Portal (index.html) — Landing page and app navigation

**Planned (not implemented):**
- Fonoclama (70V PA system)
- Transportes (vehicles and vessels)
- Elétrica (electrical infrastructure)
- Calibração (metrology instruments)

---

*Stack analysis: 2026-08-07*
