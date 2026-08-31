-- ══════════════════════════════════════════════════════════════════
-- 53 — Semente do acervo: normas, formulários e conceitos
--
-- REGRA QUE GOVERNA ESTE ARQUIVO: nada aqui é inventado. Cada norma foi
-- tirada de uma citação REAL do próprio código — `plano_tarefas.norma_ref`,
-- `maq_planos.norma_ref`, o seed da 18, os comentários das migrações 47 e
-- 48 —, e cada link foi ABERTO daqui antes de entrar, com a data da
-- conferência gravada em `url_conferido`.
--
-- Onde não deu para conferir, o link entra SEM data e a tela diz isso.
-- Deste ambiente, `planalto.gov.br` não responde (conexão encerrada sem
-- resposta) e `in.gov.br` também não; `gov.br` e o catálogo da ABNT
-- respondem. Marcar um link como conferido sem tê-lo aberto seria a
-- mesma classe de mentira que um `default false` numa coluna que
-- ninguém avaliou (D-500-02).
--
-- NORMAS ABNT NÃO GANHAM LINK. Não existe URL oficial e gratuita para o
-- texto de uma NBR — é norma paga. Apontar as quinze para a raiz do
-- catálogo faria quinze links iguais fingindo ser quinze documentos
-- diferentes; a página passa a mostrar o código para busca, e um
-- verbete explica onde se consulta.
--
-- NENHUM MANUAL É SEMEADO (mesma decisão de D-eq-06, nome de militar):
-- manual é do fabricante e do modelo, e o banco tem 1 `manual_url`
-- preenchido em 175 equipamentos. Inventar um endereço plausível poria
-- no acervo um documento que ninguém pode abrir. A tela diz que a
-- seção está vazia e como preenchê-la.
--
-- Aplicar depois da 52.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. as 10 normas que já existem ganham módulo ───────────────────
--
-- Todas nasceram no seed de /predial. Nove são de edificação; NR-19 é
-- sobre explosivos, isto é, sobre os paióis — por isso vai como geral,
-- não como predial: quem cuida de paiol não procura em "predial".
update pred_normas set modulo = 'predial'
 where codigo in ('NBR 5674:2012','NBR 16747:2020','NBR 15575:2013','NBR 16280:2015',
                  'NBR 14037:2011','NBR 9050:2020','NBR 6118:2014','NBR 13752:1996',
                  'IBAPE-NA:2012')
   and modulo is null;

update pred_normas set modulo = 'geral'
 where codigo = 'NR-19' and modulo is null;

-- ── 2. as normas que a plataforma aplica e não estavam no registro ──
--
-- `on conflict (codigo) do nothing`: `codigo` é unique desde a 17, e
-- reaplicar a migração não pode duplicar linha nem sobrescrever um
-- título que alguém corrigiu na tela.
insert into pred_normas (codigo, titulo, orgao, ano, modulo, url, url_conferido, descricao) values

-- refrigeração ────────────────────────────────────────────────────
('NBR 17037:2023',
 'Qualidade do ar interior em ambientes não residenciais climatizados artificialmente',
 'ABNT', 2023, 'refrigeracao', null, null,
 'A norma de referência do PMOC. É a citada em 8 das 9 linhas de plano_tarefas. '
 'Substituiu a Resolução RE nº 09/2003 da ANVISA, que ainda aparece como norma de '
 'referência na tarefa semestral de análise da qualidade do ar (QAI) — corrigir a '
 'citação é trabalho de cadastro, não de código.'),

('NBR 16401',
 'Instalações de ar-condicionado — sistemas centrais e unitários',
 'ABNT', null, 'refrigeracao', null, null,
 'Parâmetros de projeto e de verificação. É de onde saem o ΔT de insuflamento/retorno '
 'da tarefa semestral e os degraus de pé-direito do cálculo de carga térmica '
 '(migração 47). Publicada em partes (1 a 3); o ano depende da parte.'),

('NBR 13971',
 'Sistemas de refrigeração, condicionamento de ar e ventilação — Manutenção programada',
 'ABNT', null, 'refrigeracao', null, null,
 'O que se verifica numa preventiva. Citada junto da NBR 16401 na migração 48, que '
 'acrescentou ruído, qualidade do ar, aspecto, dreno e suporte à inspeção da OS.'),

('NBR 5858',
 'Condicionador de ar doméstico — Determinação de desempenho',
 'ABNT', null, 'refrigeracao', null, null,
 'Base do cálculo de eficiência do módulo. O EER só é publicado com potência de '
 'placa: sem corrente nominal a potência é estimada a partir do próprio BTU, e a '
 'razão vira constante — 10,2 para o parque inteiro (D-2wq-07).'),

('Lei 13.589/2018',
 'Manutenção de instalações e equipamentos de sistemas de climatização de edificações',
 'Presidência da República', 2018, 'refrigeracao',
 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13589.htm', null,
 'É a lei que torna o PMOC obrigatório em edifício de uso público e coletivo — a '
 'razão de este módulo existir. Citada na tarefa anual de inspeção geral e laudo. '
 'Link NÃO conferido: planalto.gov.br não responde do ambiente onde a semente foi '
 'escrita.'),

