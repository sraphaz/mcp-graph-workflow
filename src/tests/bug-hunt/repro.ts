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
 * Helpers for bug-hunt regression tests. Each helper isolates the three
 * channels that get conflated when callers pipe CLI output through tail/head:
 *
 *   - exit code  → returned as `code: number`
 *   - stdout     → returned as `stdout: string`
 *   - stderr     → returned as `stderr: string`
 *
 * Lesson from batch 1: piping `mcp-graph cmd | tail -3` and reading `$?`
 * inspects tail's exit code, not the CLI's, which produced three false-positive
 * bugs (B8, B9, B16). These helpers always capture all three streams
 * separately so tests can assert on each.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Path to the locally-built CLI entry. Tests target dist/, not the global install. */
export const CLI_ENTRY = join(process.cwd(), "dist/cli/index.js");
export const STDIO_ENTRY = join(process.cwd(), "dist/mcp/stdio.js");
export const SERVER_ENTRY = join(process.cwd(), "dist/mcp/server.js");

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run the local CLI binary with the given args under a fresh temp cwd.
 * Returns exit code, stdout and stderr as separate fields. The temp dir
 * is destroyed after the call regardless of outcome.
 *
 * @param args - argv after the binary, e.g. ["doctor", "--json"]
 * @param opts.cwd - override the temp cwd; default = a fresh tmp dir
 * @param opts.input - optional stdin payload
 * @param opts.env - extra env vars merged on top of process.env
 * @param opts.timeoutMs - kill the child after this many ms (default 15s)
 */
export function runCli(
  args: string[],
  opts: {
    cwd?: string;
    input?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): CliResult {
  const ownCwd = opts.cwd === undefined;
  const cwd = opts.cwd ?? mkdtempSync(join(tmpdir(), "mcpg-bughunt-"));
  try {
    const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
      cwd,
      input: opts.input,
      encoding: "utf-8",
      env: { ...process.env, ...opts.env },
      timeout: opts.timeoutMs ?? 15_000,
    });
    return {
      code: result.status ?? -1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    if (ownCwd) {
      try {
        rmSync(cwd, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    }
  }
}

/**
 * Send one JSON-RPC request to the stdio MCP server and capture the first
 * response line. The server is killed via SIGTERM after `timeoutMs` even
 * if no response arrived, so a hung handler will not hang the test.
 */
export function runMcpRpc(
  request: { jsonrpc: "2.0"; id: number | string; method: string; params?: unknown },
  opts: { cwd?: string; timeoutMs?: number; env?: Record<string, string> } = {},
): { code: number; response: string; stderr: string } {
  const ownCwd = opts.cwd === undefined;
  const cwd = opts.cwd ?? mkdtempSync(join(tmpdir(), "mcpg-bughunt-"));
  try {
    const result = spawnSync(process.execPath, [STDIO_ENTRY], {
      cwd,
      input: JSON.stringify(request) + "\n",
      encoding: "utf-8",
      env: { ...process.env, MCP_STDIO_ONLY: "1", ...opts.env },
      timeout: opts.timeoutMs ?? 8_000,
    });
    return {
      code: result.status ?? -1,
      response: (result.stdout ?? "").split("\n").find((l) => l.startsWith("{")) ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    if (ownCwd) {
      try {
        rmSync(cwd, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    }
  }
}
