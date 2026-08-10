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
