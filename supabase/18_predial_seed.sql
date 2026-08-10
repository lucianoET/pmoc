-- ═══════════════════════════════════════════════════════════════════
-- 18 — PMOC Predial — carga inicial vinda do app legado xPredial
-- GERADO automaticamente a partir de DEV_ERP/cmms-predial:
--   database/seed_normas.sql · database/seed_locais_cmasm.sql · create_db.py
-- Não editar à mão — regerar com o script de importação.
-- Idempotente: reexecutar não duplica.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── normas ──
insert into pred_normas (codigo, titulo, orgao, ano, descricao) VALUES
  ('NBR 5674:2012',   'Manutenção de edificações — Requisitos para o sistema de gestão de manutenção', 'ABNT', 2012,
   'Define requisitos para o sistema de gestão de manutenção de edificações, incluindo planejamento, execução e controle de atividades de manutenção.'),
  ('NBR 16747:2020',  'Inspeção predial — Diretrizes, conceitos, terminologia e procedimento', 'ABNT', 2020,
   'Estabelece diretrizes, conceitos, terminologia e procedimentos para inspeção predial de edificações.'),
  ('NBR 15575:2013',  'Edificações habitacionais — Desempenho', 'ABNT', 2013,
   'Norma de desempenho para edificações residenciais. Define requisitos e critérios com base em requisitos do usuário.'),
  ('NBR 16280:2015',  'Reforma em edificações — Sistema de gestão de reformas — Requisitos', 'ABNT', 2015,
   'Estabelece requisitos para o sistema de gestão de reformas em edificações existentes.'),
  ('NBR 14037:2011',  'Diretrizes para elaboração de manuais de uso, operação e manutenção das edificações', 'ABNT', 2011,
   'Define diretrizes para elaboração e apresentação do manual de uso, operação e manutenção de edificações entregues ao usuário.'),
  ('NBR 9050:2020',   'Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos', 'ABNT', 2020,
   'Estabelece critérios e parâmetros técnicos a serem observados quanto ao projeto, construção, instalação e adaptação do meio urbano e rural para acessibilidade.'),
  ('NBR 6118:2014',   'Projeto de estruturas de concreto — Procedimento', 'ABNT', 2014,
   'Fixa as exigências e os princípios gerais que devem ser observados no projeto de estruturas de concreto simples, armado e protendido.'),
  ('NBR 13752:1996',  'Perícias de engenharia na construção civil e imóveis urbanos — Procedimento', 'ABNT', 1996,
   'Estabelece procedimento para realização de perícias de engenharia em construção civil e imóveis urbanos.'),
  ('NR-19',           'Explosivos — Norma Regulamentadora do Ministério do Trabalho', 'MTE', 2011,
   'Regulamenta a fabricação, utilização, transporte e armazenamento de explosivos. Aplicável aos paióis de armamento.'),
  ('IBAPE-NA:2012',   'Norma de Inspeção Predial Nacional', 'IBAPE', 2012,
   'Define roteiro prático para elaboração da inspeção predial, com classificação de irregularidades por grau de risco e uso da Matriz GUT.')
on conflict (codigo) do nothing;

-- ── locais do CMASM (ids preservados do legado; raiz = 151) ──
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(151,'CMASM-ROOT','ROOT','Centro de Mísseis e Armas Submarinas (CMASM)',
 'organizacao_raiz','OPE','militar',NULL)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(230,'CMASM-LOC-01','LOC-01','Ilha do Engenho - São Gonçalo/RJ','localizacao','OPE','militar',151),
