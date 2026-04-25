#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Cold-start benchmark for the v11 CLI launcher.
 *
 *   node scripts/bench-coldstart.mjs                 # default: 10 runs of `mg --version`
 *   node scripts/bench-coldstart.mjs --runs 30
 *   node scripts/bench-coldstart.mjs --cmd help      # measure --help instead
 *   node scripts/bench-coldstart.mjs --warmup 3
 *   node scripts/bench-coldstart.mjs --json
 *
 * Measures wall-clock spawn-to-exit using `hrtime.bigint`. Reports
 * min / median / mean / p95 / max in milliseconds.
 *
 * v11.0 success criteria target: cold start ≤ 500 ms.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(HERE, "..", "dist", "cli.mjs");

const args = parseArgs(process.argv.slice(2));
const runs = args.runs ?? 10;
const warmup = args.warmup ?? 1;
const cmd = args.cmd ?? "version";
const jsonOut = Boolean(args.json);

if (!CLI || !canExec(CLI)) {
  console.error(`✗ cli bundle not found at ${CLI}\n  run \`npm run build\` first`);
  process.exit(2);
}

const cliArg = cmd === "version" ? "--version" : cmd === "help" ? "--help" : cmd;

// Warm-up runs (drive Node startup cache, FS warm).
for (let i = 0; i < warmup; i++) runOnce(cliArg);

const samples = [];
for (let i = 0; i < runs; i++) {
  samples.push(runOnce(cliArg));
}

samples.sort((a, b) => a - b);
const result = {
  cli: CLI,
  cmd: cliArg,
  runs,
  warmup,
  samples_ms: samples,
  min_ms: samples[0],
  max_ms: samples[samples.length - 1],
  median_ms: samples[Math.floor(samples.length / 2)],
  mean_ms: samples.reduce((a, b) => a + b, 0) / samples.length,
  p95_ms: samples[Math.floor(samples.length * 0.95)] ?? samples[samples.length - 1],
  target_ms: 500,
  pass: samples[Math.floor(samples.length / 2)] <= 500,
  node_version: process.version,
  platform: `${process.platform}-${process.arch}`,
  ts: new Date().toISOString(),
};

if (jsonOut) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(`cold-start \`mg ${cliArg}\` (${runs} runs)\n`);
  process.stdout.write(`  min:    ${result.min_ms.toFixed(1)} ms\n`);
  process.stdout.write(`  median: ${result.median_ms.toFixed(1)} ms\n`);
  process.stdout.write(`  mean:   ${result.mean_ms.toFixed(1)} ms\n`);
  process.stdout.write(`  p95:    ${result.p95_ms.toFixed(1)} ms\n`);
  process.stdout.write(`  max:    ${result.max_ms.toFixed(1)} ms\n`);
  process.stdout.write(`  target: ≤ ${result.target_ms} ms — ${result.pass ? "PASS ✓" : "FAIL ✗"}\n`);
}

process.exit(result.pass ? 0 : 1);

function runOnce(cliArg) {
  const start = process.hrtime.bigint();
  spawnSync(process.execPath, [CLI, cliArg], {
    stdio: "ignore",
    env: process.env,
  });
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

function canExec(path) {
  return existsSync(path);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith("--")) continue;
    const key = tok.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = isNaN(Number(next)) ? next : Number(next);
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}
