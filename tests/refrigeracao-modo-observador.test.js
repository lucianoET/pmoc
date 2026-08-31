// Gate comportamental do modo observador de /refrigeracao — 260822-48m.
//
// Defeito: `window._modoObservador` tem nove pontos de leitura, um único
// ponto de escrita e nenhum que o devolva a `false`. Quem clica em
// "Visualizar sem login" e depois entra como Gestor na mesma aba continua
// travado em somente-leitura até um F5 — e o caminho inverso (Gestor → Sair
// → observador → Técnico) esconde uma escalada de privilégio: `initAppOnce()`
// retorna pela guarda `_appInited` e `ctUser` nunca é recarregado.
//
// Roda o código real de refrigeracao/index.html num sandbox node:vm, em três
// recortes no MESMO contexto (D-48m-08 define onde a seção nova entra):
//
//   A — "ponte de campos de equipamentos" -> "ponte de campos de logs_manutencao"
//       (mesmo recorte de tests/refrigeracao-ficha-equipamento.test.js), com
//       podeEditarCadastro()/podeDarBaixa().
//   B — de logo depois de `ALVO_FICHA = lerAlvoFicha(location.search);` até
//       `var _appInited = false;` — hoje só acessoLivre(); depois da Tarefa 2
//       também a seção nova (somenteLeitura/sincronizarSessao), inserida
//       imediatamente ANTES do cabeçalho "ACESSO LIVRE" (D-48m-08).
//   C — de "// Auth state — aguarda DOM antes de manipular elementos" até o
//       "\n</script>" seguinte — o único onAuthStateChange que trata sessão.
//
// Task 1 (D-48m-09): este arquivo nasce e é visto VERMELHO contra o código de
// hoje. Só a Tarefa 2 conserta. Um gate nunca visto vermelho não prova nada.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');

// Cabeçalho da seção nova que a Tarefa 2 insere imediatamente antes de
// "/* ── ACESSO LIVRE (modo observador, somente leitura) ── */" (D-48m-08).
// Antes da Tarefa 2 este texto não existe no arquivo — as duas asserções
// estruturais (D-48m-01) que dependem dele falham hoje de propósito.
const MARCADOR_SECAO_NOVA = '/* ── sessão e modo observador: leitura única, porta única ── */';
const MARCADOR_ACESSO_LIVRE = '/* ── ACESSO LIVRE (modo observador, somente leitura) ── */';

// ── recortes ──────────────────────────────────────────────────────────────

function recorteA() {
  const ini = HTML.indexOf('/* ── ponte de campos de equipamentos ── */');
  const fim = HTML.indexOf('/* ── ponte de campos de logs_manutencao ── */', ini);
  assert.ok(ini > 0 && fim > ini, 'recorte A (ponte de campos de equipamentos) não encontrado');
  return HTML.slice(ini, fim);
}

function recorteB() {
  const marcadorIni = 'ALVO_FICHA = lerAlvoFicha(location.search);';
  const iniMarcador = HTML.indexOf(marcadorIni);
  assert.ok(iniMarcador > 0, 'marcador de início do recorte B não encontrado');
  const ini = iniMarcador + marcadorIni.length;
  const fim = HTML.indexOf('var _appInited = false;', ini);
  assert.ok(fim > ini, 'marcador de fim do recorte B ("var _appInited = false;") não encontrado');
  return HTML.slice(ini, fim);
}

function recorteC() {
  const marcador = '// Auth state — aguarda DOM antes de manipular elementos';
  const ini = HTML.indexOf(marcador);
  assert.ok(ini > 0, 'recorte C (listener de sessão) não encontrado');
  const fim = HTML.indexOf('\n</script>', ini);
  assert.ok(fim > ini, 'fim do recorte C ("\\n</script>") não encontrado');
  return HTML.slice(ini, fim);
}

// ── DOM e Supabase falsos ────────────────────────────────────────────────

function criarDomFalso() {
  const elementos = [];
  const domReadyHandlers = [];

  function criarElemento(id) {
    const elNovo = {
      id: id || '',
      style: {},
      innerHTML: '',
      remove() {
        const idx = elementos.indexOf(elNovo);
        if (idx >= 0) elementos.splice(idx, 1);
      },
    };
    return elNovo;
  }

  // Pré-popula os elementos que acessoLivre()/o listener esperam encontrar
  // já no DOM (o app real já os tem no <body> antes de qualquer script rodar).
  elementos.push(criarElemento('login-mobile'));
  elementos.push(criarElemento('app'));
  elementos.push(criarElemento('fab'));

  return {
    createElement() { return criarElemento(''); },
    body: {
      prepend(el) { elementos.push(el); },
      appendChild(el) { elementos.push(el); },
    },
    getElementById(id) {
      for (const elemento of elementos) if (elemento.id === id) return elemento;
      return null;
    },
    querySelector() { return null; },
    addEventListener(tipo, cb) {
      if (tipo === 'DOMContentLoaded') domReadyHandlers.push(cb);
    },
    _elementos: elementos,
    _domReadyHandlers: domReadyHandlers,
  };
}

