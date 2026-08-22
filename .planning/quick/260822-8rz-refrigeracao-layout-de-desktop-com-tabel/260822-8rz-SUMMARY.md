---
phase: quick
plan: 260822-8rz
subsystem: ui
tags: [refrigeracao, desktop, tabela, css, media-query, tdd]

requires: []
provides:
  - "Versão de computador de /refrigeracao (>=1024px): navegação lateral, gaveta como painel lateral, seis listas em tabela ordenável/filtrável por coluna — camada de apresentação, sem mudar dado, fluxo ou regra de negócio"
  - "Núcleo puro de tabela (modoDaTela, tabProximaOrdem, tabNormalizar, tabComparar, tabAplicar) replicado dentro do arquivo, no mesmo padrão núcleo-puro/aplicador-de-DOM já usado no resto da plataforma — sem importar de shared/ (D-04)"
  - "tabDesenhar/tabCabecalho/tabCorpo/tabBarra: um desenhista só para as seis tabelas, dirigido por definição de coluna (COLS_INV/OS/MOVIM/PMOC/ALERT/CONTRAT)"
  - "filtrarInventario ganha o quarto parâmetro opcional filtrosColuna (D-8rz-09) — tela, etiqueta e CSV nunca divergem"
affects: [refrigeracao]

tech-stack:
  added: []
  patterns:
    - "Núcleo puro de ordenação/filtro replicado (não importado) dentro de um módulo congelado e standalone, quando a pasta compartilhada está fora de alcance por decisão de projeto (D-04)"
    - "CSS novo inteiro dentro de um único @media, MESCLADO num bloco <style> já existente (em vez de um bloco novo) quando o arquivo tem uma folha de impressão embutida como texto de JavaScript que a extração ingênua de <style>...</style> também casa — um bloco a mais depois dela desloca por uma quebra de linha uma impressão digital de CSS gerada por concatenação de blocos"
    - "Estado de tela isolado por tabela (TAB_ESTADO: uma entrada por tabela) em vez de uma variável global de ordenação/filtro compartilhada"

key-files:
  created:
    - tests/refrigeracao-desktop.test.js
    - tests/fixtures/refrigeracao-css-mobile.css
  modified:
    - refrigeracao/index.html
    - tests/refrigeracao-qr-nfc.test.js
    - TESTES.md

key-decisions:
  - "D-8rz-01/02/03/04/05: as cinco decisões do usuário — mesmo arquivo, matchMedia escolhe o renderizador, núcleo replicado (nunca importado), celular intocado por construção (provado por comparação byte-a-byte), linha da tabela abre a mesma ficha do cartão"
  - "D-8rz-06/07: cabeçalho de coluna ENVOLVE cmpInv, não o substitui — sem coluna escolhida a tabela sai na ordem de cmpInv/invOrdem; mexer no seletor de sempre zera a ordenação de cabeçalho e vice-versa, nunca os dois comandando ao mesmo tempo"
  - "D-8rz-08: CRIT_ORDEM, proxManut, isVencido e cmpInv não foram tocados — a ordenação da tabela reusa CRIT_ORDEM/proxManut como valor, não reescreve a regra"
  - "D-8rz-09/10: filtrarInventario ganha o quarto parâmetro (filtrosColuna), com três argumentos byte a byte igual a antes; a ordem do CSV/etiqueta continua .sort(cmpInv), nunca a ordem de cabeçalho"
  - "D-8rz-11/12: Inst./Remoção também vira tabela (sexta); um desenhista só (tabDesenhar/tabCabecalho/tabCorpo/tabBarra) para as seis, nunca seis desenhistas"
  - "D-8rz-13/14: célula mista ordena pelo DADO PRINCIPAL (valor()), nunca pelo texto concatenado que a célula imprime ou que o filtro casa (texto()); vazio sempre no fim nas duas direções, zero nunca é vazio"
  - "D-8rz-15/16: TAB_ESTADO tem uma entrada por tabela (inv/os/movim/pmoc/alert/contrat); digitar num filtro redesenha só o <tbody> via TAB_CACHE, para não matar o foco do campo"
  - "D-8rz-17: gaveta vira painel lateral só por CSS (translateX); gesto de arrastar desiste em TELA_LARGA; Escape fecha nas duas larguras; gestoFechaGaveta não foi tocada"
  - "D-8rz-18/19/20/21: teto de 200px do QR intacto; nenhum seletor de elemento nu (table{}/th{}/td{}/tr{}), tudo escopado em .lista-tabela; cabeçalho da tabela gruda no topo, .search-wrap deixa de grudar; sem virtualização nem paginação (171 linhas)"
  - "D-8rz-22/23: linha inteira clicável para o mouse, primeira célula é <button> de verdade com stopPropagation (caminho por teclado sem tabindex fingido); guarda de TELA_LARGA sempre depois do ramo de lista vazia (renderAlerts tem forma própria, depois dos quatro conjuntos calculados)"
  - "D-8rz-24/25: só a página ativa é redesenhada ao cruzar o limiar (chip/busca/gaveta sobrevivem); gate escrito e visto falhando antes do núcleo existir"
  - "Deviação de posicionamento do CSS (Task 2): o bloco <style> novo foi MESCLADO no último <style> já existente (imediatamente antes do qrcode.js), não criado como bloco separado — criar um 7º bloco de <style>...</style> desloca por uma quebra de linha (Array.join separador) a impressão digital do CSS de celular, porque a folha de impressão de refrigeracao/index.html está embutida como texto de JavaScript e a extração ingênua de <style>...</style> a casa como se fosse um bloco de estilo real. O único @media exigido pelo gate e o resultado visual são idênticos ao que o plano pedia; só a localização física do bloco no arquivo mudou, com nota explicativa deixada no código"

