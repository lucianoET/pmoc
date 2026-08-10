#!/usr/bin/env python3
"""Aplica arquivos .sql desta pasta no Postgres do Supabase.

Não guarda credencial: lê a connection string de SUPABASE_DB_URL.
Pegue em Supabase → Project Settings → Database → Connection string → Session pooler.

    export SUPABASE_DB_URL='postgresql://...'
    python3 supabase/aplicar.py 19_cmasm_locais_unificado.sql 20_cmasm_locais_predios.sql

Sem argumentos, apenas testa a conexão e mostra o estado das tabelas do PMOC.
Cada arquivo roda numa transação: se falhar no meio, nada daquele arquivo é aplicado.
"""
import os
import pathlib
import sys

import psycopg

PASTA = pathlib.Path(__file__).parent

TABELAS_CONFERENCIA = [
    'equipamentos', 'maq_ativos', 'transp_ativos', 'elet_ativos', 'fono_ativos',
    'pred_locais', 'cmasm_locais', 'cmasm_estrutura', 'pred_checklist_itens',
]


def url():
    valor = os.environ.get('SUPABASE_DB_URL')
    if not valor:
        sys.exit('Defina SUPABASE_DB_URL antes de rodar (veja o cabeçalho deste arquivo).')
    return valor


def estado(conn):
    print('\nEstado atual:')
    for tabela in TABELAS_CONFERENCIA:
        with conn.cursor() as cur:
            cur.execute('select to_regclass(%s)', (f'public.{tabela}',))
            if cur.fetchone()[0] is None:
                print(f'  {tabela:<22} —')
                continue
            cur.execute(f'select count(*) from {tabela}')
            print(f'  {tabela:<22} {cur.fetchone()[0]}')


def aplicar(conn, nome):
    caminho = PASTA / nome
    if not caminho.exists():
        sys.exit(f'Arquivo não encontrado: {caminho}')

    print(f'\n▶ {nome}')
    with conn.cursor() as cur:
        cur.execute(caminho.read_text())
    conn.commit()
    print(f'✓ {nome} aplicado')


def main():
    arquivos = sys.argv[1:]
    with psycopg.connect(url(), autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute('select current_database(), version()')
            banco, versao = cur.fetchone()
        print(f'Conectado em {banco} · {versao.split(",")[0]}')

        for nome in arquivos:
            try:
                aplicar(conn, nome)
            except Exception as erro:
                conn.rollback()
                sys.exit(f'✗ {nome} falhou (nada foi aplicado deste arquivo):\n  {erro}')

        estado(conn)


if __name__ == '__main__':
    main()
