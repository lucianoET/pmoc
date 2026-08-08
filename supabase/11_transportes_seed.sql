-- ═══════════════════════════════════════════════════════════════════
-- 11 — PMOC Transportes — carga inicial do mapa de VTR e EMB
-- Fonte: ref/Mapa de VTR e EMB ATU 20FEV26.csv
-- Seed idempotente com frota e 23 programações históricas.
-- ═══════════════════════════════════════════════════════════════════

insert into transp_ativos (
  codigo, nome, tipo, subtipo, identificacao, tipo_modelo,
  capacidade_pessoas, capacidade_carga_kg, uso_atual, unidade_uso,
  status, local, observacoes
)
values
  ('VTR-001', 'MUNK', 'viatura', 'Caminhão', 'KPJ 8385', 'munk', 3, 5000, 0, 'km', 'disponivel', 'CMASM', null),
  ('VTR-002', 'S-10', 'viatura', 'Pickup', 'LRZ 5099', 's10', 5, 800, 0, 'km', 'disponivel', 'CMASM', null),
  ('EMB-001', 'ETPM FÁTIMA', 'embarcacao', 'Embarcação de rotina', 'CMASM-08', 'etpm-fatima', 12, 0, 0, 'h', 'disponivel', 'CMASM', 'Linha de rotina com múltiplas saídas diárias para Ilha das Flores.'),
  ('EMB-002', 'LANCHA NATAL', 'embarcacao', 'Lancha', 'CMASM-05', 'lancha-natal', 6, 0, 0, 'h', 'sobreaviso', 'CMASM', 'Embarcação mantida em sobreaviso no turno noturno.'),
  ('VTR-003', 'AMBULÂNCIA', 'viatura', 'Ambulância', null, 'ambulancia', 4, 0, 0, 'km', 'disponivel', 'CMASM', null),
  ('VTR-004', 'DOBLÔ 1.4', 'viatura', 'Viatura leve', null, 'doblo-14', 5, 0, 0, 'km', 'disponivel', 'CMASM', null),
  ('VTR-005', 'CAMINHÃO CONSTELLATION', 'viatura', 'Caminhão', null, 'constellation', 3, 4000, 0, 'km', 'disponivel', 'CMASM', null),
  ('VTR-006', 'XCMG', 'viatura', 'Guindaste', 'GUINDASTE', 'xcmg-guindaste', 2, 0, 0, 'km', 'disponivel', 'CMASM', 'Emprego em fainas de armamento.'),
  ('EMB-003', 'SARGENTO FREITAS', 'embarcacao', 'Embarcação de apoio', 'CMASM-10', 'sargento-freitas', 8, 0, 0, 'h', 'disponivel', 'CMASM', null)
on conflict (codigo) do update
set
  nome = excluded.nome,
  tipo = excluded.tipo,
  subtipo = excluded.subtipo,
  identificacao = excluded.identificacao,
  tipo_modelo = excluded.tipo_modelo,
  capacidade_pessoas = excluded.capacidade_pessoas,
  capacidade_carga_kg = excluded.capacidade_carga_kg,
  unidade_uso = excluded.unidade_uso,
  status = excluded.status,
  local = excluded.local,
  observacoes = excluded.observacoes;

insert into transp_viagens (
  chave_importacao, ativo_id, classificacao, tipo_uso, origem, destino, missao,
  data_saida, hora_saida_prevista, hora_chegada_prevista, motorista_nome,
  patrao_nome, mo_nome, responsavel_nome, passageiros, carga_kg, carga_descricao,
  status, observacoes, importado_de
)
select
  dados.chave_importacao,
  ativos.id,
  dados.classificacao,
  dados.tipo_uso,
  dados.origem,
  dados.destino,
  dados.missao,
  dados.data_saida,
  dados.hora_saida_prevista,
  dados.hora_chegada_prevista,
  dados.motorista_nome,
  dados.patrao_nome,
  dados.mo_nome,
  dados.responsavel_nome,
  dados.passageiros,
  dados.carga_kg,
  dados.carga_descricao,
  dados.status,
  dados.observacoes,
  dados.importado_de
