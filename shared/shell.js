// ══════════════════════════════════════════════════════════════════
// Shell comum dos módulos do PMOC — cabeçalho, abas de navegação e
// rodapé, extraídos de shared/modulo-manutencao.js (montarLayout()) e
// generalizados para os 6 módulos.
//
// montarShell(cfg)  — função pura, sem tocar no DOM. Recebe a config
//                      do módulo e devolve { topo, rodape } em texto,
//                      testável em Node sem navegador.
// aplicarShell(cfg) — única função que toca o DOM: injeta o resultado
//                      de montarShell() no elemento raiz do módulo.
//
// Mudar este arquivo muda os 6 módulos de uma vez — é o objetivo do
// critério de sucesso 3 da Fase 5 (base unificada).
// ══════════════════════════════════════════════════════════════════

// Import deliberado (Fase 6): shared/shell.js passa a depender de um
// arquivo irmão dentro do próprio shared/, carregado pelo mesmo
// mecanismo nativo de módulos ES que os 6 módulos já usam — sem
// bundler, sem dependência externa, o projeto continua zero-build.
// Uma fase futura não deve "corrigir" esta importação de volta.
import { iniciarTema } from './tema.js'
import { icone, existeIcone } from './icones.js'

// escapa texto vindo da configuração antes de entrar em HTML — mesmo padrão de mapa/app.js
function esc(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[caractere])
}

// ── montarShell — puro, sem document/window, testável em Node ──────────────
export function montarShell(cfg) {
  const nome = cfg.nome
  const navItems = cfg.navItems || []
  const portalLink = cfg.portalLink !== false
  const versao = cfg.versao

  // Portal é BOTÃO, não link de texto, e fica imediatamente antes de Sair:
  // são as duas ações de saída do módulo e passam a ter o mesmo peso visual
  // em todos os módulos. O rótulo some por CSS em tela estreita e sobra o
  // ícone, que é o que cabe — daí o texto vir em elemento próprio.
  const botaoPortal = portalLink
    ? `<button type="button" class="btn btn-s btn-sm topbar-portal" onclick="location.href='/'" title="Voltar ao portal" aria-label="Voltar ao portal">${icone('portal')}<span class="topbar-portal-txt">Portal</span></button>`
    : ''

  // Ordem padronizada em todos os módulos e mantida em UMA linha em qualquer
  // largura: título, usuário, Portal, Sair. O tema saiu daqui para o rodapé —
  // é preferência de exibição, consultada uma vez por sessão, e disputava
  // espaço com as duas ações que o usuário de fato usa no topo. Em tela
  // estreita quem cede é o título (corta com reticências) e o rótulo do
  // Portal (fica só o ícone); um chip de cargo cortado, não.
  const topbar = `
    <div class="topbar">
      <div class="logo"><div class="logo-dot"></div> PMOC <span class="logo-accent">${esc(nome)}</span></div>
      <div class="topbar-right">
        <span class="user-chip" id="user-chip">—</span>
        ${botaoPortal}
        <button class="btn btn-s btn-sm btn-sair" onclick="sair()">Sair</button>
      </div>
    </div>`

  // faixa de abas só existe quando o módulo tem navItems — mapa navega por
  // camadas na sidebar, não por abas, e não deve ganhar uma faixa vazia
  const nav = navItems.length
    ? `
    <div class="nav">
      ${navItems.map(item => {
        const id = esc(item.id)
        const label = esc(item.label)
        const ativa = item.ativo ? ' active' : ''
        // `icone` aceita as duas formas: o NOME de um ícone do conjunto
        // comum (vira SVG monocromático, herda a cor do texto) ou um
        // caractere solto, que continua saindo escapado — os módulos que
        // ainda usam emoji seguem funcionando enquanto migram.
        const desenho = existeIcone(item.icone) ? icone(item.icone, { classe: 'ico nav-ico' }) : esc(item.icone)
        return `<button class="nav-btn${ativa}" data-view="${id}" onclick="trocarView('${id}',this)">${desenho} ${label}</button>`
      }).join('')}
    </div>`
    : ''

  const topo = topbar + nav

  // Rodapé (D-03 mais o chrome padronizado de 19/08/2026): nome do módulo,
  // versão quando informada, o alternador de tema — que saiu da barra
  // superior — e a marca da empresa. O tema mora aqui porque é escolha de
  // exibição, feita uma vez e raramente revista; o topo fica para as ações.
  const versaoSpan = versao ? `<span>v${esc(versao)}</span>` : ''
  const rodape = `<footer class="shell-footer">
      <span>PMOC · CMASM — ${esc(nome)}</span>${versaoSpan}
      <button id="btn-tema" class="btn-tema" onclick="alternarTema()" title="Ir para o tema claro" aria-label="Ir para o tema claro">${icone('claro', { classe: 'ico' })}</button>
      <a href="/">Portal</a>
      <a class="rodape-marca" href="https://luctronics.com.br" target="_blank" rel="noopener noreferrer" title="Luctronics" aria-label="Luctronics — site da empresa">${icone('empresa', { classe: 'ico' })}<span>Luctronics</span></a>
    </footer>`

  return { topo, rodape }
}

// ── aplicarShell — a única função que toca o DOM ────────────────────────────
export function aplicarShell(cfg) {
  const { topo, rodape } = montarShell(cfg)
  const alvo = cfg.alvo || 'app'

  document.title = `PMOC ${cfg.nome}`
  if (cfg.accent) document.documentElement.style.setProperty('--accent', cfg.accent)

  const raiz = document.getElementById(alvo)
  if (!raiz) throw new Error(`aplicarShell: elemento #${alvo} não encontrado`)

  // afterbegin/beforeend preservam intacto o miolo que o módulo já colocou em #app
  raiz.insertAdjacentHTML('afterbegin', topo)
  raiz.insertAdjacentHTML('beforeend', rodape)

  // por último: o botão de tema já está no documento, então iniciarTema()
  // consegue sincronizar o rótulo dele com o tema aplicado
  iniciarTema()

  return raiz
}
