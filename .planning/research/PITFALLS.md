# Pesquisa de Armadilhas (Pitfalls)

**Domínio:** Consolidação de apps legados (localStorage) em módulos de manutenção sobre backend Supabase compartilhado; schemas de ativos mistos km/horímetro; alertas de vencimento documental
**Pesquisado em:** 2026-08-08
**Confiança geral:** MÉDIA — combina evidência direta do próprio código (`CONCERNS.md`, ALTA confiança) com padrões gerais de mercado obtidos via busca web (confiança BAIXA/MÉDIA, sem verificação cruzada específica ao domínio de manutenção militar/naval)

## Pitfalls Críticos

### Pitfall 1: Consolidar versões divergentes do app legado sem reconciliação explícita

**O que dá errado:**
Cada módulo novo (Transportes, Elétrica, Fonoclama) tem "várias versões" de apps legados funcionando em paralelo, provavelmente com campos renomeados, regras de cálculo diferentes (ex.: uma versão calcula consumo médio por abastecimento, outra por período) e dados que divergem entre si para o mesmo ativo. Importar direto de "a versão mais recente" ou fazer merge automático sem checagem produz um schema final que não reflete nenhuma das versões corretamente — e erros só aparecem meses depois quando um técnico percebe que o histórico de manutenção de uma viatura está incompleto ou contraditório.

**Por que acontece:**
Pressão para "só portar o legado" sem tempo dedicado a diff estrutural. É tentador tratar a consolidação como um passo de importação (ETL) em vez de um passo de design de produto — já visto neste projeto na divergência ARP/RLP de R$ 3.541,02 nunca resolvida (`CONCERNS.md`), que mostra que reconciliação de dados divergentes tende a ficar pendente indefinidamente se não for tratada como entregável formal.

**Como evitar:**
- Antes de qualquer import, produzir um documento de "mapa de campos" por versão legada (planilha: campo origem → campo destino → transformação → o que fazer em caso de conflito).
- Tratar a fase de "análise/consolidação" (já prevista no PROJECT.md para cada módulo) como um checkpoint com saída escrita, não como exploração informal — gerar um `CONSOLIDACAO.md` por módulo antes de tocar em schema SQL.
- Para campos conflitantes entre versões, decidir e documentar a regra de desempate (mais recente por timestamp de arquivo, maior valor, confirmação manual) — nunca "pegar da versão que parecer mais completa" sem registrar a decisão.

**Sinais de alerta:**
Divergências numéricas entre exports de diferentes versões do mesmo app para o mesmo ativo; nomes de campos que mudaram de sentido entre versões (ex.: "km_atual" em uma versão e "km_total" em outra referindo-se a coisas diferentes); ausência de um dono claro pelos dados finais importados.

**Fase a endereçar:**
Fase de análise/consolidação de cada módulo (a que precede a implementação de schema), especialmente Transportes (prioridade 1).

---

### Pitfall 2: Migração localStorage → Postgres sem janela de validação, corte "big bang"

**O que dá errado:**
localStorage não tem transações, não tem FK, não tem timestamps de auditoria confiáveis — geralmente é um blob JSON por dispositivo/navegador. Importar isso direto para tabelas relacionais com um único script de seed, sem comparação pós-import, deixa erros silenciosos: registros duplicados, ativos "perdidos" porque estavam em outro navegador/dispositivo do usuário legado, ou uso_atual (km/horas) desatualizado porque o export foi feito antes do último lançamento manual.

**Por que acontece:**
localStorage é por navegador/dispositivo — não existe "a" fonte de verdade única, existe uma fonte de verdade por técnico/computador. Sem inventário explícito de quais dispositivos/pessoas tinham dados no app legado, o import corre risco de refletir só o export mais conveniente (ex.: o notebook do gestor), não a realidade consolidada da frota.

