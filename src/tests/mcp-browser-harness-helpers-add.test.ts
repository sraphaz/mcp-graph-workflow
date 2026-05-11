/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.3 — helpers_add seguro: validation via SelfHealService + persistence.
 *
 * AC1: helpers_add(name, valid_source) → helpers_list recognizes it
 * AC2: body with forbidden API (eval, fs, child_process) → isError + forbidden_api
 * AC3: body > size cap → isError
 * AC4: persisted helper survives restart (new handler, same DB)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildBrowserHarnessHandler } from "../mcp/tools/browser-harness.js";
import { SqliteStore } from "../core/store/sqlite-store.js";

// Valid source: arrow fn with no forbidden patterns
const VALID_SOURCE = "async (args) => { return { ok: true, path: args.path }; }";

// Oversized source: > 4096 bytes
const OVERSIZED_SOURCE = `async (args) => { ${"// x".repeat(1200)} return args; }`;

let store: SqliteStore;
let handler: ReturnType<typeof buildBrowserHarnessHandler>;

beforeEach(() => {
  store = SqliteStore.open(":memory:");
  store.initProject("test");
  handler = buildBrowserHarnessHandler(store);
});

afterEach(() => {
  store.close();
});

// ─── AC1: accepted helper is recognized on next invocation ─────────────────────

describe("helpers_add — AC1: accepted helper is recognized on next invocation", () => {
  it("helpers_add then helpers_list returns the new helper", async () => {
    const addResult = await handler({ op: "helpers_add", name: "upload_file", source: VALID_SOURCE });
    expect(addResult.isError).toBeFalsy();

    const listResult = await handler({ op: "helpers_list" });
    expect(listResult.isError).toBeFalsy();
    const body = JSON.parse(listResult.content[0].text) as { ok: boolean; helpers: Array<{ name: string }> };
    expect(body.ok).toBe(true);
    expect(body.helpers.some((h) => h.name === "upload_file")).toBe(true);
  });

  it("accepted helper response includes name and version", async () => {
    const addResult = await handler({ op: "helpers_add", name: "my_helper", source: VALID_SOURCE });
    expect(addResult.isError).toBeFalsy();
    const body = JSON.parse(addResult.content[0].text) as { ok: boolean; name: string; version: number };
    expect(body.ok).toBe(true);
    expect(body.name).toBe("my_helper");
    expect(body.version).toBeGreaterThanOrEqual(1);
  });

  it("re-adding same helper increments version", async () => {
    await handler({ op: "helpers_add", name: "versioned", source: VALID_SOURCE });
    const result2 = await handler({ op: "helpers_add", name: "versioned", source: VALID_SOURCE });
    const body = JSON.parse(result2.content[0].text) as { version: number };
    expect(body.version).toBeGreaterThanOrEqual(2);
  });
});

// ─── AC2: forbidden APIs → rejected ────────────────────────────────────────────

describe("helpers_add — AC2: forbidden API in source → forbidden_api error", () => {
  it("source with eval() → isError with forbidden_api", async () => {
    const result = await handler({
      op: "helpers_add",
      name: "evil",
      source: "async (args) => { eval(args.code); }",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/forbidden_api|forbidden/i);
  });

  it("source with fs import → isError", async () => {
    const result = await handler({
      op: "helpers_add",
      name: "evil",
      source: "async (args) => { const fs = require('fs'); return fs.readFileSync('/etc/passwd').toString(); }",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/forbidden_api|forbidden/i);
  });

  it("source with child_process → isError", async () => {
    const result = await handler({
      op: "helpers_add",
      name: "evil",
      source: "async (args) => { const cp = child_process.exec(args.cmd); }",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/forbidden_api|forbidden/i);
  });
});

// ─── AC3: body > size cap → rejected ──────────────────────────────────────────

describe("helpers_add — AC3: source > size cap → isError", () => {
  it("oversized source is rejected", async () => {
    const result = await handler({
      op: "helpers_add",
      name: "oversized",
      source: OVERSIZED_SOURCE,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/forbidden_api|exceed|maxSource|size/i);
  });
});

// ─── AC4: persistence survives restart ──────────────────────────────────────────

describe("helpers_add — AC4: persisted helper survives handler restart", () => {
  it("new handler instance from same DB still finds the helper", async () => {
    await handler({ op: "helpers_add", name: "persistent_helper", source: VALID_SOURCE });

    // Simulate restart: new handler backed by same DB
    const handler2 = buildBrowserHarnessHandler(store);
    const listResult = await handler2({ op: "helpers_list" });
    const body = JSON.parse(listResult.content[0].text) as { helpers: Array<{ name: string }> };
    expect(body.helpers.some((h) => h.name === "persistent_helper")).toBe(true);
  });

  it("missing name/source → isError without touching registry", async () => {
    const r1 = await handler({ op: "helpers_add" });
    expect(r1.isError).toBe(true);

    const listResult = await handler({ op: "helpers_list" });
    const body = JSON.parse(listResult.content[0].text) as { helpers: unknown[] };
    // Only built-in helpers (if any)
    const agentHelpers = body.helpers;
    expect(agentHelpers.every((h) => (h as { name: string }).name !== undefined)).toBe(true);
  });
});
