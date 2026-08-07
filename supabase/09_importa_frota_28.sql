-- ═══════════════════════════════════════════════════════════
-- 09 — Importa a frota completa do backup CMASM Gestão v2 (28 máquinas)
-- O seed 02 criou 1 unidade por tipo; o backup de 07/08/2026 mostra a
-- frota real: 10× FS220, 8× GAR, 3× COY, 4× TS114, 1× MS650/LGT/SOL.
-- Este script adiciona as 21 unidades que faltam (clonando os atributos
-- do tipo). Horímetros zerados, como no backup. Idempotente.
-- Rodar no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════
insert into maq_ativos (codigo,tipo_modelo,nome,categoria,fabricante,modelo,cor,emoji,
                        uso_atual,unidade_uso,status,valor_aquisicao,vida_util_h,valor_residual,data_aquisicao)
select
  m.tipo_modelo || '-' || lpad(n::text, 2, '0'),
  m.tipo_modelo,
  m.nome, m.categoria, m.fabricante, m.modelo, m.cor, m.emoji,
  0, 'h', 'operante', m.valor_aquisicao, m.vida_util_h, m.valor_residual, m.data_aquisicao
from (values ('FS220',10), ('GAR',8), ('COY',3), ('TS114',4)) as f(tipo, total)
join maq_ativos m on m.codigo = f.tipo || '-01'
cross join lateral generate_series(2, f.total) as n
on conflict (codigo) do nothing;
