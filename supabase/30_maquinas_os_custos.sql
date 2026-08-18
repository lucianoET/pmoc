-- ══════════════════════════════════════════════════════════════════
-- 30 — Peças e serviços escolhidos na OS, e o valor da hora-homem
--
-- Até aqui `maq_os.custo_pecas` e `custo_mo` eram números digitados à mão:
-- ninguém sabia de quais peças nem de quantas horas o valor tinha saído, e
-- editar o preço de um material no catálogo não tinha efeito nenhum sobre a
-- conta — nem devia ter, mas também não havia registro do preço usado.
--
-- Agora a OS carrega as duas listas, e o custo é a soma delas.
--
-- Os valores unitários são GRAVADOS NA LINHA, não só referenciados: preço de
-- material e valor de hora mudam com o tempo, e uma OS fechada em agosto não
-- pode mudar de custo porque o catálogo foi reajustado em setembro. A FK diz
-- de onde veio; a coluna de valor diz por quanto saiu.
--
-- Aplicada em produção: (preencher a data ao rodar)
-- ══════════════════════════════════════════════════════════════════

-- ── Peças consumidas na OS ──
create table if not exists maq_os_materiais (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references maq_os(id) on delete cascade,
  material_id integer not null references maq_materiais(id),
  quantidade numeric not null check (quantidade > 0),
  -- preço do material no momento da OS (snapshot)
  preco_unit numeric check (preco_unit is null or preco_unit >= 0),
  -- de onde a linha veio: escolhida à mão, herdada do plano de manutenção ou
  -- do diagnóstico do catálogo de reparos. Serve para o usuário saber o que
  -- pode apagar sem perder informação.
  origem text not null default 'manual' check (origem in ('manual','plano','reparo')),
  criado_em timestamptz default now(),
  -- a mesma peça não entra duas vezes na mesma OS: some-se a quantidade
  unique (os_id, material_id)
);

create index if not exists maq_os_materiais_os_idx on maq_os_materiais(os_id);

-- ── Serviços executados na OS ──
-- servico_id é nullable de propósito: um serviço combinado na hora, que não
-- está no catálogo do módulo Reparos, entra pela descrição livre. E num banco
-- onde a migração 26 não tiver rodado, a linha continua válida.
create table if not exists maq_os_servicos (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references maq_os(id) on delete cascade,
  servico_id bigint references rep_servicos(id),
  descricao text,
  horas numeric not null check (horas > 0),
  -- valor da hora no momento da OS (snapshot)
  valor_hora numeric check (valor_hora is null or valor_hora >= 0),
  criado_em timestamptz default now(),
  -- ou vem do catálogo, ou tem descrição: linha sem os dois não diz nada
  constraint maq_os_servicos_identificacao_chk
    check (servico_id is not null or nullif(btrim(coalesce(descricao,'')), '') is not null)
);

create index if not exists maq_os_servicos_os_idx on maq_os_servicos(os_id);

-- ── Configuração do módulo ──
-- Uma linha por chave. Existe porque o valor da hora-homem é único para o
-- módulo (decisão do usuário) e precisa ser editável por quem opera, sem
-- passar por alteração de código nem por novo deploy.
create table if not exists maq_config (
  chave text primary key,
  valor text,
  descricao text,
  atualizado_em timestamptz default now()
);

-- Nasce SEM valor, de propósito: nenhum número de hora-homem foi informado
-- ainda, e inventar um produziria custo de mão de obra falso em toda OS.
-- Enquanto estiver vazio, o custo de mão de obra fica zero e a tela diz por quê.
insert into maq_config (chave, valor, descricao)
values ('valor_hora_padrao', null, 'Valor da hora-homem em reais, usado como padrão no custo de mão de obra das OS')
on conflict (chave) do nothing;

alter table maq_os_materiais enable row level security;
alter table maq_os_servicos  enable row level security;
alter table maq_config       enable row level security;

-- Mesma política das outras tabelas do módulo: leitura para todos (o acesso
-- Livre é observador anônimo) e escrita para sessão autenticada.
drop policy if exists "maq_os_materiais_leitura" on maq_os_materiais;
create policy "maq_os_materiais_leitura" on maq_os_materiais for select using (true);
drop policy if exists "maq_os_materiais_escrita" on maq_os_materiais;
create policy "maq_os_materiais_escrita" on maq_os_materiais for all to authenticated using (true) with check (true);

drop policy if exists "maq_os_servicos_leitura" on maq_os_servicos;
create policy "maq_os_servicos_leitura" on maq_os_servicos for select using (true);
drop policy if exists "maq_os_servicos_escrita" on maq_os_servicos;
create policy "maq_os_servicos_escrita" on maq_os_servicos for all to authenticated using (true) with check (true);

drop policy if exists "maq_config_leitura" on maq_config;
create policy "maq_config_leitura" on maq_config for select using (true);
drop policy if exists "maq_config_escrita" on maq_config;
create policy "maq_config_escrita" on maq_config for all to authenticated using (true) with check (true);

comment on table maq_os_materiais is
  'Peças consumidas numa OS, com o preço unitário congelado no momento da OS.';
comment on table maq_os_servicos is
  'Serviços executados numa OS, com horas e valor da hora congelados no momento da OS.';
comment on table maq_config is
  'Configuração do módulo Máquinas, uma linha por chave. Hoje: valor_hora_padrao.';
