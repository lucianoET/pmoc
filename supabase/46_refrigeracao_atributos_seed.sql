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
-- cabeçalho, o id 138 repetido em 6 linhas e 4 linhas do PAIOL sem id
-- nenhum. A guarda de escopo (D-5hy-13) recusaria arquivar, corretamente,
-- e as 6 linhas do id 138 gravariam uma por cima da outra. Um `update`
-- por id é o que essa marcação é de verdade: 27 fatos sobre 27 linhas.
--
-- NÃO ADIVINHADO — três marcações de `redundante` do arquivo ficaram de
-- fora porque a linha não tem id e o par prédio+local não desempata
-- (PAIOL tem duas máquinas por câmara, e é exatamente a segunda de cada
-- par que está marcada):
--
--     PAIOL D-5   redundante  (linha sem id; par do equipamento 93)
--     PAIOL K-6   redundante  (linha sem id; par do equipamento 94)
--     PAIOL R-7   redundante  (linha sem id; sem par cadastrado)
--
-- Essas três se resolvem na tela, marcando o checkbox na ficha do
-- equipamento certo — que é mais barato do que eu escolher um id e
-- errar em silêncio.
--
-- `automacao` não recebe nenhuma linha: o usuário ainda não marcou
-- nenhum equipamento como controlável por automação, e escrever `false`
-- em 175 linhas afirmaria uma conferência que não aconteceu (D-500-02).
--
-- Idempotente: rodar duas vezes toca as mesmas linhas com o mesmo valor.
-- Depende da migração 45.
-- ══════════════════════════════════════════════════════════════════

-- Inverter — 19 equipamentos (F21 e EXOCET).
update equipamentos
   set inverter = true
 where id in (127,128,129,130,131,138,140,141,142,143,144,145,
              163,167,169,172,173,174,175);

-- Redundante — 8 equipamentos (a segunda unidade de cada câmara do
-- PAIOL, mais o segundo split da sala do servidor do COMANDO).
update equipamentos
   set redundante = true
 where id in (28,96,98,100,102,105,107,109);

-- Conferência (esperado: inverter 19, redundante 8, automacao 0):
-- select count(*) filter (where inverter)   as inverter,
--        count(*) filter (where redundante) as redundante,
--        count(*) filter (where automacao)  as automacao
--   from equipamentos;
