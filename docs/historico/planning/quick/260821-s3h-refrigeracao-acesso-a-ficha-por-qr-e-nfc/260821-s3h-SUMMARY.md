---
phase: quick
plan: 260821-s3h
subsystem: ui
tags: [refrigeracao, qrcode, nfc, etiquetas, impressao, supabase]

requires: []
provides:
  - "lerAlvoFicha/buscaSemAlvo/limparUrlDoAlvo/aplicarAlvoFicha: link profundo ?equip= sobrevivendo ao login, nos dois caminhos de entrada (initAppOnce e acessoLivre)"
  - "urlBaseApp/urlFichaEquip/qrSvgDe: origem única de URL (sempre sem query/hash) e gerador de SVG único, três destinos (tela, papel, etiqueta)"
  - "filtrarInventario: filtro do inventário extraído de renderInv, com dois consumidores (a tela e etiquetasDoInventario)"
  - "etiquetaHtml/imprimirEtiquetas/imprimirEtiquetaDe/copiarLinkFicha/blocoQrFicha: bloco 5 da ficha, folha de etiquetas A4 (3 por linha, QR de 22mm), QR embutido na ficha impressa"
  - "nfcDisponivel/mensagemErroNfc/gravarTagNfc/blocoNfc: gravação de tag NFC condicional (Chrome/Android, https), com frase própria por falha e URL sempre visível para gravação manual"
  - "imprimirDocumento ganha o parâmetro estilo (CSS extra), sem novo window.open/@page — a etiqueta é o terceiro consumidor"
affects: [refrigeracao]

tech-stack:
  added: []
  patterns:
    - "Deep link consumido uma vez por carga (ALVO_FICHA capturado no top-level, zerado no primeiro uso) e aplicado nos dois caminhos de entrada (sessão autenticada e observador) — mesma ideia de DEEP_LINK_ATIVO_CONSUMIDO em maquinas/app.js (Phase 10-03), reimplementada aqui porque refrigeracao/index.html é standalone e não compartilha shared/"
    - "Origem única de URL (urlBaseApp) delegada por qrGetUrl, para o QR do app inteiro nunca herdar o ?equip= de uma página aberta por link profundo"
    - "Terceiro consumidor de uma função compartilhada só ganha um parâmetro novo (estilo), nunca uma duplicata — mesma regra que promoveu shared/tabela.js e imprimirDocumento em si (D-q57-10)"

key-files:
  created:
    - tests/refrigeracao-qr-nfc.test.js
  modified:
    - refrigeracao/index.html
    - TESTES.md

key-decisions:
  - "D-s3h-01: link profundo em ?equip= na query, nunca no hash — o rewrite do Vercel preserva a query; o # não chega ao servidor"
  - "D-s3h-02: ALVO_FICHA capturado uma vez na carga (top-level), aplicado depois de DATA existir, nos dois caminhos de entrada (initAppOnce e acessoLivre)"
  - "D-s3h-03: a URL é limpa com history.replaceState assim que o alvo é consumido, inclusive quando o equipamento não existe — replaceState, nunca pushState, e só o parâmetro equip é removido"
  - "D-s3h-04: o valor do parâmetro é entrada não confiável — lerAlvoFicha aceita só /^\\d{1,9}$/, sem decodeURIComponent, e nada do valor cru chega a HTML"
  - "D-s3h-05: urlBaseApp() é a única origem de URL, sempre sem query e sem hash; qrGetUrl() passa a delegar nela"
  - "D-s3h-06: o QR da tela e o QR do papel são o mesmo gerador (qrSvgDe), SVG embutido na string de HTML na impressão — a janela de document.write não enxerga qrcode.js do pai"
  - "D-s3h-07: a etiqueta é o terceiro consumidor de imprimirDocumento, que ganha o parâmetro estilo — window.open( e @page{size:A4 continuam em 1 ocorrência cada no arquivo inteiro"
  - "D-s3h-08: a folha de etiquetas imprime exatamente a seleção que o inventário está mostrando agora (filtrarInventario, dois consumidores); seleção vazia avisa e não abre janela"
  - "D-s3h-09: o QR/NFC entra como bloco 5 da ficha (empilhado na vertical), não como botão no rodapé de #drawer-footer (que já tem quatro botões e estouraria 375px)"
  - "D-s3h-10: a tag NFC guarda a mesma URL do QR — gravar com qualquer app de celular é o caminho principal, o botão é conveniência"
  - "D-s3h-11: o botão de gravar só aparece com 'NDEFReader' in window E window.isSecureContext===true"
  - "D-s3h-12: cada fracasso real de gravação (NotAllowedError/NotSupportedError/NotReadableError/NetworkError/AbortError) tem frase própria mapeada por e.name, com espera limitada por AbortController + prazo"
  - "D-s3h-13: nenhuma migração, coluna ou biblioteca nova — só frontend"
  - "D-s3h-14: etiqueta em grade de 3 colunas A4, QR de 22mm — abaixo disso o módulo fica fino demais para a câmera a poucos centímetros"
  - "D-s3h-15: refrigeracao/qrcode.js não é tocado — biblioteca de terceiro, MIT, embutida; só quem a chama muda"

