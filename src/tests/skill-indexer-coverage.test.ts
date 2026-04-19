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
import { indexSkills } from "../core/rag/skill-indexer.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { SqliteStore } from "../core/store/sqlite-store.js";

describe("indexSkills", () => {
  let sqliteStore: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Skill Indexer Test");
    knowledgeStore = new KnowledgeStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  it("should index built-in skills into knowledge store", async () => {
    const result = await indexSkills(knowledgeStore, "/nonexistent/path");

    expect(result.builtInIndexed).toBeGreaterThan(0);
    expect(result.filesystemIndexed).toBe(0);
    expect(knowledgeStore.count("skill")).toBeGreaterThan(0);
  });

  it("should return zero filesystem skills for a nonexistent path", async () => {
    const result = await indexSkills(knowledgeStore, "/tmp/does-not-exist-xyz");

    expect(result.filesystemIndexed).toBe(0);
  });

  it("should skip duplicates on second indexing", async () => {
    const first = await indexSkills(knowledgeStore, "/nonexistent");
    const second = await indexSkills(knowledgeStore, "/nonexistent");

    // Second run should have more skipped duplicates
    expect(second.skippedDuplicates).toBeGreaterThanOrEqual(first.builtInIndexed);
  });

  it("should store skills with sourceType skill", async () => {
    await indexSkills(knowledgeStore, "/nonexistent");

    const docs = knowledgeStore.list({ sourceType: "skill" });
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      expect(doc.sourceType).toBe("skill");
      expect(doc.sourceId).toMatch(/^skill:/);
    }
  });

  it("should include category and phases in skill metadata", async () => {
    await indexSkills(knowledgeStore, "/nonexistent");

    const docs = knowledgeStore.list({ sourceType: "skill" });
    const withMeta = docs.filter((d) => d.metadata?.category);
    expect(withMeta.length).toBeGreaterThan(0);
    expect(withMeta[0].metadata?.source).toBe("built-in");
  });
});
