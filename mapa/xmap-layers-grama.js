// Portado do app legado cmms-mapa (/home/luc/DEV_ERP/cmms-mapa) para o módulo pmoc /mapa.
// Desde o plano 10-05, os dados de camada vêm do Supabase (mapa/mapa-dados.js) —
// as duas listas de demonstração que existiam aqui (MOCK_AREAS, MOCK_MAQUINAS) saíram.
/**
 * xMap Layers — xGrama (Controle Vegetal)
 * Elementos: áreas de serviço (polígonos), máquinas (marcadores com posição GPS)
 *
 * registrarCamadasGrama() é chamada pelo boot (mapa/app.js) depois de o cliente do
 * Supabase existir — as camadas não se registram mais sozinhas ao carregar, porque o
 * cliente só existe depois do login.
 */

import { carregarAreas, carregarMaquinas, carregarLocaisComPosicao, posicionarAtivos } from './mapa-dados.js'
import { maquinasParaZona, normalizarCategoria, linkDoModulo, corDoEstado, rotuloDoEstado, classeDoEstado } from './mapa-geometria.js'

/* ── Estilos por tipo de área ──
   maq_areas.tipo no banco é corte|poda|limpeza|mista|outro (D-03,
   supabase/12_maquinas_areas_operacoes.sql) — vocabulário diferente do
   editor legado (jardim|bosque|canteiro|area_recreativa|horta), que este
   dicionário ainda fala. Não há entrada travada para colidir: um tipo real
   sem entrada aqui cai no `|| { ... }` de baixo, com a mesma cor padrão de
   sempre — degrada de forma graciosa, não quebra. */
function areaStyle(tipo) {
  const s = {
    jardim:          { color: '#4ade80', fill: '#4ade80' },
    bosque:          { color: '#166534', fill: '#16a34a' },
    canteiro:        { color: '#86efac', fill: '#86efac' },
    area_recreativa: { color: '#22d3ee', fill: '#22d3ee' },
    horta:           { color: '#a3e635', fill: '#a3e635' },
  };
  return s[tipo] || { color: '#4ade80', fill: '#4ade80' };
}

function tipoLabel(t) {
  return { jardim:'Jardim', bosque:'Bosque', canteiro:'Canteiro', area_recreativa:'Área Recreativa', horta:'Horta' }[t] || t;
}

function maqLabel(t) {
  return { cortador_grama:'Cortador', roçadeira:'Roçadeira', motosserra:'Motosserra', soprador:'Soprador' }[t] || t;
}

/* ── SVG máquina ──
   A ponte de vocabulário (maq_ativos.status é operante|inoperante|
   manutencao|baixado) e a paleta saíram daqui para o núcleo puro
   (mapa/mapa-geometria.js, Bloco 8): eram três cópias da mesma tradução —
   uma aqui, uma na elétrica, uma por família nova — e a legenda da tela
   não teria de onde ler a cor sem escrever hex à mão numa quarta. */