function criarSupaFalso() {
  let authCallback = null;
  return {
    from() {
      return {
        select() {
          return {
            order() { return Promise.resolve({ data: [], error: null }); },
            // 260829-500: atribSondarEsquema() vem do recorte A — é código
            // real, não stub — e termina em .limit(1). Devolver erro é o
            // banco sem a migração 45, que é o estado que este gate
            // descreve; sem este ramo a sonda lança dentro do try de
            // acessoLivre() e o modo observador nunca chega a ligar.
            limit() { return Promise.resolve({ data: null, error: { message: 'sem migração 45' } }); },
          };
        },
      };
    },
    auth: {
      onAuthStateChange(cb) { authCallback = cb; },
    },
    _getAuthCallback() { return authCallback; },
  };
}

// ── sandbox combinado (A + B + C, no mesmo contexto) ────────────────────

function carregarSandbox() {
  const dom = criarDomFalso();
  const supaFalso = criarSupaFalso();

  const ctx = {
    document: dom,
    supa: supaFalso,
    dbToEquip(r) { return r; },
    loadLogsFromSupabase() { return Promise.resolve(); },
    manSondarEsquema() { return Promise.resolve(); },
    movSondarEsquema() { return Promise.resolve(); },
    // 260823-cf8: acessoLivre() ganhou as chamadas da OS unificada — fora
    // dos três recortes (A/B/C), então precisam de stub aqui, mesma ideia
    // de manSondarEsquema/movSondarEsquema acima.
    uniSondarEsquema() { return Promise.resolve(); },
    osInjectChipsExecutor() {},
    carregarItensOS() { return Promise.resolve(); },
    carregarComentarios() { return Promise.resolve(); },
    carregarArp() { return Promise.resolve(); },
    carregarComposicaoArp() { return Promise.resolve(); },
    // 260826-6wy: acessoLivre() ganhou a sonda, a injeção de navegação e
    // a carga do estoque — mesma ideia de uniSondarEsquema acima, mesmo
    // motivo (D-cf8-28: aprender o fato novo com uma linha, nenhum caso
    // apagado).
    estSondarEsquema() { return Promise.resolve(); },
    estInjectNav() {},
    // 260831-2wq: acessoLivre() ganhou as duas sondas da carga térmica e da
    // inspeção. termSondarEsquema NÃO entra aqui de propósito — ela vive no
    // recorte A (logo depois de atribSondarEsquema), então é código real
    // rodando contra o supa falso, como a sonda da migração 45. Só
    // inspSondarEsquema fica fora dos três recortes e precisa de stub.
    inspSondarEsquema() { return Promise.resolve(); },
    carregarMateriais() { return Promise.resolve(); },
    renderDash() {},
    renderInv() {},
    aplicarAlvoFicha() {},
    showToast() {},
    renderLoginMobile() {},
    initAppOnce() { ctx._chamadasInitAppOnce++; },
    _chamadasInitAppOnce: 0,
    DATA: [],
    ctUser: null,
    _appInited: true,
    console: { log() {}, warn() {}, error() {} },
  };
  ctx.window = ctx; // script clássico: window === global, como no navegador
  vm.createContext(ctx);
  vm.runInContext(recorteA(), ctx);
  vm.runInContext(recorteB(), ctx);
  vm.runInContext(recorteC(), ctx);
  return ctx;
}

// ── comportamento ─────────────────────────────────────────────────────────

