---
phase: quick-260810-k0q
plan: 01
subsystem: ui
tags: [leaflet, vercel-rewrite, supabase-auth, cargo-login, xmap]

requires: []
provides:
  - "Módulo /mapa no padrão pmoc: login por cargo, Leaflet 1.9.4 fixado via CDN, componente xMap portado com camadas de demonstração"
  - "Rewrite /mapa no vercel.json e card correspondente no portal"
  - "Checklist manual do módulo Mapa e consulta SQL de conferência do import do CSV de VTR/EMB em TESTES.md"
affects: [mapa, transportes]

tech-stack:
  added: ["Leaflet 1.9.4 (CDN, unpkg)"]
  patterns:
    - "xMap singleton global (window.xMap) inicializado apenas após #app ficar visível, para evitar container de altura zero"
    - "Camadas de mapa registradas via IIFE que chama xMap.registerLayer() ao carregar o script"

key-files:
  created:
    - mapa/xmap.js
    - mapa/xmap.css
    - mapa/xmap-layers-aguada.js
    - mapa/xmap-layers-grama.js
    - mapa/xmap-layers-eletrica.js
    - mapa/index.html
    - mapa/app.js
  modified:
    - vercel.json
    - index.html
    - TESTES.md

key-decisions:
  - "Não foi criada migração nova para reimportar o CSV de VTR/EMB — o import já estava concluído e conferido em supabase/11_transportes_seed.sql (Fase 01, Plano 04); esta tarefa apenas documentou a consulta SQL de conferência em TESTES.md"
  - "Camada xmap-layers-grama.js perdeu o fetch para a API xCore de rede local (porta removida do código e dos comentários) e passou a servir só os dados mock já embutidos, evitando erro de conteúdo misto em produção HTTPS"
  - "--xm-sans/--xm-mono do xmap.css, que vinham de um assets/fonts.css inexistente no pmoc, foram redeclaradas com pilhas de fontes de sistema (Inter/ui-monospace) em vez de fontes externas via @import"

requirements-completed: [QUICK-260810-k0q]

coverage:
  - id: D1
    description: "Núcleo xMap portado para mapa/ com API pública preservada (init, setModules, toggleBasemap, registerLayer, updateElement, utils) e sem chamada a host de desenvolvimento"
    verification:
      - kind: unit
        ref: "node --check mapa/xmap.js && node --check mapa/xmap-layers-aguada.js && node --check mapa/xmap-layers-grama.js && node --check mapa/xmap-layers-eletrica.js"
        status: pass
      - kind: other
        ref: "grep -rq 8010 mapa/ (esperado: sem match)"
        status: pass
    human_judgment: false
  - id: D2
    description: "App /mapa com login por cargo (shared/auth.js), bootstrap de módulo ES (shared/supabase-config.js), Leaflet 1.9.4 fixado e mapa renderizando centrado no CMASM após autenticação"
    verification:
      - kind: unit
        ref: "node --input-type=module --check < mapa/app.js"
        status: pass
    human_judgment: true
    rationale: "Renderização visual do Leaflet (mapa centrado, altura do container, alternância de basemap e camadas) só é verificável abrindo o app num navegador servido por HTTP — registrado como checklist manual em TESTES.md."
  - id: D3
    description: "Rota /mapa no vercel.json preservando as seis rotas existentes, card Mapa no portal apontando para /mapa"
    verification:
      - kind: unit
        ref: "python3 -c \"import json; d=json.load(open('vercel.json')); assert [r['source'] for r in d['rewrites']] == ['/refrigeracao','/maquinas','/transportes','/eletrica','/fonoclama','/predial','/mapa']\""
        status: pass
      - kind: other
        ref: "grep -q 'href=\"/mapa\"' index.html"
        status: pass
    human_judgment: false
  - id: D4
    description: "Consulta SQL de conferência do import do CSV de VTR/EMB documentada em TESTES.md, referenciando 11_transportes_seed.sql, sem migração nova"
    verification:
      - kind: other
        ref: "grep -q '11_transportes_seed.sql' TESTES.md"
        status: pass
    human_judgment: true
    rationale: "A consulta em si precisa ser executada pelo usuário no SQL Editor do Supabase de produção para confirmar as contagens 9/23; o gate automatizado só confirma que a consulta e a referência ao seed estão documentadas."

duration: 55min
completed: 2026-08-10
status: complete
---

# Quick Task 260810-k0q Summary

**Módulo /mapa portado do legado cmms-mapa (Leaflet 1.9.4 + xMap) no padrão pmoc, com rota Vercel, card no portal e consulta SQL de conferência do import do CSV de VTR/EMB documentada em TESTES.md — sem reimportar dados.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-10T16:45:00Z (aprox.)
- **Completed:** 2026-08-10T17:40:00Z
- **Tasks:** 3
- **Files modified:** 10 (7 criados, 3 modificados)

## Accomplishments
- Núcleo xMap (`xmap.js`, `xmap.css`, três arquivos de camada) portado de `/home/luc/DEV_ERP/cmms-mapa` para `mapa/`, com a fonte legada intacta (nenhum arquivo com mtime alterado)
- App `/mapa` criado no padrão pmoc: login por cargo via `shared/auth.js`, descoberta de credenciais via `shared/supabase-config.js`, Leaflet 1.9.4 fixado, camadas marcadas como dados de demonstração
- `/mapa` roteado no `vercel.json` (rewrite) e no portal (`index.html`), preservando as seis rotas/módulos já em produção
- Checklist manual do módulo Mapa e consulta SQL de conferência do import do CSV de VTR/EMB (9 ativos / 23 viagens) adicionados a `TESTES.md`, sem criar migração nova

