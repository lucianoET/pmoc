---
id: 260818-vxu
slug: mapa-cobertura-e-posicionamento
status: complete
date: 2026-08-18
branch: mapa-cobertura-e-posicionamento
migracao: nenhuma
testes: 342/342
---

# Quick 260818-vxu — Mapa: cobertura, posicionamento por prédio, UX e zonas sem contorno

## O que mudou, medido contra o banco de produção

| | Antes | Depois |
|---|---|---|
| Famílias de ativo no mapa | 2 (máquinas, elétrica) | **5** (+ transportes, fonoclama, climatização) |
| Ativos que o mapa enxerga | 41 | **270** |
| Lista de não localizados | 26 | **255** — o mapa parou de descartar 229 ativos em silêncio |
| Prédios posicionáveis pela tela | 0 (não havia porta) | **233**, ordenados por quantos ativos cada um acende |
| Zonas alcançáveis pelo editor | 0 de 3 | **3 de 3** |
| Camadas ligadas ao abrir | 0 | 5 (aguada continua desligada — é a única com dado de demonstração, D-01) |
| Pontes de vocabulário de estado | 3 cópias espalhadas | 1 lista fechada no núcleo puro |

## Decisões tomadas durante a execução

**D1 — chave `climatizacao`, não `refrigeracao`.** O gate `tests/mobile-375.test.js` (PLAT-15) proíbe a palavra `refrigeracao` em `mapa/index.html`: o app está congelado e não pode ser referenciado. O mapa lê a **tabela** `equipamentos`, não o app — a chave de módulo passou a se chamar `climatizacao`, o que também é coerente com `MODULOS` (`mapa-geometria.js`) não ter rota para ela: o balão sai sem link de ficha, exatamente o que a decisão protege.

**D2 — `CONFIG_POR_MODULO` no lugar de dois dicionários.** `equipamentos` não tem nenhuma das colunas comuns às outras quatro tabelas — sem `ativo`, sem `codigo`, sem `nome`, sem `status` (o estado dela é `funciona`, `OK`/`NOK`; a coluna literalmente chamada `estado` guarda a idade do aparelho). Com colunas fixas na consulta a única saída seria um `if` para climatização dentro de `carregarAtivosDoModulo`, e o próximo módulo com schema próprio traria o segundo. A forma da tabela virou dado.

**D3 — `sobreaviso` ganhou estado próprio (`standby`).** Dobrá-lo em `operante` ou `manutencao` apagaria da tela justamente a distinção que o despachante procura. O vocabulário canônico herdou o `standby` que só a camada legada de elétrica falava.

**D4 — uma camada por módulo, não uma por subtipo.** A elétrica registra quatro camadas porque tem quatro tipos fechados na migração. Aqui os subtipos são texto livre de banco antigo — gerar chave de camada a partir de texto de banco produziria painel de filtro instável, com camada nascendo e sumindo conforme o cadastro.

**D5 — não inventar coordenada para as 3 zonas.** Os 12 nomes do extrato OSM da planta vetorial (CON, CB01-03, CIE, CAV, CBIF, ETE, píeres) não casam com "Campo futebol A", "Entorno apoio" nem "Predio Comando". Geometria de zona é ato de campo; a task abriu o caminho (botão "Desenhar" que **atualiza** a linha existente em vez de inserir a quarta) e parou aí.

**D6 — o desvio entre as duas portas de escrita mora no chamador.** `salvarPosicaoAtivo` continua proibida de tocar `cmasm_locais` (D-03) e `salvarPosicaoLocal` não referencia nenhuma tabela de ativo. O `if (alvo.tipo === 'local')` fica em `aoClicarParaPosicionar`, para nenhuma das duas virar uma função que decide sozinha em qual tabela escrever. Gate afirma as três coisas.

## Achado durante a execução — um gate tinha ficado cego

`tests/mapa-editor.test.js` afirmava que `mapa-dados.js` só fala com as tabelas previstas varrendo `.from('...')` literal. Quando `CONFIG_POR_MODULO` tirou os nomes de dentro da chamada, o teste **continuou passando** sem enxergar nenhuma das cinco tabelas de ativo — passou a validar apenas `maq_areas` e `cmasm_locais`. Corrigido para ler as duas origens (literal e configuração) e exigir ao menos cinco tabelas configuradas. Vale como padrão: gate que casa com a *forma da chamada* morre quando a forma muda, sem avisar.

## Verificação

- `node --test tests/*.test.js` → **342/342** (eram 299 antes; 17 casos novos em `tests/mapa-cobertura.test.js`, 26 dos demais arquivos entraram junto com os módulos já existentes).
- Exercitado no navegador contra o Supabase de produção, sessão `Livre` (observador): 5 camadas ligadas no boot, "Não localizados (255)", "Prédios sem posição (233)" com os 25 primeiros ordenados por contagem (CMASM 9, MECÂNICA 03 8, CB/MN 5, …) e o corte anunciado ("+208 — refine o filtro"), "Zonas sem contorno (3)" com os três nomes, legenda com os 5 estados, busca "gera" devolvendo GER-01/02/03. Nenhum botão "Posicionar" ou "Desenhar" apareceu para o cargo observador — o esperado.
- **Não verificado visualmente:** o voo até o ativo (`flyTo`) e a captura de tela. O painel do navegador desta sessão não é exibido, então o contêiner do mapa fica 0×0 e o Leaflet lança `Invalid LatLng object: (NaN, NaN)` na projeção — artefato do ambiente, não do código. Fica como item de conferência manual, junto com os caminhos de escrita (posicionar prédio, posicionar ativo, desenhar contorno de zona), que exigem cargo com senha.

## Pendências que esta task NÃO fechou

- Nenhuma coordenada foi gravada: 233 prédios e 255 ativos continuam sem posição. A task construiu a alavanca, não puxou.
- As 3 zonas continuam sem contorno.
- Telhas locais (`mapa/tiles/`) continuam ausentes — opcional, por decisão (D-02 é sobre satélite; o basemap online cobre).
