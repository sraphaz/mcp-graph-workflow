/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ScaffoldChange } from "./scaffold.js";

/**
 * Idempotent MCP config emitters.
 *
 * Each emitter produces one JSON file and reports a `ScaffoldChange`. The
 * write is skipped if the existing content is structurally identical to
 * what we'd produce. `force=true` overrides this and always writes.
 *
 * Output shape (Anthropic / Claude Code MCP config convention):
 *   {
 *     "mcpServers": {
 *       "mcp-graph": {
 *         "command": "npx",
 *         "args": ["-y", "@mcp-graph-workflow/mcp-graph"],
 *         "env": {}
 *       }
 *     }
 *   }
 *
 * VS Code uses the same shape under `.vscode/mcp.json` (with optional
 * `inputs` array). Cursor uses the same under `.cursor/mcp.json`.
 */

export interface McpConfigOptions {
  readonly force?: boolean;
  /** Override the command (e.g. "mcp-graph" if globally installed, vs "npx"). */
  readonly command?: string;
  /** Override the args list. */
  readonly args?: readonly string[];
  /** When true, compute the change but never write to disk. */
  readonly dryRun?: boolean;
}

export interface McpServerEntry {
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: Record<string, string>;
}

const SERVER_NAME = "mcp-graph";

function defaultEntry(opts: McpConfigOptions): McpServerEntry {
  const command = opts.command ?? "npx";
  const args = opts.args ?? ["-y", "@mcp-graph-workflow/mcp-graph"];
  return { command, args, env: {} };
}

export function emitRootMcpConfig(
  cwd: string,
  opts: McpConfigOptions = {},
): ScaffoldChange {
  return writeMcpFile(join(cwd, ".mcp.json"), opts);
}

export function emitVsCodeMcpConfig(
  cwd: string,
  opts: McpConfigOptions = {},
): ScaffoldChange {
  return writeMcpFile(join(cwd, ".vscode", "mcp.json"), opts);
}

export function emitCursorMcpConfig(
  cwd: string,
  opts: McpConfigOptions = {},
): ScaffoldChange {
  return writeMcpFile(join(cwd, ".cursor", "mcp.json"), opts);
}

function writeMcpFile(
  path: string,
  opts: McpConfigOptions,
): ScaffoldChange {
  const entry = defaultEntry(opts);
  const desired = {
    mcpServers: {
      [SERVER_NAME]: entry,
    },
  };
  const desiredJson = `${JSON.stringify(desired, null, 2)}\n`;

  const exists = existsSync(path);
  if (exists && !opts.force) {
    const current = readFileSync(path, "utf8");
    if (current === desiredJson) {
      return { path, action: "skipped-noop", bytes: current.length };
    }
    if (hasServerRegistered(current)) {
      return { path, action: "skipped-existing", bytes: current.length };
    }
    const merged = mergeServerInto(current, entry);
    if (merged !== null) {
      if (!opts.dryRun) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, merged, "utf8");
      }
      return { path, action: "patched", bytes: merged.length };
    }
  }

  if (!opts.dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, desiredJson, "utf8");
  }
  return {
    path,
    action: exists ? "patched" : "created",
    bytes: desiredJson.length,
  };
}

function hasServerRegistered(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as {
      mcpServers?: Record<string, unknown>;
    };
    return Boolean(parsed?.mcpServers?.[SERVER_NAME]);
  } catch {
    return false;
  }
}

function mergeServerInto(
  current: string,
  entry: McpServerEntry,
): string | null {
  try {
    const parsed = JSON.parse(current) as {
      mcpServers?: Record<string, McpServerEntry>;
      [key: string]: unknown;
    };
    const next = {
      ...parsed,
      mcpServers: {
        ...(parsed.mcpServers ?? {}),
        [SERVER_NAME]: entry,
      },
    };
    return `${JSON.stringify(next, null, 2)}\n`;
  } catch {
    return null;
  }
}
