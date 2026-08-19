-- ══════════════════════════════════════════════════════════════════
-- 35 — Calibração: o módulo sai do localStorage e entra no Postgres
--
-- /calibracao era o único módulo da plataforma sem banco. Os 38
-- instrumentos, os 8 laboratórios, os pedidos de serviço, os lotes e o
-- catálogo de preços viviam inteiramente em
-- localStorage['cmasm_erp_state_v1'], no navegador de quem usava:
-- limpar o cache apagava o controle de calibração do CMASM inteiro,
-- abrir em outro computador mostrava o seed de fábrica, e não havia
-- backup nem forma de duas pessoas trabalharem no mesmo dado.
--
-- Quatro tabelas, não cinco: ATA_ITEMS_SEED (os 35 itens da ata
-- 00129/2025) e ATA_INFO continuam constantes no código do módulo
-- porque só são lidos — conferido: aparecem em .map() e .find(), nunca
-- em escrita, e não estão em nenhuma das duas chaves de localStorage.
-- Tabela para dado que ninguém edita é peso morto.
--
-- ⚠ SEGURANÇA — LEIA ANTES DE APLICAR
-- Este módulo não tem login, por decisão do usuário (18/08/2026). Todas
-- as políticas abaixo aceitam `anon`, então QUALQUER PESSOA COM A URL
-- /calibracao LÊ E ALTERA ESTES DADOS. Isso é um degrau abaixo dos
-- outros seis módulos, onde a escrita exige sessão autenticada.
-- Enquanto o dado morava no navegador o estrago era local; a partir
-- daqui é compartilhado. Fechar isso depois exige `shared/auth.js` no
-- módulo mais uma migração trocando as políticas de escrita para
-- `to authenticated`. Está registrado como pendência conhecida no
-- CLAUDE.md — não é configuração esquecida.
--
-- Migração aditiva: nenhuma tabela existente é tocada, nada é dropado.
-- ⚠ `create table if not exists` é no-op em tabela que já existe — se
-- alguma cal_* já tiver sido criada de rascunho, esta migração passa em
-- silêncio sem corrigir a forma (foi exatamente o que obrigou a criar a
-- migração 28 no módulo Reparos). Confira as colunas depois de aplicar.
-- ══════════════════════════════════════════════════════════════════

-- ── laboratórios ──
-- Quem calibra: o laboratório da Marinha (CMS), os fornecedores de
-- pregão (MQT) e as assistências autorizadas. `tipo` separa os três
-- porque a tela de Saldo da Ata só conta consumo de laboratório de
-- pregão.
create table if not exists cal_labs (
  id     text primary key,
  code   text not null,
  nome   text not null,
  tipo   text,
  acred  text,
  esp    text[] not null default '{}',
  obs    text,
  ativo  boolean not null default true
);

-- ── instrumentos ──
-- A chave primária é o id de texto que o app já usa ('e001', 'imp…').
-- Desvio consciente do bigint identity: `eqId` e `labId` são referência
-- em dezenas de pontos das 11 páginas React; trocar por identity
-- obrigaria a reescrever tudo isso para não ganhar nada aqui — são 38
-- linhas, não uma tabela de eventos.
create table if not exists cal_equipamentos (
  id         text primary key,
  sn         text,
  pat        text,
  cat        text,
  tipo       text not null,
  fab        text,
  mod        text,
  faixa      text,
  div        text,
  lab_id     text references cal_labs(id),
  -- periodicidade da calibração, em meses: é o que soma em `ult` para
  -- produzir `prox` quando um PS é concluído
  per        integer not null default 12 check (per > 0),
  ult        date,
  prox       date,
  cert       text,
  -- sem closed list de propósito: `importEqs()` escreve aqui o que vier
  -- da planilha XLSX importada, e um check apertado transformaria uma
  -- importação com status inesperado em erro de banco no meio do
  -- trabalho. Valores em uso: CALIBRADO, DESCALIBRADO, EM_REPARO,
  -- SEM_CERTIFICADO, AGUARDANDO_CALIBRACAO.
  status     text not null default 'SEM_CERTIFICADO',
  custo_cal  numeric(12,2) not null default 0 check (custo_cal >= 0),
  custo_rep  numeric(12,2) not null default 0 check (custo_rep >= 0),
  rest       text,
  obs        text,
  -- campos que só a importação de planilha preenche
  local      text,
  grandeza   text,
  resol      text,
  classe     text,
  ema        text,
  u_cal      text,
  fw         text,
  verif_int  text,
  -- baixa é arquivamento, como no resto da plataforma: nunca delete
  ativo      boolean not null default true
);

