// Gate da quick-260829-500 — três atributos técnicos no cadastro de
// /refrigeracao: inverter (rotação variável), redundante (participa de
// arranjo em que só um equipamento do conjunto opera por vez — rodízio
// entre as duas máquinas do paiol, central × splits no F21) e automacao
// (controlável por automação predial).
//
// O que este gate protege, em ordem de gravidade:
//
//   1. Sem a migração 45, NADA muda. `ATRIB_OK` falso mantém as três
//      chaves fora de EQUIP_EDITAVEIS — e é essa lista que alimenta o
//      formulário, o `update` e as colunas da planilha. Um `update`
//      citando uma coluna que não existe derruba TODO salvamento de
//      cadastro, não só os campos novos.
//   2. Ligam as três de uma vez, nunca uma. A sonda empurra a lista
//      inteira num ponto só (D-500-05).
//   3. O ramo de booleano deixou de citar 'refrigPermanente' por nome
//      (D-500-06): quatro booleanos, cinco pontos, uma lista.
//   4. Célula vazia é `null` ("não avaliado"), nunca `false` ("não é") —
//      a diferença entre 148 equipamentos não conferidos e 148
//      equipamentos afirmados como não-inverter.
//
// Mesmo padrão de recorte + sandbox node:vm de
// tests/refrigeracao-planilha.test.js: o código real de
// refrigeracao/index.html roda num sandbox, comportamental.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'refrigeracao', 'index.html'), 'utf8');
const SQL45 = fs.readFileSync(path.join(RAIZ, 'supabase', '45_refrigeracao_atributos_tecnicos.sql'), 'utf8');
const SQL46 = fs.readFileSync(path.join(RAIZ, 'supabase', '46_refrigeracao_atributos_seed.sql'), 'utf8');

const ATRIBUTOS = ['inverter', 'redundante', 'automacao'];

function recorte(marcadorIni, marcadorFim) {
  const ini = HTML.indexOf(marcadorIni);
  const fim = HTML.indexOf(marcadorFim, ini);
  assert.ok(ini > 0 && fim > ini, `recorte "${marcadorIni}" → "${marcadorFim}" não encontrado`);
  return HTML.slice(ini, fim);
}

// `sondaOk` decide o que o stub do Supabase devolve: sem erro (a
// migração 45 rodou) ou com erro (não rodou). É a única diferença entre
// os dois mundos que este gate compara.
function carregarSandbox(sondaOk) {
  const ctx = {
    somenteLeitura() { return false; },
    esc(s) { if (s === null || s === undefined) return ''; return String(s); },
    ctUser: null,
    supa: {
      from() {
        return {
          select() {
            return {
              limit() {
                return Promise.resolve(
                  sondaOk
                    ? { data: [], error: null }
                    : { data: null, error: { message: 'column equipamentos.inverter does not exist' } }
                );
              }
            };
          }
        };
      }
    }
  };
  vm.createContext(ctx);

  vm.runInContext(
    recorte('/* ── ponte de campos de equipamentos ── */', '/* ── ponte de campos de logs_manutencao ── */'),
    ctx
  );
  vm.runInContext(
    recorte('/* ── estado do equipamento: vocabulário OP/INOP/OR ── */', '/* ── alertas: contagem única ── */'),
    ctx
  );
  vm.runInContext(
    recorte('/* ── cadastro do equipamento: formulário e gravação ── */', 'function openEquipForm('),
    ctx
  );
  vm.runInContext(
    recorte('function fichaAtributos(e){', 'function fichaBlocoDados(e){'),
    ctx
  );
  vm.runInContext(
    recorte('/* ── planilha do inventário: núcleo puro ── */', '/* ── planilha do inventário: tela e gravação ── */'),
    ctx
  );

  return ctx;
}

// ── 1. migração 45: a forma que o frontend assume ────────────────────

// Comentário é prosa: `-- sem drop` não é um drop. As proibições valem
// sobre o SQL executável, nunca sobre o texto que o explica.
function semComentarios(sql) { return sql.replace(/^\s*--.*$/gm, ''); }

test('migração 45 cria as três colunas boolean, nuláveis, sem default e sem drop', () => {
  const corpo = semComentarios(SQL45);
  for (const col of ATRIBUTOS) {
    const re = new RegExp(`add column if not exists\\s+${col}\\s+boolean`, 'i');
    assert.ok(re.test(corpo), `migração 45 não declara "${col} boolean" com add column if not exists`);
  }
  assert.ok(!/\bdrop\b/i.test(corpo), 'migração aditiva não pode conter drop');
  assert.ok(!/not\s+null/i.test(corpo), 'as três colunas são nuláveis — null é "não avaliado" (D-500-02)');
  assert.ok(!/\bdefault\b/i.test(corpo),
    'sem default: um default false afirmaria uma conferência que não aconteceu (D-500-02)');
});

