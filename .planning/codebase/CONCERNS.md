# Codebase Concerns

**Analysis Date:** 2026-08-07

## Security Issues

### Hardcoded Credentials in Source Code

**Issue:** Supabase URL and anonymous API key are embedded directly in application files
**Files:** 
- `maquinas/app.js` (lines 3-4)
- `refrigeracao/index.html` (similar embedding)

**Impact:** 
- Keys visible in version control and deployed code
- Anonymous key is intended to be public, but co-location with private URLs creates audit risk
- Credentials are cached in browser DevTools/network requests
- No key rotation mechanism

**Fix approach:** 
- Move credentials to environment variables (`.env` at build or deploy time)
- Use Vercel Environment Variables or Supabase project settings integration
- Implement credential injection at deployment stage
- Document in `.gitignore` any `.env` files containing actual keys

### Default Credentials Not Changed

**Issue:** Documentation explicitly mentions default password `cmasm2026` for all roles
**Files:** 
- `README.md` (line 100)
- `SETUP.md` (default password documented)

**Current state:** 
- Password is same for all role-based accounts (direcao@cmasm.local, gestor@cmasm.local, tecnico@cmasm.local)
- Documented in setup guide (reduces operational security)
- No enforced password change on first login

**Risk:** Medium — internal system but credentials are standard across all installations

**Fix approach:** 
- Implement forced password change on first login
- Generate unique temporary passwords per installation
- Remove default password from public documentation
- Add password reset workflow

### Overly Permissive Row Level Security (RLS)

**Issue:** Database RLS policies allow all authenticated users full CRUD access to all tables
**Files:** 
- `supabase/01_maquinas_schema.sql` (lines 92-105)
- `supabase/04_refrigeracao_schema.sql` (lines 101-113)

**Pattern:** 
```sql
create policy %I on %I for select using (true)
create policy %I on %I for insert to authenticated with check (true)
```

**Impact:**
- Any logged-in user can read, create, update, and delete all records
- No data segregation by role (admin/gestor/tecnico/observador)
- `observador` role grants full write access despite being intended as read-only
- No audit trail of who modified what data
- Técnico can approve their own work orders

**Fix approach:**
- Implement role-based row security: `auth.jwt() ->> 'role'` checks
- Restrict insert/update/delete to admin and gestor roles
- Implement approval workflows at application level with audit logging
- Create audit table `_audit_log` to track changes by user/timestamp
- Use `rls_bypass_jwt` for service-to-service operations only

---

## Tech Debt

### Monolithic Single-File Application

**Issue:** `maquinas/app.js` contains 888 lines of unmodularized code
**Files:** `maquinas/app.js`

**Problems:**
- No function/module separation (all functions global scope)
- Difficult to test individual features
- Tight coupling between UI rendering and data logic
- No dependency injection or state management framework
- Maintenance burden increases linearly with features
- Hard to onboard new developers

**Current structure:**
- Authentication mixed with app initialization
- Data loading (`carregarTudo`) calls 7 database queries in parallel with no retry logic
- Rendering functions (renderAtivos, renderOS, etc.) directly manipulate DOM via innerHTML
- Business logic (calcVencimentos, calcCiclo) embedded in UI layer

**Fix approach:**
- Extract data layer into separate module (`data.js`): query functions returning promises
- Extract UI components into separate functions with clear input/output
- Move state management to dedicated `state.js` (current global vars)
- Create utilities module (`utils.js`) for formatting and calculations
- Maintain vanilla JS (no framework dependency) but use ES6 modules

---

### Global State Management Without Guarantees

**Issue:** Heavy reliance on global mutable variables without initialization safety
**Files:** `maquinas/app.js` (lines 10-12)

**Current state:**
```javascript
let ATIVOS = [], OS_LIST = [], MATERIAIS = [], PLANOS = [], PLANO_MATS = [], ABASTS = [], USOS = []
let USUARIO = null
let ATIVO_EDIT_ID = null
```

