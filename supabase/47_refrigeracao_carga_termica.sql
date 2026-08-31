-- ══════════════════════════════════════════════════════════════════
-- 47 — Carga térmica: tipo de uso do ambiente e janelas insoladas
-- (/refrigeracao)
--
-- A migração 04 já criou os cinco campos que descrevem o AMBIENTE onde
-- a máquina está — `area_m2`, `pe_direito`, `n_pessoas`, `dissipacao_w`
-- e `fator_insolacao` — e nenhum deles jamais foi usado para calcular
-- coisa alguma. São entradas de um cálculo de carga térmica que nunca
-- foi escrito: o app sabe a capacidade INSTALADA (`btu`) e não sabe a
-- capacidade NECESSÁRIA, então não consegue dizer a única coisa que
-- decide troca de máquina — se o aparelho está subdimensionado (gela
-- mal, roda 100% do tempo, quebra cedo) ou superdimensionado (liga e
-- desliga, não desumidifica, gasta a mais).
--
-- Faltam duas entradas para fechar a conta, e são estas duas colunas:
--
--   tipo_uso  — o que se faz na sala. Decide a carga base por m², a
--               densidade de iluminação e o calor por pessoa: uma sala
--               técnica com servidores e um corredor de mesma área não
--               pedem a mesma máquina. Sem isso o cálculo teria de
--               supor "escritório" para o parque inteiro, inclusive
--               para os paióis e o rancho.
--   janelas   — nº de janelas com insolação direta. É carga pontual
--               (~800 BTU/h cada), não um fator multiplicativo: duas
--               janelas numa sala pequena pesam proporcionalmente muito
--               mais que numa grande, e um fator não sabe disso.
--
-- FORMA — nuláveis, sem `default`, mesma decisão de D-500-02 e de
-- `refrig_permanente`: `null` é "não avaliado", que é a verdade de hoje
-- para o parque inteiro. Um `default 'escritorio'` afirmaria que os 175
-- ambientes foram visitados e todos são escritório; um `default 0` em
-- `janelas` afirmaria que ninguém tem janela ensolarada. As duas
-- mentiras entrariam no cálculo sem aviso e sairiam do outro lado como
-- um veredito de dimensionamento — que é pior que não calcular.
--
-- POR QUE `fator_insolacao` NÃO GANHA COLUNA: ela já existe desde a 04
-- como `numeric default 1.0`, que é exatamente a forma que o cálculo
-- consome (1.0 sem sol direto → 1.25 poente). A tela oferece a lista
-- fechada por rótulo e grava o número; inventar uma coluna de texto ao
-- lado criaria duas fontes para o mesmo fato.
--
-- `tipo_uso` é lista fechada NO BANCO, não só na tela: é o único dos
-- dois campos cujo valor indexa uma tabela de constantes do app
-- (carga base, W/m² de iluminação, BTU por pessoa). Um valor fora da
-- lista não daria erro — cairia no ramo `outro` e produziria um número
-- plausível e errado, em silêncio.
-- ══════════════════════════════════════════════════════════════════

alter table equipamentos add column if not exists tipo_uso text;
alter table equipamentos add column if not exists janelas integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_tipo_uso_check'
  ) then
    alter table equipamentos add constraint equipamentos_tipo_uso_check
      check (tipo_uso is null or tipo_uso in (
        'escritorio','sala_reuniao','sala_tecnica','dormitorio','refeitorio',
        'corredor','almoxarifado','enfermaria','garagem','outro'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'equipamentos_janelas_check'
  ) then
    alter table equipamentos add constraint equipamentos_janelas_check
      check (janelas is null or (janelas >= 0 and janelas <= 50));
  end if;
end $$;

comment on column equipamentos.tipo_uso is
  'Uso do ambiente — indexa carga base por m2, W/m2 de iluminacao e BTU por pessoa no calculo de carga termica. Lista fechada; null = nao avaliado.';
comment on column equipamentos.janelas is
  'Numero de janelas com insolacao direta. Carga pontual (~800 BTU/h cada), nao fator. null = nao avaliado.';
