/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Contract tests for src/mcp/tools/taxonomy.ts.
 *
 * The hard rule: every MCP tool exposed by the server MUST have a taxonomy
 * entry. The next test file (taxonomy registration contract, T4.2) will
 * cross-check actual server registrations against this map; here we verify
 * the map's internal consistency and the helpers around it.
 */

import { describe, expect, it } from "vitest";
import {
  TOOL_TAXONOMY,
  getToolProfile,
  isToolVisibleForProfile,
  listToolsForProfile,
  profileCounts,
  ProfileFilterSchema,
  ToolProfileSchema,
} from "../mcp/tools/taxonomy.js";

describe("tool taxonomy — schema integrity", () => {
  it("every entry has a valid profile value", () => {
    for (const [name, profile] of Object.entries(TOOL_TAXONOMY)) {
      const result = ToolProfileSchema.safeParse(profile);
      expect(result.success, `tool ${name} has invalid profile ${profile}`).toBe(true);
    }
  });

  it("ProfileFilterSchema accepts core, pro, expert, all", () => {
    expect(ProfileFilterSchema.safeParse("core").success).toBe(true);
    expect(ProfileFilterSchema.safeParse("pro").success).toBe(true);
    expect(ProfileFilterSchema.safeParse("expert").success).toBe(true);
    expect(ProfileFilterSchema.safeParse("all").success).toBe(true);
    expect(ProfileFilterSchema.safeParse("none").success).toBe(false);
  });
});

describe("tool taxonomy — core profile is intentionally tight", () => {
  it("core profile contains only the daily-loop tools", () => {
    const core = listToolsForProfile("core").sort();
    expect(core).toEqual(
      [
        "finish_task",
        "help",
        "import_prd",
        "init",
        "list",
        "next",
        "start_task",
        "update_status",
      ].sort(),
    );
  });

  it("core profile has at most 10 tools (cognitive-load ceiling)", () => {
    expect(listToolsForProfile("core").length).toBeLessThanOrEqual(10);
  });
});

describe("tool taxonomy — profile hierarchy is inclusive", () => {
  it("pro contains all core tools", () => {
    const core = new Set(listToolsForProfile("core"));
    const pro = new Set(listToolsForProfile("pro"));
    for (const name of core) {
      expect(pro.has(name), `pro missing core tool ${name}`).toBe(true);
    }
  });

  it("expert contains all pro tools", () => {
    const pro = new Set(listToolsForProfile("pro"));
    const expert = new Set(listToolsForProfile("expert"));
    for (const name of pro) {
      expect(expert.has(name), `expert missing pro tool ${name}`).toBe(true);
    }
  });

  it("all contains every registered tool", () => {
    const all = new Set(listToolsForProfile("all"));
    for (const name of Object.keys(TOOL_TAXONOMY)) {
      expect(all.has(name), `all missing tool ${name}`).toBe(true);
    }
  });
});

describe("tool taxonomy — helpers", () => {
  it("getToolProfile returns the registered profile", () => {
    expect(getToolProfile("init")).toBe("core");
    expect(getToolProfile("analyze")).toBe("pro");
    expect(getToolProfile("siebel")).toBe("expert");
  });

  it("getToolProfile defaults unknown tools to 'expert' (safe fallback)", () => {
    expect(getToolProfile("not_a_real_tool_xyz")).toBe("expert");
  });

  it("isToolVisibleForProfile respects the hierarchy", () => {
    expect(isToolVisibleForProfile("init", "core")).toBe(true);
    expect(isToolVisibleForProfile("analyze", "core")).toBe(false);
    expect(isToolVisibleForProfile("analyze", "pro")).toBe(true);
    expect(isToolVisibleForProfile("siebel", "pro")).toBe(false);
    expect(isToolVisibleForProfile("siebel", "expert")).toBe(true);
    expect(isToolVisibleForProfile("siebel", "all")).toBe(true);
  });
});

describe("tool taxonomy — counts", () => {
  it("profileCounts returns consistent totals", () => {
    const counts = profileCounts();
    expect(counts.core + counts.pro + counts.expert).toBe(counts.total);
    expect(counts.total).toBe(Object.keys(TOOL_TAXONOMY).length);
  });

  it("expert is the largest bucket (we resist surface bloat in core/pro)", () => {
    const counts = profileCounts();
    expect(counts.expert).toBeGreaterThanOrEqual(counts.pro);
    expect(counts.expert).toBeGreaterThanOrEqual(counts.core);
  });
});
