// PMOC Equipes — pessoas, ofícios, equipes, turnos e a escala semanal.
//
// A plataforma sabia o que precisa de manutenção (nove módulos de
// ativos) e não sabia QUEM faz: toda OS registra o técnico como texto
// livre. Este módulo é o cadastro que faltava, e a escala semanal é o
// que transforma "temos três equipes" em "temos 96 homem-hora nesta
// semana".
//
// Não usa shared/modulo-manutencao.js: aquilo é o esqueleto genérico de
// manutenção de ativos (inventário, planos, OS, vencimentos) e aqui não
// há ativo nenhum. Usa a base comum direto — Auth, shell e tema —, como
// /mapa, que é o outro módulo que não é de ativos.

import { Auth } from '../shared/auth.js'
import { aplicarShell } from '../shared/shell.js'
import { criarClienteSupabase } from '../shared/supabase-config.js'
import {
  DOMINIOS, CORES_EQUIPE,
  chaveData, semanaDe, moverSemana, rotuloSemana,
  horasDoTurno, formatarHora, tamanhoDaEquipe, capacidadeDaSemana,
  alocacoesPorCelula, normalizarDominios, rotuloDominios, proximaCor,
  visitasDoPlano, demandaAnual, utilizacao, faixaUtilizacao, parametrosComoObjeto,
} from './nucleo.js'

let supa = null
let auth = null
let USUARIO = null

// Estado global em UPPER_CASE, o padrão dos outros módulos.
let ESPECIALIDADES = []
let PESSOAS = []
let EQUIPES = []
let MEMBROS = []
let TURNOS = []
let ALOCACOES = []
let SEMANA_REF = new Date()
let ARRASTANDO = null
// Plano & capacidade — carregados fora do Promise.all principal, como os
// outros módulos fazem com o que depende de migração mais nova: sem a 51
// a aba Plano avisa e o resto do módulo se comporta como hoje.
let PARAMS = {}
let TAREFAS_PLANO = []
// Os equipamentos INSTALADOS, com tipo e modelo — não mais uma contagem.
// Uma contagem não sabe de que tipo é cada máquina, e desde a migração 54
// o plano pode ter regra por tipo: a demanda precisa das linhas.
let EQUIPAMENTOS = []
let COBERTURA = null
let PLANO_OK = false

const el = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ── permissões ──────────────────────────────────────────────────────────
// Duas listas diferentes, deliberadamente, espelhando 1:1 as policies da
// migração 49 — não é preferência de interface: cadastrar pessoa é ato
// de registro (admin/gestor); alocar equipe na escala é planejamento de
// rotina e inclui o técnico. A mesma separação que /refrigeracao faz
// entre podeEditarCadastro() e manPode('abrir').
const podeCadastrar = () => ['admin', 'gestor'].includes(USUARIO?.role)
const podeAlocar = () => ['admin', 'gestor', 'tecnico'].includes(USUARIO?.role)

