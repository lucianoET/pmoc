# External Integrations

**Analysis Date:** 2026-08-07

## APIs & External Services

**Supabase REST API:**
- **Purpose:** CRUD operations on PostgreSQL database
- **SDK/Client:** Supabase JS SDK v2 (`@supabase/supabase-js`)
- **Endpoint:** `https://thoaqipyhfmromsgzmjs.supabase.co`
- **Authentication:** Public anon key (JWT token)
  - Key embedded in: `maquinas/app.js:4` and `refrigeracao/index.html:345`
  - Protected by Row Level Security (RLS) policies on server side
- **Usage Examples:**
  - `supa.from('maq_ativos').select('*')` — Query machines
  - `supa.from('equipamentos').select('*')` — Query HVAC equipment
  - `supa.from('usuarios').select('*').eq('auth_id', uid).single()` — Fetch user profile

**File Storage:**
- **Type:** Local filesystem only (no external storage)
- **Current Usage:** Photos in refrigeration work orders (`os_execucao.foto`)
- **Limitation:** `foto` field is text-based URI placeholder; actual photo upload infrastructure not implemented
- **Location in Schema:** `supabase/04_refrigeracao_schema.sql:83`

## Data Storage

**Databases:**
- **Type:** PostgreSQL (managed)
- **Provider:** Supabase Cloud
- **Region:** sa-east-1 (São Paulo)
- **Project ID:** `thoaqipyhfmromsgzmjs`
- **Connection:** Via Supabase JS SDK only (no direct connection strings exposed)
- **Client:** Supabase SDK (wraps PostgREST API)
- **Database access:** REST API only; no direct PostgreSQL connections from frontend

**File Storage:**
- Not integrated — Images/photos stored as text URIs only
- Future implementation needed for file upload capability

**Caching:**
- None currently implemented
- Supabase provides automatic row-level caching at database layer
- Consider: Browser localStorage for session/form state (not currently implemented)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL-backed auth system)

**Implementation Approach:**
- Email-based login with hardcoded role accounts
- Four role accounts pre-configured in `supabase/03_usuarios_cargos.sql`:
  - `direcao@cmasm.local` → role: `admin`
  - `gestor@cmasm.local` → role: `gestor`
  - `tecnico@cmasm.local` → role: `tecnico`
  - Anonymous user → role: `observador`
- Passwords: Bcrypt hashed in PostgreSQL
- Session: Supabase JWT tokens (stored in browser memory)
- User profiles: Linked via `auth.users.id` → `usuarios.auth_id` with FK constraint

**Auth Flow:**
1. User selects role button → displays email (hidden from user)
2. User enters password
3. Supabase Auth validates against `auth.users` table
4. JWT session token returned
5. `carregarUsuario(uid)` fetches `usuarios` record for profile data
6. Auth state persisted via `supa.auth.getSession()` on page load

**Session Management:**
- Supabase SDK manages session persistence automatically
- No manual token refresh required (SDK handles expiry)
- Logout: `supa.auth.signOut()` — clears session

**RLS Policies:**
- All data tables protected by RLS
- Policies defined in migrations:
  - `01_maquinas_schema.sql:92-106` — Machines
  - `04_refrigeracao_schema.sql:101-113` — Refrigeration
- All authenticated users can `select`, `insert`, `update`, `delete` (no fine-grained row filtering)
- Purpose: Prevent anonymous access; role-based UI filtering happens client-side

## Monitoring & Observability

**Error Tracking:**
- None detected — No Sentry, Rollbar, or error service integration
- Error handling is client-side only (console logs, UI alerts)

**Logs:**
- **Database:** Supabase provides built-in query logs (accessible via dashboard)
- **Application:** `os_eventos` table stores audit trail for refrigeration workflow
  - Location: `supabase/04_refrigeracao_schema.sql:94-99`
  - Tracks: event type, detail, user, timestamp
- **Frontend:** Console logs only (no centralized logging service)
- **Analytics:** Not implemented

**Debugging:**
- `supa.auth.getSession()` returns current session for testing
- Direct SQL inspection available via Supabase dashboard
- Vercel deployment logs available via Vercel dashboard

## CI/CD & Deployment

**Hosting:**
- **Platform:** Vercel (static hosting)
- **Repository:** GitHub (`luctronics-ET/pmoc`)
- **Deployment:** Git push to main → automatic Vercel build
- **Build Command:** None (configured as "Other" with empty build command)
- **Output Directory:** `.` (current directory)
- **Custom Domain:** Configured at pmoc.vercel.app (optional custom domain available)

