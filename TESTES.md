# Validação do banco — 07/08/2026

Projeto Supabase `pmoc` · `thoaqipyhfmromsgzmjs` · sa-east-1

## Leitura anônima (modo Livre) — ✅

| Tabela | Registros |
|--------|-----------|
| equipamentos | 171 |
| arp_itens | 19 |
| os_contratacao | 2 |
| os_eventos | 2 |
| plano_tarefas | 9 |
| maq_ativos | 7 |
| maq_planos | 59 |
| maq_materiais | 34 |
| maq_plano_materiais | 49 |

## Joins usados pelos apps — ✅

- `maq_plano_materiais → maq_materiais(nome,unidade,preco)`
- `maq_os → maq_ativos(codigo,nome), maq_planos(nome)`
- `equipamentos` com todas as colunas do v2.8

## Autenticação — ✅

| Cargo | Login |
|-------|-------|
| direcao@cmasm.local | ✅ |
| gestor@cmasm.local | ✅ |
| tecnico@cmasm.local | ✅ |

## RLS — ✅

| Operação | Anônimo | Técnico |
|----------|---------|---------|
| SELECT | ✅ permitido | ✅ permitido |
| INSERT | ✅ **bloqueado** | ✅ permitido |
| UPDATE | — | ✅ HTTP 204 |
| DELETE | — | ✅ (policy adicionada) |

## Escritas testadas — ✅

- OS preventiva criada e removida
- Registro de uso (horímetro) criado e removido
- Abastecimento criado — coluna gerada `custo_total` calculou R$ 65,00 (10 L × R$ 6,50)
- Update de `uso_atual` em `maq_ativos`

## Correção aplicada

Faltavam policies de `DELETE` nas tabelas `maq_*`. Adicionadas no banco
e em `supabase/01_maquinas_schema.sql` para futuras instalações.

## Estado final

Todos os dados de teste removidos. Contadores conferidos em zero
(`maq_os`, `maq_uso_registros`, `maq_abastecimentos`) e `uso_atual` do FS220-01 de volta a 0.

## Operações por área — implementação 08/08/2026

### Testes automatizados

```bash
node --test tests/operacoes-maquinas.test.js \
	tests/schema-operacoes-maquinas.test.js \
	tests/integracao-operacoes-maquinas.test.js
```

Resultado esperado: **9 testes aprovados**.

### Preparação

- [x] Executar `supabase/12_maquinas_areas_operacoes.sql` no SQL Editor.
- [x] Executar `supabase/13_corrige_permissao_rpc_operacoes.sql` no SQL Editor.
- [x] Confirmar que `maq_areas`, `maq_operacoes` e `concluir_maq_operacao` existem.
- [x] Confirmar leitura anônima das tabelas e bloqueio de escrita com `401/42501`.
- [x] Confirmar bloqueio anônimo da RPC com `401/42501`.
- [x] Confirmar acesso do Gestor à RPC com validação `P0001` para UUID inexistente.
- [ ] Entrar como Gestor e confirmar os botões `+ Área` e `+ Operação`.
- [ ] Entrar no modo Livre e confirmar que os botões de escrita não aparecem.

### Fluxo manual

- [ ] Cadastrar uma área sem utilizar dados de demonstração.
- [ ] Programar uma operação vinculando área, máquina, data e operador.
- [ ] Confirmar que a operação aparece em **Programadas** e na **Agenda**.
- [ ] Iniciar a operação e confirmar a mudança para **Em execução**.
- [ ] Concluir informando horas, área executada e combustível utilizado.
- [ ] Confirmar que a operação aparece em **Concluídas**.
- [ ] Confirmar que `maq_ativos.uso_atual` foi incrementado uma única vez.
- [ ] Confirmar que `maq_uso_registros` recebeu o delta, total, operador e área.
- [ ] Tentar concluir novamente e confirmar que a RPC bloqueia a duplicidade.
- [ ] Simular erro de permissão e confirmar que o modal permanece aberto com mensagem.

## Transportes — implementação 08/08/2026

### Preparação

- [ ] Executar `supabase/10_transportes_schema.sql` no SQL Editor.
- [ ] Executar `supabase/11_transportes_seed.sql` no SQL Editor.
- [ ] Confirmar leitura anônima das tabelas `transp_ativos`, `transp_viagens` e `transp_manutencoes`.
- [ ] Confirmar bloqueio de escrita anônima e escrita permitida para Gestor/Técnico.

### Fluxo manual

