/**
 * Extract agent identity from MCP RequestHandlerExtra context.
 *
 * The MCP SDK passes `extra` with `meta` containing session/agent info.
 * This utility provides a consistent way to extract the agent identifier
 * for audit trail purposes (ADR-10).
 *
 * Priority: meta.agentId > meta.sessionId > 'unknown'
 */

/** Extract agent identity from MCP extra context. */
export function extractAgentId(extra: unknown): string {
  if (!extra || typeof extra !== 'object') return 'unknown';

  const meta = (extra as Record<string, unknown>).meta;
  if (!meta || typeof meta !== 'object') return 'unknown';

  const m = meta as Record<string, unknown>;

  // Prefer explicit agentId
  if (typeof m.agentId === 'string' && m.agentId.length > 0) {
    return m.agentId;
  }

  // Fall back to sessionId
  if (typeof m.sessionId === 'string' && m.sessionId.length > 0) {
    return m.sessionId;
  }

  return 'unknown';
}
