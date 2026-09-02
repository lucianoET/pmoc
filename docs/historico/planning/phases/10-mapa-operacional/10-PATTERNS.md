# Fase 10: Mapa operacional — Mapa de Padrões

**Mapeado:** 2026-08-12
**Arquivos analisados:** 9 (6 novos, 3 modificados/expandidos)
**Analogs encontrados:** 9 / 9

Escopo confirmado no ROADMAP.md (D-01..D-04) e 10-RESEARCH.md: `mapa/xmap.js` fica intocado; `xmap-layers-grama.js`/`-eletrica.js` trocam mock por Supabase; `xmap-layers-aguada.js` fica mock por decisão D-01 (fora de escopo, não omissão); editor de zona porta `DEV_ERP/cmms-mapa/admin.html` como modo dentro do próprio `/mapa`; migração aditiva `25_mapa_geometria_posicao.sql`; núcleo puro de geometria/compatibilidade testado em Node, mesmo padrão de `shared/tema.js`.

## File Classification

| Arquivo novo/modificado | Role | Data Flow | Analog mais próximo | Qualidade |
|---|---|---|---|---|
| `mapa/mapa-geometria.js` (NOVO) | utility/module | transform (função pura) | `shared/tema.js` (núcleo puro sem `document`/`window`, exportado, testável em Node) | exact |
| `tests/mapa-geometria.test.js` (NOVO) | test | request-response (assert sobre função pura) | `tests/tema.test.js` | exact |
| `tests/mapa-camadas-escopo.test.js` (NOVO — asserta D-01) | test | request-response (assert estático sobre arquivo) | `tests/tema-superficies.test.js` (afirma exclusão deliberada, não omissão) | exact |
| `mapa/mapa-editor.js` (NOVO — porta `admin.html`) | component/controller | request-response + event-driven (desenho no mapa) | `DEV_ERP/cmms-mapa/admin.html` (READ-ONLY, lógica) + `maquinas/app.js` (idioma de salvar no Supabase) | role-match |
| `mapa/xmap-layers-grama.js` (edição — mock → Supabase) | service/data-layer | CRUD (leitura) | `maquinas/app.js:51-76` (`carregarTudo()`, `Promise.all`) adaptado ao contrato `render(group)` de `mapa/xmap.js:292-307` | role-match |
| `mapa/xmap-layers-eletrica.js` (edição — mock → Supabase, remove camadas sem tabela real) | service/data-layer | CRUD (leitura) | idem `xmap-layers-grama.js` (mesmo contrato) | role-match |
| `mapa/xmap.js` (edição — `TileLocalComFallback`, só no basemap `map`) | component | event-driven (tile load/error) | `/home/luc/DEV_reference_readonly/aguada/frontend/painel.html:1194-1197,1626-1627` (tile local com `maxNativeZoom`, sem fallback — falta acrescentar) | partial-match |
| `supabase/25_mapa_geometria_posicao.sql` (NOVO) | migration | batch (DDL) | `supabase/12_maquinas_areas_operacoes.sql` (schema atual de `maq_areas`, idioma de RLS) + `supabase/22_transportes_planos_rbac.sql` (função `*_pode_escrever()`) | exact |
| `TESTES.md` (edição — roteiro manual) | doc | — | seções já existentes do arquivo (não lidas nesta passada — seguir o padrão de checklist manual já estabelecido) | role-match |

## Pattern Assignments

### `mapa/mapa-geometria.js` (NOVO)

**Analog de estrutura:** `shared/tema.js` inteiro — núcleo puro sem `document`/`window`/`localStorage`, exportado via ES module, importável tanto pelo browser quanto pelo `node --test`.

