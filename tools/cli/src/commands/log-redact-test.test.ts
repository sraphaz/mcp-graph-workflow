/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runLog } from "./log.js";
import type { CommandHandlerArgs } from "./registry.js";

describe("`mcp-graph log --redact-test` (Sprint 7.6 #7.6.15)", () => {
  let tmp: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mg-redact-"));
    prevHome = process.env.HOME;
    process.env.HOME = tmp;
    mkdirSync(join(tmp, ".mcp-graph", "logs"), { recursive: true });
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    rmSync(tmp, { recursive: true, force: true });
  });

  function makeCtx(flags: Record<string, string | boolean>): CommandHandlerArgs {
    return {
      args: [],
      flags,
      mode: "shell",
      traceId: "test-trace",
    } as unknown as CommandHandlerArgs;
  }

  it("returns PASS (exitCode 0) when every probe is redacted and no raw secret leaks", async () => {
    const result = await runLog(makeCtx({ "redact-test": true, json: true }));
    expect(result.exitCode).toBe(0);
    expect(result.json).toBeDefined();
    const payload = result.json as {
      runId: string;
      anyLeak: boolean;
      allRedacted: boolean;
      results: Array<{ probe: string; leaked: boolean; redactionApplied: boolean }>;
    };
    expect(payload.anyLeak).toBe(false);
    expect(payload.allRedacted).toBe(true);
    expect(payload.results.length).toBeGreaterThanOrEqual(7);
    for (const r of payload.results) {
      expect(r.leaked, `probe ${r.probe} leaked the raw secret`).toBe(false);
      expect(r.redactionApplied, `probe ${r.probe} did not produce its expected marker`).toBe(true);
    }
  });

  it("verifies cli.jsonl never contains the raw secret value for any probe", async () => {
    await runLog(makeCtx({ "redact-test": true, json: true }));
    const path = join(tmp, ".mcp-graph", "logs", "cli.jsonl");
    const raw = readFileSync(path, "utf8");
    // The probes embed deliberate marker prefixes; assert the raw probe
    // values never appear in the log file.
    const rawSecretFragments = [
      `ghu_${"A".repeat(30)}`,
      `ghs_${"B".repeat(30)}`,
      `ghp_${"C".repeat(30)}`,
      `sk-ant-${"D".repeat(40)}`,
      `sk-${"E".repeat(40)}`,
    ];
    for (const sec of rawSecretFragments) {
      expect(raw.includes(sec), `cli.jsonl leaked secret '${sec}'`).toBe(false);
    }
  });

  it("emits the expected redaction markers for each probe", async () => {
    await runLog(makeCtx({ "redact-test": true, json: true }));
    const path = join(tmp, ".mcp-graph", "logs", "cli.jsonl");
    const raw = readFileSync(path, "utf8");
    expect(raw).toContain("<REDACTED:gh-user-token>");
    expect(raw).toContain("<REDACTED:gh-session-token>");
    expect(raw).toContain("<REDACTED:gh-pat>");
    expect(raw).toContain("<REDACTED:anthropic-key>");
    expect(raw).toContain("<REDACTED:openai-key>");
    expect(raw).toContain("Bearer <REDACTED>");
    expect(raw).toContain("tid=<REDACTED>");
  });
});
