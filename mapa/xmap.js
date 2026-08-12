// Portado do app legado cmms-mapa (/home/luc/DEV_ERP/cmms-mapa) para o módulo pmoc /mapa.
// Núcleo do componente: dados de camada nos arquivos xmap-layers-*.js são de demonstração, não vêm do Supabase.
/**
 * xMap — Componente de Mapa xCMASM
 * Singleton global: window.xMap
 *
 * Uso:
 *   xMap.init('container-id', { modules: ['aguada'], zoom: 15 })
 *   xMap.setModules(['aguada', 'grama'])
 *   xMap.toggleBasemap('satellite' | 'map')
 *   xMap.updateElement('aguada', 'reservoir', 'CON', { pct: 72, online: true })
 *   xMap.registerLayer(moduleName, layerDef)
 */

(function (global) {
  'use strict';

  /* ── Tile URLs ── */
  const TILES = {
    map: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
      maxZoom: 19,
    },
  };

  /* ── Tile local com queda para o provedor online (PLAT-19) ──
     Extensão do L.TileLayer que tenta primeiro o tile do próprio projeto
     (mesma origem, sem rede — mapa/tiles/{z}/{x}/{y}.png) e, só se ele
     falhar, troca a imagem pelo provedor online passado em
     `options.urlOnline` — uma vez só, com marca de tentativa, para não
     entrar em laço. No segundo erro o quadro encerra com falha, que é o
     comportamento padrão do Leaflet quando não há tile: quadrado vazio,
     não tela quebrada.

     Reaproveita `getTileUrl()` (API pública do L.TileLayer) para montar as
     duas URLs, em vez de reconstruir a montagem de subdomínio/retina/zoom
     à mão — a troca de `this._url` é restaurada de forma síncrona, sem
     janela de corrida com outros tiles em construção.

     Usada SÓ no basemap `map`, instanciada uma única vez logo abaixo, na
     construção de `_baseLayers.map`. Funciona hoje com zero tiles em
     `mapa/tiles/`: toda tentativa local falha e o online assume — o
     mecanismo entra sem depender de os tiles existirem. Ver
     mapa/tiles/GERAR-TILES.md para o procedimento de gerar os tiles.

     O basemap satélite NUNCA usa esta classe (decisão travada D-02): ele
     fica só online, sem cache nem fallback local — ver o comentário junto
     da construção do basemap de satélite, mais abaixo. */
  const TileLocalComFallback = L.TileLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement('img');
      const localUrl = this.getTileUrl(coords);
      let tentouOnline = false;

      tile.onerror = () => {
        if (!tentouOnline) {
          tentouOnline = true;
          const urlLocal = this._url;
          this._url = this.options.urlOnline;
          tile.src = this.getTileUrl(coords);
          this._url = urlLocal;
        } else {
          done(new Error('tile indisponível local e online'), tile);
        }
      };
      tile.onload = () => done(null, tile);
      tile.src = localUrl;
      return tile;
    },
  });

  /* ── Estado interno ── */
  let _map = null;
  let _basemapMode = 'map';
  let _baseLayers = {};
  let _activeModules = [];
  let _registeredLayers = {};  // { moduleName: { layerKey: { group, def } } }
  let _filterState = {};       // { moduleName: { layerKey: true/false } }
  let _wrapperEl = null;
  let _filtersEl = null;
  let _badgeEl = null;
  let _opts = {};

  /* ── Utilitários ── */
  function createSVGIcon(svgContent, size = [28, 28], anchor = [14, 14]) {
    return L.divIcon({
      html: svgContent,
      className: '',
      iconSize: size,
      iconAnchor: anchor,
      popupAnchor: [0, -anchor[1]],
    });
  }

  function popupHTML(icon, title, sub, rows) {
    const rowsHTML = rows.map(([k, v, cls = '']) =>
      `<div class="xmap-popup-row">
        <span class="xmap-popup-key">${k}</span>
        <span class="xmap-popup-val ${cls}">${v}</span>
      </div>`
    ).join('');
    return `
      <div class="xmap-popup">
        <div class="xmap-popup-header">
          <span class="xmap-popup-icon">${icon}</span>
          <div>
            <div class="xmap-popup-title">${title}</div>
            ${sub ? `<div class="xmap-popup-sub">${sub}</div>` : ''}
          </div>
        </div>
        <div class="xmap-popup-rows">${rowsHTML}</div>
      </div>`;
  }

  /* ── Construção da toolbar de basemap ── */
  function _buildToolbar(wrapper) {
    const tb = document.createElement('div');
    tb.className = 'xmap-toolbar';
    tb.innerHTML = `
      <button class="xmap-basemap-btn active" data-mode="map">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM2.5 8.5h2a5.5 5.5 0 0 0 1 2.7A5.5 5.5 0 0 1 2.5 8.5zm0-1a5.5 5.5 0 0 1 3-4.7A5.5 5.5 0 0 0 4.5 7.5h-2zm4 5.4V10.5h1a4.5 4.5 0 0 1-.5 2.4zm1-6.4h-1V3.1A4.5 4.5 0 0 1 8 5.5h-.5zm1 6.4a4.5 4.5 0 0 1-.5-2.4h1v2.4zm0-6.4h-.5A4.5 4.5 0 0 1 8.5 3.1V6.5h.5zm.5 5.7a5.5 5.5 0 0 0 1-2.7h2a5.5 5.5 0 0 1-3 2.7zm1-3.7a5.5 5.5 0 0 0-1-2.5 5.5 5.5 0 0 1 3 4.7h-2z"/>
        </svg>
        Mapa
      </button>
      <div class="xmap-toolbar-sep"></div>
      <button class="xmap-basemap-btn" data-mode="satellite">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.5 1.5a.5.5 0 0 0-.75-.43L5.5 3H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.5l3.25 1.93A.5.5 0 0 0 9.5 10.5V1.5zm1.5 3.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5zm1.5-1a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0v-5a.5.5 0 0 1 .5-.5z"/>
        </svg>
        Satélite
      </button>`;
    wrapper.appendChild(tb);

    tb.querySelectorAll('.xmap-basemap-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        xMap.toggleBasemap(mode);
        tb.querySelectorAll('.xmap-basemap-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  /* ── Painel de filtros ── */
  function _buildFiltersPanel(wrapper) {
    const panel = document.createElement('div');
    panel.className = 'xmap-filters';
    panel.innerHTML = `<div class="xmap-filters-title">Layers</div>`;
    wrapper.appendChild(panel);
    _filtersEl = panel;
    _renderFilters();
  }

  function _renderFilters() {
    if (!_filtersEl) return;
    _filtersEl.innerHTML = `<div class="xmap-filters-title">Layers</div>`;

    _activeModules.forEach(mod => {
      const layers = _registeredLayers[mod];
      if (!layers) return;
      Object.entries(layers).forEach(([key, { def }]) => {
        const isOn = _filterState[mod]?.[key] !== false;
        const item = document.createElement('div');
        item.className = `xmap-filter-item ${isOn ? 'on' : ''}`;
        item.innerHTML = `
          <span class="xmap-filter-dot" style="background:${def.color || '#8fa8c8'}"></span>
          <span class="xmap-filter-label">${def.label || key}</span>
          <span class="xmap-filter-toggle"></span>`;
        item.addEventListener('click', () => {
          if (!_filterState[mod]) _filterState[mod] = {};
          _filterState[mod][key] = !isOn;
          _applyVisibility(mod, key);
          _renderFilters();
        });
        _filtersEl.appendChild(item);
      });
    });
  }

  function _applyVisibility(mod, key) {
    const entry = _registeredLayers[mod]?.[key];
    if (!entry) return;
    const visible = _filterState[mod]?.[key] !== false;
    if (visible) {
      if (!_map.hasLayer(entry.group)) _map.addLayer(entry.group);
    } else {
      if (_map.hasLayer(entry.group)) _map.removeLayer(entry.group);
    }
  }

  /* ── Badge de módulos ativos ── */
  function _buildModuleBadge(wrapper) {
    const el = document.createElement('div');
    el.className = 'xmap-module-badge';
    wrapper.appendChild(el);
    _badgeEl = el;
  }

  function _renderModuleBadge() {
    if (!_badgeEl) return;
    _badgeEl.innerHTML = _activeModules
      .map(m => `<span class="xmap-mod-chip" data-mod="${m}">${m.toUpperCase()}</span>`)
      .join('');
  }

  /* ── Planta vetorial offline (PLAT-19) ──
     A área do CMASM como geometria vetorial estática (mapa/gerar-planta.mjs
     converteu o extrato .osm local, sem rede). Estilo por chave, em opção
     de JavaScript — não em folha de estilo nova (D-01 da Fase 6, mapa/xmap.css
     continua fora de escopo). */
  function _estiloPlanta(feature) {
    switch (feature?.properties?.chave) {
      case 'building':
        return { color: '#b08968', weight: 1.5, fillColor: '#b08968', fillOpacity: 0.18 };
      case 'waterway':
      case 'natural':
        return { color: '#4a7ea8', weight: 1.5, fillColor: '#4a7ea8', fillOpacity: 0.12 };
      case 'landuse':
        return { color: '#5f8f5a', weight: 1, fillColor: '#5f8f5a', fillOpacity: 0.1 };
      case 'man_made':
        return { color: '#8f8f8f', weight: 1.5, fillColor: '#8f8f8f', fillOpacity: 0.12 };
      case 'barrier':
        return { color: '#a05a5a', weight: 1, dashArray: '4,3' };
      case 'highway':
      default:
        return { color: '#6b6b6b', weight: 1.5, opacity: 0.6 };
    }
  }

  function _pontoPlanta(feature, latlng) {
    const marker = L.circleMarker(latlng, {
      radius: 3,
      color: '#c9c9c9',
      weight: 1,
      fillOpacity: 0.8,
      pane: 'xmap-planta-pane',
    });
    if (feature?.properties?.nome) {
      marker.bindTooltip(feature.properties.nome, {
        permanent: true,
        direction: 'right',
        offset: [6, 0],
        className: 'xmap-planta-label',
      });
    }
    return marker;
  }

  /* Busca /mapa/planta-cmasm.geojson (caminho absoluto de raiz, mesma
     origem) e desenha a área do CMASM num painel próprio, posicionado
     abaixo das camadas de módulo (overlayPane, zIndex 400) e acima do
     tile (tilePane, zIndex 200), para que a planta nunca cubra marcador
     nem polígono de zona. A falha da busca não pode derrubar o mapa: sem
     rede/arquivo, o mapa segue sendo o de hoje, só sem a planta de fundo. */
  function _carregarPlanta() {
    const pane = _map.createPane('xmap-planta-pane');
    pane.style.zIndex = 350;

    fetch('/mapa/planta-cmasm.geojson')
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      })
      .then((geojson) => {
        L.geoJSON(geojson, {
          pane: 'xmap-planta-pane',
          style: _estiloPlanta,
          pointToLayer: _pontoPlanta,
        }).addTo(_map);
        // Atribuição ODbL exigida pela licença do dado local, além do
        // crédito ao provedor online já presente na camada de tile.
        _map.attributionControl.addAttribution(
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ODbL'
        );
      })
      .catch((err) => {
        console.warn('xMap: planta vetorial offline não carregada —', err);
      });
  }

  /* ── API pública ── */
  const xMap = {

    /**
     * Inicializa o mapa em um elemento HTML.
     * @param {string} containerId  ID do elemento pai
     * @param {object} options
     *   - modules: string[]   módulos ativos inicial (default: [])
     *   - basemap: 'map'|'satellite'
     *   - center: [lat, lon]
     *   - zoom: number
     *   - minZoom: number
     *   - maxZoom: number
     */
    init(containerId, options = {}) {
      const parent = document.getElementById(containerId);
      if (!parent) { console.error(`xMap: elemento #${containerId} não encontrado`); return; }

      _opts = Object.assign({
        modules: [],
        basemap: 'map',
        center: [-22.8395, -43.106],
        zoom: 15,
        minZoom: 13,
        maxZoom: 19,
      }, options);

      /* Wrapper */
      _wrapperEl = document.createElement('div');
      _wrapperEl.className = 'xmap-wrapper';
      _wrapperEl.style.cssText = 'position:relative;width:100%;height:100%;';
      parent.appendChild(_wrapperEl);

      /* Container do leaflet */
      const container = document.createElement('div');
      container.className = 'xmap-container';
      container.style.cssText = 'width:100%;height:100%;';
      _wrapperEl.appendChild(container);

      /* Inicializa Leaflet */
      _map = L.map(container, {
        center: _opts.center,
        zoom: _opts.zoom,
        minZoom: _opts.minZoom,
        maxZoom: _opts.maxZoom,
        zoomControl: true,
        attributionControl: true,
      });

      /* Reposiciona zoom control */
      _map.zoomControl.setPosition('bottomright');

      /* Tile layers */
      // Mapa: tile local do projeto (caminho absoluto de raiz — mesmo motivo
      // do restante do módulo: a rota do Vercel serve /mapa sem barra final,
      // e caminho relativo resolveria contra a raiz do site), com queda para
      // o provedor online quando o tile local não existe (PLAT-19). Nível
      // nativo 17: acima disso o Leaflet reamostra o tile local em vez de
      // deixar buraco — mesmo precedente do módulo aguada.
      _baseLayers.map = new TileLocalComFallback('/mapa/tiles/{z}/{x}/{y}.png', {
        urlOnline: TILES.map.url,
        attribution: TILES.map.attribution,
        maxNativeZoom: 17,
        maxZoom: TILES.map.maxZoom,
        minZoom: _opts.minZoom,
      });
      // Satélite: construído pelo construtor padrão do Leaflet, sem a classe
      // acima e sem nenhuma referência a tile local — decisão travada D-02.
      // O satélite fica apenas online, sem cache/fallback nenhum; não trocar
      // por conveniência de código, é exatamente o atalho que a decisão
      // proíbe (gate automatizado em tests/mapa-base-offline.test.js).
      _baseLayers.satellite = L.tileLayer(TILES.satellite.url, {
        attribution: TILES.satellite.attribution,
        maxZoom: TILES.satellite.maxZoom,
      });

      _basemapMode = _opts.basemap;
      _baseLayers[_basemapMode].addTo(_map);

      /* Planta vetorial offline (PLAT-19) — abaixo das camadas de módulo,
         acima do tile; falha da busca não derruba o mapa. */
      _carregarPlanta();

      /* UI */
      _buildToolbar(_wrapperEl);
      _buildFiltersPanel(_wrapperEl);
      _buildModuleBadge(_wrapperEl);

      /* Módulos iniciais */
      if (_opts.modules.length) {
        this.setModules(_opts.modules);
      }

      return this;
    },

    /**
     * Define os módulos ativos (layers dos outros módulos ficam ocultos).
     * @param {string[]} moduleNames
     */
    setModules(moduleNames) {
      const prev = [..._activeModules];
      _activeModules = moduleNames;

      /* Oculta todos */
      Object.entries(_registeredLayers).forEach(([mod, layers]) => {
        Object.entries(layers).forEach(([key, { group }]) => {
          if (_map.hasLayer(group)) _map.removeLayer(group);
        });
      });

      /* Mostra apenas os ativos, respeitando filtros */
      _activeModules.forEach(mod => {
        const layers = _registeredLayers[mod];
        if (!layers) return;
        if (!_filterState[mod]) _filterState[mod] = {};
        Object.entries(layers).forEach(([key, { group }]) => {
          if (_filterState[mod][key] === undefined) _filterState[mod][key] = true;
          if (_filterState[mod][key]) _map.addLayer(group);
        });
      });

      _renderFilters();
      _renderModuleBadge();
    },

    /**
     * Alterna basemap entre mapa e satélite.
     * @param {'map'|'satellite'} mode  (opcional — alterna se omitido)
     */
    toggleBasemap(mode) {
      const next = mode || (_basemapMode === 'map' ? 'satellite' : 'map');
      if (next === _basemapMode) return;
      _map.removeLayer(_baseLayers[_basemapMode]);
      _basemapMode = next;
      _baseLayers[_basemapMode].addTo(_map);
    },

    /**
     * Registra layers de um módulo.
     * @param {string} moduleName
     * @param {object} layerDefs  { layerKey: { label, color, render(map) → LayerGroup } }
     */
    registerLayer(moduleName, layerDefs) {
      if (!_registeredLayers[moduleName]) _registeredLayers[moduleName] = {};

      Object.entries(layerDefs).forEach(([key, def]) => {
        const group = L.layerGroup();
        def.render(group);
        _registeredLayers[moduleName][key] = { group, def };

        /* Se já é módulo ativo, adiciona ao mapa */
        if (_activeModules.includes(moduleName)) {
          if (!_filterState[moduleName]) _filterState[moduleName] = {};
          if (_filterState[moduleName][key] !== false) _map.addLayer(group);
          _renderFilters();
        }
      });
    },

    /**
     * Atualiza dados de um elemento específico.
     * @param {string} moduleName
     * @param {string} layerKey
     * @param {string} elementId   identificador único do elemento
     * @param {object} data        novos dados
     */
    updateElement(moduleName, layerKey, elementId, data) {
      const entry = _registeredLayers[moduleName]?.[layerKey];
      if (!entry?.def?.update) return;
      entry.def.update(entry.group, elementId, data);
    },

    /**
     * Retorna instância do Leaflet map (para uso avançado).
     */
    getLeafletMap() { return _map; },

    /* Utilidades expostas para uso nos layer files */
    utils: { createSVGIcon, popupHTML },
  };

  global.xMap = xMap;
})(window);
