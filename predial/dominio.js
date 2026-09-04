// Regras puras do módulo Predial — sem DOM e sem Supabase, para poder testar.

// A matriz GUT subiu para shared/gut.js (D-09) — o /gestao (Onda B) também
// precisa da mesma escala para priorizar as ações 5W2H; reexportada aqui,
// nunca duplicada, mesmo precedente da linha abaixo para
// montarArvore/linhasVisiveis.
export { GUT_ESCALA, classificarGut, gutTotal } from '../shared/gut.js'

// A árvore de locais virou registro compartilhado; as funções vivem em
// shared/arvore.js e são reexportadas aqui para quem já importava daqui.
export { montarArvore, linhasVisiveis } from '../shared/arvore.js'
