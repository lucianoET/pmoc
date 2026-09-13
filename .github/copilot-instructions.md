# Instruções Do Workspace PMOC

## Limites

- O único alvo de desenvolvimento é `/home/luc/cmms-monorepo/pmoc-overlay`.
- Tudo fora desse diretório é somente referência: use leitura e busca, sem editar, gerar arquivos, instalar dependências, executar testes, iniciar serviços, rodar migrações ou fazer operações Git.
- Nunca altere `DEV_ERP` nem outro repositório de referência. Se a tarefa exigir isso, pare e peça autorização explícita.

## Regras do projeto

- Use português em identificadores, comentários, interface, commits e documentação.
- Preserve a arquitetura HTML + JavaScript vanilla + Supabase por CDN, sem build e sem npm, salvo aprovação explícita do usuário.
- Para banco, crie uma nova migração numerada e aditiva em `supabase/`; nunca use `DROP` em tabelas ou colunas de produção. Arquive registros em vez de apagá-los.
- Reutilize `shared/` e os padrões dos módulos existentes. O `/refrigeracao` é congelado por decisão; não o altere sem solicitação explícita.
- No `/mapa`, somente `mapa/mapa-dados.js` fala com o Supabase; mantenha os núcleos puros testáveis em Node separados da borda DOM.

## Comandos e referências

- Testes automatizados: `node --test`.
- Servidor local: `python3 -m http.server` na raiz; caminhos raiz-absolutos não funcionam via `file://`.
- Não há build, pacote npm, linter ou formatador configurado. Validações manuais estão em [TESTES.md](../TESTES.md).
- Consulte [CLAUDE.md](../CLAUDE.md) para arquitetura, convenções, decisões e pendências; consulte [README.md](../README.md) para módulos, estrutura e estado do sistema.
- Considere `docs/historico/` arquivado: não o use como fonte atual sem confirmar contra os arquivos acima.