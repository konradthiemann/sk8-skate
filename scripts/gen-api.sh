#!/usr/bin/env sh
# Regenerates src/lib/api/schema.d.ts from the backend's OpenAPI document.
#
# Why a script instead of a plain "openapi-typescript" call: the generator (7.x)
# declares TypeScript ^5 as a peer dependency, while this app is built with
# TypeScript 7. Started from the project directory it resolves the local
# TypeScript 7 and crashes in its AST factory. The generator is a one-off build
# tool and not part of the app, so it runs in its own npm environment, cached
# under $XDG_CACHE_HOME (or ~/.cache) and reused on later runs.
#
# Usage:
#   pnpm gen:api                                  # against http://localhost:8000
#   SPEC_URL=https://api.example.com/api/doc.json pnpm gen:api
set -eu

SPEC_URL="${SPEC_URL:-http://localhost:8000/api/doc.json}"
OUT="src/lib/api/schema.d.ts"
TS_VERSION="5.9.3"
GENERATOR_VERSION="7.13.0"

CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}"
TOOL_DIR="$CACHE_ROOT/sk8-openapi-typescript/$GENERATOR_VERSION-ts$TS_VERSION"
GENERATOR="$TOOL_DIR/node_modules/.bin/openapi-typescript"

if [ ! -f "package.json" ] || [ ! -d "src/lib/api" ]; then
  echo "Fehler: Bitte im Wurzelverzeichnis der App ausfuehren (dort liegt package.json)." >&2
  exit 1
fi

if ! curl -fsS -o /dev/null --max-time 10 "$SPEC_URL"; then
  echo "Fehler: OpenAPI-Dokument nicht erreichbar: $SPEC_URL" >&2
  echo "Laeuft das Backend? -> cd ../sk8-backend && make up" >&2
  exit 1
fi

if [ ! -x "$GENERATOR" ]; then
  echo "Richte Generator einmalig ein ($TOOL_DIR) ..."
  mkdir -p "$TOOL_DIR"
  # A private package.json keeps npm from walking up into the app's workspace.
  printf '{"name":"sk8-openapi-typescript","private":true,"version":"0.0.0"}\n' >"$TOOL_DIR/package.json"
  (cd "$TOOL_DIR" && npm install --silent --no-audit --no-fund \
    "typescript@$TS_VERSION" "openapi-typescript@$GENERATOR_VERSION")
fi

"$GENERATOR" "$SPEC_URL" -o "$OUT"
echo "Fertig: $OUT wurde aus $SPEC_URL erzeugt."
echo "Naechster Schritt: pnpm typecheck && pnpm test"
