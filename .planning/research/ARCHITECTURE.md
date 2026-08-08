# Pesquisa de Arquitetura

**Domínio:** Expansão de plataforma modular de manutenção de ativos (SPA estática + Supabase) — adição de 3 módulos novos a um sistema já em produção
**Pesquisado em:** 2026-08-08
**Confiança:** HIGH (baseado em leitura direta do código-fonte e schema já em produção — fonte primária, não inferência de mercado)

## Arquitetura Padrão (a existente — não é para redesenhar)

### Visão Geral do Sistema (estado atual + módulos novos)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Vercel (Static Hosting, zero-build)                  │
│  vercel.json rewrites:                                                   │
│   /refrigeracao → /refrigeracao/index.html        (produção)             │
│   /maquinas     → /maquinas/index.html            (produção)             │
│   /transportes  → /transportes/index.html         (NOVO — fase 1)        │
│   /eletrica     → /eletrica/index.html             (NOVO — fase 2)       │
│   /fonoclama    → /fonoclama/index.html            (NOVO — fase 3)       │
└───────────────────────────┬────────────────────────────────────────────┘
                            │
      ┌──────────┬──────────┼──────────┬───────────┬───────────┐
      │          │          │          │           │           │
  ┌───▼───┐  ┌───▼────┐ ┌───▼────┐ ┌───▼──────┐ ┌───▼─────┐ ┌───▼──────┐
  │Portal │  │Refrig. │ │Máquinas│ │Transportes│ │Elétrica │ │Fonoclama │
  │index. │  │(v2.8)  │ │+app.js │ │(estilo     │ │(estilo  │ │(estilo   │
  │html   │  │        │ │        │ │ máquinas)  │ │refrig.) │ │refrig.)  │
  └───┬───┘  └───┬────┘ └───┬────┘ └────┬──────┘ └───┬─────┘ └───┬──────┘
      │          │          │           │            │           │
      └──────────┴──────────┴───────────┴────────────┴───────────┘
                            │
              ┌─────────────▼─────────────┐
              │  Supabase JS SDK (CDN v2) │   ← cada app instancia seu próprio
              │  createClient(url, anon)  │      cliente, mesma URL/anon key
              └─────────────┬─────────────┘
                            │
   ┌────────────────────────▼─────────────────────────────────────────┐
   │             PostgreSQL (schema `public`, um único projeto)        │
   ├────────────────────────────────────────────────────────────────────┤
   │ maq_*         (7 tabelas — Máquinas, produção)                    │
   │ (sem prefixo) equipamentos, plano_tarefas, ... (Refrigeração)     │
   │ transp_*      (NOVO — Transportes: veículos + embarcações)        │
   │ elet_*        (NOVO — Elétrica)                                   │
   │ fono_*        (NOVO — Fonoclama)                                  │
   │ usuarios      (compartilhada — todas as 5 apps leem/autenticam)   │
   │ RLS: cada tabela nova tem policies próprias (mesmo padrão)        │
   └────────────────────────────────────────────────────────────────────┘
