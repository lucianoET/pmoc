-- ══════════════════════════════════════════════════════════════════
-- 36 — Calibração: carga inicial
--
-- GERADO por `node calibracao/gerar-seed.mjs` a partir das constantes
-- LABS, EQS, PS_INIT, LOTES_INIT e CATALOG_DEFAULT de
-- calibracao/index.html. Não edite à mão: rode o gerador de novo.
--
-- É o estado de fábrica que o módulo mostrava a quem abrisse com o
-- localStorage vazio. Quem já vinha usando o módulo tem dados mais
-- recentes no próprio navegador — a tela Dados exporta o JSON e a
-- importação recoloca por cima destes, agora no banco.
--
-- `on conflict do nothing` em tudo: reaplicar não duplica nem
-- sobrescreve trabalho já feito no banco.
-- ══════════════════════════════════════════════════════════════════

insert into cal_labs (id, code, nome, tipo, acred, esp, obs, ativo) values
  ('cms', 'CMS', 'CMS — Centro de Metrologia da Marinha', 'marinha', 'RBC/INMETRO', array['Elétrico', 'Eletrônico', 'Dimensional', 'Temperatura'], null, true),
  ('bacs', 'BACS', 'BACS — Base de Abastecimento da Marinha', 'marinha', 'RBC/INMETRO', array['Pressão (água salgada)', 'Mecânico'], null, true),
  ('mv', 'MV', 'MV Metrologia', 'pregao', 'RBC', array['Mecânico', 'Pressão', 'Torquímetros', 'Dimensional'], null, true),
  ('mqt', 'MQT', 'MQT Metrologia', 'pregao', 'RBC', array['Dimensional', 'Manômetros', 'Micrometros'], null, true),
  ('msmi', 'MSMI', 'MSMI — Metrologia e Serviços', 'pregao', 'Rastreável INMETRO', array['Torquímetros', 'Paquímetros'], null, true),
  ('lmc', 'LMC', 'LMC — Lab. de Metrologia', 'pregao', 'RBC', array['Temperatura', 'Pressão digital'], null, true),
  ('ametek', 'AMETEK', 'AMETEK Sigton (São Paulo)', 'autorizada', 'Fabricante exclusivo', array['Deadweight Tester', 'Fontes AMETEK'], 'ATENÇÃO: Única empresa autorizada AMETEK. Fora do pregão padrão. Solicitar orçamento direto.', true),
  ('ipt', 'IPT', 'IPT São Paulo — NI Certified Center', 'autorizada', 'NI Certified Center', array['NI PXI', 'NI PXIE', 'National Instruments'], 'ATENÇÃO: Único NI Certified Center no Brasil. Obrigatório para equipamentos NI. Fora do pregão.', true)
on conflict (id) do nothing;