- [ ] Abrir `transportes/index.html` por servidor local e confirmar o login por cargo.
- [ ] Entrar no modo Livre e confirmar visualização da frota importada com 9 ativos e 23 viagens.
- [ ] Entrar como Gestor ou Técnico e cadastrar um novo ativo.
- [ ] Registrar uma viagem concluída com `uso_chegada` maior que `uso_saida` e confirmar atualização de `transp_ativos.uso_atual`.
- [ ] Registrar uma manutenção preventiva com `prox_manutencao` e confirmar exibição do alerta no painel.
- [ ] Editar uma viagem importada e confirmar persistência no histórico.
- [ ] Exportar o CSV de viagens e confirmar colunas `ativo_codigo`, `destino`, `missao` e `status`.

## Elétrica e Fonoclama — implementação 09/08/2026

### Preparação

- [ ] Executar `supabase/14_eletrica_fonoclama_schema.sql` no SQL Editor.
- [ ] Executar `supabase/15_eletrica_seed.sql` e `supabase/16_fonoclama_seed.sql`.
- [ ] Conferir contagens: `elet_ativos` 13, `elet_planos` 9, `elet_materiais` 11, `elet_plano_materiais` 14.
- [ ] Conferir contagens: `fono_ativos` 10, `fono_planos` 7, `fono_materiais` 10, `fono_plano_materiais` 13.
- [ ] Reexecutar os dois seeds e confirmar que as contagens não mudam (idempotência).
- [ ] Confirmar leitura anônima e bloqueio de escrita anônima nas tabelas `elet_*` e `fono_*`.

### Não regressão da produção

- [ ] Abrir `/refrigeracao` e `/maquinas` após as migrações e confirmar carga normal dos dados.
- [ ] Abrir `/transportes` e confirmar a frota e as viagens intactas.

### Fluxo manual (repetir nos dois módulos)

- [ ] Abrir `/eletrica` e `/fonoclama` por servidor local e confirmar o login por cargo.
- [ ] Entrar como Observador e confirmar que todos os botões de escrita estão desabilitados.
- [ ] Entrar como Gestor ou Técnico e cadastrar um ativo novo.
- [ ] Registrar uso e confirmar o incremento do horímetro no ativo e a linha em `*_uso_registros`.
- [ ] Confirmar que a aba Vencimentos passa a apontar a próxima manutenção do plano do tipo.
- [ ] Abrir OS a partir de um vencimento, concluí-la e confirmar a baixa das peças previstas
      em `*_materiais.estoque_atual` e o movimento em `*_estoque_movimentos`.
- [ ] Confirmar `custo_pecas` preenchido na OS concluída.
- [ ] Registrar uma OS com não conformidade e ação corretiva e conferir o histórico.
- [ ] Exportar a lista de compras em CSV e conferir as colunas `comprar` e `total`.

### Testes automatizados

```bash
node --test tests/vencimento-modulos.test.js
```

## Predial — implementação 09/08/2026

### Preparação

- [ ] Executar `supabase/17_predial_schema.sql` no SQL Editor.
- [ ] Executar `supabase/18_predial_seed.sql` no SQL Editor.
- [ ] Conferir contagens: `pred_normas` 10, `pred_locais` 150, `pred_checklist_templates` 3, `pred_checklist_itens` 206.
- [ ] Reexecutar o seed e confirmar que as contagens não mudam (idempotência).
- [ ] Conferir que a raiz da árvore é o local 151 (CMASM) e que nenhum local ficou órfão:
      `select count(*) from pred_locais f where f.parent_id is not null and not exists (select 1 from pred_locais p where p.id = f.parent_id);` deve dar 0.
- [ ] Abrir `/refrigeracao`, `/maquinas`, `/transportes`, `/eletrica` e `/fonoclama` e confirmar que nada regrediu.

### Fluxo manual

- [ ] Abrir `/predial`, logar por cargo e conferir a árvore de locais indentada na aba Locais.
- [ ] Entrar como Observador e confirmar que os botões de escrita ficam desabilitados.
- [ ] Editar um local e confirmar o aviso verde "Local ... atualizado" **e** a linha
      já alterada na tabela, sem precisar recarregar a página.
- [ ] Abrir a aba Templates e conferir os 3 templates com os itens agrupados por sistema.
- [ ] Criar um template novo, adicionar um item e removê-lo.
- [ ] Criar uma inspeção **sem** escolher template, abrir o checklist e usar
      "Associar e carregar" para vincular o template depois.
