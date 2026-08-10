# Conferência pós-import — Módulo Transportes (Fase 01, Plano 04)

## 1. Cabeçalho

- **Data da conferência:** 2026-08-10 (relatório original) — **reescrito em 2026-08-10** após a Parte A do checkpoint revelar uma divergência grave (ver Seção 0).
- **Fonte legada usada para o inventário:** `Mapa de VTR e EMB ATU 20FEV26.pdf` — o **inventário real** da frota (placa, estado operacional P/INOP, restrições), fornecido pelo usuário fora deste repositório.
- **Fonte legada usada para as viagens:** `ref/Mapa de VTR e EMB ATU 20FEV26.csv` — a "Programação de Viaturas de Rotina", um **registro de viagens de um único dia (30JAN)**, não o inventário. Continua sendo a fonte correta das 23 viagens históricas.
- **Origem dos números deste relatório:** as contagens abaixo vêm de **consulta ao vivo ao banco de produção** (`pmoc`, `thoaqipyhfmromsgzmjs`), feita via MCP do Supabase depois de aplicar `supabase/24_transportes_inventario_completo.sql` (commit `c7c9c2c`) — **não mais do arquivo de seed**, ao contrário da versão anterior deste relatório. Adicionalmente, cada linha da migração 24 foi conferida por este executor diretamente contra o PDF do mapa (ver Seções 2–5), célula a célula, como segunda camada de verificação independente da consulta ao banco.

## 0. Achado central da conferência — o CSV não é o inventário

A primeira versão deste relatório (Task 1, antes deste checkpoint) declarou "zero divergência" comparando o inventário importado contra `ref/Mapa de VTR e EMB ATU 20FEV26.csv`. **Essa comparação estava correta em sua mecânica, mas usava a fonte errada.**

O nome do arquivo CSV (`Mapa de VTR e EMB ATU 20FEV26.csv`) é quase idêntico ao nome do PDF real do mapa (`Mapa de VTR e EMB ATU 20FEV26.pdf`), mas os dois documentos têm naturezas diferentes:

| | `ref/…csv` | `…pdf` |
|---|---|---|
| Título no documento | "Programação de Viaturas de Rotina" / "Programação de Embarcações de Rotina" / "Programação de Viaturas e Embarcações" | "EMBARCAÇÕES – ATUALIZADO EM 20FEV2026" (inventário completo) |
| O que registra | Viagens de um dia específico (30JAN) — saída, chegada, destino, missão, motorista | O inventário da frota: placa, estado operacional (P/INOP), restrições de manutenção |
| Quantos ativos aparecem | 9 (só os que saíram em viagem no dia 30JAN) | 43 (toda a frota, operacional ou não) |

O seed `11_transportes_seed.sql` (Plano anterior à Fase 01) tratou os 9 ativos que apareciam nas viagens do CSV como se fossem o inventário completo. Não são — são apenas os que estavam em uso naquele dia. **O inventário real, conforme o PDF, tem 43 ativos: 33 viaturas e 10 embarcações**, mais que quatro vezes o que havia sido importado.

O must-have original do plano ("O inventário importado contém 9 ativos, sendo 6 viaturas e 3 embarcações... conforme o mapa VTR/EMB") estava baseado nessa fonte errada e foi substituído pelo achado desta conferência — **43 ativos**, não 9. Ver a seção "Deviations" do `01-04-SUMMARY.md` para o registro formal desse desvio.

**Correção aplicada:** `supabase/24_transportes_inventario_completo.sql` (commit `c7c9c2c`), já aplicada em produção via MCP do Supabase e conferida pelo usuário antes deste checkpoint ser reaberto. A migração:
- Acrescenta os 34 ativos ausentes (7 embarcações EMB-004..EMB-010, 27 viaturas VTR-007..VTR-033)
- Corrige os 9 ativos já importados: placas que existiam no mapa mas não no CSV de viagens (VTR-003 = KYI 9496, VTR-004 = KWL 8894, VTR-005 = LQW 2865); remove a string "GUINDASTE" do campo de placa do VTR-006 (o guindaste XCMG RT35 não tem placa no mapa — vira `identificacao = null`, nunca a string livre); corrige o estado operacional de EMB-001 e VTR-001, marcados "P" (disponível) no seed antigo mas "INOP" no mapa
- Preenche `subtipo` e `tipo_modelo` nos 43 ativos
- Grava com `on conflict (codigo) do nothing` (novos) / `update ... where codigo = ...` (correções) — reexecutável sem duplicar

