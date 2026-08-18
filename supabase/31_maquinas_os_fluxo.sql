-- ══════════════════════════════════════════════════════════════════
-- 31 — Fluxo de oficina na OS: delineamento e espera
--
-- O fluxo pedido pela oficina tem cinco etapas:
--   Aberta (recepção) → Delineamento → Espera → Execução → Concluída
--
-- · Delineamento: o técnico diagnostica e lança na OS os materiais e
--   serviços necessários. Quem delineou e quando ficam registrados.
-- · Espera: OS delineada aguardando material ou técnico disponível.
-- · A BAIXA DE ESTOQUE acontece no INÍCIO DA EXECUÇÃO (não mais na
--   conclusão): a peça sai da prateleira quando o serviço começa.
--
-- Este arquivo troca o check de maq_os.status para acrescentar os dois
-- estados. É a primeira migração do projeto que substitui uma trava em
-- vez de só adicionar — nenhuma linha muda, nenhum valor antigo deixa de
-- ser aceito; a lista só cresce. O nome do constraint foi conferido em
-- produção (maq_os_status_check) antes de escrever o drop.
--
-- Aplicada em produção: (preencher a data ao rodar)
-- ══════════════════════════════════════════════════════════════════

alter table maq_os drop constraint if exists maq_os_status_check;
alter table maq_os add constraint maq_os_status_check
  check (status in ('pendente','delineamento','espera','em_andamento','concluida','cancelada'));

-- registro do delineamento: quem diagnosticou e quando encerrou
alter table maq_os add column if not exists delineado_por text;
alter table maq_os add column if not exists delineado_em timestamptz;

comment on column maq_os.delineado_por is
  'Nome de quem encerrou o delineamento (diagnóstico com materiais e serviços lançados).';
comment on column maq_os.delineado_em is
  'Momento em que o delineamento foi encerrado e a OS entrou em espera.';