test('observador → sessão real na mesma aba destrava, tarja some, sessão nula zera _appInited/ctUser (D-48m-01..05)', async () => {
  const ctx = carregarSandbox();

  // 1) roda o handler de DOMContentLoaded capturado → registra o callback de auth
  assert.equal(ctx.document._domReadyHandlers.length, 1, 'listener de DOMContentLoaded (Auth state) não foi registrado');
  ctx.document._domReadyHandlers[0]();
  const authCb = ctx.supa._getAuthCallback();
  assert.equal(typeof authCb, 'function', 'onAuthStateChange não foi chamado dentro do listener de DOMContentLoaded');

  // 2) acessoLivre() — entra no modo observador
  await ctx.acessoLivre();
  ctx.ctUser = { role: 'gestor' };
  assert.equal(ctx.podeEditarCadastro(), false, 'modo observador deveria bloquear a edição, mesmo com cargo de gestor');
  assert.ok(ctx.document.getElementById('obs-banner'), 'a tarja #obs-banner deveria aparecer no modo observador');

  // 3) sessão real chega pelo listener — FALHA HOJE: a flag nunca desliga
  await authCb('SIGNED_IN', { user: { id: 'u1' } });
  ctx.ctUser = { role: 'gestor' }; // carregarPerfil() real fica fora do recorte B
  assert.equal(ctx.podeEditarCadastro(), true, 'FALHA ESPERADA HOJE (D-48m-02): sessão real deveria destravar a edição do gestor, sem F5');
  assert.equal(ctx.podeDarBaixa(), false, 'gestor não tem baixa (só admin), com ou sem observador');
  assert.equal(ctx.document.getElementById('obs-banner'), null, 'FALHA ESPERADA HOJE (D-48m-05): a tarja deveria sumir quando a sessão real chega');

  // 4) caminho inverso: a sessão cai — FALHA HOJE: nada zera _appInited/ctUser,
  // o que esconde a escalada de privilégio descrita no plano (D-48m-04).
  await authCb('SIGNED_OUT', null);
  assert.equal(ctx._appInited, false, 'FALHA ESPERADA HOJE (D-48m-04): _appInited deveria zerar ao perder a sessão, para o próximo login rodar initAppOnce() por inteiro');
  assert.equal(ctx.ctUser, null, 'FALHA ESPERADA HOJE (D-48m-04): ctUser deveria zerar ao perder a sessão — sem isso a próxima sessão herda o cargo anterior (escalada de privilégio)');

  // entra em modo observador de novo: continua bloqueando...
  await ctx.acessoLivre();
  ctx.ctUser = { role: 'tecnico' };
  assert.equal(ctx.podeEditarCadastro(), false, 'modo observador deveria bloquear de novo, mesmo depois do ciclo anterior');
  // ...e uma sessão real volta a destravar (a flag não fica grudada para sempre)
  await authCb('SIGNED_IN', { user: { id: 'u2' } });
  ctx.ctUser = { role: 'admin' };
  assert.equal(ctx.podeEditarCadastro(), true, 'FALHA ESPERADA HOJE (D-48m-02): uma segunda sessão real também deveria destravar a edição');
});

test('leitura derivada: flag de observador ligada perde para uma sessão ativa (D-48m-02)', () => {
  const ctx = carregarSandbox();
  assert.equal(typeof ctx.somenteLeitura, 'function', 'FALHA ESPERADA HOJE (D-48m-01): somenteLeitura() ainda não existe');
  ctx.window._modoObservador = true;
  ctx._sessaoAtiva = true;
  assert.equal(ctx.somenteLeitura(), false, 'uma sessão ativa deveria vencer uma flag de observador esquecida ligada (modo de falha seguro)');
  ctx._sessaoAtiva = false;
  assert.equal(ctx.somenteLeitura(), true, 'sem sessão ativa, a flag ligada deveria manter o somente-leitura');
});

// ── estruturais (D-48m-01): impedem um décimo ponto de leitura direta ─────

test('D-48m-01: toda ocorrência de _modoObservador cai dentro da seção que a define', () => {
  const iniSecao = HTML.indexOf(MARCADOR_SECAO_NOVA);
  const iniAcessoLivre = HTML.indexOf(MARCADOR_ACESSO_LIVRE);
  assert.ok(iniAcessoLivre > 0, 'cabeçalho "ACESSO LIVRE" não encontrado em refrigeracao/index.html');
  assert.ok(iniSecao >= 0, 'FALHA ESPERADA HOJE (D-48m-01): a seção que confina _modoObservador ainda não existe');
  assert.ok(iniSecao < iniAcessoLivre, 'a seção nova deveria vir imediatamente antes do cabeçalho "ACESSO LIVRE" (D-48m-08)');

  const re = /_modoObservador/g;
  let m;
  let ocorrencias = 0;
  while ((m = re.exec(HTML))) {
    ocorrencias++;
    assert.ok(
      m.index >= iniSecao && m.index < iniAcessoLivre,
      `D-48m-01: ocorrência de _modoObservador fora da seção nova (índice ${m.index}) — um ponto de leitura/escrita direta escapou`
    );
  }
  assert.ok(ocorrencias > 0, '_modoObservador deveria continuar existindo dentro da seção nova (escrita em entrarModoObservador/sairModoObservador)');
});

test('D-48m-01: somenteLeitura() é chamada em pelo menos 9 pontos fora da seção nova', () => {
  const iniSecao = HTML.indexOf(MARCADOR_SECAO_NOVA);
  const fimSecao = HTML.indexOf(MARCADOR_ACESSO_LIVRE);
  assert.ok(iniSecao >= 0 && fimSecao > iniSecao, 'FALHA ESPERADA HOJE (D-48m-01): a seção nova ainda não existe');

  const re = /somenteLeitura\(\)/g;
  let m;
  let foraDaSecao = 0;
  while ((m = re.exec(HTML))) {
    if (m.index < iniSecao || m.index >= fimSecao) foraDaSecao++;
  }
  assert.ok(
    foraDaSecao >= 9,
    `FALHA ESPERADA HOJE (D-48m-01): esperava >= 9 chamadas a somenteLeitura() fora da seção nova (os nove gates do problema), achei ${foraDaSecao}`
  );
});
