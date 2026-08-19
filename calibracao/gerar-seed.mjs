// ══════════════════════════════════════════════════════════════════
// Gerador do seed da migração 36, a partir das constantes que já estão
// em calibracao/index.html.
//
// Rodado à mão, uma vez, como mapa/gerar-planta.mjs — NÃO é passo de
// build e não roda no deploy:
//
//     node calibracao/gerar-seed.mjs > supabase/36_calibracao_seed.sql
//
// Existe porque o seed são ~60 linhas de dado real (patrimônio,
// certificado, data, custo) que ninguém transcreve à mão sem errar.
// Ler do próprio arquivo que hoje é a fonte da verdade elimina a classe
// inteira de erro de digitação.
//
// Sem dependências, sem rede.
// ══════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FONTE = join(AQUI, 'index.html');

// ── extração ──
// Acha `const NOME = ` e devolve o literal que vem depois, equilibrando
// colchetes e chaves. Ignora os que aparecem dentro de string para não
// se perder num campo tipo "MANÔMETRO ANALÓGICO [BACS]".
function extrair(src, nome) {
  const m = new RegExp(`const\\s+${nome}\\s*=\\s*`).exec(src);
  if (!m) throw new Error(`constante ${nome} não encontrada em index.html`);
  let i = m.index + m[0].length;
  const abre = src[i];
  const fecha = abre === '[' ? ']' : '}';
  if (abre !== '[' && abre !== '{') throw new Error(`${nome} não é literal de array/objeto`);

  let nivel = 0, aspas = null, escapa = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (escapa) { escapa = false; continue; }
    if (aspas) {
      if (c === '\\') escapa = true;
      else if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { aspas = c; continue; }
    if (c === abre) nivel++;
    else if (c === fecha) {
      nivel--;
      if (nivel === 0) {
        // eslint-disable-next-line no-new-func
        return new Function(`return (${src.slice(i, j + 1)})`)();
      }
    }
  }
  throw new Error(`literal de ${nome} não fecha`);
}

// ── literais SQL ──
const txt = v => {
  if (v === null || v === undefined || v === '') return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
};

const num = v => {
  if (v === null || v === undefined || v === '') return 'null';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : 'null';
};

const bool = v => (v === false ? 'false' : 'true');

// dd/mm/aaaa → date. Qualquer coisa que não case vira null em vez de
// virar uma data errada em silêncio.
const data = v => {
  if (!v) return 'null';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v).trim());
  if (!m) {
    process.stderr.write(`aviso: data ignorada por formato inesperado: ${v}\n`);
    return 'null';
  }
  return `'${m[3]}-${m[2]}-${m[1]}'`;
};

const arr = v => {
  if (!Array.isArray(v) || !v.length) return `'{}'`;
  return `array[${v.map(txt).join(', ')}]`;
};

const json = v => `'${JSON.stringify(v ?? []).replace(/'/g, "''")}'::jsonb`;

// ── mapa campo do app → coluna ──
// Só o que a migração 35 declara. A ordem aqui é a ordem do INSERT.
const LABS = [
  ['id', 'id', txt], ['code', 'code', txt], ['nome', 'nome', txt],
  ['tipo', 'tipo', txt], ['acred', 'acred', txt], ['esp', 'esp', arr],
  ['obs', 'obs', txt], ['ativo', 'ativo', bool],
];

const EQS = [
  ['id', 'id', txt], ['sn', 'sn', txt], ['pat', 'pat', txt],
  ['cat', 'cat', txt], ['tipo', 'tipo', txt], ['fab', 'fab', txt],
  ['mod', 'mod', txt], ['faixa', 'faixa', txt], ['div', 'div', txt],
  ['labId', 'lab_id', txt], ['per', 'per', num],
  ['ult', 'ult', data], ['prox', 'prox', data], ['cert', 'cert', txt],
  ['status', 'status', txt],
  ['cC', 'custo_cal', num], ['cR', 'custo_rep', num],
  ['rest', 'rest', txt], ['obs', 'obs', txt],
  ['local', 'local', txt], ['grandeza', 'grandeza', txt],
  ['resol', 'resol', txt], ['classe', 'classe', txt], ['ema', 'ema', txt],
  ['uCal', 'u_cal', txt], ['fw', 'fw', txt], ['verifInt', 'verif_int', txt],
  ['ativo', 'ativo', bool],
];

