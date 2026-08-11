# Fase 6: Tema claro/escuro — Mapa de Padrões

**Mapeado:** 2026-08-11
**Arquivos analisados:** 11 (1 novo, 10 modificados)
**Analogs encontrados:** 11 / 11

Escopo confirmado no ROADMAP.md (D-01..D-04): 7 superfícies (`maquinas`, `transportes`, `eletrica`, `fonoclama`, `predial`, `mapa`, portal `/index.html`), `mapa/xmap.css` fora do escopo, `refrigeracao/` congelado, convenção `data-theme="claro"|"escuro"` + `localStorage` `pmoc-tema`.

## File Classification

| Arquivo novo/modificado | Role | Data Flow | Analog mais próximo | Qualidade |
|---|---|---|---|---|
| `shared/tema.js` (NOVO) | utility/module | event-driven (localStorage + matchMedia) | `shared/shell.js` (separação função-pura / aplicador-DOM) | role-match |
| `shared/shell.js` (edição — botão de tema em `montarShell()`) | component/layout | request-response (string→string) | ele mesmo, `montarShell()` linhas 36-44 | exact |
| `shared/pmoc.css` (edição — bloco `[data-theme="light"]` + correção de 6 hardcodes) | config/style | transform (CSS tokens) | ele mesmo, bloco `:root` linhas 8-13 | exact |
| `maquinas/index.html` `<head>` (edição — script anti-FOUC) | config | event-driven (pré-paint) | `transportes/index.html:1-11` (o `<head>` mais "limpo", sem libs extras) | exact |
| `transportes/index.html` `<head>` (edição) | config | event-driven | idem | exact |
| `eletrica/index.html` `<head>` (edição) | config | event-driven | `transportes/index.html:1-11` | exact |
| `fonoclama/index.html` `<head>` (edição) | config | event-driven | `transportes/index.html:1-11` | exact |
| `predial/index.html` `<head>` (edição) | config | event-driven | `transportes/index.html:1-11` | exact |
| `mapa/index.html` `<head>` (edição — cuidado: não tocar `xmap.css`) | config | event-driven | `transportes/index.html:1-11` (mesma posição relativa a `pmoc.css`) | role-match |
| `index.html` (portal, edição — D-02: entra no escopo) | config | event-driven | os 6 `<head>` de módulo (mesma técnica), mas o portal duplica tokens inline em vez de `<link pmoc.css>` — ver nota | partial-match |
| `tests/shell.test.js` (edição — novo caso para o botão de tema) | test | request-response (assert sobre string) | os 6 casos já existentes no próprio arquivo (linhas 6-55) | exact |

## Pattern Assignments

### `shared/tema.js` (NOVO)

**Analog de estrutura:** `shared/shell.js` inteiro — separação função pura (`montarShell`, sem `document`/`window`) vs. função que toca DOM (`aplicarShell`). `shared/tema.js` deve seguir a mesma separação: `detectarTema()` é pura (só lê `localStorage`/`matchMedia`, sem tocar `document.documentElement`); `aplicarTema()`/`alternarTema()` tocam o DOM.

**Padrão de exportação ES module** (`shared/shell.js:28`, `shared/shell.js:71`):
```javascript
export function montarShell(cfg) { ... }
export function aplicarShell(cfg) { ... }
```
`tema.js` replica: `export function detectarTema() {...}`, `export function aplicarTema(tema) {...}`, `export function alternarTema() {...}`.

**Validação contra lista fechada (ASVS V5, do RESEARCH.md):** ao ler `localStorage.getItem('pmoc-tema')`, validar contra `'claro'|'escuro'` antes de usar — mesmo espírito de `esc()` em `shared/shell.js:17-25`, que nunca deixa string crua entrar sem tratamento.

**Import consumido por `shared/shell.js`:** seguir o padrão de import relativo já usado no projeto (`shared/modulo-manutencao.js` importa `./auth.js`, `./shell.js` sem bundler) — `shared/shell.js` deve importar `alternarTema`/`obterTemaAtual` de `./tema.js` com `import { alternarTema } from './tema.js'` no topo do arquivo.

