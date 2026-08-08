# Walking Skeleton — PMOC · CMASM · Módulo Transportes

**Phase:** 1
**Generated:** 2026-08-08

> **Nota importante:** o walking skeleton desta fase **já está em produção**. Ele foi construído
> fora do fluxo GSD (commits de 2026-08-08) e verificado no ambiente real. Este documento **registra
> a fatia já comprovada** com apontadores de evidência, em vez de planejar scaffolding redundante.
> As Fases 1.x seguintes constroem fatias verticais sobre estas decisões sem renegociá-las.

## Capability Proven End-to-End

Um usuário autenticado por cargo abre `/transportes` no Vercel, vê a frota real (9 viaturas e
embarcações) lida do Postgres, cadastra/edita um ativo e registra uma viagem — e a escrita persiste
no mesmo projeto Supabase que serve Refrigeração e Máquinas.

## Evidência da Fatia Comprovada

| Camada | Evidência | Estado |
|---|---|---|
| Rota publicada | `vercel.json` → `{ "source": "/transportes", "destination": "/transportes/index.html" }` | ✅ em produção |
| Entrada do portal | `index.html` → card `<a class="card" href="/transportes">` | ✅ em produção |
| UI | `transportes/index.html` (371 linhas) — abas Painel/Frota/Viagens/Manutenção/Relatórios | ✅ em produção |
| Lógica de app | `transportes/app.js` (791 linhas) — globals + `carregarTudo()` + `render*()` | ✅ em produção |
| Login por cargo | `transportes/app.js:1` → `import { Auth } from '../shared/auth.js'` | ✅ em produção |
| Cliente Supabase | `transportes/app.js:2` → `import { criarClienteSupabase } from '../shared/supabase-config.js'` | ✅ em produção |
| Leitura real do banco | `carregarTudo()` → `Promise.all` sobre `transp_ativos`, `transp_viagens`, `transp_manutencoes` | ✅ 9 ativos, 23 viagens |
| Escrita real no banco | `salvarAtivo()`, `salvarViagem()`, `salvarManutencao()` | ✅ em produção |
| Schema | `supabase/10_transportes_schema.sql` (aplicada) | ✅ aplicada |
| Seed do legado | `supabase/11_transportes_seed.sql` (aplicada, idempotente via `chave_importacao`) | ✅ aplicada |

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Nenhum — HTML5 + JavaScript vanilla (ES modules) | Zero-build é restrição do projeto; sem npm, bundler ou `package.json` |
| Entrega de dependências | CDN jsDelivr (`@supabase/supabase-js@2` UMD) | Padrão já estabelecido por Refrigeração e Máquinas |
| Data layer | Postgres gerenciado (Supabase, projeto `pmoc` / `thoaqipyhfmromsgzmjs`, `sa-east-1`) | Backend único compartilhado pelos cinco módulos |
| Acesso a dados | Browser fala direto com PostgREST via SDK — sem camada de API própria | Não há backend próprio no projeto; segurança real fica na RLS |
| Auth | Login por cargo (botão + senha) via `shared/auth.js`, sessão JWT do Supabase Auth em `localStorage` | Módulo compartilhado reutilizado por caminho relativo; **não** duplicar o fluxo inline |
| Autorização | RLS no Postgres é o controle real; checagem client-side (`podeEditar()`) é apenas UX | A `anon key` é pública por design (CLAUDE.md) |
| Estilo de arquivo | `index.html` + `app.js` separados (estilo Máquinas) | Decisão de PROJECT.md para o módulo Transportes |
| Estado da aplicação | Globals `UPPER_CASE` + `carregarTudo()` (Promise.all) + `render*()` reconstruindo seções | Padrão dos dois módulos em produção; sem atualização otimista |
| Migrações | Arquivos SQL numerados em `supabase/`, aplicados no SQL Editor — **aditivos, nunca destrutivos** | Base compartilhada com produção; arquivamento com `ativo = false` |
| Prefixo de tabela | `transp_` para todo objeto novo (tabelas, policies, funções) | Isola o módulo e evita colisão com Refrigeração/Máquinas |
| Deployment target | Vercel estático via push no GitHub, sem build command | `vercel.json` com `cleanUrls` e rewrites por módulo |
| Idioma | Português em código, comentários, commits, UI e docs | Restrição do projeto |

## Stack Touched in Phase 1

- [x] Project scaffold — não aplicável (zero-build); estrutura de diretórios `transportes/` criada
- [x] Routing — rota real `/transportes` publicada via `vercel.json`
- [x] Database — leitura real (`transp_ativos`, `transp_viagens`) **e** escrita real (ativos, viagens, manutenções)
- [x] UI — elementos interativos reais (modais de ativo/viagem/manutenção) ligados ao banco
- [x] Deployment — módulo servido pelo Vercel; execução local via `python -m http.server` na raiz do repo

## Out of Scope (Deferred to Later Slices)

Explicitamente **fora** do esqueleto — não relitigar a minimalidade da Fase 1:

- Abastecimento, consumo médio e custo por km/hora → Fase 2 (TRANSP-05)
- Documentos por ativo com vencimento escalonado (licenciamento, seguro, vistoria) → Fase 2 (TRANSP-06)
- Dashboard ampliado de disponibilidade da frota → Fase 2 (TRANSP-08)
- Agendamento avançado do legado (solicitante, prioridade, sugestão por habilitação) → backlog
- Cadastro de motoristas e habilitações (entidade condutor) → backlog
- Papeleta 6 de Serviço (formulário naval impresso) → backlog
- Calculadores de vida útil e custo → backlog
- Fluxo de contratação pública (ARP, empenho, fiscalização) → fora do ciclo por decisão de PROJECT.md
- Refatoração dos módulos existentes ou criação de núcleo compartilhado → fora do ciclo
- Núcleo de build/tooling (npm, bundler, framework) → permanentemente fora de escopo

## Subsequent Slice Plan

Cada plano adiciona uma fatia vertical sobre este esqueleto, **sem alterar** as decisões
arquiteturais acima:

- **Plano 01-01:** Gestor cadastra plano de manutenção por `tipo_modelo` (km/h) e o sistema passa a
  apontar manutenções vencidas e próximas calculadas por uso (TRANSP-02, TRANSP-04)
- **Plano 01-02:** Gestor cadastra peças com estoque mínimo, registra entradas e vê alerta de
  estoque baixo (TRANSP-07)
- **Plano 01-03:** Gestor vincula peças ao plano e exporta a lista de compras em CSV; técnico abre e
  conclui OS com baixa automática de estoque e atualização do uso do ativo (TRANSP-07, TRANSP-03)
- **Plano 01-04:** Usuário confere o inventário importado contra o mapa legado, valida o login por
  cargo com escrita bloqueada para `observador`, e confirma que Refrigeração e Máquinas seguem
  funcionando (TRANSP-01, TRANSP-09, INTEG-02, INTEG-03, INTEG-04)

Fases seguintes (2, 3, 4) reaplicam o mesmo esqueleto para abastecimento/documentos, `/eletrica` e
`/fonoclama`.
