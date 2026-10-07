-- 66 — Seed do plano de manutenção do Unipac/Jacto VPX (VTR-024, tipo_modelo CARRO ELETRICO).
-- Gerado por supabase/gerar_66_transportes_vpx_seed.mjs a partir de Plano_Manutencao_VPX_CMASM.json.
-- Idempotente: on conflict do nothing. Pressão de pneu e torques ficam sem faixa até o manual da Unipac.

insert into transp_rotinas (tipo_modelo, codigo, nome, intervalo_dias, responsavel, tipo_os, ordem)
values ('CARRO ELETRICO', 'VPX-D', 'Inspeção pré-uso e pós-uso', 1, 'OP', 'inspecao', 0)
on conflict (tipo_modelo, codigo) do nothing;

insert into transp_rotina_itens (rotina_id, ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
select r.id, v.ordem, v.descricao, v.tipo, v.unidade, v.minimo, v.maximo, v.dif_max, v.criterio, v.acao_se_nc, v.sistema, v.registro_por
from transp_rotinas r, (values
  (1, 'Indicador de carga do banco acima de 50% antes de sair', 'check', null::text, null::numeric, null::numeric, null::numeric, '≥ 50%', 'Não utilizar; colocar em carga', 'Baterias', null::text),
  (2, 'Ausência de vazamento de eletrólito, fluido de freio ou óleo sob o veículo', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem vazamentos', 'Bloquear uso e comunicar a DME', 'Geral', null::text),
  (3, 'Pneus sem cortes, bolhas ou aparência de baixa pressão', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem avarias visíveis', 'Calibrar ou comunicar a DME', 'Rodas e pneus', null::text),
  (4, 'Freio de serviço firme (pedal não vai ao fundo) e freio de estacionamento retém o veículo em rampa', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Freia e retém', 'Bloquear uso e comunicar a DME', 'Freios', null::text),
  (5, 'Direção sem folga excessiva nem ruído', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Folga normal', 'Comunicar a DME', 'Direção e suspensão', null::text),
  (6, 'Buzina, faróis, lanternas, luz de freio e alarme de ré funcionando', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Todos operantes', 'Comunicar a DME', 'Elétrica auxiliar', null::text),
  (7, 'Acelerador retorna sozinho ao soltar; chave Frente/Neutro/Ré trava nas posições', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Retorno e travamento normais', 'Bloquear uso e comunicar a DME', 'Tração e controle', null::text),
  (8, 'Sem ruídos anormais, cheiro de queimado ou perda de potência durante o uso', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Normal', 'Parar, desligar e comunicar a DME', 'Tração e controle', null::text),
  (9, 'Após o uso: veículo colocado em carga completa (não interromper o ciclo)', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Carga iniciada; LED de carga aceso', 'Verificar tomada, plugue e carregador', 'Baterias', null::text)
) as v(ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
where r.tipo_modelo = 'CARRO ELETRICO' and r.codigo = 'VPX-D'
on conflict (rotina_id, ordem) do nothing;

insert into transp_rotinas (tipo_modelo, codigo, nome, intervalo_dias, responsavel, tipo_os, ordem)
values ('CARRO ELETRICO', 'VPX-S', 'Verificação semanal das baterias', 7, 'TEC', 'preventiva', 1)
on conflict (tipo_modelo, codigo) do nothing;

insert into transp_rotina_itens (rotina_id, ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
select r.id, v.ordem, v.descricao, v.tipo, v.unidade, v.minimo, v.maximo, v.dif_max, v.criterio, v.acao_se_nc, v.sistema, v.registro_por
from transp_rotinas r, (values
  (1, 'Nível do eletrólito em todos os 18 elementos, verificado APÓS carga completa', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Placas cobertas; nível ~6 mm abaixo do fundo do bocal', 'Completar SOMENTE com água destilada/deionizada, após a carga', 'Baterias', null::text),
  (2, 'Topo das baterias limpo e seco; sem acúmulo de ácido ou sulfato nos bornes', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Limpo e seco', 'Limpar com solução de bicarbonato de sódio e água; enxaguar; secar', 'Baterias', null::text),
  (3, 'Tampas dos elementos presentes e bem fechadas; respiros desobstruídos', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Todas presentes e fechadas', 'Repor tampa faltante', 'Baterias', null::text),
  (4, 'Cabos e terminais sem folga aparente, rachaduras, aquecimento ou corrosão', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem anomalias', 'Reapertar/limpar; substituir cabo danificado', 'Baterias', null::text),
  (5, 'Carregador: cabos, plugue e receptáculo íntegros, sem marcas de aquecimento; ventilação livre', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem anomalias', 'Substituir plugue/cabo; limpar entradas de ar', 'Carregador', null::text),
  (6, 'Pressão dos pneus', 'medida', 'psi'::text, null::numeric, null::numeric, null::numeric, 'Conforme placa do pneu/manual do fabricante', 'Calibrar', 'Rodas e pneus', 'pneu'::text)
) as v(ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
where r.tipo_modelo = 'CARRO ELETRICO' and r.codigo = 'VPX-S'
on conflict (rotina_id, ordem) do nothing;

insert into transp_rotinas (tipo_modelo, codigo, nome, intervalo_dias, responsavel, tipo_os, ordem)
values ('CARRO ELETRICO', 'VPX-M', 'Manutenção preventiva mensal', 30, 'TEC', 'preventiva', 2)
on conflict (tipo_modelo, codigo) do nothing;

insert into transp_rotina_itens (rotina_id, ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
select r.id, v.ordem, v.descricao, v.tipo, v.unidade, v.minimo, v.maximo, v.dif_max, v.criterio, v.acao_se_nc, v.sistema, v.registro_por
from transp_rotinas r, (values
  (1, 'Tensão em repouso de cada bateria (mínimo 4 h após a carga, sem carga conectada)', 'medida', 'V'::text, 6.31::numeric, 6.45::numeric, 0.1::numeric, 'Cada bateria ≥ 6,31 V; diferença entre baterias ≤ 0,10 V', 'Equalizar; se persistir, teste de capacidade da bateria suspeita', 'Baterias', 'bateria'::text),
  (2, 'Tensão total do banco em repouso', 'medida', 'V'::text, 37.9::numeric, 38.7::numeric, null::numeric, '≥ 37,9 V (≈ 90% de carga)', 'Rever carregador e baterias individualmente', 'Baterias', 'banco'::text),
  (3, 'Densidade do eletrólito de cada elemento (corrigida para 26,7 °C)', 'medida', 'g/cm³'::text, 1.25::numeric, 1.29::numeric, 0.03::numeric, '≥ 1,250; diferença entre elementos ≤ 0,030', 'Equalizar; diferença > 0,050 após equalização indica elemento defeituoso', 'Baterias', 'elemento'::text),
  (4, 'Temperatura do eletrólito no elemento central', 'medida', '°C'::text, null::numeric, 45::numeric, null::numeric, '≤ 45 °C', 'Investigar sobrecarga ou ventilação deficiente', 'Baterias', 'banco'::text),
  (5, 'Torque dos terminais das baterias conferido com torquímetro', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Conforme fabricante da bateria (tipicamente 11 a 14 N·m em terminal tipo L)', 'Reapertar; não exceder o torque', 'Baterias', null::text),
  (6, 'Aplicação de protetor anticorrosivo nos terminais após limpeza', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Aplicado', 'Aplicar spray ou graxa protetora de terminais', 'Baterias', null::text),
  (7, 'Nível do fluido de freio no reservatório', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Entre MÍN e MÁX', 'Completar com fluido especificado; investigar vazamento', 'Freios', null::text),
  (8, 'Curso livre e ajuste do freio de estacionamento', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Retém o veículo em rampa', 'Ajustar cabo/catraca', 'Freios', null::text),
  (9, 'Aperto das porcas de roda', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Conforme manual', 'Reapertar em cruz', 'Rodas e pneus', null::text),
  (10, 'Desgaste dos pneus (banda de rodagem e flancos)', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sulco visível e uniforme', 'Substituir/rodiziar; verificar alinhamento', 'Rodas e pneus', null::text),
  (11, 'Chicote e conexões de potência (controlador, contatora, motor) sem aquecimento, folga ou isolação danificada', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem anomalias', 'Reapertar/substituir', 'Tração e controle', null::text)
) as v(ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
where r.tipo_modelo = 'CARRO ELETRICO' and r.codigo = 'VPX-M'
on conflict (rotina_id, ordem) do nothing;

insert into transp_rotinas (tipo_modelo, codigo, nome, intervalo_dias, responsavel, tipo_os, ordem)
values ('CARRO ELETRICO', 'VPX-T', 'Manutenção preventiva trimestral', 90, 'TEC', 'preventiva', 3)
on conflict (tipo_modelo, codigo) do nothing;

insert into transp_rotina_itens (rotina_id, ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
select r.id, v.ordem, v.descricao, v.tipo, v.unidade, v.minimo, v.maximo, v.dif_max, v.criterio, v.acao_se_nc, v.sistema, v.registro_por
from transp_rotinas r, (values
  (1, 'Carga de equalização do banco (somente baterias ventiladas)', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Executada conforme carregador/fabricante; nível conferido antes e depois', 'Executar quando diferença de densidade > 0,030 ou a cada 3 meses', 'Baterias', null::text),
  (2, 'Teste de carga: tensão do banco com o veículo em rampa/aceleração plena', 'medida', 'V'::text, 31.5::numeric, null::numeric, null::numeric, 'Não cair abaixo de 31,5 V (1,75 V/elemento)', 'Identificar bateria com maior queda e testar individualmente', 'Baterias', 'banco'::text),
  (3, 'Tensão final do carregador na fase de absorção (medida nos bornes do banco, fim de carga)', 'medida', 'V'::text, 42.3::numeric, 44.4::numeric, null::numeric, 'Entre 42,3 e 44,4 V', 'Ajustar/substituir carregador', 'Carregador', 'banco'::text),
  (4, 'Lubrificação dos pontos com graxeira (suspensão dianteira, terminais de direção, pivôs)', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Lubrificado', 'Lubrificar com graxa especificada', 'Direção e suspensão', null::text),
  (5, 'Folga dos terminais de direção, pivôs e rolamentos das rodas dianteiras', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem folga', 'Substituir componente com folga', 'Direção e suspensão', null::text),
  (6, 'Microchaves do pedal do acelerador e da chave Frente/Ré; potenciômetro/sensor do pedal', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Acionamento correto', 'Limpar/ajustar/substituir', 'Tração e controle', null::text),
  (7, 'Contatora principal: acionamento sem ruído anormal; contatos sem carbonização excessiva', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Normal', 'Limpar/substituir contatora', 'Tração e controle', null::text),
  (8, 'Leitura de códigos de falha do controlador (LED de diagnóstico ou programador)', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem falhas registradas', 'Diagnosticar conforme manual do controlador', 'Tração e controle', null::text),
  (9, 'Inspeção de corrosão em chassi, suportes de bateria e fixações (ambiente salino)', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem corrosão ativa', 'Lixar, aplicar primer anticorrosivo e pintura', 'Estrutura', null::text)
) as v(ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
where r.tipo_modelo = 'CARRO ELETRICO' and r.codigo = 'VPX-T'
on conflict (rotina_id, ordem) do nothing;

insert into transp_rotinas (tipo_modelo, codigo, nome, intervalo_dias, responsavel, tipo_os, ordem)
values ('CARRO ELETRICO', 'VPX-SM', 'Manutenção preventiva semestral', 180, 'TEC', 'preventiva', 4)
on conflict (tipo_modelo, codigo) do nothing;

insert into transp_rotina_itens (rotina_id, ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
select r.id, v.ordem, v.descricao, v.tipo, v.unidade, v.minimo, v.maximo, v.dif_max, v.criterio, v.acao_se_nc, v.sistema, v.registro_por
from transp_rotinas r, (values
  (1, 'Motor de tração: estado e comprimento das escovas; comutador sem riscos ou queima', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Escovas acima do limite de desgaste', 'Substituir escovas; limpar pó de carvão com ar seco', 'Motor', null::text),
  (2, 'Nível de óleo do diferencial e ausência de vazamento nos retentores', 'check', null::text, null::numeric, null::numeric, null::numeric, 'No nível do bujão de verificação', 'Completar com óleo especificado; trocar retentor', 'Transmissão', null::text),
  (3, 'Lonas/pastilhas e tambores/discos de freio', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Acima do desgaste mínimo', 'Substituir', 'Freios', null::text),
  (4, 'Amortecedores, molas e buchas da suspensão', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem vazamento ou folga', 'Substituir', 'Direção e suspensão', null::text),
  (5, 'Alinhamento (convergência) das rodas dianteiras', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Conforme manual', 'Alinhar', 'Direção e suspensão', null::text),
  (6, 'Limpeza interna do carregador e verificação do ventilador', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem poeira; ventilador gira', 'Limpar com ar seco; substituir ventilador', 'Carregador', null::text),
  (7, 'Assentos, cintos/apoios, capota, para-brisa e retrovisores', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Íntegros e fixos', 'Reparar/substituir', 'Carroceria', null::text)
) as v(ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
where r.tipo_modelo = 'CARRO ELETRICO' and r.codigo = 'VPX-SM'
on conflict (rotina_id, ordem) do nothing;

insert into transp_rotinas (tipo_modelo, codigo, nome, intervalo_dias, responsavel, tipo_os, ordem)
values ('CARRO ELETRICO', 'VPX-A', 'Manutenção preventiva anual', 365, 'TEC', 'preventiva', 5)
on conflict (tipo_modelo, codigo) do nothing;

insert into transp_rotina_itens (rotina_id, ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
select r.id, v.ordem, v.descricao, v.tipo, v.unidade, v.minimo, v.maximo, v.dif_max, v.criterio, v.acao_se_nc, v.sistema, v.registro_por
from transp_rotinas r, (values
  (1, 'Teste de capacidade do banco (descarga a 75 A até 31,5 V)', 'medida', 'min'::text, 92::numeric, null::numeric, null::numeric, '≥ 80% do tempo nominal a 75 A informado pelo fabricante da bateria (ex.: 115 min nominais → mínimo 92 min)', 'Substituir baterias com capacidade < 80%; não misturar baterias novas e velhas no mesmo banco', 'Baterias', 'banco'::text),
  (2, 'Troca do óleo do diferencial', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Executada', 'Conforme manual (ou a cada 2 anos se uso leve)', 'Transmissão', null::text),
  (3, 'Troca do fluido de freio (higroscópico)', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Executada a cada 2 anos', 'Substituir e sangrar o sistema', 'Freios', null::text),
  (4, 'Isolamento entre o banco de baterias e o chassi (fuga para a massa)', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem fuga (medição com multímetro entre borne + e chassi ≈ 0 V)', 'Limpar topo das baterias; localizar fuga', 'Baterias', null::text),
  (5, 'Rolamentos das rodas traseiras e do motor (ruído, folga)', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem ruído ou folga', 'Substituir', 'Transmissão', null::text),
  (6, 'Revisão geral de fixações estruturais e da carroceria', 'check', null::text, null::numeric, null::numeric, null::numeric, 'Sem trincas, folgas ou corrosão', 'Reparar', 'Estrutura', null::text)
) as v(ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)
where r.tipo_modelo = 'CARRO ELETRICO' and r.codigo = 'VPX-A'
on conflict (rotina_id, ordem) do nothing;