patterns-established:
  - "Extração de CSS por concatenação ingênua de <style>...</style> + remoção de @media por casamento de chaves é sensível ao NÚMERO de blocos casados, não só ao conteúdo — adicionar um bloco novo depois de uma folha de impressão embutida em string de JavaScript (que a regex também casa) sempre introduz um separador extra; a correção é mesclar no bloco existente mais próximo, nunca criar um novo depois do ponto de embutimento"

requirements-completed: [QUICK-260822-8rz]

coverage:
  - id: D1
    description: "Núcleo puro de tabela (modo de tela, ordenação, filtro, colunas das seis tabelas) — gate vermelho antes de verde"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-desktop.test.js — 23 casos da Tarefa 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "CSS fora de @media byte-a-byte idêntico ao fixture de celular (D-8rz-04), nas três tarefas"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-desktop.test.js#D-8rz-04: o CSS extraído fora de @media é estritamente igual ao fixture de celular"
        status: pass
    human_judgment: false
  - id: D3
    description: "Layout de computador: navegação lateral, largura útil, gaveta como painel lateral, um único @media, troca de modo por matchMedia"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-desktop.test.js — 5 casos da Tarefa 2 (1 @media, sem seletor nu, 5 nav-btn, aplicarModoDeTela)"
        status: pass
    human_judgment: false
  - id: D4
    description: "As seis listas viram tabela sob TELA_LARGA, com ordenação/filtro por coluna, aria-sort, caminho por teclado e sem XSS no filtro"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-desktop.test.js — 12 casos da Tarefa 3"
        status: pass
    human_judgment: false
  - id: D5
    description: "Conferência visual em 1440px (navegação, tabelas, ordenar/filtrar, ficha, gaveta, Escape, cruzar o breakpoint) e em 375px (idêntico a hoje)"
    verification:
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — versão de computador: tabelas, navegação lateral, gaveta em painel (22/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "Sem Playwright nem navegador real neste ambiente autônomo — mesma pendência já registrada no PLAT-15/16 da Fase 5. Roteiro documentado em TESTES.md."
  - id: D6
    description: "refrigeracao/index.html continua congelada e standalone (D-04): quatro grep do PLAT-15 em 0"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-desktop.test.js#os quatro grep do PLAT-15 continuam em 0"
        status: pass
    human_judgment: false

duration: ~70min
completed: 2026-08-22
status: complete
---

# Quick Task 260822-8rz: Versão de computador de /refrigeracao — Summary

**Em `>=1024px`, `/refrigeracao` ganha navegação lateral, largura útil, gaveta como painel lateral pela direita e as seis listas (Inventário, OS-Manutenção, Inst./Remoção, PMOC, Alertas, Contratações) viram tabelas ordenáveis e filtráveis por coluna — tudo dentro de um único `@media (min-width:1024px)`, com o CSS de celular provado byte a byte intocado; abaixo de 1024px nada mudou. Camada de apresentação pura: nenhum dado, fluxo ou regra de negócio foi alterado.**

## Performance

- **Duration:** ~70min
- **Completed:** 2026-08-22
- **Tasks:** 3/3 completas
- **Files modified:** 5 (2 criados: `tests/refrigeracao-desktop.test.js`, `tests/fixtures/refrigeracao-css-mobile.css`; 3 modificados)

## Accomplishments

- Núcleo puro de tabela (`modoDaTela`, `tabProximaOrdem`, `tabNormalizar`, `tabComparar`, `tabAplicar`) replicado dentro do arquivo — nunca importado de `shared/` (D-04) — com as seis definições de coluna e `TAB_ESTADO` isolando ordenação/filtro por tabela.
- Layout de computador inteiro dentro de um único `@media (min-width:1024px)`: navegação lateral com estado ativo de quatro sinais, largura útil de 1400px, gaveta como painel lateral via `translateX`.
- `tabDesenhar`/`tabCabecalho`/`tabCorpo`/`tabBarra`: um desenhista só para as seis tabelas, cabeçalho com `aria-sort` e ordenação/filtro por coluna, digitar no filtro redesenha só o `<tbody>`.
- `filtrarInventario` ganha o quarto parâmetro `filtrosColuna` (D-8rz-09) sem mudar o comportamento de três argumentos — tela, etiqueta e CSV nunca divergem.

## Task Commits

1. **Task 1: Núcleo puro de tabela + gate vermelho antes de verde** - `dea354f` (feat)
2. **Task 2: Layout de computador — navegação lateral, gaveta como painel lateral** - `8b93aef` (feat)
3. **Task 3: As seis listas viram tabelas — um desenhista, seis adaptadores** - `e85ce69` (feat)

_Nenhuma task usou ciclo TDD de commits separados (test→feat) — a verificação vermelho-antes-de-verde da Task 1 foi feita como passo de processo (rodar o gate contra o código de ontem, ver falhar, só então implementar), com o commit único cobrindo teste + implementação, seguindo a instrução explícita do orquestrador de um commit atômico por task._

## Files Created/Modified

- `tests/refrigeracao-desktop.test.js` — gate novo, 40 casos (núcleo puro, colunas, TAB_ESTADO, filtrarInventario com 4 argumentos, linhasAlertas, estrutura do CSS/`@media`, tabDesenhar/tabCabecalho/tabCorpo, guardas de TELA_LARGA)
- `tests/fixtures/refrigeracao-css-mobile.css` — impressão digital do CSS de celular, gerada ANTES de qualquer mudança de CSS (24.053 caracteres)
- `refrigeracao/index.html` — bloco `<script>` novo no fim do `<body>` (núcleo, colunas, modo de tela, desenhista de tabela); `@media` mesclado no último `<style>` existente (ver deviação); seis guardas de `TELA_LARGA` nos renderizadores; `filtrarInventario`/`setInvOrdem` ajustados
- `tests/refrigeracao-qr-nfc.test.js` — sandbox de `filtrarInventario` ganhou `TAB_ESTADO: {inv:{filtros:{}}}`, quebrado pela nova referência global (Rule 3)
- `TESTES.md` — roteiro manual de conferência em 1440px/375px

## Decisions Made

Ver `key-decisions` no frontmatter — D-8rz-01 a D-8rz-25, todas travadas no próprio PLAN.md e seguidas à risca, com uma deviação de posicionamento física do CSS documentada abaixo (não muda o resultado exigido pelo gate).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — bloqueio direto desta mudança] `tests/refrigeracao-qr-nfc.test.js` quebrou com `TAB_ESTADO is not defined`**
- **Encontrado durante:** Task 1, ao rodar `node --test` completo
- **Causa:** `etiquetasDoInventario()` passou a ler `TAB_ESTADO.inv.filtros` (D-8rz-09); o sandbox `carregarSandboxFiltro()` desse gate não define `TAB_ESTADO`
- **Fix:** adicionado `TAB_ESTADO: { inv: { filtros: {} } }` ao `ctx` desse sandbox — reproduz o comportamento de três argumentos que o gate já provava
- **Files modified:** `tests/refrigeracao-qr-nfc.test.js`
- **Commit:** `dea354f`

