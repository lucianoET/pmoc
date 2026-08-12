// ══════════════════════════════════════════════════════════════════
// mapa/mapa-editor.js — modo de edição de zona de serviço dentro do /mapa.
//
// (1) Porte de /home/luc/DEV_ERP/cmms-mapa/admin.html (ferramenta de
// desenho, painel de atributos e cálculo de compatibilidade) para o
// padrão pmoc — trocando o backend próprio que aquele arquivo chamava
// (inexistente neste projeto) pela porta única de dados do módulo
// (mapa/mapa-dados.js), que fala com o Supabase.
//
// (2) Este arquivo NÃO cria uma segunda instância de mapa. Quem chama
// iniciarEditorZonas(mapa, usuario) entrega a instância que o componente
// xMap já expõe (xMap.getLeafletMap(), mapa/xmap.js) — o editor desenha
// sobre ela.
//
// (3) Todo cálculo — área do polígono, compatibilidade de máquina — vem do
// núcleo puro (mapa/mapa-geometria.js, plano 10-02). Nada é recalculado
// aqui; a validação de atributo fora da lista fechada mora na camada de
// dados (mapa/mapa-dados.js), não neste arquivo.
//
// (4) A lista de cargos que habilita o modo de edição espelha a política
// de escrita de maq_areas (supabase/12_maquinas_areas_operacoes.sql,
// linhas 51-59): admin e gestor, nunca técnico. Alargar aqui sem alargar
// lá produziria um botão de salvar que o banco recusa — a pior forma
// possível de comunicar uma permissão ao usuário.
// ══════════════════════════════════════════════════════════════════

import {
  calcAreaM2,
  maquinasParaZona,
  normalizarCategoria,
  FLORAS,
  INCLINACOES,
  LIMPEZAS,
} from './mapa-geometria.js'
import { carregarAreas, carregarMaquinas, salvarZona, atualizarZona } from './mapa-dados.js'

// Espelha exatamente a política de inserção/atualização de maq_areas
// (supabase/12_maquinas_areas_operacoes.sql, linhas 51-59) — os dois únicos
// cargos que o banco aceita para gravar zona. Nome e posição fixos: o gate
// de tests/mapa-editor.test.js extrai esta linha por eles e compara com a
// política real do banco.
const CARGOS_ZONA = ['admin', 'gestor']

// Mesmo idioma de esc() em mapa/app.js — duplicado aqui de propósito,
// porque app.js não exporta o seu (cada módulo do projeto mantém a própria
// cópia da função de escape; não há um utilitário compartilhado para ela).
// Todo valor vindo de linha de banco (nome de zona, nome de máquina) que
// vai para a marcação do painel passa por aqui antes (T-10-31).
function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[c])
}

// Vocabulário de exibição local a este arquivo — mesma decisão de
// xmap-layers-grama.js/-eletrica.js (plano 10-05): tradução de
// apresentação não é núcleo puro, fica em quem a usa. A lista de tipo é a
// do banco (supabase/12_maquinas_areas_operacoes.sql, linha 8-9), não a do
// editor legado (jardim/bosque/canteiro/área recreativa/horta).
const TIPOS_ZONA = [
  ['corte', 'Corte'],
  ['poda', 'Poda'],
  ['limpeza', 'Limpeza'],
  ['mista', 'Mista'],
  ['outro', 'Outro'],
]
const FLORA_LABEL = { gramado: 'Gramado', capim_colonial: 'Cap. Colonial', mata_fechada: 'Mata Fechada' }
const INCLINACAO_LABEL = { plano: 'Plano 0-5%', moderado: 'Moderado 5-20%', acentuado: 'Acentuado >20%' }
const LIMPEZA_LABEL = { limpa: 'Limpa', media: 'Média', densa: 'Densa' }

