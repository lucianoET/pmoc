-- ═══════════════════════════════════════════════════════════════════
-- 21 — Liga os ativos dos demais módulos aos locais do CMASM
--
-- A Refrigeração já foi ligada pela migração 20 (derivada dos próprios dados).
-- Aqui ficam os módulos cujo campo `local` é texto livre.
--
-- IMPORTANTE — o que NÃO é feito aqui: os textos de local de Elétrica e
-- Fonoclama vieram dos apps legados de demonstração ("CPD", "Sala de
-- servidores", "Bloco Administrativo"…) e não correspondem a nenhum prédio
-- real do CMASM. Só são vinculados os casos com correspondência defensável.
-- O resto fica com local_id nulo e o texto preservado, para ser resolvido na
-- tela — chutar o vínculo seria pior que deixar em branco.
--
-- Sem `begin`/`commit` e sem tabela temporária: o SQL Editor do Supabase
-- executa statement a statement com autocommit, e uma tabela temporária
-- `on commit drop` deixa de existir antes do statement seguinte. Cada comando
-- abaixo é idempotente e pode rodar sozinho.
--
-- Executar depois das migrações 19 e 20.
-- ═══════════════════════════════════════════════════════════════════

-- ── correspondências explícitas, conferidas uma a uma ──
--   'Área do cais'     → Cais Administrativo
--   'Paiol de Munição' → Complexo de Paióis de Armamento
update elet_ativos a
set local_id = l.id
from (values
        ('Área do cais',     'CMASM-LOC-02'),
        ('Paiol de Munição', 'CMASM-PAIOIS')
     ) as m (texto, codigo_local)
join cmasm_locais l on l.codigo = m.codigo_local
where a.local_id is null and a.local = m.texto;

update fono_ativos a
set local_id = l.id
from (values
        ('Área do cais',     'CMASM-LOC-02'),
        ('Paiol de Munição', 'CMASM-PAIOIS')
     ) as m (texto, codigo_local)
join cmasm_locais l on l.codigo = m.codigo_local
where a.local_id is null and a.local = m.texto;

-- ── correspondência automática por nome idêntico (ignorando caixa) ──
update elet_ativos a
set local_id = l.id
from cmasm_locais l
where a.local_id is null and a.local is not null and l.ativo
  and lower(btrim(l.nome)) = lower(btrim(a.local));

update fono_ativos a
set local_id = l.id
from cmasm_locais l
where a.local_id is null and a.local is not null and l.ativo
  and lower(btrim(l.nome)) = lower(btrim(a.local));

-- ── transportes: a frota é da OM inteira, não de uma sala ──
update transp_ativos a
set local_id = 151
where a.local_id is null and upper(btrim(coalesce(a.local, ''))) = 'CMASM';

-- Conferência — o que ficou sem vínculo, para resolver pela tela:
--   select 'eletrica' modulo, local, count(*) from elet_ativos
--    where local_id is null and local is not null group by local
--   union all
--   select 'fonoclama', local, count(*) from fono_ativos
--    where local_id is null and local is not null group by local
--   order by 1, 3 desc;
