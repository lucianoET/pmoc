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
| `/refrigeracao` | **PMOC Refrigeração** v2.8 | 175 unidades · OS unificada por tipo de executor · ARP 04/2024 · carga térmica · estoque · acervo de normas · QR | ✅ |
| `/maquinas` | **PMOC Máquinas** v1.1 | 28 máquinas · 59 planos · 35 peças · operações · necessidades e compras · contratações | ✅ |
| `/transportes` | **PMOC Transportes** v1.0 | 43 ativos · 23 viagens · planos, estoque, OS e lista de compras | ✅ |
| `/eletrica` | **PMOC Elétrica** v1.0 | 13 ativos · geradores, QGBT, nobreaks, iluminação | ✅ |
| `/fonoclama` | **PMOC Fonoclama** v1.0 | 15 ativos · PA 70V | ✅ |
| `/predial` | **PMOC Predial** v1.0 | 3 templates · 223 itens de checklist · GUT · laudos · 20 normas | ✅ |
| `/reparos` | **PMOC Reparos** v1.0 | 7 modelos · 25 serviços · 34 reparos — sintoma → causa provável | ✅ |
| `/calibracao` | **Controle de Calibração** | 38 instrumentos · 8 laboratórios · 12 PS · 2 lotes | ✅ |
| `/equipes` | **PMOC Equipes** v1.0 | 8 ofícios · 2 turnos · escala semanal e capacidade | ⚠️ sem pessoas cadastradas |
| `/gestao` | **PMOC Gestão** v1.0 | Painel NBR 5674 · ações 5W2H com GUT · calendário consolidado · ferramentas da qualidade · POP | ✅ |
| `/mapa` | **Mapa CMASM** v1.0 | Leaflet · 5 camadas de ativos · zonas, prédios e planta vetorial | ✅ |

O portal lista onze rotas; `/reparos` não aparece nele por decisão de projeto — o catálogo
de diagnóstico é alcançado de dentro de `/maquinas`, que é onde a OS corretiva é aberta.

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
`docs/historico/planning/phases/01-transportes-frota-sob-manuten-o/01-CONFERENCIA-IMPORT.md`.

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

### Reparos
Catálogo sintoma → causa provável, chaveado no **modelo** da máquina (`rep_modelos`),
não no ativo. Complementa Máquinas: lá o gatilho é o horímetro (determinístico), aqui
é o sintoma relatado (probabilístico, ranqueado). `rep_reparos.frequencia` sobe pelo RPC
`rep_confirmar_reparo` quando o mecânico confirma a causa ao fechar a OS corretiva, de
modo que a lista deixa de ser alfabética e passa a refletir o que falha nesta oficina.

### Calibração
App legado independente (React 18 embutido, sidebar e tema próprios, 11 páginas).
Migrado do `localStorage` para o Supabase em 18/08/2026 (migrações 35 e 36) e com login
por cargo desde 19/08/2026 (migração 39). Fica fora da base comum por decisão — não usa
`shared/tema.js` nem `shared/shell.js`, mas importa o `Auth` compartilhado.

### Equipes
Quem executa a manutenção: pessoas, ofícios, equipes, turnos e escala semanal, mais o
confronto entre a capacidade escalada e a demanda que o plano preventivo real
(`plano_tarefas`) obriga. Tabelas com prefixo `cmasm_` porque atravessam módulos.
Nenhuma pessoa é semeada — nome de militar é dado real da OM.

---

## Dados em produção

| Tabela | Registros |
|--------|-----------|
| `equipamentos` | 175 (137 OP · 37 INOP · 1 OR) — todos `instalado` |
| `logs_manutencao` | 8 OS (7 contrato · 1 interna) |
| `os_itens` | 27 |
| `arp_itens` | 19 (R$ 66.447,86 empenhados) |
| `os_contratacao` | 0 — **dormente** desde a migração 43 (OS unificada), sem `drop` |
| `plano_tarefas` | 9 (NBR 17037) |
| `servicos` | 9 · `servico_materiais` 0 |
| `materiais` | 0 (catálogo de estoque ainda vazio) · `estoque_movimentos` 0 |
| `maq_ativos` | 28 · `maq_planos` 59 · `maq_materiais` 35 |
| `maq_areas` | 19 (17 ativas) |
| `transp_ativos` | 43 (33 viaturas · 10 embarcações) · `transp_viagens` 23 |
| `transp_planos` | 0 (aguardando cadastro) · `transp_materiais` 0 |
| `elet_ativos` | 13 · `fono_ativos` 15 |
| `pred_checklist_templates` | 3 · `pred_checklist_itens` 223 · `pred_inspecoes` 1 · `pred_laudos` 1 |
| `pred_normas` | 20 · `cmasm_documentos` 18 |
| `rep_modelos` | 7 · `rep_servicos` 25 · `rep_reparos` 34 |
| `cal_equipamentos` | 38 · `cal_labs` 8 · `cal_ps` 12 · `cal_lotes` 2 |
| `cmasm_locais` | 312 (106 com coordenada) · `cmasm_estrutura` 78 |
| `cmasm_especialidades` | 8 · `cmasm_turnos` 2 · `cmasm_parametros` 2 |
| `cmasm_pessoas` | 0 · `cmasm_equipes` 0 · `cmasm_alocacoes` 0 |