---

### `shared/shell.js` — inserir botão de tema em `montarShell()`

**Analog:** o próprio arquivo, bloco `topbar` (`shared/shell.js:36-44`)

**Código atual exato a estender:**
```javascript
const topbar = `
    <div class="topbar">
      <div class="logo"><div class="logo-dot"></div> PMOC <span class="logo-accent">${esc(nome)}</span></div>
      <div class="topbar-right">
        ${linkPortal}
        <span class="user-chip" id="user-chip">—</span>
        <button class="btn btn-s btn-sm" onclick="sair()">Sair</button>
      </div>
    </div>`
```
(`shared/shell.js:36-44`)

**Onde inserir:** dentro de `topbar-right`, ao lado do `user-chip`, seguindo a mesma convenção de marcação `<button class="btn btn-s btn-sm" onclick="...">` já usada pelo botão "Sair" (linha 42) — **não** usar uma classe que contenha a substring `nav` ou `nav-btn` (ver Pitfall 5 do RESEARCH.md e nota sobre `tests/shell.test.js` abaixo).

**Import necessário no topo do arquivo** (hoje `shared/shell.js` não importa nada — só define `esc()` local, linhas 17-25): adicionar `import { alternarTema } from './tema.js'` (ou expor a função globalmente para o `onclick` inline funcionar, seguindo o mesmo padrão de `onclick="sair()"` que hoje assume `sair` como função global — checar no planejamento se o botão de tema chama `alternarTema()` direto via `onclick` global, como os outros botões do shell, ou via listener).

---

### `shared/pmoc.css` — bloco `[data-theme="light"]` e correção de hardcodes

**Analog:** bloco `:root` atual (`shared/pmoc.css:8-13`):
```css
:root{
  --bg:#1a1a18; --surface:#242420; --surface2:#2e2e2a; --border:#38382f;
  --text:#e8e4d8; --text2:#a09a88; --text3:#6a6458;
  --green:#5a9e6f; --yellow:#c9a84c; --red:#b85c4a; --blue:#4a7fa0;
  --accent:#4aa0a0; --orange:#c07840; --ff:'Inter',system-ui,sans-serif;
}
```
Nota: a convenção D-03 é `data-theme="claro"|"escuro"` (português), não `"light"`/`"dark"` como o RESEARCH.md havia esboçado — o seletor CSS correto é `[data-theme="claro"]{...}`, sobrescrevendo só os 7 tokens neutros (`--bg --surface --surface2 --border --text --text2 --text3`), igual ao Pattern 1 do RESEARCH.md mas com o valor do atributo em português.

**Hardcode 1 — 4 classes `.co-*` (linhas 76-79, código atual exato):**
```css
.co-warn{background:rgba(201,168,76,.08);border-color:var(--yellow);color:#c9a84c}
.co-red{background:rgba(184,92,74,.08);border-color:var(--red);color:#b85c4a}
.co-ok{background:rgba(90,158,111,.08);border-color:var(--green);color:#5a9e6f}
.co-blue{background:rgba(74,127,160,.08);border-color:var(--blue);color:#8eb9d1}
```
(`shared/pmoc.css:76-79`) — trocar cada `color:#hex` por `color:var(--yellow)`/`var(--red)`/`var(--green)`/`var(--blue)` respectivamente.

**Hardcode 2 — borda de tabela (linha 54, código atual exato):**
```css
.tbl td{padding:10px 14px;font-size:13px;color:var(--text2);border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
```
(`shared/pmoc.css:54`) — trocar `rgba(255,255,255,.04)` por `var(--border)`.

**Padrão `color-mix` já estabelecido a reaproveitar** (`shared/pmoc.css:64`):
```css
.b-accent{background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent)}
```
Este é o precedente citado no RESEARCH.md para, opcionalmente, migrar os `background:rgba(...)` dos `.co-*` (linhas 76-79) e dos `.badge` (linhas 60-63) para `color-mix(in srgb, var(--x) N%, transparent)` em vez de `rgba(...)` fixo.

---

### `<head>` dos 6 módulos — script anti-FOUC inline

