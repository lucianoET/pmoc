# Font Awesome hospedado — /refrigeracao

Cópia **intocada** do Font Awesome Free 5.15.4 (`cdnjs`), versionada porque
este é o único módulo da plataforma que ainda desenha ícone com fonte: os
outros seis usam o conjunto inline `shared/icones.js` desde 19/08/2026, e
este ficou de fora por ser congelado (D-04).

- `css/all.min.css` — a folha do upstream, sem edição.
- `webfonts/fa-solid-900.woff2` — **só a família solid**, que é a única
  usada aqui (209 ocorrências de `fas`, nenhuma de `far`/`fab`).

`css/` e `webfonts/` precisam continuar **irmãos**: a folha chama
`../webfonts/`. Um gate confere isso.

A folha declara as três famílias e formatos antigos (eot/ttf/woff/svg) que
não foram versionados. Não desenhá-los é intencional — o mínimo da
plataforma é um navegador com ES6, que lê woff2. Um ícone `far`/`fab` novo
não apareceria, então o gate recusa a família nova em vez de deixar sumir
em silêncio.
