# Phase 7: UI/UX mobile - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Os 4 módulos sem tratamento responsivo — `eletrica`, `fonoclama`, `predial` e `mapa` — ficam utilizáveis em tela de celular (375 px), sem rolagem horizontal da página, com tabelas rolando dentro do próprio contêiner, modais e formulários preenchíveis sem zoom, e navegação alcançável com o polegar. `maquinas` e `transportes` não podem regredir. `refrigeracao` continua congelada e intocada (PLAT-15/PLAT-16).

O trabalho é de **adequação responsiva na folha comum e no chrome dos módulos**, não de reescrita de renderização nem de novas funcionalidades.

</domain>

<decisions>
## Implementation Decisions

### Navegação no celular
- **D-01:** A tira de abas (`.nav`) **permanece no topo, rolável na horizontal** — não vira barra fixa inferior nem gaveta. O critério 4 (alcance do polegar) é atendido aumentando a área de toque dos controles para ~44 px e dando indicação visual de que a tira rola, não mudando a posição da navegação. Motivo: a mudança fica em um arquivo só (`shared/pmoc.css`), vale para os 6 módulos de uma vez e não conflita com o mapa, que ocupa `100vh` e teria de tratar uma barra inferior à parte.

### Tabelas largas
- **D-02:** Tabelas largas **rolam horizontalmente dentro do contêiner** (`.tbl-wrap`, que já faz `overflow:auto`) — não viram cartões empilhados. O trabalho é garantir que **toda** tabela dos módulos esteja dentro do wrapper e que haja indicação visual de que existem mais colunas. Motivo: é o que o critério 2 pede literalmente; virar cartões seria reescrever renderização em 4+ módulos, com risco de regressão em `maquinas`/`transportes` (critério 5).

### Verificação
- **D-03:** Os critérios são provados por **gate estático em `node --test` + roteiro manual em `TESTES.md`** — sem Playwright, sem `npm`, sem `package.json`. O repo é zero-build por decisão de plataforma e introduzir `node_modules` só para medir viewport custa mais do que resolve. Os testes de contrato verificam o que é verificável estaticamente (ex.: nenhuma largura fixa acima de 375 px no chrome dos módulos, `font-size` de campo de formulário ≥ 16 px, toda tabela dentro de `.tbl-wrap`); a ausência de rolagem horizontal em 375 px vira item de checklist manual.
- **D-04:** Como consequência de D-03, o gate é **permanente** (no padrão dos gates da Fase 10): uma fase futura que reintroduza largura fixa ou campo abaixo de 16 px falha `node --test` antes da revisão humana.

### Critério do sem-zoom
- **D-05:** "preencher e salvar sem zoom" (critério 3) é atendido subindo o `font-size` dos campos de formulário para 16 px — abaixo disso o Safari do iOS aplica zoom automático no foco. Vale para `input`, `select` e `textarea` da folha comum.

### Claude's Discretion
- Breakpoints exatos, valores de padding/altura e a forma da indicação de rolagem ficam a critério do planejamento, desde que respeitem D-01/D-02 e os tokens existentes.
- Se `maquinas/index.html` continua com `@media` própria ou migra para a folha comum é decisão de implementação — o que não pode é regredir (critério 5).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Base compartilhada (o que muda vale para 6 módulos de uma vez)
- `shared/pmoc.css` — fonte única de tokens e de todo o layout comum; as duas únicas `@media` do projeto vivem nas linhas 145-146
- `shared/shell.js` — cabeçalho, tira de abas e rodapé dos 6 módulos; mudar aqui muda os 6
- `shared/tema.js` — tema claro/escuro; qualquer regra nova precisa funcionar nos dois temas (critério 5 da Fase 6)
- `shared/modulo-manutencao.js` — motor de renderização de `eletrica` e `fonoclama`; é onde as tabelas desses dois módulos são geradas (5 usos de `.tbl-wrap`)

