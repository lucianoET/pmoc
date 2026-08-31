-- ══════════════════════════════════════════════════════════════════
-- 43 — OS unificada por tipo de executor (/refrigeracao)
--
-- Hoje o módulo tem DUAS ordens de serviço que são a mesma coisa com
-- donos diferentes: a interna (`logs_manutencao`, migração 40, 6
-- estados terminando em CONFERIDA) e a de contratação
-- (`os_contratacao`, migração 04+07, 8 estados terminando em
-- ENCERRADA), cada uma com sua lista, seu formulário, sua gaveta, seu
-- vocabulário de estado e sua régua de etapas. `ctEncerrarHistorico()`
-- existe hoje só para ESPELHAR a OS de contratação de volta em
-- `logs_manutencao` quando ela encerra — prova de que são a mesma
-- coisa. Esta migração faz `logs_manutencao` ganhar um
-- `tipo_executor` (interna | externa | contrato) e as colunas que a
-- contratação precisa para viver na mesma linha; `os_contratacao` e
-- suas quatro filhas (`os_orcamento_itens`, `os_execucao`,
-- `os_composicao`, `os_eventos`) ficam DORMENTES, sem `drop` — o
-- projeto arquiva, nunca reescreve.
--
-- Números medidos em produção em 23/08/2026, antes desta migração:
-- `os_contratacao` 0 linhas, `os_orcamento_itens` 0, `os_execucao` 0,
-- `os_composicao` 0, `os_eventos` 0, `logs_manutencao` 0 — o usuário
-- zerou as duas tabelas de OS hoje. `equipamentos` 175, `arp_itens`
-- 19, preservados. NÃO HÁ um único dado de OS para migrar, e é
-- exatamente por isso que este é o momento da reestruturação: a troca
-- da trava de `status` (seção 4) só é segura numa tabela vazia — com
-- linhas dentro, qualquer literal fora da nova lista faria a trava
-- estourar na hora de criá-la.
--
-- ORDEM DE PUBLICAÇÃO (D-cf8-25, mesma regra de D-q57-06/D-uyz-24): o
-- frontend vai a produção ANTES deste SQL. `UNI_OK` (sonda própria,
-- separada de `MAN_FLUXO_OK`/`MOV_OK` — D-cf8-13, duas leituras, uma
-- pergunta) mantém a tela publicada se comportando byte a byte como
-- hoje enquanto esta migração não roda: seis estados terminando em
-- Conferida, sem seletor de executor, sem itens, sem comentários. Na
-- ordem inversa o banco teria `tipo_executor` e a tela publicada
-- continuaria escrevendo o vocabulário de 6 estados, sem erro nenhum
-- que denunciasse.
--
-- ESCRITA, AINDA NÃO APLICADA (D-cf8-26) — este arquivo só escreve o
-- script, nunca o executa. Aditiva: nenhuma tabela é excluída, nenhuma
-- coluna é excluída, nenhuma linha é apagada em lugar nenhum deste
-- arquivo — o projeto arquiva. As duas trocas de `check` (status e
-- as travas novas) usam `drop constraint if exists` + `add
-- constraint`, o mesmo *swap* que as migrações 40, 41 e 42 já
-- fizeram, e que aqui só é seguro porque `logs_manutencao` está vazia
-- hoje — nenhuma linha existente pode violar a trava nova.
-- APLICADA EM PRODUÇÃO EM 23/08/2026, depois do deploy do frontend, e
-- conferida pela porta da frente (anon key contra a API REST): a sonda
-- UNI_OK (select id,tipo_executor) responde 200; as três tabelas novas
-- respondem 200; as cinco dormentes seguem existindo; e o parque continua
-- com 175 equipamentos.
-- ══════════════════════════════════════════════════════════════════

-- 1) tipo_executor — lista fechada interna | externa | contrato,
-- default 'interna' (o padrão do banco, D-cf8-04/09). Quatro comandos
-- para garantir a FORMA e não só a existência (a armadilha da
-- migração 28, já documentada nas migrações 41/42: `add column if not
-- exists` é no-op numa coluna que já existe e não garante tipo,
-- default nem `not null`) — os quatro são idempotentes.
alter table logs_manutencao add column if not exists tipo_executor text not null default 'interna';
alter table logs_manutencao alter column tipo_executor set default 'interna';
update logs_manutencao set tipo_executor = 'interna' where tipo_executor is null;
alter table logs_manutencao alter column tipo_executor set not null;