// ── estado do módulo ────────────────────────────────────────────────
let _mapa = null
let _modoAtivo = false
let _grupoDesenho = null
let _controleDesenho = null
let _grupoZonas = null
let _maquinas = []
let _zonaAtual = null // { id|null, nome, tipo, geom, flora, inclinacao, limpeza }
let _modoPainel = null // 'criar' | 'editar'
let _camadaSelecionada = null

export function iniciarEditorZonas(mapa, usuario) {
  // Sai sem fazer nada quando o cargo não está na lista de escrita de zona
  // — nenhum botão, nenhum manipulador global, nada. O banco recusaria a
  // escrita de qualquer forma; a tela não promete o que ele não aceita.
  if (!CARGOS_ZONA.includes(usuario?.role)) return
  _mapa = mapa
  exporManipuladores()
  criarBotaoAlternar(mapa)
}

// ── botão de alternância do modo, discreto sobre o mapa ──────────────
function criarBotaoAlternar(mapa) {
  const controle = L.control({ position: 'topright' })
  controle.onAdd = () => {
    const btn = L.DomUtil.create('button', 'btn btn-s')
    btn.type = 'button'
    btn.textContent = 'Editar zonas'
    btn.style.margin = '10px'
    L.DomEvent.disableClickPropagation(btn)
    btn.addEventListener('click', () => alternarModoEdicao(mapa, btn))
    return btn
  }
  controle.addTo(mapa)
}

async function alternarModoEdicao(mapa, btn) {
  _modoAtivo = !_modoAtivo
  btn.classList.toggle('active', _modoAtivo)
  if (_modoAtivo) {
    btn.textContent = 'Sair da edição'
    await ligarModoDesenho(mapa)
  } else {
    btn.textContent = 'Editar zonas'
    desligarModoDesenho(mapa)
    fecharPainel()
  }
}

// ── ferramenta de desenho — porte de admin.html (linhas 743-760), trocando
// `map` pela instância recebida em iniciarEditorZonas, restrita a polígono
// (nenhuma das outras formas do controle de desenho) ──
async function ligarModoDesenho(mapa) {
  _grupoDesenho = new L.FeatureGroup().addTo(mapa)
  _controleDesenho = new L.Control.Draw({
    draw: {
      polygon: {
        allowIntersection: false,
        shapeOptions: { color: '#00b4d8', fillColor: '#00b4d8', fillOpacity: 0.15, weight: 2 },
      },
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
      circlemarker: false,
    },
    edit: { featureGroup: _grupoDesenho, edit: false, remove: false },
  })
  mapa.addControl(_controleDesenho)
  mapa.on(L.Draw.Event.CREATED, aoCriarPoligono)

  _maquinas = await carregarMaquinas()
  await carregarZonasEditaveis(mapa)
}

function desligarModoDesenho(mapa) {
  mapa.off(L.Draw.Event.CREATED, aoCriarPoligono)
  if (_controleDesenho) {
    mapa.removeControl(_controleDesenho)
    _controleDesenho = null
  }
  if (_grupoDesenho) {
    mapa.removeLayer(_grupoDesenho)
    _grupoDesenho = null
  }
  if (_grupoZonas) {
    mapa.removeLayer(_grupoZonas)
    _grupoZonas = null
  }
}

// ── zonas existentes, clicáveis para reabrir o painel em modo de edição ──
// Camada própria do editor — não é a camada de exibição registrada por
// xmap-layers-grama.js (fora dos arquivos que este plano toca), então o
// contorno aparece por cima dela só enquanto o modo de edição está ligado,
// sinalizando "isto é editável" sem duplicar o preenchimento visual da
// camada de exibição.
async function carregarZonasEditaveis(mapa) {
  if (_grupoZonas) {
    mapa.removeLayer(_grupoZonas)
    _grupoZonas = null
  }
  _grupoZonas = new L.FeatureGroup().addTo(mapa)
  const zonas = await carregarAreas()
  for (const zona of zonas) {
    const coords = Array.isArray(zona.geom) ? zona.geom : null
    if (!coords || coords.length < 3) continue
    const poly = L.polygon(coords, { color: '#00b4d8', weight: 2, fillOpacity: 0.02, dashArray: '4 3' })
    poly.on('click', () => abrirPainelEdicao(zona, poly))
    _grupoZonas.addLayer(poly)
  }
}

