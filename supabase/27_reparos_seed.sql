-- ═══════════════════════════════════════════════════════════════════
-- 27 — PMOC Reparos — seed do catálogo e backfill de maq_ativos.modelo_id
-- Migração aditiva e reexecutável (todo insert usa on conflict do nothing).
-- Depende de 26_reparos_schema.sql e de 02_maquinas_seed.sql (peças PE01–PE34).
--
-- rep_modelos.codigo repete o tipo_modelo legado — é a chave do backfill.
-- Os vínculos peça×reparo só foram semeados onde o nome da peça em
-- maq_materiais identifica o modelo sem ambiguidade (ex.: 'Vela HQT-9
-- (Husqvarna TS114)'). Onde o catálogo de peças não distingue o modelo, o
-- reparo entra com serviço e sem peça, para ser vinculado no módulo — melhor
-- um vínculo faltando que um vínculo errado.
-- ═══════════════════════════════════════════════════════════════════

-- ── 7 modelos da frota atual ──
insert into rep_modelos (codigo,fabricante,modelo,categoria,motor,unidade_uso) values
 ('FS220','STIHL','FS 220','rocadeira','2T 41,6 cc','h'),
 ('GAR','Garthen','PRO-3500S','rocadeira','4T monocilíndrico','h'),
 ('MS650','STIHL','MS650','motoserra','2T 84,9 cc','h'),
 ('COY','Tobata','CT151','minitrator','4T 15 hp','h'),
 ('LGT','Husqvarna','LGT2654','trator','Briggs 2 cil.','h'),
 ('TS114','Husqvarna','TS114','trator','HS452AE','h'),
 ('SOL','Solis','90','trator','diesel 4 cil.','h')
on conflict (codigo) do nothing;

-- ── Backfill: liga os 28 ativos ao modelo pelo tipo_modelo legado ──
update maq_ativos a
   set modelo_id = m.id
  from rep_modelos m
 where a.modelo_id is null
   and a.tipo_modelo = m.codigo;

-- ── Catálogo de serviços (tempo_padrao_h é estimativa inicial de oficina) ──
insert into rep_servicos (codigo,nome,especialidade,tempo_padrao_h) values
 ('SV01','Substituir vela de ignição','mecanica',0.3),
 ('SV02','Limpar filtro de ar','mecanica',0.2),
 ('SV03','Substituir filtro de ar','mecanica',0.3),
 ('SV04','Substituir filtro de combustível','mecanica',0.4),
 ('SV05','Substituir filtro de óleo','mecanica',0.4),
 ('SV06','Trocar óleo do motor','mecanica',0.5),
 ('SV07','Regular carburador','mecanica',0.8),
 ('SV08','Aplicar kit de reparo do carburador','mecanica',2.0),
 ('SV09','Substituir mangueira de combustível','mecanica',0.5),
 ('SV10','Substituir correia','mecanica',1.0),
 ('SV11','Substituir lâmina de corte','mecanica',0.4),
 ('SV12','Afiar e balancear lâmina','mecanica',0.5),
 ('SV13','Substituir carretel de nylon','mecanica',0.2),
 ('SV14','Afiar corrente de motosserra','mecanica',0.4),
 ('SV15','Tensionar corrente de motosserra','mecanica',0.1),
 ('SV16','Substituir pneu','mecanica',0.8),
 ('SV17','Lubrificar graxeiros','mecanica',0.3),
 ('SV18','Diagnóstico elétrico','eletrica',0.5),
 ('SV19','Substituir sensor / chave de segurança','eletrica',0.6),
 ('SV20','Descarbonizar câmara de combustão','mecanica',1.5),
 ('SV21','Substituir filtro hidráulico','hidraulica',0.8),
 ('SV22','Solda de estrutura / chassi','solda',2.0),
 ('SV23','Substituir rolamento de roda','mecanica',1.2),
 ('SV24','Limpar e desobstruir sistema de combustível','mecanica',1.0)
on conflict (codigo) do nothing;

insert into rep_servicos (codigo,nome,especialidade,tempo_padrao_h) values
 ('SV25','Reabastecer e desobstruir lubrificação da corrente','mecanica',0.3)
on conflict (codigo) do nothing;

-- ── Reparos iniciais (sintoma → causa provável) ──
-- modelo null = vale para qualquer modelo. frequencia começa em 0: a ordem
-- do diagnóstico só passa a refletir a realidade da oficina depois que as
-- primeiras OSs forem confirmadas via rep_confirmar_reparo().
insert into rep_reparos (codigo,modelo_id,sistema,sintoma,causa_provavel,gravidade)
select v.codigo, m.id, v.sistema, v.sintoma, v.causa, v.gravidade
  from (values
   ('RP-FS220-01','FS220','motor','Não dá partida','Vela suja ou queimada','media'),
   ('RP-FS220-02','FS220','motor','Perda de força sob carga','Filtro de ar saturado','baixa'),
   ('RP-FS220-03','FS220','combustivel','Não dá partida ou morre em uso','Mangueira de combustível ressecada','media'),
   ('RP-FS220-04','FS220','corte','Fio de nylon não avança','Carretel gasto ou mal enrolado','baixa'),
   ('RP-FS220-05','FS220','motor','Morre em marcha lenta','Carburador desregulado','media'),
   ('RP-FS220-06','FS220','transmissao','Ruído ou aquecimento na caixa','Falta de graxa na engrenagem cônica','alta'),
   ('RP-GAR-01','GAR','motor','Não dá partida','Vela suja ou queimada','media'),
   ('RP-GAR-02','GAR','motor','Fumaça branca-azulada','Óleo acima do nível ou degradado','media'),
   ('RP-GAR-03','GAR','motor','Perda de força sob carga','Filtro de ar saturado','baixa'),
   ('RP-GAR-04','GAR','corte','Corte irregular','Lâmina cega ou empenada','baixa'),
   ('RP-MS650-01','MS650','corte','Corrente não corta, produz serragem fina','Corrente sem fio','baixa'),
   ('RP-MS650-02','MS650','corte','Corrente solta ou sai do sabre','Tensionamento incorreto','media'),
   ('RP-MS650-03','MS650','motor','Não dá partida','Vela suja ou queimada','media'),
   ('RP-MS650-04','MS650','corte','Sabre superaquecendo','Lubrificação da corrente sem óleo ou obstruída','alta'),
   ('RP-COY-01','COY','transmissao','Patina ao subir rampa','Correia de transmissão gasta','alta'),
   ('RP-COY-02','COY','motor','Não dá partida','Vela suja ou queimada','media'),
   ('RP-COY-03','COY','motor','Perda de força sob carga','Filtro de ar saturado','baixa')
  ) as v(codigo,modelo,sistema,sintoma,causa,gravidade)
  left join rep_modelos m on m.codigo = v.modelo
on conflict (codigo) do nothing;

insert into rep_reparos (codigo,modelo_id,sistema,sintoma,causa_provavel,gravidade)
select v.codigo, m.id, v.sistema, v.sintoma, v.causa, v.gravidade
  from (values
   ('RP-LGT-01','LGT','corte','Deck não gira','Correia do deck rompida','alta'),
   ('RP-LGT-02','LGT','eletrico','Motor não liga com o operador no banco','Sensor de presença defeituoso','media'),
   ('RP-LGT-03','LGT','motor','Perda de força sob carga','Filtro de ar saturado','baixa'),
   ('RP-TS114-01','TS114','motor','Não dá partida','Vela suja ou queimada','media'),
   ('RP-TS114-02','TS114','motor','Perda de força sob carga','Filtro de ar saturado','baixa'),
   ('RP-TS114-03','TS114','corte','Corte irregular ou vibração no deck','Lâmina cega ou empenada','media'),
   ('RP-TS114-04','TS114','transmissao','Deck não gira','Correia A-78 rompida','alta'),
   ('RP-TS114-05','TS114','motor','Morre ao acelerar','Membranas do carburador ressecadas','media'),
   ('RP-TS114-06','TS114','estrutura','Ruído e folga na roda','Rolamento de roda gasto','media'),
   ('RP-TS114-07','TS114','estrutura','Pneu murcho ou danificado','Desgaste ou furo','baixa'),
   ('RP-TS114-08','TS114','combustivel','Partida difícil a frio','Filtro de combustível obstruído','baixa'),
   ('RP-SOL-01','SOL','motor','Perda de força e fumaça preta','Filtro de ar primário saturado','media'),
   ('RP-SOL-02','SOL','combustivel','Falha e engasgo sob carga','Filtro de combustível diesel obstruído','media'),
   ('RP-SOL-03','SOL','hidraulico','Levante lento ou sem força','Filtro hidráulico obstruído','alta'),
   ('RP-GEN-01',null,'combustivel','Motor engasga após longo período parado','Combustível envelhecido e resíduo no sistema','media'),
   ('RP-GEN-02',null,'estrutura','Trinca ou deformação no chassi','Fadiga ou impacto','alta')
  ) as v(codigo,modelo,sistema,sintoma,causa,gravidade)
  left join rep_modelos m on m.codigo = v.modelo
on conflict (codigo) do nothing;

-- ── Serviços por reparo ──
insert into rep_reparo_servicos (reparo_id,servico_id,quantidade)
select r.id, s.id, 1
  from (values
   ('RP-FS220-01','SV01'),('RP-FS220-02','SV03'),('RP-FS220-03','SV09'),
   ('RP-FS220-04','SV13'),('RP-FS220-05','SV07'),('RP-FS220-06','SV17'),
   ('RP-GAR-01','SV01'),('RP-GAR-02','SV06'),('RP-GAR-03','SV03'),('RP-GAR-04','SV12'),
   ('RP-MS650-01','SV14'),('RP-MS650-02','SV15'),('RP-MS650-03','SV01'),('RP-MS650-04','SV25'),
   ('RP-COY-01','SV10'),('RP-COY-02','SV01'),('RP-COY-03','SV03'),
   ('RP-LGT-01','SV10'),('RP-LGT-02','SV18'),('RP-LGT-02','SV19'),('RP-LGT-03','SV03'),
   ('RP-TS114-01','SV01'),('RP-TS114-02','SV03'),('RP-TS114-03','SV11'),
   ('RP-TS114-04','SV10'),('RP-TS114-05','SV08'),('RP-TS114-06','SV23'),
   ('RP-TS114-07','SV16'),('RP-TS114-08','SV04'),
   ('RP-SOL-01','SV03'),('RP-SOL-02','SV04'),('RP-SOL-03','SV21'),
   ('RP-GEN-01','SV24'),('RP-GEN-02','SV22')
  ) as v(reparo,servico)
  join rep_reparos  r on r.codigo = v.reparo
  join rep_servicos s on s.codigo = v.servico
on conflict (reparo_id,servico_id) do nothing;

-- ── Peças por reparo ──
-- Só onde o nome da peça em maq_materiais identifica o modelo sem ambiguidade.
-- essencial=false = "verificar se precisa trocar" (ex.: corrente que pode só
-- ser afiada; par de pneus em que só um é trocado).
-- RP-TS114-06 (rolamento de roda) e RP-LGT-03 (filtro de ar LGT) ficam sem
-- peça: o catálogo de 34 itens não tem o material correspondente. Cadastrar a
-- peça e vincular no módulo — não inventar aqui.
insert into rep_reparo_materiais (reparo_id,material_id,quantidade,essencial)
select r.id, mt.id, v.qtd, v.essencial
  from (values
   ('RP-FS220-01','PE18',1,true),  ('RP-FS220-02','PE08',1,true),
   ('RP-FS220-03','PE31',1,true),  ('RP-FS220-04','PE23',1,true),
   ('RP-FS220-06','PE05',1,true),
   ('RP-GAR-01','PE19',1,true),    ('RP-GAR-02','PE02',0.6,true),
   ('RP-GAR-03','PE09',1,true),    ('RP-GAR-04','PE22',1,true),
   ('RP-MS650-01','PE27',1,false), ('RP-MS650-03','PE18',1,true),
   ('RP-MS650-04','PE04',1,true),
   ('RP-COY-01','PE26',1,true),    ('RP-COY-02','PE20',1,true),
   ('RP-COY-03','PE10',1,true),
   ('RP-LGT-01','PE25',1,true),    ('RP-LGT-02','PE32',1,true),
   ('RP-TS114-01','PE17',1,true),  ('RP-TS114-02','PE07',1,true),
   ('RP-TS114-03','PE21',1,true),  ('RP-TS114-04','PE24',1,true),
   ('RP-TS114-05','PE30',1,true),  ('RP-TS114-07','PE28',1,false),
   ('RP-TS114-07','PE29',1,false), ('RP-TS114-08','PE13',1,true),
   ('RP-SOL-01','PE11',1,true),    ('RP-SOL-01','PE12',1,false),
   ('RP-SOL-02','PE14',1,true),    ('RP-SOL-03','PE16',1,true),
   ('RP-GEN-01','PE34',1,false)
  ) as v(reparo,peca,qtd,essencial)
  join rep_reparos    r  on r.codigo  = v.reparo
  join maq_materiais  mt on mt.codigo = v.peca
on conflict (reparo_id,material_id) do nothing;

-- ═══════════════════════════════════════════════════════════════════
-- Conferência (rodar após a migração, no SQL Editor)
-- ═══════════════════════════════════════════════════════════════════
-- 7 modelos, 25 serviços, 33 reparos, 34 vínculos de serviço, 30 de peça:
--   select (select count(*) from rep_modelos)  as modelos,
--          (select count(*) from rep_servicos) as servicos,
--          (select count(*) from rep_reparos)  as reparos;
--
-- Backfill completo — deve retornar 0 linhas:
--   select id, codigo, tipo_modelo from maq_ativos where modelo_id is null;
--
-- Reparo pronto para uso (peças + serviços + estoque), como o módulo vai ler:
--   select r.codigo, r.sintoma, r.causa_provavel,
--          coalesce(sum(rm.quantidade * mt.preco), 0) as custo_pecas,
--          (select coalesce(sum(sv.tempo_padrao_h * rs.quantidade),0)
--             from rep_reparo_servicos rs
--             join rep_servicos sv on sv.id = rs.servico_id
--            where rs.reparo_id = r.id) as horas,
--          bool_and(mt.estoque_atual >= rm.quantidade) as tem_estoque
--     from rep_reparos r
--     left join rep_reparo_materiais rm on rm.reparo_id = r.id and rm.essencial
--     left join maq_materiais mt on mt.id = rm.material_id
--    where r.modelo_id = (select id from rep_modelos where codigo='TS114')
--    group by r.id, r.codigo, r.sintoma, r.causa_provavel
--    order by r.frequencia desc, r.codigo;
