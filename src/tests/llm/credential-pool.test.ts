/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — CredentialPool class: round-robin + circuit breaker
 *
 * AC1: GIVEN pool com 3 entries healthy WHEN 3 selectEntry THEN cada uma retornada uma vez (round-robin)
 * AC2: GIVEN entry com errorCount >= 3 WHEN selectEntry THEN ignorada (circuit open)
 * AC3: GIVEN entry OAuth com expiresAt no passado WHEN selectEntry THEN ignorada
 * AC4: GIVEN markError 3x WHEN selectEntry posterior THEN entry pulada
 * AC5: GIVEN markSuccess WHEN selectEntry posterior THEN errorCount resetado para 0
 */

import { describe, it, expect } from "vitest";
import { CredentialPool } from "../../core/llm/credential-pool.js";
import type { CredentialPoolEntry } from "../../core/llm/credential-pool-schema.js";

function makeEntry(overrides: Partial<CredentialPoolEntry> = {}): CredentialPoolEntry {
  return {
    providerId: "openai",
    secretRef: "secret:ref-1",
    kind: "api_key",
    errorCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1: round-robin across 3 healthy entries
// ---------------------------------------------------------------------------

describe("CredentialPool — AC1: round-robin", () => {
  it("should return each of 3 healthy entries once across 3 consecutive selectEntry calls", () => {
    const pool = new CredentialPool();
    const entries: CredentialPoolEntry[] = [
      makeEntry({ secretRef: "secret:a", lastUsedAt: 100 }),
      makeEntry({ secretRef: "secret:b", lastUsedAt: 200 }),
      makeEntry({ secretRef: "secret:c", lastUsedAt: 300 }),
    ];
    pool.addEntries("openai", entries);

    const results = [
      pool.selectEntry("openai"),
      pool.selectEntry("openai"),
      pool.selectEntry("openai"),
    ];

    const refs = results.map((e) => e?.secretRef).sort();
    expect(refs).toEqual(["secret:a", "secret:b", "secret:c"]);
  });

  it("should return null for unknown providerId", () => {
    const pool = new CredentialPool();
    expect(pool.selectEntry("unknown")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC2: circuit open — errorCount >= 3 skipped
// ---------------------------------------------------------------------------

describe("CredentialPool — AC2: circuit breaker skips entries with errorCount >= 3", () => {
  it("should skip an entry with errorCount >= 3", () => {
    const pool = new CredentialPool();
    pool.addEntries("openai", [
      makeEntry({ secretRef: "secret:broken", errorCount: 3 }),
      makeEntry({ secretRef: "secret:healthy", errorCount: 0 }),
    ]);

    const results = new Set([
      pool.selectEntry("openai")?.secretRef,
      pool.selectEntry("openai")?.secretRef,
    ]);
    expect(results.has("secret:broken")).toBe(false);
    expect(results.has("secret:healthy")).toBe(true);
  });

  it("should return null when all entries have circuit open", () => {
    const pool = new CredentialPool();
    pool.addEntries("openai", [makeEntry({ errorCount: 5 })]);
    expect(pool.selectEntry("openai")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC3: expired OAuth entries ignored
// ---------------------------------------------------------------------------

describe("CredentialPool — AC3: expired OAuth entries ignored", () => {
  it("should skip oauth_bearer entry with expiresAt in the past", () => {
    const pool = new CredentialPool();
    pool.addEntries("google", [
      makeEntry({ providerId: "google", secretRef: "secret:expired", kind: "oauth_bearer", expiresAt: Date.now() - 1000 }),
      makeEntry({ providerId: "google", secretRef: "secret:fresh", kind: "api_key" }),
    ]);

    const results = new Set([
      pool.selectEntry("google")?.secretRef,
      pool.selectEntry("google")?.secretRef,
    ]);
    expect(results.has("secret:expired")).toBe(false);
    expect(results.has("secret:fresh")).toBe(true);
  });

  it("should accept oauth_bearer entry with future expiresAt", () => {
    const pool = new CredentialPool();
    pool.addEntries("google", [
      makeEntry({ providerId: "google", secretRef: "secret:valid", kind: "oauth_bearer", expiresAt: Date.now() + 3600_000 }),
    ]);
    expect(pool.selectEntry("google")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC4: markError 3x → entry skipped
// ---------------------------------------------------------------------------

describe("CredentialPool — AC4: markError 3x opens circuit", () => {
  it("should skip entry after markError called 3 times", () => {
    const pool = new CredentialPool();
    const entry = makeEntry({ secretRef: "secret:weak" });
    pool.addEntries("openai", [entry, makeEntry({ secretRef: "secret:strong" })]);

    pool.markError(entry, new Error("timeout"));
    pool.markError(entry, new Error("timeout"));
    pool.markError(entry, new Error("timeout"));

    const results = new Set([
      pool.selectEntry("openai")?.secretRef,
      pool.selectEntry("openai")?.secretRef,
    ]);
    expect(results.has("secret:weak")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC5: markSuccess resets errorCount to 0
// ---------------------------------------------------------------------------

describe("CredentialPool — AC5: markSuccess resets errorCount", () => {
  it("should reset errorCount to 0 after markSuccess", () => {
    const pool = new CredentialPool();
    const entry = makeEntry({ secretRef: "secret:recovering", errorCount: 2 });
    pool.addEntries("openai", [entry]);

    pool.markSuccess(entry);

    const selected = pool.selectEntry("openai");
    expect(selected).not.toBeNull();
    expect(selected?.errorCount).toBe(0);
  });
});
