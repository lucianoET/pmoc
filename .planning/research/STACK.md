# Stack Research

**Domain:** Módulos de manutenção de ativos (frota/veículos+embarcações, infraestrutura elétrica, sistema de som 70V) sobre stack zero-build já em produção (PMOC/CMASM)
**Researched:** 2026-08-08
**Confidence:** MEDIUM (stack central verificada em fontes oficiais; decisões de detalhe inferidas do código existente do repositório)

> **Restrição de escopo (herdada do milestone):** este documento **não propõe trocar o stack**. HTML + JS vanilla + Supabase JS SDK via CDN + Vercel + PostgreSQL/RLS está validado em produção (Refrigeração v2.8, Máquinas v1.0) e os três módulos novos (Transportes, Elétrica, Fonoclama) devem copiar esse padrão. O que segue é: (1) confirmação de versões atuais das peças já usadas, (2) como resolver as necessidades específicas dos módulos novos (QR, CSV, alerta de vencimento, uso por km/horímetro) **dentro** do padrão zero-build, e (3) armadilhas de Postgres/RLS a evitar.

## Recommended Stack

### Core Technologies (já em uso — manter)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@supabase/supabase-js` (CDN, build UMD) | `2` — resolvido hoje para `2.112.2` (verificado via registry.npmjs.org e data.jsdelivr.com em 2026-08-08) | Cliente único de banco/auth/RLS para todos os módulos | Já é a peça central dos dois apps em produção; não há motivo de domínio para trocar. Confirmado nos docs oficiais do supabase-js que o carregamento via `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">` expõe `window.supabase.createClient` — exatamente o padrão usado em `refrigeracao/index.html:341` e `maquinas/index.html:8` |
| HTML5 + JS ES6+ (vanilla, sem framework) | N/A | Todo o frontend dos 3 módulos novos | Consistência é mais valiosa que produtividade marginal de um framework aqui — projeto pequeno, equipe única, zero-build é decisão já tomada e fora de escopo revisitar |
| Vercel (static hosting + rewrites) | N/A | Deploy dos 3 módulos novos | Basta adicionar 3 entradas em `vercel.json.rewrites`; nenhuma infraestrutura nova |
| PostgreSQL via Supabase (RLS) | Gerenciado pela Supabase (não versionado pelo usuário) | Schema + segurança por tabela | Já hospeda `maquinas` e `refrigeracao`; módulos novos entram como schemas/tabelas adicionais no mesmo projeto (`thoaqipyhfmromsgzmjs`, sa-east-1) |

### Módulo de autenticação compartilhado — usar, não duplicar

| Item | Detalhe |
|------|---------|
| `/shared/auth.js` | Módulo ES (`export class Auth`) já pronto para login por cargo (Direção/Gestor/Técnico/Livre), **já cita "fonoclama" no próprio comentário de exemplo de uso** como consumidor esperado. Uso: `<script type="module">import { Auth } from '/shared/auth.js'` — nativo do browser, zero-build, nenhuma dependência nova. |
| Por que importa | O `ARCHITECTURE.md` do codebase já documentou como anti-padrão o fato de `maquinas/app.js` ter duplicado a UI de login inline em vez de usar `/shared/auth.js`. Os 3 módulos novos devem importar o módulo compartilhado desde o início — evita repetir a dívida técnica, sem exigir nenhuma decisão de stack nova. |
| Confiança | HIGH — verificado lendo o arquivo fonte diretamente no repositório, não inferido |

### Supporting Libraries (necessidades específicas dos módulos novos)

