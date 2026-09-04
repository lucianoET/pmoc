---
phase: 13
slug: gest-o-e-qualidade
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-04
---

# Phase 13 — Contrato de Design de UI

> Contrato visual e de interação para a Fase 13 (Gestão e Qualidade). Gerado por gsd-ui-researcher em modo `--auto` (sem interação com o usuário) — cada decisão em aberto foi resolvida a partir de `13-CONTEXT.md`, `13-PRD.md` e do design system já existente no repositório, com justificativa registrada. Verificado por gsd-ui-checker.

**Este projeto não usa shadcn nem qualquer biblioteca de componentes.** É zero-build, HTML + JS vanilla, com um design system próprio já maduro em `shared/pmoc.css` + `shared/componentes.js` + `shared/icones.js`. Este UI-SPEC é um contrato **sobre** esse sistema — declara como os componentes novos da Fase 13 (gráficos, indicadores, Gantt, kanban, calendário, GUT, curva ABC) e o módulo `/gestao` reaproveitam os tokens e padrões existentes, nunca uma paleta nova.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — projeto zero-build, sem shadcn, sem `components.json` (confirmado: `ls components.json` vazio). D-13-01 do PRD já trava "sem biblioteca de gráficos" |
| Preset | não aplicável |
| Component library | none — componentes próprios em `shared/componentes.js` (funções puras que devolvem HTML), seguidos nesta fase por `shared/grafico.js`, `shared/indicadores.js`, `shared/gantt.js`, `shared/kanban.js`, `shared/calendario.js`, `shared/gut.js`, `shared/abc.js` |
| Icon library | `shared/icones.js` — 17 SVG inline em `currentColor`, família Material Symbols Outlined, stroke 2, viewBox 24×24. Ícones novos necessários por esta fase entram na mesma constante `TRACOS`, nunca como emoji (regra travada, `tests/chrome-icones.test.js`) |
| Font | `var(--ff)` = `'Inter',system-ui,sans-serif` — token único, `shared/pmoc.css:12` |

---

## Spacing Scale

O projeto não segue uma escala de 8pt pura — usa uma grade fina de 4px com valores intermediários já consolidados em `shared/pmoc.css` (`gap:10px` em `.kpi-row`, `padding:11px 13px` em `.kpi`, `padding:16px` em `.panel-card`). O contrato desta fase **reaproveita exatamente esses valores**, sem inventar uma escala nova:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Espaço entre pílula/badge e texto vizinho; gap de ícone+rótulo |
| sm | 8px | `padding` interno de célula de Gantt/kanban; gap entre barra e rótulo do gráfico |
| md | 10–13px | Gap de `.kpi-row` (10px) e padding de `.kpi`/`.panel-card` (13/16px) — cartão de indicador e célula de calendário herdam esses dois valores, não um terceiro |
| lg | 16–20px | `padding` de `.main`/`.modal-body` — cabeçalho de aba (`Painel`, `Ações`, …) e corpo do painel de Ferramentas |
| xl | 24px | `margin-bottom` de `.kpi-row`/`.view-title`; espaço entre o bloco de gráfico e o próximo cartão |
| 2xl | 32px | `margin-top` do rodapé do shell — não usado dentro dos componentes desta fase |

Exceções: a grade de calendário usa `gap:1px` (linha divisória entre dias, não espaçamento de leitura — precedente já existente em `.calendar-grid`); as barras de Gantt usam posicionamento em **porcentagem** (não em px fixo), porque a linha do tempo é proporcional ao período, não a uma grade de espaçamento — ver seção Gantt.

---

## Typography

Os quatro papéis abaixo já existem no repositório (`.kpi-n`, `.tbl th`/`.badge`, `.view-title`, `.tbl td`/`.callout`) — a Fase 13 reaproveita cada um pelo papel que já exerce, sem criar um quinto tamanho:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 13px | 400 | 1.5 |
| Label / rótulo pequeno | 11px | 600 | 1.3 (uppercase, `letter-spacing:.06em` — mesmo de `.tbl th`) |
| Heading (título de aba/painel) | 18px (`view-title`) / 14px (`panel-card h3`) | 700 / 600 | 1.2 |
| Display (número de indicador) | 1.45rem (~21.75px, `.kpi-n`) | 700 | 1 |

Aplicação por componente novo:
- **Indicador (`cartaoIndicador`)**: valor no papel Display, rótulo no papel Label (10px como `.kpi-l`, herdando o token — não é um quinto tamanho, é o mesmo `.kpi-l` já existente), meta/tendência no papel Body reduzido a 11px (mesmo de `.help`).
- **Gráfico SVG**: texto de eixo/rótulo em `currentColor`, 10px (mesmo de `.calendar-date`), nunca abaixo disso — abaixo de 10px o traço fino do SVG passa a colidir com o texto.
- **Gantt**: rótulo do item em papel Label (11px), data no cabeçalho da linha do tempo em `mono`/`.num` (mesma fonte tabular de `.tbl td.num`).
- **Kanban/Calendário**: reaproveitam byte a byte `.kanban-title`/`.kanban-count`/`.calendar-*` já existentes (extração, não redesenho — D-06/D-07 do CONTEXT).

