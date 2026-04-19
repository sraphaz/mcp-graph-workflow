#!/usr/bin/env bash
# scripts/ci/validate-locally.sh
#
# Run CI hot-path jobs (preflight by default) locally via `act`. Lets you
# validate changes to .github/workflows/*.yml before pushing, which would
# have caught at least two of the three iteration loops in the v10.0.0
# relicense PR (lockfile-sync and `prepare` script blocking `npm ci`).
#
# Usage:
#   scripts/ci/validate-locally.sh                  # runs preflight job
#   scripts/ci/validate-locally.sh --job test       # only the test matrix
#   scripts/ci/validate-locally.sh --job build      # only the build job
#   scripts/ci/validate-locally.sh --full           # all jobs in ci.yml
#   scripts/ci/validate-locally.sh -- --list        # any extra arg is
#                                                   # passed through to act
#
# Limitations (documented in depth in docs/guides/CI-LOCAL-VALIDATION.md):
#   * act runs everything on Linux via Docker. Windows / macOS matrix is
#     not reproducible locally.
#   * Some actions (`actions/upload-artifact@v7`, `actions/cache@v5`)
#     gracefully degrade but do not match CI fidelity.
#   * Secrets must live in .secrets (gitignored). act exits early if
#     the file is referenced but missing — create an empty one if you do
#     not need any.
#
# This is a smoke test, not a replacement for CI. The source of truth is
# GitHub Actions.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if ! command -v act >/dev/null 2>&1; then
  cat >&2 <<'ERR'
act is not installed. Install one of:

  brew install act                 # macOS
  gh extension install nektos/act  # cross-platform via gh CLI
  curl -fsSL https://raw.githubusercontent.com/nektos/act/master/install.sh | bash  # Linux

Then re-run this script. See docs/guides/CI-LOCAL-VALIDATION.md.
ERR
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not reachable. Start Docker Desktop (macOS) or the docker service (Linux) first." >&2
  exit 1
fi

JOB="preflight"
FULL=0
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --job)
      JOB="$2"; shift 2 ;;
    --full)
      FULL=1; shift ;;
    --help|-h)
      sed -n '2,30p' "$0"; exit 0 ;;
    --)
      shift; EXTRA_ARGS+=("$@"); break ;;
    *)
      EXTRA_ARGS+=("$1"); shift ;;
  esac
done

# act reads secrets from .secrets per .actrc; create an empty one if the
# user has not populated any yet so act does not refuse to start.
if [ ! -f .secrets ]; then
  touch .secrets
fi

CMD=(act pull_request -W .github/workflows/ci.yml)
if [ "$FULL" -eq 0 ]; then
  CMD+=(-j "$JOB")
fi
CMD+=("${EXTRA_ARGS[@]}")

echo "Running: ${CMD[*]}"
exec "${CMD[@]}"
