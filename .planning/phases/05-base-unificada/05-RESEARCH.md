# Phase 5: Base unificada - Research

**Researched:** 2026-08-10
**Domain:** Refatoração de frontend zero-build (vanilla JS + CSS compartilhado) sobre uma base de código já parcialmente convergente
**Confidence:** HIGH — pesquisa é 100% leitura do próprio repositório; toda afirmação abaixo cita `arquivo:linha`. Não houve necessidade de pesquisa web: a fase não introduz nenhuma biblioteca nova.

## Summary

Esta fase não parte do zero. Investigação linha a linha dos 6 módulos no escopo (`maquinas`, `transportes`, `eletrica`, `fonoclama`, `predial`, `mapa`) mostra que **3 dos 5 critérios de sucesso já estão total ou parcialmente satisfeitos** por trabalho feito fora do fluxo GSD em 09–10/08/2026, e que o esforço real da fase está concentrado quase inteiramente em **um único módulo: `maquinas`**.

Estado real por módulo, hoje:

| Módulo | PLAT-01 (`pmoc.css`) | PLAT-02 (`shared/auth.js`) | PLAT-03 (shell comum) |
|---|---|---|---|
| `eletrica` | ✅ já carrega `../shared/pmoc.css` (`eletrica/index.html:9`) | ✅ via `shared/modulo-manutencao.js` (`shared/modulo-manutencao.js:14,1139`) | ⚠️ shell existe mas está *dentro* do motor (`montarLayout()`, `shared/modulo-manutencao.js:225-266`), não em `shared/` isolado |
| `fonoclama` | ✅ idêntico a elétrica | ✅ idêntico a elétrica | ⚠️ idêntico a elétrica |
| `predial` | ✅ já carrega `../shared/pmoc.css` (`predial/index.html:9`), zero CSS extra além de `--accent` | ✅ `import { Auth } from '../shared/auth.js'` (`predial/app.js:5`) | ❌ topbar/nav escritos à mão em `predial/index.html:16-32` |
| `mapa` | ❌ `<style>` inline duplica os tokens (`mapa/index.html:12-44`) | ✅ `import { Auth } from '../shared/auth.js'` (`mapa/app.js:1,110`) | ❌ topbar escrita à mão (`mapa/index.html:50-56`); layout é sidebar, não abas |
| `transportes` | ❌ `<style>` inline duplica os tokens, renomeando `--accent`→`--cyan` (`transportes/index.html:9-99`) | ✅ `import { Auth } from '../shared/auth.js'` (`transportes/app.js:1,1520`) | ❌ topbar/nav escritos à mão (`transportes/index.html:104-121`) |
| `maquinas` | ❌ `<style>` inline duplica os tokens, sem `--accent` (`maquinas/index.html:9-188`) | ❌ **fluxo de login inline duplicado**, 168 linhas (`maquinas/app.js:895-1070`) | ❌ topbar/nav escritos à mão (`maquinas/index.html:196-215`) |

`maquinas` é o único módulo que falha nos três critérios simultaneamente, e é também o único carregado como `<script>` clássico (não `type="module"`) — o que introduz um risco técnico específico e não-óbvio (ver Pitfall 1) que não existe em nenhum dos outros 5 módulos.

**Primary recommendation:** Extraia o gerador de shell já existente e comprovado em `shared/modulo-manutencao.js:225-266` (`montarLayout()`) para um novo módulo `shared/shell.js` exportando uma função que injeta HTML via template literal (não custom element, não convenção de classes — ver Pattern 3). Faça o motor de manutenção consumir esse novo arquivo primeiro (risco zero, sem tocar `eletrica`/`fonoclama`), depois adote em `predial` → `mapa` → `transportes` → e só por último em `maquinas`, que concentra os três riscos (CSS + auth + carregamento como script clássico) e deve ser tratado em sua própria wave, depois que o padrão já estiver provado nos outros cinco.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tokens visuais (cor/tipografia/espaçamento) | Browser / Client (CSS estático) | — | `shared/pmoc.css` é um arquivo CSS servido estático pelo Vercel; não há SSR nem build |
| Shell de layout (topbar/nav/rodapé) | Browser / Client (JS que injeta HTML) | — | Gerado em runtime no navegador via `innerHTML` de template literal, como já prova `shared/modulo-manutencao.js:229-257`; zero-build impede geração em build-time |
| Autenticação por cargo | Browser / Client (UI de login) + API/Backend (Supabase Auth) | Database (RLS) | `shared/auth.js` só monta a UI e chama `supa.auth.signInWithPassword`; a autorização real é RLS no Postgres (`CLAUDE.md` "Auth & security") — nenhuma mudança nesta fase toca RLS |
| Visões de domínio (painel, ativos, OS, planos, estoque) | Browser / Client | API/Backend (Supabase queries) | Não mudam nesta fase — cada módulo mantém suas próprias `render*()` e `carregarTudo()`; a fase só toca chrome (topbar/nav/tokens/login), não o conteúdo `.main` |
| Verificação de não regressão | Browser / Client (smoke visual) | — | Sem servidor de aplicação para testar; verificação é abrir as 7 rotas do `vercel.json` e rodar `node --test` (ver seção Common Pitfalls / verificação) |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | Os 6 módulos carregam `shared/pmoc.css` como fonte única de tokens — nenhum define paleta própria | Ver tabela de estado real acima e seção "Divergência de tokens" — 3/6 módulos já conformes, 3/6 (`maquinas`, `transportes`, `mapa`) precisam de migração de `<style>` inline para `<link>` + rename de classes de marca |
| PLAT-02 | Os 6 módulos usam `shared/auth.js`; `maquinas/app.js` deixa de duplicar o fluxo inline | Ver Pattern 2 (migração de `maquinas`) — 5/6 módulos já usam `Auth`; só `maquinas/app.js:895-1070` duplica |
| PLAT-03 | Existe shell de layout comum (cabeçalho, navegação por abas, rodapé) reutilizado pelos módulos | Ver Pattern 3 — protótipo já existe e funciona em produção dentro de `shared/modulo-manutencao.js:225-266`; falta extrair e generalizar |
| PLAT-15 | `refrigeracao` continua idêntico — não carrega `pmoc.css` nem o shell | Verificado: `grep -n "shared/\|pmoc.css" refrigeracao/index.html` não retorna nada (arquivo não referencia `shared/` de forma alguma) |
| PLAT-16 | Nenhum módulo perde funcionalidade — testes em `tests/` continuam passando | `node --test` (raiz do repo) roda os 19 testes hoje existentes e todos passam (baseline confirmado nesta pesquisa, 2026-08-10) — ver seção Common Pitfalls, item de verificação |
</phase_requirements>