---

## Color

O projeto já tem o split funcional — este contrato só nomeia os tokens existentes pelo papel que a Fase 13 usa:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--bg)` / `var(--surface)` | Fundo da página e superfície dos cartões (painel, kanban-col, calendar-day) |
| Secondary (30%) | `var(--surface2)` / `var(--border)` | Cabeçalho de tabela, coluna de kanban vazia, fundo de badge/pílula, trilha de barra de gráfico |
| Accent (10%) | `var(--accent)` / `var(--accent-texto)` | Reservado para: linha "hoje" no Gantt e no calendário; ponto atual do sparkline; estado ativo de aba/seg-toggle/chip; borda de foco; classe A da curva ABC (ver abaixo); barra de progresso do PDCA |
| Destructive | `var(--red)` | Ação "Cancelar ação" (5W2H) e "Excluir POP" — nunca a mesma cor de estado "erro/crítico" de indicador, que usa `--red` com outro papel (ver tons semânticos) |

Accent reserved for: marca de "hoje" (Gantt/calendário), ponto/estado atual em sparkline, aba/seg-toggle/chip ativos, anel de foco, classe A da curva ABC — **nunca** para estado "ok" de indicador (isso é `--green`) nem para botão primário genérico fora desses casos (`.btn-p` já usa `--accent` de fundo, mantido).

### Tons semânticos (gráficos, indicadores, GUT, ABC)

Reaproveita o vocabulário fechado de `shared/componentes.js` (`neutro/info/ok/warn/erro`) resolvido em `.pilula-*`/`.b-*`/`.co-*` — nenhuma cor nova escrita em JavaScript, mesma regra de `shared/icones.js`/`shared/componentes.js`/`shared/fluxo.js`:

| Tom | Cor | Uso em GEQ |
|---|---|---|
| `ok` | `--green` | Indicador dentro da meta; carta de controle sem ponto fora de limite; GUT "ok" (herdado de `classificarGut`) |
| `warn` | `--yellow` | Indicador em atenção (perto do limite); GUT "atenção"; OEE com disponibilidade abaixo do alvo mas não crítica |
| `erro` | `--red` | Indicador fora da meta; ponto fora de LSC/LIC na carta de controle; GUT "crítico" |
| `info` | `--blue` | Indicador sem meta definida (não é bom nem ruim — é dado sem referência); linha "os" do calendário (precedente `.calendar-event.os`) |
| `neutro` | `--text3`/`--border` | Indicador "sem dado"; item de Gantt sem data fim (D-13-04, usa hoje como fim mas visualmente neutro até confirmação) |

**Curva ABC** (`shared/abc.js`) é uma classificação de **valor**, não um alerta — usar `erro`/`warn`/`ok` incorretamente diria "classe C é um problema", o que é falso (só é baixo valor cumulativo). Mapeamento próprio, deliberadamente fora da escala de 5 tons:
- Classe **A** → `--accent` (mais atenção de gestão, maior valor acumulado — reaproveita o papel que `--accent` já tem de "isto pede foco")
- Classe **B** → `--blue` (tom `info`, intermediário)
- Classe **C** → `--text3` (tom `neutro`, baixa prioridade)

Justificativa registrada porque não havia decisão prévia no CONTEXT sobre a cor da curva ABC — resolvida aqui por analogia com o uso existente de `--accent` como "chama atenção sem ser alarme".

---

## Copywriting Contract

Todo texto em português, com acentuação — ids HTML em kebab-case, globais `UPPER_CASE` (convenção do projeto).

### Componentes compartilhados (Onda A)

| Element | Copy |
|---------|------|
| Indicador sem dado (estado `neutro`, sem valor em `ges_indicador_valores`) | "Sem dado no período" |
| Indicador sem meta definida (estado `info`) | "Sem meta definida" (aparece no lugar do semáforo, não como erro) |
| Gantt vazio (nenhum item no período) | Reaproveita `vazio()` de `shared/componentes.js`: mensagem "Nenhuma ação no período" + dica "Ajuste o intervalo ou cadastre uma ação" |
| Gantt, item sem data fim | Rótulo auxiliar junto da barra: "em aberto" (a barra vai até a marca de hoje, D-13-04) |
| Kanban, coluna vazia | Reaproveita o `<div class="empty">` já usado em `renderOperacoes()`: "Nenhuma operação" → generalizado para "Nenhum item" quando o kanban for genérico (parâmetro do chamador define o rótulo por coluna) |
| Calendário, mês sem evento | Sem célula especial — a grade desenha normalmente vazia (precedente: `.calendar-day` sem `.calendar-event` já é o estado "sem evento" hoje, não precisa de mensagem extra) |
| GUT, item sem avaliação | "Não avaliado" (mesmo padrão de `null` = "não avaliado" já usado nos atributos técnicos de `/refrigeracao`, D-500-02) |
| Curva ABC, lista vazia | "Nenhum item para classificar" + dica "Cadastre itens com valor para gerar a curva" |

### Módulo `/gestao` (Onda B — contrato para quando for planejada)

| Element | Copy |
|---------|------|
| Título do módulo (logo) | "PMOC Gestão" (mesmo padrão `PMOC <span class="logo-accent">{nome}</span>` de `montarShell`) |
| Abas (`navItems`) | "Painel" · "Ações" · "Calendário" · "Ferramentas" · "POP" |
| Primary CTA — nova ação 5W2H | "+ Nova ação" (padrão do projeto: `+ Material`, `+ Nova operação`) |
| Primary CTA — novo POP | "+ Novo POP" |
| Empty state — Painel sem indicador configurado | "Nenhum indicador cadastrado" + dica "Indicadores aparecem aqui depois da migração 60 e do primeiro valor lançado" |
| Empty state — Ações sem 5W2H cadastrado | "Nenhuma ação registrada" + dica "Clique em **+ Nova ação** para abrir o primeiro 5W2H" |
| Empty state — Calendário sem evento no mês | (mesmo do calendário compartilhado — grade vazia, sem mensagem extra) |
| Empty state — POP sem procedimento cadastrado | "Nenhum POP cadastrado" + dica "Vincule um POP a um ativo ou a um plano de manutenção" |
| Error state — falha ao carregar indicadores/ações (rede/RLS) | Segue o idioma do projeto: `alert('Erro: '+error.message)` na ação que falhou; a tela não trava — mostra o que já carregou e re-tenta na próxima ação do usuário |
| Read-only — cargo observador/Livre | Reaproveita o rótulo já usado em Máquinas/Refrigeração: chip "Livre · observador" no `user-chip`; botões de escrita (`+ Nova ação`, mudar coluna do kanban, editar POP) somem por `podeEditarGestao()` — UX apenas, a policy real de `ges_*` é a autoridade (D-13-05) |
| Sem migração aplicada (`GES_OK` falso — mesmo padrão de `EST_OK`/`ATRIB_OK`) | O módulo `/gestao` **não existe** até a Onda B ser aprovada e a migração 60 aplicada; não é um estado de tela, é a Onda inteira atrás de uma sonda, mesmo padrão de `UNI_OK`/`EST_OK`/`ATRIB_OK` em `/refrigeracao` |
| Destructive confirmation — cancelar ação 5W2H | "Cancelar ação: esta ação sai do fluxo ativo e não pode ser reaberta. Confirma?" (mesma gramática de confirmação nominal já usada no projeto, nunca `confirm()` genérico do navegador) |
| Destructive confirmation — excluir POP | Projeto **arquiva, nunca exclui** (regra herdada em toda a base — `ativo=false`, nunca `DROP`/`DELETE`); portanto não existe "excluir POP", existe "Arquivar POP: o procedimento sai da lista ativa e fica disponível no histórico. Confirma?" |

---

## Componentes compartilhados — contrato detalhado (Onda A)

### `shared/grafico.js` — gráficos SVG

- **Barras**: cada barra é um `<rect fill="currentColor">` dentro de um `<g class="grafico-tom-{tom}">` que resolve a cor pela folha (mesma regra de `.pilula-*`) — nunca `fill="#..."` inline. Eixo/rótulo em `<text>` 10px, `fill="currentColor"` herdando `--text3`.
- **Linha**: `<path>` com `stroke="currentColor"`, `stroke-width="2"`, sem preenchimento — mesmo traço de `shared/icones.js` (consistência visual entre ícone e gráfico).
- **Pareto**: barras (frequência) + linha acumulada sobrepostas no mesmo SVG; a linha usa o tom `accent` (é o dado de leitura secundária, não um alerta).
- **Carta de controle**: linha de média em traço contínuo tom `neutro`; LSC/LIC em traço tracejado (`stroke-dasharray`) tom `neutro`; pontos dentro dos limites tom `ok`, pontos fora tom `erro` — o ponto fora de limite é o único elemento que "chama a atenção" no gráfico, então é o único em `--red`.
- **Sparkline**: `<polyline>` fina (`stroke-width="1.5"`), último ponto marcado com `<circle>` preenchido no tom do indicador (ok/warn/erro) — é o resumo visual que o cartão de indicador usa, não precisa de eixo.
- Todo SVG leva `role="img"` + `aria-label` textual (o dado por trás do desenho não pode existir só visualmente) — mesmo cuidado de acessibilidade de `shared/icones.js` (`aria-hidden` lá porque o ícone é decorativo; aqui é o oposto, o SVG **é** o dado).
- Tamanho: gráfico dentro de `.panel-card` ocupa 100% da largura do cartão, altura fixa 140px (kanban-col tem `min-height:180px` como referência de escala — o gráfico fica menor que uma coluna de kanban para não dominar o painel).

### `shared/indicadores.js` — cartão de indicador

- Reaproveita a classe `.kpi` como casca (borda esquerda de 3px colorida pelo tom — mesmo mecanismo de `.kc-ok`/`.kc-warn`/`.kc-red`/`.kc-blue`), com três adições dentro do cartão: meta (texto pequeno, "Meta: {valor} {unidade}"), seta de tendência (▲/▼/— resolvida por `tendencia(serie)`, nunca cor sozinha — mesma razão do daltonismo já registrada para o estado ativo do chrome em 19/08/2026) e sparkline (SVG de `shared/grafico.js`).
- Estados: **acima da meta** (tom depende de `sentido:'maior'|'menor'` — "maior é melhor" e acima da meta é `ok`; "menor é melhor" — ex. MTTR — e acima da meta é `erro`), **dentro** (`ok`), **abaixo** (espelha o mesmo raciocínio de sentido), **sem meta** (`info`), **sem dado** (`neutro`, sparkline vazio mostra `vazio()` reduzido, sem gráfico).
- Grade do Painel: `.kpi-row` existente (rolagem horizontal, `grid-auto-columns:minmax(132px,1fr)`) não serve para o cartão de indicador expandido (ele carrega sparkline, mais alto que o KPI simples) — o Painel usa `.panel-card` em grade 2 colunas (`.section-split`-like) no desktop, 1 coluna no celular, não a fila `.kpi-row`. Registrado aqui porque o CONTEXT não especificou o layout do Painel; resolvido por analogia ao `.section-split` já existente (`grid-template-columns:1.2fr .8fr`, colapsa em `@media(max-width:900px)`).

### `shared/gantt.js`

- CSS Grid, sem canvas (D-13-04). Uma linha por item, colunas em porcentagem do intervalo total (`linhasGantt` devolve `{ inicioPct, larguraPct }` por item).
- Barra: `background:var(--surface2)` com borda esquerda de 3px no tom do status da ação (reaproveita `shared/fluxo.js#tomDaEtapa`, nunca uma cor nova — Gantt e kanban leem o mesmo fluxo).
- Marca de "hoje": linha vertical `1px solid var(--accent)` atravessando todas as linhas, com rótulo "Hoje" pequeno no topo — é o único elemento accent do gráfico inteiro (papel reservado, ver Color acima).
- Item sem data fim: barra vai até a marca de hoje, com padrão hachurado leve (`repeating-linear-gradient`) na porção depois de hoje seria especulativo sem mais alcance — a barra simplesmente termina em "hoje" e o rótulo "em aberto" acompanha (ver Copywriting).
- Responsivo: em `<1024px` a área de barras rola horizontalmente dentro de `.tbl-wrap`-like container (mesmo padrão "tabela larga rola dentro do próprio contêiner", D-02 da Fase 7) — a coluna de rótulos (nome da ação) fica fixa à esquerda (`position:sticky;left:0`), mesmo mecanismo do cabeçalho sticky corrigido em D-8yc-01/quick-260829-8yc (evitar `overflow:hidden` no contêiner pai, que mataria o sticky de novo).

