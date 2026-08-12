# Geração dos tiles raster locais do mapa

## 1. O que este diretório é

`mapa/tiles/` é o destino dos tiles raster do mapa base (basemap `map`), no formato de três
níveis de diretório que o Leaflet espera: `mapa/tiles/{z}/{x}/{y}.png`.

**O mapa já abre sem rede sem eles.** Desde o plano 10-04 da Fase 10, a área do CMASM desenha
com a rede desligada a partir de `mapa/planta-cmasm.geojson` — uma planta vetorial estática,
convertida do extrato `.osm` local por `mapa/gerar-planta.mjs`, sem depender de nenhum tile.
Os tiles raster deste diretório são **fidelidade cartográfica adicional** (o visual de um mapa
de rua de verdade, com ruas, quadras e rótulos desenhados por um motor de renderização), não
pré-requisito. Ninguém deveria ler este documento pensando que está diante de um passo
bloqueante — não está.

Com zero arquivo neste diretório, o mecanismo de tile local (`mapa/xmap.js`,
`TileLocalComFallback`) continua funcionando exatamente como hoje: toda tentativa de carregar
um tile local falha, a queda para o provedor online assume, e o comportamento é idêntico ao do
mapa antes deste diretório existir.

## 2. O que não fazer, e por quê

**Não baixar os tiles em massa de `tile.openstreetmap.org`, nem uma vez.** A Tile Usage Policy
da OpenStreetMap Foundation proíbe explicitamente esse padrão de acesso —
`operations.osmfoundation.org/policies/tiles` classifica como "bulk downloading / prefetching"
qualquer laço que percorra sistematicamente os quadros (`{z}/{x}/{y}`) de uma área, **mesmo que
rodando uma única vez**. Não é uma questão de volume pequeno (aqui seriam ~1.900 tiles, uma
fração ínfima do que a política tem em mente) — é o **padrão de acesso**: um script que itera
`for z,x,y in bbox: fetch(tile.openstreetmap.org/...)` é exatamente a assinatura que a política
descreve, e o bloqueio de acesso ao serviço acontece **sem aviso prévio** (`will be blocked
without notice`). Um bloqueio atingiria também o fallback online que o restante do projeto
depende (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` em `mapa/xmap.js`), então o risco
não é só de licenciamento — é de disponibilidade do próprio mecanismo de queda para online.

## 3. O caminho limpo — renderizar a partir do `.osm` local

O extrato já está em mãos: `map_cmasm_2026abr.osm` (908 KB), dado ODbL
(`http://opendatacommons.org/licenses/odbl/1-0/`, OpenStreetMap and contributors) — dado bruto,
não sujeito à Tile Usage Policy do serviço de tiles, que regula o serviço, não o dado.

Cadeia de ferramentas confirmada pela pesquisa da Fase 10 (`10-RESEARCH.md`, Pattern 7):

1. **Mapnik + `generate_tiles.py`** (abordagem "one shot, no updates") — renderiza uma vez,
   produz os arquivos, não precisa de servidor rodando depois. É a opção mais direta para uma
   área fixa como esta.
2. **`osmium`** para recortar/preparar o extrato antes de renderizar, caso seja necessário
   reduzir ainda mais a área ou converter formato.
3. **TileMill** (Mapbox, descontinuado mas ainda documentado) como alternativa de estilo via
   CartoCSS, exporta direto para tiles/MBTiles.

**Área e níveis a cobrir** — os limites geográficos literais do extrato (elemento `<bounds>` de
`map_cmasm_2026abr.osm`) e a faixa de zoom que `mapa/xmap.js` já usa:

| Limite | Valor |
|---|---|
| `minlat` | `-22.84731` |
| `minlon` | `-43.11868` |
| `maxlat` | `-22.82761` |
| `maxlon` | `-43.09739` |

- **Faixa de zoom:** `minZoom 13` até `maxNativeZoom 17` (o mesmo intervalo que
  `_baseLayers.map` usa em `mapa/xmap.js`; acima de 17 o Leaflet reamostra o tile 17 em vez de
  pedir um tile 18/19 que não existiria).
- **Nível mais alto restrito à ilha** — como o `ROADMAP.md` já dimensionou: em vez de renderizar
  o retângulo inteiro do `bounds` nos zooms mais altos (18-19 já ficam de fora da faixa acima,
  mas dentro de 13-17 o mesmo raciocínio vale para o nível 17), recortar para a área
  efetivamente ocupada pelo CMASM reduz a contagem de tiles sem perder cobertura útil.

## 4. Avaliação honesta de esforço

Montar a cadeia de renderização (Mapnik + dependências C++, converter o `.osm` para PostGIS ou
shapefiles, rodar o script de geração) é **desproporcional** ao volume de saída — algo em torno
de 1.900 tiles para uma área de poucos km². Além disso:

- Exige pacote de sistema fora do zero-build do projeto (não é `npm install`; é instalação de
  Mapnik e sua cadeia de dependências no sistema operacional).
- Roda na máquina de quem prepara os tiles, **não** no deploy — o Vercel não ganha um passo de
  build novo por causa disto.
- Um agente autônomo não deve instalar pacote de sistema sozinho neste projeto (ver
  `CLAUDE.md`); por isso este procedimento fica escrito e o passo é do usuário.

## 5. Alternativas legítimas, nomeadas

Se o esforço acima for rejeitado no planejamento de uma fase futura, duas alternativas —
nenhuma delas recomendada como caminho principal por este documento:

1. **Um provedor cujos termos permitem cache local explicitamente** — MapTiler, Stadia Maps,
   Thunderforest e semelhantes oferecem tiles self-hostable/cacheáveis sob assinatura paga.
   Troca esforço de infraestrutura por custo recorrente, e o lote inicial ainda depende de rede
   para ser baixado — mas dentro dos termos do provedor, não da OSMF.
2. **Navegar manualmente pela área nos níveis desejados**, deixando o cache do navegador
   trabalhar — é uso interativo normal (requisição só dos tiles efetivamente vistos, com o
   navegador honrando os headers de cache), não um script automatizado. Esta é uma **leitura
   permissiva** da política de uso: é decisão do usuário, precisa ser explícita quando adotada,
   e este documento **não a recomenda** como caminho principal.

## 6. Onde os arquivos ficam

A estimativa de ~12 MB para os ~1.900 tiles é estimativa, não medição — o repositório inteiro
hoje tem cerca de 6 MB de árvore de trabalho. **Medir o volume real depois de gerar** (contagem
de arquivos + `du -sh mapa/tiles/`) e só então decidir entre:

- **Repositório** (`git add mapa/tiles/`) — simples, mas tiles binários entram no histórico do
  Git para sempre (mesmo removendo depois, o peso persiste em commits antigos).
- **Fora do repositório** — servidos separadamente (ex. Vercel Blob, outro bucket estático) e
  referenciados pelo mesmo caminho `/mapa/tiles/{z}/{x}/{y}.png`, sem entrar no histórico do Git.

Este documento não decide por antecipação — o critério é o volume medido, não a estimativa.

## 7. Como conferir

1. Contar os arquivos gerados: `find mapa/tiles -name '*.png' | wc -l`.
2. Medir o total: `du -sh mapa/tiles/`.
3. Subir um servidor local (`python -m http.server` a partir da raiz do repositório).
4. Abrir `/mapa`, navegar até o CMASM, **desligar a rede** (modo avião, ou desconectar o
   Wi-Fi/cabo) e confirmar que a área continua desenhando — tanto a planta vetorial (já
   funciona antes deste procedimento) quanto, agora, os tiles raster propriamente ditos.

**Contra a URL de produção esse teste é fisicamente impossível.** O projeto não tem service worker
(`grep -rn "serviceWorker.register" .` = vazio, confirmado na pesquisa da Fase 10), então sem rede
o navegador nunca chega a buscar nem a própria página — não há nada para desligar a rede *depois*
de carregar, porque não há como carregar sem rede em primeiro lugar. A prova real é servidor local
+ rede desligada, como o passo 3-4 acima descreve. Esta linha existe para evitar que alguém tente
testar contra `pmoc-orcin.vercel.app` com o Wi-Fi desligado e conclua,
erradamente, que o recurso está quebrado.
