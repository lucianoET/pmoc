---
quick_id: 260821-tyx
slug: refrigeracao-qr-da-ficha-com-largura-limitada-e-gaveta-que-nao-fecha-ao-rolar
date: 2026-08-21
mode: quick
type: execute
status: pending
branch: refrigeracao-gaveta-e-qr
files_modified:
  - refrigeracao/index.html
  - tests/refrigeracao-gaveta-qr.test.js
  - TESTES.md
autonomous: true
must_haves:
  truths:
    - No desktop o QR da ficha para de ocupar a gaveta inteira — ele tem um teto de largura e o resto do bloco 5 volta a caber na tela
    - No celular o QR continua do mesmo tamanho que já estava bom — o teto é maior que a largura disponível ali, então nada muda
    - Rolar a ficha para baixo para ler o que está embaixo não fecha mais a gaveta
    - Arrastar a alça para baixo continua fechando a gaveta, em qualquer posição de rolagem — o gesto conhecido não regride
    - Puxar para baixo com o conteúdo já no topo continua fechando — é o gesto padrão de bottom-sheet
    - Um arrasto predominantemente lateral não fecha a gaveta
    - A decisão do gesto é uma função pura de números, exercitada em Node pelo gate — não uma regex sobre o arquivo
    - O QR da etiqueta impressa e o QR da ficha impressa saem exatamente como saíam — papel não é tela
    - Nenhuma migração, nenhuma dependência nova, nenhum arquivo compartilhado referenciado
  artifacts:
    - tests/refrigeracao-gaveta-qr.test.js
  key_links:
    - "regra .qr-ficha svg (folha) -> blocoQrFicha (template) — o número mora num lugar só"
    - "gestoFechaGaveta (núcleo puro) -> IIFE do SWIPE DRAWER (única consumidora) — a decisão não é duplicada dentro do listener"
    - "#drawer-body.scrollTop no touchstart -> gestoFechaGaveta -> closeDrawer no touchend"
    - "#drawer-panel.contains(alvo) + #drawer-body.contains(alvo) -> 'começou na alça' (área não rolável)"
---

# `/refrigeracao` — QR da ficha com largura limitada, e gaveta que não fecha ao rolar

O pedido, nas palavras dele:

> *"no comutador o qr fica muito grande, no celular fica bom. no celular, na ficha, quando movo
> para baixo fecha a ficha"*

"comutador" é computador. São dois defeitos de interface independentes, os dois na gaveta da ficha,
e o screenshot que ele mandou mostra o primeiro: o QR do bloco 5 esticado por mais de mil pixels de
largura, empurrando o resto da ficha para fora da tela.

## O que o arquivo diz (conferido, não suposto)

**Defeito 1 — o QR não tem teto de largura.** `blocoQrFicha(id)` (linha ~3783) injeta o SVG dentro
de um `<div>` com estilo embutido que só centraliza e dá margem, sem nenhuma trava de largura.
`qrSvgDe(url, 4)` chama `createSvgTag({cellSize, margin:2, scalable:true})`, e `scalable:true` é
justamente o que produz um SVG de `width="100%"` — ele estica até a largura de quem o contém. No
celular a gaveta tem ~375px e o resultado fica bom; no desktop ela tem a largura da janela.

O precedente já existe no mesmo arquivo, na mesma seção: o modal de QR do app tem
`#qr-svg-wrap svg{width:100%;max-width:250px;height:auto}` na folha da linha 3623. A ficha nasceu
sem o equivalente.

**Defeito 2 — a gaveta fecha em qualquer arrasto para baixo.** O bloco `SWIPE DRAWER`
(linha ~2311) arma o fechamento com um único teste, `if(dy>60){ dragging=true; }`, em qualquer ponto
da gaveta, **sem olhar a posição da rolagem**. Rolar o conteúdo para ler o que está embaixo é
exatamente esse gesto. É defeito anterior a hoje — só ficou intolerável agora que a ficha tem 5
blocos e um QR.

**O próprio código diz que a checagem era prevista e ficou pela metade:** a primeira linha da IIFE
declara `var panel, startY, startScroll, dragging` — `panel` recebe `el('drawer-panel')` e nunca é
lido; `startScroll` nunca chega a ser atribuído. A implementação ciente de rolagem estava no desenho
e não foi escrita.

**Quem rola é `#drawer-body`, não `#drawer-panel`** (conferido no CSS, linhas 218-234):

