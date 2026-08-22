---
quick_id: 260822-1ak
date: 2026-08-22
status: complete
---

# OS não é "concluída" — o terminal é CONFERIDA

## O que mudou

Só o vocabulário da tela de `/refrigeracao`. O fluxo interno da OS já
terminava em `CONFERIDA` desde a migração 40 — `MAN_ORDEM` acaba nela,
`manEhTerminal()` reconhece `CONFERIDA`/`CANCELADA` e mais nada. A tela
é que ainda usava a palavra do vocabulário anterior, e o botão que
manda a OS para a fila do gestor (`EM_EXECUCAO → EXECUTADA`) dizia
"Concluir execução", que se lê como encerrar a OS.

| Onde | Antes | Depois |
|------|-------|--------|
| chip do filtro (`:818`) | Concluída | Conferida |
| `MAN_STEPS` último passo (`:1143`) | Conclusão | Conferência |
| botão do técnico (`:2840`) | Concluir execução | Enviar p/ conferência |
| bloco 4 · Conferência (`:2872`) | Aguardando conclusão da execução. | Aguardando o fim da execução. |
| toast da evidência (`:2892`) | …antes de concluir a execução | …antes de enviar para conferência |

Mais o comentário de `tests/refrigeracao-fluxo-os-interna.test.js:394`,
que citava o chip pelo nome antigo.

## O que ficou de fora, de propósito

- **A chave do chip e a classe CSS** continuam `concluida`:
  `manClasseCard('CONFERIDA') === 'concluida'` é asserção do gate
  (`tests/refrigeracao-fluxo-os-interna.test.js:419`) e a cor verde do
  cartão não é palavra de tela. Trocar as duas seria mexer em código
  para renomear texto.
- **O select legado** `CONCLUÍDA/PARCIAL/PENDENTE` (`:1932`): só existe
  no caminho `MAN_FLUXO_OK = false` e escreve exatamente o vocabulário
  que as 10 linhas antigas de `logs_manutencao` já têm gravado — as
  mesmas que a trava da migração 40 preserva com acento.
- **O botão homônimo da contratação** (`:3724`) e o "Aguardando
  conclusão da execução." do bloco de fiscalização (`:3741`): outro
  ciclo (`CT_STATUS`), onde `EXECUTADA` espera o fiscal, não o gestor.

## Verificação

`node --test tests/*.test.js` → 714/714. Nenhuma migração, nenhuma
policy, nenhum estado novo.
