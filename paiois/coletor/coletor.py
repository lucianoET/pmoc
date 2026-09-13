"""
Coletor do cmms.paiol — CMASM / DME
====================================

Ponto único de entrada de telemetria dos paióis. Existe por um motivo
concreto: a interface roda em https e os sensores respondem em http sem
cabeçalho CORS, então o navegador não alcança 192.168.10.x nem com o
usuário dentro da rede. Além disso, MQTT e SNMP não são falados por
página web.

Três fontes entram aqui e saem num formato só — o do próprio firmware
DCM, inclusive com a grafia "ouput_alarm", que é como o SE-10 escreve:

    SE-10/SE-11  status.xml + status.json   (polling HTTP)
    nós próprios cmasm/paiol/+/estado       (MQTT)
    DCM Cloud    /cloud/api.php             (histórico e alarmes)

Manter o formato do fabricante evita uma tradução a mais entre coletor
e interface, e é o que permite trocar a origem de um paiol sem mexer no
front.

Execução:
    cp .env.exemplo .env && $EDITOR .env
    pip install -r requirements.txt
    uvicorn coletor:app --host 0.0.0.0 --port 8003
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager, closing
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

log = logging.getLogger("coletor")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ── Configuração ───────────────────────────────────────────────────────
BASE_REDE      = os.getenv("PAIOL_BASE_REDE", "192.168.10.")
PRIMEIRO_IP    = int(os.getenv("PAIOL_PRIMEIRO_IP", "151"))
PORTA_SENSOR   = int(os.getenv("PAIOL_PORTA_SENSOR", "80"))
USUARIO        = os.getenv("PAIOL_USUARIO", "admin")
SENHA          = os.getenv("PAIOL_SENHA", "admin")
TIMEOUT        = float(os.getenv("PAIOL_TIMEOUT", "3"))
INTERVALO      = int(os.getenv("PAIOL_INTERVALO", "300"))
BANCO          = os.getenv("PAIOL_BANCO", "paiol.db")
INVENTARIO     = os.getenv("PAIOL_INVENTARIO", "inventario.json")
ORIGENS        = [o.strip() for o in os.getenv("PAIOL_CORS", "*").split(",")]

MQTT_HOST      = os.getenv("PAIOL_MQTT_HOST", "")
MQTT_PORTA     = int(os.getenv("PAIOL_MQTT_PORTA", "1883"))
MQTT_USUARIO   = os.getenv("PAIOL_MQTT_USUARIO", "")
MQTT_SENHA     = os.getenv("PAIOL_MQTT_SENHA", "")
MQTT_PREFIXO   = os.getenv("PAIOL_MQTT_PREFIXO", "cmasm/paiol")

CLOUD_HOST     = os.getenv("PAIOL_CLOUD_HOST", "")
CLOUD_TOKEN    = os.getenv("PAIOL_CLOUD_TOKEN", "")

# Blocos Golf e Uniform (4 edifícios × 5 paióis) mais os 9 isolados.
CODIGOS: list[str] = (
    [f"G-{b}-{u}" for b in "5678" for u in ("I", "II", "III", "IV", "V")]
    + [f"U-{b}-{u}" for b in "5678" for u in ("I", "II", "III", "IV", "V")]
    + ["D-5", "Q-6", "O-6", "M-6", "K-6", "R-7", "P-7", "L-7", "J-7"]
)


def inventario_padrao() -> list[dict[str, Any]]:
    """Um sensor HTTP por paiol, IPs sequenciais a partir do primeiro."""
    return [
        {"codigo": c, "driver": "dcm-se10", "ip": f"{BASE_REDE}{PRIMEIRO_IP + i}",
         "topico": "", "id_cloud": None, "ativo": True}
        for i, c in enumerate(CODIGOS)
    ]


def carregar_inventario() -> list[dict[str, Any]]:
    """inventario.json manda; sem ele, cai na faixa sequencial."""
    if os.path.exists(INVENTARIO):
        with open(INVENTARIO, encoding="utf-8") as f:
            return json.load(f)
    return inventario_padrao()


SENSORES: list[dict[str, Any]] = carregar_inventario()
ULTIMA: dict[str, dict[str, Any]] = {}   # codigo -> leitura normalizada


# ── Banco ──────────────────────────────────────────────────────────────
ESQUEMA = """
CREATE TABLE IF NOT EXISTS leitura (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo     TEXT NOT NULL,
  ts         TEXT NOT NULL,
  temp       REAL, umid REAL, temp_ext REAL, dew REAL,
  input1     INTEGER, input2 INTEGER, output1 INTEGER, output2 INTEGER,
  ouput_alarm INTEGER,
  origem     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_leitura_codigo_ts ON leitura(codigo, ts);

CREATE TABLE IF NOT EXISTS falha (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo  TEXT NOT NULL,
  inicio  TEXT NOT NULL,
  fim     TEXT,
  motivo  TEXT
);
CREATE INDEX IF NOT EXISTS ix_falha_codigo ON falha(codigo, inicio);
"""


def conectar() -> sqlite3.Connection:
    con = sqlite3.connect(BANCO)
    con.row_factory = sqlite3.Row
    return con


def preparar_banco() -> None:
    with closing(conectar()) as con:
        con.executescript(ESQUEMA)
        con.commit()


def gravar_leitura(codigo: str, d: dict[str, Any], origem: str) -> None:
    with closing(conectar()) as con:
        con.execute(
            "INSERT INTO leitura (codigo, ts, temp, umid, temp_ext, dew, input1, input2,"
            " output1, output2, ouput_alarm, origem)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (codigo, d.get("ts") or agora(), d.get("temp"), d.get("umid"),
             d.get("temp_ext"), d.get("dew"), d.get("input1"), d.get("input2"),
             d.get("output1"), d.get("output2"), d.get("ouput_alarm"), origem),
        )
        con.commit()


def abrir_falha(codigo: str, motivo: str) -> None:
    """Uma falha aberta por vez: só registra a transição para sem resposta."""
    with closing(conectar()) as con:
        aberta = con.execute(
            "SELECT id FROM falha WHERE codigo=? AND fim IS NULL", (codigo,)
        ).fetchone()
        if aberta:
            return
        con.execute("INSERT INTO falha (codigo, inicio, motivo) VALUES (?,?,?)",
                    (codigo, agora(), motivo))
        con.commit()
        log.warning("%s sem resposta: %s", codigo, motivo)


def fechar_falha(codigo: str) -> None:
    with closing(conectar()) as con:
        cur = con.execute(
            "UPDATE falha SET fim=? WHERE codigo=? AND fim IS NULL", (agora(), codigo)
        )
        if cur.rowcount:
            log.info("%s voltou a responder", codigo)
        con.commit()


def agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ponto_de_orvalho(t: float | None, rh: float | None) -> float | None:
    """Magnus-Tetens. Usado só quando o equipamento não devolve o campo."""
    if t is None or rh is None or rh <= 0:
        return None
    import math
    a, b = 17.62, 243.12
    g = math.log(rh / 100) + (a * t) / (b + t)
    return round((b * g) / (a - g), 1)


# ── Leitura do SE-10 ───────────────────────────────────────────────────
def numero(txt: str | None) -> float | None:
    try:
        return float(str(txt).strip())
    except (TypeError, ValueError):
        return None


def de_status_xml(texto: str) -> dict[str, Any]:
    """O XML é a única fonte que traz output1 e output2.

    O status.json do SE-10 não devolve o estado dos relés: por ele não dá
    para saber se a contatora de refrigeração está acionada.
    """
    raiz = ET.fromstring(texto)

    def v(tag: str) -> float | None:
        no = raiz.find(tag)
        return numero(no.text) if no is not None else None

    t, u = v("temperature"), v("humidity")
    return {
        "temp": t, "umid": u, "temp_ext": v("sonde"),
        "dew": v("dewpoint") if v("dewpoint") is not None else ponto_de_orvalho(t, u),
        "input1": int(v("input1") or 0), "input2": int(v("input2") or 0),
        "output1": int(v("output1") or 0), "output2": int(v("output2") or 0),
        "ouput_alarm": int(v("outputalarm") or 0),
        "temp_max": v("temperature_max"), "temp_min": v("temperature_min"),
        "umid_max": v("humidity_max"), "umid_min": v("humidity_min"),
        "ts": agora(),
    }


def de_status_json(j: dict[str, Any]) -> dict[str, Any]:
    """O JSON é o único que traz firmware e MAC — e traz o campo com a
    grafia 'ouput_alarm', que é erro do firmware, não daqui."""
    return {
        "firmware": j.get("firmware"), "mac": j.get("mac"),
        "temp": numero(j.get("temp")), "umid": numero(j.get("umid")),
        "temp_ext": numero(j.get("temp_ext")), "dew": numero(j.get("dew")),
        "input1": int(numero(j.get("input1")) or 0),
        "input2": int(numero(j.get("input2")) or 0),
        "ouput_alarm": int(numero(j.get("ouput_alarm") or j.get("output_alarm")) or 0),
    }


async def ler_sensor(cli: httpx.AsyncClient, sen: dict[str, Any]) -> dict[str, Any] | None:
    ip = sen.get("ip")
    if not ip:
        return None
    raiz = f"http://{ip}" + (f":{PORTA_SENSOR}" if PORTA_SENSOR != 80 else "")
    try:
        r = await cli.get(f"{raiz}/status.xml", auth=(USUARIO, SENHA), timeout=TIMEOUT)
        r.raise_for_status()
        d = de_status_xml(r.text)
    except Exception as e:                                    # noqa: BLE001
        abrir_falha(sen["codigo"], f"{type(e).__name__}: {e}")
        return None

    # Identificação muda pouco; buscar a cada ciclo só carregaria o
    # equipamento à toa.
    if not sen.get("firmware"):
        try:
            r = await cli.get(f"{raiz}/status.json", auth=(USUARIO, SENHA), timeout=TIMEOUT)
            ident = de_status_json(r.json())
            sen["firmware"] = ident.get("firmware")
            sen["mac"] = ident.get("mac")
        except Exception:                                     # noqa: BLE001
            pass

    d["firmware"], d["mac"] = sen.get("firmware"), sen.get("mac")
    fechar_falha(sen["codigo"])
    return d


async def varrer() -> None:
    http = [s for s in SENSORES if s.get("ativo", True) and s.get("driver", "").startswith("dcm")]
    if not http:
        return
    async with httpx.AsyncClient(follow_redirects=False) as cli:
        tarefas = [ler_sensor(cli, s) for s in http]
        for sen, d in zip(http, await asyncio.gather(*tarefas)):
            if not d:
                continue
            d["codigo"] = sen["codigo"]
            ULTIMA[sen["codigo"]] = d
            gravar_leitura(sen["codigo"], d, "sensor")
    log.info("varredura: %d de %d responderam", len(ULTIMA), len(http))


async def laco_varredura() -> None:
    while True:
        try:
            await varrer()
        except Exception:                                     # noqa: BLE001
            log.exception("falha na varredura")
        await asyncio.sleep(INTERVALO)


# ── MQTT ───────────────────────────────────────────────────────────────
# Telemetria e evento em tópicos separados de propósito: detecção de
# fumaça não pode esperar o próximo ciclo de publicação.
#   {prefixo}/{codigo}/estado   retido, periódico
#   {prefixo}/{codigo}/evento   fumaça, porta — publicado na transição
#   {prefixo}/{codigo}/online   LWT do nó ("0" quando o broker o perde)
def iniciar_mqtt() -> Any | None:
    if not MQTT_HOST:
        return None
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        log.warning("paho-mqtt não instalado; MQTT desligado")
        return None

    def ao_conectar(cli, _u, _f, rc, *_):
        log.info("MQTT conectado (rc=%s)", rc)
        cli.subscribe([(f"{MQTT_PREFIXO}/+/estado", 0),
                       (f"{MQTT_PREFIXO}/+/evento", 1),
                       (f"{MQTT_PREFIXO}/+/online", 1)])

    def ao_receber(_c, _u, m):
        partes = m.topic.split("/")
        codigo, tipo = partes[-2], partes[-1]
        try:
            carga = json.loads(m.payload.decode() or "{}")
        except json.JSONDecodeError:
            carga = {"valor": m.payload.decode()}

        if tipo == "online":
            if str(carga.get("valor", carga)).strip() in ("0", "false", "offline"):
                abrir_falha(codigo, "LWT do broker")
            else:
                fechar_falha(codigo)
            return

        t = numero(carga.get("temp", carga.get("temperatura")))
        u = numero(carga.get("umid", carga.get("umidade")))
        d = {
            "codigo": codigo, "temp": t, "umid": u,
            "temp_ext": numero(carga.get("temp_ext")),
            "dew": numero(carga.get("dew")) or ponto_de_orvalho(t, u),
            "input1": int(numero(carga.get("input1")) or 0),
            "input2": int(numero(carga.get("input2")) or 0),
            "output1": int(numero(carga.get("output1")) or 0),
            "output2": int(numero(carga.get("output2")) or 0),
            "ouput_alarm": int(numero(carga.get("alarme")) or 0),
            "firmware": carga.get("firmware"), "mac": carga.get("mac"),
            "ts": carga.get("ts") or agora(),
        }
        ULTIMA[codigo] = d
        gravar_leitura(codigo, d, "mqtt")
        fechar_falha(codigo)
        if tipo == "evento":
            log.warning("evento em %s: %s", codigo, carga)

    cli = mqtt.Client(client_id="cmms-paiol-coletor", clean_session=True)
    if MQTT_USUARIO:
        cli.username_pw_set(MQTT_USUARIO, MQTT_SENHA)
    cli.on_connect, cli.on_message = ao_conectar, ao_receber
    cli.connect_async(MQTT_HOST, MQTT_PORTA, keepalive=60)
    cli.loop_start()
    return cli


# ── DCM Cloud ──────────────────────────────────────────────────────────
async def cloud(cmd: str, **extra: Any) -> Any:
    if not CLOUD_HOST or not CLOUD_TOKEN:
        raise HTTPException(503, "DCM Cloud não configurado")
    host = CLOUD_HOST if CLOUD_HOST.startswith("http") else f"http://{CLOUD_HOST}"
    par = {"token": CLOUD_TOKEN, "cmd": cmd, **{k: v for k, v in extra.items() if v}}
    async with httpx.AsyncClient() as cli:
        r = await cli.get(f"{host.rstrip('/')}/cloud/api.php", params=par, timeout=10)
        r.raise_for_status()
        try:
            return r.json()
        except json.JSONDecodeError:
            return {"bruto": r.text}


# ── Aplicação ──────────────────────────────────────────────────────────
@asynccontextmanager
async def ciclo(_app: FastAPI):
    preparar_banco()
    cli = iniciar_mqtt()
    tarefa = asyncio.create_task(laco_varredura())
    yield
    tarefa.cancel()
    if cli:
        cli.loop_stop()


app = FastAPI(title="Coletor cmms.paiol", version="1.0", lifespan=ciclo)
app.add_middleware(CORSMiddleware, allow_origins=ORIGENS, allow_methods=["*"], allow_headers=["*"])


class Saida(BaseModel):
    canal: int = Field(ge=1, le=2)
    estado: int = Field(ge=0, le=1)


@app.get("/api/v1/saude")
async def saude():
    return {"ok": True, "sensores": len(SENSORES), "respondendo": len(ULTIMA),
            "mqtt": bool(MQTT_HOST), "cloud": bool(CLOUD_HOST and CLOUD_TOKEN), "ts": agora()}


@app.get("/api/v1/sensores")
async def listar_sensores():
    return [{**s, "respondendo": s["codigo"] in ULTIMA} for s in SENSORES]


@app.get("/api/v1/leituras/atuais")
async def leituras_atuais():
    """Formato consumido direto pela interface, sem renomear campo algum."""
    return list(ULTIMA.values())


@app.get("/api/v1/sensores/{codigo}/historico")
async def historico(codigo: str, horas: int = Query(24, ge=1, le=24 * 90)):
    desde = (datetime.now(timezone.utc) - timedelta(hours=horas)).isoformat(timespec="seconds")
    with closing(conectar()) as con:
        linhas = con.execute(
            "SELECT ts, temp AS temperature, umid AS humidity, dew AS dewpoint"
            " FROM leitura WHERE codigo=? AND ts>=? ORDER BY ts", (codigo, desde)
        ).fetchall()
    return [dict(r) for r in linhas]


@app.get("/api/v1/relatorios/agregado")
async def agregado(periodo: str = Query("semana", pattern="^(semana|mes)$"),
                   de: str | None = None, ate: str | None = None):
    """Médias por período e índice de falhas, um registro por paiol.

    A janela do SQLite usa strftime: %Y-%W para semana, %Y-%m para mês.
    """
    fmt = "%Y-%W" if periodo == "semana" else "%Y-%m"
    de = de or (datetime.now(timezone.utc) - timedelta(days=126)).isoformat(timespec="seconds")
    ate = ate or agora()
    with closing(conectar()) as con:
        medias = con.execute(
            f"SELECT codigo, strftime('{fmt}', ts) AS janela, MIN(ts) AS ini,"
            "  AVG(temp) AS temp_media, MIN(temp) AS temp_min, MAX(temp) AS temp_max,"
            "  AVG(umid) AS umid_media, MIN(umid) AS umid_min, MAX(umid) AS umid_max,"
            "  COUNT(*) AS amostras"
            " FROM leitura WHERE ts BETWEEN ? AND ?"
            " GROUP BY codigo, janela ORDER BY codigo, janela", (de, ate)
        ).fetchall()
        falhas = con.execute(
            f"SELECT codigo, strftime('{fmt}', inicio) AS janela, COUNT(*) AS quedas,"
            "  SUM((julianday(COALESCE(fim, ?)) - julianday(inicio)) * 1440) AS min_offline"
            " FROM falha WHERE inicio BETWEEN ? AND ?"
            " GROUP BY codigo, janela", (agora(), de, ate)
        ).fetchall()
    indice = {(f["codigo"], f["janela"]): f for f in falhas}
    saida = []
    for m in medias:
        f = indice.get((m["codigo"], m["janela"]))
        saida.append({**dict(m),
                      "quedas": (f["quedas"] if f else 0),
                      "min_offline": round(f["min_offline"] or 0) if f else 0})
    return saida


@app.get("/api/v1/cloud/{cmd}")
async def repassar_cloud(cmd: str, id: str | None = None,
                         start: str | None = None, finish: str | None = None):
    """Repasse do DCM Cloud. O token fica aqui, não no navegador."""
    if cmd not in ("gettime", "getgroups", "getdevices", "getregisters", "getalarms"):
        raise HTTPException(400, "comando não previsto pela API do DCM Cloud")
    return await cloud(cmd, id=id, start=start, finish=finish)


@app.post("/api/v1/sensores/{codigo}/saida")
async def acionar_saida(codigo: str, cmd: Saida):
    """Aciona relé.

    Só implementado para nós próprios via MQTT. O manual do SE-10 não
    documenta endpoint de escrita das saídas — inventar uma URL aqui
    daria um comando que falha em silêncio, o que num paiol com
    refrigeração é pior que não ter o comando. Para o SE-10, use a
    própria interface web do equipamento até o fabricante publicar a
    rota.
    """
    sen = next((s for s in SENSORES if s["codigo"] == codigo), None)
    if not sen:
        raise HTTPException(404, "paiol sem sensor cadastrado")
    if sen.get("driver") != "mqtt" or not MQTT_HOST:
        raise HTTPException(501, "acionamento remoto disponível apenas para nós MQTT")
    import paho.mqtt.publish as publish
    publish.single(
        f"{MQTT_PREFIXO}/{codigo}/comando",
        json.dumps({"saida": cmd.canal, "estado": cmd.estado}),
        hostname=MQTT_HOST, port=MQTT_PORTA, qos=1,
        auth={"username": MQTT_USUARIO, "password": MQTT_SENHA} if MQTT_USUARIO else None,
    )
    return {"ok": True, "codigo": codigo, **cmd.model_dump()}