function aviso(msg, tom = 'erro') {
  const t = document.createElement('div')
  t.className = 'toast'
  t.style.borderLeft = `3px solid ${tom === 'ok' ? '#168821' : '#E52207'}`
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

// ── carga ───────────────────────────────────────────────────────────────
async function carregarTudo() {
  const [esp, pes, eqp, mem, tur] = await Promise.all([
    supa.from('cmasm_especialidades').select('*').order('nome'),
    supa.from('cmasm_pessoas').select('*').order('nome'),
    supa.from('cmasm_equipes').select('*').order('nome'),
    supa.from('cmasm_equipe_membros').select('*'),
    supa.from('cmasm_turnos').select('*').order('ordem'),
  ])
  const erro = [esp, pes, eqp, mem, tur].find(r => r.error)
  if (erro) throw erro.error
  ESPECIALIDADES = esp.data || []
  PESSOAS = pes.data || []
  EQUIPES = eqp.data || []
  MEMBROS = mem.data || []
  TURNOS = tur.data || []
  await carregarAlocacoes()
}

/** Só a semana na tela — a tabela cresce sem limite ao longo dos anos e
 *  carregar tudo ficaria mais lento a cada mês que passa. */
async function carregarAlocacoes() {
  const dias = semanaDe(SEMANA_REF)
  const r = await supa.from('cmasm_alocacoes').select('*')
    .gte('data', dias[0].chave).lte('data', dias[6].chave)
  if (r.error) throw r.error
  ALOCACOES = r.data || []
}

/** Fora do Promise.all principal, de propósito: sem a migração 51 (ou
 *  sem permissão de leitura em `plano_tarefas`) o módulo inteiro
 *  continua funcionando — só a aba Plano diz o que faltou. */
async function carregarPlano() {
  try {
    const [par, tar, equip] = await Promise.all([
      supa.from('cmasm_parametros').select('*'),
      // `select('*')` e não uma lista de colunas: `aplica_modelo` só existe
      // depois da migração 54, e pedi-la pelo nome num banco sem ela
      // devolveria 400 e derrubaria a aba inteira. Vindo `undefined`, a
      // regra de escopo já a trata como "sem refinamento" — o módulo se
      // comporta igual com e sem a 54, sem precisar de sonda.
      supa.from('plano_tarefas').select('*'),
      // As LINHAS, não `count: 'exact', head: true`. São 175 e três
      // colunas; o que a contagem não podia dar é justamente o tipo.
      supa.from('equipamentos').select('id,tipo,modelo').eq('situacao', 'instalado'),
    ])
    if (par.error || tar.error || equip.error) throw (par.error || tar.error || equip.error)
    PARAMS = parametrosComoObjeto(par.data)
    TAREFAS_PLANO = tar.data || []
    EQUIPAMENTOS = equip.data || []
    // Os ativos que o plano por CALENDÁRIO não cobre. Contados, nunca
    // omitidos: sem isso a tela apresentaria 64% do parque como se fosse
    // o parque inteiro.
    const outros = await Promise.all(['maq_ativos', 'transp_ativos', 'elet_ativos', 'fono_ativos'].map(
      t => supa.from(t).select('id', { count: 'exact', head: true })))
    COBERTURA = {
      cobertos: EQUIPAMENTOS.length,
      naoCobertos: outros.reduce((s, r) => s + (r.error ? 0 : (r.count || 0)), 0),
    }
    PLANO_OK = true
  } catch (_erro) {
    PLANO_OK = false
  }
}

// ── plano & capacidade ──────────────────────────────────────────────────
function renderPlano() {
  const host = el('view-plano')
  if (!host) return

  if (!PLANO_OK) {
    host.innerHTML = `
      <div class="view-head"><div><div class="view-title">Plano &amp; capacidade</div></div></div>
      <div class="callout co-warn"><strong>Não foi possível montar o plano.</strong>
        Falta ler <code>cmasm_parametros</code> (migração 51) ou <code>plano_tarefas</code>.
        A escala e os cadastros continuam funcionando normalmente.</div>`
    return
  }

  // A demanda é somada POR ESCOPO: o plano de cada grupo tipo × modelo,
  // multiplicado pelos equipamentos daquele grupo. Antes era um plano só,
  // multiplicado por uma contagem — e bastaria a primeira regra por tipo
  // criada na tela do Plano de /refrigeracao para essa conta atribuir a
  // regra ao parque inteiro.
  const dem = demandaAnual(TAREFAS_PLANO, EQUIPAMENTOS, PARAMS, COBERTURA.naoCobertos)
  const dias = semanaDe(SEMANA_REF)
  const cap = capacidadeDaSemana(dias, ALOCACOES, TURNOS, MEMBROS, PESSOAS)
  const u = utilizacao(dem.horasSemana, cap.horas)
  const faixa = faixaUtilizacao(u)
  const fmt = (n, d = 0) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: d })

  host.innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Plano &amp; capacidade</div>
        <div class="view-sub">O que o plano obriga, contra o que a escala oferece</div></div>
    </div>

    <div class="kpi-row">
      <div class="kpi kc-gold"><div class="kpi-n">${fmt(dem.horasAno)}</div><div class="kpi-l">homem-hora/ano de demanda</div></div>
      <div class="kpi kc-blue"><div class="kpi-n">${fmt(dem.horasSemana, 1)}</div><div class="kpi-l">demanda média por semana</div></div>
      <div class="kpi kc-accent"><div class="kpi-n">${fmt(cap.horas, 1)}</div><div class="kpi-l">capacidade escalada nesta semana</div></div>
    </div>

    ${u === null ? `<div class="callout co-warn">
      <strong>Sem capacidade escalada nesta semana, não há utilização a calcular.</strong>
      Escale alguma equipe na aba <em>Escala</em> — um número aqui, com a semana vazia,
      seria lido como resposta.
    </div>` : `<div class="callout" style="border-left-color:${faixa.tom}">
      <strong style="color:${faixa.tom}">${esc(faixa.rotulo)} — ${fmt(u * 100)}%</strong>
      da capacidade desta semana estaria comprometida com o plano preventivo
      (${fmt(dem.horasSemana, 1)} h de plano contra ${fmt(cap.horas, 1)} h escaladas).
      ${u > 0.85 ? ' Acima de 85% não sobra folga para corretiva, que numa oficina de manutenção é o mesmo que não caber.' : ''}
    </div>`}

    <div class="panel-card">
      <div class="section-row"><strong>De onde vem a demanda</strong></div>
      <div class="help">Do plano REAL no banco (<code>plano_tarefas</code>), não de uma cópia de constantes.
        Mudar a periodicidade de uma tarefa lá muda este número aqui — e o escopo de uma regra
        (<code>aplica_a</code>, <code>aplica_modelo</code>) muda a QUEM ela é cobrada.</div>
      ${dem.comEscopo ? renderDemandaPorTipo(dem, fmt) : renderFormaDoPlano(fmt)}
      <div class="help" style="margin-top:8px">
        <strong>${fmt(dem.horasPorEquipamentoAnoMedia, 1)} h/ano</strong>
        ${dem.comEscopo ? 'em média por equipamento' : 'por equipamento'} ·
        ${dem.equipamentos} equipamentos → <strong>${fmt(dem.horasAno)} h/ano</strong> ·
        ${fmt(dem.visitasAno)} visitas/ano no total.
      </div>
      ${dem.semPeriodicidade ? `<div class="callout co-warn" style="margin-top:8px">
        ${dem.semPeriodicidade} tarefa(s) com periodicidade que não sei converter em vezes por ano —
        ficaram <strong>fora</strong> da conta, em vez de entrarem com um número suposto.</div>` : ''}
      ${dem.semRegra ? `<div class="callout co-warn" style="margin-top:8px">
        <strong>${dem.semRegra} equipamento(s) que nenhuma regra do plano alcança</strong>
        ${dem.tiposSemRegra.length ? `(${dem.tiposSemRegra.map(esc).join(', ')})` : ''}
        entraram com <strong>zero hora</strong>. Não é folga: é máquina que sai da OS sem checklist.
        Crie a regra na aba <em>Plano</em> de /refrigeracao — a demanda sobe quando ela existir.</div>` : ''}
    </div>

    ${dem.naoCobertos ? `<div class="callout co-warn">
      <strong>Esta conta cobre ${dem.equipamentos} de ${dem.equipamentos + dem.naoCobertos} ativos.</strong>
      Os outros ${dem.naoCobertos} (máquinas, transportes, elétrica, fonoclama) planejam por
      <em>horímetro</em>, não por calendário: a demanda deles depende de quanto o ativo roda,
      que é outro mecanismo e não cabe nesta soma. Apresentar o total sem dizer isso mostraria
      parte do parque como se fosse o todo.
    </div>` : ''}

    <div class="panel-card">
      <div class="section-row"><strong>Calibração do tempo</strong>
        ${podeCadastrar() ? '<button class="btn btn-s btn-sm" onclick="abrirParametros()">Ajustar</button>' : ''}</div>
      <div class="help">Estes dois números são <strong>ponto de partida, não medição</strong> — vieram do app
        antigo. Cronometre duas ou três manutenções reais e ajuste: a demanda inteira depende deles.</div>
      <div class="tbl-wrap" style="margin-top:8px"><table class="tbl">
        <thead><tr><th>Parâmetro</th><th>Valor</th></tr></thead>
        <tbody>
          <tr><td>Minutos por tarefa</td><td><strong>${fmt(PARAMS.minutos_por_tarefa, 1)} min</strong></td></tr>
          <tr><td>Setup por visita</td><td><strong>${fmt(PARAMS.minutos_setup, 1)} min</strong></td></tr>
        </tbody>
      </table></div>
      <div class="help" style="margin-top:8px">O setup é cobrado <strong>por visita, não por tarefa</strong>:
        quem faz as duas tarefas mensais do mesmo aparelho se desloca uma vez só. Cobrar por tarefa
        inflaria a demanda em cerca de metade (1.025 min contra 695, por equipamento/ano).</div>
    </div>
  `
}

/** A FORMA do plano, para quando nenhuma regra tem escopo: aí todo
 *  equipamento tem mesmo o mesmo plano, e uma tabela por tipo repetiria
 *  a mesma linha seis vezes. É o estado de hoje — as 9 tarefas da NBR
 *  valem para TODOS. */
function renderFormaDoPlano(fmt) {
  const plano = visitasDoPlano(TAREFAS_PLANO)
  return `<div class="tbl-wrap" style="margin-top:8px"><table class="tbl">
      <thead><tr><th>Periodicidade</th><th>Tarefas</th><th>Visitas/ano</th><th>Min/visita</th></tr></thead>
      <tbody>${plano.visitas.map(v => `<tr>
        <td><strong>${esc(v.periodicidade)}</strong></td>
        <td>${v.tarefas}</td>
        <td>${v.porAno}</td>
        <td>${fmt(v.tarefas * (PARAMS.minutos_por_tarefa || 0) + (PARAMS.minutos_setup || 0))} min</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="help" style="margin-top:8px"><strong>${plano.visitasPorAno} visitas/ano</strong>
      por equipamento (${plano.tarefasPorAno} execuções de tarefa). Nenhuma regra tem escopo:
      as ${plano.visitas.reduce((n, v) => n + v.tarefas, 0)} tarefas valem para o parque inteiro,
      então este plano é o de cada equipamento.</div>`
}

/** Com escopo em jogo, a forma do plano deixa de ser uma só — mostrar a
 *  lista inteira de tarefas como se fosse o plano de cada máquina seria
 *  a mesma mentira que esta correção conserta, mudada de lugar. A tabela
 *  passa a ser por tipo, que é como a regra discrimina. */
function renderDemandaPorTipo(dem, fmt) {
  const regras = l => (l.regrasMin === l.regrasMax ? String(l.regrasMax) : `${l.regrasMin}–${l.regrasMax}`)
  // A explicação da faixa só aparece quando existe faixa na tela. Um
  // texto que descreve o que não está ali é a mesma classe de defeito
  // que o aviso de "tipos sem regra própria" já custou em /refrigeracao:
  // ensina a ler explicação sem procurar o fato.
  const temFaixa = dem.porTipo.some(l => l.regrasMin !== l.regrasMax)
  return `<div class="tbl-wrap" style="margin-top:8px"><table class="tbl">
      <thead><tr><th>Tipo</th><th>Equip.</th><th>Regras</th><th>Visitas/ano</th><th>h/ano</th></tr></thead>
      <tbody>${dem.porTipo.map(l => `<tr>
        <td><strong>${esc(l.tipo)}</strong></td>
        <td>${l.equipamentos}</td>
        <td${l.regrasMax === 0 ? ' style="color:#E52207"' : ''}>${regras(l)}</td>
        <td>${fmt(l.visitasAno)}</td>
        <td>${fmt(l.horasAno)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="help" style="margin-top:8px">
      Com escopo em jogo o plano deixa de ter uma forma só, então a periodicidade de cada regra
      fica onde ela é editada: a aba <em>Plano</em> de /refrigeracao.
      ${temFaixa ? ` A faixa em <em>Regras</em> marca os tipos cujos modelos recebem contagens
        diferentes — um refinamento por modelo alcança uns e não outros, e uma média esconderia
        isso atrás de um número que não vale para nenhum dos dois.` : ''}
    </div>`
}

function abrirParametros() {
  if (!podeCadastrar()) return aviso('Sem permissão para calibrar')
  abrirModal('Calibração do tempo de serviço', `
    <div class="help">A demanda anual inteira sai destes dois números.</div>
    <label style="margin-top:10px">Minutos por tarefa
      <input id="f-min-tarefa" class="control-auto" type="number" min="0" step="0.5" value="${PARAMS.minutos_por_tarefa ?? 10}"/></label>
    <label style="margin-top:10px">Setup por visita (min)
      <input id="f-min-setup" class="control-auto" type="number" min="0" step="0.5" value="${PARAMS.minutos_setup ?? 15}"/></label>
  `, async () => {
    const vals = {
      minutos_por_tarefa: parseFloat(el('f-min-tarefa').value),
      minutos_setup: parseFloat(el('f-min-setup').value),
    }
    for (const [k, v] of Object.entries(vals)) {
      // Mesma barreira do check do banco, na tela: tempo negativo
      // encolheria a demanda em silêncio.
      if (!Number.isFinite(v) || v < 0) return aviso('Os tempos precisam ser números não negativos')
    }
    for (const [chave, valor] of Object.entries(vals)) {
      const r = await supa.from('cmasm_parametros').update({ valor, atualizado: new Date().toISOString() }).eq('chave', chave)
      if (r.error) { aviso(`Erro: ${r.error.message}`); return false }
      PARAMS[chave] = valor
    }
    renderPlano()
  })
}

// ── escala semanal ──────────────────────────────────────────────────────
function renderEscala() {
  const dias = semanaDe(SEMANA_REF)
  const hoje = chaveData(new Date())
  const cap = capacidadeDaSemana(dias, ALOCACOES, TURNOS, MEMBROS, PESSOAS)
  const porCelula = alocacoesPorCelula(dias, ALOCACOES)
  const podeMover = podeAlocar()

  const semTurnos = !TURNOS.filter(t => t.ativo !== false).length
  const turnos = TURNOS.filter(t => t.ativo !== false)

  el('view-escala').innerHTML = `
    <div class="view-head">
      <div>
        <div class="view-title">Escala semanal</div>
        <div class="view-sub">${esc(rotuloSemana(dias))}</div>
      </div>
      <div class="frow">
        <button class="btn btn-s btn-sm" onclick="navegarSemana(-1)" aria-label="Semana anterior">‹</button>
        <button class="btn btn-s btn-sm" onclick="irParaHoje()">Hoje</button>
        <button class="btn btn-s btn-sm" onclick="navegarSemana(1)" aria-label="Próxima semana">›</button>
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi kc-accent"><div class="kpi-n">${cap.horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div><div class="kpi-l">homem-hora na semana</div></div>
      <div class="kpi kc-blue"><div class="kpi-n">${cap.equipes}</div><div class="kpi-l">equipe(s) escalada(s)</div></div>
      <div class="kpi kc-gold"><div class="kpi-n">${cap.alocacoes}</div><div class="kpi-l">alocaç(ões) na semana</div></div>
    </div>

    ${cap.alocacoesSemPessoal ? `<div class="callout co-warn">
      <strong>${cap.alocacoesSemPessoal} alocação(ões) valem zero hora</strong> — a equipe escalada não tem nenhuma
      pessoa ativa. Elas aparecem na grade, mas não somam capacidade: quase sempre é equipe cadastrada e ainda sem membros.
    </div>` : ''}

    ${semTurnos ? `<div class="callout co-warn">
      <strong>Nenhum turno cadastrado.</strong> A grade precisa de pelo menos um turno para ter onde pôr equipe —
      um turno tem hora de início e fim, e é daí que sai a duração usada na capacidade. Cadastre em <em>Turnos</em>.
    </div>` : ''}

    ${podeMover && !semTurnos ? renderPaleta() : ''}
    ${semTurnos ? '' : renderGrade(dias, turnos, porCelula, hoje, podeMover)}
    ${semTurnos ? '' : renderListaDias(dias, turnos, porCelula, hoje)}
  `
}

/** As equipes ficam numa paleta acima da grade e são arrastadas de lá
 *  para o dia/turno. Equipe sem pessoa ativa aparece esmaecida e com o
 *  aviso no título: pode ser escalada (às vezes se monta a escala antes
 *  de lotar a equipe), mas quem arrasta precisa saber que vale zero. */
function renderPaleta() {
  const ativas = EQUIPES.filter(e => e.ativo !== false)
  if (!ativas.length) {
    return `<div class="callout"><strong>Nenhuma equipe cadastrada.</strong>
      Crie uma em <em>Equipes</em> para poder escalá-la aqui.</div>`
  }
  // Arrastar E clicar, nas duas larguras. O clique não é redundância:
  // abaixo de 900px a grade não existe e o arrastar do HTML5 não dispara
  // em toque nenhum — sem ele, o celular ficaria só de leitura, num
  // aplicativo que é usado em campo. No computador o clique também
  // serve, para quem prefere não arrastar.
  return `<div class="help">Arraste uma equipe para o dia e turno — ou toque nela para escolher.</div>
    <div class="eq-paleta">${ativas.map(eq => {
      const n = tamanhoDaEquipe(eq.id, MEMBROS, PESSOAS)
      return `<div class="eq-arrasta${n ? '' : ' sem-gente'}" draggable="true" role="button" tabindex="0"
        style="background:${esc(eq.cor || CORES_EQUIPE[0])}"
        ondragstart="aoArrastar(event,${eq.id})" ondragend="aoSoltarFora()"
        onclick="escalarPorFormulario(${eq.id})"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();escalarPorFormulario(${eq.id})}"
        title="${esc(eq.nome)} — ${n} pessoa(s) ativa(s)${n ? '' : '; sem pessoal, vale 0 h'}">
        ${esc(eq.nome)} <span class="ag-n">${n}</span></div>`
    }).join('')}</div>`
}

function renderGrade(dias, turnos, porCelula, hoje, podeMover) {
  const cabs = dias.map(d =>
    `<div class="ag-cab${d.chave === hoje ? ' hoje' : ''}">${d.rotulo}<br>${d.dia}</div>`).join('')

  const linhas = turnos.map(t => {
    const h = horasDoTurno(t)
    const celulas = dias.map(d => {
      const evs = porCelula[`${d.chave}|${t.id}`] || []
      const solta = podeMover
        ? ` ondragover="aoSobrepor(event)" ondragleave="aoSair(event)" ondrop="aoSoltar(event,'${d.chave}',${t.id})"`
        : ''
      return `<div class="ag-cel${d.chave === hoje ? ' hoje' : ''}${podeMover ? ' solta' : ''}"${solta}>
        ${evs.map(a => chipEquipe(a, podeMover)).join('')}</div>`
    }).join('')
    return `<div class="ag-turno">${esc(t.nome)}<small>${formatarHora(t.hora_inicio)}–${formatarHora(t.hora_fim)}</small>
      <small>${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h</small></div>${celulas}`
  }).join('')

  return `<div class="ag-grade"><div class="ag-cab"></div>${cabs}${linhas}</div>`
}

function chipEquipe(aloc, podeMover) {
  const eq = EQUIPES.find(e => e.id === aloc.equipe_id)
  const n = tamanhoDaEquipe(aloc.equipe_id, MEMBROS, PESSOAS)
  const nome = eq ? eq.nome : `Equipe ${aloc.equipe_id}`
  return `<div class="ag-eq" style="background:${esc(eq?.cor || CORES_EQUIPE[0])}" title="${esc(nome)} — ${n} pessoa(s)">
    <span>${esc(nome)}</span><span class="ag-n">${n}</span>
    ${podeMover ? `<button onclick="removerAlocacao(${aloc.id})" title="Tirar da escala" aria-label="Tirar ${esc(nome)} da escala">×</button>` : ''}
  </div>`
}

/** Abaixo de 900px a grade some e esta lista aparece — só os dias que
 *  têm alguém escalado. Sete colunas em tela de celular dariam células
 *  de 45px, onde nome de equipe nenhum cabe.
 *
 *  Aqui não há arrastar: o arrastar do HTML5 não dispara em toque sem
 *  polyfill, e polyfill é dependência nova num projeto zero-build. O
 *  botão × continua funcionando, e escalar no celular é escolher pelo
 *  formulário — o mesmo limite, e a mesma saída, do calendário de OS. */
function renderListaDias(dias, turnos, porCelula, hoje) {
  const comAlgo = dias.filter(d => turnos.some(t => (porCelula[`${d.chave}|${t.id}`] || []).length))
  if (!comAlgo.length) {
    return `<div class="ag-lista"><div class="empty"><div class="empty-ico">📅</div>
      <div>Nenhuma equipe escalada nesta semana.</div></div></div>`
  }
  return `<div class="ag-lista">${comAlgo.map(d => `
    <div class="dia-bloco${d.chave === hoje ? ' hoje' : ''}">
      <div class="dia-cab">${d.rotulo}, ${d.dia}${d.chave === hoje ? ' · hoje' : ''}</div>
      ${turnos.map(t => {
        const evs = porCelula[`${d.chave}|${t.id}`] || []
        if (!evs.length) return ''
        return `<div class="dia-turno">${esc(t.nome)} · ${formatarHora(t.hora_inicio)}–${formatarHora(t.hora_fim)}</div>
          ${evs.map(a => chipEquipe(a, podeAlocar())).join('')}`
      }).join('')}
    </div>`).join('')}</div>`
}

// ── arrastar e soltar ───────────────────────────────────────────────────
function aoArrastar(ev, equipeId) {
  ARRASTANDO = equipeId
  try { ev.dataTransfer.setData('text/plain', String(equipeId)); ev.dataTransfer.effectAllowed = 'copy' } catch (_e) {}
}
function aoSoltarFora() { ARRASTANDO = null }
function aoSobrepor(ev) {
  if (ARRASTANDO === null) return
  ev.preventDefault()
  ev.dataTransfer.dropEffect = 'copy'
  ev.currentTarget?.classList.add('alvo')
}
function aoSair(ev) { ev.currentTarget?.classList.remove('alvo') }

async function aoSoltar(ev, dataChave, turnoId) {
  ev.preventDefault()
  ev.currentTarget?.classList.remove('alvo')
  const equipeId = ARRASTANDO
  ARRASTANDO = null
  if (equipeId === null) return
  // Guarda na AÇÃO, não só no atributo draggable: arrastar é affordance
  // de tela e não protege gravação nenhuma.
  if (!podeAlocar()) return aviso('Sem permissão para escalar equipe')

  // Soltar de novo no mesmo lugar não pode criar linha nova — a trava
  // única do banco recusaria, mas o usuário veria um erro por uma ação
  // que deveria simplesmente não fazer nada.
  if (ALOCACOES.some(a => a.equipe_id === equipeId && a.data === dataChave && a.turno_id === turnoId)) return

  const r = await supa.from('cmasm_alocacoes')
    .insert({ equipe_id: equipeId, data: dataChave, turno_id: turnoId }).select().single()
  if (r.error) return aviso(`Erro ao escalar: ${r.error.message}`)
  ALOCACOES.push(r.data)
  renderEscala(); renderPlano()
}

/** O mesmo destino do arrastar, alcançado por formulário: dia e turno
 *  escolhidos numa lista. Passa pela MESMA gravação — nenhuma segunda
 *  porta de escrita nasce por causa do celular. */
function escalarPorFormulario(equipeId) {
  if (!podeAlocar()) return aviso('Sem permissão para escalar equipe')
  const eq = EQUIPES.find(e => e.id === equipeId)
  const turnos = TURNOS.filter(t => t.ativo !== false)
  if (!eq || !turnos.length) return
  const dias = semanaDe(SEMANA_REF)
  const hoje = chaveData(new Date())
  abrirModal(`Escalar ${eq.nome}`, `
    <label>Dia
      <select id="f-dia" class="control-auto">
        ${dias.map(d => `<option value="${d.chave}"${d.chave === hoje ? ' selected' : ''}>${d.rotulo}, ${d.dia}${d.chave === hoje ? ' · hoje' : ''}</option>`).join('')}
      </select></label>
    <label style="margin-top:10px">Turno
      <select id="f-turno" class="control-auto">
        ${turnos.map(t => `<option value="${t.id}">${esc(t.nome)} · ${formatarHora(t.hora_inicio)}–${formatarHora(t.hora_fim)}</option>`).join('')}
      </select></label>
  `, async () => {
    const data = el('f-dia').value
    const turnoId = Number(el('f-turno').value)
    // Mesma guarda do arrastar: já escalada ali não vira linha nova.
    if (ALOCACOES.some(a => a.equipe_id === equipeId && a.data === data && a.turno_id === turnoId)) {
      aviso('Esta equipe já está escalada neste dia e turno', 'ok')
      return
    }
    const r = await supa.from('cmasm_alocacoes')
      .insert({ equipe_id: equipeId, data, turno_id: turnoId }).select().single()
    if (r.error) { aviso(`Erro ao escalar: ${r.error.message}`); return false }
    ALOCACOES.push(r.data)
    renderEscala(); renderPlano()
  })
}

async function removerAlocacao(id) {
  if (!podeAlocar()) return aviso('Sem permissão para alterar a escala')
  const r = await supa.from('cmasm_alocacoes').delete().eq('id', id)
  if (r.error) return aviso(`Erro: ${r.error.message}`)
  ALOCACOES = ALOCACOES.filter(a => a.id !== id)
  renderEscala(); renderPlano()
}

async function navegarSemana(delta) {
  SEMANA_REF = moverSemana(SEMANA_REF, delta)
  await carregarAlocacoes()
  renderEscala(); renderPlano()
}
async function irParaHoje() {
  SEMANA_REF = new Date()
  await carregarAlocacoes()
  renderEscala(); renderPlano()
}

// ── pessoas ─────────────────────────────────────────────────────────────
function renderPessoas() {
  const porId = Object.fromEntries(ESPECIALIDADES.map(e => [e.id, e]))
  const usuarios = PESSOAS.filter(p => p.is_usuario).length
  const ativas = PESSOAS.filter(p => p.ativo !== false).length

  el('view-pessoas').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Pessoas</div>
        <div class="view-sub">${PESSOAS.length} cadastrada(s) · ${ativas} ativa(s) · ${usuarios} com login</div></div>
      ${podeCadastrar() ? '<button class="btn btn-p btn-sm" onclick="abrirPessoa(null)">+ Pessoa</button>' : ''}
    </div>
    <div class="callout">
      <strong>Pessoa não é usuário.</strong> A oficina tem gente que executa serviço e nunca abre o app —
      marque <em>login</em> só para quem precisa entrar. Pessoa inativa continua no histórico mas sai da capacidade.
    </div>
    ${PESSOAS.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Nome</th><th>Posto/Grad.</th><th>Especialidade</th><th>Login</th><th>Ativo</th><th></th></tr></thead>
      <tbody>${PESSOAS.map(p => `<tr>
        <td><strong>${esc(p.nome)}</strong></td>
        <td>${esc(p.posto || '—')}</td>
        <td>${esc(porId[p.especialidade_id]?.nome || '—')}</td>
        <td>${p.is_usuario ? '<span class="pilula pilula-ok">sim</span>' : '<span class="pilula pilula-neutro">não</span>'}</td>
        <td>${p.ativo !== false ? '<span class="pilula pilula-ok">ativo</span>' : '<span class="pilula pilula-neutro">inativo</span>'}</td>
        <td>${podeCadastrar() ? `<button class="btn btn-s btn-sm" onclick="abrirPessoa(${p.id})">Editar</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="empty-ico">👷</div><div>Nenhuma pessoa cadastrada.</div>
         <div class="vazio-dica">Nada foi semeado aqui de propósito: nome de militar é dado real da OM, e inventar
         um para a tela não ficar vazia poria dado falso num cadastro que será lido como verdadeiro.</div></div>`}
  `
}

function abrirPessoa(id) {
  if (!podeCadastrar()) return aviso('Sem permissão para cadastrar pessoa')
  const p = id === null ? { nome: '', posto: '', especialidade_id: null, is_usuario: false, ativo: true }
    : PESSOAS.find(x => x.id === id)
  if (!p) return
  abrirModal(id === null ? 'Nova pessoa' : `Editar ${p.nome}`, `
    <div class="fgrid">
      <label>Nome<input id="f-nome" class="control-auto" value="${esc(p.nome)}"/></label>
      <label>Posto / graduação<input id="f-posto" class="control-auto" value="${esc(p.posto || '')}"/></label>
    </div>
    <label>Especialidade
      <select id="f-esp" class="control-auto">
        <option value="">— sem especialidade —</option>
        ${ESPECIALIDADES.map(e => `<option value="${e.id}"${p.especialidade_id === e.id ? ' selected' : ''}>${esc(e.nome)}</option>`).join('')}
      </select></label>
    <div class="help">A especialidade é o que decide quais serviços a pessoa atende.</div>
    <div class="frow" style="margin-top:10px">
      <label><input type="checkbox" id="f-user"${p.is_usuario ? ' checked' : ''}/> tem login no sistema</label>
      <label><input type="checkbox" id="f-ativo"${p.ativo !== false ? ' checked' : ''}/> ativo</label>
    </div>
  `, async () => {
    const nome = el('f-nome').value.trim()
    if (!nome) return aviso('O nome não pode ficar vazio')
    const dados = {
      nome,
      posto: el('f-posto').value.trim() || null,
      especialidade_id: el('f-esp').value ? Number(el('f-esp').value) : null,
      is_usuario: el('f-user').checked,
      ativo: el('f-ativo').checked,
    }
    const r = id === null
      ? await supa.from('cmasm_pessoas').insert(dados).select().single()
      : await supa.from('cmasm_pessoas').update(dados).eq('id', id).select().single()
    if (r.error) { aviso(`Erro: ${r.error.message}`); return false }
    if (id === null) PESSOAS.push(r.data)
    else PESSOAS = PESSOAS.map(x => (x.id === id ? r.data : x))
    PESSOAS.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
    renderPessoas(); renderEquipes(); renderEscala()
  })
}

// ── equipes ─────────────────────────────────────────────────────────────
function renderEquipes() {
  const porId = Object.fromEntries(ESPECIALIDADES.map(e => [e.id, e]))
  el('view-equipes').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Equipes</div>
        <div class="view-sub">${EQUIPES.length} cadastrada(s)</div></div>
      ${podeCadastrar() ? '<button class="btn btn-p btn-sm" onclick="abrirEquipe(null)">+ Equipe</button>' : ''}
    </div>
    ${EQUIPES.length ? EQUIPES.map(eq => {
      const membros = MEMBROS.filter(m => m.equipe_id === eq.id)
        .map(m => PESSOAS.find(p => p.id === m.pessoa_id)).filter(Boolean)
      const n = tamanhoDaEquipe(eq.id, MEMBROS, PESSOAS)
      const esp = porId[eq.especialidade_id]
      return `<div class="panel-card">
        <div class="section-row">
          <div class="frow">
            <span style="width:12px;height:12px;border-radius:3px;background:${esc(eq.cor || CORES_EQUIPE[0])}"></span>
            <strong>${esc(eq.nome)}</strong>
            <span class="pilula pilula-neutro">${n} ativo(s)</span>
            ${eq.ativo === false ? '<span class="pilula pilula-warn">inativa</span>' : ''}
          </div>
          ${podeCadastrar() ? `<button class="btn btn-s btn-sm" onclick="abrirEquipe(${eq.id})">Editar</button>` : ''}
        </div>
        <div class="help">${esp ? `${esc(esp.nome)} — atende ${esc(rotuloDominios(esp.dominios))}` : 'Sem especialidade: não fica habilitada para nenhum serviço.'}</div>
        <div style="margin-top:8px">${membros.length
          ? membros.map(p => `<span class="chip chip-n">${esc(p.nome)}${p.ativo === false ? ' (inativo)' : ''}</span>`).join(' ')
          : '<span class="help">Sem membros — escalar esta equipe vale 0 h.</span>'}</div>
        ${podeCadastrar() ? `<div style="margin-top:8px"><button class="btn btn-s btn-sm" onclick="abrirMembros(${eq.id})">Membros</button></div>` : ''}
      </div>`
    }).join('')
      : `<div class="empty"><div class="empty-ico">🧰</div><div>Nenhuma equipe cadastrada.</div></div>`}
  `
}

function abrirEquipe(id) {
  if (!podeCadastrar()) return aviso('Sem permissão para cadastrar equipe')
  const eq = id === null
    ? { nome: '', especialidade_id: null, cor: proximaCor(EQUIPES), ativo: true }
    : EQUIPES.find(x => x.id === id)
  if (!eq) return
  abrirModal(id === null ? 'Nova equipe' : `Editar ${eq.nome}`, `
    <label>Nome<input id="f-nome" class="control-auto" value="${esc(eq.nome)}"/></label>
    <label>Especialidade
      <select id="f-esp" class="control-auto">
        <option value="">— sem especialidade —</option>
        ${ESPECIALIDADES.map(e => `<option value="${e.id}"${eq.especialidade_id === e.id ? ' selected' : ''}>${esc(e.nome)}</option>`).join('')}
      </select></label>
    <div class="help">É pela especialidade da equipe que ela fica habilitada para os serviços de um módulo.</div>
    <label style="margin-top:10px">Cor na escala
      <select id="f-cor" class="control-auto">
        ${CORES_EQUIPE.map(c => `<option value="${c}"${eq.cor === c ? ' selected' : ''}>${c}</option>`).join('')}
      </select></label>
    <div class="frow" style="margin-top:10px">
      <label><input type="checkbox" id="f-ativo"${eq.ativo !== false ? ' checked' : ''}/> ativa</label>
    </div>
  `, async () => {
    const nome = el('f-nome').value.trim()
    if (!nome) return aviso('O nome não pode ficar vazio')
    const dados = {
      nome,
      especialidade_id: el('f-esp').value ? Number(el('f-esp').value) : null,
      cor: el('f-cor').value,
      ativo: el('f-ativo').checked,
    }
    const r = id === null
      ? await supa.from('cmasm_equipes').insert(dados).select().single()
      : await supa.from('cmasm_equipes').update(dados).eq('id', id).select().single()
    if (r.error) { aviso(`Erro: ${r.error.message}`); return false }
    if (id === null) EQUIPES.push(r.data)
    else EQUIPES = EQUIPES.map(x => (x.id === id ? r.data : x))
    EQUIPES.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
    renderEquipes(); renderEscala()
  })
}

function abrirMembros(equipeId) {
  if (!podeCadastrar()) return aviso('Sem permissão para alterar membros')
  const eq = EQUIPES.find(e => e.id === equipeId)
  if (!eq) return
  const dentro = new Set(MEMBROS.filter(m => m.equipe_id === equipeId).map(m => m.pessoa_id))
  abrirModal(`Membros de ${eq.nome}`, `
    <div class="help">Uma pessoa pode estar em mais de uma equipe. Só as ativas contam na capacidade.</div>
    <div class="stack" style="margin-top:8px;max-height:50vh;overflow:auto">
      ${PESSOAS.length ? PESSOAS.map(p => `<label style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" data-pessoa="${p.id}"${dentro.has(p.id) ? ' checked' : ''}/>
        <span>${esc(p.nome)}${p.posto ? ` · ${esc(p.posto)}` : ''}${p.ativo === false ? ' (inativo)' : ''}</span>
      </label>`).join('') : '<div class="help">Nenhuma pessoa cadastrada ainda.</div>'}
    </div>
  `, async () => {
    const marcados = new Set([...document.querySelectorAll('[data-pessoa]')]
      .filter(c => c.checked).map(c => Number(c.dataset.pessoa)))
    const inserir = [...marcados].filter(id => !dentro.has(id)).map(pessoa_id => ({ equipe_id: equipeId, pessoa_id }))
    const remover = [...dentro].filter(id => !marcados.has(id))
    if (inserir.length) {
      const r = await supa.from('cmasm_equipe_membros').insert(inserir).select()
      if (r.error) { aviso(`Erro: ${r.error.message}`); return false }
      MEMBROS = MEMBROS.concat(r.data || [])
    }
    if (remover.length) {
      const r = await supa.from('cmasm_equipe_membros').delete().eq('equipe_id', equipeId).in('pessoa_id', remover)
      if (r.error) { aviso(`Erro: ${r.error.message}`); return false }
      MEMBROS = MEMBROS.filter(m => !(m.equipe_id === equipeId && remover.includes(m.pessoa_id)))
    }
    renderEquipes(); renderEscala()
  })
}

// ── ofícios e turnos ────────────────────────────────────────────────────
function renderOficios() {
  el('view-oficios').innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Ofícios e turnos</div>
        <div class="view-sub">${ESPECIALIDADES.length} especialidade(s) · ${TURNOS.length} turno(s)</div></div>
    </div>

    <div class="panel-card">
      <div class="section-row"><strong>Especialidades</strong>
        ${podeCadastrar() ? '<button class="btn btn-s btn-sm" onclick="abrirEspecialidade(null)">+ Especialidade</button>' : ''}</div>
      <div class="help">O que cada ofício atende é o que responde “quem pode pegar esta OS”.
        Especialidade sem nenhum domínio marcado não habilita ninguém — de propósito: lista vazia
        significando “atende tudo” mandaria o carpinteiro para a OS de refrigeração.</div>
      ${ESPECIALIDADES.length ? `<div class="tbl-wrap" style="margin-top:8px"><table class="tbl">
        <thead><tr><th>Especialidade</th><th>Atende</th><th>Pessoas</th><th></th></tr></thead>
        <tbody>${ESPECIALIDADES.map(e => `<tr>
          <td><strong>${esc(e.nome)}</strong></td>
          <td>${esc(rotuloDominios(e.dominios))}</td>
          <td>${PESSOAS.filter(p => p.especialidade_id === e.id).length}</td>
          <td>${podeCadastrar() ? `<button class="btn btn-s btn-sm" onclick="abrirEspecialidade(${e.id})">Editar</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="help">Nenhuma cadastrada.</div>'}
    </div>

    <div class="panel-card">
      <div class="section-row"><strong>Turnos</strong>
        ${podeCadastrar() ? '<button class="btn btn-s btn-sm" onclick="abrirTurno(null)">+ Turno</button>' : ''}</div>
      <div class="help">Hora de início e fim, não uma duração digitada: o par dá a posição na grade
        <em>e</em> a duração da capacidade, e ninguém escreve “4h” por engano num turno de 08:00 às 13:00.</div>
      ${TURNOS.length ? `<div class="tbl-wrap" style="margin-top:8px"><table class="tbl">
        <thead><tr><th>Turno</th><th>Início</th><th>Fim</th><th>Duração</th><th></th></tr></thead>
        <tbody>${TURNOS.map(t => `<tr>
          <td><strong>${esc(t.nome)}</strong>${t.ativo === false ? ' <span class="pilula pilula-neutro">inativo</span>' : ''}</td>
          <td>${formatarHora(t.hora_inicio)}</td><td>${formatarHora(t.hora_fim)}</td>
          <td>${horasDoTurno(t).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h</td>
          <td>${podeCadastrar() ? `<button class="btn btn-s btn-sm" onclick="abrirTurno(${t.id})">Editar</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="help">Nenhum cadastrado.</div>'}
    </div>
  `
}

function abrirEspecialidade(id) {
  if (!podeCadastrar()) return aviso('Sem permissão')
  const e = id === null ? { nome: '', dominios: [], ativo: true } : ESPECIALIDADES.find(x => x.id === id)
  if (!e) return
  const atuais = new Set(normalizarDominios(e.dominios))
  abrirModal(id === null ? 'Nova especialidade' : `Editar ${e.nome}`, `
    <label>Nome<input id="f-nome" class="control-auto" value="${esc(e.nome)}"/></label>
    <div class="help" style="margin-top:10px">Serviços que este ofício atende:</div>
    <div class="stack">${DOMINIOS.map(d => `<label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" data-dom="${d.chave}"${atuais.has(d.chave) ? ' checked' : ''}/>
      <span>${esc(d.nome)}</span></label>`).join('')}</div>
  `, async () => {
    const nome = el('f-nome').value.trim()
    if (!nome) return aviso('O nome não pode ficar vazio')
    const dominios = [...document.querySelectorAll('[data-dom]')].filter(c => c.checked).map(c => c.dataset.dom)
    const dados = { nome, dominios }
    const r = id === null
      ? await supa.from('cmasm_especialidades').insert(dados).select().single()
      : await supa.from('cmasm_especialidades').update(dados).eq('id', id).select().single()
    if (r.error) { aviso(`Erro: ${r.error.message}`); return false }
    if (id === null) ESPECIALIDADES.push(r.data)
    else ESPECIALIDADES = ESPECIALIDADES.map(x => (x.id === id ? r.data : x))
    ESPECIALIDADES.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
    renderOficios(); renderPessoas(); renderEquipes()
  })
}

function abrirTurno(id) {
  if (!podeCadastrar()) return aviso('Sem permissão')
  const t = id === null ? { nome: '', hora_inicio: '08:00', hora_fim: '12:00', ordem: TURNOS.length + 1, ativo: true }
    : TURNOS.find(x => x.id === id)
  if (!t) return
  abrirModal(id === null ? 'Novo turno' : `Editar ${t.nome}`, `
    <label>Nome<input id="f-nome" class="control-auto" value="${esc(t.nome)}"/></label>
    <div class="fgrid">
      <label>Início<input id="f-ini" class="control-auto" type="time" value="${esc(String(t.hora_inicio).slice(0, 5))}"/></label>
      <label>Fim<input id="f-fim" class="control-auto" type="time" value="${esc(String(t.hora_fim).slice(0, 5))}"/></label>
    </div>
    <div class="frow" style="margin-top:10px">
      <label><input type="checkbox" id="f-ativo"${t.ativo !== false ? ' checked' : ''}/> ativo</label>
    </div>
  `, async () => {
    const nome = el('f-nome').value.trim()
    const ini = el('f-ini').value
    const fim = el('f-fim').value
    if (!nome) return aviso('O nome não pode ficar vazio')
    // Mesma barreira do check do banco, escrita na tela para o usuário
    // ver o erro antes de mandar: turno que termina antes de começar
    // daria duração negativa e subtrairia capacidade em silêncio.
    if (!ini || !fim || fim <= ini) return aviso('O fim do turno precisa ser depois do início')
    const dados = { nome, hora_inicio: ini, hora_fim: fim, ativo: el('f-ativo').checked }
    const r = id === null
      ? await supa.from('cmasm_turnos').insert({ ...dados, ordem: t.ordem }).select().single()
      : await supa.from('cmasm_turnos').update(dados).eq('id', id).select().single()
    if (r.error) { aviso(`Erro: ${r.error.message}`); return false }
    if (id === null) TURNOS.push(r.data)
    else TURNOS = TURNOS.map(x => (x.id === id ? r.data : x))
    TURNOS.sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    renderOficios(); renderEscala()
  })
}

// ── modal ───────────────────────────────────────────────────────────────
let _confirmar = null
function abrirModal(titulo, corpo, aoConfirmar) {
  _confirmar = aoConfirmar
  el('modal-titulo').textContent = titulo
  el('modal-corpo').innerHTML = corpo
  el('overlay').classList.add('ativo')
  el('overlay').style.display = 'flex'
}
function fecharModal() {
  _confirmar = null
  el('overlay').style.display = 'none'
  el('overlay').classList.remove('ativo')
}
async function confirmarModal() {
  if (!_confirmar) return fecharModal()
  const r = await _confirmar()
  if (r !== false) fecharModal()
}

// ── navegação ───────────────────────────────────────────────────────────
function trocarView(id, botao) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  el(`view-${id}`)?.classList.add('active')
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  botao?.classList.add('active')
}

function mostrarApp() {
  el('login-screen').style.display = 'none'
  el('app').style.display = 'block'
  el('user-chip').textContent = USUARIO?.role || '—'
  renderEscala(); renderPlano(); renderPessoas(); renderEquipes(); renderOficios()
}

function mostrarLogin() {
  el('login-screen').style.display = 'flex'
  el('app').style.display = 'none'
}

async function sair() {
  await supa.auth.signOut()
  location.reload()
}

// Handlers em atributo inline (onclick/ondrop) resolvem pelo escopo
// GLOBAL — um módulo ES tem escopo próprio, então sem esta exposição os
// botões da tela não achariam função nenhuma. É o mesmo que mapa/app.js
// faz em exporNoWindow().
function exporNoWindow() {
  Object.assign(window, {
    trocarView, sair, fecharModal, confirmarModal,
    navegarSemana, irParaHoje, aoArrastar, aoSobrepor, aoSair, aoSoltar, aoSoltarFora,
    removerAlocacao, escalarPorFormulario, abrirParametros,
    abrirPessoa, abrirEquipe, abrirMembros, abrirEspecialidade, abrirTurno,
  })
}

async function boot() {
  exporNoWindow()

  // O miolo entra ANTES de aplicarShell, nunca depois: o shell insere a
  // topbar com `afterbegin` e o rodapé com `beforeend`, então o que chega
  // depois dele cai ABAIXO do rodapé. Era o que acontecia — o rodapé
  // desenhava no meio da tela, acima do conteúdo.
  el('app').insertAdjacentHTML('beforeend', `
    <div class="main">
      <div class="view active" id="view-escala"></div>
      <div class="view" id="view-plano"></div>
      <div class="view" id="view-equipes"></div>
      <div class="view" id="view-pessoas"></div>
      <div class="view" id="view-oficios"></div>
    </div>
    <div class="overlay" id="overlay" style="display:none">
      <div class="modal">
        <div class="modal-hd"><strong id="modal-titulo"></strong></div>
        <div class="modal-body" id="modal-corpo"></div>
        <div class="modal-ft">
          <button class="btn btn-s btn-sm" onclick="fecharModal()">Cancelar</button>
          <button class="btn btn-p btn-sm" onclick="confirmarModal()">Salvar</button>
        </div>
      </div>
    </div>
  `)
  aplicarShell({
    nome: 'Equipes',
    accent: '#4a7fc9',
    versao: '1.0',
    navItems: [
      { id: 'escala',  label: 'Escala',   icone: 'agenda',   ativo: true },
      { id: 'plano',   label: 'Plano',    icone: 'plano' },
      { id: 'equipes', label: 'Equipes',  icone: 'empresa' },
      { id: 'pessoas', label: 'Pessoas',  icone: 'chave' },
      { id: 'oficios', label: 'Ofícios',  icone: 'checklist' },
    ],
  })


  try {
    supa = await criarClienteSupabase()
  } catch (erro) {
    // Na tela de LOGIN, nunca no #app: o #app nasce `display:none` e só
    // aparece em mostrarApp(), que nunca roda quando a carga falha — escrever
    // ali deixava o módulo em branco, sem uma palavra dizendo o que houve.
    // Foi assim que o único módulo da plataforma sem mensagem nenhuma passou
    // despercebido. Mesma classe de erro do rodapé desenhado antes do miolo.
    el('login-screen').innerHTML = `
      <div class="callout co-red" style="max-width:560px;margin:40px auto">
        <strong>Falha ao iniciar o módulo Equipes.</strong><br>${esc(erro.message)}
      </div>`
    el('login-screen').style.display = 'flex'
    return
  }

  auth = new Auth(supa, { appNome: 'Equipes', appIcone: '👷' })
  auth.onLogin(async usuario => {
    USUARIO = usuario
    try {
      await carregarTudo()
      await carregarPlano()
    } catch (erro) {
      // Sem a migração 49 as tabelas não existem: a tela DIZ isso, em vez
      // de ficar vazia parecendo que a oficina não tem ninguém.
      el('app').insertAdjacentHTML('afterbegin',
        `<div class="callout co-red"><strong>Não foi possível ler o cadastro de equipes.</strong>
         ${esc(erro.message || '')} — se este módulo acabou de subir, a migração
         <code>49_equipes_schema.sql</code> ainda não foi aplicada.</div>`)
      return
    }
    mostrarApp()
  })
  auth.mount('#login-screen')

  const { data: { session } } = await supa.auth.getSession()
  if (!session) mostrarLogin()
}

boot()
