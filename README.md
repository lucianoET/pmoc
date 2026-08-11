# PMOC · CMASM

Sistemas de **Plano de Manutenção, Operação e Controle** do Centro de Mísseis
e Armas Submarinas da Marinha — UASG 744030 · São Gonçalo/RJ.

[![Supabase](https://img.shields.io/badge/Supabase-pmoc-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/dashboard/project/thoaqipyhfmromsgzmjs)
[![Vercel](https://img.shields.io/badge/Vercel-pmoc-000000?logo=vercel&logoColor=white)](https://vercel.com/new)
![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20vanilla%20JS-f7df1e)
![Build](https://img.shields.io/badge/build-nenhum-lightgrey)

**Nomes:** GitHub `luctronics-ET/pmoc` · Supabase `pmoc` · Vercel `pmoc` (produção em `https://pmoc-orcin.vercel.app`)

---

## Apps

| Rota | App | Conteúdo | Estado |
|------|-----|----------|--------|
| `/` | **Portal** | Índice dos sistemas | ✅ |
| `/refrigeracao` | **PMOC Refrigeração** v2.8 | 171 unidades · ARP 04/2024 · fiscalização · QR · impressão | ✅ |
| `/maquinas` | **PMOC Máquinas** v1.1 | 28 máquinas · 59 planos · 34 peças · operações · consumo · ciclo de vida | ✅ |
| `/transportes` | **PMOC Transportes** v1.0 | 43 ativos · 23 viagens · planos, estoque, OS e lista de compras | ✅ |
| `/eletrica` | **PMOC Elétrica** v1.0 | 13 ativos · 9 planos · 11 peças · geradores, QGBT, nobreaks, iluminação | ✅ |
| `/fonoclama` | **PMOC Fonoclama** v1.0 | 10 ativos · 7 planos · 10 peças · PA 70V | ✅ |
| `/predial` | **PMOC Predial** v1.0 | 233 locais · 3 templates · 206 itens de checklist · GUT · laudos | ✅ |
| `/mapa` | **Mapa CMASM** v1.0 | Planta do centro em Leaflet, portada do legado xMap | ✅ |

### Refrigeração
Inventário de climatização com fluxo completo de contratação pública:
Identificação → Orçamento → Execução → Fiscalização → Composição de pagamento
(itens da ata) → Certificação → Auditoria.

### Máquinas de corte
Manutenção por horímetro de roçadeiras, motosserras, tratores e mini-tratores.
Planos por modelo, baixa automática de estoque, combustível por operador,
operações por área com kanban e agenda, depreciação e **lista de compras**
exportável em CSV para processo licitatório.

### Transportes
Frota mista de 43 ativos — 33 viaturas (rodoviárias, empilhadeiras, tratores,
guindastes, semi-reboques) e 10 embarcações — importada do mapa operacional
VTR/EMB. Manutenção por km ou horas de motor conforme o ativo, planos por
`tipo_modelo`, estoque de peças com baixa automática na OS e lista de compras
em CSV. Escrita restrita por RBAC (`transp_pode_escrever()`); leitura pública.

O inventário anterior tinha 9 ativos porque o seed original usou a "Programação
de Viaturas de Rotina" (um registro de viagens de um dia) no lugar do mapa da
frota. Corrigido na migração 24 — ver
`.planning/phases/01-transportes-frota-sob-manuten-o/01-CONFERENCIA-IMPORT.md`.

### Elétrica e Fonoclama
Portados dos apps legados em `localStorage` (`ref/eletrica.html` e o
`fonoclama.html` do DEV_ERP). Mesmo modelo: ativo com horímetro, plano de
manutenção por tipo de ativo, OS com registro de não conformidade e baixa
automática das peças previstas, alerta de estoque mínimo e lista de compras
em CSV.

Os dois compartilham o motor `shared/modulo-manutencao.js` — cada módulo é
só um arquivo de configuração (tipos de ativo, cor, prefixo das tabelas).
Refrigeração, Máquinas e Transportes **não** usam esse motor e seguem como
estavam.

### Predial
Portado do xPredial do DEV_ERP (SQLite + Flask). Não usa o motor de horímetro —
o ciclo aqui é inspeção, não manutenção por uso: árvore de locais do CMASM →
template de checklist → inspeção → itens pontuados na **matriz GUT** → laudo,
com trilha de auditoria das mudanças de status.

GUT segue a escala do legado: cada dimensão vale 0, 1, 3, 6, 8 ou 10 (total até
1000); até 100 é baixo, 101–400 atenção, acima de 400 crítico. `gut_total` e
`condicao` são colunas geradas no Postgres (no SQLite eram triggers).

O seed é **gerado**, não escrito à mão — `supabase/gerar_18_predial_seed.py` lê
os arquivos do legado e emite o SQL:

```bash
python3 supabase/gerar_18_predial_seed.py
```

---

## Dados em produção

| Tabela | Registros |
|--------|-----------|
| `equipamentos` | 171 (136 OK · 35 NOK) |
| `arp_itens` | 19 (R$ 66.447,86 empenhados) |
| `os_contratacao` | 2 (NE 334 e 335) |
| `plano_tarefas` | 9 (NBR 17037) |
| `maq_ativos` | 28 |
| `maq_planos` | 59 |
| `maq_materiais` | 34 (R$ 4.861,80 de estoque mínimo) |
| `transp_ativos` | 43 (33 viaturas · 10 embarcações · 26 INOP) |
| `cmasm_locais` | 311 |
| `cmasm_estrutura` | 78 |
| `elet_ativos` | 13 |
| `fono_ativos` | 10 |
| `transp_viagens` | 23 |
| `transp_planos` | 0 (aguardando cadastro) |
| `transp_materiais` | 0 (aguardando cadastro) |

---

## Estrutura

```
pmoc/
├── index.html                 Portal
├── vercel.json                Rewrites de rota (7 módulos)
├── refrigeracao/index.html    v2.8 — single-file, 436 KB
├── maquinas/
│   ├── index.html
│   ├── app.js                 Aplicação e acesso ao Supabase
│   └── operacoes.js           Regras testáveis de operações e agenda
├── transportes/
│   ├── index.html
│   └── app.js                 Frota mista, viagens, planos, estoque e OS
├── eletrica/    index.html + app.js    Configuração do módulo (tabelas elet_)
├── fonoclama/   index.html + app.js    Configuração do módulo (tabelas fono_)
├── predial/
│   ├── index.html
│   ├── app.js                 Inspeção, checklist GUT e laudos (tabelas pred_)
│   └── dominio.js             Regras testáveis: faixas GUT e árvore de locais
├── mapa/                      Planta do CMASM em Leaflet (portado do xMap)
├── shared/
│   ├── auth.js                Login por cargo (reutilizável)
│   ├── supabase-config.js     Reuso da configuração Supabase
│   ├── pmoc.css               Estilo comum dos módulos novos
│   ├── shell.js               Shell de layout comum — cabeçalho, abas e rodapé (testado)
│   ├── vencimento.js          Regra de vencimento por horímetro (testada)
│   └── modulo-manutencao.js   Motor de elétrica/fonoclama
├── supabase/                  24 migrações numeradas, aplicadas em ordem
│   ├── 01–09  máquinas, usuários, refrigeração, ARP, frota
│   ├── 10–13  transportes (schema e seed), áreas e operações de máquinas
│   ├── 14–16  elétrica e fonoclama
│   ├── 17–18  predial (18 é gerado por gerar_18_predial_seed.py)
│   ├── 19–21  cmasm_locais unificado e vínculo com os módulos
│   └── 22–24  transportes: planos e RBAC, estoque e OS, inventário completo
├── tests/                     Testes de regra de negócio (node <arquivo>.test.js)
├── ref/                       Fontes legadas: planilhas, PDFs, HTMLs originais
└── docs/historico/            Registros de setup e incidentes já resolvidos
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

Não há build. Para rodar local, abra qualquer `index.html` no navegador ou sirva a raiz:

```bash
python -m http.server
```

O Supabase já está configurado (projeto `pmoc`, ref `thoaqipyhfmromsgzmjs`, sa-east-1) e as
credenciais estão embutidas nos apps. O deploy é automático: push em `luctronics-ET/pmoc`
publica em `https://pmoc-orcin.vercel.app` (Framework *Other*, sem build command).

**Migrações:** escreva um arquivo numerado novo em `supabase/` e execute-o no SQL Editor.
Sempre aditivas — nunca `DROP`.

O histórico do setup inicial, da recuperação dos dados do refrigeração e da correção do
404 do deploy está em [`docs/historico/`](docs/historico/).

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