## Standard Stack

Esta fase **não introduz nenhuma biblioteca nova**. O padrão já em uso é o próprio padrão do repositório:

### Core (já em uso, sem mudança)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | v2 (UMD via jsDelivr CDN) | Cliente Postgres/Auth/RLS | Já é o padrão do repo (`CLAUDE.md`); nenhum módulo usa outra coisa |
| ES Modules nativos do navegador | — | `import`/`export` entre arquivos `shared/*.js` | Já em uso por `predial`, `mapa`, `transportes`, `eletrica`, `fonoclama`; zero-build torna módulos ES a única forma de reuso de código sem duplicar texto |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Função JS que injeta shell via template literal | Web Component (`customElements.define`) | Mais "correto" architecturalmente, mas exige repensar como `onclick="fn()"` inline chama funções globais em todos os 6 módulos ao mesmo tempo — risco desnecessário para uma fase que já tem risco concentrado em `maquinas`. Nenhum módulo do repo usa Shadow DOM ou custom elements hoje — introduzir o padrão阵 nesta fase quebraria a convenção estabelecida em `CLAUDE.md` ("Modais drive todo CRUD; inline onclick=... handlers são a norma") |
| Função JS que injeta shell via template literal | Só convenção de classes CSS (sem JS) | Não atinge o critério de sucesso #3 do roadmap ("mudar o shell muda os 6 módulos de uma vez") — CSS sozinho não pode adicionar/remover um botão de navegação ou o link "← Portal" nos 6 módulos a partir de um único ponto |

**Instalação:** nenhuma — todos os arquivos já estão em `shared/` ou serão adicionados lá como `.js`/`.css` puro, sem `npm install`.

## Package Legitimacy Audit

**Não aplicável.** Esta fase não instala nenhum pacote externo (zero-build, sem `package.json`, sem `npm`/`pip`/`cargo`). Nenhuma nova dependência de CDN é introduzida — `@supabase/supabase-js` já está em uso em todos os módulos e não muda de versão nesta fase.

## Architecture Patterns

### System Architecture Diagram

```text
┌─────────────────────────────── Vercel (static) ───────────────────────────────┐
│ vercel.json rewrites (inalterado nesta fase, todas as 7 rotas continuam):     │
│  /refrigeracao /maquinas /transportes /eletrica /fonoclama /predial /mapa    │
└───────┬──────────┬───────────┬───────────┬───────────┬───────────┬───────────┘
        │          │           │           │           │           │
   refrigeracao  maquinas  transportes  eletrica   fonoclama    predial / mapa
   (CONGELADO —  (script    (type=       (via motor  (via motor  (type=module,
    fora desta    clássico,  module,      comum)      comum)      já usa Auth)
    fase)         auth       usa Auth)
                  inline)
        │             │           │           │            │            │
        │             │           └───────────┴────────────┘            │
        │             │           shared/modulo-manutencao.js            │
        │             │           (iniciarModulo → montarLayout          │
        │             │            + Auth + criarClienteSupabase)        │
        │             │                       │                          │
        │             └───────────┬───────────┴──────────────────────────┘
        │                         ▼
        │              ┌──────────────────────────────┐
        │              │   shared/  (esta fase adiciona│
        │              │   shared/shell.js aqui)        │
        │              │  auth.js · pmoc.css · shell.js │
        │              │  supabase-config.js            │
        │              │  persistencia.js · arvore.js   │
        │              │  vencimento.js                 │
        │              └──────────────┬─────────────────┘
        │                             ▼
        │                Supabase JS SDK (CDN v2) → PostgreSQL (RLS)
        ▼
   (nenhuma seta sai de refrigeracao para shared/ — PLAT-15)
```

### Recommended Project Structure

Nenhum diretório novo é criado; um único arquivo novo entra em `shared/`:

```
shared/
├── auth.js                 # já existe, sem mudança de API
├── supabase-config.js      # já existe, sem mudança
├── persistencia.js         # já existe, sem mudança
├── arvore.js                # já existe, sem mudança
├── vencimento.js            # já existe, sem mudança
├── modulo-manutencao.js     # muda: monta layout via shared/shell.js em vez de string local
├── pmoc.css                 # cresce de forma aditiva (ver Pattern 1) — nenhuma remoção
└── shell.js                 # NOVO — extraído de modulo-manutencao.js:225-266
```

### Pattern 1: Extensão aditiva de `shared/pmoc.css` (nunca remoção)

**What:** Antes de apagar o `<style>` inline de `maquinas`/`transportes`/`mapa`, primeiro comparar token a token com `shared/pmoc.css:8-13` (que hoje define **13 custom properties**: `--bg --surface --surface2 --border --text --text2 --text3 --green --yellow --red --blue --accent --ff` — não "61 variáveis", número que não corresponde ao arquivo real lido nesta pesquisa) e adicionar ao `pmoc.css` qualquer token que for genuinamente novo, em vez de forçá-lo a virar `--accent`.

**When to use:** Sempre que um módulo tiver uma cor/token que não é "a cor de destaque do módulo" (que já tem solução via `--accent`, ver Pattern 2) mas é uma cor semântica nova.

**Exemplo real encontrado:** `maquinas/index.html:15,52` define `--orange:#c07840` e a classe `.kpi.kc-gold{border-left:3px solid var(--orange)}`, usada em `maquinas/app.js:464` para destacar o KPI "L/h médio da frota". Isso **não é** duplicação do accent — é um token semântico legítimo que `pmoc.css` ainda não tem. Recomendação: adicionar `--orange` e `.kc-gold`/`.b-gold` a `shared/pmoc.css` de forma aditiva (mesmo padrão das linhas 44-46 do arquivo, que já têm `.kc-blue .kc-ok .kc-warn .kc-red .kc-accent`), disponibilizando o token para os 6 módulos, não só para `maquinas`.

