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
 * Centralized MCP server configuration for all ecosystem tools.
 * Generates the complete .mcp.json config with all integrated servers.
 */

import { assertTrustedMcpServer, type AllowlistOptions } from "../security/registry-allowlist.js";
import { logger } from "../utils/logger.js";
import { getErrorMessage } from "../utils/errors.js";

export const MCP_SERVER_NAMES = [
  "mcp-graph",
  "context7",
  "playwright",
  "browser-use",
] as const;

export type McpServerName = (typeof MCP_SERVER_NAMES)[number];

export interface McpServerEntry {
  command: string;
  args: string[];
  type?: string;
}

export interface McpServersConfig {
  mcpServers: Record<string, McpServerEntry>;
}

function getDefaultServers(): Record<McpServerName, McpServerEntry> {
  return {
    "mcp-graph": {
      command: "npx",
      args: ["-y", "@mcp-graph-workflow/mcp-graph"],
    },
    context7: {
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
    },
    playwright: {
      command: "npx",
      args: ["@playwright/mcp@latest"],
    },
    // V11 Maestro Phase 4.5 — Browser Use MCP for agentic web exploration.
    // Requires uvx + OPENAI_API_KEY or ANTHROPIC_API_KEY in env.
    "browser-use": {
      command: "uvx",
      args: ["browser-use-mcp"],
    },
  };
}

/**
 * Build complete MCP servers config, optionally merging with existing config.
 * Standard servers always override existing entries with the same name.
 * Custom servers (not in MCP_SERVER_NAMES) are preserved.
 */
export interface BuildMcpServersConfigOptions {
  /** Phase 3 — MCP RCE hardening. Defaults to "warn" for backwards compatibility. */
  allowlistMode?: "off" | "warn" | "strict";
  allowlist?: AllowlistOptions;
}

export function buildMcpServersConfig(
  existing?: Partial<McpServersConfig>,
  options: BuildMcpServersConfigOptions = {},
): McpServersConfig {
  const existingServers = (existing?.mcpServers ?? {}) as Record<string, McpServerEntry>;
  const defaultServers = getDefaultServers();
  const mode = options.allowlistMode ?? "warn";

  if (mode !== "off") {
    for (const [name, entry] of Object.entries(existingServers)) {
      if (name in defaultServers) continue;
      try {
        assertTrustedMcpServer(entry, options.allowlist);
      } catch (err) {
        if (mode === "strict") throw err;
        logger.warn("mcp:registry:untrusted", { name, reason: getErrorMessage(err) });
      }
    }
  }

  return {
    mcpServers: {
      ...existingServers,
      ...defaultServers,
    },
  };
}
