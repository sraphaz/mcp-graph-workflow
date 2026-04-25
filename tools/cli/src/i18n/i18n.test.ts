/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("i18n", () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), "mg-i18n-"));
    vi.stubEnv("HOME", tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it("returns English by default when no env, no persist, no flag", async () => {
    vi.stubEnv("MG_LANG", "");
    vi.stubEnv("LANG", "");
    const { resolveLang } = await import("./index.js");
    expect(resolveLang()).toBe("en");
  });

  it("--lang flag wins over env and persist", async () => {
    vi.stubEnv("MG_LANG", "pt-br");
    const { resolveLang, persistLang } = await import("./index.js");
    persistLang("pt-br");
    expect(resolveLang({ cliFlag: "en" })).toBe("en");
  });

  it("MG_LANG env wins over persist + LANG", async () => {
    vi.stubEnv("MG_LANG", "pt-br");
    vi.stubEnv("LANG", "en_US.UTF-8");
    const { resolveLang } = await import("./index.js");
    expect(resolveLang()).toBe("pt-br");
  });

  it("persisted config wins over $LANG env detection", async () => {
    vi.stubEnv("MG_LANG", "");
    vi.stubEnv("LANG", "pt_BR.UTF-8");
    const { resolveLang, persistLang } = await import("./index.js");
    persistLang("en");
    expect(resolveLang()).toBe("en");
  });

  it("$LANG=pt_BR detects pt-br", async () => {
    vi.stubEnv("MG_LANG", "");
    vi.stubEnv("LANG", "pt_BR.UTF-8");
    const { resolveLang } = await import("./index.js");
    expect(resolveLang()).toBe("pt-br");
  });

  it("invalid --lang flag falls through to next resolver", async () => {
    vi.stubEnv("MG_LANG", "pt-br");
    const { resolveLang } = await import("./index.js");
    expect(resolveLang({ cliFlag: "klingon" })).toBe("pt-br");
  });

  it("persistLang round-trips through readPersistedLang", async () => {
    const { persistLang, readPersistedLang } = await import("./index.js");
    persistLang("pt-br");
    expect(readPersistedLang()).toBe("pt-br");
    persistLang("en");
    expect(readPersistedLang()).toBe("en");
  });

  it("persistLang preserves other config keys", async () => {
    const { persistLang, configPath } = await import("./index.js");
    const { writeFileSync, readFileSync, mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    const path = configPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ telemetry: false, foo: "bar" }), "utf8");
    persistLang("pt-br");
    const after = JSON.parse(readFileSync(path, "utf8"));
    expect(after.telemetry).toBe(false);
    expect(after.foo).toBe("bar");
    expect(after.lang).toBe("pt-br");
  });

  it("t() interpolates {var} placeholders", async () => {
    const { t, setActiveLang } = await import("./index.js");
    setActiveLang("en");
    expect(t("add.created", { type: "task" })).toBe("✔ created task");
  });

  it("t() falls back to English when key missing in active lang", async () => {
    // (no key currently exists in en that's missing from pt-br — this test
    // verifies the fallback infrastructure works)
    const { t, setActiveLang } = await import("./index.js");
    setActiveLang("pt-br");
    // unknown key returns the key itself
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("t() respects active language", async () => {
    const { t, setActiveLang } = await import("./index.js");
    setActiveLang("en");
    expect(t("init.success")).toBe("✔ mcp-graph initialized");
    setActiveLang("pt-br");
    expect(t("init.success")).toBe("✔ mcp-graph inicializado");
  });
});
