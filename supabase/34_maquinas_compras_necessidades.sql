-- ══════════════════════════════════════════════════════════════════
-- 34 — Necessidades de compra: material com sistema/aplicação e
-- listas de compra rastreáveis
--
-- A aba "Lista de compras" de hoje é só leitura: mostra o que falta,
-- mas ninguém consegue dizer "isto já foi pedido" nem dar entrada no
-- que chegou — a necessidade some assim que a página recarrega. Este
-- arquivo dá processo a isso:
--
-- · maq_materiais.sistema/aplicacao — classificação da peça, exibida
--   na aba Necessidades ao lado da quantidade
-- · maq_compras_listas — uma lista gerada a partir da seleção de
--   necessidades, com título, status e data
-- · maq_compras_itens — os itens de cada lista, com preço congelado
--   na linha e recebimento parcial por item
--
-- Migração aditiva, como todas menos a 31: sem remoção de tabela nem
-- de coluna, sem alter ... drop de espécie alguma. NÃO aplicada em produção na
-- data em que este arquivo subiu (18/08/2026) — a aplicação é passo
-- do orquestrador, depois. Lição da migração 28: "create table if not
-- exists" garante a existência da tabela, não a forma dela — conferir
-- as colunas depois de aplicar, nunca confiar apenas na ausência de
-- erro.
-- ══════════════════════════════════════════════════════════════════

-- ── material: sistema e aplicação ───────────────────────────────────
-- Texto livre, não FK: uma peça serve modelos que nem sempre estão
-- cadastrados em rep_modelos ou em maq_ativos.tipo_modelo, e uma lista
-- fechada recusaria um cadastro legítimo de peça nova.
alter table maq_materiais add column if not exists sistema text;
alter table maq_materiais add column if not exists aplicacao text;

comment on column maq_materiais.sistema is
  'Subsistema da máquina a que a peça pertence (texto livre, com sugestões na tela — Motor, Transmissão, Hidráulico, Elétrico, Corte, Chassi, Filtragem, Lubrificação). Não é FK: o vocabulário é aberto, a tela só sugere.';
comment on column maq_materiais.aplicacao is
  'Em que modelo(s) a peça serve — "Vários" quando ela serve mais de um modelo. Texto livre, não FK: uma peça serve modelos que nem sempre estão cadastrados, e uma lista fixa recusaria um cadastro legítimo.';

-- ── listas de compra ────────────────────────────────────────────────
create table if not exists maq_compras_listas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  data date default current_date,
  status text not null default 'aberta' check (status in ('aberta','enviada','recebida','cancelada')),
  criado_por text,
  criado_em timestamptz default now()
);

-- ── itens de cada lista ─────────────────────────────────────────────
create table if not exists maq_compras_itens (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid references maq_compras_listas(id) on delete cascade,
  material_id integer references maq_materiais(id),
  quantidade numeric not null check (quantidade > 0),
  preco_unit numeric,
  origem text check (origem in ('preventiva','corretiva','minimo','manual')),
  qtd_recebida numeric not null default 0 check (qtd_recebida >= 0),
  recebido_em timestamptz,
  unique (lista_id, material_id)
);

comment on column maq_compras_itens.preco_unit is
  'Preço unitário congelado na linha no momento da criação da lista, mesmo motivo já registrado em 30_maquinas_os_custos.sql: reprecificar o catálogo depois não pode reescrever uma lista já fechada.';

-- A quantidade "em aquisição" de um material NÃO vira coluna em
-- maq_materiais: ela é derivada de quantidade - qtd_recebida somada
-- sobre os itens pendentes (listas em 'aberta' ou 'enviada'), porque
-- uma coluna denormalizada dessincroniza do que foi realmente
-- recebido — o recebimento parcial item a item já é a fonte da
-- verdade, não precisa de um segundo lugar para guardar o mesmo dado.

create index if not exists maq_compras_itens_lista_idx on maq_compras_itens(lista_id);
create index if not exists maq_compras_itens_material_idx on maq_compras_itens(material_id);

alter table maq_compras_listas enable row level security;
alter table maq_compras_itens enable row level security;

-- Mesmo par de políticas das outras tabelas do módulo (modelo da 32):
-- leitura para todos (o acesso Livre é observador anônimo) e escrita
-- para sessão autenticada. Sem bloco de grants — a 32 não tem e
-- funciona em produção.
drop policy if exists "maq_compras_listas_leitura" on maq_compras_listas;
create policy "maq_compras_listas_leitura" on maq_compras_listas
  for select using (true);
drop policy if exists "maq_compras_listas_escrita" on maq_compras_listas;
create policy "maq_compras_listas_escrita" on maq_compras_listas
  for all to authenticated using (true) with check (true);

drop policy if exists "maq_compras_itens_leitura" on maq_compras_itens;
create policy "maq_compras_itens_leitura" on maq_compras_itens
  for select using (true);
drop policy if exists "maq_compras_itens_escrita" on maq_compras_itens;
create policy "maq_compras_itens_escrita" on maq_compras_itens
  for all to authenticated using (true) with check (true);

comment on table maq_compras_listas is
  'Lista de compra gerada a partir da seleção de necessidades — título, status e data. Fecha sozinha quando o último item chega.';
comment on table maq_compras_itens is
  'Itens de uma lista de compra, com preço congelado na linha e recebimento parcial (qtd_recebida) por item.';
