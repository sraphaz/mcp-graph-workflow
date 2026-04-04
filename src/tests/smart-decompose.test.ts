import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { smartDecompose } from "../core/planner/smart-decompose.js";
import { makeNode } from "./helpers/factories.js";

describe("smartDecompose", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Decompose Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should create 1 subtask per AC", () => {
    const task = makeNode({
      title: "User login",
      acceptanceCriteria: [
        "POST /api/login returns JWT token",
        "Invalid credentials return 401",
        "Rate limiting after 5 attempts",
      ],
    });
    store.insertNode(task);

    const result = smartDecompose(store, task.id);

    expect(result).not.toBeNull();
    expect(result!.subtasks).toHaveLength(3);
    expect(result!.subtasks[0].acceptanceCriteria).toHaveLength(1);
  });

  it("should infer test types from AC keywords", () => {
    const task = makeNode({
      title: "Auth feature",
      acceptanceCriteria: [
        "API endpoint returns 200 for valid token",
        "Database persists session after login",
        "Page redirects to dashboard after login",
      ],
    });
    store.insertNode(task);

    const result = smartDecompose(store, task.id);

    expect(result).not.toBeNull();
    const types = result!.subtasks.map((s) => s.suggestedTestType);
    expect(types).toContain("integration"); // API/endpoint
    expect(types).toContain("integration"); // database/persists
    expect(types).toContain("e2e");         // page/redirects
  });

  it("should infer dependencies by AC order", () => {
    const task = makeNode({
      title: "Feature",
      acceptanceCriteria: ["AC 1", "AC 2", "AC 3"],
    });
    store.insertNode(task);

    const result = smartDecompose(store, task.id);

    expect(result).not.toBeNull();
    // Second subtask depends on first, third on second
    expect(result!.edges).toHaveLength(2);
    expect(result!.edges[0].relation).toBe("depends_on");
  });

  it("should return null for node without AC", () => {
    const task = makeNode({ title: "No AC task" });
    store.insertNode(task);

    const result = smartDecompose(store, task.id);

    expect(result).toBeNull();
  });

  it("should return null for non-existent node", () => {
    const result = smartDecompose(store, "non-existent");
    expect(result).toBeNull();
  });

  it("should include parent AC text in subtask title", () => {
    const task = makeNode({
      title: "Feature",
      acceptanceCriteria: ["System validates email format"],
    });
    store.insertNode(task);

    const result = smartDecompose(store, task.id);

    expect(result).not.toBeNull();
    expect(result!.subtasks[0].title).toContain("email");
  });

  it("should set reasonable estimate per subtask", () => {
    const task = makeNode({
      title: "Feature",
      acceptanceCriteria: ["AC 1", "AC 2"],
    });
    store.insertNode(task);

    const result = smartDecompose(store, task.id);

    expect(result).not.toBeNull();
    for (const sub of result!.subtasks) {
      expect(sub.estimateMinutes).toBeGreaterThan(0);
      expect(sub.estimateMinutes).toBeLessThanOrEqual(120);
    }
  });
});
