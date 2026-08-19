// ══════════════════════════════════════════════════════════════════
// mapa/mapa-planta.js — planta de referência sobre o mapa.
//
// Portado em FUNÇÃO do overlay de `DEV_reference_readonly/cmasm-mapa-v2`
// (PLANTA: arquivo, opacidade, escala, rotação, drag&drop), com uma
// diferença que é o ponto todo: lá a imagem é um `<img>` centralizado no
// viewport por `transform` de CSS — ela NÃO acompanha o mapa. Arrastar o
// mapa move o mapa e deixa a planta parada, então ela serve para olhar, não
// para desenhar por cima. Aqui é `L.imageOverlay` amarrado a coordenadas:
// a planta gruda no terreno, e é isso que permite traçar o contorno de um
// prédio sobre ela.
//
// O georreferenciamento é o mais simples que funciona: a imagem entra nos
// limites visíveis da tela e o usuário reenquadra até casar com o terreno
// (mover/dar zoom no mapa e apertar "Encaixar aqui"). Rotação e ajuste por
// canto exigiriam L.DistortableImageOverlay — dependência nova para um
// ganho que este fluxo já entrega.
//
// Nada disto vai para o banco: a planta vive na aba, some no recarregamento.
// É andaime de desenho, não dado do cadastro — gravá-la exigiria bucket de
// Storage com política própria, que é decisão de outra tarefa.
// ══════════════════════════════════════════════════════════════════

const NOME_PAINEL = 'xmap-planta-referencia'

let _mapa = null
let _overlay = null
let _aviso = () => {}

function elemento(id) {
  return document.getElementById(id)
}

function opacidadeAtual() {
  const valor = Number(elemento('planta-opacidade')?.value ?? 55)
  return Number.isFinite(valor) ? valor / 100 : 0.55
}

// Painel próprio entre o tile (200) e a planta vetorial do OSM (350): a
// imagem escaneada é fundo, nunca cobre polígono nem marcador.
function garantirPainel() {
  if (!_mapa.getPane(NOME_PAINEL)) {
    const painel = _mapa.createPane(NOME_PAINEL)
    painel.style.zIndex = 300
  }
  return NOME_PAINEL
}

function mostrarControles(mostrar) {
  elemento('planta-controles')?.toggleAttribute('hidden', !mostrar)
}

function aplicar(url) {
  if (!_mapa) return
  remover({ silencioso: true })
  _overlay = L.imageOverlay(url, _mapa.getBounds(), {
    opacity: opacidadeAtual(),
    interactive: false,
    pane: garantirPainel(),
  }).addTo(_mapa)
  mostrarControles(true)
  _aviso('Planta posicionada nos limites da tela. Ajuste o mapa e use "Encaixar aqui".')
}

// Lê o arquivo local como data URL. Nada sai da máquina: não há upload, não
// há gravação — o arquivo é do usuário e fica na aba dele.
function carregarArquivo(arquivo) {
  if (!arquivo) return
  if (!String(arquivo.type || '').startsWith('image/')) {
    _aviso('Use uma imagem da planta (PNG, JPG ou SVG).')
    return
  }
  const leitor = new FileReader()
  leitor.onload = (evento) => aplicar(evento.target.result)
  leitor.onerror = () => _aviso('Não foi possível ler o arquivo da planta.')
  leitor.readAsDataURL(arquivo)
}

// O encaixe: o usuário move e dá zoom no mapa até a vista corresponder ao
// que a planta mostra, e este botão prende a imagem nesses limites. É o
// georreferenciamento manual — dois pontos de vista sobre o mesmo terreno,
// alinhados à mão, que é como uma planta em papel é lida em campo.
function encaixarNaTela() {
  if (!_overlay || !_mapa) return
  _overlay.setBounds(_mapa.getBounds())
  _aviso('Planta encaixada nos limites atuais.')
}

function remover({ silencioso = false } = {}) {
  if (_overlay && _mapa) _mapa.removeLayer(_overlay)
  _overlay = null
  if (silencioso) return
  mostrarControles(false)
  const campo = elemento('planta-arquivo')
  if (campo) campo.value = ''
  _aviso('Planta removida.')
}

/**
 * Liga os controles da barra lateral e o arraste de arquivo sobre o mapa.
 * @param {L.Map} mapa      instância que o xMap já expõe (nenhuma segunda é criada)
 * @param {(msg:string)=>void} aviso  faixa de aviso da tela (mapa/app.js)
 */
export function iniciarPlantaDeReferencia(mapa, aviso) {
  _mapa = mapa
  if (typeof aviso === 'function') _aviso = aviso

  elemento('planta-arquivo')?.addEventListener('change', (evento) => {
    carregarArquivo(evento.target.files?.[0])
  })
  elemento('planta-opacidade')?.addEventListener('input', () => {
    _overlay?.setOpacity(opacidadeAtual())
  })
  elemento('planta-encaixar')?.addEventListener('click', encaixarNaTela)
  elemento('planta-remover')?.addEventListener('click', () => remover())

  // Arrastar o arquivo direto sobre o mapa, como na referência. O
  // preventDefault no dragover é obrigatório: sem ele o navegador abre a
  // imagem numa aba nova e o soltar nunca chega aqui.
  const container = mapa.getContainer()
  container.addEventListener('dragover', (evento) => {
    evento.preventDefault()
    container.classList.add('arrastando-planta')
  })
  container.addEventListener('dragleave', () => container.classList.remove('arrastando-planta'))
  container.addEventListener('drop', (evento) => {
    evento.preventDefault()
    container.classList.remove('arrastando-planta')
    carregarArquivo(evento.dataTransfer?.files?.[0])
  })
}
