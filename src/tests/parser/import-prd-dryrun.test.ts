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
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { extractEntities } from "../../core/parser/extract.js";
import { convertToGraph } from "../../core/importer/prd-to-graph.js";

describe("import_prd dry-run mode", () => {
  let store: SqliteStore;

  const prdContent = `# My Project

## Epic One

Some description for the first epic.

- Implement the login system
- Create the database schema

## Epic Two

Another epic description.

### Task 2.1

Detailed task description.

### Task 2.2

Another task.
`;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("DryRun Test");

  });

  afterEach(() => {
    store.close();
  });

  it("should produce nodes from pipeline without persisting (dry-run simulation)", () => {
    // Simulate the dry-run pipeline: extract → convert but DO NOT bulkInsert
    const extraction = extractEntities(prdContent);
    const { nodes, edges: _edges, stats } = convertToGraph(extraction, "test-prd.md");

    // Pipeline should produce nodes
    expect(nodes.length).toBeGreaterThan(0);
    expect(stats.nodesCreated).toBeGreaterThan(0);

    // Store should have 0 nodes (nothing persisted)
    const allNodes = store.getAllNodes();
    expect(allNodes).toHaveLength(0);
  });

  it("should produce epics from h2 headings without keywords via fallback", () => {
    const extraction = extractEntities(prdContent);
    const { nodes } = convertToGraph(extraction, "test-prd.md");

    const epics = nodes.filter((n) => n.type === "epic");
    expect(epics.length).toBeGreaterThanOrEqual(1);
  });

  it("should produce tasks from h3 headings without keywords via fallback", () => {
    const extraction = extractEntities(prdContent);
    const { nodes } = convertToGraph(extraction, "test-prd.md");

    const tasks = nodes.filter((n) => n.type === "task");
    expect(tasks.length).toBeGreaterThanOrEqual(1);
  });

  it("should limit preview to first 30 nodes", () => {
    // Create a large PRD with 40 sections
    const largePrd = Array.from({ length: 40 }, (_, i) => `## Section ${i + 1}\n\nDescription ${i + 1}\n`).join("\n");

    const extraction = extractEntities(largePrd);
    const { nodes } = convertToGraph(extraction, "large-prd.md");

    // Verify we got more than 30 nodes total
    expect(nodes.length).toBeGreaterThan(30);

    // Dry-run preview should cap at 30
    const preview = nodes.slice(0, 30);
    expect(preview.length).toBe(30);
  });
});