| Seletor | Regra relevante | Rola? |
| ------- | --------------- | ----- |
| `#drawer-panel` | `max-height:92dvh;display:flex;flex-direction:column` | não — sem `overflow`, é só a coluna |
| `#drawer-handle` | `flex-shrink:0` | não |
| `#drawer-hdr` | `flex-shrink:0` | não |
| `#drawer-body` | `overflow-y:auto;flex:1` | **sim — é este** |
| `#drawer-footer` | `flex-shrink:0` | não |

Ler o `scrollTop` do painel devolveria sempre 0 e o defeito continuaria de pé, só que mais difícil
de enxergar: o gate passaria e a tela não.

## Decisões

- **D-tyx-01** — a trava de largura é **regra de CSS**, num `<style>`, e não estilo embutido no
  template. É onde o gate consegue afirmá-la, e é o que impede o número de existir em dois lugares.
  Ela mora na folha da seção de QR (a mesma das linhas 3619-3624), encostada no precedente
  `#qr-svg-wrap svg`, e não na folha principal do topo do arquivo: o QR é assunto daquela seção.
- **D-tyx-02** — o teto é **200px**, com número próprio, **não compartilhado** com a regra de 250px
  do modal. O modal desenha dentro de um cartão de 330px e é lido por *outro* celular apontado para
  a tela; o QR da ficha é lido de perto e divide a gaveta com quatro outros blocos. Somar os dois
  num seletor único faria uma futura mudança no modal mexer na ficha em silêncio. Legibilidade
  conferida por conta: a URL da ficha gera um QR de ~33 módulos mais margem 2 de cada lado, ou seja
  ~37 módulos — a 200px são ~5,4px por módulo, folgado para câmera de celular.
- **D-tyx-03** — a decisão do gesto é uma **função pura no topo do bloco, fora da IIFE**
  (`gestoFechaGaveta`), recebendo só números e booleanos. É o que torna o gate um teste de
  comportamento em Node, e não uma regex sobre o arquivo. Mesmo espírito de `lerAlvoFicha` /
  `mensagemErroNfc`, que já vivem soltos neste arquivo por essa razão.
- **D-tyx-04** — arma o fechamento em **duas** situações, e só nelas: (a) o toque começou com o
  conteúdo já no topo (`scrollTop <= 0` de `#drawer-body` **no início do toque**) — puxar para baixo
  ali não tem para onde rolar, logo significa fechar; (b) o toque começou **fora do corpo rolável**,
  na alça, no cabeçalho ou no rodapé do painel — área que não rola, onde o gesto é inequívoco.
- **D-tyx-05** — o gesto tem de ser **predominantemente vertical**: `|dx| > |dy|` cancela. Um
  arrasto diagonal durante uma rolagem lateral (a fita de chips, uma tabela larga) não fecha.
- **D-tyx-06** — a rolagem lida é a de **`#drawer-body`** (ver a tabela acima), capturada no
  `touchstart`. É o que finalmente dá uso a `panel` e `startScroll`, declarados e nunca lidos.
- **D-tyx-07** — o limiar continua **60px** (constante nomeada, `GESTO_MIN_PX`), e a decisão é
  **reavaliada a cada `touchmove`**: puxar 80px para baixo e voltar para cima cancela o fechamento,
  em vez de disparar no `touchend` por causa de um pico intermediário.
- **D-tyx-08** — **a etiqueta impressa e a ficha impressa não são tocadas.** `etiquetaHtml` tem sua
  própria regra (`.etq-qr svg{width:22mm;height:22mm}`) e `printFicha` a sua
  (`.hdr svg{width:20mm;height:20mm}`), as duas em milímetros, dentro de folhas de impressão
  próprias. No papel o tamanho é outro problema, e já está resolvido.
- **D-tyx-09** — nada de redesenhar a gaveta. Sem arrasto com o dedo acompanhando o painel, sem
  animação de dismiss, sem `pointer events`. São dois consertos.

## Fora de escopo