| Necessidade | Library/Approach | Version | When to Use |
|---------|---------|---------|-------------|
| Geração de QR code (inspeção em campo, etiquetas de ativo) | `qrcode-generator` (Kazuhiko Arase, MIT) — **já vendorizada inline** em `refrigeracao/index.html` (linha ~2495, "Lib QR: qrcode-generator 1.4.4 embutida") | v1.4.4 já embutida no repo; upstream segue mantida (npm mostra 2.0.4 como versão atual, ~386 projetos dependentes) | Reaproveitar o mesmo trecho vendorizado nos módulos Transportes/Elétrica/Fonoclama sempre que precisar de QR (ex.: etiqueta de viatura, ponto de inspeção elétrica, caixa de som). **Não introduzir nova lib de QR** — copiar o bloco já testado em produção mantém consistência e evita 2 implementações divergentes |
| Exportação de dados (lista de compras, relatórios) | CSV via `Blob` + `URL.createObjectURL` — **já implementado sem biblioteca** em `maquinas/app.js:331` (`exportarComprasCSV`) | Nativo do browser, sem dependência | Copiar o mesmo padrão (`new Blob([csv],{type:'text/csv'})` → link `<a download>`) para exportações dos módulos novos (ex.: lista de documentos a vencer em Transportes, relatório de inspeção elétrica) |
| Importação de dados legados | **SQL seed, não upload de CSV em runtime** — confirmado no `PROJECT.md`: "Importar inventários existentes via SQL seed" | N/A | Cada módulo novo replica o padrão já usado em `supabase/05_refrigeracao_import_171.sql` e `supabase/09_importa_frota_28.sql`: consolidar os dados legados fornecidos pelo usuário em um `.sql` de seed idempotente (`on conflict do nothing`), rodado manualmente no SQL Editor da Supabase. **Não é necessário nenhum parser de CSV client-side** para essa parte — o requisito de "CSV import" do projeto é resolvido fora do browser |
| Alerta de vencimento de documento (licenciamento, seguro, vistoria) | `Date` nativo + `Intl.RelativeTimeFormat` (ambos nativos do browser, sem CDN) | Nativo (suportado por todos os browsers modernos desde set/2020, sem IE — não é preocupação aqui) | Calcular `dias = Math.ceil((dataVencimento - hoje) / 86400000)` no JS de render e usar faixas de cor (verde/amarelo/vermelho) — é exatamente o padrão que `maquinas/app.js` já usa em `calcVencimentos()` (linha 160) para planos por uso (%), só que agora por **data de calendário** em vez de percentual de uso. `Intl.RelativeTimeFormat('pt-BR').format(dias,'day')` dá o texto "em 12 dias" sem biblioteca |
| Manutenção por km/horímetro (viaturas e embarcações) | Reaproveitar o padrão `maq_uso_registros` + `maq_planos` (campo `tipo_modelo`, `unidade_uso` = `'h'`/`'km'`) já existente em Máquinas | N/A | Não é uma nova necessidade técnica — é literalmente o padrão Máquinas (estilo já escolhido pelo usuário para Transportes no `PROJECT.md`). Prefixo de tabela `transp_` no lugar de `maq_`, mesma forma (`uso_atual`, `vida_util_h`) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase SQL Editor (dashboard) | Rodar migrações aditivas numeradas (`10_transportes_schema.sql`, `11_eletrica_schema.sql`, `12_fonoclama_schema.sql`, seeds subsequentes) | Seguir a numeração sequencial existente (`01`–`09`); nunca `DROP`/alterar tabelas de módulos já em produção |
| Servidor local estático (opcional) | `python -m http.server` ou similar para testar antes do deploy | Já documentado no `STACK.md` do codebase; nenhuma mudança necessária |

## Installation

Não há `npm install` — zero-build. Todo o setup por módulo novo é:

```html
<!-- 1. Supabase SDK (mesma versão flutuante usada nos módulos existentes) -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

<!-- 2. Auth compartilhado (ES module nativo) -->
<script type="module">
  import { Auth } from '/shared/auth.js'
  const supa = supabase.createClient(SUPA_URL, SUPA_KEY)
  const auth = new Auth(supa, { appNome: 'Transportes', appIcone: '🚚' })
  auth.mount('#login')
</script>
```

