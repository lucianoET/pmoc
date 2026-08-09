-- ═══════════════════════════════════════════════════════════════════
-- 14 — PMOC Elétrica e Fonoclama — schema inicial
-- Migração ADITIVA: só cria tabelas novas com prefixo `elet_` e `fono_`.
-- Nenhuma tabela existente é alterada. Nada de DROP.
--
-- Os dois módulos têm o mesmo modelo de manutenção (ativo com horímetro +
-- plano por tipo de ativo + estoque de peças + OS com baixa automática),
-- então o schema é gerado em laço sobre os prefixos.
-- Executar no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  prefixo text;
  tabela text;
  tabelas text[];
begin
foreach prefixo in array array['elet', 'fono'] loop

  -- ── ativos ──
  execute format($f$
    create table if not exists %1$I (
      id integer generated always as identity primary key,
      codigo text not null unique,
      nome text not null,
      tipo text not null,
      patrimonio text,
      local text,
      uso_atual numeric(12,1) not null default 0 check (uso_atual >= 0),
      unidade_uso text not null default 'h' check (unidade_uso in ('h', 'dias', 'ciclos')),
      status text not null default 'operante'
        check (status in ('operante', 'inoperante', 'manutencao', 'baixado')),
      obs text,
      ativo boolean not null default true,
      criado_em timestamptz not null default now()
    )
  $f$, prefixo || '_ativos');

  -- ── planos de manutenção por tipo de ativo ──
  execute format($f$
    create table if not exists %1$I (
      id integer generated always as identity primary key,
      codigo text not null unique,
      tipo text not null,
      nome text not null,
      intervalo numeric(10,1) not null check (intervalo > 0),
      unidade text not null default 'h' check (unidade in ('h', 'dias', 'ciclos')),
      descricao text,
      norma_ref text,
      ordem integer not null default 0,
      ativo boolean not null default true
    )
  $f$, prefixo || '_planos');

  -- ── materiais / peças ──
  execute format($f$
    create table if not exists %1$I (
      id integer generated always as identity primary key,
      codigo text not null unique,
      nome text not null,
      categoria text,
      unidade text not null default 'UN',
      preco numeric(12,2) check (preco is null or preco >= 0),
      estoque_atual numeric(12,2) not null default 0 check (estoque_atual >= 0),
      estoque_minimo numeric(12,2) not null default 0 check (estoque_minimo >= 0),
      obs text,
      ativo boolean not null default true
    )
  $f$, prefixo || '_materiais');

  -- ── peças previstas em cada plano ──
  execute format($f$
    create table if not exists %1$I (
      id integer generated always as identity primary key,
      plano_id integer not null references %2$I(id) on delete cascade,
      material_id integer not null references %3$I(id) on delete cascade,
      quantidade numeric(10,2) not null default 1 check (quantidade > 0),
      unique (plano_id, material_id)
    )
  $f$, prefixo || '_plano_materiais', prefixo || '_planos', prefixo || '_materiais');

  -- ── registros de uso (horímetro) ──
  execute format($f$
    create table if not exists %1$I (
      id uuid primary key default gen_random_uuid(),
      ativo_id integer not null references %2$I(id) on delete cascade,
      delta numeric(10,1) not null check (delta > 0),
      uso_total numeric(12,1) not null check (uso_total >= 0),
      data date not null default current_date,
      operador text,
      obs text,
      registrado_em timestamptz not null default now()
    )
  $f$, prefixo || '_uso_registros', prefixo || '_ativos');

  -- ── ordens de serviço ──
  execute format($f$
    create table if not exists %1$I (
      id uuid primary key default gen_random_uuid(),
      ativo_id integer not null references %2$I(id) on delete cascade,
      plano_id integer references %3$I(id) on delete set null,
      tipo text not null default 'preventiva'
        check (tipo in ('preventiva', 'corretiva', 'inspecao')),
      status text not null default 'pendente'
        check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
      descricao text not null,
      uso_na_os numeric(12,1) check (uso_na_os is null or uso_na_os >= 0),
      tecnico text,
      custo_pecas numeric(12,2) not null default 0 check (custo_pecas >= 0),
      conforme boolean,
      nao_conformidade text,
      acao_corretiva text,
      data_abertura date not null default current_date,
      data_conclusao date,
      obs text,
      criado_em timestamptz not null default now()
    )
  $f$, prefixo || '_os', prefixo || '_ativos', prefixo || '_planos');

  -- ── movimentos de estoque ──
  execute format($f$
    create table if not exists %1$I (
      id uuid primary key default gen_random_uuid(),
      material_id integer not null references %2$I(id) on delete cascade,
      os_id uuid references %3$I(id) on delete set null,
      tipo text not null check (tipo in ('entrada', 'saida')),
      quantidade numeric(12,2) not null check (quantidade > 0),
      motivo text,
      registrado_em timestamptz not null default now()
    )
  $f$, prefixo || '_estoque_movimentos', prefixo || '_materiais', prefixo || '_os');

  -- ── índices (toda FK indexada + filtros de tela) ──
  execute format('create index if not exists %I on %I (tipo)', prefixo || '_ativos_tipo_idx', prefixo || '_ativos');
  execute format('create index if not exists %I on %I (status)', prefixo || '_ativos_status_idx', prefixo || '_ativos');
  execute format('create index if not exists %I on %I (tipo)', prefixo || '_planos_tipo_idx', prefixo || '_planos');
  execute format('create index if not exists %I on %I (plano_id)', prefixo || '_pm_plano_idx', prefixo || '_plano_materiais');
  execute format('create index if not exists %I on %I (material_id)', prefixo || '_pm_material_idx', prefixo || '_plano_materiais');
  execute format('create index if not exists %I on %I (ativo_id, data desc)', prefixo || '_uso_ativo_idx', prefixo || '_uso_registros');
  execute format('create index if not exists %I on %I (ativo_id)', prefixo || '_os_ativo_idx', prefixo || '_os');
  execute format('create index if not exists %I on %I (plano_id)', prefixo || '_os_plano_idx', prefixo || '_os');
  execute format('create index if not exists %I on %I (status, data_abertura desc)', prefixo || '_os_status_idx', prefixo || '_os');
  execute format('create index if not exists %I on %I (material_id)', prefixo || '_mov_material_idx', prefixo || '_estoque_movimentos');
  execute format('create index if not exists %I on %I (os_id)', prefixo || '_mov_os_idx', prefixo || '_estoque_movimentos');

  -- ── grants + RLS ──
  -- Leitura liberada para anon (perfil "observador" entra sem senha).
  -- Escrita apenas para sessão autenticada (admin/gestor/tecnico logam por cargo).
  tabelas := array[
    prefixo || '_ativos', prefixo || '_planos', prefixo || '_materiais',
    prefixo || '_plano_materiais', prefixo || '_uso_registros',
    prefixo || '_os', prefixo || '_estoque_movimentos'
  ];

  foreach tabela in array tabelas loop
    execute format('grant select on %I to anon, authenticated', tabela);
    execute format('grant insert, update, delete on %I to authenticated', tabela);
    execute format('alter table %I enable row level security', tabela);

    execute format('drop policy if exists %I on %I', 'sel_anon_' || tabela, tabela);
    execute format('drop policy if exists %I on %I', 'sel_auth_' || tabela, tabela);
    execute format('drop policy if exists %I on %I', 'ins_' || tabela, tabela);
    execute format('drop policy if exists %I on %I', 'upd_' || tabela, tabela);
    execute format('drop policy if exists %I on %I', 'del_' || tabela, tabela);

    execute format('create policy %I on %I for select to anon using (true)', 'sel_anon_' || tabela, tabela);
    execute format('create policy %I on %I for select to authenticated using (true)', 'sel_auth_' || tabela, tabela);
    execute format('create policy %I on %I for insert to authenticated with check (true)', 'ins_' || tabela, tabela);
    execute format('create policy %I on %I for update to authenticated using (true) with check (true)', 'upd_' || tabela, tabela);
    execute format('create policy %I on %I for delete to authenticated using (true)', 'del_' || tabela, tabela);
  end loop;

end loop;
end $$;

grant usage on schema public to anon, authenticated;