**Como evitar:**
- Antes de importar, listar explicitamente todas as fontes de dados legados por módulo (quantos dispositivos/exports existem, quem os usa, qual a data do último lançamento em cada um).
- Rodar um job de comparação pós-import: contagem de registros, soma de km/horas por ativo, contagem de documentos com vencimento — comparar contra os totais dos exports originais antes de considerar a importação "concluída".
- Seguir o padrão já comprovado do projeto (import das 171 unidades de refrigeração via SQL seed verificado) — mas adicionar uma etapa de conferência cruzada explícita, já que aqui há múltiplas versões concorrentes, não uma fonte única de planilha.
- Migrações de import devem ser idempotentes (usar `ON CONFLICT DO NOTHING`/`DO UPDATE` com chave natural, ex. placa/código do ativo) para permitir reexecução segura se algo falhar no meio.

**Sinais de alerta:**
Diferença entre contagem de ativos no export legado e na tabela Postgres após import; usuário reportando "sumiu" um ativo ou uma manutenção que ele lembra de ter registrado; datas de "último uso" no Postgres mais antigas que a data real de operação.

**Fase a endereçar:**
Fase de importação de inventário de cada módulo (após consolidação, antes de liberar o módulo para uso).

---

### Pitfall 3: Misturar km e horímetro no mesmo campo genérico de "uso"

**O que dá errado:**
Transportes combina viaturas (medidas em km rodados) e embarcações (medidas em horas de motor). Se o schema herdar ingenuamente o padrão de `maq_ativos.uso_atual` (campo único numérico do módulo Máquinas) para os dois tipos de ativo sem diferenciar a unidade, os cálculos de ciclo de manutenção (`calcCiclo`), os planos por intervalo e os relatórios de consumo ficam ambíguos ou errados — ex.: comparar "uso_atual" de uma viatura (km) com o de uma embarcação (horas) num mesmo relatório, ou aplicar um plano de manutenção "a cada 10.000" sem indicar se é km ou hora.

**Por que acontece:**
O padrão "estilo máquinas" (ciclo de vida por uso, planos por `tipo_modelo`) foi desenhado originalmente para ativos homogêneos em uma unidade. Reaplicar o mesmo padrão para uma frota mista sem adaptação é o caminho de menor esforço, mas gera dívida técnica que só aparece quando a primeira embarcação entra no sistema.

**Como evitar:**
- Modelar explicitamente uma coluna `unidade_uso` (`'km'` | `'hora'`) por ativo ou por `tipo_modelo`, e usar essa unidade em toda exibição, cálculo de ciclo e regra de plano — nunca assumir a unidade implicitamente pelo tipo de tabela.
- Planos de manutenção (`transp_planos` ou equivalente) devem herdar/validar a unidade do ativo ao qual se aplicam — impedir cadastro de plano "a cada 5.000" numa embarcação sem indicar se é km ou hora (não se aplica a embarcações) e vice-versa.
- Validar no banco: `CHECK` que impede plano de km ser vinculado a ativo cujo `unidade_uso = 'hora'`.

**Sinais de alerta:**
Relatórios de "próxima manutenção" com número sem unidade visível; planos de manutenção reaproveitados entre viaturas e embarcações sem ajuste; consumo médio de combustível calculado por km para embarcações (deveria ser por hora, já que embarcações não têm "distância").

**Fase a endereçar:**
Fase de design de schema do módulo Transportes (antes da implementação de UI) — é decisão estrutural, cara de corrigir depois.

---

### Pitfall 4: Copiar o padrão de RLS permissivo existente para os módulos novos

**O que dá errado:**
`CONCERNS.md` já documenta que as políticas RLS atuais (`using (true)` para select, `with check (true)` para insert) dão a qualquer usuário autenticado CRUD completo em todas as tabelas — inclusive `observador`, que deveria ser somente leitura. Como o PROJECT.md determina que os módulos novos "copiam o padrão atual" e que a refatoração dos módulos existentes está fora de escopo, existe risco real de replicar essa falha de segurança em Transportes, Elétrica e Fonoclama — agora com 3x mais tabelas expostas com controle de acesso zero por papel.

**Por que acontece:**
"Copiar o padrão" é interpretado literalmente até no nível das migrações SQL de RLS, porque é o caminho mais rápido para entregar um módulo funcional igual aos existentes. Ninguém rediscute a política de segurança porque ela "já está em produção e funciona".

