/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * `mcp-graph review-depth` — pre-push / PR review of feature-depth deltas.
 *
 * Strategy: snapshot the merge-base score JSON, run the analyzer at HEAD
 * with --baseline pointing at the snapshot, parse the diff, and evaluate
 * pass/fail with `evaluateReview`.
 *
 * Exits 1 on review failure so CI / pre-push hooks can gate.
 */

import { Command } from "commander";
import { spawn, execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  evaluateReview,
  DEFAULT_REVIEW_SINGLE_THRESHOLD,
  DEFAULT_REVIEW_NET_THRESHOLD,
  type FileDelta,
} from "../../core/feature-depth/review.js";
import { logger } from "../../core/utils/logger.js";

interface FileEntry {
  RelPath: string;
  Module: string;
  Score: number;
}

interface FileReportJSON {
  files: FileEntry[];
}

function output(line: string): void {
  process.stdout.write(line + "\n");
}

function runGoFileMode(
  toolPath: string,
  cwd: string,
  outFile: string,
): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      "go",
      ["run", ".", "-dir", cwd, "-granularity=file", "-output=json", "-json-out", outFile],
      { cwd: toolPath, stdio: ["ignore", "pipe", "pipe"], shell: false },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, stderr });
    });
    child.on("error", () => resolve({ ok: false, stderr }));
  });
}

/**
 * Run the analyzer at the named git ref by stashing current state,
 * checking out the ref into a worktree-style temp dir, scoring, and
 * cleaning up. We use `git worktree add` (cheaper than reset+checkout
 * round-trip) so the user's working tree stays untouched.
 */
