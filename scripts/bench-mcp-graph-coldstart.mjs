#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Sprint 5 #5.1 — cold-start baseline for the legacy v10 `mcp-graph`
 * CLI (dist/cli/index.js). Mirrors the shape of `hyperfine` output
 * (min/max/mean/stddev) but uses `process.hrtime.bigint()` directly so
 * we don't need the `hyperfine` binary in the dev/CI environment.
 *
 * Usage:
 *   node scripts/bench-mcp-graph-coldstart.mjs                # 10 runs of `--help`
 *   node scripts/bench-mcp-graph-coldstart.mjs --runs 30
 *   node scripts/bench-mcp-graph-coldstart.mjs --cmd version
 *   node scripts/bench-mcp-graph-coldstart.mjs --json         # write to stdout
 *
 * Default output target: benchmarks/baseline-coldstart.json.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CLI = resolve(ROOT, "dist", "cli", "index.js");
const OUTPUT = resolve(ROOT, "benchmarks", "baseline-coldstart.json");

const args = parseArgs(process.argv.slice(2));
const runs = Number(args.runs ?? 10);
const warmup = Number(args.warmup ?? 1);
const cmd = String(args.cmd ?? "help");
const stdoutOnly = Boolean(args.json);

if (!existsSync(CLI)) {
  console.error(`✗ legacy CLI bundle not found at ${CLI}`);
  console.error("  run \`npm run build\` first (produces dist/cli/index.js via tsup)");
  process.exit(2);
}

const cliArg = cmd === "help" ? "--help" : cmd === "version" ? "--version" : cmd;

// Warm up so OS file-cache + Node startup cache aren't measured cold.
for (let i = 0; i < warmup; i++) runOnce(cliArg);

const samples = [];
for (let i = 0; i < runs; i++) samples.push(runOnce(cliArg));

samples.sort((a, b) => a - b);
const min = samples[0];
const max = samples[samples.length - 1];
const mean = samples.reduce((acc, v) => acc + v, 0) / samples.length;
const stddev = Math.sqrt(
  samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / samples.length,
);
const median =
  samples.length % 2 === 1
    ? samples[(samples.length - 1) >> 1]
    : (samples[samples.length / 2 - 1] + samples[samples.length / 2]) / 2;

const result = {
  cli: CLI,
  cmd: cliArg,
  runs,
  warmup,
  samples_ms: samples,
  min_ms: round(min),
  max_ms: round(max),
  mean_ms: round(mean),
  median_ms: round(median),
  stddev_ms: round(stddev),
  // Sprint 5 captures the legacy v10 cold-start so we can quantify the
  // delta the v11 cli pkg delivers. Pre-T2.4 hyperfine baseline (manual,
  // ad-hoc) sat around ~280 ms; tsup-bundled dist drops that by ~30%.
  // No regression target enforced here — the CI gate lives in
  // scripts/bench-regression-check.mjs which targets the v11 alpha
  // bundle. This file is purely the baseline anchor.
  node_version: process.version,
  platform: `${process.platform}-${process.arch}`,
  ts: new Date().toISOString(),
};

const json = JSON.stringify(result, null, 2);
if (stdoutOnly) {
  process.stdout.write(`${json}\n`);
} else {
  if (!existsSync(dirname(OUTPUT))) mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${json}\n`, "utf8");
  console.log(`baseline-coldstart written: ${OUTPUT}`);
  console.log(
    `  ${result.runs}× ${result.cmd} — min ${result.min_ms} ms / mean ${result.mean_ms} ms / median ${result.median_ms} ms / max ${result.max_ms} ms / stddev ${result.stddev_ms} ms`,
  );
}

function runOnce(cliArg) {
  const start = process.hrtime.bigint();
  spawnSync(process.execPath, [CLI, cliArg], {
    stdio: "ignore",
    env: { ...process.env, MCP_GRAPH_NO_BANNER: "1" },
  });
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}

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
