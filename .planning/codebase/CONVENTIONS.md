# Coding Conventions

**Analysis Date:** 2026-08-07

## Naming Patterns

**Files:**
- Components/modules use camelCase: `auth.js`, `app.js`
- HTML files use lowercase: `index.html`
- SQL migrations use numbered prefix: `01_maquinas_schema.sql`, `02_maquinas_seed.sql`

**Functions:**
- Public functions: `camelCase` — e.g., `renderAtivos()`, `carregarUsuario()`, `mostrarApp()`, `salvarAtivo()`
- Private functions (internal helpers): prefixed with `_` — e.g., `_render()`, `_bindEventos()`, `_selecionarCargo()`, `_loginCargo()`, `_carregarPerfil()`
- Async functions: same camelCase convention — e.g., `async function carregarTudo()`, `async function salvarMovimento()`

**Variables:**
- Global state: `UPPER_CASE` — e.g., `ATIVOS`, `OS_LIST`, `MATERIAIS`, `PLANOS`, `USUARIO`, `ATIVO_EDIT_ID`
- Local/parameter variables: `camelCase` — e.g., `ativo`, `usuario`, `total`, `inop`, `venc`, `baixo`
- DOM element references: camelCase — e.g., `card`, `grid`, `btn`, `erroEl`, `sel`
- Short abbreviations used in destructuring: `a`, `o`, `m`, `p`, `pm`, `ab`, `ur` (from query results)

**HTML Element IDs:**
- kebab-case with descriptive purpose — e.g., `login-screen`, `app`, `kpi-total`, `modal-ativo`, `tb-ativos`, `auth-senha`, `btn-entrar`, `step-cargo`

**Types/Classes:**
- Constructor names: `PascalCase` — e.g., `class Auth`
- Constants for configuration: `UPPER_CASE` — e.g., `CARGOS_PADRAO`, `SUPA_URL`, `SUPA_KEY`

## Code Style

**Formatting:**
- No automated formatter (Prettier/ESLint) detected
- Manual indentation with 2-space tabs
- Inline styles preferred over CSS classes for dynamic styling
- JSDoc comments for exported functions and classes

**Linting:**
- No linting tool configured
- No code style enforcer (ESLint/Biome)
- Manual code review approach

**Language:**
- Portuguese for all comments, variable names, UI strings, and documentation
- Comments explaining business logic in Portuguese
- Example: `// ── auth ──`, `// ── estado global ──`, `// "Livre" → acesso observador sem senha`

## Import Organization

**Order:**
1. External SDK/library imports: `import { Auth } from './auth.js'` (relative imports)
2. Inline Supabase SDK: loaded via CDN script tags in HTML
3. No import aliasing detected

**Path Aliases:**
- Not used; direct relative paths: `./auth.js`, `./app.js`

**Module exports:**
- ES6 module syntax: `export class Auth`, `export const CARGOS_PADRAO`, `export async function cadastrarCargo()`
- Single-file apps: global functions and variables, no exports

## Error Handling

**Patterns:**
- Supabase async operations use destructuring: `const { error } = await supa.from(...)`
- Error checking before proceeding: `if(error) { alert('Erro: '+error.message); return }`
- Validation errors use `alert()` for simple cases: `if(!senha) { erroEl.textContent = 'Digite a senha.'; return }`
- Form validation before submission: check required fields, trim input, parse numbers

**Example:**
```javascript
async function salvarAtivo(){
  const campos = {
    codigo:      document.getElementById('at-codigo').value.trim().toUpperCase(),
    nome:        document.getElementById('at-nome').value.trim(),
  }
  if(!campos.nome){ alert('Nome obrigatório.'); return }
  
  if(ATIVO_EDIT_ID){
    const { error } = await supa.from('maq_ativos').update(campos).eq('id', ATIVO_EDIT_ID)
    if(error){ alert('Erro: '+error.message); return }
  }
  fecharModal('modal-ativo')
  await carregarTudo()
}
```

## Logging

**Framework:** No logging library — uses browser `console` or direct user feedback

**Patterns:**
- Errors shown to user via `alert()` dialog
- Form validation feedback via DOM updates: `erroEl.textContent = 'message'`
- No debug logging in production code
- Console.warn for deprecated code: `console.warn('addLogEntry sync obsoleto')`

## Comments

**When to Comment:**
- Section headers: `// ── SECTION NAME ──`
- Business logic explanations: `// "Livre" → acesso observador sem senha`
- Complex calculations or filter logic
- User-facing error conditions

