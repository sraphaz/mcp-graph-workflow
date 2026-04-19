#!/usr/bin/env bash
# scripts/license/post-release.sh
# One-shot operational script to run AFTER release-please has published
# mcp-graph v10.0.0 to npm. Performs the three things the release workflow
# cannot (or should not) do automatically:
#
#   1. Retag v10.0.0 as a GPG/SSH-signed tag (release-please creates the tag
#      via GitHub's REST API, which produces an UNSIGNED annotated tag —
#      https://docs.github.com/rest/git/tags — so PROVENANCE Layer 1 is not
#      satisfied until we re-sign).
#   2. OpenTimestamps-stamp the release commit (PROVENANCE Layer 2). Requires
#      the `ots` CLI. Install via:
#         brew install opentimestamps           # macOS
#         pipx install opentimestamps-client    # cross-platform
#   3. Deprecate @mcp-graph-workflow/mcp-graph@9.4.0 on npm so users pulling
#      `latest` see the license-change notice. Requires `npm login` on this
#      machine; the publish itself is handled by release.yml using the repo
#      NPM_TOKEN secret, so this is strictly a downgrade-of-old-version note,
#      not a republish.
#
# Usage:
#   scripts/license/post-release.sh            # runs all steps, prompting on
#                                              # each one.
#   scripts/license/post-release.sh --yes      # skip confirmations.
#   scripts/license/post-release.sh --only=tag # run only the signed-retag
#                                              # step. Valid values:
#                                              # tag | ots | deprecate
#
# Exit codes: 0 on success; any non-zero exit halts the script (set -e).

set -euo pipefail

VERSION="v10.0.0"
OLD_VERSION_TO_DEPRECATE="9.4.0"
NPM_PACKAGE="@mcp-graph-workflow/mcp-graph"
DEPRECATE_MSG="Last MIT-licensed release. v10+ is AGPL-3.0-or-later with a commercial licensing channel; see https://github.com/DiegoNogueiraDev/mcp-graph-workflow/blob/master/COMMERCIAL.md"

ONLY=""
ASSUME_YES=""
for arg in "$@"; do
  case "$arg" in
    --yes|-y)      ASSUME_YES=1 ;;
    --only=*)      ONLY="${arg#--only=}" ;;
    --help|-h)     sed -n '2,30p' "$0"; exit 0 ;;
    *)             echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

confirm() {
  local prompt="$1"
  if [ -n "$ASSUME_YES" ]; then return 0; fi
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

should_run() {
  local step="$1"
  [ -z "$ONLY" ] || [ "$ONLY" = "$step" ]
}

# ---------------------------------------------------------------------------
# Step 1 — retag as signed.
# ---------------------------------------------------------------------------
if should_run tag; then
  echo ""
  echo "== Step 1/3: retag $VERSION as a signed tag =="

  git fetch --tags --force origin

  if ! git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null; then
    echo "error: tag $VERSION does not exist on the local repo after fetch."
    echo "  Has release-please finished running? Check"
    echo "  https://github.com/DiegoNogueiraDev/mcp-graph-workflow/releases"
    exit 1
  fi

  COMMIT=$(git rev-list -n 1 "$VERSION")
  SIG=$(git for-each-ref --format='%(*objecttype)%(contents:signature)' "refs/tags/$VERSION" | head -1)

  if echo "$SIG" | grep -q 'BEGIN PGP\|BEGIN SSH'; then
    echo "Tag $VERSION is already signed. Skipping."
  else
    echo "Tag $VERSION points to $COMMIT and is UNSIGNED."
    if confirm "Re-sign the tag in place?"; then
      git tag -s "$VERSION" -f -m "Release $VERSION (MIT -> AGPL-3.0-or-later)" "$COMMIT"
      if confirm "Force-push the signed tag to origin? (requires bypass of tag protection)"; then
        git push origin "$VERSION" --force
        echo "Signed tag pushed."
      else
        echo "Signed tag kept locally. Run 'git push origin $VERSION --force' when ready."
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Step 2 — OpenTimestamps anchor.
# ---------------------------------------------------------------------------
if should_run ots; then
  echo ""
  echo "== Step 2/3: OpenTimestamps stamp of the release commit =="

  if ! command -v ots >/dev/null 2>&1; then
    echo "ots CLI not found. Install it first:"
    echo "  brew install opentimestamps            # macOS"
    echo "  pipx install opentimestamps-client     # cross-platform"
    echo "Skipping this step."
  else
    COMMIT=$(git rev-list -n 1 "$VERSION")
    STAMP_DIR="docs/provenance/ots"
    mkdir -p "$STAMP_DIR"
    OUT_FILE="$STAMP_DIR/$VERSION.commit-hash.txt"
    echo "$COMMIT" > "$OUT_FILE"

    if confirm "Create OpenTimestamps proof for $VERSION ($COMMIT)?"; then
      ots stamp "$OUT_FILE"
      echo "Proof written to $OUT_FILE.ots"
      if confirm "Commit the OTS proof to docs/provenance/ots/ on master?"; then
        git checkout master
        git pull --ff-only origin master
        git add "$OUT_FILE" "$OUT_FILE.ots"
        git commit -s -m "docs(provenance): OTS anchor for $VERSION release commit

The commit hash of the $VERSION release ($COMMIT) is anchored to the
Bitcoin blockchain via OpenTimestamps (PROVENANCE Layer 2). Verify
with:

  ots verify docs/provenance/ots/$VERSION.commit-hash.txt.ots

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
        git push origin master
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Step 3 — deprecate the last MIT release on npm.
# ---------------------------------------------------------------------------
if should_run deprecate; then
  echo ""
  echo "== Step 3/3: npm deprecate $NPM_PACKAGE@$OLD_VERSION_TO_DEPRECATE =="

  if ! npm whoami >/dev/null 2>&1; then
    echo "npm is not authenticated on this machine. Run:"
    echo "  npm login"
    echo "Then re-run: scripts/license/post-release.sh --only=deprecate"
    exit 1
  fi

  echo "Deprecation message:"
  printf '  %s\n' "$DEPRECATE_MSG"

  if confirm "Apply deprecation to $NPM_PACKAGE@$OLD_VERSION_TO_DEPRECATE?"; then
    npm deprecate "${NPM_PACKAGE}@${OLD_VERSION_TO_DEPRECATE}" "$DEPRECATE_MSG"
    echo "Deprecated. Verify with:"
    echo "  npm view $NPM_PACKAGE@$OLD_VERSION_TO_DEPRECATE deprecated"
  fi
fi

echo ""
echo "Done. Verify state at:"
echo "  https://github.com/DiegoNogueiraDev/mcp-graph-workflow/releases/tag/$VERSION"
echo "  https://www.npmjs.com/package/$NPM_PACKAGE"
