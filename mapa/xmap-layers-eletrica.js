// Portado do app legado cmms-mapa (/home/luc/DEV_ERP/cmms-mapa) para o módulo pmoc /mapa.
// Desde o plano 10-05, os dados de camada vêm do Supabase (mapa/mapa-dados.js) — as
// quatro listas de demonstração que existiam aqui (GERADORES, TRANSFORMADORES, QUADROS,
// RAMAIS) saíram. As camadas de transformador e de ramal foram REMOVIDAS: não há tabela
// nenhuma no projeto que descreva esses elementos, e mantê-las com dado fixo contrariaria
// o critério de sucesso 6 (nenhum dado de demonstração continua sendo a origem do que a
// camada exibe) enquanto inventar tabela para elas seria escopo novo, fora desta fase.
/**
 * xMap Layers — xEletrica (Sistema Elétrico)
 * Elementos: os quatro tipos reais de elet_ativos (GERADOR, QGBT, NOBREAK, ILUMINACAO —
 * eletrica/app.js:8-13), um layer por tipo, agrupados como o módulo elétrica já usa.
 *
 * registrarCamadasEletrica() é chamada pelo boot (mapa/app.js) depois de o cliente do
 * Supabase existir — a camada não se registra mais sozinha ao carregar.
 */

import { carregarAtivosEletricos, carregarLocaisComPosicao, posicionarAtivos } from './mapa-dados.js'
import { linkDoModulo, corDoEstado, rotuloDoEstado, classeDoEstado } from './mapa-geometria.js'

// Os mesmos quatro tipos de eletrica/app.js:8-13, duplicados aqui de
// propósito: importar eletrica/app.js executaria o boot inteiro daquele
// módulo (iniciarModulo tem efeito colateral no import, monta tela e
// liga listener), então os rótulos entram como valor solto — mesmo
// espírito de normalizarCategoria em mapa/mapa-geometria.js para a
// categoria de máquinas.
const TIPOS_ELETRICOS = {
  GERADOR:    { nome: 'Gerador',          emoji: '⚡' },
  QGBT:       { nome: 'QGBT / Painel',    emoji: '🧰' },
  NOBREAK:    { nome: 'Nobreak / UPS',    emoji: '🔋' },
  ILUMINACAO: { nome: 'Iluminação',       emoji: '💡' },
}

/* ── Cor e classe por estado vêm do núcleo puro (mapa/mapa-geometria.js,
   Bloco 8). A ponte de vocabulário que existia aqui (operante → operando,
   inoperante → alerta) saiu junto: a normalização acontece uma vez, em
   posicionarAtivos, e chega neste arquivo pronta em `a.estado`. O
   vocabulário canônico herdou o `standby` que só esta camada legada
   falava — é o estado `sobreaviso` de transp_ativos. ── */

/* ── SVG Icons ──
   geradorSVG e quadroSVG reaproveitados do port legado, com a etiqueta de
   potência (kva) removida — elet_ativos não tem essa coluna, é um schema
   genérico (id, codigo, nome, tipo, status, uso_atual, ...). NOBREAK e
   ILUMINACAO não tinham ícone no arquivo legado (a lista de mock nunca
   cobria esses dois tipos); ativoGenericoSVG segue o mesmo padrão visual
   (retângulo + emoji) que o resto do arquivo já usa. */
