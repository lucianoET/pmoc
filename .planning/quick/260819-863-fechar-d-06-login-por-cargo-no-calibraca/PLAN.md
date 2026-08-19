---
quick_id: 260819-863
slug: fechar-d-06-login-por-cargo-no-calibraca
date: 2026-08-19
status: in-progress
---

# Plano — fechar D-06: login no /calibracao e escrita só autenticada

## O buraco, medido

As 5 tabelas `cal_*` têm uma policy `ALL` cada, com `roles = {anon, authenticated}`
e `using (true) with check (true)`. Como a `anon key` está no HTML (por projeto,
é assim em toda a plataforma), qualquer pessoa com a URL `/calibracao` **grava**
em instrumentos, PS, lotes, laboratórios e catálogo. Enquanto o dado morava no
`localStorage` o estrago era local; desde a migração 35 é compartilhado.

## A correção NÃO é "tudo para authenticated"

O padrão do resto da plataforma, conferido no banco, é **leitura aberta, escrita
autenticada**:

| tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `maq_ativos` | `{public}` | `{authenticated}` |
| `equipamentos` | `{public}` | `{authenticated}` |
| `transp_ativos` | `{anon}` + `{authenticated}` | `{authenticated}` |

Fechar `cal_*` inteiramente para `authenticated` quebraria o cargo **Livre**
(`shared/auth.js`), que é acesso de observador **sem senha** — ele nunca chama
`signInWithPassword`, então segue como `anon`. O observador é papel real do
projeto, e leitura pública já é a postura das outras seis famílias de tabela.
Então: **SELECT público, escrita autenticada** — que é exatamente o que o D-06
existe para consertar.

## Tarefas

1. **`supabase/39_calibracao_rls_autenticada.sql`** — para cada uma das 5 tabelas:
   - `alter policy "cal_X_tudo" on cal_X to authenticated;` (restringe a policy
     que já existe; **sem `drop`**, o nome e o corpo continuam os mesmos)
   - `create policy "cal_X_sel" on cal_X for select to public using (true);`
     (devolve a leitura que a policy anterior dava a `anon`)
2. **Login em `calibracao/index.html`**, sem tocar nas 11 páginas React:
   - `window.__calSupa = supa` logo depois de criar o client (o módulo ES precisa
     do **mesmo** client, senão a sessão do login não é a sessão das consultas)
   - `ReactDOM.createRoot(...).render(...)` deixa de rodar na carga e passa a ser
     o corpo de `window.__calIniciar(usuario)`
   - `<div id="login-cal">` antes de `#root`, com o mapa de tokens do módulo
     (`--sf`→`--surface`, `--bd`→`--border`, `--tx`→`--text`, `--blue`→`--yellow`),
     senão o cartão de login desenha escuro sobre o tema claro
   - `<script type="module">` importando `Auth` de `../shared/auth.js`, com
     `appNome: 'Calibração'`; aplica `data-theme` a partir de
     `localStorage['cmasm_erp_theme']` antes de montar, senão a tela de login
     pisca no tema errado (o React só aplica o tema depois)
   - botão **Sair** na topbar, ao lado do de tema, com o cargo do usuário
3. **`tests/calibracao-login.test.js`** — gate: o render está atrás do login, o
   módulo importa o `Auth` compartilhado, o client é um só, e a migração 39
   cobre as 5 tabelas nas duas metades (restringe a `ALL`, recria o `SELECT`).
4. **Docs**: `CLAUDE.md` (D-06 deixa de ser pendência), topo de
   `supabase/35_calibracao_schema.sql` (o aviso passa a apontar para a 39),
   `README.md`.
5. Aplicar a migração 39 em produção e conferir no banco.
