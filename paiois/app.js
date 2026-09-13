// ══════════════════════════════════════════════════════════════════
// PMOC Paióis — monitoramento ambiental e gestão dos 49 paióis do
// CMASM. Segue a base comum dos módulos: shared/pmoc.css para a
// linguagem visual, shared/shell.js para topbar/abas/rodapé,
// shared/auth.js para login por cargo, shared/tema.js para o tema.
//
// Duas exceções deliberadas à base comum, ambas por causa do mural:
//
// 1. O mural é tela de portaria, exibida numa TV 24 h. Ele esconde
//    topbar, abas e rodapé — como o portal, é superfície registrada
//    que não usa o shell enquanto está ativo. Sair do mural devolve
//    a casca.
// 2. O módulo tem 6 níveis de severidade; o pmoc.css tem 4 cores
//    semânticas. Os níveis extras estão em estilo.css, derivados dos
//    tokens comuns para acompanhar o tema.
//
// Estado: localStorage com chaves paiol.*. O schema Supabase está em
// supabase/01_paiois_schema.sql, ainda não ligado — ver README.
// ══════════════════════════════════════════════════════════════════
"use strict";

import { aplicarShell } from '../shared/shell.js'
import { alternarTema } from '../shared/tema.js'
import { Auth } from '../shared/auth.js'
import { criarClienteSupabase, MSG_SDK_AUSENTE } from '../shared/supabase-config.js'

const VERSAO = '1.0'
const ACCENT = '#8a9a55'

const MIOLO = String.raw`<div class="muralbar" id="muralbar">
    <div class="mb-relogio"><b id="mbHora">--:--</b><span id="mbData"></span></div>
    <div class="mb-tit">Paióis · CMASM<small id="mbSub">portaria</small></div>
    <div class="mb-faixa" id="mbFaixa"><span class="mb-pulso" id="mbPulso"></span><span class="rot" id="mbRot">Situação</span><span class="txt" id="mbTxt">—</span></div>
    <div class="mb-acoes">
      <button class="btn btn-s" id="mbAck">Reconhecer</button>
      <button class="btn btn-s" id="mbSom">Ativar som</button>
      <button class="btn btn-s" id="mbSair">Sair</button>
    </div>
</div>

<div class="barra-topo" id="barra-topo">
  <div class="barra" id="barra"></div>
  <div class="barra-fim">
    <div class="busca"><input id="busca" placeholder="Código, IP, local…" aria-label="Filtrar paióis"></div>
    <button class="btn btn-s btn-sm" id="btnVarrer" title="Ler todos os sensores agora">Varrer</button>
    <button class="btn btn-s btn-sm" id="btnMural" title="Tela cheia para a portaria">Mural</button>
    <button class="btn btn-s btn-sm" id="btnRonda" title="Lançar medições de termo-higrômetro">Ronda</button>
    <button class="conn demo" id="conn" title="Origem das leituras — clique para configurar"><i></i><span id="connTxt">demonstração</span></button>
  </div>
</div>


<div class="view active" id="view-mapa">
  <div id="mapa"></div>
</div>

<div class="wrap view" id="view-equip">
  <div class="head-row"><h2>Sensores instalados</h2><span class="c" id="eqCount"></span>
    <button class="btn btn-s btn-sm sp" id="btnCsvOut">Exportar CSV</button>
    <button class="btn btn-p btn-sm" id="btnNovoSensor">Novo sensor</button></div>
  <div class="scroll"><table class="dt"><thead><tr>
    <th></th><th>Paiol</th><th>Driver</th><th>Endereço</th><th>MAC</th><th class="n">Temp °C</th>
    <th class="n">Umid %</th><th class="n">Sonda °C</th><th>I/O</th><th>Última leitura</th><th></th>
  </tr></thead><tbody id="eqBody"></tbody></table></div>
</div>

<div class="wrap view" id="view-hist"></div>
<div class="wrap view" id="view-paiois"></div>
<div class="wrap view" id="view-med"></div>
<div class="wrap narrow view" id="view-rel"></div>

<div class="wrap view" id="view-cfg"></div>

<div class="overlay" id="modal" aria-hidden="true" data-close>
  <div class="modal paiol-modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <div class="modal-hd">
      <div><h3 id="mTitle">Paiol</h3><div class="sub" id="mSub"></div></div>
      <button class="x" data-close aria-label="Fechar">×</button>
    </div>
    <div class="tabs" role="tablist" id="mTabs">
      <button role="tab" data-aba="paiol"   aria-selected="true">Paiol</button>
      <button role="tab" data-aba="inv"     aria-selected="false">Inventário</button>
      <button role="tab" data-aba="clima"   aria-selected="false">Climatização</button>
      <button role="tab" data-aba="sens"    aria-selected="false">Sensores</button>
      <button role="tab" data-aba="med"     aria-selected="false">Medições</button>
      <button role="tab" data-aba="hist"    aria-selected="false">Histórico</button>
    </div>
    <div class="modal-body">
      <div id="pane-paiol" role="tabpanel"></div>
      <div id="pane-inv"   role="tabpanel"></div>
      <div id="pane-clima" role="tabpanel"></div>
      <div id="pane-sens"  role="tabpanel"></div>
      <div id="pane-med"   role="tabpanel"></div>
      <div id="pane-hist"  role="tabpanel">
        <div class="sect" style="margin-top:0">Temperatura e ponto de orvalho <span style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--text3)">— últimas 24 h</span></div>
        <div class="chart"><canvas id="hChartT" width="660" height="150" role="img" aria-label="Temperatura e ponto de orvalho nas últimas 24 horas"></canvas></div>
        <div class="leg-viz"><span><i style="background:var(--viz-temp)"></i>Temperatura</span><span><i style="background:var(--text3)"></i>Ponto de orvalho</span><span><i style="background:var(--red)"></i>Limites</span></div>
        <div class="sect">Umidade relativa</div>
        <div class="chart"><canvas id="hChartU" width="660" height="120" role="img" aria-label="Umidade relativa nas últimas 24 horas"></canvas></div>
        <div class="leg-viz"><span><i style="background:var(--viz-umid)"></i>Umidade</span><span><i style="background:var(--red)"></i>Limites</span></div>
        <div class="f"><div class="h" id="hHint" style="margin-top:9px"></div></div>
      </div>
    </div>
    <div class="modal-ft">
      <button class="btn btn-d" id="btnExcluir">Excluir paiol</button>
      <span class="msg" id="mMsg"></span>
      <button class="btn btn-s sp" data-close>Fechar</button>
      <button class="btn btn-p" id="btnSalvar">Salvar</button>
    </div>
  </div>
</div>

`

const ABAS = [
  { id:'sensores', label:'Sensores',  icone:'painel',    vista:'mapa'   },
  { id:'alarmes',  label:'Alarmes',   icone:'os',        vista:'mapa', sev:'alarm' },
  { id:'paiois',   label:'Paióis',    icone:'predio',    vista:'paiois' },
  { id:'med',      label:'Medições',  icone:'checklist', vista:'med'    },
  { id:'hist',     label:'Histórico', icone:'relatorio', vista:'hist'   },
  { id:'rel',      label:'Boletim',   icone:'modelo',    vista:'rel'    },
  { id:'cfg',      label:'Rede',      icone:'chave',     vista:'cfg'    },
]


/* ══════════════════════════════════════════════════════════════════
   cmms.paiol — supervisório dos paióis do CMASM
   Sensores DCM SE-10 (temperatura/umidade Ethernet, 2 entradas
   optoacopladas, 2 relés 5 A). Mapeamento de campos conforme o
   manual do fabricante — ver aba "Integração" de cada sensor.
   ══════════════════════════════════════════════════════════════════ */

const $  = id => document.getElementById(id);
const esc = v => String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = v => (v===null||v===undefined||v==='') ? null : (Number.isNaN(Number(v)) ? null : Number(v));
const fmt = (v,d=1) => v==null ? '—' : Number(v).toFixed(d);

/* ── Inventário canônico dos 49 paióis ─────────────────────────────
   Blocos Golf e Uniform: 4 edifícios (5–8) × 5 paióis (I–V).
   Isolados: identificados por letra + rua.                        */
const EDIF = ['5','6','7','8'], UNID = ['I','II','III','IV','V'];
const ISOLADOS = ['D-5','Q-6','O-6','M-6','K-6','R-7','P-7','L-7','J-7'];
const CODIGOS = [
  ...EDIF.flatMap(b => UNID.map(u => 'G-'+b+'-'+u)),
  ...EDIF.flatMap(b => UNID.map(u => 'U-'+b+'-'+u)),
  ...ISOLADOS,
];

/* ── Configuração persistida (localStorage, por navegador) ───────── */
const CFG_KEY = 'paiol.cfg.v1', DB_KEY = 'paiol.sensores.v3';
const CFG_PADRAO = {
  modo:'demo',                                  // demo | gateway | cloud
  gateway:'http://localhost:8003',
  rede:{ base:'192.168.10.', primeiro:151, porta:80, usuario:'admin', senha:'admin', timeout:3000, intervalo:300 },
  cam:{ ativo:false, base:'192.168.10.', primeiro:101 },
  cloud:{ host:'192.168.10.240', token:'', idPrimeiro:2001 },
  limites:{ temp_min:18, temp_max:27, umid_min:40, umid_max:65, margemOrvalho:3, mudoMin:60, manualValidadeH:24 },
  io:{ in1_func:'fumaca', in1_modo:'NA', in2_func:'porta', in2_modo:'NA', out1_func:'refrigeracao', out2_func:'off' },
  mural:{ graveFrac:0.20, piscar:true, som:true, volume:0.35, autoAck:15, tema:'escuro', ruas:false },
};
function lerCfg(){
  try{ const r = localStorage.getItem(CFG_KEY);
    if(r) return fundir(structuredClone(CFG_PADRAO), JSON.parse(r));
  }catch(e){}
  return structuredClone(CFG_PADRAO);
}
function fundir(base, extra){
  for(const k in extra){
    if(extra[k] && typeof extra[k]==='object' && !Array.isArray(extra[k])) fundir(base[k] = base[k]||{}, extra[k]);
    else base[k] = extra[k];
  }
  return base;
}
function gravarCfg(){ try{ localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); }catch(e){} }
let CFG = lerCfg();

/* ── IP derivado da faixa configurada ───────────────────────────── */
function ipDe(base, primeiro, i){
  const n = Number(primeiro) + i;
  if(!base || !Number.isFinite(n) || n < 1 || n > 254) return '';
  return String(base).replace(/\.?$/, '.').replace(/\.\.$/,'.') + n;
}
function ipSensor(i){ return ipDe(CFG.rede.base, CFG.rede.primeiro, i); }
function ipCamera(i){ return CFG.cam.ativo ? ipDe(CFG.cam.base, CFG.cam.primeiro, i) : ''; }

function grupoDe(cod){
  const c = (cod||'').toUpperCase();
  if(c.startsWith('G-')) return 'golf';
  if(c.startsWith('U-')) return 'uniform';
  return 'isolado';
}
const NOME_GRUPO = { golf:'Bloco Golf', uniform:'Bloco Uniform', isolado:'Paiol isolado' };

/* ── Ponto de orvalho (Magnus-Tetens) — usado quando o SE-10 não
      devolve o campo "dew"/"dewpoint". Condensação sobre munição é
      o risco que a umidade relativa isolada não revela.          */
function orvalho(T, RH){
  if(T==null || RH==null || RH<=0) return null;
  const a=17.62, b=243.12, g = Math.log(RH/100) + (a*T)/(b+T);
  return +( (b*g)/(a-g) ).toFixed(1);
}

/* ══ Modelo ════════════════════════════════════════════════════════
   O paiol é a entidade. Sensor é acessório: um paiol pode ter zero,
   um ou vários, de fabricantes diferentes. Medição manual é um
   registro histórico à parte, não um campo do paiol. Foi essa
   separação que abriu espaço para inventário, climatização e, mais
   à frente, nós próprios publicando em MQTT.

   Campo do sensor DCM   ← status.xml        ← status.json
   temperatura           ← temperature       ← temp
   umidade               ← humidity          ← umid
   temp_ext              ← sonde             ← temp_ext
   orv                   ← dewpoint          ← dew
   in1 / in2             ← input1 / input2   ← input1 / input2
   out1 / out2           ← output1 / output2 ← (ausente!)
   out_alarm             ← outputalarm       ← ouput_alarm  [sic]
   O status.json não traz o estado dos relés: para ver a contatora de
   refrigeração é obrigatório usar status.xml.                      */

const TIPOS_PAIOL = ['Munição','Explosivos','Torpedos','Mísseis','Minas','Cargas de profundidade',
                     'Pirotécnicos','Material inerte','Vazio'];
const UNIDADES = ['caixas','paletes','m³','unidades','t'];
const SIT_AC = ['operante','inoperante','em manutenção','não possui'];

function novoPaiol(cod, i){
  const g = grupoDe(cod);
  const temRele = g === 'isolado' || cod.endsWith('-V');
  return {
    id:i+1, codigo:cod, nome:'Paiol '+cod, grupo:g, localizacao:NOME_GRUPO[g],
    tipo:'Munição', descricao:'', situacao:'ativo',
    capacidade:null, ocupacao:null, unidade:'caixas',
    temp_min:CFG.limites.temp_min, temp_max:CFG.limites.temp_max,
    umid_min:CFG.limites.umid_min, umid_max:CFG.limites.umid_max,
    ac:[ acVazio(1, temRele ? 'out1' : ''), acVazio(2, '') ],
    inventario:[], ip_cam:ipCamera(i), obs:'',
  };
}
function acVazio(n, saida){
  return { n, marca:'', modelo:'', btu:null, tombo:'', situacao:n===1?'operante':'não possui', saida:saida||'' };
}

const DRIVERS = {
  'dcm-se10':{ rot:'DCM SE-10 (HTTP/SNMP)', rede:true },
  'dcm-se11':{ rot:'DCM SE-11 (HTTP/SNMP)', rede:true },
  'mqtt'    :{ rot:'Nó próprio via MQTT',   rede:false, topico:true },
  'modbus'  :{ rot:'Modbus TCP',            rede:true },
  'outro'   :{ rot:'Outro',                 rede:true },
};
function novoSensor(cod, i, driver){
  const temRele = grupoDe(cod) === 'isolado' || cod.endsWith('-V');
  return {
    id:(i+1), paiol:cod, driver:driver||'dcm-se10', modelo:'SE-10', ativo:true, rotulo:'',
    ip:ipSensor(i), porta:null, mac:null, firmware:null,
    id_cloud: CFG.cloud.idPrimeiro ? CFG.cloud.idPrimeiro + i : null, topico:'',
    in1_func:CFG.io.in1_func, in1_modo:CFG.io.in1_modo,
    in2_func:CFG.io.in2_func, in2_modo:CFG.io.in2_modo,
    out1_func: temRele ? CFG.io.out1_func : 'off', out2_func:CFG.io.out2_func,
    temperatura:null, umidade:null, temp_ext:null, orv:null,
    in1:0, in2:0, out1:0, out2:0, out_alarm:0,
    dev_temp_max:null, dev_temp_min:null, dev_umid_max:null, dev_umid_min:null,
    lido_em:null, erro:null,
  };
}

/* Semente de demonstração. Dois paióis saem sem sensor: são medidos na
   ronda, como acontece em campo enquanto a instalação não fecha.     */
function semear(p, sen, i){
  let h = 0; for(const c of p.codigo) h = (h*31 + c.charCodeAt(0)) >>> 0;
  p.capacidade = 60 + (h % 9) * 20;
  p.ocupacao   = Math.round(p.capacidade * (0.25 + (h % 60)/100));
  p.tipo = TIPOS_PAIOL[h % 6];
  p.ac[0].marca = ['Carrier','Springer','LG','Elgin'][h % 4];
  p.ac[0].modelo = '42XQ' + (12 + h % 6);
  p.ac[0].btu = [18000, 24000, 30000, 36000][h % 4];
  p.ac[0].tombo = '00' + (41000 + (h % 900));
  p.ac[0].situacao = (h % 13 === 0) ? 'inoperante' : 'operante';
  if(!sen) return p;

  const quente  = [7, 30, 45], umido = [3, 22], mudos = [12, 41], fogo = [26], fabrica = [9, 18, 33];
  let T = +(20.6 + (h % 52)/10).toFixed(1);
  let U = +(45 + (h % 17)).toFixed(1);
  if(quente.includes(i)) T = +((i === 7 ? 31.4 : 27.6) + (h % 11)/10).toFixed(1);
  if(umido.includes(i))  U = +(68 + (h % 7)).toFixed(1);
  sen.temperatura = T; sen.umidade = U; sen.orv = orvalho(T, U);
  sen.temp_ext = (h % 3 === 0) ? +(T - 0.6).toFixed(1) : null;
  sen.in1  = fogo.includes(i) ? 1 : 0;
  sen.in2  = (h % 11 === 0) ? 1 : 0;
  sen.out1 = (sen.out1_func !== 'off' && T > 25) ? 1 : 0;
  sen.out_alarm = fogo.includes(i) ? 1 : 0;
  if(fabrica.includes(i)){ sen.dev_temp_max = 100; sen.dev_temp_min = 0; sen.dev_umid_max = 100; sen.dev_umid_min = 0; }
  else { sen.dev_temp_max = p.temp_max; sen.dev_temp_min = p.temp_min;
         sen.dev_umid_max = p.umid_max; sen.dev_umid_min = p.umid_min; }
  sen.lido_em = new Date(Date.now() - (mudos.includes(i) ? 340 : (h % 9)) * 60000).toISOString();
  return p;
}

const SEM_SENSOR = [19, 44];   // demonstração: G-8-V e K-6 medidos na ronda
function semente(){
  const paiois = [], sens = [], meds = [];
  CODIGOS.forEach((cod, i)=>{
    const p = novoPaiol(cod, i);
    if(SEM_SENSOR.includes(i)){
      p.ip_cam = null;
      semear(p, null, i);
      let h = 0; for(const c of cod) h = (h*31 + c.charCodeAt(0)) >>> 0;
      meds.push({ id:meds.length+1, paiol:cod, por:'SO-CT Ribeiro', obs:'',
        temperatura: i === 19 ? +(22.5 + (h%30)/10).toFixed(1) : 24.8,
        umidade:     i === 19 ? +(50 + h%12).toFixed(1) : 58.0,
        em: new Date(Date.now() - (i === 19 ? 5 : 51)*36e5).toISOString() });
    } else {
      const sen = novoSensor(cod, i);
      semear(p, sen, i);
      sens.push(sen);
    }
    paiois.push(p);
  });
  return { paiois, sens, meds };
}

const K_PAIOIS = 'paiol.paiois.v4', K_SENS = 'paiol.sensores.v4', K_MED = 'paiol.medicoes.v1';
function carregarTudo(){
  try{
    const a = JSON.parse(localStorage.getItem(K_PAIOIS) || 'null');
    const b = JSON.parse(localStorage.getItem(K_SENS)   || 'null');
    const c = JSON.parse(localStorage.getItem(K_MED)    || 'null');
    if(Array.isArray(a) && a.length) return { paiois:a, sens:b || [], meds:c || [] };
  }catch(e){}
  const novo = semente(); gravarTudo(novo.paiois, novo.sens, novo.meds); return novo;
}
function gravarTudo(a, b, c){
  try{
    localStorage.setItem(K_PAIOIS, JSON.stringify(a ?? PAIOIS));
    localStorage.setItem(K_SENS,   JSON.stringify(b ?? SENS));
    localStorage.setItem(K_MED,    JSON.stringify(c ?? MEDICOES));
  }catch(e){}
}
function gravar(){ gravarTudo(); }

/* ══ Tradutores do protocolo DCM ═══════════════════════════════════ */

// status.xml — única fonte que traz OUT1/OUT2 (estado dos relés).
function deStatusXml(texto){
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('XML inválido');
  const v = t => { const n = doc.querySelector(t); return n ? num(n.textContent.trim()) : null; };
  const T = v('temperature'), U = v('humidity');
  return {
    temperatura:T, umidade:U, temp_ext:v('sonde'),
    orv: v('dewpoint') ?? orvalho(T,U),
    in1:v('input1')||0, in2:v('input2')||0, out1:v('output1')||0, out2:v('output2')||0,
    out_alarm:v('outputalarm')||0,
    dev_temp_max:v('temperature_max'), dev_temp_min:v('temperature_min'),
    dev_umid_max:v('humidity_max'),    dev_umid_min:v('humidity_min'),
    lido_em:new Date().toISOString(), erro:null,
  };
}

// status.json — traz firmware/MAC/modo das entradas, mas não os relés.
function deStatusJson(j){
  const T = num(j.temp), U = num(j.umid);
  return {
    firmware:j.firmware ?? null, mac:j.mac ?? null,
    temperatura:T, umidade:U, temp_ext:num(j.temp_ext),
    orv: num(j.dew) ?? orvalho(T,U),
    in1:num(j.input1)||0, in2:num(j.input2)||0,
    out_alarm:num(j.ouput_alarm ?? j.output_alarm)||0,   // "ouput_alarm": typo do firmware
    dev_temp_max:num(j.max_temp), dev_temp_min:num(j.min_temp),
    dev_umid_max:num(j.max_umid), dev_umid_min:num(j.min_umid),
    lido_em:new Date().toISOString(), erro:null,
  };
}

// DCM Cloud: cmd=getregisters devolve a série histórica do equipamento.
function deCloudRegisters(linhas){
  return (Array.isArray(linhas)?linhas:[]).map(r=>{
    const T = num(r.temperature ?? r.temp ?? r.temperatura);
    const U = num(r.humidity ?? r.umid ?? r.umidade);
    return { ts:r.datetime ?? r.date ?? r.timestamp, t:T, u:U, o:num(r.dewpoint ?? r.dew) ?? orvalho(T,U) };
  }).filter(p=>p.ts);
}

