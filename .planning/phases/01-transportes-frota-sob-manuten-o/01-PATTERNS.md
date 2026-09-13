# Fase 1: Transportes — Frota sob manutenção - Mapa de Padrões

**Mapeado em:** 2026-08-08
**Arquivos analisados:** 6 (2 novos/estendidos em JS, 1 migração SQL nova, 3 já existentes só de leitura)
**Analogs encontrados:** 6 / 6

## Classificação de Arquivos

| Arquivo novo/modificado | Papel | Fluxo de dados | Analog mais próximo | Qualidade do match |
|---|---|---|---|---|
| `transportes/app.js` (estender: +PLANOS, +PLANO_MATS, +MATERIAIS, +ESTOQUE_MOV, +calcVencimentos, +renderPlanos, +renderMateriais, +renderCompras, +exportarComprasCSV, +salvarOS) | componente de app (single-file client state manager) | CRUD + batch (baixa de estoque em sequência) | `maquinas/app.js` | exact — mesmo domínio de problema (planos por tipo_modelo, vencimento por uso, OS com baixa de estoque, CSV de compras), já resolvido em produção |
| `transportes/index.html` (adicionar abas "Planos" e "Estoque" + modais) | view/template | request-response (render client-side) | `maquinas/index.html` | role-match — estrutura de abas/nav e modais equivalente; adaptar rótulos para transp_ |
| `supabase/22_transportes_planos_estoque_os.sql` (migração nova) | migration | batch (DDL + grants + policies) | `supabase/01_maquinas_schema.sql` (estrutura de tabelas planos/materiais/os) + `supabase/10_transportes_schema.sql` (estilo de policy loop e grants já em uso no módulo transportes) | role-match — combinar o schema de referência (01) com o estilo/prefixo já estabelecido em transportes (10) |
| `transp_manutencoes` — `ALTER TABLE` (não novo arquivo, dentro da migração 22) | migration (alteração aditiva) | CRUD | `maq_os` (colunas `plano_id`, `status`, `custo_pecas`) em `supabase/01_maquinas_schema.sql` | role-match — replicar colunas equivalentes via `ADD COLUMN IF NOT EXISTS` |
| `transp_pode_escrever()` (função SQL, dentro da migração 22) | middleware (RLS/RBAC) | request-response | nenhum analog direto em produção (schemas atuais usam `using(true)`) — usar o padrão documentado em `01-RESEARCH.md` Pattern 3 | sem analog — ver seção "Sem Analog" |
| `shared/auth.js`, `shared/supabase-config.js` (só leitura, sem alteração) | provider/utility | request-response | já em uso correto por `transportes/app.js` | exact — não modificar, apenas confirmar import |

## Atribuições de Padrão

### `transportes/app.js` — novas globals e `carregarTudo()` estendido

**Analog:** `maquinas/app.js:10` (globals) e `transportes/app.js:8-11` (globals atuais)

**Padrão de globals a adicionar** (seguir convenção `UPPER_CASE`, mesma linha de declaração usada em `maquinas/app.js:10`):
```javascript
// transportes/app.js — adicionar ao bloco de globals existente (linhas 8-14)
let PLANOS = []
let PLANO_MATS = []
let MATERIAIS = []
let ESTOQUE_MOV = []
let PLANO_EDIT_ID = null
let MATERIAL_EDIT_ID = null
```

