-- ══════════════════════════════════════════════════════════════════
-- 58 — Segunda camada da varredura: grandeza física e monetária
-- ganha piso nas oito tabelas que faltavam
--
-- A varredura de 02/09 achou 77 colunas numéricas sem `check`. As
-- migrações 56 e 57 fecharam as dez urgentes de `equipamentos`, porque
-- estavam na planilha que foi a campo. Esta fecha a segunda camada: o
-- que é digitado em formulário, um valor por vez, nos outros módulos.
--
-- ── Por que esta migração NÃO vem com validação de tela ────────────
-- É uma escolha diferente da que fiz nas 56/57, e deliberada.
--
-- Lá o espelho no cliente era essencial: a entrada era um CSV editado à
-- mão, dezenas de valores de uma vez, sem guarda de UI nenhuma, e com
-- caminho de corrupção SILENCIOSA — `1.200` o Postgres lia como 1,2,
-- porque CSV é texto e o separador de milhar é ambíguo.
--
-- Aqui a entrada é `type="number"` em formulário: o navegador entrega
-- número, então não existe ambiguidade de milhar nem corrupção
-- silenciosa. O único modo de falha é alguém digitar um negativo — e os
-- 25 inputs numéricos de `maquinas/` já carregam `min=`, que desencoraja
-- na UI (sem travar, porque `min` é advisório).
--
-- Espelhar custaria tocar 20 chamadas de escrita em 22 funções de
-- `maquinas/app.js` (que tem 129 `parse*` e NENHUM leitor numérico
-- central), mais `/refrigeracao` e `/calibracao` — três aplicativos —
-- por um modo de falha que a UI já desencoraja.
--
-- A troca aceita, explicitamente: hoje um negativo é gravado EM
-- SILÊNCIO; depois desta migração ele é recusado com erro de banco.
-- Erro opaco é pior experiência que mensagem limpa, e é estritamente
-- melhor que dado errado. Se a mensagem limpa for pedida, é uma task
-- própria — e aí o conserto certo é criar o leitor numérico central que
-- `maquinas/app.js` não tem, não espalhar `if` por 20 lugares.
--
-- ADITIVA e segura: medido em 02/09/2026, nenhuma linha existente viola
-- qualquer um dos limites abaixo (ranges no comentário de cada bloco).
-- ══════════════════════════════════════════════════════════════════

