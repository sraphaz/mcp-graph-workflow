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
 * TDD: Harness surfacing in pipeline MCP responses.
 * Validates that harnessWarning (start_task) and harnessRegression/ruleSuggestions (finish_task)
 * are properly surfaced to users.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { startTask } from "../../core/pipeline/start-task.js";
import { finishTask } from "../../core/pipeline/finish-task.js";
import { makeNode, makeEpic } from "../helpers/factories.js";

describe("harness surfacing — start_task harnessWarning", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Harness Surfacing Test");

    const epic = makeEpic({ title: "Test Epic" });
    store.insertNode(epic);
    store.insertNode(makeNode({
      title: "Task with AC",
      parentId: epic.id,
      priority: 1,
      acceptanceCriteria: ["Given input, when processed, then output is correct"],
    }));
  });

  afterEach(() => {
    store.close();
  });

  it("should include harnessWarning field in StartTaskResult", async () => {
    const result = startTask(store, { autoStart: false });

    expect(result).not.toBeNull();
    // harnessWarning should always be present in the result (may be null)
    expect("harnessWarning" in result!).toBe(true);
  });

  it("harnessWarning should be null when no harness history exists", async () => {
    const result = startTask(store, { autoStart: false });

    expect(result).not.toBeNull();
    // No harness history → null warning (no data to compare)
    expect(result!.harnessWarning).toBeNull();
  });
});

describe("harness surfacing — finish_task harnessRegression", () => {
  let store: SqliteStore;
  let taskId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Harness Surfacing Test");

    const epic = makeEpic({ title: "Test Epic" });
    store.insertNode(epic);

    const task = makeNode({
      title: "Implement feature X",
      parentId: epic.id,
      priority: 1,
      description: "Build feature X for harness testing",
      acceptanceCriteria: ["Given valid input, when processed, then correct output"],
    });
    store.insertNode(task);
    taskId = task.id;
    store.updateNodeStatus(taskId, "in_progress");
  });

  afterEach(() => {
    store.close();
  });

  it("should include harnessRegression field in FinishTaskResult", async () => {
    const result = await finishTask(store, taskId, { autoNext: false });

    expect(result).toBeDefined();
    expect("harnessRegression" in result).toBe(true);
  });

  it("should include ruleSuggestions field in FinishTaskResult", async () => {
    const result = await finishTask(store, taskId, { autoNext: false });

    expect(result).toBeDefined();
    expect("ruleSuggestions" in result).toBe(true);
    expect(Array.isArray(result.ruleSuggestions)).toBe(true);
  });

  it("ruleSuggestions should be empty when no patterns exceed threshold", async () => {
    const result = await finishTask(store, taskId, { autoNext: false });

    expect(result.ruleSuggestions).toHaveLength(0);
  });
});
