#!/usr/bin/env bash
# Gera o PDF de amostra do código-fonte exigido pelo INPI para
# registro de Programa de Computador.
#
# Regra INPI (Resolução INPI/PR nº 06/2013): o depositante deve
# fornecer trechos representativos do código-fonte — tipicamente as
# 20 primeiras páginas + 20 últimas páginas do código concatenado.
# O INPI não avalia o conteúdo; a amostra serve para identificação
# inequívoca do programa depositado.
#
# Este script:
#   1. Concatena todos os arquivos .ts/.tsx/.js/.mjs do `src/` em um
#      único texto, com cabeçalho indicando o caminho de cada arquivo.
#   2. Gera um PDF com as 20 primeiras páginas e as 20 últimas.
#   3. Imprime o hash SHA-512 do tarball do HEAD para uso na
#      declaração de autoria.
#
# Dependências: `pandoc` + `pdftk` (ou `qpdf`), ambos disponíveis via
# Homebrew (`brew install pandoc pdftk-java qpdf`).
#
# Uso:  cd <raiz do repositório> && bash docs/inpi/gerar-amostra-codigo.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

OUT_DIR="docs/inpi/_build"
mkdir -p "$OUT_DIR"

SRC_CONCAT="$OUT_DIR/src-concatenado.md"
SRC_PDF_FULL="$OUT_DIR/src-completo.pdf"
SRC_PDF_AMOSTRA="$OUT_DIR/src-amostra-inpi.pdf"
HASH_FILE="$OUT_DIR/sha512.txt"

echo ">> 1/4  Concatenando arquivos-fonte do src/ ..."

# Cabeçalho com metadata
{
  echo "# MCP Graph Workflow — Código-Fonte (amostra para INPI)"
  echo
  echo "- **Commit:** \`$(git rev-parse HEAD)\`"
  echo "- **Data:** $(date +%Y-%m-%d)"
  echo "- **Autor:** Diego Lima Nogueira de Paula"
  echo
} > "$SRC_CONCAT"

# Concat de todos os .ts/.tsx/.js/.mjs sob src/
find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.mjs" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/web/dashboard/dist/*" \
  | sort \
  | while read -r f; do
      echo "" >> "$SRC_CONCAT"
      echo "---" >> "$SRC_CONCAT"
      echo "" >> "$SRC_CONCAT"
      echo "## \`$f\`" >> "$SRC_CONCAT"
      echo "" >> "$SRC_CONCAT"
      echo '```typescript' >> "$SRC_CONCAT"
      cat "$f" >> "$SRC_CONCAT"
      echo '```' >> "$SRC_CONCAT"
    done

lines=$(wc -l < "$SRC_CONCAT")
echo ">> Total de linhas concatenadas: $lines"

echo ">> 2/4  Renderizando PDF completo ..."
pandoc "$SRC_CONCAT" \
  -o "$SRC_PDF_FULL" \
  --pdf-engine=xelatex \
  -V geometry:margin=2cm \
  -V mainfont="Helvetica" \
  -V monofont="Menlo" \
  -V fontsize=9pt \
  --toc-depth=2 \
  || {
    echo "!! pandoc/xelatex não disponíveis. Instale:"
    echo "   brew install pandoc basictex"
    echo "   sudo tlmgr install tcolorbox framed"
    exit 1
  }

total_pages=$(pdfinfo "$SRC_PDF_FULL" 2>/dev/null | awk '/^Pages:/ {print $2}')
echo ">> PDF completo: $total_pages páginas"

echo ">> 3/4  Extraindo amostra (20 primeiras + 20 últimas páginas) ..."
if [[ "$total_pages" -le 40 ]]; then
  cp "$SRC_PDF_FULL" "$SRC_PDF_AMOSTRA"
  echo ">> PDF tem ${total_pages} páginas — menor que 40, usando integral"
else
  last_start=$((total_pages - 19))
  if command -v pdftk >/dev/null 2>&1; then
    pdftk "$SRC_PDF_FULL" cat 1-20 "$last_start-$total_pages" output "$SRC_PDF_AMOSTRA"
  elif command -v qpdf >/dev/null 2>&1; then
    qpdf --empty --pages "$SRC_PDF_FULL" 1-20 "$SRC_PDF_FULL" "$last_start-$total_pages" -- "$SRC_PDF_AMOSTRA"
  else
    echo "!! Precisa pdftk ou qpdf para extrair páginas"
    echo "   brew install pdftk-java   # ou"
    echo "   brew install qpdf"
    exit 1
  fi
fi

echo ">> 4/4  Gerando hash SHA-512 do tarball do HEAD ..."
git archive --format=tar HEAD | shasum -a 512 | awk '{print $1}' > "$HASH_FILE"

echo ""
echo "================================================================"
echo "  PRONTO — arquivos em $OUT_DIR/"
echo "================================================================"
echo "  1) $SRC_PDF_AMOSTRA         (anexar ao e-INPI)"
echo "  2) $HASH_FILE                (preencher na declaração)"
echo ""
echo "  Hash SHA-512:"
cat "$HASH_FILE"
echo ""
echo "  Commit HEAD: $(git rev-parse HEAD)"
echo "================================================================"