## 2. Contagens por tipo

| Métrica | Observado (CSV, relatório anterior — **incorreto**) | Observado (PDF + banco, este relatório) | Situação |
|---|---|---|---|
| Total de ativos | 9 | **43** | ⚠️ Corrigido — divergência grave da versão anterior |
| Viaturas | 6 | **33** (24 VTR INT + 9 VTR EXT) | ⚠️ Corrigido |
| Embarcações | 3 | **10** (CMASM 01–12, faltando refs 2/4/7 que não constam no mapa, + DSAM 01) | ⚠️ Corrigido |
| Viagens históricas importadas | 23 | **23** (inalterado) | ✅ Continua conferido — o CSV é, e sempre foi, a fonte correta das viagens |
| Ativos sem placa (`identificacao is null`) | 3 (tratadas como lacuna documental) | **16** (tratadas como "sem placa no próprio mapa", não lacuna documental — ver Seção 5) | ⚠️ Corrigido — natureza da lacuna também mudou |
| Ativos sem `tipo_modelo` | não avaliado antes | **0** | ✅ Conferido |
| Ativos INOP (`status = 'indisponivel'`) | não avaliado antes | **26 de 43** (25 pelo mapa + VTR-012, corrigido pelo usuário — ver Seção 5) | ✅ Registrado nesta conferência |

As 23 viagens permanecem corretas e não foram tocadas pela migração 24 — o CSV nunca deixou de ser a fonte certa **para viagens**, só estava sendo usado incorretamente como fonte **do inventário**.

## 3. Contagens por unidade de uso

**Correção ao must-have original.** O plano previa: *"toda viatura importada tem unidade de uso em quilômetros e toda embarcação importada tem unidade de uso em horas"*. Essa regra simples **não é verdadeira para o inventário real** — o mapa mostra que alguns equipamentos classificados como `tipo = 'viatura'` no schema (porque não são embarcações) são, na prática, equipamentos de horímetro, não de hodômetro: empilhadeiras, tratores e guindastes.

| Unidade | Categoria | Quantidade | Ativos |
|---|---|---|---|
| h | Embarcação | 10 | EMB-001 a EMB-010 (todas — 10/10) |
| h | Viatura (empilhadeira, trator, guindaste) | 10 | VTR-006 (guindaste XCMG), VTR-017/018/019/020 (empilhadeiras), VTR-021/022 (tratores Agrale), VTR-023 (guindaste Grove), VTR-030/031 (tratores Solis) |
| km | Viatura (rodoviário) | 23 | Demais 23 viaturas — automóveis, caminhões, furgões, semi-reboques, carro elétrico, quadriciclo |
| **Total** | | **43** | |

**Convenção adotada** (registrada como comentário na migração 24, reproduzida aqui): `unidade_uso = 'h'` para o que se controla por horímetro (embarcação, empilhadeira, trator, guindaste); `'km'` para o rodoviário. Semi-reboque não tem motor nem hodômetro — fica `'km'` com `uso_atual = 0` apenas porque a coluna é `not null`, sem controle de uso previsto para ele (a coluna existe, mas o campo é operacionalmente inerte para esse tipo de ativo).

Confirmado por consulta ao vivo: **nenhuma embarcação tem unidade ≠ `'h'`** (0 divergências).

**Modelo de identidade (D-03):** permanece confirmado — uma única tabela `transp_ativos`, distinguindo categoria pelo campo `tipo` (`'viatura'` / `'embarcacao'`) e carregando `unidade_uso` por ativo. A migração 24 não criou tabela separada por categoria nem por família de equipamento; `tipo_modelo` continua sendo apenas um campo de texto agrupador, usado por `transp_planos` (migração 22) para vincular plano de manutenção.

## 4. Amostra de ativos (conferência integral — 43/43)

### 4.1 Ativos já existentes no seed antigo (9), corrigidos pela migração 24

