-- ══════════════════════════════════════════════════════════════════
-- 33 — Vínculo material ↔ serviço
--
-- Pedido da oficina: ao lançar uma peça na OS, o serviço que a instala
-- entra junto; ao lançar um serviço, as peças que ele consome entram
-- junto. Uma coluna só resolve os dois sentidos:
--
--   maq_materiais.servico_id → o serviço padrão daquela peça
--
-- · material → serviço: seguir a coluna
-- · serviço → materiais: todos os materiais cuja coluna aponta para ele
--
-- ponytail: um material tem no máximo UM serviço padrão. Se um dia uma
-- peça precisar de dois serviços, o caminho é uma tabela de ligação
-- N:N (maq_material_servicos) — não alargar esta coluna.
--
-- Migração aditiva. Aplicada em produção em 18/08/2026 — conferida contra
-- o banco: coluna bigint com a FK para rep_servicos, 0 de 34 materiais
-- vinculados (o vínculo é preenchido peça a peça no cadastro do estoque).
-- ══════════════════════════════════════════════════════════════════

alter table maq_materiais
  add column if not exists servico_id bigint references rep_servicos(id);

comment on column maq_materiais.servico_id is
  'Serviço padrão desta peça (rep_servicos). Ao lançar a peça numa OS, o serviço entra junto — e vice-versa.';
