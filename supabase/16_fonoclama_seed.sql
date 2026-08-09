-- ═══════════════════════════════════════════════════════════════════
-- 16 — PMOC Fonoclama — carga inicial vinda do app legado (fonoclama.html)
-- Origem: TIPOS / UNIDADES_DEFAULT / PECAS_DEFAULT do app localStorage.
-- Sistema de sonorização PA 70V: amplificação, consoles, zonas e sirenes.
-- Idempotente: reexecutar não duplica nem zera estoque.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── ativos ──
insert into fono_ativos (codigo, nome, tipo, local, obs) values
  ('AMP-CPD-01',  'AMP-CPD-01',  'AMPLIFICADOR', 'CPD',                    'Rack da central de sonorização'),
  ('AMP-COM-02',  'AMP-COM-02',  'AMPLIFICADOR', 'Centro de operações',    'Amplificador redundante'),
  ('CON-MESA-01', 'CON-MESA-01', 'CONSOLE',      'Central de sonorização', 'Console principal de avisos gerais'),
  ('MIC-DESP-01', 'MIC-DESP-01', 'CONSOLE',      'Sala de serviço',        'Microfone de despacho'),
  ('AF-CORR-01',  'AF-CORR-01',  'ALTO_FALANTE', 'Bloco Administrativo',   'Corneta do corredor'),
  ('AF-PATIO-02', 'AF-PATIO-02', 'ALTO_FALANTE', 'Pátio operacional',      'Corneta do pátio'),
  ('AF-CAIS-03',  'AF-CAIS-03',  'ALTO_FALANTE', 'Área do cais',           'Corneta do cais'),
  ('L70-SETOR-A', 'L70-SETOR-A', 'LINHA_70V',    'Setor administrativo',   'Linha de distribuição 70V'),
  ('L70-SETOR-B', 'L70-SETOR-B', 'LINHA_70V',    'Setor operacional',      'Linha de distribuição 70V'),
  ('SIR-EMG-01',  'SIR-EMG-01',  'SIRENE',       'Pátio principal',        'Sirene de emergência')
on conflict (codigo) do nothing;

-- ── materiais ──
insert into fono_materiais (codigo, nome, categoria, unidade, preco, estoque_minimo) values
  ('FON-P01', 'Conector XLR',        'audio',   'UN', 22.00,  6),
  ('FON-P02', 'Cabo XLR',            'audio',   'M',   9.00, 20),
  ('FON-P03', 'Terminal de áudio',   'audio',   'UN',  2.00, 30),
  ('FON-P04', 'Limpador de contato', 'quimico', 'UN', 24.00,  2),
  ('FON-P05', 'Fusível',             'eletrico','UN',  6.00, 10),
  ('FON-P06', 'Cooler 12V',          'eletrico','UN', 35.00,  2),
  ('FON-P07', 'Cabo 2x1,5mm',        'audio',   'M',   5.50, 50),
  ('FON-P08', 'Relé',                'eletrico','UN', 18.00,  4),
  ('FON-P09', 'Suporte metálico',    'fixacao', 'UN', 16.00,  4),
  ('FON-P10', 'Conector de linha',   'audio',   'UN',  3.50, 20)
on conflict (codigo) do nothing;

-- ── planos por tipo de ativo (intervalo em horas de operação) ──
insert into fono_planos (codigo, tipo, nome, intervalo, ordem, descricao) values
  ('FON-AM01', 'AMPLIFICADOR', 'Inspeção de ventilação e conexões',        180, 1, 'Limpeza de dutos, coolers e reaperto das conexões de saída'),
  ('FON-AM02', 'AMPLIFICADOR', 'Teste de potência e distorção',            720, 2, 'Medição de potência entregue na linha e verificação de distorção'),
  ('FON-CO01', 'CONSOLE',      'Teste funcional de acionamento',           180, 1, 'Teste de acionamento, chaveamento de zonas e nível de sinal'),
  ('FON-CO02', 'CONSOLE',      'Revisão de cabeamento e contatos',         720, 2, 'Revisão do cabeamento, limpeza de contatos e teste de microfonia'),
  ('FON-AF01', 'ALTO_FALANTE', 'Inspeção de fixação e resposta sonora',    240, 1, 'Verificação de fixação, direcionamento e resposta sonora da corneta'),
  ('FON-L701', 'LINHA_70V',    'Teste de continuidade e isolação',         360, 1, 'Medição de continuidade, isolação e carga total da linha 70V'),
  ('FON-SI01', 'SIRENE',       'Teste de acionamento e intensidade',       180, 1, 'Teste de acionamento remoto e medição da intensidade sonora')
on conflict (codigo) do nothing;

-- ── peças previstas em cada plano ──
insert into fono_plano_materiais (plano_id, material_id, quantidade)
select p.id, m.id, v.qtd
from (values
  ('FON-AM01', 'FON-P01', 2),  ('FON-AM01', 'FON-P03', 8),
  ('FON-AM02', 'FON-P05', 2),  ('FON-AM02', 'FON-P06', 1),
  ('FON-CO01', 'FON-P02', 5),  ('FON-CO01', 'FON-P01', 2),
  ('FON-CO02', 'FON-P04', 1),
  ('FON-AF01', 'FON-P09', 1),  ('FON-AF01', 'FON-P10', 2),
  ('FON-L701', 'FON-P07', 20), ('FON-L701', 'FON-P10', 4),
  ('FON-SI01', 'FON-P05', 2),  ('FON-SI01', 'FON-P08', 1)
) as v(plano_codigo, material_codigo, qtd)
join fono_planos p on p.codigo = v.plano_codigo
join fono_materiais m on m.codigo = v.material_codigo
on conflict (plano_id, material_id) do nothing;

commit;

-- Conferência:
--   select tipo, count(*) from fono_ativos group by tipo order by tipo;   -- 10 no total
--   select count(*) from fono_planos;                                      -- 7
--   select count(*) from fono_materiais;                                   -- 10
--   select count(*) from fono_plano_materiais;                             -- 13
