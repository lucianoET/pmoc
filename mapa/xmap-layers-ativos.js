// ══════════════════════════════════════════════════════════════════
// xMap Layers — camada genérica de ativos (transportes, fonoclama,
// refrigeração).
//
// (1) Por que UM arquivo e não três: xmap-layers-grama.js e
// xmap-layers-eletrica.js são portes do app legado cmms-mapa e carregam
// desenho próprio (ícone de máquina, de gerador, de quadro) que existia
// lá. As três famílias que entram agora não têm porte nenhum para herdar —
// copiar qualquer um dos dois arquivos três vezes produziria três cópias
// da mesma lógica de carga, posicionamento e balão, divergindo na primeira
// correção que alguém esquecesse de replicar. O que varia entre elas é
// dado (tabela, colunas, rótulo, emoji), e dado mora em configuração:
// CONFIG_POR_MODULO em mapa/mapa-dados.js.
//
// (2) UMA camada por módulo, não uma por subtipo. A elétrica registra
// quatro camadas porque tem quatro tipos fechados, escritos na migração.
// Aqui os subtipos são texto livre de banco antigo (equipamentos.tipo) ou
// vocabulário que ainda cresce — gerar chave de camada a partir de texto
// de banco produziria painel de filtro instável, com camada nascendo e
// sumindo conforme o cadastro. O subtipo aparece no balão; o filtro é por
// módulo.
//
// (3) Nenhuma consulta aqui: tudo vem de mapa/mapa-dados.js, porta única
// do módulo (gate tests/mapa-camadas.test.js).
// ══════════════════════════════════════════════════════════════════

import { carregarAtivosDoModulo, carregarLocaisComPosicao, posicionarAtivos } from './mapa-dados.js'
import { linkDoModulo, corDoEstado, rotuloDoEstado, classeDoEstado } from './mapa-geometria.js'

// Só apresentação — rótulo de camada e emoji do marcador. O nome de
// tabela e as colunas ficam em CONFIG_POR_MODULO (mapa-dados.js); aqui não
// se repete nada disso, para não haver duas listas de módulos para manter.
const APRESENTACAO = {
  transportes: { nome: 'Transportes', emoji: '🚚' },
  fonoclama: { nome: 'Fonoclama', emoji: '📢' },
  refrigeracao: { nome: 'Refrigeração', emoji: '❄' },
}

function ativoSVG(emoji, estado) {
  const c = corDoEstado(estado)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    <rect x="2" y="2" width="22" height="22" rx="5" fill="rgba(7,17,31,.92)" stroke="${c}" stroke-width="1.5"/>
    <text x="13" y="17" text-anchor="middle" font-size="12" fill="${c}">${emoji}</text>
  </svg>`
}

function renderAtivos(group, ativos, modulo) {
  const info = APRESENTACAO[modulo]
  ativos.forEach((a) => {
    const icon = L.divIcon({
      html: ativoSVG(info.emoji, a.estado),
      className: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -13],
    })
    const marker = L.marker([a.lat, a.lon], { icon })

    const rows = [['Estado', rotuloDoEstado(a.estado), classeDoEstado(a.estado)]]
    if (a.detalhe) rows.push(['Identificação', a.detalhe])
    // Horímetro/odômetro não existe em equipamentos (refrigeração) — a
    // linha só entra quando a coluna veio, em vez de mostrar "0 h" para
    // uma tabela que nunca mediu uso.
    if (a.uso_atual != null) rows.push(['Uso', `${a.uso_atual} ${a.unidade_uso || 'h'}`])
    rows.push(['Posição', a.origemPosicao === 'propria' ? 'Própria' : 'Herdada do local', 'info'])

    // O destino nunca é concatenado — sai só de linkDoModulo, que valida
    // módulo por lista fechada e identificador por forma (T-10-22).
    // `refrigeracao` não está em MODULOS: a função devolve null e a linha
    // simplesmente não aparece, sem caso especial aqui.
    const link = linkDoModulo(modulo, a.id)
    if (link) rows.push(['Módulo', `<a href="${link}" class="xmap-popup-link">Abrir na ficha →</a>`, 'info'])

    marker.bindPopup(xMap.utils.popupHTML(info.emoji, a.rotulo, a.subtipo || info.nome, rows), { maxWidth: 220 })
    group.addLayer(marker)
  })
}

// Registro de UM módulo. mapa/app.js chama uma vez por módulo, dentro do
// mesmo Promise.all das outras camadas — falha de um não derruba os
// outros, cada leitura já mostra o próprio erro (mostrarErroDeCarga).
export async function registrarCamadaDeAtivos(modulo) {
  if (!APRESENTACAO[modulo]) {
    throw new Error(`xmap-layers-ativos: módulo "${modulo}" não tem apresentação declarada.`)
  }
  const [brutos, locais] = await Promise.all([carregarAtivosDoModulo(modulo), carregarLocaisComPosicao()])
  const posicionados = posicionarAtivos(brutos, locais, modulo)
  xMap.registerLayer(modulo, {
    ativos: {
      label: APRESENTACAO[modulo].nome,
      color: corDoEstado('operante'),
      render(group) {
        renderAtivos(group, posicionados, modulo)
      },
    },
  })
}