**2. [Rule 3 — necessidade técnica para satisfazer a própria verificação do plano] Bloco `<style>` novo mesclado no existente em vez de criado separado**
- **Encontrado durante:** Task 2, ao verificar D-8rz-04 (CSS fora de `@media` byte-a-byte igual ao fixture)
- **Causa:** o gate concatena o conteúdo de todos os `<style>…</style>` separados por `\n` — e a folha de impressão de `refrigeracao/index.html` (função que monta a página A4) está embutida como **texto de JavaScript**, contendo literalmente as substrings `<style>` e `</style>`, que a regex ingênua também casa como se fosse um bloco de estilo real. Criar um bloco `<style>` NOVO depois desse ponto do arquivo (como a ação da Tarefa 2 pedia) aumenta de 6 para 7 o número de blocos casados — e `Array.prototype.join('\n')` insere um separador a mais, que sobra como um caractere de quebra de linha extra no texto "fora de `@media`", quebrando a igualdade byte a byte contra o fixture congelado na Tarefa 1, mesmo sem mudar um pixel do celular.
- **Fix:** o `@media (min-width:1024px){...}` da Tarefa 2 foi escrito dentro do **último `<style>` já existente** do arquivo (o que vem logo antes do `<script src="/refrigeracao/qrcode.js">`), sem criar um bloco novo — mantém o número de blocos casados em 6, e a extração continua batendo com o fixture. Uma nota no código (dentro do `<script>` da Tarefa 2) documenta o porquê de não haver um `<style>` visível ali.
- **Files modified:** `refrigeracao/index.html`
- **Commit:** `8b93aef`
- **Verificação:** `tests/refrigeracao-desktop.test.js#D-8rz-04` passou com o CSS mesclado; o único `@media` novo (excluindo o `@media print` pré-existente e legítimo da folha de impressão) segue sendo exatamente `(min-width:1024px)`.

