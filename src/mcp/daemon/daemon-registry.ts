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
 * Module-level registry so the `daemon_status` MCP tool can observe the
 * running daemon without an explicit dependency wire-through. The daemon
 * entry point calls `registerDaemon` after `startDaemonRunner` succeeds; the
 * tool reads live state via `getDaemonStatus`.
 *
 * When mcp-graph is invoked in legacy stdio mode (no daemon), the registry
 * stays empty and the tool reports `{ mode: "inactive" }`.
 */

import type { DaemonRunnerHandle } from "./runner.js";

export interface DaemonStatusInfo {
  mode: "daemon" | "inactive";
  /** ISO timestamp of daemon start — present only when mode === "daemon". */
  startedAt?: string;
  /** Seconds since startedAt. Present only when mode === "daemon". */
  uptimeSec?: number;
  /** Live count of connected clients. Present only when mode === "daemon". */
  clientCount?: number;
  /** Absolute socket path (Unix socket or Windows named pipe). */
  socketPath?: string;
  /** Workspace path the daemon was started with. */
  workspacePath?: string;
  /** Daemon process id. */
  pid?: number;
  /** Idle auto-shutdown threshold (MCP_DAEMON_IDLE_MS), 0 = disabled. */
  idleShutdownMs?: number;
}

interface Registration {
  handle: DaemonRunnerHandle;
  startedAt: string;
  startedAtMs: number;
  socketPath: string;
  workspacePath: string;
  pid: number;
  idleShutdownMs: number;
}

let active: Registration | null = null;

/** registerDaemon — auto-generated description placeholder. */
export function registerDaemon(reg: {
  handle: DaemonRunnerHandle;
  socketPath: string;
  workspacePath: string;
  idleShutdownMs?: number;
}): void {
  const now = new Date();
  active = {
    handle: reg.handle,
    startedAt: now.toISOString(),
    startedAtMs: now.getTime(),
    socketPath: reg.socketPath,
    workspacePath: reg.workspacePath,
    pid: process.pid,
    idleShutdownMs: reg.idleShutdownMs ?? 0,
  };
}

/** unregisterDaemon — auto-generated description placeholder. */
export function unregisterDaemon(): void {
  active = null;
}

/** getDaemonStatus — auto-generated description placeholder. */
export function getDaemonStatus(): DaemonStatusInfo {
  if (!active) return { mode: "inactive" };
  const uptimeMs = Date.now() - active.startedAtMs;
  return {
    mode: "daemon",
    startedAt: active.startedAt,
    uptimeSec: Math.round(uptimeMs / 1000),
    clientCount: active.handle.clientCount(),
    socketPath: active.socketPath,
    workspacePath: active.workspacePath,
    pid: active.pid,
    idleShutdownMs: active.idleShutdownMs,
  };
}
