import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { checkEpicPromotion } from "../core/utils/epic-promotion.js";
import { makeNode } from "./helpers/factories.js";

describe("checkEpicPromotion", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Promotion Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return null when node has no parent", () => {
    const epic = makeNode({ type: "epic", title: "Epic" });
    store.insertNode(epic);

    const result = checkEpicPromotion(store, epic.id);
    expect(result).toBeNull();
  });

  it("should return null when not all siblings are done", () => {
    const epic = makeNode({ type: "epic", title: "Epic" });
    store.insertNode(epic);
    const t1 = makeNode({ title: "Task 1", parentId: epic.id });
    const t2 = makeNode({ title: "Task 2", parentId: epic.id });
    store.insertNode(t1);
    store.insertNode(t2);
    store.updateNodeStatus(t1.id, "in_progress");
    store.updateNodeStatus(t1.id, "done");

    const result = checkEpicPromotion(store, t1.id);
    expect(result).toBeNull();
  });

  it("should return promotion when all siblings are done", () => {
    const epic = makeNode({ type: "epic", title: "My Epic" });
    store.insertNode(epic);
    const t1 = makeNode({ title: "Task 1", parentId: epic.id });
    const t2 = makeNode({ title: "Task 2", parentId: epic.id });
    store.insertNode(t1);
    store.insertNode(t2);
    store.updateNodeStatus(t1.id, "in_progress");
    store.updateNodeStatus(t1.id, "done");
    store.updateNodeStatus(t2.id, "in_progress");
    store.updateNodeStatus(t2.id, "done");

    const result = checkEpicPromotion(store, t1.id);
    expect(result).not.toBeNull();
    expect(result!.parentId).toBe(epic.id);
    expect(result!.parentTitle).toBe("My Epic");
    expect(result!.childrenDone).toBe(2);
    expect(result!.suggestion).toContain("My Epic");
  });

  it("should return null when parent is already done", () => {
    const epic = makeNode({ type: "epic", title: "Epic" });
    store.insertNode(epic);
    const t1 = makeNode({ title: "Task 1", parentId: epic.id });
    store.insertNode(t1);
    store.updateNodeStatus(t1.id, "in_progress");
    store.updateNodeStatus(t1.id, "done");
    store.updateNodeStatus(epic.id, "in_progress");
    store.updateNodeStatus(epic.id, "done");

    const result = checkEpicPromotion(store, t1.id);
    expect(result).toBeNull();
  });

  it("should return null for non-existent node", () => {
    const result = checkEpicPromotion(store, "non-existent");
    expect(result).toBeNull();
  });
});