// ── ao concluir um polígono novo ──
function aoCriarPoligono(e) {
  const coords = e.layer.getLatLngs()[0].map((ll) => [ll.lat, ll.lng])
  _grupoDesenho.clearLayers()
  abrirPainelCriacao(coords)
}

// ── abertura do painel ────────────────────────────────────────────────
function abrirPainelCriacao(coords) {
  _modoPainel = 'criar'
  _camadaSelecionada = null
  _zonaAtual = { id: null, nome: '', tipo: 'corte', geom: coords, flora: null, inclinacao: null, limpeza: null }
  renderPainel()
}

function abrirPainelEdicao(zona, camada) {
  _modoPainel = 'editar'
  _camadaSelecionada = camada
  _zonaAtual = {
    id: zona.id,
    nome: zona.nome,
    tipo: zona.tipo,
    geom: Array.isArray(zona.geom) ? zona.geom : [],
    flora: zona.flora ?? null,
    inclinacao: zona.inclinacao ?? null,
    limpeza: zona.limpeza ?? null,
  }
  renderPainel()
}

function fecharPainel() {
  const painel = document.getElementById('editor-painel')
  if (painel) {
    painel.classList.remove('aberto')
    painel.innerHTML = ''
  }
  _zonaAtual = null
  _modoPainel = null
  _camadaSelecionada = null
}

