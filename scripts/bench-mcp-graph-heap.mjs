#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Sprint 5 #5.2 — heap / RSS baseline for the legacy v10 CLI.
 *
 * Captures peak resident set size of the CLI as a subprocess after
 * running `init` and `stats` against a fresh temp project. The two
 * commands are the cheapest deterministic equivalent to the AC's
 * "init && next" — `next` requires at least one task in the graph,
 * which would mean an extra `add` step; `stats` exercises the same
 * SqliteStore + lifecycle path with zero extra setup.
 *
 * Captured via `/usr/bin/time -l` (macOS) or `/usr/bin/time -v`
 * (GNU/Linux). When neither is present (Windows / minimal containers)
 * the script falls back to spawning the CLI with a child-side probe
 * that prints `process.memoryUsage()` to stderr just before exit.
 *
 * Output: benchmarks/baseline-heap.json.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CLI = resolve(ROOT, "dist", "cli", "index.js");
const PROBE = resolve(HERE, "_heap-probe.cjs");
const OUTPUT = resolve(ROOT, "benchmarks", "baseline-heap.json");

const args = parseArgs(process.argv.slice(2));
const stdoutOnly = Boolean(args.json);

if (!existsSync(CLI)) {
  console.error(`✗ legacy CLI bundle not found at ${CLI}\n  run \`npm run build\` first`);
  process.exit(2);
}

// One-off: write a 4-line CommonJS probe to a sibling script. Required
// via NODE_OPTIONS so the child CLI loads it before its own entry runs.
// On exit it dumps process.memoryUsage() to stderr with a sentinel
// prefix the parent regexes out.
writeFileSync(
  PROBE,
  `process.on("exit", () => { try { process.stderr.write("[__MG_HEAP_PROBE__]" + JSON.stringify(process.memoryUsage()) + "\\n"); } catch {} });\n`,
  "utf8",
);

const tmp = mkdtempSync(join(tmpdir(), "mg-heap-"));
try {
  const initRun = measure(["init"], tmp);
  const statsRun = measure(["stats"], tmp);

  const result = {
    cli: CLI,
    workflow: ["mcp-graph init", "mcp-graph stats (used as deterministic 'next' analog)"],
    runs: {
      init: initRun,
      stats: statsRun,
    },
    // Highest peak RSS across the two commands — the value a regression
    // gate (Sprint 8 #8.6 heap arm) would compare against.
    peak_rss_mb: round(Math.max(initRun.rss_mb ?? 0, statsRun.rss_mb ?? 0)),
    peak_heap_used_mb: round(
      Math.max(initRun.heap_used_mb ?? 0, statsRun.heap_used_mb ?? 0),
    ),
    measured_via: initRun.measured_via,
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
    console.log(`baseline-heap written: ${OUTPUT}`);
    console.log(
      `  peak RSS: ${result.peak_rss_mb} MB · peak heapUsed: ${result.peak_heap_used_mb} MB · via=${result.measured_via}`,
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(PROBE, { force: true });
}

function measure(cliArgs, cwd) {
  const env = {
    ...process.env,
    MCP_GRAPH_NO_BANNER: "1",
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${PROBE}`.trim(),
  };

  // Prefer /usr/bin/time -l (macOS) or /usr/bin/time -v (Linux). When
  // neither is present we fall back to the child-side probe.
  const platformTime = process.platform === "darwin" ? ["-l"] : ["-v"];
  const useSystemTime = existsSync("/usr/bin/time");

  let rssBytes = null;
  let res;
  if (useSystemTime) {
    res = spawnSync(
      "/usr/bin/time",
      [...platformTime, process.execPath, CLI, ...cliArgs],
      { cwd, env, encoding: "utf8" },
    );
    rssBytes = parseSystemTimeRss(res.stderr ?? "");
  } else {
    res = spawnSync(process.execPath, [CLI, ...cliArgs], {
      cwd,
      env,
      encoding: "utf8",
    });
  }

  const probeUsage = parseProbe(res.stderr ?? "");
  return {
    cmd: `mcp-graph ${cliArgs.join(" ")}`,
    exit_code: res.status,
    measured_via: useSystemTime ? "/usr/bin/time" : "child-side probe",
    rss_mb: rssBytes !== null ? round(rssBytes / 1024 / 1024) : null,
    heap_used_mb:
      probeUsage !== null ? round(probeUsage.heapUsed / 1024 / 1024) : null,
    heap_total_mb:
      probeUsage !== null ? round(probeUsage.heapTotal / 1024 / 1024) : null,
    external_mb:
      probeUsage !== null ? round(probeUsage.external / 1024 / 1024) : null,
  };
}

function parseSystemTimeRss(stderr) {
  // macOS BSD time: "<bytes> maximum resident set size"
  const macMatch = stderr.match(/(\d+)\s+maximum resident set size/);
  if (macMatch) return Number(macMatch[1]);
  // GNU time -v: "Maximum resident set size (kbytes): <kb>"
  const linuxMatch = stderr.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
  if (linuxMatch) return Number(linuxMatch[1]) * 1024;
  return null;
}

function parseProbe(stderr) {
  const m = stderr.match(/\[__MG_HEAP_PROBE__\]({[^\n]+})/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function round(v) {
  return Math.round(v * 100) / 100;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith("--")) continue;
    const key = tok.slice(2);
    out[key] = true;
  }
  return out;
}
