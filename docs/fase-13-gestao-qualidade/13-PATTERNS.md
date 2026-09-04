# Fase 13: Gestão e Qualidade — Mapa de Padrões

**Mapeado:** 2026-09-04
**Arquivos analisados:** 20 (Onda A: 11 · Onda B: 6 · Onda C: 3, mapeada de forma mais breve)
**Análogos encontrados:** 18 / 20

## Classificação dos arquivos

| Arquivo novo/modificado | Papel | Fluxo de dados | Análogo mais próximo | Qualidade do match |
|---|---|---|---|---|
| `shared/grafico.js` | utilitário (núcleo puro → SVG) | transform | `shared/componentes.js` (peça pura → HTML) | papel exato |
| `shared/indicadores.js` | utilitário (núcleo puro → HTML) | transform | `shared/componentes.js` + `shared/fluxo.js` | papel exato |
| `shared/gantt.js` | utilitário (núcleo puro → HTML) | transform | `shared/componentes.js` | papel exato |
| `shared/abc.js` | utilitário (núcleo puro, sem HTML) | batch/transform | `shared/tabela.js` (núcleo por definição de campo) | papel exato |
| `shared/kanban.js` | utilitário (núcleo puro, extraído) | transform | `maquinas/operacoes.js` (`agruparOperacoes`, `STATUS_KANBAN`) + `shared/tabela.js` (padrão de extração p/ shared) | papel exato |
| `shared/calendario.js` | utilitário (núcleo puro, extraído) | transform | `maquinas/app.js#renderAgenda` (~L1157) + `maquinas/operacoes.js#criarEventosCalendario` | papel exato |
| `shared/gut.js` | utilitário (núcleo puro, extraído) | transform | `predial/dominio.js` (`GUT_ESCALA`, `classificarGut`) + `shared/arvore.js` (precedente de extração+reexport) | papel exato |
| `maquinas/operacoes.js` (modificado) | utilitário UMD, agora fachada | transform | ele mesmo (padrão UMD atual) | — refatoração |
| `maquinas/app.js` (modificado, `renderOperacoes`/`renderAgenda`/`navegarAgenda`) | componente (render) | request-response (DOM) | ele mesmo | — refatoração |
| `maquinas/index.html` (modificado, CSS) | config/estilo | — | `shared/pmoc.css` (destino) vs. `.pilula`/`.regua` (precedente de migração de CSS) | papel exato |
| `predial/dominio.js` (modificado) | utilitário, agora reexport | transform | `predial/dominio.js` linha `export { montarArvore, linhasVisiveis } from '../shared/arvore.js'` (precedente literal, já no próprio arquivo) | papel exato |
| `shared/pmoc.css` (modificado) | config/estilo | — | trecho `.pilula`/`.regua`/`.kpi` já existente | papel exato |
| `tests/grafico-compartilhado.test.js` | test | transform | `tests/tabela-compartilhada.test.js` | papel exato |
| `tests/indicadores-compartilhados.test.js` | test | transform | `tests/tabela-compartilhada.test.js` | papel exato |
| `tests/gantt-compartilhado.test.js` | test | transform | `tests/tabela-compartilhada.test.js` | papel exato |
| `tests/abc-compartilhado.test.js` | test | transform | `tests/tabela-compartilhada.test.js` | papel exato |
| `tests/operacoes-maquinas.test.js` (intocado) | test | transform | ele mesmo — contrato a preservar | — |
| `tests/predial-dominio.test.js` (intocado) | test | transform | ele mesmo — contrato a preservar | — |
| `gestao/index.html` + `gestao/app.js` (Onda B) | componente + serviço (app inteiro) | CRUD + request-response | `transportes/index.html` + `transportes/app.js` | papel exato |
| `supabase/60_gestao_schema.sql` (Onda B) | migration | CRUD | `supabase/44_refrigeracao_estoque.sql` + `supabase/38_maquinas_contratacoes.sql` | papel exato |

## Atribuições de padrão

### `shared/grafico.js` (utilitário, transform → SVG)

**Análogo:** `shared/componentes.js` (peça pura que devolve HTML/SVG) + `shared/icones.js` (SVG inline em `currentColor`, sem cor em JS)

