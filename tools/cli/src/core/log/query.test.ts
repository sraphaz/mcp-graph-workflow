/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("queryLogs", () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = mkdtempSync(join(tmpdir(), "mg-log-test-"));
    mkdirSync(join(tmpHome, ".mcp-graph", "logs"), { recursive: true });
    vi.stubEnv("HOME", tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tmpHome, { recursive: true, force: true });
  });

  function writeLog(sink: "cli" | "hooks" | "events", lines: object[]) {
    const path = join(tmpHome, ".mcp-graph", "logs", `${sink}.jsonl`);
    const body = `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;
    writeFileSync(path, body, "utf8");
  }

  it("returns most recent first up to limit", async () => {
    writeLog("cli", [
      { ts: "2026-04-25T10:00:00Z", source: "cli", action: "init", outcome: "ok" },
      { ts: "2026-04-25T11:00:00Z", source: "cli", action: "next", outcome: "ok" },
      { ts: "2026-04-25T12:00:00Z", source: "cli", action: "list", outcome: "ok" },
    ]);

    const { queryLogs } = await import("./query.js");
    const result = queryLogs({ sink: "cli", limit: 2 });
    expect(result.matched).toBe(2);
    expect(result.entries[0].action).toBe("list");
    expect(result.entries[1].action).toBe("next");
  });

  it("filters by --action", async () => {
    writeLog("cli", [
      { ts: "2026-04-25T10:00:00Z", source: "cli", action: "init", outcome: "ok" },
      { ts: "2026-04-25T11:00:00Z", source: "cli", action: "next", outcome: "ok" },
      { ts: "2026-04-25T12:00:00Z", source: "cli", action: "next", outcome: "ok" },
    ]);

    const { queryLogs } = await import("./query.js");
    const result = queryLogs({ sink: "cli", action: "next" });
    expect(result.matched).toBe(2);
    expect(result.entries.every((e) => e.action === "next")).toBe(true);
  });

  it("filters by --hook (only when source=hook)", async () => {
    writeLog("cli", [
      { ts: "2026-04-25T10:00:00Z", source: "cli", action: "post-edit", outcome: "ok" },
    ]);
    writeLog("hooks", [
      { ts: "2026-04-25T11:00:00Z", source: "hook", action: "post-edit", outcome: "ok" },
    ]);

    const { queryLogs } = await import("./query.js");
    const result = queryLogs({ sink: "all", hook: "post-edit" });
    expect(result.matched).toBe(1);
    expect(result.entries[0].source).toBe("hook");
  });

  it("filters by --trace", async () => {
    writeLog("cli", [
      { ts: "2026-04-25T10:00:00Z", source: "cli", action: "a", outcome: "ok", trace_id: "AAA" },
      { ts: "2026-04-25T11:00:00Z", source: "cli", action: "b", outcome: "ok", trace_id: "BBB" },
      { ts: "2026-04-25T12:00:00Z", source: "cli", action: "c", outcome: "ok", trace_id: "AAA" },
    ]);

    const { queryLogs } = await import("./query.js");
    const result = queryLogs({ sink: "cli", traceId: "AAA" });
    expect(result.matched).toBe(2);
  });

  it("filters by --task (matches target.id)", async () => {
    writeLog("events", [
      { ts: "2026-04-25T10:00:00Z", source: "graph", action: "add_node", outcome: "ok", target: { type: "task", id: "node_xxx" } },
      { ts: "2026-04-25T11:00:00Z", source: "graph", action: "update_status", outcome: "ok", target: { type: "task", id: "node_yyy" } },
    ]);

    const { queryLogs } = await import("./query.js");
    const result = queryLogs({ sink: "events", task: "node_xxx" });
    expect(result.matched).toBe(1);
  });

  it("respects --since duration", async () => {
    const now = Date.now();
    writeLog("cli", [
      {
        ts: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        source: "cli",
        action: "old",
        outcome: "ok",
      },
      {
        ts: new Date(now - 5 * 60 * 1000).toISOString(),
        source: "cli",
        action: "recent",
        outcome: "ok",
      },
    ]);

    const { queryLogs } = await import("./query.js");
    const result = queryLogs({ sink: "cli", since: "10m" });
    expect(result.matched).toBe(1);
    expect(result.entries[0].action).toBe("recent");
  });

  it("returns empty when no logs exist", async () => {
    const { queryLogs } = await import("./query.js");
    const result = queryLogs({ sink: "cli" });
    expect(result.matched).toBe(0);
  });

  it("ignores malformed JSONL lines", async () => {
    const path = join(tmpHome, ".mcp-graph", "logs", "cli.jsonl");
    writeFileSync(
      path,
      `{"ts":"2026-04-25T10:00:00Z","source":"cli","action":"a","outcome":"ok"}\n[not valid json\n{"ts":"2026-04-25T11:00:00Z","source":"cli","action":"b","outcome":"ok"}\n`,
      "utf8",
    );

    const { queryLogs } = await import("./query.js");
    const result = queryLogs({ sink: "cli" });
    expect(result.matched).toBe(2);
  });
});