**Anti-pattern a evitar:** não copiar o `<style>` inteiro de `maquinas/index.html:9-188` para dentro de `pmoc.css`. Comparação classe a classe (feita nesta pesquisa) mostra que a maioria das ~40 classes exclusivas de `maquinas` (`.kanban-*`, `.calendar-*`, `.op-*`, `.compra-*`, `.uso-bar*`, `.venc-*`) são **componentes específicos do módulo** (kanban/agenda/lista de compras), não tokens — devem continuar em um `<style>` local de `maquinas/index.html`, carregado *depois* do `<link href="../shared/pmoc.css">`, referenciando os tokens via `var(--...)` em vez de hex fixo. A extração desses componentes para `shared/` é trabalho da **Fase 8** (Kanban e calendário compartilhados), fora do escopo desta fase.

### Pattern 2: Migrar `maquinas` para `shared/auth.js` sem mudar o que o usuário vê

**What:** `maquinas/app.js:895-1070` duplica inline o fluxo completo que `shared/auth.js` já resolve — incluindo o array `CARGOS` (`maquinas/app.js:895-900`, idêntico a `CARGOS_PADRAO` em `shared/auth.js:23-28`, mesmos 4 cargos/e-mails/roles) e o acesso "Livre" sem senha (`maquinas/app.js:1004-1013` vs. `shared/auth.js:210-217` — comportamento idêntico: monta `USUARIO = { role:'observador', nome:'Visitante', ... }` direto, sem chamar Supabase Auth).

**Diferenças de comportamento encontradas (que a migração deve preservar ou justificar):**

| Aspecto | `maquinas/app.js` (hoje) | `shared/auth.js` (destino) | Ação |
|---|---|---|---|
| `funcao` do observador "Livre" | `{ role:'observador', nome:'Visitante', funcao:'Livre', cargo:'Livre' }` (`maquinas/app.js:1007`) | `{ role:'observador', nome:'Visitante', cargo:'Livre' }` — **sem campo `funcao`** (`shared/auth.js:213`) | `carregarUsuario`/`user-chip` de `maquinas` lê `USUARIO.funcao \|\| USUARIO.posto_graduacao \|\| USUARIO.nome` (`maquinas/app.js:35`) — sem `funcao`, cai para `nome` ("Visitante"), texto do chip muda de "Livre · observador" para "Visitante · observador". Verificar com o usuário se é aceitável ou se `shared/auth.js` precisa ganhar o campo `funcao:'Livre'` também (mudança aditiva seria: em `_selecionarCargo`, incluir `funcao: cargo.label`) |
| `sair()` | `async function sair(){ await supa.auth.signOut() }` (`maquinas/app.js:42`) — não recarrega a página | `auth.sair()` só faz `signOut()` (`shared/auth.js:46-49`) — quem decide recarregar é o app | Nos módulos que já usam `Auth` (`transportes`, `predial`, `mapa`), o padrão é `sair(){ await auth?.sair(); window.location.reload() }` (ex.: `mapa/app.js:77-83`). `maquinas` deve adotar o mesmo padrão — comportamento visível muda ligeiramente (reload em vez de ficar na tela), mas é o padrão já estabelecido nos outros 5 módulos, não uma regressão |
| Fluxo de e-mail (admin) | Passo 3 próprio (`step-email`), idêntico em estrutura a `shared/auth.js:128-157` | Mesmo fluxo, já pronto | Sem diferença de comportamento — só remove duplicação |
| Carregamento do módulo `auth.js` | Não é importado — HTML inteiro reescrito inline (`maquinas/app.js:908-978`) | `import { Auth } from '../shared/auth.js'` | Ver Pitfall 1 — exige mudar `<script src="/maquinas/app.js">` para `type="module"` |

**Recomendação de migração:** seguir exatamente o `boot()` já provado em `transportes/app.js:1509-1529`, `predial/app.js` (padrão equivalente) e `mapa/app.js:100-119`:
```javascript
// Source: transportes/app.js:1509-1529 (padrão já em produção)
async function boot(){
  exporNoWindow()
  try { supa = await criarClienteSupabase() }
  catch (error) { mostrarErroBoot(error); return }

  auth = new Auth(supa, { appNome: 'Máquinas', appIcone: '⚙️' })
  auth.onLogin(usuario => { USUARIO = usuario; mostrarApp() })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}
```
Isso elimina de uma vez: o array `CARGOS` duplicado, as 4 funções de login inline (`loginCargo`, `loginEmail`, `mostrarStepEmail`, `voltarCargos`), e as 5 regras de CSS mortas `.login-card/.login-logo/.login-sub/.login-err/.login-toggle` (`maquinas/index.html:137-143`) — confirmado por busca: nenhuma dessas 5 classes é referenciada em nenhum lugar de `maquinas/app.js` (o login atual usa `style=` inline, não essas classes).

### Pattern 3: `shared/shell.js` — função que injeta HTML via template literal

**What:** Extrair `montarLayout()` de `shared/modulo-manutencao.js:225-266` para `shared/shell.js`, generalizando a lista de itens de navegação (hoje fixa em `montarLayout` para os 6 itens do motor de manutenção) em um parâmetro:

```javascript
// Padrão a generalizar — hoje vive em shared/modulo-manutencao.js:225-257
export function montarShell({ nome, icone, accent, navItems, portalLink = true }) {
  document.title = `PMOC ${nome}`
  document.documentElement.style.setProperty('--accent', accent)
  return `
    <div class="topbar">
      <div class="logo"><div class="logo-dot"></div> PMOC <span class="logo-accent">${esc(nome)}</span></div>
      <div class="topbar-right">
        ${portalLink ? '<a class="topbar-back" href="/">← Portal</a>' : ''}
        <span class="user-chip" id="user-chip">—</span>
        <button class="btn btn-s btn-sm" onclick="sair()">Sair</button>
      </div>
    </div>
    <div class="nav">
      ${navItems.map(item => `<button class="nav-btn${item.ativo ? ' active' : ''}" onclick="trocarView('${item.id}',this)">${item.icone} ${esc(item.label)}</button>`).join('')}
    </div>
    <footer class="shell-footer">PMOC · CMASM</footer>
  `
}
```

