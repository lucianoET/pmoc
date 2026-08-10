-- ═══════════════════════════════════════════════════════════════════
-- 20 — Prédios e salas reais do CMASM, derivados da Refrigeração
--
-- Os 29 prédios e 132 salas do CMASM só existiam como texto em
-- `equipamentos.predio` / `equipamentos.local` (171 unidades de climatização).
-- Aqui eles viram nós de `cmasm_locais` sob a raiz CMASM (id 151) e os
-- equipamentos passam a apontar para a sala por FK.
--
-- É derivado por SELECT, não digitado: rodar de novo depois de cadastrar
-- equipamentos em prédios novos cria só o que faltava.
--
-- Códigos seguem o padrão do ERP de referência: REFRI-<PRÉDIO>-<SALA>.
-- Executar depois da migração 19.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── prédios (filhos diretos da raiz CMASM) ──
insert into cmasm_locais (codigo, nome, tipo, parent_id, restricao, descricao)
select distinct
  'REFRI-' || e.predio,
  e.predio,
  'edificacao',
  151,
  'militar',
  'Área ' || coalesce(e.area, 'não informada') || ' · derivado da Refrigeração'
from equipamentos e
where e.predio is not null and btrim(e.predio) <> ''
on conflict (codigo) do nothing;

-- ── salas / ambientes (filhos do prédio) ──
insert into cmasm_locais (codigo, nome, tipo, parent_id, restricao, descricao)
select distinct
  'REFRI-' || e.predio || '-' || e.local,
  e.local,
  'sala',
  p.id,
  'militar',
  'Derivado da Refrigeração'
from equipamentos e
join cmasm_locais p on p.codigo = 'REFRI-' || e.predio
where e.predio is not null and btrim(e.predio) <> ''
  and e.local is not null and btrim(e.local) <> ''
on conflict (codigo) do nothing;

-- ── liga cada equipamento à sua sala (ou ao prédio, se não tiver sala) ──
update equipamentos e
set local_id = s.id
from cmasm_locais s
where e.local_id is null
  and e.local is not null
  and s.codigo = 'REFRI-' || e.predio || '-' || e.local;

update equipamentos e
set local_id = p.id
from cmasm_locais p
where e.local_id is null
  and e.predio is not null
  and p.codigo = 'REFRI-' || e.predio;

commit;

-- Conferência:
--   select count(*) from cmasm_locais where tipo = 'edificacao';        -- 29
--   select count(*) from cmasm_locais where tipo = 'sala';              -- 132
--   select count(*) from equipamentos where local_id is null;           -- 0
--   -- prédios com mais ambientes:
--   select p.nome, count(*) from cmasm_locais s
--     join cmasm_locais p on p.id = s.parent_id
--    where s.tipo = 'sala' group by p.nome order by 2 desc limit 10;
