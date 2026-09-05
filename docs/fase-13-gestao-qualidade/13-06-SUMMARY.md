---
phase: 13-gest-o-e-qualidade
plan: 06
subsystem: frontend
tags: [gestao, 5w2h, gut, kanban, gantt, calendario, pareto, ishikawa, pdca, abc, pop, sonda]

# Dependency graph
requires:
  - phase: 13-gest-o-e-qualidade (planos 13-01, 13-02, 13-03)
    provides: os sete núcleos puros da Onda A — shared/grafico.js, indicadores.js, gantt.js, abc.js, gut.js, kanban.js, calendario.js
  - phase: 13-gest-o-e-qualidade (plano 13-05)
    provides: supabase/60_gestao_schema.sql — as cinco tabelas ges_* que este módulo grava (NÃO aplicada em produção)
provides:
  - gestao/index.html + gestao/app.js — o módulo /gestao com cinco abas, publicável ANTES da migração 60 (sonda GES_OK)
  - tests/gestao-modulo.test.js — gate permanente do módulo (22 casos)
  - rota /gestao em vercel.json e card no portal
  - gestao registrado nas quatro listas de gate que enumeram os módulos
affects: [13-07 (Onda C), aplicação da migração 60 pelo usuário]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sonda própria (GES_OK) no padrão EST_OK/ATRIB_OK/UNI_OK: uma leitura, uma tabela, um try/catch, antes e fora do Promise.all"
    - "Leitura por fonte isolada (lerFonte): relação inexistente ou erro de rede omite AQUELA fonte e a conta em FONTES_OMITIDAS, nunca derruba as outras seis"
    - "Porta de teste (`export const __teste`) num módulo de tela: o gate injeta um cliente falso e lê o HTML que cada aba desenharia, sem navegador; `boot()` só roda quando existe `document`"
    - "Fluxo declarado por definição de etapas (shared/fluxo.js) com `curtosTerminais` como chave própria do consumidor — o núcleo ignora o que não conhece"

key-files:
  created:
    - gestao/index.html
    - gestao/app.js
    - tests/gestao-modulo.test.js
  modified:
    - vercel.json
    - index.html
    - shared/indicadores.js
    - tests/indicadores-compartilhados.test.js
    - tests/shell.test.js
    - tests/mobile-375.test.js
    - tests/chrome-icones.test.js
    - tests/modulos-caminhos.test.js

key-decisions:
  - "shared/icones.js NÃO foi tocado: os cinco papéis das abas já existiam no conjunto (painel, checklist, agenda, chave, relatorio), e acrescentar traço novo por acrescentar seria desenho a mais sem consumidor. O plano previa a edição; ela não foi necessária."
  - "As tarefas 1 e 2 do plano produzem o MESMO arquivo e viraram um commit só — a acceptance criteria da tarefa 1 já exige as cinco views e o HTML da aba Ações; separá-las exigiria publicar um estado intermediário que nunca existiu."
  - "O Painel tem DOIS blocos com donos diferentes: os seis indicadores CALCULADOS sobre os outros módulos (existem sem a migração 60; meta e faixa de atenção vêm de ges_indicadores quando há linha com o mesmo código) e os CADASTRADOS, cujo valor sai da série de ges_indicador_valores. Sem os calculados, o Painel abriria vazio em produção no primeiro dia."
  - "Série só para o que fecha dentro de um mês (MTTR, custo realizado × previsto, retrabalho). OS abertas agora, backlog médio e MTBF são fotografia do momento e o banco não guarda a de meses passados — reconstruir a curva do que existe hoje daria um desenho plausível e errado. Sem série, o cartão não desenha sparkline nem seta, que é o comportamento que cartaoIndicador já prevê."
  - "As ferramentas Pareto, carta de controle e curva ABC leem o dado dos OUTROS módulos, não ges_*: continuam inteiras antes da migração 60. Ishikawa e PDCA dependem de ges_* e caem no aviso; o 5S não ganhou tabela de propósito — checklist de sensos é um POP, e duas tabelas para o mesmo fato divergiriam na primeira revisão."
  - "O 5S aponta para a aba POP em vez de virar tabela nova; a tela diz isso em vez de mostrar uma seção vazia sem explicação."
  - "`gut_total` nunca entra na carga de escrita: é coluna gerada pela migração 60, e gravá-la faria a prioridade mostrada divergir da guardada."

