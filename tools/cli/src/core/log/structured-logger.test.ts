/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { redact, summarizeHookActivity } from "./structured-logger.js";

describe("redact", () => {
  it("masks GitHub user tokens (ghu_)", () => {
    const input = "Authorization: ghu_aaaaaaaaaaaaaaaaaaaaaaa";
    expect(redact(input)).toContain("<REDACTED:gh-user-token>");
    expect(redact(input)).not.toContain("ghu_aaaaaaaa");
  });

  it("masks GitHub session tokens (ghs_) and PATs (ghp_)", () => {
    const input =
      "session=ghs_bbbbbbbbbbbbbbbbbbbbbbb pat=ghp_ccccccccccccccccccccccc";
    const out = redact(input);
    expect(out).toContain("<REDACTED:gh-session-token>");
    expect(out).toContain("<REDACTED:gh-pat>");
  });

  it("masks Anthropic and OpenAI keys", () => {
    const input =
      "key1=sk-ant-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa key2=sk-bbbbbbbbbbbbbbbbbbbbbbbbbb";
    const out = redact(input);
    expect(out).toContain("<REDACTED:anthropic-key>");
    expect(out).toContain("<REDACTED:openai-key>");
  });

  it("masks Bearer headers but preserves the prefix", () => {
    const input = "Authorization: Bearer abcdef.ghijkl.mnopqr-xyz123";
    expect(redact(input)).toContain("Bearer <REDACTED>");
  });

  it("masks Copilot session tids", () => {
    const input = "Cookie: tid=ABC123;path=/";
    expect(redact(input)).toContain("tid=<REDACTED>");
  });

  it("leaves clean text untouched", () => {
    const input = "regular log message with no secrets";
    expect(redact(input)).toBe(input);
  });
});

describe("summarizeHookActivity (Sprint 7.5 #7.5.10)", () => {
  let tmp: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mg-hookact-"));
    prevHome = process.env.HOME;
    process.env.HOME = tmp;
    mkdirSync(join(tmp, ".mcp-graph", "logs"), { recursive: true });
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeHooksLog(lines: string[]): void {
    writeFileSync(
      join(tmp, ".mcp-graph", "logs", "hooks.jsonl"),
      `${lines.join("\n")}\n`,
      "utf8",
    );
  }

  it("returns {} when hooks.jsonl is missing", () => {
    expect(summarizeHookActivity()).toEqual({});
  });

  it("aggregates fire counts and last-fire timestamps per action", () => {
    writeHooksLog([
      JSON.stringify({ ts: "2026-04-25T10:00:00Z", source: "hook", action: "session-start", outcome: "ok" }),
      JSON.stringify({ ts: "2026-04-25T11:00:00Z", source: "hook", action: "session-start", outcome: "ok" }),
      JSON.stringify({ ts: "2026-04-25T11:05:00Z", source: "hook", action: "post-edit", outcome: "ok" }),
    ]);
    const out = summarizeHookActivity();
    expect(out["session-start"]?.fireCount).toBe(2);
    expect(out["session-start"]?.lastFire).toBe("2026-04-25T11:00:00Z");
    expect(out["session-start"]?.errorCount).toBe(0);
    expect(out["session-start"]?.lastError).toBeUndefined();
    expect(out["post-edit"]?.fireCount).toBe(1);
  });

  it("captures last-error timestamp separately from last-fire", () => {
    writeHooksLog([
      JSON.stringify({ ts: "2026-04-25T10:00:00Z", source: "hook", action: "pre-tool-use", outcome: "ok" }),
      JSON.stringify({ ts: "2026-04-25T10:30:00Z", source: "hook", action: "pre-tool-use", outcome: "error" }),
      JSON.stringify({ ts: "2026-04-25T11:00:00Z", source: "hook", action: "pre-tool-use", outcome: "ok" }),
    ]);
    const out = summarizeHookActivity();
    expect(out["pre-tool-use"]?.fireCount).toBe(3);
    expect(out["pre-tool-use"]?.errorCount).toBe(1);
    expect(out["pre-tool-use"]?.lastFire).toBe("2026-04-25T11:00:00Z");
    expect(out["pre-tool-use"]?.lastError).toBe("2026-04-25T10:30:00Z");
  });

  it("ignores non-hook entries (cli/events sources written to other sinks but defensive)", () => {
    writeHooksLog([
      JSON.stringify({ ts: "2026-04-25T10:00:00Z", source: "cli", action: "init" }),
      JSON.stringify({ ts: "2026-04-25T10:01:00Z", source: "hook", action: "session-start" }),
    ]);
    const out = summarizeHookActivity();
    expect(out["init"]).toBeUndefined();
    expect(out["session-start"]).toBeDefined();
  });

  it("survives malformed JSON lines without throwing", () => {
    writeHooksLog([
      "this is not json",
      JSON.stringify({ ts: "2026-04-25T10:00:00Z", source: "hook", action: "session-start" }),
      "{ broken",
    ]);
    const out = summarizeHookActivity();
    expect(out["session-start"]?.fireCount).toBe(1);
  });
});
