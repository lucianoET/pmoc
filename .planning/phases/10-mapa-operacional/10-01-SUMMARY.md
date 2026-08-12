---
phase: 10-mapa-operacional
plan: 01
subsystem: database
tags: [supabase, postgres, rls, check-constraint, jsonb, migration]

requires: []
provides:
  - "maq_areas.geom (jsonb) + flora/inclinacao/limpeza (lista fechada) — onde a zona de serviço do plano 10-06 grava geometria e atributos de terreno"
  - "lat/lon nullable em cmasm_locais e nas cinco tabelas de ativo (maq_ativos, transp_ativos, elet_ativos, fono_ativos, equipamentos) — onde o plano 10-02..10-07 lê/grava posição geográfica"
  - "travas de banco (envelope geográfico + par completo) que tornam impossível gravar coordenada implausível ou posição pela metade, independente do que a tela do plano 10-07 valide"
  - "gate estático permanente (tests/mapa-schema.test.js) contra regressão de policy sem escopo de papel na migração 25"
affects: [10-02, 10-06, 10-07]

tech-stack:
  added: []
  patterns:
    - "Restrição nomeada guardada por checagem em pg_constraint antes de ADD CONSTRAINT, mesmo idioma que a migração 12 usa com pg_policies, para reexecução idempotente"
    - "Doze alter table escritos linha a linha (sem loop/execute format) porque o arquivo é lido por humano antes de colar num banco de produção compartilhado"

key-files:
  created:
    - supabase/25_mapa_geometria_posicao.sql
    - tests/mapa-schema.test.js
  modified: []

key-decisions:
  - "Envelope geográfico (-23.2/-22.5/-43.5/-42.7) é uma única restrição check por tabela combinando lat E lon com AND, não duas restrições separadas — captura o par trocado (latitude gravada na coluna de longitude) em uma única checagem"
  - "Nenhuma policy nova criada: as seis tabelas alteradas já escopam insert/update a authenticated desde suas migrações de origem (04, 10, 12, 14, 17); as colunas novas herdam essa restrição por serem parte da mesma linha"
  - "Coluna maquinas_compativeis não criada em maq_areas — compatibilidade é derivada em runtime por função pura no cliente (plano 10-02), evitando segunda fonte de verdade"

patterns-established:
  - "Núcleo de teste estático sobre texto de migração SQL (não sobre banco) como gate pré-produção — extensão do padrão já usado em tests/schema-operacoes-maquinas.test.js e tests/tema-superficies.test.js"

requirements-completed: [PLAT-13, PLAT-18, PLAT-20, PLAT-16]

coverage:
  - id: D1
    description: "maq_areas ganha geometria (geom jsonb) e os três atributos de terreno travados por lista fechada no banco (flora, inclinacao, limpeza)"
    requirement: "PLAT-18"
    verification:
      - kind: unit
        ref: "tests/mapa-schema.test.js#as três listas fechadas de terreno têm exatamente os valores previstos"
        status: pass
    human_judgment: false
  - id: D2
    description: "cmasm_locais e as cinco tabelas de ativo ganham lat/lon nullable, em duas camadas (herdada do prédio + override individual)"
    requirement: "PLAT-13"
    verification:
      - kind: unit
        ref: "tests/mapa-schema.test.js#as seis tabelas recebem as duas coordenadas (lat e lon)"
        status: pass
    human_judgment: false
  - id: D3
    description: "coordenada implausível (envelope geográfico, inclui o par lat/lon trocado) e posição pela metade são recusadas por restrição de banco em cada uma das seis tabelas"
    requirement: "PLAT-20"
    verification:
      - kind: unit
        ref: "tests/mapa-schema.test.js#toda tabela que ganha coordenada também ganha as duas travas — envelope e par completo"
        status: pass
      - kind: unit
        ref: "tests/mapa-schema.test.js#os quatro números do envelope geográfico são exatamente os fixados"
        status: pass
    human_judgment: false
  - id: D4
    description: "migração 25 é estritamente aditiva (sem drop/truncate/delete), não cria policy nova e não habilita extensão — suíte de testes sobe de 58 para 67 sem remoção"
    requirement: "PLAT-16"
    verification:
      - kind: unit
        ref: "tests/mapa-schema.test.js#a migração é aditiva — nenhuma linha começa por comando destrutivo"
        status: pass
      - kind: unit
        ref: "tests/mapa-schema.test.js#nenhuma policy é criada — e se um dia for, ela precisa declarar escopo de papel"
        status: pass
      - kind: unit
        ref: "tests/mapa-schema.test.js#PostGIS fica fora — geometria é jsonb, sem extensão nova"
        status: pass
    human_judgment: false
  - id: D5
    description: "migração 25 executada e conferida no banco de produção Supabase (user_setup) — colunas de geometria, contagens de posição e policies escopadas a authenticated"
    verification: []
    human_judgment: true
    rationale: "O ambiente autônomo não tem credenciais do banco Supabase; a migração é escrita e verificada estaticamente aqui, mas a execução real no SQL Editor e a conferência pós-execução (colunas em information_schema, contagens de lat/lon, listagem de policies) exigem o usuário, conforme user_setup do plano"

