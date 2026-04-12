/**
 * TDD Red: Auto-promote epics when all children are done + cascade down.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import { autoPromoteEpic, cascadeDownOnDone } from "../core/utils/epic-promotion.js";

describe("autoPromoteEpic", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("promote-test");
  });

  afterEach(() => {
    store.close();
  });

  it("promotes parent epic to done when all children are done", () => {
    const epic = makeNode({ type: "epic", title: "Epic A", status: "backlog" });
    const task1 = makeNode({ type: "task", title: "Task 1", status: "done", parentId: epic.id });
    const task2 = makeNode({ type: "task", title: "Task 2", status: "done", parentId: epic.id });
    store.insertNode(epic);
    store.insertNode(task1);
    store.insertNode(task2);

    const result = autoPromoteEpic(store, task1.id);
    expect(result.promoted).toContain(epic.id);

    const updated = store.getNodeById(epic.id);
    expect(updated?.status).toBe("done");
  });

  it("does NOT promote when some children are not done", () => {
    const epic = makeNode({ type: "epic", title: "Epic B", status: "backlog" });
    const task1 = makeNode({ type: "task", title: "Task 1", status: "done", parentId: epic.id });
    const task2 = makeNode({ type: "task", title: "Task 2", status: "in_progress", parentId: epic.id });
    store.insertNode(epic);
    store.insertNode(task1);
    store.insertNode(task2);

    const result = autoPromoteEpic(store, task1.id);
    expect(result.promoted).toHaveLength(0);

    const updated = store.getNodeById(epic.id);
    expect(updated?.status).toBe("backlog");
  });

  it("recursively promotes grandparent when parent promotion completes all siblings", () => {
    const grandparent = makeNode({ type: "epic", title: "PRD", status: "backlog" });
    const epic1 = makeNode({ type: "epic", title: "Epic 1", status: "done", parentId: grandparent.id });
    const epic2 = makeNode({ type: "epic", title: "Epic 2", status: "backlog", parentId: grandparent.id });
    const task1 = makeNode({ type: "task", title: "Task under Epic 2", status: "done", parentId: epic2.id });
    store.insertNode(grandparent);
    store.insertNode(epic1);
    store.insertNode(epic2);
    store.insertNode(task1);

    // Promoting task1 should: promote epic2 → then all grandparent children done → promote grandparent
    const result = autoPromoteEpic(store, task1.id);
    expect(result.promoted).toContain(epic2.id);
    expect(result.promoted).toContain(grandparent.id);

    expect(store.getNodeById(epic2.id)?.status).toBe("done");
    expect(store.getNodeById(grandparent.id)?.status).toBe("done");
  });

  it("does NOT promote if parent is already done", () => {
    const epic = makeNode({ type: "epic", title: "Already done", status: "done" });
    const task1 = makeNode({ type: "task", title: "Task 1", status: "done", parentId: epic.id });
    store.insertNode(epic);
    store.insertNode(task1);

    const result = autoPromoteEpic(store, task1.id);
    expect(result.promoted).toHaveLength(0);
  });

  it("does NOT promote if node has no parent", () => {
    const task1 = makeNode({ type: "task", title: "Orphan task", status: "done" });
    store.insertNode(task1);

    const result = autoPromoteEpic(store, task1.id);
    expect(result.promoted).toHaveLength(0);
  });

  it("limits recursion depth to prevent infinite loops", () => {
    // Create 15-level deep hierarchy (should stop at 10)
    const nodes: ReturnType<typeof makeNode>[] = [];
    for (let i = 0; i < 15; i++) {
      nodes.push(makeNode({
        type: "epic",
        title: `Level ${i}`,
        status: i === 0 ? "done" : "backlog",
        parentId: i > 0 ? nodes[i - 1].id : undefined,
      }));
    }
    for (const n of nodes) store.insertNode(n);

    const result = autoPromoteEpic(store, nodes[0].id);
    // Should promote some but stop before 15
    expect(result.promoted.length).toBeLessThan(15);
  });
});

describe("cascadeDownOnDone", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("cascade-test");
  });

  afterEach(() => {
    store.close();
  });

  it("marks AC children as done when parent is done", () => {
    const task = makeNode({ type: "task", title: "Task A", status: "done" });
    const ac1 = makeNode({ type: "acceptance_criteria", title: "AC 1", status: "backlog", parentId: task.id });
    const ac2 = makeNode({ type: "acceptance_criteria", title: "AC 2", status: "ready", parentId: task.id });
    store.insertNode(task);
    store.insertNode(ac1);
    store.insertNode(ac2);

    const result = cascadeDownOnDone(store, task.id);
    expect(result.cascaded).toHaveLength(2);

    expect(store.getNodeById(ac1.id)?.status).toBe("done");
    expect(store.getNodeById(ac2.id)?.status).toBe("done");
  });

  it("marks subtask children as done when parent is done", () => {
    const task = makeNode({ type: "task", title: "Task B", status: "done" });
    const sub1 = makeNode({ type: "subtask", title: "Sub 1", status: "backlog", parentId: task.id });
    store.insertNode(task);
    store.insertNode(sub1);

    const result = cascadeDownOnDone(store, task.id);
    expect(result.cascaded).toContain(sub1.id);
    expect(store.getNodeById(sub1.id)?.status).toBe("done");
  });

  it("does NOT cascade to task children (only AC and subtask)", () => {
    const epic = makeNode({ type: "epic", title: "Epic C", status: "done" });
    const task = makeNode({ type: "task", title: "Child task", status: "backlog", parentId: epic.id });
    store.insertNode(epic);
    store.insertNode(task);

    const result = cascadeDownOnDone(store, epic.id);
    expect(result.cascaded).toHaveLength(0);
    expect(store.getNodeById(task.id)?.status).toBe("backlog"); // NOT changed
  });

  it("skips children that are already done", () => {
    const task = makeNode({ type: "task", title: "Task D", status: "done" });
    const ac1 = makeNode({ type: "acceptance_criteria", title: "AC already done", status: "done", parentId: task.id });
    const ac2 = makeNode({ type: "acceptance_criteria", title: "AC pending", status: "backlog", parentId: task.id });
    store.insertNode(task);
    store.insertNode(ac1);
    store.insertNode(ac2);

    const result = cascadeDownOnDone(store, task.id);
    expect(result.cascaded).toHaveLength(1); // Only ac2
    expect(result.cascaded).toContain(ac2.id);
  });

  it("does nothing if parent is not done", () => {
    const task = makeNode({ type: "task", title: "Not done", status: "in_progress" });
    const ac = makeNode({ type: "acceptance_criteria", title: "AC", status: "backlog", parentId: task.id });
    store.insertNode(task);
    store.insertNode(ac);

    const result = cascadeDownOnDone(store, task.id);
    expect(result.cascaded).toHaveLength(0);
    expect(store.getNodeById(ac.id)?.status).toBe("backlog");
  });
});