| Código | Nome | Tipo | Subtipo | Identificação (agora) | Identificação (seed antigo) | Ref. no PDF | Status (agora) | Status (seed antigo) |
|---|---|---|---|---|---|---|---|---|
| VTR-001 | MUNK (Caminhão Munck Iveco Vertis) | viatura | VTR INT | KPJ8385 | KPJ 8385 (correto) | VTR INT 15 | **indisponivel** (corrigido) | disponivel (errado — PDF diz INOP) |
| VTR-002 | S-10 | viatura | VTR EXT | LRZ 5099 | LRZ 5099 (correto) | VTR EXT 5 | disponivel | disponivel (correto) |
| VTR-003 | AMBULÂNCIA | viatura | VTR EXT | **KYI 9496** (corrigido) | *(vazio)* | VTR EXT 2 | disponivel | disponivel |
| VTR-004 | DOBLÔ 1.4 | viatura | VTR EXT | **KWL 8894** (corrigido) | *(vazio)* | VTR EXT 4 | disponivel | disponivel |
| VTR-005 | CAMINHÃO CONSTELLATION | viatura | VTR INT | **LQW 2865** (corrigido) | *(vazio)* | VTR INT 12 | disponivel | disponivel |
| VTR-006 | XCMG (Guindaste RT35) | viatura | VTR INT | **null** (corrigido — era a string "GUINDASTE") | GUINDASTE | VTR INT 23 | disponivel | disponivel |
| EMB-001 | ETPM FÁTIMA | embarcacao | ETP-M | CMASM-08 | CMASM-08 (correto) | EMBarcacao 8 | **indisponivel** (corrigido) | disponivel (errado — PDF diz INOP: aquecimento) |
| EMB-002 | LANCHA NATAL | embarcacao | LEG-M | CMASM-05 | CMASM-05 (correto) | EMBarcacao 5 | sobreaviso (mantido — status de domínio próprio do módulo, não do PDF) | sobreaviso |
| EMB-003 | SARGENTO FREITAS | embarcacao | BPAb | CMASM-10 | CMASM-10 (correto) | EMBarcacao 10 | disponivel | disponivel |

As três lacunas de identificação do relatório anterior (VTR-003, VTR-004, VTR-005) **foram resolvidas** — as placas existiam no mapa, só não estavam no CSV de viagens.

### 4.2 Embarcações acrescentadas pela migração 24 (7)

| Código | Nome | Placa/Ref. | Ref. no PDF | Status | Restrição (PDF) |
|---|---|---|---|---|---|
| EMB-004 | LR-M-NP CISNE | CMASM 01 | EMBarcacao 1 | indisponivel | NEC revisão geral do motor |
| EMB-005 | ETP RAPOSO | CMASM 03 | EMBarcacao 3 | indisponivel | Fora da água — falha no motor, carburador |
| EMB-006 | ECSR-P PÓLUX | CMASM 06 | EMBarcacao 6 | indisponivel | Fora da água — falha no motor; parte estrutural avariada |
| EMB-007 | BPAb BACAMARTE | CMASM 09 | EMBarcacao 9 | indisponivel | Manutenção corretiva do sistema de descarga dos gases do motor |
| EMB-008 | BPAb MIGUEL DOS SANTOS | CMASM 11 | EMBarcacao 11 | disponivel | — |
| EMB-009 | ECSR-P SERRA | CMASM 12 | EMBarcacao 12 | indisponivel | Fora da água — motor, rabeta e parte estrutural |
| EMB-010 | ETP-NP BAIONETA | DSAM 01 | EMBarcacao DSAM 01 | indisponivel | Sistema de governo e avaria no esticador da correia poli V — **nota: ativo pertence à DSAM, não à CMASM, mas consta no mesmo mapa; importado como está, sem alteração de propriedade** |

Refs. 2, 4 e 7 do mapa não existem — não há embarcação com esses números de referência no PDF, então nada ficou de fora.

### 4.3 Viaturas externas (VTR EXT) acrescentadas pela migração 24 (6)

| Código | Nome | Placa | Ref. no PDF | Status | Restrição (PDF) |
|---|---|---|---|---|---|
| VTR-007 | FRONTIER | KOU 6C24 | VTR EXT 1 | disponivel | — |
| VTR-008 | CLIO | LPC 2935 | VTR EXT 3 | indisponivel | Necessidade de manutenção corretiva no sistema de injeção |
| VTR-009 | MICRO-ÔNIBUS | LBO 8418 | VTR EXT 6 | indisponivel | LVAD |
| VTR-010 | CAMINHÃO IVECO DAILY | LLV 6081 | VTR EXT 7 | indisponivel | NEC MNT no sistema de combustível |
| VTR-011 | CAMINHÃO MUNCK IVECO VERTIS | KPJ 8382 | VTR EXT 8 | indisponivel | NEC MNT sistema de freio e carroceria |
| VTR-012 | FIAT DUCATO | JKH 9973 | VTR EXT 9 | indisponivel | **"P" no mapa, mas INOP na realidade — resolvido pelo usuário, ver Seção 5** |

