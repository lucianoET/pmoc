-- ══════════════════════════════════════════════════════════════════
-- 44 — Estoque de peças e materiais (/refrigeracao)
--
-- /refrigeracao é o único módulo da plataforma que faz manutenção sem
-- saber o que tem na prateleira. Máquinas tem maq_materiais + histórico
-- de movimentos + baixa na execução (migrações 29/30); Transportes tem a
-- mesma forma desde a migração 23. Aqui o item de OS é hoje TEXTO LIVRE
-- com valor digitado (os_itens, migração 43) — não há catálogo, não há
-- saldo, não há mínimo, e nenhuma peça consumida numa OS sai de lugar
-- nenhum.
--
-- Esta migração traz o MESMO DESENHO que os outros módulos já usam,
-- replicado aqui (o nome das tabelas de estoque dos outros módulos não é
-- reaproveitado — cada módulo tem o seu, mesma régua de D-06 de
-- Transportes): catálogo materiais, histórico estoque_movimentos, e
-- os_itens.material_id ligando o item lançado ao catálogo.
--
-- SEM PREFIXO de propósito: essa é a convenção deste módulo
-- (equipamentos, os_itens, logs_manutencao), ao contrário dos módulos
-- que usam prefixo (maq_, transp_).
--
-- ADITIVA, SEM DROP — o projeto arquiva, nunca apaga. Material fora de
-- uso vira ativo=false, nunca uma linha excluída.
--
-- ORDEM DE PUBLICAÇÃO (mesma regra de D-cf8-25/D-q57-06/D-uyz-24): o
-- frontend vai a produção ANTES deste SQL. EST_OK (sonda própria, uma
-- leitura só sobre materiais) mantém a tela publicada se comportando
-- byte a byte como hoje enquanto esta migração não roda — sem botão de
-- Estoque na navegação, sem catálogo no formulário de item, sem baixa,
-- sem alerta. Na ordem inversa a tela publicada continuaria sem saber
-- que o catálogo existe, sem erro nenhum que denunciasse.
--
-- ESCRITA, AINDA NÃO APLICADA — este arquivo só escreve o script, nunca
-- o executa. O usuário aplica depois do deploy do frontend.
-- ══════════════════════════════════════════════════════════════════

-- 1) materiais — o catálogo. tipo distingue peça (item que dura, tem
-- número de patrimônio implícito no cadastro) de consumível (some no
-- uso); aplicacao é TEXTO LIVRE de propósito — uma peça legítima pode
-- servir a um tipo de equipamento que ninguém cadastrou ainda, a mesma
-- régua que o campo equivalente de outros módulos já aplica.
create table if not exists materiais (
  id bigint generated always as identity primary key,
  codigo text unique,
  nome text not null,
  tipo text not null default 'consumivel' check (tipo in ('consumivel', 'peca')),
  unidade text not null default 'un',
  aplicacao text,
  preco numeric check (preco is null or preco >= 0),
  estoque_atual numeric not null default 0 check (estoque_atual >= 0),
  estoque_minimo numeric not null default 0 check (estoque_minimo >= 0),
  obs text,
  ativo boolean not null default true
);

-- 2) estoque_movimentos — o histórico. os_id é on delete set null
-- (D-6wy-15): o módulo apaga linha de OS (delLogEntryAsync), e o
-- movimento de estoque NÃO pode ir junto — a peça saiu de verdade da
-- prateleira, e o histórico do estoque tem de sobreviver à OS que a
-- consumiu.
create table if not exists estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  material_id bigint references materiais(id),
  os_id uuid references logs_manutencao(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade numeric not null check (quantidade > 0),
  motivo text,
  registrado_em timestamptz default now()
);

-- 3) os_itens.material_id — vínculo entre o item lançado na OS e o
-- catálogo. ANULÁVEL de propósito: texto livre continua valendo (item
-- não catalogado, e OS de contrato em que a empresa fornece o material).
alter table os_itens add column if not exists material_id bigint references materiais(id);

