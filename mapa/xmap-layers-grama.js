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

import { carregarAreas, carregarMaquinas, carregarArvoreDeLocais, posicionarAtivos } from './mapa-dados.js'
import { maquinasParaZona, normalizarCategoria, linkDoModulo, corDoEstado, rotuloDoEstado, classeDoEstado } from './mapa-geometria.js'
import { desenharAtivosAgrupados } from './xmap-marcadores.js'

/* ── Estilo por VEGETAÇÃO ──
   A zona de maq_areas é o que ela sempre foi na prática e agora está dito
   na tela: vegetação e área externa — campo, calçada, baixadão, entorno.
   Edificação saiu daqui (quick-260819-0g3): prédio é polígono próprio em
   cmasm_locais.geom, com camada e cor próprias, porque enquanto o desenho
   de contorno não existia o usuário desenhava o prédio como zona de
   serviço e o edifício entrava na conta de área de corte.

   A cor sai de `flora` — a lista fechada da migração 25, travada por
   `check` no banco —, não do dicionário legado do app cmms-mapa
   (jardim/bosque/canteiro/área recreativa/horta), vocabulário que nunca
   existiu neste projeto: nenhuma das sete zonas cadastradas casava com
   uma daquelas chaves, então TODAS caíam no verde padrão e o estilo por
   tipo era decorativo. Zona sem flora classificada continua no verde
   padrão, de propósito: é "ainda não classificada", não uma sexta cor. */
const ESTILO_FLORA = {
  gramado:        { color: '#4ade80', fill: '#4ade80' },
  capim_colonial: { color: '#a3e635', fill: '#a3e635' },
  mata_fechada:   { color: '#166534', fill: '#16a34a' },
};
const ESTILO_VEGETACAO_PADRAO = { color: '#4ade80', fill: '#4ade80' };

function estiloDaVegetacao(flora) {
  return ESTILO_FLORA[flora] || ESTILO_VEGETACAO_PADRAO;
}

/* Vocabulário de exibição do tipo de SERVIÇO da zona — corte|poda|limpeza|
   mista|outro (supabase/12_maquinas_areas_operacoes.sql), o que o banco de
   fato aceita. Antes este dicionário falava o vocabulário legado e devolvia
   'corte' cru para toda zona real. */
function tipoLabel(t) {
  return { corte:'Corte', poda:'Poda', limpeza:'Limpeza', mista:'Mista', outro:'Outro' }[t] || t;
}

const FLORA_LABEL = { gramado:'Gramado', capim_colonial:'Cap. Colonial', mata_fechada:'Mata Fechada' };

function floraLabel(f) {
  return FLORA_LABEL[f] || f;
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

    const s = estiloDaVegetacao(area.flora);
    const poly = L.polygon(coords, {
      color: s.color, fillColor: s.fill, fillOpacity: 0.13, weight: 2,
    });

    const { compativeis, semMapeamento } = maquinasParaZona(area, maquinas);
    const maqStr = compativeis.map(m => m.nome).join(', ') || '—';

    const inclLabels  = { plano:'Plano', moderado:'Moderado', acentuado:'Acentuado' };
    const limpLabels  = { limpa:'Limpa', media:'Média', densa:'Densa' };

    const rows = [
      ['Serviço',    tipoLabel(area.tipo)],
      ['Área',       (area.area_m2 || 0).toLocaleString('pt-BR') + ' m²'],
    ];
    if (area.flora)      rows.push(['Flora',      floraLabel(area.flora)]);
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
      // Subtítulo é a vegetação, não o serviço: é o que distingue esta
      // camada da de prédios a olho nu. Sem flora classificada, o balão diz
      // "área externa" em vez de mentir uma vegetação.
      xMap.utils.popupHTML('🌿', area.nome, area.flora ? floraLabel(area.flora) : 'Área externa', rows),
      { maxWidth: 240 }
    );

    // Permanente e cortado por zoom, igual ao do prédio: uma zona sem nome
    // na tela é um polígono verde sem identidade.
    poly.bindTooltip(area.nome, {
      permanent: true, direction: 'center',
      className: 'xmap-rotulo xmap-rotulo-zona',
    });

    group.addLayer(poly);
  });
}

/* ── Renderiza máquinas posicionadas (mapa-dados.js já resolveu lat/lon e
   a origem da posição — própria do ativo ou herdada do prédio/sala),
   agrupando as que caíram no mesmo ponto: o desenho do agrupamento é
   compartilhado (mapa/xmap-marcadores.js), só o ícone de uma máquina e o
   balão dela são desta camada. ── */
function balaoDaMaquina(m, categoria) {
  const rows = [
    ['Status',   rotuloDoEstado(m.estado),                        classeDoEstado(m.estado)],
    ['Uso',      (m.uso_atual || 0) + ' ' + (m.unidade_uso || 'h')],
    ['Posição',  m.origemPosicao === 'propria' ? 'Própria' : `Herdada de ${m.localPosicao || 'local'}`, 'info'],
  ];

  // O link nunca é concatenado — sai só de linkDoModulo, que valida
  // módulo por lista fechada e identificador por forma (T-10-22). Se a
  // função devolver nulo, a linha simplesmente não aparece.
  const link = linkDoModulo('maquinas', m.id);
  if (link) rows.push(['Módulo', `<a href="${link}" class="xmap-popup-link">Abrir na ficha →</a>`, 'info']);

  return xMap.utils.popupHTML('🚜', m.nome, maqLabel(categoria), rows);
}

function renderMaquinas(group, maquinas) {
  desenharAtivosAgrupados(group, maquinas, {
    modulo: 'maquinas',
    emoji: '🚜',
    nome: 'Máquinas',
    ladoDeUm: 30,
    svgDeUm: (m) => maquinaSVG(normalizarCategoria(m.categoria), m.estado),
    popupDeUm: (m) => balaoDaMaquina(m, normalizarCategoria(m.categoria)),
    rotuloDeUm: (m) => m.nome,
  });
}

export async function registrarCamadasGrama() {
  const [areas, maquinasBrutas, locais] = await Promise.all([
    carregarAreas(),
    carregarMaquinas(),
    carregarArvoreDeLocais(),
  ]);
  const maquinasPosicionadas = posicionarAtivos(maquinasBrutas, locais, 'maquinas');

  const layerDefs = {

    areas: {
      label: 'Vegetação e áreas externas',
      color: ESTILO_VEGETACAO_PADRAO.color,
      render(group) {
        renderAreas(group, areas, maquinasBrutas);
      },
    },

    maquinas: {
      label: 'Máquinas',
      color: ESTILO_VEGETACAO_PADRAO.color,
      render(group) {
        renderMaquinas(group, maquinasPosicionadas);
      },
    },

  };

  xMap.registerLayer('grama', layerDefs);
}
