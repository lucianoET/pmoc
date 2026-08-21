-- ══════════════════════════════════════════════════════════════════
-- 41 — Ficha do equipamento em quatro blocos, cadastro editável e
-- vocabulário de estado OP/INOP/OR (/refrigeracao)
--
-- A ficha do equipamento pedida pelo usuário precisa de quatro colunas
-- que a tabela `equipamentos` não tem (modelo, data de fabricação, link
-- e manual — hoje 0/171 preenchidos em qualquer um dos quatro), e o
-- estado da máquina deixa de ser um vocabulário de duas palavras
-- (OK/NOK, sem trava nenhuma) para um de três (OP/INOP/OR — Operante /
-- Inoperante / Operando com restrições). O técnico também passa a
-- registrar três medições novas (capacitor de marcha, capacitor de
-- partida, tensão medida) junto das cinco que a migração 04 já criou.
--
-- Números medidos em produção em 21/08/2026, antes desta migração:
--   `equipamentos.funciona` = OK 136 / NOK 35, total 171 — SEM check
--   constraint (a coluna nunca teve trava nenhuma; esta migração cria a
--   primeira). `modelo`/`data_fabricacao`/`link`/`manual_url`: 0/171 em
--   todas as quatro (colunas ainda não existem).
--
-- Este é o caso raro em que uma migração aditiva também ATUALIZA dado
-- existente (os 171 valores de `funciona`), não só forma de esquema —
-- por isso os dois `update` vêm antes da trava nova, guardados pelo
-- valor antigo no `where` (idempotentes: rodar o arquivo duas vezes
-- toca zero linha na segunda), e a trava só é criada depois deles.
--
-- ORDEM DE PUBLICAÇÃO (D-q57-06): o frontend vai a produção ANTES deste
-- SQL. `EQUIP_EQUIVALENCIA` traduz OK→OP e NOK→INOP na leitura, então a
-- tela publicada entende os dois vocabulários — na ordem inversa haveria
-- uma janela em que o banco fala OP/INOP/OR e a tela publicada ainda só
-- reconhece OK/NOK, e 171 cartões cairiam no rótulo de desconhecido sem
-- erro nenhum que denunciasse o problema.
--
-- Aditivo, para ser rodado no SQL editor do Supabase — este arquivo só
-- escreve o script, nunca o executa. Nenhum `drop table`, `drop column`
-- nem `delete from` em lugar nenhum deste arquivo — o projeto arquiva.
-- ══════════════════════════════════════════════════════════════════

-- 1) Quatro colunas novas em `equipamentos` — os dados fixos da ficha
-- que hoje não têm onde morar.
alter table equipamentos add column if not exists modelo text;
alter table equipamentos add column if not exists data_fabricacao date;
alter table equipamentos add column if not exists link text;
alter table equipamentos add column if not exists manual_url text;

-- 2) Três colunas novas em `logs_manutencao` — medições de instrumento,
-- todas anuláveis, nenhuma com default: nenhuma é obrigatória (D-q57-03,
-- "o que o técnico conseguir medir").
alter table logs_manutencao add column if not exists capacitor_marcha numeric;
alter table logs_manutencao add column if not exists capacitor_partida numeric;
alter table logs_manutencao add column if not exists tensao_medida numeric;

-- 3) Trava de esquema de URL (D-q57-09) — uma restrição combinada com
-- `and`, no idioma do envelope geográfico da migração 25, e não duas.
-- As colunas acabaram de nascer no passo 1, então nenhuma linha
-- existente pode invalidar esta trava — a mesma razão pela qual a
-- migração 37 pôde restringir a forma do contorno de `cmasm_locais.geom`
-- enquanto `maq_areas.geom` (mais antiga) nunca ganhou essa guarda.
alter table equipamentos drop constraint if exists equipamentos_link_url_chk;
alter table equipamentos add constraint equipamentos_link_url_chk
  check (
    (link is null or link ~* '^https?://')
    and (manual_url is null or manual_url ~* '^https?://')
  );

-- 4) Atualização do dado — os dois `update` idempotentes, cada um
-- guardado pelo valor ANTIGO no `where`. Rodar o arquivo duas vezes toca
-- zero linha na segunda. Nenhum `delete`, nenhum `drop`.
--   esperado nesta execução: 136 linhas OK → OP, 35 linhas NOK → INOP.
update equipamentos set funciona = 'OP' where funciona = 'OK';
update equipamentos set funciona = 'INOP' where funciona = 'NOK';

