-- ══════════════════════════════════════════════════════════════════
-- 57 — As quatro colunas de operação ganham check (/refrigeracao)
--
-- Continuação direta da 56, e pelo mesmo motivo. A varredura de 02/09
-- encontrou 77 colunas numéricas sem `check` no banco inteiro; triadas
-- por risco real — sem check E preenchível por uma pessoa — sobraram
-- estas quatro como as únicas urgentes, porque estão na planilha que o
-- usuário levou a campo AGORA:
--
--   horas_dia, dias_semana, tensao, btu
--
-- Depois do conserto de 02/09 a importação já recusa negativo, mas nem
-- ela nem o banco recusavam `horas_dia = 30` ou `dias_semana = 99`. As
-- duas alimentam a estimativa de consumo em kWh: 30 h/dia infla o
-- consumo do parque inteiro em 25%, sem erro nenhum na tela — a mesma
-- classe de `dissipacao_w = '1.200'` virando 1,2 que motivou a 56.
--
-- ADITIVA e segura AGORA: medido em 02/09/2026 sobre as 175 linhas,
-- horas_dia 8–24, dias_semana 5–7, tensao 127–380 e btu 7.500–360.000,
-- com ZERO valor impossível. Fica mais caro depois que o levantamento
-- de campo preencher o resto — daí a pressa relativa.
--
-- ── Por que `btu >= 0` e não `> 0` ────────────────────────────────
-- Esta é a decisão que só o dado mostrou. Dois equipamentos têm `btu`
-- nulo, e `dbToEquip` faz `o.btu = o.btu || 0` — então essas duas linhas
-- saem da exportação com a célula "0". Um check `> 0` as recusaria em
-- TODA importação, mesmo sem ninguém as tocar, e uma linha recusada
-- bloqueia o arquivamento do arquivo inteiro (D-5hy-11). O ciclo fechado
-- de D-5hy-04 quebraria por causa de uma constraint escrita por gosto.
-- `tensao` não sofre disso (dbToEquip não a força) e por isso exige
-- >= 1: zero volt não é uma tensão.
--
-- Os tetos são generosos de propósito, para pegar digitação e não para
-- modelar o CMASM: 1000 V cobre qualquer quadro predial, e 5.000.000
-- BTU/h é ~417 TR, muito acima da maior central instalada (30 TR).
-- ══════════════════════════════════════════════════════════════════

do $$
begin
  -- Hora do dia e dia da semana têm teto físico, não convencional:
  -- não existe vigésima quinta hora nem oitavo dia. Zero é legítimo nas
  -- duas — máquina instalada e desligada opera zero hora por dia, e é
  -- justamente o caso em que a estimativa de consumo tem de dar zero.
  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_horas_dia_check'
  ) then
    alter table equipamentos add constraint equipamentos_horas_dia_check
      check (horas_dia is null or (horas_dia >= 0 and horas_dia <= 24));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_dias_semana_check'
  ) then
    alter table equipamentos add constraint equipamentos_dias_semana_check
      check (dias_semana is null or (dias_semana >= 0 and dias_semana <= 7));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_tensao_check'
  ) then
    alter table equipamentos add constraint equipamentos_tensao_check
      check (tensao is null or (tensao >= 1 and tensao <= 1000));
  end if;

  -- `btu` aceita zero por causa do `|| 0` de dbToEquip; ver o cabeçalho.
  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_btu_check'
  ) then
    alter table equipamentos add constraint equipamentos_btu_check
      check (btu is null or (btu >= 0 and btu <= 5000000));
  end if;
end $$;

comment on constraint equipamentos_horas_dia_check on equipamentos is
  'Migração 57. Alimenta a estimativa de kWh: 30 h/dia inflaria o consumo do parque em 25% sem erro na tela.';
