-- ══════════════════════════════════════════════════════════════════
-- 46 — Marcações de inverter e redundante já levantadas em campo
-- (/refrigeracao)
--
-- Transcrição do inventário exportado e marcado à mão pelo usuário em
-- 29/08/2026 (`pmoc-refrigeracao-inventario-2026-08-29.csv`), onde as
-- colunas `inverter` e `redundante` foram preenchidas com `x`.
--
-- POR QUE SQL E NÃO A IMPORTAÇÃO DE PLANILHA (D-500-08): aquele arquivo
-- não passa — nem deve passar — pelo caminho de importação. Ele tem 183
-- linhas de dados contra `instalados=175` declarado no próprio
-- cabeçalho, o id 138 repetido em 6 linhas, 4 linhas do PAIOL sem id
-- nenhum, e está defasado do banco em pontos que importam (as seis
-- máquinas do F21 que ele traz como SELF CONTAINED já são `CENTRAL` no
-- cadastro, e as quatro de MECÂNICA 03 já foram separadas em BL/BR/FL/
-- FR). É documento de trabalho, não exportação fiel: a guarda de escopo
-- (D-5hy-13) recusaria arquivar, corretamente, e as 6 linhas do id 138
-- gravariam uma por cima da outra. Um `update` por id é o que essa
-- marcação é de verdade.
--
-- O QUE `redundante` SIGNIFICA (corrigido em 29/08/2026 pelo usuário):
-- não é "esta é a unidade reserva" — é **participa de um arranjo em que
-- só um equipamento do conjunto opera por vez**. No paiol são duas
-- máquinas por câmara em RODÍZIO: não há principal nem reserva fixa, as
-- duas se alternam, então **as duas** são marcadas. Por isso este seed
-- marca 14 máquinas do PAIOL e não 7 — a planilha entregue marcava só a
-- segunda de cada par, o que descreveria uma reserva fixa que não
-- existe.
--
-- NÃO ADIVINHADO — o PAIOL tem três câmaras com máquina de menos no
-- cadastro, e é isso que as linhas sem id da planilha eram: equipamento
-- que existe no chão e não existe no banco, não ambiguidade a resolver
-- escolhendo um id.
--
--     D-5   tem 1 cadastrada (id 93); falta a segunda
--     K-6   tem 1 cadastrada (id 94); falta a segunda
--     R-7   não tem NENHUMA cadastrada; faltam as duas
--
-- Essas quatro entram por "Cadastrar novo equipamento" na tela, e só
-- então recebem a marca — cadastrar máquina não é trabalho de seed.
--
-- O F21 fica de fora deste arquivo de propósito: lá o arranjo é o
-- sistema central do prédio contra os splits instalados depois (ou os
-- centrais ligam, ou os splits), atravessa vários `local`, e a planilha
-- entregue não marcou nenhum deles como redundante — é decisão do
-- usuário quais das 6 centrais e dos 17 splits entram no conjunto.
--
-- `automacao` não recebe nenhuma linha: o usuário ainda não marcou
-- nenhum equipamento como controlável por automação, e escrever `false`
-- em 175 linhas afirmaria uma conferência que não aconteceu (D-500-02).
--
-- Idempotente: rodar duas vezes toca as mesmas linhas com o mesmo valor.
-- Depende da migração 45.
-- ══════════════════════════════════════════════════════════════════

-- Inverter — 19 equipamentos (F21 e EXOCET).
update equipamentos set inverter = true
 where id in (127,128,129,130,131,138,140,141,142,143,144,145,
              163,167,169,172,173,174,175);

-- Redundante — as 7 câmaras do PAIOL com as duas máquinas cadastradas,
-- em rodízio: G-5 (95,96), G-6 (97,98), G-7 (99,100), G-8 (101,102),
-- U-6 (104,105), U-7 (106,107), U-8 (108,109).
update equipamentos set redundante = true
 where id in (95,96,97,98,99,100,101,102,104,105,106,107,108,109);

-- Redundante — a dupla de splits da sala do servidor do COMANDO. A
-- planilha marcou só o id 28; o 27 entra junto porque são dois CONSUL
-- de 18.000 BTU no mesmo local e a marca descreve o conjunto, não uma
-- reserva fixa. Se ali as duas ligam ao mesmo tempo (capacidade, não
-- rodízio), desmarcar o 27 na tela é uma caixa de marcar.
update equipamentos set redundante = true
 where id in (27,28);

-- Conferência (esperado: inverter 19, redundante 16, automacao 0):
-- select count(*) filter (where inverter)   as inverter,
--        count(*) filter (where redundante) as redundante,
--        count(*) filter (where automacao)  as automacao
--   from equipamentos;
