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
import { ProfileFilterSchema } from "./tools/taxonomy.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { setSharedHookBus } from "../core/hooks/shared-hook-bus.js";
import { emitSessionStart, emitSessionEnd, installSessionEndHandlers } from "../core/hooks/session-lifecycle.js";
import { rehydrateHooks } from "../core/hooks/rehydrate.js";
import { registerBuiltinHandlers } from "../core/hooks/builtin-handlers.js";
import { getSharedHookRegistry, setSharedHookStatsStore } from "./tools/hooks.js";
import { HookStatsStore } from "../core/hooks/hook-stats-store.js";
import { installGraphEventBridge } from "../core/hooks/graph-event-bridge.js";
import { loadHookConfig } from "../core/hooks/config-loader.js";
import { getSharedHookBus } from "../core/hooks/shared-hook-bus.js";
import { logger } from "../core/utils/logger.js";
import { loadConfig } from "../core/config/config-loader.js";
import { createApp } from "./app-factory.js";
import { StoreManager } from "../core/store/store-manager.js";
import { reindexCodeForProject } from "../core/code/code-indexer.js";
import { logEmbeddingModeOnBoot } from "../core/rag/onnx-embeddings.js";
import { MemoryTelemetry } from "../core/utils/memory-telemetry.js";

const config = loadConfig();
const PORT = config.port;

// ── Store Manager + Event Bus ────────────────────────────
const storeManager = StoreManager.create(process.cwd());
const eventBus = new GraphEventBus();
storeManager.store.eventBus = eventBus;

// Wire HookBus to share the same GraphEventBus, so hook lifecycle events
// (session/task/tool/agent/memory/swarm) and graph events stay coordinated.
setSharedHookBus(new HookBus(eventBus));

// Register built-in handlers (audit, telemetry, anti-hallucination,
// approval-required, harness regression, verified-auto-promote). Always-on
// by default — they are the safety net that prevents drift between "marked
// done" and "actually delivered" and surfaces hallucinated phrases.
// Disable via MCP_GRAPH_HOOKS_DISABLED=true (test mode) or
// MCP_GRAPH_VERIFIED_AUTO_PROMOTE=off (granular toggle for the promotion
// handler only).
try {
  registerBuiltinHandlers(getSharedHookBus(), storeManager.store);
} catch (err) {
  logger.warn("hooks:builtin:register_failed", {
    error: err instanceof Error ? err.message : String(err),
  });
}

// ── MCP Server ───────────────────────────────────────────
const mcp = new McpServer(
  { name: "mcp-graph", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

const profile = ProfileFilterSchema.safeParse(process.env.MCP_GRAPH_PROFILE).data ?? "all";
await registerAllTools(mcp, storeManager.store, profile);

// Sprint 5 (Observability) — wire stats store BEFORE rehydration so any
// rehydrated handler call lands in stats from its first invocation.
try {
  setSharedHookStatsStore(new HookStatsStore(storeManager.store.getDb()));
} catch (err) {
  logger.warn("hooks:stats:wire_failed", { error: err instanceof Error ? err.message : String(err) });
}

// Sprint 3 (Persistence) — rehydrate runtime hook handlers from DB +
// project/user/local config files BEFORE the first tool dispatch.
try {
  rehydrateHooks(getSharedHookRegistry(), storeManager.store.getDb(), { cwd: storeManager.basePath });
} catch (err) {
  logger.warn("hooks:rehydrate:failed", { error: err instanceof Error ? err.message : String(err) });
}

// Sprint 4 (Bridge) — install opt-in GraphEventBus → HookBus mapping.
try {
  const hookConfig = loadHookConfig({ cwd: storeManager.basePath });
  if (Object.keys(hookConfig.graphEventBridge).length > 0) {
    installGraphEventBridge(eventBus, getSharedHookBus(), { mapping: hookConfig.graphEventBridge });
  }
} catch (err) {
  logger.warn("hooks:bridge:install_failed", { error: err instanceof Error ? err.message : String(err) });
}

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
    const resultValue = await reindexCodeForProject(storeManager.store, basePath);
    logger.info(`code-graph:${label}`, {
      files: resultValue.fileCount,
      symbols: resultValue.symbolCount,
      relations: resultValue.relationCount,
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
// ── Memory telemetry (30s heap log + pressure events) ────
const memoryTelemetry = new MemoryTelemetry({ eventBus });
const stopMemoryTelemetry = memoryTelemetry.start();

// eslint-disable-next-line prefer-const -- assigned after function definition
let httpServer: ReturnType<typeof app.listen>;

function cleanup(signal: string): void {
  logger.info("server:shutdown", { signal });
  emitSessionEnd(signal);
  try {
    // 0. Stop periodic timers
    stopMemoryTelemetry();
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
  emitSessionStart();
});

// Belt-and-suspenders: also catch SIGHUP / beforeExit beyond the cleanup() path
installSessionEndHandlers();