alter table logs_manutencao drop constraint if exists logs_manutencao_tipo_executor_chk;
alter table logs_manutencao add constraint logs_manutencao_tipo_executor_chk
  check (tipo_executor in ('interna', 'externa', 'contrato'));

-- 2) Executor por tipo (D-cf8-07: texto por tipo, sem tabela de
-- empresas nem de setores) — todas anuláveis, só a OS do tipo
-- correspondente as usa.
alter table logs_manutencao add column if not exists executor_setor text;
alter table logs_manutencao add column if not exists executor_pessoas text;
alter table logs_manutencao add column if not exists executor_org text;

-- 3) Contrato — os campos do ciclo público que hoje moram em
-- `os_contratacao`, agora na mesma linha de `logs_manutencao`. Mesmos
-- nomes de coluna de `os_contratacao` onde já existiam
-- (empresa/fiscal/nf/data_nf/certificador/data_certificacao/
-- solicitante/ne/data_fiscalizacao/parecer_fiscal) — a costura
-- conceitual entre as duas tabelas fica legível mesmo sem migração de
-- dado nenhuma (não há dado para migrar, seção acima).
alter table logs_manutencao add column if not exists numero text;
alter table logs_manutencao add column if not exists empresa text;
alter table logs_manutencao add column if not exists empresa_cnpj text;
alter table logs_manutencao add column if not exists instrumento text;
alter table logs_manutencao add column if not exists processo text;
alter table logs_manutencao add column if not exists solicitante text;
alter table logs_manutencao add column if not exists ne text;
alter table logs_manutencao add column if not exists nf text;
alter table logs_manutencao add column if not exists data_nf date;
alter table logs_manutencao add column if not exists certificador text;
alter table logs_manutencao add column if not exists data_certificacao date;
alter table logs_manutencao add column if not exists fiscal text;
alter table logs_manutencao add column if not exists data_fiscalizacao date;
alter table logs_manutencao add column if not exists parecer_fiscal text;

-- `instrumento` só faz sentido em `contrato`, e só dentro da lista
-- fechada da Lei 14.133/2021 que o módulo já reconhece.
alter table logs_manutencao drop constraint if exists logs_manutencao_instrumento_chk;
alter table logs_manutencao add constraint logs_manutencao_instrumento_chk
  check (instrumento is null or (tipo_executor = 'contrato' and instrumento in ('licitacao', 'dispensa', 'adesao_arp', 'contrato')));

-- `numero` só existe em `contrato` (D-cf8-23) — nulo é o caso normal
-- de toda OS que não é de contrato, e é exatamente por isso que o
-- índice único abaixo é PARCIAL: um `unique` comum rejeitaria a
-- segunda OS interna (as duas com `numero` nulo).
alter table logs_manutencao drop constraint if exists logs_manutencao_numero_chk;
alter table logs_manutencao add constraint logs_manutencao_numero_chk
  check (numero is null or tipo_executor = 'contrato');

drop index if exists logs_manutencao_numero_uniq;
create unique index logs_manutencao_numero_uniq on logs_manutencao (numero) where numero is not null;

-- Nenhuma trava em `empresa`/`executor_org` — texto livre. Restringir
-- demais um campo de texto livre é o que obriga a próxima migração
-- (mesma régua de decisão da migração 42 sobre `empresa`/`executor_org`
-- na OS de movimentação).

-- 4) Troca da trava de `status` — treze literais: os seis do fluxo
-- próprio/externa (ABERTA, DELINEAMENTO, APROVACAO, EM_EXECUCAO,
-- CONCLUIDA, CANCELADA — CANCELADA compartilhada com o fluxo de
-- contrato), mais os três exclusivos do fluxo de contrato (EXECUTADA,
-- FISCALIZADA, ENCERRADA), mais CONFERIDA (D-cf8-11: sinônimo de
-- leitura de uma OS própria aberta entre 21 e 23/08, nunca mais
-- escrito) e os três do legado anterior à migração 40 (PENDENTE,
-- PARCIAL, CONCLUÍDA). `logs_manutencao` está vazia hoje (seção
-- acima) — a troca inteira, numa tacada só, é segura porque não há
-- linha nenhuma para a trava nova rejeitar.
--
-- 'CONCLUIDA' (sem acento, terminal do fluxo próprio/externa, D-cf8-10)
-- e 'CONCLUÍDA' (com acento, registro direto do legado, D-l7n-02) são
-- literais DISTINTOS de propósito — um acento os separa, e dois fatos
-- diferentes (um percorreu o fluxo de aprovação, o outro nunca
-- percorreu) não podem colapsar num literal só.
alter table logs_manutencao drop constraint if exists logs_manutencao_status_check;
alter table logs_manutencao add constraint logs_manutencao_status_check
  check (status in (
    'ABERTA', 'DELINEAMENTO', 'APROVACAO', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA',
    'EXECUTADA', 'FISCALIZADA', 'ENCERRADA',
    'CONFERIDA',
    'PENDENTE', 'PARCIAL', 'CONCLUÍDA'
  ));

