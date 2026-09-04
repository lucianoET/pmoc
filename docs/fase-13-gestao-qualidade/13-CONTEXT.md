# Phase 13: Gestão e Qualidade - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning
**Source:** PRD Express Path (docs/fase-13-gestao-qualidade/13-PRD.md)

<domain>
## Phase Boundary

Ferramentas de gestão da qualidade (gráficos, indicadores, Gantt, kanban, calendário, GUT, curva ABC — e, na Onda B, 5W2H, Pareto, Ishikawa, PDCA, carta de controle, 5S, POP) existem **uma vez** em `shared/` como núcleos puros testáveis em Node, e o módulo `/gestao` os consome sobre os dados de todos os módulos. Três ondas: A (núcleo em `shared/` + adoção por Máquinas e Predial), B (módulo `/gestao` com migração 60), C (adoção pelos painéis de Máquinas e Transportes e pelo Estoque). **A Onda A é executada primeiro (`--wave 1`); B e C só depois de nova aprovação do usuário.**

</domain>

<decisions>
## Implementation Decisions

### Arquitetura dos componentes (GEQ-01, GEQ-02, GEQ-03)
- **D-01:** `shared/grafico.js` — funções puras que devolvem SVG inline (barras, linha, Pareto = barras + linha acumulada, carta de controle com média/LSC/LIC e pontos fora, sparkline). `currentColor` e classes por tom semântico (`neutro/info/ok/warn/erro`); **nenhuma cor escrita em JavaScript** (regra de `shared/icones.js` e `shared/componentes.js`).
- **D-02:** `shared/indicadores.js` — definição `{id, rotulo, unidade, meta, sentido:'maior'|'menor', faixas}`, `avaliar(valor, def)` → tom, `tendencia(serie)`, `cartaoIndicador()` devolve HTML com `.kpi` + semáforo + sparkline.
- **D-03:** `shared/gantt.js` — `linhasGantt(itens, {inicio, fim})` devolve posições em % para CSS grid, marca de hoje; item sem fim usa hoje; HTML puro, sem canvas (D-13-04).
- **D-04:** `shared/abc.js` — `classificarAbc(itens, campoValor, cortes=[0.8,0.95])` → A/B/C + acumulado, genérico por definição de campo.
- **D-05:** Todos os núcleos: nenhuma API de navegador (`document`, `window`, `localStorage`), nenhuma dependência nova, testáveis em `node --test`. Mesmo corte núcleo-puro/aplicador-de-DOM de `shared/tema.js`, `shared/tabela.js`, `shared/fluxo.js`.

### Extração de Máquinas e Predial (GEQ-04, GEQ-05, PLAT-08, PLAT-09)
- **D-06:** `shared/kanban.js` nasce de `maquinas/operacoes.js` (`agruparOperacoes`, `STATUS_KANBAN`) — genérico por definição de colunas; Máquinas passa a consumir de `shared/`.
- **D-07:** `shared/calendario.js` nasce de `maquinas/app.js#renderAgenda` (~L1157) e `maquinas/operacoes.js#criarEventosCalendario`: `gradeMes(ano, mes)`, `agruparPorData(eventos)`, `htmlCalendario(...)`; Máquinas consome.
- **D-08:** `tests/operacoes-maquinas.test.js` e `tests/integracao-operacoes-maquinas.test.js` ficam **sem uma linha mudada** e continuam passando — a extração é refatoração, não mudança de comportamento. Se a API pública de `OperacoesMaq` for mantida como fachada sobre `shared/`, os gates existentes provam a preservação.
- **D-09:** `shared/gut.js` recebe `GUT_ESCALA`, `classificarGut` (de `predial/dominio.js`) e ganha `gutTotal(g,u,t)`; `predial/dominio.js` **reexporta** (mesmo precedente do `export { montarArvore, linhasVisiveis } from '../shared/arvore.js'` já existente). `tests/predial-dominio.test.js` intocado.

### CSS (todas as ondas)
- **D-10:** Classes novas (`.gantt*`, `.kanban*`, `.calendar*`, `.indicador*`, `.grafico*`) entram em `shared/pmoc.css` usando só tokens existentes. O CSS de calendário/kanban hoje em `maquinas/index.html` migra para `pmoc.css`. Precedente: `.pilula`/`.regua` entraram em `pmoc.css` quando `componentes.js` nasceu. `tests/tema-superficies.test.js` proíbe token de cor próprio nos módulos — respeitar.

### Módulo `/gestao` (Onda B — GEQ-06..10)
- **D-11:** `supabase/60_gestao_schema.sql`, aditiva, sem DROP: `ges_acoes` (5W2H: o quê, por quê, onde, quando, quem, como, quanto; g/u/t; `gut_total` gerado; `status` em lista fechada; `modulo`, `ativo_ref`), `ges_indicadores`, `ges_indicador_valores` (indicador_id, periodo date, valor), `ges_pop` (titulo, texto, modulo, ativo_ref, plano_ref), `ges_causas` (acao_id, categoria 6M, causa). RLS leitura `public`, escrita `authenticated` (D-13-05).
- **D-12:** `gestao/index.html` + `gestao/app.js` com `aplicarShell`, `Auth`, abas Painel · Ações · Calendário · Ferramentas · POP.
- **D-13:** Painel: OS abertas por módulo, backlog, MTBF/MTTR, custo previsto × realizado, retrabalho (NBR 5674 item 7.5). Lê `maq_os`, `transp_*`, `logs_manutencao` (refrigeração, **só leitura** — D-13-03), `pred_inspecao_itens`, `cal_*` vencendo.
- **D-14:** Ações: lista com `shared/tabela.js`, kanban e Gantt da mesma lista; fluxo de estados via `shared/fluxo.js`.
- **D-15:** Calendário consolida OS e vencimentos de todos os módulos, inclusive `refrigeracao`, só leitura (GEQ-09).
- **D-16:** Ferramentas: Pareto, Ishikawa, PDCA, carta de controle, curva ABC, checklist 5S (GEQ-07). POP ligado a ativo ou plano (GEQ-08).
- **D-17:** `vercel.json` ganha rota `/gestao`; portal `index.html` ganha card (GEQ-10).

