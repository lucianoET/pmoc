// ══════════════════════════════════════════════════════════════════
// Núcleo puro da ordenação e do filtro do estoque de Máquinas
// (quick-260818-twm, D3/D4).
//
// Mesmo padrão núcleo-puro/aplicador-de-DOM de shared/tema.js e
// mapa/mapa-geometria.js: nada aqui toca document/window/localStorage
// nem qualquer outra API de navegador — só arrays, strings e números.
// Testável em Node puro. maquinas/app.js importa este arquivo e é quem
// escreve no DOM (renderCabecalhoMateriais(), renderLinhasMateriais()).
//
// Deliberado: a formatação de texto de algumas células (preço, unidade)
// é duplicada aqui em vez de reaproveitar o template de linha de
// renderMateriais() — o markup da linha já está travado por gates
// existentes (tests/os-custos-maquinas.test.js) e não vale reescrevê-lo
// por causa de ordenação.
// ══════════════════════════════════════════════════════════════════

// status do material pela mesma comparação usada na linha da tabela
// (renderMateriais(): m.estoque_atual >= m.estoque_minimo)
function _statusMaterial(m) {
  return Number(m.estoque_atual) >= Number(m.estoque_minimo) ? 'OK' : 'BAIXO'
}

// nove colunas na ordem do <thead> de maquinas/index.html. `tipo:'numero'`
// só nas três colunas onde comparar como texto daria resultado errado
// (10 viria antes de 9); o resto é texto, mesmo quando o valor de origem é
// curto ou fixo (tipo, status).
export const COLUNAS_ESTOQUE = [
  {
    id: 'codigo', rotulo: 'Código', tipo: 'texto',
    valor: m => m.codigo || '',
    texto: m => m.codigo || '',
  },
  {
    id: 'nome', rotulo: 'Nome', tipo: 'texto',
    valor: m => m.nome || '',
    texto: m => m.nome || '',
  },
  {
    id: 'tipo', rotulo: 'Tipo', tipo: 'texto',
    valor: m => String(m.tipo || '').toUpperCase(),
    texto: m => String(m.tipo || '').toUpperCase(),
  },
  {
    id: 'sistema', rotulo: 'Sistema', tipo: 'texto',
    valor: m => m.sistema || '',
    texto: m => m.sistema || '',
  },
  {
    id: 'aplicacao', rotulo: 'Aplicação', tipo: 'texto',
    valor: m => m.aplicacao || '',
    texto: m => m.aplicacao || '',
  },
  {
    id: 'estoque_atual', rotulo: 'Estoque atual', tipo: 'numero',
    valor: m => Number(m.estoque_atual),
    texto: m => `${m.estoque_atual} ${m.unidade || ''}`.trim(),
  },
  {
    id: 'estoque_minimo', rotulo: 'Mínimo', tipo: 'numero',
    valor: m => Number(m.estoque_minimo),
    texto: m => `${m.estoque_minimo} ${m.unidade || ''}`.trim(),
  },
  {
    id: 'preco', rotulo: 'Preço un.', tipo: 'numero',
    // preço null é "não informado", não zero — a mesma regra de
    // valorHoraPadrao() em maquinas/app.js
    valor: m => (m.preco === null || m.preco === undefined ? null : Number(m.preco)),
    texto: m => (m.preco ? 'R$ ' + Number(m.preco).toFixed(2) : ''),
  },
  {
    id: 'status', rotulo: 'Status', tipo: 'texto',
    valor: _statusMaterial,
    texto: _statusMaterial,
  },
]

// proximaOrdem — ciclo travado, uma coluna por vez: sem ordem → crescente →
// decrescente → sem ordem. Qualquer valor que não seja 'asc'/'desc' entra
// como "sem ordem" (mesma queda defensiva de proximoTema em shared/tema.js).
export function proximaOrdem(dir) {
  if (dir === 'asc') return 'desc'
  if (dir === 'desc') return null
  return 'asc'
}

// normalizarBusca — minúsculas + NFD sem diacríticos, tolerando
// null/undefined/número. 'Óleo' e 'oleo' precisam casar.
export function normalizarBusca(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// valor "vazio" para fins de ordenação: null/undefined/string vazia/NaN.
// Zero não é vazio — 0 de estoque é uma informação real, não ausência dela.
function _vazio(valor) {
  return valor === null || valor === undefined || valor === '' ||
    (typeof valor === 'number' && Number.isNaN(valor))
}

// compararMateriais — numérico por valor() nas três colunas numéricas,
// localeCompare('pt-BR') sobre texto() no resto. Vazio/nulo sempre no fim,
// nas duas direções: o vazio não é "menor", é "não informado", e um "não
// informado" no topo da lista decrescente seria pior do que não ordenar.
export function compararMateriais(a, b, coluna, dir) {
  const col = COLUNAS_ESTOQUE.find(c => c.id === coluna)
  if (!col) return 0

  if (col.tipo === 'numero') {
    const va = col.valor(a)
    const vb = col.valor(b)
    const vaVazio = _vazio(va)
    const vbVazio = _vazio(vb)
    if (vaVazio && vbVazio) return 0
    if (vaVazio) return 1
    if (vbVazio) return -1
    return dir === 'desc' ? vb - va : va - vb
  }

  const ta = col.texto(a)
  const tb = col.texto(b)
  const taVazio = _vazio(ta)
  const tbVazio = _vazio(tb)
  if (taVazio && tbVazio) return 0
  if (taVazio) return 1
  if (tbVazio) return -1
  const cmp = ta.localeCompare(tb, 'pt-BR')
  return dir === 'desc' ? -cmp : cmp
}

// aplicarOrdemEFiltro — filtra por substring normalizada sobre texto() de
// cada coluna com filtro preenchido (todos os filtros ativos em conjunção),
// depois ordena. Sem ord.coluna devolve a ordem de entrada (filter()
// preserva ordem; sort() só entra quando há coluna escolhida). Sem sintaxe
// de comparação — '>' e '<' num campo de filtro são texto como qualquer
// outro caractere, não um operador.
export function aplicarOrdemEFiltro(lista, ord, filtros) {
  const filtrosAtivos = Object.entries(filtros || {}).filter(([, valor]) => valor)

  let resultado = filtrosAtivos.length
    ? lista.filter(m => filtrosAtivos.every(([colunaId, valorFiltro]) => {
        const col = COLUNAS_ESTOQUE.find(c => c.id === colunaId)
        if (!col) return true
        return normalizarBusca(col.texto(m)).includes(normalizarBusca(valorFiltro))
      }))
    : lista.slice()

  if (ord && ord.coluna) {
    resultado = resultado.slice().sort((a, b) => compararMateriais(a, b, ord.coluna, ord.dir))
  }

  return resultado
}
