-- ══════════════════════════════════════════════════════════════════
-- 63 — Listão de materiais, kits e listas de material (/refrigeracao)
--
-- A migração 44 criou o catálogo (materiais) e o histórico de estoque,
-- mas o catálogo nasceu vazio e o técnico continua sem um jeito de montar
-- "o que eu preciso levar / comprar para este serviço". Máquinas resolveu
-- isso na 34 (maq_compras_listas/itens). Aqui vem o mesmo desenho, com
-- duas diferenças do domínio de refrigeração:
--
-- · materiais.grupo / classe / embalagem / unidade_compra — o técnico usa
--   metro e kg, o almoxarifado compra rolo de 15 m e cilindro de 11,34 kg.
--   A lista mostra as duas coisas (3 m de tubo → 1 rolo 15 m).
--   classe é o tipo "de verdade" (consumivel/peca/ferramenta/aparelho);
--   tipo (check da 44) fica consumivel|peca para não mexer na baixa de
--   estoque que a 44 já faz — ferramenta e aparelho entram como 'peca'.
-- · kits + kit_itens — composições prontas (instalação split 24k,
--   limpeza química, troca de compressor…). Somar um kit na lista só
--   multiplica e soma quantidades; o kit não vira item de estoque.
-- · listas_material + listas_material_itens — a lista montada pelo
--   técnico, com preço congelado na linha e quantidade atendida por item
--   (atendimento parcial, igual à 34).
--
-- ADITIVA, SEM DROP. Mesma RLS da 44: leitura aberta (modo observador),
-- escrita autenticada.
--
-- ORDEM: aplicar 63, depois 64 (seed). A página /refrigeracao/listas sonda
-- a tabela kits: sem a 63 ela abre só com o catálogo e avisa que falta a
-- migração; sem a 64 o catálogo aparece vazio.
--
-- TESTADA em Postgres 16 descartável (stub de auth/equipamentos/logs):
-- 44 → 63 → 63 → 64 → 64 roda sem erro; contagens 318 / 14 / 141 e 16
-- policies. Ainda NÃO aplicada em produção.
-- ══════════════════════════════════════════════════════════════════

-- 1) materiais — colunas novas
alter table materiais add column if not exists grupo text;
alter table materiais add column if not exists classe text;
alter table materiais add column if not exists embalagem numeric;
alter table materiais add column if not exists unidade_compra text;
alter table materiais add column if not exists preco_data date;
alter table materiais add column if not exists catmat text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'materiais_classe_check') then
    alter table materiais add constraint materiais_classe_check
      check (classe is null or classe in ('consumivel','peca','ferramenta','aparelho'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'materiais_embalagem_check') then
    alter table materiais add constraint materiais_embalagem_check
      check (embalagem is null or embalagem > 0);
  end if;
end $$;

-- 2) kits
create table if not exists kits (
  id text primary key,
  nome text not null,
  descricao text,
  ordem integer default 0,
  ativo boolean not null default true
);

create table if not exists kit_itens (
  id bigint generated always as identity primary key,
  kit_id text not null references kits(id) on delete cascade,
  material_id bigint not null references materiais(id),
  quantidade numeric not null check (quantidade > 0),
  unique (kit_id, material_id)
);

-- 3) listas de material
create table if not exists listas_material (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  os_id uuid references logs_manutencao(id) on delete set null,
  equip_id integer references equipamentos(id) on delete set null,
  referencia text,
  local text,
  tecnico text,
  data date default current_date,
  status text not null default 'aberta' check (status in ('aberta','enviada','atendida','cancelada')),
  obs text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz default now(),
  ativo boolean not null default true
);

create table if not exists listas_material_itens (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references listas_material(id) on delete cascade,
  material_id bigint references materiais(id),
  descricao_livre text,
  quantidade numeric not null check (quantidade > 0),
  unidade text,
  preco_unit numeric check (preco_unit is null or preco_unit >= 0),
  atendido numeric not null default 0 check (atendido >= 0),
  check (material_id is not null or descricao_livre is not null),
  unique (lista_id, material_id)
);

create index if not exists kit_itens_kit_id_idx on kit_itens (kit_id);
create index if not exists kit_itens_material_id_idx on kit_itens (material_id);
create index if not exists listas_material_os_id_idx on listas_material (os_id);
create index if not exists listas_material_equip_id_idx on listas_material (equip_id);
create index if not exists listas_material_itens_lista_id_idx on listas_material_itens (lista_id);
create index if not exists listas_material_itens_material_id_idx on listas_material_itens (material_id);

-- 4) grants
grant select on kits, kit_itens, listas_material, listas_material_itens to anon, authenticated;
grant insert, update, delete on kits, kit_itens, listas_material, listas_material_itens to authenticated;
grant usage, select on sequence kit_itens_id_seq to anon, authenticated;

-- 5) RLS — mesmo bloco reexecutável da 44
do $$ declare t text; begin
  foreach t in array array['kits', 'kit_itens', 'listas_material', 'listas_material_itens']
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

comment on column materiais.embalagem is
  'Quantas unidades de uso vêm numa embalagem de compra (15 para panqueca em metro/rolo 15 m, 11.34 para R-410A em kg/cilindro). A lista converte a quantidade de uso em quantidade de compra com ceil(qtd/embalagem).';
comment on column materiais.classe is
  'consumivel | peca | ferramenta | aparelho. tipo (migração 44) continua consumivel|peca para a baixa de estoque; classe é a classificação exibida.';
comment on table listas_material is
  'Lista de material montada pelo técnico no /refrigeracao/listas (catálogo + kits). Preço congelado por linha em listas_material_itens.';

-- Conferência pós-aplicação:
-- select count(*) from information_schema.columns where table_name='materiais' and column_name in ('grupo','classe','embalagem','unidade_compra','preco_data','catmat'); -- 6
-- select count(*) from pg_policies where tablename in ('kits','kit_itens','listas_material','listas_material_itens'); -- 16
