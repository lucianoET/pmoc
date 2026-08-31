---
quick_id: 260821-jpd
slug: corrigir-defeitos-verificados-do-modulo-
date: 2026-08-21
status: complete
---

# Sumário — Corrigir defeitos verificados do `/refrigeracao`

Três blocos, todos dentro de `refrigeracao/index.html` (D-04: continua congelado e
standalone). Sem migração — as colunas usadas (`equipamentos.ultima_manutencao`,
`logs_manutencao.*`, `os_eventos.detalhe`) já existiam em produção.

## O que estava quebrado, medido antes

| Fato medido | Consequência na tela |
|---|---|
| `getAllOSEntries()` devolve `{equipId, equip, entry}` | badge de OS pendente lia `o.status` (inexistente) e ficava sempre 0 |
| NOK + vencidas + sem histórico somados sem deduplicar | KPI "Atenção PMOC" dava 202 sobre 171, e o badge de alerta mudava conforme a última tela renderizada |
| `acessoLivre()` zerava o cache de log em vez de carregá-lo | observador via "Sem hist." em 171 de 171 equipamentos |
| `os_eventos` tem `detalhe` (singular), sem `de_status`/`para_status`/`role` | drawer e impressão liam quatro campos inexistentes — trilha sempre vazia |
| Nada gravava `equipamentos.ultima_manutencao` | 0 de 171 equipamentos com data — a agenda PMOC inteira era ficção |
| Certificação sem controle de duplicidade | certificar duas vezes duplicaria linha de histórico |
| `ctUpd` não gravava trilha nenhuma | mudança de status de uma contratação não deixava rastro em `os_eventos` |

## Entregue

**Task 1 — quatro bugs de leitura e contagem.** Bloco puro novo
`/* ── alertas: contagem única ── */` com `equipSemHist`, `equipVencido`, `alertasPmoc`
(união sem duplicar, D-jpd-01) e `contarOSPendentes` (lê `entry.status`, não o nível
errado). `renderDash` e `renderAlerts` passam a ler o mesmo `alertasPmoc(DATA, now)`, então
o badge não muda mais conforme a tela. Seção "Sem Histórico" agora conta todos no
cabeçalho e lista só os críticos (D-jpd-02), com uma linha "+N não críticos". `acessoLivre()`
chama `await loadLogsFromSupabase()` em vez de zerar o cache. `ctEvtTexto(ev)` lê a coluna
real `detalhe`, substituindo as quatro leituras fantasma no drawer e na impressão da OS.

**Task 2 — encerramento de OS grava `ultima_manutencao`, com histórico idempotente.**
`atualizarUltimaManutencao(equipId, data)` só grava quando a data é mais recente que a
registrada (D-jpd-03, comparação lexicográfica de string ISO) e atualiza o objeto em
`DATA` na hora, sem exigir novo fetch. `saveLogEntry` chama essa função quando a OS interna
é registrada como CONCLUÍDA. `ctEncerrarHistorico(o)` grava uma linha em `logs_manutencao`
ao certificar uma contratação, deduplicada pelo prefixo `Contratação <numero>` na descrição
(D-jpd-04, sem coluna nova) — certificar duas vezes não duplica. `ctCertificar` chama essa
função antes de reabrir a ficha da OS.

**Task 3 — trilha `os_eventos` em `ctUpd`.** `ctRegistrarEvento` insere
`{os_id, evento, detalhe, usuario}` usando o schema real; `ctDetalheEvento` monta
"rótulo anterior → rótulo novo" a partir de `CT_STATUS`, e `ctUpd` captura o status
anterior **antes** do update (senão o detalhe sairia `X → X`). Falha ao gravar a trilha
vira `console.warn` e nunca derruba a ação nem troca o toast de sucesso (D-jpd-05). Em
sucesso, a linha nova entra direto em `ctEvt[osId]` (D-jpd-06) — `ctSetupRealtime()` não
escuta `os_eventos`, então sem isso a trilha só apareceria numa recarga. `TESTES.md` ganhou
a seção "Refrigeração — encerramento de OS e trilha" com o roteiro manual de ponta a ponta.

## Gates

- `tests/refrigeracao-contagens.test.js` (10 testes) — Task 1.
- `tests/refrigeracao-encerramento-os.test.js` (11 testes) — Task 2.
- `tests/refrigeracao-trilha-os.test.js` (8 testes) — Task 3.
- Todos no mesmo padrão de `tests/inventario-ordem-refrigeracao.test.js`: recorte do HTML
  single-file avaliado num sandbox `node:vm`, sem framework, sem montar o DOM.
- Suíte inteira: **514/514** (485 de baseline + 29 novos).
- Os quatro `grep -c` do PLAT-15 (`shared/`, `pmoc.css`, `pmoc-tema`, `data-theme`)
  continuam em 0 depois de cada task — refrigeração segue congelada e standalone.

## Task Commits

1. **Task 1: quatro bugs de leitura e contagem** — `bc81169` (fix)
2. **Task 2: encerrar OS grava ultima_manutencao, com histórico idempotente** — `e107aec` (feat)
3. **Task 3: gravar a trilha os_eventos em ctUpd** — `fa1be0a` (feat)

## Files Created/Modified

- `refrigeracao/index.html` — as três tasks, dentro do arquivo congelado.
- `tests/refrigeracao-contagens.test.js` — gate novo (Task 1).
- `tests/refrigeracao-encerramento-os.test.js` — gate novo (Task 2).
- `tests/refrigeracao-trilha-os.test.js` — gate novo (Task 3).
- `TESTES.md` — seção manual nova (Task 3).

## Decisões Made

Nenhuma fora das seis já travadas no plano (D-jpd-01 a D-jpd-06). Um ponto de leitura do
próprio plano: "cargo" no texto de `ctUsuarioEvento` corresponde à coluna `role` de
`usuarios` (é como o restante do arquivo já lê `ctUser.role` para permissões) — não existe
coluna `cargo` no banco.

## Deviations from Plan

None — plano executado exatamente como escrito, incluindo os seis comentários
`<!-- planner-discipline-allow -->` (as quatro leituras fantasma e o marcador `_logCache`
citados no texto do plano, nunca reintroduzidos no código).

## Issues Encountered

Um teste inicial de `tests/refrigeracao-encerramento-os.test.js` usava `assert.deepStrictEqual`
para comparar um objeto criado dentro do sandbox `node:vm` com um literal criado no
realm do teste — `node:vm` cria um `Object.prototype` próprio por contexto, e
`deepStrictEqual` compara também a cadeia de protótipos, então a asserção falhava mesmo com
os mesmos campos e valores. Corrigido comparando campo a campo (`assert.strictEqual` no
valor específico) em vez de comparação estrutural do objeto inteiro — o mesmo cuidado que
já vale para qualquer objeto que atravesse a fronteira do sandbox nesses gates.

## Next Phase Readiness

- Os sete `must_haves.truths` do plano estão cobertos por teste automatizado; o roteiro
  manual de rede real (sessão autenticada avançando uma OS de ponta a ponta) fica em
  `TESTES.md`, seção "Refrigeração — encerramento de OS e trilha", para o próximo ciclo de
  verificação manual do módulo.
- Fora de escopo por decisão do plano (não tocado aqui): fluxo interno com estados/fotos,
  RLS por cargo e edição de equipamento — exigem migração e decisão de produto.

---
*Quick task: 260821-jpd*
*Completed: 2026-08-21*

## Self-Check: PASSED
