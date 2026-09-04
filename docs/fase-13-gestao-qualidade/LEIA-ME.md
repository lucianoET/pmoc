# Fase 13 — Gestão e Qualidade: artefatos de planejamento

Planejada e executada em 04/09/2026 com o fluxo GSD (PRD → CONTEXT → UI-SPEC →
PATTERNS → PLAN → SUMMARY), numa branch local que ainda tinha `/.planning/`.
Como o projeto aposentou o `.planning/` em 02/09/2026 (o `CLAUDE.md` é o
registro único — ver `docs/historico/planning/LEIA-ME.md`), os artefatos vieram
para cá: é **acervo de trabalho da fase**, não um segundo registro. O que vale
como registro está na nota datada do `CLAUDE.md` e no roteiro do `TESTES.md`.

Caminhos citados dentro dos arquivos como `.planning/ROADMAP.md`,
`.planning/REQUIREMENTS.md` e `.planning/STATE.md` referem-se à branch onde a
fase foi planejada; o conteúdo correspondente (objetivo, critérios de sucesso,
requisitos GEQ-01..10, decisões D-13-01..06) está resumido no `CLAUDE.md`, seção
*Roadmap — o que falta* e na nota da Onda A.

| Arquivo | O que é |
|---|---|
| `13-PRD.md` | O pedido aprovado: ferramentas da EPR mapeadas, três ondas, decisões |
| `13-CONTEXT.md` | Decisões travadas D-01..D-19 que os planos tinham de honrar |
| `13-UI-SPEC.md` | Contrato de design (tons, classes, cópia, estados) — aprovado 6/6 |
| `13-PATTERNS.md` | Análogos no código para cada arquivo novo |
| `13-01..04-PLAN.md` + `SUMMARY.md` | **Onda A — executada** (núcleos em `shared/`, Máquinas e Predial consumindo) |
| `13-05, 13-06-PLAN.md` | **Onda B — planejada, não executada** (migração `60_gestao_schema.sql`, módulo `/gestao`) |
| `13-07-PLAN.md` | **Onda C — planejada, não executada** (adoção pelos painéis de Máquinas e Transportes) |

Antes de executar as Ondas B e C, reler os planos contra o código atual: eles
foram escritos sobre a árvore de 04/09/2026 e citam números de linha.