**`carregarTudo()` — padrão de `Promise.all` a estender** (fonte: `transportes/app.js:152-175`):
```javascript
// transportes/app.js:152-175 (atual) — adicionar as novas queries ao mesmo Promise.all
async function carregarTudo() {
  try {
    const [ativosRes, viagensRes, manutRes, planosRes, planoMatsRes, materiaisRes] = await Promise.all([
      supa.from('transp_ativos').select('*').order('codigo'),
      supa.from('transp_viagens').select('*, transp_ativos(codigo,nome,tipo,unidade_uso)').order('data_saida', { ascending: false }).order('hora_saida_prevista', { ascending: false }),
      supa.from('transp_manutencoes').select('*, transp_ativos(codigo,nome)').order('data_manutencao', { ascending: false }),
      supa.from('transp_planos').select('*').order('ordem'),
      supa.from('transp_plano_materiais').select('*'),
      supa.from('transp_materiais').select('*').order('nome'),
    ])
    const erro = ativosRes.error || viagensRes.error || manutRes.error || planosRes.error || planoMatsRes.error || materiaisRes.error
    if (erro) throw erro
    ERRO_CARGA = null
    ATIVOS = ativosRes.data || []
    VIAGENS = viagensRes.data || []
    MANUTENCOES = manutRes.data || []
    PLANOS = planosRes.data || []
    PLANO_MATS = planoMatsRes.data || []
    MATERIAIS = materiaisRes.data || []
  } catch (error) {
    ERRO_CARGA = error.message || String(error)
    ATIVOS = []; VIAGENS = []; MANUTENCOES = []; PLANOS = []; PLANO_MATS = []; MATERIAIS = []
  }
  renderTudo()
}
```
Nota de estilo: seguir exatamente o padrão de destructuring + `error` unificado já usado aqui — não copiar o padrão mais antigo/sem-try-catch de `maquinas/app.js`.

**`renderTudo()`** (fonte: `transportes/app.js:177-183`) — adicionar `renderPlanos()`, `renderMateriais()`, `renderVencimentos()`, `renderCompras()` à lista de chamadas.

---

### `calcVencimentos()` — detecção de vencida/próxima

**Analog:** `maquinas/app.js:170-187`

**Padrão a portar** (adaptar `status === 'baixado'` → `ativo.ativo !== false`, e `uso_na_os` → `uso_referencia`, alinhado ao esquema atual de `transp_manutencoes`):
```javascript
// Fonte: maquinas/app.js:170-187 — adaptar nomes de coluna para o schema transp_
function calcVencimentos(){
  const items = []
  for(const ativo of ATIVOS){
    if(ativo.ativo === false) continue
    const planosAtivo = PLANOS.filter(p => p.tipo_modelo === ativo.tipo_modelo)
    for(const plano of planosAtivo){
      if(plano.unidade !== ativo.unidade_uso) continue // coerência km×h herdada do ativo (D-04)
      const ultimaOS = MANUTENCOES.find(m => m.ativo_id === ativo.id && m.plano_id === plano.id && m.status === 'concluida')
      const baseUso = ultimaOS ? (ultimaOS.uso_referencia || 0) : 0
      const proxUso = baseUso + plano.intervalo
      const falta = proxUso - ativo.uso_atual
      const pct = Math.min(100, Math.round(((ativo.uso_atual - baseUso) / plano.intervalo) * 100))
      items.push({ ativo, plano, proxUso, falta, pct })
    }
  }
  return items.sort((a,b) => b.pct - a.pct)
}
```
Ponto de atenção do RESEARCH.md: adicionar o filtro `plano.unidade !== ativo.unidade_uso` (D-04) — `maquinas/app.js` não precisa disso porque só tem uma frota heterogênea em unidade por acidente, mas Transportes exige explicitamente impedir mistura km/h.

---

### `salvarOS()` — abrir/concluir OS com baixa de estoque e atualização de uso

**Analog:** `maquinas/app.js:651-709` (`salvarOS`) + `maquinas/app.js:711-715` (`concluirOS`)

