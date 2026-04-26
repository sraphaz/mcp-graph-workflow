/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Self-contained feature-depth check called from finish_task.
 *
 * Reads each touched file, computes its score via the TS scoreFile,
 * compares against the prior baseline, returns a report with:
 *   - regressions (drops > threshold) as warnings (NOT blockers by
 *     default — advisory mode mirrors harness pattern)
 *   - upward quadrant crossings as memory-worthy events
 *   - per-file before/after for the JSON response
 *
 * The function then UPSERTs the new baselines and writes memory
 * entries for positive crossings — finish-task just calls it and
 * appends the report to its result.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { SqliteStore } from "../store/sqlite-store.js";
import { logger } from "../utils/logger.js";
import { writeMemory } from "../memory/memory-reader.js";
import { scoreFile, type FileScore } from "./score-file.js";
import { quadrantOf } from "./quadrant.js";
import {
  detectQuadrantCrossing,
  type CrossingEvent,
} from "./quadrant-crossing.js";
import {
  checkFeatureDepthRegression,
  type RegressionResult,
} from "./regression-gate.js";
import {
  getBaseline,
  upsertBaseline,
} from "./baselines-store.js";

export interface FeatureDepthFileResult {
  readonly relPath: string;
  readonly module: string;
  readonly before: number | null;
  readonly after: number;
  readonly delta: number;
  readonly regression: RegressionResult | null;
  readonly crossing: CrossingEvent | null;
}

export type FeatureDepthMode = "strict" | "advisory" | "off";

export interface FeatureDepthReport {
  readonly files: FeatureDepthFileResult[];
  /** Active gate mode resolved from project_settings.feature_depth_mode. */
  readonly mode: FeatureDepthMode;
  /** Always populated. In advisory mode caller does not block on these. */
  readonly warnings: string[];
  /** Populated only when mode === "strict". Caller pushes into its blockers. */
  readonly blockers: string[];
  readonly upwardCrossings: number;
  readonly downwardCrossings: number;
}

/**
 * Read the gate mode from project_settings. Defaults to "advisory" so
 * existing projects don't suddenly start blocking on feature-depth
 * regressions — strict promotion is opt-in via
 * `set_phase({ featureDepth: "strict" })`.
 */
function resolveMode(input: FeatureDepthCheckInput): FeatureDepthMode {
  try {
    const raw = input.store.getProjectSetting("feature_depth_mode");
    if (raw === "strict" || raw === "off") return raw;
  } catch {
    // fall through to advisory
  }
  return "advisory";
}

export interface FeatureDepthCheckInput {
  readonly store: SqliteStore;
  readonly projectRoot: string;
  readonly nodeId: string;
  readonly touchedFiles: readonly string[];
}

/**
 * Read a file's content + LOC, plus its adjacent test file LOC if
 * one exists. Returns null when the source file isn't readable —
 * the caller treats that as "skip, no signal".
 */
function readFileWithTest(absPath: string): {
  content: string;
  sourceLoc: number;
  testLoc: number;
} | null {
  if (!existsSync(absPath)) return null;
  let content: string;
  try {
    content = readFileSync(absPath, "utf-8");
  } catch {
    return null;
  }
  const sourceLoc = content.split("\n").filter((l) => l.trim().length > 0).length;

  // Adjacent test: foo.ts → foo.test.ts in the same dir.
  const dir = dirname(absPath);
  const base = basename(absPath).replace(/\.(ts|tsx)$/, "");
  let testLoc = 0;
  for (const suf of [".test.ts", ".spec.ts", ".test.tsx", ".spec.tsx"]) {
    const candidate = join(dir, base + suf);
    if (existsSync(candidate)) {
      try {
        const testContent = readFileSync(candidate, "utf-8");
        testLoc = testContent.split("\n").filter((l) => l.trim().length > 0).length;
        break;
      } catch {
        // ignore
      }
    }
  }
  return { content, sourceLoc, testLoc };
}

