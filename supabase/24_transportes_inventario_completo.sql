-- ═══════════════════════════════════════════════════════════════════
-- 24 — PMOC Transportes — inventário completo da frota (mapa VTR/EMB 20FEV2026)
-- Migração aditiva e reexecutável. Executar no SQL Editor do Supabase.
--
-- MOTIVO: o seed 11 importou apenas os 9 ativos que apareciam na
-- "Programação de Viaturas de Rotina" (ref/Mapa de VTR e EMB ATU 20FEV26.csv),
-- que é um registro de VIAGENS, não o inventário. O inventário real está no
-- mapa "Mapa de VTR e EMB ATU 20FEV26.pdf" e tem 43 ativos: 33 viaturas
-- (24 VTR INT + 9 VTR EXT) e 10 embarcações (CMASM 01-12 + DSAM 01).
--
-- Esta migração acrescenta os 34 ativos ausentes e corrige os 9 já importados.
-- Grava com "on conflict (codigo)" — reexecutar não duplica.
--
-- Convenções adotadas (decisões de importação, ver relatório de conferência):
--   · PDF "P"    → status 'disponivel'
--   · PDF "INOP" → status 'indisponivel'; a restrição do mapa vai para observacoes
--   · PDF "XXX"  → identificacao NULL (equipamento sem placa), nunca a string 'XXX'
--   · unidade_uso: 'h' para o que se controla por horímetro (embarcação,
--     empilhadeira, trator, guindaste) e 'km' para o rodoviário. Semi-reboque
--     não tem motor nem hodômetro: fica 'km' com uso_atual 0, apenas porque a
--     coluna é NOT NULL — não há controle de uso previsto para ele.
--   · tipo_modelo agrupa por família de equipamento, que é como transp_planos
--     vincula plano de manutenção ao ativo (migração 22).
--
-- Não remove nem altera nenhum objeto de Refrigeração ou Máquinas.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Correção dos 9 ativos já importados ──
-- Placas que existiam no mapa mas não no CSV de viagens.
update transp_ativos set identificacao = 'KYI 9496' where codigo = 'VTR-003';
update transp_ativos set identificacao = 'KWL 8894' where codigo = 'VTR-004';
update transp_ativos set identificacao = 'LQW 2865' where codigo = 'VTR-005';

-- VTR-006 tinha a descrição "GUINDASTE" gravada no campo de placa; o guindaste
-- XCMG RT35 não tem placa no mapa.
update transp_ativos set identificacao = null where codigo = 'VTR-006' and identificacao = 'GUINDASTE';

-- Estado operacional divergente do mapa de 20FEV2026.
update transp_ativos set status = 'indisponivel',
  observacoes = 'INOP no mapa de 20FEV2026: aquecimento.'
  where codigo = 'EMB-001';
update transp_ativos set status = 'indisponivel',
  observacoes = 'INOP no mapa de 20FEV2026: NEC de manutenção corretiva no braço hidráulico. VRF com SG José Rodrigo em 14/05/25.'
  where codigo = 'VTR-001';

-- Classificação e família dos 9 já existentes.
update transp_ativos set subtipo = 'VTR INT', tipo_modelo = 'CAMINHAO MUNCK IVECO VERTIS' where codigo = 'VTR-001';
update transp_ativos set subtipo = 'VTR EXT', tipo_modelo = 'CAMIONETE'                    where codigo = 'VTR-002';
update transp_ativos set subtipo = 'VTR EXT', tipo_modelo = 'AMBULANCIA'                   where codigo = 'VTR-003';
update transp_ativos set subtipo = 'VTR EXT', tipo_modelo = 'FURGAO LEVE'                  where codigo = 'VTR-004';
update transp_ativos set subtipo = 'VTR INT', tipo_modelo = 'CAMINHAO'                     where codigo = 'VTR-005';
update transp_ativos set subtipo = 'VTR INT', tipo_modelo = 'GUINDASTE', unidade_uso = 'h' where codigo = 'VTR-006';
update transp_ativos set subtipo = 'ETP-M',   tipo_modelo = 'EMBARCACAO TRANSPORTE'        where codigo = 'EMB-001';
update transp_ativos set subtipo = 'LEG-M',   tipo_modelo = 'EMBARCACAO TRANSPORTE'        where codigo = 'EMB-002';
update transp_ativos set subtipo = 'BPAb',    tipo_modelo = 'EMBARCACAO PATRULHA'          where codigo = 'EMB-003';