**Por que este formato e não os outros dois:** avaliação concreta das 3 opções citadas no escopo da pesquisa:
1. **Função que injeta HTML via template literal (recomendada):** já é exatamente o que `montarLayout()` faz hoje em produção (`shared/modulo-manutencao.js:225-266`), rodando sem build. Zero mudança de paradigma — só move o texto de um arquivo para outro e parametriza os itens de nav.
2. **Custom element (`customElements.define`):** tecnicamente viável (navegadores modernos, sem build), mas nenhum módulo do repo usa Shadow DOM hoje; misturar Shadow DOM com o padrão `onclick="fn()"` que popula `window` (`exporNoWindow()`) criaria dois modelos de encapsulamento simultâneos na mesma fase que já mexe em `maquinas` — risco desnecessário.
3. **Só convenção de classes CSS:** não resolve o critério de sucesso #3 do roadmap ("mudar o shell muda os 6 módulos de uma vez") — uma convenção de classes não centraliza a *estrutura* HTML (quantidade de itens de nav, presença do link "← Portal", texto do rodapé), só o estilo.

**Nó a resolver — `rodapé`:** nenhum dos 6 módulos tem hoje um `<footer>` de página (confirmado por busca — os únicos "rodapé" existentes no código são o `.modal-ft` de cada modal, que é um conceito diferente e já unificado via `pmoc.css:107`). O critério de sucesso #3 da fase ("cabeçalho, navegação por abas **e rodapé**") exige introduzir algo que não existe hoje. Ver Open Questions #1.

**Módulos com padrão de nav diferente:** `mapa/index.html:58-73` não usa `.nav`/`.nav-btn` — usa uma sidebar de módulos (`.sidebar`, `.mod-btn`), porque não tem "abas" no sentido dos outros módulos (painel/ativos/OS/…), e sim camadas de mapa que se ligam/desligam. `montarShell()` deve aceitar `navItems: []` (vazio) para este caso e ainda assim renderizar topbar + rodapé — não forçar `mapa` a ganhar abas que não fazem sentido no domínio dele.

### Anti-Patterns to Avoid

- **Reescrever o HTML de `.main` de qualquer módulo nesta fase:** o escopo (PLAT-01/02/03) é chrome (tokens, login, topbar/nav/rodapé) — as views de domínio (`view-painel`, `view-ativos`, `view-os`, `view-planos`, `view-estoque`, kanban, agenda, árvore de locais, etc.) não são tocadas. Misturar refatoração de shell com refatoração de conteúdo aumenta o raio de regressão sem necessidade.
- **Migrar `maquinas` primeiro:** é o módulo com maior risco combinado (único script clássico + único com auth duplicado + maior arquivo). Migrá-lo primeiro significa descobrir os três problemas ao mesmo tempo, sem um padrão já provado para comparar.
- **Forçar toda cor de módulo a virar `--accent`:** como mostrado no Pattern 1, `--orange`/`.kc-gold` de `maquinas` não é uma duplicata de `--accent` — é um token semântico próprio que falta em `pmoc.css`. Confundir os dois casos (rebranding de marca vs. token semântico novo) leva a perda de informação visual real (o KPI de rendimento de combustível deixaria de se distinguir do accent do módulo).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Login por cargo com senha, acesso "Livre" sem senha, e-mails ocultos do usuário | Novo componente de login para `maquinas` | `shared/auth.js` (`Auth` class), já provado em 5 módulos | `shared/auth.js:1-292` já resolve exatamente este problema, incluindo o caso "Livre" (`shared/auth.js:210-217`) e ocultação de e-mail (docstring `shared/auth.js:2`) |
| Topbar + navegação por abas | Marcação HTML duplicada por módulo | `shared/shell.js` (a extrair de `shared/modulo-manutencao.js:225-266`) | O padrão já existe, já roda em produção em `eletrica`/`fonoclama`, só não está isolado em arquivo próprio |
| Cliente Supabase + descoberta de URL/key | Hardcode de `SUPA_URL`/`SUPA_KEY` por módulo (como `maquinas/app.js:3-4` e `transportes` faziam antes) | `shared/supabase-config.js` (`criarClienteSupabase()`) | Já resolvido para 4/6 módulos; só falta em `maquinas` (que ainda hardcoda linhas 3-4) — mudar para `criarClienteSupabase()` remove a chave duplicada de mais um arquivo |
| Confirmação de que uma escrita realmente afetou linhas (RLS bloqueia silenciosamente com HTTP 200) | `if(error){ alert(...) }` sem checar `data.length` | `shared/persistencia.js` (`gravar()`) | `shared/persistencia.js:1-7` documenta exatamente esse problema do PostgREST; `maquinas/app.js` hoje **não usa** esse helper (grep confirma zero import) — oportunidade de correção lateral, mas fora do escopo estrito de PLAT-01/02/03; citar como achado, não como tarefa obrigatória desta fase |
| Árvore de locais indentada e colapsável | Reimplementar `montarArvore`/`linhasVisiveis` | `shared/arvore.js` | Já compartilhado por `predial/dominio.js:19-21` e por `shared/modulo-manutencao.js:16,214` — não há necessidade de tocar aqui nesta fase |

**Key insight:** o repositório já tem 80% da "base unificada" pronta e rodando em produção — construída de forma orgânica em 09–10/08/2026 ao portar `predial`/`mapa`/`eletrica`/`fonoclama`. O trabalho real desta fase é (1) extrair o que já existe de dentro de `modulo-manutencao.js` para um arquivo `shared/` independente, (2) aplicar esse padrão já provado aos 2 módulos que faltam adotá-lo (`transportes`, `mapa` — CSS; nenhum dos dois falta em auth), e (3) fazer o mesmo trabalho completo (CSS + auth + shell) em `maquinas`, que é o único atrasado nos três eixos.

## Runtime State Inventory

