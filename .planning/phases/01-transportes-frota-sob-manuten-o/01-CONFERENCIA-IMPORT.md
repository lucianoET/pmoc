# Conferência pós-import — Módulo Transportes (Fase 01, Plano 04)

## 1. Cabeçalho

- **Data da conferência:** 2026-08-10
- **Fonte legada usada:** `ref/Mapa de VTR e EMB ATU 20FEV26.csv` (Programação de Viaturas de Rotina, Programação de Embarcações de Rotina, Programação de Viaturas e Embarcações — 30JAN)
- **Origem dos números deste relatório:** **arquivo de seed** (`supabase/11_transportes_seed.sql`), **não o banco de produção**. Nenhuma ferramenta MCP do Supabase estava disponível nesta sessão para consultar o projeto `pmoc` (`thoaqipyhfmromsgzmjs`) ao vivo. Todas as contagens e a amostra abaixo foram derivadas do seed já aplicado (confirmado em produção nos checkpoints dos Planos 01-01/01-02 pelo usuário) e conferidas linha a linha contra o CSV do mapa legado. Nenhum número foi inventado.

## 2. Contagens por tipo

| Métrica | Esperado (D-01) | Observado no seed | Situação |
|---|---|---|---|
| Total de ativos | 9 | 9 | ✅ Conferido |
| Viaturas | 6 | 6 (VTR-001 a VTR-006) | ✅ Conferido |
| Embarcações | 3 | 3 (EMB-001 a EMB-003) | ✅ Conferido |
| Viagens históricas importadas | 23 | 23 (23 linhas com `chave_importacao` distinta) | ✅ Conferido |

**Composição das 23 viagens** (reconciliação linha a linha entre o bloco `values` de `transp_viagens` no seed e o CSV):

| Ativo | Viagens no seed | Origem no CSV |
|---|---|---|
| VTR-001 (MUNK) | 1 | Recolhimento do lixo, 13:00–15:30 |
| VTR-002 (S-10) | 1 | Destinação do lixo, 14:30–15:00 |
| EMB-001 (ETPM FÁTIMA) | 15 | Dois blocos de horários de rotina do CSV (3 saídas do primeiro bloco: 06:50/08:30/12:00 + 12 saídas do segundo bloco: 06:15/06:40/07:00/07:30/09:30/12:00/13:00/16:10/16:30/17:00/17:30/18:00 — o horário 12:00 aparece nos dois blocos e por isso gerou duas chaves de importação, `-1200-a` e `-1200-b`, preservando as duas viagens originais em vez de as fundir) |
| EMB-002 (LANCHA NATAL) | 1 | Sobreaviso 18:00–06:00 |
| VTR-003 (AMBULÂNCIA) | 1 | Transporte de pessoal 13:00–16:00 |
| VTR-004 (DOBLÔ 1.4) | 1 | Transporte de pessoal 07:30–16:00 |
| VTR-005 (CAMINHÃO CONSTELLATION) | 1 | Transporte de material 10:00–12:00 |
| VTR-006 (XCMG) | 1 | Faina de armamento 13:00–16:00 |
| EMB-003 (SARGENTO FREITAS) | 1 | Faina de armamento 13:00–16:00 |
| **Total** | **23** | — |

## 3. Contagens por unidade de uso

| Unidade | Esperado | Observado | Ativos |
|---|---|---|---|
| km (viatura) | 6 | 6 | VTR-001, VTR-002, VTR-003, VTR-004, VTR-005, VTR-006 |
| h (embarcação) | 3 | 3 | EMB-001, EMB-002, EMB-003 |

Nenhum ativo contraria a regra de domínio — toda viatura tem `unidade_uso = 'km'` e toda embarcação tem `unidade_uso = 'h'` em `transp_ativos`. **Zero divergências.**

**Modelo de identidade (D-03):** confirmado que o inventário permanece em uma única tabela, `transp_ativos`, distinguindo a categoria pelo campo `tipo` (`'viatura'` / `'embarcacao'`) e carregando `unidade_uso` por ativo. Nenhuma fase (10, 11, 22 ou 23) criou tabela separada por categoria — `supabase/10_transportes_schema.sql` declara apenas uma `create table transp_ativos`, e as migrações 22/23 desta fase (`transp_planos`, `transp_materiais`, `transp_plano_materiais`, `transp_estoque_movimentos`) são tabelas de apoio (planos e estoque), não uma segunda tabela de ativos.

## 4. Amostra de ativos (conferência integral — 9/9)

