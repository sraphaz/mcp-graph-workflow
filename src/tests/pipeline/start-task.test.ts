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
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { startTask } from "../../core/pipeline/start-task.js";
import { makeNode, makeEpic } from "../helpers/factories.js";

describe("startTask", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Pipeline Test");

    const epic = makeEpic({ title: "User Auth Epic" });
    store.insertNode(epic);
    store.insertNode(makeNode({
      title: "Implement login endpoint",
      parentId: epic.id,
      priority: 1,
      acceptanceCriteria: [
        "POST /api/login returns JWT token",
        "Invalid credentials return 401",
      ],
    }));
    store.insertNode(makeNode({
      title: "Implement logout",
      parentId: epic.id,
      priority: 2,
    }));
  });

  afterEach(() => {
    store.close();
  });

  it("should find next task and return combined context", () => {
    const result = startTask(store, { autoStart: false });

    expect(result).not.toBeNull();
    expect(result!.task).toBeDefined();
    expect(result!.task.task.node.title).toBe("Implement login endpoint");
    expect(result!.context).toBeDefined();
    expect(result!.tddHints).toBeDefined();
    expect(result!.tddHints.length).toBeGreaterThan(0);
  });

  it("should auto-start task when autoStart is true", () => {
    const result = startTask(store, { autoStart: true });

    expect(result).not.toBeNull();
    const node = store.getNodeById(result!.task.task.node.id);
    expect(node!.status).toBe("in_progress");
    expect(result!.startedAt).toBeDefined();
    expect(result!.startedAt).not.toBeNull();
  });

  it("should not auto-start when autoStart is false", () => {
    const result = startTask(store, { autoStart: false });

    expect(result).not.toBeNull();
    const node = store.getNodeById(result!.task.task.node.id);
    expect(node!.status).toBe("backlog");
    expect(result!.startedAt).toBeNull();
  });

  it("should start specific task by nodeId", () => {
    const doc = store.toGraphDocument();
    const logoutTask = doc.nodes.find((n) => n.title === "Implement logout")!;

    const result = startTask(store, { nodeId: logoutTask.id, autoStart: false });

    expect(result).not.toBeNull();
    expect(result!.task.task.node.id).toBe(logoutTask.id);
  });

  it("should return null when no tasks available", () => {
    const emptyStore = SqliteStore.open(":memory:");
    emptyStore.initProject("Empty");
    const result = startTask(emptyStore);
    expect(result).toBeNull();
    emptyStore.close();
  });

  it("should include RAG context without throwing", () => {
    const result = startTask(store, { ragBudget: 2000, autoStart: false });

    expect(result).not.toBeNull();
    expect(result!.ragContext).toBeDefined();
  });

  it("should return null for non-existent nodeId", () => {
    const result = startTask(store, { nodeId: "non-existent" });
    expect(result).toBeNull();
  });

  it("populates modelHint with a score and recommendation for the task", () => {
    const result = startTask(store, { autoStart: false });

    expect(result).not.toBeNull();
    expect(result!.modelHint).toBeDefined();
    expect(typeof result!.modelHint!.score).toBe("number");
    expect(["haiku", "sonnet", "opus"]).toContain(result!.modelHint!.recommendation);
    expect(result!.modelHint!.rationale.length).toBeGreaterThan(0);
  });

  it("should default autoStart to true", () => {
    const result = startTask(store);

    expect(result).not.toBeNull();
    const node = store.getNodeById(result!.task.task.node.id);
    expect(node!.status).toBe("in_progress");
  });
});