**Cabeçalho de arquivo — estilo-ensaio a copiar** (`shared/componentes.js` linhas 1-20):
```js
// ══════════════════════════════════════════════════════════════════
// shared/componentes.js — peças de tela repetidas nos módulos, em um
// lugar só.
//
// (1) O que entra aqui: ... (justificativa do porquê existe)
// (2) Funções PURAS que devolvem texto. Não tocam no DOM...
// (3) Nenhuma cor escrita aqui. `tom` é o nome de um tom semântico
// (info/ok/warn/erro/neutro) resolvido pela folha comum...
// ══════════════════════════════════════════════════════════════════
```
`shared/grafico.js` deve abrir com o mesmo formato de três parágrafos numerados: por que existe, o que não faz (nenhuma lib de gráfico, nenhum canvas — D-13-01/D-13-04), e a regra de tom semântico.

**Padrão de tom semântico e escape** (`shared/componentes.js` linhas 22-45):
```js
const TONS = ['neutro', 'info', 'ok', 'warn', 'erro']

function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({...})[c])
}

function tomValido(tom) {
  return TONS.includes(tom) ? tom : 'neutro'
}

export function pilula(rotulo, tom = 'neutro') {
  return `<span class="pilula pilula-${tomValido(tom)}">${esc(rotulo)}</span>`
}
```
`grafico.js` deve reusar exatamente essa mesma lista `TONS` e a mesma queda defensiva para `'neutro'` — nenhuma cor literal, classe `class="grafico-barra grafico-barra-${tomValido(tom)}"` etc.

**Padrão de ícone/SVG monocromático** (`shared/icones.js` linhas 20-24 e 80-85):
```js
// (2) Monocromático de propósito: todo traço usa `currentColor`...
export function icone(nome, opcoes = {}) {
  if (!existeIcone(nome)) return ''
  const classe = opcoes.classe || 'ico'
  const tamanho = opcoes.tamanho || 18
  return `<svg class="${classe}" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ...>${TRACOS[nome]}</svg>`
}
```
Copiar a forma do invólucro `<svg ... stroke="currentColor">` para barras/linha/sparkline; nome desconhecido/dado inválido devolve string vazia ou lista vazia, nunca lança (mesma regra de `icone()`).

---

### `shared/indicadores.js` (utilitário, transform → HTML)

**Análogo:** `shared/componentes.js` (peça pura com `tom`) — reusar `pilula()` e o vocabulário de tom para o semáforo do KPI.

**Padrão de definição por objeto de configuração** (equivalente ao papel de `colunas` em `shared/tabela.js`, linhas 1-16):
```js
// Núcleo puro de ordenação e filtro de tabela, genérico por definição
// de colunas... Nenhum nome de campo de material ou de reparo pode
// aparecer neste arquivo — a definição de colunas é sempre parâmetro,
// nunca constante interna.
```
`indicadores.js` deve seguir a mesma regra: a definição do indicador (`{id, rotulo, unidade, meta, sentido, faixas}`) é sempre parâmetro de `avaliar(valor, def)`, nunca uma lista de indicadores concretos escrita no núcleo (isso caberia em `gestao/app.js`).

**Assinatura recomendada, no estilo de `shared/fluxo.js` (funções puras encadeáveis, várias pequenas, um arquivo):**
```js
export function avaliar(valor, def) { ... }      // → tom
export function tendencia(serie) { ... }          // → 'subindo'|'descendo'|'estavel'
export function cartaoIndicador(def, valor, serie) { ... } // → HTML com .kpi + pilula + sparkline
```

---

### `shared/gantt.js` (utilitário, transform → HTML, CSS grid)

**Análogo:** `shared/componentes.js` (retorno HTML puro) — nenhuma lib, nenhum canvas (D-03/D-13-04).

**Padrão de posição percentual/data — usar o mesmo tratamento de "sem fim usa hoje" já usado em `criarEventosCalendario`** (`maquinas/operacoes.js` linhas 24-35):
```js
function criarEventosCalendario(operacoes, ordensServico, ano, mes) {
  const prefixo = `${ano}-${String(mes + 1).padStart(2, '0')}`
  ...
  return [...eventosOperacoes, ...eventosOS]
    .filter(evento => evento.data?.startsWith(prefixo))
    .sort((primeiro, segundo) => primeiro.data.localeCompare(segundo.data))
}
```
`linhasGantt(itens, {inicio, fim})` deve seguir o mesmo estilo funcional puro (map + filter + sort, comparação de string de data ISO com `localeCompare`, sem `Date` além do necessário para % de posição).

---

