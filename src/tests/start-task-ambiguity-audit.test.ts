/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-13.2 — start_task ambiguityAudit field
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { startTask } from "../core/pipeline/start-task.js";
import { makeNode, makeEpic } from "./helpers/factories.js";

describe("startTask ambiguityAudit", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Ambiguity Audit Test");
    const epic = makeEpic({ title: "E1" });
    store.insertNode(epic);
  });

  afterEach(() => {
    store.close();
  });

  it("persists ambiguityAudit in node.metadata when provided", () => {
    const task = makeNode({
      title: "Three-AC task",
      acceptanceCriteria: ["a", "b", "c"],
      priority: 1,
    });
    store.insertNode(task);

    const audit = {
      specified: ["uses Zod"],
      partial: ["error format"],
      unspecified: [{ item: "fallback", alternatives: ["throw", "warn"] }],
    };
    const result = startTask(store, { nodeId: task.id, ambiguityAudit: audit, autoStart: false });
    expect(result).not.toBeNull();

    const stored = store.getNodeById(task.id);
    expect(stored?.metadata?.ambiguityAudit).toBeDefined();
    expect((stored?.metadata?.ambiguityAudit as { specified: string[] }).specified).toEqual(["uses Zod"]);
  });

  it("emits ambiguityAuditWarning when AC>=3 and no audit", () => {
    const task = makeNode({
      title: "Unaudited",
      acceptanceCriteria: ["a", "b", "c", "d"],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, { nodeId: task.id, autoStart: false });
    expect(result?.ambiguityAuditWarning).toMatch(/ambiguidades/i);
    expect(result?.ambiguityAuditWarning).toContain("4 ACs");
  });

  it("does not warn when AC<3", () => {
    const task = makeNode({
      title: "Small",
      acceptanceCriteria: ["a", "b"],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, { nodeId: task.id, autoStart: false });
    expect(result?.ambiguityAuditWarning).toBeNull();
  });

  it("does not warn when audit is provided", () => {
    const task = makeNode({
      title: "Audited",
      acceptanceCriteria: ["a", "b", "c"],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, {
      nodeId: task.id,
      autoStart: false,
      ambiguityAudit: { specified: ["a"], partial: [], unspecified: [] },
    });
    expect(result?.ambiguityAuditWarning).toBeNull();
  });
});
