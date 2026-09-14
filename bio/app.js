// ══════════════════════════════════════════════════════════════════
// CMASM Bio — gestão biológica do terreno (13/09/2026).
//
// (1) O que é: guia de campo (fichas de espécie), inventário de árvores
// etiquetadas com QR, onde animais e pragas ocorrem (presenças) e os
// serviços de poda e controle com periodicidade. Não é um sistema de
// ocorrências: árvore e praga são coisas CONHECIDAS do terreno, e o
// modelo é catálogo + posição + manutenção — o mesmo eixo do PMOC.
//
// (2) Fronteira de escrita: este módulo escreve SÓ nas quatro tabelas
// `bio_*` da migração 61. Lê `cmasm_locais` (migração 19) para o seletor
// de local e nunca a altera — quem posiciona prédio é o /mapa.
//
// (3) Sonda `BIO_OK`, uma leitura sobre `bio_fichas`, antes e fora do
// carregamento principal: publicável antes da migração rodar (D-cf8-25).
// Com a sonda falsa a tela diz que a migração 61 não foi aplicada e
// nenhum botão de escrita entra — "sem migração, sem botão" (D-6wy-07).
//
// (4) Dois níveis de papel, espelhando as duas funções da migração 61:
// técnico+ registra presença e serviço (campo); gestor+ cadastra ficha e
// árvore (cadastro). A checagem aqui é UX; a RLS é a autoridade.
//
// (5) Nada é apagado. Árvore removida é `ativo=false` + `data_remocao`;
// presença que sumiu é `ativo=false`; serviço que não vai acontecer é
// `cancelado`. Não existe policy de DELETE e não existe botão.
// ══════════════════════════════════════════════════════════════════

import { Auth } from '../shared/auth.js'
import { aplicarShell } from '../shared/shell.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import { pilula, seletor, chips, vazio } from '../shared/componentes.js'
import { montarArvore } from '../shared/arvore.js'
import {
  CATEGORIAS, GRUPOS, RISCOS, TIPOS_SERVICO, TIPOS_POR_ALVO, STATUS_SERVICO,
  hojeIso, somarMeses, fmtData, proximoCodigo, situacaoServico, proximoServico,
  validarServico, validarArvore, validarPresenca, resumoPainel, proximoDoAlvo, urlDaEtiqueta,
} from './dominio.js'

// ── estado global ──────────────────────────────────────────────────────
let supa = null
let auth = null
let USUARIO = null
let BIO_OK = false

let FICHAS = []
let ARVORES = []
let PRESENCAS = []
let SERVICOS = []
let LOCAIS = []
let LOCAIS_POR_ID = new Map()

let FICHAS_CAT = 'todas'
let SERVICOS_VISTA = 'vencidos'

let FICHA_EDIT_ID = null
let ARVORE_EDIT_ID = null
let PRESENCA_EDIT_ID = null
let SERVICO_EDIT_ID = null
let SERVICO_A_REALIZAR = null
let SERVICO_ALVO_FIXO = null
let CONFIRMACAO = null