- Trava de largura em qualquer outro SVG do arquivo (o modal já tem a sua; o papel tem as suas).
- Fechar a gaveta por swipe no desktop (mouse) — nunca existiu e ninguém pediu.
- `refrigeracao/qrcode.js` — a biblioteca não é tocada.
- Migração de banco: **nenhuma**.

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@./.claude/CLAUDE.md
@refrigeracao/index.html
@tests/refrigeracao-qr-nfc.test.js
@tests/inventario-ordem-refrigeracao.test.js
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: teto de largura do QR da ficha, numa regra de CSS</name>
  <files>refrigeracao/index.html, tests/refrigeracao-gaveta-qr.test.js</files>
  <behavior>
    - A folha da seção de QR tem uma regra para o SVG do QR da ficha com um teto de largura em px, entre 120 e 260 (D-tyx-02 escolheu 200).
    - `blocoQrFicha` embrulha o SVG com a classe dessa regra e não carrega mais estilo embutido nesse `div`.
    - Nenhum número de largura aparece dentro de `blocoQrFicha` — o teto mora só na folha (D-tyx-01).
    - A regra de 250px do modal (`#qr-svg-wrap svg`) segue existindo, separada e intacta.
    - As duas regras de impressão em milímetros (etiqueta 22mm, ficha impressa 20mm) seguem existindo, intactas (D-tyx-08).
  </behavior>
  <action>
Crie `tests/refrigeracao-gaveta-qr.test.js` com o cabeçalho de comentário no padrão dos outros gates
de refrigeração (o de `tests/refrigeracao-qr-nfc.test.js` serve de molde: `node:test`, `node:assert/strict`,
`fs`, `vm`, `path`, `RAIZ`, `HTML` lidos uma vez no topo). Nesta task ele recebe só a parte de CSS;
a Task 2 acrescenta a parte do gesto no mesmo arquivo.

Em `refrigeracao/index.html`, na folha `<style>` da seção de QR — a mesma que hoje contém as regras
de `#qr-mini`, `#qr-pop`, `#qr-card` e `#qr-svg-wrap svg` (linhas ~3619-3624) — acrescente, ao final
dela, um comentário de seção no idioma do arquivo citando D-tyx-01/D-tyx-02 e duas regras para a
classe `qr-ficha`: a primeira centralizando e dando a margem vertical que hoje está embutida no
template (`text-align:center;margin:8px 0`), a segunda mirando o `svg` descendente com
`width:100%;max-width:200px;height:auto`, exatamente na forma da regra vizinha do modal. Não
altere a regra do modal: os dois números são deliberadamente independentes (D-tyx-02).

Em `blocoQrFicha(id)` (linha ~3783), troque o `div` de embrulho do SVG pelo mesmo `div` com
`class="qr-ficha"` e **sem atributo `style`** — a centralização e a margem passaram para a folha.
Nada mais da função muda: o texto alternativo de QR indisponível, a caixa com a URL, os dois botões
e `blocoNfc(id)` ficam como estão. Não toque em `qrSvgDe`, em `etiquetaHtml`, em
`imprimirEtiquetas` nem no bloco de impressão da ficha (D-tyx-08) — o `scalable:true` continua
sendo o que se quer em todos eles; o que faltava era só quem contivesse o SVG na tela.

No gate, escreva estas afirmações, lendo o HTML como texto:
recorte os blocos `<style>` do arquivo e afirme que existe uma regra cujo seletor cita a classe do
QR da ficha e o `svg`, com um `max-width` em px cujo valor numérico esteja entre 120 e 260 — a faixa
é a que mantém o código legível pela câmera sem voltar a estourar a gaveta; recorte o corpo de
`blocoQrFicha` (de `function blocoQrFicha` até a chave de fechamento da função) e afirme que ele cita
a classe e que **não** contém a palavra que nomeia a propriedade de largura máxima em CSS, provando
que o número não foi duplicado no template; afirme também que esse corpo não emite atributo de
estilo embutido no `div` que embrulha o SVG. Afirme que a regra do modal de 250px continua no
arquivo, e que as duas regras de impressão em milímetros (a de 22mm da etiqueta e a de 20mm do
cabeçalho da ficha impressa) continuam lá — se um conserto de tela tivesse alcançado o papel, este
caso cai.

