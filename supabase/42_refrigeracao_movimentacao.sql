-- ══════════════════════════════════════════════════════════════════
-- 42 — OS de Instalação e de Remoção, com baixa patrimonial
-- (/refrigeracao)
--
-- Hoje uma máquina entra e sai de um local sem registro nenhum:
-- `local_id`/`predio`/`local` são editados direto no cadastro e o valor
-- anterior some, sem data, sem quem fez, sem autorização de ninguém. A
-- OS de Instalação e a de Remoção trazem essa movimentação para o mesmo
-- fluxo de aprovação de duas pontas que a manutenção interna já tem
-- (migração 40) — e a baixa patrimonial passa a ser um ESTADO do
-- próprio equipamento, nunca uma linha apagada.
--
-- Números medidos em produção em 21/08/2026, antes desta migração:
--   `equipamentos`: 171 linhas, 32 colunas depois da 41. TODAS as
--   colunas de local são anuláveis (local_id, predio, local, area,
--   tipo, funciona, criticidade, estado) — limpar o local na remoção
--   não esbarra em `not null`. Zero equipamentos sem `local_id` hoje;
--   234 locais ativos em `cmasm_locais`. `logs_manutencao`: 26 colunas
--   depois da 41, 10 linhas, `tipo` com dois valores em uso (CORRETIVA
--   4, INSPEÇÃO 7) e SEM check constraint — INSTALAÇÃO/REMOÇÃO entram
--   sem tocar em trava nenhuma.
--
--   As 2 linhas históricas de `tipo = 'RETIRADO'` foram EXCLUÍDAS na
--   importação original (05_refrigeracao_import_171.sql, linha 4: "174
--   linhas → 171 equipamentos") — não há dado legado nenhum para
--   converter em `baixado`. `situacao` nasce do zero, para as 171
--   linhas vivas de hoje.
--
--   `cmasm_locais.id` é `integer`; `equipamentos.id` é `serial`
--   (integer) — as três FKs novas desta migração são `integer`, não
--   `uuid` nem `bigint`.
--
-- ORDEM DE PUBLICAÇÃO (D-uyz-24, mesma ideia de D-q57-06/D-l7n-06): o
-- frontend vai a produção ANTES deste SQL. `MOV_OK` (sonda própria,
-- separada de `MAN_FLUXO_OK`) mantém o terceiro segmento da aba OS
-- desligado sem erro nenhum enquanto esta migração não roda, e o /mapa
-- recua para a consulta sem `situacao` no primeiro 400 do PostgREST. Na
-- ordem inversa, o banco teria `situacao` e a tela publicada ainda
-- contaria toda máquina como operante — sem erro nenhum que denunciasse.
--
-- Aditivo, para ser rodado no SQL editor do Supabase — este arquivo só
-- escreve o script, nunca o executa. Nenhum `drop table`, `drop column`
-- nem `delete from` em lugar nenhum deste arquivo — o projeto arquiva.
-- ══════════════════════════════════════════════════════════════════

-- 1) `equipamentos.situacao` — nasce com default, preenchendo as 171
-- linhas SEM reescrever a tabela (Postgres 11+), o que dispensa o
-- `update` de backfill que a migração 41 precisou fazer para `funciona`
-- (lá a coluna já existia com dado; aqui ela nasce agora). Mesmo assim,
-- os três comandos abaixo garantem a FORMA, não só a existência —
-- `add column if not exists` é no-op numa coluna que já existe e NÃO
-- garante tipo, default nem `not null` (a armadilha que custou a
-- migração 28: `rep_*` criadas de um esquema rascunho, com a 26 pulada
-- em silêncio). Os três comandos são idempotentes.
alter table equipamentos add column if not exists situacao text not null default 'instalado';
alter table equipamentos alter column situacao set default 'instalado';
update equipamentos set situacao = 'instalado' where situacao is null;
alter table equipamentos alter column situacao set not null;

-- 2) Datas da movimentação — anuláveis, sem default: só passam a
-- existir quando a OS correspondente é conferida.
alter table equipamentos add column if not exists data_remocao date;
alter table equipamentos add column if not exists data_baixa date;

-- 3) Trava da situação — sem dado legado a migrar antes (a coluna
-- nasceu com o default no passo 1), então nenhuma linha pode invalidar
-- a trava no momento em que ela é criada.
alter table equipamentos drop constraint if exists equipamentos_situacao_chk;
alter table equipamentos add constraint equipamentos_situacao_chk
  check (situacao in ('instalado', 'removido', 'baixado'));

-- 4) Trava de coerência da baixa — possível porque `baixado` é
-- TERMINAL (D-uyz-05): não existe caminho de volta que deixasse uma
-- `data_baixa` órfã. Não existe a trava simétrica para `data_remocao`
-- de propósito: uma máquina removida e depois reinstalada mantém, por
-- histórico, a data da remoção anterior — não é incoerência.
alter table equipamentos drop constraint if exists equipamentos_baixa_chk;
alter table equipamentos add constraint equipamentos_baixa_chk
  check (data_baixa is null or situacao = 'baixado');