/* ══ Coleta ════════════════════════════════════════════════════════
   demo     → série determinística local
   gateway  → coletor próprio (FastAPI) que fala com os SE-10
   cloud    → DCM Cloud /cloud/api.php?token=…
   O navegador não alcança http://192.168.10.x a partir de uma página
   https: conteúdo misto e ausência de CORS no firmware. Por isso os
   modos de campo passam por um coletor.                          */
let COLETA = { ok:false, detalhe:'' };

async function buscar(url, ms){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), ms || CFG.rede.timeout || 3000);
  try{ return await fetch(url, { signal:ctl.signal }); }
  finally{ clearTimeout(t); }
}
function diagnostico(e, url){
  const https = location.protocol === 'https:';
  const http  = /^http:\/\//i.test(url);
  if(https && http) return 'bloqueio de conteúdo misto: esta página roda em https e o destino é http. Use o coletor.';
  if(e && e.name === 'AbortError') return 'sem resposta dentro do tempo limite.';
  return 'falha de rede ou CORS — o firmware do SE-10 não envia Access-Control-Allow-Origin.';
}
function urlCloud(cmd, extra){
  const h = String(CFG.cloud.host||'').replace(/\/+$/,'');
  const base = /^https?:\/\//i.test(h) ? h : 'http://'+h;
  return base + '/cloud/api.php?token=' + encodeURIComponent(CFG.cloud.token||'') + '&cmd=' + cmd + (extra||'');
}

async function testarColeta(){
  if(CFG.modo === 'demo'){ COLETA = { ok:false, detalhe:'dados de demonstração' }; return pintarConn(); }
  const url = CFG.modo === 'gateway'
    ? String(CFG.gateway).replace(/\/+$/,'') + '/api/v1/sensores'
    : urlCloud('gettime');
  try{
    const r = await buscar(url);
    COLETA = r.ok ? { ok:true, detalhe:(CFG.modo==='cloud'?'DCM Cloud':'coletor')+' respondendo' }
                  : { ok:false, detalhe:'HTTP '+r.status+' em '+url };
  }catch(e){ COLETA = { ok:false, detalhe:diagnostico(e, url) }; }
  pintarConn();
}
function pintarConn(){
  const el = $('conn'), tx = $('connTxt');
  el.classList.remove('demo','err');
  if(CFG.modo === 'demo'){ el.classList.add('demo'); tx.textContent = 'demonstração'; }
  else if(COLETA.ok){ tx.textContent = CFG.modo === 'cloud' ? 'DCM Cloud' : 'coletor'; }
  else { el.classList.add('err'); tx.textContent = 'sem coleta'; }
  el.title = COLETA.detalhe || '';
}

// Varredura: lê todos os sensores pela fonte configurada.
async function varrer(){
  const btn = $('btnVarrer'); btn.disabled = true;
  try{
    if(CFG.modo === 'demo'){
      PAIOIS.forEach((p,i)=>semear(p, sensorPrincipal(p), i));
    } else if(CFG.modo === 'gateway'){
      const r = await buscar(String(CFG.gateway).replace(/\/+$/,'') + '/api/v1/leituras/atuais');
      const linhas = await r.json();
      const porCodigo = Object.fromEntries((linhas||[]).map(x=>[x.codigo || x.sensor_codigo, x]));
      SENS.forEach(sen=>{
        const x = porCodigo[sen.paiol] || porCodigo[sen.rotulo];
        if(!x) return;
        Object.assign(sen, deStatusJson(x));
        if(x.output1 != null){ sen.out1 = num(x.output1); sen.out2 = num(x.output2); }
      });
    } else {
      const r = await buscar(urlCloud('getdevices'));
      const devs = await r.json();
      const porId = Object.fromEntries((Array.isArray(devs)?devs:[]).map(d=>[String(d.id), d]));
      SENS.forEach(sen=>{
        const d = porId[String(sen.id_cloud)]; if(!d) return;
        sen.temperatura = num(d.temperature ?? d.temp);
        sen.umidade = num(d.humidity ?? d.umid);
        sen.orv = orvalho(sen.temperatura, sen.umidade);
        sen.lido_em = d.datetime || new Date().toISOString();
        sen.erro = null;
      });
    }
    cacheSerie.clear();
    gravar(); await testarColeta(); desenhar();
  }catch(e){
    COLETA = { ok:false, detalhe:diagnostico(e, '') }; pintarConn();
    alerta('Varredura falhou: ' + COLETA.detalhe);
  }finally{ btn.disabled = false; }
}
function alerta(txt){
  const el = $('conn'); el.classList.add('err'); $('connTxt').textContent = 'sem coleta'; el.title = txt;
}

/* ══ Sensores e medições de um paiol ═══════════════════════════════ */
function sensoresDe(p){ return SENS.filter(x=>x.paiol === p.codigo); }
function sensorPrincipal(p){ const l = sensoresDe(p); return l.find(x=>x.ativo !== false) || l[0] || null; }
function temSensor(p){ return sensoresDe(p).some(x=>x.ativo !== false); }
function medicoesDe(cod){
  return MEDICOES.filter(m=>m.paiol === cod)
    .sort((a,b)=>String(b.em).localeCompare(String(a.em)));
}
function ultimaMedicao(cod){ return medicoesDe(cod)[0] || null; }

function minutosDesde(iso){
  if(!iso) return null;
  const d = new Date(String(iso).replace(' ','T'));
  if(isNaN(d)) return null;
  return (Date.now() - d.getTime())/60000;
}
function entradaAtiva(sen, n){
  const modo = sen['in'+n+'_modo'] || 'NA';
  const v = Number(sen['in'+n]) === 1;
  return modo === 'NF' ? !v : v;
}
function sensorVivo(sen){
  if(!sen || sen.ativo === false) return false;
  if(num(sen.temperatura)==null && num(sen.umidade)==null) return false;
  const m = minutosDesde(sen.lido_em);
  return m != null && m <= (CFG.limites.mudoMin || 60);
}
function sensorMudo(p){ const l = sensoresDe(p).filter(x=>x.ativo !== false); return l.length > 0 && !l.some(sensorVivo); }
function medicaoValida(p){
  const m = ultimaMedicao(p.codigo);
  if(!m || num(m.temperatura)==null) return false;
  const h = minutosDesde(m.em);
  return h != null && h <= (CFG.limites.manualValidadeH || 24) * 60;
}

/* ══ Leitura efetiva ═══════════════════════════════════════════════
   Tudo que avalia faixa lê daqui, para não existirem dois
   entendimentos do que é "a leitura do paiol". Sensor vivo tem
   precedência; sem ele, vale a medição manual dentro da validade. */
function leitura(p){
  let melhor = null, maisNovo = Infinity;
  sensoresDe(p).forEach(sen=>{
    if(!sensorVivo(sen)) return;
    const m = minutosDesde(sen.lido_em);
    if(m < maisNovo){ maisNovo = m;
      melhor = { t:num(sen.temperatura), u:num(sen.umidade), o:num(sen.orv),
                 em:sen.lido_em, manual:false, sensor:sen }; }
  });
  if(melhor) return melhor;
  const med = ultimaMedicao(p.codigo);
  if(medicaoValida(p)) return { t:num(med.temperatura), u:num(med.umidade),
    o:orvalho(num(med.temperatura), num(med.umidade)), em:med.em, manual:true, por:med.por };
  const sp = sensorPrincipal(p);
  return { t:null, u:null, o:null, em:(sp ? sp.lido_em : (med ? med.em : null)), manual:!temSensor(p),
           por:med ? med.por : null };
}

/* Quanto a leitura ultrapassa o limite, como fração da própria faixa.
   Faixa 18–27 °C tem 9 °C de amplitude: 20 % são 1,8 °C, então 27,5 °C
   é alarme e 29,0 °C é grave. A fração acompanha a faixa, então serve
   igual para umidade.                                              */
function desvio(p, qual){
  const L = leitura(p);
  const v  = qual==='t' ? L.t : L.u;
  const mn = qual==='t' ? p.temp_min : p.umid_min;
  const mx = qual==='t' ? p.temp_max : p.umid_max;
  if(v==null || mn==null || mx==null) return 0;
  const faixa = Math.abs(mx - mn) || 1;
  if(v > mx) return (v - mx)/faixa;
  if(v < mn) return (mn - v)/faixa;
  return 0;
}
function desvioMax(p){ return Math.max(desvio(p,'t'), desvio(p,'u')); }
function foraFaixa(p, qual){ return desvio(p, qual) > 0; }
function margemOrvalho(p){
  const L = leitura(p);
  return (L.t==null || L.o==null) ? null : +(L.t - L.o).toFixed(1);
}
function limitesDivergentes(p){
  return sensoresDe(p).some(sen=>
       (sen.dev_temp_max!=null && p.temp_max!=null && Math.abs(sen.dev_temp_max - p.temp_max) > 0.05)
    || (sen.dev_temp_min!=null && p.temp_min!=null && Math.abs(sen.dev_temp_min - p.temp_min) > 0.05));
}
// Entrada de sensor mudo não vale: o último estado conhecido pode ter
// horas e não diz nada sobre agora.
function fumaca(p){
  return sensoresDe(p).some(sen=> sensorVivo(sen)
    && ((sen.in1_func==='fumaca' && entradaAtiva(sen,1)) || (sen.in2_func==='fumaca' && entradaAtiva(sen,2))));
}

/* Severidade. A ordem embute uma decisão: medição manual fora de faixa
   vence a falha de comunicação, porque munição quente é mais urgente
   que sensor mudo; medição manual dentro da faixa não apaga o offline,
   senão ninguém volta para consertar o sensor.                      */
function estado(p){
  if(p.situacao === 'inativo') return 'offline';
  if(fumaca(p)) return 'crit';
  const L = leitura(p);
  if(L.t == null && L.u == null) return temSensor(p) ? 'offline' : 'vencido';
  const d = desvioMax(p);
  if(d > (CFG.mural.graveFrac ?? 0.20)) return 'grave';
  if(d > 0) return 'alarm';
  if(sensorMudo(p)) return 'offline';
  if(!temSensor(p) && !medicaoValida(p)) return 'vencido';
  const mg = margemOrvalho(p);
  if(mg != null && mg < (CFG.limites.margemOrvalho || 3)) return 'warn';
  if(limitesDivergentes(p)) return 'warn';
  return 'ok';
}
const SEV = {
  crit   :{ rot:'Fumaça',        cls:'s-crit',    dica:'Detector de fumaça acionado' },
  grave  :{ rot:'Desvio grave',  cls:'s-grave',   dica:'Ultrapassou o limite em mais de '+Math.round((CFG.mural.graveFrac??0.2)*100)+'% da faixa' },
  alarm  :{ rot:'Fora de faixa', cls:'s-alarm',   dica:'Temperatura ou umidade fora dos limites' },
  offline:{ rot:'Offline',       cls:'s-mute',    dica:'Sensor não responde há mais que o tempo limite' },
  vencido:{ rot:'A medir',       cls:'s-vencido', dica:'Paiol sem sensor com medição manual vencida' },
  warn   :{ rot:'Atenção',       cls:'s-warn',    dica:'Risco de condensação ou limites divergentes' },
  ok     :{ rot:'Normal',        cls:'s-ok',      dica:'Dentro dos limites' },
};
function pct(f){ return '+'+Math.round(f*100)+'%'; }
function motivo(p){
  const r = [], L = leitura(p);
  if(fumaca(p)) r.push('FUMAÇA');
  if(sensorMudo(p)){
    const sp = sensorPrincipal(p), m = sp ? minutosDesde(sp.lido_em) : null;
    r.push('sensor sem responder' + (m!=null ? ' há '+(m>=120 ? Math.round(m/60)+' h' : Math.round(m)+' min') : ''));
  }
  if(!temSensor(p) && !medicaoValida(p)) r.push('medição manual vencida');
  if(L.manual && L.t != null) r.push('valores de medição manual' + (L.por ? ' ('+L.por+')' : ''));
  if(foraFaixa(p,'t')) r.push('temp '+fmt(L.t)+' °C ('+pct(desvio(p,'t'))+' da faixa)');
  if(foraFaixa(p,'u')) r.push('umid '+fmt(L.u)+' % ('+pct(desvio(p,'u'))+' da faixa)');
  const mg = margemOrvalho(p);
  if(mg != null && mg < (CFG.limites.margemOrvalho || 3)) r.push('orvalho a '+fmt(mg)+' °C');
  if(limitesDivergentes(p)) r.push('limites do equipamento diferem do cadastro');
  if(sensoresDe(p).some(x=>x.out_alarm)) r.push('saída de alarme geral ativa');
  const acRuim = (p.ac||[]).filter(a=>a.situacao === 'inoperante');
  if(acRuim.length) r.push('AC'+acRuim.map(a=>a.n).join(' e AC')+' inoperante');
  return r.join(' · ');
}
function ocupacaoPct(p){
  return (p.capacidade && p.ocupacao != null) ? Math.round(100*p.ocupacao/p.capacidade) : null;
}

/* ══ Estado da interface ═══════════════════════════════════════════ */
const _db = carregarTudo();
let PAIOIS = _db.paiois, SENS = _db.sens, MEDICOES = _db.meds;
let vista = 'mapa', filtroSev = null, filtroGrupo = 'todos', busca = '', editando = null, aba = 'cad';
let modoSensores = 'mapa';
let mural = false, reconhecidos = new Set(), ultimoDesenho = Date.now(), temaAnterior = null;

/* Pisca só enquanto o alarme não foi reconhecido. Reconhecer não
   apaga o alarme: tira o piscar e o som, a cor permanece enquanto o
   desvio existir. Alarme novo gera assinatura nova e volta a piscar. */
function assinatura(s){ return s.codigo + ':' + estado(s); }
function naoReconhecido(s){
  const st = estado(s);
  return (st==='crit' || st==='grave') && !reconhecidos.has(assinatura(s));
}
function piscando(s){ return CFG.mural.piscar && naoReconhecido(s); }
function reconhecerTudo(){
  PAIOIS.forEach(s=>{ const st = estado(s); if(st!=='ok') reconhecidos.add(assinatura(s)); });
  pararSom(); desenhar();
}
function piorEstado(){
  for(const k of ['crit','grave','alarm','offline','vencido','warn']) if(PAIOIS.some(s=>estado(s)===k)) return k;
  return 'ok';
}

/* Ícones — traço simples, 24×24, sem preenchimento, para continuarem
   legíveis reduzidos a 9 px na etiqueta.                            */
