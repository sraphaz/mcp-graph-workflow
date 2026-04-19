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
 * Daemon runtime — owns a single `net.Server` that spawns one MCP server per
 * client connection, all sharing the heavy singletons (SqliteStore, event bus,
 * ONNX session, LSP clients) held by the hosting process.
 *
 * Extracted into its own module so the integration tests can drive the daemon
 * in-process without shelling out.
 */

import net, { type Server, type Socket } from "node:net";
import fs from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { registerAllTools } from "../tools/index.js";
import { SocketTransport } from "./socket-transport.js";
import { logger } from "../../core/utils/logger.js";

export interface DaemonRunnerOptions {
  /** Absolute socket path (or `\\\\.\\pipe\\...` name on Windows). */
  socketPath: string;
  /** Shared backing store — reused across all client connections. */
  store: SqliteStore;
  /** MCP server name surfaced to the client during `initialize`. */
  serverName?: string;
  /** MCP server version surfaced to the client during `initialize`. */
  serverVersion?: string;
  /**
   * When set, the daemon fires `onIdleShutdown` after the client count has
   * been zero for this many milliseconds. The runner itself does not exit —
   * the callback is responsible for graceful teardown. Omit to keep the
   * daemon running indefinitely.
   */
  idleShutdownMs?: number;
  /**
   * Callback invoked once when the idle timer elapses. Fired at most once
   * per runner lifetime.
   */
  onIdleShutdown?: () => void | Promise<void>;
}

export interface DaemonRunnerHandle {
  server: Server;
  /** Number of currently-open client connections. */
  clientCount(): number;
  /** Close the listening socket, terminate open connections. */
  close(): Promise<void>;
}

/**
 * Start the daemon listening on `options.socketPath`. The returned handle lets
 * the caller observe active clients and shut down gracefully.
 */
export async function startDaemonRunner(options: DaemonRunnerOptions): Promise<DaemonRunnerHandle> {
  const { socketPath, store } = options;
  const serverName = options.serverName ?? "mcp-graph";
  const serverVersion = options.serverVersion ?? "1.0.0";

  // A stale socket file from a crashed daemon prevents `listen()` from binding.
  if (process.platform !== "win32") {
    try {
      fs.unlinkSync(socketPath);
    } catch {
      /* not present — fine */
    }
  }

  const connections = new Set<Socket>();
  let idleSince: number | null = Date.now();
  let idleFired = false;

  const server = net.createServer((socket) => {
    connections.add(socket);
    idleSince = null;
    socket.once("close", () => {
      connections.delete(socket);
      if (connections.size === 0) idleSince = Date.now();
    });

    const mcp = new McpServer(
      { name: serverName, version: serverVersion },
      { capabilities: { tools: {} } },
    );
    registerAllTools(mcp, store);

    const transport = new SocketTransport(socket);
    void mcp.connect(transport).catch((err: unknown) => {
      logger.warn("daemon:mcp-connect-failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      socket.destroy();
    });
  });

  let idleTimer: ReturnType<typeof setInterval> | null = null;
  if (options.idleShutdownMs && options.idleShutdownMs > 0 && options.onIdleShutdown) {
    const checkIntervalMs = Math.min(options.idleShutdownMs, 30_000);
    idleTimer = setInterval(() => {
      if (idleFired) return;
      if (connections.size > 0 || idleSince === null) return;
      if (Date.now() - idleSince >= (options.idleShutdownMs ?? 0)) {
        idleFired = true;
        logger.info("daemon:idle-shutdown", { idleMs: Date.now() - idleSince });
        Promise.resolve(options.onIdleShutdown?.()).catch((err: unknown) => {
          logger.warn("daemon:idle-shutdown-callback-failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }, checkIntervalMs);
    idleTimer.unref();
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error): void => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(socketPath);
  });

  logger.info("daemon:listening", { socketPath });

  return {
    server,
    clientCount: () => connections.size,
    close: async () => {
      if (idleTimer) {
        clearInterval(idleTimer);
        idleTimer = null;
      }
      for (const socket of connections) {
        socket.destroy();
      }
      connections.clear();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (process.platform !== "win32") {
        try {
          fs.unlinkSync(socketPath);
        } catch {
          /* ignore */
        }
      }
    },
  };
}
