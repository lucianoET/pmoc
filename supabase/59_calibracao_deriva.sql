-- ══════════════════════════════════════════════════════════════════
-- 59 · /calibracao — os três campos que o formulário coletava e a
--      fronteira jogava fora
--
-- O formulário "Atualizar — PS-CMS-…" coleta há tempo três coisas que
-- NUNCA chegaram ao banco: os pontos as-found/as-left (`AflEditor`), a
-- marca de que houve ajuste no instrumento, e "Aprovado por". Nenhum dos
-- três está em `CAMPOS_PS`, e `paraLinha` só copia o que está no mapa —
-- então some sem erro nenhum, que é exatamente a falha que o gate
-- `tests/calibracao-supabase.test.js` declara existir para pegar: ele
-- compara o mapa com as colunas da migração 35, e um campo de TELA sem
-- coluna passa por baixo dele.
--
-- Não é perda cosmética. `maxAbsErr(p.afl, 'found')` alimenta:
--   · a seção "Deriva e desempenho (ILAC-G24)" da ficha do instrumento
--     (gráfico + tabela as-found/as-left/ajuste);
--   · `sugestaoIntervalo` (método escada: reduzir 0,7 / manter /
--     estender 1,25);
--   · a lista de não-conformidades do dashboard ("Erro as-found > EMA");
--   · a ficha impressa (`driftRows`).
--
-- Conferido em produção em 04/09/2026, pela porta da frente com a anon
-- key: `select id,afl` devolve 400 (a coluna não existe), e `cal_ps` tem
-- 12 linhas das quais 5 são CONCLUIDO com `cal` e `cert` — as cinco que
-- `calHistorico` analisaria. Ou seja: a análise de deriva do módulo
-- roda, hoje, sobre dado que nunca foi salvo, e a mensagem que ela
-- exibe manda o usuário "registrar os erros as-found nas calibrações
-- concluídas" — pedindo justamente o que o aplicativo descarta.
--
-- ── por que três colunas e não uma
-- `afl` é a lista de pontos; `ajust` é um fato sobre a intervenção (o
-- laboratório mexeu no instrumento), lido em `calHistorico` como coluna
-- própria da tabela de deriva; `apv` é o nome de quem aprovou. Enfiar os
-- três num único jsonb faria o Postgres deixar de saber que `ajust` é
-- booleano e que `apv` é texto, e obrigaria toda leitura a cavar dentro
-- do documento para responder uma pergunta escalar.
--
-- ── nuláveis e SEM default, as três
-- Mesma regra de `refrig_permanente` (migração 45, D-500-02): `null` é
-- "não registrado", que é a verdade das 12 linhas de hoje. Um
-- `default false` em `ajust` afirmaria "não houve ajuste" em 12 PS que
-- ninguém avaliou, e um `default '[]'` em `afl` afirmaria "calibração
-- sem nenhum ponto medido".
--
-- ── o único check, e por que só ele
-- `afl` é consumido por `(afl || []).forEach(...)`: se algum dia entrar
-- um objeto ou um número no lugar da lista, `forEach` não existe e a
-- ficha do instrumento quebra inteira — não é dado ruim, é tela que não
-- abre. O check garante a única coisa de que o código depende: que seja
-- uma lista. A FORMA de cada ponto fica de fora de propósito; travá-la
-- obrigaria uma migração no dia em que o ponto ganhar mais um campo, e
-- um campo a mais lá dentro não quebra `forEach`.
--
-- Uma coluna recém-criada pode ser restringida sem invalidar linha
-- nenhuma — o mesmo precedente de `cmasm_locais.geom` (migração 37),
-- e o oposto de `maq_areas.geom`, que nasceu sem guarda.
--
-- Aditiva: nada de `drop`, nada de alterar coluna existente. As policies
-- de `cal_ps` (migrações 35 e 39) valem para a linha inteira e já cobrem
-- as colunas novas — leitura em `public`, escrita em `authenticated`.
-- ══════════════════════════════════════════════════════════════════

alter table cal_ps add column if not exists afl   jsonb;
alter table cal_ps add column if not exists ajust boolean;
alter table cal_ps add column if not exists apv   text;

comment on column cal_ps.afl is
  'Pontos as-found/as-left do certificado: lista de {pt, found, left, un}. '
  'pt e un são texto (o ponto pode ser "10 V"); found e left são número, '
  'validados na tela pela porta de leitura numérica do módulo.';
comment on column cal_ps.ajust is
  'O laboratório ajustou o instrumento entre o as-found e o as-left. '
  'null = não registrado, que é diferente de false = não houve ajuste.';
comment on column cal_ps.apv is
  'Quem aprovou o retorno do instrumento ao uso.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cal_ps_afl_lista_check'
  ) then
    alter table cal_ps add constraint cal_ps_afl_lista_check
      check (afl is null or jsonb_typeof(afl) = 'array');
  end if;
end $$;