const el = id => document.getElementById(id)
const esc = valor => String(valor ?? '').replace(/[&<>'"]/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[c])
const val = id => (el(id)?.value ?? '').trim()
const numOuNull = id => { const t = val(id).replace(',', '.'); return t === '' ? null : Number(t) }

// ── permissões ─────────────────────────────────────────────────────────
const podeRegistrar = () => ['admin', 'gestor', 'tecnico'].includes(USUARIO?.role)
const podeGerir = () => ['admin', 'gestor'].includes(USUARIO?.role)

// ── sonda ──────────────────────────────────────────────────────────────
async function sondarBio() {
  try {
    const { error } = await supa.from('bio_fichas').select('id').limit(1)
    BIO_OK = !error
  } catch (_erro) {
    BIO_OK = false
  }
  return BIO_OK
}

// ── carga ──────────────────────────────────────────────────────────────
async function carregarTudo() {
  await sondarBio()

  // Locais vêm de outro módulo: falha aqui não derruba o Bio — o seletor
  // fica vazio e a tela diz "sem local".
  try {
    const { data } = await supa.from('cmasm_locais').select('id,nome,tipo,parent_id,lat,lon').eq('ativo', true)
    LOCAIS = data || []
  } catch (_erro) {
    LOCAIS = []
  }
  LOCAIS_POR_ID = new Map(LOCAIS.map(l => [l.id, l]))

  if (!BIO_OK) { FICHAS = []; ARVORES = []; PRESENCAS = []; SERVICOS = []; return }

  const [f, a, p, s] = await Promise.all([
    supa.from('bio_fichas').select('*').eq('ativo', true).order('nome_comum'),
    supa.from('bio_arvores').select('*').order('codigo'),
    supa.from('bio_presencas').select('*').order('data_registro', { ascending: false }),
    supa.from('bio_servicos').select('*').order('data_programada'),
  ])
  for (const r of [f, a, p, s]) if (r.error) throw new Error(r.error.message)
  FICHAS = f.data || []
  ARVORES = a.data || []
  PRESENCAS = p.data || []
  SERVICOS = s.data || []
}

async function recarregar() {
  try { await carregarTudo() } catch (erro) { alert('Erro: ' + erro.message); return }
  renderTudo()
}

// ── lookups ────────────────────────────────────────────────────────────
const fichaPorId = id => FICHAS.find(f => f.id === id) || null
const arvorePorId = id => ARVORES.find(a => a.id === id) || null
const presencaPorId = id => PRESENCAS.find(p => p.id === id) || null
const servicoPorId = id => SERVICOS.find(s => s.id === id) || null
const localNome = id => LOCAIS_POR_ID.get(id)?.nome || '—'
const nomeFicha = id => fichaPorId(id)?.nome_comum || '—'

function rotuloAlvo(s) {
  if (s.arvore_id) {
    const a = arvorePorId(s.arvore_id)
    return a ? `🌳 ${a.codigo} · ${nomeFicha(a.ficha_id)}` : `🌳 árvore #${s.arvore_id}`
  }
  const p = presencaPorId(s.presenca_id)
  return p ? `${CATEGORIAS[fichaPorId(p.ficha_id)?.categoria]?.icone || ''} ${nomeFicha(p.ficha_id)} · ${localNome(p.local_id)}` : `presença #${s.presenca_id}`
}

function opcoesLocais(selecionado = null) {
  const opcoes = montarArvore(LOCAIS).map(l =>
    `<option value="${l.id}" ${l.id === selecionado ? 'selected' : ''}>${'— '.repeat(l.nivel)}${esc(l.nome)}</option>`)
  return '<option value="">Sem local</option>' + opcoes.join('')
}

function opcoesFichas(categorias, selecionado = null) {
  return '<option value="">Escolha…</option>' + FICHAS
    .filter(f => categorias.includes(f.categoria))
    .map(f => `<option value="${f.id}" ${f.id === selecionado ? 'selected' : ''}>${esc(f.nome_comum)}</option>`)
    .join('')
}

function avisoMigracao() {
  return `<div class="callout co-warn" style="margin-bottom:16px"><strong>Migração 61 não aplicada.</strong>
    As tabelas <code>bio_*</code> ainda não existem neste banco — o módulo abre em modo de leitura vazia.</div>`
}

function pilulaRisco(risco) {
  const r = RISCOS[risco] || { rotulo: risco || '—', tom: 'neutro' }
  return pilula(`Risco ${r.rotulo.toLowerCase()}`, r.tom)
}

function pilulaSituacao(s, hoje) {
  const sit = situacaoServico(s, hoje)
  if (sit === 'vencido') return pilula('Vencido', 'erro')
  const st = STATUS_SERVICO[sit] || { rotulo: sit, tom: 'neutro' }
  return pilula(st.rotulo, st.tom)
}

// ── início ─────────────────────────────────────────────────────────────
function renderInicio() {
  const hoje = hojeIso()
  const r = resumoPainel({ arvores: ARVORES, presencas: PRESENCAS, servicos: SERVICOS }, hoje)
  el('inicio-kpis').innerHTML = `
    <div class="kpi kc-accent"><div class="kpi-n">${r.arvores}</div><div class="kpi-l">Árvores etiquetadas</div></div>
    <div class="kpi kc-blue"><div class="kpi-n">${r.presencas}</div><div class="kpi-l">Presenças ativas</div></div>
    <div class="kpi ${r.vencidos ? 'kc-red' : 'kc-ok'}"><div class="kpi-n">${r.vencidos}</div><div class="kpi-l">Serviços vencidos</div></div>
    <div class="kpi kc-warn"><div class="kpi-n">${r.noMes}</div><div class="kpi-l">Serviços no mês</div></div>`
  el('inicio-aviso').innerHTML = BIO_OK ? '' : avisoMigracao()

  const vencidos = SERVICOS.filter(s => situacaoServico(s, hoje) === 'vencido').slice(0, 8)
  el('inicio-vencidos').innerHTML = vencidos.length
    ? `<div class="tbl-wrap"><table class="tbl"><tbody>${vencidos.map(s => `<tr>
        <td class="hi">${esc(TIPOS_SERVICO[s.tipo] || s.tipo)}</td>
        <td>${esc(rotuloAlvo(s))}</td>
        <td class="num">${fmtData(s.data_programada)}</td>
        <td><button class="btn btn-s btn-sm" onclick="abrirRealizar(${s.id})" ${podeRegistrar() ? '' : 'disabled'}>Realizar</button></td>
      </tr>`).join('')}</tbody></table></div>`
    : vazio('Nenhum serviço vencido.', 'Os programados aparecem na aba Serviços.')

  const risco = PRESENCAS.filter(p => p.ativo !== false && fichaPorId(p.ficha_id)?.risco === 'alto').slice(0, 8)
  el('inicio-risco').innerHTML = risco.length
    ? `<div class="tbl-wrap"><table class="tbl"><tbody>${risco.map(p => `<tr onclick="abrirPresenca(${p.id})" style="cursor:pointer">
        <td class="hi">${esc(nomeFicha(p.ficha_id))}</td>
        <td>${esc(localNome(p.local_id))}</td>
        <td class="num">${fmtData(p.data_registro)}</td>
      </tr>`).join('')}</tbody></table></div>`
    : vazio('Nenhuma presença de risco alto registrada.')
}

// ── fichas ─────────────────────────────────────────────────────────────
function renderFichas() {
  el('fichas-acoes').innerHTML = BIO_OK && podeGerir()
    ? `<button class="btn btn-p btn-sm" onclick="abrirFicha()">Nova ficha</button>` : ''
  const contagem = cat => FICHAS.filter(f => cat === 'todas' || f.categoria === cat).length
  el('fichas-chips').innerHTML = chips([
    { id: 'todas', rotulo: 'Todas', contagem: contagem('todas') },
    ...Object.entries(CATEGORIAS).map(([id, c]) => ({ id, rotulo: c.rotulo, contagem: contagem(id) })),
  ], FICHAS_CAT, 'filtrarFichas')

  const busca = val('fichas-busca').toLowerCase()
  const lista = FICHAS.filter(f => (FICHAS_CAT === 'todas' || f.categoria === FICHAS_CAT)
    && (!busca || `${f.nome_comum} ${f.nome_cientifico || ''}`.toLowerCase().includes(busca)))

  el('fichas-lista').innerHTML = lista.length ? lista.map(f => `
    <div class="ficha-card" onclick="abrirDetalheFicha(${f.id})">
      <div class="ficha-foto">${f.foto_url ? `<img src="${esc(f.foto_url)}" alt="" loading="lazy"/>` : CATEGORIAS[f.categoria]?.icone || ''}</div>
      <div class="ficha-corpo">
        <div class="ficha-nome">${esc(f.nome_comum)}</div>
        <div class="ficha-cient">${esc(f.nome_cientifico || '')}</div>
        <div class="ficha-linha">${pilulaRisco(f.risco)}${f.peconhenta ? pilula('Peçonhenta', 'erro') : ''}<span class="badge b-accent">${esc(GRUPOS[f.grupo] || f.grupo)}</span></div>
      </div>
    </div>`).join('')
    : `<div style="grid-column:1/-1">${BIO_OK ? vazio('Nenhuma ficha encontrada.') : avisoMigracao()}</div>`
}

function filtrarFichas(cat) { FICHAS_CAT = cat; renderFichas() }

function abrirDetalheFicha(id) {
  const f = fichaPorId(id)
  if (!f) return
  const arvores = ARVORES.filter(a => a.ficha_id === id && a.ativo !== false)
  const presencas = PRESENCAS.filter(p => p.ficha_id === id && p.ativo !== false)
  const onde = [
    ...arvores.map(a => `<li><a href="#" onclick="abrirArvore(${a.id});return false">${esc(a.codigo)}</a> · ${esc(localNome(a.local_id))}</li>`),
    ...presencas.map(p => `<li><a href="#" onclick="abrirPresenca(${p.id});return false">${esc(localNome(p.local_id))}</a> · ${fmtData(p.data_registro)}${p.quantidade_estimada != null ? ` · ~${p.quantidade_estimada}` : ''}</li>`),
  ]
  el('modal-detalhe-titulo').textContent = f.nome_comum
  el('modal-detalhe-corpo').innerHTML = `
    ${f.foto_url ? `<img class="det-foto" src="${esc(f.foto_url)}" alt=""/>` : ''}
    <div class="ficha-linha" style="margin-bottom:12px">${pilulaRisco(f.risco)}${f.peconhenta ? pilula('Peçonhenta', 'erro') : ''}
      <span class="badge b-accent">${esc(CATEGORIAS[f.categoria]?.rotulo)} · ${esc(GRUPOS[f.grupo] || f.grupo)}</span></div>
    <div class="det-bloco"><div class="det-rotulo">Nome científico</div><div class="det-texto"><em>${esc(f.nome_cientifico || '—')}</em></div></div>
    <div class="det-bloco"><div class="det-rotulo">Descrição</div><div class="det-texto">${esc(f.descricao || '—')}</div></div>
    <div class="det-bloco"><div class="det-rotulo">O que fazer ao encontrar</div><div class="det-texto">${esc(f.o_que_fazer || '—')}</div></div>
    <div class="det-bloco"><div class="det-rotulo">Controle / manejo</div><div class="det-texto">${esc(f.controle || '—')}</div></div>
    <div class="det-bloco"><div class="det-rotulo">Onde está no CMASM</div>
      ${onde.length ? `<ul class="det-texto" style="padding-left:18px">${onde.join('')}</ul>` : '<div class="det-texto">Nenhum registro no terreno.</div>'}</div>`
  el('modal-detalhe-acoes').innerHTML = `
    <button class="btn btn-s btn-sm" onclick="fecharModal()">Fechar</button>
    ${podeGerir() ? `<button class="btn btn-p btn-sm" onclick="abrirFicha(${f.id})">Editar</button>` : ''}`
  abrirModal('modal-detalhe')
}

function abrirFicha(id = null) {
  if (!BIO_OK || !podeGerir()) return
  FICHA_EDIT_ID = id
  const f = fichaPorId(id) || {}
  el('modal-ficha-titulo').textContent = f.id ? `Editar ${f.nome_comum}` : 'Nova ficha'
  el('modal-ficha-corpo').innerHTML = `
    <div class="fgrid">
      <div class="frow"><label for="fi-nome">Nome comum</label><input id="fi-nome" value="${esc(f.nome_comum || '')}"/></div>
      <div class="frow"><label for="fi-cient">Nome científico</label><input id="fi-cient" value="${esc(f.nome_cientifico || '')}"/></div>
      <div class="frow"><label for="fi-categoria">Categoria</label><select id="fi-categoria">
        ${Object.entries(CATEGORIAS).map(([k, c]) => `<option value="${k}" ${f.categoria === k ? 'selected' : ''}>${c.rotulo}</option>`).join('')}</select></div>
      <div class="frow"><label for="fi-grupo">Grupo</label><select id="fi-grupo">
        ${Object.entries(GRUPOS).map(([k, r]) => `<option value="${k}" ${f.grupo === k ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div class="frow"><label for="fi-risco">Risco</label><select id="fi-risco">
        ${Object.entries(RISCOS).map(([k, r]) => `<option value="${k}" ${(f.risco || 'baixo') === k ? 'selected' : ''}>${r.rotulo}</option>`).join('')}</select></div>
      <div class="frow"><label><input type="checkbox" id="fi-peconhenta" ${f.peconhenta ? 'checked' : ''} style="width:auto;margin-right:6px"/>Peçonhenta / venenosa</label>
        <label><input type="checkbox" id="fi-presente" ${f.presente_no_cmasm !== false ? 'checked' : ''} style="width:auto;margin-right:6px"/>Presente no CMASM</label></div>
    </div>
    <div class="frow"><label for="fi-descricao">Descrição (como reconhecer)</label><textarea id="fi-descricao">${esc(f.descricao || '')}</textarea></div>
    <div class="frow"><label for="fi-fazer">O que fazer ao encontrar</label><textarea id="fi-fazer">${esc(f.o_que_fazer || '')}</textarea></div>
    <div class="frow"><label for="fi-controle">Controle / manejo</label><textarea id="fi-controle">${esc(f.controle || '')}</textarea></div>
    <div class="frow"><label for="fi-foto">Foto</label><input type="file" id="fi-foto" accept="image/*"/>
      <div class="help">${f.foto_url ? 'Já tem foto; escolher outra substitui.' : 'Opcional. Redimensionada para 1280 px antes de subir.'}</div></div>
    <div class="help" id="fi-erro" style="color:var(--red)"></div>`
  abrirModal('modal-ficha')
}

async function salvarFicha() {
  if (!BIO_OK || !podeGerir()) return
  const registro = {
    nome_comum: val('fi-nome'), nome_cientifico: val('fi-cient') || null,
    categoria: val('fi-categoria'), grupo: val('fi-grupo'), risco: val('fi-risco'),
    peconhenta: el('fi-peconhenta').checked, presente_no_cmasm: el('fi-presente').checked,
    descricao: val('fi-descricao') || null, o_que_fazer: val('fi-fazer') || null, controle: val('fi-controle') || null,
  }
  if (!registro.nome_comum) { el('fi-erro').textContent = 'Nome comum obrigatório.'; return }
  const arquivo = el('fi-foto').files?.[0]
  if (arquivo) {
    try { registro.foto_url = await enviarFoto(arquivo, 'fichas') } catch (erro) { el('fi-erro').textContent = 'Foto: ' + erro.message; return }
  }
  const consulta = FICHA_EDIT_ID
    ? supa.from('bio_fichas').update(registro).eq('id', FICHA_EDIT_ID)
    : supa.from('bio_fichas').insert(registro)
  const { error } = await consulta
  if (error) { alert('Erro: ' + error.message); return }
  fecharModal()
  await recarregar()
}

// ── árvores ────────────────────────────────────────────────────────────
function renderArvores() {
  el('arvores-acoes').innerHTML = BIO_OK && podeGerir()
    ? `<button class="btn btn-p btn-sm" onclick="abrirArvoreForm()">Nova árvore</button>` : ''
  const hoje = hojeIso()
  const ativas = ARVORES.filter(a => a.ativo !== false)
  el('arvores-lista').innerHTML = ativas.length ? `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Código</th><th>Espécie</th><th>Local</th><th>Próximo serviço</th><th></th></tr></thead>
    <tbody>${ativas.map(a => {
      const prox = proximoDoAlvo(SERVICOS, 'arvore_id', a.id)
      return `<tr>
        <td class="hi"><a href="#" onclick="abrirArvore(${a.id});return false">${esc(a.codigo)}</a>${a.apelido ? ` <span class="help" style="display:inline">${esc(a.apelido)}</span>` : ''}</td>
        <td>${esc(nomeFicha(a.ficha_id))}</td>
        <td>${esc(localNome(a.local_id))}${a.lat != null ? ' 📍' : ''}</td>
        <td>${prox ? `${esc(TIPOS_SERVICO[prox.tipo])} · ${fmtData(prox.data_programada)} ${pilulaSituacao(prox, hoje)}` : '<span class="help">nenhum programado</span>'}</td>
        <td><button class="btn btn-s btn-sm" onclick="abrirArvore(${a.id})">Ficha</button></td>
      </tr>`
    }).join('')}</tbody></table></div>`
    : (BIO_OK ? vazio('Nenhuma árvore cadastrada.', 'Gestor+ cadastra em "Nova árvore"; a etiqueta sai da ficha.') : avisoMigracao())
}

function abrirArvore(id) {
  const a = arvorePorId(id)
  if (!a) return
  const f = fichaPorId(a.ficha_id)
  const hoje = hojeIso()
  const historico = SERVICOS.filter(s => s.arvore_id === id).sort((x, y) => (y.data_realizada || y.data_programada).localeCompare(x.data_realizada || x.data_programada))
  const url = urlDaEtiqueta(location.origin, a.codigo)
  el('modal-detalhe-titulo').textContent = `${a.codigo} · ${f?.nome_comum || '—'}`
  el('modal-detalhe-corpo').innerHTML = `
    <div class="qr-caixa">${svgQr(url)}<div>
      <div class="det-bloco"><div class="det-rotulo">Espécie</div><div class="det-texto"><a href="#" onclick="abrirDetalheFicha(${a.ficha_id});return false">${esc(f?.nome_comum || '—')}</a> <em>${esc(f?.nome_cientifico || '')}</em></div></div>
      <div class="det-bloco"><div class="det-rotulo">Local</div><div class="det-texto">${esc(localNome(a.local_id))}${a.lat != null ? `<br><span class="help">${a.lat.toFixed(5)}, ${a.lon.toFixed(5)}</span>` : ''}</div></div>
      ${a.apelido ? `<div class="det-bloco"><div class="det-rotulo">Apelido</div><div class="det-texto">${esc(a.apelido)}</div></div>` : ''}
      ${a.ativo === false ? `<div class="det-bloco">${pilula(`Removida${a.data_remocao ? ' em ' + fmtData(a.data_remocao) : ''}`, 'erro')}</div>` : ''}
    </div></div>
    ${a.obs ? `<div class="det-bloco" style="margin-top:12px"><div class="det-rotulo">Observações</div><div class="det-texto">${esc(a.obs)}</div></div>` : ''}
    <div class="det-bloco" style="margin-top:12px"><div class="det-rotulo">Serviços</div>
      ${historico.length ? `<table class="tbl"><tbody>${historico.map(s => `<tr>
        <td class="hi">${esc(TIPOS_SERVICO[s.tipo] || s.tipo)}</td>
        <td class="num">${fmtData(s.data_realizada || s.data_programada)}</td>
        <td>${pilulaSituacao(s, hoje)}</td>
        <td>${esc(s.executor || '')}</td>
      </tr>`).join('')}</tbody></table>` : '<div class="det-texto">Nenhum serviço registrado.</div>'}</div>`
  el('modal-detalhe-acoes').innerHTML = `
    <button class="btn btn-s btn-sm" onclick="fecharModal()">Fechar</button>
    <button class="btn btn-s btn-sm" onclick="imprimirEtiqueta(${a.id})">Imprimir etiqueta</button>
    ${podeRegistrar() && a.ativo !== false ? `<button class="btn btn-p btn-sm" onclick="abrirServico(null,'arvore',${a.id})">Registrar serviço</button>` : ''}
    ${podeGerir() ? `<button class="btn btn-s btn-sm" onclick="abrirArvoreForm(${a.id})">Editar</button>` : ''}
    ${podeGerir() && a.ativo !== false ? `<button class="btn btn-d btn-sm" onclick="pedirRemocaoArvore(${a.id})">Remover</button>` : ''}`
  abrirModal('modal-detalhe')
}

function abrirArvoreForm(id = null) {
  if (!BIO_OK || !podeGerir()) return
  ARVORE_EDIT_ID = id
  const a = arvorePorId(id) || { codigo: proximoCodigo(ARVORES) }
  el('modal-arvore-titulo').textContent = a.id ? `Editar ${a.codigo}` : 'Nova árvore'
  el('modal-arvore-corpo').innerHTML = `
    <div class="fgrid">
      <div class="frow"><label for="ar-codigo">Código</label><input id="ar-codigo" value="${esc(a.codigo)}"/><div class="help">Sequencial; o banco recusa duplicado.</div></div>
      <div class="frow"><label for="ar-ficha">Espécie</label><select id="ar-ficha">${opcoesFichas(['arvore'], a.ficha_id)}</select></div>
      <div class="frow"><label for="ar-apelido">Apelido</label><input id="ar-apelido" value="${esc(a.apelido || '')}" placeholder="Mangueira do portão"/></div>
      <div class="frow"><label for="ar-local">Local</label><select id="ar-local">${opcoesLocais(a.local_id ?? null)}</select></div>
      <div class="frow"><label for="ar-lat">Latitude</label><input id="ar-lat" inputmode="decimal" value="${a.lat ?? ''}" placeholder="-22,8396"/></div>
      <div class="frow"><label for="ar-lon">Longitude</label><input id="ar-lon" inputmode="decimal" value="${a.lon ?? ''}" placeholder="-43,1094"/></div>
      <div class="frow"><label for="ar-plantio">Data de plantio</label><input id="ar-plantio" type="date" value="${a.data_plantio || ''}"/></div>
    </div>
    <div class="frow"><label for="ar-obs">Observações</label><textarea id="ar-obs">${esc(a.obs || '')}</textarea></div>
    <div class="help">Sem coordenada, a árvore herda a posição do local no mapa. Posicionar no ponto exato é feito no /mapa.</div>
    <div class="help" id="ar-erro" style="color:var(--red)"></div>`
  abrirModal('modal-arvore')
}

async function salvarArvore() {
  if (!BIO_OK || !podeGerir()) return
  const registro = {
    codigo: val('ar-codigo').toUpperCase(), ficha_id: Number(val('ar-ficha')) || null,
    apelido: val('ar-apelido') || null, local_id: Number(val('ar-local')) || null,
    lat: numOuNull('ar-lat'), lon: numOuNull('ar-lon'),
    data_plantio: val('ar-plantio') || null, obs: val('ar-obs') || null,
  }
  const erros = validarArvore(registro)
  if (erros.length) { el('ar-erro').textContent = erros.join(' '); return }
  if (!ARVORE_EDIT_ID) registro.criado_por = USUARIO?.nome || USUARIO?.role || null
  const consulta = ARVORE_EDIT_ID
    ? supa.from('bio_arvores').update(registro).eq('id', ARVORE_EDIT_ID)
    : supa.from('bio_arvores').insert(registro)
  const { error } = await consulta
  if (error) { el('ar-erro').textContent = 'Erro: ' + error.message; return }
  fecharModal()
  await recarregar()
}

function pedirRemocaoArvore(id) {
  const a = arvorePorId(id)
  if (!a || !podeGerir()) return
  pedirConfirmacao(`Remover ${a.codigo}?`,
    'A árvore sai do inventário ativo e o histórico fica. Nada é apagado.',
    async () => {
      const { error } = await supa.from('bio_arvores').update({ ativo: false, data_remocao: hojeIso() }).eq('id', id)
      if (error) { alert('Erro: ' + error.message); return }
      await recarregar()
    })
}

function svgQr(texto) {
  if (typeof qrcode !== 'function' || !texto) return ''
  const q = qrcode(0, 'M')
  q.addData(texto)
  q.make()
  return q.createSvgTag({ cellSize: 3, margin: 2, scalable: true })
}

function imprimirEtiqueta(id) {
  const a = arvorePorId(id)
  if (!a) return
  const f = fichaPorId(a.ficha_id)
  el('etiqueta').innerHTML = `
    <div class="et-codigo">${esc(a.codigo)}</div>
    <div class="et-nome">${esc(f?.nome_comum || '')}</div>
    <div class="et-cient">${esc(f?.nome_cientifico || '')}</div>
    ${svgQr(urlDaEtiqueta(location.origin, a.codigo))}
    <div class="et-rodape">CMASM · DME — aponte a câmera para abrir a ficha</div>`
  window.print()
}

// ── presenças ──────────────────────────────────────────────────────────
function renderPresencas() {
  el('presencas-acoes').innerHTML = BIO_OK && podeRegistrar()
    ? `<button class="btn btn-p btn-sm" onclick="abrirPresencaForm()">Nova presença</button>` : ''
  const ativas = PRESENCAS.filter(p => p.ativo !== false)
  el('presencas-lista').innerHTML = ativas.length ? `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Espécie</th><th>Local</th><th>Registro</th><th>Qtd.</th><th>Risco</th><th></th></tr></thead>
    <tbody>${ativas.map(p => {
      const f = fichaPorId(p.ficha_id)
      return `<tr>
        <td class="hi">${CATEGORIAS[f?.categoria]?.icone || ''} <a href="#" onclick="abrirPresenca(${p.id});return false">${esc(f?.nome_comum || '—')}</a></td>
        <td>${esc(localNome(p.local_id))}${p.geom ? ' ⬡' : p.lat != null ? ' 📍' : ''}</td>
        <td class="num">${fmtData(p.data_registro)}</td>
        <td class="num">${p.quantidade_estimada ?? '—'}</td>
        <td>${pilulaRisco(f?.risco)}</td>
        <td><button class="btn btn-s btn-sm" onclick="abrirPresenca(${p.id})">Ver</button></td>
      </tr>`
    }).join('')}</tbody></table></div>`
    : (BIO_OK ? vazio('Nenhuma presença registrada.', 'Técnico+ registra onde viu o animal ou a praga.') : avisoMigracao())
}

function abrirPresenca(id) {
  const p = presencaPorId(id)
  if (!p) return
  const f = fichaPorId(p.ficha_id)
  const hoje = hojeIso()
  const servicos = SERVICOS.filter(s => s.presenca_id === id)
  el('modal-detalhe-titulo').textContent = `${f?.nome_comum || '—'} · ${localNome(p.local_id)}`
  el('modal-detalhe-corpo').innerHTML = `
    <div class="ficha-linha" style="margin-bottom:12px">${pilulaRisco(f?.risco)}${p.ativo === false ? pilula('Inativa', 'neutro') : ''}</div>
    <div class="det-bloco"><div class="det-rotulo">Ficha</div><div class="det-texto"><a href="#" onclick="abrirDetalheFicha(${p.ficha_id});return false">${esc(f?.nome_comum || '—')}</a> — ${esc(f?.o_que_fazer || '')}</div></div>
    <div class="det-bloco"><div class="det-rotulo">Registro</div><div class="det-texto">${fmtData(p.data_registro)}${p.registrado_por ? ` · ${esc(p.registrado_por)}` : ''}${p.quantidade_estimada != null ? ` · ~${p.quantidade_estimada}` : ''}</div></div>
    ${p.lat != null ? `<div class="det-bloco"><div class="det-rotulo">Posição</div><div class="det-texto">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</div></div>` : ''}
    ${p.geom ? `<div class="det-bloco"><div class="det-rotulo">Área</div><div class="det-texto">Polígono com ${p.geom.length} vértices (ver no mapa).</div></div>` : ''}
    ${p.obs ? `<div class="det-bloco"><div class="det-rotulo">Observações</div><div class="det-texto">${esc(p.obs)}</div></div>` : ''}
    <div class="det-bloco"><div class="det-rotulo">Serviços de controle</div>
      ${servicos.length ? `<table class="tbl"><tbody>${servicos.map(s => `<tr>
        <td class="hi">${esc(TIPOS_SERVICO[s.tipo] || s.tipo)}</td><td class="num">${fmtData(s.data_realizada || s.data_programada)}</td>
        <td>${pilulaSituacao(s, hoje)}</td><td>${esc(s.materiais || '')}</td></tr>`).join('')}</tbody></table>` : '<div class="det-texto">Nenhum.</div>'}</div>`
  el('modal-detalhe-acoes').innerHTML = `
    <button class="btn btn-s btn-sm" onclick="fecharModal()">Fechar</button>
    ${podeRegistrar() && p.ativo !== false ? `<button class="btn btn-p btn-sm" onclick="abrirServico(null,'presenca',${p.id})">Registrar serviço</button>` : ''}
    ${podeRegistrar() ? `<button class="btn btn-s btn-sm" onclick="abrirPresencaForm(${p.id})">Editar</button>` : ''}
    ${podeRegistrar() && p.ativo !== false ? `<button class="btn btn-d btn-sm" onclick="pedirDesativarPresenca(${p.id})">Não está mais aqui</button>` : ''}`
  abrirModal('modal-detalhe')
}

function abrirPresencaForm(id = null) {
  if (!BIO_OK || !podeRegistrar()) return
  PRESENCA_EDIT_ID = id
  const p = presencaPorId(id) || { data_registro: hojeIso() }
  el('modal-presenca-titulo').textContent = p.id ? 'Editar presença' : 'Nova presença'
  el('modal-presenca-corpo').innerHTML = `
    <div class="fgrid">
      <div class="frow"><label for="pr-ficha">Espécie</label><select id="pr-ficha">${opcoesFichas(['animal', 'praga'], p.ficha_id)}</select></div>
      <div class="frow"><label for="pr-local">Local</label><select id="pr-local">${opcoesLocais(p.local_id ?? null)}</select></div>
      <div class="frow"><label for="pr-data">Data do registro</label><input id="pr-data" type="date" value="${p.data_registro || ''}"/></div>
      <div class="frow"><label for="pr-qtd">Quantidade estimada</label><input id="pr-qtd" inputmode="numeric" value="${p.quantidade_estimada ?? ''}"/></div>
      <div class="frow"><label for="pr-lat">Latitude</label><input id="pr-lat" inputmode="decimal" value="${p.lat ?? ''}"/></div>
      <div class="frow"><label for="pr-lon">Longitude</label><input id="pr-lon" inputmode="decimal" value="${p.lon ?? ''}"/></div>
    </div>
    <div class="frow"><label for="pr-obs">Observações</label><textarea id="pr-obs">${esc(p.obs || '')}</textarea></div>
    <div class="help">Área (polígono) é desenhada no /mapa, não aqui.</div>
    <div class="help" id="pr-erro" style="color:var(--red)"></div>`
  abrirModal('modal-presenca')
}

async function salvarPresenca() {
  if (!BIO_OK || !podeRegistrar()) return
  const registro = {
    ficha_id: Number(val('pr-ficha')) || null, local_id: Number(val('pr-local')) || null,
    data_registro: val('pr-data') || hojeIso(),
    quantidade_estimada: val('pr-qtd') === '' ? null : Number(val('pr-qtd')),
    lat: numOuNull('pr-lat'), lon: numOuNull('pr-lon'), obs: val('pr-obs') || null,
  }
  const erros = validarPresenca(registro)
  if (erros.length) { el('pr-erro').textContent = erros.join(' '); return }
  if (!PRESENCA_EDIT_ID) registro.registrado_por = USUARIO?.nome || USUARIO?.role || null
  const consulta = PRESENCA_EDIT_ID
    ? supa.from('bio_presencas').update(registro).eq('id', PRESENCA_EDIT_ID)
    : supa.from('bio_presencas').insert(registro)
  const { error } = await consulta
  if (error) { el('pr-erro').textContent = 'Erro: ' + error.message; return }
  fecharModal()
  await recarregar()
}

function pedirDesativarPresenca(id) {
  if (!podeRegistrar()) return
  pedirConfirmacao('Marcar como ausente?', 'A presença sai do mapa e da lista; o registro fica.', async () => {
    const { error } = await supa.from('bio_presencas').update({ ativo: false }).eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    await recarregar()
  })
}

// ── serviços ───────────────────────────────────────────────────────────
function renderServicos() {
  el('servicos-acoes').innerHTML = BIO_OK && podeRegistrar()
    ? `<button class="btn btn-p btn-sm" onclick="abrirServico()">Novo serviço</button>` : ''
  const hoje = hojeIso()
  const conta = v => SERVICOS.filter(s => filtroServico(s, v, hoje)).length
  el('servicos-seletor').innerHTML = seletor([
    { id: 'vencidos', rotulo: `Vencidos (${conta('vencidos')})` },
    { id: 'programados', rotulo: `Programados (${conta('programados')})` },
    { id: 'realizados', rotulo: `Realizados (${conta('realizados')})` },
  ], SERVICOS_VISTA, 'trocarVistaServicos')

  const lista = SERVICOS.filter(s => filtroServico(s, SERVICOS_VISTA, hoje))
  el('servicos-lista').innerHTML = lista.length ? `<div class="tbl-wrap" style="margin-top:12px"><table class="tbl">
    <thead><tr><th>Serviço</th><th>Alvo</th><th>Data</th><th>Situação</th><th>Executor / materiais</th><th></th></tr></thead>
    <tbody>${lista.map(s => `<tr>
      <td class="hi">${esc(TIPOS_SERVICO[s.tipo] || s.tipo)}${s.periodicidade_meses ? ` <span class="badge b-blue">a cada ${s.periodicidade_meses} m</span>` : ''}</td>
      <td>${esc(rotuloAlvo(s))}</td>
      <td class="num">${fmtData(s.data_realizada || s.data_programada)}</td>
      <td>${pilulaSituacao(s, hoje)}</td>
      <td>${esc([s.executor, s.materiais].filter(Boolean).join(' · '))}</td>
      <td style="white-space:nowrap">${s.status === 'programado' && podeRegistrar()
        ? `<button class="btn btn-p btn-sm" onclick="abrirRealizar(${s.id})">Realizar</button> <button class="btn btn-s btn-sm" onclick="abrirServico(${s.id})">Editar</button> <button class="btn btn-d btn-sm" onclick="pedirCancelarServico(${s.id})">Cancelar</button>`
        : ''}</td>
    </tr>`).join('')}</tbody></table></div>`
    : (BIO_OK ? vazio('Nada aqui.', SERVICOS_VISTA === 'vencidos' ? 'Bom sinal: nenhum serviço atrasado.' : '') : avisoMigracao())
}

function filtroServico(s, vista, hoje) {
  const sit = situacaoServico(s, hoje)
  if (vista === 'vencidos') return sit === 'vencido'
  if (vista === 'programados') return sit === 'programado'
  return sit === 'realizado'
}

function trocarVistaServicos(v) { SERVICOS_VISTA = v; renderServicos() }

/** `alvo`/`alvoId` fixam o alvo quando o formulário abre de dentro de uma
 *  ficha de árvore ou presença; sem eles, o usuário escolhe. */
function abrirServico(id = null, alvo = null, alvoId = null) {
  if (!BIO_OK || !podeRegistrar()) return
  SERVICO_EDIT_ID = id
  const s = servicoPorId(id) || { data_programada: hojeIso() }
  if (s.arvore_id) { alvo = 'arvore'; alvoId = s.arvore_id }
  if (s.presenca_id) { alvo = 'presenca'; alvoId = s.presenca_id }
  SERVICO_ALVO_FIXO = alvo && alvoId ? { alvo, alvoId } : null
  el('modal-servico-titulo').textContent = s.id ? 'Editar serviço' : 'Novo serviço'
  const arvores = ARVORES.filter(a => a.ativo !== false)
  const presencas = PRESENCAS.filter(p => p.ativo !== false)
  const opAlvo = SERVICO_ALVO_FIXO
    ? `<div class="frow"><label>Alvo</label><div class="det-texto">${esc(rotuloAlvo({ arvore_id: alvo === 'arvore' ? alvoId : null, presenca_id: alvo === 'presenca' ? alvoId : null }))}</div></div>`
    : `<div class="frow"><label for="sv-alvo">Alvo</label><select id="sv-alvo" onchange="atualizarTiposServico()">
        <option value="">Escolha…</option>
        <optgroup label="Árvores">${arvores.map(a => `<option value="arvore:${a.id}">${esc(a.codigo)} · ${esc(nomeFicha(a.ficha_id))}</option>`).join('')}</optgroup>
        <optgroup label="Presenças">${presencas.map(p => `<option value="presenca:${p.id}">${esc(nomeFicha(p.ficha_id))} · ${esc(localNome(p.local_id))}</option>`).join('')}</optgroup>
      </select></div>`
  el('modal-servico-corpo').innerHTML = `
    ${opAlvo}
    <div class="fgrid">
      <div class="frow"><label for="sv-tipo">Serviço</label><select id="sv-tipo"></select></div>
      <div class="frow"><label for="sv-data">Data programada</label><input id="sv-data" type="date" value="${s.data_programada || ''}"/></div>
      <div class="frow"><label for="sv-periodo">Periodicidade (meses)</label><input id="sv-periodo" inputmode="numeric" value="${s.periodicidade_meses ?? ''}" placeholder="vazio = avulso"/></div>
      <div class="frow"><label for="sv-materiais">Materiais previstos</label><input id="sv-materiais" value="${esc(s.materiais || '')}" placeholder="isca granulada 500 g"/></div>
    </div>
    <div class="frow"><label for="sv-obs">Observações</label><textarea id="sv-obs">${esc(s.obs || '')}</textarea></div>
    <div class="help" id="sv-erro" style="color:var(--red)"></div>`
  atualizarTiposServico(s.tipo)
  abrirModal('modal-servico')
}

function alvoSelecionado() {
  if (SERVICO_ALVO_FIXO) return SERVICO_ALVO_FIXO
  const [alvo, id] = val('sv-alvo').split(':')
  return alvo && id ? { alvo, alvoId: Number(id) } : null
}

function atualizarTiposServico(selecionado = null) {
  const a = alvoSelecionado()
  const tipos = a ? TIPOS_POR_ALVO[a.alvo] : Object.keys(TIPOS_SERVICO)
  el('sv-tipo').innerHTML = tipos.map(t => `<option value="${t}" ${t === selecionado ? 'selected' : ''}>${TIPOS_SERVICO[t]}</option>`).join('')
}

async function salvarServico() {
  if (!BIO_OK || !podeRegistrar()) return
  const a = alvoSelecionado()
  const registro = {
    tipo: val('sv-tipo'),
    arvore_id: a?.alvo === 'arvore' ? a.alvoId : null,
    presenca_id: a?.alvo === 'presenca' ? a.alvoId : null,
    data_programada: val('sv-data'),
    periodicidade_meses: val('sv-periodo') === '' ? null : Number(val('sv-periodo')),
    materiais: val('sv-materiais') || null, obs: val('sv-obs') || null,
  }
  const erros = validarServico(registro)
  if (erros.length) { el('sv-erro').textContent = erros.join(' '); return }
  if (!SERVICO_EDIT_ID) registro.criado_por = USUARIO?.nome || USUARIO?.role || null
  const consulta = SERVICO_EDIT_ID
    ? supa.from('bio_servicos').update(registro).eq('id', SERVICO_EDIT_ID)
    : supa.from('bio_servicos').insert(registro)
  const { error } = await consulta
  if (error) { el('sv-erro').textContent = 'Erro: ' + error.message; return }
  fecharModal()
  await recarregar()
}

function abrirRealizar(id) {
  const s = servicoPorId(id)
  if (!BIO_OK || !podeRegistrar() || !s || s.status !== 'programado') return
  SERVICO_A_REALIZAR = id
  el('modal-realizar-corpo').innerHTML = `
    <div class="det-texto" style="margin-bottom:12px"><strong>${esc(TIPOS_SERVICO[s.tipo])}</strong> — ${esc(rotuloAlvo(s))}</div>
    <div class="fgrid">
      <div class="frow"><label for="re-data">Data realizada</label><input id="re-data" type="date" value="${hojeIso()}"/></div>
      <div class="frow"><label for="re-executor">Executor</label><input id="re-executor" value="${esc(USUARIO?.nome || '')}"/></div>
    </div>
    <div class="frow"><label for="re-materiais">Materiais usados</label><input id="re-materiais" value="${esc(s.materiais || '')}"/></div>
    <div class="frow"><label for="re-obs">Observações</label><textarea id="re-obs"></textarea></div>
    <div class="frow"><label for="re-foto">Foto (opcional)</label><input type="file" id="re-foto" accept="image/*"/></div>
    ${s.periodicidade_meses ? `<div class="help">Periódico: o próximo será programado ${s.periodicidade_meses} meses após a data realizada.</div>` : ''}
    <div class="help" id="re-erro" style="color:var(--red)"></div>`
  abrirModal('modal-realizar')
}

/** Duas escritas em sequência, NÃO uma transação: se a segunda falhar, o
 *  realizado fica e o próximo não nasce — a tela avisa para programar à
 *  mão. Um RPC transacional é dívida conhecida da plataforma (CLAUDE.md,
 *  Dívida de segurança), não deste módulo. */
async function confirmarRealizado() {
  if (!BIO_OK || !podeRegistrar()) return
  const s = servicoPorId(SERVICO_A_REALIZAR)
  if (!s) return
  const dataRealizada = val('re-data')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRealizada)) { el('re-erro').textContent = 'Data obrigatória.'; return }
  const patch = {
    status: 'realizado', data_realizada: dataRealizada,
    executor: val('re-executor') || null, materiais: val('re-materiais') || null,
    obs: [s.obs, val('re-obs')].filter(Boolean).join('\n') || null,
  }
  const arquivo = el('re-foto').files?.[0]
  if (arquivo) {
    try { patch.foto_url = await enviarFoto(arquivo, 'servicos') } catch (erro) { el('re-erro').textContent = 'Foto: ' + erro.message; return }
  }
  const { error } = await supa.from('bio_servicos').update(patch).eq('id', s.id)
  if (error) { el('re-erro').textContent = 'Erro: ' + error.message; return }

  const proximo = proximoServico(s, dataRealizada)
  if (proximo) {
    proximo.criado_por = USUARIO?.nome || USUARIO?.role || null
    const { error: erroProximo } = await supa.from('bio_servicos').insert(proximo)
    if (erroProximo) alert(`Realizado gravado, mas o próximo (${fmtData(proximo.data_programada)}) não foi programado: ${erroProximo.message}. Programe à mão.`)
  }
  fecharModal()
  await recarregar()
}

function pedirCancelarServico(id) {
  const s = servicoPorId(id)
  if (!s || !podeRegistrar()) return
  pedirConfirmacao('Cancelar serviço?', 'Ele fica no histórico como cancelado. Um periódico cancelado não gera o próximo.', async () => {
    const { error } = await supa.from('bio_servicos').update({ status: 'cancelado' }).eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    await recarregar()
  })
}

// ── fotos ──────────────────────────────────────────────────────────────
/** Redimensiona no cliente (≤1280 px, JPEG 0,82) e sobe para o bucket
 *  `os-fotos` da plataforma, em `bio/<pasta>/`. O bucket é público por
 *  dívida conhecida; este módulo não muda isso. */
async function enviarFoto(arquivo, pasta) {
  const blob = await reduzirImagem(arquivo, 1280)
  const caminho = `bio/${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supa.storage.from('os-fotos').upload(caminho, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error(error.message)
  return supa.storage.from('os-fotos').getPublicUrl(caminho).data.publicUrl
}

function reduzirImagem(arquivo, maximo) {
  return new Promise((resolver, rejeitar) => {
    const img = new Image()
    const url = URL.createObjectURL(arquivo)
    img.onload = () => {
      const escala = Math.min(1, maximo / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * escala)
      c.height = Math.round(img.height * escala)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob(b => b ? resolver(b) : rejeitar(new Error('não foi possível converter a imagem')), 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('arquivo não é uma imagem legível')) }
    img.src = url
  })
}

// ── modais e navegação ─────────────────────────────────────────────────
function abrirModal(id) {
  for (const modal of document.querySelectorAll('.overlay .modal')) modal.classList.add('hidden')
  el(id).classList.remove('hidden')
  el('overlay').classList.add('open')
}

function fecharModal() {
  el('overlay').classList.remove('open')
  CONFIRMACAO = null
}

function pedirConfirmacao(titulo, texto, acao) {
  CONFIRMACAO = acao
  el('modal-confirmacao-titulo').textContent = titulo
  el('modal-confirmacao-corpo').innerHTML = `<p class="det-texto">${esc(texto)}</p>`
  abrirModal('modal-confirmacao')
}

async function executarConfirmacao() {
  const acao = CONFIRMACAO
  fecharModal()
  if (acao) await acao()
}

function trocarView(id, botao) {
  for (const v of document.querySelectorAll('.view')) v.classList.remove('active')
  el(`view-${id}`)?.classList.add('active')
  for (const b of document.querySelectorAll('.nav-btn')) b.classList.remove('active')
  botao?.classList.add('active')
}

function renderTudo() {
  renderInicio(); renderFichas(); renderArvores(); renderPresencas(); renderServicos()
}

/** Deep link da etiqueta (`?codigo=ARV-0001`) e dos outros módulos
 *  (`?arvore=<id>`, `?ficha=<id>`). Código inválido é ignorado em silêncio,
 *  como os módulos fazem com `?ativo=`. */
function abrirPorUrl() {
  const p = new URLSearchParams(location.search)
  const codigo = (p.get('codigo') || '').toUpperCase()
  if (codigo) {
    const a = ARVORES.find(x => x.codigo === codigo)
    if (a) { trocarView('arvores', document.querySelector('.nav-btn[data-view="arvores"]')); abrirArvore(a.id) }
    return
  }
  const arvore = Number(p.get('arvore'))
  if (Number.isInteger(arvore) && arvorePorId(arvore)) { trocarView('arvores', document.querySelector('.nav-btn[data-view="arvores"]')); abrirArvore(arvore); return }
  const ficha = Number(p.get('ficha'))
  if (Number.isInteger(ficha) && fichaPorId(ficha)) { trocarView('fichas', document.querySelector('.nav-btn[data-view="fichas"]')); abrirDetalheFicha(ficha) }
}

function mostrarApp() {
  el('login-screen').style.display = 'none'
  el('app').style.display = 'block'
  const cargo = USUARIO?.role || '—'
  el('user-chip').textContent = podeRegistrar() ? cargo : `${cargo} · somente leitura`
  renderTudo()
  abrirPorUrl()
}

function mostrarLogin() {
  el('login-screen').style.display = 'flex'
  el('app').style.display = 'none'
}

async function sair() {
  await supa.auth.signOut()
  location.reload()
}

function exporNoWindow() {
  Object.assign(window, {
    trocarView, sair, fecharModal, executarConfirmacao,
    renderFichas, filtrarFichas, abrirDetalheFicha, abrirFicha, salvarFicha,
    abrirArvore, abrirArvoreForm, salvarArvore, pedirRemocaoArvore, imprimirEtiqueta,
    abrirPresenca, abrirPresencaForm, salvarPresenca, pedirDesativarPresenca,
    trocarVistaServicos, abrirServico, atualizarTiposServico, salvarServico,
    abrirRealizar, confirmarRealizado, pedirCancelarServico,
  })
}

async function boot() {
  exporNoWindow()

  aplicarShell({
    nome: 'Bio',
    versao: '0.1',
    navItems: [
      { id: 'inicio', label: 'Início', icone: 'painel', ativo: true },
      { id: 'fichas', label: 'Fichas', icone: 'relatorio' },
      { id: 'arvores', label: 'Árvores', icone: 'corte' },
      { id: 'presencas', label: 'Presenças', icone: 'mapa' },
      { id: 'servicos', label: 'Serviços', icone: 'agenda' },
    ],
  })

  try {
    supa = await criarClienteSupabase()
  } catch (erro) {
    el('login-screen').innerHTML = `
      <div class="callout co-red" style="max-width:min(560px,92vw);margin:40px auto">
        <strong>Falha ao iniciar o módulo Bio.</strong><br>${esc(erro.message)}
      </div>`
    el('login-screen').style.display = 'flex'
    return
  }

  auth = new Auth(supa, { appNome: 'Bio', appIcone: '🌿' })
  auth.onLogin(async usuario => {
    USUARIO = usuario
    try {
      await carregarTudo()
    } catch (erro) {
      el('login-screen').innerHTML = `
        <div class="callout co-red" style="max-width:min(560px,92vw);margin:40px auto">
          <strong>Não foi possível carregar os dados do Bio.</strong><br>${esc(erro.message || '')}
        </div>`
      el('login-screen').style.display = 'flex'
      return
    }
    mostrarApp()
  })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}

if (typeof document !== 'undefined') boot()

// ── porta de teste ─────────────────────────────────────────────────────
export const __teste = {
  definirSupa: cliente => { supa = cliente },
  definirUsuario: usuario => { USUARIO = usuario },
  estado: () => ({ BIO_OK, FICHAS, ARVORES, PRESENCAS, SERVICOS, LOCAIS }),
  sondarBio, carregarTudo, podeRegistrar, podeGerir, rotuloAlvo, filtroServico,
}
