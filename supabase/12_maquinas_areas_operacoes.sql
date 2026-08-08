-- 12 — Áreas e operações de serviço do PMOC Máquinas
-- Migração aditiva, sem dados demonstrativos. Rodar no SQL Editor do Supabase.

create table if not exists maq_areas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nome text not null,
  tipo text not null default 'corte'
    check (tipo in ('corte','poda','limpeza','mista','outro')),
  area_m2 numeric check (area_m2 is null or area_m2 >= 0),
  periodicidade_dias integer check (periodicidade_dias is null or periodicidade_dias > 0),
  localizacao text,
  obs text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists maq_operacoes (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references maq_areas(id),
  ativo_id integer not null references maq_ativos(id),
  tipo_servico text not null default 'corte'
    check (tipo_servico in ('corte','poda','limpeza','transporte','outro')),
  status text not null default 'programada'
    check (status in ('programada','em_execucao','concluida','cancelada')),
  data_programada date not null default current_date,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  horas_utilizadas numeric check (horas_utilizadas is null or horas_utilizadas > 0),
  area_executada_m2 numeric check (area_executada_m2 is null or area_executada_m2 >= 0),
  combustivel_utilizado numeric check (combustivel_utilizado is null or combustivel_utilizado >= 0),
  operador text,
  obs text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_maq_operacoes_data on maq_operacoes(data_programada);
create index if not exists idx_maq_operacoes_status on maq_operacoes(status);
create index if not exists idx_maq_operacoes_ativo on maq_operacoes(ativo_id);
create index if not exists idx_maq_operacoes_area on maq_operacoes(area_id);

alter table maq_areas enable row level security;
alter table maq_operacoes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maq_areas' and policyname='maq_areas_select') then
    create policy maq_areas_select on maq_areas for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maq_areas' and policyname='maq_areas_insert') then
    create policy maq_areas_insert on maq_areas for insert to authenticated with check (
      exists (select 1 from usuarios where auth_id=auth.uid() and ativo=true and role in ('admin','gestor'))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maq_areas' and policyname='maq_areas_update') then
    create policy maq_areas_update on maq_areas for update to authenticated using (
      exists (select 1 from usuarios where auth_id=auth.uid() and ativo=true and role in ('admin','gestor'))
    ) with check (
      exists (select 1 from usuarios where auth_id=auth.uid() and ativo=true and role in ('admin','gestor'))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maq_operacoes' and policyname='maq_operacoes_select') then
    create policy maq_operacoes_select on maq_operacoes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maq_operacoes' and policyname='maq_operacoes_insert') then
    create policy maq_operacoes_insert on maq_operacoes for insert to authenticated with check (
      exists (select 1 from usuarios where auth_id=auth.uid() and ativo=true and role in ('admin','gestor','tecnico','executor'))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='maq_operacoes' and policyname='maq_operacoes_update') then
    create policy maq_operacoes_update on maq_operacoes for update to authenticated using (
      exists (select 1 from usuarios where auth_id=auth.uid() and ativo=true and role in ('admin','gestor','tecnico','executor'))
    ) with check (
      exists (select 1 from usuarios where auth_id=auth.uid() and ativo=true and role in ('admin','gestor','tecnico','executor'))
    );
  end if;
end $$;

create or replace function concluir_maq_operacao(
  p_operacao_id uuid,
  p_horas_utilizadas numeric,
  p_area_executada_m2 numeric default null,
  p_combustivel_utilizado numeric default null,
  p_observacoes text default null
)
returns maq_operacoes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_operacao maq_operacoes;
  v_ativo maq_ativos;
  v_novo_uso numeric;
begin
  if p_horas_utilizadas is null or p_horas_utilizadas <= 0 then
    raise exception 'As horas utilizadas devem ser maiores que zero.';
  end if;
  if p_area_executada_m2 is not null and p_area_executada_m2 < 0 then
    raise exception 'A área executada não pode ser negativa.';
  end if;
  if p_combustivel_utilizado is not null and p_combustivel_utilizado < 0 then
    raise exception 'O combustível utilizado não pode ser negativo.';
  end if;

  select * into v_operacao from maq_operacoes where id=p_operacao_id for update;
  if not found then raise exception 'Operação não encontrada.'; end if;
  if v_operacao.status in ('concluida','cancelada') then
    raise exception 'A operação já está encerrada.';
  end if;

  select * into v_ativo from maq_ativos where id=v_operacao.ativo_id for update;
  if not found then raise exception 'Máquina não encontrada.'; end if;

  v_novo_uso := round((coalesce(v_ativo.uso_atual,0) + p_horas_utilizadas)::numeric, 2);
  update maq_ativos set uso_atual=v_novo_uso where id=v_ativo.id;

  insert into maq_uso_registros (ativo_id,delta,uso_total,data,area_trabalhada,operador,obs)
  values (
    v_operacao.ativo_id,
    p_horas_utilizadas,
    v_novo_uso,
    current_date,
    p_area_executada_m2,
    v_operacao.operador,
    coalesce(p_observacoes,v_operacao.obs)
  );

  update maq_operacoes set
    status='concluida',
    concluido_em=now(),
    horas_utilizadas=p_horas_utilizadas,
    area_executada_m2=p_area_executada_m2,
    combustivel_utilizado=p_combustivel_utilizado,
    obs=coalesce(p_observacoes,obs)
  where id=p_operacao_id
  returning * into v_operacao;

  return v_operacao;
end $$;

revoke all on function concluir_maq_operacao(uuid,numeric,numeric,numeric,text) from public;
revoke execute on function concluir_maq_operacao(uuid,numeric,numeric,numeric,text) from anon;
grant execute on function concluir_maq_operacao(uuid,numeric,numeric,numeric,text) to authenticated;