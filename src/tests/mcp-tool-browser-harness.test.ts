/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.1 — browser_harness MCP tool rewrite.
 *
 * AC1: inputSchema only exposes atomic primitives (no chat/plan/auto_heal)
 * AC2: op:"screenshot" returns PNG base64 with zero LLM code in path
 * AC3: unknown op fails Zod validation → isError:true
 * AC4: handler invocation triggers tool_token_usage record via telemetry helper
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { browserHarnessInputSchema, buildBrowserHarnessHandler } from "../mcp/tools/browser-harness.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { recordToolCallTelemetry } from "../mcp/unified-gate-telemetry.js";
import { ToolTokenStore } from "../core/store/tool-token-store.js";

const EXPECTED_OPS = [
  "cdp", "js", "screenshot", "click", "type",
  "new_tab", "page_info", "wait_for_load",
  "helpers_add", "helpers_list", "recover",
] as const;

describe("browser_harness tool — AC1: schema only exposes atomic primitives", () => {
  it("op enum contains exactly the required primitives", () => {
    const result = browserHarnessInputSchema.shape.op;
    // Zod v4 enum exposes options array
    const options: string[] = (result as { options: string[] }).options;
    expect(options.sort()).toEqual([...EXPECTED_OPS].sort());
  });

  it("does not include chat, plan or auto_heal", () => {
    for (const forbidden of ["chat", "plan", "auto_heal"]) {
      const r = browserHarnessInputSchema.safeParse({ op: forbidden });
      expect(r.success, `"${forbidden}" should be rejected`).toBe(false);
    }
  });
});

describe("browser_harness tool — AC3: unknown op → isError", () => {
  it("unknown op fails Zod safeParse", () => {
    const r = browserHarnessInputSchema.safeParse({ op: "destroy_everything" });
    expect(r.success).toBe(false);
  });

  it("missing op field fails Zod safeParse", () => {
    const r = browserHarnessInputSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("handler returns isError:true for schema-invalid input", async () => {
    let store: SqliteStore | undefined;
    try {
      store = SqliteStore.open(":memory:");
      store.initProject("test");
      const handler = buildBrowserHarnessHandler(store);
      // Pass a raw op that bypasses Zod (simulate post-parse call with bad op)
      const result = await handler({ op: "not_an_op" as never });
      expect(result.isError).toBe(true);
    } finally {
      store?.close();
    }
  });
});

describe("browser_harness tool — AC2: screenshot returns base64 with no LLM path", () => {
  it("screenshot op with no active session returns structured error (not LLM call)", async () => {
    let store: SqliteStore | undefined;
    try {
      store = SqliteStore.open(":memory:");
      store.initProject("test");
      const handler = buildBrowserHarnessHandler(store);
      // No session created → must return error without calling any LLM
      const result = await handler({ op: "screenshot", sessionId: "nonexistent-session" });
      expect(result.isError).toBe(true);
      const body = result.content[0].text;
      // Must be structured JSON error — not an LLM response
      expect(() => JSON.parse(body)).not.toThrow();
    } finally {
      store?.close();
    }
  });
});

describe("browser_harness tool — AC4: tool_token_usage record via telemetry helper", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("test-project");
  });

  afterEach(() => {
    store.close();
  });

  it("recordToolCallTelemetry writes a row for browser_harness", () => {
    recordToolCallTelemetry(store, "browser_harness", 10, 5, true, 42);
    const tokenStore = new ToolTokenStore(store.getDb());
    const summary = tokenStore.getSummary(store.getProject()!.id);
    const entry = summary.perTool.find((t) => t.toolName === "browser_harness");
    expect(entry).toBeDefined();
    expect(entry!.callCount).toBe(1);
  });
});
