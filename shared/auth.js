/**
 * auth.js — módulo de autenticação CMASM
 * Login por botões de cargo + senha. Email nunca visível ao usuário.
 * Compatível com qualquer app do ecossistema (pmoc-maquinas, fonoclama, etc.)
 *
 * Uso mínimo (HTML standalone):
 *   <div id="login"></div>
 *   <script type="module">
 *     import { Auth } from './auth.js'
 *     const auth = new Auth(supabaseClient, { appNome: 'Máquinas', appIcone: '⚙️' })
 *     auth.mount('#login')
 *     auth.onLogin(u => { document.getElementById('login').remove(); iniciarApp(u) })
 *   </script>
 *
 * Cargos padrão: podem ser sobrescritos via opts.cargos
 *   new Auth(supa, { cargos: [
 *     { label: 'Direção',  email: 'direcao@cmasm.local',  role: 'admin'      },
 *     { label: 'Técnico',  email: 'tecnico@cmasm.local',  role: 'tecnico'    },
 *     { label: 'Livre',    email: null,                   role: 'observador' },
 *   ]})
 */

export const CARGOS_PADRAO = [
  { label: 'Direção',  email: 'direcao@cmasm.local',  role: 'admin'      },
  { label: 'Gestor',   email: 'gestor@cmasm.local',   role: 'gestor'     },
  { label: 'Técnico',  email: 'tecnico@cmasm.local',  role: 'tecnico'    },
  { label: 'Livre',    email: null,                   role: 'observador' },
]

export class Auth {
  constructor(supa, opts = {}) {
    this._supa    = supa
    this._appNome = opts.appNome  || 'PMOC'
    this._appIco  = opts.appIcone || '⚙️'
    this._cargos  = opts.cargos   || CARGOS_PADRAO
    this._onLogin = null
    this._cargoSel = null   // cargo clicado atualmente
    this._usuario  = null
    this._el       = null
  }

  onLogin(fn) { this._onLogin = fn; return this }

  get usuario() { return this._usuario }

  async sair() {
    await this._supa.auth.signOut()
    this._usuario = null
  }

  // monta a tela de login no elemento seletor
  mount(seletor) {
    this._el = typeof seletor === 'string' ? document.querySelector(seletor) : seletor
    this._render()

    // checar sessão existente
    this._supa.auth.getSession().then(({ data: { session } }) => {
      if (session) this._carregarPerfil(session.user.id)
    })
    this._supa.auth.onAuthStateChange((_ev, session) => {
      if (session) this._carregarPerfil(session.user.id)
    })
    return this
  }