### `shared/kanban.js`

- Reaproveita `.kanban`/`.kanban-col`/`.kanban-title`/`.kanban-count` byte a byte (extração, D-06) — nenhuma classe nova.
- Genérico por definição de colunas `[{id, rotulo}]`, passada pelo chamador (Máquinas passa `STATUS_KANBAN`; `/gestao` passa os estados de `shared/fluxo.js` para ações 5W2H).
- Cartão: mesma estrutura de `renderCartaoOperacao` generalizada — título, metadados em `.op-meta`, ações condicionadas a permissão. Coluna vazia usa `.empty` já existente.
- Responsivo `<768px`: `.kanban` já tem `overflow-x:auto` — em 375px vira 1 coluna visível por vez com rolagem horizontal, **e** ganha um seletor de coluna (`seletor()` de `shared/componentes.js`, mesmo `seg-toggle` já usado em outras telas) acima do kanban para pular direto a uma coluna sem rolar às cegas — decisão nova desta fase (D-13, discretion do agente): o kanban de 4 colunas de Máquinas nunca precisou disso porque é olhado majoritariamente no desktop da oficina; `/gestao` é olhado também em campo.

### `shared/calendario.js`

- Reaproveita `.calendar-*` byte a byte (D-07). `gradeMes(ano,mes)` e `agruparPorData(eventos)` generalizam o que `renderAgenda()` fazia inline; `htmlCalendario()` monta o HTML puro (hoje a função de desenho está dentro de `renderAgenda`, misturada com DOM — vira núcleo puro que devolve string, e `renderAgenda`/o `/gestao` chamam e injetam).
- Dia de hoje: `.calendar-day` ganha classe `.hoje` (borda `1px solid var(--accent)` — reserva de accent já declarada) — não existe hoje em `maquinas/index.html`, é uma adição necessária para o calendário consolidado do GEQ-09 (o usuário vai abrir a tela e perguntar "onde estou" olhando o mês inteiro de todos os módulos).
- Evento por origem: reaproveita `.calendar-event.op`/`.calendar-event.os` (tons já fixados) e ganha uma classe por módulo de origem quando o calendário for consolidado (Onda B) — cor do evento não muda, só um rótulo de prefixo textual ("Máquinas · ...", "Refrigeração · ...") porque cor por módulo estouraria a paleta de 5 tons semânticos disponível; o texto já resolve "de onde veio" sem inventar uma sexta cor.
- Mês sem evento: grade normal, sem mensagem — consistente com o comportamento já existente.
- Responsivo `<480px`: `.calendar-grid` já tem `overflow:auto` com `min-width:86px` por dia — mantém rolagem horizontal da grade inteira dentro do cartão (não da página), mesmo padrão D-02 da Fase 7.