do $$
begin
  -- ── logs_manutencao: as medições que ADMITEM piso ────────────────
  -- As oito colunas de medição estão 100% NULAS hoje (as 8 OS existem,
  -- nenhuma registrou medição), então qualquer limite é seguro de
  -- aplicar. Só quatro ganham check; as outras quatro estão logo
  -- abaixo, com o motivo.
  -- Tensão ZERO é leitura legítima, não ausência: circuito morto medido
  -- é exatamente o achado que a OS existe para registrar.
  if not exists (select 1 from pg_constraint where conname = 'logs_corrente_medida_check') then
    alter table logs_manutencao add constraint logs_corrente_medida_check
      check (corrente_medida is null or (corrente_medida >= 0 and corrente_medida <= 1000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'logs_tensao_medida_check') then
    alter table logs_manutencao add constraint logs_tensao_medida_check
      check (tensao_medida is null or (tensao_medida >= 0 and tensao_medida <= 1000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'logs_capacitor_marcha_check') then
    alter table logs_manutencao add constraint logs_capacitor_marcha_check
      check (capacitor_marcha is null or (capacitor_marcha >= 0 and capacitor_marcha <= 1000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'logs_capacitor_partida_check') then
    alter table logs_manutencao add constraint logs_capacitor_partida_check
      check (capacitor_partida is null or (capacitor_partida >= 0 and capacitor_partida <= 1000));
  end if;

  -- ── maq_materiais (35 linhas: 0–56, 1–10, R$ 8,50–668) ───────────
  if not exists (select 1 from pg_constraint where conname = 'maq_materiais_estoque_atual_check') then
    alter table maq_materiais add constraint maq_materiais_estoque_atual_check
      check (estoque_atual is null or estoque_atual >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_materiais_estoque_minimo_check') then
    alter table maq_materiais add constraint maq_materiais_estoque_minimo_check
      check (estoque_minimo is null or estoque_minimo >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_materiais_preco_check') then
    alter table maq_materiais add constraint maq_materiais_preco_check
      check (preco is null or preco >= 0);
  end if;

  -- ── maq_ativos (28 linhas: uso 0–66, aquisição 3.200–185.000,
  --    residual 10, vida útil 1.500–10.000; `ano` nulo nas 28) ──────
  if not exists (select 1 from pg_constraint where conname = 'maq_ativos_ano_check') then
    alter table maq_ativos add constraint maq_ativos_ano_check
      check (ano is null or (ano >= 1900 and ano <= 2100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_ativos_uso_atual_check') then
    alter table maq_ativos add constraint maq_ativos_uso_atual_check
      check (uso_atual is null or uso_atual >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_ativos_valor_aquisicao_check') then
    alter table maq_ativos add constraint maq_ativos_valor_aquisicao_check
      check (valor_aquisicao is null or valor_aquisicao >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_ativos_valor_residual_check') then
    alter table maq_ativos add constraint maq_ativos_valor_residual_check
      check (valor_residual is null or valor_residual >= 0);
  end if;
  -- Vida útil ZERO dividiria a depreciação por zero.
  if not exists (select 1 from pg_constraint where conname = 'maq_ativos_vida_util_check') then
    alter table maq_ativos add constraint maq_ativos_vida_util_check
      check (vida_util_h is null or vida_util_h > 0);
  end if;

  -- ── maq_os (11 linhas: MO 0–360, peças 0–123, horas 0,5–3,6) ─────
  if not exists (select 1 from pg_constraint where conname = 'maq_os_custo_mo_check') then
    alter table maq_os add constraint maq_os_custo_mo_check
      check (custo_mo is null or custo_mo >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_os_custo_pecas_check') then
    alter table maq_os add constraint maq_os_custo_pecas_check
      check (custo_pecas is null or custo_pecas >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_os_horas_servico_check') then
    alter table maq_os add constraint maq_os_horas_servico_check
      check (horas_servico is null or horas_servico >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_os_uso_na_os_check') then
    alter table maq_os add constraint maq_os_uso_na_os_check
      check (uso_na_os is null or uso_na_os >= 0);
  end if;

  -- ── maq_uso_registros (5 linhas: delta 1–52, total 1–66, área 20) ─
  -- `delta >= 0` e não `> 0`: a dívida de segurança herdada manda
  -- "rejeitar delta negativo", que é o risco real; um registro de delta
  -- zero ("nenhum uso desde a última leitura") é plausível e não seria
  -- erro. O horímetro regressivo continua sendo problema de RPC
  -- transacional, não de check de coluna.
  if not exists (select 1 from pg_constraint where conname = 'maq_uso_delta_check') then
    alter table maq_uso_registros add constraint maq_uso_delta_check
      check (delta is null or delta >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_uso_total_check') then
    alter table maq_uso_registros add constraint maq_uso_total_check
      check (uso_total is null or uso_total >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_uso_area_check') then
    alter table maq_uso_registros add constraint maq_uso_area_check
      check (area_trabalhada is null or area_trabalhada >= 0);
  end if;

  -- ── quantidades e preços (15, 49, 59, 11 linhas) ─────────────────
  -- O SINAL do movimento mora em `tipo` (entrada/saida), nunca na
  -- quantidade: um movimento negativo inverteria o sentido sem que
  -- `tipo` soubesse, e a idempotência da baixa lê `tipo`.
  if not exists (select 1 from pg_constraint where conname = 'maq_estoque_mov_qtd_check') then
    alter table maq_estoque_movimentos add constraint maq_estoque_mov_qtd_check
      check (quantidade is null or quantidade > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_plano_mat_qtd_check') then
    alter table maq_plano_materiais add constraint maq_plano_mat_qtd_check
      check (quantidade is null or quantidade > 0);
  end if;
  -- Intervalo zero faria o plano vencer a cada leitura, para sempre.
  if not exists (select 1 from pg_constraint where conname = 'maq_planos_intervalo_check') then
    alter table maq_planos add constraint maq_planos_intervalo_check
      check (intervalo is null or intervalo > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maq_compras_itens_preco_check') then
    alter table maq_compras_itens add constraint maq_compras_itens_preco_check
      check (preco_unit is null or preco_unit >= 0);
  end if;

  -- ── cal_ps (12 linhas: previsto 84–3.105, executado 374–3.105) ───
  if not exists (select 1 from pg_constraint where conname = 'cal_ps_valor_prev_check') then
    alter table cal_ps add constraint cal_ps_valor_prev_check
      check (valor_prev is null or valor_prev >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cal_ps_valor_exec_check') then
    alter table cal_ps add constraint cal_ps_valor_exec_check
      check (valor_exec is null or valor_exec >= 0);
  end if;

  -- ── os_itens (27 linhas: qtd 1–2, valor unitário zerado hoje) ────
  -- `quantidade > 0` e não `>= 0` porque aqui, ao contrário de todo o
  -- resto desta migração, a regra JÁ EXISTE na tela: `osAddItemUI`
  -- recusa `qtd<=0` com "Preencha descrição, qtd e valor". O banco só
  -- passa a dizer o mesmo — item de quantidade zero não é lançamento.
  if not exists (select 1 from pg_constraint where conname = 'os_itens_quantidade_check') then
    alter table os_itens add constraint os_itens_quantidade_check
      check (quantidade is null or quantidade > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'os_itens_valor_unitario_check') then
    alter table os_itens add constraint os_itens_valor_unitario_check
      check (valor_unitario is null or valor_unitario >= 0);
  end if;
  -- `total` é a ÚNICA coluna GERADA das 28, e eu só descobri isso ao
  -- EXERCITAR a trava: o Postgres recusou o update com "column total can
  -- only be updated to DEFAULT". É `quantidade * coalesce(valor_unitario,0)`,
  -- então ninguém escreve nela e este check é avaliado sobre o valor
  -- computado — com os dois de cima em pé, ele nunca pode disparar. Fica
  -- porque o projeto não derruba, e fica DOCUMENTADO para o próximo leitor
  -- não gastar meia hora procurando o caminho de escrita que não existe.
  -- A coluna que realmente precisava de check era `quantidade`, acima.
  if not exists (select 1 from pg_constraint where conname = 'os_itens_total_check') then
    alter table os_itens add constraint os_itens_total_check
      check (total is null or total >= 0);
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════════
-- QUATRO COLUNAS FICAM DE FORA, E ISSO É A DECISÃO MAIS IMPORTANTE
-- DESTA MIGRAÇÃO — não uma omissão.
--
--   logs_manutencao.temp_insuflamento
--   logs_manutencao.temp_retorno
--   logs_manutencao.delta_t
--   logs_manutencao.pressao_succao
--
-- Um check errado é PIOR que check nenhum: o dado ruim que ele deixa
-- passar continua passando, e o dado bom que ele recusa vira erro de
-- banco na cara do técnico, no meio da OS.
--
-- `pressao_succao` — pressão manométrica NEGATIVA é vácuo, e evacuar o
--   sistema é procedimento normal de carga. Um piso em zero recusaria a
--   leitura mais rotineira do serviço.
--
-- `temp_insuflamento` / `temp_retorno` — não há como derivar o piso do
--   dado, porque as oito colunas de medição estão nulas nas 8 OS. Pôr
--   `>= 0` seria adivinhar, e o parque tem câmara refrigerada (os 16
--   equipamentos do PAIOL, 7 câmaras com duas máquinas em rodízio —
--   D-500-08): ar insuflado abaixo de zero não é improvável ali.
--
-- `delta_t` — o sinal depende de qual temperatura se subtrai de qual e
--   de o equipamento estar refrigerando ou aquecendo. Sem convenção
--   escrita, `>= 0` recusaria metade das formas legítimas de anotar.
--
-- Se um dia essas quatro ganharem limite, ele tem de vir de leitura
-- real acumulada — não de intuição sobre o que "parece" negativo.
-- Gate: tests/checks-grandezas.test.js afirma a AUSÊNCIA das quatro.
-- ══════════════════════════════════════════════════════════════════

comment on constraint logs_tensao_medida_check on logs_manutencao is
  'Migração 58. Zero é leitura legítima — circuito morto medido é o achado que a OS registra.';
