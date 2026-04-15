import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { finishTask } from "../../core/pipeline/finish-task.js";
import { makeNode, makeEpic } from "../helpers/factories.js";

describe("finishTask", () => {
  let store: SqliteStore;
  let taskId: string;
  let epicId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Pipeline Test");

    const epic = makeEpic({ title: "My Epic" });
    store.insertNode(epic);
    epicId = epic.id;

    const task = makeNode({
      title: "Implement feature",
      parentId: epic.id,
      priority: 1,
      description: "Build the login feature",
      acceptanceCriteria: ["Given valid credentials, when POST /login, then return JWT"],
    });
    store.insertNode(task);
    taskId = task.id;

    // Move to in_progress first (required by status_flow_valid check)
    store.updateNodeStatus(taskId, "in_progress");
  });

  afterEach(() => {
    store.close();
  });

  it("should mark task as done when DoD passes", async () => {
    const result = await finishTask(store, taskId, { autoNext: false });

    expect(result.status).toBe("done");
    expect(result.blockers).toHaveLength(0);
    expect(result.dodReport.score).toBeGreaterThan(0);

    const node = store.getNodeById(taskId);
    expect(node!.status).toBe("done");
  });

  it("should return blocked when DoD fails", async () => {
    // Create task without AC (fails has_acceptance_criteria)
    const bareTask = makeNode({ title: "Bare task", description: "" });
    store.insertNode(bareTask);

    const result = await finishTask(store, bareTask.id, { autoNext: false });

    expect(result.status).toBe("blocked");
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("should index rationale as decision when done", async () => {
    const result = await finishTask(store, taskId, {
      rationale: "Used JWT because it's stateless",
      autoNext: false,
    });

    expect(result.status).toBe("done");
    expect(result.decisionIndexed).toBe(true);
  });

  it("should detect epic promotion when all siblings done", async () => {
    // Add second task and finish both
    const t2 = makeNode({ title: "Task 2", parentId: epicId, priority: 2, acceptanceCriteria: ["AC 2"] });
    store.insertNode(t2);
    store.updateNodeStatus(t2.id, "in_progress");
    store.updateNodeStatus(t2.id, "done");

    const result = await finishTask(store, taskId, { autoNext: false });

    expect(result.status).toBe("done");
    expect(result.epicPromotion).not.toBeNull();
    expect(result.epicPromotion!.parentId).toBe(epicId);
  });

  it("should return next task when autoNext is true", async () => {
    // Add another task to find
    const t2 = makeNode({ title: "Next task", parentId: epicId, priority: 2, acceptanceCriteria: ["AC"] });
    store.insertNode(t2);

    const result = await finishTask(store, taskId, { autoNext: true });

    expect(result.status).toBe("done");
    expect(result.nextTask).not.toBeNull();
    expect(result.nextTask!.task.node.title).toBe("Next task");
  });

  it("should not return next task when autoNext is false", async () => {
    const result = await finishTask(store, taskId, { autoNext: false });

    expect(result.nextTask).toBeNull();
  });

  it("should update testFiles when provided", async () => {
    const result = await finishTask(store, taskId, {
      testFiles: ["src/tests/login.test.ts"],
      autoNext: false,
    });

    expect(result.status).toBe("done");
    const node = store.getNodeById(taskId);
    expect(node!.testFiles).toContain("src/tests/login.test.ts");
  });
});