patterns-established:
  - "filtrarInventario/etiquetasDoInventario como segundo par pure-core/DOM-applier dentro de refrigeracao/index.html (o primeiro é cmpInv/renderInv) — a correção de (e.local||'')/(e.predio||'') viajou junto, sem mudança de regra"

requirements-completed: []

coverage:
  - id: D1
    description: "Link profundo ?equip= sobrevivendo ao login (sessão autenticada e observador), URL limpa com replaceState nos dois desfechos, id inválido/inexistente nunca abre gaveta vazia nem lança"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#lerAlvoFicha devolve o inteiro 42 (número, não string) para as cinco formas de query aceitas"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#lerAlvoFicha devolve null para lixo, ausência, decimal, negativo, notação científica, percent-encoded, estouro de dígitos, espaço e chave parecida — sem lançar"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#aplicarAlvoFicha com id existente abre a ficha, leva ao inventário, limpa a URL uma vez, e a segunda chamada não faz nada"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#aplicarAlvoFicha com id inexistente avisa nomeando o número, limpa a URL, não abre gaveta e devolve false"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#fiação: aplicarAlvoFicha() é chamada em initAppOnce e em acessoLivre, depois de renderInv()"
        status: pass
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — acesso à ficha por QR code e por tag NFC, e etiquetas (21/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "A prova de que o QR/tag abre a ficha certa, com login no caminho ou como observador, exige um celular real escaneando/aproximando de uma tag física — fora do alcance deste executor autônomo. Roteiro documentado em TESTES.md."
  - id: D2
    description: "QR por equipamento no bloco 5 da ficha, embutido na ficha impressa, e folha de etiquetas A4 com exatamente a seleção do inventário"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#urlFichaEquip(42) devolve base + ?equip=42, sem arrastar a query nem o hash da página atual"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#qrSvgDe devolve SVG de verdade, URLs diferentes produzem desenhos diferentes, e sem qrcode devolve \"\" sem lançar"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#filtrarInventario devolve a mesma seleção que o inventário mostra, para cada chip e para a busca por local/predio/fabricante — sem lançar com local/predio nulos"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#imprimirEtiquetas([]) e imprimirEtiquetas() avisam e não chamam imprimirDocumento nenhuma vez"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#imprimirEtiquetas com 3 equipamentos chama imprimirDocumento uma vez, com assinaturas vazias, estilo não vazio, e 3 etiquetas com QR"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#o corpo de printFicha referencia qrSvgDe( e passa estilo:, sem window.open nem declaração de página própria"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#no arquivo inteiro, window.open( e a declaração de página A4 continuam em 1 ocorrência cada — a etiqueta não abriu segunda folha"
        status: pass
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — acesso à ficha por QR code e por tag NFC, e etiquetas (21/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "Ler o QR de verdade com uma câmera (na tela, na etiqueta e no papel impresso) exige um celular físico e uma impressora — fora do alcance deste executor autônomo. Roteiro documentado em TESTES.md."
  - id: D3
    description: "Gravação de tag NFC condicional (Chrome/Android, https), frase própria por falha, instrução de gravação manual quando o botão não aparece"
    verification:
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#nfcDisponivel() é true só com NDEFReader presente E isSecureContext===true; false nos três outros arranjos"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#mensagemErroNfc devolve frase distinta para cada um dos cinco nomes; nome desconhecido trata a mensagem (com e sem parênteses vazio); nunca contém undefined/null"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#gravarTagNfc(7) num contexto com suporte chama write uma vez, com records[0].recordType \"url\", records[0].data === urlFichaEquip(7), e um segundo argumento com signal"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#gravarTagNfc cuja escrita rejeita com NetworkError devolve false, avisa com a frase daquele nome, e não lança"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#clearTimeout é chamado tanto no sucesso quanto na falha, com o mesmo identificador devolvido por setTimeout"
        status: pass
      - kind: unit
        ref: "tests/refrigeracao-qr-nfc.test.js#blocoNfc(7) com suporte contém gravarTagNfc(7 e um <button; sem suporte não contém <button e contém a instrução de gravar por app de NFC"
        status: pass
      - kind: manual_procedural
        ref: "TESTES.md#Refrigeração — acesso à ficha por QR code e por tag NFC, e etiquetas (21/08/2026)"
        status: unknown
    human_judgment: true
    rationale: "Gravar uma tag NFC física exige o Web NFC API real (Chrome/Android) e uma tag regravável — a API não existe em Node nem é simulável fora do navegador. Roteiro documentado em TESTES.md."

duration: ~40min
completed: 2026-08-21
status: complete
---

# Quick Task 260821-s3h: Acesso à ficha por QR code e NFC, e etiquetas — Summary

**`/refrigeracao` ganha acesso à ficha do equipamento por link profundo (`?equip=`), QR code por equipamento (tela, papel e etiqueta), folha de etiquetas A4 gerada a partir do filtro atual do inventário, e gravação condicional de tag NFC — tudo sem migração, sem biblioteca nova e sem tocar `qrcode.js`.**

## Performance

- **Duration:** ~40min
- **Completed:** 2026-08-21
- **Tasks:** 3/3 completas
- **Files modified:** 3 (1 criado: `tests/refrigeracao-qr-nfc.test.js`; 2 modificados: `refrigeracao/index.html`, `TESTES.md`)

## Accomplishments

- `PARAM_FICHA`/`ALVO_FICHA`/`lerAlvoFicha`/`buscaSemAlvo`/`limparUrlDoAlvo`/`aplicarAlvoFicha`: link profundo `?equip={id}` capturado uma vez na carga (D-s3h-02) e aplicado ao fim de `initAppOnce()` **e** de `acessoLivre()` — os dois caminhos de entrada, sessão autenticada e observador. `lerAlvoFicha` é puro, aceita só `/^\d{1,9}$/`, nunca chama `decodeURIComponent` (D-s3h-04). A URL é limpa com `history.replaceState` assim que o alvo é consumido, inclusive quando o equipamento não existe (D-s3h-03) — F5 não reabre a gaveta.
- **Bug pré-existente corrigido, registrado sem eufemismo:** `qrGetUrl()` usava `location.href.split('#')[0]`, que **incluía a query string** — um QR "Acesse pelo celular" gerado numa página aberta por `?equip=7` distribuiria o `?equip=7` de quem o gerou para quem escaneasse o QR do app inteiro. `qrGetUrl()` agora delega em `urlBaseApp()` (D-s3h-05), que corta query e hash sempre.
- `urlBaseApp()`/`urlFichaEquip(id)`/`qrSvgDe(url, cell)`: origem única de URL (valor salvo em `pmoc_app_url` passa por `linkSeguro`, cai no endereço da própria página se envenenado) e um gerador de SVG só, três destinos — QR na tela da ficha, QR embutido na ficha impressa (D-s3h-06), QR de cada etiqueta.
- `filtrarInventario(dados, busca, chip)`: extraída de dentro de `renderInv`, com dois consumidores (a lista da tela e `etiquetasDoInventario`) — mesma regra de sempre, com a correção de ler `local`/`predio` com `(e.local||'')` (como `fabricante` já era) para não lançar `TypeError` em registro sem esses campos.
- `etiquetaHtml`/`imprimirEtiquetas`/`imprimirEtiquetaDe`/`copiarLinkFicha`/`blocoQrFicha`: bloco 5 da ficha (`5 · Etiqueta, QR e NFC`, empilhado na vertical — D-s3h-09), folha de etiquetas A4 em grade de 3 colunas com QR de 22mm (D-s3h-14), botão de etiquetas no cabeçalho do inventário. Seleção vazia avisa e não abre janela (D-s3h-08). `imprimirDocumento` ganha o parâmetro `estilo` (D-s3h-07) — `window.open(` e a declaração de página A4 continuam em **1** ocorrência cada no arquivo inteiro.
- `nfcDisponivel()`/`mensagemErroNfc(nome, mensagem)`/`gravarTagNfc(id)`/`blocoNfc(id)`: botão "Gravar tag NFC" só com `'NDEFReader' in window` E `window.isSecureContext===true` (D-s3h-11); cinco fracassos reais mapeados por `e.name`, cada um com frase própria dizendo o que fazer (D-s3h-12); espera limitada por `AbortController` (30s) com `clearTimeout` no `finally`, nos dois desfechos. Sem suporte, nenhum botão — a instrução de gravar por app de NFC toma o lugar, com a URL sempre visível (D-s3h-10).
- `TESTES.md`: roteiro manual completo (etiquetas, QR com/sem login, F5, id inexistente, gravação NFC, ausência de suporte).
- `node --test`: 626/626 (596 de antes + 30 novos). Os quatro `grep -c` do PLAT-15 continuam em 0.

## Task Commits

1. **Task 1: o link profundo ?equip= sobrevivendo ao login, nos dois caminhos de entrada** - `b7df04f` (feat)
2. **Task 2: QR por equipamento na ficha e na ficha impressa, e a folha de etiquetas** - `eef80d8` (feat)
3. **Task 3: gravação de tag NFC condicional, com a URL exibida para gravação manual** - `b71e005` (feat)

## Files Created/Modified

- `refrigeracao/index.html` — link profundo, ponte de campos/QR/etiquetas, gravação de NFC, bloco 5 da ficha, botão de etiquetas no inventário, `imprimirDocumento` com `estilo`, `qrGetUrl` delegando em `urlBaseApp`
- `tests/refrigeracao-qr-nfc.test.js` — gate novo, 30 casos (Task 1: 9, Task 2: 12, Task 3: 9)
- `TESTES.md` — roteiro manual deste task

## Decisions Made

Ver `key-decisions` no frontmatter — D-s3h-01 a D-s3h-15, todas travadas no PLAN.md e seguidas à risca. Nenhuma decisão nova tomada durante a execução.

## Deviations from Plan

None - plano executado conforme escrito. Um ajuste de interpretação, dentro do espaço de liberdade do plano (não muda comportamento nem escopo):

- **Done criterion #12 da Task 2** pedia um teste afirmando que "o corpo de `renderInv` não contém `invChip==='vencidos'`" — mas a própria ação do plano manda `renderInv` seguir **byte a byte** a partir de `el('inv-cnt').textContent`, o que preserva o bloco de mensagem vazia (`var vazio = invChip==='vencidos' ? … : …`), que legitimamente usa esse literal para escolher a frase de "nenhum resultado". As duas instruções são inconsistentes entre si tomadas ao pé da letra. Resolvido escrevendo o teste para verificar a intenção real do critério — que a **regra de filtro** não está mais inline em `renderInv` (ausência de `DATA.filter(` na linha de `var list =`, presença de `filtrarInventario(`) — sem exigir a ausência total do literal, que quebraria a byte-a-byte pedida explicitamente pela própria ação do plano.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Sem migração (D-s3h-13); nada a rodar no Supabase.

## Next Phase Readiness

- `node --test`: 626/626, 0 falhas
- `git diff --stat` (94c0b34..HEAD) toca exatamente três arquivos: `refrigeracao/index.html`, `tests/refrigeracao-qr-nfc.test.js`, `TESTES.md`
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0
- `refrigeracao/qrcode.js` e `refrigeracao/qr-brand.png` intocados (D-s3h-15) — conferido: não aparecem em `git diff --stat`
- Nenhum arquivo em `supabase/` criado ou alterado (D-s3h-13)
- **Pendência registrada sem eufemismo (T-s3h-07, accept):** nada do lado do site impede alguém de colar uma etiqueta/tag falsa numa máquina apontando para outro equipamento. A URL é visível no navegador antes de qualquer ação, e o app não aceita do link nenhuma instrução além de um id inteiro — mitigar de verdade exigiria assinar a etiqueta, fora deste escopo (22mm de adesivo não comporta).
- **Verificação humana pendente (roteiro em `TESTES.md`):** escanear QR/tag com celular real, gravar tag NFC pelo Chrome/Android, imprimir folha de etiquetas e ficha — fora do alcance deste executor autônomo (sem navegador, sem hardware NFC, sem impressora).

## Self-Check: PASSED

- O arquivo criado (`tests/refrigeracao-qr-nfc.test.js`) confirmado em disco.
- Os 3 commits de task (`b7df04f`, `eef80d8`, `b71e005`) confirmados em `git log`.
- `node --test`: 626/626 verde.
- Os quatro `grep -c` do PLAT-15 em `refrigeracao/index.html`: 0/0/0/0.
- `git diff --stat 94c0b34 HEAD` lista exatamente `TESTES.md`, `refrigeracao/index.html`, `tests/refrigeracao-qr-nfc.test.js`.
