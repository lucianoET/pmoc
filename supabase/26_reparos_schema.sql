-- ═══════════════════════════════════════════════════════════════════
-- 26 — PMOC Reparos — catálogo de sintomas, causas, serviços e peças
-- Migração aditiva. Executar no SQL Editor do Supabase.
--
-- Responde "que peças e serviços são necessários para este reparo",
-- que maq_planos (preventivo, disparado por uso) não responde e não deve
-- ser forçado a responder: reparo é disparado por sintoma e é ranqueado
-- por probabilidade, não determinístico por intervalo.
--
-- Cria rep_modelos, rep_servicos, rep_reparos, rep_reparo_servicos e
-- rep_reparo_materiais; acrescenta colunas a maq_ativos e maq_os via
-- ADD COLUMN IF NOT EXISTS (Pitfall 3 — reexecutável sem perder linhas).
-- Não remove nem altera nenhum objeto de Refrigeração, Máquinas ou Transportes.
-- ═══════════════════════════════════════════════════════════════════

-- ── Modelos: a chave que torna o conhecimento compartilhável entre oficinas ──
-- codigo carrega o tipo_modelo legado (FS220, TS114, ...) e serve de chave
-- natural para o backfill e para seeds idempotentes.
create table if not exists rep_modelos (
  id bigint generated always as identity primary key,
  codigo text unique,
  fabricante text not null,
  modelo text not null,
  categoria text,
  motor text,
  unidade_uso text not null default 'h' check (unidade_uso in ('h','km','ciclos')),
  ano_inicio integer check (ano_inicio is null or ano_inicio between 1950 and 2100),
  ano_fim integer check (ano_fim is null or ano_fim between 1950 and 2100),
  origem text not null default 'local' check (origem in ('local','catalogo')),
  obs text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (fabricante, modelo)
);

