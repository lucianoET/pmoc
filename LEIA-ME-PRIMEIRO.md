# Correção do deploy — pmoc-orcin.vercel.app dando 404

## Causa

O repo `luctronicserp/pmoc` recebeu a pasta **DEV inteira**, mas sem
`index.html` na raiz. O Vercel publica um site estático — sem `index.html`
na raiz, a URL retorna 404.

## Correção

```bash
# 1. clone (ou entre na sua cópia local do repo)
git clone https://github.com/luctronicserp/pmoc.git
cd ..

# 2. rode o script apontando para o repo
./APLICAR.sh ./pmoc
```

O script **não apaga nada**. Ele adiciona:

| Arquivo | Função |
|---------|--------|
| `index.html` | Portal na raiz — resolve o 404 |
| `vercel.json` | Rotas `/refrigeracao` e `/maquinas` |
| `maquinas/` | App de máquinas (index + app.js) |
| `refrigeracao/` | App v2.8 |
| `shared/auth.js` | Login por cargo |
| `supabase/*.sql` | 6 scripts de schema e importação |
| `README.md` | Substitui o README antigo do DEV |

E acrescenta `*.zip` / `*.tar.gz` ao `.gitignore`.

O Vercel reimplanta sozinho após o push. Aguarde ~30s.

---

## Pontos a decidir depois

**1. Submódulos vazios.** As pastas com ícone ↗ no GitHub (`cmasm.erp`,
`xAguada`, `xCFTV`, `xPredial`, `xSeguranca`, `pmoc_refrigeracao`,
`cmms.calibracao`, `cmms.paiol`, `hyperframes`, `oled-reference`,
`workspace_comunicador`) foram enviadas como *gitlinks* — o GitHub mostra
o nome mas não tem o conteúdo.

Para incluir o código de verdade, em cada uma:
```bash
rm -rf .git          # dentro da subpasta
cd ..                # volta pro repo raiz
git rm --cached <pasta>
git add <pasta>
```

Ou mantenha como submódulos de verdade (`git submodule add`).

**2. Nome do deploy.** A URL saiu como `pmoc-orcin.vercel.app` porque
`pmoc` já estava em uso na conta. Para espelhar os nomes:
Vercel → Projeto → Settings → Domains → adicionar `pmoc.vercel.app`
(ou renomear/apagar o projeto `pmoc` antigo).

**3. Binários no git.** `PMOC.zip` e `cmasm-final.tar.gz` já estão no
histórico. O `.gitignore` impede novos, mas para remover os existentes:
```bash
git rm --cached PMOC.zip cmasm-final.tar.gz
git commit -m "Remove binarios do versionamento"
```
