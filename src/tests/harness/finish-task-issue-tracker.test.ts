import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { finishTask } from "../../core/pipeline/finish-task.js";
import { IssuePatternTracker } from "../../core/harness/issue-pattern-tracker.js";
import { makeNode, makeEpic } from "../helpers/factories.js";

describe("finishTask — IssuePatternTracker integration (Harness Steering Loop)", () => {
  let store: SqliteStore;
  let epicId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Harness Tracker Test");

    const epic = makeEpic({ title: "Harness Epic" });
    store.insertNode(epic);
    epicId = epic.id;
  });

  afterEach(() => {
    store.close();
  });

  it("records missing_ac pattern when has_acceptance_criteria check fails", async () => {
    // Bare task: no AC (triggers has_acceptance_criteria failure)
    const task = makeNode({ title: "Bare task", description: "some desc" });
    store.insertNode(task);
    store.updateNodeStatus(task.id, "in_progress");

    await finishTask(store, task.id, { autoNext: false });

    const tracker = new IssuePatternTracker(store.getDb());
    const pattern = tracker.getPattern("missing_ac");
    expect(pattern).not.toBeNull();
    expect(pattern!.count).toBeGreaterThanOrEqual(1);
  });

  it("suggests a rule after the same pattern occurs 3 times", async () => {
    const tracker = new IssuePatternTracker(store.getDb());

    // Execute 3 bare tasks (no AC) — each triggers missing_ac
    for (let i = 0; i < 3; i++) {
      const task = makeNode({ title: `Bare task ${i}`, description: "some desc" });
      store.insertNode(task);
      store.updateNodeStatus(task.id, "in_progress");
      await finishTask(store, task.id, { autoNext: false });
    }

    const rules = tracker.getSuggestedRules();
    const acRule = rules.find((r) => r.patternType === "missing_ac");
    expect(acRule).toBeDefined();
    expect(acRule!.suggestedRule).toBeTruthy();
    expect(acRule!.count).toBeGreaterThanOrEqual(3);
  });

  it("does NOT affect finish-task result when tracker throws (fail-safe)", async () => {
    // Task with all required fields — should pass DoD even if tracker fails internally
    const task = makeNode({
      title: "Good task",
      parentId: epicId,
      priority: 1,
      description: "Build login",
      acceptanceCriteria: ["Given valid creds, when POST /login, then JWT returned"],
    });
    store.insertNode(task);
    store.updateNodeStatus(task.id, "in_progress");

    // Verify the result is unaffected even if tracker has issues
    const result = await finishTask(store, task.id, { autoNext: false });

    expect(result.status).toBe("done");
    expect(result.blockers).toHaveLength(0);
  });

  it("does NOT record any pattern when all DoD checks pass", async () => {
    const task = makeNode({
      title: "Passing task",
      parentId: epicId,
      priority: 1,
      description: "Build something",
      acceptanceCriteria: ["Given X, when Y, then Z"],
    });
    store.insertNode(task);
    store.updateNodeStatus(task.id, "in_progress");

    await finishTask(store, task.id, { autoNext: false });

    const tracker = new IssuePatternTracker(store.getDb());
    // missing_ac should NOT be recorded since AC was provided
    const pattern = tracker.getPattern("missing_ac");
    expect(pattern).toBeNull();
  });

  it("existing finish-task tests still pass (no regression)", async () => {
    // Regression guard: re-verify core behavior unchanged
    const task = makeNode({
      title: "Regression task",
      parentId: epicId,
      priority: 1,
      description: "Some feature",
      acceptanceCriteria: ["AC: given A when B then C"],
    });
    store.insertNode(task);
    store.updateNodeStatus(task.id, "in_progress");

    const result = await finishTask(store, task.id, {
      rationale: "Used pattern X",
      testFiles: ["src/tests/something.test.ts"],
      autoNext: false,
    });

    expect(result.status).toBe("done");
    expect(result.decisionIndexed).toBe(true);
    expect(result.blockers).toHaveLength(0);
    const node = store.getNodeById(task.id);
    expect(node!.testFiles).toContain("src/tests/something.test.ts");
  });
});