**Como evitar:**
- Ao copiar o padrão de schema para os módulos novos, tratar as políticas RLS como algo a ser explicitamente revisado, não copiado byte a byte — mesmo mantendo a estrutura de tabelas idêntica ao padrão `maq_`/`ref_`.
- Definir, pelo menos para os módulos novos, uma política mínima: `observador` só com `select`; `insert`/`update`/`delete` restritos a `tecnico`/`gestor`/`admin` via checagem de `auth.jwt()` ou da tabela `usuarios`.
- Não é necessário "consertar" refrigeração/máquinas neste ciclo (fora de escopo), mas os módulos novos não devem herdar o mesmo problema só porque "é o padrão" — decisão explícita, documentada em `Key Decisions`.

**Sinais de alerta:**
Migração SQL de um módulo novo com o mesmo texto literal `using (true)` / `with check (true)` copiado e colado; ausência de teste manual logando como `observador` para confirmar que escrita é bloqueada.

**Fase a endereçar:**
Fase de schema/RLS de cada módulo novo, antes de liberar o módulo (gate de segurança mínimo, mesmo que auditoria completa fique para depois).

---

### Pitfall 5: Drift entre cópias duplicadas do código de autenticação

**O que dá errado:**
O padrão atual (`shared/auth.js`) hardcoda cargos e domínio de e-mail (`@cmasm.local`) por módulo, com mapeamento de papéis (`CARGOS`) embutido no JS. Ao criar 3 módulos novos que "copiam o padrão", cada um ganha sua própria cópia do arquivo de auth. Uma correção de bug ou ajuste de regra de papel feito num módulo (ex.: Transportes precisa de um papel adicional "condutor") não se propaga automaticamente para os outros — e com 5 módulos (2 existentes + 3 novos), o risco de comportamento de login inconsistente entre módulos cresce proporcionalmente.

**Por que acontece:**
Zero-build / sem bundler dificulta compartilhar módulo JS de forma robusta sem um passo de build; "copiar arquivo e ajustar" é o caminho de menor atrito no padrão atual.

**Como evitar:**
- Mesmo em zero-build, é possível referenciar um único `shared/auth.js` via `<script type="module" src="/shared/auth.js">` (caminho absoluto compartilhado) em vez de copiar o arquivo para dentro de cada pasta de módulo — reduz drift sem exigir bundler.
- Se cada módulo precisar de papéis específicos (ex.: "condutor" só em Transportes), modelar isso como dado (tabela `usuarios.papeis_por_modulo` ou similar) em vez de branch de código duplicado por módulo.
- Documentar explicitamente, ao criar o primeiro módulo novo, se a estratégia é "compartilhar auth.js por referência" ou "copiar e divergir intencionalmente" — e registrar a decisão no PROJECT.md.

**Sinais de alerta:**
`grep` retornando múltiplas cópias de `CARGOS` ou lógica de login com pequenas diferenças entre módulos; bug de login corrigido em um módulo mas reproduzido nos outros.

**Fase a endereçar:**
Fase de setup do primeiro módulo novo (Transportes) — decisão de arquitetura de auth compartilhada deve ser tomada antes de replicar para Elétrica/Fonoclama.

---

### Pitfall 6: Crescimento do arquivo único sem modularização (repetir os 436 KB da refrigeração)

**O que dá errado:**
`refrigeracao/index.html` já está em 436 KB como arquivo único (HTML+CSS+JS). Elétrica e Fonoclama seguem explicitamente o "estilo refrigeração" (single-file). Sem disciplina, cada módulo novo tende a crescer da mesma forma — e, como cada um duplica CSS e padrões de UI em vez de reutilizar, o crescimento é pior que linear: 3 módulos novos podem significar +1MB de HTML/CSS/JS duplicado carregado por diferentes usuários, com tempo de parse maior em conexões móveis (contexto militar/campo pode ter conectividade limitada).

