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
--   redundante  — participa de um arranjo em que só um equipamento do
--                 conjunto opera por vez. NÃO é "esta é a reserva": nos
--                 paióis são duas máquinas por câmara em rodízio, sem
--                 principal fixa, e no F21 o conjunto é o sistema
--                 central do prédio contra os splits instalados depois
--                 (ou os centrais ligam, ou os splits). É o que separa
--                 "sala parada" de "sala com o outro equipamento
--                 ligado", e hoje o cadastro não sabe distinguir um
--                 desses arranjos de uma máquina solitária.
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
-- `redundante` é MARCA, não conjunto nomeado (D-500-03): a coluna diz
-- que o equipamento participa de um arranjo, não com quem. Foi conferido
-- que prédio+local NÃO serve de atalho para descobrir o conjunto — as 5
-- máquinas do RANCHO/COZINHA e as 3 da PRAÇA D'ARMAS dividem o mesmo
-- local e ligam JUNTAS (capacidade), enquanto o arranjo do F21 atravessa
-- vários `local` (central do prédio × splits por sala). Nomear o
-- conjunto exige uma coluna a mais (`grupo_redundancia`) e é decisão do
-- usuário; quando vier, é aditiva e não desfaz esta.
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
comment on column equipamentos.redundante is 'Participa de arranjo em que só um equipamento do conjunto opera por vez (rodízio no paiol; central x splits no F21). Não é reserva fixa. null = não avaliado.';
comment on column equipamentos.automacao  is 'Controlável por sistema de automação predial. null = não avaliado.';

-- Conferência (esperado: 3 linhas, todas boolean e is_nullable = YES):
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'equipamentos'
--    and column_name in ('inverter','redundante','automacao')
--  order by column_name;
