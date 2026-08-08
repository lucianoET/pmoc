# Fase 1: Transportes — Frota sob manutenção - Pesquisa

**Pesquisado em:** 2026-08-08
**Domínio:** Evolução de módulo Supabase/vanilla-JS já em produção (`/transportes`) para cobrir manutenção por uso (km/horas), OS com baixa de estoque e detecção de vencimento — portando o padrão comprovado de `maquinas/app.js`
**Confiança:** ALTA (a maior parte das decisões técnicas é verificável diretamente no código do próprio repositório, não em fontes externas)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dados legados & import**
- D-01: Legado fornecido em `ref/` — versão única (`transportes (2).html`; a (3) é duplicata md5). Mapa VTR/EMB já importado como seed (9 ativos, 23 viagens).
- D-02: Conferência pós-import: Claude gera relatório (contagens por categoria + amostra de ativos) e o usuário valida contra o legado antes de dar TRANSP-09 por concluído.

**Modelagem viatura×embarcação**
- D-03: Tabela única `transp_ativos` com `tipo` (viatura/embarcacao) + `unidade_uso` (km/h) — já implementada no schema 10; manter.
- D-04: Planos de manutenção por `tipo_modelo` com unidade herdada do modelo — plano usa a unidade do modelo, impossibilitando misturar km em embarcação.
- D-05: Identificação (placa/chassi/RENAVAM/inscrição) no cadastro do ativo na Fase 1; tabela de documentos com vencimento fica p/ Fase 2 (TRANSP-06).
- D-06: Estoque próprio do módulo: `transp_materiais` + `transp_estoque_movimentos` (padrão maq_, prefixo próprio, sem compartilhar com máquinas).

**Base de código & UI**
- D-07: Evoluir o `transportes/app.js` existente (791 linhas, Supabase via `shared/supabase-config.js`) — não fork novo, não rewrite. Novas seções (Planos, Estoque) seguem o padrão de abas atual.

### Claude's Discretion
- Estratégia de consolidação de versões do legado e conteúdo do seed — usuário delegou; consolidação feita em `01-LEGACY-CONSOLIDATION.md` (versão única; histórico legado vazio, nada a migrar).
- RLS & auth (área não selecionada p/ discussão): decidir no plano. Mínimo esperado (STATE.md): `observador` read-only; avaliar reutilizar `shared/auth.js`. Validar por que a sessão "Gestor" abriu sem login no teste de produção.
- Features do legado não portadas (agendamento avançado, habilitações, Papeleta 6): incluir no plano apenas o que serve aos requisitos da fase; resto → deferred.

### Deferred Ideas (OUT OF SCOPE)
- Abastecimento/consumo, documentos com vencimento, dashboard ampliado → Fase 2 (TRANSP-05/06/08)
- Agendamento avançado do legado (solicitante, prioridade, sugestão por habilitação), cadastro de motoristas/habilitações, Papeleta 6 de Serviço, calculadores de custo — avaliar em fase futura/backlog
- Módulos cftv/paiol/predial/seguranca/grama vistos em `ref/` — fora do ciclo
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da pesquisa |
|----|-----------|----------------------|
| TRANSP-01 | Inventário único viatura/embarcação com categoria e unidade de uso | ✅ Já entregue em produção (`transp_ativos`, schema 10). Nenhuma ação de schema necessária; ver §"Estado atual" |
| TRANSP-02 | Planos de manutenção por `tipo_modelo`, intervalo em km/h | Padrão `maq_planos` a portar 1:1 para `transp_planos` — ver §"Standard Stack" e §"Código"  |
| TRANSP-03 | OS vinculada a ativo+plano+peças, baixa de estoque, atualização de uso | Estender `transp_manutencoes` (não criar tabela nova) seguindo o fluxo `salvarOS()` de `maquinas/app.js` — ver §"Arquitetura" |
| TRANSP-04 | Registro de uso detecta vencida/próxima | Portar `calcVencimentos()` de `maquinas/app.js`, adaptando para 2 fontes de uso (viagem incrementa `uso_atual`; OS referencia `uso_referencia` como baseline do plano) |
| TRANSP-07 | Estoque com alerta de mínimo e lista de compras CSV | Portar `renderCompras()`/`exportarComprasCSV()` de `maquinas/app.js` quase literalmente |
| TRANSP-09 | Import legado consolidado e conferido | Import já executado (seed 11); falta apenas o relatório formal de conferência (D-02) — não é tarefa de schema |
| INTEG-02 | Rota `/transportes` no `vercel.json` | ✅ Já configurada — verificado em `vercel.json` linha 6 |
| INTEG-03 | Login por cargo funcionando com RLS | Comportamento observado ("Gestor sem login") é sessão Supabase compartilhada por origem, não bug de RLS — ver §"Pitfall: sessão sem login" |
| INTEG-04 | Refrigeração/Máquinas não podem quebrar | Toda migração nova deve ser arquivo numerado adicional (`14_...sql`), nunca tocar `maq_`/`equipamentos`/policies existentes — ver §"Common Pitfalls" |
</phase_requirements>

## Summary