**Analog mais limpo (sem libs extras):** `transportes/index.html:1-11`
```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="theme-color" content="#1a1a18"/>
<title>PMOC Transportes</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<link rel="stylesheet" href="../shared/pmoc.css"/>
<style>
:root{--accent:#4aa0a0}
</style>
```

**Analog com libs extras (mapa, cuidado ao inserir — não confundir com `xmap.css`):** `mapa/index.html:1-11`
```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="theme-color" content="#1a1a18"/>
<title>PMOC Mapa</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="anonymous"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="anonymous"></script>
<link rel="stylesheet" href="../shared/pmoc.css"/>
<link rel="stylesheet" href="xmap.css"/>
<style>
html,body{height:100%}
```

**Analog eletrica/fonoclama/predial** (bloco `<style>` de uma linha só — atenção ao inserir o script antes desse bloco):
```html
<!-- eletrica/index.html:1-11 -->
<meta name="theme-color" content="#1a1a18"/>
<title>PMOC Elétrica</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<link rel="stylesheet" href="../shared/pmoc.css"/>
<style>:root{--accent:#c9a84c}</style>
```
```html
<!-- fonoclama/index.html:1-11 -->
<style>:root{--accent:#4a7fa0}</style>
```
```html
<!-- predial/index.html:1-11 -->
<style>:root{--accent:#8a7f5c}</style>
```

**Onde inserir o script anti-FOUC nos 6:** logo após `<meta name="theme-color" ...>` e antes ou depois do `<link pmoc.css>` (conforme RESEARCH.md, a ordem entre os dois não importa). Como `<meta name="theme-color">` é hardcoded `#1a1a18` nos 6 (Pitfall 3), `aplicarTema()` em `tema.js` precisa atualizá-la via JS a cada troca — não há valor de `content` claro por tema; considerar `#1a1a18` para escuro / o `--bg` do tema claro (ex. `#f4f2ec`, valor ilustrativo — Open Question 2 do RESEARCH.md ainda em aberto sobre valores exatos).

**Restrição crítica (Pitfall 4):** o script deve ser `<script>` clássico, **sem** `type="module"`, sem `src` externo — os módulos ES já existentes nos 6 (`<script type="module">` no `<body>`, confirmado nos 6 `index.html`) rodam tarde demais para evitar FOUC.

---

### `index.html` (portal) — D-02, entra no escopo desta fase

**Analog:** cabeçalho atual do portal (`index.html:1-14`):
```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="theme-color" content="#1a1a18"/>
<title>PMOC · CMASM</title>
<style>
:root{--bg:#1a1a18;--surface:#242420;--surface2:#2e2e2a;--border:#38382f;
 --text:#e8e4d8;--text2:#a09a88;--text3:#6a6458;
 --green:#5a9e6f;--yellow:#c9a84c;--red:#b85c4a;--blue:#4a7fa0;
 --ff:'Inter',system-ui,sans-serif}
```
**Divergência importante a respeitar no plano:** o portal **não** carrega `shared/pmoc.css` — duplica os tokens inline no próprio `<style>`. Para D-02 funcionar, o portal precisa ganhar seu próprio bloco `[data-theme="claro"]` inline (réplica dos mesmos 7 valores neutros que entram em `shared/pmoc.css`), já que não há `<link>` compartilhado para herdar o bloco novo automaticamente. O script anti-FOUC inline é o mesmo dos 6 módulos (mesma chave `localStorage` `pmoc-tema`, mesma origem — herda a persistência automaticamente, conforme RESEARCH.md sobre `localStorage` por origem).

---

### `tests/shell.test.js` — caso novo para o botão de tema

**Analog:** os 6 casos existentes no próprio arquivo, todos seguindo o padrão `montarShell(cfg)` → `assert.match(topo, /regex/)`. Dois exemplos diretamente reaproveitáveis:

