# Phase 6: Tema claro/escuro - Research

**Researched:** 2026-08-11
**Domain:** Alternância de tema claro/escuro em frontend zero-build (CSS custom properties + localStorage + `prefers-color-scheme`), sobre a base unificada entregue na Fase 5
**Confidence:** HIGH — quase toda afirmação é leitura direta do repositório, citada `arquivo:linha`. Três achados pontuais (compartilhamento de `localStorage` entre paths da mesma origem, técnica de anti-FOUC e verificação de contraste WCAG sem build) vêm de busca web e são MEDIUM (cruzados com MDN/WebAIM, sem necessidade de instalar nada).

## Summary

A Fase 5 já resolveu o problema estrutural mais difícil desta fase: os 6 módulos no escopo (`maquinas`, `transportes`, `eletrica`, `fonoclama`, `predial`, `mapa`) já carregam `shared/pmoc.css` como única fonte de tokens de cor e já chamam `aplicarShell()` de `shared/shell.js` — direto ou via `shared/modulo-manutencao.js` (`eletrica`/`fonoclama`) — para montar o cabeçalho. Isso significa que **um único ponto de inserção já existe e está provado em produção**: adicionar o controle de tema dentro de `montarShell()` (`shared/shell.js:36-44`, a `topbar`) o propaga automaticamente para os 6 módulos, satisfazendo o critério de sucesso 1 sem tocar em nenhum `index.html` de módulo para esse fim específico.

O trabalho real da fase se divide em quatro frentes concretas, todas em `shared/`:

1. **Tokens de tema em `shared/pmoc.css`** — hoje o arquivo só define uma paleta (a escura, direto em `:root`, `shared/pmoc.css:8-13`). É preciso acrescentar um bloco `[data-theme="light"]{...}` que sobrescreve os tokens neutros (`--bg --surface --surface2 --border --text --text2 --text3`), de forma aditiva, sem remover os valores escuros de `:root` (que continuam sendo o padrão quando o atributo não está presente ou é `"dark"`).
2. **Um módulo novo `shared/tema.js`** — a peça que falta hoje: nenhum arquivo do projeto (fora do diretório `ref/`, que é material de referência legado, não código do produto) lê `prefers-color-scheme`, lê/grava tema em `localStorage`, ou aplica `data-theme` no `<html>`. Vira o único lugar que decide "qual é o tema agora" e "o que fazer quando o usuário clica no botão".
3. **Um script anti-FOUC inline, replicado nos 6 `<head>`** — os 6 módulos já têm um bloco `<head>` quase byte-a-byte idêntico (`meta theme-color`, `link pmoc.css`, `style :root{--accent:...}`); esta fase acrescenta mais uma linha padronizada a esse bloco, nos 6 lugares, seguindo o mesmo padrão de repetição controlada que a Fase 5 já usa para `--accent`.
4. **Correção de 6 hardcodes de cor que já existem em `shared/pmoc.css`**, encontrados nesta pesquisa, que **quebram silenciosamente o critério de sucesso 5** (legibilidade nos dois temas, inclusive alertas) se não forem corrigidos: 4 classes `.co-*` duplicam o valor de `--yellow`/`--red`/`--green` como hex literal em vez de `var(...)` (`shared/pmoc.css:76-79`), e a borda de `.tbl td` é `rgba(255,255,255,.04)` fixo (`shared/pmoc.css:54`) — branco a 4% de opacidade, invisível ou errado sobre um fundo claro.

**Primary recommendation:** atributo `data-theme` no `<html>` (ausente ou `"dark"` = tema escuro atual, sem nenhuma mudança visual para quem nunca clicar no botão), bloco `[data-theme="light"]` aditivo em `shared/pmoc.css` sobrescrevendo só os 7 tokens neutros, `shared/tema.js` novo com `detectarTema()`/`aplicarTema()`/`alternarTema()`/`initTema()` usando uma chave única de `localStorage` (compartilhada entre os 6 módulos pela mesma origem — confirmado nesta pesquisa), botão de alternância inserido dentro de `montarShell()` (`shared/shell.js`), e um script inline idêntico nos 6 `<head>` que lê a preferência e aplica `data-theme` antes do primeiro paint. Antes de tudo isso, corrigir os 6 hardcodes de cor listados acima em `shared/pmoc.css` — sem essa correção, o tema claro herda cores erradas mesmo com os tokens certos.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Paleta de cores dos dois temas | Browser / Client (CSS custom properties em `shared/pmoc.css`) | — | Arquivo CSS estático servido pelo Vercel; sem SSR, sem build |
| Decisão de qual tema aplicar (salvo → SO → padrão) | Browser / Client (`shared/tema.js`, novo) | — | `localStorage` e `matchMedia('(prefers-color-scheme)')` são APIs só de navegador; nenhum dado de tema trafega para o Supabase |
| Persistência entre sessões e módulos | Browser / Client (`localStorage`, mesma origem) | — | Confirmado nesta pesquisa: `localStorage` é particionado só por origem (protocolo+host+porta), não por path — `/maquinas`, `/eletrica` etc. compartilham a mesma área automaticamente |
| Controle de alternância (botão) | Browser / Client (`shared/shell.js`, ponto único já provado) | — | `montarShell()`/`aplicarShell()` já é o único gerador de topbar consumido pelos 6 módulos (Fase 5) |
| Aplicação antes do primeiro paint (anti-FOUC) | Browser / Client (script inline no `<head>` de cada módulo) | — | Não há SSR/edge para decidir o tema no servidor; a única forma sem build é um script síncrono antes da primeira pintura, repetido nos 6 `<head>` |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-04 | Usuário alterna entre tema claro e escuro em qualquer módulo, com uma única implementação apoiada nas variáveis de `pmoc.css` | Ver Pattern 1 (tokens) e Pattern 3 (botão único via `shell.js`) — os 6 módulos já convergem em `aplicarShell()`, então o botão entra uma vez só e aparece nos 6 |
| PLAT-05 | A preferência de tema persiste entre sessões e entre módulos, e respeita `prefers-color-scheme` na primeira visita | Ver seção "Mecanismo de alternância" e os achados web sobre `localStorage` por origem e sobre a técnica anti-FOUC — `shared/tema.js` centraliza a lógica de leitura salvo→SO→padrão |
| PLAT-15 | `refrigeracao` continua idêntico — não carrega `pmoc.css` nem o shell | Reverificado nesta pesquisa: `grep -c 'shared/\|pmoc.css' refrigeracao/index.html` = 0; nenhuma mudança desta fase toca `refrigeracao/` |
| PLAT-16 | Nenhum módulo perde funcionalidade — testes em `tests/` continuam passando | `node --test` rodado nesta pesquisa: 25/25 passando (baseline pós-Fase 5); `tests/shell.test.js` faz asserções por regex sobre o HTML de `montarShell()` que precisam ser respeitadas ao inserir o botão de tema — ver Common Pitfalls #6 |

