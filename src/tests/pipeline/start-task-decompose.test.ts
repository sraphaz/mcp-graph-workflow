/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-autonomy-gap — Task 1.1: Auto-trigger de decomposição em start_task
 *
 * AC1: GIVEN task L/XL + ≥2 ACs + sem filhos WHEN start_task THEN decompositionProposal returned, status unchanged
 * AC2: GIVEN decompositionProposal WHEN start_task(acceptDecomposition:true) THEN subtasks persisted + status=in_progress
 * AC3: GIVEN task xpSize=S WHEN start_task THEN no decompositionProposal
 * AC4: GIVEN task XL com filhos WHEN start_task THEN idempotente — no proposal
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { startTask } from "../../core/pipeline/start-task.js";
import { makeNode } from "../helpers/factories.js";

describe("startTask — auto-decomposition proposal", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Decompose Test");
  });

  afterEach(() => {
    store.close();
  });

  // ── AC1: L task → decompositionProposal, status unchanged ────────────────

  it("AC1: returns decompositionProposal for L task with ≥2 ACs and no children", () => {
    const task = makeNode({
      title: "Build authentication system",
      xpSize: "L",
      acceptanceCriteria: [
        "GIVEN valid credentials WHEN login THEN JWT returned",
        "GIVEN invalid credentials WHEN login THEN 401 returned",
      ],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, { nodeId: task.id, autoStart: false });

    expect(result).not.toBeNull();
    expect(result!.decompositionProposal).toBeDefined();
    expect(result!.decompositionProposal!.subtasks.length).toBeGreaterThanOrEqual(2);
  });

  it("AC1: status remains backlog when decompositionProposal is returned (autoStart=true)", () => {
    const task = makeNode({
      title: "Build reporting module",
      xpSize: "L",
      acceptanceCriteria: [
        "GIVEN report WHEN export THEN PDF generated",
        "GIVEN report WHEN share THEN link created",
      ],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, { nodeId: task.id, autoStart: true });

    expect(result).not.toBeNull();
    expect(result!.decompositionProposal).toBeDefined();
    // Status must NOT be changed to in_progress when a proposal is pending
    const node = store.getNodeById(task.id);
    expect(node!.status).toBe("backlog");
    expect(result!.startedAt).toBeNull();
  });

  it("AC1: XL task also triggers decompositionProposal", () => {
    const task = makeNode({
      title: "Full platform redesign",
      xpSize: "XL",
      acceptanceCriteria: [
        "GIVEN new design WHEN render THEN tokens applied",
        "GIVEN old pages WHEN visit THEN redirect to new",
        "GIVEN admin WHEN configure THEN settings saved",
      ],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, { nodeId: task.id, autoStart: false });

    expect(result!.decompositionProposal).toBeDefined();
  });

  // ── AC2: acceptDecomposition:true → persist subtasks + in_progress ────────

  it("AC2: persists subtasks when acceptDecomposition:true", () => {
    const task = makeNode({
      title: "Build auth system",
      xpSize: "L",
      acceptanceCriteria: [
        "GIVEN valid login WHEN POST /auth THEN JWT returned",
        "GIVEN logout WHEN DELETE /auth THEN session revoked",
      ],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, {
      nodeId: task.id,
      autoStart: true,
      acceptDecomposition: true,
    });

    expect(result).not.toBeNull();
    // Subtasks should be persisted
    const doc = store.toGraphDocument();
    const children = doc.nodes.filter((n) => n.parentId === task.id && n.type === "subtask");
    expect(children.length).toBeGreaterThanOrEqual(2);
  });

  it("AC2: task status becomes in_progress when acceptDecomposition:true", () => {
    const task = makeNode({
      title: "Build search feature",
      xpSize: "L",
      acceptanceCriteria: [
        "GIVEN query WHEN search THEN results returned",
        "GIVEN empty query WHEN search THEN all results returned",
      ],
      priority: 1,
    });
    store.insertNode(task);

    startTask(store, {
      nodeId: task.id,
      autoStart: true,
      acceptDecomposition: true,
    });

    const node = store.getNodeById(task.id);
    expect(node!.status).toBe("in_progress");
  });

  // ── AC3: S task → no proposal ─────────────────────────────────────────────

  it("AC3: no decompositionProposal for S-sized task", () => {
    const task = makeNode({
      title: "Fix login bug",
      xpSize: "S",
      acceptanceCriteria: [
        "GIVEN bug WHEN fix applied THEN passes",
        "GIVEN regression WHEN run THEN no regression",
      ],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, { nodeId: task.id, autoStart: false });

    expect(result).not.toBeNull();
    expect(result!.decompositionProposal).toBeUndefined();
  });

  it("AC3: M-sized task also has no decompositionProposal", () => {
    const task = makeNode({
      title: "Add rate limiting",
      xpSize: "M",
      acceptanceCriteria: [
        "GIVEN 100 req/min WHEN exceeded THEN 429 returned",
        "GIVEN 100 req/min WHEN within THEN pass",
      ],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, { nodeId: task.id, autoStart: false });

    expect(result!.decompositionProposal).toBeUndefined();
  });

  it("AC3: task with only 1 AC → no proposal even if L", () => {
    const task = makeNode({
      title: "Single AC L task",
      xpSize: "L",
      acceptanceCriteria: ["GIVEN one AC WHEN check THEN passes"],
      priority: 1,
    });
    store.insertNode(task);

    const result = startTask(store, { nodeId: task.id, autoStart: false });

    expect(result!.decompositionProposal).toBeUndefined();
  });

  // ── AC4: XL with children → idempotent, no re-decompose ──────────────────

  it("AC4: L task with existing children does not re-decompose", () => {
    const task = makeNode({
      title: "Complex feature already split",
      xpSize: "XL",
      acceptanceCriteria: [
        "GIVEN feature WHEN done THEN AC1 passes",
        "GIVEN feature WHEN done THEN AC2 passes",
      ],
      priority: 1,
    });
    const child = makeNode({
      title: "Existing subtask",
      type: "subtask",
      parentId: task.id,
      priority: 1,
    });
    store.insertNode(task);
    store.insertNode(child);

    const result = startTask(store, { nodeId: task.id, autoStart: false });

    expect(result!.decompositionProposal).toBeUndefined();
  });
});
