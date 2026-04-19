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

/**
 * Tests for adr-challenge-runner.ts — orchestrates the full ADR challenge flow.
 *
 * AC1: Single decision node → complete ChallengeReport
 * AC2: All decision nodes → array of reports + summary
 * AC3: Non-decision node → error
 * AC4: Structured logging
 */

import { describe, it, expect } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import {
  runAdrChallenge,
  runAllAdrChallenges,
} from "../core/designer/adr-challenge-runner.js";

function createStoreWithDecision(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("adr-challenge-test");

  // Decision node with ADR-style description
  store.insertNode(makeNode({
    id: "decision-1",
    type: "decision",
    title: "ADR-001: Use SQLite for storage",
    description: "## Status: Accepted\n## Context: Need local storage.\n## Decision: Use SQLite with npm install better-sqlite3. Manual step: configure WAL mode. Setup required for each environment.\n## Consequences: Fast local queries, no cloud dependency.",
    priority: 1,
  }));

  // Epic with JTBD format
  store.insertNode(makeNode({
    id: "epic-1",
    type: "epic",
    title: "Local-first CLI tool",
    description: "When using a CLI tool offline, I want to store data locally, so I can access it without internet.",
    priority: 2,
  }));

  // Task (non-decision, for error test)
  store.insertNode(makeNode({
    id: "task-1",
    type: "task",
    title: "Implement search",
    priority: 3,
  }));

  // Second decision
  store.insertNode(makeNode({
    id: "decision-2",
    type: "decision",
    title: "ADR-002: Use feature flag for gradual rollout",
    description: "## Status: Accepted\n## Context: Need safe deployment.\n## Decision: Use feature flag with optional config and rollback plan.\n## Consequences: Easy rollback, gradual rollout.",
    priority: 1,
  }));

  return store;
}

describe("adr-challenge-runner", () => {
  // AC1: Single decision node → ChallengeReport
  it("should run challenge for a single decision node", () => {
    const store = createStoreWithDecision();

    const result = runAdrChallenge(store, "decision-1");

    expect(result.nodeId).toBe("decision-1");
    expect(result.report).toBeDefined();
    expect(result.report.fitnessScore).toBeDefined();
    expect(result.report.fitnessScore.composite).toBeGreaterThanOrEqual(0);
    expect(result.report.fitnessScore.composite).toBeLessThanOrEqual(100);
    expect(result.report.overallVerdict.verdict).toMatch(/^CHALLENGE_(PASSED|FAILED)$/);
    expect(result.report.challengeQuestions.length).toBeGreaterThanOrEqual(3);

    store.close();
  });

  // AC2: All decision nodes → array of reports
  it("should run challenge for all decision nodes in the graph", () => {
    const store = createStoreWithDecision();

    const result = runAllAdrChallenges(store);

    expect(result.reports.length).toBe(2); // 2 decision nodes
    expect(result.summary).toBeDefined();
    expect(result.summary.totalDecisions).toBe(2);
    expect(result.summary.passed).toBeGreaterThanOrEqual(0);
    expect(result.summary.failed).toBeGreaterThanOrEqual(0);
    expect(result.summary.passed + result.summary.failed).toBe(2);

    store.close();
  });

  // AC3: Non-decision node → error
  it("should throw error for non-decision node", () => {
    const store = createStoreWithDecision();

    expect(() => runAdrChallenge(store, "task-1")).toThrow(/expected.*decision.*got.*task/i);

    store.close();
  });

  // AC3: Non-existent node → error
  it("should throw error for non-existent node", () => {
    const store = createStoreWithDecision();

    expect(() => runAdrChallenge(store, "non-existent")).toThrow();

    store.close();
  });

  // Fitness scores reflect decision quality
  it("should give better fitness to reversible decisions", () => {
    const store = createStoreWithDecision();

    const lockinResult = runAdrChallenge(store, "decision-1"); // has "npm install", "manual step"
    const flexResult = runAdrChallenge(store, "decision-2"); // has "feature flag", "rollback"

    // decision-2 (feature flag, rollback) should score at least as high on reversibility
    // decision-1 also has "config" (configure WAL) so both may score high
    expect(flexResult.report.fitnessScore.breakdown.reversibility.score)
      .toBeGreaterThanOrEqual(lockinResult.report.fitnessScore.breakdown.reversibility.score);
    // decision-1 has friction keywords (npm install, manual step) → lower friction score
    expect(flexResult.report.fitnessScore.breakdown.friction.score)
      .toBeGreaterThan(lockinResult.report.fitnessScore.breakdown.friction.score);

    store.close();
  });
});