O módulo `/transportes` já está em produção com um subconjunto funcional (Frota, Viagens, Manutenção simples) construído seguindo exatamente as convenções do projeto (`transportes/app.js` importa `shared/auth.js` + `shared/supabase-config.js`, mesmo padrão de globals UPPER_CASE + `carregarTudo()` + `render*()`). Os gaps desta fase (TRANSP-02, TRANSP-03, TRANSP-04, TRANSP-07) têm solução de referência pronta e comprovada em produção: `maquinas/app.js` + `supabase/01_maquinas_schema.sql` já resolvem exatamente o mesmo problema (planos por `tipo_modelo`, detecção de vencimento por uso, OS com baixa de estoque, lista de compras CSV) para o módulo Máquinas. A tarefa central desta fase é **portar esse padrão**, adaptando para frota mista km/hora (já resolvido no schema atual via `unidade_uso`) e para o fato de que Transportes tem duas fontes de incremento de uso (viagem e OS), diferente de Máquinas que só tem OS.

A investigação de código confirmou que o comportamento "sessão Gestor abriu sem login" relatado no teste de produção **não é um bug de RLS** — é o comportamento padrão e documentado do Supabase JS SDK: sessões ficam em `localStorage`, que é compartilhado entre todos os *paths* de uma mesma origem (`pmoc-overlay.vercel.app` ou domínio customizado). Um login prévio em `/maquinas` como Gestor é automaticamente reaproveitado ao abrir `/transportes`, porque `Auth.mount()` chama `supa.auth.getSession()` e reidrata a sessão existente sem mostrar a tela de login. Isso é single-sign-on implícito entre módulos do mesmo projeto Supabase — não uma falha de autenticação de Transportes especificamente. O que de fato precisa de atenção (RLS real) é: hoje qualquer cargo autenticado (admin/gestor/tecnico) tem CRUD idêntico e irrestrito nas tabelas `transp_*`, porque as policies usam `to authenticated using (true)`/`with check (true)` sem checagem de `role`. `observador` ("Livre") já não tem sessão Supabase real (não chama `signInWithPassword`), então já está de fato bloqueado de escrever no banco mesmo com policies permissivas — mas isso nunca foi testado formalmente. A fase deve (a) confirmar isso com um smoke test explícito e (b) aplicar RBAC mínimo nas tabelas **novas** desta fase (planos/estoque/movimentos + colunas novas de `transp_manutencoes`) sem tocar nas policies das tabelas já em produção de outros módulos.

**Recomendação primária:** portar o padrão `maquinas/app.js` (planos → vencimentos → OS → estoque → compras) para `transportes/app.js`, estendendo `transp_manutencoes` em vez de criar uma tabela `transp_os` paralela, e aplicar RBAC mínimo (insert/update/delete restrito a `admin/gestor/tecnico` via função `SECURITY DEFINER` que consulta `usuarios.role`) apenas nas tabelas novas desta fase, numa migração `14_transportes_planos_estoque_os.sql` estritamente aditiva.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login por cargo / sessão | Browser (Client) | Database (Auth + `usuarios`) | `shared/auth.js` roda 100% client-side; a única fonte de verdade de identidade é a sessão JWT do Supabase Auth, persistida em `localStorage` do browser |
| Autorização de escrita (RBAC) | Database (RLS) | Browser (UX only) | `podeEditar()` no client só esconde botões — a segurança real precisa estar em RLS policies; qualquer checagem client-side é cosmética (documentado em CLAUDE.md) |
| CRUD ativos/planos/materiais | Browser (Client) | Database (Postgres via PostgREST) | Sem backend próprio — o browser fala direto com Supabase via SDK; não há camada de API intermediária neste projeto |
| Detecção de vencimento (km/h) | Browser (Client, computado a cada `carregarTudo()`) | — | Padrão já estabelecido em `maquinas/app.js` (`calcVencimentos()`); recalculado no client a cada load, não persistido em coluna — manter consistência de padrão |
| Baixa automática de estoque | Browser (sequência de `await`s) | Database (constraints `CHECK >= 0`) | Sem função/trigger de banco — mesma limitação já documentada em `CONCERNS.md` para Máquinas (não há transação atômica); mitigar com `CHECK` no schema, não reprojetar arquitetura nesta fase |
| Lista de compras CSV | Browser (Client, `Blob` + download) | — | Nenhuma dependência de servidor; gerado 100% no client como em `maquinas/app.js` |
| Import/consolidação de dados legados | Database (SQL seed) | — | Executado uma vez via SQL Editor do Supabase, idempotente via `ON CONFLICT` |

## Standard Stack

### Core

| Biblioteca | Versão | Propósito | Por que é o padrão |
|---|---|---|---|
| `@supabase/supabase-js` | v2 (via CDN jsDelivr, já carregado em `maquinas/app.js`/`refrigeracao/index.html` e lido dinamicamente por `shared/supabase-config.js`) | Cliente único de Postgres+Auth+RLS | Já em uso em todos os módulos do projeto; nenhuma versão nova a instalar — zero-build, sem `package.json` [VERIFIED: `shared/supabase-config.js` lê a config de `maquinas/app.js`/`refrigeracao/index.html` em runtime] |
| PostgreSQL 15+ (Supabase gerenciado, projeto `pmoc`/`thoaqipyhfmromsgzmjs`, `sa-east-1`) | — | Persistência | Já provisionado; nenhuma alternativa a avaliar [VERIFIED: CLAUDE.md] |

### Supporting