// ── montagem do painel — reusa .btn/.btn-p/.btn-s da folha comum
// (shared/pmoc.css) para os botões; o painel não cria família própria ──
function renderPainel() {
  const painel = document.getElementById('editor-painel')
  if (!painel || !_zonaAtual) return
  const z = _zonaAtual

  const chips = (lista, attr, labels) =>
    lista
      .map((v) => {
        const selecionado = z[attr] === v ? ' sel' : ''
        return `<button type="button" class="ed-chip${selecionado}" onclick="edEscolherAtributo('${attr}','${v}')">${esc(labels[v] || v)}</button>`
      })
      .join('')

  painel.innerHTML = `
    <div class="ed-fg">
      <label>Nome</label>
      <input type="text" id="ed-nome" value="${esc(z.nome)}"/>
    </div>
    <div class="ed-fg">
      <label>Tipo</label>
      <select id="ed-tipo">
        ${TIPOS_ZONA.map(([v, l]) => `<option value="${v}" ${z.tipo === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="ed-fg">
      <label>Flora</label>
      <div class="ed-chips">${chips(FLORAS, 'flora', FLORA_LABEL)}</div>
    </div>
    <div class="ed-fg">
      <label>Inclinação</label>
      <div class="ed-chips">${chips(INCLINACOES, 'inclinacao', INCLINACAO_LABEL)}</div>
    </div>
    <div class="ed-fg">
      <label>Limpeza</label>
      <div class="ed-chips">${chips(LIMPEZAS, 'limpeza', LIMPEZA_LABEL)}</div>
    </div>
    <div class="ed-fg">
      <div class="ed-compat" id="ed-compat">${compatHTML()}</div>
    </div>
    <div class="ed-area">Área: ${calcAreaM2(z.geom).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m²</div>
    ${_modoPainel === 'editar' ? '<button type="button" class="btn btn-s" onclick="edHabilitarArraste()">Arrastar vértices</button>' : ''}
    <div class="ed-actions">
      <button type="button" class="btn btn-p" onclick="edSalvarZona()">Salvar</button>
      <button type="button" class="btn btn-s" onclick="edCancelarZona()">Cancelar</button>
    </div>
  `
  painel.classList.add('aberto')
}

// Só a caixa de compatíveis é redesenhada a cada escolha de atributo — o
// resto do painel não precisa recarregar. Os não classificados nunca são
// escondidos (resposta ao Pitfall 1 da pesquisa da Fase 10, mesma decisão
// de mapa/xmap-layers-grama.js).
function compatHTML() {
  const z = _zonaAtual
  if (!z.flora || !z.inclinacao || !z.limpeza) {
    return '<span class="ed-compat-vazio">Defina os três atributos para ver as máquinas compatíveis.</span>'
  }
  const { compativeis, semMapeamento } = maquinasParaZona(z, _maquinas)
  const linhas = []
  linhas.push(
    compativeis.length
      ? `Compatíveis: ${compativeis.map((m) => esc(m.nome)).join(', ')}`
      : 'Nenhuma máquina compatível com estes atributos.'
  )
  if (semMapeamento.length) {
    const categorias = [...new Set(semMapeamento.map((m) => normalizarCategoria(m.categoria)))].join(', ')
    linhas.push(`${semMapeamento.length} fora da classificação (${esc(categorias)}) — existem, a regra não as reconhece.`)
  }
  return linhas.map((l) => `<div>${l}</div>`).join('')
}

function atualizarCompatBox() {
  const el = document.getElementById('ed-compat')
  if (el) el.innerHTML = compatHTML()
}

// ── manipuladores chamados pela marcação embutida do painel — publicados
// no escopo global no mesmo padrão que mapa/app.js (window.alternarModulo,
// window.sair) e os demais módulos do projeto usam para onclick="fn(...)"
// inline. Registrados só dentro de iniciarEditorZonas, depois da checagem
// de cargo — quem não tem cargo de escrita nunca ganha estes manipuladores
// no window global. ──
function exporManipuladores() {
  window.edEscolherAtributo = (attr, valor) => {
    if (!_zonaAtual) return
    _zonaAtual[attr] = valor
    document.querySelectorAll(`.ed-chips button[onclick*="'${attr}'"]`).forEach((btn) => {
      btn.classList.toggle('sel', btn.getAttribute('onclick').endsWith(`'${valor}')`))
    })
    atualizarCompatBox()
  }

  window.edSalvarZona = async () => {
    if (!_zonaAtual) return
    const nome = document.getElementById('ed-nome')?.value?.trim()
    const tipo = document.getElementById('ed-tipo')?.value
    if (!nome) {
      alert('Informe o nome da zona.')
      return
    }
    // Se os vértices foram arrastados (edHabilitarArraste), a geometria da
    // camada selecionada é a fonte de verdade; senão, a geometria do
    // desenho/da zona carregada segue como estava.
    const geom = _camadaSelecionada
      ? _camadaSelecionada.getLatLngs()[0].map((ll) => [ll.lat, ll.lng])
      : _zonaAtual.geom
    const zona = { ..._zonaAtual, nome, tipo, geom }
    const salvo =
      _modoPainel === 'editar' ? await atualizarZona(zona.id, zona) : await salvarZona(zona)
    if (!salvo) return // salvarZona/atualizarZona já avisaram o erro (idioma do projeto)
    fecharPainel()
    if (_grupoDesenho) _grupoDesenho.clearLayers()
    if (_mapa) await carregarZonasEditaveis(_mapa)
  }

  window.edCancelarZona = () => {
    if (_grupoDesenho) _grupoDesenho.clearLayers()
    fecharPainel()
  }

  // Habilita o arraste de vértice do polígono selecionado (Leaflet.draw
  // injeta .editing nos layers). A exclusão de zona NÃO entra aqui:
  // maq_areas tem coluna de arquivamento e o projeto arquiva em vez de
  // apagar, mas desativar zona pela tela é suposição sinalizada, fora
  // desta fase — ver 10-06-PLAN.md § Suposições sinalizadas.
  window.edHabilitarArraste = () => {
    if (_camadaSelecionada?.editing) {
      _camadaSelecionada.editing.enable()
      alert('Arraste os vértices no mapa e clique em Salvar quando terminar.')
    }
  }
}
