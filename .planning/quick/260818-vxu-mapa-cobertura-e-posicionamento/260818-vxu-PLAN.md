---
id: 260818-vxu
slug: mapa-cobertura-e-posicionamento
date: 2026-08-18
tipo: quick
branch: mapa-cobertura-e-posicionamento
migracao: nenhuma
---

# Quick 260818-vxu — Mapa: cobertura, posicionamento por prédio, UX e zonas sem contorno

## Por que

O mapa saiu da Fase 10 funcionando, mas com dado real ele mostra pouco:

| Fato medido (18/08/2026, banco de produção) | Número |
|---|---|
| Ativos posicionados | 15 de 270 (8 `maq_ativos`, 7 `elet_ativos`) |
| Famílias sem camada nenhuma | `transp_ativos` 43, `fono_ativos` 15, `equipamentos` 171 = **229 invisíveis** |
| `cmasm_locais` com coordenada | **0 de 311** — a camada herdada de `resolverPosicao` nunca dispara |
| Ativos ligados a um local | 190, em 138 locais distintos |
| `maq_areas` com `geom` | **0 de 3** |
| Boot | `modules: []` — abre vazio |

Duas consequências concretas:

1. **A arquitetura de duas camadas está pela metade.** `resolverPosicao` (própria vence herdada) existe desde o plano 10-01, mas só há porta de entrada para a posição *própria*: `salvarPosicaoAtivo`. Sem nenhuma porta para `cmasm_locais.lat/lon`, a herança é código morto e cada ativo tem que ser posicionado um a um — 270 atos de campo em vez de ~138 (e, na prática, muito menos: os prédios grandes concentram dezenas).
2. **As 3 zonas de `maq_areas` são inalcançáveis.** `carregarZonasEditaveis` pula quem tem menos de 3 vértices (`mapa-editor.js:206`), e `aoCriarPoligono` sempre abre o painel em modo `criar` → `insert`. Quem desenhar por cima cria uma quarta linha em vez de dar contorno à existente.

## Escopo — 4 frentes

### F1 · Posicionar prédio (destrava a herança)
- `mapa/mapa-dados.js`: `carregarLocaisSemPosicao()` (uma consulta a `cmasm_locais`, `ativo = true`, `lat is null`) e `salvarPosicaoLocal(id, lat, lon)`.
- `salvarPosicaoLocal` grava **só** `cmasm_locais`, valida pelo mesmo `dentroDoEnvelope` do núcleo puro antes de qualquer viagem de rede, e grava `lat`/`lon` no mesmo `.update({...})` — as três propriedades que `tests/mapa-posicionamento.test.js` já afirma sobre `salvarPosicaoAtivo`.
- Cargo: `CARGOS_POSICAO` (já exportada, declarada uma vez só — o gate proíbe redeclarar).
- Contagem de ativos por prédio sai de `NAO_LOCALIZADOS`, **sem consulta nova**: um ativo sem posição própria e sem posição herdada está exatamente na lista, e o `local_id` dele diz qual prédio o acenderia. Ordena por essa contagem desc.
- Barra lateral: seção "Prédios sem posição" com campo de busca (311 locais não cabem numa lista) e o mesmo modo de espera-de-clique já existente no editor.

### F2 · Três famílias novas
- `TABELA_POR_MODULO` += `transportes → transp_ativos`, `fonoclama → fono_ativos`, `refrigeracao → equipamentos` (lista fechada, nome de tabela nunca concatenado).
- `equipamentos` **não tem** `ativo`, `codigo`, `nome` nem `status` — tem `predio`, `local`, `tipo`, `funciona` (`OK`/`NOK`), `estado` (`NOVA`/`SEMI`/`VELHA`), `patrimonio`, `local_id`, `lat`, `lon`. Por isso a carga passa a ler de um `CONFIG_POR_MODULO` (coluna de filtro-ativo, coluna de rótulo, coluna de estado, coluna de subtipo) em vez de colunas fixas.
- Camada **genérica** nova, `mapa/xmap-layers-ativos.js`, com uma função de registro por módulo — não três arquivos copiados de `xmap-layers-eletrica.js`.
- `refrigeracao` não está em `MODULOS` (`mapa-geometria.js`): sem rota de ficha, `linkDoModulo` devolve `null` e o balão só omite a linha. Nada a fazer.

### F3 · UX
- Vocabulário de estado unificado no núcleo puro (`mapa-geometria.js`): `ESTADOS` (lista fechada operante/manutenção/inoperante/baixado, com rótulo e cor) e `normalizarEstado(modulo, valor)` fazendo a ponte de cada vocabulário de banco. Substitui as três pontes duplicadas de hoje (`statusParaExibicao` na grama, `estadoParaExibicao` na elétrica) — uma lista, cinco chamadores.
- Mapa abre com as camadas ligadas, não com `modules: []`.
- Busca que voa até o ativo, sobre `POSICIONADOS` (acumulada em `mapa-dados.js` do mesmo jeito que `NAO_LOCALIZADOS`).
- Legenda de estado/cor lida do mesmo `ESTADOS` — nunca hex escrito à mão na marcação.

### F4 · Zonas sem contorno
- Barra lateral lista as zonas de `maq_areas` sem `geom`, com botão "Desenhar" (cargo `CARGOS_ZONA`, admin/gestor).
- O botão **arma** o desenho para aquela linha: o próximo polígono concluído abre o painel em modo `editar` com o `id` dela → `atualizarZona`, não `salvarZona`.
- **Não inventar coordenada.** Geometria de zona é ato de campo; o plano só abre o caminho.

## Fora de escopo
- Migração — todas as colunas vêm da 25, já aplicada.
- Posicionar em massa a partir da planta vetorial: os 12 nomes do extrato OSM (CON, CB01-03, CIE, CAV, CBIF, ETE, píeres) não casam com os nomes de `cmasm_locais` (COMANDO, F21, MK48, EXOCET…).
- `mapa/xmap.js` (travado), aguada (D-01), telha local de satélite (D-02), estimativa por zona (D-04).

## Tarefas

1. **Núcleo puro + camada de dados** — `mapa-geometria.js` (`ESTADOS`, `normalizarEstado`), `mapa-dados.js` (3 módulos novos, `CONFIG_POR_MODULO`, `POSICIONADOS`, `carregarLocaisSemPosicao`, `salvarPosicaoLocal`).
2. **Camadas** — `xmap-layers-ativos.js` novo; grama e elétrica passam a usar `normalizarEstado`/`ESTADOS`.
3. **Editor** — alvo de posicionamento `ativo|local`; desenho armado para zona existente.
4. **Tela** — `app.js` + `index.html`: 3 botões novos, prédios sem posição (busca), zonas sem contorno, busca de ativo, legenda, camadas ligadas no boot.
5. **Gates** — ampliar a lista de tabelas previstas em `tests/mapa-editor.test.js` (crescimento deliberado do inventário) e criar `tests/mapa-cobertura.test.js`.

## Verificação
- `node --test` inteiro verde (gates de mapa: camadas, editor, posicionamento, decisões, base-offline, deep-link, geometria, schema).
- Nenhuma `.from(` fora de `mapa/mapa-dados.js`; total de `.insert(` do módulo continua **1** (zona).
- `mapa/index.html` continua sem declarar token de cor além de `--accent`.