**Problems:**
- Race conditions: functions may read stale data during `carregarTudo()` execution
- No guarantee data is loaded before rendering
- Difficult to debug (state changes happen everywhere)
- Testing requires globals to be manually reset
- User can trigger race: submit data before carregarTudo() completes

**Scenarios:**
- Click "nova OS" before carregarTudo() finishes → ATIVOS is old
- Rapid tab switching → mixed data states possible
- No loading spinner prevents concurrent operations

**Fix approach:**
- Add loading state flag to prevent concurrent data fetches
- Implement data loading queue with cancel token
- Use Promise-based initialization chain
- Add null-check guards before any state access
- Display "carregando..." overlay during fetch

---

### Missing Error Handling in Async Operations

**Issue:** Multiple async functions silently fail or show generic alerts
**Files:** `maquinas/app.js`

**Examples without error recovery:**
- `carregarTudo()` (line 50-69): Promise.all() will reject if any query fails; no error state
- `salvarAbastecimento()` (line 415-430): Shows only alert on error, no recovery UI
- `salvarOS()` (line 544-602): Multiple sequential awaits, any failure leaves partial state
- `carregarUsuario()` (line 27-32): No null check on USUARIO before accessing
- `_carregarPerfil()` in auth.js (line 262-268): Silently ignores if user not in table

**Impact:**
- User thinks save succeeded when server error occurred
- Partial updates can corrupt data (e.g., OS created but user record not updated)
- No feedback when database is unreachable
- Network timeouts show no message

**Fix approach:**
- Wrap all Supabase calls in try/catch with specific error messages
- Implement error recovery: retry with exponential backoff for transient failures
- Show toast notifications (not modal alerts) for errors
- Log errors to console for debugging
- Add fallback UI when data load fails (empty state with "retry" button)

---

### Insufficient Data Validation

**Issue:** Minimal client-side validation; no database constraints for data integrity
**Files:** 
- `maquinas/app.js` (lines 415-427, 544-551 for validation)
- `supabase/01_maquinas_schema.sql` (numeric fields lack NOT NULL / check constraints)

**Examples:**
- `salvarAbastecimento()`: Only checks `!ativo_id || !litros` — doesn't validate litros > 0
- `salvarAtivo()`: No validation that `uso_atual` is not negative
- `salvarMovimento()`: Allows negative inventory (line 698: `novo = ... + quantidade`)
- Prices in `maq_materiais` can be negative or NULL, breaking cost calculations
- `maq_os.custo_pecas` and `custo_mo` can be NULL, causing NaN in math

**Database issues:**
- Numeric fields should have `CHECK (valor >= 0)` constraints
- Required fields like `maq_abastecimentos.litros` should be NOT NULL
- `maq_ativos.uso_atual` should have `NOT NULL DEFAULT 0` and `CHECK (>= 0)`

**Fix approach:**
- Add database constraints: `NOT NULL`, `CHECK (value > 0)` for measurements/prices
- Add client-side validation before every form submit (especially numeric inputs)
- Implement consistent error messages for validation failures
- Display validation errors inline (not modal alerts)
- Sanitize text inputs to prevent injection

---

## Data Integrity Concerns

### Missing Foreign Key Cascade Rules

**Issue:** `maq_os.ativo_id` lacks `ON DELETE CASCADE`
**Files:** `supabase/01_maquinas_schema.sql` (line 54)

**Current definition:**
```sql
ativo_id integer references maq_ativos(id),  -- ⚠️ no ON DELETE
```

**Impact:**
- If an asset (maq_ativos) is deleted, orphaned work orders remain in database
- Queries will fail when trying to join deleted asset
- Reports will show "?" for asset name (see line 221: `o.maq_ativos?.codigo||'?'`)
- Data becomes inconsistent over time

**Fix approach:**
- Alter table to add: `ON DELETE CASCADE`
- Add index on `ativo_id` for query performance
- Same fix needed for any table referencing deleted parent

---

### Untracked Inventory Adjustments

**Issue:** `salvarMovimento()` directly modifies stock without audit trail
**Files:** `maquinas/app.js` (lines 691-703)