</phase_requirements>

## Standard Stack

Esta fase **não introduz nenhuma biblioteca nova**. Tudo é API nativa do navegador, já dentro do requisito "ES6 JavaScript" que `CLAUDE.md`/`.claude/CLAUDE.md` já exige para o projeto inteiro.

### Core (plataforma do navegador, sem instalação)
| Recurso | Suporte | Propósito | Por que é o padrão |
|---------|---------|-----------|---------------------|
| CSS Custom Properties (`--var`) | Universal em navegadores ES6+ | Tokens de tema, já em uso desde a Fase 5 | `shared/pmoc.css:8-13` já é 100% baseado nisso; nenhuma alternativa (Sass/CSS-in-JS) cabe em zero-build |
| `matchMedia('(prefers-color-scheme: light)')` | Universal em navegadores modernos | Detectar preferência do SO na 1ª visita (critério 4) | É a única API padrão para isso; não existe alternativa sem JS de terceiros |
| `localStorage` | Universal | Persistir a escolha entre sessões e módulos (critério 3) | Já em uso no projeto legado (`ref/*.html`, não no produto atual) e é a API padrão para persistência client-side sem backend |
| `document.documentElement.setAttribute('data-theme', ...)` + seletor de atributo em CSS | Universal | Alternar tema sem recarregar página (critério 1) | Mesmo padrão encontrado em `ref/transportes (3).html:2,50,1879-1884` e `ref/xgrama.html:115` — precedente já existe no próprio repositório (arquivos de referência, não produto) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `data-theme` no `<html>` + seletor `[data-theme="light"]` | Classe `.light`/`.dark` no `<body>` (como `ref/xgrama.html:115` faz, `classList.add('light')`) | Funcionalmente equivalente. `data-theme` foi escolhido porque `ref/transportes (3).html` (o precedente mais próximo do domínio deste projeto, mesmo escopo de módulo) já usa esse padrão e porque um atributo no `<html>` (não no `<body>`) garante que o CSS decide a cor de fundo antes mesmo do `<body>` existir no DOM, reduzindo a janela de FOUC |
| Ler `prefers-color-scheme` só uma vez na 1ª visita | Escutar `matchMedia(...).addEventListener('change', ...)` para reagir a mudança do SO em tempo real | Critério de sucesso 4 só exige a leitura na 1ª visita ("sem preferência salva"); escutar mudanças em tempo real depois que o usuário já escolheu manualmente contradiria a persistência do critério 3 (a escolha do usuário deve *vencer* o SO, não ser sobrescrita por ele) — não implementar o listener de mudança é a opção certa, não uma limitação |
| `shared/tema.js` como módulo novo dedicado | Colocar as funções de tema dentro de `shared/shell.js` | `shell.js` hoje é puro em `montarShell()` (sem tocar DOM) e só `aplicarShell()` toca o DOM — misturar leitura de `localStorage`/`matchMedia` ali quebraria a separação função-pura/aplicador-DOM que os 6 testes de `tests/shell.test.js` já cobrem. Um arquivo novo mantém `shell.js` testável exatamente como está |

**Instalação:** nenhuma — `shared/tema.js` é um arquivo `.js` novo, sem `npm install`.

## Package Legitimacy Audit

**Não aplicável.** Esta fase não instala nenhum pacote externo — zero-build, sem `package.json`. Nenhuma dependência de CDN nova é introduzida.

## Architecture Patterns

### System Architecture Diagram

```text
┌──────────────────────────── Vercel (static) ────────────────────────────┐
│ Mesma origem para os 7 paths do vercel.json (protocolo+host+porta iguais)│
│  → localStorage é compartilhado entre /maquinas, /transportes, etc.      │
└───────┬──────────────────────────────────────────────────────┬──────────┘
        │                                                       │
   refrigeracao (CONGELADO — fora desta fase, sem tema)   6 módulos no escopo
        │                                                       │
        │                          ┌────────────────────────────┴────────┐
        │                          │  <head> de cada módulo (6×, idêntico)│
        │                          │  1. <link pmoc.css>                  │
        │                          │  2. <script> anti-FOUC inline (NOVO) │
        │                          │     lê localStorage/matchMedia       │
        │                          │     seta data-theme ANTES do paint   │
        │                          │  3. <style>:root{--accent:...}       │
        │                          └────────────────────────┬──────────────┘
        │                                                    ▼
        │                                    ┌───────────────────────────────┐
        │                                    │ shared/tema.js (NOVO)          │
        │                                    │ detectarTema()/aplicarTema()/  │
        │                                    │ alternarTema()/initTema()      │
        │                                    │ chave única de localStorage    │
        │                                    └───────────────┬─────────────────┘
        │                                                    ▼
        │                          shared/shell.js → montarShell() ganha o
        │                          botão de alternância na topbar (ponto único,
        │                          já consumido pelos 6 módulos via aplicarShell())
        │                                                    ▼
        │                          shared/pmoc.css: :root (dark, default) +
        │                          [data-theme="light"] (NOVO, aditivo) — só os
        │                          7 tokens neutros são sobrescritos
        ▼
   (nenhuma seta sai de refrigeracao — PLAT-15 continua intocado)
```

