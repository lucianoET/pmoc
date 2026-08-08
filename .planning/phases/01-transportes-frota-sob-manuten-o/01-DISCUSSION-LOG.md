# Discussion Log — Fase 1: Transportes

**Data:** 2026-08-08

## Áreas selecionadas

Dados legados & import · Modelagem viatura×embarcação · Base de código & UI
(RLS & auth: não selecionada — delegada ao plano)

## Dados legados & import

| Pergunta | Opções | Resposta |
|---|---|---|
| Onde estão os legados / quando entram? | Forneço antes do plano / Construir antes / Só planilhas | **Forneço antes do plano** (entregues em `ref/`) |
| Consolidação entre versões | Mais recente vence / Merge campo a campo / Você decide | **Você decide** → versão única detectada (md5) |
| Conteúdo do seed | Só inventário+planos / Tudo / Você decide | **Você decide** → mapa VTR/EMB já importado; histórico vazio |
| Conferência pós-import | Relatório + conferência do usuário / Só contagens | **Relatório + conferência do usuário** |

## Modelagem viatura×embarcação

| Pergunta | Opções | Resposta |
|---|---|---|
| Tabela única ou separadas? | Única / Duas | **Única** (`transp_ativos` c/ tipo + unidade_uso) |
| Unidade do plano | Herdada do modelo / No plano | **Herdada do `tipo_modelo`** |
| Documentação na Fase 1? | Identificação sim, vencimentos não / Só básico / Tudo | **Identificação sim, vencimentos não** (vencimentos → Fase 2) |
| Estoque compartilhado? | Próprio transp_materiais / Compartilhar maq_materiais | **Próprio `transp_materiais`** |

## Base de código & UI

Interrompida pelo usuário; resolvida pela realidade: módulo `transportes/` v1.0 já construído e em produção (commits 2026-08-08 fora do GSD). Decisão registrada: **evoluir código existente**, sem fork/rewrite.

## Eventos durante a sessão

- Verificação de produção (Vercel/Supabase/browser) revelou módulo Transportes já no ar (9 ativos, 23 viagens)
- Vercel Authentication ativa em todos os domínios `.vercel.app`; `pmoc.vercel.app` pertence a terceiro
- Usuário pediu consolidação da pasta `ref/` → `01-LEGACY-CONSOLIDATION.md`

## Ideias deferidas

Ver seção Deferred de `01-CONTEXT.md`.
