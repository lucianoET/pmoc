// ══════════════════════════════════════════════════════════════════
// Leitura numérica de formulário — a porta única de /maquinas
//
// Até aqui o módulo lia número de campo em 25 lugares, cada um com o seu
// próprio jeito: `parseFloat(x.value) || 0`, `|| null`, `if(!valor)`, ou
// uma comparação escrita à mão. Não havia leitor central, e por isso a
// migração 58 saiu sem espelho na tela — decisão registrada no CLAUDE.md,
// com a justificativa de que `type="number"` entrega número e "não existe
// caminho de corrupção silenciosa".
//
// ── Essa justificativa estava ERRADA, e a medição é o motivo deste arquivo
// Medido no Chromium, com teclado de verdade, em pt-BR E em en-US (o
// resultado é idêntico nos dois — não é questão de locale):
//
//   digita "12,5"  → input.value === "125"    ← a vírgula é DESCARTADA
//   digita "0,5"   → input.value === "05"     → 5
//   digita "1.200" → input.value === "1.200"  → 1.2
//
// O navegador não recusa a vírgula: ele engole o caractere e mantém os
// dígitos. `validity.badInput` é false, `min` não dispara, e
// `valueAsNumber` concorda com o valor corrompido. Um mecânico que
// abastece 12,5 litros grava **125 litros** — dez vezes mais — sem uma
// mensagem de erro em lugar nenhum.
//
// É a mesma classe de `dissipacao_w = '1.200'` virando 1,2 que motivou a
// migração 56, e é pior: lá o erro encolhia o valor e havia check no banco
// para barrar o absurdo; aqui ele INFLA e `maq_abastecimentos` sequer tem
// check (a tabela estava vazia na triagem da 58).
//
// Só a digitação real expõe isso: atribuir `input.value = "12,5"` por
// código devolve string vazia, porque a propriedade sanitiza. Um teste que
// preenchesse o campo programaticamente jamais veria o defeito — foi assim
// que ele sobreviveu.
//
// ── Por que os campos deixaram de ser `type="number"`
// A primeira tentativa foi consertar no lugar: interceptar `beforeinput` e
// trocar a vírgula por ponto enquanto a pessoa digita. Não funciona, e a
// medição diz exatamente por quê:
//
//   setRangeText em type=number → lança "does not support selection"
//   input.value = "12."         → o campo é ZERADO pela sanitização
//
// Sem API de seleção não há como saber onde o cursor está, e sem poder
// atribuir um valor parcial não há como reconstruir o texto. `type="number"`
// não tem conserto para separador decimal — é uma limitação da plataforma,
// não uma falta de esforço.
//
// Os campos passaram a `type="text" inputmode="decimal"` (e `numeric` no
// único inteiro), medido: "12,5", "0,5", "1.200", "1234,56" e "-3,5"
// chegam INTEIROS ao JavaScript, e a vírgula digitada no meio do número
// cai onde o cursor está. O celular continua abrindo teclado numérico, que
// é o que `inputmode` faz.
//
// O preço, declarado: perdem-se as setinhas de incremento e o `step` no
// computador, e o `min` deixa de colorir o campo. As setinhas eram
// conveniência; o `min` era decorativo — nunca bloqueou nada, porque estes
// modais não submetem `<form>`, chamam `salvarX()` no clique. O que entra
// no lugar é uma frase que diz qual campo e qual limite.
//
// A consequência boa é que agora o leitor é OBRIGATÓRIO: com `.value` sendo
// texto livre, quem ler o campo sem passar por aqui recebe string. A porta
// única deixou de depender de disciplina.
//
// ── A regra: a tela é IGUAL OU MAIS ESTRITA que o banco, nunca mais frouxa
// Cada campo declara a coluna que alimenta. Onde a coluna tem `check`, o
// gate exige que o limite da tela não aceite nada que o Postgres recuse —
// é a frouxidão que produz o erro opaco no meio da gravação, que é o que
// esta porta existe para evitar.
//
// Ser MAIS estrita é legítimo e acontece de propósito: `maq_uso_registros.
// delta` aceita zero no banco (a migração 58 registra por quê: "nenhum uso
// desde a última leitura" é plausível), e a tela continua exigindo maior
// que zero, porque registrar uso de zero hora é digitação sem conteúdo.
//
// Isso é deliberadamente diferente de `PLANILHA_FAIXAS` (/refrigeracao),
// onde o gate exige igualdade nas DUAS direções: lá existe o ciclo fechado
// de exportar e reimportar (D-5hy-04), e um valor que o banco aceita tem de
// sobreviver à volta. Aqui não há ida e volta, então basta o contido.
//
// Núcleo puro (`normalizarDecimal`, `validarNumero`, `NUM_CAMPOS`) sem
// nenhuma API de navegador, testável em Node — a mesma divisão de
// `shared/tema.js`, `mapa/mapa-geometria.js` e `maquinas/estoque-tabela.js`.
// ══════════════════════════════════════════════════════════════════

