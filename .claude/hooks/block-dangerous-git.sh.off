#!/usr/bin/env bash
# Blocks dangerous git commands when invoked as a Claude Code PreToolUse hook.
# Input (stdin): JSON with tool_input.command field
# Exit 2 = blocked (Claude Code aborts the tool call)
# Exit 0 = allowed

set -euo pipefail

input=$(cat)
command=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

if [ -z "$command" ]; then
  exit 0
fi

BLOCKED_PATTERNS=(
  "git push --force"
  "git push -f "
  "git push -f$"
  "git reset --hard"
  "git clean -f"
  "git clean -fd"
  "git clean -fx"
  "git branch -D"
  "git checkout -- "
  "git checkout \."
  "git restore \."
  "git restore --source"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$command" | grep -qE "$pattern"; then
    echo "BLOCKED: Dangerous git command detected: '$command'" >&2
    echo "This command can cause irreversible data loss. Run manually if truly needed." >&2
    exit 2
  fi
done

# Block bare 'git push' to remote (without explicit --dry-run)
if echo "$command" | grep -qE "^git push( |$)" && ! echo "$command" | grep -q "\-\-dry-run"; then
  echo "BLOCKED: 'git push' requires explicit user approval. Use the terminal directly." >&2
  exit 2
fi

exit 0