const ICO = {
  termo:  '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  gota:   '<path d="M12 2.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5z"/>',
  chama:  '<path d="M4 18c2-1.6 4-1.6 6 0s4 1.6 6 0"/><path d="M4 13c2-1.6 4-1.6 6 0s4 1.6 6 0"/><path d="M13 8c2.5-1.5 3-3.5 2-6 3 1.5 4.5 4 3.5 6.5"/>',
  porta:  '<path d="M6 3h12v18H6z"/><path d="M14 12h.01"/>',
  panico: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
  gelo:   '<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/>',
  vento:  '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 14h14a3 3 0 1 1-3 3"/>',
  sirene: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  raio:   '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  mudo:   '<path d="M3 3l18 18"/><path d="M5 12.5a10 10 0 0 1 4-2.4"/><path d="M8.8 16.3a5 5 0 0 1 2.2-1.2"/><path d="M12 20h.01"/><path d="M19.5 12.2a10 10 0 0 0-4.7-2.6"/>',
  relogio:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  orvalho:'<path d="M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9z"/><path d="M3 21h18"/>',
  ok:     '<path d="M4 12.5 9.5 18 20 6.5"/>',
  prancheta:'<path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/>'
          + '<rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="M8.5 12h7M8.5 16h4"/>',
};
const ico = (k, cls) => '<svg class="'+(cls||'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICO[k]||'') + '</svg>';

function casaBusca(s){
  const q = busca.trim().toLowerCase();
  if(filtroSev && estado(s) !== filtroSev) return false;
  if(!q) return true;
  return [s.codigo,s.nome,s.descricao,s.localizacao,s.tipo,s.ip_cam]
    .concat(sensoresDe(s).map(x=>x.ip)).filter(Boolean)
    .some(v => String(v).toLowerCase().includes(q));
}

function desenhar(){
  const cont = {}; Object.keys(SEV).forEach(k=>cont[k]=0);
  PAIOIS.forEach(s=>cont[estado(s)]++);
  // O shell não tem badge de aba; a contagem entra no próprio rótulo,
  // que é o que o operador lê de relance sem abrir a aba.
  const pendentes = cont.crit + cont.grave + cont.alarm;
  const abaAl = document.querySelector('.nav-btn[data-view="alarmes"]');
  if(abaAl){
    const txt = abaAl.lastChild;
    if(txt && txt.nodeType === 3) txt.textContent = pendentes ? ' Alarmes (' + pendentes + ')' : ' Alarmes';
    abaAl.classList.toggle('nav-alerta', pendentes > 0);
  }

  const badge = (k, rot, n, ativo, dica) =>
    '<button class="sev '+(k?SEV[k].cls:'total')+(n===0&&k?' zero':'')+'" data-sev="'+(k||'')+'" '
    + 'aria-pressed="'+ativo+'" title="'+esc(dica)+'">'+(k?'<i></i>':'')
    + '<b>'+n+'</b><span>'+rot+'</span></button>';
  const pg = g => PAIOIS.filter(x=>grupoDe(x.codigo)===g).length;

  $('barra').innerHTML =
      badge(null, 'Todos', PAIOIS.length, !filtroSev, 'Todo o inventário')
    + [['crit','Fumaça'],['grave','Grave'],['alarm','Fora de faixa'],
       ['offline','Offline'],['vencido','Medir'],['warn','Atenção'],['ok','Normal']]
        .map(([k,rot])=>badge(k, rot, cont[k], filtroSev===k, SEV[k].dica)).join('')
    + '<span class="barra-sep"></span>'
    + '<div class="seg-toggle seg-sm" role="group" aria-label="Conjunto">'
    +   [['todos','Todos',PAIOIS.length],['golf','Golf',pg('golf')],
         ['uniform','Uniform',pg('uniform')],['isolado','Isolados',pg('isolado')]]
        .map(([k,rot,n])=>'<button class="seg-btn'+(filtroGrupo===k?' ativo':'')+'" data-grupo="'+k+'" aria-pressed="'+(filtroGrupo===k)+'">'
          + rot+' <b>'+n+'</b></button>').join('')
    + '</div>'
    + (['mapa','equip'].includes(vista)
        ? '<span class="barra-sep"></span><div class="seg-toggle seg-sm" role="group" aria-label="Modo de exibição">'
          + '<button class="seg-btn'+(vista==='mapa'?' ativo':'')+'" data-modo-sens="mapa" aria-pressed="'+(vista==='mapa')+'">Mapa</button>'
          + '<button class="seg-btn'+(vista==='equip'?' ativo':'')+'" data-modo-sens="equip" aria-pressed="'+(vista==='equip')+'">Lista</button></div>'
        : '')
    ;

  if(vista === 'mapa')  renderMapa();
  if(vista === 'equip') renderTabela();
  if(vista === 'paiois') renderPaiois();
  if(vista === 'med')    renderMedicoes();
  if(vista === 'hist')  renderHistorico();
  if(vista === 'rel')   renderBoletim();
  if(vista === 'cfg')   renderCfg();
  ultimoDesenho = Date.now();
  faixaMural();
}

/* Mapa: espelha a implantação — blocos 4×5 lado a lado, isolados por rua. */
function renderMapa(){
  const porCod = Object.fromEntries(PAIOIS.map(s=>[s.codigo.toUpperCase(), s]));
  const mostra = g => filtroGrupo==='todos' || filtroGrupo===g;
  let html = '';
  const blocos = [];
  if(mostra('golf'))    blocos.push(bloco('G','Golf',porCod));
  if(mostra('uniform')) blocos.push(bloco('U','Uniform',porCod));
  if(blocos.length) html += '<div class="blocks">'+blocos.join('')+'</div>';
  if(mostra('isolado')) html += blocoIsolados();
  $('mapa').innerHTML = html || '<div class="empty">Nenhum paiol neste grupo.</div>';
    $('mapa').querySelectorAll('canvas.spark').forEach(spark);
}
function bloco(pref, rot, porCod){
  const g = pref==='G' ? 'golf' : 'uniform';
  const n = PAIOIS.filter(s=>grupoDe(s.codigo)===g).length;
  let linhas = '';
  for(const b of EDIF){
    const cels = UNID.map(u=>{
      const s = porCod[(pref+'-'+b+'-'+u)];
      return s ? tile(s) : '<div class="gap"></div>';
    }).join('');
    linhas += '<div class="row"><div class="row-l">'+pref+'-'+b+'</div><div class="units">'+cels+'</div></div>';
  }
  return '<section class="block"><h2 class="block-h">'+rot+' <span class="n">'+n+'</span> <small>4 edifícios × 5 paióis</small></h2>'+linhas+'</section>';
}
function blocoIsolados(){
  const iso = PAIOIS.filter(s=>grupoDe(s.codigo)==='isolado')
    .sort((a,b)=>a.codigo.localeCompare(b.codigo, 'pt', {numeric:true}));
  if(!iso.length) return '';
  // Uma linha só: a rua já está no próprio código (D-5 é da rua 5), então
  // o rótulo lateral não carregava informação nova e custava largura.
  if(CFG.mural.ruas){
    const ruas = {};
    iso.forEach(s=>{ const r = (s.codigo.split('-')[1]||'?'); (ruas[r] = ruas[r]||[]).push(s); });
    const linhas = Object.keys(ruas).sort().map(r=>
      '<div class="row"><div class="row-l">Rua '+r+'</div><div class="units free">'
      + ruas[r].map(tile).join('') + '</div></div>').join('');
    return '<section class="block full"><h2 class="block-h">Isolados <span class="n">'+iso.length+'</span> <small>por rua</small></h2>'+linhas+'</section>';
  }
  return '<section class="block full"><h2 class="block-h">Isolados <span class="n">'+iso.length+'</span> <small>rua indicada no código</small></h2>'
    + '<div class="units linha" style="grid-template-columns:repeat('+iso.length+',minmax(0,1fr))">'
    + iso.map(tile).join('') + '</div></section>';
}

const ICO_FUNC = { fumaca:'chama', porta:'porta', panico:'panico', generico:'raio',
                   refrigeracao:'gelo', exaustor:'vento', sirene:'sirene' };
const SELO = {
  crit   : { ico:'chama',     rot:'Fumaça' },
  grave  : { ico:'sirene',    rot:null },
  alarm  : { ico:'sirene',    rot:'Fora' },
  offline: { ico:'mudo',      rot:'Offline' },
  vencido: { ico:'prancheta', rot:'Medir' },
  warn   : { ico:'orvalho',   rot:'Aten' },
};
function tile(s){
  const p = s;
  const st = estado(s), dim = !casaBusca(s), L = leitura(s);
  const pisca = piscando(s) ? ' pisca' : '';
  const selo = SELO[st];
  const rot = st==='grave' ? pct(desvioMax(s)) : (selo ? selo.rot : null);
  return '<button type="button" class="tile st-'+st+pisca+(dim?' dim':'')+'" data-paiol="'+esc(s.codigo)+'"'
    + ' title="'+esc(s.nome+' · '+SEV[st].rot+(motivo(s)?' — '+motivo(s):''))+'">'
    + '<span class="t-top"><span class="t-code">'+esc(s.codigo)+'</span>'
    +   (selo ? '<span class="t-sel">'+ico(selo.ico)+(rot?'<span>'+esc(rot)+'</span>':'')+'</span>' : '')
    + '</span>'
    + '<span class="t-body"><span class="reads">'
    +   linhaLeitura('termo', fmt(L.t), '°C', foraFaixa(s,'t'))
    +   linhaLeitura('gota',  fmt(L.u), '%',  foraFaixa(s,'u'))
    + '</span>'+colunaIO(s)+'</span>'
    + '<canvas class="spark" data-spark="'+s.id+'" aria-hidden="true"></canvas>'
    + '<span class="t-foot">'+ico(L.manual ? 'prancheta' : 'relogio')+esc(quando(L.em))
    +   ((p.ac||[]).some(a=>a.situacao==='inoperante')
        ? '<span class="t-ac" title="Ar-condicionado inoperante">'+ico('gelo')+'</span>' : '')
    +   (L.manual && st!=='offline' && st!=='vencido' ? '<span class="t-man">manual</span>' : '')
    +   (L.manual && st==='offline' ? '<span class="t-man">manual</span>' : '') + '</span>'
    + '</button>';
}
function linhaLeitura(k, v, u, hit){
  return '<span class="read">'+ico(k)+'<span class="rv'+(hit?' hit':'')+'">'+v+'<span class="u">'+u+'</span></span></span>';
}
function colunaIO(p){
  const d = [];
  const pt = (k, ativo, dica) => '<span class="iod'+(ativo?' on':'')+'" title="'+esc(dica)+'">'+ico(k)+'</span>';
  sensoresDe(p).forEach(sen=>{
    if(sen.ativo === false) return;
    if(sen.in1_func  !== 'off') d.push(pt(ICO_FUNC[sen.in1_func]  || 'raio', entradaAtiva(sen,1),  rotuloIO('in1',sen)));
    if(sen.in2_func  !== 'off') d.push(pt(ICO_FUNC[sen.in2_func]  || 'raio', entradaAtiva(sen,2),  rotuloIO('in2',sen)));
    if(sen.out1_func !== 'off') d.push(pt(ICO_FUNC[sen.out1_func] || 'raio', Number(sen.out1)===1, rotuloIO('out1',sen)));
    if(sen.out2_func !== 'off') d.push(pt(ICO_FUNC[sen.out2_func] || 'raio', Number(sen.out2)===1, rotuloIO('out2',sen)));
  });
  return d.length ? '<span class="io">'+d.slice(0,4).join('')+'</span>' : '';
}
const FUNC_ROT = { fumaca:'Detector de fumaça', porta:'Porta / intrusão', panico:'Botoeira de pânico',
  generico:'Entrada genérica', refrigeracao:'Contatora de refrigeração', exaustor:'Exaustor', sirene:'Sirene', off:'—' };
function rotuloIO(campo, s){
  const f = s[campo+'_func'];
  const nome = FUNC_ROT[f] || f;
  if(campo.startsWith('in')){
    const n = campo.slice(2);
    return nome + ' (' + (s[campo+'_modo']||'NA') + ') — ' + (entradaAtiva(s,n) ? 'ACIONADO' : 'normal');
  }
  return nome + ' — ' + (Number(s[campo.replace('_func','')])===1 ? 'ligada' : 'desligada');
}
function quando(iso){
  if(!iso) return 'sem leitura';
  const d = new Date(String(iso).replace(' ','T'));
  if(isNaN(d)) return String(iso);
  const p = n => String(n).padStart(2,'0');
  return p(d.getDate())+'/'+p(d.getMonth()+1)+' '+p(d.getHours())+':'+p(d.getMinutes());
}

/* Sparkline de duas faixas: temperatura em cima, umidade embaixo. */
function serie(s, k){
  let h = 0; for(const c of s.codigo) h = (h*31 + c.charCodeAt(0)) >>> 0;
  const L = leitura(s);
  const base = k==='t' ? L.t : L.u;
  const b = base==null ? (k==='t'?23:55) : base, amp = k==='t' ? 1.4 : 3.0, out = [];
  for(let i=0;i<16;i++){
    h = (h*1103515245 + 12345) & 0x7fffffff;
    out.push(b + (k==='t'?Math.sin(i/3.1):Math.cos(i/3.6))*amp + (((h>>9)%1000)/1000 - .5)*amp*.7);
  }
  out[out.length-1] = b;
  return out;
}
function spark(cv){
  const s = PAIOIS.find(x=>x.id===Number(cv.dataset.spark)); if(!s) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 106, H = Math.max(16, Math.round(cv.clientHeight) || 19);
  cv.width = W*dpr; cv.height = H*dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  // O card tem preenchimento sólido, então a série se separa do fundo por
  // opacidade e não por matiz: temperatura em cima e opaca, umidade
  // embaixo e mais leve.
  const tinta = getComputedStyle(cv).color;
  const corT = tinta, corU = tinta;
  const vao = 2, faixa = (H - vao)/2;
  const LS = leitura(s);
  [{k:'t',y:0,b:LS.t,c:corT,a:1},{k:'u',y:faixa+vao,b:LS.u,c:corU,a:.55}].forEach(f=>{
    if(f.b==null) return;
    const a = serie(s,f.k), mn = Math.min(...a), mx = Math.max(...a), r = (mx-mn)||1, bw = W/a.length;
    g.fillStyle = f.c;
    a.forEach((v,i)=>{
      const hh = 1.4 + (faixa-1.4)*((v-mn)/r);
      g.globalAlpha = i===a.length-1 ? 1 : .42;
      g.fillRect(i*bw+.4, f.y + (faixa-hh), Math.max(1,bw-.8), hh);
    });
  });
  g.globalAlpha = 1;
}

/* ══ Sensores instalados ═══════════════════════════════════════════ */
function listaFiltrada(){
  return PAIOIS.filter(p => casaBusca(p) && (filtroGrupo==='todos' || grupoDe(p.codigo)===filtroGrupo));
}
function renderTabela(){
  const paiois = listaFiltrada();
  const linhas = [];
  paiois.forEach(pl=>{
    const sens = sensoresDe(pl);
    if(!sens.length) linhas.push({ pl, sen:null });
    else sens.forEach(sen=>linhas.push({ pl, sen }));
  });
  $('eqCount').textContent = linhas.length + ' registros · ' + SENS.length + ' sensores em ' + PAIOIS.length + ' paióis';
  $('eqBody').innerHTML = linhas.length ? linhas.map(({pl, sen})=>{
    const st = estado(pl), L = leitura(pl);
    const vivo = sen ? sensorVivo(sen) : false;
    return '<tr>'
      + '<td><span class="dot st-'+st+'" title="'+esc(SEV[st].rot)+'"></span></td>'
      + '<td class="code"><button class="tinybtn" style="border:0;background:none;padding:0;color:inherit;font:inherit" data-paiol="'+esc(pl.codigo)+'">'+esc(pl.codigo)+'</button></td>'
      + '<td class="m">'+(sen ? esc(DRIVERS[sen.driver] ? DRIVERS[sen.driver].rot : sen.driver) : '<span class="hit">sem sensor</span>')+'</td>'
      + '<td class="m mono">'+(sen ? esc(sen.ip || sen.topico || '—') : '—')+'</td>'
      + '<td class="m mono">'+(sen ? esc(sen.mac || '—') : '—')+'</td>'
      + '<td class="n'+(foraFaixa(pl,'t')?' hit':'')+'">'+fmt(sen ? sen.temperatura : L.t)+'</td>'
      + '<td class="n'+(foraFaixa(pl,'u')?' hit':'')+'">'+fmt(sen ? sen.umidade : L.u)+'</td>'
      + '<td class="n m">'+fmt(sen ? sen.temp_ext : null)+'</td>'
      + '<td>'+(sen ? colunaIOSensor(sen) : '<span class="m">—</span>')+'</td>'
      + '<td class="'+(sen && !vivo ? 'hit' : 'm')+'">'+(sen ? quando(sen.lido_em) : '—')+'</td>'
      + '<td><button class="tinybtn" data-paiol="'+esc(pl.codigo)+'">Abrir</button></td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="11" class="m" style="text-align:center;padding:26px">Nenhum registro.</td></tr>';
}
function colunaIOSensor(sen){
  const d = [];
  const pt = (k, ativo, dica) => '<span class="iod'+(ativo?' on':'')+'" title="'+esc(dica)+'">'+ico(k)+'</span>';
  if(sen.in1_func  !== 'off') d.push(pt(ICO_FUNC[sen.in1_func]  || 'raio', entradaAtiva(sen,1),  rotuloIO('in1',sen)));
  if(sen.in2_func  !== 'off') d.push(pt(ICO_FUNC[sen.in2_func]  || 'raio', entradaAtiva(sen,2),  rotuloIO('in2',sen)));
  if(sen.out1_func !== 'off') d.push(pt(ICO_FUNC[sen.out1_func] || 'raio', Number(sen.out1)===1, rotuloIO('out1',sen)));
  if(sen.out2_func !== 'off') d.push(pt(ICO_FUNC[sen.out2_func] || 'raio', Number(sen.out2)===1, rotuloIO('out2',sen)));
  return d.length ? '<span class="io io-row">'+d.join('')+'</span>' : '<span class="m">—</span>';
}

/* ══ Relatório ═════════════════════════════════════════════════════ */
function renderRelatorio(){
  const cont = {}; Object.keys(SEV).forEach(k=>cont[k]=0);
  PAIOIS.forEach(s=>cont[estado(s)]++);
  const ordemRel = ['crit','grave','alarm','offline','vencido','warn'];
  const pend = PAIOIS.filter(s=>ordemRel.includes(estado(s)))
    .sort((a,b)=>ordemRel.indexOf(estado(a)) - ordemRel.indexOf(estado(b)));
  const grupos = ['golf','uniform','isolado'].map(g=>{
    const it = PAIOIS.filter(s=>grupoDe(s.codigo)===g);
    return { rot:NOME_GRUPO[g], n:it.length,
      cr:it.filter(s=>estado(s)==='crit').length,
      al:it.filter(s=>estado(s)==='alarm').length,
      mu:it.filter(s=>estado(s)==='offline').length,
      wa:it.filter(s=>estado(s)==='warn').length };
  });
  // Disponibilidade é da malha de sensores; paiol sem sensor não entra.
  const comSensor = PAIOIS.filter(x=>x.fonte !== 'manual');
  const disp = comSensor.length
    ? Math.round(100*(comSensor.length - comSensor.filter(x=>estado(x)==='offline').length)/comSensor.length) : 100;

  $('view-rel').innerHTML =
      '<div class="head-row"><h2>Relatório operacional</h2><span class="c">'+new Date().toLocaleString('pt-BR')+'</span></div>'
    + '<div class="repcards">'
    +  '<div class="repcard"><b>'+PAIOIS.length+'</b><span>Paióis monitorados</span></div>'
    +  '<div class="repcard"><b style="color:var(--crit)">'+cont.crit+'</b><span>Fumaça</span></div>'
    +  '<div class="repcard"><b style="color:var(--red)">'+cont.alarm+'</b><span>Fora de faixa</span></div>'
    +  '<div class="repcard"><b style="color:var(--text3)">'+cont.offline+'</b><span>Offline</span></div>'
    +  '<div class="repcard"><b style="color:var(--yellow)">'+cont.vencido+'</b><span>A medir</span></div>'
    +  '<div class="repcard"><b style="color:var(--yellow)">'+cont.warn+'</b><span>Atenção</span></div>'
    +  '<div class="repcard"><b>'+disp+'%</b><span>Disponibilidade da malha</span></div>'
    + '</div>'
    + '<div class="sect">Por conjunto</div>'
    + '<div class="scroll"><table class="dt" style="min-width:560px"><thead><tr><th>Conjunto</th><th class="n">Paióis</th><th class="n">Fumaça</th><th class="n">Fora de faixa</th><th class="n">Sem comunicar</th><th class="n">Atenção</th></tr></thead><tbody>'
    + grupos.map(g=>'<tr><td><strong>'+esc(g.rot)+'</strong></td><td class="n">'+g.n+'</td>'
        +'<td class="n'+(g.cr?' hit':' m')+'">'+g.cr+'</td><td class="n'+(g.al?' hit':' m')+'">'+g.al+'</td>'
        +'<td class="n'+(g.mu?' hit':' m')+'">'+g.mu+'</td><td class="n m">'+g.wa+'</td></tr>').join('')
    + '</tbody></table></div>'
    + '<div class="sect">Pendências ('+pend.length+')</div>'
    + '<div class="scroll"><table class="dt"><thead><tr><th></th><th>Paiol</th><th>Tipo</th><th>Situação</th><th class="n">Temp</th><th class="n">Umid</th><th class="n">Δ orv.</th><th>Ocorrência</th><th>Última leitura</th></tr></thead><tbody>'
    + (pend.length ? pend.map(s=>{ const st = estado(s);
        const L = leitura(s);
        return '<tr><td><span class="dot st-'+st+'"></span></td><td class="code">'+esc(s.codigo)+'</td>'
        + '<td class="m">'+esc(s.tipo||'—')+'</td><td>'+esc(SEV[st].rot)+'</td>'
        + '<td class="n'+(foraFaixa(s,'t')?' hit':'')+'">'+fmt(L.t)+'</td>'
        + '<td class="n'+(foraFaixa(s,'u')?' hit':'')+'">'+fmt(L.u)+'</td>'
        + '<td class="n m">'+fmt(margemOrvalho(s))+'</td>'
        + '<td>'+esc(motivo(s)||'—')+'</td><td class="m">'+quando(L.em)+'</td></tr>';
      }).join('') : '<tr><td colspan="9" class="m" style="text-align:center;padding:24px">Nenhuma pendência.</td></tr>')
    + '</tbody></table></div>'
    + '<div class="note info" style="margin-top:18px">A disponibilidade da malha considera sem comunicar todo sensor cuja última leitura passou de '
    + (CFG.limites.mudoMin||60) + ' min, e considera apenas paióis com sensor instalado. Ajuste o limite em Rede &amp; Integração.</div>';
}

/* ══ Página Paióis ═════════════════════════════════════════════════ */
function criarPaiol(){
  const cod = prompt('Código do novo paiol (ex.: T-9):');
  if(!cod) return;
  if(PAIOIS.some(x=>x.codigo.toUpperCase() === cod.toUpperCase())){ alert('Já existe um paiol com esse código.'); return; }
  const novo = novoPaiol(cod.toUpperCase().trim(), PAIOIS.length);
  novo.id = PAIOIS.reduce((a,x)=>Math.max(a, x.id||0), 0) + 1;
  novo.ip_cam = null;
  PAIOIS.push(novo); gravar(); desenhar(); abrir(novo.codigo);
}
function renderPaiois(){
  const lista = listaFiltrada();
  const capTotal = lista.reduce((a,p)=>a + (p.capacidade||0), 0);
  const ocTotal  = lista.reduce((a,p)=>a + (p.ocupacao||0), 0);
  const acRuins  = lista.reduce((a,p)=>a + (p.ac||[]).filter(x=>x.situacao==='inoperante').length, 0);

  const pillAC = a => {
    if(!a || a.situacao === 'não possui') return '<span class="ac-pill nada">—</span>';
    const cls = a.situacao === 'operante' ? 'ok' : a.situacao === 'inoperante' ? 'mau' : '';
    return '<span class="ac-pill '+cls+'" title="'+esc([a.marca,a.modelo,a.btu?a.btu+' BTU':'',a.tombo?'tombo '+a.tombo:''].filter(Boolean).join(' · '))+'">'
      + (a.btu ? (a.btu/1000)+'k' : 'AC'+a.n) + '</span>';
  };

  $('view-paiois').innerHTML =
      '<div class="head-row"><h2>Paióis</h2><span class="c">'+lista.length+' de '+PAIOIS.length+'</span>'
    +   '<button class="btn btn-s btn-sm sp" id="paiolNovo">Novo paiol</button></div>'
    + '<div class="repcards">'
    +   '<div class="repcard"><b>'+lista.length+'</b><span>Paióis</span></div>'
    +   '<div class="repcard"><b>'+(capTotal ? Math.round(100*ocTotal/capTotal)+'%' : '—')+'</b><span>Ocupação média</span></div>'
    +   '<div class="repcard"><b>'+fmt(ocTotal,0)+'</b><span>Volume armazenado</span></div>'
    +   '<div class="repcard"><b style="color:'+(acRuins?'var(--red)':'inherit')+'">'+acRuins+'</b><span>AC inoperantes</span></div>'
    +   '<div class="repcard"><b>'+lista.filter(p=>!temSensor(p)).length+'</b><span>Sem sensor</span></div>'
    + '</div>'
    + '<div class="scroll"><table class="dt" style="min-width:1080px"><thead><tr>'
    +   '<th></th><th>Código</th><th>Tipo</th><th>Local</th><th style="min-width:110px">Ocupação</th>'
    +   '<th class="n">Capac.</th><th class="n">Temp mín</th><th class="n">Temp máx</th>'
    +   '<th class="n">Umid mín</th><th class="n">Umid máx</th><th>AC1</th><th>AC2</th>'
    +   '<th class="n">Sensores</th><th class="n">Itens</th><th></th>'
    + '</tr></thead><tbody>'
    + (lista.length ? lista.map(p=>{
        const oc = ocupacaoPct(p), st = estado(p);
        return '<tr>'
        + '<td><span class="dot st-'+st+'" title="'+esc(SEV[st].rot)+'"></span></td>'
        + '<td class="code">'+esc(p.codigo)+'</td>'
        + '<td>'+esc(p.tipo||'—')+'</td>'
        + '<td class="m">'+esc(p.localizacao||'—')+'</td>'
        + '<td><div class="ocup"><b>'+(oc==null?'—':oc+'%')+'</b>'
        +   (oc==null ? '' : '<div class="barrinha"><span style="width:'+Math.min(100,oc)+'%;background:'
              + (oc>95?'var(--red)':oc>85?'var(--yellow)':'var(--green)')+'"></span></div>')+'</div></td>'
        + '<td class="n m">'+(p.capacidade==null?'—':fmt(p.capacidade,0)+' '+esc(p.unidade||''))+'</td>'
        + '<td class="n">'+fmt(p.temp_min)+'</td><td class="n">'+fmt(p.temp_max)+'</td>'
        + '<td class="n">'+fmt(p.umid_min)+'</td><td class="n">'+fmt(p.umid_max)+'</td>'
        + '<td>'+pillAC((p.ac||[])[0])+'</td><td>'+pillAC((p.ac||[])[1])+'</td>'
        + '<td class="n'+(temSensor(p)?' m':' hit')+'">'+sensoresDe(p).length+'</td>'
        + '<td class="n m">'+((p.inventario||[]).length||'—')+'</td>'
        + '<td><button class="tinybtn" data-paiol="'+esc(p.codigo)+'">Abrir</button></td>'
        + '</tr>';
      }).join('') : '<tr><td colspan="15" class="m" style="text-align:center;padding:26px">Nenhum paiol.</td></tr>')
    + '</tbody></table></div>'
    + '<div class="note info">Clique em qualquer paiol para abrir a ficha, com inventário, climatização e sensores.</div>';
}

/* ══ Página Medições ═══════════════════════════════════════════════ */
let medFiltro = 'pendentes';
function renderMedicoes(){
  const todos = listaFiltrada();
  const filtros = [['pendentes','A medir'],['manual','Sem sensor'],['sensor','Com sensor'],['todos','Todos']];
  const lista = todos.filter(p=>
      medFiltro === 'todos' ? true
    : medFiltro === 'manual' ? !temSensor(p)
    : medFiltro === 'sensor' ? temSensor(p)
    : precisaMedir(p));
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const hojeN = MEDICOES.filter(m=>new Date(m.em) >= hoje).length;

  $('view-med').innerHTML =
      '<div class="head-row"><h2>Medições diárias</h2>'
    +   '<span class="c">'+hojeN+' lançadas hoje · '+todos.filter(precisaMedir).length+' pendentes</span>'
    +   '<button class="btn btn-p btn-sm sp" id="rondaTudo">Ronda manual</button></div>'
    + '<div class="ctrls" style="margin-bottom:12px"><div class="seg-toggle seg-sm" role="group" aria-label="Filtro">'
    +   filtros.map(([k,r])=>'<button class="seg-btn'+(medFiltro===k?' ativo':'')+'" data-medf="'+k+'" aria-pressed="'+(medFiltro===k)+'">'+r+'</button>').join('')
    + '</div></div>'
    + '<div class="scroll"><table class="dt" style="min-width:920px"><thead><tr>'
    +   '<th></th><th>Paiol</th><th>Tipo</th><th>Faixa de referência</th><th>Origem</th>'
    +   '<th class="n">Temp °C</th><th class="n">Umid %</th><th>Quando</th><th>Por</th><th></th>'
    + '</tr></thead><tbody>'
    + (lista.length ? lista.map(p=>{
        const L = leitura(p), st = estado(p), m = ultimaMedicao(p.codigo);
        const origem = L.manual ? 'manual' : (temSensor(p) ? 'sensor' : '—');
        return '<tr>'
        + '<td><span class="dot st-'+st+'" title="'+esc(SEV[st].rot)+'"></span></td>'
        + '<td class="code"><button class="tinybtn" style="border:0;background:none;padding:0;color:inherit;font:inherit" data-paiol="'+esc(p.codigo)+'">'+esc(p.codigo)+'</button></td>'
        + '<td class="m">'+esc(p.tipo||'—')+'</td>'
        + '<td><span class="med-ref">'+fmt(p.temp_min,0)+'–'+fmt(p.temp_max,0)+' °C &nbsp; '
        +   fmt(p.umid_min,0)+'–'+fmt(p.umid_max,0)+' %</span></td>'
        + '<td class="m">'+origem+'</td>'
        + '<td class="n'+(foraFaixa(p,'t')?' hit':'')+'">'+fmt(L.t)+'</td>'
        + '<td class="n'+(foraFaixa(p,'u')?' hit':'')+'">'+fmt(L.u)+'</td>'
        + '<td class="'+(precisaMedir(p)?'hit':'m')+'">'+quando(L.em)+'</td>'
        + '<td class="m">'+esc((m && m.por) || '—')+'</td>'
        + '<td><button class="btn btn-s btn-sm" data-medir="'+esc(p.codigo)+'">Medir</button></td>'
        + '</tr>';
      }).join('') : '<tr><td colspan="10" class="m" style="text-align:center;padding:26px">Nada neste filtro.</td></tr>')
    + '</tbody></table></div>'
    + '<div class="note info">A faixa de referência fica visível na hora de lançar, no celular também: quem mede não '
    + 'precisa lembrar de cor o limite de cada paiol. Medição fora da faixa aparece destacada assim que é gravada.</div>';
}

/* ══ Boletim diário ════════════════════════════════════════════════ */
function renderBoletim(){
  const d = new Date();
  const p2 = n => String(n).padStart(2,'0');
  const dataBr = p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear();
  const cont = {}; Object.keys(SEV).forEach(k=>cont[k]=0);
  PAIOIS.forEach(p=>cont[estado(p)]++);
  const pend = PAIOIS.filter(p=>['crit','grave','alarm','offline','vencido','warn'].includes(estado(p)));
  const comSensor = PAIOIS.filter(temSensor);
  const disp = comSensor.length ? Math.round(100*(comSensor.length - comSensor.filter(p=>estado(p)==='offline').length)/comSensor.length) : 100;
  const inicioDia = new Date(); inicioDia.setHours(0,0,0,0);
  const medHoje = MEDICOES.filter(m=>new Date(m.em) >= inicioDia);

  $('view-rel').innerHTML =
      '<div class="head-row no-print"><h2>Boletim diário</h2><span class="c">'+dataBr+'</span>'
    +   '<button class="btn btn-s btn-sm sp" id="btImprimir">Imprimir</button></div>'
    + '<div class="folha">'
    +   '<div class="org">Marinha do Brasil · CMASM · Divisão de Manutenção Especializada</div>'
    +   '<h1>Boletim diário de condições ambientais dos paióis</h1>'
    +   '<div class="meta"><span><b>Data:</b> '+dataBr+'</span><span><b>Emitido às:</b> '+p2(d.getHours())+':'+p2(d.getMinutes())+'</span>'
    +     '<span><b>Paióis:</b> '+PAIOIS.length+'</span><span><b>Disponibilidade da malha:</b> '+disp+'%</span>'
    +     '<span><b>Medições lançadas hoje:</b> '+medHoje.length+'</span></div>'

    +   '<table><thead><tr><th>Situação</th><th class="n">Paióis</th><th>Códigos</th></tr></thead><tbody>'
    +   ['crit','grave','alarm','offline','vencido','warn','ok'].filter(k=>cont[k]).map(k=>
          '<tr><td>'+SEV[k].rot+'</td><td class="n">'+cont[k]+'</td><td class="code" style="font-size:10px">'
          + PAIOIS.filter(p=>estado(p)===k).map(p=>p.codigo).join('  ')+'</td></tr>').join('')
    +   '</tbody></table>'

    +   '<h1 style="font-size:13px;margin-top:20px">Ocorrências ('+pend.length+')</h1>'
    +   '<table><thead><tr><th>Paiol</th><th>Tipo</th><th class="n">Temp</th><th class="n">Umid</th>'
    +     '<th>Origem</th><th>Ocorrência</th></tr></thead><tbody>'
    +   (pend.length ? pend.map(p=>{ const L = leitura(p);
        return '<tr><td class="code">'+esc(p.codigo)+'</td><td>'+esc(p.tipo||'')+'</td>'
        + '<td class="n">'+fmt(L.t)+'</td><td class="n">'+fmt(L.u)+'</td>'
        + '<td>'+(L.manual ? 'manual' : 'sensor')+'</td><td>'+esc(motivo(p))+'</td></tr>'; }).join('')
        : '<tr><td colspan="6">Nenhuma ocorrência no período.</td></tr>')
    +   '</tbody></table>'

    +   '<h1 style="font-size:13px;margin-top:20px">Leituras por paiol</h1>'
    +   '<table><thead><tr><th>Paiol</th><th>Tipo</th><th class="n">Temp °C</th><th class="n">Umid %</th>'
    +     '<th class="n">Orv. °C</th><th>Faixa</th><th>Origem</th><th>Hora</th></tr></thead><tbody>'
    +   PAIOIS.slice().sort((a,b)=>a.codigo.localeCompare(b.codigo,'pt',{numeric:true})).map(p=>{
        const L = leitura(p);
        return '<tr><td class="code">'+esc(p.codigo)+'</td><td>'+esc(p.tipo||'')+'</td>'
        + '<td class="n">'+fmt(L.t)+'</td><td class="n">'+fmt(L.u)+'</td><td class="n">'+fmt(L.o)+'</td>'
        + '<td class="n" style="font-size:10px">'+fmt(p.temp_min,0)+'–'+fmt(p.temp_max,0)+' / '+fmt(p.umid_min,0)+'–'+fmt(p.umid_max,0)+'</td>'
        + '<td>'+(L.t==null ? '—' : (L.manual ? 'manual' : 'sensor'))+'</td>'
        + '<td>'+quando(L.em)+'</td></tr>'; }).join('')
    +   '</tbody></table>'

    +   '<div class="assina"><div>Encarregado da Seção de Eletrônica</div><div>Ajudante da DME</div></div>'
    + '</div>';
  $('btImprimir').addEventListener('click', ()=>window.print());
}

/* ══ Rede & Integração ═════════════════════════════════════════════ */
function faixaPrevista(){
  return CODIGOS.map((c,i)=>({ codigo:c, ip:ipSensor(i), cam:ipCamera(i), cloud: CFG.cloud.idPrimeiro ? CFG.cloud.idPrimeiro+i : null }));
}
function problemasFaixa(){
  const p = [], f = faixaPrevista();
  const ultimo = Number(CFG.rede.primeiro) + CODIGOS.length - 1;
  if(!Number.isFinite(Number(CFG.rede.primeiro)) || CFG.rede.primeiro < 1)
    p.push('O primeiro endereço precisa ser um número entre 1 e 254.');
  else if(ultimo > 254)
    p.push('A faixa estoura a sub-rede: '+CODIGOS.length+' paióis a partir de .'+CFG.rede.primeiro+' terminariam em .'+ultimo+'. Comece em .'+(254-CODIGOS.length+1)+' ou antes.');
  if(CFG.cam.ativo){
    const a = Number(CFG.rede.primeiro), b = Number(CFG.cam.primeiro);
    const mesmaRede = String(CFG.rede.base).replace(/\.?$/,'.') === String(CFG.cam.base).replace(/\.?$/,'.');
    if(mesmaRede && !(b + CODIGOS.length - 1 < a || b > a + CODIGOS.length - 1))
      p.push('As faixas de sensor e de câmera se sobrepõem na mesma sub-rede.');
  }
  const vistos = new Set();
  f.forEach(x=>{ if(x.ip){ if(vistos.has(x.ip)) p.push('IP repetido: '+x.ip); vistos.add(x.ip); } });
  return p;
}

function renderCfg(){
  const c = CFG, prev = faixaPrevista(), probs = problemasFaixa();
  const opt = (v,r,sel) => '<option value="'+v+'"'+(sel===v?' selected':'')+'>'+r+'</option>';

  $('view-cfg').innerHTML =
   '<div class="head-row"><h2>Rede &amp; Integração</h2><span class="c">Configuração salva neste navegador</span>'
   + '<button class="btn btn-s btn-sm sp" id="cfgExp">Exportar configuração</button>'
   + '<button class="btn btn-s btn-sm" id="cfgImp">Importar</button></div>'

   + '<div class="cfg-grid">'

   /* 1 — origem das leituras */
   + '<div class="panel"><h3>Origem das leituras</h3>'
   + '<p class="desc">Onde o painel busca temperatura, umidade e estado dos relés.</p>'
   + '<div class="seg-toggle" role="group" aria-label="Modo de coleta">'
   +   ['demo','gateway','cloud'].map(m=>'<button data-modo="'+m+'" aria-pressed="'+(c.modo===m)+'">'
       + ({demo:'Demonstração',gateway:'Coletor',cloud:'DCM Cloud'}[m])+'</button>').join('')
   + '</div>'
   + '<div class="fgrid" style="margin-top:12px">'
   +   '<div class="f full"><label for="cGw">Endereço do coletor</label><input id="cGw" class="mono" value="'+esc(c.gateway)+'">'
   +     '<div class="h">Serviço próprio que fala com os SE-10 e expõe JSON ao painel.</div></div>'
   + '</div>'
   + '<div class="note"><b>Por que um coletor é necessário.</b> Esta página roda em https; o SE-10 responde em http e não envia cabeçalho CORS. O navegador bloqueia a leitura direta de <code>http://'+esc(c.rede.base)+'x/status.xml</code> nos dois motivos. Quem varre a faixa precisa estar dentro da rede do CMASM.</div>'
   + '<div class="btnrow"><button class="btn btn-s btn-sm" id="cfgTestar">Testar conexão</button><span class="msg" id="cfgTesteMsg">'+esc(COLETA.detalhe||'')+'</span></div>'
   + '</div>'

   /* 2 — faixa de IP */
   + '<div class="panel"><h3>Faixa de IP dos sensores</h3>'
   + '<p class="desc">Os '+CODIGOS.length+' paióis recebem endereços sequenciais na ordem do inventário: blocos Golf (G-5-I…G-8-V), Uniform (U-5-I…U-8-V) e os isolados.</p>'
   + '<div class="fgrid">'
   +   '<div class="f"><label for="cBase">Sub-rede</label><input id="cBase" class="mono" value="'+esc(c.rede.base)+'"><div class="h">Ex.: 192.168.10.</div></div>'
   +   '<div class="f"><label for="cPrim">Primeiro endereço</label><input id="cPrim" class="mono" type="number" min="1" max="254" value="'+c.rede.primeiro+'"></div>'
   +   '<div class="f"><label for="cPorta">Porta HTTP</label><input id="cPorta" class="mono" type="number" value="'+c.rede.porta+'"></div>'
   +   '<div class="f"><label for="cTimeout">Tempo limite (ms)</label><input id="cTimeout" class="mono" type="number" value="'+c.rede.timeout+'"></div>'
   +   '<div class="f"><label for="cUser">Usuário</label><input id="cUser" class="mono" value="'+esc(c.rede.usuario)+'"></div>'
   +   '<div class="f"><label for="cSenha">Senha</label><input id="cSenha" class="mono" type="password" value="'+esc(c.rede.senha)+'"></div>'
   +   '<div class="f full"><label for="cInt">Intervalo de varredura (s)</label><input id="cInt" class="mono" type="number" value="'+c.rede.intervalo+'">'
   +     '<div class="h">O DCM Cloud grava a cada 2, 5, 15 ou 30 min ou 1 h. Varrer mais rápido que isso só faz sentido na leitura direta.</div></div>'
   + '</div>'
   + (c.rede.usuario==='admin' && c.rede.senha==='admin'
      ? '<div class="note"><b>Credencial de fábrica em uso.</b> O SE-10 sai com admin/admin. Troque nos 49 equipamentos antes de considerar a instalação entregue.</div>' : '')
   + '<div id="avisosIp">'+(probs.length ? '<div class="note">'+probs.map(esc).join('<br>')+'</div>' : '')+'</div>' 
   + '<div class="btnrow"><button class="btn btn-p btn-sm" id="cfgAplicarIp">Aplicar aos '+CODIGOS.length+' paióis</button>'
   +   '<button class="btn btn-s btn-sm" id="cfgCsvIn">Importar CSV</button>'
   +   '<span class="msg" id="cfgIpMsg"></span></div>'
   + '</div>'

   /* 3 — DCM Cloud */
   + '<div class="panel"><h3>DCM Cloud</h3>'
   + '<p class="desc">Fonte de histórico e de alarmes já persistidos. Exige Cloud 1.3.2 ou superior com a API habilitada em CONFIGURAÇÕES / API.</p>'
   + '<div class="fgrid">'
   +   '<div class="f full"><label for="cHost">Endereço do servidor</label><input id="cHost" class="mono" value="'+esc(c.cloud.host)+'"></div>'
   +   '<div class="f full"><label for="cToken">Token</label><input id="cToken" class="mono" type="password" value="'+esc(c.cloud.token)+'">'
   +     '<div class="h">Gerado em CONFIGURAÇÕES / API. Fica só neste navegador — não é enviado a lugar nenhum além do próprio servidor.</div></div>'
   +   '<div class="f full"><label for="cIdPrim">Primeiro ID de equipamento</label><input id="cIdPrim" class="mono" type="number" value="'+(c.cloud.idPrimeiro||'')+'">'
   +     '<div class="h">Numeração sequencial presumida. Confira com <code>cmd=getdevices</code> e corrija caso a caso no cadastro.</div></div>'
   + '</div>'
   + '<div class="sect" style="margin:14px 0 7px">Comandos disponíveis</div>'
   + '<dl class="kv">'
   +   '<dt>gettime</dt><dd>relógio do servidor</dd>'
   +   '<dt>getgroups</dt><dd>grupos cadastrados</dd>'
   +   '<dt>getdevices</dt><dd>equipamentos ativos</dd>'
   +   '<dt>getregisters</dt><dd>leituras por id + start + finish</dd>'
   +   '<dt>getalarms</dt><dd>alarmes por id + start + finish</dd>'
   + '</dl>'
   + '<div class="btnrow"><button class="btn btn-s btn-sm" id="cfgCloudTeste">Testar token</button><span class="msg" id="cfgCloudMsg"></span></div>'
   + '</div>'

   /* 4 — câmeras */
   + '<div class="panel"><h3>Câmeras dos paióis</h3>'
   + '<p class="desc">Cada paiol monitorado tem uma câmera dome IP. Ative para gerar os endereços junto com os dos sensores.</p>'
   + '<div class="fgrid">'
   +   '<div class="f full"><label for="cCamOn">Gerar IP de câmera</label><select id="cCamOn">'+opt('0','Não',c.cam.ativo?'1':'0')+opt('1','Sim',c.cam.ativo?'1':'0')+'</select></div>'
   +   '<div class="f"><label for="cCamBase">Sub-rede</label><input id="cCamBase" class="mono" value="'+esc(c.cam.base)+'"></div>'
   +   '<div class="f"><label for="cCamPrim">Primeiro endereço</label><input id="cCamPrim" class="mono" type="number" min="1" max="254" value="'+c.cam.primeiro+'"></div>'
   + '</div>'
   + '<div class="note info">Sem confirmação da faixa real das câmeras, o painel deixa o campo vazio em vez de inventar endereço. Preencha aqui ou importe o CSV de campo.</div>'
   + '</div>'

   /* 5 — limites */
   + '<div class="panel"><h3>Limites padrão e severidade</h3>'
   + '<p class="desc">Aplicados a paióis novos e, sob demanda, a todo o inventário.</p>'
   + '<div class="fgrid">'
   +   '<div class="f"><label for="cTmin">Temp. mín °C</label><input id="cTmin" class="mono" type="number" step="0.1" value="'+c.limites.temp_min+'"></div>'
   +   '<div class="f"><label for="cTmax">Temp. máx °C</label><input id="cTmax" class="mono" type="number" step="0.1" value="'+c.limites.temp_max+'"></div>'
   +   '<div class="f"><label for="cUmin">Umid. mín %</label><input id="cUmin" class="mono" type="number" step="0.1" value="'+c.limites.umid_min+'"></div>'
   +   '<div class="f"><label for="cUmax">Umid. máx %</label><input id="cUmax" class="mono" type="number" step="0.1" value="'+c.limites.umid_max+'"></div>'
   +   '<div class="f"><label for="cOrv">Margem de orvalho °C</label><input id="cOrv" class="mono" type="number" step="0.1" value="'+c.limites.margemOrvalho+'">'
   +     '<div class="h">Alerta quando a temperatura do ar chega a essa distância do ponto de orvalho — condensação sobre a munição.</div></div>'
   +   '<div class="f"><label for="cMudo">Offline após (min)</label><input id="cMudo" class="mono" type="number" value="'+c.limites.mudoMin+'">'
   +     '<div class="h">Passado esse tempo a leitura do sensor deixa de valer e o paiol sai do verde.</div></div>'
   +   '<div class="f"><label for="cManVal">Medição manual vale por (h)</label><input id="cManVal" class="mono" type="number" value="'+c.limites.manualValidadeH+'">'
   +     '<div class="h">Vencida, o paiol sem sensor entra na lista "A medir". Define a periodicidade da ronda.</div></div>'
   + '</div>'
   + '<div class="btnrow"><button class="btn btn-s btn-sm" id="cfgAplicarLim">Aplicar a todos os paióis</button><span class="msg" id="cfgLimMsg"></span></div>'
   + '</div>'

   /* 6 — I/O padrão */
   + '<div class="panel"><h3>Entradas e saídas padrão</h3>'
   + '<p class="desc">O SE-10 tem duas entradas optoacopladas e dois relés secos de 5 A. Estes valores viram o padrão de cada paiol novo.</p>'
   + '<div class="fgrid">'
   +   '<div class="f"><label for="cIn1f">IN1</label><select id="cIn1f">'+['fumaca','porta','panico','generico','off'].map(v=>opt(v,FUNC_ROT[v]||'Não usada',c.io.in1_func)).join('')+'</select></div>'
   +   '<div class="f"><label for="cIn1m">IN1 — contato</label><select id="cIn1m">'+opt('NA','N.A.',c.io.in1_modo)+opt('NF','N.F. supervisionado',c.io.in1_modo)+'</select></div>'
   +   '<div class="f"><label for="cIn2f">IN2</label><select id="cIn2f">'+['porta','fumaca','panico','generico','off'].map(v=>opt(v,FUNC_ROT[v]||'Não usada',c.io.in2_func)).join('')+'</select></div>'
   +   '<div class="f"><label for="cIn2m">IN2 — contato</label><select id="cIn2m">'+opt('NA','N.A.',c.io.in2_modo)+opt('NF','N.F. supervisionado',c.io.in2_modo)+'</select></div>'
   +   '<div class="f full"><label for="cOut1f">OUT1</label><select id="cOut1f">'+['refrigeracao','exaustor','sirene','generico','off'].map(v=>opt(v,FUNC_ROT[v]||'Não usada',c.io.out1_func)).join('')+'</select></div>'
   + '</div>'
   + (c.io.in1_func==='fumaca' && c.io.in1_modo==='NA'
      ? '<div class="note"><b>Fumaça em contato N.A. não é supervisionada.</b> Cabo rompido ou detector sem alimentação fica indistinguível de repouso. A prática corrente em detecção é laço N.F.: verifique a fiação e, se for o caso, troque o modo aqui e no equipamento.</div>' : '')
   + '</div>'


   /* 7 — mural */
   + '<div class="panel"><h3>Mural da portaria</h3>'
   + '<p class="desc">Tela cheia sem barra de navegação, dimensionada para caber inteira sem rolagem. Entra pelo botão Mural ou abrindo a página com <code>#mural</code> no fim do endereço — assim a TV já sobe direto no modo certo.</p>'
   + '<div class="fgrid">'
   +   '<div class="f"><label for="cGrave">Desvio grave acima de (% da faixa)</label><input id="cGrave" class="mono" type="number" min="1" max="200" value="'+Math.round((c.mural.graveFrac??0.2)*100)+'">'
   +     '<div class="h">Faixa de '+fmt(c.limites.temp_min,0)+' a '+fmt(c.limites.temp_max,0)+' °C tem '+fmt(Math.abs(c.limites.temp_max-c.limites.temp_min),0)+' °C de amplitude: '
   +     Math.round((c.mural.graveFrac??0.2)*100)+' % são '+fmt(Math.abs(c.limites.temp_max-c.limites.temp_min)*(c.mural.graveFrac??0.2))+' °C acima de '+fmt(c.limites.temp_max,0)+' °C.</div></div>'
   +   '<div class="f"><label for="cPiscar">Piscar alarme</label><select id="cPiscar">'+opt('1','Sim',c.mural.piscar?'1':'0')+opt('0','Não',c.mural.piscar?'1':'0')+'</select></div>'
   +   '<div class="f"><label for="cSom">Alarme sonoro</label><select id="cSom">'+opt('1','Sim',c.mural.som?'1':'0')+opt('0','Não',c.mural.som?'1':'0')+'</select></div>'
   +   '<div class="f"><label for="cVol">Volume</label><input id="cVol" class="mono" type="number" min="0" max="1" step="0.05" value="'+c.mural.volume+'"></div>'
   +   '<div class="f"><label for="cAutoAck">Parar de piscar após (min)</label><input id="cAutoAck" class="mono" type="number" min="0" value="'+c.mural.autoAck+'">'
   +     '<div class="h">Zero mantém piscando até alguém reconhecer.</div></div>'
   +   '<div class="f"><label for="cTema">Tema do mural</label><select id="cTema">'+opt('escuro','Escuro',c.mural.tema)+opt('claro','Claro',c.mural.tema)+opt('sistema','Seguir o sistema',c.mural.tema)+'</select></div>'
   +   '<div class="f full"><label for="cRuas">Isolados</label><select id="cRuas">'+opt('0','Uma linha só',c.mural.ruas?'1':'0')+opt('1','Agrupados por rua',c.mural.ruas?'1':'0')+'</select></div>'
   + '</div>'
   + '<div class="note"><b>Piscar sinaliza alarme não reconhecido, não gravidade.</b> É a prática da ISA-18.2: o que pisca é o que ninguém viu ainda. Uma tela que pisca a noite inteira vira paisagem e o sentinela deixa de olhar. Reconhecer (botão, Enter ou barra de espaço) tira o piscar e o som; a cor fica enquanto o desvio existir.</div>'
   + '<div class="note info">O navegador só toca som depois de um clique na página — em TV, alguém precisa apertar Ativar som uma vez a cada vez que a página recarregar. Se o alarme sonoro for requisito de serviço, o lugar dele é uma sirene comandada pelo relé do SE-10 ou pelo trap SNMP, não pela aba do navegador.</div>'
   + '<div class="note info">Em TV OLED, imagem parada 24 h marca a tela. O mural já entra em tema escuro por isso; num painel LCD comum não faz diferença.</div>'
   + '</div>'
   + '</div>' /* fim cfg-grid */

   /* alocação prevista */
   + '<div class="sect">Alocação prevista</div>'
   + '<div class="scroll"><table class="dt" style="min-width:640px"><thead><tr><th>#</th><th>Paiol</th><th>Conjunto</th><th>IP do sensor</th><th>IP da câmera</th><th>ID no Cloud</th><th>Em uso</th></tr></thead><tbody id="prevBody">'
   + linhasPrevisao()
   + '</tbody></table></div>'

   /* contrato do coletor */
   + '<div class="sect">Contrato esperado do coletor</div>'
   + '<div class="panel">'
   + '<p class="desc">Rotas que o serviço em <code class="mono">'+esc(c.gateway)+'</code> precisa expor para o painel sair da demonstração.</p>'
   + '<div class="ep"><span class="lbl">GET</span><span class="u">/api/v1/sensores</span></div>'
   + '<div class="ep"><span class="lbl">GET</span><span class="u">/api/v1/leituras/atuais → [{codigo, temp, umid, temp_ext, dew, input1, input2, output1, output2, ouput_alarm, firmware, mac}]</span></div>'
   + '<div class="ep"><span class="lbl">GET</span><span class="u">/api/v1/sensores/{codigo}/historico?horas=24 → [{ts, temperature, humidity, dewpoint}]</span></div>'
   + '<div class="ep"><span class="lbl">POST</span><span class="u">/api/v1/sensores/{codigo}/saida {canal: 1|2, estado: 0|1}</span></div>'
   + '<div class="ep"><span class="lbl">GET</span><span class="u">/api/v1/relatorios/agregado?periodo=semana|mes&de=&ate= → [{codigo, ini, temp_media, temp_min, temp_max, umid_media, umid_min, umid_max, quedas, min_offline, min_fora_faixa}]</span></div>'
   + '<div class="note info">Os nomes de campo acima são os do próprio firmware, inclusive <code>ouput_alarm</code>, que sai grafado assim no status.json do SE-10. Repassar sem renomear evita uma tradução a mais entre o coletor e o painel.</div>'
   + '</div>';

   ligarCfg();
}

function linhasPrevisao(){
  return faixaPrevista().map((x,i)=>{
    const atual = PAIOIS.find(s=>s.codigo === x.codigo);
    const igual = atual && atual.ip === x.ip;
    return '<tr><td class="m mono">'+(i+1)+'</td><td class="code">'+esc(x.codigo)+'</td>'
     + '<td class="m">'+NOME_GRUPO[grupoDe(x.codigo)]+'</td>'
     + '<td class="mono">'+esc(x.ip||'—')+'</td>'
     + '<td class="mono m">'+esc(x.cam||'—')+'</td>'
     + '<td class="mono m">'+(x.cloud??'—')+'</td>'
     + '<td class="mono '+(igual?'m':'hit')+'">'+esc(atual?(atual.ip||'—'):'—')+'</td></tr>';
  }).join('');
}
function atualizarPrevisao(){
  const b = $('prevBody'); if(b) b.innerHTML = linhasPrevisao();
  const a = $('avisosIp');
  if(a){ const p = problemasFaixa(); a.innerHTML = p.length ? '<div class="note">'+p.map(esc).join('<br>')+'</div>' : ''; }
  pintarConn();
}

function ligarCfg(){
  const liga = (id, aplicar) => { const el = $(id); if(el) el.addEventListener('change', ()=>{ aplicar(el); gravarCfg(); atualizarPrevisao(); }); };
  document.querySelectorAll('[data-modo]').forEach(b=>b.addEventListener('click', async ()=>{
    CFG.modo = b.dataset.modo; gravarCfg(); await testarColeta(); desenhar();
  }));
  liga('cGw',   e=>CFG.gateway = e.value.trim());
  liga('cBase', e=>CFG.rede.base = e.value.trim());
  liga('cPrim', e=>CFG.rede.primeiro = Number(e.value));
  liga('cPorta',e=>CFG.rede.porta = Number(e.value));
  liga('cTimeout', e=>CFG.rede.timeout = Number(e.value));
  liga('cUser', e=>CFG.rede.usuario = e.value);
  liga('cSenha',e=>CFG.rede.senha = e.value);
  liga('cInt',  e=>CFG.rede.intervalo = Number(e.value));
  liga('cHost', e=>CFG.cloud.host = e.value.trim());
  liga('cToken',e=>CFG.cloud.token = e.value.trim());
  liga('cIdPrim', e=>CFG.cloud.idPrimeiro = Number(e.value)||null);
  liga('cCamOn',e=>CFG.cam.ativo = e.value === '1');
  liga('cCamBase', e=>CFG.cam.base = e.value.trim());
  liga('cCamPrim', e=>CFG.cam.primeiro = Number(e.value));
  ['temp_min','temp_max','umid_min','umid_max'].forEach((k,i)=>
    liga(['cTmin','cTmax','cUmin','cUmax'][i], e=>CFG.limites[k] = num(e.value)));
  liga('cOrv',  e=>CFG.limites.margemOrvalho = num(e.value));
  liga('cMudo', e=>CFG.limites.mudoMin = num(e.value));
  liga('cManVal', e=>CFG.limites.manualValidadeH = Math.max(1, num(e.value) ?? 24));
  liga('cIn1f', e=>CFG.io.in1_func = e.value);  liga('cIn1m', e=>CFG.io.in1_modo = e.value);
  liga('cIn2f', e=>CFG.io.in2_func = e.value);  liga('cIn2m', e=>CFG.io.in2_modo = e.value);
  liga('cOut1f',e=>CFG.io.out1_func = e.value);
  liga('cGrave',  e=>CFG.mural.graveFrac = Math.max(0.01, (num(e.value)||20)/100));
  liga('cPiscar', e=>CFG.mural.piscar = e.value === '1');
  liga('cSom',    e=>{ CFG.mural.som = e.value === '1'; atualizarBotaoSom(); });
  liga('cVol',    e=>CFG.mural.volume = Math.min(1, Math.max(0, num(e.value) ?? .35)));
  liga('cAutoAck',e=>CFG.mural.autoAck = Math.max(0, num(e.value) ?? 0));
  liga('cTema',   e=>CFG.mural.tema = e.value);
  liga('cRuas',   e=>CFG.mural.ruas = e.value === '1');

  $('cfgTestar').addEventListener('click', async ()=>{
    $('cfgTesteMsg').textContent = 'testando…';
    await testarColeta();
    const el = $('cfgTesteMsg'); el.textContent = COLETA.detalhe; el.className = 'msg ' + (COLETA.ok?'ok':'err');
  });
  $('cfgCloudTeste').addEventListener('click', async ()=>{
    const m = $('cfgCloudMsg'); m.className = 'msg'; m.textContent = 'consultando…';
    try{
      const r = await buscar(urlCloud('gettime'));
      const t = await r.text();
      m.className = 'msg ' + (r.ok ? 'ok' : 'err');
      m.textContent = r.ok ? ('servidor respondeu: ' + t.slice(0,60)) : ('HTTP ' + r.status);
    }catch(e){ m.className = 'msg err'; m.textContent = diagnostico(e, urlCloud('gettime')); }
  });
  $('cfgAplicarIp').addEventListener('click', ()=>{
    const probs = problemasFaixa();
    if(probs.length){ const m = $('cfgIpMsg'); m.className='msg err'; m.textContent = probs[0]; return; }
    faixaPrevista().forEach((x,i)=>{
      let s = PAIOIS.find(y=>y.codigo === x.codigo);
      if(!s){ s = novoSensor(x.codigo, i); PAIOIS.push(s); }
      s.ip = x.ip; s.ip_cam = x.cam || null; if(x.cloud) s.id_cloud = x.cloud;
    });
    gravar();
    const m = $('cfgIpMsg'); m.className='msg ok'; m.textContent = CODIGOS.length + ' endereços aplicados.';
    desenhar();
  });
  $('cfgAplicarLim').addEventListener('click', ()=>{
    PAIOIS.forEach(s=>{
      s.temp_min = CFG.limites.temp_min; s.temp_max = CFG.limites.temp_max;
      s.umid_min = CFG.limites.umid_min; s.umid_max = CFG.limites.umid_max;
    });
    gravar();
    const m = $('cfgLimMsg'); m.className='msg ok'; m.textContent = 'Limites aplicados a ' + PAIOIS.length + ' paióis.';
    desenhar();
  });
  $('cfgExp').addEventListener('click', ()=>baixar('paiol-config.json', JSON.stringify({cfg:CFG, sensores:PAIOIS}, null, 2)));
  $('cfgImp').addEventListener('click', ()=>escolherArquivo('.json', txt=>{
    try{
      const j = JSON.parse(txt);
      if(j.cfg) CFG = fundir(structuredClone(CFG_PADRAO), j.cfg);
      if(Array.isArray(j.sensores) && j.sensores.length) PAIOIS = j.sensores;
      gravarCfg(); gravar(); desenhar();
    }catch(e){ alert('Arquivo inválido: ' + e.message); }
  }));
  $('cfgCsvIn').addEventListener('click', ()=>escolherArquivo('.csv,.txt', importarCsv));
}

/* CSV de campo: código;ip[;ip_camera] — separador , ou ; */
function importarCsv(txt){
  const linhas = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let n = 0, novos = 0;
  linhas.forEach(l=>{
    const p = l.split(/[;,\t]/).map(x=>x.trim());
    if(p.length < 2) return;
    const cod = p[0].toUpperCase();
    if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(p[1])) return;   // pula cabeçalho
    let s = PAIOIS.find(x=>x.codigo.toUpperCase() === cod);
    if(!s){ s = novoSensor(cod, PAIOIS.length); PAIOIS.push(s); novos++; }
    s.ip = p[1];
    if(p[2] && /^\d{1,3}(\.\d{1,3}){3}$/.test(p[2])) s.ip_cam = p[2];
    n++;
  });
  gravar(); desenhar();
  const m = $('cfgIpMsg'); if(m){ m.className='msg ok'; m.textContent = n+' linhas importadas'+(novos?(', '+novos+' paióis novos'):'')+'.'; }
}
function exportarCsv(){
  const l = ['codigo;ip;ip_camera;id_cloud;temp_min;temp_max;umid_min;umid_max']
    .concat(PAIOIS.map(pl=>{ const sen = sensorPrincipal(pl) || {};
      return [pl.codigo, sen.ip||'', pl.ip_cam||'', sen.id_cloud??'',
              pl.temp_min??'', pl.temp_max??'', pl.umid_min??'', pl.umid_max??''].join(';'); }));
  baixar('paiol-sensores.csv', l.join('\n'));
}
/* Downloads iniciados pela própria página não funcionam dentro do
   visualizador de artefatos. Exportar e importar passam por um painel
   de texto: copiar daqui, colar ali.                               */
function baixar(nome, conteudo){ painelTexto('Exportar — ' + nome, conteudo, null); }
function escolherArquivo(accept, cb){ painelTexto('Importar', '', cb); }

function painelTexto(titulo, conteudo, aoImportar){
  const antigo = document.getElementById('overlay'); if(antigo) antigo.remove();
  const o = document.createElement('div');
  o.id = 'overlay'; o.className = 'modal open';
  o.innerHTML = '<div class="modal-bg" data-fecha></div><div class="modal-box" role="dialog" aria-modal="true">'
    + '<div class="modal-h"><div><h2 style="font-family:var(--ff);font-size:15px">' + titulo + '</h2>'
    + '<div class="sub">' + (aoImportar ? 'Cole o conteúdo e confirme.' : 'Selecione tudo e copie.') + '</div></div>'
    + '<button class="x" data-fecha aria-label="Fechar">×</button></div>'
    + '<div class="modal-b"><div class="f"><textarea id="ovTxt" class="mono" rows="14" spellcheck="false"'
    + (aoImportar ? '' : ' readonly') + '>' + esc(conteudo) + '</textarea></div></div>'
    + '<div class="modal-f"><span class="msg" id="ovMsg"></span><button class="btn btn-s sp" data-fecha>Fechar</button>'
    + (aoImportar ? '<button class="btn btn-p" id="ovOk">Importar</button>'
                  : '<button class="btn btn-p" id="ovCopy">Copiar tudo</button>') + '</div></div>';
  document.body.appendChild(o);
  o.addEventListener('click', e=>{ if(e.target.hasAttribute('data-fecha')) o.remove(); });
  const ta = o.querySelector('#ovTxt');
  if(aoImportar){
    ta.focus();
    o.querySelector('#ovOk').addEventListener('click', ()=>{ aoImportar(ta.value); o.remove(); });
  } else {
    ta.select();
    o.querySelector('#ovCopy').addEventListener('click', ()=>{
      navigator.clipboard?.writeText(conteudo).then(()=>{ o.querySelector('#ovMsg').textContent = 'Copiado.'; });
    });
  }
}

/* ══ Ficha do paiol ════════════════════════════════════════════════ */
let aberto = null, abaAtual = 'paiol', rascunho = null;

function abrir(cod){
  const p = typeof cod === 'object' ? cod : PAIOIS.find(x=>x.codigo === cod || x.id === cod);
  if(!p) return;
  aberto = p.codigo;
  rascunho = JSON.parse(JSON.stringify(p));
  const st = estado(p);
  $('mTitle').textContent = p.codigo;
  $('mSub').textContent = [p.nome, p.tipo, SEV[st].rot].filter(Boolean).join(' · ');
  $('btnExcluir').hidden = false;
  msg('');
  trocarAba('paiol');
  $('modal').classList.add('open'); $('modal').setAttribute('aria-hidden','false');
}
function fechar(){ $('modal').classList.remove('open'); $('modal').setAttribute('aria-hidden','true'); aberto = null; }
function msg(t, k){ const e = $('mMsg'); e.textContent = t||''; e.className = 'msg' + (k?' '+k:''); }
function paiolAberto(){ return PAIOIS.find(x=>x.codigo === aberto); }

function trocarAba(a){
  abaAtual = a;
  document.querySelectorAll('#mTabs [data-aba]').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.aba === a)));
  ['paiol','inv','clima','sens','med','hist'].forEach(k=>{ $('pane-'+k).hidden = k !== a; });
  const p = paiolAberto(); if(!p) return;
  if(a === 'paiol') $('pane-paiol').innerHTML = fichaPaiol(p);
  if(a === 'inv')   renderInventario();
  if(a === 'clima') $('pane-clima').innerHTML = fichaClima(p);
  if(a === 'sens')  $('pane-sens').innerHTML  = fichaSensores(p);
  if(a === 'med')   $('pane-med').innerHTML   = fichaMedicoes(p);
  if(a === 'hist')  carregarHistorico(p);
  $('btnSalvar').hidden = (a === 'hist' || a === 'med');
}