| Biblioteca | Versão | Propósito | Quando usar |
|---|---|---|---|
| `shared/auth.js` (`Auth` class) | interno, já em uso por `transportes/app.js` | Login por cargo + senha | Já importado corretamente por `transportes/app.js:1` (`import { Auth } from '../shared/auth.js'`) — **não duplicar inline** como faz `maquinas/app.js` (anti-padrão já documentado em CLAUDE.md) |
| `shared/supabase-config.js` | interno | Resolve URL/key do Supabase em runtime lendo de `maquinas/app.js` | Já em uso por `transportes/app.js:2` — nenhuma mudança necessária |

### Alternatives Considered

| Em vez de | Poderia usar | Tradeoff |
|---|---|---|
| Tabela nova `transp_os` separada de `transp_manutencoes` | Estender `transp_manutencoes` com colunas novas (`plano_id`, `status`, `custo_pecas`) | Tabela nova duplicaria o conceito de "evento de manutenção" já existente com 0 linhas em produção; estender é estritamente aditivo (`ALTER TABLE ADD COLUMN`), preserva a UI "Manutenção" já existente e evita 2 fontes de verdade para o mesmo conceito de domínio |
| RLS por custom JWT claims (`auth.jwt() ->> 'role'` via Auth Hooks) | Função `SECURITY DEFINER` que consulta `usuarios.role` por `auth.uid()` | Custom claims exigem configurar um Auth Hook no dashboard Supabase (passo manual fora do fluxo de migração SQL versionada); a função `SECURITY DEFINER` é 100% expressável em SQL versionado, consistente com o padrão zero-config do projeto — trade-off aceito: 1 lookup extra por policy check, irrelevante na escala atual (9 ativos) |
| Trigger/função de banco para baixa de estoque atômica | Sequência de `await`s no client (padrão atual de `maquinas/app.js`) | Trigger seria mais correto (atomicidade), mas é mudança arquitetural que também afeta o padrão já em produção em Máquinas; fora do escopo desta fase — mitigar com `CHECK (estoque_atual >= 0)` no schema para pelo menos impedir estoque negativo |

**Instalação:** Nenhuma — zero-build, sem `npm install`. Nenhum pacote novo é necessário para esta fase.

## Package Legitimacy Audit

**Não aplicável.** Esta fase não instala nenhum pacote externo (npm/PyPI/crates). O projeto é zero-build; todas as dependências (`@supabase/supabase-js`) já estão carregadas via CDN em arquivos existentes e não mudam nesta fase. Nenhuma verificação de legitimidade de pacote é necessária.

## Architecture Patterns

### System Architecture Diagram

```
Browser (transportes/app.js)
  │
  ├─ boot() ──► shared/supabase-config.js ──► lê URL/KEY de maquinas/app.js (fetch texto + regex)
  │                                            │
  │                                            ▼
  │                                    supa = createClient(url, key)
  │
  ├─ shared/auth.js (Auth class) ──► supa.auth.getSession() / signInWithPassword()
  │        │                                   │
  │        │                          (sessão já existe? reidrata sem tela de login —
  │        │                           localStorage compartilhado entre /maquinas, /refrigeracao, /transportes)
  │        ▼
  │   onLogin(usuario) ──► mostrarApp() ──► carregarTudo()
  │
  ├─ carregarTudo() ── Promise.all ──►  supa.from('transp_ativos').select(...)
  │                                     supa.from('transp_planos').select(...)          [NOVO]
  │                                     supa.from('transp_viagens').select(...)
  │                                     supa.from('transp_manutencoes').select(...)     [ESTENDIDO: +plano_id,+status,+custo_pecas]
  │                                     supa.from('transp_materiais').select(...)       [NOVO]
  │                                     supa.from('transp_plano_materiais').select(...) [NOVO]
  │                                          │
  │                                          ▼  (RLS aplicada em cada query pelo Postgres)
  │                                     Postgres (RLS: select true / insert-update-delete restrito por transp_pode_escrever())
  │
  ├─ calcVencimentos() ──► compara ATIVOS.uso_atual × (últimaOS.uso_referencia + plano.intervalo) por tipo_modelo
  │        │
  │        ▼
  │   renderVencimentos() ──► badge vencida/próxima (mesmo padrão de maquinas/app.js)
  │
  ├─ salvarOS() [abrir OS: status=pendente|concluida]
  │        ├─► insert transp_manutencoes (ativo_id, plano_id, status, uso_referencia)
  │        ├─► update transp_ativos.uso_atual (se delta > 0)
  │        └─► debita transp_materiais.estoque_atual + insert transp_estoque_movimentos (peças do plano)
  │
  └─ renderCompras() ──► materiais abaixo do mínimo + materiais de planos próximos do vencimento
           └─► exportarComprasCSV() ──► Blob → download (100% client, sem servidor)
```

### Recommended Project Structure

Nenhuma mudança de estrutura de diretórios — a fase evolui arquivos existentes:

```
transportes/
├── index.html      # adicionar abas "Planos" e "Estoque" ao nav existente (padrão trocarView)
└── app.js          # adicionar: PLANOS, PLANO_MATS, MATERIAIS, ESTOQUE_MOV globals;
                     # calcVencimentos(), renderVencimentos(), renderPlanos(), renderMateriais(),
                     # renderCompras(), exportarComprasCSV(); estender salvarManutencao() → salvarOS()
supabase/
└── 14_transportes_planos_estoque_os.sql   # migração aditiva única desta fase (ver §Common Pitfalls)
```

### Pattern 1: Planos por `tipo_modelo` com unidade herdada do ativo

