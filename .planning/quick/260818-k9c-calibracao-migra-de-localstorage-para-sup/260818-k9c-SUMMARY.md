---
phase: quick
plan: 260818-k9c
status: complete
concluido_em: 2026-08-18
commits:
  - 9b018a6 docs — plano e decisões
  - 1cacc0a feat — migração 35 (schema)
  - 7551031 feat — migração 36 (seed) + gerador
  - 23e767e feat — useStore lê e grava no Supabase
  - 49f960d docs — CLAUDE.md e TESTES.md
  - 6fe6170 fix — ordena toda leitura
  - 21a5e73 fix — prazo na leitura e na gravação
---

# Calibração sai do localStorage e entra no Supabase

## O que mudou

`/calibracao` era o único módulo da plataforma sem banco. Os 38 instrumentos, 8 laboratórios, 12
pedidos de serviço, 2 lotes e o catálogo de preços viviam inteiros em
`localStorage['cmasm_erp_state_v1']`, gravados como um blob único a cada tecla: limpar o cache
apagava o controle de calibração do CMASM, cada computador via um dado diferente, e não havia
backup nem trabalho compartilhado.

Agora as quatro entidades vivem em `cal_labs`, `cal_equipamentos`, `cal_ps`, `cal_lotes` e
`cal_catalogo`. `useStore()` continua sendo a costura única — as 11 páginas React não sabem que o
backend mudou.

## Decisões

| # | Decisão | Por quê |
|---|---------|---------|
| D1 | Tabelas de verdade, escrita por linha | Guardar o blob num `jsonb` seria mudança de 5 linhas, mas dois usuários simultâneos se sobrescreveriam inteiros, em silêncio — e compartilhar o dado era o objetivo |
| D2 | Policies aceitam `anon` | O módulo segue sem login por escolha do usuário; a consequência está escrita no topo da migração e nas pendências |
| D3 | PK de texto (`e001`, `cms`) | Os ids já são as FKs que o React usa nas 11 páginas |
| D4 | `date` no banco, `dd/mm/aaaa` na tela | `prox` decide vencido/a vencer no dashboard inteiro; conversão só em `paraISO`/`paraBR` |
| D5 | A ata não virou tabela | `ATA_ITEMS_SEED`/`ATA_INFO` só aparecem em `.map()`/`.find()` |
| D6 | Contador de PS derivado + `num` unique | Contador de cliente duplica `PS-CMS-26-013` assim que dois emitem juntos |
| D7 | Gravação otimista | Manter os mutators síncronos foi o que permitiu não tocar nas 11 páginas |
| D8 | Seed gerado, não digitado | ~60 linhas de patrimônio, certificado, data e custo reais |

## Dois bugs que só o navegador pegou

Ambos passariam por qualquer revisão de código e por todos os testes de arquivo:

1. **A lista se reembaralhava a cada edição.** `.select()` sem `order` não garante ordem, e o
   `UPDATE` reescreve a tupla noutra posição do heap — o instrumento editado saltava de lugar.
   Invisível em banco recém-carregado; aparece na primeira edição.
2. **Rede fora travava o módulo para sempre.** Consulta do supabase-js contra host inalcançável
   **não rejeita nem resolve** — retenta o fetch indefinidamente (medido: 8,8 s sem desfecho).
   O `try/catch` não pega. O módulo ficava em "Carregando dados do banco…" eternamente — o exato
   caso que o aviso de falha existia para cobrir e que eu havia dado como coberto sem exercitar.
   Pior: uma gravação perdida nunca avisava, porque o `.then` nunca corria — a tela dizia salvo e o
   banco não recebia nada. Corrigido com `comPrazo()` (15 s) na carga e em cada gravação.

## Verificação

**Ensaio** em `postgres:16-alpine` descartável (porta 55434, com `create role anon/authenticated`):
schema aplica limpo e é idempotente; seed carrega 8/38/12/2/30 com FKs resolvidas e datas
convertidas.

**Produção** — migrações 35 e 36 aplicadas em 18/08/2026, conferidas contra o banco: 68 colunas,
7 checks, 10 índices, RLS nas 5 tabelas com 5 políticas, 0 FK órfã.

**Navegador**, com as migrações no ar:

- carga: 38 instrumentos · 8 laboratórios, KPIs calculados, zero erro no console
- `localStorage['cmasm_erp_state_v1']` fica **null** — o módulo realmente parou de gravar no navegador
- escrita: editar Localização física de `e001` → chega no Postgres (coluna `local`), sobrevive à
  recarga e volta na tela; `ult` reaparece como `12/03/2024`
- contador: emitir PS gerou `PS-CMS-26-008` (o máximo de 2026 era 007), com `emi` na data de hoje
- falha: com host inválido, aviso vermelho com a mensagem do prazo e botão de tentar de novo — não
  telas vazias, não "Carregando…" infinito

Artefatos de teste removidos da produção depois (12 PS, 0 sujeira).

`node --test`: 386/386, nenhum teste apagado.

## Pendências

- **Segurança:** o módulo segue sem login e as policies aceitam `anon` — qualquer pessoa com a URL
  altera os dados de todos. Fechar exige `shared/auth.js` mais migração trocando as políticas para
  `to authenticated`.
- **Deploy:** o código ainda não foi publicado. As migrações já estão no ar, então a ordem correta
  está satisfeita — publicar quando o usuário quiser.
- Quem já usava o módulo tem dado mais recente preso no próprio navegador; a tela Dados avisa e
  oferece exportar para reenviar por "Restaurar backup".
- O modo offline do app legado acabou de fato: React e SheetJS seguem embutidos, mas o dado agora
  exige rede.
