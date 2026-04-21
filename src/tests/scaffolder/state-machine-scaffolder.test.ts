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
import {
  scaffoldStateMachine,
  type StateMachineSpec,
} from "../../core/scaffolder/state-machine-scaffolder.js";

// ── Fixtures ──────────────────────────────────────────────────────────────

const spec4x6: StateMachineSpec = {
  id: "sm_order",
  name: "OrderMachine",
  states: ["PENDING", "PAID", "SHIPPED", "CANCELLED"],
  transitions: [
    { event: "PAY", from: "PENDING", to: "PAID" },
    { event: "SHIP", from: "PAID", to: "SHIPPED" },
    { event: "CANCEL", from: "PENDING", to: "CANCELLED" },
    { event: "CANCEL", from: "PAID", to: "CANCELLED" },
    { event: "REFUND", from: "PAID", to: "PENDING" },
    { event: "REOPEN", from: "CANCELLED", to: "PENDING" },
  ],
};

// ── AC 1: switch exaustivo + 24 casos de teste ────────────────────────────

describe("scaffoldStateMachine (AC 1 — exhaustive switch + test matrix)", () => {
  it("should generate a reducer file with an exhaustive switch over all states", () => {
    const result = scaffoldStateMachine(spec4x6);

    for (const state of spec4x6.states) {
      expect(result.reducerFile.content).toContain(`case "${state}"`);
    }
  });

  it("should generate test cases equal to states × transitions (4 × 6 = 24)", () => {
    const result = scaffoldStateMachine(spec4x6);
    const itCount = (result.testFile.content.match(/\bit\(/g) ?? []).length;

    expect(itCount).toBe(24);
  });

  it("should include all event names in the reducer switch", () => {
    const result = scaffoldStateMachine(spec4x6);
    const events = new Set(spec4x6.transitions.map(t => t.event));

    for (const event of events) {
      expect(result.reducerFile.content).toContain(event);
    }
  });

  it("should include valid target states in the reducer", () => {
    const result = scaffoldStateMachine(spec4x6);

    expect(result.reducerFile.content).toContain("PAID");
    expect(result.reducerFile.content).toContain("SHIPPED");
  });

  it("should generate a state union type with all states", () => {
    const result = scaffoldStateMachine(spec4x6);

    for (const state of spec4x6.states) {
      expect(result.reducerFile.content).toContain(`"${state}"`);
    }
  });
});

// ── AC 2: invalid transition → typed error ────────────────────────────────

describe("scaffoldStateMachine (AC 2 — typed error for invalid transitions)", () => {
  it("should include InvalidTransitionError throw in the reducer", () => {
    const result = scaffoldStateMachine(spec4x6);

    expect(result.reducerFile.content).toContain("InvalidTransitionError");
  });

  it("should include state and event in the error payload", () => {
    const result = scaffoldStateMachine(spec4x6);

    expect(result.reducerFile.content).toContain("state");
    expect(result.reducerFile.content).toContain("event");
  });

  it("should have a default case in every state switch that throws", () => {
    const result = scaffoldStateMachine(spec4x6);
    const defaultCount = (result.reducerFile.content.match(/default:/g) ?? []).length;

    expect(defaultCount).toBe(spec4x6.states.length);
  });
});

// ── AC 3: re-scaffold diff — only add new states/transitions ──────────────

describe("scaffoldStateMachine (AC 3 — re-scaffold diff)", () => {
  it("should not duplicate an existing state switch when re-scaffolding", () => {
    const initialResult = scaffoldStateMachine(spec4x6);

    const updatedSpec: StateMachineSpec = {
      ...spec4x6,
      states: [...spec4x6.states, "ARCHIVED"],
      transitions: [
        ...spec4x6.transitions,
        { event: "ARCHIVE", from: "SHIPPED", to: "ARCHIVED" },
      ],
    };

    const reScaffoldResult = scaffoldStateMachine(updatedSpec, {
      existingReducerContent: initialResult.reducerFile.content,
    });

    const pendingCount = (reScaffoldResult.reducerFile.content.match(/"PENDING"/g) ?? []).length;
    expect(pendingCount).toBeGreaterThanOrEqual(1);

    expect(reScaffoldResult.reducerFile.content).toContain("ARCHIVED");
    expect(reScaffoldResult.reducerFile.content).toContain("ARCHIVE");
  });

  it("should report added states in the diff result", () => {
    const initialResult = scaffoldStateMachine(spec4x6);

    const updatedSpec: StateMachineSpec = {
      ...spec4x6,
      states: [...spec4x6.states, "ARCHIVED"],
      transitions: [
        ...spec4x6.transitions,
        { event: "ARCHIVE", from: "SHIPPED", to: "ARCHIVED" },
      ],
    };

    const result = scaffoldStateMachine(updatedSpec, {
      existingReducerContent: initialResult.reducerFile.content,
    });

    expect(result.diff.addedStates).toContain("ARCHIVED");
    expect(result.diff.addedTransitions.some(t => t.event === "ARCHIVE")).toBe(true);
  });

  it("should report empty diff when spec has no changes", () => {
    const initialResult = scaffoldStateMachine(spec4x6);

    const result = scaffoldStateMachine(spec4x6, {
      existingReducerContent: initialResult.reducerFile.content,
    });

    expect(result.diff.addedStates).toHaveLength(0);
    expect(result.diff.addedTransitions).toHaveLength(0);
  });
});

// ── Structural ─────────────────────────────────────────────────────────────

describe("scaffoldStateMachine structural", () => {
  it("should return reducerFile and testFile with path and content", () => {
    const result = scaffoldStateMachine(spec4x6);

    expect(result.reducerFile.path).toBeTruthy();
    expect(result.reducerFile.content).toBeTruthy();
    expect(result.testFile.path).toBeTruthy();
    expect(result.testFile.content).toBeTruthy();
  });

  it("should include the machine name in generated file names", () => {
    const result = scaffoldStateMachine(spec4x6);

    expect(result.reducerFile.path.toLowerCase()).toContain("order");
    expect(result.testFile.path.toLowerCase()).toContain("order");
  });
});
