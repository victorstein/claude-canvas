#!/bin/bash
# Wrapper script to run canvas with proper environment
cd "$(dirname "$0")"
export PATH="/Users/david/.bun/bin:$PATH"
exec bun run src/cli.ts "$@"
