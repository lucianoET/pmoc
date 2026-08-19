---
quick_id: 260819-5jf
slug: chrome-padronizado-icones-monocromaticos
date: 2026-08-19
status: complete
---

# Sumário — chrome padronizado e abas de OS separadas

## Entregue

1. **`shared/icones.js`** — conjunto único de 17 ícones, traço 2 em `viewBox 24` (Material
   Symbols Outlined), todos em `currentColor`. Núcleo puro. Nome desconhecido devolve vazio.
2. **Barra superior padronizada**: título, usuário, **Portal (botão)**, Sair. Portal deixou de
   ser link de texto e ficou imediatamente antes de Sair.
3. **Tema desceu para o rodapé** (nos 6 módulos e no portal) — é preferência de exibição.
4. **Rodapé** ganhou o link da **Luctronics** (hexágono, nova aba, `rel=noopener`).
5. **Abas de Máquinas**: `OS` → **OS-Manutenção**; nova **OS-Corte** logo depois, com view
   própria. Dentro dela, "Operações de serviço" → **"Ordem de Serviço de Corte"** e
   "Áreas de serviço" → **"Áreas Vegetais"**.
6. Ícones das 9 abas de Máquinas migrados para o conjunto; os outros módulos seguem com emoji
   porque o shell aceita as duas formas.

## Não entregue (aguardando recorte)

O pedido de **"componentes/templates compartilhados para serviços, manutenções, estoque, listas
de compras e contratações"**, e de trazer o fluxo de **Contratações (ARP)** de Refrigeração
para a aba de OS de Máquinas. Motivo: Refrigeração está **congelada por decisão** (D-04), então
não é reuso de código — é porte. E "contratação em Máquinas" é decisão de **dados** antes de
tela: ou reusa `os_contratacao` (hoje amarrada a `equipamentos`, com ARP de refrigeração), ou
ganha tabela nova. Está registrado como pergunta aberta ao usuário, não como esquecimento.