('RE 09/2003 ANVISA',
 'Padrões referenciais de qualidade do ar interior em ambientes climatizados',
 'ANVISA', 2003, 'refrigeracao',
 'https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/legislacao', '2026-08-31',
 'SUBSTITUÍDA pela NBR 17037:2023. Fica no acervo porque plano_tarefas ainda a cita '
 'como norma de referência da análise de QAI e porque laudo antigo de arquivo foi '
 'emitido sob ela. O link é o da legislação da ANVISA, conferido; a resolução em si '
 'tem de ser buscada ali.'),

-- elétrica ─────────────────────────────────────────────────────────
('NR-10',
 'Segurança em instalações e serviços com eletricidade',
 'MTE', null, 'eletrica',
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-10-nr-10',
 '2026-08-31',
 'Citada junto da NBR 17037 na tarefa trimestral de medição de corrente elétrica: '
 'medir corrente em equipamento energizado é serviço em eletricidade. Sem ano de '
 'propósito — a NR passou por cinco revisões e o texto vigente é o que está no link.'),

('NBR 5410',
 'Instalações elétricas de baixa tensão',
 'ABNT', null, 'eletrica', null, null,
 'Dimensionamento de circuito, proteção e aterramento — o que decide se o quadro '
 'suporta a máquina que se pretende instalar.'),

-- geral ────────────────────────────────────────────────────────────
('NR-35',
 'Trabalho em altura',
 'MTE', null, 'geral',
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-35-nr-35',
 '2026-08-31',
 'Condensadora em telhado, laje ou fachada é trabalho em altura, e a maior parte do '
 'parque tem a unidade externa fora do alcance do piso.'),

('Lei 14.133/2021',
 'Lei de Licitações e Contratos Administrativos',
 'Presidência da República', 2021, 'geral',
 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm', null,
 'Rege todo o ciclo de contratação que os módulos executam: orçamento, execução, '
 'fiscalização, composição de pagamento por item de ARP, certificação. Link NÃO '
 'conferido: planalto.gov.br não responde deste ambiente.')

on conflict (codigo) do nothing;

-- ── 3. formulários: o que a própria plataforma emite ───────────────
--
-- Nenhum tem URL, e não é omissão: são telas que imprimem. O campo que
-- responde à pergunta de quem procura é `onde`.
insert into cmasm_documentos (categoria, titulo, fonte, modulo, onde, resumo, ordem) values
('formulario', 'Ordem de Serviço (OS) — impressão', 'PMOC Refrigeração', 'refrigeracao',
 'Página OS → abrir a OS → botão "Imprimir OS"',
 'Folha da OS com equipamento, local, tipo de serviço, itens de material e serviço, '
 'medições elétricas, inspeção e o registro datado de quem executou. É o documento '
 'que acompanha o serviço e volta assinado.', 10),

('formulario', 'Ficha do equipamento — impressão', 'PMOC Refrigeração', 'refrigeracao',
 'Parque → clicar no equipamento → "Imprimir ficha"',
 'Cadastro completo de uma máquina: identificação, local, capacidade, dados técnicos, '
 'carga térmica e histórico. Serve de anexo em processo e de referência em vistoria.', 20),

('formulario', 'Etiqueta de identificação com QR', 'PMOC Refrigeração', 'refrigeracao',
 'Parque → selecionar equipamentos → "Etiquetas"',
 'Etiqueta para colar na máquina, com patrimônio e QR que abre a ficha. Impressa em '
 'lote a partir da seleção do inventário.', 30),

('formulario', 'Planilha do inventário (CSV)', 'PMOC Refrigeração', 'refrigeracao',
 'Parque → "Planilha" (exportar e importar)',
 'Exporta o parque em CSV que o Excel pt-BR abre direto, e reimporta com atualização, '
 'criação e arquivamento por ausência. A primeira linha declara o escopo: uma '
 'exportação filtrada é estruturalmente parcial e NUNCA arquiva ninguém.', 40),

('formulario', 'Lista de compras (CSV)', 'PMOC Máquinas', 'maquinas',
 'Necessidades → selecionar itens → gerar lista',
 'Relação de material a adquirir com quantidade e valor unitário congelado na linha, '
 'para instruir o pedido. O recebimento é item a item e devolve a entrada ao estoque.', 50)
on conflict do nothing;

-- ── 4. conceitos: o vocabulário desta plataforma ───────────────────
--
-- Verbete não é definição de dicionário: diz como ESTE sistema usa a
-- palavra, porque é isso que resolve a dúvida de quem está na tela.
insert into cmasm_documentos (categoria, titulo, modulo, resumo, ordem) values
('conceito', 'PMOC', 'refrigeracao',
 'Plano de Manutenção, Operação e Controle. O conjunto de rotinas periódicas que a '
 'NBR 17037 exige de quem opera climatização em ambiente de uso público ou coletivo, '
 'e que a Lei 13.589/2018 tornou obrigatório. Aqui é a página que lista o que vence '
 'e quando.', 10),