const PSS = [
  ['id', 'id', txt], ['num', 'num', txt], ['eqId', 'eq_id', txt],
  ['labId', 'lab_id', txt], ['tipo', 'tipo', txt], ['status', 'status', txt],
  ['emi', 'emi', data], ['env', 'env', data], ['cal', 'cal', data],
  ['ret', 'ret', data], ['cert', 'cert', txt], ['res', 'res', txt],
  ['vM', 'valor_prev', num], ['vE', 'valor_exec', num],
  ['nf', 'nf', txt], ['ctr', 'ctr', txt],
  ['emi_nm', 'emitente', txt], ['obs', 'obs', txt],
];

const LOTES = [
  ['id', 'id', txt], ['code', 'code', txt], ['desc', 'descricao', txt],
  ['contrato', 'contrato', txt], ['status', 'status', txt],
  ['data', 'data', data], ['itens', 'itens', json],
];

function bloco(tabela, mapa, linhas, chave) {
  if (!linhas.length) return '';
  const cols = mapa.map(([, c]) => c).join(', ');
  const vals = linhas
    .map(o => '  (' + mapa.map(([campo, , fmt]) => fmt(o[campo])).join(', ') + ')')
    .join(',\n');
  return `insert into ${tabela} (${cols}) values\n${vals}\non conflict (${chave}) do nothing;\n`;
}

// ── geração ──
const src = readFileSync(FONTE, 'utf8');
const labs = extrair(src, 'LABS');
const eqs = extrair(src, 'EQS');
const pss = extrair(src, 'PS_INIT');
const lotes = extrair(src, 'LOTES_INIT');
const catalogo = extrair(src, 'CATALOG_DEFAULT');

// O catálogo é um mapa tipo → lista de opções; vira linhas com `ord`
// guardando a posição que a opção tinha na lista.
const catLinhas = [];
for (const [equipTipo, opcoes] of Object.entries(catalogo)) {
  opcoes.forEach((o, i) => {
    catLinhas.push(
      `  (${txt(equipTipo)}, ${i}, ${txt(o.forn)}, ${txt(o.contrato)}, ` +
      `${num(o.preco)}, ${txt(o.item)}, ${txt(o.tipo)})`
    );
  });
}

// Conferência: um seed que sai menor do que a fonte é erro de extração,
// não é "quase certo". Falha alto em vez de gerar SQL incompleto.
const esperado = { labs: 8, eqs: 38, pss: 12, lotes: 2 };
for (const [nome, n] of Object.entries(esperado)) {
  const real = { labs, eqs, pss, lotes }[nome].length;
  if (real !== n) {
    throw new Error(`${nome}: extraí ${real} registros, esperava ${n} — confira index.html`);
  }
}

const saida = `-- ══════════════════════════════════════════════════════════════════
-- 36 — Calibração: carga inicial
--
-- GERADO por \`node calibracao/gerar-seed.mjs\` a partir das constantes
-- LABS, EQS, PS_INIT, LOTES_INIT e CATALOG_DEFAULT de
-- calibracao/index.html. Não edite à mão: rode o gerador de novo.
--
-- É o estado de fábrica que o módulo mostrava a quem abrisse com o
-- localStorage vazio. Quem já vinha usando o módulo tem dados mais
-- recentes no próprio navegador — a tela Dados exporta o JSON e a
-- importação recoloca por cima destes, agora no banco.
--
-- \`on conflict do nothing\` em tudo: reaplicar não duplica nem
-- sobrescreve trabalho já feito no banco.
-- ══════════════════════════════════════════════════════════════════

${bloco('cal_labs', LABS, labs, 'id')}
${bloco('cal_equipamentos', EQS, eqs, 'id')}
${bloco('cal_ps', PSS, pss, 'id')}
${bloco('cal_lotes', LOTES, lotes, 'id')}
insert into cal_catalogo (equip_tipo, ord, forn, contrato, preco, item, tipo) values
${catLinhas.join(',\n')}
on conflict (equip_tipo, ord) do nothing;
`;

process.stdout.write(saida);
process.stderr.write(
  `ok: ${labs.length} labs, ${eqs.length} equipamentos, ${pss.length} PS, ` +
  `${lotes.length} lotes, ${catLinhas.length} opções de catálogo\n`
);
