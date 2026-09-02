# Artefatos GSD — aposentados em 02/09/2026

Esta pasta era `/.planning/` na raiz do repositório. Foi movida para cá,
**arquivada e não apagada**, pela mesma regra que vale para o banco: o projeto
arquiva, nunca deleta.

## Por que foi aposentada

Havia **dois registros do projeto e um deles estava morto**. O `CLAUDE.md` da raiz
acompanhou cada task e é a fonte de verdade de fato; o `.planning/` parou em
23/08/2026 e não tem artefato para nenhuma das 12 tasks mescladas de 30/08 em
diante (PRs #35 a #47). Manter os dois obrigava a conferir qual estava certo antes
de acreditar em qualquer um.

Pior que estar velho, **contradizia o código**:

- `STATE.md` apontava "Próxima: 260826-B", task que nunca foi feita, e o corpo do
  arquivo declarava 100% do marco v2.0 contradizendo o próprio frontmatter, que
  dizia 50% e estava certo.
- `codebase/STRUCTURE.md` só conhece `refrigeracao/` e `maquinas/` — é da era de
  dois módulos, e hoje são dez. O `CLAUDE.md` mandava lê-lo "antes de mudanças
  grandes", o que era conselho ativamente errado.
- `CLAUDE-gerado-pelo-gsd.md` (era `/.claude/CLAUDE.md`) afirmava "dois módulos em
  produção", "7 cutting machines" (são 28) e "migrações 01 a 09" (são 55) — e era
  **injetado como instrução em toda sessão**, ao lado do `CLAUDE.md` correto.
  Todas as suas 382 linhas eram geradas de `PROJECT.md` e `codebase/*.md`, então
  aposentar a fonte sem aposentar o derivado deixaria o pior dos dois de pé.

## O que foi levado para o `CLAUDE.md` antes de arquivar

Aposentar não podia significar perder o que ainda valia. Migraram para a raiz:

- **Fases 8, 9, 11 e 12** — as não entregues, com os critérios de sucesso, na seção
  *Roadmap — o que falta*.
- **As 54 pendências de segurança** do `BACKLOG-TECNICO.md`, condensadas na seção
  *Dívida de segurança*, que aponta de volta para o arquivo completo aqui.
- **As convenções detalhadas** de nomenclatura, tratamento de erro e desenho de
  função que só existiam no arquivo gerado.

As decisões travadas da Fase 10 (D-01 a D-04) já estavam no `CLAUDE.md` e não
precisaram migrar.

## O que continua tendo valor aqui

- `phases/01-transportes-frota-sob-manuten-o/01-CONFERENCIA-IMPORT.md` — o registro
  de por que o seed original de transportes importou 9 de 43 ativos. Citado pelo
  `README.md` e pelo `TESTES.md`.
- `quick/` — 38 pastas de PLAN/SUMMARY, de 10/08 a 29/08. O que elas registram está
  resumido no `CLAUDE.md`, mas o detalhe da execução está aqui.
- `BACKLOG-TECNICO.md` — a lista completa dos 54 itens, item a item.

## Regra a partir de agora

**O `CLAUDE.md` da raiz é o registro único.** Cada task acrescenta ali uma nota
datada com o que mudou e por quê; `TESTES.md` recebe o roteiro manual. Não se
escreve mais nada nesta pasta.
