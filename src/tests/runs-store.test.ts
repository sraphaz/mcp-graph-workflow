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
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { RunsStore, type CreateRunInput } from "../core/browser-harness/runs-store.js";
import type { PlannedStep, StepResult } from "../schemas/browser-harness.schema.js";

function makeRunInput(overrides: Partial<CreateRunInput> = {}): CreateRunInput {
  const plannedStep: PlannedStep = {
    index: 0,
    helper: "navigate",
    args: { url: "https://example.com" },
    expect: "page loads",
  };

  const stepResult: StepResult = {
    index: 0,
    helper: "navigate",
    ok: true,
    durationMs: 100,
    screenshotPath: null,
    error: null,
  };

  return {
    sessionId: "session-1",
    nodeId: null,
    prompt: "test prompt",
    plan: [plannedStep],
    results: [stepResult],
    verdict: "pass",
    durationMs: 500,
    ...overrides,
  };
}

describe("RunsStore", () => {
  let db: Database.Database;
  let store: RunsStore;
  let projectRoot: string;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    projectRoot = mkdtempSync(path.join(os.tmpdir(), "runs-store-test-"));
    store = new RunsStore(db, projectRoot);
  });

  afterEach(() => {
    db.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  describe("create + get round-trip", () => {
    it("should persist a run and return its full shape with assigned id", () => {
      const result = store.create(makeRunInput());

      expect(result.id).toMatch(/^bhrun_/);
      expect(result.sessionId).toBe("session-1");
      expect(result.verdict).toBe("pass");
      expect(result.plan).toHaveLength(1);
      expect(result.results).toHaveLength(1);
    });

    it("should retrieve the same run via get(id)", () => {
      const created = store.create(makeRunInput());
      const fetched = store.get(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.prompt).toBe("test prompt");
    });

    it("should return null when get is called with non-existent id", () => {
      expect(store.get("does-not-exist")).toBeNull();
    });

    it("should preserve nodeId=null vs an actual nodeId across round-trip", () => {
      const noNode = store.create(makeRunInput({ nodeId: null }));
      const withNode = store.create(makeRunInput({ nodeId: "task-42" }));

      expect(store.get(noNode.id)?.nodeId).toBeNull();
      expect(store.get(withNode.id)?.nodeId).toBe("task-42");
    });
  });

  describe("list", () => {
    it("should return empty array on empty store", () => {
      expect(store.list()).toEqual([]);
    });

    it("should return runs in descending creation order (most recent first)", async () => {
      const r1 = store.create(makeRunInput({ sessionId: "s1" }));
      // Tiny delay so timestamps differ.
      await new Promise((r) => setTimeout(r, 5));
      const r2 = store.create(makeRunInput({ sessionId: "s2" }));

      const list = store.list();

      expect(list[0].id).toBe(r2.id);
      expect(list[1].id).toBe(r1.id);
    });

    it("should respect the limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        store.create(makeRunInput({ sessionId: `s${i}` }));
      }
      expect(store.list(3)).toHaveLength(3);
    });
  });

  describe("updateResults", () => {
    it("should replace the results array on an existing run", () => {
      const created = store.create(makeRunInput());

      const newResult: StepResult = {
        index: 1,
        helper: "click",
        ok: false,
        durationMs: 200,
        screenshotPath: null,
        error: "click failed",
      };

      store.updateResults(created.id, [newResult]);

      const fetched = store.get(created.id);
      expect(fetched?.results).toHaveLength(1);
      expect(fetched?.results[0].ok).toBe(false);
      expect(fetched?.results[0].error).toBe("click failed");
    });
  });
});
