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

import { describe, it, expect } from "vitest";
import { analyzeDataIntegrity } from "../../core/analyzer/data-integrity.js";
import { makeNode } from "../helpers/factories.js";
import type { GraphDocument } from "../../core/graph/graph-types.js";

function makeDoc(nodes: ReturnType<typeof makeNode>[]): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "test", name: "Test", createdAt: "", updatedAt: "" },
    nodes,
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("analyzeDataIntegrity", () => {
  it("should return empty report when no data_table nodes exist", () => {
    const doc = makeDoc([makeNode({ type: "task" })]);
    const report = analyzeDataIntegrity(doc);

    expect(report.totalTables).toBe(0);
    expect(report.validCount).toBe(0);
    expect(report.tables).toHaveLength(0);
  });

  it("should report valid table with columns defined", () => {
    const table = makeNode({
      type: "data_table",
      title: "Loot Table",
      metadata: { columns: ["item", "rarity", "dropRate"] },
    });
    const doc = makeDoc([table]);
    const report = analyzeDataIntegrity(doc);

    expect(report.totalTables).toBe(1);
    expect(report.validCount).toBe(1);
    expect(report.tables[0].valid).toBe(true);
  });

  it("should report missing columns", () => {
    const table = makeNode({
      type: "data_table",
      title: "Bad Table",
      metadata: {},
    });
    const doc = makeDoc([table]);
    const report = analyzeDataIntegrity(doc);

    expect(report.tables[0].valid).toBe(false);
    expect(report.tables[0].issues).toContain("Missing 'columns' in metadata");
  });

  it("should detect probability columns that do not sum to 1.0", () => {
    const table = makeNode({
      type: "data_table",
      title: "Drop Rates",
      metadata: {
        columns: ["item", "probability"],
        rowsPreview: [
          { item: "Sword", probability: 0.3 },
          { item: "Shield", probability: 0.3 },
          // Sum = 0.6, not ~1.0
        ],
      },
    });
    const doc = makeDoc([table]);
    const report = analyzeDataIntegrity(doc);

    expect(report.tables[0].valid).toBe(false);
    expect(report.tables[0].issues[0]).toContain("probability");
    expect(report.tables[0].issues[0]).toContain("0.600");
  });

  it("should detect non-positive cost values", () => {
    const table = makeNode({
      type: "data_table",
      title: "Shop Prices",
      metadata: {
        columns: ["item", "cost"],
        rowsPreview: [
          { item: "Potion", cost: 50 },
          { item: "Broken", cost: -10 },
        ],
      },
    });
    const doc = makeDoc([table]);
    const report = analyzeDataIntegrity(doc);

    expect(report.tables[0].valid).toBe(false);
    expect(report.tables[0].issues[0]).toContain("cost");
    expect(report.tables[0].issues[0]).toContain("-10");
  });
});