Conferido pela API REST com a `anon key` em 02/09/2026. As tabelas com zero não estão
quebradas — são cadastros que ainda não foram preenchidos; ver **Pendências**.

---

## Estrutura

```
pmoc/
├── index.html                 Portal
├── vercel.json                Rewrites de rota (11 módulos)
├── refrigeracao/
│   ├── index.html             v2.8 — single-file, ~860 KB (CSS + JS embutidos)
│   ├── qrcode.js  manifest.json  icone-*.png
│   └── vendor/                Font Awesome 5.15.4 hospedado (css/ + webfonts/ irmãos)
├── maquinas/
│   ├── index.html
│   ├── app.js                 Aplicação e acesso ao Supabase
│   ├── operacoes.js           Regras testáveis de operações e agenda
│   ├── estoque-tabela.js      Colunas do Estoque (adapta shared/tabela.js)
│   ├── areas-tabela.js        Colunas das Áreas Vegetais
│   └── contratacoes.js        Etapas da contratação (usa shared/fluxo.js)
├── transportes/  index.html + app.js    Frota mista, viagens, planos, estoque e OS
├── eletrica/     index.html + app.js    Configuração do módulo (tabelas elet_)
├── fonoclama/    index.html + app.js    Configuração do módulo (tabelas fono_)
├── predial/
│   ├── index.html + app.js    Inspeção, checklist GUT e laudos (tabelas pred_)
│   └── dominio.js             Regras testáveis: faixas GUT e árvore de locais
├── reparos/
│   ├── index.html + app.js    Catálogo sintoma → causa provável (tabelas rep_)
│   └── tabelas.js             Definições de coluna das três tabelas
├── calibracao/
│   ├── index.html             App legado, React 18 embutido (~1 MB)
│   └── gerar-seed.mjs         Gera a migração 36 a partir do próprio HTML (rodado à mão)
├── equipes/
│   ├── index.html + app.js    Pessoas, ofícios, equipes, turnos e escala (tabelas cmasm_)
│   └── nucleo.js              Núcleo puro: capacidade, demanda e escopo de plano
├── gestao/
│   └── index.html + app.js    Painel, ações 5W2H+GUT, calendário consolidado, ferramentas e POP (tabelas ges_)
├── mapa/
│   ├── index.html + app.js
│   ├── xmap.js / xmap.css     Componente Leaflet portado do legado (travado, sem edições)
│   ├── xmap-layers-*.js       Camadas (ativos genérica, prédios, grama, elétrica, aguada)
│   ├── xmap-marcadores.js     Agrupamento por ponto, rótulos e popups
│   ├── mapa-dados.js          Porta única de leitura/escrita no Supabase
│   ├── mapa-geometria.js      Núcleo puro: área geodésica, herança de posição, vocabulários
│   ├── mapa-editor.js         Desenho de zona e posicionamento de ativo/prédio
│   ├── mapa-exportar.js       Exportação GeoJSON · mapa-planta.js  planta de referência
│   ├── planta-cmasm.geojson   Planta vetorial (117 feições) · gerar-planta.mjs (rodado à mão)
│   ├── vendor/                Leaflet 1.9.4 + leaflet-draw hospedados
│   └── tiles/                 Tiles raster locais, opcionais (ver GERAR-TILES.md)
├── shared/
│   ├── auth.js                Login por cargo (reutilizável)
│   ├── supabase-config.js     Configuração do Supabase e guarda de SDK ausente
│   ├── pmoc.css               Estilo comum dos módulos novos
│   ├── shell.js               Cabeçalho, abas e rodapé (testado)
│   ├── tema.js                Tema claro/escuro das 7 superfícies
│   ├── icones.js              Conjunto único de 28 ícones SVG inline
│   ├── tabela.js              Ordenação e filtro por coluna (3 consumidores)
│   ├── fluxo.js               Núcleo de fluxo por definição de etapas
│   ├── componentes.js         Peças de tela com dois ou mais consumidores
│   ├── grafico.js             Gráficos SVG inline: barras, linha, Pareto, carta de controle, sparkline
│   ├── indicadores.js         Cartão de indicador com meta, semáforo e tendência
│   ├── gantt.js               Gantt em CSS grid, sem canvas
│   ├── abc.js                 Curva ABC genérica por campo de valor
│   ├── gut.js                 Matriz GUT (predial/dominio.js reexporta)
│   ├── kanban.js              Kanban por definição de colunas (Máquinas consome)
│   ├── calendario.js          Calendário mensal por eventos (Máquinas consome)
│   ├── arvore.js              Árvore de locais colapsável
│   ├── vencimento.js          Regra de vencimento por horímetro (testada)
│   ├── persistencia.js
│   └── modulo-manutencao.js   Motor de elétrica/fonoclama
├── supabase/                  60 migrações numeradas, aplicadas em ordem
│   ├── 01–09  máquinas, usuários, refrigeração, ARP, frota
│   ├── 10–13  transportes (schema e seed), áreas e operações de máquinas
│   ├── 14–16  elétrica e fonoclama
│   ├── 17–18  predial (18 é gerado por gerar_18_predial_seed.py)
│   ├── 19–21  cmasm_locais unificado e vínculo com os módulos
│   ├── 22–24  transportes: planos e RBAC, estoque e OS, inventário completo
│   ├── 25, 37 mapa: geometria e posição; contorno dos prédios
│   ├── 26–28  reparos (28 corrige o formato que a 26 não aplicou)
│   ├── 29–34  máquinas: itens e custos de OS, fluxo, ficha, compras
│   ├── 35–36, 39  calibração: schema, seed e RLS autenticada
│   ├── 38     máquinas: contratação de empresa
│   ├── 40–48  refrigeração: OS unificada, estoque, atributos, carga térmica, inspeção
│   ├── 49–51  equipes: schema, seed e parâmetros de plano
│   ├── 52–53  acervo de documentos (normas, formulários, conceitos)
│   ├── 54–55  refrigeração: serviços do plano e regra por tipo
│   ├── 56–59  checks de faixa e de grandezas físicas; deriva do /calibracao
│   └── 60     gestão e qualidade (ges_acoes, ges_indicadores, ges_pop, ges_causas)
├── tests/                     Gates automatizados (node --test tests/*.test.js)
├── ref/                       Fontes legadas: planilhas, PDFs, HTMLs originais
└── docs/historico/            Registros já resolvidos, e os artefatos GSD aposentados
    └── planning/              Ex-`.planning/` e ex-`.claude/CLAUDE.md` (ver LEIA-ME.md)
```