const campo = (id, rot, val, tipo, dica) =>
  '<div class="f"><label for="'+id+'">'+rot+'</label>'
  + '<input id="'+id+'" '+(tipo||'')+' value="'+esc(val==null?'':val)+'">'
  + (dica ? '<div class="h">'+dica+'</div>' : '') + '</div>';
const sel = (id, rot, val, opcoes, dica) =>
  '<div class="f"><label for="'+id+'">'+rot+'</label><select id="'+id+'">'
  + opcoes.map(o=>{ const [v,r] = Array.isArray(o) ? o : [o,o];
      return '<option value="'+esc(v)+'"'+(String(val)===String(v)?' selected':'')+'>'+esc(r)+'</option>'; }).join('')
  + '</select>'+(dica ? '<div class="h">'+dica+'</div>' : '')+'</div>';

function fichaPaiol(p){
  const L = leitura(p), mg = margemOrvalho(p), oc = ocupacaoPct(p);
  const cel = (rot, val, alerta) => '<div class="f"><label>'+rot+'</label><div class="mono" style="font-size:17px'
    + (alerta ? ';color:var(--red);font-weight:600' : '') + '">'+val+'</div></div>';
  return '<div class="sect" style="margin-top:0">Leitura atual</div>'
    + '<div class="fgrid">'
    +   cel('Temperatura', fmt(L.t)+' °C', foraFaixa(p,'t'))
    +   cel('Umidade', fmt(L.u)+' %', foraFaixa(p,'u'))
    +   cel('Ponto de orvalho', fmt(L.o)+' °C', false)
    +   cel('Margem até o orvalho', fmt(mg)+' °C', mg!=null && mg < (CFG.limites.margemOrvalho||3))
    +   cel('Origem', L.manual ? 'Medição manual'+(L.por?' — '+esc(L.por):'') : (temSensor(p) ? 'Sensor' : 'Sem sensor'), L.manual)
    +   cel('Lida em', quando(L.em), ['offline','vencido'].includes(estado(p)))
    + '</div>'
    + (motivo(p) ? '<div class="note"><b>Ocorrências.</b> '+esc(motivo(p))+'</div>' : '')

    + '<div class="sect">Identificação</div><div class="fgrid">'
    +   campo('fCodigo','Código', p.codigo, 'class="mono"')
    +   campo('fNome','Nome', p.nome)
    +   sel('fTipo','Tipo de paiol', p.tipo, TIPOS_PAIOL)
    +   sel('fStatus','Situação', p.situacao, [['ativo','Ativo'],['manutencao','Em manutenção'],['inativo','Inativo']])
    +   campo('fLocal','Local', p.localizacao)
    +   campo('fCam','IP da câmera', p.ip_cam, 'class="mono"')
    +   '<div class="f full"><label for="fDesc">Observação</label><input id="fDesc" value="'+esc(p.descricao||'')+'"></div>'
    + '</div>'

    + '<div class="sect">Capacidade e ocupação</div><div class="fgrid">'
    +   campo('fCap','Capacidade', p.capacidade, 'type="number" class="mono"')
    +   campo('fOcu','Ocupação', p.ocupacao, 'type="number" class="mono"')
    +   sel('fUni','Unidade', p.unidade, UNIDADES)
    +   '<div class="f"><label>Ocupação</label><div class="mono" style="font-size:17px">'
    +     (oc==null ? '—' : oc+' %')+'</div>'
    +     (oc!=null ? '<div class="barrinha"><span style="width:'+Math.min(100,oc)+'%;background:'
        + (oc>95?'var(--red)':oc>85?'var(--yellow)':'var(--green)')+'"></span></div>' : '')+'</div>'
    + '</div>'

    + '<div class="sect">Limites de alarme</div><div class="fgrid">'
    +   campo('fTmin','Temp. mín °C', p.temp_min, 'type="number" step="0.1" class="mono"')
    +   campo('fTmax','Temp. máx °C', p.temp_max, 'type="number" step="0.1" class="mono"')
    +   campo('fUmin','Umid. mín %', p.umid_min, 'type="number" step="0.1" class="mono"')
    +   campo('fUmax','Umid. máx %', p.umid_max, 'type="number" step="0.1" class="mono"')
    + '</div>'
    + (limitesDivergentes(p)
        ? '<div class="note"><b>Limites divergentes.</b> Pelo menos um sensor está gravado com faixa diferente da cadastrada aqui. '
          + 'Quem dispara o relé e o e-mail é o equipamento — alinhe os dois.</div>' : '');
}

