-- ══════════════════════════════════════════════════════════════════
-- 40 — Fluxo de aprovação da OS interna de manutenção (/refrigeracao)
--
-- Hoje a manutenção interna nasce já com um status escolhido num select
-- (PENDENTE/PARCIAL/CONCLUÍDA) — ninguém autoriza antes, ninguém confere
-- depois. O pedido do usuário foi trazer o mesmo fluxo de aprovação que a
-- contratação (os_contratacao) já tem para a manutenção interna
-- (logs_manutencao): o gestor autoriza antes da execução e confere
-- depois dela. Sete estados novos, adjacência mais cancelamento,
-- evidência (fotos + as cinco medições que existem desde a migração 04 e
-- nunca foram gravadas), e a data de última manutenção passando a ser
-- gravada pela conferência do gestor, não pela abertura da OS.
--
-- logs_manutencao.status NÃO tinha check constraint até este arquivo (só
-- as duas FKs) — ampliar o vocabulário não troca trava nenhuma, cria a
-- primeira. As 10 linhas existentes gravam PENDENTE/PARCIAL/CONCLUÍDA
-- (CONCLUÍDA com acento) e continuam exatamente como estão: o projeto
-- arquiva, nunca reescreve histórico.
--
-- Aditivo, aplicado à mão pelo usuário no SQL editor do Supabase — este
-- arquivo só escreve o script, nunca o executa.
-- ══════════════════════════════════════════════════════════════════

-- 1) Nove colunas novas — evidência da execução e assinaturas de cada etapa.
alter table logs_manutencao add column if not exists fotos jsonb default '[]'::jsonb;
alter table logs_manutencao add column if not exists delineado_por text;
alter table logs_manutencao add column if not exists delineado_em timestamptz;
alter table logs_manutencao add column if not exists aprovador text;
alter table logs_manutencao add column if not exists data_aprovacao date;
alter table logs_manutencao add column if not exists parecer_aprovacao text;
alter table logs_manutencao add column if not exists conferente text;
alter table logs_manutencao add column if not exists data_conferencia date;
alter table logs_manutencao add column if not exists parecer_conferencia text;

-- 2) Trava de status — não existia nenhuma. Os sete estados do fluxo novo
-- mais os três do legado entram JUNTOS na mesma trava (não com `not
-- valid`): com `not valid` as 10 linhas antigas seriam perdoadas na
-- criação da trava mas passariam a ser CHECADAS em qualquer update
-- futuro delas — e a trava estouraria justamente numa correção de
-- histórico, o oposto do que se quer. 'CONCLUÍDA' entra com acento, que
-- é como as linhas existentes estão gravadas hoje (conferido em
-- produção) — não é o mesmo texto do terminal novo ('CONFERIDA').
alter table logs_manutencao drop constraint if exists logs_manutencao_status_check;
alter table logs_manutencao add constraint logs_manutencao_status_check
  check (status in (
    'ABERTA','DELINEAMENTO','APROVACAO','EM_EXECUCAO','EXECUTADA','CONFERIDA','CANCELADA',
    'PENDENTE','PARCIAL','CONCLUÍDA'
  ));

-- 3) Índice do FK — o Postgres não indexa FK sozinho, e equip_id é por
-- onde ctEncerrarHistorico() já consulta. Aditivo e barato.
create index if not exists logs_manutencao_equip_id_idx on logs_manutencao(equip_id);

-- 4) Comentários das colunas novas.
comment on column logs_manutencao.fotos is
  'Caminhos no bucket os-fotos (prefixo manutencao/<log_id>/) das fotos de evidência da execução.';
comment on column logs_manutencao.delineado_por is
  'Nome de quem encerrou o delineamento (diagnóstico) e enviou para aprovação do gestor.';
comment on column logs_manutencao.delineado_em is
  'Momento em que o delineamento foi encerrado.';
comment on column logs_manutencao.aprovador is
  'Nome do gestor que autorizou a execução (APROVACAO → EM_EXECUCAO).';
comment on column logs_manutencao.data_aprovacao is
  'Data em que o gestor autorizou a execução.';
comment on column logs_manutencao.parecer_aprovacao is
  'Parecer do gestor ao devolver a OS de APROVACAO para DELINEAMENTO.';
comment on column logs_manutencao.conferente is
  'Nome do gestor que conferiu a execução (EXECUTADA → CONFERIDA), encerrando a OS.';
comment on column logs_manutencao.data_conferencia is
  'Data em que o gestor conferiu a execução.';
comment on column logs_manutencao.parecer_conferencia is
  'Parecer do gestor ao devolver a OS de EXECUTADA para EM_EXECUCAO, ou parecer opcional na conferência aprovada.';

-- Nada de RLS neste arquivo: a policy de logs_manutencao fica como está
-- (for ... to authenticated using(true), sem distinção de cargo) — fechar
-- por cargo é decisão explicitamente fora de escopo deste quick task
-- (pendência registrada no SUMMARY). Nenhuma policy de storage nova: o
-- bucket os-fotos já tem a policy de upload para authenticated no bucket
-- inteiro, criada na migração 07.

-- ══════════════════════════════════════════════════════════════════
-- Conferência pós-aplicação (rodar depois, no SQL editor):
--
-- select count(*) from information_schema.columns
--   where table_name='logs_manutencao'
--   and column_name in ('fotos','delineado_por','delineado_em','aprovador',
--     'data_aprovacao','parecer_aprovacao','conferente','data_conferencia',
--     'parecer_conferencia');
-- -- esperado: 9
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'logs_manutencao'::regclass
--   and conname = 'logs_manutencao_status_check';
-- -- esperado: os 10 valores, sete novos + três do legado
--
-- select indexname from pg_indexes
--   where tablename='logs_manutencao' and indexname='logs_manutencao_equip_id_idx';
-- -- esperado: 1 linha
--
-- select status, count(*) from logs_manutencao group by status order by status;
-- -- esperado: as 10 linhas antigas continuam válidas, agrupadas por
-- -- PENDENTE/PARCIAL/CONCLUÍDA — nenhuma reescrita
-- ══════════════════════════════════════════════════════════════════
