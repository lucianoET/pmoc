# cmms.paiol

Gestão e monitoramento ambiental dos 49 paióis do CMASM.

Módulo do monorepo `pmoc-overlay`, na base comum dos irmãos:
`shared/pmoc.css` para a linguagem visual, `shared/shell.js` para
topbar/abas/rodapé, `shared/auth.js` para login por cargo,
`shared/tema.js` para o tema. Sem build — ES modules nativos.

Precisa ser servido por HTTP (os imports de `../shared/` não funcionam
com `file://`). Rota `/paiois`, registrada no `vercel.json`.

## O que faz

| Tela | Para quê |
|---|---|
| **Sensores** | Mapa do terreno (blocos Golf e Uniform 4×5 + isolados) ou lista dos sensores instalados |
| **Alarmes** | O mesmo mapa filtrado pelo que está fora de faixa |
| **Paióis** | Cadastro: tipo, capacidade, ocupação, limites, climatização, inventário |
| **Medições** | Lançamento das medições manuais, com a faixa de referência à vista |
| **Histórico** | Médias semanais e mensais, índice de falhas, mapa de calor |
| **Boletim** | Folha diária pronta para imprimir e assinar |
| **Rede & Integração** | Faixa de IP, DCM Cloud, limites padrão, mural |
| **Mural** | Tela cheia para a TV da portaria (`index.html#mural`) |

## Modelo de dados

O paiol é a entidade. Sensor é acessório, e medição manual é registro
histórico — não campo do paiol:

```
paiol  1 ──── 0..N  sensor      (DCM, ESP32/MQTT, Modbus…)
paiol  1 ──── 0..N  medicao     (ronda manual, com autor e hora)
```

Isso é o que permite um paiol com dois sensores de fabricantes
diferentes, um paiol sem sensor nenhum, e a troca da origem de leitura
sem tocar na interface.

### Leitura efetiva

Tudo que avalia faixa lê de um único ponto, `leitura(paiol)`:

1. sensor vivo (respondeu dentro do tempo limite) — o mais recente vence;
2. senão, medição manual dentro da validade (24 h por padrão);
3. senão, sem leitura.

### Severidade

Ordem: `fumaça` › `desvio grave` › `fora de faixa` › `offline` ›
`a medir` › `atenção` › `normal`.

Duas decisões embutidas, que valem revisar antes de publicar em
produção:

- **Medição manual fora de faixa vence a falha de comunicação.** Munição
  quente é mais urgente que sensor mudo.
- **Medição manual dentro da faixa não apaga o `offline`.** A medição
  cobre a informação, não conserta o equipamento; se zerasse o contador,
  ninguém voltaria para trocar o cabo.

Grave = ultrapassou o limite em mais de 20 % da amplitude da faixa
(configurável). Faixa 18–27 °C tem 9 °C: 20 % são 1,8 °C, então 27,5 °C
é alarme e 29,0 °C é grave. Como é fração da faixa, a mesma regra serve
para umidade.

**AC inoperante põe o paiol em Atenção** mesmo com a temperatura ainda
boa — é o aviso que chega antes do alarme.

## Mural da portaria

`index.html#mural` sobe direto em tela cheia, tema escuro, sem
navegação. Os 49 paióis cabem em 1920×1080 sem rolagem.

- **Piscar significa alarme não reconhecido**, não gravidade (ISA-18.2).
  Uma tela que pisca a noite inteira vira paisagem. Reconhecer (botão,
  Enter ou barra de espaço) tira o piscar e o som; a cor fica.
- **Som precisa de um clique** para o navegador liberar áudio. Se alarme
  sonoro for requisito de serviço, o lugar dele é sirene no relé do
  SE-10 ou disparada por trap SNMP — não uma aba de navegador.
- O relógio com segundos e o pulso na faixa existem porque **um
  navegador travado numa TV é visualmente idêntico a um sistema
  saudável**. Se o relógio parou, a tela está morta.
- Tema escuro por padrão: imagem parada 24 h marca tela OLED.

## Estado

Hoje o app guarda tudo em `localStorage` com chaves `paiol.*`, em modo
de demonstração. Para sair disso:

1. Subir `coletor/` dentro da rede do CMASM;
2. Em **Rede & Integração**, trocar a origem para *Coletor* e apontar o
   endereço;
3. Conferir a faixa de IP e aplicar aos 49 paióis.

O navegador não alcança `http://192.168.10.x` a partir de uma página
https — conteúdo misto e ausência de CORS no firmware. Não é limitação
do app; é o motivo de existir o coletor.

## Inventário — atenção

A tela de inventário está pronta e funcional, **com dados de exemplo
genéricos**. O conteúdo real dos paióis só deve ser carregado quando o
app rodar contra o coletor dentro da rede do CMASM. Enquanto estiver
publicado fora, não preencher.

## Arquivos

```
index.html                     página mínima no padrão dos módulos
app.js                         o módulo inteiro
estilo.css                     só o que o pmoc.css não cobre
coletor/coletor.py             FastAPI: SE-10 + DCM Cloud + MQTT → API única
coletor/README.md              instalação, `.env` e serviço systemd
coletor/requirements.txt       dependências do coletor
docs/integracao-dcm.md         campos do SE-10, OIDs SNMP, API do DCM Cloud
docs/contrato-coletor.md       rotas da API e convenção MQTT
supabase/01_paiois_schema.sql  schema para quando migrar do localStorage
```

## Duas exceções deliberadas à base comum

**O mural não usa o shell.** Enquanto está ativo esconde topbar, abas e
rodapé — é tela de portaria numa TV, não uma tela de trabalho. Como o
portal, é superfície registrada que não monta o shell. Sair devolve a
casca.

**Seis níveis de severidade, não quatro.** O `pmoc.css` tem
`--green/--yellow/--red/--blue`; este módulo precisa separar *fora de
faixa* de *desvio grave* e de *fumaça*, e ainda distinguir *offline* de
*a medir*. Os níveis extras estão em `estilo.css`, derivados dos tokens
comuns para acompanhar o tema.

## Uma decisão que vale conferir

**AC inoperante não muda o estado do paiol.** Aparece como marca no card,
nas ocorrências da ficha, no KPI da tela Paióis e no boletim — mas não
pinta o paiol de amarelo. Motivo: a portaria não aciona ar-condicionado.
Com 8 ACs inoperantes, o mural ficava com 11 paióis em Atenção e o
alarme ambiental perdia a vez. É pendência de manutenção, não evento de
vigilância.

## Pendências conhecidas

- Persistência em Supabase: schema escrito (`pai_*`), app ainda em
  `localStorage` com chaves `paiol.*`.
- ~~`shared/supabase-config.js` acha a URL e a chave por regex~~ —
  **resolvido em 12/09/2026**: o par é declarado em
  `shared/supabase-env.js` e a varredura ficou como resgate. Gate:
  `tests/supabase-env.test.js`.
- Acionamento remoto de relé só existe para nós MQTT — o manual do SE-10
  não documenta endpoint de escrita das saídas.
- Os 49 equipamentos estão com credencial de fábrica `admin/admin`.
- Detector de fumaça em contato N.A. não é supervisionado: cabo rompido
  fica indistinguível de repouso. Verificar a fiação; laço N.F. é a
  prática corrente em detecção.
