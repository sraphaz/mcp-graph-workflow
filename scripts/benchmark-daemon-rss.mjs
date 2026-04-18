#!/usr/bin/env node
/**
 * Benchmark: RSS (resident set size) of N concurrent mcp-graph agents
 * in two modes:
 *   - legacy   — every agent spawns its own mcp-graph-stdio process
 *   - daemon   — every agent spawns mcp-graph-proxy; a single daemon is shared
 *
 * Each simulated agent performs the MCP `initialize` + `tools/list` handshake,
 * then stays connected while we sample RSS.
 *
 * Usage:
 *   node scripts/benchmark-daemon-rss.mjs [N]
 *   node scripts/benchmark-daemon-rss.mjs 5          # default
 *   node scripts/benchmark-daemon-rss.mjs 10
 *
 * Environment:
 *   BENCH_SAMPLES  — RSS samples per mode (default 3)
 *   BENCH_DASHBOARD — keep dashboard (default: off via MCP_STDIO_ONLY=1)
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const DAEMON_ENTRY = path.join(ROOT, "dist/mcp/daemon-entry.js");
const PROXY_ENTRY = path.join(ROOT, "dist/mcp/stdio-proxy.js");
const STDIO_ENTRY = path.join(ROOT, "dist/mcp/stdio.js");

const N_AGENTS = parseInt(process.argv[2] ?? "5", 10);
const SAMPLES = parseInt(process.env.BENCH_SAMPLES ?? "3", 10);
const DASHBOARD = process.env.BENCH_DASHBOARD === "1";

// ── helpers ───────────────────────────────────────────────────────────────

function now() { return Date.now(); }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function encodeFrame(msg) { return JSON.stringify(msg) + "\n"; }

async function measureRSS(pid) {
  return new Promise((resolve) => {
    const ps = spawn("ps", ["-o", "rss=", "-p", String(pid)]);
    let out = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.on("close", () => {
      const kb = parseInt(out.trim(), 10);
      resolve(Number.isFinite(kb) ? kb : null);
    });
    ps.on("error", () => resolve(null));
  });
}

async function measureTotalRSS(pids) {
  const values = await Promise.all(pids.map(measureRSS));
  return values.filter((v) => v !== null).reduce((a, b) => a + b, 0);
}

async function driveHandshake(child, label) {
  const init = encodeFrame({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: label, version: "bench" },
    },
  });
  child.stdin.write(init);

  // Read until we see the init response.
  await new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString("utf8");
      while (buf.includes("\n")) {
        const nl = buf.indexOf("\n");
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1 && msg.result) {
            child.stdout.off("data", onData);
            resolve();
            return;
          }
        } catch { /* ignore */ }
      }
    };
    child.stdout.on("data", onData);
    const timer = setTimeout(() => {
      child.stdout.off("data", onData);
      reject(new Error(`initialize timeout for ${label}`));
    }, 30_000);
    child.once("exit", () => { clearTimeout(timer); reject(new Error(`child exited before initialize for ${label}`)); });
  });

  child.stdin.write(encodeFrame({ jsonrpc: "2.0", method: "notifications/initialized" }));
}

// ── modes ─────────────────────────────────────────────────────────────────

async function spawnLegacyAgents(n, workspace) {
  const children = [];
  for (let i = 0; i < n; i++) {
    const child = spawn(process.execPath, [STDIO_ENTRY], {
      cwd: workspace,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...(DASHBOARD ? {} : { MCP_STDIO_ONLY: "1" }) },
    });
    child.stderr.on("data", () => { /* discard */ });
    await driveHandshake(child, `legacy-${i}`);
    children.push(child);
  }
  return { children, extraPids: [] };
}

