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

  const linkPortal = portalLink ? '<a class="topbar-back" href="/">← Portal</a>' : ''

  const topbar = `
    <div class="topbar">
      <div class="logo"><div class="logo-dot"></div> PMOC <span class="logo-accent">${esc(nome)}</span></div>
      <div class="topbar-right">
        ${linkPortal}
        <span class="user-chip" id="user-chip">—</span>
        <button class="btn btn-s btn-sm" onclick="sair()">Sair</button>
      </div>
    </div>`

  // faixa de abas só existe quando o módulo tem navItems — mapa navega por
  // camadas na sidebar, não por abas, e não deve ganhar uma faixa vazia
  const nav = navItems.length
    ? `
    <div class="nav">
      ${navItems.map(item => {
        const id = esc(item.id)
        const icone = esc(item.icone)
        const label = esc(item.label)
        const ativa = item.ativo ? ' active' : ''
        return `<button class="nav-btn${ativa}" data-view="${id}" onclick="trocarView('${id}',this)">${icone} ${label}</button>`
      }).join('')}
    </div>`
    : ''

  const topo = topbar + nav

  // rodapé mínimo (D-03): nome do módulo, versão quando informada, link ao portal
  const versaoSpan = versao ? `<span>v${esc(versao)}</span>` : ''
  const rodape = `<footer class="shell-footer"><span>PMOC · CMASM — ${esc(nome)}</span>${versaoSpan}<a href="/">← Portal</a></footer>`

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

  return raiz
}
