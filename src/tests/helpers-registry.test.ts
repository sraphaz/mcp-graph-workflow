/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { HelpersRegistry, type UpsertHelperInput } from "../core/browser-harness/helpers-registry.js";
import { HelperNotFoundError } from "../core/utils/errors.js";

function makeInput(name = "click_button", overrides: Partial<UpsertHelperInput> = {}): UpsertHelperInput {
  return {
    name,
    source: "async (page, args) => { await page.click(args.selector); }",
    signature: {
      params: [{ name: "selector", type: "string" }],
      returns: "void",
    },
    origin: "agent",
    createdBy: "test",
    ...overrides,
  };
}

describe("HelpersRegistry", () => {
  let db: Database.Database;
  let registry: HelpersRegistry;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    registry = new HelpersRegistry(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("upsert + get", () => {
    it("should assign version=1 to a brand-new helper", () => {
      const result = registry.upsert(makeInput("hello"));
      expect(result.version).toBe(1);
      expect(result.name).toBe("hello");
    });

    it("should increment version on subsequent upserts of the same name", () => {
      registry.upsert(makeInput("retry"));
      const v2 = registry.upsert(makeInput("retry", { source: "v2 source" }));

      expect(v2.version).toBe(2);
    });

    it("should track different helpers independently (independent version counters)", () => {
      const a1 = registry.upsert(makeInput("alpha"));
      const b1 = registry.upsert(makeInput("beta"));
      const a2 = registry.upsert(makeInput("alpha"));

      expect(a1.version).toBe(1);
      expect(b1.version).toBe(1);
      expect(a2.version).toBe(2);
    });

    it("should return the latest version on get(name)", () => {
      registry.upsert(makeInput("scroll", { source: "v1" }));
      registry.upsert(makeInput("scroll", { source: "v2" }));
      registry.upsert(makeInput("scroll", { source: "v3" }));

      const latest = registry.get("scroll");
      expect(latest.version).toBe(3);
      expect(latest.source).toBe("v3");
    });

    it("should throw HelperNotFoundError when name doesn't exist", () => {
      expect(() => registry.get("nonexistent_helper")).toThrow(HelperNotFoundError);
    });
  });

  describe("find (non-throwing variant)", () => {
    it("should return null when name doesn't exist", () => {
      expect(registry.find("missing")).toBeNull();
    });

    it("should return the latest version when present", () => {
      registry.upsert(makeInput("found", { source: "v1" }));
      registry.upsert(makeInput("found", { source: "v2" }));

      const result = registry.find("found");
      expect(result?.version).toBe(2);
    });
  });

  describe("list", () => {
    it("should return empty array on empty registry", () => {
      expect(registry.list()).toEqual([]);
    });

    it("should return latest version of each unique helper", () => {
      registry.upsert(makeInput("a"));
      registry.upsert(makeInput("a")); // v2
      registry.upsert(makeInput("b"));

      const all = registry.list();
      expect(all).toHaveLength(2);
      const aRec = all.find((h) => h.name === "a");
      const bRec = all.find((h) => h.name === "b");
      expect(aRec?.version).toBe(2);
      expect(bRec?.version).toBe(1);
    });

    it("should filter by origin when provided", () => {
      registry.upsert(makeInput("agent_helper", { origin: "agent" }));
      registry.upsert(makeInput("builtin_helper", { origin: "builtin" }));

      expect(registry.list("agent")).toHaveLength(1);
      expect(registry.list("agent")[0].name).toBe("agent_helper");
      expect(registry.list("builtin")).toHaveLength(1);
      expect(registry.list("builtin")[0].name).toBe("builtin_helper");
    });

    it("should sort results alphabetically by name", () => {
      registry.upsert(makeInput("zulu"));
      registry.upsert(makeInput("alpha"));
      registry.upsert(makeInput("mike"));

      const names = registry.list().map((h) => h.name);
      expect(names).toEqual(["alpha", "mike", "zulu"]);
    });
  });
});
