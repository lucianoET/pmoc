-- ══════════════════════════════════════════════════════════════════
-- 32 — Ficha da máquina: comentários e instruções
--
-- A ficha da máquina deixou de ser um formulário de edição e virou tela
-- de consulta e ação: código, nome, categoria, fabricante, modelo e
-- patrimônio não mudam no dia a dia, e o uso atual é calculado dos
-- registros. O que a oficina faz todo dia — registrar uso, abrir OS,
-- anotar — passa a viver na ficha.
--
-- Este arquivo dá as duas colunas de dados que a ficha precisa:
-- · maq_ativo_comentarios — anotações datadas e assinadas por máquina
--   (o "diário de bordo" que hoje se perde em papel e conversa)
-- · maq_ativos.instrucoes — instruções de operação/manutenção da
--   máquina, parte do cadastro, exibidas na ficha
--
-- Migração aditiva, como todas menos a 31. Aplicada em produção em
-- 18/08/2026 — conferida contra o banco: 5 colunas, o check de texto não
-- vazio, a FK com cascade, o índice (ativo_id, criado_em desc), RLS ligado
-- com as duas políticas, e maq_ativos.instrucoes text no lugar.
-- ══════════════════════════════════════════════════════════════════

create table if not exists maq_ativo_comentarios (
  id uuid primary key default gen_random_uuid(),
  ativo_id integer not null references maq_ativos(id) on delete cascade,
  autor text,
  texto text not null check (nullif(btrim(texto), '') is not null),
  criado_em timestamptz not null default now()
);

-- a consulta natural é "os comentários desta máquina, do mais novo ao mais velho"
create index if not exists maq_ativo_comentarios_ativo_idx
  on maq_ativo_comentarios(ativo_id, criado_em desc);

alter table maq_ativo_comentarios enable row level security;

-- Mesma política das outras tabelas do módulo: leitura para todos (o acesso
-- Livre é observador anônimo) e escrita para sessão autenticada.
drop policy if exists "maq_ativo_comentarios_leitura" on maq_ativo_comentarios;
create policy "maq_ativo_comentarios_leitura" on maq_ativo_comentarios
  for select using (true);
drop policy if exists "maq_ativo_comentarios_escrita" on maq_ativo_comentarios;
create policy "maq_ativo_comentarios_escrita" on maq_ativo_comentarios
  for all to authenticated using (true) with check (true);

alter table maq_ativos add column if not exists instrucoes text;

comment on table maq_ativo_comentarios is
  'Comentários datados e assinados por máquina — o diário de bordo da ficha.';
comment on column maq_ativos.instrucoes is
  'Instruções de operação/manutenção exibidas na ficha da máquina. Parte do cadastro.';