-- 5) os_itens — itens de serviço e material em TODA OS (D-cf8-05),
-- tabela nova porque `os_orcamento_itens` tem FK fixa para
-- `os_contratacao(id)` e o projeto não derruba FK (D-cf8-14).
-- `tipo` em MAIÚSCULA de propósito — é a convenção da refrigeração
-- (ao contrário do `maq_`), e é o que permite reusar byte a byte as
-- classes `.orc-tipo.SERVICO`/`.orc-tipo.MATERIAL` que a folha de
-- estilo já tem (D-cf8-20). `total` é gerado, nunca digitado — mesmo
-- padrão de `os_composicao.total` (migração 04).
create table if not exists os_itens (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references logs_manutencao(id) on delete cascade,
  tipo text not null check (tipo in ('SERVICO', 'MATERIAL')),
  descricao text not null check (btrim(descricao) <> ''),
  unidade text,
  quantidade numeric not null default 1 check (quantidade > 0),
  valor_unitario numeric,
  total numeric generated always as (quantidade * coalesce(valor_unitario, 0)) stored,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

-- 6) os_comentarios — registro datado e assinado que se ACUMULA
-- (D-cf8-08), casa única do comentário do usuário E da trilha de
-- auditoria (D-cf8-15: mesma forma, mesma pergunta — "o que
-- aconteceu nesta OS, em ordem, assinado e datado" — distinguidos só
-- por `origem`). A caixa de texto do usuário escreve `usuario`; a
-- máquina de estados escreve `sistema`.
create table if not exists os_comentarios (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references logs_manutencao(id) on delete cascade,
  origem text not null default 'usuario' check (origem in ('usuario', 'sistema')),
  texto text not null check (btrim(texto) <> ''),
  autor text,
  cargo text,
  criado_em timestamptz not null default now()
);

-- 7) os_composicao_arp — a composição de pagamento por itens da ata,
-- só em `contrato` (D-cf8-06: separada do orçamento por exigência do
-- art. 86 da Lei 14.133/2021). `item_arp` é `integer`, o MESMO tipo
-- de `os_composicao.item_arp` (migração 07, linha 31) e de
-- `arp_itens.item` — a migração 07 (linha 35) converteu `arp_itens.item`
-- de `text` para `integer` de propósito, comentando "o app compara
-- item como número"; `ctConsumo` compara `integer` com `integer` e o
-- `===` acerta (conferido contra o banco vivo). Ler só a migração 04
-- sugeriria um defeito de tipo que não existe — "consertar" para
-- `text` aqui SERIA criar o defeito (D-cf8-17).
--
-- SEM FK para `arp_itens(item)`: a FK exigiria `unique(item)` sozinho,
-- e a chave natural da ata é `(numero_ata, item)` — os 19 itens de
-- hoje só são distintos porque existe UMA ata na base (ARP 04/2024);
-- um `unique(item)` proibiria uma segunda ata de ter o item 266, que é
-- exatamente o que uma segunda ata teria. Integridade aqui custaria
-- uma trava errada.
create table if not exists os_composicao_arp (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references logs_manutencao(id) on delete cascade,
  item_arp integer,
  qtd numeric,
  criado_em timestamptz not null default now()
);

-- 8) Índices — um por tabela nova, cada um pela consulta que o app
-- faz (mesmo idioma do item 7 da migração 42): `carregarItensOS()`,
-- `carregarComentarios()` e a leitura da composição da ata sempre
-- filtram por `os_id`, nunca fazem `select *` sem `where` como
-- `loadLogsFromSupabase()` faz em `logs_manutencao` — as três tabelas
-- novas crescem com o número de OS, não ficam pequenas para sempre.
-- `os_comentarios` ganha `criado_em` composto ao índice porque a
-- trilha é sempre lida em ORDEM cronológica, nunca por `os_id` sozinho.
create index if not exists os_itens_os_id_idx on os_itens (os_id);
create index if not exists os_comentarios_os_id_criado_em_idx on os_comentarios (os_id, criado_em);
create index if not exists os_composicao_arp_os_id_idx on os_composicao_arp (os_id);

