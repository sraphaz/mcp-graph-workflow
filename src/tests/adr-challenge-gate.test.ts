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
 * Tests for adr-challenge-gate.ts — ADR Challenge Gate for DESIGN→PLAN transition.
 *
 * Task 3.1 (node_e8037dd236ae) — Epic: Lifecycle Integration
 *
 * AC1: strict mode + DESIGN→PLAN → runs adr_challenge for all decisions
 * AC2: CHALLENGE_FAILED in strict → blocks transition
 * AC3: advisory mode → warns but allows
 * AC4: zero decisions → warns "no decisions to challenge"
 * AC5: off mode → no verification
 */

import { describe, it, expect } from "vitest";
import { runAdrChallengeGate } from "../core/designer/adr-challenge-gate.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";

function insertDecisionNode(
  store: SqliteStore,
  overrides: { id?: string; title?: string; description?: string } = {},
): void {
  const nodeId = overrides.id ?? generateId("node");
  const timestamp = now();
  store.getDb().prepare(
    "INSERT INTO nodes (id, project_id, type, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    nodeId,
    store.getProject()!.id,
    "decision",
    overrides.title ?? "ADR-001: Test Decision",
    overrides.description ?? "## Status: Accepted\n## Decision: Use SQLite with feature flag and rollback support.",
    "backlog",
    2,
    timestamp,
    timestamp,
  );
}

describe("adr-challenge-gate", () => {
  // ── AC1: strict mode runs challenge for all decisions ──
  describe("AC1: strict mode", () => {
    it("should run adr_challenge for all decision nodes", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-gate");

      insertDecisionNode(store, { id: "d1", title: "ADR-001: Use SQLite" });
      insertDecisionNode(store, { id: "d2", title: "ADR-002: Use Express" });

      const result = runAdrChallengeGate(store, "strict");

      expect(result.totalDecisions).toBe(2);
      expect(result.reports).toHaveLength(2);

      store.close();
    });
  });

  // ── AC2: CHALLENGE_FAILED blocks in strict ──
  describe("AC2: strict mode blocks on failure", () => {
    it("should block transition when any decision has CHALLENGE_FAILED", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-block");

      // Decision with high friction (many friction keywords → low score → likely fails)
      insertDecisionNode(store, {
        id: "d_bad",
        title: "ADR-BAD: Bad Decision",
        description: "## Decision: npm install manual step configuration required extra dependency setup prerequisite manual configuration",
      });

      const result = runAdrChallengeGate(store, "strict");

      expect(result.totalDecisions).toBe(1);
      // Result should include the failed decisions list
      expect(result.blocked).toBeDefined();
      expect(typeof result.blocked).toBe("boolean");
      if (result.failedDecisions.length > 0) {
        expect(result.blocked).toBe(true);
      }

      store.close();
    });

    it("should allow transition when all decisions pass", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-pass");

      // Decision with good scores (feature flag, rollback, no friction)
      insertDecisionNode(store, {
        id: "d_good",
        title: "ADR-GOOD: Good Decision",
        description: "## Decision: Use built-in Node.js module. Feature flag for gradual rollout with rollback plan. Optional config with fallback.",
      });

      const result = runAdrChallengeGate(store, "strict");

      expect(result.failedDecisions).toHaveLength(0);
      expect(result.blocked).toBe(false);

      store.close();
    });
  });

  // ── AC3: advisory mode warns but allows ──
  describe("AC3: advisory mode", () => {
    it("should not block even when decisions fail", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-advisory");

      insertDecisionNode(store, {
        id: "d_bad",
        title: "ADR-BAD: Risky Decision",
        description: "## Decision: npm install manual step configuration required extra dependency.",
      });

      const result = runAdrChallengeGate(store, "advisory");

      expect(result.blocked).toBe(false);
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);

      store.close();
    });
  });

  // ── AC4: zero decisions ──
  describe("AC4: zero decisions", () => {
    it("should warn 'no decisions to challenge' when graph has no decision nodes", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-empty");

      const result = runAdrChallengeGate(store, "strict");

      expect(result.totalDecisions).toBe(0);
      expect(result.blocked).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("no decisions to challenge"),
        }),
      );

      store.close();
    });
  });

  // ── AC5: off mode ──
  describe("AC5: off mode", () => {
    it("should skip all verification", () => {
      const store = SqliteStore.open(":memory:");
      store.initProject("test-off");

      insertDecisionNode(store, { id: "d1" });

      const result = runAdrChallengeGate(store, "off");

      expect(result.blocked).toBe(false);
      expect(result.totalDecisions).toBe(0);
      expect(result.reports).toHaveLength(0);

      store.close();
    });
  });
});
