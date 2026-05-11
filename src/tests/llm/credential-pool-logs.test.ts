/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 2.3: pool:select / pool:error / pool:circuit-open structured logs
 *
 * AC1: GIVEN selectEntry runs WHEN log captured THEN pool:select with providerId + secretRef (not key)
 * AC2: GIVEN markError called WHEN log captured THEN pool:error with error class + errorCount
 * AC3: GIVEN circuit opens WHEN event pool:circuit-open emitted with providerId + secretRef
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CredentialPool } from "../../core/llm/credential-pool.js";
import type { CredentialPoolEntry } from "../../core/llm/credential-pool-schema.js";
import type { ContextualLogger } from "../../core/utils/logger.js";

function makeEntry(overrides: Partial<CredentialPoolEntry> = {}): CredentialPoolEntry {
  return { providerId: "openai", secretRef: "secret:ref-1", kind: "api_key", errorCount: 0, ...overrides };
}

function mockLogger(): ContextualLogger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() };
}

// ── AC1: pool:select ──────────────────────────────────────────────────────────

describe("CredentialPool logs — AC1: pool:select", () => {
  it("AC1: emits pool:select debug log with providerId and secretRef when entry is selected", () => {
    const log = mockLogger();
    const pool = new CredentialPool(log);
    pool.addEntries("openai", [makeEntry({ secretRef: "secret:key-1" })]);

    pool.selectEntry("openai");

    expect(log.debug).toHaveBeenCalledWith(
      "pool:select",
      expect.objectContaining({ providerId: "openai", secretRef: "secret:key-1" }),
    );
  });

  it("AC1: log does NOT include the raw credential value — only secretRef", () => {
    const log = mockLogger();
    const pool = new CredentialPool(log);
    pool.addEntries("openai", [makeEntry({ secretRef: "secret:key-1" })]);
    pool.selectEntry("openai");

    const calls = vi.mocked(log.debug).mock.calls;
    const allArgs = JSON.stringify(calls);
    expect(allArgs).not.toContain("rawKey");
    expect(allArgs).not.toContain("apiKey");
  });

  it("AC1: no pool:select log emitted when selectEntry returns null", () => {
    const log = mockLogger();
    const pool = new CredentialPool(log);
    pool.selectEntry("unknown");
    expect(log.debug).not.toHaveBeenCalledWith("pool:select", expect.anything());
  });
});

// ── AC2: pool:error ───────────────────────────────────────────────────────────

describe("CredentialPool logs — AC2: pool:error", () => {
  it("AC2: emits pool:error warn log with errorClass and errorCount", () => {
    const log = mockLogger();
    const pool = new CredentialPool(log);
    const entry = makeEntry({ secretRef: "secret:e1" });
    pool.addEntries("openai", [entry]);

    pool.markError(entry, new TypeError("timeout"));

    expect(log.warn).toHaveBeenCalledWith(
      "pool:error",
      expect.objectContaining({ errorClass: "TypeError", errorCount: 1 }),
    );
  });

  it("AC2: errorCount in log reflects current count after increment", () => {
    const log = mockLogger();
    const pool = new CredentialPool(log);
    const entry = makeEntry({ secretRef: "secret:e2", errorCount: 1 });
    pool.addEntries("openai", [entry]);

    pool.markError(entry, new Error("network"));

    const call = vi.mocked(log.warn).mock.calls.find(([msg]) => msg === "pool:error");
    expect(call?.[1]).toMatchObject({ errorCount: 2 });
  });
});

// ── AC3: pool:circuit-open ────────────────────────────────────────────────────

describe("CredentialPool logs — AC3: pool:circuit-open", () => {
  it("AC3: emits pool:circuit-open when errorCount reaches threshold (3)", () => {
    const log = mockLogger();
    const pool = new CredentialPool(log);
    const entry = makeEntry({ secretRef: "secret:circ", errorCount: 2 });
    pool.addEntries("openai", [entry]);

    pool.markError(entry, new Error("fail"));

    expect(log.warn).toHaveBeenCalledWith(
      "pool:circuit-open",
      expect.objectContaining({ providerId: "openai", secretRef: "secret:circ" }),
    );
  });

  it("AC3: pool:circuit-open NOT emitted when threshold not yet reached", () => {
    const log = mockLogger();
    const pool = new CredentialPool(log);
    const entry = makeEntry({ secretRef: "secret:safe", errorCount: 0 });
    pool.addEntries("openai", [entry]);

    pool.markError(entry, new Error("fail"));

    const circuitCalls = vi.mocked(log.warn).mock.calls.filter(([msg]) => msg === "pool:circuit-open");
    expect(circuitCalls).toHaveLength(0);
  });
});

// ── Backward compat: existing tests still work without injected logger ────────

describe("CredentialPool — backward compat (no injected logger)", () => {
  let pool: CredentialPool;
  beforeEach(() => { pool = new CredentialPool(); });

  it("selectEntry still works without injected logger", () => {
    pool.addEntries("openai", [makeEntry()]);
    expect(pool.selectEntry("openai")).not.toBeNull();
  });

  it("markError still works without injected logger", () => {
    const entry = makeEntry();
    pool.addEntries("openai", [entry]);
    expect(() => pool.markError(entry, new Error("fail"))).not.toThrow();
  });
});
