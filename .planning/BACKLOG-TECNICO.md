# Roadmap de Melhorias do PMOC

> Registrado em 2026-08-08 após revisão de código, políticas SQL e inspeção das interfaces em navegador desktop e móvel.

## Objetivo

Endurecer os módulos PMOC Refrigeração e PMOC Máquinas para uso operacional, priorizando autorização real no banco, integridade dos registros e rastreabilidade antes de melhorias visuais ou expansão funcional.

## Estado observado

- O frontend aplica permissões por papel, mas as políticas RLS permitem escrita ampla para qualquer usuário autenticado.
- As contas de função foram criadas com uma senha inicial compartilhada, que precisa ser substituída antes do uso operacional.
- O modo Livre consulta dados por políticas públicas; em Máquinas, ações de escrita continuam visíveis para o observador.
- A conclusão de uma OS de Máquinas altera OS, horímetro, uso e estoque em chamadas independentes, sem transação.
- Refrigeração exibe histórico de auditoria, mas as mudanças feitas pelo frontend não geram eventos automaticamente.
- A certificação pode encerrar uma OS mesmo com divergência entre valor orçado e composição da ata.
- Máquinas insere valores vindos do banco em `innerHTML` sem escape consistente.
- O bucket `os-fotos` é público.
- Refrigeração funciona bem no celular, mas precisa de acessibilidade e melhor aproveitamento de desktop.
- Máquinas apresenta tabelas largas e oito abas horizontais no celular.
- Em 2026-08-08, o Supabase retornou 28 máquinas, enquanto o README ainda informa 7.

## Princípios de execução

1. Segurança e integridade vêm antes de aparência.
2. Migrações SQL são aditivas; nunca usar `DROP`.
3. Alterações de RLS devem ser verificadas com cada papel e com acesso anônimo antes do deploy.
4. Operações financeiras e de estoque devem ser atômicas e auditáveis.
5. Cada fase deve terminar com uma versão utilizável e um checklist manual atualizado em `TESTES.md`.
6. Não ampliar o escopo para os novos módulos até concluir as fases 0 a 2.

## Fase 0 — Contenção imediata

**Prioridade:** P0  
**Meta:** reduzir o risco operacional sem depender de refatoração do frontend.

- [ ] Trocar todas as senhas iniciais das contas de função no Supabase Auth.
- [ ] Confirmar se as contas de função continuarão temporariamente compartilhadas ou se já serão substituídas por contas pessoais.
- [ ] Exportar um inventário das políticas RLS atuais e guardar evidência antes da alteração.
- [ ] Revisar quais dados podem ser públicos no modo Livre.
- [ ] Tornar o bucket `os-fotos` privado e planejar URLs assinadas.
- [ ] Registrar os responsáveis autorizados para `admin`, `gestor`, `tecnico`, `empresa`, `executor` e `fiscal`.

### Critérios de aceite da fase 0

- Nenhuma conta usa `cmasm2026` ou outra senha inicial conhecida.
- Existe uma matriz papel × ação aprovada pelo responsável do sistema.
- Está definido quais campos podem aparecer sem autenticação.
- Há backup ou exportação suficiente para restaurar as políticas anteriores.

## Fase 1 — Autorização real no Supabase

**Prioridade:** P0  
**Meta:** fazer o banco aplicar as mesmas permissões que a interface comunica.

### Arquivos previstos da fase 1

- Criar `supabase/10_rls_por_papel.sql`.
- Atualizar `TESTES.md` com testes por papel e acesso anônimo.
- Ajustar `refrigeracao/index.html` e `maquinas/app.js` somente se a nova RLS exigir tratamento de erro ou ocultação de ações.

### Entregas da fase 1

- [ ] Criar helper SQL seguro para obter o papel ativo a partir de `auth.uid()` e `usuarios.auth_id`.
- [ ] Restringir escrita nas tabelas `maq_*` conforme a matriz aprovada.
- [ ] Restringir cada etapa da contratação ao papel responsável.
- [ ] Proibir alteração e exclusão de eventos de auditoria pelo cliente.
- [ ] Substituir leitura pública ampla por views ou políticas com os campos estritamente necessários ao modo Livre.
- [ ] Aplicar política de armazenamento privado a `os-fotos`.
- [ ] Exibir uma faixa persistente de “Somente leitura” e remover ações de escrita no modo Livre de Máquinas.