requirements-completed: [GEQ-06, GEQ-07, GEQ-08, GEQ-09, GEQ-10, PLAT-16]

coverage:
  - id: D1
    description: "Sonda GES_OK mantém o módulo publicável antes da migração 60: uma leitura só, antes e fora do Promise.all, e nenhuma consulta a ges_* com ela falsa"
    requirement: "GEQ-06"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#sem a migração 60 a sonda fica falsa, a carga não lança e a aba Ações diz o que houve"
        status: pass
      - kind: unit
        ref: "tests/gestao-modulo.test.js#sem a sonda verde, nenhuma consulta a ges_* é disparada"
        status: pass
      - kind: unit
        ref: "tests/gestao-modulo.test.js#a sonda é chamada ANTES e FORA do Promise.all da carga"
        status: pass
      - kind: manual
        ref: "página real com o banco simulado SEM as tabelas ges_*: Painel, Ações, Ferramentas e POP mostram 'Migração 60 não aplicada'; o Calendário desenha os 7 eventos das outras fontes; zero botão de escrita mesmo para gestor; zero erro de console"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ações: 5W2H com GUT, fluxo de cinco estados, e a mesma lista em lista, kanban e Gantt"
    requirement: "GEQ-06"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#a lista fechada de estados da ação no cliente tem exatamente os cinco nomes do banco"
        status: pass
      - kind: manual
        ref: "página real: lista com ordenação e filtro por coluna, kanban de 5 colunas com rolagem interna (998px em 351px), Gantt com marca de Hoje e 'em aberto'; G/U/T em branco desenham 'Não avaliado'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Calendário consolida as sete fontes, com prefixo de origem, e lê logs_manutencao só por select"
    requirement: "GEQ-09"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#nenhuma tabela de outro módulo aparece seguida de gravação — refrigeração é lida, nunca editada"
        status: pass
      - kind: manual
        ref: "página real: 'Máquinas · …', 'Refrigeração · …', 'Corte · …', 'Transportes · …', 'Predial · …', 'Calibração · …'; dia de hoje com a borda de destaque; a linha de rodapé nomeia as fontes lidas"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ferramentas: Pareto, carta de controle, curva ABC, Ishikawa 6M, PDCA e 5S, cada um com o próprio estado vazio"
    requirement: "GEQ-07"
    verification:
      - kind: manual
        ref: "página real: as seis desenham; Ishikawa com as 6 categorias e 'Sem causa registrada' nas vazias; ABC com pílula de classe; 5S com o vazio próprio apontando a aba POP"
        status: pass
    human_judgment: true
    rationale: "Não há regex que prove 'o Pareto desenhou' — o que o gate prova é que os núcleos são importados e não copiados; o desenho foi conferido na tela, ferramenta por ferramenta."
  - id: D5
    description: "POP com vínculo opcional, título truncado com title e arquivamento (nunca exclusão)"
    requirement: "GEQ-08"
    verification:
      - kind: manual
        ref: "página real: POP sem ativo nem plano mostra travessão; 'Arquivar POP' abre a confirmação nominal do contrato e a carta enviada ao banco é `{ ativo: false }`, nunca delete"
        status: pass
    human_judgment: false
  - id: D6
    description: "Rota, card no portal e o módulo nas quatro listas de gate"
    requirement: "GEQ-10, PLAT-16"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#a rota /gestao existe no vercel.json e resolve para um arquivo que existe no disco"
        status: pass
      - kind: unit
        ref: "tests/gestao-modulo.test.js#o portal ganhou um card para /gestao, sem mexer nos que já existiam"
        status: pass
      - kind: unit
        ref: "node --test tests/shell.test.js tests/mobile-375.test.js tests/chrome-icones.test.js tests/modulos-caminhos.test.js"
        status: pass
    human_judgment: false
  - id: D7
    description: "Escape de tudo que vem do banco, e nenhuma cor escrita em JavaScript"
    requirement: "GEQ-06 (threat model T-13-22)"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#texto vindo do banco sai escapado nas quatro abas que o desenham"
        status: pass
      - kind: unit
        ref: "tests/gestao-modulo.test.js#nenhuma cor literal aparece no JavaScript do módulo — tom vem sempre de classe"
        status: pass
    human_judgment: false

# Metrics
duration: 3h
completed: 2026-09-05
status: complete
---