-- 5) Trava do estado — DEPOIS dos dois `update` acima, nunca antes: com
-- as 171 linhas ainda em OK/NOK a criação desta restrição teria
-- derrubado a migração inteira (a trava recusaria o próprio dado que já
-- está na tabela). `null` PASSA nesta trava por semântica de SQL — `null
-- in (...)` avalia como desconhecido, e `check` só recusa o que avalia
-- como falso — o que é documentado aqui, não acidental: hoje as 171
-- linhas têm valor, e uma linha futura sem estado aparece na tela como
-- desconhecida (pílula "VERIFICAR"), que é o comportamento honesto.
alter table equipamentos drop constraint if exists equipamentos_funciona_chk;
alter table equipamentos add constraint equipamentos_funciona_chk
  check (funciona in ('OP', 'INOP', 'OR'));

-- 6) Comentários das colunas novas, do vocabulário de `funciona`, e o
-- único toque em `estado` — que é dado nenhum, comentário só, e existe
-- para matar na origem a armadilha que já custou nota em três arquivos
-- do projeto (CLAUDE.md, mapa-dados.js, esta própria migração).
comment on column equipamentos.modelo is
  'Modelo do equipamento, cadastro livre (D-q57-05: campo editável pela ficha, admin/gestor).';
comment on column equipamentos.data_fabricacao is
  'Data de fabricação do equipamento, cadastro livre.';
comment on column equipamentos.link is
  'Link de referência do equipamento (fabricante, ficha técnica, etc). Só http(s):// — equipamentos_link_url_chk.';
comment on column equipamentos.manual_url is
  'URL do manual do equipamento. Só http(s):// — equipamentos_link_url_chk.';
comment on column logs_manutencao.capacitor_marcha is
  'Capacitor de marcha medido na execução da OS (µF). Evidência de execução, D-q57-12.';
comment on column logs_manutencao.capacitor_partida is
  'Capacitor de partida medido na execução da OS (µF). Evidência de execução, D-q57-12.';
comment on column logs_manutencao.tensao_medida is
  'Tensão medida na execução da OS (V). Evidência de execução, D-q57-12.';
comment on column equipamentos.funciona is
  'Estado da máquina: OP (Operante), INOP (Inoperante) ou OR (Operando com restrições). '
  'Migrado de OK/NOK em 2026-08-21 (migração 41) — a tela lê os dois vocabulários '
  '(EQUIP_EQUIVALENCIA), a escrita só produz o novo.';
comment on column equipamentos.estado is
  'ATENÇÃO: apesar do nome, esta coluna guarda a IDADE APARENTE do aparelho '
  '(NOVA/SEMI/VELHA) — não o funcionamento, que vive em `funciona`. Não é reaproveitada '
  'por esta migração nem por nenhuma outra (D-q57-02); a tela rotula este campo '
  '"Idade aparente" e nunca "Estado".';

-- Nada de RLS neste arquivo: a policy de `equipamentos` continua
-- `for update to authenticated using (true)`, sem distinção de cargo
-- (D-q57-13, fora de escopo deste task). A trava de admin/gestor no
-- cadastro editável é UX apenas, registrada sem eufemismo no SUMMARY.

-- ══════════════════════════════════════════════════════════════════
-- Conferência pós-aplicação (rodar depois, no SQL editor):
--
-- select funciona, count(*) from equipamentos group by funciona order by funciona;
-- -- esperado: INOP 35, OP 136 — nenhum OK, nenhum NOK, total 171
--
-- select column_name from information_schema.columns
--   where table_name in ('equipamentos','logs_manutencao')
--   and column_name in ('modelo','data_fabricacao','link','manual_url',
--     'capacitor_marcha','capacitor_partida','tensao_medida');
-- -- esperado: 7 linhas
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'equipamentos'::regclass
--   and conname in ('equipamentos_link_url_chk','equipamentos_funciona_chk');
-- -- esperado: 2 linhas, as duas travas descritas acima
--
-- select count(*) from equipamentos where link is not null or manual_url is not null;
-- -- esperado: 0 no dia da aplicação — ninguém preencheu ainda
-- ══════════════════════════════════════════════════════════════════