### Critérios de aceite da fase 1

- Chamadas diretas ao Supabase não permitem que Técnico aprove orçamento, Empresa fiscalize ou Fiscal certifique.
- Usuário anônimo não lê dados contratuais, fiscais, pessoais ou fotos.
- Gestor, Técnico, Fiscal e Empresa completam apenas seus fluxos autorizados.
- Tentativas negadas retornam mensagens compreensíveis na interface.

## Fase 2 — Transações, auditoria e regras críticas

**Prioridade:** P1  
**Meta:** impedir estados parciais e produzir trilha confiável de alterações.

### Arquivos previstos da fase 2

- Criar `supabase/11_operacoes_atomicas_auditoria.sql`.
- Modificar `maquinas/app.js` para usar RPC transacional.
- Modificar `refrigeracao/index.html` para validar reconciliação e mostrar revisão final.
- Atualizar `TESTES.md`.

### Entregas da fase 2

- [ ] Criar RPC transacional para concluir OS de Máquinas, atualizando OS, horímetro, uso, movimentos e estoque de forma atômica.
- [ ] Rejeitar delta negativo, horímetro regressivo, quantidade inválida e estoque insuficiente conforme a regra definida.
- [ ] Vincular movimentos de estoque à OS criada.
- [ ] Criar triggers de auditoria para mudanças de estado e campos críticos da contratação.
- [ ] Registrar `auth.uid()`, usuário, papel, valores anterior/novo e horário nos eventos.
- [ ] Impedir alteração dos eventos pelo frontend.
- [ ] Definir tolerância de reconciliação entre orçamento, composição, NE e NF.
- [ ] Bloquear certificação fora da tolerância ou exigir justificativa e aprovação adicional.
- [ ] Adicionar uma tela-resumo antes de concluir manutenção ou certificar contratação.

### Critérios de aceite da fase 2

- Falha em qualquer etapa da conclusão de OS não deixa alterações parciais.
- Toda transição contratual aparece automaticamente no histórico.
- O responsável por cada ação é identificável de forma inequívoca.
- Não é possível certificar uma divergência financeira sem cumprir a regra de exceção.

## Fase 3 — Segurança do frontend e robustez

**Prioridade:** P1  
**Meta:** eliminar injeção de conteúdo e tornar falhas recuperáveis.

- [ ] Substituir interpolação de dados não confiáveis em `innerHTML` por `textContent` ou escape centralizado.
- [ ] Priorizar nomes, descrições, operadores, técnicos, locais, códigos e observações vindos do banco.
- [ ] Adicionar Content Security Policy compatível com Supabase e CDNs usados.
- [ ] Padronizar tratamento de erros de carga e gravação nos dois módulos.
- [ ] Não fechar modal ou drawer quando a operação falhar.
- [ ] Mostrar quais efeitos foram concluídos ou revertidos.
- [ ] Adicionar confirmação contextual para cancelar, concluir, aprovar, fiscalizar e certificar.

### Critérios de aceite da fase 3

- Conteúdo HTML armazenado como dado aparece como texto e não executa script.
- Falhas de rede ou RLS não deixam a interface indicando sucesso.
- Não há erros não tratados no console nos fluxos principais.

## Fase 4 — UX por papel e acessibilidade

**Prioridade:** P2  
**Meta:** reduzir carga cognitiva e tornar tarefas críticas claras em desktop e celular.

- [ ] Criar início por papel com “Minhas pendências” e próxima ação recomendada.
- [ ] Separar claramente Manutenção e Contratações em Refrigeração.
- [ ] Recolher etapas concluídas do fluxo contratual, mantendo resumo e auditoria acessíveis.
- [ ] Transformar tabelas de Máquinas em listas responsivas ou manter identificação e ação visíveis durante o scroll.
- [ ] Indicar visualmente que a navegação horizontal possui mais opções.
- [ ] Remover `user-scalable=no` de Refrigeração.
- [ ] Usar elementos semânticos para botões, formulários e diálogos.
- [ ] Implementar foco inicial, Escape, contenção e retorno de foco nos modais/drawers.
- [ ] Garantir alvos de toque de pelo menos 44 × 44 px.
- [ ] Adicionar rótulos acessíveis a controles somente com ícone.
- [ ] Agrupar os alertas por criticidade, local e responsável, evitando uma fila única excessiva.

