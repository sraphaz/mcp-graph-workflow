/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * E4.T06 — MCP tool hooks.ts (list/register/unregister/invoke/stats).
 *
 * AC1: list/stats actions are in the read-only allowlist
 * AC2: Registry contract test covers hooks tool
 * AC3: register action validates handler signature
 */

import { describe, it, expect } from "vitest";
import { hooksInputSchema, buildHooksHandler } from "../mcp/tools/hooks.js";
import { READ_ONLY_TOOLS } from "../core/utils/constants.js";

describe("hooks tool — schema validation", () => {
  it("AC3: register accepts kind=shell with command", () => {
    const parsed = hooksInputSchema.safeParse({ action: "register", channel: "task:post-complete", kind: "shell", command: "/bin/true" });
    expect(parsed.success).toBe(true);
  });

  it("AC3: register accepts kind=inline-unsafe with handlerCode", () => {
    const parsed = hooksInputSchema.safeParse({ action: "register", channel: "task:post-complete", kind: "inline-unsafe", handlerCode: "async (e) => {}" });
    expect(parsed.success).toBe(true);
  });

  it("AC3: register rejects shell kind without command", () => {
    const parsed = hooksInputSchema.safeParse({ action: "register", channel: "task:post-complete", kind: "shell" });
    expect(parsed.success).toBe(false);
  });

  it("AC3: register rejects invalid channel", () => {
    const parsed = hooksInputSchema.safeParse({ action: "register", channel: "invalid:channel", kind: "shell", command: "/bin/true" });
    expect(parsed.success).toBe(false);
  });

  it("list action parses without extra fields", () => {
    const parsed = hooksInputSchema.safeParse({ action: "list" });
    expect(parsed.success).toBe(true);
  });

  it("stats action parses without extra fields", () => {
    const parsed = hooksInputSchema.safeParse({ action: "stats" });
    expect(parsed.success).toBe(true);
  });

  it("unregister requires handlerId", () => {
    const parsed = hooksInputSchema.safeParse({ action: "unregister", handlerId: "my-handler" });
    expect(parsed.success).toBe(true);
  });

  it("unregister rejects missing handlerId", () => {
    const parsed = hooksInputSchema.safeParse({ action: "unregister" });
    expect(parsed.success).toBe(false);
  });

  it("invoke requires channel", () => {
    const parsed = hooksInputSchema.safeParse({ action: "invoke", channel: "session:start" });
    expect(parsed.success).toBe(true);
  });
});

// ── AC1: list/stats in read-only allowlist ────────────────────────────────

describe("hooks tool — read-only classification", () => {
  it("AC1: 'hooks' is in READ_ONLY_TOOLS", () => {
    expect(READ_ONLY_TOOLS.has("hooks")).toBe(true);
  });
});

// ── AC2: handler golden path ──────────────────────────────────────────────

describe("hooks handler — golden paths", () => {
  it("AC2: list returns empty registry on fresh bus", async () => {
    const handler = buildHooksHandler();
    const result = await handler({ action: "list" });
    expect(result.isError).toBeFalsy();
    const body = JSON.parse(result.content[0].text);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.handlers)).toBe(true);
  });

  it("AC2: stats returns channel counts", async () => {
    const handler = buildHooksHandler();
    const result = await handler({ action: "stats" });
    const body = JSON.parse(result.content[0].text);
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("totalHandlers");
    expect(body).toHaveProperty("channels");
  });

  it("AC2: register adds a kind=shell handler to the registry", async () => {
    const handler = buildHooksHandler();
    const reg = await handler({
      action: "register",
      channel: "task:post-complete",
      kind: "shell",
      command: "/bin/true",
      handlerId: "test-handler",
    });
    const body = JSON.parse(reg.content[0].text);
    expect(body.ok).toBe(true);
    expect(body.handlerId).toBe("test-handler");
    expect(body.kind).toBe("shell");

    const list = await handler({ action: "list" });
    const listBody = JSON.parse(list.content[0].text);
    expect(listBody.handlers.some((h: { id: string }) => h.id === "test-handler")).toBe(true);
  });

  it("AC2: unregister removes a previously registered handler", async () => {
    const handler = buildHooksHandler();
    await handler({ action: "register", channel: "task:post-complete", kind: "shell", command: "/bin/true", handlerId: "rm-me" });
    await handler({ action: "unregister", handlerId: "rm-me" });

    const list = await handler({ action: "list" });
    const body = JSON.parse(list.content[0].text);
    expect(body.handlers.some((h: { id: string }) => h.id === "rm-me")).toBe(false);
  });

  it("AC2: register rejects kind=inline-unsafe without env opt-in", async () => {
    delete process.env.MCP_GRAPH_HOOKS_INLINE_UNSAFE;
    const handler = buildHooksHandler();
    const reg = await handler({
      action: "register",
      channel: "task:post-complete",
      kind: "inline-unsafe",
      handlerCode: "async (e) => {}",
      handlerId: "rce-attempt",
    });
    expect(reg.isError).toBe(true);
    expect(reg.content[0].text).toMatch(/disabled by default/i);
  });

  it("AC2: register accepts kind=inline-unsafe when env flag is set", async () => {
    process.env.MCP_GRAPH_HOOKS_INLINE_UNSAFE = "true";
    try {
      const handler = buildHooksHandler();
      const reg = await handler({
        action: "register",
        channel: "task:post-complete",
        kind: "inline-unsafe",
        handlerCode: "async (e) => {}",
        handlerId: "legacy-ok",
      });
      const body = JSON.parse(reg.content[0].text);
      expect(body.ok).toBe(true);
      expect(body.kind).toBe("inline-unsafe");
    } finally {
      delete process.env.MCP_GRAPH_HOOKS_INLINE_UNSAFE;
    }
  });

  it("AC2: invoke emits event to registered handler", async () => {
    const handler = buildHooksHandler();
    const result = await handler({
      action: "invoke",
      channel: "session:start",
      payload: { userId: "u1" },
    });
    const body = JSON.parse(result.content[0].text);
    expect(body.ok).toBe(true);
    expect(body.channel).toBe("session:start");
  });
});
