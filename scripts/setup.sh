#!/bin/sh
# One-time project setup: install dependencies and activate the git hooks.
set -eu

cd "$(dirname "$0")/.."

pnpm install
git config core.hooksPath .githooks

echo "Setup complete: dependencies installed, git hooks activated (.githooks)."