function maquinaSVG(tipo, estado) {
  const c = corDoEstado(estado);
  const ico = { cortador_grama:'✂', roçadeira:'⚡', motosserra:'⚙', soprador:'〜' }[tipo] || '⚙';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <rect x="2" y="2" width="26" height="26" rx="6" fill="rgba(7,17,31,.92)" stroke="${c}" stroke-width="2"/>
    <text x="15" y="20" text-anchor="middle" font-size="14" fill="${c}">${ico}</text>
    ${estado === 'manutencao' ? `<circle cx="24" cy="6" r="4" fill="${c}"/>` : ''}
  </svg>`;
}

function makeIcon(svg, size, anchor) {
  return L.divIcon({ html: svg, className: '', iconSize: size, iconAnchor: anchor, popupAnchor: [0, -anchor[1]] });
}

// A geometria agora vem de maq_areas.geom (jsonb, migração 25) — o
// Supabase já devolve isso como array JS, não texto. Mantém tolerância a
// texto (coords_json) só para o caso de uma linha antiga que ainda não
// migrou para a coluna nova.
function resolverCoordenadasArea(area) {
  if (Array.isArray(area.geom)) return area.geom;
  if (typeof area.geom === 'string') {
    try { return JSON.parse(area.geom); } catch { return null; }
  }
  if (area.coords_json) {
    try { return JSON.parse(area.coords_json); } catch { return null; }
  }
  return null;
}

/* ── Renderiza áreas num LayerGroup ──
   maquinas: os ativos de máquina já carregados (mapa/mapa-dados.js),
   usados aqui só para calcular, em tempo de exibição, quais são
   compatíveis com cada zona (maquinasParaZona, núcleo puro) — não há
   coluna maquinas_compativeis no banco (decisão do plano 10-01: seria
   segunda fonte de verdade). */
function renderAreas(group, areas, maquinas) {
  areas.forEach(area => {
    const coords = resolverCoordenadasArea(area);
    if (!coords || !coords.length) return;

    const s = areaStyle(area.tipo);
    const poly = L.polygon(coords, {
      color: s.color, fillColor: s.fill, fillOpacity: 0.13, weight: 2,
    });

    const { compativeis, semMapeamento } = maquinasParaZona(area, maquinas);
    const maqStr = compativeis.map(m => m.nome).join(', ') || '—';

    const floraLabels = { gramado:'Gramado', capim_colonial:'Cap. Colonial', mata_fechada:'Mata Fechada' };
    const inclLabels  = { plano:'Plano', moderado:'Moderado', acentuado:'Acentuado' };
    const limpLabels  = { limpa:'Limpa', media:'Média', densa:'Densa' };

    const rows = [
      ['Tipo',       tipoLabel(area.tipo)],
      ['Área',       (area.area_m2 || 0).toLocaleString('pt-BR') + ' m²'],
    ];
    if (area.flora)      rows.push(['Flora',      floraLabels[area.flora] || area.flora]);
    if (area.inclinacao) rows.push(['Inclinação', inclLabels[area.inclinacao] || area.inclinacao]);
    if (area.limpeza)    rows.push(['Limpeza',    limpLabels[area.limpeza] || area.limpeza]);
    if (compativeis.length) rows.push(['Máquinas', maqStr, 'info']);
    // Resposta ao risco de a lista de compatíveis vir vazia sem
    // explicação: sempre que houver categoria fora da regra de
    // compatibilidade, esta linha aparece — nunca é omitida.
    if (semMapeamento.length) {
      const categorias = [...new Set(semMapeamento.map(m => normalizarCategoria(m.categoria)))].join(', ');
      rows.push([`${semMapeamento.length} fora da classificação`, categorias, 'warn']);
    }

    poly.bindPopup(
      xMap.utils.popupHTML('🌿', area.nome, tipoLabel(area.tipo), rows),
      { maxWidth: 240 }
    );

    poly.bindTooltip(area.nome, {
      permanent: false, direction: 'center',
      className: 'xmap-area-tooltip',
    });

    group.addLayer(poly);
  });
}

/* ── Renderiza máquinas posicionadas (mapa-dados.js já resolveu lat/lon e
   a origem da posição — própria do ativo ou herdada do prédio/sala) ── */
function renderMaquinas(group, maquinas) {
  maquinas.forEach(m => {
    const categoria = normalizarCategoria(m.categoria);
    const icon = makeIcon(maquinaSVG(categoria, m.estado), [30, 30], [15, 15]);
    const marker = L.marker([m.lat, m.lon], { icon });

    const rows = [
      ['Status',   rotuloDoEstado(m.estado),                        classeDoEstado(m.estado)],
      ['Uso',      (m.uso_atual || 0) + ' ' + (m.unidade_uso || 'h')],
      ['Posição',  m.origemPosicao === 'propria' ? 'Própria' : 'Herdada do local', 'info'],
    ];

    // O link nunca é concatenado — sai só de linkDoModulo, que valida
    // módulo por lista fechada e identificador por forma (T-10-22). Se a
    // função devolver nulo, a linha simplesmente não aparece.
    const link = linkDoModulo('maquinas', m.id);
    if (link) rows.push(['Módulo', `<a href="${link}" class="xmap-popup-link">Abrir na ficha →</a>`, 'info']);

    marker.bindPopup(
      xMap.utils.popupHTML('🚜', m.nome, maqLabel(categoria), rows),
      { maxWidth: 220 }
    );
    group.addLayer(marker);
  });
}

/* ── Registro: busca uma vez, monta as definições de layer sobre o
   resultado já carregado, e só então registra no componente xMap. ── */
export async function registrarCamadasGrama() {
  const [areas, maquinasBrutas, locais] = await Promise.all([
    carregarAreas(),
    carregarMaquinas(),
    carregarLocaisComPosicao(),
  ]);
  const maquinasPosicionadas = posicionarAtivos(maquinasBrutas, locais, 'maquinas');

  const layerDefs = {

    areas: {
      label: 'Áreas',
      color: '#4ade80',
      render(group) {
        renderAreas(group, areas, maquinasBrutas);
      },
    },

    maquinas: {
      label: 'Máquinas',
      color: '#4ade80',
      render(group) {
        renderMaquinas(group, maquinasPosicionadas);
      },
    },

  };

  xMap.registerLayer('grama', layerDefs);
}