**Core pattern a portar** (renomear tabelas `maq_*` → `transp_*`; usar `transp_manutencoes` estendida em vez de `maq_os`; `uso_na_os` → `uso_referencia`):
```javascript
// Fonte: maquinas/app.js:651-709 — adaptar para transp_manutencoes (colunas novas: plano_id, status, custo_pecas)
async function salvarOS(){
  const ativo_id  = Number(document.getElementById('mn-ativo').value)
  const plano_id  = Number(document.getElementById('mn-plano').value) || null
  const tipo      = document.getElementById('mn-tipo').value
  const data      = document.getElementById('mn-data').value
  const delta     = parseFloat(document.getElementById('mn-delta').value) || 0
  const tecnico   = document.getElementById('mn-executado').value.trim()
  const descricao = document.getElementById('mn-descricao').value.trim()
  if(!ativo_id || !data || !descricao){ alert('Preencha ativo, data e descrição.'); return }

  const ativo = ATIVOS.find(a => a.id === ativo_id)
  const uso_referencia = (ativo?.uso_atual || 0) + delta

  let custo_pecas = 0
  if(plano_id){
    for(const item of PLANO_MATS.filter(p=>p.plano_id===plano_id)){
      const mat = MATERIAIS.find(m=>m.id===item.material_id)
      if(mat?.preco) custo_pecas += Number(mat.preco) * Number(item.quantidade)
    }
  }

  const { error: erOS } = await supa.from('transp_manutencoes').insert({
    ativo_id, plano_id, tipo, status: 'concluida',
    data_manutencao: data, uso_referencia, executado_por: tecnico, descricao, custo_pecas
  })
  if(erOS){ alert('Erro: ' + erOS.message); return }

  if(delta > 0){
    await supa.from('transp_ativos').update({ uso_atual: uso_referencia }).eq('id', ativo_id)
  }

  if(plano_id){
    for(const item of PLANO_MATS.filter(p => p.plano_id === plano_id)){
      const mat = MATERIAIS.find(m => m.id === item.material_id)
      if(mat){
        const novo = Math.max(0, mat.estoque_atual - item.quantidade)
        await supa.from('transp_materiais').update({ estoque_atual: novo }).eq('id', mat.id)
        await supa.from('transp_estoque_movimentos').insert({
          material_id: mat.id, tipo: 'saida', quantidade: item.quantidade,
          motivo: 'OS preventiva — ' + (PLANOS.find(p=>p.id===plano_id)?.nome||'')
        })
      }
    }
  }

  fecharModal('manutencao')
  await carregarTudo()
}
```
Erro/validação: seguir o idioma já usado em `transportes/app.js:648-695` (`if(!podeEditar()) return` no topo — presente em `salvarManutencao` atual — manter em `salvarOS`) em vez do `maquinas/app.js`, que não tem essa checagem client-side.

---

### `renderMateriais()` / `renderCompras()` / `exportarComprasCSV()`

**Analog:** `maquinas/app.js:338-448`

**Padrão a portar quase literalmente** (trocar `MATERIAIS`/`PLANO_MATS`/`calcVencimentos()` — já globais equivalentes; trocar nome do arquivo CSV):
```javascript
// Fonte: maquinas/app.js:366-436 (renderCompras) — portar 1:1, só ajustar nome do CSV
function exportarComprasCSV(){
  const linhas = window._comprasData || []
  const header = 'Codigo,Nome,Quantidade,Unidade,PrecoUnit,Total,Motivo'
  const rows = linhas.map(l => `${l.codigo||''},${JSON.stringify(l.nome)},${l.qtd},${l.unidade},${l.preco||''},${((l.preco||0)*l.qtd).toFixed(2)},${JSON.stringify(l.motivo)}`)
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = 'lista-compras-transportes-' + new Date().toISOString().slice(0,10) + '.csv'
  a.click()
}
```
Nota: `transportes/app.js` já tem seu próprio `exportarViagensCsv()` (linhas 702-725) usando `csvEscape()` com `;` como separador (padrão BR/Excel), diferente do `,` usado por `maquinas/app.js`. **Decisão de consistência:** manter o separador `;` + `csvEscape()` já estabelecido em `transportes/app.js`, não copiar literalmente o separador `,` de `maquinas/app.js` — priorizar consistência com o mesmo arquivo, não com o analog externo.

---

### `salvarMaterial()` / modal de material

**Analog:** `maquinas/app.js:764-787` (`abrirModalMaterial`/`salvarMaterial`)