### Recommended Project Structure

```
shared/
├── auth.js                 # sem mudança de API; já usa var(--x, fallback) — segue o tema automaticamente
├── shell.js                 # muda: montarShell() ganha o botão de alternância na topbar
├── pmoc.css                 # cresce de forma aditiva: bloco [data-theme="light"], + correção dos
│                             #   6 hardcodes de cor listados em Common Pitfalls #1/#2 (pré-requisito)
└── tema.js                  # NOVO — detecção, aplicação, alternância e persistência de tema
```

### Pattern 1: Bloco `[data-theme="light"]` sobrescrevendo só os tokens neutros

**What:** `shared/pmoc.css:8-13` define hoje 13 custom properties em `:root`, todas com valor da paleta escura: `--bg --surface --surface2 --border --text --text2 --text3 --green --yellow --red --blue --accent --orange --ff`. Para o tema claro, **não** redefinir as 13 — só os 7 tokens neutros (`--bg --surface --surface2 --border --text --text2 --text3`) precisam de valor diferente; `--accent` já varia por módulo (Fase 5) e continua funcionando sem mudança; `--ff` não tem cor. As cores semânticas (`--green --yellow --red --blue --orange`) são o ponto que exige decisão consciente — ver Open Questions #2.

```css
/* Exemplo de estrutura a seguir — valores exatos ficam para o planejamento/execução,
   verificados por contraste (ver seção Common Pitfalls sobre WCAG AA) */
[data-theme="light"]{
  --bg:#f4f2ec; --surface:#ffffff; --surface2:#ece8dc; --border:#d8d2c0;
  --text:#242420; --text2:#5c5648; --text3:#8a8270;
}
```

**When to use:** Sempre que um token precisar de valor diferente por tema. Tokens que não aparecem no bloco `[data-theme="light"]` continuam herdando o valor de `:root` — é assim que `--accent` (definido por módulo, fora de `pmoc.css`) e `--ff` sobrevivem sem qualquer mudança.

**Anti-pattern a evitar:** copiar as 13 propriedades inteiras para dentro do bloco `[data-theme="light"]`. Isso duplica manutenção (uma cor semântica nova precisaria ser lembrada nos dois lugares) e contraria o próprio texto do critério de sucesso 2 ("uma implementação só, apoiada nas variáveis").

### Pattern 2: `shared/tema.js` — módulo novo, mesma separação função-pura/aplicador-DOM da Fase 5

**What:** seguir exatamente a separação que `shared/shell.js` já estabeleceu (`montarShell()` puro / `aplicarShell()` toca o DOM), para manter o novo arquivo testável em Node sem navegador:

```javascript
// Esboço — nomes e chave de localStorage ficam para o planejamento (ver Open Questions #3)
const CHAVE = 'pmoc_tema' // única para os 6 módulos, mesma origem (ver Sources)

export function detectarTema() {
  const salvo = localStorage.getItem(CHAVE)
  if (salvo === 'claro' || salvo === 'escuro') return salvo
  return matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro'
}

export function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema === 'claro' ? 'light' : 'dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', tema === 'claro' ? '#f4f2ec' : '#1a1a18')
}

export function alternarTema() {
  const atual = document.documentElement.getAttribute('data-theme') === 'light' ? 'claro' : 'escuro'
  const proximo = atual === 'claro' ? 'escuro' : 'claro'
  localStorage.setItem(CHAVE, proximo)
  aplicarTema(proximo)
  return proximo
}
```

`initTema()` (chamada uma vez no boot de cada módulo, ou embutida no próprio script anti-FOUC) só precisa repetir a mesma lógica de `detectarTema()` — mas o script anti-FOUC **não pode** ser um `import` de módulo ES, porque módulos ES são assíncronos e adiados (`defer` implícito), o que reintroduz o próprio FOUC que a técnica existe para evitar. Ver Pattern 3 e Common Pitfalls #4.

### Pattern 3: script anti-FOUC inline, replicado nos 6 `<head>` — e botão único em `shared/shell.js`

**What:** dois mecanismos complementares, não um só:

1. **Script inline síncrono** (não `type="module"`, não em arquivo externo) logo após o `<meta name="theme-color">` e antes ou depois do `<link pmoc.css>` (a ordem entre os dois não importa — CSS aplica os seletores de atributo já presentes quando o parser chega neles; o que importa é que o script rode antes de qualquer conteúdo do `<body>` ser pintado):

```html
<!-- Replicar nos 6 <head> (maquinas, transportes, eletrica, fonoclama, predial, mapa) -->
<script>(function(){
  var t = localStorage.getItem('pmoc_tema')
  if (t !== 'claro' && t !== 'escuro') {
    t = matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro'
  }
  if (t === 'claro') document.documentElement.setAttribute('data-theme','light')
})()</script>
```