**O quê:** Um plano de manutenção não referencia um ativo específico por FK — referencia um `tipo_modelo` (texto livre, ex.: `'munk'`, `'lancha-natal'`). Múltiplos ativos do mesmo modelo compartilham os mesmos planos. A unidade do plano (km/h) deve ser coerente com `unidade_uso` dos ativos daquele `tipo_modelo` — no schema atual, `unidade_uso` já vive em `transp_ativos`, não em um cadastro de "modelo" separado; a validação de coerência plano×unidade fica no client (impedir cadastro de plano com unidade diferente da dos ativos existentes daquele `tipo_modelo`) e reforçada com `CHECK` simples no schema (`unidade in ('km','h')`).

**Quando usar:** TRANSP-02 — cadastro de planos.

**Exemplo:**
```javascript
// Fonte: maquinas/app.js:174 (calcVencimentos) — padrão direto a portar
function calcVencimentos(){
  const items = []
  for(const ativo of ATIVOS){
    if(ativo.ativo === false) continue
    const planosAtivo = PLANOS.filter(p => p.tipo_modelo === ativo.tipo_modelo)
    for(const plano of planosAtivo){
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

### Pattern 2: OS abre e conclui (workflow com `status`), não é registro único

**O quê:** `maq_os` tem `status` (`pendente`/`em_andamento`/`concluida`/`cancelada`), diferente do `transp_manutencoes` atual, que só grava um registro já concluído. TRANSP-03 pede explicitamente "abrir **e concluir** OS" — exige o mesmo workflow de 2 estados de `maq_os`.

**Quando usar:** TRANSP-03.

**Exemplo:**
```javascript
// Fonte: maquinas/app.js:674-709 (salvarOS) — adaptar para transp_manutencoes estendida
async function salvarOS(){
  const ativo = ATIVOS.find(a => a.id === ativo_id)
  const uso_na_os = (ativo?.uso_atual || 0) + delta

  const { error: erOS } = await supa.from('transp_manutencoes').insert({
    ativo_id, plano_id, tipo, status: 'concluida',
    data_manutencao: data, uso_referencia: uso_na_os,
    executado_por: tecnico, descricao, custo_pecas
  })
  if(erOS){ alert('Erro: ' + erOS.message); return }

  if(delta > 0){
    await supa.from('transp_ativos').update({ uso_atual: uso_na_os }).eq('id', ativo_id)
  }

  if(plano_id){
    const pm = PLANO_MATS.filter(p => p.plano_id === plano_id)
    for(const item of pm){
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
  await carregarTudo()
}
```

### Pattern 3: RBAC mínimo via função `SECURITY DEFINER` (não custom claims)

**O quê:** Em vez de configurar Auth Hooks para custom JWT claims [CITED: supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac], usar uma função SQL que consulta a tabela `usuarios` já existente — mesma fonte que `carregarUsuario()`/`_carregarPerfil()` já usam no client.

**Quando usar:** Nas tabelas novas desta fase (`transp_planos`, `transp_plano_materiais`, `transp_materiais`, `transp_estoque_movimentos`) e nas colunas novas de `transp_manutencoes`.

**Exemplo:**
```sql
-- Fonte: adaptado do padrão de custom claims da doc oficial do Supabase [CITED],
-- trocando "ler do JWT" por "consultar tabela usuarios" (já é a fonte de verdade do projeto)
create or replace function transp_pode_escrever()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from usuarios u
    where u.auth_id = auth.uid()
      and u.role in ('admin', 'gestor', 'tecnico')
  )
$$;

-- aplicar apenas nas tabelas NOVAS desta fase — nunca alterar policies de maq_/equipamentos
drop policy if exists ins_transp_planos on transp_planos;
create policy ins_transp_planos on transp_planos
  for insert to authenticated with check (transp_pode_escrever());
```

### Anti-Patterns to Avoid

- **Criar `transp_os` como tabela paralela a `transp_manutencoes`:** duplica o conceito de "evento de manutenção" e obriga a UI a decidir entre 2 fontes — estender a tabela existente.
- **Copiar as policies `using (true)`/`with check (true)` de `maquinas/app.js`/`10_transportes_schema.sql` para as tabelas novas "porque é o padrão":** já documentado como Pitfall 4 do projeto (`.planning/research/PITFALLS.md`) — as tabelas novas desta fase devem nascer com RBAC mínimo.
- **"Corrigir" a sessão compartilhada entre módulos como se fosse bug:** é comportamento padrão do Supabase JS SDK (localStorage por origem, não por path) [CITED via WebSearch — ver Sources]. Não implementar workaround não solicitado (ex.: forçar `signOut()` ao trocar de módulo) sem decisão explícita do usuário — isso quebraria a conveniência de SSO implícito entre módulos do mesmo domínio.
- **Duplicar `shared/auth.js` inline dentro de `transportes/app.js`:** `transportes/app.js` já faz o import correto (`import { Auth } from '../shared/auth.js'`) — não regredir para o padrão inline usado em `maquinas/app.js` (anti-padrão já documentado em CLAUDE.md/`.planning/codebase/CONCERNS.md`).

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por quê |
|---|---|---|---|
| Cálculo de "% do intervalo consumido" por ativo×plano | Nova lógica de vencimento do zero | `calcVencimentos()` portado de `maquinas/app.js` | Já testado em produção com dados reais de Máquinas; a única adaptação necessária é a fonte do "uso base" (última OS concluída daquele plano, mesma lógica) |
| Geração de CSV de compras | Biblioteca de CSV (papaparse etc.) | `Blob` + `URL.createObjectURL` manual, como em `exportarComprasCSV()`/`exportarViagensCsv()` já existentes | Já 2 implementações idênticas no projeto (máquinas e a já existente em transportes) — trivial, sem necessidade de dependência |
| Autenticação por cargo | Novo fluxo de login | `shared/auth.js` (`Auth` class), já importado corretamente por `transportes/app.js` | É exatamente o propósito do módulo compartilhado — reforçar o import existente, não recriar |
| RBAC por papel | Sistema de permissões customizado/ORM de autorização | Função `SECURITY DEFINER` simples + RLS policies (Pattern 3 acima) | Suficiente para 4 papéis fixos e ~5 tabelas novas; qualquer coisa mais sofisticada é over-engineering para este projeto |

**Key insight:** Todo o domínio funcional desta fase (planos, vencimento, OS, estoque, compras) já tem uma implementação de referência funcionando em produção no mesmo repositório (`maquinas/app.js`). O trabalho desta fase é essencialmente port + adaptação de nomenclatura/prefixo, não design do zero — o risco maior não é "não saber como fazer", é divergir do padrão comprovado sem necessidade.

## Common Pitfalls

### Pitfall 1: Copiar as policies permissivas de `maq_`/`transp_` (tabelas atuais) para as tabelas novas

**O que dá errado:** `10_transportes_schema.sql` já usa `to authenticated using (true)`/`with check (true)` para todas as operações — qualquer cargo autenticado (admin/gestor/tecnico) tem CRUD total, sem diferenciação de papel. Replicar esse padrão para `transp_planos`/`transp_materiais`/`transp_estoque_movimentos` propagaria a mesma falha (já documentada como dívida técnica em `CONCERNS.md`) para 3 tabelas novas.

**Por que acontece:** É o caminho de menor esforço — copiar o bloco `do $$ ... loop ... $$` do schema 10 e trocar os nomes de tabela.

**Como evitar:** Usar o Pattern 3 (`transp_pode_escrever()`) nas tabelas novas desta fase. Manter `select` público (`true`) para preservar acesso de leitura do `observador`/dashboard — restringir apenas insert/update/delete.

**Sinais de alerta:** Migração `14_...sql` com `with check (true)` literal para insert/update/delete em qualquer tabela nova.

### Pitfall 2: "Corrigir" a sessão compartilhada entre módulos achando que é bug de RLS

**O que dá errado:** O teste em produção relatado no CONTEXT.md ("sessão Gestor abriu sem tela de login") não é falha de RLS nem de `transportes/app.js` — é resultado direto de `Auth.mount()` chamar `supa.auth.getSession()` e encontrar uma sessão JWT válida já persistida em `localStorage` (compartilhado entre `/maquinas`, `/refrigeracao` e `/transportes`, porque `localStorage` é por *origem*, não por *path*) [CITED via WebSearch]. Tentar "consertar" isso com lógica adicional (ex.: forçar logout ao trocar de módulo) sem necessidade real quebra a conveniência de sessão persistente que os outros dois módulos já dependem implicitamente.

**Por que acontece:** Comportamento correto do SDK é frequentemente confundido com vazamento de sessão/bug de RLS quando não se olha o código de `Auth.mount()`.

**Como evitar:** Documentar esse comportamento como esperado (SSO implícito entre módulos do mesmo domínio Vercel). O que de fato precisa de verificação é RLS: confirmar, com um teste manual (login como cada cargo + tentativa de escrita via console do browser), que `observador` (que nunca chama `signInWithPassword`, logo nunca fica `authenticated` no Postgres) é de fato bloqueado nas policies `to authenticated`.

**Sinais de alerta:** Um plano que inclui tarefa de "corrigir bug de sessão sem login" sem antes confirmar, com evidência de código, se é ou não o comportamento esperado do SDK.

### Pitfall 3: `transp_manutencoes` estendida sem `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

**O que dá errado:** A tabela já existe em produção com 0 linhas hoje, mas o padrão do projeto é "aditivo, nunca DROP" (CLAUDE.md). Adicionar colunas via `CREATE TABLE` duplicado ou via `ALTER TABLE ADD COLUMN` sem `IF NOT EXISTS` quebra a reexecução idempotente da migração se ela precisar rodar de novo (ex.: erro no meio do script).

**Como evitar:**
```sql
alter table transp_manutencoes add column if not exists plano_id bigint references transp_planos(id);
alter table transp_manutencoes add column if not exists status text not null default 'concluida'
  check (status in ('pendente','em_andamento','concluida','cancelada'));
alter table transp_manutencoes add column if not exists custo_pecas numeric default 0;
```

**Sinais de alerta:** Script de migração sem `if not exists` em `ADD COLUMN`; erro "column already exists" ao reexecutar em ambiente de teste.

### Pitfall 4: Esquecer o `grant` da sequence de tabelas com `bigint generated always as identity`

**O que dá errado:** `transp_ativos` usa `id bigint generated always as identity` (não `serial`), e o script 10 precisou de um `grant usage, select on sequence transp_ativos_id_seq to anon, authenticated` explícito além do `grant` na tabela — sem isso, `insert` falha com "permission denied for sequence" mesmo com grant de tabela correto. As tabelas novas (`transp_planos`, `transp_materiais`) devem seguir o mesmo padrão de `id` e replicar esse grant.

**Como evitar:** Para cada tabela nova com `id bigint generated always as identity`, adicionar:
```sql
grant usage, select on sequence transp_planos_id_seq to anon, authenticated;
grant usage, select on sequence transp_materiais_id_seq to anon, authenticated;
```

**Sinais de alerta:** Insert de plano/material retornando "permission denied for sequence transp_planos_id_seq" em teste manual.

### Pitfall 5: Baixa de estoque sem `CHECK (estoque_atual >= 0)`

**O que dá errado:** `CONCERNS.md` já documenta que `maq_materiais.estoque_atual` pode ir negativo porque o cálculo é feito no client (`Math.max(0, ...)` já mitiga no client, mas nada impede escrita direta via API que pule essa checagem). Replicar o schema de `maq_materiais` sem `CHECK` para `transp_materiais` herda o mesmo buraco.

**Como evitar:** Adicionar `estoque_atual numeric not null default 0 check (estoque_atual >= 0)` e `estoque_minimo numeric not null default 0 check (estoque_minimo >= 0)` no `CREATE TABLE transp_materiais` (não existe em `maq_materiais` hoje — não corrigir lá, fora de escopo; mas não repetir a falta aqui).

**Sinais de alerta:** Teste manual de baixa de estoque maior que o saldo atual não retorna erro.

### Pitfall 6: Migração tocando policy/função de outro módulo (INTEG-04)

**O que dá errado:** Qualquer `CREATE OR REPLACE FUNCTION`/`CREATE POLICY` com nome genérico (não prefixado `transp_`) pode colidir com objeto homônimo já usado por Refrigeração/Máquinas (ex.: uma função chamada `pode_escrever()` sem prefixo colidiria em potencial com qualquer coisa análoga criada depois em outro módulo).

**Como evitar:** Sempre prefixar funções/policies novas com `transp_` (`transp_pode_escrever()`, `ins_transp_planos`, etc.), como já é o padrão observado nas policies de `10_transportes_schema.sql` (`sel_anon_transp_ativos`, etc.). Após aplicar a migração 14, fazer smoke test manual: login em `/maquinas` e `/refrigeracao`, confirmar que carregam sem erro.

**Sinais de alerta:** Nome de função/policy sem prefixo de módulo na migração nova.

### Pitfall 7: Remote Git divergente do documentado no CLAUDE.md

**O que dá errado:** CLAUDE.md/`.claude/CLAUDE.md` referenciam o repo de deploy como `luctronicserp/pmoc`, mas o remote `origin` real deste working directory é **`https://github.com/luctronics-ET/pmoc-overlay.git`** [VERIFIED: `git remote -v`]. Se o Vercel estiver escutando um repo diferente do `origin` atual, um `git push` normal não dispara deploy — silenciosamente.

**Como evitar:** Antes de considerar a fase "pronta para produção", confirmar no painel do Vercel qual repositório GitHub está de fato conectado ao projeto, e documentar a URL correta (não assumir o valor do CLAUDE.md sem checar). Esse é um risco de todas as fases, não só desta, mas vale registrar aqui porque é a primeira fase a fazer deploy de um módulo novo neste ciclo.

**Sinais de alerta:** `git push` bem-sucedido mas nenhum novo deployment aparecendo no painel Vercel.

## Code Examples

### Portar lista de compras (estoque + planos próximos do vencimento)

```javascript
// Fonte: maquinas/app.js:366-436 (renderCompras/exportarComprasCSV) — renomear tabelas para transp_
function renderCompras(){
  const linhas = []
  const baixo = MATERIAIS.filter(m => m.estoque_atual < m.estoque_minimo)
  for(const m of baixo){
    linhas.push({
      codigo: m.codigo, nome: m.nome, unidade: m.unidade,
      qtd: m.estoque_minimo - m.estoque_atual, preco: m.preco,
      motivo: `Repor estoque mínimo (atual: ${m.estoque_atual} · mín: ${m.estoque_minimo})`
    })
  }
  const venc = calcVencimentos().filter(v => v.pct >= 70)
  for(const v of venc){
    for(const pmItem of PLANO_MATS.filter(p => p.plano_id === v.plano.id)){
      const mat = MATERIAIS.find(m => m.id === pmItem.material_id)
      if(!mat || mat.estoque_atual >= pmItem.quantidade) continue
      linhas.push({ codigo: mat.codigo, nome: mat.nome, unidade: mat.unidade, preco: mat.preco,
        qtd: pmItem.quantidade, motivo: `Plano "${v.plano.nome}" em ${v.ativo.codigo} (${v.pct}%)` })
    }
  }
  // ... render + exportarComprasCSV idêntico ao de maquinas/app.js
}
```

### Migração aditiva completa (esqueleto)

```sql
-- 14_transportes_planos_estoque_os.sql
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

alter table transp_manutencoes add column if not exists plano_id bigint references transp_planos(id);
alter table transp_manutencoes add column if not exists status text not null default 'concluida'
  check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada'));
alter table transp_manutencoes add column if not exists custo_pecas numeric default 0;

-- grants (tabela + sequence)
grant select on transp_planos, transp_materiais, transp_plano_materiais, transp_estoque_movimentos to anon, authenticated;
grant insert, update, delete on transp_planos, transp_materiais, transp_plano_materiais, transp_estoque_movimentos to authenticated;
grant usage, select on sequence transp_planos_id_seq to anon, authenticated;
grant usage, select on sequence transp_materiais_id_seq to anon, authenticated;
grant usage, select on sequence transp_plano_materiais_id_seq to anon, authenticated;

-- RLS + RBAC mínimo (ver Pattern 3 na seção Architecture Patterns)
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

## State of the Art

| Abordagem antiga | Abordagem atual (nesta fase) | Quando mudou | Impacto |
|---|---|---|---|
| `transp_manutencoes` como registro único (já concluído no ato do insert) | Workflow `status` pendente→concluída, igual a `maq_os` | Nesta fase (TRANSP-03 exige "abrir e concluir") | UI ganha um botão "Concluir OS" na tabela de manutenções, como já existe em `maq_os`/`renderOS()` |
| RLS `to authenticated using(true)` para tudo | RLS com `transp_pode_escrever()` nas tabelas novas | Nesta fase (decisão de discretion resolvida na pesquisa) | Tabelas existentes (`transp_ativos`, `transp_viagens`, `transp_manutencoes` colunas antigas) **não são alteradas** — só as tabelas/colunas novas ganham a checagem |

**Deprecado/desatualizado:**
- Nenhum — não há uso de bibliotecas obsoletas nesta fase; o único "desatualizado" é o padrão de RLS permissivo que esta fase evita repetir para tabelas novas (sem alterar as antigas).

## Assumptions Log

| # | Claim | Seção | Risco se errado |
|---|---|---|---|
| A1 | O painel Vercel do projeto está de fato conectado ao remote `luctronics-ET/pmoc-overlay` (e não a `luctronicserp/pmoc`, como documentado no CLAUDE.md) | Common Pitfalls, Pitfall 7 | Se o Vercel escutar outro repo, o deploy desta fase pode não ir ao ar mesmo após `git push` bem-sucedido — só confirmável no painel do Vercel, não no código |
| A2 | `observador` nunca fica `authenticated` no Postgres (porque `_selecionarCargo()` não chama `signInWithPassword` para o cargo "Livre") já é suficiente para bloquear escrita, sem precisar de policy adicional | Summary, Pitfall 2 | Se algum fluxo futuro passar a autenticar `observador` com sessão real (ex.: um "esqueci minha senha" mal implementado), a proteção implícita desaparece — recomendação: não depender só disso a longo prazo, mas é aceitável para o escopo desta fase |
| A3 | O comportamento de `localStorage` compartilhado entre paths da mesma origem é o motivo real da sessão "Gestor sem login" relatada — não foi reproduzido ao vivo nesta pesquisa, apenas inferido do código + confirmado via busca sobre o SDK | Pitfall 2 | Se a causa real for outra (ex.: cookie de sessão do Supabase Auth com escopo mais amplo, ou service worker cacheando resposta), a recomendação de "não mexer" pode estar descartando um problema real — vale um teste manual rápido (login em `/maquinas`, abrir `/transportes` em aba nova) antes de fechar a decisão no plano |

**Se esta tabela estiver vazia:** não se aplica — há 3 assumptions relevantes acima, todas de baixo/médio risco e verificáveis com testes manuais rápidos na própria fase.

## Open Questions

1. **`transp_manutencoes` deve ser renomeada para `transp_os` na UI (rótulo "OS") mesmo mantendo o nome da tabela?**
   - O que sabemos: TRANSP-03 usa a palavra "OS", mas a tabela/UI atual usa "Manutenção".
   - O que não está claro: se o usuário espera ver o rótulo "OS" na interface ou se "Manutenção" continua sendo aceitável (são o mesmo conceito de domínio).
   - Recomendação: manter o rótulo "Manutenção" na aba (já existe, já testado, D-07 pede evoluir não redesenhar) e usar "OS" apenas no texto interno de status/botões (ex.: "Concluir OS"), evitando renomear elementos de UI já em produção sem necessidade.

2. **Planos aplicam a viaturas e embarcações no mesmo `tipo_modelo`, ou `tipo_modelo` já é implicitamente único por tipo de ativo?**
   - O que sabemos: os 9 ativos importados já têm `tipo_modelo` únicos por ativo (`munk`, `s10`, `etpm-fatima`, etc.) — não há 2 ativos compartilhando modelo hoje.
   - O que não está claro: se a fábrica de dados real (frota maior no futuro) terá vários ativos do mesmo `tipo_modelo` compartilhando plano, ou se cada ativo é efetivamente único.
   - Recomendação: implementar o filtro por `tipo_modelo` de qualquer forma (é o padrão de `maq_planos`, custo zero de implementar mesmo que hoje 1:1) — não é uma decisão bloqueante para o plano.

## Environment Availability

| Dependência | Necessária para | Disponível | Versão | Fallback |
|---|---|---|---|---|
| `python3` (servidor local opcional) | Rodar `python -m http.server` para testar localmente | ✓ | 3.14.4 [VERIFIED] | Abrir `index.html` direto no browser também funciona (zero-build) |
| `git` | Deploy via push | ✓ | 2.53.0 [VERIFIED] | — |
| Supabase (projeto `pmoc`, cloud) | Toda a persistência | ✓ (já em uso pelos módulos existentes) | Postgres 15+ gerenciado | — |
| Acesso ao SQL Editor do Supabase (dashboard) | Rodar a migração 14 | Não verificável nesta sessão (requer login no dashboard) | — | Nenhum — é o único canal de migração documentado no CLAUDE.md (`supabase/` + SQL Editor, sem CLI/Docker local configurado neste repo) |
| Painel Vercel conectado ao remote correto | Deploy do módulo | Não verificável nesta sessão (ver Pitfall 7 / Assumption A1) | — | Confirmar manualmente no painel antes de considerar a fase "em produção" |

**Dependências ausentes sem fallback:** nenhuma que bloqueie o planejamento — os dois itens "não verificáveis nesta sessão" (SQL Editor, painel Vercel) exigem acesso interativo ao dashboard que não está disponível nesta pesquisa; devem ser confirmados manualmente pelo usuário durante a execução, não são bloqueio para o plano em si.

## Security Domain

### Applicable ASVS Categories

| Categoria ASVS | Aplica | Controle padrão |
|---|---|---|
| V2 Authentication | Sim | Já resolvido por `shared/auth.js` (Supabase Auth, e-mail sintético + senha) — nenhuma mudança nesta fase |
| V3 Session Management | Sim (mas fora de escopo de mudança) | Sessão gerenciada pelo Supabase JS SDK (JWT em `localStorage`); comportamento documentado no Pitfall 2 — não requer ação nesta fase, apenas verificação/documentação |
| V4 Access Control | Sim — é o cerne desta fase | RLS Postgres via função `transp_pode_escrever()` (Pattern 3) nas tabelas novas; `select` permanece público para preservar leitura de `observador` |
| V5 Input Validation | Sim | `CHECK` constraints no schema (`estoque_atual >= 0`, `intervalo > 0`, `quantidade > 0`) + validação client mínima antes de submit (padrão já usado em `salvarAtivo()`/`salvarViagem()` de `transportes/app.js`) |
| V6 Cryptography | Não aplica | Nenhuma criptografia própria da aplicação nesta fase — delegado ao Supabase Auth (hash de senha já gerenciado pelo Postgres/`crypt()`, ver `03_usuarios_cargos.sql`) |

### Known Threat Patterns for this stack

| Padrão | STRIDE | Mitigação padrão |
|---|---|---|
| Escrita não autorizada via API direta (bypass do client, chamando PostgREST direto com o anon key) | Elevation of Privilege / Tampering | RLS `with check (transp_pode_escrever())` nas tabelas novas — a única barreira real, já que o anon key é público por design (CLAUDE.md) |
| Estoque indo negativo por concorrência (2 OS baixando o mesmo material ao mesmo tempo) | Tampering | `CHECK (estoque_atual >= 0)` no schema — não resolve a race condition (já documentada em `CONCERNS.md` como dívida técnica aceita para Máquinas), mas impede o estado inválido final |
| Sessão persistida indevidamente reaproveitada entre módulos por um usuário que devia ter feito logout | Spoofing (fraco) | Comportamento aceito por design nesta fase (SSO implícito); mitigação real seria expiração de sessão configurável no Supabase Auth — fora de escopo, mas vale registrar no plano como risco aceito e não ignorado |

## Sources

### Primary (ALTA confiança — evidência direta do código deste repositório)
- `transportes/app.js` (791 linhas) — lido integralmente
- `maquinas/app.js` (1070 linhas) — lido integralmente, é a fonte de todos os padrões portados
- `supabase/01_maquinas_schema.sql`, `supabase/10_transportes_schema.sql`, `supabase/11_transportes_seed.sql`, `supabase/03_usuarios_cargos.sql` — lidos integralmente
- `shared/auth.js`, `shared/supabase-config.js` — lidos integralmente
- `.planning/phases/01-transportes-frota-sob-manuten-o/01-CONTEXT.md`, `01-LEGACY-CONSOLIDATION.md` — lidos integralmente
- `.planning/codebase/CONCERNS.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/research/PITFALLS.md` — lidos integralmente
- `vercel.json`, `git remote -v` — verificados via ferramenta nesta sessão

### Secondary (MÉDIA confiança — WebSearch, cruzado com evidência de código)
- [Custom Claims & Role-based Access Control (RBAC) | Supabase Docs](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac) — padrão de RBAC via JWT, usado como referência para justificar a escolha da alternativa mais simples (função `SECURITY DEFINER`)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — padrão oficial de RLS
- Discussões da comunidade Supabase sobre persistência de sessão em `localStorage` compartilhado por origem (não por path) — usado para explicar o comportamento "Gestor sem login"

### Tertiary (BAIXA confiança — não verificado neste domínio específico)
- Nenhuma — todas as claims de maior risco (RLS, sessão, schema) foram cruzadas com evidência direta do código deste repositório.

## Metadata

**Confidence breakdown:**
- Standard stack: ALTA — nenhuma biblioteca nova, tudo já em produção no mesmo repositório
- Arquitetura: ALTA — padrão de referência (`maquinas/app.js`) já funciona em produção com o mesmo domínio de problema
- Pitfalls: ALTA para os itens de código/schema (verificados diretamente); MÉDIA para o item de sessão/localStorage (inferido + WebSearch, não reproduzido ao vivo — ver Assumption A3)

**Data da pesquisa:** 2026-08-08
**Válido até:** 2026-09-07 (30 dias — stack estável, sem dependências externas voláteis; revalidar se o painel Vercel/remote GitHub mudar antes disso)