duration: 15min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 01: Migração 25 — Geometria de Zona e Posição de Ativo Summary

**Migração SQL aditiva que dá ao banco os dois lugares que faltavam para o mapa operacional: geometria de zona em `maq_areas` (jsonb + três atributos de terreno com lista fechada) e posição geográfica em duas camadas (`cmasm_locais` herdada + override por ativo) nas cinco tabelas de ativo, com doze restrições de integridade e gate estático permanente.**

## Performance

- **Duration:** 15 min
- **Completed:** 2026-08-12
- **Tasks:** 2/2 completed
- **Files modified:** 2 (ambos novos)

## Accomplishments

- `supabase/25_mapa_geometria_posicao.sql` criado: 4 colunas novas em `maq_areas` (`geom jsonb`, `flora`, `inclinacao`, `limpeza`, as três últimas travadas por `check ... in (...)`), 12 colunas `lat`/`lon` nas seis tabelas de posição, 12 restrições de integridade (envelope geográfico + par completo, uma dupla por tabela) e 6 índices parciais — tudo `add column if not exists` / guardado por `pg_constraint`, reexecutável sem erro.
- `tests/mapa-schema.test.js` criado com 9 casos de teste estático que provam, por leitura do texto da migração, que ela é aditiva, tem as três listas fechadas completas, dá as duas travas a cada uma das seis tabelas, fixa os quatro números do envelope de forma independente do plano 10-02, e recusa qualquer policy futura sem `to authenticated`.
- Confirmado por `node --test`: suíte sobe de 58 para 67 testes, 0 falhas, nenhum teste anterior removido.
- Confirmado que nenhum arquivo de frontend, `refrigeracao/` ou `mapa/xmap.css` foi tocado (`git diff --name-only` contra o commit anterior ao plano, todos os três em zero).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Escrever a migração 25** — `6101c31` (feat)
2. **Task 2: Criar tests/mapa-schema.test.js** — `faff57b` (test)

**Plan metadata:** (a seguir, neste commit)

## Files Created/Modified

- `supabase/25_mapa_geometria_posicao.sql` — migração aditiva: geometria de zona (`maq_areas`) e posição geográfica em duas camadas (`cmasm_locais` + 5 tabelas de ativo), com travas de integridade e índices parciais
- `tests/mapa-schema.test.js` — gate estático permanente que lê o texto da migração 25 e afirma as propriedades aditiva/lista-fechada/travas/envelope/sem-policy

## Decisions Made

- Envelope geográfico como restrição única por tabela combinando `lat` e `lon` com `AND` (não duas restrições separadas) — captura diretamente o par trocado (latitude gravada na coluna de longitude), que é o alvo real da trava.
- Nenhuma policy nova: as seis tabelas já escopam escrita a `authenticated` desde suas migrações de origem; as colunas novas herdam essa restrição por serem parte da mesma linha/tabela — decisão consciente registrada em comentário no próprio arquivo SQL.
- `cmasm_locais` recebeu `lat`/`lon` além das cinco tabelas de ativo, completando as seis tabelas do Pattern 2 do RESEARCH (posição herdada do prédio/sala).
- Não foi criada coluna `maquinas_compativeis` em `maq_areas` (decisão já travada no plano) — compatibilidade é derivada por função pura no cliente no plano 10-02.

## Deviations from Plan

### Gate mal especificado corrigido (não é auto-fix de código)

**1. [Gate mis-specification] Item `--` no loop de verificação da Task 2**

