// ══════════════════════════════════════════════════════════════════
// shared/icones.js — conjunto único de ícones dos módulos.
//
// (1) Por que existe: os ícones do chrome eram caracteres — ☰, ▤, ☀, 📊,
// 🔧 — e caractere depende da fonte que o sistema tem. No mapa, o `☰`
// (U+2630) apareceu como bloco preto na máquina do usuário; emoji de aba
// muda de desenho e de cor em cada sistema operacional, o que impede
// qualquer padronização. SVG desenha igual em todo lugar.
//
// (2) Monocromático de propósito: todo traço usa `currentColor`, então o
// ícone herda a cor do texto ao redor e responde a estado (ativo, hover,
// desabilitado) sem uma segunda regra. Emoji não faz isso — ele traz a
// própria paleta e briga com o tema.
//
// (3) Traço, não preenchimento (família Material Symbols Outlined,
// 24×24, stroke 2): num chrome onde o destaque é a cor de acento, ícone
// sólido pesa mais que o texto que ele acompanha.
//
// (4) Núcleo puro: nenhuma API de navegador aqui, só texto. Quem injeta
// no DOM é o shell (shared/shell.js) e cada módulo.
// ══════════════════════════════════════════════════════════════════

// Cada entrada é só o MIOLO do <svg>; o invólucro é montado por icone()
// abaixo, para que tamanho, viewBox e atributos de acessibilidade tenham
// uma definição só.
const TRACOS = {
  // ── chrome ──
  portal: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  sair: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  claro: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  escuro: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  empresa: '<path d="M12 2.6 20 7v10l-8 4.4L4 17V7z"/><path d="M12 9.2 16 11.4v4.4L12 18l-4-2.2v-4.4z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  camadas: '<path d="M12 3 3 7.5 12 12l9-4.5z"/><path d="M3 12.5 12 17l9-4.5"/><path d="M3 17 12 21.5 21 17"/>',

  // ── abas dos módulos ──
  painel: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',
  maquina: '<path d="M14.7 6.3a4 4 0 0 1-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5z"/><path d="m15 9 3-3-2-2 3-1 2 2-1 3z"/>',
  os: '<path d="M9 3h6v3H9z"/><path d="M15 4.5h3a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1h3"/><path d="M9 11h6M9 15h4"/>',
  corte: '<path d="M6 20V9M10 20V6M14 20v-8M18 20V4"/><path d="M3 20h18"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  estoque: '<path d="M3 8.5 12 4l9 4.5V17l-9 4.5L3 17z"/><path d="M3 8.5 12 13l9-4.5M12 13v8.5"/>',
  consumo: '<path d="M4 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15"/><path d="M3 20h11"/><path d="M13 10h3.5a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  ciclo: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 4-5 3 3 5-7"/>',
  compras: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.5l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L21 8H6"/>',
  mapa: '<path d="m9 4-6 2.5v14L9 18l6 2.5 6-2.5v-14L15 6.5z"/><path d="M9 4v14M15 6.5v14"/>',

  // ── abas dos demais módulos (migração de 19/08/2026) ──
  prazo: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  plano: '<path d="M4 5h4M4 12h4M4 19h4"/><path d="M11 5h9M11 12h9M11 19h9"/>',
  chave: '<path d="M14.7 6.3a4 4 0 1 0 3 3l-1.4-1.4a2 2 0 1 1-.2-2.8z"/><path d="m13.3 9.3-8.6 8.6a1.5 1.5 0 0 0 2.1 2.1l8.6-8.6"/>',
  rota: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H14a3.5 3.5 0 0 1 0 7h-4a3.5 3.5 0 0 0 0 7h5.5"/>',
  relatorio: '<path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  predio: '<path d="M4 21V6l7-3 7 3v15"/><path d="M2 21h20M9 21v-5h5v5"/><path d="M8 9h.01M12 9h.01M8 12.5h.01M12 12.5h.01"/>',
  checklist: '<path d="m4 7 2 2 3-3M4 16l2 2 3-3"/><path d="M12 8h8M12 17h8"/>',
  modelo: '<path d="M4 8h6l1.5 2H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5l1 2"/>',
  veiculo: '<path d="M3 16V7a1 1 0 0 1 1-1h9v10"/><path d="M13 9h4l3 3.5V16"/><path d="M3 16h2M9 16h4M17 16h4"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="15" cy="17.5" r="1.6"/>',
  eletrico: '<path d="M13 2 5 13h5l-1 9 8-11h-5z"/>',
  som: '<path d="M4 9h3l6-4v14l-6-4H4z"/><path d="M17 8.5a5 5 0 0 1 0 7"/>',
}

export const NOMES_DE_ICONE = Object.keys(TRACOS)

export function existeIcone(nome) {
  return Object.prototype.hasOwnProperty.call(TRACOS, nome)
}

/**
 * Devolve o `<svg>` de um ícone, ou string vazia quando o nome não existe —
 * nunca lança. Um ícone faltando é um desenho a menos; uma exceção aqui
 * derrubaria a montagem inteira do cabeçalho.
 *
 * @param {string} nome   chave de TRACOS
 * @param {object} [opcoes]
 *   - classe: string     classe CSS do <svg> (padrão 'ico')
 *   - tamanho: number    lado em px (padrão 18)
 */
export function icone(nome, opcoes = {}) {
  if (!existeIcone(nome)) return ''
  const classe = opcoes.classe || 'ico'
  const tamanho = opcoes.tamanho || 18
  // aria-hidden + focusable="false": o ícone acompanha um rótulo de texto
  // ou um aria-label do próprio botão — anunciá-lo de novo seria ruído.
  return `<svg class="${classe}" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${TRACOS[nome]}</svg>`
}
