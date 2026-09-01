-- ══════════════════════════════════════════════════════════════════
-- 55 — Semente do catálogo de serviços, derivada do plano REAL
--
-- REGRA QUE GOVERNA ESTE ARQUIVO: nada de conteúdo técnico inventado.
-- Os 9 serviços saem, palavra por palavra, das 9 linhas que já estão em
-- `plano_tarefas` desde a migração 04 — a `descricao` vira o nome do
-- serviço e o `norma_ref` vem junto. Depois cada tarefa aponta para o
-- serviço que ela executa. Nenhum texto novo entra no banco.
--
-- ── O QUE ESTA SEMENTE NÃO FAZ, E POR QUÊ ──────────────────────────
--
-- NÃO cria regra específica para CENTRAL nem para CHILLER. É a lacuna
-- que motivou a migração 54 — 7 máquinas recebendo hoje o checklist do
-- split —, mas escrever aqui o que se faz numa central de 30 TR seria
-- inventar plano de manutenção, que é decisão técnica do usuário e não
-- de quem escreve a migração. O conserto que ESTA entrega é outro, e é
-- suficiente: com a 54 aplicada, o checklist da OS passa a vir do plano
-- REAL (as 9 tarefas da NBR, que valem para toda climatização) em vez
-- de cair no `|| tabela['SPLIT']`. A central deixa de receber o
-- checklist errado e passa a receber o certo, ainda que incompleto — e
-- a tela DIZ que os dois tipos não têm regra própria, com o botão para
-- criá-la.
--
-- NÃO semeia `servico_materiais`. Não é omissão de forma: `materiais`
-- (migração 44) está com **zero linhas** — o catálogo existe e ninguém
-- cadastrou peça nenhuma. Não há material a apontar, e inventar um
-- ("filtro G4") poria no plano uma peça que o estoque não conhece e que
-- ninguém pode dar baixa. A tela mostra a seção vazia com o caminho
-- para a página Estoque.
--
-- NÃO preenche `tempo_padrao_min`. Cronometrar limpeza de filtro é
-- medição de oficina; enquanto ninguém mediu, o cálculo de capacidade
-- em /equipes usa `cmasm_parametros.minutos_por_tarefa` (10 min), que é
-- declarado na tela como ponto de partida. Um número aqui competiria
-- com aquele sem que nada dissesse qual vale.
--
-- Idempotente: `on conflict (codigo) do nothing` no catálogo, e o
-- `update` das tarefas só toca linha com `servico_id` ainda nulo, para
-- não desfazer uma ligação que alguém tenha corrigido na tela.
--
-- Aplicar depois da 54.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. os 9 serviços, tirados das 9 tarefas que já existem ─────────
insert into servicos (codigo, nome, norma_ref, ordem, descricao)
select
  'SRV-' || lpad(t.ordem::text, 2, '0'),
  t.descricao,
  t.norma_ref,
  t.ordem,
  'Serviço derivado da tarefa do plano PMOC (migração 04). Texto original preservado.'
from plano_tarefas t
where t.ativo
  and not exists (select 1 from servicos s where s.nome = t.descricao)
on conflict (codigo) do nothing;

-- ── 2. cada tarefa aponta para o seu serviço ───────────────────────
--
-- Casado por `descricao = nome`, que é como a linha 1 os criou. Só
-- preenche onde ainda está nulo.
update plano_tarefas t
   set servico_id = s.id
  from servicos s
 where s.nome = t.descricao
   and t.servico_id is null;

-- ── 3. conferência ─────────────────────────────────────────────────
--
-- Levanta se alguma tarefa ativa ficou sem serviço. Semente que falha
-- em silêncio é pior que semente que não roda: a tela mostraria a
-- tarefa sem serviço e ninguém saberia se é assim de propósito.
do $$
declare orfas integer;
begin
  select count(*) into orfas from plano_tarefas where ativo and servico_id is null;
  if orfas > 0 then
    raise exception 'SEMENTE INCOMPLETA: % tarefa(s) ativa(s) sem servico_id', orfas;
  end if;
  raise notice 'ok: todas as tarefas ativas ligadas a um servico';
end $$;
