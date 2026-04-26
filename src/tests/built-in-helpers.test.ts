/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { HelpersRegistry } from "../core/browser-harness/helpers-registry.js";
import {
  BUILT_IN_HELPER_NAMES,
  seedBuiltInHelpers,
} from "../core/browser-harness/built-in-helpers.js";

describe("built-in-helpers", () => {
  let store: SqliteStore;
  let registry: HelpersRegistry;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("built-in-helpers test");
    registry = new HelpersRegistry(store.getDb());
  });

  describe("BUILT_IN_HELPER_NAMES", () => {
    it("exposes the expected canonical browser-harness primitives", () => {
      // These are the contract the harness's helper-resolver depends on.
      // Renaming or removing one is a breaking change for every plan that
      // referenced it — the test pins the surface.
      const expected = [
        "navigate",
        "evaluate",
        "screenshot",
        "wait_for",
        "click",
        "type_text",
        "get_url",
        "get_text",
      ];
      expect([...BUILT_IN_HELPER_NAMES].sort()).toEqual([...expected].sort());
    });

    it("contains no duplicates", () => {
      const set = new Set(BUILT_IN_HELPER_NAMES);
      expect(set.size).toBe(BUILT_IN_HELPER_NAMES.length);
    });
  });

  describe("seedBuiltInHelpers", () => {
    it("inserts every built-in on a fresh registry", () => {
      const inserted = seedBuiltInHelpers(registry);
      expect(inserted).toBe(BUILT_IN_HELPER_NAMES.length);

      for (const name of BUILT_IN_HELPER_NAMES) {
        const helper = registry.find(name);
        expect(helper).not.toBeNull();
        expect(helper?.origin).toBe("builtin");
      }
    });

    it("is idempotent — re-running inserts zero when source unchanged", () => {
      seedBuiltInHelpers(registry);
      const second = seedBuiltInHelpers(registry);
      expect(second).toBe(0);
    });

    it("re-inserts only helpers whose builtin source changed", () => {
      seedBuiltInHelpers(registry);
      // Force a single helper to look "stale" by upserting a custom version
      // with origin="builtin" but mutated source. Re-seed should detect the
      // mismatch and bump that one (and only that one).
      registry.upsert({
        name: "navigate",
        source: "// stale custom source",
        signature: { params: [{ name: "url", type: "string" }], returns: "{ ok: boolean }" },
        origin: "builtin",
        createdBy: null,
      });
      const reinserted = seedBuiltInHelpers(registry);
      expect(reinserted).toBe(1);
    });

    it("each seeded helper carries a non-empty source string", () => {
      seedBuiltInHelpers(registry);
      for (const name of BUILT_IN_HELPER_NAMES) {
        const h = registry.find(name);
        expect(h?.source.length).toBeGreaterThan(0);
        expect(h?.source).toContain("cdp");
      }
    });
  });
});
