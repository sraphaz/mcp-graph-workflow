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
import { registerAllTools } from "./tools/index.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { logger } from "../core/utils/logger.js";
import { loadConfig } from "../core/config/config-loader.js";
import { createApp } from "./app-factory.js";
import { StoreManager } from "../core/store/store-manager.js";
import { CodeStore } from "../core/code/code-store.js";
import { CodeIndexer } from "../core/code/code-indexer.js";
import { createAnalyzers } from "../core/code/analyzer-factory.js";
import { logEmbeddingModeOnBoot } from "../core/rag/onnx-embeddings.js";

const config = loadConfig();
const PORT = config.port;

// ── Store Manager + Event Bus ────────────────────────────
const storeManager = StoreManager.create(process.cwd());
const eventBus = new GraphEventBus();
storeManager.store.eventBus = eventBus;

// ── MCP Server ───────────────────────────────────────────
const mcp = new McpServer(
  { name: "mcp-graph", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

registerAllTools(mcp, storeManager.store);

// ── Express app ──────────────────────────────────────────
const app = createApp({
  store: storeManager.store,
  basePath: storeManager.basePath,
  eventBus,
  mcp,
  storeManager,
});

// ── Code Graph auto-index + periodic reindex ─────────────
let reindexTimer: ReturnType<typeof setInterval> | null = null;
let reindexRunning = false;

async function runCodeGraphReindex(label: string): Promise<void> {
  if (reindexRunning) {
    logger.debug("code-graph:reindex:skipped", { reason: "already running" });
    return;
  }
  reindexRunning = true;
  try {
    const project = storeManager.store.getProject();
    if (!project) return;
    const basePath = storeManager.basePath;
    const codeStore = new CodeStore(storeManager.store.getDb());
    const analyzers = await createAnalyzers(basePath);
    const indexer = new CodeIndexer(codeStore, project.id, analyzers);
    const result = await indexer.indexDirectory(basePath, basePath);
    logger.info(`code-graph:${label}`, {
      files: result.fileCount,
      symbols: result.symbolCount,
      relations: result.relationCount,
    });
  } catch (err) {
    logger.warn(`code-graph:${label}:failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    reindexRunning = false;
  }
}

if (config.integrations.codeGraphAutoIndex) {
  runCodeGraphReindex("auto-index");
}

const reindexIntervalSec = config.integrations.codeGraphReindexIntervalSec;
if (reindexIntervalSec > 0) {
  reindexTimer = setInterval(() => {
    runCodeGraphReindex("periodic-reindex");
  }, reindexIntervalSec * 1000);
  logger.info("code-graph:periodic-reindex:enabled", { intervalSec: reindexIntervalSec });
}

// ── Cleanup on shutdown ──────────────────────────────────
// eslint-disable-next-line prefer-const -- assigned after function definition
let httpServer: ReturnType<typeof app.listen>;

function cleanup(signal: string): void {
  logger.info("server:shutdown", { signal });
  try {
    // 0. Stop periodic reindex timer
    if (reindexTimer) {
      clearInterval(reindexTimer);
      reindexTimer = null;
    }
    // 1. Stop accepting new connections and drain in-flight requests
    if (httpServer) {
      httpServer.close(() => {
        logger.info("server:http-closed");
      });
    }
    // 2. Close store (flushes WAL checkpoint)
    storeManager.close();
    logger.info("server:shutdown:ok", { signal });
    process.exit(0);
  } catch (err) {
    logger.error("server:shutdown:error", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}
process.on("SIGTERM", () => cleanup("SIGTERM"));
process.on("SIGINT", () => cleanup("SIGINT"));
process.on("SIGHUP", () => cleanup("SIGHUP"));

httpServer = app.listen(PORT, () => {
  logger.info(`mcp-graph server listening on http://localhost:${PORT}/mcp`);
  void logEmbeddingModeOnBoot();
});
