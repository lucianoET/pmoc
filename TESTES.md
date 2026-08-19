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

### Cadeia Máquinas (01 → 02 → 09 → 26 → 27)

O fixture `banco-teste.sql` stuba a cadeia de **locais** e não serve aqui: ele cria
`maq_ativos` como stub de quatro colunas. Para ensaiar a cadeia de Máquinas use
`tests/fixtures/banco-teste-auth.sql`, que recria o mínimo do schema `auth` do
Supabase (`auth.users` e `auth.uid()` lendo o GUC `request.jwt.claim.sub`).

```bash
docker run -d --name pmoc-teste-reparos -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=pmoc -p 55433:5432 postgres:16-alpine
export SUPABASE_DB_URL='postgresql://postgres:teste@localhost:55433/pmoc'
uv run --with "psycopg[binary]" python supabase/aplicar.py \
  ../tests/fixtures/banco-teste-auth.sql \
  01_maquinas_schema.sql 02_maquinas_seed.sql 09_importa_frota_28.sql \
  26_reparos_schema.sql 27_reparos_seed.sql
```

Validado em 18/08/2026 contra PostgreSQL 16.14:

| Conferência | Esperado |
|---|---|
| `rep_modelos` | 7 |
| `rep_servicos` | 25 |
| `rep_reparos` | 33 |
| `rep_reparo_servicos` | 34 |
| `rep_reparo_materiais` | 30 |
| `maq_ativos` com `modelo_id is null` | 0 |

Rodar 26 e 27 uma segunda vez deve manter as seis contagens idênticas.

`rep_confirmar_reparo()` verificada nos quatro caminhos: confirma e incrementa
`frequencia`; segunda chamada na mesma OS é bloqueada e **não** incrementa de novo
(retentativa de rede não conta duas vezes); OS sem `reparo_id` é rejeitada; causa
desmentida (`p_confirmado = false`) grava a resposta sem incrementar.

Ao terminar: `docker rm -f pmoc-teste-reparos`.

## Módulo Mapa (/mapa) — implementação 10/08/2026

> Esta seção descreve o **estado de demonstração** do módulo, anterior à Fase 10 (dados fixos
> embutidos em `mapa/xmap-layers-*.js`, sem escrita, sem posição real). A seção
> "Fase 10 — Mapa operacional — auditoria de fechamento", mais abaixo, descreve o módulo como
> ele ficou depois da fase — leitura do Supabase, editor de zona, posicionamento de ativo e base
> offline — e é o roteiro a seguir a partir de agora.

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

## Fase 10 — Mapa operacional — auditoria de fechamento — 12/08/2026

A Fase 10 tira o `/mapa` do estado de demonstração descrito na seção acima e o transforma no
mapa operacional real: `mapa/mapa-dados.js` é a única porta de leitura e escrita do Supabase
dentro de `mapa/`; `mapa/mapa-geometria.js` é o núcleo puro (área geodésica, compatibilidade de
máquina, envelope de coordenada, resolução de posição em duas camadas); `mapa/mapa-editor.js`
acrescenta dois modos — desenhar zona de serviço (`admin`/`gestor`) e posicionar/reposicionar
ativo (`admin`/`gestor`/`tecnico`) — sobre a mesma instância de mapa; e o mapa base desenha a
área do CMASM com a rede desligada, por uma planta vetorial estática (`mapa/planta-cmasm.geojson`)
mais um mecanismo de tile local com queda para o provedor online.

Esta fase tem duas coisas que as Fases 5 e 6 não tinham, e que viram item nomeado do roteiro em
vez de caixa de verificação que ninguém consegue marcar: uma migração que **o usuário precisa
rodar** antes de qualquer conferência (`supabase/25_mapa_geometria_posicao.sql`), e um requisito
(PLAT-19) cuja prova sem rede só existe em servidor local — nunca contra a URL de produção.

### Preparação (nesta ordem)

1. **Executar `supabase/25_mapa_geometria_posicao.sql` no SQL Editor do projeto `pmoc`
   (`thoaqipyhfmromsgzmjs`).** É o primeiro passo e é **bloqueante**: sem ele não existem as
   colunas `geom`/`flora`/`inclinacao`/`limpeza` em `maq_areas` nem `lat`/`lon` nas seis tabelas
   de posição, e nada do resto deste roteiro funciona. Conferir com as duas consultas do rodapé
   do próprio arquivo:
   - `select column_name from information_schema.columns where table_name = 'maq_areas' and column_name in ('geom','flora','inclinacao','limpeza');`
     — esperado 4 linhas.
   - `select count(*) from maq_ativos where lat is not null;` (repetir para `transp_ativos`,
     `elet_ativos`, `fono_ativos`, `equipamentos`, `cmasm_locais`) — esperado **0** logo depois
     da migração, antes de qualquer ativo ser posicionado pela tela.
2. Subir o servidor local a partir da raiz do repositório — `python -m http.server`, o comando
   que o próprio `CLAUDE.md` documenta — e abrir `/mapa`.
3. **Aviso destacado: logo depois da migração, nenhum ativo tem coordenada.** O mapa abre sem
   nenhum marcador de máquina ou ativo elétrico — as zonas de `maq_areas` também começam sem
   `geom`. Isto é o **estado inicial correto**, não defeito. A primeira tarefa da conferência é
   posicionar alguns ativos pela lista de não localizados (painel `#nao-localizados` na barra
   lateral) — sem este aviso, quem abrir o mapa pela primeira vez conclui, errado, que a fase não
   funcionou.

### Roteiro pelos dez critérios de sucesso da fase (na ordem do `ROADMAP.md`)

**Critério 1 — ativos posicionados sobre a planta do CMASM.** Depois de posicionar ao menos um
ativo de `maquinas` e um de `eletrica` (Critério 8 abaixo), confirmar que o marcador aparece
sobre a planta/tiles do mapa, na coordenada gravada. **Pendente de sessão real** — depende de
navegador autenticado e de dado posicionado, nenhum dos dois disponível neste ambiente.

**Critério 2 — filtro por módulo de origem.** Ativar e desativar cada camada da barra lateral
(Aguada, Grama/Máquinas, Elétrica) e confirmar que só os marcadores do módulo ligado aparecem.
**Pendente de sessão real.**

**Critério 3 — link para o módulo de origem.** Clicar num ativo do mapa, seguir o link do balão
e confirmar que o módulo de destino (`/maquinas`, `/eletrica` ou `/fonoclama`) abre já com a
ficha daquele ativo — repetir num segundo módulo. A metade de destino (`?ativo=<id>` lido e
`abrirModalAtivo` chamado) está provada por gate estático desde o plano 10-03
(`tests/mapa-deep-link.test.js`) e a metade de origem (`linkDoModulo`, nunca concatenada à mão)
desde o plano 10-05 (`tests/mapa-camadas.test.js`); o percurso de ponta a ponta pela tela —
clicar de fato e ver a ficha abrir — é **pendente de sessão real**.