Este bloco é pequeno o bastante (poucas linhas) para ser aceitável como repetição controlada 6×, no mesmo espírito da linha `<style>:root{--accent:#XXXXXX}</style>` que já se repete 6× hoje (`maquinas/index.html:11`, `transportes/index.html:11`, `eletrica/index.html:10`, `fonoclama/index.html:10`, `predial/index.html:10`, `mapa/index.html` — este último ainda sem `--accent` de módulo próprio, confirmar no planejamento).

2. **Botão de alternância dentro de `montarShell()`** (`shared/shell.js:36-44`, dentro do `topbar-right`, ao lado de `user-chip` e do botão "Sair"): como os 6 módulos já chamam `aplicarShell()`, este é o único ponto de código a mudar para o botão aparecer nos 6 de uma vez — exatamente o padrão que a Fase 5 já comprovou funcionar para o link "← Portal" e o botão "Sair".

**Por que não usar só um dos dois:** o script inline sozinho evita o flash mas não dá controle ao usuário (não é um botão); o botão sozinho (sem o script inline) alterna o tema corretamente depois que a página carrega, mas todo recarregamento de página pintaria primeiro no tema escuro padrão antes do JS do módulo (que só roda depois de `pmoc.css` e do parse do `<body>`) aplicar o tema salvo — a mesma falha de FOUC que a pesquisa web confirmou ser o motivo de existir a técnica do script inline síncrono no `<head>`.

**Nó a resolver — `mapa`:** `mapa/index.html` carrega, além de `shared/pmoc.css`, uma folha própria `xmap.css` (`mapa/xmap.css`, 394 linhas) com um sistema de tokens **inteiramente separado** (`--xm-bg:#07111f`, `--xm-panel:#0f2035`, `--xm-acc:#00b4d8`, etc. — `mapa/xmap.css:9-25`), usado pelo skin do Leaflet (barra lateral de camadas, legendas, marcadores). Esses tokens não derivam de `--bg`/`--surface`/etc. de `pmoc.css` e o arquivo não tem hoje nenhuma variação clara. O botão de tema, a topbar e o rodapé de `/mapa` alternam normalmente (vêm de `shared/shell.js`/`shared/pmoc.css`), mas o **conteúdo do mapa em si** (o componente Leaflet/xMap) continuaria sempre escuro a menos que `xmap.css` também ganhe um bloco `[data-theme="light"]`. Ver Open Questions #1 — decisão de escopo, não um bloqueio técnico.

### Anti-Patterns to Avoid

- **Redefinir as 13 propriedades inteiras dentro de `[data-theme="light"]`:** ver Pattern 1 — duplica manutenção e contraria o critério de sucesso 2.
- **Aplicar o tema só depois do `DOMContentLoaded` ou dentro de um `<script type="module">` importado:** reintroduz o FOUC que a técnica do script inline existe para evitar (achado da pesquisa web, ver Sources) — módulos ES são assíncronos por padrão.
- **Um `shared/tema.js` que também toca `montarShell()`/`aplicarShell()` diretamente:** mantenha a mesma separação de responsabilidade que `shell.js` já tem — `tema.js` decide/aplica o tema; `shell.js` só desenha o botão e chama uma função de `tema.js` no `onclick`.
- **Escutar mudança de `prefers-color-scheme` em tempo de execução depois que o usuário já escolheu manualmente:** contraria a persistência exigida pelo critério de sucesso 3 (a escolha manual do usuário deve prevalecer sobre uma mudança posterior do SO).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Detectar tema do SO | Heurística própria (ex.: checar hora do dia, ou pedir permissão) | `matchMedia('(prefers-color-scheme: light)')` | API padrão do navegador, exatamente para este caso; nenhuma vantagem em reimplementar |
| Verificar contraste WCAG AA das cores do tema claro | Fórmula de luminância relativa escrita à mão | Color picker nativo do Chrome DevTools (mostra a razão de contraste ao editar uma cor no painel Styles, com linha nos limiares 4.5:1/3:1) ou WebAIM Contrast Checker (web, sem instalação) | Confirmado por pesquisa web (ver Sources) — ferramenta pronta, sem precisar depender de build tooling que o projeto não tem |
| Persistir a escolha entre módulos | Cookie, ou `sessionStorage`, ou parâmetro de URL propagado manualmente entre rotas | `localStorage` com uma única chave, lido por `shared/tema.js` importado pelos 6 módulos | `localStorage` já é compartilhado automaticamente entre `/maquinas`, `/eletrica` etc. por serem a mesma origem (protocolo+host+porta) — confirmado nesta pesquisa; nenhuma sincronização manual necessária |