```javascript
// tests/shell.test.js:6-11 — padrão para afirmar presença de elemento fixo na topbar
test('barra superior sempre traz o chip de usuário e o botão de saída', async () => {
  const { montarShell } = await modulo
  const { topo } = montarShell({ nome: 'Máquinas', navItems: [] })
  assert.match(topo, /id="user-chip"/)
  assert.match(topo, /onclick="sair\(\)"/)
})
```
```javascript
// tests/shell.test.js:19-32 — padrão para contar botões via regex (cuidado, ver Pitfall 5)
const botoes = topo.match(/<button class="nav-btn[^"]*"/g)
assert.equal(botoes.length, 2)
```

**Novo caso a adicionar** deve seguir o mesmo formato: `montarShell({ nome: 'X', navItems: [] })` e `assert.match(topo, /id="btn-tema"/)` (ou o `id`/classe que for escolhido) — **usar uma classe que não contenha a substring `nav` ou `nav-btn`**, porque `tests/shell.test.js:16` já faz `assert.doesNotMatch(topo, /class="nav"/)` quando `navItems: []`, e `tests/shell.test.js:28` conta `<button class="nav-btn...` — um botão de tema mal nomeado quebra os dois testes existentes sem relação real com a mudança.

**Comando de verificação a rodar após editar `shared/shell.js`** (citado no RESEARCH.md como pitfall): `node --test tests/shell.test.js`

## Shared Patterns

### Separação função-pura / aplicador-DOM
**Fonte:** `shared/shell.js:27-68` (`montarShell`, puro) vs. `shared/shell.js:70-86` (`aplicarShell`, toca DOM)
**Aplicar a:** `shared/tema.js` inteiro — `detectarTema()` pura, `aplicarTema()`/`alternarTema()` tocam `document.documentElement`.

### Escape de strings antes de entrar em HTML
**Fonte:** `shared/shell.js:17-25` (`esc()`)
**Aplicar a:** qualquer texto dinâmico no botão de tema, se vier a ser configurável (RESEARCH.md nota que hoje o texto é estático, então não é estritamente necessário, mas é o padrão do arquivo).

### Tokens CSS via `var(--x, fallback)`
**Fonte:** `shared/auth.js:70-71` — `background:var(--bg,#1a1a18)`
**Aplicar a:** nenhuma mudança necessária em `shared/auth.js`; citado como confirmação de que a tela de login já reage ao tema sem código novo.

### `color-mix(in srgb, var(--x) N%, transparent)` em vez de `rgba(...)` fixo
**Fonte:** `shared/pmoc.css:64` (`.b-accent`)
**Aplicar a:** correção opcional dos `background` em `.co-*` (`shared/pmoc.css:76-79`) e possivelmente `.badge` (linhas 60-63), para acompanhar ajuste de tom por tema.

## Sem Analog Encontrado

Nenhum arquivo desta fase ficou sem analog — todos os 11 itens têm precedente direto na Fase 5 (mesmos arquivos, extensão aditiva) ou no próprio `shared/shell.js`/`shared/pmoc.css` atuais.

**Nota sobre precedentes descartados:** `ref/transportes (3).html` e `ref/xgrama.html` (material de referência legado, fora do produto) usam `data-theme`/tema claro-escuro, mas o RESEARCH.md explicitamente recomenda não copiá-los — `ref/transportes (3).html` tem FOUC (aplica tema em `DOMContentLoaded`, não antes do paint) e usa nomes em inglês (`trsp_theme`) divergentes da convenção travada (D-03, português). Não incluídos como analog válido.

## Metadata

**Escopo de busca:** `shared/`, os 7 `<head>` de módulo + portal, `tests/shell.test.js`, `.planning/phases/05-base-unificada/*-SUMMARY.md` (para confirmar continuidade de padrão), `.planning/ROADMAP.md`
**Arquivos lidos por completo:** `shared/pmoc.css` (130 linhas), `shared/shell.js` (86 linhas), `tests/shell.test.js` (56 linhas)
**Arquivos lidos por trecho (`<head>`):** `maquinas/index.html`, `transportes/index.html`, `eletrica/index.html`, `fonoclama/index.html`, `predial/index.html`, `mapa/index.html`, `index.html` (portal) — linhas 1-15 de cada
**Data de extração:** 2026-08-11