test('seed 46 só marca true, nunca false, e não inventa automacao', () => {
  const corpo = semComentarios(SQL46);
  assert.ok(/set\s+inverter\s*=\s*true/i.test(corpo), 'seed não marca inverter');
  assert.ok(/set\s+redundante\s*=\s*true/i.test(corpo), 'seed não marca redundante');
  assert.ok(!/=\s*false/i.test(corpo), 'o seed nunca escreve false — ausência de marca é "não avaliado"');
  assert.ok(!/set\s+automacao/i.test(corpo), 'automacao não foi levantada em campo — não pode ser semeada');
  assert.ok(!/\bdrop\b|\bdelete\b/i.test(corpo), 'seed não apaga nada');
});

// ── 2. sem a migração: byte a byte como antes ────────────────────────

test('sonda com erro: as três ficam fora de EQUIP_EDITAVEIS e da planilha', async () => {
  const ctx = carregarSandbox(false);
  assert.equal(ctx.ATRIB_OK, false, 'ATRIB_OK nasce falso');
  const antes = ctx.EQUIP_EDITAVEIS.slice();

  const ok = await ctx.atribSondarEsquema();
  assert.equal(ok, false);
  assert.equal(ctx.ATRIB_OK, false);
  assert.equal(JSON.stringify(ctx.EQUIP_EDITAVEIS), JSON.stringify(antes),
    'sem a migração 45 a lista de campos editáveis não pode mudar');

  const rotulosPlanilha = ctx.planilhaColunas().map(c => c.chave);
  for (const k of ATRIBUTOS) {
    assert.ok(!rotulosPlanilha.includes(k), `"${k}" não pode aparecer na planilha sem a migração`);
  }
});

test('sem sonda, equipParaDb descarta os três — nenhum update cita coluna ausente', () => {
  const ctx = carregarSandbox(false);
  const db = ctx.equipParaDb({ area: 'AZUL', inverter: true, redundante: true, automacao: true });
  assert.equal(db.area, 'AZUL', 'os campos de sempre continuam gravando');
  for (const k of ATRIBUTOS) {
    assert.ok(!Object.prototype.hasOwnProperty.call(db, k),
      `"${k}" chegou no payload sem a migração — todo salvamento de cadastro quebraria`);
  }
});

// ── 3. com a migração: as três ligam juntas ──────────────────────────

test('sonda ok: as três entram de uma vez, no fim da lista, e a planilha ganha as três colunas', async () => {
  const ctx = carregarSandbox(true);
  const antes = ctx.EQUIP_EDITAVEIS.length;

  const ok = await ctx.atribSondarEsquema();
  assert.equal(ok, true);
  assert.equal(ctx.ATRIB_OK, true);
  assert.equal(ctx.EQUIP_EDITAVEIS.length, antes + 3);
  assert.equal(JSON.stringify(ctx.EQUIP_EDITAVEIS.slice(-3)), JSON.stringify(ATRIBUTOS),
    'as três entram juntas e na ordem de EQUIP_ATRIBUTOS');

  const cols = ctx.planilhaColunas();
  const chaves = cols.map(c => c.chave);
  for (const k of ATRIBUTOS) assert.ok(chaves.includes(k), `"${k}" não virou coluna da planilha`);
  const rotulos = cols.filter(c => ATRIBUTOS.includes(c.chave)).map(c => c.rotulo);
  assert.equal(JSON.stringify(rotulos), JSON.stringify(['Inverter', 'Redundante', 'Automação']));
});

test('sonda é idempotente — chamar duas vezes não duplica os campos', async () => {
  const ctx = carregarSandbox(true);
  await ctx.atribSondarEsquema();
  const depoisDaPrimeira = ctx.EQUIP_EDITAVEIS.length;
  await ctx.atribSondarEsquema();
  assert.equal(ctx.EQUIP_EDITAVEIS.length, depoisDaPrimeira);
});

test('com sonda, equipParaDb grava os três — inclusive false, que não é vazio', async () => {
  const ctx = carregarSandbox(true);
  await ctx.atribSondarEsquema();
  const db = ctx.equipParaDb({ inverter: true, redundante: false, automacao: null });
  assert.equal(db.inverter, true);
  assert.equal(db.redundante, false, 'false é um valor, não célula vazia');
  assert.equal(db.automacao, null);
});

test('CAMPOS_EQUIP mapeia as três com o mesmo nome de coluna da migração 45', () => {
  const ctx = carregarSandbox(false);
  for (const k of ATRIBUTOS) {
    assert.equal(ctx.CAMPOS_EQUIP[k], k, `CAMPOS_EQUIP.${k} deveria apontar para a coluna "${k}"`);
  }
});

// ── 4. o ramo de booleano deixou de citar uma chave por nome ─────────

test('EQUIP_BOOLEANOS são os quatro, e refrigPermanente continua o primeiro', () => {
  const ctx = carregarSandbox(false);
  assert.equal(JSON.stringify(ctx.EQUIP_BOOLEANOS),
    JSON.stringify(['refrigPermanente'].concat(ATRIBUTOS)));
});

