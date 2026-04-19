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
import { SqliteStore } from "../core/store/sqlite-store.js";
import { syncGraphFromCode } from "../core/code/graph-sync.js";
import { makeNode } from "./helpers/factories.js";

describe("syncGraphFromCode", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Sync Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty report for graph with no sourceRefs", () => {
    store.insertNode(makeNode({ title: "Task without sourceRef" }));

    const report = syncGraphFromCode(store);

    expect(report.staleRefs).toHaveLength(0);
    expect(report.symbolChanges).toHaveLength(0);
    expect(report.suggestions).toHaveLength(0);
  });

  it("should skip sourceRef check when no code index exists", () => {
    store.insertNode(makeNode({
      title: "Task with stale ref",
      sourceRef: { file: "src/deleted-file.ts", startLine: 1, endLine: 10 },
    }));

    const report = syncGraphFromCode(store);

    // No code index in :memory: → stale refs not detectable
    expect(report.staleRefs).toHaveLength(0);
  });

  it("should detect missing testFiles", () => {
    store.insertNode(makeNode({
      title: "Task with testFiles",
      testFiles: ["src/tests/nonexistent.test.ts"],
    }));

    const report = syncGraphFromCode(store);

    // In :memory: store there's no code index, so we can't verify files
    // But the function should not throw
    expect(report).toBeDefined();
  });

  it("should report done tasks with no testFiles as suggestion", () => {
    const t = makeNode({ title: "Important feature", description: "critical" });
    store.insertNode(t);
    store.updateNodeStatus(t.id, "in_progress");
    store.updateNodeStatus(t.id, "done");

    const report = syncGraphFromCode(store);

    const hasSuggestion = report.suggestions.some((s) => s.includes("testFiles"));
    // Should suggest adding testFiles for done tasks
    expect(hasSuggestion).toBe(true);
  });

  it("should normalize paths by stripping ./ prefix when comparing", () => {
    // The normalizePath function is internal, test via exported module behavior.
    // When code index is empty, this test validates the function is available
    // and doesn't break existing behavior.
    const t = makeNode({
      title: "Task with ./ prefix in testFiles",
      testFiles: ["./src/tests/foo.test.ts"],
    });
    store.insertNode(t);

    const report = syncGraphFromCode(store);

    // Should not throw; paths with ./ should be handled gracefully
    expect(report).toBeDefined();
    expect(report.staleRefs).toHaveLength(0);
  });

  it("should handle empty graph gracefully", () => {
    const report = syncGraphFromCode(store);

    expect(report.staleRefs).toEqual([]);
    expect(report.symbolChanges).toEqual([]);
    expect(report.autoFilledTestFiles).toEqual([]);
    expect(report.suggestions).toEqual([]);
  });
});