**Por que acontece:**
"Copiar o padrão" aplicado literalmente ao nível de arquivo — copiar `refrigeracao/index.html` inteiro como ponto de partida para Elétrica/Fonoclama, incluindo CSS que poderia ser compartilhado.

**Como evitar:**
- Extrair CSS comum para `shared/styles.css` referenciado via `<link>` antes de duplicar para os módulos novos — isso já está listado como fix pendente em `CONCERNS.md` e vira ainda mais relevante com 2 módulos novos adotando o mesmo estilo.
- Definir um teto de tamanho de arquivo por módulo (ex.: alertar se passar de ~250 KB) como critério de revisão, não bloqueio duro — zero-build não impede modularizar em múltiplos arquivos `<script src>` carregados em sequência.
- Extrair funções de checklist/inspeção (comuns a Elétrica e Fonoclama, "estilo refrigeração") para um módulo JS compartilhado desde o primeiro dos dois, evitando duplicar a mesma lógica de tarefas periódicas duas vezes.

**Sinais de alerta:**
Arquivo `index.html` de um módulo novo passando de 300–400 KB antes mesmo de todas as features estarem prontas; CSS idêntico presente em 3+ arquivos do repositório.

**Fase a endereçar:**
Fase de setup de Elétrica (segundo módulo "estilo refrigeração") — ponto certo para extrair o compartilhável antes de Fonoclama repetir o mesmo padrão pela terceira vez.

---

### Pitfall 7: Alertas de vencimento documental sem escalonamento nem responsável definido

**O que dá errado:**
Transportes exige alertas de vencimento (licenciamento, seguro, vistorias). A armadilha mais comum em sistemas desse tipo é implementar um único aviso "vence em X dias" sem: (a) múltiplos estágios de antecedência, (b) um responsável claro por agir, (c) diferenciação entre "vencido" (bloqueante) e "vencendo em breve" (informativo). O resultado típico é alerta que aparece só na tela do sistema — se ninguém abre o módulo naquele dia, o vencimento passa despercebido e a viatura roda com documentação vencida.

**Por que acontece:**
A primeira versão "funcional" costuma calcular apenas `data_vencimento - hoje() < N dias` e colorir uma célula — sem pensar em quem recebe o alerta, com que antecedência, e o que acontece se ninguém agir.

**Como evitar:**
- Definir múltiplos limiares de antecedência (ex.: 30/15/7/0 dias) com severidade crescente, visível no dashboard/portal desde o primeiro acesso, não só dentro do módulo Transportes.
- Cada documento com vencimento deve ter um responsável (usuário ou papel) associado no cadastro — não depender de "alguém ver a tela".
- Calcular vencimento sempre em relação à data local do fuso do Brasil (`America/Sao_Paulo`), nunca `new Date()` sem fuso explícito no cliente — comparação de datas via string `YYYY-MM-DD` costuma ser mais segura que objetos `Date` para evitar off-by-one perto da meia-noite.
- Estado "vencido" deve ser visualmente distinto (bloqueante) de "vencendo em breve" (informativo) — não usar a mesma cor/ícone para os dois.

**Sinais de alerta:**
Alerta de vencimento só visível dentro do módulo Transportes (não no portal); ausência de campo "responsável" na tabela de documentos; datas comparadas com `new Date()` puro no JS sem tratamento de fuso.

**Fase a endereçar:**
Fase de implementação de "Documentação com alertas de vencimento" dentro do módulo Transportes.

---

### Pitfall 8: Validação numérica insuficiente repetida nos módulos novos

**O que dá errado:**
`CONCERNS.md` já documenta que Máquinas aceita litros negativos, `uso_atual` negativo, preços negativos/NULL causando `NaN` em cálculos de custo. Como Transportes segue "estilo máquinas" (abastecimentos, uso por km/horímetro, custo), há risco alto de herdar exatamente os mesmos buracos de validação — e pior, propagá-los para embarcações (litros de combustível, horas de motor) sem nem o mínimo de `CHECK` que já falta no módulo original.

