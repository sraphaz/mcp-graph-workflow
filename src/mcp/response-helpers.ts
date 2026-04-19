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
 * Shared MCP response formatters — single source of truth for tool responses.
 *
 * Replaces 55+ inline JSON.stringify response blocks and 19+ error blocks.
 */

export interface McpToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Format a success response with compact JSON (saves ~25-30% tokens). */
export function mcpText(data: unknown): McpToolResponse {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

/** Format an error response with isError flag. */
export function mcpError(error: Error | string): McpToolResponse {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

/** Normalize escaped newlines from MCP clients (literal \\n → actual \n). */
export function normalizeNewlines(text: string | undefined): string | undefined {
  if (!text) return text;
  return text.replace(/\\n/g, "\n");
}
