# Phase 1: Transportes — Frota sob manutenção - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Módulo `/transportes` (já publicado, v1.0 com Frota/Viagens/Manutenção) evolui até cobrir manutenção por uso: planos por `tipo_modelo` (km/horas), detecção de manutenção vencida, OS vinculada a ativo+plano+peças com baixa de estoque e lista de compras CSV — sem quebrar refrigeração/máquinas (migrações aditivas).

**IMPORTANTE — estado real difere do roadmap:** o módulo já existe em produção (commits de 2026-08-08 fora do fluxo GSD; migrações 10/11 aplicadas; `transp_ativos` 9, `transp_viagens` 23). A fase NÃO parte do zero: TRANSP-01, TRANSP-09 (parcial), INTEG-02 já entregues. O plano deve focar nos gaps (ver `01-LEGACY-CONSOLIDATION.md` §3).

</domain>

<decisions>
## Implementation Decisions

### Dados legados & import
- **D-01:** Legado fornecido em `ref/` — versão única (`transportes (2).html`; a (3) é duplicata md5). Mapa VTR/EMB já importado como seed (9 ativos, 23 viagens).
- **D-02:** Conferência pós-import: Claude gera relatório (contagens por categoria + amostra de ativos) e o usuário valida contra o legado antes de dar TRANSP-09 por concluído.

### Modelagem viatura×embarcação
- **D-03:** Tabela única `transp_ativos` com `tipo` (viatura/embarcacao) + `unidade_uso` (km/h) — já implementada no schema 10; manter.
- **D-04:** Planos de manutenção por `tipo_modelo` com unidade herdada do modelo — plano usa a unidade do modelo, impossibilitando misturar km em embarcação.
- **D-05:** Identificação (placa/chassi/RENAVAM/inscrição) no cadastro do ativo na Fase 1; tabela de documentos com vencimento fica p/ Fase 2 (TRANSP-06).
- **D-06:** Estoque próprio do módulo: `transp_materiais` + `transp_estoque_movimentos` (padrão maq_, prefixo próprio, sem compartilhar com máquinas).

### Base de código & UI (resolvida pela realidade do código)
- **D-07:** Evoluir o `transportes/app.js` existente (791 linhas, Supabase via `shared/supabase-config.js`) — não fork novo, não rewrite. Novas seções (Planos, Estoque) seguem o padrão de abas atual.

### Claude's Discretion
- Estratégia de consolidação de versões do legado e conteúdo do seed — usuário delegou; consolidação feita em `01-LEGACY-CONSOLIDATION.md` (versão única; histórico legado vazio, nada a migrar).
- RLS & auth (área não selecionada p/ discussão): decidir no plano. Mínimo esperado (STATE.md): `observador` read-only; avaliar reutilizar `shared/auth.js`. Validar por que a sessão "Gestor" abriu sem login no teste de produção.
- Features do legado não portadas (agendamento avançado, habilitações, Papeleta 6): incluir no plano apenas o que serve aos requisitos da fase; resto → deferred.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fase / consolidação
- `.planning/phases/01-transportes-frota-sob-manuten-o/01-LEGACY-CONSOLIDATION.md` — inventário de `ref/`, estado atual do módulo, tabela de gaps (LEITURA OBRIGATÓRIA)
- `.planning/ROADMAP.md` — Fase 1: goal, success criteria, requisitos

### Código em produção (base a evoluir)
- `transportes/app.js` + `transportes/index.html` — módulo atual
- `supabase/10_transportes_schema.sql` — schema transp_ existente
- `supabase/11_transportes_seed.sql` — seed importado do mapa VTR/EMB
- `shared/supabase-config.js` e `shared/auth.js` — infra compartilhada

### Padrão de referência (estilo máquinas)
- `maquinas/app.js` — planos por tipo_modelo, OS com baixa de estoque, lista de compras CSV
- `supabase/01_maquinas_schema.sql` — schema de referência p/ planos/materiais/OS

### Domínio legado
- `ref/transportes (2).html` — app legado (features de agendamento, habilitações)
- `ref/5 Transportes Entidades.md` — modelo de domínio (viagem incrementa uso, Papeleta 6, regras de sobreaviso)
- `ref/Mapa de VTR e EMB ATU 20FEV26.csv` — fonte da frota importada

### Convenções / riscos
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/CONCERNS.md` — RLS permissiva, migrações aditivas, zero-build

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `transportes/app.js`: CRUD de frota/viagens/manutenções funcionando; viagem com uso_saida/uso_chegada
- `maquinas/app.js`: lógica pronta de planos por tipo_modelo, comparação uso_atual×intervalo, baixa de estoque, CSV de compras — portar padrão
- `shared/supabase-config.js`: cliente único (transportes já usa)

### Established Patterns
- Globals UPPER_CASE + `carregarTudo()` + `render*()`; migração SQL numerada aditiva; prefixo `transp_`
- Seeds idempotentes (`chave_importacao` unique em transp_viagens)

### Integration Points
- `vercel.json` rota `/transportes` ✓; portal `/index.html` card ✓
- Tabela `usuarios` compartilhada p/ login por cargo
- Deploy: push GitHub `luctronics-ET/pmoc` → Vercel (atenção: workdir origin = `pmoc-overlay`, repo distinto do que o Vercel escuta)

</code_context>

<specifics>
## Specific Ideas

- Relatório de conferência do import no formato "contagens por tipo + amostra" p/ validação manual do usuário
- Detecção vencida segue semântica de máquinas: vencida vs próxima (limiar de antecedência)

</specifics>

<deferred>
## Deferred Ideas

- Abastecimento/consumo, documentos com vencimento, dashboard ampliado → Fase 2 (TRANSP-05/06/08)
- Agendamento avançado do legado (solicitante, prioridade, sugestão por habilitação), cadastro de motoristas/habilitações, Papeleta 6 de Serviço, calculadores de custo — avaliar em fase futura/backlog
- Módulos cftv/paiol/predial/seguranca/grama vistos em `ref/` — fora do ciclo

</deferred>

---

*Phase: 1-Transportes — Frota sob manutenção*
*Context gathered: 2026-08-08*