**Critério 4 — ativo sem posição some ou aparece numa lista de não localizados, de forma
explícita.** Conferir os dois lados, porque uma lista que some não distingue "está tudo certo"
de "quebrou": (a) com ativos ainda sem coordenada, o painel de não localizados mostra a contagem
agrupada por módulo de origem; (b) depois de posicionar todos os ativos de um módulo, a seção
daquele módulo no painel mostra a frase de estado vazio, em vez de simplesmente desaparecer. O
agrupamento e o estado vazio estão implementados em `mapa/app.js#renderNaoLocalizados`, cobertos
por `tests/mapa-posicionamento.test.js`; o **aparecer de fato na tela** é pendente de sessão
real — e, logo depois da migração 25, o número esperado é "todos os ativos carregados", que é o
próprio estado que este painel existe para tornar visível, não um bug.

**Critério 5 e 10 — observador não escreve, nem pela interface nem pelo banco.** Entrar como
Livre (acesso observador, sem senha):

1. Confirmar que **não aparecem** botão de "Editar zonas" nem ação de "Posicionar"/"Mover
   ativos" na barra lateral nem no painel de não localizados.
2. Confirmar que as camadas (Aguada, Grama/Máquinas, Elétrica) continuam desenhando
   normalmente — o acesso Livre é leitura, não ausência de mapa.
3. Com o **console do navegador** aberto, tentar uma gravação direta contra o Supabase — por
   exemplo `supa.from('maq_areas').insert({...})` e `supa.from('maq_ativos').update({lat:-22.8,lon:-43.1}).eq('id', 1)`
   — e confirmar que o banco recusa (`401`/`42501`, RLS).

**Esta segunda parte é a que prova o critério** (10): esconder o botão é interface, a
recusa do banco é a garantia real. O acesso Livre nunca autentica no Supabase — opera como papel
anônimo — e é por isso que as políticas escopadas a `authenticated` já o excluem antes mesmo de
qualquer lista de cargo do lado do cliente ser consultada. **Pendente de sessão real** (a
recusa do banco em si já está provada estruturalmente pela migração 25 e por
`tests/mapa-schema.test.js`, mas o clique real e a tentativa via console não).

**Critério 6 — camadas leem do Supabase, sem dado de demonstração.** `mapa/xmap-layers-grama.js`
e `mapa/xmap-layers-eletrica.js` não têm mais `MOCK_AREAS`/`MOCK_MAQUINAS`/`GERADORES`/
`TRANSFORMADORES`/`QUADROS`/`RAMAIS` — confirmado por gate estático
(`tests/mapa-camadas.test.js`) e por leitura de código (plano 10-05). A camada `aguada`
**continua** com dado fixo — isto é D-01 (ver "Limitações conhecidas" abaixo), não um item deste
critério a corrigir.

**Critério 7 — zona de serviço: polígono, atributos, área calculada, máquinas compatíveis.**
Como `admin` ou `gestor`, ligar "Editar zonas", desenhar um polígono de tamanho conhecido — um
quarteirão, um campo — e conferir que a área calculada (`m²`) é da ordem esperada; escolher os
três atributos de terreno (flora, inclinação, limpeza) e ver a lista de máquinas compatíveis
mudar a cada escolha; salvar, recarregar a página e confirmar que a zona volta igual (mesma
geometria, mesmos atributos, mesma área). Se houver máquina de categoria que a regra não
classifica (`minitrator`/`trator` — ver "Limitações conhecidas"), a tela mostra quantas e quais
em vez de escondê-las, e isto é o comportamento correto, não uma lacuna. **Pendente de sessão
real** — `mapa/mapa-editor.js` e `mapa/mapa-dados.js#salvarZona/atualizarZona` estão provados por
gate estrutural (`tests/mapa-editor.test.js`), nunca exercitados contra o Supabase real.

