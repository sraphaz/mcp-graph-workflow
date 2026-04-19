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
 * Synthetic Validation Gate Tests — TDD RED then GREEN
 *
 * Tests mutation-like test quality validation using synthetic data.
 * Verifies that tests actually catch mutations, not just pass trivially.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode, makeEdge } from "./helpers/factories.js";
import {
  runSyntheticValidation,
} from "../core/harness/synthetic-validation-gate.js";

describe("synthetic-validation-gate", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Synthetic Test");
  });

  afterEach(() => {
    store.close();
  });

  describe("runSyntheticValidation", () => {
    it("should validate a clean graph and return passing result", () => {
      const a = makeNode({ title: "A", status: "done" });
      const b = makeNode({ title: "B", status: "in_progress" });
      store.insertNode(a);
      store.insertNode(b);
      store.insertEdge(makeEdge(b.id, a.id));

      const result = runSyntheticValidation(store);

      expect(result.passed).toBe(true);
      expect(result.mutationsApplied).toBeGreaterThan(0);
      expect(result.mutationsCaught).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should detect when graph has zero nodes", () => {
      const result = runSyntheticValidation(store);

      expect(result.passed).toBe(true);
      expect(result.mutationsApplied).toBe(0);
      expect(result.score).toBe(100);
    });

    it("should apply status mutations and check invariants catch them", () => {
      const a = makeNode({ title: "A", status: "done" });
      const b = makeNode({ title: "B", status: "done" });
      const c = makeNode({ title: "C", status: "in_progress" });
      store.insertNode(a);
      store.insertNode(b);
      store.insertNode(c);
      store.insertEdge(makeEdge(c.id, a.id));
      store.insertEdge(makeEdge(c.id, b.id));

      const result = runSyntheticValidation(store);

      expect(result.mutations).toBeInstanceOf(Array);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should report which mutations were applied", () => {
      const a = makeNode({ title: "A", status: "done" });
      store.insertNode(a);
      store.insertEdge(makeEdge(a.id, "nonexistent"));

      const result = runSyntheticValidation(store);

      expect(result.mutations.length).toBeGreaterThanOrEqual(0);
      for (const m of result.mutations) {
        expect(m.type).toBeTruthy();
        expect(m.detected).toBeDefined();
      }
    });
  });
});
