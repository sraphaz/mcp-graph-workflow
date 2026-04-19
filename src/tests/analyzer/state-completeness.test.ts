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
import { analyzeStateCompleteness } from "../../core/analyzer/state-completeness.js";
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

describe("analyzeStateCompleteness", () => {
  it("should return empty report when no state machine nodes exist", () => {
    const doc = makeDoc([makeNode({ type: "task" })]);
    const report = analyzeStateCompleteness(doc);

    expect(report.totalMachines).toBe(0);
    expect(report.validCount).toBe(0);
    expect(report.machines).toHaveLength(0);
  });

  it("should report valid state machine with complete metadata", () => {
    const sm = makeNode({
      type: "state_machine",
      title: "Player FSM",
      metadata: {
        states: ["idle", "running", "jumping"],
        transitions: [
          { from: "idle", to: "running" },
          { from: "running", to: "jumping" },
          { from: "jumping", to: "idle" },
          { from: "running", to: "idle" },
          { from: "idle", to: "jumping" },
        ],
        initialState: "idle",
      },
    });
    const doc = makeDoc([sm]);
    const report = analyzeStateCompleteness(doc);

    expect(report.totalMachines).toBe(1);
    expect(report.validCount).toBe(1);
    expect(report.machines[0].valid).toBe(true);
    expect(report.machines[0].issues).toHaveLength(0);
  });

  it("should report missing metadata fields", () => {
    const sm = makeNode({
      type: "state_machine",
      title: "Empty FSM",
      metadata: {},
    });
    const doc = makeDoc([sm]);
    const report = analyzeStateCompleteness(doc);

    expect(report.validCount).toBe(0);
    expect(report.machines[0].issues).toContain("Missing 'states' in metadata");
    expect(report.machines[0].issues).toContain("Missing 'transitions' in metadata");
    expect(report.machines[0].issues).toContain("Missing 'initialState' in metadata");
  });

  it("should detect dead states with no outgoing transition", () => {
    const sm = makeNode({
      type: "state_machine",
      title: "Dead state FSM",
      metadata: {
        states: ["idle", "running", "dead_end"],
        transitions: [
          { from: "idle", to: "running" },
          { from: "running", to: "dead_end" },
          { from: "running", to: "idle" },
        ],
        initialState: "idle",
      },
    });
    const doc = makeDoc([sm]);
    const report = analyzeStateCompleteness(doc);

    expect(report.machines[0].valid).toBe(false);
    expect(report.machines[0].issues).toContain("Dead state 'dead_end': no outgoing transition");
  });

  it("should detect unreachable states with no incoming transition", () => {
    const sm = makeNode({
      type: "state_machine",
      title: "Unreachable FSM",
      metadata: {
        states: ["idle", "running", "hidden"],
        transitions: [
          { from: "idle", to: "running" },
          { from: "running", to: "idle" },
          { from: "hidden", to: "idle" },
        ],
        initialState: "idle",
      },
    });
    const doc = makeDoc([sm]);
    const report = analyzeStateCompleteness(doc);

    expect(report.machines[0].valid).toBe(false);
    expect(report.machines[0].issues).toContain("Unreachable state 'hidden': no incoming transition");
  });

  it("should detect invalid initialState not in states array", () => {
    const sm = makeNode({
      type: "state_machine",
      title: "Bad initial FSM",
      metadata: {
        states: ["idle", "running"],
        transitions: [
          { from: "idle", to: "running" },
          { from: "running", to: "idle" },
        ],
        initialState: "nonexistent",
      },
    });
    const doc = makeDoc([sm]);
    const report = analyzeStateCompleteness(doc);

    expect(report.machines[0].valid).toBe(false);
    expect(report.machines[0].issues).toContain("initialState 'nonexistent' is not in the states array");
  });
});
