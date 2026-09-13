---
status: complete
date: 2026-08-10
---

# Renumeração das migrações da Fase 1 (Transportes)

Os planos da Fase 1 apontavam para `supabase/14_transportes_planos_rbac.sql` e
`supabase/15_transportes_estoque_os.sql`, mas os números 14 e 15 já estão ocupados
por `14_eletrica_fonoclama_schema.sql` e `15_eletrica_seed.sql`. Último número em
uso: 21. Renumerado para 22 e 23.

## Alterações

- `01-01-PLAN.md` — 14 → 22 (incl. sentinelas `MIGRACAO_22_OK`, `MIGRACAO_22_PRONTA_PARA_APLICACAO`)
- `01-02-PLAN.md` — 15 → 23 (incl. sentinelas `MIGRACAO_23_*`) e referência cruzada à migração 22
- `01-03-PLAN.md` — referência ao modelo de ameaças ajustada para "migração 23"
- `01-04-PLAN.md` — gates de não regressão apontam para 22 e 23
- `01-PATTERNS.md`, `01-RESEARCH.md` — `14_transportes_planos_estoque_os.sql` → `22_...`

Nenhum arquivo SQL foi criado; as migrações serão escritas durante a execução da fase.