**Cabeçalho e restrição estrutural a replicar** (`shared/tema.js:1-19`):
```javascript
// ══════════════════════════════════════════════════════════════════
// [nome do módulo] — [propósito]
//
// Núcleo puro (funções X, Y) — sem document/window/localStorage/
// matchMedia — separado dos aplicadores de navegador, mesma divisão
// que shared/shell.js já usa entre montarShell/aplicarShell.
//
// Restrição estrutural: nada roda no escopo de topo além de declarar
// constantes e funções — outros arquivos importam este módulo dentro
// do Node para teste; qualquer acesso a API de navegador no momento
// do import quebraria os testes que hoje passam.
// ══════════════════════════════════════════════════════════════════
export const ALGO = [...]
export function funcaoPura(valor) { ... }
```

**Fórmula de área a portar como está** (`DEV_ERP/cmms-mapa/admin.html:1269-1282`, READ-ONLY — copiar, não reescrever, conforme Assumption A2 do RESEARCH):
```javascript
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

**Compatibilidade de máquinas a portar, com normalização nova** (`DEV_ERP/cmms-mapa/admin.html:1009-1026`, mais função nova exigida pelo Pitfall 1 do RESEARCH — vocabulário de `maq_ativos.categoria` não bate com o do legado):
```javascript
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

// NOVO — mapeia supabase/02_maquinas_seed.sql:44-51 (categoria real:
// rocadeira, motoserra, minitrator, trator) para o vocabulário acima
// (roçadeira com cedilha, motosserra dois "s") — sem isso a lista de
// máquinas compatíveis fica sempre vazia mesmo com máquinas reais.
function normalizarCategoria(categoria) {
  const mapa = { rocadeira: 'roçadeira', motoserra: 'motosserra' }
  return mapa[categoria] || categoria // minitrator/trator: decisão de planejamento
}
```

**Validação contra lista fechada — mesmo idioma de `normalizarTema`** (`shared/tema.js`, bloco "núcleo puro"):
```javascript
// mesmo espírito de normalizarTema(valor): comparação estrita contra
// lista fechada, sem trim, sem conversão de caixa — ASVS V5
export function normalizarFlora(valor) {
  const FLORAS = ['gramado', 'capim_colonial', 'mata_fechada']
  return FLORAS.includes(valor) ? valor : null
}
```

---

### `tests/mapa-geometria.test.js` (NOVO)

**Analog:** `tests/tema.test.js` inteiro — `require('node:assert/strict')`, `require('node:test')`, `const modulo = import('../mapa/mapa-geometria.js')`, um `test()` por comportamento.

```javascript
// tests/tema.test.js:1-16 — padrão exato a replicar
const assert = require('node:assert/strict')
const test = require('node:test')

const modulo = import('../mapa/mapa-geometria.js')

test('normalizarFlora aceita só os três valores da lista fechada', async () => {
  const { normalizarFlora } = await modulo
  assert.equal(normalizarFlora('gramado'), 'gramado')
  assert.equal(normalizarFlora('inventado'), null)
})
```

**Caso obrigatório citado no RESEARCH.md (Assumption A2):** um polígono de área conhecida (ex. um quadrado pequeno de lado calculável) testado contra `calcAreaM2` — é a única forma de confirmar numericamente a fórmula portada, que não foi executada na pesquisa.

**Caso obrigatório do Pitfall 1:** `calcCompatCliente` alimentado com uma categoria real do banco (`rocadeira`) passada por `normalizarCategoria` primeiro, confirmando que a lista de compatíveis não fica vazia.

---

### `tests/mapa-camadas-escopo.test.js` (NOVO) — assere D-01 como teste, não omissão

**Analog:** `tests/tema-superficies.test.js` inteiro — é o precedente direto de "decisão de exclusão vira teste" (D-01/D-05 da Fase 6, agora D-01 desta fase).

```javascript
// tests/tema-superficies.test.js:1-25 — estrutura a replicar: comentário
// de cabeçalho explicando POR QUE o arquivo fica fora, RAIZ resolvida a
// partir de __dirname, leitura direta do arquivo-alvo
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const RAIZ = path.join(__dirname, '..')
const AGUADA = path.join(RAIZ, 'mapa', 'xmap-layers-aguada.js')

