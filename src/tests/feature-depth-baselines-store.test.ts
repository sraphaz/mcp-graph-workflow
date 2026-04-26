/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  getBaseline,
  upsertBaseline,
  getBaselinesByModule,
} from "../core/feature-depth/baselines-store.js";

describe("feature-depth/baselines-store", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("test-fd");
  });

  it("returns null for an unknown file", () => {
    expect(getBaseline(store.getDb(), "src/missing.ts")).toBeNull();
  });

  it("UPSERT persists a baseline that getBaseline reads back", () => {
    upsertBaseline(store.getDb(), {
      relPath: "src/core/foo.ts",
      module: "core",
      score: 72.4,
      quadrant: "MATURE",
      testLoc: 120,
      sourceLoc: 200,
      gitCommit: "abc123",
    });
    const got = getBaseline(store.getDb(), "src/core/foo.ts");
    expect(got).not.toBeNull();
    expect(got?.score).toBe(72.4);
    expect(got?.quadrant).toBe("MATURE");
    expect(got?.module).toBe("core");
    expect(got?.gitCommit).toBe("abc123");
  });

  it("UPSERT overwrites the prior row for the same relPath", () => {
    upsertBaseline(store.getDb(), {
      relPath: "src/x.ts",
      module: "x",
      score: 50,
      quadrant: "SPECIALIZED",
      testLoc: 0,
      sourceLoc: 100,
    });
    upsertBaseline(store.getDb(), {
      relPath: "src/x.ts",
      module: "x",
      score: 80,
      quadrant: "MATURE",
      testLoc: 200,
      sourceLoc: 100,
    });
    const got = getBaseline(store.getDb(), "src/x.ts");
    expect(got?.score).toBe(80);
    expect(got?.quadrant).toBe("MATURE");
    expect(got?.testLoc).toBe(200);
  });

  it("getBaselinesByModule returns every file in that module only", () => {
    upsertBaseline(store.getDb(), {
      relPath: "src/core/rag/a.ts", module: "rag", score: 60,
      quadrant: "SPECIALIZED", testLoc: 30, sourceLoc: 100,
    });
    upsertBaseline(store.getDb(), {
      relPath: "src/core/rag/b.ts", module: "rag", score: 40,
      quadrant: "SHALLOW", testLoc: 0, sourceLoc: 100,
    });
    upsertBaseline(store.getDb(), {
      relPath: "src/core/utils/c.ts", module: "utils", score: 90,
      quadrant: "MATURE", testLoc: 200, sourceLoc: 50,
    });

    const ragRows = getBaselinesByModule(store.getDb(), "rag");
    expect(ragRows).toHaveLength(2);
    expect(ragRows.map((r) => r.relPath).sort()).toEqual([
      "src/core/rag/a.ts",
      "src/core/rag/b.ts",
    ]);
  });

  it("getBaselinesByModule returns empty array when module has no rows", () => {
    expect(getBaselinesByModule(store.getDb(), "nonexistent")).toEqual([]);
  });

  it("upsertBaseline is a no-op when no project exists (graceful)", () => {
    const empty = SqliteStore.open(":memory:");
    expect(() =>
      upsertBaseline(empty.getDb(), {
        relPath: "src/x.ts", module: "x", score: 50,
        quadrant: "SPECIALIZED", testLoc: 0, sourceLoc: 100,
      }),
    ).not.toThrow();
    expect(getBaseline(empty.getDb(), "src/x.ts")).toBeNull();
  });
});