function salvarPaiol(){
  const p = paiolAberto(); if(!p) return;
  if(abaAtual !== 'paiol'){ gravar(); desenhar(); msg('Salvo.', 'ok'); return; }
  const v = id => { const e = $(id); return e ? e.value.trim() : null; };
  const n = id => { const e = $(id); return e ? num(e.value) : null; };
  if(!v('fCodigo')){ msg('Informe o código.', 'err'); return; }
  Object.assign(p, {
    codigo:v('fCodigo'), nome:v('fNome'), tipo:v('fTipo'), situacao:v('fStatus'),
    localizacao:v('fLocal'), ip_cam:v('fCam') || null, descricao:v('fDesc'),
    capacidade:n('fCap'), ocupacao:n('fOcu'), unidade:v('fUni'),
    temp_min:n('fTmin'), temp_max:n('fTmax'), umid_min:n('fUmin'), umid_max:n('fUmax'),
  });
  gravar(); desenhar(); msg('Salvo.', 'ok');
  $('mSub').textContent = [p.nome, p.tipo, SEV[estado(p)].rot].filter(Boolean).join(' · ');
}
function excluirPaiol(){
  const p = paiolAberto(); if(!p) return;
  if(!confirm('Excluir o paiol '+p.codigo+', seus sensores e suas medições?')) return;
  PAIOIS = PAIOIS.filter(x=>x.codigo !== p.codigo);
  SENS = SENS.filter(x=>x.paiol !== p.codigo);
  MEDICOES = MEDICOES.filter(x=>x.paiol !== p.codigo);
  gravar(); fechar(); desenhar();
}

