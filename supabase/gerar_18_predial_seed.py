"""Gera supabase/18_predial_seed.sql a partir do legado xPredial (somente leitura).

Fontes (DEV_ERP, read-only):
  database/seed_normas.sql        -> pred_normas
  database/seed_locais_cmasm.sql  -> pred_locais
  create_db.py TEMPLATES / ITEMS  -> pred_checklist_templates / pred_checklist_itens
"""
import ast
import pathlib
import re

LEGADO = pathlib.Path('/home/luc/DEV_ERP/cmms-predial')
SAIDA = pathlib.Path('/home/luc/Downloads/pmoc-overlay/supabase/18_predial_seed.sql')


def statements(texto):
    """Devolve cada INSERT do arquivo SQLite, sem o ponto e vírgula final."""
    atual = []
    for linha in texto.splitlines():
        if not atual and not linha.strip().upper().startswith('INSERT'):
            continue
        atual.append(linha)
        if linha.rstrip().endswith(';'):
            yield '\n'.join(atual).rstrip().rstrip(';')
            atual = []


def converter(texto, tabela_origem, tabela_destino, conflito):
    saida = []
    for st in statements(texto):
        st = re.sub(r'INSERT\s+OR\s+IGNORE\s+INTO\s+' + tabela_origem,
                    f'insert into {tabela_destino}', st, flags=re.I)
        saida.append(f'{st}\non conflict {conflito} do nothing;')
    return saida


def sql_str(valor):
    if valor is None:
        return 'null'
    return "'" + str(valor).replace("'", "''") + "'"


def main():
    normas = converter((LEGADO / 'database/seed_normas.sql').read_text(),
                       'normas', 'pred_normas', '(codigo)')
    locais = converter((LEGADO / 'database/seed_locais_cmasm.sql').read_text(),
                       'locais', 'pred_locais', '(id)')

    arvore = ast.parse((LEGADO / 'create_db.py').read_text())
    dados = {}
    for no in arvore.body:
        if isinstance(no, ast.Assign) and getattr(no.targets[0], 'id', '') in ('TEMPLATES', 'ITEMS'):
            dados[no.targets[0].id] = ast.literal_eval(no.value)

    templates = ',\n'.join(
        '  (' + ', '.join(sql_str(c) if i else str(c) for i, c in enumerate(linha)) + ')'
        for linha in dados['TEMPLATES']
    )
    itens = ',\n'.join(
        f'  ({t}, {sql_str(sis)}, {sql_str(sub)}, {sql_str(desc)}, {ordem})'
        for t, sis, sub, desc, ordem in dados['ITEMS']
    )

    n_normas = len(re.findall(r'^  \(', '\n'.join(normas), re.M))
    n_locais = len(re.findall(r'^\(\d+,', '\n'.join(locais), re.M))

    partes = [
        '-- ═══════════════════════════════════════════════════════════════════',
        '-- 18 — PMOC Predial — carga inicial vinda do app legado xPredial',
        '-- GERADO automaticamente a partir de DEV_ERP/cmms-predial:',
        '--   database/seed_normas.sql · database/seed_locais_cmasm.sql · create_db.py',
        '-- Não editar à mão — regerar com o script de importação.',
        '-- Idempotente: reexecutar não duplica.',
        '-- ═══════════════════════════════════════════════════════════════════',
        '',
        'begin;',
        '',
        '-- ── normas ──',
        *normas,
        '',
        '-- ── locais do CMASM (ids preservados do legado; raiz = 151) ──',
        *locais,
        '',
        '-- ── templates de checklist ──',
        'insert into pred_checklist_templates (id, nome, tipo_local, descricao, norma_ref) values',
        templates,
        'on conflict (id) do nothing;',
        '',
        '-- ── itens dos templates ──',
        'insert into pred_checklist_itens (template_id, sistema, subsistema, descricao, ordem) values',
        itens,
        'on conflict (template_id, sistema, descricao) do nothing;',
        '',
        '-- ── acerta as sequences, já que os ids vieram do legado ──',
        "select setval(pg_get_serial_sequence('pred_locais', 'id'), coalesce(max(id), 1)) from pred_locais;",
        "select setval(pg_get_serial_sequence('pred_checklist_templates', 'id'), coalesce(max(id), 1)) from pred_checklist_templates;",
        '',
        'commit;',
        '',
        '-- Conferência:',
        f'--   select count(*) from pred_normas;               -- {n_normas}',
        f'--   select count(*) from pred_locais;               -- {n_locais}',
        f'--   select count(*) from pred_checklist_templates;  -- {len(dados["TEMPLATES"])}',
        f'--   select count(*) from pred_checklist_itens;      -- {len(dados["ITEMS"])}',
        '',
    ]
    SAIDA.write_text('\n'.join(partes))
    print('escrito', SAIDA, len(dados['TEMPLATES']), 'templates,', len(dados['ITEMS']), 'itens')


main()
