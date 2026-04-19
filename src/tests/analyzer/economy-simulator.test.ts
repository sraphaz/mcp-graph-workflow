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
import { simulateEconomy } from "../../core/analyzer/economy-simulator.js";
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

const defaultParams = { playerCount: 1000, avgSessionHours: 3, avgLevel: 30 };

describe("simulateEconomy", () => {
  it("should report balanced economy with formula inflow and outflow nodes", () => {
    const inflow = makeNode({
      type: "formula",
      title: "Quest reward gold",
      description: "Gold earned from quest rewards",
      metadata: {
        expression: "50 * level",
        outputs: ["gold_earned"],
        rate: 100,
      },
    });
    const outflow = makeNode({
      type: "formula",
      title: "Repair cost",
      description: "Equipment repair cost per hour",
      metadata: {
        expression: "25 * level",
        outputs: ["gold_spent"],
        rate: 97,
      },
    });
    const doc = makeDoc([inflow, outflow]);
    const report = simulateEconomy(doc, defaultParams);

    expect(report.flows).toHaveLength(2);
    expect(report.flows.find(f => f.type === "inflow")).toBeTruthy();
    expect(report.flows.find(f => f.type === "outflow")).toBeTruthy();
    expect(report.totalInflowPerDay).toBeGreaterThan(0);
    expect(report.totalOutflowPerDay).toBeGreaterThan(0);
    expect(report.inflationRisk).toBe("low");
    expect(report.params).toEqual(defaultParams);
  });

  it("should report critical inflation risk with only inflow nodes", () => {
    const inflow1 = makeNode({
      type: "formula",
      title: "Monster drop gold",
      description: "Gold drops from monster loot",
      metadata: { expression: "100", outputs: ["gold_drop"], rate: 100 },
    });
    const inflow2 = makeNode({
      type: "formula",
      title: "Quest reward income",
      description: "Income from daily quests",
      metadata: { expression: "200", outputs: ["quest_gold"], rate: 200 },
    });
    const doc = makeDoc([inflow1, inflow2]);
    const report = simulateEconomy(doc, defaultParams);

    expect(report.flows.every(f => f.type === "inflow")).toBe(true);
    expect(report.totalOutflowPerDay).toBe(0);
    expect(report.inflationRisk).toBe("critical");
    expect(report.suggestions.some(s => s.toLowerCase().includes("sink"))).toBe(true);
  });

  it("should report none inflation risk when outflow exceeds inflow", () => {
    const inflow = makeNode({
      type: "formula",
      title: "Drop gold reward",
      description: "Small gold from drops",
      metadata: { expression: "10", outputs: ["gold"], rate: 10 },
    });
    const outflow = makeNode({
      type: "formula",
      title: "Tax fee sink",
      description: "Auction house tax fee",
      metadata: { expression: "50", outputs: ["tax"], rate: 50 },
    });
    const doc = makeDoc([inflow, outflow]);
    const report = simulateEconomy(doc, defaultParams);

    expect(report.netFlowPerDay).toBeLessThan(0);
    expect(report.inflationRisk).toBe("none");
  });

  it("should use estimated rates from descriptions when no formula nodes exist", () => {
    const rewardNode = makeNode({
      type: "task",
      title: "Implement reward system",
      description: "Players earn 500 gold per quest reward",
    });
    const sinkNode = makeNode({
      type: "task",
      title: "Implement repair cost",
      description: "Repair cost is 200 gold per session",
    });
    const doc = makeDoc([rewardNode, sinkNode]);
    const report = simulateEconomy(doc, defaultParams);

    expect(report.flows.length).toBeGreaterThan(0);
    expect(report.warnings.some(w => w.includes("estimated"))).toBe(true);
  });

  it("should suggest reducing top inflow source when inflation is high", () => {
    const bigInflow = makeNode({
      type: "formula",
      title: "Boss loot drop",
      description: "Gold from boss loot drops",
      metadata: { expression: "500", outputs: ["boss_gold"], rate: 500 },
    });
    const smallOutflow = makeNode({
      type: "formula",
      title: "Crafting fee cost",
      description: "Cost for crafting items",
      metadata: { expression: "50", outputs: ["craft_cost"], rate: 50 },
    });
    const doc = makeDoc([bigInflow, smallOutflow]);
    const report = simulateEconomy(doc, defaultParams);

    expect(report.inflationRisk === "high" || report.inflationRisk === "critical").toBe(true);
    expect(report.suggestions.some(s => s.includes("Boss loot drop"))).toBe(true);
  });

  it("should scale totals based on playerCount and avgSessionHours", () => {
    const inflow = makeNode({
      type: "formula",
      title: "Gold reward income",
      description: "Base gold income",
      metadata: { expression: "100", outputs: ["gold"], rate: 100 },
    });
    const doc = makeDoc([inflow]);

    const small = simulateEconomy(doc, { playerCount: 100, avgSessionHours: 1, avgLevel: 30 });
    const large = simulateEconomy(doc, { playerCount: 1000, avgSessionHours: 5, avgLevel: 30 });

    // 100 rate * 100 players * 1 hour = 10000
    expect(small.totalInflowPerDay).toBe(10000);
    // 100 rate * 1000 players * 5 hours = 500000
    expect(large.totalInflowPerDay).toBe(500000);
    expect(large.totalInflowPerDay).toBeGreaterThan(small.totalInflowPerDay);
  });

  it("should warn when formula expression cannot be parsed for rate", () => {
    const formula = makeNode({
      type: "formula",
      title: "Complex gold reward formula",
      description: "Gold reward calculation",
      metadata: { expression: "some_func(x)", outputs: ["gold"] },
    });
    const doc = makeDoc([formula]);
    const report = simulateEconomy(doc, defaultParams);

    expect(report.warnings.some(w => w.includes("could not extract numeric rate"))).toBe(true);
  });

  it("should handle empty graph gracefully", () => {
    const doc = makeDoc([]);
    const report = simulateEconomy(doc, defaultParams);

    expect(report.flows).toHaveLength(0);
    expect(report.totalInflowPerDay).toBe(0);
    expect(report.totalOutflowPerDay).toBe(0);
    expect(report.netFlowPerDay).toBe(0);
    expect(report.inflationRisk).toBe("none");
  });
});