/* ── Inventário ─────────────────────────────────────────────────── */
function renderInventario(){
  const p = paiolAberto(); if(!p) return;
  p.inventario = p.inventario || [];
  const total = p.inventario.reduce((a,x)=>a + (num(x.qtd)||0), 0);
  $('pane-inv').innerHTML =
      '<div class="head-row" style="margin-bottom:8px"><h3 style="font-size:13px">Conteúdo do paiol</h3>'
    +   '<span class="c">'+p.inventario.length+' itens · '+fmt(total,0)+' '+esc(p.unidade||'un')+'</span>'
    +   '<button class="btn btn-s btn-sm sp" id="invAdd">Adicionar item</button></div>'
    + '<div class="scroll"><table class="dt" style="min-width:680px"><thead><tr>'
    +   '<th>Código do item</th><th>Descrição</th><th>Lote</th><th class="n">Qtd</th><th>Validade</th><th>Obs.</th><th></th>'
    + '</tr></thead><tbody>'
    + (p.inventario.length ? p.inventario.map((it,i)=>'<tr>'
        + tdEdit('cod', i, it.cod, 'mono')
        + tdEdit('desc', i, it.desc)
        + tdEdit('lote', i, it.lote, 'mono')
        + tdEdit('qtd', i, it.qtd, 'mono n', 'number')
        + tdEdit('val', i, it.val, 'mono', 'date')
        + tdEdit('obs', i, it.obs)
        + '<td><button class="tinybtn" data-invdel="'+i+'">Remover</button></td></tr>').join('')
      : '<tr><td colspan="7" class="m" style="text-align:center;padding:22px">Inventário vazio.</td></tr>')
    + '</tbody></table></div>'
    + '<div class="note info"><b>Dados de exemplo.</b> O inventário real só deve ser carregado quando o app rodar '
    + 'contra o coletor dentro da rede do CMASM. Enquanto esta página estiver hospedada fora, use conteúdo genérico.</div>';

  $('pane-inv').querySelectorAll('[data-inv]').forEach(el=>{
    el.addEventListener('change', ()=>{
      const { campo:c, linha } = el.dataset.inv ? JSON.parse(el.dataset.inv) : {};
      p.inventario[linha][c] = el.type === 'number' ? num(el.value) : el.value;
      gravar();
    });
  });
  $('pane-inv').querySelectorAll('[data-invdel]').forEach(b=>b.addEventListener('click', ()=>{
    p.inventario.splice(Number(b.dataset.invdel), 1); gravar(); renderInventario();
  }));
  $('invAdd').addEventListener('click', ()=>{
    p.inventario.push({ cod:'', desc:'', lote:'', qtd:null, val:'', obs:'' });
    gravar(); renderInventario();
  });
}
function tdEdit(c, linha, val, cls, tipo){
  return '<td><input class="cel '+(cls||'')+'" type="'+(tipo||'text')+'" value="'+esc(val==null?'':val)+'" '
    + "data-inv='"+JSON.stringify({campo:c, linha})+"'></td>";
}

/* ── Climatização ───────────────────────────────────────────────── */
function fichaClima(p){
  p.ac = p.ac && p.ac.length ? p.ac : [acVazio(1,''), acVazio(2,'')];
  const bloco = (a, i) => '<div class="panel" style="margin-bottom:12px"><h3>AC'+a.n+'</h3>'
    + '<div class="fgrid">'
    +   campo('ac'+i+'marca','Marca', a.marca)
    +   campo('ac'+i+'modelo','Modelo', a.modelo)
    +   campo('ac'+i+'btu','Capacidade (BTU/h)', a.btu, 'type="number" class="mono"')
    +   campo('ac'+i+'tombo','Tombamento', a.tombo, 'class="mono"')
    +   sel('ac'+i+'sit','Situação', a.situacao, SIT_AC)
    +   sel('ac'+i+'saida','Comandado por', a.saida, [['','Não comandado'],['out1','Relé OUT1'],['out2','Relé OUT2']])
    + '</div></div>';
  return p.ac.map(bloco).join('')
    + '<div class="note info">O tombamento liga este equipamento ao PMOC. Um AC marcado como inoperante põe o paiol '
    + 'em Atenção mesmo com a temperatura ainda dentro da faixa: é o aviso que chega antes do alarme, enquanto ainda '
    + 'dá tempo de agir sem pressa.</div>';
}
function salvarClima(){
  const p = paiolAberto(); if(!p) return;
  p.ac.forEach((a,i)=>{
    a.marca = $('ac'+i+'marca').value.trim();
    a.modelo = $('ac'+i+'modelo').value.trim();
    a.btu = num($('ac'+i+'btu').value);
    a.tombo = $('ac'+i+'tombo').value.trim();
    a.situacao = $('ac'+i+'sit').value;
    a.saida = $('ac'+i+'saida').value;
  });
  gravar(); desenhar();
}

/* ── Sensores do paiol ──────────────────────────────────────────── */
function fichaSensores(p){
  const lista = sensoresDe(p);
  return '<div class="head-row" style="margin-bottom:10px"><h3 style="font-size:13px">Sensores deste paiol</h3>'
    +   '<span class="c">'+lista.length+'</span>'
    +   '<button class="btn btn-s btn-sm sp" id="senAdd">Adicionar sensor</button></div>'
    + (lista.length ? lista.map((sen,i)=>{
        const d = DRIVERS[sen.driver] || DRIVERS.outro;
        return '<div class="panel" style="margin-bottom:12px">'
        + '<div class="head-row" style="margin-bottom:8px"><h3>'+esc(sen.rotulo || ('Sensor '+(i+1)))+'</h3>'
        +   '<span class="c">'+(sensorVivo(sen) ? 'respondendo' : 'sem resposta')+' · '+quando(sen.lido_em)+'</span>'
        +   '<button class="tinybtn sp" data-sendel="'+sen.id+'">Remover</button></div>'
        + '<div class="fgrid">'
        +   sel('sn'+i+'drv','Driver', sen.driver, Object.entries(DRIVERS).map(([k,v])=>[k, v.rot]))
        +   campo('sn'+i+'rot','Rótulo', sen.rotulo, '', 'Ex.: câmara fria, fundo, entrada')
        +   (d.topico
              ? campo('sn'+i+'top','Tópico MQTT', sen.topico, 'class="mono"', 'Ex.: cmasm/paiol/'+p.codigo.toLowerCase()+'/estado')
              : campo('sn'+i+'ip','Endereço IP', sen.ip, 'class="mono"'))
        +   campo('sn'+i+'mod','Modelo', sen.modelo)
        +   campo('sn'+i+'mac','MAC', sen.mac, 'class="mono"')
        +   campo('sn'+i+'cld','ID no DCM Cloud', sen.id_cloud, 'type="number" class="mono"')
        +   sel('sn'+i+'in1f','IN1', sen.in1_func, ['fumaca','porta','panico','generico','off'].map(v=>[v, FUNC_ROT[v]||'Não usada']))
        +   sel('sn'+i+'in1m','IN1 — contato', sen.in1_modo, [['NA','N.A.'],['NF','N.F. supervisionado']])
        +   sel('sn'+i+'in2f','IN2', sen.in2_func, ['porta','fumaca','panico','generico','off'].map(v=>[v, FUNC_ROT[v]||'Não usada']))
        +   sel('sn'+i+'in2m','IN2 — contato', sen.in2_modo, [['NA','N.A.'],['NF','N.F. supervisionado']])
        +   sel('sn'+i+'o1f','OUT1', sen.out1_func, ['refrigeracao','exaustor','sirene','generico','off'].map(v=>[v, FUNC_ROT[v]||'Não usada']))
        +   sel('sn'+i+'o2f','OUT2', sen.out2_func, ['refrigeracao','exaustor','sirene','generico','off'].map(v=>[v, FUNC_ROT[v]||'Não usada']))
        +   sel('sn'+i+'ativo','Situação', sen.ativo === false ? '0' : '1', [['1','Ativo'],['0','Desativado']])
        + '</div>'
        + (d.rede && sen.ip ? painelIntegracao(sen, p) : '')
        + (d.topico ? '<div class="note info">Nó próprio publicando em MQTT. O navegador não assina o broker direto: '
            + 'quem assina é o coletor, que normaliza o payload e devolve os mesmos campos do SE-10.</div>' : '')
        + '</div>';
      }).join('')
      : '<div class="note"><b>Paiol sem sensor.</b> A leitura vem da ronda manual. '
        + 'Enquanto não houver sensor, o paiol entra na lista "A medir" a cada '+(CFG.limites.manualValidadeH||24)+' h.</div>');
}
function salvarSensores(){
  const p = paiolAberto(); if(!p) return;
  sensoresDe(p).forEach((sen,i)=>{
    const g = suf => { const e = $('sn'+i+suf); return e ? e.value.trim() : null; };
    sen.driver = g('drv') || sen.driver;
    sen.rotulo = g('rot');
    if($('sn'+i+'ip'))  sen.ip = g('ip') || null;
    if($('sn'+i+'top')) sen.topico = g('top') || '';
    sen.modelo = g('mod'); sen.mac = g('mac') || null;
    sen.id_cloud = num(g('cld'));
    sen.in1_func = g('in1f'); sen.in1_modo = g('in1m');
    sen.in2_func = g('in2f'); sen.in2_modo = g('in2m');
    sen.out1_func = g('o1f'); sen.out2_func = g('o2f');
    sen.ativo = g('ativo') === '1';
  });
  gravar(); desenhar();
}


/* ── Endereços reais do equipamento ─────────────────────────────── */
function painelIntegracao(sen, pl){
  const ip = sen.ip || '192.168.10.x';
  const porta = (CFG.rede.porta && CFG.rede.porta !== 80) ? ':'+CFG.rede.porta : '';
  const raiz = 'http://' + ip + porta;
  const hoje = new Date().toISOString().slice(0,10);
  const ontem = new Date(Date.now()-864e5).toISOString().slice(0,10);
  const linha = (lbl, url) => '<div class="ep"><span class="lbl">'+lbl+'</span><span class="u">'+esc(url)+'</span>'
    + '<button class="tinybtn" data-copy="'+esc(url)+'">Copiar</button></div>';
  const mascara = u => CFG.cloud.token
    ? u.split(CFG.cloud.token).join('••••••••')
    : u.replace('token=&', 'token=[TOKEN]&');
  return '<div class="sect">Leitura direta do equipamento</div>'
    + linha('Estado', raiz + '/status.xml')
    + linha('Estado', raiz + '/status.json')
    + '<div class="note"><b>Use o XML para os relés.</b> O <code>status.json</code> do SE-10 não traz <code>output1</code> '
    + 'nem <code>output2</code>: pelo JSON não dá para saber se a contatora de refrigeração está acionada. '
    + 'Só o <code>status.xml</code> devolve os dois; o JSON, por sua vez, é o único que traz firmware e MAC.</div>'
    + '<div class="sect">SNMP v2c</div>'
    + linha('Temp.',   'snmpget -v2c -c public ' + ip + ' .1.3.6.1.4.1.49542.1.1.0')
    + linha('Umid.',   'snmpget -v2c -c public ' + ip + ' .1.3.6.1.4.1.49542.1.2.0')
    + linha('Entradas','snmpget -v2c -c public ' + ip + ' .1.3.6.1.4.1.49542.1.4.0')
    + '<div class="note info">Enterprise OID 49542. O equipamento também envia trap, o que dispensa varredura para os '
    + 'eventos de fumaça e porta — o caminho mais adequado se houver Zabbix ou outro gerente na rede.</div>'
    + (sen.id_cloud
        ? '<div class="sect">DCM Cloud</div>'
          + linha('Leituras', mascara(urlCloud('getregisters', '&id='+sen.id_cloud+'&start='+ontem+'&finish='+hoje)))
          + linha('Alarmes',  mascara(urlCloud('getalarms',    '&id='+sen.id_cloud+'&start='+ontem+'&finish='+hoje)))
        : '')
    + '<dl class="kv" style="margin-top:10px">'
    +   '<dt>Nome gravado (name)</dt><dd>'+esc(pl ? pl.codigo : sen.paiol)+'</dd>'
    +   '<dt>Local (description)</dt><dd>'+esc(pl ? (pl.localizacao||'—') : '—')+'</dd>'
    +   '<dt>Firmware</dt><dd>'+esc(sen.firmware||'—')+'</dd>'
    +   '<dt>Limites gravados</dt><dd>'+fmt(sen.dev_temp_min)+' a '+fmt(sen.dev_temp_max)+' °C · '
    +     fmt(sen.dev_umid_min)+' a '+fmt(sen.dev_umid_max)+' %</dd>'
    + '</dl>';
}

/* ── Medições do paiol ──────────────────────────────────────────── */
function fichaMedicoes(p){
  const l = medicoesDe(p.codigo).slice(0, 40);
  return '<div class="head-row" style="margin-bottom:10px"><h3 style="font-size:13px">Medições manuais</h3>'
    +   '<span class="c">'+medicoesDe(p.codigo).length+' registros</span>'
    +   '<button class="btn btn-p btn-sm sp" id="medAdd">Registrar medição</button></div>'
    + '<div class="scroll"><table class="dt" style="min-width:520px"><thead><tr>'
    +   '<th>Data e hora</th><th class="n">Temp °C</th><th class="n">Umid %</th><th>Medido por</th><th>Obs.</th><th></th>'
    + '</tr></thead><tbody>'
    + (l.length ? l.map(m=>'<tr>'
        + '<td class="mono">'+quando(m.em)+'</td>'
        + '<td class="n'+(temperaturaForaDe(p, m.temperatura)?' hit':'')+'">'+fmt(m.temperatura)+'</td>'
        + '<td class="n'+(umidadeForaDe(p, m.umidade)?' hit':'')+'">'+fmt(m.umidade)+'</td>'
        + '<td class="m">'+esc(m.por||'—')+'</td><td class="m">'+esc(m.obs||'')+'</td>'
        + '<td><button class="tinybtn" data-meddel="'+m.id+'">Remover</button></td></tr>').join('')
      : '<tr><td colspan="6" class="m" style="text-align:center;padding:22px">Sem medições registradas.</td></tr>')
    + '</tbody></table></div>';
}
function temperaturaForaDe(p, v){ return v!=null && ((p.temp_max!=null && v>p.temp_max) || (p.temp_min!=null && v<p.temp_min)); }
function umidadeForaDe(p, v){ return v!=null && ((p.umid_max!=null && v>p.umid_max) || (p.umid_min!=null && v<p.umid_min)); }

/* ══ Histórico ═════════════════════════════════════════════════════ */
function historicoDemo(s){
  let h = 0; for(const c of s.codigo) h = (h*31 + c.charCodeAt(0)) >>> 0;
  const Lh = leitura(s);
  const bT = Lh.t ?? 23, bU = Lh.u ?? 55, pts = [], agora = Date.now();
  for(let i=47;i>=0;i--){
    h = (h*1103515245 + 12345) & 0x7fffffff; const rt = ((h>>9)%1000)/1000 - .5;
    h = (h*1103515245 + 12345) & 0x7fffffff; const ru = ((h>>9)%1000)/1000 - .5;
    const T = +(bT + Math.sin(i/6)*1.7 + rt*1.2).toFixed(1);
    const U = +(bU + Math.cos(i/7)*3.4 + ru*2.2).toFixed(1);
    pts.push({ ts:new Date(agora - i*18e5).toISOString(), t:T, u:U, o:orvalho(T,U) });
  }
  return pts;
}
async function carregarHistorico(s){
  const hint = $('hHint'); hint.textContent = 'carregando…';
  let pts = [], origem = '';
  try{
    if(CFG.modo === 'gateway'){
      const r = await buscar(String(CFG.gateway).replace(/\/+$/,'') + '/api/v1/sensores/' + encodeURIComponent(s.codigo) + '/historico?horas=24');
      pts = deCloudRegisters(await r.json()); origem = 'coletor';
    } else if(CFG.modo === 'cloud' && s.id_cloud){
      const hoje = new Date().toISOString().slice(0,10), ontem = new Date(Date.now()-864e5).toISOString().slice(0,10);
      const r = await buscar(urlCloud('getregisters', '&id='+s.id_cloud+'&start='+ontem+'&finish='+hoje), 8000);
      pts = deCloudRegisters(await r.json()); origem = 'DCM Cloud';
    }
  }catch(e){ hint.textContent = 'histórico indisponível: ' + diagnostico(e,''); }
  if(!pts.length){ pts = historicoDemo(s); origem = origem || 'demonstração'; }
  grafico(pts, s);
  hint.textContent = pts.length + ' leituras · fonte: ' + (origem==='demonstração' ? 'série de demonstração das últimas 24 h' : origem);
}

/* Dois painéis, um eixo cada. Temperatura e ponto de orvalho dividem
   o mesmo painel porque compartilham a unidade; umidade tem o seu.   */
function grafico(pts, s){
  painelSerie($('hChartT'), pts, [
    { acc:p=>p.o, cor:'--text3',    larg:1.4, tracejado:true },
    { acc:p=>p.t, cor:'--viz-temp', larg:2,   tracejado:false },
  ], [s.temp_min, s.temp_max], 150, true);
  painelSerie($('hChartU'), pts, [
    { acc:p=>p.u, cor:'--viz-umid', larg:2, tracejado:false },
  ], [s.umid_min, s.umid_max], 120, false);
}
function painelSerie(cv, pts, series, limites, altura, mostrarHoras){
  if(!cv) return;
  const css = getComputedStyle(document.documentElement);
  const grade = css.getPropertyValue('--border').trim(), tinta = css.getPropertyValue('--text2').trim();
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 660, H = altura;
  cv.width = W*dpr; cv.height = H*dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const pL = 34, pR = 12, pT = 10, pB = mostrarHoras ? 20 : 12, w = W-pL-pR, h = H-pT-pB;
  if(!pts.length){ g.fillStyle = tinta; g.font = '12px "IBM Plex Sans", system-ui'; g.fillText('Sem histórico', pL, pT+h/2); return; }

  const vals = pts.flatMap(p=>series.map(se=>se.acc(p)))
    .concat((limites||[]).filter(v=>v!=null)).filter(v=>v!=null && isFinite(v));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if(!isFinite(lo)){ lo = 0; hi = 1; }
  const folga = Math.max(0.5,(hi-lo)*0.12); lo -= folga; hi += folga;
  const X = i => pL + (pts.length===1 ? w/2 : w*i/(pts.length-1));
  const Y = v => pT + h*(1-(v-lo)/(hi-lo));

  g.font = '9px "IBM Plex Mono", monospace';
  for(let k=0;k<=3;k++){
    const y = pT + h*k/3;
    g.strokeStyle = grade; g.lineWidth = 1; g.beginPath(); g.moveTo(pL,y); g.lineTo(pL+w,y); g.stroke();
    g.fillStyle = tinta; g.textAlign = 'right'; g.fillText((hi-(hi-lo)*k/3).toFixed(0), pL-5, y+3);
  }
  (limites||[]).forEach(v=>{
    if(v == null) return;
    g.strokeStyle = css.getPropertyValue('--red').trim(); g.lineWidth = 1;
    g.setLineDash([4,3]); g.beginPath(); g.moveTo(pL,Y(v)); g.lineTo(pL+w,Y(v)); g.stroke(); g.setLineDash([]);
  });
  series.forEach(se=>{
    const cor = css.getPropertyValue(se.cor).trim();
    g.strokeStyle = cor; g.lineWidth = se.larg; g.lineJoin = 'round';
    if(se.tracejado) g.setLineDash([3,3]);
    g.beginPath(); let iniciou = false;
    pts.forEach((p,i)=>{ const v = se.acc(p); if(v == null) return;
      const x = X(i), y = Y(v); iniciou ? g.lineTo(x,y) : (g.moveTo(x,y), iniciou = true); });
    g.stroke(); g.setLineDash([]);
    for(let i=pts.length-1;i>=0;i--){ const v = se.acc(pts[i]);
      if(v != null){ g.fillStyle = cor; g.beginPath(); g.arc(X(i),Y(v),3,0,7); g.fill(); break; } }
  });
  if(mostrarHoras){
    g.fillStyle = tinta;
    g.textAlign = 'left';  g.fillText(rotuloHora(pts[0].ts), pL, H-5);
    g.textAlign = 'right'; g.fillText(rotuloHora(pts[pts.length-1].ts), pL+w, H-5);
  }
}
function rotuloHora(ts){
  const d = new Date(String(ts).replace(' ','T'));
  if(isNaN(d)) return '';
  const p = n => String(n).padStart(2,'0');
  return p(d.getDate())+'/'+p(d.getMonth()+1)+' '+p(d.getHours())+'h';
}


/* ══ Histórico ═════════════════════════════════════════════════════
   Em modo demonstração a série diária é gerada de forma determinística
   (mesmo paiol, mesmo dia, mesmo valor) para que o relatório possa ser
   conferido. Com coletor ou DCM Cloud, troque serieDiaria() pela
   chamada a /api/v1/relatorios/agregado.                            */
const DIAS_HIST = 126;                       // 18 semanas
const cacheSerie = new Map();