```

**Ponto-chave:** não há camada de API própria, gateway, backend Node, nem schemas Postgres separados por módulo. Todos os apps — antigos e novos — falam diretamente com o mesmo Postgres via PostgREST (SDK Supabase), no mesmo schema `public`, diferenciados apenas por **prefixo de nome de tabela**. Isso é uma decisão já tomada e validada em produção; a pesquisa aqui apenas estende o padrão, não o questiona.

### Responsabilidades dos Componentes

| Componente                                                       | Responsabilidade                                                    | Implementação típica no projeto                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Portal (`/index.html`)                                         | Índice, navegação, status de cada módulo (produção/planejado) | HTML+CSS estático, cards com link`href="/modulo"`                                                                                  |
| App de módulo (`/transportes`, `/eletrica`, `/fonoclama`) | UI completa do domínio: CRUD, dashboards, alertas, exportação    | 1 arquivo`index.html` (estilo refrigeração) ou `index.html` + `app.js` (estilo máquinas)                                     |
| Auth (por app, hoje duplicado)                                   | Login por cargo, sessão, perfil                                    | Inline em cada app hoje;`/shared/auth.js` existe mas não é usado — **oportunidade real de reuso para os 3 módulos novos** |
| Supabase SDK                                                     | Cliente REST/Auth/Realtime                                          | `createClient(SUPABASE_URL, ANON_KEY)` — chave anônima embutida no JS, protegida por RLS                                          |
| PostgreSQL + RLS                                                 | Persistência + controle de acesso real                             | Tabelas prefixadas por módulo + policies`select/insert/update/delete to authenticated using (true)`                                |
| Migrações SQL                                                  | Versionamento de schema                                             | Arquivos numerados sequenciais em`/supabase/`, sempre aditivos (nunca `DROP`)                                                     |

## Estrutura de Projeto Recomendada (extensão da estrutura atual)

```
pmoc-overlay/
├── index.html                       # Portal — adicionar cards dos 3 módulos, mover de "Planejado" p/ "Em produção" a cada entrega
├── vercel.json                      # + 3 rewrites novos
│
├── maquinas/                        # existente, referência de ESTILO A (uso contínuo)
├── refrigeracao/                    # existente, referência de ESTILO B (checklist/inspeção)
│
├── transportes/                     # NOVO — estilo A (máquinas): ciclo de vida por uso (km/h)
│   ├── index.html
│   └── app.js
│
├── eletrica/                        # NOVO — estilo B (refrigeração): inspeções/tarefas periódicas
│   └── index.html                   # single-file, como refrigeração
│
├── fonoclama/                       # NOVO — estilo B (refrigeração): inspeções/tarefas periódicas
│   └── index.html
│
├── shared/
│   └── auth.js                      # candidato a ser finalmente adotado pelos 3 módulos novos
│
└── supabase/
    ├── 01–09 (existentes, produção — não tocar)
    ├── 10_transportes_schema.sql    # transp_* + RLS loop
    ├── 11_transportes_seed.sql      # dados legados consolidados (viaturas + embarcações)
    ├── 12_eletrica_schema.sql       # elet_* + RLS loop
    ├── 13_eletrica_seed.sql
    ├── 14_fonoclama_schema.sql      # fono_* + RLS loop
    └── 15_fonoclama_seed.sql