-- 9) RLS nas três tabelas novas, espelhando a policy de
-- `logs_manutencao` (migração 04: leitura em `public`, escrita em
-- `authenticated`) — o padrão da plataforma é leitura aberta e
-- escrita autenticada, e fechar a leitura quebraria o cargo Livre
-- (acesso de observador sem senha). `create policy` não aceita `if
-- not exists`: cada policy leva um `drop policy if exists` na frente,
-- dentro do mesmo `do $$` em loop que a migração 04 já usa — o que
-- torna este bloco idempotente (uma segunda execução não erra em
-- "policy already exists").
do $$ declare t text; begin
  foreach t in array array['os_itens', 'os_comentarios', 'os_composicao_arp']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', 'r_sel_'||t, t);
    execute format('create policy %I on %I for select using (true)', 'r_sel_'||t, t);
    execute format('drop policy if exists %I on %I', 'r_ins_'||t, t);
    execute format('create policy %I on %I for insert to authenticated with check (true)', 'r_ins_'||t, t);
    execute format('drop policy if exists %I on %I', 'r_upd_'||t, t);
    execute format('create policy %I on %I for update to authenticated using (true)', 'r_upd_'||t, t);
    execute format('drop policy if exists %I on %I', 'r_del_'||t, t);
    execute format('create policy %I on %I for delete to authenticated using (true)', 'r_del_'||t, t);
  end loop;
end $$;

-- 10) Comentários — o que `logs_manutencao` virou (D-cf8-03: a tabela
-- NÃO é renomeada), o que cada dormente virou (D-cf8-16, uma a uma), e
-- o que cada coluna/tabela nova guarda.
comment on table logs_manutencao is
  'Tronco único de OS do módulo, para os três tipos de executor (tipo_executor: interna | externa | '
  'contrato). Migração 43 unificou aqui o que antes vivia espalhado entre esta tabela (fluxo próprio, '
  'migração 40) e os_contratacao + suas quatro filhas (fluxo de contrato) — a tabela não foi renomeada '
  'de propósito (D-cf8-03): renomear custaria migração, milhares de referências e todos os gates, para '
  'ganhar só estética.';
comment on table os_contratacao is
  'DORMENTE desde a migração 43 (D-cf8-02) — nunca dropada, o projeto arquiva. O ciclo de contratação '
  'passou a viver em logs_manutencao com tipo_executor=''contrato''. Campos equivalentes: numero, '
  'empresa, fiscal, nf, data_nf, certificador, data_certificacao, solicitante, ne, data_fiscalizacao, '
  'parecer_fiscal.';
comment on table os_orcamento_itens is
  'DORMENTE desde a migração 43 (D-cf8-16) — absorvida por os_itens, que serve os três tipos de '
  'executor (D-cf8-14: tabela nova, não generalização, porque esta FK aponta para os_contratacao(id) '
  'e o projeto não derruba FK).';
comment on table os_execucao is
  'DORMENTE desde a migração 43 (D-cf8-16) — absorvida pela evidência que já existia em '
  'logs_manutencao (fotos + as oito medições, migrações 04/40/41) mais um comentário de origem=usuario '
  'em os_comentarios.';
comment on table os_composicao is
  'DORMENTE desde a migração 43 (D-cf8-16) — absorvida por os_composicao_arp, mesmo tipo item_arp '
  '(integer), sem FK, pelo mesmo motivo (D-cf8-17).';
comment on table os_eventos is
  'DORMENTE desde a migração 43 (D-cf8-16) — absorvida por os_comentarios com origem=''sistema'', na '
  'MESMA linha do tempo do comentário do usuário (D-cf8-15) em vez de uma tabela de auditoria separada.';