**Nota de desambiguação:** VTR-011 (KPJ 8382) e VTR-001 (KPJ8385) são dois "Caminhão Munck – Iveco Vertis" **diferentes**, distinguidos pela placa. Não são o mesmo ativo duplicado.

### 4.4 Viaturas internas (VTR INT) acrescentadas pela migração 24 (21)

| Código | Nome | Placa | Ref. no PDF | Unidade | Status | Restrição (PDF) |
|---|---|---|---|---|---|---|
| VTR-013 | DOBLO 1.8 | LKT 5636 | VTR INT 10 | km | indisponivel | INOP (sem detalhe adicional no mapa) |
| VTR-014 | SAVEIRO | LPD 8627 | VTR INT 11 | km | indisponivel | Avaria na descarga; reparo pela equipe de apoio |
| VTR-015 | CAMINHÃO BOMBEIRO | LQP 7633 | VTR INT 13 | km | disponivel | — |
| VTR-016 | CAMINHÃO VW 7100 | LCE 6221 | VTR INT 14 | km | indisponivel | Sistema de embreagem |
| VTR-017 | EMPILHADEIRA JTC "Jumenta" | *(sem placa no mapa)* | VTR INT 16 | h | indisponivel | Manutenção corretiva no sistema de carburação |
| VTR-018 | EMPILHADEIRA YALE "Brocoió" | *(sem placa no mapa)* | VTR INT 17 | h | indisponivel | INOP (sem detalhe adicional no mapa) |
| VTR-019 | EMPILHADEIRA XGMA "Enguia" | *(sem placa no mapa)* | VTR INT 18 | h | indisponivel | INOP (sem detalhe adicional no mapa) |
| VTR-020 | EMPILHADEIRA XGMA "Poraquê" | *(sem placa no mapa)* | VTR INT 19 | h | indisponivel | INOP (sem detalhe adicional no mapa) |
| VTR-021 | TRATOR AGRALE "Taturana" | *(sem placa no mapa)* | VTR INT 20 | h | disponivel | — |
| VTR-022 | TRATOR AGRALE "Batoré" | *(sem placa no mapa)* | VTR INT 21 | h | indisponivel | INOP (sem detalhe adicional no mapa) |
| VTR-023 | GUINDASTE GROVE | *(sem placa no mapa)* | VTR INT 22 | h | indisponivel | INOP (sem detalhe adicional no mapa) |
| VTR-024 | CARRO ELÉTRICO | *(sem placa no mapa)* | VTR INT 24 | km | disponivel | — |
| VTR-025 | SEMI-REBOQUE 12T GIRO 180° | *(sem placa no mapa)* | VTR INT 25 | km (sem controle de uso) | disponivel | — |
| VTR-026 | SEMI-REBOQUE 12T GIRO 90° | *(sem placa no mapa)* | VTR INT 26 | km (sem controle de uso) | disponivel | — |
| VTR-027 | SEMI-REBOQUE 500KG "Tico" | *(sem placa no mapa)* | VTR INT 27 | km (sem controle de uso) | disponivel | — |
| VTR-028 | SEMI-REBOQUE 500KG "Teco" | *(sem placa no mapa)* | VTR INT 28 | km (sem controle de uso) | disponivel | — |
| VTR-029 | TOYOTA | LBO 9668 | VTR INT 29 | km | disponivel | 06AGO — VRF com a segurança que a VTR está P |
| VTR-030 | TRATOR SOLIS "Besouro" | *(sem placa no mapa)* | VTR INT 30 | h | indisponivel | Combustível, embreagem e motor |
| VTR-031 | TRATOR SOLIS "Formigão" | *(sem placa no mapa)* | VTR INT 31 | h | indisponivel | Combustível e embreagem |
| VTR-032 | KOMBI | LKN 1629 | VTR INT 32 | km | indisponivel | INOP (sem detalhe adicional no mapa) |
| VTR-033 | QUADRICICLO | *(sem placa no mapa)* | VTR INT 33 | km | indisponivel | Necessita manutenção no sistema de combustível |

