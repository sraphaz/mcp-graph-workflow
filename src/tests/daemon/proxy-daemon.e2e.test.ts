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
 * End-to-end test: spawn the real daemon + proxy as child processes, drive
 * them through `initialize` and `tools/list`. The daemon must already have
 * been built (`npm run build`) so that `dist/mcp/daemon-entry.js` and
 * `dist/mcp/stdio-proxy.js` exist. The test skips itself gracefully if the
 * build artifacts are missing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FrameBuffer, encodeFrame } from "../../core/daemon/daemon-protocol.js";
import { resolveDaemonPaths } from "../../core/daemon/daemon-paths.js";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const DAEMON_ENTRY = path.join(REPO_ROOT, "dist", "mcp", "daemon-entry.js");
const PROXY_ENTRY = path.join(REPO_ROOT, "dist", "mcp", "stdio-proxy.js");
const BUILT = fs.existsSync(DAEMON_ENTRY) && fs.existsSync(PROXY_ENTRY);

/**
 * SIGTERM the child and SIGKILL it after `timeoutMs` if it didn't exit. Always
 * resolves once the child is gone — never leaves a zombie daemon behind.
 */
async function killChildSafely(child: ChildProcess, timeoutMs = 3000): Promise<void> {
  if (child.killed || child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  const killer = setTimeout(() => {
    if (!child.killed && child.exitCode === null) child.kill("SIGKILL");
  }, timeoutMs);
  try {
    await exited;
  } finally {
    clearTimeout(killer);
  }
}

async function waitForSocket(socketPath: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(socketPath)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timeout waiting for socket at ${socketPath}`);
}

async function readFrame(buf: FrameBuffer, source: NodeJS.ReadableStream, matchId: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer): void => {
      try {
        const frames = buf.feed(chunk.toString("utf8"));
        for (const f of frames) {
          const msg = f as Record<string, unknown>;
          if (msg.id === matchId) {
            source.off("data", onData);
            resolve(msg);
            return;
          }
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    source.on("data", onData);
    source.once("error", reject);
  });
}

describe.skipIf(!BUILT)("daemon + proxy (E2E via child_process)", () => {
  let workspace: string;
  let daemon: ChildProcess;
  let proxy: ChildProcess | null = null;
  let socketPath: string;
  let pidFile: string;

  beforeEach(async () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-graph-e2e-"));
    const paths = resolveDaemonPaths(workspace);
    socketPath = paths.socketPath;
    pidFile = paths.pidFile;

    // Clean any leftover socket/pidfile from a previous run of the same hash.
    for (const p of [socketPath, pidFile]) {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }

    daemon = spawn(process.execPath, [DAEMON_ENTRY, workspace], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const daemonErr: string[] = [];
    daemon.stderr!.on("data", (c: Buffer) => daemonErr.push(c.toString("utf8")));
    daemon.stdout!.on("data", (c: Buffer) => daemonErr.push("[stdout] " + c.toString("utf8")));
    try {
      await waitForSocket(socketPath);
    } catch (err) {
      throw new Error(
        `${(err as Error).message}\n--- daemon output ---\n${daemonErr.join("")}`,
        { cause: err },
      );
    }
  }, 30_000);

  afterEach(async () => {
    // Always wait for both children to actually exit, escalating to SIGKILL
    // after a timeout. A zombie daemon would otherwise leak across runs and
    // pollute /tmp/mcp-graph-e2e-*.
    if (proxy) await killChildSafely(proxy);
    await killChildSafely(daemon);
    try { fs.rmSync(workspace, { recursive: true, force: true }); } catch { /* ignore */ }
    try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
  });

  it("proxy auto-starts the daemon when no pre-spawned daemon exists", async () => {
    // Kill the preSpawned daemon from beforeEach so we start cold.
    daemon.kill("SIGTERM");
    await new Promise((r) => daemon.once("exit", r));
    try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }

    proxy = spawn(process.execPath, [PROXY_ENTRY], {
      cwd: workspace,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stderrChunks: string[] = [];
    proxy.stderr!.on("data", (c: Buffer) => stderrChunks.push(c.toString("utf8")));

    const buf = new FrameBuffer();
    const stdout = proxy.stdout!;

    proxy.stdin!.write(encodeFrame({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "e2e-autostart", version: "0" },
      },
    }));

    const init = await readFrame(buf, stdout, 1);
    expect(init.result).toMatchObject({ serverInfo: { name: "mcp-graph" } });
    // Auto-spawn success implies a pidfile was written by the spawned daemon.
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline && !fs.existsSync(pidFile)) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!fs.existsSync(pidFile)) {
      throw new Error(
        `pidfile ${pidFile} never appeared. proxy stderr:\n${stderrChunks.join("")}`,
      );
    }
  }, 30_000);

  it("routes initialize + tools/list through the proxy", async () => {
    proxy = spawn(process.execPath, [PROXY_ENTRY], {
      cwd: workspace,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const buf = new FrameBuffer();
    const stdout = proxy.stdout!;

    proxy.stdin!.write(encodeFrame({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "e2e", version: "0" },
      },
    }));

    const init = await readFrame(buf, stdout, 1);
    expect(init.result).toMatchObject({ serverInfo: { name: "mcp-graph" } });

    proxy.stdin!.write(encodeFrame({ jsonrpc: "2.0", method: "notifications/initialized" }));
    proxy.stdin!.write(encodeFrame({ jsonrpc: "2.0", id: 2, method: "tools/list" }));

    const list = await readFrame(buf, stdout, 2);
    expect(list.result).toMatchObject({ tools: expect.any(Array) });
    const tools = (list.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.length).toBeGreaterThan(10);
  }, 20_000);
});
