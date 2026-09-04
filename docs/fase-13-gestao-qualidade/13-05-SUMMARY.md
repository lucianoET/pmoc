---
phase: 13-gest-o-e-qualidade
plan: 05
subsystem: database
tags: [sql, postgres, supabase, schema, rls, gestao, 5w2h, gut, ishikawa, pop]

# Dependency graph
requires:
  - phase: 13-gest-o-e-qualidade (plano 13-02)
    provides: shared/gut.js com GUT_ESCALA para comparação com o check do banco
provides:
  - supabase/60_gestao_schema.sql (cinco tabelas ges_*, aditiva, sem DROP, RLS e índices)
  - tests/gestao-schema.test.js (gate permanente do esquema)
affects: [13-06, gestao (Onda B)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabelas ges_* no padrão da plataforma: prefixo de módulo, aditiva, RLS pública para select e authenticated para escrita"
    - "gut_total gerada e armazenada (generated always as (g * u * t) stored), eliminando divergência entre cálculo e dado"
    - "RLS reexecutável: drop policy if exists antes de cada create policy"

key-files:
  created:
    - supabase/60_gestao_schema.sql
    - tests/gestao-schema.test.js
  modified: []

key-decisions:
  - "gut_total gerada sempre como g * u * t: nenhuma escrita do cliente grava prioridade diretamente"
  - "RLS estrita: leitura pública (select), escrita (insert/update/delete) restrita a authenticated, sem menção a anon"
  - "Identificadores das cinco tabelas usam bigserial primary key, garantindo que 'generated always as' exista estritamente na coluna gerada gut_total"
  - "Migração não aplicada automaticamente: escrita e conferida por testes, aguardando deploy do frontend conforme regra do projeto"

requirements-completed: [GEQ-06, GEQ-07, GEQ-08]

coverage:
  - id: D1
    description: "supabase/60_gestao_schema.sql cria as cinco tabelas ges_acoes, ges_indicadores, ges_indicador_valores, ges_pop e ges_causas sem DROP"
    requirement: "GEQ-06"
    verification:
      - kind: unit
        ref: "tests/gestao-schema.test.js#as cinco tabelas são criadas e todas têm prefixo ges_"
        status: pass
  - id: D2
    description: "gut_total gerada no banco e escala GUT idêntica à de shared/gut.js"
    requirement: "GEQ-06"
    verification:
      - kind: unit
        ref: "tests/gestao-schema.test.js#gut_total é coluna gerada armazenada e não coluna gravável comum"
        status: pass
      - kind: unit
        ref: "tests/gestao-schema.test.js#a escala aceita por g, u e t no banco é idêntica a GUT_ESCALA de shared/gut.js"
        status: pass
  - id: D3
    description: "RLS ativada nas cinco tabelas com escrita exclusiva para authenticated e bloco reexecutável"
    requirement: "GEQ-07"
    verification:
      - kind: unit
        ref: "tests/gestao-schema.test.js#todas as 5 tabelas têm RLS ativada com leitura para public e escrita para authenticated"
        status: pass
      - kind: unit
        ref: "tests/gestao-schema.test.js#bloco de RLS é reexecutável com drop policy if exists antes de cada create policy"
        status: pass
---

# Fase 13 — Gestão e Qualidade: Plano 13-05 Summary

Esquema de banco de dados `supabase/60_gestao_schema.sql` e gate automatizado `tests/gestao-schema.test.js` implementados com sucesso.

- Criação aditiva das tabelas `ges_acoes`, `ges_indicadores`, `ges_indicador_valores`, `ges_pop` e `ges_causas`.
- 10/10 testes passando em `tests/gestao-schema.test.js`.
- Migração pronta para aplicação no Supabase após publicação do frontend.