// Tetos generosos de propósito, pela lição já registrada nas migrações 57 e
// 58: existem para pegar dígito repetido e colagem errada, não para modelar
// o CMASM. Teto apertado que recusa dado legítimo é pior que teto nenhum.
//
// `exclusivo: true` espelha `> 0` do banco; sem ele o mínimo é inclusivo,
// espelhando `>= 0`. É explícito em vez do 0.0001 que `PLANILHA_MINIMOS`
// usou como aproximação de "maior que zero" — aquilo funcionava e não dizia
// o que queria dizer.
export const NUM_CAMPOS = {
  // ── estoque de materiais ──
  'ed-atual':    { rotulo:'Estoque atual',   coluna:'maq_materiais.estoque_atual',    min:0, max:1000000 },
  'ed-minimo':   { rotulo:'Estoque mínimo',  coluna:'maq_materiais.estoque_minimo',   min:0, max:1000000 },
  'ed-preco':    { rotulo:'Preço',           coluna:'maq_materiais.preco',            min:0, max:10000000 },
  'mat-min':     { rotulo:'Estoque mínimo',  coluna:'maq_materiais.estoque_minimo',   min:0, max:1000000 },
  'mov-qtd':     { rotulo:'Quantidade',      coluna:'maq_estoque_movimentos.quantidade', min:0, exclusivo:true, max:1000000 },

  // ── uso e horímetro ──
  // A tela exige > 0 onde o banco aceita >= 0; ver o cabeçalho.
  'uso-delta':   { rotulo:'Uso no período',  coluna:'maq_uso_registros.delta',        min:0, exclusivo:true, max:100000 },
  'os-delta':    { rotulo:'Uso no período',  coluna:'maq_os.uso_na_os',               min:0, max:100000 },
  'at-uso':      { rotulo:'Uso atual',       coluna:'maq_ativos.uso_atual',           min:0, max:1000000 },

  // ── compras ──
  'nec-qtd':     { rotulo:'Quantidade',      coluna:'maq_compras_itens.quantidade',   min:0, exclusivo:true, max:1000000 },
  'recebimento': { rotulo:'Quantidade recebida', coluna:'maq_compras_itens.qtd_recebida', min:0, exclusivo:true, max:1000000 },

  // ── itens da OS (campos criados em JS, sem id — lidos por chave) ──
  'osd-peca-qtd':     { rotulo:'Quantidade',       coluna:'maq_os_materiais.quantidade', min:0, exclusivo:true, max:1000000 },
  'osd-peca-preco':   { rotulo:'Preço unitário',   coluna:'maq_os_materiais.preco_unit', min:0, max:10000000 },
  'osd-servico-horas':{ rotulo:'Horas',            coluna:'maq_os_servicos.horas',       min:0, exclusivo:true, max:10000 },
  'osd-servico-valor':{ rotulo:'Valor da hora',    coluna:'maq_os_servicos.valor_hora',  min:0, max:100000 },

  // ── catálogo de serviços (/reparos, migração 26) ──
  'sv-tempo':    { rotulo:'Tempo padrão',    coluna:'rep_servicos.tempo_padrao_h',    min:0, exclusivo:true, max:10000 },
  'sv-valor':    { rotulo:'Valor da hora',   coluna:'rep_servicos.valor_hora',        min:0, max:100000 },

  // ── abastecimento ──
  // `maq_abastecimentos` NÃO tem check nenhum: a tabela estava vazia na
  // triagem da migração 58 e ficou de fora. Aqui a tela é a única barreira
  // que existe — e é justamente o campo onde a vírgula descartada vira
  // dez vezes o combustível.
  'ab-litros':   { rotulo:'Litros',          coluna:'maq_abastecimentos.litros',      min:0, exclusivo:true, max:10000 },
  'ab-preco':    { rotulo:'Preço por litro', coluna:'maq_abastecimentos.preco_litro', min:0, max:1000 },
  'ab-horim':    { rotulo:'Horímetro',       coluna:'maq_abastecimentos.horimetro',   min:0, max:1000000 },

  // ── áreas e operações de corte ──
  'area-m2':            { rotulo:'Dimensão',      coluna:'maq_areas.area_m2',             min:0, exclusivo:true, max:10000000 },
  'area-periodicidade': { rotulo:'Periodicidade', coluna:'maq_areas.periodicidade_dias',  min:0, exclusivo:true, max:3650, inteiro:true },
  'concluir-horas':     { rotulo:'Horas',         coluna:'maq_operacoes.horas_utilizadas', min:0, exclusivo:true, max:10000 },
  'concluir-area':      { rotulo:'Área executada', coluna:'maq_operacoes.area_executada_m2', min:0, max:10000000 },
  'concluir-combustivel':{ rotulo:'Combustível',  coluna:'maq_operacoes.combustivel_utilizado', min:0, max:10000 },

  // ── contratação e configuração ──
  'ct-valor':       { rotulo:'Valor estimado',    coluna:'maq_contratacoes.valor_estimado', min:0, max:100000000 },
  'cfg-valor-hora': { rotulo:'Valor da hora-homem', coluna:'maq_config.valor_hora_padrao',  min:0, max:100000 },
}

