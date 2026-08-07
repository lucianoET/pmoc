# PMOC · CMASM

Sistemas de **Plano de Manutenção, Operação e Controle** do Centro de Mísseis
e Armas Submarinas da Marinha — UASG 744030 · São Gonçalo/RJ.

[![Supabase](https://img.shields.io/badge/Supabase-pmoc-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/dashboard/project/thoaqipyhfmromsgzmjs)
[![Vercel](https://img.shields.io/badge/Vercel-pmoc-000000?logo=vercel&logoColor=white)](https://vercel.com/new)
![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20vanilla%20JS-f7df1e)
![Build](https://img.shields.io/badge/build-nenhum-lightgrey)

**Nomes espelhados:** GitHub `luctronicserp/pmoc` · Supabase `pmoc` · Vercel `pmoc`

---

## Apps

| Rota | App | Conteúdo | Estado |
|------|-----|----------|--------|
| `/` | **Portal** | Índice dos sistemas | ✅ |
| `/refrigeracao` | **PMOC Refrigeração** v2.8 | 171 unidades · ARP 04/2024 · fiscalização · QR · impressão | ✅ |
| `/maquinas` | **PMOC Máquinas** v1.0 | 7 máquinas · 59 planos · 34 peças · consumo · ciclo de vida | ✅ |

### Refrigeração
Inventário de climatização com fluxo completo de contratação pública:
Identificação → Orçamento → Execução → Fiscalização → Composição de pagamento
(itens da ata) → Certificação → Auditoria.

### Máquinas de corte
Manutenção por horímetro de roçadeiras, motosserras, tratores e mini-tratores.
Planos por modelo, baixa automática de estoque, combustível por operador,
depreciação e **lista de compras** exportável em CSV para processo licitatório.

---

## Dados em produção

| Tabela | Registros |
|--------|-----------|
| `equipamentos` | 171 (136 OK · 35 NOK) |
| `arp_itens` | 19 (R$ 66.447,86 empenhados) |
| `os_contratacao` | 2 (NE 334 e 335) |
| `plano_tarefas` | 9 (NBR 17037) |
| `maq_ativos` | 7 |
| `maq_planos` | 59 |
| `maq_materiais` | 34 (R$ 4.861,80 de estoque mínimo) |

---

## Estrutura

```
pmoc/
├── index.html                 Portal
├── vercel.json                Rewrites de rota
├── push.sh                    Script de push inicial
├── refrigeracao/index.html    v2.8 — single-file, 436 KB
├── maquinas/
│   ├── index.html
│   └── app.js                 Supabase JS SDK via CDN
├── shared/auth.js             Login por cargo (reutilizável)
├── supabase/
│   ├── 01_maquinas_schema.sql
│   ├── 02_maquinas_seed.sql
│   ├── 03_usuarios_cargos.sql
│   ├── 04_refrigeracao_schema.sql
│   ├── 05_refrigeracao_import_171.sql
│   └── 06_arp_04_2024_import.sql
└── docs/
    ├── *.ods                  Planilhas-fonte
    ├── NE_*.pdf               Notas de empenho
    └── legado/                HTMLs originais (localStorage)
```

---

## Stack

Sem build, sem npm, sem framework. HTML + vanilla JS + Supabase JS SDK via CDN.
Cada `index.html` abre direto no navegador para desenvolvimento.

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5 + JavaScript ES6 |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Deploy | Vercel (estático) |

---

## Login

Botões de cargo + senha. O e-mail nunca é exposto ao usuário.

| Botão | E-mail interno | Role | Permissões |
|-------|----------------|------|-----------|
| Direção | `direcao@cmasm.local` | admin | tudo |
| Gestor | `gestor@cmasm.local` | gestor | leitura + escrita |
| Técnico | `tecnico@cmasm.local` | tecnico | leitura + escrita |
| Livre | — | observador | somente leitura |

Senha inicial `cmasm2026` — **trocar antes do uso operacional**.
Novos cargos: editar o array `CARGOS` no topo de `maquinas/app.js`.

---

## Setup

Ver **[SETUP.md](SETUP.md)** para o passo a passo completo.

O Supabase já está configurado — as credenciais estão embutidas nos apps.
Basta importar o repo no Vercel (Framework: *Other*, sem build command).

---

## Convenções

- Migrações **aditivas** — nunca `DROP`. Arquivar com `ativo = false`.
- Tabelas de máquinas usam prefixo `maq_`.
- Planos de manutenção ligam por `tipo_modelo` — cada modelo tem manual próprio.
- Idioma do projeto: português (código, commits, UI).
- `anon key` é pública por design; a proteção real é o RLS.

---

## Pendências

- [ ] Divergência RLP: MCP R$ 43.467,13 × NE334 R$ 39.926,11 (dif. R$ 3.541,02)
- [ ] Centrais F21 são 30 TR; itens 1365/1366 aderidos são 12 TR — verificar aplicabilidade
- [ ] Trocar senhas dos cargos
- [ ] Valores de aquisição das máquinas são estimativas — ajustar com patrimônio real
