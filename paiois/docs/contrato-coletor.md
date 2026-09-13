# Contrato do coletor e convenção MQTT

O coletor é o ponto único de entrada de telemetria. Três fontes entram,
um formato sai — o do próprio firmware DCM.

```
SE-10 / SE-11  ──HTTP──┐
nós ESP32      ──MQTT──┼──►  coletor  ──HTTP──►  index.html
DCM Cloud      ──HTTP──┘        │
                                └──►  SQLite (histórico e falhas)
```

## Por que existe

O navegador não alcança `http://192.168.10.x` a partir de uma página
https: conteúdo misto **e** ausência de CORS no firmware, dois bloqueios
independentes. MQTT e SNMP nem são falados por página web. E, mesmo que
fossem, 49 assinaturas MQTT abertas no navegador da portaria, com a
credencial do broker dentro da página e sem histórico ao reiniciar a TV,
não seria um desenho defensável.

## Rotas

Base: `http://<host>:8003`

| Método | Rota | Retorna |
|---|---|---|
| GET | `/api/v1/saude` | estado do coletor, contagem de sensores respondendo |
| GET | `/api/v1/sensores` | inventário configurado + se está respondendo |
| GET | `/api/v1/leituras/atuais` | última leitura de cada paiol |
| GET | `/api/v1/sensores/{codigo}/historico?horas=24` | série do período |
| GET | `/api/v1/relatorios/agregado?periodo=semana\|mes` | médias + índice de falhas |
| GET | `/api/v1/cloud/{cmd}` | repasse do DCM Cloud (o token fica no servidor) |
| POST | `/api/v1/sensores/{codigo}/saida` | aciona relé — só nós MQTT |

### `/api/v1/leituras/atuais`

Campos com o nome do firmware, `ouput_alarm` incluído:

```json
[{
  "codigo": "G-5-I",
  "temp": 24.72, "umid": 64.22, "temp_ext": 24.57, "dew": 17.5,
  "input1": 0, "input2": 1, "output1": 1, "output2": 0, "ouput_alarm": 0,
  "temp_max": 27.0, "temp_min": 18.0, "umid_max": 65.0, "umid_min": 40.0,
  "firmware": "1.99", "mac": "DC:MT:D0:9E:A4:82",
  "ts": "2026-09-12T03:35:01+00:00"
}]
```

### `/api/v1/relatorios/agregado`

Uma linha por paiol e por janela (`%Y-%W` para semana, `%Y-%m` para mês):

```json
[{
  "codigo": "G-5-I", "janela": "2026-36", "ini": "2026-09-07T00:00:00+00:00",
  "temp_media": 24.7, "temp_min": 22.1, "temp_max": 27.9,
  "umid_media": 58.4, "umid_min": 44.0, "umid_max": 71.2,
  "amostras": 2016, "quedas": 2, "min_offline": 143
}]
```

### `POST /api/v1/sensores/{codigo}/saida`

```json
{ "canal": 1, "estado": 1 }
```

Responde **501** para sensores DCM, de propósito: o manual do SE-10 não
documenta endpoint de escrita das saídas. Inventar uma URL daria um
comando que falha em silêncio — num paiol com refrigeração, pior que não
ter o comando. Até o fabricante publicar a rota, use a interface web do
próprio equipamento.

## Convenção MQTT

Prefixo padrão `cmasm/paiol`, configurável.

| Tópico | QoS | Retido | Para quê |
|---|---|---|---|
| `cmasm/paiol/{codigo}/estado` | 0 | sim | telemetria periódica |
| `cmasm/paiol/{codigo}/evento` | 1 | não | fumaça, porta, pânico |
| `cmasm/paiol/{codigo}/online` | 1 | sim | **LWT** do nó |
| `cmasm/paiol/{codigo}/comando` | 1 | não | acionamento de saída |

### Três decisões que valem seguir

**Evento separado de telemetria.** Detecção de fumaça não pode esperar o
próximo ciclo de publicação. Telemetria vai a cada N minutos; evento vai
na transição, com QoS 1.

**LWT obrigatório.** Sem Last Will, um nó que sumiu da rede fica
indistinguível de um nó reportando normalidade — o mesmo problema do
sensor mudo aparecendo verde. O nó publica `1` retido ao conectar e
registra `0` retido como LWT; o coletor abre falha ao receber `0`.

**Telemetria retida, evento não.** Ao reiniciar, o coletor recebe o
último estado de cada paiol imediatamente, sem esperar o próximo ciclo.
Evento retido seria pior: reprocessaria alarme antigo como se fosse
agora.

### Carga útil

```json
{
  "temp": 24.7, "umid": 58.2, "temp_ext": null, "dew": 16.1,
  "input1": 0, "input2": 0, "output1": 0, "output2": 0,
  "firmware": "1.0.3", "mac": "A0:B7:65:...",
  "ts": "2026-09-12T03:35:01Z"
}
```

Os nomes são os do DCM de propósito: um nó ESP32 que publique assim
entra no sistema sem nenhuma alteração no coletor nem no app — vira uma
linha no `inventario.json` com `"driver": "mqtt"`.

O coletor aceita `temperatura`/`umidade` como sinônimos, e calcula o
ponto de orvalho por Magnus-Tetens quando o nó não manda `dew`.

## Configuração

`inventario.json` na pasta do coletor (opcional — sem ele, a faixa
sequencial `192.168.10.151+` é assumida):

```json
[
  {"codigo":"G-5-I","driver":"dcm-se10","ip":"192.168.10.151","id_cloud":2001,"ativo":true},
  {"codigo":"K-6","driver":"mqtt","topico":"cmasm/paiol/k-6/estado","ativo":true},
  {"codigo":"G-8-V","driver":"manual","ativo":false}
]
```

`ativo: false` mantém o paiol no cadastro sem ser varrido — é o caso do
paiol sem sensor, medido na ronda.