**Problem:**
- Inventory movement calculated in application (line 698): `novo = mat.estoque_atual + quantidade`
- Concurrent requests could cause double-apply or lost updates (race condition)
- No validation that result doesn't go negative
- Audit trail only created in `maq_estoque_movimentos`, not timestamp on material record

**Scenario:** 
1. Stock = 5
2. User A adjusts +3 (submitted as form)
3. User B adjusts -5 (submitted as form)
4. Both see "5" before reading; both calculate at same time; race condition → unexpected final value

**Fix approach:**
- Implement database trigger: `BEFORE UPDATE on maq_materiais` to validate estoque_atual >= 0
- Use `FOR UPDATE` locking in Supabase queries (if supported)
- Increment/decrement in database trigger instead of application
- Add `updated_at` timestamp to material records
- Validate final inventory won't be negative before committing

---

### Data Divergence - ARP/RLP Mismatch

**Issue:** Documented inconsistency in financial records (R$ 3.541,02 difference)
**Files:** 
- `README.md` (line 126)
- `SETUP.md` (lines 87-90)

**Current state:**
- MCP (Manutenção Cost Planning) total: R$ 43.467,13
- NE334 (Purchase Order from RLP): R$ 39.926,11
- **Difference: R$ 3.541,02** (remains unresolved)

**Impact:**
- Financial audits will flag this discrepancy
- Procurement records don't match budget planning
- Cannot calculate actual ROI/cost of contracts
- May indicate missing line items or quantity adjustments

**Risk:** High (affects compliance and procurement accuracy)

**Resolution approach:**
- Obtain detailed NE334 breakdown from supplier (RLP COMÉRCIO E SERVIÇOS)
- Compare against `docs/` spreadsheets item-by-item
- Adjust `arp_itens.quantidade_registrada` if quantities were reduced
- Create `arp_adjustments` audit table documenting changes and reasons
- Implement monthly reconciliation process

---

### Invalid Asset Specification (Refrigeration)

**Issue:** Equipment specification mismatch between asset and ARP items
**Files:** 
- `supabase/05_refrigeracao_import_171.sql` (equipamentos table)
- `SETUP.md` (lines 92-94)

**Problem:** Trane TDXS30000A000 units specified as:
- Assets: **30 TR** (Tons of Refrigeration)
- ARP items 1365/1366 (WINS supplier): **12 TR / 144.000 BTU**

**Impact:**
- Purchase orders may be for wrong cooling capacity
- Maintenance work orders reference wrong specifications
- Cost calculations based on incorrect BTU ratings
- Performance monitoring will show anomalies

**Fix approach:**
- Verify actual unit specifications in installation docs
- Update `equipamentos.btu` field if asset specs were wrong
- Confirm which items are actually installed (30 TR or 12 TR)
- Split or consolidate ARP items if multiple units installed
- Document in `equipamentos.obs` field the actual vs. listed specs

---

## Performance & Scaling Concerns

### Unoptimized Data Loading

**Issue:** `carregarTudo()` loads entire datasets without pagination
**Files:** `maquinas/app.js` (lines 50-69)

**Queries:**
```javascript
supa.from('maq_ativos').select('*').order('codigo')          // all assets
supa.from('maq_os').select('*, maq_ativos(...), maq_planos(...)') // all work orders
```

**Current limits (not enforced):**
- OS list sliced to 100 in rendering (line 219): `OS_LIST.slice(0,100)`
- No server-side pagination
- Full joins with related tables fetched for all rows
- Asset list rendered without limit

**Scalability issues:**
- At 1000+ assets: single page load could transfer 100+ KB of JSON
- Mobile users on slow connection will timeout
- Browser rendering 1000 rows in table is sluggish
- Every data change triggers full reload

**Current scale (acceptable for now):**
- 7 machines, 171 refrigeration units, ~50 OS records
- Performance acceptable, but fragile for growth