---

## Stack

Sem build, sem npm, sem framework. HTML + vanilla JS + Supabase JS SDK via CDN.
Leaflet e Font Awesome são **hospedados no repositório** (`mapa/vendor/`,
`refrigeracao/vendor/`) desde 02/09/2026; o SDK do Supabase e o SheetJS do
`/calibracao` continuam vindo de CDN.

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

Não há build, mas **abrir um `index.html` direto do disco (`file://`) não funciona** em
nenhum módulo: todos referenciam os próprios arquivos por caminho raiz-absoluto
(`/refrigeracao/qrcode.js`, `/mapa/vendor/leaflet.js`, …) para resolverem na rota que o
Vercel serve em produção, e caminho raiz-absoluto não tem significado sob `file://`.
Sirva a raiz do repositório por HTTP:

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

Conferido contra o banco de produção em **02/09/2026** pela API REST. As migrações
**01 a 55 estão todas aplicadas** — a lista anterior afirmava que a 44, a 45 e a 46
aguardavam aplicação, e isso deixou de ser verdade em 31/08/2026.

### 1. Dado de campo — é aqui que está o gargalo

Seis funcionalidades estão prontas, publicadas e com migração aplicada, mas mostram zero
porque o cadastro correspondente está vazio. Nenhuma delas depende de desenvolvimento novo.

- [ ] **Carga térmica não calcula para nenhum equipamento** — `area_m2` 0/175 e `tipo_uso`
      0/175. Sem área, o veredito de dimensionamento diz "não calculável", por construção.
      O caminho de carga em massa já existe: a planilha exportar/importar
      (quick-260822-5hy) carrega as sete colunas de ambiente, porque as colunas dela
      derivam de `EQUIP_EDITAVEIS` (D-5hy-06). Exportar → preencher em campo → importar.
- [ ] **EER não é publicado** — `corrente_nominal` 0/175. Sem corrente de placa a potência
      é estimada pela capacidade (BTU/h ÷ 3412 ÷ COP 3) e o EER sairia como uma constante,
      então ele é deliberadamente omitido (D-2wq-07). Entra pela mesma planilha.
- [ ] **Estoque de `/refrigeracao` sem catálogo** — `materiais` 0 linhas, logo
      `servico_materiais` 0 e `estoque_movimentos` 0: a baixa ao entrar em execução nunca
      foi exercida em produção. Cadastrar peça por peça na página Estoque.
