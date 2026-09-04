# PRD — Phase 13: Gestão e Qualidade

Aprovado pelo usuário em 04/09/2026 ("aprovado, registra a fase 13 e começa a fase A").
Origem: lista de ferramentas de https://eprconsultoria.com.br/download/ mapeada contra o que já existe no repo.

## Objetivo

Conceitos e ferramentas de gestão da qualidade existem **uma vez** em `shared/`, como núcleos puros
(mesmo corte núcleo-puro/aplicador-de-DOM de `shared/tema.js`, `shared/tabela.js`, `shared/fluxo.js`,
`shared/componentes.js`), e o módulo `/gestao` os consome sobre os dados de todos os módulos.

## Ondas (executar a Onda A primeiro — `--wave 1`; B e C só depois de nova aprovação)

### Onda A — núcleo em `shared/` (GEQ-01..05)

| Arquivo | Conteúdo | Gate |
|---|---|---|
| `shared/grafico.js` | barras, linha, Pareto (barras + acumulado), carta de controle (média, LSC/LIC, pontos fora), sparkline — funções puras que devolvem SVG inline (`currentColor`, classes por tom semântico, nenhuma cor escrita em JS) | `tests/grafico-compartilhado.test.js` |
| `shared/indicadores.js` | definição de indicador `{id, rotulo, unidade, meta, sentido:'maior'|'menor', faixas}`, `avaliar(valor, def)` → tom (ok/warn/erro), `tendencia(serie)`, `cartaoIndicador()` (HTML com `.kpi`, semáforo, sparkline) | `tests/indicadores-compartilhados.test.js` |
| `shared/gantt.js` | `linhasGantt(itens, {inicio, fim})` → posições em % por CSS grid; marca de hoje; item sem fim usa hoje; HTML puro | `tests/gantt-compartilhado.test.js` |
| `shared/abc.js` | curva ABC genérica: `classificarAbc(itens, campoValor, cortes=[0.8,0.95])` → A/B/C + acumulado | `tests/abc-compartilhado.test.js` |
| `shared/kanban.js` | extraído de `maquinas/operacoes.js` (`agruparOperacoes`, `STATUS_KANBAN`) — genérico por definição de colunas; Máquinas passa a consumir | `tests/operacoes-maquinas.test.js` e `tests/integracao-operacoes-maquinas.test.js` **sem uma linha mudada** |
| `shared/calendario.js` | extraído de `maquinas/app.js#renderAgenda` (~L1157) e `operacoes.js#criarEventosCalendario`: `gradeMes(ano, mes)`, `agruparPorData(eventos)`, `htmlCalendario(...)`; Máquinas consome | idem |
| `shared/gut.js` | `GUT_ESCALA`, `classificarGut`, `gutTotal(g,u,t)` vindos de `predial/dominio.js`; Predial **reexporta** | `tests/predial-dominio.test.js` intocado |

CSS: classes novas (`.gantt*`, `.kanban*`, `.calendar*`, `.indicador*`, `.grafico*`) entram em `shared/pmoc.css`,
usando só tokens existentes — precedente: `.pilula`/`.regua` entraram lá quando `componentes.js` nasceu.
O CSS de calendário/kanban hoje em `maquinas/index.html` migra para `pmoc.css`.

### Onda B — módulo `/gestao` (GEQ-06..10)

- `supabase/60_gestao_schema.sql` (aditiva, sem DROP; **60, não 47**: em 04/09/2026 `origin/main` já tinha migrações até `59_calibracao_deriva.sql` — conferir `git ls-tree origin/main supabase/` antes de criar o arquivo): `ges_acoes` (5W2H: o quê, por quê, onde, quando, quem, como, quanto; g/u/t; `gut_total` gerado; `status` em lista fechada; `modulo`, `ativo_ref`), `ges_indicadores` (definição), `ges_indicador_valores` (série: indicador_id, periodo date, valor), `ges_pop` (titulo, texto, modulo, ativo_ref, plano_ref), `ges_causas` (Ishikawa: acao_id, categoria 6M, causa). RLS: leitura `public`, escrita `authenticated` (padrão da plataforma).
- `gestao/index.html` + `gestao/app.js`: shell (`aplicarShell`), `Auth`, abas Painel · Ações · Calendário · Ferramentas · POP.
- Painel: OS abertas por módulo, backlog, MTBF/MTTR, custo previsto × realizado, retrabalho (NBR 5674 item 7.5). Lê `maq_os`, `transp_*`, `logs_manutencao` (refrigeração, **só leitura**), `pred_inspecao_itens`, `cal_*` vencendo.
- Ações: lista com `shared/tabela.js`, kanban e Gantt da mesma lista; fluxo via `shared/fluxo.js`.
- Calendário: consolida OS e vencimentos de todos os módulos.
- Ferramentas: Pareto, Ishikawa, PDCA, carta de controle, curva ABC, checklist 5S.
- `vercel.json` rota `/gestao`; card no portal `index.html`.

### Onda C — adoção

`indicadores.js` nos painéis de Máquinas e Transportes; curva ABC na aba Estoque de Máquinas.

## Requisitos (REQUIREMENTS.md, seção GEQ)

GEQ-01 gráficos SVG · GEQ-02 indicadores com meta/semáforo/série · GEQ-03 Gantt · GEQ-04 kanban+calendário em shared (fecha PLAT-08/09) ·
GEQ-05 GUT em shared · GEQ-06 5W2H+GUT+fluxo · GEQ-07 ferramentas de análise · GEQ-08 POP · GEQ-09 calendário consolidado · GEQ-10 rota+card.

## Decisões travadas

- D-13-01 sem biblioteca de gráficos: SVG inline, `currentColor`, tons semânticos (regra de `shared/icones.js`).
- D-13-02 GUT sobe para `shared/`; `predial/dominio.js` reexporta.
- D-13-03 `refrigeracao` é lido, nunca editado (D-04).
- D-13-04 Gantt em CSS grid, sem canvas.
- D-13-05 tabelas `ges_*`, RLS leitura pública / escrita autenticada.
- D-13-06 mapeamento das 22 ferramentas da EPR fechado (ver ROADMAP).

## Restrições do projeto

Zero-build, sem npm, sem dependência nova; português em código, UI, commits e docs; migrações aditivas;
gates em `node --test` (`node:test`/`node:assert`, sem framework); `refrigeracao` congelado;
`mapa/xmap.js` intocável; convenções em `.planning/codebase/CONVENTIONS.md`.
