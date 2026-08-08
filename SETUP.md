_

# Setup — passo a passo

## 1 · Push do código

```bash
cd pmoc-monorepo
git init
git add .
git commit -m "PMOC monorepo — portal + refrigeração v2.8 + máquinas v1.0"
git remote add origin https://github.com/luctronicserp/pmoc.git
git branch -M main
git push -u origin main
```

## 2 · Supabase — ✅ JÁ FEITO

|           |                                                             |
| --------- | ----------------------------------------------------------- |
| Projeto   | **pmoc**                                              |
| Ref       | `thoaqipyhfmromsgzmjs`                                    |
| Região   | sa-east-1                                                   |
| Org       | Luctronics (integração Vercel)                            |
| Dashboard | https://supabase.com/dashboard/project/thoaqipyhfmromsgzmjs |

**20 tabelas criadas**, dados de máquinas populados, credenciais já
coladas em `maquinas/app.js` e `refrigeracao/index.html`.

| SQL                            | Status                                                   |
| ------------------------------ | -------------------------------------------------------- |
| `01_maquinas_schema.sql`     | ✅ 7 tabelas + RLS + trigger                             |
| `02_maquinas_seed.sql`       | ✅ 7 máquinas · 59 planos · 34 peças · 49 vínculos |
| `03_usuarios_cargos.sql`     | ✅ 3 cargos                                              |
| `04_refrigeracao_schema.sql` | ✅ 11 tabelas + 9 tarefas NBR                            |
| `09_importa_frota_28.sql`    | ✅ frota ampliada para 28 máquinas                       |
| `12_maquinas_areas_operacoes.sql` | ✅ áreas, operações, RLS e RPC transacional |
| `13_corrige_permissao_rpc_operacoes.sql` | ✅ execução anônima da RPC bloqueada |

As abas **Operações** e **Agenda** estão habilitadas. A migração não criou áreas
ou operações fictícias; esses registros começam vazios e devem ser cadastrados
pela interface.

⚠️ **Senha do banco Postgres:** guardada fora do repo. Se precisar
(conexão direta / pg_dump), redefina em Settings → Database.

## 3 · Vercel

vercel.com/new → Import Git Repository → `luctronicserp/pmoc`

- Framework Preset: **Other**
- Build Command: *(vazio)*
- Output Directory: *(vazio)*
- Project Name: **pmoc**

Deploy. As rotas `/refrigeracao` e `/maquinas` já funcionam pelo `vercel.json`.

Depois: Supabase → Auth → URL Configuration → Site URL = `https://pmoc.vercel.app`

## 4 · Dados do refrigeração — ✅ RECUPERADOS

O projeto `hssqrdeurwzkigqudzpf` foi **excluído** (API confirma:
`"Resource has been removed"`). Não é pausa — não há restauração
pela API.

Perdidos: 171 equipamentos · 19 itens ARP · 2 OS de contratação · 12 usuários.

**Inventário reimportado** de `docs/Mapeamento_da_Refrigeração_ATU_em_29_DE_ABRIL_2026.ods`
via `05_refrigeracao_import_171.sql` — números batem com o sistema original:

|                   |                  |
| ----------------- | ---------------- |
| Total             | **171** ✅ |
| Operantes         | **136** ✅ |
| Inoperantes       | **35** ✅  |
| Permanentes 24×7 | 18               |

Por tipo: SPLIT 105 · SELF CONTAINED 32 · PISO/TETO 22 · JANELA 11 · CHILLER 1
Por área: AZUL 84 · VERMELHA 87
Criticidade (derivada): ALTA 92 · BAIXA 37 · MÉDIA 24 · CRÍTICA 18

### ARP e contratação — ✅ também recuperados

Importados via `06_arp_04_2024_import.sql` das planilhas MCP + NEs (em `docs/`):

**ARP nº 04/2024** · PE 90026/2024 — CMRJ (UASG 160292) · Processo 63099.002208/2025-06

| NE           | Fornecedor                    | Itens        | Qtd           | Valor NE               |
| ------------ | ----------------------------- | ------------ | ------------- | ---------------------- |
| 2026NE000334 | RLP COMÉRCIO E SERVIÇOS     | 12           | 232           | R$ 39.926,11           |
| 2026NE000335 | W I N S MARQUES DISTRIBUIDORA | 7            | 50            | R$ 26.521,75           |
|              | **TOTAL**               | **19** | **282** | **R$ 66.447,86** |

Nada executado até 04/08/2026 — saldo = 100% do empenhado.

⚠️ **Divergência conhecida (RLP):** soma dos itens do MCP = R$ 43.467,13
contra NE334 = R$ 39.926,11 — diferença de **R$ 3.541,02**. Confirmar na NE
quais itens/quantidades foram efetivamente empenhados e ajustar
`quantidade_registrada` em `arp_itens`.

⚠️ **Centrais do F21:** são Trane TDXS30000A000 de **30 TR**, mas os itens
aderidos 1365/1366 (WINS) são de **12 TR / 144.000 BTU**. Verificar
aplicabilidade antes de emitir OS.

**Ainda falta:** histórico de manutenções executadas (`logs_manutencao`) —
não havia registro no sistema anterior (tabela estava com 0 linhas).

## 5 · Checklist

- [ ] Push feito
- [ ] Projeto Supabase `pmoc` criado
- [ ] 3 SQLs rodados
- [ ] Credenciais coladas em `maquinas/app.js`
- [ ] Credenciais coladas em `refrigeracao/index.html`
- [ ] Vercel importou o repo
- [ ] Site URL configurada no Supabase Auth
- [ ] Senhas dos cargos trocadas
- [ ] Situação do banco antigo resolvida
