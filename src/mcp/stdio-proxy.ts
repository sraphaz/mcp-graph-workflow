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
 * mcp-graph-proxy — thin stdio ↔ socket bridge.
 *
 * Invoked by the agent host (Claude Code, etc.) via `.mcp.json` in place of
 * the regular stdio entry point. This process:
 *   1. Resolves the per-workspace socket path.
 *   2. Tries to connect; if the daemon is not running, auto-spawns it
 *      (detached, `unref`-ed, logs to daemon.log) and retries with backoff.
 *   3. Pipes stdin → socket and socket → stdout. The agent host speaks MCP
 *      over NDJSON as usual; the daemon on the other side handles everything.
 *
 * This file contains no business logic — it is pure glue. Staying small is
 * the point: each concurrent agent spawns one proxy (~few MB), not a full
 * mcp-graph process (~80MB+).
 */

import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { resolveDaemonPaths, ensureStateDir } from "../core/daemon/daemon-paths.js";

const CONNECT_ATTEMPTS = 10;
const CONNECT_TIMEOUT_MS = 500;
const RETRY_DELAY_MS = 300;

const workspace = process.cwd();
const paths = resolveDaemonPaths(workspace);
ensureStateDir(paths);

function tryConnect(): Promise<net.Socket | null> {
  return new Promise((resolve) => {
    const sock = net.createConnection(paths.socketPath);
    const timer = setTimeout(() => {
      sock.destroy();
      resolve(null);
    }, CONNECT_TIMEOUT_MS);
    sock.once("connect", () => {
      clearTimeout(timer);
      resolve(sock);
    });
    sock.once("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

function spawnDaemon(): void {
  // daemon-entry.js lives next to this file in the built output.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const daemonScript = path.join(here, "daemon-entry.js");
  const logFd = fs.openSync(paths.logFile, "a");
  const child = spawn(process.execPath, [daemonScript, workspace], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
}

async function connectWithAutoStart(): Promise<net.Socket> {
  for (let attempt = 0; attempt < CONNECT_ATTEMPTS; attempt++) {
    const sock = await tryConnect();
    if (sock) return sock;
    if (attempt === 0) {
      try {
        spawnDaemon();
      } catch (err) {
        process.stderr.write(
          `mcp-graph-proxy: failed to spawn daemon: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  throw new Error(`Could not connect to daemon at ${paths.socketPath}`);
}

try {
  const sock = await connectWithAutoStart();
  process.stdin.pipe(sock);
  sock.pipe(process.stdout);
  sock.on("close", () => process.exit(0));
  sock.on("error", (err) => {
    process.stderr.write(`mcp-graph-proxy: socket error: ${err.message}\n`);
    process.exit(1);
  });
  process.stdin.on("end", () => sock.end());
} catch (err) {
  process.stderr.write(
    `mcp-graph-proxy: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
}
