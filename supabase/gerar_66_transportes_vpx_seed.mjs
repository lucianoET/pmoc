// Gera 66_transportes_vpx_seed.sql a partir do Plano_Manutencao_VPX_CMASM.json.
// Rodado à mão uma vez (como calibracao/gerar-seed.mjs) — não é passo de build.
//   node supabase/gerar_66_transportes_vpx_seed.mjs ~/Downloads/Plano_Manutencao_VPX_CMASM.json > supabase/66_transportes_vpx_seed.sql
import fs from 'node:fs'

const MODELO = 'CARRO ELETRICO' // transp_ativos.tipo_modelo do VTR-024
const plano = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const n = (v) => (v == null ? 'null' : String(v))

// Diferença máxima ENTRE pontos do mesmo item (critério escrito no JSON, mas só
// em prosa): 0,10 V entre baterias, 0,030 g/cm³ entre elementos.
const difMax = (i) => (i.registro_por === 'bateria' && i.unidade === 'V' ? 0.10
  : i.registro_por === 'elemento' && i.unidade === 'g/cm³' ? 0.030 : null)

const out = [
  '-- 66 — Seed do plano de manutenção do Unipac/Jacto VPX (VTR-024, tipo_modelo CARRO ELETRICO).',
  '-- Gerado por supabase/gerar_66_transportes_vpx_seed.mjs a partir de Plano_Manutencao_VPX_CMASM.json.',
  '-- Idempotente: on conflict do nothing. Pressão de pneu e torques ficam sem faixa até o manual da Unipac.',
  '',
]
plano.rotinas.forEach((r, ri) => {
  out.push(`insert into transp_rotinas (tipo_modelo, codigo, nome, intervalo_dias, responsavel, tipo_os, ordem)`)
  out.push(`values (${q(MODELO)}, ${q(r.id)}, ${q(r.nome)}, ${r.intervalo_dias}, ${q(r.responsavel)}, ${q(r.intervalo_dias === 1 ? 'inspecao' : 'preventiva')}, ${ri})`)
  out.push(`on conflict (tipo_modelo, codigo) do nothing;`, '')
  out.push(`insert into transp_rotina_itens (rotina_id, ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)`)
  out.push(`select r.id, v.ordem, v.descricao, v.tipo, v.unidade, v.minimo, v.maximo, v.dif_max, v.criterio, v.acao_se_nc, v.sistema, v.registro_por`)
  out.push(`from transp_rotinas r, (values`)
  out.push(r.itens.map((i, k) => `  (${k + 1}, ${q(i.descricao)}, ${q(i.tipo)}, ${q(i.unidade)}::text, ${n(i.min)}::numeric, ${n(i.max)}::numeric, ${n(difMax(i))}::numeric, ${q(i.criterio)}, ${q(i.acao_se_nc)}, ${q(i.sistema)}, ${q(i.registro_por)}::text)`).join(',\n'))
  out.push(`) as v(ordem, descricao, tipo, unidade, minimo, maximo, dif_max, criterio, acao_se_nc, sistema, registro_por)`)
  out.push(`where r.tipo_modelo = ${q(MODELO)} and r.codigo = ${q(r.id)}`)
  out.push(`on conflict (rotina_id, ordem) do nothing;`, '')
})
console.log(out.join('\n'))