insert into cal_equipamentos (id, sn, pat, cat, tipo, fab, mod, faixa, div, lab_id, per, ult, prox, cert, status, custo_cal, custo_rep, rest, obs, local, grandeza, resol, classe, ema, u_cal, fw, verif_int, ativo) values
  ('e001', null, 'F21-DPROBE-01', 'ELE', 'Differential Probe', 'TESTEC', 'TT-SI 9001', null, 'F-21', 'cms', 12, '2024-03-12', '2025-03-12', '2142016/2024', 'CALIBRADO', 373.83, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e002', null, 'F21-FONTDC-AMXG', 'ELE', 'Fonte DC', 'AMETEK', 'XG 300-2.8', '300V/2.8A', 'F-21', 'mqt', 12, '2024-12-12', '2025-12-12', '2142107/2024', 'CALIBRADO', 1164.35, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e003', null, 'F21-FONTDC-AMSG', 'ELE', 'Fonte DC', 'AMETEK', 'SGA-600625D', '600V/25A', 'F-21', 'ametek', 12, '2021-01-26', null, null, 'DESCALIBRADO', 560.75, 0, 'Calibração exclusiva AMETEK Sigton (SP). NÃO pode ir ao CMS ou pregão.', null, null, null, null, null, null, null, null, null, true),
  ('e004', null, 'F21-NIPXIE', 'ELE', 'Multímetro NI PXIe', 'NI', 'PXIE-4080', '24 bits', 'F-21', 'ipt', 24, '2020-08-03', null, null, 'DESCALIBRADO', 560.75, 0, 'Somente NI Certified Center — IPT São Paulo. Fora do pregão.', null, null, null, null, null, null, null, null, null, true),
  ('e005', null, 'F21-NIPXI-5122', 'ELE', 'Osciloscópio PXI NI', 'NI', 'NI-PXI-5122', '24 bits', 'F-21', 'ipt', 24, '2022-09-27', null, null, 'DESCALIBRADO', 776.23, 0, 'Somente NI Certified Center — IPT São Paulo. Fora do pregão.', null, null, null, null, null, null, null, null, null, true),
  ('e006', null, 'F21-MULT-FK711-1', 'ELE', 'Multímetro', 'FACOM', '711B', null, 'F-21', 'cms', 12, '2024-12-12', '2025-12-12', '2142109/2024', 'CALIBRADO', 1164.35, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e007', null, 'F21-MULT-FK711-2', 'ELE', 'Multímetro', 'FACOM', '711B', null, 'F-21', 'cms', 12, null, null, null, 'NAO_UTILIZADO', 776.23, 0, null, 'Ferramenta não utilizada — avaliar descarte', null, null, null, null, null, null, null, null, true),
  ('e008', null, 'F21-MULT-FL17B', 'ELE', 'Multímetro', 'FLUKE', '17B+', null, 'F-21', 'cms', 12, '2025-02-04', '2026-02-04', '2142004/2025', 'CALIBRADO', 776.23, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e009', null, 'F21-MULT6D-KS1', 'ELE', 'Multímetro 6 Dígitos', 'KEYSIGHT', '34461A', null, 'F-21', 'cms', 12, '2023-05-12', '2025-05-12', '2142036/2023', 'CALIBRADO', 667.04, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e010', null, 'F21-MAGOHM-FL', 'ELE', 'Megôhmetro', 'FLUKE', '1507', '10GΩ', 'F-21', 'mqt', 12, '2024-10-03', '2025-10-03', 'MQT31184/24', 'CALIBRADO', 373.83, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e011', null, 'F21-PAQ-FK805-1', 'MEC', 'Paquímetro', 'FACOM', '805.1', '0-150mm', 'F-21', 'mv', 12, '2024-10-22', '2025-10-22', null, 'SEM_CERTIFICADO', 84.33, 0, null, 'MSMI LOTE 01 — falta certificado físico', null, null, null, null, null, null, null, null, true),
  ('e012', null, 'F21-MIC-FK806', 'MEC', 'Micrometro Prof.', 'FACOM', '806.F', '0-25mm', 'F-21', 'mqt', 12, '2024-09-30', '2025-09-30', 'MQT31051/24', 'CALIBRADO', 84.33, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e013', null, 'EXO-ESPECT-RS', 'ELE', 'Analisador de Espectro', 'R&S', 'FSL18', '10Hz-18GHz', 'EXOCET', 'cms', 12, '2024-09-13', '2025-09-13', '2142090/2024', 'CALIBRADO', 3104.95, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e014', null, 'EXO-GERFUN-AG33', 'ELE', 'Gerador de Funções', 'AGILENT', '33220A', '20MHz', 'EXOCET', 'cms', 12, '2024-09-10', '2025-09-10', '2142088/2024', 'CALIBRADO', 1552.47, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e015', null, 'EXO-OSCI-TDS210', 'ELE', 'Osciloscópio', 'TEKTRONIX', 'TDS210', '60MHz', 'EXOCET', 'cms', 12, '2023-11-10', '2025-11-10', '2142116/2023', 'CALIBRADO', 747.66, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e016', null, 'EXO-OHM-AGI', 'ELE', 'Ohmímetro', 'AGI', '1681A', null, 'EXOCET', 'mv', 12, '2024-11-12', '2025-11-12', null, 'SEM_CERTIFICADO', 776.23, 0, null, 'MSMI LOTE 02 — falta certificado', null, null, null, null, null, null, null, null, true),
  ('e017', null, 'T46-CONT-HP5328-1', 'ELE', 'Contador', 'HP', '5328B', '500MHz', 'MK-46', 'cms', 12, '2023-08-10', '2025-08-10', '2142076/2023', 'CALIBRADO', 1552.47, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e018', null, 'T46-CONT-HP5328-2', 'ELE', 'Contador', 'HP', '5328B', '500MHz', 'MK-46', 'cms', 12, null, null, null, 'DESCALIBRADO', 4269.3, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e019', null, 'T46-CONT-HP5328-3', 'ELE', 'Contador', 'HP', '5328B', '500MHz', 'MK-46', 'cms', 12, null, null, null, 'EM_REPARO', 1552.47, 500, null, 'Em reparo CMS', null, null, null, null, null, null, null, null, true),
  ('e020', null, 'T46-GERFUN-HP3325', 'ELE', 'Gerador de Funções', 'HP', '3325B', '20MHz', 'MK-46', 'cms', 12, '2023-11-14', '2025-11-14', '2142012/2024', 'CALIBRADO', 1869.16, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e021', null, 'T46-GERFUN-RACAL', 'ELE', 'Gerador de Funções', 'RACAL', '3152B VXI', null, 'MK-46', 'mqt', 12, null, null, null, 'DESCALIBRADO', 1552.47, 0, null, 'CMS NÃO CALIBRA — encaminhar MQT', null, null, null, null, null, null, null, null, true),
  ('e022', null, 'T46-CONT-AST-1', 'ELE', 'Contador', 'ASTRONICS', '2461-CD', null, 'MK-46', 'mqt', 12, null, null, null, 'DESCALIBRADO', 1552.47, 0, null, 'Não foi possível calibrar — verificar viabilidade', null, null, null, null, null, null, null, null, true),
  ('e023', null, 'T48-CALIB-FL5100-1', 'ELE', 'Calibrador Multifunção', 'FLUKE', '5100B', '7 fontes', 'MK-48', 'cms', 12, '2025-01-10', '2026-01-10', '2142002/2025', 'CALIBRADO', 3104.95, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e024', null, 'T48-CALIB-FL5100-2', 'ELE', 'Calibrador Multifunção', 'FLUKE', '5100B', '7 fontes', 'MK-48', 'cms', 12, '2023-01-19', '2025-01-19', null, 'DESCALIBRADO', 3104.95, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e025', null, 'T48-MAGOHM-TG', 'ELE', 'Megôhmetro', 'TEGAM', 'R1M-A', '36MΩ', 'MK-48', 'cms', 12, '2025-02-07', '2026-02-07', '2142010/2025', 'CALIBRADO', 674.72, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e026', null, 'T48-OSCI-THS730', 'ELE', 'Osciloscópio', 'TEKTRONIX', 'THS730A', '200MHz', 'MK-48', 'cms', 12, '2022-08-18', '2024-08-18', null, 'DESCALIBRADO', 747.66, 0, null, 'Descalibrado >3 anos (PS 046/2023)', null, null, null, null, null, null, null, null, true),
  ('e027', null, 'T48-DWT-AMETEK-1', 'MEC', 'Hydraulic Deadweight Tester', 'AMETEK', 'DM-T-100/C', '15000 PSI', 'MK-48', 'ametek', 24, '2017-10-18', null, null, 'DESCALIBRADO', 84.33, 0, 'Calibração exclusiva AMETEK Sigton (SP). NÃO pode ir ao CMS ou pregão.', 'Descalibrado desde 2017 (>8 anos)', null, null, null, null, null, null, null, null, true),
  ('e028', null, 'T48-DWT-AMETEK-2', 'MEC', 'Hydraulic Deadweight Tester', 'AMETEK', 'DM-T-100/C', '15000 PSI', 'MK-48', 'ametek', 24, '2017-04-04', null, null, 'DESCALIBRADO', 84.33, 0, 'Calibração exclusiva AMETEK Sigton (SP). NÃO pode ir ao CMS ou pregão.', 'Descalibrado desde 2017 (>8 anos)', null, null, null, null, null, null, null, null, true),
  ('e029', null, 'T48-IGNIT-101-1', 'ELE', 'Igniter Circuit Test', null, '101-5BFAA', '36V', 'MK-48', 'mv', 36, '2024-10-22', '2025-10-22', null, 'SEM_CERTIFICADO', 776.23, 0, null, 'MSMI LOTE 01 — falta certificado', null, null, null, null, null, null, null, null, true),
  ('e030', null, 'T48-AMPL-FL5220', 'ELE', 'Amplificador Transcond.', 'FLUKE', '5220A', '32A', 'MK-48', 'cms', 12, '2023-11-24', '2025-11-24', '2142130/2023', 'CALIBRADO', 776.23, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e031', null, 'T48-TERM-OMEGA', 'ELE', 'Termômetro Digital', 'OMEGA', 'HH11B', '750°C', 'MK-48', 'lmc', 12, '2024-10-03', '2025-10-03', 'CMASM-IDM-T48-062', 'CALIBRADO', 84.33, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e032', null, 'MST-FONTDC-HP6255', 'ELE', 'Fonte DC', 'HP', '6255A', '50V/10A', 'MISTRAL', 'cms', 12, '2024-12-18', '2025-12-18', '2142110/2024', 'CALIBRADO', 560.75, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e033', null, 'MST-MULT6D-KS34461', 'ELE', 'Multímetro 6 Dígitos', 'KEYSIGHT', '34461A', null, 'MISTRAL', 'cms', 12, '2017-10-05', null, null, 'EM_REPARO', 776.23, 800, null, 'Em reparo CMS desde 2017 (>7 anos) — avaliar descarte', null, null, null, null, null, null, null, null, true),
  ('e034', null, 'MB-MULT-FL77', 'ELE', 'Multímetro', 'FLUKE', '77DMM', null, 'MINAS E BOMBAS', 'cms', 12, '2023-11-09', '2025-11-09', '2142113/2023', 'CALIBRADO', 776.23, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e035', null, 'MB-MAN-FAM3', 'MEC', 'Manômetro Analógico', 'FAMABRAS', '0-3 kgf/cm²', '3 kgf/cm²', 'MINAS E BOMBAS', 'mqt', 24, '2024-01-24', '2026-01-24', 'P-006396', 'CALIBRADO', 90, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e036', null, 'EXO-TORQ-FACOM75', 'MEC', 'Torquímetro', 'FACOM', 'A-301 MT', '75 Nm', 'EXOCET', 'msmi', 12, '2024-09-16', '2025-09-16', '1643/23 MV', 'CALIBRADO', 100, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e037', null, 'T46-TORQ-SNPON', 'MEC', 'Torquímetro', 'SNAP-ON', 'TE250FU', '250 ft-lb', 'MK-46', 'msmi', 12, '2024-07-26', '2025-07-26', '218985/24', 'CALIBRADO', 100, 0, null, null, null, null, null, null, null, null, null, null, true),
  ('e038', null, 'T46-TORQ-UTICA', 'MEC', 'Torquímetro', 'UTICA', 'TCI-150', '15 Nm', 'MK-46', 'msmi', 12, null, null, null, 'DESCALIBRADO', 100, 0, null, 'MSMSI TORQ LOTE 05 DEZ', null, null, null, null, null, null, null, null, true)
on conflict (id) do nothing;

insert into cal_ps (id, num, eq_id, lab_id, tipo, status, emi, env, cal, ret, cert, res, valor_prev, valor_exec, nf, ctr, emitente, obs) values
  ('p001', 'PS-CMS-24-023', 'e001', 'cms', 'calibracao_rotina', 'CONCLUIDO', '2024-03-05', '2024-03-06', '2024-03-12', '2024-03-14', '2142016/2024', 'aprovado', 373.83, 373.83, null, null, 'Encarregado Metrologia', null),
  ('p002', 'PS-CMS-24-031', 'e002', 'mqt', 'calibracao_rotina', 'CONCLUIDO', '2024-08-23', '2024-08-24', '2024-12-12', '2025-01-31', '2142107/2024', 'aprovado', 1164.35, 1164.35, 'NF-2024-891', 'ATA-MQT/2024', 'Encarregado Metrologia', null),
  ('p003', 'PS-CMS-24-041', 'e006', 'cms', 'calibracao_rotina', 'CONCLUIDO', '2024-08-23', '2024-09-05', '2024-12-12', '2025-01-31', '2142109/2024', 'aprovado', 1164.35, 1164.35, null, null, 'Encarregado Metrologia', null),
  ('p004', 'PS-CMS-25-003', 'e023', 'cms', 'calibracao_rotina', 'CONCLUIDO', '2025-01-05', '2025-01-05', '2025-01-10', '2025-01-15', '2142002/2025', 'aprovado', 3104.95, 3104.95, 'NF-2025-012', 'ATA-CMS/2025', 'Encarregado Metrologia', null),
  ('p005', 'PS-CMS-25-007', 'e013', 'cms', 'calibracao_rotina', 'CONCLUIDO', '2024-08-21', '2024-08-22', '2024-09-13', '2024-09-16', '2142090/2024', 'aprovado', 3104.95, 3104.95, 'NF-2024-632', 'ATA-CMS/2024', 'Encarregado Metrologia', null),
  ('p006', 'PS-CMS-26-001', 'e024', 'cms', 'calibracao_rotina', 'ENVIADO', '2026-01-05', '2026-01-08', null, null, null, null, 3104.95, null, null, 'ATA-CMS/2026', 'Encarregado Metrologia', null),
  ('p007', 'PS-CMS-26-002', 'e003', 'ametek', 'calibracao_rotina', 'EMITIDO', '2026-01-15', null, null, null, null, null, 560.75, null, null, null, 'Encarregado Metrologia', 'ATENÇÃO: empresa autorizada AMETEK — solicitar orçamento direto'),
  ('p008', 'PS-CMS-26-003', 'e027', 'ametek', 'calibracao_rotina', 'EMITIDO', '2026-01-15', null, null, null, null, null, 84.33, null, null, null, 'Encarregado Metrologia', 'ATENÇÃO: empresa autorizada AMETEK — descalibrado desde 2017'),
  ('p009', 'PS-CMS-26-004', 'e004', 'ipt', 'calibracao_rotina', 'EMITIDO', '2026-01-20', null, null, null, null, null, 560.75, null, null, null, 'Encarregado Metrologia', 'ATENÇÃO: NI Certified Center — IPT SP'),
  ('p010', 'PS-CMS-26-005', 'e019', 'cms', 'reparo', 'EM_CALIBRACAO', '2026-01-05', '2026-01-08', null, null, null, null, 1552.47, null, null, 'ATA-CMS/2026', 'Encarregado Metrologia', 'Contador HP 5328B — em reparo'),
  ('p011', 'PS-CMS-26-006', 'e026', 'cms', 'calibracao_rotina', 'ENVIADO', '2026-01-20', '2026-01-22', null, null, null, null, 747.66, null, null, 'ATA-CMS/2026', 'Encarregado Metrologia', null),
  ('p012', 'PS-CMS-26-007', 'e001', 'cms', 'calibracao_rotina', 'EMITIDO', '2026-03-10', null, null, null, null, null, 373.83, null, null, null, 'Encarregado Metrologia', null)
on conflict (id) do nothing;

insert into cal_lotes (id, code, descricao, contrato, status, data, itens) values
  ('l1', 'LT2-2026-MQT-001', 'Lote 2/2026 — MQT principal', 'ATA MQT 129/2025', 'ENVIADO', '2026-03-01', '[]'::jsonb),
  ('l2', 'CMS-2026-001', 'Rodada CMS 2026 — especiais', 'CMS', 'EM_CALIBRACAO', '2026-02-10', '[]'::jsonb)
on conflict (id) do nothing;

insert into cal_catalogo (equip_tipo, ord, forn, contrato, preco, item, tipo) values
  ('TORQUÍMETRO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 70, '35', 'ata'),
  ('MULTÍMETRO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 165, '14', 'ata'),
  ('MULTÍMETRO', 1, 'CMS (interno)', 'CMS', 243.67, '—', 'interno'),
  ('MANÔMETRO ANALÓGICO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 65, '26', 'ata'),
  ('MANÔMETRO ANALÓGICO  BACS', 0, 'MQT Serviços', 'ATA MQT 129/2025', 140, '27', 'ata'),
  ('MICROMETRO DE PROFUNDIDADE', 0, 'MQT Serviços', 'ATA MQT 129/2025', 85, '31', 'ata'),
  ('PAQUÍMETRO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 45, '33', 'ata'),
  ('CONTADOR', 0, 'MQT Serviços', 'ATA MQT 129/2025', 450, '5', 'ata'),
  ('FONTE DC', 0, 'MQT Serviços', 'ATA MQT 129/2025', 180, '9', 'ata'),
  ('FONTE DC', 1, 'MQT (AMETEK propr.)', 'ATA MQT 129/2025', 350, '10', 'ata'),
  ('OSCILOSCÓPIO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 475, '18', 'ata'),
  ('MEGÔHMETRO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 260, '13', 'ata'),
  ('GERADOR DE FUNÇÕES', 0, 'MQT Serviços', 'ATA MQT 129/2025', 410, '11', 'ata'),
  ('OHMÍMETRO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 456, '17', 'ata'),
  ('DINAMÔMETRO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 240, '23', 'ata'),
  ('DINAMÔMETRO DIGITAL', 0, 'MQT Serviços', 'ATA MQT 129/2025', 228, '24', 'ata'),
  ('MANÔMETRO DIGITAL', 0, 'MQT Serviços', 'ATA MQT 129/2025', 70, '28', 'ata'),
  ('MANOVACUÔMETRO ANALÓGICO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 133, '29', 'ata'),
  ('MEDIDOR DE FLUXO / VALVULA DE ALIVIO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 199, '30', 'ata'),
  ('VÁLVULA DE ALÍVIO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 199, '30', 'ata'),
  ('NÍVEL LINEAR DE PRECISÃO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 80, '32', 'ata'),
  ('TERMÔMETRO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 65, '34', 'ata'),
  ('TERMÔMETRO DIGITAL', 0, 'MQT Serviços', 'ATA MQT 129/2025', 65, '34', 'ata'),
  ('DIFFERENTIAL PROBE', 0, 'MQT Serviços', 'ATA MQT 129/2025', 322, '7', 'ata'),
  ('ALICATE AMPERÍMETRO', 0, 'MQT Serviços', 'ATA MQT 129/2025', 240, '1', 'ata'),
  ('IGNITER CIRCUIT TEST', 0, 'CMS (interno)', 'CMS', 483.5, '—', 'interno'),
  ('GROUND STRAP TESTER', 0, 'CMS (interno)', 'CMS', 322.24, '—', 'interno'),
  ('ANALISADOR DE SEGURANÇA', 0, 'CMS (interno)', 'CMS', 967.01, '—', 'interno'),
  ('ANALISADOR DE ESPECTRO', 0, 'CMASM (interno)', 'CMASM', 1450.51, '—', 'interno'),
  ('BALANÇA DIGITAL', 0, 'Visomes', 'ATA Visomes 229/2025', 320, '—', 'ata')
on conflict (equip_tipo, ord) do nothing;
