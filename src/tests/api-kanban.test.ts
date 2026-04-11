import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode, makeEdge, makeDoneTask } from "./helpers/factories.js";

describe("API /api/v1/kanban", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/kanban/board", () => {
    it("should return board with 5 columns for empty graph", async () => {
      const res = await request(ctx.app).get("/api/v1/kanban/board");

      expect(res.status).toBe(200);
      expect(res.body.columns).toHaveLength(5);
      expect(res.body.columns[0].status).toBe("backlog");
      expect(res.body.swimlanes).toEqual([]);
      expect(res.body.metrics).toBeDefined();
    });

    it("should return board with cards grouped by status", async () => {
      ctx.store.insertNode(makeNode({ title: "Task A", status: "backlog" }));
      ctx.store.insertNode(makeNode({ title: "Task B", status: "in_progress" }));
      ctx.store.insertNode(makeDoneTask({ title: "Task C" }));

      const res = await request(ctx.app).get("/api/v1/kanban/board");

      expect(res.status).toBe(200);
      const backlog = res.body.columns.find((c: { status: string }) => c.status === "backlog");
      expect(backlog.cards).toHaveLength(1);
      expect(backlog.cards[0].node.title).toBe("Task A");
    });

    it("should support swimlane query parameter", async () => {
      ctx.store.insertNode(makeNode({ title: "S1", sprint: "Sprint 1", status: "backlog" }));
      ctx.store.insertNode(makeNode({ title: "S2", sprint: "Sprint 2", status: "ready" }));

      const res = await request(ctx.app).get("/api/v1/kanban/board?swimlane=sprint");

      expect(res.status).toBe(200);
      expect(res.body.swimlanes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("PATCH /api/v1/kanban/move", () => {
    it("should move a card to a new status", async () => {
      const task = makeNode({ title: "To move", status: "backlog" });
      ctx.store.insertNode(task);

      const res = await request(ctx.app)
        .patch("/api/v1/kanban/move")
        .send({ nodeId: task.id, newStatus: "ready" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.previousStatus).toBe("backlog");
      expect(res.body.newStatus).toBe("ready");

      // Verify status was actually updated
      const updated = ctx.store.getNodeById(task.id);
      expect(updated?.status).toBe("ready");
    });

    it("should return 404 for nonexistent node", async () => {
      const res = await request(ctx.app)
        .patch("/api/v1/kanban/move")
        .send({ nodeId: "nonexistent", newStatus: "ready" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should include warnings for moves with unresolved deps", async () => {
      const dep = makeNode({ title: "Not done dep", status: "backlog" });
      const task = makeNode({ title: "Moving to done", status: "in_progress" });
      ctx.store.insertNode(dep);
      ctx.store.insertNode(task);
      ctx.store.insertEdge(makeEdge(task.id, dep.id));

      const res = await request(ctx.app)
        .patch("/api/v1/kanban/move")
        .send({ nodeId: task.id, newStatus: "done" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/v1/kanban/suggestions", () => {
    it("should return suggestions array", async () => {
      ctx.store.insertNode(makeNode({ title: "Task", status: "backlog", priority: 1 }));

      const res = await request(ctx.app).get("/api/v1/kanban/suggestions");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.suggestions)).toBe(true);
    });
  });
});