-- ── pedidos de serviço ──
-- `num` é único porque o número do PS é gerado no cliente
-- (PS-CMS-26-013) e agora existem vários clientes. Sem esta restrição,
-- dois técnicos emitindo ao mesmo tempo produziriam dois PS com o mesmo
-- número e ninguém saberia. Com ela, o segundo insert falha e o app
-- tenta o número seguinte.
create table if not exists cal_ps (
  id           text primary key,
  num          text not null unique,
  eq_id        text not null references cal_equipamentos(id),
  lab_id       text references cal_labs(id),
  tipo         text not null default 'calibracao_rotina'
                 check (tipo in ('calibracao_rotina', 'reparo')),
  status       text not null default 'EMITIDO'
                 check (status in ('EMITIDO', 'ENVIADO', 'EM_CALIBRACAO',
                                   'CONCLUIDO', 'CANCELADO')),
  -- as quatro datas do ciclo: emissão, envio, calibração, retorno
  emi          date,
  env          date,
  cal          date,
  ret          date,
  cert         text,
  res          text,
  -- previsto vem do custo cadastrado no instrumento na hora da emissão;
  -- executado é o que a nota fiscal cobrou
  valor_prev   numeric(12,2),
  valor_exec   numeric(12,2),
  nf           text,
  ctr          text,
  emitente     text,
  obs          text
);

-- ── lotes ──
-- `descricao`, não `desc`: DESC é palavra reservada no Postgres.
create table if not exists cal_lotes (
  id         text primary key,
  code       text not null,
  descricao  text,
  contrato   text,
  status     text not null default 'PLANEJADO'
               check (status in ('PLANEJADO', 'ENVIADO', 'EM_CALIBRACAO',
                                 'CONCLUIDO', 'CANCELADO')),
  data       date,
  itens      jsonb not null default '[]'::jsonb
);

-- ── catálogo de preços ──
-- No app é um mapa tipo-de-instrumento → lista de opções de preço
-- (fornecedor da ata, laboratório interno). `ord` preserva a ordem de
-- exibição dentro de cada tipo; a chave composta é o que o mapa era.
-- `tipo` aqui é a natureza do preço (ata/interno), não o instrumento.
create table if not exists cal_catalogo (
  equip_tipo  text not null,
  ord         integer not null,
  forn        text,
  contrato    text,
  preco       numeric(12,2) not null default 0 check (preco >= 0),
  item        text,
  tipo        text,
  primary key (equip_tipo, ord)
);

-- ── índices ──
-- O Postgres não indexa coluna de FK sozinho, e toda tela do módulo faz
-- join instrumento→laboratório e PS→instrumento.
create index if not exists cal_equipamentos_lab_idx on cal_equipamentos(lab_id);
create index if not exists cal_ps_eq_idx            on cal_ps(eq_id);
create index if not exists cal_ps_lab_idx           on cal_ps(lab_id);

-- `prox` decide vencido / a vencer no dashboard inteiro; parcial porque
-- instrumento baixado não entra em nenhuma dessas contas.
create index if not exists cal_equipamentos_prox_idx
  on cal_equipamentos(prox) where ativo;

-- ── RLS ──
-- Leitura e escrita abertas a anon: ver o aviso de segurança no topo
-- deste arquivo. Não é descuido, é a consequência de o módulo seguir
-- sem login.
alter table cal_labs         enable row level security;
alter table cal_equipamentos enable row level security;
alter table cal_ps           enable row level security;
alter table cal_lotes        enable row level security;
alter table cal_catalogo     enable row level security;

drop policy if exists "cal_labs_tudo" on cal_labs;
create policy "cal_labs_tudo" on cal_labs
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "cal_equipamentos_tudo" on cal_equipamentos;
create policy "cal_equipamentos_tudo" on cal_equipamentos
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "cal_ps_tudo" on cal_ps;
create policy "cal_ps_tudo" on cal_ps
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "cal_lotes_tudo" on cal_lotes;
create policy "cal_lotes_tudo" on cal_lotes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "cal_catalogo_tudo" on cal_catalogo;
create policy "cal_catalogo_tudo" on cal_catalogo
  for all to anon, authenticated using (true) with check (true);
