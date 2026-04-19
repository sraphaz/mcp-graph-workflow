/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

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
