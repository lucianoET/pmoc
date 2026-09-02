# Bibliotecas hospedadas — /mapa

Cópias **intocadas** do upstream, versionadas para o módulo não depender de CDN.

| arquivo | origem | versão |
|---|---|---|
| `leaflet.js`, `leaflet.css` | `unpkg.com/leaflet@1.9.4/dist/` | 1.9.4 |
| `leaflet.draw.js`, `leaflet.draw.css` | `unpkg.com/leaflet-draw@1.0.4/dist/` | 1.0.4 |
| `images/*` | `dist/images/` das duas | idem |

`images/` existe porque as duas folhas chamam `url(images/…)` por caminho
relativo a si mesmas — sem ela o marcador e a barra de desenho ficam sem
ícone, e nada na tela diz por quê.

**Isto não são os tiles.** O mapa-base continua vindo do OpenStreetMap
online; o satélite é online por decisão (D-02). Tiles locais têm caminho e
procedimento próprios em `mapa/tiles/GERAR-TILES.md` — medido: a área do
CMASM até o zoom 17 são ~267 tiles / ~3,9 MB.

Para atualizar: baixe do upstream, substitua o arquivo inteiro e rode
`node --test tests/vendor-sem-cdn.test.js`, que confere se tudo que as
folhas pedem existe.
