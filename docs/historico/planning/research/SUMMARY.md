# Resumo de Pesquisa de Projeto

**Projeto:** Expansão modular de plataforma PMOC — adição de 3 módulos de manutenção de ativos (Transportes, Elétrica, Fonoclama)
**Domínio:** Gestão de manutenção de ativos — frota/embarcações, infraestrutura elétrica, sistema de som PA 70V
**Pesquisado em:** 2026-08-08
**Confiança:** MÉDIA-ALTA

---

## Resumo Executivo

A expansão é uma **extensão modular linear** de um padrão já validado em produção (stack zero-build Supabase + Vercel). Os três módulos novos reaproveitam dois "estilos de domínio" consolidados: (1) **Transportes** segue o padrão de Máquinas (ciclo de vida por uso — km/horímetro), com complexidade adicional de frota mista e alertas de documentação vencida; (2) **Elétrica** e **Fonoclama** seguem o padrão de Refrigeração (inspeções periódicas). O stack, arquitetura e framework já estão validados — **não há necessidade de redesenho**, apenas extensão disciplinada do padrão existente com atenção a armadilhas conhecidas.

A maior barreira não é implementação (prototipável em poucas sprints), mas **consolidação fiel de dados legados**. Cada módulo novo herda múltiplas versões de apps legados em localStorage com esquemas divergentes. Essa fase exige protocolo rigoroso (mapeamento de campos, comparação pós-import) antes de schema Postgres — sem isso, o banco nasce com problema de dados mal definido.

Três riscos escalados: (1) **replicar RLS permissivo** (qualquer autenticado edita tudo) — fraqueza conhecida que os módulos novos podem não perpetuar; (2) **validação numérica insuficiente** (litros negativos, km regressivo) — herdada de Máquinas; (3) **drift de auth** — se duplicar em vez de reutilizar `shared/auth.js`, 5 cópias divergentes.

---

## Achados Principais

### Stack Recomendado

Manter stack zero-build existente. `@supabase/supabase-js` v2.112.2 (CDN) é cliente único — nenhum motivo técnico para mudar.

**Core:** Supabase JS (CDN), HTML5 + ES6 vanilla, Vercel static, PostgreSQL RLS (um projeto único, schema `public`, prefixo por módulo)

**Para necessidades novas:** QR (reutilizar vendorizado em refrigeração), CSV (Blob nativo), datas (Date + Intl.RelativeTimeFormat), auth compartilhado (shared/auth.js), seeds SQL (padrão refrigeração)

**Não usar:** Frameworks, bundlers, CSV client-side, GENERATED ALWAYS AS, nova lib QR via CDN

**Confiança:** ALTA (código-fonte + docs oficiais)

---

### Features Esperadas

**Transportes (estilo máquinas):** Ciclo de vida por uso (km/h), viaturas + embarcações, planos por tipo_modelo, abastecimento com consumo, alertas de documentação vencida

**Elétrica (estilo refrigeração):** Inspeções periódicas, checklists, não conformidade (NR-10/NBR 5410 referência)

**Fonoclama (estilo refrigeração):** Inspeções/testes periódicos, zonas, cobertura, autonomia de backup

**P1 (lançamento):** Cadastro ativos, planos, OS/checklist, alertas vencimento, dashboard

**P2 (v1.x):** Anomalia consumo, alertas escalonados (60/15/7/0 dias), termografia, qualificação técnico, mapa cobertura

**Anti-features:** Telemetria/GPS, roteirização, integração DETRAN automática, IoT contínuo, conformidade NFPA 72

**Confiança:** MÉDIA (domínios confirmados, sem apps legados ainda)

---

### Abordagem de Arquitetura

Extensão linear. Um Supabase, schema `public`, prefixo por módulo (transp_, elet_, fono_).

**Padrões obrigatórios:**
1. Prefixo de tabela (evita colisão)
2. Dois "estilos": Transportes (HTML + app.js), Elétrica/Fonoclama (HTML único)
3. RLS via loop SQL (copiar de maquinas_schema.sql)
4. Migrações aditivas (nunca DROP/ALTER), seed idempotente (ON CONFLICT)
5. Análise legada → consolidação → SQL seed (bloqueante antes de schema)

**Ordem:** Transportes → Elétrica → Fonoclama (não dependência técnica, mas aprendizado)

**Confiança:** ALTA (código-fonte em produção)

---

### Armadilhas Críticas (Top 10)