## Task Commits

Each task was committed atomically:

1. **Task 1: Portar o núcleo xMap para mapa/** - `a8eb91d` (feat)
2. **Task 2: Criar o app /mapa no padrão pmoc (login por cargo + shell)** - `5725302` (feat)
3. **Task 3: Rotear /mapa no Vercel e no portal + registrar a conferência do import** - `ca67507` (feat)

**Plan metadata:** pending (docs commit handled by orchestrator)

## Files Created/Modified
- `mapa/xmap.js` - Núcleo xMap portado, cabeçalho de origem/aviso de dados demo acrescentado
- `mapa/xmap.css` - `--xm-sans`/`--xm-mono` redeclaradas com fontes de sistema; cabeçalho de origem acrescentado
- `mapa/xmap-layers-aguada.js` - Camada de monitoramento hídrico (mock), cabeçalho de origem acrescentado
- `mapa/xmap-layers-grama.js` - Camada de controle vegetal; removida a chamada `fetch` para a API xCore de rede local, mantendo só os dados mock
- `mapa/xmap-layers-eletrica.js` - Camada de sistema elétrico (mock), cabeçalho de origem acrescentado
- `mapa/index.html` - Shell do módulo no padrão pmoc: paleta, topbar, login, sidebar de módulos, Leaflet 1.9.4 fixado, scripts do xMap em ordem antes do bootstrap `type="module"`
- `mapa/app.js` - ES module com `Auth`/`criarClienteSupabase`, `alternarModulo()`/`sair()` expostos em `window`, `xMap.init()` chamado só após `#app` ficar visível
- `vercel.json` - Rewrite `/mapa` acrescentado após `/predial`
- `index.html` (portal) - Card Mapa acrescentado ao grid de módulos em produção
- `TESTES.md` - Seção "Módulo Mapa (/mapa)" com checklist manual e seção "Conferência do import do CSV de VTR/EMB" com a consulta SQL

## Decisions Made
- Nenhuma migração SQL nova foi criada para reimportar o CSV de VTR/EMB — o achado registrado no `PLAN.md` confirmou que o import já estava concluído e conferido (`supabase/11_transportes_seed.sql`, Fase 01 Plano 04); esta tarefa só adicionou a consulta de conferência de produção em `TESTES.md`
- A camada `xmap-layers-grama.js` teve a chamada `fetch` para a API xCore de rede local (porta 8010) removida, sem citar o número da porta em comentários, deixando o módulo servir apenas os dados mock já embutidos — evita erro de conteúdo misto numa página HTTPS
- `--xm-sans`/`--xm-mono` em `xmap.css`, que dependiam de um `assets/fonts.css` inexistente no pmoc, foram redeclaradas com pilhas de fontes de sistema (`'Inter', system-ui, sans-serif` e `ui-monospace, 'JetBrains Mono', monospace`), sem nenhum `@import` de fonte externa
- `xMap.init()` só é chamado depois de `#app` ficar visível (`display:flex`), porque inicializar o Leaflet com o container ainda oculto (`display:none`) faz a medição de altura resultar em 0px

## Deviations from Plan

None - plan executed exactly as written. As adaptações descritas acima (remoção do fetch da API legada, redeclaração de `--xm-sans`/`--xm-mono`, cabeçalhos de origem, ordem de inicialização do mapa) já estavam especificadas explicitamente nas instruções de cada task do `PLAN.md`, não são desvios.

## Issues Encountered
Ao copiar `xmap.css`, o arquivo legado já continha declarações de `--xm-sans`/`--xm-mono` apontando para fontes externas (`'DM Sans'`, `'JetBrains Mono'`) mais abaixo no mesmo bloco `:root`; como CSS custom properties usam a última declaração dentro da mesma regra, as novas variáveis (fontes de sistema) inseridas no topo do bloco teriam sido silenciosamente sobrescritas pelas declarações originais. Corrigido removendo as duas linhas duplicadas originais, mantendo apenas a declaração nova. Verificado lendo o arquivo após a edição e confirmando `grep -q -- '--xm-sans' mapa/xmap.css` no gate automatizado.

## User Setup Required
None - no external service configuration required. A checklist manual de verificação visual (mapa renderizando, alternância de basemap, camadas por módulo) está documentada em `TESTES.md` e depende apenas de servir o repositório por HTTP (`python -m http.server`) e abrir `/mapa` no navegador.

## Next Phase Readiness
- `/mapa` está pronto para verificação humana (checklist em `TESTES.md`) e, após validado, para deploy via push em `luctronics-ET/pmoc`
- Alimentar as camadas com dados reais (por exemplo, posições de `transp_ativos`) fica fora do escopo desta tarefa e é um próximo passo natural, mas nenhuma tabela ou coluna nova foi criada — quando isso acontecer, o comentário de cabeçalho dos arquivos de camada já registra que `popupHTML` precisará escapar valores antes de interpolar (hoje aceito porque os dados são constantes locais)
- Nenhum bloqueio: os seis módulos em produção (`/transportes`, `/maquinas`, `/refrigeracao`, `/eletrica`, `/fonoclama`, `/predial`) continuam com suas rotas intactas no `vercel.json`

---
*Phase: quick-260810-k0q*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 11 created/modified files verified present on disk; all 3 task commits (`a8eb91d`, `5725302`, `ca67507`) verified present in git log.
