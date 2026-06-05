#!/usr/bin/env bash
# Orkestrate CLI installer — https://orkestrate.space
# Usage: curl -fsSL https://orkestrate.space/cli/install.sh | bash
set -euo pipefail

ORKESTRATE_PKG="${ORKESTRATE_PKG:-orkestrate}"
ORKESTRATE_VERSION="${ORKESTRATE_VERSION:-}"

bun_on_path() {
  command -v bun >/dev/null 2>&1
}

ensure_bun() {
  if bun_on_path; then
    return 0
  fi
  echo "→ Bun not found. Installing from bun.sh…"
  curl -fsSL https://bun.sh/install | bash
}

export_bun_path() {
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
}

ensure_bun
export_bun_path

if ! bun_on_path; then
  echo "error: Bun install did not succeed. Add ~/.bun/bin to PATH and re-run this script." >&2
  exit 1
fi

spec="$ORKESTRATE_PKG"
if [ -n "$ORKESTRATE_VERSION" ]; then
  spec="${ORKESTRATE_PKG}@${ORKESTRATE_VERSION}"
fi

echo "→ Installing ${spec} (global)…"
bun install -g "$spec"

echo ""
echo "Installed. Open the workbench:"
echo "  orkestrate"
echo ""
echo "Verify harnesses:"
echo "  orkestrate doctor"