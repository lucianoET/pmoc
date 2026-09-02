# Phase 10: Mapa operacional - Research

**Researched:** 2026-08-12
**Domain:** Leaflet 1.9.4 + Supabase (leitura/escrita de camadas geográficas), edição de polígono (leaflet-draw), cache de tiles raster local com fallback online, RLS por cargo sobre geometria — tudo em frontend zero-build, portando um editor legado (`DEV_ERP/cmms-mapa/admin.html`) que hoje fala com um backend Node inexistente neste projeto
**Confidence:** MEDIUM-HIGH — a maior parte das afirmações é leitura direta do repositório e das migrações (citadas `arquivo:linha`), incluindo duas descobertas que contradizem a premissa do roadmap (ver Summary). As decisões de terceiros (política de tiles OSM, estado de manutenção do leaflet-draw, disponibilidade de PostGIS) vêm de busca web/Context7 cruzada com fontes oficiais — MEDIUM. Não há CONTEXT.md desta fase (nenhum `/gsd-discuss-phase` rodou); as notas de implementação do ROADMAP.md fazem esse papel.

## Summary

Esta fase porta um editor que já existe e já funciona (`DEV_ERP/cmms-mapa/admin.html`, leaflet-draw, cálculo de área e compatibilidade de máquinas) para o padrão pmoc, trocando o backend Node inexistente (`http://localhost:8010/api/grama`) por Supabase. A pesquisa confirma que o componente de visualização (`mapa/xmap.js`, `xMap.registerLayer()`) já suporta tudo que o editor precisa — o trabalho real é (1) trocar os três `xmap-layers-*.js` de dados mock para `carregarTudo()` + Supabase, (2) portar `admin.html` como uma segunda tela do módulo `/mapa` (não um `admin.html` separado — ver Pattern 1), (3) estender `maq_areas` com geometria e os três atributos de terreno, (4) resolver tiles locais com fallback online, e (5) fechar RLS para que `observador` não escreva.

Duas descobertas contradizem premissas do roadmap e mudam o escopo real da fase:

1. **`cmasm_locais` não tem coordenada geográfica nenhuma** (`grep -n "latitude\|longitude\|geometry" supabase/19_cmasm_locais_unificado.sql supabase/20_cmasm_locais_predios.sql` = vazio, tabela lida por completo em `supabase/17_predial_schema.sql:35-48`). O critério de sucesso 1 fala em "posicionados pelo vínculo `cmasm_locais.local_id` já existente" — esse vínculo é uma árvore hierárquica (prédio → sala), não coordenadas. Para o `/mapa` plotar um ativo, alguém precisa ter lat/lon — hoje **nenhuma tabela do projeto tem essa coluna** (`grep` exaustivo em `supabase/*.sql` por `lat\b|lon\b|latitude|longitude` não encontra nada fora dos arquivos `mapa/xmap-layers-*.js`, que são mock). Ver Pattern 2.
2. **O papel "Livre"/observador nunca autentica no Supabase** — `shared/auth.js:210-217`, `_selecionarCargo()`, ao clicar em "Livre" seta `this._usuario` localmente e chama `onLogin()` **sem nenhuma chamada a `supa.auth.signInWithPassword()`**. Isso significa que o observador sempre opera como o papel Postgres `anon`, nunca `authenticated` — o que faz o critério de sucesso 10 (observador não escreve, travado no banco) já estar satisfeito por construção **desde que** as políticas de escrita novas usem `to authenticated` (nunca `using(true)` sem escopo de role). Ver Security Domain.

A fórmula de área do legado (`calcAreaM2`, `DEV_ERP/cmms-mapa/admin.html:1269-1282`) **não é planar ingênua** — é a família de fórmula por excesso esférico (mesma técnica usada por `turf.js` `area()` e por `SphericalUtil.computeArea()` do Google Maps Android), adequada para a latitude do CMASM (≈ -22,84°) e para a escala do terreno (poucas centenas de metros). Recomendação: portar como está, não reescrever.