### Adoção (Onda C)
- **D-18:** `indicadores.js` nos painéis de Máquinas e Transportes; curva ABC na aba Estoque de Máquinas.

### Não regressão (PLAT-16)
- **D-19:** `refrigeracao` byte a byte igual — lido, nunca editado. `mapa/xmap.js` intocável. Todos os gates existentes em `tests/` continuam passando.

### Claude's Discretion
- Assinaturas exatas das funções puras, nomes de classes CSS, formato interno das definições de coluna/etapa, ordem dos testes, texto dos cabeçalhos de arquivo (manter o estilo de comentário-ensaio dos outros `shared/*.js`).
- Como Máquinas consome `shared/kanban.js`/`shared/calendario.js`: `maquinas/operacoes.js` é UMD (`root.OperacoesMaq`) carregado sem módulo ES — a fachada pode importar de `shared/` via ES module em `app.js` e injetar, ou `operacoes.js` pode virar reexport. Escolher o caminho que deixa os dois gates existentes intocados.
- Se um gate novo por componente ou um gate agrupado por onda — o padrão do projeto é um gate por decisão/feature, nomeado pelo que protege.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fase e requisitos
- `.planning/ROADMAP.md` — seção "### Phase 13: Gestão e Qualidade" (objetivo, critérios de sucesso, ondas, decisões D-13-01..06)
- `.planning/REQUIREMENTS.md` — seção "### Gestão e Qualidade (GEQ) — Phase 13" e PLAT-08/09/16
- `docs/fase-13-gestao-qualidade/13-PRD.md` — PRD aprovado pelo usuário em 04/09/2026

### Padrão núcleo-puro / aplicador-de-DOM (copiar o estilo)
- `shared/componentes.js` — peças puras que devolvem HTML; `tom` semântico, nenhuma cor em JS
- `shared/fluxo.js` — núcleo puro por definição de etapas
- `shared/tabela.js` — núcleo puro por definição de colunas; adaptadores em `maquinas/estoque-tabela.js`, `reparos/tabelas.js`, `maquinas/areas-tabela.js`
- `shared/tema.js` — separação núcleo puro / DOM
- `shared/icones.js` — SVG inline em `currentColor`, nome desconhecido devolve vazio
- `shared/arvore.js` + `predial/dominio.js` — precedente de reexport de `shared/` por um módulo

### Código a extrair
- `maquinas/operacoes.js` — `STATUS_KANBAN`, `agruparOperacoes`, `criarEventosCalendario` (UMD, `root.OperacoesMaq`)
- `maquinas/app.js` — `renderOperacoes()` (~L788), `renderAgenda()`/`navegarAgenda()` (~L1157)
- `maquinas/index.html` — marcação do kanban (`operacoes-kanban`) e CSS `.calendar-*`
- `predial/dominio.js` — `GUT_ESCALA`, `classificarGut`

### Gates a preservar
- `tests/operacoes-maquinas.test.js`, `tests/integracao-operacoes-maquinas.test.js`, `tests/predial-dominio.test.js`, `tests/tema-superficies.test.js`, `tests/chrome-icones.test.js`, `tests/mobile-375.test.js`

### Convenções
- `CLAUDE.md`, `.claude/CLAUDE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md`
- `ref/Plano Estratégico de Gestão de Manutenção Edificada_ Diretrizes e Fluxos Operacionais.md` — item 8 (KPIs da NBR 5674 7.5) e item 5 (Gantt e calendários)

</canonical_refs>

<specifics>
## Specific Ideas

- Os três KPIs do item 7.5 da NBR 5674 (custo/tempo previsto × realizado; taxa de retrabalho; custo × benefício ao longo do tempo) são a espinha do Painel.
- Ferramentas da EPR que entram (D-13-06): carta de controle, custo previsto × realizado, POP, OEE adaptado a disponibilidade (OK/NOK, horas paradas), gestão à vista (Painel), 5S, curva ABC.
- Rótulos e ids em português; ids HTML em kebab-case; globais `UPPER_CASE`; seções `// ── nome ──`.

</specifics>

<deferred>
## Deferred Ideas

- Onda B (`/gestao`, migração 60) e Onda C (adoção pelos painéis) ficam planejadas mas **só executam depois de nova aprovação** — o usuário pediu "começa a fase A".
- Ferramentas da EPR fora do escopo (D-13-06): preço de venda, cronoanálise, amostras mínimas, VSM, arranjo físico, Bizagi, e-books de conteúdo.
- Aplicar a migração 60 no Supabase: caso a caso, sempre depois do deploy do frontend (memória `ordem-deploy-antes-do-sql`).

</deferred>

---

*Phase: 13-gest-o-e-qualidade*
*Context gathered: 2026-09-04 via PRD Express Path*
