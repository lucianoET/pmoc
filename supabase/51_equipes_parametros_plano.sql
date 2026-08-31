-- ══════════════════════════════════════════════════════════════════
-- 51 — Parâmetros de estimativa de tempo de serviço (/equipes)
--
-- O módulo já sabe a CAPACIDADE (soma das alocações reais da semana).
-- Falta o outro lado da conta: quanto tempo o plano de manutenção
-- OBRIGA por ano. Sem isso não dá para responder a única pergunta que
-- um plano de manutenção existe para responder — "a oficina dá conta do
-- que assinou?".
--
-- DE ONDE VEM A DEMANDA, e a decisão que mais importa aqui: ela sai de
-- `plano_tarefas`, que é o plano REAL da refrigeração já no banco (9
-- tarefas da NBR 17037, cada uma com sua periodicidade). NÃO de uma
-- cópia da tabela `PMOC_INT` que vive dentro de refrigeracao/index.html.
--
-- Duplicar aquelas constantes aqui criaria duas fontes de verdade para
-- "de quanto em quanto tempo" — e /refrigeracao é módulo congelado
-- (D-04), então a cópia divergiria da original sem ninguém perceber.
-- Lendo `plano_tarefas`, mudar a periodicidade de uma tarefa lá muda a
-- demanda aqui, que é o comportamento certo.
--
-- O QUE ESTA MIGRAÇÃO ACRESCENTA é só o que o banco não tem em lugar
-- nenhum: quanto tempo leva executar uma tarefa. Isso não é norma, é
-- CALIBRAÇÃO DA OFICINA — muda com a equipe, com a ferramenta e com o
-- acesso ao equipamento —, e por isso é dado editável na tela e não
-- constante em código.
--
-- Dois parâmetros, não dez. O app v8.3 tinha ainda um fator por tipo de
-- equipamento (SPLIT 1.0, PISO/TETO 1.15, JANELA 0.7, SELF CONTAINED
-- 1.6) e um por tipo de serviço. Ficaram DE FORA de propósito: são oito
-- números que ninguém cronometrou, e publicá-los daria à estimativa uma
-- aparência de precisão que ela não tem. Quando houver medição real de
-- campo, entram por migração aditiva — a fórmula multiplica, então
-- acrescentar fator não desfaz nada.
--
-- FORMA: uma linha por chave, como `maq_config` já faz no módulo de
-- Máquinas — e não uma tabela de coluna por parâmetro, que pediria
-- migração a cada parâmetro novo. `valor` é numeric e não jsonb porque
-- todo parâmetro de tempo é um número; um jsonb aqui só adiaria a
-- decisão de que tipo ele é.
-- ══════════════════════════════════════════════════════════════════

create table if not exists cmasm_parametros (
  chave      text primary key,
  valor      numeric not null,
  rotulo     text not null,
  ajuda      text,
  unidade    text,
  atualizado timestamptz not null default now(),
  -- Tempo negativo encolheria a demanda; zero a anularia em silêncio.
  constraint cmasm_parametros_valor_check check (valor >= 0),
  constraint cmasm_parametros_rotulo_check check (length(btrim(rotulo)) > 0)
);

alter table cmasm_parametros enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'cmasm_parametros_sel') then
    create policy cmasm_parametros_sel on cmasm_parametros for select to public using (true);
  end if;
  -- Calibrar o tempo de serviço muda a demanda do plano inteiro: é ato
  -- de gestão, não de rotina. Mesma lista do cadastro de pessoas.
  if not exists (select 1 from pg_policies where policyname = 'cmasm_parametros_write') then
    create policy cmasm_parametros_write on cmasm_parametros for all to authenticated
      using (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor')))
      with check (exists (select 1 from usuarios u where u.id = auth.uid() and u.role in ('admin','gestor')));
  end if;
end $$;

-- Os dois valores nascem com os números do app v8.3, que são ponto de
-- partida declarado — não medição. A tela diz isso e oferece o campo.
insert into cmasm_parametros (chave, valor, rotulo, ajuda, unidade) values
  ('minutos_por_tarefa', 10,
   'Minutos por tarefa',
   'Tempo médio para executar UMA tarefa do plano num equipamento. Cronometre 2 ou 3 manutenções reais e ajuste.',
   'min'),
  ('minutos_setup', 15,
   'Setup por visita',
   'Deslocamento, montagem e registro, cobrados uma vez por visita — não por tarefa. Um técnico que faz as duas tarefas mensais do mesmo aparelho se desloca uma vez só.',
   'min')
on conflict (chave) do nothing;

comment on table cmasm_parametros is 'Calibracao da oficina (tempo de servico). A periodicidade vem de plano_tarefas, o plano real; aqui fica so quanto tempo leva, que e dado de oficina e nao norma.';
