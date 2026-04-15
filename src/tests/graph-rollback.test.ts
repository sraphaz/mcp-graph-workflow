import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode, makeEdge } from "./helpers/factories.js";
import { createCheckpoint, rollbackToCheckpoint, type GraphCheckpoint } from "../core/autonomy/graph-rollback.js";

describe("graph-rollback", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Rollback Test");
  });

  afterEach(() => { store.close(); });

  describe("createCheckpoint", () => {
    it("should capture current graph state as a checkpoint", () => {
      const node = makeNode({ title: "Task A", status: "in_progress" });
      store.insertNode(node);
      const checkpoint = createCheckpoint(store, node.id);
      expect(checkpoint.nodeId).toBe(node.id);
      expect(checkpoint.snapshotId).toBeGreaterThan(0);
      expect(checkpoint.nodeCount).toBe(1);
      expect(checkpoint.edgeCount).toBe(0);
      expect(checkpoint.createdAt).toBeTruthy();
    });

    it("should capture multiple nodes and edges", () => {
      const a = makeNode({ title: "A" });
      const b = makeNode({ title: "B" });
      store.insertNode(a);
      store.insertNode(b);
      store.insertEdge(makeEdge(a.id, b.id));
      const checkpoint = createCheckpoint(store, a.id);
      expect(checkpoint.nodeCount).toBe(2);
      expect(checkpoint.edgeCount).toBe(1);
    });
  });

  describe("rollbackToCheckpoint", () => {
    it("should restore graph state to checkpoint, undoing subsequent changes", () => {
      const a = makeNode({ title: "A", status: "in_progress" });
      store.insertNode(a);
      const checkpoint = createCheckpoint(store, a.id);
      const b = makeNode({ title: "B" });
      store.insertNode(b);
      store.updateNodeStatus(a.id, "done");
      const result = rollbackToCheckpoint(store, checkpoint);
      expect(result.success).toBe(true);
      expect(result.nodesRestored).toBeGreaterThanOrEqual(1);
      const doc = store.toGraphDocument();
      const restoredA = doc.nodes.find((n: { id: string }) => n.id === a.id);
      expect(restoredA?.status).toBe("in_progress");
    });

    it("should return failure info when snapshot does not exist", () => {
      const fakeCheckpoint: GraphCheckpoint = {
        nodeId: "fake", snapshotId: 99999, nodeCount: 0, edgeCount: 0,
        createdAt: new Date().toISOString(),
      };
      const result = rollbackToCheckpoint(store, fakeCheckpoint);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should include MTTR-A measurement in result", () => {
      const a = makeNode({ title: "A" });
      store.insertNode(a);
      const checkpoint = createCheckpoint(store, a.id);
      store.updateNodeStatus(a.id, "done");
      const result = rollbackToCheckpoint(store, checkpoint);
      expect(result.mttrMs).toBeGreaterThanOrEqual(0);
    });
  });
});
