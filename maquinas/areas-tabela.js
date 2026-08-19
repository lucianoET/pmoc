// ══════════════════════════════════════════════════════════════════
// Definição de colunas da tabela de ÁREAS de serviço (aba Operações de
// Máquinas) + adaptador fino sobre o núcleo genérico de shared/tabela.js.
//
// Terceiro consumidor daquele núcleo, depois do estoque de Máquinas e das
// três tabelas de /reparos — e a prova de que ele é genérico de verdade:
// nenhuma linha de shared/tabela.js precisou mudar para atender esta
// tabela. Como em maquinas/estoque-tabela.js, o que mora aqui é só a
// definição de colunas mais os wrappers que a injetam; nome de campo de
// área nunca aparece no núcleo.
//
// `tipo:'numero'` só onde comparar como texto daria resultado errado —
// dimensão e periodicidade. O resto é texto, inclusive `tipo`, que é lista
// fechada curta.
// ══════════════════════════════════════════════════════════════════
import {
  proximaOrdem,
  normalizarBusca,
  comparar,
  aplicarOrdemEFiltro as _aplicarOrdemEFiltroGenerico,
} from '../shared/tabela.js'

// Vocabulário de exibição do tipo de serviço — o do banco
// (supabase/12_maquinas_areas_operacoes.sql), não o do editor legado.
const TIPO_LABEL = { corte: 'Corte', poda: 'Poda', limpeza: 'Limpeza', mista: 'Mista', outro: 'Outro' }

export function rotuloDoTipo(tipo) {
  return TIPO_LABEL[tipo] || tipo || ''
}

// Uma zona desenhada no mapa tem `geom`; a dimensão dela é DERIVADA do
// polígono (mapa/mapa-dados.js recalcula area_m2 a cada gravação). A
// coluna diz isso na tela para o número não parecer digitável quando não é.
// Metro quadrado com três casas decimais é ruído: a área vem do cálculo
// geodésico do polígono e chega com fração. O /mapa já exibe arredondado
// (maximumFractionDigits: 0) — a tabela fala a mesma língua.
export function formatarArea(valor) {
  if (valor === null || valor === undefined || valor === '') return ''
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : ''
}

export function temContorno(area) {
  return Array.isArray(area?.geom) && area.geom.length >= 3
}

export const COLUNAS_AREAS = [
  {
    id: 'codigo', rotulo: 'Código', tipo: 'texto',
    valor: a => a.codigo || '',
    texto: a => a.codigo || '',
  },
  {
    id: 'nome', rotulo: 'Área', tipo: 'texto',
    valor: a => a.nome || '',
    texto: a => a.nome || '',
  },
  {
    id: 'tipo', rotulo: 'Tipo', tipo: 'texto',
    valor: a => rotuloDoTipo(a.tipo),
    texto: a => rotuloDoTipo(a.tipo),
  },
  {
    id: 'area_m2', rotulo: 'Dimensão', tipo: 'numero',
    // null é "não informado", não zero — mesma regra do preço no estoque.
    valor: a => (a.area_m2 === null || a.area_m2 === undefined ? null : Number(a.area_m2)),
    // O texto do filtro inclui a marca do contorno: procurar "mapa" acha
    // as zonas cuja dimensão veio do polígono desenhado.
    texto: a => {
      const numero = a.area_m2 == null ? '' : `${formatarArea(a.area_m2)} m²`
      return temContorno(a) ? `${numero} mapa`.trim() : numero
    },
  },
  {
    id: 'periodicidade_dias', rotulo: 'Periodicidade', tipo: 'numero',
    valor: a => (a.periodicidade_dias === null || a.periodicidade_dias === undefined ? null : Number(a.periodicidade_dias)),
    texto: a => (a.periodicidade_dias ? `${a.periodicidade_dias} dias` : ''),
  },
  {
    id: 'localizacao', rotulo: 'Localização', tipo: 'texto',
    valor: a => a.localizacao || '',
    texto: a => a.localizacao || '',
  },
]

export { proximaOrdem, normalizarBusca }

export function compararAreas(a, b, coluna, dir) {
  return comparar(a, b, coluna, dir, COLUNAS_AREAS)
}

export function aplicarOrdemEFiltro(lista, ord, filtros) {
  return _aplicarOrdemEFiltroGenerico(lista, ord, filtros, COLUNAS_AREAS)
}