**JSDoc/TSDoc:**
- Used for exported classes and reusable functions in `shared/auth.js`
- Multi-line JSDoc with parameter descriptions
- Example from `auth.js`:
  ```javascript
  /**
   * auth.js — módulo de autenticação CMASM
   * Login por botões de cargo + senha. Email nunca visível ao usuário.
   * Compatível com qualquer app do ecossistema (pmoc-maquinas, fonoclama, etc.)
   *
   * Uso mínimo (HTML standalone):
   *   <div id="login"></div>
   *   <script type="module">
   *     import { Auth } from './auth.js'
   *     const auth = new Auth(supabaseClient, { appNome: 'Máquinas', appIcone: '⚙️' })
   *   </script>
   */
  ```

## Function Design

**Size:** Generally short, focused functions (50-150 lines)
- Rendering functions: 30-80 lines with template literals
- Data loading: 20-40 lines with multiple Promise.all queries
- Modal handlers: 40-60 lines including DOM manipulation and validation

**Parameters:**
- Minimal parameters (1-3 typical)
- Relies on global state (`ATIVOS`, `USUARIO`, etc.) rather than passing through function chain
- Event handlers receive DOM elements: `onclick="abrirModalAtivo(${a.id})"`

**Return Values:**
- Most functions are void (side-effect based)
- Async functions return nothing or throw errors
- Pure functions for utilities: `esc()`, `el()`, `val()`, `fmtDate()`, `today()`

**Example of function design:**
```javascript
// Pure utility
function esc(s){ 
  if(!s)return''; 
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); 
}

// Side-effect based with global state mutation
async function carregarTudo(){
  const [a, o, m, p, pm, ab, ur] = await Promise.all([
    supa.from('maq_ativos').select('*').order('codigo'),
    supa.from('maq_os').select('*, maq_ativos(codigo,nome), maq_planos(nome)').order('data_abertura', {ascending:false}),
    // ... more queries
  ])
  ATIVOS = a.data || []
  OS_LIST = o.data || []
  // ... more assignments
  renderPainel(); renderAtivos(); renderVencimentos(); renderOS(); renderMateriais()
}
```

## Module Design

**Exports:**
- Reusable module (`shared/auth.js`): exports `Auth` class and `cadastrarCargo()` function
- Single-file apps: no exports, global scope for functions and state

**Barrel Files:**
- Not used; each file is standalone
- No index.js files for re-exports

**Private vs Public:**
- No explicit private/public distinction except `_prefixed` methods in classes
- Exported from modules via `export` keyword
- Global state intentionally exposed at module level

## DOM Interaction

**Pattern:**
- Direct `document.getElementById()` for most lookups
- `document.querySelector()` for complex selectors
- Template literals for HTML generation: `<tr>${...}</tr>`
- Inline event handlers in HTML: `onclick="functionName(${value})"`
- Event listener attachment in setup functions: `btn.addEventListener('click', () => ...)`

**Example:**
```javascript
function renderAtivos(){
  const tbody = document.getElementById('tb-ativos')
  if(!lista.length){
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;...">Nenhuma máquina encontrada</td></tr>'
    return
  }
  tbody.innerHTML = lista.map(a => `
    <tr onclick="abrirModalAtivo(${a.id})">
      <td class="hi" style="color:${a.cor||'var(--text)'}">${a.emoji||''} ${a.codigo||'—'}</td>
      ...
    </tr>`).join('')
}
```

## Code Organization

**Files:**
- `shared/auth.js` (`293` lines): Reusable authentication component
- `maquinas/app.js` (`~900` lines): Single monolithic app with all logic and rendering
- `refrigeracao/index.html` (`~1400` lines): Single HTML file with embedded CSS and JavaScript

**Structure of app.js:**
1. Config section: Supabase credentials
2. State variables: global arrays and user object
3. Auth functions: `init()`, `carregarUsuario()`, `sair()`
4. Data loading: `carregarTudo()`
5. View management: `trocarView()`
6. Render functions: `renderPainel()`, `renderAtivos()`, `renderOS()`, etc.
7. Modal handlers: `abrirModal*()`, `salvar*()`, `fechar*()`
8. Utility calculations: `calcVencimentos()`, `calcCiclo()`, etc.
9. Event setup: `document.addEventListener()` at document load time

---

*Convention analysis: 2026-08-07*