**Por que acontece:**
Copiar `app.js` do módulo Máquinas como ponto de partida para Transportes copia também as lacunas de validação junto com a lógica de negócio útil.

**Como evitar:**
- Ao portar a lógica de Máquinas para Transportes, adicionar (não só copiar) `CHECK (valor >= 0)` em colunas numéricas de medição (litros, km, horas, custo) nas migrações SQL novas — não é preciso corrigir Máquinas (fora de escopo), mas Transportes não precisa nascer com o mesmo defeito.
- Validação client-side mínima antes de qualquer submit: litros > 0, km/horas não regressivo em relação ao último registro do mesmo ativo (rejeitar odômetro/horímetro menor que o último valor salvo, exceto fluxo explícito de correção/troca de equipamento).
- Padronizar tratamento de null/undefined desde o início nos módulos novos (`?? `/`?.` consistentes), em vez de herdar a mistura de estilos já presente em `maquinas/app.js`.

**Sinais de alerta:**
Formulário de abastecimento/uso aceitando negativo sem erro; relatório de custo exibindo `NaN` ou `R$ NaN`; km/horímetro do ativo "voltando no tempo" sem alerta.

**Fase a endereçar:**
Fase de implementação de cadastro/uso do módulo Transportes (ao portar lógica de `maquinas/app.js`).

---

### Pitfall 9: Migrações de import não-idempotentes duplicando dados legados

**O que dá errado:**
O padrão comprovado do projeto (import das 171 unidades de refrigeração) usa SQL seed. Se o seed de cada módulo novo não for escrito para ser reexecutável com segurança (`INSERT` simples sem `ON CONFLICT`), qualquer reexecução — por engano, por correção de um erro no seed original, ou por reaplicação em ambiente de teste — duplica os registros. Em um sistema onde ativos são identificados por código/placa, isso quebra buscas, relatórios e alertas (duplicata de vencimento gerando alertas repetidos).

**Por que acontece:**
Scripts de seed "one-shot" são escritos assumindo que rodarão uma única vez, sem pensar em reexecução por depuração ou por múltiplas tentativas de acertar a consolidação (ver Pitfall 1).

**Como evitar:**
- Usar chave natural (placa, código do ativo, número de série) com `UNIQUE` constraint e `ON CONFLICT (chave) DO UPDATE`/`DO NOTHING` em todos os seeds de import.
- Rodar o seed sempre em transação (`BEGIN`/`COMMIT`) para permitir rollback limpo se a validação pós-import (Pitfall 2) falhar.

**Sinais de alerta:**
Contagem de ativos no Postgres maior que a contagem no export legado após reexecução de um seed; ativos duplicados com mesmo código/placa e IDs diferentes.

**Fase a endereçar:**
Fase de importação de inventário de cada módulo, junto com Pitfall 2.

---

### Pitfall 10: Testar direto contra o banco de produção compartilhado

**O que dá errado:**
Existe um único projeto Supabase (`pmoc`) compartilhado por todos os módulos, incluindo os já em produção. Sem um ambiente de teste separado (schema, projeto Supabase de staging, ou pelo menos um schema `_test`), qualquer erro em uma migração aditiva de Transportes/Elétrica/Fonoclama corre o risco de impactar RLS, funções ou triggers globais usados por Refrigeração e Máquinas — mesmo que a intenção seja só adicionar tabelas novas com prefixo próprio.

**Por que acontece:**
Não há budget/tempo para provisionar um segundo projeto Supabase; "é só uma migração aditiva" cria falsa sensação de segurança quando na prática RLS, roles e funções podem ser compartilhados entre módulos.

**Como evitar:**
- Antes de aplicar qualquer migração nova em produção, rodar localmente com Supabase CLI (`supabase start`) ou, no mínimo, revisar a migração linha a linha buscando por qualquer comando que não seja estritamente aditivo (nenhum `ALTER TABLE ... DROP`, nenhum `ALTER POLICY` em tabela existente, nenhuma função/trigger global sobrescrita).
- Migrações numeradas aditivas (convenção já estabelecida) devem ser sempre `CREATE TABLE IF NOT EXISTS` / `CREATE POLICY` com nomes exclusivos por módulo — nunca reaproveitar nome de política/função já usado por Refrigeração/Máquinas.
- Validar manualmente, após cada migração aplicada em produção, que os módulos existentes carregam sem erro (smoke test rápido: login + carregar dashboard de Refrigeração e Máquinas).