- [ ] Criar inspeção escolhendo local e o template "Inspeção Predial Completa".
- [ ] Clicar em "Carregar itens do template" e confirmar que os 206 itens entram como `item_origem = 'template'`.
- [ ] Clicar de novo e confirmar que nada duplica.
- [ ] Pontuar um item com G=10, U=10, T=6 e confirmar `gut_total = 600` e faixa **Crítico**
      (coluna gerada no banco — o app não grava `gut_total`).
- [ ] Marcar "presente", preencher local e observação e recarregar a página para conferir a persistência.
- [ ] Avançar o status planejada → em execução → aguardando aprovação → aprovada → concluída
      e confirmar uma linha por transição em `pred_eventos`.
- [ ] Tentar uma transição inválida e confirmar o bloqueio com aviso.
- [ ] Reprovar uma inspeção e confirmar que o motivo foi gravado em `pred_eventos.motivo`.
- [ ] Emitir laudo a partir da inspeção e conferir o rascunho com as anomalias ordenadas por GUT.
- [ ] Exportar o CSV de anomalias e conferir as colunas `gut` e `faixa`.

### Testes automatizados

```bash
node --test tests/predial-dominio.test.js
```

## Locais compartilhados — implementação 10/08/2026

### Preparação (nesta ordem)

- [x] Executar `supabase/19_cmasm_locais_unificado.sql` (renomeia, separa organograma, cria local_id).
- [x] Conferir: `select count(*) from cmasm_estrutura;` deve dar **78**.
- [x] Conferir: `select count(*) from cmasm_locais where ativo;` deve dar **72**.
- [x] Executar `supabase/20_cmasm_locais_predios.sql` (deriva prédios e salas da Refrigeração).
- [x] Conferir: 29 `edificacao`, 132 `sala`, e `select count(*) from equipamentos where local_id is null;` = **0**.
- [x] Executar `supabase/21_vincula_locais_modulos.sql`.
- [ ] Rodar a query de conferência no rodapé da 21 e anotar os locais de Elétrica/Fonoclama
      que ficaram sem vínculo — são textos dos apps de demonstração, resolver pela tela.

### Não regressão

- [x] Abrir `/refrigeracao` e confirmar as 171 unidades carregando normalmente após o ALTER TABLE.
- [x] Abrir `/maquinas` e `/transportes` e confirmar as listas intactas.

### Fluxo manual

- [x] `/predial` → Locais: a árvore abre fechada, com a raiz CMASM e o total de descendentes.
- [x] Expandir a raiz e conferir os prédios da Refrigeração (ACADEMIA, COMANDO, GARAGEM…).
- [x] Expandir um prédio e ver as salas, com a contagem de ativos na coluna Ativos.
- [ ] "Expandir tudo" / "Recolher tudo" e conferir a contagem total.
- [ ] Digitar no filtro e confirmar que o resultado aparece mesmo com o pai fechado.
- [x] Confirmar que nenhum cargo (encarregado, chefe, direção) aparece mais na árvore.
- [ ] `/eletrica` → editar um ativo: o campo Local agora é uma lista da árvore, não texto livre.
- [ ] Salvar e conferir que o ativo passou a contar na coluna Ativos daquele local no Predial.

## Validação local das migrações (sem tocar na produção)

Antes de rodar qualquer migração no Supabase, dá para ensaiar tudo num Postgres
descartável. Foi assim que o erro `55006: cannot ALTER TABLE ... because it has
pending trigger events` da migração 19 foi encontrado e corrigido.

```bash
docker run -d --name pmoc-teste -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=pmoc -p 55432:5432 postgres:16-alpine
```

```bash
export SUPABASE_DB_URL='postgresql://postgres:teste@localhost:55432/pmoc'
```

O fixture `tests/fixtures/banco-teste.sql` cria os papéis `anon`/`authenticated`
e as tabelas de produção como stub, com os 171 equipamentos reais. Depois é só
tocar as migrações na ordem:

```bash
uv run --with "psycopg[binary]" python supabase/aplicar.py ../tests/fixtures/banco-teste.sql 14_eletrica_fonoclama_schema.sql 15_eletrica_seed.sql 16_fonoclama_seed.sql 17_predial_schema.sql 18_predial_seed.sql 19_cmasm_locais_unificado.sql 20_cmasm_locais_predios.sql 21_vincula_locais_modulos.sql
```

Resultado esperado ao fim: `cmasm_locais` 311, `cmasm_estrutura` 78,
`pred_checklist_itens` 206. E as conferências:

| Conferência | Esperado |
|---|---|
| edificações | 29 |
| salas | 132 |
| locais ativos | 233 |
| locais arquivados (organograma) | 78 |
| equipamentos sem `local_id` | 0 |
| locais órfãos | 0 |
| nós de estrutura órfãos | 0 |

Rodar 19, 20 e 21 uma segunda vez deve manter as contagens idênticas.

Ao terminar: `docker rm -f pmoc-teste`.

## Módulo Mapa (/mapa) — implementação 10/08/2026

### Preparação

- [ ] Servir o repositório por HTTP a partir da raiz (`python -m http.server`) —
      abrir via `file://` quebra a descoberta de credenciais do
      `shared/supabase-config.js`.

### Fluxo manual

- [ ] Abrir `/mapa`.
- [ ] Entrar por cargo (qualquer um, inclusive "Livre").
- [ ] Confirmar que o mapa Leaflet renderiza centrado no CMASM.
- [ ] Alternar os botões Mapa/Satélite e confirmar a troca de basemap sem recarregar a página.
- [ ] Ativar e desativar cada um dos três módulos da barra lateral (Aguada, Grama, Elétrica)
      e verificar que o painel de filtros do xMap acompanha (mostra/oculta as camadas).
- [ ] Confirmar no console do navegador que não há erro de rede nem de conteúdo misto.
- [ ] Clicar em Sair e confirmar que a tela de login volta.

### Não regressão

- [ ] `/transportes`, `/maquinas`, `/refrigeracao`, `/eletrica`, `/fonoclama` e `/predial`
      continuam abrindo normalmente.
- [ ] O card **Mapa** no portal (`/`) leva a `/mapa`.

## Conferência do import do CSV de VTR/EMB (Transportes)

A importação da programação de VTR/EMB já foi aplicada por
`supabase/11_transportes_seed.sql` e conferida linha a linha em
`.planning/phases/01-transportes-frota-sob-manuten-o/01-CONFERENCIA-IMPORT.md`
(9/9 ativos e 23/23 viagens reconciliados, seed idempotente por `codigo` e por
`chave_importacao`). Para confirmar o estado em produção, rodar no SQL Editor
do Supabase:

```sql
-- esperado: 9
select count(*) from transp_ativos;

-- esperado: 23
select count(*) from transp_viagens
where importado_de = 'Mapa de VTR e EMB ATU 20FEV26.csv';

-- esperado: igual ao total de linhas acima (nenhuma chave duplicada)
select count(distinct chave_importacao) from transp_viagens
where importado_de = 'Mapa de VTR e EMB ATU 20FEV26.csv';
```

Se os números vierem menores que o esperado, a correção é reexecutar
`11_transportes_seed.sql` — o seed é idempotente (`on conflict do update`).
**Não** criar migração nova para reimportar o CSV.

## Fase 5 — Base unificada — auditoria de fechamento — 11/08/2026

A Fase 5 unificou os seis módulos novos (`maquinas`, `transportes`, `eletrica`, `fonoclama`,
`predial`, `mapa`) numa base comum: os seis carregam `shared/pmoc.css` como fonte única de
tokens visuais (a única cor própria que sobra em cada um é `--accent`), autenticam por
`shared/auth.js` (direto ou pelo motor `shared/modulo-manutencao.js`, usado por `eletrica` e
`fonoclama`) e montam cabeçalho, faixa de abas (quando existe) e rodapé pelo shell comum
`shared/shell.js`. A `refrigeracao` fica fora do escopo, congelada por decisão do usuário — a
conferência de que ela não foi tocada é um passo isolado abaixo, não uma presunção.

### Preparação

- [x] Rodar `node --test` na raiz do repositório, sem argumento — é a primeira linha de defesa
      contra regressão e precisa estar verde antes de qualquer conferência manual.
- [ ] Servir o repositório por HTTP a partir da raiz (`python -m http.server`) para os testes
      manuais abaixo — abrir via `file://` quebra a descoberta de credenciais do
      `shared/supabase-config.js`.

### Fluxo manual, por módulo

Repetir para `maquinas`, `transportes`, `eletrica`, `fonoclama`, `predial` e `mapa`:

- [ ] Abrir a rota do módulo (`/maquinas`, `/transportes`, `/eletrica`, `/fonoclama`, `/predial`, `/mapa`).
- [ ] Entrar por cada cargo (admin, gestor, tecnico) e confirmar que a tela de login nunca exibe
      o e-mail interno do cargo.