### `shared/abc.js` (utilitário, batch/transform, sem HTML)

**Análogo:** `shared/tabela.js` — núcleo genérico por definição de campo, sem vocabulário de domínio.

**Trecho a copiar como modelo de "genérico por parâmetro"** (`shared/tabela.js` linhas 45-58, `comparar`):
```js
export function comparar(a, b, coluna, dir, colunas) {
  const col = (colunas || []).find(c => c.id === coluna)
  if (!col) return 0
  if (col.tipo === 'numero') {
    const va = col.valor(a)
    ...
  }
}
```
`classificarAbc(itens, campoValor, cortes=[0.8,0.95])` deve receber `campoValor` como função acessora (`item => item.valor`) ou nome de campo — nunca hardcoded `equipamento.custo` — mesma disciplina que impede `shared/tabela.js` de conhecer "material" ou "reparo".

---

### `shared/kanban.js` (utilitário, extraído de `maquinas/operacoes.js`)

**Análogo direto:** `maquinas/operacoes.js` inteiro (50 linhas) — é o próprio código-fonte a mover.

**Trecho a extrair, byte a byte na lógica** (`maquinas/operacoes.js` linhas 6-21):
```js
const STATUS_KANBAN = ['programada', 'em_execucao', 'concluida', 'cancelada']

function agruparOperacoes(operacoes) {
  const grupos = Object.fromEntries(STATUS_KANBAN.map(status => [status, []]))
  for (const operacao of operacoes) {
    const status = STATUS_KANBAN.includes(operacao.status) ? operacao.status : 'programada'
    grupos[status].push(operacao)
  }
  return grupos
}
```
D-06 pede que isso vire genérico por definição de colunas (mesmo `col.id`/`col.rotulo` do padrão `shared/tabela.js`) em vez do `STATUS_KANBAN` fixo — a versão em `shared/kanban.js` deve aceitar a lista de colunas como parâmetro; `STATUS_KANBAN` continua em `maquinas/operacoes.js` como a definição concreta passada para a função genérica.

