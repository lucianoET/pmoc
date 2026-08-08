# Testing Patterns

**Analysis Date:** 2026-08-07

## Test Framework

**Runner:**
- No automated test framework detected (no Jest, Vitest, Mocha, etc.)
- Manual testing only

**Assertion Library:**
- Not applicable; tests are manual verification

**Test Approach:**
- Manual verification documented in `TESTES.md`
- Testing performed directly in deployed application
- Test data created, used, then deleted

**Run Commands:**
```bash
# No automated test commands available
# Manual testing:
# 1. Deploy to Vercel
# 2. Open https://pmoc.vercel.app or local file
# 3. Test each user role and operation manually
```

## Test File Organization

**Location:**
- No test files in repository
- Manual test procedures documented in `TESTES.md` at project root

**Naming:**
- Not applicable; no test files exist

**Structure:**
- Single documentation file (`TESTES.md`) containing manual test checklist
- Test cases organized by feature area (authentication, database operations, RLS policies)

## Test Structure

**Suite Organization:**
- Tests organized by feature area, not by test framework
- Categories: Leitura anônima, Joins usados pelos apps, Autenticação, RLS, Escritas testadas

**Test Areas (from TESTES.md):**

### Authentication Testing
```
Cargo | Login
-------|-------
direcao@cmasm.local | ✅
gestor@cmasm.local | ✅
tecnico@cmasm.local | ✅
```
- Verify each user role can login
- Verify password changes work
- Verify session persistence

### Row-Level Security (RLS) Testing
```
Operation | Anônimo | Técnico
-----------|---------|----------
SELECT | ✅ permitido | ✅ permitido
INSERT | ✅ bloqueado | ✅ permitido
UPDATE | — | ✅ HTTP 204
DELETE | — | ✅ (policy adicionada)
```

### Data Integrity Testing
- Verify all expected tables exist
- Verify join relationships work correctly
- Verify calculated fields (e.g., `custo_total` in `maq_abastecimentos`)
- Verify order by clauses

**Patterns:**
- Manual verification of database state before and after operations
- Test data cleanup: create test record → verify → delete → verify empty

## Mocking

**Framework:** Not used

**Patterns:** Not applicable (no test framework)

**What to Mock:** Not applicable

**What NOT to Mock:** Not applicable

## Fixtures and Test Data

**Test Data:**
- Created manually in application UI during testing
- Examples from `TESTES.md`:
  - OS preventiva created and removed
  - Registro de uso (horímetro) created and removed
  - Abastecimento created with calculated cost verification (10 L × R$ 6,50 = R$ 65,00)
  - User `uso_atual` field updated and reset

**Location:**
- Test data created via application UI (forms, modals)
- No dedicated test data fixtures or factories
- Test procedures documented in `TESTES.md`

**Cleanup:**
- Manual deletion via application UI after testing
- Verification step: counter fields checked for zero: `maq_os`, `maq_uso_registros`, `maq_abastecimentos`

**Example Test Sequence (from TESTES.md):**
1. Create OS preventiva → verify in database
2. Delete OS preventiva → verify counter = 0
3. Create registro de uso → verify horímetro updated
4. Delete registro de uso → verify counter = 0 and horímetro reset
5. Create abastecimento → verify calculated `custo_total`

## Coverage

**Requirements:** Not specified; no coverage tool configured

**Approach:**
- Manual testing of critical paths:
  - Authentication (all 3 user roles)
  - Data loading (all required joins)
  - Create operations (ativos, materiais, OS, uso_registros, abastecimentos)
  - Update operations (status changes, calculated fields)
  - Delete operations (record removal and data integrity)
  - RLS policy enforcement

## Test Types

**Manual Integration Tests:**
- Scope: Full application stack (UI → Supabase → Database)
- Approach: User performs actions via UI, verifies results in database
- Coverage: All major features and user roles

**Database Testing:**
- Verify row-level security policies enforce permissions
- Verify calculated triggers work (e.g., `custo_total` generation)
- Verify joins return correct related data