**Fix approach:**
- Implement server-side pagination: `.range(0, 50)` with next/prev buttons
- Cache full data client-side only for view-specific subsets
- Add search/filter at database level (not client-side)
- Lazy-load work order details on expand
- Implement virtual scrolling if table exceeds 100 rows

---

### Browser Memory Leaks with Large Files

**Issue:** `refrigeracao/index.html` reported as 436 KB single file
**Files:** `refrigeracao/index.html`

**Problems:**
- Entire app (HTML + CSS + JS) in one file
- Browser parses/loads entire file upfront
- No code splitting by feature
- CSS not reused between apps (maquinas and refrigeracao both have duplicate styles)
- No service worker caching strategy

**Impact:**
- Slow initial load (especially on mobile)
- Slower cold cache performance
- Higher bandwidth for repeat visits

**Fix approach:**
- Extract shared CSS to `shared/styles.css`, include via `<link>`
- Extract shared auth to `shared/auth.js` as module (already done in auth.js)
- Compress HTML (minify CSS/JS inline)
- Move to build step if performance critical (e.g., Next.js or Vite)

---

## Data Loss/Recovery Risks

### Previous Project Permanently Deleted

**Issue:** Original Supabase project `hssqrdeurwzkigqudzpf` was deleted and cannot be recovered
**Files:** 
- `SETUP.md` (lines 51-57)
- `README.md` (no mention; recovery handled offline)

**What was lost:**
- 171 refrigeration equipment records
- 19 ARP contract line items  
- 2 work orders for contracted maintenance
- 12 user accounts
- Maintenance history (logs_manutencao table was empty)

**Current state:** Data reimported from ODS spreadsheets (lines 60-67 in SETUP.md) — numbers verified to match

**Risk:** Medium — historical maintenance logs were not preserved (no prior history to lose)

**Prevention for future:**
- Enable automated backups in Supabase dashboard (Settings → Backups)
- Export full database monthly to `.sql` file in repo (supabase/backups/)
- Implement backup workflow: `supabase db dump > backups/$(date +%Y-%m-%d).sql`
- Document backup restore procedure
- Test restore on staging monthly

---

## Code Quality Issues

### Inconsistent Null/Undefined Handling

**Issue:** Mixed approaches to missing data (some use `?.` optional chaining, some use `|| '—'`, some access unsafely)
**Files:** `maquinas/app.js` throughout

**Examples:**
- Line 221: `o.maq_ativos?.codigo||'?'` — uses optional chaining
- Line 102: `a.emoji||''` — inline default
- Line 169: `ultimaOS.uso_na_os || 0` — assumes exists
- Line 30: `USUARIO.funcao || USUARIO.posto_graduacao || ...` — no null check on USUARIO

**Problem:** Inconsistency makes code harder to read and error-prone

**Fix approach:**
- Standardize to optional chaining: `a?.emoji ?? ''`
- Add null-check before accessing nested properties
- Document which fields are always populated vs. optional
- Use TypeScript or JSDoc for type safety

---

### Hardcoded Email Domain

**Issue:** Authentication system hardcodes `cmasm.local` email domain
**Files:** 
- `shared/auth.js` (lines 23-28)
- `maquinas/app.js` (lines 713-718)

**Emails:**
```javascript
{ label: 'Direção',  email: 'direcao@cmasm.local',  role: 'admin' }
```

