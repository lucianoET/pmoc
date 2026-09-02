let CONFIG_CACHE = null

async function lerConfigDeArquivo(url) {
  const resposta = await fetch(url, { cache: 'no-store' })
  if (!resposta.ok) return null

  const texto = await resposta.text()
  const urlMatch = texto.match(/const\s+SUPA_URL\s*=\s*['"]([^'"]+)['"]/)
  const keyMatch = texto.match(/const\s+SUPA_KEY\s*=\s*['"]([^'"]+)['"]/)

  if (!urlMatch || !keyMatch) return null
  return { url: urlMatch[1], key: keyMatch[1] }
}

export async function obterSupabaseConfig() {
  if (CONFIG_CACHE) return CONFIG_CACHE

  const candidatos = [
    new URL('../maquinas/app.js', import.meta.url),
    new URL('../refrigeracao/index.html', import.meta.url),
  ]

  for (const candidato of candidatos) {
    try {
      const config = await lerConfigDeArquivo(candidato)
      if (config) {
        CONFIG_CACHE = config
        return CONFIG_CACHE
      }
    } catch (_error) {
      // tenta o próximo arquivo-base do projeto
    }
  }

  throw new Error(
    'Nao foi possivel localizar a configuracao do Supabase. Abra o projeto por servidor local para carregar os arquivos compartilhados.'
  )
}

// O endereço de onde o SDK vem, escrito uma vez: é o que a mensagem precisa
// nomear para alguém da rede saber o que liberar.
export const ORIGEM_SDK = 'cdn.jsdelivr.net'

/** A frase que o usuário lê quando o SDK não carregou.
 *
 *  Existe porque a alternativa media mal: `window.supabase` indefinido fazia
 *  `Cannot read properties of undefined (reading 'createClient')` subir até a
 *  tela em SETE módulos — mensagem que não diz o que houve nem o que fazer, e
 *  que quem lê não tem como agir sobre. A causa real quase sempre é uma só,
 *  e é externa ao aplicativo: a rede não deixou o CDN passar.
 *
 *  Nomear o endereço é o que torna a frase acionável: quem administra a rede
 *  da OM precisa saber QUAL host liberar, não que "houve um erro". */
export const MSG_SDK_AUSENTE =
  `Não foi possível carregar o SDK do Supabase (${ORIGEM_SDK}). ` +
  'Sem ele o módulo não acessa o banco de dados. Verifique a conexão — ' +
  'se a rede bloqueia CDN externo, esse endereço precisa ser liberado.'

export async function criarClienteSupabase() {
  const { url, key } = await obterSupabaseConfig()
  // A guarda mora AQUI, na única linha do projeto que dereferencia o SDK:
  // os oito módulos da base comum a herdam sem uma linha mudada em cada um.
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error(MSG_SDK_AUSENTE)
  }
  return window.supabase.createClient(url, key)
}