### `shared/gut.js`

- `GUT_ESCALA`/`classificarGut` sobem sem mudar assinatura (D-09) — `predial/dominio.js` vira reexport de uma linha, `tests/predial-dominio.test.js` continua passando sem alteração.
- Visual: reaproveita exatamente o que `predial/app.js` já desenha (select 0/1/3/6/8/10, badge com o total, cor por faixa via `.badge`/`CONDICAO[...]`.badge) — nenhuma tela nova de GUT nesta onda, só a extração da lógica.

### `shared/abc.js`

- `classificarAbc(itens, campoValor, cortes=[0.8,0.95])` é puro, sem HTML — a peça visual (barra + pílula de classe) vive em `shared/grafico.js`/`shared/componentes.js`, reaproveitando `pilula(rotulo, tom)` com o mapeamento de cor descrito em Color acima.

---

## UI Considerations

Probe de estados (`ui-consideration-probe.cjs`, taxonomia fechada de 8 categorias) rodado em modo `--auto` sobre 12 superfícies — os sete núcleos da Onda A (E1–E7) e as cinco abas do `/gestao` (E8–E12) — com o tipo de cada elemento confirmado à mão (união do detectado + o que a heurística perdeu). Os núcleos da Onda A são bibliotecas puras: os estados são saídas de função, cobertos por teste em Node, não por tela.

