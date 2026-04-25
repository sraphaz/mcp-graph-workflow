#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Sprint 8 #8.6 — CI bench regression gate.
 *
 * Runs the v11 CLI cold-start benchmark, compares against the persisted
 * baseline (benchmarks/baseline-cli-v11-alpha.json), and exits non-zero
 * when median_ms regresses past the configured threshold (default 15%).
 *
 * Usage (CI):
 *   node scripts/bench-regression-check.mjs              # 15% gate
 *   node scripts/bench-regression-check.mjs --threshold 25
 *   node scripts/bench-regression-check.mjs --runs 50
 *
 * Heap regression gate is documented in v10-baseline.md as deferred to
 * Sprint 8 (post-lifecycle landing). When that benchmark exists, this
 * script gains a `--heap-baseline <path>` mode following the same
 * threshold/exit-code shape; gate threshold per Sprint 8 #8.6 is +10%.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const BENCH_SCRIPT = resolve(ROOT, "tools", "cli", "scripts", "bench-coldstart.mjs");
const BASELINE = resolve(ROOT, "benchmarks", "baseline-cli-v11-alpha.json");

const args = parseArgs(process.argv.slice(2));
const threshold = Number(args.threshold ?? 15); // % over baseline that fails the gate
const runs = Number(args.runs ?? 30);
const cmd = args.cmd ?? "version";

if (!existsSync(BENCH_SCRIPT)) {
  exitWith(2, `bench script not found: ${BENCH_SCRIPT}`);
}
if (!existsSync(BASELINE)) {
  exitWith(2, `baseline not found: ${BASELINE}\n  capture one first via: node ${BENCH_SCRIPT} --runs 30 --json > ${BASELINE}`);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const baselineMedian = Number(baseline.median_ms);
if (!Number.isFinite(baselineMedian) || baselineMedian <= 0) {
  exitWith(2, `baseline median_ms is not a positive number (got ${baseline.median_ms})`);
}

console.log(`bench-regression-check — running ${runs}× cold-start \`${cmd}\` against baseline ${baselineMedian.toFixed(1)} ms (gate ${threshold}%)…`);

const out = spawnSync(
  process.execPath,
  [BENCH_SCRIPT, "--runs", String(runs), "--cmd", cmd, "--json"],
  { encoding: "utf8" },
);
if (out.status !== 0) {
  exitWith(2, `bench script failed (exit ${out.status})\nstderr: ${out.stderr}`);
}
let result;
try {
  // bench-coldstart prints the JSON object; tolerate stray log lines.
  const lastBrace = out.stdout.lastIndexOf("}");
  const firstBrace = out.stdout.indexOf("{");
  result = JSON.parse(out.stdout.slice(firstBrace, lastBrace + 1));
} catch (err) {
  exitWith(2, `failed to parse bench JSON: ${err instanceof Error ? err.message : String(err)}`);
}

const currentMedian = Number(result.median_ms);
if (!Number.isFinite(currentMedian)) {
  exitWith(2, `current median_ms is not a number (got ${result.median_ms})`);
}

const deltaMs = currentMedian - baselineMedian;
const deltaPct = (deltaMs / baselineMedian) * 100;
const passed = deltaPct <= threshold;

const summary = [
  `### Cold-start regression check`,
  ``,
  `| Metric | Baseline | Current | Δ | Status |`,
  `|---|---:|---:|---:|---|`,
  `| median (\`${cmd}\`) | ${baselineMedian.toFixed(1)} ms | ${currentMedian.toFixed(1)} ms | ${deltaMs >= 0 ? "+" : ""}${deltaMs.toFixed(1)} ms (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%) | ${passed ? "✅" : "❌"} |`,
  ``,
  `Threshold: regression must stay ≤ ${threshold}%. Heap gate (+10%) deferred — see \`docs/_internal/dx/v10-baseline.md\`.`,
].join("\n");

console.log(summary);
const ghSummary = process.env.GITHUB_STEP_SUMMARY;
if (ghSummary) {
  try {
    appendFileSync(ghSummary, `${summary}\n`);
  } catch {
    // best-effort
  }
}

if (!passed) {
  console.error(`✗ cold-start regressed ${deltaPct.toFixed(1)}% over baseline (gate: ${threshold}%)`);
  process.exit(1);
}
console.log(`✓ cold-start within budget (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}% ≤ ${threshold}%)`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith("--")) continue;
    const key = tok.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function exitWith(code, msg) {
  console.error(msg);
  process.exit(code);
}