**Primary recommendation:** portar `admin.html` como uma segunda "aba"/modo dentro do próprio `/mapa` (não um arquivo `admin.html` deploy separado), consumindo `xMap.registerLayer('grama', ...)` já existente; adicionar `geom jsonb`, `flora`, `inclinacao`, `limpeza` a `maq_areas` (migração aditiva); adicionar `lat`/`lon` nullable a `cmasm_locais` **e** um par de colunas de posição própria nullable em cada tabela de ativo (`maq_ativos`, `transp_ativos`, `elet_ativos`, `equipamentos`) para permitir reposicionamento individual sem inventar uma segunda árvore de locais; usar `jsonb` para geometria (não PostGIS); gerar ~1.900 tiles locais via toolchain offline (Mapnik/osmium) a partir do `.osm` já em mãos, com `L.TileLayer` customizado (`createTile` override) caindo para OSM/Esri online fora da área coberta; manter `leaflet-draw@1.0.4` (funciona, já portado, CDN estável) mas documentar que está sem manutenção desde 2018 e citar Leaflet-Geoman como alternativa se o editor crescer.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Renderização do mapa (Leaflet, camadas, popups) | Browser / Client (`mapa/xmap.js`, existente) | — | Componente puro de cliente, sem SSR; já provado em produção |
| Dados de camada (áreas, ativos posicionados) | API / Backend (Supabase via `carregarTudo()`) | Browser / Client (`xmap-layers-*.js` consome e desenha) | Mesmo padrão dos outros 6 módulos: array `UPPER_CASE` populado por `Promise.all`, sem cache client próprio |
| Geometria de zonas de serviço (`maq_areas`) | Database / Storage (`jsonb`, aditivo à migração 12) | — | Simples armazenar/recuperar/computar área client-side; sem consulta espacial server-side nesta fase (ver Pattern 3) |
| Cálculo de área e compatibilidade de máquinas | Browser / Client (função pura, portada do legado) | — | Mesma decisão que `shared/tema.js` já estabeleceu: lógica sem `fetch`/DOM fica em módulo puro, testável em Node |
| Controle de acesso a escrita (zona, posição de ativo) | Database / Storage (RLS, Postgres) | Browser / Client (UI esconde os controles, mas não é a barreira real) | Convenção já estabelecida em `transp_pode_escrever()`/`maq_areas_insert` (migração 22, 12) — cliente nunca é a barreira de segurança (CLAUDE.md, "Auth & security") |
| Tiles do mapa base (raster PNG) | CDN / Static (arquivos servidos pelo Vercel, mesma origem) | Browser / Client (fallback para provedor online quando faltam) | Sem servidor de tiles dinâmico neste projeto — zero-build; local-first é literalmente "arquivo estático a mais no repo" |
| Editor de zona (leaflet-draw) | Browser / Client | — | Toda a interação de desenho é client-side; só o `salvar` final toca o Supabase |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-13 | `/mapa` plota ativos usando `cmasm_locais.local_id` | Pattern 2 — `cmasm_locais` não tem coordenada; é preciso adicionar `lat`/`lon` na própria tabela (posição "de prédio/sala") **e** permitir override por ativo (Pattern 2, Common Pitfall 1) |
| PLAT-14 | Usuário navega do ativo no mapa para o módulo de origem | Pattern 5 — popup já tem estrutura (`xMap.utils.popupHTML`); falta só o link, dado que cada camada sabe seu módulo de origem |
| PLAT-17 | Camadas leem do Supabase, não de mock | Pattern 1 — trocar `MOCK_*`/`INFRA` por `carregarTudo()` mantendo o contrato `registerLayer(moduleName, layerDefs)` intocado |
| PLAT-18 | Desenhar zona, atributos de terreno, área em m², máquinas compatíveis, persistida em `maq_areas` | Pattern 3 (schema), Pattern 4 (editor portado), Common Pitfall 2 (vocabulário de categoria não bate) |
| PLAT-19 | Mapa base abre sem internet na área do CMASM, cai para online fora dela; satélite só online | Pattern 6 (tiles locais + fallback), Pattern 7 (geração de tiles licenciada), Open Question 3 (onde os tiles vivem) |
| PLAT-20 | Usuário acrescenta/reposiciona ativos pelo mapa, posição persistida | Pattern 2, Security Domain (RLS já bloqueia observador por construção — ver Summary #2) |
| PLAT-15 | `refrigeracao` continua intocada | Nenhum arquivo desta fase toca `refrigeracao/`; reverificar por `git diff --name-only` no fechamento, mesmo padrão das Fases 5 e 6 |
| PLAT-16 | Nenhum módulo perde funcionalidade | `node --test` roda 58/58 nesta pesquisa (baseline); qualquer novo teste soma, nenhum substitui |

</phase_requirements>

## Standard Stack

Nenhuma biblioteca de aplicação nova é necessária além do que o módulo `/mapa` já carrega. A única adição é `leaflet-draw` (já usado pelo legado, nunca instalado no pmoc).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `leaflet` | 1.9.4 (já em uso, `mapa/index.html:11`) | Mapa base, camadas, popups | Já em produção; sem mudança |
| `leaflet-draw` | 1.0.4 `[VERIFIED: npm registry]` | Desenho/edição de polígono | Já usado pelo legado que esta fase porta (`DEV_ERP/cmms-mapa/admin.html:667`); reescrever o editor do zero custaria mais que herdar um risco de manutenção conhecido — ver Pattern 8 e Package Legitimacy Audit |
| `@supabase/supabase-js` | 2.x (CDN, já em uso) | Leitura/escrita das camadas e da geometria | Já é o backend de todo o projeto; sem alternativa |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nenhuma nova | — | — | O cálculo de área, a compatibilidade de máquinas e o fallback de tile são funções puras próprias, não pacotes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `leaflet-draw@1.0.4` | `@geoman-io/leaflet-geoman-free` 2.20.0 `[VERIFIED: npm registry]`, publicado em 2026-06-23, ativamente mantido | Geoman é a escolha certa para um editor **novo**; para um editor que já existe e funciona (o legado), portar `leaflet-draw` é reaproveitar código pronto sem custo de reescrita de UI. Ver Pattern 8 — decisão de planejamento, não travada aqui |
| `jsonb` para geometria de `maq_areas` | `geometry`/`geography` do PostGIS | PostGIS está disponível no Supabase (`create extension postgis with schema "extensions"` `[CITED: supabase docs via Context7]`), mas nenhuma operação desta fase precisa de consulta espacial server-side (`ST_Intersects`, `ST_DWithin` etc.) — armazenar/recuperar/computar área é tudo client-side hoje, igual ao legado (`coords_json` já é texto/JSON). Ver Pattern 3 |
| Tiles vindos do Supabase Storage | Tiles como arquivo estático no repo (git) | Ver Pattern 6 — Storage exige rede para buscar cada tile, o que anula o requisito de abrir sem internet (PLAT-19); arquivo estático servido pelo Vercel já está no disco do navegador/CDN, sem round-trip extra |
| Gerar tiles renderizando o `.osm` local | Baixar tiles em massa de `tile.openstreetmap.org` | A política de uso do OSM proíbe exatamente esse padrão (bulk/prefetch) `[CITED: operations.osmfoundation.org/policies/tiles]` — ver Pattern 7 |

**Instalação:**
```html
<!-- Adicionar ao <head> de mapa/index.html, junto ao leaflet.css/leaflet.js já presentes -->
<link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css" crossorigin="anonymous"/>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js" crossorigin="anonymous"></script>
```

**Version verification:** `npm view leaflet-draw version` → `1.0.4` (publicado 2018-10-24, sem release desde então) `[VERIFIED: npm registry]`. `npm view leaflet version` → `1.9.4`, igual ao que `mapa/index.html:11` já carrega `[VERIFIED: npm registry]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `leaflet` | npm | publicado 2023-05-18 (major 1.x estável há anos) | 6.672.468/semana | `github.com/Leaflet/Leaflet` | OK | Aprovado — já em uso |
| `leaflet-draw` | npm | publicado 2018-10-24 (sem release desde então) | 369.459/semana | `github.com/Leaflet/Leaflet.draw` | OK | Aprovado — sem `postinstall`, sem sinal de sequestro de pacote; downloads altos e estáveis apesar de sem manutenção ativa (ver Pattern 8 para o risco de manutenção, que é distinto de legitimidade) |
| `@geoman-io/leaflet-geoman-free` | npm | publicado 2026-06-23 | 178.678/semana | `github.com/geoman-io/leaflet-geoman` | OK | Citado como alternativa (Pattern 8), não recomendado para esta fase |

**Packages removed due to [SLOP] verdict:** nenhum
**Packages flagged as suspicious [SUS]:** nenhum

Nenhum pacote novo entra via `npm install` (projeto zero-build); o único pacote novo consumido é `leaflet-draw` via CDN (`unpkg`), verificado acima contra o registro npm e checado por `gsd-tools query package-legitimacy check --ecosystem npm` (todos `OK`, sem `postinstall` suspeito).

## Architecture Patterns

### System Architecture Diagram

```text
┌────────────────────── /mapa (Browser) ──────────────────────────────┐
│                                                                        │
│  mapa/index.html                                                     │
│   ├─ shared/auth.js (login)   ──── observador = "Livre" = NUNCA      │
│   │                                autentica no Supabase (anon role) │
│   ├─ shared/shell.js (chrome)                                        │
│   └─ mapa/app.js (boot)                                              │
│         │                                                             │
│         ▼                                                             │
│   xMap.init() ──── mapa/xmap.js (INTOCADO — já suporta tudo)         │
│         │                                                             │
│         ├─ tileLayer local-first  ──► arquivos estáticos /mapa/tiles/*│
│         │   (L.TileLayer custom,        (servidos pelo Vercel,       │
│         │    createTile override)        mesma origem, sem rede)     │
│         │        │ onerror (fora da área coberta ou sem tile)        │
│         │        ▼                                                    │
│         │   tileLayer OSM/Esri online (só quando há rede)            │
│         │                                                             │
│         └─ xMap.registerLayer(moduleName, layerDefs)                 │
│                  ▲                    ▲                    ▲          │
│         mapa/xmap-layers-grama.js  -aguada.js  -eletrica.js          │
│           (MUDA: mock → Supabase)  (idem)      (idem)                │
│                  │                                                     │
│                  ▼                                                     │
│         carregarTudo() (Promise.all, mesmo padrão dos 6 módulos)     │
│                  │                                                     │
└──────────────────┼─────────────────────────────────────────────────┘
                    ▼
     ┌──────────────────────────── Supabase (Postgres + RLS) ─────────┐
     │  maq_areas (+ geom jsonb, flora, inclinacao, limpeza)  NOVO     │
     │  maq_ativos / transp_ativos / elet_ativos / equipamentos       │
     │      (+ lat/lon próprios, nullable — override de posição)      │
     │  cmasm_locais (+ lat/lon, nullable — posição "de prédio")      │
     │                                                                  │
     │  RLS: select using(true) [leitura pública, já convencionado]   │
     │       insert/update to authenticated + checagem de role        │
     │       (observador nunca chega como authenticated — Summary #2) │
     └──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
mapa/
├── app.js                    # boot; cresce para orquestrar modo "editar" (Pattern 4)
├── index.html                # + <link>/<script> do leaflet-draw
├── xmap.js                   # INTOCADO
├── xmap.css                  # INTOCADO (fora do tema — decisão prévia da Fase 6)
├── xmap-layers-grama.js      # MOCK_AREAS/MOCK_MAQUINAS → Supabase
├── xmap-layers-aguada.js     # INFRA mock → Supabase (ou mantém mock se aguada não tiver
│                              #   tabela própria neste milestone — ver Open Question 1)
├── xmap-layers-eletrica.js   # idem
├── mapa-geometria.js         # NOVO — função pura: calcAreaM2, calcCompatCliente,
│                              #   normalizarCategoria (Pattern 3, Common Pitfall 2)
├── mapa-editor.js            # NOVO — porta admin.html: leaflet-draw, painel de edição,
│                              #   salvar no Supabase (Pattern 4)
└── tiles/                    # NOVO — ~1.900 arquivos PNG estáticos (Pattern 6, 7)
    └── {z}/{x}/{y}.png

supabase/
└── 25_mapa_geometria_posicao.sql   # NOVO — aditiva (Pattern 3)

tests/
└── mapa-geometria.test.js    # NOVO — calcAreaM2, calcCompatCliente puros (Pattern 9)
```

### Pattern 1: `xmap-layers-*.js` trocam mock por Supabase sem tocar o contrato `registerLayer`

**What:** o contrato entre `xmap.js` e cada arquivo de camada é `xMap.registerLayer(moduleName, { layerKey: { label, color, render(group) } })` (`mapa/xmap.js:292-307`). O `render(group)` de cada layer hoje itera um array mock e chama `group.addLayer(...)`. A menor mudança possível é: (1) trocar a função `tryRegister()` (que hoje roda imediatamente, síncrona, olhando só se `xMap` existe) por uma sequência assíncrona `carregarDados()` → `xMap.registerLayer(...)`, porque os dados agora vêm de uma query; (2) manter `render(group)` populando o mesmo `group` com os mesmos `L.polygon`/`L.marker`, só trocando a fonte do array.

```javascript
// mapa/xmap-layers-grama.js — esboço da mudança mínima
(async function () {
  const supa = await criarClienteSupabase() // shared/supabase-config.js, já usado por mapa/app.js

  async function carregarAreas() {
    const { data, error } = await supa.from('maq_areas').select('*').eq('ativo', true)
    if (error) { console.error('maq_areas:', error.message); return [] }
    return data
  }
  async function carregarMaquinasPosicionadas() {
    const { data, error } = await supa.from('maq_ativos')
      .select('id,nome,categoria,status,lat,lon,uso_atual')
      .not('lat', 'is', null)
    if (error) { console.error('maq_ativos:', error.message); return [] }
    return data
  }

  const layerDefs = {
    areas:    { label: 'Áreas', color: '#4ade80', async render(group) { renderAreas(group, await carregarAreas()) } },
    maquinas: { label: 'Máquinas', color: '#4ade80', async render(group) { renderMaquinas(group, await carregarMaquinasPosicionadas()) } },
  }
  // registerLayer hoje chama def.render(group) de forma síncrona (mapa/xmap.js:297) —
  // como render() void não é aguardado, group.addLayer() dentro de uma render async ainda
  // funciona (o group já existe e está no mapa; popular depois é só popular tarde), mas
  // o "loading" fica invisível. Ver Common Pitfall 3.
  function tryRegister() {
    if (typeof xMap !== 'undefined' && xMap.registerLayer) xMap.registerLayer('grama', layerDefs)
    else setTimeout(tryRegister, 50)
  }
  tryRegister()
})()
```

**When to use:** para os três arquivos (`-grama.js`, `-aguada.js`, `-eletrica.js`). `renderAreas`/`renderMaquinas`/`popupHTML` (as funções que já existem, `mapa/xmap-layers-grama.js:95-168`) não precisam mudar — só a fonte dos dados que elas recebem.

**Nó a resolver — `aguada`/`eletrica`:** essas duas camadas não têm tabela própria de reservatórios/bombas/válvulas/geradores/transformadores no schema atual (`grep` em `supabase/*.sql` por `reservatorio\|bomba\|valvula\|gerador\|transformador` não encontra tabela — só `maq_areas`/`maq_ativos` e as tabelas de `eletrica` que são sobre **inspeção**, não sobre infraestrutura física georreferenciada). O critério de sucesso 6 diz "nenhum dado de demonstração embutido em `xmap-layers-*.js` permanece na origem do que é exibido" — isso é satisfeito plotando `elet_ativos`/`maq_ativos` reais (que existem) e **removendo** as camadas que não têm fonte real (`pipelines`, `pumps`, `valves`, `hydrometers`, `sanitation` de `-aguada.js`; `ramais` de `-eletrica.js`, que não tem tabela de "ramal" nenhuma) em vez de inventar uma tabela nova fora do escopo desta fase. Ver Open Question 1 — decisão de escopo para o planejamento, não travada aqui.

### Pattern 2: posição geográfica de ativo — dois níveis, porque `cmasm_locais` não tem coordenada

**What:** confirmado por leitura completa de `supabase/17_predial_schema.sql:35-48` (definição de `pred_locais`, renomeada para `cmasm_locais` em `supabase/19_cmasm_locais_unificado.sql:31`) e `grep` exaustivo — a tabela tem `id, codigo, neo, nome, tipo, area, restricao, parent_id, descricao, ativo, criado_em`. **Nenhuma coluna de coordenada.** O vínculo `ativo.local_id → cmasm_locais.id` (migração 19) é uma árvore de organização (prédio → sala), não geolocalização.

Duas camadas de posição são necessárias, não uma:

1. **Posição "herdada do prédio"** — adicionar `lat double precision`, `lon double precision` (nullable) em `cmasm_locais`. Todo ativo cujo `local_id` aponta para um prédio/sala com coordenada aparece lá por padrão. Isso cobre a maioria dos casos hoje (171 equipamentos já ligados a prédio/sala pela migração 20) sem exigir digitar 171 pares de coordenada.
2. **Posição própria, opcional** (override) — adicionar `lat`, `lon` nullable diretamente em `maq_ativos`, `transp_ativos`, `elet_ativos`, `equipamentos`. Quando presente, vence a posição herdada do prédio. Isso é o que PLAT-20 pede ("reposiciona ativos... pelo mapa, com a posição persistida") — arrastar um ativo no mapa grava aqui, não em `cmasm_locais` (que é compartilhado por todos os ativos daquele prédio; mover um sem mover os outros exige posição individual).

```sql
-- Esboço — nomes e migração exata ficam para o planejamento
alter table cmasm_locais add column if not exists lat double precision;
alter table cmasm_locais add column if not exists lon double precision;

alter table maq_ativos    add column if not exists lat double precision;
alter table maq_ativos    add column if not exists lon double precision;
alter table transp_ativos add column if not exists lat double precision;
alter table transp_ativos add column if not exists lon double precision;
alter table elet_ativos   add column if not exists lat double precision;
alter table elet_ativos   add column if not exists lon double precision;
alter table equipamentos  add column if not exists lat double precision;
alter table equipamentos  add column if not exists lon double precision;
```

**Why it happens (por que o roadmap presumiu diferente):** a nota de implementação do ROADMAP.md fala em "vínculo já existente" no sentido de que a **ligação lógica** (`local_id`) já existe e não precisa ser inventada — o que é verdade. A pesquisa mostra que essa ligação sozinha não basta para plotar um ponto no mapa; falta a geometria em algum lugar da cadeia.

**When to use:** popular `cmasm_locais.lat/lon` é trabalho de dados (poucas dezenas de prédios/salas, não centenas de ativos) — cabe numa migração de seed com coordenadas aproximadas do prédio (a partir do `.osm`/mapa geral já em mãos, `Mapa Geral_luc.pdf`, `map_cmasm_2026abr.osm`) ou preenchidas manualmente pela tela depois. O override por ativo é o que o critério de sucesso 8 ("acrescenta e reposiciona ativos... pelo mapa") realmente exige.

**Anti-pattern a evitar:** inventar uma segunda árvore de "locais geográficos" paralela a `cmasm_locais`. As notas do roadmap já decidiram (D-implícita, ver `PLAT-18`) que zonas de serviço ficam **fora** de `cmasm_locais` por serem auxiliares/temporárias — mas posição de ativo real (viatura, equipamento) não é auxiliar, é dado permanente do próprio ativo; vive na tabela do ativo, não numa tabela de locais nova.

### Pattern 3: `jsonb` para geometria de `maq_areas`, não PostGIS

**What:** PostGIS está disponível no Supabase (`create extension postgis with schema "extensions"` `[CITED: github.com/supabase/supabase docs, via Context7]`), mas nenhuma operação desta fase precisa de consulta espacial (não há "quais zonas contêm este ponto", não há índice `GIST`, não há `ST_Area` server-side — a área já é calculada client-side, como no legado). Adotar PostGIS aqui adicionaria: uma extensão a mais para gerenciar, tipos `geometry`/`geography` que o `supabase-js` não serializa nativamente sem WKT/GeoJSON, e uma dependência que nenhuma tela deste projeto vai usar. `jsonb` é a extensão direta do padrão já usado pelo legado (`coords_json`, que é `text` contendo JSON) para o padrão SQL correto (`jsonb` nativo, indexável se algum dia precisar, sem parse/stringify redundante).

```sql
-- Migração aditiva a maq_areas (existente desde a migração 12)
alter table maq_areas add column if not exists geom jsonb;              -- [[lat,lon], [lat,lon], ...]
alter table maq_areas add column if not exists flora text
  check (flora is null or flora in ('gramado','capim_colonial','mata_fechada'));
alter table maq_areas add column if not exists inclinacao text
  check (inclinacao is null or inclinacao in ('plano','moderado','acentuado'));
alter table maq_areas add column if not exists limpeza text
  check (limpeza is null or limpeza in ('limpa','media','densa'));
-- area_m2 já existe (migração 12); maquinas_compativeis pode ser derivado em runtime
-- (calcCompatCliente) e não precisa de coluna própria — evita duas fontes de verdade.
```

**When to use:** sempre que a necessidade é "guardar e reexibir uma forma", sem consulta espacial. Se uma fase futura precisar de "quais ativos estão dentro desta zona" via SQL, aí sim migrar para PostGIS vale a complexidade — não antes.

### Pattern 4: `admin.html` vira uma tela do próprio `/mapa`, não um segundo deploy

**What:** o legado é um HTML separado (`cmms-mapa/admin.html`) que fala com uma API própria. Portá-lo como arquivo solo em `/mapa/admin.html` repetiria login, shell e boot do zero — contra a convenção de `shared/auth.js`/`shared/shell.js` que todo o milestone v2.0 já estabeleceu. A alternativa recomendada: o editor vira um **modo** dentro do `/mapa` existente — um botão "Editar zonas" (visível só para quem `role in ('admin','gestor','tecnico')`, replicando a UI hint que já esconde ações de escrita nos outros módulos) que ativa a `drawnItems`/`drawControl` do `leaflet-draw` sobre o **mesmo** `xMap.getLeafletMap()` já inicializado, com o painel de atributos lateral substituindo a sidebar de módulos enquanto o modo edição está ativo.

```javascript
// mapa/app.js — esboço de integração, não o código final
import { iniciarEditor } from './mapa-editor.js'

function mostrarApp() {
  // ...existente...
  if (['admin','gestor','tecnico'].includes(USUARIO?.role)) {
    iniciarEditor(xMap.getLeafletMap(), supa, USUARIO)  // xMap.getLeafletMap() já existe (mapa/xmap.js:325)
  }
}
```

**Why it happens (motivo do editor legado ser separado):** o legado tinha duas telas porque `demo.html` (visualização) e `admin.html` (edição) eram públicos separados de um produto de portfólio (`DEV_ERP`), sem sistema de login por cargo. O pmoc já resolve "quem pode ver vs. quem pode editar" via `shared/auth.js` + RLS — não precisa de dois arquivos para isso.

**When to use:** esta é a estrutura recomendada; alternativa (arquivo `mapa/admin.html` próprio, reaproveitando login) é válida mas duplica o boot (`criarClienteSupabase()`, `Auth`, `aplicarShell()`) que `mapa/app.js` já faz — decisão de planejamento, ambas tecnicamente corretas, mas a integrada evita duplicação.

### Pattern 5: navegação do mapa para o módulo de origem (PLAT-14)

**What:** `xMap.utils.popupHTML(icon, title, sub, rows)` (`mapa/xmap.js:55-73`) já monta o HTML do popup a partir de `rows: [[k, v, cls]]`. Adicionar um link "Abrir no módulo" é inserir uma linha extra no array `rows` ou um rodapé no template, apontando para a rota já existente (`/maquinas`, `/eletrica`, etc., via `vercel.json`) com um parâmetro de busca (`?ativo=<id>`) que o módulo de destino lê no boot para abrir direto na ficha do ativo. Isso exige uma pequena adição em cada `app.js` de módulo (ler `URLSearchParams`, abrir modal do ativo se o parâmetro existir) — fora do arquivo `mapa/`, mas pequena e already-idiomática (os módulos já leem `location.pathname` em outros pontos, ex. `mapa/index.html:65-69`).

**Anti-pattern a evitar:** duplicar a lógica de "abrir ficha do ativo" dentro do próprio `/mapa` (ex. um modal de detalhes completo no mapa) — o critério de sucesso 3 pede navegação para o módulo de origem, não uma segunda UI de detalhe.

### Pattern 6: tile local-first com fallback online — `L.TileLayer` customizado

**What:** a pesquisa comparou três abordagens (`errorTileUrl`, plugin `Leaflet.TileLayer.Fallback`, `createTile` customizado):

- `errorTileUrl` só troca o tile por uma **imagem estática única** (ex. um PNG "sem dado"), não permite buscar de **outro provedor** com template de URL próprio `[CITED: github.com/Leaflet/Leaflet/issues/5810]`.
- `Leaflet.TileLayer.Fallback` (plugin) resolve um problema diferente — troca por um tile de **zoom mais baixo da mesma fonte**, não por uma fonte diferente `[CITED: github.com/ghybs/Leaflet.TileLayer.Fallback]`.
- **`createTile` customizado é a única abordagem que permite "tenta local, se falhar tenta outro provedor com outra URL"** `[CITED: leafletjs.com/examples/extending/extending-2-layers.html]` — é pouco código, sem dependência nova.

```javascript
// mapa/xmap.js (ou um módulo próprio importado antes) — esboço, ordem de zoom nativo
// respeita o precedente do aguada (maxNativeZoom menor que maxZoom, Leaflet reamostra)
const TileLocalComFallback = L.TileLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement('img')
    const localUrl  = L.Util.template(this._url, this._getTileData(coords))       // /mapa/tiles/{z}/{x}/{y}.png
    const onlineUrl = L.Util.template(this.options.urlOnline, this._getTileData(coords))
    let tentouOnline = false
    tile.onerror = () => {
      if (!tentouOnline) { tentouOnline = true; tile.src = onlineUrl }
      else done(new Error('tile indisponível local e online'), tile)
    }
    tile.onload = () => done(null, tile)
    tile.src = localUrl
    return tile
  },
})

_baseLayers.map = new TileLocalComFallback('/mapa/tiles/{z}/{x}/{y}.png', {
  urlOnline: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  maxNativeZoom: 18,   // além disso, Leaflet reamostra o tile local (precedente aguada)
  maxZoom: 19,
  minZoom: 13,
})
```

**Degradação com zero rede:** dentro da área/zoom cobertos, `tile.src = localUrl` resolve (arquivo estático, mesma origem, já em disco/cache do navegador ou servido pelo `python -m http.server` local — ver Open Question 4 sobre como o critério "com a rede desligada" é testado na prática, já que o projeto não tem service worker/PWA offline, confirmado por `grep -rn "serviceWorker.register" .` = vazio). Fora da área/zoom, `tile.onerror` tenta o `onlineUrl`; sem rede, essa segunda tentativa também falha e o `done(error, tile)` deixa o quadrado sem tile (comportamento padrão do Leaflet, não uma tela quebrada) — aceitável, é literalmente "fora da área coberta".

**When to use:** só para o basemap `map` (OSM). O `satellite` (Esri) **não** ganha essa camada — fica só `L.tileLayer(TILES.satellite.url, ...)` como já é hoje (`mapa/xmap.js:224-227`), sem `createTile` customizado, por decisão do usuário já registrada no ROADMAP.md.

### Pattern 7: gerar os tiles locais — toolchain e a questão de licença

**What:** a Tile Usage Policy do OpenStreetMap Foundation proíbe explicitamente "prefetch/bulk downloading" — inclusive recursos como "baixar cidade/país para uso offline" `[CITED: operations.osmfoundation.org/policies/tiles]`. Baixar programaticamente os ~1.900 tiles de `tile.openstreetmap.org` (mesmo que só uma vez) é exatamente o padrão proibido — não é uma questão de volume pequeno, é o **padrão de acesso** que a política bloqueia, sem aviso prévio (`will be blocked without notice`).

O caminho limpo é o que o roadmap já aponta: **renderizar os tiles a partir do `.osm` local** (`map_cmasm_2026abr.osm`, 926 KB, dado ODbL, sem essa restrição de uso — é o dado bruto, não o serviço de tiles). Toolchain confirmada por pesquisa:

1. **Mapnik + `generate_tiles.py`** (abordagem "one shot, no updates") `[CITED: github.com/ingmapping/docker-mapnik-osm-tiles]` — roda uma vez, produz os arquivos, não precisa de servidor rodando depois. É a opção mais direta para ~1.900 tiles de uma área fixa.
2. **`osmium`** para recortar/preparar o extrato antes de renderizar, se necessário reduzir ainda mais a área `[CITED: wiki.openstreetmap.org/wiki/Creating_your_own_tiles]`.
3. **TileMill** (Mapbox, descontinuado mas ainda documentado) como alternativa de estilo via CartoCSS, exporta direto para tiles/MBTiles `[CITED: wiki.openstreetmap.org/wiki/TileMill]`.

**Avaliação honesta de esforço:** renderizar ~1.900 tiles via Mapnik requer instalar Mapnik + `mapnik-utils`/dependências C++ (não é `npm install`), converter o `.osm` para um banco (geralmente PostGIS ou shapefiles) e rodar um script de geração — é um passo **fora** do fluxo zero-build do projeto (roda uma vez, no computador de quem prepara os tiles, não no deploy). Para ~1.900 tiles isso é desproporcional em esforço de setup comparado ao volume de saída, mas é o único caminho que não viola a política do OSM. Alternativas legítimas caso o esforço de Mapnik seja rejeitado no planejamento:
- **Um provedor cujos termos permitem cache local explicitamente** (ex. MapTiler, Stadia Maps, Thunderforest — todos oferecem tiles self-hostable/cacheáveis sob assinatura paga) — troca esforço de infraestrutura por custo recorrente, e ainda depende de rede na hora de baixar o lote inicial (mas dentro dos termos do provedor, não do OSMF).
- **Um fetch único, manual, de baixa taxa**, respeitando a política de uso interativo normal (requisição só dos tiles vistos, com cache do navegador honrando os headers) — tecnicamente não é "prefetch/bulk" se for feito navegando manualmente pela área nos 6 níveis de zoom em vez de um script automatizado, mas é uma leitura permissiva da política que este documento não recomenda como caminho principal — decisão do usuário, deve ser explícita no planejamento, não assumida.

**Não fazer:** um script que itera `for z,x,y in bbox: fetch(tile.openstreetmap.org/...)` — é o padrão exato que a política proíbe.

### Pattern 8: `leaflet-draw` em 2026 — mantém, mas documenta o risco

**What:** confirmado por pesquisa — `leaflet-draw` não recebe release desde 2018 (última versão 1.0.4, `[VERIFIED: npm registry]`, `time.modified: 2022-06-19` no metadado do pacote, mas o código-fonte em si não muda desde 2018) `[CITED: github.com/Leaflet/Leaflet.draw/issues/1041]`. `Leaflet-Geoman` é o sucessor ativamente mantido, com Pro version, TypeScript, e compatibilidade com frameworks modernos `[CITED: geoman.io/blog/leaflet-geoman-vs-leaflet-draw]`, publicado no npm em 2026-06-23 `[VERIFIED: npm registry]`.

**Recomendação:** manter `leaflet-draw@1.0.4` para esta fase. Justificativa: (1) o código do editor já existe e funciona sobre essa biblioteca (`admin.html` inteiro), reescrever para Geoman custaria reaprender a API de eventos (`L.Draw.Event.CREATED` vs. equivalente do Geoman) sem ganho funcional imediato; (2) `leaflet-draw` continua servido pelo CDN (`unpkg`) sem sinal de descontinuação de distribuição, só de desenvolvimento; (3) o escopo desta fase é só polígono (`draw.polygon`), a superfície de API usada é pequena e estável. **Risco documentado, não ignorado:** se um bug de navegador moderno colidir com `leaflet-draw` (não há evidência disso hoje, mas é o tipo de risco de um pacote sem commit desde 2018), a migração para Geoman é o caminho — `@geoman-io/leaflet-geoman-free` é `OK` na auditoria de legitimidade e also servido via CDN.

### Anti-Patterns to Avoid

- **Presumir que `local_id` já resolve posição geográfica** (Pattern 2) — é uma árvore de organização, não coordenadas; confundir os dois deixa o critério de sucesso 1 sem dado para plotar.
- **Adotar PostGIS "porque é o padrão da indústria"** sem uma consulta espacial real que justifique — ver Pattern 3; isso contraria a filosofia de simplicidade zero-build do projeto sem ganho mensurável nesta fase.
- **Baixar tiles de `tile.openstreetmap.org` programaticamente**, mesmo uma única vez — viola a política de uso (Pattern 7).
- **Reescrever `calcAreaM2` do zero** — a fórmula do legado já é geodésica corretamente formada (excesso esférico), portar em vez de "corrigir" (ver Assumptions Log A2).
- **Publicar `admin.html` como segundo deploy sem login** — quebraria o padrão de auth por cargo que todo o milestone v2.0 estabeleceu (Pattern 4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Desenho/edição de polígono no mapa | Handlers de mouse/touch próprios para vértices, arrastar, fechar polígono | `leaflet-draw` (já portado, funcionando no legado) | Reimplementar drag-to-edit de vértice com suporte a touch é trabalho grande e sujeito a bugs sutis (ver Pattern 8) |
| Cálculo de área geodésica | Fórmula planar (`largura × altura` ou Shoelace sem correção de latitude) | `calcAreaM2` portado do legado (excesso esférico) | Numa latitude de -22,84° e polígonos de algumas centenas de metros, planar erra o suficiente para os m² exibidos ficarem visivelmente errados; a fórmula certa já existe e está pronta (Pattern 3, Assumptions A2) |
| Fallback de tile local→online | Um serviço próprio de proxy de tile, ou pré-carregar tudo num Service Worker | `L.TileLayer` customizado (Pattern 6), poucas linhas, sem dependência nova | Service Worker introduziria um mecanismo de cache totalmente novo ao projeto (que hoje não tem nenhum, `grep` confirmado); o `createTile` override resolve o requisito sem essa complexidade |
| Geração de tile raster | Um renderizador de mapa escrito à mão a partir do `.osm` | Mapnik (padrão da indústria para exatamente este problema) | É o mesmo motor que roda `tile.openstreetmap.org`; não há vantagem em reimplementar renderização de mapa |

**Key insight:** o hand-roll de maior risco nesta fase não é código novo — é **schema presumido que não existe** (Pattern 2). Escrever a UI de posicionamento antes de confirmar onde a coordenada mora faria o trabalho ser refeito.

## Common Pitfalls

### Pitfall 1: vocabulário de `categoria` de `maq_ativos` não bate com `calcCompatCliente()`

**What goes wrong:** `maq_ativos.categoria` (seed real, `supabase/02_maquinas_seed.sql:44-51`) usa `rocadeira`, `motoserra` (uma letra `s`), `minitrator`, `trator`. O editor legado (`calcCompatCliente`, `DEV_ERP/cmms-mapa/admin.html:1009-1026`) e o mock (`mapa/xmap-layers-grama.js:14-53`) usam `cortador_grama`, `roçadeira` (com cedilha), `motosserra` (dois `s`), `soprador`. Portar `calcCompatCliente` sem mapear esses vocabulários faz toda máquina real do banco não bater com nenhum "tipo compatível", e a lista de "máquinas compatíveis" da zona fica sempre vazia mesmo com máquinas reais cadastradas.

**Why it happens:** o legado e o mock foram escritos com um vocabulário "de produto" (nomes de exibição), enquanto `maq_ativos.categoria` foi digitado direto do CSV/PDF de inventário original (Fase 1), sem coordenação entre os dois.

**How to avoid:** escrever uma função `normalizarCategoria(categoria)` explícita, testada, que mapeia os 4 valores reais de `maq_ativos.categoria` para o vocabulário de `calcCompatCliente` (`rocadeira→roçadeira`, `motoserra→motosserra`, `minitrator/trator→` decidir no planejamento se contam como "cortador_grama" ou ficam fora da compatibilidade — nenhum dos dois é claramente um cortador de grama pela nomenclatura). Não silenciosamente ignorar — logar/expor quando uma categoria não mapeada aparece.

**Warning signs:** abrir uma zona com `flora/inclinacao/limpeza` preenchidos e ver "Defina os atributos" mesmo com todos os três definidos — sinal de que a lista de máquinas compatíveis está vazia porque nenhuma bateu.

### Pitfall 2: `cmasm_locais` sem coordenada quebra o critério de sucesso 1 silenciosamente

**What goes wrong:** ver Pattern 2. Se o plano tentar "só" ler `ativo.local_id` e montar um marker sem verificar se existe `lat/lon` em algum lugar da cadeia, o resultado é um mapa vazio (nenhum ativo aparece) sem erro nenhum — `xmap-layers-*.js` já tem o padrão de `if (!lat || !lon) return` (`mapa/xmap-layers-grama.js:154`), que descarta silenciosamente.

**How to avoid:** o plano precisa incluir a migração de coordenadas (Pattern 2) como pré-requisito explícito antes de qualquer tarefa de "plotar ativo no mapa" — não depois, como um problema descoberto durante a execução.

**Warning signs:** query de conferência `select count(*) from maq_ativos where lat is not null` retornando 0 depois da migração — sinal de que a etapa de preencher coordenadas (seed inicial a partir do prédio, ou entrada manual) não rodou.

### Pitfall 3: `registerLayer` não espera `render()` assíncrono

**What goes wrong:** `xMap.registerLayer` (`mapa/xmap.js:292-307`) chama `def.render(group)` de forma síncrona e imediatamente decide se adiciona `group` ao mapa (`if (_activeModules.includes(moduleName)) ... _map.addLayer(group)`). Se `render()` virar `async` (Pattern 1, porque agora busca no Supabase), o `group` entra vazio no mapa e só se popula quando a Promise resolver — funcionalmente funciona (Leaflet re-renderiza quando `addLayer` é chamado dentro do group depois), mas não há nenhum indicador visual de "carregando", e se a query falhar (rede lenta, RLS negando), o usuário só vê um mapa sem áreas, sem mensagem.

**How to avoid:** tratar erro explicitamente dentro de cada `render()` (mesmo idioma do resto do projeto: `if (error) { ...mostrar callout... }`), e considerar (decisão de planejamento) se vale adicionar um indicador de carregamento simples no `xmap-filters` painel enquanto a primeira carga não resolve.

### Pitfall 4: satélite não pode herdar o `TileLayer` customizado por engano

**What goes wrong:** se o `L.TileLayer` customizado (Pattern 6) virar a classe base usada para **os dois** basemaps por conveniência de código, o satélite ganha fallback/cache local sem querer, contrariando a decisão travada do usuário ("satélite fica apenas online").

**How to avoid:** manter dois construtores de tile layer claramente distintos no código — `TileLocalComFallback` só para `map`, `L.tileLayer` padrão (sem override) para `satellite` — e um teste/gate que confirme isso (ex. checar que `mapa/xmap.js` não referencia `tiles/` no bloco do satélite).

### Pitfall 5: "abre sem internet" só é testável localmente, não contra o Vercel

**What goes wrong:** confirmado por leitura completa do repositório — não existe Service Worker nem manifest de cache offline em nenhum lugar (`grep -rn "serviceWorker.register" .` = vazio). Isso significa que testar PLAT-19 desligando a internet **enquanto acessa `https://pmoc-orcin.vercel.app`** nunca vai funcionar (o navegador não consegue nem buscar o `index.html` sem rede, muito menos os tiles) — não é um bug desta fase, é uma limitação de qualquer site estático sem service worker.

**How to avoid:** o critério "abre... com a rede desligada" só faz sentido testado via `python -m http.server` local (comando que o próprio `CLAUDE.md` já documenta como forma de rodar o projeto) — servidor no `localhost`, sem depender de internet, com os tiles locais presentes no disco. Documentar isso explicitamente no plano/roteiro de UAT para não gerar um checkpoint impossível de passar.

## Code Examples

### Fórmula de área geodésica (portar como está, não como "correção")

```javascript
// Source: DEV_ERP/cmms-mapa/admin.html:1268-1282 (legado, lido nesta pesquisa)
// Fórmula por excesso esférico — mesma família de turf.js `area()` e
// SphericalUtil.computeArea() do Google Maps Android [CITED: cruzado com
// turfjs.org/docs/api/area e discussão em github.com/Turfjs/turf/issues/1558]
function calcAreaM2(coords) {
  if (!coords || coords.length < 3) return 0
  const R = 6371000 // raio da Terra em metros
  const toRad = d => d * Math.PI / 180
  let area = 0
  const n = coords.length
  for (let i = 0; i < n; i++) {
    const [lat1, lon1] = coords[i]
    const [lat2, lon2] = coords[(i + 1) % n]
    area += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)))
  }
  return Math.abs(area * R * R / 2)
}
```

Como função pura (sem `L.`, sem DOM), esta é a candidata natural a virar `mapa/mapa-geometria.js`, testada em Node — mesmo padrão de núcleo puro que `shared/tema.js` (`normalizarTema`/`proximoTema`) já estabeleceu.

### Compatibilidade de máquinas (portar, adicionando a normalização do Pitfall 1)

```javascript
// Source: DEV_ERP/cmms-mapa/admin.html:1009-1026 (espelho client-side da regra —
// no legado o backend tinha a mesma lógica; aqui não há backend, só esta função)
function calcCompatCliente(flora, inclinacao, limpeza) {
  if (!flora || !inclinacao || !limpeza) return []
  if (flora === 'mata_fechada') return ['motosserra', 'roçadeira']
  if (inclinacao === 'acentuado') return ['roçadeira']
  if (flora === 'gramado') {
    if (inclinacao === 'plano' && limpeza === 'limpa') return ['cortador_grama']
    if (inclinacao === 'plano') return ['cortador_grama', 'roçadeira']
    return ['roçadeira']
  }
  if (flora === 'capim_colonial') {
    if (inclinacao === 'plano' && limpeza === 'limpa') return ['cortador_grama', 'roçadeira']
    return ['roçadeira']
  }
  return []
}

// NOVO nesta fase — sem precedente no legado (lá as máquinas já vinham com o
// vocabulário certo). Mapear o valor real do banco para o vocabulário acima.
function normalizarCategoria(categoria) {
  const mapa = { rocadeira: 'roçadeira', motoserra: 'motosserra' }
  return mapa[categoria] || categoria // minitrator/trator: decisão de planejamento (Pitfall 1)
}
```

### `xMap.registerLayer` — contrato a preservar (não mudar esta assinatura)

```javascript
// Source: mapa/xmap.js:292-307 (produção, INTOCADO por esta fase)
registerLayer(moduleName, layerDefs) {
  if (!_registeredLayers[moduleName]) _registeredLayers[moduleName] = {}
  Object.entries(layerDefs).forEach(([key, def]) => {
    const group = L.layerGroup()
    def.render(group)   // cada xmap-layers-*.js chama isso — pode virar async sem
                         // quebrar a assinatura (Pitfall 3), mas o contrato
                         // (moduleName, {layerKey: {label,color,render}}) não muda
    _registeredLayers[moduleName][key] = { group, def }
    if (_activeModules.includes(moduleName)) {
      if (!_filterState[moduleName]) _filterState[moduleName] = {}
      if (_filterState[moduleName][key] !== false) _map.addLayer(group)
      _renderFilters()
    }
  })
},
```

### RLS write predicate — idioma já estabelecido (reaproveitar para `maq_areas`/posição de ativo)

```sql
-- Source: supabase/22_transportes_planos_rbac.sql:27-39 (produção)
create or replace function transp_pode_escrever()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from usuarios u
    where u.auth_id = (select auth.uid())
      and u.ativo = true
      and u.role in ('admin', 'gestor', 'tecnico')
  )
$$;
-- maq_areas já segue o mesmo idioma inline (supabase/12_maquinas_areas_operacoes.sql:50-61):
--   create policy maq_areas_insert on maq_areas for insert to authenticated with check (
--     exists (select 1 from usuarios where auth_id=auth.uid() and ativo=true and role in ('admin','gestor'))
--   );
-- A migração desta fase reaproveita este padrão para as colunas novas
-- (geom/flora/inclinacao/limpeza em maq_areas já herdam a policy existente;
-- lat/lon em maq_ativos/transp_ativos/elet_ativos/equipamentos herdam a policy
-- "to authenticated using(true)" já existente em cada tabela — ver Security Domain).
```

## State of the Art

| Old Approach | Current Approach (proposta desta fase) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mapa/xmap-layers-*.js` com `MOCK_AREAS`/`MOCK_MAQUINAS`/`INFRA` embutidos | `carregarTudo()` + Supabase, mesmo padrão dos outros 6 módulos | Fase 10 | Camadas passam a refletir dados reais; edição tem onde persistir |
| `admin.html`/`demo.html` separados, backend Node em `localhost:8010` | Um único `/mapa`, modo de edição condicionado por `role`, Supabase | Fase 10 | Editor entra no padrão de auth/RLS do projeto, sem servidor Node extra |
| Sem coordenada em nenhuma tabela | `lat`/`lon` em `cmasm_locais` (herdada) e em cada tabela de ativo (override) | Fase 10 | Precondição real para PLAT-13/20, não documentada assim no roadmap original |
| `leaflet.js` tiles só online (OSM+Esri, `mapa/xmap.js:19-30`) | Tile local-first (basemap `map`) com fallback online; satélite continua só online | Fase 10 | Área do CMASM abre sem internet; fora dela, degrada para online quando há rede |

**Deprecated/outdated:** `leaflet-draw` está sem manutenção desde 2018 (Pattern 8) — mantido nesta fase por pragmatismo de porte, documentado como risco a revisitar se o editor crescer.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `cmasm_locais` e todas as tabelas de ativo não têm nenhuma coluna de coordenada hoje — confirmado por `grep` exaustivo em `supabase/*.sql`, mas o schema completo de `maq_ativos`/`transp_ativos`/`elet_ativos`/`equipamentos` foi lido só parcialmente (colunas de posição podem ter sido adicionadas fora do fluxo GSD, como já aconteceu com `/eletrica`/`/fonoclama`/`/calibracao` — ver STATE.md "Módulos fora do roadmap original") | Pattern 2, Summary #1 | Se uma coluna de posição já existir e não foi encontrada pelo grep (nome inesperado), a migração proposta duplicaria a coluna — mitigado por `add column if not exists`, mas vale conferir o schema real no Supabase antes de planejar a migração |
| A2 | `calcAreaM2` do legado usa uma fórmula de excesso esférico correta para a escala/latitude do CMASM — avaliação por leitura de código + pesquisa web cruzada (não executei o cálculo numericamente contra um valor de referência conhecido nesta sessão) | Pattern 3, Code Examples | Se a fórmula tiver um erro sutil não capturado pela leitura, os m² exibidos ficam errados silenciosamente — mitigado recomendando um teste de unidade com um polígono de área conhecida (ex. um quadrado de lado conhecido) antes de confiar no port |
| A3 | O escopo de `aguada`/`eletrica` (camadas sem tabela real de infraestrutura física) fica fora desta fase, com as camadas mock removidas em vez de uma tabela nova inventada | Pattern 1, Open Question 1 | Se o usuário esperava que PLAT-17 cobrisse essas camadas com dados reais, o escopo mínimo proposto fica incompleto — precisa confirmação explícita antes do planejamento |
| A4 | O leitor da política de tiles do OSM (Pattern 7) — a proibição de bulk/prefetch se aplica mesmo a um download único de ~1.900 tiles, não só a downloads recorrentes/automatizados em massa contínua | Pattern 7 | Se a leitura for excessivamente conservadora, o esforço de montar o toolchain Mapnik pode ser desproporcional a um risco que na prática seria tolerado — decisão que só o usuário pode assumir explicitamente, dado que envolve risco de bloqueio de acesso, não só preferência técnica |
| A5 | O Supabase deste projeto (`pmoc`, `thoaqipyhfmromsgzmjs`) permite `create extension postgis` sem restrição de tier — não confirmado diretamente contra o projeto real nesta sessão (sem acesso ao SQL Editor); baseado em documentação geral do Supabase | Standard Stack, Pattern 3 | Não é bloqueante, já que a recomendação é **não usar PostGIS** — risco só existiria se o planejamento decidir contrariar a recomendação e adotar PostGIS mesmo assim |

**Se esta tabela estivesse vazia:** não estaria — A1 a A5 (schema real de posição, correção numérica da fórmula de área, escopo de aguada/eletrica, leitura da política OSM, disponibilidade de PostGIS) precisam de confirmação antes de virarem decisão travada no plano.

## Open Questions

1. **`aguada` e `eletrica` (camadas do mapa) entram no escopo mínimo de PLAT-17, ou ficam fora por falta de tabela real?**
   - What we know: não existe tabela de reservatório/bomba/válvula/gerador/transformador/ramal no schema atual; `maq_areas`/`maq_ativos` (grama) são as únicas com dado real georreferenciável hoje
   - What's unclear: se o usuário espera que essas duas camadas apareçam vazias (sem mock, sem dado real) ou some da lista de módulos do mapa nesta fase
   - Recommendation: remover as camadas sem fonte real (ou plotar só o que já existe de real — `elet_ativos` tem `local_id`, mas não tipo "gerador/transformador" estruturado) e registrar como fora de escopo explícito, não como pendência silenciosa

2. **Coordenadas de `cmasm_locais` (prédio/sala) — de onde vêm os valores iniciais?**
   - What we know: existem fontes candidatas (`map_cmasm_2026abr.osm`, `Mapa Geral_luc.pdf`, `cmasm.geojson` em `DEV_reference_readonly/`) mas nenhuma foi cruzada linha a linha com os 29 prédios/132 salas de `cmasm_locais`
   - What's unclear: se algum desses arquivos já tem coordenada por prédio pronta para importar, ou se o preenchimento inicial será manual pela tela
   - Recommendation: checar `cmasm.geojson` no planejamento antes de assumir preenchimento 100% manual

3. **Onde os tiles vivem — confirmar volume real antes de decidir git vs. alternativa**
   - What we know: estimativa de ~1.900 tiles / ~12 MB (padded z13-18 + z19 ilha), baseada em contagem sobre o bbox, não em tiles já gerados
   - What's unclear: o volume real após gerar os tiles pode variar (compressão PNG real, densidade de features na área)
   - Recommendation: gerar os tiles primeiro, medir o tamanho real, e só então confirmar a decisão de "git normal" (recomendação desta pesquisa) vs. alternativa

4. **Teste "com a rede desligada" — confirmar que o roteiro de UAT vai usar `python -m http.server`, não o Vercel**
   - What we know: não há service worker; testar contra produção sem internet é fisicamente impossível
   - What's unclear: se o usuário já assumia isso ou esperava alguma forma de teste em produção
   - Recommendation: documentar explicitamente no plano/roteiro de UAT (Common Pitfall 5)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Não (sem mudança) | Login continua via `shared/auth.js`, sem alteração nesta fase |
| V3 Session Management | Não (sem mudança) | — |
| V4 Access Control | **Sim** | RLS em `maq_areas` (geometria/atributos) e nas colunas de posição novas (`lat`/`lon` em `maq_ativos`/`transp_ativos`/`elet_ativos`/`equipamentos`/`cmasm_locais`) deve seguir o idioma já estabelecido: `select using(true)` (leitura pública, convenção do projeto), `insert`/`update` `to authenticated` com checagem de `role in (...)` via `usuarios`. Como o observador ("Livre") nunca chama `signInWithPassword` (`shared/auth.js:210-217`, confirmado por leitura completa do arquivo), ele opera sempre como `anon` — políticas escopadas `to authenticated` já o excluem por construção. **O risco real não é "observador escreve" — é alguém escrever uma policy nova sem `to authenticated`/sem checagem de role**, replicando o padrão frouxo que `maq_ativos`/`elet_ativos` já têm hoje (`for update to authenticated using(true)` — qualquer cargo autenticado, sem diferenciar `admin` de `tecnico`, o que é aceitável para o critério de sucesso 10 mas vale registrar como decisão consciente, não acidente) |
| V5 Input Validation | **Sim** | `flora`/`inclinacao`/`limpeza` devem ser `CHECK` por lista fechada no banco (Pattern 3), replicando o padrão de `normalizarTema` (Fase 6) — nunca confiar só na validação client-side do editor. Coordenadas (`lat`/`lon`) devem ter `CHECK` de faixa plausível (ex. `lat between -23 and -22.5`, `lon between -43.3 and -42.9`, aproximando a região do CMASM) para pegar erro de digitação/drag acidental antes de persistir |
| V6 Cryptography | Não aplicável | Nenhum dado sensível novo (geometria de zona de jardinagem e posição de ativo não são segredo) |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Nova policy de escrita esquecendo `to authenticated` (aplicando a `public`/todos os roles por padrão) | Elevation of Privilege | Sempre escrever `for insert/update to authenticated with check (...)`, nunca omitir o `to authenticated` — checklist de revisão da migração, mesmo idioma já usado em `transp_pode_escrever()`/`maq_areas_insert` |
| Coordenada fora da faixa plausível do CMASM gravada por erro de arraste no editor | Tampering | `CHECK` de faixa de lat/lon no banco (V5 acima), não só validação da UI |
| `geom`/atributos de zona sem `CHECK` por lista fechada, aceitando qualquer string | Tampering | `CHECK ... in (...)` nas três colunas de terreno (Pattern 3) |
| Tiles locais servidos do próprio domínio não introduzem superfície de ataque nova (são arquivos estáticos, sem processamento server-side) | — | N/A — mencionado para registrar que foi considerado e descartado como risco |

## Sources

### Primary (HIGH confidence — leitura direta do repositório e das migrações, todas com `arquivo:linha`)
- `.planning/ROADMAP.md` — goal, critérios de sucesso e notas de implementação da Fase 10
- `.planning/REQUIREMENTS.md` — PLAT-13/14/17/18/19/20/15/16
- `.planning/STATE.md` — decisões acumuladas do milestone, incluindo módulos importados fora do fluxo GSD
- `.planning/phases/06-tema-claro-escuro/06-RESEARCH.md` — formato exemplar e confirmação de que `mapa/xmap.css` fica fora do tema (D-01 da Fase 6, ainda válido)
- `CLAUDE.md`, `.claude/CLAUDE.md` — convenções, comandos, "Auth & security" (client-side check é só UX)
- `mapa/xmap.js` (332 linhas, lido por completo) — `registerLayer`, `init`, `toggleBasemap`, `getLeafletMap`
- `mapa/xmap-layers-grama.js`, `-aguada.js`, `-eletrica.js` (lidos por completo) — dados mock, vocabulário de compatibilidade, `renderAreas`/`renderMaquinas`
- `mapa/app.js`, `mapa/index.html` (lidos por completo) — boot, script anti-FOUC, referências CDN
- `DEV_ERP/cmms-mapa/admin.html` (lido por completo, 1299 linhas) — editor legado: `leaflet-draw`, `calcAreaM2`, `calcCompatCliente`, fluxo de API a substituir
- `supabase/12_maquinas_areas_operacoes.sql` (lido por completo) — schema atual de `maq_areas`/`maq_operacoes`, RLS existente
- `supabase/17_predial_schema.sql:35-48`, `19_cmasm_locais_unificado.sql`, `20_cmasm_locais_predios.sql`, `21_vincula_locais_modulos.sql` (lidos) — confirmam ausência de coordenada em `cmasm_locais` e o mecanismo de `local_id`
- `supabase/01_maquinas_schema.sql:85-105`, `22_transportes_planos_rbac.sql:27-48` — idioma de RLS/RBAC já estabelecido
- `shared/auth.js` (lido por completo) — confirma que "Livre"/observador nunca autentica no Supabase
- `vercel.json` — rotas, ausência de `headers` (cache) configurado
- `tests/modulos-caminhos.test.js`, `tests/schema-operacoes-maquinas.test.js` — convenção de teste estático sobre HTML/SQL, sem browser
- `node --test` rodado nesta pesquisa: 58/58 passando (baseline)
- `/home/luc/DEV_reference_readonly/aguada/frontend/painel.html:1194-1197,1626-1627` — precedente de tile local com `maxNativeZoom`, sem fallback online (o que falta esta fase adicionar)
- `find .git` / `du -sh` rodado nesta pesquisa — repo atual ~6 MB de árvore de trabalho / ~7,8 MB de `.git`, para dimensionar o impacto dos ~12 MB de tiles
- `gsd-tools query package-legitimacy check --ecosystem npm leaflet leaflet-draw @geoman-io/leaflet-geoman-free` — todos `OK`
- `npm view leaflet-draw version`, `npm view leaflet version`, `npm view @geoman-io/leaflet-geoman-free version` — versões confirmadas

### Secondary (MEDIUM confidence — busca web/Context7, cruzada com fonte oficial)
- Tile Usage Policy, OSMF Operations Working Group (`operations.osmfoundation.org/policies/tiles`) — proibição de bulk/prefetch
- `github.com/Leaflet/Leaflet/issues/5810`, `leafletjs.com/examples/extending/extending-2-layers.html` — limitação de `errorTileUrl` vs. `createTile`
- `github.com/ghybs/Leaflet.TileLayer.Fallback` — plugin de fallback de zoom (não de provedor)
- `github.com/Leaflet/Leaflet.draw/issues/1041`, `geoman.io/blog/leaflet-geoman-vs-leaflet-draw` — estado de manutenção do `leaflet-draw` e alternativa
- `github.com/ingmapping/docker-mapnik-osm-tiles`, `wiki.openstreetmap.org/wiki/Creating_your_own_tiles`, `wiki.openstreetmap.org/wiki/TileMill` — toolchain de geração de tile
- Context7 `/supabase/supabase` — `create extension postgis with schema "extensions"` (guia oficial de extensões)
- `turfjs.org/docs/api/area`, `github.com/Turfjs/turf/issues/1558` — confirmação cruzada de que a família de fórmula por excesso esférico é o padrão para área geodésica
- Vercel `vercel.com/docs/limits` — limite de 15.000 arquivos por deploy (não bloqueante para ~1.900 tiles)

### Tertiary (LOW confidence)
- Nenhuma

## Metadata

**Confidence breakdown:**
- Standard Stack / Package Legitimacy: HIGH — versões e legitimidade verificadas via `npm view` e `gsd-tools query package-legitimacy check`
- Architecture (posição geográfica, contrato `registerLayer`, RLS): HIGH para os fatos sobre o código/schema atual (citados `arquivo:linha`); a descoberta de que `cmasm_locais` não tem coordenada é o achado mais importante desta pesquisa e foi confirmada por leitura completa de 3 migrações + grep exaustivo
- Tiles (política OSM, toolchain, fallback): MEDIUM — decisões de terceiros (política, estado de manutenção de pacote) via busca web, cruzadas com fonte oficial/GitHub, mas não executadas nesta sessão (nenhum tile foi de fato gerado)
- Área geodésica: MEDIUM — leitura de código HIGH, correção numérica da fórmula não foi verificada por execução nesta sessão (Assumption A2)
- Security Domain: HIGH para o fato "observador nunca autentica" (leitura completa de `shared/auth.js`); MEDIUM para a recomendação de `CHECK` de faixa de coordenada (prática padrão, não específica deste projeto)

**Research date:** 2026-08-12
**Valid until:** ~14 dias para a parte de schema/RLS (estável, análoga às fases 5/6 já fechadas); ~30 dias para a parte de política OSM/estado de pacotes de terceiros (menos provável de mudar rápido, mas não foi verificada por execução)