function geradorSVG(estado) {
  const c = corDoEstado(estado);
  const spin = estado === 'operante';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <rect x="2" y="2" width="30" height="30" rx="6" fill="rgba(7,17,31,.92)" stroke="${c}" stroke-width="2"/>
    <text x="17" y="20" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700" fill="${c}">GEN</text>
    ${spin ? `<circle cx="28" cy="6" r="3" fill="${c}"/>` : ''}
  </svg>`;
}

function quadroSVG(estado) {
  const c = corDoEstado(estado);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <rect x="2" y="2" width="24" height="24" rx="3" fill="rgba(7,17,31,.92)" stroke="${c}" stroke-width="2"/>
    <rect x="6" y="7"  width="6" height="3" rx="1" fill="${c}" opacity=".7"/>
    <rect x="6" y="12" width="6" height="3" rx="1" fill="${c}" opacity=".5"/>
    <rect x="16" y="7"  width="6" height="3" rx="1" fill="${c}" opacity=".7"/>
    <rect x="16" y="12" width="6" height="3" rx="1" fill="${c}" opacity=".5"/>
    <rect x="6" y="17" width="16" height="2" rx="1" fill="${c}" opacity=".3"/>
  </svg>`;
}

function ativoGenericoSVG(emoji, estado) {
  const c = corDoEstado(estado);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    <rect x="2" y="2" width="22" height="22" rx="5" fill="rgba(7,17,31,.92)" stroke="${c}" stroke-width="1.5"/>
    <text x="13" y="17" text-anchor="middle" font-size="12" fill="${c}">${emoji}</text>
  </svg>`;
}

function iconePorTipo(tipo, estado) {
  if (tipo === 'GERADOR') return geradorSVG(estado);
  if (tipo === 'QGBT')    return quadroSVG(estado);
  return ativoGenericoSVG(TIPOS_ELETRICOS[tipo]?.emoji || '⚙', estado);
}

function makeIcon(svg, size, anchor) {
  return L.divIcon({ html: svg, className: '', iconSize: size, iconAnchor: anchor, popupAnchor: [0, -anchor[1]] });
}

/* ── Renderiza os ativos de um tipo, já posicionados (mapa-dados.js
   resolveu lat/lon e a origem da posição). ── */
function renderAtivosEletricos(group, ativos, tipo) {
  const info = TIPOS_ELETRICOS[tipo];
  ativos.forEach(a => {
    const icon = makeIcon(iconePorTipo(tipo, a.estado), tipo === 'GERADOR' ? [34, 34] : [26, 26], tipo === 'GERADOR' ? [17, 17] : [13, 13]);
    const marker = L.marker([a.lat, a.lon], { icon });

    const rows = [
      ['Estado',  rotuloDoEstado(a.estado),                        classeDoEstado(a.estado)],
      ['Uso',     (a.uso_atual || 0) + ' ' + (a.unidade_uso || 'h')],
      ['Posição', a.origemPosicao === 'propria' ? 'Própria' : 'Herdada do local', 'info'],
    ];

    // O link nunca é concatenado — sai só de linkDoModulo, que valida
    // módulo por lista fechada e identificador por forma (T-10-22). Se a
    // função devolver nulo, a linha simplesmente não aparece.
    const link = linkDoModulo('eletrica', a.id);
    if (link) rows.push(['Módulo', `<a href="${link}" class="xmap-popup-link">Abrir na ficha →</a>`, 'info']);

    marker.bindPopup(
      xMap.utils.popupHTML(info.emoji, a.nome, info.nome, rows),
      { maxWidth: 220 }
    );
    group.addLayer(marker);
  });
}

/* ── Registro: busca uma vez, agrupa por tipo real, e só então registra
   no componente xMap — um layer por tipo de elet_ativos. ── */
export async function registrarCamadasEletrica() {
  const [ativosBrutos, locais] = await Promise.all([
    carregarAtivosEletricos(),
    carregarLocaisComPosicao(),
  ]);
  const posicionados = posicionarAtivos(ativosBrutos, locais, 'eletrica');

  const layerDefs = {};
  for (const [tipo, info] of Object.entries(TIPOS_ELETRICOS)) {
    const doTipo = posicionados.filter(a => a.tipo === tipo);
    layerDefs[tipo.toLowerCase()] = {
      label: info.nome,
      color: '#c9a84c',
      render(group) {
        renderAtivosEletricos(group, doTipo, tipo);
      },
    };
  }

  xMap.registerLayer('eletrica', layerDefs);
}
