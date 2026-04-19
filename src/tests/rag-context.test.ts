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
import { ragBuildContext } from "../core/context/rag-context.js";
import { makeNode } from "./helpers/factories.js";

describe("ragBuildContext", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("RAG Test");
  });

  afterEach(() => {
    store.close();
  });

  it("returns context with matching nodes", () => {
    store.insertNode(makeNode({ title: "Implement parser module", description: "Parse PRD files" }));
    store.insertNode(makeNode({ title: "Create database", description: "SQLite storage" }));

    const ctx = ragBuildContext(store, "parser");
    expect(ctx.query).toBe("parser");
    expect(ctx.relevantNodes.length).toBeGreaterThan(0);
    expect(ctx.relevantNodes[0].title).toContain("parser");
  });

  it("returns empty results for no match", () => {
    store.insertNode(makeNode({ title: "Hello world" }));

    const ctx = ragBuildContext(store, "nonexistent");
    expect(ctx.relevantNodes).toHaveLength(0);
    expect(ctx.expandedContexts).toHaveLength(0);
  });

  it("respects token budget", () => {
    // Insert several nodes
    for (let i = 0; i < 10; i++) {
      store.insertNode(
        makeNode({
          title: `Parser task ${i}`,
          description: `Detailed description for parser task ${i} with lots of text to consume tokens`,
        }),
      );
    }

    const ctx = ragBuildContext(store, "parser", 500);
    expect(ctx.tokenUsage.budget).toBe(500);
    expect(ctx.tokenUsage.used).toBeLessThanOrEqual(ctx.tokenUsage.budget);
    expect(ctx.tokenUsage.remaining).toBeGreaterThanOrEqual(0);
  });

  it("should not report used tokens exceeding budget", () => {
    // Populate with many nodes to ensure budget would be exceeded
    for (let i = 0; i < 20; i++) {
      store.insertNode(
        makeNode({
          title: `Parser component ${i}`,
          description: `A very detailed and long description for parser component ${i} that includes many implementation details, architecture notes, and technical specifications to ensure we consume a lot of tokens in the context expansion phase`,
        }),
      );
    }

    const ctx = ragBuildContext(store, "parser", 500);
    expect(ctx.tokenUsage.budget).toBe(500);
    expect(ctx.tokenUsage.used).toBeLessThanOrEqual(500);
    expect(ctx.tokenUsage.remaining).toBeGreaterThanOrEqual(0);
    expect(ctx.tokenUsage.used + ctx.tokenUsage.remaining).toBe(500);
  });

  it("includes expanded contexts", () => {
    const parentNode = makeNode({ title: "Parser epic", type: "epic" });
    store.insertNode(parentNode);

    const childNode = makeNode({
      title: "Parser subtask",
      type: "subtask",
      parentId: parentNode.id,
      description: "Implement parser core logic",
    });
    store.insertNode(childNode);

    const ctx = ragBuildContext(store, "parser", 8000);
    expect(ctx.expandedContexts.length).toBeGreaterThan(0);
  });

  it("token usage reports remaining correctly", () => {
    store.insertNode(makeNode({ title: "Parser task", description: "Parse files" }));

    const ctx = ragBuildContext(store, "parser", 4000);
    expect(ctx.tokenUsage.remaining).toBe(
      Math.max(0, ctx.tokenUsage.budget - ctx.tokenUsage.used),
    );
  });
});