comment on column logs_manutencao.tipo_executor is
  'Lista fechada interna | externa | contrato (D-cf8-01/04/09) — nunca dois tipos na mesma OS. Default '
  '''interna'', o padrão do banco antes desta migração.';
comment on column logs_manutencao.executor_setor is 'OS interna: setor responsável pela execução (D-cf8-07, texto livre).';
comment on column logs_manutencao.executor_pessoas is 'OS interna: pessoa(s) que executam (D-cf8-07, texto livre).';
comment on column logs_manutencao.executor_org is 'OS externa: organização executora — outra OM, órgão (D-cf8-07, texto livre).';
comment on column logs_manutencao.numero is 'Só em tipo_executor=''contrato'' (D-cf8-23): ''OSC NNN/ano'', único quando não nulo (índice parcial).';
comment on column logs_manutencao.empresa is 'OS de contrato: nome da empresa contratada.';
comment on column logs_manutencao.empresa_cnpj is 'OS de contrato: CNPJ da empresa contratada.';
comment on column logs_manutencao.instrumento is
  'OS de contrato: licitacao | dispensa | adesao_arp | contrato (Lei 14.133/2021) — nulo fora de contrato.';
comment on column logs_manutencao.processo is 'OS de contrato: número do processo administrativo.';
comment on column logs_manutencao.solicitante is 'OS de contrato: quem solicitou o serviço.';
comment on column logs_manutencao.ne is 'OS de contrato: nota de empenho.';
comment on column logs_manutencao.nf is 'OS de contrato: número da nota fiscal, gravado na certificação.';
comment on column logs_manutencao.data_nf is 'OS de contrato: data da nota fiscal.';
comment on column logs_manutencao.certificador is 'OS de contrato: quem certificou o encerramento.';
comment on column logs_manutencao.data_certificacao is 'OS de contrato: data da certificação.';
comment on column logs_manutencao.fiscal is 'OS de contrato: fiscal do contrato.';
comment on column logs_manutencao.data_fiscalizacao is 'OS de contrato: data da fiscalização.';
comment on column logs_manutencao.parecer_fiscal is 'OS de contrato: parecer do fiscal, na aprovação ou na devolução.';

comment on table os_itens is
  'Itens de serviço e material de TODA OS (D-cf8-05) — tipo SERVICO/MATERIAL (maiúsculas, convenção da '
  'refrigeração), total gerado (quantidade × valor_unitario). Substitui os_orcamento_itens (D-cf8-14).';
comment on table os_comentarios is
  'Registro datado e assinado que se ACUMULA (D-cf8-08) — origem usuario (caixa de texto) ou sistema '
  '(trilha de auditoria, D-cf8-15), na MESMA linha do tempo. Substitui os_eventos e parte de os_execucao '
  '(D-cf8-16).';
comment on table os_composicao_arp is
  'Composição de pagamento por item da ARP — só em OS de contrato (D-cf8-06, art. 86 da Lei '
  '14.133/2021). item_arp é integer, sem FK (D-cf8-17). Substitui os_composicao (D-cf8-16).';

-- 11) Bloco de conferência pós-aplicação (rodar depois, no SQL editor):
--
-- select column_name from information_schema.columns
--   where table_name = 'logs_manutencao' and column_name in (
--     'tipo_executor','executor_setor','executor_pessoas','executor_org',
--     'numero','empresa','empresa_cnpj','instrumento','processo','solicitante',
--     'ne','nf','data_nf','certificador','data_certificacao','fiscal',
--     'data_fiscalizacao','parecer_fiscal');
-- -- esperado: 18 linhas
--
-- select is_nullable, column_default from information_schema.columns
--   where table_name = 'logs_manutencao' and column_name = 'tipo_executor';
-- -- esperado: NO, 'interna'::text — prova que a FORMA foi garantida, não só a existência
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'logs_manutencao'::regclass
--   and conname in ('logs_manutencao_tipo_executor_chk','logs_manutencao_instrumento_chk',
--     'logs_manutencao_numero_chk','logs_manutencao_status_check');
-- -- esperado: 4 linhas, as quatro travas descritas acima (status com os 13 literais)
--
-- select table_name from information_schema.tables
--   where table_name in ('os_itens','os_comentarios','os_composicao_arp');
-- -- esperado: 3 linhas
--
-- select tablename, policyname from pg_policies
--   where tablename in ('os_itens','os_comentarios','os_composicao_arp')
--   order by tablename, policyname;
-- -- esperado: 12 linhas (4 policies × 3 tabelas)
--
-- select count(*) from logs_manutencao where tipo_executor <> 'interna';
-- -- esperado: 0 no dia da aplicação (tabela vazia hoje)
-- ══════════════════════════════════════════════════════════════════