Os 43 ativos batem individualmente com o PDF — código de referência, nome, placa (quando existe), estado operacional e restrição, todos conferidos linha a linha por este executor contra o documento fornecido pelo usuário (`/home/luc/DEV_reference_readonly/Mapa de VTR e EMB ATU 20FEV26.pdf`, referência somente leitura).

## 5. Lacunas identificadas — reinterpretadas

**A natureza da seção mudou.** No relatório anterior, "lacunas de identificação" significava 3 ativos sem placa registrada, tratados como possível falha documental a resolver. Com o PDF real como fonte, ficou claro que **16 ativos não têm placa porque o próprio mapa os registra como "XXX"** — não é uma lacuna do processo de import, é a realidade desses equipamentos (eles não circulam em via pública e não são emplacados):

| Categoria | Quantidade | Ativos |
|---|---|---|
| Empilhadeiras | 4 | VTR-017, VTR-018, VTR-019, VTR-020 |
| Tratores | 4 | VTR-021, VTR-022, VTR-030, VTR-031 |
| Guindastes | 2 | VTR-006, VTR-023 |
| Semi-reboques | 4 | VTR-025, VTR-026, VTR-027, VTR-028 |
| Carro elétrico | 1 | VTR-024 |
| Quadriciclo | 1 | VTR-033 |
| **Total** | **16** | |

Nenhum identificador foi inventado para esses 16 — `identificacao` fica `null` (nunca a string `'XXX'` do PDF, que é uma marcação do documento, não um valor de placa).

**Pendência aberta, registrada sem resolução (por decisão explícita do coordenador):**

> **VTR-012 (FIAT DUCATO, placa JKH 9973)** está marcado **"P"** (disponível) no mapa, mas a mesma linha traz a restrição: *"NEC manutenção corretiva e preventiva de motor, suspensão e ar-condicionado. A VTR está na Empresa JOMAP (Oficina) para delineamento. Retorno ASD."* — ou seja, o mapa diz "disponível" e "na oficina" ao mesmo tempo. A migração 24 importou inicialmente como `status = 'disponivel'`, seguindo literalmente a coluna de estado operacional.
>
> **RESOLVIDO em 10/08/2026.** O usuário confirmou que a viatura está **inoperante**. `status` corrigido para `'indisponivel'` no banco e na migração 24 (commit `33fc6db`), com a origem da divergência registrada em `observacoes`. A correção foi feita tanto no `insert` quanto num `update` próprio, porque o `insert` usa `on conflict do nothing` e sozinho não alcançaria um banco que já tem a linha.
>
> Vale como precedente: **o mapa não é infalível na coluna de estado operacional.** Onde a coluna de restrições contradiz o "P", a restrição tende a ser a informação mais atual.

## 6. Idempotência das migrações de import

**Seed 11** — conflito resolvido por chave natural, como já registrado antes:
- `transp_ativos`: `on conflict (codigo) do update` (`supabase/11_transportes_seed.sql`, linhas 7–34)
- `transp_viagens`: `on conflict (chave_importacao) do update` (linhas 36–115)

**Migração 24** (nova) — mesmo padrão, com uma variação:
- Os 34 ativos novos usam `on conflict (codigo) do nothing` (`supabase/24_transportes_inventario_completo.sql`, linhas 58–101) — reexecutar não duplica nem sobrescreve com valores mais antigos.
- As correções aos 9 ativos existentes (placas, status, `subtipo`/`tipo_modelo`) são `update ... where codigo = '...'` diretos (linhas 30–55) — idempotentes por natureza (reexecutar produz o mesmo resultado).

Reexecutar tanto o seed 11 quanto a migração 24, em qualquer ordem relativa entre si (a 24 depende apenas de a 10/11 já terem rodado), não duplica ativos nem viagens.

## 7. Divergências e conclusão

**Divergência grave encontrada e corrigida nesta conferência:** o inventário importado pelo seed 11 media apenas 21% da frota real (9 de 43 ativos) porque foi construído a partir de um registro de viagens, não do inventário. A migração 24 corrigiu isso — aplicada e conferida em produção antes deste relatório ser reescrito.

**Após a correção, zero divergência restante** entre `transp_ativos` (43 linhas) e o PDF do mapa: todos os códigos, nomes, placas, estados operacionais e restrições batem linha a linha. A única contradição presente na própria fonte (VTR-012) foi resolvida pelo usuário em 10/08/2026 — ver Seção 5. O banco diverge do mapa nesse único ponto, deliberadamente, porque o mapa está desatualizado ali.