# Phase 13 Plan 06: módulo `/gestao` Summary

**O `/gestao` existe: cinco abas sobre os sete núcleos da Onda A ao mesmo tempo — Painel com os indicadores do item 7.5 da NBR 5674, Ações 5W2H priorizadas por GUT em lista, kanban e Gantt, Calendário consolidado das sete fontes da plataforma, seis ferramentas da qualidade e POP —, publicável ANTES da migração 60 rodar, porque a sonda `GES_OK` mantém a tela honesta enquanto o banco não tem as tabelas.**

## Performance

- **Duration:** ~3 h
- **Tasks:** 3 (do plano), entregues em 4 commits
- **Files created:** 3 · **Files modified:** 8
- **`node --test`:** 1501 → **1526**, 0 falhas

## Accomplishments

- **`gestao/index.html` + `gestao/app.js`** — módulo novo sobre a base comum: script de pré-desenho de tema byte a byte igual ao das outras superfícies, folha comum, `Auth` e `aplicarShell` compartilhados, miolo dentro do `#app` no próprio HTML (nunca inserido depois do shell) e `#app` aberto com `display:block` — as duas lições que `/equipes` pagou em 02/09 entraram como forma, não como comentário.
- **Sonda `GES_OK`** — `let GES_OK = false` global, `sondarGestao()` com uma leitura só sobre `ges_acoes` dentro de `try/catch`, chamada em `carregarTudo()` antes e fora do `Promise.all`. Com ela falsa: nenhuma consulta a `ges_*` é disparada (conferido contando as tabelas efetivamente consultadas), as quatro abas dependentes desenham `vazio('Migração 60 não aplicada', …)` e nenhum botão de escrita é injetado na marcação.
- **Painel** — gráfico de barras de OS abertas por módulo mais oito cartões de indicador (seis calculados sobre `maq_os`/`logs_manutencao`/`transp_manutencoes`/`cal_ps`, dois cadastrados), com meta, semáforo, tendência e sparkline. Grade de duas colunas ≥900px, uma abaixo — medido: `577px 577px` em 1280px.
- **Ações** — 5W2H completo, GUT pela escala fechada de `shared/gut.js` (branco = "Não avaliado", nunca zero), fluxo de cinco estados declarado por `shared/fluxo.js`, e a mesma lista em três recortes trocados por `seg-toggle`.
- **Calendário** — sete fontes lidas em separado, cada uma com prefixo textual de origem; fonte cuja relação não existe é omitida e **contada** na tela, nunca silenciada.
- **Ferramentas** — Pareto, carta de controle (X-mR), curva ABC, Ishikawa 6M gravando `ges_causas`, PDCA lendo o próprio fluxo das ações, e 5S com o vazio próprio.
- **POP** — lista em `.tbl-wrap`, título truncado com `title`, travessão no vínculo ausente, e "Arquivar POP" com a confirmação nominal do contrato gravando `ativo = false`.
- **Rota, portal e listas de gate** — `/gestao` no `vercel.json` (11ª reescrita), card no portal (10º, entre Equipes e Calibração) e `gestao` registrado nas quatro listas de gate que enumeram módulos.
- **Verificado na página real**, com a página inteira servida e um cliente falso que registra a carga enviada ao banco: as cinco abas nos dois cenários (com e sem migração 60), nos dois temas, em 1280px e em 375px — **transbordo horizontal 0 em todas as abas**, kanban/calendário/tabela rolando dentro do próprio contêiner, **zero erro de console**. As cargas de escrita batem coluna a coluna com a migração 60, e `gut_total` (gerada) não é enviada.

## Task Commits

| # | Tarefa | Commit | Tipo |
|---|--------|--------|------|
| 1 | Módulo: esqueleto, sonda GES_OK, Painel e as outras quatro abas (tarefas 1 e 2 do plano) | `414e716` | feat |
| 2 | Gate do módulo — sonda, fronteira de escrita e escape | `bf2c7de` | test |
| 3 | Quatro defeitos que só a renderização mostrou | `661b590` | fix |
| 4 | Rota, card no portal e o módulo nas quatro listas de gate (tarefa 3) | `469d06a` | feat |

## Ícones escolhidos para as cinco abas