### Módulos no escopo
- `eletrica/index.html`, `eletrica/app.js`
- `fonoclama/index.html`, `fonoclama/app.js`
- `predial/index.html`, `predial/app.js` (4 usos de `.tbl-wrap`), `predial/dominio.js`
- `mapa/index.html` — chrome do módulo; a sidebar já é overlay `min(220px,80vw)` e `#editor-painel` está fixo em `300px`
- `mapa/xmap.css` — **travado, fora do escopo** (skin do Leaflet, sistema de tokens `--xm-*` próprio, D-01 da Fase 6)
- `mapa/xmap.js` — **travado, sem edição** (decisão da Fase 10)

### Não regressão
- `maquinas/index.html:72` — única `@media` fora da folha comum hoje
- `transportes/index.html`, `transportes/app.js`
- `refrigeracao/` — congelada (PLAT-15/PLAT-16); nenhum arquivo pode ser tocado
- `TESTES.md` — roteiro manual; recebe o checklist de 375 px
- `tests/` — 135 testes verdes na baseline (commit `2b3cade`); é o gate de não regressão

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.tbl-wrap{overflow:auto}` já existe e resolve o critério 2 — falta cobertura, não mecanismo
- `.nav{overflow-x:auto}` + `.nav-btn{white-space:nowrap}` já fazem a tira rolar; falta área de toque e affordance
- `.overlay{padding:16px}` + `.modal{width:100%;max-width:700px;max-height:90vh}` já cabem em 375 px
- `.kpi-row` usa `auto-fit,minmax(170px,1fr)` e a `@media` de 700 px já força 2 colunas — cabe em 375 px (2×170+12=352)
- A sidebar do mapa já é overlay fora do fluxo, com `width:min(220px,80vw)` — o padrão a replicar

### Established Patterns
- Divisão núcleo puro / aplicador de DOM (`shared/tema.js`, `mapa/mapa-geometria.js`): o que for testável em Node fica sem API de navegador
- Gates permanentes por decisão travada (Fase 10, `tests/mapa-decisoes.test.js`): decisão registrada vira teste, não comentário
- Zero-build: sem `npm`, sem `package.json`, testes só com `node:test`/`node:assert`

### Integration Points
- Toda regra responsiva nova entra em `shared/pmoc.css`; o chrome específico de `mapa/index.html` é a exceção justificada
- O gate estático precisa ler CSS/HTML como texto — não há DOM disponível em `node --test`

### Lacunas já identificadas no scout
1. `input,select,textarea` em `font-size:13px` — abaixo do limite de 16 px do iOS (D-05)
2. `.topbar` com `height:52px` fixo e 4 elementos (logo, chip de usuário, botão de tema, link do portal) — risco de estouro em 375 px
3. `#editor-painel` do mapa fixo em `300px` — deveria seguir o padrão `min(300px,90vw)` da sidebar
4. `.main{padding:24px 20px}` e `.topbar{padding:0 20px}` — margens a revisar em tela estreita
5. `maquinas/index.html:72` tem `@media` própria fora da folha comum
6. Nenhum gate automatizado de responsividade existe hoje

</code_context>

<specifics>
## Specific Ideas

O alvo de tela é **375 px** (crítério 1), o que corresponde ao iPhone SE/13 mini — a menor tela realista de uso em campo no CMASM.

</specifics>

<deferred>
## Deferred Ideas

- **Tabelas como cartões empilhados no celular** — melhora a leitura, mas é reescrita de renderização; se voltar, vira fase própria depois da Fase 8 (kanban/calendário compartilhados), que já mexe na camada de componentes
- **Barra de navegação fixa inferior** — descartada em D-01; reconsiderável só se o uso em campo mostrar que a tira do topo não serve
- **`mapa/xmap.css` responsivo** — travado desde a Fase 6 (D-01); o skin do Leaflet segue dark-only e fora do escopo
- **`refrigeracao` responsiva** — congelada por decisão; é milestone próprio depois do v2.0

</deferred>

---

*Phase: 7-UI/UX mobile*
*Context gathered: 2026-08-17*
