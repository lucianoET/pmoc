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

// conta ocorrências por chave numa passada só. As linhas são reconstruídas
// a cada tecla digitada num filtro de coluna, então varrer os vínculos uma
// vez por linha faria o custo crescer com o produto dos dois arrays — e o
// catálogo é feito para ser compartilhado entre oficinas, ou seja, para
// crescer.
function _contarPor(lista, campo) {
  const mapa = new Map()
  for (const item of lista) {
    const chave = item[campo]
    mapa.set(chave, (mapa.get(chave) || 0) + 1)
  }
  return mapa
}

function _indexarPorId(lista) {
  const mapa = new Map()
  for (const item of lista) mapa.set(item.id, item)
  return mapa
}

// ── REPAROS ──────────────────────────────────────────────────────────────
// recebe os quatro arrays já carregados e devolve, por reparo, o texto do
// modelo (fabricante+modelo, ou "qualquer modelo" quando o reparo não tem
// modelo) e as duas contagens de vínculo.
export function linhasReparos(reparos, modelos, repMats, repServs) {
  const porId = _indexarPorId(modelos)
  const pecasPorReparo = _contarPor(repMats, 'reparo_id')
  const servicosPorReparo = _contarPor(repServs, 'reparo_id')
  return reparos.map(r => {
    const modelo = porId.get(r.modelo_id)
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
      pecas: pecasPorReparo.get(r.id) || 0,
      servicos: servicosPorReparo.get(r.id) || 0,
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
  const usosPorServico = _contarPor(repServs, 'servico_id')
  return servicos.map(s => ({
    registro: s,
    codigo: s.codigo || '—',
    nome: s.nome,
    especialidade: s.especialidade || '—',
    tempoPadraoH: s.tempo_padrao_h,
    valorHora: s.valor_hora,
    usos: usosPorServico.get(s.id) || 0,
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
  const ativosPorModelo = _contarPor(ativos, 'modelo_id')
  const reparosPorModelo = _contarPor(reparos, 'modelo_id')
  return modelos.map(m => ({
    registro: m,
    codigo: m.codigo || '—',
    fabricante: m.fabricante,
    modelo: m.modelo,
    fabricanteModelo: `${m.fabricante} ${m.modelo}`,
    categoria: m.categoria || '—',
    // rótulo acentuado e capitalizado do vocabulário de tipo (D4) — a
    // mesma tradução usada no controle de tipo/modelo e no agrupamento,
    // para que a coluna "Tipo" da tabela e o filtro falem a mesma língua
    tipoRotulo: m.categoria ? rotuloTipo(m.categoria) : '—',
    motor: m.motor || '—',
    maquinas: ativosPorModelo.get(m.id) || 0,
    reparos: reparosPorModelo.get(m.id) || 0,
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
    valor: l => l.tipoRotulo,
    texto: l => l.tipoRotulo,
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

// ══════════════════════════════════════════════════════════════════
// Filtro e agrupamento por tipo de máquina (quick-260818-vtm, D4).
// ══════════════════════════════════════════════════════════════════

// mapa fechado das categorias gravadas (sem acento, migração 27) para o
// rótulo acentuado e capitalizado que a tela mostra. Categoria fora do
// mapa cai para a capitalização simples do valor bruto — uma categoria
// nova cadastrada amanhã tem que aparecer na tela, não sumir.
const VOCAB_TIPO = {
  rocadeira: 'Roçadeira',
  trator: 'Trator',
  motoserra: 'Motosserra',
  minitrator: 'Minitrator',
}

export function rotuloTipo(categoria) {
  if (!categoria) return categoria
  return VOCAB_TIPO[categoria] || (categoria.charAt(0).toUpperCase() + categoria.slice(1))
}

// opções do controle único de tipo/modelo, construídas a partir dos
// modelos carregados — nenhum valor fixo no código. Um grupo com as
// categorias distintas presentes em rep_modelos, outro com os modelos
// (fabricante + modelo). O valor de cada opção carrega o próprio tipo
// ("categoria:trator" ou "modelo:7"), para que o predicado saiba qual
// dos dois está selecionado sem precisar de um segundo campo de estado.
export function opcoesTipoMaquina(modelos) {
  const categorias = [...new Set(modelos.map(m => m.categoria).filter(Boolean))]
    .sort((a, b) => rotuloTipo(a).localeCompare(rotuloTipo(b), 'pt-BR'))
    .map(c => ({ valor: `categoria:${c}`, rotulo: rotuloTipo(c) }))

  const modelosOrdenados = modelos
    .slice()
    .sort((a, b) => `${a.fabricante} ${a.modelo}`.localeCompare(`${b.fabricante} ${b.modelo}`, 'pt-BR'))
    .map(m => ({ valor: `modelo:${m.id}`, rotulo: `${m.fabricante} ${m.modelo}` }))

  return { categorias, modelos: modelosOrdenados }
}

// decompõe o valor do controle ("categoria:trator" | "modelo:7" | "") no
// tipo de seleção e no valor comparável. Vazio devolve null — "nenhuma
// seleção" é tratado à parte em cada predicado, não como um tipo próprio.
function _parseSelecao(selecao) {
  if (!selecao) return null
  const i = selecao.indexOf(':')
  // sem separador é entrada inválida, não um tipo desconhecido: devolver
  // null faz o predicado cair no mesmo caminho de "nenhuma seleção", em vez
  // de depender do fallthrough de um tipo que não casa com nenhum ramo
  if (i < 0) return null
  const tipo = selecao.slice(0, i)
  const valor = selecao.slice(i + 1)
  // seleção que não nomeia valor nenhum não é seleção. Sem esta guarda,
  // 'modelo:' viraria Number('') === 0, que não é id de modelo algum e
  // esvaziaria a tabela sem dizer por quê.
  if (!valor) return null
  if (tipo === 'modelo') {
    const id = Number(valor)
    return Number.isFinite(id) ? { tipo, valor: id } : null
  }
  return { tipo, valor }
}

// filtro da aba Modelos: passa quando é o modelo escolhido ou tem a
// categoria escolhida.
export function filtroTipoModelos(modelo, selecao) {
  const sel = _parseSelecao(selecao)
  if (!sel) return true
  if (sel.tipo === 'modelo') return modelo.id === sel.valor
  if (sel.tipo === 'categoria') return modelo.categoria === sel.valor
  return true
}

// filtro da aba Reparos: reparo sem modelo passa sempre — regra que já
// existia em reparosFiltrados() do Diagnóstico e se preserva aqui
// literalmente, porque "aplica a qualquer máquina" é o próprio sentido do
// campo modelo_id nulo. Com modelo, passa quando o modelo é o escolhido ou
// tem a categoria escolhida.
export function filtroTipoReparos(reparo, modelos, selecao) {
  const sel = _parseSelecao(selecao)
  if (!sel) return true
  if (!reparo.modelo_id) return true
  const modelo = modelos.find(m => m.id === reparo.modelo_id)
  if (!modelo) return true
  if (sel.tipo === 'modelo') return modelo.id === sel.valor
  if (sel.tipo === 'categoria') return modelo.categoria === sel.valor
  return true
}

// filtro da aba Serviços: passa quando algum reparo que sobreviveu ao
// filtro de tipo (já calculado por quem chama, via filtroTipoReparos) o
// consome. Serviço sem nenhum vínculo só passa com o filtro vazio — sem
// seleção nenhuma linha é reprovada.
export function filtroTipoServicos(servico, selecao, reparosFiltrados, repServs) {
  if (!selecao) return true
  const idsReparosFiltrados = new Set(reparosFiltrados.map(r => r.id))
  return repServs.some(x => x.servico_id === servico.id && idsReparosFiltrados.has(x.reparo_id))
}

// agrupa linhas já ordenadas e filtradas por uma função de chave, que
// devolve { chave, rotulo } por linha — chave nula é o grupo de ausência,
// consolidado num só grupo e sempre por último. Os demais grupos saem
// ordenados pelo rótulo em pt-BR; dentro de cada grupo, a ordem de entrada
// (a ordenação de coluna já aplicada antes) é preservada.
export function agrupar(linhas, funcaoChave) {
  const grupos = new Map()
  for (const linha of linhas) {
    const { chave, rotulo } = funcaoChave(linha)
    const chaveMapa = chave === null ? '__ausencia__' : chave
    if (!grupos.has(chaveMapa)) grupos.set(chaveMapa, { chave, rotulo, linhas: [] })
    grupos.get(chaveMapa).linhas.push(linha)
  }
  const lista = [...grupos.values()]
  const comChave = lista.filter(g => g.chave !== null).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
  const ausencia = lista.filter(g => g.chave === null)
  return [...comChave, ...ausencia]
}

// chave de agrupamento de Modelos: a própria categoria (dado bruto, não o
// rótulo já acentuado de linha.categoria, que usa '—' como marcador de
// tela e viraria uma "categoria" fantasma se usado aqui).
export function chaveGrupoModelos(linha) {
  const cat = linha.registro.categoria
  if (!cat) return { chave: null, rotulo: 'Sem categoria' }
  return { chave: cat, rotulo: rotuloTipo(cat) }
}

// chave de agrupamento de Reparos: a categoria do modelo, ou o grupo de
// ausência quando o reparo não tem modelo (mesma regra do filtro).
export function chaveGrupoReparos(linha, modelos) {
  const r = linha.registro
  if (!r.modelo_id) return { chave: null, rotulo: 'Sem modelo' }
  const modelo = modelos.find(m => m.id === r.modelo_id)
  const cat = modelo?.categoria
  if (!cat) return { chave: null, rotulo: 'Sem modelo' }
  return { chave: cat, rotulo: rotuloTipo(cat) }
}

// chave de agrupamento de Serviços: a categoria dos reparos que o
// consomem. Duplicar o serviço em vários grupos seria a alternativa mais
// óbvia, mas mentiria sobre a contagem de cada grupo — por isso um serviço
// usado por mais de uma categoria cai num grupo único "Vários tipos", não
// em cada categoria que o usa. Reparo sem modelo (ou modelo sem categoria)
// não contribui categoria nenhuma; um serviço só ligado a reparos assim
// cai em "Sem vínculo" — não há vínculo categorizável, mesmo caso de um
// serviço sem vínculo nenhum.
export function chaveGrupoServicos(linha, reparos, modelos, repServs) {
  const s = linha.registro
  const vinculos = repServs.filter(x => x.servico_id === s.id)
  if (!vinculos.length) return { chave: null, rotulo: 'Sem vínculo' }

  const categorias = new Set()
  for (const v of vinculos) {
    const reparo = reparos.find(r => r.id === v.reparo_id)
    const modelo = reparo?.modelo_id ? modelos.find(m => m.id === reparo.modelo_id) : null
    if (modelo?.categoria) categorias.add(modelo.categoria)
  }

  if (categorias.size === 0) return { chave: null, rotulo: 'Sem vínculo' }
  if (categorias.size > 1) return { chave: '__varios__', rotulo: 'Vários tipos' }
  const unica = [...categorias][0]
  return { chave: unica, rotulo: rotuloTipo(unica) }
}
