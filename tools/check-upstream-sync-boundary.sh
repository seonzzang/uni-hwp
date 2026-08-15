#!/usr/bin/env bash
set -euo pipefail

sync_paths=(
  "Cargo.toml"
  "Cargo.lock"
  "examples"
  "npm"
  "src"
  "scripts"
  "template"
  "tests"
  "ttfs"
  "typescript"
  "web"
)

for blocked in "apps" "site" "docs/public" ".github/workflows" "src-tauri"; do
  for path in "${sync_paths[@]}"; do
    if [[ "$path" == "$blocked" ]] || [[ "$path" == "$blocked"* ]]; then
      echo "sync boundary violation: $blocked is in sync list" >&2
      exit 1
    fi
  done
done

echo "SYNC_BOUNDARY_OK"
