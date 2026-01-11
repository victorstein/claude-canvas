#!/bin/bash
# Wrapper script to run canvas with proper environment
set -e

SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR"

# Auto-install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "Installing canvas dependencies..." >&2
  bun install --silent
fi

exec bun run src/cli.ts "$@"
