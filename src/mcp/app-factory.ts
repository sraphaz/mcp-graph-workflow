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

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Express } from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { StoreManager } from "../core/store/store-manager.js";
import type { GraphEventBus } from "../core/events/event-bus.js";
import { createApiRouter } from "../api/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "web", "dashboard", "dist");

export interface AppFactoryOptions {
  store: SqliteStore;
  basePath: string;
  eventBus: GraphEventBus;
  mcp?: McpServer;
  storeManager?: StoreManager;
}

/** createApp — auto-generated description placeholder. */
export function createApp(options: AppFactoryOptions): Express {
  const { store, basePath, eventBus, mcp, storeManager } = options;

  const app = express();

  // MCP HTTP transport (optional — only when MCP server is provided).
  // Transport is created ONCE and reused across requests (stateless JSON mode);
  // creating a new transport per request allocates Express middleware + reconnects
  // the MCP server, which accumulates listeners and inflates RAM under concurrent load.
  if (mcp) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const transportReady = mcp.connect(transport);
    app.post("/mcp", express.json({ limit: "50mb" }), async (req, res) => {
      await transportReady;
      await transport.handleRequest(req, res, req.body);
    });
  }

  // REST API
  app.use("/api/v1", createApiRouter({ store, basePath, eventBus, storeManager }));

  // Static files (dashboard)
  app.use(express.static(publicDir));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ ok: true, server: "mcp-graph" });
  });

  return app;
}
