#!/usr/bin/env bash
# Cleanup ai-shadow/* branches left behind by parallel-agent worktrees.
# Safe by design: git refuses to delete a branch attached to a live worktree,
# so in-progress shadows are skipped automatically. Errors are swallowed.
set -u

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

git worktree prune 2>/dev/null || true

# Remove worktrees under temp dirs (cascade scratch dirs)
git worktree list --porcelain 2>/dev/null | awk '/^worktree / {print $2}' | while read -r wt; do
  case "$wt" in
    /tmp/mcpg-wt-*|/private/tmp/mcpg-wt-*|/var/folders/*/T/mcpg-wt-*) git worktree remove --force "$wt" 2>/dev/null ;;
  esac
done

before=$(git for-each-ref --count=1000000 --format='%(refname:short)' refs/heads/ai-shadow/ 2>/dev/null | wc -l | tr -d ' ')
[ "$before" -eq 0 ] && exit 0

git for-each-ref --format='%(refname:short)' refs/heads/ai-shadow/ \
  | xargs -n 100 git branch -D 2>/dev/null

after=$(git for-each-ref --count=1000000 --format='%(refname:short)' refs/heads/ai-shadow/ 2>/dev/null | wc -l | tr -d ' ')
deleted=$((before - after))

[ "$deleted" -gt 0 ] && echo "shadow-cleanup: deleted $deleted ai-shadow/* branches ($after still attached to worktrees)" >&2

exit 0
