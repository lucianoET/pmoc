-- ══════════════════════════════════════════════════════════════════
-- 45 — Atributos técnicos do equipamento: inverter, redundante e
-- automação (/refrigeracao)
--
-- O cadastro de `equipamentos` descreve o que a máquina é (tipo,
-- fabricante, BTU, tensão) e como ela é operada (refrigeração
-- permanente, horas/dia, dias/semana), mas não registra três fatos que
-- decidem manutenção e obra:
--
--   inverter    — compressor de rotação variável. Muda a peça de
--                 reposição (placa inverter x contatora/capacitor), o
--                 procedimento de carga e a expectativa de consumo.
--   redundante  — unidade reserva do mesmo ambiente. É o que separa
--                 "sala parada" de "sala com meia capacidade": as 8
--                 duplas do PAIOL e a dupla do servidor do COMANDO
--                 existem justamente para isso, e hoje o cadastro não
--                 sabe distinguir uma delas de uma máquina solitária.
--   automacao   — controlável por sistema de automação predial.
--
-- FORMA (D-500-01/02): três `boolean` independentes, nuláveis, SEM
-- `default`. Independentes porque são três perguntas que não se
-- excluem — uma lista fechada obrigaria a inventar o vocabulário das
-- combinações. Nuláveis e sem default porque `null` é "não avaliado",
-- que é a verdade de hoje para a maior parte do parque; um
-- `default false` afirmaria que os 175 equipamentos foram conferidos e
-- nenhum é inverter, o que seria dado inventado nascendo já errado.
-- Mesma forma de `refrig_permanente` (migração 04), de propósito.
--
-- `redundante` é MARCA, não par (D-500-03): qual unidade faz backup de
-- qual não é modelado aqui. As duplas já são legíveis por prédio+local,
-- e uma FK `redundante_de` exigiria eleger a principal em cada par —
-- decisão de campo, não de esquema. Se um dia for preciso, é coluna
-- nova, aditiva, sem desfazer esta.
--
-- ORDEM DE PUBLICAÇÃO (mesma de D-q57-06/D-uyz-24/D-cf8-25): o frontend
-- vai a produção ANTES deste SQL. Até ele rodar, a sonda `ATRIB_OK` da
-- tela é falsa e o módulo se comporta byte a byte como hoje — os três
-- campos não aparecem no formulário, não entram nas colunas da planilha
-- do inventário e nenhum `update` os cita. Na ordem inversa nada
-- quebraria (colunas a mais que ninguém lê), mas a sonda daria
-- verdadeiro contra uma tela que ainda não sabe o que fazer com elas.
--
-- Aditiva: nenhum `drop`, nenhuma coluna existente alterada, nenhuma
-- policy tocada — `equipamentos` já tem RLS ligada desde a migração 04 e
-- as colunas novas herdam as policies da tabela.
-- ══════════════════════════════════════════════════════════════════

alter table equipamentos add column if not exists inverter   boolean;
alter table equipamentos add column if not exists redundante boolean;
alter table equipamentos add column if not exists automacao  boolean;

comment on column equipamentos.inverter   is 'Compressor de rotação variável (inverter). null = não avaliado.';
comment on column equipamentos.redundante is 'Unidade reserva do mesmo ambiente. null = não avaliado.';
comment on column equipamentos.automacao  is 'Controlável por sistema de automação predial. null = não avaliado.';

-- Conferência (esperado: 3 linhas, todas boolean e is_nullable = YES):
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'equipamentos'
--    and column_name in ('inverter','redundante','automacao')
--  order by column_name;