// ── núcleo puro ────────────────────────────────────────────────────

/**
 * Normaliza o separador decimal de um texto livre.
 *
 * Existe para o caminho que NÃO passa por `type="number"` — hoje o
 * `prompt()` do recebimento de item, que devolve o texto como digitado, com
 * a vírgula intacta. Ali `parseFloat('12,5')` trunca para 12, em silêncio.
 *
 * A regra de ambiguidade é a mesma de `celulaParaValor` em /refrigeracao
 * (migração 56): ponto separando exatamente três casas pode ser milhar ou
 * decimal, e adivinhar é o que transforma mil e duzentos em um vírgula dois.
 * Uma regra, dois pontos de entrada — não duas regras parecidas.
 *
 * @param {string} texto
 * @returns {{ok: true, texto: string}|{ok: false, erro: string}}
 */
export function normalizarDecimal(texto) {
  const t = String(texto == null ? '' : texto).trim()
  if (t === '') return { ok: true, texto: '' }

  const virgulas = (t.match(/,/g) || []).length
  const pontos = (t.match(/\./g) || []).length

  if (virgulas > 1) return { ok: false, erro: 'tem mais de uma vírgula' }
  if (virgulas === 1 && pontos > 0) {
    // "1.234,56" — forma brasileira completa: o ponto é milhar.
    return { ok: true, texto: t.replace(/\./g, '').replace(',', '.') }
  }
  if (virgulas === 1) return { ok: true, texto: t.replace(',', '.') }
  if (pontos > 1) return { ok: false, erro: 'tem mais de um ponto' }
  if (pontos === 1 && /^-?\d{1,3}\.\d{3}$/.test(t)) {
    return { ok: false, erro: 'é ambíguo — ponto separando três casas pode ser milhar ou decimal; escreva sem separador de milhar' }
  }
  return { ok: true, texto: t }
}

