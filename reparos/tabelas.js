// ══════════════════════════════════════════════════════════════════
// Núcleo puro das três tabelas de /reparos (quick-260818-vtm, D2/D3/D4).
//
// Mesmo padrão núcleo-puro/aplicador-de-DOM de shared/tema.js e
// mapa/mapa-geometria.js: nada aqui toca document/window/localStorage nem
// qualquer outra API de navegador — só arrays, strings e números. Testável
// em Node puro. reparos/app.js importa este arquivo e o núcleo genérico de
// shared/tabela.js, e é quem escreve no DOM.
//
// Cada tabela expõe uma definição de colunas (COLUNAS_*) e um construtor de
// linha de exibição (linhas*()) que recebe os arrays já carregados e
// devolve, por registro, um objeto com os campos que a célula mostra —
// inclusive os que perderam coluna própria (D3) e as contagens (peças,
// serviços, usos, máquinas, reparos). O registro original fica guardado em
// `.registro`, porque o template de linha precisa do id para os handlers
// (abrirModalReparo(id), etc.).
// ══════════════════════════════════════════════════════════════════

// formatação local — mesma duplicação deliberada de maquinas/estoque-tabela.js:
// o texto de célula não pode depender de fR()/fH() de reparos/app.js, porque
// este arquivo não pode importar nada do módulo (seria acoplamento ao
// contrário: o puro dependendo do que toca o DOM).
function _fR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function _fH(v) { return Number(v || 0).toFixed(1).replace('.', ',') + ' h' }

// ── REPAROS ──────────────────────────────────────────────────────────────
// recebe os quatro arrays já carregados e devolve, por reparo, o texto do
// modelo (fabricante+modelo, ou "qualquer modelo" quando o reparo não tem
// modelo) e as duas contagens de vínculo.
export function linhasReparos(reparos, modelos, repMats, repServs) {
  return reparos.map(r => {
    const modelo = modelos.find(m => m.id === r.modelo_id)
    return {
      registro: r,
      modelo,
      codigo: r.codigo || '—',
      modeloTexto: modelo ? `${modelo.fabricante} ${modelo.modelo}` : 'qualquer modelo',
      sintoma: r.sintoma,
      causaProvavel: r.causa_provavel,
      sistema: r.sistema,
      gravidade: r.gravidade,
      confirmacoes: Number(r.frequencia) || 0,
      pecas: repMats.filter(x => x.reparo_id === r.id).length,
      servicos: repServs.filter(x => x.reparo_id === r.id).length,
    }
  })
}

// 5 colunas mais ações (a coluna de ações é escrita pelo aplicador de DOM,
// não faz parte da definição). O texto() de cada célula agrupada carrega
// tudo o que a célula mostra — é o que mantém filtrável e ordenável o dado
// que perdeu coluna própria (D3): fabricante/modelo, causa provável e
// gravidade continuam alcançáveis pelo filtro da coluna que os contém.
export const COLUNAS_REPAROS = [
  {
    id: 'codigo', rotulo: 'Código', tipo: 'texto',
    valor: l => l.codigo,
    texto: l => `${l.codigo} ${l.modeloTexto}`,
  },
  {
    id: 'sintoma', rotulo: 'Sintoma', tipo: 'texto',
    valor: l => l.sintoma,
    texto: l => `${l.sintoma} ${l.causaProvavel}`,
  },
  {
    id: 'sistema_gravidade', rotulo: 'Sistema / gravidade', tipo: 'texto',
    // ordena pelo sistema — é o dado técnico estável; a gravidade é um
    // selo de triagem que muda de sentido conforme a oficina, não uma
    // escala com ordem natural única (alta/média/baixa não é alfabética)
    valor: l => l.sistema,
    texto: l => `${l.sistema} ${l.gravidade}`,
  },
  {
    id: 'confirmacoes', rotulo: 'Confirmações', tipo: 'numero',
    valor: l => l.confirmacoes,
    texto: l => `${l.confirmacoes}×`,
  },
  {
    id: 'pecas_servicos', rotulo: 'Peças / serviços', tipo: 'numero',
    // ordena pela contagem de peças — é a que mais afeta a baixa de
    // estoque e o custo de uma OS corretiva; ordenar por texto
    // concatenado ("3 peças 1 serviço") produziria ordem alfabética sem
    // relação nenhuma com o tamanho real do reparo
    valor: l => l.pecas,
    texto: l => `${l.pecas} peças ${l.servicos} serviços`,
  },
]

