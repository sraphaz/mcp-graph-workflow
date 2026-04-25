#!/usr/bin/env node
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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAllTools } from "./tools/index.js";
import { ProfileFilterSchema } from "./tools/taxonomy.js";
import { runInit } from "./init-project.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { loadConfig } from "../core/config/config-loader.js";
import { logger } from "../core/utils/logger.js";
import { createApp } from "./app-factory.js";
import { startDashboard } from "./dashboard-launcher.js";
import { shouldSkipDashboard } from "./stdio-mode.js";

const args = process.argv.slice(2);

if (args.includes("--init") || args.includes("init")) {
  await runInit(process.cwd());
  process.exit(0);
}

// ── Config ───────────────────────────────────────────────
const config = loadConfig();

// ── Store + Event Bus ────────────────────────────────────
const store = SqliteStore.open(process.cwd());
const eventBus = new GraphEventBus();
store.eventBus = eventBus;

// ── MCP Server ───────────────────────────────────────────
const mcp = new McpServer(
  { name: "mcp-graph", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

const profile = ProfileFilterSchema.safeParse(process.env.MCP_GRAPH_PROFILE).data ?? "all";
await registerAllTools(mcp, store, profile);

// ── Background dashboard (HTTP + auto-open browser) ──────
// Skipped when invoked by an agent host (stdin piped) or MCP_STDIO_ONLY=1 —
// the Express app + static assets + SSE would otherwise multiply RAM per agent.
const skipDashboard = shouldSkipDashboard(process.env, Boolean(process.stdin.isTTY));
if (config.dashboard.autoOpen && !skipDashboard) {
  const app = createApp({ store, basePath: process.cwd(), eventBus });
  startDashboard(app, config.port).catch((err) => {
    logger.warn("Dashboard auto-start failed (non-blocking)", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
} else if (skipDashboard) {
  logger.debug("stdio:dashboard-skipped", {
    reason: process.env.MCP_STDIO_ONLY ? "MCP_STDIO_ONLY" : "stdin-not-tty",
  });
}

// ── Stdio transport ──────────────────────────────────────
const transport = new StdioServerTransport();
await mcp.connect(transport);
