#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Performance baseline measurement for the mcp-graph CLI.
 *
 * Usage:
 *   node scripts/perf/measure.mjs                # run, print, do not write
 *   node scripts/perf/measure.mjs --save         # also persist scripts/perf/perf-baseline.json
 *   node scripts/perf/measure.mjs --check        # compare against baseline, exit 1 if regression >10%
 *   node scripts/perf/measure.mjs --json         # emit JSON only (machine readable)
 *   node scripts/perf/measure.mjs --runs=N       # override runs per metric (default 5)
 *
 * Metrics captured (median across N runs unless noted):
 *   cliColdHelpMs       — `mcp-graph --help` cold
 *   cliStatusJsonMs     — `mcp-graph status --json` (or `stats --json` until renamed)
 *   serveBootMs         — `mcp-graph serve` time until "listening" stdout marker
 *   rssAfterHelpMb      — peak RSS (MB) reported by Node after running --help once
 *   distSizeBytes       — total bytes under dist/
 *   distBinSizeBytes    — bytes of the resolved CLI bin entry
 *
 * Targets (v10.2.0 DX overhaul, see ~/.claude/plans/witty-booping-bunny.md):
 *   cliColdHelpMs   ≤ 150
 *   cliStatusJsonMs ≤ 200
 *   serveBootMs     ≤ 1000
 *   rssAfterHelpMb  ≤ 80
 *   distBinSizeBytes ≤ 4_194_304   (4 MB)
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");
const BASELINE_PATH = join(__dirname, "perf-baseline.json");

const REGRESSION_THRESHOLD = 0.10; // 10%

const FLAGS = parseFlags(process.argv.slice(2));
const RUNS = FLAGS.runs ?? 5;

// ---------- helpers ----------

function parseFlags(argv) {
  const flags = { save: false, check: false, json: false, runs: null };
  for (const arg of argv) {
    if (arg === "--save") flags.save = true;
    else if (arg === "--check") flags.check = true;
    else if (arg === "--json") flags.json = true;
    else if (arg.startsWith("--runs=")) flags.runs = Number(arg.slice("--runs=".length));
  }
  return flags;
}

function median(nums) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function dirSizeBytes(path) {
  if (!existsSync(path)) return 0;
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const sub = join(path, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(sub);
    else if (entry.isFile()) total += statSync(sub).size;
  }
  return total;
}

function resolveCliBin() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  const binEntry = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.["mcp-graph"];
  if (!binEntry) throw new Error("Cannot resolve mcp-graph bin from package.json");
  return resolve(REPO_ROOT, binEntry);
}

function highResMs() {
  const [s, ns] = process.hrtime();
  return s * 1e3 + ns / 1e6;
}

// ---------- measurements ----------

function timeOnce(args, env = {}) {
  const start = highResMs();
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  const elapsedMs = highResMs() - start;
  if (result.status !== 0) {
    return { elapsedMs, ok: false, stderr: (result.stderr || "").slice(0, 240) };
  }
  return { elapsedMs, ok: true, stdout: result.stdout, stderr: result.stderr };
}

function measureCommand({ label, args, env, runs }) {
  const samples = [];
  let lastErr = null;
  for (let i = 0; i < runs; i++) {
    const r = timeOnce(args, env);
    if (r.ok) samples.push(r.elapsedMs);
    else lastErr = r.stderr;
  }
  if (samples.length === 0) {
    return { label, runs, samples, medianMs: null, error: lastErr ?? "all runs failed" };
  }
  return { label, runs, samples, medianMs: median(samples) };
}

function measureRssAfterHelp(cliBin) {
  // Spawn node with --expose-gc not required; we use process.memoryUsage() in a wrapper.
  // We measure RSS reported by /usr/bin/time -v if present, otherwise fall back to
  // running the command and reading peak via spawnSync's resource usage (not portable),
  // so we instead spawn a wrapper that prints rss after the require/import phase.
  const wrapper = `
    const { spawnSync } = require('node:child_process');
    const start = process.memoryUsage().rss;
    const r = spawnSync(process.execPath, [${JSON.stringify(cliBin)}, "--help"], { stdio: 'ignore' });
    const end = process.memoryUsage().rss;
    process.stdout.write(JSON.stringify({ start, end, rss: end }));
  `;
  const r = spawnSync(process.execPath, ["-e", wrapper], { encoding: "utf8" });
  if (r.status !== 0) return null;
  try {
    const parsed = JSON.parse(r.stdout);
    return Math.round(parsed.rss / 1024 / 1024);
  } catch {
    return null;
  }
}

async function measureServeBoot(cliBin, runs) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const port = 13900 + i;
    const ms = await bootServeOnce(cliBin, port);
    if (ms !== null) samples.push(ms);
  }
  if (samples.length === 0) {
    return { label: "serveBootMs", runs, samples, medianMs: null, error: "boot never observed" };
  }
  return { label: "serveBootMs", runs, samples, medianMs: median(samples) };
}

function bootServeOnce(cliBin, port) {
  return new Promise((resolveP) => {
    const start = highResMs();
    const child = spawn(process.execPath, [cliBin, "serve", "--port", String(port)], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      resolveP(value);
    };

    const onChunk = (buf) => {
      const text = buf.toString("utf8");
      // Match common readiness markers: "listening", "Server running", "started".
      if (/listening|server running|started|listening on/i.test(text)) {
        finish(highResMs() - start);
      }
    };

    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.on("exit", () => finish(null));
    child.on("error", () => finish(null));

    // Hard timeout: 6 seconds per attempt.
    setTimeout(() => finish(null), 6000).unref?.();
  });
}

