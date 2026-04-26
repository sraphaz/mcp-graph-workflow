/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { handleFeatureDepthBaselines } from "../mcp/tools/feature-depth.js";
import { upsertBaseline } from "../core/feature-depth/baselines-store.js";

describe("feature_depth MCP tool — baselines action", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("mcp-fd-test");

    upsertBaseline(store.getDb(), {
      relPath: "src/core/rag/onnx.ts",
      module: "rag",
      score: 72,
      quadrant: "MATURE",
      testLoc: 200,
      sourceLoc: 100,
    });
    upsertBaseline(store.getDb(), {
      relPath: "src/core/rag/embed.ts",
      module: "rag",
      score: 45,
      quadrant: "SHALLOW",
      testLoc: 0,
      sourceLoc: 100,
    });
    upsertBaseline(store.getDb(), {
      relPath: "src/core/utils/errors.ts",
      module: "utils",
      score: 60,
      quadrant: "SPECIALIZED",
      testLoc: 80,
      sourceLoc: 50,
    });
  });

  it("filter by relPath returns the matching baseline only", () => {
    const r = handleFeatureDepthBaselines(store, { relPath: "src/core/rag/onnx.ts" });
    expect(r.baselines).toHaveLength(1);
    const row = r.baselines[0] as { relPath: string; score: number };
    expect(row.relPath).toBe("src/core/rag/onnx.ts");
    expect(row.score).toBe(72);
  });

  it("filter by relPath returns empty array for unknown file", () => {
    const r = handleFeatureDepthBaselines(store, { relPath: "src/missing.ts" });
    expect(r.baselines).toEqual([]);
  });

  it("filter by module returns every file in that module", () => {
    const r = handleFeatureDepthBaselines(store, { module: "rag" });
    expect(r.baselines).toHaveLength(2);
    const paths = (r.baselines as Array<{ relPath: string }>).map((b) => b.relPath).sort();
    expect(paths).toEqual([
      "src/core/rag/embed.ts",
      "src/core/rag/onnx.ts",
    ]);
  });

  it("no filter returns empty (intentional — agent must be specific)", () => {
    const r = handleFeatureDepthBaselines(store, {});
    expect(r.baselines).toEqual([]);
  });

  it("ok flag is always true (errors are swallowed by the DAO layer)", () => {
    const r = handleFeatureDepthBaselines(store, { module: "rag" });
    expect(r.ok).toBe(true);
  });
});