| Aba | Ícone | Por quê |
|-----|-------|---------|
| Painel | `painel` | mosaico de blocos — é literalmente a gestão à vista |
| Ações | `checklist` | itens marcados: o plano de ação é uma lista de coisas a fazer |
| Calendário | `agenda` | a grade de mês, o mesmo ícone que /equipes usa para Escala |
| Ferramentas | `chave` | ferramenta, no sentido de instrumento de análise |
| POP | `relatorio` | folha com dobra e linhas — o documento |

Os cinco já existiam no conjunto; **nenhum traço novo foi acrescentado a `shared/icones.js`**, ao contrário do que o plano previa. Os cinco são distintos entre si, que é o que `tests/chrome-icones.test.js` passou a exigir depois que a aba Plano de `/equipes` nasceu com o mesmo desenho de Ofícios.

## Decisions Made

Além das registradas no frontmatter:

- **Porta de teste (`export const __teste`) no módulo de tela.** O plano exige um gate comportamental que carregue `gestao/app.js` e afirme o estado da sonda e o HTML da aba Ações. Sem uma costura, isso exigiria um navegador. A saída foi separar `html*()` (puro, devolve texto) de `render*()` (injeta no DOM) e expor o mínimo, com `boot()` rodando só quando existe `document` — o mesmo corte núcleo-puro/aplicador-de-DOM que `shared/tema.js` estabeleceu, aplicado dentro de um módulo de aplicação.
- **`lerFonte` por fonte, não um `Promise.all` que falha junto.** As sete fontes do Calendário vivem em módulos diferentes, com migrações diferentes: uma delas ausente não pode apagar o mês inteiro. Cada leitura tem seu `try/catch` e a fonte perdida é nomeada na tela.
- **O PDCA é o mesmo fluxo lido por outro nome**, não uma segunda lista de estados — a tela diz isso, para ninguém tentar "sincronizar" as duas depois.
- **O `<select>` de situação do formulário oferece só a etapa atual, a seguinte, a anterior e os terminais.** A primeira versão oferecia os cinco estados, o que desfazia em silêncio a regra de adjacência que `shared/fluxo.js` existe para impor. O caminho de volta continua existindo — é o que permite corrigir um avanço clicado por engano sem editar o banco.

## Deviations from Plan

Três, todas registradas e nenhuma silenciosa:

1. **`shared/icones.js` não foi editado** (o plano o lista em `files_modified`). Os cinco papéis já tinham traço no conjunto; acrescentar desenho sem necessidade seria ruído.
2. **Quatro gates existentes foram editados** — `tests/shell.test.js`, `tests/mobile-375.test.js`, `tests/chrome-icones.test.js` (duas listas) e `tests/modulos-caminhos.test.js` —, **só para acrescentar `gestao` à lista de módulos**; nenhum caso existente mudou. O plano dizia "nenhum gate existente foi alterado" e a verificação previa `git diff --stat tests/` com um arquivo só. A instrução da execução pediu explicitamente o registro, e a razão está escrita no comentário de duas dessas listas: ausência de um módulo numa lista de gate é a forma mais barata de um defeito passar — foi assim que `/equipes` subiu em quatro colunas.
3. **`shared/indicadores.js` foi alterado** (uma linha de formatação, mais uma função de quatro linhas) e `tests/indicadores-compartilhados.test.js` ganhou um caso. É artefato da Onda A e está fora da lista do plano; entrou porque a renderização mostrou o número do indicador saindo com **ponto** decimal ("0.5", "110.8") num aplicativo inteiro em português. A correção mora na exibição, a comparação com a meta segue numérica, e o `/gestao` é hoje o **único** consumidor do núcleo — raio de alcance zero fora deste plano. Se for considerado escopo excedido, o commit `661b590` isola a mudança.

## Issues Encountered

- **Dois casos do meu próprio gate nasceram cegos** e foram corrigidos antes de entrar: o que afirma a ordem da sonda media o **comentário** que cita "Promise.all" antes da chamada, e o que afirma o uso do `Auth` comum media a nota que cita `signInWithPassword` pelo nome. Os dois passaram a varrer o arquivo sem as linhas de comentário — terceira vez que essa armadilha se paga no projeto.
- **Cinco defeitos foram reintroduzidos de propósito e conferidos reprovando** antes de restaurar: sonda depois do `Promise.all`, escrita em `logs_manutencao`, título de POP sem escape, dois ícones iguais na faixa e a rota removida do `vercel.json`.
- **Quatro defeitos só apareceram no navegador** — estão no corpo do commit `661b590`: o decimal "1.234,56" virando `null` em silêncio na gravação, o ponto decimal do indicador, o desalinhamento do Gantt quando o rótulo quebra (e o 1px de diferença entre `min-height` e altura fixa que sobrava depois do primeiro conserto) e a coluna de ações transbordando a célula com quatro botões de estado.

