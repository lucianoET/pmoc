-- ═══════════════════════════════════════════════════════════════════
-- 15 — PMOC Elétrica — carga inicial vinda do app legado (eletrica.html)
-- Origem: TIPOS / DEFAULT_UNITS / DEFAULT_PARTS do app localStorage.
-- Idempotente: reexecutar não duplica nem zera estoque.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── ativos ──
insert into elet_ativos (codigo, nome, tipo, local, obs) values
  ('GER-01',  'GER-01',  'GERADOR',    'Sala de máquinas',        'Gerador principal'),
  ('GER-02',  'GER-02',  'GERADOR',    'Bloco Operacional',       'Gerador emergencial'),
  ('GER-03',  'GER-03',  'GERADOR',    'Paiol de Munição',        'Gerador do paiol'),
  ('QGBT-01', 'QGBT-01', 'QGBT',       'Subestação principal',    'Painel geral BT'),
  ('QGBT-02', 'QGBT-02', 'QGBT',       'Bloco Administrativo',    'Painel de distribuição'),
  ('QGBT-03', 'QGBT-03', 'QGBT',       'Galpão de manutenção',    'Painel de força'),
  ('QGBT-04', 'QGBT-04', 'QGBT',       'Centro de controle',      'Painel de emergência'),
  ('UPS-01',  'UPS-01',  'NOBREAK',    'Sala de servidores',      'Nobreak 10 kVA'),
  ('UPS-02',  'UPS-02',  'NOBREAK',    'Central de monitoramento','Nobreak 3 kVA'),
  ('UPS-03',  'UPS-03',  'NOBREAK',    'Sala de operações',       'Nobreak 6 kVA'),
  ('ILU-01',  'ILU-01',  'ILUMINACAO', 'Pátio principal',         'Refletores exteriores'),
  ('ILU-02',  'ILU-02',  'ILUMINACAO', 'Corredores',              'Iluminação de emergência'),
  ('ILU-03',  'ILU-03',  'ILUMINACAO', 'Área do cais',            'Torre de iluminação')
on conflict (codigo) do nothing;

-- ── materiais ──
insert into elet_materiais (codigo, nome, categoria, unidade, preco, estoque_minimo) values
  ('ELE-P01', 'Óleo 15W-40',              'lubrificante', 'L',  42.00,  4),
  ('ELE-P02', 'Filtro de óleo',           'mecanico',     'UN', 28.00,  3),
  ('ELE-P03', 'Terminal elétrico',        'eletrico',     'UN',  3.00, 20),
  ('ELE-P04', 'Bateria selada 12V/7Ah',   'eletrico',     'UN', 380.00, 2),
  ('ELE-P05', 'Fusível (sortido)',        'eletrico',     'UN',  8.00, 10),
  ('ELE-P06', 'Lâmpada LED 20W',          'iluminacao',   'UN', 18.00,  8),
  ('ELE-P07', 'Reator/driver LED',        'eletrico',     'UN', 35.00,  4),
  ('ELE-P08', 'Limpador dielétrico',      'quimico',      'UN', 26.00,  2),
  ('ELE-P09', 'Abraçadeira de nylon',     'fixacao',      'PC',  1.00, 50),
  ('ELE-P10', 'Correia do alternador',    'mecanico',     'UN', 85.00,  2),
  ('ELE-P11', 'Kit de juntas do motor',   'mecanico',     'UN', 190.00, 1)
on conflict (codigo) do nothing;

-- ── planos por tipo de ativo (intervalo em horas) ──
insert into elet_planos (codigo, tipo, nome, intervalo, ordem, descricao) values
  ('ELE-GE01', 'GERADOR',    'Troca de óleo e filtro',                    250, 1, 'Troca do óleo lubrificante e do filtro do grupo gerador'),
  ('ELE-GE02', 'GERADOR',    'Inspeção elétrica e banco de baterias',     500, 2, 'Reaperto de terminais, medição e teste do banco de baterias'),
  ('ELE-GE03', 'GERADOR',    'Revisão geral do grupo gerador',           1000, 3, 'Revisão completa: juntas, correias, arrefecimento e regulagem'),
  ('ELE-QB01', 'QGBT',       'Inspeção termográfica e reaperto',          180, 1, 'Termografia dos barramentos e reaperto de conexões'),
  ('ELE-QB02', 'QGBT',       'Limpeza técnica e revisão de barramentos',  720, 2, 'Limpeza dielétrica e revisão mecânica dos barramentos'),
  ('ELE-NB01', 'NOBREAK',    'Teste de autonomia e alarmes',              180, 1, 'Teste de transferência, autonomia e alarmes sonoros'),
  ('ELE-NB02', 'NOBREAK',    'Inspeção eletrônica e ventilação',          720, 2, 'Inspeção de placas, capacitores e sistema de ventilação'),
  ('ELE-IL01', 'ILUMINACAO', 'Inspeção de luminárias e circuito',         120, 1, 'Inspeção de luminárias, drivers e circuito de comando'),
  ('ELE-IL02', 'ILUMINACAO', 'Substituição preventiva de lâmpadas',       500, 2, 'Substituição preventiva das lâmpadas do conjunto')
on conflict (codigo) do nothing;

-- ── peças previstas em cada plano ──
insert into elet_plano_materiais (plano_id, material_id, quantidade)
select p.id, m.id, v.qtd
from (values
  ('ELE-GE01', 'ELE-P01', 8),   ('ELE-GE01', 'ELE-P02', 1),
  ('ELE-GE02', 'ELE-P03', 10),  ('ELE-GE02', 'ELE-P04', 2),
  ('ELE-GE03', 'ELE-P11', 1),   ('ELE-GE03', 'ELE-P10', 1),
  ('ELE-QB01', 'ELE-P09', 20),  ('ELE-QB01', 'ELE-P03', 10),
  ('ELE-QB02', 'ELE-P08', 1),
  ('ELE-NB01', 'ELE-P04', 2),
  ('ELE-NB02', 'ELE-P05', 4),
  ('ELE-IL01', 'ELE-P06', 4),   ('ELE-IL01', 'ELE-P07', 1),
  ('ELE-IL02', 'ELE-P06', 8)
) as v(plano_codigo, material_codigo, qtd)
join elet_planos p on p.codigo = v.plano_codigo
join elet_materiais m on m.codigo = v.material_codigo
on conflict (plano_id, material_id) do nothing;

commit;

-- Conferência:
--   select tipo, count(*) from elet_ativos group by tipo order by tipo;   -- 13 no total
--   select count(*) from elet_planos;                                      -- 9
--   select count(*) from elet_materiais;                                   -- 11
--   select count(*) from elet_plano_materiais;                             -- 14
