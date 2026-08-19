// ══════════════════════════════════════════════════════════════════
// Núcleo puro de ordenação e filtro de tabela, genérico por definição
// de colunas (quick-260818-vtm, D2).
//
// Mesmo padrão núcleo-puro/aplicador-de-DOM de shared/tema.js e
// mapa/mapa-geometria.js: nada aqui toca document/window/localStorage
// nem qualquer outra API de navegador — só arrays, strings e números.
// Testável em Node puro.
//
// Nasceu em maquinas/estoque-tabela.js (quick-260818-twm, aba Estoque de
// Máquinas) e sobe para cá para servir também as três tabelas de /reparos.
// Nenhum nome de campo de material ou de reparo pode aparecer neste
// arquivo — a definição de colunas é sempre parâmetro, nunca constante
// interna. `maquinas/estoque-tabela.js` e `reparos/tabelas.js` são os
// dois adaptadores que injetam `colunas`.
// ══════════════════════════════════════════════════════════════════

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
// Zero não é vazio — 0 é uma informação real, não ausência dela.
function _vazio(valor) {
  return valor === null || valor === undefined || valor === '' ||
    (typeof valor === 'number' && Number.isNaN(valor))
}

// comparar — numérico por valor() nas colunas tipo:'numero',
// localeCompare('pt-BR') sobre texto() no resto. Vazio/nulo sempre no fim,
// nas duas direções: o vazio não é "menor", é "não informado", e um "não
// informado" no topo da lista decrescente seria pior do que não ordenar.
// Coluna ausente de `colunas` devolve 0 — nem ordena nem quebra.
export function comparar(a, b, coluna, dir, colunas) {
  const col = (colunas || []).find(c => c.id === coluna)
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
// outro caractere, não um operador. Coluna de filtro ausente de `colunas`
// é ignorada (não derruba a lista inteira).
export function aplicarOrdemEFiltro(lista, ord, filtros, colunas) {
  const filtrosAtivos = Object.entries(filtros || {}).filter(([, valor]) => valor)

  let resultado = filtrosAtivos.length
    ? lista.filter(item => filtrosAtivos.every(([colunaId, valorFiltro]) => {
        const col = (colunas || []).find(c => c.id === colunaId)
        if (!col) return true
        return normalizarBusca(col.texto(item)).includes(normalizarBusca(valorFiltro))
      }))
    : lista.slice()

  if (ord && ord.coluna) {
    resultado = resultado.slice().sort((a, b) => comparar(a, b, ord.coluna, ord.dir, colunas))
  }

  return resultado
}