(231,'CMASM-LOC-02','LOC-02','Cais Administrativo','area_externa','ADM','militar',151),
(232,'CMASM-LOC-03','LOC-03','Campo de Futebol','area_externa','APA','civil',151),
(233,'CMASM-LOC-04','LOC-04','Quadra de Vôlei','area_externa','APA','civil',151),
(234,'CMASM-LOC-05','LOC-05','Casa de Bombas','infraestrutura','OPE','militar',151)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(235,'CMASM-PAIOIS','PAIOIS','Complexo de Paióis de Armamento','complexo_paiol','OPE','reservado',151)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(236,'CMASM-PAIOL-01','PAIOL-01','Paiol de Armamento 01','paiol','OPE','reservado',235),
(237,'CMASM-PAIOL-02','PAIOL-02','Paiol de Armamento 02','paiol','OPE','reservado',235),
(238,'CMASM-PAIOL-03','PAIOL-03','Paiol de Armamento 03','paiol','OPE','reservado',235),
(239,'CMASM-PAIOL-04','PAIOL-04','Paiol de Armamento 04','paiol','OPE','reservado',235),
(240,'CMASM-PAIOL-05','PAIOL-05','Paiol de Armamento 05','paiol','OPE','reservado',235),
(241,'CMASM-PAIOL-06','PAIOL-06','Paiol de Armamento 06','paiol','OPE','reservado',235),
(242,'CMASM-PAIOL-07','PAIOL-07','Paiol de Armamento 07','paiol','OPE','reservado',235),
(243,'CMASM-PAIOL-08','PAIOL-08','Paiol de Armamento 08','paiol','OPE','reservado',235),
(244,'CMASM-PAIOL-09','PAIOL-09','Paiol de Armamento 09','paiol','OPE','reservado',235),
(245,'CMASM-PAIOL-10','PAIOL-10','Paiol de Armamento 10','paiol','OPE','reservado',235),
(246,'CMASM-PAIOL-11','PAIOL-11','Paiol de Armamento 11','paiol','OPE','reservado',235),
(247,'CMASM-PAIOL-12','PAIOL-12','Paiol de Armamento 12','paiol','OPE','reservado',235),
(248,'CMASM-PAIOL-13','PAIOL-13','Paiol de Armamento 13','paiol','OPE','reservado',235),
(249,'CMASM-PAIOL-14','PAIOL-14','Paiol de Armamento 14','paiol','OPE','reservado',235),
(250,'CMASM-PAIOL-15','PAIOL-15','Paiol de Armamento 15','paiol','OPE','reservado',235),
(251,'CMASM-PAIOL-16','PAIOL-16','Paiol de Armamento 16','paiol','OPE','reservado',235),
(252,'CMASM-PAIOL-17','PAIOL-17','Paiol de Armamento 17','paiol','OPE','reservado',235),
(253,'CMASM-PAIOL-18','PAIOL-18','Paiol de Armamento 18','paiol','OPE','reservado',235),
(254,'CMASM-PAIOL-19','PAIOL-19','Paiol de Armamento 19','paiol','OPE','reservado',235),
(255,'CMASM-PAIOL-20','PAIOL-20','Paiol de Armamento 20','paiol','OPE','reservado',235),
(256,'CMASM-PAIOL-21','PAIOL-21','Paiol de Armamento 21','paiol','OPE','reservado',235),
(257,'CMASM-PAIOL-22','PAIOL-22','Paiol de Armamento 22','paiol','OPE','reservado',235),
(258,'CMASM-PAIOL-23','PAIOL-23','Paiol de Armamento 23','paiol','OPE','reservado',235),
(259,'CMASM-PAIOL-24','PAIOL-24','Paiol de Armamento 24','paiol','OPE','reservado',235),
(260,'CMASM-PAIOL-25','PAIOL-25','Paiol de Armamento 25','paiol','OPE','reservado',235),
(261,'CMASM-PAIOL-26','PAIOL-26','Paiol de Armamento 26','paiol','OPE','reservado',235),
(262,'CMASM-PAIOL-27','PAIOL-27','Paiol de Armamento 27','paiol','OPE','reservado',235),
(263,'CMASM-PAIOL-28','PAIOL-28','Paiol de Armamento 28','paiol','OPE','reservado',235),
(264,'CMASM-PAIOL-29','PAIOL-29','Paiol de Armamento 29','paiol','OPE','reservado',235),
(265,'CMASM-PAIOL-30','PAIOL-30','Paiol de Armamento 30','paiol','OPE','reservado',235),
(266,'CMASM-PAIOL-31','PAIOL-31','Paiol de Armamento 31','paiol','OPE','reservado',235),
(267,'CMASM-PAIOL-32','PAIOL-32','Paiol de Armamento 32','paiol','OPE','reservado',235),
(268,'CMASM-PAIOL-33','PAIOL-33','Paiol de Armamento 33','paiol','OPE','reservado',235),
(269,'CMASM-PAIOL-34','PAIOL-34','Paiol de Armamento 34','paiol','OPE','reservado',235),
(270,'CMASM-PAIOL-35','PAIOL-35','Paiol de Armamento 35','paiol','OPE','reservado',235),
(271,'CMASM-PAIOL-36','PAIOL-36','Paiol de Armamento 36','paiol','OPE','reservado',235),
(272,'CMASM-PAIOL-37','PAIOL-37','Paiol de Armamento 37','paiol','OPE','reservado',235),
(273,'CMASM-PAIOL-38','PAIOL-38','Paiol de Armamento 38','paiol','OPE','reservado',235),
(274,'CMASM-PAIOL-39','PAIOL-39','Paiol de Armamento 39','paiol','OPE','reservado',235),
(275,'CMASM-PAIOL-40','PAIOL-40','Paiol de Armamento 40','paiol','OPE','reservado',235),
(276,'CMASM-PAIOL-41','PAIOL-41','Paiol de Armamento 41','paiol','OPE','reservado',235),
(277,'CMASM-PAIOL-42','PAIOL-42','Paiol de Armamento 42','paiol','OPE','reservado',235),
(278,'CMASM-PAIOL-43','PAIOL-43','Paiol de Armamento 43','paiol','OPE','reservado',235),
(279,'CMASM-PAIOL-44','PAIOL-44','Paiol de Armamento 44','paiol','OPE','reservado',235),
(280,'CMASM-PAIOL-45','PAIOL-45','Paiol de Armamento 45','paiol','OPE','reservado',235),
(281,'CMASM-PAIOL-46','PAIOL-46','Paiol de Armamento 46','paiol','OPE','reservado',235),
(282,'CMASM-PAIOL-47','PAIOL-47','Paiol de Armamento 47','paiol','OPE','reservado',235),
(283,'CMASM-PAIOL-48','PAIOL-48','Paiol de Armamento 48','paiol','OPE','reservado',235),
(284,'CMASM-PAIOL-49','PAIOL-49','Paiol de Armamento 49','paiol','OPE','reservado',235),
(285,'CMASM-PAIOL-50','PAIOL-50','Paiol de Armamento 50','paiol','OPE','reservado',235),
(286,'CMASM-PAIOL-51','PAIOL-51','Paiol de Armamento 51','paiol','OPE','reservado',235),
(287,'CMASM-PAIOL-52','PAIOL-52','Paiol de Armamento 52','paiol','OPE','reservado',235),
(288,'CMASM-PAIOL-53','PAIOL-53','Paiol de Armamento 53','paiol','OPE','reservado',235),
(289,'CMASM-PAIOL-54','PAIOL-54','Paiol de Armamento 54','paiol','OPE','reservado',235),
(290,'CMASM-PAIOL-55','PAIOL-55','Paiol de Armamento 55','paiol','OPE','reservado',235),
(291,'CMASM-PAIOL-56','PAIOL-56','Paiol de Armamento 56','paiol','OPE','reservado',235),
(292,'CMASM-PAIOL-57','PAIOL-57','Paiol de Armamento 57','paiol','OPE','reservado',235),
(293,'CMASM-PAIOL-58','PAIOL-58','Paiol de Armamento 58','paiol','OPE','reservado',235),
(294,'CMASM-PAIOL-59','PAIOL-59','Paiol de Armamento 59','paiol','OPE','reservado',235),
(295,'CMASM-PAIOL-60','PAIOL-60','Paiol de Armamento 60','paiol','OPE','reservado',235),
(296,'CMASM-PAIOL-61','PAIOL-61','Paiol de Armamento 61','paiol','OPE','reservado',235),
(297,'CMASM-PAIOL-62','PAIOL-62','Paiol de Armamento 62','paiol','OPE','reservado',235),
(298,'CMASM-PAIOL-63','PAIOL-63','Paiol de Armamento 63','paiol','OPE','reservado',235),
(299,'CMASM-PAIOL-64','PAIOL-64','Paiol de Armamento 64','paiol','OPE','reservado',235),
(300,'CMASM-PAIOL-65','PAIOL-65','Paiol de Armamento 65','paiol','OPE','reservado',235)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(152,'CMASM-01','01','Direção (CMASM-01)','direcao','ADM','militar',151),
(153,'CMASM-01.1','01.1','Gabinete do Diretor(a)','chefe_gabinete','ADM','militar',152),
(154,'CMASM-01.2','01.2','Assessoria de Inteligência','assessor','ADM','secreto',152),
(155,'CMASM-01.3','01.3','Assessoria Jurídica','assessor','ADM','militar',152),
(156,'CMASM-01.4','01.4','OSIC – Of. Segurança das Informações e Comunicações','assessor','ADM','reservado',152)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(157,'CMASM-02','02','Vice-Direção (CMASM-02)','vice_direcao','ADM','militar',151),
(158,'CMASM-02.1','02.1','Gabinete do Vice-Diretor(a)','chefe_gabinete','ADM','militar',157),
(159,'CMASM-SECOM','SECOM','Secretaria e Comunicações (SECOM)','encarregado_servico','ADM','militar',151),
(160,'CMASM-SECOM.1','SECOM.1','Seção de Mensagens','encarregado_secao','ADM','reservado',159),
(161,'CMASM-SECOM.2','SECOM.2','Seção de Expedientes','encarregado_secao','ADM','militar',159)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(162,'CMASM-SPD','SPD','Serviço de Processamento de Dados (SPD)','encarregado_servico','ADM','militar',157),
(163,'CMASM-SPD.1','SPD.1','Seção de Infraestrutura de Rede','encarregado_secao','ADM','militar',162),
(164,'CMASM-SPD.2','SPD.2','Seção de Manutenção de Hardware','encarregado_secao','ADM','militar',162),
(165,'CMASM-SPD.3','SPD.3','Seção de Telefonia e Enlace Rádio','encarregado_secao','ADM','militar',162)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(166,'CMASM-DINF','DINF','Departamento de Infraestrutura','chefe_departamento','ADM','militar',151),
(167,'CMASM-DINF.S','DINF.S','Secretário(a) do Depto de Infraestrutura','secretario_depto','ADM','militar',166)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(168,'CMASM-DPREF','DPREF','Divisão de Prefeitura','encarregado_divisao','APA','militar',151),
(169,'CMASM-DPREF.1','DPREF.1','Seção de Infraestrutura e Serviços Gerais','encarregado_secao','APA','militar',168),
(170,'CMASM-DPREF.2','DPREF.2','Seção de Transportes','encarregado_secao','APA','militar',168)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(171,'CMASM-DSEG','DSEG','Divisão de Segurança','encarregado_divisao','OPE','militar',151),
(172,'CMASM-DSEG.1','DSEG.1','Seção de Segurança de Área e Instalações','encarregado_secao','OPE','militar',171),
(173,'CMASM-DSEG.2','DSEG.2','Seção de Escoteria','encarregado_secao','OPE','militar',171),
(174,'CMASM-DSEG.3','DSEG.3','Seção de Controle de Avarias','encarregado_secao','OPE','militar',171)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(175,'CMASM-13','13','Divisão de Manutenção Especializada','encarregado_divisao','OPE','militar',151),
(176,'CMASM-13.1','13.1','Seção de Apoio Industrial','encarregado_secao','OPE','militar',175),
(177,'CMASM-13.2','13.2','Seção de Eletrônica','encarregado_secao','OPE','militar',175)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(178,'CMASM-DARM','DARM','Departamento de Armas','chefe_departamento','OPE','reservado',151),
(179,'CMASM-DARM.S','DARM.S','Secretário(a) do Depto de Armas','secretario_depto','OPE','reservado',178)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(180,'CMASM-GAMI','GAMI','Grupo de Apoio à Munição Inteligente','encarregado_grupo','OPE','reservado',151),
(181,'CMASM-GAMI.DMC','GAMI.DMC','Divisão de Material Controlado','encarregado_divisao','OPE','reservado',180),
(182,'CMASM-GAMI.DMC.1','GAMI.DMC.1','Seção de Controle de Material Explosivo','encarregado_secao','OPE','proibido',181),
(183,'CMASM-GAMI.DMC.2','GAMI.DMC.2','Seção de Sobressalentes Inertes','encarregado_secao','OPE','reservado',181),
(184,'CMASM-GAMI.DCE','GAMI.DCE','Divisão de Controle e Expedição','encarregado_divisao','OPE','reservado',180),
(185,'CMASM-GAMI.DCE.1','GAMI.DCE.1','Seção de Controle','encarregado_secao','OPE','reservado',184),
(186,'CMASM-GAMI.DCE.2','GAMI.DCE.2','Seção de Expedição','encarregado_secao','OPE','reservado',184)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(187,'CMASM-GAS','GAS','Grupo de Armas Submarinas','encarregado_grupo','OPE','secreto',151),
-- Torpedos Leves
(188,'CMASM-GAS.DTL','GAS.DTL','Divisão de Torpedos Leves','encarregado_divisao','OPE','secreto',187),
(189,'CMASM-GAS.DTL.1','GAS.DTL.1','Seção de Eletrônica MK-46','encarregado_secao','OPE','secreto',188),
(190,'CMASM-GAS.DTL.2','GAS.DTL.2','Seção de Mecânica MK-46','encarregado_secao','OPE','secreto',188),
-- Torpedos Pesados
(191,'CMASM-GAS.DTP','GAS.DTP','Divisão de Torpedos Pesados','encarregado_divisao','OPE','secreto',187),
(192,'CMASM-GAS.DTP.1','GAS.DTP.1','Seção de Acessórios MK-48','encarregado_secao','OPE','secreto',191),
(193,'CMASM-GAS.DTP.2','GAS.DTP.2','Seção de Eletrônica MK-48','encarregado_secao','OPE','secreto',191),
(194,'CMASM-GAS.DTP.3','GAS.DTP.3','Seção de Tanque MK-48','encarregado_secao','OPE','secreto',191),
(195,'CMASM-GAS.DTP.4','GAS.DTP.4','Seção de Propulsão MK-48','encarregado_secao','OPE','secreto',191),
(196,'CMASM-GAS.DTP.5','GAS.DTP.5','Seção de Mecânica F21','encarregado_secao','OPE','secreto',191),
(197,'CMASM-GAS.DTP.6','GAS.DTP.6','Seção de Eletrônica F21','encarregado_secao','OPE','secreto',191),
(198,'CMASM-GAS.DTP.7','GAS.DTP.7','Seção de Qualidade','encarregado_secao','OPE','secreto',191),
-- Minas e Bombas
(199,'CMASM-GAS.DMB','GAS.DMB','Divisão de Minas e Bombas','encarregado_divisao','OPE','secreto',187),
(200,'CMASM-GAS.DMB.1','GAS.DMB.1','Seção de Minas Mecânicas e Bombas','encarregado_secao','OPE','secreto',199),
(201,'CMASM-GAS.DMB.2','GAS.DMB.2','Seção de Minas Eletrônicas','encarregado_secao','OPE','secreto',199)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(202,'CMASM-GM','GM','Grupo de Mísseis','encarregado_grupo','OPE','secreto',151),
(203,'CMASM-GM.DMEF','GM.DMEF','Divisão de Mísseis Especiais e Foguetes','encarregado_divisao','OPE','secreto',202),
(204,'CMASM-GM.DMEF.1','GM.DMEF.1','Seção de Mísseis Especiais','encarregado_secao','OPE','secreto',203),
(205,'CMASM-GM.DMEF.2','GM.DMEF.2','Seção de Foguetes','encarregado_secao','OPE','secreto',203),
(206,'CMASM-GM.DME','GM.DME','Divisão de Mísseis Exocet','encarregado_divisao','OPE','secreto',202),
(207,'CMASM-GM.DME.1','GM.DME.1','Seção de Mísseis Exocet MM-40','encarregado_secao','OPE','secreto',206),
(208,'CMASM-GM.DME.2','GM.DME.2','Seção de Mísseis Exocet AM-39 e SM-39','encarregado_secao','OPE','secreto',206)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(209,'CMASM-DADM','DADM','Departamento de Administração','chefe_departamento','ADM','militar',151),
(210,'CMASM-DADM.S','DADM.S','Secretário(a) do Depto de Administração','secretario_depto','ADM','militar',209)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(211,'CMASM-DPES','DPES','Divisão de Pessoal','encarregado_divisao','ADM','militar',151),
(212,'CMASM-DPES.1','DPES.1','Seção de Pessoal Militar','encarregado_secao','ADM','militar',211),
(213,'CMASM-DPES.2','DPES.2','Seção de Pessoal Civil','encarregado_secao','ADM','militar',211),
(214,'CMASM-DPES.3','DPES.3','Seção de Adestramento','encarregado_secao','ADM','militar',211),
(215,'CMASM-DPES.4','DPES.4','Seção de Direitos Pecuniários','encarregado_secao','ADM','militar',211)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(216,'CMASM-DEF','DEF','Divisão de Execução Financeira','encarregado_divisao','ADM','militar',151),
(217,'CMASM-DEF.1','DEF.1','Seção de Gestão Financeira e Operação SIAFI','encarregado_secao','ADM','militar',216)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(218,'CMASM-DMUN','DMUN','Divisão de Municiamento','encarregado_divisao','OPE','militar',151),
(219,'CMASM-DMUN.1','DMUN.1','Seção de Subsistência','encarregado_secao','OPE','militar',218),
(220,'CMASM-DMUN.2','DMUN.2','Seção de Armazenagem de Gêneros','encarregado_secao','OPE','militar',218)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(221,'CMASM-DMAT','DMAT','Divisão de Material','encarregado_divisao','OPE','militar',151),
(222,'CMASM-DMAT.1','DMAT.1','Seção de Controle Patrimonial','encarregado_secao','OPE','militar',221),
(223,'CMASM-DMAT.2','DMAT.2','Seção de Almoxarifado','encarregado_secao','OPE','militar',221),
(224,'CMASM-DMAT.3','DMAT.3','Seção de Combustíveis, Lubrificantes e Graxas','encarregado_secao','OPE','militar',221)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(225,'CMASM-DOB','DOB','Divisão de Obtenção','encarregado_divisao','ADM','militar',151),
(226,'CMASM-DOB.1','DOB.1','Seção de Licitações e Contratos','encarregado_secao','ADM','militar',225)
on conflict (id) do nothing;
insert into pred_locais (id,codigo,neo,nome,tipo,area,restricao,parent_id) VALUES
(227,'CMASM-DSAU','DSAU','Divisão de Saúde','encarregado_divisao','APA','militar',151),
(228,'CMASM-DSAU.1','DSAU.1','Seção Médica','encarregado_secao','APA','militar',227),
(229,'CMASM-DSAU.2','DSAU.2','Seção Odontológica','encarregado_secao','APA','militar',227)
on conflict (id) do nothing;