1. **Consolidação divergente sem reconciliação** — múltiplas versões app legado. Solução: mapa de campos, comparação pós-import, desempate documentado.
2. **Big-bang sem validação** — localStorage por dispositivo/navegador. Solução: inventário todas fontes, job comparação, seed idempotente.
3. **km e horímetro misto** — frota heterogênea. Solução: coluna `unidade_uso` explícita, usada em todo cálculo, CHECK no banco.
4. **RLS permissivo copiado** — qualquer autenticado edita. Solução: revisar explicitamente (mínimo: observador read-only).
5. **Drift de auth duplicado** — 5 cópias divergentes. Solução: reutilizar `shared/auth.js` por caminho absoluto.
6. **Arquivo único crescendo** — refrigeração 436 KB. Solução: extrair CSS para `shared/styles.css` em Fase 7.
7. **Alertas sem escalonamento** — vencimento passa despercebido. Solução: limiares 60/15/7/0 dias, responsável obrigatório.
8. **Validação numérica insuficiente** — herança de Máquinas (negativos, regressivos). Solução: CHECK banco, validação client-side.
9. **Seeds não-idempotentes** — reexecução duplica. Solução: ON CONFLICT chave natural, transação.
10. **Teste direto produção** — Supabase compartilhado. Solução: revisar migrações, smoke test após cada migração.

**Confiança:** MÉDIA-ALTA (evidência direta CONCERNS.md + padrões observados)

---

## Implicações para o Roadmap

Estrutura sequencial por módulo (Transportes → Elétrica → Fonoclama). Bloqueante: análise/consolidação legada antes de schema em cada módulo.

### 12 Fases Propostas

**Transportes (4 fases)**
- **Fase 1:** Análise/consolidação dados legados (PESQUISA)
- **Fase 2:** Schema + RLS + importação (decisões RLS/auth aqui)
- **Fase 3:** Frontend viaturas (padrão máquinas)
- **Fase 4:** Frontend embarcações + abastecimento + documentação vencida

**Elétrica (4 fases)**
- **Fase 5:** Análise/consolidação dados legados (PESQUISA)
- **Fase 6:** Schema + RLS + importação
- **Fase 7:** Frontend base (**EXTRAIR CSS para shared/styles.css aqui**)
- **Fase 8:** Frontend diferenciais (termografia, teste gerador, qualificação)

**Fonoclama (4 fases)**
- **Fase 9:** Análise/consolidação dados legados (PESQUISA)
- **Fase 10:** Schema + RLS + importação
- **Fase 11:** Frontend base (reutiliza CSS shared)
- **Fase 12:** Frontend diferenciais (mapa cobertura, autonomia backup)

### Checkpoints Críticos

- Fases 1/5/9: Apps legados fornecidos
- Fases 2/6/10: RLS revisada (decisão explícita), auth compartilhada decidida
- Fases 2/6/10: CHECKs validação numérica agregados
- Fases 2/5/6/9/10: Comparação pós-import confirmada
- Fase 7: CSS extraído para shared

---

## Flags de Pesquisa

**Precisam pesquisa:** Fases 1, 5, 9 (apps legados), Fase 4 (NORMAM embarcações), Fase 8 (termografia/gerador), Fase 12 (backup criticidade)

**Padrões estabelecidos (sem pesquisa):** Fases 2-3 (Transportes), 6-7 (Elétrica), 10-11 (Fonoclama)

---

## Confiança por Área

| Área | Confiança | Notas |
|------|-----------|-------|
| Stack | ALTA | Código + docs oficiais verificados. Única incerteza: versão flutuante vs. pinada (decisão projeto). |
| Features | MÉDIA | Máquinas/Refrigeração confirmados (HIGH). Novos confirmados via normas (MÉDIA). Gaps: frequência inspeção elétrica/PA real, NORMAM embarcações exata. |
| Arquitetura | ALTA | Código-fonte produção. Extensão linear. Incerteza: RLS corrigir vs. replicar (decisão projeto). |
| Armadilhas | MÉDIA-ALTA | Evidência direta CONCERNS.md (HIGH). Pitfalls não testados com volume real reduzem a MÉDIA. |

**Geral:** MÉDIA-ALTA

---

## Gaps a Resolver

- Apps legados não fornecidos → solicitar em Fase 1
- NORMAM embarcações → consultar em Fase 4
- Frequência inspeção elétrica/PA real → validar Fases 5/9
- RLS: corrigir ou replicar → decidir Fase 2
- Auth: reutilizar ou duplicar → decidir Fase 3
- CSS compartilhado → extrair Fase 7
- Validação numérica → agregar Fases 2/6/10

---

## Fontes

**Alta:** Código-fonte projeto, CONCERNS.md, docs oficiais (Supabase, PostgreSQL), PROJECT.md
**Média:** Normas brasileiras (fontes secundárias), NFPA 72 (benchmark), CMMS mercado
**Baixa:** Frequência inspeção real, função Fonoclama, apps legados (não fornecidos)

---

**Pesquisa concluída:** 2026-08-08
**Pronto para roadmap:** SIM
**Próximo:** Planning Fase 1 (Análise Dados Legados — Transportes)