**Critério 8 — acrescentar e reposicionar ativo pelo mapa.** Como `admin`/`gestor`/`tecnico`,
clicar em "Posicionar" num item da lista de não localizados, clicar no mapa e confirmar que o
ativo sai da lista e passa a aparecer (depois de recarregar a página — ver "Limitações
conhecidas" abaixo sobre a camada de exibição não atualizar na hora); ligar "Mover ativos" e
arrastar um marcador existente para uma posição nova, soltar e confirmar que a posição persiste
recarregando a página. Arrastar um ativo para **fora** do envelope geográfico do CMASM deve ser
recusado com o marcador voltando à posição anterior (ver "Bordas a exercitar"). **Pendente de
sessão real** — `salvarPosicaoAtivo` está provada por gate estrutural
(`tests/mapa-posicionamento.test.js`), nunca exercitada contra o Supabase real.

**Critério 9 — mapa base abre e desenha com a rede desligada.** Passo a passo próprio:

1. Servidor local rodando (`python -m http.server` a partir da raiz).
2. Abrir `/mapa`, deixar a planta/tiles carregarem uma vez.
3. **Desligar a rede** (modo avião, ou desconectar Wi-Fi/cabo).
4. Recarregar a página e confirmar que a área do CMASM desenha — a planta vetorial
   (`mapa/planta-cmasm.geojson`, 117 feições, 171 KB) desenha sempre, mesmo sem nenhum tile
   raster local; se `mapa/tiles/` tiver sido populado pelo procedimento do usuário
   (`mapa/tiles/GERAR-TILES.md`), os tiles raster também desenham.
5. Alternar para o basemap **Satélite** com a rede desligada: a tela fica vazia. **Isto é a
   decisão D-02 funcionando**, não uma falha — o satélite permanece apenas online por decisão do
   usuário, sem cache local.

**Contra a URL de produção (`https://pmoc-orcin.vercel.app`) esse teste é impossível**, e a
frase merece destaque: o projeto **não tem service worker** (nenhum
`serviceWorker.register` em nenhum arquivo do repositório), então sem rede o navegador **nunca
chega a buscar a própria página** — não há nada para desligar "depois" de carregar, porque não
há como carregar sem rede em primeiro lugar. Quem tentar contra a URL de produção com o Wi-Fi
desligado e concluir "não funciona" estará testando outra coisa (a ausência de service worker,
não a base offline). A prova real é sempre servidor local + rede desligada, passos 1-4 acima.
Para quem quiser o degrau adicional de fidelidade cartográfica (tiles raster de rua, não só a
planta vetorial), o procedimento — que não é passo de deploy nem bloqueio desta fase — está em
`mapa/tiles/GERAR-TILES.md`, sem repeti-lo aqui.

### Bordas a exercitar

Bordas que quebram em produção e não aparecem em teste automatizado — mesmo espírito da seção
equivalente da Fase 6:

1. [ ] Como `tecnico`, arrastar um ativo posicionado para **fora** do envelope geográfico do
       CMASM (por exemplo, soltar o marcador em outro estado): o sistema recusa a gravação com
       mensagem, e o marcador volta à posição anterior — nunca fica visualmente "salvo" num lugar
       que o banco recusaria.
2. [ ] Como `admin`/`gestor`, desenhar um polígono de **dois vértices** (linha, não área
       fechada) na ferramenta de zona: confirmar que a área não é gravada como valor absurdo
       (zero, negativo ou `NaN`) — a ferramenta de desenho do `leaflet-draw` deveria impedir o
       polígono de fechar com menos de três vértices antes mesmo da gravação.
3. [ ] Tentar salvar uma zona **sem** os três atributos de terreno preenchidos e conferir o que
       a tela diz — a validação client-side (`validarAtributosZona`, antes de qualquer viagem de
       rede) e o `check` da migração 25 (barreira real) devem concordar.
4. [ ] Recarregar `/maquinas` com o parâmetro de ativo apontando para um identificador
       **inexistente** (`?ativo=999999`) e confirmar que o módulo abre normal, sem travar nem
       abrir formulário de cadastro vazio.

### Limitações conhecidas

Cada uma com o motivo — para não ser confundida com defeito:

- **A camada `aguada` continua com dado fixo (D-01).** Ela não tem tabela no pmoc: é sistema
  externo autônomo (FastAPI + SQLite próprios, alimentado por MQTT), fora do escopo desta fase
  e adiado para a Phase 11. O selo "demo" nos botões de módulo do mapa fica só nela — se aparecer
  em Grama ou Elétrica, **isso sim** é regressão a reportar.
- **O mapa Leaflet (barra lateral de camadas, legendas, balões) continua escuro nos dois
  temas** — herdado de D-01 da Fase 6: `mapa/xmap.css` tem tokens próprios (`--xm-*`) fora do
  escopo do tema da plataforma.
- **O satélite não funciona sem rede (D-02).** Decisão do usuário, não bug — ver Critério 9.
- **Estimativa de tempo e custo por zona não existe (D-04).** Fora do escopo desta fase; quando
  vier, deriva de execução real (`maq_operacoes.horas_utilizadas`/`area_executada_m2`), não de
  constante arbitrária.
- **A coordenada dos prédios em `cmasm_locais` continua vazia.** A posição herdada (segunda
  camada de `resolverPosicao`) só passa a valer depois de alguém preencher `lat`/`lon` nos
  registros de `cmasm_locais` — pendência de dado, não de código. Posicionar ativo por ativo pela
  lista de não localizados já resolve o caso de uso sem depender disso.
- **Dentro de uma mesma sessão, a camada de exibição (Grama/Elétrica) só reflete uma posição
  recém-gravada depois de recarregar a página** (deviation registrada em `10-07-SUMMARY.md`):
  `xMap.registerLayer` (fora dos arquivos editáveis por decisão travada) cria um grupo novo sem
  remover o anterior — recarregar de novo depois de cada posicionamento duplicaria marcadores. A
  lista de não localizados e a camada arrastável do próprio editor atualizam na hora; a camada
  persistente, só no próximo carregamento.
- **`minitrator` e `trator` não são mapeados para o vocabulário de compatibilidade de máquina.**
  Decisão tomada no planejamento da fase: a coluna `categoria` não distingue cortador montado de
  trator agrícola, e forçar o mapeamento acertaria dois casos e erraria um em silêncio. Eles
  aparecem numa lista "não classificados" visível, não escondidos.
- **Zonas de serviço ficam em `maq_areas`, fora da árvore `cmasm_locais` (D-03).** Decisão
  travada da fase: zonas são auxiliares e temporárias, não locais permanentes — uma fase futura
  não deveria movê-las para a árvore de locais achando que é organização melhor.

### Conferência isolada de não regressão da refrigeração (PLAT-15)

Este passo é isolado de propósito, e não pode ser substituído por presunção — mesmo formato das
Fases 5 e 6:

- [x] Verificação estática por histórico: `git diff --name-only 511bb9e..HEAD -- refrigeracao/`
      retorna lista vazia — nenhum commit da Fase 10 tocou o diretório (`511bb9e` é o baseline
      da fase).
- [x] Verificação estática por busca negativa: `refrigeracao/index.html` não referencia nenhum
      arquivo novo do mapa nem infraestrutura compartilhada —
      `for p in "shared/" "pmoc.css" "pmoc-tema" "data-theme" "mapa-dados" "mapa-geometria"; do grep -c "$p" refrigeracao/index.html; done`
      dá **0** para os seis termos.
- [x] `mapa/xmap.css` intocado desde `511bb9e` (D-01 da Fase 6, herdada) —
      `git diff --name-only 511bb9e..HEAD -- mapa/xmap.css` retorna lista vazia.
- [ ] Verificação humana com o inspetor de rede aberto: abrir `/refrigeracao` **depois de toda a
      fase concluída**, confirmar que nenhuma requisição de rede aponta para `shared/`, `mapa/`
      ou qualquer arquivo compartilhado, e que o console termina sem erro. **Pendência herdada
      das Fases 5 e 6** — mesmo motivo (ambiente autônomo, sem credenciais nem navegador
      controlável).
- [ ] Percorrer o fluxo principal (login, inventário, uma ordem de contratação) e confirmar que
      está igual ao que era antes da fase. **Mesma pendência herdada.**

### O que este ambiente autônomo não pode provar

Registrado sem eufemismo, para não desaparecer como se tivesse sido verificado:

- **Nenhuma conferência visual pós-login foi feita** — o ambiente autônomo não tem credenciais
  do Supabase nem navegador controlável. Toda evidência deste plano é estática, por comando —
  mesmo limite que fechou as Fases 5 e 6.
- **Nenhuma confirmação de que a migração 25 entrou** no banco de produção real — toda afirmação
  sobre o banco neste plano é sobre o **arquivo** `supabase/25_mapa_geometria_posicao.sql`, não
  sobre o estado real do Supabase.
- **Nenhum teste com a rede desligada** foi executado de fato — o comportamento de queda
  tile-local→online e o desenho da planta sem rede estão provados por gate estrutural
  (`tests/mapa-base-offline.test.js`), não por navegador real com Wi-Fi desligado.
- **Nenhum tile raster foi gerado** — `mapa/tiles/` contém só `.gitkeep`; o procedimento
  (`mapa/tiles/GERAR-TILES.md`) é passo do usuário, não executado neste ambiente.
- **Nenhuma gravação real** em `maq_areas.geom`/`flora`/`inclinacao`/`limpeza` nem em
  `maq_ativos.lat`/`lon`/`elet_ativos.lat`/`lon` foi exercitada contra o Supabase real —
  `salvarZona`/`atualizarZona`/`salvarPosicaoAtivo` estão corretas estruturalmente (gate
  automatizado + leitura de código), nunca testadas ponta a ponta.

### Testes automatizados

```bash
node --test
```

Resultado esperado: **135 testes aprovados, 0 falhas** (eram 58 no início da fase — baseline
`511bb9e`; os 77 testes novos vêm de sete arquivos: `tests/mapa-schema.test.js` (9 casos, plano
10-01, gate estático da migração 25), `tests/mapa-geometria.test.js` (23 casos, plano 10-02,
núcleo puro) e `tests/mapa-decisoes.test.js` (4 casos, plano 10-02, D-01/D-04 em gate),
`tests/mapa-deep-link.test.js` (7 casos, plano 10-03, metade de destino do link), `tests/mapa-
base-offline.test.js` (10 casos, plano 10-04, PLAT-19/D-02), `tests/mapa-camadas.test.js` (8
casos, plano 10-05, porta única de dados), `tests/mapa-editor.test.js` (8 casos, plano 10-06,
cargo de zona) e `tests/mapa-posicionamento.test.js` (8 casos, plano 10-07, cargo de posição e
envelope) — 9+23+4+7+10+8+8+8 = 77).

---

## Fase 7 — UI/UX mobile (roteiro manual de 375 px)

O gate `tests/mobile-375.test.js` prova o que se lê no texto dos arquivos: medida, tamanho de
fonte e onde a tabela está. **Ausência de rolagem horizontal em 375 px não se prova assim** — o
repo é zero-build, sem npm e sem navegador controlável (D-03 da fase). Esta é a metade humana.

Abrir cada módulo com a janela em **375 px de largura** (DevTools → iPhone SE, ou
`python -m http.server` e o navegador do celular na rede local).

| # | Verificar | `/eletrica` | `/fonoclama` | `/predial` | `/mapa` |
|---|-----------|-------------|--------------|------------|---------|
| 1 | A página **não** rola na horizontal (só na vertical) | ☐ | ☐ | ☐ | ☐ |
| 2 | Tabela larga rola **dentro do quadro**, sem empurrar a página | ☐ | ☐ | ☐ | n/a |
| 3 | Abrir um modal, preencher e salvar **sem o navegador dar zoom** ao focar o campo | ☐ | ☐ | ☐ | ☐ |
| 4 | As abas do topo são alcançáveis e rolam na horizontal quando não cabem | ☐ | ☐ | ☐ | n/a |
| 5 | A barra superior cabe na tela (o link "← Portal" some; o rodapé mantém o mesmo link) | ☐ | ☐ | ☐ | ☐ |
| 6 | Nos dois temas (claro e escuro) tudo continua legível | ☐ | ☐ | ☐ | ☐ |

Específico do `/mapa`: abrir a barra de módulos e o painel do editor de zona — nenhum dos dois
pode cobrir o mapa inteiro nem sair da tela.

**Não regressão** (critério de sucesso 5): repetir os itens 1 a 4 em `/maquinas` e `/transportes`
e confirmar que estão **iguais ao que já eram** — inclusive o kanban e o calendário do
`/maquinas`, que rolam na horizontal por desenho e continuam assim até a Fase 8.

---

## Fase 10 — UAT do mapa operacional (2026-08-18)

A migração `supabase/25_mapa_geometria_posicao.sql` **rodou em produção**. Conferido contra o banco
real (projeto `pmoc`, `thoaqipyhfmromsgzmjs`):

### Schema — ✅

| Item | Esperado | Encontrado |
|------|----------|------------|
| Colunas de posição (`lat`/`lon`) | 6 tabelas × 2 | 12 (`cmasm_locais`, `maq_ativos`, `transp_ativos`, `elet_ativos`, `fono_ativos`, `equipamentos`), todas `double precision` |
| `maq_areas.geom` | `jsonb` | `jsonb` |
| Atributos de terreno | 3 listas fechadas | `flora` (gramado/capim_colonial/mata_fechada), `inclinacao` (plano/moderado/acentuado), `limpeza` (limpa/media/densa) |
| Envelope geográfico | 1 check por tabela, lat e lon num `AND` só | 6 × `*_posicao_envelope_chk`, `-23.2/-22.5` e `-43.5/-42.7` |
| Par completo | 1 check por tabela | 6 × `*_posicao_par_chk`, `num_nulls(lat,lon) <> 1` |

### Leitura no app — ✅

`/mapa` com sessão de técnico, servido localmente:

- Módulo autentica, monta o shell e instancia o Leaflet
- Lista de "não localizados" traz **41 ativos** — 28 de Máquinas e 13 de Elétrica, batendo com
  `count(*)` das duas tabelas
- `mapa/planta-cmasm.geojson` carrega (200); os tiles raster locais dão 404 e o mapa cai para o
  basemap online — **comportamento projetado**, não falha (D-02 e `mapa/tiles/GERAR-TILES.md`)
- Modo "Mover ativos" aparece para o técnico; o editor de zona **não** aparece — espelha
  `CARGOS_ZONA` (admin/gestor) contra `CARGOS_POSICAO` (admin/gestor/técnico), como projetado

### Escrita — ⏳ não exercitada

Nenhuma gravação foi feita. Duas razões independentes, nenhuma delas do código:

1. O painel de navegador desta sessão não compõe quadros — sem captura de tela não há clique por
   coordenada, e a barra lateral não aparece na árvore de acessibilidade
2. Escrita direta em produção foi barrada pela política de permissão da sessão

**Fica para o usuário**, no `/mapa` em produção, com cargo de escrita:

- [ ] Posicionar um ativo pela lista de "não localizados" e recarregar a página — ele volta no
      mesmo lugar
- [ ] Reposicionar esse mesmo ativo e conferir que a posição nova substitui a antiga
- [ ] Com cargo admin ou gestor, desenhar uma zona, escolher flora/inclinação/limpeza e conferir
      a área em m² e a lista de máquinas compatíveis; recarregar e ver o polígono voltar igual
- [ ] Com o cargo Livre (observador), confirmar que nenhum dos dois modos aparece

### Estado dos dados — 0 posições

311 `cmasm_locais`, 28 `maq_ativos`, 43 `transp_ativos`, 13 `elet_ativos`, 10 `fono_ativos` e 171
`equipamentos`: **nenhum com `lat`/`lon`**. `maq_areas` sem zonas. O mapa abre vazio até alguém
posicionar.

A planta vetorial não resolve isso: o extrato OSM nomeia 12 feições (CON, CB01-03, CIE, CAV, CBIF,
ETE, os dois cais) e nenhuma casa com os nomes de edificação do `cmasm_locais` (COMANDO, F21,
MK48, EXOCET…). Popular `cmasm_locais.lat`/`lon` — que posicionaria os 265 ativos de uma vez pela
camada herdada — depende de coordenadas reais dos prédios, que não estão em nenhuma fonte do repo.

## Módulo Reparos (/reparos) — implementação 18/08/2026

Catálogo de sintoma → causa provável por **modelo** de máquina, com as peças e serviços que cada
reparo consome. Complementa Máquinas: lá o disparo é o horímetro (`maq_planos`), aqui é o sintoma.

### Estado do banco — verificado em produção em 18/08/2026

| Conferência | Valor |
|---|---|
| `rep_modelos` | 7 |
| `rep_servicos` | 25 |
| `rep_reparos` | 33 |
| `rep_reparo_servicos` | 34 |
| `rep_reparo_materiais` | 30 |
| `maq_ativos` com `modelo_id is null` | 0 de 28 |
| `anon` executa `rep_pode_escrever` / `rep_confirmar_reparo` | não (revogado de `public`) |

### Por que existe a migração 28

As tabelas `rep_*` foram criadas a partir de um **rascunho** de schema antes da migração 26.
Quando a 26 rodou depois, todo `create table if not exists` virou no-op — as tabelas já existiam,
numa forma mais estreita — e as definições corretas foram ignoradas **em silêncio**: faltavam
`rep_modelos.codigo`, `rep_reparos.codigo`, `procedimento`, `obs`, `criado_em` e
`rep_servicos.origem`, e `sistema`/`gravidade` estavam nullable. Funções, policies, índices,
grants e os `alter table` aplicaram normalmente, então nada acusou erro.

**Regra que fica:** `create table if not exists` numa migração aditiva garante a existência da
tabela, não a forma dela. Depois de aplicar, conferir as colunas — não só se o script terminou
sem exceção. A migração 28 fecha a diferença; num banco novo (26 → 27) ela é inócua.

### Write path — NUNCA exercido

Tudo que foi verificado até aqui é leitura e SQL. Nenhuma gravação passou pelo módulo. Em
particular, `rep_reparos.frequencia` está **0 nos 33 reparos**: o ranking por confirmação, que é a
razão de ser do design, nunca executou uma única vez. Mesma situação do write path do `/mapa`.

**Fica para o usuário**, depois do deploy, em `/reparos` e `/maquinas` com cargo de escrita:

- [ ] Em `/reparos` → Reparos, com cargo `tecnico`, cadastrar um reparo novo (testa a RLS de
      `rep_pode_escrever(array['admin','gestor','tecnico'])` e a coluna `procedimento`)
- [ ] Com cargo `tecnico`, confirmar que os botões "+ Serviço" e "+ Modelo" **não** aparecem
      (catálogo estrutural é `admin`/`gestor`) e que o insert é recusado pelo banco se forçado
- [ ] Com o cargo Livre (observador), confirmar que nenhum botão de cadastro aparece e que a aba
      Diagnóstico continua legível
- [ ] Em `/maquinas`, abrir OS **corretiva** na TS114-01, escolher `Não dá partida → Vela suja ou
      queimada`, conferir que o resumo mostra R$ 47,40 e 0,3 h, e concluir
- [ ] Conferir depois: `select frequencia from rep_reparos where codigo='RP-TS114-01'` deve dar
      **1**, e a vela `PE17` deve ter saído do estoque com um movimento `saida` em
      `maq_estoque_movimentos` amarrado ao `os_id`
- [ ] Repetir a conclusão da mesma OS e conferir que a segunda confirmação é recusada — a
      `frequencia` **não** pode ir a 2 (idempotência de `rep_confirmar_reparo`)
- [ ] Abrir OS **preventiva** e conferir que o bloco de diagnóstico não aparece

### Dívida conhecida

- `RP-TS114-06` (rolamento de roda) e `RP-LGT-03` (filtro de ar do LGT2654) estão sem peça
  vinculada: os materiais não existem no catálogo de 34 itens. Cadastrar em `maq_materiais` e
  vincular pela tela de peças e serviços do módulo.
- `RP-TS114-07` (pneu) tem os dois pneus marcados como não essenciais de propósito — só um costuma
  ser trocado —, então aparece com custo estimado R$ 0,00. É o comportamento pretendido.
- `tempo_padrao_h` dos 25 serviços é estimativa de oficina. O real fica em `maq_os.horas_servico`;
  comparar estimado × executado só faz sentido depois de histórico.

---

## Máquinas — ciclo de vida da OS (18/08/2026)

### Migração 29 — aplicada em 18/08/2026 ✅

`supabase/29_maquinas_os_itens.sql` rodou em produção. Conferido contra o banco real, não contra o
arquivo — a lição da migração 28 é que `create table if not exists` é silencioso numa tabela que já
existe, então forma se verifica, não se presume:

| Item | Encontrado |
|------|------------|
| Colunas | 8, exatamente as do arquivo |
| Constraints | PK, FK `os_id` com `on delete cascade`, FK `plano_id`, unique `(os_id, plano_id)` |
| Índices | `maq_os_itens_os_idx`, `maq_os_itens_plano_idx` |
| RLS | ligado, com `maq_os_itens_leitura` (SELECT) e `maq_os_itens_escrita` (ALL, autenticado) |
| Linhas | 0 — tabela nova e vazia |
| `maq_os` | intacta; `plano_id` continua lá, que é o que mantém o caminho antigo válido |

Antes de aplicar, o módulo foi verificado no navegador **sem** a migração: 28 máquinas, 4 OS e 28
cartões de vencimento renderizaram normalmente, e o detalhe da OS caiu no plano único. A tolerância
está provada nos dois estados.

### Conferido no navegador (servido localmente, cargo Livre)

| Item | Resultado |
|------|-----------|
| Tabela de máquinas com 6 colunas, sem Categoria e sem Fabricante/Modelo | ✅ |
| Cada linha com os botões **USO** e **OS** | ✅ |
| Vencimentos: 28 cartões (um por máquina) em vez de um por item | ✅ |
| Popup da máquina: 8 itens, 3 já marcados (os vencidos e próximos) | ✅ |
| "Registrar OS" leva os 3 itens marcados para o modal de OS | ✅ |
| OS nasce com situação **Aberta** | ✅ |
| Linha da OS abre o detalhe | ✅ |
| Exportação CSV: `text/csv;charset=utf-8`, separador `;`, com BOM | ✅ |
| Exportação Word: `application/msword`, com tabela e bloco de assinatura | ✅ |

### Fica para o usuário

- [ ] Aplicar a migração 29 e repetir o popup de vencimentos: marcar 3 itens, registrar a OS e
      conferir que **uma** OS foi criada com os 3 itens (hoje, sem a migração, ela nasce com um)
- [ ] Abrir uma OS, deixar em **Aberta** e conferir no estoque que **nenhuma peça foi baixada**
- [ ] Avançar a OS para **Em execução** e conferir que continua sem baixa
- [ ] **Concluir** a OS e conferir que aí sim o estoque caiu, e que `maq_estoque_movimentos`
      registrou a saída com o `os_id` correto
- [ ] Repetir a conclusão pelo modal de detalhe (em vez do botão da lista) e conferir que a baixa
      acontece igual — são caminhos diferentes para o mesmo evento
- [ ] Exportar uma OS em PDF pelo botão e conferir o resultado da impressão do navegador
      (não testável neste ambiente — o painel de navegador não compõe quadros)

---

## Chrome compacto e estoque editável (18/08/2026)

### Base compartilhada — vale para os 6 módulos

`shared/pmoc.css` e `shared/shell.js` mudaram, então **conferir em mais de um módulo**, não só no
Máquinas: `/maquinas`, `/transportes`, `/eletrica`, `/fonoclama`, `/predial` e `/mapa`.

| # | Verificar | Como |
|---|-----------|------|
| 1 | Barra superior em **uma linha**: título, usuário, modo, portal, sair | Em 375px a barra tem 52px de altura e os cinco centros verticais coincidem |
| 2 | Em 375px o rótulo "Portal" some e fica só a seta | Largura do link cai para ~12px; o título continua inteiro |
| 3 | Abas com cara de botão, rolando na horizontal | A sombra nas bordas some quando a rolagem chega ao fim — sem setas |
| 4 | Alvo de toque das abas ≥ 44px | Medido: 44px |
| 5 | Indicadores em **uma linha**, rolando quando não cabem | 6 cartões, uma linha só, tanto em 1280px quanto em 375px |

### Máquinas

| # | Verificar | Resultado medido |
|---|-----------|------------------|
| 6 | Painel corta cada bloco em 5 linhas | ✅ 5 + "Ver os outros 23 →" / "Ver os outros 29 →" (eram 62 linhas soltas) |
| 7 | Bloco novo de OS em aberto, com indicador próprio | ✅ (vazio hoje — as 4 OS existentes estão concluídas) |
| 8 | "Ver os outros" leva à aba certa | ✅ leva a `view-materiais` |
| 9 | Linha do estoque edita quantidade, mínimo e preço | ✅ três campos e os botões Salvar / ✕ |
| 10 | Clicar num material crítico do painel abre a linha já em edição | ✅ troca para a aba de estoque com a linha aberta |

### Fica para o usuário

- [ ] Salvar uma edição de estoque com a quantidade alterada e conferir que
      `maq_estoque_movimentos` ganhou a linha de ajuste, com o motivo registrando o valor anterior
- [ ] Conferir a barra superior nos outros cinco módulos, em celular de verdade — a medição aqui
      foi por régua no DOM, não por olho
- [ ] Conferir a sombra de rolagem das abas nos dois temas (claro e escuro)

---

## Custos da OS — peças e serviços (18/08/2026)

### Migração 30 — aplicada em 18/08/2026 ✅

`supabase/30_maquinas_os_custos.sql` rodou em produção. Conferida a **forma**, não só a existência:

| Item | Encontrado |
|------|------------|
| `maq_os_materiais` | 7 colunas; 7 constraints — PK, FK `os_id` (cascade), FK `material_id`, unique `(os_id, material_id)`, checks de `origem`, `preco_unit` e `quantidade` |
| `maq_os_servicos` | 7 colunas; 6 constraints — PK, FKs, checks de `horas` e `valor_hora`, e o `identificacao_chk` (serviço do catálogo **ou** descrição) |
| `maq_config` | 4 colunas, com a linha `valor_hora_padrao` |
| RLS | ligado nas três tabelas, com as 6 políticas |
| `valor_hora_padrao` | `null` — ainda não informado, como projetado |
| Linhas | 0 nas duas listas |

As três consultas que o app faz (com os joins de `maq_materiais` e `rep_servicos`) respondem 200.

O módulo foi verificado nos **dois** estados: antes da migração, com as listas vazias e custos em
zero, e depois dela, com as tabelas na carga.

### Cálculo conferido na tela

| Entrada | Resultado |
|---------|-----------|
| 3 × R$ 22,50 + 2 × R$ 10,00 | Peças **R$ 87,50** ✅ |
| 4 h × R$ 60,00 | Mão de obra **R$ 240,00** ✅ |
| Soma | Total **R$ 327,50** ✅ |
| Apagar o valor da hora | Mão de obra volta a **0,00** e aparece o aviso explicando que não há hora-homem cadastrada ✅ |
| Remover uma linha | Recalcula para **R$ 67,50** ✅ |

### Fica para o usuário

- [ ] Definir o **valor da hora-homem** na aba Estoque — enquanto estiver vazio, toda mão de obra
      fica zerada, de propósito
- [ ] Abrir uma OS preventiva e conferir que as peças do plano já vieram lançadas na lista, com
      preço do catálogo
- [ ] Ajustar quantidade de uma peça, salvar, reabrir e conferir que o valor persistiu
- [ ] Concluir essa OS e conferir que o estoque baixou **pela lista da OS** (a ajustada), não pela
      previsão do plano
- [ ] Numa OS corretiva com diagnóstico, conferir que a peça que aparece no plano **e** no
      diagnóstico foi debitada **uma vez só**
- [ ] Reajustar o preço de um material no estoque e conferir que uma OS já fechada **não** mudou de
      custo

---

## Fluxo de oficina na OS (18/08/2026, noite)

### Migração 31 — aplicada em 18/08/2026 ✅

`supabase/31_maquinas_os_fluxo.sql` rodou em produção — a primeira troca de trava do projeto
(nada removido, a lista só cresce). Conferido contra o banco:

| Item | Encontrado |
|------|------------|
| `maq_os_status_check` | os 6 estados: `pendente`, `delineamento`, `espera`, `em_andamento`, `concluida`, `cancelada` |
| Colunas de delineamento | `delineado_por text`, `delineado_em timestamptz` |
| OS existentes | 4, todas `concluida` — válidas sob a trava nova; a troca não invalidou nada |

### O fluxo

| Etapa | Status | O que acontece |
|-------|--------|----------------|
| Recepção | `pendente` (Aberta) | OS criada; quem entregou a máquina vai nas observações |
| Delineamento | `delineamento` | técnico lança materiais e serviços na OS; ao encerrar, grava quem e quando |
| Espera | `espera` | aguardando material ou técnico; a lista de OS sinaliza ⚠ quando falta peça |
| Execução | `em_andamento` | **estoque desce aqui** (com confirmação) |
| Conclusão | `concluida` | sem nova baixa — a guarda de idempotência lê `maq_estoque_movimentos` |

### Conferido no navegador (cargo Livre, sem a migração 31)

- Coluna **Material** na lista de OS (⚠ falta N / EM ESTOQUE / —) ✅
- Filtro de situações com a opção "⚠ Com falta de material" ✅ (as 4 OS existentes estão
  concluídas, então o filtro devolve o estado vazio correto)
- 212 testes em `node --test`, zero falhas

### Fica para o usuário (depois da migração 31, logado com cargo de escrita)

- [ ] Abrir OS corretiva (recepção) → Delinear → lançar 2 peças e 1 serviço no detalhe →
      Encerrar delineamento → conferir `delineado_por`/`delineado_em` no cabeçalho do detalhe
- [ ] Com a OS em espera, conferir o ⚠ na lista se alguma peça não tem estoque
- [ ] Iniciar execução → conferir que o estoque **desceu agora** e que `maq_estoque_movimentos`
      tem as saídas com o `os_id`
- [ ] Concluir → conferir que **não** houve segunda baixa (idempotência)
- [ ] Filtrar por "⚠ Com falta de material" e ver só as OS travadas por peça

---

## Ficha da máquina (18/08/2026, noite)

### Migração 32 — aplicada em 18/08/2026 ✅

`supabase/32_maquinas_ficha.sql` rodou em produção. Conferida a forma contra o banco:

| Item | Encontrado |
|------|------------|
| `maq_ativo_comentarios` | 5 colunas; PK, FK `ativo_id` (cascade) e o check de texto não vazio |
| Índice | `maq_ativo_comentarios_ativo_idx` (`ativo_id, criado_em desc`) |
| RLS | ligado, com as 2 políticas (leitura pública, escrita autenticada) |
| `maq_ativos.instrucoes` | `text`, no lugar |
| Linhas | 0 — o diário começa vazio |

A ficha foi verificada nos dois estados: sem a migração (diário vazio, nada quebra) e com ela.

### Conferido no navegador (cargo Livre, sem a migração 32)

| Item | Resultado |
|------|-----------|
| Clique na máquina abre a **ficha**, não o formulário | ✅ |
| Identidade (categoria, fabricante/modelo, patrimônio, local, status) só leitura — zero campos editáveis | ✅ |
| Uso atual exibido como "calculado dos registros" | ✅ |
| "Editar cadastro" escondido para observador (só admin/gestor) | ✅ |
| Caixa de comentário escondida para observador | ✅ |
| Últimas OS da máquina listadas e clicáveis para o detalhe | ✅ |
| No cadastro (edição): campo de uso **travado**, com ajuda explicando | ✅ |
| No cadastro (criação): campo livre, rotulado "Uso inicial" | ✅ |

### Fica para o usuário (depois da migração 32, com cargo de escrita)

- [ ] Abrir a ficha, anotar um comentário e conferir que ele volta datado e assinado
- [ ] Registrar uso pela ficha e ver o "Uso atual" refletir o novo total
- [ ] Abrir OS pela ficha e conferir que a máquina já vem selecionada
- [ ] Preencher instruções no cadastro (admin/gestor) e vê-las na ficha
- [ ] Como técnico: conferir que "Editar cadastro" **não** aparece

### Deferido

- **Foto da máquina** — exige bucket no Supabase Storage com políticas próprias; fazer quando
  decidido, como tarefa própria

---

## OS: duplicata de peça, cadastro na hora e vínculo material ↔ serviço (18/08/2026, noite)

### Bug corrigido — chave duplicada ao salvar as peças

Reportado em produção: `duplicate key value violates unique constraint
"maq_os_materiais_os_id_material_id_key"`. Causa: "+ Peça" empurrava sempre o primeiro material
do estoque — dois cliques, duas linhas da mesma peça, e o unique recusava. Três defesas agora:

1. A linha nova nasce **sem peça escolhida** ("— escolher peça —")
2. Escolher uma peça que já está na OS **funde** na linha existente (soma quantidades) — conferido
   no navegador: 2 linhas com a mesma peça viraram 1 com quantidade 2
3. `consolidarPecas()` soma por material antes do insert — rede de segurança com gate

### Cadastro na hora

Os dois seletores da OS ganharam "➕ Cadastrar novo…": peça abre o modal de material, serviço abre
um modal novo (`rep_servicos`); o item criado volta selecionado na linha que pediu.

### Migração 33 — aplicada em 18/08/2026 ✅ (0/34 materiais vinculados)

`supabase/33_maquinas_material_servico.sql` (aditiva): `maq_materiais.servico_id` → o serviço
padrão da peça. Ao lançar a peça numa OS o serviço entra junto; ao lançar o serviço, as peças
vinculadas entram juntas — os dois sentidos saem da mesma coluna. O vínculo é gerenciado no
cadastro do material (clicar no **nome** do material no estoque abre o cadastro, que agora também
edita — só para cargo de escrita). Conferida contra o banco: coluna `bigint` com a FK para
`rep_servicos`. **Nenhum material vinculado ainda** — o vínculo se preenche peça a peça no
cadastro, e enquanto for 0/34 o comportamento automático não dispara para ninguém.

### Fica para o usuário (com cargo de escrita)

- [ ] Na OS: "+ Peça" duas vezes, escolher a mesma peça nas duas → vira uma linha; salvar sem erro
- [ ] "+ Peça → Cadastrar nova peça…" → salvar → a peça volta selecionada na linha
- [ ] "+ Serviço → Cadastrar novo serviço…" → idem
- [ ] (Após migração 33) Vincular um serviço a uma peça no estoque; na OS, escolher a peça e ver o
      serviço entrar sozinho; remover tudo, escolher o serviço e ver a peça entrar

## Calibração sai do localStorage e entra no Supabase (18/08/2026)

### O que era

`/calibracao` era o único módulo da plataforma sem banco. Os 38 instrumentos, 8 laboratórios, 12
pedidos de serviço, 2 lotes e o catálogo de preços viviam inteiros em
`localStorage['cmasm_erp_state_v1']`, gravados como um blob único a cada tecla. Consequências:
limpar o cache apagava o controle de calibração do CMASM, cada computador via um dado diferente, e
não havia backup nem forma de duas pessoas trabalharem no mesmo dado.

### Migrações 35 e 36

`supabase/35_calibracao_schema.sql` (aditiva) cria `cal_labs`, `cal_equipamentos`, `cal_ps`,
`cal_lotes` e `cal_catalogo`. `supabase/36_calibracao_seed.sql` carrega o estado de fábrica,
**gerado** por `node calibracao/gerar-seed.mjs` a partir das constantes do próprio `index.html` —
não digitado à mão.

Ensaiadas em `postgres:16-alpine` descartável antes de qualquer coisa (procedimento igual ao das
outras cadeias, porta 55434, com `create role anon; create role authenticated` porque os papéis do
Supabase não existem no Postgres puro):

- schema aplica limpo e é idempotente na segunda passada — 68 colunas, 7 checks, RLS com 5 políticas
- seed aplica limpo: 8 labs, 38 equipamentos, 12 PS, 2 lotes, 30 opções de catálogo
- FKs resolvidas, datas convertidas (`12/03/2024` → `2024-03-12`), reaplicar não duplica

### Decisões que o gate protege

- **Escrita por linha, nunca o blob** — guardar o JSON inteiro numa coluna `jsonb` seria uma
  mudança de cinco linhas, mas a primeira vez que duas pessoas editassem junto uma sobrescreveria a
  outra inteira, em silêncio.
- **PK de texto** (`e001`, `cms`, `p001`) — os ids já são as FKs que o React usa nas 11 páginas.
- **`date` no banco, `dd/mm/aaaa` na tela**, convertidos só em `paraISO`/`paraBR`.
- **Contador de PS derivado**, não persistido, com `cal_ps.num` unique — contador de cliente gera
  `PS-CMS-26-013` duplicado assim que duas pessoas emitem juntas.
- **A ata não virou tabela** — `ATA_ITEMS_SEED`/`ATA_INFO` só são lidos.
- **Deriva mapa ↔ schema** — `CAMPOS_*` é comparado coluna a coluna com a migração 35: um campo
  fora do mapa é gravado como **null, sem erro nenhum**.

### ⚠ Segurança — o módulo segue sem login (decisão do usuário)

As policies aceitam `anon` para escrita, então **qualquer pessoa com a URL `/calibracao` lê e altera
os dados de todos**. Antes da migração isso já valia, mas o estrago ficava no navegador de quem
fazia; agora é compartilhado. Fechar exige `shared/auth.js` no módulo mais uma migração trocando as
políticas para `to authenticated`.

### Fica para o usuário (no navegador, depois de aplicar 35 e 36)

- [ ] Abrir `/calibracao` → dashboard preenchido; conferir 38 equipamentos e 8 laboratórios
- [ ] Editar um instrumento, **recarregar a página** → a alteração continua lá (antes vinha do cache)
- [ ] Abrir em **outro navegador ou computador** → o mesmo dado aparece
- [ ] Emitir um PS → número na sequência do ano; concluir com data → o instrumento recebe `prox`
      calculada e status CALIBRADO
- [ ] Baixar um instrumento com PS em aberto → recusa; sem PS em aberto → some da lista (arquivado,
      não apagado)
- [ ] Catálogo de Preços: alterar um preço → recarregar → persistiu
- [ ] Dados: se o navegador tiver dado da versão antiga, aparece o aviso âmbar com botão de exportar
- [ ] Dados → "Apagar todos os dados do banco": **ler o texto do confirm** e cancelar (o clique é
      destrutivo para todos os usuários)
- [ ] Desligar a rede e recarregar → aviso vermelho "Não foi possível carregar os dados" com botão
      de tentar de novo, não telas vazias

---

## Mapa: prédio como polígono, zona como vegetação, controles reorganizados (19/08/2026)

Migração `37_locais_geometria.sql` **aplicada em produção em 19/08/2026** e conferida contra o
banco: `cmasm_locais.geom` existe, o `check` de forma (`jsonb_typeof(geom) = 'array'`) existe.
O caminho de escrita **foi exercido com dado real** — o contorno que o usuário havia desenhado
para o Comando foi gravado no local 302 (COMANDO, 8 vértices, centroide
−22,8395545 / −43,1091537, 2.253 m²), e a contagem de locais ativos sem posição caiu de 227
para 226. Nenhum ativo aponta para o local 302, então esse contorno não acendeu ativo nenhum.

**Conversão das duas zonas que eram prédios (19/08/2026):** "Predio Comando" reusou o contorno
já gravado em `cmasm_locais` 302; "Museu" ganhou linha nova (`CMASM-MUSEU`, id 623,
`edificacao` sob o CMASM, 6 vértices, centroide −22,8393873 / −43,1086979, 1.673 m²), porque
não tinha nenhuma. As duas linhas de `maq_areas` foram **arquivadas (`ativo = false`), não
apagadas**. A vegetação ativa caiu de 12.680 m² para **8.754 m²** — os 3.926 m² de edifício
saíram da conta de corte de grama.

- [ ] Confirmar na aba de áreas do Máquinas que "Predio Comando" e "Museu" não aparecem mais
      entre as zonas ativas, e que o total de área caiu para 8.754 m².

- [ ] Abrir `/mapa` e confirmar que a camada **Prédios** aparece ligada, com o contorno do
      Comando desenhado em marrom, distinto do verde das zonas.
- [ ] Passar o cursor sobre o contorno: nome do prédio; clicar: balão com código, tipo e
      "Posição: centroide do contorno".
- [ ] Confirmar que o painel "Layers" **não** cobre mais nenhum botão — os modos "Editar zonas"
      e "Mover ativos" estão na barra lateral (☰ Módulos → seção **Edição**), visíveis só para
      quem tem cargo de escrita.
- [ ] Abrir o painel do editor (clicar numa zona em modo de edição) e confirmar que o painel
      "Layers" recua para a esquerda dele, em vez de ficar por cima.
- [ ] Em 375 px: confirmar que a barra Mapa/Satélite (agora no canto inferior esquerdo) não
      colide com o botão ☰ Módulos.
- [ ] Como `admin`/`gestor`/`tecnico`: em **Prédios sem posição**, usar **Contorno** num prédio,
      desenhar o polígono e fechá-lo no primeiro ponto. Confirmar a mensagem de gravação, que o
      prédio sai da lista e que o contorno aparece na próxima abertura do mapa.
- [ ] Repetir com **Esc** no meio do desenho: nada é gravado e a faixa de instrução some.
- [ ] Desenhar um contorno fora da região do CMASM: a gravação é recusada com a mensagem de
      envelope, antes de qualquer viagem de rede.
- [ ] Como `observador`: a seção **Edição** não aparece e os prédios não têm botão nenhum.
- [ ] Numa zona com `flora` classificada, confirmar a cor por vegetação (gramado verde-claro,
      capim colonial verde-limão, mata fechada verde-escuro) e o subtítulo do balão com a
      vegetação — "Área externa" quando não há flora classificada.

---

## Mapa: sala herda a posição do prédio (19/08/2026)

Sem migração — mudança só de código. Medido contra o banco real logo depois: **54 ativos
posicionados** (16 com posição própria, 38 herdados pela cadeia) contra 39 antes; **216 sem
posição**; a lista de prédios caiu de 226 para **98** (as salas saíram) e passou a ordenar por
quantos ativos cada prédio acenderia — F21 19, PAIOL 16, MK48 12, EXOCET 10.

- [ ] Abrir `/mapa` → ☰ Módulos. Confirmar que **nenhuma sala** aparece em "Prédios sem
      posição" e que a nota "Sala não entra na lista: herda a posição do prédio" está visível.
- [ ] Clicar num ativo que esteja numa sala do COMANDO: o balão diz **"Herdada de COMANDO"**,
      não "Herdada do local".
- [ ] Posicionar um prédio com contagem alta (F21) e confirmar que **todos** os ativos das
      salas dele aparecem no mapa de uma vez, e somem da lista de não localizados.
- [ ] Arrastar um desses ativos em "Mover ativos": ele passa a ter posição própria e o prédio
      **não** se move junto; os demais ativos do prédio continuam onde estavam.
- [ ] Confirmar que nenhum ativo aparece pinado no centro da base sem prédio: a coordenada da
      Organização Militar não é herdada de propósito.

---

## Mapa: legibilidade — agrupamento, rótulos, barra lateral, camadas (19/08/2026)

Sem migração. Medido na tela antes e depois, com os 30 prédios já posicionados pelo usuário:

| | antes | depois |
|---|---|---|
| marcadores desenhados | 195 (em 51 pontos; maior pilha 24) | **56** |
| rótulos visíveis | 12 (todos da planta OSM) | **66** (prédio, zona, ativo/grupo) |
| zoom de abertura | 15 (base do tamanho de uma unha) | **17**, enquadrando o que tem posição |
| painel de camadas | aberto, ~1/4 da tela | recolhido, "Camadas (10)" |
| seções da barra lateral abertas | 7 | 2 (Módulos, Edição) |

- [ ] Abrir `/mapa`: o mapa deve abrir **já enquadrado** na área do CMASM, com os nomes de
      prédio, zona e ativo visíveis.
- [ ] Dar zoom out até 16 ou menos: os rótulos desaparecem (é o corte por zoom, não um bug).
- [ ] Clicar num marcador com **badge de contagem**: o balão lista os ativos daquele ponto,
      cada um com link para a ficha do módulo. Com mais de 15, a última linha anuncia o resto.
- [ ] Conferir que um grupo com um ativo inoperante aparece na cor de inoperante, mesmo com
      vários operantes no mesmo ponto.
- [ ] Abrir **Camadas** e desligar Climatização: os marcadores dela desaparecem e o número no
      botão continua contando as camadas registradas. Religar devolve.
- [ ] ☰ Módulos: as seções abrem e fecham; os cabeçalhos fechados mostram os contadores
      ("Não localizados (75)", "Prédios sem posição (66)").
- [ ] Em 375 px: confirmar que o cabeçalho **Camadas** e o botão ☰ Módulos não se sobrepõem.
