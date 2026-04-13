import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { ConflictError } from "../core/utils/errors.js";
import type { GraphNode } from "../core/graph/graph-types.js";

describe("Optimistic locking — version check in updates", () => {
  let store: SqliteStore;

  const makeNode = (id: string, title: string): GraphNode => ({
    id,
    type: "task",
    title,
    status: "backlog",
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  it("version starts at 1", () => {
    store.insertNode(makeNode("n1", "Task A"));
    const db = store.getDb();
    const row = db.prepare("SELECT version FROM nodes WHERE id = ?").get("n1") as { version: number };
    expect(row.version).toBe(1);
  });

  it("version increments on each update", () => {
    store.insertNode(makeNode("n2", "Task B"));
    store.updateNode("n2", { title: "Task B v2" });
    store.updateNode("n2", { title: "Task B v3" });

    const db = store.getDb();
    const row = db.prepare("SELECT version FROM nodes WHERE id = ?").get("n2") as { version: number };
    expect(row.version).toBe(3);
  });

  it("expectedVersion match succeeds", () => {
    store.insertNode(makeNode("n3", "Task C"));
    const result = store.updateNode("n3", { title: "Task C v2" }, { expectedVersion: 1 });
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Task C v2");
  });

  it("expectedVersion mismatch throws ConflictError", () => {
    store.insertNode(makeNode("n4", "Task D"));
    store.updateNode("n4", { title: "Task D v2" }); // version becomes 2

    expect(() => {
      store.updateNode("n4", { title: "Task D v3" }, { expectedVersion: 1 });
    }).toThrow(ConflictError);
  });

  it("ConflictError includes details", () => {
    store.insertNode(makeNode("n5", "Task E"), { agentId: "agent-x" });
    store.updateNode("n5", { title: "Task E v2" }, { agentId: "agent-y" }); // version becomes 2

    try {
      store.updateNode("n5", { title: "Task E v3" }, { expectedVersion: 1 });
      expect.unreachable("Should have thrown ConflictError");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      const conflict = err as ConflictError;
      expect(conflict.details.currentVersion).toBe(2);
      expect(conflict.details.expectedVersion).toBe(1);
      expect(conflict.details.modifiedBy).toBe("agent-y");
      expect(conflict.details.modifiedAt).toBeTruthy();
    }
  });

  it("backward compat: update without expectedVersion always succeeds", () => {
    store.insertNode(makeNode("n6", "Task F"));
    store.updateNode("n6", { title: "Task F v2" }); // version 2
    store.updateNode("n6", { title: "Task F v3" }); // version 3

    // No expectedVersion — should succeed regardless of current version
    const result = store.updateNode("n6", { title: "Task F v4" });
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Task F v4");
  });

  it("combo: agentId + expectedVersion", () => {
    store.insertNode(makeNode("n7", "Task G"));

    const result = store.updateNode(
      "n7",
      { title: "Task G v2" },
      { agentId: "agent-z", expectedVersion: 1 },
    );
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Task G v2");

    const db = store.getDb();
    const row = db.prepare("SELECT modified_by, version FROM nodes WHERE id = ?").get("n7") as {
      modified_by: string | null;
      version: number;
    };
    expect(row.modified_by).toBe("agent-z");
    expect(row.version).toBe(2);
  });
});
