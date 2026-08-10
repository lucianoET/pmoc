# Milestones — PMOC · CMASM

## v1.0 — Transportes, Elétrica e Fonoclama (parcial) · 08–10/08/2026

**Objetivo:** portar apps legados funcionais para o padrão pmoc (Vercel + Supabase + login por cargo), com os dados consolidados e importados, sem quebrar os módulos em produção.

**Entregue:**

- **Fase 1 — Transportes: frota sob manutenção** ✅
  - Migração 22: `transp_planos` e RBAC (`transp_pode_escrever()`, exige cargo e `usuarios.ativo`)
  - Migração 23: estoque de peças, vínculo plano-material, colunas de OS
  - Migração 24: inventário completo da frota — 43 ativos (33 viaturas, 10 embarcações)
  - Frontend: aba Planos com vencimento por km/h, aba Estoque, lista de compras em CSV, OS com baixa automática
  - Requisitos: TRANSP-01, 02, 03, 04, 07, 09 · INTEG-02, INTEG-04
- **Fora do roadmap original, entregue no período:** módulos Elétrica, Fonoclama, Predial e Mapa; tabela unificada `cmasm_locais` (311 locais) com árvore colapsável

**Achado mais relevante:** o seed original de transportes importou 9 de 43 ativos porque usou a "Programação de Viaturas de Rotina" (registro de viagens de um dia) no lugar do mapa da frota. Descoberto no checkpoint de conferência da Fase 1 e corrigido na migração 24. Registro completo em `.planning/phases/01-transportes-frota-sob-manuten-o/01-CONFERENCIA-IMPORT.md`.

**Não entregue, adiado para depois do v2.0:**

- Fase 2 — Transportes: abastecimento, documentação e painel (TRANSP-05, 06, 08)
- Fase 3 — Elétrica: inspeções (ELET-01 a 06) — o módulo está no ar, mas o ciclo de inspeção planejado não foi construído
- Fase 4 — Fonoclama: testes das zonas (FONO-01 a 05) — mesma situação
- INTEG-01 (portal com status) e INTEG-03 (verificação de ponta a ponta do login por cargo)

**Por que adiado:** decisão do usuário em 10/08/2026 — consolidar a plataforma antes de continuar o trabalho de domínio, para que as fases 2 a 4 sejam construídas uma única vez, já sobre a base unificada.

---

## v2.0 — Consolidação da plataforma · em andamento

**Objetivo:** unificar a base visual e de código dos módulos e entregar as capacidades transversais sobre essa base, em vez de implementá-las seis vezes.

Fases 5 a 10. Ver `ROADMAP.md`.
