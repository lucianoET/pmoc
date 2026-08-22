---
quick_id: 260822-1ak
date: 2026-08-22
status: planned
---

# OS não é "concluída" — o terminal é CONFERIDA

## Problema

O fluxo interno da OS de `/refrigeracao` (migração 40) já termina em
`CONFERIDA`, conferida pelo gestor — `MAN_ORDEM` acaba nela e
`manEhTerminal()` só reconhece `CONFERIDA`/`CANCELADA`. A tela, porém,
continuou falando o vocabulário anterior: o chip do filtro diz
"Concluída", o último passo da régua diz "Conclusão" e o botão que leva
`EM_EXECUCAO → EXECUTADA` diz "Concluir execução" — que se lê como
"encerrar a OS" quando na verdade ela vai para a fila do gestor.

Vocabulário de tela apenas. Nenhum estado, nenhuma coluna, nenhuma
policy muda.

## Escopo

1. `refrigeracao/index.html:818` — chip `Concluída` → `Conferida`
2. `refrigeracao/index.html:1143` — `MAN_STEPS` último passo `Conclusão` → `Conferência`
3. `refrigeracao/index.html:2840` — botão `Concluir execução` → `Enviar p/ conferência`
4. `refrigeracao/index.html:2872` — `Aguardando conclusão da execução.` → `Aguardando o fim da execução.`
5. `refrigeracao/index.html:2892` — toast `…antes de concluir a execução` → `…antes de enviar para conferência`
6. `tests/refrigeracao-fluxo-os-interna.test.js:394` — comentário citando o chip antigo

## Fora de escopo (deliberado)

- A chave interna do chip (`setOSChip(this,'concluida')`) e a classe CSS
  `.os-card.concluida`: `manClasseCard('CONFERIDA') === 'concluida'` é
  asserção do gate `tests/refrigeracao-fluxo-os-interna.test.js:419`.
  Renomear os dois seria mexer em código para trocar palavra de tela.
- O select legado `CONCLUÍDA/PARCIAL/PENDENTE` (`:1932`): só existe com
  `MAN_FLUXO_OK = false` e escreve o vocabulário que as 10 linhas
  antigas já têm gravado no banco.
- O botão homônimo da contratação (`:3724`): outro ciclo (`CT_STATUS`),
  onde `EXECUTADA` espera fiscal, não gestor.

## Verificação

`node --test tests/` verde.
