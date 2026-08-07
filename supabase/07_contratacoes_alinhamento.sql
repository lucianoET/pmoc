-- 07 — Alinha o banco ao app Refrigeração v2.8 (fluxo de Contratações)
-- O app grava/lê colunas que o schema 04 não criou. Rodar no SQL Editor do Supabase.

-- os_contratacao: campos do fluxo SOLICITADA → APROVADA → EM_EXECUCAO → FISCALIZADA → ENCERRADA
alter table os_contratacao
  add column if not exists problema          text,
  add column if not exists data_solicitacao  date,
  add column if not exists aprovador         text,
  add column if not exists valor_orcado      numeric,
  add column if not exists parecer_aprovacao text,
  add column if not exists data_fiscalizacao date,
  add column if not exists parecer_fiscal    text,
  add column if not exists nf                text,
  add column if not exists data_nf           date,
  add column if not exists certificador      text;

-- os_orcamento_itens: app grava tipo/qtd/valor_unit/ordem
alter table os_orcamento_itens
  add column if not exists tipo       text,
  add column if not exists qtd        numeric,
  add column if not exists valor_unit numeric,
  add column if not exists ordem      integer default 0;

-- os_execucao: app grava medições (json) e lista de fotos
alter table os_execucao
  add column if not exists medicoes jsonb default '{}'::jsonb,
  add column if not exists fotos    jsonb default '[]'::jsonb;

-- os_composicao: app grava item_arp/qtd
alter table os_composicao
  add column if not exists item_arp integer,
  add column if not exists qtd      numeric;

-- arp_itens: app compara item como número e lê valor_unit/qtd_empenhada
alter table arp_itens alter column item type integer using nullif(item,'')::integer;
alter table arp_itens
  add column if not exists valor_unit    numeric generated always as (valor_unitario) stored,
  add column if not exists qtd_empenhada numeric generated always as (quantidade_registrada) stored;

-- OSs semeadas antes desta migração usavam "descricao"
update os_contratacao set problema = coalesce(problema, descricao);

-- bucket de fotos das OS (upload em ctAddExec)
insert into storage.buckets (id, name, public)
values ('os-fotos', 'os-fotos', true)
on conflict (id) do nothing;

create policy "os-fotos upload autenticado" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'os-fotos');