-- 5) Quatro colunas novas em `logs_manutencao`, todas anuláveis — só a
-- OS de movimentação as usa. `on delete set null` (não `cascade`, que
-- `equip_id` usa): perder a referência é ruim, apagar a OS inteira é
-- pior — e o projeto arquiva, então na prática nenhuma das três
-- dispara. Tipos `integer` porque `cmasm_locais.id` e `equipamentos.id`
-- são `integer` (migrações 04 e 19), não `uuid` como `logs_manutencao.id`.
alter table logs_manutencao add column if not exists local_destino_id integer references cmasm_locais(id) on delete set null;
alter table logs_manutencao add column if not exists local_origem_id integer references cmasm_locais(id) on delete set null;
alter table logs_manutencao add column if not exists equip_substituido_id integer references equipamentos(id) on delete set null;
alter table logs_manutencao add column if not exists destino_remocao text;

-- 6) Trava do destino da remoção — `null` é o caso normal: toda OS que
-- não é de remoção.
alter table logs_manutencao drop constraint if exists logs_manutencao_destino_remocao_chk;
alter table logs_manutencao add constraint logs_manutencao_destino_remocao_chk
  check (destino_remocao is null or destino_remocao in ('guardada', 'baixa'));

-- 7) Nenhum índice novo. Nenhuma consulta do app filtra por estas
-- quatro colunas — loadLogsFromSupabase() faz select('*') sem `where` e
-- resolve tudo em memória. O índice de equip_id da migração 40 existe
-- porque ctEncerrarHistorico() consulta por ele; criar índice numa
-- tabela de 10 linhas que ninguém consulta só custaria escrita.

-- 8) Comentários das sete colunas novas.
comment on column equipamentos.situacao is
  'Situação patrimonial: instalado / removido (sem local, no inventário) / baixado (terminal). '
  'ORTOGONAL a `funciona` (D-uyz-20) — uma diz onde a máquina está no ciclo patrimonial, a '
  'outra diz se ela funciona. `baixado` é terminal: uma OS de instalação recusa máquina baixada.';
comment on column equipamentos.data_remocao is
  'Data da OS de remoção que tirou a máquina do local (D-uyz-18: a data da OS, nunca a do clique).';
comment on column equipamentos.data_baixa is
  'Data da OS de remoção com destino baixa (D-uyz-18). Só preenchida quando situacao = baixado.';
comment on column logs_manutencao.local_destino_id is
  'OS de Instalação: local (cmasm_locais) para onde a máquina vai. Base da derivação dos três '
  'casos de instalação (D-uyz-03) — nunca digitado, sempre derivado do dado gravado.';
comment on column logs_manutencao.local_origem_id is
  'OS de Remoção: local (cmasm_locais) de onde a máquina saiu, copiado do local_id do '
  'equipamento no momento da abertura.';
comment on column logs_manutencao.equip_substituido_id is
  'OS de Instalação: referência DOCUMENTAL a uma máquina substituída ("B entrou no lugar de '
  'A") — D-uyz-03/D-uyz-14. Não remove A; A precisa da própria OS de remoção.';
comment on column logs_manutencao.destino_remocao is
  'OS de Remoção: guardada (volta ao inventário sem local) ou baixa (baixa patrimonial, exige '
  'cargo admin — D-uyz-06/D-uyz-07, trava UX apenas).';

-- 9) Nada de RLS neste arquivo: as policies de `equipamentos` e
-- `logs_manutencao` continuam `to authenticated using (true)`, sem
-- distinção de cargo (D-uyz-23) — a trava de admin da baixa é UX
-- apenas, registrada sem eufemismo no SUMMARY. Nenhuma tabela nova foi
-- criada, então nenhuma policy nova é devida.

-- ══════════════════════════════════════════════════════════════════
-- Conferência pós-aplicação (rodar depois, no SQL editor):
--
-- select situacao, count(*) from equipamentos group by situacao order by situacao;
-- -- esperado nesta migração: instalado 171, e nada mais
--
-- select column_name from information_schema.columns
--   where (table_name = 'equipamentos' and column_name in ('situacao','data_remocao','data_baixa'))
--   or (table_name = 'logs_manutencao' and column_name in
--     ('local_destino_id','local_origem_id','equip_substituido_id','destino_remocao'));
-- -- esperado: 7 linhas
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid in ('equipamentos'::regclass, 'logs_manutencao'::regclass)
--   and conname in ('equipamentos_situacao_chk','equipamentos_baixa_chk',
--     'logs_manutencao_destino_remocao_chk');
-- -- esperado: 3 linhas, as três travas descritas acima
--
-- select is_nullable, column_default from information_schema.columns
--   where table_name = 'equipamentos' and column_name = 'situacao';
-- -- esperado: NO, 'instalado'::text — prova que a FORMA foi garantida, não só a existência
--
-- select count(*) from equipamentos where situacao <> 'instalado';
-- -- esperado: 0 no dia da aplicação
-- ══════════════════════════════════════════════════════════════════
