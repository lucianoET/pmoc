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

export async function criarClienteSupabase() {
  const { url, key } = await obterSupabaseConfig()
  return window.supabase.createClient(url, key)
}