('conceito', 'BTU/h e TR', 'refrigeracao',
 'Unidades de capacidade de refrigeração. 1 TR (tonelada de refrigeração) = 12.000 '
 'BTU/h. O cadastro guarda BTU/h; as centrais do F21 são de 30 TR e os itens de ARP '
 'aderidos são de 12 TR — divergência conhecida e ainda não resolvida.', 20),

('conceito', 'COP e EER', 'refrigeracao',
 'Razões entre o que a máquina retira de calor e o que consome de energia. O módulo '
 'assume COP 3 para estimar potência a partir da capacidade quando não há corrente de '
 'placa. O EER, ao contrário, SÓ é publicado com potência de placa: calculá-lo sobre '
 'a potência estimada devolve uma constante (3.412 × COP ÷ 1000) e daria a mesma nota '
 'para o parque inteiro.', 30),

('conceito', 'Carga térmica', 'refrigeracao',
 'Quanto calor entra no ambiente e precisa ser retirado — o que decide se a máquina '
 'instalada é a máquina certa. Subdimensionada gela mal e roda 100% do tempo; '
 'superdimensionada liga e desliga e não desumidifica. O cálculo entrega o nível mais '
 'completo que os dados sustentam (1, 2 ou 3) e declara na tela o que foi suposto.', 40),

('conceito', 'ΔT de insuflamento/retorno', 'refrigeracao',
 'Diferença entre a temperatura do ar que sai e a do que volta. É a medida de campo '
 'que diz se a máquina está trocando calor como deveria: ΔT baixo com filtro limpo '
 'aponta carga de gás.', 50),

('conceito', 'QAI — qualidade do ar interior', 'refrigeracao',
 'O que a NBR 17037 mede além do funcionamento da máquina: contagem microbiológica, '
 'poeira e renovação de ar. É a tarefa semestral do plano e a razão de a norma existir '
 '— o risco de um sistema mal mantido é sanitário, não mecânico.', 60),

('conceito', 'Criticidade', 'refrigeracao',
 'CRÍTICA, ALTA, MÉDIA ou BAIXA — o quanto a parada daquele equipamento custa. É o '
 'que define o intervalo entre inspeções e preventivas: crítica inspeciona a cada 30 '
 'dias, baixa a cada 180.', 70),

('conceito', 'Inverter, redundante e automação', 'refrigeracao',
 'Três fatos independentes do equipamento. Inverter é compressor de rotação variável — '
 'muda peça de reposição, procedimento de carga e consumo esperado. Redundante marca '
 'que a máquina participa de um arranjo em que só uma opera por vez (as duas de cada '
 'câmara do paiol em rodízio; as centrais do F21 contra os splits). Automação é '
 'controle predial. Nulo em qualquer um dos três significa NÃO AVALIADO, nunca "não".', 80),

('conceito', 'Tipo de executor da OS', 'refrigeracao',
 'Quem faz o serviço: interna (a própria oficina), externa (empresa sem contrato '
 'formal) ou contrato (com fiscalização, nota fiscal e certificação). Interna e '
 'externa seguem o mesmo fluxo de 5 etapas terminando em CONCLUÍDA; contrato tem 7 e '
 'termina em ENCERRADA.', 90),

('conceito', 'Visita e execução de tarefa', 'equipes',
 'A unidade de trabalho do cálculo de capacidade é a VISITA, não a tarefa. Quem faz as '
 'duas tarefas mensais do mesmo aparelho se desloca, abre e fecha uma vez só — o setup '
 'é cobrado por visita. Com o plano real são 19 visitas/ano por equipamento contra 41 '
 'execuções de tarefa; cobrar setup por tarefa inflaria a demanda em cerca de metade.', 100),

('conceito', 'Horímetro', 'maquinas',
 'Contador de horas de funcionamento. É o gatilho de manutenção das máquinas de corte, '
 'em vez do calendário: o plano vence por uso, não por data. Por isso os 99 ativos de '
 'máquinas, transportes, elétrica e fonoclama ficam FORA da conta de demanda por '
 'calendário do módulo Equipes.', 110),

('conceito', 'ARP e saldo de ata', 'geral',
 'Ata de Registro de Preços: o instrumento que fixa preço unitário por item e do qual '
 'os empenhos vão consumindo. O saldo de um item é o registrado menos o já empenhado — '
 'é o que limita quanto ainda dá para contratar sem novo processo.', 120),

('conceito', 'Onde se consulta uma norma ABNT', 'geral',
 'Norma ABNT é paga e não tem texto oficial gratuito na internet — por isso nenhuma '
 'NBR deste acervo tem link. A consulta e a compra são pelo catálogo da ABNT, buscando '
 'pelo código: https://www.abntcatalogo.com.br (conferido em 31/08/2026). NR do '
 'Ministério do Trabalho e lei federal, ao contrário, são públicas e estão linkadas.', 130)
on conflict do nothing;