```

### Racional da Estrutura

- **Um diretório por módulo, sem pasta compartilhada de componentes de UI:** replica fielmente o padrão de `maquinas/` e `refrigeracao/` — cada app é autocontida e pode ser entregue/testada isoladamente sem risco de quebrar as demais. É a decisão já registrada no PROJECT.md ("módulos novos copiam padrão, sem núcleo compartilhado").
- **Migrações numeradas sequenciais, uma dupla schema+seed por módulo:** segue exatamente o padrão 01–09 já em produção (schema depois seed, nunca no mesmo arquivo) — facilita rollback parcial e auditoria.
- **`shared/auth.js` como ponto de melhoria oportunista:** hoje inconsistente (máquinas duplica auth inline; refrigeração tem outro padrão). Os 3 módulos novos são a primeira chance de padronizar sem risco, pois não existe comportamento em produção para quebrar. Não é obrigatório para o milestone, mas reduz triplicação de código de login em 3 apps novos.

## Padrões Arquiteturais

### Padrão 1: Prefixo de tabela por módulo (namespace via convenção, não via schema Postgres)

**O quê:** Cada módulo usa um prefixo curto e consistente em todas as suas tabelas: `maq_` (já existe), `transp_`, `elet_`, `fono_`. A refrigeração é a exceção histórica (tabelas sem prefixo: `equipamentos`, `plano_tarefas`, etc.) — tratada no PROJECT.md como pendência de convergência **fora do escopo** deste ciclo.
**Quando usar:** Sempre, para os 3 módulos novos — sem exceção, mesmo que o padrão "estilo refrigeração" seja copiado como referência de UI, o schema deve seguir o padrão prefixado de máquinas, não o de refrigeração.
**Trade-offs:** Prós — evita colisão de nomes num único schema `public`, facilita grep/auditoria, mantém o padrão que já funciona. Contras — nenhum real; é convenção pura, PostgREST expõe tudo do schema `public` igualmente independente de prefixo.

```sql
-- padrão a replicar (de 01_maquinas_schema.sql), trocando o prefixo:
create table if not exists transp_ativos (
  id serial primary key,
  codigo text unique, tipo text not null check (tipo in ('viatura','embarcacao')),
  ...
);
```

### Padrão 2: Dois "estilos" de app conforme natureza do ativo

**O quê:** O PROJECT.md já define isso — **estilo máquinas** (ciclo de vida por uso contínuo: horímetro/km, abastecimento, depreciação, `app.js` separado) para **Transportes**; **estilo refrigeração** (checklist de tarefas/inspeções periódicas, single-file) para **Elétrica** e **Fonoclama**.
**Quando usar:** Transportes puxa o schema de `maq_*` quase 1:1 (troca `uso_atual`/`unidade_uso` de horas de máquina para km/h de veículo, adiciona `tipo` viatura/embarcação, adiciona tabela de documentação com vencimento). Elétrica e Fonoclama puxam o schema conceitual de `equipamentos`/`plano_tarefas`/`logs_manutencao` de refrigeração, mas **com prefixo** (Padrão 1).
**Trade-offs:** Reaproveitar padrão validado reduz risco e tempo de decisão; risco é copiar também as partes que a refrigeração tem "erradas" (tabelas sem prefixo, 436KB num arquivo só) — evitar.

### Padrão 3: RLS replicado por bloco `do $$ ... $$` (loop sobre array de tabelas)

**O quê:** Cada schema novo repete o bloco de `01_maquinas_schema.sql:92-105`: habilita RLS e cria 4 policies (`select`/`insert`/`update`/`delete`) idênticas para cada tabela do módulo, usando `for t in array[...]`.
**Quando usar:** Em toda migração de schema novo (`10_transportes_schema.sql`, `12_eletrica_schema.sql`, `14_fonoclama_schema.sql`). Copiar o bloco, trocar apenas o array de nomes de tabela.
**Trade-offs:** Simples e comprovado; hoje é RLS "grosso" (qualquer usuário autenticado pode tudo, sem filtro por linha) — suficiente para o escopo atual (autenticação real, não autorização fina), mas não é o único padrão possível; documentado apenas como o padrão vigente, não como recomendação de segurança ideal.

```sql
do $$ declare t text; begin
  foreach t in array array['transp_ativos','transp_planos','transp_materiais',
                           'transp_uso_registros','transp_os','transp_abastecimentos',
                           'transp_documentos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (true)', 'sel_'||t, t);
    execute format('create policy %I on %I for insert to authenticated with check (true)', 'ins_'||t, t);
    execute format('create policy %I on %I for update to authenticated using (true)', 'upd_'||t, t);
    execute format('create policy %I on %I for delete to authenticated using (true)', 'del_'||t, t);
  end loop;
end $$;
```

### Padrão 4: Migração de dados legados via análise → consolidação → SQL seed

**O quê:** O precedente é `05_refrigeracao_import_171.sql` (171 unidades de uma planilha `.ods`) e `09_importa_frota_28.sql` (import incremental de frota). Para os módulos novos: apps legados funcionais existem fora do repo (prováveis múltiplas versões, provável `localStorage`), fornecidos pelo usuário por módulo.
**Quando usar:** Como primeira etapa de cada módulo, antes de qualquer schema definitivo — a análise dos dados legados informa quais colunas o schema precisa ter (ex.: se o legado de Transportes já rastreia vencimento de seguro por veículo, a tabela `transp_documentos` precisa desse campo desde o início).
**Trade-offs:** Adiciona uma fase de descoberta por módulo (não é código, é análise), mas evita retrabalho de schema — o padrão de máquinas em produção já mostra o custo de adicionar colunas depois (migrações 07-09 foram ajustes incrementais).

## Fluxo de Dados

### Fluxo de Runtime (idêntico ao existente — nenhuma mudança arquitetural)

```
[Usuário abre /transportes]
    ↓
[init() checa sessão Supabase] → [carregarUsuario()] → [mostrarApp()]
    ↓
[carregarTudo(): N queries paralelas .from('transp_*').select('*')]
    ↓
[Estado global: ATIVOS[], OS_LIST[], MATERIAIS[], DOCUMENTOS[]... (window scope)]
    ↓
[renderPainel(), renderAtivos(), renderDocumentos()... popula DOM]
    ↓
[Usuário interage: abre modal, salva] → [insert/update .from('transp_*')]
    ↓
