/* shared/supabase-env.js — onde o endereço do banco é DECLARADO.
 *
 * Até aqui, `shared/supabase-config.js` descobria a URL e a chave baixando
 * `maquinas/app.js` e lendo-as por expressão regular. Funcionava, e era um
 * ponto único de falha do tamanho da plataforma inteira: bastava alguém
 * trocar `const SUPA_URL = '…'` por um objeto, um `let`, ou mover as duas
 * linhas para outro arquivo, e os NOVE módulos que chamam
 * `criarClienteSupabase()` perdiam o banco ao mesmo tempo — sem erro de
 * sintaxe, sem aviso em revisão, só a tela vazia no dia seguinte.
 *
 * O valor não é segredo: a `anon key` é pública por definição (vai no
 * navegador de qualquer forma) e quem protege a base é a RLS, não o
 * sigilo dela. O que ela não podia continuar sendo é *inferida*.
 *
 * As cópias que sobraram — `maquinas/app.js`, `refrigeracao/index.html` e
 * `calibracao/index.html`, os dois últimos apps que não importam de lugar
 * nenhum por decisão de projeto — agora são espelhos, e
 * `tests/supabase-env.test.js` compara os quatro literais caractere a
 * caractere. Trocar a chave em um lugar só passou a falhar o gate em vez
 * de falhar em produção; o gate, ao nascer, já encontrou a terceira cópia
 * (calibração), que não estava registrada em lugar nenhum.
 */

export const SUPABASE_URL = 'https://thoaqipyhfmromsgzmjs.supabase.co'

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRob2FxaXB5aGZtcm9tc2d6bWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNjk5NTksImV4cCI6MjEwMTY0NTk1OX0.1Ig6ijb6SKgeQRgGwM54MyzlVr-n_feSAxaFTwbHRGY'

/* Identificador do projeto, derivado da URL e não redigitado: é o que
 * aparece nas migrações e no painel do Supabase, e conferi-lo aqui evita
 * apontar a plataforma para um projeto e as migrações para outro. */
export const SUPABASE_PROJETO = 'thoaqipyhfmromsgzmjs'
