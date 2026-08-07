-- ═══════════════════════════════════════════════════════════
-- ARP 04/2024 · PE 90026/2024 — CMRJ (UASG 160292)
-- Adesão CMASM (UASG 744030) · Processo 63099.002208/2025-06
-- Fontes: MCP_MNT_AC_RLP_CMASM.ods · MCP_MNT_AC_WINS_CMASM.ods
--         NE 2026NE000334 · NE 2026NE000335 (28/07/2026)
-- ═══════════════════════════════════════════════════════════

-- campos adicionais para gestão da adesão
alter table arp_itens add column if not exists fornecedor text;
alter table arp_itens add column if not exists cnpj text;
alter table arp_itens add column if not exists ne text;
alter table arp_itens add column if not exists equipamento text;
alter table arp_itens add column if not exists capacidade text;

insert into arp_itens
 (numero_ata,item,descricao,unidade,valor_unitario,
  quantidade_registrada,quantidade_consumida,
  fornecedor,cnpj,ne,equipamento,capacidade,ativo)
values
  ('ARP 04/2024','1092','Serviço de desmontagem parcial do equipamento.','SERVIÇO',74.35,44,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1093','Serviço de Verificação da pressão do gás do equipamento.','SERVIÇO',22.31,6,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1096','Serviço de Limpeza e higienização da condensadora.','SERVIÇO',26.07,44,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1097','Serviço de Limpeza e higienização da evaporadora.','SERVIÇO',33.52,44,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1099','Serviço de regulagens e teste de funcionamento com diagnóstico.','SERVIÇO',22.36,44,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1100','Serviço de montagem do equipamento.','SERVIÇO',22.31,6,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1108','Serviço de manutenção corretiva com fornecimento e carga de gás de 2 kg.','SERVIÇO',152.94,20,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1109','Serviço de manutenção corretiva com fornecimento e carga de gás de 4 kg.','SERVIÇO',273.54,10,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1115','Serviço de manutenção corretiva com fornecimento e substituição do compressor.','SERVIÇO',2462.41,5,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1116','Serviço de manutenção corretiva com fornecimento e substituição da serpentina.','SERVIÇO',2270.52,5,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1145','Serviço de manutenção corretiva com fornecimento e substituição do compressor.','SERVIÇO',2388.49,2,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','1146','Serviço de manutenção corretiva com fornecimento e substituição da serpentina.','SERVIÇO',1043.2,2,0,'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334','Split','A confirmarno PNCP',true),
  ('ARP 04/2024','266','Serviço de desmontagem parcial do equipamento.','SERVIÇO',72.06,28,0,'W I N S MARQUES DISTRIBUIDORA','17.774.419/0001-01','2026NE000335','Split','12.000 BTU',true),
  ('ARP 04/2024','276','Serviço de manutenção corretiva com fornecimento e substituição do motor do ventilador da condensadora.','SERVIÇO',285.03,5,0,'W I N S MARQUES DISTRIBUIDORA','17.774.419/0001-01','2026NE000335','Split','12.000 BTU',true),
  ('ARP 04/2024','289','Serviço de manutenção corretiva com fornecimento e substituição do compressor.','SERVIÇO',673.87,5,0,'W I N S MARQUES DISTRIBUIDORA','17.774.419/0001-01','2026NE000335','Split','12.000 BTU',true),
  ('ARP 04/2024','290','Serviço de manutenção corretiva com fornecimento e substituição da serpentina.','SERVIÇO',868.83,5,0,'W I N S MARQUES DISTRIBUIDORA','17.774.419/0001-01','2026NE000335','Split','12.000 BTU',true),
  ('ARP 04/2024','291','Serviço de manutenção corretiva com fornecimento e substituição de bomba de dreno de vazão mínima de 34 litros/hora.','SERVIÇO',281.43,5,0,'W I N S MARQUES DISTRIBUIDORA','17.774.419/0001-01','2026NE000335','Split','12.000 BTU',true),
  ('ARP 04/2024','1365','Serviço de manutenção corretiva com fornecimento e substituição do compressor scroll trifásico.','SERVIÇO',11694.73,1,0,'W I N S MARQUES DISTRIBUIDORA','17.774.419/0001-01','2026NE000335','Central','12TR /144.000 BTU',true),
  ('ARP 04/2024','1366','Serviço de manutenção corretiva com fornecimento e substituição da serpentina 780mm x 720mm com mínimo de 32 rowls.','SERVIÇO',2263.54,1,0,'W I N S MARQUES DISTRIBUIDORA','17.774.419/0001-01','2026NE000335','Central','12TR /144.000 BTU',true);

-- ── 2 OS de contratação (uma por NE) ──
alter table os_contratacao add column if not exists cnpj text;
alter table os_contratacao add column if not exists valor_ne numeric;
alter table os_contratacao add column if not exists processo text;
alter table os_contratacao add column if not exists solemp text;

insert into os_contratacao
 (numero, descricao, empresa, cnpj, ne, valor_ne, processo, solemp,
  status, data_abertura, solicitante, fiscal)
values
 ('OS-2026-334',
  'Manutenção corretiva de ar-condicionado com fornecimento e substituição de material — adesão ARP 04/2024',
  'RLP COMÉRCIO E SERVIÇOS LTDA','14.892.351/0001-69','2026NE000334',
  39926.11,'63099.002208/2025-06','SOLEMP 44030-0144/2026',
  'ABERTA','2026-07-28','DIV. DE MANUTENÇÃO ESPECIALIZADA','LUCIANO DE ALMEIDA FERREIRA'),
 ('OS-2026-335',
  'Manutenção corretiva de ar-condicionado com fornecimento e substituição de material — adesão ARP 04/2024',
  'W I N S MARQUES DISTRIBUIDORA','17.774.419/0001-01','2026NE000335',
  26521.75,'63099.002208/2025-06','SOLEMP 44030-0146/2026',
  'ABERTA','2026-07-28','DIV. DE MANUTENÇÃO ESPECIALIZADA','LUCIANO DE ALMEIDA FERREIRA');

-- ── eventos de auditoria ──
insert into os_eventos (os_id, evento, detalhe, usuario, criado_em)
select id,'NE EMITIDA','NE '||ne||' — R$ '||to_char(valor_ne,'999G999D99')||
       ' · Ordenador: MÁRCIO RAMALHO AMENDOLA · Gestor Financeiro: AMAURY NUNES DA SILVA',
       'SIAFI','2026-07-28 11:28:41'
from os_contratacao where numero in ('OS-2026-334','OS-2026-335');