/**
 * Valida um texto contra a especificação de um campo.
 *
 * Devolve três respostas distintas onde o `|| 0` de antes devolvia uma só:
 * vazio (`valor: null`), número válido, e recusa com motivo escrito. Colapsar
 * "não preenchido" e "escrevi bobagem" em zero é o que fazia um cadastro
 * incompleto virar uma afirmação numérica.
 *
 * @param {string} texto
 * @param {{rotulo:string, min?:number, max?:number, exclusivo?:boolean, inteiro?:boolean, obrigatorio?:boolean}} spec
 * @returns {{ok: true, valor: number|null}|{ok: false, erro: string}}
 */
export function validarNumero(texto, spec) {
  const s = spec || {}
  const nome = s.rotulo || 'Valor'

  const norm = normalizarDecimal(texto)
  if (!norm.ok) return { ok: false, erro: `${nome}: "${String(texto).trim()}" ${norm.erro}` }

  if (norm.texto === '') {
    if (s.obrigatorio) return { ok: false, erro: `${nome}: preencha este campo` }
    return { ok: true, valor: null }
  }

  // Number() e não parseFloat(): parseFloat('12abc') devolve 12 e engole o
  // resto, que é exatamente o tipo de leitura silenciosa que esta porta
  // existe para acabar. Number('12abc') é NaN e vira mensagem.
  const valor = Number(norm.texto)
  if (!Number.isFinite(valor)) return { ok: false, erro: `${nome}: "${norm.texto}" não é um número` }

  if (s.inteiro && !Number.isInteger(valor)) return { ok: false, erro: `${nome}: precisa ser um número inteiro` }

  if (s.min != null) {
    if (s.exclusivo && !(valor > s.min)) return { ok: false, erro: `${nome}: precisa ser maior que ${s.min}` }
    if (!s.exclusivo && valor < s.min) return { ok: false, erro: `${nome}: não pode ser menor que ${s.min}` }
  }
  if (s.max != null && valor > s.max) {
    return { ok: false, erro: `${nome}: ${valor} está acima do limite de ${s.max} — confira se não sobrou um dígito` }
  }
  return { ok: true, valor }
}

/**
 * Escreve um número num campo, na forma que este leitor lê de volta.
 *
 * É a metade que faltava, e o gate a exige: sem ela o aplicativo preenche o
 * campo com um texto que ele próprio recusa. `Number(5.392)` vira "5.392",
 * que a regra de ambiguidade barra — e 5,392 m² é área geodésica plausível,
 * escrita em `maq_areas.area_m2` pelo /mapa. Hoje não existe nenhum valor
 * assim nas oito colunas (conferido no banco), mas "hoje não existe" é
 * justamente o raciocínio que esta base já pagou caro para não repetir.
 *
 * Grava com VÍRGULA, que é como se escreve decimal em português e o que a
 * pessoa vai reencontrar ao editar. O ponto de milhar nunca aparece: seria
 * reintroduzir a ambiguidade do outro lado.
 */
export function paraCampo(valor) {
  if (valor == null || valor === '') return ''
  const n = Number(valor)
  if (!Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

// ── borda de DOM ───────────────────────────────────────────────────

/**
 * Lê um campo do formulário pelo id.
 *
 * `chave` existe para os campos cujo id carrega o id da linha
 * (`nec-qtd-42`): a especificação é a da coluna, não a da linha. Explícito
 * de propósito — deduzir a chave apagando o sufixo numérico do id seria
 * mágica que quebra no primeiro id com número no meio.
 */
export function lerNumero(id, chave) {
  const spec = NUM_CAMPOS[chave || id]
  if (!spec) return { ok: false, erro: `Campo ${chave || id} não está em NUM_CAMPOS` }
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null
  if (!el) return { ok: false, erro: `${spec.rotulo}: campo não encontrado na tela` }
  return validarNumero(el.value, spec)
}

/** Mesmo contrato, para os campos criados em JS que não têm id. */
export function lerNumeroTexto(texto, chave) {
  const spec = NUM_CAMPOS[chave]
  if (!spec) return { ok: false, erro: `Campo ${chave} não está em NUM_CAMPOS` }
  return validarNumero(texto, spec)
}
