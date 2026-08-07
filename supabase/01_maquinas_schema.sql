-- ═══════════════════════════════════════════════════════════
-- PMOC Máquinas — schema completo
-- Projeto Supabase sugerido: pmoc  (mesmo nome do repo/Vercel)
-- ═══════════════════════════════════════════════════════════

create table if not exists maq_ativos (
  id serial primary key,
  codigo text unique, tipo_modelo text, nome text not null, categoria text not null,
  fabricante text, modelo text, patrimonio text, ano integer,
  cor text, emoji text,
  uso_atual numeric not null default 0,
  unidade_uso text not null default 'h' check (unidade_uso in ('h','km','ciclos')),
  status text not null default 'operante' check (status in ('operante','inoperante','manutencao','baixado')),
  local text, obs text,
  valor_aquisicao numeric, data_aquisicao date, vida_util_h numeric, valor_residual numeric,
  ativo boolean not null default true, criado_em timestamptz default now()
);

create table if not exists maq_planos (
  id serial primary key,
  tipo_modelo text, aplica_a text not null default 'TODOS',
  nome text not null, intervalo numeric not null,
  unidade text not null default 'h' check (unidade in ('h','km','ciclos','dias')),
  descricao text, norma_ref text, ordem integer default 0,
  ativo boolean not null default true
);

create table if not exists maq_materiais (
  id serial primary key,
  codigo text unique, nome text not null, categoria text,
  tipo text not null default 'consumivel' check (tipo in ('consumivel','peca','ferramenta')),
  unidade text not null default 'un', preco numeric,
  estoque_atual numeric not null default 0, estoque_minimo numeric not null default 0, obs text
);

create table if not exists maq_plano_materiais (
  id serial primary key,
  plano_id integer references maq_planos(id) on delete cascade,
  material_id integer references maq_materiais(id) on delete cascade,
  quantidade numeric not null default 1,
  unique (plano_id, material_id)
);

create table if not exists maq_uso_registros (
  id uuid primary key default gen_random_uuid(),
  ativo_id integer references maq_ativos(id) on delete cascade,
  delta numeric not null, uso_total numeric not null,
  data date default current_date, area_trabalhada numeric,
  operador text, obs text, registrado_em timestamptz default now()
);

create table if not exists maq_os (
  id uuid primary key default gen_random_uuid(),
  ativo_id integer references maq_ativos(id),
  plano_id integer references maq_planos(id),
  tipo text not null default 'preventiva' check (tipo in ('preventiva','corretiva','preditiva','uso')),
  status text not null default 'pendente' check (status in ('pendente','em_andamento','concluida','cancelada')),
  descricao text, uso_na_os numeric, tecnico text,
  custo_pecas numeric default 0, custo_mo numeric default 0, horas_servico numeric,
  data_abertura date default current_date, data_conclusao date,
  obs text, criado_em timestamptz default now()
);

create table if not exists maq_estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  material_id integer references maq_materiais(id),
  os_id uuid references maq_os(id),
  tipo text not null check (tipo in ('entrada','saida')),
  quantidade numeric not null, motivo text, registrado_em timestamptz default now()
);

create table if not exists maq_abastecimentos (
  id uuid primary key default gen_random_uuid(),
  ativo_id integer references maq_ativos(id) on delete cascade,
  data date not null default current_date,
  litros numeric not null, preco_litro numeric,
  custo_total numeric generated always as (litros * coalesce(preco_litro,0)) stored,
  horimetro numeric, operador text,
  combustivel text default 'gasolina' check (combustivel in ('gasolina','diesel','mistura_2t','etanol')),
  obs text, registrado_em timestamptz default now()
);

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  nome text not null, funcao text, posto_graduacao text, crea_cft text,
  role text not null default 'tecnico'
    check (role in ('admin','gestor','tecnico','observador','empresa','executor','fiscal')),
  ativo boolean default true, created_at timestamptz default now()
);

-- ── RLS ──
do $$ declare t text; begin
  foreach t in array array['maq_ativos','maq_planos','maq_materiais','maq_plano_materiais',
                           'maq_uso_registros','maq_os','maq_estoque_movimentos','maq_abastecimentos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (true)', 'sel_'||t, t);
    execute format('create policy %I on %I for insert to authenticated with check (true)', 'ins_'||t, t);
    execute format('create policy %I on %I for update to authenticated using (true)', 'upd_'||t, t);
    execute format('create policy %I on %I for delete to authenticated using (true)', 'del_'||t, t);
  end loop;
  alter table usuarios enable row level security;
  create policy sel_usuarios on usuarios for select to authenticated using (true);
end $$;

-- ── trigger: perfil automático no signup ──
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (auth_id, nome, role)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    case when (select count(*) from public.usuarios)=0 then 'admin' else 'tecnico' end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure handle_new_user();