test('xmap-layers-aguada.js permanece mock por decisao D-01 — nao busca no Supabase', () => {
  const conteudo = fs.readFileSync(AGUADA, 'utf8')
  assert.doesNotMatch(conteudo, /supa\.from\(/, 'aguada deveria continuar mock (D-01), nao ganhar leitura Supabase nesta fase')
})
```

**Por que este teste existe:** mesmo raciocínio do `tests/tema-superficies.test.js` (ver `06-PATTERNS.md`) — sem ele, um desenvolvedor futuro pode "consertar" `-aguada.js` para bater com `-grama.js`/`-eletrica.js` sem saber que a exclusão foi deliberada (sistema externo MQTT/FastAPI, ver ROADMAP D-01), silenciosamente contrariando a decisão travada.

---

### `mapa/mapa-editor.js` (NOVO) — porta `admin.html` como modo do `/mapa`

**Analog de lógica (READ-ONLY, só ler/copiar trechos):** `DEV_ERP/cmms-mapa/admin.html`

**Setup do `leaflet-draw`, a portar quase como está** (`admin.html:745-760`):
```javascript
drawnItems = new L.FeatureGroup().addTo(map);

drawControl = new L.Control.Draw({
  draw: {
    polygon: {
      allowIntersection: false,
      shapeOptions: { color: '#00b4d8', fillColor: '#00b4d8', fillOpacity: 0.15, weight: 2 },
    },
    polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false,
  },
  edit: { featureGroup: drawnItems, edit: false, remove: false },
});

map.on(L.Draw.Event.CREATED, onPolygonCreated);
```
Trocar `map` por `xMap.getLeafletMap()` (`mapa/xmap.js:325`, já exposto) — não criar uma segunda instância de `L.Map`, conforme Pattern 4 do RESEARCH.

**Padrão de salvamento a SUBSTITUIR (não copiar o `fetch`)** — o legado fala com o backend Node inexistente (`admin.html:675,1167-1180`):
```javascript
// NÃO portar — API local inexistente neste projeto
const API = 'http://localhost:8010/api/grama';
const r = await fetch(`${API}/areas`, { method: 'POST', headers: {...}, body: JSON.stringify({...}) });
if (!r.ok) throw new Error(await r.text());
```
Trocar pelo idioma Supabase já usado em `maquinas/app.js:815-829` (`salvarArea()`), adaptado às colunas novas de geometria:
```javascript
// maquinas/app.js:815-829 — idioma de salvar a seguir (erro Supabase, não fetch/toast)
async function salvarArea(){
  const nome = document.getElementById('area-nome').value.trim()
  if(!nome){ alert('Informe o nome da área.'); return }
  const { error } = await supa.from('maq_areas').insert({
    codigo: document.getElementById('area-codigo').value.trim().toUpperCase() || null,
    nome,
    tipo: document.getElementById('area-tipo').value,
    area_m2: parseFloat(document.getElementById('area-m2').value) || null,
    // ...
  })
  if(error){ alert('Erro ao salvar área: '+error.message); return }
  fecharModal('modal-area'); await carregarTudo()
}
```
No editor novo, a diferença é que `area_m2`/`geom` vêm de `calcAreaM2(coords)`/`JSON.stringify(coords)` (portados de `mapa-geometria.js`), não de um campo de formulário digitado — mas o idioma de erro (`if(error){ alert(...); return }`) e o "salvar e recarregar" (`await carregarTudo()`) devem seguir `maquinas/app.js`, não o `try/catch` + `toast()` do legado.

**Visibilidade condicionada por `role` (Pattern 4 do RESEARCH, esboço a seguir):**
```javascript
// mapa/app.js — boot já existente, mesmo formato de import de mapa-editor.js
import { iniciarEditor } from './mapa-editor.js'

function mostrarApp() {
  // ...existente...
  if (['admin','gestor','tecnico'].includes(USUARIO?.role)) {
    iniciarEditor(xMap.getLeafletMap(), supa, USUARIO)
  }
}
```

---

### `mapa/xmap-layers-grama.js` / `mapa/xmap-layers-eletrica.js` (edição — mock → Supabase)

**Analog do contrato a preservar, INTOCADO:** `mapa/xmap.js:292-307` (`registerLayer`):
```javascript
registerLayer(moduleName, layerDefs) {
  if (!_registeredLayers[moduleName]) _registeredLayers[moduleName] = {};
  Object.entries(layerDefs).forEach(([key, def]) => {
    const group = L.layerGroup();
    def.render(group);   // pode virar async sem quebrar a assinatura
    _registeredLayers[moduleName][key] = { group, def };
    if (_activeModules.includes(moduleName)) {
      if (!_filterState[moduleName]) _filterState[moduleName] = {};
      if (_filterState[moduleName][key] !== false) _map.addLayer(group);
      _renderFilters();
    }
  });
},
```

**Analog de carga de dados:** `maquinas/app.js:51-76` (`carregarTudo()`), adaptado ao formato `async function carregarX() { const {data,error} = await supa.from(...).select(...); if(error){...; return []} return data }` já esboçado em `10-RESEARCH.md` Pattern 1:
```javascript
// mapa/xmap-layers-grama.js — esboço, ver 10-RESEARCH.md Pattern 1 linhas 169-200
async function carregarAreas() {
  const { data, error } = await supa.from('maq_areas').select('*').eq('ativo', true)
  if (error) { console.error('maq_areas:', error.message); return [] }
  return data
}
```

**Estrutura atual a preservar (mock a substituir, não a função `render`/`popupHTML`):** `mapa/xmap-layers-grama.js:1-56` — `renderAreas`/`renderMaquinas`/estilos por tipo continuam iguais, só a fonte do array muda de `MOCK_AREAS`/`MOCK_MAQUINAS` para o retorno de `carregarAreas()`/`carregarMaquinasPosicionadas()`.

**Para `xmap-layers-eletrica.js`:** remover `RAMAIS` (sem tabela real, `admin.html`/RESEARCH Pattern 1) e trocar `GERADORES`/`TRANSFORMADORES`/`QUADROS` mock por leitura de `elet_ativos` — decisão de escopo já registrada no RESEARCH como Open Question 1, resolvida a favor de "plotar só o que existe" (não inventar tabela nova).

**Analog de erro assíncrono dentro de `render()` (Pitfall 3 do RESEARCH — `registerLayer` não espera `render` async):** replicar o idioma padrão do projeto (`if(error){ alert/console.error; return }`), não deixar o mapa silenciosamente vazio.

---

### `mapa/xmap.js` (edição — `TileLocalComFallback`)

**Analog parcial (tile local sem fallback):** `/home/luc/DEV_reference_readonly/aguada/frontend/painel.html:1194-1197,1626-1627` (READ-ONLY) — usa `maxNativeZoom` menor que `maxZoom` para deixar o Leaflet reamostrar; falta exatamente o `createTile` com fallback que esta fase acrescenta.

**Trecho atual a estender, sem tocar o satélite** (`mapa/xmap.js:19-30`):
```javascript
const TILES = {
  map: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19,
  },
};
```

**Esboço de `createTile` a inserir (só para `map`, nunca para `satellite` — Pitfall 4 do RESEARCH):**
```javascript
const TileLocalComFallback = L.TileLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement('img')
    const localUrl  = L.Util.template(this._url, this._getTileData(coords))
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
```
(fonte: `10-RESEARCH.md` Pattern 6, já validado contra as três abordagens do Leaflet — `errorTileUrl` e `Leaflet.TileLayer.Fallback` descartados, ver RESEARCH.)

---

### `supabase/25_mapa_geometria_posicao.sql` (NOVO)

**Próximo número livre confirmado:** `ls supabase/` mostra até `24_transportes_inventario_completo.sql` → esta migração é `25_`.

**Analog de schema aditivo a `maq_areas`:** `supabase/12_maquinas_areas_operacoes.sql:1-15` (criação original) — a migração 25 usa `alter table ... add column if not exists`, nunca recriando a tabela:
```sql
-- 12_maquinas_areas_operacoes.sql:1-15 — tabela original que esta fase estende
create table if not exists maq_areas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nome text not null,
  tipo text not null default 'corte'
    check (tipo in ('corte','poda','limpeza','mista','outro')),
  area_m2 numeric check (area_m2 is null or area_m2 >= 0),
  ...
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
```

**Esboço aditivo (do 10-RESEARCH.md Pattern 3, colunas de geometria/terreno):**
```sql
alter table maq_areas add column if not exists geom jsonb;
alter table maq_areas add column if not exists flora text
  check (flora is null or flora in ('gramado','capim_colonial','mata_fechada'));