  // ── render ──────────────────────────────────────────────────────────────
  _render() {
    const el = this._el
    el.innerHTML = ''
    el.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'padding:20px;background:var(--bg,#1a1a18)'

    const card = document.createElement('div')
    card.style.cssText = 'background:var(--surface,#242420);border:1px solid var(--border,#38382f);' +
      'border-radius:12px;padding:36px 28px;width:100%;max-width:340px;' +
      'font-family:var(--ff,system-ui,sans-serif)'
    card.innerHTML = `
      <div style="font-size:30px;margin-bottom:10px">${this._appIco}</div>
      <div style="font-size:17px;font-weight:700;color:var(--text,#e8e4d8);margin-bottom:3px">
        PMOC ${this._appNome}
      </div>
      <div style="font-size:12px;color:var(--text3,#6a6458);margin-bottom:28px;line-height:1.5">
        CMASM · Marinha do Brasil
      </div>

      <!-- step 1: escolha de cargo -->
      <div id="step-cargo">
        <div style="font-size:12px;font-weight:600;color:var(--text2,#a09a88);
                    text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px">
          Selecione seu cargo
        </div>
        <div id="cargo-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
        <div id="admin-toggle" style="font-size:11px;color:var(--text3,#6a6458);
             text-align:center;margin-top:18px;cursor:pointer;text-decoration:underline">
          Admin — entrar com e-mail
        </div>
      </div>

      <!-- Os três campos de digitação desta tela (senha do cargo, e-mail e senha
           do admin) estão em 16px, não em 14px como o resto do texto: abaixo de
           16px o navegador do iOS aplica zoom automático ao focar o campo, e o
           usuário perde o enquadramento da tela logo no login. Mesma razão da
           regra de celular em shared/pmoc.css (Fase 7, D-05) — aqui repetida
           porque o estilo é embutido e a folha comum não o alcança. -->

      <!-- step 2: senha (após selecionar cargo) -->
      <div id="step-senha" style="display:none">
        <div id="cargo-chip"
          style="display:inline-flex;align-items:center;gap:8px;
                 background:var(--surface2,#2e2e2a);border:1px solid var(--border,#38382f);
                 border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600;
                 color:var(--text,#e8e4d8);margin-bottom:20px;cursor:pointer">
          <span id="cargo-chip-label">—</span>
          <span style="color:var(--text3,#6a6458);font-weight:400;font-size:11px">✕ trocar</span>
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:12px;font-weight:500;
                        color:var(--text2,#a09a88);margin-bottom:6px">Senha</label>
          <input id="auth-senha" type="password" placeholder="••••••••" autocomplete="current-password"
            style="width:100%;background:var(--surface2,#2e2e2a);border:1px solid var(--border,#38382f);
                   border-radius:6px;padding:9px 11px;font-size:16px;color:var(--text,#e8e4d8);
                   outline:none;font-family:inherit;box-sizing:border-box"/>
        </div>
        <div id="auth-erro" style="font-size:12px;color:var(--red,#b85c4a);
             min-height:16px;margin-bottom:10px"></div>
        <button id="btn-entrar"
          style="width:100%;background:var(--yellow,#c9a84c);color:var(--bg,#1a1a18);border:none;
                 border-radius:6px;padding:11px;font-size:14px;font-weight:700;
                 cursor:pointer;font-family:inherit">
          Entrar
        </button>
      </div>

      <!-- step 3: email (admins) -->
      <div id="step-email" style="display:none">
        <div style="margin-bottom:14px">
          <label style="display:block;font-size:12px;font-weight:500;
                        color:var(--text2,#a09a88);margin-bottom:6px">E-mail</label>
          <input id="auth-email" type="email" placeholder="admin@marinha.mil.br"
            style="width:100%;background:var(--surface2,#2e2e2a);border:1px solid var(--border,#38382f);
                   border-radius:6px;padding:9px 11px;font-size:16px;color:var(--text,#e8e4d8);
                   outline:none;font-family:inherit;box-sizing:border-box"/>
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:12px;font-weight:500;
                        color:var(--text2,#a09a88);margin-bottom:6px">Senha</label>
          <input id="auth-email-senha" type="password" placeholder="••••••••"
            style="width:100%;background:var(--surface2,#2e2e2a);border:1px solid var(--border,#38382f);
                   border-radius:6px;padding:9px 11px;font-size:16px;color:var(--text,#e8e4d8);
                   outline:none;font-family:inherit;box-sizing:border-box"/>
        </div>
        <div id="auth-email-erro" style="font-size:12px;color:var(--red,#b85c4a);
             min-height:16px;margin-bottom:10px"></div>
        <button id="btn-entrar-email"
          style="width:100%;background:var(--yellow,#c9a84c);color:var(--bg,#1a1a18);border:none;
                 border-radius:6px;padding:11px;font-size:14px;font-weight:700;
                 cursor:pointer;font-family:inherit">
          Entrar
        </button>
        <div id="voltar-cargos" style="font-size:11px;color:var(--text3,#6a6458);
             text-align:center;margin-top:14px;cursor:pointer;text-decoration:underline">
          ← Voltar
        </div>
      </div>`

    el.appendChild(card)
    this._bindEventos(card)
  }

