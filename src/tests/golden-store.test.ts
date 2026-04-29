/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * Tests for GoldenStore — EPIC 18 Evals + Golden Dataset (E18.T02).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { GoldenStore, type GoldenEntry } from "../core/store/golden-store.js";

function makeGolden(overrides: Partial<GoldenEntry> = {}): Omit<GoldenEntry, "id" | "createdAt"> {
  return {
    input: "what is 2+2",
    expected: "4",
    scorerKind: "exact",
    tool: "analyze",
    projectId: "p1",
    metadata: { difficulty: "easy" },
    tags: ["math", "smoke"],
    ...overrides,
  };
}

describe("GoldenStore — CRUD + tagging (E18.T02)", () => {
  let db: Database.Database;
  let store: GoldenStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new GoldenStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("create returns a row with generated id and createdAt", () => {
    const created = store.create(makeGolden());
    expect(created.id).toBeTruthy();
    expect(typeof created.id).toBe("string");
    expect(created.createdAt).toBeTruthy();
    expect(created.input).toBe("what is 2+2");
    expect(created.tags).toEqual(["math", "smoke"]);
    expect(created.metadata).toEqual({ difficulty: "easy" });
  });

  it("get returns the row by id and parses metadata + tags JSON", () => {
    const created = store.create(makeGolden());
    const got = store.get(created.id);
    expect(got).not.toBeNull();
    expect(got?.id).toBe(created.id);
    expect(got?.tags).toEqual(["math", "smoke"]);
    expect(got?.metadata).toEqual({ difficulty: "easy" });
  });

  it("get returns null when id missing", () => {
    expect(store.get("does-not-exist")).toBeNull();
  });

  it("list returns all rows when no filter provided", () => {
    store.create(makeGolden({ input: "a" }));
    store.create(makeGolden({ input: "b" }));
    const rows = store.list();
    expect(rows.length).toBe(2);
  });

  it("list filters by tool", () => {
    store.create(makeGolden({ tool: "analyze" }));
    store.create(makeGolden({ tool: "next" }));
    const rows = store.list({ tool: "analyze" });
    expect(rows.length).toBe(1);
    expect(rows[0]?.tool).toBe("analyze");
  });

  it("list filters by projectId", () => {
    store.create(makeGolden({ projectId: "p1" }));
    store.create(makeGolden({ projectId: "p2" }));
    const rows = store.list({ projectId: "p2" });
    expect(rows.length).toBe(1);
    expect(rows[0]?.projectId).toBe("p2");
  });

  it("list filters by scorerKind", () => {
    store.create(makeGolden({ scorerKind: "exact" }));
    store.create(makeGolden({ scorerKind: "regex" }));
    const rows = store.list({ scorerKind: "regex" });
    expect(rows.length).toBe(1);
    expect(rows[0]?.scorerKind).toBe("regex");
  });

  it("listByTag returns rows containing the requested tag", () => {
    store.create(makeGolden({ tags: ["math", "smoke"] }));
    store.create(makeGolden({ tags: ["lang"] }));
    store.create(makeGolden({ tags: ["math", "regression"] }));
    const rows = store.listByTag("math");
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(r.tags).toContain("math");
    }
  });

  it("update mutates fields and persists JSON columns", () => {
    const created = store.create(makeGolden());
    const updated = store.update(created.id, {
      expected: "four",
      tags: ["math", "v2"],
      metadata: { difficulty: "medium" },
    });
    expect(updated).not.toBeNull();
    expect(updated?.expected).toBe("four");
    expect(updated?.tags).toEqual(["math", "v2"]);
    expect(updated?.metadata).toEqual({ difficulty: "medium" });

    const reread = store.get(created.id);
    expect(reread?.expected).toBe("four");
    expect(reread?.tags).toEqual(["math", "v2"]);
  });

  it("update returns null when id missing", () => {
    expect(store.update("does-not-exist", { expected: "x" })).toBeNull();
  });

  it("delete removes the row and returns true", () => {
    const created = store.create(makeGolden());
    expect(store.delete(created.id)).toBe(true);
    expect(store.get(created.id)).toBeNull();
  });

  it("delete returns false when id missing", () => {
    expect(store.delete("does-not-exist")).toBe(false);
  });

  it("count returns total rows matching filter", () => {
    store.create(makeGolden({ tool: "analyze" }));
    store.create(makeGolden({ tool: "analyze" }));
    store.create(makeGolden({ tool: "next" }));
    expect(store.count()).toBe(3);
    expect(store.count({ tool: "analyze" })).toBe(2);
  });

  it("list applies limit when provided", () => {
    for (let i = 0; i < 5; i++) {
      store.create(makeGolden({ input: `q${i}` }));
    }
    expect(store.list({ limit: 2 }).length).toBe(2);
  });
});
