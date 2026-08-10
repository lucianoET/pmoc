// Gravação com confirmação, comum aos módulos novos.
//
// O PostgREST não devolve erro quando a RLS bloqueia um update: ele responde
// 200 com zero linhas. Sem `.select()` o app acha que salvou e o usuário vê a
// tela "não atualizar". Aqui toda escrita pede as linhas de volta e trata
// resultado vazio como falha explícita.

/**
 * Executa uma escrita do Supabase exigindo que ela tenha afetado alguma linha.
 * @param {object} consulta Builder do supabase-js (insert/update/delete).
 * @param {string} acao Descrição curta para a mensagem de erro.
 * @returns {Promise<{ok: boolean, dados: Array, erro: string|null}>}
 */
export async function gravar(consulta, acao) {
  const { data, error } = await consulta.select()

  if (error) return { ok: false, dados: [], erro: `Erro ao ${acao}: ${error.message}` }

  if (!data || data.length === 0) {
    return {
      ok: false,
      dados: [],
      erro: `Nada foi ${acao}. A sessão pode ter expirado ou seu cargo não tem permissão de escrita — entre de novo e tente outra vez.`,
    }
  }

  return { ok: true, dados: data, erro: null }
}
