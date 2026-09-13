---
phase: quick-260811-9sb
plan: 01
subsystem: calibracao
tags: [calibracao, portal, vercel, importacao-legado, standalone]
requires: []
provides:
  - "Módulo /calibracao no ar como cópia independente do app legado (client-side, localStorage)"
  - "Card Calibração ativo no portal"
  - "Rewrite /calibracao no vercel.json"
affects: []
tech-stack:
  added: []
  patterns:
    - "Módulo fora da base compartilhada (padrão refrigeracao): sem shared/auth.js, sem shared/shell.js, sem Supabase"
key-files:
  created:
    - calibracao/index.html
    - calibracao/assets/fonts.css
    - calibracao/assets/erp-module-shell.css
    - calibracao/assets/fonts/dm-sans-latin-400-normal.woff2
    - calibracao/assets/fonts/dm-sans-latin-500-normal.woff2
    - calibracao/assets/fonts/dm-sans-latin-600-normal.woff2
    - calibracao/assets/fonts/dm-sans-latin-700-normal.woff2
    - calibracao/assets/fonts/jetbrains-mono-latin-400-normal.woff2
    - calibracao/assets/fonts/jetbrains-mono-latin-500-normal.woff2
  modified:
    - vercel.json
    - index.html
decisions:
  - "Cópia independente por decisão travada do usuário: nenhuma unificação com shared/, nenhuma integração Supabase — dados permanecem em localStorage (tag 'dados locais' no card)"
  - "Assets (2 CSS + 6 woff2) copiados byte a byte de DEV_ERP (read-only) para calibracao/assets/, tornando o módulo autossuficiente sem referência ao diretório-pai"
  - "Seção 'Planejados' do portal removida por ficar vazia; regra CSS .card.off mantida (inofensiva)"
metrics:
  duration: 3min
  completed: 2026-08-11
status: complete
---

# Quick Task 260811-9sb: Importar módulo Calibração como cópia independente Summary

**One-liner:** App legado de calibração (~862 KB single-file, localStorage) importado como módulo estático `/calibracao` autossuficiente, com assets locais, rewrite no Vercel e card ativo no portal — zero alteração nos módulos em produção.

## O que foi feito

### Task 1 — Módulo autossuficiente (commit 240cfa6)

- `calibracao_erp.html` do DEV_ERP copiado como `calibracao/index.html`.
- `fonts.css`, `erp-module-shell.css` e as 6 woff2 (DM Sans 400/500/600/700 + JetBrains Mono 400/500) copiados para `calibracao/assets/` e `calibracao/assets/fonts/`.
- Os dois `<link>` que subiam diretório (`../assets/`) ajustados para `assets/` local — únicas alterações de conteúdo no HTML.
- Varredura defensiva: nenhum outro `href`/`src` sobe diretório; `erp-module-shell.css` não tem `url()`; todos os `url()` de `fonts.css` resolvem para arquivos copiados (verificado no gate).
- Nada escrito em `/home/luc/DEV_ERP`.

### Task 2 — Rota e portal (commit eb1e342)

- `vercel.json`: rewrite `{ "source": "/calibracao", "destination": "/calibracao/index.html" }` após `/mapa`; JSON validado.
- `index.html` (portal): card Calibração (🔬) movido da seção "Planejados" para o fim da grade "Em produção" como `<a class="card" href="/calibracao">`, com tags `standalone` + `dados locais`.
- Seção "Planejados" vazia removida (resta um único `.lbl`).
- Gate confirmou que o diff toca apenas `index.html`, `vercel.json` e `calibracao/`.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

Nenhum stub introduzido. O app é o legado completo e funcional; a limitação "dados só em localStorage" é característica documentada da cópia independente (T-quick9sb-03, accept), sinalizada pela tag "dados locais" no card — não um stub.

## Threat Flags

Nenhuma superfície nova além do já registrado no `<threat_model>` do plano (T-quick9sb-01 accept: JS legado na mesma origem dos módulos com sessão Supabase; sem fetch, sem CDN, sem backend).

## Verificação

- Gates automatizados das duas tasks: PASSED.
- Conferência humana recomendada (do plano): preview local com `python -m http.server` — abrir `/calibracao/` (fonte DM Sans e shell corretos, console sem 404), portal com card clicável, `/refrigeracao` e `/maquinas` inalterados.

## Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 | 240cfa6 | feat(calibracao): importa app legado de calibração como módulo independente |
| 2 | eb1e342 | feat(portal): ativa card Calibração e roteia /calibracao no Vercel |

## Self-Check: PASSED