function xorshift(semente){
  let x = semente >>> 0 || 1;
  return () => { x ^= x<<13; x>>>=0; x ^= x>>>17; x ^= x<<5; x>>>=0; return x/4294967296; };
}
function hashStr(txt){
  let h = 2166136261;
  for(const c of String(txt)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function serieDiaria(s){
  if(cacheSerie.has(s.codigo)) return cacheSerie.get(s.codigo);
  const semente = hashStr(s.codigo);
  const r = xorshift(semente);
  // Alguns paióis são cronicamente instáveis — é o que o índice de
  // falhas precisa revelar. Aqui isso é sorteado; em campo costuma ser
  // lance de cabo, switch saturado ou fonte no limite.
  const instavel = (semente % 23 === 0) ? 1 : (semente % 11 === 0 ? 0.28 : 0.035);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const bruto = [];
  for(let i = DIAS_HIST - 1; i >= 0; i--){
    const d = new Date(hoje.getTime() - i*864e5);
    const diaAno = Math.floor((d - new Date(d.getFullYear(),0,0)) / 864e5);
    const sazonal = 2.6 * Math.cos(2*Math.PI*(diaAno - 32)/365);   // pico em fevereiro
    const quedas = r() < instavel*0.30 ? 1 + Math.floor(r()*instavel*2) : 0;
    bruto.push({
      ts:d.getTime(),
      tMed:+(22.4 + sazonal + (r()-0.5)*2.2).toFixed(1), amp:2.4 + r()*2.6,
      uMed:+(54 + sazonal*2.4 + (r()-0.5)*11).toFixed(1), ampU:5 + r()*7,
      quedas, minOffline: quedas ? Math.round(quedas * (5 + r()*95)) : 0,
    });
  }
  // Ancora a série na leitura atual do próprio paiol: cada um tem o seu
  // nível térmico (insolação, ventilação, se tem refrigeração). Sem isso
  // o histórico contradiz o que o mapa mostra agora.
  const ultimo = bruto[bruto.length-1];
  const La = leitura(s);
  const dT = (La.t ?? ultimo.tMed) - ultimo.tMed;
  const dU = (La.u ?? ultimo.uMed) - ultimo.uMed;
  const out = bruto.map(b=>{
    const tMed = +(b.tMed + dT).toFixed(1), uMed = +(b.uMed + dU).toFixed(1);
    const tMax = +(tMed + b.amp/2).toFixed(1),  tMin = +(tMed - b.amp/2).toFixed(1);
    const uMax = +(uMed + b.ampU/2).toFixed(1), uMin = +(uMed - b.ampU/2).toFixed(1);
    const fora = horasAcima(tMin, tMax, s.temp_min, s.temp_max)
               + horasAcima(uMin, uMax, s.umid_min, s.umid_max);
    return { ts:b.ts, tMed, tMin, tMax, uMed, uMin, uMax,
             quedas:b.quedas, minOffline:b.minOffline, minFora:Math.round(fora*60) };
  });
  cacheSerie.set(s.codigo, out);
  return out;
}

// Fração do dia acima/abaixo do limite, assumindo variação senoidal
// entre o mínimo e o máximo do dia.
function horasAcima(vMin, vMax, lim0, lim1){
  if(vMax == null || vMin == null || vMax === vMin) return 0;
  let h = 0;
  const frac = alvo => Math.min(1, Math.max(0, (vMax - alvo)/(vMax - vMin)));
  if(lim1 != null && vMax > lim1) h += 24 * (Math.acos(1 - 2*frac(lim1))/Math.PI) * 0.5;
  if(lim0 != null && vMin < lim0) h += 24 * (Math.acos(1 - 2*(1 - frac(lim0)))/Math.PI) * 0.5;
  return h;
}

function chaveSemana(ts){
  const d = new Date(ts); const dia = (d.getDay() + 6) % 7;      // segunda = 0
  const seg = new Date(d.getTime() - dia*864e5); seg.setHours(0,0,0,0);
  return { chave:'S'+seg.getTime(), ini:seg,
           rot: String(seg.getDate()).padStart(2,'0')+'/'+String(seg.getMonth()+1).padStart(2,'0') };
}
function chaveMes(ts){
  const d = new Date(ts), ini = new Date(d.getFullYear(), d.getMonth(), 1);
  return { chave:'M'+ini.getTime(), ini,
           rot: ini.toLocaleDateString('pt-BR',{month:'short'}).replace('.','') };
}

function agregar(sensores, periodo){
  const chaveDe = periodo === 'mes' ? chaveMes : chaveSemana;
  const baldes = new Map();
  sensores.forEach(s=>{
    serieDiaria(s).forEach(d=>{
      const k = chaveDe(d.ts);
      let b = baldes.get(k.chave);
      if(!b){ b = { chave:k.chave, rot:k.rot, ini:k.ini, n:0, t:0, u:0,
                    tMin:Infinity, tMax:-Infinity, uMin:Infinity, uMax:-Infinity,
                    quedas:0, minOffline:0, minFora:0, diasSensor:0 }; baldes.set(k.chave, b); }
      b.n++; b.t += d.tMed; b.u += d.uMed;
      b.tMin = Math.min(b.tMin, d.tMin); b.tMax = Math.max(b.tMax, d.tMax);
      b.uMin = Math.min(b.uMin, d.uMin); b.uMax = Math.max(b.uMax, d.uMax);
      b.quedas += d.quedas; b.minOffline += d.minOffline; b.minFora += d.minFora;
      b.diasSensor++;
    });
  });
  return [...baldes.values()].sort((a,b)=>a.ini - b.ini).map(b=>({
    ...b,
    tMedia: b.n ? +(b.t/b.n).toFixed(1) : null,
    uMedia: b.n ? +(b.u/b.n).toFixed(1) : null,
    disp: b.diasSensor ? +(100 * (1 - b.minOffline/(b.diasSensor*1440))).toFixed(2) : 100,
  }));
}

function resumoPorSensor(periodo, nBaldes){
  const recorte = agregar(PAIOIS, periodo).slice(-nBaldes).map(b=>b.chave);
  const dentro = new Set(recorte);
  const chaveDe = periodo === 'mes' ? chaveMes : chaveSemana;
  return PAIOIS.map(s=>{
    const dias = serieDiaria(s).filter(d=>dentro.has(chaveDe(d.ts).chave));
    const n = dias.length || 1;
    const minOffline = dias.reduce((a,d)=>a+d.minOffline, 0);
    return {
      sensor:s,
      tMedia:+(dias.reduce((a,d)=>a+d.tMed,0)/n).toFixed(1),
      uMedia:+(dias.reduce((a,d)=>a+d.uMed,0)/n).toFixed(1),
      tMax:Math.max(...dias.map(d=>d.tMax)), uMax:Math.max(...dias.map(d=>d.uMax)),
      quedas:dias.reduce((a,d)=>a+d.quedas, 0),
      hForaAr:+(minOffline/60).toFixed(1),
      disp:+(100*(1 - minOffline/(n*1440))).toFixed(2),
      hForaFaixa:+(dias.reduce((a,d)=>a+d.minFora,0)/60).toFixed(1),
    };
  });
}

/* ══ Página de histórico ═══════════════════════════════════════════ */
let hPeriodo = 'semana', hGrupo = 'todos', hMetrica = 'offline', hOrdem = 'quedas';
const N_BALDES = { semana:12, mes:6 };

function sensoresHist(){
  return hGrupo === 'todos' ? PAIOIS : PAIOIS.filter(s=>grupoDe(s.codigo) === hGrupo);
}
function renderHistorico(){
  const alvo = sensoresHist();
  const n = N_BALDES[hPeriodo];
  const baldes = agregar(alvo, hPeriodo).slice(-n);
  const porSensor = resumoPorSensor(hPeriodo, n);
  const doGrupo = porSensor.filter(x=>hGrupo === 'todos' || grupoDe(x.sensor.codigo) === hGrupo);

  const quedas   = doGrupo.reduce((a,x)=>a+x.quedas, 0);
  const hForaAr  = +doGrupo.reduce((a,x)=>a+x.hForaAr, 0).toFixed(1);
  const hFaixa   = +doGrupo.reduce((a,x)=>a+x.hForaFaixa, 0).toFixed(1);
  const comSen   = doGrupo.filter(x=>temSensor(x.sensor));
  const disp     = comSen.length ? +(comSen.reduce((a,x)=>a+x.disp,0)/comSen.length).toFixed(2) : 100;
  const pior     = doGrupo.slice().sort((a,b)=>b.quedas - a.quedas || b.hForaAr - a.hForaAr)[0];
  const rot      = hPeriodo === 'semana' ? 'últimas '+n+' semanas' : 'últimos '+n+' meses';

  const seg = (id, itens, atual) => '<div class="seg-toggle" role="group">'
    + itens.map(([v,r])=>'<button class="seg-btn'+(atual===v?' ativo':'')+'" data-'+id+'="'+v+'" aria-pressed="'+(atual===v)+'">'+r+'</button>').join('') + '</div>';

  $('view-hist').innerHTML =
      '<div class="head-row"><h2>Histórico</h2><span class="c">'+rot+' · '+doGrupo.length+' paióis</span></div>'
    + '<div class="ctrls">'
    +   seg('hper', [['semana','Semanal'],['mes','Mensal']], hPeriodo)
    +   seg('hgrp', [['todos','Todos'],['golf','Golf'],['uniform','Uniform'],['isolado','Isolados']], hGrupo)
    + '</div>'

    + '<div class="repcards">'
    +   '<div class="repcard"><b>'+fmt(disp,2)+'%</b><span>Disponibilidade dos sensores</span></div>'
    +   '<div class="repcard"><b style="color:var(--viz-falha)">'+quedas+'</b><span>Quedas de comunicação</span></div>'
    +   '<div class="repcard"><b>'+fmt(hForaAr,0)+' h</b><span>Fora do ar · soma</span></div>'
    +   '<div class="repcard"><b>'+fmt(hFaixa,0)+' h</b><span>Fora de faixa · soma</span></div>'
    +   '<div class="repcard"><b class="mono" style="font-size:20px">'+(pior?esc(pior.sensor.codigo):'—')+'</b><span>Mais instável</span></div>'
    + '</div>'

    + '<div class="viz-2">'
    +   painelViz('vTemp', 'Temperatura média', 'Média de todos os paióis do conjunto; a faixa clara é o intervalo entre a mínima e a máxima registradas. As linhas tracejadas são os limites de alarme.', 'temp')
    +   painelViz('vUmid', 'Umidade média', 'Mesma leitura para umidade relativa. Escalas separadas de propósito: sobrepor °C e % num eixo só inventa correlação.', 'umid')
    + '</div>'

    + '<div class="card" style="margin-top:14px"><h3>Quedas de comunicação por '+(hPeriodo==='semana'?'semana':'mês')+'</h3>'
    +   '<p class="sub">Cada queda é uma transição de respondendo para sem resposta. Repetição no mesmo paiol aponta cabo, conector ou fonte — não o sensor.</p>'
    +   '<div class="viz"><canvas id="vFalhas" height="180"></canvas><div class="tip" id="tipFalhas"></div></div></div>'

    + '<div class="card" style="margin-top:14px"><h3>Mapa de calor</h3>'
    +   '<p class="sub">Uma célula por paiol e por '+(hPeriodo==='semana'?'semana':'mês')+'. Quanto mais escura, pior o período.</p>'
    +   '<div class="ctrls" style="margin-bottom:10px">'
    +     seg('hmet', [['offline','Horas fora do ar'],['faixa','Horas fora de faixa'],['quedas','Quedas']], hMetrica)
    +   '</div>'
    +   mapaCalor(baldes)
    + '</div>'

    + '<div class="card" style="margin-top:14px"><h3>Por paiol</h3>'
    +   '<p class="sub">Mesmos números da tabela acima, abertos por equipamento. Clique no cabeçalho para reordenar.</p>'
    +   tabelaHist(doGrupo) + '</div>';

  ligarHist(baldes, doGrupo);
}
function painelViz(id, titulo, sub, tipo){
  return '<div class="card"><h3>'+titulo+'</h3><p class="sub">'+sub+'</p>'
    + '<div class="viz"><canvas id="'+id+'" height="180"></canvas><div class="tip" id="tip'+id+'"></div></div>'
    + '<div class="leg-viz">'
    +   '<span><i style="background:var(--viz-'+tipo+')"></i>Média</span>'
    +   '<span><i class="faixa" style="background:var(--viz-'+tipo+'-fill)"></i>Mínima a máxima</span>'
    +   (tipo==='temp' ? '<span><i style="background:var(--red)"></i>Limites de alarme</span>' : '')
    + '</div></div>';
}

/* Uma métrica, um eixo. Banda min–máx + linha da média. */
function vizBanda(cv, baldes, campos, corVar, limites, dica){
  const css = getComputedStyle(document.documentElement);
  const cor = css.getPropertyValue('--viz-'+corVar).trim();
  const preench = css.getPropertyValue('--viz-'+corVar+'-fill').trim();
  const tinta = css.getPropertyValue('--text2').trim();
  const grade = css.getPropertyValue('--border').trim();
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 420, H = 180;
  cv.width = W*dpr; cv.height = H*dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  if(!baldes.length) return [];
  const pL = 34, pR = 10, pT = 12, pB = 24, w = W-pL-pR, h = H-pT-pB;

  const todos = baldes.flatMap(b=>[b[campos.min], b[campos.max], b[campos.med]])
    .concat((limites||[]).filter(v=>v!=null)).filter(v=>v!=null && isFinite(v));
  let lo = Math.min(...todos), hi = Math.max(...todos);
  const folga = Math.max(0.5, (hi-lo)*0.12); lo -= folga; hi += folga;
  const X = i => pL + (baldes.length===1 ? w/2 : w*i/(baldes.length-1));
  const Y = v => pT + h*(1-(v-lo)/(hi-lo));

  g.font = '9px "IBM Plex Mono", monospace'; g.strokeStyle = grade; g.lineWidth = 1;
  for(let k=0;k<=3;k++){
    const y = pT + h*k/3;
    g.beginPath(); g.moveTo(pL,y); g.lineTo(pL+w,y); g.stroke();
    g.fillStyle = tinta; g.textAlign = 'right';
    g.fillText((hi-(hi-lo)*k/3).toFixed(1), pL-5, y+3);
  }
  (limites||[]).forEach(v=>{
    if(v == null) return;
    g.strokeStyle = css.getPropertyValue('--red').trim(); g.lineWidth = 1;
    g.setLineDash([4,3]); g.beginPath(); g.moveTo(pL,Y(v)); g.lineTo(pL+w,Y(v)); g.stroke(); g.setLineDash([]);
  });

  g.fillStyle = preench; g.beginPath();
  baldes.forEach((b,i)=>{ const y = Y(b[campos.max]); i ? g.lineTo(X(i),y) : g.moveTo(X(i),y); });
  for(let i=baldes.length-1;i>=0;i--) g.lineTo(X(i), Y(baldes[i][campos.min]));
  g.closePath(); g.fill();

  g.strokeStyle = cor; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
  baldes.forEach((b,i)=>{ const y = Y(b[campos.med]); i ? g.lineTo(X(i),y) : g.moveTo(X(i),y); });
  g.stroke();
  const ult = baldes.length-1;
  g.fillStyle = cor; g.beginPath(); g.arc(X(ult), Y(baldes[ult][campos.med]), 4, 0, 7); g.fill();

  g.fillStyle = tinta; g.textAlign = 'center';
  baldes.forEach((b,i)=>{
    if(baldes.length > 8 && i % 2) return;
    g.fillText(b.rot, X(i), H-7);
  });
  return baldes.map((b,i)=>({ x:X(i), y:Y(b[campos.med]), texto:dica(b) }));
}

// Topo do eixo arredondado para um número que o leitor consegue dividir.
function escalaBonita(v){
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v/(mag/2)) * (mag/2);
}
function vizBarras(cv, baldes, campo, dica){
  const css = getComputedStyle(document.documentElement);
  const cor = css.getPropertyValue('--viz-falha').trim();
  const tinta = css.getPropertyValue('--text2').trim(), grade = css.getPropertyValue('--border').trim();
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 600, H = 180;
  cv.width = W*dpr; cv.height = H*dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  if(!baldes.length) return [];
  const pL = 34, pR = 10, pT = 12, pB = 24, w = W-pL-pR, h = H-pT-pB;
  const hi = escalaBonita(Math.max(1, ...baldes.map(b=>b[campo])));
  g.font = '9px "IBM Plex Mono", monospace';
  for(let k=0;k<=3;k++){
    const y = pT + h*k/3;
    g.strokeStyle = grade; g.lineWidth = 1; g.beginPath(); g.moveTo(pL,y); g.lineTo(pL+w,y); g.stroke();
    g.fillStyle = tinta; g.textAlign = 'right'; g.fillText(Math.round(hi-hi*k/3), pL-5, y+3);
  }
  const passo = w/baldes.length, larg = Math.min(22, passo*0.46), r = 4;
  const pontos = [];
  baldes.forEach((b,i)=>{
    const v = b[campo], x = pL + passo*(i+0.5) - larg/2;
    const alt = Math.max(v > 0 ? 3 : 0, h*(v/hi)), y = pT + h - alt;
    if(alt > 0){
      g.fillStyle = cor; g.beginPath();
      g.moveTo(x, pT+h); g.lineTo(x, y+r);
      g.quadraticCurveTo(x, y, x+r, y); g.lineTo(x+larg-r, y);
      g.quadraticCurveTo(x+larg, y, x+larg, y+r); g.lineTo(x+larg, pT+h);
      g.closePath(); g.fill();
    }
    g.fillStyle = tinta; g.textAlign = 'center';
    g.fillText(b.rot, pL + passo*(i+0.5), H-7);
    pontos.push({ x:pL+passo*(i+0.5), y, texto:dica(b) });
  });
  return pontos;
}

const FAIXAS_HM = {
  offline:{ rot:'horas fora do ar', campo:'hForaAr', cortes:[0, 2, 8, 24], un:' h' },
  faixa:  { rot:'horas fora de faixa', campo:'hForaFaixa', cortes:[0, 4, 12, 36], un:' h' },
  quedas: { rot:'quedas', campo:'quedas', cortes:[0, 1, 3, 6], un:'' },
};
function nivelHm(v, cortes){
  if(v <= cortes[0]) return 0;
  if(v <= cortes[1]) return 1;
  if(v <= cortes[2]) return 2;
  if(v <= cortes[3]) return 3;
  return 4;
}
function mapaCalor(baldes){
  const cfgM = FAIXAS_HM[hMetrica];
  const chaveDe = hPeriodo === 'mes' ? chaveMes : chaveSemana;
  const chaves = baldes.map(b=>b.chave);
  const cols = 'grid-template-columns:78px repeat('+chaves.length+',minmax(26px,1fr))';
  let html = '<div class="hm"><div class="hm-grid" style="'+cols+'">';
  html += '<div></div>' + baldes.map(b=>'<div class="hm-h">'+esc(b.rot)+'</div>').join('');
  ['golf','uniform','isolado'].forEach(g=>{
    const lista = sensoresHist().filter(x=>grupoDe(x.codigo) === g);
    if(!lista.length) return;
    html += '<div class="hm-sec" style="grid-column:1/-1">'+NOME_GRUPO[g]+'</div>';
    lista.forEach(s=>{
      const dias = serieDiaria(s);
      html += '<div class="hm-l">'+esc(s.codigo)+'</div>';
      chaves.forEach((k,i)=>{
        const doBalde = dias.filter(d=>chaveDe(d.ts).chave === k);
        const v = hMetrica === 'quedas' ? doBalde.reduce((a,d)=>a+d.quedas,0)
                : hMetrica === 'offline' ? +(doBalde.reduce((a,d)=>a+d.minOffline,0)/60).toFixed(1)
                : +(doBalde.reduce((a,d)=>a+d.minFora,0)/60).toFixed(1);
        html += '<button class="hm-c n'+nivelHm(v, cfgM.cortes)+'" title="'
          + esc(s.codigo+' · '+baldes[i].rot+' · '+fmt(v, hMetrica==='quedas'?0:1)+cfgM.un+' '+cfgM.rot)
          + '" data-paiol="'+esc(s.codigo)+'"></button>';
      });
    });
  });
  html += '</div></div>';
  const r = cfgM.cortes, u = cfgM.un;
  html += '<div class="hm-leg"><span>'+cfgM.rot+':</span>'
    + [['hm-0','0'],['hm-1','até '+r[1]+u],['hm-2','até '+r[2]+u],['hm-3','até '+r[3]+u],['hm-4','acima de '+r[3]+u]]
        .map(([c,l])=>'<span><i style="background:var(--'+c+')"></i>'+l+'</span>').join('')
    + '</div>';
  return html;
}

const COLS_HIST = [
  ['codigo','Paiol',      x=>'<td class="code">'+esc(x.sensor.codigo)+'</td>'],
  ['tMedia','Temp média', x=>'<td class="n">'+fmt(x.tMedia)+'</td>'],
  ['tMax','Temp máx',     x=>'<td class="n m">'+fmt(x.tMax)+'</td>'],
  ['uMedia','Umid média', x=>'<td class="n">'+fmt(x.uMedia)+'</td>'],
  ['uMax','Umid máx',     x=>'<td class="n m">'+fmt(x.uMax)+'</td>'],
  ['quedas','Quedas',     x=>'<td class="n'+(x.quedas>4?' hit':'')+'">'+x.quedas+'</td>'],
  ['hForaAr','H fora do ar', x=>'<td class="n'+(x.hForaAr>8?' hit':' m')+'">'+fmt(x.hForaAr)+'</td>'],
  ['disp','Disponib. %',  x=>'<td class="n'+(x.disp<99?' hit':'')+'">'+fmt(x.disp,2)+'</td>'],
  ['hForaFaixa','H fora de faixa', x=>'<td class="n'+(x.hForaFaixa>24?' hit':' m')+'">'+fmt(x.hForaFaixa)+'</td>'],
];
function tabelaHist(linhas){
  const ord = linhas.slice().sort((a,b)=>{
    if(hOrdem === 'codigo') return a.sensor.codigo.localeCompare(b.sensor.codigo, 'pt', {numeric:true});
    if(hOrdem === 'disp') return a.disp - b.disp;
    return (b[hOrdem] ?? 0) - (a[hOrdem] ?? 0);
  });
  return '<div class="scroll" style="margin-top:4px"><table class="dt"><thead><tr>'
    + COLS_HIST.map(([k,r])=>'<th'+(k==='codigo'?'':' class="n"')+'><button class="tinybtn" data-ord="'+k+'" '
        + 'style="border:0;background:none;padding:0;color:inherit;font:inherit;text-transform:inherit;letter-spacing:inherit">'
        + r + (hOrdem===k?' ▾':'') + '</button></th>').join('')
    + '</tr></thead><tbody>'
    + ord.map(x=>'<tr>'+COLS_HIST.map(([,,cel])=>cel(x)).join('')+'</tr>').join('')
    + '</tbody></table></div>';
}

function ligarHist(baldes, porSensor){
  const limT = [CFG.limites.temp_min, CFG.limites.temp_max];
  const per = hPeriodo === 'semana' ? 'Semana de ' : 'Mês de ';
  dica(vizBanda($('vTemp'), baldes, {med:'tMedia',min:'tMin',max:'tMax'}, 'temp', limT,
    b => per+b.rot+'\nmédia '+fmt(b.tMedia)+' °C\nmín '+fmt(b.tMin)+'  máx '+fmt(b.tMax)), 'tipvTemp', 'vTemp');
  dica(vizBanda($('vUmid'), baldes, {med:'uMedia',min:'uMin',max:'uMax'}, 'umid', null,
    b => per+b.rot+'\nmédia '+fmt(b.uMedia)+' %\nmín '+fmt(b.uMin)+'  máx '+fmt(b.uMax)), 'tipvUmid', 'vUmid');
  dica(vizBarras($('vFalhas'), baldes, 'quedas',
    b => per+b.rot+'\n'+b.quedas+' quedas\n'+fmt(b.minOffline/60)+' h fora do ar\ndisponibilidade '+fmt(b.disp,2)+'%'),
    'tipFalhas', 'vFalhas');

  document.querySelectorAll('[data-hper]').forEach(b=>b.addEventListener('click',()=>{ hPeriodo = b.dataset.hper; renderHistorico(); }));
  document.querySelectorAll('[data-hgrp]').forEach(b=>b.addEventListener('click',()=>{ hGrupo = b.dataset.hgrp; renderHistorico(); }));
  document.querySelectorAll('[data-hmet]').forEach(b=>b.addEventListener('click',()=>{ hMetrica = b.dataset.hmet; renderHistorico(); }));
  document.querySelectorAll('[data-ord]').forEach(b=>b.addEventListener('click',()=>{ hOrdem = b.dataset.ord; renderHistorico(); }));
}

// Camada de leitura: todo gráfico responde ao ponteiro.
function dica(pontos, idTip, idCanvas){
  const cv = $(idCanvas), tip = $(idTip);
  if(!cv || !tip || !pontos.length) return;
  cv.onmousemove = e => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
    let melhor = pontos[0], dist = Infinity;
    pontos.forEach(p=>{ const d = Math.abs(p.x - x); if(d < dist){ dist = d; melhor = p; } });
    tip.textContent = melhor.texto;
    tip.classList.add('on');
    const largura = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(r.width - largura - 4, melhor.x - largura/2)) + 'px';
    tip.style.top  = Math.max(4, melhor.y - tip.offsetHeight - 10) + 'px';
  };
  cv.onmouseleave = () => tip.classList.remove('on');
}

