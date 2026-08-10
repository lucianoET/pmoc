---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 1
current_phase_name: Transportes — Frota sob manutenção
status: executing
stopped_at: Phase 1 context gathered
last_updated: "2026-08-08T12:07:26.441Z"
last_activity: 2026-08-10
last_activity_desc: Migrações 17–21 aplicadas; locais unificados em cmasm_locais (233 físicos, 29 prédios, 132 salas) e 5 módulos no ar
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-08)

**Core value:** Cada módulo novo entra no ar seguindo o padrão pmoc existente (Vercel + Supabase + login por cargo), com os dados legados consolidados e importados — sem quebrar os módulos em produção.
**Current focus:** Fase 1 — Transportes — Frota sob manutenção

## Current Position

Phase: 1 of 4 (Transportes — Frota sob manutenção)
Plan: 0 of TBD in current phase
Status: Ready to execute
Last activity: 2026-08-08 — Roadmap criado (4 fases, 24/24 requisitos mapeados)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisões completas em PROJECT.md (Key Decisions). Relevantes agora:

- Novos módulos copiam o padrão atual — sem refatorar refrigeração e máquinas
- **Revisto em 09/08/2026:** elétrica e fonoclama têm modelo de manutenção idêntico,
  então compartilham o motor `shared/modulo-manutencao.js` em vez de duplicar ~700
  linhas duas vezes. Cada módulo é só um arquivo de configuração. Os módulos em
  produção continuam intocados — o núcleo comum vale só para os módulos novos.
- Transportes = estilo máquinas (`index.html` + `app.js`); Elétrica/Fonoclama = estilo refrigeração (arquivo único)
- Ordem: Transportes → Elétrica → Fonoclama (prioridade do usuário)
- Dados legados: analisar → consolidar → importar via SQL seed (bloqueante antes do schema)
- Contratação pública (ARP/empenho) fora dos módulos novos

### Pending Todos

- ✅ Migrações 14–16 executadas pelo usuário; `/eletrica` e `/fonoclama` no ar
  (contagens conferidas via REST: 13/9/11/14 e 10/7/10/13).
- ✅ Migrações 17–21 aplicadas e conferidas em produção (10/08/2026): 233 locais
  físicos, 29 edificações, 132 salas, 78 nós de organograma em `cmasm_estrutura`,
  171 equipamentos ligados por `local_id`, zero órfão na árvore.
- Resolver pela tela os locais de Elétrica e Fonoclama que ficaram sem vínculo
  (textos dos apps de demonstração; query de conferência no rodapé da migração 21).
- Seguir o fluxo manual das seções "Predial" e "Locais compartilhados" do `TESTES.md`.

### Módulos fora do roadmap original

Predial não estava no roadmap v1 (que previa Transportes, Elétrica e Fonoclama).
Entrou por decisão do usuário em 09/08/2026, por ser o legado com schema e seed
de dados reais já prontos. A Fase 2 (Transportes — abastecimento, documentação e
painel) segue pendente.

### Blockers/Concerns

- **Fase 1 bloqueada por insumo do usuário:** apps legados de transportes (várias versões, provavelmente localStorage) ainda não fornecidos. Mesmo bloqueio se repete nas Fases 3 (elétrica) e 4 (fonoclama).
- **Decisão pendente na Fase 1:** RLS — corrigir o padrão permissivo herdado ou replicá-lo. Mínimo esperado: `observador` somente leitura.
- **Decisão pendente na Fase 1:** reutilizar `shared/auth.js` por caminho absoluto em vez de duplicar o fluxo de login inline (hoje `maquinas/app.js` duplica).
- **Risco recorrente:** Supabase é compartilhado com produção — revisar cada migração e fazer smoke test em Refrigeração e Máquinas após aplicá-la.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-08T11:11:10.788Z
Stopped at: Phase 1 context gathered
Resume file: .planning/phases/01-transportes-frota-sob-manuten-o/01-CONTEXT.md
