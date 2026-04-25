#!/usr/bin/env sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright © 2026 Diego Lima Nogueira de Paula
#
# `curl -fsSL https://mcp-graph.dev/install.sh | sh`
#
# Detects Node.js ≥ 20 and installs `@mcp-graph-workflow/cli` globally via npm.
# NEVER silently installs Node — if missing or too old, points at Volta/fnm/nvm
# with copy-pasteable commands and exits non-zero.
#
# Per ADR-0051, this is the **secondary** install path. npm-direct
# (`npm install -g @mcp-graph-workflow/cli`) is canonical.
#
# Verify before piping to shell:
#   curl -fsSL https://mcp-graph.dev/install.sh -o install.sh
#   shasum -a 256 install.sh        # compare against the README
#   sh install.sh

set -eu

PACKAGE="@mcp-graph-workflow/cli"
MIN_NODE_MAJOR=20

# ── color helpers (no-op when not a tty) ──────────────────────
if [ -t 1 ]; then
  RED="$(printf '\033[31m')"
  GREEN="$(printf '\033[32m')"
  YELLOW="$(printf '\033[33m')"
  BLUE="$(printf '\033[34m')"
  RESET="$(printf '\033[0m')"
else
  RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
err()  { printf '%s✗%s %s\n' "$RED" "$RESET" "$*" >&2; }

# ── header ────────────────────────────────────────────────────
say "${BLUE}MCP Graph Workflow CLI installer${RESET}"
say ""

# ── 1. Node check ─────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  err "Node.js is not installed."
  cat <<EOF >&2

  ${PACKAGE} requires Node.js ≥ ${MIN_NODE_MAJOR}. Pick one:

    Volta (recommended for stability):
      curl https://get.volta.sh | bash
      volta install node@lts

    fnm (fast Node manager):
      curl -fsSL https://fnm.vercel.app/install | bash
      fnm install --lts && fnm use lts-latest

    nvm (most portable):
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
      nvm install --lts && nvm use --lts

    Direct download:
      https://nodejs.org/

  Re-run this installer once Node is on PATH.
EOF
  exit 2
fi

NODE_VERSION="$(node --version)"
NODE_MAJOR="$(printf '%s' "$NODE_VERSION" | sed -E 's/^v([0-9]+)\..*/\1/')"

if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ] 2>/dev/null; then
  err "Node ${NODE_VERSION} is too old (need ≥ v${MIN_NODE_MAJOR})."
  cat <<EOF >&2

  Upgrade with whichever Node manager you have:
    volta install node@lts
    fnm install --lts && fnm use lts-latest
    nvm install --lts && nvm use --lts

EOF
  exit 2
fi

ok "Node ${NODE_VERSION}"

# ── 2. npm check ──────────────────────────────────────────────
if ! command -v npm >/dev/null 2>&1; then
  err "npm not on PATH (Node is, but npm isn't — unusual)."
  say "  Reinstall Node from a manager that bundles npm (volta/fnm/nvm)." >&2
  exit 2
fi

NPM_VERSION="$(npm --version)"
ok "npm ${NPM_VERSION}"

# ── 3. install ────────────────────────────────────────────────
say ""
say "${BLUE}Installing ${PACKAGE}…${RESET}"
say ""

# Capture failures from `npm install -g` (e.g. EACCES on /usr/local) and
# offer the user a non-sudo alternative.
if ! npm install -g "$PACKAGE"; then
  err "global install failed."
  cat <<EOF >&2

  Common cause: the global prefix is owned by root. Two fixes:

    1. Use a Node manager that owns its own prefix (no sudo needed):
       fnm install --lts && fnm use lts-latest
       npm install -g ${PACKAGE}

    2. Configure npm to use a user-owned prefix:
       npm config set prefix ~/.npm-global
       export PATH=\$HOME/.npm-global/bin:\$PATH    # add to ~/.zshrc / ~/.bashrc
       npm install -g ${PACKAGE}

  Avoid \`sudo npm install -g\` — it creates root-owned files in your home dir.
EOF
  exit 1
fi

# ── 4. verify ─────────────────────────────────────────────────
if ! command -v mg >/dev/null 2>&1; then
  warn "Installed, but \`mg\` is not on PATH."
  say "  add npm's global bin dir to your PATH and reopen the shell." >&2
  say "    export PATH=\"\$(npm config get prefix)/bin:\$PATH\"" >&2
  exit 0
fi

INSTALLED_VERSION="$(mg --version 2>/dev/null || echo unknown)"

say ""
ok "${PACKAGE} ${INSTALLED_VERSION}"
say ""
say "Try it now:"
say "  ${BLUE}mg${RESET}              # interactive REPL"
say "  ${BLUE}mg --help${RESET}       # all 15 commands"
say "  ${BLUE}mg demo${RESET}         # 60-second sandbox tour"
say ""
say "Docs: https://github.com/diegonogueira/mcp-graph-workflow/tree/master/tools/cli"