**Ainda não afirmado:** este documento **não declara TRANSP-09 nem TRANSP-01 concluídos**. A conclusão depende de nova validação humana — agora sobre os 43 ativos, não mais sobre os 9 do relatório anterior. Ver `01-04-SUMMARY.md` para o registro completo desta correção como desvio do plano original.

---

## Não regressão da produção

### 1. Isolamento de arquivos

Commit base da fase: `67bef6e`. Comando executado: `git diff --name-only 67bef6e..HEAD -- refrigeracao maquinas shared`.

**Resultado observado (não vazio):**
```
shared/arvore.js
shared/modulo-manutencao.js
shared/persistencia.js
shared/pmoc.css
shared/vencimento.js
```

**Análise:** os cinco arquivos acima são **adições** (`git diff --name-status` confirma status `A`, não `M`) feitas por fases já concluídas e anteriores a este plano — o núcleo comum `shared/modulo-manutencao.js` e afins, criado para os módulos Elétrica/Fonoclama/Predial (decisão registrada em `STATE.md`: "elétrica e fonoclama compartilham o motor `shared/modulo-manutencao.js`"). **Nenhum arquivo pré-existente de Refrigeração, Máquinas ou `shared/auth.js` foi modificado:**

```
$ git diff --name-status 67bef6e..HEAD -- shared/auth.js
(vazio — shared/auth.js intocado)

$ git diff --name-status 67bef6e..HEAD -- maquinas refrigeracao
(vazio — maquinas/ e refrigeracao/ intocados)
```

O gate estático literal do plano (`test -z "$(git diff --name-only 67bef6e..HEAD -- refrigeracao maquinas shared)"`) **não passa como escrito**, porque o commit base `67bef6e` antecede não só esta fase, mas também as fases já concluídas de Elétrica, Fonoclama e Predial (fora do roadmap desta fase), que legitimamente adicionaram arquivos novos sob `shared/`. A checagem relevante para a garantia de não regressão — que **nenhum arquivo de Refrigeração/Máquinas/`shared/auth.js` foi alterado** — passa integralmente quando restrita a esses caminhos específicos (comandos acima). Divergência do gate registrada aqui em vez de ser escondida ou o gate reescrito silenciosamente.

**Alterações de código restritas a esta fase (Plano 01-01 a 01-04):**
```
transportes/app.js
transportes/index.html
supabase/22_transportes_planos_rbac.sql
supabase/23_transportes_estoque_os.sql
supabase/24_transportes_inventario_completo.sql
```
A migração 24 não estava prevista no plano original — é o desvio central desta Task, registrado em `01-04-SUMMARY.md`. Nenhum outro arquivo de código do módulo Transportes ficou fora dessa lista, e `transportes/app.js`/`transportes/index.html` não foram alterados por esta rodada de correção (conforme instrução explícita do coordenador).

### 2. Isolamento das migrações

Varredura de `supabase/22_transportes_planos_rbac.sql`, `supabase/23_transportes_estoque_os.sql` e `supabase/24_transportes_inventario_completo.sql`, ignorando comentários:

- Referência a objetos de outros módulos (`maq_`, `equipamentos`, `arp_`, `os_contratacao`, `campanhas`, `plano_tarefas`): **0 ocorrências**.
- Remoção destrutiva (`drop table|column|schema|database`): **0 ocorrências**.

As três migrações usam apenas `create table if not exists`, `create index if not exists`, `create or replace function` (só na 22, não redefinida depois), `alter table ... add column if not exists`, `update ... where codigo = ...` (só na 24, sobre linhas do próprio módulo), `insert ... on conflict do nothing/do update` e `grant`.

### 3. Prefixação dos objetos novos

Todos os objetos criados nas migrações 22, 23 e 24 usam o prefixo do módulo (`transp_`) ou operam sobre tabelas já prefixadas (a migração 24 não cria objeto novo, só `insert`/`update` em `transp_ativos`, tabela criada na migração 10):