Applicable state considerations resolved: 66 covered, 25 backstop, 0 unresolved (de 91 aplicáveis; 0 dismissed)

Regra de leitura para o planner: `covered` → verdade em `must_haves.truths`; `backstop` → `{ statement, verification: backstop }` (conferência na tela ou teste de caso-limite, nunca passe silencioso). Linhas iguais para vários elementos foram agrupadas — a coluna Element(s) diz a quem cada linha vale.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | grafico.js | ✅ covered | Série vazia ou só nulos → SVG com <text> "Sem dado" e aria-label "Sem dado"; nunca lança (gate: tests/grafico-compartilhado.test.js) |
| empty | indicadores.js | ✅ covered | Sem valor → tom neutro, texto "Sem dado no período", sem sparkline (Copywriting) |
| empty | gantt.js | ✅ covered | Nenhum item no período → vazio("Nenhuma ação no período", "Ajuste o intervalo ou cadastre uma ação") |
| empty | kanban.js | ✅ covered | Coluna sem cartão → <div class="empty">{rótulo por coluna}</div> (padrão de renderOperacoes) |
| empty | calendario.js | ✅ covered | Mês sem evento → grade normal sem mensagem (comportamento existente preservado) |
| empty | gut.js | ✅ covered | G/U/T nulos → total vazio e faixa "Não avaliado" (null ≠ 0, mesmo padrão D-500-02) |
| empty | abc.js | ✅ covered | Lista vazia → vazio("Nenhum item para classificar", "Cadastre itens com valor para gerar a curva") |
| empty | /gestao Painel | ✅ covered | "Nenhum indicador cadastrado" + dica sobre a migração 60 (Copywriting) |
| empty | /gestao Ações | ✅ covered | "Nenhuma ação registrada" + dica "Clique em + Nova ação" (Copywriting) |
| empty | /gestao Calendário | ✅ covered | Mês sem evento → grade vazia sem mensagem (E5) |
| empty | /gestao Ferramentas | ✅ covered | Cada ferramenta sem dado desenha o vazio() do próprio componente (E1/E7); checklist 5S sem template → "Nenhum checklist cadastrado" |
| empty | /gestao POP | ✅ covered | "Nenhum POP cadastrado" + dica "Vincule um POP a um ativo ou a um plano" (Copywriting) |
| loading | grafico.js | ✅ covered | Núcleo puro não tem carregamento; quem espera dados desenha vazio() até o Promise.all resolver (E8) |
| loading | indicadores.js | ✅ covered | Painel desenha vazio() até carregarTudo() resolver — sem spinner, padrão da plataforma |
| loading | gantt.js | ✅ covered | Idem E2 — quem chama desenha vazio() até os dados chegarem |
| loading | kanban.js, calendario.js, abc.js | ✅ covered | Idem E2 |
| loading | gut.js | ✅ covered | Selects desenhados com o item; sem estado de carregamento próprio |
| loading | /gestao Painel | 🧪 backstop | Tela em branco até Promise.all resolver, sem spinner — padrão da plataforma; conferir que não pisca vazio() antes dos dados |
| loading | /gestao Ações, /gestao Calendário, /gestao Ferramentas, /gestao POP | 🧪 backstop | Idem E8 |
| error | grafico.js | ✅ covered | Valor não numérico é descartado do desenho e contado no aria-label ("2 pontos ignorados"); função nunca lança |
| error | indicadores.js | ✅ covered | Falha ao ler ges_indicador_valores → alert("Erro: "+error.message); cartões já desenhados permanecem |
| error | gantt.js | ✅ covered | linhasGantt() com item sem data de início → item omitido e contado no retorno ({ignorados:N}); nunca lança |
| error | kanban.js | ✅ covered | Item com status fora da lista de colunas cai na primeira coluna (regra já existente em agruparOperacoes) |
| error | calendario.js | ✅ covered | Evento com data inválida (não YYYY-MM-DD) é ignorado por agruparPorData(); nunca lança |
| error | gut.js | ✅ covered | Valor fora de GUT_ESCALA é recusado por classificarGut()/gutTotal() (devolve null), nunca lança |
| error | abc.js | ✅ covered | Item com valor não numérico entra como 0 e vai para C; nunca lança |
| error | /gestao Painel | ✅ covered | alert("Erro: "+error.message) na ação que falhou; o que já carregou fica |
| error | /gestao Ações | ✅ covered | Falha ao gravar ges_acoes → alert com error.message; o modal permanece aberto com o que foi digitado |
| error | /gestao Calendário | ✅ covered | Falha em uma das fontes (ex.: logs_manutencao) → alert e o calendário desenha as demais fontes que carregaram |
| error | /gestao Ferramentas | ✅ covered | Idem E8 — alert na ação que falhou |
| error | /gestao POP | ✅ covered | Falha ao gravar ges_pop → alert; modal permanece com o texto digitado |
| populated | grafico.js | ✅ covered | N pontos → N <rect>/<circle> no mesmo <g class="grafico-tom-{tom}">, eixo em currentColor; aria-label resume máximo/mínimo/último |
| populated | indicadores.js | ✅ covered | Valor, meta ("Meta: {valor} {unidade}"), seta ▲/▼/— e sparkline; tom por avaliar(valor, def) |
| populated | gantt.js | ✅ covered | Uma linha por item, barra com inicioPct/larguraPct, marca "Hoje" em var(--accent) atravessando as linhas |
| populated | kanban.js | ✅ covered | Colunas por definição [{id, rotulo}], contagem em .kanban-count, cartão com título e .op-meta |
| populated | calendario.js | ✅ covered | gradeMes(ano,mes) → 7 colunas, células vazias antes do dia 1, dia de hoje com .hoje; eventos com prefixo de origem |
| populated | abc.js | ✅ covered | Itens ordenados por valor desc, acumulado %, classe A/B/C por cortes [0.8, 0.95], pílula por tom |
| populated | /gestao Painel | 🧪 backstop | Grade 2 colunas de .panel-card no desktop, 1 no celular — conferir na tela |
| populated | /gestao Ações | 🧪 backstop | Lista com shared/tabela.js, kanban e Gantt da mesma lista — conferir os três recortes com dados reais |
| populated | /gestao Calendário | 🧪 backstop | Eventos de todos os módulos com prefixo de origem — conferir legibilidade do mês cheio |
| populated | /gestao Ferramentas | 🧪 backstop | Pareto, Ishikawa 6M, PDCA, carta de controle, ABC e 5S — conferir cada ferramenta com dado real |
| populated | /gestao POP | 🧪 backstop | Lista de POPs com título, vínculo e data — conferir na tela |
| partial | indicadores.js | ✅ covered | Sem meta → tom info e texto "Sem meta definida" no lugar do semáforo; 1 ponto → sem seta de tendência |
| partial | gantt.js | ✅ covered | Item sem fim → barra até hoje com rótulo "em aberto" (D-13-04) |
| partial | kanban.js | ✅ covered | Cartão sem metadado opcional (máquina/área) omite a linha, não mostra "undefined" |
| partial | calendario.js | ✅ covered | Evento sem título → rótulo cai para o nome da origem ("OS", "Operação") |
| partial | gut.js | ✅ covered | Uma dimensão preenchida e outras nulas → total não calculado, faixa "Não avaliado" |
| partial | abc.js | 🧪 backstop | 1 item → tudo A (100% ≥ 95%) — comportamento matemático correto; caso-limite coberto em tests/abc-compartilhado.test.js |
| partial | /gestao Painel | ✅ covered | Indicador cadastrado sem valor lançado → cartão em estado "sem dado" (E2) |
| partial | /gestao Ações | ✅ covered | 5W2H com campos opcionais vazios (quanto, como) grava null e a ficha omite a linha; G/U/T nulos → "Não avaliado" |
| partial | /gestao Calendário | ✅ covered | Fonte sem migração (tabela inexistente) é omitida sem erro na tela (mesmo padrão das sondas *_OK) |
| partial | /gestao Ferramentas | ✅ covered | Ishikawa com categoria 6M sem causa desenha a espinha vazia; carta de controle com <2 pontos não desenha LSC/LIC |
| partial | /gestao POP | ✅ covered | POP sem ativo nem plano vinculado é permitido (os dois nullable) e a lista mostra "—" no vínculo |
| overflow | grafico.js | ✅ covered | SVG com viewBox e width=100%: o gráfico escala ao cartão, nunca estoura; rótulos de eixo limitados a 6 por gráfico |
| overflow | indicadores.js | ✅ covered | Mais cartões que 2 colunas → grade cresce em linhas; nada é escondido |
| overflow | gantt.js | 🧪 backstop | Área de barras rola dentro do contêiner (.tbl-wrap-like) com coluna de rótulos sticky — conferir que o contêiner pai não tem overflow:hidden (lição D-8yc-01) |
| overflow | kanban.js | 🧪 backstop | 375px: uma coluna visível + seg-toggle para pular de coluna — conferir rolagem só dentro de .kanban, não da página (tests/mobile-375) |
| overflow | calendario.js | 🧪 backstop | Grade rola dentro do cartão (.calendar-grid overflow:auto, min-width 86px/dia) — conferir em 375px |
| overflow | abc.js | ✅ covered | Tabela em .tbl-wrap rola horizontalmente; barra de acumulado em % nunca excede 100 |
| overflow | /gestao Painel | ✅ covered | Grade cresce por linhas; abas do shell rolam horizontalmente em 375px (comportamento do shell existente) |
| overflow | /gestao Ações | ✅ covered | Tabela em .tbl-wrap; kanban e Gantt rolam dentro do próprio contêiner |
| overflow | /gestao Calendário | 🧪 backstop | Mesmo E5 — grade rola dentro do cartão |
| overflow | /gestao Ferramentas | ✅ covered | SVGs escalam ao cartão (E1); Ishikawa rola horizontalmente dentro do cartão em 375px |
| overflow | /gestao POP | ✅ covered | Texto longo do POP em <textarea> com rolagem própria; lista em .tbl-wrap |
| zero-one-many | indicadores.js | ✅ covered | 0 pontos → sem dado; 1 ponto → sparkline degenera em ponto; N → sparkline completo (tendencia() exige ≥2) |
| zero-one-many | gantt.js | ✅ covered | 0 → vazio(); 1 → uma linha; N → N linhas na mesma grade; sem cópia singular/plural (o rótulo é o nome da ação) |
| zero-one-many | kanban.js | ✅ covered | Contagem por coluna sempre visível (0 incluído); 1 cartão não muda o layout |
| zero-one-many | calendario.js | ✅ covered | 0/1/N eventos por dia empilham em .calendar-event; sem limite artificial |
| zero-one-many | abc.js | ✅ covered | 0 → vazio(); 1 → uma linha classe A; N → curva completa |
| zero-one-many | /gestao Painel | ✅ covered | 0 → vazio(); 1 → um cartão ocupando uma coluna; N → grade |
| zero-one-many | /gestao Ações | ✅ covered | 0 → vazio(); 1 → uma linha/cartão/barra; N → lista completa |
| zero-one-many | /gestao Calendário | ✅ covered | Idem E5 |
| zero-one-many | /gestao Ferramentas | ✅ covered | Idem E1/E7 |
| zero-one-many | /gestao POP | ✅ covered | 0 → vazio(); 1/N → lista |
| long-text | grafico.js | 🧪 backstop | Rótulo de categoria longo no eixo X (Pareto) — conferir quebra/abreviação na tela em 375px |
| long-text | indicadores.js | 🧪 backstop | Rótulo de indicador longo no cartão — conferir quebra em 375px |
| long-text | gantt.js | 🧪 backstop | Nome de ação longo na coluna sticky — quebra natural, sem ellipsis; conferir na tela |
| long-text | kanban.js | 🧪 backstop | Título de cartão longo — quebra natural (.op-name), sem truncar; conferir na tela |
| long-text | calendario.js | 🧪 backstop | "Máquinas · Troca de óleo" pode estourar 86px — herda quebra de .calendar-event, sem nowrap; conferir na tela |
| long-text | gut.js | ✅ covered | Rótulos fixos (G/U/T e faixas de uma palavra) — não há texto livre |
| long-text | abc.js | 🧪 backstop | Nome de material longo na tabela — conferir truncagem com title (regra D-8yc-10) |
| long-text | /gestao Painel | 🧪 backstop | Nome de indicador longo no cartão — conferir em 375px |
| long-text | /gestao Ações | 🧪 backstop | "O quê" longo no cartão do kanban — quebra natural; conferir na tela |
| long-text | /gestao Calendário | 🧪 backstop | Idem E5 |
| long-text | /gestao Ferramentas | 🧪 backstop | Texto de causa longo na espinha do Ishikawa — conferir quebra |
| long-text | /gestao POP | ✅ covered | Título de POP truncado com title na tabela (D-8yc-10); o texto completo abre na ficha |
| read-only | /gestao (todas as abas) | ✅ covered | Botões de escrita somem por `podeEditarGestao()`; RLS de `ges_*` é a autoridade real (D-13-05) — mesma dupla camada UX + banco do resto do projeto |
| no-migration | /gestao inteiro antes da migração 60 | ✅ covered | Sonda `GES_OK` (padrão `EST_OK`/`ATRIB_OK`/`UNI_OK`) — enquanto falsa, nenhuma rota ativa referencia o módulo; a Onda B só entra em produção depois de aprovada e migrada |