/** Extract module name from `src/core/<module>/...`, else "" */
function moduleOf(relPath: string): string {
  const m = /^src\/core\/([^/]+)/.exec(relPath);
  return m?.[1] ?? "";
}

/** Best-effort write of a memory entry for an upward crossing. Never throws. */
async function writeCrossingMemory(
  projectRoot: string,
  result: FeatureDepthFileResult,
  nodeId: string,
): Promise<void> {
  if (!result.crossing || result.crossing.direction !== "up") return;
  const date = new Date().toISOString().slice(0, 10);
  const memoryName = `feature-depth/${result.module || "_"}/deepened-${date}-${result.relPath.replace(/\//g, "_")}`;
  const content =
    `# deepened: \`${result.relPath}\`\n\n` +
    `**${result.before?.toFixed(1) ?? "?"}** → **${result.after.toFixed(1)}** ` +
    `(${result.delta > 0 ? "+" : ""}${result.delta.toFixed(1)} pts) on ${date}.\n\n` +
    `Crossed: \`${result.crossing.from}\` → \`${result.crossing.to}\`. ` +
    `Touched in node \`${nodeId}\`.\n`;
  try {
    await writeMemory(projectRoot, memoryName, content);
  } catch (err) {
    logger.warn("feature-depth:memory-write-failed", {
      relPath: result.relPath,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Run the feature-depth check for a finish_task invocation. Returns
 * a structured report; the caller decides how to surface warnings
 * (advisory vs strict). UPSERTs baselines and writes memories as a
 * side effect — fire-and-forget, non-blocking.
 */
export async function runFeatureDepthCheck(
  input: FeatureDepthCheckInput,
): Promise<FeatureDepthReport> {
  const mode = resolveMode(input);
  if (mode === "off") {
    return { files: [], mode, warnings: [], blockers: [], upwardCrossings: 0, downwardCrossings: 0 };
  }
  const files: FeatureDepthFileResult[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];
  let upwardCrossings = 0;
  let downwardCrossings = 0;

  for (const rel of input.touchedFiles) {
    if (!rel.endsWith(".ts") && !rel.endsWith(".tsx")) continue;
    if (rel.endsWith(".test.ts") || rel.endsWith(".spec.ts")) continue;
    if (!rel.startsWith("src/")) continue;

    const abs = resolve(input.projectRoot, rel);
    const fileData = readFileWithTest(abs);
    if (!fileData) continue;

    const mod = moduleOf(rel);
    const score: FileScore = scoreFile({
      relPath: rel,
      module: mod,
      content: fileData.content,
      sourceLoc: fileData.sourceLoc,
      testLoc: fileData.testLoc,
    });

    const prior = getBaseline(input.store.getDb(), rel);
    const before = prior?.score ?? null;
    const regression = checkFeatureDepthRegression({
      relPath: rel,
      before,
      after: score.score,
    });
    if (regression.regressed && regression.message) {
      warnings.push(regression.message);
      if (mode === "strict") {
        blockers.push(regression.message);
      }
    }

    const crossing = detectQuadrantCrossing(before, score.score);
    if (crossing) {
      if (crossing.direction === "up") upwardCrossings++;
      else downwardCrossings++;
    }

    const result: FeatureDepthFileResult = {
      relPath: rel,
      module: mod,
      before,
      after: score.score,
      delta: before === null ? 0 : score.score - before,
      regression: regression.regressed ? regression : null,
      crossing,
    };
    files.push(result);

    // UPSERT baseline (best-effort, non-blocking).
    upsertBaseline(input.store.getDb(), {
      relPath: rel,
      module: mod,
      score: score.score,
      quadrant: quadrantOf(score.score),
      testLoc: fileData.testLoc,
      sourceLoc: fileData.sourceLoc,
    });

    // Memory write for upward crossings (best-effort, non-blocking).
    if (crossing?.direction === "up") {
      void writeCrossingMemory(input.projectRoot, result, input.nodeId);
    }
  }

  return { files, mode, warnings, blockers, upwardCrossings, downwardCrossings };
}
