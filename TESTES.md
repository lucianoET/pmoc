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
