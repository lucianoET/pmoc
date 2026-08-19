// ══════════════════════════════════════════════════════════════════
// Definição de colunas do estoque de Máquinas + adaptador fino sobre o
// núcleo genérico de shared/tabela.js (quick-260818-vtm).
//
// O núcleo de ordenação e filtro que nasceu aqui (quick-260818-twm) subiu
// para shared/tabela.js e passou a servir também as três tabelas de
// /reparos. Este arquivo fica só com COLUNAS_ESTOQUE mais os wrappers que
// injetam essa definição nas funções genéricas — preservando exatamente as
// assinaturas de ontem, que tests/estoque-cabecalho-maquinas.test.js chama.
// Esse gate é contrato: é o adaptador que absorve qualquer diferença de
// assinatura entre o núcleo genérico e o consumidor, nunca o contrário.
//
// Deliberado: a formatação de texto de algumas células (preço, unidade)
// é duplicada aqui em vez de reaproveitar o template de linha de
// renderMateriais() — o markup da linha já está travado por gates
// existentes (tests/os-custos-maquinas.test.js) e não vale reescrevê-lo
// por causa de ordenação.
// ══════════════════════════════════════════════════════════════════
import {
  proximaOrdem,
  normalizarBusca,
  comparar,
  aplicarOrdemEFiltro as _aplicarOrdemEFiltroGenerico,
} from '../shared/tabela.js'

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

// reexportadas tal como estão — o núcleo genérico já tem a assinatura certa
export { proximaOrdem, normalizarBusca }

// compararMateriais(a, b, coluna, dir) — assinatura de ontem, quatro
// argumentos; injeta COLUNAS_ESTOQUE como quinto parâmetro do núcleo.
export function compararMateriais(a, b, coluna, dir) {
  return comparar(a, b, coluna, dir, COLUNAS_ESTOQUE)
}

// aplicarOrdemEFiltro(lista, ord, filtros) — assinatura de ontem, três
// argumentos; injeta COLUNAS_ESTOQUE como quarto parâmetro do núcleo.
export function aplicarOrdemEFiltro(lista, ord, filtros) {
  return _aplicarOrdemEFiltroGenerico(lista, ord, filtros, COLUNAS_ESTOQUE)
}