  _bindEventos(card) {
    // renderizar botões de cargo
    const grid = card.querySelector('#cargo-grid')
    for (const cargo of this._cargos) {
      const btn = document.createElement('button')
      btn.textContent = cargo.label
      btn.style.cssText = 'background:var(--surface2,#2e2e2a);border:1px solid var(--border,#38382f);' +
        'border-radius:8px;padding:12px 8px;font-size:13px;font-weight:600;' +
        'color:var(--text,#e8e4d8);cursor:pointer;font-family:inherit;transition:.15s;width:100%'
      btn.addEventListener('mouseenter', () => btn.style.borderColor = 'var(--yellow,#c9a84c)')
      btn.addEventListener('mouseleave', () => btn.style.borderColor = 'var(--border,#38382f)')
      btn.addEventListener('click', () => this._selecionarCargo(cargo, card))
      grid.appendChild(btn)
    }

    // toggle admin
    card.querySelector('#admin-toggle').addEventListener('click', () => {
      card.querySelector('#step-cargo').style.display = 'none'
      card.querySelector('#step-email').style.display = 'block'
    })

    // trocar cargo (chip clicável)
    card.querySelector('#cargo-chip').addEventListener('click', () => {
      card.querySelector('#step-senha').style.display = 'none'
      card.querySelector('#step-cargo').style.display = 'block'
      this._cargoSel = null
    })

    // entrar com senha
    card.querySelector('#btn-entrar').addEventListener('click', () => this._loginCargo(card))
    card.querySelector('#auth-senha').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._loginCargo(card)
    })

    // entrar com email
    card.querySelector('#btn-entrar-email').addEventListener('click', () => this._loginEmail(card))
    card.querySelector('#auth-email-senha').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._loginEmail(card)
    })

    // voltar
    card.querySelector('#voltar-cargos').addEventListener('click', () => {
      card.querySelector('#step-email').style.display = 'none'
      card.querySelector('#step-cargo').style.display = 'block'
    })
  }

  _selecionarCargo(cargo, card) {
    // "Livre" → acesso observador sem senha
    if (!cargo.email) {
      this._usuario = { role: 'observador', nome: 'Visitante', cargo: cargo.label, funcao: cargo.label }
      if (this._onLogin) this._onLogin(this._usuario)
      this._el.style.display = 'none'
      return
    }
    this._cargoSel = cargo
    card.querySelector('#cargo-chip-label').textContent = cargo.label
    card.querySelector('#step-cargo').style.display = 'none'
    card.querySelector('#step-senha').style.display = 'block'
    card.querySelector('#auth-senha').value = ''
    card.querySelector('#auth-erro').textContent = ''
    setTimeout(() => card.querySelector('#auth-senha').focus(), 50)
  }

  async _loginCargo(card) {
    if (!this._cargoSel) return
    const senha = card.querySelector('#auth-senha').value
    const erroEl = card.querySelector('#auth-erro')
    erroEl.textContent = ''
    if (!senha) { erroEl.textContent = 'Digite a senha.'; return }

    const btn = card.querySelector('#btn-entrar')
    btn.textContent = 'Entrando...'; btn.disabled = true

    const { error } = await this._supa.auth.signInWithPassword({
      email: this._cargoSel.email,
      password: senha
    })

    btn.textContent = 'Entrar'; btn.disabled = false
    if (error) erroEl.textContent = 'Senha incorreta.'
  }

  async _loginEmail(card) {
    const email = card.querySelector('#auth-email').value.trim()
    const senha = card.querySelector('#auth-email-senha').value
    const erroEl = card.querySelector('#auth-email-erro')
    erroEl.textContent = ''
    if (!email || !senha) { erroEl.textContent = 'Preencha e-mail e senha.'; return }

    const btn = card.querySelector('#btn-entrar-email')
    btn.textContent = 'Entrando...'; btn.disabled = true

    const { error } = await this._supa.auth.signInWithPassword({ email, password: senha })

    btn.textContent = 'Entrar'; btn.disabled = false
    if (error) erroEl.textContent = 'E-mail ou senha incorretos.'
  }

  async _carregarPerfil(uid) {
    const { data } = await this._supa
      .from('usuarios').select('*').eq('auth_id', uid).single()
    this._usuario = data
    if (this._onLogin && data) this._onLogin(data)
    if (this._el) this._el.style.display = 'none'
  }
}

/**
 * cadastrarCargo — helper para criar usuário de cargo no Supabase
 * Executar UMA VEZ pelo admin via console ou painel futuro.
 *
 * Exemplo:
 *   import { cadastrarCargo } from './auth.js'
 *   await cadastrarCargo(supaAdmin, 'direcao@cmasm.local', 'senha123', 'Capitão Silva', 'Direção')
 *
 * Requer supabase client com service_role key (não anon).
 * Em produção, fazer isso pelo dashboard: Auth → Users → Add user.
 */
export async function cadastrarCargo(supa, email, senha, nome, cargo, role = 'tecnico') {
  const { data, error } = await supa.auth.admin.createUser({
    email, password: senha, email_confirm: true,
    user_metadata: { nome }
  })
  if (error) throw error
  await supa.from('usuarios')
    .update({ nome, funcao: cargo, role })
    .eq('auth_id', data.user.id)
  return data.user.id
}
