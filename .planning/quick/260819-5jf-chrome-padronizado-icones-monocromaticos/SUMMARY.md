---
quick_id: 260819-5jf
slug: chrome-padronizado-icones-monocromaticos
date: 2026-08-19
status: complete
---

# Sumário — chrome padronizado e abas de OS separadas

## Entregue

1. **`shared/icones.js`** — conjunto único de 17 ícones, traço 2 em `viewBox 24` (Material
   Symbols Outlined), todos em `currentColor`. Núcleo puro. Nome desconhecido devolve vazio.
2. **Barra superior padronizada**: título, usuário, **Portal (botão)**, Sair. Portal deixou de
   ser link de texto e ficou imediatamente antes de Sair.
3. **Tema desceu para o rodapé** (nos 6 módulos e no portal) — é preferência de exibição.
4. **Rodapé** ganhou o link da **Luctronics** (hexágono, nova aba, `rel=noopener`).
5. **Abas de Máquinas**: `OS` → **OS-Manutenção**; nova **OS-Corte** logo depois, com view
   própria. Dentro dela, "Operações de serviço" → **"Ordem de Serviço de Corte"** e
   "Áreas de serviço" → **"Áreas Vegetais"**.
6. Ícones das abas migrados para o conjunto nos **seis módulos** — Máquinas primeiro (9 abas),
   depois os cinco restantes (`transportes`, `eletrica`, `fonoclama`, `predial`, `mapa`). O
   shell segue aceitando as duas formas (nome do conjunto ou caractere solto), o que é o que
   permitiu migrar em duas levas sem quebrar nada no meio.

## Contratação de empresa em Máquinas (entregue depois, mesmo quick)

O pedido de **"componentes/templates compartilhados"** e de trazer **Contratações** para
Máquinas estava registrado aqui como pergunta aberta — a resposta foi **tabela nova**, e o
trabalho entrou no mesmo quick:

7. **`supabase/38_maquinas_contratacoes.sql`** (aditiva, **aplicada em produção em
   19/08/2026** e conferida no banco: `maq_contratacoes` 20 colunas / 7 constraints,
   `maq_contratacao_itens` 8 / 4, `maq_contratacao_eventos` 7 / 2, RLS ligada com duas
   policies em cada uma). Tabelas **novas**, não reuso de `os_contratacao`: aquela é do módulo
   congelado (D-04), aponta para `equipamentos` e carrega os itens da ARP de refrigeração. O
   objeto aqui é máquina ou área.
8. **`shared/fluxo.js`** — núcleo puro de fluxo de estados, dirigido por uma definição de
   etapas passada como parâmetro. Existe porque o mesmo processo estava escrito três vezes (OS
   de Máquinas com 6 estados, contratação de Refrigeração com 8, contratação de Máquinas
   agora), cada cópia com sua lista fechada, seus rótulos, suas cores e sua regra de
   transição. A regra é **adjacência na lista mais o cancelamento**: processo público não
   salta etapa, e voltar uma etapa é permitido de propósito — sem isso, corrigir um avanço
   errado só editando o banco.
9. **`shared/componentes.js`** — régua de etapas, pílula de estado, `seg-toggle` e fila de
   chips, funções **puras que devolvem texto**, sem DOM e sem cor escrita em JavaScript (`tom`
   é nome de tom semântico resolvido pela folha comum). Só sobe para cá o que já tem **dois
   consumidores** — a mesma regra que fez `shared/tabela.js` subir.
10. **`maquinas/contratacoes.js`** — as sete etapas do ciclo mais os dois terminais, com
   rótulos que dizem o que se **espera** na etapa ("Aguardando orçamento"), não o que já
   aconteceu. Nada de DOM nem de Supabase: definição e contas.

Gate: `tests/contratacoes-maquinas.test.js`.