## User Setup Required

**A migração 60 continua NÃO aplicada, e essa é a ordem certa.** O frontend do `/gestao` vai a produção primeiro (D-cf8-25); a sonda `GES_OK` mantém a tela honesta enquanto o SQL não roda. Depois do deploy:

1. Conferir na página publicada que a sonda já está lá (`from('ges_acoes').select('id').limit(1)` no `gestao/app.js` servido) — sem isso, aplicar o SQL antes deixaria a tela antiga chamando tabela que ela não sabe ler.
2. Colar `supabase/60_gestao_schema.sql` inteiro no SQL Editor do projeto `pmoc`.
3. Rodar as quatro consultas de conferência do rodapé daquele arquivo (colunas, checks, policies, contagem zerada) — a lição da migração 28 é que "sem erro" não é "com a forma certa".
4. Recarregar `/gestao`: as quatro abas dependentes trocam o aviso de migração pelos estados vazios próprios ("Nenhuma ação registrada", "Nenhum POP cadastrado", "Nenhum indicador cadastrado") e os botões de escrita passam a ser injetados para admin, gestor e técnico.

## Next Phase Readiness

- **Onda C (plano 13-07)** pode consumir `shared/indicadores.js` nos painéis de Máquinas e Transportes e `shared/abc.js` no Estoque — os dois núcleos já têm consumidor real e formatação em português conferida na tela.
- **`shared/gantt.js` tem uma limitação conhecida e não resolvida:** as duas faixas (rótulos e barras) são blocos independentes e só alinham enquanto cada rótulo couber numa linha. O `/gestao` contorna com CSS próprio (rótulo em uma linha, altura fixa); a correção estrutural é uma linha de grade por item, que muda a marcação do núcleo e não cabia neste plano.
- **`shared/gantt.js`, segundo detalhe:** o rótulo "em aberto" é desenhado no fluxo da linha, antes da barra (que é posicionada em absoluto), então aparece à esquerda em vez de ao lado da barra. Cosmético, registrado.
- **`TESTES.md` não recebeu roteiro manual desta task** — o plano não o lista entre os artefatos e a instrução de execução não o pediu. Fica como próximo passo natural, no formato das outras seções.

---
*Phase: 13-gest-o-e-qualidade*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: `gestao/index.html`, `gestao/app.js`, `tests/gestao-modulo.test.js`
- FOUND: commits `414e716`, `bf2c7de`, `661b590`, `469d06a`
- `node --test`: **1526 testes, 0 falhas** (baseline 1501)
- `grep -c 'shared/pmoc.css' gestao/index.html` = 1
- as cinco `id="view-*"` presentes; as cinco `id: '<aba>'` presentes
- `grep -c '^let GES_OK = false' gestao/app.js` = 1 · `grep -c "async function sondarGestao"` = 1 · `grep -c "from('ges_acoes').select('id').limit(1)"` = 1
- `sondarGestao()` chamada na linha 243, `Promise.all` de `carregarTudo` na 246
- `grep -cE '😀|🚚|🔧|📊' gestao/index.html gestao/app.js` = 0
- `grep -vE '^\s*(//|\*|/\*)' gestao/app.js | grep -cE '#[0-9a-fA-F]{3,8}|rgba?\(|hsl\('` = 0
- `grep -ci 'confirm(' gestao/app.js` = 0 · `grep -c 'Não avaliado'` = 5 · `grep -c 'Arquivar POP'` = 3
- os nove núcleos importados uma vez cada; `from('logs_manutencao')` só com `.select(`; zero gravação em tabela de outro módulo
- `grep -c '"/gestao"' vercel.json` = 1 e a rota resolve para arquivo existente · `grep -c 'href="/gestao"' index.html` = 1
- `git diff --name-only -- refrigeracao/ mapa/xmap.js` **vazio**
- `git diff --stat tests/` lista **cinco** arquivos, não um — desvio 2 e 3, registrados acima