- [ ] Entrar no acesso Livre e confirmar que continua sem exigir senha, com o chip
      "Livre · observador" aparecendo onde o cabeçalho/rodapé mostra a função do usuário.
- [ ] Entrar como Observador (ou Livre) e confirmar que nenhum botão de escrita aparece.
- [ ] Percorrer todas as abas do módulo (dez em Máquinas, sete em Transportes, seis em Predial,
      seis em Elétrica/Fonoclama; Mapa não tem abas — navega pela barra lateral de camadas,
      confirmar que a faixa de abas simplesmente não aparece).
- [ ] Confirmar que o rodapé aparece com nome do módulo, versão e link "← Portal" para `/`.
- [ ] Confirmar, no console do navegador, ausência de erro de referência (função não definida) —
      é o que o gate dos handlers inline (`exporNoWindow()`) protege, mas só o clique real confirma.

### Conferência isolada de não regressão da refrigeração (PLAT-15)

Este passo é isolado de propósito, e não pode ser substituído por presunção: a rota
`/refrigeracao` continuou ativa durante toda a fase, então é fácil deixá-la aberta numa aba e
supor que "está tudo igual" sem checar.

- [x] Verificação estática por histórico: `git diff --name-only b53505c..HEAD -- refrigeracao/`
      retorna lista vazia — nenhum commit da fase tocou o diretório.
- [x] Verificação estática por busca: `refrigeracao/index.html` não referencia `shared/` nem
      `pmoc.css` (`grep -c 'shared/\|pmoc.css' refrigeracao/index.html` = 0), a mesma busca que já
      retornava vazio antes da fase começar.
- [ ] Verificação humana com o inspetor de rede aberto: abrir `/refrigeracao` **depois de toda a
      fase concluída**, confirmar que nenhuma requisição de rede aponta para `shared/` ou para
      qualquer arquivo compartilhado, e que o console termina sem erro.
- [ ] Percorrer o fluxo principal (login, inventário, uma ordem de contratação) e confirmar que
      está igual ao que era antes da fase.

### Testes automatizados

```bash
node --test
```

Resultado esperado: **25 testes aprovados, 0 falhas** (eram 19 no início da fase; os 6 testes
novos são de `tests/shell.test.js`, plano 05-01).

## Fase 6 — Tema claro/escuro — auditoria de fechamento — 11/08/2026

A Fase 6 dá aos 6 módulos e ao portal um segundo tema, claro, ao lado do escuro que já existia.
`shared/pmoc.css` ganhou um bloco `[data-theme="claro"]` aditivo com os 12 tokens de cor do tema
claro (o bloco `:root` escuro continua sendo o padrão, byte-idêntico); `shared/tema.js` é a
implementação única de detecção (`localStorage` → `prefers-color-scheme` → padrão escuro),
validação por lista fechada, aplicação, alternância e persistência de tema para as 7 superfícies
do projeto; o botão de alternância sai de `shared/shell.js` (`montarShell()`), e por isso aparece
nos 6 módulos de uma vez, sem tocar em nenhum `index.html` de módulo para esse fim; um script
clássico (não `type="module"`, sem `src` externo) replicado byte-idêntico no `<head>` das 7
superfícies aplica o tema salvo antes do primeiro desenho, para eliminar a piscada de tema errado
ao recarregar a página; e o portal (`/index.html`, D-02) recebeu o próprio bloco de tokens claros
embutido, porque não carrega `shared/pmoc.css`, mas nenhuma lógica própria — ele consome
`shared/tema.js` como os 6 módulos. A `refrigeracao` ficou fora da fase inteira, congelada por
decisão do usuário (D-04); a conferência de que ela não foi tocada é um passo isolado abaixo, não
uma presunção.

### Preparação

- [ ] Rodar `node --test` na raiz do repositório, sem argumento, antes de qualquer conferência
      manual — é a primeira linha de defesa contra regressão.
- [ ] Servir o repositório por HTTP a partir da raiz (`python -m http.server`) — abrir por
      `file://` quebra a descoberta de credenciais do `shared/supabase-config.js` e agora também
      o script de tema do portal.