| Código | Nome (seed) | Nome (CSV) | Tipo | Subtipo | Identificação (seed) | Identificação (CSV) | Tipo/Modelo | Unidade | Status |
|---|---|---|---|---|---|---|---|---|---|
| VTR-001 | MUNK | MUNK | viatura | Caminhão | KPJ 8385 | (KPJ 8385) | munk | km | disponivel |
| VTR-002 | S-10 | S-10 | viatura | Pickup | LRZ 5099 | (LRZ 5099) | s10 | km | disponivel |
| EMB-001 | ETPM FÁTIMA | ETPM FÁTIMA | embarcacao | Embarcação de rotina | CMASM-08 | (CMASM-08) | etpm-fatima | h | disponivel |
| EMB-002 | LANCHA NATAL | LANCHA NATAL | embarcacao | Lancha | CMASM-05 | (CMASM-05) | lancha-natal | h | sobreaviso |
| VTR-003 | AMBULÂNCIA | AMBULÂNCIA | viatura | Ambulância | *(vazio)* | *(sem identificação no CSV)* | ambulancia | km | disponivel |
| VTR-004 | DOBLÔ 1.4 | DOBLÔ 1.4 | viatura | Viatura leve | *(vazio)* | *(sem identificação no CSV)* | doblo-14 | km | disponivel |
| VTR-005 | CAMINHÃO CONSTELLATION | CAMINHÃO CONSTELLATION | viatura | Caminhão | *(vazio)* | *(sem identificação no CSV)* | constellation | km | disponivel |
| VTR-006 | XCMG | XCMG | viatura | Guindaste | GUINDASTE | (GUINDASTE) | xcmg-guindaste | km | disponivel |
| EMB-003 | SARGENTO FREITAS | SARGENTO FREITAS | embarcacao | Embarcação de apoio | CMASM-10 | (CMASM-10) | sargento-freitas | h | disponivel |

Os 9 ativos batem nome a nome, tipo a tipo, unidade a unidade e identificação a identificação com o mapa legado. Nenhuma divergência de conteúdo encontrada. **Nota:** o campo "Identificação" do VTR-006 (XCMG) recebeu o texto literal `GUINDASTE`, que no CSV aparece entre parênteses junto ao nome — é a mesma anotação da fonte, não uma placa/chassi; mantido como está por fidelidade ao dado de origem (decisão de nomenclatura, não uma lacuna).

## 5. Lacunas identificadas

Três ativos têm o campo `identificacao` vazio em `transp_ativos`, porque a fonte legada (CSV) também não traz placa, chassi, registro ou inscrição para eles — apenas o nome do ativo:

| Código | Nome | Observação |
|---|---|---|
| VTR-003 | AMBULÂNCIA | CSV traz somente "AMBULÂNCIA", sem identificador entre parênteses |
| VTR-004 | DOBLÔ 1.4 | CSV traz somente "DOBLÔ 1.4", sem identificador entre parênteses |
| VTR-005 | CAMINHÃO CONSTELLATION | CSV traz somente "CAMINHÃO CONSTELLATION", sem identificador entre parênteses |

Conforme a D-05, essas lacunas precisam ser decididas pelo usuário antes de TRANSP-01/TRANSP-09 serem dados por totalmente encerrados: **preencher agora** (placa/chassi/registro real, pela tela de Frota) ou **aceitar como pendência conhecida registrada**. Nenhum identificador foi inventado neste relatório.

## 6. Idempotência do seed

O seed resolve conflito por chave natural em ambas as tabelas, tornando reexecuções seguras (sem duplicar linhas):

- **`transp_ativos`** — conflito resolvido pela coluna `codigo` (única, `unique` no schema):
  ```sql
  insert into transp_ativos (...)
  values (...)
  on conflict (codigo) do update
  set nome = excluded.nome, tipo = excluded.tipo, ...
  ```
  (`supabase/11_transportes_seed.sql`, linhas 7–34)

- **`transp_viagens`** — conflito resolvido pela coluna `chave_importacao` (única, `unique` no schema):
  ```sql
  insert into transp_viagens (...)
  select ...
  from (values (...) ) as dados (chave_importacao, ...)
  join transp_ativos ativos on ativos.codigo = dados.codigo_ativo
  on conflict (chave_importacao) do update
  set ativo_id = excluded.ativo_id, ...
  ```
  (`supabase/11_transportes_seed.sql`, linhas 36–115)

Reexecutar `11_transportes_seed.sql` atualiza as linhas existentes (`do update`) em vez de inserir cópias — não duplica ativos nem viagens.

## 7. Divergências e conclusão (Task 1)

**Nenhuma divergência de conteúdo encontrada** entre o inventário importado e o mapa legado: as 9 identidades, os 6/3 por tipo, a regra km/embarcação=h por 9/9 ativos e as 23 viagens todas reconciliam.

**Ressalva de origem dos números:** esta conferência foi feita contra o **arquivo de seed**, não contra uma consulta ao vivo em `pmoc` (sem MCP do Supabase disponível nesta sessão). O seed já foi aplicado e confirmado em produção nos checkpoints dos Planos 01-01 e 01-02 (usuário respondeu "aprovado" incluindo contagens de tabela). Ainda assim, a conferência linha-a-linha contra o CSV é nova nesta fase — **não havia sido feita antes**.

Restam pendentes apenas as decisões humanas listadas nas seções 5 (lacunas de identificação) — **este documento não declara TRANSP-09 concluído**. A conclusão depende da validação humana da Task 2.

> A seção "Não regressão da produção" (Task 3) é gerada depois da aprovação humana desta Task 2, conforme a ordem das tarefas do plano.
