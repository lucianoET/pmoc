-- 13 — Impede execução anônima da conclusão de operações
-- Aplicar após 12_maquinas_areas_operacoes.sql.

revoke execute on function concluir_maq_operacao(uuid,numeric,numeric,numeric,text) from anon;
grant execute on function concluir_maq_operacao(uuid,numeric,numeric,numeric,text) to authenticated;