- [ ] **`/equipes` sem o lado da oferta** — `cmasm_pessoas`, `cmasm_equipes` e
      `cmasm_alocacoes` com 0 linhas. Só a demanda calcula (2.027 h/ano sobre os 175
      equipamentos); a utilização devolve `null` enquanto não houver equipe escalada, por
      decisão (D-eq-12). Nenhuma pessoa é semeada de propósito (D-eq-06).
- [ ] **Atributos técnicos quase todos não avaliados** — `inverter` 20/175 marcados,
      `automacao` 2/175. O F21 ficou fora do seed 46 de propósito: quais das 6 centrais e
      dos 17 splits compõem o arranjo redundante é decisão do usuário.
- [ ] **Quatro máquinas existem no chão e não no cadastro** — PAIOL D-5 e K-6 têm uma cada,
      R-7 nenhuma. Entram por "Cadastrar novo equipamento", nunca por seed.
- [ ] `transp_planos` e `transp_materiais` seguem com 0 linhas.

### 2. Segurança — não endereçada

- [ ] **Senhas dos cargos ainda no `cmasm2026` inicial.** Trocar antes do uso operacional.
- [ ] **54 itens de dívida de segurança, nenhum endereçado** — RLS que aceita escrita de
      qualquer autenticado sem distinguir papel, bucket `os-fotos` público, conclusão de OS
      de Máquinas sem transação, auditoria gravada pelo cliente e sem CSP. Resumo em
      `CLAUDE.md` § Dívida de segurança; lista completa em
      `docs/historico/planning/BACKLOG-TECNICO.md`.

### 3. Negócio

- [ ] Divergência RLP: MCP R$ 43.467,13 × NE334 R$ 39.926,11 (dif. R$ 3.541,02)
- [ ] Centrais F21 são 30 TR; itens 1365/1366 aderidos são 12 TR — verificar aplicabilidade
- [ ] Valores de aquisição das máquinas são estimativas — ajustar com patrimônio real
- [ ] `plano_tarefas` ainda cita a **RE 09/2003 da ANVISA** como norma da tarefa de QAI;
      essa resolução foi substituída pela **NBR 17037:2023**. Correção de cadastro.
- [ ] `pred_inspecoes` tem 1 linha com dado de teste (`"ffffffffffffff ffff"`) em produção.

### 4. Plataforma

- [ ] **Fase 9 do roadmap não foi entregue, e a 8 foi entregue em parte (04/09/2026).** Kanban e
      calendário agora vivem em `shared/` e Máquinas os consome sem cópia (Onda A da Fase 13);
      falta o segundo consumidor, que chega com `/gestao` (Onda B, planejada em
      `docs/fase-13-gestao-qualidade/`). O critério da Fase 9 era "as 5 implementações
      independentes de CSV deixam de existir" e hoje são **6**. A Refrigeração segue com o
      calendário próprio de 31/08 — módulo congelado, decisão e não pendência.
- [x] ~~Decidir se o `.planning/` continua sendo mantido ou se o `CLAUDE.md` vira o registro
      único.~~ **Resolvido em 02/09/2026: o `CLAUDE.md` é o registro único.** O `.planning/`
      e o `/.claude/CLAUDE.md` gerado dele foram **arquivados** — não apagados, pela mesma
      regra que vale para o banco — em `docs/historico/planning/`, com o motivo em
      `LEIA-ME.md` de lá. O que ainda valia migrou antes: as fases 8, 9, 11 e 12 e as 54
      pendências de segurança agora vivem em `CLAUDE.md`.

### Não são pendências

- **`ref/seguranca.html`, `ref/paiol.html`, `ref/cftv.html` não são módulos a importar.**
  São launchers de 1–4 KB que redirecionam para sistemas externos autônomos
  (`127.0.0.1:8000/ui` em FastAPI, o webapp Java `xCFTV`, `/paiol/paiois.html`) e só
  resolvem na rede interna. Mesma categoria da camada `aguada` (D-01): importar
  significaria construir do zero, não portar.
- **`ref/xgrama.html`** (Controle Vegetal) já está absorvido por `/maquinas` — OS-Corte,
  `maq_areas`, `maq_operacoes` e abastecimentos — mais as zonas de vegetação do `/mapa`.
- **`ref/pmoc-engine.js`** (motor v8.3) foi portado em função onde interessava: `calcBTU`
  virou a carga térmica e `renderCalendar` virou o calendário de OS, ambos em 31/08/2026.
  Sobram os gráficos do dashboard (`donutSVG`, `barRows`) e o par `syncFromAPI`/`syncToAPI`,
  que não tem sentido aqui — o estado vive no Supabase, não em `localStorage`.

---

## Testes

Sem framework: `node:test` e `node:assert` apenas, sem `package.json`.

```bash
node --test tests/*.test.js
```

**1526 testes, todos passando em 05/09/2026.** São gates permanentes: cada decisão
travada tem um teste que reprova uma fase futura que a contradiga. O checklist de
verificação manual fica em `TESTES.md`.
