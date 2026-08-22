---
quick_id: 260819-863
slug: fechar-d-06-login-por-cargo-no-calibraca
date: 2026-08-19
status: complete
---

# Sumário — D-06 fechada: login no /calibracao e escrita autenticada

## O buraco, medido antes

As 5 tabelas `cal_*` tinham **uma policy `ALL` cada, em `{anon, authenticated}`**,
com `using (true) with check (true)`. A `anon key` está no HTML — é assim nos sete
módulos, por projeto —, então qualquer pessoa com a URL `/calibracao` **gravava**
em instrumentos, PS, lotes, laboratórios e catálogo. Enquanto o dado morava no
`localStorage` o estrago era local; desde a migração 35 é compartilhado.

## A correção não foi "tudo para authenticated"

A pendência dizia isso, e teria quebrado o cargo **Livre** — acesso de observador
**sem senha**, que nunca chama `signInWithPassword` e por isso continua sendo
`anon`. O padrão do resto da plataforma, conferido no banco, é **leitura aberta,
escrita autenticada**:

| tabela | SELECT | escrita |
|---|---|---|
| `maq_ativos` | `{public}` | `{authenticated}` |
| `equipamentos` | `{public}` | `{authenticated}` |
| `transp_ativos` | `{anon}` + `{authenticated}` | `{authenticated}` |

O que o D-06 existe para consertar é a **escrita**.

## Entregue

1. **`supabase/39_calibracao_rls_autenticada.sql`** — `alter policy … to
   authenticated` nas cinco policies que já existiam (mesmo nome, mesmo corpo,
   **sem `drop`**) mais uma `_sel` por tabela devolvendo o `SELECT` a `public`.
   Nenhuma tabela, coluna ou linha tocada.
2. **Login por cargo no módulo**, sem tocar nas 11 páginas React:
   `ReactDOM.createRoot(...).render(...)` virou o corpo de
   **`window.__calIniciar(usuario)`**, chamado pelo `onLogin` de um
   `<script type="module">` que importa o `Auth` de `shared/auth.js`.
3. **Sair** na topbar, com o cargo de quem entrou.
4. **"somente leitura"** na topbar para o observador — o limite dito antes do
   clique, não descoberto por um alerta de erro de banco depois dele.

## Quatro coisas que só aparecem quando se tenta

- **Um client só.** O login usa `window.__calSupa`, o mesmo do app. Dois clients
  seriam duas sessões: a senha digitada numa, as consultas saindo da outra ainda
  como `anon`, e o Postgres recusando sem nada na tela dizendo por quê.
- **Trava de dupla montagem.** `Auth.mount` consulta `getSession()` *e* escuta
  `onAuthStateChange` — com sessão salva, o mesmo login chega duas vezes, e
  seriam dois `createRoot` no mesmo nó.
- **Ponte de tokens.** `auth.js` desenha com `--surface`/`--border`/`--text`;
  aqui os nomes são `--sf`/`--bd`/`--tx`. Sem a ponte o cartão cai nos fallbacks
  escuros do próprio `auth.js` e sai escuro sobre o tema claro.
- **Tema antes do login.** Quem aplica tema neste módulo é o React, que agora só
  monta depois de autenticar; sem ler `cmasm_erp_theme` no módulo de login, a
  tela pisca no tema errado para quem escolheu claro.

## Gates

- Novo: `tests/calibracao-login.test.js` (13 testes) — as duas metades da
  migração 39, o render atrás do login, o client único, a trava, a ponte de
  tokens, o tema e a saída.
- Dois gates existentes mudaram **porque o fato mudou**, não para passar:
  `tests/calibracao-supabase.test.js` afirmava "as políticas aceitam anon" e
  agora exige que o topo da 35 aponte para a 39; `tests/tema-superficies.test.js`
  proibia `shared/` inteiro em `calibracao/index.html` e agora proíbe
  `shared/tema.js` e `shared/shell.js` pelo nome — **D-05 protege o tema**, e o
  módulo importa o `Auth` compartilhado justamente para não existir uma segunda
  tela de login no projeto.
- Suíte: **485/485**.

## Ordem de publicação (importante)

O frontend vai **antes** da migração. Aplicar a 39 com o Vercel ainda servindo o
HTML sem login faria toda gravação no `/calibracao` falhar até o deploy sair. Na
ordem inversa não há janela quebrada: com o login no ar e as policies ainda
antigas, tudo funciona igual.

## Aplicada e verificada em produção (19/08/2026)

Na ordem certa: PR mergeada → Vercel publicou o `/calibracao` com login
(conferido buscando `__calIniciar` no HTML servido) → migração 39 aplicada.

A conferência foi **pela porta da frente**, com a `anon key` que está no HTML,
contra a API REST — `pg_policies` mostraria o que foi escrito, não o que o
Postgres faz com ele:

| tentativa (anon) | antes | agora |
|---|---|---|
| `INSERT` em `cal_labs` | criava a linha | **401** `new row violates row-level security policy` |
| `UPDATE` em `cal_equipamentos` (linha existente) | gravava | **200 `[]`** — não enxerga a linha para escrever |
| `SELECT` | lia | **200**, segue lendo (é o que o cargo Livre precisa) |

Nada foi alterado na sondagem: 38 instrumentos, 8 laboratórios, 12 PS, e o `obs`
do instrumento sondado continua nulo. As policies ficaram duas por tabela — a
`_tudo` em `{authenticated}`, a `_sel` em `{public}`.

## Fica em aberto

As senhas de cargo continuam no `cmasm2026` inicial — pendência já registrada,
que agora vale também para o `/calibracao`.