```javascript
// Fonte: maquinas/app.js:773-787 — adaptar tabela e checagem podeEditar()
async function salvarMaterial(){
  if (!podeEditar()) return
  const nome = document.getElementById('mat-nome').value.trim()
  if(!nome){ alert('Nome obrigatório.'); return }
  const payload = {
    codigo: document.getElementById('mat-cod').value.trim().toUpperCase() || null,
    nome,
    tipo: document.getElementById('mat-tipo').value,
    unidade: document.getElementById('mat-uni').value.trim() || 'un',
    estoque_minimo: parseFloat(document.getElementById('mat-min').value) || 0,
    preco: parseFloat(document.getElementById('mat-preco').value) || null,
  }
  const { error } = MATERIAL_EDIT_ID
    ? await supa.from('transp_materiais').update(payload).eq('id', MATERIAL_EDIT_ID)
    : await supa.from('transp_materiais').insert({ ...payload, estoque_atual: 0 })
  if(error){ alert('Erro: '+error.message); return }
  fecharModal('material')
  await carregarTudo()
}
```

---

### `supabase/22_transportes_planos_estoque_os.sql` — migração aditiva

**Analog:** `supabase/01_maquinas_schema.sql` (estrutura de tabelas) + `supabase/10_transportes_schema.sql` (estilo de policy/grant já usado neste módulo)

**Imports/cabeçalho pattern** (fonte: `supabase/10_transportes_schema.sql:1-5`):
```sql
-- ═══════════════════════════════════════════════════════════════════
-- 14 — PMOC Transportes — planos de manutenção, estoque e OS
-- Migração aditiva. Executar no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════
```

**Core pattern — tabelas novas** (fonte: `01_maquinas_schema.sql:19-42` adaptado para `id bigint generated always as identity`, padrão já usado em `transp_ativos`, não `serial` como em `maq_planos`):
```sql
create table if not exists transp_planos (
  id bigint generated always as identity primary key,
  tipo_modelo text not null,
  nome text not null,
  intervalo numeric not null check (intervalo > 0),
  unidade text not null check (unidade in ('km', 'h')),
  descricao text,
  ordem integer default 0,
  ativo boolean not null default true
);

create table if not exists transp_materiais (
  id bigint generated always as identity primary key,
  codigo text unique,
  nome text not null,
  tipo text not null default 'consumivel' check (tipo in ('consumivel', 'peca')),
  unidade text not null default 'un',
  preco numeric check (preco is null or preco >= 0),
  estoque_atual numeric not null default 0 check (estoque_atual >= 0),
  estoque_minimo numeric not null default 0 check (estoque_minimo >= 0),
  obs text
);

create table if not exists transp_plano_materiais (
  id bigint generated always as identity primary key,
  plano_id bigint references transp_planos(id) on delete cascade,
  material_id bigint references transp_materiais(id) on delete cascade,
  quantidade numeric not null default 1 check (quantidade > 0),
  unique (plano_id, material_id)
);

create table if not exists transp_estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  material_id bigint references transp_materiais(id),
  manutencao_id uuid references transp_manutencoes(id),
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade numeric not null check (quantidade > 0),
  motivo text,
  registrado_em timestamptz default now()
);

-- alteração aditiva de transp_manutencoes (Pitfall 3 do RESEARCH — sempre IF NOT EXISTS)
alter table transp_manutencoes add column if not exists plano_id bigint references transp_planos(id);
alter table transp_manutencoes add column if not exists status text not null default 'concluida'
  check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada'));
alter table transp_manutencoes add column if not exists custo_pecas numeric default 0;
```

**Grants pattern** (fonte: `10_transportes_schema.sql:85-88` — não esquecer grant de sequence, Pitfall 4 do RESEARCH):
```sql
grant select on transp_planos, transp_materiais, transp_plano_materiais, transp_estoque_movimentos to anon, authenticated;
grant insert, update, delete on transp_planos, transp_materiais, transp_plano_materiais, transp_estoque_movimentos to authenticated;
grant usage, select on sequence transp_planos_id_seq to anon, authenticated;
grant usage, select on sequence transp_materiais_id_seq to anon, authenticated;
grant usage, select on sequence transp_plano_materiais_id_seq to anon, authenticated;
```

