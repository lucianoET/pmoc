# Quick Task 260818-vyv: refrigeração — assets fora do HTML, acessibilidade e ordenação do inventário

**Data:** 2026-08-18
**Alvo:** `refrigeracao/index.html` (app legado single-file, 445.661 bytes, em produção)

## Contexto

A `refrigeracao` está congelada desde 07/08/2026 (D-04): fora de `shared/auth.js`, `shared/shell.js`,
`shared/tema.js` e `shared/pmoc.css`. Esta tarefa **não** rompe esse congelamento — nenhuma das três
frentes faz o arquivo referenciar `shared/`, `pmoc.css`, `pmoc-tema` ou `data-theme`, que são
exatamente os quatro gates de não regressão registrados em `TESTES.md` (PLAT-15). Continua zero-build,
sem npm, sem dependência nova, sem migração.

## Diagnóstico medido

| Achado | Medida |
|---|---|
| base64 embutido no HTML | 278.112 caracteres — 62% do arquivo |
| PNG 192×192 (20.857 bytes) | **repetido 3×**: favicon (L11), `<img>` (L554), `CT_LOGO_URI` (L2382) |
| manifest (L13) | 111.616 chars de base64 → 83.711 bytes de JSON que **reembute** os ícones 192 e 512 |
| apple-touch-icon (L12) | 26.452 chars → PNG 180×180 |
| `CT_QR_BRAND` (L2507) | 56.608 chars → PNG 984×984 |
| lib `qrcode` minificada inline (L2496) | 20.433 chars |
| `user-scalable=no` no viewport (L5) | bloqueia zoom de pinça |
| atributos `aria-` no app inteiro | 1 |
| ordenação do inventário | inexistente — 171 cards na ordem que o Supabase devolver |

## Tarefas

### T1 — Extrair assets do HTML para arquivos reais
Criar em `refrigeracao/`: `icone-192.png`, `icone-512.png`, `icone-apple-180.png`, `qr-brand.png`,
`manifest.json`, `qrcode.js`. Substituir os data URIs por caminhos.

Decisão: `CT_LOGO_URI` e `CT_QR_BRAND` passam a ser resolvidos com
`new URL('arquivo.png', location.href).href` em vez de caminho relativo cru — as duas variáveis são
injetadas em `document.write()` de uma janela `window.open('','_blank')` (L2655-2657) e em HTML de
impressão; uma URL relativa dentro de um documento `about:blank` depende de o navegador herdar a base
do opener. A URL absoluta resolvida em tempo de execução funciona igual em Vercel, em
`python -m http.server` e em `file://`.

Critério: `index.html` cai para ~147 KB, os 6 assets passam a ser cacheáveis pelo navegador, e nenhum
`data:` base64 sobra no arquivo.

### T2 — Acessibilidade
- Viewport: remover `maximum-scale=1,user-scalable=no`.
- `aria-label` nos 5 botões da nav inferior, no FAB, no botão de busca e nos botões só-de-ícone.
- `#toast` com `role="status"` + `aria-live="polite"`.
- `:focus-visible` visível (o reset atual zera o outline via `-webkit-tap-highlight-color` e o CSS não
  define foco).

### T3 — Ordenação e filtro de vencidos no Inventário
Em `renderInv()`: seletor de ordenação (local, prédio, criticidade, próxima manutenção PMOC) e chip
"vencidos" (inspeção **ou** preventiva com data já passada), reaproveitando `nextPmoc()` e
`autoCrit()` que já existem. Estado de tela apenas — sem consulta nova ao Supabase, sem migração.
Ordenação por criticidade usa a ordem semântica CRÍTICA > ALTA > MÉDIA > BAIXA, não alfabética.
Vazios sempre no fim, nas duas direções — mesma regra já fixada em `maquinas/estoque-tabela.js`.

## Fora de escopo
- Tema claro/escuro (D-04, congelado).
- Font Awesome do CDN → local (mexeria em 59 ícones; sem ganho de peso no HTML).
- Qualquer migração de banco.
