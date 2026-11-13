#!/usr/bin/env bash
# Atualiza a cópia empacotada do ULTRA MOTION X (sem CDN: tudo local no instalador).
# Uso: scripts/sync-ultra-motion-x.sh [caminho-do-repo-ULTRA-MOTION-X]
set -euo pipefail
SRC="${1:-../ULTRA-MOTION-X}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/frontend/vendor/ultra-motion-x"
if [ ! -f "$SRC/src/index.js" ]; then
  echo "ULTRA-MOTION-X não encontrado em $SRC" >&2
  exit 1
fi
VERSION="$(node -p "require('$SRC/package.json').version")"
COMMIT="$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo desconhecido)"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/src/." "$DEST/"
printf 'ULTRA MOTION X %s (commit %s)\nCópia gerada por scripts/sync-ultra-motion-x.sh — não editar aqui; altere no repositório ULTRA-MOTION-X.\n' "$VERSION" "$COMMIT" > "$DEST/VERSION.txt"
echo "ULTRA MOTION X $VERSION ($COMMIT) copiado para $DEST"