-- ── templates de checklist ──
insert into pred_checklist_templates (id, nome, tipo_local, descricao, norma_ref) values
  (100, 'Inspeção Predial Completa — NBR 5674/16747', null, 'Template completo baseado na ABNT NBR 5674:2012 e NBR 16747:2020. Todos os sistemas construtivos com Matriz GUT.', 'NBR 5674:2012 · NBR 16747:2020 · IBAPE/NA 2012'),
  (101, 'Inspeção de Paiol — Estrutura e Segurança', 'paiol', 'Template focado para paióis de armamento: estrutura, cobertura, vedação, instalação elétrica (Ex/ATEX), SPDA e combate a incêndio.', 'NBR 5674:2012 · NR-19 · ABNT NBR IEC 60079'),
  (102, 'Inspeção de Área Externa e Infraestrutura', 'area_externa', 'Template para áreas externas, cais e infraestruturas: pavimentação, drenagem, muros e iluminação.', 'NBR 5674:2012 · NBR 9050:2020')
on conflict (id) do nothing;

-- ── itens dos templates ──
insert into pred_checklist_itens (template_id, sistema, subsistema, descricao, ordem) values
  (100, 'documentacao', null, 'Alvará de construção', 1),
  (100, 'documentacao', null, 'Projeto de sondagem do solo', 2),
  (100, 'documentacao', null, 'Projeto de fundação + ART/RRT', 3),
  (100, 'documentacao', null, 'Projeto de estruturas + ART/RRT', 4),
  (100, 'documentacao', null, 'Projeto arquitetônico executivo + ART/RRT', 5),
  (100, 'documentacao', null, 'Projeto hidráulico-sanitário + ART/RRT', 6),
  (100, 'documentacao', null, 'Projeto elétrico + ART/RRT', 7),
  (100, 'documentacao', null, 'Memorial descritivo dos sistemas construtivos', 8),
  (100, 'documentacao', null, 'Habite-se / Auto de Vistoria', 9),
  (100, 'documentacao', null, 'Manual de Uso, Operação e Manutenção (MOM)', 10),
  (100, 'documentacao', null, 'Plano de Manutenção Preventiva (PMP) atualizado', 11),
  (100, 'documentacao', null, 'Registro de reformas realizadas', 12),
  (100, 'documentacao', null, 'Registro de manutenções executadas (livro de manutenção)', 13),
  (100, 'documentacao', null, 'Laudos de inspeções prediais anteriores', 14),
  (100, 'documentacao', null, 'Atestado de Regularidade do Corpo de Bombeiros (AVCB/CLCB)', 15),
  (100, 'documentacao', null, 'Certificado de recarga e manutenção dos extintores', 16),
  (100, 'documentacao', null, 'Relatório de Inspeção de Mangueiras dos Hidrantes', 17),
  (100, 'documentacao', null, 'Atestado SPDA — medição ôhmica (máx. 5 anos)', 18),
  (100, 'documentacao', null, 'Certificado de limpeza e desinfecção dos reservatórios (6 meses)', 19),
  (100, 'documentacao', null, 'Apólice de seguro de incêndio vigente', 20),
  (100, 'fundacao', null, 'Erosão ou carreamento do solo na base da edificação', 1),
  (100, 'fundacao', null, 'Recalque diferencial (desníveis visíveis em pisos/paredes)', 2),
  (100, 'fundacao', null, 'Anomalias do solo (bombeamento, contaminação, umidade ascendente)', 3),
  (100, 'fundacao', null, 'Falha na execução da fundação (bicheiras, armadura exposta)', 4),
  (100, 'fundacao', null, 'Vegetação com raízes agressivas junto à fundação', 5),
  (100, 'estrutura', null, 'Exposição de armadura (cobrimento insuficiente)', 1),
  (100, 'estrutura', null, 'Corrosão de armaduras (manchas ferruginosas, expansão do cobrimento)', 2),
  (100, 'estrutura', null, 'Deformação excessiva de vigas, lajes ou pilares', 3),
  (100, 'estrutura', null, 'Deterioração ou degradação de materiais estruturais', 4),
  (100, 'estrutura', null, 'Eflorescência / manchas de carbonatação', 5),
  (100, 'estrutura', null, 'Fissuras, trincas ou rachaduras em elementos estruturais', 6),
  (100, 'estrutura', null, 'Infiltração por fissuras na estrutura', 7),
  (100, 'estrutura', null, 'Falha de concretagem (bicheiras, ninhos, falhas de forma)', 8),
  (100, 'estrutura', null, 'Recalques em elementos estruturais', 9),
  (100, 'estrutura', null, 'Segregação do concreto (separação de agregados)', 10),
  (100, 'estrutura', null, 'Desagregação ou desplacamento de concreto', 11),
  (100, 'estrutura', null, 'Lixiviação (lavagem de cimento pela água)', 12),
  (100, 'estrutura', null, 'Irregularidades geométricas (prumo, nível, alinhamento)', 13),
  (100, 'vedacao', null, 'Fissura / trinca / rachadura em alvenaria de vedação', 1),
  (100, 'vedacao', null, 'Eflorescência em alvenaria', 2),
  (100, 'vedacao', null, 'Infiltração pela alvenaria', 3),
  (100, 'vedacao', null, 'Irregularidades geométricas (esquadro / prumo / nível)', 4),
  (100, 'vedacao', null, 'Desagregação de elementos de alvenaria (soltos, quebrados)', 5),
  (100, 'vedacao', null, 'Fungos / bolor / mofo em superfícies de vedação', 6),
  (100, 'vedacao', null, 'Pulverulência (pó superficial, argamassa fraca)', 7),
  (100, 'vedacao', null, 'Gretamento (fissuras em teia na argamassa/pintura)', 8),
  (100, 'vedacao', null, 'Falhas na amarração entre alvenarias (interfaces)', 9),
  (100, 'vedacao', null, 'Ausência de verga e/ou contra-verga em aberturas', 10),
  (100, 'vedacao', null, 'Descascamento de pintura / bolhas / descoloração', 11),
  (100, 'vedacao', null, 'Abertura improvisada para passagem de cabos/tubos', 12),
  (100, 'revestimento', 'forro', 'Deformação excessiva do forro', 1),
  (100, 'revestimento', 'forro', 'Fissura no forro', 2),
  (100, 'revestimento', 'forro', 'Desencaixe de placas / módulos de forro', 3),
  (100, 'revestimento', 'forro', 'Utilização de material sujeito a corrosão em área úmida', 4),
  (100, 'revestimento', 'forro', 'Abaulamento / empenamento do forro', 5),
  (100, 'revestimento', 'forro', 'Deficiência no dimensionamento ou inexistência de alçapão', 6),
  (100, 'revestimento', 'forro', 'Infiltração ou manchas de umidade visíveis no forro', 7),
  (100, 'revestimento', 'paredes', 'Fissuras em revestimento de paredes internas', 1),
  (100, 'revestimento', 'paredes', 'Destacamento / desagregação / descolamento de revestimento', 2),
  (100, 'revestimento', 'paredes', 'Infiltração em paredes internas', 3),
  (100, 'revestimento', 'paredes', 'Eflorescência / manchas de mofo / bolor em paredes', 4),
  (100, 'revestimento', 'paredes', 'Falha em rejuntes de revestimento cerâmico', 5),
  (100, 'revestimento', 'paredes', 'Bolhas / enrugamento em pintura de paredes', 6),
  (100, 'revestimento', 'paredes', 'Som cavo ao percutir revestimento (descolamento oculto)', 7),
  (100, 'revestimento', 'paredes', 'Abertura improvisada para passagem de cabos/tubos', 8),
  (100, 'revestimento', 'piso', 'Caimento inadequado em áreas molhadas / laváveis', 1),
  (100, 'revestimento', 'piso', 'Fissuras em revestimento de piso', 2),
  (100, 'revestimento', 'piso', 'Falha em rejuntes de piso', 3),
  (100, 'revestimento', 'piso', 'Som cavo ao percutir o piso (descolamento)', 4),
  (100, 'revestimento', 'piso', 'Abatimento / afundamento do piso', 5),
  (100, 'revestimento', 'piso', 'Pisos externos escorregadios / sem proteção antiderrapante', 6),
  (100, 'revestimento', 'piso', 'Desgaste anormal ou deterioração do piso', 7),
  (100, 'revestimento', 'piso', 'Destacamento / descolamento de piso', 8),
  (100, 'revestimento', 'fachada', 'Fissuras em revestimento de fachada', 1),
  (100, 'revestimento', 'fachada', 'Destacamento / desagregação / descolamento de fachada', 2),
  (100, 'revestimento', 'fachada', 'Bolhas / enrugamento em pintura de fachada', 3),
  (100, 'revestimento', 'fachada', 'Eflorescência / manchas de mofo / bolor em fachada', 4),
  (100, 'revestimento', 'fachada', 'Falha em rejuntes de fachada', 5),
  (100, 'revestimento', 'fachada', 'Deficiência pintura / oxidação / corrosão de elementos metálicos', 6),
  (100, 'revestimento', 'fachada', 'Vidros soltos ou quebrados em esquadrias de fachada', 7),
  (100, 'revestimento', 'fachada', 'Descolamento de material selante em fachada', 8),
  (100, 'revestimento', 'fachada', 'Ataque de pragas / bioincrustação em fachada', 9),
  (100, 'esquadrias', null, 'Deficiência na pintura / oxidação / corrosão de esquadrias', 1),
  (100, 'esquadrias', null, 'Ataque de pragas (cupins) em esquadrias de madeira', 2),
  (100, 'esquadrias', null, 'Deficiência na abertura / fechamento (travamento, folga)', 3),
  (100, 'esquadrias', null, 'Folga na fixação dos vidros', 4),
  (100, 'esquadrias', null, 'Vidros soltos ou quebrados', 5),
  (100, 'esquadrias', null, 'Rompimento ou descolamento do material selante / infiltração', 6),
  (100, 'esquadrias', null, 'Componentes danificados (ferragens, fechos, dobradiças)', 7),
  (100, 'impermeabilizacao', null, 'Infiltração por falha no sistema de impermeabilização', 1),
  (100, 'impermeabilizacao', null, 'Descolamento de manta impermeabilizante', 2),
  (100, 'impermeabilizacao', null, 'Sistema de impermeabilização perfurado ou rasgado', 3),
  (100, 'impermeabilizacao', null, 'Ressecamento / craqueamento do sistema impermeabilizante', 4),
  (100, 'impermeabilizacao', null, 'Falta de junta de dilatação em proteção mecânica', 5),
  (100, 'impermeabilizacao', null, 'Falta de caimento para os ralos (acúmulo de água)', 6),
  (100, 'impermeabilizacao', null, 'Falta de impermeabilização no teto dos reservatórios', 7),
  (100, 'impermeabilizacao', null, 'Proteção mecânica danificada ou ausente', 8),
  (100, 'cobertura', null, 'Deformações excessivas na estrutura da cobertura', 1),
  (100, 'cobertura', null, 'Abertura de frestas entre telhas / rufos', 2),
  (100, 'cobertura', null, 'Umidade na estrutura da cobertura (madeiramento, metálica)', 3),
  (100, 'cobertura', null, 'Deslocamento / desalinhamento / quebra de telhas', 4),
  (100, 'cobertura', null, 'Corrosão de parafusos de fixação / rufo metálico / calha metálica', 5),
  (100, 'cobertura', null, 'Ressecamento de borrachas de vedação / vedantes de rufos', 6),
  (100, 'cobertura', null, 'Entupimento de calhas e ralos', 7),
  (100, 'cobertura', null, 'Caimento do telhado insuficiente (água represada)', 8),
  (100, 'cobertura', null, 'Ausência da grelha do ralo ou extravasor de calha', 9),
  (100, 'cobertura', null, 'Falta de condições de segurança para acesso (guarda-corpo)', 10),
  (100, 'instalacao_hidrossanitaria', null, 'Vazamento em tubulações / conexões hidráulicas', 1),
  (100, 'instalacao_hidrossanitaria', null, 'Deterioração / deformação nas tubulações', 2),
  (100, 'instalacao_hidrossanitaria', null, 'Tampas de reservatórios inadequadas ou danificadas', 3),
  (100, 'instalacao_hidrossanitaria', null, 'Não conformidade na pintura de identificação das tubulações', 4),
  (100, 'instalacao_hidrossanitaria', null, 'Falta de identificação nos registros do barrilete', 5),
  (100, 'instalacao_hidrossanitaria', null, 'Tubulações obstruídas (entupimento)', 6),
  (100, 'instalacao_hidrossanitaria', null, 'Entupimento / extravasamento de calhas e ralos pluviais', 7),
  (100, 'instalacao_hidrossanitaria', null, 'Corrosão de tubulações de ferro galvanizado', 8),
  (100, 'instalacao_hidrossanitaria', null, 'Reservatórios sem limpeza / desinfecção no prazo', 9),
  (100, 'instalacao_eletrica', null, 'Lâmpadas queimadas / ausência de lâmpadas', 1),
  (100, 'instalacao_eletrica', null, 'Pragas urbanas em quadros elétricos / de telefonia', 2),
  (100, 'instalacao_eletrica', null, 'Improvisos nas instalações elétricas (gambiarras)', 3),
  (100, 'instalacao_eletrica', null, 'Superaquecimento de condutores ou equipamentos', 4),
  (100, 'instalacao_eletrica', null, 'Fiações aparentes / com muitas emendas / partes vivas expostas', 5),
  (100, 'instalacao_eletrica', null, 'Curto-circuito identificado ou evidências de arco elétrico', 6),
  (100, 'instalacao_eletrica', null, 'Quadro de distribuição obstruído / sem identificação de circuitos', 7),
  (100, 'instalacao_eletrica', null, 'Ausência de proteção de barramento (tampa de quadro)', 8),
  (100, 'instalacao_eletrica', null, 'Falha de tomada / interruptor', 9),
  (100, 'instalacao_eletrica', null, 'Cerca elétrica danificada / sem manutenção', 10),
  (100, 'instalacao_eletrica', null, 'Corrosão / deterioração de eletrodutos', 11),
  (100, 'instalacao_eletrica', null, 'Ausência de aterramento em equipamentos / quadros', 12),
  (100, 'instalacao_gas', null, 'Vazamento em tubulação ou conexões de gás', 1),
  (100, 'instalacao_gas', null, 'Deterioração / corrosão de tubulações de gás', 2),
  (100, 'instalacao_gas', null, 'Não conformidade na pintura de identificação (amarelo)', 3),
  (100, 'instalacao_gas', null, 'Não conformidade nas dimensões mínimas do abrigo de gás', 4),
  (100, 'instalacao_gas', null, 'Ausência de ventilação inferior no abrigo de gás (GLP)', 5),
  (100, 'instalacao_gas', null, 'Ausência de dispositivo de segurança (válvula corta-gás)', 6),
  (100, 'instalacao_gas', null, 'Espaçamento insuficiente entre recipientes e parede da central', 7),
  (100, 'extintores', null, 'Extintor descarregado ou com prazo de validade vencido', 1),
  (100, 'extintores', null, 'Lacre violado ou vencido', 2),
  (100, 'extintores', null, 'Sem indicação da classe / sinalização incorreta', 3),
  (100, 'extintores', null, 'Quadro de instruções ilegível ou inexistente', 4),
  (100, 'extintores', null, 'Mangueira de descarga com danos / deformação / ressecamento', 5),
  (100, 'extintores', null, 'Quantidade insuficiente ou altura de instalação irregular', 6),
  (100, 'hidrantes', null, 'Falta de conservação / sinalização da bomba de incêndio', 1),
  (100, 'hidrantes', null, 'Dispositivo de comando da bomba quebrado ou danificado', 2),
  (100, 'hidrantes', null, 'Mau estado de conservação das caixas de hidrantes', 3),
  (100, 'hidrantes', null, 'Mangueira do hidrante danificada / ressecada / ausente', 4),
  (100, 'hidrantes', null, 'Registro emperrado / com vazamento', 5),
  (100, 'hidrantes', null, 'Ausência de mangueira ou esguicho', 6),
  (100, 'saida_emergencia', null, 'Ausência de sinalização das rotas de fuga e saídas de emergência', 1),
  (100, 'saida_emergencia', null, 'Portas de emergência obstruídas', 2),
  (100, 'saida_emergencia', null, 'Portas corta-fogo em mau estado / fechaduras com defeito', 3),
  (100, 'saida_emergencia', null, 'Portas corta-fogo abertas e travadas com objetos', 4),
  (100, 'saida_emergencia', null, 'Falha na iluminação autônoma de emergência', 5),
  (100, 'saida_emergencia', null, 'Escada sem corrimão ou guarda-corpo inadequado', 6),
  (100, 'saida_emergencia', null, 'Largura de saída inferior a 1,20 m', 7),
  (100, 'spda', null, 'Ausência do sistema SPDA (obrigatório A>1500m² ou H>12m)', 1),
  (100, 'spda', null, 'Queda de haste ou antenas do SPDA', 2),
  (100, 'spda', null, 'Corrosão em cabos / conexões / hastes do SPDA', 3),
  (100, 'spda', null, 'Descidas insuficientes (1 descida a cada 20m de perímetro)', 4),
  (100, 'spda', null, 'Ausência de luz de topo na haste do SPDA', 5),
  (100, 'spda', null, 'Medição ôhmica com prazo vencido (> 5 anos)', 6),
  (101, 'estrutura', null, 'Exposição de armadura ou fissuras estruturais', 1),
  (101, 'estrutura', null, 'Corrosão de armaduras (manchas ferruginosas)', 2),
  (101, 'estrutura', null, 'Fissuras / trincas em paredes ou laje', 3),
  (101, 'estrutura', null, 'Infiltração por estrutura ou cobertura', 4),
  (101, 'vedacao', null, 'Fissuras em alvenaria', 1),
  (101, 'vedacao', null, 'Infiltração pela alvenaria', 2),
  (101, 'vedacao', null, 'Ausência de verga / contra-verga', 3),
  (101, 'cobertura', null, 'Deformação ou abertura de frestas na cobertura', 1),
  (101, 'cobertura', null, 'Deslocamento / quebra de telhas', 2),
  (101, 'cobertura', null, 'Entupimento de calhas — risco de inundação', 3),
  (101, 'cobertura', null, 'Corrosão de elementos metálicos da cobertura', 4),
  (101, 'instalacao_eletrica', null, 'Instalação elétrica à prova de explosão (Ex/ATEX) danificada', 1),
  (101, 'instalacao_eletrica', null, 'Fiações aparentes ou improvisos', 2),
  (101, 'instalacao_eletrica', null, 'Quadro elétrico sem identificação / obstruído', 3),
  (101, 'instalacao_eletrica', null, 'Ausência de aterramento de equipamentos', 4),
  (101, 'instalacao_eletrica', null, 'Lâmpadas sem proteção antiexplosiva', 5),
  (101, 'spda', null, 'Ausência ou dano no sistema SPDA', 1),
  (101, 'spda', null, 'Corrosão em cabos / hastes do SPDA', 2),
  (101, 'spda', null, 'Medição ôhmica com prazo vencido', 3),
  (101, 'extintores', null, 'Extintor com prazo vencido ou lacre violado', 1),
  (101, 'extintores', null, 'Extintor sem indicação de classe adequada', 2),
  (101, 'extintores', null, 'Quantidade de extintores insuficiente para a área', 3),
  (101, 'impermeabilizacao', null, 'Infiltração no piso ou paredes do paiol', 1),
  (101, 'impermeabilizacao', null, 'Caimento insuficiente para escoamento pluvial', 2),
  (102, 'pavimentacao', null, 'Fissuras / trincas em pavimento rígido (concreto)', 1),
  (102, 'pavimentacao', null, 'Afundamento / recalque de pavimento', 2),
  (102, 'pavimentacao', null, 'Desagregação de pavimento (paralelepípedo, asfalto, pedra)', 3),
  (102, 'pavimentacao', null, 'Superfície escorregadia / sem antiderrapante em acesso', 4),
  (102, 'pavimentacao', null, 'Caimento inadequado (acúmulo de água)', 5),
  (102, 'drenagem', null, 'Entupimento de ralos / caixas de drenagem', 1),
  (102, 'drenagem', null, 'Erosão do solo por escoamento superficial', 2),
  (102, 'drenagem', null, 'Ausência de canaleta de drenagem em área operacional', 3),
  (102, 'drenagem', null, 'Boca de lobo obstruída ou danificada', 4),
  (102, 'muros_cercas', null, 'Fissuras / trincas em muro de alvenaria', 1),
  (102, 'muros_cercas', null, 'Recalque diferencial de muro / cerca', 2),
  (102, 'muros_cercas', null, 'Corrosão de elementos metálicos de cerca / portão', 3),
  (102, 'muros_cercas', null, 'Vegetação com raízes danificando muro / fundação', 4),
  (102, 'muros_cercas', null, 'Cerca elétrica danificada ou sem manutenção', 5),
  (102, 'iluminacao_externa', null, 'Luminárias externas danificadas ou ausentes', 1),
  (102, 'iluminacao_externa', null, 'Postes com corrosão ou inclinação anormal', 2),
  (102, 'iluminacao_externa', null, 'Cabos elétricos expostos em área externa', 3),
  (102, 'iluminacao_externa', null, 'Ausência de iluminação em área de acesso controlado', 4),
  (102, 'vegetacao', null, 'Vegetação invasora sobre estruturas / pisos', 1),
  (102, 'vegetacao', null, 'Raízes causando levantamento de pavimento', 2),
  (102, 'vegetacao', null, 'Acúmulo de vegetação seca (risco de incêndio)', 3),
  (102, 'vegetacao', null, 'Árvore com risco de queda sobre edificação / via', 4)
on conflict (template_id, sistema, descricao) do nothing;

-- ── acerta as sequences, já que os ids vieram do legado ──
select setval(pg_get_serial_sequence('pred_locais', 'id'), coalesce(max(id), 1)) from pred_locais;
select setval(pg_get_serial_sequence('pred_checklist_templates', 'id'), coalesce(max(id), 1)) from pred_checklist_templates;

commit;

-- Conferência:
--   select count(*) from pred_normas;               -- 10
--   select count(*) from pred_locais;               -- 150
--   select count(*) from pred_checklist_templates;  -- 3
--   select count(*) from pred_checklist_itens;      -- 206
