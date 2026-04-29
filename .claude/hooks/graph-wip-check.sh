#!/usr/bin/env bash
# Warns (does NOT block) when there are in_progress tasks in the graph
# before a git commit is made. Enforces WIP=1 principle from CLAUDE.md.
# Input (stdin): JSON with tool_input.command field
# Exit 0 = always allow (advisory only)

set -euo pipefail

input=$(cat)
command=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# Only check on git commit commands
if ! echo "$command" | grep -qE "^git commit"; then
  exit 0
fi

DB_PATH="workflow-graph/graph.db"
if [ ! -f "$DB_PATH" ]; then
  exit 0
fi

WIP_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM nodes WHERE status='in_progress';" 2>/dev/null || echo "0")

if [ "$WIP_COUNT" -gt 0 ]; then
  echo "⚠️  WIP WARNING: $WIP_COUNT task(s) still in_progress in mcp-graph." >&2
  echo "   Run finish_task before committing to keep the graph in sync." >&2
  echo "   Proceeding with commit (advisory only — not blocked)." >&2
fi

exit 0
