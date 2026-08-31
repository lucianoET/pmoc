-- ══════════════════════════════════════════════════════════════════
-- 49 — Equipes técnicas: pessoas, especialidades, equipes, turnos e
-- alocação semanal (/equipes)
--
-- A plataforma sabe o que precisa de manutenção (9 módulos de ativos) e
-- não sabe QUEM faz. Toda OS até hoje registra o técnico como TEXTO
-- LIVRE (`logs_manutencao.tecnico`, `maq_os.tecnico`): não dá para
-- perguntar quantas horas a oficina tem na semana que vem, nem se
-- existe alguém habilitado para o serviço que a OS pede.
--
-- PREFIXO `cmasm_`, NÃO `equipe_` — esta é a decisão de forma mais
-- consequente do arquivo. As outras tabelas de módulo (`maq_`,
-- `transp_`, `elet_`, `rep_`, `cal_`) pertencem a um módulo só; estas
-- não. O requisito do usuário é literalmente atravessar módulos
-- ("elétrica por eletricistas, refrigeração por técnico em
-- refrigeração"), e um dia `/eletrica` vai querer ler a mesma pessoa
-- que `/refrigeracao` leu. `cmasm_locais` já é o precedente: mora fora
-- de módulo porque vários leem. Nascer com prefixo de módulo custaria
-- uma migração de renomeação com dado em produção.
--
-- ── cmasm_especialidades ──
-- Tabela, e NÃO lista fechada no código. Ofício muda: aparece uma
-- certificação nova (NR-35, NR-10 SEP), um militar chega com formação
-- que ninguém tinha, um serviço passa a exigir habilitação. Uma lista
-- em JavaScript pediria uma migração a cada uma dessas — e a lista
-- viveria em nove arquivos diferentes, um por módulo que a consulta.
--
-- `dominios` é jsonb com as chaves dos módulos que a especialidade
-- atende (['refrigeracao'] para o técnico em refrigeração). Array e
-- não coluna única porque um mecânico atende máquinas E transportes, e
-- forçar uma linha por par duplicaria o nome da especialidade. É esta
-- coluna que responde "quem pode pegar esta OS".
--
-- ── cmasm_pessoas ──
-- UMA especialidade por pessoa, não N. É como uma oficina militar
-- distribui gente, e o par pessoa×especialidade em tabela própria só se
-- paga quando alguém acumula ofícios de verdade — quando acontecer, a
-- tabela de ligação é aditiva e não desfaz esta coluna.
--
-- `is_usuario` separa PESSOA de USUÁRIO do sistema, que é a distinção
-- que o app legado v8.3 já fazia e estava certa: a oficina tem gente
-- que executa serviço e nunca abre o app. Contar usuário como força de
-- trabalho subestimaria a capacidade; contar toda pessoa como usuário
-- criaria login para quem não precisa.
--
-- ── cmasm_turnos ──
-- `hora_inicio`/`hora_fim`, NÃO uma duração em horas. O app v8.3
-- guardava só `{nome, horas}` — o suficiente para somar capacidade e
-- insuficiente para DESENHAR: um turno sem hora não tem onde ser posto
-- num calendário. O par dá as duas coisas de uma vez, e a duração passa
-- a ser derivada em vez de digitada (ninguém escreve "4h" para um turno
-- de 08:00 às 13:00 por engano).
--
-- ── cmasm_alocacoes ──
-- Equipe × dia × turno. É o alvo do arrastar-e-soltar do calendário
-- semanal, e é também de onde a capacidade real sai.
--
-- NÃO EXISTE COLUNA "dias úteis" em lugar nenhum, de propósito: dizer
-- que a equipe trabalha de segunda a sexta É alocá-la de segunda a
-- sexta. Uma configuração de dias úteis ao lado das alocações seria uma
-- segunda fonte de verdade para o mesmo fato, e as duas divergiriam no
-- primeiro feriado ou na primeira escala de sábado.
--
-- RLS: leitura por `public`, escrita por cargo — o padrão conferido no
-- banco para o resto da plataforma (leitura aberta, escrita
-- autenticada). O cargo `observador` de `shared/auth.js` entra SEM
-- senha e continua sendo `anon`, então fechar o SELECT quebraria o
-- acesso de consulta que os outros módulos oferecem.
-- ══════════════════════════════════════════════════════════════════

create table if not exists cmasm_especialidades (
  id         serial primary key,
  nome       text not null unique,
  dominios   jsonb not null default '[]'::jsonb,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  constraint cmasm_especialidades_nome_check   check (length(btrim(nome)) > 0),
  constraint cmasm_especialidades_dominios_tipo check (jsonb_typeof(dominios) = 'array')
);

create table if not exists cmasm_pessoas (
  id               serial primary key,
  nome             text not null,
  posto            text,
  especialidade_id integer references cmasm_especialidades(id) on delete set null,
  is_usuario       boolean not null default false,
  ativo            boolean not null default true,
  obs              text,
  criado_em        timestamptz not null default now(),
  constraint cmasm_pessoas_nome_check check (length(btrim(nome)) > 0)
);

create table if not exists cmasm_equipes (
  id               serial primary key,
  nome             text not null,
  especialidade_id integer references cmasm_especialidades(id) on delete set null,
  cor              text,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  constraint cmasm_equipes_nome_check check (length(btrim(nome)) > 0),
  -- Cor é do calendário: sem ela duas equipes viram dois retângulos
  -- iguais. Hexadecimal de 6 dígitos, para não aceitar 'azul'.
  constraint cmasm_equipes_cor_check  check (cor is null or cor ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists cmasm_equipe_membros (
  id         serial primary key,
  equipe_id  integer not null references cmasm_equipes(id) on delete cascade,
  pessoa_id  integer not null references cmasm_pessoas(id)  on delete cascade,
  criado_em  timestamptz not null default now(),
  -- A mesma pessoa duas vezes na mesma equipe dobraria a capacidade dela.
  constraint cmasm_equipe_membros_unico unique (equipe_id, pessoa_id)
);

create table if not exists cmasm_turnos (
  id          serial primary key,
  nome        text not null,
  hora_inicio time not null,
  hora_fim    time not null,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  constraint cmasm_turnos_nome_check check (length(btrim(nome)) > 0),
  -- Turno que termina antes de começar daria duração negativa e
  -- subtrairia capacidade em silêncio. Turno que atravessa a meia-noite
  -- não existe nesta oficina; se um dia existir, é migração aditiva.
  constraint cmasm_turnos_ordem_horas check (hora_fim > hora_inicio)
);

create table if not exists cmasm_alocacoes (
  id         integer generated by default as identity primary key,
  equipe_id  integer not null references cmasm_equipes(id) on delete cascade,
  turno_id   integer not null references cmasm_turnos(id)  on delete cascade,
  data       date not null,
  obs        text,
  criado_em  timestamptz not null default now(),
  -- A mesma equipe no mesmo turno do mesmo dia, duas vezes, contaria a
  -- capacidade em dobro. É a trava que o arrastar-e-soltar precisa para
  -- ser idempotente: soltar de novo no mesmo lugar não cria linha nova.
  constraint cmasm_alocacoes_unico unique (equipe_id, data, turno_id)
);

create index if not exists idx_cmasm_alocacoes_data   on cmasm_alocacoes (data);
create index if not exists idx_cmasm_pessoas_ativo    on cmasm_pessoas (ativo) where ativo;
create index if not exists idx_cmasm_membros_equipe   on cmasm_equipe_membros (equipe_id);

alter table cmasm_especialidades  enable row level security;
alter table cmasm_pessoas         enable row level security;
alter table cmasm_equipes         enable row level security;
alter table cmasm_equipe_membros  enable row level security;
alter table cmasm_turnos          enable row level security;
alter table cmasm_alocacoes       enable row level security;

do $$
declare
  t text;
  -- Cadastro (pessoas, equipes, especialidades, turnos) é ato de
  -- registro: admin/gestor. Alocar equipe no calendário é planejamento
  -- de rotina e entra o técnico — a mesma separação que /refrigeracao
  -- faz entre podeEditarCadastro() e manPode('abrir').
  cadastro text[] := array['cmasm_especialidades','cmasm_pessoas','cmasm_equipes','cmasm_equipe_membros','cmasm_turnos'];
begin
  foreach t in array cadastro loop
    if not exists (select 1 from pg_policies where policyname = t||'_sel') then
      execute format('create policy %I on %I for select to public using (true)', t||'_sel', t);
    end if;
    if not exists (select 1 from pg_policies where policyname = t||'_write') then
      execute format(
        'create policy %I on %I for all to authenticated using (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in (''admin'',''gestor''))) with check (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in (''admin'',''gestor'')))',
        t||'_write', t);
    end if;
  end loop;

  if not exists (select 1 from pg_policies where policyname = 'cmasm_alocacoes_sel') then
    create policy cmasm_alocacoes_sel on cmasm_alocacoes for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'cmasm_alocacoes_write') then
    create policy cmasm_alocacoes_write on cmasm_alocacoes for all to authenticated
      using (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor','tecnico')))
      with check (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor','tecnico')));
  end if;
end $$;

comment on table cmasm_especialidades is 'Oficios da oficina e os dominios (modulos) que cada um atende. Sem prefixo de modulo: varios modulos leem.';
comment on column cmasm_especialidades.dominios is 'Array jsonb com chaves de modulo (refrigeracao, eletrica, maquinas, ...) que a especialidade atende.';
comment on table cmasm_pessoas is 'Pessoas da oficina. is_usuario separa quem executa servico de quem tem login — nem toda pessoa e usuaria do sistema.';
comment on table cmasm_turnos is 'Turnos por hora de inicio e fim: o par da a posicao no calendario E a duracao para a capacidade.';
comment on table cmasm_alocacoes is 'Equipe x dia x turno. Alvo do arrastar-e-soltar e origem da capacidade real. Nao existe coluna de dias uteis: alocar E dizer que se trabalha.';