alter table maq_areas add column if not exists inclinacao text
  check (inclinacao is null or inclinacao in ('plano','moderado','acentuado'));
alter table maq_areas add column if not exists limpeza text
  check (limpeza is null or limpeza in ('limpa','media','densa'));
```

**Esboço aditivo (Pattern 2, posição em duas camadas):**
```sql
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

**Analog de RLS/RBAC a reaproveitar, não reinventar:** `supabase/22_transportes_planos_rbac.sql:11-40` (`transp_pode_escrever()`, `security definer`, `set search_path = public`, `revoke ... grant execute ... to authenticated`) — mesma forma para qualquer policy nova que a migração 25 precisar (ex. `CHECK` de faixa de lat/lon citado no RESEARCH Security Domain, V4/V5). As colunas novas em `maq_areas`/`maq_ativos`/`transp_ativos`/`elet_ativos`/`equipamentos` herdam as policies de escrita já existentes de cada tabela (`maq_areas_insert`/`maq_areas_update` em `12_maquinas_areas_operacoes.sql:42-58`, já `to authenticated` com checagem de `role`); `cmasm_locais` precisa de policy de escrita nova seguindo o mesmo idioma se ainda não tiver uma restrita a `authenticated`.

```sql
-- 12_maquinas_areas_operacoes.sql:42-49 — idioma de policy a reaproveitar,
-- não reescrever: "to authenticated with check (exists (select 1 from
-- usuarios where auth_id=auth.uid() and ativo=true and role in (...)))"
create policy maq_areas_insert on maq_areas for insert to authenticated with check (
  exists (select 1 from usuarios where auth_id=auth.uid() and ativo=true and role in ('admin','gestor'))
);
```