Feche o arquivo com o mesmo bloco de congelamento que todos os outros gates de refrigeração
carregam: copie o teste de D-04/PLAT-15 do fim de `tests/refrigeracao-qr-nfc.test.js` sem alterar a
lista de padrões proibidos nem a mensagem.
  </action>
  <verify>
    <automated>node --test tests/refrigeracao-gaveta-qr.test.js tests/refrigeracao-qr-nfc.test.js tests/refrigeracao-ficha-equipamento.test.js tests/modulos-caminhos.test.js</automated>
  </verify>
  <done>
    - Os quatro arquivos de teste passam, sem nenhum caso pulado.
    - O teto de largura existe uma vez só, na folha, e `blocoQrFicha` não repete o número.
    - As regras de impressão em milímetros e a regra de 250px do modal seguem intactas.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: a gaveta só fecha quando o gesto é de fechar</name>
  <files>refrigeracao/index.html, tests/refrigeracao-gaveta-qr.test.js, TESTES.md</files>
  <behavior>
    - `gestoFechaGaveta(inicioForaDoCorpo, rolagemInicial, dy, dx)` é pura e devolve booleano:
    - topo (rolagem 0), dy 80, dx 0, dentro do corpo → true — o gesto padrão de bottom-sheet continua fechando
    - rolagem 120 (o usuário já rolou a ficha), dy 80, dx 0 → false — **é o defeito relatado**
    - fora do corpo (alça/cabeçalho), rolagem 400, dy 80 → true — o gesto conhecido não regride (D-tyx-04b)
    - dy 30, em qualquer combinação → false — abaixo do limiar
    - dy 60 exato → false; dy 61 no topo → true — o limiar é estritamente maior (D-tyx-07)
    - dy -80 (arrasto para cima) → false
    - dy 80 com dx 200 → false — gesto lateral (D-tyx-05)
    - dy 80 com dx -200 → false — o sinal de dx não importa, só o módulo
    - chamada duas vezes com os mesmos argumentos devolve o mesmo resultado — sem estado interno
    - Carregar o bloco em Node, com um `document` que só sabe registrar ouvintes, não lança.
  </behavior>
  <action>
Reescreva o bloco `SWIPE DRAWER` de `refrigeracao/index.html` (começa no comentário de seção
`SWIPE DRAWER`, linha ~2309, e termina imediatamente antes do comentário `link profundo: ?equip=`).
Mantenha o comentário de seção como está — ele é o marcador de recorte do gate.

Logo abaixo do comentário de seção, **fora da IIFE**, declare a constante nomeada do limiar
(`GESTO_MIN_PX`, valor 60) e a função pura `gestoFechaGaveta(inicioForaDoCorpo, rolagemInicial, dy, dx)`,
precedidas de um comentário curto citando D-tyx-03/D-tyx-04/D-tyx-05 e explicando por que a decisão
mora fora do ouvinte. A função devolve `false` se `dy` não passar do limiar; `false` se
`Math.abs(dx) > Math.abs(dy)`; `true` se `inicioForaDoCorpo`; e no resto devolve o resultado de
`rolagemInicial <= 0`. Sem tocar em DOM, sem `el`, sem `document` — só aritmética.

Reescreva a IIFE logo abaixo, no estilo do arquivo (`var`, `function`, nada de arrow function),
com as três variáveis que ela de fato usa mais as duas que hoje são letra morta:

- `touchstart` (`{passive:true}`): zere o estado; saia se a gaveta não estiver aberta; pegue
  `el('drawer-panel')` e `el('drawer-body')`; saia se o painel não existir ou não contiver
  `e.target` — um toque no overlay não é gesto de arrasto, e o overlay já fecha no clique. Guarde
  `startY` e `startX` do primeiro toque, guarde `startScroll` como o `scrollTop` do corpo (0 se ele
  não existir) e guarde se o toque começou **fora** do corpo rolável, que é o caso da alça, do
  cabeçalho e do rodapé (D-tyx-04b, D-tyx-06).
- `touchmove` (`{passive:true}`): saia se a gaveta não estiver aberta; calcule `dy` e `dx` contra o
  ponto inicial e **atribua** `dragging = gestoFechaGaveta(...)` a cada movimento — atribuição, não
  `if` que só liga: é isso que faz voltar para cima cancelar (D-tyx-07).
- `touchend`: se `dragging`, chame `closeDrawer()` e zere o estado.

O ouvinte não repete nenhuma das comparações: quem decide é sempre `gestoFechaGaveta`.

No mesmo `tests/refrigeracao-gaveta-qr.test.js` da Task 1, acrescente a parte do gesto. Recorte o
bloco entre o comentário de seção `SWIPE DRAWER` e o comentário `link profundo: ?equip=`, afirmando
que os dois marcadores foram encontrados e estão na ordem certa, e rode o recorte num contexto
`node:vm` cujo `document` só tem um `addEventListener` que não faz nada e cujo `el` devolve `null` —
nenhum ouvinte dispara na carga, então isso basta. Pegue `gestoFechaGaveta` do contexto e teste
**todos** os casos listados no bloco `<behavior>` acima, um `assert.strictEqual` por caso, com
mensagem dizendo qual situação real cada um representa (o caso de rolagem 120 leva na mensagem que
é o defeito que o usuário relatou).