-- ── Serviços: mão de obra vira entidade catalogada ──
-- Hoje maq_os guarda custo_mo e horas_servico como números soltos, sem
-- catálogo por trás. tempo_padrao_h é estimativa; o real continua em
-- maq_os.horas_servico, permitindo comparar estimado × executado depois.
create table if not exists rep_servicos (
  id bigint generated always as identity primary key,
  codigo text unique,
  nome text not null,
  especialidade text check (especialidade is null or especialidade in
    ('mecanica','eletrica','solda','usinagem','pintura','hidraulica')),
  tempo_padrao_h numeric check (tempo_padrao_h is null or tempo_padrao_h > 0),
  valor_hora numeric check (valor_hora is null or valor_hora >= 0),
  descricao text,
  origem text not null default 'local' check (origem in ('local','catalogo')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ── Reparo: a unidade de conhecimento (sintoma → causa provável) ──
-- modelo_id null = vale para qualquer modelo.
-- sintoma e causa_provavel são texto livre por decisão: o vocabulário real
-- ainda não é conhecido. sistema é lista fechada porque esse já é.
-- frequencia é incrementada por rep_confirmar_reparo() quando o mecânico
-- confirma a causa na conclusão da OS — é o que faz o diagnóstico deixar de
-- ser ordem alfabética e virar ordem do que realmente acontece na oficina.
create table if not exists rep_reparos (
  id bigint generated always as identity primary key,
  codigo text unique,
  modelo_id bigint references rep_modelos(id),
  sistema text not null check (sistema in
    ('motor','combustivel','transmissao','corte','eletrico','hidraulico','estrutura')),
  sintoma text not null,
  causa_provavel text not null,
  gravidade text not null default 'media' check (gravidade in ('baixa','media','alta')),
  frequencia integer not null default 0 check (frequencia >= 0),
  procedimento text,
  origem text not null default 'local' check (origem in ('local','catalogo')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ── O que o reparo consome: serviços (mão de obra) ──
create table if not exists rep_reparo_servicos (
  id bigint generated always as identity primary key,
  reparo_id bigint not null references rep_reparos(id) on delete cascade,
  servico_id bigint not null references rep_servicos(id) on delete cascade,
  quantidade numeric not null default 1 check (quantidade > 0),
  unique (reparo_id, servico_id)
);

-- ── O que o reparo consome: peças ──
-- Aponta para maq_materiais em vez de duplicar o catálogo (caminho oposto ao
-- da decisão D-06 em transportes): duplicar quebraria a baixa automática de
-- estoque de maquinas/app.js, que é justamente o fluxo que já funciona.
-- essencial=false significa "verificar se precisa trocar", não obrigatória.
create table if not exists rep_reparo_materiais (
  id bigint generated always as identity primary key,
  reparo_id bigint not null references rep_reparos(id) on delete cascade,
  material_id integer not null references maq_materiais(id) on delete cascade,
  quantidade numeric not null default 1 check (quantidade > 0),
  essencial boolean not null default true,
  unique (reparo_id, material_id)
);

-- ── Ligação com o ativo e com a OS real (Pitfall 3) ──
-- tipo_modelo text PERMANECE em maq_ativos; modelo_id é nullable e coexiste.
-- Nenhum módulo em produção depende de modelo_id, então nada quebra.
alter table maq_ativos add column if not exists modelo_id bigint references rep_modelos(id);
alter table maq_os     add column if not exists reparo_id bigint references rep_reparos(id);
alter table maq_os     add column if not exists sintoma_relatado text;
alter table maq_os     add column if not exists reparo_confirmado boolean;

-- ── Índices de FK (skill supabase-postgres-best-practices) ──
create index if not exists rep_reparos_modelo_id_idx on rep_reparos (modelo_id);
create index if not exists rep_reparos_sistema_idx on rep_reparos (sistema);
create index if not exists rep_reparo_servicos_reparo_id_idx on rep_reparo_servicos (reparo_id);
create index if not exists rep_reparo_servicos_servico_id_idx on rep_reparo_servicos (servico_id);
create index if not exists rep_reparo_materiais_reparo_id_idx on rep_reparo_materiais (reparo_id);
create index if not exists rep_reparo_materiais_material_id_idx on rep_reparo_materiais (material_id);
create index if not exists maq_ativos_modelo_id_idx on maq_ativos (modelo_id);
create index if not exists maq_os_reparo_id_idx on maq_os (reparo_id);

-- ── Grants de tabela e de sequence (Pitfall 4 — identity gera sequence própria) ──
grant select on rep_modelos, rep_servicos, rep_reparos,
                rep_reparo_servicos, rep_reparo_materiais to anon, authenticated;
grant insert, update, delete on rep_modelos, rep_servicos, rep_reparos,
                rep_reparo_servicos, rep_reparo_materiais to authenticated;
grant usage, select on sequence rep_modelos_id_seq to anon, authenticated;
grant usage, select on sequence rep_servicos_id_seq to anon, authenticated;
grant usage, select on sequence rep_reparos_id_seq to anon, authenticated;
grant usage, select on sequence rep_reparo_servicos_id_seq to anon, authenticated;
grant usage, select on sequence rep_reparo_materiais_id_seq to anon, authenticated;

-- ── RBAC do módulo — função própria, não redefine transp_pode_escrever() (Pitfall 1/6) ──
create or replace function rep_pode_escrever(p_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from usuarios
     where auth_id = auth.uid() and ativo = true and role = any(p_roles)
  );
$$;

-- EXECUTE é concedido a PUBLIC por padrão em funções — revogar antes de conceder,
-- mesmo cuidado da migração 12 com concluir_maq_operacao().
revoke execute on function rep_pode_escrever(text[]) from public, anon;
grant execute on function rep_pode_escrever(text[]) to authenticated;

-- ── RLS ──
-- Leitura pública (using(true)) preserva o acesso do cargo observador, como
-- em maq_areas/transp_planos. Escrita separada em dois níveis, espelhando a
-- distinção da migração 12 entre maq_areas e maq_operacoes:
--   estrutura do catálogo (modelos, serviços) → admin, gestor
--   conhecimento operacional (reparos e vínculos) → admin, gestor, tecnico
-- O técnico precisa cadastrar o reparo que acabou de descobrir; se depender
-- do gestor, o conhecimento não é registrado e o catálogo não cresce.
alter table rep_modelos          enable row level security;
alter table rep_servicos         enable row level security;
alter table rep_reparos          enable row level security;
alter table rep_reparo_servicos  enable row level security;
alter table rep_reparo_materiais enable row level security;

do $$
declare
  t text;
  v_roles text;
begin
  foreach t in array array['rep_modelos','rep_servicos','rep_reparos',
                           'rep_reparo_servicos','rep_reparo_materiais']
  loop
    v_roles := case when t in ('rep_modelos','rep_servicos')
                    then $r$array['admin','gestor']$r$
                    else $r$array['admin','gestor','tecnico']$r$ end;

    execute format('drop policy if exists %I on %I', 'sel_'||t, t);
    execute format('drop policy if exists %I on %I', 'ins_'||t, t);
    execute format('drop policy if exists %I on %I', 'upd_'||t, t);
    execute format('drop policy if exists %I on %I', 'del_'||t, t);

    execute format('create policy %I on %I for select using (true)', 'sel_'||t, t);
    execute format('create policy %I on %I for insert to authenticated with check (rep_pode_escrever(%s))',
                   'ins_'||t, t, v_roles);
    execute format('create policy %I on %I for update to authenticated using (rep_pode_escrever(%s)) with check (rep_pode_escrever(%s))',
                   'upd_'||t, t, v_roles, v_roles);
    execute format('create policy %I on %I for delete to authenticated using (rep_pode_escrever(%s))',
                   'del_'||t, t, v_roles);
  end loop;
end $$;

-- ── RPC: confirmar (ou desmentir) a causa suspeitada ao concluir a OS ──
-- É esta função que faz o catálogo aprender. Chamar em concluirOS().
-- security invoker (mesmo padrão de concluir_maq_operacao): quem não passa
-- na RLS de rep_reparos não consegue incrementar a frequência.
-- Idempotência: a segunda chamada para a mesma OS falha, então uma retentativa
-- de rede não conta a mesma confirmação duas vezes (mesma preocupação que
-- guardou baixarPecasDoPlano() por manutencao_id na migração 23).
create or replace function rep_confirmar_reparo(
  p_os_id uuid,
  p_confirmado boolean
)
returns maq_os
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_os maq_os;
begin
  if p_confirmado is null then
    raise exception 'Informe se a causa suspeitada se confirmou.';
  end if;

  select * into v_os from maq_os where id = p_os_id for update;
  if not found then
    raise exception 'OS não encontrada.';
  end if;
  if v_os.reparo_id is null then
    raise exception 'A OS não está vinculada a um reparo do catálogo.';
  end if;
  if v_os.reparo_confirmado is not null then
    raise exception 'A confirmação desta OS já foi registrada.';
  end if;

  update maq_os set reparo_confirmado = p_confirmado
   where id = p_os_id
   returning * into v_os;

  if p_confirmado then
    update rep_reparos set frequencia = frequencia + 1 where id = v_os.reparo_id;
  end if;

  return v_os;
end $$;

revoke execute on function rep_confirmar_reparo(uuid,boolean) from public, anon;
grant execute on function rep_confirmar_reparo(uuid,boolean) to authenticated;