/* ══ Ronda manual ══════════════════════════════════════════════════
   Quem faz a ronda mede vários paióis de uma vez com termo-higrômetro.
   Lançar um por um em nove janelas seria o caminho mais curto para a
   ronda não ser lançada — daí a folha única, com os pendentes no topo.
   A medição não apaga o offline do sensor: são dois problemas.      */
let rondaFiltro = null;

function precisaMedir(p){
  const st = estado(p);
  return st === 'vencido' || st === 'offline' || (!temSensor(p) && !medicaoValida(p));
}
function abrirRonda(codigos){
  const lista = (codigos ? PAIOIS.filter(x=>codigos.includes(x.codigo)) : PAIOIS.slice())
    .sort((a,b)=>a.codigo.localeCompare(b.codigo, 'pt', {numeric:true}));
  const pend = lista.filter(precisaMedir), resto = lista.filter(x=>!precisaMedir(x));
  const agora = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);

  const linha = pl => {
    const L = leitura(pl), st = estado(pl);
    const tag = !temSensor(pl)
      ? (medicaoValida(pl) ? '' : '<span class="ronda-tag">a medir</span>')
      : (st === 'offline' ? '<span class="ronda-tag off">sensor offline</span>' : '');
    return '<tr class="'+(precisaMedir(pl)?'pend':'')+'" data-cod="'+esc(pl.codigo)+'">'
      + '<td class="cod">'+esc(pl.codigo)+tag+'</td>'
      + '<td class="m mono">'+fmt(pl.temp_min,0)+'–'+fmt(pl.temp_max,0)+' °C · '+fmt(pl.umid_min,0)+'–'+fmt(pl.umid_max,0)+' %</td>'
      + '<td class="m mono">'+(L.t==null ? '—' : fmt(L.t)+' / '+fmt(L.u))+'</td>'
      + '<td class="m">'+quando(L.em)+'</td>'
      + '<td><input type="number" step="0.1" inputmode="decimal" data-t="'+esc(pl.codigo)+'" placeholder="°C" aria-label="Temperatura em '+esc(pl.codigo)+'"></td>'
      + '<td><input type="number" step="0.1" inputmode="decimal" data-u="'+esc(pl.codigo)+'" placeholder="%" aria-label="Umidade em '+esc(pl.codigo)+'"></td>'
      + '</tr>';
  };

  const antigo = $('overlay'); if(antigo) antigo.remove();
  const o = document.createElement('div');
  o.id = 'overlay'; o.className = 'modal open';
  o.innerHTML = '<div class="modal-bg" data-fecha></div><div class="modal-box ronda-box" role="dialog" aria-modal="true">'
    + '<div class="modal-h"><div><h2 style="font-family:var(--ff);font-size:16px">Ronda manual</h2>'
    +   '<div class="sub">'+pend.length+' de '+lista.length+' paióis aguardando medição</div></div>'
    +   '<button class="x" data-fecha aria-label="Fechar">×</button></div>'
    + '<div class="modal-b">'
    +   '<div class="ronda-cab">'
    +     '<div class="f"><label for="rPor">Medido por</label><input id="rPor" placeholder="Posto e nome" value="'+esc(ultimoMedidor())+'"></div>'
    +     '<div class="f"><label for="rQuando">Data e hora</label><input id="rQuando" type="datetime-local" value="'+agora+'"></div>'
    +     '<div class="f"><label for="rObs">Observação</label><input id="rObs" placeholder="Opcional — vale para toda a ronda"></div>'
    +   '</div>'
    +   '<div class="ronda-rol"><table class="ronda-tab"><thead><tr>'
    +     '<th>Paiol</th><th>Faixa</th><th>Última</th><th>Quando</th><th>Temp °C</th><th>Umid %</th>'
    +   '</tr></thead><tbody>'
    +     (pend.length ? '<tr><td colspan="6" class="ronda-sec">Aguardando medição</td></tr>'+pend.map(linha).join('') : '')
    +     (resto.length ? '<tr><td colspan="6" class="ronda-sec">Demais paióis</td></tr>'+resto.map(linha).join('') : '')
    +   '</tbody></table></div>'
    +   '<div class="note info">Só as linhas preenchidas são gravadas. A medição vale por '
    +     (CFG.limites.manualValidadeH||24)+' h — depois disso o paiol volta para a lista de pendentes.</div>'
    + '</div>'
    + '<div class="modal-f"><span class="msg" id="rMsg"></span>'
    +   '<button class="btn btn-s sp" data-fecha>Cancelar</button>'
    +   '<button class="btn btn-p" id="rOk">Registrar</button></div></div>';
  document.body.appendChild(o);
  o.addEventListener('click', e=>{ if(e.target.hasAttribute('data-fecha')) o.remove(); });
  o.querySelectorAll('input[data-t],input[data-u]').forEach(el=>{
    el.addEventListener('input', ()=>{ el.classList.toggle('ruim', !valorOk(el)); contarRonda(o); });
  });
  o.querySelector('#rOk').addEventListener('click', ()=>gravarRonda(o));
  const primeiro = o.querySelector('input[data-t]');
  if(primeiro) primeiro.focus();
  contarRonda(o);
}
function valorOk(el){
  const v = num(el.value);
  if(v == null) return true;
  return el.dataset.t !== undefined ? (v >= -10 && v <= 60) : (v >= 0 && v <= 100);
}
function contarRonda(o){
  const n = [...o.querySelectorAll('input[data-t]')].filter(el=>num(el.value) != null).length;
  const ruins = o.querySelectorAll('input.ruim').length;
  const m = o.querySelector('#rMsg');
  m.className = 'msg' + (ruins ? ' err' : '');
  m.textContent = ruins ? ruins + ' valor(es) fora da escala do instrumento'
                        : (n ? n + ' paiol(is) preenchido(s)' : 'preencha ao menos a temperatura de um paiol');
  o.querySelector('#rOk').textContent = n ? 'Registrar '+n : 'Registrar';
}
function ultimoMedidor(){
  const m = MEDICOES.slice().sort((a,b)=>String(b.em).localeCompare(String(a.em)))[0];
  return m && m.por ? m.por : '';
}
function registrarMedicao(cod, t, u, em, por, obs){
  MEDICOES.push({ id:(MEDICOES.reduce((a,x)=>Math.max(a, x.id||0), 0) + 1),
                  paiol:cod, temperatura:t, umidade:u,
                  em:em || new Date().toISOString(), por:por || null, obs:obs || null });
}
function gravarRonda(o){
  if(o.querySelectorAll('input.ruim').length){ contarRonda(o); return; }
  const por = o.querySelector('#rPor').value.trim();
  const obs = o.querySelector('#rObs').value.trim();
  const q = o.querySelector('#rQuando').value;
  const em = q ? new Date(q).toISOString() : new Date().toISOString();
  let n = 0;
  o.querySelectorAll('input[data-t]').forEach(el=>{
    const t = num(el.value); if(t == null) return;
    const cod = el.dataset.t;
    const u = num(o.querySelector('input[data-u="'+CSS.escape(cod)+'"]').value);
    registrarMedicao(cod, t, u, em, por, obs); n++;
  });
  if(!n){ contarRonda(o); return; }
  gravar(); cacheSerie.clear(); o.remove(); desenhar();
}

/* ══ Som de alarme ═════════════════════════════════════════════════
   Tom gerado por WebAudio: nenhum arquivo externo passa pela política
   de conteúdo da página. O navegador só libera áudio depois de um
   gesto do operador — daí o botão "Ativar som", que precisa ser
   clicado uma vez toda vez que a TV reabrir a página.             */
let audio = null, somArmado = false, somRelogio = null, ultimoBip = 0;

function armarSom(){
  try{
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    somArmado = true;
    bip(880, .12); setTimeout(()=>bip(1320, .12), 140);
    atualizarBotaoSom();
  }catch(e){ somArmado = false; atualizarBotaoSom(); }
}
function atualizarBotaoSom(){
  const b = $('mbSom'); if(!b) return;
  b.textContent = somArmado ? (CFG.mural.som ? 'Silenciar' : 'Religar som') : 'Ativar som';
}
function bip(freq, dur){
  if(!audio || !somArmado) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, CFG.mural.volume||0.35), audio.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
  o.connect(g); g.connect(audio.destination);
  o.start(); o.stop(audio.currentTime + dur + 0.02);
}
function pararSom(){ ultimoBip = Date.now(); }
function cicloSom(){
  if(!somArmado || !CFG.mural.som) return;
  const pendentes = PAIOIS.filter(naoReconhecido);
  if(!pendentes.length) return;
  const fogo = pendentes.some(s=>estado(s)==='crit');
  const intervalo = fogo ? 2500 : 9000;
  if(Date.now() - ultimoBip < intervalo) return;
  ultimoBip = Date.now();
  if(fogo){ bip(1046, .16); setTimeout(()=>bip(784, .16), 200); setTimeout(()=>bip(1046, .16), 400); }
  else bip(740, .22);
}

/* ══ Mural ═════════════════════════════════════════════════════════ */
function entrarMural(){
  mural = true; document.body.classList.add('mural');
  if(CFG.mural.tema !== 'sistema'){
    temaAnterior = document.documentElement.dataset.theme || null;
    document.documentElement.dataset.theme = CFG.mural.tema === 'claro' ? 'claro' : 'escuro';
  }
  irPara('mapa', null);
  atualizarBotaoSom();
  document.documentElement.requestFullscreen?.().catch(()=>{});
}
function sairMural(){
  mural = false; document.body.classList.remove('mural');
  document.documentElement.dataset.theme = temaAnterior || 'escuro';
  if(document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
  desenhar();
}

function tique(){
  const d = new Date(), p = n => String(n).padStart(2,'0');
  const h = $('mbHora'); if(h) h.textContent = p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
  const dt = $('mbData');
  if(dt) dt.textContent = d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'short' });
  faixaMural();
  cicloSom();
  if(CFG.mural.autoAck > 0){
    // Reconhecimento automático evita que a tela pisque a noite inteira
    // sem ninguém na portaria; a cor do alarme continua lá.
    const limite = CFG.mural.autoAck * 60000;
    if(Date.now() - ultimoDesenho > limite) reconhecerTudo();
  }
}
function faixaMural(){
  const f = $('mbFaixa'); if(!f) return;
  const ordem = ['crit','grave','alarm','offline','vencido'];
  const pend = PAIOIS.filter(s=>ordem.includes(estado(s)))
    .sort((a,b)=>ordem.indexOf(estado(a)) - ordem.indexOf(estado(b)));
  const pisca = PAIOIS.some(naoReconhecido) && CFG.mural.piscar;
  f.className = 'mb-faixa' + (pend.some(s=>estado(s)==='crit') ? ' ativa'
              : pend.some(s=>estado(s)==='grave') ? ' grave' : '') + (pisca ? ' pisca' : '');
  $('mbRot').textContent = pend.length ? SEV[estado(pend[0])].rot : 'Situação';
  $('mbTxt').textContent = pend.length
    ? pend.slice(0,6).map(s=>{ const L = leitura(s); const st = estado(s);
        return s.codigo + ' ' + (st==='offline' ? 'offline' : st==='vencido' ? 'a medir'
               : fmt(L.t)+'°C/'+fmt(L.u)+'%'); }).join('   ')
        + (pend.length > 6 ? '   +' + (pend.length-6) : '')
    : 'Todos os ' + PAIOIS.length + ' paióis dentro dos limites';
  // Um navegador travado numa TV é idêntico a um sistema saudável:
  // o pulso para de bater e o texto denuncia.
  const atraso = (Date.now() - ultimoDesenho)/1000;
  const pulso = $('mbPulso');
  if(pulso){
    const parado = atraso > Math.max(120, (CFG.rede.intervalo||300) * 2);
    pulso.classList.toggle('parado', parado);
    pulso.title = parado ? 'Painel sem atualizar há ' + Math.round(atraso/60) + ' min'
                         : 'Atualizado há ' + Math.round(atraso) + ' s';
  }
  const sub = $('mbSub');
  if(sub) sub.textContent = (CFG.modo === 'demo' ? 'demonstração' : COLETA.detalhe) + ' · atualizado há ' + Math.round(atraso) + ' s';
}

/* ══ Navegação ═════════════════════════════════════════════════════ */
const VISTAS = ['mapa','equip','paiois','med','hist','rel','cfg'];

function irPara(v, sev){
  vista = v;
  if(sev !== undefined) filtroSev = sev;
  VISTAS.forEach(k=>{ const e = $('view-'+k); if(e) e.classList.toggle('active', k === v); });
  // a barra de indicadores só faz sentido sobre o mapa e a lista de sensores
  const barra = $('barra-topo');
  if(barra) barra.style.display = ['mapa','equip'].includes(v) ? '' : 'none';
  const aba = { mapa:'sensores', equip:'sensores', paiois:'paiois', med:'med',
                hist:'hist', rel:'rel', cfg:'cfg' }[v];
  const alvo = (v === 'mapa' && filtroSev === 'alarm') ? 'alarmes' : aba;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view === alvo));
  desenhar();
}

/* ══ Eventos do miolo ══════════════════════════════════════════════ */
function ligarEventos(){




  $('mbSair').addEventListener('click', sairMural);
  $('mbAck').addEventListener('click', reconhecerTudo);
  $('mbSom').addEventListener('click', ()=>{
    if(!somArmado){ armarSom(); return; }
    CFG.mural.som = !CFG.mural.som; gravarCfg(); pararSom(); atualizarBotaoSom();
  });
  document.addEventListener('fullscreenchange', ()=>{ if(!document.fullscreenElement && mural) sairMural(); });
  $('busca').addEventListener('input', e=>{ busca = e.target.value; desenhar(); });

  $('btnCsvOut').addEventListener('click', exportarCsv);
  $('btnSalvar').addEventListener('click', ()=>{
    if(abaAtual === 'clima') salvarClima();
    else if(abaAtual === 'sens') salvarSensores();
    else salvarPaiol();
    msg('Salvo.', 'ok');
  });
  $('btnExcluir').addEventListener('click', excluirPaiol);
  document.querySelectorAll('#mTabs [data-aba]').forEach(b=>b.addEventListener('click', ()=>trocarAba(b.dataset.aba)));
  $('btnVarrer').addEventListener('click', varrer);
  $('btnMural').addEventListener('click', entrarMural);
  $('conn').addEventListener('click', ()=>trocarView('cfg'));
  $('btnNovoSensor').addEventListener('click', ()=>{
    const alvo = listaFiltrada()[0];
    if(alvo){ abrir(alvo.codigo); trocarAba('sens'); }
  });
document.addEventListener('click', e=>{
  const sev = e.target.closest('[data-sev]');
  if(sev){ filtroSev = sev.dataset.sev || null; if(vista!=='mapa') irPara('mapa'); else desenhar(); return; }
  if(e.target.closest('#btnRonda')){ abrirRonda(null); return; }
  const pa = e.target.closest('[data-paiol]');
  if(pa){ abrir(pa.dataset.paiol); return; }
  if(e.target.closest('#medAdd')){ const a = paiolAberto(); if(a){ fechar(); abrirRonda([a.codigo]); } return; }
  const md = e.target.closest('[data-meddel]');
  if(md){ MEDICOES = MEDICOES.filter(x=>String(x.id) !== md.dataset.meddel); gravar(); trocarAba('med'); desenhar(); return; }
  if(e.target.closest('#senAdd')){
    const a = paiolAberto();
    if(a){ SENS.push(novoSensor(a.codigo, PAIOIS.findIndex(x=>x.codigo===a.codigo))); gravar(); trocarAba('sens'); desenhar(); }
    return;
  }
  const sd = e.target.closest('[data-sendel]');
  if(sd){ SENS = SENS.filter(x=>String(x.id) !== sd.dataset.sendel); gravar(); trocarAba('sens'); desenhar(); return; }
  const ms = e.target.closest('[data-modo-sens]');
  if(ms){ modoSensores = ms.dataset.modoSens; irPara(modoSensores); return; }
  const mf = e.target.closest('[data-medf]');
  if(mf){ medFiltro = mf.dataset.medf; renderMedicoes(); return; }
  const mm = e.target.closest('[data-medir]');
  if(mm){ abrirRonda([mm.dataset.medir]); return; }
  if(e.target.closest('#rondaTudo')){ abrirRonda(null); return; }
  if(e.target.closest('#paiolNovo')){ criarPaiol(); return; }
  const gr = e.target.closest('[data-grupo]');
  if(gr){ filtroGrupo = gr.dataset.grupo; desenhar(); return; }
  const cp = e.target.closest('[data-copy]');
  if(cp){ navigator.clipboard?.writeText(cp.dataset.copy).then(()=>{ cp.textContent = 'Copiado'; setTimeout(()=>cp.textContent='Copiar', 1400); }); return; }
  if(e.target.hasAttribute('data-close')) fechar();
});
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape'){ fechar(); return; }
  if(!mural) return;
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); reconhecerTudo(); }
  if(e.key.toLowerCase() === 's') armarSom();
});
window.addEventListener('resize', ()=>{ if(vista === 'mapa') document.querySelectorAll('canvas.spark').forEach(spark); });
}

/* ══ Início ════════════════════════════════════════════════════════ */


/* ══ Entrada do módulo ═════════════════════════════════════════════ */

// O shell chama trocarView(id, el) pelo onclick das abas; é a ponte
// entre a navegação comum e o irPara() deste módulo.
window.trocarView = function (id) {
  const aba = ABAS.find(a => a.id === id)
  if (!aba) return
  irPara(aba.vista, aba.sev ?? null)
}
window.alternarTema = alternarTema

let AUTH = null
window.sair = async function () {
  if (AUTH) await AUTH.sair()
  location.reload()
}

function iniciarApp(usuario) {
  const app = document.getElementById('app')
  app.innerHTML = MIOLO
  aplicarShell({
    nome: 'Paióis',
    versao: VERSAO,
    accent: ACCENT,
    navItems: ABAS.map((a, i) => ({ id: a.id, label: a.label, icone: a.icone, ativo: i === 0 })),
  })
  app.classList.add('pronto')

  const chip = document.getElementById('user-chip')
  if (chip && usuario) chip.textContent = `${usuario.nome || 'Usuário'} · ${usuario.funcao || usuario.role || ''}`.trim()

  ligarEventos()
  testarColeta().then(desenhar)
  desenhar()
  setInterval(tique, 1000)
  if (CFG.modo !== 'demo' && CFG.rede.intervalo > 0) {
    setInterval(varrer, Math.max(30, CFG.rede.intervalo) * 1000)
  }
  if (location.hash === '#mural') entrarMural()
}

// Login por cargo, como nos demais módulos. Sem Supabase alcançável o
// módulo ainda abre em modo observador: a tela da portaria não pode
// ficar preta porque o CDN não passou pela rede da OM.
async function iniciar() {
  try {
    const supa = await criarClienteSupabase()
    AUTH = new Auth(supa, { appNome: 'Paióis', appIcone: '🏚️' })
    AUTH.mount('#login-screen')
    AUTH.onLogin(u => {
      const tela = document.getElementById('login-screen')
      if (tela) tela.style.display = 'none'
      iniciarApp(u)
    })
  } catch (erro) {
    console.warn('[paiois] seguindo sem autenticação:', erro.message || MSG_SDK_AUSENTE)
    const tela = document.getElementById('login-screen')
    if (tela) tela.remove()
    iniciarApp({ nome: 'Observador', funcao: 'somente leitura' })
  }
}

iniciar()