```sql
-- 3. Migração aditiva no supabase/ (exemplo Transportes)
-- supabase/10_transportes_schema.sql
create table transp_ativos ( ... );  -- prefixo por módulo, como maq_ e (implícito) refrigeração
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `qrcode-generator` vendorizado inline | Lib CDN externa tipo `qr-code-styling` (visual mais rico, gradientes/logo no QR) | Só se um módulo precisar de QR com identidade visual custom (ex.: QR com brasão da Marinha embutido) — não é o caso hoje; manter a lib já testada |
| `Date` nativo + `Intl.RelativeTimeFormat` | `date-fns` ou `day.js` via CDN | Só valeria a pena se os módulos precisassem de manipulação de datas complexa (fusos múltiplos, recorrência de calendário) — vencimento de documento é subtração simples, não justifica nova dependência |
| CDN `@2` flutuante (padrão atual) | Pin exato (`@2.112.2`) + SRI | Se a equipe quiser blindar contra quebra silenciosa por update de minor/patch da Supabase — ver nota de risco abaixo. Hoje os dois módulos em produção usam `@2` flutuante; manter consistência é mais importante que a robustez extra, a menos que já tenha havido incidente de quebra |
| RLS simples (`using (true)` para authenticated, sem diferenciar papel no banco) | RLS por papel com função `SECURITY DEFINER` (`private.get_user_role()`) checando `admin`/`gestor`/`tecnico`/`observador` por operação | Só se a auditoria/segurança exigir que a diferenciação de papel deixe de ser "UX-only" e passe a ser enforced no banco — hoje isso é dívida técnica conhecida e documentada em `ARCHITECTURE.md`, não escopo deste milestone. Documentado aqui para o roadmap decidir se algum módulo novo (ex.: Elétrica, mais sensível) quer subir o nível |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Qualquer framework (React/Vue/Svelte) ou bundler (Vite/Webpack) | Fora de escopo explícito do milestone ("Build tooling... — mantém zero-build"); quebraria consistência com os 2 módulos em produção | HTML + JS vanilla + `<script type="module">` nativo |
| Biblioteca de parsing CSV client-side (PapaParse etc.) para importação | O fluxo de importação de dados legados é via SQL seed manual, não upload de CSV pelo usuário final — confirmado no `PROJECT.md` | Seed `.sql` aditivo, mesmo padrão de `05_refrigeracao_import_171.sql` |
| Coluna `GENERATED ALWAYS AS (...) STORED` para status de vencimento (ex.: computar "vencido" direto no banco a partir da data de hoje) | PostgreSQL exige expressão **IMMUTABLE** em generated columns; `CURRENT_DATE`/`now()` são **VOLATILE** — o banco rejeita a criação da coluna. Confirmado na documentação oficial do Postgres (`ddl-generated-columns.html`) | Calcular o status no JS ao renderizar (mesmo padrão de `calcVencimentos()` em `maquinas/app.js`), ou criar uma `VIEW`/função SQL chamada sob demanda se precisar do cálculo também em queries server-side |
| Nova lib de geração de QR via CDN | Duplicaria uma capacidade que já existe testada e vendorizada em produção | Copiar o bloco `qrcode-generator` já embutido em `refrigeracao/index.html` |
| `day.js`/`date-fns`/`moment` via CDN só para "dias até vencer" | Overhead de dependência para algo que `Date` + `Intl.RelativeTimeFormat` nativos resolvem em poucas linhas | `Date` nativo + `Intl.RelativeTimeFormat('pt-BR')` |

## Stack Patterns by Variant

**Se o módulo for do tipo "uso contínuo" (Transportes — viaturas e embarcações, km/horímetro):**
- Copiar a estrutura de tabelas de Máquinas: `transp_ativos`, `transp_planos`, `transp_uso_registros`, `transp_os`, `transp_materiais`, `transp_abastecimentos`
- Adicionar campos específicos de documentação com vencimento por calendário (licenciamento, seguro, vistoria) como colunas de `date` simples em `transp_ativos` ou tabela `transp_documentos` separada (1:N, já que um veículo pode ter múltiplos documentos com vencimentos distintos)
- Porque: é literalmente o padrão que o usuário já escolheu ("estilo máquinas... ciclo de vida por uso") — a única peça nova é a camada de alerta por data de calendário, resolvida com `Date` nativo (ver acima)

**Se o módulo for do tipo "inspeção periódica" (Elétrica, Fonoclama):**
- Copiar a estrutura de Refrigeração: tabela de ativos/pontos de inspeção + `plano_tarefas` (checklist) + `logs_manutencao` (execução) + geração de QR por ponto de inspeção
- Porque: é o padrão que o usuário já escolheu ("estilo refrigeração... checklist de tarefas/inspeções") — reaproveita inclusive o mecanismo de QR já vendorizado

**Se qualquer módulo precisar de exportação de relatório:**
- Usar `Blob`/`URL.createObjectURL` (nativo), como em `exportarComprasCSV()` — não introduzir lib nova

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@supabase/supabase-js@2` (flutuante) | PostgreSQL gerenciado pela Supabase (schema atual) | Sem breaking changes conhecidos dentro do major `2` que afetem os padrões de query já usados (`.from().select().insert().update().delete()`); risco real é de patch silencioso mudar comportamento sem o time perceber, dado que a URL não é pinada — ver seção "Alternatives Considered" |
| `qrcode-generator` v1.4.4 (vendorizada) | Qualquer navegador ES6+ | Vendorizada = imune a mudanças upstream; só precisa reavaliar se algum módulo precisar de recurso ausente na v1.4.4 (ex.: correção de erro maior, tamanhos de QR muito grandes) |
| `Intl.RelativeTimeFormat` | Todos os browsers-alvo do projeto (Chrome/Firefox/Safari/Edge modernos, já exigidos pelo uso de CSS variables/ES6) | Sem necessidade de polyfill — o `STACK.md` do codebase já assume browsers modernos sem fallback |