Some três afirmações estruturais sobre o mesmo recorte, cada uma guardando um erro concreto que
seria invisível na tela: que ele cita `scrollTop` e `drawer-body` (ler a rolagem do painel devolveria
sempre 0 e o defeito sobreviveria ao gate); que `gestoFechaGaveta` aparece ao menos duas vezes,
definição mais chamada, provando que o ouvinte não voltou a decidir sozinho; e que o recorte não
casa com `/dy\s*>\s*60/` — a comparação crua que era o defeito. Repare que a declaração da constante
nomeada não casa com esse padrão, que é justamente o que se quer: o número passa a ter nome.

Em `TESTES.md`, acrescente ao final uma seção nova no padrão das anteriores
(`## Refrigeração — QR da ficha com largura limitada e gaveta que não fecha ao rolar (21/08/2026)`),
citando o quick id, com quatro conferências manuais, porque o gate prova a regra e não a fiação do
toque: no desktop, abrir a ficha de um equipamento e conferir que o QR do bloco 5 é um quadrado de
~200px e que os botões "Copiar link" e "Imprimir etiqueta" ficam visíveis sem rolagem horizontal;
no celular, abrir a mesma ficha e conferir que o QR está do mesmo tamanho de antes; no celular,
rolar a ficha inteira para baixo até o bloco 5 e conferir que a gaveta **não** fecha; e no celular,
arrastar a **alça** para baixo, primeiro com a ficha rolada até o fim, e conferir que fecha nas duas
posições.
  </action>
  <verify>
    <automated>node --test tests/*.test.js</automated>
  </verify>
  <done>
    - A suíte inteira passa, com no mínimo os 629 casos da linha de base mais os novos, e zero falhas.
    - Todos os casos do bloco `<behavior>` passam, inclusive o de rolagem 120, que reproduz o defeito relatado.
    - `panel` e `startScroll` deixaram de ser declarados e nunca lidos: os dois são usados.
    - `TESTES.md` tem a seção nova com as quatro conferências manuais.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| nenhuma nova | As duas mudanças são de apresentação e de gesto. Nenhuma entrada de rede, nenhuma consulta ao Supabase, nenhum parâmetro de URL novo, nenhuma coluna nova. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-tyx-01 | Tampering | SVG do QR injetado por `innerHTML` em `blocoQrFicha` | low | accept | O SVG sai de `qrSvgDe`, que só desenha módulos a partir da URL montada por `urlFichaEquip(id)` com id inteiro vindo do próprio `DATA`; nenhum texto de usuário entra no SVG, e a URL exibida ao lado já passa por `esc()`. Esta task não altera a origem do SVG, só quem o contém. |
| T-tyx-02 | Denial of Service | gaveta que deixe de ter saída depois do conserto do gesto | low | mitigate | Restam três saídas independentes, e o gate cobre a segunda: clique no overlay (`onclick="closeDrawer()"`, intocado), arrasto da alça em qualquer posição de rolagem (D-tyx-04b, caso de teste próprio) e o botão de fechar no rodapé da ficha. |
| T-tyx-03 | Tampering | instalação de pacote (npm/pip/cargo) | n/a | accept | Não há instalação nesta task: projeto zero-build, sem `package.json`, sem dependência nova. A biblioteca de QR já está embutida no repositório e não é tocada. |
</threat_model>

<verification>
- `node --test tests/*.test.js` — 629 casos da linha de base mais os novos, todos verdes.
- Nenhum arquivo fora de `refrigeracao/index.html`, `tests/refrigeracao-gaveta-qr.test.js` e `TESTES.md` foi alterado.
- Nenhum arquivo `.sql` criado.
- Nada em `/home/luc/DEV_ERP` tocado.
</verification>

<success_criteria>
- No desktop o QR da ficha tem teto de largura e o bloco 5 volta a caber na gaveta.
- No celular o QR fica do tamanho que já estava.
- Rolar a ficha não fecha mais a gaveta; arrastar a alça continua fechando.
- A regra do gesto é exercitada em Node como função pura, caso a caso.
- O QR do papel — etiqueta e ficha impressa — sai igual ao de antes.
</success_criteria>

<output>
Criar `.planning/quick/260821-tyx-refrigeracao-qr-da-ficha-com-largura-lim/260821-tyx-SUMMARY.md` ao terminar,
citando D-tyx-01 a D-tyx-09.
</output>
