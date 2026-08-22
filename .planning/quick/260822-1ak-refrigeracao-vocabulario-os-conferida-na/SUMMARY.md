---
quick_id: 260822-1ak
date: 2026-08-22
status: complete
resultado: revertido
---

# OS: "Conferida" na tela — feito e revertido no mesmo dia

## O que aconteceu

O commit 96a4b0a trocou o vocabulário da tela de `/refrigeracao` para
acompanhar o fluxo (chip "Conferida", passo "Conferência", botão
"Enviar p/ conferência"). O usuário pediu a palavra antiga de volta na
mesma sessão: a tela volta a dizer **Concluída**.

O commit de reversão devolve `refrigeracao/index.html` e o comentário de
`tests/refrigeracao-fluxo-os-interna.test.js` byte a byte ao estado de
224bae0.

## O que NÃO mudou em nenhum dos dois commits

O fluxo. `MAN_ORDEM` termina em `CONFERIDA`, `manEhTerminal()` reconhece
`CONFERIDA`/`CANCELADA`, e `logs_manutencao.status` grava `CONFERIDA` —
a trava da migração 40 é a mesma. A palavra na tela e o estado no banco
são coisas separadas desde a migração 40: `MAN_EQUIVALENCIA` já
agrupava o legado `'CONCLUÍDA'` sob `CONFERIDA` sem renomear a linha,
e `manClasseCard('CONFERIDA') === 'concluida'` (classe CSS) continua
sendo asserção de gate.

Ou seja: a OS continua sem poder ser encerrada por ninguém que não seja
o gestor conferindo — só que a tela chama esse fim de "Concluída".

## Verificação

`node --test tests/*.test.js` → 714/714, antes e depois da reversão.