**Key insight:** o "hand-roll" real de risco nesta fase não é escrever lógica nova (a lógica de tema é pequena e padrão) — é **duplicar cor hardcoded** em vez de token. A Fase 5 já deixou 6 lugares em `shared/pmoc.css` onde isso acontece hoje (ver Common Pitfalls #1/#2); corrigir esses 6 pontos é pré-requisito silencioso do critério de sucesso 5, não um item opcional.

## Common Pitfalls

### Pitfall 1: 4 classes `.co-*` em `shared/pmoc.css` duplicam a cor como hex literal, não `var(...)`

**What goes wrong:** `shared/pmoc.css:76-79` —
```css
.co-warn{background:rgba(201,168,76,.08);border-color:var(--yellow);color:#c9a84c}
.co-red{background:rgba(184,92,74,.08);border-color:var(--red);color:#b85c4a}
.co-ok{background:rgba(90,158,111,.08);border-color:var(--green);color:#5a9e6f}
.co-blue{background:rgba(74,127,160,.08);border-color:var(--blue);color:#8eb9d1}
```
O `border-color` usa `var(--yellow)`/etc. corretamente, mas o `color` do texto é um hex literal que hoje **coincide** com o valor de `--yellow`/`--red`/`--green` só porque ninguém mudou esses tokens ainda. Se o tema claro (ou uma correção de contraste futura) redefinir `--yellow`/`--red`/`--green`/`--blue`, o `border-color` acompanha, mas o texto (`color`) fica preso na cor antiga — inconsistência visual silenciosa, sem erro.

**Why it happens:** esses 4 hex foram escritos antes de a Fase 5 estabelecer o padrão `color-mix(in srgb, var(--x) N%, transparent)` (usado em `.b-accent`, `shared/pmoc.css:64`, adicionado no plano 05-01) — os `.co-*` são mais antigos e nunca foram revisitados.

**How to avoid:** trocar `color:#c9a84c` → `color:var(--yellow)`, e o mesmo para `.co-red`/`.co-ok`/`.co-blue`. Zero mudança visual no tema escuro (os valores são idênticos hoje); vira automático no tema claro. Também considerar migrar os 4 `background:rgba(...)` para `color-mix(in srgb, var(--x) 8%, transparent)`, replicando o padrão já estabelecido em `.b-accent`, para que o fundo do callout também acompanhe qualquer ajuste futuro de tom por tema.

**Warning signs:** abrir qualquer view com um `callout co-warn`/`co-red`/`co-ok` (usado em pelo menos `maquinas/app.js:265,413,927`, `transportes/app.js:171,378,381,687,689,787,1503`, `predial/app.js:289,290,526,540,1057`, `mapa/app.js:62,94`) no tema claro e comparar visualmente a cor da borda com a cor do texto — se divergirem, o hardcode não foi corrigido.

### Pitfall 2: borda de tabela hardcoded em branco 4% de opacidade — invisível sobre fundo claro

**What goes wrong:** `shared/pmoc.css:54` — `.tbl td{...border-bottom:1px solid rgba(255,255,255,.04);...}`. Essa borda depende implicitamente de o fundo por trás ser escuro para ter qualquer contraste. Sobre um `--surface`/`--bg` claro, `rgba(255,255,255,.04)` se torna, na prática, quase idêntica ao próprio fundo — a borda entre linhas da tabela desaparece.

**Why it happens:** foi escrita como "branco translúcido" (uma técnica comum para escurecer/clarear uma superfície sem precisar de um token dedicado), o que só funciona em um tema fixo.

**How to avoid:** trocar por `var(--border)` (o token que já existe e já muda por tema) ou por um novo token dedicado a "borda sutil de tabela" se `var(--border)` for visualmente forte demais para esse uso específico — decisão de execução, não de pesquisa.

**Warning signs:** abrir qualquer `.tbl` (ativos, materiais, OS, planos — presentes nos 6 módulos) no tema claro e verificar se as linhas têm separação visual.

### Pitfall 3: `<meta name="theme-color">` hardcoded para escuro nos 6 `index.html`

**What goes wrong:** os 6 módulos têm `<meta name="theme-color" content="#1a1a18"/>` fixo (`maquinas/index.html:6`, e idêntico nos outros 5). Essa meta tag controla a cor da barra de UI do navegador/PWA (Android Chrome, iOS Safari) — se não for atualizada quando o usuário troca para o tema claro, a barra do navegador fica escura enquanto a página fica clara, uma inconsistência visual perceptível fora do controle do CSS.

**Why it happens:** a tag não é um custom property CSS — precisa ser atualizada via JS (`meta.setAttribute('content', ...)`), o que só faz sentido depois que existe lógica de tema para chamar.

**How to avoid:** `aplicarTema()` em `shared/tema.js` deve atualizar essa meta tag toda vez que o tema mudar (ver esboço de código em Pattern 2).

### Pitfall 4: script anti-FOUC não pode ser módulo ES nem depender de `import`

**What goes wrong:** os 6 módulos já carregam `type="module"` para o `app.js` principal (confirmado: `eletrica/index.html`, `fonoclama/index.html`, `predial/index.html`, `mapa/index.html`, `transportes/index.html` — e `maquinas/index.html` desde o plano 05-06). Módulos ES são carregados de forma assíncrona/adiada por padrão (o navegador não bloqueia o parsing do resto da página para executá-los) — se o código que lê `localStorage`/`matchMedia` e aplica `data-theme` estiver dentro de um `<script type="module">`, ele roda tarde demais, depois que o navegador já começou a pintar a página no tema escuro padrão, e o FOUC volta a acontecer.

**Why it happens:** é contraintuitivo, porque todo o resto do JS do projeto já é `type="module"` — a exceção precisa ser deliberada e comentada no código para não ser "corrigida" por engano numa fase futura.

**How to avoid:** o script anti-FOUC é um `<script>` clássico, inline, sem `type="module"` nem `src` externo, colocado no `<head>`, antes de qualquer conteúdo do `<body>` — replicado como texto idêntico nos 6 `index.html` (não importado de `shared/tema.js`, porque um `import` de módulo teria o mesmo problema de atraso). `shared/tema.js` pode reexportar a mesma função de detecção para uso posterior (no clique do botão), mas a leitura inicial que evita o flash tem que ser um script solto no HTML.

### Pitfall 5: `tests/shell.test.js` faz asserções por regex sobre o HTML de `montarShell()` — o botão novo não pode colidir

**What goes wrong:** `tests/shell.test.js` (6 casos, todos passando hoje) inclui asserções como `topo.match(/<button class="nav-btn[^"]*"/g).length === 2` (para o caso de duas abas) e `assert.doesNotMatch(topo, /class="nav"/)` (para `navItems: []`). Se o botão de tema for inserido com uma classe que contenha a substring `"nav"` ou `"nav-btn"`, ou se ele for contado sem querer nas regexes de botão, algum dos 6 testes existentes quebra sem relação real com o tema.

**Why it happens:** os testes atuais usam regex simples sobre a string de `topo`, não um parser de DOM — qualquer HTML novo dentro de `topo` é candidato a colidir com um padrão existente por acidente.

**How to avoid:** ao editar `shared/shell.js`, rodar `node --test tests/shell.test.js` imediatamente após a mudança, antes de seguir para os outros arquivos, e usar uma classe claramente distinta para o botão (ex.: `btn-tema`, não algo que comece com `nav`). Adicionar um caso novo em `tests/shell.test.js` cobrindo o botão de tema (presença do `id`/`onclick` esperado) segue o mesmo padrão dos 6 casos existentes.

### Pitfall 6: `mapa/xmap.css` é um sistema de tokens paralelo, dark-only, e não vem de `shared/pmoc.css`

**What goes wrong:** ver Pattern 3, "Nó a resolver — mapa". Se o critério de sucesso 5 ("todo texto permanece legível nos dois temas") for interpretado como cobrindo *todo* pixel de todo módulo, o painel do Leaflet/xMap em `/mapa` (sidebar de camadas, legendas, popups de marcador) fica de fora, porque usa `--xm-*` (`mapa/xmap.css:9-25`), não `--bg`/`--surface`/etc.

**How to avoid:** decisão de escopo explícita antes do planejamento (ver Open Questions #1) — não descobrir isso no meio da execução.

## Code Examples

### Precedente já existente no repositório para o mecanismo `data-theme` (material de referência, não produto)
```html
<!-- Source: ref/transportes (3).html:2 (arquivo de referência local, não parte do produto pmoc) -->
<html lang="pt-BR" data-theme="dark">
...
<!-- ref/transportes (3).html:50-63 — sobrescreve só um subconjunto de tokens -->
[data-theme="light"] {
  --navy-950: #f0f4fb;
  --text-1:   #0f2040;
  --surface-1: #ffffff;
  --border:    rgba(0,0,0,0.08);
  /* ... */
}
```
```javascript
// Source: ref/transportes (3).html:1879-1884 — alternância (sem anti-FOUC; roda em DOMContentLoaded)
function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme')
  const next = curr==='dark'?'light':'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('trsp_theme', next)
}
```
Nota: este precedente aplica o tema salvo em `DOMContentLoaded` (`ref/transportes (3).html:1939-1940`), não antes do primeiro paint — ou seja, o próprio precedente local **tem** FOUC. `ref/xgrama.html:115` é o único arquivo do repositório que já usa a técnica correta (script síncrono logo após `<body>` abrir, antes de qualquer outro conteúdo), mas com `classList` em vez de atributo. Nenhum dos dois precedentes deve ser copiado literalmente — servem só para confirmar que o padrão geral (`data-theme`/`localStorage`) já foi usado no histórico deste projeto, não como fonte de código pronto.

### Padrão já provado em produção para ponto único de injeção (a reaproveitar)
```javascript
// Source: shared/shell.js:36-44 (em produção, consumido pelos 6 módulos via aplicarShell())
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
O botão de tema entra neste mesmo bloco `topbar-right`, seguindo a mesma convenção `<button class="btn btn-s btn-sm" onclick="...">` já usada pelo botão "Sair" — sem introduzir um padrão de marcação novo.

### `var(--x, fallback)` em `shared/auth.js` já segue o tema automaticamente, sem mudança

```javascript
// Source: shared/auth.js:70-71 — já usa var() com fallback, herda qualquer tema aplicado no <html>
el.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;' +
  'padding:20px;background:var(--bg,#1a1a18)'
```
Como a tela de login (`Auth.mount()`) usa `var(--bg,...)`/`var(--surface,...)`/etc. em vez de hex fixo, ela reage à troca de `data-theme` sem nenhuma mudança de código em `shared/auth.js` — desde que o script anti-FOUC já tenha aplicado o atributo antes do login renderizar (o que ele faz, por rodar no `<head>`, antes de qualquer script de módulo criar a tela de login).

## State of the Art

| Old Approach | Current Approach (proposta desta fase) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `shared/pmoc.css` define uma única paleta fixa em `:root`, sem alternativa | `:root` (escuro, inalterado, continua o padrão) + `[data-theme="light"]` aditivo | Fase 6 | Zero mudança visual para quem nunca troca de tema; tema claro passa a existir como opção |
| Nenhum módulo lê `prefers-color-scheme` ou `localStorage` de tema | `shared/tema.js` centraliza detecção/aplicação/alternância, uma vez, reaproveitado pelos 6 módulos | Fase 6 | Mesmo padrão de "um arquivo em `shared/`, consumido pelos 6" que `shell.js`/`auth.js`/`pmoc.css` já estabeleceram na Fase 5 |
| `.co-*`/`.tbl td` em `pmoc.css` têm cor hardcoded coincidindo com o token atual | Corrigidos para `var(...)` antes de introduzir o segundo tema | Fase 6 (pré-requisito) | Sem essa correção, o tema claro herdaria bordas/textos "presos" na cor escura em pontos específicos, falhando o critério de sucesso 5 silenciosamente |

**Deprecated/outdated:** nenhum — esta fase é puramente aditiva sobre a base da Fase 5, sem remover nenhum arquivo ou padrão existente.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Nome da chave de `localStorage` (`pmoc_tema`) e dos valores internos (`'claro'`/`'escuro'` em vez de `'light'`/`'dark'`) são sugestões desta pesquisa, sem convenção estabelecida no código do produto (só existem precedentes divergentes em `ref/*.html`: `trsp_theme`, `xc_theme`, ambos fora do produto) | Pattern 2 | Baixo risco técnico — é só uma escolha de nome; mas deve ser decidida uma vez e documentada, não inventada de novo em cada módulo |
| A2 | Os valores de cor exatos do tema claro (`--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--text2`, `--text3` e possivelmente `--green`/`--yellow`/`--red`/`--blue`/`--orange` ajustados para contraste) não existem em nenhum lugar do repositório hoje — os exemplos numéricos desta pesquisa (`#f4f2ec`, `#ffffff`, etc.) são ilustrativos, não testados por contraste | Pattern 1, Common Pitfalls | Se copiados sem verificação de contraste real (WCAG AA, ver Sources), o tema claro pode nascer já falhando o critério de sucesso 5; a pesquisa recomenda checar cada par texto/fundo com o color picker do DevTools ou WebAIM antes de fechar os valores |
| A3 | `mapa/xmap.css` (skin do Leaflet/xMap, tokens `--xm-*` próprios, dark-only) está fora do escopo mínimo desta fase — só a topbar/rodapé de `/mapa` (que vêm de `shared/shell.js`) alternam; o mapa em si continuaria sempre escuro | Pattern 3, Common Pitfalls #6, Open Questions #1 | Se o usuário esperava que o mapa completo (incluindo o Leaflet) alternasse de tema, a implementação mínima proposta ficaria incompleta — precisa confirmação explícita antes do planejamento |
| A4 | O portal (`/index.html`, fora da lista de "6 módulos" em `REQUIREMENTS.md`/`ROADMAP.md`) não é tocado por esta fase, mesmo duplicando os mesmos tokens de cor inline (`index.html:8-11`) sem carregar `shared/pmoc.css` | Sources / Open Questions #4 | Se o usuário navegar do portal (sempre escuro) para um módulo em tema claro, a transição visual será abrupta — risco de UX baixo mas perceptível, fora do escopo formal de PLAT-04/05 |

**Se esta tabela estivesse vazia:** não estaria — as 4 entradas acima (nomes de chave, valores de cor do tema claro, escopo do mapa/Leaflet, escopo do portal) precisam de confirmação explícita, idealmente via `/gsd-discuss-phase`, antes de virarem decisão travada no plano.

## Open Questions

1. **`mapa/xmap.css` (skin do Leaflet/xMap) entra no escopo desta fase ou fica dark-only?**
   - What we know: usa tokens `--xm-*` totalmente separados de `shared/pmoc.css`, sem nenhuma variação clara hoje (`mapa/xmap.css:9-25`)
   - What's unclear: se o critério de sucesso 5 ("todo texto legível nos dois temas") cobre esse componente ou só o chrome comum (topbar/rodapé/tokens de `pmoc.css`)
   - Recommendation: tratar como fora do escopo mínimo nesta fase (mesmo raciocínio da Fase 5 de não misturar chrome com conteúdo específico de módulo), documentar a limitação, e confirmar com o usuário se vale abrir um item de backlog

2. **Quais valores exatos de cor o tema claro deve usar, incluindo se as cores semânticas (`--green`/`--yellow`/`--red`/`--blue`/`--orange`) precisam de ajuste para contraste ou podem ser reaproveitadas como estão?**
   - What we know: os 7 tokens neutros certamente mudam; as 5 cores semânticas foram calibradas para contraste sobre fundo escuro (`--bg:#1a1a18`), não claro
   - What's unclear: se `--yellow:#c9a84c` (por exemplo) ainda passa em WCAG AA como texto sobre um `--bg` claro, ou se precisa de uma variante mais escura só para o tema claro
   - Recommendation: verificar cada par cor-de-texto/fundo com o color picker do Chrome DevTools ou WebAIM Contrast Checker durante a execução, antes de fechar os valores no plano

3. **Convenção de nomes: chave de `localStorage`, valores internos do tema, texto/ícone do botão**
   - What we know: nenhum precedente no código do produto (só em `ref/*.html`, com nomes divergentes entre si)
   - What's unclear: preferência do usuário por nomes em português (`'claro'`/`'escuro'`) vs. inglês (`'light'`/`'dark'`) — o resto do projeto é 100% português, mas `data-theme="light"`/`"dark"` como valores de atributo CSS seguiria a convenção mais comum da plataforma web
   - Recommendation: usar português para a chave/valores internos de `localStorage` (`pmoc_tema`, `'claro'`/`'escuro'`) mas manter `data-theme="light"`/`"dark"` como valores do atributo HTML (convenção de mercado, não visível ao usuário) — confirmar no planejamento

4. **O portal (`/index.html`) deve honrar o mesmo tema, mesmo estando fora da lista formal de "6 módulos"?**
   - What we know: portal duplica os tokens de cor inline, sem carregar `shared/pmoc.css`; não está em PLAT-04/05 nem na lista de módulos do roadmap para esta fase
   - What's unclear: se a inconsistência visual ao navegar portal↔módulo é aceitável para o usuário
   - Recommendation: manter fora do escopo desta fase (é literalmente o mesmo raciocínio de PLAT-15 para `refrigeracao` — não expandir escopo sem decisão explícita), mas registrar como possível item futuro

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Não (sem mudança) | Esta fase não toca `shared/auth.js` nem o fluxo de login |
| V3 Session Management | Não (sem mudança) | Sessão continua gerenciada pelo SDK do Supabase, sem relação com tema |
| V4 Access Control | Não (sem mudança) | Preferência de tema não tem relação com RLS/RBAC |
| V5 Input Validation | Sim, pontual | O valor lido de `localStorage.getItem('pmoc_tema')` deve ser validado contra uma lista fechada (`'claro'`/`'escuro'`) antes de ser usado — se alguém (extensão de navegador, DevTools, um bug futuro) gravar um valor arbitrário na chave, `aplicarTema()` não deve propagar esse valor cru para `data-theme`; cair de volta em `detectarTema()` (SO/padrão) se o valor salvo não for um dos dois esperados |
| V6 Cryptography | Não aplicável | Nenhum dado sensível envolvido — preferência de tema não é segredo |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Valor inesperado gravado na chave de `localStorage` de tema (manual, extensão, ou versão futura do código gravando um valor diferente) | Tampering (baixo impacto — só afeta a própria sessão do usuário, não dados de outros) | Validar contra lista fechada em `detectarTema()`/`aplicarTema()`, com fallback para o padrão do SO, como já descrito em V5 acima |
| XSS via texto do botão de tema | Tampering / Information Disclosure | Não aplicável — o texto do botão é estático (ex.: "☀️"/"🌙" ou "Claro"/"Escuro"), não vem de input do usuário nem do banco; `esc()` de `shared/shell.js` já cobre qualquer string vinda de `cfg` caso o botão vire configurável no futuro |

## Sources

### Primary (HIGH confidence — leitura direta do repositório, todas com `arquivo:linha`)
- `.planning/REQUIREMENTS.md` — PLAT-04, PLAT-05, PLAT-15, PLAT-16, e a tabela de rastreabilidade
- `.planning/ROADMAP.md` — goal, dependências e critérios de sucesso da Fase 6
- `.planning/STATE.md` — decisões acumuladas do milestone v2.0, baseline pós-Fase 5
- `.planning/phases/05-base-unificada/05-RESEARCH.md`, `05-01-SUMMARY.md`, `05-07-SUMMARY.md` — o que a Fase 5 entregou e decidiu (D-01/D-02/D-03)
- `CLAUDE.md`, `.claude/CLAUDE.md` — convenções obrigatórias do projeto
- `shared/pmoc.css` (130 linhas, lido por completo) — os 13 tokens em `:root` (linhas 8-13), os 6 hardcodes de cor encontrados (linhas 54, 76-79), o padrão `color-mix` já estabelecido (linha 64)
- `shared/shell.js` (86 linhas, lido por completo) — `montarShell()`/`aplicarShell()`, ponto único de injeção do chrome
- `shared/auth.js` (292 linhas, lido por completo) — confirma uso de `var(--x, fallback)` em toda a tela de login
- `maquinas/index.html`, `transportes/index.html`, `eletrica/index.html`, `fonoclama/index.html`, `predial/index.html`, `mapa/index.html` — `<head>` de cada um lido (confirmando estrutura idêntica) e busca exaustiva de `#[0-9a-f]{3,6}` e `rgba` em cada `index.html`/`app.js`
- `mapa/xmap.css` (394 linhas, trecho inicial lido por completo) — sistema de tokens `--xm-*` separado, dark-only
- `index.html` (portal, cabeçalho lido) — confirma que não carrega `shared/pmoc.css`, fora do escopo desta fase
- `refrigeracao/index.html` — reverificado, `grep -c 'shared/\|pmoc.css'` = 0
- `TESTES.md` — roteiro manual da Fase 5, seções de auditoria de fechamento
- `tests/shell.test.js` (6 casos, lido) e `node --test` executado nesta pesquisa: 25/25 passando (baseline)
- `ref/transportes (3).html`, `ref/transportes (2).html`, `ref/xgrama.html` — material de referência local (dentro do próprio repositório `pmoc-overlay/ref/`, não em `DEV_ERP`), únicos precedentes de `data-theme`/tema claro-escuro encontrados no histórico do projeto; usados só como confirmação de padrão, não como fonte de código a copiar
- `.planning/config.json` — `workflow.nyquist_validation: false` (seção de validação omitida), `workflow.security_enforcement: true`, `security_asvs_level: 1` (seção de segurança incluída)

### Secondary (MEDIUM confidence — busca web, cruzada com fonte oficial)
- MDN Web Storage API — `localStorage` é particionado por origem (protocolo+host+porta), não por path; confirma que os 6 módulos (mesma origem Vercel) compartilham a mesma área de `localStorage` automaticamente
- Padrão de mercado (múltiplas fontes convergentes, incluindo o raciocínio usado por bibliotecas como MUI) para evitar FOUC: script inline síncrono no `<head>`, antes do primeiro paint, aplicando o atributo/classe de tema antes de qualquer CSS ser pintado
- Chrome DevTools (color picker no painel Styles) e WebAIM Contrast Checker como formas de verificar contraste WCAG AA (4.5:1 texto normal, 3:1 texto grande) sem depender de build tooling

### Tertiary (LOW confidence)
- Nenhuma

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — só API nativa de navegador, sem lib nova, tudo verificável por leitura de código
- Architecture (tokens/shell/anti-FOUC): HIGH para os fatos sobre o código atual (citados `arquivo:linha`); MEDIUM para a técnica anti-FOUC em si, que vem de busca web cruzada com múltiplas fontes convergentes
- Pitfalls: HIGH — os 6 hardcodes de cor foram confirmados por grep exaustivo em `shared/pmoc.css`, não estimados
- Assumptions (A1-A4): MEDIUM/LOW por natureza — nomes, valores de cor exatos e escopo do mapa/portal são decisões de produto/UX que só o usuário pode confirmar

**Research date:** 2026-08-11
**Valid until:** ~14 dias — a fase depende só de `shared/pmoc.css`/`shared/shell.js` da Fase 5, que já estão auditados e fechados (05-07); risco de "esfriar" é baixo a menos que outra fase mexa nesses dois arquivos antes desta ser executada