## Shared Patterns

### Núcleo puro / aplicador de navegador
**Fonte:** `shared/tema.js` inteiro (núcleo: `normalizarTema`, `proximoTema`; aplicadores: `detectarTema`, `aplicarTema`, `alternarTema`, `iniciarTema`)
**Aplicar a:** `mapa/mapa-geometria.js` inteiro — `calcAreaM2`, `calcCompatCliente`, `normalizarCategoria`, `normalizarFlora`/`normalizarInclinacao`/`normalizarLimpeza` são núcleo puro; qualquer função que chame `L.` (Leaflet) ou `document` fica em `mapa-editor.js`, nunca em `mapa-geometria.js`.

### Decisão de exclusão de escopo vira teste, não comentário
**Fonte:** `tests/tema-superficies.test.js` (D-01/D-05 da Fase 6)
**Aplicar a:** `tests/mapa-camadas-escopo.test.js` — D-01 desta fase (`xmap-layers-aguada.js` continua mock).

### `carregarTudo()` + array `UPPER_CASE` + `Promise.all`
**Fonte:** `maquinas/app.js:51-76`
**Aplicar a:** funções `carregarAreas()`/`carregarMaquinasPosicionadas()`/`carregarAtivosPosicionados()` dentro de `xmap-layers-grama.js`/`-eletrica.js` e `mapa-editor.js` — mesmo idioma de `Promise.all` + checagem de `error` por query, adaptado ao contrato assíncrono de `render(group)`.

### Erro Supabase — idioma único do projeto
**Fonte:** `CLAUDE.md` ("Supabase error handling idiom") e `maquinas/app.js:815-829`
**Aplicar a:** todo `insert`/`update` novo em `mapa-editor.js` — `const { error } = await supa.from(...)...; if(error){ alert('Erro: '+error.message); return }`. Nunca portar o `try { fetch } catch { toast(...) }` do legado.