---

**Total deviations:** 2 auto-fixed (2 Rule 3 — ambas bloqueios diretos das próprias mudanças desta tarefa)
**Impact on plan:** Nenhum scope creep. A segunda deviação é de **posicionamento físico** do CSS no arquivo, não de resultado — o único `@media (min-width:1024px)` exigido pelo gate, o layout visual e todas as regras de escopo (D-8rz-19) são idênticos ao que a ação da Tarefa 2 descrevia.

## Issues Encountered

Ao implementar a deviação 2 acima, uma primeira tentativa (criar o bloco `<style>` separado, como o texto da ação pedia) foi escrita, testada, vista falhando, e revertida antes de prosseguir — nenhum código incorreto foi deixado no arquivo final. O texto explicativo desse retrabalho está preservado só como comentário no código-fonte (não como histórico de commit intermediário), já que a instrução do orquestrador pedia exatamente um commit atômico por task.

## User Setup Required

Nenhum. Frontend puro, nenhuma migração, nenhuma dependência nova, nenhum arquivo fora de `pmoc-overlay` tocado — basta o próximo deploy (push em `luctronics-ET/pmoc`).

## Next Phase Readiness

- `node --test`: 812/812, 0 falhas (772 de baseline + 40 novos)
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0
- `cmpInv`, `CRIT_ORDEM`, `proxManut`, `isVencido` e `gestoFechaGaveta` não foram tocados
- Roteiro manual pendente em `TESTES.md`: conferência visual em 1440px (navegação, tabelas, ordenar/filtrar, ficha, gaveta, Escape, cruzar o breakpoint) e em 375px (idêntico a hoje) — sem Playwright nem navegador real neste ambiente, mesma pendência do PLAT-15/16
- `git diff --stat` das três tasks toca só `refrigeracao/index.html`, dois arquivos novos em `tests/`, um arquivo existente em `tests/` e `TESTES.md` — nada em `shared/`, `supabase/`, nem em `/home/luc/DEV_ERP`

## Self-Check: PASSED

- `tests/refrigeracao-desktop.test.js` e `tests/fixtures/refrigeracao-css-mobile.css` confirmados em disco.
- Os 3 commits de task (`dea354f`, `8b93aef`, `e85ce69`) confirmados em `git log`.
- `node --test`: 812/812 verde.
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0.
- CSS fora de `@media` estritamente igual ao fixture (D-8rz-04), com o único `@media` novo sendo `(min-width:1024px)`.
