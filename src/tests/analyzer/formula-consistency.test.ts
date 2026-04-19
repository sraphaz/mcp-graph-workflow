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
import { analyzeFormulaConsistency } from "../../core/analyzer/formula-consistency.js";
import { makeNode } from "../helpers/factories.js";
import type { GraphDocument } from "../../core/graph/graph-types.js";

function makeDoc(nodes: ReturnType<typeof makeNode>[], edges: GraphDocument["edges"] = []): GraphDocument {
  return {
    version: "1.0.0",
    project: { id: "test", name: "Test", createdAt: "", updatedAt: "" },
    nodes,
    edges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("analyzeFormulaConsistency", () => {
  it("should return empty report when no formula nodes exist", () => {
    const doc = makeDoc([makeNode({ type: "task" })]);
    const report = analyzeFormulaConsistency(doc);

    expect(report.totalFormulas).toBe(0);
    expect(report.validCount).toBe(0);
    expect(report.formulas).toHaveLength(0);
    expect(report.conflicts).toHaveLength(0);
  });

  it("should report valid formula with complete metadata", () => {
    const formula = makeNode({
      type: "formula",
      title: "Damage calc",
      metadata: {
        expression: "attack * multiplier - defense",
        inputs: ["attack", "multiplier", "defense"],
        outputs: ["damage"],
        externalInputs: ["attack", "multiplier", "defense"],
      },
    });
    const doc = makeDoc([formula]);
    const report = analyzeFormulaConsistency(doc);

    expect(report.totalFormulas).toBe(1);
    expect(report.validCount).toBe(1);
    expect(report.formulas[0].valid).toBe(true);
    expect(report.formulas[0].issues).toHaveLength(0);
  });

  it("should report issues when metadata fields are missing", () => {
    const formula = makeNode({
      type: "formula",
      title: "Incomplete formula",
      metadata: {},
    });
    const doc = makeDoc([formula]);
    const report = analyzeFormulaConsistency(doc);

    expect(report.totalFormulas).toBe(1);
    expect(report.validCount).toBe(0);
    expect(report.formulas[0].valid).toBe(false);
    expect(report.formulas[0].issues).toContain("Missing 'expression' in metadata");
    expect(report.formulas[0].issues).toContain("Missing 'inputs' in metadata");
    expect(report.formulas[0].issues).toContain("Missing 'outputs' in metadata");
  });

  it("should detect conflicting outputs from multiple formulas", () => {
    const f1 = makeNode({
      type: "formula",
      title: "Formula A",
      metadata: { expression: "a+b", inputs: [], outputs: ["damage"], externalInputs: [] },
    });
    const f2 = makeNode({
      type: "formula",
      title: "Formula B",
      metadata: { expression: "c*d", inputs: [], outputs: ["damage"], externalInputs: [] },
    });
    const doc = makeDoc([f1, f2]);
    const report = analyzeFormulaConsistency(doc);

    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0].output).toBe("damage");
    expect(report.conflicts[0].formulaIds).toContain(f1.id);
    expect(report.conflicts[0].formulaIds).toContain(f2.id);
  });

  it("should report unresolved inputs that are not outputs or external", () => {
    const f1 = makeNode({
      type: "formula",
      title: "Healing calc",
      metadata: {
        expression: "baseHeal + bonus",
        inputs: ["baseHeal", "bonus"],
        outputs: ["healAmount"],
      },
    });
    const doc = makeDoc([f1]);
    const report = analyzeFormulaConsistency(doc);

    expect(report.formulas[0].valid).toBe(false);
    expect(report.formulas[0].issues).toContain(
      "Input 'baseHeal' is not provided by any formula output or declared external",
    );
    expect(report.formulas[0].issues).toContain(
      "Input 'bonus' is not provided by any formula output or declared external",
    );
  });
});