### Critérios de aceite da fase 4

- Os fluxos principais podem ser executados apenas com teclado.
- Zoom do navegador funciona no celular.
- Nenhuma ação principal fica fora da viewport sem indicação ou alternativa responsiva.
- Observador não vê ações que não pode executar.
- Gestor, Fiscal e Técnico encontram suas pendências sem percorrer todas as abas.

## Fase 5 — Manutenibilidade, testes e documentação

**Prioridade:** P2  
**Meta:** reduzir divergência entre módulos e permitir mudanças com confiança.

- [ ] Centralizar autenticação e comportamento de sessão em `shared/auth.js` ou documentar formalmente por que cada módulo precisa de implementação própria.
- [ ] Extrair de Refrigeração, de forma incremental, autenticação, contratação, formatação e acesso ao Supabase para arquivos focados.
- [ ] Preservar o modelo zero-build e os contratos públicos existentes.
- [ ] Criar testes automatizados de RLS e funções SQL no ambiente de desenvolvimento do Supabase.
- [ ] Criar testes de navegador para login, leitura livre, OS, estoque e contratação.
- [ ] Atualizar `README.md`, `SETUP.md`, `TESTES.md` e contagens exibidas no portal.
- [ ] Remover da documentação qualquer senha ou instrução operacional obsoleta.
- [ ] Documentar recuperação, backup e resposta a falha de migração.

### Critérios de aceite da fase 5

- RLS, transações e transições de status possuem testes repetíveis.
- Os dois módulos usam o mesmo contrato de autenticação e feedback ou têm exceções documentadas.
- README e portal refletem os dados e versões realmente implantados.
- O checklist de deploy inclui migração, teste por papel, smoke test e rollback aditivo.

## Ordem de implantação

```text
Fase 0: credenciais e decisões de acesso
  ↓
Fase 1: RLS e armazenamento privado
  ↓
Fase 2: transações, auditoria e reconciliação
  ↓
Fase 3: proteção e recuperação no frontend
  ↓
Fase 4: UX, responsividade e acessibilidade
  ↓
Fase 5: modularização, testes e documentação
```

As fases 1 e 2 não devem ser implantadas juntas sem validação intermediária. A nova RLS deve entrar e ser testada antes das RPCs e triggers, para facilitar diagnóstico e reversão aditiva.

## Ponto de retomada após reinicialização

1. Abrir este arquivo e começar pela **Fase 0**.
2. Verificar `git status` para preservar alterações já existentes.
3. Conferir no Supabase se a migração `09_importa_frota_28.sql` já foi aplicada e registrar a contagem real.
4. Trocar as senhas iniciais diretamente no Supabase Auth; não registrar novas senhas no repositório.
5. Produzir a matriz papel × ação antes de escrever `10_rls_por_papel.sql`.
6. Executar cada migração primeiro em ambiente de teste ou com transação e consultas de verificação preparadas.

## Decisões pendentes

- [ ] O modo Livre continuará existindo? Quais campos serão públicos?
- [ ] As contas serão individuais imediatamente ou haverá transição com contas de função?
- [ ] Qual é a tolerância financeira aceita na certificação?
- [ ] Estoque insuficiente bloqueia a conclusão da OS ou gera pendência formal?
- [ ] Quem pode corrigir registros concluídos e qual fluxo de retificação será usado?
- [ ] Existe ambiente Supabase separado para testar as migrações?

## Fora deste roadmap

- Implementação dos módulos Transportes, Elétrica e Fonoclama.
- Mudança de framework ou inclusão de processo de build.
- Redesign completo da identidade visual.
- Correção dos dados contratuais divergentes sem validação administrativa da fonte oficial.
