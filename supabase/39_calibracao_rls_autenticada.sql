-- ══════════════════════════════════════════════════════════════════
-- 39 — Calibração: fecha a escrita anônima (decisão D-06)
--
-- A migração 35 subiu o módulo para o Postgres com uma policy `ALL` por
-- tabela aceitando `{anon, authenticated}`. Como a `anon key` está no
-- HTML — por projeto, é assim nos sete módulos —, QUALQUER PESSOA COM A
-- URL /calibracao gravava em instrumentos, PS, lotes, laboratórios e
-- catálogo. Enquanto o dado morava no localStorage o estrago era local;
-- desde a 35 é compartilhado. Isto aqui é a segunda metade do conserto:
-- a primeira é o login por cargo no módulo (`shared/auth.js`).
--
-- POR QUE NÃO "TUDO PARA authenticated"
-- O padrão do resto da plataforma é LEITURA ABERTA, ESCRITA AUTENTICADA
-- (`maq_ativos`, `equipamentos`, `transp_ativos`: SELECT em `public`/
-- `anon`, INSERT/UPDATE/DELETE em `authenticated`). Fechar `cal_*`
-- inteiramente quebraria o cargo **Livre** do login compartilhado, que é
-- acesso de observador SEM SENHA — ele nunca chama
-- `signInWithPassword`, então continua sendo `anon`. O observador é papel
-- real do projeto. O que o D-06 existe para consertar é a ESCRITA.
--
-- SEM `drop policy`. As cinco policies que já existem são RESTRINGIDAS
-- com `alter policy ... to authenticated` — mesmo nome, mesmo corpo, só
-- a lista de roles muda. Em seguida uma policy nova devolve o SELECT
-- que `anon` perdeu. Policies são permissivas e combinam por OR, então a
-- ordem aqui importa em leitura, não em escrita: `anon` volta a ler por
-- causa da segunda, e não escreve porque nenhuma policy o permite mais.
--
-- Migração ADITIVA quanto a dados: nenhuma tabela, coluna ou linha é
-- tocada. Rodar inteira no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. a policy existente deixa de valer para `anon` ──
alter policy "cal_labs_tudo"         on cal_labs         to authenticated;
alter policy "cal_equipamentos_tudo" on cal_equipamentos to authenticated;
alter policy "cal_ps_tudo"           on cal_ps           to authenticated;
alter policy "cal_lotes_tudo"        on cal_lotes        to authenticated;
alter policy "cal_catalogo_tudo"     on cal_catalogo     to authenticated;

-- ── 2. a leitura volta a ser pública, como nas outras seis famílias ──
-- `if not exists` não existe para policy; o `drop ... if exists` de uma
-- policy que esta própria migração cria é o que a torna re-executável,
-- e não apaga nada que existisse antes dela.
drop policy if exists "cal_labs_sel" on cal_labs;
create policy "cal_labs_sel" on cal_labs
  for select to public using (true);

drop policy if exists "cal_equipamentos_sel" on cal_equipamentos;
create policy "cal_equipamentos_sel" on cal_equipamentos
  for select to public using (true);

drop policy if exists "cal_ps_sel" on cal_ps;
create policy "cal_ps_sel" on cal_ps
  for select to public using (true);

drop policy if exists "cal_lotes_sel" on cal_lotes;
create policy "cal_lotes_sel" on cal_lotes
  for select to public using (true);

drop policy if exists "cal_catalogo_sel" on cal_catalogo;
create policy "cal_catalogo_sel" on cal_catalogo
  for select to public using (true);

-- ── conferência ──
-- Depois de rodar, o esperado é DUAS policies por tabela: a `_tudo` em
-- {authenticated} e a `_sel` em {public}.
--
--   select tablename, policyname, cmd, roles::text
--     from pg_policies where tablename like 'cal_%' order by 1, 3;
