/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * C1 — verify that the hook installer adds a PreToolUse entry to the
 * `balanced` and `aggressive` profiles, scoped to mcp-graph tools only,
 * and leaves `minimal` gate-free.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installHooks } from "./install.js";

interface SettingsShape {
  hooks?: Record<string, Array<{
    matcher?: string;
    hooks: Array<{ type: string; command: string }>;
  }>>;
}

function readSettings(cwd: string): SettingsShape {
  const path = join(cwd, ".claude", "settings.local.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as SettingsShape;
}

function findHook(
  settings: SettingsShape,
  event: string,
  command: string,
): { matcher?: string; command: string } | null {
  const entries = settings.hooks?.[event];
  if (!entries) return null;
  for (const entry of entries) {
    for (const cmd of entry.hooks) {
      if (cmd.command === command) {
        return { matcher: entry.matcher, command: cmd.command };
      }
    }
  }
  return null;
}

describe("installHooks — PreToolUse for mcp-graph (C1)", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "mg-c1-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("balanced profile installs PreToolUse with matcher='mcp__mcp-graph__.*'", () => {
    installHooks(cwd, { profile: "balanced" });
    const settings = readSettings(cwd);
    const entry = findHook(settings, "PreToolUse", "mcp-graph hook pre-tool-use");
    expect(entry).not.toBeNull();
    expect(entry?.matcher).toBe("mcp__mcp-graph__.*");
  });

  it("aggressive profile installs PreToolUse with matcher='mcp__mcp-graph__.*'", () => {
    installHooks(cwd, { profile: "aggressive" });
    const settings = readSettings(cwd);
    const entry = findHook(settings, "PreToolUse", "mcp-graph hook pre-tool-use");
    expect(entry).not.toBeNull();
    expect(entry?.matcher).toBe("mcp__mcp-graph__.*");
  });

  it("minimal profile does NOT install PreToolUse (gate-free)", () => {
    installHooks(cwd, { profile: "minimal" });
    const settings = readSettings(cwd);
    const entry = findHook(settings, "PreToolUse", "mcp-graph hook pre-tool-use");
    expect(entry).toBeNull();
  });

  it("re-installing the same profile is idempotent (no duplicate PreToolUse entries)", () => {
    installHooks(cwd, { profile: "balanced" });
    installHooks(cwd, { profile: "balanced" });
    installHooks(cwd, { profile: "balanced" });
    const settings = readSettings(cwd);
    const matches = settings.hooks?.PreToolUse?.filter((entry) =>
      entry.hooks.some((h) => h.command === "mcp-graph hook pre-tool-use"),
    ) ?? [];
    expect(matches.length).toBe(1);
  });
});