async function snapshotRef(
  repoRoot: string,
  ref: string,
  toolPath: string,
): Promise<{ ok: boolean; jsonPath: string; cleanup: () => void; error?: string }> {
  const tmpDir = mkdtempSync(join(tmpdir(), "fd-review-"));
  const worktreePath = join(tmpDir, "wt");
  const jsonPath = join(tmpDir, "report.json");

  try {
    execSync(`git -C ${JSON.stringify(repoRoot)} worktree add --detach ${JSON.stringify(worktreePath)} ${JSON.stringify(ref)}`, {
      stdio: "ignore",
    });
  } catch (err) {
    return {
      ok: false,
      jsonPath: "",
      cleanup: () => {},
      error: `git worktree add failed for ${ref}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const resultValue = await runGoFileMode(toolPath, worktreePath, jsonPath);

  const cleanup = (): void => {
    try {
      execSync(`git -C ${JSON.stringify(repoRoot)} worktree remove --force ${JSON.stringify(worktreePath)}`, {
        stdio: "ignore",
      });
    } catch {
      // best-effort cleanup
    }
  };

  if (!resultValue.ok) {
    return {
      ok: false,
      jsonPath: "",
      cleanup,
      error: `analyzer failed at ref ${ref}: ${resultValue.stderr.slice(0, 500)}`,
    };
  }
  return { ok: true, jsonPath, cleanup };
}

function loadReport(jsonPath: string): Map<string, FileEntry> {
  const raw = execSync(`cat ${JSON.stringify(jsonPath)}`).toString();
  const parsed = JSON.parse(raw) as FileReportJSON;
  const map = new Map<string, FileEntry>();
  for (const fVar of parsed.files) map.set(fVar.RelPath, fVar);
  return map;
}

function computeDeltas(
  baseline: Map<string, FileEntry>,
  current: Map<string, FileEntry>,
): { improvers: FileDelta[]; regressions: FileDelta[] } {
  const improvers: FileDelta[] = [];
  const regressions: FileDelta[] = [];
  for (const [path, cur] of current) {
    const prev = baseline.get(path);
    if (!prev) continue; // new file — no baseline to compare
    const dVar = cur.Score - prev.Score;
    if (Math.abs(dVar) < 0.5) continue; // noise floor
    const entry: FileDelta = {
      path,
      module: cur.Module,
      before: prev.Score,
      after: cur.Score,
      delta: dVar,
    };
    if (dVar > 0) improvers.push(entry);
    else regressions.push(entry);
  }
  improvers.sort((a, b) => b.delta - a.delta);
  regressions.sort((a, b) => a.delta - b.delta);
  return { improvers, regressions };
}

/** reviewDepthCommand — auto-generated description placeholder. */
export function reviewDepthCommand(): Command {
  return new Command("review-depth")
    .description("Compare feature-depth scores between two git refs (default: merge-base...HEAD)")
    .option("-d, --dir <dir>", "Project root", process.cwd())
    .option("--base <ref>", "Baseline git ref", "")
    .option("--head <ref>", "Head git ref", "HEAD")
    .option("--single-threshold <n>", "Max single-file regression in pts", String(DEFAULT_REVIEW_SINGLE_THRESHOLD))
    .option("--net-threshold <n>", "Max net regression in pts", String(DEFAULT_REVIEW_NET_THRESHOLD))
    .option("--json", "Output result as JSON")
    .action(async (opts: {
      dir: string;
      base: string;
      head: string;
      singleThreshold: string;
      netThreshold: string;
      json: boolean;
    }) => {
      const toolPath = join(opts.dir, "tools/feature-depth");
      const singleThreshold = Number.parseFloat(opts.singleThreshold);
      const netThreshold = Number.parseFloat(opts.netThreshold);

      // Resolve base ref — default merge-base of head against origin/master.
      let baseRef = opts.base;
      if (!baseRef) {
        try {
          baseRef = execSync(
            `git -C ${JSON.stringify(opts.dir)} merge-base ${JSON.stringify(opts.head)} origin/master`,
            { stdio: ["ignore", "pipe", "ignore"] },
          ).toString().trim();
        } catch {
          logger.error("Could not resolve merge-base. Specify --base explicitly.");
          process.exit(2);
        }
      }

      output(`mcp-graph review-depth: ${baseRef.slice(0, 7)} → ${opts.head}\n`);

      const baseSnap = await snapshotRef(opts.dir, baseRef, toolPath);
      if (!baseSnap.ok) {
        logger.error(`Snapshot baseline failed: ${baseSnap.error}`);
        baseSnap.cleanup();
        process.exit(2);
      }

      const headSnap = await snapshotRef(opts.dir, opts.head, toolPath);
      if (!headSnap.ok) {
        logger.error(`Snapshot head failed: ${headSnap.error}`);
        baseSnap.cleanup();
        headSnap.cleanup();
        process.exit(2);
      }

      try {
        const baseline = loadReport(baseSnap.jsonPath);
        const current = loadReport(headSnap.jsonPath);
        const { improvers, regressions } = computeDeltas(baseline, current);
        const resultValue = evaluateReview({
          improvers,
          regressions,
          singleFileThreshold: singleThreshold,
          netThreshold,
        });

        if (opts.json) {
          output(JSON.stringify(resultValue, null, 2));
        } else {
          output(resultValue.summary + "\n");
          if (improvers.length > 0) {
            output("↑ TOP IMPROVERS");
            for (const fVar of improvers.slice(0, 10)) {
              output(`  +${fVar.delta.toFixed(1).padStart(5)}  ${fVar.before.toFixed(1)} → ${fVar.after.toFixed(1)}  ${fVar.path}`);
            }
            output("");
          }
          if (regressions.length > 0) {
            output("↓ REGRESSIONS");
            for (const fVar of regressions.slice(0, 10)) {
              output(`  ${fVar.delta.toFixed(1).padStart(6)}  ${fVar.before.toFixed(1)} → ${fVar.after.toFixed(1)}  ${fVar.path}`);
            }
            output("");
          }
          output(resultValue.ok ? "✓ Review passed." : "✗ Review failed.");
        }

        if (!resultValue.ok) process.exit(1);
      } finally {
        baseSnap.cleanup();
        headSnap.cleanup();
      }
    });
}
