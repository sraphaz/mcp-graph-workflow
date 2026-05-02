/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  getEffectiveStrictness,
  getEffectivePhases,
  getEffectiveDodChecks,
} from "../core/presets/preset-gate-adapter.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";

interface FakeStore {
  settings: Map<string, string>;
}

function makeStore(initial: Record<string, string> = {}): SqliteStore {
  const settings = new Map(Object.entries(initial));
  const fake: FakeStore & {
    getProjectSetting: (k: string) => string | null;
  } = {
    settings,
    getProjectSetting(key: string): string | null {
      return settings.get(key) ?? null;
    },
  };
  return fake as unknown as SqliteStore;
}

describe("getEffectiveStrictness", () => {
  it("project override always wins, even with preset active", () => {
    const store = makeStore({
      lifecycle_strictness_mode: "advisory",
      active_preset: "strict-tdd",
    });
    expect(getEffectiveStrictness(store)).toBe("advisory");
  });

  it('default is "strict" when no preset and no override', () => {
    const store = makeStore({});
    expect(getEffectiveStrictness(store)).toBe("strict");
  });

  it("returns preset's strictness when no project override", () => {
    const store = makeStore({ active_preset: "strict-tdd" });
    const result = getEffectiveStrictness(store);
    // preset-resolver yields a real value; just verify it's one of the allowed strings
    expect(["strict", "advisory", "off"]).toContain(result);
  });
});

describe("getEffectivePhases", () => {
  it("returns all 9 phases when no preset is active", () => {
    const store = makeStore({});
    const phases = getEffectivePhases(store);
    expect(phases).toEqual([
      "ANALYZE",
      "DESIGN",
      "PLAN",
      "IMPLEMENT",
      "VALIDATE",
      "REVIEW",
      "HANDOFF",
      "DEPLOY",
      "LISTENING",
    ]);
  });

  it("returns a fresh array (not the module-level constant)", () => {
    const store = makeStore({});
    const a = getEffectivePhases(store);
    a.push("EXTRA");
    const b = getEffectivePhases(store);
    expect(b).not.toContain("EXTRA");
  });

  it("delegates to preset-resolver when preset is set", () => {
    const store = makeStore({ active_preset: "agile-light" });
    const phases = getEffectivePhases(store);
    expect(Array.isArray(phases)).toBe(true);
    expect(phases.length).toBeGreaterThan(0);
  });
});

describe("getEffectiveDodChecks", () => {
  it("returns empty object when no preset is active", () => {
    const store = makeStore({});
    expect(getEffectiveDodChecks(store)).toEqual({});
  });

  it("returns object with check toggles when preset is active", () => {
    const store = makeStore({ active_preset: "strict-tdd" });
    const checks = getEffectiveDodChecks(store);
    expect(typeof checks).toBe("object");
    expect(checks).not.toBeNull();
  });
});
