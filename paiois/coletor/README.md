# Coletor cmms.paiol

Ponto único de entrada de telemetria. Lê os SE-10 por HTTP, assina MQTT,
repassa o DCM Cloud e entrega tudo à interface num formato só.

Contrato das rotas e convenção MQTT: `../docs/contrato-coletor.md`.

## Instalar e rodar

```sh
cd coletor
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp exemplo.env .env          # ver conteúdo abaixo
uvicorn coletor:app --host 0.0.0.0 --port 8003
```

Conferir:

```sh
curl -s localhost:8003/api/v1/saude
curl -s localhost:8003/api/v1/leituras/atuais
```

Depois, na interface, em **Rede & Integração**, trocar a origem das
leituras para *Coletor* e apontar o endereço.

## Configuração

Crie um arquivo `.env` nesta pasta com o conteúdo abaixo (as ferramentas
remotas não escrevem arquivos `.env`, por isso ele vai aqui no texto):

```ini
# Rede dos sensores DCM
PAIOL_BASE_REDE=192.168.10.
PAIOL_PRIMEIRO_IP=151
PAIOL_PORTA_SENSOR=80
PAIOL_USUARIO=admin
PAIOL_SENHA=admin
PAIOL_TIMEOUT=3
PAIOL_INTERVALO=300

# Persistência
PAIOL_BANCO=paiol.db
PAIOL_INVENTARIO=inventario.json

# Quem pode chamar o coletor. Evite * em produção.
PAIOL_CORS=http://localhost:5173,https://paiois.cmasm.local

# MQTT — vazio desliga
PAIOL_MQTT_HOST=
PAIOL_MQTT_PORTA=1883
PAIOL_MQTT_USUARIO=
PAIOL_MQTT_SENHA=
PAIOL_MQTT_PREFIXO=cmasm/paiol

# DCM Cloud — o token fica aqui, nunca no navegador
PAIOL_CLOUD_HOST=192.168.10.240
PAIOL_CLOUD_TOKEN=
```

`PAIOL_SENHA=admin` é a credencial de fábrica do SE-10. Trocar nos 49
equipamentos antes de considerar a instalação entregue, e atualizar
aqui.

## inventario.json

Opcional. Sem ele, o coletor assume a faixa sequencial a partir de
`PAIOL_PRIMEIRO_IP`, na ordem Golf → Uniform → isolados.

```json
[
  {"codigo":"G-5-I","driver":"dcm-se10","ip":"192.168.10.151","id_cloud":2001,"ativo":true},
  {"codigo":"K-6","driver":"mqtt","topico":"cmasm/paiol/k-6/estado","ativo":true},
  {"codigo":"G-8-V","driver":"manual","ativo":false}
]
```

`ativo: false` mantém o paiol no cadastro sem ser varrido — é o caso do
paiol sem sensor, medido na ronda.

## Serviço systemd

```ini
# /etc/systemd/system/cmms-paiol-coletor.service
[Unit]
Description=Coletor cmms.paiol
After=network-online.target

[Service]
User=cmasm
WorkingDirectory=/opt/cmms-paiol/coletor
EnvironmentFile=/opt/cmms-paiol/coletor/.env
ExecStart=/opt/cmms-paiol/coletor/.venv/bin/uvicorn coletor:app --host 0.0.0.0 --port 8003
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## O que o coletor grava

SQLite (`paiol.db`), duas tabelas:

- `leitura` — toda leitura recebida, com a origem (`sensor`, `mqtt`, `cloud`);
- `falha` — uma linha por episódio de indisponibilidade, com início e fim.

A tabela `falha` é o que sustenta o índice de falhas e a disponibilidade
no histórico da interface. Só registra a transição para *sem resposta*,
não cada tentativa — daí o número ser quedas, e não erros.

## Limitações conhecidas

- **Acionamento de relé só funciona em nós MQTT.** O manual do SE-10 não
  documenta endpoint de escrita das saídas. A rota responde 501 para
  sensores DCM de propósito: um comando que falha em silêncio, num paiol
  com refrigeração, é pior que não ter o comando.
- O coletor faz polling. Para fumaça e porta, o caminho certo é trap
  SNMP (o SE-10 envia) ou evento MQTT — com varredura a 5 min, a
  latência de detecção é de até 5 min.
- Sem autenticação nas rotas. Pensado para rede interna; se for exposto,
  pôr atrás de proxy com autenticação.
