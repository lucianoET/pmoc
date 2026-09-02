---
quick_id: 260819-4gq
slug: mapa-estado-ativo-dos-menus-visivel-e-ic
date: 2026-08-19
status: complete
---

# Sumário — estado ativo dos menus e ícones em SVG

## O que estava errado (print do usuário)

1. O `☰` do botão Módulos aparecia como **bloco preto**: `U+2630` cai numa fonte de símbolo que
   nem todo sistema tem. O mesmo valia para o `▤` do botão Camadas.
2. "Ativo" era uma borda de **1px trocando de cor** — fino demais para ler de relance, e
   invisível para quem distingue mal ciano de cinza.

## O que foi feito

- **Ícones em SVG** (`currentColor`), desenhados igual em qualquer sistema.
- **Estado ativo com quatro sinais somados**, nenhum deles carregando o significado sozinho:
  barra de 4px à esquerda (desenhada por `::before`, para o texto não pular ao ligar), fundo
  tingido, texto em peso 700 e um **ponto cheio × anel vazio** — o sinal que sobra para quem
  não distingue as duas cores. Vale para módulo, modo de edição e os botões flutuantes.
- **`aria-pressed`** em todos os botões de alternância, declarado já na marcação: é a mesma
  informação que o CSS usa para desenhar, agora disponível para o leitor de tela.
- **Contador no botão ☰** — fechado, ele passa a responder "o que estou vendo?".
- **Painel de camadas**: a linha inteira responde (tingida com barra quando ligada, apagada
  quando não), em vez de um interruptor de 26×14 px.
- **Escala métrica** repintada com os tokens do componente.

## Dois erros meus, achados na própria tela

1. Usei `var(--text)` nos rótulos do painel de camadas. O painel é escuro **sempre**
   (D-01, `xmap.css` é dark-only), então no tema claro isso pinta texto escuro sobre fundo
   escuro. Corrigido para os tokens do próprio componente (`--xm-text`, `--xm-acc`).
2. Baixei o limiar de rótulo de 17 para 16 para "mostrar nomes ao abrir": deu **137 rótulos
   sobrepostos**. A correção não foi voltar atrás — foram **dois limiares**: estrutura (prédio,
   zona; poucas dezenas, dão sentido ao resto) a partir de 15, ativo a partir de 17. Ao abrir,
   21 rótulos limpos.
- E o rótulo do grupo deixou de repetir o nome da camada: `F21 (16)` responde onde e quantos;
  `Climatização (16)` dito trinta vezes não responde nada.

## Verificação

- `node --test`: **431/431**.
- Na tela: ligado com `aria-pressed="true"`, barra e ponto na cor de destaque, peso 700;
  desligado com opacidade 0.5 e anel vazio. 21 rótulos em zoom 16, sem nenhum de ativo.