from (
  values
    ('csv-2026-01-30-vtr-001-1300', 'VTR-001', 'rotina', 'material', 'CMASM', 'CMASM', 'Recolhimento do lixo', date '2026-01-30', time '13:00', time '15:30', 'Motorista de Serviço', null, null, 'Oficial de Serviço', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-vtr-002-1430', 'VTR-002', 'rotina', 'material', 'CMASM', 'Ilha das Flores', 'Destinação do lixo', date '2026-01-30', time '14:30', time '15:00', null, null, null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-0615', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '06:15', time '06:30', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-0640', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '06:40', time '06:50', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-0650', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '06:50', time '07:00', null, 'Militares de Serviço', null, 'Oficial de Serviço', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-0700', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '07:00', time '07:20', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-0730', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '07:30', time '07:45', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-0830', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '08:30', time '08:40', null, 'Militares de Serviço', null, 'Oficial de Serviço', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-0930', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '09:30', time '09:45', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-1200-a', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '12:00', time '12:10', null, 'Militares de Serviço', null, 'Oficial de Serviço', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-1200-b', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '12:00', time '13:00', null, 'Militares de Serviço', null, 'Oficial de Serviço', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-1300', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '13:00', time '13:10', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-1610', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '16:10', time '16:20', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-1630', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '16:30', time '16:40', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-1700', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '17:00', time '17:10', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-1730', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '17:30', time '17:40', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-001-1800', 'EMB-001', 'rotina', 'rotina', 'CMASM', 'Ilha das Flores', 'Transporte de pessoal (rotina)', date '2026-01-30', time '18:00', time '18:10', null, 'Militares de Serviço', null, null, 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-002-1800', 'EMB-002', 'sobreaviso', 'sobreaviso', 'CMASM', 'Baía de Guanabara', 'Embarcação de sobreaviso', date '2026-01-30', time '18:00', time '06:00', null, null, null, null, 0, 0, null, 'concluida', 'Retorno previsto na madrugada do dia seguinte.', 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-vtr-003-1300', 'VTR-003', 'programada', 'pessoal', 'CMASM', 'ASD', 'Transporte de pessoal', date '2026-01-30', time '13:00', time '16:00', '3ºSG MI REGIS', null, null, 'CT-RM2 EN MARCUS ARANTES', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-vtr-004-0730', 'VTR-004', 'programada', 'pessoal', 'CMASM', 'DCAM', 'Transporte de pessoal', date '2026-01-30', time '07:30', time '16:00', '3SG-JACKSON', null, null, 'CT(EN) Danianderson', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-vtr-005-1000', 'VTR-005', 'programada', 'material', 'CMASM', 'INTERNO', 'Transporte de material', date '2026-01-30', time '10:00', time '12:00', 'Motorista de Serviço', null, null, '2ºSG-AR MARCO', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-vtr-006-1300', 'VTR-006', 'programada', 'armamento', 'CMASM', 'BFNIF', 'Faina de armamento', date '2026-01-30', time '13:00', time '16:00', '3ºSG-MR BERNARDES', null, null, 'CT RM2 EN MARCUS ARANTES', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv'),
    ('csv-2026-01-30-emb-003-1300', 'EMB-003', 'programada', 'armamento', 'CMASM', 'BFNIF', 'Faina de armamento', date '2026-01-30', time '13:00', time '16:00', null, '3º SG MO VITORINO', 'CB MC FERNANDES', 'CT-RM2-EN MARCUS ARANTES', 0, 0, null, 'concluida', null, 'Mapa de VTR e EMB ATU 20FEV26.csv')
) as dados (
  chave_importacao, codigo_ativo, classificacao, tipo_uso, origem, destino, missao,
  data_saida, hora_saida_prevista, hora_chegada_prevista, motorista_nome,
  patrao_nome, mo_nome, responsavel_nome, passageiros, carga_kg, carga_descricao,
  status, observacoes, importado_de
)
join transp_ativos ativos on ativos.codigo = dados.codigo_ativo
on conflict (chave_importacao) do update
set
  ativo_id = excluded.ativo_id,
  classificacao = excluded.classificacao,
  tipo_uso = excluded.tipo_uso,
  origem = excluded.origem,
  destino = excluded.destino,
  missao = excluded.missao,
  data_saida = excluded.data_saida,
  hora_saida_prevista = excluded.hora_saida_prevista,
  hora_chegada_prevista = excluded.hora_chegada_prevista,
  motorista_nome = excluded.motorista_nome,
  patrao_nome = excluded.patrao_nome,
  mo_nome = excluded.mo_nome,
  responsavel_nome = excluded.responsavel_nome,
  passageiros = excluded.passageiros,
  carga_kg = excluded.carga_kg,
  carga_descricao = excluded.carga_descricao,
  status = excluded.status,
  observacoes = excluded.observacoes,
  importado_de = excluded.importado_de;