**Problem:**
- Not a real email domain (won't work for password reset flows)
- Tied to single organization
- Cannot use for production Federal systems
- Magic email requires recompiling code to change

**Fix approach:**
- Move CARGOS to database table `usuarios.cargos`
- Allow admin panel to create/edit cargos and email mappings
- Validate emails are real and receive welcome/reset messages
- Support real domain (*.mil.br for Federal systems)

---

## Testing & Quality Gaps

### No Automated Tests

**Issue:** Zero test coverage mentioned in documentation
**Files:** None — no test files found (*.test.js, *.spec.js)

**Test file location convention would be:** 
- `maquinas/__tests__/` or `maquinas/*.test.js`
- `shared/__tests__/auth.test.js`

**What's not tested:**
- Login flows (credential validation, role assignment)
- Data validation (negative inventory, invalid dates)
- Error recovery (network failures, database errors)
- Concurrent operations (race conditions)
- Cost calculations (depreciation, L/h, cost/hour)

**Risk:** Medium — calculation errors undetected until user reports

**Fix approach:**
- Add test framework: Vitest (lightweight, works with vanilla JS)
- Test utilities first: `calcVencimentos()`, `calcCiclo()`, cost calculations
- Test auth flows: login with wrong password, role assignment
- Add integration tests for critical data flows (add asset → add OS → check inventory)
- Document test patterns in CONVENTIONS.md

---

## Operational Concerns

### No Audit Trail for Compliance

**Issue:** No tracking of who made changes, when, and why
**Files:** Database schema lacks `_audit` tables

**Missing:**
- `maq_ativos_audit` — track equipment status changes
- `maq_os_audit` — track work order modifications
- `maq_materiais_audit` — track inventory movements (only `maq_estoque_movimentos` exists)
- Timestamp of creation/modification not captured at app level

**Impact:**
- Cannot answer "who deleted this asset?" for compliance
- No change history for disputes
- Cannot revert accidental deletions

**Examples missing:**
- Who changed asset status to "inoperante" and when?
- Which technician incorrectly reduced inventory?
- Who approved this work order?

**Fix approach:**
- Create audit trigger: `AFTER UPDATE/DELETE on [table] → INSERT into [table]_audit`
- Include: `changed_by (user_id), changed_at (timestamp), old_values (jsonb), new_values (jsonb), reason`
- Surface audit log in UI (admin-only view)
- Implement soft deletes: `deleted_at` timestamp instead of actual DELETE

---

## Documentation Gaps

### Production Deployment Not Documented

**Issue:** No runbook for production deployment or incident response
**Files:** None — see README, SETUP.md

**Missing:**
- How to deploy updates without downtime
- Database migration procedure (what if schema changes needed?)
- Rollback procedure if bad data deployed
- SLA/uptime requirements
- On-call procedures

**Fix approach:**
- Create DEPLOY.md with step-by-step checklist
- Create INCIDENTS.md for common issues and fixes
- Document staging environment setup
- Add monitoring/alerting (Supabase can email on query errors)

---

### No User Documentation

**Issue:** Operators have no guide for daily tasks
**Files:** README is technical, not operational

**Missing:**
- How to register a new technician and assign role
- How to create a maintenance plan and assign to assets
- How to approve work orders (workflow not documented)
- How to interpret cost/hour depreciation calculations
- How to export purchase list for procurement

**Fix approach:**
- Create USER_GUIDE.md with screenshots
- Create WORKFLOWS.md documenting each business process
- Add tooltips to UI explaining non-obvious fields

---

## Scalability Limitations

### Fixed Currency Formatting

**Issue:** All monetary values hardcoded to Brazilian Real (R$)
**Files:** `maquinas/app.js` (line 345: `const fmtR = v => 'R$ ' + ...`)

**Not configurable by:**
- Organization
- User locale
- Currency exchange rates

**Fix approach:** Make currency configurable in settings

---

## Summary Risk Matrix

| Concern | Severity | Effort | Impact |
|---------|----------|--------|--------|
| Hardcoded credentials | 🔴 High | Medium | Security breach |
| Overly permissive RLS | 🔴 High | High | Data exposed to all users |
| Missing error handling | 🟡 Medium | Medium | Silent failures, data corruption |
| Global state races | 🟡 Medium | Medium | Data inconsistency |
| No validation | 🟡 Medium | Low | Bad data accepted |
| No audit trail | 🟡 Medium | High | Compliance issues |
| Monolithic JS file | 🟡 Medium | High | Hard to maintain/extend |
| Data divergence (ARP) | 🟡 Medium | Low | Procurement audit failure |
| Deleted backup | 🟠 Low | Low | Historic data lost (can't recover) |
| No tests | 🟠 Low | High | Regressions undetected |

---

*Concerns audit: 2026-08-07*
