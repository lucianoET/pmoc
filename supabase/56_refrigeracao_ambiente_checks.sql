-- ══════════════════════════════════════════════════════════════════
-- 56 — As cinco colunas de ambiente ganham o check que nunca tiveram
-- (/refrigeracao)
--
-- A migração 04 criou `area_m2`, `pe_direito`, `n_pessoas`,
-- `dissipacao_w` e `fator_insolacao` como `numeric`/`integer` PUROS,
-- sem constraint nenhuma. Enquanto ninguém conseguia preenchê-las isso
-- não custava nada: estavam fora de EQUIP_EDITAVEIS, logo eram nulas em
-- 175 linhas por falta de formulário (D-2wq-01). Entraram na lista em
-- 31/08 e passaram a ser graváveis pelo cadastro E pela planilha — e é
-- aí que a ausência de check vira risco real.
--
-- O contraste que decidiu esta migração está na 47, escrita no mesmo
-- dia: `tipo_uso` e `janelas` nasceram COM check, e por isso um valor
-- errado nelas é recusado pelo Postgres mesmo que a tela falhe. As
-- cinco da 04 não têm essa segunda barreira. Medido na travessia da
-- planilha antes do conserto de 02/09:
--
--   dissipacao_w = '1.200'  → o Postgres lê 1,2 e GRAVA, sem erro.
--                             Mil e duzentos watts viram um e dois
--                             décimos, e a carga térmica calcula com um
--                             milésimo da dissipação real.
--   area_m2      = '-5'     → aceito. Área negativa produz BTU negativo.
--   n_pessoas    = '-3'     → aceito. Ocupação negativa subtrai carga.
--
-- A validação de 02/09 em `celulaParaValor` fecha o caminho da planilha,
-- que é por onde o dado vai entrar agora. Esta migração fecha os outros:
-- o SQL editor, um seed futuro, qualquer caminho que não passe pela
-- tela. É o mesmo princípio já registrado na migração 25 — a integridade
-- vale "regardless of what client-side validation does".
--
-- ADITIVA e segura de aplicar a qualquer momento: as cinco colunas estão
-- NULAS nas 175 linhas (conferido em 02/09/2026 pela API REST), exceto
-- `fator_insolacao`, que tem `default 1.0` e vale 1.0 em todas — e 1.0
-- satisfaz o check. Nenhuma linha existente é invalidada, pela mesma
-- razão registrada na migração 37.
--
-- Sobre os limites superiores: são generosos de propósito, e existem só
-- para pegar erro de digitação — não para modelar o CMASM. Um teto
-- apertado que recusasse dado legítimo seria pior que teto nenhum, que é
-- o motivo de não haver limite superior para `dissipacao_w`: não há
-- número acima do qual uma sala de máquinas deixe de ser plausível.
-- ══════════════════════════════════════════════════════════════════

do $$
begin
  -- Área e pé-direito: > 0, nunca >= 0. Uma sala de zero metros
  -- quadrados não é uma medição, é um campo preenchido por engano — e
  -- zerá-la faria a carga base por m² dar zero, entregando um veredito
  -- de "cabe qualquer máquina" com aparência de conta feita.
  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_area_m2_check'
  ) then
    alter table equipamentos add constraint equipamentos_area_m2_check
      check (area_m2 is null or (area_m2 > 0 and area_m2 <= 10000));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_pe_direito_check'
  ) then
    alter table equipamentos add constraint equipamentos_pe_direito_check
      check (pe_direito is null or (pe_direito > 0 and pe_direito <= 30));
  end if;

  -- Ocupação e dissipação: >= 0, e o zero é legítimo nas duas. Uma sala
  -- de servidores sem ninguém dentro tem ocupação zero de verdade, e é
  -- exatamente o caso em que o resto da conta importa mais.
  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_n_pessoas_check'
  ) then
    alter table equipamentos add constraint equipamentos_n_pessoas_check
      check (n_pessoas is null or (n_pessoas >= 0 and n_pessoas <= 1000));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_dissipacao_w_check'
  ) then
    alter table equipamentos add constraint equipamentos_dissipacao_w_check
      check (dissipacao_w is null or dissipacao_w >= 0);
  end if;

  -- Fator de insolação é MULTIPLICADOR (D-2wq-02): zero anularia a
  -- parcela solar inteira em silêncio, e negativo a subtrairia. A tela
  -- oferece a lista fechada por rótulo e grava o número; o teto de 5
  -- está muito acima de qualquer valor que aquela lista produz.
  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_fator_insolacao_check'
  ) then
    alter table equipamentos add constraint equipamentos_fator_insolacao_check
      check (fator_insolacao is null or (fator_insolacao > 0 and fator_insolacao <= 5));
  end if;

  -- Corrente de placa: a migração 05 nunca a importou e ela é nula nas
  -- 175. Entra aqui pelo mesmo motivo das outras — é gravável pela
  -- planilha e não tinha barreira nenhuma.
  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_corrente_nominal_check'
  ) then
    alter table equipamentos add constraint equipamentos_corrente_nominal_check
      check (corrente_nominal is null or (corrente_nominal >= 0 and corrente_nominal <= 1000));
  end if;
end $$;

comment on constraint equipamentos_area_m2_check on equipamentos is
  'Migração 56. A coluna existe desde a 04 sem check; virou gravável em 31/08 pela planilha e pelo cadastro.';