[fecharModal() + carregarTudo() de novo — refetch completo, sem update otimista]
```

Esse é exatamente o padrão de `maq_ativos`/`carregarTudo()` documentado em `.planning/codebase/ARCHITECTURE.md` — os módulos novos não introduzem nenhum mecanismo de state/cache novo. Cada módulo é uma ilha de estado global, sincronizada por refetch total após cada gravação.

### Fluxo de Migração de Dados Legados (por módulo, antes do primeiro deploy)

```
[App(s) legado(s) do usuário — múltiplas versões, provável localStorage]
    ↓ (usuário exporta/fornece arquivos)
[Fase de análise: mapear campos, identificar versão mais completa/recente,
 detectar divergências entre versões]
    ↓
[Consolidação: merge manual/script, dedupe por chave natural
 (placa/registro para viaturas, nº de série p/ equipamentos elétricos)]
    ↓
[Dataset consolidado único por módulo]
    ↓
[SQL seed gerado: supabase/NN_<modulo>_seed.sql — insert com dados reais]
    ↓
[Execução no SQL editor do Supabase, mesmo fluxo do import das 171 unidades]
    ↓
[Validação: contagem de registros bate com fonte legada; app novo lê os dados]
```

### Fluxos-chave

1. **Autenticação por cargo:** idêntico nos 3 módulos novos — reaproveitar (idealmente via `shared/auth.js`, ver Padrão de estrutura acima) em vez de reduplicar inline como `maquinas/app.js` fez.
2. **Alertas de vencimento (Transportes — documentação):** é um fluxo novo em relação ao que existe hoje (nem máquinas nem refrigeração têm "vencimento de documento" como conceito central). Precisa de uma tabela própria (`transp_documentos`: tipo, ativo_id, data_vencimento, status calculado client-side comparando com `current_date`) e uma view/render de alertas no dashboard — não existe um padrão pronto no código atual para copiar 1:1, é a peça genuinamente nova da arquitetura.

## Considerações de Escala

Não é uma preocupação real neste domínio (uso interno, dezenas a poucas centenas de ativos por módulo — ex.: 171 na refrigeração é o maior volume existente). A tabela abaixo é ilustrativa, não prescritiva:

| Escala                                                                                                         | Ajuste de arquitetura                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Volume atual (dezenas–centenas de ativos por módulo, handful de usuários simultâneos)                      | Padrão atual (refetch completo, sem paginação) é suficiente — não otimizar prematuramente                                                                                                                                          |
| Se um módulo crescer muito (ex.: Transportes com centenas de viaturas + histórico de abastecimento por anos) | `carregarTudo()` com refetch total de tabelas de log (`transp_uso_registros`, `transp_abastecimentos`) pode ficar lento — considerar paginação ou filtro por período apenas quando/se isso for observado, não antecipadamente |
| Múltiplos módulos abertos simultaneamente no mesmo navegador (abas)                                          | Cada app tem sua própria sessão Supabase JS em memória de aba — sem conflito, já é o comportamento atual com máquinas+refrigeração                                                                                              |

### Prioridades de Escala

1. **Primeiro gargalo provável:** tabelas de log/histórico de uso (abastecimento, registros de horímetro/km) crescendo sem paginação em `carregarTudo()` — mesmo anti-padrão já documentado em `.planning/codebase/ARCHITECTURE.md` ("Overfetching on Every Edit"). Não é específico dos módulos novos, é herdado do padrão existente.
2. **Segundo gargalo:** arquivo único crescendo demais no estilo refrigeração (já em 436KB) — se Elétrica ou Fonoclama crescerem muito em funcionalidade, considerar separar em `index.html` + `app.js` (estilo máquinas) mesmo que a natureza do domínio seja "checklist". Isso é uma escolha de manutenibilidade de código, não de performance de runtime.

## Anti-Padrões (específicos desta expansão)

### Anti-Padrão 1: Copiar o padrão "sem prefixo" da refrigeração para os módulos novos

**O que as pessoas fazem:** Como o padrão "estilo refrigeração" é a referência de UI para Elétrica e Fonoclama, existe a tentação de copiar também o schema sem prefixo (`equipamentos`, `plano_tarefas` — nomes genéricos).
**Por que é errado:** Colisão de nome garantida — Elétrica e Fonoclama ambas teriam necessidade de tabelas como `equipamentos`/`plano_tarefas`, e não podem coexistir sem prefixo no mesmo schema `public`. É exatamente a pendência de "divergência RLP" já registrada como problema conhecido do sistema atual (fora do escopo resolver a divergência existente, mas os módulos novos não devem repeti-la).
**Fazer isto em vez disso:** Prefixo obrigatório em todo módulo novo — `transp_`, `elet_`, `fono_` — mesmo que a UI copie o estilo refrigeração, o schema segue o padrão de nomenclatura de máquinas.

### Anti-Padrão 2: Reduplicar código de auth inline em cada um dos 3 apps novos

**O que as pessoas fazem:** Copiar o bloco de auth inline de `maquinas/app.js` (linhas 711-889) para cada módulo novo, como já aconteceu entre máquinas e refrigeração (dois padrões de auth diferentes coexistindo hoje).
**Por que é errado:** Triplica manutenção — qualquer ajuste de fluxo de login (novo cargo, nova validação) precisa ser replicado em 5 lugares em vez de 1. É um anti-padrão já sinalizado em `.planning/codebase/ARCHITECTURE.md`.
**Fazer isto em vez disso:** Os módulos novos são a oportunidade de finalmente usar `/shared/auth.js` (existe, não usado) como módulo ES6 importado pelos 3 apps novos. Não é obrigatório resolver nos apps antigos, mas não faz sentido criar um quarto/quinto padrão de auth divergente ao construir do zero.

### Anti-Padrão 3: Desenhar schema novo antes de analisar os dados legados

**O que as pessoas fazem:** Criar o schema `transp_*`/`elet_*`/`fono_*` só olhando para o padrão de máquinas/refrigeração, sem antes olhar o que os apps legados do usuário já rastreiam.
**Por que é errado:** Legados podem ter campos específicos do domínio (ex.: nº de apólice de seguro, classe da embarcação, potência do amplificador) que não existem em nenhum módulo atual — descobrir isso depois de escrever o schema gera migração de ajuste (como aconteceu com refrigeração: schema 04, depois ajustes em 06-08).
**Fazer isto em vez disso:** Fase de análise dos arquivos legados é pré-requisito do schema, não trabalho paralelo — confirma o Padrão 4 acima.

## Pontos de Integração

### Serviços Externos

| Serviço                                                              | Padrão de integração                                                                                                                           | Observações                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Supabase (mesmo projeto`pmoc`, `thoaqipyhfmromsgzmjs`, sa-east-1) | `createClient(SUPABASE_URL, ANON_KEY)` — mesma URL/key em todos os apps, hardcoded no JS (padrão aceito do projeto, RLS é a segurança real) | Nenhum projeto/schema Supabase novo — os 3 módulos entram no mesmo backend |
| Vercel (deploy estático)                                             | `vercel.json` → adicionar 3 entradas em `rewrites`                                                                                           | Sem build step; cada módulo é só HTML/JS servido diretamente              |

```json
{
  "cleanUrls": true,
  "outputDirectory": ".",
  "rewrites": [
    { "source": "/refrigeracao", "destination": "/refrigeracao/index.html" },
    { "source": "/maquinas",     "destination": "/maquinas/index.html" },
    { "source": "/transportes",  "destination": "/transportes/index.html" },
    { "source": "/eletrica",     "destination": "/eletrica/index.html" },
    { "source": "/fonoclama",    "destination": "/fonoclama/index.html" }
  ]
}
```

### Fronteiras Internas

| Fronteira                                                    | Comunicação                                                                                            | Observações                                                                                                                                                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal ↔ cada módulo                                       | Link HTML puro (`<a href="/transportes">`), sem estado compartilhado                                   | Portal só precisa saber se o módulo está "em produção" ou "planejado" para trocar o card de seção e a tag de status                                                                   |
| Módulo novo ↔ módulo existente (máquinas/refrigeração) | Nenhuma — sem chamadas cruzadas, sem tabelas compartilhadas além de`usuarios`                        | Isolamento total por design; um módulo nunca lê tabela de outro (só`usuarios` é lida por todos para auth/perfil)                                                                       |
| Módulo novo ↔`usuarios` (tabela compartilhada)           | Leitura via`.from('usuarios').select('*').eq('auth_id', uid).single()` — mesmo padrão de máquinas   | Se um módulo novo precisar de um cargo que não existe ainda no`check` constraint de `role` (ex.: "condutor" para Transportes), é migração aditiva em `usuarios`, não tabela nova |
| Migrações SQL novas ↔ migrações existentes (01-09)      | Estritamente aditivo —`create table if not exists`, nunca `alter`/`drop` em tabelas de produção | Restrição dura do projeto: módulos em produção não podem quebrar                                                                                                                       |

## Ordem de Build Sugerida

A ordem de prioridade já está decidida no PROJECT.md (**Transportes → Elétrica → Fonoclama**), por decisão do usuário — não há dependência técnica forçando essa ordem (os 3 módulos são isolados entre si). A análise de arquitetura abaixo é sobre **por que essa ordem funciona bem tecnicamente** e como sequenciar as fases dentro de cada módulo.

**Sequência por módulo (repete-se 3x, uma vez por módulo):**

1. **Análise dos dados legados** (bloqueante — depende do usuário fornecer os arquivos) → informa o schema
2. **Schema + RLS** (`NN_<modulo>_schema.sql`) — copia o padrão de máquinas (Transportes) ou refrigeração-prefixado (Elétrica/Fonoclama)
3. **Seed de dados consolidados** (`NN_<modulo>_seed.sql`) — mesmo padrão do import das 171 unidades
4. **App frontend** (`index.html` [+ `app.js` se estilo máquinas]) — copia CSS/tokens de design de máquinas ou refrigeração
5. **Rota + portal** — `vercel.json` + card do portal movido de "Planejado" para "Em produção"

**Por que Transportes primeiro:**

- É o módulo mais complexo dos 3 (viaturas **e** embarcações no mesmo módulo, planos por km/horímetro, documentação com vencimento — um conceito genuinamente novo no sistema, abastecimento por condutor). Construir primeiro o mais complexo estabelece os padrões (schema de documentos com vencimento, por exemplo) que os módulos seguintes não precisam.
- Reaproveita quase diretamente o schema/UI de máquinas (já validado em produção), reduzindo risco apesar da complexidade de domínio.

**Por que Elétrica antes de Fonoclama:**

- Ambos seguem o mesmo estilo (refrigeração-simplificado: inspeções/tarefas periódicas), então o segundo dos dois é consideravelmente mais rápido — o schema e a UI de Elétrica servem de gabarito quase copy-paste para Fonoclama (troca de vocabulário de domínio: quadros/geradores vs. amplificadores/sirenes).
- Elétrica é infraestrutura crítica (energia) — priorizar sobre Fonoclama (sistema de alarme sonoro) faz sentido tanto tecnicamente (estabelece o gabarito) quanto operacionalmente.

**Implicação para o roadmap:** as 3 fases de análise legada (uma por módulo) são a única atividade que pode, em tese, rodar em paralelo entre módulos — dependem só do usuário fornecer arquivos, não de trabalho de código de outro módulo. Mas o build em si (schema → seed → app → deploy) deve ser sequencial por módulo, na ordem Transportes → Elétrica → Fonoclama, para não dividir foco e para deixar cada módulo consolidar aprendizado (principalmente de consolidação de dados legados) antes do próximo.

## Fontes

- `.planning/codebase/ARCHITECTURE.md` — arquitetura mapeada do sistema atual (fonte primária, verificada)
- `.planning/codebase/STRUCTURE.md` — layout de arquivos e convenção "How to Add a New Module" já documentada no próprio repositório
- `.planning/codebase/INTEGRATIONS.md` — detalhes de integração Supabase (auth, RLS, deploy Vercel)
- `.planning/PROJECT.md` — decisões já tomadas para este milestone (estilos por módulo, ordem, escopo)
- `supabase/01_maquinas_schema.sql`, `supabase/03_usuarios_cargos.sql` — padrão de schema/RLS/auth lido diretamente do código em produção
- `vercel.json`, `index.html` (portal) — configuração de rotas e navegação lidas diretamente

---

*Pesquisa de arquitetura para: expansão de módulos PMOC (Transportes, Elétrica, Fonoclama)*
*Pesquisado em: 2026-08-08*
