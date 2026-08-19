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
import {
  carregarAreas,
  carregarAtivosDoModulo,
  carregarMaquinas,
  carregarLocaisSemPosicao,
  salvarPosicaoLocal,
  LOCAIS_SEM_POSICAO,
  MODULOS_DE_ATIVO,
  carregarLocaisComPosicao,
  posicionarAtivos,
  salvarZona,
  atualizarZona,
  salvarPosicaoAtivo,
  CARGOS_POSICAO,
  NAO_LOCALIZADOS,
} from './mapa-dados.js'

// Espelha exatamente a política de inserção/atualização de maq_areas
// (supabase/12_maquinas_areas_operacoes.sql, linhas 51-59) — os dois únicos
// cargos que o banco aceita para gravar zona. Nome e posição fixos: o gate
// de tests/mapa-editor.test.js extrai esta linha por eles e compara com a
// política real do banco.
const CARGOS_ZONA = ['admin', 'gestor']

// Reexportada em linha separada de propósito: o gate de
// tests/mapa-editor.test.js localiza a declaração acima por uma expressão
// ancorada em `const`/`let` no começo da linha e compararia com a policy
// real de maq_areas; prefixar `export` na declaração deixaria o gate cego.
// A barra lateral (mapa/app.js) precisa da lista para não oferecer
// "Desenhar" a quem o banco recusaria — e não pode redeclará-la.
export { CARGOS_ZONA }

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
let _btnZona = null
let _zonaAlvo = null // zona sem contorno esperando o próximo polígono desenhado

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
    // Guardado para que edDesenharZona (barra lateral) possa ligar o modo
    // sem o usuário ter que achar este botão antes — e para que o rótulo
    // dele continue refletindo o estado real quando isso acontecer.
    _btnZona = btn
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
  // Zona armada pela barra lateral ("Desenhar" numa zona sem contorno):
  // o polígono recém-fechado é o CONTORNO DELA, não uma zona nova. Sem
  // isto, carregarZonasEditaveis pula quem tem geom nula (menos de três
  // vértices, abaixo) e desenhar por cima criaria uma quarta linha
  // duplicada em vez de completar a que já existe.
  if (_zonaAlvo) {
    const zona = _zonaAlvo
    _zonaAlvo = null
    abrirPainelEdicao({ ...zona, geom: coords }, null)
    return
  }
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
  // Arma o desenho para uma zona QUE JÁ EXISTE sem contorno. Recebe só o
  // identificador; a linha é buscada de novo pela porta de dados, nunca
  // recebida por atributo de tela. Se o modo de edição estiver desligado,
  // liga — quem clicou em "Desenhar" já declarou a intenção, exigir que
  // ache o botão do mapa antes seria só um passo a mais para errar.
  window.edDesenharZona = async (id) => {
    const zonas = await carregarAreas()
    const zona = zonas.find((z) => z.id === id)
    if (!zona) {
      alert('Zona não encontrada — recarregue a página.')
      return
    }
    if (!_modoAtivo && _mapa && _btnZona) await alternarModoEdicao(_mapa, _btnZona)
    _zonaAlvo = zona
    alert(`Desenhe o contorno de "${zona.nome}" no mapa: clique nos vértices e feche o polígono.`)
  }

  window.edHabilitarArraste = () => {
    if (_camadaSelecionada?.editing) {
      _camadaSelecionada.editing.enable()
      alert('Arraste os vértices no mapa e clique em Salvar quando terminar.')
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// Modo de posicionamento de ativo (plano 10-07, PLAT-20) — estado próprio,
// não compartilha nenhuma variável com o editor de zona acima: os dois
// modos coexistem (cargos diferentes podem habilitar um, o outro, os dois
// ou nenhum).
//
// Dois comportamentos, os dois gravando só pela porta única de dados
// (salvarPosicaoAtivo, mapa/mapa-dados.js — Task 1 deste plano), nunca com
// escrita direta aqui:
//   1. Clicar em "Posicionar" num item da lista de não localizados
//      (mapa/app.js#renderNaoLocalizados, publicado aqui em
//      window.posSelecionarAtivo) entra em modo de espera de clique: o
//      próximo clique no mapa grava a posição daquele ativo. Esc cancela
//      sem gravar.
//   2. Com o modo "Mover ativos" ligado, os ativos já posicionados
//      aparecem numa camada PRÓPRIA do editor — não a camada de exibição
//      de xmap-layers-grama.js/-eletrica.js, fora dos arquivos deste
//      plano — com marcador arrastável; ao soltar, grava a nova posição.
//      Se a gravação falhar ou a coordenada for recusada pelo envelope, o
//      marcador volta à posição anterior (T-10-38).
// ══════════════════════════════════════════════════════════════════
let _mapaPosicao = null
let _modoPosicaoAtivo = false
let _grupoAtivosArrastaveis = null
let _controlePosicao = null
let _aguardandoClique = null // { modulo, id } | null
let _aoMudarPosicaoAtivo = () => {}

const FAIXA_AGUARDANDO_ID = 'mapa-editor-aguardando-clique'

export function iniciarEditorAtivos(mapa, usuario, aoMudarPosicao) {
  // Sai sem fazer nada quando o cargo não está em CARGOS_POSICAO — a
  // constante importada de mapa-dados.js, nunca redeclarada aqui: o gate
  // de tests/mapa-posicionamento.test.js confere a origem única.
  if (!CARGOS_POSICAO.includes(usuario?.role)) return
  _mapaPosicao = mapa
  _aoMudarPosicaoAtivo = typeof aoMudarPosicao === 'function' ? aoMudarPosicao : () => {}
  criarBotaoPosicionar(mapa)
  exporManipuladoresPosicao()
}

// ── botão de alternância do modo "Mover ativos", mesmo padrão de
// criarBotaoAlternar (editor de zona, acima): L.control reusando
// .btn/.btn-s da folha comum, sem família de botão nova ──
function criarBotaoPosicionar(mapa) {
  _controlePosicao = L.control({ position: 'topright' })
  _controlePosicao.onAdd = () => {
    const btn = L.DomUtil.create('button', 'btn btn-s')
    btn.type = 'button'
    btn.textContent = 'Mover ativos'
    btn.style.margin = '10px'
    L.DomEvent.disableClickPropagation(btn)
    btn.addEventListener('click', () => alternarModoPosicao(mapa, btn))
    return btn
  }
  _controlePosicao.addTo(mapa)
}

async function alternarModoPosicao(mapa, btn) {
  _modoPosicaoAtivo = !_modoPosicaoAtivo
  btn.classList.toggle('active', _modoPosicaoAtivo)
  if (_modoPosicaoAtivo) {
    btn.textContent = 'Parar de mover'
    await recarregarPosicionamento(mapa)
  } else {
    btn.textContent = 'Mover ativos'
    if (_grupoAtivosArrastaveis) {
      mapa.removeLayer(_grupoAtivosArrastaveis)
      _grupoAtivosArrastaveis = null
    }
  }
}

// Busca os ativos já posicionados de novo (máquinas + elétrica) e chama
// posicionarAtivos (núcleo puro + mapa-dados.js) — SEMPRE, não só quando
// "Mover ativos" está ligado, porque é esta busca que atualiza
// NAO_LOCALIZADOS depois de uma gravação. A lista da barra lateral
// (mapa/app.js#renderNaoLocalizados) precisa disso mesmo quando o usuário
// posicionou pela lista sem nunca ligar o modo de arraste — é o motivo de
// esta função não estar condicionada ao toggle, só o desenho da camada
// arrastável está.
async function recarregarPosicionamento(mapa) {
  // Percorre MODULOS_DE_ATIVO (mapa-dados.js) em vez de nomear máquinas e
  // elétrica à mão: com as três famílias novas, uma lista escrita aqui
  // seria a segunda lista de módulos do projeto e a primeira a esquecer o
  // próximo módulo — o ativo continuaria posicionável pela lista mas não
  // arrastável, sem ninguém notar.
  const locais = await carregarLocaisComPosicao()
  // Locais recarregados junto porque posicionar um PRÉDIO tira da lista de
  // não localizados todos os ativos que herdam dele.
  await carregarLocaisSemPosicao()
  const porModulo = await Promise.all(MODULOS_DE_ATIVO.map((modulo) => carregarAtivosDoModulo(modulo)))
  const posicionados = MODULOS_DE_ATIVO.flatMap((modulo, i) =>
    posicionarAtivos(porModulo[i], locais, modulo).map((a) => ({ ...a, _modulo: modulo }))
  )
  if (_modoPosicaoAtivo && mapa) desenharMarcadoresArrastaveis(mapa, posicionados)
  _aoMudarPosicaoAtivo()
}

// Camada própria do editor — não a camada de exibição registrada por
// xmap-layers-grama.js/-eletrica.js (fora dos arquivos deste plano), mesma
// decisão de carregarZonasEditaveis acima (editor de zona): os marcadores
// arrastáveis só existem enquanto "Mover ativos" está ligado, para não
// duplicar visualmente os marcadores de exibição o tempo todo.
function desenharMarcadoresArrastaveis(mapa, ativos) {
  if (_grupoAtivosArrastaveis) {
    mapa.removeLayer(_grupoAtivosArrastaveis)
    _grupoAtivosArrastaveis = null
  }
  _grupoAtivosArrastaveis = new L.FeatureGroup().addTo(mapa)
  for (const ativo of ativos) {
    const marker = L.marker([ativo.lat, ativo.lon], { draggable: true })
    let posicaoAnterior = marker.getLatLng()
    marker.on('dragstart', () => {
      posicaoAnterior = marker.getLatLng()
    })
    marker.on('dragend', async () => {
      const ll = marker.getLatLng()
      const salvo = await salvarPosicaoAtivo(ativo._modulo, ativo.id, ll.lat, ll.lng)
      if (!salvo) {
        // salvarPosicaoAtivo já avisou (envelope recusado ou erro do
        // banco, idioma do projeto). Devolver o marcador aqui, na volta
        // da gravação, é a única ordem possível de forma honesta: o aviso
        // de rede não dá para prever antes de tentar. O que importa é que
        // nenhum marcador fica visualmente "salvo" num lugar que o banco
        // recusou (T-10-38).
        marker.setLatLng(posicaoAnterior)
        return
      }
      await recarregarPosicionamento(mapa)
    })
    const origemTexto =
      ativo.origemPosicao === 'propria'
        ? 'Posição própria.'
        : 'Posição herdada do prédio — arrastar grava posição própria, sem mover o prédio.'
    marker.bindPopup(`<strong>${esc(ativo.rotulo || `#${ativo.id}`)}</strong><br>${origemTexto}`)
    _grupoAtivosArrastaveis.addLayer(marker)
  }
}

// ── posicionar a partir da lista de não localizados ─────────────────────
function selecionarParaPosicionar(modulo, id) {
  const item = NAO_LOCALIZADOS.find((a) => a.origemModulo === modulo && a.id === id)
  armarEsperaClique({ tipo: 'ativo', modulo, id }, item?.rotulo || `#${id}`)
}

// A outra camada da posição (plano quick-260818-vxu): o alvo é o PRÉDIO,
// não o ativo. Mesmo fluxo de espera de clique, mesma faixa, mesmo Esc —
// só muda a porta de escrita no fim. O nome vem de LOCAIS_SEM_POSICAO
// (mapa-dados.js) pelo identificador, nunca por atributo onclick, mesma
// razão registrada em mapa/app.js#renderItemNaoLocalizado.
function selecionarLocalParaPosicionar(id) {
  const local = LOCAIS_SEM_POSICAO.find((l) => l.id === id)
  armarEsperaClique({ tipo: 'local', id }, local?.nome || local?.codigo || `#${id}`)
}

function armarEsperaClique(alvo, nome) {
  if (!_mapaPosicao) return
  cancelarEsperaClique()
  _aguardandoClique = alvo
  mostrarFaixaAguardando(nome, alvo.tipo)
  _mapaPosicao.getContainer().style.cursor = 'crosshair'
  _mapaPosicao.once('click', aoClicarParaPosicionar)
  document.addEventListener('keydown', aoEscapeCancelar)
}

async function aoClicarParaPosicionar(e) {
  const alvo = _aguardandoClique
  if (!alvo) return
  encerrarEsperaClique()
  // Duas portas de escrita distintas, escolhidas pelo tipo do alvo — a de
  // ativo tem proibição explícita de tocar em cmasm_locais (D-03), a de
  // local grava só lá. O `if` fica aqui, no chamador, para nenhuma das
  // duas funções de gravação virar uma que decide sozinha qual tabela
  // escrever.
  const salvo =
    alvo.tipo === 'local'
      ? await salvarPosicaoLocal(alvo.id, e.latlng.lat, e.latlng.lng)
      : await salvarPosicaoAtivo(alvo.modulo, alvo.id, e.latlng.lat, e.latlng.lng)
  if (!salvo) return // as duas já avisaram o erro (idioma do projeto)
  await recarregarPosicionamento(_mapaPosicao)
}

function aoEscapeCancelar(evento) {
  if (evento.key === 'Escape') cancelarEsperaClique()
}

// Só a limpeza visual (cursor, faixa, listener de teclado) — usada tanto
// pelo cancelamento quanto pelo clique bem-sucedido, para os dois nunca
// deixarem a faixa ou o listener de Esc sobrando.
function encerrarEsperaClique() {
  _aguardandoClique = null
  ocultarFaixaAguardando()
  if (_mapaPosicao) _mapaPosicao.getContainer().style.cursor = ''
  document.removeEventListener('keydown', aoEscapeCancelar)
}

function cancelarEsperaClique() {
  if (!_aguardandoClique) return
  if (_mapaPosicao) _mapaPosicao.off('click', aoClicarParaPosicionar)
  encerrarEsperaClique()
}

// Faixa curta, mesmo idioma visual de mostrarErroDeCarga (mapa-dados.js) —
// classe .callout já existente na folha comum, sem cor escrita à mão.
// textContent, não innerHTML: o nome vem de linha de banco e nunca passa
// por marcação aqui, então esc() não se aplica (não é HTML).
function mostrarFaixaAguardando(nome, tipo) {
  let el = document.getElementById(FAIXA_AGUARDANDO_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = FAIXA_AGUARDANDO_ID
    el.className = 'callout co-blue'
    el.style.cssText =
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:1000;max-width:min(560px,92vw);margin:0'
    document.body.appendChild(el)
  }
  el.textContent =
    tipo === 'local'
      ? `Clique no mapa para posicionar o prédio "${nome}" — todos os ativos ligados a ele passam a herdar esta posição. Esc cancela.`
      : `Clique no mapa para posicionar "${nome}". Esc cancela.`
}

function ocultarFaixaAguardando() {
  document.getElementById(FAIXA_AGUARDANDO_ID)?.remove()
}

// Publicado no window só depois da checagem de cargo em iniciarEditorAtivos
// — mesmo padrão de exporManipuladores (editor de zona, acima): quem não
// tem cargo de escrita nunca ganha este manipulador global. Chamado pelo
// onclick que mapa/app.js#renderNaoLocalizados monta em cada item da
// lista de não localizados; recebe só módulo (vocabulário fechado) e
// identificador numérico — nunca o nome do ativo, que fica de fora do
// atributo onclick de propósito, para não abrir caminho de injeção via
// entidade HTML decodificada dentro de uma string JS de aspas simples.
function exporManipuladoresPosicao() {
  window.posSelecionarAtivo = (modulo, id) => selecionarParaPosicionar(modulo, id)
  window.posSelecionarLocal = (id) => selecionarLocalParaPosicionar(id)
}
