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
 * B10 (P2): mcp-graph serve must surface EADDRINUSE clearly when the
 * configured port is already in use, instead of dying silently after a
 * misleading "listening" log line.
 *
 * Repro: hold port N → spawn `mcp-graph serve --port N` → second process
 * must exit 1 with stderr containing "Port N already in use".
 *
 * Fix lives in src/mcp/server.ts:200-211 — httpServer.on('error', ...).
 *
 * Source: mcp-graph notebook node_71959460a80e.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:net";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLI_ENTRY } from "./repro.js";

let blocker: Server;
let blockedPort: number;

function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      if (typeof addr === "object" && addr) {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("could not allocate port"));
      }
    });
  });
}

describe("B10 — serve surfaces EADDRINUSE", () => {
  beforeAll(async () => {
    blockedPort = await pickFreePort();
    // Dual-stack bind so the mcp-graph server (which listens on default host
    // i.e. dual-stack) actually conflicts. A 127.0.0.1-only blocker would
    // silently coexist with a dual-stack listener on macOS.
    await new Promise<void>((resolve, reject) => {
      blocker = createServer();
      blocker.on("error", reject);
      blocker.listen({ port: blockedPort, host: "::", ipv6Only: false }, () => resolve());
    });
  });

  afterAll(() => {
    blocker?.close();
  });

  it("exits non-zero with friendly EADDRINUSE message when port is taken", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpg-b10-"));
    try {
      const result = spawnSync(
        process.execPath,
        [CLI_ENTRY, "serve", "--port", String(blockedPort)],
        {
          cwd: dir,
          encoding: "utf-8",
          env: { ...process.env, MCP_PORT: String(blockedPort) },
          timeout: 12000,
        },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/already in use/i);
      expect(result.stderr).toContain(String(blockedPort));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