-- 4) Índices — um por FK nova. materiais não precisa de índice além da
-- unique de código (catálogo pequeno, sempre lido inteiro).
-- estoque_movimentos (os_id, tipo) é COMPOSTO (D-6wy-14): a sonda de
-- idempotência (estJaBaixadoDaOS) filtra pelos dois, e a coluna líder
-- (os_id) já serve de índice da chave estrangeira — não precisa de um
-- segundo índice só de os_id.
create index if not exists estoque_movimentos_material_id_idx on estoque_movimentos (material_id);
create index if not exists estoque_movimentos_os_id_tipo_idx on estoque_movimentos (os_id, tipo);
create index if not exists os_itens_material_id_idx on os_itens (material_id);

-- 5) Grants — leitura aberta, escrita autenticada, o padrão da
-- plataforma (o cargo Livre é observador sem senha, e fechar a leitura
-- quebraria o modo observador neste módulo também). Sequence de
-- identity precisa de grant próprio.
grant select on materiais, estoque_movimentos to anon, authenticated;
grant insert, update, delete on materiais, estoque_movimentos to authenticated;
grant usage, select on sequence materiais_id_seq to anon, authenticated;

-- 6) RLS — mesmo formato exato da seção 9 da migração 43: drop policy if
-- exists na frente de cada create policy (create policy não aceita "if
-- not exists"), o que torna o bloco reexecutável. Nenhuma policy chama
-- função de sessão, então não há o que embrulhar em subconsulta.
do $$ declare t text; begin
  foreach t in array array['materiais', 'estoque_movimentos']
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

-- 7) Comentários
comment on table materiais is
  'Catálogo de peças e materiais de /refrigeracao (D-6wy-01) — o mesmo desenho que os outros módulos '
  'da plataforma já usam (catálogo + histórico + baixa na execução), replicado aqui sem prefixo, a '
  'convenção deste módulo.';
comment on table estoque_movimentos is
  'Histórico de entrada/saída do estoque de /refrigeracao. A idempotência da baixa é conferida contra '
  'esta tabela (D-6wy-03), nunca contra uma bandeira paralela. os_id solta o vínculo (on delete set '
  'null) quando a OS é apagada — o movimento sobrevive, porque a peça saiu de verdade (D-6wy-15).';
comment on column os_itens.material_id is
  'Vínculo do item de OS com o catálogo de materiais (D-6wy-02) — anulável: texto livre continua '
  'valendo para item não catalogado ou material fornecido pela empresa numa OS de contrato.';
comment on column materiais.aplicacao is
  'Tipo de equipamento a que a peça serve (SPLIT, PISO-TETO, …) — texto livre, porque uma peça '
  'legítima pode servir a um tipo que ninguém cadastrou ainda.';

-- 8) Bloco de conferência pós-aplicação (rodar depois, no SQL editor):
--
-- select count(*) from information_schema.columns where table_name = 'materiais';
-- -- esperado: 11
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid in ('materiais'::regclass, 'estoque_movimentos'::regclass)
--   order by conrelid, conname;
-- -- esperado: as checks de tipo/estoque_atual/estoque_minimo/preco (materiais) e
-- -- tipo/quantidade (estoque_movimentos), mais as FKs
--
-- select column_name from information_schema.columns
--   where table_name = 'os_itens' and column_name = 'material_id';
-- -- esperado: 1 linha
--
-- select count(*) from pg_policies where tablename in ('materiais','estoque_movimentos');
-- -- esperado: 8 (4 policies × 2 tabelas)
--
-- select 'materiais' as tabela, count(*) from materiais
-- union all select 'estoque_movimentos', count(*) from estoque_movimentos;
-- -- esperado: 0 e 0 no dia da aplicação
-- ══════════════════════════════════════════════════════════════════