**Sinais de alerta:**
Migração de módulo novo alterando função ou policy com nome genérico (não prefixado); ausência de teste de fumaça nos módulos existentes após aplicar migração nova.

**Fase a endereçar:**
Todas as fases de schema/migração — critério de verificação (UAT) fixo em cada plano de fase.

---

## Padrões de Dívida Técnica

Atalhos que parecem razoáveis mas criam problemas de longo prazo.

| Atalho | Benefício imediato | Custo de longo prazo | Quando é aceitável |
|--------|---------------------|------------------------|----------------------|
| Copiar `app.js`/`index.html` de módulo existente byte a byte como ponto de partida | Entrega rápida, padrão comprovado | Propaga bugs conhecidos (validação, RLS permissivo, drift de auth) para 3 módulos novos | Aceitável como esqueleto inicial, nunca como versão final sem revisão dos pontos já mapeados em `CONCERNS.md` |
| Import de inventário sem comparação pós-import | Menos trabalho na fase de migração | Dados legados perdidos silenciosamente, só descoberto meses depois | Nunca — mesmo com prazo apertado, a comparação de contagens/somas é barata comparada ao custo de descoberta tardia |
| Um único campo `uso_atual` genérico para km e horas | Reaproveita schema de Máquinas sem alteração | Cálculos de manutenção errados para embarcações, retrabalho de schema depois | Nunca para Transportes (frota mista desde o início) |
| Alertas de vencimento com um único limiar de dias | Implementação mais simples | Vencimentos perdidos por falta de escalonamento | Aceitável só para uma primeira versão interna de teste, nunca para uso operacional real |
| Adiar extração de CSS/auth compartilhado até o 3º módulo | Foco total em entregar Transportes primeiro | Duplicação triplicada de manutenção quando Fonoclama chegar | Aceitável até o 2º módulo (Elétrica); extrair antes do 3º (Fonoclama) |

## Armadilhas de Integração

Erros comuns ao conectar com serviços externos.

| Integração | Erro comum | Abordagem correta |
|------------|-------------|---------------------|
| Supabase RLS | Copiar política `using (true)` para tabelas novas "porque é o padrão" | Revisar RLS por papel para cada tabela nova, mesmo mantendo estrutura idêntica ao padrão existente |
| Supabase Auth (e-mail sintético `@cmasm.local`) | Hardcodar mapeamento cargo→e-mail em cada módulo novo | Compartilhar `shared/auth.js` por referência ou mover mapeamento para tabela no banco |
| Vercel roteamento estático (`vercel.json`) | Esquecer de adicionar rota nova e só descobrir em produção (404) | Checklist de deploy por módulo: rota adicionada, testada localmente antes do push |
| Migrações SQL aditivas | Reexecutar seed sem idempotência, duplicando dados legados | `ON CONFLICT` por chave natural + transação em todo script de import |

## Armadilhas de Performance

Padrões que funcionam em pequena escala mas falham conforme o uso cresce.

| Armadilha | Sintomas | Prevenção | Quando quebra |
|-----------|----------|-----------|----------------|
| `carregarTudo()` sem paginação (já presente em Máquinas) replicado em Transportes | Carregamento lento no celular em campo, especialmente offline/3G | Paginação server-side (`.range()`) desde o início para tabelas que crescem rápido (abastecimentos, OS) | Acima de ~500-1000 registros por tabela |
| Arquivo único (estilo refrigeração) crescendo sem CSS/JS compartilhado | Tempo de carregamento inicial cresce a cada feature nova | Extrair CSS/JS comum entre Elétrica e Fonoclama antes do 2º módulo | Acima de ~300-400 KB por arquivo |
| Alertas de vencimento calculados no client a cada carregamento de página | Recalcula para todos os documentos toda vez, mesmo sem mudança | Calcular status de vencimento também no banco (view/coluna computada) para permitir filtro/ordenação eficiente | Acima de algumas centenas de documentos rastreados |