**Example Database Test (from TESTES.md):**
```
Test: Abastecimento with calculated cost
1. Create abastecimento: 10 L at R$ 6,50/L
2. Verify custo_total = R$ 65,00 (calculated by trigger)
3. Result: ✅
```

**Authentication Tests:**
- Login flow for each user role
- Verify session persistence
- Verify logout clears session

**RLS Tests:**
- Anonymous user: can SELECT, cannot INSERT/UPDATE/DELETE
- Authenticated users: can SELECT/INSERT/UPDATE/DELETE (policies enforce)
- Verify policies by attempting blocked operations and confirming 403/HTTP error

## Error Scenarios

**Testing Approach:**
- Minimal error testing documented
- No error scenario matrix found
- Error handling tested indirectly through normal operations

**Error Conditions Tested (implicit):**
- Failed login: password incorrectness shown via alert in `auth.js`
- Missing required fields: validation before submit in form handlers
- Database connectivity: would surface as alert or no data load

## Testing Best Practices

**What Works:**
- Manual testing of critical paths before deployment
- Test data cleanup ensures clean state
- Role-based testing verifies access control
- Join verification ensures data relationships

**Gaps:**
- No automated regression testing
- No error scenario coverage
- No performance/load testing
- No UI interaction testing (button clicks, form validation)
- No edge case testing documented

## Database Testing

**RLS Verification:**
- Test each operation (SELECT, INSERT, UPDATE, DELETE) for each role
- Verify policies block unauthorized access
- Verify calculated fields trigger on insert/update

**Example RLS Test:**
```
Test: Insert as anonymous user (should fail)
1. Attempt INSERT into maq_ativos as anon user
2. Expected: ✅ bloqueado (HTTP 403 or error)
3. Result: Verified in TESTES.md

Test: Update as authenticated técnico (should succeed)
1. Update maq_ativos record as técnico user
2. Expected: ✅ HTTP 204
3. Result: Verified in TESTES.md
```

## Schema/Data Validation

**Tables Verified (from TESTES.md):**
- `equipamentos` (171 records)
- `arp_itens` (19 records)
- `os_contratacao` (2 records)
- `os_eventos` (2 records)
- `plano_tarefas` (9 records)
- `maq_ativos` (7 records)
- `maq_planos` (59 records)
- `maq_materiais` (34 records)
- `maq_plano_materiais` (49 records)

**Joins Tested:**
- `maq_plano_materiais → maq_materiais(nome,unidade,preco)` ✅
- `maq_os → maq_ativos(codigo,nome), maq_planos(nome)` ✅
- `maq_abastecimentos → maq_ativos(codigo,nome,emoji)` ✅
- `maq_uso_registros → maq_ativos(codigo,nome)` ✅

## Manual Testing Checklist (from TESTES.md)

### Before Deployment
- [ ] All authentication tests pass for each role
- [ ] Database schema loaded correctly
- [ ] All joins return expected related data
- [ ] RLS policies block unauthorized access
- [ ] Create operations work for all entities
- [ ] Update operations work (including calculated fields)
- [ ] Delete operations work and counters reset

### After Deployment
- [ ] Test data cleaned up
- [ ] Counters verified at zero: `maq_os`, `maq_uso_registros`, `maq_abastecimentos`
- [ ] Original data restored if modified

## Testing Philosophy

**Approach:**
- **Integration-focused**: Test full feature path (UI → API → Database → UI)
- **Manual verification**: Tester performs action, verifies expected result
- **Cleanup discipline**: Always remove test data after verification
- **Role-based**: Verify each user role has correct access
- **Database-aware**: Check database state directly, not just UI feedback

**Timeline:**
- Testing performed on staging deployment (Vercel preview or local)
- Final validation: 07/08/2026 per `TESTES.md`
- Test report: documented in `TESTES.md` with ✅/❌ status for each test

---

*Testing analysis: 2026-08-07*
