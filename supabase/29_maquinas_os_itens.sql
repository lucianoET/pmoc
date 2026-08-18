-- ══════════════════════════════════════════════════════════════════
-- 29 — Itens de manutenção por OS (módulo Máquinas)
--
-- Até aqui uma OS carregava no máximo um plano (maq_os.plano_id). Na
-- prática o mecânico atende várias manutenções da mesma máquina na mesma
-- ida — trocar óleo, filtro e vela numa parada só — e isso virava três OS
-- ou uma OS que mentia sobre o que foi feito.
--
-- maq_os_itens guarda os itens de uma OS. maq_os.plano_id NÃO é removido:
-- continua preenchido com o primeiro item, para que toda consulta, todo
-- relatório e todo código anterior a esta migração sigam funcionando. A
-- migração é aditiva, como todas as outras (nunca DROP).
--
-- Aplicada em produção: 18/08/2026 — conferida contra o banco (8 colunas, o
-- unique (os_id, plano_id), os dois índices, RLS ligado e as duas políticas).
-- ══════════════════════════════════════════════════════════════════

create table if not exists maq_os_itens (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references maq_os(id) on delete cascade,
  plano_id integer references maq_planos(id),
  -- descrição livre para o item que não vem de um plano (uma corretiva
  -- combinada na mesma parada, por exemplo)
  descricao text,
  concluido boolean not null default false,
  -- uso do horímetro no momento em que este item foi fechado; permite
  -- calcular o próximo vencimento por item, não só por OS
  uso_no_item numeric,
  observacao text,
  criado_em timestamptz default now(),
  -- um plano não se repete dentro da mesma OS: marcar "troca de óleo"
  -- duas vezes na mesma ordem é erro de digitação, não intenção
  unique (os_id, plano_id)
);

-- a consulta natural é "os itens desta OS"
create index if not exists maq_os_itens_os_idx on maq_os_itens(os_id);
-- e "quando este plano foi atendido pela última vez"
create index if not exists maq_os_itens_plano_idx on maq_os_itens(plano_id);

alter table maq_os_itens enable row level security;

-- Mesma política das outras tabelas do módulo Máquinas: leitura para
-- todos (o acesso Livre é observador anônimo) e escrita para sessão
-- autenticada. O controle fino de cargo é do frontend, por UX; o banco
-- garante que quem não entrou não escreve.
drop policy if exists "maq_os_itens_leitura" on maq_os_itens;
create policy "maq_os_itens_leitura" on maq_os_itens
  for select using (true);

drop policy if exists "maq_os_itens_escrita" on maq_os_itens;
create policy "maq_os_itens_escrita" on maq_os_itens
  for all to authenticated using (true) with check (true);

comment on table maq_os_itens is
  'Itens de manutenção atendidos numa mesma OS. maq_os.plano_id segue preenchido com o primeiro item, por compatibilidade.';