**RLS/RBAC pattern — DIVERGE do analog** (fonte: `10_transportes_schema.sql:90-109` usa `using(true)` para tudo; `01-RESEARCH.md` Pattern 3 recomenda RBAC mínimo só nas tabelas novas):
```sql
-- NÃO copiar with check(true) do 10_transportes_schema.sql para estas 4 tabelas novas.
create or replace function transp_pode_escrever()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from usuarios u where u.auth_id = auth.uid() and u.role in ('admin','gestor','tecnico'))
$$;

do $$ declare t text; begin
  foreach t in array array['transp_planos','transp_materiais','transp_plano_materiais','transp_estoque_movimentos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (true)', 'sel_'||t, t);
    execute format('create policy %I on %I for insert to authenticated with check (transp_pode_escrever())', 'ins_'||t, t);
    execute format('create policy %I on %I for update to authenticated using (transp_pode_escrever())', 'upd_'||t, t);
    execute format('create policy %I on %I for delete to authenticated using (transp_pode_escrever())', 'del_'||t, t);
  end loop;
end $$;
```

---

## Padrões Compartilhados

### Autenticação / Sessão
**Fonte:** `shared/auth.js`, importado corretamente em `transportes/app.js:1` (`import { Auth } from '../shared/auth.js'`)
**Aplicar a:** nenhum arquivo novo precisa disso — apenas confirmar que nada regride para o padrão inline de `maquinas/app.js` (anti-padrão documentado em CLAUDE.md). Nenhuma mudança necessária em `boot()` (`transportes/app.js:769-789`).

### Checagem de permissão client-side (UX apenas)
**Fonte:** `transportes/app.js:61-63`
```javascript
function podeEditar() {
  return ROLES_ESCRITA.includes(USUARIO?.role)
}
```
**Aplicar a:** toda função `salvar*()` nova (`salvarOS`, `salvarPlano`, `salvarMaterial`) deve abrir com `if (!podeEditar()) return` — já é o padrão em `salvarManutencao()` (linha 649) mas ausente em `maquinas/app.js`; priorizar o padrão local.

### Tratamento de erro Supabase
**Fonte:** `transportes/app.js:673-676` e amplamente em `maquinas/app.js`
```javascript
const { error } = await supa.from(...).insert(...)
if (error) { alert('Erro: ' + error.message); return }
```
**Aplicar a:** todas as novas chamadas Supabase em `salvarOS`, `salvarPlano`, `salvarMaterial`.

### Escape de HTML em templates
**Fonte:** `transportes/app.js:51-59` (`esc()`) — usar para todo valor interpolado em `render*()` novos, nunca interpolar direto.

### Exportação CSV
**Fonte:** `transportes/app.js:697-725` (`csvEscape` + separador `;`) — preferir sobre o padrão `,`/`JSON.stringify` de `maquinas/app.js` para manter consistência dentro do mesmo arquivo (ver nota na seção de `exportarComprasCSV`).

### Migração SQL aditiva + RLS
**Fonte:** `supabase/10_transportes_schema.sql` (estilo/prefixo `transp_`, loop `do $$ ... $$`) combinado com `01-RESEARCH.md` Pattern 3 (RBAC via `SECURITY DEFINER`) — não copiar `with check(true)` para tabelas novas (Pitfall 1 do RESEARCH.md).

## Sem Analog Encontrado

| Arquivo/objeto | Papel | Fluxo de dados | Motivo |
|---|---|---|---|
| `transp_pode_escrever()` (função SQL) | middleware/RBAC | request-response | Nenhuma função `SECURITY DEFINER` de RBAC existe hoje no projeto — todas as tabelas em produção (`maq_*`, `transp_*` atuais, `equipamentos`) usam `using(true)`/`with check(true)`. Usar o modelo do `01-RESEARCH.md` (Pattern 3, linhas 228-254) como referência primária em vez de um analog de código. |

## Metadados

**Escopo de busca de analogs:** `transportes/`, `maquinas/`, `supabase/`, `shared/` (raiz do repo)
**Arquivos lidos integralmente:** `transportes/app.js` (791 linhas), `maquinas/app.js` (trechos-chave: linhas 1-16, 170-448, 651-787), `supabase/01_maquinas_schema.sql` (119 linhas), `supabase/10_transportes_schema.sql` (109 linhas)
**Data da extração:** 2026-08-08
