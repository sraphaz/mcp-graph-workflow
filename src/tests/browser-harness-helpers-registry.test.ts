/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  HelpersRegistry,
  seedBuiltInHelpers,
  BUILT_IN_HELPER_NAMES,
} from "../core/browser-harness/index.js";
import { HelperNotFoundError } from "../core/utils/errors.js";

let store: SqliteStore;
let registry: HelpersRegistry;

beforeEach(() => {
  store = SqliteStore.openDb(":memory:");
  registry = new HelpersRegistry(store.getDb());
});

describe("HelpersRegistry", () => {
  it("returns null when looking up an unknown helper via find", () => {
    expect(registry.find("nope")).toBeNull();
  });

  it("throws HelperNotFoundError on get for missing name", () => {
    expect(() => registry.get("nope")).toThrow(HelperNotFoundError);
  });

  it("inserts a helper at version 1 and bumps on subsequent upserts", () => {
    const v1 = registry.upsert({
      name: "foo",
      source: "async () => ({ ok: true })",
      signature: { params: [], returns: "{ ok: boolean }" },
      origin: "agent",
      createdBy: "test",
    });
    expect(v1.version).toBe(1);
    expect(v1.origin).toBe("agent");

    const v2 = registry.upsert({
      name: "foo",
      source: "async () => ({ ok: false })",
      signature: { params: [], returns: "{ ok: boolean }" },
      origin: "agent",
      createdBy: "test",
    });
    expect(v2.version).toBe(2);

    const fetched = registry.get("foo");
    expect(fetched.version).toBe(2);
    expect(fetched.source).toContain("ok: false");
  });

  it("seeds all built-in helpers on first run, no-ops on second", () => {
    const inserted = seedBuiltInHelpers(registry);
    expect(inserted).toBe(BUILT_IN_HELPER_NAMES.length);
    const again = seedBuiltInHelpers(registry);
    expect(again).toBe(0);
  });

  it("filters by origin when listing", () => {
    seedBuiltInHelpers(registry);
    registry.upsert({
      name: "extra",
      source: "async () => ({ ok: true })",
      signature: { params: [], returns: "{ ok: boolean }" },
      origin: "agent",
    });
    expect(registry.list("builtin").every((h) => h.origin === "builtin")).toBe(true);
    expect(registry.list("agent")).toHaveLength(1);
    expect(registry.list("agent")[0].name).toBe("extra");
    expect(registry.list().length).toBe(BUILT_IN_HELPER_NAMES.length + 1);
  });
});
