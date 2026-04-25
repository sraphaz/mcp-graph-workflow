/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthStore, redactAuthView } from "../core/browser-harness/auth-store.js";

describe("AuthStore", () => {
  let tmpRoot: string;
  let store: AuthStore;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "bh-auth-"));
    store = new AuthStore(tmpRoot);
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    for (const k of ["ANTHROPIC_API_KEY", "GITHUB_COPILOT_TOKEN"]) {
      Reflect.deleteProperty(process.env, k);
    }
  });

  it("returns empty state when nothing is stored", () => {
    const view = store.read();
    expect(view.authenticated).toBe(false);
    expect(view.providers).toEqual({});
  });

  it("saves an Anthropic provider and returns a redacted view", () => {
    store.save({
      provider: "anthropic",
      apiKey: "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890",
      model: "claude-opus-4-7",
    });
    const view = store.read();
    expect(view.authenticated).toBe(true);
    expect(view.preferredProvider).toBe("anthropic");
    expect(view.providers.anthropic?.model).toBe("claude-opus-4-7");
    expect(view.providers.anthropic?.fingerprint).toMatch(/\.\.\./);
    expect(view.providers.anthropic?.fingerprint).not.toMatch(/ABCDEFGHIJKLMNOP/);
  });

  it("persists to workflow-graph/bh-auth.json under the project root", () => {
    store.save({
      provider: "anthropic",
      apiKey: "sk-ant-api03-0123456789abcdef0123456789abcdef0123456789abcdef",
    });
    const filePath = join(tmpRoot, "workflow-graph", "bh-auth.json");
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
    expect((raw.providers as Record<string, { apiKey: string }>).anthropic?.apiKey).toMatch(
      /^sk-ant-api03-/,
    );
    const mode = statSync(filePath).mode & 0o777;
    if (process.platform !== "win32") {
      expect(mode).toBe(0o600);
    }
  });

  it("supports multiple providers and preferred toggle", () => {
    store.save({
      provider: "anthropic",
      apiKey: "sk-ant-api03-0123456789abcdef0123456789abcdef0123456789abcdef",
    });
    store.save({
      provider: "copilot",
      apiKey: "ghu_abcdefghijklmnopqrstuvwxyz1234567890",
      preferred: true,
    });
    const view = store.read();
    expect(view.preferredProvider).toBe("copilot");
    expect(view.providers.anthropic).toBeDefined();
    expect(view.providers.copilot).toBeDefined();
  });

  it("getRawKey returns the stored key for the preferred provider", () => {
    store.save({
      provider: "anthropic",
      apiKey: "sk-ant-api03-0123456789abcdef0123456789abcdef0123456789abcdef",
    });
    const key = store.getRawKey("anthropic");
    expect(key).toMatch(/^sk-ant-api03-/);
  });

  it("deletes a provider", () => {
    store.save({
      provider: "anthropic",
      apiKey: "sk-ant-api03-0123456789abcdef0123456789abcdef0123456789abcdef",
    });
    store.clear();
    const view = store.read();
    expect(view.authenticated).toBe(false);
  });

  it("falls back to env var when no file exists", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-envvar0123456789abcdef0123456789abcdef0123456789";
    const view = store.read();
    expect(view.authenticated).toBe(true);
    expect(view.providers.anthropic?.source).toBe("env");
  });

  it("file wins over env var", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-envvar0123456789abcdef0123456789abcdef0123456789";
    store.save({
      provider: "anthropic",
      apiKey: "sk-ant-api03-filefile0123456789abcdef0123456789abcdef0123456789",
    });
    const view = store.read();
    expect(view.providers.anthropic?.source).toBe("file");
  });

  it("rejects obviously invalid keys at save time", () => {
    expect(() =>
      store.save({ provider: "anthropic", apiKey: "not-a-key" }),
    ).toThrow(/invalid/i);
    expect(() =>
      store.save({ provider: "copilot", apiKey: "x" }),
    ).toThrow(/invalid/i);
  });

  it("redactAuthView never returns raw keys", () => {
    store.save({
      provider: "anthropic",
      apiKey: "sk-ant-api03-secretpart0123456789abcdef0123456789abcdef0123456789",
    });
    const redacted = redactAuthView(store.read());
    const serialised = JSON.stringify(redacted);
    expect(serialised).not.toContain("secretpart");
  });
});
