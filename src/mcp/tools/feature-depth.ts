/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * MCP Tool — feature_depth
 *
 * Surfaces the Go feature-depth tool to the agent. Five actions:
 *   - score:    file-level scores for the project
 *   - audit:    full 16-dim module-level audit + quadrants
 *   - growth:   git-history LOC analysis + sparkline
 *   - diff:     compare current scores vs a stored baseline
 *   - baselines: read baselines from SQLite (the lifecycle DAO)
 *
 * The first four shell out to `tools/feature-depth/` (Go binary).
 * `baselines` reads the SQLite table populated by finish_task and
 * doesn't need Go installed.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { join } from "node:path";
import {
  isGoAvailable,
  runFeatureDepthGo,
} from "../../core/feature-depth/runner.js";
import {
  getBaseline,
  getBaselinesByModule,
} from "../../core/feature-depth/baselines-store.js";
import { writeTrendMemory } from "../../core/feature-depth/trend-memory.js";
import { createLogger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

const log = createLogger({ layer: "mcp", source: "feature-depth.ts" });

const FEATURE_DEPTH_ACTIONS = ["score", "audit", "growth", "diff", "baselines", "trend"] as const;
type FeatureDepthAction = (typeof FEATURE_DEPTH_ACTIONS)[number];

const GO_INSTALL_HINT =
  "Go is required for score/audit/growth/diff actions. Install Go ≥ 1.22 from https://go.dev/dl/ — `baselines` action is the only one that works without Go.";

interface RunGoOpts {
  readonly cwd: string;
  readonly args: readonly string[];
}

async function runGoOrError(opts: RunGoOpts): Promise<{
  ok: boolean;
  data?: unknown;
  error?: string;
}> {
  if (!(await isGoAvailable())) {
    return { ok: false, error: GO_INSTALL_HINT };
  }
  const resultValue = await runFeatureDepthGo({
    cwd: opts.cwd,
    toolPath: join(opts.cwd, "tools/feature-depth"),
    args: opts.args,
  });
  if (!resultValue.ok) {
    return {
      ok: false,
      error: resultValue.error ?? `go run failed (exit ${resultValue.exitCode ?? "null"})`,
    };
  }
  // Tool emits JSON to stdout when -output=json. Parse defensively.
  const trimmed = resultValue.stdout.trim();
  if (trimmed === "") {
    return { ok: true, data: { stdout: resultValue.stdout, stderr: resultValue.stderr } };
  }
  try {
    return { ok: true, data: JSON.parse(trimmed) };
  } catch {
    // Non-JSON output (e.g. table mode) — pass through as-is.
    return { ok: true, data: { output: resultValue.stdout } };
  }
}

/* ------------------------------------------------------------------ */
/*  Handlers (exported for testing)                                    */
/* ------------------------------------------------------------------ */

export async function handleFeatureDepthScore(cwd: string): Promise<unknown> {
  return runGoOrError({
    cwd,
    args: ["-dir", cwd, "-granularity=file", "-output=json"],
  });
}

/** handleFeatureDepthAudit — auto-generated description placeholder. */
export async function handleFeatureDepthAudit(cwd: string): Promise<unknown> {
  return runGoOrError({
    cwd,
    args: ["-dir", cwd, "-output=json"],
  });
}

/** handleFeatureDepthGrowth — auto-generated description placeholder. */
export async function handleFeatureDepthGrowth(cwd: string): Promise<unknown> {
  return runGoOrError({
    cwd,
    args: ["-dir", cwd, "-growth", "-output=json"],
  });
}

/** handleFeatureDepthDiff — auto-generated description placeholder. */
export async function handleFeatureDepthDiff(
  cwd: string,
  baselinePath: string,
): Promise<unknown> {
  return runGoOrError({
    cwd,
    args: [
      "-dir", cwd,
      "-granularity=file",
      "-output=json",
      "-baseline", baselinePath,
    ],
  });
}

/** handleFeatureDepthTrend — auto-generated description placeholder. */
export async function handleFeatureDepthTrend(
  store: SqliteStore,
  cwd: string,
): Promise<{ ok: boolean; memoryName?: string; reason?: string }> {
  return writeTrendMemory(store.getDb(), cwd);
}

/** handleFeatureDepthBaselines — auto-generated description placeholder. */
export function handleFeatureDepthBaselines(
  store: SqliteStore,
  filter?: { relPath?: string; module?: string },
): { ok: true; baselines: unknown[] } {
  const db = store.getDb();
  if (filter?.relPath) {
    const row = getBaseline(db, filter.relPath);
    return { ok: true, baselines: row ? [row] : [] };
  }
  if (filter?.module) {
    return { ok: true, baselines: getBaselinesByModule(db, filter.module) };
  }
  // No filter — return empty list with a hint, not the entire table.
  // Listing every baseline can be huge and the agent should be specific.
  return { ok: true, baselines: [] };
}

/* ------------------------------------------------------------------ */
/*  Registration                                                       */
/* ------------------------------------------------------------------ */

export function registerFeatureDepth(
  server: McpServer,
  store: SqliteStore,
): void {
  server.tool(
    "feature_depth",
    "Inspect feature-depth scores. Actions: score | audit | growth | diff | baselines | trend.",
    {
      action: z
        .enum(FEATURE_DEPTH_ACTIONS)
        .describe("Which feature-depth view to compute"),
      relPath: z
        .string()
        .optional()
        .describe("baselines: filter to a single file"),
      module: z
        .string()
        .optional()
        .describe("baselines: filter to one module"),
      baselinePath: z
        .string()
        .optional()
        .describe("diff: path to a previous file-mode JSON report"),
      cwd: z
        .string()
        .optional()
        .describe("Project root (defaults to process.cwd())"),
    },
    async (params) => {
      const cwd = params.cwd ?? process.cwd();
      const action: FeatureDepthAction = params.action;
      try {
        switch (action) {
          case "score":
            return mcpText(await handleFeatureDepthScore(cwd));
          case "audit":
            return mcpText(await handleFeatureDepthAudit(cwd));
          case "growth":
            return mcpText(await handleFeatureDepthGrowth(cwd));
          case "diff":
            if (!params.baselinePath) {
              return mcpError("baselinePath is required for action=diff");
            }
            return mcpText(await handleFeatureDepthDiff(cwd, params.baselinePath));
          case "baselines":
            return mcpText(handleFeatureDepthBaselines(store, {
              relPath: params.relPath,
              module: params.module,
            }));
          case "trend":
            return mcpText(await handleFeatureDepthTrend(store, cwd));
          default:
            return mcpError(`Unknown action: ${String(action)}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("feature_depth tool error", { action, error: msg });
        return mcpError(msg);
      }
    },
  );
}