## Sources

- `/supabase/supabase-js` (Context7, benchmark 74.7, "High" reputation) — confirmação do padrão de import via CDN (`<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">`) e uso global `window.supabase.createClient`. Confidence: MEDIUM (Context7 cap; cruzado com npm registry)
- `registry.npmjs.org/@supabase/supabase-js/latest` + `data.jsdelivr.com/v1/packages/npm/@supabase/supabase-js/resolved` (consulta direta em 2026-08-08) — versão atual `2.112.2`. Confidence: MEDIUM
- `/supabase/supabase` (Context7) — padrões de RLS multi-tabela com função `SECURITY DEFINER` para checar papel sem recursão. Confidence: MEDIUM
- `/websites/postgresql_current` (Context7, docs oficiais Postgres) — `ddl-generated-columns.html`: generated columns exigem expressão imutável, não podem usar `CURRENT_DATE`/`now()`. Confidence: MEDIUM (docs oficiais via Context7)
- WebSearch: "jsDelivr CDN pin exact version vs floating major version" — consenso de pinar versão exata + SRI em produção. Confidence: MEDIUM
- WebSearch: "Intl.RelativeTimeFormat browser support" (MDN, caniuse) — suportado desde set/2020 em todos os browsers modernos, sem IE. Confidence: MEDIUM
- WebSearch: "qrcode-generator kazuhikoarase maintenance status" — v2.0.4 é a versão atual do upstream, ~386 dependentes, ativamente usada. Confidence: MEDIUM
- Leitura direta do código-fonte do repositório (`refrigeracao/index.html`, `maquinas/app.js`, `maquinas/index.html`, `shared/auth.js`, `supabase/*.sql`, `vercel.json`) — Confidence: HIGH (fonte primária, não inferência)

---
*Stack research for: módulos de manutenção de ativos (Transportes, Elétrica, Fonoclama) sobre stack zero-build PMOC/CMASM*
*Researched: 2026-08-08*