**Restrição estrutural importante para o planner:** `maquinas/operacoes.js` é carregado por `<script src="/maquinas/operacoes.js">` **clássico** (não `type="module"`) em `maquinas/index.html` linha 994, enquanto `maquinas/app.js` é `<script type="module">` (linha 995) e já importa de `shared/` com `import` ES (`maquinas/app.js` linhas 1-3). Um script clássico não pode `import` um módulo ES diretamente. Duas saídas compatíveis com D-08 (gates intocados): (a) `maquinas/operacoes.js` continua UMD e duplica/chama a lógica pura sem importar ES — não atende D-06 de fato subir para `shared/`; ou (b) `maquinas/index.html` muda a tag de `operacoes.js` para `type="module"` e o UMD vira um módulo ES que importa de `shared/kanban.js` e ainda expõe `root.OperacoesMaq` para compatibilidade — a escolha fica a critério do planner (Claude's Discretion, CONTEXT.md), mas **precisa ser resolvida explicitamente** porque afeta se `tests/operacoes-maquinas.test.js` (que faz `require(moduloPath)` sobre `maquinas/operacoes.js`, CommonJS) continua funcionando.

**Padrão de teste a preservar (`tests/operacoes-maquinas.test.js` linhas 1-34):**
```js
const moduloPath = path.join(__dirname, '..', 'maquinas', 'operacoes.js')
test('agrupa operações nas colunas do kanban', () => {
  const { agruparOperacoes } = require(moduloPath)
  const grupos = agruparOperacoes([...])
  assert.deepEqual(grupos.programada.map(item => item.id), [1, 5])
  ...
})
```
Esse `require()` é CommonJS síncrono — se `operacoes.js` virar `type="module"` puro, `require()` quebra em Node (a menos que o arquivo continue com o wrapper UMD que também popula `module.exports`, como já faz hoje nas linhas 1-4).

---

### `shared/calendario.js` (utilitário, extraído de `maquinas/app.js` + `operacoes.js`)

**Análogo direto:** `maquinas/app.js#renderAgenda`/`navegarAgenda` (linhas 1157-1183) + `maquinas/operacoes.js#criarEventosCalendario` (linhas 24-35).

**Trecho de `renderAgenda` a decompor em núcleo puro + aplicador DOM** (`maquinas/app.js` linhas 1157-1176):
```js
function renderAgenda(){
  const calendario = document.getElementById('agenda-calendario')
  ...
  const eventos = OperacoesMaq.criarEventosCalendario(OPERACOES,OS_LIST,AGENDA_ANO,AGENDA_MES)
  const porData = eventos.reduce((grupos,evento)=>{ (grupos[evento.data] ||= []).push(evento); return grupos },{})
  const primeiroDia = new Date(AGENDA_ANO,AGENDA_MES,1).getDay()
  const totalDias = new Date(AGENDA_ANO,AGENDA_MES+1,0).getDate()
  const cabecalho = ['Dom','Seg',...].map(dia=>`<div class="calendar-weekday">${dia}</div>`).join('')
  let dias = '<div class="calendar-day is-empty"></div>'.repeat(primeiroDia)
  for(let dia=1;dia<=totalDias;dia++){ ... }
  calendario.innerHTML = cabecalho+dias
}
```
`shared/calendario.js#gradeMes(ano, mes)` deve extrair exatamente a parte pura (primeiro dia da semana, total de dias, geração da grade) sem tocar `document`; `agruparPorData(eventos)` extrai o `reduce`; `htmlCalendario(...)` monta o HTML puro (cabeçalho + `.calendar-day`), devolvendo string — `maquinas/app.js#renderAgenda` fica só como aplicador (`calendario.innerHTML = shared.htmlCalendario(...)`). Mesma decomposição núcleo/DOM de `shared/tema.js` (pure `normalizarTema`/`proximoTema` vs. DOM `aplicarTema`/`iniciarTema`).

---

### `shared/gut.js` (utilitário, extraído de `predial/dominio.js`)

**Análogo direto e precedente literal, no mesmo arquivo** (`predial/dominio.js`, arquivo inteiro, 21 linhas):
```js
export const GUT_ESCALA = [0, 1, 3, 6, 8, 10]

export function classificarGut(total) {
  if (total > 400) return 'critico'
  if (total > 100) return 'atencao'
  return 'ok'
}

// A árvore de locais virou registro compartilhado; as funções vivem em
// shared/arvore.js e são reexportadas aqui para quem já importava daqui.
export { montarArvore, linhasVisiveis } from '../shared/arvore.js'
```
Este é literalmente o padrão a repetir: mover `GUT_ESCALA`/`classificarGut` (mais o novo `gutTotal(g,u,t)`) para `shared/gut.js`, e `predial/dominio.js` passa a ter:
```js
export { GUT_ESCALA, classificarGut, gutTotal } from '../shared/gut.js'
```
— comentário explicando o porquê, no mesmo estilo da linha já existente sobre `arvore.js`.

**Padrão de teste a preservar (`tests/predial-dominio.test.js` linhas 1-13):**
```js
const dominio = import('../predial/dominio.js')   // import() dinâmico — ES module

test('classifica o total GUT nas faixas do legado', async () => {
  const { classificarGut } = await dominio
  assert.equal(classificarGut(0), 'ok')
  ...
})
```
Como o teste já usa `import()` dinâmico (não `require`), o reexport de `predial/dominio.js` a partir de `shared/gut.js` não quebra nada — `predial/dominio.js` já é ES module puro (sem UMD), diferente de `maquinas/operacoes.js`.

---

### `maquinas/index.html` (CSS `.calendar-*`/`.kanban` → `shared/pmoc.css`)

**Trecho a mover** (`maquinas/index.html` linhas 82-98):
```css
.calendar-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.calendar-title{font-size:15px;font-weight:700;color:var(--text)}
.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(86px,1fr));gap:1px;background:var(--border);border:1px solid var(--border);overflow:auto}
...
```
Só tokens já existentes (`var(--text)`, `var(--border)`, `var(--yellow)`, `var(--blue)`) — nenhum token novo, respeitando `tests/tema-superficies.test.js`. Precedente de migração de CSS módulo→compartilhado: `.pilula`/`.regua`/`.kpi` já vivem em `shared/pmoc.css` desde que `componentes.js` nasceu (citado em CONTEXT.md D-10) — buscar essas classes em `shared/pmoc.css` para copiar o formato de comentário de seção antes do bloco novo.

---

### Gates novos: `tests/*-compartilhado.test.js`

**Análogo de estrutura de teste** (`tests/tabela-compartilhada.test.js` linhas 1-20):
```js
const assert = require('node:assert/strict')
const test = require('node:test')

// Gate do núcleo genérico de ... — cobre só o que é genérico...
const {
  proximaOrdem, normalizarBusca, comparar, aplicarOrdemEFiltro,
} = require('../shared/tabela.js')

test('importar shared/tabela.js em Node puro não lança', () => {
  assert.ok(proximaOrdem)
  ...
})
```
`shared/tabela.js` é CommonJS-compatível (usa `export function`, mas é importado com `require` — checar se o arquivo é `.js` com `export` ES puro e o teste usa `require`; se `shared/tabela.js` for ES module, `require()` funcionaria só se Node estiver rodando com interoperabilidade — **conferir no repo antes de copiar**: os testes de `shared/fluxo.js`/`shared/tema.js`/`predial/dominio.js` usam `import()` dinâmico, enquanto `tests/tabela-compartilhada.test.js` usa `require` direto). Os novos `shared/grafico.js`, `indicadores.js`, `gantt.js`, `abc.js` devem seguir a mesma convenção de export que `shared/tabela.js` usa hoje para que `require(...)` funcione igual; se `package.json` não define `"type":"module"` (zero-build, confirmar), `export function` em `.js` puro só funciona com `require` se o Node tratar como ESM via extensão `.mjs` ou config — **checar rapidamente no início da implementação** (rodar `node --test tests/tabela-compartilhada.test.js` já prova o mecanismo real).

Estrutura de caso de teste com dado inventado no próprio arquivo, nunca importado de produção (`tests/tabela-compartilhada.test.js` linhas 33-46) — replicar para `grafico`/`indicadores`/`gantt`/`abc`: uma definição mínima e sintética dentro do `.test.js`, provando que o núcleo não conhece nenhum campo de domínio real.

---

### Onda B — `gestao/index.html` + `gestao/app.js`

**Análogo:** `transportes/index.html` + `transportes/app.js` (módulo completo pós-shell compartilhado).

**Padrão de cabeçalho de imports** (`transportes/app.js` linhas 1-3):
```js
import { Auth } from '../shared/auth.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'  // (conferir nome exato usado)
import { aplicarShell } from '../shared/shell.js'
```

**Padrão de carregamento de dados** (`transportes/app.js` linhas 174-176):
```js
async function carregarTudo() {
  const [ativosRes, viagensRes, manutRes, planosRes, planoMatsRes, materiaisRes, movRes] = await Promise.all([
    supa.from('transp_ativos').select('*'),
    ...
  ])
  ...
}
```
`gestao/app.js#carregarTudo()` segue o mesmo `Promise.all` — mas D-13-03 exige que a leitura de `logs_manutencao`/`refrigeracao` seja **só leitura**, nunca grave nessa tabela (mesma régua de "ctComp/ctOS" alimentados fora do `Promise.all` principal citada no `.claude/CLAUDE.md`, e mesmo cuidado do `EST_OK`/`ATRIB_OK`/`UNI_OK`: uma sonda própria antes de tentar ler tabelas que podem não existir ainda).

**Padrão de shell + navItems** (`transportes/app.js` linhas 1513-1540, análogo estrutural — copiar formato, adaptando ícones e abas para Painel · Ações · Calendário · Ferramentas · POP):
```js
aplicarShell({
  ...
  navItems: [ ... ],
})
auth = new Auth(supa, { appNome: 'Transportes', appIcone: '🚚' })
```
Nota: `shared/icones.js` (D-13, chrome padronizado) já substituiu emoji por nome de ícone SVG em 6 módulos — `gestao/app.js` deve nascer já usando `icone('nome')` de `shared/icones.js`, não emoji novo (checar se `icones.js` tem entrada nova a acrescentar para "gestão"/"painel"/"ferramentas"/"pop").

---

### `supabase/60_gestao_schema.sql`

**Análogo:** `supabase/44_refrigeracao_estoque.sql` (cabeçalho-ensaio, aditiva, RLS leitura pública/escrita autenticada) + `supabase/38_maquinas_contratacoes.sql` (múltiplas tabelas relacionadas nascendo juntas).

**Cabeçalho a copiar como formato** (`supabase/44_refrigeracao_estoque.sql` linhas 1-33):
```sql
-- ══════════════════════════════════════════════════════════════════
-- 44 — Estoque de peças e materiais (/refrigeracao)
--
-- ... (por que existe, o que traz, convenção de nome, ADITIVA/SEM DROP,
-- ORDEM DE PUBLICAÇÃO — frontend antes do SQL, sonda própria EST_OK)
-- ══════════════════════════════════════════════════════════════════
```
`60_gestao_schema.sql` deve seguir a mesma estrutura de comentário: por que `ges_acoes`/`ges_indicadores`/`ges_indicador_valores`/`ges_pop`/`ges_causas` existem, aditiva/sem DROP, ordem de publicação (frontend antes, D-cf8-25/D-6wy pattern), e nomear a sonda própria equivalente a `EST_OK`/`ATRIB_OK` que o `gestao/app.js` deve usar para não quebrar antes da migração ser aplicada — mas aqui não há "tela antiga" pré-existente, então a sonda serve para o `gestao` recém-criado não falhar se publicado antes do SQL (mesma ordem de deploy).

**RLS leitura pública/escrita autenticada** — buscar o padrão exato em `44_refrigeracao_estoque.sql` (policies `select` para `public`, `insert`/`update`/`delete` para `authenticated`) ou em `38_maquinas_contratacoes.sql` ("RLS on com duas policies cada"); D-13-05/D-11 do CONTEXT.md já fixam essa régua.

---

## Padrões compartilhados (cross-cutting)

### Núcleo puro / aplicador de DOM
**Fonte:** `shared/tema.js`, `shared/tabela.js`, `shared/fluxo.js`, `mapa/mapa-geometria.js`
**Aplica-se a:** todos os 7 arquivos novos de `shared/` na Onda A
Regra: nenhuma API de navegador (`document`, `window`, `localStorage`) dentro do núcleo; funções puras recebendo dados e devolvendo dado/HTML como string; quem injeta no DOM é o módulo consumidor.

### Tom semântico, nunca cor em JS
**Fonte:** `shared/componentes.js` (`TONS`, `tomValido`), `shared/icones.js` (`currentColor`)
**Aplica-se a:** `shared/grafico.js`, `shared/indicadores.js`, `shared/gantt.js`, CSS `.gantt*`/`.kanban*`/`.calendar*`/`.indicador*`/`.grafico*` em `shared/pmoc.css`

### Escape de texto para HTML
**Fonte:** `shared/componentes.js#esc()` (linhas 23-29)
**Aplica-se a:** qualquer função de `shared/*.js` que gere HTML com dado do usuário (nomes, rótulos)

### Extração para `shared/` com reexport no consumidor original
**Fonte:** `predial/dominio.js` linha final (`export { montarArvore, linhasVisiveis } from '../shared/arvore.js'`)
**Aplica-se a:** `predial/dominio.js` (GUT) e — com ressalva de UMD vs. ES module — `maquinas/operacoes.js` (kanban/calendário)

### Migração aditiva com sonda própria e ordem de publicação
**Fonte:** `supabase/44_refrigeracao_estoque.sql`, `supabase/45_refrigeracao_atributos_tecnicos.sql`, `supabase/38_maquinas_contratacoes.sql`
**Aplica-se a:** `supabase/60_gestao_schema.sql`

### RLS leitura pública / escrita autenticada
**Fonte:** padrão descrito em `44_refrigeracao_estoque.sql`/`38_maquinas_contratacoes.sql`, confirmado em D-13-05
**Aplica-se a:** as cinco tabelas `ges_*`

## Sem análogo encontrado

| Arquivo | Papel | Fluxo de dados | Motivo |
|---|---|---|---|
| `shared/grafico.js` (carta de controle com LSC/LIC) | utilitário | transform | Nenhum arquivo do repo hoje calcula controle estatístico de processo — usar as fórmulas descritas no CONTEXT.md/PRD (média, LSC/LIC, pontos fora) como especificação, não um análogo de código |
| `vercel.json` (rota `/gestao`) | config | — | Arquivo único; só copiar a entrada de rewrite de um módulo existente (ex.: `/transportes`) linha a linha |

## Metadados

**Escopo da busca de análogos:** `shared/`, `maquinas/`, `predial/`, `transportes/`, `supabase/`, `tests/`
**Arquivos varridos:** ~20 (lidos por completo, todos ≤ 150 linhas) + 4 trechos grandes lidos por offset (`maquinas/app.js`, `maquinas/index.html`, `supabase/44_*.sql`, `transportes/app.js`)
**Data de extração:** 2026-09-04

## PATTERN MAPPING COMPLETE