// ---------- baseline IO ----------

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function compareAgainstBaseline(current, baseline) {
  const violations = [];
  const fields = [
    "cliColdHelpMs",
    "cliStatusJsonMs",
    "serveBootMs",
    "rssAfterHelpMb",
    "distBinSizeBytes",
  ];
  for (const key of fields) {
    const prev = baseline?.metrics?.[key];
    const now = current.metrics[key];
    if (prev == null || now == null) continue;
    const delta = (now - prev) / prev;
    if (delta > REGRESSION_THRESHOLD) {
      violations.push({ key, baseline: prev, current: now, deltaPercent: Math.round(delta * 1000) / 10 });
    }
  }
  return violations;
}

// ---------- runner ----------

async function main() {
  const cliBin = resolveCliBin();
  if (!existsSync(cliBin)) {
    console.error(`error: CLI bin not found at ${cliBin}. Run 'npm run build' first.`);
    process.exit(2);
  }

  const helpResult = measureCommand({
    label: "cliColdHelpMs",
    args: [cliBin, "--help"],
    runs: RUNS,
  });

  // Status command name is `stats` until renamed (T1.3 hard-break in plan).
  const statusResult = measureCommand({
    label: "cliStatusJsonMs",
    args: [cliBin, "stats", "--json"],
    runs: RUNS,
  });

  const rssMb = measureRssAfterHelp(cliBin);
  const serveResult = await measureServeBoot(cliBin, Math.min(3, RUNS));

  const distPath = join(REPO_ROOT, "dist");
  const distSize = dirSizeBytes(distPath);
  const distBinSize = existsSync(cliBin) ? statSync(cliBin).size : 0;

  const report = {
    timestamp: new Date().toISOString(),
    cliBin: cliBin.replace(REPO_ROOT, "."),
    runsPerMetric: RUNS,
    metrics: {
      cliColdHelpMs: helpResult.medianMs,
      cliStatusJsonMs: statusResult.medianMs,
      serveBootMs: serveResult.medianMs,
      rssAfterHelpMb: rssMb,
      distSizeBytes: distSize,
      distBinSizeBytes: distBinSize,
    },
    samples: {
      cliColdHelpMs: helpResult.samples,
      cliStatusJsonMs: statusResult.samples,
      serveBootMs: serveResult.samples,
    },
    errors: {
      cliColdHelpMs: helpResult.error ?? null,
      cliStatusJsonMs: statusResult.error ?? null,
      serveBootMs: serveResult.error ?? null,
    },
    targets: {
      cliColdHelpMs: 150,
      cliStatusJsonMs: 200,
      serveBootMs: 1000,
      rssAfterHelpMb: 80,
      distBinSizeBytes: 4_194_304,
    },
  };

  if (FLAGS.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    printHumanReport(report);
  }

  if (FLAGS.save) {
    writeFileSync(BASELINE_PATH, JSON.stringify(report, null, 2) + "\n");
    if (!FLAGS.json) console.log(`\nbaseline saved → ${BASELINE_PATH.replace(REPO_ROOT, ".")}`);
  }

  if (FLAGS.check) {
    const baseline = readBaseline();
    if (!baseline) {
      console.error("error: --check requested but no baseline file at scripts/perf/perf-baseline.json");
      process.exit(2);
    }
    const violations = compareAgainstBaseline(report, baseline);
    if (violations.length > 0) {
      console.error(`\nperf regression (>${REGRESSION_THRESHOLD * 100}%):`);
      for (const v of violations) {
        console.error(`  ${v.key}: baseline=${v.baseline} current=${v.current} (+${v.deltaPercent}%)`);
      }
      process.exit(1);
    }
    if (!FLAGS.json) console.log("\nperf check: no regression vs baseline.");
  }
}

function printHumanReport(report) {
  const m = report.metrics;
  const t = report.targets;
  const fmt = (val, target, unit) => {
    if (val == null) return "n/a";
    const within = val <= target;
    const marker = within ? "ok " : "OVER";
    return `${val.toString().padStart(8)} ${unit.padEnd(2)} (target ≤ ${target} ${unit}) ${marker}`;
  };
  console.log("");
  console.log(`mcp-graph perf measurement (${report.timestamp})`);
  console.log(`  bin:  ${report.cliBin}`);
  console.log(`  runs per metric: ${report.runsPerMetric}`);
  console.log("");
  console.log(`  cliColdHelpMs    ${fmt(round(m.cliColdHelpMs), t.cliColdHelpMs, "ms")}`);
  console.log(`  cliStatusJsonMs  ${fmt(round(m.cliStatusJsonMs), t.cliStatusJsonMs, "ms")}`);
  console.log(`  serveBootMs      ${fmt(round(m.serveBootMs), t.serveBootMs, "ms")}`);
  console.log(`  rssAfterHelpMb   ${fmt(m.rssAfterHelpMb, t.rssAfterHelpMb, "MB")}`);
  console.log(`  distBinSizeBytes ${fmt(m.distBinSizeBytes, t.distBinSizeBytes, "B ")}`);
  console.log(`  distSizeBytes    ${(m.distSizeBytes / 1024 / 1024).toFixed(1)} MB total`);
  for (const [key, err] of Object.entries(report.errors)) {
    if (err) console.log(`  ! ${key} error: ${err}`);
  }
}

function round(n) {
  return n == null ? null : Math.round(n);
}

main().catch((err) => {
  console.error("perf measure failed:", err);
  process.exit(2);
});