- **Found during:** Task 2, verificação automatizada
- **Issue:** O `<verify><automated>` da Task 2 (copiado do padrão de verificação de arquivo SQL da Task 1) contém `for n in -- "-23.2" "-22.5" "-43.5" "-42.7"; do grep -qF -- "$n" "$T" ...`. O `--` solto na lista do `for` é um artefato de copy-paste do idioma `grep -qF -- "$n"` (onde `--` sinaliza "fim de opções" para o `grep`), não um valor a testar. Na Task 1, essa mesma linha passa por acidente porque o arquivo SQL contém `--` (comentário SQL) em toda parte; em `tests/mapa-schema.test.js` (JavaScript, sem `--` em lugar nenhum) o item `--` do loop falha a busca e reprova o gate mesmo com os quatro números do envelope presentes e corretos no arquivo.
- **Fix:** Verifiquei a propriedade real (acceptance criteria do plano: "Os quatro números do envelope estão escritos no teste: -23.2, -22.5, -43.5, -42.7") diretamente — os quatro literais estão presentes em `tests/mapa-schema.test.js`, confirmado individualmente por `grep -qF -- "$n"` para cada um dos quatro números. Não alterei o teste nem inseri um `--` artificial só para satisfazer o script de verificação copiado.
- **Files modified:** nenhum arquivo de produção alterado por esta correção — apenas a execução do gate ajustada (removido o item `--` do loop ao rodar a verificação)
- **Verification:** `node --test` roda 67/67 (0 falhas) com o gate corrigido; os quatro números confirmados individualmente presentes em `tests/mapa-schema.test.js`
- **Committed in:** não aplicável — nenhuma mudança de arquivo, só a forma de executar a verificação

---

**Total deviations:** 1 (gate mis-specification, não código)
**Impact on plan:** Nenhum — a propriedade real que o gate deveria proteger (os quatro números do envelope presentes no teste) está satisfeita; a linha `for n in --` do `<verify>` da Task 2 do `10-01-PLAN.md` deveria ser corrigida para `for n in "-23.2" "-22.5" "-43.5" "-42.7"` (sem o `--` inicial) se este plano for reexecutado no futuro.

## Issues Encountered

None.

## User Setup Required

**A migração 25 precisa ser executada manualmente pelo usuário no SQL Editor do Supabase (projeto `pmoc`, `thoaqipyhfmromsgzmjs`).** O ambiente autônomo não tem credenciais de banco; o arquivo foi escrito e conferido estaticamente aqui.

Passos:

1. Colar e executar `supabase/25_mapa_geometria_posicao.sql` inteiro no SQL Editor do projeto `pmoc`.
2. Conferir com as consultas comentadas no rodapé do próprio arquivo:
   - `select column_name from information_schema.columns where table_name='maq_areas' and column_name in ('geom','flora','inclinacao','limpeza');` — esperado 4 linhas.
   - `select count(*) from maq_ativos where lat is not null;` (e equivalente para as outras cinco tabelas) — esperado 0 antes de qualquer ativo ser posicionado pela tela dos planos futuros.
   - `select tablename, policyname, roles from pg_policies where tablename in (...) and cmd in ('INSERT','UPDATE');` — confirmar que todas as policies de escrita das seis tabelas seguem escopadas a `authenticated`.

Nenhuma dessas conferências foi executada por este executor — não há acesso ao banco. O item D5 do `coverage` acima fica marcado `human_judgment: true` até o usuário confirmar.

## Next Phase Readiness

- Os planos 10-02 (função pura de compatibilidade/geometria), 10-06 (editor de zona) e 10-07 (posicionamento de ativo no mapa) agora têm onde gravar: `maq_areas.geom`/`flora`/`inclinacao`/`limpeza` e `lat`/`lon` nas seis tabelas, com travas de banco que tornam coordenada implausível e posição pela metade impossíveis de gravar.
- Bloqueio: a migração ainda não foi aplicada no banco de produção real (depende do usuário, ver "User Setup Required" acima). Nenhum plano subsequente que leia/escreva essas colunas pode ser considerado testado ponta a ponta contra o Supabase real até essa aplicação acontecer.

---
*Phase: 10-mapa-operacional*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: supabase/25_mapa_geometria_posicao.sql
- FOUND: tests/mapa-schema.test.js
- FOUND: .planning/phases/10-mapa-operacional/10-01-SUMMARY.md
- FOUND commit: 6101c31 (feat 10-01 migração 25)
- FOUND commit: faff57b (test 10-01 gate mapa-schema)
