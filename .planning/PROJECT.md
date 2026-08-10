# PMOC · CMASM — Plataforma Modular de Manutenção

## What This Is

Sistema modular de gestão da manutenção de ativos do CMASM (Centro de Mísseis e Armas Submarinas da Marinha, UASG 744030). Cada domínio de ativos é um módulo/app independente servido estaticamente pelo Vercel sobre um único backend Supabase (PostgreSQL + Auth + RLS). Já existem dois módulos em produção (Refrigeração v2.8 e Máquinas v1.0); este ciclo adiciona três novos: **Transportes, Elétrica e Fonoclama**, portando apps legados funcionais para o padrão pmoc.

## Core Value

Cada módulo novo entra no ar seguindo o padrão pmoc existente (Vercel + Supabase + login por cargo), com os dados legados consolidados e importados — sem quebrar os módulos em produção.

## Current Milestone: v2.0 — Consolidação da plataforma

**Goal:** Unificar a base visual e de código dos módulos e entregar as capacidades transversais sobre essa base, em vez de implementá-las seis vezes.

**Target features:**
- Base unificada: `shared/pmoc.css` como fonte única de tokens e `shared/auth.js` em todos os módulos
- Tema claro/escuro em uma implementação só
- UI/UX mobile nos módulos que ainda não têm tratamento responsivo
- Kanban e calendário extraídos de `maquinas/` para `shared/` e adotados nos demais
- Documentos: exportação CSV unificada, importação de arquivo e geração de PDF
- Mapa integrado aos ativos dos módulos via `cmasm_locais.local_id`

**Fora do escopo, por decisão do usuário (10/08/2026):** o módulo `refrigeracao/` fica congelado. São 2663 linhas em arquivo único de 436 KB e é o app mais valioso em produção (contratação pública completa) — migrá-lo seria metade do esforço com o maior risco. Milestone próprio depois, com o padrão já provado.

**Sequência obrigatória:** a fase de base é pré-requisito das de tema e mobile. Feitas antes da unificação, seriam refeitas depois.

## Requirements

### Validated

- ✓ Portal índice em `/` — existing
- ✓ Módulo Refrigeração: 171 unidades, fluxo de contratação pública completo (ARP 04/2024), QR, impressão — existing
- ✓ Módulo Máquinas: 7 ativos, planos por `tipo_modelo`, estoque com baixa automática, combustível, depreciação, lista de compras CSV — existing
- ✓ Auth por cargo (admin/gestor/tecnico/observador) via Supabase + tabela `usuarios`, RLS como segurança real — existing
- ✓ Migrações SQL aditivas numeradas em `supabase/` — existing

### Active

- [ ] Módulo **Transportes** (fase 1 — prioridade): viaturas E embarcações
  - [ ] Manutenção por km/horímetro (planos por modelo, OS, peças — padrão máquinas)
  - [ ] Abastecimentos por veículo/condutor com consumo médio
  - [ ] Documentação com alertas de vencimento (licenciamento, seguro, vistorias)
  - [ ] Embarcações com horas de motor
- [ ] Módulo **Elétrica**: infraestrutura elétrica — estilo refrigeração (inspeções/tarefas)
- [ ] Módulo **Fonoclama**: sistema PA 70V — estilo refrigeração (inspeções/tarefas)
- [ ] Para cada módulo: analisar apps legados funcionais (várias versões), consolidar e adaptar para Vercel+Supabase
- [ ] Importar inventários existentes via SQL seed (planilhas/dados dos apps legados)
- [ ] Portal atualizado com links e status dos novos módulos
- [ ] Rotas novas em `vercel.json` (`/transportes`, `/eletrica`, `/fonoclama`)

### Out of Scope

- Fluxo de contratação pública (ARP/empenho/fiscalização) nos módulos novos — só manutenção interna por ora; entra depois se precisar
- Módulo Calibração (metrologia) — não selecionado para este ciclo
- Refatoração dos módulos existentes (refrigeração/máquinas) — mantêm-se como estão
- Núcleo compartilhado genérico / plataforma multi-organização — decisão: módulos novos copiam o padrão, sem refatorar para core comum
- Build tooling (npm, bundler, framework) — mantém zero-build

## Context

- Codebase mapeado em `.planning/codebase/` (ARCHITECTURE, STACK, CONVENTIONS, TESTING, CONCERNS, INTEGRATIONS, STRUCTURE).
- Padrões de referência: **estilo máquinas** (`index.html` + `app.js`, ciclo de vida por uso) para Transportes; **estilo refrigeração** (single-file, checklist de tarefas/inspeções) para Elétrica e Fonoclama.
- Apps legados funcionais existem fora deste repo (várias versões, provavelmente localStorage) — usuário fornecerá os arquivos quando cada módulo for construído; cada módulo começa com fase de análise/consolidação.
- Supabase projeto `pmoc` (`thoaqipyhfmromsgzmjs`, sa-east-1); `anon key` pública por design, RLS protege.
- Convenções: português em tudo; migrações aditivas (nunca DROP); prefixo de tabela por módulo (como `maq_`); login por cargo sem expor e-mail.
- Pendências conhecidas do README (divergência RLP, senhas iniciais) não fazem parte deste ciclo.

## Constraints

- **Tech stack**: HTML + vanilla JS + Supabase SDK via CDN, zero-build — padrão estabelecido, novos módulos copiam
- **Compatibilidade**: módulos em produção (refrigeração, máquinas) não podem quebrar — migrações aditivas, sem alterar tabelas existentes
- **Deploy**: Vercel estático via push no GitHub `luctronics-ET/pmoc` (produção em `https://pmoc-orcin.vercel.app`) — sem build command
- **Idioma**: português em código, commits, UI e docs
- **Dependência**: apps legados e planilhas fornecidos pelo usuário por módulo — análise/consolidação precede implementação

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Novos módulos copiam padrão atual (sem núcleo compartilhado) | Padrão comprovado em produção; refatorar core adiaria entregas | — Pending |
| Transportes = estilo máquinas; Elétrica/Fonoclama = estilo refrigeração | Natureza dos ativos: uso contínuo (km/h) vs inspeções periódicas | — Pending |
| Contratação pública fora dos módulos novos | Necessidade ainda não confirmada; reduz escopo | — Pending |
| Ordem: Transportes → Elétrica → Fonoclama | Prioridade declarada pelo usuário | — Pending |
| Dados legados: analisar → consolidar → importar via SQL seed | Repete o fluxo comprovado da importação das 171 unidades | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-08 after initialization*
