#!/usr/bin/env bash
# Aplica os apps PMOC sobre o repo luctronicserp/pmoc já existente.
# Não apaga nada — só adiciona o que falta e corrige o Vercel.
set -e

REPO="${1:-.}"
[ -d "$REPO/.git" ] || { echo "✗ Uso: ./APLICAR.sh /caminho/do/repo/pmoc"; exit 1; }

echo "▶ Copiando apps para $REPO"
cp index.html          "$REPO/"
cp vercel.json         "$REPO/"
cp README.md           "$REPO/"
cp SETUP.md TESTES.md  "$REPO/"
mkdir -p "$REPO/maquinas" "$REPO/refrigeracao" "$REPO/shared" "$REPO/supabase"
cp maquinas/*          "$REPO/maquinas/"
cp refrigeracao/*      "$REPO/refrigeracao/"
cp shared/*            "$REPO/shared/"
cp supabase/*          "$REPO/supabase/"

echo "▶ Ignorando binários pesados"
cd "$REPO"
for p in "PMOC.zip" "cmasm-final.tar.gz" "*.tar.gz" "*.zip"; do
  grep -qxF "$p" .gitignore 2>/dev/null || echo "$p" >> .gitignore
done

echo "▶ Commit + push"
git add -A
git commit -m "Apps PMOC: portal + refrigeracao v2.8 + maquinas v1.0 + schemas Supabase"
git push

echo ""
echo "✅ Pronto. O Vercel vai reimplantar sozinho."
echo "   Aguarde ~30s e recarregue a URL de produção."