## Erros de Segurança

Questões de segurança específicas do domínio, além do básico OWASP.

| Erro | Risco | Prevenção |
|------|-------|-----------|
| RLS permissivo replicado para módulos novos (ver Pitfall 4) | Qualquer usuário autenticado (inclusive `observador`) pode alterar/apagar dados de frota, elétrica, PA — inclusive dados usados em decisão operacional militar | Política por papel desde a primeira migração dos módulos novos, não deixar para "depois" |
| Ausência de trilha de auditoria em dados sensíveis (status de viatura, documentação vencida) | Impossível responder "quem marcou este documento como renovado" em auditoria/incidente | Tabela de auditoria mínima (`changed_by`, `changed_at`, `old/new`) pelo menos nas tabelas de documentação e status operacional dos novos módulos |
| E-mail sintético (`@cmasm.local`) sem validação real, replicado para módulos novos | Sem fluxo de recuperação de senha real; drift entre módulos se domínio mudar | Centralizar decisão de domínio/auth (Pitfall 5) antes de replicar para 3 módulos |

## Armadilhas de UX

Erros comuns de experiência do usuário neste domínio.

| Armadilha | Impacto no usuário | Abordagem melhor |
|-----------|----------------------|---------------------|
| Alerta de vencimento só visível dentro do módulo Transportes | Gestor só descobre vencimento se abrir o módulo específico naquele dia | Sumário de vencimentos críticos visível no portal (`/`) agregando todos os módulos |
| Unidade de medida (km vs. hora) não exibida junto ao número | Técnico confunde intervalo de manutenção entre viatura e embarcação | Sempre exibir unidade junto ao valor (`1.200 km` / `340 h`), nunca número solto |
| Login por cargo sem distinção clara de papel disponível para o módulo | Usuário tenta logar com cargo que não existe naquele módulo (ex.: "condutor" só em Transportes) | Lista de cargos disponíveis por módulo visível na tela de login, consistente com o que existe no banco |

## Checklist "Parece Pronto Mas Não Está"

Coisas que parecem completas mas estão faltando peças críticas.

- [ ] **Import de inventário legado:** Frequentemente falta a comparação pós-import (contagem/soma) — verificar que o total de ativos/documentos no Postgres bate com o export original de cada versão legada consolidada.
- [ ] **Cadastro de ativo misto (viatura/embarcação):** Frequentemente falta a coluna/lógica de unidade de uso — verificar que todo cálculo de ciclo de manutenção sabe se está lidando com km ou hora.
- [ ] **RLS de tabela nova:** Frequentemente falta restrição por papel — verificar logando como `observador` que escrita é de fato bloqueada, não só que a política existe.
- [ ] **Alerta de vencimento:** Frequentemente falta responsável e escalonamento — verificar que existe campo de responsável e que há mais de um limiar de antecedência, não só "vence amanhã".
- [ ] **Rota nova no Vercel:** Frequentemente falta atualizar `vercel.json` — verificar acesso direto à URL do módulo em produção após deploy, não só navegação pelo portal.
- [ ] **Validação numérica em formulários de uso/abastecimento:** Frequentemente falta rejeitar valores negativos ou regressivos — verificar submissão com litros negativos e km/horímetro menor que o último registrado.

## Estratégias de Recuperação

Quando armadilhas ocorrem apesar da prevenção, como recuperar.