| Tipo | Nome | Migração |
|---|---|---|
| Tabela | `transp_planos` | 22 |
| Tabela | `transp_materiais`, `transp_plano_materiais`, `transp_estoque_movimentos` | 23 |
| Função | `transp_pode_escrever()` | 22 |
| Índice | `transp_planos_tipo_modelo_idx` | 22 |
| Índice | `transp_plano_materiais_plano_id_idx`, `transp_plano_materiais_material_id_idx`, `transp_estoque_movimentos_material_id_idx`, `transp_estoque_movimentos_manutencao_id_idx`, `transp_manutencoes_plano_id_idx` | 23 |
| Policy | `sel_/ins_/upd_/del_transp_planos` | 22 |
| Policy | `sel_/ins_/upd_/del_transp_materiais`, `sel_/ins_/upd_/del_transp_plano_materiais`, `sel_/ins_/upd_/del_transp_estoque_movimentos` | 23 |
| DML sobre `transp_ativos` (sem objeto novo) | 43 linhas (9 `update`, 34 `insert`) | 24 |

Nenhum objeto sem o prefixo `transp_`/`sel_transp_`/`ins_transp_`/`upd_transp_`/`del_transp_` foi criado. Zero risco de colisão de nome com objetos de Refrigeração ou Máquinas (Pitfall 6 do `01-RESEARCH.md`).

### 4. Rotas publicadas (INTEG-02)

`vercel.json` continua declarando as três rotas originais, mais as três adicionadas por fases posteriores (fora do escopo desta conferência):
```json
{ "source": "/refrigeracao", "destination": "/refrigeracao/index.html" },
{ "source": "/maquinas",     "destination": "/maquinas/index.html" },
{ "source": "/transportes",  "destination": "/transportes/index.html" },
{ "source": "/eletrica",     "destination": "/eletrica/index.html" },
{ "source": "/fonoclama",    "destination": "/fonoclama/index.html" },
{ "source": "/predial",      "destination": "/predial/index.html" }
```
`index.html` (portal) mantém `href="/transportes"` no cartão do módulo. **Conferido.**

### 5. Carga dos módulos em produção (INTEG-04)

Servidor local subido na raiz do repositório (`python3 -m http.server`). Verificação possível nesta sessão (sem navegador interativo disponível):

- `node --check maquinas/app.js` → sintaxe OK
- `node --check transportes/app.js` → sintaxe OK
- `node --check shared/auth.js` → sintaxe OK
- `curl http://localhost:8123/refrigeracao/` → HTTP 200
- `curl http://localhost:8123/maquinas/` → HTTP 200
- `curl http://localhost:8123/transportes/` → HTTP 200

**Verificação pendente, registrada explicitamente (não afirmada como aprovada):** a checagem de console do navegador sem erros (carregamento real do Supabase, renderização da lista de equipamentos/ativos) **não foi executada nesta sessão**, porque não há ferramenta de navegador interativo disponível neste ambiente de execução. Os três módulos servem os arquivos estáticos corretamente e o JavaScript não tem erro de sintaxe, mas a confirmação final de "carrega sem erro no console" fica registrada como pendência.

### 6. Remote de deploy (Pitfall 7)

```
$ git remote -v
origin  https://github.com/luctronics-ET/pmoc.git (fetch)
origin  https://github.com/luctronics-ET/pmoc.git (push)
```

O remote configurado neste diretório de trabalho é `luctronics-ET/pmoc`. Documentação histórica do projeto já citou anteriormente um repositório diferente (`luctronicserp/pmoc`); `CLAUDE.md` já foi corrigido para refletir `luctronics-ET/pmoc` como o repositório correto que dispara o deploy Vercel. **Nada foi alterado aqui** — apenas o valor observado fica registrado. O usuário precisa conferir no painel do Vercel qual repositório GitHub está de fato conectado ao projeto de produção (`pmoc-orcin.vercel.app`) antes de considerar as mudanças desta fase publicadas.

### Conclusão da não regressão

- Refrigeração, Máquinas e `shared/auth.js`: **intocados** desde o commit base (confirmado por comando restrito, acima).
- Migrações 22, 23 e 24: **isoladas**, sem referência a outros módulos, sem remoção destrutiva.
- Objetos novos: **100% prefixados** com `transp_`; a migração 24 só grava dados em tabela já existente e prefixada.
- Rotas e portal: **conferidos**.
- Carga estática + sintaxe: **conferida**; carga end-to-end no navegador (Supabase real): **pendente**, não executável nesta sessão.
- Remote de deploy: **registrado**, divergência de documentação histórica já resolvida em `CLAUDE.md`; confirmação no painel do Vercel é do usuário.
