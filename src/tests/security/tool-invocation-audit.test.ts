/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi } from "vitest";
import { wrapToolHandler, type AuditSink } from "../../core/security/tool-invocation-audit.js";

function makeSink() {
  const calls: Array<Record<string, unknown>> = [];
  const sink: AuditSink = {
    record: (entry) => {
      calls.push(entry);
    },
  };
  return { sink, calls };
}

describe("wrapToolHandler", () => {
  it("records a successful call", async () => {
    const { sink, calls } = makeSink();
    const wrapped = wrapToolHandler("echo", async (args: { v: string }) => ({ echo: args.v }), sink);
    const result = await wrapped({ v: "hi" });
    expect(result).toEqual({ echo: "hi" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ tool: "echo", ok: true });
  });

  it("records a failing call and rethrows", async () => {
    const { sink, calls } = makeSink();
    const wrapped = wrapToolHandler("boom", async () => {
      throw new Error("bad");
    }, sink);
    await expect(wrapped({})).rejects.toThrow("bad");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ tool: "boom", ok: false });
  });

  it("redacts known secret-shaped strings in args preview", async () => {
    const { sink, calls } = makeSink();
    const wrapped = wrapToolHandler("save", async () => ({ ok: true }), sink);
    await wrapped({ apiKey: "sk-ant-api03-ABCDEF1234567890ABCDEFGHIJKLMNOPQRSTUV", harmless: "x" });
    const preview = JSON.stringify(calls[0]?.argsPreview);
    expect(preview).not.toMatch(/ABCDEF1234567890/);
    expect(preview).toMatch(/\*\*\*|sk-ant-\.\.\./);
  });

  it("truncates oversized previews", async () => {
    const { sink, calls } = makeSink();
    const wrapped = wrapToolHandler("big", async () => ({ ok: true }), sink);
    const big = "x".repeat(2000);
    await wrapped({ blob: big });
    const preview = JSON.stringify(calls[0]?.argsPreview);
    expect(preview.length).toBeLessThan(2000);
  });

  it("rate limits when >N calls in the window", async () => {
    const { sink } = makeSink();
    const clock = { now: 0 };
    const handler = vi.fn(async () => ({ ok: true }));
    const wrapped = wrapToolHandler("rl", handler, sink, {
      rateLimit: { perMinute: 3, nowMs: () => clock.now },
    });
    await wrapped({});
    await wrapped({});
    await wrapped({});
    await expect(wrapped({})).rejects.toThrow(/rate limit/i);
    clock.now += 61_000;
    await expect(wrapped({})).resolves.toEqual({ ok: true });
  });
});