-- ── 2. Embarcações ausentes (7) ──
insert into transp_ativos (codigo, nome, tipo, subtipo, identificacao, tipo_modelo, unidade_uso, status, observacoes) values
  ('EMB-004', 'LR-M-NP CISNE',              'embarcacao', 'LR-M-NP', 'CMASM 01', 'EMBARCACAO TRANSPORTE', 'h', 'indisponivel', 'INOP no mapa de 20FEV2026: NEC revisão geral do motor.'),
  ('EMB-005', 'ETP RAPOSO',                 'embarcacao', 'ETP',     'CMASM 03', 'EMBARCACAO TRANSPORTE', 'h', 'indisponivel', 'INOP no mapa de 20FEV2026: fora da água, falha no motor e carburador.'),
  ('EMB-006', 'ECSR-P PÓLUX',               'embarcacao', 'ECSR-P',  'CMASM 06', 'EMBARCACAO SALVAMENTO', 'h', 'indisponivel', 'INOP no mapa de 20FEV2026: fora da água, falha no motor. Parte estrutural também avariada.'),
  ('EMB-007', 'BPAb BACAMARTE',             'embarcacao', 'BPAb',    'CMASM 09', 'EMBARCACAO PATRULHA',   'h', 'indisponivel', 'INOP no mapa de 20FEV2026: manutenção corretiva do sistema de descarga dos gases do motor.'),
  ('EMB-008', 'BPAb MIGUEL DOS SANTOS',     'embarcacao', 'BPAb',    'CMASM 11', 'EMBARCACAO PATRULHA',   'h', 'disponivel',   null),
  ('EMB-009', 'ECSR-P SERRA',               'embarcacao', 'ECSR-P',  'CMASM 12', 'EMBARCACAO SALVAMENTO', 'h', 'indisponivel', 'INOP no mapa de 20FEV2026: fora da água, necessidade de manutenção geral corretiva de motor, rabeta e parte estrutural.'),
  ('EMB-010', 'ETP-NP BAIONETA',            'embarcacao', 'ETP-NP',  'DSAM 01',  'EMBARCACAO TRANSPORTE', 'h', 'indisponivel', 'INOP no mapa de 20FEV2026: sistema de governo e avaria no conjunto do esticador da correia poli V. Pertence à DSAM.')
on conflict (codigo) do nothing;

-- ── 3. Viaturas externas ausentes (6) ──
insert into transp_ativos (codigo, nome, tipo, subtipo, identificacao, tipo_modelo, unidade_uso, status, observacoes) values
  ('VTR-007', 'FRONTIER',                   'viatura', 'VTR EXT', 'KOU 6C24', 'CAMIONETE',                   'km', 'disponivel',   null),
  ('VTR-008', 'CLIO',                       'viatura', 'VTR EXT', 'LPC 2935', 'AUTOMOVEL',                   'km', 'indisponivel', 'INOP no mapa de 20FEV2026: necessidade de manutenção corretiva no sistema de injeção.'),
  ('VTR-009', 'MICRO-ÔNIBUS',               'viatura', 'VTR EXT', 'LBO 8418', 'ONIBUS',                      'km', 'indisponivel', 'INOP no mapa de 20FEV2026: LVAD.'),
  ('VTR-010', 'CAMINHÃO IVECO DAILY',       'viatura', 'VTR EXT', 'LLV 6081', 'CAMINHAO',                    'km', 'indisponivel', 'INOP no mapa de 20FEV2026: NEC MNT no sistema de combustível.'),
  ('VTR-011', 'CAMINHÃO MUNCK IVECO VERTIS','viatura', 'VTR EXT', 'KPJ 8382', 'CAMINHAO MUNCK IVECO VERTIS', 'km', 'indisponivel', 'INOP no mapa de 20FEV2026: NEC MNT sistema de freio e carroceria.'),
  ('VTR-012', 'FIAT DUCATO',                'viatura', 'VTR EXT', 'JKH 9973', 'FURGAO',                      'km', 'disponivel',   'P no mapa de 20FEV2026, com ressalva: NEC manutenção corretiva e preventiva de motor, suspensão e ar-condicionado. A VTR está na empresa JOMAP (oficina) para delineamento. Retorno ASD.')
on conflict (codigo) do nothing;

