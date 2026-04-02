import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";

describe("Node Changelog", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  it("creates a changelog entry when updating a node title", () => {
    const node = makeNode({ title: "Original Title" });
    store.insertNode(node);

    store.updateNode(node.id, { title: "New Title" });

    const history = store.getNodeHistory(node.id);
    expect(history).toHaveLength(1);
    expect(history[0].field).toBe("title");
    expect(history[0].oldValue).toBe("Original Title");
    expect(history[0].newValue).toBe("New Title");
    expect(history[0].changedAt).toBeTruthy();
  });

  it("creates multiple changelog entries when updating multiple fields", () => {
    const node = makeNode({ title: "Task A", priority: 3 });
    store.insertNode(node);

    store.updateNode(node.id, { title: "Task B", priority: 1 });

    const history = store.getNodeHistory(node.id);
    expect(history.length).toBeGreaterThanOrEqual(2);

    const fields = history.map((h) => h.field);
    expect(fields).toContain("title");
    expect(fields).toContain("priority");

    const titleEntry = history.find((h) => h.field === "title")!;
    expect(titleEntry.oldValue).toBe("Task A");
    expect(titleEntry.newValue).toBe("Task B");

    const priorityEntry = history.find((h) => h.field === "priority")!;
    expect(priorityEntry.oldValue).toBe("3");
    expect(priorityEntry.newValue).toBe("1");
  });

  it("returns entries in reverse chronological order", () => {
    const node = makeNode({ title: "V1" });
    store.insertNode(node);

    store.updateNode(node.id, { title: "V2" });
    store.updateNode(node.id, { title: "V3" });

    const history = store.getNodeHistory(node.id);
    expect(history).toHaveLength(2);
    // Most recent first
    expect(history[0].newValue).toBe("V3");
    expect(history[1].newValue).toBe("V2");
  });

  it("does not create changelog entries when no fields actually changed", () => {
    const node = makeNode({ title: "Same" });
    store.insertNode(node);

    store.updateNode(node.id, { title: "Same" });

    const history = store.getNodeHistory(node.id);
    expect(history).toHaveLength(0);
  });

  it("handles null/undefined old values for optional fields", () => {
    const node = makeNode({}); // no description
    store.insertNode(node);

    store.updateNode(node.id, { description: "Now has description" });

    const history = store.getNodeHistory(node.id);
    expect(history).toHaveLength(1);
    expect(history[0].field).toBe("description");
    expect(history[0].oldValue).toBeNull();
    expect(history[0].newValue).toBe("Now has description");
  });

  it("records changelog for tags as JSON strings", () => {
    const node = makeNode({ tags: ["a", "b"] });
    store.insertNode(node);

    store.updateNode(node.id, { tags: ["a", "b", "c"] });

    const history = store.getNodeHistory(node.id);
    expect(history).toHaveLength(1);
    expect(history[0].field).toBe("tags");
    expect(history[0].oldValue).toBe(JSON.stringify(["a", "b"]));
    expect(history[0].newValue).toBe(JSON.stringify(["a", "b", "c"]));
  });

  it("returns empty array for node with no history", () => {
    const node = makeNode({});
    store.insertNode(node);

    const history = store.getNodeHistory(node.id);
    expect(history).toHaveLength(0);
  });
});
