-- ═══════════════════════════════════════════════════════════════════
-- 38 — Máquinas: contratação de empresa (serviço externo)
--
-- Migração ADITIVA. Nenhuma tabela existente é alterada, nenhuma linha é
-- apagada. Rodar inteira no SQL Editor do Supabase.
--
-- Por que tabela nova e não `os_contratacao`: aquela tabela é do módulo
-- Refrigeração, que está CONGELADO por decisão do usuário (D-04). Ela
-- referencia `equipamentos(id)` e os itens da ARP 04/2024 de refrigeração;
-- alargá-la para aceitar máquina e área exigiria mexer no módulo congelado
-- e tornaria opcional o vínculo que hoje é obrigatório lá. O ciclo de
-- estados é o mesmo — é o processo de contratação pública, não uma
-- invenção de cada módulo —, e é isso que se reaproveita: o FLUXO
-- (shared/fluxo.js), não a tabela.
--
-- Vocabulário em minúsculas, como o resto das tabelas `maq_`
-- (`maq_os.status`, migrações 01 e 31). Refrigeração usa MAIÚSCULAS; é a
-- convenção daquele módulo, não deste.
--
-- O objeto da contratação é uma MÁQUINA ou uma ÁREA, nunca as duas: o
-- `check` abaixo trava isso. Contratar o reparo de um trator e contratar o
-- corte de uma mata são a mesma peça de processo com objeto diferente —
-- duas colunas alternativas, não acumulativas. Ambas nulas é permitido: há
-- contratação de serviço que não se prende a um item do cadastro.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists maq_contratacoes (
  id uuid primary key default gen_random_uuid(),
  numero text unique,
  ativo_id integer references maq_ativos(id),
  area_id uuid references maq_areas(id),
  objeto text not null,
  solicitante text,
  empresa text,
  cnpj text,
  fiscal text,
  status text not null default 'solicitada',
  ne text,                                   -- nota de empenho
  valor_estimado numeric(12,2),
  valor_contratado numeric(12,2),
  data_solicitacao date not null default current_date,
  data_aprovacao date,
  data_execucao date,
  data_certificacao date,
  obs text,
  ativo boolean not null default true,        -- o projeto arquiva, não apaga
  criado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'maq_contratacoes_status_chk') then
    alter table maq_contratacoes add constraint maq_contratacoes_status_chk
      check (status in ('solicitada','orcamento','aprovada','em_execucao','executada','fiscalizada','encerrada','cancelada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_contratacoes_objeto_chk') then
    alter table maq_contratacoes add constraint maq_contratacoes_objeto_chk
      check (num_nonnulls(ativo_id, area_id) <= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_contratacoes_objeto_texto_chk') then
    alter table maq_contratacoes add constraint maq_contratacoes_objeto_texto_chk
      check (length(btrim(objeto)) > 0);
  end if;
end $$;

-- Itens do orçamento. `total` é coluna GERADA: o produto nunca é gravado
-- pela tela, então não existe linha em que total divirja de
-- quantidade × valor_unitario. Mesmo desenho de os_orcamento_itens
-- (migração 04) — aqui sem vínculo com `arp_itens`, que é da ARP de
-- refrigeração.
create table if not exists maq_contratacao_itens (
  id uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references maq_contratacoes(id) on delete cascade,
  descricao text not null,
  unidade text,
  quantidade numeric(12,3) not null default 1 check (quantidade > 0),
  valor_unitario numeric(12,2) not null default 0 check (valor_unitario >= 0),
  total numeric(14,2) generated always as (quantidade * coalesce(valor_unitario, 0)) stored,
  criado_em timestamptz not null default now()
);

-- Trilha de estados: quem mudou o quê e quando. Sem ela, "aprovada em
-- 12/08" é uma data solta sem autor, e a contratação pública precisa
-- responder quem aprovou.
create table if not exists maq_contratacao_eventos (
  id uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references maq_contratacoes(id) on delete cascade,
  de text,
  para text not null,
  quem text,
  nota text,
  criado_em timestamptz not null default now()
);

create index if not exists maq_contratacoes_status_idx on maq_contratacoes(status) where ativo;
create index if not exists maq_contratacoes_ativo_idx on maq_contratacoes(ativo_id);
create index if not exists maq_contratacoes_area_idx on maq_contratacoes(area_id);
create index if not exists maq_contratacao_itens_ct_idx on maq_contratacao_itens(contratacao_id);
create index if not exists maq_contratacao_eventos_ct_idx on maq_contratacao_eventos(contratacao_id, criado_em desc);

-- RLS: leitura para quem está autenticado, escrita para admin e gestor —
-- contratar empresa é ato de gestão, não de oficina. Mesma forma das
-- policies de maq_areas (migração 12), inclusive a consulta a `usuarios`.
alter table maq_contratacoes enable row level security;
alter table maq_contratacao_itens enable row level security;
alter table maq_contratacao_eventos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='maq_contratacoes_read') then
    create policy maq_contratacoes_read on maq_contratacoes for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='maq_contratacoes_write') then
    create policy maq_contratacoes_write on maq_contratacoes for all to authenticated
      using (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor')))
      with check (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor')));
  end if;
  if not exists (select 1 from pg_policies where policyname='maq_contratacao_itens_read') then
    create policy maq_contratacao_itens_read on maq_contratacao_itens for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='maq_contratacao_itens_write') then
    create policy maq_contratacao_itens_write on maq_contratacao_itens for all to authenticated
      using (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor')))
      with check (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor')));
  end if;
  if not exists (select 1 from pg_policies where policyname='maq_contratacao_eventos_read') then
    create policy maq_contratacao_eventos_read on maq_contratacao_eventos for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='maq_contratacao_eventos_write') then
    create policy maq_contratacao_eventos_write on maq_contratacao_eventos for all to authenticated
      using (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor')))
      with check (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor')));
  end if;
end $$;

comment on table maq_contratacoes is
  'Contratação de empresa para serviço em máquina ou área (Máquinas). Ciclo espelha o de os_contratacao (Refrigeração), com vocabulário em minúsculas como o resto das tabelas maq_.';