-- ── 4. Viaturas internas ausentes (21) ──
insert into transp_ativos (codigo, nome, tipo, subtipo, identificacao, tipo_modelo, unidade_uso, status, observacoes) values
  ('VTR-013', 'DOBLO 1.8',                    'viatura', 'VTR INT', 'LKT 5636', 'FURGAO LEVE',   'km', 'indisponivel', 'INOP no mapa de 20FEV2026.'),
  ('VTR-014', 'SAVEIRO',                      'viatura', 'VTR INT', 'LPD 8627', 'UTILITARIO',    'km', 'indisponivel', 'INOP no mapa de 20FEV2026: avaria na descarga. Necessidade de reparo pela equipe do apoio.'),
  ('VTR-015', 'CAMINHÃO BOMBEIRO',            'viatura', 'VTR INT', 'LQP 7633', 'CAMINHAO',      'km', 'disponivel',   null),
  ('VTR-016', 'CAMINHÃO VW 7100',             'viatura', 'VTR INT', 'LCE 6221', 'CAMINHAO',      'km', 'indisponivel', 'INOP no mapa de 20FEV2026: sistema de embreagem.'),
  ('VTR-017', 'EMPILHADEIRA JTC "Jumenta"',   'viatura', 'VTR INT', null,       'EMPILHADEIRA',  'h',  'indisponivel', 'INOP no mapa de 20FEV2026: necessidade de manutenção corretiva no sistema de carburação.'),
  ('VTR-018', 'EMPILHADEIRA YALE "Brocoió"',  'viatura', 'VTR INT', null,       'EMPILHADEIRA',  'h',  'indisponivel', 'INOP no mapa de 20FEV2026.'),
  ('VTR-019', 'EMPILHADEIRA XGMA "Enguia"',   'viatura', 'VTR INT', null,       'EMPILHADEIRA',  'h',  'indisponivel', 'INOP no mapa de 20FEV2026.'),
  ('VTR-020', 'EMPILHADEIRA XGMA "Poraquê"',  'viatura', 'VTR INT', null,       'EMPILHADEIRA',  'h',  'indisponivel', 'INOP no mapa de 20FEV2026.'),
  ('VTR-021', 'TRATOR AGRALE "Taturana"',     'viatura', 'VTR INT', null,       'TRATOR',        'h',  'disponivel',   null),
  ('VTR-022', 'TRATOR AGRALE "Batoré"',       'viatura', 'VTR INT', null,       'TRATOR',        'h',  'indisponivel', 'INOP no mapa de 20FEV2026.'),
  ('VTR-023', 'GUINDASTE GROVE',              'viatura', 'VTR INT', null,       'GUINDASTE',     'h',  'indisponivel', 'INOP no mapa de 20FEV2026.'),
  ('VTR-024', 'CARRO ELÉTRICO',               'viatura', 'VTR INT', null,       'CARRO ELETRICO','km', 'disponivel',   null),
  ('VTR-025', 'SEMI-REBOQUE 12T GIRO 180°',   'viatura', 'VTR INT', null,       'SEMI-REBOQUE',  'km', 'disponivel',   'Rebocado: sem motor, sem hodômetro e sem controle de uso previsto.'),
  ('VTR-026', 'SEMI-REBOQUE 12T GIRO 90°',    'viatura', 'VTR INT', null,       'SEMI-REBOQUE',  'km', 'disponivel',   'Rebocado: sem motor, sem hodômetro e sem controle de uso previsto.'),
  ('VTR-027', 'SEMI-REBOQUE 500KG "Tico"',    'viatura', 'VTR INT', null,       'SEMI-REBOQUE',  'km', 'disponivel',   'Rebocado: sem motor, sem hodômetro e sem controle de uso previsto.'),
  ('VTR-028', 'SEMI-REBOQUE 500KG "Teco"',    'viatura', 'VTR INT', null,       'SEMI-REBOQUE',  'km', 'disponivel',   'Rebocado: sem motor, sem hodômetro e sem controle de uso previsto.'),
  ('VTR-029', 'TOYOTA',                       'viatura', 'VTR INT', 'LBO 9668', 'CAMIONETE',     'km', 'disponivel',   'Mapa de 20FEV2026: 06AGO, VRF com a segurança que a VTR está P.'),
  ('VTR-030', 'TRATOR SOLIS "Besouro"',       'viatura', 'VTR INT', null,       'TRATOR',        'h',  'indisponivel', 'INOP no mapa de 20FEV2026: NEC manutenção corretiva no sistema de combustível, embreagem e motor.'),
  ('VTR-031', 'TRATOR SOLIS "Formigão"',      'viatura', 'VTR INT', null,       'TRATOR',        'h',  'indisponivel', 'INOP no mapa de 20FEV2026: NEC manutenção corretiva no sistema de combustível e embreagem.'),
  ('VTR-032', 'KOMBI',                        'viatura', 'VTR INT', 'LKN 1629', 'FURGAO',        'km', 'indisponivel', 'INOP no mapa de 20FEV2026.'),
  ('VTR-033', 'QUADRICICLO',                  'viatura', 'VTR INT', null,       'QUADRICICLO',   'km', 'indisponivel', 'INOP no mapa de 20FEV2026: necessita MNT no sistema de combustível.')
on conflict (codigo) do nothing;

-- ── 5. Conferência (rodar após aplicar) ──
-- Esperado: 43 ativos — 33 viaturas e 10 embarcações.
--   select tipo, count(*) from transp_ativos group by tipo order by tipo;
-- Esperado: 16 sem placa — 4 empilhadeiras, 4 tratores, 2 guindastes,
-- 4 semi-reboques, o carro elétrico e o quadriciclo. Todos VTR INT, e todos
-- sem placa no próprio mapa (coluna PLACA = "XXX"). Não é lacuna documental.
--   select codigo, nome from transp_ativos where identificacao is null order by codigo;
-- Esperado: 23 viagens preservadas.
--   select count(*) from transp_viagens;