async function spawnDaemonAgents(n, workspace) {
  // Let the first proxy auto-spawn the daemon; subsequent proxies reuse it.
  const children = [];
  for (let i = 0; i < n; i++) {
    const child = spawn(process.execPath, [PROXY_ENTRY], {
      cwd: workspace,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    child.stderr.on("data", () => { /* discard */ });
    await driveHandshake(child, `proxy-${i}`);
    children.push(child);
  }

  // Discover daemon PID via pidfile.
  const { resolveDaemonPaths } = await import("../dist/core/daemon/daemon-paths.js");
  const paths = resolveDaemonPaths(workspace);
  let daemonPid = null;
  for (let i = 0; i < 20 && !daemonPid; i++) {
    try {
      const raw = fs.readFileSync(paths.pidFile, "utf8").trim();
      daemonPid = parseInt(raw, 10);
      if (!Number.isFinite(daemonPid)) daemonPid = null;
    } catch { /* not yet */ }
    if (!daemonPid) await sleep(100);
  }
  return { children, extraPids: daemonPid ? [daemonPid] : [], daemonPid };
}

// ── run one mode ──────────────────────────────────────────────────────────

async function runMode(label, spawner, workspace) {
  console.error(`\n=== ${label.toUpperCase()} (N=${N_AGENTS}) ===`);
  const t0 = now();
  const { children, extraPids, daemonPid } = await spawner(N_AGENTS, workspace);
  const spawnMs = now() - t0;

  // Give v8 a tick to stabilize.
  await sleep(500);

  const allPids = [...children.map((c) => c.pid), ...extraPids];
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const total = await measureTotalRSS(allPids);
    samples.push(total);
    await sleep(250);
  }
  const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  const perAgent = Math.round(
    (await measureTotalRSS(children.map((c) => c.pid))) / children.length,
  );
  const daemonRSS = daemonPid ? await measureRSS(daemonPid) : null;

  // Tear down.
  for (const c of children) {
    c.kill("SIGTERM");
  }
  await Promise.all(children.map((c) => new Promise((r) => c.once("exit", r))));
  if (daemonPid) {
    try { process.kill(daemonPid, "SIGTERM"); } catch { /* gone */ }
  }

  return {
    label,
    spawnMs,
    totalKB: avg,
    perAgentKB: perAgent,
    daemonKB: daemonRSS,
    samplesKB: samples,
  };
}

// ── main ──────────────────────────────────────────────────────────────────

function fmt(kb) {
  if (kb == null) return "n/a";
  return `${(kb / 1024).toFixed(1)} MB`;
}

(async () => {
  if (!fs.existsSync(DAEMON_ENTRY) || !fs.existsSync(PROXY_ENTRY) || !fs.existsSync(STDIO_ENTRY)) {
    console.error("build artifacts missing — run `npm run build` first");
    process.exit(2);
  }

  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-graph-bench-"));
  console.error(`workspace: ${workspace}`);

  try {
    const legacy = await runMode("legacy", spawnLegacyAgents, workspace);
    // Give the OS a breath before round 2.
    await sleep(1000);
    const daemon = await runMode("daemon", spawnDaemonAgents, workspace);

    const savedKB = legacy.totalKB - daemon.totalKB;
    const savedPct = legacy.totalKB > 0 ? Math.round((savedKB / legacy.totalKB) * 100) : 0;

    const lines = [
      "",
      "## RSS benchmark — legacy stdio vs daemon mode",
      "",
      `- Node: ${process.version}`,
      `- Platform: ${os.platform()} ${os.arch()}`,
      `- Agents: ${N_AGENTS}  Samples: ${SAMPLES}`,
      `- Dashboard: ${DASHBOARD ? "on" : "off (MCP_STDIO_ONLY=1)"}`,
      "",
      "| Mode    | Spawn time | Total RSS | Per-agent RSS | Daemon RSS |",
      "|---------|-----------:|----------:|--------------:|-----------:|",
      `| legacy  | ${legacy.spawnMs} ms | ${fmt(legacy.totalKB)} | ${fmt(legacy.perAgentKB)} | — |`,
      `| daemon  | ${daemon.spawnMs} ms | ${fmt(daemon.totalKB)} | ${fmt(daemon.perAgentKB)} | ${fmt(daemon.daemonKB)} |`,
      "",
      `**Saved: ${fmt(savedKB)} (${savedPct}%)**`,
      "",
      `Raw samples (KB):`,
      `  legacy: ${legacy.samplesKB.join(", ")}`,
      `  daemon: ${daemon.samplesKB.join(", ")}`,
      "",
    ];
    const text = lines.join("\n");
    console.log(text);
  } finally {
    try { fs.rmSync(workspace, { recursive: true, force: true }); } catch { /* ignore */ }
  }
})().catch((err) => {
  console.error("benchmark failed:", err?.message ?? err);
  process.exit(1);
});