---

## Responsivo

### 375px (celular)

- **Gráficos**: largura 100% do `.panel-card` pai (que já colapsa para coluna única abaixo de 700px, `@media(max-width:700px)` existente); altura fixa mantida (140px) — não encolhe mais, texto de eixo ficaria ilegível abaixo disso.
- **Kanban**: rolagem horizontal + seletor de coluna (`seg-toggle`) acima, ver seção `shared/kanban.js`.
- **Gantt**: coluna de rótulos fixa (sticky left) + área de barras com rolagem interna — nunca rolagem da página (regra permanente de `tests/mobile-375.test.js`).
- **Calendário**: grade com rolagem horizontal interna ao cartão (`.calendar-grid` já tem isso), dias mantêm 86px mínimos — não comprime para caber, porque comprimir mais tornaria os eventos ilegíveis.
- **Indicador**: cartão em coluna única, sparkline em largura total do cartão.
- **Alvo de toque**: qualquer botão novo (seletor de coluna do kanban, navegação do Gantt/calendário) segue o mínimo de 44px já travado em `shared/pmoc.css` `@media(max-width:480px) .nav-btn{min-height:44px}` — mesma régua para os botões novos desta fase.

### ≥1024px

- **Painel**: grade 2 colunas de `.panel-card` (indicadores lado a lado).
- **Gantt/Kanban/Calendário**: largura plena do `.main` (max-width:1240px), sem rolagem horizontal necessária na maioria dos casos (a rolagem interna existe como salvaguarda, não como padrão esperado).
- **Ações**: lista (`shared/tabela.js`) e kanban/Gantt acessíveis pelo mesmo `seg-toggle` já usado para outras trocas de visualização no projeto (Refrigeração `#seg-pmoc`/`#seg-movim`, Máquinas `#os-seletor`) — precedente direto, três rótulos: "Lista" · "Kanban" · "Gantt".

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|--------------|
| shadcn official | nenhum | não aplicável — projeto não usa shadcn (Tool: none) |
| terceiros | nenhum | não aplicável — nenhuma dependência nova nesta fase (D-13-01: sem biblioteca de gráficos, SVG inline escrito à mão) |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
