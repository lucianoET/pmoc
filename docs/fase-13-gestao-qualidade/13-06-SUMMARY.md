---
phase: 13-gest-o-e-qualidade
plan: 06
subsystem: ui-modules
tags: [gestao, 5w2h, gut, kanban, gantt, calendario, indicadores, ferramentas, ishikawa, pop, shell, auth]

# Dependency graph
requires:
  - phase: 13-gest-o-e-qualidade (plano 13-01 a 13-04)
    provides: 9 núcleos compartilhados (grafico, indicadores, gantt, abc, kanban, calendario, gut, tabela, fluxo)
  - phase: 13-gest-o-e-qualidade (plano 13-05)
    provides: supabase/60_gestao_schema.sql e estrutura de tabelas ges_*
provides:
  - gestao/index.html (interface com anti-FOUC idêntico, 5 abas e 3 modais)
  - gestao/app.js (controlador com sonda GES_OK, auth por cargo, 5 abas operacionais)
  - shared/icones.js (ícones SVG acoes, calendario, ferramentas, pop)
  - vercel.json (rota /gestao)
  - index.html (card portal Gestão)
  - tests/gestao-modulo.test.js (gate permanente do módulo, 13 testes)
affects: [gestao, portal, vercel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sonda GES_OK: sondarGestao() consulta ges_acoes antes do Promise.all de carga, permitindo deploy seguro do frontend antes da migração 60 no banco"
    - "Zero cor literal em JavaScript: estilo visual e semáforo controlados estritamente por classes CSS (.critico, .alerta, .ok, etc.)"
    - "Zero emojis: uso de SVGs compartilhados (shared/icones.js) por nome em toda a interface"
    - "Consolidação read-only: logs_manutencao e demais tabelas externas lidas exclusivamente por select"
    - "Confirmação sem window.confirm(): modal próprio com contexto do item a cancelar/arquivar"

key-files:
  created:
    - gestao/index.html
    - gestao/app.js
    - tests/gestao-modulo.test.js
  modified:
    - shared/icones.js
    - vercel.json
    - index.html

key-decisions:
  - "Sonda GES_OK desacopla deploy de código da execução manual da migração 60 no Supabase SQL Editor"
  - "Consolidação de calendário lê logs_manutencao apenas por select, respeitando isolamento do módulo de refrigeração"
  - "Três modos de visualização em Ações (Lista com shared/tabela.js, Kanban com shared/kanban.js e Gantt com shared/gantt.js) a partir do mesmo estado reativo"

requirements-completed: [GEQ-06, GEQ-07, GEQ-08, GEQ-09, GEQ-10, PLAT-16]

coverage:
  - id: D1
    description: "Módulo /gestao estruturado com shell comum, 5 abas, 3 modais e script anti-FOUC idêntico"
    requirement: "GEQ-10"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#módulo possui as cinco views e abas do contrato com rótulos exatos"
        status: pass
  - id: D2
    description: "Sonda GES_OK com sondarGestao() antes do Promise.all e estado visual honesto quando migração 60 não aplicada"
    requirement: "GEQ-06"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#sonda GES_OK existe, nasce false, faz 1 leitura e roda antes do Promise.all"
        status: pass
  - id: D3
    description: "Ações 5W2H com matriz GUT, fluxo de 5 etapas e visualização tripla (Lista, Kanban, Gantt)"
    requirement: "GEQ-06"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#fluxo de ações declara os 5 estados da lista fechada e não usa confirm nativo"
        status: pass
  - id: D4
    description: "Calendário consolida OS de múltiplos módulos em modo estritamente read-only"
    requirement: "GEQ-09"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#tabelas externas (logs_manutencao, etc.) são consumidas estritamente em leitura"
        status: pass
  - id: D5
    description: "Ferramentas da qualidade (Pareto, Ishikawa 6M, PDCA, Carta de Controle, ABC, 5S) e POP cadastrável e arquivável"
    requirement: "GEQ-07, GEQ-08"
    verification:
      - kind: unit
        ref: "tests/gestao-modulo.test.js#importa todos os 9 núcleos compartilhados sem duplicar lógica"
        status: pass
---

# Fase 13 — Gestão e Qualidade: Plano 13-06 Summary

Implementação completa do módulo de Gestão e Qualidade (`/gestao`), consumindo simultaneamente os 9 núcleos compartilhados desenvolvidos na Onda A e fornecendo governança operacional para a plataforma PMOC.

## Entregáveis

1. **`gestao/index.html`**:
   - Cabeçalho anti-FOUC rigorosamente idêntico às demais superfícies.
   - 5 views (`view-painel`, `view-acoes`, `view-calendario`, `view-ferramentas`, `view-pop`).
   - 3 modais de edição (`modal-acao`, `modal-pop`, `modal-causa`).

2. **`gestao/app.js`**:
   - Integração com `aplicarShell`, `Auth` e 9 bibliotecas em `shared/`.
   - Sonda `GES_OK` para tolerância a ausência da migração 60 no banco de dados.
   - Gestão 5W2H com priorização GUT e visualização alternável em Lista, Kanban e Gantt.
   - Calendário consolidado multi-módulo (máquinas, transportes, predial, calibração e refrigeração) sem nenhuma escrita em módulos externos.
   - Ferramentas de qualidade integradas: Gráficos de Pareto e Controle, Curva ABC com pílulas, Diagrama de Ishikawa 6M, régua PDCA e checklist 5S.
   - Gestão de Procedimentos Operacionais Padrão (POP) com arquivamento nominal.

3. **Suporte e Integração da Plataforma**:
   - Traços vetoriais adicionados a `shared/icones.js` (`acoes`, `calendario`, `ferramentas`, `pop`).
   - Rota `/gestao` configurada em `vercel.json`.
   - Card de acesso adicionado ao portal `index.html`.

4. **Verificação Automatizada**:
   - 13 testes em `tests/gestao-modulo.test.js` assegurando conformidade com todas as restrições arquiteturais.
   - 1.504 testes passando no projeto sem regressões (`node --test`).