**CI Pipeline:**
- GitHub Actions (implicit via Vercel GitHub app)
- No custom CI rules or checks implemented
- No test suite to run

**Pre-deployment Checklist:**
- Supabase Site URL must match Vercel domain (configured in Supabase Auth settings)
- Required: `https://pmoc.vercel.app` in Supabase Auth → Configuration → Site URL

## Environment Configuration

**Required env vars:**
- None required — Credentials hardcoded in JavaScript files
- **Supabase Project URL:** `https://thoaqipyhfmromsgzmjs.supabase.co`
- **Supabase Anon Key:** Embedded in app source code

**Secrets location:**
- Supabase Project Settings → API keys (dashboard only)
- No `.env` file used
- **Risk:** Anon key is publicly visible in source code by design (secured by RLS)

**Configuration files:**
- `vercel.json` — URL rewrites, clean URLs
- `supabase/*.sql` — Database migrations (version control)
- No separate config files for different environments

## Webhooks & Callbacks

**Incoming:**
- None detected — No webhook endpoints for external services

**Outgoing:**
- None implemented currently
- Future: Could be added via Supabase Edge Functions (not currently used)

**Database Triggers:**
- **Auto user profile creation:** `on_auth_user_created` trigger
  - Location: `supabase/01_maquinas_schema.sql:108-119`
  - Fires on: `auth.users` INSERT
  - Action: Auto-creates `usuarios` record with default role assignment
  - First user → role `admin`, subsequent users → role `tecnico`

## Third-Party Data Imports

**Refrigeration Equipment:**
- Source: `docs/Mapeamento_da_Refrigeração_ATU_em_29_DE_ABRIL_2026.ods`
- Imported via: `supabase/05_refrigeracao_import_171.sql`
- Data: 171 HVAC units (136 operational, 35 non-operational)

**Procurement Contract (ARP):**
- Source: Public procurement ata (SRP 04/2024)
- Imported via: `supabase/06_arp_04_2024_import.sql`
- Data: 19 line items across 2 purchase orders (NE 2026NE000334, 2026NE000335)
- Total value: R$ 66.447,86

**Machines & Maintenance Plans:**
- Source: Original system (data migrated)
- Imported via: `supabase/01_maquinas_schema.sql` + `supabase/02_maquinas_seed.sql`
- Data: 7 cutting machines, 59 maintenance plans, 34 spare parts

## External API Calls

**Supabase SDK Calls by App:**

**maquinas/app.js:**
```javascript
// Auth
supa.auth.getSession()
supa.auth.onAuthStateChange(...)
supa.auth.signOut()

// Data fetching (parallelized in carregarTudo())
supa.from('maq_ativos').select('*').order('codigo')
supa.from('maq_os').select('*, maq_ativos(*), maq_planos(*)').order('data_abertura')
supa.from('maq_materiais').select('*').order('nome')
supa.from('maq_planos').select('*').eq('ativo', true)
supa.from('maq_plano_materiais').select('*, maq_materiais(*)')
supa.from('maq_abastecimentos').select('*, maq_ativos(*)').order('data', {ascending:false})
supa.from('maq_uso_registros').select('*, maq_ativos(*)').order('registrado_em', {ascending:false})

// CRUD operations (insert, update, delete patterns used for all tables)
supa.from('maq_ativos').insert({...})
supa.from('maq_ativos').update({...}).eq('id', id)
```

**refrigeracao/index.html:**
- Similar pattern: Auth flow, then parallel SELECT queries on 11 refrigeration tables
- Additional: Complex JOIN queries for work order workflows (contratação)

## Rate Limiting & Quotas

- **Supabase Free Tier** (if applicable):
  - Not explicitly documented in codebase
  - Assumption: Project is paid tier (production data volume of 171 HVAC units + 7 machines)
  - No client-side rate limiting implemented

## Data Export / Integration Points

**CSV Export:**
- Machines app: "Lista de compras" view exports materials to CSV for procurement process
- Location: `maquinas/index.html` — renderCompras() function
- Format: Material name, quantity, unit, total cost

**PDF Reports:**
- Refrigeration: QR code generation and print-friendly layouts
- Photos in refrigeration: `os_execucao.foto` field for attachment

---

*Integration audit: 2026-08-07*
