/**
 * Decide whether the MCP stdio entry point should spin up the Express/dashboard
 * side-car. When stdio is being used by an agent host (Claude Code etc.) the
 * HTTP server is dead weight — it allocates Express, routes, static assets,
 * and SSE connections per spawned process, multiplying RAM N× with N agents.
 *
 * Resolution order (first match wins):
 *   1. `MCP_STDIO_ONLY=1|true`      → skip dashboard
 *   2. `MCP_FORCE_DASHBOARD=1|true` → keep dashboard (escape hatch)
 *   3. stdin is not a TTY           → skip dashboard (piped — almost certainly an agent host)
 *   4. otherwise                    → keep dashboard (interactive dev run)
 */
export function shouldSkipDashboard(env: NodeJS.ProcessEnv, isStdinTTY: boolean): boolean {
  const stdioOnly = env.MCP_STDIO_ONLY;
  if (stdioOnly === "1" || stdioOnly === "true") return true;

  const forceDashboard = env.MCP_FORCE_DASHBOARD;
  if (forceDashboard === "1" || forceDashboard === "true") return false;

  return !isStdinTTY;
}
