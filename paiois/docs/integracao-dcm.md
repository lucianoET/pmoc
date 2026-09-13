# Integração com os sensores DCM

Levantado do manual do fabricante (`manuais.dcmtech.com.br`) e conferido
contra um SE-10 simulado durante o desenvolvimento do coletor.

## SE-10 — acesso

| Item | Valor |
|---|---|
| IP de fábrica | `192.168.1.181` (DHCP após reset com o botão na energização) |
| Credencial de fábrica | `admin` / `admin` |
| Interface | Ethernet 10/100, IEEE 802.3 |
| Faixa de operação | −20 a 70 °C |
| Entradas | 2 optoacopladas, configuráveis N.A. ou N.F. |
| Saídas | 2 relés de contato seco, 5 A |
| Alimentação | 12 VDC 2 A externa |
| Protocolos | HTTP (XML e JSON) e SNMP v2c (GET e TRAP) |

Endpoints:

```
http://<ip>/status.xml          estado completo
http://<ip>/status.json         estado + identificação
http://<ip>/protect/calib.htm   calibração
```

## O detalhe que decide a arquitetura

**O `status.json` não traz `output1` nem `output2`.** Pelo JSON não há
como saber se a contatora de refrigeração está acionada. Só o
`status.xml` devolve os dois.

Em compensação, o JSON é o único que traz `firmware` e `mac`.

O coletor usa os dois: XML a cada ciclo, JSON só na primeira leitura de
cada equipamento, para não carregar o sensor à toa com dados que não
mudam.

## Campos

### `status.xml`

```xml
<response>
    <temperature>24.72</temperature>
    <humidity>64.22</humidity>
    <sonde>24.57</sonde>
    <input1>0</input1>
    <input2>0</input2>
    <output1>1</output1>
    <output2>0</output2>
    <outputalarm>1</outputalarm>
    <dewpoint>17.50</dewpoint>
    <temperature_max>100.0</temperature_max>
    <temperature_min>0.0</temperature_min>
    <humidity_max>100.0</humidity_max>
    <humidity_min>0.0</humidity_min>
    <sonde_max>100.0</sonde_max>
    <sonde_min>0.0</sonde_min>
</response>
```

### `status.json`

```json
{
"firmware": "1.99",
"name": "SE-10NOVO",
"description": "LOCALIZACAO",
"mac": "DC:MT:D0:9E:A4:82",
"temp": 25.10,
"umid": 68.57,
"temp_ext": 24.24,
"dew": 18.90,
"input1" : 0,
"input2" : 0,
"ouput_alarm" : 0,
"max_temp": 100.0,
"max_umid": 100.0,
"max_temp_ext": 100.0,
"min_temp": 0.0,
"min_umid": 0.0,
"min_temp_ext": 0.0,
"s1hist": 0.0,
"s2hist": 0.0,
"s3hist": 0.0,
"input1_mode" : 1,
"input2_mode" : 1
}
```

`ouput_alarm` está grafado assim no firmware. O coletor e o app repassam
sem corrigir: renomear criaria uma tradução a mais para manter, e quem
for depurar com `curl` veria um nome que não existe no equipamento.

### Mapeamento para o app

| App | `status.xml` | `status.json` |
|---|---|---|
| `temperatura` | `temperature` | `temp` |
| `umidade` | `humidity` | `umid` |
| `temp_ext` | `sonde` | `temp_ext` |
| `orv` | `dewpoint` | `dew` |
| `in1` / `in2` | `input1` / `input2` | idem |
| `out1` / `out2` | `output1` / `output2` | **ausente** |
| `out_alarm` | `outputalarm` | `ouput_alarm` |
| limites do equipamento | `*_max` / `*_min` | `max_*` / `min_*` |
| `firmware`, `mac` | ausente | presentes |

Os limites gravados no equipamento são comparados com os do cadastro. Se
divergirem, o app marca o paiol em Atenção: **quem dispara o relé e o
e-mail é o equipamento**, não a tela. Um SE-10 saído de fábrica está com
0–100 °C — nessa condição a tela alarma sozinha e nada acontece em campo.

## SNMP v2c

Enterprise OID **49542**.

| Grandeza | OID |
|---|---|
| Temperatura interna | `.1.3.6.1.4.1.49542.1.1.0` |
| Umidade interna | `.1.3.6.1.4.1.49542.1.2.0` |
| Sonda externa | `.1.3.6.1.4.1.49542.1.3.0` |
| Estado das entradas 1 e 2 | `.1.3.6.1.4.1.49542.1.4.0` |
| Alarme de temperatura | `.1.3.6.1.4.1.49542.2.1.0` |

```sh
snmpget -v2c -c public 192.168.10.151 .1.3.6.1.4.1.49542.1.1.0
```

**O equipamento envia trap.** Para fumaça e porta, trap é melhor que
varredura: com polling a 5 min, a latência de detecção de incêndio é de
até 5 min. Se houver Zabbix ou outro gerente na rede, o desenho correto
é evento discreto por trap e grandeza analógica por polling.

## SE-11 e SE-12

Mesma família, endpoints diferentes: `/api/data.json` e `/api/data.xml`.
O SE-11 acrescenta `flood` (alagamento) e `voltage` (0–60 VDC), com OIDs
`.1.5.0` e `.1.6.0`.

## DCM Cloud

Requer versão 1.3.2 ou superior com a API habilitada em
CONFIGURAÇÕES / API, onde se gera o token.

```
http://<host>/cloud/api.php?token=<TOKEN>&cmd=<comando>
```

| Comando | Retorna | Parâmetros |
|---|---|---|
| `gettime` | relógio do servidor | — |
| `getgroups` | grupos cadastrados | — |
| `getdevices` | equipamentos ativos | — |
| `getregisters` | leituras | `id`, `start`, `finish` |
| `getalarms` | alarmes | `id`, `start`, `finish` |

```
…/cloud/api.php?token=<TOKEN>&cmd=getregisters&id=2023&start=2021-10-10&finish=2021-10-12
```

Intervalo de gravação do Cloud: 1 h, 30, 15, 5 ou 2 min, mais 10 s da
última hora. Varrer mais rápido que isso só faz sentido na leitura
direta.

O token **não** deve ficar no navegador. O coletor expõe
`/api/v1/cloud/{cmd}` como repasse, guardando o token no servidor.

## Cadastro no equipamento

O campo `description` do SE-10 aparece no DCM Cloud como localização.
Gravar nele o código do paiol elimina a tabela de-para entre o Cloud e o
app — vale fazer na próxima visita a cada equipamento.
