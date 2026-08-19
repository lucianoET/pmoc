---
status: complete
---

# Quick Task 260818-vyv — Sumário

**Data:** 2026-08-18 · **Commit:** fc75978

## O que mudou

### T1 — Assets fora do HTML
`refrigeracao/index.html`: **445.661 → 143.793 bytes (−67,7%)**, zero data URI base64 restante.

| Arquivo novo | Bytes | Vinha de |
|---|---|---|
| `icone-192.png` | 20.857 | favicon + `<img>` da barra + `CT_LOGO_URI` + manifest — **5 cópias do mesmo PNG** |
| `icone-512.png` | 41.629 | dentro do manifest |
| `icone-apple-180.png` | 19.839 | `apple-touch-icon` |
| `qr-brand.png` | 42.456 | `CT_QR_BRAND` |
| `manifest.json` | 451 | 111.616 chars de base64 → JSON de 83.711 bytes que reembutia os dois ícones |
| `qrcode.js` | 20.434 | lib qrcode-generator 1.4.4 inline (bloco `<script>` próprio) |

`CT_LOGO_URI` e `CT_QR_BRAND` passaram a `new URL('…', location.href).href` — as duas entram em
`document.write()` de janela `about:blank` (`window.open`), onde caminho relativo depende do
navegador herdar a base do opener.

### T2 — Acessibilidade
- Viewport sem `maximum-scale=1,user-scalable=no` → zoom de pinça liberado.
- `aria-label` nos 7 botões só-de-ícone (buscar, sair, FAB, fechar gaveta ×2, imprimir OS, excluir item ×2).
- `#toast` com `role="status"` + `aria-live="polite"`.
- 95 ícones decorativos com `aria-hidden="true"`.
- `:focus-visible` com contorno azul, branco sobre a barra escura e a nav inferior.

### T3 — Ordenação e vencidos no Inventário
`invOrdem` + `cmpInv()` + `proxManut()` + `isVencido()`, chip "Vencidos" e `<select>` de ordenação.
Criticidade em ordem semântica; sem histórico sempre no fim e nunca "vencido". Card mostra a próxima
manutenção. Estado de tela — nenhuma consulta nova, nenhuma migração.

## Verificação
- Navegador em `http://localhost:8000/refrigeracao/` com os **171 equipamentos reais**: as 4 ordenações
  conferidas, chip "Vencidos" funcional, gaveta de detalhe e lib QR operando, assets em **304 Not Modified**
  na segunda carga (prova do ganho de cache).
- 6 blocos `<script>` inline + `qrcode.js` passam em `node --check`.
- Gate novo `tests/inventario-ordem-refrigeracao.test.js` — 9/9.
- Gates de não regressão do PLAT-15 (`shared/`, `pmoc.css`, `pmoc-tema`, `data-theme`) seguem em **0**.
- `tests/tema-superficies.test.js`, `mobile-375`, `modulos-caminhos`, `mapa-*` — todos verdes.

## Achado dos dados
**169 dos 171 equipamentos não têm nenhum histórico de manutenção** (só 2 têm log, nenhum tem
`ultimaManutencao`). Por isso "Vencidos" devolve 0 hoje e quase todo card mostra "Sem hist." — não é
defeito, é o estado real do PMOC. O estado vazio do filtro passou a dizer isso explicitamente.

## Fora de escopo (deliberado)
- Tema claro/escuro — D-04, módulo congelado.
- Font Awesome do CDN → local: 59 ícones em uso, não reduz o HTML, adiciona ~120 KB de fontes ao repo.
- Extrair as funções de ordenação para um núcleo puro em arquivo separado (padrão de
  `maquinas/estoque-tabela.js`): `proxManut` depende de `nextPmoc`/`getLatestLogDate`, injetar essas
  dependências custaria mais código do que economiza. O gate carrega o trecho num sandbox `node:vm`.
