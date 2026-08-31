-- ══════════════════════════════════════════════════════════════════
-- 50 — Semente das especialidades e dos turnos (/equipes)
--
-- Idempotente por `on conflict do nothing` sobre o nome: rodar duas
-- vezes não duplica, e uma especialidade que o usuário já tenha criado
-- à mão com o mesmo nome não é sobrescrita.
--
-- As especialidades saem dos setores que o CMASM-13 já documenta
-- (refrigeração, metalurgia, carpintaria, pintura, eletrônica, máquinas)
-- cruzadas com os módulos que a plataforma tem. `dominios` é o que
-- responde "quem pode pegar esta OS" — e é justamente por isso que
-- nenhuma linha nasce com a lista vazia: uma especialidade sem domínio
-- não habilita ninguém para nada, e apareceria na tela como um ofício
-- que não serve para coisa alguma.
--
-- PESSOAS E EQUIPES NÃO SÃO SEMEADAS, de propósito. Nome de militar é
-- dado real da OM; inventar "João da Silva" para a tela não ficar vazia
-- poria dado falso num cadastro que vai ser lido como verdadeiro. A
-- tela nasce vazia com o convite de cadastrar — que é a verdade.
--
-- Os dois turnos são o horário de expediente da oficina e são um PONTO
-- DE PARTIDA editável, não uma regra: a tela permite mudar hora e
-- acrescentar turno. Nascem com hora real (08:00–12:00, 13:00–17:00) e
-- não com a duração simbólica de 2h do app v8.3, porque um turno sem
-- hora não tem onde ser desenhado no calendário.
-- ══════════════════════════════════════════════════════════════════

insert into cmasm_especialidades (nome, dominios) values
  ('Técnico em Refrigeração', '["refrigeracao"]'::jsonb),
  ('Eletricista',             '["eletrica","predial"]'::jsonb),
  ('Eletrônico',              '["fonoclama","calibracao"]'::jsonb),
  ('Mecânico',                '["maquinas","transportes"]'::jsonb),
  ('Metalúrgico',             '["predial","maquinas"]'::jsonb),
  ('Carpinteiro',             '["predial"]'::jsonb),
  ('Pintor',                  '["predial"]'::jsonb),
  ('Auxiliar de Manutenção',  '["refrigeracao","eletrica","predial","maquinas","transportes","fonoclama"]'::jsonb)
on conflict (nome) do nothing;

insert into cmasm_turnos (nome, hora_inicio, hora_fim, ordem) values
  ('Manhã', '08:00', '12:00', 1),
  ('Tarde', '13:00', '17:00', 2)
on conflict do nothing;
