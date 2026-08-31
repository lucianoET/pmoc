-- ══════════════════════════════════════════════════════════════════
-- 48 — Parâmetros de inspeção: ruído, qualidade do ar, aspecto, dreno
-- e suporte (/refrigeracao)
--
-- A OS registra hoje sete medições (insuflamento, retorno, ΔT,
-- corrente, pressão, dois capacitores, tensão) — todas elétricas ou
-- termodinâmicas. Nenhuma delas responde ao que o usuário da sala
-- reclama e ao que a NBR 13971/16401 mandam verificar numa preventiva:
-- se o ar sai limpo, se a máquina virou um barulho, se está pingando,
-- se o suporte ainda segura.
--
-- Cinco colunas em `logs_manutencao`, uma por pergunta:
--
--   ruido_db      — numérico. É a única das cinco que se MEDE, com
--                   aparelho, e por isso é a única que entra na série
--                   histórica da ficha ao lado das outras medições:
--                   ruído que sobe ao longo das OS é rolamento ou
--                   ventilador saindo de balanceamento, e isso só
--                   aparece na curva, nunca numa leitura isolada.
--   qualidade_ar  — filtro/serpentina/odor: o que a sala respira.
--   aspecto       — estado visual do conjunto (gabinete, pintura,
--                   isolamento das linhas).
--   dreno         — escoamento do condensado. É a causa nº 1 de
--                   chamado corretivo em split e a que mais estraga
--                   forro e parede quando passa despercebida.
--   suporte       — fixação da condensadora/evaporadora. Sozinha entre
--                   as cinco, é risco de queda, não de conforto.
--
-- FORMA — as quatro últimas são lista fechada de TRÊS estados
-- (`bom` | `regular` | `ruim`), nuláveis e sem `default`. Três e não
-- dois porque "regular" é o achado que gera a próxima OS preventiva
-- sem gerar corretiva agora, e uma escala de dois obrigaria o técnico
-- a chamar de "bom" o dreno que está começando a acumular. Nuláveis
-- porque `null` é "não avaliado" — uma OS de recarga de gás não
-- inspeciona suporte, e um `default 'bom'` faria o banco afirmar uma
-- conferência que ninguém fez (mesma lição de D-500-02).
--
-- Escala verbal e não nota de 0 a 10: a nota sugere uma precisão que a
-- inspeção visual não tem, e duas pessoas dariam 6 e 8 para o mesmo
-- dreno. Três palavras são reprodutíveis entre técnicos, que é o que
-- faz a série valer alguma coisa.
--
-- `ruido_db` tem teto de 130 dB no `check` — acima disso é erro de
-- digitação (limiar de dor humana ~120 dB), não leitura de um ar
-- condicionado. O piso é 0.
-- ══════════════════════════════════════════════════════════════════

alter table logs_manutencao add column if not exists ruido_db numeric;
alter table logs_manutencao add column if not exists qualidade_ar text;
alter table logs_manutencao add column if not exists aspecto text;
alter table logs_manutencao add column if not exists dreno text;
alter table logs_manutencao add column if not exists suporte text;

do $$
declare
  col text;
begin
  if not exists (
    select 1 from pg_constraint where conname = 'logs_manutencao_ruido_db_check'
  ) then
    alter table logs_manutencao add constraint logs_manutencao_ruido_db_check
      check (ruido_db is null or (ruido_db >= 0 and ruido_db <= 130));
  end if;

  -- A mesma escala nas quatro: uma lista, quatro constraints geradas do
  -- mesmo texto, para nenhuma delas divergir das outras com o tempo.
  foreach col in array array['qualidade_ar','aspecto','dreno','suporte'] loop
    if not exists (
      select 1 from pg_constraint where conname = 'logs_manutencao_'||col||'_check'
    ) then
      execute format(
        'alter table logs_manutencao add constraint %I check (%I is null or %I in (''bom'',''regular'',''ruim''))',
        'logs_manutencao_'||col||'_check', col, col
      );
    end if;
  end loop;
end $$;

comment on column logs_manutencao.ruido_db is
  'Ruido medido em dB(A). Unica das cinco que se mede com aparelho — entra na serie historica da ficha. null = nao avaliado.';
comment on column logs_manutencao.qualidade_ar is
  'Filtro/serpentina/odor: bom | regular | ruim. null = nao avaliado.';
comment on column logs_manutencao.aspecto is
  'Estado visual do conjunto: bom | regular | ruim. null = nao avaliado.';
comment on column logs_manutencao.dreno is
  'Escoamento do condensado: bom | regular | ruim. null = nao avaliado.';
comment on column logs_manutencao.suporte is
  'Fixacao da condensadora/evaporadora — risco de queda: bom | regular | ruim. null = nao avaliado.';