### RLS write predicate `to authenticated` + checagem de `role`
**Fonte:** `supabase/12_maquinas_areas_operacoes.sql:42-58`, `supabase/22_transportes_planos_rbac.sql:27-48`
**Aplicar a:** qualquer policy nova em `supabase/25_mapa_geometria_posicao.sql` — nunca omitir `to authenticated` (Security Domain do RESEARCH, "Elevation of Privilege" é o risco real, não o observador, que já opera como `anon` por construção — `shared/auth.js:210-217`).

### Caminho de asset root-absoluto sob `mapa/`
**Fonte:** `tests/modulos-caminhos.test.js` inteiro (comentário de cabeçalho + função `referenciasLocais`)
**Aplicar a:** qualquer `<script src=...>`/`<link href=...>` novo adicionado a `mapa/index.html` (ex. `leaflet-draw` já vem de CDN, não sujeito; mas qualquer asset próprio novo, como um eventual `mapa/mapa-editor.js` referenciado por `<script type="module" src="...">`, precisa ser `/mapa/mapa-editor.js` ou `./mapa-editor.js` importado de dentro de `mapa/app.js` via ES module — nunca `src="mapa-editor.js"` solto no HTML). Tiles em `mapa/tiles/{z}/{x}/{y}.png` são consumidos via template JS (`L.Util.template`), não via atributo HTML — não caem no gate deste teste, mas o teste continua rodando sobre `mapa/index.html` e deve ser reexecutado (`node --test tests/modulos-caminhos.test.js`) depois de qualquer edição ao `<head>`/`<body>` do módulo.

## Sem Analog Encontrado

Nenhum arquivo desta fase ficou totalmente sem analog. O único item com correspondência parcial é `mapa/xmap.js` (`TileLocalComFallback`) — o precedente do `aguada` cobre só a metade "tile local com `maxNativeZoom`", não a metade "fallback para outro provedor"; a lógica de `createTile` com dois `src` (Pattern 6 do RESEARCH) não tem precedente direto no repositório, só o esboço já validado no próprio 10-RESEARCH.md.

| Arquivo | Role | Data Flow | Motivo |
|---|---|---|---|
| `mapa/tiles/{z}/{x}/{y}.png` (geração de tiles) | static asset | batch | Fora do escopo de código-fonte deste mapa de padrões — geração via Mapnik/toolchain externa (10-RESEARCH.md Pattern 7), não há analog de código a copiar; decisão de planejamento pendente (Open Question 3 do RESEARCH) |

## Metadata

**Escopo de busca:** `mapa/`, `shared/tema.js`, `maquinas/app.js`, `supabase/*.sql` (12, 22, 24), `tests/tema.test.js`, `tests/tema-superficies.test.js`, `tests/modulos-caminhos.test.js`, `DEV_ERP/cmms-mapa/admin.html` (READ-ONLY)
**Arquivos lidos por completo:** `shared/tema.js` (143 linhas), `tests/tema.test.js`, `tests/tema-superficies.test.js`, `tests/modulos-caminhos.test.js`, `mapa/app.js` (trecho de boot), `supabase/12_maquinas_areas_operacoes.sql`, `supabase/22_transportes_planos_rbac.sql` (trecho)
**Arquivos lidos por trecho:** `mapa/xmap.js` (init + `registerLayer`), `mapa/xmap-layers-grama.js`/`-eletrica.js`/`-aguada.js` (cabeçalhos e dados mock), `maquinas/app.js` (`carregarTudo`, `salvarAtivo`, `salvarArea`), `DEV_ERP/cmms-mapa/admin.html` (`leaflet-draw` setup, `calcAreaM2`, `calcCompatCliente`, fluxo `fetch`), `/home/luc/DEV_reference_readonly/aguada/frontend/painel.html` (citado no RESEARCH, não relido nesta passada)
**Próximo número de migração confirmado:** `25_` (após `24_transportes_inventario_completo.sql`)
**Data de extração:** 2026-08-12