- [ ] Limpar o armazenamento local do domínio (`localStorage.clear()` no console, ou "Limpar
      dados do site" nas ferramentas do navegador) antes de começar — para que o primeiro item do
      roteiro abaixo teste de fato uma primeira visita, sem preferência salva.

### Roteiro manual, por superfície

Repetir para as 7 superfícies do projeto — `/` (portal), `/maquinas`, `/transportes`,
`/eletrica`, `/fonoclama`, `/predial`, `/mapa`:

- [ ] O botão de tema aparece na barra superior (no portal, no cabeçalho institucional, ao lado
      da legenda; nos 6 módulos, na `topbar-right`, antes do chip de usuário).
- [ ] Clicar no botão alterna o tema **sem recarregar a página**.
- [ ] O rótulo/título/texto acessível do botão muda junto, oferecendo sempre o tema que **ainda
      não** está em vigor (mostra "Ir para o tema claro" quando o escuro está em vigor, e
      vice-versa).
- [ ] Recarregar a página com o tema claro em vigor: a página **não pisca** no tema escuro antes
      de assentar no claro (é o que o script de pré-desenho no `<head>` existe para evitar).
- [ ] Em navegador móvel (ou emulação de dispositivo), a cor da barra do navegador acompanha o
      tema (visível a partir da `<meta name="theme-color">`, atualizada por `aplicarTema()`).

### Roteiro dos cinco critérios de sucesso da fase

Cada critério como item nomeado, para que nenhum se perca:

- [ ] **Critério 1 — alternância presente e sem recarga.** Já coberto pelo bloco acima, repetido
      nas 7 superfícies.
- [ ] **Critério 2 — ausência de CSS de tema por módulo.** Abrir o bloco `<style>` de cada
      `index.html` dos 6 módulos e confirmar que a única declaração de cor própria é `--accent`;
      nenhum módulo declara `--bg`/`--surface`/`--surface2`/`--border`/`--text`/`--text2`/
      `--text3`/`--green`/`--yellow`/`--red`/`--blue`/`--orange`, nem cria um bloco
      `[data-theme="claro"]` próprio. (Gate estrutural equivalente em
      `tests/tema-superficies.test.js`, mas a leitura visual do `<style>` é a conferência final.)
- [ ] **Critério 3 — persistência entre sessões e entre módulos.** Escolher o tema claro em
      `/maquinas`, fechar a aba (ou o navegador inteiro) e reabrir em `/transportes`: o tema claro
      continua em vigor sem precisar escolher de novo. Isto só se prova fechando e reabrindo o
      navegador de verdade — **nenhum comando substitui este item**.
- [ ] **Critério 4 — preferência do sistema na primeira visita.** Com o armazenamento limpo
      (preparação acima), trocar o tema do sistema operacional para claro, abrir qualquer
      superfície e confirmar que ela abre no tema claro sem nenhum clique; repetir trocando o
      sistema para escuro.
- [ ] **Critério 5 — legibilidade dos estados de alerta nos dois temas.** Abrir, em cada tema, ao
      menos uma view com callout de vencido (`.co-red`/`.co-warn`), uma com estoque baixo e uma
      com equipamento inoperante (INOP) — por exemplo, abas de Materiais/Estoque e de Ativos em
      `maquinas`, `transportes` ou `predial` — e confirmar visualmente que o texto do alerta e a
      borda dele têm a mesma cor (não uma cor "presa" no tema antigo) e são legíveis sobre o
      fundo em ambos os temas.

### Bordas a exercitar

Bloco próprio, numerado — são bordas que quebram em produção e não aparecem em teste
automatizado:

1. [ ] Bloquear o armazenamento local pela política de privacidade do navegador (ou modo privado
       com bloqueio de terceiros) e abrir uma superfície: a página precisa carregar normalmente e
       o tema ainda alternar **dentro da sessão** (só não persiste entre recargas).
2. [ ] Pelo console do navegador, gravar à mão um valor inválido na chave (`localStorage.setItem
       ('pmoc-tema','sistema')`) e recarregar a página: o tema precisa cair para a preferência do
       sistema operacional, **não** aplicar o valor corrompido.
3. [ ] Abrir um modal em qualquer módulo (cadastro de ativo, OS, material) e alternar o tema com
       o modal aberto: o modal **não fecha** e o que estava digitado **não se perde** — trocar o
       tema só reescreve o atributo `data-theme` do elemento raiz.
4. [ ] Abrir dois módulos em abas diferentes do mesmo navegador, alternar o tema numa delas e
       recarregar a outra: a outra aba passa a exibir a nova preferência (não há sincronização em
       tempo real entre abas, só ao recarregar/navegar — comportamento esperado, não defeito).

### Limitação conhecida de D-01 — mapa Leaflet permanece escuro

Em `/mapa`, a barra superior, o rodapé, o botão de tema e os painéis que vêm da folha comum
(`shared/pmoc.css`) alternam normalmente nos dois temas. A barra lateral de camadas, as legendas
e os balões de marcador do Leaflet/xMap **continuam escuros nos dois temas**, porque
`mapa/xmap.css` tem um sistema de tokens próprio (`--xm-*`) e ficou fora do escopo desta fase, por
decisão registrada no roadmap (D-01). **Isto é esperado e não deve ser reportado como defeito** —
é candidato a item de backlog para uma fase futura, não uma falha da Fase 6.

### D-05 — Calibração (`/calibracao`) fica fora da convenção de tema da plataforma

Durante esta fase, uma tarefa concorrente (`quick-260811-9sb`, commits `240cfa6`/`eb1e342`)
importou o app legado de Calibração como módulo independente em `/calibracao`, com rota própria
em `vercel.json` e card ativo no portal. Isto faz de `/calibracao` uma **8ª superfície** no
repositório, fora da lista de 7 que a decisão D-02 fechou para esta fase (os 6 módulos +
o portal). **Decisão registrada aqui, com o mesmo peso de D-01/D-02/D-03/D-04:**

- **O que fica fora:** `/calibracao` não foi portado para `shared/` nesta fase e não segue a
  convenção `pmoc-tema`/`data-theme="claro"`/`"escuro"` estabelecida por D-03. Não é escopo desta
  fase — portar o módulo para a base comum é trabalho de uma fase própria, não uma tarefa de
  auditoria.
- **Por quê:** o mesmo raciocínio já aplicado a `refrigeracao` (D-04) — um app legado standalone,
  fora do escopo declarado da fase, não deve ser tocado de raspão numa auditoria de fechamento.
- **A diferença importante em relação a `refrigeracao`:** `/calibracao` **não está** simplesmente
  sem tema — o app legado já tem o próprio alternador de tema visível (botão "☀️ Claro"/"🌙
  Escuro" no cabeçalho), mas com mecanismo **incompatível** com a plataforma: chave
  `localStorage['cmasm_erp_theme']` (não `pmoc-tema`), valores `'dark'`/`'light'` em inglês (não
  `'claro'`/`'escuro'`), sem `shared/tema.js` nem qualquer referência a `shared/`. Um usuário que
  troca para o tema claro em `/maquinas` e depois clica no card Calibração no portal chega a uma
  página cujo tema é decidido por um mecanismo totalmente separado — **inconsistência visível ao
  navegar entre módulos**, e não uma ausência de tema.
- **Não é presunção não verificada:** `tests/tema-superficies.test.js` ganhou um caso novo (D-05)
  que prova, por comando, que a chave `pmoc-tema` não vazou para dentro de `calibracao/index.html`
  e que o módulo de fato tem seu próprio `data-theme`, desconectado — a exclusão fica marcada em
  código, não como omissão silenciosa.
- **O que fecharia isto:** uma fase futura de "portar Calibração para a base comum" (mesmo
  trabalho que Transportes/Elétrica/Fonoclama/Predial/Mapa já passaram na Fase 5), candidata a
  item de backlog.

### Conferência isolada de não regressão da refrigeração (PLAT-15)

Este passo é isolado de propósito, e não pode ser substituído por presunção: a rota
`/refrigeracao` continuou ativa durante toda a fase, então é fácil deixá-la aberta numa aba e
supor que "está tudo igual" sem checar.

- [x] Verificação estática por histórico: `git diff --name-only 351b13c..HEAD -- refrigeracao/`
      retorna lista vazia — nenhum commit da fase tocou o diretório (commit `351b13c` é a
      pesquisa da Fase 6, o último antes da execução).
- [x] Verificação estática por busca: `refrigeracao/index.html` não referencia `shared/` nem
      `pmoc.css` (`grep -c 'shared/\|pmoc.css' refrigeracao/index.html` = 0), não menciona a
      chave de tema (`grep -c 'pmoc-tema' refrigeracao/index.html` = 0) e não menciona o atributo
      de tema (`grep -c 'data-theme' refrigeracao/index.html` = 0) — os três gates automatizados
      em `tests/tema-superficies.test.js`.
- [ ] Verificação humana com o inspetor de rede aberto: abrir `/refrigeracao` **depois de toda a
      fase concluída**, confirmar que nenhuma requisição de rede aponta para `shared/` ou para
      qualquer arquivo compartilhado, e que o console termina sem erro. **Pendência herdada da
      Fase 5** — não foi possível em nenhum plano de nenhuma das duas fases, por falta de
      credenciais Supabase e de navegador controlável no ambiente autônomo.
- [ ] Percorrer o fluxo principal (login, inventário, uma ordem de contratação) e confirmar que
      está igual ao que era antes da fase. **Mesma pendência herdada.**

### Verificação em produção — 12/08/2026, após o merge do PR #6

Feita em navegador real contra `https://pmoc-orcin.vercel.app`, depois que a Fase 6 inteira
já estava em `main`. Fecha parte do que a auditoria 06-04 tinha deixado como pendência de UAT,
por medição, não por leitura de código. O que **não** foi coberto continua listado na seção
seguinte.

**Critério 4 — preferência do sistema na primeira visita.** Portal com `localStorage` sem a
chave `pmoc-tema`, navegador em `prefers-color-scheme: light` → `data-theme="claro"` já na
carga. A detecção salvo → sistema → padrão funciona no navegador, não só no teste de unidade.

**Critérios 1 e 3 — alternância e persistência entre módulos.** Clique real em `#btn-tema` no
portal: `claro → escuro`, gravado em `localStorage['pmoc-tema']`. Navegação em seguida para
`/maquinas`: herdou `escuro` e trouxe o botão. Persistência entre superfícies confirmada com
sessão de navegador real.

**Critério 5 — contraste medido, não calculado.** Medido sobre a renderização real em
`/maquinas`, compondo o alfa de 8% do fundo dos callouts sobre o fundo da página (o valor de
`background-color` deles é `color(srgb … / 0.08)`, então medir o texto contra o fundo declarado
dá número errado):

| Elemento | Tema claro | Tema escuro | Mínimo AA |
|---|---|---|---|
| Texto do corpo | 14,05:1 | 13,71:1 | 4,5:1 |
| `co-warn` (aviso) | **4,81:1** | 6,68:1 | 4,5:1 |
| `co-ok` (conforme) | 5,08:1 | **4,90:1** | 4,5:1 |

Todos passam. A margem mais estreita é `co-warn` no tema claro, **0,31 acima do limite** — vale
tratar esse par de cores como intocável sem nova medição. `co-red` e `co-blue` existem em
`shared/pmoc.css` mas não estavam renderizados em `/maquinas`; medir quando aparecerem numa
página com esses estados.

**D-05 reproduzida.** Com `localStorage['pmoc-tema'] = 'claro'`, `/calibracao` recarregada
continuou escura: `data-theme="dark"` (vocabulário próprio, não `escuro`), fundo
`rgb(7, 17, 31)` contra `rgb(26, 26, 24)` da plataforma, sem `#btn-tema`, e
`localStorage['cmasm_erp_theme'] = 'dark'` convivendo com `pmoc-tema = 'claro'` na mesma origem
sem que uma chave saiba da outra. A exclusão registrada em D-05 é o comportamento real em
produção, não uma previsão.

### O que este ambiente autônomo não pode provar

Registrado por escrito, para não desaparecer como se tivesse sido verificado:

- **A conferência visual pós-login** de cada módulo depende de sessão Supabase autenticada —
  a verificação de 12/08 acima cobriu portal, `/maquinas` e `/calibracao` sem autenticar, então
  telas atrás do login continuam por conferir.
- **A ausência de piscada (anti-FOUC)** não foi medida. Que o atributo já esteja correto na
  carga é condição necessária, não prova de que não houve repintura — isso exige gravação de
  quadros ou inspeção de pintura, não uma leitura de estado.
- **A barra do navegador em dispositivo móvel** acompanhando o tema (meta `theme-color`).
- **A conferência humana de rede da refrigeração** (PLAT-15): abrir `/refrigeracao` com o
  inspetor e confirmar que nenhum arquivo compartilhado é carregado. **Pendência herdada da
  Fase 5.**
- **Os quatro módulos restantes** (`transportes`, `eletrica`, `fonoclama`, `predial`) e o
  `/mapa` não foram abertos na verificação de 12/08 — o roteiro por superfície acima segue
  valendo para eles.

### Testes automatizados

```bash
node --test
```

Resultado esperado: **44 testes aprovados, 0 falhas** (eram 25 no início da fase — baseline
pós-Fase 5, 05-07; os 19 testes novos vêm de `tests/shell.test.js` (+1, botão de tema, plano
06-02), `tests/tema.test.js` (8 casos novos, núcleo puro de `shared/tema.js`, plano 06-02),
`tests/tema-superficies.test.js` (9 casos no plano 06-03 + 1 caso novo desta auditoria, D-05
calibração, 10 no total)).