test('planilhaValor serializa os quatro booleanos igual: SIM / NÃO / vazio', () => {
  const ctx = carregarSandbox(false);
  for (const k of ctx.EQUIP_BOOLEANOS) {
    assert.equal(ctx.planilhaValor(k, { [k]: true }), 'SIM', k);
    assert.equal(ctx.planilhaValor(k, { [k]: false }), 'NÃO', k);
    assert.equal(ctx.planilhaValor(k, { [k]: null }), '', k);
    assert.equal(ctx.planilhaValor(k, {}), '', `${k} não avaliado sai vazio, não "NÃO"`);
  }
});

// Objeto devolvido de dentro do node:vm tem prototype de outro realm —
// deepStrictEqual contra um literal daqui falha mesmo com o conteúdo
// idêntico (armadilha documentada em refrigeracao-encerramento-os).
function lido(ctx, chave, texto, esperado, nota) {
  const r = ctx.celulaParaValor(chave, texto);
  assert.equal(r.ok, true, `${chave} ← "${texto}" foi recusado`);
  assert.equal(r.valor, esperado, `${chave} ← "${texto}"${nota ? ' — ' + nota : ''}`);
}

test('celulaParaValor: X vale SIM nos quatro, vazio vale null e lixo é recusado', () => {
  const ctx = carregarSandbox(false);
  for (const k of ctx.EQUIP_BOOLEANOS) {
    for (const marca of ['X', 'x', 'SIM', 'sim', '1', 'TRUE']) {
      lido(ctx, k, marca, true);
    }
    for (const nao of ['NÃO', 'NAO', 'nao', '0', 'FALSE']) {
      lido(ctx, k, nao, false);
    }
    lido(ctx, k, '', null, 'célula vazia é "não avaliado", nunca false');
    lido(ctx, k, '   ', null, 'só espaço é vazio');
    const ruim = ctx.celulaParaValor(k, 'talvez');
    assert.equal(ruim.ok, false, `${k}: valor fora do vocabulário tem de ser recusado`);
  }
});

test('ciclo fechado: o que planilhaValor escreve, celulaParaValor lê de volta igual', () => {
  const ctx = carregarSandbox(false);
  for (const k of ctx.EQUIP_BOOLEANOS) {
    for (const v of [true, false, null]) {
      const serial = ctx.planilhaValor(k, { [k]: v });
      const lido = ctx.celulaParaValor(k, serial);
      assert.equal(lido.ok, true);
      assert.equal(lido.valor, v, `${k}: ${v} → "${serial}" → ${lido.valor}`);
    }
  }
});

// ── 5. tela: formulário e ficha ──────────────────────────────────────

test('campoEquipForm devolve checkbox para os três, marcado conforme o valor', () => {
  const ctx = carregarSandbox(true);
  const marcado = ctx.campoEquipForm('inverter', { inverter: true });
  assert.ok(marcado.includes('type="checkbox"'), 'atributo técnico é checkbox, não texto');
  assert.ok(marcado.includes('id="equip-inverter"'));
  assert.ok(marcado.includes(' checked'), 'valor true tem de vir marcado');
  assert.ok(marcado.includes('Inverter'), 'o rótulo da tela vem de EQUIP_ROTULOS');

  const vazio = ctx.campoEquipForm('automacao', {});
  assert.ok(vazio.includes('type="checkbox"'));
  assert.ok(!vazio.includes(' checked'), 'não avaliado não pode nascer marcado');
});

test('a caixa de Redundante carrega a linha de ajuda; as outras três não', () => {
  const ctx = carregarSandbox(true);
  const red = ctx.campoEquipForm('redundante', {});
  assert.ok(/rod[íi]zio/i.test(red), 'sem explicar rodízio, a palavra "redundante" diria "esta é a reserva"');
  assert.ok(red.includes('type="checkbox"'));
  // As outras três continuam byte a byte como antes desta task.
  for (const k of ['refrigPermanente', 'inverter', 'automacao']) {
    const html = ctx.campoEquipForm(k, {});
    assert.ok(html.startsWith('<label class="chk-item"'), `${k} ganhou embrulho que não devia`);
  }
});

test('fichaAtributos: nada sem a sonda; três estados com ela', () => {
  const ctx = carregarSandbox(true);
  ctx.ATRIB_OK = false;
  assert.equal(ctx.fichaAtributos({ inverter: true }), '',
    'sem a migração 45 a ficha não ganha três linhas dizendo "—" para sempre');

  ctx.ATRIB_OK = true;
  const html = ctx.fichaAtributos({ inverter: true, redundante: false });
  assert.equal((html.match(/class="dfield"/g) || []).length, 3, 'uma linha por atributo');
  assert.ok(html.includes('>Sim<'), 'true aparece como Sim');
  assert.ok(html.includes('>Não<'), 'false aparece como Não');
  assert.ok(html.includes('>—<'), 'não avaliado aparece como travessão, não como Não');
});