// ── SERVIÇOS ─────────────────────────────────────────────────────────────
export function linhasServicos(servicos, repServs) {
  return servicos.map(s => ({
    registro: s,
    codigo: s.codigo || '—',
    nome: s.nome,
    especialidade: s.especialidade || '—',
    tempoPadraoH: s.tempo_padrao_h,
    valorHora: s.valor_hora,
    usos: repServs.filter(x => x.servico_id === s.id).length,
  }))
}

export const COLUNAS_SERVICOS = [
  {
    id: 'codigo', rotulo: 'Código', tipo: 'texto',
    valor: l => l.codigo,
    texto: l => `${l.codigo} ${l.nome}`,
  },
  {
    id: 'especialidade', rotulo: 'Especialidade', tipo: 'texto',
    valor: l => l.especialidade,
    texto: l => l.especialidade,
  },
  {
    id: 'tempo_valor', rotulo: 'Tempo / valor-hora', tipo: 'numero',
    // ordena pelo tempo padrão — é o dado primário do serviço (todo
    // serviço tem um tempo estimado); o valor-hora é opcional e nem todo
    // serviço tem preço lançado, então ordenar por ele misturaria "sem
    // valor" com "sem serviço definido"
    valor: l => (l.tempoPadraoH === null || l.tempoPadraoH === undefined ? null : Number(l.tempoPadraoH)),
    texto: l => `${l.tempoPadraoH ? _fH(l.tempoPadraoH) : '—'} ${l.valorHora ? _fR(l.valorHora) : '—'}`,
  },
  {
    id: 'usado_em', rotulo: 'Usado em', tipo: 'numero',
    valor: l => l.usos,
    texto: l => `${l.usos} reparo(s)`,
  },
]

// ── MODELOS ──────────────────────────────────────────────────────────────
export function linhasModelos(modelos, ativos, reparos) {
  return modelos.map(m => ({
    registro: m,
    codigo: m.codigo || '—',
    fabricante: m.fabricante,
    modelo: m.modelo,
    fabricanteModelo: `${m.fabricante} ${m.modelo}`,
    categoria: m.categoria || '—',
    motor: m.motor || '—',
    maquinas: ativos.filter(a => a.modelo_id === m.id).length,
    reparos: reparos.filter(r => r.modelo_id === m.id).length,
  }))
}

export const COLUNAS_MODELOS = [
  {
    id: 'codigo', rotulo: 'Código', tipo: 'texto',
    valor: l => l.codigo,
    texto: l => `${l.codigo} ${l.fabricanteModelo}`,
  },
  {
    id: 'tipo', rotulo: 'Tipo', tipo: 'texto',
    valor: l => l.categoria,
    texto: l => l.categoria,
  },
  {
    id: 'motor', rotulo: 'Motor', tipo: 'texto',
    valor: l => l.motor,
    texto: l => l.motor,
  },
  {
    id: 'maquinas_reparos', rotulo: 'Máquinas / reparos', tipo: 'numero',
    // ordena pela contagem de máquinas — é o inventário físico real; a
    // contagem de reparos é conhecimento acumulado no catálogo, não o
    // "tamanho" do modelo na frota (um modelo com 1 máquina pode ter mais
    // reparos documentados que um com 5, sem que isso o torne "maior")
    valor: l => l.maquinas,
    texto: l => `${l.maquinas} máquinas ${l.reparos} reparos`,
  },
]