> Incluído porque a fase envolve refatoração de código de produção (renomeação de classes CSS, migração de fluxo de auth). Nenhuma das 5 categorias encontrou item — documentado explicitamente por categoria, conforme exigido.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Nenhum.** As mudanças desta fase são só de front-end (CSS/JS estático). Nenhuma tabela, coluna, RLS policy ou nome de linha no Postgres é renomeado. Verificado: `grep -rln "cyan\|kc-gold\|CARGOS\|login-card" supabase/` não retorna nenhum arquivo | Nenhuma |
| Live service config | **Nenhum.** Não há serviço externo (n8n, Datadog, Tailscale, Cloudflare Tunnel) no stack deste projeto | Nenhuma |
| OS-registered state | **Nenhum.** Projeto é site estático servido por Vercel; não há processo local, task scheduler, nem serviço systemd/pm2/launchd envolvido | Nenhuma |
| Secrets/env vars | **Nenhum.** `SUPA_URL`/`SUPA_KEY` são a mesma chave `anon` pública já hardcoded em `maquinas/app.js:3-4`; migrar `maquinas` para `criarClienteSupabase()` (`shared/supabase-config.js`) não muda a chave, só a forma de descobri-la (lê de `maquinas/app.js` ou `refrigeracao/index.html` via regex, `shared/supabase-config.js:18-21`) — como `maquinas/app.js` continua existindo e continua tendo essas duas constantes por enquanto (ver Open Questions #2), a descoberta automática continua funcionando | Nenhuma — mas ver Open Questions #2 sobre não remover as constantes de `maquinas/app.js` prematuramente |
| Build artifacts / pacotes instalados | **Nenhum.** Sem `npm`, sem `package.json`, sem artefato de build a invalidar | Nenhuma |

**A pergunta canônica** ("depois de todo arquivo do repo atualizado, o que ainda tem o nome antigo em cache/armazenado/registrado?") tem resposta objetiva aqui: nada, porque a fase é puramente estrutural em arquivos servidos estáticos, sem nenhum sistema de runtime externo ao próprio navegador.

## Common Pitfalls

### Pitfall 1: `maquinas/app.js` é `<script>` clássico, não `type="module"` — migrar para `Auth` quebra silenciosamente até 27 handlers `onclick`

**What goes wrong:** `maquinas/index.html:649` carrega `app.js` como `<script src="/maquinas/app.js"></script>` **sem `type="module"`**. Isso significa que toda `function foo(){}` declarada no top-level do arquivo hoje vira automaticamente `window.foo`, o que é exatamente por que `onclick="abrirModalAtivo(${a.id})"` funciona em template literals e em HTML estático (`maquinas/index.html` tem 19 nomes de função distintos usados assim, e `maquinas/app.js` tem mais 10 gerados dinamicamente em template literals — **27 nomes distintos no total**, confirmado por busca). `import { Auth } from '../shared/auth.js'` só pode ser usado dentro de um módulo ES (`<script type="module">`), como fazem `transportes`, `predial`, `mapa`, `eletrica`, `fonoclama` hoje. Trocar só a linha do `<script>` para `type="module"` faz **todas** as 27 funções pararem de existir em `window`, e cada botão vira um `Uncaught ReferenceError` só percebido quando alguém clica naquele botão específico — não há erro de carregamento, o app "abre" normalmente e parece funcionar até o primeiro clique.

**Why it happens:** módulos ES têm escopo de módulo, não escopo global — diferença fundamental de scripts clássicos que os outros 5 módulos do repo já contornam com um bloco explícito `exporNoWindow()`/`Object.assign(window, {...})` (padrão em `shared/modulo-manutencao.js:1105-1113`, replicado em `transportes/app.js` e `predial/app.js`).

**How to avoid:** ao mudar `maquinas/index.html:649` para `<script type="module" src="/maquinas/app.js"></script>`, adicionar ao final de `maquinas/app.js` um bloco `exporNoWindow()` explícito com os ~23 nomes que sobrevivem à remoção do login inline (todos os 27 exceto `loginCargo`, `loginEmail`, `mostrarStepEmail`, `voltarCargos`, que são deletados junto com o IIFE de auth). Usar o mesmo padrão de `Object.assign(window, {...})` já em produção em `shared/modulo-manutencao.js:1105-1113`.

**Warning signs:** durante verificação manual, clicar em **cada** botão de cada view (não só nas mais usadas) — o painel, por exemplo, não expõe todos os 27 nomes; é preciso ir a Ativos, OS, Materiais, Operações e Agenda para exercitar todos.

### Pitfall 2: renomear classe CSS sem atualizar os 3 lugares que a usam (definição, HTML estático, template literal em JS)

**What goes wrong:** `transportes` usa `--cyan`/`.kc-cyan`/`.b-cyan` em 3 arquivos diferentes: a definição (`transportes/index.html:14,22,29,40,...`, 13 ocorrências), o HTML estático dos KPIs (`transportes/index.html:129,132,313`), e um `.b-cyan` gerado dinamicamente em `transportes/app.js:45`. Trocar só a definição de token e esquecer o `app.js:45` deixa uma classe CSS órfã (`.b-cyan` sem `background`/`color` definidos em `pmoc.css`, que só tem `.b-accent`) — o badge fica sem cor, sem erro no console.

**Why it happens:** CSS de "marca do módulo" está espalhado entre `<style>` (definição de token + regra), HTML estático (uso da classe) e JS (geração dinâmica da mesma classe) — três lugares, fácil esquecer um.

**How to avoid:** antes de remover qualquer `<style>` inline, rodar a mesma busca feita nesta pesquisa por módulo:
```bash
grep -rno "kc-cyan\|b-cyan\|--cyan" transportes/*.js transportes/*.html
```
e só remover a definição depois de confirmar que todo uso foi trocado para o nome de classe equivalente já existente em `pmoc.css` (`.kc-accent`, `.b-accent`).

### Pitfall 3: confundir "cor de destaque do módulo" com "token semântico novo"

**What goes wrong:** ver Pattern 1 — forçar `--orange`/`.kc-gold` de `maquinas` a virar `--accent` faria o KPI "L/h médio da frota" (`maquinas/app.js:464`) ficar da mesma cor do accent do módulo, perdendo a distinção visual que o app legado tinha entre "cor de marca" e "cor de destaque numérico".

**How to avoid:** para cada cor não-padrão encontrada em um módulo, perguntar: "isso muda se o módulo trocar de accent?" Se sim, é `--accent`. Se não (é uma cor fixa de significado, como "atenção"/"sucesso"/"informação especial"), é candidato a token aditivo novo em `pmoc.css`.

### Pitfall 4: verificar `refrigeracao` "por engano" ao testar os outros módulos

**What goes wrong:** como as 7 rotas do `vercel.json` continuam ativas durante toda a fase, é fácil, ao testar `/maquinas` ou `/transportes` no navegador, deixar `/refrigeracao` aberta em outra aba e presumir que "está tudo igual" sem checar de fato. PLAT-15 exige confirmação explícita, não presunção.

**How to avoid:** verificação de não-regressão de PLAT-15 deve ser um passo isolado e explícito: abrir `/refrigeracao` **depois** de toda a fase concluída, com DevTools aberto, e confirmar (a) zero requisição de rede para `pmoc.css` ou qualquer arquivo em `/shared/`, e (b) zero erro no console. `grep -n "shared/\|pmoc.css" refrigeracao/index.html` (deve retornar vazio) é uma checagem estática complementar, rápida de rodar a cada commit desta fase.

### Verificação de não regressão sem testes de UI (item 7 da pesquisa solicitada)

Duas camadas, ambas executáveis por comando, sem depender só de inspeção visual:

1. **Regra de negócio (automatizado, já existe):** `node --test` na raiz do repositório roda os 19 testes existentes (`tests/*.test.js`) sem precisar de argumento — Node descobre os arquivos automaticamente. Executado nesta pesquisa como baseline: **19/19 passando** em 2026-08-10, cobrindo `shared/vencimento.js`, `predial/dominio.js` (que reexporta `shared/arvore.js`), e o motor de operações de `maquinas` (`maquinas/operacoes.js`, testado via `tests/operacoes-maquinas.test.js`, `tests/schema-operacoes-maquinas.test.js`, `tests/integracao-operacoes-maquinas.test.js`). Rodar antes e depois de cada wave da fase — regressão em lógica pura (não visual) fica imediatamente visível.
2. **Chrome visual (semi-automatizado, recomendado para esta fase):** como não há Playwright configurado no projeto, mas a skill `webapp-testing` está disponível neste ambiente, o executor da fase pode usar `python -m http.server` (raiz do repo) + a skill para abrir cada uma das 7 rotas antes de tocar em qualquer arquivo, tirar screenshot ("antes"), e comparar com o "depois" ao final da fase — cobre exatamente o que `node --test` não cobre (layout do shell, botões clicáveis, ausência de erro de console). Isso é opcional/recomendado, não uma dependência nova do projeto (nenhuma mudança em `CLAUDE.md`, que continua dizendo "Testing: manual only").
3. **Checklist manual em `TESTES.md`:** seguir a convenção já usada nas seções anteriores do arquivo (ex.: linhas de `Predial — implementação 09/08/2026`) — adicionar uma seção `## Base unificada — Fase 5` com os mesmos passos: abrir cada rota, logar por cada cargo, conferir que "Livre" continua sem senha, conferir que `observador` continua sem botões de escrita.

## Code Examples

### Padrão de boot já provado (para `maquinas` seguir)
```javascript
// Source: transportes/app.js:1509-1529 (em produção)
async function boot() {
  exporNoWindow()
  try {
    supa = await criarClienteSupabase()
  } catch (error) {
    mostrarErroBoot(error)
    return
  }
  auth = new Auth(supa, { appNome: 'Transportes', appIcone: '🚚' })
  auth.onLogin(usuario => { USUARIO = usuario; mostrarApp() })
  auth.mount('#login-screen')
  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}
```

### Padrão de shell já provado (a extrair)
```javascript
// Source: shared/modulo-manutencao.js:225-266 (em produção, dentro do motor)
function montarLayout() {
  document.title = `PMOC ${CFG.nome}`
  document.documentElement.style.setProperty('--accent', CFG.accent)
  el('app').innerHTML = `
    <div class="topbar">
      <div class="logo"><div class="logo-dot"></div> PMOC <span class="logo-accent">${esc(CFG.nome)}</span></div>
      <div class="topbar-right">
        <a class="topbar-back" href="/">← Portal</a>
        <span class="user-chip" id="user-chip">—</span>
        <button class="btn btn-s btn-sm" onclick="sair()">Sair</button>
      </div>
    </div>
    <div class="nav">...</div>
    <div class="main">...</div>
  `
}
```

### Padrão de exposição de funções para `onclick` em módulo ES (`maquinas` precisa adotar)
```javascript
// Source: shared/modulo-manutencao.js:1105-1113 (em produção)
function exporNoWindow() {
  Object.assign(window, {
    abrirModalAtivo, abrirModalMaterial, abrirModalMovimento, abrirModalOS,
    abrirModalPlano, abrirModalUso, concluirOS, exportarComprasCsv,
    exportarVencimentosCsv, fecharModal, mostrarPecasDoPlano, popularPlanosOS,
    sair, salvarAtivo, salvarMaterial, salvarMovimento, salvarOS, salvarPlano,
    salvarUso, trocarView,
  })
}
```

## State of the Art

| Old Approach (ainda em `maquinas`) | Current Approach (já em 5/6 módulos) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Login inline duplicado por módulo, cargos hardcoded no próprio `app.js` | `import { Auth } from 'shared/auth.js'`, cargos padronizados em `CARGOS_PADRAO` | 09/08/2026 (introdução de `predial`/`mapa`) | Um único lugar para corrigir bugs de auth; `maquinas` é o último a migrar |
| CSS de tokens duplicado em `<style>` inline por módulo | `<link rel="stylesheet" href="../shared/pmoc.css">` + override de `--accent` | 09-10/08/2026 (`eletrica`, `fonoclama`, `predial`) | Trocar uma cor global passa a exigir editar 1 arquivo, não 6 |
| Cada módulo de manutenção por horímetro reimplementa CRUD/views | `shared/modulo-manutencao.js` — módulo vira um arquivo de config de ~20 linhas | 09/08/2026 (decisão registrada em `STATE.md` "Revisto em 09/08/2026") | `eletrica`/`fonoclama` têm ~700 linhas de lógica cada evitadas, mas essa engine ainda não é usada por `maquinas`/`transportes` (schemas diferentes o bastante para não caber no motor — fora do escopo desta fase) |

**Deprecated/outdated:**
- Hardcode de `SUPA_URL`/`SUPA_KEY` por módulo: só `maquinas/app.js:3-4` ainda faz isso; os outros 5 usam `criarClienteSupabase()` (`shared/supabase-config.js`), que descobre a config lendo `maquinas/app.js` ou `refrigeracao/index.html` via regex — ou seja, mesmo depois desta fase, **uma cópia hardcoded precisa continuar existindo em algum lugar do repo** para `criarClienteSupabase()` funcionar (ver Open Questions #2).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O texto "rodapé" no critério de sucesso #3 do roadmap se refere a um `<footer>` de página simples (ex.: "PMOC · CMASM"), não a um componente com funcionalidade — já que nenhum módulo tem footer hoje e o roadmap não detalha o conteúdo | Pattern 3 / Open Questions #1 | Se o usuário esperava algo mais elaborado (links, versão do app, contato), a implementação mínima proposta ficaria abaixo da expectativa; baixo risco técnico, mas vale confirmar em `/gsd-discuss-phase` antes de planejar |
| A2 | É aceitável que o "Livre"/observador de `maquinas` passe a exibir "Visitante · observador" em vez de "Livre · observador" no `user-chip`, como consequência de usar `shared/auth.js` sem o campo `funcao` extra que `maquinas/app.js:1007` tem hoje | Pattern 2 | Se o usuário considerar isso uma regressão de UX perceptível, a correção é simples (adicionar `funcao: cargo.label` em `shared/auth.js:213`), mas muda o comportamento dos outros 5 módulos que já usam essa classe — precisa decisão consciente, não silenciosa |
| A3 | O valor de `--accent` que `maquinas` deve adotar ao migrar para `pmoc.css` é `#5a9e6f` (mesmo valor hoje usado como `--green` para o `.logo-dot`, `maquinas/index.html:12,28`), preservando a cor visual atual do logo sem mudar nada visualmente | Pattern 1 / Common Pitfalls #3 | Se o usuário na verdade queria uma cor de destaque diferente para `maquinas` (como as outras 5 módulos têm cada um a sua), a migração "invisível" proposta perderia a oportunidade de dar identidade visual própria ao módulo — mas é a opção de menor risco/menor mudança visual, coerente com "PLAT-16: nenhum módulo perde funcionalidade" |

**Se esta tabela estivesse vazia:** não estaria — as 3 entradas acima exigem confirmação explícita do usuário antes de virar decisão travada, idealmente via `/gsd-discuss-phase`.

## Open Questions

1. **O que deve conter o rodapé do shell comum?**
   - What we know: nenhum módulo tem `<footer>` hoje; o roadmap (`ROADMAP.md` linha 29) exige "cabeçalho, navegação por abas e rodapé" como parte do shell
   - What's unclear: se é decorativo (ex.: "PMOC · CMASM · v2.0") ou funcional (links, versão, suporte)
   - Recommendation: propor conteúdo mínimo decorativo em `/gsd-discuss-phase` e travar a decisão lá, antes do planner detalhar a task

2. **`maquinas/app.js:3-4` (SUPA_URL/SUPA_KEY hardcoded) deve ser removido ou mantido como fonte de descoberta?**
   - What we know: `shared/supabase-config.js:18-21` lê a config tentando, nesta ordem, `../maquinas/app.js` e depois `../refrigeracao/index.html` — ou seja, hoje **depende** de `maquinas/app.js` continuar tendo essas duas constantes hardcoded, mesmo que `maquinas` passe a usar `criarClienteSupabase()` internamente
   - What's unclear: se remover as constantes de `maquinas/app.js` (para "limpar" o arquivo) quebraria a descoberta de config para os outros 4 módulos que dependem dela
   - Recommendation: manter as 2 linhas mesmo depois da migração de `maquinas` para `criarClienteSupabase()` (usar a própria função ali também, por consistência, mas sem apagar o fallback de `refrigeracao/index.html`) — ou, alternativa mais robusta fora do escopo mínimo desta fase, mover as credenciais para um arquivo `shared/config.local.js` dedicado, não dependente de nenhum app específico continuar existindo com essas linhas

3. **Extrair o motor `modulo-manutencao.js` para usar `shared/shell.js` muda visualmente `eletrica`/`fonoclama` mesmo que a config seja idêntica?**
   - What we know: `montarLayout()` hoje é uma função privada do motor; extraí-la para `shared/shell.js` como função exportada e genérica (parâmetro `navItems` em vez de HTML fixo) exige reescrever a chamada em `shared/modulo-manutencao.js:239-246` para passar a lista de 6 itens de nav como dado
   - What's unclear: se ao generalizar, algum detalhe de acessibilidade/atributo (`data-view`, por exemplo, presente em `maquinas/index.html:207-215` mas ausente em `shared/modulo-manutencao.js:240-245`) deveria ser padronizado para os 6 módulos ou é irrelevante
   - Recommendation: manter a saída HTML byte-a-byte idêntica à de `montarLayout()` hoje (só mudando a origem do arquivo), sem adicionar atributos novos nesta fase — qualquer padronização de atributos fica para depois, se necessária

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (para `node --test`) | Verificação de não regressão de lógica pura (PLAT-16) | ✓ | v24.18.0 (confirmado nesta pesquisa) | — |
| Navegador moderno (ES Modules, CSS custom properties) | Todo o frontend | ✓ (requisito de `CLAUDE.md`/`.claude/CLAUDE.md`, "ES6 JavaScript required") | — | — |
| `@supabase/supabase-js` v2 via jsDelivr CDN | Cliente de dados/autenticação em todos os módulos | ✓ (já em uso, sem mudança de versão nesta fase) | v2 (UMD) | — |
| Servidor HTTP local (`python -m http.server`) | Testar módulos ES localmente (import/export exige HTTP, não `file://`) | Não verificado nesta pesquisa (depende da máquina do executor) | — | Deploy em preview do Vercel serve o mesmo propósito |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** servidor HTTP local — se ausente na máquina do executor, usar um deploy de preview do Vercel para testar os módulos ES antes do merge.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Sim | `shared/auth.js` (`Auth` class) — já é o padrão do projeto; esta fase apenas consolida `maquinas` no mesmo padrão, sem introduzir novo mecanismo de autenticação |
| V3 Session Management | Sim (sem mudança) | Sessão gerenciada por `supa.auth.getSession()`/`onAuthStateChange` (SDK Supabase) — nenhuma mudança de gerenciamento de sessão nesta fase |
| V4 Access Control | Sim (sem mudança na fonte da verdade) | RLS no Postgres continua sendo a autorização real (`CLAUDE.md`: "qualquer checagem client-side é só UX"); `podeEscrever()`/`ROLES_ESCRITA` client-side (presente em `predial/app.js:36,95-97`, `shared/modulo-manutencao.js:20,97-99`) continua sendo só UX, não segurança — `maquinas` não tem hoje um `podeEscrever()` equivalente; migrar para o padrão de auth compartilhado é uma boa oportunidade de adicionar essa checagem de UX também em `maquinas`, mas **não é requisito de PLAT-01/02/03** e não deve ser tratado como bloqueante desta fase |
| V5 Input Validation | Não aplicável nesta fase | Esta fase não adiciona nem modifica formulários de entrada de dados |
| V6 Cryptography | Não aplicável | Nenhuma mudança de senha/token/hash — `supa.auth.signInWithPassword` é gerenciado inteiramente pelo Supabase SDK |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via nome de módulo/config não escapado ao gerar o shell dinamicamente | Tampering / Information Disclosure | `montarShell()` deve usar `esc()` para todo texto vindo de `CFG` (nome do módulo, itens de nav), replicando o padrão já em `shared/modulo-manutencao.js:231` (`${esc(CFG.nome)}`) — como os valores de `CFG` são hardcoded pelos próprios devs (não input de usuário), o risco real é baixo, mas manter a disciplina de `esc()` evita reintrodução do padrão inseguro se algum módulo futuro vier a aceitar nome configurável via banco |
| Exposição de e-mail interno (`direcao@cmasm.local`, etc.) na UI de login | Information Disclosure | Já mitigado por design em `shared/auth.js` (login por botão de cargo, e-mail nunca exibido) — a migração de `maquinas` deve preservar esse comportamento; qualquer teste manual desta fase deve confirmar visualmente que nenhum e-mail aparece na tela de login de `maquinas` após a migração |
| Regressão de bloqueio de escrita para `observador` ao trocar o fluxo de auth | Elevation of Privilege (client-side apenas — RLS continua sendo a barreira real) | RLS não muda nesta fase (nenhuma migração SQL prevista — confirmado, última migração é `24_transportes_inventario_completo.sql`); qualquer teste manual deve incluir tentativa de escrita como `observador` via console do navegador em `maquinas` pós-migração, espelhando o teste já documentado (mas não executado) em `STATE.md` "Parte B do checkpoint" da Fase 1 |

## Sources

### Primary (HIGH confidence — leitura direta do repositório, todas com `arquivo:linha`)
- `.planning/ROADMAP.md` — goal, requirements e success criteria da Fase 5
- `.planning/REQUIREMENTS.md` — PLAT-01, PLAT-02, PLAT-03, PLAT-15, PLAT-16
- `.planning/PROJECT.md`, `.planning/STATE.md` — contexto e decisões acumuladas do milestone v2.0
- `CLAUDE.md`, `.claude/CLAUDE.md` — convenções obrigatórias do projeto
- `shared/pmoc.css`, `shared/auth.js`, `shared/modulo-manutencao.js`, `shared/supabase-config.js`, `shared/persistencia.js`, `shared/arvore.js`, `shared/vencimento.js` — lidos por completo
- `maquinas/app.js` (1070 linhas), `maquinas/index.html` (651 linhas), `maquinas/operacoes.js` (50 linhas) — lidos por completo/grep exaustivo
- `transportes/app.js` (trechos-chave: boot, auth, mostrarApp), `transportes/index.html` (100 linhas de `<style>` + corpo)
- `eletrica/app.js`, `eletrica/index.html`, `fonoclama/app.js`, `fonoclama/index.html` — lidos por completo
- `predial/app.js` (120 linhas iniciais), `predial/index.html`, `predial/dominio.js` — lidos por completo
- `mapa/app.js` (121 linhas, completo), `mapa/index.html` (completo), `mapa/xmap.css` (35 linhas iniciais)
- `vercel.json` — 7 rotas verificadas
- `tests/*.test.js` (5 arquivos) — executados via `node --test`, 19/19 passando (baseline)
- `refrigeracao/index.html` — verificado por grep, zero referência a `shared/`/`pmoc.css`
- `.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`, `CONVENTIONS.md`, `STRUCTURE.md` — usados como contexto histórico; **desatualizados** em pontos específicos (datados de 07/08/2026, antes de `predial`/`mapa`/`eletrica`/`fonoclama` existirem, e antes de `predial`/`mapa`/`transportes` adotarem `shared/auth.js`) — tratados como referência secundária, não fonte de verdade; toda afirmação usada neste documento foi reverificada contra o código atual

### Secondary (MEDIUM confidence)
- Nenhuma — pesquisa não precisou de fonte externa/web nesta fase

### Tertiary (LOW confidence)
- Nenhuma

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — nenhuma lib nova, tudo já em produção e lido diretamente
- Architecture (shell/auth/CSS): HIGH — cada afirmação citada com `arquivo:linha`, comportamento comparado entre os 6 módulos lendo o código real, não documentação desatualizada
- Pitfalls: HIGH — Pitfall 1 (script clássico vs módulo ES) foi verificado por grep contando as 27 ocorrências reais de `onclick=`, não estimado
- Assumptions (A1-A3): MEDIUM/LOW por natureza — decisões de produto/UX que só o usuário pode confirmar, marcadas explicitamente

**Research date:** 2026-08-10
**Valid until:** enquanto nenhum dos 6 módulos mudar de estrutura antes da execução desta fase — recomenda-se não deixar esta pesquisa "esfriar" mais que ~7 dias, já que o histórico do projeto mostra mudanças estruturais frequentes (3 módulos novos + `shared/modulo-manutencao.js` inteiro criados entre 08/08 e 10/08/2026)
