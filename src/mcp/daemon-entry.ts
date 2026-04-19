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

/**
 * mcp-graph-daemon — long-lived per-workspace process that owns the heavy
 * singletons (SqliteStore, ONNX session, LSP clients) and serves any number
 * of stdio-proxy clients over a Unix socket / named pipe.
 *
 * Lifecycle:
 *   1. Resolve per-workspace paths + acquire pidfile lock (fail fast if a
 *      live daemon already owns this workspace).
 *   2. Open the store, wire the event bus.
 *   3. startDaemonRunner listens on the socket.
 *   4. Clean up on SIGTERM/SIGINT/SIGHUP (close connections, flush WAL,
 *      release lock, remove socket file).
 */

import { SqliteStore } from "../core/store/sqlite-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { loadConfig } from "../core/config/config-loader.js";
import { logger } from "../core/utils/logger.js";
import { resolveDaemonPaths, ensureStateDir } from "../core/daemon/daemon-paths.js";
import { acquireLock, releaseLock } from "../core/daemon/daemon-lockfile.js";
import { startDaemonRunner } from "./daemon/runner.js";
import { registerDaemon, unregisterDaemon } from "./daemon/daemon-registry.js";

const workspace = process.argv[2] ?? process.cwd();
const paths = resolveDaemonPaths(workspace);
ensureStateDir(paths);

try {
  acquireLock(paths.pidFile);
} catch (err) {
  process.stderr.write(`daemon: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
}

// Validate config early — a bad config should crash with a clear message
// before we bind the socket and accept clients.
loadConfig(workspace);

const store = SqliteStore.open(workspace);
const eventBus = new GraphEventBus();
store.eventBus = eventBus;

// Idle auto-shutdown: controlled via env var so ops can tune without rebuilding.
// `0` or unset → stay alive forever (safest default for interactive use).
const idleShutdownMs = parseInt(process.env.MCP_DAEMON_IDLE_MS ?? "0", 10);

const resolvedIdleMs = Number.isFinite(idleShutdownMs) && idleShutdownMs > 0 ? idleShutdownMs : undefined;
const handle = await startDaemonRunner({
  socketPath: paths.socketPath,
  store,
  idleShutdownMs: resolvedIdleMs,
  onIdleShutdown: () => void shutdown("idle-timeout"),
});
registerDaemon({
  handle,
  socketPath: paths.socketPath,
  workspacePath: workspace,
  idleShutdownMs: resolvedIdleMs ?? 0,
});
logger.info("daemon:ready", {
  socket: paths.socketPath,
  workspace,
  idleShutdownMs: idleShutdownMs > 0 ? idleShutdownMs : null,
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("daemon:shutdown", { signal });
  try {
    unregisterDaemon();
    await handle.close();
    store.close();
  } catch (err) {
    logger.error("daemon:shutdown:error", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    releaseLock(paths.pidFile);
    process.exit(0);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGHUP", () => void shutdown("SIGHUP"));