| Pitfall | Custo de recuperação | Passos de recuperação |
|---------|------------------------|--------------------------|
| Dados legados divergentes importados incorretamente | MÉDIO | Reexecutar seed idempotente após corrigir mapa de campos; comparar totais novamente; comunicar aos usuários do módulo antes de reabrir acesso |
| RLS permissivo detectado após deploy | BAIXO–MÉDIO | Aplicar migração aditiva nova com políticas corretas (não alterar as antigas, criar substituição); revogar policy antiga via nova migração; testar com todos os papéis antes de considerar resolvido |
| Campo `uso_atual` sem unidade descoberto tarde (após dados reais lançados) | ALTO | Migração de schema para adicionar `unidade_uso`, script de backfill inferindo unidade por `tipo_modelo` existente, validação manual de amostra antes de confiar no backfill automático |
| Duplicação de dados por seed não-idempotente | BAIXO | Identificar duplicatas por chave natural, `DELETE` das duplicatas mantendo o registro mais completo/recente, adicionar `UNIQUE constraint` retroativamente |
| Arquivo único módulo passou de 500 KB antes de perceber | MÉDIO | Extrair CSS/JS compartilhado numa migração de refactor pontual (fora do fluxo normal de feature), sem alterar comportamento — tratar como fase própria, não meter no meio de uma entrega de feature |

## Mapeamento Pitfall → Fase

Como as fases do roadmap devem endereçar essas armadilhas.

| Pitfall | Fase de prevenção | Verificação |
|---------|----------------------|----------------|
| Consolidação de versões divergentes (1) | Fase de análise/consolidação de cada módulo (antes do schema) | Existe `CONSOLIDACAO.md`/mapa de campos por módulo com regras de desempate documentadas |
| Migração big-bang sem validação (2) | Fase de importação de inventário de cada módulo | Contagem/soma pós-import bate com export legado; script de comparação documentado |
| Campo de uso misto km/hora (3) | Fase de design de schema do módulo Transportes | Coluna `unidade_uso` existe e é usada em todo cálculo de ciclo/plano; `CHECK` impede mismatch |
| RLS permissivo copiado (4) | Fase de schema/RLS de cada módulo novo | Teste manual com papel `observador` confirma bloqueio de escrita antes do módulo ir ao ar |
| Drift de auth duplicado (5) | Fase de setup do primeiro módulo novo (Transportes) | Decisão de compartilhamento de `auth.js` registrada no PROJECT.md e aplicada nos 3 módulos |
| Arquivo único sem modularização (6) | Fase de setup de Elétrica (2º módulo "estilo refrigeração") | CSS/JS comum extraído para `shared/` antes de iniciar Fonoclama |
| Alertas de vencimento sem escalonamento (7) | Fase de "Documentação com alertas de vencimento" em Transportes | Múltiplos limiares implementados, responsável obrigatório no cadastro de documento |
| Validação numérica insuficiente (8) | Fase de implementação de cadastro/uso em Transportes | `CHECK` no banco + validação client-side testados com valores negativos/regressivos |
| Seed não-idempotente (9) | Fase de importação de inventário de cada módulo (junto com 2) | Reexecução do seed em ambiente de teste não duplica registros |
| Teste direto em produção compartilhada (10) | Todas as fases de migração/schema | Smoke test de módulos existentes após cada migração aplicada, registrado como critério de verificação do plano |

## Fontes

- `.planning/codebase/CONCERNS.md` (mapeamento direto do código existente — ALTA confiança, evidência primária deste repositório)
- `.planning/PROJECT.md` (contexto e decisões do ciclo — ALTA confiança, fonte primária do projeto)
- Busca web geral sobre armadilhas de RLS no Supabase (múltiplas fontes de blog/vendor, 2026) — confiança BAIXA, não verificada especificamente para este domínio, usada apenas para confirmar padrão já observado no código
- Busca web geral sobre migração de dados legados para Postgres — confiança BAIXA, síntese de práticas de mercado
- Busca web geral sobre design de schema de frota mista (odômetro vs. horímetro) — confiança BAIXA, síntese de práticas de mercado, alinhada com a necessidade explícita do PROJECT.md (viaturas + embarcações)
- Busca web geral sobre pitfalls de sistemas de alerta de vencimento documental — confiança BAIXA, síntese de práticas de mercado

---
*Pesquisa de pitfalls para: consolidação de apps legados + expansão modular sobre Supabase compartilhado (PMOC/CMASM)*
*Pesquisado em: 2026-08-08*
