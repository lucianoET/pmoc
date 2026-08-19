// ══════════════════════════════════════════════════════════════════
// Tema claro/escuro do PMOC — implementação única para as 7 superfícies
// do projeto (os 6 módulos que chamam aplicarShell() e, a partir do
// plano 06-03, o portal).
//
// O tema escuro é o padrão de :root em shared/pmoc.css; o tema claro
// vem do bloco [data-theme="claro"] acrescentado no plano 06-01.
//
// Núcleo puro (normalizarTema, proximoTema) — sem document/window/
// localStorage/matchMedia — separado dos aplicadores de navegador
// (detectarTema, temaAtual, aplicarTema, alternarTema, iniciarTema),
// mesma divisão que shared/shell.js já usa entre montarShell/aplicarShell.
//
// Restrição estrutural: nada roda no escopo de topo além de declarar
// constantes e funções. shared/shell.js importa este arquivo e
// tests/shell.test.js importa shared/shell.js dentro do Node — qualquer
// acesso a API de navegador no momento do import quebraria os testes
// de shell que hoje passam.
// ══════════════════════════════════════════════════════════════════

// chave de localStorage (D-03: com hífen, não sublinhado) — exportada
// porque o teste de superfícies do plano 06-03 compara este texto com
// o que está escrito no <head> das 7 páginas
import { icone } from './icones.js'

export const CHAVE_TEMA = 'pmoc-tema'

// lista fechada dos únicos dois temas válidos (D-03: português)
export const TEMAS = ['claro', 'escuro']

// cor da meta tag de cor de barra do navegador por tema — interna, não
// exportada; escuro repete o valor hoje hardcoded nas 7 páginas, claro
// usa o --bg do bloco [data-theme="claro"] fixado no plano 06-01
const CORES_BARRA = { escuro: '#1a1a18', claro: '#f4f2ec' }

// ── núcleo puro — sem document/window/localStorage/matchMedia ──────────────

// normalizarTema — o filtro de segurança do arquivo. O valor vem de
// localStorage, que é gravável por extensão de navegador, pelo console
// do usuário ou por uma versão futura do próprio código: tratamos como
// não confiável e só aceitamos comparação estrita contra a lista
// fechada, sem trim, sem conversão de caixa, sem conversão para texto
// (ASVS V5).
export function normalizarTema(valor) {
  return TEMAS.includes(valor) ? valor : null
}

// proximoTema — devolve o outro tema. Dado 'claro' devolve 'escuro';
// para qualquer outra coisa, inclusive um valor corrompido, devolve
// 'claro' — a queda é deliberada: a função só é chamada com o tema
// atualmente aplicado na página, e se esse valor estiver corrompido
// a alternância mais útil ao usuário é ir para o tema que ele ainda
// não tem.
export function proximoTema(atual) {
  return atual === 'claro' ? 'escuro' : 'claro'
}

// ── aplicadores de navegador ────────────────────────────────────────────

// detectarTema — lê a preferência salva, sem escrever nada. Armazenamento
// pode estar bloqueado por política do navegador (modo privado, cookies
// de terceiros bloqueados), e nesse caso o acesso lança em vez de devolver
// nulo — por isso o try/catch.
export function detectarTema() {
  let salvo = null
  try {
    salvo = normalizarTema(localStorage.getItem(CHAVE_TEMA))
  } catch {
    salvo = null
  }
  if (salvo) return salvo

  // sem preferência salva (ou armazenamento bloqueado): segue o sistema,
  // só se matchMedia existir — navegador antigo sem essa API não pode
  // derrubar a página. Escuro é o padrão histórico do projeto e continua
  // sendo o padrão quando não há informação.
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches) {
    return 'claro'
  }
  return 'escuro'
}

// temaAtual — o tema em vigor no documento agora, lendo data-theme do
// elemento raiz, com queda para escuro se o atributo estiver ausente ou
// inválido.
export function temaAtual() {
  return normalizarTema(document.documentElement.getAttribute('data-theme')) || 'escuro'
}

// aplicarTema — o único ponto que escreve no documento. Os três alvos
// (atributo, meta tag, botão) são opcionais de propósito: precisa
// funcionar no portal, onde a meta tag existe mas o botão pode ainda
// não ter sido montado, e em qualquer página futura que não tenha um
// dos dois.
export function aplicarTema(tema) {
  const temaValido = normalizarTema(tema) || 'escuro'

  document.documentElement.setAttribute('data-theme', temaValido)

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', CORES_BARRA[temaValido])

  const botao = document.getElementById('btn-tema')
  if (botao) {
    const vaiParaClaro = temaValido === 'escuro'
    const rotulo = vaiParaClaro ? 'Ir para o tema claro' : 'Ir para o tema escuro'
    // Ícone do conjunto comum, não caractere: `☀`/`🌙` dependiam da fonte do
    // sistema e traziam a própria cor — o emoji não obedecia ao tema que o
    // botão serve para trocar. innerHTML com texto de icone(), que é
    // constante do projeto e não recebe entrada nenhuma.
    botao.innerHTML = icone(vaiParaClaro ? 'claro' : 'escuro')
    botao.title = rotulo
    botao.setAttribute('aria-label', rotulo)
  }

  return temaValido
}

// alternarTema — a função que o botão chama. Não recarrega a página,
// não redesenha nenhuma view, não dispara nenhum evento: trocar um
// atributo do elemento raiz basta, porque todo o visual sai de
// variáveis CSS.
export function alternarTema() {
  const proximo = proximoTema(temaAtual())
  try {
    localStorage.setItem(CHAVE_TEMA, proximo)
  } catch {
    // armazenamento bloqueado não pode impedir a troca dentro da sessão
  }
  return aplicarTema(proximo)
}

// iniciarTema — chamada uma vez no boot de cada superfície. Expõe
// alternarTema no escopo global sob o mesmo nome, para que o
// manipulador embutido do botão funcione — o mesmo padrão que
// onclick="sair()" já usa hoje na barra superior. Idempotente por
// construção: só reescreve o mesmo atributo e a mesma referência
// global, então tolera ser chamada mais de uma vez sem efeito colateral.
//
// Não registra nenhuma escuta de mudança de prefers-color-scheme em
// tempo de execução: a preferência do sistema serve só como valor
// inicial quando não há escolha salva; depois que o usuário clicou no
// botão, a escolha dele prevalece, e uma escuta ativa a sobrescreveria.
export function iniciarTema() {
  const tema = aplicarTema(detectarTema())
  window.alternarTema = alternarTema
  return tema
}
